const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ELECTRON_DIST = path.join(ROOT_DIR, 'node_modules', 'electron', 'dist');
const OUTPUT_DIR_VIBRANIUM = path.join(ROOT_DIR, 'dist-desktop', 'Vibranium-win32-x64');
const OUTPUT_DIR_FESTOS = path.join(ROOT_DIR, 'dist-desktop', 'FestOS-win32-x64');

console.log('🚀 Packaging VIBRANIUM Windows Desktop Standalone Application...');

if (!fs.existsSync(ELECTRON_DIST)) {
    console.error('❌ Electron dist binary not found in node_modules/electron/dist');
    process.exit(1);
}

function buildDesktopApp(targetDir) {
    console.log(`📦 Building in: ${targetDir}`);
    if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

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
        const destPath = path.join(targetDir, item === 'electron.exe' ? 'Vibranium.exe' : item);
        copyRecursiveSync(srcPath, destPath);
        // Also provide FestOS.exe for backwards compatibility
        if (item === 'electron.exe') {
            fs.copyFileSync(srcPath, path.join(targetDir, 'FestOS.exe'));
        }
    });

    const appDest = path.join(targetDir, 'resources', 'app');
    fs.mkdirSync(appDest, { recursive: true });

    const filesAndDirsToCopy = [
        'package.json',
        'server.js',
        'electron',
        'assets',
        'vibranium-icon.png',
        'vibranium-logo.png',
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
        const dest = path.join(appDest, item);
        if (fs.existsSync(src)) {
            copyRecursiveSync(src, dest);
        }
    }

    const defaultAppAsar = path.join(targetDir, 'resources', 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        fs.unlinkSync(defaultAppAsar);
    }
}

// 1. Build Vibranium-win32-x64
buildDesktopApp(OUTPUT_DIR_VIBRANIUM);

// 2. Build FestOS-win32-x64 (for backwards compatibility)
buildDesktopApp(OUTPUT_DIR_FESTOS);

console.log('======================================================');
console.log('🎉 SUCCESS: VIBRANIUM Standalone Desktop Application Built!');
console.log(`Executable: ${path.join(OUTPUT_DIR_VIBRANIUM, 'Vibranium.exe')}`);
console.log('======================================================');
