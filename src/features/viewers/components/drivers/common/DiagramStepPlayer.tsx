/**
 * OmniView 图表步进播放控制器 (Diagram Step Player HUD)
 * 提供时序图/状态图/流程图的逐步演示、自动播放、步骤抽屉、时间轴拖拽与快捷键控制
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Repeat,
  X,
  List,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Zap,
  Clock,
} from 'lucide-react';
import { DiagramStep } from '../../../lib/diagramPlaybackEngine';
import { Locale, t } from '../../../../../shared/lib/i18n';

export interface DiagramStepPlayerProps {
  steps: DiagramStep[];
  currentStep: number; // 0 ~ steps.length - 1; -1 表示未开启播放
  onStepChange: (stepIndex: number) => void;
  onClose: () => void;
  diagramType?: string;
  locale?: Locale;
}

const SPEED_OPTIONS = [
  { label: '0.5x', delay: 2600 },
  { label: '1.0x', delay: 1400 },
  { label: '1.5x', delay: 900 },
  { label: '2.0x', delay: 500 },
];

export const DiagramStepPlayer: React.FC<DiagramStepPlayerProps> = ({
  steps,
  currentStep,
  onStepChange,
  onClose,
  diagramType = 'sequence',
  locale = 'zh-CN',
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedIdx, setSpeedIdx] = useState<number>(1); // 默认 1.0x (1400ms)
  const [isLoop, setIsLoop] = useState<boolean>(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSteps = steps.length;
  const activeIdx = Math.max(0, Math.min(totalSteps - 1, currentStep >= 0 ? currentStep : 0));
  const activeStep = steps[activeIdx];
  const activeIdxRef = useRef<number>(activeIdx);
  activeIdxRef.current = activeIdx;

  // 播放/暂停时序循环器
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isPlaying || totalSteps <= 0) return;

    const delay = SPEED_OPTIONS[speedIdx].delay;
    timerRef.current = setInterval(() => {
      const cur = activeIdxRef.current;
      const next = cur + 1;
      if (next >= totalSteps) {
        if (isLoop) {
          onStepChange(0);
        } else {
          setIsPlaying(false);
          onStepChange(totalSteps - 1);
        }
      } else {
        onStepChange(next);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speedIdx, isLoop, totalSteps, onStepChange]);

  // 全局键盘快捷键 (空格播放/暂停, 左右方向键步进, Esc 退出)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中打字时误触
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault();
        setIsPlaying(false);
        onStepChange(Math.min(totalSteps - 1, activeIdx + 1));
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        setIsPlaying(false);
        onStepChange(Math.max(0, activeIdx - 1));
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIdx, totalSteps, onStepChange, onClose]);

  const handleTogglePlay = () => {
    if (!isPlaying && activeIdx >= totalSteps - 1) {
      // 若已到末尾，重新从头播放
      onStepChange(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    onStepChange(Math.max(0, activeIdx - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    onStepChange(Math.min(totalSteps - 1, activeIdx + 1));
  };

  const handleCycleSpeed = () => {
    setSpeedIdx((speedIdx + 1) % SPEED_OPTIONS.length);
  };

  const typeBadgeLabel =
    diagramType === 'state'
      ? t('statePlayback', locale) || '状态图时序'
      : diagramType === 'flowchart'
        ? t('flowPlayback', locale) || '流程图时序'
        : t('sequencePlayback', locale) || '时序通信步进';

  return (
    <div
      id="diagram-step-player-hud"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-3 animate-fade-in select-none"
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/50 p-3 text-xs text-slate-200">
        {/* Top Bar: Title, Step Tag & Close */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              {t('stepPlayerTitle', locale) || '步进播放器'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-[10px] text-cyan-300 font-mono">
              {typeBadgeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-cyan-400 font-medium">
              {activeIdx + 1} / {totalSteps} {t('stepsCount', locale) || '步'}
            </span>
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`p-1 rounded transition border ${
                isDrawerOpen
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={t('toggleStepList', locale) || '展开/收起全部步骤清单'}
              aria-label="步骤清单"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
              title={t('exitPlayback', locale) || '退出步进播放 (Esc)'}
              aria-label="退出"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active Step Content Card */}
        {activeStep && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 mb-2.5 transition-all">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="text-cyan-400 font-semibold">
                #{activeIdx + 1} {activeStep.type.toUpperCase()}
              </span>
              <span className="text-[10px] text-slate-500">
                L{activeStep.lineNumber}
              </span>
            </div>
            <div className="text-xs text-white font-medium line-clamp-2 leading-relaxed">
              {activeStep.label}
            </div>
          </div>
        )}

        {/* Timeline Scrubber Bar */}
        <div className="px-1 mb-2.5">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={activeIdx}
            onChange={e => {
              setIsPlaying(false);
              onStepChange(parseInt(e.target.value, 10));
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
          />
        </div>

        {/* Controls Toolbar: Prev, Play/Pause, Next, Speed, Loop */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsPlaying(false);
                onStepChange(0);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
              title={t('resetToStart', locale) || '回到第 1 步'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handlePrev}
              disabled={activeIdx === 0}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 transition"
              title={t('prevStepTooltip', locale) || '上一步 (← 方向键)'}
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleTogglePlay}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg shadow-lg shadow-cyan-600/30 transition text-xs"
              title={isPlaying ? '暂停 (空格键)' : '开始自动步进演示 (空格键)'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? t('pause', locale) || '暂停' : t('play', locale) || '播放'}</span>
            </button>

            <button
              onClick={handleNext}
              disabled={activeIdx === totalSteps - 1}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 transition"
              title={t('nextStepTooltip', locale) || '下一步 (→ 方向键)'}
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speed Selector */}
            <button
              onClick={handleCycleSpeed}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-[11px] font-mono transition"
              title={t('speedTooltip', locale) || '循环切换播放倍速'}
            >
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{SPEED_OPTIONS[speedIdx].label}</span>
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLoop(!isLoop)}
              className={`p-1.5 rounded-lg border transition ${
                isLoop
                  ? 'bg-cyan-950/80 border-cyan-600 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={isLoop ? (t('loopOn', locale) || '循环播放: 开') : (t('loopOff', locale) || '循环播放: 关')}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable Step List Drawer */}
        {isDrawerOpen && (
          <div className="mt-3 pt-2.5 border-t border-slate-800 max-h-48 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
            {steps.map((st, i) => {
              const isCur = i === activeIdx;
              return (
                <button
                  key={st.id}
                  onClick={() => {
                    setIsPlaying(false);
                    onStepChange(i);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between gap-2 ${
                    isCur
                      ? 'bg-cyan-600/30 border border-cyan-500/60 text-cyan-200 shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] text-cyan-500 font-semibold min-w-[20px]">
                      {i + 1}.
                    </span>
                    <span className="truncate">{st.label}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 shrink-0">L{st.lineNumber}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
