/**
 * 打印桥接：VS Code Webview 内 window.print() 为静默空操作，
 * 插件环境改为 postMessage 交由 Extension Host 落盘并 openExternal；
 * 浏览器环境保留原生打印。
 */
import { getVsCodeApi, type VsCodeApi } from './vscode';

export const PRINT_DOCUMENT_MESSAGE_TYPE = 'print-document' as const;

export interface PrintDocumentMessage {
  type: typeof PRINT_DOCUMENT_MESSAGE_TYPE;
  fileName: string;
  html: string;
}

/** 清理用于临时文件名的片段，防止路径穿越 */
export function sanitizePrintFileName(fileName: string): string {
  const leaf = (fileName || 'omniview-print').split(/[/\\]/).pop() || 'omniview-print';
  const cleaned = leaf
    .replace(/[^\w.\u4e00-\u9fff-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  return (cleaned || 'omniview-print').slice(0, 120);
}

/** 向可打印 HTML 注入自动唤起系统打印对话框的脚本 */
export function injectAutoPrintScript(html: string): string {
  if (/window\.print\s*\(/.test(html)) return html;
  const script = `<script>
(function () {
  function triggerPrint() {
    try { window.focus(); window.print(); } catch (e) { /* ignore */ }
  }
  if (document.readyState === 'complete') {
    setTimeout(triggerPrint, 250);
  } else {
    window.addEventListener('load', function () { setTimeout(triggerPrint, 250); });
  }
})();
</script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${html}${script}`;
}

/** 将单页位图包装为可自动打印的 HTML */
export function buildImagePrintHtml(title: string, dataUrl: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${safeTitle} - OmniView 打印</title>
  <style>
    html, body { margin: 0; background: #fff; }
    body { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
    img { max-width: 100%; height: auto; }
    @media print {
      @page { margin: 10mm; }
      img { max-width: 100%; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="${safeTitle}" />
</body>
</html>`;
}

/**
 * 请求打印 HTML 文档。
 * - VS Code Webview：交 Extension Host 写临时文件并用系统浏览器打开
 * - 普通浏览器：默认走 window.print()（保留页面 @media print 样式）
 */
export function requestPrintHtml(
  fileName: string,
  html: string,
  options?: { vscode?: VsCodeApi; preferNativeInBrowser?: boolean }
): boolean {
  const api = options?.vscode ?? getVsCodeApi();
  if (api) {
    const message: PrintDocumentMessage = {
      type: PRINT_DOCUMENT_MESSAGE_TYPE,
      fileName: sanitizePrintFileName(fileName),
      html: injectAutoPrintScript(html),
    };
    api.postMessage(message);
    return true;
  }

  const preferNative = options?.preferNativeInBrowser !== false;
  if (preferNative) {
    window.print();
    return true;
  }

  const blob = new Blob([injectAutoPrintScript(html)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    window.print();
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** 请求打印位图页（PDF 当前页等） */
export function requestPrintImage(
  fileName: string,
  dataUrl: string,
  options?: { vscode?: VsCodeApi }
): boolean {
  const html = buildImagePrintHtml(fileName, dataUrl);
  return requestPrintHtml(fileName, html, {
    vscode: options?.vscode,
    preferNativeInBrowser: false,
  });
}
