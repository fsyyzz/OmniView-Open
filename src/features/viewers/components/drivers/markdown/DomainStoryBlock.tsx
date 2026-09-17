/**
 * Markdown Domain Storytelling (egon.io) 故事讲授渲染组件
 * 支持 Visual / Code 视态双向切换、DiagramStepPlayer 交互演播、Polyglot SVG / .egn 导出
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Eye,
  PlayCircle,
  FileCode,
  Layers,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n.ts';
import {
  parseDomainStory,
  renderDomainStoryToSvg,
  extractDomainStorySteps,
  exportPolyglotSvg,
  exportEgnJson,
  DomainStoryModel,
} from '../../../lib/domainStoryEngine.ts';
import { DiagramStepPlayer } from '../common/DiagramStepPlayer.tsx';
import { ExternalBadgePill } from '../../common/ExternalBadgePill.tsx';

interface DomainStoryBlockProps {
  id: string;
  code: string;
  startLine?: number;
  endLine?: number;
  isCopied: boolean;
  viewMode: 'visual' | 'code';
  zoom: number;
  editedCode: string;
  isDarkTheme?: boolean;
  onChangeEditedCode: (val: string) => void;
  onSetViewMode: (mode: 'visual' | 'code') => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  onOpenLightbox: (svgContent?: string) => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  externalFile?: string;
  locale?: Locale;
}

export const DomainStoryBlock: React.FC<DomainStoryBlockProps> = React.memo(({
  id,
  code,
  startLine,
  endLine,
  isCopied,
  viewMode,
  zoom,
  editedCode,
  isDarkTheme = true,
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
  const [isPlaybackActive, setIsPlaybackActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);

  const activeCode = editedCode !== undefined ? editedCode : code;

  // 解析模型
  const { model, error } = useMemo<{ model: DomainStoryModel; error?: string }>(() => {
    try {
      const parsed = parseDomainStory(activeCode);
      return { model: parsed };
    } catch (err: any) {
      return {
        model: { actors: [], workObjects: [], activities: [] },
        error: err?.message || 'Failed to parse domain story',
      };
    }
  }, [activeCode]);

  // 提取步进步骤
  const steps = useMemo(() => {
    return extractDomainStorySteps(model);
  }, [model]);

  // 渲染 SVG (若处于播放模式，则传递当前步)
  const displaySvg = useMemo(() => {
    return renderDomainStoryToSvg(model, {
      currentStep: isPlaybackActive ? currentStep : -1,
      isDark: isDarkTheme,
    });
  }, [model, isPlaybackActive, currentStep, isDarkTheme]);

  // 导出处理
  const handleDownloadStandardSvg = () => {
    const blob = new Blob([displaySvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.info?.name || 'domain-story'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleDownloadPolyglotSvg = () => {
    const polyglot = exportPolyglotSvg(model, isDarkTheme);
    const blob = new Blob([polyglot], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.info?.name || 'domain-story'}.polyglot.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleDownloadEgnJson = () => {
    const egn = exportEgnJson(model);
    const blob = new Blob([egn], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.info?.name || 'domain-story'}.egn`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  return (
    <div
      id={id}
      data-source-line={startLine}
      data-source-end-line={endLine}
      className="markdown-diagram markdown-diagram-domainstory group relative"
    >
      {/* Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-slate-300">
          <span className="flex items-center gap-1.5 font-semibold text-sky-400">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>{t('domainStoryTitle', locale)}</span>
          </span>
          {model.info?.name && (
            <span className="hidden sm:inline-block text-[11px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/50">
              {model.info.name}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            ({model.actors.length} {t('actorsCount', locale)} · {model.activities.length} {t('activitiesCount', locale)})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1 rounded flex items-center gap-1 text-[11px] transition ${viewMode === 'visual'
                  ? 'bg-sky-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
              title={t('previewTooltip', locale)}
              aria-label={t('preview', locale)}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetViewMode('code')}
              className={`p-1 rounded flex items-center gap-1 text-[11px] transition ${viewMode === 'code'
                  ? 'bg-sky-600 text-white font-medium'
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
              {/* Step Playback Switcher */}
              {steps.length > 0 && (
                <button
                  onClick={() => {
                    const next = !isPlaybackActive;
                    setIsPlaybackActive(next);
                    setCurrentStep(next ? 0 : -1);
                  }}
                  className={`p-1 rounded transition flex items-center gap-1 px-1.5 font-sans text-[11px] ${isPlaybackActive
                      ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-sky-400'
                    }`}
                  title={t('stepPlaybackTooltip', locale)}
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('stepPlayback', locale)}</span>
                  <span className="text-[10px] opacity-80">({steps.length})</span>
                </button>
              )}

              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-900 rounded border border-slate-700">
                <button
                  onClick={() => onZoomChange(-0.15)}
                  className="p-1 text-slate-300 hover:text-white rounded-l hover:bg-slate-800 transition"
                  title={t('zoomOut', locale)}
                  aria-label={t('zoomOut', locale)}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onResetZoom}
                  className="px-1 text-[10px] font-mono text-slate-300 hover:text-white transition"
                  title={t('zoomReset', locale)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => onZoomChange(0.15)}
                  className="p-1 text-slate-300 hover:text-white rounded-r hover:bg-slate-800 transition"
                  title={t('zoomIn', locale)}
                  aria-label={t('zoomIn', locale)}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lightbox Button */}
              <button
                onClick={() => onOpenLightbox(displaySvg)}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                title={t('fullScreen', locale)}
                aria-label={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              <div className="h-3 w-px bg-slate-700 mx-0.5" />

              {/* Export Menu */}
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen(prev => !prev)}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition flex items-center gap-1"
                  title={t('moreActions', locale)}
                  aria-label={t('moreActions', locale)}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {exportMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-30 text-xs">
                    <button
                      onClick={handleDownloadPolyglotSvg}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-sky-300 flex items-center gap-2"
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>{t('exportPolyglotSvg', locale)}</span>
                    </button>
                    <button
                      onClick={handleDownloadEgnJson}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('exportEgn', locale)}</span>
                    </button>
                    <button
                      onClick={handleDownloadStandardSvg}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('downloadSvg', locale)}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="text-[11px] text-sky-400 font-mono px-1">
              ⚡ DSL / JSON
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

      {/* Body: Visual vs Code: 紧凑自适应居中呈现矢量图片，无多余大片空白 */}
      {viewMode === 'visual' ? (
        <div className="p-2.5 overflow-x-auto flex justify-center items-center bg-[var(--ov-diagram-canvas-bg,transparent)] min-h-[100px] relative [&>div>svg]:max-w-full [&>div>svg]:h-auto [&>div>svg]:block">
          {error ? (
            <div className="flex items-center gap-2 text-rose-400 bg-rose-950/30 border border-rose-800/40 p-4 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="diagram-canvas transition-transform duration-150 flex justify-center cursor-zoom-in max-w-full"
              onDoubleClick={() => onOpenLightbox(displaySvg)}
              title={t('fullScreen', locale)}
              dangerouslySetInnerHTML={{ __html: displaySvg }}
            />
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-950">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>{t('editDiagramSource', locale)} (DSL / JSON):</span>
            <span>{activeCode.split('\n').length} {t('linesCode', locale)}</span>
          </div>
          <textarea
            value={activeCode}
            onChange={e => onChangeEditedCode(e.target.value)}
            spellCheck={false}
            rows={Math.min(18, Math.max(6, activeCode.split('\n').length + 1))}
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-sky-300 font-mono text-xs leading-relaxed outline-none focus:border-sky-500 transition resize-y"
          />
        </div>
      )}

      {/* Floating Diagram Step-by-Step Player HUD */}
      {viewMode === 'visual' && isPlaybackActive && steps.length > 0 && (
        <DiagramStepPlayer
          steps={steps}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onClose={() => {
            setIsPlaybackActive(false);
            setCurrentStep(-1);
          }}
          diagramType="sequence"
          locale={locale}
        />
      )}

      <ExternalBadgePill externalFile={externalFile} />
    </div>
  );
});

DomainStoryBlock.displayName = 'DomainStoryBlock';
