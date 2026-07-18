// Compiles every DS compute-engine module in Backend/*.c into
// server/c-executables/. Run via `npm run build:c` (also the first stage of
// the Docker build and the CI workflow). Backend/logout.c and
// Backend/auth/login.c are intentionally excluded — auth is handled entirely
// in Node now (bcrypt + JWT), not shelled out to a C process.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '../Backend');
const OUT_DIR = path.join(__dirname, '../server/c-executables');

const MODULES = ['residents', 'association', 'vendorsds', 'staff', 'facility-tracking', 'meetings', 'complaints'];

// vendorsds.c -> vendor(.exe): matches the binary name every controller expects.
const OUTPUT_NAME = { vendorsds: 'vendor' };

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let built = 0;
for (const mod of MODULES) {
    const src = path.join(BACKEND_DIR, `${mod}.c`);
    if (!fs.existsSync(src)) {
        console.log(`skip ${mod}.c (not present yet)`);
        continue;
    }

    const outBase = OUTPUT_NAME[mod] || mod;
    const outFile = path.join(OUT_DIR, process.platform === 'win32' ? `${outBase}.exe` : outBase);

    console.log(`compiling ${mod}.c -> ${path.relative(process.cwd(), outFile)}`);
    execFileSync('gcc', ['-O2', '-o', outFile, src], { stdio: 'inherit' });
    built++;
}

console.log(`Built ${built} executable(s).`);
