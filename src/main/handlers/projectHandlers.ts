import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { DEFAULT_BROWSER_CONFIG } from '../../shared/types/project';
import * as fileService from '../services/fileService';

export function registerProjectHandlers() {
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, args) => {
    const { name, type, path: dirPath } = args;
    const projectPath = path.join(dirPath, name);
    try {
      const config = fileService.createProject(
        projectPath,
        name,
        type,
        DEFAULT_BROWSER_CONFIG
      );
      return { success: true, projectPath, config };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, projectPath: string) => {
    try {
      const config = fileService.openProject(projectPath);
      return { success: true, projectPath, config };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_TREE, async (_event, projectPath: string) => {
    try {
      const tree = fileService.getFileTree(projectPath);
      return { success: true, tree };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIR, async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { canceled: true };

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });

    return {
      canceled: result.canceled,
      path: result.filePaths[0] || null,
    };
  });
}
