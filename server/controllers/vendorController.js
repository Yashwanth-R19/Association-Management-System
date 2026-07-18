const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { resyncTable } = require('../db/resync');
const { quoted, csvRow } = require('../lib/csvShape');
const { isValidName, isValidPhone, isValidEmail, isValidCost, isValidMonthYear } = require('../lib/validators');

async function fetchVendorRows() {
    const { rows } = await pool.query(`
        SELECT v.id, v.name, v.phone, v.email, v.work_description, v.cost, v.start_date, v.end_date,
               COALESCE(AVG(r.rating), 0) AS avg_rating
        FROM vendors v
        LEFT JOIN vendor_ratings r ON r.vendor_id = v.id
        GROUP BY v.id
        ORDER BY v.id
    `);
    return rows;
}

function toCsv(rows) {
    return rows.map(r => csvRow([
        r.id, quoted(r.name), quoted(r.phone), quoted(r.email),
        quoted(r.work_description), r.cost, quoted(r.start_date), quoted(r.end_date),
        Number(r.avg_rating).toFixed(2)
    ])).join('\n');
}

async function resyncFromState(state) {
    const client = await pool.connect();
    try {
        await resyncTable(client, {
            table: 'vendors',
            naturalKey: 'id',
            columns: ['id', 'name', 'phone', 'email', 'work_description', 'cost', 'start_date', 'end_date'],
            rows: (state || []).map(v => ({
                id: v.id, name: v.name, phone: v.phone, email: v.email,
                work_description: v.workDescription, cost: v.cost, start_date: v.startDate, end_date: v.endDate
            }))
        });
        await client.query(`SELECT setval(pg_get_serial_sequence('vendors', 'id'), COALESCE((SELECT MAX(id) FROM vendors), 1))`);
    } finally {
        client.release();
    }
}

async function runVendorCommand(args) {
    const rows = await fetchVendorRows();
    const { result, state } = await runEngine('vendor', args, toCsv(rows));
    await resyncFromState(state);
    return result;
}

exports.listVendors = async (req, res) => {
    try {
        res.json(await runVendorCommand(['list']));
    } catch (err) {
        console.error('[vendor:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list vendors' });
    }
};

exports.addVendor = async (req, res) => {
    const { name, phone, email, workDescription, cost, startDate, endDate } = req.body || {};
    if (!name || !phone || !email || !cost) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    if (!isValidName(name)) {
        return res.status(400).json({ status: 'error', message: 'Name must contain only letters and spaces (max 49 characters)' });
    }
    if (!isValidPhone(phone)) {
        return res.status(400).json({ status: 'error', message: 'Phone number must be exactly 10 digits' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ status: 'error', message: 'Email must be a valid address' });
    }
    if (!isValidCost(cost)) {
        return res.status(400).json({ status: 'error', message: 'Cost must be a number greater than 0' });
    }
    if (startDate && !isValidMonthYear(startDate)) {
        return res.status(400).json({ status: 'error', message: 'Start date must be in MM/YY format' });
    }
    if (endDate && !isValidMonthYear(endDate)) {
        return res.status(400).json({ status: 'error', message: 'End date must be in MM/YY format' });
    }
    try {
        const rows = await fetchVendorRows();
        const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
        const { result, state } = await runEngine(
            'vendor',
            ['add', String(nextId), name, phone, email, workDescription || '', String(cost), startDate || '', endDate || ''],
            toCsv(rows)
        );
        await resyncFromState(state);
        res.json(result);
    } catch (err) {
        console.error('[vendor:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to add vendor' });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        res.json(await runVendorCommand(['delete', req.params.id]));
    } catch (err) {
        console.error('[vendor:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete vendor' });
    }
};

exports.searchVendors = async (req, res) => {
    const { type, query } = req.params;
    try {
        res.json(await runVendorCommand(['search', type, query]));
    } catch (err) {
        console.error('[vendor:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search vendors' });
    }
};

exports.getMinCostVendor = async (req, res) => {
    try {
        res.json(await runVendorCommand(['min-cost']));
    } catch (err) {
        console.error('[vendor:min-cost]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to compute minimum-cost vendor' });
    }
};

exports.getBestValueVendor = async (req, res) => {
    try {
        res.json(await runVendorCommand(['best-value']));
    } catch (err) {
        console.error('[vendor:best-value]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to compute best-value vendor' });
    }
};

exports.addRating = async (req, res) => {
    const vendorId = parseInt(req.params.id, 10);
    const { rating, note } = req.body || {};
    const ratingNum = parseInt(rating, 10);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ status: 'error', message: 'Rating must be an integer from 1 to 5' });
    }
    try {
        await pool.query(
            'INSERT INTO vendor_ratings (vendor_id, rating, note, rated_by) VALUES ($1, $2, $3, $4)',
            [vendorId, ratingNum, note || null, req.user ? req.user.sub : null]
        );
        res.json({ status: 'success', message: 'Rating recorded' });
    } catch (err) {
        console.error('[vendor:addRating]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to record rating' });
    }
};

exports.listRatings = async (req, res) => {
    const vendorId = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(
            `SELECT r.id, r.rating, r.note, r.created_at, u.username AS rated_by
             FROM vendor_ratings r LEFT JOIN users u ON u.id = r.rated_by
             WHERE r.vendor_id = $1 ORDER BY r.created_at DESC`,
            [vendorId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[vendor:listRatings]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list ratings' });
    }
};
