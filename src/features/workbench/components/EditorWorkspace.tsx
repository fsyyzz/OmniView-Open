import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  XCircle,
  ArrowRightToLine,
  ArrowLeftToLine,
  CheckCircle2,
  Layers,
  PanelLeft,
  FolderOpen,
} from 'lucide-react';
import { FileItem, ViewMode, ThemeId, ContentWidthMode } from '../../../shared/types';
import { ViewerRenderer } from '../../viewers/ViewerRenderer';

interface EditorWorkspaceProps {
  files: FileItem[];
  activeFile?: FileItem;
  activeFileId: string;
  openTabIds: string[];
  viewMode: ViewMode;
  theme?: ThemeId;
  density?: 'compact' | 'standard' | 'comfortable';
  contentWidth?: ContentWidthMode;
  zoom?: number;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, event?: React.MouseEvent) => void;
  onCloseOtherTabs?: (id: string) => void;
  onCloseTabsToRight?: (id: string) => void;
  onCloseTabsToLeft?: (id: string) => void;
  onCloseSavedTabs?: () => void;
  onCloseAllTabs?: () => void;
  onNewFile: () => void;
  onContentChange: (content: string) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  files,
  activeFile,
  activeFileId,
  openTabIds,
  viewMode,
  theme = 'dark',
  density = 'compact',
  contentWidth = 'standard',
  zoom = 1.0,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseTabsToLeft,
  onCloseSavedTabs,
  onCloseAllTabs,
  onNewFile,
  onContentChange,
  enableOkf,
  onToggleOkf,
  sidebarOpen = true,
  onToggleSidebar,
}) => {
  const [tabContextMenu, setTabContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tabContextMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTabContextMenu(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabContextMenu]);

  const handleCloseOther = (targetTabId: string) => {
    if (onCloseOtherTabs) {
      onCloseOtherTabs(targetTabId);
    } else {
      openTabIds.forEach(id => {
        if (id !== targetTabId) onCloseTab(id);
      });
    }
    setTabContextMenu(null);
  };

  const handleCloseRight = (targetTabId: string) => {
    if (onCloseTabsToRight) {
      onCloseTabsToRight(targetTabId);
    } else {
      const idx = openTabIds.indexOf(targetTabId);
      if (idx !== -1) {
        openTabIds.slice(idx + 1).forEach(id => onCloseTab(id));
      }
    }
    setTabContextMenu(null);
  };

  const handleCloseLeft = (targetTabId: string) => {
    if (onCloseTabsToLeft) {
      onCloseTabsToLeft(targetTabId);
    } else {
      const idx = openTabIds.indexOf(targetTabId);
      if (idx > 0) {
        openTabIds.slice(0, idx).forEach(id => onCloseTab(id));
      }
    }
    setTabContextMenu(null);
  };

  const handleCloseSaved = () => {
    if (onCloseSavedTabs) {
      onCloseSavedTabs();
    } else {
      openTabIds.forEach(id => {
        const f = files.find(item => item.id === id);
        if (!f?.isModified) onCloseTab(id);
      });
    }
    setTabContextMenu(null);
  };

  const handleCloseAll = () => {
    if (onCloseAllTabs) {
      onCloseAllTabs();
    } else {
      openTabIds.forEach(id => onCloseTab(id));
    }
    setTabContextMenu(null);
  };

  const contextTabIndex = tabContextMenu ? openTabIds.indexOf(tabContextMenu.tabId) : -1;
  const contextTabFile = tabContextMenu ? files.find(f => f.id === tabContextMenu.tabId) : undefined;
  const hasTabsToRight = contextTabIndex >= 0 && contextTabIndex < openTabIds.length - 1;
  const hasTabsToLeft = contextTabIndex > 0;
  const hasOtherTabs = openTabIds.length > 1;
  const hasSavedTabs = openTabIds.some(id => !files.find(f => f.id === id)?.isModified);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      data-theme={theme}
      data-density={density}
      data-width={contentWidth}
    >
      <div className="editor-tab-bar-container h-9 border-b border-[var(--ov-border)] bg-[var(--ov-surface-header,var(--ov-surface))] flex items-center justify-between px-1 select-none shrink-0">
        <div className="flex items-center h-full overflow-x-auto no-scrollbar min-w-0 flex-1">
          {!sidebarOpen && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 mr-1 rounded-md text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover)] transition shrink-0 cursor-pointer"
              title="展开工作区文件面板 (Ctrl+B)"
              aria-label="展开工作区文件面板"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {openTabIds.map(tabId => {
            const tabFile = files.find(file => file.id === tabId);
            if (!tabFile) return null;
            const isActive = tabId === activeFileId;
            return (
              <div
                key={tabId}
                role="tab"
                aria-selected={isActive}
                data-tab-id={tabId}
                onClick={() => onSelectTab(tabId)}
                onAuxClick={e => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseTab(tabId, e);
                  }
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTabContextMenu({
                    tabId,
                    x: Math.min(e.clientX, Math.max(16, window.innerWidth - 220)),
                    y: Math.min(e.clientY, Math.max(16, window.innerHeight - 260)),
                  });
                }}
                className={`group h-full flex items-center gap-2 px-3 border-r border-[var(--ov-border)] text-xs cursor-pointer transition max-w-[200px] shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'editor-workspace-tab-active bg-[var(--ov-bg)] text-[var(--ov-text)] border-t-2 border-t-[var(--ov-accent)] font-medium'
                    : 'editor-workspace-tab bg-[var(--ov-surface-header,var(--ov-surface))] text-[var(--ov-text-secondary)] hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
                }`}
                title={`${tabFile.name} (右键打开更多标签操作)`}
              >
                <span className="truncate">{tabFile.name}</span>
                {tabFile.isModified && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--ov-accent)] shrink-0"
                    title="未保存的修改"
                  />
                )}
                <button
                  type="button"
                  onClick={event => onCloseTab(tabId, event)}
                  className="p-0.5 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] opacity-0 group-hover:opacity-100 transition shrink-0 cursor-pointer"
                  title="关闭标签页"
                  aria-label={`关闭 ${tabFile.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onNewFile}
            className="p-1.5 text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover)] rounded mx-1 shrink-0 transition cursor-pointer"
            title="新建文档"
            aria-label="新建文档"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right-side Quick Batch Actions */}
        {openTabIds.length > 1 && (
          <div className="flex items-center gap-1 pl-2 border-l border-[var(--ov-border)] shrink-0">
            <button
              type="button"
              onClick={handleCloseAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--ov-text-muted)] hover:text-rose-400 hover:bg-[var(--ov-surface-hover)] transition whitespace-nowrap shrink-0 cursor-pointer"
              title="关闭全部已打开的标签页"
              aria-label="全部关闭"
              data-testid="tab-bar-close-all-btn"
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">全部关闭</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Right-Click Context Menu */}
      {tabContextMenu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="标签页操作菜单"
          className="fixed z-50 w-52 p-1 rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface-header,var(--ov-surface))] text-[var(--ov-text)] shadow-2xl text-xs select-none"
          style={{
            left: `${tabContextMenu.x}px`,
            top: `${tabContextMenu.y}px`,
            backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
            boxShadow: 'var(--ov-shadow, 0 10px 28px rgba(0, 0, 0, 0.28))',
          }}
        >
          {contextTabFile && (
            <div className="px-2.5 py-1.5 border-b border-[var(--ov-border)] flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--ov-text-secondary)] truncate">
              <span className="truncate">{contextTabFile.name}</span>
              <span className="text-[10px] font-mono text-[var(--ov-text-muted)] shrink-0">
                {contextTabIndex + 1}/{openTabIds.length}
              </span>
            </div>
          )}

          <div className="py-1 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={e => {
                onCloseTab(tabContextMenu.tabId, e);
                setTabContextMenu(null);
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
                <span>关闭当前标签页</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!hasOtherTabs}
              onClick={() => handleCloseOther(tabContextMenu.tabId)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] disabled:opacity-40 disabled:pointer-events-none text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[var(--ov-accent)] shrink-0" />
                <span>关闭其他标签页</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!hasTabsToRight}
              onClick={() => handleCloseRight(tabContextMenu.tabId)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] disabled:opacity-40 disabled:pointer-events-none text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ArrowRightToLine className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
                <span>关闭右侧标签页</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!hasTabsToLeft}
              onClick={() => handleCloseLeft(tabContextMenu.tabId)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] disabled:opacity-40 disabled:pointer-events-none text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ArrowLeftToLine className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
                <span>关闭左侧标签页</span>
              </span>
            </button>

            <div className="my-1 border-t border-[var(--ov-border)] opacity-70" />

            <button
              type="button"
              role="menuitem"
              disabled={!hasSavedTabs}
              onClick={handleCloseSaved}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] disabled:opacity-40 disabled:pointer-events-none text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
                <span>关闭未修改标签页</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleCloseAll}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/15 text-left text-rose-400 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>全部关闭</span>
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto flex flex-col">
        {activeFile ? (
          <ViewerRenderer
            file={activeFile}
            files={files}
            mode={viewMode}
            theme={theme}
            density={density}
            contentWidth={contentWidth}
            zoom={zoom}
            onContentChange={onContentChange}
            onSelectFile={f => onSelectTab(f.id)}
            enableOkf={enableOkf}
            onToggleOkf={onToggleOkf}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-[var(--ov-text-muted)]">
            <FolderOpen className="w-10 h-10 opacity-40" />
            <div className="text-sm font-medium text-[var(--ov-text-secondary)]">
              当前没有打开的标签页
            </div>
            <div className="text-xs max-w-xs">
              可从左侧「工作区文件」面板选择任意文档打开，或直接新建一份空白文档。
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={onNewFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--ov-accent)] text-[var(--ov-text-on-accent,#fff)] hover:opacity-90 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建文档</span>
              </button>
              {!sidebarOpen && onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span>展开工作区文件</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

