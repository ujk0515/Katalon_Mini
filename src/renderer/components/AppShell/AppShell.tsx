import React, { useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useExecutionStore } from '../../stores/executionStore';
import { WelcomeScreen } from '../WelcomeScreen/WelcomeScreen';
import { ProjectExplorer } from '../ProjectExplorer/ProjectExplorer';
import { EditorPanel } from '../EditorPanel/EditorPanel';
import { Toolbar } from '../Toolbar/Toolbar';
import { LogPanel } from '../LogPanel/LogPanel';
import { StatusBar } from '../StatusBar/StatusBar';
import { useSuiteStore } from '../../stores/suiteStore';
import { api } from '../../ipc/ipcClient';

export const AppShell: React.FC = () => {
  const { isLoaded } = useProjectStore();
  const { addLog, setResult, setError, setRunning, onStopped } = useExecutionStore();
  const { onTcStart, onTcComplete, onStepLog, onSuiteComplete, onSuiteStopped } = useSuiteStore();

  // Subscribe to IPC events from Main process
  useEffect(() => {
    const unsubLog = api().onScriptLog((data) => {
      // Route to suite store if it has tcName (suite step log)
      if (data.tcName) {
        onStepLog(data);
      } else {
        addLog({
          timestamp: new Date().toISOString(),
          step: data.step,
          total: data.total,
          command: data.command,
          status: data.status,
          lineNumber: data.lineNumber,
          duration: data.duration,
          error: data.error,
        });
      }
    });

    const unsubComplete = api().onScriptComplete((data) => {
      setResult(data.result);
    });

    const unsubError = api().onScriptError((data) => {
      setError(data);
    });

    const unsubStopped = api().onScriptStopped(onStopped);

    // Suite events
    const unsubTcStart = api().onSuiteTcStart(onTcStart);
    const unsubTcComplete = api().onSuiteTcComplete(onTcComplete);
    const unsubSuiteComplete = api().onSuiteComplete(onSuiteComplete);
    const unsubSuiteStopped = api().onSuiteStopped(onSuiteStopped);

    return () => {
      unsubLog();
      unsubComplete();
      unsubError();
      unsubStopped();
      unsubTcStart();
      unsubTcComplete();
      unsubSuiteComplete();
      unsubSuiteStopped();
    };
  }, []);

  if (!isLoaded) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex flex-col h-screen">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectExplorer />
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorPanel />
          <LogPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  );
};
