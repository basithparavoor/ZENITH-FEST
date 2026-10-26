const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

// Create www folder if not exists
if (!fs.existsSync(wwwDir)) {
    fs.mkdirSync(wwwDir, { recursive: true });
}

// Files & extensions to copy (exclude .apk from www assets to prevent recursive packaging)
const allowedExtensions = ['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.mp3', '.ogg', '.ttf', '.woff', '.woff2'];
const ignoreList = ['node_modules', 'android', 'ios', 'www', 'scripts', 'electron', 'dist', '.git', '.vscode', '.gemini', 'package.json', 'package-lock.json', 'capacitor.config.json', 'capacitor.config.ts', 'festos-app.apk', 'VIBRANIUM.apk'];

function copyRecursive(srcDir, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const items = fs.readdirSync(srcDir);

    for (const item of items) {
        if (ignoreList.includes(item)) continue;
        if (item.endsWith('.apk')) continue;

        const srcPath = path.join(srcDir, item);
        const destPath = path.join(destDir, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (allowedExtensions.includes(ext) || item.startsWith('.')) {
                // Read and write explicitly to ensure clean, regular files without OneDrive lock flags
                const buffer = fs.readFileSync(srcPath);
                fs.writeFileSync(destPath, buffer);
            }
        }
    }
}

console.log('🔄 Preparing www assets for Capacitor Mobile App...');
copyRecursive(rootDir, wwwDir);
console.log('✅ www directory prepared successfully with all festival web assets!');
