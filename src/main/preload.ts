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
  moveFile: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_MOVE, args),
  getFileOrder: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_ORDER_GET, projectPath),
  setFileOrder: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_ORDER_SET, args),

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

  // Mobile / Device
  onDeviceChanged: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('device:changed', listener);
    return () => ipcRenderer.removeListener('device:changed', listener);
  },
  getDeviceList: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_LIST),
  refreshDevices: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_REFRESH),
  selectDevice: (udid: string | null) => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_SELECT, udid),
  deleteDevice: (udid: string) => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_DELETE, udid),
  checkDeviceHealth: (udid: string) => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_HEALTH_CHECK, udid),
  getAppiumStatus: () => ipcRenderer.invoke(IPC_CHANNELS.APPIUM_STATUS),
  startAppium: () => ipcRenderer.invoke(IPC_CHANNELS.APPIUM_START),
  stopAppium: () => ipcRenderer.invoke(IPC_CHANNELS.APPIUM_STOP),
  saveMobileConfig: (args: any) => ipcRenderer.invoke(IPC_CHANNELS.MOBILE_SAVE_CONFIG, args),

  // Recent Projects
  getRecentProjects: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_PROJECTS_GET),
  removeRecentProject: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_PROJECTS_REMOVE, path),
});
