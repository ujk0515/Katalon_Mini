import type { StepResult } from './execution';

// .suite 파일 포맷
export interface TestSuiteConfig {
  name: string;
  testCases: string[];       // TC 상대 경로 목록 (e.g. "Test Cases/login.groovy")
  stopOnFailure: boolean;    // true: 실패 시 중단, false: 전부 실행
}

// 스위트 실행 결과
export interface SuiteResult {
  suiteName: string;
  status: 'pass' | 'fail';
  startedAt: string;
  completedAt: string;
  duration: number;
  statistics: SuiteStatistics;
  testCaseResults: TestCaseResult[];
  context: SuiteContext;
}

export interface SuiteStatistics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TestCaseResult {
  name: string;
  path: string;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  startedAt: string;
  completedAt: string;
  duration: number;
  steps: StepResult[];
  error?: string;
}

export interface SuiteContext {
  hostName: string;
  os: string;
  browser?: string;
  viewport?: string;
  device?: string;
  platformVersion?: string;
  appPackage?: string;
}

// IPC 이벤트 타입
export interface SuiteTcStartEvent {
  index: number;
  total: number;
  name: string;
}

export interface SuiteTcCompleteEvent {
  index: number;
  name: string;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  duration: number;
  error?: string;
}

export interface SuiteCompleteEvent {
  result: SuiteResult;
  reportPath: string;
}
