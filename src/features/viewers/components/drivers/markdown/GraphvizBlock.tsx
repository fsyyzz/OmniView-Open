/**
 * Markdown Graphviz / DOT 矢量图表渲染组件 (纯图标 + 悬浮提示 + 多语言支持 + 实时即时编译)
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  Copy,
  Check,
  Download,
  AlertCircle,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Eye,
  Image as ImageIcon,
  PanelTopClose,
} from 'lucide-react';
import { DiagramCompactTrigger } from './DiagramCompactTrigger';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { copySvgOrImageToClipboard } from '../../../../../shared/lib/copyImageHelper';
import { graphvizRenderer, GraphvizEngine } from '../../../lib/graphvizRenderer';
import { analyzeGraphvizError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';
import { ExternalBadgePill } from '../../common/ExternalBadgePill';
import type { ThemeId } from '../../../../../shared/types.ts';

interface GraphvizBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  engine?: GraphvizEngine;
  isCopied: boolean;
  viewMode: 'visual' | 'code';
  zoom: number;
  editedCode: string;
  onChangeEditedCode: (val: string) => void;
  onSetViewMode: (mode: 'visual' | 'code') => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  onOpenLightbox: (svgContent?: string) => void;
  onReRender: () => void;
  onDownloadSvg: (svgContent?: string) => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onFocusTextForNode?: (label: string, line?: number) => void;
  externalFile?: string;
  locale?: Locale;
  theme?: ThemeId | string;
  isDarkTheme?: boolean;
}

export const GraphvizBlock: React.FC<GraphvizBlockProps> = ({
  id,
  code,
  startLine,
  endLine,
  engine = 'dot',
  isCopied,
  viewMode,
  zoom,
  editedCode,
  onChangeEditedCode,
  onSetViewMode,
  onZoomChange,
  onResetZoom,
  onOpenLightbox,
  onReRender,
  onDownloadSvg,
  onCopy,
  onOpenSourceAtLine,
  onFocusTextForNode,
  externalFile,
  locale = 'zh-CN',
  theme,
  isDarkTheme,
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isErrorCopied, setIsErrorCopied] = useState<boolean>(false);
  const [isCopiedImage, setIsCopiedImage] = useState<boolean>(false);
  const [isCopyingImage, setIsCopyingImage] = useState<boolean>(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState<boolean>(false);
  const [hoveredNodeInfo, setHoveredNodeInfo] = useState<{ label: string; line: number } | null>(null);
  const renderCountRef = useRef(0);
  const activeCode = editedCode !== undefined ? editedCode : code;

  // 异步加载与渲染 Graphviz SVG (支持 200ms 防抖即时编译，且深度绑定 14 大渲染主题系统)
  useEffect(() => {
    let isCurrent = true;
    const currentRender = ++renderCountRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      graphvizRenderer
        .render(activeCode, (engine || 'dot') as GraphvizEngine, theme || isDarkTheme)
        .then((svg) => {
          if (isCurrent && currentRender === renderCountRef.current) {
            setSvgContent(svg);
            setIsLoading(false);
            setError(null);
          }
        })
        .catch((err: any) => {
          if (isCurrent && currentRender === renderCountRef.current) {
            setError(err?.message || 'Graphviz 编译失败');
            setIsLoading(false);
          }
        });
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [activeCode, engine, theme, isDarkTheme]);

  const handleCopyError = () => {
    if (error) {
      navigator.clipboard.writeText(error);
      setIsErrorCopied(true);
      setTimeout(() => setIsErrorCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graphviz-diagram.svg';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      onDownloadSvg(svgContent);
    }
  };

  const handleCopyImage = async () => {
    if (!svgContent || isCopyingImage) return;
    setIsCopyingImage(true);
    const success = await copySvgOrImageToClipboard(svgContent, false, '#ffffff');
    setIsCopyingImage(false);
    if (success) {
      setIsCopiedImage(true);
      setTimeout(() => setIsCopiedImage(false), 2000);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const nodeEl = target.closest('g.node, g.cluster');
    if (!nodeEl) {
      if (hoveredNodeInfo) setHoveredNodeInfo(null);
      return;
    }
    const text = (
      nodeEl.querySelector('text')?.textContent ||
      nodeEl.querySelector('title')?.textContent ||
      nodeEl.textContent ||
      ''
    ).trim();
    if (!text) {
      if (hoveredNodeInfo) setHoveredNodeInfo(null);
      return;
    }
    const lines = activeCode.split('\n');
    let matchIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(text)) {
        matchIdx = i;
        break;
      }
    }
    const calculatedLine = (startLine || 1) + (matchIdx !== -1 ? matchIdx + 1 : 1);
    if (!hoveredNodeInfo || hoveredNodeInfo.label !== text) {
      setHoveredNodeInfo({ label: text, line: calculatedLine });
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredNodeInfo(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const nodeEl = target.closest('g.node, g.cluster');
    if (nodeEl && hoveredNodeInfo) {
      e.stopPropagation();
      if (onFocusTextForNode) {
        onFocusTextForNode(hoveredNodeInfo.label, hoveredNodeInfo.line);
      } else if (onOpenSourceAtLine) {
        onOpenSourceAtLine(hoveredNodeInfo.line);
      }
    }
  };

  return (
    <div
      id={id}
      data-theme={theme}
      className={`markdown-diagram markdown-diagram-graphviz group relative ${isToolbarExpanded ? 'is-toolbar-open' : ''}`}
    >
      {/* 默认折叠微型展开胶囊 */}
      {!isToolbarExpanded && viewMode !== 'code' && (
        <DiagramCompactTrigger
          onExpand={() => setIsToolbarExpanded(true)}
          title={t('expandDiagramToolbar', locale)}
          label={t('expandDiagramToolbar', locale)}
        />
      )}

      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-amber-400">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-semibold">{t('graphvizTitle', locale)}</span>
          <span className="text-slate-400 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase">
            {engine}
          </span>
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-700/40 text-amber-300 font-sans select-none"
            title={t('diagramFocusText', locale)}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{t('diagramTextLinkActive', locale)}</span>
          </span>
          {viewMode === 'visual' && (
            <span className="text-slate-400 text-[11px]">({Math.round(zoom * 100)}%)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-750 mr-1">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1.5 rounded transition ${
                viewMode === 'visual'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('previewTooltip', locale)}
              aria-label={t('preview', locale)}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetViewMode('code')}
              className={`p-1.5 rounded transition ${
                viewMode === 'code'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('codeTooltip', locale)}
              aria-label={t('code', locale)}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {viewMode === 'visual' ? (
            <>
              <button
                onClick={() => onZoomChange(-0.2)}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                title={t('zoomOut', locale)}
                aria-label={t('zoomOut', locale)}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onZoomChange(0.2)}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                title={t('zoomIn', locale)}
                aria-label={t('zoomIn', locale)}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onResetZoom}
                className="px-1.5 py-0.5 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded text-[10px] transition font-mono"
                title={t('zoomReset', locale)}
              >
                1:1
              </button>
              <button
                onClick={() => onOpenLightbox(svgContent)}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                title={t('fullScreen', locale)}
                aria-label={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-slate-700 mx-0.5" />
              {svgContent && (
                <button
                  onClick={handleCopyImage}
                  disabled={isCopyingImage}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                  title={isCopiedImage ? t('imageCopied', locale) : t('copyImage', locale)}
                  aria-label={t('copyImage', locale)}
                >
                  {isCopiedImage ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : isCopyingImage ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </button>
              )}
              <button
                onClick={handleDownload}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                title={t('downloadSvg', locale)}
                aria-label={t('downloadSvg', locale)}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span className="text-[11px] text-amber-400/80 font-mono px-1 flex items-center gap-1">
              {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : '⚡'} Live
            </span>
          )}

          <div className="h-3 w-px bg-slate-700 mx-0.5" />

          {/* Copy DOT Code */}
          <button
            onClick={onCopy}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title={isCopied ? t('copied', locale) : t('copyDotCode', locale)}
            aria-label={t('copyDotCode', locale)}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* 收起工具栏 */}
          {viewMode !== 'code' && (
            <button
              type="button"
              onClick={() => setIsToolbarExpanded(false)}
              className="p-1 rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer text-slate-400 hover:text-slate-200 ml-0.5"
              title={t('collapseDiagramToolbar', locale)}
              aria-label={t('collapseDiagramToolbar', locale)}
            >
              <PanelTopClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      {viewMode === 'visual' ? (
        <div
          className="p-6 overflow-x-auto flex justify-center bg-[var(--ov-diagram-canvas-bg,transparent)] min-h-[160px] items-center cursor-zoom-in relative group/canvas"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          onClick={handleCanvasClick}
          onDoubleClick={(e) => {
            if (svgContent) {
              e.stopPropagation();
              onOpenLightbox(svgContent);
            }
          }}
          title={svgContent ? t('fullScreen', locale) : undefined}
        >
          {hoveredNodeInfo && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onFocusTextForNode) {
                  onFocusTextForNode(hoveredNodeInfo.label, hoveredNodeInfo.line);
                } else {
                  onOpenSourceAtLine?.(hoveredNodeInfo.line);
                }
              }}
              className="diagram-node-link-badge absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 bg-[var(--ov-surface-header,var(--ov-surface))] border border-amber-500 rounded-full text-[var(--ov-text)] text-xs shadow-lg backdrop-blur-md cursor-pointer hover:bg-[var(--ov-surface-hover)] transition-all select-none"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--ov-surface-header, var(--ov-surface)) 94%, transparent)',
                borderColor: '#f59e0b',
                color: 'var(--ov-text)',
                boxShadow: 'var(--ov-shadow, 0 4px 14px rgba(0, 0, 0, 0.22))',
              }}
              title={t('diagramFocusText', locale)}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="font-semibold max-w-[140px] truncate">{hoveredNodeInfo.label}</span>
              <span className="text-amber-400 font-mono font-semibold">🔗 {t('diagramFocusText', locale)}</span>
              <span className="text-[10px] text-[var(--ov-text-muted)] hidden sm:inline">
                (L{hoveredNodeInfo.line})
              </span>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-8">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>{t('renderingGraphviz', locale)}</span>
            </div>
          ) : error ? (
            <DiagramDiagnosticCard
              diagnostic={analyzeGraphvizError(activeCode, error, startLine, endLine, locale)}
              locale={locale}
              isRestored={!error && activeCode !== code}
              onApplyQuickFix={(fixed) => onChangeEditedCode(fixed)}
              onOpenSourceAtLine={onOpenSourceAtLine}
              onToggleCodeView={() => onSetViewMode('code')}
              onReRender={onReRender}
            />
          ) : (
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="diagram-canvas transition-transform duration-150 flex justify-center max-w-full [&>svg]:max-w-full [&>svg]:h-auto cursor-zoom-in"
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpenLightbox(svgContent);
              }}
              title={t('fullScreen', locale)}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-950">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>{t('editDiagramSource', locale)}:</span>
            <span>{activeCode.split('\n').length} {t('linesCode', locale)}</span>
          </div>
          <textarea
            value={activeCode}
            onChange={(e) => onChangeEditedCode(e.target.value)}
            spellCheck={false}
            rows={Math.min(18, Math.max(6, activeCode.split('\n').length + 1))}
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-amber-300 font-mono text-xs leading-relaxed outline-none focus:border-amber-500 transition resize-y"
          />
        </div>
      )}

      <ExternalBadgePill externalFile={externalFile} />
    </div>
  );
};
