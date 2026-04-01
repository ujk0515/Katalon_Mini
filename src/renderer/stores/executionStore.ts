import { create } from 'zustand';
import type { ExecutionResult, LogEntry } from '@shared/types/execution';
import type { BrowserConfig } from '@shared/types/project';
import { api } from '../ipc/ipcClient';
import { useProjectStore } from './projectStore';
import { useDeviceStore } from './deviceStore';

// Viewport presets for browser launch
export const VIEWPORT_PRESETS: { label: string; value: BrowserConfig['viewport'] }[] = [
  { label: '\uCC3D \uD06C\uAE30\uC5D0 \uB9DE\uCDA4', value: null },
  { label: '1280 \u00D7 720 (HD)', value: { width: 1280, height: 720 } },
  { label: '1920 \u00D7 1080 (FHD)', value: { width: 1920, height: 1080 } },
  { label: '1536 \u00D7 864', value: { width: 1536, height: 864 } },
];

interface ExecutionStore {
  isRunning: boolean;
  logs: LogEntry[];
  result: ExecutionResult | null;
  viewport: BrowserConfig['viewport'];

  execute: (script: string, testCaseId: string, projectPath: string) => Promise<void>;
  stop: () => void;
  clearLogs: () => void;
  addLog: (log: LogEntry) => void;
  setResult: (result: ExecutionResult) => void;
  setError: (error: any) => void;
  onStopped: () => void;
  setRunning: (running: boolean) => void;
  setViewport: (viewport: BrowserConfig['viewport']) => void;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  isRunning: false,
  logs: [],
  result: null,
  viewport: null,

  execute: async (script, testCaseId, projectPath) => {
    set({ isRunning: true, logs: [], result: null });
    const { viewport } = get();
    const projectConfig = useProjectStore.getState().config;
    const deviceState = useDeviceStore.getState();

    await api().executeScript({
      script,
      testCaseId,
      projectPath,
      projectType: projectConfig?.type,
      browserConfig: { viewport },
      mobileConfig: projectConfig?.type === 'mobile' ? {
        ...projectConfig.mobileConfig,
        deviceUdid: deviceState.selectedUdid || '',
        deviceName: deviceState.devices.find(d => d.udid === deviceState.selectedUdid)?.name || '',
        platform: deviceState.devices.find(d => d.udid === deviceState.selectedUdid)?.platform || 'android',
      } : undefined,
    });
  },

  stop: () => {
    api().stopScript();
  },

  onStopped: () => {
    const stoppedLog: LogEntry = {
      timestamp: new Date().toISOString(),
      step: 0,
      total: 0,
      command: '⏹ 사용자에 의해 스크립트 실행이 중지되었습니다',
      status: 'info' as any,
      lineNumber: 0,
    };
    set((state) => ({
      logs: [...state.logs, stoppedLog],
      isRunning: false,
      result: null,
    }));
  },

  clearLogs: () => set({ logs: [], result: null }),

  addLog: (log) => {
    set((state) => ({ logs: [...state.logs, log] }));
  },

  setResult: (result) => {
    set({ result, isRunning: false });
  },

  setError: (error) => {
    const errorLog: LogEntry = {
      timestamp: new Date().toISOString(),
      step: 0,
      total: 0,
      command: 'Error',
      status: 'fail',
      error: error.message || String(error),
      lineNumber: error.lineNumber || 0,
    };
    set((state) => ({
      logs: [...state.logs, errorLog],
      isRunning: false,
    }));
  },

  setRunning: (running) => set({ isRunning: running }),

  setViewport: (viewport) => set({ viewport }),
}));
