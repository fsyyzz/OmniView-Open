import React from 'react';
import { Plus, X } from 'lucide-react';
import { FileItem, ViewMode, ThemeId } from '../../../shared/types';
import { ViewerRenderer } from '../../viewers/ViewerRenderer';

interface EditorWorkspaceProps {
  files: FileItem[];
  activeFile?: FileItem;
  activeFileId: string;
  openTabIds: string[];
  viewMode: ViewMode;
  theme?: ThemeId;
  density?: 'compact' | 'standard' | 'comfortable';
  zoom?: number;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, event: React.MouseEvent) => void;
  onNewFile: () => void;
  onContentChange: (content: string) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  files,
  activeFile,
  activeFileId,
  openTabIds,
  viewMode,
  theme = 'dark',
  density = 'compact',
  zoom = 1.0,
  onSelectTab,
  onCloseTab,
  onNewFile,
  onContentChange,
  enableOkf,
  onToggleOkf,
}) => (
  <div className="flex-1 flex flex-col overflow-hidden" data-theme={theme} data-density={density}>
    <div className="editor-tab-bar-container h-9 bg-slate-950 border-b border-slate-800 flex items-center px-1 overflow-x-auto select-none shrink-0 no-scrollbar">
      {openTabIds.map((tabId) => {
        const tabFile = files.find((file) => file.id === tabId);
        if (!tabFile) return null;
        const isActive = tabId === activeFileId;
        return (
          <div
            key={tabId}
            onClick={() => onSelectTab(tabId)}
            className={`group h-full flex items-center gap-2 px-3 border-r border-slate-800 text-xs cursor-pointer transition max-w-[200px] ${
              isActive
                ? 'editor-workspace-tab-active bg-slate-900 text-slate-100 border-t-2 border-t-blue-500 font-medium'
                : 'editor-workspace-tab bg-slate-950/80 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
            }`}
          >
            <span className="truncate">{tabFile.name}</span>
            {tabFile.isModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
            <button
              onClick={(event) => onCloseTab(tabId, event)}
              className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition"
              title="关闭标签页"
              aria-label={`关闭 ${tabFile.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      <button
        onClick={onNewFile}
        className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded mx-1"
        title="新建文档"
        aria-label="新建文档"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
    <div className="flex-1 overflow-auto flex flex-col">
      {activeFile ? (
        <ViewerRenderer
          file={activeFile}
          files={files}
          mode={viewMode}
          theme={theme}
          density={density}
          zoom={zoom}
          onContentChange={onContentChange}
          onSelectFile={(f) => onSelectTab(f.id)}
          enableOkf={enableOkf}
          onToggleOkf={onToggleOkf}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500">请选择一个文件以开始渲染</div>
      )}
    </div>
  </div>
);

