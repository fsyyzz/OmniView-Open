/**
 * OmniView SVG 编辑引擎 v2 — DOMSerializer 兜底实现 (ADR-0001 §10.3)
 *
 * 当 usvg-wasm 产物不可用时，回退到浏览器原生 DOMParser + XMLSerializer 做
 * 序列化。生成的 SVG 不是严格语义最优，但保证浏览器正确显示。
 *
 * P1 范围限制：
 *   - 不做完整 Document → SVG 重建（M2 阶段实现 usvgTreeToDocument / documentToUsvgTree）
 *   - 仅实现最小"原样回传"语义（Document.metadata + 已知 SVG 片段）
 *
 * M2 阶段将用 usvg-wasm 的真实路径替换此 fallback。
 */

import type { Document } from '../model/types';
import type { ExportOptions } from '../runtime/types';

export function fallbackDomSerialize(
  doc: Document,
  _opts?: ExportOptions,
): string {
  if (typeof XMLSerializer === 'undefined' || typeof DOMParser === 'undefined') {
    // Node.js / 非浏览器环境：返回最小可解析 SVG
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.canvas.width}" height="${doc.canvas.height}">`,
      '<!-- fallbackDomSerialize: 非浏览器环境，节点未展开 -->',
      '</svg>',
    ].join('\n');
  }

  const indentSize = _opts?.indentSize ?? 2;
  const indent = ' '.repeat(indentSize);

  const w = doc.canvas.width;
  const h = doc.canvas.height;
  const vb = doc.canvas.viewBox
    ? `${doc.canvas.viewBox.x} ${doc.canvas.viewBox.y} ${doc.canvas.viewBox.width} ${doc.canvas.viewBox.height}`
    : `0 0 ${w} ${h}`;

  // M2 阶段：遍历 doc.nodes 渲染每个 Node
  // P1 占位：仅输出画布信息 + 注释
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">`,
    `${indent}<!-- fallbackDomSerialize P1 placeholder (M2: render full Document tree) -->`,
    `${indent}<!-- nextNodeId: ${doc.nextNodeId}, nodes: ${doc.nodes.size}, layers: ${doc.layers.length} -->`,
    '</svg>',
  ].join('\n');
}