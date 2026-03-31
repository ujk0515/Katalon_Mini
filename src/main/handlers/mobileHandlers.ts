import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { DeviceManager } from '../services/deviceManager';
import { AppiumService } from '../services/appiumService';
import type { DeviceInfo } from '../../shared/types/mobile';

let deviceManager: DeviceManager | null = null;
let appiumService: AppiumService | null = null;

// 이전 온라인 기기 UDID 추적 (새 연결 감지용)
let previousOnlineUdids: Set<string> = new Set();
let healthCheckRunning = false;

/** 전체 헬스체크 플로우: 드라이버 설치 → 서버 시작 → 세션 연결 시도 */
async function runFullHealthCheck(devices: DeviceInfo[]): Promise<DeviceInfo[]> {
  const onlineDevices = devices.filter(d => d.status === 'online');

  // ─── Step 1: 드라이버 확인 + 자동 설치 ───
  let installedDrivers = appiumService!.getInstalledDrivers();
  const hasIos = onlineDevices.some(d => d.platform === 'ios');
  const hasAndroid = onlineDevices.some(d => d.platform === 'android');

  let driverChanged = false;
  if (hasIos && !installedDrivers.xcuitest) {
    await appiumService!.ensureDriverInstalled('ios');
    driverChanged = true;
  }
  if (hasAndroid && !installedDrivers.uiautomator2) {
    await appiumService!.ensureDriverInstalled('android');
    driverChanged = true;
  }
  if (driverChanged) {
    installedDrivers = appiumService!.getInstalledDrivers();
  }

  // ─── Step 2: Appium 서버 시작 (실패해도 계속 진행) ───
  let serverOk = false;
  if (onlineDevices.length > 0) {
    try {
      const platform = hasIos ? 'ios' : 'android';
      await appiumService!.ensureServerRunning(platform);
      serverOk = true;
    } catch (err: any) {
      console.error('[DEVICE_REFRESH] Appium 서버 시작 실패:', err.message);
      // 서버 못 띄워도 기기 목록은 반환
      for (const d of onlineDevices) {
        d.driverReady = false;
        d.driverDetail = `Appium 서버 시작 실패: ${(err.message || '').slice(0, 80)}`;
      }
    }
  }

  // ─── Step 3: 온라인 기기별 실제 세션 연결 시도 (서버 떠있을 때만) ───
  for (const device of (serverOk ? onlineDevices : [])) {
    const isIos = device.platform === 'ios';
    const driverOk = isIos ? installedDrivers.xcuitest : installedDrivers.uiautomator2;
    if (!driverOk) {
      device.driverReady = false;
      device.driverDetail = isIos ? 'xcuitest 드라이버 미설치' : 'uiautomator2 드라이버 미설치';
      continue;
    }

    const testConfig = {
      platform: device.platform as 'android' | 'ios',
      appPackage: '',
      deviceUdid: device.udid,
      deviceName: device.name,
      platformVersion: device.version,
      appiumPort: 4723,
      automationName: isIos ? 'XCUITest' : 'UiAutomator2',
      noReset: true,
      timeout: 30000,
    };

    // 최대 3회 재시도 (신뢰/VPN 허용 대기)
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await appiumService!.createSession(testConfig);
        device.driverReady = true;
        device.driverDetail = isIos ? 'WDA 연결 성공' : 'UiAutomator2 연결 성공';
        await appiumService!.deleteSession();
        break;
      } catch (err: any) {
        const msg = (err?.message || String(err)).toLowerCase();
        const isTrustError = msg.includes('untrusted') || msg.includes('not trusted')
          || msg.includes('trust') || msg.includes('vpn')
          || msg.includes('unable to launch') || msg.includes('xcodebuild failed')
          || msg.includes('webdriveragent');

        if (isTrustError && attempt < MAX_RETRIES) {
          // 신뢰 관련 에러 → UI에 안내 표시 후 재시도
          device.driverReady = false;
          device.driverDetail = `설정 > 일반 > VPN 및 기기 관리 > 개발자 앱 신뢰 필요 (재시도 ${attempt}/${MAX_RETRIES})`;
          deviceManager!.applyHealthResults(devices);
          broadcastDevices();
          // 10초 대기 후 재시도 (사용자가 기기에서 신뢰 설정할 시간)
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }

        // 최종 실패 또는 신뢰 외 에러
        device.driverReady = false;
        const rawMsg = err?.message || String(err);
        if (rawMsg.includes('WebDriverAgent') || rawMsg.includes('unable to launch')) {
          device.driverDetail = '설정 > 일반 > VPN 및 기기 관리에서 개발자 앱을 신뢰해주세요';
        } else if (rawMsg.includes('xcodebuild')) {
          device.driverDetail = 'Xcode 빌드 실패 - WDA 프로젝트 수동 빌드 필요';
        } else if (rawMsg.includes('not trusted') || rawMsg.includes('untrusted')) {
          device.driverDetail = '설정 > 일반 > VPN 및 기기 관리에서 개발자 앱을 신뢰해주세요';
        } else if (rawMsg.includes('Could not determine iOS SDK')) {
          device.driverDetail = 'iOS SDK 미발견 - Xcode 설치 확인';
        } else {
          device.driverDetail = rawMsg.length > 100 ? rawMsg.substring(0, 100) + '...' : rawMsg;
        }
        break;
      }
    }
  }

  // 오프라인 기기
  for (const device of devices.filter(d => d.status === 'offline')) {
    device.driverReady = false;
    device.driverDetail = '오프라인';
  }

  // 스토어에 반영
  deviceManager!.applyHealthResults(devices);
  return devices;
}

/** 모든 렌더러에 기기 상태 브로드캐스트 */
function broadcastDevices() {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    win.webContents.send('device:changed', {
      devices: deviceManager!.getDevices(),
      selectedUdid: deviceManager!.getSelectedUdid(),
    });
  }
}

export function registerMobileHandlers() {
  deviceManager = new DeviceManager();
  appiumService = new AppiumService();

  // 기기 변경 시: 새 기기 연결 감지 → 자동 헬스체크
  deviceManager.onChange((devices) => {
    const currentOnlineUdids = new Set(
      devices.filter(d => d.status === 'online').map(d => d.udid)
    );

    // 새로 온라인된 기기 있는지 체크
    const newDevices = [...currentOnlineUdids].filter(udid => !previousOnlineUdids.has(udid));
    previousOnlineUdids = currentOnlineUdids;

    // 일단 기본 상태 브로드캐스트 (UI에 온라인/오프라인 즉시 반영)
    broadcastDevices();

    // 새 기기 감지 시 자동 헬스체크 (중복 실행 방지)
    if (newDevices.length > 0 && !healthCheckRunning) {
      healthCheckRunning = true;
      runFullHealthCheck(devices)
        .then(() => {
          broadcastDevices(); // 헬스체크 결과 반영
        })
        .catch(() => {})
        .finally(() => {
          healthCheckRunning = false;
        });
    }
  });

  // Start device polling
  deviceManager.startPolling(3000);

  // ─── Device Handlers ───

  ipcMain.handle(IPC_CHANNELS.DEVICE_LIST, async () => {
    return {
      devices: deviceManager!.getDevices(),
      selectedUdid: deviceManager!.getSelectedUdid(),
      adbAvailable: deviceManager!.isAdbAvailable(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.DEVICE_REFRESH, async () => {
    const devices = deviceManager!.refresh();
    const result = await runFullHealthCheck(devices);
    broadcastDevices();
    return {
      devices: result,
      selectedUdid: deviceManager!.getSelectedUdid(),
      adbAvailable: deviceManager!.isAdbAvailable(),
      installedDrivers: appiumService!.getInstalledDrivers(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.DEVICE_SELECT, async (_event, udid: string | null) => {
    deviceManager!.selectDevice(udid);
    return { success: true, selectedUdid: udid };
  });

  ipcMain.handle(IPC_CHANNELS.DEVICE_DELETE, async (_event, udid: string) => {
    deviceManager!.deleteDevice(udid);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DEVICE_HEALTH_CHECK, async (_event, udid: string) => {
    const installedDrivers = appiumService!.getInstalledDrivers();
    const result = await deviceManager!.checkDeviceHealth(udid, installedDrivers);
    return { ...result, installedDrivers };
  });

  // ─── Appium Handlers ───

  ipcMain.handle(IPC_CHANNELS.APPIUM_STATUS, async () => {
    const installed = await appiumService!.isInstalled();
    const running = await appiumService!.isServerRunning();
    return { installed, running };
  });

  ipcMain.handle(IPC_CHANNELS.APPIUM_START, async () => {
    try {
      await appiumService!.ensureServerRunning();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.APPIUM_STOP, async () => {
    await appiumService!.stopServer();
    return { success: true };
  });

  // ─── Mobile Config ───

  ipcMain.handle(IPC_CHANNELS.MOBILE_SAVE_CONFIG, async (_event, args) => {
    return { success: true };
  });
}

export function stopMobileHandlers() {
  if (deviceManager) {
    deviceManager.stopPolling();
  }
  if (appiumService) {
    appiumService.stopServer();
  }
}
