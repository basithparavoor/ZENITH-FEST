const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('festosDesktop', {
    platform: process.platform,
    isDesktop: true,
    sendNotification: (title, body) => {
        new Notification(title, { body });
    }
});
