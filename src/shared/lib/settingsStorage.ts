// OmniView Workbench Settings Persistence Service

import { ThemeId, ViewMode, DensityMode, WorkbenchSettings, WorkbenchView, ContentWidthMode } from '../types';

export const SETTINGS_STORAGE_KEY = 'omniview:workbench:settings:v2';
const LEGACY_STORAGE_KEY = 'omniview:workbench:settings:v1';

export const DEFAULT_SETTINGS: WorkbenchSettings = {
  // 1. 外观与主题
  theme: 'dark',
  density: 'compact',
  locale: 'zh-CN',

  // 2. 视图与视口
  currentView: 'editor',
  viewMode: 'preview',
  zoom: 1.0,
  contentWidth: 'standard',
  fontSize: 15,
  outlineOpen: true,
  outlinePosition: 'right',
  outlineWidth: 260,
  outlineDisplayMode: 'tree',
  scrollSync: true,

  // 3. 布局与侧边栏
  sidebarOpen: true,
  explorerOpen: true,
  activeFileId: 'sample-markdown',
  openTabIds: ['sample-markdown', 'sample-mindmap', 'sample-plantuml'],

  // 4. 分屏与图表驱动
  splitRatio: 50,
  splitRightMode: 'preview',
  mindmapSplitRatio: 42,
  mindmapViewMode: 'split',
  plantUmlSplitRatio: 50,
  plantUmlServerUrl: 'https://www.plantuml.com/plantuml',

  // 5. 编辑与辅助偏好
  wordWrap: true,
  showLineNumbers: true,

  // 6. 渲染与知识库偏好
  enableOkfRendering: true,
};

export function loadStoredSettings(): WorkbenchSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    let isMigratedFromLegacy = false;
    let raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    // 平滑迁移旧版本配置
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        isMigratedFromLegacy = true;
      }
    }

    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    const theme: ThemeId = ['system', 'vscode', 'dark', 'light', 'sepia', 'midnight', 'cyber', 'nord', 'dracula', 'forest', 'solarized'].includes(parsed.theme)
      ? (parsed.theme === 'vscode' ? 'system' : parsed.theme)
      : DEFAULT_SETTINGS.theme;

    const density: DensityMode = ['compact', 'standard', 'comfortable'].includes(parsed.density)
      ? parsed.density
      : DEFAULT_SETTINGS.density;

    const locale: 'zh-CN' | 'en-US' = ['zh-CN', 'en-US'].includes(parsed.locale)
      ? parsed.locale
      : DEFAULT_SETTINGS.locale || 'zh-CN';

    const currentView: WorkbenchView = ['editor', 'docs', 'drivers', 'scaffold'].includes(parsed.currentView)
      ? parsed.currentView
      : DEFAULT_SETTINGS.currentView || 'editor';

    const zoom: number = typeof parsed.zoom === 'number'
      ? Math.min(2.5, Math.max(0.5, Number(Number(parsed.zoom).toFixed(2))))
      : DEFAULT_SETTINGS.zoom;

    const viewMode: ViewMode = ['preview', 'split', 'source', 'mindmap'].includes(parsed.viewMode)
      ? parsed.viewMode
      : DEFAULT_SETTINGS.viewMode;

    const outlineOpen: boolean = typeof parsed.outlineOpen === 'boolean'
      ? parsed.outlineOpen
      : DEFAULT_SETTINGS.outlineOpen;

    const contentWidth: ContentWidthMode = ['narrow', 'standard', 'wide', 'full', 'a4'].includes(parsed.contentWidth)
      ? parsed.contentWidth
      : 'standard';

    const fontSize: number = typeof parsed.fontSize === 'number'
      ? Math.min(22, Math.max(12, Math.round(parsed.fontSize)))
      : 15;

    const sidebarOpen: boolean = typeof parsed.sidebarOpen === 'boolean'
      ? parsed.sidebarOpen
      : (DEFAULT_SETTINGS.sidebarOpen ?? true);

    const explorerOpen: boolean = typeof parsed.explorerOpen === 'boolean'
      ? parsed.explorerOpen
      : (DEFAULT_SETTINGS.explorerOpen ?? true);

    const activeFileId: string | undefined = typeof parsed.activeFileId === 'string' && parsed.activeFileId.trim()
      ? parsed.activeFileId.trim()
      : DEFAULT_SETTINGS.activeFileId;

    const openTabIds: string[] = Array.isArray(parsed.openTabIds) && parsed.openTabIds.length > 0
      ? parsed.openTabIds.filter((id: unknown): id is string => typeof id === 'string' && Boolean(id.trim()))
      : (DEFAULT_SETTINGS.openTabIds || []);

    const splitRatio: number = typeof parsed.splitRatio === 'number'
      ? Math.min(85, Math.max(15, Math.round(parsed.splitRatio)))
      : (DEFAULT_SETTINGS.splitRatio ?? 50);

    const splitRightMode: 'preview' | 'mindmap' = ['preview', 'mindmap'].includes(parsed.splitRightMode)
      ? parsed.splitRightMode
      : (DEFAULT_SETTINGS.splitRightMode || 'preview');

    const mindmapSplitRatio: number = typeof parsed.mindmapSplitRatio === 'number'
      ? Math.min(85, Math.max(15, Math.round(parsed.mindmapSplitRatio)))
      : (DEFAULT_SETTINGS.mindmapSplitRatio ?? 42);

    const mindmapViewMode: 'split' | 'mindmap' | 'editor' = ['split', 'mindmap', 'editor'].includes(parsed.mindmapViewMode)
      ? parsed.mindmapViewMode
      : (DEFAULT_SETTINGS.mindmapViewMode || 'split');

    const plantUmlSplitRatio: number = typeof parsed.plantUmlSplitRatio === 'number'
      ? Math.min(85, Math.max(15, Math.round(parsed.plantUmlSplitRatio)))
      : (DEFAULT_SETTINGS.plantUmlSplitRatio ?? 50);

    const plantUmlServerUrl: string = typeof parsed.plantUmlServerUrl === 'string' && parsed.plantUmlServerUrl.trim()
      ? parsed.plantUmlServerUrl.trim()
      : (DEFAULT_SETTINGS.plantUmlServerUrl || 'https://www.plantuml.com/plantuml');

    const wordWrap: boolean = typeof parsed.wordWrap === 'boolean'
      ? parsed.wordWrap
      : (DEFAULT_SETTINGS.wordWrap ?? true);

    const showLineNumbers: boolean = typeof parsed.showLineNumbers === 'boolean'
      ? parsed.showLineNumbers
      : (DEFAULT_SETTINGS.showLineNumbers ?? true);

    const result: WorkbenchSettings = {
      theme,
      density,
      locale,
      currentView,
      zoom,
      viewMode,
      outlineOpen,
      outlinePosition: ['left', 'right', 'floating'].includes(parsed.outlinePosition)
        ? parsed.outlinePosition
        : (DEFAULT_SETTINGS.outlinePosition || 'right'),
      outlineWidth: typeof parsed.outlineWidth === 'number'
        ? Math.min(600, Math.max(180, Math.round(parsed.outlineWidth)))
        : (DEFAULT_SETTINGS.outlineWidth || 260),
      outlineDisplayMode: ['list', 'tree'].includes(parsed.outlineDisplayMode)
        ? parsed.outlineDisplayMode
        : (DEFAULT_SETTINGS.outlineDisplayMode || 'tree'),
      contentWidth,
      fontSize,
      sidebarOpen,
      explorerOpen,
      activeFileId,
      openTabIds,
      splitRatio,
      splitRightMode,
      mindmapSplitRatio,
      mindmapViewMode,
      plantUmlSplitRatio,
      plantUmlServerUrl,
      wordWrap,
      showLineNumbers,
      enableOkfRendering: parsed.enableOkfRendering !== undefined
        ? Boolean(parsed.enableOkfRendering)
        : DEFAULT_SETTINGS.enableOkfRendering ?? true,
    };

    if (isMigratedFromLegacy) {
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(result));
      } catch (e) {
        console.warn('Failed to write migrated settings to v2 storage key:', e);
      }
    }

    return result;
  } catch (err) {
    console.warn('Failed to load OmniView workbench settings from localStorage:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveStoredSettings(partial: Partial<WorkbenchSettings>): WorkbenchSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS, ...partial };
  }

  try {
    const current = loadStoredSettings();
    const normalizedPartial = { ...partial };
    if (normalizedPartial.theme === 'vscode') {
      normalizedPartial.theme = 'system';
    }
    const updated: WorkbenchSettings = {
      ...current,
      ...normalizedPartial,
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save OmniView workbench settings to localStorage:', err);
    return { ...DEFAULT_SETTINGS, ...partial };
  }
}

export function resetStoredSettings(): WorkbenchSettings {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to reset settings:', err);
    }
  }
  return { ...DEFAULT_SETTINGS };
}

export function exportSettingsJson(): string {
  const settings = loadStoredSettings();
  return JSON.stringify(settings, null, 2);
}

export function importSettingsJson(jsonString: string): { success: boolean; settings?: WorkbenchSettings; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: '无效的 JSON 配置格式' };
    }
    const updated = saveStoredSettings(parsed);
    return { success: true, settings: updated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'JSON 解析失败' };
  }
}

/**
 * 获取当前 LocalStorage 使用量分析
 */
export function getStorageStats(): {
  usedBytes: number;
  usedKb: number;
  totalBytes: number;
  totalFormatted: string;
  itemCount: number;
  fileCount: number;
  keys: string[];
} {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      usedBytes: 0,
      usedKb: 0,
      totalBytes: 0,
      totalFormatted: '0 KB',
      itemCount: 0,
      fileCount: 0,
      keys: [],
    };
  }
  let totalBytes = 0;
  let count = 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('omniview')) {
        const val = window.localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2; // UTF-16 approximate
        count++;
        keys.push(key);
      }
    }
  } catch {
    // ignore
  }
  const usedKb = Math.round(totalBytes / 1024 * 10) / 10;
  return {
    usedBytes: totalBytes,
    usedKb,
    totalBytes,
    totalFormatted: `${usedKb} KB`,
    itemCount: count,
    fileCount: count,
    keys,
  };
}
