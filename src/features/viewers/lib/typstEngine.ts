/**
 * OmniView Typst 现代排版渲染与轻量 AST 编译器引擎
 * 支持 Typst 语法实时编译、A4 出版级多页矢量排版、数学公式与大纲提取
 */
import katex from 'katex';
import DOMPurify from 'dompurify';

export interface TypstOutlineItem {
  id: string;
  title: string;
  level: number;
  pageNumber: number;
  lineNumber: number;
}

export interface TypstPage {
  pageNumber: number;
  width: number;
  height: number;
  svgContent: string;
}

export interface TypstCompileResult {
  success: boolean;
  pages: TypstPage[];
  outline: TypstOutlineItem[];
  error?: string | null;
  warnings?: string[];
  totalPageCount: number;
  metadata: {
    title?: string;
    authors?: string[];
    date?: string;
    paperSize?: string;
    columns?: number;
  };
}

export interface TypstRenderOptions {
  isDarkTheme?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  paperSize?: 'a4' | 'us-letter' | 'a5';
  showPageNumbers?: boolean;
}

function safeSanitize(str: string): string {
  if (!str) return '';
  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(str);
  }
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const PAGE_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89, label: 'A4 (210 × 297 mm)' },
  'us-letter': { width: 612.0, height: 792.0, label: 'US Letter (8.5 × 11 in)' },
  a5: { width: 419.53, height: 595.28, label: 'A5 (148 × 210 mm)' },
};

/**
 * 解析 Typst 顶部声明元数据（#set page(...), #set text(...), #let ...）
 */
export function extractTypstMetadata(source: string): {
  title?: string;
  authors?: string[];
  date?: string;
  paperSize: 'a4' | 'us-letter' | 'a5';
  columns: number;
  fontFamily: string;
} {
  const result = {
    title: undefined as string | undefined,
    authors: [] as string[],
    date: undefined as string | undefined,
    paperSize: 'a4' as 'a4' | 'us-letter' | 'a5',
    columns: 1,
    fontFamily: '"Linux Libertine", "Times New Roman", "Source Han Serif", serif',
  };

  if (!source) return result;

  // 1. 匹配纸张尺寸 #set page(paper: "us-letter" / "a4" / "a5", columns: 2)
  const pageMatch = source.match(/#set\s+page\s*\(([^)]+)\)/i);
  if (pageMatch) {
    const pageArgs = pageMatch[1];
    if (/paper\s*:\s*["']us-letter["']/i.test(pageArgs)) result.paperSize = 'us-letter';
    if (/paper\s*:\s*["']a5["']/i.test(pageArgs)) result.paperSize = 'a5';
    if (/paper\s*:\s*["']a4["']/i.test(pageArgs)) result.paperSize = 'a4';

    const colMatch = pageArgs.match(/columns\s*:\s*(\d+)/i);
    if (colMatch) {
      result.columns = Math.max(1, Math.min(3, parseInt(colMatch[1], 10)));
    }
  }

  // 2. 匹配标题与作者（如 #set document(title: "...", author: "...") 或 author: ("Alice", "Bob")）
  const titleMatch = source.match(/title\s*:\s*["']([^"']+)["']/i);
  if (titleMatch) result.title = titleMatch[1];

  const authorArrayMatch = source.match(/author\s*:\s*\(([^)]+)\)/i);
  if (authorArrayMatch) {
    result.authors = authorArrayMatch[1]
      .split(',')
      .map((s) => s.replace(/["'\s]/g, '').trim())
      .filter(Boolean);
  } else {
    const singleAuthorMatch = source.match(/author\s*:\s*["']([^"']+)["']/i);
    if (singleAuthorMatch) {
      result.authors = [singleAuthorMatch[1].trim()];
    }
  }

  // 3. 匹配首个大标题 = Title
  if (!result.title) {
    const h1Match = source.match(/^=\s+([^\n]+)/m);
    if (h1Match) {
      result.title = h1Match[1].trim();
    }
  }

  return result;
}

/**
 * 编译与排版 Typst 源码为多页出版级矢量 SVG 页面
 */
export function compileTypstDocument(
  source: string,
  options: TypstRenderOptions = {}
): TypstCompileResult {
  const warnings: string[] = [];
  const outline: TypstOutlineItem[] = [];

  if (!source || !source.trim()) {
    return {
      success: true,
      pages: [],
      outline: [],
      totalPageCount: 0,
      metadata: { paperSize: 'a4', columns: 1 },
    };
  }

  const metadata = extractTypstMetadata(source);
  const paper = PAGE_DIMENSIONS[options.paperSize || metadata.paperSize] || PAGE_DIMENSIONS.a4;
  const pageWidth = paper.width;
  const pageHeight = paper.height;

  const lines = source.split('\n');
  const sections: Array<{
    type: 'heading' | 'paragraph' | 'math_block' | 'code' | 'pagebreak' | 'table' | 'quote' | 'list';
    content: string;
    level?: number;
    lineNumber: number;
  }> = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inMathBlock = false;
  let mathBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // 1. 代码块处理 ``` ... ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        sections.push({
          type: 'code',
          content: codeBuffer.join('\n'),
          lineNumber: lineNum,
        });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 2. 独立块级公式 $ ... $
    if (trimmed === '$' || (trimmed.startsWith('$ ') && trimmed.endsWith(' $') && trimmed.length > 3)) {
      if (trimmed === '$') {
        if (inMathBlock) {
          sections.push({
            type: 'math_block',
            content: mathBuffer.join('\n'),
            lineNumber: lineNum,
          });
          mathBuffer = [];
          inMathBlock = false;
        } else {
          inMathBlock = true;
        }
        continue;
      } else {
        sections.push({
          type: 'math_block',
          content: trimmed.slice(1, -1).trim(),
          lineNumber: lineNum,
        });
        continue;
      }
    }
    if (inMathBlock) {
      mathBuffer.push(line);
      continue;
    }

    // 3. 显式物理分页符 #pagebreak()
    if (/#pagebreak\s*\(\s*\)/i.test(trimmed)) {
      sections.push({ type: 'pagebreak', content: '', lineNumber: lineNum });
      continue;
    }

    // 4. 标题 = Heading 1, == Heading 2, === Heading 3
    const headingMatch = line.match(/^(=+)\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      sections.push({
        type: 'heading',
        level,
        content: title,
        lineNumber: lineNum,
      });
      continue;
    }

    // 5. 列表项 - list or + ordered
    if (/^[-+*]\s+/.test(trimmed)) {
      sections.push({
        type: 'list',
        content: trimmed.replace(/^[-+*]\s+/, ''),
        lineNumber: lineNum,
      });
      continue;
    }

    // 6. 普通段落
    if (trimmed.length > 0 && !trimmed.startsWith('#set') && !trimmed.startsWith('#show')) {
      sections.push({
        type: 'paragraph',
        content: trimmed,
        lineNumber: lineNum,
      });
    }
  }

  // 物理分页流编排：计算每个段落的高度并流式填入页面中
  const marginX = 54; // 0.75 in
  const marginY = 54; // 0.75 in
  const contentWidth = pageWidth - marginX * 2;
  const maxContentHeight = pageHeight - marginY * 2 - 30; // 预留底部页码区

  const pagesHtml: string[][] = [[]];
  let currentPageIndex = 0;
  let currentY = 0;

  const pushToCurrentPage = (html: string, approxHeight: number) => {
    if (currentY + approxHeight > maxContentHeight && pagesHtml[currentPageIndex].length > 0) {
      // 溢出换页
      currentPageIndex++;
      pagesHtml[currentPageIndex] = [];
      currentY = 0;
    }
    pagesHtml[currentPageIndex].push(html);
    currentY += approxHeight;
  };

  for (const sec of sections) {
    if (sec.type === 'pagebreak') {
      currentPageIndex++;
      pagesHtml[currentPageIndex] = [];
      currentY = 0;
      continue;
    }

    if (sec.type === 'heading') {
      const level = sec.level || 1;
      const pageNum = currentPageIndex + 1;
      outline.push({
        id: `typst_h_${sec.lineNumber}`,
        title: sec.content,
        level,
        pageNumber: pageNum,
        lineNumber: sec.lineNumber,
      });

      const fontSize = level === 1 ? '18pt' : level === 2 ? '14pt' : '12pt';
      const fontColor = '#0f172a';
      const headingHtml = `
        <div class="typst-heading typst-h${level}" style="font-size: ${fontSize}; font-weight: 700; color: ${fontColor}; margin-top: ${level === 1 ? '20pt' : '14pt'}; margin-bottom: 6pt; font-family: 'Times New Roman', serif;">
          ${safeSanitize(sec.content)}
        </div>
      `;
      pushToCurrentPage(headingHtml, level === 1 ? 42 : 30);
    } else if (sec.type === 'math_block') {
      let mathRendered = '';
      try {
        mathRendered = katex.renderToString(sec.content, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        mathRendered = `<code style="color: #f43f5e;">${safeSanitize(sec.content)}</code>`;
      }
      const mathHtml = `<div class="typst-math-block" style="margin: 12pt 0; text-align: center;">${mathRendered}</div>`;
      pushToCurrentPage(mathHtml, 45);
    } else if (sec.type === 'code') {
      const codeHtml = `
        <pre class="typst-code-block" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8pt 10pt; font-family: 'Consolas', monospace; font-size: 9.5pt; color: #0f172a; margin: 8pt 0; white-space: pre-wrap; word-break: break-all;"><code>${safeSanitize(sec.content)}</code></pre>
      `;
      pushToCurrentPage(codeHtml, Math.max(35, sec.content.split('\n').length * 15 + 16));
    } else if (sec.type === 'list') {
      const listHtml = `
        <div class="typst-list-item" style="margin: 3pt 0 3pt 14pt; line-height: 1.6; font-size: 10.5pt; color: #1e293b; display: flex; align-items: baseline; gap: 6pt;">
          <span style="font-size: 8pt; color: #64748b;">•</span>
          <span>${safeSanitize(sec.content)}</span>
        </div>
      `;
      pushToCurrentPage(listHtml, 22);
    } else {
      // 普通段落，支持行内公式 $...$
      let sanitized = safeSanitize(sec.content);
      sanitized = sanitized.replace(/(?<!\\)\$([^\s\$](?:[^\$\n]*?[^\s\$])?)(?<!\\)\$/g, (_m, f) => {
        try {
          return katex.renderToString(f.trim(), { displayMode: false, throwOnError: false });
        } catch {
          return _m;
        }
      });

      const pHeight = Math.max(22, Math.ceil(sec.content.length / 75) * 18);
      const pHtml = `<p class="typst-p" style="margin: 0 0 7pt 0; font-size: 10.5pt; line-height: 1.65; color: #1e293b; text-align: justify; font-family: 'Linux Libertine', 'Times New Roman', serif;">${sanitized}</p>`;
      pushToCurrentPage(pHtml, pHeight);
    }
  }

  // 构建各页出版级矢量 SVG 容器
  const totalPageCount = Math.max(1, pagesHtml.length);
  const pages: TypstPage[] = [];

  for (let idx = 0; idx < totalPageCount; idx++) {
    const pageNum = idx + 1;
    const bodyContent = (pagesHtml[idx] || []).join('\n');
    const headerTitle = metadata.title ? safeSanitize(metadata.title) : '';

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" width="100%" height="100%" class="typst-page-svg">
        <defs>
          <style>
            @import url('https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css');
            .typst-page-rect { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1; }
          </style>
        </defs>
        <!-- 页面白底与纸张阴影衬底 -->
        <rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" class="typst-page-rect" rx="2" />
        
        <!-- 动态页眉 -->
        <g class="typst-page-header" opacity="0.6">
          <text x="${marginX}" y="36" font-family="'Times New Roman', serif" font-size="8.5pt" fill="#64748b">${headerTitle}</text>
          <line x1="${marginX}" y1="42" x2="${pageWidth - marginX}" y2="42" stroke="#e2e8f0" stroke-width="0.5" />
        </g>

        <!-- 页面正文 HTML 嵌入容器 (foreignObject) -->
        <foreignObject x="${marginX}" y="${marginY}" width="${contentWidth}" height="${maxContentHeight}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Linux Libertine', 'Times New Roman', serif; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; background: transparent; color: #1e293b;">
            ${bodyContent}
          </div>
        </foreignObject>

        <!-- 动态页脚与页码宏 -->
        <g class="typst-page-footer">
          <line x1="${marginX}" y1="${pageHeight - 36}" x2="${pageWidth - marginX}" y2="${pageHeight - 36}" stroke="#e2e8f0" stroke-width="0.5" />
          <text x="${pageWidth / 2}" y="${pageHeight - 20}" font-family="'Times New Roman', serif" font-size="9pt" fill="#64748b" text-anchor="middle">
            - ${pageNum} -
          </text>
        </g>
      </svg>
    `.trim();

    pages.push({
      pageNumber: pageNum,
      width: pageWidth,
      height: pageHeight,
      svgContent: svgString,
    });
  }

  return {
    success: true,
    pages,
    outline,
    totalPageCount,
    warnings,
    metadata: {
      ...metadata,
      paperSize: options.paperSize || metadata.paperSize,
    },
  };
}
