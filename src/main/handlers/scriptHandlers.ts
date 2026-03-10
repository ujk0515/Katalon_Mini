import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { DEFAULT_BROWSER_CONFIG } from '../../shared/types/project';
import { parseScript } from '../engine/parser';
import { mapToPlaywrightCommands } from '../engine/commandMapper';
import { ScriptExecutor } from '../engine/executor';
import { readFile } from '../services/fileService';
import { preprocessScript } from '../engine/preprocessor';
import type { FileResolver } from '../engine/executor';

let currentExecutor: ScriptExecutor | null = null;

export function registerScriptHandlers() {
  ipcMain.handle(IPC_CHANNELS.SCRIPT_EXECUTE, async (event, args) => {
    const { script, testCaseId, projectPath, browserConfig } = args;
    const win = BrowserWindow.fromWebContents(event.sender);

    const config = { ...DEFAULT_BROWSER_CONFIG, ...browserConfig };

    // FileResolver: resolve test case path to file content
    const fileResolver: FileResolver = async (testCasePath: string) => {
      if (!projectPath) {
        throw new Error('projectPath is required for callTestCase');
      }
      const relativePath = testCasePath.endsWith('.groovy')
        ? testCasePath
        : `${testCasePath}.groovy`;
      return readFile(projectPath, relativePath);
    };

    try {
      // Preprocess: strip non-WebUI lines (import, def, new, etc.)
      const { cleanScript, skippedLines, totalLines } = preprocessScript(script);

      if (skippedLines > 0) {
        win?.webContents.send(IPC_CHANNELS.SCRIPT_LOG, {
          timestamp: new Date().toISOString(),
          step: 0,
          total: 0,
          command: `[Preprocessor] ${skippedLines}/${totalLines} lines skipped`,
          status: 'pass',
          lineNumber: 0,
        });
      }

      // Parse
      const ast = parseScript(cleanScript);
      const commands = mapToPlaywrightCommands(ast);

      if (commands.length === 0) {
        win?.webContents.send(IPC_CHANNELS.SCRIPT_ERROR, {
          message: 'No executable commands found in script',
          lineNumber: 0,
          column: 0,
          type: 'parse',
        });
        return;
      }

      // Execute with fileResolver
      currentExecutor = new ScriptExecutor();

      const result = await currentExecutor.execute(commands, config, (log) => {
        win?.webContents.send(IPC_CHANNELS.SCRIPT_LOG, log);
      }, fileResolver);

      result.testCaseId = testCaseId;
      result.testCaseName = testCaseId;
      win?.webContents.send(IPC_CHANNELS.SCRIPT_COMPLETE, { result });
      currentExecutor = null;
    } catch (err: any) {
      currentExecutor = null;

      // Parse errors
      const lineMatch = err.message?.match(/Line (\d+)/);
      const colMatch = err.message?.match(/Col (\d+)/);

      win?.webContents.send(IPC_CHANNELS.SCRIPT_ERROR, {
        message: err.message || String(err),
        lineNumber: lineMatch ? parseInt(lineMatch[1]) : 0,
        column: colMatch ? parseInt(colMatch[1]) : 0,
        type: (err.message?.includes('Parse') || err.message?.includes('Lexer')) ? 'parse' : 'runtime',
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_STOP, async () => {
    if (currentExecutor) {
      await currentExecutor.stop();
      currentExecutor = null;
    }
    return { success: true };
  });
}
