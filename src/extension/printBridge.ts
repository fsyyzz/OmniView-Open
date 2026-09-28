import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import * as vscode from 'vscode';
import { sanitizePrintFileName } from './utils';

/** Webview 无法调用 window.print；Host 侧落盘临时 HTML 并用系统浏览器打开 */
export async function openPrintableHtmlInBrowser(
  fileName: string,
  html: string,
  log: (message: string, details?: unknown) => void
): Promise<void> {
  if (!html || typeof html !== 'string') {
    throw new Error('Empty printable HTML payload');
  }
  const safeName = sanitizePrintFileName(fileName).replace(/\.html?$/i, '');
  const tmpPath = joinPath(tmpdir(), `omniview-print-${safeName}-${Date.now()}.html`);
  await writeFile(tmpPath, html, 'utf8');
  const opened = await vscode.env.openExternal(vscode.Uri.file(tmpPath));
  if (!opened) {
    throw new Error(`Failed to open printable file: ${tmpPath}`);
  }
  log(`Printable HTML opened in system browser: ${tmpPath} (${html.length} chars)`);
}
