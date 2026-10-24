/**
 * 二进制文件 base64 编码工具
 * 将大块 ArrayBuffer 的 base64 编码移至 Web Worker，避免阻塞主线程 UI。
 * 回退到主线程编码（仅当 Worker 创建失败时）。
 */

const MAX_SIZE = 50 * 1024 * 1024; // 50MB 上限

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(new URL('./base64Worker.ts', import.meta.url), { type: 'module' });
        resolve(worker);
      } catch (err) {
        // 某些环境（如 VS Code Webview）可能不支持动态 Worker，回退到主线程
        reject(err);
      }
    });
  }
  return workerPromise;
}

function fallbackEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(binary);
}

/**
 * 将 ArrayBuffer 编码为 base64 字符串（通过 Web Worker，不阻塞主线程）
 * @param arrayBuffer 待编码的二进制数据
 * @returns base64 字符串，超出 MAX_SIZE 时返回空串
 */
export async function encodeBinaryToBase64(arrayBuffer: ArrayBuffer): Promise<string> {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return '';
  if (arrayBuffer.byteLength > MAX_SIZE) return '';

  try {
    const worker = await getWorker();
    return await new Promise<string>((resolve) => {
      let terminated = false;
      const onMessage = (e: MessageEvent<string>) => {
        if (terminated) return;
        terminated = true;
        worker.terminate();
        workerPromise = null;
        resolve(e.data || '');
      };
      const onError = () => {
        if (terminated) return;
        terminated = true;
        worker.terminate();
        workerPromise = null;
        // Worker 失败回退到主线程
        resolve(fallbackEncode(arrayBuffer));
      };
      worker.onmessage = onMessage;
      worker.onerror = onError;
      // 传输 ArrayBuffer（转移所有权，避免复制）
      worker.postMessage(arrayBuffer, [arrayBuffer]);
    });
  } catch {
    // Worker 不可用，回退到主线程
    return fallbackEncode(arrayBuffer);
  }
}
