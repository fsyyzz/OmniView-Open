import React, { useState } from 'react';
import { FileItem, WorkbenchView } from '../../../shared/types';
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
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
    <div id="workbench-sidebar" className="flex h-full select-none shrink-0 z-10">
      {/* Activity Bar (VS Code left column) */}
      <div id="workbench-activity-bar" className="w-12 border-r flex flex-col items-center justify-between py-3 shrink-0">
        {/* Top items */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={() => {
              if (!sidebarOpen && onToggleSidebar) {
                onToggleSidebar();
              }
              onViewChange('editor');
            }}
            className={`p-2 rounded-xl transition activity-bar-btn ${
              currentView === 'editor' && sidebarOpen ? 'active' : ''
            }`}
            title="资源管理器 (Explorer)"
            aria-label="资源管理器"
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
        </div>

        {/* Bottom items: Sidebar Toggle & Settings */}
        <div className="flex flex-col items-center gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl transition activity-bar-btn"
              title={sidebarOpen ? '折叠文件侧边栏' : '展开文件侧边栏'}
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

      {/* Explorer Side Pane */}
      {sidebarOpen && (
        <div
          id="workbench-explorer-pane"
          className="w-60 flex flex-col overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Pane Header */}
          <div className="explorer-pane-header px-4 py-2.5 border-b text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
            <div
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition"
              onClick={onToggleExplorer}
            >
              {explorerOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>工作区文件 (EXPLORER)</span>
            </div>
            <span className="explorer-file-count text-[10px] font-mono">{files.length} 个文件</span>
          </div>

          {/* File List */}
          {explorerOpen && (
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {files.map(file => {
                const isActive = activeFileId === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      onSelectFile(file.id);
                      if (currentView !== 'editor') onViewChange('editor');
                    }}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition explorer-file-item ${
                      isActive ? 'active' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(file.extension)}
                      <span className="truncate">{file.name}</span>
                      {file.isModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <span className="explorer-file-size text-[10px] font-mono">
                        {Math.round(file.size / 1024 * 10) / 10}K
                      </span>
                      {file.isCustomUploaded && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteFile(file.id);
                          }}
                          className="p-0.5 hover:text-rose-400 text-slate-500 rounded"
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
    </div>
  );
};
