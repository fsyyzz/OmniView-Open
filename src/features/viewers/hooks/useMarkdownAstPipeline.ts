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
import { processEmojiShortcodes } from '../lib/markdownEmojiShortcodes';
import { getPlantUmlSvgUrl } from '../../../shared/lib/plantuml';
import { type Locale, t } from '../../../shared/lib/i18n';
import { sanitizeDiagramSvg, sanitizeDiagramHtml } from '../lib/diagramSanitizer';
import { fastFnv1a } from '../lib/diagramCache';

export interface RenderedBlock {
  id: string;
  type: 'html' | 'code' | 'mermaid' | 'plantuml' | 'svg' | 'math' | 'graphviz' | 'table' | 'pagebreak' | 'domainstory' | 'markmap' | 'excalidraw';
  mode?: 'code-block' | 'file';
  lang?: string;
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
  files: Array<{ name: string; content: string; extension: string; path?: string }>;
  locale: Locale;
  isDarkTheme?: boolean;
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

      // 流水线处理：emoji -> wiki -> def-lists -> footnotes
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

      const tokens = marked.lexer(bodyWithFootnotes);
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
            body = body.replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, '').trim();
            const checkboxHtml = `<input type="checkbox" class="ov-task-checkbox" data-task-line="${itemLine}" ${isChecked ? 'checked' : ''} aria-label="${isChecked ? 'Mark incomplete' : 'Mark complete'}" title="${t('taskToggleTooltip', locale)}" />`;
            return `<li class="ov-task-list-item ${isChecked ? 'ov-task-done' : ''}" data-task-line="${itemLine}" data-checked="${isChecked ? 'true' : 'false'}"><label class="ov-task-label">${checkboxHtml}<span class="ov-task-text">${body}</span></label></li>\n`;
          }
          return `<li data-source-line="${itemLine}">${body}</li>\n`;
        }
        return origListitem(itemOrText, task, checked);
      };

      const renderKatexInHtml = (rawHtml: string): string => {
        let res = rawHtml.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
          try {
            return `<div class="ov-katex-block">${katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false, errorColor: '#f43f5e' })}</div>`;
          } catch {
            return _match;
          }
        });
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
          renderedHtml: sanitizeDiagramHtml(htmlWithMath),
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
          } else if (['excalidraw', 'excalidraw-embed'].includes(primaryLang)) {
            parsedBlocks.push({
              id: `block-excalidraw-${counter++}`,
              type: 'excalidraw',
              raw: token.text,
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
