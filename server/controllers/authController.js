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
