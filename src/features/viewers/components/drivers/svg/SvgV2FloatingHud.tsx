/**
 * OmniView SVG v2 — 选中图元就地悬浮 HUD 快捷工具条 (Phase 3)
 *
 * 核心能力：
 * - 紧贴选中包围盒上方（过高时自动翻转至下方），以光标或选区为中心居中展示
 * - 水平 / 垂直镜像翻转 (Flip H / Flip V)
 * - 快速色板切换填充 (Solid Fill / None)
 * - 快速描边粗细切换 (1px / 2px / 4px)
 * - 快速创建副本 (Duplicate) 与删除 (Delete)
 * - 全量依托 `--ov-*` 语义令牌，支持暗色/亮色多主题无感融合
 */
import React from 'react';
import {
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';
import type {
  CommandId,
  CommandParams,
  Document,
  NodeId,
  Selection,
} from './core';

export interface SvgV2FloatingHudProps {
  readonly left: number;
  readonly top: number;
  readonly selection: Selection;
  readonly document: Document;
  readonly selBBox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly execute: (commandId: CommandId, params: CommandParams) => void;
}

const COLOR_PRESETS = [
  'none',
  '#0f172a', // Slate 900
  '#ffffff', // White
  '#ef4444', // Red
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
] as const;

export const SvgV2FloatingHud: React.FC<SvgV2FloatingHudProps> = ({
  left,
  top,
  selection,
  selBBox,
  execute,
}) => {
  const ids = selection.nodeIds;
  if (ids.length === 0) return null;

  const center = {
    x: selBBox.x + selBBox.width / 2,
    y: selBBox.y + selBBox.height / 2,
  };

  const handleFlipH = () => {
    execute('object.scale', {
      ids: [...ids],
      origin: center,
      factor: { x: -1, y: 1 },
    });
  };

  const handleFlipV = () => {
    execute('object.scale', {
      ids: [...ids],
      origin: center,
      factor: { x: 1, y: -1 },
    });
  };

  const handleSetFill = (color: string) => {
    execute('paint.setFill', {
      ids: [...ids],
      fill: {
        paint: color === 'none' ? { type: 'none' } : { type: 'solid', color },
        rule: 'nonzero',
        opacity: 1,
      },
    });
  };

  const handleSetStrokeWidth = (width: number) => {
    execute('paint.setStroke', {
      ids: [...ids],
      stroke: {
        paint: { type: 'solid', color: '#0f172a' },
        width,
        cap: 'butt',
        join: 'miter',
        miterLimit: 4,
        dashArray: [],
        dashOffset: 0,
        opacity: 1,
      },
    });
  };

  return (
    <div
      data-floating-hud="true"
      className="absolute z-40 -translate-x-1/2 flex items-center gap-1.5 rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)]/95 px-2 py-1 shadow-2xl backdrop-blur-md text-xs text-[var(--ov-text)] select-none pointer-events-auto transition-transform duration-75 animate-fadeIn"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 快捷色板 */}
      <div className="flex items-center gap-1 pr-1 border-r border-[var(--ov-border)]">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            title={c === 'none' ? '无填充' : `填充颜色 ${c}`}
            className="h-4 w-4 rounded-full border border-black/20 dark:border-white/20 transition-transform hover:scale-125 focus:outline-none"
            style={{
              backgroundColor: c === 'none' ? 'transparent' : c,
              backgroundImage:
                c === 'none'
                  ? 'linear-gradient(45deg, #ef4444 0%, #ef4444 100%)'
                  : undefined,
              backgroundSize: c === 'none' ? '2px 100%' : undefined,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
            onClick={() => handleSetFill(c)}
          />
        ))}
      </div>

      {/* 描边宽度阶梯 */}
      <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
        {[1, 2, 4].map((sw) => (
          <button
            key={sw}
            type="button"
            title={`描边 ${sw}px`}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] font-mono text-[10px] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => handleSetStrokeWidth(sw)}
          >
            {sw}
          </button>
        ))}
      </div>

      {/* 水平 / 垂直镜像翻转 */}
      <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
        <button
          type="button"
          title="水平镜像翻转"
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
          onClick={handleFlipH}
        >
          <FlipHorizontal size={13} />
        </button>
        <button
          type="button"
          title="垂直镜像翻转"
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
          onClick={handleFlipV}
        >
          <FlipVertical size={13} />
        </button>
      </div>

      {/* 复制副本 */}
      <button
        type="button"
        title="创建副本 (Cmd+D)"
        className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
        onClick={() => execute('object.duplicate', { ids: [...ids] })}
      >
        <Copy size={13} />
      </button>

      {/* 快速删除 */}
      <button
        type="button"
        title="删除选中 (Delete)"
        className="flex h-5 w-5 items-center justify-center rounded hover:bg-rose-500/10 text-rose-500 transition-colors"
        onClick={() => execute('object.delete', { ids: [...ids] })}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};
