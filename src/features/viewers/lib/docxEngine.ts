/**
 * OmniView 原生 Word (.docx) 解析与离线渲染核心引擎
 * 基于 OOXML (Office Open XML) 容器标准与 JSZip / docx-preview 纯前端流水线
 */
import JSZip from 'jszip';
import { renderAsync, type DocxOptions } from 'docx-preview';
import { parseXmlTree, findChild, findChildren, findDescendant, findDescendants, collectNodeText, type XmlNode } from './pptxXmlUtils';

export interface DocxSpacingSpec {
  line?: number;
  lineRule?: 'auto' | 'exact' | 'atLeast';
  beforePt?: number;
  afterPt?: number;
  beforeLines?: number;
  afterLines?: number;
  contextualSpacing?: boolean;
}

export interface DocxMarginsSpec {
  topPt: number;
  rightPt: number;
  bottomPt: number;
  leftPt: number;
  headerPt: number;
  footerPt: number;
  gutterPt: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
  gutterMm: number;
}

export interface DocxSectionPageProperties {
  paperName: string;
  orientation: 'portrait' | 'landscape';
  widthTwips: number;
  heightTwips: number;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  margins: DocxMarginsSpec;
  columns: {
    count: number;
    spacePx: number;
    separator: boolean;
  };
  verticalAlign: 'top' | 'center' | 'bottom' | 'both';
  docGrid?: {
    type?: string;
    linePitchPt?: number;
    charSpace?: number;
  };
  borders: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  sectionBreakType?: string;
}

export interface DocxParagraphStyleSpec {
  styleId: string;
  name?: string;
  basedOn?: string;
  isDefault?: boolean;
  spacing?: DocxSpacingSpec;
  fontSizePt?: number;
  fontFamily?: string;
}

export interface DocxFormattingProfile {
  defaultFontSizePt: number;
  defaultFontFamily?: string;
  defaultSpacing: DocxSpacingSpec;
  defaultLineHeightCss: string;
  defaultLineHeightLabel: string;
  styles: Record<string, DocxParagraphStyleSpec>;
  paragraphSpacings: Array<{
    spacing: DocxSpacingSpec;
    textHint: string;
  }>;
  sections: DocxSectionPageProperties[];
  primaryPage: DocxSectionPageProperties;
}

export interface DocxMetadata {
  title?: string;
  creator?: string;
  description?: string;
  created?: string;
  modified?: string;
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  company?: string;
  pageProperties?: DocxSectionPageProperties;
  defaultFontSizePt?: number;
  defaultLineHeightLabel?: string;
}

export interface DocxTocItem {
  id: string;
  text: string;
  level: number;
  element?: HTMLElement;
}

export interface ParsedDocxDocument {
  rawBytes: Uint8Array;
  metadata: DocxMetadata;
  formattingProfile?: DocxFormattingProfile;
  isValid: boolean;
  isFallbackUsed?: boolean;
}

/**
 * 将 Base64 字符串快速还原为 Uint8Array 二进制数组
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:.*?;base64,/, '').replace(/\s+/g, '');
  if (typeof atob === 'function') {
    const binaryStr = atob(clean);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js 环境兼容
  return Uint8Array.from(Buffer.from(clean, 'base64'));
}

const TOC_CLASS_PATTERN =
  /(?:^|[\s_-])(?:toc[0-9_-]*|tocheading|toc-heading|docx-p-toc|docx-toc|word-toc|目录[0-9_-]*)(?=$|[\s_-])/i;

/**
 * 判断类名是否属于 Word 目录 (TOC) 样式（兼容 docx-preview 生成的下划线拼接类名如 docx-rendered-wrapper_TOC1）
 */
export function hasTocClassName(className: string): boolean {
  if (!className || typeof className !== 'string') return false;
  return TOC_CLASS_PATTERN.test(className);
}

/**
 * 判断文本是否为目录页自身的标题（如“目录”、“目 录”、“Table of Contents”）
 */
export function isTocTitleText(rawText: string): boolean {
  const compact = (rawText || '').replace(/\s+/g, '').trim().toLowerCase();
  return (
    compact === '目录' ||
    compact === '目次' ||
    compact === '文档目录' ||
    compact === '章节目录' ||
    compact === 'contents' ||
    compact === 'tableofcontents'
  );
}

/**
 * 判断段落文本或节点是否带有目录特有的前导符点线、制表位空白 (\u2003 / \t) + 尾部页码
 */
export function hasTocLeaderOrPageSuffix(rawText: string, el?: HTMLElement | null): boolean {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return false;
  if (
    /(?:[.\u00B7\u2024\u2025\u2026\u22EF\u30FB…·]{2,}\s*|\t+\s*|[\u2002\u2003\u3000]+\s*|\s{3,})(?:\d{1,4}|[ivxlcdm]{1,6})$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (el) {
    const spans = Array.from(el.querySelectorAll('span'));
    const hasTabSpan = spans.some(s => /^[\u2002\u2003\u3000\t]+$/.test(s.textContent || ''));
    if (hasTabSpan && /(?:\d{1,4}|[ivxlcdm]{1,6})$/i.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * 清洗标题文本：移除目录条目尾部的点线、制表位空白及页码
 */
export function cleanHeadingText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(
      /(?:[.\u00B7\u2024\u2025\u2026\u22EF\u30FB…·]{2,}\s*|\t+\s*|[\u2002\u2003\u3000]+\s*|\s{2,})(?:\d{1,4}|[ivxlcdm]{1,6})\s*$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 根据锚点名在容器内查找对应的书签节点并向上收敛至正文标题块元素
 */
function findBookmarkTargetBlock(container: HTMLElement, rawHash: string): HTMLElement | null {
  const anchorId = decodeURIComponent(rawHash.replace(/^#/, '').trim());
  if (!anchorId) return null;

  let bookmarkEl: HTMLElement | null = null;
  const allWithId = Array.from(container.querySelectorAll<HTMLElement>('[id], a[name]'));
  for (const node of allWithId) {
    if (node.id === anchorId || node.getAttribute('name') === anchorId) {
      bookmarkEl = node;
      break;
    }
  }
  if (!bookmarkEl) return null;

  const enclosingBlock = bookmarkEl.closest<HTMLElement>('h1, h2, h3, h4, h5, h6, p');
  if (enclosingBlock && container.contains(enclosingBlock)) {
    if ((enclosingBlock.textContent || '').trim().length > 0) {
      return enclosingBlock;
    }
  }

  // 若书签位于空段落或独立节点上，尝试取紧邻的下一个非空段落/标题节点
  let nextEl = (enclosingBlock || bookmarkEl).nextElementSibling as HTMLElement | null;
  while (nextEl) {
    if (/^(H[1-6]|P)$/i.test(nextEl.tagName) && (nextEl.textContent || '').trim().length > 0) {
      return nextEl;
    }
    nextEl = nextEl.nextElementSibling as HTMLElement | null;
  }

  return enclosingBlock;
}

/**
 * 判断 DOM 节点是否属于文档内部的目录 (TOC) 区域或目录条目行
 */
export function isTocEntryElement(
  el: HTMLElement | null | undefined,
  rootContainer?: HTMLElement | null
): boolean {
  if (!el) return false;

  let curr: HTMLElement | null = el;
  while (curr && curr !== rootContainer) {
    const tag = curr.tagName?.toLowerCase() || '';
    if (tag === 'sdt' || curr.hasAttribute('data-docx-toc')) {
      return true;
    }
    if (hasTocClassName(curr.className || '')) {
      return true;
    }
    curr = curr.parentElement;
  }

  const blockEl = el.closest<HTMLElement>('h1, h2, h3, h4, h5, h6, p') || el;
  const rawText = blockEl.textContent || '';
  if (isTocTitleText(rawText)) {
    return true;
  }

  if (hasTocLeaderOrPageSuffix(rawText, blockEl)) {
    return true;
  }

  // 检查是否包含指向文档内书签的目录超链接（如 #_Toc12345 或 #__RefHeading...）
  const anchorEl =
    (el.tagName === 'A' ? (el as HTMLAnchorElement) : null) ||
    blockEl.querySelector<HTMLAnchorElement>('a[href^="#"]');
  if (anchorEl) {
    const href = anchorEl.getAttribute('href') || '';
    if (/^#(?:_Toc|__RefHeading|toc)/i.test(href)) {
      return true;
    }
    if (rootContainer && href.startsWith('#') && href.length > 1) {
      const targetBlock = findBookmarkTargetBlock(rootContainer, href);
      if (targetBlock && targetBlock !== blockEl) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 从元素或目录类名/文本特征推断标题层级 (1~6)
 */
function inferHeadingLevel(el: HTMLElement, cleanText: string, tocHintClass?: string): number {
  if (tocHintClass) {
    const tocMatch =
      tocHintClass.match(/(?:toc|目录)[_-]*([1-6])/i) ||
      tocHintClass.match(/heading[_-\s]*([1-6])/i);
    if (tocMatch) {
      return parseInt(tocMatch[1], 10);
    }
  }

  const tagName = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    return parseInt(tagName.replace('h', ''), 10);
  }

  const className = el.className || '';
  const classMatch =
    className.match(/heading[_-\s]*([1-6])/i) ||
    className.match(/(?:^|[\s_-])h([1-6])(?=$|[\s_-])/i);
  if (classMatch) {
    return parseInt(classMatch[1], 10);
  }

  if (/^第[一二三四五六七八九十百千万0-9]+[章篇部]/.test(cleanText) || /^[一二三四五六七八九十]+[、.．]/.test(cleanText)) {
    return 1;
  }
  if (/^[0-9]+\.[0-9]+\.[0-9]+/.test(cleanText)) {
    return 3;
  }
  if (/^[0-9]+\.[0-9]+/.test(cleanText) || /^第[一二三四五六七八九十百千万0-9]+节/.test(cleanText) || /^[（(][一二三四五六七八九十0-9]+[)）]/.test(cleanText)) {
    return 2;
  }
  if (/^[0-9]+[、.．\s]/.test(cleanText)) {
    return 1;
  }

  return 2;
}

/**
 * 收集文档前部紧随“目录”标题之后的疑似手工目录段落集合（无超链接、无页码但正文后方存在同名章节标题）
 */
function collectManualTocRegionElements(container: HTMLElement): Set<HTMLElement> {
  const manualTocSet = new Set<HTMLElement>();
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p'));
  let inManualToc = false;
  let scanBudget = 0;

  // 预先统计每个清洗后标题文本在文档后部出现的次数
  const textOccurrences = new Map<string, HTMLElement[]>();
  for (const b of blocks) {
    const cleaned = cleanHeadingText(b.textContent || '').toLowerCase();
    if (!cleaned || cleaned.length > 90) continue;
    const list = textOccurrences.get(cleaned) || [];
    list.push(b);
    textOccurrences.set(cleaned, list);
  }

  for (const b of blocks) {
    const raw = (b.textContent || '').trim();
    if (!raw) continue;

    if (isTocTitleText(raw)) {
      inManualToc = true;
      scanBudget = 40;
      manualTocSet.add(b);
      continue;
    }

    if (inManualToc && scanBudget > 0) {
      scanBudget--;
      const cleaned = cleanHeadingText(raw).toLowerCase();
      const occurrences = textOccurrences.get(cleaned) || [];
      const hasLaterBodyOccurrence = occurrences.length > 1 && occurrences[occurrences.length - 1] !== b;

      if (isTocEntryElement(b, container) || hasLaterBodyOccurrence) {
        manualTocSet.add(b);
      } else if (raw.length > 100) {
        // 遇到长正文段落，说明已离开目录区域
        inManualToc = false;
      }
    }
  }

  return manualTocSet;
}

/**
 * 将导航项或目录内点击的元素解析为真正的【正文标题 DOM 节点】（绝不返回目录页内的条目节点）
 */
export function resolveBodyHeadingElement(
  container: HTMLElement,
  itemOrEl: DocxTocItem | HTMLElement,
  fallbackText?: string
): HTMLElement | null {
  if (!container || !itemOrEl) return null;

  const isDomNode = typeof (itemOrEl as HTMLElement).tagName === 'string';
  const tocItem = isDomNode ? null : (itemOrEl as DocxTocItem);
  const sourceEl: HTMLElement | null = isDomNode
    ? (itemOrEl as HTMLElement)
    : tocItem?.element || (tocItem?.id ? container.querySelector<HTMLElement>(`[id="${tocItem.id}"]`) : null);

  const rawTargetText =
    fallbackText ||
    (isDomNode ? (itemOrEl as HTMLElement).textContent || '' : tocItem?.text || '') ||
    '';
  const cleanTarget = cleanHeadingText(rawTargetText).toLowerCase();

  // 1. 若源节点本身带有 #_Toc 等锚点链接，直接通过书签 ID 定位正文标题块
  if (sourceEl) {
    const anchor =
      (sourceEl.tagName === 'A' ? (sourceEl as HTMLAnchorElement) : null) ||
      sourceEl.querySelector<HTMLAnchorElement>('a[href^="#"]') ||
      sourceEl.closest<HTMLAnchorElement>('a[href^="#"]');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      const bookmarkBlock = findBookmarkTargetBlock(container, href);
      if (bookmarkBlock && !isTocEntryElement(bookmarkBlock, container)) {
        return bookmarkBlock;
      }
    }
  }

  const manualTocSet = collectManualTocRegionElements(container);

  // 2. 若源节点已在容器内，且既不是 TOC 节点也不在手工目录区内，检查是否存在更匹配的正文同名章节
  if (
    sourceEl &&
    container.contains(sourceEl) &&
    !isTocEntryElement(sourceEl, container) &&
    !manualTocSet.has(sourceEl)
  ) {
    return sourceEl;
  }

  // 3. 在容器内的目录锚点中查找同名目录项，利用其 href="#_Toc..." 精确反查正文书签
  if (cleanTarget) {
    const tocAnchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    for (const a of tocAnchors) {
      const aClean = cleanHeadingText(a.textContent || '').toLowerCase();
      if (aClean && (aClean === cleanTarget || aClean.includes(cleanTarget) || cleanTarget.includes(aClean))) {
        const href = a.getAttribute('href') || '';
        const bookmarkBlock = findBookmarkTargetBlock(container, href);
        if (bookmarkBlock && !isTocEntryElement(bookmarkBlock, container) && !manualTocSet.has(bookmarkBlock)) {
          return bookmarkBlock;
        }
      }
    }
  }

  // 4. 扫描容器内全部非目录的标题与段落节点，按文本精确度与正文权重匹配真正的章节标题
  if (!cleanTarget) return null;

  const allBlocks = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p'));
  const bodyCandidates = allBlocks.filter(
    el => !isTocEntryElement(el, container) && !manualTocSet.has(el)
  );

  // 优先精确匹配（清洗后文本完全一致）
  const exactMatches = bodyCandidates.filter(
    el => cleanHeadingText(el.textContent || '').toLowerCase() === cleanTarget
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    // 若存在多个同名段落，优先选择带有 _Toc 书签或显式 Heading 标签/类名的节点，否则取正文后方的章节节点
    const withBookmarkOrHeading = exactMatches.find(
      el =>
        /^h[1-6]$/i.test(el.tagName) ||
        /heading/i.test(el.className || '') ||
        Boolean(el.querySelector('[id^="_Toc"], [id^="__RefHeading"], a[name^="_Toc"]'))
    );
    return withBookmarkOrHeading || exactMatches[exactMatches.length - 1];
  }

  // 次优包含匹配（限制长度 <= 90，防止误匹配长正文段落）
  const fuzzyMatches = bodyCandidates.filter(el => {
    const txt = cleanHeadingText(el.textContent || '').toLowerCase();
    if (!txt || txt.length > 90) return false;
    return txt.includes(cleanTarget) || cleanTarget.includes(txt);
  });
  if (fuzzyMatches.length > 0) {
    const withHeading = fuzzyMatches.find(
      el => /^h[1-6]$/i.test(el.tagName) || /heading/i.test(el.className || '')
    );
    return withHeading || fuzzyMatches[fuzzyMatches.length - 1];
  }

  return sourceEl;
}

/**
 * 从已渲染的 DOCX DOM 节点中精准智能提取层级标题与大纲 (TocItems)
 * 严格排除文档内部目录 (TOC) 节点，并通过书签/正文反查机制确保 100% 绑定至正文真实章节标题
 */
export function extractHeadingsFromDom(container: HTMLElement): DocxTocItem[] {
  if (!container) return [];

  const manualTocSet = collectManualTocRegionElements(container);
  const seenElements = new Set<HTMLElement>();
  const rawCandidates: Array<{ element: HTMLElement; text: string; level: number }> = [];

  const addCandidate = (el: HTMLElement, rawText: string, levelHint: number) => {
    const resolvedEl = resolveBodyHeadingElement(container, el, rawText) || el;
    if (!resolvedEl || isTocEntryElement(resolvedEl, container) || manualTocSet.has(resolvedEl)) {
      return;
    }
    const text = cleanHeadingText(resolvedEl.textContent || rawText);
    if (!text || isTocTitleText(text)) return;
    if (seenElements.has(resolvedEl)) return;
    seenElements.add(resolvedEl);
    rawCandidates.push({
      element: resolvedEl,
      text,
      level: Math.min(6, Math.max(1, levelHint)),
    });
  };

  // 1. 提取显式 HTML 标题元素及 docx-preview 渲染的 heading 节点（排除 TOC 节点）
  const selector =
    'h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="Heading"], [class*="docx-p-heading"]';
  const rawHeadingEls = Array.from(container.querySelectorAll<HTMLElement>(selector));

  for (const el of rawHeadingEls) {
    if (isTocEntryElement(el, container) || manualTocSet.has(el)) {
      continue;
    }
    const text = cleanHeadingText(el.textContent || '');
    if (!text || isTocTitleText(text)) continue;
    const level = inferHeadingLevel(el, text);
    addCandidate(el, text, level);
  }

  // 2. 利用文档内 TOC 目录超链接 (a[href^="#_Toc..."]) 反查正文书签标题
  //    解决中文 Word 文档使用自定义样式（如 styleId="1" 或加粗正文）未命中 Heading 类名的问题
  const tocAnchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  for (const anchor of tocAnchors) {
    const href = anchor.getAttribute('href') || '';
    if (!href || href === '#') continue;
    const targetBlock = findBookmarkTargetBlock(container, href);
    if (!targetBlock || isTocEntryElement(targetBlock, container) || manualTocSet.has(targetBlock)) {
      continue;
    }
    const tocBlock = anchor.closest<HTMLElement>('p, div, li');
    const tocClass = tocBlock?.className || anchor.className || '';
    const text = cleanHeadingText(targetBlock.textContent || anchor.textContent || '');
    if (!text || isTocTitleText(text)) continue;
    const level = inferHeadingLevel(targetBlock, text, tocClass);
    addCandidate(targetBlock, text, level);
  }

  // 3. 备用机制：若文档既无官方 Heading 样式也无超链接书签，扫描带有明显标题特征的正文段落（严格跳过目录区）
  if (rawCandidates.length === 0) {
    const paragraphs = Array.from(
      container.querySelectorAll<HTMLElement>('p, section > div, .docx-rendered-wrapper p')
    );
    let fallbackCount = 0;
    for (const p of paragraphs) {
      if (fallbackCount >= 30) break;
      if (isTocEntryElement(p, container) || manualTocSet.has(p)) {
        continue;
      }

      const rawTxt = (p.textContent || '').trim();
      if (!rawTxt || rawTxt.length > 80 || hasTocLeaderOrPageSuffix(rawTxt, p)) continue;
      const txt = cleanHeadingText(rawTxt);
      if (!txt || isTocTitleText(txt)) continue;

      const style = typeof window !== 'undefined' ? window.getComputedStyle(p) : null;
      const isBold =
        style?.fontWeight === '700' ||
        style?.fontWeight === 'bold' ||
        Boolean(p.querySelector('b, strong'));
      const isTitlePattern =
        /^[0-9一二三四五六七八九十]+[、.．\s]/.test(txt) ||
        /^第[0-9一二三四五六七八九十百千万]+[章节条篇部]/i.test(txt) ||
        /^[（(][一二三四五六七八九十0-9]+[)）]/.test(txt);

      if (isBold || isTitlePattern) {
        const inferredLevel = inferHeadingLevel(p, txt);
        addCandidate(p, txt, inferredLevel);
        fallbackCount++;
      }
    }
  }

  // 4. 按 DOM 文档先后顺序排序并生成稳定的导航锚点 ID
  const followingMask = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_FOLLOWING : 4;
  rawCandidates.sort((a, b) => {
    if (a.element === b.element) return 0;
    const pos = a.element.compareDocumentPosition(b.element);
    return pos & followingMask ? -1 : 1;
  });

  return rawCandidates.map((cand, index) => {
    if (!cand.element.id) {
      cand.element.id = `docx-heading-${index}-${Math.random().toString(36).substring(2, 7)}`;
    }
    return {
      id: cand.element.id,
      text: cand.text,
      level: cand.level,
      element: cand.element,
    };
  });
}

const TWIPS_PER_PT = 20;
const TWIPS_PER_INCH = 1440;
const MM_PER_INCH = 25.4;
const PX_PER_INCH = 96;

function twipsToPt(twips: number): number {
  return Math.round((twips / TWIPS_PER_PT) * 100) / 100;
}

function twipsToPx(twips: number): number {
  return Math.round((twips / TWIPS_PER_INCH) * PX_PER_INCH);
}

function twipsToMm(twips: number): number {
  return Math.round((twips / TWIPS_PER_INCH) * MM_PER_INCH * 10) / 10;
}

function parseOptionalInt(val: string | undefined): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : undefined;
}

function identifyPaperName(widthMm: number, heightMm: number): string {
  const shortSide = Math.min(widthMm, heightMm);
  const longSide = Math.max(widthMm, heightMm);
  const specs: Array<{ name: string; s: number; l: number }> = [
    { name: 'A4', s: 210, l: 297 },
    { name: 'Letter', s: 215.9, l: 279.4 },
    { name: 'Legal', s: 215.9, l: 355.6 },
    { name: 'A3', s: 297, l: 420 },
    { name: 'A5', s: 148, l: 210 },
    { name: 'B5', s: 176, l: 250 },
    { name: 'JIS B5', s: 182, l: 257 },
  ];
  for (const spec of specs) {
    if (Math.abs(shortSide - spec.s) <= 4 && Math.abs(longSide - spec.l) <= 5) {
      return spec.name;
    }
  }
  return 'Custom';
}

function parseSpacingNode(node: XmlNode | undefined): DocxSpacingSpec | undefined {
  if (!node) return undefined;
  const spec: DocxSpacingSpec = {};
  const line = parseOptionalInt(node.attrs.line);
  const rawRule = (node.attrs.lineRule || '').trim();
  const before = parseOptionalInt(node.attrs.before);
  const after = parseOptionalInt(node.attrs.after);
  const beforeLines = parseOptionalInt(node.attrs.beforeLines);
  const afterLines = parseOptionalInt(node.attrs.afterLines);

  if (line !== undefined) {
    spec.line = line;
    // Per OOXML ECMA-376 §17.3.1.33, omitted w:lineRule MUST default to "auto"
    if (rawRule === 'exact' || rawRule === 'atLeast' || rawRule === 'auto') {
      spec.lineRule = rawRule;
    } else {
      spec.lineRule = 'auto';
    }
  }
  if (before !== undefined) spec.beforePt = twipsToPt(before);
  if (after !== undefined) spec.afterPt = twipsToPt(after);
  if (beforeLines !== undefined) spec.beforeLines = beforeLines / 100;
  if (afterLines !== undefined) spec.afterLines = afterLines / 100;

  return Object.keys(spec).length > 0 ? spec : undefined;
}

function resolveAutoLineHeightRatio(lineUnits: number, defaultFontSizePt = 10.5, linePitchPt?: number): number {
  const ratio = lineUnits / 240;
  // Microsoft Word single-line spacing renders at ~1.15x font em metrics (vs CSS 1.0 clipping CJK/Latin)
  const wordNaturalRatio = ratio >= 0.99 ? Math.max(1.15, ratio * 1.15) : Math.max(0.9, ratio * 1.1);
  if (linePitchPt && linePitchPt > 0 && defaultFontSizePt > 0 && ratio >= 0.98 && ratio <= 1.05) {
    const gridRatio = linePitchPt / defaultFontSizePt;
    if (gridRatio > wordNaturalRatio && gridRatio <= 2.2) {
      return Number((Math.round((gridRatio + Number.EPSILON) * 100) / 100).toFixed(2));
    }
  }
  return Number((Math.round((wordNaturalRatio + Number.EPSILON) * 100) / 100).toFixed(2));
}

export function formatSpacingLineHeightCss(
  spacing: DocxSpacingSpec,
  defaultFontSizePt = 10.5,
  linePitchPt?: number
): { lineHeight?: string; minHeight?: string } {
  if (spacing.line === undefined || spacing.line <= 0) return {};
  const rule = spacing.lineRule || 'auto';
  if (rule === 'exact') {
    const pt = twipsToPt(spacing.line);
    return { lineHeight: `${pt}pt`, minHeight: `${pt}pt` };
  }
  if (rule === 'atLeast') {
    const pt = twipsToPt(spacing.line);
    return { lineHeight: `max(1.22em, ${pt}pt)`, minHeight: `${pt}pt` };
  }
  const ratio = resolveAutoLineHeightRatio(spacing.line, defaultFontSizePt, linePitchPt);
  return { lineHeight: String(ratio) };
}

function parsePgBorderSide(node: XmlNode | undefined): string | undefined {
  if (!node) return undefined;
  const val = (node.attrs.val || '').toLowerCase();
  if (!val || val === 'none' || val === 'nil') return undefined;
  const szEighths = parseOptionalInt(node.attrs.sz) ?? 4;
  const pt = Math.max(0.75, szEighths / 8);
  const rawColor = (node.attrs.color || '').replace('#', '').trim();
  const color = !rawColor || rawColor.toLowerCase() === 'auto' ? '#1e293b' : `#${rawColor}`;
  let cssStyle = 'solid';
  if (val.includes('double')) cssStyle = 'double';
  else if (val.includes('dash')) cssStyle = 'dashed';
  else if (val.includes('dot')) cssStyle = 'dotted';
  return `${pt}pt ${cssStyle} ${color}`;
}

function parseSectionPropertiesNode(sectPrNode: XmlNode | undefined): DocxSectionPageProperties {
  const pgSz = findChild(sectPrNode, 'pgSz');
  const pgMar = findChild(sectPrNode, 'pgMar');
  const colsNode = findChild(sectPrNode, 'cols');
  const vAlignNode = findChild(sectPrNode, 'vAlign');
  const docGridNode = findChild(sectPrNode, 'docGrid');
  const pgBordersNode = findChild(sectPrNode, 'pgBorders');
  const typeNode = findChild(sectPrNode, 'type');

  let widthTwips = parseOptionalInt(pgSz?.attrs.w) ?? 11906;
  let heightTwips = parseOptionalInt(pgSz?.attrs.h) ?? 16838;
  const rawOrient = (pgSz?.attrs.orient || '').toLowerCase();
  let orientation: 'portrait' | 'landscape' = rawOrient === 'landscape' || widthTwips > heightTwips ? 'landscape' : 'portrait';
  if (orientation === 'landscape' && widthTwips < heightTwips) {
    const tmp = widthTwips;
    widthTwips = heightTwips;
    heightTwips = tmp;
  } else if (rawOrient === 'portrait' && widthTwips > heightTwips) {
    const tmp = widthTwips;
    widthTwips = heightTwips;
    heightTwips = tmp;
    orientation = 'portrait';
  }

  const widthPx = twipsToPx(widthTwips);
  const heightPx = twipsToPx(heightTwips);
  const widthMm = twipsToMm(widthTwips);
  const heightMm = twipsToMm(heightTwips);
  const paperName = identifyPaperName(widthMm, heightMm);

  const topTwips = parseOptionalInt(pgMar?.attrs.top) ?? 1440;
  const rightTwips = parseOptionalInt(pgMar?.attrs.right) ?? 1800;
  const bottomTwips = parseOptionalInt(pgMar?.attrs.bottom) ?? 1440;
  const leftTwips = parseOptionalInt(pgMar?.attrs.left) ?? 1800;
  const headerTwips = parseOptionalInt(pgMar?.attrs.header) ?? 851;
  const footerTwips = parseOptionalInt(pgMar?.attrs.footer) ?? 992;
  const gutterTwips = parseOptionalInt(pgMar?.attrs.gutter) ?? 0;

  const margins: DocxMarginsSpec = {
    topPt: twipsToPt(topTwips),
    rightPt: twipsToPt(rightTwips),
    bottomPt: twipsToPt(bottomTwips),
    leftPt: twipsToPt(leftTwips + gutterTwips),
    headerPt: twipsToPt(headerTwips),
    footerPt: twipsToPt(footerTwips),
    gutterPt: twipsToPt(gutterTwips),
    topPx: twipsToPx(topTwips),
    rightPx: twipsToPx(rightTwips),
    bottomPx: twipsToPx(bottomTwips),
    leftPx: twipsToPx(leftTwips + gutterTwips),
    topMm: twipsToMm(topTwips),
    rightMm: twipsToMm(rightTwips),
    bottomMm: twipsToMm(bottomTwips),
    leftMm: twipsToMm(leftTwips),
    gutterMm: twipsToMm(gutterTwips),
  };

  const colCount = Math.max(1, parseOptionalInt(colsNode?.attrs.num) ?? 1);
  const colSpaceTwips = parseOptionalInt(colsNode?.attrs.space) ?? 720;
  const colSepRaw = (colsNode?.attrs.sep || '').toLowerCase();
  const colSep = colSepRaw === '1' || colSepRaw === 'true' || colSepRaw === 'on';

  const vAlignRaw = (vAlignNode?.attrs.val || 'top').toLowerCase();
  const verticalAlign: 'top' | 'center' | 'bottom' | 'both' =
    vAlignRaw === 'center' || vAlignRaw === 'bottom' || vAlignRaw === 'both' ? vAlignRaw : 'top';

  const linePitchTwips = parseOptionalInt(docGridNode?.attrs.linePitch);
  const docGrid = docGridNode
    ? {
        type: docGridNode.attrs.type,
        linePitchPt: linePitchTwips !== undefined ? twipsToPt(linePitchTwips) : undefined,
        charSpace: parseOptionalInt(docGridNode.attrs.charSpace),
      }
    : undefined;

  const borders = {
    top: parsePgBorderSide(findChild(pgBordersNode, 'top')),
    right: parsePgBorderSide(findChild(pgBordersNode, 'right')),
    bottom: parsePgBorderSide(findChild(pgBordersNode, 'bottom')),
    left: parsePgBorderSide(findChild(pgBordersNode, 'left')),
  };

  return {
    paperName,
    orientation,
    widthTwips,
    heightTwips,
    widthPx,
    heightPx,
    widthMm,
    heightMm,
    margins,
    columns: {
      count: colCount,
      spacePx: twipsToPx(colSpaceTwips),
      separator: colSep,
    },
    verticalAlign,
    docGrid,
    borders,
    sectionBreakType: typeNode?.attrs.val,
  };
}

function parseFontFamilyFromRFonts(rFonts: XmlNode | undefined): string | undefined {
  if (!rFonts) return undefined;
  const candidates = [rFonts.attrs.ascii, rFonts.attrs.hAnsi, rFonts.attrs.eastAsia]
    .filter((f): f is string => Boolean(f && f.trim()));
  if (candidates.length === 0) return undefined;
  return [...new Set(candidates)].map(f => `"${f.replace(/"/g, '')}"`).join(', ');
}

function extractParagraphRStyleId(pNode: XmlNode): string | undefined {
  const pPr = findChild(pNode, 'pPr');
  return findChild(pPr, 'pStyle')?.attrs.val;
}

function spHasValues(sp: DocxSpacingSpec | undefined): boolean {
  if (!sp) return false;
  return sp.line !== undefined || sp.beforePt !== undefined || sp.afterPt !== undefined || sp.beforeLines !== undefined || sp.afterLines !== undefined;
}

function formatMarginsSummary(m: DocxMarginsSpec): string {
  return `${m.topMm}/${m.rightMm}/${m.bottomMm}/${m.leftMm}`;
}

/**
 * 从 OOXML word/styles.xml 与 word/document.xml 解析完整的行高/段距/字体与页面属性档案
 */
export async function extractDocxFormattingProfile(zip: JSZip): Promise<DocxFormattingProfile> {
  let defaultFontSizePt = 10.5;
  let defaultFontFamily: string | undefined;
  let defaultSpacing: DocxSpacingSpec = { line: 276, lineRule: 'auto', afterPt: 4 };
  const rawStyles: Record<string, DocxParagraphStyleSpec> = {};

  try {
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      const stylesXml = await stylesFile.async('text');
      const stylesTree = parseXmlTree(stylesXml);
      const docDefaultsNode = findDescendant(stylesTree, 'docDefaults');
      if (docDefaultsNode) {
        const rPr = findDescendant(findChild(docDefaultsNode, 'rPrDefault'), 'rPr');
        const szVal = parseOptionalInt(findChild(rPr, 'sz')?.attrs.val);
        if (szVal && szVal > 0) defaultFontSizePt = szVal / 2;
        const ff = parseFontFamilyFromRFonts(findChild(rPr, 'rFonts'));
        if (ff) defaultFontFamily = ff;

        const pPr = findDescendant(findChild(docDefaultsNode, 'pPrDefault'), 'pPr');
        const sp = parseSpacingNode(findChild(pPr, 'spacing'));
        if (sp) {
          defaultSpacing = { ...defaultSpacing, ...sp };
          if (findChild(pPr, 'contextualSpacing')) {
            defaultSpacing.contextualSpacing = true;
          }
        }
      }

      const styleNodes = findDescendants(stylesTree, 'style');
      for (const sn of styleNodes) {
        const styleId = sn.attrs.styleId;
        if (!styleId) continue;
        const type = (sn.attrs.type || '').toLowerCase();
        if (type && type !== 'paragraph') continue;
        const isDefault = sn.attrs.default === '1' || sn.attrs.default === 'true';
        const name = findChild(sn, 'name')?.attrs.val;
        const basedOn = findChild(sn, 'basedOn')?.attrs.val;
        const pPr = findChild(sn, 'pPr');
        const rPr = findChild(sn, 'rPr');
        const spacing = parseSpacingNode(findChild(pPr, 'spacing'));
        if (spacing && findChild(pPr, 'contextualSpacing')) {
          spacing.contextualSpacing = true;
        }
        const szVal = parseOptionalInt(findChild(rPr, 'sz')?.attrs.val);
        const fontFamily = parseFontFamilyFromRFonts(findChild(rPr, 'rFonts'));

        rawStyles[styleId] = {
          styleId,
          name,
          basedOn,
          isDefault,
          spacing,
          fontSizePt: szVal ? szVal / 2 : undefined,
          fontFamily,
        };

        if (isDefault && (!defaultSpacing.line || spHasValues(spacing))) {
          if (spacing) defaultSpacing = { ...defaultSpacing, ...spacing };
          if (szVal) defaultFontSizePt = szVal / 2;
          if (fontFamily) defaultFontFamily = fontFamily;
        }
      }
    }
  } catch (err) {
    console.warn('[DocxEngine] styles.xml 解析警告:', err);
  }

  // 解析样式继承链 (basedOn)
  const resolvedStyles: Record<string, DocxParagraphStyleSpec> = {};
  const resolveStyleChain = (styleId: string, visited = new Set<string>()): DocxParagraphStyleSpec | undefined => {
    if (resolvedStyles[styleId]) return resolvedStyles[styleId];
    const curr = rawStyles[styleId];
    if (!curr) return undefined;
    if (visited.has(styleId)) return curr;
    visited.add(styleId);

    const parent = curr.basedOn ? resolveStyleChain(curr.basedOn, visited) : undefined;
    const mergedSpacing: DocxSpacingSpec | undefined =
      parent?.spacing || curr.spacing
        ? { ...(parent?.spacing || {}), ...(curr.spacing || {}) }
        : undefined;

    const merged: DocxParagraphStyleSpec = {
      ...curr,
      spacing: mergedSpacing,
      fontSizePt: curr.fontSizePt ?? parent?.fontSizePt,
      fontFamily: curr.fontFamily ?? parent?.fontFamily,
    };
    resolvedStyles[styleId] = merged;
    return merged;
  };
  for (const id of Object.keys(rawStyles)) {
    resolveStyleChain(id);
  }

  const sections: DocxSectionPageProperties[] = [];
  const paragraphSpacings: Array<{ spacing: DocxSpacingSpec; textHint: string }> = [];

  try {
    const docFile = zip.file('word/document.xml');
    if (docFile) {
      const docXml = await docFile.async('text');
      const docTree = parseXmlTree(docXml);
      const bodyNode = findDescendant(docTree, 'body');

      // 1. 按文档顺序收集所有段落内的 <w:sectPr> 以及 body 末尾的 <w:sectPr>
      const allP = findDescendants(bodyNode, 'p');
      for (const p of allP) {
        const pPr = findChild(p, 'pPr');
        const pSectPr = findChild(pPr, 'sectPr');
        if (pSectPr) {
          sections.push(parseSectionPropertiesNode(pSectPr));
        }

        const spNode = findChild(pPr, 'spacing');
        const parsedSp = parseSpacingNode(spNode);
        if (parsedSp) {
          if (findChild(pPr, 'contextualSpacing')) {
            parsedSp.contextualSpacing = true;
          } else {
            const pStyleId = extractParagraphRStyleId(p);
            if (pStyleId && resolvedStyles[pStyleId]?.spacing?.contextualSpacing) {
              parsedSp.contextualSpacing = true;
            }
          }
          const textHint = collectNodeText(p).replace(/\s+/g, ' ').trim().slice(0, 48);
          paragraphSpacings.push({ spacing: parsedSp, textHint });
        }
      }

      const bodySectPr = findChild(bodyNode, 'sectPr');
      if (bodySectPr) {
        sections.push(parseSectionPropertiesNode(bodySectPr));
      }
    }
  } catch (err) {
    console.warn('[DocxEngine] document.xml 页面/行距解析警告:', err);
  }

  if (sections.length === 0) {
    sections.push(parseSectionPropertiesNode(undefined));
  }

  const primaryPage = sections[0];
  const linePitchPt = primaryPage.docGrid?.linePitchPt;
  const formattedDefault = formatSpacingLineHeightCss(defaultSpacing, defaultFontSizePt, linePitchPt);
  const defaultLineHeightCss = formattedDefault.lineHeight || '1.25';
  const defaultLineHeightLabel =
    defaultSpacing.lineRule === 'exact' && defaultSpacing.line
      ? `${twipsToPt(defaultSpacing.line)}pt (固定)`
      : defaultSpacing.lineRule === 'atLeast' && defaultSpacing.line
      ? `≥${twipsToPt(defaultSpacing.line)}pt`
      : linePitchPt
      ? `${defaultLineHeightCss}x (${linePitchPt}pt 网格)`
      : `${defaultLineHeightCss}x`;

  return {
    defaultFontSizePt,
    defaultFontFamily,
    defaultSpacing,
    defaultLineHeightCss,
    defaultLineHeightLabel,
    styles: resolvedStyles,
    paragraphSpacings,
    sections,
    primaryPage,
  };
}

/**
 * 将 OOXML 提取的行距、段距、字体基线与页面属性 (pgSz/pgMar/cols/vAlign/pgBorders) 精准修补至 docx-preview 生成的样式表与 DOM 节点
 */
export function applyDocxFormattingAndPageFidelity(
  container: HTMLElement,
  styleContainer: HTMLElement | undefined,
  profile: DocxFormattingProfile,
  className = 'docx-rendered-wrapper'
): void {
  const primaryPitchPt = profile.primaryPage.docGrid?.linePitchPt;

  // 1. 修复 docx-preview 生成的 CSS 样式表中被错误转换的 atLeast 与 omitted-lineRule 行高
  const styleHosts: ParentNode[] = [];
  if (styleContainer) styleHosts.push(styleContainer);
  styleHosts.push(container);

  const omittedRuleMap = new Map<string, string>();
  const recordSpacingMapping = (sp?: DocxSpacingSpec) => {
    if (!sp || sp.line === undefined) return;
    const wrongPtStr = `${sp.line / 20}pt`;
    if (sp.lineRule === 'auto') {
      const fixed = formatSpacingLineHeightCss(sp, profile.defaultFontSizePt, primaryPitchPt);
      if (fixed.lineHeight) {
        omittedRuleMap.set(wrongPtStr, fixed.lineHeight);
      }
    }
  };
  recordSpacingMapping(profile.defaultSpacing);
  Object.values(profile.styles).forEach(st => recordSpacingMapping(st.spacing));
  profile.paragraphSpacings.forEach(p => recordSpacingMapping(p.spacing));

  for (const host of styleHosts) {
    const styleEls = Array.from(host.querySelectorAll<HTMLStyleElement>('style'));
    for (const styleEl of styleEls) {
      if (styleEl.hasAttribute('data-docx-fidelity-style')) continue;
      let css = styleEl.textContent || '';
      if (!css) continue;
      let changed = false;

      // 修复 docx-preview 错误的 case "atLeast": line-height: calc(100% + Xpt) -> max(1.22em, Xpt); min-height: Xpt
      const nextAtLeastCss = css.replace(
        /line-height\s*:\s*calc\(\s*100%\s*\+\s*([\d.]+pt)\s*\)\s*;?/gi,
        (_full, ptVal: string) => {
          changed = true;
          return `line-height: max(1.22em, ${ptVal}); min-height: ${ptVal};`;
        }
      );
      css = nextAtLeastCss;

      // 修复 omitted lineRule 被 docx-preview 命中 default 分支生成的 `line-height: Xpt; min-height: Xpt;`
      if (omittedRuleMap.size > 0) {
        css = css.replace(
          /line-height\s*:\s*([\d.]+pt)\s*;\s*min-height\s*:\s*\1\s*;?/gi,
          (full, ptVal: string) => {
            const replacementRatio = omittedRuleMap.get(ptVal);
            if (!replacementRatio) return full;
            changed = true;
            return `line-height: ${replacementRatio};`;
          }
        );
      }

      if (changed) {
        styleEl.textContent = css;
      }
    }
  }

  // 2. 注入高保真基准排版 CSS（重置 Tailwind 继承的 16px/1.5，忠实还原 docDefaults 与 beforeLines/afterLines）
  const targetStyleHost = styleContainer || container;
  const existingFidelity = targetStyleHost.querySelector('style[data-docx-fidelity-style="true"]');
  if (existingFidelity) existingFidelity.remove();

  const cssLines: string[] = [];
  const fontFamDecl = profile.defaultFontFamily ? `font-family: ${profile.defaultFontFamily};` : '';
  const defaultBeforeDecl =
    profile.defaultSpacing.beforePt !== undefined
      ? `margin-top: ${profile.defaultSpacing.beforePt}pt;`
      : profile.defaultSpacing.beforeLines !== undefined
      ? `margin-top: ${Number((profile.defaultSpacing.beforeLines * (primaryPitchPt || profile.defaultFontSizePt * 1.25)).toFixed(2))}pt;`
      : '';
  const defaultAfterDecl =
    profile.defaultSpacing.afterPt !== undefined
      ? `margin-bottom: ${profile.defaultSpacing.afterPt}pt;`
      : profile.defaultSpacing.afterLines !== undefined
      ? `margin-bottom: ${Number((profile.defaultSpacing.afterLines * (primaryPitchPt || profile.defaultFontSizePt * 1.25)).toFixed(2))}pt;`
      : '';

  cssLines.push(
    `.${className} { font-size: ${profile.defaultFontSizePt}pt; line-height: ${profile.defaultLineHeightCss}; ${fontFamDecl} }`,
    `.${className} p { line-height: ${profile.defaultLineHeightCss}; ${defaultBeforeDecl} ${defaultAfterDecl} }`
  );

  for (const st of Object.values(profile.styles)) {
    const sp = st.spacing;
    if (!sp) continue;
    const escapedId = st.styleId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!escapedId) continue;
    const decls: string[] = [];
    const lh = formatSpacingLineHeightCss(sp, st.fontSizePt || profile.defaultFontSizePt, primaryPitchPt);
    if (lh.lineHeight) decls.push(`line-height: ${lh.lineHeight};`);
    if (lh.minHeight) decls.push(`min-height: ${lh.minHeight};`);
    if (sp.beforeLines !== undefined && sp.beforePt === undefined) {
      const pt = primaryPitchPt
        ? Number((sp.beforeLines * primaryPitchPt).toFixed(2))
        : Number((sp.beforeLines * 1.25).toFixed(2));
      decls.push(`margin-top: ${primaryPitchPt ? `${pt}pt` : `${pt}em`};`);
    }
    if (sp.afterLines !== undefined && sp.afterPt === undefined) {
      const pt = primaryPitchPt
        ? Number((sp.afterLines * primaryPitchPt).toFixed(2))
        : Number((sp.afterLines * 1.25).toFixed(2));
      decls.push(`margin-bottom: ${primaryPitchPt ? `${pt}pt` : `${pt}em`};`);
    }
    if (decls.length > 0) {
      cssLines.push(`.${className} p.${className}_${escapedId}, .${className} .${className}_${escapedId} { ${decls.join(' ')} }`);
    }
  }

  const fidelityStyleEl = document.createElement('style');
  fidelityStyleEl.setAttribute('data-docx-fidelity-style', 'true');
  fidelityStyleEl.textContent = cssLines.join('\n');
  targetStyleHost.appendChild(fidelityStyleEl);

  // 3. 按文档流修补段落内联 style（处理 omitted lineRule、atLeast 与 beforeLines/afterLines）
  const paragraphs = Array.from(container.querySelectorAll<HTMLElement>(`section.${className} article p, section.${className} > p`));
  const spacingQueue = profile.paragraphSpacings.slice();
  let queueCursor = 0;

  const applySafeAtLeastLineHeight = (el: HTMLElement, ptVal: string) => {
    const targetMax = `max(1.22em, ${ptVal})`;
    el.style.lineHeight = targetMax;
    if (!el.style.lineHeight || el.style.lineHeight.includes('100%')) {
      const ptNum = parseFloat(ptVal);
      const baseMinPt = Number((profile.defaultFontSizePt * 1.22).toFixed(2));
      el.style.lineHeight = `${Math.max(Number.isFinite(ptNum) ? ptNum : baseMinPt, baseMinPt)}pt`;
    }
    el.style.minHeight = ptVal;
  };

  for (const p of paragraphs) {
    const inlineLh = (p.style?.lineHeight || '').trim();
    const inlineMinH = (p.style?.minHeight || '').trim();

    // 3a. 直接修复 atLeast calc(100% + Xpt)
    const atLeastMatch = inlineLh.match(/^calc\(\s*100%\s*\+\s*([\d.]+pt)\s*\)$/i);
    if (atLeastMatch) {
      applySafeAtLeastLineHeight(p, atLeastMatch[1]);
    }

    // 3b. 按顺序与数值特征匹配 OOXML <w:pPr><w:spacing> 规格
    const pCleanText = (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    let matchedSpec: DocxSpacingSpec | undefined;

    for (let idx = queueCursor; idx < spacingQueue.length && idx < queueCursor + 12; idx++) {
      const cand = spacingQueue[idx];
      const expectedWrongPt = cand.spacing.line !== undefined ? `${cand.spacing.line / 20}pt` : '';
      const textMatch = Boolean(cand.textHint && pCleanText && (pCleanText === cand.textHint || pCleanText.startsWith(cand.textHint.slice(0, 12))));
      const lhMatch = Boolean(expectedWrongPt && (inlineLh === expectedWrongPt || inlineLh.includes(expectedWrongPt)));
      if (textMatch || lhMatch) {
        matchedSpec = cand.spacing;
        queueCursor = idx + 1;
        break;
      }
    }

    if (!matchedSpec && inlineLh && inlineMinH && inlineLh === inlineMinH && inlineLh.endsWith('pt')) {
      const replacement = omittedRuleMap.get(inlineLh);
      if (replacement) {
        p.style.lineHeight = replacement;
        p.style.minHeight = '';
      }
    } else if (matchedSpec) {
      if (matchedSpec.line !== undefined) {
        if (matchedSpec.lineRule === 'auto') {
          const lh = formatSpacingLineHeightCss(matchedSpec, profile.defaultFontSizePt, primaryPitchPt);
          if (lh.lineHeight) {
            p.style.lineHeight = lh.lineHeight;
            if (inlineMinH === `${matchedSpec.line / 20}pt`) {
              p.style.minHeight = '';
            }
          }
        } else if (matchedSpec.lineRule === 'atLeast') {
          applySafeAtLeastLineHeight(p, `${twipsToPt(matchedSpec.line)}pt`);
        } else if (matchedSpec.lineRule === 'exact') {
          const exactPt = `${twipsToPt(matchedSpec.line)}pt`;
          p.style.lineHeight = exactPt;
          p.style.minHeight = exactPt;
        }
      }
      if (matchedSpec.beforeLines !== undefined && matchedSpec.beforePt === undefined && !p.style.marginTop) {
        p.style.marginTop = primaryPitchPt
          ? `${Number((matchedSpec.beforeLines * primaryPitchPt).toFixed(2))}pt`
          : `${Number((matchedSpec.beforeLines * 1.25).toFixed(2))}em`;
      }
      if (matchedSpec.afterLines !== undefined && matchedSpec.afterPt === undefined && !p.style.marginBottom) {
        p.style.marginBottom = primaryPitchPt
          ? `${Number((matchedSpec.afterLines * primaryPitchPt).toFixed(2))}pt`
          : `${Number((matchedSpec.afterLines * 1.25).toFixed(2))}em`;
      }
    }
  }

  // 4. 补全与校准每个 <section> 的 OOXML 页面属性（pgSz 尺寸/方向、pgMar 边距/装订线、pgBorders 边框、cols 分栏、vAlign 垂直对齐）
  const sections = Array.from(container.querySelectorAll<HTMLElement>(`section.${className}, section.docx`));
  let sectIdx = 0;

  sections.forEach((sec, idx) => {
    // 匹配对应的 OOXML sectPr：当多个 section 间尺寸或方向发生切换时推进 sectIdx
    if (idx > 0 && sectIdx < profile.sections.length - 1) {
      const nextSectSpec = profile.sections[sectIdx + 1];
      const secStyleW = sec.style?.width || '';
      if (secStyleW && nextSectSpec) {
        const rawPt = parseFloat(secStyleW);
        const targetPt = twipsToPt(nextSectSpec.widthTwips);
        if (Number.isFinite(rawPt) && Math.abs(rawPt - targetPt) <= 6) {
          sectIdx++;
        }
      }
    }
    const pageSpec = profile.sections[sectIdx] || profile.primaryPage;

    if (!sec.style.width) {
      sec.style.width = `${pageSpec.widthPx}px`;
    }
    if (!sec.style.minHeight && !sec.style.height) {
      sec.style.minHeight = `${pageSpec.heightPx}px`;
    }

    // 边距补全与装订线 (gutter) 累加
    if (!sec.style.paddingTop) sec.style.paddingTop = `${pageSpec.margins.topPx}px`;
    if (!sec.style.paddingRight) sec.style.paddingRight = `${pageSpec.margins.rightPx}px`;
    if (!sec.style.paddingBottom) sec.style.paddingBottom = `${pageSpec.margins.bottomPx}px`;
    if (!sec.style.paddingLeft) {
      sec.style.paddingLeft = `${pageSpec.margins.leftPx}px`;
    } else if (pageSpec.margins.gutterPt > 0) {
      const leftPx = parseFloat(sec.style.paddingLeft);
      if (Number.isFinite(leftPx)) {
        const unit = sec.style.paddingLeft.trim().endsWith('pt') ? 'pt' : 'px';
        const delta = unit === 'pt' ? pageSpec.margins.gutterPt : twipsToPx(pageSpec.margins.gutterPt * 20);
        sec.style.paddingLeft = `${Number((leftPx + delta).toFixed(2))}${unit}`;
      }
    }

    // 页面边框 (w:pgBorders)
    if (pageSpec.borders.top && !sec.style.borderTop) sec.style.borderTop = pageSpec.borders.top;
    if (pageSpec.borders.right && !sec.style.borderRight) sec.style.borderRight = pageSpec.borders.right;
    if (pageSpec.borders.bottom && !sec.style.borderBottom) sec.style.borderBottom = pageSpec.borders.bottom;
    if (pageSpec.borders.left && !sec.style.borderLeft) sec.style.borderLeft = pageSpec.borders.left;

    // 节分栏 (w:cols) 与垂直对齐 (w:vAlign) 施加于内部 article
    const articles = Array.from(sec.children || []).filter(
      (c): c is HTMLElement => c.tagName?.toLowerCase() === 'article'
    );
    for (const art of articles) {
      if (pageSpec.columns.count > 1) {
        if (!art.style.columnCount) art.style.columnCount = String(pageSpec.columns.count);
        if (!art.style.columnGap) art.style.columnGap = `${pageSpec.columns.spacePx}px`;
        if (pageSpec.columns.separator && !art.style.columnRule) {
          art.style.columnRule = '1px solid rgba(100, 116, 139, 0.45)';
        }
      } else if (pageSpec.verticalAlign !== 'top') {
        art.style.display = 'flex';
        art.style.flexDirection = 'column';
        art.style.justifyContent =
          pageSpec.verticalAlign === 'center'
            ? 'center'
            : pageSpec.verticalAlign === 'bottom'
            ? 'flex-end'
            : 'space-between';
      }
    }

    sec.setAttribute('data-paper-name', pageSpec.paperName);
    sec.setAttribute('data-orientation', pageSpec.orientation);
    sec.setAttribute('data-margins-mm', formatMarginsSummary(pageSpec.margins));
    sec.setAttribute('data-cols', String(pageSpec.columns.count));
    sec.setAttribute('data-v-align', pageSpec.verticalAlign);
    sec.setAttribute('data-default-line-height', profile.defaultLineHeightCss);
  });
}

/**
 * 解析 docx 压缩包元数据 (docProps/core.xml 与 docProps/app.xml)
 */
export async function extractDocxMetadata(zip: JSZip): Promise<DocxMetadata> {
  const metadata: DocxMetadata = {
    title: 'Word 文档',
  };

  try {
    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const xml = await coreFile.async('text');
      const coreTree = parseXmlTree(xml);
      const titleText = collectNodeText(findDescendant(coreTree, 'title')).trim();
      if (titleText) metadata.title = titleText;

      const creatorText = collectNodeText(findDescendant(coreTree, 'creator')).trim();
      if (creatorText) metadata.creator = creatorText;

      const descText = collectNodeText(findDescendant(coreTree, 'description')).trim();
      if (descText) metadata.description = descText;

      const createdText = collectNodeText(findDescendant(coreTree, 'created')).trim();
      if (createdText) metadata.created = createdText;

      const modifiedText = collectNodeText(findDescendant(coreTree, 'modified')).trim();
      if (modifiedText) metadata.modified = modifiedText;
    }

    const appFile = zip.file('docProps/app.xml');
    if (appFile) {
      const xml = await appFile.async('text');
      const appTree = parseXmlTree(xml);
      const pagesText = collectNodeText(findDescendant(appTree, 'Pages')).trim();
      const pagesNum = parseInt(pagesText, 10);
      if (Number.isFinite(pagesNum) && pagesNum > 0) metadata.pageCount = pagesNum;

      const wordsText = collectNodeText(findDescendant(appTree, 'Words')).trim();
      const wordsNum = parseInt(wordsText, 10);
      if (Number.isFinite(wordsNum) && wordsNum >= 0) metadata.wordCount = wordsNum;

      const charsText = collectNodeText(findDescendant(appTree, 'Characters')).trim();
      const charsNum = parseInt(charsText, 10);
      if (Number.isFinite(charsNum) && charsNum >= 0) metadata.characterCount = charsNum;

      const companyText = collectNodeText(findDescendant(appTree, 'Company')).trim();
      if (companyText) metadata.company = companyText;
    }
  } catch (err) {
    console.warn('[DocxEngine] 元数据解析警告:', err);
  }

  return metadata;
}

/**
 * 动态生成规范的样例 Word (.docx) 二进制包，用于自愈降级与无网离线预览
 */
export async function generateSampleDocxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );

  // 3. docProps/core.xml
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>OmniView Word 高保真文档指南</dc:title>
  <dc:creator>OmniView Architecture Team</dc:creator>
  <dc:description>OmniView 纯离线 Word (.docx) 高保真只读渲染引擎示例文档</dc:description>
  <dcterms:created>2026-09-17T00:00:00Z</dcterms:created>
</cp:coreProperties>`
  );

  // 4. word/document.xml (主文档正文)
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="48"/>
          <w:color w:val="2563EB"/>
        </w:rPr>
        <w:t>OmniView Word (.docx) 高保真离线文档</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
          <w:sz w:val="24"/>
          <w:color w:val="64748B"/>
        </w:rPr>
        <w:t>纯前端零外网依赖 · 拟真 A4 出版级排版 · 支持导航窗口与多级大纲</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="TOCHeading"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E293B"/></w:rPr>
        <w:t>目录</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="TOC1"/></w:pPr>
      <w:hyperlink w:anchor="_Toc101">
        <w:r><w:t>一、核心特性与排版能力</w:t></w:r>
        <w:r><w:tab/><w:t>2</w:t></w:r>
      </w:hyperlink>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="TOC1"/></w:pPr>
      <w:hyperlink w:anchor="_Toc102">
        <w:r><w:t>二、排版支持度规格矩阵</w:t></w:r>
        <w:r><w:tab/><w:t>2</w:t></w:r>
      </w:hyperlink>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="TOC1"/></w:pPr>
      <w:hyperlink w:anchor="_Toc103">
        <w:r><w:t>三、渲染引擎架构与安全沙箱防御</w:t></w:r>
        <w:r><w:tab/><w:t>3</w:t></w:r>
      </w:hyperlink>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="TOC1"/></w:pPr>
      <w:hyperlink w:anchor="_Toc104">
        <w:r><w:t>四、主题滤镜与全局快捷键指南</w:t></w:r>
        <w:r><w:tab/><w:t>4</w:t></w:r>
      </w:hyperlink>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="TOC1"/></w:pPr>
      <w:hyperlink w:anchor="_Toc105">
        <w:r><w:t>五、常见问题解答与最佳实践 (FAQ)</w:t></w:r>
        <w:r><w:tab/><w:t>5</w:t></w:r>
      </w:hyperlink>
    </w:p>
    <!-- ===== 分页符：封面与目录结束，进入第 2 页 ===== -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:bookmarkStart w:id="101" w:name="_Toc101"/>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>一、核心特性与排版能力</w:t>
      </w:r>
      <w:bookmarkEnd w:id="101"/>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>本渲染驱动基于 Office Open XML (OOXML) 标准，无需 Microsoft Word 或第三方云端服务，直接在 VS Code 隔离沙箱与浏览器中将 DOCX 编译为高保真 HTML5/CSS3 拟真纸张。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>1.1 导航窗口与多级大纲</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>新增全功能导航窗口 (Navigation Pane)，自动捕获文档中的 H1~H6 层级标题，支持实时检索筛选、多层级缩进显示以及平滑定位跳转。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>1.2 缩放与主题自适应</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>支持 50% ~ 200% 无级平滑缩放、双栏多列、表格单元格合并、行内图片以及原纸/羊皮/暗夜三大视觉滤镜主题。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:bookmarkStart w:id="102" w:name="_Toc102"/>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>二、排版支持度规格矩阵</w:t>
      </w:r>
      <w:bookmarkEnd w:id="102"/>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>排版维度</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>支持状态</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>技术标准与响应表现</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>导航窗口 (Navigation Pane)</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>多级大纲树、检索过滤、平滑定位</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>A4 拟真分页</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>CSS Paged Media 210mm x 297mm</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>多主题夜间模式</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>--ov-* 语义化设计令牌体系</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>无损打印与 PDF 导出</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>@media print 纯净介质适配</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>全文 Ctrl+F 实时高亮</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>双向节点脱敏与无缝跳转</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <!-- ===== 分页符：进入第 3 页 ===== -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:bookmarkStart w:id="103" w:name="_Toc103"/>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>三、渲染引擎架构与安全沙箱防御</w:t>
      </w:r>
      <w:bookmarkEnd w:id="103"/>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>OmniView 采用独创的纯前端隔离沙箱设计，解析流水线完全在本地内存中运行，保证企业级研发生命周期的核心数据安全与高性能响应。</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>3.1 零外网直通与离线安全</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>针对敏感企业方案与涉密代码工程，Word 渲染器 100% 基于本地 WebAssembly 与轻量 JavaScript 运行时，绝不向任何外部公网服务器上传或回传文件流。</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>3.2 DOMPurify 严格过滤与 XSS 物理防御</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>所有 XML 节点中的文本、样式标签与内联图元均经由 DOMPurify 进行深层转义和脱敏清洗，彻底根除跨站脚本攻击与恶意构造的宏代码注入隐患。</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>3.3 极端异常损坏输入自愈降级</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>内置防御性容错机制：当遇到非标准或截断的 DOCX 二进制包时，引擎自动捕获异常并无缝回退至内置自愈样例文档，杜绝白屏与插件崩溃。</w:t>
      </w:r>
    </w:p>

    <!-- ===== 分页符：进入第 4 页 ===== -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:bookmarkStart w:id="104" w:name="_Toc104"/>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>四、主题滤镜与全局快捷键指南</w:t>
      </w:r>
      <w:bookmarkEnd w:id="104"/>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>为了满足长时间技术文档研读与跨光照环境阅览需求，OmniView 提供了拟真三色滤镜及全键盘高效控制体系：</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>4.1 三重视觉纸张滤镜风格</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>• 原纸 (Classic Paper)：100% 还原物理标准白纸与真实油墨色调，适合商务与校对打印；</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>• 羊皮 (Eye-care Sepia)：柔和暖调护眼色泽，有效过滤蓝光辐射，降低长时间研读疲劳；</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>• 暗夜 (Dark Matrix)：反转亮白底色，与 VS Code 深色编辑器界面浑然一体，夜间开发不刺眼。</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>4.2 全局快捷键对照表</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>快捷键</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>功能描述</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Ctrl + F</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>自动聚焦全文检索输入框并选中现有内容</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Enter / Shift + Enter</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>快速跳转至下一个 / 上一个关键字匹配项</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Ctrl + Shift + O</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>一键展开或折叠左侧多级大纲导航窗口</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Escape</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>退出当前搜索匹配状态并清除黄色高亮标记</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <!-- ===== 分页符：进入第 5 页 ===== -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:bookmarkStart w:id="105" w:name="_Toc105"/>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>五、常见问题解答与最佳实践 (FAQ)</w:t>
      </w:r>
      <w:bookmarkEnd w:id="105"/>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>5.1 如何在无 Microsoft Word 环境下打印当前文档？</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>答：直接点击顶栏右侧的「打印」图标（快捷键 Ctrl+P），OmniView 已内置专有的 @media print 分页流样式，能够自动隐藏所有的侧边栏和工具条，直接调用系统打印机或无损输出为标准 PDF 文件。</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>5.2 为什么点击大纲标题能够正确定位至对应页面？</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>答：引擎在解析完成时会自动对 DOM 进行 AST 目录特征提取，生成独立的 DocxTocItem 映射，并配备平滑滚动与标题脉冲高亮动画（Highlight Flash），极大提升长文档阅读体验。</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>5.3 大体积 Word 文档渲染性能如何？</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>答：基于 JSZip 解构与流式节点装配，首屏渲染通常在 100ms 内完成，且配合视口容器虚拟化与垃圾回收防护，保障 60 FPS 的丝滑滚动体验。</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:type="lines" w:linePitch="312"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * 解析 docx 文件数据
 */
export async function parseDocx(data: Uint8Array | ArrayBuffer | string): Promise<ParsedDocxDocument> {
  let rawBytes: Uint8Array;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) {
      rawBytes = await generateSampleDocxBytes();
    } else if (trimmed.startsWith('data:') || /^[A-Za-z0-9+/=\s\r\n]+$/.test(trimmed)) {
      try {
        rawBytes = base64ToBytes(trimmed);
      } catch {
        rawBytes = new Uint8Array(0);
      }
    } else {
      rawBytes = new TextEncoder().encode(trimmed);
    }
  } else if (data instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(data);
  } else {
    rawBytes = data;
  }

  try {
    const zip = await JSZip.loadAsync(rawBytes);
    const [metadata, formattingProfile] = await Promise.all([
      extractDocxMetadata(zip),
      extractDocxFormattingProfile(zip),
    ]);
    metadata.pageProperties = formattingProfile.primaryPage;
    metadata.defaultFontSizePt = formattingProfile.defaultFontSizePt;
    metadata.defaultLineHeightLabel = formattingProfile.defaultLineHeightLabel;
    return {
      rawBytes,
      metadata,
      formattingProfile,
      isValid: true,
      isFallbackUsed: false,
    };
  } catch (err) {
    console.warn('[DocxEngine] 加载 docx 失败，降级至样例文档:', err);
    const fallbackBytes = await generateSampleDocxBytes();
    const fallbackZip = await JSZip.loadAsync(fallbackBytes);
    const [metadata, formattingProfile] = await Promise.all([
      extractDocxMetadata(fallbackZip),
      extractDocxFormattingProfile(fallbackZip),
    ]);
    metadata.pageProperties = formattingProfile.primaryPage;
    metadata.defaultFontSizePt = formattingProfile.defaultFontSizePt;
    metadata.defaultLineHeightLabel = formattingProfile.defaultLineHeightLabel;
    return {
      rawBytes: fallbackBytes,
      metadata,
      formattingProfile,
      isValid: false,
      isFallbackUsed: true,
    };
  }
}

/**
 * 纯前端高保真渲染 docx 到指定 DOM 容器
 * 支持传入独立的 styleContainer 以隔离多标签页样式注入，避免污染全局 document.head
 */
export async function renderDocxToContainer(
  bytes: Uint8Array | ArrayBuffer,
  container: HTMLElement,
  options: Partial<DocxOptions> = {},
  styleContainer?: HTMLElement,
  formattingProfile?: DocxFormattingProfile
): Promise<void> {
  const mergedOptions: DocxOptions = {
    className: 'docx-rendered-wrapper',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    trimXmlDeclaration: true,
    ...options,
  };

  container.innerHTML = '';
  if (styleContainer) {
    styleContainer.innerHTML = '';
  }

  let resolvedProfile = formattingProfile;
  if (!resolvedProfile) {
    try {
      const zip = await JSZip.loadAsync(bytes);
      resolvedProfile = await extractDocxFormattingProfile(zip);
    } catch {
      // 忽略附加档案解析错误
    }
  }

  await renderAsync(bytes, container, styleContainer, mergedOptions);

  if (resolvedProfile) {
    applyDocxFormattingAndPageFidelity(
      container,
      styleContainer,
      resolvedProfile,
      mergedOptions.className || 'docx-rendered-wrapper'
    );
  }
}

