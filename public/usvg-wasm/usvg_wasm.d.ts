/**
 * OmniView usvg-wasm 产物占位声明 (ADR-0001 §10)
 *
 * 实际产物由 `scripts/build-usvg-wasm.mjs` 在构建时通过 wasm-pack 生成
 * （`usvg_wasm.js` / `usvg_wasm_bg.wasm` / `usvg_wasm.d.ts`）。
 *
 * 本文件仅为占位声明，避免 TypeScript 在产物未生成时报告模块缺失。
 * 真实构建时，wasm-pack 会用同名 .d.ts 覆盖此文件。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §10
 */

export default function init(input?: unknown): Promise<void>;
export function parse_svg(svg: string): string;
export function serialize_tree(treeJson: string): string;
export function ping(): string;