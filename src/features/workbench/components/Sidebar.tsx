import React, { useState, useEffect, useRef } from 'react';
import { FileItem, WorkbenchView, ViewMode } from '../../../shared/types';
import {
  Files,
  BookOpen,
  Cpu,
  Terminal,
  FileText,
  Network,
  Compass,
  FileSpreadsheet,
  Code,
  FileCode,
  Braces,
  Sliders,
  Trash2,
  GitFork,
  UploadCloud,
  ChevronDown,
  ChevronRight,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Columns,
  Link2,
  Copy,
  Download,
  MoreHorizontal,
  Check,
  Eye,
} from 'lucide-react';

interface SidebarProps {
  files: FileItem[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  currentView: WorkbenchView;
  onViewChange: (view: WorkbenchView) => void;
  onDropFiles: (files: FileList) => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  explorerOpen?: boolean;
  onToggleExplorer?: () => void;
  onOpenSettings?: () => void;
  onOpenFileInMode?: (fileId: string, mode: ViewMode) => void;
  onDuplicateFile?: (file: FileItem) => void;
  /** 是否显示扩展脚手架按钮（仅 VS Code 宿主模式下启用，独立 Web 应用不显示） */
  showScaffoldView?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onDeleteFile,
  currentView,
  onViewChange,
  onDropFiles,
  sidebarOpen = true,
  onToggleSidebar,
  explorerOpen = true,
  onToggleExplorer,
  onOpenSettings,
  onOpenFileInMode,
  onDuplicateFile,
  showScaffoldView = true,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [copiedWikiId, setCopiedWikiId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    file: FileItem;
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const isMarkdownFile = (ext: string) =>
    ['md', 'markdown', 'okf'].includes(ext.toLowerCase());

  const isMindmapCapable = (ext: string) =>
    ['md', 'markdown', 'okf', 'mm', 'markmap', 'mindmap', 'km'].includes(ext.toLowerCase());

  const handleCopyWikiLink = async (file: FileItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    try {
      await navigator.clipboard.writeText(`[[${baseName}]]`);
      setCopiedWikiId(file.id);
      setTimeout(() => setCopiedWikiId(null), 1200);
    } catch {
      // ignore clipboard error
    }
    setContextMenu(null);
  };

  const handleCopyMarkdownLink = async (file: FileItem) => {
    try {
      await navigator.clipboard.writeText(`[${file.name}](${file.path || file.name})`);
    } catch {
      // ignore clipboard error
    }
    setContextMenu(null);
  };

  const handleDownloadFile = (file: FileItem) => {
    try {
      const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore download error
    }
    setContextMenu(null);
  };

  const getFileIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'md':
      case 'markdown':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'mm':
      case 'markmap':
      case 'mindmap':
      case 'km':
        return <GitFork className="w-3.5 h-3.5 text-cyan-400" />;
      case 'puml':
      case 'plantuml':
      case 'iuml':
        return <Network className="w-3.5 h-3.5 text-purple-400" />;
      case 'mmd':
      case 'mermaid':
        return <Network className="w-3.5 h-3.5 text-cyan-400" />;
      case 'dot':
      case 'gv':
      case 'graphviz':
        return <Network className="w-3.5 h-3.5 text-amber-400" />;
      case 'svg':
        return <Compass className="w-3.5 h-3.5 text-emerald-400" />;
      case 'pdf':
        return <BookOpen className="w-3.5 h-3.5 text-rose-400" />;
      case 'csv':
      case 'tsv':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />;
      case 'yaml':
      case 'yml':
        return <Sliders className="w-3.5 h-3.5 text-orange-400" />;
      case 'json':
        return <Braces className="w-3.5 h-3.5 text-yellow-400" />;
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Code className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  return (
    <div id="workbench-sidebar" className="relative flex h-full select-none shrink-0 z-10">
      {/* Activity Bar (VS Code left column) */}
      <div id="workbench-activity-bar" className="w-12 border-r flex flex-col items-center justify-between py-3 shrink-0">
        {/* Top items */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={() => {
              if (currentView === 'editor') {
                if (onToggleSidebar) onToggleSidebar();
              } else {
                if (!sidebarOpen && onToggleSidebar) {
                  onToggleSidebar();
                }
                onViewChange('editor');
              }
            }}
            className={`p-2 rounded-xl transition activity-bar-btn ${
              currentView === 'editor' && sidebarOpen ? 'active' : ''
            }`}
            title={currentView === 'editor' && sidebarOpen ? '收起工作区文件面板 (Ctrl+B)' : '展开工作区文件面板 (Explorer)'}
            aria-label="资源管理器"
            aria-expanded={sidebarOpen}
          >
            <Files className="w-5 h-5" />
          </button>

          <button
            onClick={() => onViewChange('docs')}
            className={`p-2 rounded-xl transition activity-bar-btn ${
              currentView === 'docs' ? 'active' : ''
            }`}
            title="工程技术文档中心 (PRD & 架构)"
            aria-label="工程技术文档中心"
          >
            <BookOpen className="w-5 h-5" />
          </button>

          <button
            onClick={() => onViewChange('drivers')}
            className={`p-2 rounded-xl transition activity-bar-btn ${
              currentView === 'drivers' ? 'active' : ''
            }`}
            title="驱动矩阵与竞品对标 (Drivers)"
            aria-label="驱动矩阵与竞品对标"
          >
            <Cpu className="w-5 h-5" />
          </button>

          {showScaffoldView && (
          <button
            onClick={() => onViewChange('scaffold')}
            className={`p-2 rounded-xl transition activity-bar-btn ${
              currentView === 'scaffold' ? 'active' : ''
            }`}
            title="VS Code 插件生产源码脚手架 (Scaffold)"
            aria-label="扩展脚手架"
          >
            <Terminal className="w-5 h-5" />
          </button>
          )}
        </div>

        {/* Bottom items: Sidebar Toggle & Settings */}
        <div className="flex flex-col items-center gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl transition activity-bar-btn"
              title={sidebarOpen ? '折叠文件侧边栏 (Ctrl+B)' : '展开文件侧边栏 (Ctrl+B)'}
              aria-label={sidebarOpen ? '折叠文件侧边栏' : '展开文件侧边栏'}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl transition activity-bar-btn"
              title="偏好与持久化配置中心 (Settings)"
              aria-label="偏好设置"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsed Explorer Quick-Expand Handle Strip */}
      {!sidebarOpen && onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="group absolute left-12 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-3.5 h-14 rounded-r-lg border border-l-0 border-[var(--ov-border)] bg-[var(--ov-surface-header,var(--ov-surface))] text-[var(--ov-text-muted)] hover:text-[var(--ov-accent)] hover:w-4 transition-all shadow-sm cursor-pointer"
          title="展开工作区文件面板 (Explorer)"
          aria-label="展开工作区文件面板"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      )}

      {/* Explorer Side Pane */}
      {sidebarOpen && (
        <div
          id="workbench-explorer-pane"
          className="relative w-60 flex flex-col overflow-hidden transition-all duration-200"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Pane Header */}
          <div className="explorer-pane-header px-3 py-2 border-b text-[11px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 shrink-0">
            <div
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition min-w-0 truncate"
              onClick={onToggleExplorer}
              title={explorerOpen ? '折叠文件树列表' : '展开文件树列表'}
            >
              {explorerOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">工作区文件 (EXPLORER)</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="explorer-file-count text-[10px] font-mono">{files.length} 个文件</span>
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onToggleSidebar();
                  }}
                  className="p-1 rounded-md hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] transition cursor-pointer"
                  title="收起工作区文件面板 (Ctrl+B)"
                  aria-label="收起工作区文件面板"
                  data-testid="explorer-collapse-btn"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* File List */}
          {explorerOpen ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {files.map(file => {
                const isActive = activeFileId === file.id;
                const isMd = isMarkdownFile(file.extension);
                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      onSelectFile(file.id);
                      if (currentView !== 'editor') onViewChange('editor');
                    }}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({
                        file,
                        x: Math.min(e.clientX, window.innerWidth - 220),
                        y: Math.min(e.clientY, window.innerHeight - 260),
                      });
                    }}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition explorer-file-item ${
                      isActive ? 'active' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {getFileIcon(file.extension)}
                      <span className="truncate">{file.name}</span>
                      {file.isModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      {isMd && onOpenFileInMode && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenFileInMode(file.id, 'split');
                          }}
                          className="p-0.5 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] hover:text-[var(--ov-accent)] transition cursor-pointer"
                          title="分屏对照编辑 (.md)"
                          aria-label="分屏对照编辑"
                        >
                          <Columns className="w-3 h-3" />
                        </button>
                      )}
                      {isMd && (
                        <button
                          type="button"
                          onClick={e => handleCopyWikiLink(file, e)}
                          className="p-0.5 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] hover:text-[var(--ov-accent)] transition cursor-pointer"
                          title="复制 [[WikiLink]] 双链引用"
                          aria-label="复制 WikiLink"
                        >
                          {copiedWikiId === file.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Link2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setContextMenu({
                            file,
                            x: Math.min(rect.right + 4, window.innerWidth - 220),
                            y: Math.min(rect.bottom + 2, window.innerHeight - 260),
                          });
                        }}
                        className="p-0.5 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] transition cursor-pointer"
                        title="更多文件操作 (右键菜单)"
                        aria-label="更多文件操作"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                      <span className="explorer-file-size text-[10px] font-mono">
                        {Math.round((file.size / 1024) * 10) / 10}K
                      </span>
                      {file.isCustomUploaded && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteFile(file.id);
                          }}
                          className="p-0.5 hover:text-rose-400 text-[var(--ov-text-muted)] rounded cursor-pointer"
                          title="删除该文件"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[11px] text-[var(--ov-text-muted)]">
              <span>文件列表已折叠</span>
              <button
                type="button"
                onClick={onToggleExplorer}
                className="mt-1.5 px-2.5 py-1 rounded-md border border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition cursor-pointer"
              >
                展开列表
              </button>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div
            className={`explorer-dropzone p-3 m-2 rounded-xl border border-dashed transition-all text-center text-xs ${
              isDraggingOver ? 'dragging' : ''
            }`}
          >
            <UploadCloud className="w-5 h-5 mx-auto mb-1" />
            <div className="font-semibold dropzone-title">拖拽文件到此处</div>
            <div className="dropzone-subtitle text-[10px] mt-0.5">支持 .md, .mm, .svg, .pdf, .puml, .csv</div>
          </div>

          {/* Bottom Engine Specs Card */}
          <div className="explorer-footer-card p-3 border-t text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="footer-label">渲染驱动:</span>
              <span className="footer-val-cyan font-mono font-medium">Driver-Ready</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="footer-label">商业授权:</span>
              <span className="footer-val-emerald font-semibold">100% Free MIT</span>
            </div>
          </div>
        </div>
      )}

      {/* 文件快捷右键/悬浮菜单 (P0: 遵循 --ov-* 语义化令牌) */}
      {contextMenu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="File quick actions menu"
          className="fixed z-50 w-52 p-1 rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface-header,var(--ov-surface))] text-[var(--ov-text)] shadow-2xl text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
            boxShadow: 'var(--ov-shadow, 0 10px 28px rgba(0, 0, 0, 0.28))',
          }}
        >
          <div className="px-2.5 py-1.5 border-b border-[var(--ov-border)] flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ov-text-secondary)] truncate">
            {getFileIcon(contextMenu.file.extension)}
            <span className="truncate">{contextMenu.file.name}</span>
          </div>

          <div className="py-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                if (onOpenFileInMode) {
                  onOpenFileInMode(contextMenu.file.id, 'preview');
                } else {
                  onSelectFile(contextMenu.file.id);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[var(--ov-accent)] shrink-0" />
              <span>以沉浸预览模式打开</span>
            </button>

            {onOpenFileInMode && (
              <button
                type="button"
                onClick={() => {
                  onOpenFileInMode(contextMenu.file.id, 'split');
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5 text-[var(--ov-accent)] shrink-0" />
                <span>以左右分屏对照打开</span>
              </button>
            )}

            {isMindmapCapable(contextMenu.file.extension) && onOpenFileInMode && (
              <button
                type="button"
                onClick={() => {
                  onOpenFileInMode(contextMenu.file.id, 'mindmap');
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
              >
                <GitFork className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>以思维导图模式打开</span>
              </button>
            )}

            <div className="my-1 border-t border-[var(--ov-border)] opacity-70" />

            <button
              type="button"
              onClick={() => handleCopyWikiLink(contextMenu.file)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
              <span>复制 [[WikiLink]] 双链</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyMarkdownLink(contextMenu.file)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
              <span>复制 Markdown 引用链接</span>
            </button>

            <div className="my-1 border-t border-[var(--ov-border)] opacity-70" />

            {onDuplicateFile && (
              <button
                type="button"
                onClick={() => {
                  onDuplicateFile(contextMenu.file);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
              >
                <Files className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
                <span>克隆文档副本</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDownloadFile(contextMenu.file)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
              <span>下载源文件</span>
            </button>

            {contextMenu.file.isCustomUploaded && (
              <button
                type="button"
                onClick={() => {
                  onDeleteFile(contextMenu.file.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/15 text-left text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>删除该文件</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

