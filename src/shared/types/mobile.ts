// ─── Mobile Automation Types ───

export interface MobileConfig {
  platform: 'android' | 'ios';
  appPackage: string;       // Android: com.example.app
  bundleId?: string;        // iOS: com.example.app
  appActivity?: string;
  deviceUdid: string;
  deviceName: string;
  platformVersion?: string;
  appiumPort: number;
  automationName: string;   // Android: UiAutomator2, iOS: XCUITest
  noReset: boolean;
  timeout: number;
}

export const DEFAULT_MOBILE_CONFIG: MobileConfig = {
  platform: 'android',
  appPackage: '',
  deviceUdid: '',
  deviceName: '',
  appiumPort: 4723,
  automationName: 'UiAutomator2',
  noReset: true,
  timeout: 30000,
};

export interface DeviceInfo {
  udid: string;
  name: string;
  platform: 'android' | 'ios';
  version: string;
  manufacturer: string;
  status: 'online' | 'offline';
  driverReady?: boolean;    // true if automation driver (WDA/UiAutomator2) is confirmed working
  driverDetail?: string;    // 연결 상태 상세 (에러 메시지 등)
  lastSeen: string;
}

export interface DeviceStore {
  android: DeviceInfo[];
  ios: DeviceInfo[];
  selectedUdid: string | null;
  lastUpdated: string;
}

export interface AppiumCommand {
  action: string;
  selector?: string;
  value?: string;
  timeout?: number;
  lineNumber: number;
  extra?: Record<string, any>;
}
