/**
 * OmniView Typst 现代排版渲染与轻量 AST 编译器引擎
 * 支持 Typst 语法实时编译、函数/宏调用、网格 Grid、A4 出版级多页矢量排版、数学公式与大纲提取
 */
import katex from 'katex';
import DOMPurify from 'dompurify';
import { convertTypstMathToLatex } from './typstMathConverter';

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
    fontFamily?: string;
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
    fontFamily: '"Microsoft YaHei", "PingFang SC", "SimSun", "Linux Libertine", serif',
  };

  if (!source) return result;

  // 1. 匹配纸张尺寸 #set page(paper: "us-letter" / "a4" / "a5", width: 210mm, height: 297mm, columns: 2)
  const pageMatch = source.match(/#set\s+page\s*\(([\s\S]*?)\)/i);
  if (pageMatch) {
    const pageArgs = pageMatch[1];
    if (/paper\s*:\s*["']us-letter["']/i.test(pageArgs)) result.paperSize = 'us-letter';
    else if (/paper\s*:\s*["']a5["']/i.test(pageArgs)) result.paperSize = 'a5';
    else if (/paper\s*:\s*["']a4["']/i.test(pageArgs) || /210mm/i.test(pageArgs)) result.paperSize = 'a4';

    const colMatch = pageArgs.match(/columns\s*:\s*(\d+)/i);
    if (colMatch) {
      result.columns = Math.max(1, Math.min(3, parseInt(colMatch[1], 10)));
    }
  }

  // 2. 匹配字体声明 #set text(font: ("Microsoft YaHei", "SimHei"), ...)
  const textMatch = source.match(/#set\s+text\s*\(([\s\S]*?)\)/i);
  if (textMatch) {
    const fontMatch = textMatch[1].match(/font\s*:\s*(?:\(([^)]+)\)|["']([^"']+)["'])/i);
    if (fontMatch) {
      if (fontMatch[1]) {
        result.fontFamily = fontMatch[1].replace(/["']/g, '').trim() + ', serif';
      } else if (fontMatch[2]) {
        result.fontFamily = `"${fontMatch[2]}", serif`;
      }
    }
  }

  // 3. 匹配标题与作者（如 #set document(title: "...", author: "...") 或 author: ("Alice", "Bob")）
  const titleMatch = source.match(/title\s*:\s*["']([^"']+)["']/i);
  if (titleMatch) result.title = titleMatch[1];

  const authorArrayMatch = source.match(/author\s*:\s*\(([^)]+)\)/i);
  if (authorArrayMatch) {
    result.authors = authorArrayArrayMatchClean(authorArrayMatch[1]);
  } else {
    const singleAuthorMatch = source.match(/author\s*:\s*["']([^"']+)["']/i);
    if (singleAuthorMatch) {
      result.authors = [singleAuthorMatch[1].trim()];
    }
  }

  // 4. 匹配首个大标题 = Title
  if (!result.title) {
    const h1Match = source.match(/^=\s+([^\n]+)/m);
    if (h1Match) {
      result.title = h1Match[1].trim();
    }
  }

  return result;
}

function authorArrayArrayMatchClean(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.replace(/["'\s]/g, '').trim())
    .filter(Boolean);
}

/**
 * 转换行内 Typst 标记（加粗 *text*，斜体 _text_，行内代码 `code`，行内公式 $...$，#text(...)[]，强制换行等）
 */
export function formatTypstInline(text: string): string {
  if (!text) return '';

  let processed = text;

  // 0. 特殊语法转换：换行符反斜杠 \ 转为 <br />
  processed = processed.replace(/(?<!\\)\\\s*$/g, '<br />');
  processed = processed.replace(/(?<!\\)\\\s+/g, '<br />');

  // 1. #text(size: 18pt, weight: "bold")[内容]
  processed = processed.replace(
    /#text\s*\(([^)]*)\)\s*\[([\s\S]*?)\]/g,
    (_m, args, content) => {
      let styles = '';
      const sizeMatch = args.match(/size\s*:\s*([0-9.]+(?:pt|px|em))/i);
      if (sizeMatch) styles += `font-size:${sizeMatch[1]};`;
      const weightMatch = args.match(/weight\s*:\s*["']?([a-zA-Z0-9]+)["']?/i);
      if (weightMatch) {
        styles += `font-weight:${weightMatch[1] === 'bold' ? '700' : weightMatch[1]};`;
      }
      return `<span style="${styles}">${formatTypstInline(content)}</span>`;
    }
  );

  // 2. 提取行内公式 $ ... $ 进行安全转换
  processed = processed.replace(/(?<!\\)\$([^\s\$](?:[^\$\n]*?[^\s\$])?)(?<!\\)\$/g, (_m, rawFormula) => {
    try {
      const latex = convertTypstMathToLatex(rawFormula.trim());
      return katex.renderToString(latex, { displayMode: false, throwOnError: false });
    } catch {
      return safeSanitize(_m);
    }
  });

  // 3. 行内代码 `code`
  processed = processed.replace(/`([^`]+)`/g, '<code class="typst-inline-code" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.9em;color:#0f172a;">$1</code>');

  // 4. 粗体 *bold*
  processed = processed.replace(/(?<!\\)\*([^\*]+)(?<!\\)\*/g, '<strong>$1</strong>');

  // 5. 斜体 _italic_
  processed = processed.replace(/(?<!\\)_([^_]+)(?<!\\)_/g, '<em>$1</em>');

  // 6. 超链接 #link("url")[text]
  processed = processed.replace(/#link\s*\(\s*["']([^"']+)["']\s*\)\s*\[([^\]]+)\]/g, '<a href="$1" style="color:#0284c7;text-decoration:underline;" target="_blank">$2</a>');

  // 7. 处理残余闭包中括号 [text] -> text
  if (processed.startsWith('[') && processed.endsWith(']')) {
    processed = processed.slice(1, -1);
  }

  return processed;
}

/**
 * 解析 Typst #grid(...) 内容
 */
function parseTypstGrid(rawContent: string): { columns: string[]; cells: string[] } {
  const match = rawContent.match(/^#?grid\s*\(([\s\S]*)\)$/);
  if (!match) return { columns: ['1fr'], cells: [] };
  const inner = match[1];

  let depth = 0;
  let inBracket = 0;
  let current = '';
  const tokens: string[] = [];

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(' || ch === '{') depth++;
    else if (ch === ')' || ch === '}') depth--;
    else if (ch === '[') inBracket++;
    else if (ch === ']') inBracket--;

    if (ch === ',' && depth === 0 && inBracket === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  let columns = ['auto', '1fr', 'auto'];
  const cells: string[] = [];

  for (const token of tokens) {
    if (token.startsWith('columns:')) {
      const colStr = token.slice('columns:'.length).trim();
      const colMatch = colStr.match(/\(([^)]+)\)/);
      if (colMatch) {
        columns = colMatch[1].split(',').map((c) => {
          const t = c.trim();
          if (t === 'auto') return 'auto';
          if (t === '1fr') return '1fr';
          return t || '1fr';
        });
      }
    } else if (
      token.startsWith('gutter:') ||
      token.startsWith('stroke:') ||
      token.startsWith('row-gutter:') ||
      token.startsWith('column-gutter:')
    ) {
      // 样式配置，默认平滑流式自适应
    } else {
      let cellText = token;
      if (cellText.startsWith('[') && cellText.endsWith(']')) {
        cellText = cellText.slice(1, -1);
      }
      cells.push(cellText);
    }
  }

  return { columns, cells };
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
    type: 'heading' | 'paragraph' | 'math_block' | 'code' | 'pagebreak' | 'table' | 'grid' | 'quote' | 'list' | 'v_space' | 'line';
    content: string;
    level?: number;
    lineNumber: number;
    rawType?: string;
  }> = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inMathBlock = false;
  let mathBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // 跳过单行注释 // ...
    if (trimmed.startsWith('//')) {
      continue;
    }

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

    // 5. 过滤顶层声明与自定义宏定义 (#set ..., #show ..., #import ..., #let ...)
    if (trimmed.startsWith('#set ') || trimmed.startsWith('#show ') || trimmed.startsWith('#import ')) {
      continue;
    }

    // 捕获多行或单行 #let 定义
    if (trimmed.startsWith('#let ')) {
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        // 多行闭包，向后跳过直到遇见闭合花括号 '}'
        while (i < lines.length - 1 && !lines[i].includes('}')) {
          i++;
        }
      }
      continue;
    }

    // 6. 垂直间距 #v(...)
    const vMatch = trimmed.match(/^#?v\s*\(\s*([0-9.]+)(pt|mm|cm|em)?\s*\)/i);
    if (vMatch) {
      const val = parseFloat(vMatch[1]);
      const unit = vMatch[2] || 'pt';
      sections.push({
        type: 'v_space',
        content: `${val}${unit}`,
        lineNumber: lineNum,
      });
      continue;
    }

    // 7. 自定义区块标题调用 #sect-title("...") 或 #section("...")
    const sectTitleMatch = trimmed.match(/^#(?:sect-title|section|sec|title-block)\s*\(\s*["']([^"']+)["']\s*\)/i);
    if (sectTitleMatch) {
      const title = sectTitleMatch[1].trim();
      sections.push({
        type: 'heading',
        level: 2,
        content: title,
        lineNumber: lineNum,
      });
      continue;
    }

    // 8. 多行对齐容器 #align(...) [ ... ]
    if (trimmed.startsWith('#align(')) {
      let alignBlock = trimmed;
      if (alignBlock.includes('[') && !alignBlock.endsWith(']')) {
        while (i < lines.length - 1 && !alignBlock.endsWith(']')) {
          i++;
          alignBlock += '\n' + lines[i].trim();
        }
      }
      const innerMatch = alignBlock.match(/^#align\s*\(([^)]+)\)\s*\[([\s\S]*)\]$/);
      if (innerMatch) {
        const alignMode = innerMatch[1].trim(); // center / left / right
        const innerContent = innerMatch[2].trim();
        sections.push({
          type: 'paragraph',
          content: innerContent,
          lineNumber: lineNum,
          rawType: alignMode.includes('center') ? 'text-center' : alignMode.includes('right') ? 'text-right' : 'text-left',
        });
        continue;
      }
    }

    // 9. 多列网格布局 #grid(...)
    if (trimmed.startsWith('#grid(') || trimmed.startsWith('grid(')) {
      let gridBlock = trimmed;
      while (i < lines.length - 1 && !gridBlock.endsWith(')')) {
        i++;
        gridBlock += '\n' + lines[i].trim();
      }
      sections.push({
        type: 'grid',
        content: gridBlock,
        lineNumber: lineNum,
      });
      continue;
    }

    // 10. Typst #table(...)
    if (trimmed.startsWith('#table(') || trimmed.startsWith('table(')) {
      let tableBlock = trimmed;
      while (i < lines.length - 1 && !tableBlock.endsWith(')')) {
        i++;
        tableBlock += '\n' + lines[i].trim();
      }
      sections.push({
        type: 'table',
        content: tableBlock,
        lineNumber: lineNum,
      });
      continue;
    }

    // 11. 列表项 - list or + ordered
    if (/^[-+*•]\s+/.test(trimmed)) {
      sections.push({
        type: 'list',
        content: trimmed.replace(/^[-+*•]\s+/, ''),
        lineNumber: lineNum,
      });
      continue;
    }

    // 12. #rect / #block 容器
    if (trimmed.startsWith('#rect(') || trimmed.startsWith('#block(')) {
      const innerMatch = trimmed.match(/\[(.*)\]$/);
      if (innerMatch) {
        sections.push({
          type: 'paragraph',
          content: innerMatch[1],
          lineNumber: lineNum,
        });
        continue;
      }
    }

    // 13. 普通正文段落
    if (trimmed.length > 0) {
      sections.push({
        type: 'paragraph',
        content: trimmed,
        lineNumber: lineNum,
      });
    }
  }

  // 物理分页流编排：计算每个段落的高度并流式填入页面中
  const marginX = 50; // 边距
  const marginY = 48;
  const contentWidth = pageWidth - marginX * 2;
  const maxContentHeight = pageHeight - marginY * 2 - 25; // 预留底部页码区

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

    if (sec.type === 'v_space') {
      const ptVal = parseFloat(sec.content) || 4;
      const html = `<div style="height: ${ptVal}pt; line-height: 0;"></div>`;
      pushToCurrentPage(html, ptVal * 1.33);
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

      const fontSize = level === 1 ? '16pt' : level === 2 ? '12.5pt' : '11pt';
      const fontColor = '#0f172a';
      // 区分正文标题与简历区块标题（带下划线装饰）
      const dividerHtml = level === 2 ? '<div style="height: 0.5pt; background: #94a3b8; margin-top: 3pt; margin-bottom: 5pt; width: 100%;"></div>' : '';
      const headingHtml = `
        <div class="typst-heading typst-h${level}" style="font-size: ${fontSize}; font-weight: 700; color: ${fontColor}; margin-top: ${level === 1 ? '14pt' : '8pt'}; margin-bottom: 3pt;">
          ${safeSanitize(sec.content)}
        </div>
        ${dividerHtml}
      `;
      pushToCurrentPage(headingHtml, level === 1 ? 32 : 24);
    } else if (sec.type === 'grid') {
      const { columns, cells } = parseTypstGrid(sec.content);
      const gridTemplate = columns
        .map((c) => (c === 'auto' ? 'auto' : c === '1fr' ? '1fr' : c))
        .join(' ');

      const cellHtmls = cells.map((cellText, idx) => {
        const formatted = formatTypstInline(cellText);
        // 如果是三列布局，最后一列靠右对齐
        const isLastCol = columns.length > 1 && idx % columns.length === columns.length - 1;
        return `<div style="text-align: ${isLastCol ? 'right' : 'left'};">${formatted}</div>`;
      });

      const gridHtml = `
        <div class="typst-grid-layout" style="display: grid; grid-template-columns: ${gridTemplate}; gap: 4pt 10pt; font-size: 10pt; line-height: 1.5; color: #1e293b; margin: 3pt 0;">
          ${cellHtmls.join('\n')}
        </div>
      `;
      const estHeight = Math.ceil(cells.length / (columns.length || 1)) * 20 + 6;
      pushToCurrentPage(gridHtml, estHeight);
    } else if (sec.type === 'math_block') {
      let mathRendered = '';
      try {
        const latex = convertTypstMathToLatex(sec.content);
        mathRendered = katex.renderToString(latex, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        mathRendered = `<code style="color: #f43f5e;">${safeSanitize(sec.content)}</code>`;
      }
      const mathHtml = `<div class="typst-math-block" style="margin: 10pt 0; text-align: center;">${mathRendered}</div>`;
      pushToCurrentPage(mathHtml, 40);
    } else if (sec.type === 'code') {
      const codeHtml = `
        <pre class="typst-code-block" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6pt 8pt; font-family: 'Consolas', monospace; font-size: 9pt; color: #0f172a; margin: 6pt 0; white-space: pre-wrap; word-break: break-all;"><code>${safeSanitize(sec.content)}</code></pre>
      `;
      pushToCurrentPage(codeHtml, Math.max(30, sec.content.split('\n').length * 14 + 14));
    } else if (sec.type === 'list') {
      const formatted = formatTypstInline(sec.content);
      const listHtml = `
        <div class="typst-list-item" style="margin: 2pt 0 2pt 8pt; line-height: 1.6; font-size: 10pt; color: #1e293b; display: flex; align-items: baseline; gap: 6pt;">
          <span style="font-size: 8pt; color: #64748b; flex-shrink: 0;">•</span>
          <div style="flex: 1;">${formatted}</div>
        </div>
      `;
      pushToCurrentPage(listHtml, Math.max(18, Math.ceil(sec.content.length / 55) * 16));
    } else {
      // 普通段落，支持行内公式、文本样式与粗斜体
      const formatted = formatTypstInline(sec.content);
      const alignStyle = sec.rawType ? `text-align: ${sec.rawType.replace('text-', '')};` : 'text-align: justify;';
      const pHeight = Math.max(18, Math.ceil(sec.content.length / 65) * 16);
      const pHtml = `<div class="typst-p" style="margin: 0 0 5pt 0; font-size: 10.5pt; line-height: 1.6; color: #1e293b; ${alignStyle}">${formatted}</div>`;
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
        
        <!-- 动态页眉 (若有标题) -->
        ${
          headerTitle
            ? `<g class="typst-page-header" opacity="0.6">
                <text x="${marginX}" y="32" font-family="${metadata.fontFamily}" font-size="8pt" fill="#64748b">${headerTitle}</text>
                <line x1="${marginX}" y1="36" x2="${pageWidth - marginX}" y2="36" stroke="#e2e8f0" stroke-width="0.5" />
              </g>`
            : ''
        }

        <!-- 页面正文 HTML 嵌入容器 (foreignObject) -->
        <foreignObject x="${marginX}" y="${marginY}" width="${contentWidth}" height="${maxContentHeight}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: ${metadata.fontFamily}; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; background: transparent; color: #1e293b;">
            ${bodyContent}
          </div>
        </foreignObject>

        <!-- 动态页脚与页码宏 -->
        <g class="typst-page-footer">
          <line x1="${marginX}" y1="${pageHeight - 28}" x2="${pageWidth - marginX}" y2="${pageHeight - 28}" stroke="#e2e8f0" stroke-width="0.5" />
          <text x="${pageWidth / 2}" y="${pageHeight - 16}" font-family="${metadata.fontFamily}" font-size="8.5pt" fill="#64748b" text-anchor="middle">
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
