import React, { useState, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { api } from '../../ipc/ipcClient';
import type { FileTreeNode } from '@shared/types/project';
import type { TestSuiteConfig } from '@shared/types/suite';

interface SuiteEditorProps {
  content: string;
  tabId: string;
}

function collectTestCases(nodes: FileTreeNode[], result: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === 'testcase') {
      result.push(node.path);
    } else if (node.type === 'folder' && node.children) {
      collectTestCases(node.children, result);
    }
  }
  return result;
}

export const SuiteEditor: React.FC<SuiteEditorProps> = ({ content, tabId }) => {
  const { projectPath, fileTree } = useProjectStore();
  const { updateContent } = useEditorStore();

  const [config, setConfig] = useState<TestSuiteConfig>(() => {
    try { return JSON.parse(content); }
    catch { return { name: '', testCases: [], stopOnFailure: false }; }
  });

  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      setConfig(parsed);
    } catch { /* ignore parse errors */ }
  }, [tabId]);

  const allTestCases = useMemo(() => collectTestCases(fileTree), [fileTree]);

  const save = (updated: TestSuiteConfig) => {
    setConfig(updated);
    updateContent(tabId, JSON.stringify(updated, null, 2));
  };

  const toggleTC = (tcPath: string) => {
    const idx = config.testCases.indexOf(tcPath);
    const next = [...config.testCases];
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      next.push(tcPath);
    }
    save({ ...config, testCases: next });
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...config.testCases];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    save({ ...config, testCases: next });
  };

  const moveDown = (idx: number) => {
    if (idx >= config.testCases.length - 1) return;
    const next = [...config.testCases];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    save({ ...config, testCases: next });
  };

  const removeTC = (idx: number) => {
    const next = [...config.testCases];
    next.splice(idx, 1);
    save({ ...config, testCases: next });
  };

  return (
    <div className="flex-1 flex flex-col bg-km-editor p-4 overflow-y-auto">
      {/* Suite Name */}
      <div className="mb-4">
        <label className="block text-xs text-km-text-dim mb-1">스위트 이름</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => save({ ...config, name: e.target.value })}
          className="w-full border border-km-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-km-accent"
          style={{ backgroundColor: '#252526', color: '#cccccc' }}
        />
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Selected TC list */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-xs font-semibold text-km-text-dim uppercase tracking-wider mb-2">
            포함된 테스트케이스 ({config.testCases.length})
          </h3>
          <div className="flex-1 bg-km-sidebar border border-km-border rounded overflow-y-auto">
            {config.testCases.length === 0 && (
              <div className="text-km-text-dim text-sm text-center py-8">
                우측에서 테스트케이스를 선택하세요
              </div>
            )}
            {config.testCases.map((tc, i) => (
              <div key={tc} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-km-border/50 border-b border-km-border/30">
                <span className="text-km-text-dim w-5 text-center text-xs">{i + 1}</span>
                <span className="flex-1 text-km-text truncate">{tc.replace(/^Test Cases\//, '').replace(/\.groovy$/, '')}</span>
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="text-km-text-dim hover:text-white text-xs disabled:opacity-30">
                  ▲
                </button>
                <button onClick={() => moveDown(i)} disabled={i === config.testCases.length - 1}
                  className="text-km-text-dim hover:text-white text-xs disabled:opacity-30">
                  ▼
                </button>
                <button onClick={() => removeTC(i)}
                  className="text-red-400 hover:text-red-300 text-xs">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: All TC list */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-xs font-semibold text-km-text-dim uppercase tracking-wider mb-2">
            프로젝트 테스트케이스
          </h3>
          <div className="flex-1 bg-km-sidebar border border-km-border rounded overflow-y-auto">
            {allTestCases.length === 0 && (
              <div className="text-km-text-dim text-sm text-center py-8">
                테스트케이스가 없습니다
              </div>
            )}
            {allTestCases.map((tc) => {
              const isSelected = config.testCases.includes(tc);
              return (
                <div
                  key={tc}
                  onClick={() => toggleTC(tc)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-km-border/50 border-b border-km-border/30 ${
                    isSelected ? 'bg-km-accent/10' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTC(tc)}
                    className="accent-km-accent"
                  />
                  <span className="text-km-text truncate">{tc.replace(/^Test Cases\//, '').replace(/\.groovy$/, '')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: stopOnFailure toggle */}
      <div className="mt-4 flex items-center gap-3 pt-3 border-t border-km-border">
        <label className="flex items-center gap-2 text-sm text-km-text cursor-pointer">
          <input
            type="checkbox"
            checked={config.stopOnFailure}
            onChange={(e) => save({ ...config, stopOnFailure: e.target.checked })}
            className="accent-km-accent"
          />
          실패 시 중단 (stopOnFailure)
        </label>
        <span className="text-xs text-km-text-dim">
          {config.stopOnFailure ? '하나 실패하면 나머지 스킵' : '실패해도 전부 실행'}
        </span>
      </div>
    </div>
  );
};
