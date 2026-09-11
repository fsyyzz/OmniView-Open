/**
 * OmniView A4 2.0 工业级出版与高精度打印引擎 (Page-Perfect Engine)
 * 支持页眉页脚宏替换、装订线内边距交替 (Gutter Margin)、孤行控制与跨页截断防护
 */

export interface A4PrintOptions {
  documentTitle?: string;
  author?: string;
  date?: string;
  filename?: string;
  pageSize?: 'A4' | 'A5' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  gutterMargin?: boolean; // 双面打印装订线奇偶交替
  marginMm?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    gutter: number;
  };
  preventPageBreakClasses?: string[];
  theme?: 'academic' | 'corporate' | 'minimal' | 'custom';
}

export const DEFAULT_A4_OPTIONS: Required<A4PrintOptions> = {
  documentTitle: 'OmniView Document',
  author: '',
  date: new Date().toLocaleDateString('zh-CN'),
  filename: 'document',
  pageSize: 'A4',
  orientation: 'portrait',
  headerLeft: '{documentTitle}',
  headerCenter: '',
  headerRight: '{date}',
  footerLeft: '{author}',
  footerCenter: '- {pageNumber} -',
  footerRight: 'Page {pageNumber} / {totalPages}',
  gutterMargin: false,
  marginMm: {
    top: 20,
    bottom: 20,
    left: 18,
    right: 18,
    gutter: 6,
  },
  preventPageBreakClasses: [
    'markdown-diagram',
    'markdown-code-block',
    'ov-table-wrapper',
    'ov-katex-block',
    'table',
    'blockquote',
    'img',
    'svg',
    'notebook-cell',
    'typst-page-svg',
  ],
  theme: 'academic',
};

/**
 * 宏变量替换函数
 * 将 {pageNumber}, {totalPages}, {documentTitle}, {author}, {date}, {filename} 等动态占位符精准解析
 */
export function evaluatePrintMacro(
  template: string,
  context: {
    pageNumber?: number | string;
    totalPages?: number | string;
    documentTitle?: string;
    author?: string;
    date?: string;
    filename?: string;
  }
): string {
  if (!template) return '';

  const {
    pageNumber = '1',
    totalPages = '1',
    documentTitle = '',
    author = '',
    date = '',
    filename = '',
  } = context;

  return template
    .replace(/\{pageNumber\}/gi, String(pageNumber))
    .replace(/\{page\}/gi, String(pageNumber))
    .replace(/\{totalPages\}/gi, String(totalPages))
    .replace(/\{pages\}/gi, String(totalPages))
    .replace(/\{documentTitle\}/gi, documentTitle)
    .replace(/\{title\}/gi, documentTitle)
    .replace(/\{author\}/gi, author)
    .replace(/\{date\}/gi, date)
    .replace(/\{filename\}/gi, filename);
}

/**
 * 生成高精度出版级打印 CSS 样式表 (包含 @page 规则、装订线与分页截断保护)
 */
export function generateA4PrintCss(options: Partial<A4PrintOptions> = {}): string {
  const merged: Required<A4PrintOptions> = { ...DEFAULT_A4_OPTIONS, ...options };
  const { top, bottom, left, right, gutter } = merged.marginMm;

  const leftMargin = merged.gutterMargin ? left + gutter : left;
  const rightMargin = right;

  return `
    @page {
      size: ${merged.pageSize} ${merged.orientation};
      margin: ${top}mm ${rightMargin}mm ${bottom}mm ${leftMargin}mm;
      marks: crop cross;
    }

    ${
      merged.gutterMargin
        ? `
    @page :left {
      margin-left: ${right}mm;
      margin-right: ${left + gutter}mm;
    }
    @page :right {
      margin-left: ${left + gutter}mm;
      margin-right: ${right}mm;
    }
    `
        : ''
    }

    @media print {
      html, body {
        width: 100%;
        background: #ffffff !important;
        color: #0f172a !important;
        font-size: 10.5pt;
        line-height: 1.6;
        orphans: 3;
        widows: 3;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* 隐藏屏幕专用交互元素与工具条 */
      .no-print,
      .diagram-tools,
      .markdown-toolbar,
      .code-block-header button,
      .doc-status-bar,
      .workbench-tabs,
      .workbench-sidebar {
        display: none !important;
      }

      /* 标题防孤行截断 */
      h1, h2, h3, h4, h5, h6 {
        break-after: avoid-page !important;
        page-break-after: avoid !important;
      }

      /* 块级结构防跨页切碎 */
      ${merged.preventPageBreakClasses.map((cls) => `.${cls}`).join(', ')} {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      /* 强制物理分页符生效 */
      .page-break,
      .print-pagebreak,
      hr.pagebreak {
        break-before: page !important;
        page-break-before: always !important;
        height: 0;
        margin: 0;
        border: none;
      }
    }
  `.trim();
}
