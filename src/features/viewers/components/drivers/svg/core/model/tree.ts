/**
 * OmniView SVG v2 — 图层树遍历与拖拽重排推导纯函数 (ADR-0001 §2.4)
 *
 * - `flattenLayerTree` : 把 Document 的 Layer/Group 嵌套结构摊平为面板行列表
 * - `planLayerDrop` / `planNodeDrop` : HTML5 DnD 落点 → 命令重排计划
 *
 * 纯函数、无 DOM 依赖，可独立单测（拖拽排序准入测试）。
 */
import type { Document, NodeId } from './types';

// ============================================================================
// 1. 树行模型
// ============================================================================

export interface LayerTreeRow {
  readonly id: NodeId;
  readonly kind: 'Layer' | 'Group' | 'Path' | 'Text' | 'Image' | 'Use';
  readonly depth: number;
  readonly name: string | null;
  readonly visible: boolean;
  readonly locked: boolean;
  /** 子节点数量（无子节点为 0）。 */
  readonly childCount: number;
  /** 是否可展开（Layer / Group 且有子节点）。 */
  readonly expandable: boolean;
  /** 当前是否展开（不可展开恒为 false）。 */
  readonly expanded: boolean;
}

/**
 * 摊平图层树。顶层图层按视觉顺序返回（`doc.layers` 末位在前，与画布叠放一致）。
 *
 * @param collapsedIds 处于折叠状态的节点 ID 集合（不在集合中且可展开 = 展开）
 */
export function flattenLayerTree(
  doc: Document,
  collapsedIds: ReadonlySet<NodeId> = new Set<NodeId>(),
): LayerTreeRow[] {
  const rows: LayerTreeRow[] = [];

  const pushNode = (id: NodeId, depth: number): void => {
    const node = doc.nodes.get(id);
    if (!node) return;
    const childCount = node.children.length;
    const expandable = (node.kind === 'Layer' || node.kind === 'Group') && childCount > 0;
    const expanded = expandable && !collapsedIds.has(id);
    rows.push({
      id,
      kind: node.kind,
      depth,
      name: node.name,
      visible: node.visible,
      locked: node.locked,
      childCount,
      expandable,
      expanded,
    });
    if (expanded) {
      for (const childId of node.children) pushNode(childId, depth + 1);
    }
  };

  for (let i = doc.layers.length - 1; i >= 0; i--) {
    pushNode(doc.layers[i]!, 0);
  }
  return rows;
}

/** 节点的直接父节点 ID（Layer 或 Group）；顶层图层或找不到返回 null。 */
export function findParent(doc: Document, id: NodeId): NodeId | null {
  for (const layerId of doc.layers) {
    const layer = doc.nodes.get(layerId);
    if (!layer) continue;
    if (layerId === id) return null;
    const stack: Array<{ id: NodeId; parent: NodeId }> = layer.children.map((cid) => ({
      id: cid,
      parent: layerId,
    }));
    while (stack.length > 0) {
      const { id: cur, parent } = stack.pop()!;
      if (cur === id) return parent;
      const n = doc.nodes.get(cur);
      if (n && (n.kind === 'Layer' || n.kind === 'Group')) {
        for (const cid of n.children) stack.push({ id: cid, parent: cur });
      }
    }
  }
  return null;
}

// ============================================================================
// 2. 拖拽重排计划
// ============================================================================

/** 拖拽源。 */
export interface DropDrag {
  readonly kind: 'layer' | 'node';
  readonly id: NodeId;
}

/** 落点目标。 */
export interface DropTarget {
  readonly kind: 'layer' | 'node';
  readonly id: NodeId;
  /** 光标位于目标行上半部分 = before，下半部分 = after。 */
  readonly position: 'before' | 'after';
}

/** 重排计划：通过扩展后的 `layer.reorder` / `object.reorder`（`toIndex`）落地。 */
export interface ReorderPlan {
  readonly command: 'layer.reorder' | 'object.reorder';
  readonly id: NodeId;
  /** 目标容器内（移除自身后的）插入下标。 */
  readonly toIndex: number;
}

/** 拖拽行类型不匹配（如图元拖到图层行）返回 null。 */
function compatible(drag: DropDrag, target: DropTarget): boolean {
  if (drag.kind === 'layer' && target.kind === 'layer') return true;
  if (drag.kind === 'node' && target.kind === 'node') return true;
  return false;
}

/**
 * 通用落点 → 重排计划。
 *
 * - `layer → layer`：在 `doc.layers` 中重排
 * - `node → node`：在共同父容器（Layer/Group）的 `children` 中重排；跨容器返回 null（P1 边界）
 * - 同 id 返回 null
 */
export function planReorderDrop(
  doc: Document,
  drag: DropDrag,
  target: DropTarget,
): ReorderPlan | null {
  if (drag.id === target.id) return null;
  if (!compatible(drag, target)) return null;

  if (drag.kind === 'layer') {
    const arr = doc.layers;
    const dragIdx = arr.indexOf(drag.id);
    const targetIdx = arr.indexOf(target.id);
    if (dragIdx < 0 || targetIdx < 0) return null;
    // 移除自身后计算插入位
    const removed = arr.filter((_, i) => i !== dragIdx);
    const newTargetIdx = removed.indexOf(target.id);
    const toIndex = target.position === 'before' ? newTargetIdx : newTargetIdx + 1;
    return { command: 'layer.reorder', id: drag.id, toIndex };
  }

  // node → node：必须同父容器
  const parentId = findParent(doc, drag.id);
  if (!parentId || parentId !== findParent(doc, target.id)) return null;
  const parent = doc.nodes.get(parentId);
  if (!parent || (parent.kind !== 'Layer' && parent.kind !== 'Group')) return null;
  const arr = parent.children;
  const dragIdx = arr.indexOf(drag.id);
  const targetIdx = arr.indexOf(target.id);
  if (dragIdx < 0 || targetIdx < 0) return null;
  const removed = arr.filter((_, i) => i !== dragIdx);
  const newTargetIdx = removed.indexOf(target.id);
  const toIndex = target.position === 'before' ? newTargetIdx : newTargetIdx + 1;
  return { command: 'object.reorder', id: drag.id, toIndex };
}

/**
 * 沿树向上查找直到最外层编组（Group）；若自身直接挂在图层下或找不到则返回自身。
 * 用于实现常规点选选中编组整体，而非散碎叶子节点。
 */
export function findOutermostGroup(doc: Document, id: NodeId): NodeId {
  let cur = id;
  while (true) {
    const parentId = findParent(doc, cur);
    if (!parentId) return cur;
    const parent = doc.nodes.get(parentId);
    if (!parent || parent.kind === 'Layer') return cur;
    cur = parentId;
  }
}

/**
 * 获取节点的所有祖先节点列表（从直接父级一直向上到 Layer）。
 */
export function findAncestors(doc: Document, id: NodeId): NodeId[] {
  const ancestors: NodeId[] = [];
  let cur = findParent(doc, id);
  while (cur) {
    ancestors.push(cur);
    cur = findParent(doc, cur);
  }
  return ancestors;
}

/**
 * 过滤选区 ID 列表，保留互斥的顶级根节点（若某节点的祖先已在列表中，则剔除该子节点）。
 * 彻底防止多选变换/复制/删除时父子同时处理导致的二次位移、二次缩放或并发删除报错。
 */
export function keepDisjointRoots(doc: Document, ids: ReadonlyArray<NodeId>): NodeId[] {
  const idSet = new Set(ids);
  return ids.filter((id) => {
    let cur = findParent(doc, id);
    while (cur) {
      if (idSet.has(cur)) return false;
      cur = findParent(doc, cur);
    }
    return true;
  });
}

