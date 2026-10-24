/**
 * 二进制文件 base64 编码 Web Worker
 * 将大块 ArrayBuffer 的 base64 编码移至后台线程，避免阻塞主线程 UI。
 *
 * 用法：
 *   const worker = new Worker(new URL('./base64Worker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage(arrayBuffer);
 *   worker.onmessage = (e) => { const base64 = e.data; ... };
 */

// 分片编码，避免一次性生成超大字符串导致内存压力
function encodeChunk(chunk: Uint8Array): string {
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < chunk.length; i += CHUNK_SIZE) {
    const slice = chunk.subarray(i, i + CHUNK_SIZE);
    // 用 String.fromCharCode 拼接二进制字符串
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  const arrayBuffer = e.data;
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    (self as unknown as Worker).postMessage('');
    return;
  }

  const bytes = new Uint8Array(arrayBuffer);
  const RESULT_CHUNK = 1024 * 1024; // 每 1MB 分片

  let result = '';
  for (let i = 0; i < bytes.length; i += RESULT_CHUNK) {
    const chunk = bytes.subarray(i, i + RESULT_CHUNK);
    result += encodeChunk(chunk);
  }

  (self as unknown as Worker).postMessage(result);
};
