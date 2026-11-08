/**
 * OmniView SVG 编辑引擎 v2 — 渐变 (Gradients)、滤镜特效 (Filters) 与文档调色板模型 (P1: SVG-04 / SVG-05 / SVG-06)
 *
 * 职责：
 * - 解析与合成 `<defs>` 中的 `<linearGradient>` / `<radialGradient>`，支持多色标与角度控制
 * - 解析与合成 `<defs>` 中的 `<filter>` 阴影/发光/模糊预设（柔和投影、悬浮弥散、外发光、高斯模糊）
 * - 提取当前文档中所有图元正在使用的主色板，供吸管工具与调色板一键复用
 */

import type { Color, Document, Fill, NodeId } from './types';
import { RAW_DEFS_METADATA_KEY } from '../io/usvgTreeToDocument';
import { updateNode } from './document';

// ============================================================================
// 1. 渐变模型与预设 (SVG-04)
// ============================================================================

export interface GradientStop {
  readonly offset: number; // 0 ~ 100 (%)
  readonly color: Color;
  readonly opacity?: number; // 0 ~ 1
}

export interface GradientConfig {
  readonly id: string;
  readonly kind: 'linear' | 'radial';
  /** 线性渐变角度 (0~360 度，0 度为从左到右，90 度为从上到下) */
  readonly angleDeg: number;
  readonly stops: ReadonlyArray<GradientStop>;
}

export interface GradientPreset {
  readonly name: string;
  readonly kind: 'linear' | 'radial';
  readonly angleDeg: number;
  readonly stops: ReadonlyArray<GradientStop>;
}

export const GRADIENT_PRESETS: ReadonlyArray<GradientPreset> = [
  {
    name: '科技蓝紫',
    kind: 'linear',
    angleDeg: 135,
    stops: [
      { offset: 0, color: '#3b82f6', opacity: 1 },
      { offset: 100, color: '#8b5cf6', opacity: 1 },
    ],
  },
  {
    name: '翡翠青绿',
    kind: 'linear',
    angleDeg: 135,
    stops: [
      { offset: 0, color: '#10b981', opacity: 1 },
      { offset: 100, color: '#06b6d4', opacity: 1 },
    ],
  },
  {
    name: '日落琥珀',
    kind: 'linear',
    angleDeg: 135,
    stops: [
      { offset: 0, color: '#f59e0b', opacity: 1 },
      { offset: 100, color: '#ef4444', opacity: 1 },
    ],
  },
  {
    name: '霓虹洋红',
    kind: 'linear',
    angleDeg: 135,
    stops: [
      { offset: 0, color: '#ec4899', opacity: 1 },
      { offset: 100, color: '#6366f1', opacity: 1 },
    ],
  },
  {
    name: '暗夜金属',
    kind: 'linear',
    angleDeg: 90,
    stops: [
      { offset: 0, color: '#334155', opacity: 1 },
      { offset: 100, color: '#0f172a', opacity: 1 },
    ],
  },
  {
    name: '径向高光球',
    kind: 'radial',
    angleDeg: 0,
    stops: [
      { offset: 0, color: '#60a5fa', opacity: 1 },
      { offset: 100, color: '#1d4ed8', opacity: 1 },
    ],
  },
];

/** 将角度 (0~360°) 转换为 SVG `<linearGradient>` 的 x1,y1,x2,y2 百分比坐标 */
export function angleToLinearCoords(angleDeg: number): { x1: string; y1: string; x2: string; y2: string } {
  const rad = ((angleDeg % 360) * Math.PI) / 180;
  const vx = Math.cos(rad);
  const vy = Math.sin(rad);
  const r = (n: number) => `${Math.round(n * 10) / 10}%`;
  return {
    x1: r(50 - vx * 50),
    y1: r(50 - vy * 50),
    x2: r(50 + vx * 50),
    y2: r(50 + vy * 50),
  };
}

/** 从 x1,y1,x2,y2 百分比反推线性渐变角度 */
export function linearCoordsToAngle(x1: number, y1: number, x2: number, y2: number): number {
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

/** 构造单个 `<linearGradient>` 或 `<radialGradient>` XML 字符串 */
export function buildGradientXml(config: GradientConfig): string {
  const stopsXml = config.stops
    .map((s) => {
      const off = Math.max(0, Math.min(100, Math.round(s.offset)));
      const op = s.opacity !== undefined && s.opacity < 1 ? ` stop-opacity="${s.opacity}"` : '';
      return `<stop offset="${off}%" stop-color="${s.color}"${op} />`;
    })
    .join('');

  if (config.kind === 'radial') {
    return `<radialGradient id="${config.id}" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">${stopsXml}</radialGradient>`;
  }
  const { x1, y1, x2, y2 } = angleToLinearCoords(config.angleDeg);
  return `<linearGradient id="${config.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml}</linearGradient>`;
}

/** 从 rawDefs 中解析指定 id 的渐变配置 */
export function parseGradientFromDefs(rawDefs: string, gradId: string): GradientConfig | null {
  if (!rawDefs || !gradId) return null;
  const cleanId = gradId.replace(/^url\(#?|['")\s]/g, '');
  const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRegex = new RegExp(
    `<(linearGradient|radialGradient)\\b([^>]*\\bid=["']${escapedId}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'i',
  );
  const match = rawDefs.match(tagRegex);
  if (!match) return null;

  const tagName = match[1]!.toLowerCase();
  const attrs = match[2]!;
  const body = match[3]!;
  const kind: 'linear' | 'radial' = tagName === 'radialgradient' ? 'radial' : 'linear';

  const readPct = (name: string, fallback: number): number => {
    const m = attrs.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
    if (!m) return fallback;
    const raw = m[1]!.trim();
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return fallback;
    return raw.endsWith('%') ? num : num <= 1 ? num * 100 : num;
  };

  const angleDeg =
    kind === 'linear'
      ? linearCoordsToAngle(
          readPct('x1', 0),
          readPct('y1', 0),
          readPct('x2', 100),
          readPct('y2', 0),
        )
      : 0;

  const stops: GradientStop[] = [];
  const stopRegex = /<stop\b([^>]*)\/?>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = stopRegex.exec(body)) !== null) {
    const sAttrs = sm[1]!;
    const offMatch = sAttrs.match(/\boffset=["']([^"']+)["']/i);
    const colMatch = sAttrs.match(/\bstop-color=["']([^"']+)["']/i);
    const opMatch = sAttrs.match(/\bstop-opacity=["']([^"']+)["']/i);
    let offset = 0;
    if (offMatch) {
      const rawOff = offMatch[1]!.trim();
      const n = parseFloat(rawOff);
      if (Number.isFinite(n)) {
        offset = rawOff.endsWith('%') ? n : n <= 1 ? n * 100 : n;
      }
    }
    const color = colMatch ? colMatch[1]!.trim() : '#3b82f6';
    const opacity = opMatch ? parseFloat(opMatch[1]!) : 1;
    stops.push({ offset, color, opacity: Number.isFinite(opacity) ? opacity : 1 });
  }

  if (stops.length === 0) {
    stops.push(
      { offset: 0, color: '#3b82f6', opacity: 1 },
      { offset: 100, color: '#8b5cf6', opacity: 1 },
    );
  }

  return { id: cleanId, kind, angleDeg, stops };
}

/** 在 rawDefs 中插入或更新指定 id 的渐变定义 */
export function upsertGradientInDefs(rawDefs: string, config: GradientConfig): string {
  const xml = buildGradientXml(config);
  const escapedId = config.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingRegex = new RegExp(
    `<(?:linearGradient|radialGradient)\\b[^>]*\\bid=["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/(?:linearGradient|radialGradient)>`,
    'i',
  );
  if (existingRegex.test(rawDefs)) {
    return rawDefs.replace(existingRegex, xml);
  }
  return rawDefs.trim() ? `${rawDefs.trim()}\n${xml}` : xml;
}

/** 为选中图元应用线性/径向渐变填充或描边 */
export function applyGradientToNodes(
  doc: Document,
  ids: ReadonlyArray<NodeId>,
  target: 'fill' | 'stroke',
  config: Omit<GradientConfig, 'id'> & { id?: string },
): Document {
  if (ids.length === 0) return doc;
  const gradId = config.id || `ov-grad-${target}-${ids[0]}`;
  const fullConfig: GradientConfig = {
    id: gradId,
    kind: config.kind,
    angleDeg: config.angleDeg,
    stops: config.stops,
  };
  const prevDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';
  const nextDefs = upsertGradientInDefs(prevDefs, fullConfig);

  let nextDoc: Document = {
    ...doc,
    metadata: { ...doc.metadata, [RAW_DEFS_METADATA_KEY]: nextDefs },
    _internal: { revision: doc._internal.revision + 1 },
  };

  const paintRef: Fill = { type: 'gradient', id: gradId };
  for (const id of ids) {
    if (!nextDoc.nodes.has(id)) continue;
    nextDoc = updateNode(nextDoc, id, (n) => {
      if (n.kind !== 'Path' && n.kind !== 'Group' && n.kind !== 'Text') return n;
      if (target === 'fill') {
        const items = (n as any).appearance.items.map((it: any) =>
          it.kind === 'fill' ? { ...it, fill: paintRef } : it,
        );
        if (!items.some((it: any) => it.kind === 'fill')) {
          items.unshift({ kind: 'fill', fill: paintRef, blend: 'normal', opacity: 1 });
        }
        return { ...(n as any), appearance: { items } };
      } else {
        if (n.kind === 'Text') return n;
        const items = (n as any).appearance.items.map((it: any) =>
          it.kind === 'stroke' ? { ...it, stroke: { ...it.stroke, paint: paintRef } } : it,
        );
        return { ...(n as any), appearance: { items } };
      }
    });
  }
  return nextDoc;
}

// ============================================================================
// 2. 滤镜与阴影预设模型 (SVG-05)
// ============================================================================

export type FilterPresetId = 'none' | 'drop-shadow-sm' | 'drop-shadow-lg' | 'glow' | 'blur';

export interface FilterEffectConfig {
  readonly preset: FilterPresetId;
  readonly dx: number;
  readonly dy: number;
  readonly stdDeviation: number;
  readonly color: string;
  readonly opacity: number;
}

export const FILTER_PRESET_DEFAULTS: Record<Exclude<FilterPresetId, 'none'>, FilterEffectConfig> = {
  'drop-shadow-sm': {
    preset: 'drop-shadow-sm',
    dx: 0,
    dy: 4,
    stdDeviation: 6,
    color: '#0f172a',
    opacity: 0.22,
  },
  'drop-shadow-lg': {
    preset: 'drop-shadow-lg',
    dx: 0,
    dy: 10,
    stdDeviation: 16,
    color: '#0f172a',
    opacity: 0.35,
  },
  glow: {
    preset: 'glow',
    dx: 0,
    dy: 0,
    stdDeviation: 8,
    color: '#3b82f6',
    opacity: 0.75,
  },
  blur: {
    preset: 'blur',
    dx: 0,
    dy: 0,
    stdDeviation: 4,
    color: '#000000',
    opacity: 1,
  },
};

/** 构造 `<filter>` XML 字符串（使用标准 SVG 1.1 filter 原语保证所有渲染器 100% 兼容） */
export function buildFilterXml(filterId: string, cfg: FilterEffectConfig): string {
  const std = Math.max(0, Math.round(cfg.stdDeviation * 10) / 10);
  if (cfg.preset === 'blur') {
    return `<filter id="${filterId}" x="-25%" y="-25%" width="150%" height="150%" data-ov-preset="blur"><feGaussianBlur in="SourceGraphic" stdDeviation="${std}" /></filter>`;
  }
  const dx = Math.round(cfg.dx * 10) / 10;
  const dy = Math.round(cfg.dy * 10) / 10;
  const op = Math.max(0, Math.min(1, Math.round(cfg.opacity * 100) / 100));
  return `<filter id="${filterId}" x="-35%" y="-35%" width="170%" height="170%" data-ov-preset="${cfg.preset}"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${std}" flood-color="${cfg.color}" flood-opacity="${op}" /></filter>`;
}

/** 从 rawDefs 中解析指定 filter 引用（如 `url(#ov-filter-1)`）的参数 */
export function parseFilterFromDefs(rawDefs: string, filterAttr: string | null | undefined): FilterEffectConfig {
  if (!rawDefs || !filterAttr || filterAttr === 'none') {
    return { preset: 'none', dx: 0, dy: 4, stdDeviation: 6, color: '#0f172a', opacity: 0.25 };
  }
  const cleanId = filterAttr.replace(/^url\(#?|['")\s]/g, '');
  const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = new RegExp(`<filter\\b([^>]*\\bid=["']${escapedId}["'][^>]*)>([\\s\\S]*?)<\\/filter>`, 'i');
  const m = rawDefs.match(reg);
  if (!m) {
    return { preset: 'drop-shadow-sm', dx: 0, dy: 4, stdDeviation: 6, color: '#0f172a', opacity: 0.25 };
  }
  const attrs = m[1]!;
  const body = m[2]!;
  const presetMatch = attrs.match(/\bdata-ov-preset=["']([^"']+)["']/i);
  const preset = (presetMatch?.[1] as FilterPresetId) || (body.includes('feDropShadow') ? 'drop-shadow-sm' : 'blur');

  const numAttr = (src: string, name: string, fb: number) => {
    const mm = src.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
    const v = mm ? parseFloat(mm[1]!) : NaN;
    return Number.isFinite(v) ? v : fb;
  };
  const strAttr = (src: string, name: string, fb: string) => {
    const mm = src.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
    return mm ? mm[1]!.trim() : fb;
  };

  return {
    preset,
    dx: numAttr(body, 'dx', 0),
    dy: numAttr(body, 'dy', preset === 'glow' ? 0 : 4),
    stdDeviation: numAttr(body, 'stdDeviation', 6),
    color: strAttr(body, 'flood-color', preset === 'glow' ? '#3b82f6' : '#0f172a'),
    opacity: numAttr(body, 'flood-opacity', 0.25),
  };
}

/** 在 rawDefs 中插入或更新指定 id 的 `<filter>` */
export function upsertFilterInDefs(rawDefs: string, filterId: string, cfg: FilterEffectConfig): string {
  const xml = buildFilterXml(filterId, cfg);
  const escapedId = filterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingRegex = new RegExp(
    `<filter\\b[^>]*\\bid=["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/filter>`,
    'i',
  );
  if (existingRegex.test(rawDefs)) {
    return rawDefs.replace(existingRegex, xml);
  }
  return rawDefs.trim() ? `${rawDefs.trim()}\n${xml}` : xml;
}

/** 为选中图元设置或清除 SVG 滤镜特效 */
export function applyFilterToNodes(
  doc: Document,
  ids: ReadonlyArray<NodeId>,
  cfg: FilterEffectConfig,
): Document {
  if (ids.length === 0) return doc;
  if (cfg.preset === 'none') {
    let nextDoc = doc;
    for (const id of ids) {
      if (!nextDoc.nodes.has(id)) continue;
      nextDoc = updateNode(nextDoc, id, (n) => ({ ...n, filter: null }));
    }
    return nextDoc;
  }

  const filterId = `ov-filter-${ids[0]}`;
  const prevDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';
  const nextDefs = upsertFilterInDefs(prevDefs, filterId, cfg);

  let nextDoc: Document = {
    ...doc,
    metadata: { ...doc.metadata, [RAW_DEFS_METADATA_KEY]: nextDefs },
    _internal: { revision: doc._internal.revision + 1 },
  };

  const filterUrl = `url(#${filterId})`;
  for (const id of ids) {
    if (!nextDoc.nodes.has(id)) continue;
    nextDoc = updateNode(nextDoc, id, (n) => ({ ...n, filter: filterUrl }));
  }
  return nextDoc;
}

// ============================================================================
// 3. 文档画布取色器辅助：提取当前文档已用色彩集合 (SVG-06)
// ============================================================================

export function extractDocumentColorPalette(doc: Document): ReadonlyArray<string> {
  const colors = new Set<string>();
  for (const node of doc.nodes.values()) {
    if (node.kind === 'Path' || node.kind === 'Text' || node.kind === 'Group') {
      for (const item of node.appearance.items) {
        if (item.kind === 'fill' && item.fill.type === 'solid' && item.fill.color) {
          colors.add(item.fill.color.toLowerCase());
        } else if (item.kind === 'stroke' && item.stroke.paint.type === 'solid' && item.stroke.paint.color) {
          colors.add(item.stroke.paint.color.toLowerCase());
        }
      }
    }
  }
  return Array.from(colors).slice(0, 16);
}
