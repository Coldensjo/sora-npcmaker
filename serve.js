/*
 * serve.js — Tiny zero-dependency static server for the NPC maker.
 *
 * Opening index.html directly (file://) makes the browser block reading the
 * binary game files (CORS). Serving over http fixes that. Run with:
 *   node serve.js          (or double-click start.bat)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.json': 'application/json',
    '.dat': 'application/octet-stream',
    '.spr': 'application/octet-stream',
    '.otb': 'application/octet-stream'
};

const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // Resolve safely inside ROOT (block path traversal).
    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found: ' + urlPath);
            return;
        }
        var headers = {
            'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
        };
        // Avoid stale JS/CSS while developing — browsers cache aggressively otherwise.
        if (/\.(html|js|css)$/i.test(filePath)) {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        }
        res.writeHead(200, headers);
        res.end(data);
    });
});

server.listen(PORT, () => {
    const url = 'http://localhost:' + PORT + '/';
    console.log('Sorairei NPC Maker running at ' + url);
    console.log('Press Ctrl+C to stop.');
    // Best-effort: open the default browser (Windows / macOS / Linux).
    const opener = process.platform === 'win32' ? 'start ""' :
        process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(opener + ' ' + url);
});
