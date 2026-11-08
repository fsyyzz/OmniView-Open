/**
 * OmniView SVG 编辑引擎 v2 — 路径布尔运算与连接线端口跟随引擎 (P2: SVG-07 & SVG-08)
 *
 * 职责：
 * - SVG-07 路径布尔运算 (`union` 联集 / `subtract` 差集 / `intersect` 交集 / `exclude` 异或)：
 *   支持任意闭合 Path / Rect / Circle / Ellipse / Polygon 的精确 2D 布尔几何合成
 * - SVG-08 图元连接线磁吸锚点 (`ConnectorPortId`) 与移动/缩放时的动态端点跟随 (`syncConnectedLines`)
 */

import type {
  AffineTransform,
  Anchor,
  Document,
  Node,
  NodeId,
  PathGeometry,
  PathNode,
  Rect,
  SubPath,
  Vec2,
} from './types';
import {
  anchorCorner,
  appendToLayer,
  identityTransform,
  invertTransform,
  makePath,
  pathGeometry,
  removeNode,
  subPath,
  updateNode,
} from './document';
import { nodeWorldBBox, nodeWorldTransform, unionRects } from './bbox';
import { findParent, keepDisjointRoots } from './tree';

// ============================================================================
// 1. SVG-08: 图元磁吸端口计算与连接线自动跟随
// ============================================================================

export type ConnectorPortId = 'n' | 'e' | 's' | 'w' | 'c' | 'nw' | 'ne' | 'se' | 'sw';

export interface ConnectorBinding {
  readonly nodeId: NodeId;
  readonly port: ConnectorPortId;
}

export interface ShapePortPoint {
  readonly nodeId: NodeId;
  readonly port: ConnectorPortId;
  readonly point: Vec2;
}

/** 计算指定图元在世界坐标系下的 9 个标准磁吸端口坐标 */
export function getShapeWorldPorts(doc: Document, nodeId: NodeId): ReadonlyArray<ShapePortPoint> {
  const ob = nodeWorldBBox(doc, nodeId);
  if (!ob || (ob.width <= 0 && ob.height <= 0)) return [];
  const cx = ob.x + ob.width / 2;
  const cy = ob.y + ob.height / 2;
  return [
    { nodeId, port: 'n', point: { x: cx, y: ob.y } },
    { nodeId, port: 'e', point: { x: ob.x + ob.width, y: cy } },
    { nodeId, port: 's', point: { x: cx, y: ob.y + ob.height } },
    { nodeId, port: 'w', point: { x: ob.x, y: cy } },
    { nodeId, port: 'c', point: { x: cx, y: cy } },
    { nodeId, port: 'nw', point: { x: ob.x, y: ob.y } },
    { nodeId, port: 'ne', point: { x: ob.x + ob.width, y: ob.y } },
    { nodeId, port: 'se', point: { x: ob.x + ob.width, y: ob.y + ob.height } },
    { nodeId, port: 'sw', point: { x: ob.x, y: ob.y + ob.height } },
  ];
}

/** 根据绑定信息解析目标端口在世界坐标系下的最新坐标 */
export function resolveConnectorBindingWorldPoint(
  doc: Document,
  binding: ConnectorBinding | null | undefined,
): Vec2 | null {
  if (!binding) return null;
  const target = doc.nodes.get(binding.nodeId);
  if (!target || !target.visible) return null;
  const ports = getShapeWorldPorts(doc, binding.nodeId);
  const normPort = String(binding.port).toLowerCase();
  const found = ports.find((p) => p.port === normPort);
  return found ? found.point : null;
}

/** 将世界坐标反变换为指定节点的局部坐标 */
function worldToNodeLocal(doc: Document, nodeId: NodeId, worldPt: Vec2): Vec2 {
  const wt = nodeWorldTransform(doc, nodeId);
  const inv = invertTransform(wt);
  if (!inv) return worldPt;
  return {
    x: inv.a * worldPt.x + inv.c * worldPt.y + inv.e,
    y: inv.b * worldPt.x + inv.d * worldPt.y + inv.f,
  };
}

/**
 * 当画布中的图形节点发生移动、缩放、旋转或对齐时，
 * 自动同步所有绑定了 `connStart` / `connEnd` 的连接线首尾端点坐标。
 */
export function syncConnectedLines(doc: Document, movedIds?: ReadonlyArray<NodeId>): Document {
  let nextDoc = doc;
  const movedSet = movedIds ? new Set(movedIds) : null;

  for (const [id, node] of nextDoc.nodes) {
    if (node.kind !== 'Path') continue;
    const pNode = node as PathNode;
    const startBind = pNode.connStart;
    const endBind = pNode.connEnd;
    if (!startBind && !endBind) continue;

    // 若连接线自身也在本次同批移动选区中且两端绑定的节点也一起移动，仅在单端或目标移动时重算
    const startAffected = startBind && (!movedSet || movedSet.has(startBind.nodeId) || movedSet.has(id));
    const endAffected = endBind && (!movedSet || movedSet.has(endBind.nodeId) || movedSet.has(id));
    if (!startAffected && !endAffected) continue;

    const sp = pNode.geometry.subPaths[0];
    if (!sp || sp.anchors.length < 2) continue;

    const newStartWorld = startBind ? resolveConnectorBindingWorldPoint(nextDoc, startBind) : null;
    const newEndWorld = endBind ? resolveConnectorBindingWorldPoint(nextDoc, endBind) : null;
    if (!newStartWorld && !newEndWorld) continue;

    const newAnchors = [...sp.anchors];
    if (newStartWorld) {
      const localStart = worldToNodeLocal(nextDoc, id, newStartWorld);
      newAnchors[0] = { ...newAnchors[0]!, point: { x: Math.round(localStart.x * 10) / 10, y: Math.round(localStart.y * 10) / 10 } };
    }
    if (newEndWorld) {
      const lastIdx = newAnchors.length - 1;
      const localEnd = worldToNodeLocal(nextDoc, id, newEndWorld);
      newAnchors[lastIdx] = { ...newAnchors[lastIdx]!, point: { x: Math.round(localEnd.x * 10) / 10, y: Math.round(localEnd.y * 10) / 10 } };
    }

    nextDoc = updateNode(nextDoc, id, (n) => ({
      ...(n as PathNode),
      geometry: {
        ...pNode.geometry,
        subPaths: [{ ...sp, anchors: newAnchors }, ...pNode.geometry.subPaths.slice(1)],
      },
    }));
  }

  return nextDoc;
}

// ============================================================================
// 2. SVG-07: 路径布尔运算 (Union / Subtract / Intersect / Exclude)
// ============================================================================

export type BooleanOpType = 'union' | 'subtract' | 'intersect' | 'exclude';
export type BooleanOpKind = BooleanOpType;

function applyMatrix(t: AffineTransform, p: Vec2): Vec2 {
  return {
    x: t.a * p.x + t.c * p.y + t.e,
    y: t.b * p.x + t.d * p.y + t.f,
  };
}

/** 将单个 SubPath 在世界坐标系下离散采样为闭合多边形顶点环 */
function sampleSubPathToPolygon(sp: SubPath, worldT: AffineTransform): Vec2[] {
  const pts: Vec2[] = [];
  const anchors = sp.anchors;
  if (anchors.length < 2) return pts;

  const count = anchors.length;
  for (let i = 0; i < count; i++) {
    const a = anchors[i]!;
    const b = anchors[(i + 1) % count]!;
    pts.push(applyMatrix(worldT, a.point));
    if (i === count - 1 && !sp.closed) break;

    if (a.handleOut || b.handleIn) {
      const p0 = a.point;
      const p1 = a.handleOut ? { x: a.point.x + a.handleOut.x, y: a.point.y + a.handleOut.y } : a.point;
      const p2 = b.handleIn ? { x: b.point.x + b.handleIn.x, y: b.point.y + b.handleIn.y } : b.point;
      const p3 = b.point;
      const STEPS = 12;
      for (let s = 1; s < STEPS; s++) {
        const t = s / STEPS;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        const localPt = {
          x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
          y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
        };
        pts.push(applyMatrix(worldT, localPt));
      }
    }
  }
  return pts;
}

/** 射线法判断点是否在多边形环组内部（支持偶奇规则） */
function isPointInPolygons(pt: Vec2, rings: ReadonlyArray<ReadonlyArray<Vec2>>): boolean {
  let inside = false;
  for (const poly of rings) {
    if (poly.length < 3) continue;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i]!.x;
      const yi = poly[i]!.y;
      const xj = poly[j]!.x;
      const yj = poly[j]!.y;
      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

/** 计算两条线段 (p1-p2) 与 (p3-p4) 的交点（含参数 t, u in (0,1)） */
function intersectSegments(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
): { point: Vec2; t: number; u: number } | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;
  const t = (dx * d2y - dy * d2x) / denom;
  const u = (dx * d1y - dy * d1x) / denom;
  if (t >= 1e-5 && t <= 1 - 1e-5 && u >= 1e-5 && u <= 1 - 1e-5) {
    return {
      point: { x: p1.x + t * d1x, y: p1.y + t * d1y },
      t,
      u,
    };
  }
  return null;
}

/** 在多边形每条边上按与另一组多边形的交点进行细分，使所有交点成为显式顶点 */
function subdivideRingsWithIntersections(
  ringsA: ReadonlyArray<ReadonlyArray<Vec2>>,
  ringsB: ReadonlyArray<ReadonlyArray<Vec2>>,
): { subA: Vec2[][]; subB: Vec2[][] } {
  const subdivideOneSet = (
    sourceRings: ReadonlyArray<ReadonlyArray<Vec2>>,
    otherRings: ReadonlyArray<ReadonlyArray<Vec2>>,
  ): Vec2[][] => {
    return sourceRings.map((ring) => {
      if (ring.length < 3) return [...ring];
      const out: Vec2[] = [];
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % n]!;
        out.push(a);
        const hits: Array<{ t: number; point: Vec2 }> = [];
        for (const other of otherRings) {
          const m = other.length;
          if (m < 2) continue;
          for (let j = 0; j < m; j++) {
            const c = other[j]!;
            const d = other[(j + 1) % m]!;
            const hit = intersectSegments(a, b, c, d);
            if (hit) hits.push({ t: hit.t, point: hit.point });
          }
        }
        hits.sort((x, y) => x.t - y.t);
        for (const h of hits) {
          const prev = out[out.length - 1]!;
          if (Math.hypot(h.point.x - prev.x, h.point.y - prev.y) > 0.25) {
            out.push(h.point);
          }
        }
      }
      return out;
    });
  };

  return {
    subA: subdivideOneSet(ringsA, ringsB),
    subB: subdivideOneSet(ringsB, ringsA),
  };
}

interface DirectedSegment {
  readonly a: Vec2;
  readonly b: Vec2;
  used?: boolean;
}

/**
 * 基于边界线段分类与拓扑缝合 (Boundary Classification & Loop Stitching) 的 2D 布尔几何算法
 * 支持 Union (A ∪ B)、Subtract (A - B)、Intersect (A ∩ B)、Exclude (A ⊕ B)
 */
export function computeBooleanGeometry(
  doc: Document,
  nodeIds: ReadonlyArray<NodeId>,
  op: BooleanOpType,
): PathGeometry | null {
  const pathNodes: PathNode[] = [];
  for (const id of nodeIds) {
    const n = doc.nodes.get(id);
    if (n && n.kind === 'Path') pathNodes.push(n);
  }
  if (pathNodes.length < 2) return null;

  // 提取每个 PathNode 在世界坐标系下的闭合多边形环列表
  const allNodeRings: Vec2[][][] = pathNodes.map((pn) => {
    const wt = nodeWorldTransform(doc, pn.id);
    return pn.geometry.subPaths
      .map((sp) => sampleSubPathToPolygon(sp, wt))
      .filter((r) => r.length >= 3);
  });

  if (allNodeRings.some((r) => r.length === 0)) return null;

  // 对 Exclude (异或)，直接保留所有子路径并依赖奇偶或複合路径，或执行逐对布尔合成
  let currentRings: Vec2[][] = allNodeRings[0]!;

  for (let idx = 1; idx < allNodeRings.length; idx++) {
    const nextRings = allNodeRings[idx]!;
    currentRings = booleanTwoRingSets(currentRings, nextRings, op);
  }

  if (currentRings.length === 0) return null;

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const subPaths: SubPath[] = currentRings
    .filter((ring) => ring.length >= 3)
    .map((ring) =>
      subPath(
        ring.map((pt) => anchorCorner({ x: round1(pt.x), y: round1(pt.y) })),
        true,
      ),
    );

  return subPaths.length > 0 ? pathGeometry(subPaths) : null;
}

function ensureClockwise(ring: Vec2[], clockwise: boolean): Vec2[] {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  const isCW = area > 0;
  return isCW === clockwise ? ring : [...ring].reverse();
}

function booleanTwoRingSets(
  ringsA: ReadonlyArray<ReadonlyArray<Vec2>>,
  ringsB: ReadonlyArray<ReadonlyArray<Vec2>>,
  op: BooleanOpType,
): Vec2[][] {
  const normA = ringsA.map((r) => ensureClockwise([...r], true));
  const normB = ringsB.map((r) => ensureClockwise([...r], true));

  if (op === 'exclude') {
    // 异或：保留 A 与 B 反向环组合，形成复合镂空路径
    const revB = normB.map((r) => ensureClockwise([...r], false));
    return [...normA, ...revB];
  }

  const { subA, subB } = subdivideRingsWithIntersections(normA, normB);
  const keptSegments: DirectedSegment[] = [];

  // 分类 A 的每条子边：取边中点判断其是否在 B 内部
  for (const ring of subA) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const inB = isPointInPolygons(mid, normB);
      if (op === 'union' && !inB) {
        keptSegments.push({ a, b });
      } else if (op === 'subtract' && !inB) {
        keptSegments.push({ a, b });
      } else if (op === 'intersect' && inB) {
        keptSegments.push({ a, b });
      }
    }
  }

  // 分类 B 的每条子边：取边中点判断其是否在 A 内部
  for (const ring of subB) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const inA = isPointInPolygons(mid, normA);
      if (op === 'union' && !inA) {
        keptSegments.push({ a, b });
      } else if (op === 'subtract' && inA) {
        // Subtract 时 B 在 A 内部的边方向反转
        keptSegments.push({ a: b, b: a });
      } else if (op === 'intersect' && inA) {
        keptSegments.push({ a, b });
      }
    }
  }

  if (keptSegments.length === 0) {
    return op === 'union' ? [...normA, ...normB] : [];
  }

  // 将有向线段缝合为闭合多边形环 (Loop Stitching)
  const loops: Vec2[][] = [];
  const EPS = 0.6;

  for (let i = 0; i < keptSegments.length; i++) {
    const startSeg = keptSegments[i]!;
    if (startSeg.used) continue;
    startSeg.used = true;

    const ring: Vec2[] = [startSeg.a, startSeg.b];
    let guard = 0;
    while (guard++ < keptSegments.length + 4) {
      const tail = ring[ring.length - 1]!;
      if (ring.length >= 3 && Math.hypot(tail.x - ring[0]!.x, tail.y - ring[0]!.y) <= EPS) {
        ring.pop();
        break;
      }
      let nextSeg: DirectedSegment | null = null;
      let bestDist = EPS;
      for (const cand of keptSegments) {
        if (cand.used) continue;
        const d = Math.hypot(cand.a.x - tail.x, cand.a.y - tail.y);
        if (d <= bestDist) {
          bestDist = d;
          nextSeg = cand;
        }
      }
      if (!nextSeg) break;
      nextSeg.used = true;
      ring.push(nextSeg.b);
    }

    // 简化共线冗余点
    const simplified = simplifyCollinearRing(ring);
    if (simplified.length >= 3) {
      loops.push(simplified);
    }
  }

  return loops;
}

function simplifyCollinearRing(ring: Vec2[]): Vec2[] {
  if (ring.length <= 3) return ring;
  const out: Vec2[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const prev = out.length > 0 ? out[out.length - 1]! : ring[(i - 1 + n) % n]!;
    const cur = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const v1x = cur.x - prev.x;
    const v1y = cur.y - prev.y;
    const v2x = next.x - cur.x;
    const v2y = next.y - cur.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 0.2) continue;
    const cross = Math.abs(v1x * v2y - v1y * v2x) / Math.max(len1 * len2, 1e-6);
    const dot = (v1x * v2x + v1y * v2y) / Math.max(len1 * len2, 1e-6);
    if (cross < 0.015 && dot > 0.98) {
      continue;
    }
    out.push(cur);
  }
  return out.length >= 3 ? out : ring;
}

/** 在文档上执行布尔运算并生成合并后的新 Path 节点 */
export function executeBooleanOpOnDoc(
  doc: Document,
  rawIds: ReadonlyArray<NodeId>,
  op: BooleanOpType,
): { doc: Document; newId: NodeId | null } {
  const cleanIds = keepDisjointRoots(doc, rawIds);
  const pathIds = cleanIds.filter((id) => doc.nodes.get(id)?.kind === 'Path');
  if (pathIds.length < 2) return { doc, newId: null };

  const mergedGeometry = computeBooleanGeometry(doc, pathIds, op);
  if (!mergedGeometry) return { doc, newId: null };

  const primaryNode = doc.nodes.get(pathIds[0]!) as PathNode;
  // 找到目标图层
  let targetLayerId: NodeId | null = null;
  let cur: NodeId | null = pathIds[0]!;
  while (cur) {
    const p = findParent(doc, cur);
    if (!p) break;
    const pNode = doc.nodes.get(p);
    if (pNode?.kind === 'Layer') {
      targetLayerId = p;
      break;
    }
    cur = p;
  }
  if (!targetLayerId && doc.layers.length > 0) {
    targetLayerId = doc.layers[doc.layers.length - 1]!;
  }
  if (!targetLayerId) return { doc, newId: null };

  const opNames: Record<BooleanOpType, string> = {
    union: '布尔联集',
    subtract: '布尔差集',
    intersect: '布尔交集',
    exclude: '布尔异或',
  };

  const newPathNode = makePath(0 as NodeId, mergedGeometry, primaryNode.appearance, 'path');
  (newPathNode as any).name = opNames[op];

  let nextDoc = doc;
  for (const oldId of pathIds) {
    nextDoc = removeNode(nextDoc, oldId);
  }
  const appended = appendToLayer(nextDoc, targetLayerId, newPathNode);
  return { doc: appended.doc, newId: appended.nodeId };
}
