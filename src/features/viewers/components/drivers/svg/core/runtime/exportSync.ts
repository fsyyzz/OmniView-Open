/**
 * OmniView SVG 编辑引擎 v2 — 导出回写决策纯函数 (P0 修订)
 *
 * `SvgV2Studio` 的加载/回写时序必须满足（P0-2 数据安全契约）：
 *
 *   1. 加载完成前**绝不**向宿主回写（否则空文档经 `document-change` 落盘清空原文件）；
 *   2. 加载完成瞬间**不**回写（格式化差异会把宿主打 dirty）；
 *   3. 仅文档真实变更（新 Document 对象，结构共享下引用即语义）才回写；
 *   4. 宿主回灌自身输出（echo）时不重复加载；外部真实变更才重载。
 *
 * 全部为纯函数，可独立单测（数据安全准入）。
 */

import type { Document } from '../model/types';

export interface ExportDecisionState {
  /** 是否已完成首次 `loadFromSvg`。 */
  readonly loaded: boolean;
  /** 最近一次导出（或加载基线）的 Document 引用。 */
  readonly lastExportedDoc: Document | null;
  /** 当前是否处于临时手势预览中（手势过程中不导出，释放 Commit 后才导出）。 */
  readonly isInteracting?: boolean;
}

/** 是否应向宿主导出当前文档。 */
export function shouldExport(state: ExportDecisionState, currentDoc: Document): boolean {
  if (state.isInteracting) return false;
  if (!state.loaded) return false;
  if (state.lastExportedDoc === null) return false;
  return currentDoc !== state.lastExportedDoc;
}

/**
 * 是否应从宿主内容（重）加载：
 * - 首次（lastExportedContent 为 null）→ true；
 * - 内容等于自身上次导出（echo）→ false；
 * - 内容与上次导出不同（外部编辑/分屏源码改动）→ true。
 */
export function shouldReloadFromHost(
  lastExportedContent: string | null,
  incoming: string,
): boolean {
  return incoming !== lastExportedContent;
}

/**
 * 是否应写 .bak 备份：首个真实编辑触发一次（组件内 once 标记 + 内容判定）。
 *
 * @param backupWritten 是否已写过（组件内 once 标记）
 * @param firstEditDone 本次导出是否属于「首次文档变更导出」
 */
export function decideBackup(
  backupWritten: boolean,
  firstEditDone: boolean,
  originalContent: string,
  engine: 'v1' | 'v2',
  shouldWriteBackupFn: (content: string, engine: 'v1' | 'v2') => boolean,
): boolean {
  if (backupWritten || !firstEditDone) return false;
  return shouldWriteBackupFn(originalContent, engine);
}
