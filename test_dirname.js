const path = require('path');
const authControllerDir = __dirname; // When run from server/controllers would be server/controllers
console.log('__dirname from project root:', __dirname);
console.log('path.join(__dirname, "../.."):', path.join(__dirname, '../..'));
console.log('path.resolve(path.join(__dirname, "../..")):', path.resolve(path.join(__dirname, '../..')));

// What it should be
const projectRoot = __dirname.split('\\').slice(0, -1).join('\\'); // Go up one level from current dir
console.log('Project root (up 1 from script):', projectRoot);
