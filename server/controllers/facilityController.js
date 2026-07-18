const pool = require('../db/pool');
const { runEngine } = require('../lib/dsEngine');
const { quoted, csvRow } = require('../lib/csvShape');
const { isFacility, isValidIsoDate, isValidTime } = require('../lib/validators');

// Bookings are an append-only log (no edit/delete), so unlike the other
// modules this doesn't need the full resync-by-natural-key machinery — a
// successful "book" command is just inserted directly once the DS engine has
// confirmed there's no time-slot conflict.
async function fetchBookingsCsv() {
    const { rows } = await pool.query(`
        SELECT facility_name, resident_door_number, resident_name,
               EXTRACT(EPOCH FROM start_time)::bigint AS start_epoch,
               EXTRACT(EPOCH FROM end_time)::bigint AS end_epoch
        FROM facility_bookings ORDER BY start_time
    `);
    return rows.map(r => csvRow([
        quoted(r.facility_name), quoted(r.resident_door_number), quoted(r.resident_name),
        r.start_epoch, r.end_epoch
    ])).join('\n');
}

exports.getFacilityLogs = async (req, res) => {
    try {
        const csv = await fetchBookingsCsv();
        const { result } = await runEngine('facility-tracking', ['list'], csv);
        res.json(result);
    } catch (err) {
        console.error('[facility:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to load facility bookings' });
    }
};

exports.addFacilityLog = async (req, res) => {
    const { residentName, doorNumber, facilityType, date, startTime, endTime } = req.body || {};
    if (!residentName || !doorNumber || !facilityType || !date || !startTime || !endTime) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    if (!isFacility(facilityType)) {
        return res.status(400).json({ status: 'error', message: 'Facility must be one of gym, pool, clubhouse, playground' });
    }
    if (!isValidIsoDate(date)) {
        return res.status(400).json({ status: 'error', message: 'Date must be a valid calendar date (YYYY-MM-DD)' });
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
        return res.status(400).json({ status: 'error', message: 'Start/end time must be in HH:MM (24-hour) format' });
    }

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid date/time' });
    }
    if (end.getTime() <= start.getTime()) {
        return res.status(400).json({ status: 'error', message: 'End time must be after start time' });
    }

    try {
        const csv = await fetchBookingsCsv();
        const { result } = await runEngine('facility-tracking', [
            'book', facilityType, doorNumber, residentName,
            String(Math.floor(start.getTime() / 1000)), String(Math.floor(end.getTime() / 1000))
        ], csv);

        if (result.status === 'success') {
            await pool.query(
                `INSERT INTO facility_bookings (facility_name, resident_door_number, resident_name, start_time, end_time)
                 VALUES ($1, $2, $3, $4, $5)`,
                [facilityType, doorNumber, residentName, start.toISOString(), end.toISOString()]
            );
        }
        res.json(result);
    } catch (err) {
        console.error('[facility:book]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to record booking' });
    }
};

exports.searchFacilityLogs = async (req, res) => {
    const { type, value } = req.query;
    if (!type || !value) {
        return res.status(400).json({ status: 'error', message: 'Both search type and value are required' });
    }
    try {
        const csv = await fetchBookingsCsv();
        const { result } = await runEngine('facility-tracking', ['search', type, value], csv);
        res.json(result);
    } catch (err) {
        console.error('[facility:search]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to search facility bookings' });
    }
};
