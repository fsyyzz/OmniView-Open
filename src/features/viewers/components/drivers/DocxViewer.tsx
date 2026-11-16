import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Info,
  RotateCcw,
  Printer,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  Copy,
  Check,
  AlertTriangle,
  MoveHorizontal,
  RefreshCw,
} from 'lucide-react';
import {
  parseDocx,
  renderDocxToContainer,
  base64ToBytes,
  extractHeadingsFromDom,
  type ParsedDocxDocument,
  type DocxTocItem,
} from '../../lib/docxEngine';
import { paginateDocxContainer } from '../../lib/docxPaginationEngine';
import { docxDomToMarkdown } from '../../lib/docxMarkdownConverter';
import { DocxTocSidebar } from './docx/DocxTocSidebar';
import { LightboxModal, type LightboxItem } from '../common/LightboxModal';
import { highlightSearchMatches, clearSearchHighlights, activateMatch } from '../../lib/domSearchHighlighter';
import { aggregateSearchMatchesByToc, type DocxSectionSearchMatch } from '../../lib/docxSearchAggregator';
import { requestPrintHtml } from '../../../../shared/lib/printBridge';
import { getVsCodeApi } from '../../../../shared/lib/vscode';
import type { ThemeId } from '../../../../shared/types';
import { type Locale } from '../../../../shared/lib/i18n';

export interface DocxViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

const DOCX_COPY: Record<Locale, {
  nav: string;
  navTip: string;
  zoomOutTip: string;
  zoomInTip: string;
  zoomResetTip: string;
  fitWidth: string;
  fitWidthTip: string;
  prevPageTip: string;
  nextPageTip: string;
  pagePrefix: string;
  pageSuffix: (total: number) => string;
  pageInputTip: string;
  searchPlaceholder: string;
  clearSearchTip: string;
  prevMatchTip: string;
  nextMatchTip: string;
  modeFluid: string;
  modeFluidTip: string;
  modePaged: string;
  modePagedTip: string;
  themePaper: string;
  themePaperTip: string;
  themeSepia: string;
  themeSepiaTip: string;
  themeDark: string;
  themeDarkTip: string;
  printTip: string;
  copyMdTip: string;
  copiedMdTip: string;
  infoTip: string;
  reloadTip: string;
  fullscreenTip: string;
  exitFullscreenTip: string;
  loadingText: string;
  errorTitle: string;
  retry: string;
  fallbackAlert: string;
  dismissAlert: string;
  metaTitle: string;
  metaDocTitle: string;
  metaCreator: string;
  metaUnrecorded: string;
  metaDesc: string;
  metaCreated: string;
  metaCompany: string;
  metaPages: (n: number) => string;
  metaWords: (v: string | number) => string;
  metaSize: (s: string) => string;
  imageLabel: (idx: number) => string;
  parseErrorFallback: string;
  renderErrorFallback: string;
}> = {
  'zh-CN': {
    nav: '导航',
    navTip: '导航窗口 / 目录大纲 (Ctrl+Shift+O)',
    zoomOutTip: '缩小 (Ctrl + 滚轮)',
    zoomInTip: '放大 (Ctrl + 滚轮)',
    zoomResetTip: '重置缩放 (100%)',
    fitWidth: '适宽',
    fitWidthTip: '自动适配当前视口宽度',
    prevPageTip: '上一页 (PageUp)',
    nextPageTip: '下一页 (PageDown)',
    pagePrefix: '第',
    pageSuffix: (total) => `/ ${total} 页`,
    pageInputTip: '输入页码回车直达',
    searchPlaceholder: '搜索正文... (Ctrl+F)',
    clearSearchTip: '清除搜索 (Esc)',
    prevMatchTip: '上一个匹配项 (Shift+Enter)',
    nextMatchTip: '下一个匹配项 (Enter)',
    modeFluid: '流式',
    modeFluidTip: '现代化无缝流式阅读：无截断、无大段空白，长文表格丝滑展开',
    modePaged: '分页',
    modePagedTip: 'A4 物理分页排版：模拟实体纸张排版与跨页长表延续',
    themePaper: '原纸',
    themePaperTip: '原始白纸排版 (Classic Paper)',
    themeSepia: '羊皮',
    themeSepiaTip: '护眼羊皮纸 (Eye-care Sepia)',
    themeDark: '暗夜',
    themeDarkTip: '夜间暗色纸张 (保留插图原彩)',
    printTip: '系统打印 / 导出为 PDF (Ctrl+P)',
    copyMdTip: '复制全文为 Markdown',
    copiedMdTip: '已复制 Markdown',
    infoTip: '文档元数据详情',
    reloadTip: '重新解析载入文档',
    fullscreenTip: '全屏阅读',
    exitFullscreenTip: '退出全屏 (Esc)',
    loadingText: '正在解析 Word 文档结构...',
    errorTitle: '文档加载失败',
    retry: '重新加载',
    fallbackAlert: '当前 .docx 二进制包解析异常或结构不完整，已安全降级展示内置离线指南文档。',
    dismissAlert: '关闭提示',
    metaTitle: 'Word 文档元数据',
    metaDocTitle: '文档标题 / Title',
    metaCreator: '作者 / Creator',
    metaUnrecorded: '未记录',
    metaDesc: '简介 / Description',
    metaCreated: '创建时间 / Created',
    metaCompany: '组织 / Company',
    metaPages: (n) => `文档总页数: ${n} 页`,
    metaWords: (v) => `字数统计: ${v}`,
    metaSize: (s) => `文件大小: ${s}`,
    imageLabel: (idx) => `文档插图 #${idx}`,
    parseErrorFallback: 'DOCX 文档解析异常',
    renderErrorFallback: 'DOCX 视图渲染异常',
  },
  'en-US': {
    nav: 'Outline',
    navTip: 'Navigation Pane / Outline (Ctrl+Shift+O)',
    zoomOutTip: 'Zoom Out (Ctrl + Wheel)',
    zoomInTip: 'Zoom In (Ctrl + Wheel)',
    zoomResetTip: 'Reset Zoom (100%)',
    fitWidth: 'Fit',
    fitWidthTip: 'Fit document to viewport width',
    prevPageTip: 'Previous Page (PageUp)',
    nextPageTip: 'Next Page (PageDown)',
    pagePrefix: 'P',
    pageSuffix: (total) => `/ ${total}`,
    pageInputTip: 'Enter page number and press Enter',
    searchPlaceholder: 'Search document... (Ctrl+F)',
    clearSearchTip: 'Clear search (Esc)',
    prevMatchTip: 'Previous match (Shift+Enter)',
    nextMatchTip: 'Next match (Enter)',
    modeFluid: 'Fluid',
    modeFluidTip: 'Continuous fluid reading without page gaps',
    modePaged: 'Paged',
    modePagedTip: 'A4 paginated paper layout with multi-page table splitting',
    themePaper: 'Paper',
    themePaperTip: 'Classic white paper',
    themeSepia: 'Sepia',
    themeSepiaTip: 'Warm eye-care sepia paper',
    themeDark: 'Dark',
    themeDarkTip: 'Dark reading paper (preserves original image colors)',
    printTip: 'Print / Export PDF (Ctrl+P)',
    copyMdTip: 'Copy full document as Markdown',
    copiedMdTip: 'Markdown copied',
    infoTip: 'Document Metadata',
    reloadTip: 'Reload document',
    fullscreenTip: 'Fullscreen Reading',
    exitFullscreenTip: 'Exit Fullscreen (Esc)',
    loadingText: 'Parsing Word document structure...',
    errorTitle: 'Failed to load document',
    retry: 'Reload',
    fallbackAlert: 'The .docx archive could not be parsed cleanly; displaying the offline fallback guide instead.',
    dismissAlert: 'Dismiss',
    metaTitle: 'Word Metadata',
    metaDocTitle: 'Title',
    metaCreator: 'Author / Creator',
    metaUnrecorded: 'Not specified',
    metaDesc: 'Description',
    metaCreated: 'Created',
    metaCompany: 'Company',
    metaPages: (n) => `Total pages: ${n}`,
    metaWords: (v) => `Word count: ${v}`,
    metaSize: (s) => `File size: ${s}`,
    imageLabel: (idx) => `Document Image #${idx}`,
    parseErrorFallback: 'Failed to parse DOCX document',
    renderErrorFallback: 'Failed to render DOCX view',
  },
};

export const DocxViewer: React.FC<DocxViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'document.docx',
  fileSize,
  isDarkTheme = false,
  locale = 'zh-CN',
}) => {
  const copy = DOCX_COPY[locale] || DOCX_COPY['zh-CN'];

  const [docData, setDocData] = useState<ParsedDocxDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackDismissed, setFallbackDismissed] = useState<boolean>(false);

  const [zoom, setZoom] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<'manual' | 'fitWidth'>('manual');
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showNavigation, setShowNavigation] = useState<boolean>(true);
  const [tocItems, setTocItems] = useState<DocxTocItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);

  const [viewMode, setViewMode] = useState<'fluid' | 'paged'>('fluid');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageInputVal, setPageInputVal] = useState<string>('1');
  const [paperTheme, setPaperTheme] = useState<'paper' | 'dark' | 'sepia'>(() =>
    isDarkTheme ? 'paper' : 'paper'
  );

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchCount, setMatchCount] = useState<number>(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [searchGroups, setSearchGroups] = useState<Map<string, DocxSectionSearchMatch[]>>(new Map());
  const [mdCopied, setMdCopied] = useState<boolean>(false);

  // Lightbox 图片预览态
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const docxMountRef = useRef<HTMLDivElement>(null);
  const styleContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchQueryRef = useRef<string>(searchQuery);
  const pendingScrollRatioRef = useRef<number | null>(null);
  const prevViewModeRef = useRef<'fluid' | 'paged'>(viewMode);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // 监测滚动视口宽度与渲染文档自然尺寸，用于真实盒模型缩放定位
  useEffect(() => {
    const scrollEl = scrollAreaRef.current;
    const mountEl = docxMountRef.current;
    if (typeof ResizeObserver === 'undefined') return;

    const updateSizes = () => {
      if (scrollEl) {
        setViewportWidth(scrollEl.clientWidth);
      }
      if (mountEl) {
        const w = mountEl.scrollWidth || mountEl.offsetWidth || 0;
        const h = mountEl.scrollHeight || mountEl.offsetHeight || 0;
        if (w > 0 || h > 0) {
          setNaturalSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
        }
      }
    };

    updateSizes();
    const ro = new ResizeObserver(() => updateSizes());
    if (scrollEl) ro.observe(scrollEl);
    if (mountEl) ro.observe(mountEl);

    return () => ro.disconnect();
  }, [loading, viewMode, docData]);

  // 计算有效缩放倍率（支持手动倍率与“适合宽度”自适应）
  const effectiveZoom =
    zoomMode === 'fitWidth' && viewportWidth > 64 && naturalSize.width > 0
      ? Math.min(2.0, Math.max(0.5, (viewportWidth - 48) / naturalSize.width))
      : zoom;

  // 监听全屏状态同步 & 全屏悬浮 HUD 自动显隐
  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement && containerRef.current && document.fullscreenElement === containerRef.current);
      setIsFullscreen(active);
      if (active) setHudVisible(true);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const revealHud = useCallback(() => {
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    if (isFullscreen) {
      hudTimerRef.current = setTimeout(() => setHudVisible(false), 2600);
    }
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, []);

  // 复制为 Markdown
  const handleCopyAsMarkdown = useCallback(() => {
    const md = docxDomToMarkdown(docxMountRef.current);
    if (!md || !md.trim()) return;
    navigator.clipboard.writeText(md).then(() => {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 2000);
    }).catch((err) => {
      console.warn('[DocxViewer] 复制到剪贴板失败:', err);
    });
  }, []);

  // 纯净隔离 A4 打印管道（包含隔离容器注入的 docx-preview 样式）
  const handlePrint = useCallback(() => {
    if (!docxMountRef.current) return;

    const clone = docxMountRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.docx-search-highlight, .docx-search-active, mark.ov-search-match').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    clone.classList.remove('docx-heading-highlight-flash');

    const hostStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');
    const scopedDocxStyles = styleContainerRef.current?.innerHTML || '';

    const printTitle = docData?.metadata?.title || fileName || 'Word Document';
    const printHtml = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${printTitle.replace(/[<>&"]/g, '')}</title>
  ${hostStyles}
  ${scopedDocxStyles}
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #1a1a1a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif !important;
      overflow: visible !important;
      height: auto !important;
    }
    .docx-viewport-root {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      gap: 0 !important;
      box-shadow: none !important;
      transform: none !important;
      filter: none !important;
    }
    .docx-viewport-root section,
    .docx-viewport-root .docx-rendered-wrapper,
    .docx-viewport-root section.docx-rendered-wrapper,
    .docx-viewport-root .docx_page {
      background: #ffffff !important;
      color: #1a1a1a !important;
      box-shadow: none !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      min-height: auto !important;
      page-break-inside: auto !important;
    }
    .docx-viewport-root .docx_page,
    .docx-viewport-root section {
      page-break-after: always !important;
      break-after: page !important;
    }
    .docx-viewport-root .docx_page:last-child,
    .docx-viewport-root section:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    table, tr, td, th {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="Heading"] {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;

    requestPrintHtml(fileName || 'word-document', printHtml, {
      vscode: getVsCodeApi(),
      preferNativeInBrowser: false,
    });
  }, [docData, fileName, locale]);

  // 搜索关键字高亮与大纲就地热力聚类
  useEffect(() => {
    if (!docxMountRef.current) return;
    if (!searchQuery.trim()) {
      clearSearchHighlights(docxMountRef.current);
      setMatchCount(0);
      setActiveMatchIndex(-1);
      setSearchGroups(new Map());
      return;
    }

    const timer = setTimeout(() => {
      if (!docxMountRef.current) return;
      const count = highlightSearchMatches(docxMountRef.current, searchQuery);
      setMatchCount(count);
      if (count > 0) {
        setShowNavigation(true);
        setActiveMatchIndex(0);
        activateMatch(docxMountRef.current, 0, false);
        const aggRes = aggregateSearchMatchesByToc(docxMountRef.current, tocItems);
        setSearchGroups(aggRes.groups);
      } else {
        setActiveMatchIndex(-1);
        setSearchGroups(new Map());
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, tocItems]);

  const handleNavigateMatch = (backwards = false) => {
    if (!docxMountRef.current || matchCount === 0) return;
    setActiveMatchIndex(prev => {
      let next = backwards ? prev - 1 : prev + 1;
      if (next < 0) next = matchCount - 1;
      if (next >= matchCount) next = 0;
      activateMatch(docxMountRef.current, next, true);
      return next;
    });
  };

  // 点击左侧导航栏匹配卡片，直接高亮并精准跳转到对应位置
  const handleSelectMatch = useCallback((targetMatchIndex: number) => {
    if (!docxMountRef.current) return;
    setActiveMatchIndex(targetMatchIndex);
    activateMatch(docxMountRef.current, targetMatchIndex, true);
  }, []);

  // 跳转至指定页码
  const handleJumpToPage = useCallback((pageNum: number) => {
    if (!docxMountRef.current || !scrollAreaRef.current) return;
    const targetPage = Math.max(1, Math.min(totalPages, pageNum));
    const sheet = docxMountRef.current.querySelector<HTMLElement>(`[data-page-number="${targetPage}"]`);
    if (sheet) {
      const scrollContainer = scrollAreaRef.current;
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = sheet.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top;
      const targetScrollTop = Math.max(0, scrollContainer.scrollTop + relativeTop - 12);
      scrollContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
      setCurrentPage(targetPage);
      setPageInputVal(String(targetPage));
    }
  }, [totalPages]);

  // 切换流式/分页模式时记录滚动比例，实现无感平滑过渡
  const handleSwitchViewMode = useCallback((nextMode: 'fluid' | 'paged') => {
    if (nextMode === viewMode) return;
    if (scrollAreaRef.current) {
      const el = scrollAreaRef.current;
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      pendingScrollRatioRef.current = el.scrollTop / maxScroll;
    }
    setViewMode(nextMode);
  }, [viewMode]);

  // Ctrl+滚轮平滑缩放
  const handleViewportWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoomMode('manual');
    setZoom(prev => {
      const base = zoomMode === 'fitWidth' ? effectiveZoom : prev;
      return Math.round(Math.min(2.0, Math.max(0.5, base + delta)) * 100) / 100;
    });
  }, [zoomMode, effectiveZoom]);

  // 全局快捷键：Ctrl+F (搜索) / Ctrl+Shift+O (目录大纲) / Ctrl+P (打印) / PageUp / PageDown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setShowNavigation(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setShowNavigation(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'PageUp' && viewMode === 'paged') {
        e.preventDefault();
        handleJumpToPage(currentPage - 1);
      } else if (e.key === 'PageDown' && viewMode === 'paged') {
        e.preventDefault();
        handleJumpToPage(currentPage + 1);
      } else if (e.key === 'Escape' && isFullscreen && lightboxIndex < 0) {
        e.preventDefault();
        setIsFullscreen(false);
        setHudVisible(true);
        if (hudTimerRef.current) {
          clearTimeout(hudTimerRef.current);
          hudTimerRef.current = null;
        }
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint, viewMode, currentPage, handleJumpToPage, isFullscreen, lightboxIndex]);

  const [reloadNonce, setReloadNonce] = useState(0);
  const loadDocument = useCallback(() => setReloadNonce(n => n + 1), []);

  // 解析并载入 DOCX 数据 (含并发竞态防护与过时结果丢弃)
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setFallbackDismissed(false);

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

        const parsed = await parseDocx(rawData);
        if (!isCancelled) {
          setDocData(parsed);
          if (parsed.metadata?.pageCount && parsed.metadata.pageCount > 0) {
            setTotalPages(parsed.metadata.pageCount);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('[DocxViewer] 解析失败:', err);
          setError(err instanceof Error ? err.message : copy.parseErrorFallback);
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [content, binaryUrl, reloadNonce, copy.parseErrorFallback]);

  // 当 docData 解析完毕后，渲染至 DOM 挂载容器并提取大纲标题
  useEffect(() => {
    if (!docData?.rawBytes || !docxMountRef.current) return;
    let isCancelled = false;
    const isModeSwitch = prevViewModeRef.current !== viewMode;
    prevViewModeRef.current = viewMode;

    const render = async () => {
      try {
        if (!docxMountRef.current) return;
        await renderDocxToContainer(
          docData.rawBytes,
          docxMountRef.current,
          {
            inWrapper: true,
            ignoreWidth: viewMode === 'fluid',
            breakPages: viewMode === 'paged',
            ignoreLastRenderedPageBreak: false,
          },
          styleContainerRef.current ?? undefined
        );

        if (!isCancelled) {
          setLoading(false);

          if (viewMode === 'paged' && docxMountRef.current) {
            const pageRes = paginateDocxContainer(docxMountRef.current, {
              expectedPageCount: docData.metadata?.pageCount,
              locale,
            });
            setTotalPages(pageRes.totalPages);
            setCurrentPage(1);
            setPageInputVal('1');
          } else {
            setTotalPages(1);
            setCurrentPage(1);
            setPageInputVal('1');
          }

          // 测量自然宽高
          if (docxMountRef.current) {
            const w = docxMountRef.current.scrollWidth || docxMountRef.current.offsetWidth || 0;
            const h = docxMountRef.current.scrollHeight || docxMountRef.current.offsetHeight || 0;
            if (w > 0 || h > 0) {
              setNaturalSize({ width: w, height: h });
            }
          }

          // 提取层级大纲并恢复搜索高亮 / 滚动比例
          setTimeout(() => {
            if (isCancelled || !docxMountRef.current) return;
            const headings = extractHeadingsFromDom(docxMountRef.current);
            setTocItems(headings);
            if (headings.length > 0) {
              setActiveHeadingId(headings[0].id);
            }

            const activeSearch = searchQueryRef.current.trim();
            if (activeSearch) {
              const count = highlightSearchMatches(docxMountRef.current, activeSearch);
              setMatchCount(count);
              if (count > 0) {
                setActiveMatchIndex(0);
                activateMatch(docxMountRef.current, 0, false);
                const aggRes = aggregateSearchMatchesByToc(docxMountRef.current, headings);
                setSearchGroups(aggRes.groups);
              } else {
                setActiveMatchIndex(-1);
                setSearchGroups(new Map());
              }
            }

            if (isModeSwitch && pendingScrollRatioRef.current !== null && scrollAreaRef.current) {
              const ratio = pendingScrollRatioRef.current;
              pendingScrollRatioRef.current = null;
              const el = scrollAreaRef.current;
              const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
              el.scrollTop = Math.round(ratio * maxScroll);
            }
          }, 80);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[DocxViewer] 挂载渲染异常:', err);
          setError(err instanceof Error ? err.message : copy.renderErrorFallback);
          setLoading(false);
        }
      }
    };
    void render();
    return () => {
      isCancelled = true;
    };
  }, [docData, viewMode, locale, copy.renderErrorFallback]);

  // 文档内点击图片弹出 Lightbox 大图阅览
  const handleDocumentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target || !docxMountRef.current) return;
    const imgEl = (target.tagName === 'IMG' ? target : target.closest('img')) as HTMLImageElement | null;
    if (!imgEl) return;
    const src = imgEl.getAttribute('src') || imgEl.src;
    if (!src) return;

    const allImgs = Array.from(docxMountRef.current.querySelectorAll<HTMLImageElement>('img'))
      .filter(img => Boolean(img.getAttribute('src') || img.src));
    const clickedIdx = Math.max(0, allImgs.indexOf(imgEl));
    const items: LightboxItem[] = allImgs.map((img, i) => ({
      type: 'image',
      title: img.getAttribute('alt') || img.getAttribute('title') || copy.imageLabel(i + 1),
      url: img.getAttribute('src') || img.src,
      content: img.getAttribute('src') || img.src,
      fileName: img.getAttribute('alt') || `docx-image-${i + 1}.png`,
    }));

    if (items.length > 0) {
      setLightboxItems(items);
      setLightboxIndex(clickedIdx);
    }
  }, [copy]);

  // 导航选中标题定位
  const handleSelectHeading = useCallback((item: DocxTocItem) => {
    setActiveHeadingId(item.id);
    const scrollContainer = scrollAreaRef.current;
    let targetEl = item.element || (docxMountRef.current ? document.getElementById(item.id) : null);

    if (docxMountRef.current && targetEl) {
      if (
        targetEl.closest('[class*="toc"], [class*="TOC"], .docx-toc, .word-toc, sdt') ||
        /\btoc[0-9]?\b/i.test(targetEl.className)
      ) {
        const cleanText = item.text.trim().toLowerCase();
        const allHeadings = Array.from(docxMountRef.current.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p'));
        const bodyHeading = allHeadings.find(el => {
          if (el.closest('[class*="toc"], [class*="TOC"], .docx-toc, .word-toc, sdt') || /\btoc[0-9]?\b/i.test(el.className)) {
            return false;
          }
          const txt = el.textContent?.trim().toLowerCase() || '';
          return txt === cleanText || (txt.length > 0 && cleanText.length > 0 && (txt.includes(cleanText) || cleanText.includes(txt)));
        });
        if (bodyHeading) {
          targetEl = bodyHeading;
        }
      }
    }

    if (targetEl && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top;
      const targetScrollTop = Math.max(0, scrollContainer.scrollTop + relativeTop - 24);

      scrollContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });

      targetEl.classList.add('docx-heading-highlight-flash');
      setTimeout(() => {
        targetEl?.classList.remove('docx-heading-highlight-flash');
      }, 1600);
    }
  }, []);

  // 滚动时检测视口最上方的标题项以及当前可见的页码
  const handleMainScroll = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const scrollContainerTop = scrollAreaRef.current.getBoundingClientRect().top;

    if (tocItems.length > 0) {
      let currentActiveId = tocItems[0].id;
      for (const item of tocItems) {
        const el = item.element || document.getElementById(item.id);
        if (el) {
          const top = el.getBoundingClientRect().top - scrollContainerTop;
          if (top <= 120) {
            currentActiveId = item.id;
          } else {
            break;
          }
        }
      }
      setActiveHeadingId(currentActiveId);
    }

    if (viewMode === 'paged' && docxMountRef.current) {
      const sheets = Array.from(docxMountRef.current.querySelectorAll<HTMLElement>('.docx-paged-sheet'));
      if (sheets.length > 0) {
        const targetLine = scrollContainerTop + scrollAreaRef.current.clientHeight * 0.35;
        let detected = 1;
        for (let i = 0; i < sheets.length; i++) {
          const rect = sheets[i].getBoundingClientRect();
          if (rect.top <= targetLine && rect.bottom >= scrollContainerTop) {
            detected = i + 1;
          }
        }
        setCurrentPage(detected);
        setPageInputVal(String(detected));
      }
    }
  }, [tocItems, viewMode]);

  // 全屏切换（兼容 VS Code Webview 禁用原生 Fullscreen API 时的样式级全屏沉浸）
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (isFullscreen || document.fullscreenElement) {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsFullscreen(false);
      setHudVisible(true);
      if (hudTimerRef.current) {
        clearTimeout(hudTimerRef.current);
        hudTimerRef.current = null;
      }
    } else {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
      setHudVisible(true);
    }
  }, [isFullscreen]);

  const showFallbackAlert = Boolean((docData?.isFallbackUsed || docData?.isValid === false) && !fallbackDismissed && !loading && !error);

  return (
    <div
      ref={containerRef}
      onMouseMove={isFullscreen ? revealHud : undefined}
      className="w-full h-full flex flex-col overflow-hidden relative select-none font-sans bg-[var(--ov-bg)] text-[var(--ov-text)]"
    >
      {/* 独立隔离的 docx-preview 样式容器，避免多标签页样式污染 document.head */}
      <div ref={styleContainerRef} className="hidden" aria-hidden="true" />

      {/* 顶部主工具栏 */}
      <header className="h-12 border-b border-[var(--ov-border)] bg-[var(--ov-surface-header)] px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 gap-2">
        {/* 左侧：导航窗口开关、文件名与标识 */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setShowNavigation(prev => !prev)}
            className={`px-2 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium border ${
              showNavigation
                ? 'bg-[var(--ov-accent-subtle)] text-[var(--ov-accent)] border-[var(--ov-accent)]/40'
                : 'border-transparent text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)]'
            }`}
            title={copy.navTip}
          >
            <PanelLeft className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">{copy.nav}</span>
          </button>

          <div className="h-4 w-px bg-[var(--ov-border)] hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[var(--ov-accent-subtle)] border border-[var(--ov-border)] flex items-center justify-center text-[var(--ov-accent)] shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span
              className="font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-xs text-[var(--ov-text)]"
              title={docData?.metadata?.title || fileName}
            >
              {docData?.metadata?.title || fileName}
            </span>
          </div>
        </div>

        {/* 中间：缩放控制与页码导航 */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setZoom(prev => Math.max(0.5, prev - 0.1));
            }}
            disabled={zoomMode === 'manual' && zoom <= 0.5}
            className="p-1.5 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] disabled:opacity-30 transition-colors"
            title={copy.zoomOutTip}
            aria-label={copy.zoomOutTip}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums px-1 min-w-[44px] text-center text-[var(--ov-text)]">
            {Math.round(effectiveZoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setZoom(prev => Math.min(2.0, prev + 0.1));
            }}
            disabled={zoomMode === 'manual' && zoom >= 2.0}
            className="p-1.5 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] disabled:opacity-30 transition-colors"
            title={copy.zoomInTip}
            aria-label={copy.zoomInTip}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setZoom(1.0);
            }}
            className="p-1.5 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] transition-colors"
            title={copy.zoomResetTip}
            aria-label={copy.zoomResetTip}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomMode(prev => (prev === 'fitWidth' ? 'manual' : 'fitWidth'))}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1 whitespace-nowrap ${
              zoomMode === 'fitWidth'
                ? 'bg-[var(--ov-accent-subtle)] text-[var(--ov-accent)] border-[var(--ov-accent)]/40'
                : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)]'
            }`}
            title={copy.fitWidthTip}
          >
            <MoveHorizontal className="w-3 h-3" />
            <span className="hidden lg:inline">{copy.fitWidth}</span>
          </button>

          {/* 真实物理页数导航器 (分页模式且多页时) */}
          {viewMode === 'paged' && totalPages > 1 && (
            <div className="flex items-center gap-1 bg-[var(--ov-bg-elevated)] px-2 py-0.5 rounded-md border border-[var(--ov-border)] text-xs font-mono tabular-nums ml-1">
              <button
                type="button"
                onClick={() => handleJumpToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-0.5 rounded hover:bg-[var(--ov-surface)] disabled:opacity-30 transition-colors"
                title={copy.prevPageTip}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <span className="text-[var(--ov-text-secondary)] text-[11px]">{copy.pagePrefix}</span>
              <input
                type="text"
                value={pageInputVal}
                onChange={e => setPageInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const num = parseInt(pageInputVal, 10);
                    if (!isNaN(num)) handleJumpToPage(num);
                  }
                }}
                onBlur={() => {
                  const num = parseInt(pageInputVal, 10);
                  if (!isNaN(num)) {
                    handleJumpToPage(num);
                  } else {
                    setPageInputVal(String(currentPage));
                  }
                }}
                className="w-7 text-center bg-transparent border-b border-[var(--ov-border)] focus:border-[var(--ov-accent)] focus:outline-none text-xs font-semibold text-[var(--ov-text)]"
                title={copy.pageInputTip}
              />
              <span className="text-[var(--ov-text-secondary)] text-[11px] whitespace-nowrap">{copy.pageSuffix(totalPages)}</span>
              <button
                type="button"
                onClick={() => handleJumpToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-0.5 rounded hover:bg-[var(--ov-surface)] disabled:opacity-30 transition-colors"
                title={copy.nextPageTip}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 中间：全文搜索框 */}
        <div className="hidden sm:flex items-center gap-1.5 flex-1 max-w-xs justify-center">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ov-text-secondary)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNavigateMatch(e.shiftKey);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSearchQuery('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={copy.searchPlaceholder}
              className="w-full pl-8 pr-16 py-1 text-xs rounded-md bg-[var(--ov-bg-elevated)] text-[var(--ov-text)] border border-[var(--ov-border)] focus:outline-none focus:border-[var(--ov-accent)] placeholder:text-[var(--ov-text-secondary)]/70"
            />
            {matchCount > 0 && (
              <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums text-[var(--ov-text-secondary)]">
                {activeMatchIndex + 1}/{matchCount}
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]"
                title={copy.clearSearchTip}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {matchCount > 0 && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => handleNavigateMatch(true)}
                className="p-1 rounded hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]"
                title={copy.prevMatchTip}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateMatch(false)}
                className="p-1 rounded hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]"
                title={copy.nextMatchTip}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 右侧：视图模式切换、纸张主题、打印与元数据 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 视图模式切换：流式 vs 分页 */}
          <div className="flex items-center bg-[var(--ov-bg-elevated)] rounded-md p-0.5 border border-[var(--ov-border)]">
            <button
              type="button"
              onClick={() => handleSwitchViewMode('fluid')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                viewMode === 'fluid'
                  ? 'bg-[var(--ov-accent)] text-white'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={copy.modeFluidTip}
            >
              {copy.modeFluid}
            </button>
            <button
              type="button"
              onClick={() => handleSwitchViewMode('paged')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                viewMode === 'paged'
                  ? 'bg-[var(--ov-accent)] text-white'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={copy.modePagedTip}
            >
              {copy.modePaged}
            </button>
          </div>

          {/* 纸张主题快捷切换 */}
          <div className="flex items-center bg-[var(--ov-bg-elevated)] rounded-md p-0.5 border border-[var(--ov-border)]">
            <button
              type="button"
              onClick={() => setPaperTheme('paper')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                paperTheme === 'paper'
                  ? 'bg-[var(--ov-accent)] text-white'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={copy.themePaperTip}
            >
              {copy.themePaper}
            </button>
            <button
              type="button"
              onClick={() => setPaperTheme('sepia')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                paperTheme === 'sepia'
                  ? 'bg-[var(--ov-warning)] text-white'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={copy.themeSepiaTip}
            >
              {copy.themeSepia}
            </button>
            <button
              type="button"
              onClick={() => setPaperTheme('dark')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                paperTheme === 'dark'
                  ? 'bg-[var(--ov-accent)] text-white'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]'
              }`}
              title={copy.themeDarkTip}
            >
              {copy.themeDark}
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] transition-colors hidden sm:inline-flex"
            title={copy.printTip}
            aria-label={copy.printTip}
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleCopyAsMarkdown}
            className={`p-1.5 rounded-md transition-colors hidden sm:inline-flex ${
              mdCopied
                ? 'bg-[var(--ov-success)]/15 text-[var(--ov-success)]'
                : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)]'
            }`}
            title={mdCopied ? copy.copiedMdTip : copy.copyMdTip}
            aria-label={copy.copyMdTip}
          >
            {mdCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={loadDocument}
            className="p-1.5 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] transition-colors hidden md:inline-flex"
            title={copy.reloadTip}
            aria-label={copy.reloadTip}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowInfo(prev => !prev)}
            className={`p-1.5 rounded-md transition-colors ${
              showInfo
                ? 'bg-[var(--ov-accent-subtle)] text-[var(--ov-accent)]'
                : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)]'
            }`}
            title={copy.infoTip}
            aria-label={copy.infoTip}
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] transition-colors hidden sm:inline-flex"
            title={isFullscreen ? copy.exitFullscreenTip : copy.fullscreenTip}
            aria-label={isFullscreen ? copy.exitFullscreenTip : copy.fullscreenTip}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 自愈降级告警横幅 */}
      {showFallbackAlert && (
        <div
          role="alert"
          className="px-4 py-2 bg-[var(--ov-warning)]/12 border-b border-[var(--ov-warning)]/35 text-xs text-[var(--ov-text)] flex items-center justify-between gap-3 shrink-0 z-20"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[var(--ov-warning)] shrink-0" />
            <span className="truncate">{copy.fallbackAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setFallbackDismissed(true)}
            className="p-1 rounded hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] shrink-0"
            title={copy.dismissAlert}
            aria-label={copy.dismissAlert}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 主体工作区（导航侧边栏 + 画布 + 元数据抽屉） */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧导航窗口 */}
        <DocxTocSidebar
          showNavigation={showNavigation}
          tocItems={tocItems}
          activeHeadingId={activeHeadingId}
          searchQuery={searchQuery}
          totalMatchesCount={matchCount}
          activeMatchIndex={activeMatchIndex}
          searchGroups={searchGroups}
          locale={locale}
          onClose={() => setShowNavigation(false)}
          onSelectHeading={handleSelectHeading}
          onSelectMatch={handleSelectMatch}
        />

        {/* 主画布滚动区域 */}
        <div
          ref={scrollAreaRef}
          onScroll={handleMainScroll}
          onWheel={handleViewportWheel}
          className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start relative bg-[var(--ov-bg)]"
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 m-auto py-16 bg-[var(--ov-bg)]/85 z-20">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--ov-accent)] border-t-transparent animate-spin" />
              <p className="text-xs text-[var(--ov-text-secondary)]">{copy.loadingText}</p>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 m-auto py-16 text-[var(--ov-danger)] z-20">
              <p className="text-sm font-semibold">{copy.errorTitle}</p>
              <p className="text-xs opacity-85">{error}</p>
              <button
                type="button"
                onClick={loadDocument}
                className="px-3 py-1.5 rounded-md bg-[var(--ov-danger)]/10 border border-[var(--ov-danger)]/35 text-xs font-medium hover:bg-[var(--ov-danger)]/20 transition-colors"
              >
                {copy.retry}
              </button>
            </div>
          ) : (
            /* 外层缩放占位盒子：真实同步 scale 后的布局尺寸，消除左右裁切与底部大块空白 */
            <div
              className="docx-scale-frame relative shrink-0"
              style={{
                width: naturalSize.width > 0 ? `${Math.round(naturalSize.width * effectiveZoom)}px` : '100%',
                height: naturalSize.height > 0 ? `${Math.round(naturalSize.height * effectiveZoom)}px` : undefined,
                maxWidth: naturalSize.width > 0 ? undefined : '860px',
              }}
            >
              <div
                style={{
                  width: naturalSize.width > 0 ? `${naturalSize.width}px` : '100%',
                  transform: `scale(${effectiveZoom})`,
                  transformOrigin: naturalSize.width > 0 ? 'top left' : 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="docx-preview-container rounded-sm"
              >
                <style>{`
                  .docx-viewport-root {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    min-height: 400px;
                    user-select: text;
                    -webkit-user-select: text;
                  }
                  .docx-viewport-root img {
                    cursor: zoom-in;
                    max-width: 100%;
                  }
                  .docx-viewport-root section,
                  .docx-viewport-root .docx-rendered-wrapper,
                  .docx-viewport-root section.docx-rendered-wrapper,
                  .docx-viewport-root .docx_page {
                    background: #ffffff;
                    color: #1e293b;
                    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.1);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    border-radius: 3px;
                    box-sizing: border-box;
                    margin-bottom: 24px;
                  }
                  .docx-viewport-root table {
                    border-collapse: collapse;
                  }
                  /* 护眼羊皮纸纸张主题：柔和暖黄底色与温润墨色，保持插图自然过渡 */
                  .docx-viewport-root[data-paper-theme="sepia"] section,
                  .docx-viewport-root[data-paper-theme="sepia"] .docx-rendered-wrapper,
                  .docx-viewport-root[data-paper-theme="sepia"] section.docx-rendered-wrapper,
                  .docx-viewport-root[data-paper-theme="sepia"] .docx_page,
                  .docx-viewport-root[data-paper-theme="sepia"] .docx-paged-sheet {
                    background: #f5eedc !important;
                    color: #2c241b !important;
                    border-color: #dfd3b8 !important;
                  }
                  .docx-viewport-root[data-paper-theme="sepia"] img {
                    filter: brightness(0.96) contrast(0.98);
                  }
                  /* 暗夜阅读纸张主题：语义化深色纸张与亮色文本，严禁暴力反转图片/矢量图原彩 */
                  .docx-viewport-root[data-paper-theme="dark"] section,
                  .docx-viewport-root[data-paper-theme="dark"] .docx-rendered-wrapper,
                  .docx-viewport-root[data-paper-theme="dark"] section.docx-rendered-wrapper,
                  .docx-viewport-root[data-paper-theme="dark"] .docx_page,
                  .docx-viewport-root[data-paper-theme="dark"] .docx-paged-sheet {
                    background: #171b22 !important;
                    color: #e2e8f0 !important;
                    border-color: #2d3544 !important;
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48) !important;
                  }
                  .docx-viewport-root[data-paper-theme="dark"] p,
                  .docx-viewport-root[data-paper-theme="dark"] li,
                  .docx-viewport-root[data-paper-theme="dark"] td,
                  .docx-viewport-root[data-paper-theme="dark"] th,
                  .docx-viewport-root[data-paper-theme="dark"] h1,
                  .docx-viewport-root[data-paper-theme="dark"] h2,
                  .docx-viewport-root[data-paper-theme="dark"] h3,
                  .docx-viewport-root[data-paper-theme="dark"] h4 {
                    color: #e2e8f0;
                  }
                  /* 将纯黑或极深色内联文字提亮，保留蓝色/绿色/琥珀色等强调色原色 */
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color: rgb(0, 0, 0)"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color: #000"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color:#000"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color: black"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color: #1e293b"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color: #334155"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="color: #1a1a1a"] {
                    color: #e2e8f0 !important;
                  }
                  .docx-viewport-root[data-paper-theme="dark"] td,
                  .docx-viewport-root[data-paper-theme="dark"] th {
                    border-color: #334155 !important;
                  }
                  .docx-viewport-root[data-paper-theme="dark"] [style*="background-color: rgb(255, 255, 255)"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="background-color: #f1f5f9"],
                  .docx-viewport-root[data-paper-theme="dark"] [style*="background: #ffffff"] {
                    background-color: #1f2633 !important;
                  }
                  .docx-viewport-root[data-paper-theme="dark"] img,
                  .docx-viewport-root[data-paper-theme="dark"] svg,
                  .docx-viewport-root[data-paper-theme="dark"] canvas,
                  .docx-viewport-root[data-paper-theme="dark"] video {
                    filter: none !important;
                  }
                  .docx-viewport-root[data-paper-theme="dark"] .docx-page-number-badge {
                    background: rgba(23, 27, 34, 0.92);
                    color: #94a3b8;
                    border-color: #334155;
                  }
                  @keyframes docxHeadingFlash {
                    0% { background-color: rgba(59, 130, 246, 0.25); outline: 2px solid rgba(59, 130, 246, 0.6); }
                    50% { background-color: rgba(59, 130, 246, 0.35); outline: 2px solid rgba(59, 130, 246, 0.8); }
                    100% { background-color: transparent; outline: none; }
                  }
                  .docx-heading-highlight-flash {
                    animation: docxHeadingFlash 1.5s cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 4px;
                  }
                  .docx-viewport-root.mode-paged {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 28px;
                    width: 100%;
                    margin: 0 auto;
                  }
                  .docx-viewport-root.mode-paged section,
                  .docx-viewport-root.mode-paged .docx_page,
                  .docx-viewport-root.mode-paged .docx-paged-sheet {
                    position: relative !important;
                    box-sizing: border-box !important;
                    margin: 0 auto 28px auto !important;
                    overflow: visible !important;
                  }
                  .docx-page-number-badge {
                    position: absolute;
                    bottom: 8px;
                    right: 16px;
                    font-size: 11px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-variant-numeric: tabular-nums;
                    color: #64748b;
                    pointer-events: none;
                    background: rgba(255, 255, 255, 0.92);
                    padding: 2px 8px;
                    border-radius: 4px;
                    border: 1px solid rgba(100, 116, 139, 0.24);
                    user-select: none;
                    z-index: 10;
                  }
                  .docx-viewport-root.mode-fluid {
                    width: 100%;
                    max-width: 860px;
                    margin: 0 auto;
                  }
                  .docx-viewport-root.mode-fluid section,
                  .docx-viewport-root.mode-fluid .docx-rendered-wrapper,
                  .docx-viewport-root.mode-fluid section.docx-rendered-wrapper {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: auto !important;
                    padding: 36px 48px !important;
                    border-radius: 6px !important;
                    margin-bottom: 24px !important;
                  }
                  .docx-viewport-root.mode-fluid .docx_page {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: auto !important;
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                    margin-bottom: 0 !important;
                    background: transparent !important;
                  }
                  .docx-viewport-root.mode-fluid .docx_page_break {
                    position: relative;
                    border-top: 1px dashed rgba(100, 116, 139, 0.35);
                    margin: 28px 0;
                    height: 1px;
                  }
                  .docx-viewport-root.mode-fluid .docx_page_break::after {
                    content: 'Page Break';
                    position: absolute;
                    right: 0;
                    top: -8px;
                    font-size: 10px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    color: #94a3b8;
                    background: inherit;
                    padding: 0 6px;
                    border-radius: 3px;
                  }
                  @media print {
                    header, aside, .docx-toc-sidebar, .docx-fullscreen-hud {
                      display: none !important;
                    }
                    .docx-scale-frame {
                      width: 100% !important;
                      height: auto !important;
                    }
                    .docx-preview-container {
                      box-shadow: none !important;
                      transform: none !important;
                      max-width: 100% !important;
                      width: 100% !important;
                    }
                    .docx-viewport-root {
                      gap: 0 !important;
                    }
                    .docx-viewport-root section,
                    .docx-viewport-root .docx-rendered-wrapper,
                    .docx-viewport-root section.docx-rendered-wrapper,
                    .docx-viewport-root .docx_page {
                      background: #ffffff !important;
                      color: #1a1a1a !important;
                      box-shadow: none !important;
                      border: none !important;
                      margin-bottom: 0 !important;
                      page-break-after: always !important;
                      break-after: page !important;
                    }
                  }
                `}</style>
                {/* docx-preview DOM 真实挂载节点 */}
                <div
                  ref={docxMountRef}
                  data-paper-theme={paperTheme}
                  onClick={handleDocumentClick}
                  className={`docx-viewport-root mode-${viewMode}`}
                />
              </div>
            </div>
          )}

          {/* 右侧：文档出版元数据详情抽屉 */}
          {showInfo && (
            <aside className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--ov-surface)] border-l border-[var(--ov-border)] p-4 flex flex-col z-40 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--ov-border)] mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ov-text)]">
                  {copy.metaTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInfo(false)}
                  className="p-1 rounded hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[var(--ov-text)]">
                <div>
                  <span className="text-[10px] font-mono text-[var(--ov-text-secondary)] block uppercase">
                    {copy.metaDocTitle}
                  </span>
                  <p className="font-semibold text-sm mt-0.5">{docData?.metadata?.title || fileName}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-[var(--ov-text-secondary)] block uppercase">
                    {copy.metaCreator}
                  </span>
                  <p className="mt-0.5">{docData?.metadata?.creator || copy.metaUnrecorded}</p>
                </div>

                {docData?.metadata?.company && (
                  <div>
                    <span className="text-[10px] font-mono text-[var(--ov-text-secondary)] block uppercase">
                      {copy.metaCompany}
                    </span>
                    <p className="mt-0.5">{docData.metadata.company}</p>
                  </div>
                )}

                {docData?.metadata?.description && (
                  <div>
                    <span className="text-[10px] font-mono text-[var(--ov-text-secondary)] block uppercase">
                      {copy.metaDesc}
                    </span>
                    <p className="text-[var(--ov-text-secondary)] text-[11px] leading-relaxed mt-1">
                      {docData.metadata.description}
                    </p>
                  </div>
                )}

                {docData?.metadata?.created && (
                  <div>
                    <span className="text-[10px] font-mono text-[var(--ov-text-secondary)] block uppercase">
                      {copy.metaCreated}
                    </span>
                    <p className="font-mono mt-0.5 tabular-nums">{docData.metadata.created}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-[var(--ov-border)] space-y-1 font-mono text-[11px] text-[var(--ov-text-secondary)] tabular-nums">
                  <div>{copy.metaPages(docData?.metadata?.pageCount || totalPages)}</div>
                  <div>{copy.metaWords(docData?.metadata?.wordCount ?? (locale === 'zh-CN' ? '已载入' : 'Loaded'))}</div>
                  <div>{copy.metaSize(fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : 'DOCX')}</div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* 全屏沉浸式悬浮 HUD */}
      {isFullscreen && (
        <div
          className={`docx-fullscreen-hud fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ov-surface)]/95 border border-[var(--ov-border)] shadow-2xl backdrop-blur-md transition-opacity duration-200 ${
            hudVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setZoom(prev => Math.max(0.5, prev - 0.1));
            }}
            className="p-1.5 rounded hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text)]"
            title={copy.zoomOutTip}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono tabular-nums min-w-[42px] text-center">
            {Math.round(effectiveZoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setZoom(prev => Math.min(2.0, prev + 0.1));
            }}
            className="p-1.5 rounded hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text)]"
            title={copy.zoomInTip}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {viewMode === 'paged' && totalPages > 1 && (
            <>
              <div className="h-4 w-px bg-[var(--ov-border)]" />
              <button
                type="button"
                onClick={() => handleJumpToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-[var(--ov-bg-elevated)] disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono tabular-nums">
                {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => handleJumpToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-[var(--ov-bg-elevated)] disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <div className="h-4 w-px bg-[var(--ov-border)]" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2 py-1 rounded text-xs font-medium bg-[var(--ov-bg-elevated)] hover:bg-[var(--ov-accent-subtle)] text-[var(--ov-text)] flex items-center gap-1"
            title={copy.exitFullscreenTip}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>{copy.exitFullscreenTip.split(' ')[0]}</span>
          </button>
        </div>
      )}

      {/* 插图全屏 Lightbox 阅览弹窗 */}
      <LightboxModal
        item={lightboxIndex >= 0 && lightboxItems[lightboxIndex] ? lightboxItems[lightboxIndex] : null}
        items={lightboxItems}
        currentIndex={lightboxIndex >= 0 ? lightboxIndex : 0}
        onNavigate={(idx) => setLightboxIndex(idx)}
        onClose={() => setLightboxIndex(-1)}
        locale={locale}
      />
    </div>
  );
};
