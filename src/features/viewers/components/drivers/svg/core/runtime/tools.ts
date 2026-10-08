/**
 * OmniView SVG 编辑引擎 v2 — Tool 集合 (M3)
 *
 * P1 三件套：select / node / pen。
 * - select：点击选中、框选、Shift 加选
 * - node：直接选区（v1 已有 8 向拖拽 + 节点编辑体验）
 * - pen：钢笔（单点 fallback；P2 阶段实现完整锚点拖拽）
 */

import type { Tool, ToolId, OverlayElement } from './types';
import type { Action } from './types';
import type { NodeId, PointerEvent, ToolContext, ToolKey } from '../model/types';

// ============================================================================
// Select Tool
// ============================================================================

const selectTool: Tool = {
  id: 'select',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      const hit = hitTestTopmost(ctx.doc, event.point);
      if (hit == null) {
        // 开始框选
        if (!event.mods.shift && !event.mods.meta && !event.mods.ctrl) {
          return [
            { kind: 'Exec', commandId: 'select.clear', params: {} },
          ];
        }
        return [];
      }
      const isAdditive = event.mods.shift || event.mods.meta || event.mods.ctrl;
      return [
        { kind: 'Exec', commandId: 'select.set', params: { ids: [hit], additive: isAdditive } },
      ];
    }
    return [];
  },
  key(ctx, key, mods) {
    if (key === 'Delete' || key === 'Backspace') {
      if (ctx.selection.nodeIds.length === 0) return [];
      return [{ kind: 'Exec', commandId: 'object.delete', params: { ids: [...ctx.selection.nodeIds] } }];
    }
    if (key === 'Escape') {
      return [{ kind: 'Exec', commandId: 'select.clear', params: {} }];
    }
    return [];
  },
  cursor() { return 'default'; },
};

// ============================================================================
// Node Tool（直接选区）
// ============================================================================

const nodeTool: Tool = {
  id: 'node',
  pointer(ctx, event) {
    if (event.kind === 'down') {
      const hit = hitTestTopmost(ctx.doc, event.point);
      if (hit == null) return [];
      const isAdditive = event.mods.shift || event.mods.meta || event.mods.ctrl;
      return [
        { kind: 'Exec', commandId: 'select.set', params: { ids: [hit], additive: isAdditive } },
      ];
    }
    return [];
  },
  key(ctx, key, mods) {
    if (key === 'Delete' || key === 'Backspace') {
      if (ctx.selection.nodeIds.length === 0) return [];
      return [{ kind: 'Exec', commandId: 'object.delete', params: { ids: [...ctx.selection.nodeIds] } }];
    }
    return [];
  },
  cursor() { return 'default'; },
};

// ============================================================================
// Pen Tool（钢笔 — P1 占位）
// ============================================================================

const penTool: Tool = {
  id: 'pen',
  pointer(ctx, event) {
    // P1 占位：单击在第一个 path 上加入 L 点（M2 阶段实现完整锚点拖拽）
    return [];
  },
  key() {
    return [];
  },
  cursor() { return 'crosshair'; },
};

// ============================================================================
// Hit testing（简化版：基于 anchor point）
// ============================================================================

function hitTestTopmost(doc: { layers: ReadonlyArray<NodeId>; nodes: ReadonlyMap<NodeId, any> }, point: { x: number; y: number }): NodeId | null {
  // 反向遍历 layers（顶层在前）
  for (let li = doc.layers.length; li-- > 0;) {
    const layerId = doc.layers[li];
    const layer = doc.nodes.get(layerId);
    if (!layer || !layer.visible) continue;
    const stack = [...layer.children];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const n = doc.nodes.get(cur);
      if (!n || !n.visible) continue;
      if (n.kind === 'Group') {
        stack.push(...(n.children || []));
        continue;
      }
      if (n.kind === 'Path' && n.geometry && n.geometry.subPaths) {
        for (const sp of n.geometry.subPaths) {
          for (const a of sp.anchors) {
            const dx = a.point.x - point.x;
            const dy = a.point.y - point.y;
            if (dx * dx + dy * dy < 25) return cur;
          }
        }
      }
    }
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