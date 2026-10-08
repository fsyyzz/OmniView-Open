/**
 * OmniView SVG 编辑引擎 v2 — IO 契约 (ADR-0001)
 *
 * `core/io` 是唯一允许与外部世界（DOM / Worker / WASM）打交道的子层。
 * 它把 SVG 字符串 ↔ Document 双向转换，并对 usvg-wasm 故障做容错。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §2.3
 */

import type { Document } from '../model/types';
import type { ExportOptions, LoadResult } from '../runtime/types';

// ============================================================================
// 1. Import: SVG 字符串 → Document
// ============================================================================

/**
 * 把 SVG 字符串解析为 Document。
 *
 * 实现策略（M1 阶段）：
 * 1. 调用 usvg-wasm Worker（通过 `SvgWasmBridge.requestParse`）做 SVG 归一化；
 *    usvg 会把 transform / clip-path / mask / use / pattern / 多 fill / filter
 *    全部烘焙到几何/属性上。
 * 2. 把 usvg 归一化树走一遍 `usvgTreeToDocument` 转 Document；
 * 3. 若 usvg-wasm 不可用（首次加载失败、Worker 通信错误、浏览器不支持 WASM），
 *    回退到 `fallbackDomParse`（基于浏览器 DOMParser），保证首屏可用。
 *
 * @param svg 待解析的 SVG 字符串
 * @returns Document + 警告（解析失败的图元降级处理）
 */
export declare function importSvg(svg: string): Promise<LoadResult>;

/** Import 内部步骤：归一化树 → Document。 */
export declare function usvgTreeToDocument(tree: UsvgTree): Document;

/** Import 内部步骤：DOMParser 兜底实现。 */
export type { fallbackDomParse as FallbackDomParseFnType } from './fallbackDomParse';

// ============================================================================
// 2. Export: Document → SVG 字符串
// ============================================================================

/**
 * 把 Document 序列化为 SVG 字符串。
 *
 * 实现策略（M1 阶段）：
 * 1. 走 `documentToUsvgTree`（逆 usvg 归一化）；
 * 2. 调 usvg-wasm 的序列化得到最终字符串（与 import 路径同源，保证 round-trip）；
 * 3. 若 usvg-wasm 不可用，回退到 `fallbackDomSerialize`（基于浏览器 DOMParser）；
 * 4. 应用 `ExportOptions`（prettify / minimizeIds / omitHiddenLayers / 缩进）。
 *
 * @param doc 待序列化的文档
 * @param opts 导出选项
 * @returns 格式化后的 SVG 字符串
 */
export declare function exportSvg(doc: Document, opts?: ExportOptions): Promise<string>;

/** Export 内部步骤：Document → 归一化树。 */
export declare function documentToUsvgTree(doc: Document): UsvgTree;

/** Export 内部步骤：DOMSerializer 兜底实现。 */
export type { fallbackDomSerialize as FallbackDomSerializeFnType } from './fallbackDomSerialize';

// ============================================================================
// 3. Round-trip 保证
// ============================================================================

/**
 * Round-trip 测试约定（M1 必须通过的验收）：
 *
 * ```text
 * for sample in corpus:
 *   doc = await importSvg(sample)
 *   out = await exportSvg(doc, { pretty: true })
 *   assert semanticEquivalent(sample, out)   # 语义等价（不强制字节级一致）
 * ```
 *
 * 语义等价 = 渲染像素 hash 一致 + 节点结构（id、kind、几何）一致 + 警告无新增。
 */

// ============================================================================
// 4. usvg 桥接接口
// ============================================================================

/**
 * usvg-wasm 桥接接口。运行时单例（由 `svg.worker.ts` 在首次 import 时
 * 懒加载）。M1 阶段具体实现（worker 文件 + wasm 加载策略）落地。
 */
export interface SvgWasmBridge {
  /** 解析 SVG 字符串为归一化树。 */
  parse(svg: string): Promise<UsvgTree>;
  /** 把归一化树序列化为 SVG 字符串。 */
  serialize(tree: UsvgTree, opts?: { pretty?: boolean; indentSize?: number }): Promise<string>;
  /** 当前是否已就绪。 */
  readonly ready: boolean;
  /** 释放（terminate worker）。 */
  dispose(): void;
}

/** usvg 归一化树（仅声明顶层结构；具体节点类型由 usvg-wasm 定义）。 */
export interface UsvgTree {
  readonly size: { readonly width: number; readonly height: number };
  readonly root: UsvgNode;
  readonly defs: ReadonlyArray<UsvgNode>;
}

export type UsvgNode =
  | UsvgGroupNode
  | UsvgPathNode
  | UsvgImageNode
  | UsvgTextNode
  | UsvgUseNode;

export interface UsvgNodeBase {
  readonly id: string;
  readonly transform: ReadonlyArray<number>; // 6 元素 matrix
  readonly opacity: number;
  readonly visibility: 'visible' | 'hidden' | 'collapse';
  readonly clipPath: string | null;
  readonly mask: string | null;
  readonly filter: string | null;
}

export interface UsvgGroupNode extends UsvgNodeBase {
  readonly kind: 'group';
  readonly children: ReadonlyArray<UsvgNode>;
}

export interface UsvgPathNode extends UsvgNodeBase {
  readonly kind: 'path';
  readonly d: string;
  readonly fill: UsvgFill;
  readonly stroke: UsvgStroke;
}

export interface UsvgImageNode extends UsvgNodeBase {
  readonly kind: 'image';
  readonly href: string;
  readonly width: number;
  readonly height: number;
}

export interface UsvgTextNode extends UsvgNodeBase {
  readonly kind: 'text';
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly fill: UsvgFill;
}

export interface UsvgUseNode extends UsvgNodeBase {
  readonly kind: 'use';
  readonly href: string;
  readonly width: number;
  readonly height: number;
}

export type UsvgFill =
  | { readonly type: 'none' }
  | { readonly type: 'solid'; readonly color: string; readonly opacity: number }
  | { readonly type: 'linear-gradient'; readonly id: string }
  | { readonly type: 'radial-gradient'; readonly id: string }
  | { readonly type: 'pattern'; readonly id: string };

export interface UsvgStroke {
  readonly paint: UsvgFill;
  readonly width: number;
  readonly cap: 'butt' | 'round' | 'square';
  readonly join: 'miter' | 'round' | 'bevel';
  readonly miterLimit: number;
  readonly dashArray: ReadonlyArray<number> | null;
  readonly dashOffset: number;
  readonly alignment: 'center' | 'inside' | 'outside';
}