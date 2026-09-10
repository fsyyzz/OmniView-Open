/**
 * Markdown 表格高级处理与转换工具集
 * 支持多格式导出 (CSV/Markdown)、智能多类型排序、单元格富文本渲染与数据图表化探测
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';

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
  content = content.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (_match, formula) => {
    if (/^\d+(\.\d+)?$/.test(formula.trim())) return _match;
    try {
      return `<span class="ov-katex-inline">${katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        errorColor: '#f43f5e',
      })}</span>`;
    } catch {
      return _match;
    }
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
