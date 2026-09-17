/**
 * Markdown KaTeX 数学公式交互组件 (支持源码查看/编辑、实时即时编译与全屏灯箱)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import {
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Eye,
  AlertCircle,
  Sigma,
  Download,
  FileCode2,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { analyzeKatexError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';

interface MathBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  isCopied: boolean;
  viewMode: 'visual' | 'code';
  zoom: number;
  editedCode: string;
  onChangeEditedCode: (val: string) => void;
  onSetViewMode: (mode: 'visual' | 'code') => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  onOpenLightbox: () => void;
  onReRender?: () => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  locale?: Locale;
}

export const MathBlock: React.FC<MathBlockProps> = ({
  id,
  code,
  startLine,
  endLine,
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
  onCopy,
  onOpenSourceAtLine,
  locale = 'zh-CN',
}) => {
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isErrorCopied, setIsErrorCopied] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<'latex' | 'mathml' | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const formulaRef = useRef<HTMLDivElement>(null);
  const activeCode = editedCode !== undefined ? editedCode : code;

  // 检查横向溢出与滚动状态
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasScroll = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(hasScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, renderedHtml, zoom]);

  // 实时编译 KaTeX 数学公式 (支持即时热响应)
  useEffect(() => {
    try {
      const html = katex.renderToString(activeCode.trim(), {
        displayMode: true,
        throwOnError: true,
        errorColor: '#f43f5e',
      });
      setRenderedHtml(html);
      setError(null);
    } catch (err: any) {
      try {
        // 尝试非严格模式容错标红渲染
        const fallbackHtml = katex.renderToString(activeCode.trim(), {
          displayMode: true,
          throwOnError: false,
          errorColor: '#f43f5e',
        });
        setRenderedHtml(fallbackHtml);
        setError(err?.message || 'KaTeX 语法解析错误');
      } catch (fatalErr: any) {
        setRenderedHtml('');
        setError(fatalErr?.message || '公式无法解析');
      }
    }
  }, [activeCode]);

  // 复制原生 LaTeX 源码
  const handleCopyLatex = () => {
    onCopy();
    setCopiedType('latex');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // 复制 MathML (适合直接粘贴进 Office Word / WPS)
  const handleCopyMathML = async () => {
    try {
      const mathml = katex.renderToString(activeCode.trim(), {
        output: 'mathml',
        displayMode: true,
        throwOnError: false,
      });
      const cleanMathML = mathml.replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '');
      await navigator.clipboard.writeText(cleanMathML);
      setCopiedType('mathml');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy MathML', err);
    }
  };

  // 导出公式为高清矢量 SVG
  const handleExportSvg = () => {
    try {
      const formulaEl = formulaRef.current;
      const width = Math.max(320, formulaEl ? formulaEl.scrollWidth + 48 : 640);
      const height = Math.max(120, formulaEl ? formulaEl.scrollHeight + 48 : 180);
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    @import url('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css');
    .katex-wrapper { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: KaTeX_Main, Times New Roman, serif; color: #0f172a; }
  </style>
  <rect width="100%" height="100%" fill="transparent"/>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" class="katex-wrapper">
      ${renderedHtml}
    </div>
  </foreignObject>
</svg>`;
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `formula-${id || 'equation'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export SVG', e);
    }
  };

  const handleCopyError = () => {
    if (error) {
      navigator.clipboard.writeText(error);
      setIsErrorCopied(true);
      setTimeout(() => setIsErrorCopied(false), 2000);
    }
  };

  return (
    <div id={id} className="markdown-diagram markdown-diagram-math group relative my-4">
      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-emerald-400">
          <Sigma className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold">{t('mathFormula', locale)}</span>
          <span className="text-slate-400 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
            LaTeX
          </span>
          {startLine && onOpenSourceAtLine && (
            <button
              onClick={() => onOpenSourceAtLine(startLine)}
              className="text-[10px] text-slate-400 hover:text-emerald-400 transition-colors"
              title={t('openSourceAtLine', locale).replace('{line}', String(startLine))}
            >
              L{startLine}
            </button>
          )}
          {viewMode === 'visual' && (
            <span className="text-slate-400 text-[11px]">({Math.round(zoom * 100)}%)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-750 mr-1">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1.5 rounded transition ${
                viewMode === 'visual'
                  ? 'bg-emerald-600 text-white shadow-sm'
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
                  ? 'bg-emerald-600 text-white shadow-sm'
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

              {/* 导出 SVG 按钮 */}
              <button
                onClick={handleExportSvg}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                title={t('exportMathSvg', locale)}
                aria-label={t('exportMathSvg', locale)}
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* 复制 MathML (适合粘贴 Office Word / WPS) */}
              <button
                onClick={handleCopyMathML}
                className="flex items-center gap-1 px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition text-[11px]"
                title={t('copyMathML', locale)}
                aria-label={t('copyMathML', locale)}
              >
                {copiedType === 'mathml' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400 text-[10px]">MathML</span>
                  </>
                ) : (
                  <>
                    <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-mono">MathML</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <span className="text-[11px] text-emerald-400/80 font-mono px-1">
              ⚡ Live
            </span>
          )}

          <div className="h-3 w-px bg-slate-700 mx-0.5" />

          {/* 复制 LaTeX 源码 */}
          <button
            onClick={handleCopyLatex}
            className="flex items-center gap-1 p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title={copiedType === 'latex' || isCopied ? t('copied', locale) : t('copyMathCode', locale)}
            aria-label={t('copyMathCode', locale)}
          >
            {copiedType === 'latex' || isCopied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Body Content */}
      {viewMode === 'visual' ? (
        <div className="relative group/canvas">
          {/* 横向滚动左边缘阴影遮罩 */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--ov-diagram-mask-from,rgba(15,23,42,0.8))] to-transparent pointer-events-none z-10" />
          )}

          {/* 横向滚动右边缘阴影遮罩 */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--ov-diagram-mask-from,rgba(15,23,42,0.8))] to-transparent pointer-events-none z-10" />
          )}

          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="p-6 overflow-x-auto flex justify-center bg-[var(--ov-diagram-canvas-bg,transparent)] min-h-[90px] items-center scrollbar-thin scrollbar-thumb-slate-700"
          >
            {error && !renderedHtml ? (
              <DiagramDiagnosticCard
                diagnostic={analyzeKatexError(activeCode, error, startLine, endLine, locale)}
                locale={locale}
                isRestored={!error && activeCode !== code}
                onApplyQuickFix={(fixed) => onChangeEditedCode(fixed)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                onToggleCodeView={() => onSetViewMode('code')}
                onReRender={onReRender}
              />
            ) : (
              <div
                ref={formulaRef}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="diagram-canvas transition-transform duration-150 flex justify-center max-w-full cursor-zoom-in py-2"
                onDoubleClick={onOpenLightbox}
                title={t('fullScreen', locale)}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-950">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>{t('editMathSource', locale)}:</span>
            <span>{activeCode.split('\n').length} {t('linesCode', locale)}</span>
          </div>
          <textarea
            value={activeCode}
            onChange={(e) => onChangeEditedCode(e.target.value)}
            spellCheck={false}
            rows={Math.min(14, Math.max(4, activeCode.split('\n').length + 1))}
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-300 font-mono text-xs leading-relaxed outline-none focus:border-emerald-500 transition resize-y"
          />
          {error && (
            <div className="mt-2 flex items-center justify-between text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/50">
              <span className="font-mono text-[11px]">{error}</span>
              <button
                onClick={handleCopyError}
                className="text-[10px] underline hover:text-rose-200"
              >
                {isErrorCopied ? t('errorCopied', locale) : t('errorCopyDetails', locale)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

