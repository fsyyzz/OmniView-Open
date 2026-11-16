/**
 * OmniView 原生专业 PowerPoint (.pptx) 矢量幻灯片只读演播工作台 (PptxViewer)
 * 基于 OOXML 标准、纯 TS XML AST 内核与 JSZip 纯前端流水线
 * 支持：母版继承、1:1 等比舞台缩放、真实缩略图、平铺总览、全文搜索、Markdown 导出、
 * 系统级打印 PDF 与 F5 全屏激光笔演播 HUD
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  LayoutGrid,
  Grid2x2,
  MessageSquare,
  Info,
  X,
  Play,
  RefreshCw,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Printer,
  Check,
  AlertTriangle,
  EyeOff,
  Crosshair,
  Clock,
} from 'lucide-react';
import {
  parsePptx,
  base64ToBytes,
  pptxToMarkdown,
  buildPptxPrintHtml,
  type ParsedPptxPresentation,
  type PptxSlide,
} from '../../lib/pptxEngine';
import { requestPrintHtml } from '../../../../shared/lib/printBridge';
import type { ThemeId } from '../../../../shared/types';
import { type Locale } from '../../../../shared/lib/i18n';
import { PptxSlideStage } from './pptx/PptxSlideStage';
import { PptxGridOverview } from './pptx/PptxGridOverview';

export interface PptxViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

function slideMatchesQuery(slide: PptxSlide, queryLower: string): boolean {
  if (!queryLower) return false;
  if (slide.title.toLowerCase().includes(queryLower)) return true;
  if (slide.notes && slide.notes.toLowerCase().includes(queryLower)) return true;
  for (const el of slide.elements) {
    if (el.paragraphs) {
      for (const p of el.paragraphs) {
        const text = p.runs.map(r => r.text).join('').toLowerCase();
        if (text.includes(queryLower)) return true;
      }
    }
    if (el.tableRows) {
      for (const row of el.tableRows) {
        for (const cell of row) {
          if (cell.text.toLowerCase().includes(queryLower)) return true;
        }
      }
    }
    if (el.chartData) {
      if (el.chartData.title?.toLowerCase().includes(queryLower)) return true;
      if (el.chartData.categories.some(c => c.toLowerCase().includes(queryLower))) return true;
    }
  }
  return false;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'presentation.pptx',
  fileSize,
  locale = 'zh-CN',
}) => {
  const isEn = locale === 'en-US';

  const [data, setData] = useState<ParsedPptxPresentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomFactor, setZoomFactor] = useState<number>(1);
  const [fitScale, setFitScale] = useState<number>(0.85);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const [laserActive, setLaserActive] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [copiedMd, setCopiedMd] = useState<boolean>(false);
  const [dismissedFallbackBanner, setDismissedFallbackBanner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);
  const loadPresentation = useCallback(() => setReloadNonce(n => n + 1), []);

  // 载入并解析 PPTX (含并发竞态防护与过时结果丢弃)
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setDismissedFallbackBanner(false);

    const run = async () => {
      try {
        let rawData: ArrayBuffer | Uint8Array | string = content || '';

        if (binaryUrl) {
          if (binaryUrl.startsWith('data:') || /^[A-Za-z0-9+/=]/.test(binaryUrl)) {
            rawData = base64ToBytes(binaryUrl);
          } else {
            try {
              const resp = await fetch(binaryUrl);
              rawData = await resp.arrayBuffer();
            } catch {
              rawData = base64ToBytes(binaryUrl);
            }
          }
        }

        const parsed = await parsePptx(rawData);
        if (!isCancelled) {
          setData(parsed);
          setCurrentSlideIndex(0);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('[PptxViewer] 解析失败:', err);
          setError(err instanceof Error ? err.message : 'PPTX 解析异常');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [content, binaryUrl, reloadNonce]);

  const totalSlides = data?.slides.length || 0;
  const slideWidth = data?.metadata?.width || 960;
  const slideHeight = data?.metadata?.height || 540;
  const currentSlide: PptxSlide | undefined = data?.slides[currentSlideIndex];

  // ResizeObserver 计算 1:1 舞台自适应缩放比
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const recalcScale = () => {
      const rect = vp.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const padX = isFullscreen ? 24 : 40;
      const padY = isFullscreen ? 24 : 40;
      const availW = Math.max(160, rect.width - padX);
      const availH = Math.max(120, rect.height - padY);
      const next = Math.min(availW / slideWidth, availH / slideHeight);
      setFitScale(Math.max(0.15, Math.min(2.5, Math.round(next * 1000) / 1000)));
    };

    recalcScale();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => recalcScale());
      ro.observe(vp);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, [slideWidth, slideHeight, showThumbnails, showNotes, isFullscreen]);

  const effectiveScale = Math.max(0.15, Math.min(3.0, fitScale * zoomFactor));

  // 搜索匹配页索引列表
  const { matchedSlideList, matchedSlideSet } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !data?.slides) {
      return { matchedSlideList: [] as number[], matchedSlideSet: new Set<number>() };
    }
    const list: number[] = [];
    const set = new Set<number>();
    data.slides.forEach((slide, idx) => {
      if (slideMatchesQuery(slide, q)) {
        list.push(idx);
        set.add(idx);
      }
    });
    return { matchedSlideList: list, matchedSlideSet: set };
  }, [data, searchQuery]);

  // 搜索关键字变化且当前页未命中时自动跳至首个匹配页
  useEffect(() => {
    if (matchedSlideList.length > 0) {
      setCurrentSlideIndex(prev => (matchedSlideSet.has(prev) ? prev : matchedSlideList[0]));
    }
  }, [matchedSlideList, matchedSlideSet]);

  const goToPrev = useCallback(() => {
    setCurrentSlideIndex(prev => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentSlideIndex(prev => Math.min(Math.max(0, totalSlides - 1), prev + 1));
  }, [totalSlides]);

  const navigateMatch = useCallback(
    (direction: 1 | -1) => {
      if (matchedSlideList.length === 0) return;
      const curPos = matchedSlideList.indexOf(currentSlideIndex);
      if (curPos === -1) {
        setCurrentSlideIndex(matchedSlideList[0]);
        return;
      }
      const nextPos = (curPos + direction + matchedSlideList.length) % matchedSlideList.length;
      setCurrentSlideIndex(matchedSlideList[nextPos]);
    },
    [matchedSlideList, currentSlideIndex]
  );

  // 全屏状态同步
  useEffect(() => {
    const handleFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        setLaserActive(false);
        setElapsedSeconds(0);
      } else {
        setHudVisible(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 全屏演播计时器
  useEffect(() => {
    if (!isFullscreen) return;
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
      setHudVisible(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const bumpHudVisibility = useCallback(() => {
    if (!isFullscreen) return;
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudVisible(false);
    }, 2600);
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, []);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
          return;
        }
        if (showGrid) {
          setShowGrid(false);
          return;
        }
        if (showInfo) {
          setShowInfo(false);
          return;
        }
        if (showNotes) {
          setShowNotes(false);
          return;
        }
      }

      if (isInputFocused) return;

      if (e.key === 'F5') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGrid(prev => !prev);
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLaserActive(prev => !prev);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlideIndex(Math.max(0, totalSlides - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, totalSlides, toggleFullscreen, showSearch, showGrid, showInfo, showNotes]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!data) return;
    const md = pptxToMarkdown(data);
    try {
      await navigator.clipboard?.writeText(md);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      // Clipboard may be restricted in headless mode
    }
  }, [data]);

  const handlePrintPdf = useCallback(() => {
    if (!data) return;
    const html = buildPptxPrintHtml(data, { includeNotes: showNotes });
    requestPrintHtml(fileName || 'presentation.pptx', html, { preferNativeInBrowser: false });
  }, [data, fileName, showNotes]);

  const hiddenSlideCount = useMemo(
    () => data?.slides.filter(s => s.isHidden).length || 0,
    [data]
  );

  const thumbWidth = 176;
  const thumbScale = thumbWidth / Math.max(1, slideWidth);

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpHudVisibility}
      className="w-full h-full flex flex-col overflow-hidden relative select-none font-sans"
      style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' }}
    >
      {/* 顶部主操作栏（非全屏模式显示） */}
      {!isFullscreen && (
        <header
          className="h-12 border-b px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-30"
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
          }}
        >
          {/* 左侧：缩略图开关、平铺总览与文稿标题 */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setShowThumbnails(prev => !prev)}
              className="p-1.5 rounded-lg border transition flex items-center gap-1.5 text-xs font-medium"
              style={
                showThumbnails
                  ? {
                      backgroundColor: 'var(--ov-accent)',
                      color: 'var(--ov-text-on-accent)',
                      borderColor: 'var(--ov-accent)',
                    }
                  : {
                      backgroundColor: 'var(--ov-surface)',
                      color: 'var(--ov-text)',
                      borderColor: 'var(--ov-border)',
                    }
              }
              title={showThumbnails ? (isEn ? 'Hide Thumbnails' : '隐藏缩略图列表') : (isEn ? 'Show Thumbnails' : '展开缩略图列表')}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">{isEn ? 'Outline' : '大纲'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGrid(prev => !prev)}
              className="p-1.5 rounded-lg border transition flex items-center gap-1 text-xs font-medium"
              style={
                showGrid
                  ? {
                      backgroundColor: 'var(--ov-accent)',
                      color: 'var(--ov-text-on-accent)',
                      borderColor: 'var(--ov-accent)',
                    }
                  : {
                      backgroundColor: 'var(--ov-surface)',
                      color: 'var(--ov-text)',
                      borderColor: 'var(--ov-border)',
                    }
              }
              title={isEn ? 'Slide Sorter Grid (G)' : '平铺总览视图 (G)'}
            >
              <Grid2x2 className="w-4 h-4" />
              <span className="hidden md:inline">{isEn ? 'Grid' : '总览'}</span>
            </button>

            <div className="flex items-center gap-2 min-w-0 ml-1">
              <div
                className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--ov-accent-subtle)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
              >
                <Presentation className="w-4 h-4" />
              </div>
              <span
                className="font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[220px]"
                title={data?.metadata?.title || fileName}
              >
                {data?.metadata?.title || fileName}
              </span>
            </div>
          </div>

          {/* 中间：翻页与缩放控制器 */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={goToPrev}
              disabled={currentSlideIndex <= 0}
              className="p-1.5 rounded-md border border-transparent hover:border-[var(--ov-border)] disabled:opacity-30 transition"
              title={isEn ? 'Previous Slide (← / PageUp)' : '上一张 (← / PageUp)'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              className="text-xs font-mono px-2.5 py-1 rounded-md border flex items-center gap-1"
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
            >
              <span className="font-bold">{currentSlideIndex + 1}</span>
              <span className="opacity-40">/</span>
              <span className="opacity-70">{totalSlides || 1}</span>
            </div>

            <button
              type="button"
              onClick={goToNext}
              disabled={currentSlideIndex >= totalSlides - 1}
              className="p-1.5 rounded-md border border-transparent hover:border-[var(--ov-border)] disabled:opacity-30 transition"
              title={isEn ? 'Next Slide (→ / Space / PageDown)' : '下一张 (→ / Space / PageDown)'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="hidden lg:flex items-center gap-0.5 ml-2 pl-2 border-l" style={{ borderColor: 'var(--ov-border)' }}>
              <button
                type="button"
                onClick={() => setZoomFactor(z => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
                className="p-1.5 rounded-md hover:opacity-80 transition"
                title={isEn ? 'Zoom Out' : '缩小画布'}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomFactor(1)}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono border"
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border-subtle)',
                  color: 'var(--ov-text-secondary)',
                }}
                title={isEn ? 'Fit Viewport (100%)' : '自适应视口'}
              >
                {Math.round(zoomFactor * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoomFactor(z => Math.min(2.2, Math.round((z + 0.15) * 100) / 100))}
                className="p-1.5 rounded-md hover:opacity-80 transition"
                title={isEn ? 'Zoom In' : '放大画布'}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 右侧：搜索、导出、打印、备注、信息、放映 */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowSearch(prev => {
                  const next = !prev;
                  if (next) setTimeout(() => searchInputRef.current?.focus(), 0);
                  return next;
                });
              }}
              className="p-1.5 rounded-md border transition"
              style={
                showSearch
                  ? {
                      backgroundColor: 'var(--ov-accent)',
                      color: 'var(--ov-text-on-accent)',
                      borderColor: 'var(--ov-accent)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                    }
              }
              title={isEn ? 'Search Slides (Ctrl+F)' : '搜索幻灯片内容 (Ctrl+F)'}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => void handleCopyMarkdown()}
              className="p-1.5 rounded-md hover:opacity-85 transition hidden sm:flex items-center gap-1 text-xs"
              title={isEn ? 'Copy All as Markdown' : '复制全文为 Markdown'}
            >
              {copiedMd ? <Check className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="p-1.5 rounded-md hover:opacity-85 transition hidden sm:flex items-center"
              title={isEn ? 'Print / Export PDF' : '打印 / 导出 PDF'}
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => loadPresentation()}
              className="p-1.5 rounded-md hover:opacity-85 transition"
              title={isEn ? 'Reload Presentation' : '重新载入与解析幻灯片'}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowNotes(prev => !prev)}
              className="p-1.5 rounded-md border transition flex items-center gap-1 text-xs"
              style={
                showNotes
                  ? {
                      backgroundColor: 'var(--ov-accent)',
                      color: 'var(--ov-text-on-accent)',
                      borderColor: 'var(--ov-accent)',
                    }
                  : {
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }
              }
              title={isEn ? 'Speaker Notes' : '演讲者备注抽屉'}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden md:inline">{isEn ? 'Notes' : '备注'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInfo(prev => !prev)}
              className="p-1.5 rounded-md transition"
              style={
                showInfo
                  ? { backgroundColor: 'var(--ov-accent-subtle)', color: 'var(--ov-accent)' }
                  : undefined
              }
              title={isEn ? 'Deck Metadata' : '文稿出版元数据'}
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-2.5 py-1.5 rounded-md transition flex items-center gap-1 text-xs font-medium"
              style={{
                backgroundColor: 'var(--ov-accent)',
                color: 'var(--ov-text-on-accent)',
              }}
              title={isEn ? 'Start Presentation (F5)' : '全屏沉浸放映 (F5)'}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">{isEn ? 'Present' : '放映'}</span>
            </button>
          </div>
        </header>
      )}

      {/* 降级警告横幅 */}
      {!isFullscreen && data?.isFallbackUsed && !dismissedFallbackBanner && (
        <div
          className="px-4 py-1.5 border-b text-xs flex items-center justify-between gap-2 shrink-0"
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {isEn
                ? 'Source PPTX file could not be unpacked cleanly; displaying built-in fallback presentation.'
                : '检测到原始 PPTX 字节流损坏或非标准容器，已自动切换至高保真演示文稿兜底渲染。'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedFallbackBanner(true)}
            className="p-0.5 rounded hover:opacity-80 shrink-0"
            aria-label={isEn ? 'Dismiss warning' : '关闭提示'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 搜索浮动条 */}
      {showSearch && (
        <div
          className="px-3 py-2 border-b flex items-center gap-2 text-xs shrink-0 z-30"
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
          }}
        >
          <Search className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                navigateMatch(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowSearch(false);
                setSearchQuery('');
              }
            }}
            placeholder={isEn ? 'Search slide text, tables, notes...' : '检索幻灯片标题、正文、表格与演讲者备注...'}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--ov-text)' }}
          />
          {searchQuery.trim() && (
            <span className="font-mono text-[11px]" style={{ color: 'var(--ov-text-secondary)' }}>
              {matchedSlideList.length > 0
                ? isEn
                  ? `${matchedSlideList.length} slides matched`
                  : `命中 ${matchedSlideList.length} 页`
                : isEn
                ? 'No matches'
                : '无匹配'}
            </span>
          )}
          <button
            type="button"
            onClick={() => navigateMatch(-1)}
            disabled={matchedSlideList.length === 0}
            className="p-1 rounded border disabled:opacity-30"
            style={{ borderColor: 'var(--ov-border)' }}
            title={isEn ? 'Previous Match (Shift+Enter)' : '上一匹配页 (Shift+Enter)'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => navigateMatch(1)}
            disabled={matchedSlideList.length === 0}
            className="p-1 rounded border disabled:opacity-30"
            style={{ borderColor: 'var(--ov-border)' }}
            title={isEn ? 'Next Match (Enter)' : '下一匹配页 (Enter)'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 rounded hover:opacity-80"
            title={isEn ? 'Close Search (Esc)' : '关闭搜索 (Esc)'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 主视口布局：左侧真实缩略图 + 中间 1:1 矢量舞台 + 备注/信息抽屉 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧：幻灯片缩略图抽屉 */}
        {!isFullscreen && showThumbnails && (
          <aside
            className="w-52 sm:w-56 h-full border-r flex flex-col shrink-0 z-20 overflow-y-auto p-2.5 space-y-2.5"
            style={{
              backgroundColor: 'var(--ov-bg-elevated)',
              borderColor: 'var(--ov-border)',
            }}
          >
            {data?.slides.map((slide, idx) => {
              const isSelected = idx === currentSlideIndex;
              const isMatched = matchedSlideSet.has(idx);

              return (
                <button
                  key={`thumb-${idx}`}
                  type="button"
                  onClick={() => setCurrentSlideIndex(idx)}
                  className="w-full p-1.5 rounded-xl border text-left transition flex flex-col gap-1.5 group"
                  style={{
                    backgroundColor: isSelected ? 'var(--ov-accent-subtle)' : 'var(--ov-surface)',
                    borderColor: isSelected ? 'var(--ov-accent)' : 'var(--ov-border)',
                    boxShadow: isSelected ? '0 0 0 1px var(--ov-accent)' : undefined,
                  }}
                >
                  {/* 等比真实缩略图预览框 */}
                  <div
                    className="w-full aspect-video rounded-md border overflow-hidden relative flex items-center justify-center bg-white"
                    style={{ borderColor: 'var(--ov-border-subtle)' }}
                  >
                    <PptxSlideStage
                      slide={slide}
                      width={slideWidth}
                      height={slideHeight}
                      scale={thumbScale}
                      searchQuery={searchQuery}
                      compact={true}
                      showSlideNumber={false}
                    />
                    {slide.isHidden && (
                      <span
                        className="absolute top-1 right-1 px-1 py-0.5 rounded bg-slate-900/75 text-white text-[9px] flex items-center gap-0.5"
                        title={isEn ? 'Hidden Slide' : '已隐藏幻灯片'}
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-1 text-[11px] gap-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className="font-mono font-bold shrink-0"
                        style={{ color: isSelected ? 'var(--ov-accent)' : 'var(--ov-text-secondary)' }}
                      >
                        #{idx + 1}
                      </span>
                      <span className="truncate font-medium">{slide.title}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isMatched && <Search className="w-3 h-3 text-amber-500" />}
                      {slide.notes && <MessageSquare className="w-3 h-3 opacity-55" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </aside>
        )}

        {/* 中间：1:1 等比自适应主舞台展示区 */}
        <main
          ref={viewportRef}
          className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-auto relative"
          style={{ backgroundColor: isFullscreen ? '#090D16' : 'var(--ov-bg)' }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 opacity-75">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ov-accent)', borderTopColor: 'transparent' }} />
              <p className="text-xs">{isEn ? 'Parsing OOXML PPTX slides...' : '正在解析 PPTX 矢量幻灯片...'}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-red-500">
              <p className="text-sm font-semibold">{isEn ? 'Failed to Load' : '加载失败'}</p>
              <p className="text-xs opacity-80">{error}</p>
              <button
                type="button"
                onClick={loadPresentation}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isEn ? 'Retry' : '重新尝试'}
              </button>
            </div>
          ) : currentSlide ? (
            <div
              className="rounded-xl border shadow-2xl overflow-hidden shrink-0"
              style={{ borderColor: 'var(--ov-border)' }}
            >
              <PptxSlideStage
                slide={currentSlide}
                width={slideWidth}
                height={slideHeight}
                scale={effectiveScale}
                searchQuery={searchQuery}
                laserActive={laserActive}
                totalSlides={totalSlides}
                stageRef={stageRef}
              />
            </div>
          ) : null}

          {/* 底部：演讲者备注抽屉 */}
          {showNotes && (
            <div
              className="absolute bottom-4 left-6 right-6 max-h-40 border rounded-xl p-3 shadow-2xl backdrop-blur-md overflow-y-auto z-30"
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
            >
              <div
                className="flex items-center justify-between pb-1.5 border-b mb-1.5"
                style={{ borderColor: 'var(--ov-border)' }}
              >
                <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--ov-accent)' }}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isEn
                    ? `Speaker Notes · Slide ${currentSlideIndex + 1}`
                    : `演讲者备注 (Speaker Notes) · 第 ${currentSlideIndex + 1} 页`}
                </span>
                <button type="button" onClick={() => setShowNotes(false)} className="opacity-60 hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap">
                {currentSlide?.notes || (isEn ? 'No speaker notes for this slide.' : '当前幻灯片暂无演播提词与备注。')}
              </p>
            </div>
          )}

          {/* 全屏沉浸演播 HUD 控制条 */}
          {isFullscreen && (
            <div
              className={`absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-center gap-2 z-40 transition-opacity duration-200 ${
                hudVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
            >
              <button
                type="button"
                onClick={goToPrev}
                disabled={currentSlideIndex <= 0}
                className="p-1.5 rounded-md disabled:opacity-30 hover:opacity-80"
                title={isEn ? 'Previous' : '上一页'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono px-1.5 font-semibold">
                {currentSlideIndex + 1} / {totalSlides || 1}
              </span>

              <button
                type="button"
                onClick={goToNext}
                disabled={currentSlideIndex >= totalSlides - 1}
                className="p-1.5 rounded-md disabled:opacity-30 hover:opacity-80"
                title={isEn ? 'Next' : '下一页'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--ov-border)' }} />

              <span className="text-[11px] font-mono flex items-center gap-1 px-1" style={{ color: 'var(--ov-text-secondary)' }}>
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(elapsedSeconds)}
              </span>

              <button
                type="button"
                onClick={() => setLaserActive(prev => !prev)}
                className={`p-1.5 rounded-md border text-xs flex items-center gap-1 transition ${
                  laserActive ? 'bg-red-500 text-white border-red-500' : 'border-transparent hover:opacity-80'
                }`}
                title={isEn ? 'Laser Pointer (L)' : '激光笔指示器 (L)'}
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowNotes(prev => !prev)}
                className="p-1.5 rounded-md border text-xs transition"
                style={
                  showNotes
                    ? { backgroundColor: 'var(--ov-accent)', color: 'var(--ov-text-on-accent)', borderColor: 'var(--ov-accent)' }
                    : { borderColor: 'transparent' }
                }
                title={isEn ? 'Toggle Speaker Notes' : '演讲者备注'}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-2 py-1 rounded-md border text-xs flex items-center gap-1 hover:opacity-85"
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                }}
                title={isEn ? 'Exit Presentation (Esc)' : '退出放映 (Esc)'}
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Exit' : '退出'}</span>
              </button>
            </div>
          )}
        </main>

        {/* 平铺总览遮罩层 */}
        {showGrid && data && (
          <PptxGridOverview
            slides={data.slides}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            currentSlideIndex={currentSlideIndex}
            matchedSlideIndices={matchedSlideSet}
            searchQuery={searchQuery}
            locale={locale}
            onSelectSlide={idx => {
              setCurrentSlideIndex(idx);
              setShowGrid(false);
            }}
            onClose={() => setShowGrid(false)}
          />
        )}

        {/* 右侧：文稿出版元数据抽屉 */}
        {showInfo && !isFullscreen && (
          <aside
            className="absolute right-0 top-0 bottom-0 w-80 border-l p-4 flex flex-col z-40 shadow-2xl overflow-y-auto"
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
          >
            <div
              className="flex items-center justify-between pb-3 border-b mb-4"
              style={{ borderColor: 'var(--ov-border)' }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isEn ? 'PPTX Deck Metadata' : 'PPTX 演示文稿信息'}
              </h3>
              <button type="button" onClick={() => setShowInfo(false)} className="p-1 rounded hover:opacity-80">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono opacity-55 block uppercase">
                  {isEn ? 'Title' : '文稿名称 / Title'}
                </span>
                <p className="font-semibold text-sm">{data?.metadata?.title || fileName}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-55 block uppercase">
                  {isEn ? 'Creator' : '演讲者 / Creator'}
                </span>
                <p>{data?.metadata?.creator || (isEn ? 'Unspecified' : '未记录')}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-55 block uppercase">
                  {isEn ? 'Aspect Ratio & Stage' : '画布比例 / Stage Size'}
                </span>
                <p className="font-mono">
                  {data?.metadata?.aspectRatio} ({slideWidth} × {slideHeight} pt)
                </p>
              </div>

              {currentSlide?.layoutName && (
                <div>
                  <span className="text-[10px] font-mono opacity-55 block uppercase">
                    {isEn ? 'Active Slide Layout' : '当前页版式 / Layout'}
                  </span>
                  <p>{currentSlide.layoutName}</p>
                </div>
              )}

              <div
                className="pt-4 border-t space-y-1.5 font-mono text-[11px]"
                style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)' }}
              >
                <div>{isEn ? `Total slides: ${totalSlides}` : `幻灯片总页数: ${totalSlides} 页`}</div>
                <div>{isEn ? `Notes slides: ${data?.metadata?.notesCount || 0}` : `含备注页数: ${data?.metadata?.notesCount || 0} 页`}</div>
                <div>{isEn ? `Embedded charts: ${data?.metadata?.chartCount || 0}` : `原生内嵌图表: ${data?.metadata?.chartCount || 0} 个`}</div>
                {hiddenSlideCount > 0 && (
                  <div>{isEn ? `Hidden slides: ${hiddenSlideCount}` : `已隐藏幻灯片: ${hiddenSlideCount} 页`}</div>
                )}
                <div>
                  {isEn ? 'File size: ' : '文件大小: '}
                  {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : 'OOXML PPTX'}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
