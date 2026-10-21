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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Folder,
  FolderOpen,
  ArrowUpToLine,
  ArrowDownToLine,
} from 'lucide-react';
import {
  defaultStroke,
  isTwoPointLineNode,
  isOpenPolylineNode,
  type CommandId,
  type CommandParams,
  type Document,
  type Selection,
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
  document: doc,
  selBBox,
  execute,
}) => {
  const ids = selection.nodeIds;
  if (ids.length === 0) return null;

  const hasGroup = ids.some((id) => doc.nodes.get(id)?.kind === 'Group');
  const isMulti = ids.length > 1;

  const primary = selection.primaryId ? doc.nodes.get(selection.primaryId) : doc.nodes.get(ids[0]!);
  const isLineOrArrow = Boolean(primary && isOpenPolylineNode(primary));

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

  const handleSetColorPreset = (color: string) => {
    if (isLineOrArrow) {
      if (color === 'none') return;
      execute('paint.setColor', {
        ids: [...ids],
        target: 'stroke',
        color,
        opacity: 1,
      });
      return;
    }
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
    const existingStroke =
      primary && primary.kind === 'Path'
        ? primary.appearance.items.find((it) => it.kind === 'stroke')
        : undefined;
    const baseStroke = existingStroke && existingStroke.kind === 'stroke' ? existingStroke.stroke : defaultStroke();
    execute('paint.setStroke', {
      ids: [...ids],
      stroke: {
        ...baseStroke,
        width,
      },
    });
  };

  return (
    <div
      data-floating-hud="true"
      className="absolute z-40 -translate-x-1/2 flex items-center gap-1.5 rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)]/95 px-2 py-1 shadow-2xl backdrop-blur-md text-xs text-[var(--ov-text)] select-none pointer-events-auto transition-transform duration-75 animate-fadeIn max-w-[95vw] overflow-x-auto"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 多选标识 */}
      {isMulti && (
        <div className="flex items-center gap-1 pr-1.5 border-r border-[var(--ov-border)] font-medium text-[11px] text-[var(--ov-accent)]">
          <span className="px-1.5 py-0.5 rounded-md bg-[var(--ov-accent-soft)] whitespace-nowrap">
            已选 {ids.length} 项
          </span>
        </div>
      )}

      {/* 多选快捷对齐 (左中右 / 顶中底) */}
      {isMulti && (
        <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
          <button
            type="button"
            title="左对齐"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.align', { ids: [...ids], align: 'left', relative: 'selection' })}
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            title="水平居中"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.align', { ids: [...ids], align: 'centerH', relative: 'selection' })}
          >
            <AlignCenter size={13} />
          </button>
          <button
            type="button"
            title="右对齐"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.align', { ids: [...ids], align: 'right', relative: 'selection' })}
          >
            <AlignRight size={13} />
          </button>
          <button
            type="button"
            title="顶对齐"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.align', { ids: [...ids], align: 'top', relative: 'selection' })}
          >
            <AlignStartVertical size={13} />
          </button>
          <button
            type="button"
            title="垂直居中"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.align', { ids: [...ids], align: 'centerV', relative: 'selection' })}
          >
            <AlignCenterVertical size={13} />
          </button>
          <button
            type="button"
            title="底对齐"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.align', { ids: [...ids], align: 'bottom', relative: 'selection' })}
          >
            <AlignEndVertical size={13} />
          </button>
        </div>
      )}

      {/* 多选等间距分布（≥3 个图元） */}
      {ids.length >= 3 && (
        <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
          <button
            type="button"
            title="水平等间距分布"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.distribute', { ids: [...ids], axis: 'h' })}
          >
            <AlignHorizontalDistributeCenter size={13} />
          </button>
          <button
            type="button"
            title="垂直等间距分布"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => execute('object.distribute', { ids: [...ids], axis: 'v' })}
          >
            <AlignVerticalDistributeCenter size={13} />
          </button>
        </div>
      )}

      {/* 编组 / 解散编组 */}
      {isMulti && (
        <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
          <button
            type="button"
            title="一键编组 (⌘G)"
            className="flex h-5 px-1.5 items-center gap-1 rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors text-[10px]"
            onClick={() => execute('object.group', { ids: [...ids] })}
          >
            <Folder size={12} />
            <span>编组</span>
          </button>
          {hasGroup && (
            <button
              type="button"
              title="解散编组 (⇧⌘G)"
              className="flex h-5 px-1.5 items-center gap-1 rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors text-[10px]"
              onClick={() => {
                for (const id of ids) {
                  if (doc.nodes.get(id)?.kind === 'Group') {
                    execute('object.ungroup', { id });
                  }
                }
              }}
            >
              <FolderOpen size={12} />
              <span>解组</span>
            </button>
          )}
        </div>
      )}

      {/* 图层置顶 / 置底 */}
      {isMulti && (
        <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
          <button
            type="button"
            title="置于顶层 (⇧⌘])"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => {
              for (const id of ids) execute('object.reorder', { id, direction: 'front' });
            }}
          >
            <ArrowUpToLine size={13} />
          </button>
          <button
            type="button"
            title="置于底层 (⇧⌘[)"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--ov-hover)] text-[var(--ov-fg-muted)] hover:text-[var(--ov-text)] transition-colors"
            onClick={() => {
              for (const id of ids) execute('object.reorder', { id, direction: 'back' });
            }}
          >
            <ArrowDownToLine size={13} />
          </button>
        </div>
      )}

      {/* 快捷色板（线条/箭头自动作用于描边色，其余图形作用于填充色） */}
      <div className="flex items-center gap-1 pr-1 border-r border-[var(--ov-border)]">
        {COLOR_PRESETS.filter((c) => !(isLineOrArrow && c === 'none')).map((c) => (
          <button
            key={c}
            type="button"
            title={
              c === 'none'
                ? '无填充'
                : isLineOrArrow
                  ? `线条颜色 ${c}`
                  : `填充颜色 ${c}`
            }
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
            onClick={() => handleSetColorPreset(c)}
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

      {/* 单选路径/线条快速箭头与线型切换 */}
      {ids.length === 1 && primary && primary.kind === 'Path' && (
        <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--ov-border)]">
          {[
            { label: '—', title: '无箭头', start: 'none', end: 'none' },
            { label: '→', title: '单向箭头', start: 'none', end: 'arrow' },
            { label: '↔', title: '双向箭头', start: 'arrow', end: 'arrow' },
          ].map((m) => {
            const curStart = (primary as any).markerStart ?? 'none';
            const curEnd = (primary as any).markerEnd ?? 'none';
            const active = curStart === m.start && curEnd === m.end;
            return (
              <button
                key={m.label}
                type="button"
                title={m.title}
                className={`flex h-5 px-1 items-center justify-center rounded font-mono text-[10px] transition-colors ${
                  active
                    ? 'bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-semibold'
                    : 'text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-text)]'
                }`}
                onClick={() =>
                  execute('path.setMarker', {
                    id: primary.id,
                    markerStart: m.start,
                    markerEnd: m.end,
                  })
                }
              >
                {m.label}
              </button>
            );
          })}
          {isOpenPolylineNode(primary) && (
            <div className="flex items-center gap-0.5 pl-1 border-l border-[var(--ov-border)]/60">
              {[
                { label: '直线', title: '一键还原为直线', style: 'straight' },
                { label: '弧线', title: '一键转为C形拱形曲线', style: 'curve-arc' },
                { label: 'S曲线', title: '一键转为S形平滑贝塞尔曲线', style: 'curve-s' },
                { label: '平滑', title: '将折线平滑拟合为连续曲线', style: 'curve-smooth' },
                { label: 'Z折', title: '水平直角折线', style: 'orthogonal-z' },
                { label: 'L折', title: 'L形直角折线', style: 'orthogonal-l' },
              ].map((s) => (
                <button
                  key={s.style}
                  type="button"
                  title={s.title}
                  className="flex h-5 px-1 items-center justify-center rounded text-[10px] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-text)] transition-colors whitespace-nowrap"
                  onClick={() =>
                    execute('path.convertLineStyle', {
                      id: primary.id,
                      style: s.style,
                    })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
