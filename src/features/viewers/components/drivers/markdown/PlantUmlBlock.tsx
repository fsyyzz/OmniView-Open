/**
 * Markdown PlantUML 架构图渲染组件 (纯图标 + 悬浮提示 + 多语言支持 + 实时即时编译)
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
  ExternalLink,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { getPlantUmlSvgUrl, hasRenderablePlantUmlCode, withPlantUmlCacheBust } from '../../../../../shared/lib/plantuml';
import { analyzePlantUmlError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';

interface PlantUmlBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  svgUrl?: string;
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
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  locale?: Locale;
}

export const PlantUmlBlock: React.FC<PlantUmlBlockProps> = ({
  id,
  code,
  startLine,
  endLine,
  svgUrl,
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
  const [hasError, setHasError] = React.useState<boolean>(false);
  const [renderNonce, setRenderNonce] = React.useState(0);
  const activeCode = editedCode !== undefined ? editedCode : code;
  const canRender = hasRenderablePlantUmlCode(activeCode);
  const activeSvgUrl = canRender ? withPlantUmlCacheBust(getPlantUmlSvgUrl(activeCode), renderNonce) : '';

  React.useEffect(() => {
    setHasError(false);
    setRenderNonce(n => n + 1);
  }, [activeCode]);

  return (
    <div id={id} className="markdown-diagram markdown-diagram-plantuml group relative">
      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-purple-400">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-semibold">{t('plantUmlTitle', locale)}</span>
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
              <a
                href={activeSvgUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                title={t('highResImage', locale)}
                aria-label={t('highResImage', locale)}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <span className="text-[11px] text-purple-400/80 font-mono px-1">
              ⚡ Live
            </span>
          )}

          <div className="h-3 w-px bg-slate-700 mx-0.5" />

          {/* Copy Button */}
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

      {/* PlantUML Body */}
      {viewMode === 'visual' ? (
        <div className="p-6 overflow-x-auto flex justify-center bg-slate-950/60 min-h-[160px] items-center">
          {hasError ? (
            <DiagramDiagnosticCard
              diagnostic={analyzePlantUmlError(
                activeCode,
                'PlantUML 渲染服务无响应或网络异常 (Network / Render Server Error)',
                startLine,
                endLine,
                locale
              )}
              locale={locale}
              isRestored={!hasError && activeCode !== code}
              onApplyQuickFix={(fixed) => onChangeEditedCode(fixed)}
              onOpenSourceAtLine={onOpenSourceAtLine}
              onToggleCodeView={() => onSetViewMode('code')}
              onReRender={() => {
                setHasError(false);
                setRenderNonce(n => n + 1);
                onReRender();
              }}
            />
          ) : !canRender ? (
            <div className="text-xs text-slate-400 py-8 text-center">
              暂无可渲染的 PlantUML 内容（空图会被显示成白点，已拦截）
            </div>
          ) : (
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="diagram-canvas transition-transform duration-150 flex justify-center max-w-full cursor-zoom-in"
              onDoubleClick={onOpenLightbox}
              title={t('fullScreen', locale)}
            >
              <img
                key={activeSvgUrl}
                src={activeSvgUrl}
                alt="PlantUML Diagram"
                className="max-w-none rounded shadow-sm bg-white/95 p-3"
                loading="lazy"
                onError={() => {
                  setHasError(true);
                }}
              />
            </div>
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
            onChange={e => onChangeEditedCode(e.target.value)}
            spellCheck={false}
            rows={Math.min(18, Math.max(5, activeCode.split('\n').length + 1))}
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-purple-300 font-mono text-xs leading-relaxed outline-none focus:border-purple-500 transition resize-y"
          />
        </div>
      )}
    </div>
  );
};
