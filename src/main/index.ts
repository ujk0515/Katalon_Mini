import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import * as path from 'path';
import { registerProjectHandlers } from './handlers/projectHandlers';
import { registerFileHandlers } from './handlers/fileHandlers';
import { registerScriptHandlers } from './handlers/scriptHandlers';
import { registerSuiteHandlers } from './handlers/suiteHandlers';
import { registerMobileHandlers, stopMobileHandlers } from './handlers/mobileHandlers';
import { IPC_CHANNELS } from '../shared/types/ipc';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Script Automation',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173/');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => { createWindow(); },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
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
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Script Automation',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              const { dialog } = require('electron');
              dialog.showMessageBox(win, {
                type: 'info',
                title: 'Script Automation',
                message: 'Script Automation v0.1.0',
                detail: 'Katalon Groovy to Playwright/Appium Test Automation IDE',
              });
            }
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  registerProjectHandlers();
  registerFileHandlers();
  registerScriptHandlers();
  registerSuiteHandlers();
  registerMobileHandlers();

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, fullPath: string) => {
    return shell.openPath(fullPath);
  });

  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  stopMobileHandlers();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
