/**
 * OmniView SVG 编辑引擎 v2 — .bak.svg 自动备份 (M6)
 *
 * 任何对 SVG 内容的修改落盘前，先写一份 `*.bak.svg` 备份（v2 引擎标记）。
 * 仅在 Webview 内有效（VS Code 端通过 postMessage 把备份内容传给 extension 落盘）。
 *
 * P1 占位：仅在 console 记录备份意图；M6/M7 接通 VS Code webview 消息桥。
 */

import type { Document } from './model/types';

export interface BackupOptions {
  readonly originalContent: string;
  readonly newContent: string;
  readonly fileName?: string;
}

/**
 * 计算备份策略：若 v1 → v2 引擎迁移，写一份带 `[omniview-v2-engine]` 标记的备份。
 * 否则返回 null，不写备份（避免每次修改都落盘）。
 */
export function shouldWriteBackup(
  originalContent: string,
  _currentEngine: 'v1' | 'v2',
): boolean {
  // 仅当原始内容未带 v2 标记（首次切到 v2）时才写备份
  return !originalContent.includes('[omniview-v2-engine]');
}

/** 生成备份文件名：<原名>.bak.svg。 */
export function backupFileName(original: string): string {
  const trimmed = original.trim();
  if (trimmed.endsWith('.svg')) return trimmed.slice(0, -4) + '.bak.svg';
  return trimmed + '.bak.svg';
}

/** 在备份内容中插入 v2 引擎标记。 */
export function tagBackupContent(content: string, doc: Document, _original: string): string {
  const banner = `<!-- [omniview-v2-engine] auto-backup; ${doc.nodes.size} nodes, ${doc.layers.length} layers; restore via SVG viewer v1 if needed -->\n`;
  if (content.startsWith('<?xml')) {
    return content.replace(/(<\?xml[^>]*\?>)/, `$1\n${banner}`);
  }
  return banner + content;
}

/** P1 stub：实际写入由 VS Code 端消息桥接完成；浏览器内仅记录 console。 */
export function writeBackup(_opts: BackupOptions & { doc: Document }): void {
  if (typeof console !== 'undefined') {
    console.info('[omniview-svg-v2] backup stub: would write', backupFileName(_opts.fileName ?? 'graphic.svg'));
  }
}