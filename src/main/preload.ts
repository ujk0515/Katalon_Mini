import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types/ipc';

contextBridge.exposeInMainWorld('electronAPI', {
  // Project
  createProject: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, args),
  openProject: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, path),
  getFileTree: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_TREE, path),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIR),

  // File
  createFile: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_CREATE, args),
  readFile: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, args),
  writeFile: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, args),
  renameFile: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_RENAME, args),
  deleteFile: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DELETE, args),

  // Script
  executeScript: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_EXECUTE, args),
  stopScript: () => ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_STOP),

  // Script events (Main → Renderer)
  onScriptLog: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SCRIPT_LOG, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCRIPT_LOG, listener);
  },
  onScriptComplete: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SCRIPT_COMPLETE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCRIPT_COMPLETE, listener);
  },
  onScriptError: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SCRIPT_ERROR, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCRIPT_ERROR, listener);
  },

  // Suite
  executeSuite: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.SUITE_EXECUTE, args),
  stopSuite: () => ipcRenderer.invoke(IPC_CHANNELS.SUITE_STOP),

  // Suite events (Main → Renderer)
  onSuiteTcStart: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SUITE_TC_START, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SUITE_TC_START, listener);
  },
  onSuiteTcComplete: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SUITE_TC_COMPLETE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SUITE_TC_COMPLETE, listener);
  },
  onSuiteComplete: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SUITE_COMPLETE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SUITE_COMPLETE, listener);
  },

  // Shell
  openPath: (fullPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, fullPath),
});
