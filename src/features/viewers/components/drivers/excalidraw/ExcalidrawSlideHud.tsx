import React from 'react';
import { ChevronLeft, ChevronRight, Focus, Sparkles, X } from 'lucide-react';

export interface ExcalidrawSlideHudProps {
  isZh: boolean;
  frames: any[];
  currentFrameIndex: number;
  onNavigateToFrame: (index: number) => void;
  onOverview: () => void;
  onAutoCreateFrames: () => void;
  onExit: () => void;
}

export const ExcalidrawSlideHud: React.FC<ExcalidrawSlideHudProps> = ({
  isZh,
  frames,
  currentFrameIndex,
  onNavigateToFrame,
  onOverview,
  onAutoCreateFrames,
  onExit,
}) => (
  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 border border-purple-500/40 rounded-2xl shadow-2xl backdrop-blur-md text-slate-200 animate-in fade-in slide-in-from-bottom-4">
    {frames.length > 0 ? (
      <>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs font-semibold border border-purple-500/30">
            {currentFrameIndex + 1} / {frames.length}
          </span>
          <span
            className="text-xs font-medium text-slate-100 max-w-[200px] truncate"
            title={frames[currentFrameIndex]?.name || '未命名画框'}
          >
            {frames[currentFrameIndex]?.name || `Frame ${currentFrameIndex + 1}`}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigateToFrame(currentFrameIndex - 1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title={isZh ? '上一画框 (Left / PageUp)' : 'Previous Frame'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigateToFrame(currentFrameIndex + 1)}
            className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm"
            title={isZh ? '下一画框 (Right / Space / PageDown)' : 'Next Frame'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <button
          onClick={onOverview}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
          title={isZh ? '全景概览 (按键 0)' : 'Overview'}
        >
          <Focus className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">{isZh ? '全景' : 'All'}</span>
        </button>

        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400 font-mono pl-1">
          <span>← / → 翻页</span>
          <span>·</span>
          <span>0 全景</span>
          <span>·</span>
          <span>Esc 退出</span>
        </div>
      </>
    ) : (
      <div className="flex items-center gap-3">
        <span className="text-xs text-amber-300">
          {isZh ? '当前画布暂无 Frame 画框，支持快捷键 F 划定，或：' : 'No frames found on canvas. Use F key or:'}
        </span>
        <button
          onClick={onAutoCreateFrames}
          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isZh ? '智能划定演示画框' : 'Auto Create Frames'}</span>
        </button>
      </div>
    )}

    <button
      onClick={onExit}
      className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition ml-1"
      title={isZh ? '退出演播 (Esc)' : 'Exit Presentation'}
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);
