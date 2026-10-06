/**
 * OmniView IndexedDB 本地持久化存储引擎 (IndexedDB Storage V2)
 * 纯原生 TypeScript 实现，无任何外部 npm 依赖
 * 1. 工作区文件与元数据持久化 (files)
 * 2. 二进制大对象持久化 (blobs)
 * 3. 在线/离线图表渲染快照持久化缓存池 (render_cache) - 包含 LRU 智能淘汰与 50MB 空间配额守卫
 */
import type { FileItem } from '../types';

export const OMNIVIEW_DB_NAME = 'OmniViewDB';
export const OMNIVIEW_DB_VERSION = 4;

export const STORE_FILES = 'files';
export const STORE_BLOBS = 'blobs';
export const STORE_RENDER_CACHE = 'render_cache';
export const STORE_VIEWER_STATES = 'viewer_states';
export const STORE_LOGS = 'logs';

// 配额与高低水位线阈值配置 (50MB 硬配额)
export const MAX_RENDER_CACHE_BYTES = 50 * 1024 * 1024;      // 50 MB
export const HIGH_WATERMARK_BYTES = 45 * 1024 * 1024;        // 45 MB 触发淘汰
export const TARGET_WATERMARK_BYTES = 35 * 1024 * 1024;      // 35 MB 淘汰至此水位线
export const MAX_RENDER_CACHE_ENTRIES = 2000;                // 最大条目数
export const HIGH_WATERMARK_ENTRIES = 1800;                  // 触发条目淘汰水位
export const TARGET_WATERMARK_ENTRIES = 1400;                // 目标保留条目数

// 日志容量与淘汰限制 (最多保留 1000 条)
export const MAX_LOG_ENTRIES = 1000;
export const TARGET_LOG_ENTRIES = 800;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppLogItem {
  id: string;             // 唯一主键: log_${timestamp}_${seq}
  timestamp: number;      // 毫秒时间戳
  level: LogLevel;        // debug | info | warn | error
  source: string;         // 模块标识: viewer:pdf | render:mermaid | storage:idb 等
  message: string;        // 日志正文
  details?: string;       // 详细信息 / 堆栈
  size: number;           // 预估字节数
}

export interface RenderCacheItem {
  key: string;              // 唯一复合键 (如 cache:render:plantuml:svg:dark:8f2a1b9c)
  engine: string;           // 引擎类型: plantuml | mermaid | graphviz | katex
  format: string;           // 格式: svg | png
  data: string;             // 产物内容 (SVG 文本或 Base64)
  size: number;             // 字节大小估算
  createdAt: number;        // 创建时间
  lastAccessedAt: number;   // 最后命中时间 (用于 LRU 游标排序)
}

export interface ViewerStateItem<T = Record<string, any>> {
  key: string;              // 唯一复合键: viewer:state:${viewerType}:${fileId}
  fileId: string;           // 关联的文件标识
  viewerType: string;       // pdf | csv | epub | audio | video | markdown
  state: T;                 // 状态数据对象 (页码、缩放、列宽、播放时间等)
  size: number;             // 序列化后字节估算
  updatedAt: number;        // 更新时间戳
}

let dbInstancePromise: Promise<IDBDatabase> | null = null;
// 内存 Singleflight 合并字典，防止高频并发重复写入同一个缓存条目
const inFlightSetOperations = new Map<string, Promise<void>>();

/**
 * 检测当前运行环境是否支持原生 IndexedDB
 */
export function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * 获取或初始化 IndexedDB 单例数据库连接
 */
export function getIndexedDB(): Promise<IDBDatabase> {
  if (!isIndexedDbSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in the current environment'));
  }

  if (dbInstancePromise) {
    return dbInstancePromise;
  }

  dbInstancePromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = window.indexedDB.open(OMNIVIEW_DB_NAME, OMNIVIEW_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. 工作区文件对象仓库 (Files Object Store)
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const fileStore = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
          fileStore.createIndex('name', 'name', { unique: false });
          fileStore.createIndex('extension', 'extension', { unique: false });
          fileStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // 2. 二进制大对象仓库 (Blobs Object Store)
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }

        // 3. 图表与在线渲染快照缓存仓库 (Render Cache Object Store)
        if (!db.objectStoreNames.contains(STORE_RENDER_CACHE)) {
          const cacheStore = db.createObjectStore(STORE_RENDER_CACHE, { keyPath: 'key' });
          cacheStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          cacheStore.createIndex('engine', 'engine', { unique: false });
        }

        // 4. 查看器交互与阅读偏好状态仓库 (Viewer States Store - V3 新增)
        if (!db.objectStoreNames.contains(STORE_VIEWER_STATES)) {
          const stateStore = db.createObjectStore(STORE_VIEWER_STATES, { keyPath: 'key' });
          stateStore.createIndex('fileId', 'fileId', { unique: false });
          stateStore.createIndex('viewerType', 'viewerType', { unique: false });
          stateStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 5. 应用运行与诊断日志仓库 (Logs Object Store - V4 新增)
        if (!db.objectStoreNames.contains(STORE_LOGS)) {
          const logStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
          logStore.createIndex('level', 'level', { unique: false });
          logStore.createIndex('source', 'source', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbInstancePromise = null;
        };
        db.onerror = () => {
          dbInstancePromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbInstancePromise = null;
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        console.warn('[OmniViewDB] Database upgrade blocked by another open tab/connection');
      };
    } catch (err) {
      dbInstancePromise = null;
      reject(err);
    }
  });

  return dbInstancePromise;
}

/* =========================================================================
 * 1. 工作区文件 (files) 持久化 API
 * ========================================================================= */

/**
 * 批量异步保存文件集合至 IndexedDB
 */
export async function idbSaveFiles(files: FileItem[]): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_FILES], 'readwrite');
      const store = tx.objectStore(STORE_FILES);

      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const file of files) {
          store.put({
            id: file.id,
            name: file.name,
            path: file.path,
            extension: file.extension,
            content: file.content,
            size: file.size || new TextEncoder().encode(file.content || '').length,
            lastModified: file.lastModified || Date.now(),
            isModified: Boolean(file.isModified),
            isCustomUploaded: Boolean(file.isCustomUploaded),
          });
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed while saving files'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 从 IndexedDB 加载全量工作区文件
 */
export async function idbLoadFiles(): Promise<FileItem[]> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_FILES], 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result as FileItem[];
        resolve(Array.isArray(results) ? results : []);
      };

      req.onerror = () => reject(req.error || new Error('Failed to load files from IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 保存单个文件记录
 */
export async function idbSaveFile(file: FileItem): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_FILES], 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      store.put({
        id: file.id,
        name: file.name,
        path: file.path,
        extension: file.extension,
        content: file.content,
        size: file.size || new TextEncoder().encode(file.content || '').length,
        lastModified: file.lastModified || Date.now(),
        isModified: Boolean(file.isModified),
        isCustomUploaded: Boolean(file.isCustomUploaded),
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 删除单个文件记录
 */
export async function idbDeleteFile(id: string): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_FILES], 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 清空所有文件
 */
export async function idbClearFiles(): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_FILES], 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      store.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/* =========================================================================
 * 2. 二进制大对象 (blobs) 持久化 API
 * ========================================================================= */

export async function idbSaveBlob(id: string, data: Blob | ArrayBuffer): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_BLOBS], 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      store.put({ id, data, updatedAt: Date.now() });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function idbGetBlob(id: string): Promise<Blob | ArrayBuffer | undefined> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_BLOBS], 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve(req.result && req.result.data ? req.result.data : undefined);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function idbDeleteBlob(id: string): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_BLOBS], 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 清空所有二进制媒体大对象
 */
export async function idbClearBlobs(): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_BLOBS], 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      store.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/* =========================================================================
 * 3. 图表渲染快照持久化缓存池 (render_cache) API (带 LRU 智能淘汰与防爆仓)
 * ========================================================================= */

/**
 * 获取渲染快照缓存（命中时异步轻量更新 lastAccessedAt 以维持 LRU 活性）
 */
export async function idbGetRenderCache(key: string): Promise<string | undefined> {
  if (!isIndexedDbSupported()) return undefined;

  try {
    const db = await getIndexedDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_RENDER_CACHE], 'readonly');
        const store = tx.objectStore(STORE_RENDER_CACHE);
        const req = store.get(key);

        req.onsuccess = () => {
          const item = req.result as RenderCacheItem | undefined;
          if (item && item.data) {
            // 异步无阻塞刷新最后访问时间
            touchRenderCacheAccessTime(db, key, item);
            resolve(item.data);
          } else {
            resolve(undefined);
          }
        };

        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  } catch {
    return undefined;
  }
}

/**
 * 轻量刷新条目的最后访问时间戳（Fire-and-forget）
 */
function touchRenderCacheAccessTime(db: IDBDatabase, key: string, item: RenderCacheItem): void {
  try {
    const now = Date.now();
    // 只有距上次访问超过 10 秒才写回，防止极高频密集刷新引起无意义 I/O
    if (now - (item.lastAccessedAt || 0) < 10000) return;

    const tx = db.transaction([STORE_RENDER_CACHE], 'readwrite');
    const store = tx.objectStore(STORE_RENDER_CACHE);
    item.lastAccessedAt = now;
    store.put(item);
  } catch {
    // 静默忽略非关键的元数据写回
  }
}

/**
 * 写入渲染快照缓存
 * 内置 Singleflight 合并与空间配额检查，杜绝重复写入并防范磁盘超标
 */
export async function idbSetRenderCache(params: {
  key: string;
  engine: string;
  format?: string;
  data: string;
  size?: number;
}): Promise<void> {
  if (!isIndexedDbSupported() || !params.data || !params.key) return;

  const { key, engine, format = 'svg', data } = params;
  const size = params.size || new TextEncoder().encode(data).length;

  // 1. Singleflight 并发请求合并：若相同的 key 正在写入，复用进行中的 Promise
  const ongoing = inFlightSetOperations.get(key);
  if (ongoing) {
    return ongoing;
  }

  const writePromise = (async () => {
    try {
      const db = await getIndexedDB();
      const now = Date.now();
      const record: RenderCacheItem = {
        key,
        engine,
        format,
        data,
        size,
        createdAt: now,
        lastAccessedAt: now,
      };

      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_RENDER_CACHE], 'readwrite');
          const store = tx.objectStore(STORE_RENDER_CACHE);
          // put 是天然幂等的：主键存在时原地覆盖更新，绝不重复生成条目
          store.put(record);

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });

      // 2. 写入成功后，异步触发水位线与容量检查（非阻塞执行）
      triggerEvictionCheck(db).catch(() => {});
    } finally {
      inFlightSetOperations.delete(key);
    }
  })();

  inFlightSetOperations.set(key, writePromise);
  return writePromise;
}

/**
 * 触发容量水位线与 LRU 自动淘汰
 */
async function triggerEvictionCheck(db: IDBDatabase): Promise<void> {
  try {
    const stats = await getRenderCacheInternalStats(db);
    // 判断是否越过高水位线 (45MB 或 1800 条)
    if (stats.totalBytes <= HIGH_WATERMARK_BYTES && stats.count <= HIGH_WATERMARK_ENTRIES) {
      return;
    }

    // 启动 LRU 淘汰：基于 idx_lastAccessedAt 索引游标，从最久未访问到最新逐条淘汰
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_RENDER_CACHE], 'readwrite');
        const store = tx.objectStore(STORE_RENDER_CACHE);
        const index = store.index('lastAccessedAt');
        const cursorReq = index.openCursor(); // 默认升序：最久未访问排在最前

        let currentBytes = stats.totalBytes;
        let currentCount = stats.count;

        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) {
            resolve();
            return;
          }

          // 如果已经回落到低水位线 (35MB 且 <= 1400 条)，停止淘汰
          if (currentBytes <= TARGET_WATERMARK_BYTES && currentCount <= TARGET_WATERMARK_ENTRIES) {
            resolve();
            return;
          }

          const item = cursor.value as RenderCacheItem;
          currentBytes -= item.size || 0;
          currentCount--;
          cursor.delete();
          cursor.continue();
        };

        cursorReq.onerror = () => resolve();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // 淘汰出错不阻塞主业务
  }
}

/**
 * 内部读取渲染缓存总览
 */
async function getRenderCacheInternalStats(db: IDBDatabase): Promise<{ count: number; totalBytes: number }> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_RENDER_CACHE], 'readonly');
      const store = tx.objectStore(STORE_RENDER_CACHE);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result as RenderCacheItem[];
        let total = 0;
        if (Array.isArray(items)) {
          for (const item of items) {
            total += item.size || 0;
          }
          resolve({ count: items.length, totalBytes: total });
        } else {
          resolve({ count: 0, totalBytes: 0 });
        }
      };

      req.onerror = () => resolve({ count: 0, totalBytes: 0 });
    } catch {
      resolve({ count: 0, totalBytes: 0 });
    }
  });
}

/**
 * 删除单个渲染缓存项
 */
export async function idbDeleteRenderCache(key: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_RENDER_CACHE], 'readwrite');
      const store = tx.objectStore(STORE_RENDER_CACHE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 清空渲染快照缓存（支持清空全部，或按 engine 分类清理）
 */
export async function idbClearRenderCache(engine?: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_RENDER_CACHE], 'readwrite');
      const store = tx.objectStore(STORE_RENDER_CACHE);

      if (!engine) {
        store.clear();
      } else {
        const idx = store.index('engine');
        const req = idx.openCursor(IDBKeyRange.only(engine));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 获取图表渲染快照缓存的运行统计（用于设置面板直观呈现）
 */
export async function idbGetRenderCacheStats(): Promise<{
  count: number;
  totalBytes: number;
  totalKb: number;
  maxBytes: number;
  percentUsed: number;
}> {
  if (!isIndexedDbSupported()) {
    return { count: 0, totalBytes: 0, totalKb: 0, maxBytes: MAX_RENDER_CACHE_BYTES, percentUsed: 0 };
  }

  try {
    const db = await getIndexedDB();
    const stats = await getRenderCacheInternalStats(db);
    const totalKb = Math.round(stats.totalBytes / 1024 * 10) / 10;
    const percentUsed = Math.min(100, Math.round((stats.totalBytes / MAX_RENDER_CACHE_BYTES) * 1000) / 10);

    return {
      count: stats.count,
      totalBytes: stats.totalBytes,
      totalKb,
      maxBytes: MAX_RENDER_CACHE_BYTES,
      percentUsed,
    };
  } catch {
    return { count: 0, totalBytes: 0, totalKb: 0, maxBytes: MAX_RENDER_CACHE_BYTES, percentUsed: 0 };
  }
}

/* =========================================================================
 * 4. 存储总体统计
 * ========================================================================= */

/**
 * 获取 IndexedDB 存储分析统计信息
 */
export async function idbGetStorageStats(): Promise<{
  supported: boolean;
  fileCount: number;
  blobCount: number;
  renderCacheCount: number;
  totalEstimatedBytes: number;
  filesEstimatedBytes: number;
  renderCacheEstimatedBytes: number;
}> {
  if (!isIndexedDbSupported()) {
    return {
      supported: false,
      fileCount: 0,
      blobCount: 0,
      renderCacheCount: 0,
      totalEstimatedBytes: 0,
      filesEstimatedBytes: 0,
      renderCacheEstimatedBytes: 0,
    };
  }

  try {
    const db = await getIndexedDB();
    const [files, blobCount, renderStats] = await Promise.all([
      idbLoadFiles(),
      new Promise<number>((resolve) => {
        try {
          const tx = db.transaction([STORE_BLOBS], 'readonly');
          const store = tx.objectStore(STORE_BLOBS);
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result || 0);
          countReq.onerror = () => resolve(0);
        } catch {
          resolve(0);
        }
      }),
      getRenderCacheInternalStats(db),
    ]);

    let filesBytes = 0;
    for (const f of files) {
      filesBytes += (f.size || 0) + (f.name?.length || 0) * 2;
    }

    return {
      supported: true,
      fileCount: files.length,
      blobCount,
      renderCacheCount: renderStats.count,
      totalEstimatedBytes: filesBytes + renderStats.totalBytes,
      filesEstimatedBytes: filesBytes,
      renderCacheEstimatedBytes: renderStats.totalBytes,
    };
  } catch {
    return {
      supported: false,
      fileCount: 0,
      blobCount: 0,
      renderCacheCount: 0,
      totalEstimatedBytes: 0,
      filesEstimatedBytes: 0,
      renderCacheEstimatedBytes: 0,
    };
  }
}

/**
 * 生成查看器交互状态唯一主键
 */
export function makeViewerStateKey(viewerType: string, fileId: string): string {
  return `viewer:state:${viewerType.trim().toLowerCase()}:${fileId.trim()}`;
}

/**
 * 获取特定查看器的交互与阅读状态
 */
export async function idbGetViewerState<T = Record<string, any>>(
  viewerType: string,
  fileId: string
): Promise<T | undefined> {
  if (!isIndexedDbSupported() || !viewerType || !fileId) return undefined;
  try {
    const db = await getIndexedDB();
    const key = makeViewerStateKey(viewerType, fileId);
    return new Promise<T | undefined>((resolve) => {
      try {
        const tx = db.transaction([STORE_VIEWER_STATES], 'readonly');
        const store = tx.objectStore(STORE_VIEWER_STATES);
        const req = store.get(key);
        req.onsuccess = () => {
          const item = req.result as ViewerStateItem<T> | undefined;
          resolve(item ? item.state : undefined);
        };
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  } catch {
    return undefined;
  }
}

/**
 * 保存特定查看器的交互与阅读状态
 */
export async function idbSetViewerState<T = Record<string, any>>(
  viewerType: string,
  fileId: string,
  state: T
): Promise<void> {
  if (!isIndexedDbSupported() || !viewerType || !fileId) return;
  try {
    const db = await getIndexedDB();
    const key = makeViewerStateKey(viewerType, fileId);
    let size = 0;
    try {
      size = JSON.stringify(state).length * 2;
    } catch {}

    const item: ViewerStateItem<T> = {
      key,
      fileId,
      viewerType: viewerType.trim().toLowerCase(),
      state,
      size,
      updatedAt: Date.now(),
    };

    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_VIEWER_STATES], 'readwrite');
        const store = tx.objectStore(STORE_VIEWER_STATES);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Failed to set viewer state'));
      } catch (err) {
        reject(err);
      }
    });
  } catch {
    // 降级忽略
  }
}

/**
 * 删除特定文件的查看器状态
 */
export async function idbDeleteViewerState(viewerType: string, fileId: string): Promise<void> {
  if (!isIndexedDbSupported() || !viewerType || !fileId) return;
  try {
    const db = await getIndexedDB();
    const key = makeViewerStateKey(viewerType, fileId);
    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_VIEWER_STATES], 'readwrite');
        const store = tx.objectStore(STORE_VIEWER_STATES);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}

/**
 * 清空查看器交互状态（可按 viewerType 局部清理，不传则全部清空）
 */
export async function idbClearViewerStates(viewerType?: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  try {
    const db = await getIndexedDB();
    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_VIEWER_STATES], 'readwrite');
        const store = tx.objectStore(STORE_VIEWER_STATES);

        if (!viewerType) {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } else {
          const targetType = viewerType.trim().toLowerCase();
          const index = store.index('viewerType');
          const range = IDBKeyRange.only(targetType);
          const req = index.openCursor(range);
          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => reject(req.error);
        }
      } catch (err) {
        reject(err);
      }
    });
  } catch {}
}

/**
 * 统计查看器状态条目数与大小
 */
export async function idbCountViewerStates(): Promise<{ count: number; totalBytes: number }> {
  if (!isIndexedDbSupported()) return { count: 0, totalBytes: 0 };
  try {
    const db = await getIndexedDB();
    return new Promise<{ count: number; totalBytes: number }>((resolve) => {
      try {
        const tx = db.transaction([STORE_VIEWER_STATES], 'readonly');
        const store = tx.objectStore(STORE_VIEWER_STATES);
        let count = 0;
        let totalBytes = 0;
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            count++;
            const item = cursor.value as ViewerStateItem;
            totalBytes += item.size || 64;
            cursor.continue();
          } else {
            resolve({ count, totalBytes });
          }
        };
        req.onerror = () => resolve({ count: 0, totalBytes: 0 });
      } catch {
        resolve({ count: 0, totalBytes: 0 });
      }
    });
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

/* =========================================================================
 * 5. 应用运行与诊断日志持久化 (V4 新增)
 * ========================================================================= */

/**
 * 批量持久化保存日志条目，并执行自动容量守护 (最多保留 1000 条)
 */
export async function idbSaveLogs(items: AppLogItem[]): Promise<void> {
  if (!isIndexedDbSupported() || !items || items.length === 0) return;
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_LOGS], 'readwrite');
        const store = tx.objectStore(STORE_LOGS);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });

    // 检查日志容量守护，超出上限时批量淘汰早期日志
    await triggerLogEviction(db);
  } catch {
    // 降级忽略
  }
}

/**
 * 检查日志容量并在超限时自动淘汰旧日志至安全水位线
 */
async function triggerLogEviction(db: IDBDatabase): Promise<void> {
  try {
    const count = await new Promise<number>((resolve) => {
      try {
        const tx = db.transaction([STORE_LOGS], 'readonly');
        const store = tx.objectStore(STORE_LOGS);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });

    if (count <= MAX_LOG_ENTRIES) return;
    const toDeleteCount = count - TARGET_LOG_ENTRIES;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_LOGS], 'readwrite');
        const store = tx.objectStore(STORE_LOGS);
        const index = store.index('timestamp'); // 时间戳升序：最旧的在前面
        const req = index.openCursor();
        let deleted = 0;

        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor && deleted < toDeleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}

/**
 * 查询历史日志（支持按级别过滤，按时间倒序排列，默认最多 200 条）
 */
export async function idbGetLogs(options?: {
  level?: LogLevel;
  limit?: number;
}): Promise<AppLogItem[]> {
  if (!isIndexedDbSupported()) return [];
  const limit = options?.limit ?? 200;
  const targetLevel = options?.level;

  try {
    const db = await getIndexedDB();
    return new Promise<AppLogItem[]>((resolve) => {
      try {
        const tx = db.transaction([STORE_LOGS], 'readonly');
        const store = tx.objectStore(STORE_LOGS);
        const index = store.index('timestamp');
        // 'prev' 游标：从最新到最旧倒序遍历
        const req = index.openCursor(null, 'prev');
        const results: AppLogItem[] = [];

        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor && results.length < limit) {
            const item = cursor.value as AppLogItem;
            if (!targetLevel || item.level === targetLevel) {
              results.push(item);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

/**
 * 清空所有持久化日志
 */
export async function idbClearLogs(): Promise<void> {
  if (!isIndexedDbSupported()) return;
  try {
    const db = await getIndexedDB();
    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_LOGS], 'readwrite');
        const store = tx.objectStore(STORE_LOGS);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch {}
}

/**
 * 统计日志条目数与估算占用大小
 */
export async function idbCountLogs(): Promise<{ count: number; totalBytes: number }> {
  if (!isIndexedDbSupported()) return { count: 0, totalBytes: 0 };
  try {
    const db = await getIndexedDB();
    return new Promise<{ count: number; totalBytes: number }>((resolve) => {
      try {
        const tx = db.transaction([STORE_LOGS], 'readonly');
        const store = tx.objectStore(STORE_LOGS);
        let count = 0;
        let totalBytes = 0;
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            count++;
            const item = cursor.value as AppLogItem;
            totalBytes += item.size || 128;
            cursor.continue();
          } else {
            resolve({ count, totalBytes });
          }
        };
        req.onerror = () => resolve({ count: 0, totalBytes: 0 });
      } catch {
        resolve({ count: 0, totalBytes: 0 });
      }
    });
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

/**
 * 聚合统计 IndexedDB 整体各仓库状态与估算大小
 */
export async function idbGetStorageSummary(): Promise<{
  supported: boolean;
  fileCount: number;
  blobCount: number;
  renderCacheCount: number;
  viewerStatesCount: number;
  logsCount: number;
  totalEstimatedBytes: number;
  filesEstimatedBytes: number;
  renderCacheEstimatedBytes: number;
  viewerStatesEstimatedBytes: number;
  logsEstimatedBytes: number;
}> {
  if (!isIndexedDbSupported()) {
    return {
      supported: false,
      fileCount: 0,
      blobCount: 0,
      renderCacheCount: 0,
      viewerStatesCount: 0,
      logsCount: 0,
      totalEstimatedBytes: 0,
      filesEstimatedBytes: 0,
      renderCacheEstimatedBytes: 0,
      viewerStatesEstimatedBytes: 0,
      logsEstimatedBytes: 0,
    };
  }

  try {
    const db = await getIndexedDB();
    const [files, blobCount, renderStats, viewerStateStats, logStats] = await Promise.all([
      idbLoadFiles(),
      new Promise<number>((resolve) => {
        try {
          const tx = db.transaction([STORE_BLOBS], 'readonly');
          const store = tx.objectStore(STORE_BLOBS);
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result || 0);
          countReq.onerror = () => resolve(0);
        } catch {
          resolve(0);
        }
      }),
      getRenderCacheInternalStats(db),
      idbCountViewerStates(),
      idbCountLogs(),
    ]);

    let filesBytes = 0;
    for (const f of files) {
      filesBytes += (f.size || 0) + (f.name?.length || 0) * 2;
    }

    return {
      supported: true,
      fileCount: files.length,
      blobCount,
      renderCacheCount: renderStats.count,
      viewerStatesCount: viewerStateStats.count,
      logsCount: logStats.count,
      totalEstimatedBytes: filesBytes + renderStats.totalBytes + viewerStateStats.totalBytes + logStats.totalBytes,
      filesEstimatedBytes: filesBytes,
      renderCacheEstimatedBytes: renderStats.totalBytes,
      viewerStatesEstimatedBytes: viewerStateStats.totalBytes,
      logsEstimatedBytes: logStats.totalBytes,
    };
  } catch {
    return {
      supported: false,
      fileCount: 0,
      blobCount: 0,
      renderCacheCount: 0,
      viewerStatesCount: 0,
      logsCount: 0,
      totalEstimatedBytes: 0,
      filesEstimatedBytes: 0,
      renderCacheEstimatedBytes: 0,
      viewerStatesEstimatedBytes: 0,
      logsEstimatedBytes: 0,
    };
  }
}

/**
 * 获取浏览器/宿主环境的存储配额估算 (navigator.storage.estimate)
 */
export async function getBrowserStorageEstimate(): Promise<{
  supported: boolean;
  quotaBytes: number;
  usageBytes: number;
  quotaFormatted: string;
  usageFormatted: string;
  percentUsed: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota || 0;
      const usage = est.usage || 0;
      const percent = quota > 0 ? Math.min(100, Math.round((usage / quota) * 1000) / 10) : 0;

      const formatSize = (bytes: number) => {
        if (bytes <= 0) return '0 KB';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };

      return {
        supported: true,
        quotaBytes: quota,
        usageBytes: usage,
        quotaFormatted: formatSize(quota),
        usageFormatted: formatSize(usage),
        percentUsed: percent,
      };
    } catch {
      // ignore
    }
  }
  return {
    supported: false,
    quotaBytes: 0,
    usageBytes: 0,
    quotaFormatted: '未知',
    usageFormatted: '未知',
    percentUsed: 0,
  };
}
