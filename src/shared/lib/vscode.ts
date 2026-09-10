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

