import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { DEFAULT_BROWSER_CONFIG } from '../../shared/types/project';
import { SuiteExecutor } from '../engine/suiteExecutor';
import { readFile } from '../services/fileService';
import type { TestSuiteConfig } from '../../shared/types/suite';

let currentSuiteExecutor: SuiteExecutor | null = null;

export function registerSuiteHandlers() {
  ipcMain.handle(IPC_CHANNELS.SUITE_EXECUTE, async (event, args) => {
    const { suitePath, projectPath, browserConfig, mobileConfig, projectType } = args;
    const win = BrowserWindow.fromWebContents(event.sender);
    const config = { ...DEFAULT_BROWSER_CONFIG, ...browserConfig };

    try {
      const suiteJson = readFile(projectPath, suitePath);
      const suite: TestSuiteConfig = JSON.parse(suiteJson);

      currentSuiteExecutor = new SuiteExecutor();

      await currentSuiteExecutor.execute(suite, projectPath, config, (eventName, data) => {
        switch (eventName) {
          case 'tcStart':
            win?.webContents.send(IPC_CHANNELS.SUITE_TC_START, data);
            break;
          case 'tcComplete':
            win?.webContents.send(IPC_CHANNELS.SUITE_TC_COMPLETE, data);
            break;
          case 'stepLog':
            win?.webContents.send(IPC_CHANNELS.SCRIPT_LOG, data);
            break;
          case 'suiteComplete':
            win?.webContents.send(IPC_CHANNELS.SUITE_COMPLETE, data);
            break;
        }
      }, mobileConfig, projectType);

      currentSuiteExecutor = null;
    } catch (err: any) {
      currentSuiteExecutor = null;
      win?.webContents.send(IPC_CHANNELS.SCRIPT_ERROR, {
        message: err.message, lineNumber: 0, column: 0, type: 'runtime',
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.SUITE_STOP, async (event) => {
    if (currentSuiteExecutor) {
      await currentSuiteExecutor.stop();
      currentSuiteExecutor = null;
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.webContents.send(IPC_CHANNELS.SUITE_STOPPED);
    }
    return { success: true };
  });
}
