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
import { applyTransform, composeTransforms } from './document';
import { getBoundingBox } from './path';
import { findParent } from './tree';

/** 对齐模式（与 `object.align` 命令参数一致，支持 centerH/center 及 centerV/middle 别名）。 */
export type AlignMode = 'left' | 'centerH' | 'center' | 'right' | 'top' | 'centerV' | 'middle' | 'bottom';

/** 分布轴（支持 h/horizontal 与 v/vertical 别名）。 */
export type DistributeAxis = 'h' | 'v' | 'horizontal' | 'vertical';

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
  if (node.kind === 'Image') {
    return { x: node.x ?? 0, y: node.y ?? 0, width: node.width, height: node.height };
  }
  if (node.kind === 'Use') {
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    if (w <= 0 && h <= 0) return null;
    return { x: node.x ?? 0, y: node.y ?? 0, width: Math.max(w, 0), height: Math.max(h, 0) };
  }
  // Text：无度量引擎，按字号近似（CJK 全宽 / 拉丁半宽）；P2 接入真实文本测量。
  return textLocalBBox(node);
}

/** 文本节点的近似局部包围盒（基线为 `y`）。 */
function textLocalBBox(node: Extract<Node, { readonly kind: 'Text' }>): Rect | null {
  const text = node.text ?? '';
  if (text.length === 0) return null;
  const fontSize = node.fontSize ?? 16;
  let width = 0;
  for (const ch of text) {
    width += ch.codePointAt(0)! >= 0x2e80 ? fontSize : fontSize * 0.55;
  }
  const height = fontSize * 1.25;
  const anchorX = node.x ?? 0;
  const baselineY = node.y ?? 0;
  const anchor = node.textAnchor ?? 'start';
  const x0 = anchor === 'middle' ? anchorX - width / 2 : anchor === 'end' ? anchorX - width : anchorX;
  return { x: x0, y: baselineY - fontSize * 0.8, width, height };
}

/**
 * 节点在**自身局部坐标系**中的包围盒（不含 transform；Group 聚合子树并考虑子 transform）。
 * 命中测试（父系坐标 → 局部坐标反变换后比较）用。
 */
export function localNodeBBox(node: Node, doc: Document): Rect | null {
  return localBBoxOf(node, doc, new Set<NodeId>());
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

/**
 * 计算节点在 SVG 根画布（世界坐标系）下的复合仿射变换矩阵。
 * 递归组合从 Root/Layer 经所有祖先 Group 直至自身的变换。
 */
export function nodeWorldTransform(doc: Document, id: NodeId): AffineTransform {
  const chain: AffineTransform[] = [];
  let cur: NodeId | null = id;
  while (cur) {
    const node = doc.nodes.get(cur);
    if (!node) break;
    chain.push(node.transform);
    cur = findParent(doc, cur);
  }
  let world: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  for (let i = chain.length - 1; i >= 0; i--) {
    world = composeTransforms(world, chain[i]!);
  }
  return world;
}

/**
 * 节点在 SVG 根画布（世界坐标系）中的真实包围盒。
 * 针对子节点/嵌套编组，自动应用完整祖先变换链，确保高亮框、变形手柄与 HUD 像素级对齐。
 */
export function nodeWorldBBox(doc: Document, id: NodeId): Rect | null {
  const node = doc.nodes.get(id);
  if (!node) return null;
  const local = localNodeBBox(node, doc);
  if (!local) return null;
  const worldT = nodeWorldTransform(doc, id);
  return transformRect(worldT, local);
}

/**
 * 计算多个节点在 SVG 根画布下的合并包围盒（并集）。
 */
export function getSelectionBBox(doc: Document, ids: ReadonlyArray<NodeId>): Rect | null {
  const boxes: Rect[] = [];
  for (const id of ids) {
    const b = nodeWorldBBox(doc, id);
    if (b) boxes.push(b);
  }
  return unionRects(boxes);
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
    case 'center':
      return { x: target.x + target.width / 2 - (rect.x + rect.width / 2), y: 0 };
    case 'right':
      return { x: target.x + target.width - (rect.x + rect.width), y: 0 };
    case 'top':
      return { x: 0, y: target.y - rect.y };
    case 'centerV':
    case 'middle':
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

// ============================================================================
// 4. CAD 窗选 (Window / enclosed) 与交叉选 (Crossing / intersect) 精确几何引擎
// ============================================================================

/** 判断矩形 inner 是否 100% 包含在矩形 outer 内（含微米级浮点容差）。 */
export function rectContainsRect(outer: Rect, inner: Rect, eps = 1e-4): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.y + inner.height <= outer.y + outer.height + eps
  );
}

/** 判断两个轴对齐矩形是否存在交集。 */
export function rectIntersectsRect(a: Rect, b: Rect, eps = 1e-4): boolean {
  return !(
    a.x + a.width < b.x - eps ||
    a.x > b.x + b.width + eps ||
    a.y + a.height < b.y - eps ||
    a.y > b.y + b.height + eps
  );
}

/** Liang-Barsky 算法：精确判断线段 (p1, p2) 是否与矩形 r 相交或位于其内部。 */
export function segmentIntersectsRect(
  p1: { readonly x: number; readonly y: number },
  p2: { readonly x: number; readonly y: number },
  r: Rect,
): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - r.x, r.x + r.width - p1.x, p1.y - r.y, r.y + r.height - p1.y];
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (Math.abs(pi) < 1e-12) {
      if (qi < -1e-6) return false;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

function pointInPolygon2D(
  pt: { readonly x: number; readonly y: number },
  poly: ReadonlyArray<{ readonly x: number; readonly y: number }>,
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * CAD 交叉选 (Crossing / Right-to-Left) 真实几何相交判定：
 * - 剔除斜线、折线、贝塞尔曲线与空心外框在仅判断 AABB 时的假阳性误选；
 * - 只有当拉框完全包含图元、或拉框与图元的真实轮廓线段/曲线段相交、或拉框触碰到小型实心图元内部时才返回 true。
 */
export function nodeIntersectsMarquee(
  doc: Document,
  id: NodeId,
  rect: Rect,
  canvasArea = 480000,
): boolean {
  const node = doc.nodes.get(id);
  if (!node || !node.visible || node.locked || node.kind === 'Layer') return false;
  const bb = nodeWorldBBox(doc, id);
  if (!bb) return false;

  if (node.kind === 'Group') {
    for (const cid of node.children) {
      if (nodeIntersectsMarquee(doc, cid, rect, canvasArea)) return true;
    }
    return false;
  }

  // 非路径原子图元（Text / Image / Use）：以其世界包围盒为准
  if (node.kind !== 'Path') {
    return rectIntersectsRect(rect, bb);
  }

  const worldT = nodeWorldTransform(doc, id);
  const strokeItem = node.appearance.items.find((it) => it.kind === 'stroke');
  const rawStrokeW =
    strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.paint.type !== 'none'
      ? strokeItem.stroke.width
      : 0;
  const scaleFactor = Math.max(Math.hypot(worldT.a, worldT.b), Math.hypot(worldT.c, worldT.d), 1);
  const halfStroke = (rawStrokeW * scaleFactor) / 2;

  const expandedRect: Rect = {
    x: rect.x - halfStroke,
    y: rect.y - halfStroke,
    width: rect.width + halfStroke * 2,
    height: rect.height + halfStroke * 2,
  };

  if (!rectIntersectsRect(expandedRect, bb)) return false;
  if (rectContainsRect(expandedRect, bb)) return true;

  const fillItem = node.appearance.items.find((it) => it.kind === 'fill');
  const hasStyledClass = Boolean(node.className);
  const hasFill = fillItem
    ? fillItem.fill.type !== 'none' && (fillItem.fill.type !== 'solid' || fillItem.fill.opacity > 0)
    : hasStyledClass || node.appearance.items.length === 0;

  // 1. 采样每条子路径在世界坐标系下的折线/贝塞尔曲线段，精确检测是否与拉框相交
  for (const sp of node.geometry.subPaths) {
    const anchors = sp.anchors;
    if (anchors.length === 0) continue;
    if (anchors.length === 1) {
      const wp = applyTransform(worldT, anchors[0]!.point);
      if (segmentIntersectsRect(wp, wp, expandedRect)) return true;
      continue;
    }

    const poly: Array<{ x: number; y: number }> = [];
    const segCount = sp.closed ? anchors.length : anchors.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = anchors[i]!;
      const b = anchors[(i + 1) % anchors.length]!;
      const p0 = applyTransform(worldT, a.point);
      const p3 = applyTransform(worldT, b.point);
      poly.push(p0);

      if (a.handleOut != null || b.handleIn != null) {
        const c1 = applyTransform(
          worldT,
          a.handleOut ? { x: a.point.x + a.handleOut.x, y: a.point.y + a.handleOut.y } : a.point,
        );
        const c2 = applyTransform(
          worldT,
          b.handleIn ? { x: b.point.x + b.handleIn.x, y: b.point.y + b.handleIn.y } : b.point,
        );
        const STEPS = 12;
        let prev = p0;
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const mt = 1 - t;
          const mt2 = mt * mt;
          const t2 = t * t;
          const cur = {
            x: mt2 * mt * p0.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t2 * t * p3.x,
            y: mt2 * mt * p0.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t2 * t * p3.y,
          };
          if (segmentIntersectsRect(prev, cur, expandedRect)) return true;
          if (s < STEPS) poly.push(cur);
          prev = cur;
        }
      } else {
        if (segmentIntersectsRect(p0, p3, expandedRect)) return true;
      }
    }

    // 2. 若路径闭合且有实心填充，当拉框完全落在该实心图形内部（未触碰边线）时：
    //    仅当该图形不是大面积背景容器（避免在背景框内部拉框选小元素时把背景框误选中）时判定为命中
    if (sp.closed && hasFill && poly.length >= 3) {
      const isLargeContainer =
        bb.width * bb.height >= canvasArea * 0.16 &&
        rectContainsRect(bb, rect) &&
        rect.width * rect.height < bb.width * bb.height * 0.5;
      if (!isLargeContainer) {
        const rectCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        if (pointInPolygon2D(rectCenter, poly) || pointInPolygon2D({ x: rect.x, y: rect.y }, poly)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * CAD 双模式框选与智能编组穿透匹配器（方案 A）：
 * - `enclosed`（从左到右 · 蓝色实线窗选）：严格要求 100% 包含；若外层 `<g>` 未 100% 包含则自动递归下钻选择内部 100% 包含的子编组/子形状（过滤未随宿主形状一同被包含的孤立卡片内文字）；
 * - `intersect`（从右到左 · 绿色虚线交叉选）：真实几何触碰即选；若 `<g>` 为内聚组件卡片（含外壳背景框）、完全包含、紧凑图标或全形状命中则选 `<g>` 整体，若仅触碰松散编组内部分独立子形状则自动下钻选中对应子项。
 */
export function matchNodesInMarquee(
  doc: Document,
  rect: Rect,
  mode: 'enclosed' | 'intersect',
  activeGroupId?: NodeId | null,
): NodeId[] {
  const canvasW = doc.canvas?.width || doc.canvas?.viewBox?.width || 800;
  const canvasH = doc.canvas?.height || doc.canvas?.viewBox?.height || 600;
  const canvasArea = Math.max(1, canvasW * canvasH);
  const selArea = rect.width * rect.height;

  const isHugeBackground = (bb: Rect): boolean =>
    bb.width * bb.height >= canvasArea * 0.75 && selArea < canvasArea * 0.65;

  // 判断一个 <g> 是否为具有整体外壳背景框的「内聚组件卡片」（如架构图卡片、KPI 面板、带底框节点）
  const isCohesiveCardGroup = (groupNode: Extract<Node, { readonly kind: 'Group' }>, groupBB: Rect): boolean => {
    const groupArea = Math.max(1, groupBB.width * groupBB.height);
    if (groupArea >= canvasArea * 0.75) return false;
    let nonTextShapeCount = 0;
    for (const cid of groupNode.children) {
      const ch = doc.nodes.get(cid);
      if (!ch || !ch.visible || ch.locked) continue;
      if (ch.kind !== 'Text') nonTextShapeCount++;
      if (ch.kind === 'Path') {
        const cbb = nodeWorldBBox(doc, cid);
        if (cbb && cbb.width * cbb.height >= groupArea * 0.7) {
          return true;
        }
      }
    }
    return nonTextShapeCount === 1 && groupNode.children.length > 1;
  };

  // 查找同一父节点下包裹该 Text 节点的最小非全屏背景 Path 容器（即卡片/按钮底框）
  const findBackingSiblingPath = (textId: NodeId): NodeId | null => {
    const parentId = findParent(doc, textId);
    if (!parentId) return null;
    const parent = doc.nodes.get(parentId);
    if (!parent || !('children' in parent)) return null;
    const tbb = nodeWorldBBox(doc, textId);
    if (!tbb) return null;
    const cx = tbb.x + tbb.width / 2;
    const cy = tbb.y + tbb.height / 2;

    let bestPathId: NodeId | null = null;
    let bestArea = Infinity;
    for (const sibId of parent.children) {
      if (sibId === textId) continue;
      const sib = doc.nodes.get(sibId);
      if (!sib || sib.kind !== 'Path' || !sib.visible || sib.locked) continue;
      const sbb = nodeWorldBBox(doc, sibId);
      if (!sbb) continue;
      const area = sbb.width * sbb.height;
      // 忽略全画布大背景板
      if (area >= canvasArea * 0.75) continue;
      if (
        cx >= sbb.x - 2 &&
        cx <= sbb.x + sbb.width + 2 &&
        cy >= sbb.y - 2 &&
        cy <= sbb.y + sbb.height + 2 &&
        area < bestArea
      ) {
        bestArea = area;
        bestPathId = sibId;
      }
    }
    return bestPathId;
  };

  const collectEnclosed = (id: NodeId): NodeId[] => {
    const n = doc.nodes.get(id);
    if (!n || !n.visible || n.locked || n.kind === 'Layer') return [];
    const bb = nodeWorldBBox(doc, id);
    if (!bb) return [];
    if (!rectIntersectsRect(rect, bb)) return [];

    if (n.kind === 'Group') {
      if (rectContainsRect(rect, bb) && !isHugeBackground(bb)) {
        return [id];
      }
      const rawChildHits: NodeId[] = [];
      for (const cid of n.children) {
        rawChildHits.push(...collectEnclosed(cid));
      }
      if (rawChildHits.length === 0) return [];
      const hitSet = new Set<NodeId>(rawChildHits);
      // 过滤掉寄宿在未被完整框住的卡片/按钮底框 (Path) 内的孤立文字，避免窗口局部划过卡片时只把卡片内文字抠出来
      return rawChildHits.filter((hid) => {
        const hn = doc.nodes.get(hid);
        if (!hn || hn.kind !== 'Text') return true;
        const backingId = findBackingSiblingPath(hid);
        return backingId == null || hitSet.has(backingId);
      });
    }

    if (isHugeBackground(bb) && !rectContainsRect(rect, bb)) return [];
    return rectContainsRect(rect, bb) ? [id] : [];
  };

  const collectIntersect = (id: NodeId): NodeId[] => {
    const n = doc.nodes.get(id);
    if (!n || !n.visible || n.locked || n.kind === 'Layer') return [];
    const bb = nodeWorldBBox(doc, id);
    if (!bb) return [];
    const paddedRect: Rect = { x: rect.x - 4, y: rect.y - 4, width: rect.width + 8, height: rect.height + 8 };
    if (!rectIntersectsRect(paddedRect, bb)) return [];

    if (n.kind === 'Group') {
      if (rectContainsRect(rect, bb) && !isHugeBackground(bb)) {
        return [id];
      }
      const visibleChildren = n.children.filter((cid) => {
        const ch = doc.nodes.get(cid);
        return ch && ch.visible && !ch.locked;
      });
      if (visibleChildren.length === 0) return [];

      let hitChildBranches = 0;
      const subHits: NodeId[] = [];
      for (const cid of visibleChildren) {
        const res = collectIntersect(cid);
        if (res.length > 0) {
          hitChildBranches++;
          subHits.push(...res);
        }
      }
      if (subHits.length === 0) return [];

      const isCompactSymbol =
        bb.width <= 72 && bb.height <= 72 && bb.width * bb.height <= canvasArea * 0.08;
      // 若该 Group 是带外壳底框的内聚组件卡片（如 4+1 视图卡片、微服务节点卡片），右→左交叉碰触其任何部分均整体选中该 Group！
      if (
        !isHugeBackground(bb) &&
        (isCohesiveCardGroup(n, bb) || hitChildBranches === visibleChildren.length || isCompactSymbol)
      ) {
        return [id];
      }
      return subHits;
    }

    if (isHugeBackground(bb)) return [];
    return nodeIntersectsMarquee(doc, id, rect, canvasArea) ? [id] : [];
  };

  const rootCandidateIds: NodeId[] = [];
  if (activeGroupId != null) {
    const activeGroup = doc.nodes.get(activeGroupId);
    if (activeGroup && activeGroup.kind === 'Group') {
      rootCandidateIds.push(...activeGroup.children);
    }
  }
  if (rootCandidateIds.length === 0) {
    for (const layerId of doc.layers) {
      const layer = doc.nodes.get(layerId);
      if (!layer || layer.kind !== 'Layer' || !layer.visible || layer.locked) continue;
      for (const childId of layer.children) rootCandidateIds.push(childId);
    }
  }

  const matched: NodeId[] = [];
  for (const cid of rootCandidateIds) {
    if (mode === 'intersect') {
      matched.push(...collectIntersect(cid));
    } else {
      matched.push(...collectEnclosed(cid));
    }
  }

  // 顶层过滤/补齐：
  // 1) 在 enclosed (左→右窗口) 模式下，若某顶层 Text 位于某个未被选中的顶层非背景 Path 底框内，不单独选中孤立文字；
  // 2) 在 intersect (右→左交叉) 模式下，若某顶层 Text 被触碰且它附着于某个顶层非背景小标签框 Path，自动连同其底框一并选中。
  const matchedSet = new Set<NodeId>(matched);
  const finalMatched: NodeId[] = [];
  for (const mid of matched) {
    const mn = doc.nodes.get(mid);
    if (mn && mn.kind === 'Text' && activeGroupId == null) {
      const backingId = findBackingSiblingPath(mid);
      if (backingId != null) {
        if (mode === 'enclosed' && !matchedSet.has(backingId)) {
          continue;
        }
        if (mode === 'intersect' && !matchedSet.has(backingId)) {
          const bbb = nodeWorldBBox(doc, backingId);
          if (bbb && bbb.width * bbb.height < canvasArea * 0.16) {
            matchedSet.add(backingId);
            finalMatched.push(backingId);
          }
        }
      }
    }
    finalMatched.push(mid);
  }

  return Array.from(new Set(finalMatched));
}
