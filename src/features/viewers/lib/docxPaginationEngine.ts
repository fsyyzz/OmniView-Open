/**
 * OmniView 原生 Word (.docx) 物理页面排版与自然分页引擎
 * 针对未显式包含 hard page break 的长文档，基于 docProps/app.xml 原始页数、
 * 物理纸张高度 (A4 210mm x 297mm) 与 DOM 测量进行智能多页切分，
 * 彻底解决长文档全部堆积在单页的问题。
 * 
 * 作者: 周赞
 */

export interface DocxPaginationOptions {
  /** docx 元数据中声明的官方总页数 (来自 docProps/app.xml <Pages>) */
  expectedPageCount?: number;
  /** 单页物理宽度 (px，默认 794px 对应 210mm @ 96DPI) */
  pageWidth?: number;
  /** 单页物理高度 (px，默认 1123px 对应 297mm @ 96DPI) */
  pageHeight?: number;
  /** 是否强制应用分页拆分 */
  force?: boolean;
}

export interface DocxPaginationResult {
  /** 切分后的实际总页数 */
  totalPages: number;
  /** 是否执行了跨页拆分 */
  paginated: boolean;
}

// 标准 A4 纸张物理尺寸常数 (96 DPI: 1 inch = 96px, 1mm = 96 / 25.4 ≈ 3.7795px)
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const A4_DEFAULT_MARGIN_V_PX = 96; // 上下边距默认 25.4mm (1 inch)
export const A4_CONTENT_HEIGHT_PX = A4_HEIGHT_PX - A4_DEFAULT_MARGIN_V_PX * 2; // 可用正文高度约 931px

/**
 * 对已渲染的 docx DOM 容器执行智能物理分页
 * 将超长的大 section 切分为对应真实物理页数的独立 A4 纸张页面
 */
export function paginateDocxContainer(
  container: HTMLElement | null,
  options: DocxPaginationOptions = {}
): DocxPaginationResult {
  if (!container) {
    return { totalPages: 1, paginated: false };
  }

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

  // 2. 遍历每个 Section，检测是否超出单页高度或需要基于 expectedPageCount 拆分
  for (const section of topSections) {
    // 提取该 section 声明的纸张高度与宽度
    const styleWidth = parseFloat(section.style.width) || A4_WIDTH_PX;
    const styleHeight = parseFloat(section.style.minHeight) || parseFloat(section.style.height) || A4_HEIGHT_PX;
    
    // 计算内边距
    let padTop = 36;
    let padBottom = 36;
    try {
      const computed = window.getComputedStyle ? window.getComputedStyle(section) : null;
      if (computed) {
        padTop = parseFloat(computed.paddingTop) || padTop;
        padBottom = parseFloat(computed.paddingBottom) || padBottom;
      }
    } catch {
      // 忽略计算样式异常
    }

    const availableContentHeight = Math.max(400, styleHeight - padTop - padBottom - 48); // 预留页眉页脚 48px
    const sectionScrollHeight = section.scrollHeight || section.offsetHeight || 0;

    // 判定是否需要切分：内容高度超过单页高度的 1.15 倍，或者总节数远小于预期页数且该节有较多内容
    const needsPagination = options.force ||
      sectionScrollHeight > styleHeight * 1.15 ||
      (expectedPageCount > topSections.length && sectionScrollHeight > availableContentHeight * 1.1);

    if (!needsPagination) {
      // 本身就是标准单页，规范化类名并打上页码标识
      totalGeneratedPages++;
      section.classList.add('docx-paged-sheet');
      section.setAttribute('data-page-number', String(totalGeneratedPages));
      injectPageFooter(section, totalGeneratedPages, expectedPageCount || topSections.length);
      continue;
    }

    // 3. 开始执行核心内容切分
    const article = section.querySelector<HTMLElement>('article') || section;
    const children = Array.from(article.children) as HTMLElement[];
    if (children.length === 0) {
      totalGeneratedPages++;
      section.classList.add('docx-paged-sheet');
      section.setAttribute('data-page-number', String(totalGeneratedPages));
      continue;
    }

    // 保存原 section 属性与 header/footer
    const originalHeader = section.querySelector<HTMLElement>('header');
    const originalFooter = section.querySelector<HTMLElement>('footer');
    const sectionClass = section.className || 'docx-rendered-wrapper docx';
    const sectionInlineStyle = section.getAttribute('style') || '';

    // 计算当前 section 预期的切分页数
    let targetPagesForSection = 1;
    if (expectedPageCount > 0) {
      // 若有明确预期页数，扣除其他单页 section 占用的数量
      const otherSectionsCount = topSections.length - 1;
      targetPagesForSection = Math.max(1, expectedPageCount - otherSectionsCount);
    } else {
      targetPagesForSection = Math.max(1, Math.ceil(sectionScrollHeight / availableContentHeight));
    }

    // 动态校准单页预算高度，使切分出来的页数精准贴合原始 docx 页数
    const effectiveContentBudget = expectedPageCount > 0 && sectionScrollHeight > 0
      ? Math.max(300, Math.min(availableContentHeight, (sectionScrollHeight / targetPagesForSection) * 1.04))
      : availableContentHeight;

    const parentNode = section.parentNode;
    const fragment = document.createDocumentFragment();

    let currentPageNum = 1;
    let currentSheet = createPageSheetElement({
      pageNumber: totalGeneratedPages + currentPageNum,
      sectionClass,
      inlineStyle: sectionInlineStyle,
      width: styleWidth,
      height: styleHeight,
      padTop,
      padBottom,
      header: originalHeader,
      footer: originalFooter,
    });
    let currentArticle = currentSheet.querySelector<HTMLElement>('article')!;
    let currentAccumulatedHeight = 0;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // 测量或估算子节点渲染高度
      let itemHeight = child.offsetHeight || child.getBoundingClientRect?.().height || 0;
      if (itemHeight === 0) {
        // 环境不支持测量时（如离线单元测试），按文本字符与标签类型智能加权估算
        itemHeight = estimateNodeHeight(child);
      }

      // 如果当前页已有内容，且放入该元素将超出本页预算高度
      if (currentAccumulatedHeight > 0 && (currentAccumulatedHeight + itemHeight > effectiveContentBudget)) {
        // 封存当前页，开启新页
        fragment.appendChild(currentSheet);
        currentPageNum++;

        currentSheet = createPageSheetElement({
          pageNumber: totalGeneratedPages + currentPageNum,
          sectionClass,
          inlineStyle: sectionInlineStyle,
          width: styleWidth,
          height: styleHeight,
          padTop,
          padBottom,
          header: originalHeader,
          footer: originalFooter,
        });
        currentArticle = currentSheet.querySelector<HTMLElement>('article')!;
        currentAccumulatedHeight = 0;
      }

      // 放入当前页 article
      currentArticle.appendChild(child);
      currentAccumulatedHeight += itemHeight + 12; // 计入段间距 margin
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

  // 4. 全局回填与更新所有页面的总页数标注（如 "第 X 页 / 共 56 页"）
  const allFinalSheets = Array.from(container.querySelectorAll<HTMLElement>('.docx-paged-sheet'));
  const finalTotal = allFinalSheets.length || totalGeneratedPages;
  allFinalSheets.forEach((sheet, idx) => {
    const pageNum = idx + 1;
    sheet.setAttribute('data-page-number', String(pageNum));
    updatePageFooterText(sheet, pageNum, finalTotal);
  });

  return {
    totalPages: finalTotal,
    paginated: didPaginateAny,
  };
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
}): HTMLElement {
  const sheet = document.createElement('section');
  sheet.className = `${params.sectionClass} docx_page docx-paged-sheet`;
  
  // 保留原始 inline style，并明确限制宽高为标准单页
  sheet.setAttribute(
    'style',
    `${params.inlineStyle}; width: 100% !important; max-width: ${params.width}px !important; min-height: ${params.height}px !important; box-sizing: border-box !important; position: relative !important; overflow: hidden !important; margin: 0 auto 28px auto !important;`
  );
  sheet.setAttribute('data-page-number', String(params.pageNumber));

  // 克隆 header
  if (params.header) {
    sheet.appendChild(params.header.cloneNode(true));
  }

  // 创建正文容器
  const article = document.createElement('article');
  article.className = 'docx-page-article';
  article.style.minHeight = `${params.height - params.padTop - params.padBottom - 48}px`;
  article.style.overflow = 'hidden';
  article.style.boxSizing = 'border-box';
  sheet.appendChild(article);

  // 克隆 footer
  if (params.footer) {
    sheet.appendChild(params.footer.cloneNode(true));
  }

  // 注入标准页码底栏角标
  const pageFooterBar = document.createElement('div');
  pageFooterBar.className = 'docx-page-number-badge';
  pageFooterBar.innerHTML = `<span class="docx-badge-text">第 ${params.pageNumber} 页</span>`;
  sheet.appendChild(pageFooterBar);

  return sheet;
}

/**
 * 注入或更新页底角标
 */
function injectPageFooter(section: HTMLElement, pageNum: number, total: number) {
  let badge = section.querySelector<HTMLElement>('.docx-page-number-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'docx-page-number-badge';
    section.appendChild(badge);
  }
  badge.innerHTML = `<span class="docx-badge-text">第 ${pageNum} 页 / 共 ${total} 页</span>`;
}

function updatePageFooterText(section: HTMLElement, pageNum: number, total: number) {
  const badgeText = section.querySelector<HTMLElement>('.docx-badge-text');
  if (badgeText) {
    badgeText.textContent = `第 ${pageNum} 页 / 共 ${total} 页`;
  } else {
    injectPageFooter(section, pageNum, total);
  }
}

/**
 * 估算节点的渲染高度（用于无浏览器渲染树时的回退策略与测试环境）
 */
function estimateNodeHeight(el: HTMLElement): number {
  const tag = el.tagName?.toLowerCase();
  const textLen = el.textContent?.trim().length || 0;

  if (tag === 'h1') return 56;
  if (tag === 'h2') return 44;
  if (tag === 'h3') return 36;
  if (tag === 'table') {
    const rows = el.querySelectorAll ? el.querySelectorAll('tr').length : 3;
    return Math.max(60, rows * 32);
  }
  if (tag === 'img' || (el.querySelector && el.querySelector('img'))) {
    return 240;
  }
  // 普通段落 p 或 div：按每行约 38 个中文字符，每行行高约 24px 计算
  const lines = Math.max(1, Math.ceil(textLen / 38));
  return lines * 24 + 14;
}
