/**
 * OmniView 工业级专业 PDF 阅读与分析工作台
 * 深度融合方案 A (Mozilla PDF.js 真实光栅化内核)、
 * 方案 B (全文检索、双页翻书排版、层级大纲书签树) 与
 * 方案 C (TextLayer 选词复制、彩色划词高亮、便签批注导出、高清快照与全屏演示)
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Download,
  Layers,
  RotateCw,
  Printer,
  FolderOpen,
  FileText,
  RefreshCw,
  AlertTriangle,
  Search,
  Columns2,
  Square,
  Rows3,
  Maximize2,
  Minimize2,
  Highlighter,
  Camera,
  Bookmark,
  Check,
  Sun,
  Moon,
  Palette,
  Hand,
  MousePointer,
} from 'lucide-react';
import {
  loadPdfDocument,
  searchPdfDocument,
  getPdfOutline,
  type PdfSearchMatch,
  type PdfOutlineItem,
} from '../../lib/pdfEngine';
import { requestPrintImage } from '../../../../shared/lib/printBridge';
import { getVsCodeApi } from '../../../../shared/lib/vscode';
import type { ThemeId } from '../../../../shared/types';
import { idbGetViewerState, idbSetViewerState } from '../../../../shared/lib/indexedDbStorage';
import type { Locale } from '../../../../shared/lib/i18n';
import { PdfThumbnail } from './pdf/PdfThumbnail';
import { PdfSearchBar } from './pdf/PdfSearchBar';
import { usePdfSearchController } from './pdf/usePdfSearchController';
import { PdfOutlineView } from './pdf/PdfOutlineView';
import { PdfAnnotationsView, type PdfAnnotation } from './pdf/PdfAnnotationsView';
import { PdfPageCanvas, type PdfPaperFilter } from './pdf/PdfPageCanvas';
import {
  MIN_PDF_ZOOM,
  MAX_PDF_ZOOM,
  DEFAULT_PDF_ZOOM,
  PDF_ZOOM_PRESETS,
  calculatePdfWheelZoom,
  calculatePdfFocalScroll,
  getNextPdfZoomIn,
  getNextPdfZoomOut,
  calculateFitWidthZoom,
  calculateFitPageZoom,
  clampPdfZoom,
  calculatePanOffset,
} from './pdf/pdfZoomHelper';

interface PdfViewerProps {
  fileName?: string;
  fileSize?: number;
  binaryUrl?: string;
  content?: string;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

type SidebarTab = 'thumbnails' | 'outline' | 'annotations';
type ViewMode = 'continuous' | 'single' | 'dual';
type PaperThemeMode = 'auto' | 'normal' | 'dark' | 'sepia' | 'grayscale';

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileName = 'technical-whitepaper.pdf',
  binaryUrl,
  content,
  theme,
  isDarkTheme,
  locale = 'zh-CN',
}) => {
  // 计算生效的主题体系
  const effectiveTheme: ThemeId =
    theme ||
    (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-theme') as ThemeId) || 'dark'
      : 'dark');
  const isDark =
    isDarkTheme !== undefined
      ? isDarkTheme
      : ['dark', 'midnight', 'cyber', 'nord', 'dracula', 'forest', 'system', 'vscode'].includes(
          effectiveTheme
        );

  // 页面阅读/滤镜模式：auto (跟随主题) | normal (原始白纸) | dark (夜间反转) | sepia (暖色羊皮纸) | grayscale (柔和灰阶)
  const [paperMode, setPaperMode] = useState<PaperThemeMode>(() => {
    try {
      const saved = localStorage.getItem('ov_pdf_paper_mode');
      if (saved && ['auto', 'normal', 'dark', 'sepia', 'grayscale'].includes(saved)) {
        return saved as PaperThemeMode;
      }
    } catch {}
    return 'auto';
  });
  const [showPaperMenu, setShowPaperMenu] = useState(false);

  const handleSelectPaperMode = (mode: PaperThemeMode) => {
    setPaperMode(mode);
    setShowPaperMenu(false);
    try {
      localStorage.setItem('ov_pdf_paper_mode', mode);
    } catch {}
  };

  const effectivePaperFilter: PdfPaperFilter = useMemo(() => {
    if (paperMode === 'auto') {
      if (effectiveTheme === 'sepia' || effectiveTheme === 'solarized') return 'sepia';
      if (isDark) return 'dark';
      return 'normal';
    }
    return paperMode;
  }, [paperMode, effectiveTheme, isDark]);

  // 文档与内核状态
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [activeFileName, setActiveFileName] = useState(fileName);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState('1');

  // 方案 B：侧边栏与视图排版
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('thumbnails');
  const [viewMode, setViewMode] = useState<ViewMode>('continuous');
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);

  // 方案 C：标注与高亮系统
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>(() => {
    try {
      const saved = localStorage.getItem(`ov_pdf_ann_${fileName}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 方案 C：全屏与快照提示
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasRestoredProgressRef = useRef<boolean>(false);

  // 视口平移与交互模式 (选择 vs 抓手漫游)
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('select');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null);

  // 缩放预设菜单下拉状态
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  // 保持最新 zoom 引用以供原生事件监听器读取
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // 光标焦点无级缩放待应用的精确定位偏移 (在 DOM 布局生效后立即无抖动同步)
  const pendingFocalScrollRef = useRef<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (pendingFocalScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = pendingFocalScrollRef.current.left;
      scrollContainerRef.current.scrollTop = pendingFocalScrollRef.current.top;
      pendingFocalScrollRef.current = null;
    }
  }, [zoom]);

  // 浮动缩放反馈指示器状态与计时器 (Ctrl+滚轮/快捷键缩放时提示)
  const [zoomIndicator, setZoomIndicator] = useState<{ zoom: number; visible: boolean }>({
    zoom: 100,
    visible: false,
  });
  const zoomIndicatorTimerRef = useRef<number | null>(null);

  const triggerZoomIndicator = useCallback((z: number) => {
    setZoomIndicator({ zoom: z, visible: true });
    if (zoomIndicatorTimerRef.current !== null) {
      window.clearTimeout(zoomIndicatorTimerRef.current);
    }
    zoomIndicatorTimerRef.current = window.setTimeout(() => {
      setZoomIndicator((prev) => ({ ...prev, visible: false }));
    }, 900);
  }, []);

  // 提示信息定时隐藏
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const handlePageLoaded = useCallback((dims: { width: number; height: number }) => {
    setPageSize(dims);
  }, []);

  const handleAddAnnotation = useCallback((ann: Omit<PdfAnnotation, 'id' | 'createdAt'>) => {
    const newAnn: PdfAnnotation = {
      ...ann,
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    setAnnotations((prev) => [newAnn, ...prev]);
    showToast(`已添加第 ${ann.pageNumber} 页高亮批注`);
  }, [showToast]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    showToast('已删除批注');
  }, [showToast]);

  const handleUpdateAnnotationNote = useCallback((id: string, note: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, note } : a))
    );
  }, []);

  const handleClearAllAnnotations = useCallback(() => {
    setAnnotations([]);
    showToast('已清空全部批注');
  }, [showToast]);

  // 文档成功载入后自动恢复历史阅读进度（页码、缩放、排版模式与高亮标注）
  useEffect(() => {
    if (!pdfDoc || totalPages <= 0 || hasRestoredProgressRef.current) return;
    hasRestoredProgressRef.current = true;

    void idbGetViewerState<{
      currentPage?: number;
      zoom?: number;
      viewMode?: ViewMode;
      annotations?: PdfAnnotation[];
    }>('pdf', activeFileName).then((saved) => {
      if (!saved) return;

      if (saved.currentPage && saved.currentPage > 1 && saved.currentPage <= totalPages) {
        setCurrentPage(saved.currentPage);
        setPageInput(String(saved.currentPage));
        showToast(`已恢复至上次阅读进度: 第 ${saved.currentPage} / ${totalPages} 页`);
      }
      if (saved.zoom && saved.zoom >= 25 && saved.zoom <= 500) {
        setZoom(saved.zoom);
      }
      if (saved.viewMode) {
        setViewMode(saved.viewMode);
      }
      if (saved.annotations && Array.isArray(saved.annotations) && saved.annotations.length > 0) {
        setAnnotations(saved.annotations);
      }
    });
  }, [pdfDoc, totalPages, activeFileName, showToast]);

  // 自动将阅读进度与状态持久化保存至 IndexedDB (防抖 500ms)
  useEffect(() => {
    if (isLoading || !pdfDoc) return;
    const timer = setTimeout(() => {
      void idbSetViewerState('pdf', activeFileName, {
        currentPage,
        zoom,
        viewMode,
        annotations,
      });
      // 保持 LocalStorage 轻量同步兜底
      try {
        localStorage.setItem(`ov_pdf_ann_${activeFileName}`, JSON.stringify(annotations));
      } catch {}
    }, 500);

    return () => clearTimeout(timer);
  }, [currentPage, zoom, viewMode, annotations, activeFileName, isLoading, pdfDoc]);

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  pdfDocRef.current = pdfDoc;

  // 组件卸载时安全释放 PDF.js Worker 与内存缓冲区
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => {});
      }
    };
  }, []);

  // 1. 文档初始化与二进制载入
  const loadDocument = useCallback(async (source?: string | Uint8Array) => {
    setIsLoading(true);
    setError(null);
    try {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => {});
        pdfDocRef.current = null;
      }
      const { doc, rawBytes: loadedBytes } = await loadPdfDocument(source);
      setPdfDoc(doc);
      setRawBytes(loadedBytes);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setPageInput('1');

      // 解析首页尺寸
      const firstPage = await doc.getPage(1);
      const vp = firstPage.getViewport({ scale: 1.0 });
      setPageSize({ width: Math.round(vp.width), height: Math.round(vp.height) });

      // 异步解析文档大纲目录 (方案 B)
      getPdfOutline(doc)
        .then((items) => setOutline(items))
        .catch((err) => console.warn('[OmniView PDF] 大纲加载失败:', err));
    } catch (err) {
      console.error('[OmniView PDF] 文档加载失败:', err);
      setError(err instanceof Error ? err.message : '无法解析 PDF 二进制文件');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setActiveFileName(fileName);
    loadDocument(binaryUrl);
  }, [binaryUrl, fileName, loadDocument]);

  // 同步页码输入框
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 编程触发滚动锁，防止 smooth 滚动过程中反复触发 onScroll 导致状态抖动
  const isProgrammaticScrollRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  // 组件卸载时清理定时器与动画帧
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (zoomIndicatorTimerRef.current !== null) {
        clearTimeout(zoomIndicatorTimerRef.current);
      }
    };
  }, []);

  // 2. 页面导航控制
  const handlePageJump = useCallback((targetPage: number) => {
    const valid = Math.max(1, Math.min(totalPages, targetPage));
    setCurrentPage(valid);
    setPageInput(String(valid));

    // 在连续流式模式下，平滑滚动至目标页面容器
    if (viewMode === 'continuous') {
      const el = document.getElementById(`pdf-page-container-${valid}`);
      if (el && scrollContainerRef.current) {
        isProgrammaticScrollRef.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 500);
      }
    }
  }, [totalPages, viewMode]);

  // 连续流式模式下的视口滚动监听与当前阅读页自动同步 (Scroll Spy) - 采用 requestAnimationFrame 稳帧节流
  const handleScroll = useCallback(() => {
    if (viewMode !== 'continuous' || isProgrammaticScrollRef.current) return;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const probeY = containerRect.top + Math.min(180, containerRect.height * 0.35);

      let activePage = 1;
      let minDiff = Infinity;

      for (let p = 1; p <= totalPages; p++) {
        const el = document.getElementById(`pdf-page-container-${p}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < containerRect.top) continue;

        const diff = Math.abs(r.top - probeY);
        if (diff < minDiff) {
          minDiff = diff;
          activePage = p;
        }
        if (r.top > containerRect.bottom) break;
      }

      setCurrentPage((prev) => {
        if (prev !== activePage) {
          setPageInput(String(activePage));
          return activePage;
        }
        return prev;
      });
    });
  }, [viewMode, totalPages]);

  // 切换排版模式（平滑维持当前阅读页）
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'continuous') {
      setTimeout(() => {
        const el = document.getElementById(`pdf-page-container-${currentPage}`);
        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 50);
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(pageInput, 10);
      if (!isNaN(parsed)) {
        handlePageJump(parsed);
      } else {
        setPageInput(String(currentPage));
      }
    }
  };

  // 翻页递增/递减（单页/流式步进 1，双页步进 2）
  const handleNextPage = () => {
    if (viewMode === 'dual') {
      handlePageJump(currentPage + 2);
    } else {
      handlePageJump(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (viewMode === 'dual') {
      handlePageJump(currentPage - 2);
    } else {
      handlePageJump(currentPage - 1);
    }
  };

  // 3. 全文检索逻辑 (方案 B) - 委托 usePdfSearchController 解耦 Hook 管理
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    searchMatches,
    currentMatchIndex,
    isSearching,
    handleSearchQueryChange,
    handleNextMatch,
    handlePrevMatch,
  } = usePdfSearchController({
    pdfDoc,
    onJumpToPage: handlePageJump,
  });

  // 6. 视口排版、缩放与旋转
  const handleZoomIn = useCallback(() => {
    setZoom((z) => {
      const next = getNextPdfZoomIn(z);
      triggerZoomIndicator(next);
      return next;
    });
  }, [triggerZoomIndicator]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const next = getNextPdfZoomOut(z);
      triggerZoomIndicator(next);
      return next;
    });
  }, [triggerZoomIndicator]);

  const handleResetZoom = useCallback(() => {
    setZoom(DEFAULT_PDF_ZOOM);
    triggerZoomIndicator(DEFAULT_PDF_ZOOM);
  }, [triggerZoomIndicator]);

  const handleFitWidth = useCallback(() => {
    if (!scrollContainerRef.current || pageSize.width <= 0) return;
    const newScale = calculateFitWidthZoom(scrollContainerRef.current.clientWidth, pageSize.width, viewMode);
    setZoom(newScale);
    triggerZoomIndicator(newScale);
  }, [pageSize.width, viewMode, triggerZoomIndicator]);

  const handleFitPage = useCallback(() => {
    if (!scrollContainerRef.current || pageSize.height <= 0) return;
    const newScale = calculateFitPageZoom(scrollContainerRef.current.clientHeight, pageSize.height);
    setZoom(newScale);
    triggerZoomIndicator(newScale);
  }, [pageSize.height, triggerZoomIndicator]);

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // 双击视口空白区域快速在「适宽」与「100%」之间切换
  const handleContainerDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, a, .pdf-selection-popup')) {
      return;
    }
    if (window.getSelection()?.toString().trim()) {
      return;
    }
    if (zoom === DEFAULT_PDF_ZOOM) {
      handleFitWidth();
    } else {
      handleResetZoom();
    }
  }, [zoom, handleFitWidth, handleResetZoom]);

  // 4. 键盘全局快捷键 (Cmd+F / Esc / Ctrl+加减号缩放 / Ctrl+0 重置 / W 适宽 / H 适页 / R 旋转 / Home / End / PageUp / PageDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = !!target?.closest('input, textarea, [contenteditable="true"]');

      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
        if (showZoomMenu) {
          setShowZoomMenu(false);
          return;
        }
      }

      if (inInput) return;

      const isCtrlOrMeta = e.metaKey || e.ctrlKey;

      // Cmd+F / Ctrl+F 全文检索
      if (isCtrlOrMeta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (isCtrlOrMeta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if (isCtrlOrMeta && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        handleZoomOut();
      } else if (isCtrlOrMeta && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (!isCtrlOrMeta && !e.altKey) {
        if (e.key === 'Home') {
          e.preventDefault();
          handlePageJump(1);
        } else if (e.key === 'End') {
          e.preventDefault();
          handlePageJump(totalPages);
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          handlePrevPage();
        } else if (e.key === 'PageDown') {
          e.preventDefault();
          handleNextPage();
        } else if (e.key.toLowerCase() === 'w') {
          e.preventDefault();
          handleFitWidth();
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          handleFitPage();
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          handleRotate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isSearchOpen,
    showZoomMenu,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleFitWidth,
    handleFitPage,
    handleRotate,
    handlePageJump,
    handlePrevPage,
    handleNextPage,
    totalPages,
  ]);

  // 抓手平移拖拽 (鼠标中键或抓手模式/按住空格拖拽)
  const handleContainerMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    const isMiddle = e.button === 1;
    const isHand = (toolMode === 'hand' || isSpacePressed) && e.button === 0;
    if (!isMiddle && !isHand) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const container = scrollContainerRef.current;
      if (!container || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      const next = calculatePanOffset(
        panStartRef.current.scrollLeft,
        panStartRef.current.scrollTop,
        dx,
        dy
      );
      container.scrollLeft = next.scrollLeft;
      container.scrollTop = next.scrollTop;
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning]);

  // 空格键长按临时激活抓手漫游 (Space + Drag)
  useEffect(() => {
    const handleSpaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleSpaceDown);
    window.addEventListener('keyup', handleSpaceUp);
    return () => {
      window.removeEventListener('keydown', handleSpaceDown);
      window.removeEventListener('keyup', handleSpaceUp);
    };
  }, []);

  // 点击外部关闭缩放预设菜单
  useEffect(() => {
    if (!showZoomMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('#pdf-zoom-presets-container')) {
        setShowZoomMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showZoomMenu]);

  // 鼠标滚轮 + Ctrl/Meta 键进行以光标为锚点的无级缩放 (Focal Point Wheel Zoom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // 仅当按住 Ctrl 或 Meta 键（Windows/Linux 的 Ctrl、macOS 的 Cmd，或 Mac 触控板捏合手势）时触发缩放
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      const currentZoom = zoomRef.current;
      const nextZoom = calculatePdfWheelZoom(currentZoom, e.deltaY, true);
      if (nextZoom === currentZoom) return;

      const rect = container.getBoundingClientRect();
      const { targetScrollLeft, targetScrollTop } = calculatePdfFocalScroll({
        containerRect: rect,
        cursorClientX: e.clientX,
        cursorClientY: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        oldZoom: currentZoom,
        newZoom: nextZoom,
      });

      // 记录待同步的光标焦点滚动坐标
      pendingFocalScrollRef.current = { left: targetScrollLeft, top: targetScrollTop };
      setZoom(nextZoom);
      triggerZoomIndicator(nextZoom);

      // 双重保障维持光标所指位置的内容不发生跳动与漂移
      requestAnimationFrame(() => {
        if (container && pendingFocalScrollRef.current) {
          container.scrollLeft = pendingFocalScrollRef.current.left;
          container.scrollTop = pendingFocalScrollRef.current.top;
          pendingFocalScrollRef.current = null;
        }
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [triggerZoomIndicator]);

  // 7. 页面高清快照导出 (方案 C)
  const handleExportSnapshot = () => {
    const pageContainer = document.getElementById(`pdf-page-container-${currentPage}`);
    const canvas = pageContainer?.querySelector('canvas');
    if (!canvas) {
      showToast('未找到页面画布');
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeFileName.replace(/\.pdf$/i, '')}-P${currentPage}-snapshot.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`已导出第 ${currentPage} 页高清快照 PNG`);
    }, 'image/png');
  };

  // 8. 全屏沉浸演示 (方案 C)
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 9. 原生 PDF 下载
  const handleDownload = () => {
    if (!rawBytes) return;
    const blob = new Blob([rawBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFileName.endsWith('.pdf') ? activeFileName : `${activeFileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('正在下载原始 PDF 文档...');
  };

  // 10. 打印（VS Code Webview 内 window.open/print 不可用，改走 Host 外置浏览器）
  const handlePrint = () => {
    const pageContainer = document.getElementById(`pdf-page-container-${currentPage}`);
    const canvas = pageContainer?.querySelector('canvas');
    if (!canvas) {
      showToast('未找到可打印页面');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const printed = requestPrintImage(`${activeFileName}-p${currentPage}`, dataUrl);
    if (printed && getVsCodeApi()) {
      showToast('正在打开系统打印预览…');
    }
  };

  // 11. 打开本地 PDF 测试
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        loadDocument(new Uint8Array(reader.result));
        showToast(`已加载本地文档: ${file.name}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // 双页模式的左右页码计算
  const leftPageNumber = viewMode === 'dual' ? (currentPage % 2 === 0 ? currentPage - 1 : currentPage) : currentPage;
  const rightPageNumber = viewMode === 'dual' ? leftPageNumber + 1 : null;

  return (
    <div
      ref={containerRef}
      id="pdf-viewer-container"
      data-theme={effectiveTheme}
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full flex flex-col select-none relative overflow-hidden"
    >
      {/* 隐藏的文件输入组件 */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleLocalFileSelect}
      />

      {/* 浮动全局通知 Toast */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 bg-blue-600/95 text-white text-xs font-medium rounded-full shadow-2xl backdrop-blur flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-white/20">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 方案 B：浮动全文检索栏 */}
      {isSearchOpen && (
        <PdfSearchBar
          query={searchQuery}
          onQueryChange={handleSearchQueryChange}
          matches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          onNextMatch={handleNextMatch}
          onPrevMatch={handlePrevMatch}
          onClose={() => setIsSearchOpen(false)}
          isSearching={isSearching}
        />
      )}

      {/* 顶部主工具栏 */}
      <header
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          color: 'var(--ov-text)',
        }}
        className="flex flex-wrap items-center justify-between px-3 py-2 text-xs gap-2 shrink-0 z-20"
      >
        {/* 左侧：侧栏控制、文件与引擎标识 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar((v) => !v)}
            style={{
              backgroundColor: showSidebar ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
              borderColor: showSidebar ? 'var(--ov-accent)' : 'var(--ov-border)',
              color: showSidebar ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)]"
            title="折叠/展开侧边导航面板"
            id="pdf-btn-toggle-sidebar"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded border"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span
              style={{ color: 'var(--ov-text)' }}
              className="font-medium truncate max-w-[130px] sm:max-w-[200px]"
              title={activeFileName}
            >
              {activeFileName}
            </span>
          </div>

          <span
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border-subtle)',
              color: 'var(--ov-text-secondary)',
            }}
            className="text-[11px] hidden xl:inline px-1.5 py-0.5 rounded border font-mono"
          >
            PDF.js Core v4.10
          </span>
        </div>

        {/* 中间：翻页、页码跳转与单/双页排版模式 (方案 B) */}
        <div className="flex items-center gap-2">
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center gap-1 px-2 py-1 rounded border"
          >
            <button
              disabled={currentPage <= 1 || isLoading}
              onClick={handlePrevPage}
              style={{ color: 'var(--ov-text)' }}
              className="p-1 hover:bg-[var(--ov-surface-hover)] disabled:opacity-30 disabled:pointer-events-none rounded transition"
              title="上一页"
              id="pdf-btn-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 font-mono text-xs">
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={handlePageInputKeyDown}
                disabled={isLoading}
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
                className="w-9 text-center border rounded px-1 py-0.5 font-bold focus:outline-none focus:ring-1 focus:ring-[var(--ov-accent)]"
                title="输入页码按 Enter 跳转"
              />
              <span style={{ color: 'var(--ov-text-muted)' }}>/</span>
              <span style={{ color: 'var(--ov-text-secondary)' }}>{totalPages}</span>
            </div>

            <button
              disabled={currentPage >= totalPages || isLoading}
              onClick={handleNextPage}
              style={{ color: 'var(--ov-text)' }}
              className="p-1 hover:bg-[var(--ov-surface-hover)] disabled:opacity-30 disabled:pointer-events-none rounded transition"
              title="下一页"
              id="pdf-btn-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 方案 B：排版切换（连续流式 / 单页居中 / 双页并排） */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="hidden sm:flex items-center rounded border p-0.5"
          >
            <button
              onClick={() => handleViewModeChange('continuous')}
              style={{
                backgroundColor: viewMode === 'continuous' ? 'var(--ov-surface-hover)' : 'transparent',
                color: viewMode === 'continuous' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className={`px-2 py-1 flex items-center gap-1 rounded transition text-xs ${
                viewMode === 'continuous'
                  ? 'font-medium shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
              }`}
              title="连续流式滚动模式（纵向多页连看）"
              id="pdf-btn-mode-continuous"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">流式</span>
            </button>
            <button
              onClick={() => handleViewModeChange('single')}
              style={{
                backgroundColor: viewMode === 'single' ? 'var(--ov-surface-hover)' : 'transparent',
                color: viewMode === 'single' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className={`px-2 py-1 flex items-center gap-1 rounded transition text-xs ${
                viewMode === 'single'
                  ? 'font-medium shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
              }`}
              title="单页居中翻页模式"
              id="pdf-btn-mode-single"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden md:inline">单页</span>
            </button>
            <button
              onClick={() => handleViewModeChange('dual')}
              style={{
                backgroundColor: viewMode === 'dual' ? 'var(--ov-surface-hover)' : 'transparent',
                color: viewMode === 'dual' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className={`px-2 py-1 flex items-center gap-1 rounded transition text-xs ${
                viewMode === 'dual'
                  ? 'font-medium shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
              }`}
              title="双页并排阅读（翻书模式）"
              id="pdf-btn-mode-dual"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">双页</span>
            </button>
          </div>

          {/* 交互工具模式：文本选词 vs 抓手漫游 */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="hidden sm:flex items-center rounded border p-0.5"
          >
            <button
              onClick={() => setToolMode('select')}
              style={{
                backgroundColor: toolMode === 'select' ? 'var(--ov-surface-hover)' : 'transparent',
                color: toolMode === 'select' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className={`p-1 flex items-center justify-center rounded transition ${
                toolMode === 'select'
                  ? 'font-medium shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
              }`}
              title="文本选词与高亮模式"
              id="pdf-btn-tool-select"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setToolMode('hand')}
              style={{
                backgroundColor: toolMode === 'hand' ? 'var(--ov-surface-hover)' : 'transparent',
                color: toolMode === 'hand' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className={`p-1 flex items-center justify-center rounded transition ${
                toolMode === 'hand'
                  ? 'font-medium shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
              }`}
              title="抓手漫游模式 (或按住空格键/鼠标中键拖拽平移视口)"
              id="pdf-btn-tool-hand"
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 右侧：阅读滤镜、检索、缩放、快照、全屏、打开与下载 */}
        <div className="flex items-center gap-1">
          {/* 阅读滤镜与模式切换器 */}
          <div className="relative">
            <button
              onClick={() => setShowPaperMenu((v) => !v)}
              style={{
                backgroundColor: showPaperMenu || paperMode !== 'auto' ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
                borderColor: showPaperMenu || paperMode !== 'auto' ? 'var(--ov-accent)' : 'var(--ov-border)',
                color: paperMode !== 'auto' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition hover:bg-[var(--ov-surface-hover)]"
              title={`阅读滤镜: ${
                paperMode === 'auto'
                  ? '跟随主题'
                  : paperMode === 'dark'
                  ? '夜间反转'
                  : paperMode === 'sepia'
                  ? '暖色羊皮纸'
                  : paperMode === 'grayscale'
                  ? '柔和灰阶'
                  : '原始白纸'
              }`}
              id="pdf-btn-paper-theme"
            >
              {effectivePaperFilter === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              ) : effectivePaperFilter === 'sepia' ? (
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 inline-block shrink-0" />
              ) : effectivePaperFilter === 'grayscale' ? (
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 inline-block shrink-0" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="hidden lg:inline">
                {paperMode === 'auto'
                  ? '主题模式'
                  : paperMode === 'dark'
                  ? '夜间反转'
                  : paperMode === 'sepia'
                  ? '羊皮纸'
                  : paperMode === 'grayscale'
                  ? '灰阶'
                  : '原白纸'}
              </span>
            </button>

            {showPaperMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                  boxShadow: 'var(--ov-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.3))',
                }}
                className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border shadow-xl p-1 z-30 flex flex-col gap-0.5 text-xs animate-in fade-in zoom-in-95 duration-100"
              >
                <div
                  className="px-2 py-1 text-[10px] font-semibold border-b"
                  style={{ color: 'var(--ov-text-muted)', borderColor: 'var(--ov-border-subtle)' }}
                >
                  页面阅读模式 (滤镜)
                </div>
                <button
                  onClick={() => handleSelectPaperMode('auto')}
                  className="flex items-center justify-between px-2 py-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
                  style={{ color: paperMode === 'auto' ? 'var(--ov-accent)' : 'var(--ov-text)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    <span>跟随应用主题</span>
                  </span>
                  {paperMode === 'auto' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
                <button
                  onClick={() => handleSelectPaperMode('normal')}
                  className="flex items-center justify-between px-2 py-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
                  style={{ color: paperMode === 'normal' ? 'var(--ov-accent)' : 'var(--ov-text)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>原始白纸 (标准)</span>
                  </span>
                  {paperMode === 'normal' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
                <button
                  onClick={() => handleSelectPaperMode('dark')}
                  className="flex items-center justify-between px-2 py-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
                  style={{ color: paperMode === 'dark' ? 'var(--ov-accent)' : 'var(--ov-text)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>夜间护眼反转</span>
                  </span>
                  {paperMode === 'dark' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
                <button
                  onClick={() => handleSelectPaperMode('sepia')}
                  className="flex items-center justify-between px-2 py-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
                  style={{ color: paperMode === 'sepia' ? 'var(--ov-accent)' : 'var(--ov-text)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-400 inline-block shrink-0" />
                    <span>暖色羊皮纸 (护眼)</span>
                  </span>
                  {paperMode === 'sepia' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
                <button
                  onClick={() => handleSelectPaperMode('grayscale')}
                  className="flex items-center justify-between px-2 py-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
                  style={{ color: paperMode === 'grayscale' ? 'var(--ov-accent)' : 'var(--ov-text)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-400 inline-block shrink-0" />
                    <span>柔和灰阶</span>
                  </span>
                  {paperMode === 'grayscale' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
              </div>
            )}
          </div>

          {/* 方案 B：检索激活按钮 */}
          <button
            onClick={() => setIsSearchOpen((v) => !v)}
            style={{
              backgroundColor: isSearchOpen ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
              borderColor: isSearchOpen ? 'var(--ov-accent)' : 'var(--ov-border)',
              color: isSearchOpen ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)]"
            title="在文档中搜索 (Cmd+F / Ctrl+F)"
            id="pdf-btn-search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px mx-0.5" style={{ backgroundColor: 'var(--ov-border)' }} />

          {/* 缩放控制器 */}
          <button
            onClick={handleZoomOut}
            disabled={isLoading || zoom <= MIN_PDF_ZOOM}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] disabled:opacity-40"
            title="缩小 (Ctrl + - / Ctrl + 滚轮)"
            id="pdf-btn-zoom-out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* 缩放控制器与预设下拉菜单 */}
          <div className="relative" id="pdf-zoom-presets-container">
            <button
              onClick={() => setShowZoomMenu((v) => !v)}
              style={{
                backgroundColor: showZoomMenu ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
                borderColor: showZoomMenu ? 'var(--ov-accent)' : 'var(--ov-border)',
                color: 'var(--ov-accent)',
              }}
              className="font-mono text-[11px] px-1.5 py-1 rounded border min-w-[56px] flex items-center justify-between gap-1 transition hover:bg-[var(--ov-surface-hover)]"
              title="缩放比例与预设菜单 (Ctrl+0 重置 100% / 双击空白适宽)"
              id="pdf-btn-zoom-reset"
            >
              <span>{zoom}%</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showZoomMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                  boxShadow: 'var(--ov-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.3))',
                }}
                className="absolute right-0 top-full mt-1.5 w-36 rounded-lg border shadow-xl p-1 z-30 flex flex-col gap-0.5 text-xs animate-in fade-in zoom-in-95 duration-100"
              >
                <div
                  className="px-2 py-1 text-[10px] font-semibold border-b"
                  style={{ color: 'var(--ov-text-muted)', borderColor: 'var(--ov-border-subtle)' }}
                >
                  缩放预设
                </div>
                <button
                  onClick={() => {
                    handleFitWidth();
                    setShowZoomMenu(false);
                  }}
                  className="flex items-center justify-between px-2 py-1 rounded transition hover:bg-[var(--ov-surface-hover)] text-left"
                >
                  <span>适合宽度</span>
                  <span className="text-[10px] opacity-50 font-mono">W</span>
                </button>
                <button
                  onClick={() => {
                    handleFitPage();
                    setShowZoomMenu(false);
                  }}
                  className="flex items-center justify-between px-2 py-1 rounded transition hover:bg-[var(--ov-surface-hover)] text-left"
                >
                  <span>适合页面</span>
                  <span className="text-[10px] opacity-50 font-mono">H</span>
                </button>
                <button
                  onClick={() => {
                    handleResetZoom();
                    setShowZoomMenu(false);
                  }}
                  className="flex items-center justify-between px-2 py-1 rounded transition hover:bg-[var(--ov-surface-hover)] text-left font-medium"
                  style={{ color: zoom === 100 ? 'var(--ov-accent)' : undefined }}
                >
                  <span>实际大小 100%</span>
                  <span className="text-[10px] opacity-50 font-mono">0</span>
                </button>

                <div className="w-full h-px my-0.5" style={{ backgroundColor: 'var(--ov-border-subtle)' }} />

                {PDF_ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setZoom(preset);
                      triggerZoomIndicator(preset);
                      setShowZoomMenu(false);
                    }}
                    className="flex items-center justify-between px-2 py-1 rounded transition hover:bg-[var(--ov-surface-hover)] text-left font-mono text-[11px]"
                    style={{ color: zoom === preset ? 'var(--ov-accent)' : undefined }}
                  >
                    <span>{preset}%</span>
                    {zoom === preset && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleZoomIn}
            disabled={isLoading || zoom >= MAX_PDF_ZOOM}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] disabled:opacity-40"
            title="放大 (Ctrl + + / Ctrl + 滚轮)"
            id="pdf-btn-zoom-in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFitWidth}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="px-2 py-1 rounded border text-[11px] transition hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] hidden md:inline"
            title="适应宽度"
          >
            适宽
          </button>

          <button
            onClick={handleFitPage}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="px-2 py-1 rounded border text-[11px] transition hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] hidden lg:inline"
            title="适应整页"
          >
            适页
          </button>

          <button
            onClick={handleRotate}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]"
            title="顺时针旋转 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px mx-0.5" style={{ backgroundColor: 'var(--ov-border)' }} />

          {/* 方案 C：快照导出 */}
          <button
            onClick={handleExportSnapshot}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] hover:text-amber-500"
            title="导出当前页高清快照 (PNG)"
            id="pdf-btn-snapshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* 方案 C：全屏演示模式 */}
          <button
            onClick={handleToggleFullscreen}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]"
            title={isFullscreen ? '退出全屏 (Esc)' : '全屏沉浸模式'}
            id="pdf-btn-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <div className="h-4 w-px mx-0.5" style={{ backgroundColor: 'var(--ov-border)' }} />

          {/* 本地打开 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex items-center gap-1 px-2 py-1 rounded border transition hover:bg-[var(--ov-surface-hover)]"
            title="打开本地任意外部 PDF 文档"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">打开</span>
          </button>

          {/* 打印 */}
          <button
            onClick={handlePrint}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]"
            title="打印当前页"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* 下载 */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition shadow-sm"
            title="下载原始 PDF 二进制文件"
            aria-label="下载 PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">下载</span>
          </button>
        </div>
      </header>

      {/* 主体工作区：侧边导航栏 + 主视口 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧功能侧栏 (包含方案 B 的大纲与方案 C 的批注) */}
        {showSidebar && pdfDoc && (
          <aside
            style={{
              backgroundColor: 'var(--ov-bg-elevated)',
              borderColor: 'var(--ov-border)',
            }}
            className="w-52 sm:w-60 border-r flex flex-col shrink-0 select-none z-10"
          >
            {/* 侧栏 Tab 切换器 */}
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="grid grid-cols-3 border-b p-1 text-[11px]"
            >
              <button
                onClick={() => setActiveSidebarTab('thumbnails')}
                style={{
                  backgroundColor: activeSidebarTab === 'thumbnails' ? 'var(--ov-surface)' : 'transparent',
                  color: activeSidebarTab === 'thumbnails' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                  borderColor: activeSidebarTab === 'thumbnails' ? 'var(--ov-border)' : 'transparent',
                }}
                className={`py-1 rounded flex items-center justify-center gap-1 transition ${
                  activeSidebarTab === 'thumbnails' ? 'font-semibold shadow-xs border' : 'hover:bg-[var(--ov-surface-hover)]'
                }`}
                title="页面缩略图"
              >
                <Layers className="w-3 h-3" />
                <span>缩略图</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('outline')}
                style={{
                  backgroundColor: activeSidebarTab === 'outline' ? 'var(--ov-surface)' : 'transparent',
                  color: activeSidebarTab === 'outline' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                  borderColor: activeSidebarTab === 'outline' ? 'var(--ov-border)' : 'transparent',
                }}
                className={`py-1 rounded flex items-center justify-center gap-1 transition ${
                  activeSidebarTab === 'outline' ? 'font-semibold shadow-xs border' : 'hover:bg-[var(--ov-surface-hover)]'
                }`}
                title="目录大纲"
              >
                <Bookmark className="w-3 h-3" />
                <span>大纲</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('annotations')}
                style={{
                  backgroundColor: activeSidebarTab === 'annotations' ? 'var(--ov-surface)' : 'transparent',
                  color: activeSidebarTab === 'annotations' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                  borderColor: activeSidebarTab === 'annotations' ? 'var(--ov-border)' : 'transparent',
                }}
                className={`py-1 rounded flex items-center justify-center gap-1 transition relative ${
                  activeSidebarTab === 'annotations' ? 'font-semibold shadow-xs border' : 'hover:bg-[var(--ov-surface-hover)]'
                }`}
                title="划词批注"
              >
                <Highlighter className="w-3 h-3" />
                <span>批注</span>
                {annotations.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            </div>

            {/* 侧栏主体内容 */}
            <div className="flex-1 overflow-y-auto p-2.5">
              {activeSidebarTab === 'thumbnails' && (
                <div className="flex flex-col gap-2.5">
                  <div
                    style={{ color: 'var(--ov-text-secondary)' }}
                    className="flex items-center justify-between text-[11px] px-1"
                  >
                    <span>共 {totalPages} 页</span>
                    <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono">P.{currentPage}</span>
                  </div>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                    <PdfThumbnail
                      key={pNum}
                      doc={pdfDoc}
                      pageNumber={pNum}
                      isActive={currentPage === pNum}
                      rotation={rotation}
                      onClick={() => handlePageJump(pNum)}
                    />
                  ))}
                </div>
              )}

              {activeSidebarTab === 'outline' && (
                <PdfOutlineView
                  outline={outline}
                  currentPage={currentPage}
                  onSelectPage={handlePageJump}
                />
              )}

              {activeSidebarTab === 'annotations' && (
                <PdfAnnotationsView
                  annotations={annotations}
                  currentPage={currentPage}
                  onSelectPage={handlePageJump}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onUpdateAnnotationNote={handleUpdateAnnotationNote}
                  onClearAll={handleClearAllAnnotations}
                  fileName={activeFileName}
                />
              )}
            </div>
          </aside>
        )}

        {/* 视口工作区 */}
        <main
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onDoubleClick={handleContainerDoubleClick}
          onMouseDown={handleContainerMouseDown}
          style={{
            backgroundColor: 'var(--ov-bg)',
            color: 'var(--ov-text)',
            cursor: isPanning ? 'grabbing' : (toolMode === 'hand' || isSpacePressed ? 'grab' : 'default'),
            userSelect: (isPanning || toolMode === 'hand' || isSpacePressed) ? 'none' : 'auto',
          }}
          className="flex-1 overflow-auto p-6 sm:p-10 flex flex-col items-center justify-start relative select-none"
        >
          {isLoading && (
            <div className="my-auto flex flex-col items-center gap-3" style={{ color: 'var(--ov-text-muted)' }}>
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <div className="text-sm font-medium" style={{ color: 'var(--ov-text)' }}>正在解析 PDF 二进制结构...</div>
              <div className="text-xs" style={{ color: 'var(--ov-text-muted)' }}>Mozilla PDF.js 高精度渲染引擎启动中</div>
            </div>
          )}

          {error && !isLoading && (
            <div className="my-auto max-w-md p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-200">PDF 文档渲染失败</h3>
              <p className="text-xs text-rose-600/80 dark:text-rose-300/80 leading-relaxed">{error}</p>
              <button
                onClick={() => loadDocument(binaryUrl)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重新加载</span>
              </button>
            </div>
          )}

          {/* 渲染主页面（流式纵向多页 / 单页 / 双页并排） */}
          {!isLoading && !error && pdfDoc && (
            <>
              {/* 1. 连续流式滚动模式：多页垂直无缝连贯排版 */}
              {viewMode === 'continuous' && (
                <div className="flex flex-col items-center gap-8 py-2 w-full max-w-full">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                    <div
                      key={pNum}
                      id={`pdf-page-wrapper-${pNum}`}
                      data-page-number={pNum}
                      className="flex flex-col items-center group relative"
                    >
                      {/* 页码与定位标签 */}
                      <div
                        style={{
                          backgroundColor: 'var(--ov-surface-header)',
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-text-secondary)',
                        }}
                        className="flex items-center gap-2 mb-2 text-[11px] font-mono px-2.5 py-0.5 rounded-full border shadow-sm select-none backdrop-blur-sm transition"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            currentPage === pNum ? 'bg-blue-500 animate-pulse ring-2 ring-blue-500/30' : 'opacity-40'
                          }`}
                          style={{ backgroundColor: currentPage === pNum ? undefined : 'var(--ov-text-muted)' }}
                        />
                        <span style={{ color: currentPage === pNum ? 'var(--ov-accent)' : undefined }}>
                          第 {pNum} 页 / 共 {totalPages} 页
                        </span>
                      </div>

                      <PdfPageCanvas
                        doc={pdfDoc}
                        pageNumber={pNum}
                        scale={zoom / 100}
                        rotation={rotation}
                        searchQuery={isSearchOpen ? searchQuery : undefined}
                        annotations={annotations}
                        onAddAnnotation={handleAddAnnotation}
                        onPageLoaded={pNum === 1 ? handlePageLoaded : undefined}
                        lazyRender={true}
                        estimatedDimensions={pageSize}
                        paperFilter={effectivePaperFilter}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 2. 单页或双页独立翻页模式 */}
              {viewMode !== 'continuous' && (
                <div
                  className={`flex items-start justify-center gap-4 transition-all duration-150 ${
                    viewMode === 'dual' ? 'flex-row' : 'flex-col'
                  }`}
                >
                  {/* 左侧页 / 单页 */}
                  <PdfPageCanvas
                    doc={pdfDoc}
                    pageNumber={leftPageNumber}
                    scale={zoom / 100}
                    rotation={rotation}
                    searchQuery={isSearchOpen ? searchQuery : undefined}
                    annotations={annotations}
                    onAddAnnotation={handleAddAnnotation}
                    onPageLoaded={handlePageLoaded}
                    paperFilter={effectivePaperFilter}
                  />

                  {/* 方案 B：双页并排模式下的右侧页 */}
                  {viewMode === 'dual' && rightPageNumber && rightPageNumber <= totalPages && (
                    <PdfPageCanvas
                      doc={pdfDoc}
                      pageNumber={rightPageNumber}
                      scale={zoom / 100}
                      rotation={rotation}
                      searchQuery={isSearchOpen ? searchQuery : undefined}
                      annotations={annotations}
                      onAddAnnotation={handleAddAnnotation}
                      paperFilter={effectivePaperFilter}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* 浮动缩放反馈指示器 (Ctrl+滚轮/快捷键缩放时提示，HUD 胶囊) */}
          {zoomIndicator.visible && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
                boxShadow: 'var(--ov-shadow, 0 12px 30px -4px rgba(0, 0, 0, 0.35))',
              }}
              className="fixed bottom-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full border text-xs font-mono font-medium flex items-center gap-3 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 backdrop-blur-md shadow-2xl ring-1 ring-[var(--ov-border-subtle)]"
            >
              <div className="flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
                <span className="font-semibold text-sm">{zoomIndicator.zoom}%</span>
              </div>
              <div className="w-20 h-1.5 rounded-full bg-[var(--ov-surface-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((zoomIndicator.zoom - 25) / (500 - 25)) * 100))}%`,
                    backgroundColor: 'var(--ov-accent)',
                  }}
                />
              </div>
              <span className="text-[10px] text-[var(--ov-text-muted)] font-sans">
                {zoomIndicator.zoom === 100 ? '实际大小' : zoomIndicator.zoom > 100 ? '放大' : '缩小'}
              </span>
            </div>
          )}
        </main>
      </div>

      {/* 底部状态信息条 */}
      <footer
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
        className="px-3 py-1 border-t text-[11px] flex items-center justify-between font-mono shrink-0"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" style={{ color: 'var(--ov-text)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>PDF.js v4.10 内核</span>
          </span>
          <span style={{ color: 'var(--ov-border)' }}>|</span>
          <span>
            {viewMode === 'continuous'
              ? `当前页: ${currentPage} / ${totalPages}`
              : viewMode === 'dual' && rightPageNumber && rightPageNumber <= totalPages
              ? `页面: ${leftPageNumber}-${rightPageNumber} / ${totalPages}`
              : `页面: ${currentPage} / ${totalPages}`}
          </span>
          <span style={{ color: 'var(--ov-border)' }} className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">
            视图: {viewMode === 'continuous' ? '多页流式模式' : viewMode === 'dual' ? '双页翻书模式' : '单页模式'}
          </span>
          <span style={{ color: 'var(--ov-border)' }} className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">
            滤镜: {paperMode === 'auto' ? `跟随主题 (${effectivePaperFilter})` : paperMode}
          </span>
          {annotations.length > 0 && (
            <>
              <span style={{ color: 'var(--ov-border)' }} className="hidden md:inline">|</span>
              <span className="text-amber-500 hidden md:inline">
                批注: {annotations.length} 条
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>缩放: {zoom}%</span>
          {rotation > 0 && <span>旋转: {rotation}°</span>}
          {rawBytes && (
            <span className="hidden sm:inline">
              体积: {(rawBytes.byteLength / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
      </footer>
    </div>
  );
};
