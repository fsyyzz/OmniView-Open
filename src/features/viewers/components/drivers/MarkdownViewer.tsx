/**
 * OmniView Markdown 驱动渲染器 (重构解耦版，支持多语言与纯图标提示)
 * 基于 useMarkdownAstPipeline / useMarkdownScrollSync / useDiagramBlockStates 三大 Hook 组合编排
 */
import React, { useEffect, useRef } from 'react';
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
import { Locale, t } from '../../../../shared/lib/i18n';
import { OkfHeaderCard } from './markdown/OkfHeaderCard';
import { ContentWidthMode } from '../../../../shared/types';
import { useMarkdownAstPipeline, type RenderedBlock } from '../../hooks/useMarkdownAstPipeline';
import { useMarkdownScrollSync } from '../../hooks/useMarkdownScrollSync';
import { useDiagramBlockStates } from '../../hooks/useDiagramBlockStates';
import { getMermaidConfig } from '../../../../shared/lib/mermaidConfig';
import { loadStoredSettings } from '../../../../shared/lib/settingsStorage';

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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
              eager={eagerMount}
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
    </div>
  );
};

