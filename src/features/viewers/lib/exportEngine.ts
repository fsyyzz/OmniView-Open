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
  const selectorsToRemove = [
    '.diagram-header',
    '.code-block-header',
    '.diagram-tools',
    '.markdown-toolbar',
    '.markdown-outline',
    '.doc-status-bar',
    '.table-block-toolbar',
    '.ov-table-block-toolbar',
    'button',
    '.ov-image-fallback',
  ];

  selectorsToRemove.forEach((sel) => {
    root.querySelectorAll(sel).forEach((el) => el.remove());
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
 * 导出为单文件高保真离线 HTML
 * 完整内联 KaTeX 公式、已渲染图表 SVG、代码高亮以及印刷打印样式
 */
export function exportToPortableHtml(documentTitle: string, container: HTMLElement): void {
  const clone = container.cloneNode(true) as HTMLElement;
  cleanInteractiveElements(clone);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle}</title>
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
    pre {
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
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 14px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 16px 0;
      padding: 8px 16px;
      background: #eff6ff;
      color: #1e40af;
      border-radius: 0 6px 6px 0;
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
    }
    .ov-katex-block {
      display: flex;
      justify-content: center;
      margin: 16px 0;
      overflow-x: auto;
    }
    @media print {
      @page {
        size: A4;
        margin: 18mm 15mm;
      }
      body {
        max-width: 100%;
        margin: 0;
        padding: 0;
      }
      .markdown-diagram, .markdown-code-block, .ov-table-wrapper, table, img, blockquote {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      h1, h2, h3 {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
    }
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = documentTitle.replace(/\.(md|markdown|puml|svg)$/i, '');
  a.download = `${cleanName}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
