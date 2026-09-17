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
  ChevronLeft,
  ChevronRight,
  Check,
  BookOpen,
  Info,
  RotateCcw,
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
import { EpubToolbar } from './epub/EpubToolbar';
import { EpubTocSidebar } from './epub/EpubTocSidebar';
import { EpubInfoModal } from './epub/EpubInfoModal';

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
  theme,
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
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(0);
  const [progressRestoredToast, setProgressRestoredToast] = useState<string | null>(null);
  const [scrollProgressPercent, setScrollProgressPercent] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const continuousScrollContainerRef = useRef<HTMLDivElement>(null);
  const spreadColumnsWrapperRef = useRef<HTMLDivElement>(null);
  const typographyMenuRef = useRef<HTMLDivElement>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredProgressRef = useRef<boolean>(false);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollSpyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 实际生效的多列列数：双叶且宽屏时 2 栏，否则 1 栏
  const effectiveColumnsCount = settings.flowMode === 'spread' && !isNarrowViewport ? '2' : '1';
  // 双叶排版列间距 48px，单页排版列间距 32px
  const columnGapPx = effectiveColumnsCount === '2' ? 48 : 32;
  // 翻页物理步长：单页跨越宽度 = 视口宽度 + 跨页间距
  const pageStepPx = viewportWidth > 0 ? viewportWidth + columnGapPx : 0;
  const pageTranslationX = currentPageIndex * pageStepPx;

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

  // 视口宽度监听与流式多列分页总页数计算 (基于 CSS Multi-Column 物理步长)
  const recalculateSpreadPages = useCallback(() => {
    if (!isPaginatedMode || !spreadColumnsWrapperRef.current) {
      setTotalSpreadPages(1);
      return;
    }
    const el = spreadColumnsWrapperRef.current;
    const clientW = el.clientWidth;
    const clientH = el.clientHeight;
    const scrollW = el.scrollWidth;

    if (clientW <= 0) return;

    setViewportWidth(clientW);
    setViewportHeight(clientH);

    // 检查是否极窄屏幕 (< 640px 强制退化为单列)
    const narrow = clientW < 640;
    setIsNarrowViewport(narrow);

    const cols = settings.flowMode === 'spread' && !narrow ? 2 : 1;
    const gap = cols === 2 ? 48 : 32;
    const colWidth = cols === 2 ? Math.max(1, (clientW - gap) / 2) : clientW;
    const colStep = colWidth + gap;

    if (clientW > 0 && scrollW > 0 && colStep > 0) {
      // CSS Multi-Column 理论几何关系:
      // scrollW = N * colWidth + (N - 1) * gap = N * colStep - gap
      // 故 N = (scrollW + gap) / colStep
      // 减去 4px 弹性容差缓冲以平抑亚像素与浮点舍入误差
      const rawCols = Math.round((scrollW + gap - 4) / colStep);
      const computedCols = Math.max(1, rawCols);
      const pages = cols === 2 ? Math.max(1, Math.ceil(computedCols / 2)) : computedCols;

      setTotalSpreadPages(pages);
      setCurrentPageIndex(prev => Math.min(prev, Math.max(0, pages - 1)));
    }
  }, [isPaginatedMode, settings.flowMode]);

  // 监听多列视口容器真实几何尺寸变动 (包含侧边栏切换、全屏开合、窗口缩放)
  useEffect(() => {
    if (!spreadColumnsWrapperRef.current || !isPaginatedMode) return;
    const el = spreadColumnsWrapperRef.current;
    const ro = new ResizeObserver(() => {
      recalculateSpreadPages();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalculateSpreadPages, isPaginatedMode]);

  // 排版变化或窗口大小变动时多阶重算分页
  useEffect(() => {
    recalculateSpreadPages();
    const rafId = requestAnimationFrame(() => {
      recalculateSpreadPages();
    });
    const timer = setTimeout(recalculateSpreadPages, 80);
    const handleResize = () => {
      recalculateSpreadPages();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    recalculateSpreadPages,
    currentChapterIndex,
    settings.flowMode,
    settings.fontSize,
    settings.lineHeight,
    settings.contentWidth,
    settings.fontFamily,
    settings.textIndent,
    settings.textAlign,
  ]);

  // 平滑滚动至指定章节 (连续流式滚动模式专属)
  const scrollToChapter = useCallback((targetIndex: number, behavior: ScrollBehavior = 'smooth') => {
    if (!book || book.chapters.length === 0) return;
    const clamped = Math.max(0, Math.min(book.chapters.length - 1, targetIndex));
    isUserScrollingRef.current = false;
    setCurrentChapterIndex(clamped);
    if (!isPaginatedMode) {
      const el = document.getElementById(`epub-chapter-node-${clamped}`);
      if (el) {
        el.scrollIntoView({ behavior, block: 'start' });
      }
    }
  }, [book, isPaginatedMode]);

  // 连续流式滚动模式下的滚动位置与章节探针监听 (Scroll Spy)
  const handleContinuousScroll = useCallback(() => {
    if (isPaginatedMode || !continuousScrollContainerRef.current) return;
    const container = continuousScrollContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
      setScrollProgressPercent(pct);
    }

    // 查找当前视口中正在阅读的章节
    const sectionNodes = container.querySelectorAll<HTMLElement>('.epub-chapter-section');
    if (sectionNodes.length === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    let activeIndex = 0;

    for (let i = 0; i < sectionNodes.length; i++) {
      const node = sectionNodes[i];
      const rect = node.getBoundingClientRect();
      const relativeTop = rect.top - containerTop;
      // 当章节顶部穿过视口阅读线（顶部下方 160px）
      if (relativeTop <= 160) {
        activeIndex = i;
      } else {
        break;
      }
    }

    if (activeIndex !== currentChapterIndex) {
      isUserScrollingRef.current = true;
      setCurrentChapterIndex(activeIndex);
      if (scrollSpyTimerRef.current) {
        clearTimeout(scrollSpyTimerRef.current);
      }
      scrollSpyTimerRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 200);
    }
  }, [isPaginatedMode, currentChapterIndex]);

  // 章节切换
  useEffect(() => {
    if (isPaginatedMode) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      setCurrentPageIndex(0);
      const rafId = requestAnimationFrame(() => {
        recalculateSpreadPages();
      });
      const timer = setTimeout(recalculateSpreadPages, 80);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    }
  }, [currentChapterIndex, isPaginatedMode, recalculateSpreadPages]);

  const currentChapter: EpubChapter | undefined = book?.chapters[currentChapterIndex];
  const totalChapters = book?.chapters.length || 0;

  // 总阅读百分比
  const readingProgress = useMemo(() => {
    if (totalChapters <= 0) return 0;
    if (isPaginatedMode) {
      const chapterFraction = (currentPageIndex + 1) / Math.max(1, totalSpreadPages);
      return Math.min(100, Math.round(((currentChapterIndex + chapterFraction) / totalChapters) * 100));
    }
    if (scrollProgressPercent > 0) {
      return scrollProgressPercent;
    }
    return Math.min(100, Math.round(((currentChapterIndex + 1) / totalChapters) * 100));
  }, [totalChapters, isPaginatedMode, currentChapterIndex, currentPageIndex, totalSpreadPages, scrollProgressPercent]);

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
        scrollToChapter(currentChapterIndex - 1, 'smooth');
      }
    }
  }, [isPaginatedMode, currentPageIndex, currentChapterIndex, settings.enableFlipEffect, scrollToChapter]);

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
        scrollToChapter(currentChapterIndex + 1, 'smooth');
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
    scrollToChapter,
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

  // 循环切换多种版心宽度 (标准 720/880px -> 宽幅 960/1180px -> 全幅 100%)
  const cycleContentWidth = useCallback(() => {
    const order: EpubContentWidth[] = ['standard', 'wide', 'full'];
    const nextWidth = order[(order.indexOf(settings.contentWidth) + 1) % order.length];
    updateSetting('contentWidth', nextWidth);
    setTimeout(recalculateSpreadPages, 50);
  }, [settings.contentWidth, updateSetting, recalculateSpreadPages]);

  // 目录跳转：高容错路径匹配，桌面端选定章节后保持目录常驻打开，窄屏移动端才自动收起
  const jumpToToc = (tocItem: EpubTocItem) => {
    if (!book || book.chapters.length === 0) return;
    const rawTarget = tocItem.href.split('#')[0];
    const cleanTarget = decodeURIComponent(rawTarget.replace(/^\.\//, ''));
    const targetBaseName = cleanTarget.split('/').pop()?.toLowerCase();

    // 1. 精确相对路径匹配
    let foundIndex = book.chapters.findIndex(ch => {
      const cleanCh = decodeURIComponent(ch.href.split('#')[0].replace(/^\.\//, ''));
      return cleanCh === cleanTarget;
    });

    // 2. 文件名基名降级匹配 (例如 text/ch01.xhtml 匹配 ch01.xhtml)
    if (foundIndex === -1 && targetBaseName) {
      foundIndex = book.chapters.findIndex(ch => {
        const chBaseName = ch.href.split('#')[0].split('/').pop()?.toLowerCase();
        return chBaseName === targetBaseName;
      });
    }

    // 3. 按 spine/item ID 匹配
    if (foundIndex === -1 && tocItem.id) {
      foundIndex = book.chapters.findIndex(ch => ch.id === tocItem.id);
    }

    // 4. 按章节标题全等匹配
    if (foundIndex === -1 && tocItem.label) {
      foundIndex = book.chapters.findIndex(ch => ch.title.trim() === tocItem.label.trim());
    }

    if (foundIndex !== -1) {
      if (isPaginatedMode) {
        setCurrentChapterIndex(foundIndex);
        setCurrentPageIndex(0);
      } else {
        scrollToChapter(foundIndex, 'smooth');
      }
      // 桌面端保持目录常驻展开（方便用户连续浏览大纲），仅在小屏移动设备 (< 640px) 遮挡全文时才自动收起
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        setShowToc(false);
      }
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

  // 实际生效的阅读器主题：若设置为 'auto'，则无缝跟随全局工作台与宿主主题；否则使用专属独立阅读主题
  const effectiveTheme: ThemeId = useMemo(() => {
    if (settings.readerTheme === 'auto') {
      return theme || 'dark';
    }
    return settings.readerTheme as ThemeId;
  }, [settings.readerTheme, theme]);

  // 主题色彩计算 (100% 依托 OmniView 整体主题与 --ov-* 设计令牌，保持与工作台及全应用主题统一)
  const themeStyles = useMemo(() => ({
    bg: 'var(--ov-bg)',
    paper: 'var(--ov-surface)',
    text: 'var(--ov-text)',
    subtext: 'var(--ov-text-secondary)',
    border: 'var(--ov-border)',
    accent: 'var(--ov-accent)',
    toolbarBg: 'var(--ov-surface-header)',
    codeBg: 'var(--ov-code-bg)',
  }), []);

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
      data-theme={effectiveTheme}
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
      <EpubToolbar
        bookTitle={book?.metadata?.title || fileName}
        isPaginatedMode={isPaginatedMode}
        currentPageIndex={currentPageIndex}
        totalSpreadPages={totalSpreadPages}
        currentChapterIndex={currentChapterIndex}
        totalChapters={totalChapters}
        showToc={showToc}
        showInfo={showInfo}
        showTypographyMenu={showTypographyMenu}
        isFullscreen={isFullscreen}
        settings={settings}
        theme={theme}
        locale={locale}
        themeStyles={themeStyles}
        typographyMenuRef={typographyMenuRef}
        onToggleToc={() => setShowToc(!showToc)}
        onToggleInfo={() => setShowInfo(!showInfo)}
        onToggleTypographyMenu={() => setShowTypographyMenu(!showTypographyMenu)}
        onToggleFullscreen={toggleFullscreen}
        onGoToPrev={goToPrev}
        onGoToNext={goToNext}
        onUpdateSetting={updateSetting}
        onResetSettings={setSettings}
        onRecalculatePages={recalculateSpreadPages}
        onScrollToChapter={(idx) => {
          setTimeout(() => {
            const targetEl = document.getElementById(`epub-chapter-node-${idx}`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
          }, 60);
        }}
      />

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
        <EpubTocSidebar
          showToc={showToc}
          toc={book?.toc || []}
          filteredToc={filteredToc}
          tocSearch={tocSearch}
          currentChapter={currentChapter}
          themeStyles={themeStyles}
          onClose={() => setShowToc(false)}
          onSearchChange={setTocSearch}
          onJumpToToc={jumpToToc}
        />

        {/* 右侧：电子书元数据抽屉 (Info Drawer) */}
        <EpubInfoModal
          showInfo={showInfo}
          book={book}
          fileSize={fileSize}
          themeStyles={themeStyles}
          onClose={() => setShowInfo(false)}
        />

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

                {/* 装订内边距舞台 (Content Stage)：四周提供均一对称留白，消除单侧 padding 导致的跨页漂移与截断 */}
                <div className="w-full h-full p-4 sm:p-6 lg:p-8 flex flex-col box-border overflow-hidden relative">
                  {/* 流式分页视口容器 (CSS Multi-Column 流式排版引擎) */}
                  <div
                    ref={spreadColumnsWrapperRef}
                    className="w-full h-full relative overflow-hidden"
                  >
                    <div
                      className="h-full transition-transform duration-300 ease-out"
                      style={{
                        transform: `translateX(-${pageTranslationX}px)`,
                      }}
                    >
                      <article
                        className="h-full box-border"
                        style={{
                          columns: effectiveColumnsCount,
                          columnGap: `${columnGapPx}px`,
                          columnRule: effectiveColumnsCount === '2' ? `1px dashed ${themeStyles.border}` : 'none',
                          columnFill: 'auto',
                          height: '100%',
                          padding: 0,
                        }}
                      >
                        {/* 章节标题头 */}
                        {currentChapter && (
                          <div className="mb-5 pb-2 border-b break-inside-avoid-column" style={{ borderColor: themeStyles.border }}>
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
               连续流式滚动模式 (Continuous Flow Scroll Mode - 全书无缝纵向连滚)
               ==================================================================== */
            <div
              ref={continuousScrollContainerRef}
              onScroll={handleContinuousScroll}
              className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center px-3 sm:px-6 relative scroll-smooth"
            >
              <article className={`w-full ${maxWidthClass} transition-all duration-200 py-4`}>
                {book?.chapters.map((chapter, idx) => (
                  <section
                    key={chapter.id || `chapter-section-${idx}`}
                    id={`epub-chapter-node-${idx}`}
                    data-chapter-index={idx}
                    className="epub-chapter-section py-8 first:pt-2"
                  >
                    {/* 章节过桥分割线 (第一章后呈现) */}
                    {idx > 0 && (
                      <div className="my-14 flex items-center justify-center gap-4 select-none opacity-40 hover:opacity-75 transition">
                        <div className="h-px bg-current flex-1" />
                        <div className="flex items-center gap-2 text-[11px] font-mono tracking-widest uppercase px-3.5 py-1 rounded-full border border-current/20 bg-black/5 dark:bg-white/5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          <span>Chapter {idx + 1}</span>
                        </div>
                        <div className="h-px bg-current flex-1" />
                      </div>
                    )}

                    {/* 章节标题头 */}
                    <div className="mb-6 pb-4 border-b flex items-baseline justify-between" style={{ borderColor: themeStyles.border }}>
                      <div>
                        <div className="text-[11px] font-mono opacity-50 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                          <span>Chapter {idx + 1} of {totalChapters}</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                          {chapter.title}
                        </h2>
                      </div>
                      <span className="text-xs font-mono opacity-30 font-medium shrink-0 ml-4">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* 章节 HTML 正文渲染 */}
                    <div
                      className="epub-rendered-content leading-relaxed"
                      style={{
                        fontSize: `${settings.fontSize}px`,
                        lineHeight: settings.lineHeight,
                        textAlign: settings.textAlign,
                      }}
                      dangerouslySetInnerHTML={{ __html: chapter.htmlContent }}
                    />
                  </section>
                ))}

                {/* 全书完结装帧卡片 */}
                {book && (
                  <div
                    className="mt-16 mb-20 p-8 rounded-2xl border text-center select-none"
                    style={{ borderColor: themeStyles.border, background: 'rgba(125, 125, 125, 0.05)' }}
                  >
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{book.metadata.title || '全书阅读完毕'}</h3>
                    <p className="text-xs opacity-60 mb-6 font-mono">
                      {book.metadata.creator ? `作者：${book.metadata.creator} · ` : ''}全书共 {totalChapters} 章节已全部载入
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => scrollToChapter(0, 'smooth')}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-2 transition shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>回到书首重新阅读</span>
                      </button>
                    </div>
                  </div>
                )}
              </article>

              {/* 连续滚动浮动状态与快捷跳章小工具栏 */}
              <div
                className="sticky bottom-4 z-20 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md flex items-center gap-3 text-xs select-none"
                style={{
                  background: themeStyles.paper,
                  borderColor: themeStyles.border,
                }}
              >
                <button
                  onClick={goToPrev}
                  disabled={currentChapterIndex <= 0}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition"
                  title="上一章"
                  aria-label="上一章"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] opacity-75">
                  第 {currentChapterIndex + 1}/{totalChapters} 章 · {readingProgress}%
                </span>
                <button
                  onClick={goToNext}
                  disabled={currentChapterIndex >= totalChapters - 1}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition"
                  title="下一章"
                  aria-label="下一章"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 注入流式排版专属样式 (字体、段落首行缩进、引用、表格与防冲突隔离) */}
      <style>{`
        .epub-chapter-section {
          content-visibility: auto;
          contain-intrinsic-size: 1px 800px;
        }
        .epub-rendered-content {
          font-family: ${fontFamilyCss};
          orphans: 2;
          widows: 2;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          color: var(--ov-text) !important;
        }
        .epub-rendered-content p,
        .epub-rendered-content div:not(.callout),
        .epub-rendered-content span,
        .epub-rendered-content li,
        .epub-rendered-content dd,
        .epub-rendered-content dt,
        .epub-rendered-content section,
        .epub-rendered-content article {
          color: var(--ov-text);
        }
        .epub-rendered-content p {
          margin-top: 0;
          margin-bottom: 0.85em;
          text-indent: ${settings.textIndent ? '2em' : '0'};
          word-break: break-word;
          overflow-wrap: break-word;
          line-height: inherit;
        }
        .epub-rendered-content h1,
        .epub-rendered-content h2,
        .epub-rendered-content h3,
        .epub-rendered-content h4,
        .epub-rendered-content h5,
        .epub-rendered-content h6 {
          color: var(--ov-text) !important;
          font-weight: 700;
          margin-top: 1.2em;
          margin-bottom: 0.5em;
          line-height: 1.35;
          text-indent: 0 !important;
          break-after: avoid-column;
          page-break-after: avoid;
          break-inside: avoid-column;
        }
        .epub-rendered-content h1 { font-size: 1.8em; }
        .epub-rendered-content h2 { font-size: 1.5em; }
        .epub-rendered-content h3 { font-size: 1.25em; }
        .epub-rendered-content a {
          color: var(--ov-accent) !important;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .epub-rendered-content a:hover {
          opacity: 0.8;
        }
        .epub-rendered-content strong,
        .epub-rendered-content b {
          font-weight: 700;
          color: var(--ov-text) !important;
        }
        .epub-rendered-content ul,
        .epub-rendered-content ol {
          margin-left: 1.5em;
          margin-bottom: 1em;
          text-indent: 0 !important;
          color: var(--ov-text);
        }
        .epub-rendered-content li {
          margin-bottom: 0.35em;
          text-indent: 0 !important;
        }
        .epub-rendered-content ul { list-style-type: disc; }
        .epub-rendered-content ol { list-style-type: decimal; }
        .epub-rendered-content blockquote {
          border-left: 3px solid var(--ov-accent);
          background: var(--ov-quote-bg, rgba(125, 125, 125, 0.08));
          color: var(--ov-text);
          opacity: 0.95;
          padding: 0.5em 1em;
          margin: 1em 0;
          font-style: italic;
          text-indent: 0 !important;
          break-inside: avoid-column;
          page-break-inside: avoid;
          border-radius: 0 4px 4px 0;
        }
        .epub-rendered-content img {
          max-width: 100% !important;
          max-height: 80% !important;
          object-fit: contain;
          margin: 1em auto;
          display: block;
          border-radius: 6px;
          break-inside: avoid-column;
          page-break-inside: avoid;
        }
        .epub-rendered-content code {
          padding: 0.15em 0.35em;
          background: var(--ov-inline-code-bg, rgba(125, 125, 125, 0.15));
          color: var(--ov-inline-code-color, var(--ov-accent)) !important;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 0.9em;
        }
        .epub-rendered-content pre {
          padding: 0.85em;
          background: var(--ov-code-bg, rgba(125, 125, 125, 0.12));
          color: var(--ov-text) !important;
          border: 1px solid var(--ov-border);
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1em;
          text-indent: 0 !important;
          break-inside: avoid-column;
          page-break-inside: avoid;
        }
        .epub-rendered-content pre code {
          background: transparent;
          color: inherit !important;
          padding: 0;
        }
        .epub-rendered-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.25em 0;
          break-inside: avoid-column;
          page-break-inside: avoid;
          color: var(--ov-text);
        }
        .epub-rendered-content th,
        .epub-rendered-content td {
          border: 1px solid var(--ov-border);
          padding: 0.4em 0.6em;
          text-align: left;
          color: var(--ov-text);
        }
        .epub-rendered-content th {
          background: var(--ov-table-th, rgba(125, 125, 125, 0.1));
          font-weight: 600;
        }
        .epub-rendered-content hr {
          border: none;
          border-top: 1px solid var(--ov-border);
          margin: 1.5em 0;
        }
      `}</style>
    </div>
  );
};
