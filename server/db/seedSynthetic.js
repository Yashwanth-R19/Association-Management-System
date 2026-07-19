// Populates a freshly-reset database (see reset.js) with coherent, realistic
// synthetic data across every module — residents across the 5 canonical
// blocks with valid door numbers/contacts, association members drawn from
// those residents, vendors with ratings, staff with check-in/out history,
// meetings, facility bookings, complaints, notices, and dues tied to real
// resident ids. Every row is shaped to satisfy server/lib/validators.js, the
// same rules the live API enforces. Safe to re-run against an empty (reset)
// database; not idempotent against a populated one — run `npm run db:reset`
// first.
const pool = require('./pool');

const BLOCKS = ['MAYFLOWER', 'TULIP', 'PRIMROSE', 'DAFFODIL', 'ORCHID'];
const FLOORS = [1, 2, 3, 4];
const UNITS = ['A', 'B'];

const RESIDENT_NAMES = [
    'Rajesh Kumar', 'Yashwanth R', 'Tejaswin S', 'Mohan Raj', 'Yasasvini P',
    'Ranjan Iyer', 'Rakhi Menon', 'Isha Sharma', 'Priya Nair', 'Arjun Reddy',
    'Kavya Krishnan', 'Vikram Rao', 'Ananya Pillai', 'Suresh Babu', 'Deepa Venkat',
    'Karthik Subramaniam', 'Meera Iyengar', 'Naveen Kumar', 'Lakshmi Narayan', 'Arun Prakash',
    'Divya Chandran', 'Ravi Shankar', 'Pooja Ramesh', 'Sanjay Gupta', 'Nithya Balaji',
    'Vijay Anand', 'Swathi Raghavan', 'Manoj Krishnan', 'Aishwarya Menon', 'Rahul Varma',
    'Sneha Kapoor', 'Gopal Krishnan', 'Anitha Suresh', 'Prasad Rao'
];

function contactFor(i) {
    return '9' + String(700000000 + i * 12345).slice(0, 9);
}

function emailFor(name) {
    return name.toLowerCase().replace(/\s+/g, '.') + '@example.com';
}

function allDoors() {
    const doors = [];
    for (const block of BLOCKS) {
        for (const floor of FLOORS) {
            for (const unit of UNITS) {
                doors.push({ block, floor, unit, door_number: `${block}-${floor}-${unit}` });
            }
        }
    }
    return doors;
}

async function seedResidents(client) {
    const doors = allDoors(); // 40 total
    const vacant = new Set([3, 9, 15, 22, 28, 35, 38]); // leave 7 vacant -> 33 occupied
    const occupied = doors.filter((_, i) => !vacant.has(i));

    const residents = [];
    for (let i = 0; i < occupied.length; i++) {
        const door = occupied[i];
        const name = RESIDENT_NAMES[i % RESIDENT_NAMES.length];
        const ownership = i % 3 === 0 ? 'TENANT' : 'OWNER';
        const parking = i % 2 === 0 ? `P-${i + 1}` : null;
        const { rows } = await client.query(
            `INSERT INTO residents (name, door_number, block, floor, contact, ownership_status, parking_slot)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, door_number`,
            [name, door.door_number, door.block, door.floor, contactFor(i), ownership, parking]
        );
        residents.push(rows[0]);
    }
    console.log(`residents: inserted ${residents.length}`);
    return residents;
}

async function seedAssociationMembers(client, residents) {
    const roster = [
        { role: 'President', pick: residents[0] },
        { role: 'Secretary', pick: residents[1] },
        { role: 'Treasurer', pick: residents[2] },
        { role: 'Committee Member', pick: residents[3] },
        { role: 'Committee Member', pick: residents[4] },
        { role: 'Committee Member', pick: residents[5] },
        { role: 'Resident', pick: residents[6] }
    ];

    for (const entry of roster) {
        await client.query(
            `INSERT INTO association_members (name, role, email, phone, door_number)
             VALUES ($1, $2, $3, $4, $5)`,
            [entry.pick.name, entry.role, emailFor(entry.pick.name), contactFor(residents.indexOf(entry.pick)), entry.pick.door_number]
        );
    }
    console.log(`association_members: inserted ${roster.length}`);
}

async function seedVendors(client) {
    const vendors = [
        { name: 'Suresh Pandian', work: 'Plumbing and pipe repairs', cost: 8000, start: '01/26', end: '12/26', ratings: [5, 4] },
        { name: 'Kavitha Elumalai', work: 'Electrical wiring and repairs', cost: 12000, start: '02/26', end: '01/27', ratings: [4, 4, 5] },
        { name: 'Bala Murugan', work: 'Garden and landscaping maintenance', cost: 6000, start: '01/26', end: '06/26', ratings: [3] },
        { name: 'Farida Khan', work: 'Full building deep cleaning', cost: 15000, start: '03/26', end: '03/27', ratings: [5, 5] },
        { name: 'Anand Vetrivel', work: 'Pest control treatment', cost: 4500, start: '04/26', end: '10/26', ratings: [] },
        { name: 'Meena Gopalakrishnan', work: 'Interior and exterior painting', cost: 45000, start: '05/26', end: '07/26', ratings: [4] },
        { name: 'Selvam Raj', work: 'Security guard services', cost: 25000, start: '01/26', end: '12/26', ratings: [4, 3, 4] },
        { name: 'Divakar Chelladurai', work: 'Elevator maintenance and servicing', cost: 18000, start: '01/26', end: '12/26', ratings: [] },
        { name: 'Kalaivani Shanmugam', work: 'Catering for events and functions', cost: 22000, start: '06/26', end: '08/26', ratings: [5] }
    ];

    for (const v of vendors) {
        const { rows } = await client.query(
            `INSERT INTO vendors (name, phone, email, work_description, cost, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [v.name, contactFor(RESIDENT_NAMES.length + vendors.indexOf(v)), emailFor(v.name), v.work, v.cost, v.start, v.end]
        );
        for (const rating of v.ratings) {
            await client.query(
                'INSERT INTO vendor_ratings (vendor_id, rating, note) VALUES ($1, $2, $3)',
                [rows[0].id, rating, 'Seeded review']
            );
        }
    }
    console.log(`vendors: inserted ${vendors.length}`);
}

async function seedStaff(client) {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const staff = [
        { name: 'Murugan', wage: 150, checkIn: now - 2 * day, checkOut: now - 2 * day + 8 * hour },
        { name: 'Selvi', wage: 120, checkIn: now - 3 * hour, checkOut: null },
        { name: 'Raman', wage: 130, checkIn: now - 5 * day, checkOut: now - 5 * day + 6 * hour },
        { name: 'Kamala', wage: 120, checkIn: now - day, checkOut: now - day + 7 * hour },
        { name: 'Elango', wage: 150, checkIn: now - 1 * hour, checkOut: null },
        { name: 'Valli', wage: 125, checkIn: now - 4 * day, checkOut: now - 4 * day + 8 * hour },
        { name: 'Murali', wage: 180, checkIn: now - 6 * day, checkOut: now - 6 * day + 5 * hour }
    ];

    for (const s of staff) {
        await client.query(
            `INSERT INTO staff (name, wage_per_hour, check_in_time, check_out_time)
             VALUES ($1, $2, $3, $4)`,
            [s.name, s.wage, new Date(s.checkIn).toISOString(), s.checkOut ? new Date(s.checkOut).toISOString() : null]
        );
    }
    console.log(`staff: inserted ${staff.length}`);
}

async function seedMeetings(client, residents) {
    const attendeesFrom = (indexes) => indexes.map(i => residents[i].name);
    const meetings = [
        { date: '2026-04-10', time: '18:00', title: 'Monthly Committee Meeting', agenda: 'Budget review and upcoming maintenance', location: 'Community Hall', attendees: attendeesFrom([0, 1, 2, 3]), outcome: 'Approved annual maintenance budget' },
        { date: '2026-05-15', time: '10:00', title: 'AGM - Annual General Meeting', agenda: 'Yearly financial report and committee elections', location: 'Community Hall', attendees: attendeesFrom([0, 1, 2, 3, 4, 5, 6]), outcome: 'Committee re-elected for another term' },
        { date: '2026-06-05', time: '17:30', title: 'Security Review Meeting', agenda: 'Discuss recent gate security concerns', location: "Secretary's Office", attendees: attendeesFrom([1, 6]), outcome: 'Approved additional CCTV coverage at the main gate' },
        { date: '2026-06-20', time: '18:30', title: 'Garden Renovation Discussion', agenda: 'Proposal for renovating the central garden', location: 'Community Hall', attendees: attendeesFrom([0, 3, 4]), outcome: 'Renovation approved, vendor to be finalized' },
        { date: '2026-07-10', time: '19:00', title: 'Festival Planning Committee', agenda: 'Plan for the upcoming Independence Day celebration', location: 'Community Hall', attendees: attendeesFrom([2, 5, 6]), outcome: 'Formed a 3-member festival committee' },
        { date: '2026-08-05', time: '18:00', title: 'Quarterly Budget Review', agenda: 'Review Q2 expenses and plan Q3 budget', location: 'Community Hall', attendees: [], outcome: null }
    ];

    for (const m of meetings) {
        await client.query(
            `INSERT INTO meetings (date, time, title, agenda, location, attendees, outcome)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [m.date, m.time, m.title, m.agenda, m.location, m.attendees, m.outcome]
        );
    }
    console.log(`meetings: inserted ${meetings.length}`);
}

async function seedFacilityBookings(client, residents) {
    const bookings = [
        { facility: 'gym', resident: residents[0], start: '2026-07-15T06:00:00Z', end: '2026-07-15T07:00:00Z' },
        { facility: 'gym', resident: residents[1], start: '2026-07-15T07:00:00Z', end: '2026-07-15T08:00:00Z' },
        { facility: 'pool', resident: residents[2], start: '2026-07-16T16:00:00Z', end: '2026-07-16T17:00:00Z' },
        { facility: 'clubhouse', resident: residents[3], start: '2026-07-20T18:00:00Z', end: '2026-07-20T21:00:00Z' },
        { facility: 'playground', resident: residents[4], start: '2026-07-18T16:00:00Z', end: '2026-07-18T17:00:00Z' },
        { facility: 'pool', resident: residents[5], start: '2026-07-22T09:00:00Z', end: '2026-07-22T10:00:00Z' },
        { facility: 'clubhouse', resident: residents[6], start: '2026-07-25T19:00:00Z', end: '2026-07-25T22:00:00Z' }
    ];

    for (const b of bookings) {
        await client.query(
            `INSERT INTO facility_bookings (facility_name, resident_door_number, resident_name, start_time, end_time)
             VALUES ($1, $2, $3, $4, $5)`,
            [b.facility, b.resident.door_number, b.resident.name, b.start, b.end]
        );
    }
    console.log(`facility_bookings: inserted ${bookings.length}`);
}

async function seedComplaints(client, residents) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const complaints = [
        { title: 'Water leakage in basement parking', description: 'Continuous seepage near slot P-4', priority: 'high', status: 'resolved', raisedBy: residents[7].door_number, assignedTo: 'Suresh Pandian', createdAt: now - 10 * day, resolvedAt: now - 8 * day },
        { title: 'Streetlight not working near Tulip block', description: 'Pole light has been off for a week', priority: 'normal', status: 'in_progress', raisedBy: residents[8].door_number, assignedTo: 'Kavitha Elumalai', createdAt: now - 4 * day, resolvedAt: null },
        { title: 'Request for additional dustbins', description: 'Need more bins near the playground', priority: 'low', status: 'open', raisedBy: residents[9].door_number, assignedTo: '', createdAt: now - 2 * day, resolvedAt: null },
        { title: 'Elevator making unusual noise', description: 'Grinding noise in Orchid block elevator', priority: 'high', status: 'in_progress', raisedBy: residents[10].door_number, assignedTo: 'Divakar Chelladurai', createdAt: now - 1 * day, resolvedAt: null },
        { title: 'Garbage collection delayed', description: 'Collection was two days late this week', priority: 'normal', status: 'resolved', raisedBy: residents[11].door_number, assignedTo: 'Farida Khan', createdAt: now - 15 * day, resolvedAt: now - 13 * day },
        { title: 'Parking slot dispute', description: 'Visitor repeatedly parking in an assigned slot', priority: 'low', status: 'open', raisedBy: residents[12].door_number, assignedTo: '', createdAt: now - 6 * 60 * 60 * 1000, resolvedAt: null }
    ];

    for (const c of complaints) {
        await client.query(
            `INSERT INTO complaints (title, description, priority, status, raised_by, assigned_to, created_at, resolved_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [c.title, c.description, c.priority, c.status, c.raisedBy, c.assignedTo, new Date(c.createdAt).toISOString(), c.resolvedAt ? new Date(c.resolvedAt).toISOString() : null]
        );
    }
    console.log(`complaints: inserted ${complaints.length}`);
}

async function seedNotices(client) {
    const { rows } = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    const createdBy = rows[0] ? rows[0].id : null;

    const notices = [
        { title: 'Water Supply Maintenance', body: 'Water supply will be interrupted on Sunday 8 AM - 12 PM for tank cleaning.', pinned: true },
        { title: 'Independence Day Celebration', body: 'Join us at the clubhouse for flag hoisting and cultural events.', pinned: false },
        { title: 'Annual General Meeting Schedule', body: 'The AGM will be held in the Community Hall; all residents are encouraged to attend.', pinned: true },
        { title: 'New Parking Rules', body: 'Visitor parking is now restricted to the designated area near the main gate.', pinned: false },
        { title: 'Festival Committee Formed', body: 'A 3-member committee has been formed to organize upcoming festival events.', pinned: false }
    ];

    for (const n of notices) {
        await client.query(
            'INSERT INTO notices (title, body, pinned, created_by) VALUES ($1, $2, $3, $4)',
            [n.title, n.body, n.pinned, createdBy]
        );
    }
    console.log(`notices: inserted ${notices.length}`);
}

async function seedDues(client, residents) {
    const periods = ['2026-05', '2026-06', '2026-07'];
    const amount = 2500.00;
    let count = 0;

    for (let i = 0; i < 20 && i < residents.length; i++) {
        for (const period of periods) {
            const status = (i + periods.indexOf(period)) % 4 === 0 ? 'UNPAID' : 'PAID';
            const { rows } = await client.query(
                `INSERT INTO maintenance_dues (resident_id, period, amount, status, paid_at)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [residents[i].id, period, amount, status, status === 'PAID' ? new Date().toISOString() : null]
            );
            if (rows[0]) count++;
        }
    }
    console.log(`maintenance_dues: inserted ${count}`);
}

async function seedSynthetic() {
    const client = await pool.connect();
    try {
        const residents = await seedResidents(client);
        await seedAssociationMembers(client, residents);
        await seedVendors(client);
        await seedStaff(client);
        await seedMeetings(client, residents);
        await seedFacilityBookings(client, residents);
        await seedComplaints(client, residents);
        await seedNotices(client);
        await seedDues(client, residents);
    } finally {
        client.release();
    }
}

// Seeds only when the residents table is empty, so it's safe to call on every boot
// (the synthetic rows have unique keys and would error on a second insert otherwise).
// Used by the optional SEED_ON_START auto-seed path in app.js.
async function seedIfEmpty() {
    const { rows } = await pool.query('SELECT 1 FROM residents LIMIT 1');
    if (rows.length > 0) {
        console.log('[seed] residents already present — skipping synthetic seed.');
        return;
    }
    await seedSynthetic();
}

module.exports = { seedSynthetic, seedIfEmpty };

// CLI entrypoint: `npm run seed` / `node server/db/seedSynthetic.js`.
if (require.main === module) {
    seedSynthetic()
        .then(() => pool.end())
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
