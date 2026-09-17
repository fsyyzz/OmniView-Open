/**
 * Markdown Excalidraw 画板渲染组件 (纯图片轻量展示模式，参考 Mermaid 规范)
 * 仅显示紧凑矢量图形，支持缩放、全屏、复制与 SVG 导出，彻底与独立编辑窗口解耦
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Eye,
  PenTool,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n.ts';
import { parseExcalidrawJson, renderExcalidrawToSvgString, downloadBlob } from '../excalidraw/excalidrawEngine.ts';
import { ExternalBadgePill } from '../../common/ExternalBadgePill.tsx';

interface ExcalidrawBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  isCopied: boolean;
  viewMode: 'visual' | 'code';
  editedCode: string;
  isDarkTheme?: boolean;
  onChangeEditedCode: (val: string) => void;
  onSetViewMode: (mode: 'visual' | 'code') => void;
  onOpenLightbox: (content?: string) => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  externalFile?: string;
  locale?: Locale;
}

export const ExcalidrawBlock: React.FC<ExcalidrawBlockProps> = React.memo(({
  id,
  code,
  startLine,
  endLine,
  isCopied,
  viewMode,
  editedCode,
  isDarkTheme = true,
  onChangeEditedCode,
  onSetViewMode,
  onOpenLightbox,
  onCopy,
  onOpenSourceAtLine,
  externalFile,
  locale = 'zh-CN',
}) => {
  const activeCode = editedCode !== undefined ? editedCode : code;
  const [zoom, setZoom] = useState<number>(1);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 解析并导出为静态紧凑 SVG 图片
  useEffect(() => {
    let isCurrent = true;
    const parsed = parseExcalidrawJson(activeCode);
    if (!parsed.isValid) {
      setError(parsed.errorMessage || 'Invalid Excalidraw JSON');
      setSvgContent('');
      return;
    }

    renderExcalidrawToSvgString(parsed, { isDarkTheme, padding: 16 })
      .then(res => {
        if (isCurrent) {
          setSvgContent(res.svgString);
          setError(null);
        }
      })
      .catch(err => {
        if (isCurrent) {
          setError(err?.message || 'Failed to render Excalidraw SVG');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeCode, isDarkTheme]);

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, 'excalidraw-sketch.svg');
  };

  const adjustZoom = (delta: number) => {
    setZoom(prev => Math.min(3, Math.max(0.3, Math.round((prev + delta) * 10) / 10)));
  };

  const resetZoom = () => setZoom(1);

  return (
    <div
      id={id}
      data-source-line={startLine}
      data-source-end-line={endLine}
      className="markdown-diagram markdown-diagram-excalidraw group relative"
    >
      {/* Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-purple-400">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-semibold">Excalidraw</span>
          {startLine !== undefined && onOpenSourceAtLine && (
            <button
              onClick={() => onOpenSourceAtLine(startLine)}
              className="text-[10px] text-slate-400 hover:text-purple-400 transition-colors font-mono"
              title={t('openSourceAtLine', locale).replace('{line}', String(startLine))}
            >
              L{startLine}
            </button>
          )}
          {viewMode === 'visual' && (
            <span className="text-slate-400 text-[11px]">({Math.round(zoom * 100)}%)</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1.5 rounded transition ${
                viewMode === 'visual'
                  ? 'bg-purple-600 text-white shadow-sm'
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
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
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
              <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
                <button
                  onClick={() => adjustZoom(-0.2)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition"
                  title={t('zoomOut', locale)}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="px-1.5 text-[10px] font-mono text-slate-300 hover:text-white transition"
                  title={t('resetZoom', locale)}
                >
                  1:1
                </button>
                <button
                  onClick={() => adjustZoom(0.2)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition"
                  title={t('zoomIn', locale)}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fullscreen Lightbox */}
              <button
                onClick={() => onOpenLightbox(svgContent)}
                className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
                title={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Download SVG */}
              {svgContent && (
                <button
                  onClick={handleDownloadSvg}
                  className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
                  title={t('downloadSvg', locale)}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {/* Copy Code */}
          <button
            onClick={onCopy}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
            title={t('copyCode', locale)}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Container: 紧凑自适应居中呈现矢量图片，无多余大片空白 */}
      {viewMode === 'visual' ? (
        <div className="diagram-canvas p-3 flex justify-center items-center min-h-[120px] max-h-[600px] overflow-auto">
          {error ? (
            <div className="text-rose-400 text-xs font-mono p-4">{error}</div>
          ) : svgContent ? (
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="transition-transform duration-150 flex justify-center items-center max-w-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:block cursor-zoom-in"
              onDoubleClick={() => onOpenLightbox(svgContent)}
              title={t('fullScreen', locale)}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className="text-slate-500 text-xs font-mono">Rendering Excalidraw vector...</div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-slate-950">
          <textarea
            value={activeCode}
            onChange={e => onChangeEditedCode(e.target.value)}
            spellCheck={false}
            rows={Math.min(18, Math.max(6, activeCode.split('\n').length + 1))}
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-purple-300 font-mono text-xs leading-relaxed outline-none focus:border-purple-500 transition resize-y"
            placeholder="Enter Excalidraw JSON content..."
          />
        </div>
      )}

      <ExternalBadgePill externalFile={externalFile} />
    </div>
  );
});

ExcalidrawBlock.displayName = 'ExcalidrawBlock';
