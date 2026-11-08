export interface VsCodeApi {
  postMessage(message: unknown): void;
}

let cachedVsCodeApi: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (cachedVsCodeApi) return cachedVsCodeApi;
  const acquire = (globalThis as typeof globalThis & { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi;
  if (typeof acquire === 'function') {
    try {
      cachedVsCodeApi = acquire();
    } catch {
      // already acquired or unavailable
    }
  }
  return cachedVsCodeApi;
}

/**
 * 沙箱安全确认辅助函数：
 * 在 VS Code Webview 或受限沙箱 iframe 中，原生 window.confirm 被沙箱策略静默拦截（返回 false）。
 * 此函数在 Webview / 沙箱 iframe 下直接放行用户的显式按钮点击，在独立顶层窗口下保留原生确认。
 */
export function safeConfirm(message: string): boolean {
  if (getVsCodeApi()) {
    return true;
  }
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    if (window.self !== window.top) {
      return true;
    }
    return typeof window.confirm === 'function' ? window.confirm(message) : true;
  } catch {
    return true;
  }
}


