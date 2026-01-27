const fs = require('fs');
const path = require('path');

const versionPath = path.join(__dirname, '..', 'public', 'version.json');
const version = Date.now().toString();

fs.writeFileSync(versionPath, JSON.stringify({ version }, null, 2) + '\n');

console.log(`[Version] Updated to ${version}`);
