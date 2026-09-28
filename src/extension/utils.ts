import type * as vscode from 'vscode';

/** 跨平台 URI 与文件路径归一化匹配判定 (处理 Windows 盘符大小写与多 scheme 兼容) */
export function isSameDocumentUri(a: vscode.Uri | undefined, b: vscode.Uri | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.toString() === b.toString()) return true;
  if (a.scheme === b.scheme && a.fsPath && b.fsPath) {
    return a.fsPath.toLowerCase() === b.fsPath.toLowerCase();
  }
  return false;
}

/** 清理打印文件名（Webview 无法调用 window.print，Host 侧落盘临时 HTML 并用系统浏览器打开） */
export function sanitizePrintFileName(fileName: string): string {
  const leaf = (fileName || 'omniview-print').split(/[/\\]/).pop() || 'omniview-print';
  const cleaned = leaf
    .replace(/[^\w.\u4e00-\u9fff-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  return (cleaned || 'omniview-print').slice(0, 120);
}

export function createLogger(output: vscode.OutputChannel): (message: string, details?: unknown) => void {
  return function log(message: string, details?: unknown): void {
    const suffix = details === undefined ? '' : ` ${details instanceof Error ? details.stack : JSON.stringify(details)}`;
    output?.appendLine(`[${new Date().toISOString()}] ${message}${suffix}`);
    console.log(`[OmniView] ${message}${suffix}`);
  };
}
