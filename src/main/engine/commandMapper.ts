import type {
  ScriptAST,
  MethodCallStatement,
  PlaywrightCommand,
  Argument,
  FunctionCallArgument,
} from '../../shared/types/ast';

function extractSelector(args: Argument[]): string | undefined {
  if (args.length === 0) return undefined;

  const first = args[0];
  if (first.type === 'functionCall' && first.name === 'findTestObject') {
    const innerArg = first.arguments[0];
    if (innerArg?.type === 'string') {
      return innerArg.value;
    }
  }
  if (first.type === 'string') {
    return first.value;
  }
  return undefined;
}

function extractTestCasePath(args: Argument[]): string | undefined {
  if (args.length === 0) return undefined;
  const first = args[0];
  if (first.type === 'functionCall' && first.name === 'findTestCase') {
    const innerArg = first.arguments[0];
    if (innerArg?.type === 'string') {
      return innerArg.value;
    }
  }
  if (first.type === 'string') {
    return first.value;
  }
  return undefined;
}

function extractStringArg(args: Argument[], index: number): string | undefined {
  const arg = args[index];
  if (!arg) return undefined;
  if (arg.type === 'string') return arg.value;
  if (arg.type === 'identifier') return arg.value;
  return undefined;
}

function extractNumberArg(args: Argument[], index: number): number | undefined {
  const arg = args[index];
  if (!arg) return undefined;
  if (arg.type === 'number') return arg.value;
  return undefined;
}

export function mapToPlaywrightCommands(ast: ScriptAST): PlaywrightCommand[] {
  const commands: PlaywrightCommand[] = [];

  for (const stmt of ast.statements) {
    if (stmt.type !== 'MethodCall') continue;

    const mc = stmt as MethodCallStatement;
    const cmd = mapMethodCall(mc);
    if (cmd) {
      commands.push(cmd);
    }
  }

  return commands;
}

function mapMethodCall(mc: MethodCallStatement): PlaywrightCommand | null {
  const { method, arguments: args, lineNumber } = mc;

  switch (method) {
    // Browser control
    case 'openBrowser': {
      const url = extractStringArg(args, 0);
      if (url) {
        // openBrowser with URL: launch + navigate
        return { action: 'launchAndGoto', value: url, lineNumber };
      }
      // openBrowser without URL: just launch
      return { action: 'launch', lineNumber };
    }

    case 'closeBrowser':
      return { action: 'close', lineNumber };

    case 'navigateToUrl':
      return {
        action: 'navigate',
        value: extractStringArg(args, 0),
        lineNumber,
      };

    case 'refresh':
      return { action: 'reload', lineNumber };

    case 'back':
      return { action: 'goBack', lineNumber };

    case 'forward':
      return { action: 'goForward', lineNumber };

    // Element interaction
    case 'click':
      return {
        action: 'click',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'doubleClick':
      return {
        action: 'dblclick',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'setText':
      return {
        action: 'fill',
        selector: extractSelector(args),
        value: extractStringArg(args, 1),
        lineNumber,
      };

    case 'getText':
      return {
        action: 'textContent',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'clearText':
      return {
        action: 'fill',
        selector: extractSelector(args),
        value: '',
        lineNumber,
      };

    // Wait
    case 'waitForElementPresent':
      return {
        action: 'waitForSelector',
        selector: extractSelector(args),
        timeout: (extractNumberArg(args, 1) ?? 30) * 1000,
        lineNumber,
      };

    case 'waitForElementVisible':
      return {
        action: 'waitForSelectorVisible',
        selector: extractSelector(args),
        timeout: (extractNumberArg(args, 1) ?? 30) * 1000,
        lineNumber,
      };

    case 'delay':
      return {
        action: 'waitForTimeout',
        timeout: (extractNumberArg(args, 0) ?? 1) * 1000,
        lineNumber,
      };

    // Verification
    case 'verifyElementPresent':
      return {
        action: 'verifyPresent',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'verifyElementText':
      return {
        action: 'verifyText',
        selector: extractSelector(args),
        value: extractStringArg(args, 1),
        lineNumber,
      };

    case 'verifyTitle':
      return {
        action: 'verifyTitle',
        value: extractStringArg(args, 0),
        lineNumber,
      };

    // Extended methods
    case 'comment':
      return { action: 'comment', value: extractStringArg(args, 0) || '', lineNumber };

    case 'sendKeys':
      return {
        action: 'sendKeys',
        selector: extractSelector(args),
        value: extractStringArg(args, 1),
        lineNumber,
      };

    case 'selectOptionByLabel':
      return {
        action: 'selectOption',
        selector: extractSelector(args),
        value: extractStringArg(args, 1),
        lineNumber,
      };

    case 'scrollToElement':
      return {
        action: 'scrollToElement',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'verifyMatch':
      return {
        action: 'verifyMatch',
        selector: extractSelector(args),
        value: extractStringArg(args, 1),
        lineNumber,
      };

    case 'selectDate':
      return {
        action: 'selectDate',
        selector: extractSelector(args),
        value: extractStringArg(args, 1),
        lineNumber,
      };

    case 'selectRandomDate':
      return {
        action: 'selectRandomDate',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'selectRandomDateAfter':
      return {
        action: 'selectRandomDateAfter',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'verifyNoServerError':
      return { action: 'verifyNoServerError', lineNumber };

    case 'switchToFrame':
      return {
        action: 'switchToFrame',
        selector: extractSelector(args),
        lineNumber,
      };

    case 'switchToDefaultContent':
      return { action: 'switchToDefaultContent', lineNumber };

    case 'takeScreenshot':
      return {
        action: 'takeScreenshot',
        value: extractStringArg(args, 0),
        lineNumber,
      };

    // Test case call
    case 'callTestCase': {
      const testCasePath = extractTestCasePath(args);
      if (!testCasePath) {
        return { action: 'unknown', value: 'callTestCase requires findTestCase argument', lineNumber };
      }
      return { action: 'callTestCase', testCasePath, lineNumber };
    }

    default:
      return {
        action: 'unknown',
        value: `Unknown method: WebUI.${method}`,
        lineNumber,
      };
  }
}
