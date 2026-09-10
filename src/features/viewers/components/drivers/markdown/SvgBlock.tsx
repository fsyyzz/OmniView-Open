/**
 * Markdown SVG 图表渲染组件 (纯图标 + 悬浮提示 + 多语言支持 + 实时即时编译)
 */
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Copy,
  Check,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Eye,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';

interface SvgBlockProps {
  id: string;
  mode?: 'code-block' | 'file';
  title?: string;
  fileName?: string;
  rawCode: string;
  svgContent?: string;
  isCopied: boolean;
  viewMode: 'visual' | 'code';
  bgMode: 'dark' | 'grid' | 'light';
  zoom: number;
  editedCode: string;
  onChangeEditedCode: (val: string) => void;
  onSetViewMode: (mode: 'visual' | 'code') => void;
  onSetBgMode: (mode: 'dark' | 'grid' | 'light') => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  onOpenLightbox: () => void;
  onReRender: () => void;
  onDownloadSvg: () => void;
  onCopy: () => void;
  locale?: Locale;
}

const DOMPURIFY_SVG_CONFIG: Record<string, any> = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_TAGS: [
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop',
    'use', 'symbol', 'filter', 'feDropShadow', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
    'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA',
    'feFuncB', 'feFuncG', 'feFuncR', 'feImage', 'feMorphology', 'fePointLight',
    'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'image', 'pattern', 'mask'
  ],
  ADD_ATTR: [
    'viewBox', 'xmlns', 'xmlns:xlink', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'fill-opacity',
    'stroke-opacity', 'transform', 'style', 'id', 'class', 'gradientUnits', 'gradientTransform',
    'offset', 'stop-color', 'stop-opacity', 'preserveAspectRatio', 'text-anchor', 'font-family',
    'font-size', 'font-weight', 'letter-spacing', 'dominant-baseline', 'href', 'xlink:href',
    'target', 'rel', 'crossorigin', 'points', 'dx', 'dy', 'stdDeviation', 'flood-color', 'flood-opacity',
    'marker-end', 'marker-start', 'marker-mid'
  ],
};

export const SvgBlock: React.FC<SvgBlockProps> = ({
  id,
  mode = 'code-block',
  title,
  fileName,
  rawCode,
  svgContent,
  isCopied,
  viewMode,
  bgMode,
  zoom,
  editedCode,
  onChangeEditedCode,
  onSetViewMode,
  onSetBgMode,
  onZoomChange,
  onResetZoom,
  onOpenLightbox,
  onDownloadSvg,
  onCopy,
  locale = 'zh-CN',
}) => {
  const activeCode = editedCode !== undefined ? editedCode : rawCode;
  const sanitizedLiveSvg = useMemo(() => {
    return DOMPurify.sanitize(activeCode, DOMPURIFY_SVG_CONFIG) as string;
  }, [activeCode]);

  const bgClasses = {
    dark: 'bg-slate-950/70',
    grid: 'bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]',
    light: 'bg-white/95 text-slate-900',
  }[bgMode];

  const modeBadge = {
    'code-block': {
      border: 'border-emerald-900/50',
      accent: 'text-emerald-400',
      dot: 'bg-emerald-400',
      badge: '```svg',
    },
    file: {
      border: 'border-cyan-900/50',
      accent: 'text-cyan-400',
      dot: 'bg-cyan-400',
      badge: '.svg',
    },
  }[mode] || {
    border: 'border-emerald-900/50',
    accent: 'text-emerald-400',
    dot: 'bg-emerald-400',
    badge: 'SVG',
  };

  return (
    <div id={id} className={`markdown-diagram ${modeBadge.border} group relative`}>
      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className={`flex items-center gap-2 font-mono ${modeBadge.accent}`}>
          <span className={`inline-block w-2 h-2 rounded-full ${modeBadge.dot} animate-pulse`} />
          <span className="font-semibold">{title || (mode === 'file' ? t('svgLocalFile', locale) : t('svgCodeBlock', locale))}</span>
          {fileName && <span className="text-slate-400 text-[11px]">({fileName})</span>}
          <span className="text-slate-400 text-[10px] hidden sm:inline px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
            {modeBadge.badge}
          </span>
          <span className="text-slate-400 text-[11px]">({Math.round(zoom * 100)}%)</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* View Mode Toggle: 纯图标带 Tooltip */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-750 mr-1">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1.5 rounded transition ${
                viewMode === 'visual'
                  ? 'bg-blue-600 text-white shadow-sm'
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('codeTooltip', locale)}
              aria-label={t('code', locale)}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas Background Toggle (纯图标 / 极简文字带 Tooltip) */}
          {viewMode === 'visual' && (
            <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-750 mr-1">
              <button
                onClick={() => onSetBgMode('dark')}
                className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                  bgMode === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('bgDark', locale)}
              >
                Dark
              </button>
              <button
                onClick={() => onSetBgMode('grid')}
                className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                  bgMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('bgGrid', locale)}
              >
                Grid
              </button>
              <button
                onClick={() => onSetBgMode('light')}
                className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                  bgMode === 'light' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('bgLight', locale)}
              >
                Light
              </button>
            </div>
          )}

          {/* Zoom Controls */}
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
            </>
          ) : (
            <span className="text-[11px] text-blue-400/80 font-mono px-1">
              ⚡ Live
            </span>
          )}

          {/* Download & Copy */}
          <button
            onClick={onDownloadSvg}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title={t('downloadSvg', locale)}
            aria-label={t('downloadSvg', locale)}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCopy}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title={isCopied ? t('copied', locale) : t('copyCode', locale)}
            aria-label={t('copyCode', locale)}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className={`p-6 overflow-x-auto flex justify-center min-h-[160px] items-center transition-colors ${bgClasses}`}>
        {viewMode === 'code' ? (
          <div className="w-full">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span>{t('editDiagramSource', locale)}:</span>
              <span>{activeCode.split('\n').length} {t('linesCode', locale)}</span>
            </div>
            <textarea
              value={activeCode}
              onChange={e => onChangeEditedCode(e.target.value)}
              spellCheck={false}
              rows={Math.min(18, Math.max(6, activeCode.split('\n').length + 1))}
              className="w-full p-3.5 bg-slate-950/90 border border-slate-800 rounded-lg text-emerald-300 font-mono text-xs leading-relaxed outline-none focus:border-blue-500 transition resize-y"
            />
          </div>
        ) : (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="diagram-canvas transition-transform duration-150 flex justify-center max-w-full [&>svg]:max-w-full [&>svg]:h-auto cursor-zoom-in"
            onDoubleClick={onOpenLightbox}
            title={t('fullScreen', locale)}
            dangerouslySetInnerHTML={{ __html: sanitizedLiveSvg }}
          />
        )}
      </div>
    </div>
  );
};
