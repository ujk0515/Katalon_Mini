import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { DeviceInfo, DeviceStore } from '../../shared/types/mobile';

const STORE_FILENAME = 'devices.json';

export class DeviceManager {
  private store: DeviceStore;
  private storePath: string;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private onChangeCallback: ((devices: DeviceInfo[]) => void) | null = null;

  constructor() {
    this.storePath = path.join(app.getPath('userData'), STORE_FILENAME);
    this.store = this.loadStore();
  }

  // ─── Device Detection ───

  detectDevices(): DeviceInfo[] {
    const devices: DeviceInfo[] = [];

    // Android (ADB)
    devices.push(...this.detectAndroidDevices());

    // iOS (macOS only, Mopath 참고: device_connection_manager.dart:130-228)
    if (process.platform === 'darwin') {
      devices.push(...this.detectIosDevices());
    }

    return devices;
  }

  private detectAndroidDevices(): DeviceInfo[] {
    try {
      const output = execSync('adb devices -l', { stdio: 'pipe', timeout: 5000, env: this.getEnv() }).toString();
      const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('List'));
      const devices: DeviceInfo[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;

        const udid = parts[0];
        const status = parts[1] === 'device' ? 'online' : 'offline';

        if (status === 'online') {
          const name = this.getDeviceProp(udid, 'ro.product.model') || udid;
          const version = this.getDeviceProp(udid, 'ro.build.version.release') || '';
          const manufacturer = this.getDeviceProp(udid, 'ro.product.manufacturer') || '';

          devices.push({
            udid, name, platform: 'android', version, manufacturer, status,
            lastSeen: new Date().toISOString(),
          });
        } else {
          const existing = this.store.android.find(d => d.udid === udid);
          devices.push({
            udid,
            name: existing?.name || udid,
            platform: 'android',
            version: existing?.version || '',
            manufacturer: existing?.manufacturer || '',
            status: 'offline',
            lastSeen: existing?.lastSeen || new Date().toISOString(),
          });
        }
      }
      return devices;
    } catch {
      return [];
    }
  }

  // iOS 감지 (Mopath 참고: device_connection_manager.dart:130-228)
  // 1차: idevice_id (libimobiledevice), 2차: xcrun devicectl (Xcode 15+)
  private detectIosDevices(): DeviceInfo[] {
    // 1차: libimobiledevice
    const fromLibimobile = this.detectIosViaLibimobiledevice();
    if (fromLibimobile.length > 0) return fromLibimobile;

    // 2차: xcrun devicectl
    return this.detectIosViaDevicectl();
  }

  private detectIosViaLibimobiledevice(): DeviceInfo[] {
    try {
      const output = execSync('idevice_id -l', { stdio: 'pipe', timeout: 5000 }).toString().trim();
      if (!output) return [];

      const udids = output.split('\n').filter(u => u.trim());
      return udids.map(udid => {
        const name = this.getIosDeviceInfo(udid, 'DeviceName');
        const version = this.getIosDeviceInfo(udid, 'ProductVersion');
        return {
          udid: udid.trim(),
          name: name || udid.trim(),
          platform: 'ios' as const,
          version,
          manufacturer: 'Apple',
          status: 'online' as const,
          lastSeen: new Date().toISOString(),
        };
      });
    } catch {
      return [];
    }
  }

  private detectIosViaDevicectl(): DeviceInfo[] {
    try {
      const tmpPath = `/tmp/devicectl_${Date.now()}.json`;
      execSync(`xcrun devicectl list devices --json-output ${tmpPath}`, {
        stdio: 'pipe', timeout: 10000,
      });

      const content = fs.readFileSync(tmpPath, 'utf-8');
      fs.unlinkSync(tmpPath);
      const json = JSON.parse(content);
      const devices: DeviceInfo[] = [];

      for (const device of (json.result?.devices || [])) {
        // USB(wired)만 (Mopath 참고: WiFi 기기 제외)
        const transport = device.connectionProperties?.transportType || '';
        if (transport !== 'wired') continue;

        const udid = device.hardwareProperties?.udid;
        if (!udid) continue;

        devices.push({
          udid,
          name: device.deviceProperties?.name || udid,
          platform: 'ios',
          version: device.deviceProperties?.osVersionNumber || '',
          manufacturer: 'Apple',
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      }
      return devices;
    } catch {
      return [];
    }
  }

  private getIosDeviceInfo(udid: string, key: string): string {
    try {
      return execSync(`ideviceinfo -u ${udid} -k ${key}`, {
        stdio: 'pipe', timeout: 3000,
      }).toString().trim();
    } catch {
      return '';
    }
  }

  private getDeviceProp(udid: string, prop: string): string {
    try {
      // ADB 인젝션 방지: udid/prop에서 위험 문자 제거
      const safeUdid = udid.replace(/[^a-zA-Z0-9._:-]/g, '');
      const safeProp = prop.replace(/[^a-zA-Z0-9._]/g, '');
      return execSync(`adb -s ${safeUdid} shell getprop ${safeProp}`, {
        stdio: 'pipe',
        timeout: 3000,
        env: this.getEnv(),
      }).toString().trim();
    } catch {
      return '';
    }
  }

  // ─── Polling ───

  startPolling(intervalMs: number = 3000): void {
    this.stopPolling();
    this.refresh();
    this.pollingTimer = setInterval(() => this.refresh(), intervalMs);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  onChange(callback: (devices: DeviceInfo[]) => void): void {
    this.onChangeCallback = callback;
  }

  // ─── Store Operations ───

  refresh(): DeviceInfo[] {
    const detected = this.detectDevices();
    const androidDetected = detected.filter(d => d.platform === 'android');
    const iosDetected = detected.filter(d => d.platform === 'ios');

    // Android merge (driverReady/driverDetail 보존)
    const androidMerged = new Map<string, DeviceInfo>();
    for (const d of this.store.android) {
      androidMerged.set(d.udid, { ...d, status: 'offline' });
    }
    for (const d of androidDetected) {
      const existing = androidMerged.get(d.udid);
      androidMerged.set(d.udid, {
        ...d,
        driverReady: existing?.driverReady,
        driverDetail: existing?.driverDetail,
      });
    }

    // iOS merge (driverReady/driverDetail 보존)
    const iosMerged = new Map<string, DeviceInfo>();
    for (const d of this.store.ios) {
      iosMerged.set(d.udid, { ...d, status: 'offline' });
    }
    for (const d of iosDetected) {
      const existing = iosMerged.get(d.udid);
      iosMerged.set(d.udid, {
        ...d,
        driverReady: existing?.driverReady,
        driverDetail: existing?.driverDetail,
      });
    }

    this.store.android = Array.from(androidMerged.values());
    this.store.ios = Array.from(iosMerged.values());
    this.store.lastUpdated = new Date().toISOString();
    this.saveStore();

    const allDevices = [...this.store.android, ...this.store.ios];
    if (this.onChangeCallback) {
      this.onChangeCallback(allDevices);
    }

    return allDevices;
  }

  getDevices(): DeviceInfo[] {
    return [...this.store.android, ...this.store.ios];
  }

  getAndroidDevices(): DeviceInfo[] {
    return this.store.android;
  }

  getIosDevices(): DeviceInfo[] {
    return this.store.ios;
  }

  getSelectedUdid(): string | null {
    return this.store.selectedUdid;
  }

  selectDevice(udid: string | null): void {
    this.store.selectedUdid = udid;
    this.saveStore();
  }

  deleteDevice(udid: string): void {
    this.store.android = this.store.android.filter(d => d.udid !== udid);
    this.store.ios = this.store.ios.filter(d => d.udid !== udid);
    if (this.store.selectedUdid === udid) {
      this.store.selectedUdid = null;
    }
    this.saveStore();
  }

  getSelectedDevice(): DeviceInfo | null {
    if (!this.store.selectedUdid) return null;
    return this.getDevices().find(d => d.udid === this.store.selectedUdid) || null;
  }

  isAdbAvailable(): boolean {
    try {
      execSync('adb version', { stdio: 'pipe', timeout: 3000, env: this.getEnv() });
      return true;
    } catch {
      return false;
    }
  }

  /** 디바이스 헬스체크: 드라이버 설치 상태 + 실제 통신 가능 여부 확인 */
  async checkDeviceHealth(udid: string, installedDrivers: Record<string, boolean>): Promise<{
    driverReady: boolean;
    detail: string;
  }> {
    const device = this.getDevices().find(d => d.udid === udid);
    if (!device) return { driverReady: false, detail: '디바이스를 찾을 수 없습니다.' };
    if (device.status === 'offline') return { driverReady: false, detail: '디바이스가 오프라인입니다.' };

    if (device.platform === 'ios') {
      // 1. xcuitest 드라이버 확인
      if (!installedDrivers.xcuitest) {
        return { driverReady: false, detail: 'XCUITest 드라이버 미설치. Appium에서 xcuitest 드라이버를 설치해주세요.' };
      }
      // 2. iOS 기기 페어링/신뢰 확인
      try {
        execSync(`ideviceinfo -u ${udid} -k DeviceName`, { stdio: 'pipe', timeout: 5000, env: this.getEnv() });
      } catch {
        // fallback: xcrun으로 확인
        try {
          const tmpPath = `/tmp/health_${Date.now()}.json`;
          execSync(`xcrun devicectl list devices --json-output ${tmpPath}`, { stdio: 'pipe', timeout: 10000 });
          const content = fs.readFileSync(tmpPath, 'utf-8');
          fs.unlinkSync(tmpPath);
          const json = JSON.parse(content);
          const found = (json.result?.devices || []).some((d: any) => d.hardwareProperties?.udid === udid);
          if (!found) return { driverReady: false, detail: 'iOS 기기와 통신 불가. USB 연결 및 "이 컴퓨터를 신뢰" 설정을 확인해주세요.' };
        } catch {
          return { driverReady: false, detail: 'iOS 기기와 통신 불가. Xcode 및 libimobiledevice 설치를 확인해주세요.' };
        }
      }
      return { driverReady: true, detail: 'iOS 기기 준비 완료 (XCUITest)' };
    } else {
      // Android
      if (!installedDrivers.uiautomator2) {
        return { driverReady: false, detail: 'UiAutomator2 드라이버 미설치. Appium에서 uiautomator2 드라이버를 설치해주세요.' };
      }
      // ADB 통신 확인
      try {
        const safeUdid = udid.replace(/[^a-zA-Z0-9._:-]/g, '');
        execSync(`adb -s ${safeUdid} shell echo ok`, { stdio: 'pipe', timeout: 5000, env: this.getEnv() });
      } catch {
        return { driverReady: false, detail: 'Android 기기와 ADB 통신 불가. USB 디버깅을 확인해주세요.' };
      }
      return { driverReady: true, detail: 'Android 기기 준비 완료 (UiAutomator2)' };
    }
  }

  /** 모든 온라인 기기의 driverReady 상태를 업데이트 */
  async updateDriverReadiness(installedDrivers: Record<string, boolean>): Promise<DeviceInfo[]> {
    const allDevices = this.getDevices();
    for (const device of allDevices) {
      if (device.status === 'online') {
        const health = await this.checkDeviceHealth(device.udid, installedDrivers);
        device.driverReady = health.driverReady;
        device.driverDetail = health.detail;
      } else {
        device.driverReady = false;
        device.driverDetail = '오프라인';
      }
    }
    this.store.android = allDevices.filter(d => d.platform === 'android');
    this.store.ios = allDevices.filter(d => d.platform === 'ios');
    this.saveStore();
    return allDevices;
  }

  /** 외부에서 계산한 헬스 결과를 스토어에 반영 */
  applyHealthResults(devices: DeviceInfo[]): void {
    this.store.android = devices.filter(d => d.platform === 'android');
    this.store.ios = devices.filter(d => d.platform === 'ios');
    this.saveStore();
  }

  private getEnv(): NodeJS.ProcessEnv {
    const isWin = process.platform === 'win32';
    const pathSep = isWin ? ';' : ':';
    const env = { ...process.env };
    // Windows: 환경변수 키가 'Path'일 수 있음
    const pathKey = isWin
      ? (Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'Path')
      : 'PATH';

    if (!env.ANDROID_HOME) {
      const candidates = isWin
        ? [
            `${process.env.LOCALAPPDATA || ''}\\Android\\Sdk`,
            `${process.env.USERPROFILE || ''}\\AppData\\Local\\Android\\Sdk`,
          ]
        : [
            `${process.env.HOME || ''}/Library/Android/sdk`,
            `${process.env.HOME || ''}/Android/Sdk`,
          ];
      for (const c of candidates) {
        if (c && fs.existsSync(c)) {
          env.ANDROID_HOME = c;
          const ptDir = isWin ? `${c}\\platform-tools` : `${c}/platform-tools`;
          env[pathKey] = `${ptDir}${pathSep}${env[pathKey]}`;
          break;
        }
      }
    } else {
      const ptDir = isWin ? `${env.ANDROID_HOME}\\platform-tools` : `${env.ANDROID_HOME}/platform-tools`;
      env[pathKey] = `${ptDir}${pathSep}${env[pathKey]}`;
    }

    if (process.platform === 'darwin') {
      env[pathKey] = `/opt/homebrew/bin:/usr/local/bin:${env[pathKey]}`;
    } else if (isWin) {
      const appData = process.env.APPDATA || '';
      if (appData) {
        env[pathKey] = `${appData}\\npm${pathSep}${env[pathKey]}`;
      }
    }

    return env;
  }

  // ─── Persistence ───

  private loadStore(): DeviceStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf-8');
        const raw = JSON.parse(content);
        // 기존 형식(devices: []) → 새 형식(android/ios 분리) 마이그레이션
        if (raw.devices && !raw.android) {
          const android = (raw.devices as DeviceInfo[]).filter(d => d.platform !== 'ios');
          const ios = (raw.devices as DeviceInfo[]).filter(d => d.platform === 'ios');
          return { android, ios, selectedUdid: raw.selectedUdid || null, lastUpdated: raw.lastUpdated || new Date().toISOString() };
        }
        return {
          android: raw.android || [],
          ios: raw.ios || [],
          selectedUdid: raw.selectedUdid || null,
          lastUpdated: raw.lastUpdated || new Date().toISOString(),
        };
      }
    } catch {}
    return { android: [], ios: [], selectedUdid: null, lastUpdated: new Date().toISOString() };
  }

  private saveStore(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch {}
  }
}
