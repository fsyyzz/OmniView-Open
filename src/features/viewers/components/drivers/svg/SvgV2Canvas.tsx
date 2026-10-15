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
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  RAW_DEFS_METADATA_KEY,
  nodeBBox,
  serializePathD,
  type Document as SvgDocument,
  type Fill,
  type Node,
  type OverlayElement,
  type Runtime,
  type Selection,
  type ToolId,
} from './core';
import { useSvgV2PointerInput } from './useSvgV2PointerInput';

export interface SvgV2CanvasProps {
  readonly document: SvgDocument;
  readonly selection: Selection;
  readonly runtime: Runtime;
  readonly activeToolId: ToolId;
}

/** `<defs>` 净化配置（与 v1 SvgCanvas 一致的 SVG profile 白名单）。 */
const DEFS_SANITIZE = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: [
    'style', 'clipPath', 'linearGradient', 'radialGradient', 'filter', 'feGaussianBlur',
    'feOffset', 'feMerge', 'feMergeNode', 'marker', 'pattern', 'mask', 'symbol', 'use',
  ],
  ADD_ATTR: [
    'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy', 'rx', 'ry', 'points', 'd',
    'viewBox', 'xmlns', 'xmlns:xlink', 'xlink:href', 'href', 'transform',
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'opacity',
    'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight',
    'font-style', 'text-anchor', 'letter-spacing', 'dominant-baseline',
    'width', 'height', 'preserveAspectRatio', 'clip-path', 'filter',
    'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
    'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits',
    'maskUnits', 'maskContentUnits', 'filterUnits', 'primitiveUnits', 'markerUnits',
    'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'spreadMethod',
    'xlink:title',
  ],
};

export const SvgV2Canvas: React.FC<SvgV2CanvasProps> = ({
  document: doc,
  selection,
  runtime,
  activeToolId,
}) => {
  const view = useMemo(
    () => ({
      x: doc.canvas.viewBox.x,
      y: doc.canvas.viewBox.y,
      width: doc.canvas.viewBox.width,
      height: doc.canvas.viewBox.height,
    }),
    [doc.canvas.viewBox],
  );

  const { svgRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleKeyDown } =
    useSvgV2PointerInput({
      runtime,
      view,
      undo: () => runtime.undo(),
      redo: () => runtime.redo(),
      selectAll: () => runtime.execute('select.all', {}),
    });

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
  const defsHtml = useMemo(
    () => (rawDefs.trim() ? DOMPurify.sanitize(rawDefs, DEFS_SANITIZE) : ''),
    [rawDefs],
  );

  const overlays = runtime.overlay();
  const selectionBoxes = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (const id of selection.nodeIds) {
      const bb = nodeBBox(doc, id);
      if (!bb) continue;
      out.push(
        <rect
          key={`sel-${id}`}
          x={bb.x}
          y={bb.y}
          width={bb.width}
          height={bb.height}
          fill="none"
          stroke="var(--ov-accent, #4c9aff)"
          strokeWidth={1}
          pointerEvents="none"
        />,
      );
    }
    return out;
  }, [doc, selection.nodeIds]);

  const cursor = activeToolId === 'pen' ? 'crosshair' : 'default';

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-[var(--ov-canvas-bg)] p-4">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className="h-auto max-h-full max-w-full border border-[var(--ov-border)] bg-white"
        style={{ aspectRatio: `${view.width} / ${view.height}`, touchAction: 'none', cursor }}
        preserveAspectRatio="xMidYMid meet"
        tabIndex={0}
        role="presentation"
        data-omni-svg-v2-canvas="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        {defsHtml ? <g dangerouslySetInnerHTML={{ __html: defsHtml }} /> : null}
        {elements}
        {selectionBoxes}
        <g pointerEvents="none">{overlays.map(renderOverlay)}</g>
      </svg>
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
          strokeDasharray={o.dashed ? `${4 / Math.max(o.lineWidth, 1e-6)} ${2 / Math.max(o.lineWidth, 1e-6)}` : undefined}
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
      return <circle key={key} cx={o.center.x} cy={o.center.y} r={o.radius} fill={o.fill} stroke={o.stroke} strokeWidth={o.lineWidth} />;
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
  const style = selectionStyle(isSelected);

  if (node.kind === 'Group') {
    return (
      <g key={`g-${node.id}`} data-omni-id={node.id} transform={transform} opacity={node.opacity} style={style}>
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
    const strokeValue = strokeItem && strokeItem.kind === 'stroke' ? paintToCss(strokeItem.stroke.paint) : 'none';
    const strokeWidth = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.width : 0;
    return (
      <path
        key={`p-${node.id}`}
        data-omni-id={node.id}
        d={serializePathD(node.geometry)}
        fill={fillValue}
        stroke={strokeValue}
        strokeWidth={strokeWidth}
        transform={transform}
        opacity={node.opacity}
        style={style ?? { cursor: 'default' }}
      />
    );
  }

  if (node.kind === 'Text') {
    const fillItem = node.appearance.items.find((it) => it.kind === 'fill');
    const fillValue = fillItem && fillItem.kind === 'fill' ? paintToCss(fillItem.fill) : '#000';
    return (
      <text
        key={`t-${node.id}`}
        data-omni-id={node.id}
        x={node.x ?? 0}
        y={node.y ?? 0}
        fontSize={node.fontSize ?? 16}
        fontFamily={node.fontFamily}
        textAnchor={node.textAnchor}
        fill={fillValue}
        transform={transform}
        opacity={node.opacity}
        style={style ?? { cursor: 'default' }}
      >
        {node.text}
      </text>
    );
  }

  if (node.kind === 'Image') {
    return (
      <image
        key={`i-${node.id}`}
        data-omni-id={node.id}
        x={node.x ?? 0}
        y={node.y ?? 0}
        width={node.width}
        height={node.height}
        href={node.href}
        transform={transform}
        opacity={node.opacity}
        style={style ?? { cursor: 'default' }}
      />
    );
  }

  if (node.kind === 'Use') {
    return (
      <use
        key={`u-${node.id}`}
        data-omni-id={node.id}
        x={node.x ?? 0}
        y={node.y ?? 0}
        width={node.width}
        height={node.height}
        href={node.href}
        transform={transform}
        opacity={node.opacity}
        style={style ?? { cursor: 'default' }}
      />
    );
  }

  // Layer 不作为子节点渲染
  return null;
}

export default SvgV2Canvas;
