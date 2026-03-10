import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { registerProjectHandlers } from './handlers/projectHandlers';
import { registerFileHandlers } from './handlers/fileHandlers';
import { registerScriptHandlers } from './handlers/scriptHandlers';
import { registerSuiteHandlers } from './handlers/suiteHandlers';
import { IPC_CHANNELS } from '../shared/types/ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Katalon Mini',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Dev mode: load Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerProjectHandlers();
  registerFileHandlers();
  registerScriptHandlers();
  registerSuiteHandlers();

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, fullPath: string) => {
    return shell.openPath(fullPath);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
