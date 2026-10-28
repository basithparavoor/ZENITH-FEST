const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ELECTRON_DIST = path.join(ROOT_DIR, 'node_modules', 'electron', 'dist');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist-desktop', 'FestOS-win32-x64');
const APP_DEST = path.join(OUTPUT_DIR, 'resources', 'app');

console.log('🚀 Packaging FestOS Windows Desktop Standalone Application...');

if (!fs.existsSync(ELECTRON_DIST)) {
    console.error('❌ Electron dist binary not found in node_modules/electron/dist');
    process.exit(1);
}

// 1. Clean output directory
if (fs.existsSync(OUTPUT_DIR)) {
    console.log('🧹 Cleaning old build directory...');
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 2. Copy Electron distribution files
console.log('📦 Copying Electron runtime binary...');
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copy dist contents
fs.readdirSync(ELECTRON_DIST).forEach(item => {
    const srcPath = path.join(ELECTRON_DIST, item);
    const destPath = path.join(OUTPUT_DIR, item === 'electron.exe' ? 'FestOS.exe' : item);
    copyRecursiveSync(srcPath, destPath);
});
console.log('✅ Electron runtime copied and renamed to FestOS.exe');

// 3. Create resources/app
fs.mkdirSync(APP_DEST, { recursive: true });

// 4. Copy project files to resources/app
console.log('📁 Bundling FestOS festival application files...');
const filesAndDirsToCopy = [
    'package.json',
    'server.js',
    'electron',
    'assets',
    'festos-logo.svg',
    'festos-core.js',
    'mobile-native.js',
    'custom-pickers.js',
    'custom-pickers.css',
    'newspaper-engine.js',
    'newspaper-studio.css',
    'admin.html',
    'admin.js',
    'superadmin.html',
    'superadmin.js',
    'results.html',
    'results.js',
    'index.html',
    'display.html',
    'landing.html',
    'announcements.html',
    'manager.html',
    'manager.js',
    'judge.html',
    'judge.js',
    'login.js',
    'stage-controller.html',
    'stage-controller.js',
    'team-manager.html',
    'team-manager.js',
    'program_report.html',
    'scan.html',
    'spectator.html',
    'id-badge-engine.js',
    'ai-template-generator.js',
    'preset-templates-engine.js'
];

// Also copy all html, js, css, svg, png, etc. files in root
fs.readdirSync(ROOT_DIR).forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.html', '.css', '.svg', '.png', '.jpg', '.jpeg', '.json', '.wav', '.mp3', '.js'].includes(ext)) {
        if (!filesAndDirsToCopy.includes(file)) {
            filesAndDirsToCopy.push(file);
        }
    }
});

for (const item of filesAndDirsToCopy) {
    const src = path.join(ROOT_DIR, item);
    const dest = path.join(APP_DEST, item);
    if (fs.existsSync(src)) {
        copyRecursiveSync(src, dest);
    }
}

// Also remove default_app.asar from resources if present so it uses resources/app
const defaultAppAsar = path.join(OUTPUT_DIR, 'resources', 'default_app.asar');
if (fs.existsSync(defaultAppAsar)) {
    fs.unlinkSync(defaultAppAsar);
}

console.log('======================================================');
console.log('🎉 SUCCESS: FestOS Standalone Desktop Application Built!');
console.log(`Executable: ${path.join(OUTPUT_DIR, 'FestOS.exe')}`);
console.log('======================================================');
