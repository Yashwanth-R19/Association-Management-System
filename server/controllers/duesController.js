// Maintenance dues ledger. Plain Postgres CRUD joined against residents —
// "sorted by door number" falls straight out of ORDER BY r.door_number
// (Postgres's own B-tree index), so there's no need to round-trip this
// through the residents.exe BST just to get an ordering it already gives
// for free; that would be routing through the DS engine for no reason.
const pool = require('../db/pool');
const { isValidCost, isValidPeriod } = require('../lib/validators');

exports.listDues = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT d.id, d.period, d.amount, d.status, d.paid_at,
                   r.id AS resident_id, r.name AS resident_name, r.door_number
            FROM maintenance_dues d
            JOIN residents r ON r.id = d.resident_id
            ORDER BY r.door_number, d.period
        `);
        res.json(rows);
    } catch (err) {
        console.error('[dues:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list dues' });
    }
};

exports.listUnpaidDues = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT d.id, d.period, d.amount, d.status,
                   r.id AS resident_id, r.name AS resident_name, r.door_number
            FROM maintenance_dues d
            JOIN residents r ON r.id = d.resident_id
            WHERE d.status = 'UNPAID'
            ORDER BY r.door_number, d.period
        `);
        res.json(rows);
    } catch (err) {
        console.error('[dues:unpaid]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list unpaid dues' });
    }
};

exports.listDuesForResident = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT d.id, d.period, d.amount, d.status, d.paid_at
            FROM maintenance_dues d
            JOIN residents r ON r.id = d.resident_id
            WHERE r.door_number = $1
            ORDER BY d.period
        `, [req.params.doorNumber]);
        res.json(rows);
    } catch (err) {
        console.error('[dues:forResident]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list dues for resident' });
    }
};

exports.addDue = async (req, res) => {
    const { doorNumber, period, amount } = req.body || {};
    if (!doorNumber || !period || !amount) {
        return res.status(400).json({ status: 'error', message: 'doorNumber, period and amount are required' });
    }
    if (!isValidPeriod(period)) {
        return res.status(400).json({ status: 'error', message: 'Period must be in YYYY-MM format' });
    }
    if (!isValidCost(amount)) {
        return res.status(400).json({ status: 'error', message: 'Amount must be a number greater than 0' });
    }
    try {
        const { rows } = await pool.query('SELECT id FROM residents WHERE door_number = $1', [doorNumber]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Resident not found' });
        }
        await pool.query(
            `INSERT INTO maintenance_dues (resident_id, period, amount) VALUES ($1, $2, $3)
             ON CONFLICT (resident_id, period) DO UPDATE SET amount = EXCLUDED.amount`,
            [rows[0].id, period, amount]
        );
        res.json({ status: 'success', message: 'Due recorded' });
    } catch (err) {
        console.error('[dues:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to record due' });
    }
};

exports.markPaid = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `UPDATE maintenance_dues SET status = 'PAID', paid_at = now() WHERE id = $1`,
            [req.params.id]
        );
        if (rowCount === 0) return res.status(404).json({ status: 'error', message: 'Due not found' });
        res.json({ status: 'success', message: 'Marked as paid' });
    } catch (err) {
        console.error('[dues:markPaid]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to update due' });
    }
};

exports.deleteDue = async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM maintenance_dues WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ status: 'error', message: 'Due not found' });
        res.json({ status: 'success', message: 'Due deleted' });
    } catch (err) {
        console.error('[dues:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete due' });
    }
};
