/**
 * OmniView EPUB 电子书阅读器持久化引擎 (epubSettingsStorage.ts)
 * 职责：
 * 1. 自动持久化并还原阅读器全局排版配置（流式双叶/单页/连续滚动、字号、行距、版心、字体、首行缩进、翻书动效、主题）
 * 2. 自动持久化并还原特定书籍的阅读进度（最后阅读的章节索引、页码、阅读百分比与时间戳）
 */

export type EpubFlowMode = 'spread' | 'single' | 'scroll';
export type EpubReaderTheme = 'auto' | 'sepia' | 'light' | 'dark' | 'midnight';
export type EpubFontFamily = 'serif' | 'sans' | 'kaiti' | 'mono';
export type EpubContentWidth = 'standard' | 'wide' | 'full';

export interface EpubReaderSettings {
  /** 流式阅读形态：双叶并排 (spread)、单页流式 (single)、连续滚动 (scroll) */
  flowMode: EpubFlowMode;
  /** 是否开启 3D 拟真翻书动效 */
  enableFlipEffect: boolean;
  /** 阅读色彩主题 */
  readerTheme: EpubReaderTheme;
  /** 阅读字号 (px: 13 ~ 28) */
  fontSize: number;
  /** 行高比例 (1.4 ~ 2.2) */
  lineHeight: number;
  /** 版心宽度 (标准 / 宽幅 / 全幅) */
  contentWidth: EpubContentWidth;
  /** 流式字体：典雅宋体、现代黑体、人文楷体、等宽 */
  fontFamily: EpubFontFamily;
  /** 是否开启中文经典两字符首行缩进 */
  textIndent: boolean;
  /** 文本对齐：两端对齐 (justify) / 靠左 (left) */
  textAlign: 'justify' | 'left';
}

export interface EpubReadingProgress {
  chapterIndex: number;
  pageIndex: number;
  progressPercent: number;
  timestamp: number;
}

export const EPUB_SETTINGS_STORAGE_KEY = 'omniview:epub:settings:v1';
export const EPUB_PROGRESS_STORAGE_PREFIX = 'omniview:epub:progress:';

export const DEFAULT_EPUB_SETTINGS: EpubReaderSettings = {
  flowMode: 'spread',
  enableFlipEffect: true,
  readerTheme: 'auto',
  fontSize: 17,
  lineHeight: 1.75,
  contentWidth: 'wide',
  fontFamily: 'serif',
  textIndent: true,
  textAlign: 'justify',
};

/**
 * 安全从 localStorage 加载用户偏好的 EPUB 阅读设置
 */
export function loadEpubSettings(): EpubReaderSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_EPUB_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(EPUB_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EPUB_SETTINGS };

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_EPUB_SETTINGS };
    }

    const flowMode: EpubFlowMode = ['spread', 'single', 'scroll'].includes(parsed.flowMode)
      ? parsed.flowMode
      : DEFAULT_EPUB_SETTINGS.flowMode;

    const enableFlipEffect = typeof parsed.enableFlipEffect === 'boolean'
      ? parsed.enableFlipEffect
      : DEFAULT_EPUB_SETTINGS.enableFlipEffect;

    const readerTheme: EpubReaderTheme = ['auto', 'sepia', 'light', 'dark', 'midnight'].includes(parsed.readerTheme)
      ? parsed.readerTheme
      : DEFAULT_EPUB_SETTINGS.readerTheme;

    const fontSize = typeof parsed.fontSize === 'number'
      ? Math.min(28, Math.max(13, Math.round(parsed.fontSize)))
      : DEFAULT_EPUB_SETTINGS.fontSize;

    const lineHeight = typeof parsed.lineHeight === 'number'
      ? Math.min(2.4, Math.max(1.3, Number(Number(parsed.lineHeight).toFixed(2))))
      : DEFAULT_EPUB_SETTINGS.lineHeight;

    const contentWidth: EpubContentWidth = ['standard', 'wide', 'full'].includes(parsed.contentWidth)
      ? parsed.contentWidth
      : DEFAULT_EPUB_SETTINGS.contentWidth;

    const fontFamily: EpubFontFamily = ['serif', 'sans', 'kaiti', 'mono'].includes(parsed.fontFamily)
      ? parsed.fontFamily
      : DEFAULT_EPUB_SETTINGS.fontFamily;

    const textIndent = typeof parsed.textIndent === 'boolean'
      ? parsed.textIndent
      : DEFAULT_EPUB_SETTINGS.textIndent;

    const textAlign: 'justify' | 'left' = ['justify', 'left'].includes(parsed.textAlign)
      ? parsed.textAlign
      : DEFAULT_EPUB_SETTINGS.textAlign;

    return {
      flowMode,
      enableFlipEffect,
      readerTheme,
      fontSize,
      lineHeight,
      contentWidth,
      fontFamily,
      textIndent,
      textAlign,
    };
  } catch (err) {
    console.warn('[EpubSettings] 加载持久化配置失败，降级使用默认设置:', err);
    return { ...DEFAULT_EPUB_SETTINGS };
  }
}

/**
 * 保存增量更新的 EPUB 阅读器设置
 */
export function saveEpubSettings(partial: Partial<EpubReaderSettings>): EpubReaderSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_EPUB_SETTINGS, ...partial };
  }

  try {
    const current = loadEpubSettings();
    const updated: EpubReaderSettings = {
      ...current,
      ...partial,
    };
    window.localStorage.setItem(EPUB_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('[EpubSettings] 持久化配置保存失败:', err);
    return { ...DEFAULT_EPUB_SETTINGS, ...partial };
  }
}

/**
 * 规范化电子书唯一键名（优先使用书籍标识符或文件名）
 */
export function sanitizeBookStorageKey(identifierOrName: string): string {
  const clean = (identifierOrName || 'default_book')
    .trim()
    .replace(/[^\w.-]/g, '_')
    .slice(0, 80);
  return `${EPUB_PROGRESS_STORAGE_PREFIX}${clean}`;
}

/**
 * 读取特定书籍的最后阅读进度
 */
export function loadEpubProgress(identifierOrName: string): EpubReadingProgress | null {
  if (typeof window === 'undefined' || !window.localStorage || !identifierOrName) {
    return null;
  }

  try {
    const key = sanitizeBookStorageKey(identifierOrName);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const chapterIndex = typeof parsed.chapterIndex === 'number' && parsed.chapterIndex >= 0
      ? Math.floor(parsed.chapterIndex)
      : 0;

    const pageIndex = typeof parsed.pageIndex === 'number' && parsed.pageIndex >= 0
      ? Math.floor(parsed.pageIndex)
      : 0;

    const progressPercent = typeof parsed.progressPercent === 'number'
      ? Math.min(100, Math.max(0, Math.round(parsed.progressPercent)))
      : 0;

    return {
      chapterIndex,
      pageIndex,
      progressPercent,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    };
  } catch (err) {
    console.warn('[EpubSettings] 读取书籍阅读进度失败:', err);
    return null;
  }
}

/**
 * 持久化保存特定书籍的阅读进度
 */
export function saveEpubProgress(
  identifierOrName: string,
  progress: { chapterIndex: number; pageIndex: number; progressPercent: number }
): void {
  if (typeof window === 'undefined' || !window.localStorage || !identifierOrName) {
    return;
  }

  try {
    const key = sanitizeBookStorageKey(identifierOrName);
    const payload: EpubReadingProgress = {
      chapterIndex: Math.max(0, progress.chapterIndex),
      pageIndex: Math.max(0, progress.pageIndex),
      progressPercent: Math.min(100, Math.max(0, Math.round(progress.progressPercent))),
      timestamp: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('[EpubSettings] 持久化保存书籍阅读进度失败:', err);
  }
}
