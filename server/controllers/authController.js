const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

exports.handleLogin = async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const token = signToken(user);
        setAuthCookie(res, token);
        await pool.query('INSERT INTO login_audit (username) VALUES ($1)', [user.username]);

        res.json({
            success: true,
            username: user.username,
            role: user.role,
            redirect: '/home.html'
        });
    } catch (err) {
        console.error('[login] error:', err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.handleSignup = async (req, res) => {
    const { username, password, role } = req.body || {};

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Username, password and role are required' });
    }
    const trimmedUsername = String(username).trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
        return res.status(400).json({ success: false, message: 'Username must be between 3 and 30 characters' });
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(trimmedUsername)) {
        return res.status(400).json({ success: false, message: 'Username may only contain letters, numbers, and . _ -' });
    }
    if (String(password).length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (!['admin', 'secretary'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Role must be admin or secretary' });
    }

    try {
        const existing = await pool.query('SELECT 1 FROM users WHERE username = $1', [trimmedUsername]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'That username is already taken' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [trimmedUsername, passwordHash, role]
        );
        const user = rows[0];

        // Sign the account straight in so the user lands in the app, not back on the login form.
        const token = signToken(user);
        setAuthCookie(res, token);
        await pool.query('INSERT INTO login_audit (username) VALUES ($1)', [user.username]);

        res.status(201).json({
            success: true,
            username: user.username,
            role: user.role,
            redirect: '/home.html'
        });
    } catch (err) {
        // Unique-violation safety net in case of a race between the check and the insert.
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: 'That username is already taken' });
        }
        console.error('[signup] error:', err);
        res.status(500).json({ success: false, message: 'Signup failed' });
    }
};

exports.handleLogout = (req, res) => {
    clearAuthCookie(res);
    res.json({ success: true, redirect: '/login.html' });
};

exports.getProfile = async (req, res) => {
    if (!req.user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    try {
        const { rows } = await pool.query('SELECT username, role, created_at FROM users WHERE id = $1', [req.user.sub]);
        if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const { rows: loginRows } = await pool.query(
            'SELECT logged_in_at FROM login_audit WHERE username = $1 ORDER BY logged_in_at DESC LIMIT 1',
            [rows[0].username]
        );

        res.json({
            username: rows[0].username,
            role: rows[0].role,
            createdAt: rows[0].created_at,
            lastLogin: loginRows[0] ? loginRows[0].logged_in_at : null
        });
    } catch (err) {
        console.error('[profile:get]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to load profile' });
    }
};

exports.changePassword = async (req, res) => {
    if (!req.user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ status: 'error', message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters' });
    }
    try {
        const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.sub]);
        if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });

        const matches = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!matches) return res.status(401).json({ status: 'error', message: 'Current password is incorrect' });

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.sub]);
        res.json({ status: 'success', message: 'Password updated' });
    } catch (err) {
        console.error('[profile:changePassword]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to update password' });
    }
};
