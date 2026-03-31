import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { SuiteEditor } from '../SuiteEditor/SuiteEditor';

// ─── 전역 드래그 데이터 (Monaco 이벤트 문제 우회) ───
export let pendingFileDrag: { path: string; name: string; type: string } | null = null;
export function setFileDrag(data: typeof pendingFileDrag) { pendingFileDrag = data; }

interface DragState {
  tabId: string;
  insertIndex: number; // 0 ~ openTabs.length
  ghostX: number;
  ghostLabel: string;
}

export const EditorPanel: React.FC = () => {
  const { openTabs, activeTabId, setActiveTab, closeTab, updateContent, saveFile, reorderTab } =
    useEditorStore();
  const { projectPath } = useProjectStore();

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // ── Ctrl+S ──
  const saveRef = useRef<() => Promise<void>>();
  saveRef.current = async () => {
    if (activeTabId && projectPath) {
      await saveFile(projectPath, activeTabId);
    }
  };

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

  // ── Monaco instance ──
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => saveRef.current?.()
    );
  }, []);

  // ── 파일 드래그 → 에디터 드롭: document 레벨 mouseup으로 처리 ──
  useEffect(() => {
    // mouseup으로 드롭 감지 (DnD의 dragend 대신)
    const handleDragEnd = () => {
      const data = pendingFileDrag;
      if (!data) return;
      pendingFileDrag = null;

      // 에디터 영역 위에서 드롭했는지 확인
      const container = editorContainerRef.current;
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!container || !editor || !monaco) return;

      const pos = editor.getPosition();
      if (!pos) return;

      const pathWithoutExt = data.path.replace(/\.(groovy|suite)$/, '');
      const projectConfig = useProjectStore.getState().config;
      const prefix = projectConfig?.type === 'mobile' ? 'Mobile' : 'WebUI';
      const code = `${prefix}.callTestCase(findTestCase('${pathWithoutExt}'), [:], FailureHandling.STOP_ON_FAILURE)`;

      editor.executeEdits('drag-drop', [{
        range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, 1),
        text: code + '\n',
        forceMoveMarkers: true,
      }]);

      const store = useEditorStore.getState();
      const tab = store.openTabs.find(t => t.id === store.activeTabId);
      if (tab) store.updateContent(tab.id, editor.getValue());
    };

    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, []);

  // ── Tab drag-to-reorder ──
  const [drag, setDrag] = useState<DragState | null>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTabId = useRef<string | null>(null);
  const mouseStartX = useRef<number>(0);

  const calcInsertIndex = useCallback(
    (mouseX: number): number => {
      let idx = 0;
      for (let i = 0; i < openTabs.length; i++) {
        const el = tabRefs.current.get(openTabs[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (mouseX > rect.left + rect.width / 2) idx = i + 1;
      }
      return idx;
    },
    [openTabs]
  );

  const handleTabMouseDown = (e: React.MouseEvent, tabId: string, tabName: string) => {
    if (e.button !== 0) return;
    pendingTabId.current = tabId;
    mouseStartX.current = e.clientX;

    longPressTimer.current = setTimeout(() => {
      if (pendingTabId.current !== tabId) return;
      const insertIndex = openTabs.findIndex((t) => t.id === tabId);
      setDrag({ tabId, insertIndex, ghostX: mouseStartX.current, ghostLabel: tabName });
    }, 200);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      setDrag((prev) =>
        prev ? { ...prev, ghostX: e.clientX, insertIndex: calcInsertIndex(e.clientX) } : null
      );
    };

    const handleMouseUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (drag) {
        reorderTab(drag.tabId, drag.insertIndex);
        setDrag(null);
      }
      pendingTabId.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, calcInsertIndex, reorderTab]);

  // cleanup timer on unmount
  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
      <div className="relative flex bg-km-toolbar border-b border-km-border overflow-x-auto select-none">
        {openTabs.map((tab, i) => {
          const isDragging = drag?.tabId === tab.id;

          return (
            <React.Fragment key={tab.id}>
              {/* insertion indicator: before this tab */}
              {drag && drag.insertIndex === i && (
                <div className="w-0.5 bg-km-accent self-stretch shrink-0" />
              )}

              <div
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                onClick={() => !drag && setActiveTab(tab.id)}
                onMouseDown={(e) => handleTabMouseDown(e, tab.id, tab.name)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer border-r border-km-border min-w-0 transition-opacity ${
                  tab.id === activeTabId
                    ? 'bg-km-editor text-white border-t-2 border-t-km-accent'
                    : 'text-km-text-dim hover:text-km-text'
                } ${isDragging ? 'opacity-40' : 'opacity-100'}`}
              >
                <span className="truncate max-w-[150px]">
                  {tab.isDirty ? '● ' : ''}
                  {tab.name}
                </span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="text-km-text-dim hover:text-white text-xs ml-1"
                >
                  ×
                </button>
              </div>

              {/* insertion indicator: after last tab */}
              {drag && i === openTabs.length - 1 && drag.insertIndex === openTabs.length && (
                <div className="w-0.5 bg-km-accent self-stretch shrink-0" />
              )}
            </React.Fragment>
          );
        })}

        {/* Ghost tab following cursor */}
        {drag && (
          <div
            className="fixed top-0 flex items-center gap-2 px-3 py-1.5 text-sm bg-km-editor border border-km-accent rounded shadow-lg pointer-events-none z-50 opacity-90"
            style={{ left: drag.ghostX - 20, transform: 'translateY(4px)' }}
          >
            <span className="truncate max-w-[150px] text-white">{drag.ghostLabel}</span>
          </div>
        )}
      </div>

      {/* Suite Editor or Monaco Editor */}
      {activeTab && activeTab.filePath.endsWith('.suite') ? (
        <SuiteEditor content={activeTab.content} tabId={activeTab.id} />
      ) : activeTab && (
        <div
          ref={editorContainerRef}
          className="flex-1"
          onDragOver={(e) => {
            if (!pendingFileDrag) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            const editor = editorRef.current;
            if (editor) {
              const pos = editor.getTargetAtClientPoint(e.clientX, e.clientY);
              if (pos?.position) {
                editor.focus();
                editor.setPosition(pos.position);
                editor.revealPositionInCenterIfOutsideViewport(pos.position);
              }
            }
          }}
        >
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
              dropIntoEditor: { enabled: false },
            }}
          />
        </div>
      )}
    </div>
  );
};
