/**
 * OmniView Markdown 驱动渲染器 (重构解耦版，支持多语言与纯图标提示)
 * 基于 useMarkdownAstPipeline / useMarkdownScrollSync / useDiagramBlockStates 三大 Hook 组合编排
 */
import React, { useEffect, useRef, useMemo } from 'react';
import mermaid from 'mermaid';
import katex from 'katex';
import { RefreshCw } from 'lucide-react';
import { CodeBlock } from './markdown/CodeBlock';
import { MermaidBlock } from './markdown/MermaidBlock';
import { PlantUmlBlock } from './markdown/PlantUmlBlock';
import { SvgBlock } from './markdown/SvgBlock';
import { GraphvizBlock } from './markdown/GraphvizBlock';
import { MathBlock } from './markdown/MathBlock';
import { TableBlock } from './markdown/TableBlock';
import { StableHtmlBlock } from './markdown/StableHtmlBlock';
import { LazyViewportBlock } from './markdown/LazyViewportBlock';
import { DomainStoryBlock } from './markdown/DomainStoryBlock';
import { MarkmapBlock } from './markdown/MarkmapBlock';
import { ExcalidrawBlock } from './markdown/ExcalidrawBlock';
import { LightboxModal } from '../common/LightboxModal';
import { RenderErrorBoundary } from '../common/RenderErrorBoundary';
import { WikiLinkPreviewPopover } from './markdown/WikiLinkPreviewPopover';
import { MarkdownBubbleToolbar } from './markdown/MarkdownBubbleToolbar';
import { applyMarkdownSelectionFormat, MarkdownFormatAction } from '../../lib/markdownSelectionReplacer';
import { Locale, t } from '../../../../shared/lib/i18n';
import { OkfHeaderCard } from './markdown/OkfHeaderCard';
import { ContentWidthMode } from '../../../../shared/types';
import { useMarkdownAstPipeline, type RenderedBlock } from '../../hooks/useMarkdownAstPipeline';
import { useMarkdownScrollSync } from '../../hooks/useMarkdownScrollSync';
import { useDiagramBlockStates } from '../../hooks/useDiagramBlockStates';
import { getMermaidConfig } from '../../../../shared/lib/mermaidConfig';
import { loadStoredSettings } from '../../../../shared/lib/settingsStorage';
import { cleanAndFormatDomForWordSync, cleanAndFormatDomForWord, isFullContainerSelection } from '../../lib/wordClipboardHelper';
import { mermaidRenderCache, graphvizRenderCache } from '../../lib/diagramCache';
import { graphvizRenderer } from '../../lib/graphvizRenderer';

export type { RenderedBlock };

export interface MarkdownViewerProps {
  content: string;
  isDarkTheme?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  contentWidth?: ContentWidthMode;
  files?: Array<{ name: string; content: string; extension: string; path?: string }>;
  locale?: Locale;
  onRenderComplete?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onSelectFile?: (file: any) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
  onContentChange?: (content: string) => void;
  /** 搜索 / 打印 / 导出时强制挂载全部重块 */
  eagerMount?: boolean;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  isDarkTheme = true,
  density = 'compact',
  contentWidth = 'standard',
  files = [],
  locale = 'zh-CN',
  onRenderComplete,
  onOpenSourceAtLine,
  onSelectFile,
  enableOkf = true,
  onToggleOkf,
  onContentChange,
  eagerMount = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  // 1. AST 解析与格式预处理流水线 Hook
  const { blocks, okfData, isRendering } = useMarkdownAstPipeline({
    content,
    files,
    locale,
    isDarkTheme,
  });

  // 2. 块状态管理（缩放、视图模式、折叠、暂存代码、灯箱）Hook
  const {
    copiedId,
    zoomScales,
    diagramViewModes,
    editedCodes,
    collapsedCodeBlocks,
    svgBgModes,
    lightboxItem,
    setLightboxItem,
    handleCopy,
    adjustZoom,
    resetZoom,
    toggleCollapse,
    setDiagramViewMode,
    setSvgBgMode,
    setEditedCode,
    handleDownloadSvg,
    handleReRenderMermaid,
  } = useDiagramBlockStates();


  // WikiLink 悬浮预览状态
  const [hoverWikiLinkInfo, setHoverWikiLinkInfo] = React.useState<{
    x: number;
    y: number;
    target: string;
    heading?: string;
    file?: any;
  } | null>(null);

  // 划选格式悬浮工具条状态
  const [bubbleToolbarInfo, setBubbleToolbarInfo] = React.useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    selectedText: string;
    sourceLine?: number;
  }>({
    isOpen: false,
    position: null,
    selectedText: '',
  });

  // 监听预览区划选文本事件 (仅在支持编辑回写时激活气泡格式工具条)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onContentChange) return;

    const handleMouseUp = () => {
      // 延时等待浏览器 selection 更新完成
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) {
          return;
        }

        const text = selection.toString().trim();
        // 忽略纯空白或过长文本（超过 500 字符通常为跨大段划选，不适宜行内格式工具条）
        if (!text || text.length > 500) {
          return;
        }

        const range = selection.getRangeAt(0);
        // 确认选区在 Markdown 预览容器内
        if (!container.contains(range.commonAncestorContainer)) {
          return;
        }

        // 避免在代码块编辑器或输入框内划选时弹窗干扰
        const anchorEl = (
          range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement
        ) as HTMLElement | null;

        if (anchorEl?.closest('textarea, input, button, pre, code, .ov-code-editor, .markdown-toolbar')) {
          return;
        }

        // 获取所在行号
        const sourceLineEl = anchorEl?.closest('[data-source-line]');
        let lineNum: number | undefined;
        if (sourceLineEl) {
          const attr = sourceLineEl.getAttribute('data-source-line');
          if (attr) {
            const parsed = parseInt(attr, 10);
            if (!isNaN(parsed) && parsed > 0) {
              lineNum = parsed;
            }
          }
        }

        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        setBubbleToolbarInfo({
          isOpen: true,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top,
          },
          selectedText: text,
          sourceLine: lineNum,
        });
      }, 30);
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setBubbleToolbarInfo(prev => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [onContentChange]);

  // 全局 eagerMount 状态管理：支持搜索、打印、全选及空闲预热
  const [forceEagerAll, setForceEagerAll] = React.useState(false);
  const effectiveEagerMount = eagerMount || forceEagerAll;

  // 构造快速索引 Map 便于剪贴板离屏块自愈
  const blocksMap = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);
  const blocksMapRef = useRef(blocksMap);
  blocksMapRef.current = blocksMap;
  const isDarkThemeRef = useRef(isDarkTheme);
  isDarkThemeRef.current = isDarkTheme;

  // 离屏图表后台空闲预热编译与挂载
  useEffect(() => {
    // 1. 在空闲时渐进式预热挂载所有离屏重块
    const idleTimer = (window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 150)))(() => {
      setForceEagerAll(true);
    });

    // 2. 在后台并发预热编译离屏 Mermaid 与 Graphviz 图表
    const mermaidBlocks = blocks.filter(b => b.type === 'mermaid');
    const graphvizBlocks = blocks.filter(b => b.type === 'graphviz');

    const compileTimer = setTimeout(async () => {
      for (const b of mermaidBlocks) {
        const cacheKey = mermaidRenderCache.makeKey('mermaid', b.raw, isDarkTheme ? 'dark' : 'light');
        if (!mermaidRenderCache.get(cacheKey) && !b.svgContent) {
          try {
            mermaid.initialize(getMermaidConfig(Boolean(isDarkTheme)));
            const uniqueId = `mermaid-prewarm-${Math.random().toString(36).substr(2, 9)}`;
            const { svg } = await mermaid.render(uniqueId, b.raw);
            mermaidRenderCache.set(cacheKey, svg);
            b.svgContent = svg;
          } catch {
            // 容错降级
          }
        }
      }

      for (const b of graphvizBlocks) {
        if (!graphvizRenderCache.get(b.raw) && !b.svgContent) {
          try {
            const svg = await graphvizRenderer.render(b.raw);
            graphvizRenderCache.set(b.raw, svg);
            b.svgContent = svg;
          } catch {
            // 容错降级
          }
        }
      }
    }, 80);

    return () => {
      clearTimeout(compileTimer);
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idleTimer as any);
      } else {
        clearTimeout(idleTimer as any);
      }
    };
  }, [blocks, isDarkTheme]);

  // 全局交互：Ctrl+A 精准全选 Markdown 正文区域与 Word/WPS 富文本清洗复制
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 4. 监听 Ctrl+A / Cmd+A：无论在 Web 独立应用还是 VS Code 插件 Webview 中，均仅精准全选中 Markdown 正文
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const activeEl = document.activeElement as HTMLElement | null;
        // 如果焦点在输入框、textarea、代码编辑框或模态弹窗内，保留原生行为
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.isContentEditable ||
            activeEl.getAttribute('contenteditable') === 'true' ||
            activeEl.closest('.ov-code-editor, textarea, input, select, [contenteditable="true"], [role="dialog"], .ov-modal-backdrop'))
        ) {
          return;
        }

        // 如果存在任何模态窗口打开，不进行拦截
        if (document.querySelector('.ov-modal-backdrop, [role="dialog"]')) {
          return;
        }

        // 阻止浏览器或 VS Code 宿主选中整个外层 Webview DOM (顶栏、状态栏、侧边栏)
        e.preventDefault();
        e.stopPropagation();

        // 立即唤醒所有离屏块挂载 (Eager Mount)
        setForceEagerAll(true);

        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(container);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    };

    // 5. 监听 copy 事件：富文本剪贴板拦截与清洗流水线 (Word / WPS / Office 深度优化)
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer) && !range.intersectsNode(container)) {
        return;
      }

      // 获取纯文本
      const rawText = selection.toString();
      if (!rawText) return;

      // 阻止浏览器默认粗暴复制，确保立即接管剪贴板事务
      if (e.clipboardData) {
        e.preventDefault();
      }

      // 克隆选中的 DOM 片段
      const fragment = range.cloneContents();
      const tempWrapper = document.createElement('div');
      tempWrapper.appendChild(fragment);

      // 同步执行专用清洗与格式转换 (包含离屏图表/表格/公式自愈与 Base64 转换)
      cleanAndFormatDomForWordSync(tempWrapper, blocksMapRef.current, {
        isDarkTheme: isDarkThemeRef.current,
        containerElement: container,
      });

      const cleanedHtml = tempWrapper.innerHTML;
      if (!cleanedHtml) return;

      // 智能纯文本提取：全选时优先提供纯净原始 Markdown 源码 (粘贴到 .md 文件 100% 保留语法标记与图片链接)
      const isFullDoc = isFullContainerSelection(range, container);
      const plainText = isFullDoc && contentRef.current ? contentRef.current : rawText;

      // 同步写入富文本 (text/html) 与纯文本 (text/plain)
      if (e.clipboardData) {
        e.clipboardData.setData('text/html', cleanedHtml);
        e.clipboardData.setData('text/plain', plainText);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', handleCopy, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleCopy, true);
    };
  }, []);

  // 处理气泡工具条格式应用
  const handleApplyBubbleFormat = (action: MarkdownFormatAction, linkUrl = '') => {
    if (!onContentChange || !bubbleToolbarInfo.selectedText) return;

    const result = applyMarkdownSelectionFormat({
      fullContent: content,
      selectedText: bubbleToolbarInfo.selectedText,
      sourceLine: bubbleToolbarInfo.sourceLine,
      action,
      linkUrl,
    });

    if (result) {
      onContentChange(result.newFullContent);
      // 清空浏览器当前选区并关闭工具栏
      window.getSelection()?.removeAllRanges();
      setBubbleToolbarInfo(prev => ({ ...prev, isOpen: false }));
    }
  };

  // 3. 双向滚动同步与点击交互 Hook
  useMarkdownScrollSync({
    containerRef,
    content,
    files,
    onOpenSourceAtLine,
    onSelectFile,
    onContentChange,
    onOpenLightbox: setLightboxItem,
    onHoverWikiLink: setHoverWikiLinkInfo,
  });

  // 初始化 Mermaid 渲染主题 (高对比度与全主题自适应)
  useEffect(() => {
    try {
      mermaid.initialize(getMermaidConfig(Boolean(isDarkTheme)));
    } catch {
      // 容错降级
    }
  }, [isDarkTheme]);

  // 双击定位配置：若关闭则不显示双击提示
  const isDoubleClickEditEnabled = loadStoredSettings().enableDoubleClickEdit ?? false;
  const getBlockTitle = (startLine?: number) =>
    startLine && isDoubleClickEditEnabled ? `${t('doubleClickToLocate', locale)} (L${startLine})` : undefined;

  // 渲染完成回调
  useEffect(() => {
    if (!isRendering && blocks.length > 0) {
      onRenderComplete?.();
    }
  }, [isRendering, blocks.length, onRenderComplete]);

  return (
    <div
      ref={containerRef}
      id="markdown-viewer-canvas"
      data-density={density}
      data-width={contentWidth}
      className={`markdown-document density-${density}`}
    >
      {isRendering && (
        <div className="flex items-center gap-2 mb-4 text-xs text-blue-400 bg-blue-950/40 border border-blue-800/40 px-3 py-1.5 rounded-md w-fit">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{t('renderingDiagram', locale)}</span>
        </div>
      )}

      {/* OKF (Open Knowledge Format) / Frontmatter 头部元数据卡片 */}
      {enableOkf && okfData?.frontmatter && (
        <RenderErrorBoundary blockName="OKF Metadata Header" locale={locale}>
          <OkfHeaderCard
            metadata={okfData.frontmatter}
            rawYaml={okfData.rawFrontmatter}
            isDarkTheme={isDarkTheme}
            onClose={onToggleOkf}
          />
        </RenderErrorBoundary>
      )}

      {!enableOkf && okfData?.hasFrontmatter && (
        <div
          id="okf-collapsed-banner"
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text-secondary)',
          }}
          className="mb-4 flex items-center justify-between px-3 py-2 rounded-lg border border-dashed text-xs"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400/80 inline-block shrink-0" />
            <span>{t('okfRenderingTitle', locale)}: {t('collapsed', locale)}</span>
          </span>
          {onToggleOkf && (
            <button
              onClick={onToggleOkf}
              className="text-[var(--ov-accent)] hover:underline font-medium cursor-pointer"
            >
              {t('enableOkf', locale)}
            </button>
          )}
        </div>
      )}

      {blocks.map(block => {
        if (block.type === 'pagebreak') {
          return (
            <div
              key={block.id}
              className="page-break-container my-6"
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={block.startLine ? `${t('pageBreakBadge', locale)} (L${block.startLine})` : undefined}
            >
              <div className="page-break-screen-indicator flex items-center gap-3 py-2 text-xs font-mono text-slate-400 select-none">
                <div className="flex-1 border-b border-dashed border-slate-300 dark:border-slate-700" />
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <span className="text-slate-400 dark:text-slate-500 text-xs">✂️</span>
                  <span>{t('pageBreakBadge', locale)}</span>
                </span>
                <div className="flex-1 border-b border-dashed border-slate-300 dark:border-slate-700" />
              </div>
              <div className="page-break-print-divider print-pagebreak" />
            </div>
          );
        }

        if (block.type === 'html' && block.renderedHtml) {
          return (
            <RenderErrorBoundary key={block.id} blockName="Document Content" locale={locale}>
              <StableHtmlBlock
                className="markdown-content"
                html={block.renderedHtml}
                data-source-line={block.startLine}
                data-source-end-line={block.endLine}
                title={getBlockTitle(block.startLine)}
              />
            </RenderErrorBoundary>
          );
        }

        if (block.type === 'code') {
          const isCollapsed = Boolean(collapsedCodeBlocks[block.id]);
          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={120}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName={`Code (${block.lang || 'text'})`} locale={locale}>
                <CodeBlock
                  id={block.id}
                  lang={block.lang}
                  code={block.raw}
                  isCollapsed={isCollapsed}
                  isCopied={copiedId === block.id}
                  onToggleCollapse={() => toggleCollapse(block.id)}
                  onCopy={() => handleCopy(block.id, block.raw)}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'table' && block.tableData) {
          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={160}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="Markdown Table" locale={locale}>
                <TableBlock
                  id={block.id}
                  header={block.tableData.header}
                  rows={block.tableData.rows}
                  align={block.tableData.align}
                  rawMarkdown={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  isDarkTheme={isDarkTheme}
                  locale={locale}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'mermaid') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={200}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="Mermaid Diagram" locale={locale}>
                <MermaidBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  svgContent={block.svgContent}
                  error={block.error}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={svg =>
                    setLightboxItem({ title: t('mermaidTitle', locale), content: svg || block.svgContent })
                  }
                  onReRender={async () => {
                    const res = await handleReRenderMermaid(block.id, currentCode);
                    if (res.success && res.svg) {
                      block.svgContent = res.svg;
                      block.error = undefined;
                    } else if (!res.success && res.error) {
                      block.error = res.error;
                    }
                  }}
                  onDownloadSvg={() => handleDownloadSvg(block.svgContent!, 'mermaid-diagram')}
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  externalFile={block.externalFile}
                  locale={locale}
                  isDarkTheme={isDarkTheme}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'math') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={100}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="KaTeX Math Formula" locale={locale}>
                <MathBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={() => {
                    let html = '';
                    try {
                      html = katex.renderToString(currentCode.trim(), { displayMode: true, throwOnError: false, errorColor: '#f43f5e' });
                    } catch {}
                    setLightboxItem({ title: t('mathFormula', locale), content: html || `<pre>${currentCode}</pre>` });
                  }}
                  onReRender={() => setEditedCode(block.id, currentCode)}
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'plantuml') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;
          const svgUrl = block.renderedHtml || '';

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={200}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="PlantUML Diagram" locale={locale}>
                <PlantUmlBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  svgUrl={svgUrl}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  isDarkTheme={isDarkTheme}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={() => setLightboxItem({ title: t('plantUmlTitle', locale), url: svgUrl })}
                  onReRender={() => {}}
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  externalFile={block.externalFile}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'svg') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;
          const bgMode = svgBgModes[block.id] || 'dark';

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={180}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName={`SVG (${block.title || 'Vector'})`} locale={locale}>
                <SvgBlock
                  id={block.id}
                  mode={block.mode || 'code-block'}
                  svgContent={block.svgContent || block.raw}
                  rawCode={currentCode}
                  title={block.title}
                  fileName={block.fileName}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  bgMode={bgMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onSetBgMode={mode => setSvgBgMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={() => setLightboxItem({ title: block.title || 'SVG', content: block.svgContent || block.raw })}
                  onReRender={() => {}}
                  onDownloadSvg={() => handleDownloadSvg(block.svgContent || block.raw, block.fileName ? block.fileName.replace(/\.svg$/i, '') : 'vector-graphic')}
                  onCopy={() => handleCopy(block.id, currentCode)}
                  externalFile={block.externalFile}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'graphviz') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={200}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="Graphviz DOT Diagram" locale={locale}>
                <GraphvizBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={liveSvg => setLightboxItem({ title: t('graphvizTitle', locale), content: liveSvg || block.svgContent || block.raw })}
                  onReRender={() => {}}
                  onDownloadSvg={liveSvg => handleDownloadSvg(liveSvg || block.svgContent || block.raw, 'graphviz-topology')}
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  externalFile={block.externalFile}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }


        if (block.type === 'domainstory') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={200}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="Domain Storytelling Diagram" locale={locale}>
                <DomainStoryBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  isDarkTheme={isDarkTheme}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={svg =>
                    setLightboxItem({ title: t('domainStoryTitle', locale), content: svg || '' })
                  }
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  externalFile={block.externalFile}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'markmap') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={320}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="Markmap Mindmap" locale={locale}>
                <MarkmapBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  zoom={zoom}
                  editedCode={currentCode}
                  isDarkTheme={isDarkTheme}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => resetZoom(block.id)}
                  onOpenLightbox={content =>
                    setLightboxItem({ title: 'Markmap Mindmap', content: content || block.raw })
                  }
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  externalFile={block.externalFile}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        if (block.type === 'excalidraw') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              id={block.id}
              eager={effectiveEagerMount}
              minHeight={360}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={getBlockTitle(block.startLine)}
            >
              <RenderErrorBoundary blockName="Excalidraw Whiteboard" locale={locale}>
                <ExcalidrawBlock
                  id={block.id}
                  code={block.raw}
                  startLine={block.startLine}
                  endLine={block.endLine}
                  isCopied={copiedId === block.id}
                  viewMode={currentMode}
                  editedCode={currentCode}
                  isDarkTheme={isDarkTheme}
                  onChangeEditedCode={val => setEditedCode(block.id, val)}
                  onSetViewMode={mode => setDiagramViewMode(block.id, mode)}
                  onOpenLightbox={content =>
                    setLightboxItem({ title: 'Excalidraw Whiteboard', content: content || block.raw })
                  }
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  externalFile={block.externalFile}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        return null;
      })}

      {/* 全屏灯箱模态框 */}
      {lightboxItem && (
        <LightboxModal item={lightboxItem} onClose={() => setLightboxItem(null)} locale={locale} />
      )}

      {/* WikiLink 悬浮预览卡片 */}
      {hoverWikiLinkInfo && (
        <WikiLinkPreviewPopover
          isOpen={Boolean(hoverWikiLinkInfo)}
          x={hoverWikiLinkInfo.x}
          y={hoverWikiLinkInfo.y}
          targetName={hoverWikiLinkInfo.target}
          heading={hoverWikiLinkInfo.heading}
          file={hoverWikiLinkInfo.file}
          locale={locale}
          onNavigate={() => {
            if (hoverWikiLinkInfo.file && onSelectFile) {
              onSelectFile(hoverWikiLinkInfo.file);
            }
          }}
          onClose={() => setHoverWikiLinkInfo(null)}
        />
      )}

      {/* 划选轻量格式化悬浮工具条 (Bubble Toolbar) */}
      <MarkdownBubbleToolbar
        isOpen={bubbleToolbarInfo.isOpen}
        position={bubbleToolbarInfo.position}
        selectedText={bubbleToolbarInfo.selectedText}
        sourceLine={bubbleToolbarInfo.sourceLine}
        locale={locale}
        onApplyFormat={handleApplyBubbleFormat}
        onOpenSourceAtLine={onOpenSourceAtLine}
        onClose={() => setBubbleToolbarInfo(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

