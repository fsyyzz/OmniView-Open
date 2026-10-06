/**
 * OmniView 工作区文件持久化模块 (File Storage Gateway V2)
 * 采用 IndexedDB 异步引擎 + 内存热缓存 (In-Memory Hot Cache) 双层架构
 * 兼具首屏零延迟加载与数 GB 级大容量非阻塞持久化
 */
import type { FileItem } from '../types';
import { INITIAL_FILES } from '../data/sampleFiles';
import {
  isIndexedDbSupported,
  idbLoadFiles,
  idbSaveFiles,
  idbClearFiles,
  idbSaveBlob,
  idbGetBlob,
  idbDeleteBlob,
} from './indexedDbStorage';

export const FILES_STORAGE_KEY = 'omniview:workbench:files:v2';
const LEGACY_FILES_STORAGE_KEY = 'omniview:workbench:files:v1';
const MIGRATION_FLAG_KEY = 'omniview:workbench:idb_migrated:v1';

// 内存热缓存，确保 React 首屏与同步操作时 0ms 延迟响应
let inMemoryFilesCache: FileItem[] | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 校验并规范化文件数组
 */
function normalizeFiles(rawList: unknown[]): FileItem[] {
  const validFiles: FileItem[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Partial<FileItem>;
    if (!f.id || typeof f.id !== 'string' || !f.name) continue;

    const presetMatch = INITIAL_FILES.find((p) => p.id === f.id);
    const content = typeof f.content === 'string' ? f.content : presetMatch?.content || '';
    const extension = f.extension || presetMatch?.extension || f.name.split('.').pop()?.toLowerCase() || 'txt';

    validFiles.push({
      id: f.id,
      name: f.name,
      path: f.path || `/workspace/${f.name}`,
      extension,
      content,
      size: typeof f.size === 'number' ? f.size : new TextEncoder().encode(content).length,
      lastModified: typeof f.lastModified === 'number' ? f.lastModified : Date.now(),
      isModified: Boolean(f.isModified),
      isCustomUploaded: Boolean(f.isCustomUploaded),
    });
  }
  return validFiles;
}

/**
 * 增量补齐预置官方样例（若用户本地缺失）
 */
function mergeWithPresets(currentFiles: FileItem[]): FileItem[] {
  const result = [...currentFiles];
  let hasNewPresets = false;

  for (let i = 0; i < INITIAL_FILES.length; i++) {
    const preset = INITIAL_FILES[i];
    const exists = result.some((f) => f.id === preset.id || f.name === preset.name);
    if (!exists) {
      if (i <= 2) {
        result.splice(i, 0, { ...preset });
      } else {
        result.push({ ...preset });
      }
      hasNewPresets = true;
    }
  }

  return result;
}

/**
 * 从 LocalStorage 加载文件（作为冷启动兜底或初始同步数据源）
 */
function loadFromLocalStorageFallback(): FileItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...INITIAL_FILES];
  }

  try {
    let raw = window.localStorage.getItem(FILES_STORAGE_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_FILES_STORAGE_KEY);
      if (legacy) raw = legacy;
    }

    if (!raw) {
      return [...INITIAL_FILES];
    }

    const stored = JSON.parse(raw);
    if (Array.isArray(stored) && stored.length > 0) {
      const valid = normalizeFiles(stored);
      if (valid.length > 0) {
        return mergeWithPresets(valid);
      }
    }
  } catch (err) {
    console.warn('[FileStorage] Failed to read from localStorage fallback:', err);
  }

  return [...INITIAL_FILES];
}

/**
 * 同步加载文件（供组件首屏即开即用）
 * 优先读取内存热缓存，未初始化时读取 localStorage 兜底
 */
export function loadStoredFiles(): FileItem[] {
  if (inMemoryFilesCache && inMemoryFilesCache.length > 0) {
    return [...inMemoryFilesCache];
  }

  const loaded = loadFromLocalStorageFallback();
  inMemoryFilesCache = [...loaded];
  return loaded;
}

/**
 * 保存工作区文件（同步接口保持向下兼容，内置防抖异步持久化到 IndexedDB）
 */
export function saveStoredFiles(files: FileItem[]): void {
  // 1. 立即更新内存热缓存
  inMemoryFilesCache = [...files];

  // 2. 尝试轻量兜底同步写入 localStorage（限流防爆仓容错）
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storable = files.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        extension: f.extension,
        content: f.content && f.content.length < 50000 ? f.content : '', // 大文件不阻塞 localStorage
        size: f.size || new TextEncoder().encode(f.content || '').length,
        lastModified: f.lastModified,
        isModified: f.isModified,
        isCustomUploaded: f.isCustomUploaded,
      }));
      window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(storable));
    } catch {
      // 捕获 QuotaExceededError，由于 IndexedDB 承担主存储，因此静默降级
    }
  }

  // 3. 防抖异步落盘至 IndexedDB (200ms)
  if (isIndexedDbSupported()) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    saveDebounceTimer = setTimeout(() => {
      idbSaveFiles(files).catch((err) => {
        console.warn('[FileStorage] Async IDB save failed:', err);
      });
    }, 200);
  }
}

/**
 * 完整异步初始化持久化存储（水合与无感平滑迁移）
 * 1. 优先读取 IndexedDB
 * 2. 若 IndexedDB 为空，检查 LocalStorage 并迁移
 * 3. 同步补齐 INITIAL_FILES
 */
export async function initStorageAsync(): Promise<FileItem[]> {
  if (!isIndexedDbSupported()) {
    const fallback = loadStoredFiles();
    inMemoryFilesCache = fallback;
    return fallback;
  }

  try {
    // 1. 检查 IndexedDB 中的既有文件
    const idbFiles = await idbLoadFiles();
    if (Array.isArray(idbFiles) && idbFiles.length > 0) {
      const valid = normalizeFiles(idbFiles);
      const merged = mergeWithPresets(valid);
      inMemoryFilesCache = merged;
      // 保持 IndexedDB 预置项同步
      if (merged.length !== idbFiles.length) {
        await idbSaveFiles(merged);
      }
      return merged;
    }

    // 2. IndexedDB 为空，触发从 LocalStorage 自动平滑迁移
    const localFallback = loadFromLocalStorageFallback();
    if (localFallback.length > 0) {
      await idbSaveFiles(localFallback);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        // 迁移完成后清空旧版 LocalStorage 中的巨型冗余字符串，彻底释放 5MB 配额
        try {
          window.localStorage.removeItem(LEGACY_FILES_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      inMemoryFilesCache = localFallback;
      return localFallback;
    }
  } catch (err) {
    console.warn('[FileStorage] Error during initStorageAsync, using fallback:', err);
  }

  const initial = [...INITIAL_FILES];
  inMemoryFilesCache = initial;
  try {
    if (isIndexedDbSupported()) {
      await idbSaveFiles(initial);
    }
  } catch {
    // ignore
  }
  return initial;
}

/**
 * 显式完全异步保存全量文件
 */
export async function saveStoredFilesAsync(files: FileItem[]): Promise<void> {
  inMemoryFilesCache = [...files];
  if (isIndexedDbSupported()) {
    await idbSaveFiles(files);
  }
  // 同时同步更新轻量 fallback
  saveStoredFiles(files);
}

/**
 * 重置工作区文件为系统初始预置
 */
export function resetStoredFiles(): FileItem[] {
  inMemoryFilesCache = [...INITIAL_FILES];

  // 同步重置 LocalStorage 兜底与内存缓存
  saveStoredFiles(INITIAL_FILES);

  // 异步清空并重写 IndexedDB
  if (isIndexedDbSupported()) {
    idbSaveFiles(INITIAL_FILES).catch((err) => {
      console.warn('[FileStorage] Failed to reset files in IndexedDB:', err);
    });
  }

  return [...INITIAL_FILES];
}

/**
 * 清空所有文件
 */
export function clearStoredFiles(): void {
  inMemoryFilesCache = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(FILES_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_FILES_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  if (isIndexedDbSupported()) {
    idbClearFiles().catch((err) => {
      console.warn('[FileStorage] Failed to clear files in IndexedDB:', err);
    });
  }
}

/**
 * 保存二进制文件（如 PDF/图片/Word 字节流）
 */
export async function saveBinaryBlob(fileId: string, data: Blob | ArrayBuffer): Promise<void> {
  if (isIndexedDbSupported()) {
    await idbSaveBlob(fileId, data);
  }
}

/**
 * 读取二进制文件
 */
export async function getBinaryBlob(fileId: string): Promise<Blob | ArrayBuffer | undefined> {
  if (isIndexedDbSupported()) {
    return await idbGetBlob(fileId);
  }
  return undefined;
}

/**
 * 删除二进制文件
 */
export async function deleteBinaryBlob(fileId: string): Promise<void> {
  if (isIndexedDbSupported()) {
    await idbDeleteBlob(fileId);
  }
}

/**
 * 获取当前存储引擎与缓存状态
 */
export function getStorageEngineInfo(): {
  engine: 'IndexedDB' | 'LocalStorage (Fallback)';
  supported: boolean;
  hotCacheCount: number;
} {
  const supported = isIndexedDbSupported();
  return {
    engine: supported ? 'IndexedDB' : 'LocalStorage (Fallback)',
    supported,
    hotCacheCount: inMemoryFilesCache ? inMemoryFilesCache.length : 0,
  };
}
