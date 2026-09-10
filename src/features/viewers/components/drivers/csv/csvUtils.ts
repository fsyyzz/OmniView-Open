/**
 * CSV / TSV 序列化、反序列化与多格式数据转换工具
 */

export type CsvDelimiter = ',' | '\t' | ';' | '|';

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  delimiter: CsvDelimiter;
}

/**
 * 自动探测 CSV / TSV 分隔符
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const counts: Record<CsvDelimiter, number> = {
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '|': (firstLine.match(/\|/g) || []).length,
  };

  let bestDelimiter: CsvDelimiter = ',';
  let maxCount = -1;

  for (const d of [',', '\t', ';', '|'] as CsvDelimiter[]) {
    if (counts[d] > maxCount && counts[d] > 0) {
      maxCount = counts[d];
      bestDelimiter = d;
    }
  }

  return bestDelimiter;
}

/**
 * 符合 RFC 4180 规范的 CSV 解析器（支持单元格换行、双引号转义与自定义分隔符）
 */
export function parseCsv(text: string, forceDelimiter?: CsvDelimiter): CsvParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { headers: ['Column 1'], rows: [], delimiter: forceDelimiter || ',' };
  }

  const delimiter = forceDelimiter || detectDelimiter(trimmed);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // 转义双引号 "" -> "
          currentCell += '"';
          i++;
        } else {
          // 引号闭合
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // 忽略 Windows 换行符 \r，等待 \n
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        if (currentRow.some(c => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentCell += char;
      }
    }
  }

  // 处理最后未换行的单元格
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: ['Column 1'], rows: [], delimiter };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // 统一每行的列数，不足补空字符串
  const maxCols = Math.max(headers.length, ...dataRows.map(r => r.length));
  while (headers.length < maxCols) {
    headers.push(`Column ${headers.length + 1}`);
  }

  const normalizedRows = dataRows.map(r => {
    const rowCopy = [...r];
    while (rowCopy.length < maxCols) {
      rowCopy.push('');
    }
    return rowCopy;
  });

  return { headers, rows: normalizedRows, delimiter };
}

/**
 * 将二维数据序列化为 RFC 4180 兼容的 CSV 字符串
 */
export function serializeCsv(headers: string[], rows: string[][], delimiter: CsvDelimiter = ','): string {
  const escapeCell = (val: string): string => {
    const str = val ?? '';
    const needsQuotes =
      str.includes(delimiter) ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r');

    if (needsQuotes) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(delimiter));

  for (const row of rows) {
    lines.push(row.map(escapeCell).join(delimiter));
  }

  return lines.join('\n');
}

/**
 * 转换为格式化的 JSON 字符串
 */
export function exportToJson(headers: string[], rows: string[][]): string {
  const objects = rows.map(row => {
    const obj: Record<string, string | number> = {};
    headers.forEach((h, idx) => {
      const val = row[idx] ?? '';
      const num = Number(val);
      if (val !== '' && !isNaN(num) && !val.startsWith('0') && isFinite(num)) {
        obj[h || `Col_${idx + 1}`] = num;
      } else {
        obj[h || `Col_${idx + 1}`] = val;
      }
    });
    return obj;
  });

  return JSON.stringify(objects, null, 2);
}

/**
 * 转换为 Markdown 表格格式
 */
export function exportToMarkdown(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  const clean = (s: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

  const headerLine = `| ${headers.map(h => clean(h) || ' ').join(' | ')} |`;
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map(r => `| ${headers.map((_, i) => clean(r[i] ?? '')).join(' | ')} |`);

  return [headerLine, separatorLine, ...rowLines].join('\n');
}
