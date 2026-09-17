/**
 * Markdown Markmap 思维导图渲染组件
 * 支持 Visual / Code 视态双向切换、卡片 Header Toolbar、放大缩小重置与代码复制
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
  Network,
  RefreshCw,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n.ts';
import { MarkmapViewer } from '../MarkmapViewer.tsx';
import { ExternalBadgePill } from '../../common/ExternalBadgePill.tsx';

interface MarkmapBlockProps {
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
  onOpenLightbox: (content?: string) => void;
  onCopy: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  externalFile?: string;
  locale?: Locale;
}

export const MarkmapBlock: React.FC<MarkmapBlockProps> = React.memo(({
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
  const activeCode = editedCode !== undefined ? editedCode : code;

  return (
    <div
      id={id}
      data-source-line={startLine}
      data-source-end-line={endLine}
      className="markdown-diagram markdown-diagram-markmap group relative"
    >
      {/* Header Toolbar: 悬浮 Overlay 纯图标设计 */}
      <div className={`diagram-header ${viewMode === 'code' ? 'is-code' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-slate-300">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <Network className="w-4 h-4 text-emerald-400" />
            <span>Markmap Mindmap</span>
          </span>
          {startLine !== undefined && onOpenSourceAtLine && (
            <button
              onClick={() => onOpenSourceAtLine(startLine)}
              className="hidden sm:inline-block text-[10px] text-slate-400 hover:text-sky-400 transition"
              title={t('doubleClickToLocate', locale)}
            >
              L{startLine}
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => onSetViewMode('visual')}
              className={`p-1 rounded flex items-center gap-1 text-[11px] transition ${
                viewMode === 'visual'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('previewTooltip', locale)}
              aria-label={t('preview', locale)}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetViewMode('code')}
              className={`p-1 rounded flex items-center gap-1 text-[11px] transition ${
                viewMode === 'code'
                  ? 'bg-emerald-600 text-white font-medium'
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
                  onClick={() => onZoomChange(-0.1)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition"
                  title={t('zoomOut', locale)}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onResetZoom}
                  className="px-1.5 text-[10px] font-mono text-slate-300 hover:text-white transition"
                  title={t('resetZoom', locale)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => onZoomChange(0.1)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition"
                  title={t('zoomIn', locale)}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lightbox Modal Button */}
              <button
                onClick={() => onOpenLightbox(activeCode)}
                className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
                title={t('fullScreen', locale)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
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

      {/* Main Container: 紧凑自适应居中呈现思维导图，无多余大片空白 */}
      <div className="diagram-canvas relative h-[280px] bg-slate-950/40 p-1.5 overflow-hidden flex items-center justify-center">
        {viewMode === 'visual' ? (
          <div
            className="w-full h-full transition-transform duration-150 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <MarkmapViewer
              content={activeCode}
              isDarkTheme={isDarkTheme}
              locale={locale}
              onOpenSourceAtLine={onOpenSourceAtLine}
              embedded={true}
            />
          </div>
        ) : (
          <div className="p-3">
            <textarea
              value={activeCode}
              onChange={e => onChangeEditedCode(e.target.value)}
              className="w-full h-[320px] font-mono text-xs bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 resize-y"
              placeholder="Enter Markmap Markdown content..."
            />
          </div>
        )}
      </div>

      <ExternalBadgePill externalFile={externalFile} />
    </div>
  );
});

MarkmapBlock.displayName = 'MarkmapBlock';
