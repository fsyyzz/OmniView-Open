import React, { useState } from 'react';
import {
  Trash2,
  ArrowLeftRight,
  Folder,
  FolderOpen,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getBoundingBox,
  getSelectionBBox,
  defaultStroke,
  isTwoPointLineNode,
  isOpenPolylineNode,
  getLineWorldEndpoints,
  getPolylineWorldAnchors,
  nodeWorldBBox,
  nodeWorldTransform,
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
              <div className="pt-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[var(--ov-fg-muted)]">箭头快捷样式</span>
                  <button
                    type="button"
                    title="对调起点与终点箭头"
                    className="inline-flex items-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                    onClick={() => {
                      const ms = (primary as any).markerStart ?? 'none';
                      const me = (primary as any).markerEnd ?? 'none';
                      execute('path.setMarker', {
                        id: primary.id,
                        markerStart: me,
                        markerEnd: ms,
                      });
                    }}
                  >
                    <ArrowLeftRight size={10} /> 反转方向
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-1.5">
                  {[
                    { label: '无', start: 'none', end: 'none' },
                    { label: '单向 →', start: 'none', end: 'arrow' },
                    { label: '反向 ←', start: 'arrow', end: 'none' },
                    { label: '双向 ↔', start: 'arrow', end: 'arrow' },
                  ].map((preset) => {
                    const curStart = (primary as any).markerStart ?? 'none';
                    const curEnd = (primary as any).markerEnd ?? 'none';
                    const isActive = curStart === preset.start && curEnd === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`rounded border py-0.5 text-[10px] transition-colors ${
                          isActive
                            ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                            : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]'
                        }`}
                        onClick={() =>
                          execute('path.setMarker', {
                            id: primary.id,
                            markerStart: preset.start,
                            markerEnd: preset.end,
                          })
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[var(--ov-fg-muted)]">起点标记</span>
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
                  <span className="text-[var(--ov-fg-muted)]">终点标记</span>
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
              {!Boolean(isTwoPointLineNode(primary)) && (
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
              )}
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
              <span className="text-[var(--ov-fg-muted)]">字体</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={primary.fontFamily ?? 'sans-serif'}
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, fontFamily: e.target.value })
                }
              >
                {primary.fontFamily &&
                  ![
                    'sans-serif',
                    'system-ui, -apple-system, sans-serif',
                    'serif',
                    'monospace',
                    "'JetBrains Mono', monospace",
                  ].includes(primary.fontFamily) && (
                    <option value={primary.fontFamily}>{primary.fontFamily}</option>
                  )}
                <option value="sans-serif">无衬线 (Sans-serif)</option>
                <option value="system-ui, -apple-system, sans-serif">系统 UI (System)</option>
                <option value="serif">衬线 (Serif)</option>
                <option value="monospace">等宽 (Monospace)</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              </select>
            </div>
            <div>
              <span className="text-[var(--ov-fg-muted)]">字重</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={primary.fontWeight ?? 'normal'}
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, fontWeight: e.target.value })
                }
              >
                <option value="normal">常规 (400)</option>
                <option value="500">中等 (500)</option>
                <option value="600">半粗 (600)</option>
                <option value="700">粗体 (700)</option>
                <option value="bold">加粗 (Bold)</option>
                <option value="800">特粗 (800)</option>
              </select>
            </div>
          </div>
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

      {/* 单选几何信息：区分折线/直线/箭头 与 常规图形 */}
      {ids.length === 1 && primary && primary.kind === 'Path' && (() => {
        const polyAnchors = getPolylineWorldAnchors(doc, primary.id);
        if (polyAnchors && polyAnchors.length >= 2) {
          const total = polyAnchors.length;
          const p0 = polyAnchors[0]!.point;
          const p1 = polyAnchors[total - 1]!.point;
          const directLength = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const angleDeg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;

          const updateAnchorWorld = (anchorIndex: number, newWorld: { x: number; y: number }) => {
            if (!Number.isFinite(newWorld.x) || !Number.isFinite(newWorld.y)) return;
            const wt = nodeWorldTransform(doc, primary.id);
            const det = wt.a * wt.d - wt.b * wt.c;
            const localPt =
              Math.abs(det) > 1e-12
                ? {
                    x: (wt.d * (newWorld.x - wt.e) - wt.c * (newWorld.y - wt.f)) / det,
                    y: (-wt.b * (newWorld.x - wt.e) + wt.a * (newWorld.y - wt.f)) / det,
                  }
                : newWorld;
            execute('path.updateAnchor', {
              id: primary.id,
              subPathIndex: 0,
              anchorIndex,
              point: localPt,
            });
          };

          return (
            <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
                <span>线型与折线走线</span>
                <span className="font-normal text-[10px]">
                  {total === 2 ? '直线' : `${total} 个顶点`} · {directLength.toFixed(0)}px
                </span>
              </div>

              {/* 一键切换线型：直线 ↔ Z形直角 ↔ V形直角 ↔ L形直角 */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { key: 'straight', label: '直线', title: '收起所有折角，还原为两端点直线' },
                  { key: 'orthogonal-z', label: 'Z形直角', title: '水平优先直角走线（首段水平）' },
                  { key: 'orthogonal-v', label: 'V形直角', title: '垂直优先直角走线（首段垂直）' },
                  { key: 'orthogonal-l', label: 'L形直角', title: '单折角直角连接线' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    title={item.title}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() =>
                      execute('path.convertLineStyle', {
                        id: primary.id,
                        style: item.key,
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-[var(--ov-fg-muted)] leading-tight pt-0.5">
                💡 画布交互：拖拽线段中点可拉出折点；双击折点可删除。
              </div>

              {/* 顶点坐标编辑器 */}
              <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
                {polyAnchors.map((anc, idx) => {
                  const isStart = idx === 0;
                  const isEnd = idx === total - 1;
                  const label = isStart ? '起点' : isEnd ? '终点' : `折点 ${idx}`;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-1">
                      <span className="w-10 text-[var(--ov-fg-muted)] font-mono text-[10px]">{label}</span>
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-0.5">
                          <span className="text-[10px] text-[var(--ov-fg-muted)]">X</span>
                          <input
                            type="number"
                            value={Math.round(anc.point.x * 10) / 10}
                            className="w-14 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-right text-[11px] text-[var(--ov-fg)]"
                            onChange={(e) =>
                              updateAnchorWorld(idx, { x: Number(e.target.value), y: anc.point.y })
                            }
                          />
                        </label>
                        <label className="flex items-center gap-0.5">
                          <span className="text-[10px] text-[var(--ov-fg-muted)]">Y</span>
                          <input
                            type="number"
                            value={Math.round(anc.point.y * 10) / 10}
                            className="w-14 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-right text-[11px] text-[var(--ov-fg)]"
                            onChange={(e) =>
                              updateAnchorWorld(idx, { x: anc.point.x, y: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                      {!isStart && !isEnd && (
                        <button
                          type="button"
                          title="删除此折点 (双击画布此折点亦可删除)"
                          className="h-5 w-5 flex items-center justify-center rounded text-rose-500 hover:bg-rose-500/10 text-xs"
                          onClick={() => execute('path.deleteAnchor', { id: primary.id, anchorIndex: idx })}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-0.5 text-[10px]">
                <span className="text-[var(--ov-fg-muted)]">跨度与角度</span>
                <span>{directLength.toFixed(1)}px · {angleDeg.toFixed(0)}°</span>
              </div>
            </div>
          );
        }

        const isMulti = ids.length > 1;
        const bb = isMulti
          ? (getSelectionBBox(doc, ids) ?? { x: 0, y: 0, width: 0, height: 0 })
          : (nodeWorldBBox(doc, primary.id) ?? getBoundingBox(primary.geometry));

        const hasAnyGroup = ids.some((id) => doc.nodes.get(id)?.kind === 'Group');

        return (
          <>
            {/* 多选共性操作：编组、层级、锁定与显隐 */}
            {isMulti && (
              <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
                  <span>共性编组与层级</span>
                  <span className="font-normal text-[10px] text-[var(--ov-accent)] font-medium">
                    已选 {ids.length} 项
                  </span>
                </div>

                {/* 编组与解散编组 */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    title="一键编组 (⌘G)"
                    className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => execute('object.group', { ids: [...ids] })}
                  >
                    <Folder size={12} className="text-[var(--ov-accent)]" />
                    <span>一键编组</span>
                  </button>
                  <button
                    type="button"
                    title="解散编组 (⇧⌘G)"
                    disabled={!hasAnyGroup}
                    className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
                    onClick={() => {
                      for (const id of ids) {
                        if (doc.nodes.get(id)?.kind === 'Group') {
                          execute('object.ungroup', { id });
                        }
                      }
                    }}
                  >
                    <FolderOpen size={12} />
                    <span>解散编组</span>
                  </button>
                </div>

                {/* 批量层级置顶与置底 */}
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    title="置于顶层 (⇧⌘])"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'front' });
                    }}
                  >
                    <ArrowUpToLine size={11} /> 置顶
                  </button>
                  <button
                    type="button"
                    title="上移一层 (⌘])"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'forward' });
                    }}
                  >
                    <ArrowUp size={11} /> 上移
                  </button>
                  <button
                    type="button"
                    title="下移一层 (⌘[)"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'backward' });
                    }}
                  >
                    <ArrowDown size={11} /> 下移
                  </button>
                  <button
                    type="button"
                    title="置于底层 (⇧⌘[)"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'back' });
                    }}
                  >
                    <ArrowDownToLine size={11} /> 置底
                  </button>
                </div>

                {/* 批量锁定与显隐 */}
                <div className="grid grid-cols-2 gap-1 pt-0.5 border-t border-[var(--ov-border)]/50">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="批量锁定选中对象"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setLocked', { ids: [...ids], locked: true })}
                    >
                      <Lock size={10} /> 锁定
                    </button>
                    <button
                      type="button"
                      title="批量解锁选中对象"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setLocked', { ids: [...ids], locked: false })}
                    >
                      <Unlock size={10} /> 解锁
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="批量隐藏选中对象"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setVisible', { ids: [...ids], visible: false })}
                    >
                      <EyeOff size={10} /> 隐藏
                    </button>
                    <button
                      type="button"
                      title="批量显示选中对象"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setVisible', { ids: [...ids], visible: true })}
                    >
                      <Eye size={10} /> 显示
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 位置与尺寸（单选为自身坐标，多选为联合包围盒 Collective Bounding Box） */}
            <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
                <span>{isMulti ? '联合位置与尺寸' : '位置与尺寸'}</span>
                <span className="font-normal text-[10px]">
                  {bb.width.toFixed(1)} × {bb.height.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">X</span>
                  <input
                    type="number"
                    value={Math.round(bb.x * 10) / 10}
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextX = Number(e.target.value);
                      if (!Number.isFinite(nextX)) return;
                      execute('object.move', { ids: isMulti ? [...ids] : [primary.id], delta: { x: nextX - bb.x, y: 0 } });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">Y</span>
                  <input
                    type="number"
                    value={Math.round(bb.y * 10) / 10}
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextY = Number(e.target.value);
                      if (!Number.isFinite(nextY)) return;
                      execute('object.move', { ids: isMulti ? [...ids] : [primary.id], delta: { x: 0, y: nextY - bb.y } });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">宽</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bb.width * 10) / 10}
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextW = Math.max(1, Number(e.target.value));
                      if (!Number.isFinite(nextW) || bb.width < 1e-6) return;
                      execute('object.scale', {
                        ids: isMulti ? [...ids] : [primary.id],
                        factor: { x: nextW / bb.width, y: 1 },
                        origin: { x: bb.x, y: bb.y },
                      });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">高</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bb.height * 10) / 10}
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextH = Math.max(1, Number(e.target.value));
                      if (!Number.isFinite(nextH) || bb.height < 1e-6) return;
                      execute('object.scale', {
                        ids: isMulti ? [...ids] : [primary.id],
                        factor: { x: 1, y: nextH / bb.height },
                        origin: { x: bb.x, y: bb.y },
                      });
                    }}
                  />
                </label>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-[var(--ov-fg-muted)]">{isMulti ? '联合尺寸' : '尺寸'}</span>
                <span>{`${bb.width.toFixed(1)} × ${bb.height.toFixed(1)}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ov-fg-muted)]">{isMulti ? '左上坐标' : '坐标'}</span>
                <span>{`(${bb.x.toFixed(1)}, ${bb.y.toFixed(1)})`}</span>
              </div>
              {!isMulti && (
                <div className="flex justify-between">
                  <span className="text-[var(--ov-fg-muted)]">名称</span>
                  <span className="max-w-[120px] truncate">{primary.name ?? '—'}</span>
                </div>
              )}
            </div>
          </>
        );
      })()}

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
