import React, { useEffect, useRef, useState } from 'react';
import { useExecutionStore } from '../../stores/executionStore';
import { useSuiteStore } from '../../stores/suiteStore';
import { useProjectStore } from '../../stores/projectStore';
import { api } from '../../ipc/ipcClient';

export const LogPanel: React.FC = () => {
  const { logs, result, isRunning } = useExecutionStore();
  const { tcProgress, suiteResult, reportPath, isRunning: isSuiteRunning } = useSuiteStore();
  const { projectPath } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedTcs, setExpandedTcs] = useState<Set<number>>(new Set());

  const isSuiteMode = tcProgress.length > 0 || suiteResult !== null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, tcProgress]);

  // Auto-expand running TC
  useEffect(() => {
    const runningIdx = tcProgress.findIndex(p => p?.status === 'running');
    if (runningIdx >= 0) {
      setExpandedTcs(prev => new Set(prev).add(runningIdx));
    }
  }, [tcProgress]);

  const toggleTc = (idx: number) => {
    setExpandedTcs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return '\u2705';
      case 'fail': case 'error': return '\u274C';
      case 'running': return '\u23F3';
      case 'skipped': return '\u23ED\uFE0F';
      default: return '\u2B24';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-km-success';
      case 'fail': case 'error': return 'text-km-error';
      case 'running': return 'text-km-warning';
      default: return 'text-km-text-dim';
    }
  };

  const running = isRunning || isSuiteRunning;

  return (
    <div className="h-48 bg-km-bg border-t border-km-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 bg-km-toolbar border-b border-km-border">
        <span className="text-xs font-semibold text-km-text-dim uppercase tracking-wider">
          {isSuiteMode ? 'Suite Execution Log' : 'Execution Log'}
        </span>
        {running && (
          <span className="text-xs text-km-warning animate-pulse">Running...</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {!isSuiteMode && logs.length === 0 && (
          <div className="text-km-text-dim text-center py-4">
            Click Run to execute the script
          </div>
        )}

        {/* Suite Mode: TC group display */}
        {isSuiteMode && tcProgress.map((tc, i) => {
          if (!tc) return null;
          const isExpanded = expandedTcs.has(i);
          return (
            <div key={i} className="mb-1">
              <div
                onClick={() => toggleTc(i)}
                className={`flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-km-border/30 rounded ${getStatusColor(tc.status)}`}
              >
                <span className="text-[10px]">{isExpanded ? '\u25BE' : '\u25B8'}</span>
                <span>{getStatusIcon(tc.status)}</span>
                <span className="font-semibold">TC {i + 1}: {tc.name}</span>
                {tc.status !== 'running' && tc.status !== 'pending' && (
                  <span className="text-km-text-dim ml-auto">{tc.status}</span>
                )}
              </div>
              {isExpanded && tc.logs.map((log, j) => (
                <div key={j} className={`flex gap-2 py-0.5 pl-6 ${getStatusColor(log.status)}`}>
                  <span className="w-5 text-center">{getStatusIcon(log.status)}</span>
                  <span className="text-km-text-dim w-12">[{log.step}/{log.total}]</span>
                  <span className="flex-1">{log.command}</span>
                  {log.duration !== undefined && (
                    <span className="text-km-text-dim w-16 text-right">{(log.duration / 1000).toFixed(1)}s</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {/* Suite result summary */}
        {suiteResult && (
          <div className={`mt-2 pt-2 border-t border-km-border font-semibold ${
            suiteResult.status === 'pass' ? 'text-km-success' : 'text-km-error'
          }`}>
            Suite Result: {suiteResult.status === 'pass' ? '성공' : '실패'} ({suiteResult.statistics.passed}/{suiteResult.statistics.total} 성공
            {suiteResult.statistics.failed > 0 && `, ${suiteResult.statistics.failed} 실패`}
            {suiteResult.statistics.skipped > 0 && `, ${suiteResult.statistics.skipped} 스킵`}
            ) - {(suiteResult.duration / 1000).toFixed(1)}s
          </div>
        )}

        {/* Report path + open button */}
        {reportPath && projectPath && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-km-text-dim">리포트: {reportPath}</span>
            <button
              onClick={() => api().openPath(`${projectPath}/${reportPath}`.replace(/\//g, '\\'))}
              className="px-2 py-0.5 bg-km-accent/20 border border-km-accent/50 text-km-accent rounded hover:bg-km-accent/30"
            >
              리포트 열기
            </button>
          </div>
        )}

        {/* Single TC mode */}
        {!isSuiteMode && logs.map((log, i) => (
          <div key={i} className={`flex gap-2 py-0.5 ${getStatusColor(log.status)}`}>
            <span className="w-5 text-center">{getStatusIcon(log.status)}</span>
            <span className="text-km-text-dim w-12">[{log.step}/{log.total}]</span>
            <span className="flex-1">{log.command}</span>
            {log.duration !== undefined && (
              <span className="text-km-text-dim w-16 text-right">{(log.duration / 1000).toFixed(1)}s</span>
            )}
          </div>
        ))}

        {!isSuiteMode && logs.some((l) => l.error) && (
          <div className="mt-2 p-2 bg-km-error/10 border border-km-error/30 rounded text-km-error">
            {logs.filter((l) => l.error).map((l, i) => (
              <div key={i}>{l.lineNumber > 0 ? `Line ${l.lineNumber}: ` : ''}{l.error}</div>
            ))}
          </div>
        )}

        {!isSuiteMode && result && (
          <div className={`mt-2 pt-2 border-t border-km-border font-semibold ${
            result.status === 'pass' ? 'text-km-success' : 'text-km-error'
          }`}>
            Result: {result.status.toUpperCase()} ({result.steps.filter((s) => s.status === 'pass').length} passed
            {result.steps.filter((s) => s.status === 'fail').length > 0 &&
              `, ${result.steps.filter((s) => s.status === 'fail').length} failed`}
            ) - {(result.duration / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </div>
  );
};
