/**
 * OmniView SVG v2 — 属性检视器面板 (SVG V2 Inspector)
 *
 * - 未选中：提示
 * - 单选：填充色 / 描边色 / 透明度 / 包围盒 / 删除
 * - 多选：对齐（6 向 × 选区/画布基准）+ 分布（H/V）+ 批量填充 / 透明度 / 删除
 */
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  getBoundingBox,
  type AlignMode,
  type CommandId,
  type CommandParams,
  type Document,
  type NodeId,
} from './core';

export interface SvgV2InspectorProps {
  readonly document: Document;
  readonly selection: { primaryId: NodeId | null; nodeIds: ReadonlyArray<NodeId> };
  readonly execute: (id: CommandId, params: CommandParams) => void;
}

const ALIGN_BUTTONS: ReadonlyArray<{ mode: AlignMode; label: string }> = [
  { mode: 'left', label: '左对齐' },
  { mode: 'centerH', label: '水平居中' },
  { mode: 'right', label: '右对齐' },
  { mode: 'top', label: '顶对齐' },
  { mode: 'centerV', label: '垂直居中' },
  { mode: 'bottom', label: '底对齐' },
];

export const SvgV2Inspector: React.FC<SvgV2InspectorProps> = ({
  document: doc,
  selection,
  execute,
}) => {
  const [relative, setRelative] = useState<'selection' | 'canvas'>('selection');
  const ids = selection.nodeIds;

  if (ids.length === 0) {
    return <div className="p-2 text-xs text-[var(--ov-fg-muted)]">未选中图元</div>;
  }

  const primary = selection.primaryId !== null ? doc.nodes.get(selection.primaryId) : null;

  return (
    <div className="border-t border-[var(--ov-border)] p-2 text-sm" data-inspector-panel="true">
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase text-[var(--ov-fg-muted)]">
        <span>属性</span>
        <span>{ids.length > 1 ? `${ids.length} 个对象` : '1 个对象'}</span>
      </div>

      {/* 对齐与分布（≥2 才能对齐；≥3 才能分布） */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--ov-fg-muted)]">
          <span>对齐 / 分布</span>
          <select
            className="rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 text-[10px] text-[var(--ov-fg)]"
            value={relative}
            onChange={(e) => setRelative(e.target.value as 'selection' | 'canvas')}
            aria-label="对齐基准"
          >
            <option value="selection">选区基准</option>
            <option value="canvas">画布基准</option>
          </select>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.mode}
              type="button"
              title={`${b.label}（${relative === 'canvas' ? '画布' : '选区'}基准）`}
              disabled={ids.length < 2}
              className="rounded border border-[var(--ov-border)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40"
              onClick={() => execute('object.align', { ids, align: b.mode, relative })}
            >
              {b.label.slice(0, 2)}
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            title="水平等距分布（首尾不动）"
            disabled={ids.length < 3}
            className="rounded border border-[var(--ov-border)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40"
            onClick={() => execute('object.distribute', { ids, axis: 'h' })}
          >
            水平分布
          </button>
          <button
            type="button"
            title="垂直等距分布（首尾不动）"
            disabled={ids.length < 3}
            className="rounded border border-[var(--ov-border)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40"
            onClick={() => execute('object.distribute', { ids, axis: 'v' })}
          >
            垂直分布
          </button>
        </div>
      </div>

      {/* 批量填充与透明度 */}
      <div className="mb-2">
        <div className="mb-1 text-xs text-[var(--ov-fg-muted)]">批量样式</div>
        <input
          type="color"
          defaultValue="#000000"
          className="h-7 w-full cursor-pointer rounded border border-[var(--ov-border)]"
          title="统一填充色"
          onChange={(e) =>
            execute('paint.setColor', { ids, target: 'fill', color: e.target.value, opacity: 1 })
          }
        />
        <label className="mt-1 flex items-center justify-between text-xs text-[var(--ov-fg-muted)]">
          <span>透明度</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            className="w-28"
            onChange={(e) =>
              execute('paint.setOpacity', { ids, opacity: Number(e.target.value) })
            }
          />
        </label>
      </div>

      {/* 单选附加信息 */}
      {ids.length === 1 && primary && primary.kind === 'Path' && (
        <div className="mb-2 space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--ov-fg-muted)]">包围盒</span>
            <span>
              {(() => {
                const bb = getBoundingBox(primary.geometry);
                return `${bb.width.toFixed(1)} × ${bb.height.toFixed(1)}`;
              })()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ov-fg-muted)]">位置</span>
            <span>
              {(() => {
                const bb = getBoundingBox(primary.geometry);
                return `(${bb.x.toFixed(1)}, ${bb.y.toFixed(1)})`;
              })()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ov-fg-muted)]">名称</span>
            <span className="max-w-[120px] truncate">{primary.name ?? '—'}</span>
          </div>
        </div>
      )}

      {/* 删除 */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-1 rounded bg-[var(--ov-danger)] py-1 text-xs text-white hover:opacity-90"
        onClick={() => execute('object.delete', { ids })}
      >
        <Trash2 size={13} /> 删除{ids.length > 1 ? `${ids.length} 个对象` : '图元'}
      </button>
    </div>
  );
};

export default SvgV2Inspector;
