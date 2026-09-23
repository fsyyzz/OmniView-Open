/**
 * 跨平台/富文本环境 (Word, WPS, 邮件, 富文本编辑器) Markdown 专用剪贴板序列化与清洗引擎
 * 
 * 核心目标:
 * 1. 彻底剔除所有非正文交互 UI:
 *    - 剥除 .diagram-header, .table-block-toolbar, .ov-col-resizer 等悬浮/固定工具栏
 *    - 剥除排序箭头、源码行定位跳转徽标、双击编辑提示
 * 2. 彻底清除冗余边框与样式噪音:
 *    - 移除 .lazy-block-wrapper, .markdown-diagram 等外层容器的 border, box-shadow, min-height
 *    - 将行内 code, pre 转化为 Word 兼容的浅灰色高可读底纹，无杂乱边框
 *    - 表格转换为干净标准的原生 <table>，带有边框折叠与整齐 padding
 * 3. 矢量图表与内嵌图片智能光栅化:
 *    - 将被选区框选中的 <svg> 图表（Mermaid, PlantUML, Graphviz, Svg, DomainStory）自动转为高质量 Base64 PNG <img>
 *    - 保证 Word / WPS 粘贴时图片立即可见且为 300+ DPI 清晰度，不黑底
 */

import { convertSvgToDataUrl } from '../../../shared/lib/copyImageHelper.ts';

/**
 * 检查元素或其祖先是否属于剪贴板应忽略的交互 UI
 */
export function isIgnoredClipboardElement(el: Element): boolean {
  if (!el) return false;
  if (el.hasAttribute('data-clipboard-ignore')) return true;
  if (
    el.classList.contains('diagram-header') ||
    el.classList.contains('table-block-toolbar') ||
    el.classList.contains('ov-table-block-toolbar') ||
    el.classList.contains('ov-col-resizer') ||
    el.classList.contains('ov-table-sort-icon') ||
    el.classList.contains('markdown-bubble-toolbar') ||
    el.classList.contains('markdown-lazy-placeholder') ||
    el.classList.contains('page-break-screen-indicator') ||
    el.tagName.toLowerCase() === 'button'
  ) {
    return true;
  }
  return false;
}

/**
 * 将克隆的 DOM 片段进行深度清洗与富文本样式脱敏
 */
export async function cleanAndFormatDomForWord(cloneRoot: HTMLElement): Promise<void> {
  // 1. 移除所有交互工具栏与按钮
  const ignoreSelectors = [
    '[data-clipboard-ignore]',
    '.diagram-header',
    '.table-block-toolbar',
    '.ov-table-block-toolbar',
    '.ov-col-resizer',
    '.ov-table-sort-icon',
    '.markdown-bubble-toolbar',
    '.markdown-lazy-placeholder',
    '.page-break-screen-indicator',
    'button',
  ];

  for (const selector of ignoreSelectors) {
    const nodes = cloneRoot.querySelectorAll(selector);
    nodes.forEach((n) => n.remove());
  }

  // 2. 剥离外层容器边框与阴影，防止 Word 产生嵌套边框
  const containerSelectors = [
    '.lazy-block-wrapper',
    '.markdown-diagram',
    '.ov-table-block',
    '.ov-table-wrapper',
    '.markdown-code-block',
    '.ov-mermaid-svg-container',
  ];

  for (const sel of containerSelectors) {
    const elements = cloneRoot.querySelectorAll(sel);
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.border = 'none';
      htmlEl.style.boxShadow = 'none';
      htmlEl.style.background = 'transparent';
      htmlEl.style.margin = '12px 0';
      htmlEl.style.padding = '0';
      htmlEl.style.minHeight = 'auto';
      htmlEl.removeAttribute('title');
    });
  }

  // 3. 规范化表格 (转换为标准 Word 识别良好的 CSS 表格样式)
  const tables = cloneRoot.querySelectorAll('table');
  tables.forEach((tbl) => {
    const tableEl = tbl as HTMLTableElement;
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

  // 4. 行内代码与代码块样式规范化 (浅灰底纹，无杂乱边框)
  const codeBlocks = cloneRoot.querySelectorAll('pre');
  codeBlocks.forEach((pre) => {
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
  });

  const inlineCodes = cloneRoot.querySelectorAll(':not(pre) > code');
  inlineCodes.forEach((code) => {
    const cEl = code as HTMLElement;
    cEl.style.backgroundColor = '#f1f5f9';
    cEl.style.color = '#0f172a';
    cEl.style.padding = '2px 5px';
    cEl.style.borderRadius = '3px';
    cEl.style.border = '1px solid #e2e8f0';
    cEl.style.fontFamily = 'Consolas, Monaco, monospace';
    cEl.style.fontSize = '9pt';
  });

  // 5. 将 SVG 矢量图转为高保真 Base64 PNG <img> 标签 (Word/WPS 原生不支持内联 SVG)
  const svgElements = Array.from(cloneRoot.querySelectorAll('svg'));
  for (const svgEl of svgElements) {
    // 忽略细小图标（如 callout 小图标等如果已有）
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width || parseFloat(svgEl.getAttribute('width') || '0');
    const h = rect.height || parseFloat(svgEl.getAttribute('height') || '0');
    if (w > 0 && w < 30 && h > 0 && h < 30) {
      continue;
    }

    try {
      const serializer = new XMLSerializer();
      let svgText = serializer.serializeToString(svgEl);

      // 生成 300+ DPI 超采样高清 DataURL
      const dataUrl = await convertSvgToDataUrl(svgText, {
        scale: 3,
        backgroundColor: '#ffffff',
      });

      if (dataUrl) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '16px auto';
        img.alt = 'Rendered Diagram';

        svgEl.parentNode?.replaceChild(img, svgEl);
      }
    } catch (e) {
      console.warn('[WordClipboard] Failed to rasterize SVG for clipboard:', e);
    }
  }
}
