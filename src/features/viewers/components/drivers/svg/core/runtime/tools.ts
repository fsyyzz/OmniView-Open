/**
 * OmniView SVG 编辑引擎 v2 — Tool 集合 (M3 / P0 交互接通)
 *
 * P0 修订：所有手势状态由 Runtime 持有，Tool 经 `ToolContext.gesture` 只读访问，
 * Tool 自身保持纯函数（无内部可变状态）。
 *
 * - select：点击选中、拖拽移动、空白框选（overlay 虚线框）、Shift 加选、方向键微移
 * - node：直接选区（同 select 的移动手势；锚点级编辑复用 v1 交互层）
 * - pen：钢笔（单点 fallback；P2 阶段实现完整锚点拖拽）
 */

import type { Tool, ToolId, OverlayElement, Action } from './types';
import type {
  Document,
  Node,
  NodeId,
  PathNode,
  TextNode,
  PointerEvent,
  ToolContext,
  ToolKey,
  Vec2,
  AffineTransform,
  Appearance,
  Color,
} from '../model/types';
import {
  composeTransforms,
  defaultStroke,
  emptyAppearance,
  vec2,
  pathGeometry,
  subPath,
  anchorCorner,
} from '../model/document';
import { getSelectionBBox, localNodeBBox, nodeBBox, nodeWorldBBox, nodeWorldTransform, unionRects } from '../model/bbox';
import {
  createRectGeometry,
  createEllipseGeometry,
  createLineGeometry,
  createCurveGeometry,
} from '../model/path';
import { findAncestors, findOutermostGroup, findParent } from '../model/tree';

// ============================================================================
// Select Tool
// ============================================================================

interface TransformHandleState {
  readonly kind: 'scale' | 'rotate';
  readonly handleKey: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot';
  readonly origin: Vec2;
  readonly startBBox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly startPoint: Vec2;
  readonly startAngle?: number;
  readonly ids: ReadonlyArray<NodeId>;
}

export interface SnapGuideLine {
  readonly orientation: 'horizontal' | 'vertical';
  readonly position: number;
  readonly from: number;
  readonly to: number;
}

interface PolylineVertexState {
  readonly nodeId: NodeId;
  readonly anchorIndex: number;
  readonly isMidpoint: boolean;
  readonly handleKind?: 'anchor' | 'handleIn' | 'handleOut' | 'curveBend';
  readonly segmentIndex?: number;
  readonly fixedWorldPoint?: Vec2;
}

let activeTransformState: TransformHandleState | null = null;
let activePolylineVertexState: PolylineVertexState | null = null;
let activeSnapGuides: SnapGuideLine[] = [];

/** 判断节点是否为开放折线、曲线或两点直线（具有 1 条未闭合单子路径且锚点数 >= 2）。 */
export function isOpenPolylineNode(node: Node | undefined | null): node is PathNode {
  if (!node || node.kind !== 'Path') return false;
  if (node.geometry.subPaths.length !== 1) return false;
  const sp = node.geometry.subPaths[0]!;
  return !sp.closed && sp.anchors.length >= 2;
}

/** 判断节点是否为带有贝塞尔控制柄的开放曲线。 */
export function isCurvedLineNode(node: Node | undefined | null): node is PathNode {
  if (!isOpenPolylineNode(node)) return false;
  const sp = node.geometry.subPaths[0]!;
  return sp.anchors.some((a) => a.handleIn != null || a.handleOut != null);
}

/** 判断节点是否为两点开放直线或直线箭头。 */
export function isTwoPointLineNode(node: Node | undefined | null): node is PathNode {
  if (!isOpenPolylineNode(node)) return false;
  const sp = node.geometry.subPaths[0]!;
  if (sp.anchors.length !== 2) return false;
  const a0 = sp.anchors[0]!;
  const a1 = sp.anchors[1]!;
  return a0.handleOut == null && a1.handleIn == null;
}

/** 获取开放折线/曲线/直线所有顶点及贝塞尔控制柄在世界坐标系下的坐标列表。 */
export function getPolylineWorldAnchors(
  doc: Document,
  nodeId: NodeId,
): Array<{
  readonly index: number;
  readonly point: Vec2;
  readonly handleInPoint: Vec2 | null;
  readonly handleOutPoint: Vec2 | null;
  readonly kind: 'corner' | 'smooth' | 'symmetric';
}> | null {
  const node = doc.nodes.get(nodeId);
  if (!isOpenPolylineNode(node)) return null;
  const sp = node.geometry.subPaths[0]!;
  const worldT = nodeWorldTransform(doc, nodeId);
  return sp.anchors.map((a, idx) => ({
    index: idx,
    point: applyTransformToPoint(worldT, a.point),
    handleInPoint: a.handleIn
      ? applyTransformToPoint(worldT, { x: a.point.x + a.handleIn.x, y: a.point.y + a.handleIn.y })
      : null,
    handleOutPoint: a.handleOut
      ? applyTransformToPoint(worldT, { x: a.point.x + a.handleOut.x, y: a.point.y + a.handleOut.y })
      : null,
    kind: a.kind,
  }));
}

/** 获取开放折线/曲线/直线各线段中点在世界坐标系下的坐标列表（曲线取 t=0.5 弧顶，直线取几何中点）。 */
export function getPolylineWorldMidpoints(
  doc: Document,
  nodeId: NodeId,
): Array<{ readonly segmentIndex: number; readonly insertIndex: number; readonly point: Vec2; readonly isCurved: boolean }> | null {
  const node = doc.nodes.get(nodeId);
  if (!isOpenPolylineNode(node)) return null;
  const sp = node.geometry.subPaths[0]!;
  if (sp.anchors.length < 2) return null;
  const worldT = nodeWorldTransform(doc, nodeId);
  const midpoints: Array<{ readonly segmentIndex: number; readonly insertIndex: number; readonly point: Vec2; readonly isCurved: boolean }> = [];
  for (let i = 0; i < sp.anchors.length - 1; i++) {
    const a = sp.anchors[i]!;
    const b = sp.anchors[i + 1]!;
    const isCurved = a.handleOut != null || b.handleIn != null;
    if (isCurved) {
      const p0 = a.point;
      const p1 = { x: a.point.x + (a.handleOut?.x ?? 0), y: a.point.y + (a.handleOut?.y ?? 0) };
      const p2 = { x: b.point.x + (b.handleIn?.x ?? 0), y: b.point.y + (b.handleIn?.y ?? 0) };
      const p3 = b.point;
      const localMid = {
        x: 0.125 * p0.x + 0.375 * p1.x + 0.375 * p2.x + 0.125 * p3.x,
        y: 0.125 * p0.y + 0.375 * p1.y + 0.375 * p2.y + 0.125 * p3.y,
      };
      midpoints.push({
        segmentIndex: i,
        insertIndex: i + 1,
        point: applyTransformToPoint(worldT, localMid),
        isCurved: true,
      });
    } else {
      const wa = applyTransformToPoint(worldT, a.point);
      const wb = applyTransformToPoint(worldT, b.point);
      midpoints.push({
        segmentIndex: i,
        insertIndex: i + 1,
        point: { x: (wa.x + wb.x) / 2, y: (wa.y + wb.y) / 2 },
        isCurved: false,
      });
    }
  }
  return midpoints;
}

/** 获取两点直线/箭头在世界坐标系下的起止端点 (p1, p2)。 */
export function getLineWorldEndpoints(
  doc: Document,
  nodeId: NodeId,
): { readonly p1: Vec2; readonly p2: Vec2 } | null {
  const anchors = getPolylineWorldAnchors(doc, nodeId);
  if (!anchors || anchors.length < 2) return null;
  return {
    p1: anchors[0]!.point,
    p2: anchors[anchors.length - 1]!.point,
  };
}

/** 按 15° 阶梯约束从 p1 到 p2 的连线方向。 */
export function constrainLineAngle15Deg(p1: Vec2, p2: Vec2): Vec2 {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return p2;
  const stepRad = Math.PI / 12; // 15°
  const snappedAngle = Math.round(Math.atan2(dy, dx) / stepRad) * stepRad;
  return {
    x: p1.x + Math.cos(snappedAngle) * dist,
    y: p1.y + Math.sin(snappedAngle) * dist,
  };
}

/** 吸附端点到画布其他可见图元的边界连接点（四边中点、四角点、中心或直线端点）。 */
function snapPointToShapePorts(
  doc: Document,
  pt: Vec2,
  zoom: number,
  excludeIds: ReadonlyArray<NodeId> = [],
): { point: Vec2; snapped: boolean; guides: SnapGuideLine[] } {
  const tol = 8 / Math.max(zoom, 1e-4);
  let bestDist = tol;
  let bestPt: Vec2 | null = null;
  const guides: SnapGuideLine[] = [];

  for (const [otherId, n] of doc.nodes) {
    if (excludeIds.includes(otherId) || n.kind === 'Layer' || !n.visible || n.locked) continue;
    const linePts = getLineWorldEndpoints(doc, otherId);
    if (linePts) {
      for (const candidate of [linePts.p1, linePts.p2]) {
        const d = Math.hypot(pt.x - candidate.x, pt.y - candidate.y);
        if (d <= bestDist) {
          bestDist = d;
          bestPt = candidate;
        }
      }
      continue;
    }
    const ob = nodeWorldBBox(doc, otherId);
    if (!ob || (ob.width <= 0 && ob.height <= 0)) continue;
    const cx = ob.x + ob.width / 2;
    const cy = ob.y + ob.height / 2;
    const ports: Vec2[] = [
      { x: cx, y: ob.y },
      { x: ob.x + ob.width, y: cy },
      { x: cx, y: ob.y + ob.height },
      { x: ob.x, y: cy },
      { x: cx, y: cy },
      { x: ob.x, y: ob.y },
      { x: ob.x + ob.width, y: ob.y },
      { x: ob.x + ob.width, y: ob.y + ob.height },
      { x: ob.x, y: ob.y + ob.height },
    ];
    for (const candidate of ports) {
      const d = Math.hypot(pt.x - candidate.x, pt.y - candidate.y);
      if (d <= bestDist) {
        bestDist = d;
        bestPt = candidate;
      }
    }
  }

  if (bestPt) {
    const span = 16 / Math.max(zoom, 1e-4);
    guides.push(
      { orientation: 'vertical', position: bestPt.x, from: bestPt.y - span, to: bestPt.y + span },
      { orientation: 'horizontal', position: bestPt.y, from: bestPt.x - span, to: bestPt.x + span },
    );
    return { point: bestPt, snapped: true, guides };
  }
  return { point: pt, snapped: false, guides: [] };
}

function getTransformHandles(bbox: { x: number; y: number; width: number; height: number }, zoom: number) {
  const rotDist = 20 / Math.max(zoom, 1e-4);
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  return {
    nw: { x: bbox.x, y: bbox.y, opposite: { x: bbox.x + bbox.width, y: bbox.y + bbox.height } },
    n: { x: cx, y: bbox.y, opposite: { x: cx, y: bbox.y + bbox.height } },
    ne: { x: bbox.x + bbox.width, y: bbox.y, opposite: { x: bbox.x, y: bbox.y + bbox.height } },
    e: { x: bbox.x + bbox.width, y: cy, opposite: { x: bbox.x, y: cy } },
    se: { x: bbox.x + bbox.width, y: bbox.y + bbox.height, opposite: { x: bbox.x, y: bbox.y } },
    s: { x: cx, y: bbox.y + bbox.height, opposite: { x: cx, y: bbox.y } },
    sw: { x: bbox.x, y: bbox.y + bbox.height, opposite: { x: bbox.x + bbox.width, y: bbox.y } },
    w: { x: bbox.x, y: cy, opposite: { x: bbox.x + bbox.width, y: cy } },
    rot: { x: cx, y: bbox.y - rotDist, center: { x: cx, y: cy } },
  };
}

function hitTestHandles(
  bbox: { x: number; y: number; width: number; height: number },
  pt: Vec2,
  zoom: number,
): { key: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot'; origin: Vec2 } | null {
  const handles = getTransformHandles(bbox, zoom);
  const tol = 8 / Math.max(zoom, 1e-4);
  const tol2 = tol * tol;
  const rdx = pt.x - handles.rot.x;
  const rdy = pt.y - handles.rot.y;
  if (rdx * rdx + rdy * rdy <= tol2) {
    return { key: 'rot', origin: handles.rot.center };
  }
  const keys = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
  for (const k of keys) {
    const h = handles[k];
    const dx = pt.x - h.x;
    const dy = pt.y - h.y;
    if (dx * dx + dy * dy <= tol2) {
      return { key: k, origin: h.opposite };
    }
  }
  return null;
}

let lastHoverPoint: Vec2 | null = null;
let pendingDrilldownTarget: NodeId | null = null;
let dragOccurred = false;

const selectTool: Tool = {
  id: 'select',
  pointer(ctx, event) {
    return handleSelectPointer(ctx, event);
  },
  key(ctx, key, mods) {
    return handleCommonKeys(ctx, key, mods);
  },
  overlay(ctx) {
    return selectOverlay(ctx);
  },
  cursor(ctx) {
    if (activePolylineVertexState) {
      return 'crosshair';
    }
    if (activeTransformState) {
      if (activeTransformState.kind === 'rotate') return 'grabbing';
      const k = activeTransformState.handleKey;
      if (k === 'nw' || k === 'se') return 'nwse-resize';
      if (k === 'ne' || k === 'sw') return 'nesw-resize';
      if (k === 'n' || k === 's') return 'ns-resize';
      if (k === 'e' || k === 'w') return 'ew-resize';
    }
    if (ctx.gesture?.kind === 'move') {
      return 'move';
    }
    if (ctx.selection.nodeIds.length > 0 && lastHoverPoint) {
      if (ctx.selection.nodeIds.length === 1) {
        const polyAnchors = getPolylineWorldAnchors(ctx.doc, ctx.selection.nodeIds[0]!);
        if (polyAnchors && polyAnchors.length >= 2) {
          const epTol = 10 / Math.max(ctx.zoom, 1e-4);
          const epTol2 = epTol * epTol;
          for (const a of polyAnchors) {
            if ((lastHoverPoint.x - a.point.x) ** 2 + (lastHoverPoint.y - a.point.y) ** 2 <= epTol2) {
              return 'crosshair';
            }
            if (a.handleInPoint && (lastHoverPoint.x - a.handleInPoint.x) ** 2 + (lastHoverPoint.y - a.handleInPoint.y) ** 2 <= epTol2) {
              return 'crosshair';
            }
            if (a.handleOutPoint && (lastHoverPoint.x - a.handleOutPoint.x) ** 2 + (lastHoverPoint.y - a.handleOutPoint.y) ** 2 <= epTol2) {
              return 'crosshair';
            }
          }
          const midpoints = getPolylineWorldMidpoints(ctx.doc, ctx.selection.nodeIds[0]!);
          if (midpoints) {
            for (const m of midpoints) {
              if ((lastHoverPoint.x - m.point.x) ** 2 + (lastHoverPoint.y - m.point.y) ** 2 <= epTol2) {
                return 'crosshair';
              }
            }
          }
        }
      }
      const singleLineSelected =
        ctx.selection.nodeIds.length === 1 &&
        isOpenPolylineNode(ctx.doc.nodes.get(ctx.selection.nodeIds[0]!));
      if (!singleLineSelected) {
        const selBBox = getSelectionBBox(ctx.doc, ctx.selection.nodeIds);
        if (selBBox) {
          const hitH = hitTestHandles(selBBox, lastHoverPoint, ctx.zoom);
          if (hitH) {
            if (hitH.key === 'rot') return 'grab';
            if (hitH.key === 'nw' || hitH.key === 'se') return 'nwse-resize';
            if (hitH.key === 'ne' || hitH.key === 'sw') return 'nesw-resize';
            if (hitH.key === 'n' || hitH.key === 's') return 'ns-resize';
            if (hitH.key === 'e' || hitH.key === 'w') return 'ew-resize';
          }
        }
      }
      const tol = 5 / Math.max(ctx.zoom, 1e-4);
      const hits = hitTestAllAtPoint(ctx.doc, lastHoverPoint, tol, true);
      if (hits.some((id) => ctx.selection.nodeIds.includes(id) || findAncestors(ctx.doc, id).some((a) => ctx.selection.nodeIds.includes(a)))) {
        return 'move';
      }
    }
    return 'default';
  },
};

interface ClickCycleState {
  readonly point: Vec2;
  readonly time: number;
  readonly hits: ReadonlyArray<NodeId>;
  readonly index: number;
}
let lastClickCycleState: ClickCycleState | null = null;

/** 点击选中 / 拖拽移动 / 空白框选 / 线条与折线端点及中点拖拽 / 8 向变形缩放与旋转的手势动作序列。 */
function handleSelectPointer(ctx: ToolContext, event: PointerEvent): ReadonlyArray<Action> {
  if (event.kind === 'down') {
    dragOccurred = false;
    pendingDrilldownTarget = null;
    lastHoverPoint = event.point;

    const additiveSelection = Boolean(event.mods.shift || event.mods.ctrl || event.mods.meta);
    if (ctx.selection.nodeIds.length > 0 && !additiveSelection) {
      // 若单选的是直线、折线或箭头：优先检测折点/端点直接拖拽，以及线段中点「拖拽即折」
      if (ctx.selection.nodeIds.length === 1) {
        const selId = ctx.selection.nodeIds[0]!;
        const selNode = ctx.doc.nodes.get(selId);
        if (isOpenPolylineNode(selNode)) {
          const polyAnchors = getPolylineWorldAnchors(ctx.doc, selId);
          if (polyAnchors && polyAnchors.length >= 2) {
            const epTol = 10 / Math.max(ctx.zoom, 1e-4);
            const epTol2 = epTol * epTol;

            // 0. 优先检测是否按住某个贝塞尔控制柄 (handleOut / handleIn)
            for (let i = 0; i < polyAnchors.length; i++) {
              const anc = polyAnchors[i]!;
              if (anc.handleOutPoint) {
                const d2 = (event.point.x - anc.handleOutPoint.x) ** 2 + (event.point.y - anc.handleOutPoint.y) ** 2;
                if (d2 <= epTol2) {
                  activePolylineVertexState = {
                    nodeId: selId,
                    anchorIndex: i,
                    isMidpoint: false,
                    handleKind: 'handleOut',
                    fixedWorldPoint: anc.point,
                  };
                  return [{ kind: 'Begin', label: '调节曲线控制柄' }];
                }
              }
              if (anc.handleInPoint) {
                const d2 = (event.point.x - anc.handleInPoint.x) ** 2 + (event.point.y - anc.handleInPoint.y) ** 2;
                if (d2 <= epTol2) {
                  activePolylineVertexState = {
                    nodeId: selId,
                    anchorIndex: i,
                    isMidpoint: false,
                    handleKind: 'handleIn',
                    fixedWorldPoint: anc.point,
                  };
                  return [{ kind: 'Begin', label: '调节曲线控制柄' }];
                }
              }
            }

            // 1. 检测是否按住某个已有顶点 (端点或折点)
            for (let i = 0; i < polyAnchors.length; i++) {
              const pt = polyAnchors[i]!.point;
              const d2 = (event.point.x - pt.x) ** 2 + (event.point.y - pt.y) ** 2;
              if (d2 <= epTol2) {
                const fixedPoint =
                  i > 0
                    ? polyAnchors[i - 1]!.point
                    : polyAnchors.length > 1
                      ? polyAnchors[1]!.point
                      : undefined;
                activePolylineVertexState = {
                  nodeId: selId,
                  anchorIndex: i,
                  isMidpoint: false,
                  handleKind: 'anchor',
                  fixedWorldPoint: fixedPoint,
                };
                return [{ kind: 'Begin', label: '调整折点' }];
              }
            }

            // 2. 其次检测是否按住线段中点（曲线段中点直接拖拽改变弧度；直线段中点拖拽拉出折点）
            const midpoints = getPolylineWorldMidpoints(ctx.doc, selId);
            if (midpoints) {
              for (const mid of midpoints) {
                const d2 = (event.point.x - mid.point.x) ** 2 + (event.point.y - mid.point.y) ** 2;
                if (d2 <= epTol2) {
                  if (mid.isCurved) {
                    activePolylineVertexState = {
                      nodeId: selId,
                      anchorIndex: mid.insertIndex,
                      segmentIndex: mid.segmentIndex,
                      isMidpoint: true,
                      handleKind: 'curveBend',
                    };
                    return [{ kind: 'Begin', label: '拖拽调节曲线弧度' }];
                  }
                  activePolylineVertexState = {
                    nodeId: selId,
                    anchorIndex: mid.insertIndex,
                    segmentIndex: mid.segmentIndex,
                    isMidpoint: true,
                    handleKind: 'anchor',
                    fixedWorldPoint: polyAnchors[mid.segmentIndex]!.point,
                  };
                  return [{ kind: 'Begin', label: '拉出折点' }];
                }
              }
            }
          }
        }
      }

      const singleLineSelected =
        ctx.selection.nodeIds.length === 1 &&
        isOpenPolylineNode(ctx.doc.nodes.get(ctx.selection.nodeIds[0]!));

      if (!singleLineSelected) {
        const selBBox = getSelectionBBox(ctx.doc, ctx.selection.nodeIds);
        if (selBBox) {
          const hitH = hitTestHandles(selBBox, event.point, ctx.zoom);
          if (hitH) {
            if (hitH.key === 'rot') {
              const center = hitH.origin;
              const startAngle = Math.atan2(event.point.y - center.y, event.point.x - center.x);
              activeTransformState = {
                kind: 'rotate',
                handleKey: 'rot',
                origin: center,
                startBBox: selBBox,
                startPoint: event.point,
                startAngle,
                ids: [...ctx.selection.nodeIds],
              };
              return [{ kind: 'Begin', label: '旋转' }];
            } else {
              activeTransformState = {
                kind: 'scale',
                handleKey: hitH.key,
                origin: hitH.origin,
                startBBox: selBBox,
                startPoint: event.point,
                ids: [...ctx.selection.nodeIds],
              };
              return [{ kind: 'Begin', label: '缩放' }];
            }
          }
        }
      }
    }

    const deepSelect = Boolean(event.mods.meta || event.mods.ctrl);
    const tol = 5 / Math.max(ctx.zoom, 1e-4);
    // 始终检索光标下真实的原子叶子图元（deepSelect = true），以精确定位命中目标
    const leafHits = hitTestAllAtPoint(ctx.doc, event.point, tol, true);

    const now = Date.now();
    let targetHit: NodeId | null = null;

    if (leafHits.length > 0) {
      const rawLeaf = leafHits[0]!;

      // 沿树构建完整祖先链条：[rawLeaf, subGroup, ..., outermostGroup]
      const chain: NodeId[] = [rawLeaf];
      let cur = rawLeaf;
      while (true) {
        const p = findParent(ctx.doc, cur);
        if (!p) break;
        const pNode = ctx.doc.nodes.get(p);
        if (!pNode || pNode.kind === 'Layer') break;
        chain.push(p);
        cur = p;
      }
      const outermost = chain[chain.length - 1]!;

      const isSamePoint =
        lastClickCycleState &&
        Math.hypot(lastClickCycleState.point.x - event.point.x, lastClickCycleState.point.y - event.point.y) < tol &&
        now - lastClickCycleState.time < 1200;

      if (isSamePoint && lastClickCycleState && lastClickCycleState.hits.length > 1) {
        // 重复点击同一位置：循环切换选中下一层重叠图元
        const nextIdx = (lastClickCycleState.index + 1) % lastClickCycleState.hits.length;
        targetHit = lastClickCycleState.hits[nextIdx] ?? leafHits[0]!;
        lastClickCycleState = { point: event.point, time: now, hits: lastClickCycleState.hits, index: nextIdx };
      } else if (deepSelect) {
        // 按住 Alt 穿透直选底层叶子/原子图元
        targetHit = rawLeaf;
        lastClickCycleState = { point: event.point, time: now, hits: leafHits, index: 0 };
      } else if (event.mods.alt && leafHits.length > 1) {
        // 按住 Alt 点击：穿透选第二层重叠图元
        targetHit = leafHits[1] ?? leafHits[0]!;
        lastClickCycleState = { point: event.point, time: now, hits: leafHits, index: 1 };
      } else {
        // 循序下钻与拖拽分离：
        // 检查当前选区中是否已有该叶子的某个节点或上级编组
        const selectedAncestorIdx = chain.findIndex((id) => ctx.selection.nodeIds.includes(id));
        if (selectedAncestorIdx >= 0) {
          // 当前已选中该链条中的节点（可能是最外层 Group，也可能是更深子级）
          // 在 down 阶段：坚决保持当前选中层级不变，以便用户正常拖拽移动整个编组！
          targetHit = chain[selectedAncestorIdx]!;
          if (selectedAncestorIdx > 0) {
            // 若用户后续原地松开（未发生拖拽），则在 up 阶段下钻一层到直接子级
            pendingDrilldownTarget = chain[selectedAncestorIdx - 1]!;
          }
        } else {
          // 尚未选中链条上的任何节点 -> 默认选择最外层编组整体
          targetHit = outermost;
        }
        lastClickCycleState = { point: event.point, time: now, hits: [targetHit], index: 0 };
      }
    } else {
      lastClickCycleState = null;
    }

    // 支持 Ctrl / Cmd / Shift 实现多选（增选与反选剔除）
    const additive = Boolean(event.mods.shift || event.mods.ctrl || event.mods.meta);

    if (targetHit == null) {
      const actions: Action[] = [];
      if (!additive) actions.push({ kind: 'Exec', commandId: 'select.clear', params: {} });
      actions.push({ kind: 'Begin', label: '框选', gestureMode: 'marquee' });
      return actions;
    }

    // 命中图元：处理加选/反选与多选拖拽
    const inSelection = ctx.selection.nodeIds.includes(targetHit);
    if (additive) {
      if (inSelection) {
        // Ctrl / Cmd / Shift 点击已选图元 -> 反选剔除（不触发拖拽）
        return [{ kind: 'Exec', commandId: 'select.set', params: { ids: [targetHit], additive: true, toggle: true } }];
      } else {
        // Ctrl / Cmd / Shift 点击未选图元 -> 追加至多选选区并允许继续拖拽
        return [
          { kind: 'Exec', commandId: 'select.set', params: { ids: [targetHit], additive: true } },
          { kind: 'Begin', label: '移动', gestureMode: 'move' },
        ];
      }
    } else {
      // 普通点击（无修饰键）
      if (inSelection) {
        // 已有该选中项（单选或多选之一）：保持当前选区，直接开始移动手势
        return [{ kind: 'Begin', label: '移动', gestureMode: 'move' }];
      }
      return [
        { kind: 'Exec', commandId: 'select.set', params: { ids: [targetHit], additive: false } },
        { kind: 'Begin', label: '移动', gestureMode: 'move' },
      ];
    }
  }

  if (event.kind === 'move' || event.kind === 'drag') {
    lastHoverPoint = event.point;
    if (activePolylineVertexState) {
      dragOccurred = true;
      activeSnapGuides = [];
      let targetWorld = event.point;
      if (event.mods.shift && activePolylineVertexState.fixedWorldPoint) {
        targetWorld = constrainLineAngle15Deg(activePolylineVertexState.fixedWorldPoint, targetWorld);
      }
      if (
        !event.mods.alt &&
        activePolylineVertexState.handleKind !== 'handleIn' &&
        activePolylineVertexState.handleKind !== 'handleOut' &&
        activePolylineVertexState.handleKind !== 'curveBend'
      ) {
        const snapped = snapPointToShapePorts(
          ctx.doc,
          targetWorld,
          ctx.zoom,
          [activePolylineVertexState.nodeId],
        );
        if (snapped.snapped) {
          targetWorld = snapped.point;
          activeSnapGuides = snapped.guides;
        }
      }
      const worldT = nodeWorldTransform(ctx.doc, activePolylineVertexState.nodeId);
      const localPt = invertTransformPoint(worldT, targetWorld) ?? targetWorld;

      if (
        activePolylineVertexState.handleKind === 'handleOut' ||
        activePolylineVertexState.handleKind === 'handleIn'
      ) {
        const pathNode = ctx.doc.nodes.get(activePolylineVertexState.nodeId);
        if (pathNode && pathNode.kind === 'Path') {
          const sp = pathNode.geometry.subPaths[0];
          const anc = sp?.anchors[activePolylineVertexState.anchorIndex];
          if (anc) {
            const rel = { x: localPt.x - anc.point.x, y: localPt.y - anc.point.y };
            if (activePolylineVertexState.handleKind === 'handleOut') {
              let nextHandleIn = anc.handleIn;
              if (anc.kind === 'smooth' && anc.handleIn && !event.mods.alt) {
                const inLen = Math.hypot(anc.handleIn.x, anc.handleIn.y);
                const outLen = Math.hypot(rel.x, rel.y);
                if (outLen > 1e-4) {
                  nextHandleIn = { x: (-rel.x / outLen) * inLen, y: (-rel.y / outLen) * inLen };
                }
              }
              return [
                {
                  kind: 'Preview',
                  commandId: 'path.updateAnchor',
                  params: {
                    id: activePolylineVertexState.nodeId,
                    subPathIndex: 0,
                    anchorIndex: activePolylineVertexState.anchorIndex,
                    handleOut: rel,
                    handleIn: nextHandleIn,
                  },
                },
              ];
            } else {
              let nextHandleOut = anc.handleOut;
              if (anc.kind === 'smooth' && anc.handleOut && !event.mods.alt) {
                const outLen = Math.hypot(anc.handleOut.x, anc.handleOut.y);
                const inLen = Math.hypot(rel.x, rel.y);
                if (inLen > 1e-4) {
                  nextHandleOut = { x: (-rel.x / inLen) * outLen, y: (-rel.y / inLen) * outLen };
                }
              }
              return [
                {
                  kind: 'Preview',
                  commandId: 'path.updateAnchor',
                  params: {
                    id: activePolylineVertexState.nodeId,
                    subPathIndex: 0,
                    anchorIndex: activePolylineVertexState.anchorIndex,
                    handleIn: rel,
                    handleOut: nextHandleOut,
                  },
                },
              ];
            }
          }
        }
      }

      if (activePolylineVertexState.handleKind === 'curveBend') {
        const pathNode = ctx.doc.nodes.get(activePolylineVertexState.nodeId);
        if (pathNode && pathNode.kind === 'Path') {
          const sp = pathNode.geometry.subPaths[0];
          const segIdx = activePolylineVertexState.segmentIndex ?? 0;
          const a = sp?.anchors[segIdx];
          const b = sp?.anchors[segIdx + 1];
          if (sp && a && b) {
            // 让曲线在 t=0.5 处精确穿过光标 localPt：二次控制点 C = 2*M - 0.5*(P0 + P3)
            const ctrlX = 2 * localPt.x - 0.5 * (a.point.x + b.point.x);
            const ctrlY = 2 * localPt.y - 0.5 * (a.point.y + b.point.y);
            const hOut = { x: (2 / 3) * (ctrlX - a.point.x), y: (2 / 3) * (ctrlY - a.point.y) };
            const hIn = { x: (2 / 3) * (ctrlX - b.point.x), y: (2 / 3) * (ctrlY - b.point.y) };
            const newAnchors = sp.anchors.map((anc, idx) => {
              if (idx === segIdx) return { ...anc, handleOut: hOut, kind: 'smooth' as const };
              if (idx === segIdx + 1) return { ...anc, handleIn: hIn, kind: 'smooth' as const };
              return anc;
            });
            return [
              {
                kind: 'Preview',
                commandId: 'path.set',
                params: {
                  id: activePolylineVertexState.nodeId,
                  geometry: { ...pathNode.geometry, subPaths: [{ ...sp, anchors: newAnchors }] },
                },
              },
            ];
          }
        }
      }

      if (activePolylineVertexState.isMidpoint) {
        return [
          {
            kind: 'Preview',
            commandId: 'path.insertAnchor',
            params: {
              id: activePolylineVertexState.nodeId,
              subPathIndex: 0,
              insertIndex: activePolylineVertexState.anchorIndex,
              point: localPt,
              kind: 'corner',
            },
          },
        ];
      }
      return [
        {
          kind: 'Preview',
          commandId: 'path.updateAnchor',
          params: {
            id: activePolylineVertexState.nodeId,
            subPathIndex: 0,
            anchorIndex: activePolylineVertexState.anchorIndex,
            point: localPt,
          },
        },
      ];
    }
    if (activeTransformState) {
      dragOccurred = true;
      if (activeTransformState.kind === 'scale') {
        const orig = activeTransformState.origin;
        const sPt = activeTransformState.startPoint;
        const cur = event.point;
        const dx0 = sPt.x - orig.x;
        const dy0 = sPt.y - orig.y;
        let fx = Math.abs(dx0) > 1e-4 ? (cur.x - orig.x) / dx0 : 1;
        let fy = Math.abs(dy0) > 1e-4 ? (cur.y - orig.y) / dy0 : 1;
        const hk = activeTransformState.handleKey;
        if (hk === 'e' || hk === 'w') fy = 1;
        if (hk === 'n' || hk === 's') fx = 1;
        if (event.mods.shift && (hk === 'nw' || hk === 'ne' || hk === 'se' || hk === 'sw')) {
          const f = Math.max(Math.abs(fx), Math.abs(fy));
          fx = Math.sign(fx || 1) * f;
          fy = Math.sign(fy || 1) * f;
        }
        return [
          {
            kind: 'Preview',
            commandId: 'object.scale',
            params: { ids: [...activeTransformState.ids], origin: orig, factor: { x: fx, y: fy } },
          },
        ];
      } else if (activeTransformState.kind === 'rotate') {
        const center = activeTransformState.origin;
        const curAngle = Math.atan2(event.point.y - center.y, event.point.x - center.x);
        let diffDeg = ((curAngle - (activeTransformState.startAngle ?? 0)) * 180) / Math.PI;
        if (event.mods.shift) {
          diffDeg = Math.round(diffDeg / 15) * 15;
        }
        return [
          {
            kind: 'Preview',
            commandId: 'object.rotate',
            params: { ids: [...activeTransformState.ids], origin: center, angleDeg: diffDeg },
          },
        ];
      }
    }

    if (ctx.gesture) {
      const g = ctx.gesture;
      if (g.kind === 'move') {
        if (g.ids.length === 0) return [];
        let dx = event.point.x - g.startPoint.x;
        let dy = event.point.y - g.startPoint.y;
        if (Math.hypot(dx, dy) > 2 / Math.max(ctx.zoom, 1e-4)) {
          dragOccurred = true;
          pendingDrilldownTarget = null;
        }
        activeSnapGuides = [];

        // 智能吸附 (Smart Guides)：未按 Alt 时计算与画布其他图元边缘/中心的磁吸对齐
        if (!event.mods.alt) {
          const movingBBox = getSelectionBBox(ctx.doc, g.ids);
          if (movingBBox) {
            const zoom = Math.max(ctx.zoom, 1e-4);
            const snapThreshold = 6 / zoom;
            const curLeft = movingBBox.x + dx;
            const curCenterX = curLeft + movingBBox.width / 2;
            const curRight = curLeft + movingBBox.width;

            const curTop = movingBBox.y + dy;
            const curCenterY = curTop + movingBBox.height / 2;
            const curBottom = curTop + movingBBox.height;

            let bestSnapX: { diff: number; targetX: number; targetBox: { x: number; y: number; width: number; height: number } } | null = null;
            let bestSnapY: { diff: number; targetY: number; targetBox: { x: number; y: number; width: number; height: number } } | null = null;

            // 收集其他可见非选中图元的包围盒
            for (const otherId of ctx.doc.nodes.keys()) {
              if (g.ids.includes(otherId) || ctx.selection.nodeIds.includes(otherId)) continue;
              const n = ctx.doc.nodes.get(otherId);
              if (!n || n.kind === 'Layer') continue;
              const ob = nodeWorldBBox(ctx.doc, otherId);
              if (!ob || ob.width <= 0 || ob.height <= 0) continue;

              // X 轴候选对齐 (左中右)
              const otherXs = [ob.x, ob.x + ob.width / 2, ob.x + ob.width];
              const curXs = [curLeft, curCenterX, curRight];
              for (const cx of curXs) {
                for (const ox of otherXs) {
                  const d = ox - cx;
                  if (Math.abs(d) <= snapThreshold) {
                    if (!bestSnapX || Math.abs(d) < Math.abs(bestSnapX.diff)) {
                      bestSnapX = { diff: d, targetX: ox, targetBox: ob };
                    }
                  }
                }
              }

              // Y 轴候选对齐 (顶中底)
              const otherYs = [ob.y, ob.y + ob.height / 2, ob.y + ob.height];
              const curYs = [curTop, curCenterY, curBottom];
              for (const cy of curYs) {
                for (const oy of otherYs) {
                  const d = oy - cy;
                  if (Math.abs(d) <= snapThreshold) {
                    if (!bestSnapY || Math.abs(d) < Math.abs(bestSnapY.diff)) {
                      bestSnapY = { diff: d, targetY: oy, targetBox: ob };
                    }
                  }
                }
              }
            }

            if (bestSnapX) {
              dx += bestSnapX.diff;
              const y1 = Math.min(curTop + (bestSnapY ? bestSnapY.diff : 0), bestSnapX.targetBox.y) - 15 / zoom;
              const y2 = Math.max(curBottom + (bestSnapY ? bestSnapY.diff : 0), bestSnapX.targetBox.y + bestSnapX.targetBox.height) + 15 / zoom;
              activeSnapGuides.push({ orientation: 'vertical', position: bestSnapX.targetX, from: y1, to: y2 });
            }

            if (bestSnapY) {
              dy += bestSnapY.diff;
              const x1 = Math.min(curLeft + (bestSnapX ? bestSnapX.diff : 0), bestSnapY.targetBox.x) - 15 / zoom;
              const x2 = Math.max(curRight + (bestSnapX ? bestSnapX.diff : 0), bestSnapY.targetBox.x + bestSnapY.targetBox.width) + 15 / zoom;
              activeSnapGuides.push({ orientation: 'horizontal', position: bestSnapY.targetY, from: x1, to: x2 });
            }
          }
        }

        const delta = { x: dx, y: dy };
        if (delta.x === 0 && delta.y === 0) return [];
        return [{ kind: 'Preview', commandId: 'object.move', params: { ids: [...g.ids], delta } }];
      }
      const rect = normalizeRect(g.startPoint, event.point);
      // 支持按住 Ctrl / Cmd / Shift 框选时追加至当前选区 (CAD / 设计软件通用习惯)
      const additive = Boolean(event.mods.shift || event.mods.ctrl || event.mods.meta);
      // CAD 标准准则：
      // 1. 从左向右拉框：窗选 (enclosed，完全包含模式)
      // 2. 从右向左拉框或按住 Alt：交叉选择 (intersect，触碰相交模式)
      const isCrossing = event.point.x < g.startPoint.x;
      const mode = (event.mods.alt || isCrossing) ? 'intersect' : 'enclosed';
      return [{ kind: 'Preview', commandId: 'select.box', params: { rect, additive, mode } }];
    }
  }

  if (event.kind === 'up' || event.kind === 'cancel') {
    activeSnapGuides = [];
    if (activePolylineVertexState) {
      const isMid = activePolylineVertexState.isMidpoint;
      activePolylineVertexState = null;
      if (isMid && !dragOccurred) {
        return [{ kind: 'Cancel' }];
      }
      return [{ kind: 'Commit' }];
    }
    if (activeTransformState) {
      activeTransformState = null;
      return [{ kind: 'Commit' }];
    }
    if (event.kind === 'up' && !dragOccurred && pendingDrilldownTarget != null) {
      const drillTarget = pendingDrilldownTarget;
      pendingDrilldownTarget = null;
      return [
        { kind: 'Commit' },
        { kind: 'Exec', commandId: 'select.set', params: { ids: [drillTarget], additive: false } },
      ];
    }
    pendingDrilldownTarget = null;
    if (ctx.gesture) {
      return [{ kind: 'Commit' }];
    }
  }
  return [];
}

function marqueeOverlay(ctx: ToolContext): ReadonlyArray<OverlayElement> {
  const g = ctx.gesture;
  if (g && g.kind === 'marquee') {
    const rect = normalizeRect(g.startPoint, g.currentPoint);
    const isIntersectMode = g.currentPoint.x < g.startPoint.x;
    // CAD 工业标准规范：
    // - 窗选 (Left -> Right)：实线边框 (dashed: false)、经典 CAD 蓝底透光、严格全包含
    // - 交叉选 (Right -> Left)：虚线边框 (dashed: true)、经典 CAD 绿底透光、触碰相交即选
    const stroke = isIntersectMode ? '#10b981' : '#2563eb';
    const fill = isIntersectMode ? 'rgba(16, 185, 129, 0.16)' : 'rgba(37, 99, 235, 0.16)';
    const dashed = isIntersectMode;
    const lineWidth = 1.2 / Math.max(ctx.zoom, 1e-4);

    return [
      {
        kind: 'rect',
        rect,
        stroke,
        fill,
        lineWidth,
        dashed,
      },
    ];
  }
  return [];
}

/** 选区与手势的虚线矩形、折线各折点/端点手柄及线段中点折叠手柄 (Ghost Midpoints)、8 向变形手柄 overlay。 */
function selectOverlay(ctx: ToolContext): ReadonlyArray<OverlayElement> {
  const g = ctx.gesture;
  if (g && g.kind === 'marquee') {
    return marqueeOverlay(ctx);
  }

  if (ctx.selection.nodeIds.length > 0) {
    const zoom = Math.max(ctx.zoom, 1e-4);
    const lw = 1 / zoom;
    const hSize = 7 / zoom;
    const overlays: OverlayElement[] = [];

    // 单选直线或折线时：渲染各折点/端点控制手柄 + 骨架虚线 + 线段中点的幽灵中点折叠手柄（拖拽即折）
    if (ctx.selection.nodeIds.length === 1) {
      const selId = ctx.selection.nodeIds[0]!;
      const polyAnchors = getPolylineWorldAnchors(ctx.doc, selId);
      if (polyAnchors && polyAnchors.length >= 2) {
        // 1. 沿各线段绘制直线骨架虚线，或为曲线段绘制贝塞尔切线控制杆与控制圆柄
        for (let i = 0; i < polyAnchors.length - 1; i++) {
          const a = polyAnchors[i]!;
          const b = polyAnchors[i + 1]!;
          const isCurved = a.handleOutPoint != null || b.handleInPoint != null;
          if (!isCurved) {
            overlays.push({
              kind: 'line',
              from: a.point,
              to: b.point,
              stroke: 'var(--ov-accent, #4c9aff)',
              lineWidth: lw,
              dashed: true,
            });
          } else {
            if (a.handleOutPoint) {
              overlays.push({
                kind: 'line',
                from: a.point,
                to: a.handleOutPoint,
                stroke: '#f59e0b',
                lineWidth: lw,
                dashed: true,
              });
              overlays.push({
                kind: 'circle',
                center: a.handleOutPoint,
                radius: 4 / zoom,
                stroke: '#f59e0b',
                fill: '#ffffff',
                lineWidth: 1.5 * lw,
                dashed: true,
              });
            }
            if (b.handleInPoint) {
              overlays.push({
                kind: 'line',
                from: b.point,
                to: b.handleInPoint,
                stroke: '#f59e0b',
                lineWidth: lw,
                dashed: true,
              });
              overlays.push({
                kind: 'circle',
                center: b.handleInPoint,
                radius: 4 / zoom,
                stroke: '#f59e0b',
                fill: '#ffffff',
                lineWidth: 1.5 * lw,
                dashed: true,
              });
            }
          }
        }

        // 2. 绘制每个已有折点与首尾端点的控制圆柄
        const total = polyAnchors.length;
        for (let i = 0; i < total; i++) {
          const pt = polyAnchors[i]!.point;
          const isEnd = i === 0 || i === total - 1;
          overlays.push({
            kind: 'circle',
            center: pt,
            radius: (isEnd ? 5.5 : 4.5) / zoom,
            stroke: isEnd && i === total - 1 ? '#ffffff' : 'var(--ov-accent, #4c9aff)',
            fill: isEnd && i === total - 1 ? 'var(--ov-accent, #4c9aff)' : '#ffffff',
            lineWidth: 1.5 * lw,
          });
          overlays.push({
            kind: 'handle',
            center: pt,
            color: isEnd ? (i === 0 ? 'anchor' : 'control') : 'anchor',
            size: 4 / zoom,
          });
        }

        // 3. 绘制线段中点的「幽灵中点折叠手柄 / 曲线弧顶手柄」
        // 直线段拖拽可拉成折线；曲线段拖拽可直接弯曲调节弧顶曲率！
        const midpoints = getPolylineWorldMidpoints(ctx.doc, selId) ?? [];
        for (const mid of midpoints) {
          overlays.push({
            kind: 'circle',
            center: mid.point,
            radius: (mid.isCurved ? 4.2 : 3.5) / zoom,
            stroke: mid.isCurved ? '#f59e0b' : 'var(--ov-accent, #4c9aff)',
            fill: mid.isCurved ? 'rgba(245, 158, 11, 0.35)' : 'var(--ov-accent-soft, rgba(76,154,255,0.45))',
            lineWidth: lw,
            dashed: true,
          });
        }

        for (const guide of activeSnapGuides) {
          if (guide.orientation === 'vertical') {
            overlays.push({
              kind: 'line',
              from: { x: guide.position, y: guide.from },
              to: { x: guide.position, y: guide.to },
              stroke: '#ec4899',
              lineWidth: lw,
              dashed: true,
            });
          } else {
            overlays.push({
              kind: 'line',
              from: { x: guide.from, y: guide.position },
              to: { x: guide.to, y: guide.position },
              stroke: '#ec4899',
              lineWidth: lw,
              dashed: true,
            });
          }
        }
        return overlays;
      }
    }

    const selBBox = getSelectionBBox(ctx.doc, ctx.selection.nodeIds);
    if (!selBBox) return [];

    // 1. 若多选，为每个被选中的独立图元绘制轻量的单像素虚线轮廓
    if (ctx.selection.nodeIds.length > 1) {
      for (const id of ctx.selection.nodeIds) {
        const subBb = nodeWorldBBox(ctx.doc, id);
        if (!subBb) continue;
        overlays.push({
          kind: 'rect',
          rect: subBb,
          stroke: 'var(--ov-accent, #4c9aff)',
          fill: 'none',
          lineWidth: 0.8 * lw,
          dashed: true,
        });
      }
    }

    // 2. 选中包围盒虚线框
    overlays.push({
      kind: 'rect',
      rect: selBBox,
      stroke: 'var(--ov-accent, #4c9aff)',
      fill: 'none',
      lineWidth: lw,
      dashed: true,
    });

    const handles = getTransformHandles(selBBox, zoom);

    // 3. 旋转手柄连接线与圆圈
    overlays.push({
      kind: 'line',
      from: { x: handles.rot.x, y: selBBox.y },
      to: handles.rot,
      stroke: 'var(--ov-accent, #4c9aff)',
      lineWidth: lw,
      dashed: false,
    });
    overlays.push({
      kind: 'circle',
      center: handles.rot,
      radius: 4.5 / zoom,
      stroke: 'var(--ov-accent, #4c9aff)',
      fill: '#ffffff',
      lineWidth: 1.5 * lw,
    });

    // 4. 8 个缩放控制方块
    const keys = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
    for (const k of keys) {
      overlays.push({
        kind: 'handle',
        center: handles[k],
        color: 'control',
        size: hSize,
      });
    }

    // 5. 智能吸附参考线 (Smart Guides)
    for (const guide of activeSnapGuides) {
      if (guide.orientation === 'vertical') {
        overlays.push({
          kind: 'line',
          from: { x: guide.position, y: guide.from },
          to: { x: guide.position, y: guide.to },
          stroke: '#ec4899', // 鲜明高亮洋红吸附线
          lineWidth: lw,
          dashed: true,
        });
      } else {
        overlays.push({
          kind: 'line',
          from: { x: guide.from, y: guide.position },
          to: { x: guide.to, y: guide.position },
          stroke: '#ec4899',
          lineWidth: lw,
          dashed: true,
        });
      }
    }

    return overlays;
  }

  return [];
}

/** 由起点/终点归一化出正向矩形。 */
function normalizeRect(a: Vec2, b: Vec2): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** select/node 共用键盘处理：删除、Escape、方向键微移。 */
function handleCommonKeys(ctx: ToolContext, key: ToolKey, mods: { readonly shift: boolean; readonly alt: boolean; readonly meta: boolean; readonly ctrl: boolean }): ReadonlyArray<Action> {
  if (key === 'Delete' || key === 'Backspace') {
    if (ctx.selection.nodeIds.length === 0) return [];
    return [{ kind: 'Exec', commandId: 'object.delete', params: { ids: [...ctx.selection.nodeIds] } }];
  }
  if (key === 'Escape') {
    if (ctx.selection.nodeIds.length === 0) return [];
    return [{ kind: 'Exec', commandId: 'select.clear', params: {} }];
  }
  if (ctx.selection.nodeIds.length > 0) {
    const step = mods.shift ? 10 : 1;
    const delta = arrowDelta(key, step);
    if (delta) {
      return [{ kind: 'Exec', commandId: 'object.move', params: { ids: [...ctx.selection.nodeIds], delta } }];
    }
  }
  return [];
}

function arrowDelta(key: ToolKey, step: number): Vec2 | null {
  switch (key) {
    case 'Up': return { x: 0, y: -step };
    case 'Down': return { x: 0, y: step };
    case 'Left': return { x: -step, y: 0 };
    case 'Right': return { x: step, y: 0 };
    default: return null;
  }
}

// ============================================================================
// Node Tool（直接选区与锚点编辑）
// ============================================================================

let nodeActiveAnchor: { nodeId: NodeId; subPathIndex: number; anchorIndex: number } | null = null;
let penPoints: Vec2[] = [];

function applyTransformToPoint(t: AffineTransform, p: Vec2): Vec2 {
  return {
    x: t.a * p.x + t.c * p.y + t.e,
    y: t.b * p.x + t.d * p.y + t.f,
  };
}

function findNearestAnchor(doc: Document, nodeId: NodeId, point: Vec2, tol2: number) {
  const node = doc.nodes.get(nodeId);
  if (!node || node.kind !== 'Path') return null;
  const worldT = nodeWorldTransform(doc, nodeId);
  const local = invertTransformPoint(worldT, point);
  if (!local) return null;
  for (let spIdx = 0; spIdx < node.geometry.subPaths.length; spIdx++) {
    const sp = node.geometry.subPaths[spIdx]!;
    for (let aIdx = 0; aIdx < sp.anchors.length; aIdx++) {
      const a = sp.anchors[aIdx]!;
      if (pointNear(a.point, local, tol2)) {
        return { subPathIndex: spIdx, anchorIndex: aIdx, localPoint: a.point };
      }
    }
  }
  return null;
}

const nodeTool: Tool = {
  id: 'node',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      const tol2 = (12 / Math.max(ctx.zoom, 1e-4)) ** 2;
      for (const selId of ctx.selection.nodeIds) {
        const hit = findNearestAnchor(ctx.doc, selId, event.point, tol2);
        if (hit) {
          nodeActiveAnchor = { nodeId: selId, subPathIndex: hit.subPathIndex, anchorIndex: hit.anchorIndex };
          return [{ kind: 'Begin', label: '移动锚点', gestureMode: 'move' }];
        }
      }
      nodeActiveAnchor = null;
      return handleSelectPointer(ctx, event);
    }
    if (event.kind === 'drag' && ctx.gesture && nodeActiveAnchor) {
      const node = ctx.doc.nodes.get(nodeActiveAnchor.nodeId);
      if (node && node.kind === 'Path') {
        const worldT = nodeWorldTransform(ctx.doc, nodeActiveAnchor.nodeId);
        const local = invertTransformPoint(worldT, event.point);
        if (local) {
          return [
            {
              kind: 'Preview',
              commandId: 'path.updateAnchor',
              params: {
                id: nodeActiveAnchor.nodeId,
                subPathIndex: nodeActiveAnchor.subPathIndex,
                anchorIndex: nodeActiveAnchor.anchorIndex,
                point: local,
              },
            },
          ];
        }
      }
      return [];
    }
    if (event.kind === 'up' && ctx.gesture && nodeActiveAnchor) {
      return [{ kind: 'Commit' }];
    }
    return handleSelectPointer(ctx, event);
  },
  key(ctx, key, mods) {
    if ((key === 'Delete' || key === 'Backspace') && nodeActiveAnchor) {
      const action: Action = {
        kind: 'Exec',
        commandId: 'path.deleteAnchor',
        params: { id: nodeActiveAnchor.nodeId, anchorIndex: nodeActiveAnchor.anchorIndex },
      };
      nodeActiveAnchor = null;
      return [action];
    }
    return handleCommonKeys(ctx, key, mods);
  },
  overlay(ctx) {
    const overlays: OverlayElement[] = [];
    if (ctx.gesture && ctx.gesture.kind === 'marquee') {
      overlays.push(...marqueeOverlay(ctx));
    }
    const handleSize = 6 / Math.max(ctx.zoom, 1e-4);
    for (const selId of ctx.selection.nodeIds) {
      const node = ctx.doc.nodes.get(selId);
      if (!node || node.kind !== 'Path') continue;
      const worldT = nodeWorldTransform(ctx.doc, selId);
      for (let spIdx = 0; spIdx < node.geometry.subPaths.length; spIdx++) {
        const sp = node.geometry.subPaths[spIdx]!;
        for (let aIdx = 0; aIdx < sp.anchors.length; aIdx++) {
          const a = sp.anchors[aIdx]!;
          const world = applyTransformToPoint(worldT, a.point);
          const isTarget =
            nodeActiveAnchor &&
            nodeActiveAnchor.nodeId === selId &&
            nodeActiveAnchor.subPathIndex === spIdx &&
            nodeActiveAnchor.anchorIndex === aIdx;
          overlays.push({
            kind: 'handle',
            center: world,
            color: isTarget ? 'anchor' : 'control',
            size: isTarget ? handleSize * 1.5 : handleSize,
          });
        }
      }
    }
    return overlays;
  },
  cursor() { return 'default'; },
};

// ============================================================================
// Pen Tool（钢笔多点画线与闭合）
// ============================================================================

const penTool: Tool = {
  id: 'pen',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      if (penPoints.length === 0) {
        penPoints = [event.point];
        return [{ kind: 'Begin', label: '绘制路径', gestureMode: 'marquee' }];
      }
      const tol2 = (14 / Math.max(ctx.zoom, 1e-4)) ** 2;
      if (penPoints.length >= 2 && pointNear(event.point, penPoints[0]!, tol2)) {
        const anchors = penPoints.map((pt) => anchorCorner(pt));
        const geometry = pathGeometry([subPath(anchors, true)]);
        penPoints = [];
        return [
          { kind: 'Exec', commandId: 'object.createPath', params: { geometry, hint: 'path' } },
          { kind: 'Commit' },
        ];
      }
      penPoints.push(event.point);
      return [];
    }
    return [];
  },
  key(_ctx, key) {
    if (key === 'Enter' && penPoints.length >= 2) {
      const anchors = penPoints.map((pt) => anchorCorner(pt));
      const geometry = pathGeometry([subPath(anchors, false)]);
      penPoints = [];
      return [
        { kind: 'Exec', commandId: 'object.createPath', params: { geometry, hint: 'path' } },
        { kind: 'Commit' },
      ];
    }
    if (key === 'Escape') {
      penPoints = [];
      return [{ kind: 'Cancel' }];
    }
    return [];
  },
  overlay(ctx) {
    if (penPoints.length === 0) return [];
    const overlays: OverlayElement[] = [];
    const pts = [...penPoints];
    if (ctx.gesture && ctx.gesture.currentPoint) {
      pts.push(ctx.gesture.currentPoint);
    }
    if (pts.length >= 2) {
      overlays.push({
        kind: 'polyline',
        points: pts,
        stroke: 'var(--ov-accent, #4c9aff)',
        lineWidth: 1.5,
        dashed: true,
      });
    }
    overlays.push({
      kind: 'circle',
      center: penPoints[0]!,
      radius: 5 / Math.max(ctx.zoom, 1e-4),
      stroke: 'var(--ov-accent, #4c9aff)',
      fill: 'white',
      lineWidth: 1.5,
    });
    return overlays;
  },
  cursor() { return 'crosshair'; },
};

// ============================================================================
// Rect / Ellipse / Line / Arrow / Text 形状工具
// ============================================================================

const RECT_DEFAULT_APPEARANCE: Appearance = {
  items: [
    { kind: 'fill', fill: { type: 'solid', color: '#3b82f6' as Color, opacity: 0.16 }, blend: 'normal', opacity: 1 },
    { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: '#2563eb' as Color, opacity: 1 }, width: 2 }, blend: 'normal', opacity: 1 },
  ],
};

const ELLIPSE_DEFAULT_APPEARANCE: Appearance = {
  items: [
    { kind: 'fill', fill: { type: 'solid', color: '#10b981' as Color, opacity: 0.16 }, blend: 'normal', opacity: 1 },
    { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: '#059669' as Color, opacity: 1 }, width: 2 }, blend: 'normal', opacity: 1 },
  ],
};

const LINE_DEFAULT_APPEARANCE: Appearance = {
  items: [
    { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: '#6366f1' as Color, opacity: 1 }, width: 2, cap: 'round' }, blend: 'normal', opacity: 1 },
  ],
};

let lastShapeMods: { readonly shift: boolean; readonly alt: boolean } = { shift: false, alt: false };

/** 根据起点、当前点及 Shift（等比正方形/正圆）/ Alt（中心向外扩展）修饰键计算矩形包围盒。 */
function computeConstrainedShapeBox(
  startPoint: Vec2,
  currentPoint: Vec2,
  mods: { readonly shift: boolean; readonly alt: boolean },
): { x: number; y: number; width: number; height: number } {
  let dx = currentPoint.x - startPoint.x;
  let dy = currentPoint.y - startPoint.y;
  if (mods.shift) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * side;
    dy = (dy < 0 ? -1 : 1) * side;
  }
  if (mods.alt) {
    const halfW = Math.abs(dx);
    const halfH = Math.abs(dy);
    return {
      x: startPoint.x - halfW,
      y: startPoint.y - halfH,
      width: halfW * 2,
      height: halfH * 2,
    };
  }
  return normalizeRect(startPoint, { x: startPoint.x + dx, y: startPoint.y + dy });
}

/** 计算直线/箭头起止端点（含端口磁吸与 Shift 15° 角度约束）。 */
function computeLineEndpoints(
  ctx: ToolContext,
  rawStart: Vec2,
  rawEnd: Vec2,
  mods: { readonly shift: boolean; readonly alt: boolean },
): { p1: Vec2; p2: Vec2; guides: SnapGuideLine[] } {
  const exclude = ctx.selection.nodeIds;
  let p1 = rawStart;
  let p2 = rawEnd;
  const guides: SnapGuideLine[] = [];

  if (!mods.alt) {
    const snapStart = snapPointToShapePorts(ctx.doc, p1, ctx.zoom, exclude);
    if (snapStart.snapped) {
      p1 = snapStart.point;
      guides.push(...snapStart.guides);
    }
  }
  if (mods.shift) {
    p2 = constrainLineAngle15Deg(p1, p2);
  }
  if (!mods.alt) {
    const snapEnd = snapPointToShapePorts(ctx.doc, p2, ctx.zoom, exclude);
    if (snapEnd.snapped) {
      p2 = snapEnd.point;
      guides.push(...snapEnd.guides);
    }
  }
  return { p1, p2, guides };
}

const rectTool: Tool = {
  id: 'rect',
  pointer(ctx, event) {
    lastShapeMods = { shift: event.mods.shift, alt: event.mods.alt };
    if (event.kind === 'down') {
      return [{ kind: 'Begin', label: '绘制矩形', gestureMode: 'marquee' }];
    }
    if (event.kind === 'drag' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const r = computeConstrainedShapeBox(ctx.gesture.startPoint, event.point, event.mods);
      if (r.width < 2 && r.height < 2) return [];
      const geometry = createRectGeometry(r.x, r.y, Math.max(r.width, 1), Math.max(r.height, 1), Math.min(8, r.width / 4, r.height / 4));
      return [
        {
          kind: 'Preview',
          commandId: 'object.createPath',
          params: { geometry, appearance: RECT_DEFAULT_APPEARANCE, hint: 'rect', name: '矩形' },
        },
      ];
    }
    if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const r = computeConstrainedShapeBox(ctx.gesture.startPoint, event.point, event.mods);
      lastShapeMods = { shift: false, alt: false };
      if (r.width < 2 && r.height < 2) {
        return [{ kind: 'Cancel' }];
      }
      const geometry = createRectGeometry(r.x, r.y, Math.max(r.width, 1), Math.max(r.height, 1), Math.min(8, r.width / 4, r.height / 4));
      return [
        {
          kind: 'Exec',
          commandId: 'object.createPath',
          params: { geometry, appearance: RECT_DEFAULT_APPEARANCE, hint: 'rect', name: '矩形' },
        },
        { kind: 'Commit' },
        { kind: 'Exec', commandId: 'tool.setActive', params: { tool: 'select' } },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  overlay(ctx) {
    if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
    const r = computeConstrainedShapeBox(ctx.gesture.startPoint, ctx.gesture.currentPoint, lastShapeMods);
    return [{
      kind: 'rect',
      rect: r,
      stroke: 'var(--ov-accent, #3b82f6)',
      fill: 'rgba(59, 130, 246, 0.12)',
      lineWidth: 1.5 / Math.max(ctx.zoom, 1e-4),
      dashed: true,
    }];
  },
  cursor() { return 'crosshair'; },
};

let polygonPoints: Vec2[] = [];
let polygonHoverPoint: Vec2 | null = null;

function clearPolygon(): void {
  polygonPoints = [];
  polygonHoverPoint = null;
}

function finishPolygon(): ReadonlyArray<Action> {
  const uniquePoints = polygonPoints.filter((point, index) => {
    const previous = polygonPoints[index - 1];
    return !previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-4;
  });
  if (uniquePoints.length < 3) return [];
  const area = uniquePoints.reduce((sum, point, index) => {
    const next = uniquePoints[(index + 1) % uniquePoints.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  if (Math.abs(area) < 1e-3) return [];

  const geometry = pathGeometry([subPath(uniquePoints.map(anchorCorner), true)]);
  clearPolygon();
  return [
    { kind: 'Exec', commandId: 'object.createPath', params: { geometry, appearance: RECT_DEFAULT_APPEARANCE, hint: 'polygon', name: '多边形' } },
    { kind: 'Commit' },
    { kind: 'Exec', commandId: 'tool.setActive', params: { tool: 'select' } },
  ];
}

const polygonTool: Tool = {
  id: 'polygon',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      const first = polygonPoints[0];
      const closeTolerance = 12 / Math.max(ctx.zoom, 1e-4);
      if (first && polygonPoints.length >= 3 && Math.hypot(event.point.x - first.x, event.point.y - first.y) <= closeTolerance) {
        return finishPolygon();
      }
      if (polygonPoints.length === 0) polygonPoints = [event.point];
      else polygonPoints.push(event.point);
      polygonHoverPoint = event.point;
      return [{ kind: 'Begin', label: '绘制自由多边形', gestureMode: 'marquee' }];
    }
    if (event.kind === 'move' || event.kind === 'drag') polygonHoverPoint = event.point;
    return [];
  },
  key(_ctx, key) {
    if (key === 'Enter') return finishPolygon();
    if (key === 'Escape') {
      clearPolygon();
      return [{ kind: 'Cancel' }];
    }
    return [];
  },
  notify(event) {
    if (event === 'deactivated' || event === 'cancelled') clearPolygon();
  },
  overlay(ctx) {
    if (polygonPoints.length === 0) return [];
    const points = [...polygonPoints];
    if (polygonHoverPoint && !pointNear(polygonHoverPoint, points[points.length - 1]!, 1e-6)) points.push(polygonHoverPoint);
    const overlays: OverlayElement[] = [];
    if (points.length >= 2) {
      overlays.push({ kind: 'polyline', points, stroke: 'var(--ov-accent, #4c9aff)', lineWidth: 1.5 / Math.max(ctx.zoom, 1e-4), dashed: true });
    }
    overlays.push({
      kind: 'circle',
      center: polygonPoints[0]!,
      radius: 5 / Math.max(ctx.zoom, 1e-4),
      stroke: 'var(--ov-accent, #4c9aff)',
      fill: 'var(--ov-bg, white)',
      lineWidth: 1.5 / Math.max(ctx.zoom, 1e-4),
    });
    return overlays;
  },
  cursor() { return 'crosshair'; },
};

const ellipseTool: Tool = {
  id: 'ellipse',
  pointer(ctx, event) {
    lastShapeMods = { shift: event.mods.shift, alt: event.mods.alt };
    if (event.kind === 'down') {
      return [{ kind: 'Begin', label: '绘制椭圆', gestureMode: 'marquee' }];
    }
    if (event.kind === 'drag' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const r = computeConstrainedShapeBox(ctx.gesture.startPoint, event.point, event.mods);
      if (r.width < 2 && r.height < 2) return [];
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const rx = Math.max(r.width / 2, 1);
      const ry = Math.max(r.height / 2, 1);
      const geometry = createEllipseGeometry(cx, cy, rx, ry);
      return [
        {
          kind: 'Preview',
          commandId: 'object.createPath',
          params: {
            geometry,
            appearance: ELLIPSE_DEFAULT_APPEARANCE,
            hint: event.mods.shift ? 'circle' : 'ellipse',
            name: event.mods.shift ? '圆形' : '椭圆',
          },
        },
      ];
    }
    if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const r = computeConstrainedShapeBox(ctx.gesture.startPoint, event.point, event.mods);
      lastShapeMods = { shift: false, alt: false };
      if (r.width < 2 && r.height < 2) {
        return [{ kind: 'Cancel' }];
      }
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const rx = Math.max(r.width / 2, 1);
      const ry = Math.max(r.height / 2, 1);
      const geometry = createEllipseGeometry(cx, cy, rx, ry);
      return [
        {
          kind: 'Exec',
          commandId: 'object.createPath',
          params: {
            geometry,
            appearance: ELLIPSE_DEFAULT_APPEARANCE,
            hint: event.mods.shift ? 'circle' : 'ellipse',
            name: event.mods.shift ? '圆形' : '椭圆',
          },
        },
        { kind: 'Commit' },
        { kind: 'Exec', commandId: 'tool.setActive', params: { tool: 'select' } },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  overlay(ctx) {
    if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
    const r = computeConstrainedShapeBox(ctx.gesture.startPoint, ctx.gesture.currentPoint, lastShapeMods);
    return [{
      kind: 'rect',
      rect: r,
      stroke: 'var(--ov-accent, #10b981)',
      fill: 'rgba(16, 185, 129, 0.12)',
      lineWidth: 1.5 / Math.max(ctx.zoom, 1e-4),
      dashed: true,
    }];
  },
  cursor() { return 'crosshair'; },
};

function makeLineOrArrowTool(id: 'line' | 'arrow', withArrowEnd: boolean): Tool {
  const label = withArrowEnd ? '绘制箭头' : '绘制直线';
  const defaultName = withArrowEnd ? '箭头' : '直线';
  return {
    id,
    pointer(ctx, event) {
      lastShapeMods = { shift: event.mods.shift, alt: event.mods.alt };
      if (event.kind === 'down') {
        activeSnapGuides = [];
        return [{ kind: 'Begin', label, gestureMode: 'marquee' }];
      }
      if (event.kind === 'drag' && ctx.gesture && ctx.gesture.kind === 'marquee') {
        const { p1, p2, guides } = computeLineEndpoints(ctx, ctx.gesture.startPoint, event.point, event.mods);
        activeSnapGuides = guides;
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 2) return [];
        const geometry = createLineGeometry(p1.x, p1.y, p2.x, p2.y);
        return [
          {
            kind: 'Preview',
            commandId: 'object.createPath',
            params: {
              geometry,
              appearance: LINE_DEFAULT_APPEARANCE,
              hint: 'line',
              name: defaultName,
              markerEnd: withArrowEnd ? 'arrow' : undefined,
            },
          },
        ];
      }
      if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
        const { p1, p2 } = computeLineEndpoints(ctx, ctx.gesture.startPoint, event.point, event.mods);
        activeSnapGuides = [];
        lastShapeMods = { shift: false, alt: false };
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 2) {
          return [{ kind: 'Cancel' }];
        }
        const geometry = createLineGeometry(p1.x, p1.y, p2.x, p2.y);
        return [
          {
            kind: 'Exec',
            commandId: 'object.createPath',
            params: {
              geometry,
              appearance: LINE_DEFAULT_APPEARANCE,
              hint: 'line',
              name: defaultName,
              markerEnd: withArrowEnd ? 'arrow' : undefined,
            },
          },
          { kind: 'Commit' },
          { kind: 'Exec', commandId: 'tool.setActive', params: { tool: 'select' } },
        ];
      }
      return [];
    },
    key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
    overlay(ctx) {
      if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
      const zoom = Math.max(ctx.zoom, 1e-4);
      const lw = 1.5 / zoom;
      const { p1, p2, guides } = computeLineEndpoints(ctx, ctx.gesture.startPoint, ctx.gesture.currentPoint, lastShapeMods);
      const overlays: OverlayElement[] = [
        {
          kind: 'line',
          from: p1,
          to: p2,
          stroke: 'var(--ov-accent, #6366f1)',
          lineWidth: lw,
          dashed: true,
        },
        {
          kind: 'circle',
          center: p1,
          radius: 4.5 / zoom,
          stroke: 'var(--ov-accent, #6366f1)',
          fill: '#ffffff',
          lineWidth: lw,
        },
        {
          kind: 'circle',
          center: p2,
          radius: 4.5 / zoom,
          stroke: '#ffffff',
          fill: 'var(--ov-accent, #6366f1)',
          lineWidth: lw,
        },
      ];
      for (const guide of guides) {
        if (guide.orientation === 'vertical') {
          overlays.push({
            kind: 'line',
            from: { x: guide.position, y: guide.from },
            to: { x: guide.position, y: guide.to },
            stroke: '#ec4899',
            lineWidth: 1 / zoom,
            dashed: true,
          });
        } else {
          overlays.push({
            kind: 'line',
            from: { x: guide.from, y: guide.position },
            to: { x: guide.to, y: guide.position },
            stroke: '#ec4899',
            lineWidth: 1 / zoom,
            dashed: true,
          });
        }
      }
      return overlays;
    },
    cursor() { return 'crosshair'; },
  };
}

const lineTool: Tool = makeLineOrArrowTool('line', false);
const arrowTool: Tool = makeLineOrArrowTool('arrow', true);

const curveTool: Tool = {
  id: 'curve',
  pointer(ctx, event) {
    lastShapeMods = { shift: event.mods.shift, alt: event.mods.alt };
    if (event.kind === 'down') {
      activeSnapGuides = [];
      return [{ kind: 'Begin', label: '绘制曲线', gestureMode: 'marquee' }];
    }
    if (event.kind === 'drag' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const { p1, p2, guides } = computeLineEndpoints(ctx, ctx.gesture.startPoint, event.point, {
        shift: false,
        alt: event.mods.alt,
      });
      activeSnapGuides = guides;
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 2) return [];
      const mode = event.mods.shift ? 'arc' : 's';
      const geometry = createCurveGeometry(p1.x, p1.y, p2.x, p2.y, mode);
      return [
        {
          kind: 'Preview',
          commandId: 'object.createPath',
          params: {
            geometry,
            appearance: LINE_DEFAULT_APPEARANCE,
            hint: 'path',
            name: '曲线',
          },
        },
      ];
    }
    if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const { p1, p2 } = computeLineEndpoints(ctx, ctx.gesture.startPoint, event.point, {
        shift: false,
        alt: event.mods.alt,
      });
      activeSnapGuides = [];
      lastShapeMods = { shift: false, alt: false };
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 2) {
        return [{ kind: 'Cancel' }];
      }
      const mode = event.mods.shift ? 'arc' : 's';
      const geometry = createCurveGeometry(p1.x, p1.y, p2.x, p2.y, mode);
      return [
        {
          kind: 'Exec',
          commandId: 'object.createPath',
          params: {
            geometry,
            appearance: LINE_DEFAULT_APPEARANCE,
            hint: 'path',
            name: '曲线',
          },
        },
        { kind: 'Commit' },
        { kind: 'Exec', commandId: 'tool.setActive', params: { tool: 'select' } },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  overlay(ctx) {
    if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
    const zoom = Math.max(ctx.zoom, 1e-4);
    const lw = 1.5 / zoom;
    const { p1, p2, guides } = computeLineEndpoints(ctx, ctx.gesture.startPoint, ctx.gesture.currentPoint, {
      shift: false,
      alt: lastShapeMods.alt,
    });
    const mode = lastShapeMods.shift ? 'arc' : 's';
    const geom = createCurveGeometry(p1.x, p1.y, p2.x, p2.y, mode);
    const sp = geom.subPaths[0]!;
    const a0 = sp.anchors[0]!;
    const a1 = sp.anchors[1]!;
    const c1 = { x: a0.point.x + (a0.handleOut?.x ?? 0), y: a0.point.y + (a0.handleOut?.y ?? 0) };
    const c2 = { x: a1.point.x + (a1.handleIn?.x ?? 0), y: a1.point.y + (a1.handleIn?.y ?? 0) };
    const samplePts: Vec2[] = [];
    const STEPS = 16;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      samplePts.push({
        x: mt2 * mt * a0.point.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t2 * t * a1.point.x,
        y: mt2 * mt * a0.point.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t2 * t * a1.point.y,
      });
    }
    const overlays: OverlayElement[] = [
      {
        kind: 'polyline',
        points: samplePts,
        stroke: 'var(--ov-accent, #6366f1)',
        lineWidth: lw,
        dashed: true,
      },
      {
        kind: 'circle',
        center: p1,
        radius: 4.5 / zoom,
        stroke: 'var(--ov-accent, #6366f1)',
        fill: '#ffffff',
        lineWidth: lw,
      },
      {
        kind: 'circle',
        center: p2,
        radius: 4.5 / zoom,
        stroke: '#ffffff',
        fill: 'var(--ov-accent, #6366f1)',
        lineWidth: lw,
      },
    ];
    for (const guide of guides) {
      if (guide.orientation === 'vertical') {
        overlays.push({
          kind: 'line',
          from: { x: guide.position, y: guide.from },
          to: { x: guide.position, y: guide.to },
          stroke: '#ec4899',
          lineWidth: 1 / zoom,
          dashed: true,
        });
      } else {
        overlays.push({
          kind: 'line',
          from: { x: guide.from, y: guide.position },
          to: { x: guide.to, y: guide.position },
          stroke: '#ec4899',
          lineWidth: 1 / zoom,
          dashed: true,
        });
      }
    }
    return overlays;
  },
  cursor() { return 'crosshair'; },
};

const textTool: Tool = {
  id: 'text',
  pointer(_ctx, event) {
    if (event.kind === 'down') {
      return [
        {
          kind: 'Exec',
          commandId: 'object.createText',
          params: { x: Math.round(event.point.x), y: Math.round(event.point.y), text: '文本' },
        },
        { kind: 'Exec', commandId: 'tool.setActive', params: { tool: 'select' } },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  cursor() { return 'text'; },
};

// ============================================================================
// Hit testing（递归 + transform 链反变换；点在局部包围盒内或锚点近旁即命中）
// ============================================================================

function invertTransformPoint(t: AffineTransform, p: Vec2): Vec2 | null {
  const det = t.a * t.d - t.b * t.c;
  if (Math.abs(det) < 1e-12) return null;
  const dx = p.x - t.e;
  const dy = p.y - t.f;
  return { x: (t.d * dx - t.c * dy) / det, y: (-t.b * dx + t.a * dy) / det };
}

function pointNear(p: Vec2, q: Vec2, tol2: number): boolean {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return dx * dx + dy * dy < tol2;
}

function distanceSqToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return px * px + py * py;
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + t * dx;
  const qy = a.y + t * dy;
  const rx = p.x - qx;
  const ry = p.y - qy;
  return rx * rx + ry * ry;
}

function distanceSqToBezier(p: Vec2, p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): number {
  let minD2 = Infinity;
  let prev = p0;
  const STEPS = 8;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const cur = {
      x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
      y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
    };
    const d2 = distanceSqToSegment(p, prev, cur);
    if (d2 < minD2) minD2 = d2;
    prev = cur;
  }
  return minD2;
}

function pointInPolygon(p: Vec2, poly: ReadonlyArray<Vec2>): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 精准判断点是否在图元轮廓或实体内部（避免仅凭外接包围盒误伤空心图形）。 */
function hitNodeLocal(n: Node, doc: Document, local: Vec2, tol2: number): boolean {
  const bb = localNodeBBox(n, doc);
  if (!bb) return false;

  const tol = Math.sqrt(tol2);
  const strokeItem = n.kind === 'Path' ? n.appearance.items.find((it) => it.kind === 'stroke') : undefined;
  const strokeWidth = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.width : 0;
  const maxTol = Math.max(tol, strokeWidth / 2 + tol);

  // 快速短路：不在包围盒容差范围内直接排除
  if (
    local.x < bb.x - maxTol ||
    local.x > bb.x + bb.width + maxTol ||
    local.y < bb.y - maxTol ||
    local.y > bb.y + bb.height + maxTol
  ) {
    return false;
  }

  if (n.kind !== 'Path') {
    // Text / Image / Use：实心块，点在局部包围盒内即命中
    return (
      local.x >= bb.x &&
      local.x <= bb.x + bb.width &&
      local.y >= bb.y &&
      local.y <= bb.y + bb.height
    );
  }

  // 针对 PathNode 进行真实描边与填充判定
  const fillItem = n.appearance.items.find((it) => it.kind === 'fill');
  const hasStyledClass = Boolean((n as any).className);
  const hasFill = fillItem
    ? fillItem.fill.type !== 'none' && (fillItem.fill.type !== 'solid' || fillItem.fill.opacity > 0)
    : (hasStyledClass || n.appearance.items.length === 0);

  // 既无填充又无描边且无样式类：不可见，不响应命中
  if (!hasFill && strokeWidth === 0 && !hasStyledClass) return false;

  const strokeTol = maxTol;
  const strokeTol2 = strokeTol * strokeTol;

  // 1. 优先检查描边距离（无论是纯描边还是带填充的路径，描边边缘均可命中）
  for (const sp of n.geometry.subPaths) {
    const anchors = sp.anchors;
    if (anchors.length === 0) continue;

    // 单点或极短路径
    for (const a of anchors) {
      if (pointNear(a.point, local, strokeTol2)) return true;
    }

    const count = sp.closed ? anchors.length : anchors.length - 1;
    for (let i = 0; i < count; i++) {
      const a = anchors[i]!;
      const b = anchors[(i + 1) % anchors.length]!;
      const hasCurves = a.handleOut != null || b.handleIn != null;
      if (hasCurves) {
        const c1 = a.handleOut ? { x: a.point.x + a.handleOut.x, y: a.point.y + a.handleOut.y } : a.point;
        const c2 = b.handleIn ? { x: b.point.x + b.handleIn.x, y: b.point.y + b.handleIn.y } : b.point;
        const d2 = distanceSqToBezier(local, a.point, c1, c2, b.point);
        if (d2 <= strokeTol2) return true;
      } else {
        const d2 = distanceSqToSegment(local, a.point, b.point);
        if (d2 <= strokeTol2) return true;
      }
    }
  }

  // 2. 若带有填充或类样式，检查点是否落在封闭多边形内部
  if (hasFill || hasStyledClass) {
    for (const sp of n.geometry.subPaths) {
      if (sp.anchors.length < 3) continue;
      // 离散化多边形采样
      const poly: Vec2[] = [];
      const count = sp.anchors.length;
      for (let i = 0; i < count; i++) {
        const a = sp.anchors[i]!;
        const b = sp.anchors[(i + 1) % count]!;
        poly.push(a.point);
        if (a.handleOut != null || b.handleIn != null) {
          const STEPS = 4;
          const p0 = a.point;
          const p1 = a.handleOut ? { x: a.point.x + a.handleOut.x, y: a.point.y + a.handleOut.y } : a.point;
          const p2 = b.handleIn ? { x: b.point.x + b.handleIn.x, y: b.point.y + b.handleIn.y } : b.point;
          const p3 = b.point;
          for (let s = 1; s < STEPS; s++) {
            const t = s / STEPS;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const t2 = t * t;
            poly.push({
              x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
              y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
            });
          }
        }
      }
      if (pointInPolygon(local, poly)) return true;
    }

    // 若路径未提供锚点离散数据但点落在包围盒内且具有填充
    if (
      n.geometry.subPaths.length === 0 ||
      n.geometry.subPaths.every((sp) => sp.anchors.length === 0)
    ) {
      if (
        local.x >= bb.x &&
        local.x <= bb.x + bb.width &&
        local.y >= bb.y &&
        local.y <= bb.y + bb.height
      ) {
        return true;
      }
    }
  }

  return false;
}

function collectHitsInChildren(
  doc: Document,
  children: ReadonlyArray<NodeId>,
  parentT: AffineTransform,
  point: Vec2,
  tol2: number,
  deepSelect: boolean,
  out: NodeId[],
): void {
  for (let i = children.length - 1; i >= 0; i--) {
    const id = children[i]!;
    const n = doc.nodes.get(id);
    if (!n || !n.visible || n.locked) continue;
    const world = composeTransforms(parentT, n.transform);
    if (n.kind === 'Group') {
      if (deepSelect) {
        collectHitsInChildren(doc, n.children, world, point, tol2, true, out);
      } else {
        const temp: NodeId[] = [];
        collectHitsInChildren(doc, n.children, world, point, tol2, true, temp);
        if (temp.length > 0) {
          out.push(id);
        }
      }
      continue;
    }
    if (n.kind === 'Layer') continue;
    const local = invertTransformPoint(world, point);
    if (!local) continue;
    if (hitNodeLocal(n, doc, local, tol2)) {
      out.push(id);
    }
  }
}

/** 获取光标坐标下的所有候选命中文档节点（从最上层至最下层）。 */
export function hitTestAllAtPoint(
  doc: Document,
  point: Vec2,
  tolerance = 4,
  deepSelect = false,
): NodeId[] {
  const tol2 = Math.max(tolerance, 1e-6) ** 2;
  const out: NodeId[] = [];
  for (let li = doc.layers.length - 1; li >= 0; li--) {
    const layerId = doc.layers[li]!;
    const layer = doc.nodes.get(layerId);
    if (!layer || layer.kind !== 'Layer' || !layer.visible || layer.locked) continue;
    collectHitsInChildren(doc, layer.children, layer.transform, point, tol2, deepSelect, out);
  }
  return Array.from(new Set(out));
}

/** 自顶向下命中测试：返回最上层命中节点。 */
export function hitTestTopmost(
  doc: Document,
  point: Vec2,
  tolerance: number,
  deepSelect = false,
): NodeId | null {
  const hits = hitTestAllAtPoint(doc, point, tolerance, deepSelect);
  return hits[0] ?? null;
}

// ============================================================================
// Registry
// ============================================================================

export const tools: Record<ToolId, Tool> = {
  select: selectTool,
  node: nodeTool,
  pen: penTool,
  rect: rectTool,
  polygon: polygonTool,
  ellipse: ellipseTool,
  line: lineTool,
  curve: curveTool,
  arrow: arrowTool,
  text: textTool,
};

export function getTool(id: ToolId): Tool {
  return tools[id];
}
