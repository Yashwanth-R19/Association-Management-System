const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { resyncTable } = require('../db/resync');
const { quoted, csvRow } = require('../lib/csvShape');
const {
    isValidName, isValidPhone, isValidDoorAlpha, isValidFloor,
    isBlock, normalizeBlock, isOwnershipStatus, normalizeOwnershipStatus
} = require('../lib/validators');

async function fetchResidentsCsv() {
    const { rows } = await pool.query(
        'SELECT name, door_number, contact, ownership_status, parking_slot, block, floor FROM residents ORDER BY door_number'
    );
    return rows.map(r => csvRow([
        quoted(r.name), quoted(r.door_number), quoted(r.contact),
        quoted(r.ownership_status), quoted(r.parking_slot), quoted(r.block), r.floor
    ])).join('\n');
}

async function resyncFromState(state) {
    const client = await pool.connect();
    try {
        await resyncTable(client, {
            table: 'residents',
            naturalKey: 'door_number',
            columns: ['name', 'door_number', 'contact', 'ownership_status', 'parking_slot', 'block', 'floor'],
            rows: (state || []).map(r => ({
                name: r.name,
                door_number: r.door_number,
                contact: r.contact,
                ownership_status: r.ownership,
                parking_slot: r.parking_slot,
                block: r.block,
                floor: r.floor
            }))
        });
    } finally {
        client.release();
    }
}

async function runResidentsCommand(args) {
    const csv = await fetchResidentsCsv();
    const { result, state } = await runEngine('residents', args, csv);
    await resyncFromState(state);
    return result;
}

exports.listResidents = async (req, res) => {
    try {
        res.json(await runResidentsCommand(['list']));
    } catch (err) {
        console.error('[residents:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list residents' });
    }
};

exports.addResident = async (req, res) => {
    const { name, block, floor, doorAlpha, contact, ownership, parking } = req.body || {};
    if (!name || !block || !floor || !doorAlpha || !contact || !ownership) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    if (!isValidName(name)) {
        return res.status(400).json({ status: 'error', message: 'Name must contain only letters and spaces (max 49 characters)' });
    }
    if (!isBlock(block)) {
        return res.status(400).json({ status: 'error', message: 'Block must be one of Mayflower, Tulip, Primrose, Daffodil, Orchid' });
    }
    if (!isValidFloor(floor)) {
        return res.status(400).json({ status: 'error', message: 'Floor must be a whole number between 1 and 7' });
    }
    if (!isValidDoorAlpha(doorAlpha)) {
        return res.status(400).json({ status: 'error', message: 'Door alphabet must be a single letter' });
    }
    if (!isValidPhone(contact)) {
        return res.status(400).json({ status: 'error', message: 'Contact number must be exactly 10 digits' });
    }
    if (!isOwnershipStatus(ownership)) {
        return res.status(400).json({ status: 'error', message: 'Ownership status must be OWNER or TENANT' });
    }
    try {
        const result = await runResidentsCommand([
            'add', name.trim(), normalizeBlock(block), String(floor), doorAlpha.trim().toUpperCase(),
            contact.trim(), normalizeOwnershipStatus(ownership), parking || 'NONE'
        ]);
        res.json(result);
    } catch (err) {
        console.error('[residents:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to add resident' });
    }
};

exports.deleteResident = async (req, res) => {
    try {
        const result = await runResidentsCommand(['delete', req.params.doorNumber]);
        res.json(result);
    } catch (err) {
        console.error('[residents:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete resident' });
    }
};

exports.searchResidents = async (req, res) => {
    const { type, query } = req.params;
    try {
        const result = await runResidentsCommand(['search', type, query || '']);
        res.json(result);
    } catch (err) {
        console.error('[residents:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search residents' });
    }
};
