import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import * as fileService from '../services/fileService';

export function registerFileHandlers() {
  ipcMain.handle(IPC_CHANNELS.FILE_CREATE, async (_event, args) => {
    const { projectPath, relativePath, isFolder } = args;
    try {
      fileService.createFile(projectPath, relativePath, isFolder);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, args) => {
    const { projectPath, relativePath } = args;
    try {
      const content = fileService.readFile(projectPath, relativePath);
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, args) => {
    const { projectPath, relativePath, content } = args;
    try {
      // .groovy 파일: import 줄만 제거 (나머지 코드는 그대로 보존)
      let finalContent = content;
      if (relativePath.endsWith('.groovy') && /^import\s+/m.test(content)) {
        finalContent = content
          .split(/\r?\n/)
          .filter((line: string) => !line.trimStart().startsWith('import '))
          .join('\n')
          .replace(/^\n+/, ''); // 맨 위 빈줄 제거
      }
      fileService.writeFile(projectPath, relativePath, finalContent);
      return { success: true, cleaned: finalContent !== content, content: finalContent };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_RENAME, async (_event, args) => {
    const { projectPath, oldPath, newPath } = args;
    try {
      fileService.renameFile(projectPath, oldPath, newPath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_ORDER_GET, async (_event, projectPath: string) => {
    return fileService.getFileOrder(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_ORDER_SET, async (_event, args) => {
    const { projectPath, order } = args;
    fileService.setFileOrder(projectPath, order);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.FILE_MOVE, async (_event, args) => {
    const { projectPath, oldPath, newPath } = args;
    try {
      const result = fileService.moveFile(projectPath, oldPath, newPath);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, args) => {
    const { projectPath, relativePath } = args;
    try {
      fileService.deleteFile(projectPath, relativePath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
