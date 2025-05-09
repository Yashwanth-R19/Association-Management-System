const { exec } = require('child_process');
const path = require('path');

exports.handleLogin = (req, res) => {
    const { username, password } = req.body;
    const loginProgram = path.join(__dirname, '../c-executables/login');
    
    // Execute C program with sanitized inputs
    exec(`"${loginProgram}" "${escapeShellArg(username)}" "${escapeShellArg(password)}"`, 
        (error, stdout, stderr) => {
            if (error) {
                return res.status(401).json({ 
                    status: "error",
                    message: "Authentication failed" 
                });
            }
            
            try {
                const result = JSON.parse(stdout);
                res.json(result);
            } catch (e) {
                res.status(500).json({
                    status: "error",
                    message: "Invalid server response"
                });
            }
        });
};

// Helper to prevent command injection
function escapeShellArg(arg) {
    return arg.replace(/'/g, "'\\''")
              .replace(/"/g, '\\"');
}
const csvBasePath = path.join(__dirname, 'data');

// For C programs to access
process.env.USERS_CSV_PATH = path.join(csvBasePath, 'users.csv'); 