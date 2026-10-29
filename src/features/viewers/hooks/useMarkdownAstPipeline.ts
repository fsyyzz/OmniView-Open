/**
 * OmniView Markdown AST 解析流水线 Hook
 * 负责 Frontmatter、WikiLinks、Footnotes、KaTeX 及 Marked Token 切分
 * 遵循 SRP (单一职责原则) 与 Pipeline (管道模式)
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import { parseOkfFrontmatter, type OkfParseResult } from '../lib/okfParser';
import { processMarkdownFootnotes } from '../lib/markdownFootnotes';
import { processMarkdownWikiLinks } from '../lib/markdownWikiLinks';
import { processMarkdownDefinitionLists } from '../lib/markdownDefinitionLists';
import { processMarkdownMath, restoreMarkdownMath, restoreRawMathInText } from '../lib/markdownMath';
import { processEmojiShortcodes } from '../lib/markdownEmojiShortcodes';
import { getPlantUmlSvgUrl } from '../../../shared/lib/plantuml';
import { type Locale, t } from '../../../shared/lib/i18n';
import { sanitizeDiagramSvg, sanitizeDiagramHtml } from '../lib/diagramSanitizer';
import { fastFnv1a } from '../lib/diagramCache';
import { renderTimeBudgetRegistry } from '../lib/renderTimeBudget';

export interface RenderedBlock {
  id: string;
  type: 'html' | 'code' | 'mermaid' | 'plantuml' | 'svg' | 'math' | 'graphviz' | 'table' | 'pagebreak' | 'domainstory' | 'markmap' | 'excalidraw' | 'echarts';
  mode?: 'code-block' | 'file';
  lang?: string;
  langSuffix?: string;
  raw: string;
  startLine?: number;
  endLine?: number;
  renderedHtml?: string;
  svgContent?: string;
  fileName?: string;
  externalFile?: string;
  title?: string;
  error?: string;
  /** 内容快速 Hash 指纹，用于增量 Diff 与 Fiber 引用复用 */
  contentHash?: string;
  tableData?: {
    header: any[];
    rows: Array<{ cells: any[] }>;
    align?: Array<'left' | 'center' | 'right' | null>;
  };
}

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
        icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
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

export interface UseMarkdownAstPipelineOptions {
  content: string;
  files: Array<{ name: string; content: string; extension: string; path?: string; binaryUrl?: string }>;
  locale: Locale;
  isDarkTheme?: boolean;
}

/**
 * 从工作区与关联资源文件池中解析图片路径，支持 Webview 协议与 Base64 DataURI
 */
export function resolveMarkdownImageHref(
  rawHref: string,
  files?: Array<{ name: string; content: string; extension: string; path?: string; binaryUrl?: string }>
): string {
  if (!rawHref) return '';
  if (
    rawHref.startsWith('http://') ||
    rawHref.startsWith('https://') ||
    rawHref.startsWith('data:') ||
    rawHref.startsWith('blob:') ||
    rawHref.startsWith('vscode-webview:') ||
    rawHref.startsWith('vscode-resource:')
  ) {
    return rawHref;
  }
  if (!files || files.length === 0) return rawHref;

  const cleanSrc = decodeURIComponent(rawHref.trim().split(/[?#]/, 1)[0]).replace(/\\/g, '/').replace(/^\/+/, '');
  const relativeSrc = cleanSrc.replace(/^(\.\.\/|\.\/)+/g, '');
  const matchedFile = files.find(
    (f) =>
      f.name === cleanSrc ||
      f.name.toLowerCase() === cleanSrc.toLowerCase() ||
      (f.path && f.path.replace(/^\//, '') === cleanSrc) ||
      (f.path && f.path.replace(/\\/g, '/').endsWith(`/${relativeSrc}`)) ||
      f.name === relativeSrc ||
      f.name.toLowerCase() === relativeSrc.toLowerCase()
  );

  if (matchedFile) {
    // 1. 若宿主已提供可直接在 Webview 中加载的 binaryUrl，优先使用
    if (matchedFile.binaryUrl) {
      return matchedFile.binaryUrl;
    }
    // 2. 若 content 已经包含完整 data:image/ 前缀
    if (matchedFile.content && matchedFile.content.startsWith('data:image/')) {
      return matchedFile.content;
    }
    // 3. SVG 矢量格式
    const ext = (matchedFile.extension || '').toLowerCase();
    if (ext === 'svg' && matchedFile.content) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(matchedFile.content)}`;
    }
    // 4. 位图格式 (png, jpg, jpeg, gif, webp, bmp, ico, avif, tiff) 且 content 非空
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff'].includes(ext) && matchedFile.content) {
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mime};base64,${matchedFile.content}`;
    }
  }

  return rawHref;
}

export interface ParsedImageModifiers {
  cleanAlt: string;
  captionText: string;
  showCaption: boolean;
  themeVisibility: 'all' | 'dark-only' | 'light-only';
  plate: 'none' | 'light' | 'dark' | 'checker';
  align: 'default' | 'left' | 'right' | 'center';
  styleAttr: string;
  extraClasses: string[];
}

/**
 * 解析 Markdown 图片轻量修饰符与 GitHub 主题感知后缀
 * 支持:
 * - ![说明|480](url), ![说明|60%](url), ![说明|400x300](url)
 * - ![说明|bg-light](url), ![说明|bg-dark](url), ![说明|bg-checker](url)
 * - ![说明|left/right/center/rounded/circle/flat/caption](url)
 * - ![](url#gh-dark-mode-only), ![](url#gh-light-mode-only), ![](url#dark), ![](url#light)
 */
export function parseMarkdownImageModifiers(
  rawAlt = '',
  rawHref = '',
  rawTitle = ''
): ParsedImageModifiers {
  const extraClasses: string[] = [];
  const styles: string[] = [];
  let themeVisibility: 'all' | 'dark-only' | 'light-only' = 'all';
  let plate: 'none' | 'light' | 'dark' | 'checker' = 'none';
  let align: 'default' | 'left' | 'right' | 'center' = 'default';
  let forceCaption = false;

  const trimmedHref = (rawHref || '').trim();
  if (/#(?:gh-dark-mode-only|dark)$/i.test(trimmedHref)) {
    themeVisibility = 'dark-only';
    extraClasses.push('ov-img-dark-only');
  } else if (/#(?:gh-light-mode-only|light)$/i.test(trimmedHref)) {
    themeVisibility = 'light-only';
    extraClasses.push('ov-img-light-only');
  }

  const parts = (rawAlt || '').split('|').map((s) => s.trim());
  const cleanAlt = parts[0] || '';
  const modifiers = parts.slice(1);

  for (const mod of modifiers) {
    const lower = mod.toLowerCase();
    if (!lower) continue;

    const widthPxMatch = lower.match(/^(\d+)(?:px)?$/);
    const widthPctMatch = lower.match(/^(\d+)%$/);
    const dimMatch = lower.match(/^(\d+)x(\d+)$/);

    if (widthPxMatch) {
      styles.push(`max-width: ${widthPxMatch[1]}px; width: 100%;`);
    } else if (widthPctMatch) {
      styles.push(`max-width: ${widthPctMatch[1]}%; width: 100%;`);
    } else if (dimMatch) {
      styles.push(`max-width: ${dimMatch[1]}px; max-height: ${dimMatch[2]}px;`);
    } else if (lower === 'bg-light' || lower === 'light-bg' || lower === 'plate-light') {
      plate = 'light';
      extraClasses.push('ov-img-plate-light');
    } else if (lower === 'bg-dark' || lower === 'dark-bg' || lower === 'plate-dark') {
      plate = 'dark';
      extraClasses.push('ov-img-plate-dark');
    } else if (lower === 'bg-checker' || lower === 'checker') {
      plate = 'checker';
      extraClasses.push('ov-img-plate-checker');
    } else if (lower === 'left' || lower === 'align-left') {
      align = 'left';
      extraClasses.push('ov-img-align-left');
    } else if (lower === 'right' || lower === 'align-right') {
      align = 'right';
      extraClasses.push('ov-img-align-right');
    } else if (lower === 'center' || lower === 'align-center') {
      align = 'center';
      extraClasses.push('ov-img-align-center');
    } else if (lower === 'rounded' || lower === 'pill') {
      extraClasses.push('ov-img-rounded');
    } else if (lower === 'circle' || lower === 'avatar') {
      extraClasses.push('ov-img-circle');
    } else if (lower === 'no-shadow' || lower === 'flat') {
      extraClasses.push('ov-img-flat');
    } else if (lower === 'caption') {
      forceCaption = true;
    }
  }

  const trimmedTitle = (rawTitle || '').trim();
  const captionText = trimmedTitle || (forceCaption ? cleanAlt : '');
  const showCaption = Boolean(captionText);
  if (showCaption) {
    extraClasses.push('ov-image-with-caption');
  }

  return {
    cleanAlt,
    captionText,
    showCaption,
    themeVisibility,
    plate,
    align,
    styleAttr: styles.join(' '),
    extraClasses,
  };
}

function injectAutoImageCaptions(html: string): string {
  return html.replace(
    /<span class="ov-image-container([^"]*)"><img([^>]*?\salt="([^"]*)"[^>]*?)><\/span>/g,
    (fullMatch, containerClasses, imgAttrs, altVal) => {
      const trimmedAlt = (altVal || '').trim();
      if (!trimmedAlt) return fullMatch;
      const nextClasses = containerClasses.includes('ov-image-with-caption')
        ? containerClasses
        : `${containerClasses} ov-image-with-caption`;
      return `<span class="ov-image-container${nextClasses}"><img${imgAttrs}><span class="ov-image-caption">${trimmedAlt}</span></span>`;
    }
  );
}

/**
 * 预处理 Markdown 中内联未编码的 data:image/svg+xml SVG 源码图片
 * 解决未 URL 编码的 <svg> 尖括号与空格导致 marked 误判为内联 HTML 与破坏 image token 的问题
 */
export function processInlineSvgImages(markdown: string): string {
  if (!markdown || !markdown.includes('data:image/svg+xml')) {
    return markdown;
  }
  return markdown.replace(
    /!\[(.*?)\]\((data:image\/svg\+xml(?:;[a-zA-Z0-9_\-]+)*?,)(<svg[\s\S]*?<\/svg>)\)/gi,
    (match, alt, prefix, svg) => {
      const newlineCount = (match.match(/\n/g) || []).length;
      return `![${alt}](${prefix}${encodeURIComponent(svg)})${'\n'.repeat(newlineCount)}`;
    }
  );
}

function assignInnerTokenLines(token: any, startLine: number): void {
  if (!token || typeof token !== 'object') return;
  token._startLine = startLine;

  if (token.type === 'list' && Array.isArray(token.items)) {
    let itemRunningLine = startLine;
    for (const item of token.items) {
      item._startLine = itemRunningLine;
      if (Array.isArray(item.tokens)) {
        let subLine = itemRunningLine;
        for (const sub of item.tokens) {
          assignInnerTokenLines(sub, subLine);
          subLine += (sub.raw?.match(/\n/g) || []).length;
        }
      }
      const itemNewlines = (item.raw?.match(/\n/g) || []).length;
      itemRunningLine += itemNewlines;
    }
  } else if (token.type === 'blockquote' && Array.isArray(token.tokens)) {
    let subLine = startLine;
    for (const sub of token.tokens) {
      assignInnerTokenLines(sub, subLine);
      subLine += (sub.raw?.match(/\n/g) || []).length;
    }
  }
}

export function useMarkdownAstPipeline({
  content,
  files,
  locale,
  isDarkTheme = true,
}: UseMarkdownAstPipelineOptions) {
  const [blocks, setBlocks] = useState<RenderedBlock[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const okfData: OkfParseResult = useMemo(() => parseOkfFrontmatter(content), [content]);

  const filesRef = useRef(files);
  filesRef.current = files;
  const isFirstRender = useRef(true);
  const prevBlocksRef = useRef<RenderedBlock[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const delay = isFirstRender.current ? 0 : 150;
    isFirstRender.current = false;

    const parseAndRender = async () => {
      setIsRendering(true);
      const cleanBody = okfData.hasFrontmatter ? okfData.markdownBody : content;
      const frontmatterLines = okfData.hasFrontmatter
        ? (content.slice(0, content.length - cleanBody.length).match(/\n/g) || []).length
        : 0;

      // 流水线处理：emoji -> wiki -> def-lists -> footnotes -> inline-svg -> math
      const { markdown: bodyWithEmoji } = processEmojiShortcodes(cleanBody);
      const { markdown: bodyWithWiki } = processMarkdownWikiLinks(bodyWithEmoji, {
        files: filesRef.current || [],
        unresolvedLabel: t('wikiLinkUnresolved', locale),
        openLabel: t('wikiEmbedOpen', locale),
        embedLabel: t('wikiEmbedBadge', locale),
      });
      const { markdown: bodyWithDefLists } = processMarkdownDefinitionLists(bodyWithWiki);
      const { markdown: bodyWithFootnotes } = processMarkdownFootnotes(bodyWithDefLists, {
        sectionTitle: t('footnotes', locale),
      });
      const bodyWithSvg = processInlineSvgImages(bodyWithFootnotes);
      const { markdown: bodyWithMath, mathSlots } = processMarkdownMath(bodyWithSvg);

      const tokens = marked.lexer(bodyWithMath);
      const parsedBlocks: RenderedBlock[] = [];
      let counter = 0;
      let runningLine = frontmatterLines + 1;
      let currentTokenStartLine = runningLine;

      const customRenderer = new marked.Renderer();
      const origCode = customRenderer.code.bind(customRenderer);
      customRenderer.code = function (codeOrToken: any, infostring?: any, escaped?: any) {
        const code = typeof codeOrToken === 'object' && codeOrToken !== null ? codeOrToken.text : codeOrToken;
        const lang = typeof codeOrToken === 'object' && codeOrToken !== null ? codeOrToken.lang : infostring;
        const primaryLang = (lang || '').trim().split(/\s+/)[0].toLowerCase();

        if (
          primaryLang === 'echarts' ||
          primaryLang.startsWith('echarts:') ||
          primaryLang.startsWith('echarts-') ||
          primaryLang === 'chart'
        ) {
          const suffix = primaryLang.includes(':')
            ? primaryLang.split(':')[1]
            : primaryLang.includes('-')
            ? primaryLang.split('-')[1]
            : '';
          const encoded = encodeURIComponent(code);
          return `<div class="ov-echarts-inline-host" data-echarts-raw="${encoded}" data-suffix="${suffix}" data-source-line="${currentTokenStartLine}"></div>`;
        }
        return origCode(codeOrToken, infostring, escaped);
      };

      const origTable = customRenderer.table.bind(customRenderer);
      customRenderer.table = function (headerOrToken: any, body?: any) {
        const rendered = origTable(headerOrToken, body);
        return `<div class="ov-table-wrapper" data-source-line="${currentTokenStartLine}">${rendered}</div>`;
      };
      customRenderer.image = function (hrefOrToken: any, title?: any, text?: any) {
        const rawHref = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.href : hrefOrToken;
        const alt = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.text : text;
        const imgTitle = typeof hrefOrToken === 'object' && hrefOrToken !== null ? hrefOrToken.title : title;

        const parsed = parseMarkdownImageModifiers(alt || '', rawHref || '', imgTitle || '');
        const safeAlt = parsed.cleanAlt.replace(/"/g, '&quot;');
        const safeTitle = (imgTitle || '').replace(/"/g, '&quot;');
        const safeCaption = parsed.captionText.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const resolvedHref = resolveMarkdownImageHref(rawHref, filesRef.current);
        const containerClasses = ['ov-image-container', ...parsed.extraClasses].join(' ');
        const styleAttr = parsed.styleAttr ? ` style="${parsed.styleAttr}"` : '';
        const themeDataAttr = parsed.themeVisibility !== 'all' ? ` data-theme-mode="${parsed.themeVisibility}"` : '';
        const captionHtml = parsed.showCaption ? `<span class="ov-image-caption">${safeCaption}</span>` : '';

        return `<span class="${containerClasses}"${themeDataAttr}><img src="${resolvedHref}" alt="${safeAlt}" title="${safeTitle}"${styleAttr} decoding="async" onerror="this.classList.add('ov-img-broken');this.insertAdjacentHTML('afterend','<span class=\\'ov-image-fallback\\'>⚠️ ${t('imageNotFound', locale)}: <code>${rawHref}</code></span>');this.style.display='none';" />${captionHtml}</span>`;
      };

      const origHtml = customRenderer.html?.bind(customRenderer);
      customRenderer.html = function (tokenOrText: any) {
        let rawHtml = typeof tokenOrText === 'object' && tokenOrText !== null ? (tokenOrText.text || tokenOrText.raw || '') : tokenOrText;
        if (!rawHtml) return '';
        // 智能替换 HTML 中的 <img src="relative/path">
        if (/<img\s+[^>]*?src=["']/i.test(rawHtml)) {
          rawHtml = rawHtml.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi, (_match: string, prefix: string, src: string, suffix: string) => {
            const resolved = resolveMarkdownImageHref(src, filesRef.current);
            return `<img ${prefix}src="${resolved}"${suffix}>`;
          });
        }
        return origHtml ? origHtml(typeof tokenOrText === 'object' && tokenOrText !== null ? { ...tokenOrText, text: rawHtml, raw: rawHtml } : rawHtml) : rawHtml;
      };

      customRenderer.heading = function (headerOrToken: any, depth?: any) {
        let text = '';
        let level = depth || 1;
        const lineNum =
          typeof headerOrToken === 'object' && headerOrToken !== null && headerOrToken._startLine
            ? headerOrToken._startLine
            : currentTokenStartLine;
        if (typeof headerOrToken === 'object' && headerOrToken !== null) {
          level = headerOrToken.depth || 1;
          text = this.parser.parseInline(headerOrToken.tokens || []);
        } else {
          text = headerOrToken;
        }
        const slug = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || `h-${Math.random().toString(36).slice(2, 7)}`;
        return `<h${level} id="${slug}" data-source-line="${lineNum}">${text}</h${level}>\n`;
      };

      customRenderer.paragraph = function (tokenOrText: any) {
        let text = '';
        const lineNum =
          typeof tokenOrText === 'object' && tokenOrText !== null && tokenOrText._startLine
            ? tokenOrText._startLine
            : currentTokenStartLine;
        if (typeof tokenOrText === 'object' && tokenOrText !== null) {
          text = this.parser.parseInline(tokenOrText.tokens || []);
        } else {
          text = tokenOrText;
        }
        return `<p data-source-line="${lineNum}">${text}</p>\n`;
      };

      customRenderer.blockquote = function (tokenOrQuote: any) {
        if (typeof tokenOrQuote === 'object' && tokenOrQuote !== null && tokenOrQuote.tokens) {
          const quoteStartLine = tokenOrQuote._startLine || currentTokenStartLine;
          const firstToken = tokenOrQuote.tokens[0];
          if (firstToken && (firstToken.type === 'paragraph' || firstToken.type === 'text')) {
            const firstRaw = (firstToken.raw || firstToken.text || '').trimStart();
            const calloutMatch = firstRaw.match(
              /^\[!([a-zA-Z0-9_\-]+)(?::[ \t]*([1-6]|right|left))?(?:[ \t]+cols=([1-6])|[ \t]+([^\]\n]+))?\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n([\s\S]*))?$/i
            );
            if (calloutMatch) {
              const typeRaw = calloutMatch[1];
              const colParam = calloutMatch[2] || calloutMatch[3];
              const fold = calloutMatch[5];
              const customTitle = (calloutMatch[6] || calloutMatch[4] || '').trim();
              const remainingText = (calloutMatch[7] || '');
              const upperType = typeRaw.toUpperCase();

              const restTokens = [...tokenOrQuote.tokens];
              if (remainingText.trim()) {
                const innerTokens = marked.lexer(remainingText);
                let innerLine = (firstToken._startLine || quoteStartLine) + 1;
                for (const it of innerTokens) {
                  assignInnerTokenLines(it, innerLine);
                  innerLine += (it.raw?.match(/\n/g) || []).length;
                }
                restTokens.splice(0, 1, ...innerTokens);
              } else {
                restTokens.shift();
              }

              const bodyHtml = restTokens.length > 0 ? this.parser.parse(restTokens) : '';
              const isCollapsible = fold === '+' || fold === '-';
              const isOpen = fold !== '-';
              const chevronSvg = `<svg class="ov-callout-fold-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

              // 1. 多标签页组 (Tabs): [!TABS], [!TAB]
              if (upperType === 'TABS' || upperType === 'TAB') {
                const listToken = restTokens.find(t => t.type === 'list');
                if (listToken && (listToken as any).items?.length > 0) {
                  const tabs: Array<{ label: string; html: string }> = [];
                  for (const item of (listToken as any).items) {
                    let label = 'Tab';
                    const itemTokens = [...(item.tokens || [])];
                    const itemStart = item._startLine || quoteStartLine;
                    if (itemTokens.length > 0) {
                      const first = itemTokens[0];
                      if (first.type === 'text' || first.type === 'paragraph') {
                        const textStr = first.text || first.raw || '';
                        const lines = textStr.split('\n');
                        label = lines[0].replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '').trim() || 'Tab';
                        if (lines.length > 1 && lines.slice(1).join('\n').trim()) {
                          const restText = lines.slice(1).join('\n');
                          const lexed = marked.lexer(restText);
                          let subLine = itemStart + 1;
                          for (const lt of lexed) {
                            assignInnerTokenLines(lt, subLine);
                            subLine += (lt.raw?.match(/\n/g) || []).length;
                          }
                          itemTokens.splice(0, 1, ...lexed);
                        } else {
                          itemTokens.shift();
                        }
                      }
                    }
                    const html = itemTokens.length > 0 ? this.parser.parse(itemTokens) : '';
                    tabs.push({ label, html });
                  }

                  const titleHtml = customTitle
                    ? `<span class="ov-tab-group-title">${customTitle}</span>`
                    : '';
                  const navButtons = tabs.map((tab, idx) =>
                    `<button type="button" class="ov-tab-btn ${idx === 0 ? 'active' : ''}" data-tab-index="${idx}" role="tab" aria-selected="${idx === 0 ? 'true' : 'false'}">${tab.label}</button>`
                  ).join('');
                  const panels = tabs.map((tab, idx) =>
                    `<div class="ov-tab-panel ${idx === 0 ? 'active' : ''}" data-tab-index="${idx}" role="tabpanel" style="${idx === 0 ? '' : 'display:none;'}">${tab.html}</div>`
                  ).join('');

                  return `<div class="ov-tab-group" data-source-line="${quoteStartLine}"><div class="ov-tab-header-wrap">${titleHtml}<div class="ov-tab-nav" role="tablist">${navButtons}</div></div><div class="ov-tab-panels">${panels}</div></div>\n`;
                }
              }

              // 2. 步骤条 / 流程引导 (Steps): [!STEPS], [!STEP]
              if (upperType === 'STEPS' || upperType === 'STEP') {
                const stepsIcon = `<svg class="ov-steps-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-steps-header"><span class="ov-steps-title-left">${stepsIcon}<span class="ov-steps-title-text">${customTitle}</span></span></div>`
                  : '';
                return `<div class="ov-steps-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-steps-body">${bodyHtml}</div></div>\n`;
              }

              // 3. 时间线 / 里程碑 (Timeline): [!TIMELINE]
              if (upperType === 'TIMELINE') {
                const timeIcon = `<svg class="ov-timeline-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-timeline-header"><span class="ov-timeline-title-left">${timeIcon}<span class="ov-timeline-title-text">${customTitle}</span></span></div>`
                  : '';
                return `<div class="ov-timeline-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-timeline-body">${bodyHtml}</div></div>\n`;
              }

              // 4. 对比卡片 / 方案权衡 (Compare): [!COMPARE], [!DIFF]
              if (upperType === 'COMPARE' || upperType === 'DIFF') {
                const compareIcon = `<svg class="ov-compare-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="m21 3-7 7"></path><path d="M8 21H3v-5"></path><path d="m3 21 7-7"></path></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-compare-header"><span class="ov-compare-title-left">${compareIcon}<span class="ov-compare-title-text">${customTitle}</span></span></div>`
                  : '';
                return `<div class="ov-compare-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-compare-body">${bodyHtml}</div></div>\n`;
              }

              // 5. 数字 KPI 指标看板 (Metrics): [!METRICS], [!STATS], [!KPI]
              if (upperType === 'METRICS' || upperType === 'STATS' || upperType === 'KPI') {
                const metricsIcon = `<svg class="ov-metrics-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-metrics-header"><span class="ov-metrics-title-left">${metricsIcon}<span class="ov-metrics-title-text">${customTitle}</span></span></div>`
                  : '';
                return `<div class="ov-metrics-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-metrics-body">${bodyHtml}</div></div>\n`;
              }

              // 6. 问答手风琴 (FAQ): [!FAQ]
              if (upperType === 'FAQ') {
                const faqIcon = `<svg class="ov-faq-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-faq-header"><span class="ov-faq-title-left">${faqIcon}<span class="ov-faq-title-text">${customTitle}</span></span></div>`
                  : '';
                const listToken = restTokens.find(t => t.type === 'list');
                if (listToken && (listToken as any).items?.length > 0) {
                  const itemsHtml = (listToken as any).items.map((item: any, idx: number) => {
                    let q = `Q${idx + 1}`;
                    const itemTokens = [...(item.tokens || [])];
                    const itemStart = item._startLine || quoteStartLine;
                    if (itemTokens.length > 0) {
                      const first = itemTokens[0];
                      if (first.type === 'text' || first.type === 'paragraph') {
                        const textStr = first.text || first.raw || '';
                        const lines = textStr.split('\n');
                        q = lines[0].replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '').trim() || q;
                        if (lines.length > 1 && lines.slice(1).join('\n').trim()) {
                          const restText = lines.slice(1).join('\n');
                          const lexed = marked.lexer(restText);
                          let subLine = itemStart + 1;
                          for (const lt of lexed) {
                            assignInnerTokenLines(lt, subLine);
                            subLine += (lt.raw?.match(/\n/g) || []).length;
                          }
                          itemTokens.splice(0, 1, ...lexed);
                        } else {
                          itemTokens.shift();
                        }
                      }
                    }
                    const ansHtml = itemTokens.length > 0 ? this.parser.parse(itemTokens) : '';
                    return `<details class="ov-faq-item" data-source-line="${itemStart}"><summary class="ov-faq-q"><span class="ov-faq-q-text">${q}</span><svg class="ov-faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></summary><div class="ov-faq-a">${ansHtml}</div></details>`;
                  }).join('');
                  return `<div class="ov-faq-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-faq-body">${itemsHtml}</div></div>\n`;
                }
                return `<div class="ov-faq-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-faq-body">${bodyHtml}</div></div>\n`;
              }

              // 7. 引言卡片墙 (Quotes): [!QUOTES], [!QUOTE-WALL]
              if (upperType === 'QUOTES' || upperType === 'QUOTE-WALL') {
                const titleHtml = customTitle
                  ? `<div class="ov-quotes-header"><span class="ov-quotes-title-text">${customTitle}</span></div>`
                  : '';
                return `<div class="ov-quotes-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-quotes-body">${bodyHtml}</div></div>\n`;
              }

              // 8. 宣传横幅 / 首屏推荐 (Banner / Hero): [!BANNER], [!HERO]
              if (upperType === 'BANNER' || upperType === 'HERO') {
                const bannerIcon = `<svg class="ov-banner-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-banner-header"><span class="ov-banner-title-left">${bannerIcon}<span class="ov-banner-title-text">${customTitle}</span></span></div>`
                  : '';
                return `<div class="ov-banner-container" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-banner-body">${bodyHtml}</div></div>\n`;
              }

              // 9. 多图画廊网格 (Gallery / Image Grid): [!GALLERY], [!GALLERY:2~6], [!IMAGES], [!PHOTO-GRID]
              if (upperType === 'GALLERY' || upperType === 'IMAGES' || upperType === 'PHOTO-GRID') {
                const cols = colParam && /^[1-6]$/.test(colParam) ? Math.min(6, Math.max(1, parseInt(colParam, 10))) : 3;
                const galleryIcon = `<svg class="ov-gallery-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
                const titleHtml = customTitle
                  ? `<span class="ov-gallery-title-left">${galleryIcon}<span class="ov-gallery-title-text">${customTitle}</span></span>`
                  : '';
                const galleryBodyHtml = injectAutoImageCaptions(bodyHtml);

                if (isCollapsible) {
                  return `<details class="ov-gallery-container" ${isOpen ? 'open' : ''} data-source-line="${quoteStartLine}"><summary class="ov-gallery-header">${titleHtml}${chevronSvg}</summary><div class="ov-gallery-grid ov-gallery-cols-${cols}" style="--ov-gallery-cols: ${cols};" data-cols="${cols}"><div class="ov-gallery-body">${galleryBodyHtml}</div></div></details>\n`;
                }

                const headerBlock = customTitle ? `<div class="ov-gallery-header">${titleHtml}</div>` : '';
                return `<div class="ov-gallery-container" data-source-line="${quoteStartLine}"><div class="ov-gallery-grid ov-gallery-cols-${cols}" style="--ov-gallery-cols: ${cols};" data-cols="${cols}">${headerBlock}<div class="ov-gallery-body">${galleryBodyHtml}</div></div></div>\n`;
              }

              // 10. 标准技术图件框 (Figure): [!FIGURE], [!FIG]
              if (upperType === 'FIGURE' || upperType === 'FIG') {
                const figIcon = `<svg class="ov-figure-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
                const figureBodyHtml = customTitle ? bodyHtml : injectAutoImageCaptions(bodyHtml);
                const captionBlock = customTitle
                  ? `<figcaption class="ov-figure-caption">${figIcon}<span class="ov-figure-caption-text">${customTitle}</span></figcaption>`
                  : '';

                if (isCollapsible) {
                  const summaryTitle = customTitle || (locale === 'zh-CN' ? '技术图件 (Figure)' : 'Figure');
                  return `<details class="ov-figure-container" ${isOpen ? 'open' : ''} data-source-line="${quoteStartLine}"><summary class="ov-figure-header"><span class="ov-figure-title-left">${figIcon}<span class="ov-figure-caption-text">${summaryTitle}</span></span>${chevronSvg}</summary><div class="ov-figure-stage">${figureBodyHtml}</div></details>\n`;
                }

                return `<figure class="ov-figure-container" data-source-line="${quoteStartLine}"><div class="ov-figure-stage">${figureBodyHtml}</div>${captionBlock}</figure>\n`;
              }

              // 11. 图文并排分栏 (Media Split): [!MEDIA], [!MEDIA:RIGHT], [!MEDIA-RIGHT], [!MEDIA:LEFT], [!MEDIA-LEFT]
              if (upperType === 'MEDIA' || upperType === 'MEDIA-RIGHT' || upperType === 'MEDIA-LEFT') {
                const isRight = upperType === 'MEDIA-RIGHT' || (colParam && colParam.toUpperCase() === 'RIGHT');
                const mediaIcon = `<svg class="ov-media-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M12 3v18"></path></svg>`;
                const titleHtml = customTitle
                  ? `<div class="ov-media-header"><span class="ov-media-title-left">${mediaIcon}<span class="ov-media-title-text">${customTitle}</span></span></div>`
                  : '';
                const dirClass = isRight ? ' ov-media-reverse' : '';
                return `<div class="ov-media-container${dirClass}" data-source-line="${quoteStartLine}">${titleHtml}<div class="ov-media-body">${bodyHtml}</div></div>\n`;
              }

              // 卡片矩阵网格 (Card Grid): [!CARDS], [!CARDS:3], [!CARDS:4], [!CARDS:6], [!CARD-GRID], [!GRID]
              if (upperType === 'CARDS' || upperType === 'CARD-GRID' || upperType === 'GRID') {
                const cols = colParam && /^[1-6]$/.test(colParam) ? Math.min(6, Math.max(1, parseInt(colParam, 10))) : 3;
                const gridIcon = `<svg class="ov-card-grid-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
                const titleHtml = customTitle
                  ? `<span class="ov-card-grid-title-left">${gridIcon}<span class="ov-card-grid-title-text">${customTitle}</span></span>`
                  : '';

                if (isCollapsible) {
                  return `<details class="ov-card-grid-container" ${isOpen ? 'open' : ''} data-source-line="${quoteStartLine}"><summary class="ov-card-grid-header">${titleHtml}${chevronSvg}</summary><div class="ov-card-grid ov-cards-cols-${cols}" style="--ov-card-cols: ${cols};" data-cols="${cols}"><div class="ov-card-grid-body">${bodyHtml}</div></div></details>\n`;
                }

                const headerBlock = customTitle ? `<div class="ov-card-grid-header">${titleHtml}</div>` : '';
                return `<div class="ov-card-grid-container" data-source-line="${quoteStartLine}"><div class="ov-card-grid ov-cards-cols-${cols}" style="--ov-card-cols: ${cols};" data-cols="${cols}">${headerBlock}<div class="ov-card-grid-body">${bodyHtml}</div></div></div>\n`;
              }

              // 单体卡片 (Single Card): [!CARD]
              if (upperType === 'CARD') {
                const cardIcon = `<svg class="ov-card-single-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
                const titleHtml = customTitle
                  ? `<span class="ov-card-single-title-left">${cardIcon}<span class="ov-card-single-title-text">${customTitle}</span></span>`
                  : '';

                if (isCollapsible) {
                  return `<details class="ov-card-single" ${isOpen ? 'open' : ''} data-source-line="${quoteStartLine}"><summary class="ov-card-single-header">${titleHtml}${chevronSvg}</summary><div class="ov-card-single-body">${bodyHtml}</div></details>\n`;
                }

                const headerBlock = customTitle ? `<div class="ov-card-single-header">${titleHtml}</div>` : '';
                return `<div class="ov-card-single" data-source-line="${quoteStartLine}">${headerBlock}<div class="ov-card-single-body">${bodyHtml}</div></div>\n`;
              }

              // 标准 / 扩展 Callout 语义提醒块
              const meta = getCalloutMeta(typeRaw, locale) || {
                type: typeRaw.toLowerCase(),
                title: customTitle || typeRaw.toUpperCase(),
                colorClass: `ov-callout-${typeRaw.toLowerCase()}`,
                icon: `<svg class="ov-callout-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
              };

              const displayTitle = customTitle || meta.title;

              if (isCollapsible) {
                return `<details class="ov-callout ${meta.colorClass}" data-callout="${meta.type}" ${isOpen ? 'open' : ''} data-source-line="${quoteStartLine}"><summary class="ov-callout-title"><span class="ov-callout-title-left">${meta.icon}<span class="ov-callout-title-text">${displayTitle}</span></span>${chevronSvg}</summary><div class="ov-callout-body">${bodyHtml}</div></details>\n`;
              }

              return `<div class="ov-callout ${meta.colorClass}" data-callout="${meta.type}" data-source-line="${quoteStartLine}"><div class="ov-callout-title"><span class="ov-callout-title-left">${meta.icon}<span class="ov-callout-title-text">${displayTitle}</span></span></div><div class="ov-callout-body">${bodyHtml}</div></div>\n`;
            }
          }
          const body = this.parser.parse(tokenOrQuote.tokens);
          return `<blockquote data-source-line="${quoteStartLine}">${body}</blockquote>\n`;
        }
        return `<blockquote data-source-line="${currentTokenStartLine}">${tokenOrQuote}</blockquote>\n`;
      };

      const origList = customRenderer.list.bind(customRenderer);
      customRenderer.list = function (tokenOrBody: any, ordered?: boolean, start?: number) {
        if (typeof tokenOrBody === 'object' && tokenOrBody !== null && 'ordered' in tokenOrBody) {
          const isOrdered = Boolean(tokenOrBody.ordered);
          const startNum = tokenOrBody.start;
          const listLine = tokenOrBody._startLine || currentTokenStartLine;
          const tag = isOrdered ? 'ol' : 'ul';
          const hasTask = Array.isArray(tokenOrBody.items) && tokenOrBody.items.some((it: any) => it.task);
          let body = '';
          for (let i = 0; i < tokenOrBody.items.length; i++) {
            body += this.listitem(tokenOrBody.items[i]);
          }
          const startAttr = isOrdered && typeof startNum === 'number' && startNum !== 1 ? ` start="${startNum}"` : '';
          const taskClass = hasTask ? ' ov-task-list' : '';
          const listClass = isOrdered ? `ov-ordered-list${taskClass}` : `ov-unordered-list${taskClass}`;
          return `<${tag} class="${listClass}"${startAttr} data-source-line="${listLine}">\n${body}</${tag}>\n`;
        }
        const isOrdered = typeof ordered === 'boolean' ? ordered : false;
        const tag = isOrdered ? 'ol' : 'ul';
        const startAttr = isOrdered && typeof start === 'number' && start !== 1 ? ` start="${start}"` : '';
        const listClass = isOrdered ? 'ov-ordered-list' : 'ov-unordered-list';
        return `<${tag} class="${listClass}"${startAttr} data-source-line="${currentTokenStartLine}">\n${tokenOrBody}</${tag}>\n`;
      };

      const origListitem = customRenderer.listitem.bind(customRenderer);
      customRenderer.listitem = function (itemOrText: any, task?: boolean, checked?: boolean) {
        if (typeof itemOrText === 'object' && itemOrText !== null) {
          const isTask = itemOrText.task;
          const isChecked = itemOrText.checked;
          const itemLine = itemOrText._startLine || currentTokenStartLine;
          const prevStartLine = currentTokenStartLine;
          currentTokenStartLine = itemLine;
          let body = this.parser.parse(itemOrText.tokens || []);
          currentTokenStartLine = prevStartLine;
          if (isTask) {
            body = body.replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, '').trim();
            const checkboxHtml = `<input type="checkbox" class="ov-task-checkbox" data-task-line="${itemLine}" ${isChecked ? 'checked' : ''} aria-label="${isChecked ? 'Mark incomplete' : 'Mark complete'}" title="${t('taskToggleTooltip', locale)}" />`;
            return `<li class="ov-task-list-item ${isChecked ? 'ov-task-done' : ''}" data-task-line="${itemLine}" data-source-line="${itemLine}" data-checked="${isChecked ? 'true' : 'false'}"><label class="ov-task-label">${checkboxHtml}<span class="ov-task-text">${body}</span></label></li>\n`;
          }
          return `<li data-source-line="${itemLine}">${body}</li>\n`;
        }
        return origListitem(itemOrText, task, checked);
      };

      const renderHtmlToken = (token: any, startLine: number, endLine: number) => {
        if (token.type === 'space') return;
        currentTokenStartLine = startLine;
        const startTime = typeof performance !== 'undefined' ? performance.now() : 0;
        const html = marked.parser([token], { renderer: customRenderer });
        const htmlWithMath = restoreMarkdownMath(html, mathSlots);
        if (!htmlWithMath.trim()) return;
        const duration = typeof performance !== 'undefined' ? performance.now() - startTime : 0;
        const blockId = `block-html-${counter++}`;
        renderTimeBudgetRegistry.recordTime(blockId, 'html', duration, startLine, endLine);

        parsedBlocks.push({
          id: blockId,
          type: 'html',
          raw: token.raw,
          startLine,
          endLine,
          renderedHtml: sanitizeDiagramHtml(htmlWithMath),
        });
      };

      for (const token of tokens) {
        const tokenNewlines = (token.raw.match(/\n/g) || []).length;
        const addedLinesMatch =
          token.type === 'code' && typeof (token as any).lang === 'string'
            ? (token as any).lang.match(/\baddedLines="(\d+)"/)
            : null;
        const addedLines = addedLinesMatch ? parseInt(addedLinesMatch[1], 10) : 0;
        const effectiveNewlines = Math.max(0, tokenNewlines - addedLines);
        let tokenStartLine = runningLine;
        let tokenEndLine =
          addedLines > 0
            ? tokenStartLine + Math.max(0, effectiveNewlines - (token.raw.endsWith('\n') ? 1 : 0))
            : token.raw.endsWith('\n')
            ? tokenStartLine + Math.max(0, effectiveNewlines - 1)
            : tokenStartLine + effectiveNewlines;
        runningLine += effectiveNewlines;

        if (token.type === 'html' && typeof token.raw === 'string') {
          const deflistMatch = token.raw.match(/\bdata-deflist-lines="(\d+)"/);
          if (deflistMatch) {
            tokenEndLine = tokenStartLine + Math.max(0, parseInt(deflistMatch[1], 10) - 1);
          }
          const fnStartMatch = token.raw.match(/\bdata-footnote-start-line="(\d+)"/);
          const fnEndMatch = token.raw.match(/\bdata-footnote-end-line="(\d+)"/);
          if (fnStartMatch && fnEndMatch) {
            tokenStartLine = frontmatterLines + parseInt(fnStartMatch[1], 10);
            tokenEndLine = frontmatterLines + parseInt(fnEndMatch[1], 10);
          }
        }

        assignInnerTokenLines(token, tokenStartLine);

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
          let externalFile: string | undefined;
          if (token.lang) {
            const match = token.lang.match(/external="([^"]+)"|external='([^']+)'|external=(\S+)/);
            if (match) {
              try {
                externalFile = decodeURIComponent(match[1] || match[2] || match[3]);
              } catch {
                externalFile = match[1] || match[2] || match[3];
              }
            }
          }

          if (['mermaid'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-mermaid-${counter++}`,
              type: 'mermaid',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['plantuml', 'puml'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-plantuml-${counter++}`,
              type: 'plantuml',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['dot', 'graphviz'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-graphviz-${counter++}`,
              type: 'graphviz',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (primaryLang === 'svg' || (primaryLang === 'xml' && token.text.includes('<svg'))) {
            const sanitized = sanitizeDiagramSvg(token.text);
            parsedBlocks.push({
              id: `block-svg-${counter++}`,
              type: 'svg',
              mode: 'code-block',
              raw: token.text,
              svgContent: sanitized,
              title: locale === 'zh-CN' ? 'SVG 矢量代码' : 'SVG Vector Code',
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['math', 'katex', 'latex'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-math-${counter++}`,
              type: 'math',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['domainstory', 'story', 'egn', 'dst'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-domainstory-${counter++}`,
              type: 'domainstory',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (['markmap', 'mm', 'mindmap'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-markmap-${counter++}`,
              type: 'markmap',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else if (
            primaryLang === 'echarts' ||
            primaryLang.startsWith('echarts:') ||
            primaryLang.startsWith('echarts-') ||
            primaryLang === 'chart'
          ) {
            const suffixMatch = primaryLang.match(/^(?:echarts[:\-]([a-z0-9_-]+)|chart)$/i);
            const langSuffix = suffixMatch && suffixMatch[1] ? suffixMatch[1] : undefined;
            parsedBlocks.push({
              id: `block-echarts-${counter++}`,
              type: 'echarts',
              raw: token.text,
              langSuffix,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          } else {
            parsedBlocks.push({
              id: `block-code-${counter++}`,
              type: 'code',
              lang: primaryLang || 'text',
              raw: token.text,
              externalFile,
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          }
        } else if (
          token.type === 'paragraph' &&
          token.text &&
          (/^(?:%%OV_MATH_BLOCK_\d+%%\s*)+$/.test(token.text.trim()) ||
            (token.text.trim().startsWith('$$') &&
              token.text.trim().endsWith('$$') &&
              token.text.trim().length >= 4 &&
              !token.text.trim().slice(2, -2).includes('$$')))
        ) {
          const blockMatches = [...token.text.trim().matchAll(/%%OV_MATH_BLOCK_(\d+)%%/g)];
          if (blockMatches.length > 0) {
            let subStartLine = tokenStartLine;
            for (const m of blockMatches) {
              const slot = mathSlots[Number(m[1])];
              const subNewlines = slot?.newlines ?? 0;
              const subEndLine = subStartLine + subNewlines;
              parsedBlocks.push({
                id: `block-math-${counter++}`,
                type: 'math',
                raw: slot?.formula || '',
                startLine: subStartLine,
                endLine: Math.min(tokenEndLine, subEndLine),
              });
              subStartLine = subEndLine + 1;
            }
          } else {
            parsedBlocks.push({
              id: `block-math-${counter++}`,
              type: 'math',
              raw: token.text.trim().slice(2, -2).trim(),
              startLine: tokenStartLine,
              endLine: tokenEndLine,
            });
          }
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
            (f) =>
              f.name === cleanSrc ||
              f.name.toLowerCase() === cleanSrc.toLowerCase() ||
              (f.path && f.path.replace(/^\//, '') === cleanSrc) ||
              (f.path && f.path.replace(/\\/g, '/').endsWith(`/${relativeSrc}`)) ||
              (relativeSrc === 'system-architecture.svg' && f.name === 'cloud-infrastructure.svg')
          );

          if (matchedFile && matchedFile.extension.toLowerCase() === 'svg') {
            const sanitized = sanitizeDiagramSvg(matchedFile.content);
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
          const restoredHeader = (tableToken.header || []).map((h: any) =>
            typeof h === 'object' && h !== null
              ? { ...h, text: restoreRawMathInText(h.text || '', mathSlots) }
              : h
          );
          const restoredRows = (tableToken.rows || []).map((row: unknown) => ({
            cells: Array.isArray(row)
              ? row.map((c: any) =>
                  typeof c === 'object' && c !== null
                    ? { ...c, text: restoreRawMathInText(c.text || '', mathSlots) }
                    : restoreRawMathInText(String(c ?? ''), mathSlots)
                )
              : [],
          }));
          parsedBlocks.push({
            id: `block-table-${counter++}`,
            type: 'table',
            raw: restoreRawMathInText(token.raw, mathSlots),
            tableData: {
              header: restoredHeader,
              rows: restoredRows,
              align: tableToken.align || [],
            },
            startLine: tokenStartLine,
            endLine: tokenEndLine,
          });
        } else {
          renderHtmlToken(token, tokenStartLine, tokenEndLine);
        }
      }

      for (const block of parsedBlocks) {
        if (block.type === 'plantuml') {
          block.renderedHtml = getPlantUmlSvgUrl(block.raw, undefined, isDarkTheme);
        }
        // 计算内容指纹，用于增量 Diff 与引用稳定化
        block.contentHash = fastFnv1a(
          `${block.type}:${block.raw}:${block.renderedHtml || ''}:${block.svgContent || ''}`
        );
      }

      if (!isCancelled) {
        // 增量引用稳定化：对内容未发生改变的块，复用前一次渲染的同一个对象引用，彻底阻断子树无效重渲染
        const prevBlocks = prevBlocksRef.current;
        const prevHashMap = new Map<string, RenderedBlock>();
        for (const pb of prevBlocks) {
          if (pb.contentHash) {
            prevHashMap.set(`${pb.id}:${pb.contentHash}`, pb);
          }
        }

        const reconciledBlocks = parsedBlocks.map((cur) => {
          if (!cur.contentHash) return cur;
          const matched = prevHashMap.get(`${cur.id}:${cur.contentHash}`);
          if (
            matched &&
            matched.startLine === cur.startLine &&
            matched.endLine === cur.endLine
          ) {
            return matched;
          }
          return cur;
        });

        prevBlocksRef.current = reconciledBlocks;
        setBlocks(reconciledBlocks);
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
  }, [content, okfData, locale, isDarkTheme]);

  return {
    blocks,
    okfData,
    isRendering,
  };
}
