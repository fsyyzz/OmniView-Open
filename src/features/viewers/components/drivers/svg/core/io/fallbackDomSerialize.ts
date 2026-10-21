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
import { documentToSvgString } from './import-export';

export function fallbackDomSerialize(
  doc: Document,
  opts?: ExportOptions,
): string {
  return documentToSvgString(doc, opts);
}