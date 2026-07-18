const { exec } = require('child_process');
const path = require('path');

exports.handleLogin = (req, res) => {
    const { username, password } = req.body;
    const loginProgram = path.join(__dirname, '../c-executables/login');
    const projectRoot = path.resolve(path.join(__dirname, '../../'));
    console.log(`[Login] __dirname=${__dirname}, projectRoot=${projectRoot}, loginProgram=${loginProgram}`);

    exec(`"${loginProgram}" "${username}" "${password}"`, { cwd: projectRoot },
        (error, stdout, stderr) => {
            console.log('C Program Output:', stdout); // Debug log
            
            // First check if we got any output at all
            if (!stdout || stdout.trim() === '') {
                return res.status(500).json({
                    status: "error",
                    message: "No response from authentication service"
                });
            }

            try {
                // Remove any debug output before the JSON
                const jsonStart = stdout.indexOf('{');
                const jsonString = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
                
                const result = JSON.parse(jsonString);
                res.json(result);
            } catch (e) {
                console.error('JSON Parse Error:', e.message);
                console.error('Raw Output:', stdout);
                res.status(500).json({
                    status: "error",
                    message: "Invalid server response format",
                    details: stdout
                });
            }
        });
};