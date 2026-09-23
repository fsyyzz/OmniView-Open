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

  // 6. 普通 <img> 图片资源内嵌 Base64 化 (确保 Word/WPS/邮件离线也能完整显示图片，不产生红叉/空白)
  const imgElements = Array.from(cloneRoot.querySelectorAll('img'));
  for (const imgEl of imgElements) {
    const src = imgEl.getAttribute('src') || '';
    if (!src || src.startsWith('data:image/')) continue;

    // 如果是相对路径或 blob: 或 http 链接，转换为可嵌入的 Base64
    try {
      const imageBitmap = await new Promise<HTMLImageElement | null>((resolve) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = () => resolve(tempImg);
        tempImg.onerror = () => resolve(null);
        tempImg.src = src;
      });

      if (imageBitmap && imageBitmap.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.naturalWidth;
        canvas.height = imageBitmap.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageBitmap, 0, 0);
          const base64Url = canvas.toDataURL('image/png');
          imgEl.setAttribute('src', base64Url);
          imgEl.style.maxWidth = '100%';
          imgEl.style.height = 'auto';
          imgEl.style.display = 'block';
          imgEl.style.margin = '12px auto';
        }
      }
    } catch {
      // 容错降级
    }
  }
}

/**
 * 将代码和高亮 HTML 转换为 Word / WPS 原生支持的高保真 2 列排版表格 (左列行号，右列语法高亮代码)
 */
export function generateWordCodeTableHtml(code: string, highlightedHtml: string, lang = ''): string {
  const lines = code.split('\n');
  const highlightedLines = highlightedHtml.split('\n');

  let rowsHtml = '';
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineHtml = highlightedLines[i] !== undefined ? highlightedLines[i] : escapeHtml(lines[i]);
    const safeLineHtml = lineHtml === '' ? '&nbsp;' : lineHtml;

    rowsHtml += `
      <tr>
        <td style="width: 38px; text-align: right; padding: 0 8px 0 0; color: #94a3b8; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; border: none; user-select: none; vertical-align: top; white-space: nowrap;">${lineNum}</td>
        <td style="padding: 0 0 0 8px; border: none; border-left: 1px solid #cbd5e1; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; color: #0f172a; white-space: pre; word-break: normal; vertical-align: top;">${safeLineHtml}</td>
      </tr>`;
  }

  const langLabel = lang ? `<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">${escapeHtml(lang)}</div>` : '';

  return `
    <div style="margin: 14px 0;">
      <table style="border-collapse: collapse; width: 100%; max-width: 100%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px; margin: 0;">
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
