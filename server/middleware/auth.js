const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'amsat';
const TOKEN_TTL = '12h';

function getSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
    }
    return process.env.JWT_SECRET;
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        getSecret(),
        { expiresIn: TOKEN_TTL }
    );
}

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000
    });
}

function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME);
}

// Never blocks the request — just attaches req.user (or leaves it undefined)
// so route-level logic decides what to do with an absent/invalid token.
function attachUser(req, res, next) {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (token) {
        try {
            req.user = jwt.verify(token, getSecret());
        } catch (err) {
            req.user = undefined;
        }
    }
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

module.exports = { COOKIE_NAME, signToken, setAuthCookie, clearAuthCookie, attachUser, requireRole };
