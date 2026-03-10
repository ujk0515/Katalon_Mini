import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useExecutionStore } from '../../stores/executionStore';

export const StatusBar: React.FC = () => {
  const { config } = useProjectStore();
  const { isRunning } = useExecutionStore();

  return (
    <div className="flex items-center justify-between px-3 py-0.5 bg-km-accent text-white text-xs">
      <div className="flex items-center gap-3">
        <span>{isRunning ? 'Running...' : 'Ready'}</span>
        {config && <span>{config.name} ({config.type})</span>}
      </div>
      <div className="flex items-center gap-3">
        <span>Katalon Mini v0.1.0</span>
      </div>
    </div>
  );
};
