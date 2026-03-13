import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { DEFAULT_BROWSER_CONFIG } from '../../shared/types/project';
import { parseScript } from '../engine/parser';
import { mapToPlaywrightCommands } from '../engine/commandMapper';
import { ScriptExecutor } from '../engine/executor';
import { readFile } from '../services/fileService';
import { preprocessScript, hasGroovyCode, stripImports } from '../engine/preprocessor';
import { parseGroovyScript } from '../engine/groovyParser';
import { GroovyInterpreter } from '../engine/interpreter';
import type { FileResolver } from '../engine/executor';

let currentExecutor: ScriptExecutor | null = null;
let currentInterpreter: GroovyInterpreter | null = null;

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
      // Detect Groovy mode
      if (hasGroovyCode(script)) {
        // ─── Groovy Pipeline ───
        const { cleanScript, skippedLines, totalLines } = stripImports(script);

        if (skippedLines > 0) {
          win?.webContents.send(IPC_CHANNELS.SCRIPT_LOG, {
            timestamp: new Date().toISOString(),
            step: 0,
            total: 0,
            command: `[Groovy Mode] ${skippedLines} import lines stripped`,
            status: 'pass',
            lineNumber: 0,
          });
        }

        const groovyAst = parseGroovyScript(cleanScript);

        currentExecutor = new ScriptExecutor();
        currentInterpreter = new GroovyInterpreter(
          currentExecutor,
          config,
          (log) => { win?.webContents.send(IPC_CHANNELS.SCRIPT_LOG, log); },
          fileResolver,
        );

        const result = await currentInterpreter.execute(groovyAst);
        result.testCaseId = testCaseId;
        result.testCaseName = testCaseId;
        win?.webContents.send(IPC_CHANNELS.SCRIPT_COMPLETE, { result });
        currentExecutor = null;
        currentInterpreter = null;

      } else {
        // ─── Legacy WebUI-only Pipeline ───
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

        currentExecutor = new ScriptExecutor();

        const result = await currentExecutor.execute(commands, config, (log) => {
          win?.webContents.send(IPC_CHANNELS.SCRIPT_LOG, log);
        }, fileResolver);

        result.testCaseId = testCaseId;
        result.testCaseName = testCaseId;
        win?.webContents.send(IPC_CHANNELS.SCRIPT_COMPLETE, { result });
        currentExecutor = null;
      }
    } catch (err: any) {
      currentExecutor = null;
      currentInterpreter = null;

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
    if (currentInterpreter) {
      currentInterpreter.stop();
      currentInterpreter = null;
    }
    if (currentExecutor) {
      await currentExecutor.stop();
      currentExecutor = null;
    }
    return { success: true };
  });
}
