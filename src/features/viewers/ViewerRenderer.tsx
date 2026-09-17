/**
 * OmniView 多格式统一渲染分发驱动
 * 基于 Driver Registry 插件注册表动态调度分发
 */
import React, { useState, Suspense, lazy } from 'react';
import { FileItem, DriverId, ViewMode, ThemeId, ContentWidthMode } from '../../shared/types';
import { Locale } from '../../shared/lib/i18n';
import { loadStoredSettings, saveStoredSettings } from '../../shared/lib/settingsStorage';
import { Eye, Network, Loader2 } from 'lucide-react';
import { getDriverIdForFile, resolveDriverPluginForFile } from './lib/driverRegistry';
import { RenderErrorBoundary } from './components/common/RenderErrorBoundary';

export { getDriverIdForFile };

// Markdown 模式专用异步驱动
const MarkdownViewer = lazy(() => import('./components/drivers/MarkdownViewer').then(m => ({ default: m.MarkdownViewer })));
const MarkmapViewer = lazy(() => import('./components/drivers/MarkmapViewer').then(m => ({ default: m.MarkmapViewer })));
const CodeViewer = lazy(() => import('./components/drivers/CodeViewer').then(m => ({ default: m.CodeViewer })));

const DriverLoadingFallback: React.FC<{ fileName: string }> = ({ fileName }) => (
  <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-3 p-8 text-slate-400 select-none">
    <div className="relative flex items-center justify-center">
      <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
    </div>
    <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
      <span>加载驱动引擎...</span>
      <span className="text-slate-500 truncate max-w-[200px]">({fileName})</span>
    </div>
  </div>
);

export interface ViewerRendererProps {
  file: FileItem;
  files: FileItem[];
  mode: ViewMode;
  theme?: ThemeId;
  density?: 'compact' | 'standard' | 'comfortable';
  contentWidth?: ContentWidthMode;
  zoom?: number;
  locale?: Locale;
  onContentChange: (content: string) => void;
  onRenderComplete?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onOpenInEditor?: () => void;
  onSelectFile?: (file: FileItem) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
  eagerMount?: boolean;
}

export const ViewerRenderer: React.FC<ViewerRendererProps> = ({
  file,
  files,
  mode,
  theme = 'dark',
  density = 'compact',
  contentWidth = 'standard',
  zoom = 1.0,
  locale = 'zh-CN',
  onContentChange,
  onRenderComplete,
  onOpenSourceAtLine,
  onOpenInEditor,
  onSelectFile,
  enableOkf,
  onToggleOkf,
  eagerMount = false,
}) => {
  const plugin = resolveDriverPluginForFile(file);
  const driverId = plugin.id;
  const isDarkTheme = ['dark', 'midnight', 'cyber', 'nord', 'dracula', 'forest'].includes(theme);

  const [internalEnableOkf, setInternalEnableOkf] = useState<boolean>(() => {
    const s = loadStoredSettings();
    return s.enableOkfRendering ?? true;
  });
  const effectiveEnableOkf = enableOkf !== undefined ? enableOkf : internalEnableOkf;
  const handleToggleOkf = () => {
    if (onToggleOkf) {
      onToggleOkf();
    } else {
      const next = !effectiveEnableOkf;
      setInternalEnableOkf(next);
      saveStoredSettings({ enableOkfRendering: next });
    }
  };

  const zoomStyle = zoom !== 1.0 ? { zoom } : undefined;
  const [splitRightMode, setSplitRightMode] = useState<'preview' | 'mindmap'>(() => {
    const s = loadStoredSettings();
    return s.splitRightMode || 'preview';
  });

  const renderDriverContent = () => {
    if (driverId === 'markdown') {
      if (mode === 'mindmap') {
        return (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-theme={theme} style={zoomStyle}>
            <MarkmapViewer
              content={file.content}
              fileName={file.name}
              isDarkTheme={isDarkTheme}
              theme={theme}
              density={density}
              locale={locale}
              onOpenSourceAtLine={onOpenSourceAtLine}
            />
          </div>
        );
      }

      if (mode === 'source') {
        return (
          <div className="flex-1 min-h-0 flex flex-col" style={zoomStyle}>
            <CodeViewer
              content={file.content}
              fileName={file.name}
              extension={file.extension}
              locale={locale}
              onContentChange={onContentChange}
              onOpenInEditor={onOpenInEditor}
            />
          </div>
        );
      }

      if (mode === 'split') {
        return (
          <div className="flex min-h-0 flex-1 overflow-hidden" data-theme={theme}>
            {/* Left: Source Code Editor */}
            <div className="flex min-h-0 w-1/2 flex-col border-r border-slate-800" style={zoomStyle}>
              <CodeViewer
                content={file.content}
                fileName={file.name}
                extension={file.extension}
                locale={locale}
                onContentChange={onContentChange}
                onOpenInEditor={onOpenInEditor}
              />
            </div>

            {/* Right: Toggleable Preview / Mindmap */}
            <div className="min-h-0 w-1/2 flex flex-col overflow-hidden relative" style={{ background: 'var(--ov-bg)' }}>
              {/* Floating switcher for split view right pane */}
              <div className="absolute top-2 right-4 z-20 flex items-center bg-slate-900/85 backdrop-blur border border-slate-750 rounded-md p-0.5 shadow-md">
                <button
                  onClick={() => {
                    setSplitRightMode('preview');
                    saveStoredSettings({ splitRightMode: 'preview' });
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    splitRightMode === 'preview'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="富文本渲染预览"
                  aria-label="富文本渲染预览"
                >
                  <Eye className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">预览</span>
                </button>
                <button
                  onClick={() => {
                    setSplitRightMode('mindmap');
                    saveStoredSettings({ splitRightMode: 'mindmap' });
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    splitRightMode === 'mindmap'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="全景思维导图 (Markmap)"
                  aria-label="全景思维导图"
                >
                  <Network className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">思维导图</span>
                </button>
              </div>

              {splitRightMode === 'preview' ? (
                <div className="markdown-plugin-scroll ov-split-preview-scroll flex-1 overflow-y-auto" style={{ background: 'var(--ov-bg)' }}>
                  <div style={zoomStyle}>
                    <MarkdownViewer
                      content={file.content}
                      files={files}
                      isDarkTheme={isDarkTheme}
                      density={density}
                      contentWidth={contentWidth}
                      locale={locale}
                      onContentChange={onContentChange}
                      onRenderComplete={onRenderComplete}
                      onOpenSourceAtLine={onOpenSourceAtLine}
                      onSelectFile={onSelectFile}
                      enableOkf={effectiveEnableOkf}
                      onToggleOkf={handleToggleOkf}
                      eagerMount={eagerMount}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={zoomStyle}>
                  <MarkmapViewer
                    content={file.content}
                    fileName={file.name}
                    isDarkTheme={isDarkTheme}
                    theme={theme}
                    density={density}
                    locale={locale}
                    onOpenSourceAtLine={onOpenSourceAtLine}
                  />
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="w-full flex-1 min-h-0" data-theme={theme} style={{ background: 'var(--ov-bg)' }}>
          <div style={zoomStyle}>
            <MarkdownViewer
              content={file.content}
              files={files}
              isDarkTheme={isDarkTheme}
              density={density}
              contentWidth={contentWidth}
              locale={locale}
              onContentChange={onContentChange}
              onRenderComplete={onRenderComplete}
              onOpenSourceAtLine={onOpenSourceAtLine}
              onSelectFile={onSelectFile}
              enableOkf={effectiveEnableOkf}
              onToggleOkf={handleToggleOkf}
              eagerMount={eagerMount}
            />
          </div>
        </div>
      );
    }

    // 动态分发非 Markdown 驱动插件组件
    const TargetDriverComponent = plugin.getComponent();
    const universalDriverProps = {
      content: file.content,
      fileName: file.name,
      extension: file.extension,
      fileSize: file.size,
      binaryUrl: file.binaryUrl,
      isDarkTheme,
      theme,
      density,
      locale,
      onContentChange,
      onOpenSourceAtLine,
      onOpenInEditor,
      files,
    };

    return (
      <div className="h-full w-full flex-1 min-h-0 flex flex-col overflow-hidden" data-theme={theme} style={zoomStyle}>
        <TargetDriverComponent {...universalDriverProps} />
      </div>
    );
  };

  return (
    <RenderErrorBoundary blockName={`OmniView Driver (${driverId})`}>
      <Suspense fallback={<DriverLoadingFallback fileName={file.name} />}>
        {renderDriverContent()}
      </Suspense>
    </RenderErrorBoundary>
  );
};

