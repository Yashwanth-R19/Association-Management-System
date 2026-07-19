const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Applies any pending migrations using the shared pool. Idempotent — already-applied
// files are tracked in schema_migrations and skipped, so this is safe to run on every
// server boot. Does NOT close the pool (the caller owns its lifecycle); the CLI wrapper
// below closes it only when this file is run directly.
async function runMigrations() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        const applied = new Set(
            (await client.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename)
        );

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            if (applied.has(file)) continue;

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            console.log(`Applying migration: ${file}`);

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw new Error(`Migration ${file} failed: ${err.message}`);
            }
        }

        console.log('All migrations applied.');
    } finally {
        client.release();
    }
}

module.exports = { runMigrations };

// CLI entrypoint: `npm run migrate` / `node server/db/migrate.js`.
if (require.main === module) {
    runMigrations()
        .then(() => pool.end())
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
