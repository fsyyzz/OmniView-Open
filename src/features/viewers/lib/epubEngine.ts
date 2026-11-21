/**
 * OmniView 原生 EPUB 电子书轻量化解析与排版引擎 (EpubEngine)
 * 基于 JSZip 纯前端零外部体积无缝解析
 * 遵循 IDPF EPUB 2.0 / 3.0 Open Container Format (OCF) 标准
 * 支持浏览器 Webview 环境 (DOMParser) 与 Node.js 运行环境 (双模适配)
 */
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

export interface EpubMetadata {
  title: string;
  creator: string;
  identifier: string;
  language: string;
  description: string;
  publisher: string;
  publicationDate: string;
  coverDataUrl?: string;
  totalChapters: number;
}

export interface EpubTocItem {
  id: string;
  label: string;
  href: string;
  order: number;
  subitems?: EpubTocItem[];
}

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  htmlContent: string;
  order: number;
}

export interface ParsedEpubBook {
  metadata: EpubMetadata;
  toc: EpubTocItem[];
  chapters: EpubChapter[];
  opfDir: string;
}

export interface EpubSearchResult {
  chapterIndex: number;
  chapterTitle: string;
  matchOrdinal: number;
  snippet: string;
}

/**
 * 路径归一化帮助函数，解析相对于 baseDir 的绝对 ZIP 内部路径
 */
function resolveZipPath(baseDir: string, relativePath: string): string {
  if (!baseDir || relativePath.startsWith('/')) {
    return relativePath.replace(/^\/+/, '');
  }
  const parts = (baseDir.replace(/\/+$/, '') + '/' + relativePath).split('/');
  const resolvedParts: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }
  return resolvedParts.join('/');
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveEpubHref(basePath: string, href: string): string {
  const hashIndex = href.indexOf('#');
  const pathAndQuery = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : href.slice(hashIndex);
  const queryIndex = pathAndQuery.indexOf('?');
  const path = queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  if (!path) return `${basePath}${fragment}`;
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : '';
  return `${resolveZipPath(baseDir, safeDecodeURIComponent(path))}${fragment}`;
}

function resolveEpubPathSafe(baseDir: string, relativePath: string): string {
  const decoded = safeDecodeURIComponent(relativePath.split(/[?#]/)[0]);
  return resolveZipPath(baseDir, decoded);
}

function flattenToc(items: EpubTocItem[]): EpubTocItem[] {
  return items.flatMap(item => [item, ...flattenToc(item.subitems || [])]);
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function rewriteInternalLinks(html: string, chapterPath: string): string {
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    const href = extractAttribute(tag, 'href');
    if (!href || /^(?:https?:|mailto:|tel:|data:|\/\/|javascript:|file:)/i.test(href)) return tag;
    const target = resolveEpubHref(chapterPath, href);
    const safeTarget = escapeHtmlAttribute(target);
    const withDataTarget = /\bdata-epub-href\s*=/i.test(tag)
      ? tag.replace(/\bdata-epub-href\s*=\s*(["'])[^"']*\1/i, `data-epub-href="${safeTarget}"`)
      : tag.replace(/>$/, ` data-epub-href="${safeTarget}">`);
    return withDataTarget.replace(/\bhref\s*=\s*(["'])[^"']*\1/i, 'href="#"');
  });
}

/**
 * 将 Base64 或 Data URL 转换为 Uint8Array
 */
export function base64ToBytes(base64OrDataUrl: string): Uint8Array {
  const cleanBase64 = base64OrDataUrl.includes(',')
    ? base64OrDataUrl.split(',')[1]
    : base64OrDataUrl;
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(cleanBase64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Buffer.from(cleanBase64, 'base64');
}

/**
 * 提取 XML 属性值
 */
function extractAttribute(tagStr: string, attrName: string): string | null {
  const match = tagStr.match(new RegExp(`${attrName}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

/**
 * 提取 XML 标签内部文本
 */
function extractTagContent(xml: string, tagName: string): string {
  // 支持 dc:title 以及 title
  const match = xml.match(new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, value: string) => {
    const lower = value.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    const codePoint = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

function textFromMarkup(markup: string): string {
  return decodeXmlEntities(markup.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

interface ElementBlock {
  openingTag: string;
  inner: string;
  end: number;
}

function extractElementBlock(source: string, tagName: string, fromIndex = 0): ElementBlock | null {
  const openTagRegex = new RegExp(`<${tagName}\\b[^>]*>`, 'ig');
  openTagRegex.lastIndex = fromIndex;
  const opening = openTagRegex.exec(source);
  if (!opening) return null;

  const tokenRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'ig');
  tokenRegex.lastIndex = opening.index;
  let depth = 0;
  let token: RegExpExecArray | null;
  while ((token = tokenRegex.exec(source)) !== null) {
    if (/^<\//.test(token[0])) {
      depth -= 1;
      if (depth === 0) {
        return {
          openingTag: opening[0],
          inner: source.slice(openTagRegex.lastIndex, token.index),
          end: tokenRegex.lastIndex,
        };
      }
    } else if (!/\/>$/.test(token[0])) {
      depth += 1;
    }
  }
  return null;
}

function extractTopLevelElements(source: string, tagName: string): ElementBlock[] {
  const blocks: ElementBlock[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const block = extractElementBlock(source, tagName, cursor);
    if (!block) break;
    blocks.push(block);
    cursor = block.end;
  }
  return blocks;
}

function parseNavList(
  listMarkup: string,
  basePath: string,
  nextOrder: () => number
): EpubTocItem[] {
  return extractTopLevelElements(listMarkup, 'li').flatMap((li) => {
    const anchor = /<(?:a|span)\b([^>]*)>([\s\S]*?)<\/(?:a|span)>/i.exec(li.inner);
    const href = anchor ? extractAttribute(anchor[1], 'href') : null;
    const label = anchor ? textFromMarkup(anchor[2]) : '';
    const order = nextOrder();
    const childList = extractElementBlock(li.inner, 'ol');
    const subitems = childList ? parseNavList(childList.inner, basePath, nextOrder) : [];
    if (!label || (!href && subitems.length === 0)) return subitems;

    return [{
      id: anchor ? extractAttribute(anchor[1], 'id') || `nav-${order}` : `nav-${order}`,
      label,
      href: href ? resolveEpubHref(basePath, href) : '',
      order,
      ...(subitems.length > 0 ? { subitems } : {}),
    }];
  });
}

function parseEpub3Nav(navXhtml: string, navPath: string): EpubTocItem[] {
  const navRegex = /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
  let navMatch: RegExpExecArray | null;
  let fallback: string | null = null;
  while ((navMatch = navRegex.exec(navXhtml)) !== null) {
    const navType = `${extractAttribute(navMatch[1], 'epub:type') || ''} ${extractAttribute(navMatch[1], 'role') || ''}`.toLowerCase();
    if (!fallback && /<ol\b/i.test(navMatch[2])) fallback = navMatch[2];
    if (/(^|\s)toc($|\s)|doc-toc/.test(navType)) {
      const list = extractElementBlock(navMatch[2], 'ol');
      if (list) {
        let order = 0;
        return parseNavList(list.inner, navPath, () => ++order);
      }
    }
  }
  if (!fallback) return [];
  const list = extractElementBlock(fallback, 'ol');
  if (!list) return [];
  let order = 0;
  return parseNavList(list.inner, navPath, () => ++order);
}

function parseNcxToc(ncxXml: string, ncxPath: string): EpubTocItem[] {
  const navMap = extractElementBlock(ncxXml, 'navMap');
  if (!navMap) return [];
  let order = 0;
  const parsePoints = (content: string): EpubTocItem[] =>
    extractTopLevelElements(content, 'navPoint').flatMap((point) => {
      const itemOrder = ++order;
      const navLabel = extractElementBlock(point.inner, 'navLabel');
      const contentTag = /<content\b([^>]*)\/?>/i.exec(point.inner);
      const src = contentTag ? extractAttribute(contentTag[1], 'src') : null;
      const nested = parsePoints(point.inner);
      const label = navLabel ? extractTagContent(navLabel.inner, 'text') : '';
      if (!label || !src) return nested;
      return [{
        id: extractAttribute(point.openingTag, 'id') || `ncx-${itemOrder}`,
        label: decodeXmlEntities(label),
        href: resolveEpubHref(ncxPath, src),
        order: itemOrder,
        ...(nested.length > 0 ? { subitems: nested } : {}),
      }];
    });
  return parsePoints(navMap.inner);
}

function mimeTypeForPath(path: string, declaredType = ''): string {
  if (declaredType) return declaredType;
  const extension = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    css: 'text/css',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    avif: 'image/avif',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
  };
  return (extension && types[extension]) || 'application/octet-stream';
}

async function inlineCssResources(
  css: string,
  stylesheetPath: string,
  zip: JSZip,
  depth = 0
): Promise<string> {
  if (depth > 3) return '';

  const imports = Array.from(css.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/gi));
  for (const match of imports.reverse()) {
    const href = match[1].trim();
    let replacement = '';
    if (!/^(?:https?:|data:|\/\/|#)/i.test(href)) {
      const importPath = resolveEpubHref(stylesheetPath, href).split('#')[0];
      const importFile = zip.file(importPath);
      if (importFile) {
        replacement = await inlineCssResources(await importFile.async('text'), importPath, zip, depth + 1);
      }
    }
    css = css.slice(0, match.index) + replacement + css.slice((match.index || 0) + match[0].length);
  }

  const urls = Array.from(css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi));
  for (const match of urls.reverse()) {
    const href = (match[2] || match[3] || '').trim();
    let replacement = 'url("")';
    if (/^(?:data:|#)/i.test(href)) {
      replacement = `url("${href.replace(/["\\\n\r]/g, '')}")`;
    } else if (!/^(?:https?:|\/\/|javascript:|file:)/i.test(href)) {
      const resourcePath = resolveEpubHref(stylesheetPath, href.split(/[?#]/)[0]);
      const resource = zip.file(resourcePath);
      if (resource) {
        const base64 = await resource.async('base64');
        replacement = `url("data:${mimeTypeForPath(resourcePath)};base64,${base64}")`;
      }
    }
    css = css.slice(0, match.index) + replacement + css.slice((match.index || 0) + match[0].length);
  }
  return css;
}

function scopeEpubStyles(css: string): string {
  const fontFaceRules: string[] = [];
  const scopedRules = css.replace(/@font-face\s*{[^{}]*}/gi, rule => {
    fontFaceRules.push(rule);
    return '';
  });
  return `${fontFaceRules.join('\n')}\n@scope (.epub-rendered-content) {\n${scopedRules}\n}`;
}

function plainTextFromHtml(html: string): string {
  return decodeXmlEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, '')
  );
}

export function searchEpubBook(
  book: ParsedEpubBook,
  query: string,
  maxResults = 200
): EpubSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery || maxResults <= 0) return [];
  const results: EpubSearchResult[] = [];

  for (const [chapterIndex, chapter] of book.chapters.entries()) {
    const text = plainTextFromHtml(chapter.htmlContent);
    const normalizedText = text.toLocaleLowerCase();
    let fromIndex = 0;
    let matchOrdinal = 0;
    while (results.length < maxResults) {
      const matchIndex = normalizedText.indexOf(normalizedQuery, fromIndex);
      if (matchIndex === -1) break;
      matchOrdinal += 1;
      const start = Math.max(0, matchIndex - 48);
      const end = Math.min(text.length, matchIndex + normalizedQuery.length + 72);
      results.push({
        chapterIndex,
        chapterTitle: chapter.title,
        matchOrdinal,
        snippet: `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`,
      });
      fromIndex = matchIndex + Math.max(1, normalizedQuery.length);
    }
    if (results.length >= maxResults) break;
  }
  return results;
}

/**
 * 安全 HTML 清洗器 (浏览器走 DOMPurify，Node 走正则过滤)
 */
function sanitizeHtml(html: string): string {
  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    try {
      return DOMPurify.sanitize(html, {
        ADD_TAGS: ['svg', 'path', 'image'],
        ADD_ATTR: ['xlink:href', 'target'],
      });
    } catch {
      // fallback
    }
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * 解析 EPUB ZIP 容器
 */
export async function parseEpub(data: Uint8Array | ArrayBuffer | string): Promise<ParsedEpubBook> {
  let zipData: Uint8Array | ArrayBuffer;
  if (typeof data === 'string') {
    if (data.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(data.trim())) {
      zipData = base64ToBytes(data);
    } else {
      // 若传入普通文本或无法识别格式，降级到内置样例书
      zipData = await generateSampleEpubBytes();
    }
  } else {
    zipData = data;
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipData);
  } catch (err) {
    console.warn('[OmniView EpubEngine] 载入 EPUB 数据失败，自愈降级至样例电子书:', err);
    const sampleBytes = await generateSampleEpubBytes();
    zip = await JSZip.loadAsync(sampleBytes);
  }

  // 1. 读取 META-INF/container.xml 获取 OPF 文件路径
  const containerFile = zip.file('META-INF/container.xml');
  let opfPath = 'OEBPS/content.opf';
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const rootfileMatch = containerXml.match(/<rootfile[^>]+full-path=["']([^"']+)["']/i);
    if (rootfileMatch && rootfileMatch[1]) {
      opfPath = rootfileMatch[1];
    }
  }

  // 容错: 尝试寻找任何以 .opf 结尾的文件
  let opfFile = zip.file(opfPath);
  if (!opfFile) {
    const found = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.opf'));
    if (found) {
      opfPath = found;
      opfFile = zip.file(found);
    }
  }

  if (!opfFile) {
    throw new Error(`EPUB 包内未找到 OPF 清单文件 (${opfPath})`);
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
  const opfXml = await opfFile.async('text');

  // 2. 解析元数据 (dc:title, dc:creator, etc.)
  const metadata: EpubMetadata = {
    title: extractTagContent(opfXml, 'title') || '未命名电子书',
    creator: extractTagContent(opfXml, 'creator') || '佚名 / 自由作者',
    identifier: extractTagContent(opfXml, 'identifier'),
    language: extractTagContent(opfXml, 'language') || 'zh-CN',
    description: extractTagContent(opfXml, 'description') || '暂无内容简介',
    publisher: extractTagContent(opfXml, 'publisher') || 'OmniView Reader',
    publicationDate: extractTagContent(opfXml, 'date'),
    totalChapters: 0,
  };

  // 3. 解析 Manifest (资源清单)
  const manifestMap: Record<string, { href: string; mediaType: string; properties: string }> = {};
  let coverItemId: string | null = null;

  const itemRegex = /<item\b([^>]+)\/?>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(opfXml)) !== null) {
    const attrs = itemMatch[1];
    const id = extractAttribute(attrs, 'id');
    const href = extractAttribute(attrs, 'href');
    const mediaType = extractAttribute(attrs, 'media-type') || '';
    const properties = extractAttribute(attrs, 'properties') || '';
    if (id && href) {
      manifestMap[id] = { href, mediaType, properties };
      if (properties.includes('cover-image') || id.toLowerCase().includes('cover')) {
        coverItemId = id;
      }
    }
  }

  // 提取封面图片
  if (coverItemId && manifestMap[coverItemId]) {
    const coverPath = resolveZipPath(opfDir, manifestMap[coverItemId].href);
    const coverFile = zip.file(coverPath);
    if (coverFile) {
      try {
        const coverBase64 = await coverFile.async('base64');
        const mediaType = manifestMap[coverItemId].mediaType || 'image/jpeg';
        metadata.coverDataUrl = `data:${mediaType};base64,${coverBase64}`;
      } catch {
        // ignore cover decode error
      }
    }
  }

  // 4. 解析 Spine (阅读阅读流顺序)
  const spineIds: string[] = [];
  const itemrefRegex = /<itemref\b([^>]+)\/?>/gi;
  let itemrefMatch: RegExpExecArray | null;
  while ((itemrefMatch = itemrefRegex.exec(opfXml)) !== null) {
    const idref = extractAttribute(itemrefMatch[1], 'idref');
    if (idref) spineIds.push(idref);
  }

  // 5. Parse EPUB 3 navigation first, falling back to EPUB 2 NCX.
  let toc: EpubTocItem[] = [];
  const navItem = Object.values(manifestMap).find(item =>
    item.properties.split(/\s+/).includes('nav')
  );
  if (navItem) {
    const navPath = resolveZipPath(opfDir, navItem.href);
    const navFile = zip.file(navPath);
    if (navFile) {
      toc = parseEpub3Nav(await navFile.async('text'), navPath);
    }
  }

  const spineMatch = opfXml.match(/<spine\b([^>]*)>/i);
  let ncxItemId = spineMatch ? extractAttribute(spineMatch[1], 'toc') : null;
  if (!ncxItemId) ncxItemId = 'ncx';
  let ncxItem = manifestMap[ncxItemId] || Object.values(manifestMap).find(m => m.mediaType.includes('ncx') || m.href.endsWith('.ncx'));

  if (toc.length === 0 && ncxItem) {
    const ncxPath = resolveZipPath(opfDir, ncxItem.href);
    const ncxFile = zip.file(ncxPath);
    if (ncxFile) {
      toc = parseNcxToc(await ncxFile.async('text'), ncxPath);
    }
  }

  // 6. 解析每一章节内容 (依序读取 Spine)
  const chapters: EpubChapter[] = [];
  let chapterIndex = 0;

  for (const spineId of spineIds) {
    const manifestItem = manifestMap[spineId];
    if (!manifestItem) continue;

    const chapterPath = resolveZipPath(opfDir, manifestItem.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const chapterDir = chapterPath.includes('/') ? chapterPath.slice(0, chapterPath.lastIndexOf('/')) : '';
    let rawHtml = await chapterFile.async('text');
    const embeddedStyles: string[] = [];

    const stylesheetLinks = Array.from(rawHtml.matchAll(/<link\b([^>]*?)\/?>/gi));
    for (const match of stylesheetLinks) {
      const attrs = match[1];
      const rel = (extractAttribute(attrs, 'rel') || '').toLowerCase().split(/\s+/);
      const href = extractAttribute(attrs, 'href');
      if (!rel.includes('stylesheet') || !href || /^(?:https?:|\/\/|data:)/i.test(href)) continue;
      const stylesheetPath = resolveEpubPathSafe(chapterDir, href);
      const stylesheet = zip.file(stylesheetPath);
      if (!stylesheet) continue;
      const css = await inlineCssResources(await stylesheet.async('text'), stylesheetPath, zip);
      embeddedStyles.push(css);
      rawHtml = rawHtml.replace(match[0], '');
    }

    const inlineStyles = Array.from(rawHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi));
    for (const match of inlineStyles) {
      const css = await inlineCssResources(match[1], chapterPath, zip);
      embeddedStyles.push(css);
      rawHtml = rawHtml.replace(match[0], '');
    }

    // 尝试提取标题
    const h1Match = rawHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const headerTitle = h1Match
      ? h1Match[1].replace(/<[^>]+>/g, '').trim()
      : titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
      : '';

    // 匹配 TOC 中的 label
    const matchedToc = flattenToc(toc).find(t => t.href.split('#')[0] === chapterPath);
    const chapterTitle = matchedToc?.label || headerTitle || `第 ${chapterIndex + 1} 章`;

    // 图像内联化：将相对路径图片转为 base64 Data URL，确保独立渲染
    const imgMatches = Array.from(rawHtml.matchAll(/<(?:img|image)\b([^>]+)>/gi));
    for (const match of imgMatches) {
      const tagContent = match[1];
      const src = extractAttribute(tagContent, 'src') || extractAttribute(tagContent, 'xlink:href');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        const imgZipPath = resolveEpubPathSafe(chapterDir, src);
        const imgFile = zip.file(imgZipPath);
        if (imgFile) {
          try {
            const mime = mimeTypeForPath(imgZipPath);
            const imgBase64 = await imgFile.async('base64');
            const dataUrl = `data:${mime};base64,${imgBase64}`;
            rawHtml = rawHtml.replace(match[0], match[0].replace(src, dataUrl));
          } catch {
            // keep original
          }
        }
      }
    }

    rawHtml = rewriteInternalLinks(rawHtml, chapterPath);

    // 提取正文内容 (body 内部或全文本)
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = `${embeddedStyles.length > 0 ? `<style>${scopeEpubStyles(embeddedStyles.join('\n'))}</style>` : ''}${bodyMatch ? bodyMatch[1] : rawHtml}`;

    // 使用 DOMPurify 安全过滤
    const safeContent = sanitizeHtml(bodyContent);

    chapters.push({
      id: spineId,
      title: chapterTitle,
      href: chapterPath,
      htmlContent: safeContent,
      order: ++chapterIndex,
    });
  }

  // 如果 TOC 为空，使用 Chapters 自动生成目录大纲
  if (toc.length === 0) {
    chapters.forEach(ch => {
      toc.push({
        id: ch.id,
        label: ch.title,
        href: ch.href,
        order: ch.order,
      });
    });
  }

  metadata.totalChapters = chapters.length;

  return {
    metadata,
    toc,
    chapters,
    opfDir,
  };
}

/**
 * 纯内存生成内置的高质量示范 EPUB 二进制包
 * 用于离线环境、快速预览及单元测试
 */
export async function generateSampleEpubBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. mimetype (必须在首位且不压缩)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. OEBPS/content.opf
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>OmniView 电子书工程与现代排版实践指南</dc:title>
    <dc:creator>OmniView Architecture Team</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>探讨纯端侧轻量化电子书阅读器架构、EPUB 容器解析标准与无缝 VS Code 全主题沉浸式阅读体验。</dc:description>
    <dc:publisher>OmniView Open Source Project</dc:publisher>
    <dc:identifier id="BookID">urn:uuid:omniview-sample-epub-2026</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="styles" href="styles/book.css" media-type="text/css"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`
  );

  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
      <li><a href="chapter1.xhtml">第一章：欢迎使用原生 EPUB 阅读器</a>
        <ol><li><a href="chapter1.xhtml#sample-subsection">1.1 阅读器功能</a></li></ol>
      </li>
      <li><a href="chapter2.xhtml">第二章：离线轻量化解析架构设计</a></li>
      <li><a href="chapter3.xhtml">第三章：阅读交互与舒适排版规范</a></li>
    </ol>
  </nav>
</body>
</html>`
  );

  zip.file(
    'OEBPS/styles/book.css',
    'body { font-family: serif; } .sample-image { background-image: url("../images/pixel.svg"); }'
  );
  zip.file(
    'OEBPS/images/pixel.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#000"/></svg>'
  );

  // 4. OEBPS/toc.ncx
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:omniview-sample-epub-2026"/>
  </head>
  <docTitle><text>OmniView 电子书工程与现代排版实践指南</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>第一章：欢迎使用原生 EPUB 阅读器</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>第二章：离线轻量化解析架构设计</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-3" playOrder="3">
      <navLabel><text>第三章：阅读交互与舒适排版规范</text></navLabel>
      <content src="chapter3.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
  );

  // 5. 章节内容 XHTML
  zip.file(
    'OEBPS/chapter1.xhtml',
    `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>第一章：欢迎使用原生 EPUB 阅读器</title>
  <link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <h1>第一章：欢迎使用原生 EPUB 阅读器</h1>
  <p>OmniView 正式迎来对电子书（EPUB）的原生离线预览支持！</p>
  <p id="sample-subsection"><a href="chapter2.xhtml#chapter-two">继续阅读第二章</a></p>
  <p>无论是开发者阅读技术规范手册、学术白皮书，还是日常翻阅技术书籍，现在都可以在 VS Code 工作区及浏览器端即开即读，彻底告别外部笨重桌面软件与商业收费弹框。</p>
  <div class="callout" style="padding: 12px 16px; border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.08); margin: 16px 0; border-radius: 4px;">
    <strong>核心特性亮点：</strong>
    <ul>
      <li><strong>零系统依赖</strong>：纯 TypeScript 与 Web API 实现，无需配置 Python、Calibre 或后台服务；</li>
      <li><strong>全主题自适应</strong>：智能跟随 VS Code 暗黑、浅色、Sepia（羊皮纸护眼）模式；</li>
      <li><strong>多维排版控制</strong>：支持即时调节字号（12px ~ 28px）、行高、单页/连续流滚动以及目录大纲导航。</li>
    </ul>
  </div>
  <p>点击下方或右上角导航按钮，即可平滑翻阅下一章。</p>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter2.xhtml',
    `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>第二章：离线轻量化解析架构设计</title>
</head>
<body>
  <h1 id="chapter-two">第二章：离线轻量化解析架构设计</h1>
  <p>EPUB 格式基于开放出版结构标准（Open Publication Structure），其物理容器为标准 DEFLATE 压缩的 ZIP 包。</p>
  <p>OmniView 采用基于 Micro-Kernel 驱动架构的按需动态挂载设计：</p>
  <ol>
    <li><strong>零首屏损耗</strong>：在用户打开 Markdown 或 PDF 时，EPUB 解析代码保持休眠，不占用任何主线程内存与带宽；</li>
    <li><strong>流式解压与缓存</strong>：利用现有的 <code>JSZip</code> 快速解包 <code>META-INF/container.xml</code> 与 <code>content.opf</code>，仅解析索引与当前激活章节；</li>
    <li><strong>严格安全过滤</strong>：所有 XHTML 内容经 <code>DOMPurify</code> 沙箱清洗，防止恶意外部脚本与跨站渗透攻击。</li>
  </ol>
  <p>这种纯端侧架构保证了极高的稳定性，阅读千页巨著依然轻快流畅。</p>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter3.xhtml',
    `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>第三章：阅读交互与舒适排版规范</title>
</head>
<body>
  <h1>第三章：阅读交互与舒适排版规范</h1>
  <p>为了给读者提供沉浸式心流体验，OmniView 电子书阅读器内置了全套无障碍交互设计：</p>
  <ul>
    <li><strong>键盘快捷键</strong>：支持 <kbd>←</kbd> / <kbd>→</kbd> 键盘方向键即时翻章，<kbd>PageUp</kbd> / <kbd>PageDown</kbd> 页面滚动；</li>
    <li><strong>大纲快速跳转</strong>：侧边栏目录大纲与阅读进度条联动，随时一键直达核心章节；</li>
    <li><strong>优雅的阅读字号</strong>：默认采用 16px 舒适正文字号及 1.7 黄金行高比，极大缓解长时间审阅代码与文档的眼部疲劳。</li>
  </ul>
  <p>感谢使用 OmniView，开启优雅自由的本地多格式阅读之旅！</p>
</body>
</html>`
  );

  return await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}
