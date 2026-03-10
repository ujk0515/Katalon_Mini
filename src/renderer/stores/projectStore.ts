import { create } from 'zustand';
import type { ProjectConfig, FileTreeNode } from '@shared/types/project';
import { api } from '../ipc/ipcClient';

interface ProjectStore {
  config: ProjectConfig | null;
  projectPath: string | null;
  fileTree: FileTreeNode[];
  isLoaded: boolean;
  error: string | null;

  createProject: (name: string, type: 'web' | 'mobile', path: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  config: null,
  projectPath: null,
  fileTree: [],
  isLoaded: false,
  error: null,

  createProject: async (name, type, dirPath) => {
    // Let main process handle path joining (avoids Windows / vs \ issues)
    const result = await api().createProject({ name, type, path: dirPath });
    if (result.success) {
      set({ config: result.config, projectPath: result.projectPath, isLoaded: true, error: null });
      await get().refreshTree();
    } else {
      set({ error: result.error || 'Failed to create project' });
    }
  },

  openProject: async (path) => {
    const result = await api().openProject(path);
    if (result.success) {
      set({ config: result.config, projectPath: path, isLoaded: true, error: null });
      await get().refreshTree();
    } else {
      set({ error: result.error || 'Failed to open project. Is this a Katalon Mini project?' });
    }
  },

  refreshTree: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    const result = await api().getFileTree(projectPath);
    if (result.success) {
      set({ fileTree: result.tree });
    }
  },

  reset: () => set({ config: null, projectPath: null, fileTree: [], isLoaded: false, error: null }),
  clearError: () => set({ error: null }),
}));
