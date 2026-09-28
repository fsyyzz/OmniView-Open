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
} from 'lucide-react';
import {
  parseDocx,
  renderDocxToContainer,
  base64ToBytes,
  extractHeadingsFromDom,
  type ParsedDocxDocument,
  type DocxTocItem,
} from '../../lib/docxEngine';
import { DocxTocSidebar } from './docx/DocxTocSidebar';
import { highlightSearchMatches, clearSearchHighlights, activateMatch } from '../../lib/domSearchHighlighter';
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
  const [paperTheme, setPaperTheme] = useState<'paper' | 'dark' | 'sepia'>('paper');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchCount, setMatchCount] = useState<number>(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const docxMountRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 搜索关键字高亮
  useEffect(() => {
    if (!docxMountRef.current) return;
    if (!searchQuery.trim()) {
      clearSearchHighlights(docxMountRef.current);
      setMatchCount(0);
      setActiveMatchIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      if (!docxMountRef.current) return;
      const count = highlightSearchMatches(docxMountRef.current, searchQuery);
      setMatchCount(count);
      if (count > 0) {
        setActiveMatchIndex(0);
        activateMatch(docxMountRef.current, 0, false);
      } else {
        setActiveMatchIndex(-1);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // 全局 Ctrl+F 搜索与 Ctrl+Shift+O 导航窗口切换快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setShowNavigation(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          ignoreWidth: false,
          breakPages: true,
        });
        if (!isCancelled) {
          setLoading(false);
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
  }, [docData]);

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

  // 滚动时检测视口最上方的标题项
  const handleMainScroll = useCallback(() => {
    if (!scrollAreaRef.current || tocItems.length === 0) return;
    const scrollContainerTop = scrollAreaRef.current.getBoundingClientRect().top;

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
  }, [tocItems]);

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

        {/* 右侧：纸张主题、打印与元数据 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
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
            onClick={() => window.print()}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition hidden sm:block"
            title="系统打印 / 导出为 PDF"
          >
            <Printer className="w-4 h-4" />
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
        {/* 左侧导航窗口 */}
        <DocxTocSidebar
          showNavigation={showNavigation}
          tocItems={tocItems}
          activeHeadingId={activeHeadingId}
          onClose={() => setShowNavigation(false)}
          onSelectHeading={handleSelectHeading}
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
              `}</style>
              {/* docx-preview DOM 真实挂载节点 */}
              <div ref={docxMountRef} className="docx-viewport-root" />
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
                  <div>总页数估算: {docData?.metadata?.pageCount || '动态流式分页'}</div>
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
