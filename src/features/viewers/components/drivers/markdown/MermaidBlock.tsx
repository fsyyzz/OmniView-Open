/**
 * Markdown Mermaid 图表渲染组件 (纯图标 + 悬浮提示 + 多语言支持 + 实时即时编译)
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import mermaid from 'mermaid';
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
  PlayCircle,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { analyzeMermaidError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';
import {
  detectDiagramPlaybackSupport,
  applyStepHighlightToSvg,
} from '../../../lib/diagramPlaybackEngine';
import { DiagramStepPlayer } from '../common/DiagramStepPlayer';

interface MermaidBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  svgContent?: string;
  error?: string;
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
  onDownloadSvg: () => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  locale?: Locale;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = React.memo(({
  id,
  code,
  startLine,
  endLine,
  svgContent,
  error,
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
  const [liveSvg, setLiveSvg] = useState<string>(svgContent || '');
  const [liveError, setLiveError] = useState<string | undefined>(error);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const renderCountRef = useRef<number>(0);
  const activeCode = editedCode !== undefined ? editedCode : code;

  // 探测是否支持步进播放（时序图/状态图/流程图）
  const playbackInfo = useMemo(() => detectDiagramPlaybackSupport(activeCode), [activeCode]);

  // 当外部初始 svgContent/error 变化且未被修改时同步
  useEffect(() => {
    if (svgContent !== undefined && (!editedCode || editedCode === code)) {
      setLiveSvg(svgContent);
      setLiveError(error);
    }
  }, [svgContent, error, code, editedCode]);

  // 实时编译：仅当用户改过源码，或尚无可用 svgContent 时跑防抖 render
  useEffect(() => {
    const isDirty = Boolean(editedCode !== undefined && editedCode !== code);
    const hasSeedSvg = Boolean(svgContent) && !isDirty;

    if (hasSeedSvg) {
      setIsCompiling(false);
      return;
    }

    let isCurrent = true;
    const count = ++renderCountRef.current;
    setIsCompiling(true);

    const timer = setTimeout(async () => {
      try {
        const uniqueId = `mermaid-live-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, activeCode);
        if (isCurrent && count === renderCountRef.current) {
          setLiveSvg(svg);
          setLiveError(undefined);
          setIsCompiling(false);
        }
      } catch (err: any) {
        if (isCurrent && count === renderCountRef.current) {
          setLiveError(err?.message || 'Mermaid Error');
          setIsCompiling(false);
        }
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [activeCode, code, editedCode, svgContent]);

  // 计算应用步进高亮后的 SVG 内容
  const displaySvg = useMemo(() => {
    if (!liveSvg) return '';
    if (!isPlaybackActive || currentStep < 0) return liveSvg;
    return applyStepHighlightToSvg(liveSvg, currentStep, playbackInfo.stepCount, playbackInfo.diagramType);
  }, [liveSvg, isPlaybackActive, currentStep, playbackInfo]);

  const handleDownload = () => {
    if (liveSvg) {
      const blob = new Blob([liveSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mermaid-diagram.svg';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      onDownloadSvg();
    }
  };

  return (
    <div id={id} className="markdown-diagram markdown-diagram-mermaid group relative">
      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-cyan-400">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold">{t('mermaidTitle', locale)}</span>
          {viewMode === 'visual' && (
            <span className="text-slate-400 text-[11px]">({Math.round(zoom * 100)}%)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* View Mode Toggle: 纯图标带 Tooltip */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-750 mr-1">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1.5 rounded transition ${
                viewMode === 'visual'
                  ? 'bg-cyan-600 text-white shadow-sm'
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
                  ? 'bg-cyan-600 text-white shadow-sm'
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
              {playbackInfo.isSupported && (
                <>
                  <button
                    onClick={() => {
                      if (isPlaybackActive) {
                        setIsPlaybackActive(false);
                        setCurrentStep(-1);
                      } else {
                        setIsPlaybackActive(true);
                        setCurrentStep(0);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition border font-medium ${
                      isPlaybackActive
                        ? 'bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-600/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    }`}
                    title={t('stepPlaybackTooltip', locale)}
                    aria-label={t('stepPlayback', locale)}
                  >
                    <PlayCircle className={`w-3.5 h-3.5 ${isPlaybackActive ? 'text-white animate-pulse' : 'text-cyan-400'}`} />
                    <span className="hidden sm:inline">{t('stepPlayback', locale)}</span>
                    <span className="text-[10px] opacity-75 font-mono">({playbackInfo.stepCount})</span>
                  </button>
                  <div className="h-3 w-px bg-slate-700 mx-0.5" />
                </>
              )}

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
                onClick={() => onOpenLightbox(displaySvg || liveSvg)}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                title={t('fullScreen', locale)}
                aria-label={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-slate-700 mx-0.5" />
              {liveSvg && (
                <button
                  onClick={handleDownload}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                  title={t('downloadSvg', locale)}
                  aria-label={t('downloadSvg', locale)}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-cyan-400/80 font-mono px-1 flex items-center gap-1">
              {isCompiling ? <RefreshCw className="w-3 h-3 animate-spin" /> : '⚡'} Live
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

      {/* Body: Visual vs Code */}
      {viewMode === 'visual' ? (
        <div className="p-6 overflow-x-auto flex justify-center bg-slate-950/60 min-h-[140px] items-center relative">
          {liveError ? (
            <DiagramDiagnosticCard
              diagnostic={analyzeMermaidError(activeCode, liveError, startLine, endLine, locale)}
              locale={locale}
              isRestored={!liveError && activeCode !== code}
              onApplyQuickFix={fixed => onChangeEditedCode(fixed)}
              onOpenSourceAtLine={onOpenSourceAtLine}
              onToggleCodeView={() => onSetViewMode('code')}
              onReRender={onReRender}
            />
          ) : displaySvg ? (
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="diagram-canvas transition-transform duration-150 flex justify-center cursor-zoom-in"
              onDoubleClick={() => onOpenLightbox(displaySvg)}
              title={t('fullScreen', locale)}
              dangerouslySetInnerHTML={{ __html: displaySvg }}
            />
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-8">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>{t('renderingDiagram', locale)}</span>
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
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-cyan-300 font-mono text-xs leading-relaxed outline-none focus:border-cyan-500 transition resize-y"
          />
        </div>
      )}

      {/* Floating Diagram Step-by-Step Player HUD */}
      {viewMode === 'visual' && isPlaybackActive && playbackInfo.isSupported && (
        <DiagramStepPlayer
          steps={playbackInfo.steps}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onClose={() => {
            setIsPlaybackActive(false);
            setCurrentStep(-1);
          }}
          diagramType={playbackInfo.diagramType}
          locale={locale}
        />
      )}
    </div>
  );
});

MermaidBlock.displayName = 'MermaidBlock';
