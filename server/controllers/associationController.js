const { exec } = require('child_process');
const path = require('path');

const ASSOCIATION_EXE = path.join(__dirname, '../c-executables/association');

function executeAssociationCommand(args) {
    return new Promise((resolve, reject) => {
        const command = `"${ASSOCIATION_EXE}" ${args.join(' ')}`;
        
        exec(command, { cwd: path.join(__dirname, '../') }, (error, stdout, stderr) => {
            if (error) {
                console.error('Execution error:', error);
                console.error('Stderr:', stderr);
                reject(new Error('Command execution failed'));
                return;
            }

            try {
                // Get the last line of output (in case there are multiple)
                const outputLines = stdout.toString().trim().split('\n');
                const lastLine = outputLines[outputLines.length - 1];
                
                if (!lastLine) {
                    reject(new Error('Empty response from command'));
                    return;
                }

                const result = JSON.parse(lastLine);
                resolve(result);
            } catch (e) {
                console.error('Parse error:', e);
                console.error('Raw output:', stdout);
                reject(new Error('Invalid JSON response: ' + stdout));
            }
        });
    });
}

exports.listMembers = async (req, res) => {
    try {
        const result = await executeAssociationCommand(['list']);
        res.json(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: error.message 
        });
    }
};

exports.addMember = async (req, res) => {
    const { id, name, role, email, phone, houseNumber } = req.body;
    
    try {
        const result = await executeAssociationCommand([
            'add',
            id,
            `"${name.replace(/"/g, '\\"')}"`,
            `"${role.replace(/"/g, '\\"')}"`,
            `"${email.replace(/"/g, '\\"')}"`,
            `"${phone.replace(/"/g, '\\"')}"`,
            `"${houseNumber.replace(/"/g, '\\"')}"`
        ]);
        
        res.json(result);
    } catch (error) {
        res.status(400).json({ 
            status: 'error',
            message: error.message 
        });
    }
};

exports.deleteMember = async (req, res) => {
    try {
        const result = await executeAssociationCommand([
            'delete', 
            req.params.id
        ]);
        
        res.json(result);
    } catch (error) {
        res.status(400).json({ 
            status: 'error',
            message: error.message 
        });
    }
};

exports.searchMembers = async (req, res) => {
    const { type, query } = req.params;
    
    try {
        const result = await executeAssociationCommand([
            'search', 
            type, 
            `"${query.replace(/"/g, '\\"')}"`
        ]);
        
        res.json(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
        res.status(400).json({ 
            status: 'error',
            message: error.message 
        });
    }
};