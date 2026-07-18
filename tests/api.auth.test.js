// Full-stack auth test: requires a real Postgres reachable via DATABASE_URL
// with migrations already applied (CI does this before running tests). Skips
// gracefully in a local dev environment with no DB configured.
const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('API: /api/login (requires live Postgres)', () => {
    let request, app, pool, bcrypt;
    const username = `test_admin_${Date.now()}`;
    const password = 'correct horse battery staple';

    beforeAll(async () => {
        request = require('supertest');
        app = require('../server/app');
        pool = require('../server/db/pool');
        bcrypt = require('bcryptjs');

        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
            [username, hash, 'admin']
        );
    });

    afterAll(async () => {
        await pool.query('DELETE FROM users WHERE username = $1', [username]);
        await pool.end();
    });

    test('rejects a wrong password with 401', async () => {
        const res = await request(app).post('/api/login').send({ username, password: 'nope' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('accepts the right password, sets an httpOnly cookie, and logs the audit row', async () => {
        const res = await request(app).post('/api/login').send({ username, password });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.role).toBe('admin');
        expect(res.headers['set-cookie'].some(c => c.startsWith('amsat=') && c.includes('HttpOnly'))).toBe(true);

        const audit = await pool.query('SELECT * FROM login_audit WHERE username = $1', [username]);
        expect(audit.rows.length).toBeGreaterThan(0);
    });

    test('the cookie from login grants access to an authenticated API route', async () => {
        const loginRes = await request(app).post('/api/login').send({ username, password });
        const cookie = loginRes.headers['set-cookie'];

        const authed = await request(app).get('/api/check-auth').set('Cookie', cookie);
        expect(authed.body.authenticated).toBe(true);

        const unauthed = await request(app).get('/api/check-auth');
        expect(unauthed.body.authenticated).toBe(false);
    });
});
