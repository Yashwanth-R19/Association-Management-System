const { exec } = require('child_process');
const path = require('path');

const MEETINGS_EXE = path.join(__dirname, '../c-executables/meetings');

function executeMeetingsCommand(args) {
    return new Promise((resolve, reject) => {
        const command = `"${MEETINGS_EXE}" ${args.map(arg => `"${arg}"`).join(' ')}`;
        
        exec(command, { cwd: path.join(__dirname, '../') }, (error, stdout, stderr) => {
            if (error) {
                console.error('Execution error:', error);
                console.error('Stderr:', stderr);
                reject(new Error('Command execution failed'));
                return;
            }

            try {
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
                reject(new Error('Invalid JSON response'));
            }
        });
    });
}

exports.listMeetings = async (req, res) => {
    try {
        const result = await executeMeetingsCommand(['list']);
        res.json(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: error.message 
        });
    }
};

exports.addMeeting = async (req, res) => {
    const { date, time, title, agenda, location, attendees, outcome } = req.body;
    
    try {
        const result = await executeMeetingsCommand([
            'add',
            date,
            time,
            title,
            agenda,
            location,
            attendees,
            outcome || ''
        ]);
        
        res.json(result);
    } catch (error) {
        res.status(400).json({ 
            status: 'error',
            message: error.message 
        });
    }
};

exports.deleteMeeting = async (req, res) => {
    try {
        const result = await executeMeetingsCommand([
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

exports.searchMeetings = async (req, res) => {
    const { type, query } = req.params;
    
    try {
        const result = await executeMeetingsCommand([
            'search', 
            type, 
            query
        ]);
        
        res.json(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
        res.status(400).json({ 
            status: 'error',
            message: error.message 
        });
    }
};