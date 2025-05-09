const { exec } = require('child_process');
const path = require('path');

const STAFF_EXE = path.join(__dirname, '../../Backend/staff');

function executeCommand(args, res) {
    const cmd = `"${STAFF_EXE}" ${args.join(' ')}`;
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Operation failed',
                details: stderr 
            });
        }
        
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (e) {
            res.status(500).json({ 
                status: 'error', 
                message: 'Invalid response format',
                details: stdout 
            });
        }
    });
}

exports.getAllStaff = (req, res) => {
    executeCommand(['list'], res);
};

exports.addStaff = (req, res) => {
    const { staffName, wagePerHour } = req.body;
    if (!staffName || !wagePerHour) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Name and wage are required' 
        });
    }
    executeCommand(['add', staffName, wagePerHour], res);
};

exports.checkOutStaff = (req, res) => {
    const { staffName } = req.body;
    if (!staffName) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Name is required' 
        });
    }
    executeCommand(['checkout', staffName], res);
};

exports.deleteStaff = (req, res) => {
    const { staffName } = req.params;
    if (!staffName) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Name is required' 
        });
    }
    executeCommand(['delete', staffName], res);
};

exports.searchStaff = (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Search query is required' 
        });
    }
    executeCommand(['search', name], res);
};