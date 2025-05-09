const { exec } = require('child_process');
const path = require('path');

function handleStaffRequest(req, res) {
  const command = req.body.command;
  const args = req.body.args || [];
  
  // Path to your compiled staff executable
  const staffExecutable = path.join(__dirname, 'c-executables', 'staff');
  
  // Construct the command array
  const fullCommand = [staffExecutable, command, ...args].map(arg => 
    arg.includes(' ') ? `"${arg}"` : arg
  ).join(' ');
  
  exec(fullCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing staff command: ${error}`);
      return res.status(500).json({ status: 'error', message: 'Command execution failed' });
    }
    
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'Invalid response from staff service' });
    }
  });
}

module.exports = handleStaffRequest;