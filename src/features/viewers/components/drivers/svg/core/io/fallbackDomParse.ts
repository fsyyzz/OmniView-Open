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
import { RAW_DEFS_METADATA_KEY, usvgTreeToDocument } from './usvgTreeToDocument';

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

  // 解析画布尺寸与 viewBox
  const { size, viewBox } = readCanvasGeometry(root);
  // 解析全部 <style> CSS 规则，供节点级联计算
  const cssRules = parseSvgCssRules(root);
  // 递归构建 UsvgTree
  const rootNode = readGroupLike(root, cssRules, size, true);
  const defs = collectDefs(root, cssRules, size);
  // 收集 <defs> 原始片段与顶层 <style>/渐变/滤镜/marker（保证导出和渲染引用不断裂）
  const rawDefs = collectRawDefsHtml(root);

  const tree: UsvgTree = {
    size,
    viewBox,
    root: rootNode,
    defs,
  };

  const document = treeToDocument(tree);
  return {
    document: rawDefs.trim().length > 0
      ? { ...document, metadata: { ...document.metadata, [RAW_DEFS_METADATA_KEY]: rawDefs } }
      : document,
    warnings,
  };
}

// ============================================================================
// 2. 内部辅助：数值/单位、CSS <style> 规则与属性级联
// ============================================================================

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

interface CssRule {
  readonly selector: string;
  readonly specificity: number;
  readonly order: number;
  readonly declarations: ReadonlyMap<string, { value: string; important: boolean }>;
}

const NON_RENDERING_TAGS = new Set([
  'defs',
  'style',
  'metadata',
  'title',
  'desc',
  'lineargradient',
  'radialgradient',
  'filter',
  'marker',
  'clippath',
  'mask',
  'pattern',
]);

const TOP_LEVEL_DEF_TAGS = new Set([
  'style',
  'lineargradient',
  'radialgradient',
  'filter',
  'marker',
  'clippath',
  'mask',
  'pattern',
  'symbol',
]);

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

/** 解析 SVG 数值（支持纯数字、px/pt/em/rem 单位与相对于画布的百分比）。 */
function parseSvgLength(
  raw: string | null | undefined,
  refSize = 0,
  fallback = 0,
): number {
  if (raw === null || raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    if (!Number.isFinite(pct)) return fallback;
    return refSize > 0 ? (pct / 100) * refSize : pct;
  }
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num)) return fallback;
  if (/pt$/i.test(trimmed)) return num * (4 / 3);
  if (/rem$|em$/i.test(trimmed)) return num * 16;
  return num;
}

function parseOptionalSvgLength(
  raw: string | null | undefined,
  refSize = 0,
): number | undefined {
  if (raw === null || raw === undefined || !raw.trim()) return undefined;
  const val = parseSvgLength(raw, refSize, Number.NaN);
  return Number.isFinite(val) ? val : undefined;
}

function parseSvgNumber(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? pct / 100 : fallback;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function readCanvasGeometry(svg: Element): {
  size: CanvasSize;
  viewBox?: { x: number; y: number; width: number; height: number };
} {
  let viewBox: { x: number; y: number; width: number; height: number } | undefined;
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      viewBox = {
        x: parts[0] as number,
        y: parts[1] as number,
        width: parts[2] as number,
        height: parts[3] as number,
      };
    }
  }
  const rawW = svg.getAttribute('width');
  const rawH = svg.getAttribute('height');
  const vbW = viewBox?.width ?? 0;
  const vbH = viewBox?.height ?? 0;
  const w = rawW && !rawW.trim().endsWith('%') ? parseSvgLength(rawW, vbW, vbW) : vbW;
  const h = rawH && !rawH.trim().endsWith('%') ? parseSvgLength(rawH, vbH, vbH) : vbH;
  const finalW = w > 0 ? w : vbW;
  const finalH = h > 0 ? h : vbH;
  return {
    size: { width: finalW, height: finalH },
    viewBox: viewBox ?? (finalW > 0 && finalH > 0 ? { x: 0, y: 0, width: finalW, height: finalH } : undefined),
  };
}

function collectRawDefsHtml(root: Element): string {
  const chunks: string[] = [];
  const defsEls = root.querySelectorAll('defs');
  for (let i = 0; i < defsEls.length; i++) {
    const html = defsEls[i]?.innerHTML?.trim();
    if (html) chunks.push(html);
  }
  // 收集直接挂在 <svg> 下（不在 <defs> 内）的 <style> / 渐变 / marker / filter
  for (let i = 0; i < root.childNodes.length; i++) {
    const child = root.childNodes[i];
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (TOP_LEVEL_DEF_TAGS.has(tag)) {
      chunks.push(el.outerHTML);
    }
  }
  return chunks.join('\n');
}

function parseSvgCssRules(root: Element): CssRule[] {
  const styleEls = root.querySelectorAll('style');
  if (styleEls.length === 0) return [];
  const rules: CssRule[] = [];
  let order = 0;

  for (let i = 0; i < styleEls.length; i++) {
    const rawCss = styleEls[i]?.textContent || '';
    const cleaned = rawCss
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    const ruleRe = /([^{}@]+)\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(cleaned)) !== null) {
      const selectorGroup = (m[1] ?? '').trim();
      const body = (m[2] ?? '').trim();
      if (!selectorGroup || !body) continue;

      const declarations = new Map<string, { value: string; important: boolean }>();
      const declParts = body.split(';');
      for (const part of declParts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx <= 0) continue;
        const prop = part.slice(0, colonIdx).trim().toLowerCase();
        let val = part.slice(colonIdx + 1).trim();
        if (!prop || !val) continue;
        const important = /!\s*important$/i.test(val);
        if (important) {
          val = val.replace(/!\s*important$/i, '').trim();
        }
        declarations.set(prop, { value: val, important });
      }
      if (declarations.size === 0) continue;

      const selectors = selectorGroup.split(',').map((s) => s.trim()).filter(Boolean);
      for (const selector of selectors) {
        rules.push({
          selector,
          specificity: computeSpecificity(selector),
          order: order++,
          declarations,
        });
      }
    }
  }
  return rules;
}

function computeSpecificity(selector: string): number {
  const s = selector.replace(/:not\(([^)]*)\)/g, ' $1 ');
  const ids = (s.match(/#[a-zA-Z0-9_-]+/g) || []).length;
  const classes = (s.match(/\.[a-zA-Z0-9_-]+|\[[^\]]+\]|:[a-zA-Z0-9_-]+/g) || []).length;
  const cleanedTags = s
    .replace(/#[a-zA-Z0-9_-]+/g, ' ')
    .replace(/\.[a-zA-Z0-9_-]+/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/:[a-zA-Z0-9_-]+/g, ' ');
  const tags = (cleanedTags.match(/\b[a-zA-Z][a-zA-Z0-9_-]*\b/g) || []).length;
  return ids * 10000 + classes * 100 + tags;
}

function elementMatchesSelector(el: Element, selector: string): boolean {
  try {
    if (typeof el.matches === 'function') {
      return el.matches(selector);
    }
  } catch {
    // 降级到基础选择器匹配
  }
  const trimmed = selector.trim();
  if (trimmed === '*' || trimmed.toLowerCase() === el.tagName.toLowerCase()) return true;
  if (trimmed.startsWith('.')) {
    const cls = trimmed.slice(1);
    const elClasses = (el.getAttribute('class') || '').split(/\s+/);
    return elClasses.includes(cls);
  }
  if (trimmed.startsWith('#')) {
    return el.getAttribute('id') === trimmed.slice(1);
  }
  return false;
}

function getStyleProp(el: Element, prop: string): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  if (!match || !match[1]) return null;
  return match[1].replace(/!\s*important$/i, '').trim();
}

function getOwnProp(el: Element, prop: string, cssRules: ReadonlyArray<CssRule>): string | null {
  const inlineVal = getStyleProp(el, prop);
  if (inlineVal !== null && inlineVal !== '') return inlineVal;

  let bestVal: string | null = null;
  let bestScore = -1;
  for (const rule of cssRules) {
    const decl = rule.declarations.get(prop);
    if (!decl) continue;
    if (!elementMatchesSelector(el, rule.selector)) continue;
    const score = (decl.important ? 1e8 : 0) + rule.specificity * 1e3 + rule.order;
    if (score >= bestScore) {
      bestScore = score;
      bestVal = decl.value;
    }
  }
  if (bestVal !== null) return bestVal;

  const attrVal = el.getAttribute(prop);
  if (attrVal !== null && attrVal.trim() !== '') return attrVal.trim();
  return null;
}

function getCascadedProp(
  el: Element,
  prop: string,
  cssRules: ReadonlyArray<CssRule>,
  inheritable = true,
): string | null {
  const own = getOwnProp(el, prop, cssRules);
  if (own !== null && own !== 'inherit') return own;
  if (!inheritable) return null;

  let curr = el.parentElement;
  while (curr) {
    const tag = curr.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'head') break;
    const val = getOwnProp(curr, prop, cssRules);
    if (val !== null && val !== 'inherit') return val;
    if (tag === 'svg') break;
    curr = curr.parentElement;
  }
  return null;
}

function hasExplicitFill(el: Element, cssRules: ReadonlyArray<CssRule>): boolean {
  return getOwnProp(el, 'fill', cssRules) !== null || getOwnProp(el, 'fill-opacity', cssRules) !== null;
}

function readTransform(el: Element): number[] {
  const raw = el.getAttribute('transform') || '';
  if (!raw) return [1, 0, 0, 1, 0, 0];
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let m: number[] = [1, 0, 0, 1, 0, 0];
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    matched = true;
    const args = (match[2] ?? '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    m = mulMatrix(m, transformToMatrix((match[1] ?? '').toLowerCase(), args));
  }
  return matched ? m : [1, 0, 0, 1, 0, 0];
}

function transformToMatrix(kind: string, a: number[]): number[] {
  switch (kind) {
    case 'matrix':
      return a.length >= 6 ? a.slice(0, 6) : [1, 0, 0, 1, 0, 0];
    case 'translate':
      return [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
    case 'scale':
      return [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
    case 'rotate': {
      const rad = ((a[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const r = [cos, sin, -sin, cos, 0, 0];
      if (a.length >= 3) {
        const cx = a[1];
        const cy = a[2];
        return mulMatrix(mulMatrix([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
      }
      return r;
    }
    case 'skewX':
      return [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    case 'skewY':
      return [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

/** 矩阵乘法 `a · b`（b 先作用；与 SVG transform 列表左→右组合一致）。 */
function mulMatrix(a: number[], b: number[]): number[] {
  return [
    a[0]! * b[0]! + a[2]! * b[1]!,
    a[1]! * b[0]! + a[3]! * b[1]!,
    a[0]! * b[2]! + a[2]! * b[3]!,
    a[1]! * b[2]! + a[3]! * b[3]!,
    a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
    a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
  ];
}

function readFill(el: Element, cssRules: ReadonlyArray<CssRule>): UsvgFill {
  const tag = el.tagName.toLowerCase();
  if (tag === 'line') {
    return { type: 'none' };
  }
  const fill = getCascadedProp(el, 'fill', cssRules, true);
  const fillOpacity = parseSvgNumber(getCascadedProp(el, 'fill-opacity', cssRules, true), 1);
  if (fill === 'none' || fill === 'transparent') return { type: 'none' };
  if (!fill) {
    if (tag === 'text' || tag === 'tspan') {
      return { type: 'solid', color: '#0f172a', opacity: fillOpacity };
    }
    const stroke = getCascadedProp(el, 'stroke', cssRules, true);
    if (!stroke || stroke === 'none') {
      return { type: 'solid', color: '#000000', opacity: fillOpacity };
    }
    return { type: 'none' };
  }
  if (fill.startsWith('url(')) {
    const id = extractUrlRefId(fill);
    return { type: 'linear-gradient', id };
  }
  return {
    type: 'solid',
    color: fill,
    opacity: fillOpacity,
  };
}

function readStroke(
  el: Element,
  cssRules: ReadonlyArray<CssRule>,
  canvasSize: CanvasSize,
): UsvgStroke {
  const stroke = getCascadedProp(el, 'stroke', cssRules, true);
  const strokeOpacity = parseSvgNumber(getCascadedProp(el, 'stroke-opacity', cssRules, true), 1);
  const strokeWidth = getCascadedProp(el, 'stroke-width', cssRules, true);
  const strokeLinecap = getCascadedProp(el, 'stroke-linecap', cssRules, true);
  const strokeLinejoin = getCascadedProp(el, 'stroke-linejoin', cssRules, true);
  const strokeMiterlimit = getCascadedProp(el, 'stroke-miterlimit', cssRules, true);
  const strokeDasharray = getCascadedProp(el, 'stroke-dasharray', cssRules, true);
  const strokeDashoffset = getCascadedProp(el, 'stroke-dashoffset', cssRules, true);

  return {
    paint: stroke ? readFillAttr(stroke, strokeOpacity) : { type: 'none' },
    width: parseSvgLength(strokeWidth, canvasSize.width, 1),
    cap: (strokeLinecap as 'butt' | 'round' | 'square') || 'butt',
    join: (strokeLinejoin as 'miter' | 'round' | 'bevel') || 'miter',
    miterLimit: parseSvgNumber(strokeMiterlimit, 4),
    dashArray: parseDashArray(strokeDasharray),
    dashOffset: parseSvgLength(strokeDashoffset, canvasSize.width, 0),
    alignment: 'center',
  };
}

function extractUrlRefId(value: string): string {
  return value
    .replace(/^url\(\s*['"]?#?/i, '')
    .replace(/['"]?\s*\)$/, '')
    .trim();
}

function readFillAttr(value: string, opacity = 1): UsvgFill {
  if (!value || value === 'none' || value === 'transparent') return { type: 'none' };
  if (value.startsWith('url(')) {
    const id = extractUrlRefId(value);
    return { type: 'linear-gradient', id };
  }
  return { type: 'solid', color: value, opacity };
}

function readMarkerProp(
  el: Element,
  prop: 'marker-start' | 'marker-mid' | 'marker-end',
  cssRules: ReadonlyArray<CssRule>,
): string | undefined {
  const raw = getCascadedProp(el, prop, cssRules, false) ?? getCascadedProp(el, 'marker', cssRules, false);
  if (!raw || raw === 'none') return undefined;
  if (raw === 'arrow' || raw === 'dot') return raw;
  if (raw.startsWith('url(')) {
    const id = extractUrlRefId(raw);
    if (id === 'ov-marker-arrow') return 'arrow';
    if (id === 'ov-marker-dot') return 'dot';
    return `url(#${id})`;
  }
  return raw;
}

function parseDashArray(raw: string | null): number[] | null {
  if (!raw || raw === 'none') return null;
  const nums = raw
    .split(/[\s,]+/)
    .map((part) => parseFloat(part))
    .filter((n) => Number.isFinite(n));
  return nums.length > 0 ? nums : null;
}

function readTextAnchor(raw: string | null): 'start' | 'middle' | 'end' | undefined {
  if (raw === 'middle' || raw === 'end' || raw === 'start') return raw;
  return undefined;
}

function readGroupLike(
  el: Element,
  cssRules: ReadonlyArray<CssRule>,
  canvasSize: CanvasSize,
  isRoot = false,
): UsvgNode {
  const children: UsvgNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    const tag = c.tagName.toLowerCase();
    if (NON_RENDERING_TAGS.has(tag)) continue;
    if (isRoot && tag === 'g' && c.hasAttribute('data-omniview-layer')) {
      // 解包 OmniView 自身导出的图层包裹 <g data-omniview-layer="...">，避免重复嵌套
      const layerGroup = readGroupLike(c, cssRules, canvasSize, false);
      if (layerGroup.kind === 'group') {
        children.push(...layerGroup.children);
        continue;
      }
    }
    children.push(readNode(c, cssRules, canvasSize));
  }
  return {
    kind: 'group',
    id: el.getAttribute('id') || '',
    className: el.getAttribute('class') || undefined,
    transform: readTransform(el),
    opacity: parseSvgNumber(getCascadedProp(el, 'opacity', cssRules, false), 1),
    visibility:
      (getCascadedProp(el, 'visibility', cssRules, true) as 'visible' | 'hidden' | 'collapse') ||
      'visible',
    clipPath: getCascadedProp(el, 'clip-path', cssRules, false) || null,
    mask: getCascadedProp(el, 'mask', cssRules, false) || null,
    filter: getCascadedProp(el, 'filter', cssRules, false) || null,
    children,
  };
}

function readNode(
  el: Element,
  cssRules: ReadonlyArray<CssRule>,
  canvasSize: CanvasSize,
): UsvgNode {
  const tag = el.tagName.toLowerCase();
  const display = getCascadedProp(el, 'display', cssRules, false);
  const rawVis =
    (getCascadedProp(el, 'visibility', cssRules, true) as 'visible' | 'hidden' | 'collapse') ||
    'visible';
  const base = {
    id: el.getAttribute('id') || '',
    className: el.getAttribute('class') || undefined,
    transform: readTransform(el),
    opacity: parseSvgNumber(getCascadedProp(el, 'opacity', cssRules, false), 1),
    visibility: display === 'none' ? ('hidden' as const) : rawVis,
    clipPath: getCascadedProp(el, 'clip-path', cssRules, false) || null,
    mask: getCascadedProp(el, 'mask', cssRules, false) || null,
    filter: getCascadedProp(el, 'filter', cssRules, false) || null,
  };

  switch (tag) {
    case 'g':
    case 'svg':
    case 'symbol':
    case 'a':
      return readGroupLike(el, cssRules, canvasSize, false);

    case 'path':
      return {
        ...base,
        kind: 'path',
        d: el.getAttribute('d') || '',
        fill: readFill(el, cssRules),
        stroke: readStroke(el, cssRules, canvasSize),
        markerStart: readMarkerProp(el, 'marker-start', cssRules),
        markerMid: readMarkerProp(el, 'marker-mid', cssRules),
        markerEnd: readMarkerProp(el, 'marker-end', cssRules),
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
        d: primitiveToPathD(tag, el, canvasSize),
        fill: readFill(el, cssRules),
        stroke: readStroke(el, cssRules, canvasSize),
        markerStart: readMarkerProp(el, 'marker-start', cssRules),
        markerMid: readMarkerProp(el, 'marker-mid', cssRules),
        markerEnd: readMarkerProp(el, 'marker-end', cssRules),
      };

    case 'image':
      return {
        ...base,
        kind: 'image',
        href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
        x: parseSvgLength(el.getAttribute('x'), canvasSize.width, 0),
        y: parseSvgLength(el.getAttribute('y'), canvasSize.height, 0),
        width: parseSvgLength(el.getAttribute('width'), canvasSize.width, 0),
        height: parseSvgLength(el.getAttribute('height'), canvasSize.height, 0),
      };

    case 'text':
      return readTextElement(el, base, cssRules, canvasSize);

    case 'use':
      return {
        ...base,
        kind: 'use',
        href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
        x: parseSvgLength(el.getAttribute('x'), canvasSize.width, 0),
        y: parseSvgLength(el.getAttribute('y'), canvasSize.height, 0),
        width: parseSvgLength(el.getAttribute('width'), canvasSize.width, 0),
        height: parseSvgLength(el.getAttribute('height'), canvasSize.height, 0),
      };

    default:
      // 未知节点：作为 group 处理
      return { ...base, kind: 'group', children: [] };
  }
}

function readTextElement(
  el: Element,
  base: {
    id: string;
    className?: string;
    transform: number[];
    opacity: number;
    visibility: 'visible' | 'hidden' | 'collapse';
    clipPath: string | null;
    mask: string | null;
    filter: string | null;
  },
  cssRules: ReadonlyArray<CssRule>,
  canvasSize: CanvasSize,
): UsvgNode {
  const x = parseSvgLength(el.getAttribute('x'), canvasSize.width, 0);
  const y = parseSvgLength(el.getAttribute('y'), canvasSize.height, 0);
  const fontSize = parseSvgLength(
    getCascadedProp(el, 'font-size', cssRules, true),
    canvasSize.height,
    16,
  );
  const fontFamily = getCascadedProp(el, 'font-family', cssRules, true) ?? 'sans-serif';
  const fontWeight = getCascadedProp(el, 'font-weight', cssRules, true) ?? undefined;
  const fontStyle = getCascadedProp(el, 'font-style', cssRules, true) ?? undefined;
  const textAnchor = readTextAnchor(getCascadedProp(el, 'text-anchor', cssRules, true));
  const dominantBaseline =
    getCascadedProp(el, 'dominant-baseline', cssRules, true) ??
    getCascadedProp(el, 'alignment-baseline', cssRules, true) ??
    undefined;
  const letterSpacing = getCascadedProp(el, 'letter-spacing', cssRules, true) ?? undefined;
  const fill = readFill(el, cssRules);

  // 检查是否包含 <tspan> 子节点
  let hasTspanElement = false;
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'tspan') {
      hasTspanElement = true;
      break;
    }
  }

  const tspans = hasTspanElement
    ? readTextSpans(el, cssRules, canvasSize)
    : undefined;

  return {
    ...base,
    kind: 'text',
    text: el.textContent || '',
    x,
    y,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    textAnchor,
    dominantBaseline,
    letterSpacing,
    fill,
    tspans,
  };
}

function readTextSpans(
  textEl: Element,
  cssRules: ReadonlyArray<CssRule>,
  canvasSize: CanvasSize,
) {
  const spans: Array<{
    text: string;
    x?: number;
    y?: number;
    dx?: number;
    dy?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAnchor?: 'start' | 'middle' | 'end';
    dominantBaseline?: string;
    letterSpacing?: string;
    fill?: UsvgFill;
  }> = [];

  for (let i = 0; i < textEl.childNodes.length; i++) {
    const child = textEl.childNodes[i];
    if (child.nodeType === 3) {
      const txt = child.nodeValue || '';
      if (txt.length > 0) {
        spans.push({ text: txt });
      }
      continue;
    }
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    if (c.tagName.toLowerCase() !== 'tspan') continue;
    const spanFontSizeRaw = getOwnProp(c, 'font-size', cssRules);
    spans.push({
      text: c.textContent || '',
      x: parseOptionalSvgLength(c.getAttribute('x'), canvasSize.width),
      y: parseOptionalSvgLength(c.getAttribute('y'), canvasSize.height),
      dx: parseOptionalSvgLength(c.getAttribute('dx'), canvasSize.width),
      dy: parseOptionalSvgLength(c.getAttribute('dy'), canvasSize.height),
      fontSize: spanFontSizeRaw ? parseSvgLength(spanFontSizeRaw, canvasSize.height, 16) : undefined,
      fontFamily: getOwnProp(c, 'font-family', cssRules) ?? undefined,
      fontWeight: getOwnProp(c, 'font-weight', cssRules) ?? undefined,
      fontStyle: getOwnProp(c, 'font-style', cssRules) ?? undefined,
      textAnchor: readTextAnchor(getOwnProp(c, 'text-anchor', cssRules)),
      dominantBaseline:
        getOwnProp(c, 'dominant-baseline', cssRules) ??
        getOwnProp(c, 'alignment-baseline', cssRules) ??
        undefined,
      letterSpacing: getOwnProp(c, 'letter-spacing', cssRules) ?? undefined,
      fill: hasExplicitFill(c, cssRules) ? readFill(c, cssRules) : undefined,
    });
  }
  return spans.length > 0 ? spans : undefined;
}

function primitiveToPathD(tag: string, el: Element, canvasSize: CanvasSize): string {
  switch (tag) {
    case 'rect': {
      const x = parseSvgLength(el.getAttribute('x'), canvasSize.width, 0);
      const y = parseSvgLength(el.getAttribute('y'), canvasSize.height, 0);
      const w = parseSvgLength(el.getAttribute('width'), canvasSize.width, 0);
      const h = parseSvgLength(el.getAttribute('height'), canvasSize.height, 0);
      const rxOpt = parseOptionalSvgLength(el.getAttribute('rx'), canvasSize.width);
      const ryOpt = parseOptionalSvgLength(el.getAttribute('ry'), canvasSize.height);
      if (rxOpt === undefined && ryOpt === undefined) return rectPathD(x, y, w, h, 0, 0);
      const rx = rxOpt ?? (ryOpt as number);
      const ry = ryOpt ?? (rxOpt as number);
      return rectPathD(x, y, w, h, Math.min(rx, w / 2), Math.min(ry, h / 2));
    }
    case 'circle': {
      const cx = parseSvgLength(el.getAttribute('cx'), canvasSize.width, 0);
      const cy = parseSvgLength(el.getAttribute('cy'), canvasSize.height, 0);
      const r = parseSvgLength(el.getAttribute('r'), canvasSize.width, 0);
      return ellipsePathD(cx, cy, r, r);
    }
    case 'ellipse': {
      const cx = parseSvgLength(el.getAttribute('cx'), canvasSize.width, 0);
      const cy = parseSvgLength(el.getAttribute('cy'), canvasSize.height, 0);
      const rx = parseSvgLength(el.getAttribute('rx'), canvasSize.width, 0);
      const ry = parseSvgLength(el.getAttribute('ry'), canvasSize.height, 0);
      return ellipsePathD(cx, cy, rx, ry);
    }
    case 'line': {
      const x1 = parseSvgLength(el.getAttribute('x1'), canvasSize.width, 0);
      const y1 = parseSvgLength(el.getAttribute('y1'), canvasSize.height, 0);
      const x2 = parseSvgLength(el.getAttribute('x2'), canvasSize.width, 0);
      const y2 = parseSvgLength(el.getAttribute('y2'), canvasSize.height, 0);
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    case 'polyline':
    case 'polygon': {
      const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      if (pts.length < 4) return '';
      let d = `M ${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) {
        d += ` L ${pts[i]} ${pts[i + 1]}`;
      }
      if (tag === 'polygon') d += ' Z';
      return d;
    }
    default:
      return '';
  }
}

/** 矩形路径（rx/ry = 0 时为直角；>0 时用二次贝塞尔圆角）。 */
function rectPathD(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  if (rx <= 0 || ry <= 0) {
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }
  return [
    `M ${x + rx} ${y}`,
    `L ${x + w - rx} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + ry}`,
    `L ${x + w} ${y + h - ry}`,
    `Q ${x + w} ${y + h} ${x + w - rx} ${y + h}`,
    `L ${x + rx} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - ry}`,
    `L ${x} ${y + ry}`,
    `Q ${x} ${y} ${x + rx} ${y}`,
    'Z',
  ].join(' ');
}

/** 椭圆路径：4 段三次贝塞尔近似（kappa = 0.5522847498）。 */
function ellipsePathD(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rx * 0.5522847498307936;
  const ky = ry * 0.5522847498307936;
  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}`,
    'Z',
  ].join(' ');
}

function collectDefs(
  root: Element,
  cssRules: ReadonlyArray<CssRule>,
  canvasSize: CanvasSize,
): UsvgNode[] {
  const defs: UsvgNode[] = [];
  const defsEl = root.querySelector(':scope > defs');
  if (!defsEl) return defs;
  for (let i = 0; i < defsEl.childNodes.length; i++) {
    const child = defsEl.childNodes[i];
    if (child.nodeType !== 1) continue;
    defs.push(readNode(child as Element, cssRules, canvasSize));
  }
  return defs;
}

// ============================================================================
// 3. treeToDocument：UsvgTree → Document（P0 实装：委托 usvgTreeToDocument）
// ============================================================================

function treeToDocument(tree: UsvgTree): LoadResult['document'] {
  return usvgTreeToDocument(tree);
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
  let vb = { x: 0, y: 0, width: 0, height: 0 };
  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      w = parts[2]!;
      h = parts[3]!;
      vb = { x: parts[0]!, y: parts[1]!, width: w, height: h };
    }
  }
  if (widthMatch && widthMatch[1]) w = Number(widthMatch[1]);
  if (heightMatch && heightMatch[1]) h = Number(heightMatch[1]);
  if (vb.width === 0 && w > 0) vb = { x: 0, y: 0, width: w, height: h };

  doc.canvas = { width: w, height: h, unit: 'px', viewBox: vb };

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