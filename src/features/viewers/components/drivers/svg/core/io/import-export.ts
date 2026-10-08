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

function documentToSvgString(doc: Document, opts: ExportOptions = {}): string {
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

function serializeNodeWithDoc(doc: Document, node: Node, indent: number, minimizeIds: boolean): string {
  const pad = ' '.repeat(indent);
  const id = minimizeIds ? '' : ` id="${node.id}"`;
  const t = serializeTransform(node.transform);

  switch (node.kind) {
    case 'Path': {
      const d = serializePathD(node.geometry);
      const fill = node.appearance.items.find((it) => it.kind === 'fill');
      const stroke = node.appearance.items.find((it) => it.kind === 'stroke');
      const attrs = [
        `${id}`,
        `d="${escapeAttr(d)}"`,
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        fill ? serializeFill(fill) : '',
        stroke ? serializeStroke(stroke) : '',
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
        t ? `transform="${t}"` : '',
        `opacity="${node.opacity}"`,
        'data-omniview-kind="Group"',
      ].filter(Boolean);
      return `${pad}<g ${attrs.join(' ')}>\n${childParts.join('\n')}\n${pad}</g>`;
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
  if (s.paint.type === 'solid') parts.push(`stroke="${s.paint.color}" stroke-opacity="${s.paint.opacity}"`);
  return parts.join(' ');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}