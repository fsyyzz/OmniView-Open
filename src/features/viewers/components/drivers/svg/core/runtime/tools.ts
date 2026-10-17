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
import { localNodeBBox, nodeBBox, unionRects } from '../model/bbox';
import {
  createRectGeometry,
  createEllipseGeometry,
  createLineGeometry,
} from '../model/path';
import { findOutermostGroup } from '../model/tree';

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

let activeTransformState: TransformHandleState | null = null;
let activeSnapGuides: SnapGuideLine[] = [];

function getSelectionBBox(doc: Document, ids: ReadonlyArray<NodeId>): { x: number; y: number; width: number; height: number } | null {
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const id of ids) {
    const b = nodeBBox(doc, id);
    if (b) boxes.push(b);
  }
  return unionRects(boxes);
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
  cursor() {
    if (activeTransformState) {
      if (activeTransformState.kind === 'rotate') return 'grabbing';
      const k = activeTransformState.handleKey;
      if (k === 'nw' || k === 'se') return 'nwse-resize';
      if (k === 'ne' || k === 'sw') return 'nesw-resize';
      if (k === 'n' || k === 's') return 'ns-resize';
      if (k === 'e' || k === 'w') return 'ew-resize';
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

/** 点击选中 / 拖拽移动 / 空白框选 / 8 向变形缩放与旋转的手势动作序列。 */
function handleSelectPointer(ctx: ToolContext, event: PointerEvent): ReadonlyArray<Action> {
  if (event.kind === 'down') {
    if (ctx.selection.nodeIds.length > 0) {
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

    const deepSelect = Boolean(event.mods.meta || event.mods.ctrl);
    const tol = 5 / Math.max(ctx.zoom, 1e-4);
    const hits = hitTestAllAtPoint(ctx.doc, event.point, tol, deepSelect);

    const now = Date.now();
    let targetHit: NodeId | null = null;

    if (hits.length > 0) {
      const isSamePoint =
        lastClickCycleState &&
        Math.hypot(lastClickCycleState.point.x - event.point.x, lastClickCycleState.point.y - event.point.y) < tol &&
        now - lastClickCycleState.time < 1200;

      if (isSamePoint && lastClickCycleState && lastClickCycleState.hits.length > 1) {
        // 重复点击同一位置：循环切换选中下一层重叠图元
        const nextIdx = (lastClickCycleState.index + 1) % lastClickCycleState.hits.length;
        targetHit = lastClickCycleState.hits[nextIdx] ?? hits[0]!;
        lastClickCycleState = { point: event.point, time: now, hits: lastClickCycleState.hits, index: nextIdx };
      } else if (event.mods.alt && hits.length > 1) {
        // 按住 Alt 点击：穿透选第二层重叠图元
        targetHit = hits[1] ?? hits[0]!;
        lastClickCycleState = { point: event.point, time: now, hits, index: 1 };
      } else {
        // 默认顶层（未按 Cmd/Ctrl 时若属于编组则返回其最外层编组）
        const rawHit = hits[0]!;
        targetHit = deepSelect ? rawHit : findOutermostGroup(ctx.doc, rawHit);
        lastClickCycleState = { point: event.point, time: now, hits, index: 0 };
      }
    } else {
      lastClickCycleState = null;
    }

    const additive = event.mods.shift;

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
        // Shift 点击已选图元 -> 反选剔除（不触发拖拽）
        return [{ kind: 'Exec', commandId: 'select.set', params: { ids: [targetHit], additive: true, toggle: true } }];
      } else {
        // Shift 点击未选图元 -> 追加至选区并允许继续拖拽
        return [
          { kind: 'Exec', commandId: 'select.set', params: { ids: [targetHit], additive: true } },
          { kind: 'Begin', label: '移动', gestureMode: 'move' },
        ];
      }
    } else {
      // 普通点击
      if (inSelection && ctx.selection.nodeIds.length > 1) {
        // 已有多选态且光标落在其中一个图元上：保持当前整体选区，直接开始移动
        return [{ kind: 'Begin', label: '移动', gestureMode: 'move' }];
      }
      return [
        { kind: 'Exec', commandId: 'select.set', params: { ids: [targetHit], additive: false } },
        { kind: 'Begin', label: '移动', gestureMode: 'move' },
      ];
    }
  }

  if (event.kind === 'move' || event.kind === 'drag') {
    if (activeTransformState) {
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
          fx = Math.sign(fx) * f;
          fy = Math.sign(fy) * f;
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
              const ob = nodeBBox(ctx.doc, otherId);
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
      const additive = event.mods.shift;
      // 从左向右拉框：enclosed（完全包含）；从右向左拉框或按 Alt：intersect（触碰相交）
      const mode = (event.mods.alt || event.point.x < g.startPoint.x) ? 'intersect' : 'enclosed';
      return [{ kind: 'Preview', commandId: 'select.box', params: { rect, additive, mode } }];
    }
  }

  if (event.kind === 'up' || event.kind === 'cancel') {
    activeSnapGuides = [];
    if (activeTransformState) {
      activeTransformState = null;
      return [{ kind: 'Commit' }];
    }
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
    const stroke = isIntersectMode ? 'var(--ov-success, #10b981)' : 'var(--ov-accent, #4c9aff)';
    const fill = isIntersectMode ? 'rgba(16, 185, 129, 0.12)' : 'var(--ov-accent-soft, rgba(76,154,255,0.12))';
    return [
      {
        kind: 'rect',
        rect,
        stroke,
        fill,
        lineWidth: 1 / Math.max(ctx.zoom, 1e-6),
        dashed: true,
      },
    ];
  }
  return [];
}

/** 选区与手势的虚线矩形及 8 向变形手柄 overlay。 */
function selectOverlay(ctx: ToolContext): ReadonlyArray<OverlayElement> {
  const g = ctx.gesture;
  if (g && g.kind === 'marquee') {
    return marqueeOverlay(ctx);
  }

  if (ctx.selection.nodeIds.length > 0) {
    const selBBox = getSelectionBBox(ctx.doc, ctx.selection.nodeIds);
    if (!selBBox) return [];
    const overlays: OverlayElement[] = [];
    const zoom = Math.max(ctx.zoom, 1e-4);
    const lw = 1 / zoom;
    const hSize = 7 / zoom;

    // 1. 若多选，为每个被选中的独立图元绘制轻量的单像素虚线轮廓
    if (ctx.selection.nodeIds.length > 1) {
      for (const id of ctx.selection.nodeIds) {
        const subBb = nodeBBox(ctx.doc, id);
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
  const local = invertTransformPoint(node.transform, point);
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
        const local = invertTransformPoint(node.transform, event.point);
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
      for (let spIdx = 0; spIdx < node.geometry.subPaths.length; spIdx++) {
        const sp = node.geometry.subPaths[spIdx]!;
        for (let aIdx = 0; aIdx < sp.anchors.length; aIdx++) {
          const a = sp.anchors[aIdx]!;
          const world = applyTransformToPoint(node.transform, a.point);
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
// Rect / Ellipse / Line / Text 形状工具
// ============================================================================

const rectTool: Tool = {
  id: 'rect',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      return [{ kind: 'Begin', label: '绘制矩形', gestureMode: 'marquee' }];
    }
    if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      let r = normalizeRect(ctx.gesture.startPoint, event.point);
      if (r.width < 4 && r.height < 4) {
        r = { x: ctx.gesture.startPoint.x - 50, y: ctx.gesture.startPoint.y - 30, width: 100, height: 60 };
      }
      const geometry = createRectGeometry(r.x, r.y, r.width, r.height);
      const appearance: Appearance = {
        items: [
          { kind: 'fill', fill: { type: 'solid', color: '#3b82f6' as Color, opacity: 1 }, blend: 'normal', opacity: 1 },
          { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: '#1d4ed8' as Color, opacity: 1 }, width: 2 }, blend: 'normal', opacity: 1 },
        ],
      };
      return [
        { kind: 'Exec', commandId: 'object.createPath', params: { geometry, appearance, hint: 'rect' } },
        { kind: 'Commit' },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  overlay(ctx) {
    if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
    return [{
      kind: 'rect',
      rect: normalizeRect(ctx.gesture.startPoint, ctx.gesture.currentPoint),
      stroke: 'var(--ov-accent, #3b82f6)',
      fill: 'rgba(59, 130, 246, 0.15)',
      lineWidth: 1.5,
      dashed: true,
    }];
  },
  cursor() { return 'crosshair'; },
};

const ellipseTool: Tool = {
  id: 'ellipse',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      return [{ kind: 'Begin', label: '绘制椭圆', gestureMode: 'marquee' }];
    }
    if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      let r = normalizeRect(ctx.gesture.startPoint, event.point);
      if (r.width < 4 && r.height < 4) {
        r = { x: ctx.gesture.startPoint.x - 40, y: ctx.gesture.startPoint.y - 40, width: 80, height: 80 };
      }
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const rx = Math.max(r.width / 2, 2);
      const ry = Math.max(r.height / 2, 2);
      const geometry = createEllipseGeometry(cx, cy, rx, ry);
      const appearance: Appearance = {
        items: [
          { kind: 'fill', fill: { type: 'solid', color: '#10b981' as Color, opacity: 1 }, blend: 'normal', opacity: 1 },
          { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: '#047857' as Color, opacity: 1 }, width: 2 }, blend: 'normal', opacity: 1 },
        ],
      };
      return [
        { kind: 'Exec', commandId: 'object.createPath', params: { geometry, appearance, hint: 'ellipse' } },
        { kind: 'Commit' },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  overlay(ctx) {
    if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
    return [{
      kind: 'rect',
      rect: normalizeRect(ctx.gesture.startPoint, ctx.gesture.currentPoint),
      stroke: 'var(--ov-accent, #10b981)',
      fill: 'rgba(16, 185, 129, 0.15)',
      lineWidth: 1.5,
      dashed: true,
    }];
  },
  cursor() { return 'crosshair'; },
};

const lineTool: Tool = {
  id: 'line',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      return [{ kind: 'Begin', label: '绘制直线', gestureMode: 'marquee' }];
    }
    if (event.kind === 'up' && ctx.gesture && ctx.gesture.kind === 'marquee') {
      const p1 = ctx.gesture.startPoint;
      let p2 = event.point;
      if (Math.abs(p2.x - p1.x) < 4 && Math.abs(p2.y - p1.y) < 4) {
        p2 = { x: p1.x + 80, y: p1.y + 40 };
      }
      const geometry = createLineGeometry(p1.x, p1.y, p2.x, p2.y);
      const appearance: Appearance = {
        items: [
          { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: '#6366f1' as Color, opacity: 1 }, width: 2 }, blend: 'normal', opacity: 1 },
        ],
      };
      return [
        { kind: 'Exec', commandId: 'object.createPath', params: { geometry, appearance, hint: 'line' } },
        { kind: 'Commit' },
      ];
    }
    return [];
  },
  key(ctx, key, mods) { return handleCommonKeys(ctx, key, mods); },
  overlay(ctx) {
    if (!ctx.gesture || ctx.gesture.kind !== 'marquee') return [];
    return [{
      kind: 'line',
      from: ctx.gesture.startPoint,
      to: ctx.gesture.currentPoint,
      stroke: 'var(--ov-accent, #6366f1)',
      lineWidth: 2,
      dashed: true,
    }];
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
  // 快速短路：不在包围盒容差范围内直接排除
  if (
    local.x < bb.x - tol ||
    local.x > bb.x + bb.width + tol ||
    local.y < bb.y - tol ||
    local.y > bb.y + bb.height + tol
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
  const hasFill = n.appearance.items.some((it) => {
    if (it.kind !== 'fill') return false;
    const f = it.fill;
    if (f.type === 'none') return false;
    if (f.type === 'solid' && f.opacity <= 0) return false;
    return true;
  });
  const strokeItem = n.appearance.items.find((it) => {
    if (it.kind !== 'stroke') return false;
    const s = it.stroke;
    if (s.width <= 0) return false;
    if (s.paint.type === 'none') return false;
    if (s.paint.type === 'solid' && s.paint.opacity <= 0) return false;
    return true;
  });
  const strokeWidth = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.width : 0;

  // 既无填充又无描边：不可见，不响应命中
  if (!hasFill && strokeWidth === 0) return false;

  const strokeTol = Math.max(tol, strokeWidth / 2 + tol);
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
        const d2 = distanceSqToBezier(local, a.point, a.handleOut ?? a.point, b.handleIn ?? b.point, b.point);
        if (d2 <= strokeTol2) return true;
      } else {
        const d2 = distanceSqToSegment(local, a.point, b.point);
        if (d2 <= strokeTol2) return true;
      }
    }
  }

  // 2. 若带有填充，检查点是否落在封闭多边形内部
  if (hasFill) {
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
          for (let s = 1; s < STEPS; s++) {
            const t = s / STEPS;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const t2 = t * t;
            const p0 = a.point;
            const p1 = a.handleOut ?? a.point;
            const p2 = b.handleIn ?? b.point;
            const p3 = b.point;
            poly.push({
              x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
              y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
            });
          }
        }
      }
      if (pointInPolygon(local, poly)) return true;
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
  ellipse: ellipseTool,
  line: lineTool,
  text: textTool,
};

export function getTool(id: ToolId): Tool {
  return tools[id];
}
