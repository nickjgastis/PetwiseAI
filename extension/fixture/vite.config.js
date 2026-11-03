import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const OTHER_ORIGIN_PORT = 4174;

// Serves frame-editor.html on a second port. The extension has no access to that origin, so a frame loaded from it
// must never show SmartPaste: it is the "permission denied" case.
const otherOriginServer = () => ({
    name: 'smartpaste-other-origin',
    configureServer(server) {
        const other = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fs.readFileSync(path.join(root, 'frame-editor.html'), 'utf8'));
        });
        other.on('error', (err) => server.config.logger.warn(`[fixture] port ${OTHER_ORIGIN_PORT} unavailable: ${err.message}`));
        other.listen(OTHER_ORIGIN_PORT, '127.0.0.1');
        server.httpServer?.on('close', () => other.close());
    },
});

export default defineConfig({
    root,
    plugins: [react(), otherOriginServer()],
    server: {
        allowedHosts: ['127.0.0.1', 'localhost'],
    },
});
