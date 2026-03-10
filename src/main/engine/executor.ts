import { chromium, Browser, Page, BrowserContext, Frame } from 'playwright';
import type { PlaywrightCommand } from '../../shared/types/ast';
import type { BrowserConfig } from '../../shared/types/project';
import type { StepResult, ExecutionResult } from '../../shared/types/execution';
import { parseScript } from './parser';
import { mapToPlaywrightCommands } from './commandMapper';
import { preprocessScript } from './preprocessor';

export type FileResolver = (testCasePath: string) => Promise<string>;

export type StepCallback = (log: {
  step: number;
  total: number;
  command: string;
  status: 'running' | 'pass' | 'fail';
  lineNumber: number;
  duration?: number;
  error?: string;
}) => void;

export class ScriptExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private activeFrame: Frame | null = null;
  private aborted = false;
  private fileResolver: FileResolver | null = null;
  private stepIndex = 0;
  private totalSteps = 0;
  private variables: Map<string, string> = new Map();
  private responseErrors: { status: number; url: string }[] = [];

  async execute(
    commands: PlaywrightCommand[],
    config: BrowserConfig,
    onStep: StepCallback,
    fileResolver?: FileResolver,
  ): Promise<ExecutionResult> {
    this.aborted = false;
    this.fileResolver = fileResolver || null;
    this.stepIndex = 0;
    this.totalSteps = commands.length;
    const startedAt = new Date().toISOString();
    const steps: StepResult[] = [];
    let overallStatus: 'pass' | 'fail' | 'error' = 'pass';

    try {
      for (let i = 0; i < commands.length; i++) {
        if (this.aborted) {
          overallStatus = 'error';
          break;
        }

        const cmd = commands[i];
        const commandLabel = this.getCommandLabel(cmd);
        this.stepIndex++;

        onStep({
          step: this.stepIndex,
          total: this.totalSteps,
          command: commandLabel,
          status: 'running',
          lineNumber: cmd.lineNumber,
        });

        const stepStart = Date.now();
        let stepStatus: 'pass' | 'fail' = 'pass';
        let stepError: string | undefined;

        try {
          await this.executeCommand(cmd, config, onStep, []);
        } catch (err: any) {
          if (this.aborted) {
            overallStatus = 'error';
            break;
          }
          stepStatus = 'fail';
          stepError = err.message || String(err);
          overallStatus = 'fail';
        }

        const duration = Date.now() - stepStart;

        steps.push({
          index: i,
          command: commandLabel,
          args: this.getCommandArgs(cmd),
          status: stepStatus,
          duration,
          error: stepError,
          lineNumber: cmd.lineNumber,
        });

        onStep({
          step: this.stepIndex,
          total: this.totalSteps,
          command: commandLabel,
          status: stepStatus,
          lineNumber: cmd.lineNumber,
          duration,
          error: stepError,
        });

        if (stepStatus === 'fail') break;
      }
    } finally {
      await this.cleanup();
    }

    return {
      testCaseId: '',
      testCaseName: '',
      status: overallStatus,
      startedAt,
      completedAt: new Date().toISOString(),
      duration: steps.reduce((sum, s) => sum + s.duration, 0),
      steps,
    };
  }

  async stop() {
    this.aborted = true;
    await this.cleanup();
  }

  private async launchBrowser(config: BrowserConfig) {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: config.headless });
      this.context = await this.browser.newContext({ viewport: config.viewport ?? null });
      this.page = await this.context.newPage();

      // Collect HTTP error responses for verifyNoServerError
      this.page.on('response', (response) => {
        const status = response.status();
        if (status >= 400) {
          this.responseErrors.push({ status, url: response.url() });
        }
      });
    }
  }

  private async executeCommand(
    cmd: PlaywrightCommand,
    config: BrowserConfig,
    onStep: StepCallback,
    callStack: string[],
  ) {
    switch (cmd.action) {
      case 'launch':
        await this.launchBrowser(config);
        break;

      case 'launchAndGoto':
        await this.launchBrowser(config);
        await this.page!.goto(cmd.value!, { timeout: config.timeout });
        break;

      case 'navigate':
        this.ensurePage();
        if (!cmd.value) {
          throw new Error('navigateToUrl requires a URL argument');
        }
        await this.page!.goto(cmd.value, { timeout: config.timeout });
        break;

      case 'close':
        await this.cleanup();
        break;

      case 'reload':
        this.ensurePage();
        await this.page!.reload({ timeout: config.timeout });
        break;

      case 'goBack':
        this.ensurePage();
        await this.page!.goBack({ timeout: config.timeout });
        break;

      case 'goForward':
        this.ensurePage();
        await this.page!.goForward({ timeout: config.timeout });
        break;

      case 'click':
        this.ensurePage();
        await this.ap().click(this.sel(cmd.selector!), { timeout: config.timeout });
        break;

      case 'dblclick':
        this.ensurePage();
        await this.ap().dblclick(this.sel(cmd.selector!), { timeout: config.timeout });
        break;

      case 'fill':
        this.ensurePage();
        await this.ap().fill(this.sel(cmd.selector!), cmd.value ?? '', { timeout: config.timeout });
        break;

      case 'textContent':
        this.ensurePage();
        await this.ap().textContent(this.sel(cmd.selector!), { timeout: config.timeout });
        break;

      case 'waitForSelector':
        this.ensurePage();
        await this.ap().waitForSelector(this.sel(cmd.selector!), { timeout: cmd.timeout });
        break;

      case 'waitForSelectorVisible':
        this.ensurePage();
        await this.ap().waitForSelector(this.sel(cmd.selector!), { state: 'visible', timeout: cmd.timeout });
        break;

      case 'waitForTimeout':
        this.ensurePage();
        await this.ap().waitForTimeout(cmd.timeout ?? 1000);
        break;

      case 'verifyPresent':
        this.ensurePage();
        {
          const el = await this.ap().$(this.sel(cmd.selector!));
          if (!el) throw new Error(`Element not found: "${cmd.selector}"`);
        }
        break;

      case 'verifyText':
        this.ensurePage();
        {
          const text = await this.ap().textContent(this.sel(cmd.selector!));
          if (text?.trim() !== cmd.value) {
            throw new Error(`Text mismatch: expected "${cmd.value}", got "${text?.trim()}"`);
          }
        }
        break;

      case 'verifyTitle':
        this.ensurePage();
        {
          const title = await this.page!.title();
          if (title !== cmd.value) {
            throw new Error(`Title mismatch: expected "${cmd.value}", got "${title}"`);
          }
        }
        break;

      // Extended actions
      case 'comment':
        // No browser action, just logged
        break;

      case 'sendKeys':
        this.ensurePage();
        {
          const keyMap: Record<string, string> = {
            'ENTER': 'Enter', 'TAB': 'Tab', 'ESCAPE': 'Escape',
            'BACKSPACE': 'Backspace', 'DELETE': 'Delete',
            'ARROW_UP': 'ArrowUp', 'ARROW_DOWN': 'ArrowDown',
            'ARROW_LEFT': 'ArrowLeft', 'ARROW_RIGHT': 'ArrowRight',
            'HOME': 'Home', 'END': 'End',
            'PAGE_UP': 'PageUp', 'PAGE_DOWN': 'PageDown',
          };
          const key = keyMap[cmd.value?.toUpperCase() ?? ''] || cmd.value || 'Enter';
          if (cmd.selector) {
            await this.ap().press(this.sel(cmd.selector), key, { timeout: config.timeout });
          } else {
            await this.page!.keyboard.press(key);
          }
        }
        break;

      case 'selectOption':
        this.ensurePage();
        await this.ap().selectOption(this.sel(cmd.selector!), { label: cmd.value }, { timeout: config.timeout });
        break;

      case 'scrollToElement':
        this.ensurePage();
        {
          const el = await this.ap().waitForSelector(this.sel(cmd.selector!), { timeout: config.timeout });
          await el!.scrollIntoViewIfNeeded();
        }
        break;

      case 'verifyMatch':
        this.ensurePage();
        {
          const text = await this.ap().textContent(this.sel(cmd.selector!));
          const regex = new RegExp(cmd.value || '');
          if (!regex.test(text || '')) {
            throw new Error(`Text "${text?.trim()}" does not match pattern "${cmd.value}"`);
          }
        }
        break;

      case 'selectDate':
        this.ensurePage();
        {
          // Find clickable element with exact date text inside the container
          const containerSel = this.sel(cmd.selector!);
          const container = await this.ap().waitForSelector(containerSel, { timeout: config.timeout });
          const dateEls = await container!.$$('td, button, [role="gridcell"]');
          let clicked = false;
          for (const el of dateEls) {
            const text = (await el.textContent())?.trim();
            if (text === cmd.value && await el.isVisible()) {
              await el.click();
              this.variables.set('_lastSelectedDate', cmd.value!);
              clicked = true;
              break;
            }
          }
          if (!clicked) {
            throw new Error(`Date "${cmd.value}" not found in calendar`);
          }
        }
        break;

      case 'selectRandomDate':
        this.ensurePage();
        {
          const containerSel = this.sel(cmd.selector!);
          const container = await this.ap().waitForSelector(containerSel, { timeout: config.timeout });
          const dateEls = await container!.$$('td, button, [role="gridcell"]');
          const clickable: { el: any; text: string }[] = [];
          for (const el of dateEls) {
            const text = (await el.textContent())?.trim() || '';
            const num = parseInt(text);
            if (num >= 1 && num <= 31 && await el.isVisible() && await el.isEnabled()) {
              clickable.push({ el, text });
            }
          }
          if (clickable.length === 0) {
            throw new Error('No selectable dates found in calendar');
          }
          const chosen = clickable[Math.floor(Math.random() * clickable.length)];
          await chosen.el.click();
          this.variables.set('_lastSelectedDate', chosen.text);
        }
        break;

      case 'selectRandomDateAfter':
        this.ensurePage();
        {
          const containerSel = this.sel(cmd.selector!);
          const container = await this.ap().waitForSelector(containerSel, { timeout: config.timeout });
          const dateEls = await container!.$$('td, button, [role="gridcell"]');
          const minDate = parseInt(this.variables.get('_lastSelectedDate') || '1');
          const clickable: { el: any; text: string }[] = [];
          for (const el of dateEls) {
            const text = (await el.textContent())?.trim() || '';
            const num = parseInt(text);
            if (num >= minDate && num <= 31 && await el.isVisible() && await el.isEnabled()) {
              clickable.push({ el, text });
            }
          }
          if (clickable.length === 0) {
            throw new Error(`No selectable dates >= ${minDate} found in calendar`);
          }
          const chosen = clickable[Math.floor(Math.random() * clickable.length)];
          await chosen.el.click();
          this.variables.set('_lastSelectedDate', chosen.text);
        }
        break;

      case 'verifyNoServerError':
        this.ensurePage();
        {
          const errors = this.responseErrors.filter(e => e.status >= 400);
          if (errors.length > 0) {
            const summary = errors.map(e => `  ${e.status}: ${e.url}`).join('\n');
            this.responseErrors = [];
            throw new Error(`Server errors detected (${errors.length}):\n${summary}`);
          }
          this.responseErrors = [];
        }
        break;

      case 'switchToFrame':
        this.ensurePage();
        {
          const frameEl = await this.page!.waitForSelector(this.sel(cmd.selector!), { timeout: config.timeout });
          const frame = await frameEl!.contentFrame();
          if (!frame) throw new Error('Element is not an iframe');
          this.activeFrame = frame;
        }
        break;

      case 'switchToDefaultContent':
        this.activeFrame = null;
        break;

      case 'takeScreenshot':
        this.ensurePage();
        {
          const fileName = cmd.value || `screenshot_${Date.now()}.png`;
          await this.page!.screenshot({ path: fileName, fullPage: false });
        }
        break;

      case 'callTestCase':
        await this.executeCallTestCase(cmd, config, onStep, callStack);
        break;

      case 'unknown':
        throw new Error(cmd.value || 'Unknown command');

      default:
        throw new Error(`Unsupported action: ${cmd.action}`);
    }
  }

  private async executeCallTestCase(
    cmd: PlaywrightCommand,
    config: BrowserConfig,
    onStep: StepCallback,
    callStack: string[],
  ) {
    const tcPath = cmd.testCasePath!;

    // Circular reference check
    if (callStack.includes(tcPath)) {
      throw new Error(`Circular call detected: ${[...callStack, tcPath].join(' → ')}`);
    }

    // Max depth check
    if (callStack.length >= 10) {
      throw new Error(`Max call depth exceeded (10): ${callStack.join(' → ')}`);
    }

    // File resolver check
    if (!this.fileResolver) {
      throw new Error('File resolver not available for callTestCase');
    }

    // Read and parse the referenced script
    let script: string;
    try {
      script = await this.fileResolver(tcPath);
    } catch (err: any) {
      throw new Error(`Test case not found: "${tcPath}" (${err.message})`);
    }

    const { cleanScript } = preprocessScript(script);
    const ast = parseScript(cleanScript);
    const subCommands = mapToPlaywrightCommands(ast);
    const newCallStack = [...callStack, tcPath];

    // Execute sub-commands, skipping launch/close if browser already open
    for (const subCmd of subCommands) {
      if (this.aborted) break;

      // Skip browser open/close in called scripts only if browser already exists
      if (subCmd.action === 'launch' && this.browser) continue;
      if (subCmd.action === 'close') continue;

      // For launchAndGoto, launch browser if needed then navigate
      if (subCmd.action === 'launchAndGoto') {
        if (!this.browser) {
          await this.launchBrowser(config);
        }
        if (subCmd.value) {
          await this.page!.goto(subCmd.value, { timeout: config.timeout });
        }
        continue;
      }

      this.stepIndex++;
      this.totalSteps++;

      const subLabel = `  ${this.getCommandLabel(subCmd)}`;

      onStep({
        step: this.stepIndex,
        total: this.totalSteps,
        command: subLabel,
        status: 'running',
        lineNumber: subCmd.lineNumber,
      });

      const stepStart = Date.now();
      let stepError: string | undefined;
      let stepStatus: 'pass' | 'fail' = 'pass';

      try {
        await this.executeCommand(subCmd, config, onStep, newCallStack);
      } catch (err: any) {
        stepStatus = 'fail';
        stepError = `[in ${tcPath}] ${err.message || String(err)}`;
      }

      const duration = Date.now() - stepStart;

      onStep({
        step: this.stepIndex,
        total: this.totalSteps,
        command: subLabel,
        status: stepStatus,
        lineNumber: subCmd.lineNumber,
        duration,
        error: stepError,
      });

      if (stepStatus === 'fail') {
        throw new Error(stepError);
      }
    }
  }

  private ensurePage() {
    if (!this.page) {
      throw new Error('Browser is not open. Call WebUI.openBrowser() first.');
    }
  }

  /** Returns active frame or page for command execution */
  private ap(): Page | Frame {
    return this.activeFrame || this.page!;
  }

  /** Auto-prefix xpath= for XPath selectors so Playwright recognizes them */
  private sel(selector: string): string {
    if (selector.startsWith('/') || selector.startsWith('(')) {
      return `xpath=${selector}`;
    }
    return selector;
  }

  private async cleanup() {
    this.activeFrame = null;
    this.variables.clear();
    this.responseErrors = [];
    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  private getCommandLabel(cmd: PlaywrightCommand): string {
    switch (cmd.action) {
      case 'launch': return 'WebUI.openBrowser()';
      case 'launchAndGoto': return `WebUI.openBrowser("${cmd.value}")`;
      case 'navigate': return `WebUI.navigateToUrl("${cmd.value}")`;
      case 'close': return 'WebUI.closeBrowser()';
      case 'reload': return 'WebUI.refresh()';
      case 'goBack': return 'WebUI.back()';
      case 'goForward': return 'WebUI.forward()';
      case 'click': return `WebUI.click("${cmd.selector}")`;
      case 'dblclick': return `WebUI.doubleClick("${cmd.selector}")`;
      case 'fill': return cmd.value !== undefined && cmd.value !== '' ? `WebUI.setText("${cmd.selector}", "${cmd.value}")` : `WebUI.clearText("${cmd.selector}")`;
      case 'textContent': return `WebUI.getText("${cmd.selector}")`;
      case 'waitForSelector': return `WebUI.waitForElementPresent("${cmd.selector}")`;
      case 'waitForSelectorVisible': return `WebUI.waitForElementVisible("${cmd.selector}")`;
      case 'waitForTimeout': return `WebUI.delay(${(cmd.timeout ?? 1000) / 1000})`;
      case 'verifyPresent': return `WebUI.verifyElementPresent("${cmd.selector}")`;
      case 'verifyText': return `WebUI.verifyElementText("${cmd.selector}", "${cmd.value}")`;
      case 'verifyTitle': return `WebUI.verifyTitle("${cmd.value}")`;
      case 'callTestCase': return `WebUI.callTestCase("${cmd.testCasePath}")`;
      case 'comment': return `WebUI.comment("${cmd.value}")`;
      case 'sendKeys': return cmd.selector ? `WebUI.sendKeys("${cmd.selector}", "${cmd.value}")` : `WebUI.sendKeys("${cmd.value}")`;
      case 'selectOption': return `WebUI.selectOptionByLabel("${cmd.selector}", "${cmd.value}")`;
      case 'scrollToElement': return `WebUI.scrollToElement("${cmd.selector}")`;
      case 'verifyMatch': return `WebUI.verifyMatch("${cmd.selector}", "${cmd.value}")`;
      case 'selectDate': return `WebUI.selectDate("${cmd.selector}", "${cmd.value}")`;
      case 'selectRandomDate': return `WebUI.selectRandomDate("${cmd.selector}")`;
      case 'selectRandomDateAfter': return `WebUI.selectRandomDateAfter("${cmd.selector}")`;
      case 'verifyNoServerError': return 'WebUI.verifyNoServerError()';
      case 'switchToFrame': return `WebUI.switchToFrame("${cmd.selector}")`;
      case 'switchToDefaultContent': return 'WebUI.switchToDefaultContent()';
      case 'takeScreenshot': return `WebUI.takeScreenshot("${cmd.value || ''}")`;
      default: return `Unknown(${cmd.action})`;
    }
  }

  private getCommandArgs(cmd: PlaywrightCommand): string[] {
    const args: string[] = [];
    if (cmd.selector) args.push(cmd.selector);
    if (cmd.value !== undefined) args.push(cmd.value);
    if (cmd.testCasePath) args.push(cmd.testCasePath);
    if (cmd.timeout !== undefined) args.push(String(cmd.timeout));
    return args;
  }
}
