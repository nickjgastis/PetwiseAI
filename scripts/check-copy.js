// Fails the build if user-facing copy contains an em dash.
// Scans the marketing site, blog posts and app UI; skips code comments.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['src', 'server/utils/emailService.js', 'public/index.html', 'public/refresh.html', 'public/manifest.json'];
const SKIP = [/node_modules/, /posts\.generated\.js$/, /\.css$/];
const DASH = /\u2014/;

const files = [];
const walk = (p) => {
    const full = path.join(ROOT, p);
    if (!fs.existsSync(full) || SKIP.some((r) => r.test(full))) return;
    if (fs.statSync(full).isDirectory()) {
        for (const f of fs.readdirSync(full)) walk(path.join(p, f));
    } else if (/\.(js|jsx|md|html|json)$/.test(full)) {
        files.push(p);
    }
};
TARGETS.forEach(walk);

const stripComments = (line) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*') || t.startsWith('<!--')) return '';
    return line.replace(/\s\/\/\s.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '').replace(/\/\*.*?\*\//g, '');
};

const hits = [];
for (const file of files) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
        const text = file.endsWith('.md') ? line : stripComments(line);
        if (DASH.test(text)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
}

if (hits.length) {
    console.error(`[check-copy] ${hits.length} em dash${hits.length === 1 ? '' : 'es'} found in copy:\n${hits.join('\n')}`);
    process.exit(1);
}
console.log(`[check-copy] ${files.length} files clean`);
