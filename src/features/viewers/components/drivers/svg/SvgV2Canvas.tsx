/**
 * OmniView SVG v2 — 画布渲染组件 (P0 交互接通)
 *
 * 职责（大组件拆分：画布渲染 / 输入绑定 / 节点渲染独立）：
 * - 渲染文档节点（Path / Group / Text / Image / Use）+ `<defs>` 原始片段
 *   （渐变/图案引用不断链；DOMPurify 净化）
 * - 渲染 Tool overlay（框选虚线框）与选中包围盒
 * - 经 `useSvgV2PointerInput` 绑定原生 pointer/keyboard → Runtime
 *
 * UI 只经 `core` barrel 导入。
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ZoomIn, ZoomOut, Maximize2, Move, Scaling, Frame } from 'lucide-react';
import {
  RAW_DEFS_METADATA_KEY,
  clientToCanvasPoint,
  getSelectionBBox,
  hitTestAllAtPoint,
  nodeBBox,
  nodeWorldBBox,
  serializePathD,
  unionRects,
  type Document as SvgDocument,
  type Fill,
  type Node,
  type OverlayElement,
  type Runtime,
  type Selection,
  type ToolId,
  getTool,
  isTwoPointLineNode,
  isOpenPolylineNode,
} from './core';
import { useSvgV2PointerInput } from './useSvgV2PointerInput';
import { useSvgV2Viewport } from './useSvgV2Viewport';
import { SvgV2ContextMenu } from './SvgV2ContextMenu';
import { SvgV2FloatingHud } from './SvgV2FloatingHud';

export interface SvgV2CanvasProps {
  readonly document: SvgDocument;
  readonly selection: Selection;
  readonly runtime: Runtime;
  readonly activeToolId: ToolId;
}

/** `<defs>` 净化配置（支持完整 SVG 滤镜、渐变、marker、style 及内嵌图元白名单）。 */
const DEFS_SANITIZE = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: [
    'svg', 'defs', 'style', 'clipPath', 'linearGradient', 'radialGradient', 'stop',
    'filter', 'feDropShadow', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA',
    'feComposite', 'feFlood', 'feMorphology', 'feTurbulence', 'feDisplacementMap',
    'marker', 'pattern', 'mask', 'symbol', 'use',
    'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  ],
  ADD_ATTR: [
    'id', 'class', 'style', 'type',
    'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy', 'rx', 'ry', 'dx', 'dy',
    'points', 'd', 'viewBox', 'xmlns', 'xmlns:xlink', 'xlink:href', 'href', 'transform',
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'opacity',
    'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight',
    'font-style', 'text-anchor', 'letter-spacing', 'dominant-baseline', 'alignment-baseline',
    'width', 'height', 'preserveAspectRatio', 'clip-path', 'filter', 'mask',
    'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
    'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits',
    'maskUnits', 'maskContentUnits', 'filterUnits', 'primitiveUnits', 'markerUnits',
    'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'spreadMethod',
    'stdDeviation', 'flood-color', 'flood-opacity', 'in', 'in2', 'result', 'mode',
    'values', 'operator', 'k1', 'k2', 'k3', 'k4', 'scale', 'xChannelSelector', 'yChannelSelector',
    'baseFrequency', 'numOctaves', 'seed', 'stitchTiles', 'xlink:title',
  ],
};

/**
 * 在 `<svg><defs>...</defs></svg>` 命名空间上下文中净化 `<defs>` 片段。
 * 直接对裸 `<linearGradient>` / `<marker>` / `<filter>` 调 DOMPurify 会因 HTML5 解析器处于
 * HTML 命名空间而剥离驼峰 SVG 标签，导致渐变、阴影与箭头丢失。
 */
export function sanitizeDefsFragment(rawDefs: string): string {
  const trimmed = rawDefs.trim();
  if (!trimmed) return '';
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg"><defs id="__ov_defs_wrap__">${trimmed}</defs></svg>`;
  const clean = DOMPurify.sanitize(wrapped, DEFS_SANITIZE);
  const match = clean.match(/<defs[^>]*id=["']__ov_defs_wrap__["'][^>]*>([\s\S]*?)<\/defs>/i)
    ?? clean.match(/<defs[^>]*>([\s\S]*?)<\/defs>/i);
  return match ? match[1] ?? '' : '';
}

export const SvgV2Canvas: React.FC<SvgV2CanvasProps> = ({
  document: doc,
  selection,
  runtime,
  activeToolId,
}) => {
  const view = useMemo(() => {
    const vb = doc?.canvas?.viewBox;
    if (vb) {
      return {
        x: vb.x ?? 0,
        y: vb.y ?? 0,
        width: vb.width || doc?.canvas?.width || 800,
        height: vb.height || doc?.canvas?.height || 600,
      };
    }
    const width = doc?.canvas?.width || 800;
    const height = doc?.canvas?.height || 600;
    return {
      x: 0,
      y: 0,
      width,
      height,
    };
  }, [doc?.canvas?.viewBox, doc?.canvas?.width, doc?.canvas?.height]);

  const {
    svgRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleDoubleClick: handleNodeDoubleClick,
    handleKeyDown,
  } = useSvgV2PointerInput({
    runtime,
    view,
    undo: () => runtime.undo(),
    redo: () => runtime.redo(),
    selectAll: () => runtime.execute('select.all', {}),
  });

  const {
    viewport,
    containerRef,
    panning,
    handleWheel,
    handleDoubleClick,
    beginPan,
    movePan,
    endPan,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomFit,
  } = useSvgV2Viewport();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [canvasResizeMode, setCanvasResizeMode] = useState<'scale-content' | 'canvas-only'>('scale-content');
  const [resizingCanvas, setResizingCanvas] = useState(false);
  const canvasDragRef = useRef<{
    pointerId: number;
    handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    startClientX: number;
    startClientY: number;
    startW: number;
    startH: number;
    scale: number;
  } | null>(null);

  const handleCanvasResizeDown = useCallback(
    (handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w', e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable */
      }
      canvasDragRef.current = {
        pointerId: e.pointerId,
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startW: Math.max(16, view.width),
        startH: Math.max(16, view.height),
        scale: Math.max(viewport.scale, 0.05),
      };
      setResizingCanvas(true);
      runtime.handleActions([{ kind: 'Begin', label: '调整 SVG 图形尺寸' }]);
    },
    [view.width, view.height, viewport.scale, runtime],
  );

  const handleCanvasResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = canvasDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.stopPropagation();
      e.preventDefault();

      // 由于外层 flex items-center justify-center 会实时居中 SVG，屏幕位移与宽/高增量的关系为 1:1（除以 viewport.scale）
      const dx = (e.clientX - drag.startClientX) / drag.scale;
      const dy = (e.clientY - drag.startClientY) / drag.scale;

      let nextW = drag.startW;
      let nextH = drag.startH;
      let offsetX = 0;
      let offsetY = 0;

      const h = drag.handle;
      if (h.includes('e')) nextW = drag.startW + dx;
      if (h.includes('w')) {
        nextW = drag.startW - dx;
        offsetX = -dx;
      }
      if (h.includes('s')) nextH = drag.startH + dy;
      if (h.includes('n')) {
        nextH = drag.startH - dy;
        offsetY = -dy;
      }

      nextW = Math.max(32, nextW);
      nextH = Math.max(32, nextH);

      // 按住 Shift 或在「整体缩放」模式下拖拽四角时保持原始宽高比
      const isCorner = h === 'nw' || h === 'ne' || h === 'se' || h === 'sw';
      if (e.shiftKey || (canvasResizeMode === 'scale-content' && isCorner && !e.altKey)) {
        const aspect = drag.startW / Math.max(drag.startH, 1);
        if (Math.abs(dx) >= Math.abs(dy)) {
          nextH = Math.max(32, nextW / aspect);
        } else {
          nextW = Math.max(32, nextH * aspect);
        }
      }

      runtime.handleActions([
        {
          kind: 'Preview',
          commandId: 'canvas.setSize',
          params: {
            width: Math.round(nextW),
            height: Math.round(nextH),
            mode: canvasResizeMode,
            offsetContent:
              canvasResizeMode === 'canvas-only' && (Math.abs(offsetX) > 0.5 || Math.abs(offsetY) > 0.5)
                ? { x: Math.round(offsetX), y: Math.round(offsetY) }
                : undefined,
          },
        },
      ]);
    },
    [canvasResizeMode, runtime],
  );

  const handleCanvasResizeUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = canvasDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.stopPropagation();
      e.preventDefault();
      canvasDragRef.current = null;
      setResizingCanvas(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      runtime.handleActions([{ kind: 'Commit' }]);
    },
    [runtime],
  );

  const selBBox = useMemo(() => {
    return getSelectionBBox(doc, selection.nodeIds);
  }, [doc, selection.nodeIds]);

  const hudPosition = useMemo(() => {
    if (!selBBox || !svgRef.current || !containerRef.current) return null;
    const svgRect = svgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    if (svgRect.width === 0 || view.width === 0) return null;

    const scale = svgRect.width / view.width;
    const centerX = svgRect.left - containerRect.left + (selBBox.x - view.x + selBBox.width / 2) * scale;
    const topY = svgRect.top - containerRect.top + (selBBox.y - view.y) * scale - 44;
    const adjustedTop =
      topY < 20
        ? svgRect.top - containerRect.top + (selBBox.y - view.y + selBBox.height) * scale + 14
        : topY;

    return { left: centerX, top: adjustedTop };
  }, [selBBox, view, viewport]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const containerRect = containerRef.current?.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      const x = containerRect ? clientX - containerRect.left : clientX;
      const y = containerRect ? clientY - containerRect.top : clientY;

      // 如果右键点击处有未选中的图元，优先选中它
      if (svgRef.current) {
        let point: { x: number; y: number } | null = null;
        if (typeof svgRef.current.getScreenCTM === 'function') {
          const ctm = svgRef.current.getScreenCTM();
          if (ctm) {
            try {
              const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
              if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) point = { x: pt.x, y: pt.y };
            } catch {}
          }
        }
        if (!point) {
          const rect = svgRef.current.getBoundingClientRect();
          point = clientToCanvasPoint(clientX, clientY, rect, view);
        }
        if (point) {
          const hits = hitTestAllAtPoint(doc, point);
          if (hits.length > 0 && !selection.nodeIds.includes(hits[0])) {
            runtime.execute('select.set', { ids: [hits[0]], additive: false });
          }
        }
      }

      setContextMenu({ x, y });
    },
    [containerRef, svgRef, view, doc, selection.nodeIds, runtime],
  );

  const elements = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (const layerId of doc.layers) {
      const layer = doc.nodes.get(layerId);
      if (!layer || layer.kind !== 'Layer' || !layer.visible) continue;
      for (const childId of layer.children) {
        const child = doc.nodes.get(childId);
        if (!child) continue;
        const el = renderNode(child, doc, selection);
        if (el) out.push(el);
      }
    }
    return out;
  }, [doc, selection]);

  const rawDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';
  const defsHtml = useMemo(() => sanitizeDefsFragment(rawDefs), [rawDefs]);

  const overlays = runtime.overlay();
  const activeMarquee = useMemo(() => {
    const found = overlays.find(
      (o) => o.kind === 'rect' && (o.stroke === '#10b981' || o.stroke === '#2563eb'),
    );
    return found && found.kind === 'rect' ? found : null;
  }, [overlays]);

  const selectionBoxes = useMemo(() => {
    const out: React.ReactNode[] = [];
    const highlightStroke = activeMarquee ? activeMarquee.stroke : 'var(--ov-accent, #4c9aff)';
    const highlightFill = activeMarquee
      ? activeMarquee.dashed
        ? 'rgba(16, 185, 129, 0.08)'
        : 'rgba(37, 99, 235, 0.08)'
      : 'none';
    for (const id of selection.nodeIds) {
      const bb = nodeWorldBBox(doc, id);
      if (!bb) continue;
      out.push(
        <rect
          key={`sel-${id}`}
          x={bb.x}
          y={bb.y}
          width={bb.width}
          height={bb.height}
          fill={highlightFill}
          stroke={highlightStroke}
          strokeWidth={activeMarquee ? 1.5 / Math.max(viewport.scale, 1e-4) : 1}
          pointerEvents="none"
        />,
      );
    }
    if (activeMarquee) return out;
    return activeToolId === 'select' || activeToolId === 'node' ? [] : out;
  }, [doc, selection.nodeIds, activeToolId, activeMarquee, viewport.scale]);

  const cursor = useMemo(() => {
    try {
      return runtime.cursor();
    } catch {
      return 'default';
    }
  }, [runtime, activeToolId, selection, doc]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--ov-canvas-bg)] p-4 select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (beginPan(e)) return;
        const targetEl = e.target instanceof Element ? e.target : null;
        if (
          e.button === 0 &&
          !e.altKey &&
          !targetEl?.closest('[data-canvas-ui]') &&
          !targetEl?.closest('[data-svg-canvas-handle]')
        ) {
          handlePointerDown(e as unknown as React.PointerEvent<SVGSVGElement>);
        }
      }}
      onPointerMove={(e) => {
        movePan(e);
        if (!panning) {
          handlePointerMove(e as unknown as React.PointerEvent<SVGSVGElement>);
        }
      }}
      onPointerUp={(e) => {
        endPan(e);
        handlePointerUp(e as unknown as React.PointerEvent<SVGSVGElement>);
      }}
      onPointerCancel={(e) => {
        endPan(e);
        handlePointerCancel(e as unknown as React.PointerEvent<SVGSVGElement>);
      }}
    >
      <div
        className="absolute inset-4 flex items-center justify-center"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: 'center center',
          transition: panning || resizingCanvas ? 'none' : 'transform 0.08s ease-out',
        }}
      >
        <div
          className="relative group/svgframe"
          style={{ width: `${view.width}px`, height: `${view.height}px` }}
        >
          {/* SVG 图形顶部尺寸指示与缩放模式快捷栏 */}
          <div
            data-canvas-ui="true"
            className="absolute -top-7 left-0 flex items-center gap-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)]/95 px-2 py-0.5 text-[11px] text-[var(--ov-fg)] shadow-sm backdrop-blur-sm select-none z-20 whitespace-nowrap"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="font-mono font-semibold text-[var(--ov-accent)]" title="当前 SVG 图形本身的像素宽度 × 高度（拖拽 SVG 四周与四角控制柄可直接调整尺寸）">
              SVG {Math.round(view.width)} × {Math.round(view.height)}
            </span>
            <span className="text-[var(--ov-border)]">|</span>
            <button
              type="button"
              title="切换拖拽 SVG 外框手柄时的行为：整体等比/自由缩放图形（含内部所有图元） vs 仅扩缩画布边界"
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                canvasResizeMode === 'scale-content'
                  ? 'bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                  : 'text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)]'
              }`}
              onClick={() =>
                setCanvasResizeMode((m) => (m === 'scale-content' ? 'canvas-only' : 'scale-content'))
              }
            >
              {canvasResizeMode === 'scale-content' ? (
                <>
                  <Scaling size={10} />
                  <span>整体缩放图形</span>
                </>
              ) : (
                <>
                  <Frame size={10} />
                  <span>仅调画布边界</span>
                </>
              )}
            </button>
            <button
              type="button"
              title="根据内部所有可见图元自动收缩或扩展 SVG 图形尺寸（留白 24px）"
              className="rounded px-1.5 py-0.5 text-[10px] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-fg)] transition-colors"
              onClick={() => runtime.execute('canvas.setSize', { mode: 'fit-content', padding: 24 })}
            >
              自适应内容
            </button>
          </div>

          <svg
            ref={svgRef}
            width={view.width}
            height={view.height}
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            className="block border border-[var(--ov-border)] bg-white shadow-sm select-none"
            style={{
              width: `${view.width}px`,
              height: `${view.height}px`,
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              overflow: activeMarquee ? 'visible' : undefined,
              cursor,
            }}
            preserveAspectRatio="xMidYMid meet"
            tabIndex={0}
            role="presentation"
            data-omni-svg-v2-canvas="true"
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDoubleClick={handleNodeDoubleClick}
            onKeyDown={handleKeyDown}
          >
            {defsHtml ? <defs dangerouslySetInnerHTML={{ __html: defsHtml }} /> : null}
            <defs>
              <marker id="ov-marker-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" stroke="context-stroke" />
              </marker>
              <marker id="ov-marker-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <circle cx="5" cy="5" r="4" fill="context-stroke" />
              </marker>
            </defs>
            {elements}
            {selectionBoxes}
            <g pointerEvents="none">{overlays.map(renderOverlay)}</g>
          </svg>

          {/* SVG 图形本身的 8 向尺寸拖拽控制柄（四角 + 四边中点） */}
          {(
            [
              { key: 'nw', pos: '-top-1.5 -left-1.5', cursor: 'nwse-resize', title: '拖拽左上角调整 SVG 图形尺寸 (Shift 锁定比例)' },
              { key: 'n', pos: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize', title: '拖拽上边缘调整 SVG 图形高度' },
              { key: 'ne', pos: '-top-1.5 -right-1.5', cursor: 'nesw-resize', title: '拖拽右上角调整 SVG 图形尺寸 (Shift 锁定比例)' },
              { key: 'e', pos: 'top-1/2 -right-1.5 -translate-y-1/2', cursor: 'ew-resize', title: '拖拽右边缘调整 SVG 图形宽度' },
              { key: 'se', pos: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize', title: '拖拽右下角调整 SVG 图形尺寸 (Shift 锁定比例)' },
              { key: 's', pos: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize', title: '拖拽下边缘调整 SVG 图形高度' },
              { key: 'sw', pos: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize', title: '拖拽左下角调整 SVG 图形尺寸 (Shift 锁定比例)' },
              { key: 'w', pos: 'top-1/2 -left-1.5 -translate-y-1/2', cursor: 'ew-resize', title: '拖拽左边缘调整 SVG 图形宽度' },
            ] as const
          ).map((h) => (
            <div
              key={`svg-resize-${h.key}`}
              data-canvas-ui="true"
              data-svg-canvas-handle={h.key}
              title={h.title}
              style={{ cursor: h.cursor }}
              className={`absolute ${h.pos} z-20 h-3 w-3 rounded-sm border border-[var(--ov-accent)] bg-[var(--ov-surface)] shadow transition-transform hover:scale-125 hover:bg-[var(--ov-accent)]`}
              onPointerDown={(e) => handleCanvasResizeDown(h.key, e)}
              onPointerMove={handleCanvasResizeMove}
              onPointerUp={handleCanvasResizeUp}
              onPointerCancel={handleCanvasResizeUp}
            />
          ))}
        </div>
      </div>

      {/* 悬浮 HUD 快捷工具条 (Floating HUD) */}
      {hudPosition && selBBox && activeToolId === 'select' && !runtime.isInteracting && (
        <SvgV2FloatingHud
          left={hudPosition.left}
          top={hudPosition.top}
          selection={selection}
          document={doc}
          selBBox={selBBox}
          execute={(cmd, params) => runtime.execute(cmd, params)}
        />
      )}

      {/* 右键上下文菜单 (Context Menu) */}
      {contextMenu && (
        <SvgV2ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selection={selection}
          document={doc}
          onClose={() => setContextMenu(null)}
          execute={(cmd, params) => runtime.execute(cmd, params)}
        />
      )}

      {/* CAD 框选模式提示徽章 (参考 AutoCAD 窗选与交叉选实时反馈) */}
      {(() => {
        const marquee = overlays.find((o) => o.kind === 'rect' && (o.stroke === '#10b981' || o.stroke === '#2563eb'));
        if (!marquee || marquee.kind !== 'rect') return null;
        return (
          <div
            data-canvas-ui="true"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xl backdrop-blur-md border border-[var(--ov-border)] bg-[var(--ov-surface)]/95 text-[var(--ov-fg)] animate-fadeIn"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: marquee.stroke }}
            />
            <span className="font-semibold">
              {marquee.dashed
                ? 'CAD 交叉选择 (右→左 · 虚线真实几何相交即选)'
                : 'CAD 窗口选择 (左→右 · 实线 100% 包围即选)'}
            </span>
            <span className="rounded-full bg-[var(--ov-accent-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ov-accent)]">
              命中 {selection.nodeIds.length} 项
            </span>
            <span className="hidden md:inline text-[10px] text-[var(--ov-fg-muted)]">
              Shift 加选 · Ctrl 减选
            </span>
          </div>
        );
      })()}

      {/* 底部视口浮动控制条 (Viewport HUD) */}
      <div
        data-canvas-ui="true"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[var(--ov-border)] bg-[var(--ov-surface)]/90 backdrop-blur-md px-2 py-1 shadow-lg text-xs text-[var(--ov-text)] z-10 select-none"
      >
        <button
          type="button"
          title="缩小 (Ctrl + 滚轮下)"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--ov-hover)] transition-colors text-[var(--ov-text)]"
          onClick={zoomOut}
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          title="复位至 100%"
          className="px-1.5 py-0.5 font-mono text-[11px] text-[var(--ov-text)] hover:text-[var(--ov-accent)] transition-colors"
          onClick={zoomReset}
        >
          {Math.round(viewport.scale * 100)}%
        </button>
        <button
          type="button"
          title="放大 (Ctrl + 滚轮上)"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--ov-hover)] transition-colors text-[var(--ov-text)]"
          onClick={zoomIn}
        >
          <ZoomIn size={13} />
        </button>
        <div className="mx-1 h-3.5 w-px bg-[var(--ov-border)]" />
        <button
          type="button"
          title="自适应画布居中 (双击空白处)"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full hover:bg-[var(--ov-hover)] transition-colors text-[11px] text-[var(--ov-text)]"
          onClick={zoomFit}
        >
          <Maximize2 size={12} />
          <span>适应</span>
        </button>
        <div className="mx-1 h-3.5 w-px bg-[var(--ov-border)]" />
        <span
          className="flex items-center gap-1 px-1 text-[10px] text-[var(--ov-fg-muted)]"
          title="按住 Alt / 鼠标中键拖拽可平移画布"
        >
          <Move size={11} />
          <span className="hidden sm:inline">平移</span>
        </span>
        {selection.nodeIds.length > 1 && (
          <>
            <div className="mx-1 h-3.5 w-px bg-[var(--ov-border)]" />
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ov-accent-soft)] text-[11px] font-medium text-[var(--ov-accent)]"
              title="按住 Ctrl / Shift 点击图元可反选或继续加选"
            >
              <span>已多选 {selection.nodeIds.length} 项</span>
              <span className="hidden md:inline text-[10px] opacity-75 font-normal">· Ctrl 增减选</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Overlay 渲染
// ============================================================================

function renderOverlay(o: OverlayElement, i: number): React.ReactNode {
  const key = `ov-${i}`;
  switch (o.kind) {
    case 'rect':
      return (
        <rect
          key={key}
          x={o.rect.x}
          y={o.rect.y}
          width={o.rect.width}
          height={o.rect.height}
          fill={o.fill}
          stroke={o.stroke}
          strokeWidth={o.lineWidth}
          strokeDasharray={o.dashed ? `${Math.max(1, 5 * o.lineWidth)} ${Math.max(1, 3 * o.lineWidth)}` : undefined}
        />
      );
    case 'line':
      return (
        <line
          key={key}
          x1={o.from.x}
          y1={o.from.y}
          x2={o.to.x}
          y2={o.to.y}
          stroke={o.stroke}
          strokeWidth={o.lineWidth}
          strokeDasharray={o.dashed ? '4 2' : undefined}
        />
      );
    case 'circle':
      return (
        <circle
          key={key}
          cx={o.center.x}
          cy={o.center.y}
          r={o.radius}
          fill={o.fill}
          stroke={o.stroke}
          strokeWidth={o.lineWidth}
          strokeDasharray={o.dashed ? `${3 / Math.max(o.lineWidth, 1e-6)} ${2 / Math.max(o.lineWidth, 1e-6)}` : undefined}
        />
      );
    case 'polyline':
      return (
        <polyline
          key={key}
          points={o.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={o.stroke}
          strokeWidth={1}
          strokeDasharray={o.dashed ? '4 2' : undefined}
        />
      );
    case 'handle':
      return (
        <rect
          key={key}
          x={o.center.x - o.size / 2}
          y={o.center.y - o.size / 2}
          width={o.size}
          height={o.size}
          fill="var(--ov-accent, #4c9aff)"
          stroke="white"
          strokeWidth={1}
        />
      );
    default:
      return null;
  }
}

// ============================================================================
// 节点渲染
// ============================================================================

function paintToCss(fill: Fill): string {
  switch (fill.type) {
    case 'solid':
      return fill.color;
    case 'gradient':
    case 'pattern':
      return `url(#${fill.id})`;
    case 'none':
    default:
      return 'none';
  }
}

function paintOpacity(fill: Fill): number | undefined {
  if (fill.type === 'solid' && fill.opacity !== undefined && fill.opacity < 1) {
    return fill.opacity;
  }
  return undefined;
}

function resolveMarkerAttr(marker?: 'none' | 'arrow' | 'dot' | string): string | undefined {
  if (!marker || marker === 'none') return undefined;
  if (marker === 'arrow') return 'url(#ov-marker-arrow)';
  if (marker === 'dot') return 'url(#ov-marker-dot)';
  if (marker.startsWith('url(')) return marker;
  return `url(#${marker.replace(/^#/, '')})`;
}

function matrixAttr(node: Node): string | undefined {
  const t = node.transform;
  return t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0
    ? undefined
    : `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.e} ${t.f})`;
}

function selectionStyle(isSelected: boolean): React.CSSProperties | undefined {
  return isSelected ? { outline: '2px solid var(--ov-accent, #4c9aff)', outlineOffset: '1px' } : undefined;
}

export function renderNode(node: Node, doc: SvgDocument, selection: Selection): React.ReactNode {
  if (!node.visible) return null;
  const isSelected = selection.nodeIds.includes(node.id);
  const transform = matrixAttr(node);
  const selStyle = isOpenPolylineNode(node) ? undefined : selectionStyle(isSelected);

  if (node.kind === 'Group') {
    return (
      <g
        key={`g-${node.id}`}
        data-omni-id={node.id}
        className={node.className}
        transform={transform}
        opacity={node.opacity}
        clipPath={node.clipPath ?? undefined}
        mask={node.mask ?? undefined}
        filter={node.filter ?? undefined}
        style={selStyle}
      >
        {node.children.map((cid) => {
          const child = doc.nodes.get(cid);
          return child ? renderNode(child, doc, selection) : null;
        })}
      </g>
    );
  }

  if (node.kind === 'Path') {
    const fillItem = node.appearance.items.find((it) => it.kind === 'fill');
    const strokeItem = node.appearance.items.find((it) => it.kind === 'stroke');
    const fillValue = fillItem && fillItem.kind === 'fill' ? paintToCss(fillItem.fill) : '#000';
    const fillAlpha = fillItem && fillItem.kind === 'fill' ? paintOpacity(fillItem.fill) : undefined;
    const strokeValue = strokeItem && strokeItem.kind === 'stroke' ? paintToCss(strokeItem.stroke.paint) : 'none';
    const strokeAlpha =
      strokeItem && strokeItem.kind === 'stroke' ? paintOpacity(strokeItem.stroke.paint) : undefined;
    const strokeWidth =
      strokeItem && strokeItem.kind === 'stroke' && strokeValue !== 'none'
        ? strokeItem.stroke.width
        : 0;
    const strokeDash =
      strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.dashArray
        ? strokeItem.stroke.dashArray.join(' ')
        : undefined;
    const strokeDashOffset =
      strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.dashOffset
        ? strokeItem.stroke.dashOffset
        : undefined;
    const strokeCap = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.cap : undefined;
    const strokeJoin = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.join : undefined;
    const strokeMiter =
      strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.miterLimit : undefined;
    const mStart = resolveMarkerAttr(node.markerStart);
    const mMid = resolveMarkerAttr(node.markerMid);
    const mEnd = resolveMarkerAttr(node.markerEnd);
    const inlineStyle: React.CSSProperties = {
      cursor: 'default',
      ...(node.className
        ? {
            fill: fillValue,
            stroke: strokeValue,
            strokeWidth: strokeWidth || undefined,
          }
        : undefined),
      ...selStyle,
    };

    return (
      <path
        key={`p-${node.id}`}
        data-omni-id={node.id}
        className={node.className}
        d={serializePathD(node.geometry)}
        fill={fillValue}
        fillOpacity={fillAlpha}
        stroke={strokeValue}
        strokeOpacity={strokeAlpha}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        strokeDashoffset={strokeDashOffset}
        strokeLinecap={strokeCap}
        strokeLinejoin={strokeJoin}
        strokeMiterlimit={strokeMiter}
        markerStart={mStart}
        markerMid={mMid}
        markerEnd={mEnd}
        clipPath={node.clipPath ?? undefined}
        mask={node.mask ?? undefined}
        filter={node.filter ?? undefined}
        transform={transform}
        opacity={node.opacity}
        style={inlineStyle}
      />
    );
  }

  if (node.kind === 'Text') {
    const fillItem = node.appearance.items.find((it) => it.kind === 'fill');
    const fillValue = fillItem && fillItem.kind === 'fill' ? paintToCss(fillItem.fill) : '#000';
    const fillAlpha = fillItem && fillItem.kind === 'fill' ? paintOpacity(fillItem.fill) : undefined;
    const inlineStyle: React.CSSProperties = {
      cursor: 'default',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      ...(node.className
        ? {
            fill: fillValue,
            fontSize: node.fontSize ?? 16,
            fontFamily: node.fontFamily,
            fontWeight: node.fontWeight as React.CSSProperties['fontWeight'],
            fontStyle: node.fontStyle as React.CSSProperties['fontStyle'],
          }
        : undefined),
      ...selStyle,
    };

    return (
      <text
        key={`t-${node.id}`}
        data-omni-id={node.id}
        className={node.className}
        x={node.x ?? 0}
        y={node.y ?? 0}
        fontSize={node.fontSize ?? 16}
        fontFamily={node.fontFamily}
        fontWeight={node.fontWeight}
        fontStyle={node.fontStyle}
        textAnchor={node.textAnchor}
        dominantBaseline={node.dominantBaseline as any}
        letterSpacing={node.letterSpacing}
        fill={fillValue}
        fillOpacity={fillAlpha}
        clipPath={node.clipPath ?? undefined}
        mask={node.mask ?? undefined}
        filter={node.filter ?? undefined}
        transform={transform}
        opacity={node.opacity}
        style={inlineStyle}
      >
        {node.tspans && node.tspans.length > 0
          ? node.tspans.map((sp, idx) => (
              <tspan
                key={`ts-${node.id}-${idx}`}
                x={sp.x}
                y={sp.y}
                dx={sp.dx}
                dy={sp.dy}
                fontSize={sp.fontSize}
                fontFamily={sp.fontFamily}
                fontWeight={sp.fontWeight}
                fontStyle={sp.fontStyle}
                textAnchor={sp.textAnchor}
                dominantBaseline={sp.dominantBaseline as any}
                letterSpacing={sp.letterSpacing}
                fill={sp.fill ? paintToCss(sp.fill) : undefined}
                fillOpacity={sp.fill ? paintOpacity(sp.fill) : undefined}
              >
                {sp.text}
              </tspan>
            ))
          : node.text}
      </text>
    );
  }

  if (node.kind === 'Image') {
    return (
      <image
        key={`i-${node.id}`}
        data-omni-id={node.id}
        className={node.className}
        x={node.x ?? 0}
        y={node.y ?? 0}
        width={node.width}
        height={node.height}
        href={node.href}
        clipPath={node.clipPath ?? undefined}
        mask={node.mask ?? undefined}
        filter={node.filter ?? undefined}
        transform={transform}
        opacity={node.opacity}
        style={selStyle ?? { cursor: 'default' }}
      />
    );
  }

  if (node.kind === 'Use') {
    return (
      <use
        key={`u-${node.id}`}
        data-omni-id={node.id}
        className={node.className}
        x={node.x ?? 0}
        y={node.y ?? 0}
        width={node.width}
        height={node.height}
        href={node.href}
        clipPath={node.clipPath ?? undefined}
        mask={node.mask ?? undefined}
        filter={node.filter ?? undefined}
        transform={transform}
        opacity={node.opacity}
        style={selStyle ?? { cursor: 'default' }}
      />
    );
  }

  // Layer 不作为子节点渲染
  return null;
}

export default SvgV2Canvas;
