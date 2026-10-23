/**
 * OmniView SVG 编辑引擎 v2 — SVG import / export 真正实现 (M3)
 *
 * - importSvg：调 fallbackDomParse 把 SVG 字符串转为 Document；
 * - exportSvg：把 Document 序列化为 SVG 字符串（直接 XML 字符串拼装，P1 阶段）。
 *
 * M1 阶段已落地的 fallbackDomParse 在此作为主路径；usvg-wasm 路径预留
 * （一旦 public/usvg-wasm/ 产物就绪，自动启用 wasm 路径）。
 */

import type { Document, Node, NodeId } from '../model/types';
import type { LoadResult, ExportOptions } from '../runtime/types';
import { fallbackDomParse } from './fallbackDomParse';
import { RAW_DEFS_METADATA_KEY } from './usvgTreeToDocument';
import { serializePathD } from '../model/path';

export async function importSvg(svg: string): Promise<LoadResult> {
  return fallbackDomParse(svg);
}

export async function exportSvg(doc: Document, opts?: ExportOptions): Promise<string> {
  return documentToSvgString(doc, opts);
}

// ============================================================================
// Document → SVG 字符串（M3 实现：完整序列化）
// ============================================================================

export function documentToSvgString(doc: Document, opts: ExportOptions = {}): string {
  const indentSize = opts.indentSize ?? 2;
  const omitHidden = opts.omitHiddenLayers ?? true;
  const minimizeIds = opts.minimizeIds ?? false;

  const visibleLayers = doc.layers.filter((id) => {
    const l = doc.nodes.get(id);
    return l && (!omitHidden || l.visible);
  });

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  const vb = doc.canvas.viewBox ?? { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height };
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.canvas.width}" height="${doc.canvas.height}" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}">`,
  );

  // <defs> 原样回插（渐变 / clipPath / mask / filter 引用保真）
  const rawDefs = doc.metadata[RAW_DEFS_METADATA_KEY];
  let defsContent = rawDefs ?? '';
  const hasBuiltinMarkers = Array.from(doc.nodes.values()).some(
    (n) =>
      n.kind === 'Path' &&
      (n.markerStart === 'arrow' ||
        n.markerStart === 'dot' ||
        n.markerMid === 'arrow' ||
        n.markerMid === 'dot' ||
        n.markerEnd === 'arrow' ||
        n.markerEnd === 'dot'),
  );
  if (hasBuiltinMarkers && !defsContent.includes('ov-marker-arrow')) {
    defsContent += `\n    <marker id="ov-marker-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" stroke="context-stroke" /></marker>\n    <marker id="ov-marker-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="4" fill="context-stroke" /></marker>`;
  }
  if (defsContent.trim().length > 0) {
    parts.push(`<defs>${defsContent}</defs>`);
  }

  for (const layerId of visibleLayers) {
    const layer = doc.nodes.get(layerId);
    if (!layer || layer.kind !== 'Layer') continue;
    const indent = ' '.repeat(indentSize);
    parts.push(`${indent}<g id="${layerId}" data-omniview-layer="${escapeAttr(layer.name ?? '')}">`);
    for (const childId of layer.children) {
      const child = doc.nodes.get(childId);
      if (!child || !child.visible) continue;
      parts.push(serializeNodeWithDoc(doc, child, indentSize * 2, minimizeIds));
    }
    parts.push(`${indent}</g>`);
  }

  parts.push('</svg>');
  return opts.pretty === false ? parts.join('') : parts.join('\n');
}

function resolveMarkerUrl(marker?: string): string {
  if (!marker || marker === 'none') return '';
  if (marker === 'arrow') return 'url(#ov-marker-arrow)';
  if (marker === 'dot') return 'url(#ov-marker-dot)';
  if (marker.startsWith('url(')) return marker;
  return `url(#${marker.replace(/^#/, '')})`;
}

function serializeCommonAttrs(node: Node): string[] {
  return [
    node.className ? `class="${escapeAttr(node.className)}"` : '',
    node.clipPath ? `clip-path="${escapeAttr(node.clipPath)}"` : '',
    node.mask ? `mask="${escapeAttr(node.mask)}"` : '',
    node.filter ? `filter="${escapeAttr(node.filter)}"` : '',
  ].filter(Boolean);
}

function serializeNodeWithDoc(doc: Document, node: Node, indent: number, minimizeIds: boolean): string {
  const pad = ' '.repeat(indent);
  const id = minimizeIds ? '' : ` id="${node.id}"`;
  const t = serializeTransform(node.transform);
  const commonAttrs = serializeCommonAttrs(node);

  switch (node.kind) {
    case 'Path': {
      const d = serializePathD(node.geometry);
      const fill = node.appearance.items.find((it) => it.kind === 'fill');
      const stroke = node.appearance.items.find((it) => it.kind === 'stroke');
      const mStart = resolveMarkerUrl(node.markerStart);
      const mMid = resolveMarkerUrl(node.markerMid);
      const mEnd = resolveMarkerUrl(node.markerEnd);
      const attrs = [
        `${id}`,
        ...commonAttrs,
        `d="${escapeAttr(d)}"`,
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        fill ? serializeFill(fill) : '',
        stroke ? serializeStroke(stroke) : '',
        mStart ? `marker-start="${escapeAttr(mStart)}"` : '',
        mMid ? `marker-mid="${escapeAttr(mMid)}"` : '',
        mEnd ? `marker-end="${escapeAttr(mEnd)}"` : '',
        node.primitiveHint === 'rect' ? 'data-omniview-hint="rect"' : '',
        node.cornerRadius !== undefined ? `data-omniview-rx="${node.cornerRadius}"` : (node.rx !== undefined ? `data-omniview-rx="${node.rx}"` : ''),
        'data-omniview-kind="Path"',
      ].filter(Boolean);
      return `${pad}<path ${attrs.join(' ')} />`;
    }
    case 'Group': {
      const childParts: string[] = [];
      for (const childId of node.children) {
        const child = doc.nodes.get(childId);
        if (!child || !child.visible) continue;
        childParts.push(serializeNodeWithDoc(doc, child, indent + 2, minimizeIds));
      }
      const attrs = [
        `${id}`,
        ...commonAttrs,
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        'data-omniview-kind="Group"',
      ].filter(Boolean);
      return `${pad}<g ${attrs.join(' ')}>\n${childParts.join('\n')}\n${pad}</g>`;
    }
    case 'Text': {
      const fill = node.appearance.items.find((it) => it.kind === 'fill');
      const attrs = [
        `${id}`,
        ...commonAttrs,
        `x="${node.x ?? 0}"`,
        `y="${node.y ?? 0}"`,
        `font-size="${node.fontSize ?? 16}"`,
        `font-family="${escapeAttr(node.fontFamily ?? 'sans-serif')}"`,
        node.fontWeight ? `font-weight="${escapeAttr(node.fontWeight)}"` : '',
        node.fontStyle ? `font-style="${escapeAttr(node.fontStyle)}"` : '',
        node.textAnchor ? `text-anchor="${node.textAnchor}"` : '',
        node.dominantBaseline ? `dominant-baseline="${escapeAttr(node.dominantBaseline)}"` : '',
        node.letterSpacing ? `letter-spacing="${escapeAttr(node.letterSpacing)}"` : '',
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        fill ? serializeFill(fill) : '',
        'data-omniview-kind="Text"',
      ].filter(Boolean);
      if (node.tspans && node.tspans.length > 0) {
        const inner = node.tspans
          .map((sp) => {
            const spAttrs = [
              sp.x !== undefined ? `x="${sp.x}"` : '',
              sp.y !== undefined ? `y="${sp.y}"` : '',
              sp.dx !== undefined ? `dx="${sp.dx}"` : '',
              sp.dy !== undefined ? `dy="${sp.dy}"` : '',
              sp.fontSize !== undefined ? `font-size="${sp.fontSize}"` : '',
              sp.fontFamily ? `font-family="${escapeAttr(sp.fontFamily)}"` : '',
              sp.fontWeight ? `font-weight="${escapeAttr(sp.fontWeight)}"` : '',
              sp.fontStyle ? `font-style="${escapeAttr(sp.fontStyle)}"` : '',
              sp.textAnchor ? `text-anchor="${sp.textAnchor}"` : '',
              sp.dominantBaseline ? `dominant-baseline="${escapeAttr(sp.dominantBaseline)}"` : '',
              sp.letterSpacing ? `letter-spacing="${escapeAttr(sp.letterSpacing)}"` : '',
              sp.fill ? serializeFill({ fill: sp.fill }) : '',
            ].filter(Boolean);
            return spAttrs.length > 0
              ? `<tspan ${spAttrs.join(' ')}>${escapeText(sp.text)}</tspan>`
              : escapeText(sp.text);
          })
          .join('');
        return `${pad}<text ${attrs.join(' ')}>${inner}</text>`;
      }
      return `${pad}<text ${attrs.join(' ')}>${escapeText(node.text)}</text>`;
    }
    case 'Image': {
      const attrs = [
        `${id}`,
        ...commonAttrs,
        `x="${node.x ?? 0}"`,
        `y="${node.y ?? 0}"`,
        `width="${node.width}"`,
        `height="${node.height}"`,
        `href="${escapeAttr(node.href)}"`,
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        'data-omniview-kind="Image"',
      ].filter(Boolean);
      return `${pad}<image ${attrs.join(' ')} />`;
    }
    case 'Use': {
      const attrs = [
        `${id}`,
        ...commonAttrs,
        `href="${escapeAttr(node.href)}"`,
        node.x !== undefined ? `x="${node.x}"` : '',
        node.y !== undefined ? `y="${node.y}"` : '',
        node.width !== undefined ? `width="${node.width}"` : '',
        node.height !== undefined ? `height="${node.height}"` : '',
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        'data-omniview-kind="Use"',
      ].filter(Boolean);
      return `${pad}<use ${attrs.join(' ')} />`;
    }
    case 'Layer':
      return '';
    default:
      return '';
  }
}

function serializeTransform(t: { a: number; b: number; c: number; d: number; e: number; f: number }): string {
  if (t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0) return '';
  return `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.e} ${t.f})`;
}

function serializeFill(item: any): string {
  if (item.fill.type === 'none') return 'fill="none"';
  if (item.fill.type === 'solid') {
    return `fill="${item.fill.color}" fill-opacity="${item.fill.opacity}"`;
  }
  return `fill="url(#${item.fill.id})"`;
}

function serializeStroke(item: any): string {
  if (item.stroke.paint.type === 'none') return 'stroke="none"';
  const s = item.stroke;
  const parts = [`stroke-width="${s.width}"`, `stroke-linecap="${s.cap}"`, `stroke-linejoin="${s.join}"`];
  if (s.dashArray) parts.push(`stroke-dasharray="${s.dashArray.join(' ')}"`);
  if (s.paint.type === 'solid') {
    parts.push(`stroke="${s.paint.color}" stroke-opacity="${s.paint.opacity}"`);
  } else if (s.paint.type === 'gradient' || s.paint.type === 'pattern') {
    parts.push(`stroke="url(#${s.paint.id})"`);
  }
  return parts.join(' ');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}