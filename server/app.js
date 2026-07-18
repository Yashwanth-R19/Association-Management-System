require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const { attachUser } = require('./middleware/auth');

// Import routes
const residentsRoutes = require('./routes/residents');
const apiRoutes = require('./routes/api');
const associationRoutes = require('./routes/association');
const meetingsRoutes = require('./routes/meetings');
const facilityRoutes = require('./routes/facility');
const staffRoutes = require('./routes/staff');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);
app.use(express.static(path.join(__dirname, '../Frontend')));
app.use('/api/association', associationRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/facilities', require('./routes/facility'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/vendors', require('./routes/vendor'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/dues', require('./routes/dues'));

// Public paths
const publicPaths = [
    '/',
    '/login.html',
    '/api/login',
    '/api/check-auth',
    '/css/styles.css',
    '/js/login.js'
];

// Authentication middleware
app.use((req, res, next) => {
    if (publicPaths.includes(req.path) || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/css/')) {
        return next();
    }

    if (!req.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login.html');
    }
    next();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/login.html'));
});


// Auth check endpoint
app.get('/api/check-auth', (req, res) => {
    res.json({
        authenticated: !!req.user,
        user: req.user ? { username: req.user.username, role: req.user.role } : null
    });
});

// Logout endpoint
app.get('/api/logout', require('./controllers/authController').handleLogout);

// Profile endpoints
app.get('/api/profile', require('./controllers/authController').getProfile);
app.post('/api/profile/password', require('./controllers/authController').changePassword);

// API Routes
app.use('/api', apiRoutes);
app.use('/api/residents', residentsRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Server Error');
});

// Only bind a port when this file is run directly (`node server/app.js`) —
// requiring it as a module (e.g. from supertest in tests) just gets the app.
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Access the site at: http://localhost:${PORT}`);
    });
}

module.exports = app;
