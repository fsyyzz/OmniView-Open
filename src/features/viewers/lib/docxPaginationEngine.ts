/**
 * OmniView 原生 Word (.docx) 物理页面排版与自然分页引擎
 * 针对未显式包含 hard page break 的长文档，基于 docProps/app.xml 原始页数、
 * 物理纸张高度 (A4 210mm x 297mm) 与 DOM 测量进行智能多页切分，
 * 彻底解决长文档全部堆积在单页的问题。
 * 
 * 作者: 周赞
 */

import type { DocxSectionPageProperties } from './docxEngine';

export interface DocxPaginationOptions {
  /** docx 元数据中声明的官方总页数 (来自 docProps/app.xml <Pages>) */
  expectedPageCount?: number;
  /** 单页物理宽度 (px，默认 794px 对应 210mm @ 96DPI) */
  pageWidth?: number;
  /** 单页物理高度 (px，默认 1123px 对应 297mm @ 96DPI) */
  pageHeight?: number;
  /** OOXML 解析出的首页页面属性基准 */
  pageProperties?: DocxSectionPageProperties;
  /** 是否强制应用分页拆分 */
  force?: boolean;
  /** 界面语言，用于页码角标文案 */
  locale?: 'zh-CN' | 'en-US';
}

export interface DocxPaginationResult {
  /** 切分后的实际总页数 */
  totalPages: number;
  /** 是否执行了跨页拆分 */
  paginated: boolean;
}

export interface DocxPageSummary {
  /** 页码 (1-indexed) */
  pageNumber: number;
  /** 本页主标题或首行摘要 */
  title: string;
  /** 本页正文预览摘要 */
  snippet: string;
  /** 对应的页面 DOM 节点 */
  element: HTMLElement;
}

// 标准 A4 纸张物理尺寸常数 (96 DPI: 1 inch = 96px, 1mm = 96 / 25.4 ≈ 3.7795px)
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const A4_DEFAULT_MARGIN_V_PX = 96; // 上下边距默认 25.4mm (1 inch = 72pt = 96px)
export const A4_CONTENT_HEIGHT_PX = A4_HEIGHT_PX - A4_DEFAULT_MARGIN_V_PX * 2; // 可用正文高度约 931px

/**
 * 常见标准纸张规格表（96 DPI 下像素宽高，容差 ±18px 自动对齐至严格标准尺寸）
 */
const STANDARD_PAPER_SPECS: Array<{ w: number; h: number }> = [
  { w: 794, h: 1123 },  // A4 竖版 (210mm × 297mm)
  { w: 1123, h: 794 },  // A4 横版 (297mm × 210mm)
  { w: 816, h: 1056 },  // US Letter 竖版 (8.5in × 11in)
  { w: 1056, h: 816 },  // US Letter 横版
  { w: 816, h: 1344 },  // US Legal 竖版 (8.5in × 14in)
  { w: 665, h: 945 },   // JIS B5 / ISO B5 竖版
  { w: 559, h: 794 },   // A5 竖版
  { w: 1123, h: 1587 }, // A3 竖版
];

/**
 * 将 docx-preview 生成的 CSS 长度单位 (pt / mm / cm / in / pc / px) 精确换算为 96 DPI 下的像素值 (px)
 * 解决 docx-preview 默认输出 595.3pt / 841.9pt 被 parseFloat 误当成 px 导致页面缩小 25% 的缺陷
 */
export function parseCssLengthToPx(value: string | undefined | null, fallbackPx: number): number {
  if (!value) return fallbackPx;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed || trimmed.startsWith('calc(') || trimmed === 'auto') return fallbackPx;
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num) || num <= 0) return fallbackPx;
  if (trimmed.endsWith('pt')) return Math.round(num * (96 / 72));
  if (trimmed.endsWith('mm')) return Math.round(num * (96 / 25.4));
  if (trimmed.endsWith('cm')) return Math.round(num * (96 / 2.54));
  if (trimmed.endsWith('in')) return Math.round(num * 96);
  if (trimmed.endsWith('pc')) return Math.round(num * 16);
  return Math.round(num);
}

/**
 * 规范化文档单页物理尺寸，确保无论本页内容多少，页面宽高始终严格符合标准纸张比例 (默认 A4 794×1123)
 */
export function resolveStandardPageDimensions(
  section: HTMLElement,
  options: DocxPaginationOptions = {}
): { width: number; height: number } {
  const defaultW = options.pageWidth || options.pageProperties?.widthPx || A4_WIDTH_PX;
  const defaultH = options.pageHeight || options.pageProperties?.heightPx || A4_HEIGHT_PX;
  const rawW = parseCssLengthToPx(section.style?.width, defaultW);
  const rawH = parseCssLengthToPx(section.style?.minHeight || section.style?.height, defaultH);

  // 若节声明宽高在合理纸张范围内 (420~1650 x 500~2200)，对齐最接近的标准纸张规格或保留原生纸张比例
  const inPrintableBounds = rawW >= 420 && rawW <= 1650 && rawH >= 500 && rawH <= 2200;
  if (!inPrintableBounds) {
    // 若宽度明显大于高度（横版），使用标准 A4 横版，否则使用标准 A4 竖版
    return rawW > rawH + 80
      ? { width: A4_HEIGHT_PX, height: A4_WIDTH_PX }
      : { width: defaultW, height: defaultH };
  }

  for (const spec of STANDARD_PAPER_SPECS) {
    if (Math.abs(rawW - spec.w) <= 18 && Math.abs(rawH - spec.h) <= 18) {
      return { width: spec.w, height: spec.h };
    }
  }

  return { width: rawW, height: rawH };
}

/**
 * 对单页 DOM 节点强制施加标准固定物理尺寸，避免页面因内容多少而变高、变矮或变宽
 */
function applyStandardSheetGeometry(sheet: HTMLElement, width: number, height: number): void {
  const s = sheet.style;
  if (s && typeof s.setProperty === 'function') {
    s.setProperty('width', `${width}px`, 'important');
    s.setProperty('min-width', `${width}px`, 'important');
    s.setProperty('max-width', `${width}px`, 'important');
    s.setProperty('height', `${height}px`, 'important');
    s.setProperty('min-height', `${height}px`, 'important');
    s.setProperty('max-height', `${height}px`, 'important');
    s.setProperty('box-sizing', 'border-box', 'important');
    s.setProperty('overflow', 'hidden', 'important');
    s.setProperty('position', 'relative', 'important');
  } else if (s) {
    s.width = `${width}px`;
    s.minWidth = `${width}px`;
    s.maxWidth = `${width}px`;
    s.height = `${height}px`;
    s.minHeight = `${height}px`;
    s.maxHeight = `${height}px`;
    s.boxSizing = 'border-box';
    s.overflow = 'hidden';
    s.position = 'relative';
  }
  sheet.setAttribute('data-page-width', String(width));
  sheet.setAttribute('data-page-height', String(height));
}

/**
 * 格式化页码角标文本
 */
function formatPageBadgeText(pageNum: number, total: number, locale: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  if (locale === 'en-US') {
    return `Page ${pageNum} / ${total}`;
  }
  return `第 ${pageNum} 页 / 共 ${total} 页`;
}

/**
 * 检测节点是否带有显式前置分页符样式
 */
function hasExplicitPageBreakBefore(el: HTMLElement): boolean {
  const inlineStyle = (el.getAttribute?.('style') || '').toLowerCase();
  if (
    /page-break-before\s*:\s*always/.test(inlineStyle) ||
    /break-before\s*:\s*page/.test(inlineStyle)
  ) {
    return true;
  }
  return false;
}

/**
 * 检测节点是否带有显式后置分页符样式
 */
function hasExplicitPageBreakAfter(el: HTMLElement): boolean {
  const inlineStyle = (el.getAttribute?.('style') || '').toLowerCase();
  if (
    /page-break-after\s*:\s*always/.test(inlineStyle) ||
    /break-after\s*:\s*page/.test(inlineStyle)
  ) {
    return true;
  }
  return false;
}

/**
 * 检测节点本身是否为独立分页符占位节点
 */
function isStandalonePageBreakNode(el: HTMLElement): boolean {
  if (el.classList?.contains('docx_page_break')) return true;
  const cls = el.className || '';
  if (typeof cls === 'string' && cls.includes('docx_page_break')) return true;
  const tag = el.tagName?.toLowerCase();
  if ((tag === 'br' || tag === 'hr') && (hasExplicitPageBreakBefore(el) || hasExplicitPageBreakAfter(el))) {
    return true;
  }
  return false;
}

function extractArticleStyleProps(article: HTMLElement | undefined): {
  inlineStyle: string;
  columnCount?: string;
  columnGap?: string;
  columnRule?: string;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
} {
  if (!article) return { inlineStyle: '' };
  const s = article.style as CSSStyleDeclaration | undefined;
  return {
    inlineStyle: article.getAttribute?.('style') || '',
    columnCount: s?.columnCount || undefined,
    columnGap: s?.columnGap || undefined,
    columnRule: s?.columnRule || undefined,
    display: s?.display || undefined,
    flexDirection: s?.flexDirection || undefined,
    justifyContent: s?.justifyContent || undefined,
  };
}

const PRESERVED_PAGE_ATTRS = [
  'data-paper-name',
  'data-orientation',
  'data-margins-mm',
  'data-cols',
  'data-v-align',
  'data-default-line-height',
];

function extractPreservedPageAttributes(section: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const key of PRESERVED_PAGE_ATTRS) {
    const v = section.getAttribute?.(key);
    if (v) attrs[key] = v;
  }
  return attrs;
}

/**
 * 收集 section 内部所有正文块级子节点（兼容单 article、多 article 分节及无 article 挂载结构）
 */
function collectSectionContentChildren(section: HTMLElement): {
  articles: HTMLElement[];
  children: HTMLElement[];
  primaryArticleStyle: ReturnType<typeof extractArticleStyleProps>;
} {
  const directChildren = Array.from(section.children || []) as HTMLElement[];
  const articles = directChildren.filter(c => c.tagName?.toLowerCase() === 'article');

  if (articles.length === 1) {
    return {
      articles,
      children: Array.from(articles[0].children || []) as HTMLElement[],
      primaryArticleStyle: extractArticleStyleProps(articles[0]),
    };
  }

  if (articles.length > 1) {
    const merged: HTMLElement[] = [];
    for (const art of articles) {
      const colCount = parseInt(art.style?.columnCount || '1', 10);
      if (colCount > 1) {
        // 多栏分节保持 article 整体作为一个排版块
        merged.push(art);
      } else {
        const artKids = Array.from(art.children || []) as HTMLElement[];
        merged.push(...artKids);
      }
    }
    return { articles, children: merged, primaryArticleStyle: extractArticleStyleProps(articles[0]) };
  }

  // 无 article 包裹时，过滤掉 header / footer / 页码角标
  const fallbackChildren = directChildren.filter(c => {
    const tag = c.tagName?.toLowerCase();
    if (tag === 'header' || tag === 'footer') return false;
    if (c.classList?.contains('docx-page-number-badge') || (c.className || '').includes('docx-page-number-badge')) {
      return false;
    }
    return true;
  });

  return { articles: [], children: fallbackChildren, primaryArticleStyle: { inlineStyle: '' } };
}

/**
 * 对已渲染的 docx DOM 容器执行智能物理分页
 * 将超长的大 section 切分为对应真实物理页数的独立 A4 纸张页面，
 * 并支持跨页长表格按行拆分及表头行自动延续重复。
 */
export function paginateDocxContainer(
  container: HTMLElement | null,
  options: DocxPaginationOptions = {}
): DocxPaginationResult {
  if (!container) {
    return { totalPages: 1, paginated: false };
  }

  const locale = options.locale || 'zh-CN';

  // 1. 查找容器内的顶层 section 页面
  const sections = Array.from(container.querySelectorAll<HTMLElement>('section.docx-rendered-wrapper, section.docx, section'));
  const topSections = sections.filter((sec) => {
    let p = sec.parentElement;
    while (p && p !== container) {
      if (sections.includes(p as HTMLElement)) return false;
      p = p.parentElement;
    }
    return true;
  });

  if (topSections.length === 0) {
    return { totalPages: 1, paginated: false };
  }

  const expectedPageCount = options.expectedPageCount && options.expectedPageCount > 0
    ? options.expectedPageCount
    : 0;

  let totalGeneratedPages = 0;
  let didPaginateAny = false;

  // 2. 遍历每个 Section，检测是否超出单页高度或需要基于 expectedPageCount / 显式分页符拆分
  for (const section of topSections) {
    // 提取并标准化该 section 的物理纸张高度与宽度（默认 A4 794×1123）
    const { width: styleWidth, height: styleHeight } = resolveStandardPageDimensions(section, options);

    // 计算内边距（优先读取行内 pt/px 样式，其次读取 computedStyle）
    const defaultMarginV = options.pageProperties?.margins.topPx || 36;
    let padTop = parseCssLengthToPx(section.style?.paddingTop, defaultMarginV);
    let padBottom = parseCssLengthToPx(section.style?.paddingBottom, options.pageProperties?.margins.bottomPx || defaultMarginV);
    try {
      const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(section) : null;
      if (computed) {
        padTop = parseCssLengthToPx(computed.paddingTop, padTop);
        padBottom = parseCssLengthToPx(computed.paddingBottom, padBottom);
      }
    } catch {
      // 忽略计算样式异常
    }

    const bottomBadgeReserve = Math.max(0, 28 - padBottom);
    const availableContentHeight = Math.max(400, styleHeight - padTop - padBottom - bottomBadgeReserve);
    const { children, primaryArticleStyle } = collectSectionContentChildren(section);

    // 测量真实滚动高度；若处于无布局树环境 (scrollHeight === 0)，则回退累加子节点估算高度
    const rawScrollHeight = section.scrollHeight || section.offsetHeight || 0;
    let estimatedChildrenHeight = 0;
    if (rawScrollHeight === 0 && children.length > 0) {
      for (const child of children) {
        const ch = child.offsetHeight || child.getBoundingClientRect?.().height || estimateNodeHeight(child);
        estimatedChildrenHeight += ch + 12;
      }
    }
    const sectionScrollHeight = rawScrollHeight > 0
      ? rawScrollHeight
      : (estimatedChildrenHeight > 0 ? estimatedChildrenHeight + padTop + padBottom : 0);

    const hasExplicitDomBreak = children.some(
      child => isStandalonePageBreakNode(child) || hasExplicitPageBreakBefore(child) || hasExplicitPageBreakAfter(child)
    );

    // 判定是否需要切分：存在显式分页符、内容高度超出单页标准高度，或总节数小于预期页数且内容饱满
    const needsPagination = Boolean(
      options.force ||
      hasExplicitDomBreak ||
      sectionScrollHeight > styleHeight + 2 ||
      (expectedPageCount > topSections.length && sectionScrollHeight > availableContentHeight * 1.02)
    );

    if (!needsPagination || children.length === 0) {
      // 本身就是单页，仍然强制对齐标准物理纸张固定宽高，绝不因内容少而变矮/变窄
      totalGeneratedPages++;
      section.classList.add('docx_page');
      section.classList.add('docx-paged-sheet');
      section.setAttribute('data-page-number', String(totalGeneratedPages));
      applyStandardSheetGeometry(section, styleWidth, styleHeight);
      injectPageFooter(section, totalGeneratedPages, expectedPageCount || topSections.length, locale);
      continue;
    }

    // 3. 开始执行核心内容切分
    const originalHeader = section.querySelector<HTMLElement>('header');
    const originalFooter = section.querySelector<HTMLElement>('footer');
    const sectionClass = section.className || 'docx-rendered-wrapper docx';
    const sectionInlineStyle = section.getAttribute?.('style') || serializeMockStyle(section.style);
    const sectionAttributes = extractPreservedPageAttributes(section);

    // 计算当前 section 预期的切分页数（防止 app.xml 中陈旧的 <Pages>1</Pages> 压制真实多页切分）
    const naturalPagesByHeight = Math.max(1, Math.ceil(sectionScrollHeight / availableContentHeight));
    let targetPagesForSection = naturalPagesByHeight;
    if (expectedPageCount > topSections.length) {
      const otherSectionsCount = topSections.length - 1;
      targetPagesForSection = Math.max(1, expectedPageCount - otherSectionsCount);
    }

    // 动态校准单页预算高度，使切分出来的页数精准贴合原始 docx 页数
    const effectiveContentBudget = expectedPageCount > topSections.length && sectionScrollHeight > 0
      ? Math.max(300, Math.min(availableContentHeight, (sectionScrollHeight / targetPagesForSection) * 1.04))
      : availableContentHeight;

    const parentNode = section.parentNode;
    const fragment = document.createDocumentFragment();

    let currentPageNum = 1;
    const buildSheet = (pageOffset: number) => createPageSheetElement({
      pageNumber: totalGeneratedPages + pageOffset,
      sectionClass,
      inlineStyle: sectionInlineStyle,
      width: styleWidth,
      height: styleHeight,
      padTop,
      padBottom,
      header: originalHeader,
      footer: originalFooter,
      articleStyle: primaryArticleStyle,
      sectionAttributes,
      locale,
    });

    let currentSheet = buildSheet(currentPageNum);
    let currentArticle = currentSheet.querySelector<HTMLElement>('article')!;
    let currentAccumulatedHeight = 0;

    const sealCurrentPageAndStartNext = () => {
      fragment.appendChild(currentSheet);
      currentPageNum++;
      currentSheet = buildSheet(currentPageNum);
      currentArticle = currentSheet.querySelector<HTMLElement>('article')!;
      currentAccumulatedHeight = 0;
    };

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const tag = child.tagName?.toLowerCase();

      // 独立分页符节点：若当前页已有内容则直接翻页，并不再向新页塞入空占位符
      if (isStandalonePageBreakNode(child)) {
        if (currentAccumulatedHeight > 0 && i < children.length - 1) {
          sealCurrentPageAndStartNext();
        }
        continue;
      }

      // 前置显式分页样式：在放入当前节点前先翻页
      if (hasExplicitPageBreakBefore(child) && currentAccumulatedHeight > 0) {
        sealCurrentPageAndStartNext();
      }

      // 测量或估算子节点渲染高度
      let itemHeight = child.offsetHeight || child.getBoundingClientRect?.().height || 0;
      if (itemHeight === 0) {
        itemHeight = estimateNodeHeight(child);
      }

      // 超长表格按行跨页切分（保留表头）
      if (tag === 'table') {
        const tableRows = collectDirectTableRows(child);
        if (tableRows.length >= 2 && (itemHeight > effectiveContentBudget || (currentAccumulatedHeight > 0 && currentAccumulatedHeight + itemHeight > effectiveContentBudget && itemHeight > effectiveContentBudget * 0.55))) {
          const tableSplitResult = splitTableAcrossPages({
            tableEl: child,
            rows: tableRows,
            currentArticle,
            currentAccumulatedHeight,
            effectiveContentBudget,
            sealCurrentPageAndStartNext: () => {
              sealCurrentPageAndStartNext();
              return currentArticle;
            },
          });
          currentAccumulatedHeight = tableSplitResult.accumulatedHeight;
          continue;
        }
      }

      // 如果当前页已有内容，且放入该元素将超出本页预算高度
      if (currentAccumulatedHeight > 0 && (currentAccumulatedHeight + itemHeight > effectiveContentBudget)) {
        sealCurrentPageAndStartNext();
      }

      // 放入当前页 article
      currentArticle.appendChild(child);
      currentAccumulatedHeight += itemHeight + 12; // 计入段间距 margin

      // 后置显式分页样式：放入当前节点后立即翻页
      if (hasExplicitPageBreakAfter(child) && i < children.length - 1) {
        sealCurrentPageAndStartNext();
      }
    }

    // 将最后一页放入 fragment
    fragment.appendChild(currentSheet);

    // 用切分后的 pages 替换原先的超长 section
    if (parentNode) {
      parentNode.replaceChild(fragment, section);
    }

    totalGeneratedPages += currentPageNum;
    didPaginateAny = true;
  }

  // 4. 在真实浏览器布局树下执行二次溢出重排：若单页实际渲染高度超出固定纸张高度，自动顺延至下一页避免截断
  rebalanceOverflowingSheets(container, locale);

  // 5. 全局回填与更新所有页面的总页数标注（如 "第 X 页 / 共 56 页"）
  const allFinalSheets = Array.from(container.querySelectorAll<HTMLElement>('.docx-paged-sheet'));
  const finalTotal = allFinalSheets.length || totalGeneratedPages;
  allFinalSheets.forEach((sheet, idx) => {
    const pageNum = idx + 1;
    sheet.setAttribute('data-page-number', String(pageNum));
    updatePageFooterText(sheet, pageNum, finalTotal, locale);
  });

  return {
    totalPages: finalTotal,
    paginated: didPaginateAny || allFinalSheets.length > topSections.length,
  };
}

/**
 * 真实浏览器渲染后，若某页因字体行高导致正文略微超出标准纸张固定高度，
 * 将末尾溢出元素自动顺延至下一页（或新建标准空白页），既保住固定 A4 尺寸又绝不吞字截断。
 */
function rebalanceOverflowingSheets(container: HTMLElement, locale: 'zh-CN' | 'en-US'): void {
  let sheets = Array.from(container.querySelectorAll<HTMLElement>('.docx-paged-sheet'));
  if (sheets.length === 0) return;

  for (let i = 0; i < sheets.length && i < 120; i++) {
    const sheet = sheets[i];
    const targetH = parseInt(sheet.getAttribute('data-page-height') || '0', 10) || A4_HEIGHT_PX;
    const targetW = parseInt(sheet.getAttribute('data-page-width') || '0', 10) || A4_WIDTH_PX;
    const article = sheet.querySelector<HTMLElement>('.docx-page-article') || sheet.querySelector<HTMLElement>('article');

    const isOverflowing = () => {
      const sheetOver = (sheet.scrollHeight || 0) > targetH + 2;
      const articleClientH = article?.clientHeight || 0;
      const articleOver = Boolean(article && articleClientH > 0 && (article.scrollHeight || 0) > articleClientH + 2);
      return sheetOver || articleOver;
    };

    if (!isOverflowing()) continue;
    if (!article || article.children.length <= 1) continue;

    let padTop = parseCssLengthToPx(sheet.style?.paddingTop, 36);
    let padBottom = parseCssLengthToPx(sheet.style?.paddingBottom, 36);
    try {
      const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(sheet) : null;
      if (computed) {
        padTop = parseCssLengthToPx(computed.paddingTop, padTop);
        padBottom = parseCssLengthToPx(computed.paddingBottom, padBottom);
      }
    } catch {
      // 忽略计算样式异常
    }

    const inheritedClass = (sheet.className || 'docx-rendered-wrapper docx')
      .replace(/\b(?:docx_page|docx-paged-sheet|docx-single-hidden-sheet|docx-single-active-sheet)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'docx-rendered-wrapper docx';
    const inheritedStyle = sheet.getAttribute?.('style') || serializeMockStyle(sheet.style);
    const inheritedAttrs = extractPreservedPageAttributes(sheet);
    const inheritedArticleStyle = extractArticleStyleProps(article);

    let guard = 0;
    let nextSheet: HTMLElement | null = sheets[i + 1] || null;
    let nextArticle: HTMLElement | null =
      nextSheet?.querySelector<HTMLElement>('.docx-page-article') ||
      nextSheet?.querySelector<HTMLElement>('article') ||
      null;

    while (isOverflowing() && article.children.length > 1 && guard < 40) {
      guard++;
      const lastChild = article.lastElementChild as HTMLElement | null;
      if (!lastChild) break;

      if (!nextSheet || !nextArticle) {
        const clonedEmpty = createPageSheetElement({
          pageNumber: i + 2,
          sectionClass: inheritedClass,
          inlineStyle: inheritedStyle,
          width: targetW,
          height: targetH,
          padTop,
          padBottom,
          header: sheet.querySelector<HTMLElement>('header'),
          footer: sheet.querySelector<HTMLElement>('footer'),
          articleStyle: inheritedArticleStyle,
          sectionAttributes: inheritedAttrs,
          locale,
        });
        sheet.parentNode?.insertBefore(clonedEmpty, sheet.nextSibling);
        nextSheet = clonedEmpty;
        nextArticle = clonedEmpty.querySelector<HTMLElement>('.docx-page-article')!;
        sheets = Array.from(container.querySelectorAll<HTMLElement>('.docx-paged-sheet'));
      }

      if (nextArticle.firstChild) {
        nextArticle.insertBefore(lastChild, nextArticle.firstChild);
      } else {
        nextArticle.appendChild(lastChild);
      }
    }
  }
}

/**
 * 提取容器内所有物理页面 (.docx-paged-sheet) 的页码、首标题与摘要，用于“页面”一页一页导航视图
 */
export function extractDocxPageSummaries(
  container: HTMLElement | null,
  locale: 'zh-CN' | 'en-US' = 'zh-CN'
): DocxPageSummary[] {
  if (!container) return [];
  const sheets = Array.from(container.querySelectorAll<HTMLElement>('.docx-paged-sheet'));
  return sheets.map((sheet, idx) => {
    const pageNumber = parseInt(sheet.getAttribute('data-page-number') || String(idx + 1), 10) || (idx + 1);
    const article = sheet.querySelector<HTMLElement>('article') || sheet;
    const rawText = (article.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();

    // 查找本页内的首个标题或首段非空文本
    const headingEl = article.querySelector<HTMLElement>('h1, h2, h3, h4, [class*="Heading"], [class*="heading"]');
    const headingText = headingEl?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const defaultTitle = locale === 'en-US' ? `Page ${pageNumber}` : `第 ${pageNumber} 页`;
    const title = headingText ? headingText.slice(0, 42) : (rawText.slice(0, 36) || defaultTitle);
    const snippet = rawText.slice(0, 90) || (locale === 'en-US' ? '(Blank or image page)' : '（图表或空白页）');

    return {
      pageNumber,
      title,
      snippet,
      element: sheet,
    };
  });
}

/**
 * 递归安全收集表格内的直属行节点 (兼容真实 DOM 与轻量 Mock 对象)
 */
function collectDirectTableRows(tableEl: HTMLElement): HTMLElement[] {
  const rows: HTMLElement[] = [];
  const children = Array.from(tableEl.children || []) as HTMLElement[];
  for (const child of children) {
    const tag = child.tagName?.toLowerCase();
    if (tag === 'tr') {
      rows.push(child);
    } else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      const nested = Array.from(child.children || []) as HTMLElement[];
      for (const n of nested) {
        if (n.tagName?.toLowerCase() === 'tr') {
          rows.push(n);
        }
      }
    }
  }
  return rows;
}

/**
 * 判断表格行是否为表头行（位于 <thead> 中或首行包含 <th>）
 */
function isTableHeaderRow(row: HTMLElement): boolean {
  if (row.parentElement?.tagName?.toLowerCase() === 'thead') return true;
  const cells = Array.from(row.children || []) as HTMLElement[];
  return cells.some(c => c.tagName?.toLowerCase() === 'th');
}

/**
 * 复制表格外框节点样式，生成可承载分段行的轻量 table 壳
 */
function cloneTableShell(tableEl: HTMLElement): HTMLElement {
  const newTable = document.createElement('table');
  if (tableEl.className) {
    newTable.className = tableEl.className;
  }
  const inlineStyle = tableEl.getAttribute?.('style');
  if (inlineStyle) {
    newTable.setAttribute('style', inlineStyle);
  }
  // 继承 colgroup（如 docx-preview 生成的列宽约束）
  const children = Array.from(tableEl.children || []) as HTMLElement[];
  for (const child of children) {
    if (child.tagName?.toLowerCase() === 'colgroup' && typeof child.cloneNode === 'function') {
      newTable.appendChild(child.cloneNode(true));
    }
  }
  return newTable;
}

/**
 * 将超长表格按行切分至多个页面，并在续页自动重复表头行
 */
function splitTableAcrossPages(params: {
  tableEl: HTMLElement;
  rows: HTMLElement[];
  currentArticle: HTMLElement;
  currentAccumulatedHeight: number;
  effectiveContentBudget: number;
  sealCurrentPageAndStartNext: () => HTMLElement;
}): { accumulatedHeight: number } {
  const {
    tableEl,
    rows,
    effectiveContentBudget,
    sealCurrentPageAndStartNext,
  } = params;

  let activeArticle = params.currentArticle;
  let accumulated = params.currentAccumulatedHeight;

  const firstRow = rows[0];
  const hasHeaderRow = firstRow ? isTableHeaderRow(firstRow) : false;
  const headerTemplate = hasHeaderRow ? firstRow : null;
  const headerHeight = headerTemplate ? measureRowHeight(headerTemplate) : 0;

  let activeTable = cloneTableShell(tableEl);
  let activeTbody = document.createElement('tbody');
  activeTable.appendChild(activeTbody);
  let hasAppendedActiveTable = false;

  const flushActiveTableIfNonEmpty = () => {
    if (hasAppendedActiveTable || activeTbody.children.length === 0) return;
    activeArticle.appendChild(activeTable);
    hasAppendedActiveTable = true;
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowHeight = measureRowHeight(row);

    // 若当前页剩余空间不足以容纳首行（且已有前置正文内容），先翻页再放表格
    if (accumulated > 0 && activeTbody.children.length === 0 && accumulated + rowHeight > effectiveContentBudget) {
      activeArticle = sealCurrentPageAndStartNext();
      accumulated = 0;
    } else if (activeTbody.children.length > 0 && accumulated + rowHeight > effectiveContentBudget) {
      // 当前表格分片写满本页，落盘当前分片并翻页新建续接分片
      flushActiveTableIfNonEmpty();
      activeArticle = sealCurrentPageAndStartNext();
      accumulated = 0;

      activeTable = cloneTableShell(tableEl);
      activeTbody = document.createElement('tbody');
      activeTable.appendChild(activeTbody);
      hasAppendedActiveTable = false;

      // 在续页顶部重复表头行
      if (headerTemplate && r > 0 && typeof headerTemplate.cloneNode === 'function') {
        const clonedHeader = headerTemplate.cloneNode(true) as HTMLElement;
        activeTbody.appendChild(clonedHeader);
        accumulated += headerHeight;
      }
    }

    activeTbody.appendChild(row);
    accumulated += rowHeight;
  }

  flushActiveTableIfNonEmpty();
  accumulated += 12;

  return { accumulatedHeight: accumulated };
}

function measureRowHeight(row: HTMLElement): number {
  const measured = row.offsetHeight || row.getBoundingClientRect?.().height || 0;
  if (measured > 0) return measured;
  const textLen = row.textContent?.trim().length || 0;
  const estimatedLines = Math.max(1, Math.ceil(textLen / 45));
  return Math.max(28, estimatedLines * 22 + 10);
}

function serializeMockStyle(style: CSSStyleDeclaration | Record<string, string> | undefined): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.paddingTop) parts.push(`padding-top: ${style.paddingTop}`);
  if (style.paddingRight) parts.push(`padding-right: ${style.paddingRight}`);
  if (style.paddingBottom) parts.push(`padding-bottom: ${style.paddingBottom}`);
  if (style.paddingLeft) parts.push(`padding-left: ${style.paddingLeft}`);
  if (style.borderTop) parts.push(`border-top: ${style.borderTop}`);
  if (style.borderRight) parts.push(`border-right: ${style.borderRight}`);
  if (style.borderBottom) parts.push(`border-bottom: ${style.borderBottom}`);
  if (style.borderLeft) parts.push(`border-left: ${style.borderLeft}`);
  return parts.join('; ');
}

/**
 * 创建单张标准 A4 / 原始纸张规格的页面容器
 */
function createPageSheetElement(params: {
  pageNumber: number;
  sectionClass: string;
  inlineStyle: string;
  width: number;
  height: number;
  padTop: number;
  padBottom: number;
  header: HTMLElement | null;
  footer: HTMLElement | null;
  articleStyle?: ReturnType<typeof extractArticleStyleProps>;
  sectionAttributes?: Record<string, string>;
  locale: 'zh-CN' | 'en-US';
}): HTMLElement {
  const sheet = document.createElement('section');
  sheet.className = `${params.sectionClass} docx_page docx-paged-sheet`;

  // 严格锁定单张物理纸张的固定宽高，绝不随内容增减而拉伸或缩水，同时保留原始边距/边框/字体
  const sanitizedInline = (params.inlineStyle || '')
    .replace(/(?:^|;)\s*(?:min-)?(?:width|height|max-width|max-height|overflow)\s*:[^;]*/gi, '')
    .trim();
  sheet.setAttribute(
    'style',
    `${sanitizedInline ? sanitizedInline + ';' : ''} margin: 0 auto 28px auto !important;`
  );
  // 兼容轻量 mock 对象的 style 属性同步
  const ptMatch = sanitizedInline.match(/padding-top\s*:\s*([^;]+)/i);
  const pbMatch = sanitizedInline.match(/padding-bottom\s*:\s*([^;]+)/i);
  const plMatch = sanitizedInline.match(/padding-left\s*:\s*([^;]+)/i);
  const prMatch = sanitizedInline.match(/padding-right\s*:\s*([^;]+)/i);
  if (sheet.style) {
    if (ptMatch && !sheet.style.paddingTop) sheet.style.paddingTop = ptMatch[1].trim();
    if (pbMatch && !sheet.style.paddingBottom) sheet.style.paddingBottom = pbMatch[1].trim();
    if (plMatch && !sheet.style.paddingLeft) sheet.style.paddingLeft = plMatch[1].trim();
    if (prMatch && !sheet.style.paddingRight) sheet.style.paddingRight = prMatch[1].trim();
  }

  applyStandardSheetGeometry(sheet, params.width, params.height);
  sheet.setAttribute('data-page-number', String(params.pageNumber));
  if (params.sectionAttributes) {
    for (const [attrKey, attrVal] of Object.entries(params.sectionAttributes)) {
      sheet.setAttribute(attrKey, attrVal);
    }
  }

  // 克隆 header
  if (params.header) {
    sheet.appendChild(params.header.cloneNode(true));
  }

  // 创建正文容器，限定最大宽度防止长内容撑破纸张宽度，并保留多栏与垂直对齐属性
  const article = document.createElement('article');
  article.className = 'docx-page-article';
  const badgeReserve = Math.max(0, 28 - params.padBottom);
  const articleMaxH = Math.max(200, params.height - params.padTop - params.padBottom - badgeReserve);
  if (params.articleStyle?.inlineStyle) {
    const cleanArtStyle = params.articleStyle.inlineStyle
      .replace(/(?:^|;)\s*(?:min-)?(?:width|height|max-width|max-height)\s*:[^;]*/gi, '')
      .trim();
    if (cleanArtStyle) {
      article.setAttribute('style', cleanArtStyle);
    }
  }
  if (params.articleStyle?.columnCount && parseInt(params.articleStyle.columnCount, 10) > 1) {
    article.style.columnCount = params.articleStyle.columnCount;
    if (params.articleStyle.columnGap) article.style.columnGap = params.articleStyle.columnGap;
    if (params.articleStyle.columnRule) article.style.columnRule = params.articleStyle.columnRule;
    article.style.columnFill = 'auto';
  } else if (params.articleStyle?.justifyContent) {
    article.style.display = params.articleStyle.display || 'flex';
    article.style.flexDirection = params.articleStyle.flexDirection || 'column';
    article.style.justifyContent = params.articleStyle.justifyContent;
  }
  article.style.height = `${articleMaxH}px`;
  article.style.maxHeight = `${articleMaxH}px`;
  article.style.maxWidth = '100%';
  article.style.boxSizing = 'border-box';
  sheet.appendChild(article);

  // 克隆 footer
  if (params.footer) {
    sheet.appendChild(params.footer.cloneNode(true));
  }

  // 注入标准页码底栏角标
  const pageFooterBar = document.createElement('div');
  pageFooterBar.className = 'docx-page-number-badge';
  pageFooterBar.innerHTML = `<span class="docx-badge-text">${params.locale === 'en-US' ? `Page ${params.pageNumber}` : `第 ${params.pageNumber} 页`}</span>`;
  sheet.appendChild(pageFooterBar);

  return sheet;
}

/**
 * 注入或更新页底角标
 */
function injectPageFooter(section: HTMLElement, pageNum: number, total: number, locale: 'zh-CN' | 'en-US' = 'zh-CN') {
  let badge = section.querySelector<HTMLElement>('.docx-page-number-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'docx-page-number-badge';
    section.appendChild(badge);
  }
  badge.innerHTML = `<span class="docx-badge-text">${formatPageBadgeText(pageNum, total, locale)}</span>`;
}

function updatePageFooterText(section: HTMLElement, pageNum: number, total: number, locale: 'zh-CN' | 'en-US' = 'zh-CN') {
  const badgeText = section.querySelector<HTMLElement>('.docx-badge-text');
  if (badgeText) {
    badgeText.textContent = formatPageBadgeText(pageNum, total, locale);
  } else {
    injectPageFooter(section, pageNum, total, locale);
  }
}

/**
 * 估算节点的渲染高度（用于无浏览器渲染树时的回退策略与测试环境）
 */
function estimateNodeHeight(el: HTMLElement): number {
  const tag = el.tagName?.toLowerCase();
  const textLen = el.textContent?.trim().length || 0;
  const s = el.style as CSSStyleDeclaration | undefined;
  const mt = s?.marginTop ? parseCssLengthToPx(s.marginTop, 0) : 0;
  const mb = s?.marginBottom ? parseCssLengthToPx(s.marginBottom, 0) : 0;

  if (tag === 'h1') return 56 + mt + mb;
  if (tag === 'h2') return 44 + mt + mb;
  if (tag === 'h3') return 36 + mt + mb;
  if (tag === 'table') {
    const directRows = collectDirectTableRows(el).length;
    const rows = directRows || (el.querySelectorAll ? el.querySelectorAll('tr').length : 3) || 3;
    return Math.max(60, rows * 32) + mt + mb;
  }
  if (tag === 'img' || (el.querySelector && el.querySelector('img'))) {
    return 240 + mt + mb;
  }

  const fontSizePx = s?.fontSize ? parseCssLengthToPx(s.fontSize, 15) : 15;
  let linePx = Math.round(fontSizePx * 1.45);
  const rawLh = s?.lineHeight;
  if (rawLh) {
    if (/^\d+(?:\.\d+)?$/.test(rawLh.trim())) {
      linePx = Math.max(14, Math.round(fontSizePx * parseFloat(rawLh)));
    } else if (!rawLh.includes('calc') && !rawLh.includes('max(')) {
      linePx = Math.max(14, parseCssLengthToPx(rawLh, linePx));
    }
  }
  const minH = s?.minHeight ? parseCssLengthToPx(s.minHeight, 0) : 0;
  const lines = Math.max(1, Math.ceil(textLen / 38));
  return Math.max(minH, lines * linePx) + Math.max(10, mt + mb);
}
