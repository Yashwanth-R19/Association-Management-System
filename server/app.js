const express = require('express');
const session = require('express-session');
const path = require('path');
const { exec } = require('child_process');
const app = express();

// Import routes
const residentsRoutes = require('./routes/residents');
const apiRoutes = require('./routes/api');
const associationRoutes = require('./routes/association');
const meetingsRoutes = require('./routes/meetings');
const facilityRoutes = require('./routes/facility');
const staffRoutes = require('./routes/staff');

// Session configuration
app.use(session({
    secret: 'ceebros-gardens-secret-key-2023',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    if (req.path.includes('login')) {
        require('fs').appendFileSync('debug.log', `[middleware] ${req.method} ${req.path}\n`);
    }
    next();
});
app.use(express.static(path.join(__dirname, '../Frontend')));
app.use('/api/association', associationRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/facilities', require('./routes/facility'));
app.use('/api/staff', require('./routes/staff'));

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

    if (!req.session.user) {
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
        authenticated: !!req.session.user,
        user: req.session.user || null
    });
});

// Logout endpoint
app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, redirect: '/login.html' });
    });
});

// API Routes
app.use('/api', apiRoutes);
app.use('/api/residents', residentsRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the site at: http://localhost:${PORT}`);
});
