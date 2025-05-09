const { exec } = require('child_process');
const path = require('path');

const RESIDENTS_EXE = path.join(__dirname, '../../Backend/auth/residents.exe');

// Get all residents
exports.getAllResidents = (req, res) => {
    exec(`"${RESIDENTS_EXE}" list`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: "Failed to get residents" });
        }
        try {
            const residents = JSON.parse(stdout);
            res.json(residents);
        } catch (e) {
            res.status(500).json({ error: "Invalid response from residents service" });
        }
    });
};

// Add new resident
exports.addResident = (req, res) => {
    const { name, block, floor, doorAlpha, contact, ownership, parking, maintenance } = req.body;
    
    const cmd = `"${RESIDENTS_EXE}" add "${name}" "${block}" ${floor} "${doorAlpha}" "${contact}" "${ownership}" "${parking}" "${maintenance}"`;
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            return res.status(400).json({ error: "Failed to add resident" });
        }
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: "Invalid response from residents service" });
        }
    });
};

// Delete resident
exports.deleteResident = (req, res) => {
    const { doorNumber } = req.params;
    
    exec(`"${RESIDENTS_EXE}" delete "${doorNumber}"`, (error, stdout, stderr) => {
        if (error) {
            return res.status(400).json({ error: "Failed to delete resident" });
        }
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: "Invalid response from residents service" });
        }
    });
};

// Search residents
exports.searchResidents = (req, res) => {
    const { type, query } = req.params;
    
    let cmd;
    if (type === 'unpaid') {
        cmd = `"${RESIDENTS_EXE}" search unpaid`;
    } else {
        cmd = `"${RESIDENTS_EXE}" search ${type} "${query}"`;
    }
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            return res.status(400).json({ error: "Search failed" });
        }
        try {
            const results = JSON.parse(stdout);
            res.json(results);
        } catch (e) {
            res.status(500).json({ error: "Invalid search response" });
        }
    });
};