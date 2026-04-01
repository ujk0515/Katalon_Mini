// Type-safe wrapper for Electron IPC from renderer
declare global {
  interface Window {
    electronAPI: {
      // Project
      createProject: (args: { name: string; type: 'web' | 'mobile'; path: string }) => Promise<any>;
      openProject: (path: string) => Promise<any>;
      getFileTree: (path: string) => Promise<any>;
      selectDirectory: () => Promise<{ canceled: boolean; path: string | null }>;

      // File
      createFile: (args: { projectPath: string; relativePath: string; isFolder: boolean }) => Promise<any>;
      readFile: (args: { projectPath: string; relativePath: string }) => Promise<any>;
      writeFile: (args: { projectPath: string; relativePath: string; content: string }) => Promise<any>;
      renameFile: (args: { projectPath: string; oldPath: string; newPath: string }) => Promise<any>;
      deleteFile: (args: { projectPath: string; relativePath: string }) => Promise<any>;
      moveFile: (args: { projectPath: string; oldPath: string; newPath: string }) => Promise<any>;
      getFileOrder: (projectPath: string) => Promise<Record<string, string[]>>;
      setFileOrder: (args: { projectPath: string; order: Record<string, string[]> }) => Promise<any>;

      // Script
      executeScript: (args: { script: string; testCaseId: string; projectPath: string; projectType?: string; browserConfig?: any; mobileConfig?: any }) => Promise<void>;
      stopScript: () => Promise<any>;

      // Events
      onScriptLog: (callback: (data: any) => void) => () => void;
      onScriptComplete: (callback: (data: any) => void) => () => void;
      onScriptError: (callback: (data: any) => void) => () => void;
      onScriptStopped: (callback: () => void) => () => void;

      // Suite
      executeSuite: (args: { suitePath: string; projectPath: string; browserConfig?: any; mobileConfig?: any; projectType?: string }) => Promise<void>;
      stopSuite: () => Promise<any>;
      onSuiteTcStart: (callback: (data: any) => void) => () => void;
      onSuiteTcComplete: (callback: (data: any) => void) => () => void;
      onSuiteComplete: (callback: (data: any) => void) => () => void;
      onSuiteStopped: (callback: () => void) => () => void;

      // Shell
      openPath: (fullPath: string) => Promise<string>;

      // Mobile / Device
      onDeviceChanged: (callback: (data: any) => void) => () => void;
      getDeviceList: () => Promise<any>;
      refreshDevices: () => Promise<any>;
      selectDevice: (udid: string | null) => Promise<any>;
      deleteDevice: (udid: string) => Promise<any>;
      checkDeviceHealth: (udid: string) => Promise<any>;
      getAppiumStatus: () => Promise<any>;
      startAppium: () => Promise<any>;
      stopAppium: () => Promise<any>;
      saveMobileConfig: (args: any) => Promise<any>;

      // Recent Projects
      getRecentProjects: () => Promise<any[]>;
      removeRecentProject: (path: string) => Promise<any[]>;
    };
  }
}

export const api = () => window.electronAPI;
