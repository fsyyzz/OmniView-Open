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
import { StableHtmlBlock } from './markdown/StableHtmlBlock';
import { LazyViewportBlock } from './markdown/LazyViewportBlock';
import { graphvizRenderer } from '../../lib/graphvizRenderer';
import { LightboxModal, LightboxItem } from '../common/LightboxModal';
import { RenderErrorBoundary } from '../common/RenderErrorBoundary';
import { Locale, t } from '../../../../shared/lib/i18n';
import { parseOkfFrontmatter, OkfParseResult } from '../../lib/okfParser';
import { OkfHeaderCard } from './markdown/OkfHeaderCard';
import { loadStoredSettings } from '../../../../shared/lib/settingsStorage';
import { ContentWidthMode } from '../../../../shared/types';

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

interface RenderedBlock {
  id: string;
  type: 'html' | 'code' | 'mermaid' | 'plantuml' | 'svg' | 'math' | 'graphviz' | 'table' | 'pagebreak';
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
    rows: Array<{ cells: any[] }>;
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
    'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'image', 'pattern', 'mask',
    'details', 'summary', 'input', 'label'
  ],
  ADD_ATTR: [
    'viewBox', 'xmlns', 'xmlns:xlink', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'fill-opacity',
    'stroke-opacity', 'transform', 'style', 'id', 'class', 'gradientUnits', 'gradientTransform',
    'offset', 'stop-color', 'stop-opacity', 'preserveAspectRatio', 'text-anchor', 'font-family',
    'font-size', 'font-weight', 'letter-spacing', 'dominant-baseline', 'href', 'xlink:href',
    'target', 'rel', 'crossorigin', 'points', 'dx', 'dy', 'stdDeviation', 'flood-color', 'flood-opacity',
    'marker-end', 'marker-start', 'marker-mid',
    'data-source-line', 'data-source-end-line', 'data-task-line', 'data-checked', 'data-callout',
    'open', 'type', 'checked', 'aria-label'
  ],
};

/**
 * 辅助函数：根据 GitHub / Obsidian Callout 类型生成语义元数据、图标与默认标题
 */
const getCalloutMeta = (typeStr: string, locale: Locale) => {
  const tStr = typeStr.toLowerCase();
  switch (tStr) {
    case 'note':
    case 'info':
      return {
        type: 'note',
        title: locale === 'zh-CN' ? '备注' : 'Note',
        colorClass: 'ov-callout-note',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
      };
    case 'tip':
    case 'hint':
      return {
        type: 'tip',
        title: locale === 'zh-CN' ? '技巧提示' : 'Tip',
        colorClass: 'ov-callout-tip',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`,
      };
    case 'important':
      return {
        type: 'important',
        title: locale === 'zh-CN' ? '重要' : 'Important',
        colorClass: 'ov-callout-important',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
      };
    case 'warning':
    case 'attention':
      return {
        type: 'warning',
        title: locale === 'zh-CN' ? '警告' : 'Warning',
        colorClass: 'ov-callout-warning',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      };
    case 'caution':
    case 'danger':
    case 'error':
    case 'failure':
    case 'bug':
      return {
        type: 'caution',
        title: locale === 'zh-CN' ? '注意' : 'Caution',
        colorClass: 'ov-callout-caution',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
      };
    case 'success':
    case 'done':
    case 'check':
      return {
        type: 'success',
        title: locale === 'zh-CN' ? '成功' : 'Success',
        colorClass: 'ov-callout-success',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      };
    case 'question':
    case 'help':
    case 'faq':
      return {
        type: 'question',
        title: locale === 'zh-CN' ? '帮助' : 'Question',
        colorClass: 'ov-callout-question',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      };
    case 'example':
      return {
        type: 'example',
        title: locale === 'zh-CN' ? '示例' : 'Example',
        colorClass: 'ov-callout-example',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
      };
    case 'quote':
    case 'cite':
      return {
        type: 'quote',
        title: locale === 'zh-CN' ? '引用' : 'Quote',
        colorClass: 'ov-callout-quote',
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>`,
      };
    default:
      return null;
  }
};

const MarkdownViewerComponent: React.FC<MarkdownViewerProps> = ({
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
      // 若存在 Frontmatter，正文剥离头部原始 YAML，并准确计算 YAML 所占行数以严丝合缝对齐源文件行号
      const cleanBody = okfData.hasFrontmatter ? okfData.markdownBody : content;
      const frontmatterLines = okfData.hasFrontmatter
        ? (content.slice(0, content.length - cleanBody.length).match(/\n/g) || []).length
        : 0;
      const tokens = marked.lexer(cleanBody);
      const parsedBlocks: RenderedBlock[] = [];
      let counter = 0;
      let runningLine = frontmatterLines + 1;
      let currentTokenStartLine = runningLine;

      const customRenderer = new marked.Renderer();
      const origTable = customRenderer.table.bind(customRenderer);
      customRenderer.table = function (headerOrToken: any, body?: any) {
        const rendered = origTable(headerOrToken, body);
        return `<div class="ov-table-wrapper" data-source-line="${currentTokenStartLine}">${rendered}</div>`;
      };
      customRenderer.image = function (hrefOrToken: any, title?: any, text?: any) {
        const href = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.href : hrefOrToken;
        const alt = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.text : text;
        const imgTitle = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.title : title;
        const safeAlt = (alt || '').replace(/"/g, '&quot;');
        const safeTitle = (imgTitle || '').replace(/"/g, '&quot;');
        return `<span class="ov-image-container"><img src="${href}" alt="${safeAlt}" title="${safeTitle}" loading="lazy" onerror="this.classList.add('ov-img-broken');this.insertAdjacentHTML('afterend','<span class=\\'ov-image-fallback\\'>⚠️ ${t('imageNotFound', locale)}: <code>${href}</code></span>');this.style.display='none';" /></span>`;
      };

      customRenderer.heading = function (headerOrToken: any, depth?: any) {
        let text = '';
        let level = depth || 1;
        if (typeof headerOrToken === 'object' && headerOrToken !== null) {
          level = headerOrToken.depth || 1;
          text = this.parser.parseInline(headerOrToken.tokens || []);
        } else {
          text = headerOrToken;
        }
        const slug = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || `h-${Math.random().toString(36).slice(2, 7)}`;
        return `<h${level} id="${slug}" data-source-line="${currentTokenStartLine}">${text}</h${level}>\n`;
      };

      customRenderer.paragraph = function (tokenOrText: any) {
        let text = '';
        if (typeof tokenOrText === 'object' && tokenOrText !== null) {
          text = this.parser.parseInline(tokenOrText.tokens || []);
        } else {
          text = tokenOrText;
        }
        return `<p data-source-line="${currentTokenStartLine}">${text}</p>\n`;
      };

      customRenderer.blockquote = function (tokenOrQuote: any) {
        if (typeof tokenOrQuote === 'object' && tokenOrQuote !== null && tokenOrQuote.tokens) {
          const firstToken = tokenOrQuote.tokens[0];
          if (firstToken && (firstToken.type === 'paragraph' || firstToken.type === 'text')) {
            const firstRaw = (firstToken.raw || firstToken.text || '').trimStart();
            const calloutMatch = firstRaw.match(/^\[!([a-zA-Z]+)\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n([\s\S]*))?$/);
            if (calloutMatch) {
              const typeRaw = calloutMatch[1];
              const fold = calloutMatch[2];
              const customTitle = (calloutMatch[3] || '').trim();
              const remainingText = (calloutMatch[4] || '');
              const meta = getCalloutMeta(typeRaw, locale) || {
                type: typeRaw.toLowerCase(),
                title: customTitle || typeRaw.toUpperCase(),
                colorClass: `ov-callout-${typeRaw.toLowerCase()}`,
                icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
              };

              const displayTitle = customTitle || meta.title;
              const restTokens = [...tokenOrQuote.tokens];
              if (remainingText.trim()) {
                const innerTokens = marked.lexer(remainingText);
                restTokens[0] = {
                  type: 'paragraph',
                  raw: remainingText,
                  text: remainingText,
                  tokens: (innerTokens[0] as any)?.tokens || [],
                };
              } else {
                restTokens.shift();
              }

              const bodyHtml = restTokens.length > 0 ? this.parser.parse(restTokens) : '';
              const isCollapsible = fold === '+' || fold === '-';
              const isOpen = fold !== '-';
              const chevronSvg = `<svg class="ov-callout-fold-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

              if (isCollapsible) {
                return `<details class="ov-callout ${meta.colorClass}" data-callout="${meta.type}" ${isOpen ? 'open' : ''} data-source-line="${currentTokenStartLine}"><summary class="ov-callout-title"><span class="ov-callout-title-left">${meta.icon}<span class="ov-callout-title-text">${displayTitle}</span></span>${chevronSvg}</summary><div class="ov-callout-body">${bodyHtml}</div></details>\n`;
              }

              return `<div class="ov-callout ${meta.colorClass}" data-callout="${meta.type}" data-source-line="${currentTokenStartLine}"><div class="ov-callout-title"><span class="ov-callout-title-left">${meta.icon}<span class="ov-callout-title-text">${displayTitle}</span></span></div><div class="ov-callout-body">${bodyHtml}</div></div>\n`;
            }
          }
          const body = this.parser.parse(tokenOrQuote.tokens);
          return `<blockquote data-source-line="${currentTokenStartLine}">${body}</blockquote>\n`;
        }
        return `<blockquote data-source-line="${currentTokenStartLine}">${tokenOrQuote}</blockquote>\n`;
      };

      const origListitem = customRenderer.listitem.bind(customRenderer);
      customRenderer.listitem = function (itemOrText: any, task?: boolean, checked?: boolean) {
        if (typeof itemOrText === 'object' && itemOrText !== null) {
          const isTask = itemOrText.task;
          const isChecked = itemOrText.checked;
          const itemLine = itemOrText._startLine || currentTokenStartLine;
          let body = this.parser.parse(itemOrText.tokens || []);
          if (isTask) {
            // 清除 marked 默认插入的不可控 checkbox html
            body = body.replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, '').trim();
            const checkboxHtml = `<input type="checkbox" class="ov-task-checkbox" data-task-line="${itemLine}" ${isChecked ? 'checked' : ''} aria-label="${isChecked ? 'Mark incomplete' : 'Mark complete'}" title="${t('taskToggleTooltip', locale)}" />`;
            return `<li class="ov-task-list-item ${isChecked ? 'ov-task-done' : ''}" data-task-line="${itemLine}" data-checked="${isChecked ? 'true' : 'false'}"><label class="ov-task-label">${checkboxHtml}<span class="ov-task-text">${body}</span></label></li>\n`;
          }
          return `<li data-source-line="${itemLine}">${body}</li>\n`;
        }
        return origListitem(itemOrText, task, checked);
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
        // 2. 行内公式 $ ... $（严格匹配两端非空白字符，避开价格与普通货币符号）
        res = res.replace(/(?<!\\)\$([^\s\$](?:[^\$\n]*?[^\s\$])?)(?<!\\)\$/g, (_match, formula) => {
          if (/^\d+(\.\d+)?$/.test(formula.trim())) return _match;
          try {
            return `<span class="ov-katex-inline">${katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false, errorColor: '#f43f5e' })}</span>`;
          } catch {
            return _match;
          }
        });
        return res;
      };

      const renderHtmlToken = (token: any, startLine: number, endLine: number) => {
        currentTokenStartLine = startLine;
        const html = marked.parser([token], { renderer: customRenderer });
        const htmlWithMath = renderKatexInHtml(html);
        parsedBlocks.push({
          id: `block-html-${counter++}`,
          type: 'html',
          raw: token.raw,
          startLine,
          endLine,
          renderedHtml: DOMPurify.sanitize(htmlWithMath, DOMPURIFY_SVG_CONFIG) as string,
        });
      };

      for (const token of tokens) {
        const tokenNewlines = (token.raw.match(/\n/g) || []).length;
        const tokenStartLine = runningLine;
        const tokenEndLine = token.raw.endsWith('\n')
          ? tokenStartLine + Math.max(0, tokenNewlines - 1)
          : tokenStartLine + tokenNewlines;
        runningLine += tokenNewlines;

        if (token.type === 'list' && (token as any).items) {
          let itemRunningLine = tokenStartLine;
          for (const item of (token as any).items) {
            item._startLine = itemRunningLine;
            const itemNewlines = (item.raw.match(/\n/g) || []).length;
            itemRunningLine += itemNewlines;
          }
        }

        // 识别 A4 物理分页符指令 (<!-- pagebreak -->, ---page---, \pagebreak, 等)
        const isPageBreakToken = (t: any): boolean => {
          const rawText = (t.raw || t.text || '').trim();
          if (/^(<!--\s*page-?break\s*-->|---page---|\\pagebreak|\[page-?break\]|<div[^>]*class=["'][^"']*page-?break[^"']*["'][^>]*>\s*(<\/div>)?)$/i.test(rawText)) {
            return true;
          }
          if (t.type === 'hr' && /page/i.test(t.raw || '')) {
            return true;
          }
          return false;
        };

        if (isPageBreakToken(token)) {
          parsedBlocks.push({
            id: `block-pagebreak-${counter++}`,
            type: 'pagebreak',
            raw: token.raw,
            startLine: tokenStartLine,
            endLine: tokenEndLine,
          });
        } else if (token.type === 'code') {
          const primaryLang = (token.lang || '').split(/\s+/)[0].toLowerCase();
          if (['mermaid'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-mermaid-${counter++}`,
              type: 'mermaid',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['plantuml', 'puml'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-plantuml-${counter++}`,
              type: 'plantuml',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['dot', 'graphviz'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-graphviz-${counter++}`,
              type: 'graphviz',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (primaryLang === 'svg' || (primaryLang === 'xml' && token.text.includes('<svg'))) {
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
            parsedBlocks.push({
              id: `block-math-${counter++}`,
              type: 'math',
              raw: token.text,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else {
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
            renderHtmlToken(token, tokenStartLine, tokenEndLine);
          }
        } else if (token.type === 'table') {
          const tableToken = token as any;
          parsedBlocks.push({
            id: `block-table-${counter++}`,
            type: 'table',
            raw: token.raw,
            tableData: {
              header: tableToken.header || [],
              rows: (tableToken.rows || []).map((row: unknown) => ({
                cells: Array.isArray(row) ? row : [],
              })),
              align: tableToken.align || [],
            },
            startLine: tokenStartLine,
            endLine: tokenEndLine,
          });
        } else {
          renderHtmlToken(token, tokenStartLine, tokenEndLine);
        }
      }

      // PlantUML URL 可同步生成；Mermaid 交由块内按需渲染，避免串行 await 阻塞首屏
      for (const block of parsedBlocks) {
        if (block.type === 'plantuml') {
          block.renderedHtml = getPlantUmlSvgUrl(block.raw);
        }
      }

      if (!isCancelled) {
        setBlocks(parsedBlocks);
        setIsRendering(false);
      }
    };

    const timer = setTimeout(() => {
      parseAndRender();
    }, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [content, isDarkTheme, locale]);

  // 在 React 提交 DOM 后再通知父级重注搜索高亮，避免 setState 尚未刷盘时误标旧树
  useEffect(() => {
    if (isRendering) return;
    const frame = requestAnimationFrame(() => {
      onRenderComplete?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [blocks, isRendering, onRenderComplete]);

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

  // 双向回写：任务复选框状态改变时，精确定位源码行并回写
  const handleToggleTask = (targetLineNum: number, newChecked: boolean) => {
    if (!onContentChange) return;
    const lines = content.split('\n');
    const zeroIndex = targetLineNum - 1;
    const taskRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s*.*)$/;

    let matchedIndex = -1;
    if (zeroIndex >= 0 && zeroIndex < lines.length && taskRegex.test(lines[zeroIndex])) {
      matchedIndex = zeroIndex;
    } else {
      // 容错搜索周围行
      for (let offset = -3; offset <= 3; offset++) {
        const idx = zeroIndex + offset;
        if (idx >= 0 && idx < lines.length && taskRegex.test(lines[idx])) {
          matchedIndex = idx;
          break;
        }
      }
    }

    if (matchedIndex !== -1) {
      const line = lines[matchedIndex];
      const replacement = newChecked ? '$1x$3' : '$1 $3';
      lines[matchedIndex] = line.replace(taskRegex, replacement);
      const newContent = lines.join('\n');
      onContentChange(newContent);
    }
  };

  // 点击正文中的任何图片自动呼出高清全屏灯箱 / 任务复选框微交互 / 概念链接跳转
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. 交互式 Task List（复选清单）双向回写
      const taskCheckbox = (target.closest('input.ov-task-checkbox') || (target.matches('input.ov-task-checkbox') ? target : null)) as HTMLInputElement | null;
      if (taskCheckbox) {
        const lineAttr = taskCheckbox.getAttribute('data-task-line');
        if (lineAttr) {
          const lineNum = parseInt(lineAttr, 10);
          if (!isNaN(lineNum) && lineNum > 0) {
            const isChecked = taskCheckbox.checked;
            const listItem = taskCheckbox.closest('.ov-task-list-item');
            if (listItem) {
              if (isChecked) {
                listItem.classList.add('ov-task-done');
                listItem.setAttribute('data-checked', 'true');
              } else {
                listItem.classList.remove('ov-task-done');
                listItem.setAttribute('data-checked', 'false');
              }
            }
            handleToggleTask(lineNum, isChecked);
          }
        }
        return;
      }

      // 2. 图片灯箱放大
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

      // 3. 智能拦截相对 Markdown/OKF 概念链接，支持知识图谱跨文件跳转
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

    const handleContainerDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, details, summary')) return;
      const sourceElement = target.closest('[data-source-line]');
      if (sourceElement) {
        const lineAttr = sourceElement.getAttribute('data-source-line');
        if (lineAttr) {
          const lineNum = parseInt(lineAttr, 10);
          if (!isNaN(lineNum) && lineNum > 0) {
            onOpenSourceAtLine?.(lineNum);
          }
        }
      }
    };

    container.addEventListener('click', handleContainerClick);
    container.addEventListener('dblclick', handleContainerDblClick);
    return () => {
      container.removeEventListener('click', handleContainerClick);
      container.removeEventListener('dblclick', handleContainerDblClick);
    };
  }, [onSelectFile, onOpenSourceAtLine, onContentChange, content]);

  // Markdown 与 VS Code 编辑器双向光标/滚动同步监听器
  useEffect(() => {
    let activeHighlightTimer: any = null;

    const handleEditorSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: 'editor-scroll-sync' | 'editor-cursor-sync';
        path?: string;
        topLine?: number;
        bottomLine?: number;
        totalLines?: number;
        activeLine?: number;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      // 验证是否已开启 scrollSync（默认开启）
      const settings = loadStoredSettings();
      if (settings.scrollSync === false) return;

      const container = containerRef.current;
      if (!container) return;

      // 获取当前实际产生滚动的视口容器
      const scrollViewport = container.closest<HTMLElement>('.markdown-plugin-scroll') ||
                             container.parentElement ||
                             document.documentElement;

      const isScrollSync = detail.type === 'editor-scroll-sync';
      const targetLine = isScrollSync
        ? (detail.topLine ?? 1)
        : (detail.activeLine ?? 1);

      if (typeof targetLine !== 'number' || isNaN(targetLine) || targetLine < 1) return;

      // 查询全部带有源码行属性的 AST 渲染节点
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>('[data-source-line]')
      ).map(el => {
        const start = parseInt(el.getAttribute('data-source-line') || '1', 10);
        const end = parseInt(el.getAttribute('data-source-end-line') || String(start), 10);
        return {
          element: el,
          startLine: start,
          endLine: Math.max(start, end),
          offsetTop: el.offsetTop,
          offsetHeight: el.offsetHeight,
        };
      }).sort((a, b) => a.offsetTop - b.offsetTop);

      if (elements.length === 0) return;

      let targetScrollTop = 0;
      let matchedElement: HTMLElement | null = null;

      if (targetLine <= 1) {
        targetScrollTop = 0;
        matchedElement = elements[0]?.element || null;
      } else if (detail.totalLines && targetLine >= detail.totalLines) {
        targetScrollTop = scrollViewport.scrollHeight - scrollViewport.clientHeight;
        matchedElement = elements[elements.length - 1]?.element || null;
      } else {
        // 查找与 targetLine 匹配或相邻的 AST 节点
        let foundExact = false;
        for (let i = 0; i < elements.length; i++) {
          const item = elements[i];
          if (targetLine >= item.startLine && targetLine <= item.endLine) {
            // 命中节点内部：根据行号在该节点所占比例微调滚动偏移量
            const lineProgress = (targetLine - item.startLine) / Math.max(1, item.endLine - item.startLine);
            targetScrollTop = item.offsetTop + lineProgress * item.offsetHeight;
            matchedElement = item.element;
            foundExact = true;
            break;
          }
          if (targetLine < item.startLine) {
            // 位于前一个节点与当前节点之间的空行/留白处
            const prevItem = elements[i - 1];
            if (prevItem) {
              const prevBottom = prevItem.offsetTop + prevItem.offsetHeight;
              const ratio = (targetLine - prevItem.endLine) / Math.max(1, item.startLine - prevItem.endLine);
              targetScrollTop = prevBottom + ratio * Math.max(0, item.offsetTop - prevBottom);
              matchedElement = prevItem.element;
            } else {
              targetScrollTop = Math.max(0, item.offsetTop * (targetLine / item.startLine));
              matchedElement = item.element;
            }
            foundExact = true;
            break;
          }
        }

        if (!foundExact) {
          const lastItem = elements[elements.length - 1];
          targetScrollTop = lastItem.offsetTop;
          matchedElement = lastItem.element;
        }
      }

      // 执行平滑视口滚动，并保留上边缘安全间距
      const safeScrollTop = Math.max(0, targetScrollTop - 24);
      scrollViewport.scrollTo({
        top: safeScrollTop,
        behavior: isScrollSync ? 'auto' : 'smooth',
      });

      // 若是光标导航（editor-cursor-sync），为匹配的 AST 段落注入高亮辉光
      if (detail.type === 'editor-cursor-sync' && matchedElement) {
        container.querySelectorAll('.ov-cursor-synced-line').forEach(el => {
          el.classList.remove('ov-cursor-synced-line');
        });
        matchedElement.classList.add('ov-cursor-synced-line');
        if (activeHighlightTimer) clearTimeout(activeHighlightTimer);
        activeHighlightTimer = setTimeout(() => {
          matchedElement?.classList.remove('ov-cursor-synced-line');
        }, 1800);
      }
    };

    window.addEventListener('omniview-editor-sync', handleEditorSync);
    return () => {
      window.removeEventListener('omniview-editor-sync', handleEditorSync);
      if (activeHighlightTimer) clearTimeout(activeHighlightTimer);
    };
  }, []);

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
                title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
              />
            </RenderErrorBoundary>
          );
        }

        // Standard Code Block
        if (block.type === 'code') {
          const isCollapsed = Boolean(collapsedCodeBlocks[block.id]);
          return (
            <LazyViewportBlock
              key={block.id}
              eager={eagerMount}
              minHeight={120}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
            >
              <RenderErrorBoundary blockName={`Code (${block.lang || 'text'})`} locale={locale}>
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
            </LazyViewportBlock>
          );
        }

        // Enhanced Interactive Markdown Table Block
        if (block.type === 'table' && block.tableData) {
          return (
            <LazyViewportBlock
              key={block.id}
              eager={eagerMount}
              minHeight={160}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
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

        // Mermaid Block
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
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
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
                  onChangeEditedCode={val => setEditedCodes(prev => ({ ...prev, [block.id]: val }))}
                  onSetViewMode={mode => setDiagramViewModes(prev => ({ ...prev, [block.id]: mode }))}
                  onZoomChange={delta => adjustZoom(block.id, delta)}
                  onResetZoom={() => setZoomScales(prev => ({ ...prev, [block.id]: 1 }))}
                  onOpenLightbox={svg =>
                    setLightboxItem({ title: t('mermaidTitle', locale), content: svg || block.svgContent })
                  }
                  onReRender={() => handleReRenderMermaid(block.id, currentCode)}
                  onDownloadSvg={() => handleDownloadSvg(block.svgContent!, 'mermaid-diagram')}
                  onCopy={() => handleCopy(block.id, currentCode)}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  locale={locale}
                />
              </RenderErrorBoundary>
            </LazyViewportBlock>
          );
        }

        // Math Block (KaTeX)
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
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
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
            </LazyViewportBlock>
          );
        }

        // PlantUML Block
        if (block.type === 'plantuml') {
          const currentMode = diagramViewModes[block.id] || 'visual';
          const zoom = zoomScales[block.id] || 1;
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;
          const svgUrl = block.renderedHtml || getPlantUmlSvgUrl(currentCode);

          return (
            <LazyViewportBlock
              key={block.id}
              eager={eagerMount}
              minHeight={200}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
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
            </LazyViewportBlock>
          );
        }

        // SVG Block
        if (block.type === 'svg') {
          const zoom = zoomScales[block.id] || 1;
          const viewMode = svgViewModes[block.id] || 'visual';
          const bgMode = svgBgModes[block.id] || 'dark';
          const currentCode = editedCodes[block.id] !== undefined ? editedCodes[block.id] : block.raw;

          return (
            <LazyViewportBlock
              key={block.id}
              eager={eagerMount}
              minHeight={180}
              data-source-line={block.startLine}
              data-source-end-line={block.endLine}
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
            >
              <RenderErrorBoundary blockName="SVG Vector" locale={locale}>
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
            </LazyViewportBlock>
          );
        }

        // Graphviz / DOT Block
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
              title={block.startLine ? `${t('doubleClickToLocate', locale)} (L${block.startLine})` : undefined}
            >
              <RenderErrorBoundary blockName="Graphviz Diagram" locale={locale}>
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
            </LazyViewportBlock>
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

export const MarkdownViewer = React.memo(MarkdownViewerComponent);
MarkdownViewer.displayName = 'MarkdownViewer';
