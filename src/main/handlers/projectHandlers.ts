import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { DEFAULT_BROWSER_CONFIG } from '../../shared/types/project';
import * as fileService from '../services/fileService';

// ─── Recent Projects ───

interface RecentProject {
  path: string;
  name: string;
  type: 'web' | 'mobile';
  lastOpened: string;
}

const RECENT_FILE = 'recent-projects.json';
const MAX_RECENT = 10;

function getRecentPath(): string {
  return path.join(app.getPath('userData'), RECENT_FILE);
}

function loadRecent(): RecentProject[] {
  try {
    const content = fs.readFileSync(getRecentPath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function saveRecent(list: RecentProject[]): void {
  fs.writeFileSync(getRecentPath(), JSON.stringify(list, null, 2), 'utf-8');
}

function addRecent(projectPath: string, name: string, type: 'web' | 'mobile'): void {
  let list = loadRecent();
  // 이미 있으면 제거 (맨 위로 올리기 위해)
  list = list.filter(p => p.path !== projectPath);
  list.unshift({ path: projectPath, name, type, lastOpened: new Date().toISOString() });
  // 최대 갯수 제한
  if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
  saveRecent(list);
}

// ─── Handlers ───

export function registerProjectHandlers() {
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, args) => {
    const { name, type, path: dirPath } = args;
    const projectType = type === 'mobile' ? 'mobile' : type === 'web' ? 'web' : 'web';
    const projectPath = path.join(dirPath, name);
    try {
      const config = fileService.createProject(
        projectPath,
        name,
        projectType,
        DEFAULT_BROWSER_CONFIG
      );
      addRecent(projectPath, name, projectType);
      return { success: true, projectPath, config };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, projectPath: string) => {
    try {
      const config = fileService.openProject(projectPath);
      addRecent(projectPath, config.name, config.type);
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

  // ─── Recent Projects ───

  ipcMain.handle(IPC_CHANNELS.RECENT_PROJECTS_GET, async () => {
    return loadRecent();
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_PROJECTS_REMOVE, async (_event, projectPath: string) => {
    let list = loadRecent();
    list = list.filter(p => p.path !== projectPath);
    saveRecent(list);
    return list;
  });
}
