// The C <-> Postgres bridge. Every DS-backed module's C program is invoked
// through here: current rows go in on stdin as CSV, the command/args go in
// as a real argv array (never shell-interpolated — this is what kills the
// command-injection issue), and the program prints one JSON object,
// {"result": ..., "state": [...]}, on stdout.
const { execFile } = require('child_process');
const path = require('path');

const EXE_DIR = path.join(__dirname, '../c-executables');

function exePath(name) {
    return path.join(EXE_DIR, process.platform === 'win32' ? `${name}.exe` : name);
}

// csvInput: string already serialized to the exact CSV shape the C program parses.
function runEngine(name, args, csvInput) {
    return new Promise((resolve, reject) => {
        const child = execFile(
            exePath(name),
            args,
            { maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(`${name} ${args[0] || ''} failed: ${stderr || error.message}`));
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error(`${name} returned invalid JSON: ${stdout.slice(0, 500)}`));
                }
            }
        );
        child.stdin.write(csvInput || '');
        child.stdin.end();
    });
}

module.exports = { runEngine };
