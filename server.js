const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3050;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.apk': 'application/vnd.android.package-archive'
};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch (e) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === '/') {
        pathname = '/index.html';
    }

    // Direct APK download route
    const lowerPath = pathname.toLowerCase();
    if (lowerPath === '/download-apk' || lowerPath === '/vibranium.apk' || lowerPath === '/festos-app.apk') {
        const candidateApks = [
            path.join(ROOT_DIR, 'VIBRANIUM.apk'),
            path.join(ROOT_DIR, 'dist', 'VIBRANIUM.apk'),
            path.join(ROOT_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'VIBRANIUM.apk'),
            path.join(ROOT_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
            path.join(ROOT_DIR, 'festos-app.apk')
        ];
        const apkFile = candidateApks.find(p => fs.existsSync(p));
        if (apkFile) {
            const stat = fs.statSync(apkFile);
            res.writeHead(200, {
                'Content-Type': 'application/vnd.android.package-archive',
                'Content-Disposition': 'attachment; filename="VIBRANIUM.apk"',
                'Content-Length': stat.size
            });
            fs.createReadStream(apkFile).pipe(res);
            return;
        }
    }

    // Direct Desktop Application zip download route
    if (lowerPath === '/download-desktop' || lowerPath === '/festos-desktop.zip' || lowerPath === '/festos-desktop-windows.zip') {
        const desktopZip = path.join(ROOT_DIR, 'dist-desktop', 'FestOS-Desktop-Windows.zip');
        if (fs.existsSync(desktopZip)) {
            const stat = fs.statSync(desktopZip);
            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="FestOS-Desktop-Windows.zip"',
                'Content-Length': stat.size
            });
            fs.createReadStream(desktopZip).pipe(res);
            return;
        }
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Check if adding .html works
            if (!path.extname(filePath)) {
                const htmlPath = filePath + '.html';
                if (fs.existsSync(htmlPath)) {
                    filePath = htmlPath;
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(`404 Not Found: ${pathname}`);
                    return;
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`404 Not Found: ${pathname}`);
                return;
            }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // Disable caching so development changes appear immediately
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', (streamErr) => {
            console.error('Stream error:', streamErr);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end('Server Error');
            }
        });
        stream.pipe(res);
    });
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

server.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    let networkIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                networkIp = iface.address;
                break;
            }
        }
    }

    console.log(`\n======================================================`);
    console.log(`🚀 ZENITH FEST (FestOS) Server is LIVE on Port ${PORT}`);
    console.log(`📡 Localhost:     http://localhost:${PORT}`);
    console.log(`📡 Network (LAN): http://${networkIp}:${PORT}`);
    console.log(`📱 Mobile/Tab:    http://${networkIp}:${PORT}/index.html`);
    console.log(`🛡️ Admin Portal:  http://localhost:${PORT}/admin.html`);
    console.log(`👥 Team Manager:  http://localhost:${PORT}/team-manager.html`);
    console.log(`🖥️ Live Screen:   http://localhost:${PORT}/screen.html`);
    console.log(`======================================================\n`);
});
