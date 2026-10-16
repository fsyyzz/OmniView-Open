/**
 * Markdown 表格高级处理与转换工具集
 * 支持多格式导出 (CSV/Markdown)、智能多类型排序、单元格富文本渲染与数据图表化探测
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import { renderInlineMath } from '../../../lib/markdownMath';

/**
 * 尝试从单元格文本中提取数字标量（支持货币、千分位、百分比、存储与时间单位）
 */
export function parseNumericValue(text: string): number | null {
  if (!text) return null;

  // 去除 Markdown 格式标记与 HTML 标签
  const clean = text
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~[\]]/g, '')
    .trim();

  if (!clean) return null;

  // 1. 纯数字或带正负号浮点数
  if (/^[+-]?\d+(\.\d+)?$/.test(clean)) {
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }

  // 2. 带千分位逗号的数字 (例如: 1,234,567.89)
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
    const val = parseFloat(clean.replace(/,/g, ''));
    return isNaN(val) ? null : val;
  }

  // 3. 百分比 (例如: 85.5% / -12%)
  const percentMatch = clean.match(/^[+-]?\d+(\.\d+)?\s*%$/);
  if (percentMatch) {
    const val = parseFloat(clean.replace(/%/g, '').trim());
    return isNaN(val) ? null : val;
  }

  // 4. 常见货币符号前缀 (例如: $99.9, ¥1200, €45.5, £10)
  const currencyMatch = clean.match(/^[$¥€£₩]\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)$/);
  if (currencyMatch) {
    const val = parseFloat(currencyMatch[1].replace(/,/g, ''));
    return isNaN(val) ? null : val;
  }

  // 5. 存储与时间单位后缀 (例如: 128MB, 16 GB, 45ms, 2.5s, 100KB)
  const unitMatch = clean.match(/^([+-]?\d+(\.\d+)?)\s*(?:B|KB|MB|GB|TB|ms|s|min|h|px|em|pt)$/i);
  if (unitMatch) {
    const val = parseFloat(unitMatch[1]);
    return isNaN(val) ? null : val;
  }

  return null;
}

/**
 * 计算某一列的统计数据 (行数、总和、均值、极值)
 */
export function calculateColStats(matrix: string[][], colIdx: number): { count: number; sum: number; avg: number; min: number; max: number } {
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const row of matrix) {
    const val = row[colIdx];
    if (val !== undefined && val.trim().length > 0) {
      const num = parseNumericValue(val);
      if (num !== null) {
        count++;
        sum += num;
        if (num < min) min = num;
        if (num > max) max = num;
      }
    }
  }

  return {
    count,
    sum: Math.round(sum * 100) / 100,
    avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
  };
}

/**
 * 校验字符串是否为标准日期格式 (YYYY-MM-DD 或 YYYY/MM/DD)
 */
export function parseDateValue(text: string): number | null {
  if (!text) return null;
  const clean = text.replace(/[*_`~]/g, '').trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/.test(clean)) {
    const timestamp = Date.parse(clean);
    if (!isNaN(timestamp)) return timestamp;
  }
  return null;
}

/**
 * 智能列排序比较器
 * 优先按数字、日期或本地化字符串进行多态升降序比较
 */
export function compareCellValues(a: string, b: string, direction: 'asc' | 'desc'): number {
  const factor = direction === 'asc' ? 1 : -1;

  // 1. 优先尝试数值比较
  const numA = parseNumericValue(a);
  const numB = parseNumericValue(b);
  if (numA !== null && numB !== null) {
    return (numA - numB) * factor;
  }

  // 2. 尝试日期时间比较
  const dateA = parseDateValue(a);
  const dateB = parseDateValue(b);
  if (dateA !== null && dateB !== null) {
    return (dateA - dateB) * factor;
  }

  // 3. 兜底为本地化文本字典排序 (智能识别数字自然序，如 Item 2 < Item 10)
  const cleanA = (a || '').trim();
  const cleanB = (b || '').trim();
  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' }) * factor;
}

/**
 * 渲染富交互单元格内容 (含公式、复选框、状态徽标、链接与内联代码)
 */
export function formatRichCellContent(rawText: string, searchTerm?: string): string {
  if (!rawText) return '';

  let content = rawText;

  // 1. 解析 KaTeX 行内数学公式 $formula$
  content = content.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (match, formula) => {
    if (/^\d+(\.\d+)?$/.test(formula.trim())) return match;
    return renderInlineMath(formula);
  });

  // 2. 转换复选框 [x] / [ ] 为现代化 SVG 图标样式的 span
  content = content.replace(/\[([ xX])\]/g, (_match, mark) => {
    const isChecked = mark.toLowerCase() === 'x';
    return isChecked
      ? `<span class="ov-table-checkbox ov-table-checkbox-checked" title="Completed">✓</span>`
      : `<span class="ov-table-checkbox" title="Incomplete"></span>`;
  });

  // 3. 状态标签/徽标自动增强 (例如 [DONE], [SUCCESS], [FAIL], [WARN], [INFO] 或常见单词)
  content = content.replace(
    /\[(DONE|SUCCESS|PASS|COMPLETED|OK)\]/gi,
    '<span class="ov-badge ov-badge-success">$1</span>'
  );
  content = content.replace(
    /\[(PENDING|WARN|WARNING|WAITING|IN PROGRESS)\]/gi,
    '<span class="ov-badge ov-badge-warning">$1</span>'
  );
  content = content.replace(
    /\[(FAIL|FAILED|ERROR|REJECTED|BLOCKED)\]/gi,
    '<span class="ov-badge ov-badge-danger">$1</span>'
  );
  content = content.replace(
    /\[(INFO|NOTE|DRAFT|TODO|RUNNING)\]/gi,
    '<span class="ov-badge ov-badge-info">$1</span>'
  );

  // 4. 解析内联 Markdown (粗体、斜体、代码块、链接等)
  let html = marked.parseInline(content) as string;

  // 5. 若存在搜索关键词且非空，对纯文本做高亮处理
  if (searchTerm && searchTerm.trim().length > 0) {
    html = highlightMatches(html, searchTerm.trim());
  }

  // 6. DOMPurify 安全净化 (支持浏览器运行时与 Node.js 测试环境自愈兼容)
  const sanitizeOptions = {
    ADD_TAGS: ['span', 'code', 'a', 'strong', 'em', 'del', 'mark'],
    ADD_ATTR: ['class', 'style', 'href', 'title', 'target', 'rel'],
  };

  if (typeof DOMPurify?.sanitize === 'function') {
    return DOMPurify.sanitize(html, sanitizeOptions) as string;
  }
  const defaultPurify = (DOMPurify as any)?.default;
  if (typeof defaultPurify?.sanitize === 'function') {
    return defaultPurify.sanitize(html, sanitizeOptions) as string;
  }

  return html;
}

/**
 * 安全高亮 HTML 文本中的匹配关键词（避免破坏 HTML 标签与属性）
 */
export function highlightMatches(html: string, query: string): string {
  if (!query) return html;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  // 将 HTML 按标签分割：偶数位为文本内容，奇数位为 <tag>
  const parts = html.split(/(<[^>]+>)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) {
        return part; // 保护 HTML 标签
      }
      return part.replace(regex, '<mark class="ov-table-search-mark">$1</mark>');
    })
    .join('');
}

/**
 * 转换表格数据为符合 RFC 4180 标准的 CSV 文本
 */
export function tableToCsv(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: string) => {
    const str = cell || '';
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(row => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * 转换表格数据为 TSV (制表符分隔) 文本
 * 粘贴至 Excel / WPS / Google Sheets 时可直接自动映射为多行多列单元格
 */
export function tableToTsv(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: string) => {
    const str = (cell || '').replace(/\r?\n/g, ' ').trim();
    if (str.includes('\t') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join('\t');
  const rowLines = rows.map(row => row.map(escapeCell).join('\t'));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * 转换表格数据为带完整内联样式的语义化 HTML <table> 文本
 * 供 Word (Docx) / WPS / 邮件 / 笔记软件识别并直接粘贴为原生富文本表格
 */
export function tableToHtml(
  headers: string[],
  rows: string[][],
  aligns?: Array<'left' | 'center' | 'right' | null>
): string {
  const escapeHtml = (text: string) => {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const getAlignStyle = (idx: number) => {
    const align = aligns?.[idx];
    if (align === 'center') return 'text-align: center;';
    if (align === 'right') return 'text-align: right;';
    return 'text-align: left;';
  };

  const ths = headers
    .map(
      (h, i) =>
        `<th style="border: 1px solid #d1d5db; padding: 8px 12px; font-weight: 600; background-color: #f3f4f6; color: #111827; ${getAlignStyle(i)}">${escapeHtml(h)}</th>`
    )
    .join('');

  const trs = rows
    .map((row, rowIdx) => {
      const bg = rowIdx % 2 === 1 ? 'background-color: #f9fafb;' : 'background-color: #ffffff;';
      const tds = row
        .map(
          (cell, i) =>
            `<td style="border: 1px solid #d1d5db; padding: 8px 12px; color: #374151; ${getAlignStyle(i)}">${escapeHtml(cell)}</td>`
        )
        .join('');
      return `<tr style="${bg}">${tds}</tr>`;
    })
    .join('');

  return `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; width: 100%; border: 1px solid #d1d5db;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

/**
 * 复制表格为复合富文本剪贴板 (text/html + text/plain)
 * 在 Word (Docx) 中粘贴可成为原生带边框的 Word 表格，在 Excel 中粘贴可成为多单元格网格
 */
export async function copyTableToRichClipboard(
  headers: string[],
  rows: string[][],
  aligns?: Array<'left' | 'center' | 'right' | null>
): Promise<{ success: boolean; mode: 'rich' | 'tsv' | 'fallback' }> {
  const html = tableToHtml(headers, rows, aligns);
  const tsv = tableToTsv(headers, rows);

  // 1. 优先使用复合 MIME 写入剪贴板 (text/html + text/plain)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof (window as any).ClipboardItem !== 'undefined'
  ) {
    try {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([tsv], { type: 'text/plain' });
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      return { success: true, mode: 'rich' };
    } catch {
      // 降级
    }
  }

  // 2. 降级使用 TSV 纯文本 (支持直接粘贴到 Excel 单元格网格)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(tsv);
      return { success: true, mode: 'tsv' };
    } catch {}
  }

  return { success: false, mode: 'fallback' };
}

/**
 * 转换表格数据为规整对齐的 Markdown 表格源码
 */
export function tableToMarkdown(
  headers: string[],
  rows: string[][],
  aligns?: Array<'left' | 'center' | 'right' | null>
): string {
  const colWidths = headers.map((h, i) => {
    let max = (h || '').length;
    for (const r of rows) {
      const cellLen = (r[i] || '').length;
      if (cellLen > max) max = cellLen;
    }
    return Math.max(max, 3);
  });

  const pad = (text: string, width: number, align?: 'left' | 'center' | 'right' | null) => {
    const val = text || '';
    const diff = width - val.length;
    if (diff <= 0) return val;
    if (align === 'center') {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return ' '.repeat(left) + val + ' '.repeat(right);
    }
    if (align === 'right') {
      return ' '.repeat(diff) + val;
    }
    return val + ' '.repeat(diff);
  };

  const headerRow = `| ${headers.map((h, i) => pad(h, colWidths[i], aligns?.[i])).join(' | ')} |`;

  const separatorRow = `| ${colWidths
    .map((w, i) => {
      const align = aligns?.[i];
      if (align === 'center') return `:${'-'.repeat(Math.max(w - 2, 1))}:`;
      if (align === 'right') return `${'-'.repeat(Math.max(w - 1, 2))}:`;
      if (align === 'left') return `:${'-'.repeat(Math.max(w - 1, 2))}`;
      return '-'.repeat(w);
    })
    .join(' | ')} |`;

  const bodyRows = rows.map(
    row => `| ${row.map((c, i) => pad(c, colWidths[i], aligns?.[i])).join(' | ')} |`
  );

  return [headerRow, separatorRow, ...bodyRows].join('\n');
}

/**
 * 探测表格是否具备图表可视化潜能（存在维度标签列与至少一列数值）
 */
export function detectChartableColumns(
  headers: string[],
  rows: string[][]
): { labelColIndex: number; valueColIndices: number[] } | null {
  if (!headers || headers.length < 2 || !rows || rows.length === 0) {
    return null;
  }

  const numericCols: number[] = [];

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    let numericCount = 0;
    let validRowCount = 0;

    for (const row of rows) {
      const val = row[colIdx];
      if (val !== undefined && val.trim().length > 0) {
        validRowCount++;
        if (parseNumericValue(val) !== null) {
          numericCount++;
        }
      }
    }

    if (validRowCount > 0 && numericCount / validRowCount >= 0.6) {
      numericCols.push(colIdx);
    }
  }

  if (numericCols.length === 0) {
    return null;
  }

  // 首选第一个非纯数字列作为分类标签列，若全为数字列则默认第 0 列为标签
  let labelCol = 0;
  for (let i = 0; i < headers.length; i++) {
    if (!numericCols.includes(i)) {
      labelCol = i;
      break;
    }
  }

  // 过滤掉作为标签的列
  const valueCols = numericCols.filter(i => i !== labelCol);
  if (valueCols.length === 0) {
    return null;
  }

  return {
    labelColIndex: labelCol,
    valueColIndices: valueCols,
  };
}

/**
 * 提取指定列的纯文本数据 (换行符分隔)
 * 粘贴至 Excel / 终端 / 纯文本时，可直接作为单列逐行粘贴
 */
export function tableColumnToText(
  headers: string[],
  rows: string[][],
  colIdx: number,
  options?: { includeHeader?: boolean; separator?: string }
): string {
  const includeHeader = options?.includeHeader ?? false;
  const separator = options?.separator ?? '\r\n';
  const lines: string[] = [];

  if (includeHeader && headers[colIdx] !== undefined) {
    lines.push((headers[colIdx] || '').trim());
  }

  for (const row of rows) {
    const val = row[colIdx] !== undefined ? row[colIdx] : '';
    lines.push(val);
  }

  return lines.join(separator);
}

/**
 * 转换单列为专门适配邮件客户端 (Outlook, Gmail, Foxmail, QQ 邮箱等) 的原生富文本 HTML <table>
 * 带有内联边框、字体、背景颜色与行距，在邮件正文中粘贴时将呈现专业美观的单列表格
 */
export function tableColumnToEmailHtml(
  headers: string[],
  rows: string[][],
  colIdx: number,
  options?: {
    includeHeader?: boolean;
    align?: 'left' | 'center' | 'right' | null;
  }
): string {
  const includeHeader = options?.includeHeader ?? true;
  const colAlign = options?.align || 'left';
  const alignStyle =
    colAlign === 'right'
      ? 'text-align: right;'
      : colAlign === 'center'
      ? 'text-align: center;'
      : 'text-align: left;';

  const escapeHtml = (text: string) => {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const headerText = headers[colIdx] || `Column ${colIdx + 1}`;
  const headerHtml = includeHeader
    ? `<thead><tr><th style="border: 1px solid #cbd5e1; padding: 10px 16px; font-weight: 600; font-size: 13px; background-color: #f1f5f9; color: #0f172a; ${alignStyle} border-bottom: 2px solid #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${escapeHtml(headerText)}</th></tr></thead>`
    : '';

  const rowsHtml = rows
    .map((row, idx) => {
      const cellVal = row[colIdx] !== undefined ? row[colIdx] : '';
      const bg = idx % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';
      return `<tr style="${bg}"><td style="border: 1px solid #e2e8f0; padding: 8px 16px; font-size: 13px; color: #334155; ${alignStyle} font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${escapeHtml(cellVal)}</td></tr>`;
    })
    .join('');

  return `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-width: 180px; border: 1px solid #cbd5e1; line-height: 1.5; margin: 4px 0;">${headerHtml}<tbody>${rowsHtml}</tbody></table>`;
}

/**
 * 转换单列为标准 Markdown 单列表格
 */
export function tableColumnToMarkdown(
  headers: string[],
  rows: string[][],
  colIdx: number,
  align?: 'left' | 'center' | 'right' | null
): string {
  const header = (headers[colIdx] || `Column ${colIdx + 1}`).trim();
  const alignMarker =
    align === 'right' ? '---:' : align === 'center' ? ':---:' : ':---';
  const lines = [
    `| ${header} |`,
    `| ${alignMarker} |`,
  ];
  for (const row of rows) {
    const val = (row[colIdx] || '').replace(/\|/g, '\\|');
    lines.push(`| ${val} |`);
  }
  return lines.join('\n');
}

/**
 * 复制指定单列至系统剪贴板
 * 默认模式下同时写入富文本 HTML (邮件与 Word 呈现高质感表格) 与 TSV 纯文本 (Excel 自动按行粘贴)，
 * 确保在邮件客户端中粘贴呈现完美表格，在 Excel 中粘贴直接占满整列
 */
export async function copyColumnToClipboard(
  headers: string[],
  rows: string[][],
  colIdx: number,
  options?: {
    includeHeader?: boolean;
    align?: 'left' | 'center' | 'right' | null;
    format?: 'email-html' | 'plain-text' | 'markdown';
  }
): Promise<{ success: boolean; mode: 'rich' | 'plain' | 'fallback' }> {
  const format = options?.format ?? 'email-html';
  const includeHeader = options?.includeHeader ?? true;
  const colAlign = options?.align;

  if (format === 'markdown') {
    const md = tableColumnToMarkdown(headers, rows, colIdx, colAlign);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(md);
        return { success: true, mode: 'plain' };
      } catch {}
    }
  }

  const plainText = tableColumnToText(headers, rows, colIdx, { includeHeader });

  if (format === 'plain-text') {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(plainText);
        return { success: true, mode: 'plain' };
      } catch {}
    }
  }

  // 默认 email-html 复合写入 (text/html + text/plain)
  const html = tableColumnToEmailHtml(headers, rows, colIdx, {
    includeHeader,
    align: colAlign,
  });

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof (window as any).ClipboardItem !== 'undefined'
  ) {
    try {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      return { success: true, mode: 'rich' };
    } catch {
      // 降级
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(plainText);
      return { success: true, mode: 'plain' };
    } catch {}
  }

  return { success: false, mode: 'fallback' };
}

