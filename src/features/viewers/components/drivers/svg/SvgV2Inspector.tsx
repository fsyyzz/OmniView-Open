import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  getBoundingBox,
  defaultStroke,
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

const SWATCHES = [
  '#111827',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
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
  const fillItem =
    primary && (primary.kind === 'Path' || primary.kind === 'Text')
      ? primary.appearance.items.find((it) => it.kind === 'fill')
      : null;
  const strokeItem =
    primary && primary.kind === 'Path'
      ? primary.appearance.items.find((it) => it.kind === 'stroke')
      : null;

  const curStrokePaint =
    strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.paint.type === 'solid'
      ? strokeItem.stroke.paint.color
      : '#000000';
  const curStrokeWidth =
    strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.width : 1;
  const curStrokeCap =
    strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.cap : 'butt';
  const curStrokeDash =
    strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.dashArray
      ? strokeItem.stroke.dashArray.join(' ')
      : 'none';

  return (
    <div
      className="border-t border-[var(--ov-border)] p-2 text-sm overflow-y-auto max-h-[calc(100vh-280px)]"
      data-inspector-panel="true"
    >
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
              disabled={relative === 'canvas' ? ids.length < 1 : ids.length < 2}
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

      {/* 填充色与调色板 */}
      <div className="mb-2">
        <div className="mb-1 text-xs text-[var(--ov-fg-muted)]">填充颜色</div>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            defaultValue="#000000"
            className="h-7 w-9 cursor-pointer rounded border border-[var(--ov-border)]"
            title="拾取填充色"
            onChange={(e) =>
              execute('paint.setColor', { ids, target: 'fill', color: e.target.value, opacity: 1 })
            }
          />
          <div className="grid flex-1 grid-cols-8 gap-1">
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="h-6 w-full rounded border border-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => execute('paint.setColor', { ids, target: 'fill', color, opacity: 1 })}
              />
            ))}
          </div>
        </div>
        <label className="mt-1.5 flex items-center justify-between text-xs text-[var(--ov-fg-muted)]">
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

      {/* 路径描边与端点样式（支持单选与多选批量应用） */}
      {(primary?.kind === 'Path' || ids.some((id) => doc.nodes.get(id)?.kind === 'Path')) && (
        <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          <div className="font-semibold text-[var(--ov-fg-muted)]">描边与拐角</div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--ov-fg-muted)]">描边颜色</span>
            <input
              type="color"
              value={curStrokePaint}
              className="h-5 w-8 cursor-pointer rounded border border-[var(--ov-border)]"
              onChange={(e) => {
                const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                execute('paint.setStroke', {
                  ids,
                  stroke: { ...s, paint: { type: 'solid', color: e.target.value as any, opacity: 1 } },
                });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--ov-fg-muted)]">粗细 (px)</span>
            <input
              type="number"
              min={0}
              max={30}
              value={curStrokeWidth}
              className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-[var(--ov-fg)]"
              onChange={(e) => {
                const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                execute('paint.setStroke', {
                  ids,
                  stroke: { ...s, width: Math.max(0, Number(e.target.value)) },
                });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[var(--ov-fg-muted)]">端点</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={curStrokeCap}
                onChange={(e) => {
                  const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                  execute('paint.setStroke', {
                    ids,
                    stroke: { ...s, cap: e.target.value as any },
                  });
                }}
              >
                <option value="butt">平头 (Butt)</option>
                <option value="round">圆头 (Round)</option>
                <option value="square">方头 (Square)</option>
              </select>
            </div>
            <div>
              <span className="text-[var(--ov-fg-muted)]">虚线</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={curStrokeDash}
                onChange={(e) => {
                  const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                  const dashVal = e.target.value;
                  const dashArray = dashVal === 'none' ? null : dashVal.split(' ').map(Number);
                  execute('paint.setStroke', {
                    ids,
                    stroke: { ...s, dashArray },
                  });
                }}
              >
                <option value="none">实线</option>
                <option value="4 4">虚线 (4 4)</option>
                <option value="2 2">点线 (2 2)</option>
                <option value="8 3 2 3">点划线</option>
              </select>
            </div>
          </div>
          {ids.length === 1 && primary && primary.kind === 'Path' && (
            <>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div>
                  <span className="text-[var(--ov-fg-muted)]">起点箭头</span>
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                    value={(primary as any).markerStart ?? 'none'}
                    onChange={(e) => {
                      execute('path.setMarker', {
                        id: primary.id,
                        markerStart: e.target.value,
                      });
                    }}
                  >
                    <option value="none">无 (None)</option>
                    <option value="arrow">箭头 (Arrow)</option>
                    <option value="dot">圆点 (Dot)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[var(--ov-fg-muted)]">终点箭头</span>
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                    value={(primary as any).markerEnd ?? 'none'}
                    onChange={(e) => {
                      execute('path.setMarker', {
                        id: primary.id,
                        markerEnd: e.target.value,
                      });
                    }}
                  >
                    <option value="none">无 (None)</option>
                    <option value="arrow">箭头 (Arrow)</option>
                    <option value="dot">圆点 (Dot)</option>
                  </select>
                </div>
              </div>
              <div className="pt-1.5 border-t border-[var(--ov-border)]/50 flex items-center justify-between">
                <span className="text-[var(--ov-fg-muted)]">锚点形态</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                    onClick={() => {
                      execute('path.toggleAnchorKind', { id: primary.id, subPathIndex: 0, anchorIndex: 0, targetKind: 'corner' });
                    }}
                  >
                    转尖角
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                    onClick={() => {
                      execute('path.toggleAnchorKind', { id: primary.id, subPathIndex: 0, anchorIndex: 0, targetKind: 'smooth' });
                    }}
                  >
                    转平滑
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 单选文本编辑 */}
      {ids.length === 1 && primary && primary.kind === 'Text' && (
        <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          <div className="font-semibold text-[var(--ov-fg-muted)]">文本内容与字体</div>
          <input
            type="text"
            className="w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-1 text-[var(--ov-fg)]"
            value={primary.text}
            onChange={(e) => execute('text.setText', { id: primary.id, text: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[var(--ov-fg-muted)]">字号 (px)</span>
              <input
                type="number"
                min={8}
                max={96}
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-[var(--ov-fg)]"
                value={primary.fontSize ?? 16}
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, fontSize: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <span className="text-[var(--ov-fg-muted)]">对齐</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={primary.textAnchor ?? 'start'}
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, textAnchor: e.target.value as any })
                }
              >
                <option value="start">居左</option>
                <option value="middle">居中</option>
                <option value="end">居右</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 单选几何信息 */}
      {ids.length === 1 && primary && primary.kind === 'Path' && (
        <div className="mb-2 space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--ov-fg-muted)]">尺寸</span>
            <span>
              {(() => {
                const bb = getBoundingBox(primary.geometry);
                return `${bb.width.toFixed(1)} × ${bb.height.toFixed(1)}`;
              })()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ov-fg-muted)]">坐标</span>
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
        className="flex w-full items-center justify-center gap-1 rounded bg-[var(--ov-danger)] py-1 text-xs text-white hover:opacity-90 transition-opacity"
        onClick={() => execute('object.delete', { ids })}
      >
        <Trash2 size={13} /> 删除{ids.length > 1 ? `${ids.length} 个对象` : '图元'}
      </button>
    </div>
  );
};

export default SvgV2Inspector;
