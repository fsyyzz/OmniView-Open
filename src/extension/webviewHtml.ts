import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import * as vscode from 'vscode';

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialData?: Record<string, unknown>,
  log?: (message: string, details?: unknown) => void
): string {
  let htmlPath = vscode.Uri.joinPath(extensionUri, 'dist', 'index.html');
  let assetsBase = vscode.Uri.joinPath(extensionUri, 'dist', 'assets');
  if (!existsSync(htmlPath.fsPath)) {
    htmlPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.html');
    assetsBase = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets');
  }
  log?.(`Loading Webview HTML: ${htmlPath.fsPath}`);
  if (!existsSync(htmlPath.fsPath)) {
    throw new Error(
      `Webview HTML not found: ${htmlPath.fsPath}. ` +
        'VSIX 可能未打入 dist/index.html 与 dist/assets（检查 .vscodeignore 与 npm run build:plugin）。'
    );
  }
  const html = readFileSync(htmlPath.fsPath, 'utf8');
  const safeJson = initialData ? JSON.stringify(initialData).replace(/</g, '\\u003c') : '';
  const initialDataScript = safeJson ? `<script id="omniview-initial-data" type="application/json">${safeJson}</script>` : '';
  return html
    .replace(/(src|href)="(\.\/)?assets\//g, (_match: string, attribute: string) => `${attribute}="${webview.asWebviewUri(assetsBase)}/`)
    .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http://localhost:* http://127.0.0.1:* data: vscode-resource: vscode-webview-resource: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; worker-src ${webview.cspSource} blob: data:; connect-src https: http://localhost:* http://127.0.0.1:* data: blob:;">`)
    .replace('</body>', `${initialDataScript}<script>window.__OMNIVIEW_VSCODE__ = true;</script></body>`);
}
