// Full-stack residents test: exercises the entire C<->Postgres bridge
// (Node fetches rows -> residents.exe builds its BST and runs the command ->
// Node resyncs the result back into Postgres) through the real HTTP API.
// Requires a live Postgres via DATABASE_URL with migrations applied, and the
// compiled residents engine (`npm run build:c`). Skips gracefully otherwise.
const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('API: /api/residents (requires live Postgres + compiled residents engine)', () => {
    let request, app, pool, cookie;
    // Block/floor/door-alpha must match the canonical shapes enforced by
    // server/lib/validators.js: block from the known 5, floor 1-7, a single
    // letter for the door alpha.
    const floor = (Date.now() % 7) + 1;
    const doorAlpha = String.fromCharCode(65 + (Date.now() % 26));
    const doorNumber = `ORCHID-${floor}-${doorAlpha}`;
    const username = `test_res_${Date.now()}`;

    beforeAll(async () => {
        request = require('supertest');
        app = require('../server/app');
        pool = require('../server/db/pool');
        const bcrypt = require('bcryptjs');

        // Every /api/residents route sits behind the auth gate in app.js, so
        // an unauthenticated request gets a 302 redirect, not a JSON body —
        // log in first and carry the cookie on every request below.
        const hash = await bcrypt.hash('irrelevant-password', 10);
        await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, hash, 'admin']);
        const loginRes = await request(app).post('/api/login').send({ username, password: 'irrelevant-password' });
        cookie = loginRes.headers['set-cookie'];
    });

    afterAll(async () => {
        await pool.query('DELETE FROM residents WHERE door_number = $1', [doorNumber]);
        await pool.query('DELETE FROM users WHERE username = $1', [username]);
        await pool.end();
    });

    test('add -> list -> delete round-trips through the DS engine and Postgres', async () => {
        const addRes = await request(app).post('/api/residents').set('Cookie', cookie).send({
            name: 'Test Resident',
            block: 'ORCHID',
            floor,
            doorAlpha,
            contact: '9999999999',
            ownership: 'OWNER',
            parking: 'NONE'
        });
        expect(addRes.body.status).toBe('success');

        const listRes = await request(app).get('/api/residents').set('Cookie', cookie);
        expect(listRes.body.some(r => r.door_number === doorNumber)).toBe(true);

        const deleteRes = await request(app).delete(`/api/residents/${doorNumber}`).set('Cookie', cookie);
        expect(deleteRes.body.status).toBe('success');

        const listAfterDelete = await request(app).get('/api/residents').set('Cookie', cookie);
        expect(listAfterDelete.body.some(r => r.door_number === doorNumber)).toBe(false);
    });

    test('adding a duplicate door number is rejected', async () => {
        const payload = {
            name: 'First',
            block: 'ORCHID',
            floor,
            doorAlpha,
            contact: '9999999999',
            ownership: 'OWNER',
            parking: 'NONE'
        };
        await request(app).post('/api/residents').set('Cookie', cookie).send(payload);
        const dupRes = await request(app).post('/api/residents').set('Cookie', cookie).send({ ...payload, name: 'Second' });
        expect(dupRes.body.status).toBe('error');

        await request(app).delete(`/api/residents/${doorNumber}`).set('Cookie', cookie);
    });
});
