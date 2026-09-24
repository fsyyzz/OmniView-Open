/**
 * OmniView 工业级专业 PDF 阅读与分析工作台
 * 深度融合方案 A (Mozilla PDF.js 真实光栅化内核)、
 * 方案 B (全文检索、双页翻书排版、层级大纲书签树) 与
 * 方案 C (TextLayer 选词复制、彩色划词高亮、便签批注导出、高清快照与全屏演示)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
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
import type { Locale } from '../../../../shared/lib/i18n';
import { PdfThumbnail } from './pdf/PdfThumbnail';
import { PdfSearchBar } from './pdf/PdfSearchBar';
import { PdfOutlineView } from './pdf/PdfOutlineView';
import { PdfAnnotationsView, type PdfAnnotation } from './pdf/PdfAnnotationsView';
import { PdfPageCanvas, type PdfPaperFilter } from './pdf/PdfPageCanvas';

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

  // 方案 B：全文检索状态
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<PdfSearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

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

  // 提示信息定时隐藏
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  // 持久化批注至 LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(`ov_pdf_ann_${activeFileName}`, JSON.stringify(annotations));
    } catch {
      // ignore
    }
  }, [annotations, activeFileName]);

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
  const searchDebounceTimerRef = useRef<number | null>(null);

  // 组件卸载时清理定时器与动画帧
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (searchDebounceTimerRef.current !== null) {
        clearTimeout(searchDebounceTimerRef.current);
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

  // 3. 全文检索逻辑 (方案 B)
  const performSearch = useCallback(async (query: string) => {
    if (!pdfDoc || !query.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    setIsSearching(true);
    try {
      const matches = await searchPdfDocument(pdfDoc, query);
      setSearchMatches(matches);
      setCurrentMatchIndex(0);
      if (matches.length > 0) {
        handlePageJump(matches[0].pageNumber);
      }
    } catch (err) {
      console.warn('[OmniView PDF] 搜索异常:', err);
    } finally {
      setIsSearching(false);
    }
  }, [pdfDoc, handlePageJump]);

  const handleSearchQueryChange = (q: string) => {
    setSearchQuery(q);
    if (searchDebounceTimerRef.current !== null) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    if (!q.trim()) {
      performSearch('');
      return;
    }
    searchDebounceTimerRef.current = window.setTimeout(() => {
      performSearch(q);
    }, 280);
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    handlePageJump(searchMatches[nextIdx].pageNumber);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    handlePageJump(searchMatches[prevIdx].pageNumber);
  };

  // 4. 键盘全局快捷键 (Cmd+F / Esc / 左右箭头)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F 全文检索
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // 视口尺寸更新防抖防护（防止无意义的重新渲染）
  const handlePageLoaded = useCallback((dim: { width: number; height: number }) => {
    setPageSize((prev) => {
      if (prev.width === dim.width && prev.height === dim.height) return prev;
      return dim;
    });
  }, []);

  // 5. 批注管理 (方案 C)
  const handleAddAnnotation = useCallback((ann: Omit<PdfAnnotation, 'id' | 'createdAt'>) => {
    const newAnn: PdfAnnotation = {
      ...ann,
      id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: Date.now(),
    };
    setAnnotations((prev) => [newAnn, ...prev]);
    showToast(`已添加第 ${ann.pageNumber} 页高亮批注`);
  }, [showToast]);

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    showToast('已删除批注');
  };

  const handleUpdateAnnotationNote = (id: string, note: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, note } : a))
    );
    showToast('便签笔记已更新');
  };

  const handleClearAllAnnotations = () => {
    if (window.confirm('确定要清空该文档的所有高亮批注吗？此操作无法撤销。')) {
      setAnnotations([]);
      showToast('已清空全部批注');
    }
  };

  // 6. 视口排版、缩放与旋转
  const handleZoomIn = () => setZoom((z) => Math.min(250, z + 15));
  const handleZoomOut = () => setZoom((z) => Math.max(50, z - 15));
  const handleResetZoom = () => setZoom(100);

  const handleFitWidth = () => {
    if (!scrollContainerRef.current || pageSize.width <= 0) return;
    const padding = viewMode === 'dual' ? 140 : 80;
    const baseW = viewMode === 'dual' ? pageSize.width * 2 : pageSize.width;
    const containerWidth = scrollContainerRef.current.clientWidth - padding;
    if (containerWidth > 200) {
      const newScale = Math.round((containerWidth / baseW) * 100);
      setZoom(Math.max(40, Math.min(200, newScale)));
    }
  };

  const handleFitPage = () => {
    if (!scrollContainerRef.current || pageSize.height <= 0) return;
    const containerHeight = scrollContainerRef.current.clientHeight - 80;
    if (containerHeight > 200) {
      const newScale = Math.round((containerHeight / pageSize.height) * 100);
      setZoom(Math.max(40, Math.min(180, newScale)));
    }
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

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
            disabled={isLoading || zoom <= 40}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] disabled:opacity-40"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-accent)',
            }}
            className="font-mono text-[11px] px-1.5 py-1 rounded border min-w-[42px] text-center transition hover:bg-[var(--ov-surface-hover)]"
            title="重置缩放 100%"
          >
            {zoom}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={isLoading || zoom >= 250}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:bg-[var(--ov-surface-hover)] disabled:opacity-40"
            title="放大"
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
          style={{
            backgroundColor: 'var(--ov-bg)',
            color: 'var(--ov-text)',
          }}
          className="flex-1 overflow-auto p-6 sm:p-10 flex flex-col items-center justify-start relative"
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
