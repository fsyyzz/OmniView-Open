/**
 * OmniView SVG 编辑引擎 v2 — UsvgTree → Document 转换器 (ADR-0001 §10.3, P0 修订)
 *
 * `core/io/types.ts` 声明的 `usvgTreeToDocument` 契约实现：
 *
 *   UsvgTree（DOMParser / usvg-wasm 归一化树）→ Document（不可变文档模型）
 *
 * 规则：
 *   - `tree.root`（根 `<svg>`）→ 默认 Layer；其余子节点递归转换
 *   - `group → GroupNode`、`path → PathNode`（parsePathD）、`text → TextNode`、
 *     `image → ImageNode`、`use → UseNode`
 *   - transform 6 元数组与 `AffineTransform` 同构（`applyTransform` 同约定）
 *   - `visibility: hidden|collapse → visible:false`
 *   - 原始 SVG `id` 落 `node.name`（图层面板辨识）
 *   - UsvgFill gradient/pattern → `Fill{type:'gradient'|'pattern', id}`
 *   - 未知/不支持节点降级为 Group 并记入 warnings
 */

import type { UsvgFill, UsvgNode, UsvgStroke, UsvgTextSpan, UsvgTree } from './types';
import type {
  AffineTransform,
  Appearance,
  Color,
  Document,
  Fill,
  GroupNode,
  Node,
  NodeId,
  Stroke,
  TextNode,
  TextSpan,
} from '../model/types';
import { emptyAppearance, makeLayer } from '../model/document';
import { inferRectGeometryRadius, parsePathD } from '../model/path';

/** metadata key：`<defs>` 原始 XML 片段（导出时原样回插，保证渐变/clipPath 引用不断裂）。 */
export const RAW_DEFS_METADATA_KEY = 'omniview.rawDefs';

interface ConvertCtx {
  readonly nodes: Map<NodeId, Node>;
  nextId: number;
  readonly warnings: string[];
}

export function usvgTreeToDocument(tree: UsvgTree): Document {
  const ctx: ConvertCtx = { nodes: new Map<NodeId, Node>(), nextId: 2, warnings: [] };

  const root = tree.root;
  const rootGroup = root.kind === 'group' ? root : null;
  const rootVisible = root.visibility === 'visible';
  const layerId = 1 as NodeId;
  const childIds: NodeId[] = [];
  for (const child of rootGroup ? rootGroup.children : []) {
    const id = convertNode(child, ctx);
    if (id !== null) childIds.push(id);
  }

  const layer = makeLayer(layerId, rootGroup?.id || 'Layer 1');
  ctx.nodes.set(layerId, { ...layer, visible: rootVisible, opacity: root.opacity, children: childIds });

  const width = tree.size.width;
  const height = tree.size.height;
  const vb = tree.viewBox ?? { x: 0, y: 0, width, height };
  const doc: Document = {
    canvas: {
      width,
      height,
      unit: 'px',
      viewBox: vb,
    },
    layers: [layerId],
    nodes: ctx.nodes,
    nextNodeId: ctx.nextId,
    metadata: ctx.warnings.length > 0 ? { 'omniview.importWarnings': ctx.warnings.join(' | ') } : {},
    _internal: { revision: 0 },
  };
  return doc;
}

// ============================================================================
// 节点转换
// ============================================================================

function convertNode(node: UsvgNode, ctx: ConvertCtx): NodeId | null {
  const id = ctx.nextId++ as NodeId;
  const base = {
    id,
    name: node.id || null,
    className: node.className,
    transform: toAffine(node.transform),
    opacity: node.opacity,
    blend: 'normal' as const,
    visible: node.visibility === 'visible',
    locked: false,
    clipPath: node.clipPath,
    mask: node.mask,
    filter: node.filter,
    children: [] as ReadonlyArray<NodeId>,
  };

  switch (node.kind) {
    case 'group': {
      const childIds: NodeId[] = [];
      for (const child of node.children) {
        const cid = convertNode(child, ctx);
        if (cid !== null) childIds.push(cid);
      }
      const g: GroupNode = { ...base, kind: 'Group', children: childIds, appearance: emptyAppearance() };
      ctx.nodes.set(id, g);
      return id;
    }

    case 'path': {
      const geometry = parsePathD(node.d);
      const inferredRx = inferRectGeometryRadius(geometry);
      const isInferredRect = node.primitiveHint === 'rect' || inferredRx !== null;
      const resolvedRx = node.rx ?? (isInferredRect ? (inferredRx ?? 0) : undefined);
      const resolvedRy = node.ry ?? resolvedRx;
      const n: Node = {
        ...base,
        kind: 'Path',
        geometry,
        appearance: appearanceFrom(node.fill, node.stroke),
        primitiveHint: isInferredRect ? 'rect' : (node.primitiveHint ?? 'path'),
        markerStart: node.markerStart,
        markerMid: node.markerMid,
        markerEnd: node.markerEnd,
        rx: resolvedRx,
        ry: resolvedRy,
        cornerRadius: node.cornerRadius ?? resolvedRx,
      };
      ctx.nodes.set(id, n);
      return id;
    }

    case 'text': {
      const t: TextNode = {
        ...base,
        kind: 'Text',
        text: node.text,
        x: node.x,
        y: node.y,
        fontSize: node.fontSize,
        fontFamily: node.fontFamily,
        fontWeight: node.fontWeight,
        fontStyle: node.fontStyle,
        textAnchor: node.textAnchor,
        dominantBaseline: node.dominantBaseline,
        letterSpacing: node.letterSpacing,
        tspans: node.tspans ? node.tspans.map(toTextSpan) : undefined,
        appearance: { items: [{ kind: 'fill', fill: toFill(node.fill), blend: 'normal', opacity: 1 }] },
      };
      ctx.nodes.set(id, t);
      return id;
    }

    case 'image': {
      const n: Node = {
        ...base,
        kind: 'Image',
        href: node.href,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        appearance: emptyAppearance(),
      };
      ctx.nodes.set(id, n);
      return id;
    }

    case 'use': {
      const n: Node = {
        ...base,
        kind: 'Use',
        href: node.href,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        appearance: emptyAppearance(),
      };
      ctx.nodes.set(id, n);
      return id;
    }

    default: {
      ctx.warnings.push(`未知节点类型已降级为 Group: ${(node as { kind: string }).kind}`);
      const g: GroupNode = { ...base, kind: 'Group', appearance: emptyAppearance() };
      ctx.nodes.set(id, g);
      return id;
    }
  }
}

// ============================================================================
// 属性映射
// ============================================================================

function toTextSpan(sp: UsvgTextSpan): TextSpan {
  return {
    text: sp.text,
    x: sp.x,
    y: sp.y,
    dx: sp.dx,
    dy: sp.dy,
    fontSize: sp.fontSize,
    fontFamily: sp.fontFamily,
    fontWeight: sp.fontWeight,
    fontStyle: sp.fontStyle,
    textAnchor: sp.textAnchor,
    dominantBaseline: sp.dominantBaseline,
    letterSpacing: sp.letterSpacing,
    fill: sp.fill ? toFill(sp.fill) : undefined,
  };
}

function toAffine(m: ReadonlyArray<number>): AffineTransform {
  if (m.length !== 6) return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  return { a: m[0]!, b: m[1]!, c: m[2]!, d: m[3]!, e: m[4]!, f: m[5]! };
}

function toFill(f: UsvgFill): Fill {
  switch (f.type) {
    case 'none':
      return { type: 'none' };
    case 'solid':
      return { type: 'solid', color: f.color as Color, opacity: f.opacity };
    case 'linear-gradient':
    case 'radial-gradient':
      return { type: 'gradient', id: f.id };
    case 'pattern':
      return { type: 'pattern', id: f.id };
    default:
      return { type: 'none' };
  }
}

function toStroke(s: UsvgStroke): Stroke {
  return {
    paint: toFill(s.paint),
    width: s.width,
    widthUnit: 'px',
    cap: s.cap,
    join: s.join,
    miterLimit: s.miterLimit,
    dashArray: s.dashArray ? [...s.dashArray] : null,
    dashOffset: s.dashOffset,
    alignment: s.alignment,
  };
}

function appearanceFrom(fill: UsvgFill, stroke: UsvgStroke): Appearance {
  return {
    items: [
      { kind: 'fill', fill: toFill(fill), blend: 'normal', opacity: 1 },
      { kind: 'stroke', stroke: toStroke(stroke), blend: 'normal', opacity: 1 },
    ],
  };
}
