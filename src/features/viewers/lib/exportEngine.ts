/**
 * OmniView 高保真文档导出引擎 (PDF 打印排版 / 原生 Word / 单文件便携 HTML)
 * 支持智能防跨页截断、SVG 矢量转嵌入高清位图、Office MSO 样式映射
 */

/**
 * 将 DOM 中的单个 SVG 元素通过 Canvas 转换为高质量 PNG Base64 字符串
 */
export async function convertSvgElementToPngBase64(svgEl: SVGElement, scale = 2): Promise<string> {
  return new Promise((resolve) => {
    try {
      const serializer = new XMLSerializer();
      let svgXml = serializer.serializeToString(svgEl);

      // 确保包含命名空间
      if (!svgXml.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgXml = svgXml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const rect = svgEl.getBoundingClientRect();
      const width = Math.max(300, (rect.width || parseInt(svgEl.getAttribute('width') || '600', 10)) * scale);
      const height = Math.max(150, (rect.height || parseInt(svgEl.getAttribute('height') || '400', 10)) * scale);

      const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const pngData = canvas.toDataURL('image/png', 0.95);
            URL.revokeObjectURL(blobUrl);
            resolve(pngData);
            return;
          }
        } catch (e) {
          console.warn('Canvas export failed, falling back to SVG data URL', e);
        }
        URL.revokeObjectURL(blobUrl);
        resolve('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml));
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml));
      };

      img.src = blobUrl;
    } catch {
      resolve('');
    }
  });
}

/**
 * 清理 DOM 节点中的交互控件（工具栏、复制按钮、缩放控制器等）
 */
export function cleanInteractiveElements(root: HTMLElement): void {
  // 1. 展开所有被折叠的 details（Callout、卡片组、FAQ 等），确保打印和导出时不丢失折叠内容
  root.querySelectorAll('details').forEach((el) => {
    el.setAttribute('open', '');
  });

  // 2. 处理多标签组 (Tabs)：在移除交互按钮前提取各 Tab 标题并转化为打印友好的徽标，同时展开全部 Tab 面板
  root.querySelectorAll('.ov-tab-group').forEach((group) => {
    const navButtons = Array.from(group.querySelectorAll('.ov-tab-btn')) as HTMLElement[];
    const panels = Array.from(group.querySelectorAll('.ov-tab-panel')) as HTMLElement[];

    panels.forEach((panel, idx) => {
      panel.style.display = 'block';
      const labelText =
        navButtons[idx]?.textContent?.trim() ||
        panel.getAttribute('data-tab-label') ||
        `Tab ${idx + 1}`;
      if (!panel.querySelector('.ov-tab-print-badge')) {
        const badge = document.createElement('div');
        badge.className = 'ov-tab-print-badge';
        badge.innerHTML = `<span class="ov-tab-print-tag">标签页: ${labelText}</span>`;
        panel.insertBefore(badge, panel.firstChild);
      }
    });
  });

  const selectorsToRemove = [
    '.diagram-header',
    '.code-block-header',
    '.diagram-tools',
    '.markdown-toolbar',
    '.markdown-outline',
    '.markdown-outline-sidebar',
    '.doc-status-bar',
    '#doc-status-bar',
    '#workbench-header',
    '#workbench-sidebar',
    '#workbench-statusbar',
    '.table-block-toolbar',
    '.ov-table-block-toolbar',
    '.table-block-footer',
    '.ov-table-block-footer',
    '.ov-table-sort-icon',
    '.ov-col-resizer',
    '.ov-callout-fold-icon',
    '.ov-faq-chevron',
    '.ov-block-action-bar',
    '.ov-bubble-toolbar',
    '.lightbox-modal',
    '.code-lightbox-modal',
    '.ov-table-lightbox-modal',
    '.no-print',
    'button',
    '.ov-image-fallback',
  ];

  selectorsToRemove.forEach((sel) => {
    root.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // 表头排序仅用于交互态；导出/打印去掉点击暗示
  root.querySelectorAll('th').forEach((th) => {
    const el = th as HTMLElement;
    el.style.cursor = 'default';
    if (el.title && /sort|排序/i.test(el.title)) {
      el.removeAttribute('title');
    }
  });

  // 展开所有被折叠的代码块
  root.querySelectorAll('.code-block-content').forEach((el) => {
    (el as HTMLElement).style.display = 'block';
  });

  // 重置所有缩放变换
  root.querySelectorAll('.diagram-canvas').forEach((el) => {
    (el as HTMLElement).style.transform = 'none';
  });
}

/**
 * 导出为原生 Microsoft Word 兼容格式 (.doc)
 * 内置 Office MSO 专有命名空间与排版样式，自动将 Mermaid/Graphviz/PlantUML SVG 转换为高清内嵌图片
 */
export async function exportToWordDocument(documentTitle: string, container: HTMLElement): Promise<void> {
  const clone = container.cloneNode(true) as HTMLElement;
  cleanInteractiveElements(clone);

  // 1. 将所有 SVG 转换为嵌入式高清 PNG 图片，确保 Word 正常显示且不依赖外链
  const svgs = Array.from(clone.querySelectorAll('svg'));
  for (const svg of svgs) {
    try {
      const pngBase64 = await convertSvgElementToPngBase64(svg, 2);
      if (pngBase64) {
        const img = document.createElement('img');
        img.src = pngBase64;
        img.alt = 'Exported Diagram';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '12pt auto';
        svg.parentNode?.replaceChild(img, svg);
      }
    } catch (err) {
      console.warn('Failed to convert SVG to image for Word export', err);
    }
  }

  // 2. 将代码块优化为 Word 专用底色表格与等宽字体
  clone.querySelectorAll('pre').forEach((pre) => {
    pre.style.backgroundColor = '#f8fafc';
    pre.style.border = '1pt solid #e2e8f0';
    pre.style.padding = '8pt 12pt';
    pre.style.margin = '10pt 0';
    pre.style.fontFamily = "'Consolas', 'Courier New', monospace";
    pre.style.fontSize = '9.5pt';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
  });

  // 3. 将表格设置兼容 Word 的边框属性
  clone.querySelectorAll('table').forEach((tbl) => {
    tbl.setAttribute('border', '1');
    tbl.setAttribute('cellspacing', '0');
    tbl.setAttribute('cellpadding', '6');
    tbl.style.borderCollapse = 'collapse';
    tbl.style.width = '100%';
    tbl.style.margin = '12pt 0';
    tbl.querySelectorAll('th').forEach((th) => {
      th.style.backgroundColor = '#f1f5f9';
      th.style.border = '1pt solid #cbd5e1';
      th.style.fontWeight = 'bold';
    });
    tbl.querySelectorAll('td').forEach((td) => {
      td.style.border = '1pt solid #cbd5e1';
    });
  });

  // 4. 引用块 Callout 优化
  clone.querySelectorAll('blockquote').forEach((bq) => {
    bq.style.borderLeft = '3pt solid #3b82f6';
    bq.style.backgroundColor = '#f0f9ff';
    bq.style.padding = '6pt 12pt';
    bq.style.margin = '8pt 0';
    bq.style.color = '#1e40af';
  });

  // 5. 组合 Microsoft Word 专有 MSO HTML 模板
  const wordHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${documentTitle}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* A4 标准纸张尺寸 */
      margin: 72.0pt 72.0pt 72.0pt 72.0pt;
      mso-header-margin: 35.4pt;
      mso-footer-margin: 35.4pt;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Calibri', 'Microsoft YaHei', -apple-system, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1e293b;
      background-color: #ffffff;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 18pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      color: #1e293b;
      margin-top: 14pt;
      margin-bottom: 5pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      font-weight: bold;
      color: #334155;
      margin-top: 10pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }
    p {
      margin-top: 0;
      margin-bottom: 6pt;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 6pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 3pt;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    .markdown-diagram, .markdown-code-block, .ov-table-wrapper, .ov-katex-block {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${clone.innerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = documentTitle.replace(/\.(md|markdown|puml|svg)$/i, '');
  a.download = `${cleanName}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 构建单文件高保真离线 HTML（供导出下载与插件外置打印复用）
 * 完整内联 KaTeX 公式、已渲染图表 SVG、代码高亮以及印刷打印样式
 */
export function buildPortableHtml(documentTitle: string, container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  cleanInteractiveElements(clone);
  const safeTitle = documentTitle.replace(/[<>&"]/g, '');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  <style>
    :root {
      color-scheme: light;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.7;
      max-width: 900px;
      margin: 40px auto;
      padding: 0 24px;
      color: #1e293b;
      background: #ffffff;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-weight: 600;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
      line-height: 1.35;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.25em; }
    h3 { font-size: 1.25em; }
    p { margin: 0.8em 0; }
    /* 代码块：保留行号 gutter 横向布局，字号/行高与正文对齐，禁止换行错位 */
    .markdown-code-block {
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin: 16px 0;
      overflow: hidden;
    }
    .markdown-code-block .code-block-body {
      display: flex;
      align-items: stretch;
      background: #f8fafc;
    }
    .markdown-code-block .code-line-gutter {
      flex-shrink: 0;
      min-width: 2.4em;
      padding: 14px 10px 14px 12px;
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      line-height: 1.55;
      color: #94a3b8;
      background: #f1f5f9;
      border-right: 1px solid #e2e8f0;
      white-space: pre;
      user-select: none;
    }
    .markdown-code-block .code-line-number {
      font-size: inherit;
      line-height: 1.55;
      height: 1.55em;
    }
    .markdown-code-block .code-line-body,
    .markdown-code-block pre {
      flex: 1 1 auto;
      margin: 0;
      padding: 14px 16px;
      background: transparent;
      border: none;
      border-radius: 0;
      overflow-x: auto;
      white-space: pre;
      word-break: normal;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      line-height: 1.55;
      color: #0f172a;
    }
    pre:not(.code-line-body) {
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      line-height: 1.55;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #0f172a;
    }
    pre code {
      background: transparent;
      padding: 0;
      font-size: inherit;
      line-height: inherit;
    }
    .ov-table-sort-icon {
      display: none !important;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
      break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 14px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      cursor: default;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .ov-table-block, .ov-table-wrapper {
      margin: 18px 0;
      width: 100%;
      overflow: visible;
      break-inside: auto;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 16px 0;
      padding: 8px 16px;
      background: #eff6ff;
      color: #1e40af;
      border-radius: 0 6px 6px 0;
    }
    /* =========================================================
       Callout / GitHub Alerts
       ========================================================= */
    .ov-callout {
      margin: 16px 0;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid var(--callout-border, rgba(59, 130, 246, 0.25));
      border-left: 4px solid var(--callout-color, #3b82f6);
      background: var(--callout-bg, #eff6ff);
      break-inside: avoid;
      page-break-inside: avoid;
      box-sizing: border-box;
    }
    .ov-callout-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
      color: var(--callout-color, #3b82f6);
      line-height: 1.45;
      margin-bottom: 6px;
    }
    .ov-callout-title-left {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .ov-callout-icon {
      flex-shrink: 0;
      stroke: var(--callout-color, #3b82f6);
      width: 18px;
      height: 18px;
    }
    .ov-callout-body {
      font-size: 14px;
      line-height: 1.65;
      color: #1e293b;
    }
    .ov-callout-body > :first-child { margin-top: 0; }
    .ov-callout-body > :last-child { margin-bottom: 0; }
    .ov-callout-note { --callout-color: #2563eb; --callout-border: #bfdbfe; --callout-bg: #eff6ff; }
    .ov-callout-tip { --callout-color: #059669; --callout-border: #a7f3d0; --callout-bg: #ecfdf5; }
    .ov-callout-important { --callout-color: #7c3aed; --callout-border: #ddd6fe; --callout-bg: #f5f3ff; }
    .ov-callout-warning { --callout-color: #d97706; --callout-border: #fde68a; --callout-bg: #fffbeb; }
    .ov-callout-caution { --callout-color: #dc2626; --callout-border: #fecaca; --callout-bg: #fef2f2; }
    .ov-callout-success { --callout-color: #16a34a; --callout-border: #bbf7d0; --callout-bg: #f0fdf4; }
    .ov-callout-question { --callout-color: #0891b2; --callout-border: #a5f3fc; --callout-bg: #ecfeff; }
    .ov-callout-example { --callout-color: #4f46e5; --callout-border: #c7d2fe; --callout-bg: #eef2ff; }
    .ov-callout-quote { --callout-color: #475569; --callout-border: #cbd5e1; --callout-bg: #f8fafc; }

    /* =========================================================
       Card Grids & Single Cards
       ========================================================= */
    .ov-card-grid-container {
      margin: 20px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-card-grid-header, .ov-card-single-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .ov-card-grid-title-left, .ov-card-single-title-left {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .ov-card-grid-body > ul, .ov-card-grid-body > ol {
      display: grid;
      grid-template-columns: repeat(var(--ov-card-cols, 2), minmax(0, 1fr));
      gap: 14px;
      list-style: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .ov-card-grid-body > ul > li, .ov-card-grid-body > ol > li, .ov-card-single {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      padding: 14px 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-card-single {
      margin: 16px 0;
    }

    /* =========================================================
       Tabs Group
       ========================================================= */
    .ov-tab-group {
      margin: 20px 0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      break-inside: avoid;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .ov-tab-header-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 14px;
    }
    .ov-tab-group-title {
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
    }
    .ov-tab-panels {
      padding: 14px 18px;
    }
    .ov-tab-panel {
      display: block;
      margin-bottom: 12px;
    }
    .ov-tab-panel:not(:last-child) {
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 12px;
    }
    .ov-tab-print-badge {
      margin-bottom: 8px;
    }
    .ov-tab-print-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 2px 8px;
    }

    /* =========================================================
       Steps Guide & Timeline
       ========================================================= */
    .ov-steps-container, .ov-timeline-container {
      margin: 20px 0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      padding: 18px 20px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-steps-header, .ov-timeline-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .ov-steps-body > ol, .ov-steps-body > ul {
      list-style: none !important;
      padding-left: 0 !important;
      margin: 0 !important;
      counter-reset: ov-step-counter;
      position: relative;
    }
    .ov-steps-body > ol > li, .ov-steps-body > ul > li {
      position: relative;
      counter-increment: ov-step-counter;
      padding-left: 42px !important;
      margin-bottom: 18px !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-steps-body > ol > li:last-child, .ov-steps-body > ul > li:last-child {
      margin-bottom: 0 !important;
    }
    .ov-steps-body > ol > li::before, .ov-steps-body > ul > li::before {
      content: counter(ov-step-counter);
      position: absolute;
      left: 0;
      top: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .ov-steps-body > ol > li::after, .ov-steps-body > ul > li::after {
      content: '';
      position: absolute;
      left: 13px;
      top: 28px;
      bottom: -16px;
      width: 2px;
      background: #cbd5e1;
    }
    .ov-steps-body > ol > li:last-child::after, .ov-steps-body > ul > li:last-child::after {
      display: none;
    }

    .ov-timeline-body > ul, .ov-timeline-body > ol {
      list-style: none !important;
      padding-left: 0 !important;
      margin: 0 !important;
      position: relative;
    }
    .ov-timeline-body > ul > li, .ov-timeline-body > ol > li {
      position: relative;
      padding-left: 30px !important;
      margin-bottom: 18px !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-timeline-body > ul > li:last-child, .ov-timeline-body > ol > li:last-child {
      margin-bottom: 0 !important;
    }
    .ov-timeline-body > ul > li::before, .ov-timeline-body > ol > li::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 6px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #7c3aed;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 2px #7c3aed;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .ov-timeline-body > ul > li::after, .ov-timeline-body > ol > li::after {
      content: '';
      position: absolute;
      left: 6px;
      top: 16px;
      bottom: -16px;
      width: 2px;
      background: #cbd5e1;
    }
    .ov-timeline-body > ul > li:last-child::after, .ov-timeline-body > ol > li:last-child::after {
      display: none;
    }

    /* =========================================================
       Compare, Metrics, FAQ, Quotes, Banner
       ========================================================= */
    .ov-compare-container, .ov-metrics-container, .ov-faq-container, .ov-quotes-container, .ov-banner-container {
      margin: 20px 0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      padding: 18px 20px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-compare-header, .ov-metrics-header, .ov-faq-header, .ov-quotes-header, .ov-banner-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .ov-compare-body > ul, .ov-compare-body > ol {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      list-style: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .ov-compare-body > ul > li, .ov-compare-body > ol > li {
      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-compare-body > ul > li:first-child, .ov-compare-body > ol > li:first-child {
      border-top: 3px solid #e11d48;
    }
    .ov-compare-body > ul > li:nth-child(2), .ov-compare-body > ol > li:nth-child(2) {
      border-top: 3px solid #059669;
    }

    .ov-metrics-body > ul, .ov-metrics-body > ol {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      list-style: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .ov-metrics-body > ul > li, .ov-metrics-body > ol > li {
      padding: 14px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-metrics-body > ul > li strong, .ov-metrics-body > ol > li strong,
    .ov-metrics-body > ul > li b, .ov-metrics-body > ol > li b {
      display: block;
      font-size: 1.6rem;
      font-weight: 800;
      color: #059669;
      line-height: 1.2;
      margin-bottom: 4px;
    }

    .ov-faq-item {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      margin-bottom: 10px;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-faq-q {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 13.5px;
      color: #0f172a;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
    }
    .ov-faq-a {
      padding: 10px 14px;
      font-size: 13.5px;
      line-height: 1.6;
      color: #334155;
    }

    .ov-quotes-body > ul > li, .ov-quotes-body > ol > li {
      padding: 14px 16px;
      border-left: 4px solid #6366f1;
      background: #f8fafc;
      font-style: italic;
      margin-bottom: 10px;
      border-radius: 0 6px 6px 0;
    }
    .ov-banner-container {
      border: 1px solid #93c5fd;
      border-radius: 10px;
      background: #eff6ff;
    }

    /* =========================================================
       Prism Syntax Token Styling
       ========================================================= */
    .token.comment, .token.prolog, .token.doctype, .token.cdata { color: #64748b; font-style: italic; }
    .token.punctuation { color: #475569; }
    .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol { color: #ea580c; }
    .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin { color: #16a34a; }
    .token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string { color: #0284c7; }
    .token.atrule, .token.attr-value, .token.keyword { color: #2563eb; font-weight: 600; }
    .token.function, .token.class-name { color: #7c3aed; }
    .token.regex, .token.important, .token.variable { color: #e11d48; }

    /* OKF Header Card */
    #okf-header-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
      padding: 18px 22px;
      margin-bottom: 24px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    img, svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 16px auto;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 32px 0;
    }
    .markdown-diagram {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      background: #ffffff;
      display: flex;
      justify-content: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-katex-block {
      display: flex;
      justify-content: center;
      margin: 16px 0;
      overflow-x: auto;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-footnote-ref {
      font-size: 0.75em;
      vertical-align: super;
    }
    .ov-footnotes {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }
    .ov-footnotes-title {
      font-size: 1rem;
      margin: 0 0 0.75rem;
    }
    .ov-footnote-backref {
      text-decoration: none;
      margin-left: 0.25rem;
    }
    .ov-wiki-link {
      color: #0284c7;
      text-decoration: none;
      border-bottom: 1px dashed #7dd3fc;
    }
    .ov-wiki-embed {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin: 16px 0;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ov-wiki-embed-header {
      padding: 8px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-weight: 600;
    }
    .ov-wiki-embed-body {
      padding: 12px;
      font-size: 0.9em;
    }
    .ov-wiki-embed-preview {
      white-space: pre-wrap;
      margin: 0;
      font-family: inherit;
    }
    .ov-deflist {
      margin: 1rem 0;
    }
    .ov-deflist > dt {
      font-weight: 650;
      margin-top: 0.75rem;
    }
    .ov-deflist > dd {
      margin-left: 1.1rem;
      padding-left: 0.5rem;
      border-left: 2px solid #7dd3fc;
    }
    .page-break, .page-break-print-divider, .print-pagebreak {
      display: block !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    @media print {
      @page {
        size: A4;
        margin: 18mm 15mm;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        max-width: 100%;
        margin: 0;
        padding: 0;
      }
      details {
        display: block !important;
      }
      details > summary {
        pointer-events: none !important;
      }
      details > summary ~ * {
        display: block !important;
      }
      .markdown-diagram, .markdown-code-block, .ov-table-wrapper, .ov-table-block, table, img, blockquote,
      .ov-callout, .ov-card-grid-container, .ov-card-single, .ov-tab-group, .ov-steps-container,
      .ov-timeline-container, .ov-compare-container, .ov-metrics-container, .ov-faq-container,
      .ov-quotes-container, .ov-banner-container, #okf-header-card {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      h1, h2, h3, h4, h5, h6 {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
      .ov-table-sort-icon {
        display: none !important;
      }
      .ov-table-block-footer,
      .table-block-footer,
      .ov-col-resizer,
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>`;
}

/**
 * 导出为单文件高保真离线 HTML
 */
export function exportToPortableHtml(documentTitle: string, container: HTMLElement): void {
  const html = buildPortableHtml(documentTitle, container);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = documentTitle.replace(/\.(md|markdown|puml|svg)$/i, '');
  a.download = `${cleanName}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
