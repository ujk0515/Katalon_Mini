import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { api } from '../../ipc/ipcClient';
import type { FileTreeNode } from '@shared/types/project';

interface ContextMenuState {
  x: number;
  y: number;
  node: FileTreeNode;
}

const ContextMenu: React.FC<{
  menu: ContextMenuState;
  projectPath: string;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ menu, projectPath, onClose, onRefresh }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCopyPath = () => {
    const pathWithoutExt = menu.node.path.replace(/\.groovy$/, '');
    navigator.clipboard.writeText(pathWithoutExt);
    onClose();
  };

  const handleRename = async () => {
    const newName = prompt('New name:', menu.node.name);
    if (!newName || newName === menu.node.name) {
      onClose();
      return;
    }
    const parentDir = menu.node.path.substring(0, menu.node.path.lastIndexOf('/'));
    const ext = menu.node.type === 'testcase' && !newName.endsWith('.groovy') ? '.groovy'
      : menu.node.type === 'suite' && !newName.endsWith('.suite') ? '.suite' : '';
    const newPath = parentDir ? `${parentDir}/${newName}${ext}` : `${newName}${ext}`;
    await api().renameFile({ projectPath, oldPath: menu.node.path, newPath });
    onRefresh();
    onClose();
  };

  const handleDelete = async () => {
    const confirmed = confirm(`Delete "${menu.node.name}"?`);
    if (!confirmed) {
      onClose();
      return;
    }
    await api().deleteFile({ projectPath, relativePath: menu.node.path });
    onRefresh();
    onClose();
  };

  const btnClass = 'w-full text-left px-3 py-1.5 text-sm text-km-text hover:bg-km-accent/20 cursor-pointer';

  return (
    <div
      ref={menuRef}
      className="fixed bg-km-sidebar border border-km-border rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: menu.x, top: menu.y }}
    >
      <button className={btnClass} onClick={handleRename}>
        Rename
      </button>
      {(menu.node.type === 'testcase' || menu.node.type === 'suite') && (
        <button className={btnClass} onClick={handleCopyPath}>
          Copy Path
        </button>
      )}
      <div className="border-t border-km-border my-1" />
      <button className={`${btnClass} text-red-400 hover:text-red-300`} onClick={handleDelete}>
        Delete
      </button>
    </div>
  );
};

const TreeNode: React.FC<{
  node: FileTreeNode;
  projectPath: string;
  depth: number;
  selectedFolder: string;
  onSelectFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
}> = ({ node, projectPath, depth, selectedFolder, onSelectFolder, onContextMenu }) => {
  const [expanded, setExpanded] = useState(true);
  const { openTab } = useEditorStore();

  const isSelected = node.type === 'folder' && node.path === selectedFolder;

  const handleClick = async () => {
    if (node.type === 'folder') {
      onSelectFolder(node.path);
      setExpanded(!expanded);
    }
  };

  const handleDoubleClick = async () => {
    if (node.type === 'testcase' || node.type === 'suite') {
      const result = await api().readFile({
        projectPath,
        relativePath: node.path,
      });
      if (result.success) {
        openTab(node.id, node.name, node.path, result.content);
      }
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, node);
  };

  const icon = node.type === 'folder' ? (expanded ? '\u25BE' : '\u25B8') : node.type === 'suite' ? '\u25A3' : '\u25A0';
  const iconColor = node.type === 'folder' ? 'text-km-warning' : node.type === 'suite' ? 'text-km-success' : 'text-km-accent';

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-km-border/50 text-sm ${
          isSelected ? 'bg-km-accent/20' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={`${iconColor} text-xs w-4`}>{icon}</span>
        <span className="text-km-text truncate">{node.name}</span>
      </div>
      {node.type === 'folder' && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              projectPath={projectPath}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ProjectExplorer: React.FC = () => {
  const { fileTree, projectPath, config, refreshTree } = useProjectStore();
  const [showInput, setShowInput] = useState<'file' | 'folder' | 'suite' | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('Test Cases');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 인풋 노출 시 포커스
  useEffect(() => {
    if (showInput) {
      // 렌더링 후 포커스 보장
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [showInput]);

  // Click outside input to cancel (mouseup 사용 — mousedown은 인풋 클릭을 방해함)
  useEffect(() => {
    if (!showInput) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (inputContainerRef.current && !inputContainerRef.current.contains(e.target as Node)) {
        setShowInput(null);
        setNewName('');
      }
    };
    document.addEventListener('mouseup', handleClickOutside);
    return () => document.removeEventListener('mouseup', handleClickOutside);
  }, [showInput]);

  const handleCreate = async () => {
    if (!projectPath || !newName.trim()) return;

    const isFolder = showInput === 'folder';
    if (showInput === 'suite') {
      const fileName = `${newName.trim()}${newName.endsWith('.suite') ? '' : '.suite'}`;
      const relativePath = `Test Suites/${fileName}`;
      await api().createFile({ projectPath, relativePath, isFolder: false });
      await refreshTree();
      setShowInput(null);
      setNewName('');
      return;
    }

    const basePath = selectedFolder || 'Test Cases';
    const fileName = isFolder
      ? newName.trim()
      : `${newName.trim()}${newName.endsWith('.groovy') ? '' : '.groovy'}`;
    const relativePath = `${basePath}/${fileName}`;

    await api().createFile({ projectPath, relativePath, isFolder });
    await refreshTree();
    setShowInput(null);
    setNewName('');
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  return (
    <div className="w-60 bg-km-sidebar border-r border-km-border flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold text-km-text-dim uppercase tracking-wider flex items-center justify-between">
        <span>Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowInput('file')}
            title="New Test Case"
            className="text-km-text-dim hover:text-white text-base leading-none"
          >
            +
          </button>
          <button
            onClick={() => setShowInput('folder')}
            title="New Folder"
            className="text-km-text-dim hover:text-white text-base leading-none"
          >
            +F
          </button>
          <button
            onClick={() => setShowInput('suite')}
            title="New Test Suite"
            className="text-km-text-dim hover:text-white text-base leading-none"
          >
            +S
          </button>
        </div>
      </div>

      {showInput && (
        <div ref={inputContainerRef} className="px-2 py-1">
          <div className="text-xs text-km-text-dim mb-1">
            in: {selectedFolder || 'Test Cases'}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setShowInput(null); setNewName(''); }
            }}
            placeholder={showInput === 'folder' ? 'Folder name' : showInput === 'suite' ? 'MySuite.suite' : 'TestCase.groovy'}
            className="w-full bg-km-bg border border-km-accent rounded px-2 py-1 text-xs text-white focus:outline-none"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {config && (
          <div
            onClick={() => setSelectedFolder('Test Cases')}
            className={`px-2 py-1 text-sm font-medium text-white cursor-pointer hover:bg-km-border/50 ${
              selectedFolder === 'Test Cases' ? 'bg-km-accent/20' : ''
            }`}
          >
            {config.name}
            <span className="ml-2 text-xs text-km-text-dim">({config.type})</span>
          </div>
        )}
        {fileTree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            projectPath={projectPath!}
            depth={0}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      {contextMenu && projectPath && (
        <ContextMenu
          menu={contextMenu}
          projectPath={projectPath}
          onClose={() => setContextMenu(null)}
          onRefresh={refreshTree}
        />
      )}
    </div>
  );
};
