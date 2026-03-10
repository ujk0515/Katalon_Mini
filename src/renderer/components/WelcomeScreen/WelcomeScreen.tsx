import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { api } from '../../ipc/ipcClient';

export const WelcomeScreen: React.FC = () => {
  const { createProject, openProject, error, clearError } = useProjectStore();
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<'web' | 'mobile'>('web');
  const [projectDir, setProjectDir] = useState('');

  const handleCreate = async () => {
    if (!projectName.trim() || !projectDir) return;
    await createProject(projectName.trim(), projectType, projectDir);
  };

  const handleOpen = async () => {
    const result = await api().selectDirectory();
    if (!result.canceled && result.path) {
      await openProject(result.path);
    }
  };

  const handleSelectDir = async () => {
    const result = await api().selectDirectory();
    if (!result.canceled && result.path) {
      setProjectDir(result.path);
    }
  };

  if (showCreate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-km-bg">
        <div className="bg-km-sidebar border border-km-border rounded-lg p-8 w-[480px]">
          <h2 className="text-xl font-semibold text-white mb-6">New Project</h2>

          <div className="mb-4">
            <label className="block text-km-text text-sm mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="MyTestProject"
              className="w-full bg-km-bg border border-km-border rounded px-3 py-2 text-white text-sm focus:border-km-accent focus:outline-none"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="block text-km-text text-sm mb-1">Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setProjectType('web')}
                className={`flex-1 py-2 px-4 rounded text-sm border ${
                  projectType === 'web'
                    ? 'border-km-accent bg-km-accent/20 text-white'
                    : 'border-km-border text-km-text hover:border-km-text-dim'
                }`}
              >
                Web
              </button>
              <button
                onClick={() => setProjectType('mobile')}
                className={`flex-1 py-2 px-4 rounded text-sm border ${
                  projectType === 'mobile'
                    ? 'border-km-accent bg-km-accent/20 text-white'
                    : 'border-km-border text-km-text hover:border-km-text-dim'
                }`}
              >
                Mobile
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-km-text text-sm mb-1">Location</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectDir}
                readOnly
                placeholder="Select directory..."
                className="flex-1 bg-km-bg border border-km-border rounded px-3 py-2 text-white text-sm"
              />
              <button
                onClick={handleSelectDir}
                className="px-3 py-2 bg-km-toolbar border border-km-border rounded text-sm text-km-text hover:bg-km-border"
              >
                Browse
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-km-text hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!projectName.trim() || !projectDir}
              className="px-4 py-2 bg-km-accent text-white rounded text-sm hover:bg-km-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-km-bg">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Katalon Mini</h1>
        <p className="text-km-text-dim mb-10">Lightweight Web Test Automation</p>

        {error && (
          <div className="mb-4 p-3 bg-km-error/10 border border-km-error/30 rounded text-km-error text-sm w-80 mx-auto">
            {error}
            <button onClick={clearError} className="ml-2 underline text-xs">dismiss</button>
          </div>
        )}

        <div className="flex flex-col gap-3 w-64 mx-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3 bg-km-accent text-white rounded text-sm font-medium hover:bg-km-accent/80"
          >
            New Project
          </button>
          <button
            onClick={handleOpen}
            className="w-full py-3 bg-km-toolbar border border-km-border text-km-text rounded text-sm hover:bg-km-border hover:text-white"
          >
            Open Project
          </button>
        </div>
      </div>
    </div>
  );
};
