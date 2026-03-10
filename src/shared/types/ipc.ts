import type { ProjectConfig, BrowserConfig, FileTreeNode } from './project';
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
  browserConfig?: Partial<BrowserConfig>;
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
  SCRIPT_EXECUTE: 'script:execute',
  SCRIPT_STOP: 'script:stop',
  SCRIPT_LOG: 'script:log',
  SCRIPT_COMPLETE: 'script:complete',
  SCRIPT_ERROR: 'script:error',
  DIALOG_SELECT_DIR: 'dialog:selectDir',
  SUITE_EXECUTE: 'suite:execute',
  SUITE_STOP: 'suite:stop',
  SUITE_TC_START: 'suite:tcStart',
  SUITE_TC_COMPLETE: 'suite:tcComplete',
  SUITE_COMPLETE: 'suite:complete',
  SHELL_OPEN_PATH: 'shell:openPath',
} as const;
