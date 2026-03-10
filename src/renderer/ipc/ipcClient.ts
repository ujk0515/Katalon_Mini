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

      // Script
      executeScript: (args: { script: string; testCaseId: string; projectPath: string; browserConfig?: any }) => Promise<void>;
      stopScript: () => Promise<any>;

      // Events
      onScriptLog: (callback: (data: any) => void) => () => void;
      onScriptComplete: (callback: (data: any) => void) => () => void;
      onScriptError: (callback: (data: any) => void) => () => void;

      // Suite
      executeSuite: (args: { suitePath: string; projectPath: string; browserConfig?: any }) => Promise<void>;
      stopSuite: () => Promise<any>;
      onSuiteTcStart: (callback: (data: any) => void) => () => void;
      onSuiteTcComplete: (callback: (data: any) => void) => () => void;
      onSuiteComplete: (callback: (data: any) => void) => () => void;

      // Shell
      openPath: (fullPath: string) => Promise<string>;
    };
  }
}

export const api = () => window.electronAPI;
