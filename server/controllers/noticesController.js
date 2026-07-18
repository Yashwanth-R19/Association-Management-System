// Notices/announcements: a date-ordered feed. Deliberately plain Postgres
// CRUD — no C compute engine here, since there's no meaningful data
// structure operation to perform (forcing a BST/heap onto "list these in
// order, newest/pinned first" would be artificial complexity for no gain).
const pool = require('../db/pool');

exports.listNotices = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT n.id, n.title, n.body, n.pinned, n.created_at, u.username AS created_by
             FROM notices n LEFT JOIN users u ON u.id = n.created_by
             ORDER BY n.pinned DESC, n.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('[notices:list]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to list notices' });
    }
};

exports.addNotice = async (req, res) => {
    const { title, body, pinned } = req.body || {};
    if (!title || !body) {
        return res.status(400).json({ status: 'error', message: 'Title and body are required' });
    }
    try {
        await pool.query(
            'INSERT INTO notices (title, body, pinned, created_by) VALUES ($1, $2, $3, $4)',
            [title, body, !!pinned, req.user ? req.user.sub : null]
        );
        res.json({ status: 'success', message: 'Notice posted' });
    } catch (err) {
        console.error('[notices:add]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to post notice' });
    }
};

exports.deleteNotice = async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM notices WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ status: 'error', message: 'Notice not found' });
        res.json({ status: 'success', message: 'Notice deleted' });
    } catch (err) {
        console.error('[notices:delete]', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to delete notice' });
    }
};
