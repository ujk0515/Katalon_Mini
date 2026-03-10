import { create } from 'zustand';
import { api } from '../ipc/ipcClient';

interface TabInfo {
  id: string;
  name: string;
  filePath: string;
  content: string;
  isDirty: boolean;
}

interface EditorStore {
  openTabs: TabInfo[];
  activeTabId: string | null;

  openTab: (id: string, name: string, filePath: string, content: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  saveFile: (projectPath: string, id: string) => Promise<void>;
  getActiveContent: () => string;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [],
  activeTabId: null,

  openTab: (id, name, filePath, content) => {
    const { openTabs } = get();
    const existing = openTabs.find((t) => t.id === id);
    if (existing) {
      set({ activeTabId: id });
      return;
    }
    set({
      openTabs: [...openTabs, { id, name, filePath, content, isDirty: false }],
      activeTabId: id,
    });
  },

  closeTab: (id) => {
    const { openTabs, activeTabId } = get();
    const filtered = openTabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;
    if (activeTabId === id) {
      newActiveId = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
    }
    set({ openTabs: filtered, activeTabId: newActiveId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, content, isDirty: true } : t
      ),
    }));
  },

  saveFile: async (projectPath, id) => {
    const tab = get().openTabs.find((t) => t.id === id);
    if (!tab) return;

    const result = await api().writeFile({
      projectPath,
      relativePath: tab.filePath,
      content: tab.content,
    });

    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id
          ? { ...t, isDirty: false, content: result?.converted ? result.content : t.content }
          : t
      ),
    }));
  },

  getActiveContent: () => {
    const { openTabs, activeTabId } = get();
    const tab = openTabs.find((t) => t.id === activeTabId);
    return tab?.content ?? '';
  },
}));
