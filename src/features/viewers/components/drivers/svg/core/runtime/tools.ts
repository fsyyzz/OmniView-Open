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
import type { Document, Node, NodeId, PointerEvent, ToolContext, ToolKey, Vec2, AffineTransform } from '../model/types';
import { composeTransforms } from '../model/document';
import { localNodeBBox } from '../model/bbox';

// ============================================================================
// Select Tool
// ============================================================================

const selectTool: Tool = {
  id: 'select',
  pointer(ctx, event) {
    return handleSelectPointer(ctx, event);
  },
  key(ctx, key, mods) {
    return handleCommonKeys(ctx, key, mods);
  },
  overlay(ctx) {
    return marqueeOverlay(ctx);
  },
  cursor() { return 'default'; },
};

/** 点击选中 / 拖拽移动 / 空白框选的手势动作序列（select 与 node 共用）。 */
function handleSelectPointer(ctx: ToolContext, event: PointerEvent): ReadonlyArray<Action> {
  if (event.kind === 'down') {
    const hit = hitTestTopmost(ctx.doc, event.point, 5 * Math.max(ctx.zoom, 1e-6));
    const additive = event.mods.shift || event.mods.meta || event.mods.ctrl;
    if (hit == null) {
      const actions: Action[] = [];
      if (!additive) actions.push({ kind: 'Exec', commandId: 'select.clear', params: {} });
      actions.push({ kind: 'Begin', label: '框选', gestureMode: 'marquee' });
      return actions;
    }
    return [
      { kind: 'Exec', commandId: 'select.set', params: { ids: [hit], additive } },
      { kind: 'Begin', label: '移动', gestureMode: 'move' },
    ];
  }
  if (event.kind === 'drag' && ctx.gesture) {
    const g = ctx.gesture;
    if (g.kind === 'move') {
      if (g.ids.length === 0) return [];
      const delta = { x: event.point.x - g.startPoint.x, y: event.point.y - g.startPoint.y };
      if (delta.x === 0 && delta.y === 0) return [];
      return [{ kind: 'Preview', commandId: 'object.move', params: { ids: [...g.ids], delta } }];
    }
    const rect = normalizeRect(g.startPoint, event.point);
    const additive = event.mods.shift || event.mods.meta || event.mods.ctrl;
    return [{ kind: 'Preview', commandId: 'select.box', params: { rect, additive } }];
  }
  if (event.kind === 'up' && ctx.gesture) {
    return [{ kind: 'Commit' }];
  }
  return [];
}

/** 框选手势的虚线矩形 overlay。 */
function marqueeOverlay(ctx: ToolContext): ReadonlyArray<OverlayElement> {
  const g = ctx.gesture;
  if (!g || g.kind !== 'marquee') return [];
  const rect = normalizeRect(g.startPoint, g.currentPoint);
  return [
    {
      kind: 'rect',
      rect,
      stroke: 'var(--ov-accent, #4c9aff)',
      fill: 'var(--ov-accent-soft, rgba(76,154,255,0.12))',
      lineWidth: 1 / Math.max(ctx.zoom, 1e-6),
      dashed: true,
    },
  ];
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
// Node Tool（直接选区）
// ============================================================================

const nodeTool: Tool = {
  id: 'node',
  pointer(ctx, event) {
    return handleSelectPointer(ctx, event);
  },
  key(ctx, key, mods) {
    return handleCommonKeys(ctx, key, mods);
  },
  overlay(ctx) {
    return marqueeOverlay(ctx);
  },
  cursor() { return 'default'; },
};

// ============================================================================
// Pen Tool（钢笔 — P1 占位）
// ============================================================================

const penTool: Tool = {
  id: 'pen',
  pointer() {
    // P1 占位：单击在第一个 path 上加入 L 点（M2 阶段实现完整锚点拖拽）
    return [];
  },
  key() {
    return [];
  },
  cursor() { return 'crosshair'; },
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

function pointInRectLocal(p: Vec2, r: { x: number; y: number; width: number; height: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function hitNodeLocal(n: Node, doc: Document, local: Vec2, tol2: number): boolean {
  const bb = localNodeBBox(n, doc);
  if (!bb) return false;
  if (n.kind === 'Path') {
    // 锚点近旁（容差）或包围盒内（整段填充/描边区域的近似）均命中
    if (pointInRectLocal(local, bb)) return true;
    for (const sp of n.geometry.subPaths) {
      for (const a of sp.anchors) {
        if (pointNear(a.point, local, tol2)) return true;
      }
    }
    return false;
  }
  // Text / Image / Use：局部包围盒即命中区域
  return pointInRectLocal(local, bb);
}

function hitInChildren(
  doc: Document,
  children: ReadonlyArray<NodeId>,
  parentT: AffineTransform,
  point: Vec2,
  tol2: number,
): NodeId | null {
  for (let i = children.length - 1; i >= 0; i--) {
    const id = children[i]!;
    const n = doc.nodes.get(id);
    if (!n || !n.visible || n.locked) continue;
    const world = composeTransforms(parentT, n.transform);
    if (n.kind === 'Group') {
      const inner = hitInChildren(doc, n.children, world, point, tol2);
      if (inner) return inner;
      continue;
    }
    if (n.kind === 'Layer') continue;
    const local = invertTransformPoint(world, point);
    if (!local) continue;
    if (hitNodeLocal(n, doc, local, tol2)) return id;
  }
  return null;
}

/** 自顶向下命中测试：返回最上层命中节点（穿透 Group，坐标经 transform 链反变换）。 */
export function hitTestTopmost(doc: Document, point: Vec2, tolerance: number): NodeId | null {
  const tol2 = Math.max(tolerance, 1e-6) ** 2;
  for (let li = doc.layers.length - 1; li >= 0; li--) {
    const layerId = doc.layers[li]!;
    const layer = doc.nodes.get(layerId);
    if (!layer || layer.kind !== 'Layer' || !layer.visible || layer.locked) continue;
    const hit = hitInChildren(doc, layer.children, layer.transform, point, tol2);
    if (hit) return hit;
  }
  return null;
}

// ============================================================================
// Registry
// ============================================================================

const tools: Record<ToolId, Tool> = {
  select: selectTool,
  node: nodeTool,
  pen: penTool,
};

export function getTool(id: ToolId): Tool {
  return tools[id];
}
