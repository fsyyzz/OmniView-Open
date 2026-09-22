/**
 * OmniView EPUB 阅读器核心逻辑 Hook (useEpubReader)
 * 封装 EPUB 数据解析、流式分页几何换算、阅读进度持久化与跨章节跳转
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  parseEpub,
  generateSampleEpubBytes,
  type ParsedEpubBook,
  type EpubChapter,
} from '../lib/epubEngine';
import {
  loadEpubSettings,
  saveEpubSettings,
  loadEpubProgress,
  saveEpubProgress,
  type EpubReaderSettings,
} from '../lib/epubSettingsStorage';
import { Locale } from '../../../shared/lib/i18n';

export interface UseEpubReaderOptions {
  binaryUrl?: string;
  content?: string;
  fileName?: string;
  locale?: Locale;
}

export function useEpubReader({
  binaryUrl,
  content,
  fileName = 'ebook.epub',
  locale = 'zh-CN',
}: UseEpubReaderOptions = {}) {
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

  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(false);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(0);
  const [progressRestoredToast, setProgressRestoredToast] = useState<string | null>(null);
  const [scrollProgressPercent, setScrollProgressPercent] = useState<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const continuousScrollContainerRef = useRef<HTMLDivElement>(null);
  const spreadColumnsWrapperRef = useRef<HTMLDivElement>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredProgressRef = useRef<boolean>(false);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollSpyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 实际生效的多列列数：双叶且宽屏时 2 栏，否则 1 栏
  const effectiveColumnsCount = settings.flowMode === 'spread' && !isNarrowViewport ? '2' : '1';
  const columnGapPx = effectiveColumnsCount === '2' ? 48 : 32;
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

  const isPaginatedMode = settings.flowMode === 'spread' || settings.flowMode === 'single';

  // 视口宽度监听与流式多列分页总页数计算
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

    const narrow = clientW < 640;
    setIsNarrowViewport(narrow);

    const cols = settings.flowMode === 'spread' && !narrow ? 2 : 1;
    const gap = cols === 2 ? 48 : 32;
    const colWidth = cols === 2 ? Math.max(1, (clientW - gap) / 2) : clientW;
    const colStep = colWidth + gap;

    if (clientW > 0 && scrollW > 0 && colStep > 0) {
      const rawCols = Math.round((scrollW + gap - 4) / colStep);
      const computedCols = Math.max(1, rawCols);
      const pages = cols === 2 ? Math.max(1, Math.ceil(computedCols / 2)) : computedCols;

      setTotalSpreadPages(pages);
      setCurrentPageIndex(prev => Math.min(prev, Math.max(0, pages - 1)));
    }
  }, [isPaginatedMode, settings.flowMode]);

  useEffect(() => {
    if (!spreadColumnsWrapperRef.current || !isPaginatedMode) return;
    const el = spreadColumnsWrapperRef.current;
    const ro = new ResizeObserver(() => {
      recalculateSpreadPages();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalculateSpreadPages, isPaginatedMode]);

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

  const handleContinuousScroll = useCallback(() => {
    if (isPaginatedMode || !continuousScrollContainerRef.current) return;
    const container = continuousScrollContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
      setScrollProgressPercent(pct);
    }

    const sectionNodes = container.querySelectorAll<HTMLElement>('.epub-chapter-section');
    if (sectionNodes.length === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    let activeIndex = 0;

    for (let i = 0; i < sectionNodes.length; i++) {
      const node = sectionNodes[i];
      const rect = node.getBoundingClientRect();
      const relativeTop = rect.top - containerTop;
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

  const triggerFlipTransition = useCallback((direction: 'next' | 'prev', callback: () => void) => {
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
  }, [settings.enableFlipEffect, isPaginatedMode]);

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
  }, [isPaginatedMode, currentPageIndex, currentChapterIndex, triggerFlipTransition, scrollToChapter]);

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
    triggerFlipTransition,
    scrollToChapter,
  ]);

  return {
    book,
    loading,
    error,
    loadEpubData,
    settings,
    setSettings,
    updateSetting,
    currentChapterIndex,
    setCurrentChapterIndex,
    currentPageIndex,
    setCurrentPageIndex,
    totalSpreadPages,
    flipDirection,
    progressRestoredToast,
    readingProgress,
    effectiveColumnsCount,
    columnGapPx,
    pageStepPx,
    pageTranslationX,
    isNarrowViewport,
    viewportWidth,
    viewportHeight,
    isPaginatedMode,
    currentChapter,
    totalChapters,
    goToPrev,
    goToNext,
    scrollToChapter,
    handleContinuousScroll,
    recalculateSpreadPages,
    spreadColumnsWrapperRef,
    scrollContainerRef,
    continuousScrollContainerRef,
  };
}
