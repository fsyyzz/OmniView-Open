/**
 * OmniView 原生专业 EPUB 电子书阅读器 (EpubViewer)
 * 具备三种流式阅读形态：
 * 1. 双叶并排 (Two-page Spread): 双栏拟真书卷跨页，书脊折痕阴影与 3D 翻书动效
 * 2. 单页流式 (Single-page Flow): 优雅单栏居中留白，支持左右平滑翻页与 3D 翻书动效
 * 3. 连续滚动 (Continuous Scroll): 纵向无断点平滑流式阅读
 *
 * 全面支持点击设置与阅读进度的自动持久化 (epubSettingsStorage):
 * - 流式模式、字号、行距、字体族 (宋体/黑体/楷体/等宽)、首行缩进、对齐、版心宽度、翻书动效、主题色彩 100% 自动保存
 * - 书籍专属阅读进度 (章节、页码、阅读百分比) 自动记忆并无感恢复
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Columns2,
  ScrollText,
  Sparkles,
  Maximize2,
  Minimize2,
  Info,
  BookMarked,
  Sun,
  Moon,
  Coffee,
  AlignLeft,
  AlignJustify,
  X,
  Search,
  Sliders,
  Check,
  RotateCcw,
  Smartphone,
  Type,
} from 'lucide-react';
import {
  parseEpub,
  generateSampleEpubBytes,
  type ParsedEpubBook,
  type EpubChapter,
  type EpubTocItem,
} from '../../lib/epubEngine';
import {
  loadEpubSettings,
  saveEpubSettings,
  loadEpubProgress,
  saveEpubProgress,
  type EpubReaderSettings,
  type EpubFlowMode,
  type EpubReaderTheme,
  type EpubFontFamily,
  type EpubContentWidth,
  DEFAULT_EPUB_SETTINGS,
} from '../../lib/epubSettingsStorage';
import type { ThemeId, DensityMode } from '../../../../shared/types';
import { t, type Locale } from '../../../../shared/lib/i18n';

export interface EpubViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  density?: DensityMode;
  locale?: Locale;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'ebook.epub',
  fileSize,
  isDarkTheme = true,
  locale = 'zh-CN',
}) => {
  // 加载与解析状态
  const [book, setBook] = useState<ParsedEpubBook | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 持久化阅读器排版配置
  const [settings, setSettings] = useState<EpubReaderSettings>(() => loadEpubSettings());

  // 阅读进度核心状态
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalSpreadPages, setTotalSpreadPages] = useState<number>(1);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);

  // 浮层交互状态
  const [showToc, setShowToc] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showTypographyMenu, setShowTypographyMenu] = useState<boolean>(false);
  const [tocSearch, setTocSearch] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(false);
  const [progressRestoredToast, setProgressRestoredToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const spreadColumnsWrapperRef = useRef<HTMLDivElement>(null);
  const typographyMenuRef = useRef<HTMLDivElement>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredProgressRef = useRef<boolean>(false);

  // 书籍标识符，用于进度本地持久化隔离
  const bookStorageKey = useMemo(() => {
    if (book?.metadata?.title) {
      return `${book.metadata.title}_${book.metadata.creator || ''}`;
    }
    return fileName || 'default_epub';
  }, [book, fileName]);

  // 更新设置并立即持久化
  const updateSetting = useCallback(
    <K extends keyof EpubReaderSettings>(key: K, value: EpubReaderSettings[K]) => {
      setSettings(prev => {
        const next = { ...prev, [key]: value };
        saveEpubSettings(next);
        return next;
      });
    },
    []
  );

  // 解析 EPUB 数据
  const loadEpubData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let dataToParse: string | Uint8Array;
      if (binaryUrl) {
        dataToParse = binaryUrl;
      } else if (content && content.length > 50) {
        dataToParse = content;
      } else {
        dataToParse = await generateSampleEpubBytes();
      }
      const parsed = await parseEpub(dataToParse);
      setBook(parsed);
    } catch (err) {
      console.error('[EpubViewer] 解析失败:', err);
      setError(err instanceof Error ? err.message : '解析电子书格式异常');
    } finally {
      setLoading(false);
    }
  }, [binaryUrl, content]);

  useEffect(() => {
    loadEpubData();
  }, [loadEpubData]);

  // 当书籍加载成功后，自动恢复历史阅读进度
  useEffect(() => {
    if (!book || book.chapters.length === 0 || hasRestoredProgressRef.current) return;
    hasRestoredProgressRef.current = true;

    const savedProgress = loadEpubProgress(bookStorageKey);
    if (savedProgress && (savedProgress.chapterIndex > 0 || savedProgress.pageIndex > 0)) {
      const targetChap = Math.min(savedProgress.chapterIndex, book.chapters.length - 1);
      setCurrentChapterIndex(targetChap);
      setCurrentPageIndex(savedProgress.pageIndex);
      setProgressRestoredToast(
        locale === 'zh-CN'
          ? `已自动恢复至上次阅读进度: 第 ${targetChap + 1} 章 (页码 ${savedProgress.pageIndex + 1})`
          : `Resumed from previous reading position: Chapter ${targetChap + 1}`
      );
      const timer = setTimeout(() => setProgressRestoredToast(null), 3800);
      return () => clearTimeout(timer);
    }
  }, [book, bookStorageKey, locale]);

  // 点击外部自动收起排版面板
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (
        showTypographyMenu &&
        typographyMenuRef.current &&
        !typographyMenuRef.current.contains(e.target as Node)
      ) {
        setShowTypographyMenu(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [showTypographyMenu]);

  // 当前是否处于分页流式模式 (双叶并排 或 单页流式)
  const isPaginatedMode = settings.flowMode === 'spread' || settings.flowMode === 'single';

  // 视口宽度监听与流式多列分页总页数计算
  const recalculateSpreadPages = useCallback(() => {
    if (!isPaginatedMode || !spreadColumnsWrapperRef.current) {
      setTotalSpreadPages(1);
      return;
    }
    const el = spreadColumnsWrapperRef.current;
    const clientW = el.clientWidth;
    const scrollW = el.scrollWidth;

    // 检查是否极窄屏幕
    if (clientW < 768 && !isNarrowViewport) {
      setIsNarrowViewport(true);
    } else if (clientW >= 768 && isNarrowViewport) {
      setIsNarrowViewport(false);
    }

    if (clientW > 0 && scrollW > 0) {
      const count = Math.max(1, Math.ceil(scrollW / clientW));
      setTotalSpreadPages(count);
      setCurrentPageIndex(prev => Math.min(prev, Math.max(0, count - 1)));
    }
  }, [isPaginatedMode, isNarrowViewport]);

  // 窗口大小变动或排版变化时重算分页
  useEffect(() => {
    recalculateSpreadPages();
    const handleResize = () => {
      recalculateSpreadPages();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [
    recalculateSpreadPages,
    currentChapterIndex,
    settings.flowMode,
    settings.fontSize,
    settings.lineHeight,
    settings.contentWidth,
    settings.fontFamily,
    settings.textIndent,
  ]);

  // 章节切换
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setCurrentPageIndex(0);
    const timer = setTimeout(recalculateSpreadPages, 60);
    return () => clearTimeout(timer);
  }, [currentChapterIndex, recalculateSpreadPages]);

  const currentChapter: EpubChapter | undefined = book?.chapters[currentChapterIndex];
  const totalChapters = book?.chapters.length || 0;

  // 总阅读百分比
  const readingProgress = useMemo(() => {
    if (totalChapters <= 0) return 0;
    if (isPaginatedMode) {
      const chapterFraction = (currentPageIndex + 1) / Math.max(1, totalSpreadPages);
      return Math.min(100, Math.round(((currentChapterIndex + chapterFraction) / totalChapters) * 100));
    }
    return Math.min(100, Math.round(((currentChapterIndex + 1) / totalChapters) * 100));
  }, [totalChapters, isPaginatedMode, currentChapterIndex, currentPageIndex, totalSpreadPages]);

  // 自动保存阅读进度（带防抖）
  useEffect(() => {
    if (!book || book.chapters.length === 0 || loading) return;
    const timer = setTimeout(() => {
      saveEpubProgress(bookStorageKey, {
        chapterIndex: currentChapterIndex,
        pageIndex: currentPageIndex,
        progressPercent: readingProgress,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [book, bookStorageKey, currentChapterIndex, currentPageIndex, readingProgress, loading]);

  // 触发翻页动效并执行状态转移
  const triggerFlipTransition = (direction: 'next' | 'prev', callback: () => void) => {
    if (settings.enableFlipEffect && isPaginatedMode) {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
      }
      setFlipDirection(direction);
      flipTimerRef.current = setTimeout(() => {
        callback();
        setFlipDirection(null);
        flipTimerRef.current = null;
      }, 340);
    } else {
      callback();
    }
  };

  // 翻到上一页/上一章
  const goToPrev = useCallback(() => {
    if (isPaginatedMode) {
      if (currentPageIndex > 0) {
        triggerFlipTransition('prev', () => {
          setCurrentPageIndex(p => Math.max(0, p - 1));
        });
      } else if (currentChapterIndex > 0) {
        triggerFlipTransition('prev', () => {
          setCurrentChapterIndex(c => c - 1);
        });
      }
    } else {
      if (currentChapterIndex > 0) {
        setCurrentChapterIndex(c => c - 1);
      }
    }
  }, [isPaginatedMode, currentPageIndex, currentChapterIndex, settings.enableFlipEffect]);

  // 翻到下一页/下一章
  const goToNext = useCallback(() => {
    if (isPaginatedMode) {
      if (currentPageIndex < totalSpreadPages - 1) {
        triggerFlipTransition('next', () => {
          setCurrentPageIndex(p => p + 1);
        });
      } else if (book && currentChapterIndex < totalChapters - 1) {
        triggerFlipTransition('next', () => {
          setCurrentChapterIndex(c => c + 1);
        });
      }
    } else {
      if (book && currentChapterIndex < totalChapters - 1) {
        setCurrentChapterIndex(c => c + 1);
      }
    }
  }, [
    isPaginatedMode,
    currentPageIndex,
    totalSpreadPages,
    book,
    currentChapterIndex,
    totalChapters,
    settings.enableFlipEffect,
  ]);

  // 键盘快捷键监听 (← / → 翻页/翻章，Space 下一页)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && isPaginatedMode)) {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, isPaginatedMode]);

  // 目录跳转
  const jumpToToc = (tocItem: EpubTocItem) => {
    if (!book) return;
    const targetFile = tocItem.href.split('#')[0];
    const foundIndex = book.chapters.findIndex(ch => ch.href.split('#')[0] === targetFile);
    if (foundIndex !== -1) {
      setCurrentChapterIndex(foundIndex);
      setCurrentPageIndex(0);
      setShowToc(false);
    }
  };

  // 过滤 TOC 章节
  const filteredToc = useMemo(() => {
    if (!book) return [];
    if (!tocSearch.trim()) return book.toc;
    const q = tocSearch.toLowerCase();
    return book.toc.filter(item => item.label.toLowerCase().includes(q));
  }, [book, tocSearch]);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // 主题色彩计算
  const themeStyles = useMemo(() => {
    if (settings.readerTheme === 'sepia') {
      return {
        bg: '#fbf0d9',
        paper: '#f6ebd0',
        text: '#5c4832',
        subtext: '#8c7358',
        border: '#ebd9b8',
        accent: '#b45309',
        toolbarBg: '#f2e3c6',
      };
    }
    if (settings.readerTheme === 'light') {
      return {
        bg: '#f8fafc',
        paper: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        border: '#e2e8f0',
        accent: '#2563eb',
        toolbarBg: '#f1f5f9',
      };
    }
    if (settings.readerTheme === 'midnight') {
      return {
        bg: '#050811',
        paper: '#0b1120',
        text: '#cbd5e1',
        subtext: '#64748b',
        border: '#1e293b',
        accent: '#60a5fa',
        toolbarBg: '#0f172a',
      };
    }
    if (settings.readerTheme === 'dark') {
      return {
        bg: '#0f172a',
        paper: '#1e293b',
        text: '#e2e8f0',
        subtext: '#94a3b8',
        border: '#334155',
        accent: '#38bdf8',
        toolbarBg: '#1e293b',
      };
    }
    // 'auto': 跟随 OmniView / VS Code 整体变量
    return {
      bg: 'var(--ov-bg, #0f172a)',
      paper: 'var(--ov-card-bg, #1e293b)',
      text: 'var(--ov-fg, #e2e8f0)',
      subtext: 'var(--ov-fg-muted, #94a3b8)',
      border: 'var(--ov-border, #334155)',
      accent: 'var(--ov-accent, #3b82f6)',
      toolbarBg: 'var(--ov-sidebar-bg, #1e293b)',
    };
  }, [settings.readerTheme, isDarkTheme]);

  // 字体族 CSS 规则计算
  const fontFamilyCss = useMemo(() => {
    switch (settings.fontFamily) {
      case 'serif':
        return `'Songti SC', 'Source Han Serif SC', 'Noto Serif CJK SC', 'SimSun', 'STSong', 'Georgia', serif`;
      case 'sans':
        return `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`;
      case 'kaiti':
        return `'Kaiti SC', 'STKaiti', 'KaiTi', '楷体', serif`;
      case 'mono':
        return `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      default:
        return 'inherit';
    }
  }, [settings.fontFamily]);

  // 最大宽度控制
  const maxWidthClass = useMemo(() => {
    if (settings.flowMode === 'spread') {
      return settings.contentWidth === 'standard'
        ? 'max-w-4xl'
        : settings.contentWidth === 'wide'
          ? 'max-w-6xl'
          : 'max-w-full';
    }
    if (settings.flowMode === 'single') {
      return settings.contentWidth === 'standard'
        ? 'max-w-2xl'
        : settings.contentWidth === 'wide'
          ? 'max-w-3xl'
          : 'max-w-5xl';
    }
    return settings.contentWidth === 'standard'
      ? 'max-w-3xl'
      : settings.contentWidth === 'wide'
        ? 'max-w-5xl'
        : 'max-w-full';
  }, [settings.flowMode, settings.contentWidth]);

  // 实际生效的多列列数：双叶且宽屏时 2 栏，否则 1 栏
  const effectiveColumnsCount = settings.flowMode === 'spread' && !isNarrowViewport ? '2' : '1';

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center select-none" style={{ background: themeStyles.bg, color: themeStyles.text }}>
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 mb-4 animate-pulse">
          <BookOpen className="w-10 h-10" />
        </div>
        <h3 className="text-base font-semibold mb-1">正在载入并解析 EPUB 电子书...</h3>
        <p className="text-xs opacity-60 font-mono">正在解构 OCF 容器、Spine 阅读序列表与样式表</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center" style={{ background: themeStyles.bg, color: themeStyles.text }}>
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-4">
          <Info className="w-10 h-10" />
        </div>
        <h3 className="text-base font-semibold mb-1">EPUB 电子书解析异常</h3>
        <p className="text-xs text-rose-400 max-w-md mb-6">{error}</p>
        <button
          onClick={loadEpubData}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-xs"
        >
          重新尝试加载
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden relative select-none font-sans"
      style={{
        background: themeStyles.bg,
        color: themeStyles.text,
      }}
    >
      {/* 恢复进度轻量浮动 Toast */}
      {progressRestoredToast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-xs shadow-xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{progressRestoredToast}</span>
        </div>
      )}

      {/* 顶部主工具栏 */}
      <header
        className="h-12 border-b px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 transition-colors duration-200"
        style={{
          background: themeStyles.toolbarBg,
          borderColor: themeStyles.border,
        }}
      >
        {/* 左侧：目录抽屉开关与书名 */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-xs ${
              showToc
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            style={{ borderColor: showToc ? undefined : themeStyles.border }}
            title="书籍目录大纲 (TOC)"
          >
            <List className="w-4 h-4" />
            <span className="hidden md:inline font-medium">目录</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-xs" title={book?.metadata?.title}>
              {book?.metadata?.title || fileName}
            </span>
            {book?.metadata?.creator && (
              <span className="text-[11px] opacity-60 truncate hidden lg:inline">
                / {book.metadata.creator}
              </span>
            )}
          </div>
        </div>

        {/* 中间：翻页/翻章快捷控制 */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPrev}
            disabled={
              isPaginatedMode
                ? currentChapterIndex <= 0 && currentPageIndex <= 0
                : currentChapterIndex <= 0
            }
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title={isPaginatedMode ? t('epubPrevPage', locale) : '上一章'}
            aria-label="上一页"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border flex items-center gap-1.5" style={{ borderColor: themeStyles.border }}>
            <span>
              {isPaginatedMode ? (
                <>
                  <span className="font-bold">{currentPageIndex + 1}</span>
                  <span className="opacity-40">/</span>
                  <span className="opacity-70">{totalSpreadPages}</span>
                  <span className="opacity-40 text-[10px] hidden sm:inline"> 页</span>
                </>
              ) : (
                <>
                  <span className="font-bold">{currentChapterIndex + 1}</span>
                  <span className="opacity-40">/</span>
                  <span className="opacity-70">{totalChapters}</span>
                  <span className="opacity-40 text-[10px] hidden sm:inline"> 章</span>
                </>
              )}
            </span>
          </div>

          <button
            onClick={goToNext}
            disabled={
              isPaginatedMode
                ? currentChapterIndex >= totalChapters - 1 && currentPageIndex >= totalSpreadPages - 1
                : currentChapterIndex >= totalChapters - 1
            }
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title={isPaginatedMode ? t('epubNextPage', locale) : '下一章'}
            aria-label="下一页"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 右侧：排版形态切换与高级设置 */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* 流式阅读形态快捷切换组：双叶并排 vs 单页流式 vs 连续滚动 */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
            <button
              onClick={() => {
                updateSetting('flowMode', 'spread');
                setTimeout(recalculateSpreadPages, 50);
              }}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                settings.flowMode === 'spread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="双叶并排 (宽屏书卷跨页)"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">双叶</span>
            </button>
            <button
              onClick={() => {
                updateSetting('flowMode', 'single');
                setTimeout(recalculateSpreadPages, 50);
              }}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                settings.flowMode === 'single'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="单页流式分页 (单列专注阅读)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">单页</span>
            </button>
            <button
              onClick={() => {
                updateSetting('flowMode', 'scroll');
              }}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                settings.flowMode === 'scroll'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="连续流式滚动 (纵向无间断平滑阅读)"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">滚动</span>
            </button>
          </div>

          {/* 拟真翻书动效快捷开关 */}
          {isPaginatedMode && (
            <button
              onClick={() => updateSetting('enableFlipEffect', !settings.enableFlipEffect)}
              className={`p-1.5 rounded border transition flex items-center gap-1 ${
                settings.enableFlipEffect
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 dark:text-amber-400'
                  : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-50'
              }`}
              style={{ borderColor: settings.enableFlipEffect ? undefined : themeStyles.border }}
              title={settings.enableFlipEffect ? t('epubPageFlipEffectOn', locale) : t('epubPageFlipEffectOff', locale)}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline text-[10px]">翻书动效</span>
            </button>
          )}

          {/* 字号微调 A- / A+ */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
            <button
              onClick={() => {
                updateSetting('fontSize', Math.max(13, settings.fontSize - 1));
                setTimeout(recalculateSpreadPages, 50);
              }}
              disabled={settings.fontSize <= 13}
              className="px-1.5 py-0.5 text-[11px] font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
              title="缩小字号"
            >
              A-
            </button>
            <span className="text-[10px] font-mono px-1 min-w-[20px] text-center">{settings.fontSize}</span>
            <button
              onClick={() => {
                updateSetting('fontSize', Math.min(28, settings.fontSize + 1));
                setTimeout(recalculateSpreadPages, 50);
              }}
              disabled={settings.fontSize >= 28}
              className="px-1.5 py-0.5 text-[11px] font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
              title="放大字号"
            >
              A+
            </button>
          </div>

          {/* 阅读主题切换 */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
            <button
              onClick={() => updateSetting('readerTheme', 'auto')}
              className={`p-1 rounded text-[10px] transition ${
                settings.readerTheme === 'auto' ? 'bg-blue-600 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="自动环境主题"
            >
              自
            </button>
            <button
              onClick={() => updateSetting('readerTheme', 'sepia')}
              className={`p-1 rounded text-[10px] transition ${
                settings.readerTheme === 'sepia' ? 'bg-amber-600 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="羊皮纸护眼模式"
            >
              <Coffee className="w-3 h-3" />
            </button>
            <button
              onClick={() => updateSetting('readerTheme', 'light')}
              className={`p-1 rounded text-[10px] transition ${
                settings.readerTheme === 'light' ? 'bg-slate-400 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="明亮纯白模式"
            >
              <Sun className="w-3 h-3" />
            </button>
            <button
              onClick={() => updateSetting('readerTheme', 'dark')}
              className={`p-1 rounded text-[10px] transition ${
                settings.readerTheme === 'dark' ? 'bg-slate-700 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
              }`}
              title="夜间深色模式"
            >
              <Moon className="w-3 h-3" />
            </button>
          </div>

          {/* 综合高级排版菜单入口 (Typography & Flow Popover) */}
          <div className="relative">
            <button
              onClick={() => setShowTypographyMenu(!showTypographyMenu)}
              className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-xs ${
                showTypographyMenu
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'hover:bg-black/10 dark:hover:bg-white/10'
              }`}
              style={{ borderColor: showTypographyMenu ? undefined : themeStyles.border }}
              title="排版与流式字体设置 (已全面持久化)"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden lg:inline font-medium">排版</span>
            </button>

            {/* 高级排版下拉卡片 */}
            {showTypographyMenu && (
              <div
                ref={typographyMenuRef}
                className="absolute right-0 top-full mt-2 w-80 p-4 rounded-xl shadow-2xl border z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200"
                style={{
                  background: themeStyles.paper,
                  borderColor: themeStyles.border,
                  color: themeStyles.text,
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: themeStyles.border }}>
                  <div className="flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold">流式排版设置</span>
                  </div>
                  <button
                    onClick={() => {
                      setSettings({ ...DEFAULT_EPUB_SETTINGS });
                      saveEpubSettings(DEFAULT_EPUB_SETTINGS);
                      setTimeout(recalculateSpreadPages, 50);
                    }}
                    className="text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition hover:text-blue-500"
                    title="恢复默认排版"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>恢复默认</span>
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* 排版字体选择 */}
                  <div>
                    <label className="block text-[11px] font-semibold opacity-70 mb-1.5">流式字体</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'serif', label: '典雅衬线 (宋体)' },
                        { id: 'sans', label: '现代黑体 (无衬线)' },
                        { id: 'kaiti', label: '人文楷体 (文学质感)' },
                        { id: 'mono', label: '等宽代码' },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => {
                            updateSetting('fontFamily', f.id as EpubFontFamily);
                            setTimeout(recalculateSpreadPages, 50);
                          }}
                          className={`px-2 py-1.5 rounded-lg border text-[11px] text-left transition flex items-center justify-between ${
                            settings.fontFamily === f.id
                              ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                          }`}
                          style={{ borderColor: settings.fontFamily === f.id ? undefined : themeStyles.border }}
                        >
                          <span className="truncate">{f.label}</span>
                          {settings.fontFamily === f.id && <Check className="w-3 h-3 shrink-0 text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 首行缩进与对齐方式 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold opacity-70 mb-1">首行两字符缩进</label>
                      <button
                        onClick={() => {
                          updateSetting('textIndent', !settings.textIndent);
                          setTimeout(recalculateSpreadPages, 50);
                        }}
                        className={`w-full py-1.5 px-2 rounded-lg border text-center transition ${
                          settings.textIndent
                            ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
                        }`}
                        style={{ borderColor: settings.textIndent ? undefined : themeStyles.border }}
                      >
                        {settings.textIndent ? '已开启缩进' : '关闭缩进'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold opacity-70 mb-1">对齐方式</label>
                      <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: themeStyles.border }}>
                        <button
                          onClick={() => updateSetting('textAlign', 'justify')}
                          className={`flex-1 py-1.5 flex items-center justify-center transition ${
                            settings.textAlign === 'justify' ? 'bg-blue-600 text-white' : 'hover:bg-black/5 opacity-70'
                          }`}
                          title="两端对齐"
                        >
                          <AlignJustify className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateSetting('textAlign', 'left')}
                          className={`flex-1 py-1.5 flex items-center justify-center transition ${
                            settings.textAlign === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-black/5 opacity-70'
                          }`}
                          title="靠左对齐"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 行高调节 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold opacity-70">行距倍率</label>
                      <span className="font-mono text-[10px] opacity-70">{settings.lineHeight}x</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { val: 1.5, label: '紧凑 1.5' },
                        { val: 1.75, label: '标准 1.75' },
                        { val: 2.0, label: '宽松 2.0' },
                      ].map(item => (
                        <button
                          key={item.val}
                          onClick={() => {
                            updateSetting('lineHeight', item.val);
                            setTimeout(recalculateSpreadPages, 50);
                          }}
                          className={`py-1 rounded-lg border text-center text-[10px] transition ${
                            settings.lineHeight === item.val
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
                          }`}
                          style={{ borderColor: settings.lineHeight === item.val ? undefined : themeStyles.border }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 版心宽度 */}
                  <div>
                    <label className="block text-[11px] font-semibold opacity-70 mb-1">版心宽度</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'standard', label: '标准 (720px)' },
                        { id: 'wide', label: '宽幅 (960px)' },
                        { id: 'full', label: '全幅 (100%)' },
                      ].map(w => (
                        <button
                          key={w.id}
                          onClick={() => {
                            updateSetting('contentWidth', w.id as EpubContentWidth);
                            setTimeout(recalculateSpreadPages, 50);
                          }}
                          className={`py-1 rounded-lg border text-center text-[10px] transition ${
                            settings.contentWidth === w.id
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
                          }`}
                          style={{ borderColor: settings.contentWidth === w.id ? undefined : themeStyles.border }}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t text-[10px] opacity-50 flex items-center justify-between" style={{ borderColor: themeStyles.border }}>
                  <span>OmniView 流式排版引擎</span>
                  <span className="text-emerald-500 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> 设置已实时持久化
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 元数据详情抽屉 */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
            title="书籍出版元数据"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* 全屏切换 */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition hidden sm:block"
            title={isFullscreen ? '退出全屏' : '沉浸全屏阅读'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 顶部阅读进度指示条 */}
      <div className="w-full h-1 bg-black/10 dark:bg-white/10 shrink-0">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* 阅读器主视口区域 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧：目录导航抽屉 (TOC Drawer) */}
        {showToc && (
          <aside
            className="w-72 sm:w-80 h-full border-r flex flex-col z-20 shrink-0 shadow-xl transition-all duration-300"
            style={{
              background: themeStyles.toolbarBg,
              borderColor: themeStyles.border,
            }}
          >
            <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: themeStyles.border }}>
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">目录大纲 ({book?.toc.length || 0})</h3>
              </div>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 目录快速检索 */}
            <div className="p-2 border-b" style={{ borderColor: themeStyles.border }}>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/5 dark:bg-white/5 border text-xs" style={{ borderColor: themeStyles.border }}>
                <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
                <input
                  type="text"
                  placeholder="搜索章节标题..."
                  value={tocSearch}
                  onChange={e => setTocSearch(e.target.value)}
                  className="bg-transparent border-none outline-hidden w-full text-xs placeholder:opacity-40"
                />
                {tocSearch && (
                  <button onClick={() => setTocSearch('')} className="opacity-50 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 目录列表 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredToc.length > 0 ? (
                filteredToc.map((item, idx) => {
                  const targetFile = item.href.split('#')[0];
                  const isCurrent = currentChapter?.href.split('#')[0] === targetFile;
                  return (
                    <button
                      key={`${item.href}-${idx}`}
                      onClick={() => jumpToToc(item)}
                      style={{ paddingLeft: '8px' }}
                      className={`w-full py-1.5 pr-2 rounded text-left text-xs transition flex items-center justify-between ${
                        isCurrent
                          ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ml-2" />}
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs opacity-50">未检索到匹配章节</div>
              )}
            </div>
          </aside>
        )}

        {/* 右侧：电子书元数据抽屉 (Info Drawer) */}
        {showInfo && (
          <aside
            className="absolute right-0 top-0 bottom-0 w-80 border-l p-4 flex flex-col z-20 shadow-2xl overflow-y-auto"
            style={{
              background: themeStyles.paper,
              borderColor: themeStyles.border,
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: themeStyles.border }}>
              <h3 className="text-xs font-bold uppercase tracking-wider">电子书出版元数据</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {book?.metadata?.coverDataUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={book.metadata.coverDataUrl}
                  alt="Book Cover"
                  className="max-h-48 rounded shadow-lg object-contain border"
                  style={{ borderColor: themeStyles.border }}
                />
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">书名 / Title</span>
                <p className="font-semibold text-sm">{book?.metadata?.title || '未知'}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">作者 / Creator</span>
                <p>{book?.metadata?.creator || '未记录'}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">出版社 / Publisher</span>
                <p>{book?.metadata?.publisher || '未记录'}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">语言 / Language</span>
                <p className="font-mono">{book?.metadata?.language || 'und'}</p>
              </div>

              {book?.metadata?.description && (
                <div>
                  <span className="text-[10px] font-mono opacity-50 block uppercase">内容简介 / Description</span>
                  <p className="opacity-80 text-[11px] leading-relaxed mt-1 max-h-40 overflow-y-auto">
                    {book.metadata.description}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t space-y-1 font-mono text-[10px] opacity-50" style={{ borderColor: themeStyles.border }}>
                <div>总章节数: {book?.chapters.length || 0}</div>
                <div>目录索引条目: {book?.toc.length || 0}</div>
                <div>文件大小: {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : '标准 EPUB 载荷'}</div>
              </div>
            </div>
          </aside>
        )}

        {/* 正文主视口 */}
        <main
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-hidden flex flex-col items-center relative p-2 sm:p-5"
        >
          {isPaginatedMode ? (
            /* ====================================================================
               双叶并排 (Two-Page Spread) 或 单页流式 (Single-Page Flow) 视口
               ==================================================================== */
            <div className="w-full h-full flex flex-col items-center justify-center relative select-text">
              {/* 3D 实体书页容器 */}
              <div
                className={`w-full ${maxWidthClass} h-[calc(100%-48px)] rounded-xl border shadow-2xl relative flex overflow-hidden epub-spread-container transition-all duration-300`}
                style={{
                  background: themeStyles.paper,
                  borderColor: themeStyles.border,
                }}
              >
                {/* 仅在双叶模式且宽屏时渲染书脊中缝光影 (Book Spine Center Crease) */}
                {settings.flowMode === 'spread' && !isNarrowViewport && (
                  <>
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 pointer-events-none z-20 epub-book-spine-shadow" />
                    <div
                      className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px pointer-events-none z-20 opacity-30"
                      style={{ background: themeStyles.border }}
                    />
                  </>
                )}

                {/* 翻书效果动效层 (3D Flipping Page Layer) */}
                {flipDirection === 'next' && (
                  <div
                    className={`absolute inset-y-0 right-0 ${
                      settings.flowMode === 'spread' && !isNarrowViewport ? 'w-1/2 rounded-r-xl' : 'w-full rounded-xl'
                    } pointer-events-none z-30 animate-epub-flip-next overflow-hidden shadow-2xl`}
                    style={{
                      background: themeStyles.paper,
                      borderLeft: `1px solid ${themeStyles.border}`,
                    }}
                  >
                    <div className="w-full h-full p-6 sm:p-10 opacity-30 blur-[0.5px]">
                      <div className="text-xs font-mono opacity-50 mb-4">PAGE FLIP...</div>
                      <div className="h-3 w-3/4 bg-slate-400/20 rounded mb-3" />
                      <div className="h-3 w-5/6 bg-slate-400/20 rounded mb-3" />
                      <div className="h-3 w-2/3 bg-slate-400/20 rounded mb-3" />
                      <div className="h-3 w-4/5 bg-slate-400/20 rounded mb-3" />
                    </div>
                  </div>
                )}

                {flipDirection === 'prev' && (
                  <div
                    className={`absolute inset-y-0 left-0 ${
                      settings.flowMode === 'spread' && !isNarrowViewport ? 'w-1/2 rounded-l-xl' : 'w-full rounded-xl'
                    } pointer-events-none z-30 animate-epub-flip-prev overflow-hidden shadow-2xl`}
                    style={{
                      background: themeStyles.paper,
                      borderRight: `1px solid ${themeStyles.border}`,
                    }}
                  >
                    <div className="w-full h-full p-6 sm:p-10 opacity-30 blur-[0.5px]">
                      <div className="text-xs font-mono opacity-50 mb-4">PAGE FLIP...</div>
                      <div className="h-3 w-3/4 bg-slate-400/20 rounded mb-3" />
                      <div className="h-3 w-5/6 bg-slate-400/20 rounded mb-3" />
                      <div className="h-3 w-2/3 bg-slate-400/20 rounded mb-3" />
                      <div className="h-3 w-4/5 bg-slate-400/20 rounded mb-3" />
                    </div>
                  </div>
                )}

                {/* 纸张微弱光影渐变 */}
                {settings.flowMode === 'spread' && !isNarrowViewport && (
                  <>
                    <div className="absolute inset-y-0 left-0 w-1/2 pointer-events-none z-10 epub-page-left-sheen" />
                    <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none z-10 epub-page-right-sheen" />
                  </>
                )}

                {/* 流式分页容器 (CSS Multi-Column 流式排版引擎) */}
                <div
                  ref={spreadColumnsWrapperRef}
                  className="w-full h-full relative overflow-hidden transition-transform duration-300 ease-out"
                >
                  <div
                    className="h-full transition-transform duration-300 ease-out"
                    style={{
                      transform: `translateX(-${currentPageIndex * 100}%)`,
                    }}
                  >
                    <article
                      className="h-full px-6 sm:px-12 py-8 box-border"
                      style={{
                        columns: effectiveColumnsCount,
                        columnGap: effectiveColumnsCount === '2' ? '64px' : '0px',
                        columnRule: effectiveColumnsCount === '2' ? `1px dashed ${themeStyles.border}` : 'none',
                        columnFill: 'auto',
                        height: '100%',
                      }}
                    >
                      {/* 章节标题头 */}
                      {currentChapter && (
                        <div className="mb-6 pb-3 border-b break-inside-avoid-column" style={{ borderColor: themeStyles.border }}>
                          <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest mb-1">
                            Chapter {currentChapterIndex + 1} of {totalChapters}
                          </div>
                          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                            {currentChapter.title}
                          </h1>
                        </div>
                      )}

                      {/* 章节 HTML 正文渲染 */}
                      {currentChapter && (
                        <div
                          className="epub-rendered-content leading-relaxed"
                          style={{
                            fontSize: `${settings.fontSize}px`,
                            lineHeight: settings.lineHeight,
                            textAlign: settings.textAlign,
                          }}
                          dangerouslySetInnerHTML={{ __html: currentChapter.htmlContent }}
                        />
                      )}
                    </article>
                  </div>
                </div>

                {/* 悬浮边缘翻页触发区 (左右透明点击区) */}
                <button
                  onClick={goToPrev}
                  disabled={currentChapterIndex <= 0 && currentPageIndex <= 0}
                  className="absolute inset-y-0 left-0 w-16 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 hover:opacity-100 flex items-center justify-start pl-2 z-20 transition group disabled:pointer-events-none"
                  title={t('epubPrevPage', locale)}
                >
                  <div className="p-2 rounded-full bg-black/40 text-white backdrop-blur-xs group-hover:scale-110 transition">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                </button>

                <button
                  onClick={goToNext}
                  disabled={currentChapterIndex >= totalChapters - 1 && currentPageIndex >= totalSpreadPages - 1}
                  className="absolute inset-y-0 right-0 w-16 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 hover:opacity-100 flex items-center justify-end pr-2 z-20 transition group disabled:pointer-events-none"
                  title={t('epubNextPage', locale)}
                >
                  <div className="p-2 rounded-full bg-black/40 text-white backdrop-blur-xs group-hover:scale-110 transition">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
              </div>

              {/* 底部翻页控制器 */}
              <div
                className={`w-full ${maxWidthClass} h-12 flex items-center justify-between px-2 sm:px-4 text-xs select-none`}
              >
                <button
                  onClick={goToPrev}
                  disabled={currentChapterIndex <= 0 && currentPageIndex <= 0}
                  className="px-3 py-1.5 rounded-lg border flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition"
                  style={{ borderColor: themeStyles.border }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>上一页</span>
                </button>

                <div className="flex items-center gap-2 font-mono text-[11px] opacity-70">
                  <span>
                    第 {currentChapterIndex + 1}/{totalChapters} 章 · 页码 {currentPageIndex + 1}/{totalSpreadPages}
                  </span>
                  <span>·</span>
                  <span>进度 {readingProgress}%</span>
                </div>

                <button
                  onClick={goToNext}
                  disabled={currentChapterIndex >= totalChapters - 1 && currentPageIndex >= totalSpreadPages - 1}
                  className="px-3 py-1.5 rounded-lg border flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-transparent disabled:opacity-30 disabled:pointer-events-none transition shadow-xs"
                >
                  <span>下一页</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* ====================================================================
               连续流式滚动模式 (Continuous Flow Scroll Mode)
               ==================================================================== */
            <div className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center">
              <article
                className={`w-full ${maxWidthClass} transition-all duration-200 my-4`}
              >
                {/* 章节标题头 */}
                {currentChapter && (
                  <div className="mb-8 pb-4 border-b" style={{ borderColor: themeStyles.border }}>
                    <div className="text-xs font-mono opacity-50 uppercase tracking-widest mb-2">
                      Chapter {currentChapterIndex + 1} of {totalChapters}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {currentChapter.title}
                    </h1>
                  </div>
                )}

                {/* 章节 HTML 正文渲染 */}
                {currentChapter && (
                  <div
                    className="epub-rendered-content leading-relaxed"
                    style={{
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: settings.lineHeight,
                      textAlign: settings.textAlign,
                    }}
                    dangerouslySetInnerHTML={{ __html: currentChapter.htmlContent }}
                  />
                )}

                {/* 底栏翻章导航与进度卡片 */}
                <div
                  className="mt-16 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs select-none"
                  style={{ borderColor: themeStyles.border }}
                >
                  <button
                    onClick={goToPrev}
                    disabled={currentChapterIndex <= 0}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition"
                    style={{ borderColor: themeStyles.border }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>上一章</span>
                  </button>

                  <div className="text-center font-mono text-[11px] opacity-60">
                    进度 {readingProgress}% · 第 {currentChapterIndex + 1} / {totalChapters} 节
                  </div>

                  <button
                    onClick={goToNext}
                    disabled={currentChapterIndex >= totalChapters - 1}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg border flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white border-transparent disabled:opacity-30 disabled:pointer-events-none transition shadow-xs"
                  >
                    <span>下一章</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            </div>
          )}
        </main>
      </div>

      {/* 注入流式排版专属样式 (字体、段落首行缩进、引用、表格与防冲突隔离) */}
      <style>{`
        .epub-rendered-content {
          font-family: ${fontFamilyCss};
        }
        .epub-rendered-content p {
          margin-bottom: 1.25em;
          text-indent: ${settings.textIndent ? '2em' : '0'};
        }
        .epub-rendered-content h1,
        .epub-rendered-content h2,
        .epub-rendered-content h3,
        .epub-rendered-content h4 {
          font-weight: 700;
          margin-top: 1.6em;
          margin-bottom: 0.6em;
          line-height: 1.3;
          text-indent: 0 !important;
        }
        .epub-rendered-content h1 { font-size: 1.8em; }
        .epub-rendered-content h2 { font-size: 1.5em; }
        .epub-rendered-content h3 { font-size: 1.25em; }
        .epub-rendered-content ul,
        .epub-rendered-content ol {
          margin-left: 1.5em;
          margin-bottom: 1.25em;
          text-indent: 0 !important;
        }
        .epub-rendered-content li {
          margin-bottom: 0.4em;
          text-indent: 0 !important;
        }
        .epub-rendered-content ul { list-style-type: disc; }
        .epub-rendered-content ol { list-style-type: decimal; }
        .epub-rendered-content blockquote {
          border-left: 3px solid currentColor;
          opacity: 0.85;
          padding-left: 1em;
          margin: 1.25em 0;
          font-style: italic;
          text-indent: 0 !important;
        }
        .epub-rendered-content img {
          max-width: 100%;
          height: auto;
          margin: 1.5em auto;
          display: block;
          border-radius: 6px;
        }
        .epub-rendered-content code {
          padding: 0.15em 0.35em;
          background: rgba(125, 125, 125, 0.15);
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 0.9em;
        }
        .epub-rendered-content pre {
          padding: 1em;
          background: rgba(125, 125, 125, 0.12);
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1.25em;
          text-indent: 0 !important;
        }
        .epub-rendered-content pre code {
          background: transparent;
          padding: 0;
        }
        .epub-rendered-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5em 0;
        }
        .epub-rendered-content th,
        .epub-rendered-content td {
          border: 1px solid rgba(125, 125, 125, 0.2);
          padding: 0.5em 0.75em;
          text-align: left;
        }
        .epub-rendered-content th {
          background: rgba(125, 125, 125, 0.1);
        }
      `}</style>
    </div>
  );
};
