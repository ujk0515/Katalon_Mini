import React from 'react';
import { useExecutionStore, VIEWPORT_PRESETS } from '../../stores/executionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSuiteStore } from '../../stores/suiteStore';

export const Toolbar: React.FC = () => {
  const { isRunning, execute, stop, clearLogs, viewport, setViewport } = useExecutionStore();
  const { openTabs, activeTabId, getActiveContent } = useEditorStore();
  const { projectPath } = useProjectStore();
  const { isRunning: isSuiteRunning, executeSuite, stopSuite, reset: resetSuite } = useSuiteStore();

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
    </div>
  );
};
