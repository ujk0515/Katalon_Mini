import type { ProjectConfig, BrowserConfig, FileTreeNode } from './project';
import type { MobileConfig } from './mobile';
import type { ExecutionResult } from './execution';

// Project channels
export interface ProjectCreateRequest {
  name: string;
  type: 'web' | 'mobile';
  path: string;
}

export interface ProjectCreateResponse {
  success: boolean;
  projectPath: string;
  config: ProjectConfig;
}

// Script channels
export interface ScriptExecuteRequest {
  script: string;
  testCaseId: string;
  projectPath: string;
  projectType?: 'web' | 'mobile';
  browserConfig?: Partial<BrowserConfig>;
  mobileConfig?: Partial<MobileConfig>;
}

export interface ScriptLogEvent {
  step: number;
  total: number;
  command: string;
  status: 'running' | 'pass' | 'fail';
  lineNumber: number;
  duration?: number;
  error?: string;
}

export interface ScriptCompleteEvent {
  result: ExecutionResult;
}

// IPC Channel names
export const IPC_CHANNELS = {
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_GET_TREE: 'project:getTree',
  FILE_CREATE: 'file:create',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_RENAME: 'file:rename',
  FILE_DELETE: 'file:delete',
  FILE_MOVE: 'file:move',
  SCRIPT_EXECUTE: 'script:execute',
  SCRIPT_STOP: 'script:stop',
  SCRIPT_LOG: 'script:log',
  SCRIPT_COMPLETE: 'script:complete',
  SCRIPT_ERROR: 'script:error',
  SCRIPT_STOPPED: 'script:stopped',
  DIALOG_SELECT_DIR: 'dialog:selectDir',
  SUITE_EXECUTE: 'suite:execute',
  SUITE_STOP: 'suite:stop',
  SUITE_TC_START: 'suite:tcStart',
  SUITE_TC_COMPLETE: 'suite:tcComplete',
  SUITE_COMPLETE: 'suite:complete',
  SUITE_STOPPED: 'suite:stopped',
  SHELL_OPEN_PATH: 'shell:openPath',

  // Mobile channels
  DEVICE_LIST: 'device:list',
  DEVICE_REFRESH: 'device:refresh',
  DEVICE_SELECT: 'device:select',
  APPIUM_STATUS: 'appium:status',
  APPIUM_START: 'appium:start',
  APPIUM_STOP: 'appium:stop',
  DEVICE_DELETE: 'device:delete',
  DEVICE_HEALTH_CHECK: 'device:healthCheck',
  MOBILE_SAVE_CONFIG: 'mobile:saveConfig',

  // File Order
  FILE_ORDER_GET: 'fileOrder:get',
  FILE_ORDER_SET: 'fileOrder:set',

  // Recent Projects
  RECENT_PROJECTS_GET: 'recent:get',
  RECENT_PROJECTS_REMOVE: 'recent:remove',
} as const;
