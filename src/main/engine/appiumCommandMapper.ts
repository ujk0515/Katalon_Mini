import type { AppiumCommand } from '../../shared/types/mobile';

type MobileMethodHandler = (args: any[]) => AppiumCommand;

function resolveSelector(testObjectPath: any): string {
  if (typeof testObjectPath !== 'string') return String(testObjectPath ?? '');
  if (testObjectPath.startsWith('xpath=')) return testObjectPath.substring(6);
  if (testObjectPath.startsWith('/')) return testObjectPath;
  return testObjectPath;
}

const MOBILE_METHOD_MAP: Record<string, MobileMethodHandler> = {
  // ─── App Lifecycle ───
  startExistingApplication: (args) => ({
    action: 'startApp',
    value: args[0],
    lineNumber: 0,
  }),
  closeApplication: () => ({
    action: 'closeApp',
    lineNumber: 0,
  }),

  // ─── Element Interaction ───
  tap: (args) => ({
    action: 'tap',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 0) * 1000,
    lineNumber: 0,
  }),
  setText: (args) => ({
    action: 'setText',
    selector: resolveSelector(args[0]),
    value: args[1],
    timeout: (args[2] ?? 0) * 1000,
    lineNumber: 0,
  }),

  // ─── Verification ───
  verifyElementExist: (args) => ({
    action: 'verifyExist',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 5) * 1000,
    lineNumber: 0,
  }),
  verifyElementVisible: (args) => ({
    action: 'verifyVisible',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 5) * 1000,
    lineNumber: 0,
  }),
  verifyElementNotExist: (args) => ({
    action: 'verifyNotExist',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 5) * 1000,
    lineNumber: 0,
  }),
  verifyElementText: (args) => ({
    action: 'verifyText',
    selector: resolveSelector(args[0]),
    value: args[1],
    timeout: (args[2] ?? 5) * 1000,
    lineNumber: 0,
  }),

  // ─── Wait / Get ───
  waitForElementPresent: (args) => ({
    action: 'verifyExist',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 30) * 1000,
    lineNumber: 0,
  }),
  waitForElementVisible: (args) => ({
    action: 'verifyVisible',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 30) * 1000,
    lineNumber: 0,
  }),
  getText: (args) => ({
    action: 'getText',
    selector: resolveSelector(args[0]),
    timeout: (args[1] ?? 10) * 1000,
    lineNumber: 0,
  }),

  // ─── Scroll / Swipe ───
  scrollToText: (args) => ({
    action: 'scrollToText',
    value: args[0],
    lineNumber: 0,
  }),
  swipe: (args) => ({
    action: 'swipe',
    lineNumber: 0,
    extra: { startX: args[0], startY: args[1], endX: args[2], endY: args[3] },
  }),

  // ─── Utility ───
  delay: (args) => ({
    action: 'delay',
    timeout: (args[0] ?? 1) * 1000,
    lineNumber: 0,
  }),
  comment: (args) => ({
    action: 'comment',
    value: args[0] ?? '',
    lineNumber: 0,
  }),
  getAttribute: (args) => ({
    action: 'getAttribute',
    selector: resolveSelector(args[0]),
    value: args[1],
    lineNumber: 0,
  }),
  getDeviceHeight: () => ({
    action: 'getDeviceHeight',
    lineNumber: 0,
  }),
  getDeviceWidth: () => ({
    action: 'getDeviceWidth',
    lineNumber: 0,
  }),
  toggleAirplaneMode: (args) => ({
    action: 'toggleAirplaneMode',
    value: args[0],
    lineNumber: 0,
  }),

  // ─── Advanced ───
  takeScreenshot: (args) => ({
    action: 'takeScreenshot',
    value: args[0],
    lineNumber: 0,
  }),
  hideKeyboard: () => ({
    action: 'hideKeyboard',
    lineNumber: 0,
  }),
  getPageSource: () => ({
    action: 'getPageSource',
    lineNumber: 0,
  }),
  getContexts: () => ({
    action: 'getContexts',
    lineNumber: 0,
  }),
  switchToContext: (args) => ({
    action: 'setContext',
    value: args[0],
    lineNumber: 0,
  }),
};

export function mapMobileCommand(method: string, args: any[], lineNumber: number): AppiumCommand {
  const handler = MOBILE_METHOD_MAP[method];
  if (!handler) {
    return { action: 'unknown', value: `Unknown Mobile method: ${method}`, lineNumber };
  }
  const cmd = handler(args);
  cmd.lineNumber = lineNumber;
  return cmd;
}
