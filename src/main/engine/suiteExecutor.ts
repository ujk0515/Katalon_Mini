import * as os from 'os';
import type { BrowserConfig } from '../../shared/types/project';
import type { TestSuiteConfig, SuiteResult, TestCaseResult, SuiteStatistics, SuiteContext } from '../../shared/types/suite';
import { ScriptExecutor } from './executor';
import { preprocessScript } from './preprocessor';
import { parseScript } from './parser';
import { mapToPlaywrightCommands } from './commandMapper';
import { readFile } from '../services/fileService';
import { generateReport } from './reportGenerator';

export type SuiteStepCallback = (event: string, data: any) => void;

export class SuiteExecutor {
  private aborted = false;
  private currentExecutor: ScriptExecutor | null = null;

  async execute(
    suite: TestSuiteConfig,
    projectPath: string,
    config: BrowserConfig,
    onEvent: SuiteStepCallback,
  ): Promise<SuiteResult> {
    const startedAt = new Date().toISOString();
    const results: TestCaseResult[] = [];
    let hasFailure = false;

    for (let i = 0; i < suite.testCases.length; i++) {
      if (this.aborted) break;

      const tcPath = suite.testCases[i];
      const tcName = tcPath.replace(/\.groovy$/, '').replace(/^Test Cases\//, '');

      onEvent('tcStart', { index: i, total: suite.testCases.length, name: tcName });

      if (hasFailure && suite.stopOnFailure) {
        results.push({
          name: tcName, path: tcPath, status: 'skipped',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          duration: 0, steps: [],
        });
        onEvent('tcComplete', { index: i, name: tcName, status: 'skipped', duration: 0 });
        continue;
      }

      const tcResult = await this.executeTestCase(tcPath, tcName, projectPath, config, onEvent);
      results.push(tcResult);

      if (tcResult.status === 'fail' || tcResult.status === 'error') {
        hasFailure = true;
      }

      onEvent('tcComplete', {
        index: i, name: tcName,
        status: tcResult.status, duration: tcResult.duration,
        error: tcResult.error,
      });
    }

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const statistics: SuiteStatistics = {
      total: suite.testCases.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail' || r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    const context: SuiteContext = {
      hostName: os.hostname(),
      os: `${os.type()} ${os.release()}`,
      browser: config.browser,
      viewport: config.viewport ? `${config.viewport.width}x${config.viewport.height}` : '창 크기에 맞춤',
    };

    const suiteResult: SuiteResult = {
      suiteName: suite.name,
      status: statistics.failed > 0 ? 'fail' : 'pass',
      startedAt, completedAt, duration, statistics,
      testCaseResults: results, context,
    };

    const reportPath = await generateReport(suiteResult, projectPath);

    onEvent('suiteComplete', { result: suiteResult, reportPath });

    return suiteResult;
  }

  private async executeTestCase(
    tcPath: string,
    tcName: string,
    projectPath: string,
    config: BrowserConfig,
    onEvent: SuiteStepCallback,
  ): Promise<TestCaseResult> {
    const startedAt = new Date().toISOString();
    const executor = new ScriptExecutor();
    this.currentExecutor = executor;

    try {
      const script = readFile(projectPath, tcPath);
      const { cleanScript } = preprocessScript(script);
      const ast = parseScript(cleanScript);
      const commands = mapToPlaywrightCommands(ast);

      const fileResolver = async (testCasePath: string) => {
        const relPath = testCasePath.endsWith('.groovy') ? testCasePath : `${testCasePath}.groovy`;
        return readFile(projectPath, relPath);
      };

      const result = await executor.execute(commands, config, (log) => {
        onEvent('stepLog', { tcName, ...log });
      }, fileResolver);

      const completedAt = new Date().toISOString();
      return {
        name: tcName, path: tcPath,
        status: result.status === 'pass' ? 'pass' : 'fail',
        startedAt, completedAt, duration: result.duration,
        steps: result.steps,
        error: result.error?.message,
      };
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      return {
        name: tcName, path: tcPath, status: 'error',
        startedAt, completedAt,
        duration: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        steps: [], error: err.message,
      };
    }
  }

  async stop() {
    this.aborted = true;
    if (this.currentExecutor) {
      await this.currentExecutor.stop();
    }
  }
}
