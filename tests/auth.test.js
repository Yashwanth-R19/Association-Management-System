process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

const jwt = require('jsonwebtoken');
const { signToken, attachUser, COOKIE_NAME } = require('../server/middleware/auth');

function mockReqRes(cookieValue) {
    const req = { cookies: cookieValue ? { [COOKIE_NAME]: cookieValue } : {} };
    const res = {};
    const next = jest.fn();
    return { req, res, next };
}

describe('auth middleware', () => {
    test('signToken produces a JWT decodable with the configured secret', () => {
        const token = signToken({ id: 1, username: 'admin', role: 'admin' });
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        expect(payload.sub).toBe(1);
        expect(payload.username).toBe('admin');
        expect(payload.role).toBe('admin');
    });

    test('attachUser sets req.user for a valid cookie', () => {
        const token = signToken({ id: 2, username: 'secretary', role: 'secretary' });
        const { req, res, next } = mockReqRes(token);
        attachUser(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.username).toBe('secretary');
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('attachUser leaves req.user undefined when no cookie is present', () => {
        const { req, res, next } = mockReqRes(undefined);
        attachUser(req, res, next);
        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('attachUser leaves req.user undefined for a tampered/invalid token', () => {
        const { req, res, next } = mockReqRes('not-a-real-jwt');
        attachUser(req, res, next);
        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
    });
});
