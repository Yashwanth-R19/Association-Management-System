const { exec } = require('child_process');
const path = require('path');

const loginExe = path.join(__dirname, 'server', 'c-executables', 'login');
const username = 'admin';
const password = 'admin';

const cmd = `"${loginExe}" "${username}" "${password}"`;
console.log('Running:', cmd);
console.log('CWD:', __dirname);

exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    console.log('error:', error);
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
});
