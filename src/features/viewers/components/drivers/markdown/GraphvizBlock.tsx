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
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { graphvizRenderer, GraphvizEngine } from '../../../lib/graphvizRenderer';
import { analyzeGraphvizError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';

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
  onOpenLightbox: () => void;
  onReRender: () => void;
  onDownloadSvg: () => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  locale?: Locale;
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
  locale = 'zh-CN',
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isErrorCopied, setIsErrorCopied] = useState<boolean>(false);
  const renderCountRef = useRef(0);
  const activeCode = editedCode !== undefined ? editedCode : code;

  // 异步加载与渲染 Graphviz SVG (支持 200ms 防抖即时编译)
  useEffect(() => {
    let isCurrent = true;
    const currentRender = ++renderCountRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      graphvizRenderer
        .render(activeCode, (engine || 'dot') as GraphvizEngine)
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
  }, [activeCode, engine]);

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
      onDownloadSvg();
    }
  };

  return (
    <div id={id} className="markdown-diagram markdown-diagram-graphviz group relative">
      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-amber-400">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-semibold">{t('graphvizTitle', locale)}</span>
          <span className="text-slate-400 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase">
            {engine}
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
                onClick={onOpenLightbox}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                title={t('fullScreen', locale)}
                aria-label={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-slate-700 mx-0.5" />
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
        </div>
      </div>

      {/* Body Content */}
      {viewMode === 'visual' ? (
        <div className="p-6 overflow-x-auto flex justify-center bg-slate-950/60 min-h-[160px] items-center">
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
              onDoubleClick={onOpenLightbox}
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
    </div>
  );
};
