import React, { useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { SuiteEditor } from '../SuiteEditor/SuiteEditor';

export const EditorPanel: React.FC = () => {
  const { openTabs, activeTabId, setActiveTab, closeTab, updateContent, saveFile } =
    useEditorStore();
  const { projectPath } = useProjectStore();

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // Use ref to always have latest save function (fixes closure bug on tab switch)
  const saveRef = useRef<() => Promise<void>>();
  saveRef.current = async () => {
    if (activeTabId && projectPath) {
      await saveFile(projectPath, activeTabId);
    }
  };

  // Global Ctrl+S handler (works for SuiteEditor and any non-Monaco view)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => saveRef.current?.()
    );
  }, []);

  if (openTabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-km-editor">
        <div className="text-center text-km-text-dim">
          <p className="text-lg mb-2">No file open</p>
          <p className="text-sm">Select a test case from the Explorer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-km-editor">
      {/* Tab Bar */}
      <div className="flex bg-km-toolbar border-b border-km-border overflow-x-auto">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer border-r border-km-border min-w-0 ${
              tab.id === activeTabId
                ? 'bg-km-editor text-white border-t-2 border-t-km-accent'
                : 'text-km-text-dim hover:text-km-text'
            }`}
          >
            <span className="truncate max-w-[150px]">
              {tab.isDirty ? '\u25CF ' : ''}
              {tab.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="text-km-text-dim hover:text-white text-xs ml-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Suite Editor or Monaco Editor */}
      {activeTab && activeTab.filePath.endsWith('.suite') ? (
        <SuiteEditor content={activeTab.content} tabId={activeTab.id} />
      ) : activeTab && (
        <div className="flex-1">
          <Editor
            height="100%"
            language="java"
            theme="vs-dark"
            value={activeTab.content}
            onChange={(value) => {
              if (value !== undefined) {
                updateContent(activeTab.id, value);
              }
            }}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              suggestOnTriggerCharacters: true,
            }}
          />
        </div>
      )}
    </div>
  );
};
