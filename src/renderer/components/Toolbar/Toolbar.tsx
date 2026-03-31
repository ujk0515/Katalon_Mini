import React, { useEffect, useState } from 'react';
import { useExecutionStore, VIEWPORT_PRESETS } from '../../stores/executionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSuiteStore } from '../../stores/suiteStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { MobileSettings } from './MobileSettings';

export const Toolbar: React.FC = () => {
  const { isRunning, execute, stop, clearLogs, viewport, setViewport } = useExecutionStore();
  const { openTabs, activeTabId, getActiveContent } = useEditorStore();
  const { projectPath, config } = useProjectStore();
  const { isRunning: isSuiteRunning, executeSuite, stopSuite, reset: resetSuite } = useSuiteStore();
  const { devices, selectedUdid, selectDevice, deleteDevice, fetchDevices, refreshDevices, loading: deviceLoading } = useDeviceStore();
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ udid: string; name: string } | null>(null);

  const isMobile = config?.type === 'mobile';

  useEffect(() => {
    if (isMobile) {
      fetchDevices();
      // 실시간 기기 변경 수신
      const unsub = (window as any).electronAPI.onDeviceChanged((data: any) => {
        useDeviceStore.setState({
          devices: data.devices,
          selectedUdid: data.selectedUdid,
        });
      });
      return () => unsub();
    }
  }, [isMobile]);

  const activeTab = openTabs.find(t => t.id === activeTabId);
  const isSuiteFile = activeTab?.filePath?.endsWith('.suite');
  const running = isRunning || isSuiteRunning;

  const handleRun = async () => {
    if (isSuiteFile && activeTab) {
      resetSuite();
      clearLogs();
      await executeSuite(activeTab.filePath, projectPath || '', viewport);
    } else {
      const script = getActiveContent();
      if (!script.trim()) return;
      clearLogs();
      resetSuite();
      await execute(script, activeTabId || 'unknown', projectPath || '');
    }
  };

  const handleStop = () => {
    if (isSuiteRunning) {
      stopSuite();
    } else {
      stop();
    }
  };

  const currentPresetIndex = VIEWPORT_PRESETS.findIndex(p =>
    p.value === null
      ? viewport === null
      : viewport !== null && p.value?.width === viewport.width && p.value?.height === viewport.height
  );

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-km-toolbar border-b border-km-border">
      <button
        onClick={handleRun}
        disabled={running || !activeTabId}
        className="flex items-center gap-1 px-3 py-1 bg-km-success/20 border border-km-success/50 text-km-success rounded text-sm hover:bg-km-success/30 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span>{running ? '\u23F3' : '\u25B6'}</span>
        <span>{running ? 'Running...' : isSuiteFile ? 'Run Suite' : 'Run'}</span>
      </button>

      <button
        onClick={handleStop}
        disabled={!running}
        className="flex items-center gap-1 px-3 py-1 bg-km-error/20 border border-km-error/50 text-km-error rounded text-sm hover:bg-km-error/30 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span>{'\u25A0'}</span>
        <span>Stop</span>
      </button>

      <div className="w-px h-5 bg-km-border mx-1" />

      <button
        onClick={() => { clearLogs(); resetSuite(); }}
        className="px-3 py-1 text-km-text-dim text-sm hover:text-km-text"
      >
        Clear Log
      </button>

      <div className="w-px h-5 bg-km-border mx-1" />

      {isMobile ? (
        <div className="relative">
          <button
            onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
            disabled={running}
            className="px-2 py-1 bg-km-sidebar border border-km-border text-km-text text-xs rounded disabled:opacity-40 disabled:cursor-not-allowed min-w-[180px] text-left flex items-center justify-between"
          >
            <span>
              {selectedUdid
                ? devices.find(d => d.udid === selectedUdid)?.name || selectedUdid
                : 'Device: Select...'}
            </span>
            <span className="ml-2 text-[10px]">{showDeviceDropdown ? '\u25B4' : '\u25BE'}</span>
          </button>
          {showDeviceDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-km-sidebar border border-km-border rounded shadow-lg z-50 min-w-[220px]">
              <div
                onClick={() => { selectDevice(null); setShowDeviceDropdown(false); }}
                className="px-3 py-1.5 text-xs text-km-text-dim hover:bg-km-border/30 cursor-pointer"
              >
                Device: Select...
              </div>
              {devices.map((d) => (
                <div
                  key={d.udid}
                  className={`flex items-center justify-between px-3 py-1.5 text-xs hover:bg-km-border/30 cursor-pointer ${
                    d.udid === selectedUdid ? 'bg-km-accent/20 text-white' : 'text-km-text'
                  }`}
                >
                  <span
                    onClick={() => { selectDevice(d.udid); setShowDeviceDropdown(false); }}
                    className="flex-1"
                    title={d.driverDetail || ''}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                      d.status !== 'online' ? 'bg-gray-500' :
                      d.driverReady ? 'bg-green-400' : 'bg-yellow-400'
                    }`} />
                    {d.name} {d.platform === 'ios' ? '(iOS)' : '(AOS)'}
                    {d.driverDetail && !d.driverReady && d.status === 'online' && (
                      <span className="block text-[10px] text-km-error mt-0.5 pl-3">{d.driverDetail}</span>
                    )}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ udid: d.udid, name: d.name }); }}
                    className="ml-2 w-4 h-4 flex items-center justify-center text-km-text-dim hover:text-km-error text-[10px] rounded hover:bg-km-error/20"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* 드롭다운 외부 클릭 시 닫기 */}
          {showDeviceDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setShowDeviceDropdown(false)} />
          )}
          {/* 삭제 확인 팝업 */}
          {deleteTarget && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-km-sidebar border border-km-border rounded-lg p-5 w-80">
                <p className="text-km-text text-sm mb-4">
                  "{deleteTarget.name}" 기기를 삭제하시겠습니까?<br/>
                  <span className="text-km-text-dim text-xs">삭제 후 재연결 시 새 기기로 인식됩니다.</span>
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-3 py-1.5 text-km-text-dim text-sm hover:text-km-text"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => { deleteDevice(deleteTarget.udid); setDeleteTarget(null); setShowDeviceDropdown(false); }}
                    className="px-3 py-1.5 bg-km-error text-white text-sm rounded hover:bg-km-error/80"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <select
          value={currentPresetIndex >= 0 ? currentPresetIndex : 0}
          onChange={(e) => setViewport(VIEWPORT_PRESETS[Number(e.target.value)].value)}
          disabled={running}
          className="px-2 py-1 bg-km-sidebar border border-km-border text-km-text text-xs rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {VIEWPORT_PRESETS.map((preset, i) => (
            <option key={i} value={i}>{preset.label}</option>
          ))}
        </select>
      )}

      {isMobile && (
        <>
          <button
            onClick={() => refreshDevices()}
            disabled={running || deviceLoading}
            className="px-2 py-1 text-km-text-dim text-xs hover:text-km-text disabled:opacity-40"
            title="기기 새로고침 + 드라이버 상태 확인"
          >
            {deviceLoading ? '\u23F3' : '\u21BB'} Refresh
          </button>
          <button
            onClick={() => setShowMobileSettings(true)}
            className="px-2 py-1 text-km-text-dim text-xs hover:text-km-text"
          >
            Settings
          </button>
          <MobileSettings isOpen={showMobileSettings} onClose={() => setShowMobileSettings(false)} />
        </>
      )}
    </div>
  );
};
