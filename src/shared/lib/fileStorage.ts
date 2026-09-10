/**
 * OmniView 工作区文件持久化模块
 */
import { FileItem } from '../types';
import { INITIAL_FILES } from '../data/sampleFiles';

export const FILES_STORAGE_KEY = 'omniview:workbench:files:v2';
const LEGACY_FILES_STORAGE_KEY = 'omniview:workbench:files:v1';

export function loadStoredFiles(): FileItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...INITIAL_FILES];
  }

  try {
    let raw = window.localStorage.getItem(FILES_STORAGE_KEY);
    // 兼容迁移 v1
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_FILES_STORAGE_KEY);
      if (legacy) raw = legacy;
    }

    if (!raw) {
      // 首次加载，写入初始文件集
      saveStoredFiles(INITIAL_FILES);
      return [...INITIAL_FILES];
    }

    const stored = JSON.parse(raw);
    if (Array.isArray(stored) && stored.length > 0) {
      // 过滤并还原合法的文件对象
      const validFiles: FileItem[] = [];

      for (const item of stored) {
        if (!item || typeof item.id !== 'string' || !item.name) continue;
        
        // 如果是预置文件，同步预置文件中可能更新的非易变元数据，但保留用户编辑的 content 与修改状态
        const presetMatch = INITIAL_FILES.find(p => p.id === item.id);
        const content = typeof item.content === 'string' ? item.content : (presetMatch?.content || '');
        const extension = item.extension || presetMatch?.extension || item.name.split('.').pop()?.toLowerCase() || 'txt';

        validFiles.push({
          id: item.id,
          name: item.name,
          path: item.path || `/workspace/${item.name}`,
          extension,
          content,
          size: typeof item.size === 'number' ? item.size : new TextEncoder().encode(content).length,
          lastModified: typeof item.lastModified === 'number' ? item.lastModified : Date.now(),
          isModified: Boolean(item.isModified),
          isCustomUploaded: Boolean(item.isCustomUploaded),
        });
      }

      if (validFiles.length > 0) {
        // 增量补齐 INITIAL_FILES 中新增的官方预设文件（保留用户既有文件与自定义上传）
        let hasNewPresets = false;
        for (let i = 0; i < INITIAL_FILES.length; i++) {
          const preset = INITIAL_FILES[i];
          const exists = validFiles.some(f => f.id === preset.id || f.name === preset.name);
          if (!exists) {
            // 前排重要核心示例插入前部，便于用户在文件树直观发现
            if (i <= 2) {
              validFiles.splice(i, 0, { ...preset });
            } else {
              validFiles.push({ ...preset });
            }
            hasNewPresets = true;
          }
        }
        if (hasNewPresets) {
          saveStoredFiles(validFiles);
        }
        return validFiles;
      }
    }
  } catch (err) {
    console.warn('Failed to load stored files from localStorage, falling back to initial files:', err);
  }

  return [...INITIAL_FILES];
}

export function saveStoredFiles(files: FileItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const storable = files.map(f => ({
      id: f.id,
      name: f.name,
      path: f.path,
      extension: f.extension,
      content: f.content,
      size: f.size || new TextEncoder().encode(f.content).length,
      lastModified: f.lastModified,
      isModified: f.isModified,
      isCustomUploaded: f.isCustomUploaded,
      // 注意：binaryUrl（如 blob:）不序列化，因为它在刷新后失效
    }));
    window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(storable));
  } catch (err) {
    console.warn('Failed to persist files to localStorage:', err);
  }
}

export function resetStoredFiles(): FileItem[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(FILES_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_FILES_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to reset files in localStorage:', err);
    }
  }
  saveStoredFiles(INITIAL_FILES);
  return [...INITIAL_FILES];
}

export function clearStoredFiles(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(FILES_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_FILES_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear files in localStorage:', err);
    }
  }
}

