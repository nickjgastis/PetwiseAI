// Serves build/ the way production will: real files first, then <path>/index.html
// for prerendered pages, then a SPA fallback. The default fallback is the
// prerendered index.html, matching Vercel's CRA preset with no vercel.json.
// FALLBACK=shell uses build/app-shell.html instead.

const http = require('http');
const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '../build');
const PORT = Number(process.env.PORT) || 4000;
const FALLBACK = path.join(BUILD, process.env.FALLBACK === 'shell' ? 'app-shell.html' : 'index.html');

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webmanifest': 'application/manifest+json'
};

const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();

const resolve = (urlPath) => {
    const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
    const direct = path.join(BUILD, clean);
    if (isFile(direct)) return direct;
    const index = path.join(direct, 'index.html');
    if (isFile(index)) return index;
    return FALLBACK;
};

http.createServer((req, res) => {
    const file = resolve(req.url.split('?')[0]);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`[preview] http://localhost:${PORT}`));
