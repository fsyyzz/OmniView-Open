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
import { ExternalBadgePill } from '../../common/ExternalBadgePill';
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
  onDownloadSvg?: () => void;
  onCopy?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  externalFile?: string;
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
  externalFile,
  locale = 'zh-CN',
}) => {
  const [liveSvg, setLiveSvg] = useState<string>(svgContent || '');
  const [liveError, setLiveError] = useState<string | undefined>(error);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [hoveredNodeInfo, setHoveredNodeInfo] = useState<{ label: string; line: number } | null>(null);
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

  // 图文联动：鼠标移动探测悬浮节点与对应的源码行
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const nodeEl = target.closest(
      'g.node, g.actor, g.messageText, g.statediagram-state, g.task, g.classGroup, .cluster'
    );
    if (!nodeEl) {
      if (hoveredNodeInfo) setHoveredNodeInfo(null);
      return;
    }
    const text = (nodeEl.textContent || '').trim();
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
    if (matchIdx === -1 && nodeEl.id) {
      const rawId = nodeEl.id.replace(/^flowchart-/, '').split('-')[0];
      if (rawId) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(rawId)) {
            matchIdx = i;
            break;
          }
        }
      }
    }
    if (matchIdx !== -1 && startLine) {
      const calculatedLine = startLine + matchIdx + 1;
      if (!hoveredNodeInfo || hoveredNodeInfo.line !== calculatedLine) {
        setHoveredNodeInfo({ label: text, line: calculatedLine });
      }
    } else if (hoveredNodeInfo) {
      setHoveredNodeInfo(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredNodeInfo(null);
  };

  // 图文联动：点击节点即刻跳转并聚焦高亮 Markdown 源码行
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const nodeEl = target.closest(
      'g.node, g.actor, g.messageText, g.statediagram-state, g.task, g.classGroup, .cluster'
    );
    if (nodeEl && hoveredNodeInfo && onOpenSourceAtLine) {
      e.stopPropagation();
      onOpenSourceAtLine(hoveredNodeInfo.line);
    }
  };

  return (
    <div id={id} className="markdown-diagram markdown-diagram-mermaid group relative">
      {/* Card Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-cyan-400">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold">{t('mermaidTitle', locale)}</span>
          {startLine && onOpenSourceAtLine && (
            <button
              onClick={() => onOpenSourceAtLine(startLine)}
              className="text-[10px] text-slate-400 hover:text-cyan-400 transition-colors font-mono"
              title={t('openSourceAtLine', locale).replace('{line}', String(startLine))}
            >
              L{startLine}
            </button>
          )}
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
                    className={`p-1 rounded transition ${
                      isPlaybackActive
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title={`${t('stepPlayback', locale)} (${playbackInfo.stepCount})`}
                    aria-label={t('stepPlayback', locale)}
                  >
                    <PlayCircle className={`w-3.5 h-3.5 ${isPlaybackActive ? 'text-white' : 'text-cyan-400'}`} />
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
        <div
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          onClick={handleCanvasClick}
          className="p-2.5 overflow-x-auto flex justify-center bg-[var(--ov-diagram-canvas-bg,transparent)] min-h-[100px] items-center relative group/canvas"
        >
          {/* 图文联动提示徽章：显示当前悬浮节点与其在 Markdown 源码中的精准行号 */}
          {hoveredNodeInfo && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onOpenSourceAtLine?.(hoveredNodeInfo.line);
              }}
              className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 bg-cyan-950/90 border border-cyan-500/50 rounded-full text-cyan-300 text-xs shadow-lg backdrop-blur-sm cursor-pointer hover:bg-cyan-900 transition-all select-none"
              title={t('diagramClickToLocate', locale)}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-semibold max-w-[140px] truncate">{hoveredNodeInfo.label}</span>
              <span className="text-cyan-400/80 font-mono">→ L{hoveredNodeInfo.line}</span>
              <span className="text-[10px] text-cyan-400/60 hidden sm:inline">
                ({t('diagramClickToLocate', locale)})
              </span>
            </div>
          )}

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
              className="diagram-canvas transition-transform duration-150 flex justify-center cursor-pointer max-w-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:block"
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

      <ExternalBadgePill externalFile={externalFile} />
    </div>
  );
});

MermaidBlock.displayName = 'MermaidBlock';
