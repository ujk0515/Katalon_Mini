import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { api } from '../../ipc/ipcClient';

interface RecentProject {
  path: string;
  name: string;
  type: 'web' | 'mobile';
  lastOpened: string;
}

export const WelcomeScreen: React.FC = () => {
  const { createProject, openProject, error, clearError } = useProjectStore();
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<'web' | 'mobile'>('web');
  const [projectDir, setProjectDir] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    api().getRecentProjects().then(setRecentProjects).catch(() => {});
  }, []);

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

  const handleOpenRecent = async (projectPath: string) => {
    await openProject(projectPath);
  };

  const handleRemoveRecent = async (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation();
    const updated = await api().removeRecentProject(projectPath);
    setRecentProjects(updated);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
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
        <h1 className="text-3xl font-bold text-white mb-2">QA Automation Tool</h1>
        <p className="text-km-text-dim mb-8">Lightweight Web & Mobile Test Automation</p>

        {error && (
          <div className="mb-4 p-3 bg-km-error/10 border border-km-error/30 rounded text-km-error text-sm w-80 mx-auto">
            {error}
            <button onClick={clearError} className="ml-2 underline text-xs">dismiss</button>
          </div>
        )}

        <div className="flex flex-col gap-3 w-64 mx-auto mb-8">
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

        {recentProjects.length > 0 && (
          <div className="w-96 mx-auto text-left">
            <h3 className="text-xs font-semibold text-km-text-dim uppercase tracking-wider mb-2 px-1">Recent Projects</h3>
            <div className="bg-km-sidebar border border-km-border rounded-lg overflow-hidden">
              {recentProjects.map((p) => (
                <div
                  key={p.path}
                  onClick={() => handleOpenRecent(p.path)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-km-accent/10 cursor-pointer border-b border-km-border last:border-b-0 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.type === 'mobile' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {p.type === 'mobile' ? 'Mobile' : 'Web'}
                      </span>
                      <span className="text-sm text-white font-medium truncate">{p.name}</span>
                    </div>
                    <div className="text-xs text-km-text-dim truncate mt-0.5">{p.path}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] text-km-text-dim">{formatDate(p.lastOpened)}</span>
                    <button
                      onClick={(e) => handleRemoveRecent(e, p.path)}
                      className="w-5 h-5 flex items-center justify-center text-km-text-dim hover:text-km-error text-xs rounded hover:bg-km-error/20 opacity-0 group-hover:opacity-100"
                      title="목록에서 제거"
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
