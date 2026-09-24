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
 * 同步将 SVG 元素序列化为 Base64 Data URL (0 延迟，零网络开销)
 */
export function svgToBase64DataUrl(svgEl: SVGElement): string {
  try {
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
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
export function cleanAndFormatDomForWordSync(cloneRoot: HTMLElement): void {
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
      const dataUri = svgToBase64DataUrl(svgEl);
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

  // 4. 彻底清洗所有节点：清除容器级边框、虚线、阴影与行定位属性，根除 Word 线框现象
  const allNodes = cloneRoot.querySelectorAll('*');
  allNodes.forEach((node) => {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

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

  // 5. 规范化表格 (转换为标准 Word 识别良好的原生表格样式)
  const tables = cloneRoot.querySelectorAll('table');
  tables.forEach((tbl) => {
    const tableEl = tbl as HTMLTableElement;
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

  // 6. 行内代码与代码块样式规范化 (浅灰底纹，无杂乱外框)
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
    preEl.style.whiteSpace = 'pre-wrap';
    preEl.style.wordBreak = 'break-word';
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

  // 7. 引用块 (Blockquote)
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
 * 兼容旧接口的异步清洗方法 (底层直接调用同步深度清洗)
 */
export async function cleanAndFormatDomForWord(cloneRoot: HTMLElement): Promise<void> {
  cleanAndFormatDomForWordSync(cloneRoot);
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
