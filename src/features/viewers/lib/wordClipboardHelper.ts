import { getPlantUmlSvgUrl } from '../../../shared/lib/plantuml';
import { mermaidRenderCache, graphvizRenderCache } from '../lib/diagramCache';
import { solidifySvgElement, solidifySvgString } from '../../../shared/lib/svgSolidifier';
import katex from 'katex';

/**
 * 跨平台/富文本环境 (Word, WPS, 邮件, 富文本编辑器) Markdown 专用剪贴板序列化与清洗引擎
 * 
 * 核心目标:
 * 1. 彻底剔除所有非正文交互 UI:
 *    - 剥除 .diagram-header, .table-block-toolbar, .ov-col-resizer 等悬浮/固定工具栏
 *    - 剥除排序箭头、源码行定位跳转徽标、双击编辑提示、断页提示虚线
 * 2. 彻底清除冗余边框与线框噪音:
 *    - 同步剥除 .lazy-block-wrapper, .markdown-diagram, .ov-image-container 等所有外层容器的 border, outline, box-shadow, min-height
 *    - 杜绝因含有图片/图表导致异步 await 错过浏览器 copy 事件生命周期的问题 (100% 同步清洗)
 *    - 将行内 code, pre 转化为 Word 兼容的浅灰色高可读底纹，无杂乱边框
 *    - 表格转换为干净标准的原生 <table>，带有边框折叠与整齐 padding
 * 3. 矢量图表与内嵌图片无损处理:
 *    - 将被选区框选中的 <svg> 图表（Mermaid, PlantUML, Graphviz, Svg, DomainStory）同步转为标准 Base64 SVG/PNG <img>
 *    - 抹除图片断链错误提示与冗余事件属性，保证 Word / WPS 粘贴时图片立即可见且无黑框
 */

/**
 * 检查元素或其祖先是否属于剪贴板应忽略的交互 UI
 */
export function isIgnoredClipboardElement(el: Element): boolean {
  if (!el) return false;
  if (el.hasAttribute('data-clipboard-ignore')) return true;
  if (
    el.classList.contains('diagram-header') ||
    el.classList.contains('code-block-header') ||
    el.classList.contains('diagram-tools') ||
    el.classList.contains('markdown-toolbar') ||
    el.classList.contains('markdown-outline') ||
    el.classList.contains('doc-status-bar') ||
    el.classList.contains('table-block-toolbar') ||
    el.classList.contains('ov-table-block-toolbar') ||
    el.classList.contains('ov-col-resizer') ||
    el.classList.contains('ov-table-sort-icon') ||
    el.classList.contains('markdown-bubble-toolbar') ||
    el.classList.contains('markdown-lazy-placeholder') ||
    el.classList.contains('page-break-screen-indicator') ||
    el.classList.contains('ov-image-fallback') ||
    el.classList.contains('ov-callout-fold-icon') ||
    el.tagName.toLowerCase() === 'button'
  ) {
    return true;
  }
  return false;
}

/**
 * 检查选区是否覆盖了目标容器的全部内容 (例如通过 Ctrl+A 或全选触发)
 */
export function isFullContainerSelection(range: Range, container: HTMLElement): boolean {
  if (!range || !container) return false;
  if (range.startContainer === container && range.endContainer === container) {
    return range.startOffset === 0 && range.endOffset >= container.childNodes.length;
  }
  const firstChild = container.firstElementChild;
  const lastChild = container.lastElementChild;
  if (firstChild && lastChild) {
    try {
      const startsAtBeginning = range.comparePoint(firstChild, 0) <= 0;
      const endsAtEnd = range.comparePoint(lastChild, lastChild.childNodes.length || 0) >= 0;
      return startsAtBeginning && endsAtEnd;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 同步将 SVG 元素序列化为 Base64 Data URL (0 延迟，零网络开销，自动固化图元与样式)
 */
export function svgToBase64DataUrl(svgEl: SVGElement, isDarkTheme = false): string {
  try {
    // 克隆节点避免污染视图现场，执行深度图元固化 (逆转 foreignObject 为原生 text，内联 stroke/fill)
    const targetSvg = (svgEl.cloneNode ? (svgEl.cloneNode(true) as SVGElement) : svgEl);
    solidifySvgElement(targetSvg, { isDarkTheme });
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(targetSvg);
    if (!svgStr.includes('xmlns=')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    // 安全 UTF-8 编码为 Base64
    if (typeof btoa !== 'undefined') {
      try {
        const utf8Bytes = new TextEncoder().encode(svgStr);
        let binary = '';
        const len = utf8Bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(utf8Bytes[i]);
        }
        return `data:image/svg+xml;base64,${btoa(binary)}`;
      } catch {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
      }
    }
    if (typeof Buffer !== 'undefined') {
      return `data:image/svg+xml;base64,${Buffer.from(svgStr, 'utf-8').toString('base64')}`;
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  } catch {
    return '';
  }
}

/**
 * 100% 同步执行的 DOM 深度清洗与 Word 富文本样式脱敏
 * 确保在浏览器 copy 事件处理周期内即时完成，不发生异步挂起导致回退到默认粗暴复制
 */
export function cleanAndFormatDomForWordSync(
  cloneRoot: HTMLElement,
  blocksMap?: Map<string, any>,
  options?: { isDarkTheme?: boolean; containerElement?: HTMLElement }
): void {
  // 0. 离屏占位块保底自愈 (Fail-Safe Unmounted Block Resolution)
  // 如果用户全选或长选区复制时，某些离屏图表/公式/表格由于尚未滚动进入视口而处于占位状态，
  // 依据 AST 块级元数据同步回填真实图表与排版内容，彻底解决“仅可见图表能复制进 Word”的问题
  if (blocksMap && blocksMap.size > 0) {
    resolveUnmountedLazyBlocks(cloneRoot, blocksMap, options);
  }

  // 1. 彻底移除所有非正文交互 UI、悬浮工具栏、按钮、错误提示、断页屏幕提示线
  const ignoreSelectors = [
    '[data-clipboard-ignore]',
    '.diagram-header',
    '.code-block-header',
    '.diagram-tools',
    '.markdown-toolbar',
    '.markdown-outline',
    '.doc-status-bar',
    '.table-block-toolbar',
    '.ov-table-block-toolbar',
    '.ov-col-resizer',
    '.ov-table-sort-icon',
    '.markdown-bubble-toolbar',
    '.markdown-lazy-placeholder',
    '.page-break-screen-indicator',
    '.ov-image-fallback',
    '.ov-callout-fold-icon',
    'button',
  ];

  for (const selector of ignoreSelectors) {
    const nodes = cloneRoot.querySelectorAll(selector);
    nodes.forEach((n) => n.remove());
  }

  // 2. 规范化所有图片 (img)，剥除断链 class、onerror 事件，确保图片干净无边框
  const imgElements = cloneRoot.querySelectorAll('img');
  imgElements.forEach((img) => {
    img.removeAttribute('onerror');
    img.removeAttribute('loading');
    img.removeAttribute('decoding');
    img.classList.remove('ov-img-broken');
    const htmlImg = img as HTMLElement;
    htmlImg.style.border = 'none';
    htmlImg.style.borderWidth = '0';
    htmlImg.style.outline = 'none';
    htmlImg.style.boxShadow = 'none';
    htmlImg.style.maxWidth = '100%';
    htmlImg.style.height = 'auto';
    htmlImg.style.display = 'block';
    htmlImg.style.margin = '12px auto';

    // 若图片源为 blob: 协议，或者在页面中已加载完毕且不是内联 DataURI，尝试同步转为 Base64 DataURI 嵌入剪贴板
    // 根除粘贴进 Word 时因无法访问浏览器内部 blob: URL 或跨端资源导致图片变成红叉或不可见的问题
    const src = img.getAttribute('src') || '';
    if (src && !src.startsWith('data:image/') && typeof document !== 'undefined') {
      try {
        let liveImg: HTMLImageElement | null = null;
        if (options?.containerElement) {
          try {
            liveImg = options.containerElement.querySelector(`img[src="${CSS.escape ? CSS.escape(src) : src}"]`);
          } catch {
            // CSS escape selector fallback
            const allLiveImgs = options.containerElement.querySelectorAll('img');
            for (const li of Array.from(allLiveImgs)) {
              if (li.getAttribute('src') === src) {
                liveImg = li;
                break;
              }
            }
          }
        }
        const sourceImg = liveImg || (img as HTMLImageElement);
        if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = sourceImg.naturalWidth;
          canvas.height = sourceImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(sourceImg, 0, 0);
            const mime = src.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mime, 0.95);
            if (dataUrl && dataUrl.length > 50) {
              img.setAttribute('src', dataUrl);
            }
          }
        }
      } catch {
        // 跨域受限降级，保留原 src
      }
    }
  });

  // 3. 将所有 <svg> 矢量图同步转换为标准 DataURI <img> 标签 (Word/WPS 深度原生支持)
  const svgElements = Array.from(cloneRoot.querySelectorAll('svg'));
  for (const svgEl of svgElements) {
    // 忽略细小图标
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width || parseFloat(svgEl.getAttribute('width') || '0');
    const h = rect.height || parseFloat(svgEl.getAttribute('height') || '0');
    if (w > 0 && w < 24 && h > 0 && h < 24) {
      continue;
    }

    try {
      const dataUri = svgToBase64DataUrl(svgEl, options?.isDarkTheme);
      if (dataUri) {
        const img = document.createElement('img');
        img.src = dataUri;
        img.alt = 'Rendered Diagram';
        img.style.border = 'none';
        img.style.borderWidth = '0';
        img.style.outline = 'none';
        img.style.boxShadow = 'none';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '14px auto';
        svgEl.parentNode?.replaceChild(img, svgEl);
      }
    } catch {
      // 容错降级
    }
  }

  // 4. 将所有代码块 (.markdown-code-block 与 .code-block-body) 规整转换为 Word 原生双列高保真表格
  // 彻底根除 Ctrl+A 全选或跨行框选时，行号栏与代码正文在 Word 中断裂为上下两截的行业顽疾
  convertCodeBlocksToWordTables(cloneRoot);

  // 5. 彻底清洗所有节点：清除容器级边框、虚线、阴影与行定位属性，根除 Word 线框现象
  const allNodes = cloneRoot.querySelectorAll('*');
  allNodes.forEach((node) => {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // 如果属于 Word 代码表格容器或其子元素，必须完整保留专属样式，不被通用容器清洗覆盖
    if (el.hasAttribute?.('data-word-code-table') || el.closest?.('[data-word-code-table]')) {
      return;
    }

    // 移除导致 Word 产生行定位或额外样式的非标准属性
    el.removeAttribute('data-source-line');
    el.removeAttribute('data-source-end-line');
    el.removeAttribute('data-density');
    el.removeAttribute('data-task-line');
    el.removeAttribute('data-block-id');
    if (el.hasAttribute('title') && /双击|排序|折叠|编辑|查看大图/i.test(el.getAttribute('title') || '')) {
      el.removeAttribute('title');
    }

    // 保留特定标签的原生边框：table, th, td, pre, hr
    if (['table', 'th', 'td', 'pre', 'hr'].includes(tagName)) {
      return;
    }

    // Callout 专用边框 (仅保留左侧精致装饰条，去除外层包裹边框)
    if (el.classList.contains('ov-callout')) {
      el.style.border = 'none';
      el.style.borderWidth = '0';
      el.style.borderLeft = '3.5px solid #3b82f6';
      el.style.backgroundColor = '#f8fafc';
      el.style.padding = '8px 12px';
      el.style.margin = '12px 0';
      el.style.boxShadow = 'none';
      el.style.outline = 'none';
      return;
    }

    // 针对所有容器元素 (div, span, section, article, figure, p, header, main, details, summary)
    // 强制将 border, outline, boxShadow, minHeight 彻底清零
    if (['div', 'section', 'article', 'figure', 'span', 'header', 'main', 'details', 'summary', 'p'].includes(tagName)) {
      el.style.border = 'none';
      el.style.borderWidth = '0';
      el.style.borderStyle = 'none';
      el.style.borderColor = 'transparent';
      el.style.outline = 'none';
      el.style.boxShadow = 'none';
      el.style.minHeight = 'auto';
      if (!el.classList.contains('ov-callout-body') && !el.classList.contains('ov-callout-title')) {
        el.style.background = 'transparent';
      }
    }
  });

  // 6. 规范化通用数据表格 (跳过 Word 专属双列代码表格)
  const tables = cloneRoot.querySelectorAll('table');
  tables.forEach((tbl) => {
    const tableEl = tbl as HTMLTableElement;
    if (tableEl.hasAttribute?.('data-word-code-table') || tableEl.closest?.('[data-word-code-table]')) {
      return;
    }

    tableEl.setAttribute('border', '1');
    tableEl.setAttribute('cellspacing', '0');
    tableEl.setAttribute('cellpadding', '6');
    tableEl.style.borderCollapse = 'collapse';
    tableEl.style.width = '100%';
    tableEl.style.margin = '14px 0';
    tableEl.style.border = '1px solid #cbd5e1';
    tableEl.style.fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
    tableEl.style.fontSize = '10pt';

    const ths = tableEl.querySelectorAll('th');
    ths.forEach((th) => {
      const thEl = th as HTMLElement;
      thEl.style.border = '1px solid #cbd5e1';
      thEl.style.backgroundColor = '#f1f5f9';
      thEl.style.color = '#0f172a';
      thEl.style.fontWeight = 'bold';
      thEl.style.padding = '6px 10px';
      thEl.style.textAlign = thEl.style.textAlign || 'left';
    });

    const tds = tableEl.querySelectorAll('td');
    tds.forEach((td) => {
      const tdEl = td as HTMLElement;
      tdEl.style.border = '1px solid #cbd5e1';
      tdEl.style.padding = '6px 10px';
      tdEl.style.color = '#1e293b';
    });
  });

  // 7. 行内代码与孤立代码块样式规范化 (浅灰底纹，无杂乱外框，跳过代码表格)
  const codeBlocks = cloneRoot.querySelectorAll('pre');
  codeBlocks.forEach((pre) => {
    if (pre.closest?.('[data-word-code-table]')) return;
    const preEl = pre as HTMLElement;
    preEl.style.backgroundColor = '#f8fafc';
    preEl.style.border = '1px solid #e2e8f0';
    preEl.style.borderRadius = '4px';
    preEl.style.padding = '10px 14px';
    preEl.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
    preEl.style.fontSize = '9.5pt';
    preEl.style.lineHeight = '1.5';
    preEl.style.color = '#0f172a';
    preEl.style.margin = '12px 0';
    preEl.style.whiteSpace = 'pre-wrap';
    preEl.style.wordBreak = 'break-word';
  });

  const inlineCodes = cloneRoot.querySelectorAll(':not(pre) > code');
  inlineCodes.forEach((code) => {
    if (code.closest?.('[data-word-code-table]')) return;
    const cEl = code as HTMLElement;
    cEl.style.backgroundColor = '#f1f5f9';
    cEl.style.color = '#0f172a';
    cEl.style.padding = '2px 5px';
    cEl.style.borderRadius = '3px';
    cEl.style.border = '1px solid #e2e8f0';
    cEl.style.fontFamily = 'Consolas, Monaco, monospace';
    cEl.style.fontSize = '9pt';
  });

  // 8. 引用块 (Blockquote)
  const blockquotes = cloneRoot.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    const bqEl = bq as HTMLElement;
    bqEl.style.border = 'none';
    bqEl.style.borderLeft = '3.5px solid #cbd5e1';
    bqEl.style.paddingLeft = '12px';
    bqEl.style.margin = '12px 0';
    bqEl.style.color = '#475569';
    bqEl.style.fontStyle = 'italic';
  });
}

/**
 * 将克隆 DOM 树中的所有代码块 (.markdown-code-block 或局部选中的 .code-block-body) 转换为 Word 原生双列高保真代码表格
 */
export function convertCodeBlocksToWordTables(cloneRoot: HTMLElement): void {
  // 1. 查找所有完整的代码块容器
  const codeBlocks = Array.from(cloneRoot.querySelectorAll('.markdown-code-block'));

  // 2. 查找未被 .markdown-code-block 包裹的局部选中代码块主体 (例如跨行划选)
  const codeBodies = Array.from(cloneRoot.querySelectorAll('.code-block-body')).filter((body) => {
    return !body.closest?.('.markdown-code-block');
  });

  const targets = [...codeBlocks, ...codeBodies];

  for (const target of targets) {
    const codeEl = target.querySelector?.('pre.code-line-body code, pre code, code') as HTMLElement | null;
    if (!codeEl) continue;

    // 提取语言
    let lang = target.getAttribute?.('data-lang') || '';
    if (!lang && codeEl.className) {
      const match = codeEl.className.match(/language-([^\s]+)/);
      if (match) lang = match[1];
    }
    if (!lang) {
      const headerSpan = target.querySelector?.('.code-block-header span');
      if (headerSpan?.textContent) {
        lang = headerSpan.textContent.trim().toLowerCase();
      }
    }

    const code = codeEl.textContent || '';
    const highlightedHtml = codeEl.innerHTML || escapeHtml(code);

    const wordTableHtml = generateWordCodeTableHtml(code, highlightedHtml, lang);

    // 在 DOM 环境下将代码块替换为原生 Word 表格
    const doc = (typeof document !== 'undefined' ? document : (cloneRoot as any).ownerDocument) || (target as any).ownerDocument;
    if (doc?.createElement && target.parentNode) {
      const tempDiv = doc.createElement('div');
      tempDiv.innerHTML = wordTableHtml;
      const replacement = tempDiv.firstElementChild || tempDiv;
      target.parentNode.replaceChild(replacement, target);
    }
  }

  // 3. 彻底清除任何残留的独立行号槽 (防止任何极端选区下孤立行号漏入 Word)
  const leftoverGutters = Array.from(cloneRoot.querySelectorAll('.code-line-gutter'));
  for (const gutter of leftoverGutters) {
    gutter.remove?.();
  }
}

/**
 * 离屏未挂载/占位块智能解析与回填引擎
 * 将处于 .markdown-lazy-placeholder 状态的离屏图表、公式、表格、代码块
 * 根据 AST 块元数据同步逆向渲染为真实 DOM，确保全选复制至 Word 绝对不遗漏任何离屏图表
 */
export function resolveUnmountedLazyBlocks(
  cloneRoot: HTMLElement,
  blocksMap: Map<string, any>,
  options?: { isDarkTheme?: boolean }
): void {
  const placeholders = Array.from(
    cloneRoot.querySelectorAll('.lazy-block-wrapper, .markdown-lazy-placeholder')
  );

  const doc = (typeof document !== 'undefined' ? document : (cloneRoot as any).ownerDocument) || (cloneRoot as any).ownerDocument;

  for (const node of placeholders) {
    const wrapper = (node.classList?.contains?.('lazy-block-wrapper')
      ? node
      : node.closest?.('.lazy-block-wrapper')) as HTMLElement | null;

    if (!wrapper) continue;

    // 检查是否包含未渲染的占位符或标记为未挂载
    const placeholderChild = wrapper.querySelector?.('.markdown-lazy-placeholder');
    const isLazyUnmounted = wrapper.getAttribute?.('data-lazy-mounted') === '0';
    if (!placeholderChild && !isLazyUnmounted) {
      continue;
    }

    const blockId =
      wrapper.id ||
      wrapper.getAttribute?.('data-block-id') ||
      placeholderChild?.getAttribute?.('data-block-id') ||
      node.getAttribute?.('data-block-id');
    if (!blockId) continue;
    const block = blocksMap.get(blockId);
    if (!block) continue;

    let replacementHtml = '';

    if (block.type === 'mermaid') {
      const theme = options?.isDarkTheme ? 'dark' : 'light';
      const cacheKey = mermaidRenderCache.makeKey('mermaid', block.raw, theme);
      const cachedSvg = mermaidRenderCache.get(cacheKey) || block.svgContent;
      if (cachedSvg) {
        const solidified = solidifySvgString(cachedSvg, { isDarkTheme: options?.isDarkTheme });
        replacementHtml = `<div style="text-align: center; margin: 16px auto;">${solidified}</div>`;
      } else {
        replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), 'mermaid');
      }
    } else if (block.type === 'plantuml') {
      const pumlUrl = getPlantUmlSvgUrl(block.raw, undefined, options?.isDarkTheme);
      replacementHtml = `<div style="text-align: center; margin: 16px auto;"><img src="${pumlUrl}" alt="PlantUML Diagram" style="max-width: 100%; height: auto;" /></div>`;
    } else if (block.type === 'svg') {
      const svg = block.svgContent || (block.raw && block.raw.includes('<svg') ? block.raw : '');
      if (svg) {
        const solidified = solidifySvgString(svg, { isDarkTheme: options?.isDarkTheme });
        replacementHtml = `<div style="text-align: center; margin: 16px auto;">${solidified}</div>`;
      } else {
        replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), 'svg');
      }
    } else if (block.type === 'graphviz') {
      const svg = block.svgContent || graphvizRenderCache.get(block.raw);
      if (svg) {
        const solidified = solidifySvgString(svg, { isDarkTheme: options?.isDarkTheme });
        replacementHtml = `<div style="text-align: center; margin: 16px auto;">${solidified}</div>`;
      } else {
        replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), 'dot');
      }
    } else if (block.type === 'domainstory') {
      if (block.svgContent) {
        const solidified = solidifySvgString(block.svgContent, { isDarkTheme: options?.isDarkTheme });
        replacementHtml = `<div style="text-align: center; margin: 16px auto;">${solidified}</div>`;
      } else {
        replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), 'domainstory');
      }
    } else if (block.type === 'markmap') {
      if (block.svgContent) {
        const solidified = solidifySvgString(block.svgContent, { isDarkTheme: options?.isDarkTheme });
        replacementHtml = `<div style="text-align: center; margin: 16px auto;">${solidified}</div>`;
      } else {
        replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), 'markmap');
      }
    } else if (block.type === 'excalidraw') {
      if (block.svgContent) {
        const solidified = solidifySvgString(block.svgContent, { isDarkTheme: options?.isDarkTheme });
        replacementHtml = `<div style="text-align: center; margin: 16px auto;">${solidified}</div>`;
      } else {
        replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), 'excalidraw');
      }
    } else if (block.type === 'math') {
      try {
        const mathHtml = katex.renderToString(block.raw, { displayMode: true, throwOnError: false, errorColor: '#f43f5e' });
        replacementHtml = `<div style="text-align: center; margin: 14px 0;">${mathHtml}</div>`;
      } catch {
        replacementHtml = `<div style="text-align: center; font-family: 'Cambria Math', serif; margin: 14px 0;">$$ ${escapeHtml(block.raw)} $$</div>`;
      }
    } else if (block.type === 'table' && block.tableData) {
      const headers = (block.tableData.header || [])
        .map((h: any) => `<th style="border: 1px solid #cbd5e1; background-color: #f1f5f9; padding: 6px 12px; font-weight: bold; text-align: left;">${escapeHtml(typeof h === 'string' ? h : h?.text || '')}</th>`)
        .join('');
      const rows = (block.tableData.rows || [])
        .map((r: any) => {
          const cells = (r.cells || [])
            .map((c: any) => `<td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: left;">${escapeHtml(typeof c === 'string' ? c : c?.text || '')}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      replacementHtml = `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; margin: 14px 0;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    } else if (block.type === 'code') {
      replacementHtml = generateWordCodeTableHtml(block.raw, escapeHtml(block.raw), block.lang || '');
    }

    const targetDoc =
      (typeof document !== 'undefined' ? document : null) ||
      (cloneRoot as any)?.ownerDocument ||
      wrapper.ownerDocument ||
      (wrapper.parentNode as any)?.ownerDocument;

    if (replacementHtml && targetDoc?.createElement && wrapper.parentNode) {
      const tempDiv = targetDoc.createElement('div');
      tempDiv.innerHTML = replacementHtml;
      const replacement = tempDiv.firstElementChild || tempDiv;
      wrapper.parentNode.replaceChild(replacement, wrapper);
    }
  }
}

/**
 * 兼容旧接口的异步清洗方法 (底层直接调用同步深度清洗)
 */
export async function cleanAndFormatDomForWord(
  cloneRoot: HTMLElement,
  blocksMap?: Map<string, any>,
  options?: { isDarkTheme?: boolean }
): Promise<void> {
  cleanAndFormatDomForWordSync(cloneRoot, blocksMap, options);
}

/**
 * 为 Prism Token 标签注入行内样式，确保在 Word / WPS / 邮件等外部富文本软件中完整保留语法着色
 */
export function inlinePrismStyles(html: string): string {
  const tokenStyles: Record<string, string> = {
    'comment': 'color: #6a737d; font-style: italic;',
    'prolog': 'color: #6a737d; font-style: italic;',
    'doctype': 'color: #6a737d; font-style: italic;',
    'cdata': 'color: #6a737d; font-style: italic;',
    'punctuation': 'color: #24292e;',
    'namespace': 'color: #6f42c1;',
    'property': 'color: #005cc5;',
    'tag': 'color: #22863a;',
    'boolean': 'color: #005cc5; font-weight: 600;',
    'number': 'color: #005cc5;',
    'constant': 'color: #005cc5;',
    'symbol': 'color: #005cc5;',
    'deleted': 'color: #b31d28; background-color: #ffeef0;',
    'selector': 'color: #22863a;',
    'attr-name': 'color: #6f42c1;',
    'string': 'color: #032f62;',
    'char': 'color: #032f62;',
    'builtin': 'color: #005cc5;',
    'inserted': 'color: #22863a; background-color: #f0fff4;',
    'operator': 'color: #d73a49;',
    'entity': 'color: #6f42c1;',
    'url': 'color: #032f62;',
    'variable': 'color: #e36209;',
    'atrule': 'color: #d73a49;',
    'attr-value': 'color: #032f62;',
    'function': 'color: #6f42c1;',
    'class-name': 'color: #6f42c1; font-weight: 600;',
    'keyword': 'color: #d73a49; font-weight: 600;',
    'regex': 'color: #032f62;',
    'important': 'color: #d73a49; font-weight: bold;',
  };

  return html.replace(/<span\s+class="token\s+([^"]+)"([^>]*)>/g, (match, classes, rest) => {
    if (rest.includes('style=')) return match;
    const classList = classes.split(/\s+/);
    let matchedStyle = '';
    for (const cls of classList) {
      if (tokenStyles[cls]) {
        matchedStyle += tokenStyles[cls] + ' ';
      }
    }
    if (matchedStyle) {
      return `<span class="token ${classes}" style="${matchedStyle.trim()}"${rest}>`;
    }
    return match;
  });
}

/**
 * 平衡分行后的 HTML 标签，保证多行注释或字符串在跨行拆分后每行都是合法的 HTML 结构
 */
export function balanceMultilineSpans(rawLines: string[]): string[] {
  const result: string[] = [];
  const openSpanStack: string[] = [];

  for (const line of rawLines) {
    let currentLine = '';
    for (const openTag of openSpanStack) {
      currentLine += openTag;
    }

    const tagRegex = /<span\b[^>]*>|<\/span>/gi;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(line)) !== null) {
      const tag = match[0];
      if (tag.toLowerCase() === '</span>') {
        if (openSpanStack.length > 0) {
          openSpanStack.pop();
        }
      } else {
        openSpanStack.push(tag);
      }
    }

    currentLine += line;

    for (let i = openSpanStack.length - 1; i >= 0; i--) {
      currentLine += '</span>';
    }

    result.push(currentLine);
  }

  return result;
}

/**
 * 将代码和高亮 HTML 转换为 Word / WPS 原生支持的高保真 2 列排版表格 (左列行号，右列语法高亮代码)
 */
export function generateWordCodeTableHtml(code: string, highlightedHtml: string, lang = ''): string {
  const inlinedHtml = inlinePrismStyles(highlightedHtml);
  const lines = code.split('\n');
  const highlightedLines = balanceMultilineSpans(inlinedHtml.split('\n'));

  let rowsHtml = '';
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineHtml = highlightedLines[i] !== undefined && highlightedLines[i] !== '' ? highlightedLines[i] : escapeHtml(lines[i]);
    const safeLineHtml = lineHtml === '' ? '&nbsp;' : lineHtml;

    rowsHtml += `
      <tr>
        <td style="width: 38px; text-align: right; padding: 0 8px 0 0; color: #94a3b8; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; border: none; user-select: none; vertical-align: top; white-space: nowrap;">${lineNum}</td>
        <td style="padding: 0 0 0 8px; border: none; border-left: 1px solid #cbd5e1; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; color: #0f172a; white-space: pre; word-break: normal; vertical-align: top;">${safeLineHtml}</td>
      </tr>`;
  }

  const langLabel = lang ? `<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">${escapeHtml(lang.toUpperCase())}</div>` : '';

  return `
    <div data-word-code-table="true" style="margin: 14px 0;">
      ${langLabel}
      <table data-word-code-table="true" style="border-collapse: collapse; width: 100%; max-width: 100%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px; margin: 0;">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 复制带行号与高亮格式的代码至剪贴板 (同时提供 text/html 与 text/plain 两种格式)
 */
export async function copyCodeAsWordTable(code: string, highlightedHtml: string, lang = ''): Promise<boolean> {
  const htmlTable = generateWordCodeTableHtml(code, highlightedHtml, lang);
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([htmlTable], { type: 'text/html' });
      const blobText = new Blob([code], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn('[WordClipboard] Async Clipboard write failed, falling back to execCommand:', err);
  }

  // 降级 fallback
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlTable;
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.opacity = '0';
    document.body.appendChild(tempDiv);

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const success = document.execCommand('copy');
    document.body.removeChild(tempDiv);
    return success;
  } catch {
    return false;
  }
}
