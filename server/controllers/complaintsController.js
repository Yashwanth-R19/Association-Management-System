const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { resyncTable } = require('../db/resync');
const { quoted, csvRow } = require('../lib/csvShape');
const { isNonEmptyString, isComplaintPriority } = require('../lib/validators');

async function fetchComplaintRows() {
    const { rows } = await pool.query(`
        SELECT id, title, description, priority, status, raised_by, assigned_to,
               EXTRACT(EPOCH FROM created_at)::bigint AS created_epoch,
               COALESCE(EXTRACT(EPOCH FROM resolved_at)::bigint, 0) AS resolved_epoch
        FROM complaints ORDER BY created_at
    `);
    return rows;
}

function toCsv(rows) {
    return rows.map(r => csvRow([
        r.id, quoted(r.title), quoted(r.description), quoted(r.priority),
        quoted(r.status), quoted(r.raised_by), quoted(r.assigned_to),
        r.created_epoch, r.resolved_epoch
    ])).join('\n');
}

async function resyncFromState(state) {
    const client = await pool.connect();
    try {
        await resyncTable(client, {
            table: 'complaints',
            naturalKey: 'id',
            columns: ['id', 'title', 'description', 'priority', 'status', 'raised_by', 'assigned_to', 'created_at', 'resolved_at'],
            rows: (state || []).map(c => ({
                id: c.id, title: c.title, description: c.description, priority: c.priority, status: c.status,
                raised_by: c.raisedBy, assigned_to: c.assignedTo,
                created_at: new Date(c.createdAt * 1000).toISOString(),
                resolved_at: c.resolvedAt > 0 ? new Date(c.resolvedAt * 1000).toISOString() : null
            }))
        });
        await client.query(`SELECT setval(pg_get_serial_sequence('complaints', 'id'), COALESCE((SELECT MAX(id) FROM complaints), 1))`);
    } finally {
        client.release();
    }
}

async function runComplaintsCommand(args) {
    const rows = await fetchComplaintRows();
    const { result, state } = await runEngine('complaints', args, toCsv(rows));
    await resyncFromState(state);
    return result;
}

exports.listComplaints = async (req, res) => {
    try {
        res.json(await runComplaintsCommand(['list']));
    } catch (err) {
        console.error('[complaints:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list complaints' });
    }
};

exports.addComplaint = async (req, res) => {
    const { title, description, priority, raisedBy } = req.body || {};
    if (!title || !raisedBy) {
        return res.status(400).json({ status: 'error', message: 'Title and raised-by are required' });
    }
    if (!isNonEmptyString(title)) {
        return res.status(400).json({ status: 'error', message: 'Title cannot be empty' });
    }
    if (priority !== undefined && priority !== null && priority !== '' && !isComplaintPriority(priority)) {
        return res.status(400).json({ status: 'error', message: 'Priority must be one of low, normal, high' });
    }
    const normalizedPriority = isComplaintPriority(priority) ? priority : 'normal';
    try {
        const rows = await fetchComplaintRows();
        const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
        const { result, state } = await runEngine(
            'complaints',
            ['add', String(nextId), title, description || '', normalizedPriority, raisedBy, String(Math.floor(Date.now() / 1000))],
            toCsv(rows)
        );
        await resyncFromState(state);
        res.json(result);
    } catch (err) {
        console.error('[complaints:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to submit complaint' });
    }
};

exports.assignComplaint = async (req, res) => {
    const { assignedTo } = req.body || {};
    if (!assignedTo) {
        return res.status(400).json({ status: 'error', message: 'assignedTo is required' });
    }
    try {
        res.json(await runComplaintsCommand(['assign', req.params.id, assignedTo]));
    } catch (err) {
        console.error('[complaints:assign]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to assign complaint' });
    }
};

exports.resolveComplaint = async (req, res) => {
    try {
        res.json(await runComplaintsCommand(['resolve', req.params.id, String(Math.floor(Date.now() / 1000))]));
    } catch (err) {
        console.error('[complaints:resolve]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to resolve complaint' });
    }
};

exports.deleteComplaint = async (req, res) => {
    try {
        res.json(await runComplaintsCommand(['delete', req.params.id]));
    } catch (err) {
        console.error('[complaints:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete complaint' });
    }
};

exports.searchComplaints = async (req, res) => {
    const { type, query } = req.params;
    try {
        res.json(await runComplaintsCommand(['search', type, query]));
    } catch (err) {
        console.error('[complaints:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search complaints' });
    }
};
