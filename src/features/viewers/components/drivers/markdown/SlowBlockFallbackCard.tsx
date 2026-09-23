/**
 * OmniView 慢块熔断与降级源码卡片 (SlowBlockFallbackCard)
 * 当某个图表或复杂重块的渲染/编译耗时超过性能预算（如 > 800ms）时提供降级保护，
 * 避免阻塞主线程和卡顿滚动，支持一键查看源码与强制重新计算。
 */
import React from 'react';
import { ZapOff, Code, Play, AlertCircle } from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';

export interface SlowBlockFallbackCardProps {
  blockId: string;
  blockType: string;
  durationMs: number;
  rawCode: string;
  startLine?: number;
  locale?: Locale;
  onForceRender?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
}

export const SlowBlockFallbackCard: React.FC<SlowBlockFallbackCardProps> = ({
  blockType,
  durationMs,
  rawCode,
  startLine,
  locale = 'zh-CN',
  onForceRender,
  onOpenSourceAtLine,
}) => {
  const [showCode, setShowCode] = React.useState(false);
  const isZh = locale === 'zh-CN';

  return (
    <div className="my-4 rounded-xl border border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
        <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
          <ZapOff className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="font-semibold uppercase">{blockType}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[11px]">
              <AlertCircle className="w-3 h-3" />
              {isZh ? `渲染耗时超标: ${durationMs}ms` : `Render budget exceeded: ${durationMs}ms`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {startLine && onOpenSourceAtLine && (
            <button
              type="button"
              onClick={() => onOpenSourceAtLine(startLine)}
              className="px-2.5 py-1 text-xs rounded-lg border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
            >
              L{startLine}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showCode ? (isZh ? '收起源码' : 'Hide Code') : (isZh ? '查看源码' : 'View Code')}</span>
          </button>

          {onForceRender && (
            <button
              type="button"
              onClick={onForceRender}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isZh ? '强制渲染' : 'Force Render'}</span>
            </button>
          )}
        </div>
      </div>

      {showCode && (
        <pre className="p-3.5 text-xs font-mono bg-slate-900 text-slate-200 overflow-x-auto m-0 leading-relaxed border-t border-amber-500/20">
          <code>{rawCode}</code>
        </pre>
      )}
    </div>
  );
};
