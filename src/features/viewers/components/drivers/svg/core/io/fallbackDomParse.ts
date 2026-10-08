/**
 * OmniView SVG 编辑引擎 v2 — DOMParser 兜底实现 (ADR-0001 §10.3)
 *
 * 当 usvg-wasm 产物缺失 / Worker 初始化失败时，`core/io/import.ts` 走此路径。
 * 基于浏览器原生 DOMParser 做轻量归一化：
 *
 *   - 提取根 `<svg>` 的 viewBox / width / height / 单位
 *   - 遍历子节点生成 UsvgTree JSON
 *   - 把 transform 矩阵展平为 6 元数组（不烘焙到几何——P1 范围限制）
 *   - 不解析 mask / filter / use 链（保留原始属性；导出时由浏览器渲染层处理）
 *
 * 这是**功能降级**路径：丢失 VectorCraft 风格的 mask/use/pattern 烘焙，
 * 但保证 v2 引擎在无 Rust toolchain 环境下仍可工作（参考 ADR §10.3）。
 */

import type {
  LoadResult,
} from '../runtime/types';
import type {
  UsvgFill,
  UsvgNode,
  UsvgStroke,
  UsvgTree,
} from './types';
import type {
  Color,
  LayerNode,
  NodeId,
  PathNode,
} from '../model/types';
import {
  anchorCorner,
  defaultStroke,
  emptyAppearance,
  identityTransform,
  pathGeometry,
} from '../model/document';
import { parsePathD } from '../model/path';

// ============================================================================
// 1. parseStringLight(svg: string): LoadResult
// ============================================================================

export function fallbackDomParse(svg: string): LoadResult {
  const warnings: string[] = [];

  if (typeof DOMParser === 'undefined') {
    // Node.js / 非浏览器环境：使用极简正则解析（仅支持 P1 测试样例子集）
    return regexFallbackParse(svg);
  }

  let xml: Document;
  try {
    xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch (e) {
    return {
      document: emptyDocument(),
      warnings: [`DOMParser 抛出异常: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    warnings.push(`XML 解析错误: ${parseError.textContent ?? 'unknown'}`);
    return { document: emptyDocument(), warnings };
  }

  const root = xml.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    warnings.push('未找到根 <svg> 元素');
    return { document: emptyDocument(), warnings };
  }

  // 解析画布尺寸
  const size = readSize(root);
  // 递归构建 UsvgTree
  const rootNode = readGroupLike(root);
  const defs = collectDefs(root);

  const tree: UsvgTree = {
    size,
    root: rootNode,
    defs,
  };

  return {
    document: treeToDocument(tree),
    warnings,
  };
}

// ============================================================================
// 2. 内部辅助
// ============================================================================

function emptyDocument(): any {
  return {
    canvas: { width: 0, height: 0, unit: 'px', viewBox: null },
    layers: [] as any[],
    nodes: new Map() as any,
    nextNodeId: 1,
    metadata: {},
    _internal: { revision: 0 },
  };
}

function readSize(svg: Element): { width: number; height: number } {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2] as number, height: parts[3] as number };
    }
  }
  const w = Number(svg.getAttribute('width')) || 0;
  const h = Number(svg.getAttribute('height')) || 0;
  return { width: w, height: h };
}

function readTransform(el: Element): number[] {
  const raw = el.getAttribute('transform') || '';
  if (!raw) return [1, 0, 0, 1, 0, 0];
  // 简化处理：仅支持 matrix(a b c d e f)；其他形式（translate/rotate/scale）暂原样忽略
  const m = raw.match(/matrix\s*\(\s*([-\d.\se,]+)\s*\)/i);
  if (m && m[1]) {
    const parts = m[1].split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
    if (parts.length === 6) return parts;
  }
  return [1, 0, 0, 1, 0, 0];
}

function readFill(el: Element): UsvgFill {
  const fill = el.getAttribute('fill');
  if (!fill || fill === 'none') return { type: 'none' };
  if (fill.startsWith('url(')) {
    const id = fill.replace(/^url\(#?/, '').replace(/\)$/, '');
    return { type: 'linear-gradient', id }; // 简化：暂按 linear-gradient 处理
  }
  return {
    type: 'solid',
    color: fill,
    opacity: Number(el.getAttribute('fill-opacity') ?? '1') || 1,
  };
}

function readStroke(el: Element): UsvgStroke {
  const stroke = el.getAttribute('stroke');
  return {
    paint: stroke ? readFillAttr(stroke) : { type: 'none' },
    width: Number(el.getAttribute('stroke-width') ?? '1') || 1,
    cap: (el.getAttribute('stroke-linecap') as 'butt' | 'round' | 'square') || 'butt',
    join: (el.getAttribute('stroke-linejoin') as 'miter' | 'round' | 'bevel') || 'miter',
    miterLimit: Number(el.getAttribute('stroke-miterlimit') ?? '4') || 4,
    dashArray: parseDashArray(el.getAttribute('stroke-dasharray')),
    dashOffset: Number(el.getAttribute('stroke-dashoffset') ?? '0') || 0,
    alignment: 'center',
  };
}

function readFillAttr(value: string): UsvgFill {
  if (!value || value === 'none') return { type: 'none' };
  if (value.startsWith('url(')) {
    const id = value.replace(/^url\(#?/, '').replace(/\)$/, '');
    return { type: 'linear-gradient', id };
  }
  return { type: 'solid', color: value, opacity: 1 };
}

function parseDashArray(raw: string | null): number[] | null {
  if (!raw || raw === 'none') return null;
  return raw.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
}

function readGroupLike(el: Element): UsvgNode {
  const children: UsvgNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    const tag = c.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'metadata' || tag === 'title' || tag === 'desc') continue;
    children.push(readNode(c));
  }
  return {
    kind: 'group',
    id: el.getAttribute('id') || '',
    transform: readTransform(el),
    opacity: Number(el.getAttribute('opacity') ?? '1') || 1,
    visibility: (el.getAttribute('visibility') as 'visible' | 'hidden' | 'collapse') || 'visible',
    clipPath: el.getAttribute('clip-path') || null,
    mask: el.getAttribute('mask') || null,
    filter: el.getAttribute('filter') || null,
    children,
  };
}

function readNode(el: Element): UsvgNode {
  const tag = el.tagName.toLowerCase();
  const base = {
    id: el.getAttribute('id') || '',
    transform: readTransform(el),
    opacity: Number(el.getAttribute('opacity') ?? '1') || 1,
    visibility: (el.getAttribute('visibility') as 'visible' | 'hidden' | 'collapse') || 'visible',
    clipPath: el.getAttribute('clip-path') || null,
    mask: el.getAttribute('mask') || null,
    filter: el.getAttribute('filter') || null,
  };

  switch (tag) {
    case 'g':
    case 'svg':
    case 'symbol':
      return readGroupLike(el);

    case 'path':
      return {
        ...base,
        kind: 'path',
        d: el.getAttribute('d') || '',
        fill: readFill(el),
        stroke: readStroke(el),
      };

    case 'rect':
    case 'circle':
    case 'ellipse':
    case 'line':
    case 'polyline':
    case 'polygon':
      return {
        ...base,
        kind: 'path',
        d: primitiveToPathD(tag, el),
        fill: readFill(el),
        stroke: readStroke(el),
      };

    case 'image':
      return {
        ...base,
        kind: 'image',
        href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
        width: Number(el.getAttribute('width') ?? '0') || 0,
        height: Number(el.getAttribute('height') ?? '0') || 0,
      };

    case 'text':
      return {
        ...base,
        kind: 'text',
        text: el.textContent || '',
        x: Number(el.getAttribute('x') ?? '0') || 0,
        y: Number(el.getAttribute('y') ?? '0') || 0,
        fontSize: Number(el.getAttribute('font-size') ?? '16') || 16,
        fontFamily: el.getAttribute('font-family') || 'sans-serif',
        fill: readFill(el),
      };

    case 'use':
      return {
        ...base,
        kind: 'use',
        href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
        width: Number(el.getAttribute('width') ?? '0') || 0,
        height: Number(el.getAttribute('height') ?? '0') || 0,
      };

    default:
      // 未知节点：作为 group 处理（保留原属性但不解析子节点）
      return { ...base, kind: 'group', children: [] };
  }
}

function primitiveToPathD(tag: string, el: Element): string {
  switch (tag) {
    case 'rect': {
      const x = Number(el.getAttribute('x') ?? '0');
      const y = Number(el.getAttribute('y') ?? '0');
      const w = Number(el.getAttribute('width') ?? '0');
      const h = Number(el.getAttribute('height') ?? '0');
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }
    case 'circle': {
      const cx = Number(el.getAttribute('cx') ?? '0');
      const cy = Number(el.getAttribute('cy') ?? '0');
      const r = Number(el.getAttribute('r') ?? '0');
      // 简化为矩形路径；M2 阶段切到真 Bézier 圆
      return `M ${cx - r} ${cy} L ${cx + r} ${cy} Z`;
    }
    case 'ellipse': {
      const cx = Number(el.getAttribute('cx') ?? '0');
      const cy = Number(el.getAttribute('cy') ?? '0');
      const rx = Number(el.getAttribute('rx') ?? '0');
      const ry = Number(el.getAttribute('ry') ?? '0');
      return `M ${cx - rx} ${cy} L ${cx + rx} ${cy} Z`;
    }
    case 'line': {
      const x1 = Number(el.getAttribute('x1') ?? '0');
      const y1 = Number(el.getAttribute('y1') ?? '0');
      const x2 = Number(el.getAttribute('x2') ?? '0');
      const y2 = Number(el.getAttribute('y2') ?? '0');
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    case 'polyline':
    case 'polygon': {
      const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      if (pts.length < 4) return '';
      let d = `M ${pts[0]} ${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) {
        d += ` L ${pts[i]} ${pts[i + 1]}`;
      }
      if (tag === 'polygon') d += ' Z';
      return d;
    }
    default:
      return '';
  }
}

function collectDefs(root: Element): UsvgNode[] {
  const defs: UsvgNode[] = [];
  const defsEl = root.querySelector(':scope > defs');
  if (!defsEl) return defs;
  for (let i = 0; i < defsEl.childNodes.length; i++) {
    const child = defsEl.childNodes[i];
    if (child.nodeType !== 1) continue;
    defs.push(readNode(child as Element));
  }
  return defs;
}

// ============================================================================
// 3. treeToDocument：把 UsvgTree 包成 Document 形状（M2 阶段填充）
// ============================================================================

function treeToDocument(tree: UsvgTree): LoadResult['document'] {
  // 当前实现：仅产出占位 Document（M2 阶段填充实节点映射）
  return {
    canvas: {
      width: tree.size.width,
      height: tree.size.height,
      unit: 'px',
      viewBox: { x: 0, y: 0, width: tree.size.width, height: tree.size.height },
    },
    layers: [],
    nodes: new Map(),
    nextNodeId: 1,
    metadata: {},
    _internal: { revision: 0 },
  } as unknown as LoadResult['document'];
}

// ============================================================================
// 4. Node.js 正则 fallback 解析（M7 阶段补齐）
// ============================================================================

/**
 * 极简正则解析。仅支持 P1 测试需要的子集（rect/circle/line/path/polygon/g）。
 * 复杂 SVG 仍走浏览器 DOMParser 路径或 usvg-wasm。
 */
function regexFallbackParse(svg: string): LoadResult {
  const warnings: string[] = ['Node.js 环境：使用 regex fallback 解析（仅支持基础子集）'];
  const doc = emptyDocument();

  // 提取根 svg 元素的 width/height/viewBox
  const rootMatch = svg.match(/<svg\b([^>]*)>/i);
  if (!rootMatch) {
    warnings.push('未找到 <svg> 根元素');
    return { document: doc, warnings };
  }
  const rootAttrs = rootMatch[1];

  const widthMatch = rootAttrs.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i);
  const heightMatch = rootAttrs.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i);
  const viewBoxMatch = rootAttrs.match(/\bviewBox\s*=\s*["']?\s*([\d.\s,-]+)["']?/i);

  let w = 0;
  let h = 0;
  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      w = parts[2]!;
      h = parts[3]!;
    }
  }
  if (widthMatch && widthMatch[1]) w = Number(widthMatch[1]);
  if (heightMatch && heightMatch[1]) h = Number(heightMatch[1]);

  doc.canvas = { width: w, height: h, unit: 'px', viewBox: { x: 0, y: 0, width: w, height: h } };

  // 创建一个默认 layer
  const layerId = 1 as NodeId;
  const layer: LayerNode = {
    id: layerId,
    kind: 'Layer',
    name: 'Layer 1',
    transform: identityTransform(),
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children: [],
    colorTag: 'none',
  };
  doc.nodes.set(layerId, layer);
  doc.layers = [layerId];
  doc.nextNodeId = 2;

  // 提取 rect/circle/line/path/polygon 子节点并转换为 Path
  let nextId = 2;
  const childIds: NodeId[] = [];

  const rectRe = /<rect\b([^>]*)\/?>(?:<\/rect>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = rectRe.exec(svg)) !== null) {
    const a = m[1];
    const x = Number((a.match(/\bx\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const y = Number((a.match(/\by\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const ww = Number((a.match(/\bwidth\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const hh = Number((a.match(/\bheight\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const fill = (a.match(/\bfill\s*=\s*["']\s*([^"']+)\s*["']/i) || [])[1] ?? '#000000';
    const id = nextId++ as NodeId;
    doc.nodes.set(id, makeRectPath(id, x, y, ww, hh, fill));
    childIds.push(id);
  }

  const circleRe = /<circle\b([^>]*)\/?>(?:<\/circle>)?/gi;
  while ((m = circleRe.exec(svg)) !== null) {
    const a = m[1];
    const cx = Number((a.match(/\bcx\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const cy = Number((a.match(/\bcy\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const r = Number((a.match(/\br\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const fill = (a.match(/\bfill\s*=\s*["']\s*([^"']+)\s*["']/i) || [])[1] ?? '#000000';
    const id = nextId++ as NodeId;
    doc.nodes.set(id, makeCirclePath(id, cx, cy, r, fill));
    childIds.push(id);
  }

  const lineRe = /<line\b([^>]*)\/?>(?:<\/line>)?/gi;
  while ((m = lineRe.exec(svg)) !== null) {
    const a = m[1];
    const x1 = Number((a.match(/\bx1\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const y1 = Number((a.match(/\by1\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const x2 = Number((a.match(/\bx2\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const y2 = Number((a.match(/\by2\s*=\s*["']?\s*([\d.-]+)/i) || [])[1] ?? 0);
    const stroke = (a.match(/\bstroke\s*=\s*["']\s*([^"']+)\s*["']/i) || [])[1] ?? '#000000';
    const id = nextId++ as NodeId;
    doc.nodes.set(id, makeLinePath(id, x1, y1, x2, y2, stroke));
    childIds.push(id);
  }

  const pathRe = /<path\b([^>]*?)\/?>(?:<\/path>)?/gi;
  while ((m = pathRe.exec(svg)) !== null) {
    const a = m[1];
    const d = (a.match(/\bd\s*=\s*["']\s*([^"']+)\s*["']/i) || [])[1] ?? '';
    const fill = (a.match(/\bfill\s*=\s*["']\s*([^"']+)\s*["']/i) || [])[1] ?? '#000000';
    const id = nextId++ as NodeId;
    doc.nodes.set(id, makeDPath(id, d, fill));
    childIds.push(id);
  }

  const polygonRe = /<polygon\b([^>]*)\/?>(?:<\/polygon>)?/gi;
  while ((m = polygonRe.exec(svg)) !== null) {
    const a = m[1];
    const ptsRaw = (a.match(/\bpoints\s*=\s*["']\s*([^"']+)\s*["']/i) || [])[1] ?? '';
    const pts = ptsRaw.trim().split(/[\s,]+/).map(Number);
    const id = nextId++ as NodeId;
    doc.nodes.set(id, makePolygonPath(id, pts));
    childIds.push(id);
  }

  // 更新 layer.children
  doc.nodes.set(layerId, { ...layer, children: childIds });
  doc.nextNodeId = nextId;

  return { document: doc, warnings };
}

function makeRectPath(id: NodeId, x: number, y: number, w: number, h: number, fill: string): PathNode {
  return {
    id, kind: 'Path', name: null,
    transform: identityTransform(), opacity: 1, blend: 'normal',
    visible: true, locked: false, children: [],
    geometry: pathGeometry([{ anchors: [
      anchorCorner({ x, y }),
      anchorCorner({ x: x + w, y }),
      anchorCorner({ x: x + w, y: y + h }),
      anchorCorner({ x, y: y + h }),
    ], closed: true }]),
    appearance: { items: [
      { kind: 'fill', fill: { type: 'solid', color: fill as Color, opacity: 1 }, blend: 'normal', opacity: 1 },
      { kind: 'stroke', stroke: defaultStroke(), blend: 'normal', opacity: 1 },
    ] },
    primitiveHint: 'rect',
  };
}

function makeCirclePath(id: NodeId, cx: number, cy: number, r: number, fill: string): PathNode {
  return {
    id, kind: 'Path', name: null,
    transform: identityTransform(), opacity: 1, blend: 'normal',
    visible: true, locked: false, children: [],
    geometry: pathGeometry([{ anchors: [
      anchorCorner({ x: cx - r, y: cy }),
      anchorCorner({ x: cx + r, y: cy }),
    ], closed: false }]),
    appearance: { items: [
      { kind: 'fill', fill: { type: 'solid', color: fill as Color, opacity: 1 }, blend: 'normal', opacity: 1 },
      { kind: 'stroke', stroke: defaultStroke(), blend: 'normal', opacity: 1 },
    ] },
    primitiveHint: 'circle',
  };
}

function makeLinePath(id: NodeId, x1: number, y1: number, x2: number, y2: number, stroke: string): PathNode {
  return {
    id, kind: 'Path', name: null,
    transform: identityTransform(), opacity: 1, blend: 'normal',
    visible: true, locked: false, children: [],
    geometry: pathGeometry([{ anchors: [
      anchorCorner({ x: x1, y: y1 }),
      anchorCorner({ x: x2, y: y2 }),
    ], closed: false }]),
    appearance: { items: [
      { kind: 'fill', fill: { type: 'none' }, blend: 'normal', opacity: 1 },
      { kind: 'stroke', stroke: { ...defaultStroke(), paint: { type: 'solid', color: stroke as Color, opacity: 1 } }, blend: 'normal', opacity: 1 },
    ] },
    primitiveHint: 'line',
  };
}

function makeDPath(id: NodeId, d: string, fill: string = '#000000'): PathNode {
  return {
    id, kind: 'Path', name: null,
    transform: identityTransform(), opacity: 1, blend: 'normal',
    visible: true, locked: false, children: [],
    geometry: parsePathD(d),
    appearance: {
      items: [
        { kind: 'fill', fill: { type: 'solid', color: fill as Color, opacity: 1 }, blend: 'normal', opacity: 1 },
        { kind: 'stroke', stroke: defaultStroke(), blend: 'normal', opacity: 1 },
      ],
    },
    primitiveHint: 'path',
  };
}

function makePolygonPath(id: NodeId, pts: number[]): PathNode {
  const anchors = [];
  for (let i = 0; i < pts.length; i += 2) {
    anchors.push(anchorCorner({ x: pts[i] ?? 0, y: pts[i + 1] ?? 0 }));
  }
  return {
    id, kind: 'Path', name: null,
    transform: identityTransform(), opacity: 1, blend: 'normal',
    visible: true, locked: false, children: [],
    geometry: pathGeometry([{ anchors, closed: true }]),
    appearance: emptyAppearance(),
    primitiveHint: 'polygon',
  };
}