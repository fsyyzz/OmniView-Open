/**
 * Markdown Markmap 思维导图渲染组件
 * 支持 Visual / Code 视态双向切换、卡片 Header Toolbar、放大缩小重置与代码复制
 */
import React from 'react';
import {
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Eye,
  Network,
  RefreshCw,
  PanelTopClose,
} from 'lucide-react';
import { DiagramCompactTrigger } from './DiagramCompactTrigger';
import { Locale, t } from '../../../../../shared/lib/i18n.ts';
import type { ThemeId } from '../../../../../shared/types.ts';
import { MarkmapViewer } from '../MarkmapViewer.tsx';
import { ExternalBadgePill } from '../../common/ExternalBadgePill.tsx';

interface MarkmapBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  isCopied: boolean;
  viewMode: 'visual' | 'code';
  zoom: number;
  editedCode: string;
  isDarkTheme?: boolean;
  theme?: ThemeId;
  onChangeEditedCode: (val: string) => void;
  onSetViewMode: (mode: 'visual' | 'code') => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  onOpenLightbox: (content?: string) => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  externalFile?: string;
  locale?: Locale;
}

export const MarkmapBlock: React.FC<MarkmapBlockProps> = React.memo(({
  id,
  code,
  startLine,
  endLine,
  isCopied,
  viewMode,
  zoom,
  editedCode,
  isDarkTheme = true,
  theme,
  onChangeEditedCode,
  onSetViewMode,
  onZoomChange,
  onResetZoom,
  onOpenLightbox,
  onCopy,
  onOpenSourceAtLine,
  externalFile,
  locale = 'zh-CN',
}) => {
  const [isToolbarExpanded, setIsToolbarExpanded] = React.useState<boolean>(false);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const activeCode = editedCode !== undefined ? editedCode : code;

  const handleOpenLightbox = React.useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const svgEl = canvasRef.current?.querySelector('svg');
    if (svgEl) {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      onOpenLightbox(svgString);
    } else {
      onOpenLightbox(activeCode);
    }
  }, [activeCode, onOpenLightbox]);

  return (
    <div
      id={id}
      data-source-line={startLine}
      data-source-end-line={endLine}
      data-theme={theme}
      className={`markdown-diagram markdown-diagram-markmap group relative ${isToolbarExpanded ? 'is-toolbar-open' : ''}`}
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 默认折叠微型展开胶囊 */}
      {!isToolbarExpanded && viewMode !== 'code' && (
        <DiagramCompactTrigger
          onExpand={() => setIsToolbarExpanded(true)}
          title={t('expandDiagramToolbar', locale)}
          label={t('expandDiagramToolbar', locale)}
        />
      )}

      {/* Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-[var(--ov-text-secondary)]">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-500">
            <Network className="w-4 h-4 text-emerald-500" />
            <span>Markmap Mindmap</span>
          </span>
          {startLine !== undefined && onOpenSourceAtLine && (
            <button
              onClick={() => onOpenSourceAtLine(startLine)}
              className="hidden sm:inline-block text-[10px] text-[var(--ov-text-muted)] hover:text-sky-500 transition"
              title={t('doubleClickToLocate', locale)}
            >
              L{startLine}
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[var(--ov-surface-header)] rounded p-0.5 border border-[var(--ov-border)]">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1 rounded flex items-center gap-1 text-[11px] transition ${
                viewMode === 'visual'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={t('previewTooltip', locale)}
              aria-label={t('preview', locale)}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetViewMode('code')}
              className={`p-1 rounded flex items-center gap-1 text-[11px] transition ${
                viewMode === 'code'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={t('codeTooltip', locale)}
              aria-label={t('code', locale)}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {viewMode === 'visual' && (
            <>
              {/* Zoom Controls */}
              <div className="flex items-center bg-[var(--ov-surface-header)] rounded p-0.5 border border-[var(--ov-border)]">
                <button
                  onClick={() => onZoomChange(-0.1)}
                  className="p-1 text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition"
                  title={t('zoomOut', locale)}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onResetZoom}
                  className="px-1.5 text-[10px] font-mono text-[var(--ov-text)] transition"
                  title={t('resetZoom', locale)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => onZoomChange(0.1)}
                  className="p-1 text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition"
                  title={t('zoomIn', locale)}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lightbox Modal Button */}
              <button
                onClick={() => handleOpenLightbox()}
                className="p-1.5 rounded bg-[var(--ov-surface-header)] border border-[var(--ov-border)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] transition"
                title={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Copy Code */}
          <button
            onClick={onCopy}
            className="p-1.5 rounded bg-[var(--ov-surface-header)] border border-[var(--ov-border)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] transition"
            title={t('copyCode', locale)}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* 收起工具栏 */}
          {viewMode !== 'code' && (
            <button
              type="button"
              onClick={() => setIsToolbarExpanded(false)}
              className="p-1.5 rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] ml-0.5"
              title={t('collapseDiagramToolbar', locale)}
              aria-label={t('collapseDiagramToolbar', locale)}
            >
              <PanelTopClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container: 紧凑自适应居中呈现思维导图，无多余大片空白 */}
      <div
        ref={canvasRef}
        className={`diagram-canvas relative h-[280px] p-1.5 overflow-hidden flex items-center justify-center ${viewMode === 'visual' ? 'cursor-zoom-in' : ''}`}
        style={{ backgroundColor: 'var(--ov-diagram-canvas-bg, transparent)' }}
        onDoubleClick={viewMode === 'visual' ? handleOpenLightbox : undefined}
        title={viewMode === 'visual' ? t('fullScreen', locale) : undefined}
      >
        {viewMode === 'visual' ? (
          <div
            className="w-full h-full transition-transform duration-150 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <MarkmapViewer
              content={activeCode}
              isDarkTheme={isDarkTheme}
              theme={theme}
              locale={locale}
              onOpenSourceAtLine={onOpenSourceAtLine}
              embedded={true}
            />
          </div>
        ) : (
          <div className="p-3 w-full">
            <textarea
              value={activeCode}
              onChange={e => onChangeEditedCode(e.target.value)}
              className="w-full h-[320px] font-mono text-xs bg-[var(--ov-surface-secondary,var(--ov-surface))] text-[var(--ov-text)] p-3 rounded-lg border border-[var(--ov-border)] focus:outline-none focus:border-emerald-500 resize-y"
              placeholder="Enter Markmap Markdown content..."
            />
          </div>
        )}
      </div>

      <ExternalBadgePill externalFile={externalFile} />
    </div>
  );
});

MarkmapBlock.displayName = 'MarkmapBlock';
