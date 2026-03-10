import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import * as fileService from '../services/fileService';
import { preprocessScript } from '../engine/preprocessor';

/** 카탈론 스튜디오 스크립트 패턴 감지 (import, new TestObject, addProperty 등) */
function hasKatalonPatterns(content: string): boolean {
  return (
    /\bnew\s+TestObject\s*\(/.test(content) ||
    /\.addProperty\s*\(/.test(content) ||
    /^import\s+/m.test(content)
  );
}

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
      // .groovy 파일에 카탈론 패턴이 있으면 자동 변환
      let finalContent = content;
      let converted = false;
      if (relativePath.endsWith('.groovy') && hasKatalonPatterns(content)) {
        const result = preprocessScript(content);
        finalContent = result.cleanScript;
        converted = true;
      }
      fileService.writeFile(projectPath, relativePath, finalContent);
      return { success: true, converted, content: converted ? finalContent : undefined };
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
