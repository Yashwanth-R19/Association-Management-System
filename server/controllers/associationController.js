const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { resyncTable } = require('../db/resync');
const { quoted, csvRow } = require('../lib/csvShape');
const { isValidName, isValidPhone, isValidEmail, isAssociationRole } = require('../lib/validators');

async function fetchMemberRows() {
    const { rows } = await pool.query('SELECT id, name, role, email, phone, door_number FROM association_members ORDER BY id');
    return rows;
}

function toCsv(rows) {
    return rows.map(r => csvRow([r.id, quoted(r.name), quoted(r.role), quoted(r.email), quoted(r.phone), quoted(r.door_number)])).join('\n');
}

async function resyncFromState(state) {
    const client = await pool.connect();
    try {
        await resyncTable(client, {
            table: 'association_members',
            naturalKey: 'id',
            columns: ['id', 'name', 'role', 'email', 'phone', 'door_number'],
            rows: (state || []).map(m => ({
                id: m.id, name: m.name, role: m.role, email: m.email, phone: m.phone, door_number: m.houseNumber
            }))
        });
        // Keep the id sequence ahead of any manually-assigned ids so future SERIAL inserts never collide.
        await client.query(`SELECT setval(pg_get_serial_sequence('association_members', 'id'), COALESCE((SELECT MAX(id) FROM association_members), 1))`);
    } finally {
        client.release();
    }
}

async function runAssociationCommand(args) {
    const rows = await fetchMemberRows();
    const { result, state } = await runEngine('association', args, toCsv(rows));
    await resyncFromState(state);
    return { result, rows };
}

exports.listMembers = async (req, res) => {
    try {
        const { result } = await runAssociationCommand(['list']);
        res.json(result);
    } catch (err) {
        console.error('[association:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list members' });
    }
};

exports.addMember = async (req, res) => {
    const { name, role, email, phone, houseNumber } = req.body || {};
    if (!name || !role || !email || !phone) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    if (!isValidName(name)) {
        return res.status(400).json({ status: 'error', message: 'Name must contain only letters and spaces (max 49 characters)' });
    }
    if (!isAssociationRole(role)) {
        return res.status(400).json({ status: 'error', message: 'Role must be one of Resident, Committee Member, President, Secretary, Treasurer' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ status: 'error', message: 'Email must be a valid address' });
    }
    if (!isValidPhone(phone)) {
        return res.status(400).json({ status: 'error', message: 'Phone number must be exactly 10 digits' });
    }
    try {
        const rows = await fetchMemberRows();
        const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
        const { result, state } = await runEngine('association', ['add', String(nextId), name, role, email, phone, houseNumber || ''], toCsv(rows));
        await resyncFromState(state);
        res.json(result);
    } catch (err) {
        console.error('[association:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to add member' });
    }
};

exports.deleteMember = async (req, res) => {
    try {
        const { result } = await runAssociationCommand(['delete', req.params.id]);
        res.json(result);
    } catch (err) {
        console.error('[association:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete member' });
    }
};

exports.searchMembers = async (req, res) => {
    const { type, query } = req.params;
    try {
        const { result } = await runAssociationCommand(['search', type, query]);
        res.json(result);
    } catch (err) {
        console.error('[association:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search members' });
    }
};
