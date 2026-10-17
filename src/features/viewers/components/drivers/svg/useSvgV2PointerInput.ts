/**
 * OmniView SVG v2 — 画布指针/键盘输入 Hook (P0 交互接通)
 *
 * 把原生 pointer 事件映射为 v2 Runtime 的 `PointerEvent`：
 * - `down`  → `dispatchPointer({kind:'down'})`（先 `setPointerCapture`，保证拖出画布仍收 drag/up）
 * - 按键拖动 → `drag`；无按键移动 → `move`
 * - `up` / `cancel` → 对应 kind（cancel 让 Runtime 恢复手势快照）
 *
 * 坐标反变换优先用 `getScreenCTM().inverse()`（精确覆盖 preserveAspectRatio
 * letterbox / 缩放），不可用时回退到纯函数 `clientToCanvasPoint`。
 *
 * 键盘：修饰键撤销/重做/全选交给 Runtime/History；工具键映射 `ToolKey` 下发。
 * 输入控件（input/textarea/select/contentEditable）内不拦截。
 */
import React, { useCallback, useRef } from 'react';
import {
  clientToCanvasPoint,
  findParent,
  hitTestAllAtPoint,
  type NodeId,
  type PointerEvent as SvgPointerEvent,
  type Runtime,
  type ToolKey,
  type ViewBoxLike,
} from './core';

const TOOL_KEY_MAP: Readonly<Record<string, ToolKey>> = {
  Enter: 'Enter',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
};

interface Options {
  readonly runtime: Runtime;
  readonly view: ViewBoxLike;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly selectAll: () => void;
}

export interface SvgV2PointerHandlers {
  readonly svgRef: React.RefObject<SVGSVGElement | null>;
  readonly handlePointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  readonly handlePointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  readonly handlePointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  readonly handlePointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
  readonly handleDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  readonly handleKeyDown: (e: React.KeyboardEvent<SVGSVGElement>) => void;
}

function modsOf(e: React.PointerEvent | React.KeyboardEvent): SvgPointerEvent['mods'] {
  return { shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, ctrl: e.ctrlKey, space: false };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useSvgV2PointerInput({ runtime, view, undo, redo, selectAll }: Options): SvgV2PointerHandlers {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const toCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      if (typeof svg.getScreenCTM === 'function') {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          try {
            const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
            if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) return { x: pt.x, y: pt.y };
          } catch {
            /* fall through to rect math */
          }
        }
      }
      const rect = svg.getBoundingClientRect();
      return clientToCanvasPoint(clientX, clientY, rect, view);
    },
    [view],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 || e.altKey) return; // Alt+左键为画布平移手势，不进入工具管线
      const point = toCanvas(e.clientX, e.clientY);
      if (!point) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable */
      }
      runtime.dispatchPointer({ kind: 'down', point, mods: modsOf(e), pressure: e.pressure || 1 });
    },
    [runtime, toCanvas],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const point = toCanvas(e.clientX, e.clientY);
      if (!point) return;
      const dragging = (e.buttons & 1) === 1;
      runtime.dispatchPointer({
        kind: dragging ? 'drag' : 'move',
        point,
        mods: modsOf(e),
        pressure: e.pressure || 1,
      });
    },
    [runtime, toCanvas],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const point = toCanvas(e.clientX, e.clientY);
      if (!point) return;
      runtime.dispatchPointer({ kind: 'up', point, mods: modsOf(e), pressure: e.pressure || 1 });
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [runtime, toCanvas],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const point = toCanvas(e.clientX, e.clientY) ?? { x: 0, y: 0 };
      runtime.dispatchPointer({ kind: 'cancel', point, mods: modsOf(e), pressure: 0 });
    },
    [runtime, toCanvas],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const point = toCanvas(e.clientX, e.clientY);
      if (!point) return;
      const doc = runtime.currentDocument;
      const sel = runtime.currentSelection;
      const allHits = hitTestAllAtPoint(doc, point);
      if (allHits.length === 0) return;

      // 双击穿透选择 (Deep Select / Drill-down)：
      // 若当前已选中某编组，双击该编组则下钻一层：选中光标所指的最直接子图元
      const selectedGroup = sel.nodeIds.find((id) => doc.nodes.get(id)?.kind === 'Group');
      if (selectedGroup) {
        const directChildHit = allHits.find((hId) => {
          let cur: NodeId | null = hId;
          while (cur) {
            const p = findParent(doc, cur);
            if (p === selectedGroup) return true;
            cur = p;
          }
          return false;
        });

        if (directChildHit) {
          e.preventDefault();
          e.stopPropagation();
          let targetChild: NodeId = directChildHit;
          let cur: NodeId | null = directChildHit;
          while (cur) {
            const p = findParent(doc, cur);
            if (p === selectedGroup) {
              targetChild = cur;
              break;
            }
            cur = p;
          }
          runtime.execute('select.set', { ids: [targetChild], additive: false });
          return;
        }
      }

      // 未选编组时双击：直接深度下钻选中光标底部具体的叶子图元
      const leafHit = allHits[0];
      if (leafHit) {
        runtime.execute('select.set', { ids: [leafHit], additive: false });
      }
    },
    [runtime, toCanvas],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      // Cmd+D: 快速复制
      if (mod && key === 'd') {
        e.preventDefault();
        runtime.execute('object.duplicate', {});
        return;
      }
      // Cmd+G / Cmd+Shift+G: 编组 / 解组
      if (mod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          for (const id of runtime.currentSelection.nodeIds) {
            if (runtime.currentDocument.nodes.get(id)?.kind === 'Group') {
              runtime.execute('object.ungroup', { id });
            }
          }
        } else {
          if (runtime.currentSelection.nodeIds.length >= 2) {
            runtime.execute('object.group', { ids: [...runtime.currentSelection.nodeIds] });
          }
        }
        return;
      }
      // Cmd+] / Cmd+Shift+]: 上移一层 / 置于顶层
      if (mod && (e.key === ']' || e.key === '}')) {
        e.preventDefault();
        const dir = e.shiftKey ? 'front' : 'forward';
        for (const id of runtime.currentSelection.nodeIds) {
          runtime.execute('object.reorder', { id, direction: dir });
        }
        return;
      }
      // Cmd+[ / Cmd+Shift+[: 下移一层 / 置于底层
      if (mod && (e.key === '[' || e.key === '{')) {
        e.preventDefault();
        const dir = e.shiftKey ? 'back' : 'backward';
        for (const id of runtime.currentSelection.nodeIds) {
          runtime.execute('object.reorder', { id, direction: dir });
        }
        return;
      }

      const toolKey = TOOL_KEY_MAP[e.key];
      if (!toolKey) return;
      e.preventDefault();
      runtime.dispatchKey(toolKey, modsOf(e));
    },
    [runtime, undo, redo, selectAll],
  );

  return { svgRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleDoubleClick, handleKeyDown };
}
