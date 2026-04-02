import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';

interface MobileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSettings: React.FC<MobileSettingsProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig } = useProjectStore();
  const mobile = config?.mobileConfig;

  const [platform, setPlatform] = useState<'android' | 'ios'>(mobile?.platform || 'android');
  const [appPackage, setAppPackage] = useState(mobile?.appPackage || '');
  const [appActivity, setAppActivity] = useState(mobile?.appActivity || '');
  const [appiumPort, setAppiumPort] = useState(String(mobile?.appiumPort || 4723));
  const [noReset, setNoReset] = useState(mobile?.noReset ?? true);
  const [timeout, setTimeout_] = useState(String(mobile?.timeout || 30000));

  useEffect(() => {
    if (mobile) {
      setPlatform(mobile.platform || 'android');
      setAppPackage(mobile.appPackage || '');
      setAppActivity(mobile.appActivity || '');
      setAppiumPort(String(mobile.appiumPort || 4723));
      setNoReset(mobile.noReset ?? true);
      setTimeout_(String(mobile.timeout || 30000));
    }
  }, [mobile]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (config && updateConfig) {
      updateConfig({
        ...config,
        mobileConfig: {
          ...config.mobileConfig!,
          platform,
          appPackage,
          appActivity: appActivity || undefined,
          appiumPort: parseInt(appiumPort) || 4723,
          noReset,
          timeout: parseInt(timeout) || 30000,
        },
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-km-sidebar border border-km-border rounded-lg p-5 w-96" onClick={e => e.stopPropagation()}>
        <h3 className="text-km-text font-semibold mb-4">Mobile Settings</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-km-text-dim text-xs mb-1">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value as 'android' | 'ios')}
              className="w-full px-2 py-1.5 bg-km-bg border border-km-border text-km-text text-sm rounded"
            >
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </div>
          <div>
            <label className="block text-km-text-dim text-xs mb-1">{platform === 'ios' ? 'Bundle ID' : 'App Package'}</label>
            <input
              value={appPackage}
              onChange={e => setAppPackage(e.target.value)}
              placeholder="com.example.app"
              className="w-full px-2 py-1.5 bg-km-bg border border-km-border text-km-text text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-km-text-dim text-xs mb-1">App Activity (optional)</label>
            <input
              value={appActivity}
              onChange={e => setAppActivity(e.target.value)}
              placeholder="auto-detect"
              className="w-full px-2 py-1.5 bg-km-bg border border-km-border text-km-text text-sm rounded"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-km-text-dim text-xs mb-1">Appium Port</label>
              <input
                value={appiumPort}
                onChange={e => setAppiumPort(e.target.value)}
                className="w-full px-2 py-1.5 bg-km-bg border border-km-border text-km-text text-sm rounded"
              />
            </div>
            <div className="flex-1">
              <label className="block text-km-text-dim text-xs mb-1">Timeout (ms)</label>
              <input
                value={timeout}
                onChange={e => setTimeout_(e.target.value)}
                className="w-full px-2 py-1.5 bg-km-bg border border-km-border text-km-text text-sm rounded"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noReset}
              onChange={e => setNoReset(e.target.checked)}
              className="rounded"
            />
            <label className="text-km-text text-sm">No Reset (앱 데이터 유지)</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-km-text-dim text-sm hover:text-km-text">
            Cancel
          </button>
          <button onClick={handleSave} className="px-3 py-1.5 bg-km-accent text-white text-sm rounded hover:bg-km-accent/80">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
