const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

const RESIDENTS_EXE = path.join(__dirname, '../c-executables/residents');

function executeResidentsCommand(args, res) {
    exec(`"${RESIDENTS_EXE}" ${args.join(' ')}`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Operation failed' 
            });
        }
        
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (e) {
            res.status(500).json({ 
                status: 'error', 
                message: 'Invalid response format' 
            });
        }
    });
}

// GET all residents
router.get('/', (req, res) => {
    executeResidentsCommand(['list'], res);
});

// POST - Add new resident
router.post('/', (req, res) => {
    const { name, block, floor, doorAlpha, contact, ownership, parking, maintenance } = req.body;
    
    const args = [
        'add',
        `"${name}"`,
        `"${block}"`,
        floor,
        `"${doorAlpha}"`,
        `"${contact}"`,
        `"${ownership}"`,
        `"${parking || 'NONE'}"`,
        `"${maintenance}"`
    ];
    
    executeResidentsCommand(args, res);
});

// DELETE - Remove resident
router.delete('/:doorNumber', (req, res) => {
    executeResidentsCommand(['delete', `"${req.params.doorNumber}"`], res);
});

// Search routes
const searchRoutes = [
    'door', 'phone', 'name', 'unpaid', 'block', 'floor'
];

searchRoutes.forEach(type => {
    const route = type === 'unpaid' ? '/search/unpaid' : `/search/${type}/:query`;
    router.get(route, (req, res) => {
        const args = ['search', type];
        if (type !== 'unpaid') args.push(`"${req.params.query}"`);
        executeResidentsCommand(args, res);
    });
});

module.exports = router;