import React, { Suspense } from 'react';
import { FileItem, DriverId, ViewMode, ThemeId, ContentWidthMode, isThemeDark } from '../../shared/types';
import { Locale } from '../../shared/lib/i18n';
import { Loader2 } from 'lucide-react';
import { getDriverIdForFile, resolveDriverPluginForFile } from './lib/driverRegistry';
import { RenderErrorBoundary } from './components/common/RenderErrorBoundary';

export { getDriverIdForFile };

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
  fontSize?: number;
  zoom?: number;
  locale?: Locale;
  onContentChange: (content: string) => void;
  onAcceptAiDiff?: (content: string) => void;
  onRenderComplete?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onOpenInEditor?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
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
  fontSize = 15,
  zoom = 1.0,
  locale = 'zh-CN',
  onContentChange,
  onAcceptAiDiff,
  onRenderComplete,
  onOpenSourceAtLine,
  onOpenInEditor,
  onOpenSettings,
  onOpenShortcuts,
  onSelectFile,
  enableOkf,
  onToggleOkf,
  eagerMount = false,
}) => {
  const plugin = resolveDriverPluginForFile(file);
  const driverId = plugin.id;
  const isDarkTheme = isThemeDark(theme);

  const zoomStyle = zoom !== 1.0 ? { zoom } : undefined;

  const renderDriverContent = () => {
    if (plugin.renderMode) {
      const PluginModeComponent = plugin.renderMode as React.FC<any>;
      return (
        <PluginModeComponent
          file={file}
          files={files}
          mode={mode}
          isDarkTheme={isDarkTheme}
          theme={theme}
          density={density}
          contentWidth={contentWidth}
          fontSize={fontSize}
          zoom={zoom}
          locale={locale}
          onContentChange={onContentChange}
          onAcceptAiDiff={onAcceptAiDiff}
          onRenderComplete={onRenderComplete}
          onOpenSourceAtLine={onOpenSourceAtLine}
          onOpenInEditor={onOpenInEditor}
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
          onSelectFile={onSelectFile}
          enableOkf={enableOkf}
          onToggleOkf={onToggleOkf}
          eagerMount={eagerMount}
        />
      );
    }

    // 动态分发非 Markdown 驱动插件组件
    const TargetDriverComponent = plugin.getComponent();
    // 针对图片或纯二进制只读驱动，模式安全收敛为 preview，禁止分屏与源码编辑介入
    const effectiveMode = (driverId === 'image' || (!plugin.supportsSplitView && !plugin.supportsSourceEdit && plugin.isBinary))
      ? 'preview'
      : mode;
    const universalDriverProps = {
      file,
      mode: effectiveMode,
      content: file.content,
      fileName: file.name,
      extension: file.extension,
      fileSize: file.size,
      binaryUrl: file.binaryUrl,
      isDarkTheme,
      theme,
      density,
      fontSize,
      locale,
      onContentChange,
      onOpenSourceAtLine,
      onOpenInEditor,
      onOpenSettings,
      onOpenShortcuts,
      onSelectFile,
      files,
    };

    const containerStyle: React.CSSProperties = {
      ...(zoomStyle || {}),
      '--ov-font-size': `${fontSize}px`,
    } as React.CSSProperties;

    return (
      <div
        className="h-full w-full flex-1 min-h-0 flex flex-col overflow-hidden"
        data-theme={theme}
        data-font-size={fontSize}
        style={containerStyle}
      >
        <TargetDriverComponent key={file.path || file.name || file.id} {...universalDriverProps} />
      </div>
    );
  };

  return (
    <RenderErrorBoundary
      key={`${driverId}:${file.path || file.name || file.id}`}
      blockName={`OmniView Driver (${driverId})`}
    >
      <Suspense fallback={<DriverLoadingFallback fileName={file.name} />}>
        {renderDriverContent()}
      </Suspense>
    </RenderErrorBoundary>
  );
};
