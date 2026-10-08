/**
 * OmniView SVG v2 — 节点包围盒与对齐几何纯函数 (ADR-0001 §2.4)
 *
 * - `transformRect`  : AABB 经仿射变换后的轴对齐包围盒
 * - `nodeBBox`       : 节点在其父坐标系中的世界包围盒（Group 递归聚合）
 * - `alignDelta`     : 对齐模式 → 平移向量
 * - `distributeOffsets`: 等距分布 → 各节点中心偏移量
 *
 * 纯函数、无副作用、可独立单测。
 */
import type { AffineTransform, Document, Node, NodeId, Rect } from './types';
import { applyTransform } from './document';
import { getBoundingBox } from './path';

/** 对齐模式（与 `object.align` 命令参数一致）。 */
export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

/** 分布轴。 */
export type DistributeAxis = 'h' | 'v';

// ============================================================================
// 1. 矩形几何
// ============================================================================

/** AABB 经仿射变换后的轴对齐包围盒（4 角点变换取 min/max）。 */
export function transformRect(t: AffineTransform, r: Rect): Rect {
  const p1 = applyTransform(t, { x: r.x, y: r.y });
  const p2 = applyTransform(t, { x: r.x + r.width, y: r.y });
  const p3 = applyTransform(t, { x: r.x, y: r.y + r.height });
  const p4 = applyTransform(t, { x: r.x + r.width, y: r.y + r.height });
  const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
  const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
  const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
  const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 两矩形并集。 */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: x2 - x, height: y2 - y };
}

/** 多矩形并集；空数组返回 null。 */
export function unionRects(rects: ReadonlyArray<Rect>): Rect | null {
  if (rects.length === 0) return null;
  let acc = rects[0]!;
  for (let i = 1; i < rects.length; i++) acc = unionRect(acc, rects[i]!);
  return acc;
}

// ============================================================================
// 2. 节点包围盒
// ============================================================================

function localBBoxOf(node: Node, doc: Document, visited: Set<NodeId>): Rect | null {
  if (visited.has(node.id)) return null;
  visited.add(node.id);
  if (node.kind === 'Path') return getBoundingBox(node.geometry);
  if (node.kind === 'Layer' || node.kind === 'Group') {
    const rects: Rect[] = [];
    for (const childId of node.children) {
      const child = doc.nodes.get(childId);
      if (!child) continue;
      const bb = nodeBBoxInParent(doc, childId, visited);
      if (bb) rects.push(bb);
    }
    return unionRects(rects);
  }
  // Text / Image / Use：P1 无几何，返回 null（调用方跳过）
  return null;
}

function nodeBBoxInParent(doc: Document, id: NodeId, visited: Set<NodeId>): Rect | null {
  const node = doc.nodes.get(id);
  if (!node) return null;
  const local = localBBoxOf(node, doc, visited);
  if (!local) return null;
  const t = node.transform;
  const isIdentity = t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0;
  return isIdentity ? local : transformRect(t, local);
}

/**
 * 节点在其直接父坐标系中的包围盒（含自身 transform；Group 递归聚合子树）。
 * 不存在或无几何返回 null。
 */
export function nodeBBox(doc: Document, id: NodeId): Rect | null {
  return nodeBBoxInParent(doc, id, new Set<NodeId>());
}

// ============================================================================
// 3. 对齐与分布
// ============================================================================

/**
 * 对齐平移量：把 `rect` 对齐到 `target` 后应施加的平移向量。
 * 同轴模式返回 0 分量；输入非法返回 null。
 */
export function alignDelta(rect: Rect, target: Rect, align: AlignMode): { x: number; y: number } | null {
  switch (align) {
    case 'left':
      return { x: target.x - rect.x, y: 0 };
    case 'centerH':
      return { x: target.x + target.width / 2 - (rect.x + rect.width / 2), y: 0 };
    case 'right':
      return { x: target.x + target.width - (rect.x + rect.width), y: 0 };
    case 'top':
      return { x: 0, y: target.y - rect.y };
    case 'centerV':
      return { x: 0, y: target.y + target.height / 2 - (rect.y + rect.height / 2) };
    case 'bottom':
      return { x: 0, y: target.y + target.height - (rect.y + rect.height) };
    default:
      return null;
  }
}

/**
 * 等距分布：按各节点在目标轴上的中心排序，首尾不动，中间节点等间距重排。
 *
 * @param centers 各节点当前中心坐标（由调用方按 x/y 轴选取）；顺序任意
 * @returns 与输入同索引的中心偏移量；节点数 < 3 返回全 0 偏移。
 */
export function distributeOffsets(centers: ReadonlyArray<number>): number[] {
  const n = centers.length;
  if (n < 3) return centers.map(() => 0);
  const order = centers.map((c, i) => ({ c, i })).sort((a, b) => a.c - b.c);
  const first = order[0]!;
  const last = order[n - 1]!;
  const step = (last.c - first.c) / (n - 1);
  const offsets = new Array<number>(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    const item = order[k]!;
    const targetCenter = first.c + step * k;
    offsets[item.i] = targetCenter - item.c;
  }
  return offsets;
}
