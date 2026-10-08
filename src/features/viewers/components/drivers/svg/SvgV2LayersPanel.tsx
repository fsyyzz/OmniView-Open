/**
 * OmniView SVG v2 — 图层树面板 (SVG V2 Layers Panel)
 *
 * 能力：
 * - Layer/Group 编组树展示（递归 + 展开/折叠）
 * - HTML5 拖拽排序（层间 `layer.reorder(toIndex)`、同层图元 `object.reorder(toIndex)`）
 * - 双击重命名（Layer → `layer.rename`；Group/Path → `object.setName`）
 * - 显隐/锁定开关、点击选择
 *
 * 拖拽推导走 `core/model/tree.ts` 纯函数（可单测），本组件仅做事件绑定。
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  Image as ImageIcon,
  Layers,
  Lock,
  Square,
  Type as TypeIcon,
  Unlock,
} from 'lucide-react';
import {
  flattenLayerTree,
  planReorderDrop,
  type CommandId,
  type CommandParams,
  type Document,
  type LayerTreeRow,
  type NodeId,
} from './core';

export interface SvgV2LayersPanelProps {
  readonly document: Document;
  readonly selection: { nodeIds: ReadonlyArray<NodeId> };
  readonly execute: (id: CommandId, params: CommandParams) => void;
}

interface DragState {
  readonly kind: 'layer' | 'node';
  readonly id: NodeId;
}

interface DropHint {
  readonly rowId: NodeId;
  readonly position: 'before' | 'after';
}

const KIND_ICON: Record<LayerTreeRow['kind'], React.ReactNode> = {
  Layer: <Layers size={13} />,
  Group: <Folder size={13} />,
  Path: <Square size={13} />,
  Text: <TypeIcon size={13} />,
  Image: <ImageIcon size={13} />,
  Use: <Square size={13} />,
};

export const SvgV2LayersPanel: React.FC<SvgV2LayersPanelProps> = ({
  document: doc,
  selection,
  execute,
}) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<NodeId>>(() => new Set<NodeId>());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [editingId, setEditingId] = useState<NodeId | null>(null);
  const [editValue, setEditValue] = useState('');

  const rows = useMemo(() => flattenLayerTree(doc, collapsed), [doc, collapsed]);

  const toggleCollapse = useCallback((id: NodeId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startRename = useCallback((row: LayerTreeRow) => {
    setEditingId(row.id);
    setEditValue(row.name ?? '');
  }, []);

  const commitRename = useCallback(() => {
    if (editingId === null) return;
    const name = editValue.trim();
    const row = rows.find((r) => r.id === editingId);
    setEditingId(null);
    if (!row || name === (row.name ?? '')) return;
    if (row.kind === 'Layer') {
      execute('layer.rename', { id: editingId, name });
    } else {
      execute('object.setName', { id: editingId, name: name || null });
    }
  }, [editingId, editValue, rows, execute]);

  const handleDragStart = useCallback((row: LayerTreeRow) => (e: React.DragEvent) => {
    const kind: 'layer' | 'node' = row.kind === 'Layer' ? 'layer' : 'node';
    setDragState({ kind, id: row.id });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(row.id));
  }, []);

  const handleDragOver = useCallback((row: LayerTreeRow) => (e: React.DragEvent) => {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const position: 'before' | 'after' =
      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropHint((prev) =>
      prev && prev.rowId === row.id && prev.position === position ? prev : { rowId: row.id, position },
    );
  }, [dragState]);

  const handleDrop = useCallback((row: LayerTreeRow) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragState) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const position: 'before' | 'after' =
      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const targetKind: 'layer' | 'node' = row.kind === 'Layer' ? 'layer' : 'node';
    const plan = planReorderDrop(doc, dragState, { kind: targetKind, id: row.id, position });
    if (plan) execute(plan.command, { id: plan.id, toIndex: plan.toIndex });
    setDragState(null);
    setDropHint(null);
  }, [dragState, doc, execute]);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropHint(null);
  }, []);

  return (
    <div className="border-b border-[var(--ov-border)]" data-inspector-panel="true">
      <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase text-[var(--ov-fg-muted)]">
        <span>图层</span>
        <span>{rows.length}</span>
      </div>
      <ul className="max-h-48 overflow-y-auto pb-1 text-sm" role="tree" aria-label="图层树">
        {rows.map((row) => {
          const isSelected = selection.nodeIds.includes(row.id);
          const isDragSource = dragState?.id === row.id;
          const hint =
            dropHint?.rowId === row.id
              ? dropHint.position === 'before'
                ? 'border-t-[2px] border-t-[var(--ov-accent)]'
                : 'border-b-[2px] border-b-[var(--ov-accent)]'
              : '';
          return (
            <li
              key={`row-${row.id}`}
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={row.expandable ? row.expanded : undefined}
              draggable
              onDragStart={handleDragStart(row)}
              onDragOver={handleDragOver(row)}
              onDrop={handleDrop(row)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center gap-1 px-1 py-0.5 hover:bg-[var(--ov-hover)] ${hint} ${isDragSource ? 'opacity-50' : ''} ${isSelected ? 'bg-[var(--ov-accent-soft,transparent)]' : ''}`}
              style={{ paddingLeft: `${8 + row.depth * 14}px` }}
            >
              {/* 展开/折叠 */}
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {row.expandable ? (
                  <button
                    type="button"
                    className="text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]"
                    aria-label={row.expanded ? '折叠' : '展开'}
                    onClick={() => toggleCollapse(row.id)}
                  >
                    {row.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                ) : null}
              </span>

              {/* 类型图标 */}
              <span className="shrink-0 text-[var(--ov-fg-muted)]">{KIND_ICON[row.kind]}</span>

              {/* 名称（双击重命名） */}
              {editingId === row.id ? (
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-[var(--ov-accent)] bg-[var(--ov-bg)] px-1 text-xs text-[var(--ov-fg)] outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs"
                  title={`${row.name ?? row.kind}${row.childCount > 0 ? `（${row.childCount} 项）` : ''}`}
                  onClick={() => execute('select.set', { ids: [row.id], additive: false })}
                  onDoubleClick={() => startRename(row)}
                >
                  {row.name ?? `${row.kind} ${row.id}`}
                </button>
              )}

              {/* 显隐 */}
              <button
                type="button"
                className="shrink-0 text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]"
                title={row.visible ? '隐藏' : '显示'}
                onClick={() =>
                  execute(
                    row.kind === 'Layer' ? 'layer.setVisibility' : 'object.setVisible',
                    row.kind === 'Layer'
                      ? { id: row.id, visible: !row.visible }
                      : { ids: [row.id], visible: !row.visible },
                  )
                }
              >
                {row.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              {/* 锁定 */}
              <button
                type="button"
                className="shrink-0 text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]"
                title={row.locked ? '解锁' : '锁定'}
                onClick={() =>
                  execute(
                    row.kind === 'Layer' ? 'layer.setLock' : 'object.setLocked',
                    row.kind === 'Layer'
                      ? { id: row.id, locked: !row.locked }
                      : { ids: [row.id], locked: !row.locked },
                  )
                }
              >
                {row.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SvgV2LayersPanel;
