export interface ExecutionResult {
  testCaseId: string;
  testCaseName: string;
  status: 'pass' | 'fail' | 'error';
  startedAt: string;
  completedAt: string;
  duration: number;
  steps: StepResult[];
  error?: ExecutionError;
}

export interface StepResult {
  index: number;
  command: string;
  args: string[];
  status: 'pass' | 'fail' | 'error';
  duration: number;
  screenshot?: string;
  error?: string;
  lineNumber: number;
}

export interface ExecutionError {
  message: string;
  lineNumber: number;
  column: number;
  type: 'parse' | 'runtime' | 'timeout' | 'element_not_found';
}

export interface LogEntry {
  timestamp: string;
  step: number;
  total: number;
  command: string;
  status: 'running' | 'pass' | 'fail';
  duration?: number;
  error?: string;
  lineNumber: number;
}
