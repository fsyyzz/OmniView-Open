/**
 * Markdown KaTeX 数学公式交互组件 (支持源码查看/编辑、实时即时编译与全屏灯箱)
 */
import React, { useState, useEffect, useRef } from 'react';
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
  const activeCode = editedCode !== undefined ? editedCode : code;

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
            </>
          ) : (
            <span className="text-[11px] text-emerald-400/80 font-mono px-1">
              ⚡ Live
            </span>
          )}

          <div className="h-3 w-px bg-slate-700 mx-0.5" />

          {/* Copy LaTeX Source */}
          <button
            onClick={onCopy}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title={isCopied ? t('copied', locale) : t('copyMathCode', locale)}
            aria-label={t('copyMathCode', locale)}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body Content */}
      {viewMode === 'visual' ? (
        <div className="p-6 overflow-x-auto flex justify-center bg-slate-950/40 min-h-[90px] items-center">
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
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="diagram-canvas transition-transform duration-150 flex justify-center max-w-full cursor-zoom-in py-2"
              onDoubleClick={onOpenLightbox}
              title={t('fullScreen', locale)}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
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
