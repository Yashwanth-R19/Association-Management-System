// Bootstrap an admin/secretary account. There's no self-service signup UI —
// this is the only way to create a login, matching "small, known set of people".
//
// Usage: npm run create-user -- --username alice --password secret --role admin
const bcrypt = require('bcryptjs');
const pool = require('./pool');

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            args[argv[i].slice(2)] = argv[i + 1];
            i++;
        }
    }
    return args;
}

async function main() {
    const { username, password, role } = parseArgs(process.argv.slice(2));

    if (!username || !password || !role) {
        console.error('Usage: npm run create-user -- --username <name> --password <pw> --role <admin|secretary>');
        process.exit(1);
    }
    if (!['admin', 'secretary'].includes(role)) {
        console.error('Role must be "admin" or "secretary"');
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
        await pool.query(
            `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)
             ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
            [username, passwordHash, role]
        );
        console.log(`User "${username}" (${role}) created/updated.`);
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
