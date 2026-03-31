import { create } from 'zustand';
import type { DeviceInfo } from '../../shared/types/mobile';
import { api } from '../ipc/ipcClient';

interface DeviceState {
  devices: DeviceInfo[];
  selectedUdid: string | null;
  adbAvailable: boolean;
  appiumInstalled: boolean;
  appiumRunning: boolean;
  installedDrivers: Record<string, boolean>;
  loading: boolean;

  fetchDevices: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (udid: string | null) => Promise<void>;
  deleteDevice: (udid: string) => Promise<void>;
  checkDeviceHealth: (udid: string) => Promise<{ driverReady: boolean; detail: string }>;
  fetchAppiumStatus: () => Promise<void>;
  startAppium: () => Promise<{ success: boolean; error?: string }>;
  stopAppium: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  selectedUdid: null,
  adbAvailable: false,
  appiumInstalled: false,
  appiumRunning: false,
  installedDrivers: {},
  loading: false,

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const result = await api().getDeviceList();
      set({
        devices: result.devices,
        selectedUdid: result.selectedUdid,
        adbAvailable: result.adbAvailable,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  refreshDevices: async () => {
    set({ loading: true });
    try {
      const result = await api().refreshDevices();
      set({
        devices: result.devices,
        selectedUdid: result.selectedUdid,
        adbAvailable: result.adbAvailable,
        installedDrivers: result.installedDrivers || {},
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  selectDevice: async (udid) => {
    await api().selectDevice(udid);
    set({ selectedUdid: udid });
  },

  deleteDevice: async (udid) => {
    await api().deleteDevice(udid);
    set((state) => ({
      devices: state.devices.filter(d => d.udid !== udid),
      selectedUdid: state.selectedUdid === udid ? null : state.selectedUdid,
    }));
  },

  checkDeviceHealth: async (udid) => {
    const result = await api().checkDeviceHealth(udid);
    // 결과를 devices 목록에 반영
    set((state) => ({
      devices: state.devices.map(d =>
        d.udid === udid ? { ...d, driverReady: result.driverReady } : d
      ),
      installedDrivers: result.installedDrivers || state.installedDrivers,
    }));
    return result;
  },

  fetchAppiumStatus: async () => {
    try {
      const result = await api().getAppiumStatus();
      set({
        appiumInstalled: result.installed,
        appiumRunning: result.running,
      });
    } catch {}
  },

  startAppium: async () => {
    const result = await api().startAppium();
    if (result.success) {
      set({ appiumRunning: true });
    }
    return result;
  },

  stopAppium: async () => {
    await api().stopAppium();
    set({ appiumRunning: false });
  },
}));
