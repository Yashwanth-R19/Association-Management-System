const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { resyncTable } = require('../db/resync');
const { sanitizeField, quoted, csvRow } = require('../lib/csvShape');
const { isNonEmptyString, isValidIsoDate, isValidTime } = require('../lib/validators');

async function fetchMeetingRows() {
    const { rows } = await pool.query('SELECT id, date, time, title, agenda, location, attendees, outcome FROM meetings ORDER BY id');
    return rows;
}

function toCsv(rows) {
    return rows.map(r => csvRow([
        r.id, quoted(r.date), quoted(r.time), quoted(r.title), quoted(r.agenda),
        quoted(r.location), quoted((r.attendees || []).map(a => sanitizeField(a).replace(/\|/g, '')).join('|')),
        quoted(r.outcome)
    ])).join('\n');
}

async function resyncFromState(state) {
    const client = await pool.connect();
    try {
        await resyncTable(client, {
            table: 'meetings',
            naturalKey: 'id',
            columns: ['id', 'date', 'time', 'title', 'agenda', 'location', 'attendees', 'outcome'],
            rows: (state || []).map(m => ({
                id: m.id, date: m.date, time: m.time, title: m.title, agenda: m.agenda,
                location: m.location, attendees: m.attendees || [], outcome: m.outcome
            }))
        });
        await client.query(`SELECT setval(pg_get_serial_sequence('meetings', 'id'), COALESCE((SELECT MAX(id) FROM meetings), 1))`);
    } finally {
        client.release();
    }
}

async function runMeetingsCommand(args) {
    const rows = await fetchMeetingRows();
    const { result, state } = await runEngine('meetings', args, toCsv(rows));
    await resyncFromState(state);
    return result;
}

exports.listMeetings = async (req, res) => {
    try {
        res.json(await runMeetingsCommand(['list']));
    } catch (err) {
        console.error('[meetings:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list meetings' });
    }
};

exports.addMeeting = async (req, res) => {
    const { date, time, title, agenda, location, attendees, outcome } = req.body || {};
    if (!date || !time || !title) {
        return res.status(400).json({ status: 'error', message: 'Date, time and title are required' });
    }
    if (!isValidIsoDate(date)) {
        return res.status(400).json({ status: 'error', message: 'Date must be a valid calendar date (YYYY-MM-DD)' });
    }
    if (!isValidTime(time)) {
        return res.status(400).json({ status: 'error', message: 'Time must be in HH:MM (24-hour) format' });
    }
    if (!isNonEmptyString(title)) {
        return res.status(400).json({ status: 'error', message: 'Title cannot be empty' });
    }
    try {
        const rows = await fetchMeetingRows();
        const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
        const { result, state } = await runEngine(
            'meetings',
            ['add', String(nextId), date, time, title, agenda || '', location || '', attendees || '', outcome || ''],
            toCsv(rows)
        );
        await resyncFromState(state);
        res.json(result);
    } catch (err) {
        console.error('[meetings:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to add meeting' });
    }
};

exports.deleteMeeting = async (req, res) => {
    try {
        res.json(await runMeetingsCommand(['delete', req.params.id]));
    } catch (err) {
        console.error('[meetings:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete meeting' });
    }
};

exports.searchMeetings = async (req, res) => {
    const { type, query } = req.params;
    try {
        res.json(await runMeetingsCommand(['search', type, query]));
    } catch (err) {
        console.error('[meetings:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search meetings' });
    }
};
