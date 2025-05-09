const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const facilityExe = path.join(__dirname, '../../Backend/facility-tracking.c');
const compiledExe = path.join(__dirname, '../../server/c-executables/facility-tracking');
const csvFile = path.join(__dirname, '../../server/data/usage_logs.csv');

// Ensure CSV file exists
if (!fs.existsSync(csvFile)) {
    fs.writeFileSync(csvFile, 'ResidentID,ResidentName,Date,Time,Facility,Duration\n');
}

// Compile the C program
function compileProgram() {
    return new Promise((resolve, reject) => {
        exec(`gcc "${facilityExe}" -o "${compiledExe}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Compilation error:', stderr);
                return reject(new Error('Failed to compile facility tracking program'));
            }
            resolve();
        });
    });
}

// Execute the C program
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(`"${compiledExe}" ${command}`, (error, stdout, stderr) => {
            if (error) {
                console.error('Execution error:', stderr);
                return reject(new Error('Failed to execute facility tracking'));
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                console.error('JSON parse error:', e);
                reject(new Error('Invalid response from facility tracking'));
            }
        });
    });
}

exports.getFacilityLogs = async (req, res) => {
    try {
        await compileProgram();
        const result = await executeCommand('get');
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
};

exports.addFacilityLog = async (req, res) => {
    try {
        const { residentName, doorNumber, facilityType, date, startTime, endTime } = req.body;
        
        // Calculate duration in minutes
        let duration = 0;
        if (startTime && endTime) {
            const start = new Date(`1970-01-01T${startTime}:00`);
            const end = new Date(`1970-01-01T${endTime}:00`);
            duration = Math.round((end - start) / 60000); // ms to minutes
        }

        await compileProgram();
        const command = `add "${doorNumber}" "${residentName}" "${facilityType}" "${date}" "${startTime}" ${duration}`;
        const result = await executeCommand(command);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
};
exports.searchFacilityLogs = async (req, res) => {
    try {
        const { type, value } = req.query;
        
        if (!type || !value) {
            throw new Error('Both search type and value are required');
        }

        await compileProgram();
        const command = `search "${type}" "${value}"`;
        const result = await executeCommand(command);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
};
