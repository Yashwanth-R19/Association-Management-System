const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { resyncTable } = require('../db/resync');
const { quoted, csvRow } = require('../lib/csvShape');
const { isValidName, isValidCost } = require('../lib/validators');

async function fetchStaffRows() {
    const { rows } = await pool.query(`
        SELECT id, name, wage_per_hour,
               EXTRACT(EPOCH FROM check_in_time)::bigint AS check_in_epoch,
               COALESCE(EXTRACT(EPOCH FROM check_out_time)::bigint, 0) AS check_out_epoch
        FROM staff ORDER BY id
    `);
    return rows;
}

function toCsv(rows) {
    return rows.map(r => csvRow([r.id, quoted(r.name), r.wage_per_hour, r.check_in_epoch, r.check_out_epoch])).join('\n');
}

async function resyncFromState(state) {
    const client = await pool.connect();
    try {
        await resyncTable(client, {
            table: 'staff',
            naturalKey: 'id',
            columns: ['id', 'name', 'wage_per_hour', 'check_in_time', 'check_out_time'],
            rows: (state || []).map(s => ({
                id: s.id,
                name: s.name,
                wage_per_hour: s.wagePerHour,
                check_in_time: new Date(s.checkInTime * 1000).toISOString(),
                check_out_time: s.checkOutTime > 0 ? new Date(s.checkOutTime * 1000).toISOString() : null
            }))
        });
        await client.query(`SELECT setval(pg_get_serial_sequence('staff', 'id'), COALESCE((SELECT MAX(id) FROM staff), 1))`);
    } finally {
        client.release();
    }
}

async function runStaffCommand(args) {
    const rows = await fetchStaffRows();
    const { result, state } = await runEngine('staff', args, toCsv(rows));
    await resyncFromState(state);
    return result;
}

exports.getAllStaff = async (req, res) => {
    try {
        res.json(await runStaffCommand(['list']));
    } catch (err) {
        console.error('[staff:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list staff' });
    }
};

exports.addStaff = async (req, res) => {
    const { staffName, wagePerHour } = req.body || {};
    if (!staffName || !wagePerHour) {
        return res.status(400).json({ status: 'error', message: 'Name and wage are required' });
    }
    if (!isValidName(staffName)) {
        return res.status(400).json({ status: 'error', message: 'Name must contain only letters and spaces (max 49 characters)' });
    }
    if (!isValidCost(wagePerHour)) {
        return res.status(400).json({ status: 'error', message: 'Wage per hour must be a number greater than 0' });
    }
    try {
        const rows = await fetchStaffRows();
        const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
        const { result, state } = await runEngine('staff', ['add', String(nextId), staffName, String(wagePerHour)], toCsv(rows));
        await resyncFromState(state);
        res.json(result);
    } catch (err) {
        console.error('[staff:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to add staff' });
    }
};

exports.checkOutStaff = async (req, res) => {
    const { staffName } = req.body || {};
    if (!staffName) {
        return res.status(400).json({ status: 'error', message: 'Name is required' });
    }
    try {
        res.json(await runStaffCommand(['checkout', staffName]));
    } catch (err) {
        console.error('[staff:checkout]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to check out staff' });
    }
};

exports.deleteStaff = async (req, res) => {
    const { staffName } = req.params;
    if (!staffName) {
        return res.status(400).json({ status: 'error', message: 'Name is required' });
    }
    try {
        res.json(await runStaffCommand(['delete', staffName]));
    } catch (err) {
        console.error('[staff:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete staff' });
    }
};

exports.searchStaff = async (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ status: 'error', message: 'Search query is required' });
    }
    try {
        res.json(await runStaffCommand(['search', name]));
    } catch (err) {
        console.error('[staff:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search staff' });
    }
};
