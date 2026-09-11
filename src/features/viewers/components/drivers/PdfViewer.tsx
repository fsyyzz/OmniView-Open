/**
 * OmniView 工业级专业 PDF 阅读与分析工作台
 * 深度融合方案 A (Mozilla PDF.js 真实光栅化内核)、
 * 方案 B (全文检索、双页翻书排版、层级大纲书签树) 与
 * 方案 C (TextLayer 选词复制、彩色划词高亮、便签批注导出、高清快照与全屏演示)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { PdfThumbnail } from './pdf/PdfThumbnail';
import { PdfSearchBar } from './pdf/PdfSearchBar';
import { PdfOutlineView } from './pdf/PdfOutlineView';
import { PdfAnnotationsView, type PdfAnnotation } from './pdf/PdfAnnotationsView';
import { PdfPageCanvas } from './pdf/PdfPageCanvas';

interface PdfViewerProps {
  fileName?: string;
  fileSize?: number;
  binaryUrl?: string;
  content?: string;
}

type SidebarTab = 'thumbnails' | 'outline' | 'annotations';
type ViewMode = 'continuous' | 'single' | 'dual';

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileName = 'technical-whitepaper.pdf',
  binaryUrl,
}) => {
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

  // 连续流式模式下的视口滚动监听与当前阅读页自动同步 (Scroll Spy)
  const handleScroll = useCallback(() => {
    if (viewMode !== 'continuous' || isProgrammaticScrollRef.current) return;
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
    performSearch(q);
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
      className="h-full flex flex-col bg-slate-950 text-slate-200 select-none relative overflow-hidden"
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
      <header className="flex flex-wrap items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs gap-2 shrink-0 z-20">
        {/* 左侧：侧栏控制、文件与引擎标识 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className={`p-1.5 rounded transition ${
              showSidebar
                ? 'bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="折叠/展开侧边导航面板"
            id="pdf-btn-toggle-sidebar"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/60 rounded border border-slate-800/80">
            <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span
              className="font-medium text-slate-200 truncate max-w-[130px] sm:max-w-[200px]"
              title={activeFileName}
            >
              {activeFileName}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 hidden xl:inline px-1.5 py-0.5 bg-blue-950/40 text-blue-300 rounded border border-blue-900/40 font-mono">
            PDF.js Core v4.10
          </span>
        </div>

        {/* 中间：翻页、页码跳转与单/双页排版模式 (方案 B) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80">
            <button
              disabled={currentPage <= 1 || isLoading}
              onClick={handlePrevPage}
              className="p-1 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded text-slate-300 transition"
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
                className="w-9 text-center bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-cyan-300 font-bold focus:outline-none focus:border-blue-500"
                title="输入页码按 Enter 跳转"
              />
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{totalPages}</span>
            </div>

            <button
              disabled={currentPage >= totalPages || isLoading}
              onClick={handleNextPage}
              className="p-1 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded text-slate-300 transition"
              title="下一页"
              id="pdf-btn-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 方案 B：排版切换（连续流式 / 单页居中 / 双页并排） */}
          <div className="hidden sm:flex items-center bg-slate-950/60 rounded border border-slate-800/80 p-0.5">
            <button
              onClick={() => handleViewModeChange('continuous')}
              className={`px-2 py-1 flex items-center gap-1 rounded transition text-xs ${
                viewMode === 'continuous'
                  ? 'bg-blue-600/30 text-blue-300 shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="连续流式滚动模式（纵向多页连看）"
              id="pdf-btn-mode-continuous"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">流式</span>
            </button>
            <button
              onClick={() => handleViewModeChange('single')}
              className={`px-2 py-1 flex items-center gap-1 rounded transition text-xs ${
                viewMode === 'single'
                  ? 'bg-blue-600/30 text-blue-300 shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="单页居中翻页模式"
              id="pdf-btn-mode-single"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden md:inline">单页</span>
            </button>
            <button
              onClick={() => handleViewModeChange('dual')}
              className={`px-2 py-1 flex items-center gap-1 rounded transition text-xs ${
                viewMode === 'dual'
                  ? 'bg-blue-600/30 text-blue-300 shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="双页并排阅读（翻书模式）"
              id="pdf-btn-mode-dual"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">双页</span>
            </button>
          </div>
        </div>

        {/* 右侧：检索、缩放、快照、全屏、打开与下载 */}
        <div className="flex items-center gap-1">
          {/* 方案 B：检索激活按钮 */}
          <button
            onClick={() => setIsSearchOpen((v) => !v)}
            className={`p-1.5 rounded transition ${
              isSearchOpen
                ? 'bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="在文档中搜索 (Cmd+F / Ctrl+F)"
            id="pdf-btn-search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* 缩放控制器 */}
          <button
            onClick={handleZoomOut}
            disabled={isLoading || zoom <= 40}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded transition"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="font-mono text-cyan-400 hover:text-cyan-300 text-[11px] px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded min-w-[42px] text-center"
            title="重置缩放 100%"
          >
            {zoom}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={isLoading || zoom >= 250}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded transition"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFitWidth}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] transition hidden md:inline"
            title="适应宽度"
          >
            适宽
          </button>

          <button
            onClick={handleFitPage}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] transition hidden lg:inline"
            title="适应整页"
          >
            适页
          </button>

          <button
            onClick={handleRotate}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title="顺时针旋转 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* 方案 C：快照导出 */}
          <button
            onClick={handleExportSnapshot}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 rounded transition"
            title="导出当前页高清快照 (PNG)"
            id="pdf-btn-snapshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* 方案 C：全屏演示模式 */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title={isFullscreen ? '退出全屏 (Esc)' : '全屏沉浸模式'}
            id="pdf-btn-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* 本地打开 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
            title="打开本地任意外部 PDF 文档"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">打开</span>
          </button>

          {/* 打印 */}
          <button
            onClick={handlePrint}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
            title="打印当前页"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* 下载 */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition shadow-sm"
            title="下载原始 PDF 二进制文件"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载</span>
          </button>
        </div>
      </header>

      {/* 主体工作区：侧边导航栏 + 主视口 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧功能侧栏 (包含方案 B 的大纲与方案 C 的批注) */}
        {showSidebar && pdfDoc && (
          <aside className="w-52 sm:w-60 border-r border-slate-800 bg-slate-900/80 flex flex-col shrink-0 select-none z-10">
            {/* 侧栏 Tab 切换器 */}
            <div className="grid grid-cols-3 border-b border-slate-800 p-1 bg-slate-950/40 text-[11px]">
              <button
                onClick={() => setActiveSidebarTab('thumbnails')}
                className={`py-1 rounded flex items-center justify-center gap-1 transition ${
                  activeSidebarTab === 'thumbnails'
                    ? 'bg-slate-800 text-blue-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="页面缩略图"
              >
                <Layers className="w-3 h-3" />
                <span>缩略图</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('outline')}
                className={`py-1 rounded flex items-center justify-center gap-1 transition ${
                  activeSidebarTab === 'outline'
                    ? 'bg-slate-800 text-blue-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="目录大纲"
              >
                <Bookmark className="w-3 h-3" />
                <span>大纲</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('annotations')}
                className={`py-1 rounded flex items-center justify-center gap-1 transition relative ${
                  activeSidebarTab === 'annotations'
                    ? 'bg-slate-800 text-blue-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="划词批注"
              >
                <Highlighter className="w-3 h-3" />
                <span>批注</span>
                {annotations.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            </div>

            {/* 侧栏主体内容 */}
            <div className="flex-1 overflow-y-auto p-2.5">
              {activeSidebarTab === 'thumbnails' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>共 {totalPages} 页</span>
                    <span className="text-[10px] text-slate-500 font-mono">P.{currentPage}</span>
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
          className="flex-1 overflow-auto p-6 sm:p-10 flex flex-col items-center justify-start bg-slate-950/90 relative"
        >
          {isLoading && (
            <div className="my-auto flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <div className="text-sm font-medium">正在解析 PDF 二进制结构...</div>
              <div className="text-xs text-slate-500">Mozilla PDF.js 高精度渲染引擎启动中</div>
            </div>
          )}

          {error && !isLoading && (
            <div className="my-auto max-w-md p-6 bg-rose-950/30 border border-rose-800/80 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-rose-200">PDF 文档渲染失败</h3>
              <p className="text-xs text-rose-300/80 leading-relaxed">{error}</p>
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
                      <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-800 shadow-sm select-none backdrop-blur-sm transition">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            currentPage === pNum ? 'bg-blue-400 animate-pulse ring-2 ring-blue-500/30' : 'bg-slate-500'
                          }`}
                        />
                        <span className={currentPage === pNum ? 'text-blue-300 font-semibold' : ''}>
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
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 底部状态信息条 */}
      <footer className="px-3 py-1 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>PDF.js v4.10 内核</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            {viewMode === 'continuous'
              ? `当前页: ${currentPage} / ${totalPages}`
              : viewMode === 'dual' && rightPageNumber && rightPageNumber <= totalPages
              ? `页面: ${leftPageNumber}-${rightPageNumber} / ${totalPages}`
              : `页面: ${currentPage} / ${totalPages}`}
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="hidden sm:inline">
            视图: {viewMode === 'continuous' ? '多页流式模式' : viewMode === 'dual' ? '双页翻书模式' : '单页模式'}
          </span>
          {annotations.length > 0 && (
            <>
              <span className="text-slate-600 hidden md:inline">|</span>
              <span className="text-amber-400 hidden md:inline">
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
