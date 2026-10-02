import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Info,
  RotateCcw,
  Download,
  Printer,
  X,
  Layers,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  Copy,
  Check,
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
import { highlightSearchMatches, clearSearchHighlights, activateMatch } from '../../lib/domSearchHighlighter';
import { aggregateSearchMatchesByToc, type DocxSectionSearchMatch } from '../../lib/docxSearchAggregator';
import { requestPrintHtml } from '../../../../shared/lib/printBridge';
import { getVsCodeApi } from '../../../../shared/lib/vscode';
import type { ThemeId } from '../../../../shared/types';
import { type Locale, t } from '../../../../shared/lib/i18n';

export interface DocxViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'document.docx',
  fileSize,
  theme,
  isDarkTheme = false,
  locale = 'zh-CN',
}) => {
  const [docData, setDocData] = useState<ParsedDocxDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showNavigation, setShowNavigation] = useState<boolean>(true);
  const [tocItems, setTocItems] = useState<DocxTocItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'fluid' | 'paged'>('fluid'); // 默认采用现代化无缝流式排版阅读，杜绝断头截肢与吞字
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageInputVal, setPageInputVal] = useState<string>('1');
  const [paperTheme, setPaperTheme] = useState<'paper' | 'dark' | 'sepia'>('paper');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchCount, setMatchCount] = useState<number>(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [searchGroups, setSearchGroups] = useState<Map<string, DocxSectionSearchMatch[]>>(new Map());
  const [mdCopied, setMdCopied] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const docxMountRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // 纯净隔离 A4 打印管道（消除外层 overflow 截断、暗夜滤镜及工具栏污染）
  const handlePrint = useCallback(() => {
    if (!docxMountRef.current) return;

    // 1. 克隆真实 DOM 并清洗临时高亮状态
    const clone = docxMountRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.docx-search-highlight, .docx-search-active').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    clone.classList.remove('docx-heading-highlight-flash');

    // 2. 收集当前宿主内的全部样式（包括 docx-preview 动态注入的全局样式表）
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    // 3. 构建独立全封闭的纯净 A4 打印模板
    const printTitle = docData?.metadata?.title || fileName || 'Word 文档打印';
    const printHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${printTitle.replace(/[<>&"]/g, '')}</title>
  ${styles}
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

    // 4. 调用统一打印桥接：VS Code 内走 Extension Host 外部浏览器拉起，普通浏览器走隔离窗口打印
    requestPrintHtml(fileName || 'word-document', printHtml, {
      vscode: getVsCodeApi(),
      preferNativeInBrowser: false,
    });
  }, [docData, fileName]);

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
        setShowNavigation(true); // 自动展开大纲热力导航窗口
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
        // 拦截 Ctrl+R / Cmd+R 默认刷新行为，聚焦检索输入框并自动展开大纲热力导航面板
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint, viewMode, currentPage, handleJumpToPage]);

  // 解析并载入 DOCX 数据
  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setDocData(parsed);
      if (parsed.metadata?.pageCount && parsed.metadata.pageCount > 0) {
        setTotalPages(parsed.metadata.pageCount);
      }
    } catch (err: unknown) {
      console.error('[DocxViewer] 解析失败:', err);
      setError(err instanceof Error ? err.message : 'DOCX 文档解析异常');
      setLoading(false);
    }
  }, [content, binaryUrl]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // 当 docData 解析完毕后，渲染至 DOM 挂载容器并提取大纲标题
  useEffect(() => {
    if (!docData?.rawBytes || !docxMountRef.current) return;
    let isCancelled = false;
    const render = async () => {
      try {
        if (!docxMountRef.current) return;
        await renderDocxToContainer(docData.rawBytes, docxMountRef.current, {
          inWrapper: true,
          ignoreWidth: viewMode === 'fluid',
          breakPages: viewMode === 'paged',
          ignoreLastRenderedPageBreak: false,
        });

        if (!isCancelled) {
          setLoading(false);

          // 若处于分页模式，启动自然分页排版引擎，将长节切分为真实纸张页面
          if (viewMode === 'paged' && docxMountRef.current) {
            const pageRes = paginateDocxContainer(docxMountRef.current, {
              expectedPageCount: docData.metadata?.pageCount,
            });
            setTotalPages(pageRes.totalPages);
            setCurrentPage(1);
            setPageInputVal('1');
          } else {
            setTotalPages(1);
            setCurrentPage(1);
            setPageInputVal('1');
          }

          // 提取层级大纲
          setTimeout(() => {
            if (docxMountRef.current) {
              const headings = extractHeadingsFromDom(docxMountRef.current);
              setTocItems(headings);
              if (headings.length > 0) {
                setActiveHeadingId(headings[0].id);
              }
            }
          }, 100);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[DocxViewer] 挂载渲染异常:', err);
          setError(err instanceof Error ? err.message : 'DOCX 视图渲染异常');
          setLoading(false);
        }
      }
    };
    void render();
    return () => {
      isCancelled = true;
    };
  }, [docData, viewMode]);

  // 导航选中标题定位
  const handleSelectHeading = useCallback((item: DocxTocItem) => {
    setActiveHeadingId(item.id);
    const scrollContainer = scrollAreaRef.current;
    let targetEl = item.element || (docxMountRef.current ? document.getElementById(item.id) : null);

    // 正文节点二次校验：若抓到的 DOM 元素位于文档开头的目录页中，重新搜寻正文里的实际 Heading
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
        targetEl.classList.remove('docx-heading-highlight-flash');
      }, 1600);
    }
  }, []);

  // 滚动时检测视口最上方的标题项以及当前可见的页码
  const handleMainScroll = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const scrollContainerTop = scrollAreaRef.current.getBoundingClientRect().top;

    // 1. 标题大纲跟踪
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

    // 2. 当前物理页码跟踪 (viewMode === 'paged')
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

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // 纸张滤镜样式
  const paperFilterStyle = useMemo(() => {
    if (paperTheme === 'dark') {
      return {
        filter: 'invert(0.9) hue-rotate(180deg) brightness(0.95) contrast(0.9)',
        transition: 'filter 0.3s ease',
      };
    }
    if (paperTheme === 'sepia') {
      return {
        filter: 'sepia(0.25) brightness(0.97) contrast(0.98)',
        transition: 'filter 0.3s ease',
      };
    }
    return {
      transition: 'filter 0.3s ease',
    };
  }, [paperTheme]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden relative select-none font-sans bg-[var(--ov-bg)] text-[var(--ov-text)]"
    >
      {/* 顶部主工具栏 */}
      <header className="h-12 border-b border-[var(--ov-border)] bg-[var(--ov-surface-header)] px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
        {/* 左侧：导航窗口开关、文件名与标识 */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setShowNavigation(prev => !prev)}
            className={`p-1.5 rounded-md transition flex items-center gap-1.5 text-xs font-medium ${
              showNavigation
                ? 'bg-blue-600/20 text-blue-500 border border-blue-500/40 shadow-2xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100'
            }`}
            title="导航窗口 / 目录大纲 (Ctrl+Shift+O)"
          >
            <PanelLeft className="w-4 h-4" />
            <span className="hidden md:inline">导航</span>
          </button>

          <div className="h-4 w-px bg-[var(--ov-border)] hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-500 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-xs" title={docData?.metadata?.title || fileName}>
              {docData?.metadata?.title || fileName}
            </span>
          </div>
        </div>

        {/* 中间：缩放控制 */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
            title="缩小 (Zoom Out)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-1.5 min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(2.0, prev + 0.1))}
            disabled={zoom >= 2.0}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
            title="放大 (Zoom In)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition"
            title="重置缩放 (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* 真实物理页数导航器 (在分页模式且多页时呈现) */}
          {viewMode === 'paged' && totalPages > 1 && (
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md border border-[var(--ov-border)] text-xs font-mono ml-1 sm:ml-2">
              <button
                onClick={() => handleJumpToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
                title="上一页 (PageUp)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <span className="opacity-60 text-[11px]">第</span>
              <input
                type="text"
                value={pageInputVal}
                onChange={e => setPageInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const num = parseInt(pageInputVal, 10);
                    if (!isNaN(num)) {
                      handleJumpToPage(num);
                    }
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
                className="w-7 text-center bg-transparent border-b border-blue-500/50 focus:border-blue-500 focus:outline-none text-xs font-bold"
                title="输入页码回车直达"
              />
              <span className="opacity-60 text-[11px]">/ {totalPages} 页</span>
              <button
                onClick={() => handleJumpToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
                title="下一页 (PageDown)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 中间：全文搜索框 */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs justify-center hidden sm:flex">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
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
              placeholder="搜索正文... (Ctrl+F)"
              className="w-full pl-8 pr-16 py-1 text-xs rounded-md bg-black/5 dark:bg-white/5 border border-[var(--ov-border)] focus:outline-none focus:border-blue-500 placeholder:opacity-50"
            />
            {matchCount > 0 && (
              <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] font-mono opacity-70">
                {activeMatchIndex + 1}/{matchCount}
              </span>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                title="清除搜索 (Esc)"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {matchCount > 0 && (
            <div className="flex items-center">
              <button
                onClick={() => handleNavigateMatch(true)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                title="上一个匹配项 (Shift+Enter)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleNavigateMatch(false)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                title="下一个匹配项 (Enter)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 右侧：视图模式切换、纸张主题、打印与元数据 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 视图模式切换：现代流式排版 (默认推荐) vs 物理分页 */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border border-[var(--ov-border)]">
            <button
              onClick={() => setViewMode('fluid')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                viewMode === 'fluid' ? 'bg-blue-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'
              }`}
              title="现代化无缝流式阅读：无截断、无大段空白，长文表格丝滑展开（默认推荐）"
            >
              流式
            </button>
            <button
              onClick={() => setViewMode('paged')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                viewMode === 'paged' ? 'bg-blue-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'
              }`}
              title="A4 物理分页排版：模拟实体纸张排版"
            >
              分页
            </button>
          </div>

          {/* 纸张主题快捷切换 */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border border-[var(--ov-border)]">
            <button
              onClick={() => setPaperTheme('paper')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                paperTheme === 'paper' ? 'bg-blue-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'
              }`}
              title="原始原纸排版 (Classic Paper)"
            >
              原纸
            </button>
            <button
              onClick={() => setPaperTheme('sepia')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                paperTheme === 'sepia' ? 'bg-amber-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'
              }`}
              title="护眼羊皮纸 (Eye-care Sepia)"
            >
              羊皮
            </button>
            <button
              onClick={() => setPaperTheme('dark')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                paperTheme === 'dark' ? 'bg-blue-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'
              }`}
              title="夜间暗色反转 (Dark Matrix)"
            >
              暗夜
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition hidden sm:block"
            title="系统打印 / 导出为 PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopyAsMarkdown}
            className={`p-1.5 rounded-md opacity-80 hover:opacity-100 transition hidden sm:block ${
              mdCopied ? 'bg-emerald-600/20 text-emerald-500' : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title="复制全文为 Markdown"
          >
            {mdCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition"
            title="文档元数据详情"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition hidden sm:block"
            title={isFullscreen ? '退出全屏' : '全屏阅读'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 主体工作区（导航侧边栏 + 画布 + 元数据抽屉） */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧导航窗口 (融合多级大纲与全文检索热力聚类) */}
        <DocxTocSidebar
          showNavigation={showNavigation}
          tocItems={tocItems}
          activeHeadingId={activeHeadingId}
          searchQuery={searchQuery}
          totalMatchesCount={matchCount}
          activeMatchIndex={activeMatchIndex}
          searchGroups={searchGroups}
          onClose={() => setShowNavigation(false)}
          onSelectHeading={handleSelectHeading}
          onSelectMatch={handleSelectMatch}
        />

        {/* 主画布滚动区域 */}
        <div
          ref={scrollAreaRef}
          onScroll={handleMainScroll}
          className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center relative bg-[var(--ov-bg)]"
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 m-auto py-16 bg-[var(--ov-bg)]/80 backdrop-blur-xs z-20">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-xs opacity-70">正在解析 Word 文档结构...</p>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 m-auto py-16 text-red-500 z-20">
              <p className="text-sm font-semibold">加载失败</p>
              <p className="text-xs opacity-80">{error}</p>
              <button
                onClick={loadDocument}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs hover:bg-red-500/20"
              >
                重新加载
              </button>
            </div>
          ) : (
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                ...paperFilterStyle,
              }}
              className="docx-preview-container max-w-full shadow-2xl rounded-sm"
            >
              {/* 注入 docx-preview 专用拟真 A4 纸张排版与对比度样式，及标题高亮闪烁效果 */}
              <style>{`
                .docx-viewport-root {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 20px;
                  min-height: 400px;
                }
                .docx-viewport-root section,
                .docx-viewport-root .docx-rendered-wrapper,
                .docx-viewport-root section.docx-rendered-wrapper,
                .docx-viewport-root .docx_page {
                  background: #ffffff !important;
                  color: #1a1a1a !important;
                  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12) !important;
                  border: 1px solid rgba(0, 0, 0, 0.08);
                  border-radius: 2px;
                  box-sizing: border-box;
                  margin-bottom: 24px;
                }
                .docx-viewport-root p,
                .docx-viewport-root span,
                .docx-viewport-root article,
                .docx-viewport-root table,
                .docx-viewport-root td,
                .docx-viewport-root th {
                  color: #1a1a1a;
                }
                .docx-viewport-root table {
                  border-collapse: collapse;
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
                /* 标准物理拟真 A4 分页排版模式 (mode-paged，默认推荐) */
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
                  background: #ffffff !important;
                  color: #1a1a1a !important;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                  border: 1px solid rgba(0, 0, 0, 0.08) !important;
                  border-radius: 3px !important;
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
                  color: #64748b;
                  pointer-events: none;
                  background: rgba(255, 255, 255, 0.92);
                  padding: 2px 8px;
                  border-radius: 10px;
                  border: 1px solid rgba(100, 116, 139, 0.2);
                  user-select: none;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                  z-index: 10;
                }
                /* 现代高效流式排版模式 (mode-fluid，默认推荐) */
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
                  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08) !important;
                  border: 1px solid rgba(0, 0, 0, 0.06) !important;
                  border-radius: 6px !important;
                  margin-bottom: 24px !important;
                  background: #ffffff !important;
                  color: #1a1a1a !important;
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
                  content: '分页符 (Page Break)';
                  position: absolute;
                  right: 0;
                  top: -8px;
                  font-size: 10px;
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                  color: #94a3b8;
                  background: #ffffff;
                  padding: 0 6px;
                  border-radius: 3px;
                }
                @media print {
                  header, aside, .docx-toc-sidebar {
                    display: none !important;
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
                    box-shadow: none !important;
                    border: none !important;
                    margin-bottom: 0 !important;
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                }
              `}</style>
              {/* docx-preview DOM 真实挂载节点 */}
              <div ref={docxMountRef} className={`docx-viewport-root mode-${viewMode}`} />
            </div>
          )}

          {/* 右侧：文档出版元数据详情抽屉 */}
          {showInfo && (
            <aside className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--ov-surface)] border-l border-[var(--ov-border)] p-4 flex flex-col z-40 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--ov-border)] mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider">Word 文档元数据</h3>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono opacity-50 block uppercase">文档标题 / Title</span>
                  <p className="font-semibold text-sm">{docData?.metadata?.title || fileName}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono opacity-50 block uppercase">作者 / Creator</span>
                  <p>{docData?.metadata?.creator || '未记录'}</p>
                </div>

                {docData?.metadata?.description && (
                  <div>
                    <span className="text-[10px] font-mono opacity-50 block uppercase">简介 / Description</span>
                    <p className="opacity-80 text-[11px] leading-relaxed mt-1">
                      {docData.metadata.description}
                    </p>
                  </div>
                )}

                {docData?.metadata?.created && (
                  <div>
                    <span className="text-[10px] font-mono opacity-50 block uppercase">创建时间 / Created</span>
                    <p className="font-mono">{docData.metadata.created}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-[var(--ov-border)] space-y-1 font-mono text-[10px] opacity-50">
                  <div>文档总页数: {docData?.metadata?.pageCount || totalPages} 页</div>
                  <div>字数统计: {docData?.metadata?.wordCount || '已载入'}</div>
                  <div>文件大小: {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : '标准 DOCX'}</div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
