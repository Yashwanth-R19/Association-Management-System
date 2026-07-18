// Wipes every data table so the database can be repopulated with fresh
// synthetic data (see seedSynthetic.js). Deliberately leaves `users` alone —
// account bootstrap is a separate, explicit step (`npm run create-user`) and
// shouldn't be silently destroyed by a data reset.
const pool = require('./pool');

const TABLES = [
    'maintenance_dues',
    'vendor_ratings',
    'residents',
    'association_members',
    'vendors',
    'staff',
    'meetings',
    'facility_bookings',
    'complaints',
    'notices',
    'login_audit'
];

async function reset() {
    try {
        await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
        console.log(`Reset complete: cleared ${TABLES.length} tables (users left untouched).`);
    } finally {
        await pool.end();
    }
}

reset().catch(err => {
    console.error(err);
    process.exit(1);
});
