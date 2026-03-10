import { create } from 'zustand';
import type { SuiteResult, SuiteTcStartEvent, SuiteTcCompleteEvent } from '@shared/types/suite';
import type { BrowserConfig } from '@shared/types/project';
import type { LogEntry } from '@shared/types/execution';
import { api } from '../ipc/ipcClient';

interface TcProgress {
  index: number;
  name: string;
  status: 'running' | 'pass' | 'fail' | 'error' | 'skipped' | 'pending';
  logs: LogEntry[];
}

interface SuiteStore {
  isRunning: boolean;
  suiteResult: SuiteResult | null;
  reportPath: string | null;
  tcProgress: TcProgress[];

  executeSuite: (suitePath: string, projectPath: string, viewport: BrowserConfig['viewport']) => Promise<void>;
  stopSuite: () => void;
  onTcStart: (data: SuiteTcStartEvent) => void;
  onTcComplete: (data: SuiteTcCompleteEvent) => void;
  onStepLog: (data: any) => void;
  onSuiteComplete: (data: { result: SuiteResult; reportPath: string }) => void;
  reset: () => void;
}

export const useSuiteStore = create<SuiteStore>((set, get) => ({
  isRunning: false,
  suiteResult: null,
  reportPath: null,
  tcProgress: [],

  executeSuite: async (suitePath, projectPath, viewport) => {
    set({ isRunning: true, suiteResult: null, reportPath: null, tcProgress: [] });
    await api().executeSuite({ suitePath, projectPath, browserConfig: { viewport } });
  },

  stopSuite: () => {
    api().stopSuite();
  },

  onTcStart: (data) => {
    set(state => {
      const progress = [...state.tcProgress];
      progress[data.index] = { index: data.index, name: data.name, status: 'running', logs: [] };
      return { tcProgress: progress };
    });
  },

  onTcComplete: (data) => {
    set(state => {
      const progress = [...state.tcProgress];
      if (progress[data.index]) {
        progress[data.index] = { ...progress[data.index], status: data.status };
      }
      return { tcProgress: progress };
    });
  },

  onStepLog: (data) => {
    set(state => {
      const progress = [...state.tcProgress];
      const current = progress.find(p => p.status === 'running');
      if (current) {
        current.logs = [...current.logs, data];
      }
      return { tcProgress: progress };
    });
  },

  onSuiteComplete: (data) => {
    set({ isRunning: false, suiteResult: data.result, reportPath: data.reportPath });
  },

  reset: () => set({ isRunning: false, suiteResult: null, reportPath: null, tcProgress: [] }),
}));
