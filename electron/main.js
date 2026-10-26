const { app, BrowserWindow, Menu, Tray, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'FestOS | Festival Operating System',
        icon: path.join(__dirname, '../festos-logo.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        },
        backgroundColor: '#070A13',
        show: false
    });

    // Load initial entry point (landing.html or index.html)
    mainWindow.loadFile(path.join(__dirname, '../landing.html'));

    // Graceful show on ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Handle external links safely
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    setupAppMenu();
}

function setupAppMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [{ role: 'appMenu' }] : []),
        {
            label: 'FestOS',
            submenu: [
                { label: 'Public Website', click: () => mainWindow.loadFile(path.join(__dirname, '../landing.html')) },
                { label: 'Staff Login', click: () => mainWindow.loadFile(path.join(__dirname, '../index.html')) },
                { label: 'Results Portal', click: () => mainWindow.loadFile(path.join(__dirname, '../results.html')) },
                { label: 'Stage HUD (4K)', click: () => mainWindow.loadFile(path.join(__dirname, '../display.html')) },
                { label: 'Super Admin Hub', click: () => mainWindow.loadFile(path.join(__dirname, '../superadmin.html')) },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
