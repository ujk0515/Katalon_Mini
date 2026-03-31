import React, { useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useExecutionStore } from '../../stores/executionStore';
import { useDeviceStore } from '../../stores/deviceStore';

export const StatusBar: React.FC = () => {
  const { config } = useProjectStore();
  const { isRunning } = useExecutionStore();
  const { appiumRunning, appiumInstalled, selectedUdid, devices, fetchAppiumStatus } = useDeviceStore();

  const isMobile = config?.type === 'mobile';
  const selectedDevice = devices.find(d => d.udid === selectedUdid);

  useEffect(() => {
    if (isMobile) {
      fetchAppiumStatus();
    }
  }, [isMobile]);

  return (
    <div className="flex items-center justify-between px-3 py-0.5 bg-km-accent text-white text-xs">
      <div className="flex items-center gap-3">
        <span>{isRunning ? 'Running...' : 'Ready'}</span>
        {config && <span>{config.name} ({config.type})</span>}
        {isMobile && selectedDevice && (
          <span>{selectedDevice.name} ({selectedDevice.version})</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isMobile && (
          <span>
            Appium: {appiumRunning ? 'Running' : appiumInstalled ? 'Stopped' : 'Not Installed'}
          </span>
        )}
        <span>Script Automation v0.1.0</span>
      </div>
    </div>
  );
};
