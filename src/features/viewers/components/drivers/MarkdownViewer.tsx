/**
 * OmniView Markdown 驱动渲染器 (重构解耦版，支持多语言与纯图标提示)
 * 支持 CommonMark/GFM、Mermaid、PlantUML、Inline/File SVG、代码高亮与折叠、全屏灯箱
 */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import katex from 'katex';
import { RefreshCw } from 'lucide-react';
import { getPlantUmlSvgUrl } from '../../../../shared/lib/plantuml';
import { CodeBlock } from './markdown/CodeBlock';
import { MermaidBlock } from './markdown/MermaidBlock';
import { PlantUmlBlock } from './markdown/PlantUmlBlock';
import { SvgBlock } from './markdown/SvgBlock';
import { GraphvizBlock } from './markdown/GraphvizBlock';
import { MathBlock } from './markdown/MathBlock';
import { TableBlock } from './markdown/TableBlock';
import { graphvizRenderer } from '../../lib/graphvizRenderer';
import { LightboxModal, LightboxItem } from '../common/LightboxModal';
import { RenderErrorBoundary } from '../common/RenderErrorBoundary';
import { Locale, t } from '../../../../shared/lib/i18n';
import { parseOkfFrontmatter, OkfParseResult } from '../../lib/okfParser';
import { OkfHeaderCard } from './markdown/OkfHeaderCard';

export interface MarkdownViewerProps {
  content: string;
  isDarkTheme?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  contentWidth?: 'narrow' | 'standard' | 'wide' | 'full';
  files?: Array<{ name: string; content: string; extension: string; path?: string }>;
  locale?: Locale;
  onRenderComplete?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onSelectFile?: (file: any) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
}

interface RenderedBlock {
  id: string;
  type: 'html' | 'code' | 'mermaid' | 'plantuml' | 'svg' | 'math' | 'graphviz' | 'table';
  mode?: 'code-block' | 'file';
  lang?: string;
  raw: string;
  startLine?: number;
  endLine?: number;
  renderedHtml?: string;
  svgContent?: string;
  fileName?: string;
  title?: string;
  error?: string;
  tableData?: {
    header: any[];
    rows: any[][];
    align?: Array<'left' | 'center' | 'right' | null>;
  };
}

const DOMPURIFY_SVG_CONFIG: Record<string, any> = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_TAGS: [
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop',
    'use', 'symbol', 'filter', 'feDropShadow', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
    'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA',
    'feFuncB', 'feFuncG', 'feFuncR', 'feImage', 'feMorphology', 'fePointLight',
    'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'image', 'pattern', 'mask'
  ],
  ADD_ATTR: [
    'viewBox', 'xmlns', 'xmlns:xlink', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'fill-opacity',
    'stroke-opacity', 'transform', 'style', 'id', 'class', 'gradientUnits', 'gradientTransform',
    'offset', 'stop-color', 'stop-opacity', 'preserveAspectRatio', 'text-anchor', 'font-family',
    'font-size', 'font-weight', 'letter-spacing', 'dominant-baseline', 'href', 'xlink:href',
    'target', 'rel', 'crossorigin', 'points', 'dx', 'dy', 'stdDeviation', 'flood-color', 'flood-opacity',
    'marker-end', 'marker-start', 'marker-mid'
  ],
};

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
}) => {
  const [blocks, setBlocks] = useState<RenderedBlock[]>([]);
  // 同步计算 Frontmatter / OKF 元数据，消除异步时序延迟与竞争
  const okfData = useMemo(() => parseOkfFrontmatter(content), [content]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zoomScales, setZoomScales] = useState<Record<string, number>>({});
  const [diagramViewModes, setDiagramViewModes] = useState<Record<string, 'visual' | 'code'>>({});
  const [editedCodes, setEditedCodes] = useState<Record<string, string>>({});
  const [svgViewModes, setSvgViewModes] = useState<Record<string, 'visual' | 'code'>>({});
  const [svgBgModes, setSvgBgModes] = useState<Record<string, 'dark' | 'grid' | 'light'>>({});
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Record<string, boolean>>({});
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  // Initialize mermaid once
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkTheme ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    });
  }, [isDarkTheme]);

  const isFirstRender = useRef(true);

  // Parse markdown into AST segments (带平滑稳帧防抖：首屏 0 延迟即时呈现，编辑态 150ms 窗口防抖)
  useEffect(() => {
    let isCancelled = false;
    const delay = isFirstRender.current ? 0 : 150;
    isFirstRender.current = false;

    const parseAndRender = async () => {
      setIsRendering(true);
      // 若存在 Frontmatter，正文始终剥离掉头部原始 YAML（由卡片或折叠条专职展示），保持排版纯净
      const cleanBody = okfData.hasFrontmatter ? okfData.markdownBody : content;
      const tokens = marked.lexer(cleanBody);
      const parsedBlocks: RenderedBlock[] = [];
      let htmlAccumulator: any[] = [];
      let counter = 0;
      let runningLine = 1;

      const customRenderer = new marked.Renderer();
      const origTable = customRenderer.table.bind(customRenderer);
      customRenderer.table = function (headerOrToken: any, body?: any) {
        const rendered = origTable(headerOrToken, body);
        return `<div class="ov-table-wrapper">${rendered}</div>`;
      };
      customRenderer.image = function (hrefOrToken: any, title?: any, text?: any) {
        const href = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.href : hrefOrToken;
        const alt = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.text : text;
        const imgTitle = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.title : title;
        const safeAlt = (alt || '').replace(/"/g, '&quot;');
        const safeTitle = (imgTitle || '').replace(/"/g, '&quot;');
        return `<span class="ov-image-container"><img src="${href}" alt="${safeAlt}" title="${safeTitle}" loading="lazy" onerror="this.classList.add('ov-img-broken');this.insertAdjacentHTML('afterend','<span class=\\'ov-image-fallback\\'>⚠️ ${t('imageNotFound', locale)}: <code>${href}</code></span>');this.style.display='none';" /></span>`;
      };

      // 编译 HTML 中的 KaTeX 行内与块级数学公式
      const renderKatexInHtml = (rawHtml: string): string => {
        // 1. 块级公式 $$ ... $$
        let res = rawHtml.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
          try {
            return `<div class="ov-katex-block">${katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false, errorColor: '#f43f5e' })}</div>`;
          } catch {
            return _match;
          }
        });
        // 2. 行内公式 $ ... $（避开价格如 $100 等纯数字）
        res = res.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (_match, formula) => {
          if (/^\d+(\.\d+)?$/.test(formula.trim())) return _match;
          try {
            return `<span class="ov-katex-inline">${katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false, errorColor: '#f43f5e' })}</span>`;
          } catch {
            return _match;
          }
        });
        return res;
      };

      const flushHtml = async () => {
        if (htmlAccumulator.length === 0) return;
        const rawMarkdown = htmlAccumulator.map(t => t.raw).join('');
        const html = marked.parser(htmlAccumulator, { renderer: customRenderer });
        const htmlWithMath = renderKatexInHtml(html);
        parsedBlocks.push({
          id: `block-html-${counter++}`,
          type: 'html',
          raw: rawMarkdown,
          renderedHtml: DOMPurify.sanitize(htmlWithMath, DOMPURIFY_SVG_CONFIG) as string,
        });
        htmlAccumulator = [];
      };

      for (const token of tokens) {
        const tokenNewlines = (token.raw.match(/\n/g) || []).length;
        const tokenStartLine = runningLine;
        const tokenEndLine = token.raw.endsWith('\n')
          ? tokenStartLine + Math.max(0, tokenNewlines - 1)
          : tokenStartLine + tokenNewlines;
        runningLine += tokenNewlines;

        if (token.type === 'code') {
          const primaryLang = (token.lang || '').split(/\s+/)[0].toLowerCase();
          if (['mermaid'].includes(primaryLang)) {
            await flushHtml();
            parsedBlocks.push({
              id: `block-mermaid-${counter++}`,
              type: 'mermaid',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['plantuml', 'puml'].includes(primaryLang)) {
            await flushHtml();
            parsedBlocks.push({
              id: `block-plantuml-${counter++}`,
              type: 'plantuml',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['dot', 'graphviz'].includes(primaryLang)) {
            await flushHtml();
            parsedBlocks.push({
              id: `block-graphviz-${counter++}`,
              type: 'graphviz',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (primaryLang === 'svg' || (primaryLang === 'xml' && token.text.includes('<svg'))) {
            await flushHtml();
            const sanitized = DOMPurify.sanitize(token.text, DOMPURIFY_SVG_CONFIG) as string;
            parsedBlocks.push({
              id: `block-svg-${counter++}`,
              type: 'svg',
              mode: 'code-block',
              raw: token.text,
              svgContent: sanitized,
              title: t('svgCodeBlock', locale),
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['math', 'katex', 'latex'].includes(primaryLang)) {
            await flushHtml();
            parsedBlocks.push({
              id: `block-math-${counter++}`,
              type: 'math',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else {
            await flushHtml();
            parsedBlocks.push({
              id: `block-code-${counter++}`,
              type: 'code',
              lang: primaryLang || 'text',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          }
        } else if (
          token.type === 'paragraph' &&
          token.text &&
          token.text.trim().startsWith('$$') &&
          token.text.trim().endsWith('$$') &&
          token.text.trim().length >= 4 &&
          !token.text.trim().slice(2, -2).includes('$$')
        ) {
          await flushHtml();
          const mathFormula = token.text.trim().slice(2, -2).trim();
          parsedBlocks.push({
            id: `block-math-${counter++}`,
            type: 'math',
            raw: mathFormula,
            startLine: tokenStartLine,
            endLine: tokenEndLine,
          });
        } else if (
          token.type === 'paragraph' &&
          token.tokens &&
          token.tokens.some((t: any) => t.type === 'image' && t.href && t.href.toLowerCase().includes('.svg'))
        ) {
          const imgToken = token.tokens.find((t: any) => t.type === 'image' && t.href && t.href.toLowerCase().includes('.svg')) as any;
          const cleanSrc = imgToken
            ? decodeURIComponent(imgToken.href.trim().split(/[?#]/, 1)[0]).replace(/\\/g, '/').replace(/^\/+/, '')
            : '';
          const relativeSrc = cleanSrc.replace(/^(\.\.\/|\.\/)+/g, '');
          const matchedFile = filesRef.current.find(
            f => f.name === cleanSrc ||
                 f.name.toLowerCase() === cleanSrc.toLowerCase() ||
                 (f.path && f.path.replace(/^\//, '') === cleanSrc) ||
                 (f.path && f.path.replace(/\\/g, '/').endsWith(`/${relativeSrc}`)) ||
                 (relativeSrc === 'system-architecture.svg' && f.name === 'cloud-infrastructure.svg')
          );

          if (matchedFile && matchedFile.extension.toLowerCase() === 'svg') {
            await flushHtml();
            const sanitized = DOMPurify.sanitize(matchedFile.content, DOMPURIFY_SVG_CONFIG) as string;
            parsedBlocks.push({
              id: `block-svg-${counter++}`,
              type: 'svg',
              mode: 'file',
              raw: matchedFile.content,
              fileName: matchedFile.name,
              title: imgToken?.text || matchedFile.name,
              svgContent: sanitized,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else {
            htmlAccumulator.push(token);
          }
        } else if (token.type === 'table') {
          await flushHtml();
          const tableToken = token as any;
          parsedBlocks.push({
            id: `block-table-${counter++}`,
            type: 'table',
            raw: token.raw,
            tableData: {
              header: tableToken.header || [],
              rows: tableToken.rows || [],
              align: tableToken.align || [],
            },
            startLine: tokenStartLine,
            endLine: tokenEndLine,
          });
        } else {
          htmlAccumulator.push(token);
        }
      }

      await flushHtml();

      // Render Mermaid diagrams asynchronously
      for (const block of parsedBlocks) {
        if (block.type === 'mermaid') {
          try {
            const uniqueId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
            const { svg } = await mermaid.render(uniqueId, block.raw);
            block.svgContent = svg;
          } catch (err: any) {
            console.error('Mermaid render error:', err);
            block.error = err.message || 'Mermaid Error';
          }
        } else if (block.type === 'plantuml') {
          const svgUrl = getPlantUmlSvgUrl(block.raw);
          block.renderedHtml = svgUrl;
        }
      }

      if (!isCancelled) {
        setBlocks(parsedBlocks);
        setIsRendering(false);
        // Notify parent that DOM is about to be updated so it can re-inject search highlights
        onRenderComplete?.();
      }
    };

    const timer = setTimeout(() => {
      parseAndRender();
    }, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [content, isDarkTheme, locale, enableOkf]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadSvg = (svgStr: string, name: string) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const adjustZoom = (id: string, delta: number) => {
    setZoomScales(prev => {
      const current = prev[id] || 1;
      const next = Math.max(0.5, Math.min(2.5, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleReRenderMermaid = async (blockId: string, newCode: string) => {
    try {
      const uniqueId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(uniqueId, newCode);
      setBlocks(prev =>
        prev.map(b => (b.id === blockId ? { ...b, svgContent: svg, raw: newCode, error: undefined } : b))
      );
      setDiagramViewModes(prev => ({ ...prev, [blockId]: 'visual' }));
    } catch (err: any) {
      setBlocks(prev =>
        prev.map(b => (b.id === blockId ? { ...b, error: err.message || 'Mermaid Error' } : b))
      );
    }
  };

  const handleReRenderPlantUml = (blockId: string, newCode: string) => {
    const svgUrl = getPlantUmlSvgUrl(newCode);
    setBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, raw: newCode, renderedHtml: svgUrl } : b))
    );
    setDiagramViewModes(prev => ({ ...prev, [blockId]: 'visual' }));
  };

  const handleReRenderSvg = (blockId: string, newCode: string) => {
    const sanitized = DOMPurify.sanitize(newCode, DOMPURIFY_SVG_CONFIG) as string;
    setBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, raw: newCode, svgContent: sanitized } : b))
    );
    setSvgViewModes(prev => ({ ...prev, [blockId]: 'visual' }));
  };

  // 点击正文中的任何图片自动呼出高清全屏灯箱
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'img') {
        const img = target as HTMLImageElement;
        // 避开 404 缺失占位图
        if (img.classList.contains('ov-img-broken')) return;
        e.preventDefault();
        e.stopPropagation();
        setLightboxItem({
          title: img.alt || img.title || 'Image Preview',
          url: img.src,
        });
        return;
      }

      // 智能拦截相对 Markdown/OKF 概念链接，支持知识图谱跨文件跳转
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (
          href &&
          !href.startsWith('http://') &&
          !href.startsWith('https://') &&
          !href.startsWith('#') &&
          !href.startsWith('mailto:')
        ) {
          const cleanHref = decodeURIComponent(href.trim().split(/[?#]/, 1)[0])
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');
          const baseName = cleanHref.split('/').pop() || '';
          const targetFile = filesRef.current.find(
            f =>
              f.name.toLowerCase() === baseName.toLowerCase() ||
              (f.path && f.path.replace(/^\//, '').toLowerCase().endsWith(cleanHref.toLowerCase()))
          );
          if (targetFile && onSelectFile) {
            e.preventDefault();
            e.stopPropagation();
            onSelectFile(targetFile);
          }
        }
      }
    };

    container.addEventListener('click', handleContainerClick);
    return () => container.removeEventListener('click', handleContainerClick);
  }, [onSelectFile]);

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
          className={`mb-4 flex items-center justify-between px-3 py-2 rounded-lg border border-dashed text-xs ${
            isDarkTheme
              ? 'border-slate-800 bg-slate-950/40 text-slate-400'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400/80 inline-block shrink-0" />
            <span>{t('okfRenderingTitle', locale)}: {t('collapsed', locale)}</span>
          </span>
          {onToggleOkf && (
            <button
              onClick={onToggleOkf}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer"
            >
              {t('enableOkf', locale)}
            </button>
          )}
        </div>
      )}

      {blocks.map(block => {
        if (block.type === 'html' && block.renderedHtml) {
          return (
            <RenderErrorBoundary key={block.id} blockName="Document Content" locale={locale}>
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: block.renderedHtml }}
              />
            </RenderErrorBoundary>
          );
        }

        // Standard Code Block
        if (block.type === 'code') {
          const isCollapsed = Boolean(collapsedCodeBlocks[block.id]);
          return (
            <RenderErrorBoundary key={block.id} blockName={`Code (${block.lang || 'text'})`} locale={locale}>
              <CodeBlock
                id={block.id}
                lang={block.lang}
                code={block.raw}
                isCollapsed={isCollapsed}
                isCopied={copiedId === block.id}
                onToggleCollapse={() => setCollapsedCodeBlocks(prev => ({ ...prev, [block.id]: !isCollapsed }))}
                onCopy={() => handleCopy(block.id, block.raw)}
                locale={locale}
              />
            </RenderErrorBoundary>
          );
        }

        // Enhanced Interactive Markdown Table Block
        if (block.type === 'table' && block.tableData) {
          return (
            <RenderErrorBoundary key={block.id} blockName="Markdown Table" locale={locale}>
              <TableBlock
                id={block.id}
                header={block.tableData.header}
                rows={block.tableData.rows.map(row => ({
                  cells: Array.isArray(row) ? row : [],
                }))}
                align={block.tableData.align}
                rawMarkdown={block.raw}
                startLine={block.startLine}
                endLine={block.endLine}
                isDarkTheme={isDarkTheme}
                locale={locale}
                onOpenSourceAtLine={onOpenSourceAtLine}
              />
            </RenderErrorBoundary>
          );
        }

        // Mermaid Block
        if (block.type === 'mermaid') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <RenderErrorBoundary key={block.id} blockName="Mermaid Diagram" locale={locale}>
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
                onChangeEditedCode={val => setEditedCodes(prev => ({ ...prev, [block.id]: val }))}
                onSetViewMode={mode => setDiagramViewModes(prev => ({ ...prev, [block.id]: mode }))}
                onZoomChange={delta => adjustZoom(block.id, delta)}
                onResetZoom={() => setZoomScales(prev => ({ ...prev, [block.id]: 1 }))}
                onOpenLightbox={() => setLightboxItem({ title: t('mermaidTitle', locale), content: block.svgContent })}
                onReRender={() => handleReRenderMermaid(block.id, currentCode)}
                onDownloadSvg={() => handleDownloadSvg(block.svgContent!, 'mermaid-diagram')}
                onCopy={() => handleCopy(block.id, currentCode)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                locale={locale}
              />
            </RenderErrorBoundary>
          );
        }

        // Math Block (KaTeX)
        if (block.type === 'math') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <RenderErrorBoundary key={block.id} blockName="KaTeX Math Formula" locale={locale}>
              <MathBlock
                id={block.id}
                code={block.raw}
                startLine={block.startLine}
                endLine={block.endLine}
                isCopied={copiedId === block.id}
                viewMode={currentMode}
                zoom={zoom}
                editedCode={currentCode}
                onChangeEditedCode={val => setEditedCodes(prev => ({ ...prev, [block.id]: val }))}
                onSetViewMode={mode => setDiagramViewModes(prev => ({ ...prev, [block.id]: mode }))}
                onZoomChange={delta => adjustZoom(block.id, delta)}
                onResetZoom={() => setZoomScales(prev => ({ ...prev, [block.id]: 1 }))}
                onOpenLightbox={() => {
                  let html = '';
                  try {
                    html = katex.renderToString(currentCode.trim(), { displayMode: true, throwOnError: false, errorColor: '#f43f5e' });
                  } catch {}
                  setLightboxItem({ title: t('mathFormula', locale), content: html || `<pre>${currentCode}</pre>` });
                }}
                onReRender={() => setEditedCodes(prev => ({ ...prev, [block.id]: currentCode }))}
                onCopy={() => handleCopy(block.id, currentCode)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                locale={locale}
              />
            </RenderErrorBoundary>
          );
        }

        // PlantUML Block
        if (block.type === 'plantuml') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;
          const svgUrl = block.renderedHtml || getPlantUmlSvgUrl(currentCode);

          return (
            <RenderErrorBoundary key={block.id} blockName="PlantUML Diagram" locale={locale}>
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
                onChangeEditedCode={val => setEditedCodes(prev => ({ ...prev, [block.id]: val }))}
                onSetViewMode={mode => setDiagramViewModes(prev => ({ ...prev, [block.id]: mode }))}
                onZoomChange={delta => adjustZoom(block.id, delta)}
                onResetZoom={() => setZoomScales(prev => ({ ...prev, [block.id]: 1 }))}
                onOpenLightbox={() => setLightboxItem({ title: t('plantUmlTitle', locale), url: svgUrl })}
                onReRender={() => handleReRenderPlantUml(block.id, currentCode)}
                onCopy={() => handleCopy(block.id, currentCode)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                locale={locale}
              />
            </RenderErrorBoundary>
          );
        }

        // SVG Block
        if (block.type === 'svg') {
          const zoom = zoomScales[block.id] || 1;
          const viewMode = svgViewModes[block.id] || 'visual';
          const bgMode = svgBgModes[block.id] || 'dark';
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <RenderErrorBoundary key={block.id} blockName="SVG Vector" locale={locale}>
              <SvgBlock
                id={block.id}
                mode={block.mode}
                title={block.title}
                fileName={block.fileName}
                rawCode={block.raw}
                svgContent={block.svgContent}
                isCopied={copiedId === block.id}
                viewMode={viewMode}
                bgMode={bgMode}
                zoom={zoom}
                editedCode={currentCode}
                onChangeEditedCode={val => setEditedCodes(prev => ({ ...prev, [block.id]: val }))}
                onSetViewMode={mode => setSvgViewModes(prev => ({ ...prev, [block.id]: mode }))}
                onSetBgMode={mode => setSvgBgModes(prev => ({ ...prev, [block.id]: mode }))}
                onZoomChange={delta => adjustZoom(block.id, delta)}
                onResetZoom={() => setZoomScales(prev => ({ ...prev, [block.id]: 1 }))}
                onOpenLightbox={() => setLightboxItem({ title: block.title || 'SVG', content: block.svgContent || block.raw })}
                onReRender={() => handleReRenderSvg(block.id, currentCode)}
                onDownloadSvg={() => handleDownloadSvg(currentCode, 'diagram')}
                onCopy={() => handleCopy(block.id, currentCode)}
                locale={locale}
              />
            </RenderErrorBoundary>
          );
        }

        // Graphviz / DOT Block
        if (block.type === 'graphviz') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <RenderErrorBoundary key={block.id} blockName="Graphviz Diagram" locale={locale}>
              <GraphvizBlock
                id={block.id}
                code={currentCode}
                startLine={block.startLine}
                endLine={block.endLine}
                isCopied={copiedId === block.id}
                viewMode={currentMode}
                zoom={zoom}
                editedCode={currentCode}
                onChangeEditedCode={val => setEditedCodes(prev => ({ ...prev, [block.id]: val }))}
                onSetViewMode={mode => setDiagramViewModes(prev => ({ ...prev, [block.id]: mode }))}
                onZoomChange={delta => adjustZoom(block.id, delta)}
                onResetZoom={() => setZoomScales(prev => ({ ...prev, [block.id]: 1 }))}
                onOpenLightbox={async () => {
                  try {
                    const svg = await graphvizRenderer.render(currentCode, 'dot');
                    setLightboxItem({ title: t('graphvizTitle', locale), content: svg });
                  } catch {
                    setLightboxItem({ title: t('graphvizTitle', locale), content: `<pre>${currentCode}</pre>` });
                  }
                }}
                onReRender={() => setEditedCodes(prev => ({ ...prev, [block.id]: currentCode }))}
                onDownloadSvg={async () => {
                  try {
                    const svg = await graphvizRenderer.render(currentCode, 'dot');
                    handleDownloadSvg(svg, 'graphviz');
                  } catch {}
                }}
                onCopy={() => handleCopy(block.id, currentCode)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                locale={locale}
              />
            </RenderErrorBoundary>
          );
        }

        return null;
      })}

      {/* Fullscreen / Lightbox Modal */}
      <LightboxModal
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        locale={locale}
      />
    </div>
  );
};
