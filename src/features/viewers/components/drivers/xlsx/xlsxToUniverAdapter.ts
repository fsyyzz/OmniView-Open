/**
 * OmniView -> Univer 数据模型桥接与可编辑公式计算适配器
 * 将已有的 OOXML 解析结果 (ParsedXlsxWorkbook) 转换为 Univer 专有 IWorkbookData 结构
 * 同时提供单元格就地编辑、区域公式实时重算 (SUM/AVERAGE/MIN/MAX/COUNT 与四则运算) 能力
 * 保持 100% 离线、纯前端转换，零网络与企业版商业授权依赖
 */
import type { ParsedXlsxWorkbook, XlsxWorksheet, XlsxCell } from '../../../lib/xlsxEngine';
import { colLetterToIndex, indexToColLetter, parseCellRef } from '../../../lib/xlsxEngine';

export enum CellValueType {
  STRING = 1,
  NUMBER = 2,
  BOOLEAN = 3,
  FORCE_STRING = 4,
}

export enum LocaleType {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US',
  RU_RU = 'ru-RU',
  VI_VN = 'vi-VN',
  ZH_TW = 'zh-TW',
}

export interface IRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface ICellData {
  v?: string | number | boolean;
  t?: CellValueType;
  f?: string;
  s?: string | Record<string, any>;
  p?: any;
}

export interface IWorksheetData {
  id: string;
  name: string;
  tabColor?: string;
  hidden?: number;
  rowCount?: number;
  columnCount?: number;
  zoomRatio?: number;
  scrollTop?: number;
  scrollLeft?: number;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  cellData: Record<number, Record<number, ICellData>>;
  rowData?: Record<number, any>;
  columnData?: Record<number, any>;
  showGridlines?: number;
  mergeData?: IRange[];
  rowHeader?: { width: number; hidden: number };
  columnHeader?: { height: number; hidden: number };
  rightToLeft?: number;
}

export interface IWorkbookData {
  id: string;
  sheetOrder: string[];
  name: string;
  appVersion?: string;
  locale?: LocaleType;
  styles?: Record<string, any>;
  sheets: Record<string, Partial<IWorksheetData>>;
  resources?: any[];
}

/**
 * 解析如 "A1:C3" 的合并单元格字符串为 Univer IRange 对象
 */
function parseMergeRange(rangeStr: string): IRange | null {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return null;

  const parseCoord = (coord: string) => {
    const match = coord.trim().match(/^([A-Za-z]+)(\d+)$/);
    if (!match) return null;
    return {
      col: colLetterToIndex(match[1]),
      row: parseInt(match[2], 10) - 1,
    };
  };

  const start = parseCoord(parts[0]);
  const end = parseCoord(parts[1]);
  if (!start || !end) return null;

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.col, end.col),
    endColumn: Math.max(start.col, end.col),
  };
}

/**
 * 展开如 "C2:F2" 的区域引用为单元格坐标列表
 */
function expandCellRange(rangeStr: string): { row: number; col: number }[] {
  const parsed = parseMergeRange(rangeStr);
  if (!parsed) return [];
  const coords: { row: number; col: number }[] = [];
  for (let r = parsed.startRow; r <= parsed.endRow; r++) {
    for (let c = parsed.startColumn; c <= parsed.endColumn; c++) {
      coords.push({ row: r, col: c });
    }
  }
  return coords;
}

/**
 * 安全计算纯四则运算表达式 (仅允许数字、+ - * / ( ) 小数点与空白)
 */
function safeEvaluateMathExpression(expr: string): number | null {
  const sanitized = expr.replace(/\s+/g, '');
  if (!sanitized || !/^[0-9+\-*/().]+$/.test(sanitized)) {
    return null;
  }

  let pos = 0;

  function parseExpression(): number {
    let val = parseTerm();
    while (pos < sanitized.length && (sanitized[pos] === '+' || sanitized[pos] === '-')) {
      const op = sanitized[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (pos < sanitized.length && (sanitized[pos] === '*' || sanitized[pos] === '/')) {
      const op = sanitized[pos++];
      const right = parseFactor();
      if (op === '/') {
        val = right === 0 ? NaN : val / right;
      } else {
        val = val * right;
      }
    }
    return val;
  }

  function parseFactor(): number {
    if (sanitized[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (sanitized[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (sanitized[pos] === '(') {
      pos++;
      const val = parseExpression();
      if (sanitized[pos] === ')') pos++;
      return val;
    }
    const start = pos;
    while (pos < sanitized.length && /[0-9.]/.test(sanitized[pos])) {
      pos++;
    }
    if (start === pos) return NaN;
    return Number(sanitized.slice(start, pos));
  }

  const result = parseExpression();
  if (pos !== sanitized.length || Number.isNaN(result) || !Number.isFinite(result)) {
    return null;
  }
  return Number(Math.round(Number(result + 'e10')) + 'e-10');
}

/**
 * 计算 Univer 工作表中的公式字符串 (支持 SUM/AVERAGE/AVG/MAX/MIN/COUNT/COUNTA 及单元格四则运算)
 */
export function evaluateUniverFormula(
  rawFormula: string,
  getCellText: (row: number, col: number) => string
): string {
  const expr = rawFormula.trim().replace(/^=/, '').trim();
  if (!expr) return '';

  const collectArgValues = (argsStr: string): { numericValues: number[]; nonEmptyCount: number } => {
    const numericValues: number[] = [];
    let nonEmptyCount = 0;
    const parts = argsStr.split(',').map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes(':')) {
        const coords = expandCellRange(part);
        for (const { row, col } of coords) {
          const raw = getCellText(row, col).trim();
          if (raw !== '') {
            nonEmptyCount++;
            const num = Number(raw.replace(/,/g, ''));
            if (!Number.isNaN(num)) {
              numericValues.push(num);
            }
          }
        }
      } else if (/^[A-Za-z]+\d+$/.test(part)) {
        const { row, col } = parseCellRef(part);
        const raw = getCellText(row, col).trim();
        if (raw !== '') {
          nonEmptyCount++;
          const num = Number(raw.replace(/,/g, ''));
          if (!Number.isNaN(num)) {
            numericValues.push(num);
          }
        }
      } else {
        const num = Number(part);
        if (!Number.isNaN(num)) {
          nonEmptyCount++;
          numericValues.push(num);
        }
      }
    }
    return { numericValues, nonEmptyCount };
  };

  // 处理聚合函数被嵌套或独立调用，例如 SUM(C2:F2), AVERAGE(A1:A5) 等
  const evaluatedFunctions = expr.replace(
    /\b(SUM|AVERAGE|AVG|MAX|MIN|COUNT|COUNTA)\s*\(([^()]*)\)/gi,
    (_, fnName: string, argsStr: string) => {
      const fn = fnName.toUpperCase();
      const { numericValues, nonEmptyCount } = collectArgValues(argsStr);
      if (fn === 'SUM') {
        return String(numericValues.reduce((acc, v) => acc + v, 0));
      }
      if (fn === 'AVERAGE' || fn === 'AVG') {
        if (numericValues.length === 0) return '0';
        const sum = numericValues.reduce((acc, v) => acc + v, 0);
        return String(Number((sum / numericValues.length).toFixed(6)));
      }
      if (fn === 'MAX') {
        return numericValues.length > 0 ? String(Math.max(...numericValues)) : '0';
      }
      if (fn === 'MIN') {
        return numericValues.length > 0 ? String(Math.min(...numericValues)) : '0';
      }
      if (fn === 'COUNT') {
        return String(numericValues.length);
      }
      if (fn === 'COUNTA') {
        return String(nonEmptyCount);
      }
      return '0';
    }
  );

  // 替换单个单元格引用，如 C2, D2, AA10
  const withRefsReplaced = evaluatedFunctions.replace(/\b([A-Za-z]+)(\d+)\b/g, (full, colStr: string, rowStr: string) => {
    const col = colLetterToIndex(colStr);
    const row = parseInt(rowStr, 10) - 1;
    const raw = getCellText(row, col).trim().replace(/,/g, '');
    if (raw === '') return '0';
    const num = Number(raw);
    return Number.isNaN(num) ? full : String(num);
  });

  const mathResult = safeEvaluateMathExpression(withRefsReplaced);
  if (mathResult !== null) {
    return String(mathResult);
  }

  return withRefsReplaced;
}

/**
 * 在工作表中就地编辑指定单元格，并自动重算工作表内所有依赖公式单元格
 */
export function updateWorksheetCell(
  sheet: XlsxWorksheet,
  row: number,
  col: number,
  rawInput: string
): XlsxWorksheet {
  const newRowCount = Math.max(sheet.rowCount || 0, sheet.rows?.length || 0, row + 1);
  const newColCount = Math.max(sheet.colCount || 0, sheet.headers?.length || 0, col + 1);

  // 克隆二维 rows 矩阵并补齐行列
  const nextRows: string[][] = Array.from({ length: newRowCount }, (_, rIdx) => {
    const existingRow = sheet.rows?.[rIdx] || [];
    return Array.from({ length: newColCount }, (__, cIdx) => existingRow[cIdx] ?? '');
  });

  // 克隆 cells 字典并规范化为以坐标 ref 为键
  const nextCells: Record<string, XlsxCell> = {};
  if (sheet.cells) {
    for (const cell of Object.values(sheet.cells)) {
      if (cell) {
        const cellRef = cell.ref || `${indexToColLetter(cell.col)}${cell.row + 1}`;
        nextCells[cellRef] = { ...cell, ref: cellRef };
      }
    }
  }

  const targetRef = `${indexToColLetter(col)}${row + 1}`;
  const trimmed = rawInput.trim();

  if (trimmed === '') {
    delete nextCells[targetRef];
    nextRows[row][col] = '';
  } else if (trimmed.startsWith('=') && trimmed.length > 1) {
    const formulaBody = trimmed.slice(1).trim();
    nextCells[targetRef] = {
      ref: targetRef,
      row,
      col,
      formula: formulaBody,
      value: '',
      type: 'formula',
    };
  } else {
    const isNum = !Number.isNaN(Number(trimmed)) && trimmed !== '';
    const isBool = trimmed.toUpperCase() === 'TRUE' || trimmed.toUpperCase() === 'FALSE';
    nextCells[targetRef] = {
      ref: targetRef,
      row,
      col,
      value: rawInput,
      formula: undefined,
      type: isNum ? 'number' : isBool ? 'boolean' : 'string',
    };
    nextRows[row][col] = rawInput;
  }

  // 递归获取单元格当前计算值（含防循环引用保护）
  const resolveCellDisplayValue = (r: number, c: number, visited = new Set<string>()): string => {
    const ref = `${indexToColLetter(c)}${r + 1}`;
    if (visited.has(ref)) return '#CYCLE!';
    const cell = nextCells[ref];
    if (cell && cell.formula) {
      visited.add(ref);
      return evaluateUniverFormula(cell.formula, (depR, depC) => resolveCellDisplayValue(depR, depC, new Set(visited)));
    }
    if (cell && cell.value !== undefined) {
      return String(cell.value);
    }
    return nextRows[r]?.[c] ?? '';
  };

  // 重算所有含公式的单元格并同步回 nextRows
  for (const [ref, cell] of Object.entries(nextCells)) {
    if (cell.formula) {
      const computed = resolveCellDisplayValue(cell.row, cell.col);
      nextCells[ref] = {
        ...cell,
        value: computed,
      };
      if (nextRows[cell.row] && cell.col < newColCount) {
        nextRows[cell.row][cell.col] = computed;
      }
    } else if (nextRows[cell.row] && cell.col < newColCount) {
      nextRows[cell.row][cell.col] = String(cell.value ?? '');
    }
  }

  // 更新表头
  const nextHeaders =
    nextRows.length > 0 && nextRows[0].some(val => val.trim() !== '')
      ? nextRows[0].map((val, idx) => (val.trim() !== '' ? val : indexToColLetter(idx)))
      : Array.from({ length: newColCount }, (_, idx) => indexToColLetter(idx));

  return {
    ...sheet,
    rowCount: newRowCount,
    colCount: newColCount,
    headers: nextHeaders,
    rows: nextRows,
    cells: nextCells,
  };
}

/**
 * 对整个 ParsedXlsxWorkbook 的指定工作表单元格应用编辑并返回新工作簿
 */
export function applyWorkbookCellEdit(
  workbook: ParsedXlsxWorkbook,
  sheetIndex: number,
  row: number,
  col: number,
  rawInput: string
): ParsedXlsxWorkbook {
  const sheets = workbook.sheets.map((sheet, idx) =>
    idx === sheetIndex ? updateWorksheetCell(sheet, row, col, rawInput) : sheet
  );
  return {
    ...workbook,
    sheets,
  };
}

export interface ColumnFilterRule {
  keyword?: string;
  selectedValues?: string[] | null;
}

export const EMPTY_FILTER_TOKEN = '(空白)';

/**
 * 读取工作表指定单元格的展示文本
 */
export function getSheetCellDisplayText(sheet: XlsxWorksheet, row: number, col: number): string {
  const ref = `${indexToColLetter(col)}${row + 1}`;
  if (sheet.cells?.[ref] && sheet.cells[ref].value !== undefined) {
    return String(sheet.cells[ref].value ?? '');
  }
  if (sheet.rows?.[row]?.[col] !== undefined) {
    return String(sheet.rows[row][col] ?? '');
  }
  return '';
}

/**
 * 提取工作表指定列的去重候选值列表（供列头过滤下拉菜单勾选使用）
 * 默认跳过第 0 行（表头行），仅提取有数据的非空数据行中的此列值
 */
export function getColumnDistinctValues(
  sheet: XlsxWorksheet,
  colIdx: number,
  skipHeaderRow = true
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  const startRow = skipHeaderRow ? 1 : 0;
  const maxRow = sheet.rows?.length || 0;

  for (let r = startRow; r < maxRow; r++) {
    const rowData = sheet.rows?.[r];
    const isRowNonEmpty = rowData && rowData.some(c => String(c ?? '').trim() !== '');
    if (!isRowNonEmpty) continue;

    const raw = getSheetCellDisplayText(sheet, r, colIdx).trim();
    const token = raw === '' ? EMPTY_FILTER_TOKEN : raw;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
}

/**
 * 根据列头过滤规则与列排序规则，计算当前应当展示的工作表行索引数组 (0-based)
 * 第 0 行（表头行）始终固定在首行，后续数据行支持多列组合过滤与升降序排列
 */
export function filterAndSortWorksheetRows(options: {
  sheet: XlsxWorksheet;
  totalRows: number;
  columnFilters?: Record<number, ColumnFilterRule>;
  sortCol?: number | null;
  sortAsc?: boolean;
}): number[] {
  const { sheet, totalRows, columnFilters = {}, sortCol = null, sortAsc = true } = options;
  const maxRows = Math.min(Math.max(totalRows, 1), 200);
  const allIndices = Array.from({ length: maxRows }, (_, idx) => idx);
  if (maxRows <= 1) return allIndices;

  const activeFilterEntries = Object.entries(columnFilters)
    .map(([colStr, rule]) => ({ colIdx: Number(colStr), rule }))
    .filter(({ rule }) => {
      if (!rule) return false;
      const hasKeyword = Boolean(rule.keyword && rule.keyword.trim() !== '');
      const hasSubset = Array.isArray(rule.selectedValues);
      return hasKeyword || hasSubset;
    });

  const hasAnyActiveFilter = activeFilterEntries.length > 0;
  const headerRow = 0;
  const bodyIndices = allIndices.slice(1);

  const nonEmptyBody: number[] = [];
  const emptyBody: number[] = [];

  for (const rIdx of bodyIndices) {
    const rowData = sheet.rows?.[rIdx];
    const hasDataInCells =
      (rowData && rowData.some(c => String(c ?? '').trim() !== '')) ||
      Object.values(sheet.cells || {}).some(cell => cell.row === rIdx && String(cell.value ?? '').trim() !== '');

    if (!hasDataInCells) {
      emptyBody.push(rIdx);
      continue;
    }

    // 检查是否通过所有激活的列头过滤条件
    let matched = true;
    for (const { colIdx, rule } of activeFilterEntries) {
      const cellText = getSheetCellDisplayText(sheet, rIdx, colIdx);
      const token = cellText.trim() === '' ? EMPTY_FILTER_TOKEN : cellText.trim();

      if (rule.keyword && rule.keyword.trim() !== '') {
        if (!cellText.toLowerCase().includes(rule.keyword.trim().toLowerCase())) {
          matched = false;
          break;
        }
      }
      if (Array.isArray(rule.selectedValues)) {
        if (!rule.selectedValues.includes(token)) {
          matched = false;
          break;
        }
      }
    }

    if (matched) {
      nonEmptyBody.push(rIdx);
    }
  }

  if (sortCol !== null && sortCol >= 0) {
    nonEmptyBody.sort((rA, rB) => {
      const valA = getSheetCellDisplayText(sheet, rA, sortCol);
      const valB = getSheetCellDisplayText(sheet, rB, sortCol);
      const numA = Number(valA);
      const numB = Number(valB);
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && valA !== '' && valB !== '') {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true });
    });
  }

  // 当存在激活的列头过滤时，仅展示表头行 + 命中过滤的数据行（末尾预留 3 行空白供快速追加输入）
  if (hasAnyActiveFilter) {
    return [headerRow, ...nonEmptyBody, ...emptyBody.slice(0, 3)];
  }

  return [headerRow, ...nonEmptyBody, ...emptyBody];
}

/**
 * 计算冻结列在 sticky 定位下的左侧偏移量 (px)
 * 行号列固定宽度为 rowHeaderWidth (默认 48px)，每列宽度为 colWidth (默认 128px)
 */
export function calculateFrozenColumnLeftOffset(
  colIdx: number,
  frozenColCount: number,
  rowHeaderWidth = 48,
  colWidth = 128
): number | null {
  if (frozenColCount <= 0 || colIdx < 0 || colIdx >= frozenColCount) {
    return null;
  }
  return rowHeaderWidth + colIdx * colWidth;
}

export function convertOmniWorkbookToUniver(
  workbook: ParsedXlsxWorkbook,
  workbookName = 'OmniView Spreadsheet',
  unitId = `omniview_sheet_${Date.now()}`,
  isDarkTheme = false
): IWorkbookData {
  const sheetOrder: string[] = [];
  const sheets: Record<string, Partial<IWorksheetData>> = {};
  const defaultDarkStyleId = 'ov-dark-cell';

  const sourceSheets = workbook.sheets && workbook.sheets.length > 0 ? workbook.sheets : [
    {
      id: 'sheet_1',
      name: 'Sheet1',
      sheetId: 1,
      rowCount: 100,
      colCount: 26,
      headers: [],
      rows: [],
      cells: {},
    },
  ];

  sourceSheets.forEach((sheet, index) => {
    const sheetId = `sheet_${index + 1}_${sheet.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    sheetOrder.push(sheetId);

    const cellData: Record<number, Record<number, ICellData>> = {};
    const maxCols = Math.max(sheet.colCount || 0, 26);
    const maxRows = Math.max(sheet.rowCount || 0, 100);

    // 1. 如果存在 cells 映射，使用带类型与公式的丰富单元格信息
    if (sheet.cells && Object.keys(sheet.cells).length > 0) {
      Object.values(sheet.cells).forEach(cell => {
        if (!cell || cell.value === undefined || cell.value === null || cell.value === '') {
          return;
        }

        const rIdx = cell.row;
        const cIdx = cell.col;

        if (!cellData[rIdx]) {
          cellData[rIdx] = {};
        }

        let t: CellValueType = CellValueType.STRING;
        let v: string | number | boolean = cell.value;

        if (cell.type === 'number') {
          const num = Number(cell.value);
          if (!Number.isNaN(num)) {
            t = CellValueType.NUMBER;
            v = num;
          }
        } else if (cell.type === 'boolean') {
          t = CellValueType.BOOLEAN;
          v = cell.value.toLowerCase() === 'true' || cell.value === '1';
        }

        let f: string | undefined = undefined;
        if (cell.formula) {
          f = cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`;
        }

        cellData[rIdx][cIdx] = {
          v,
          t,
          f,
          s: isDarkTheme ? defaultDarkStyleId : undefined,
        };
      });
    } else if (sheet.rows && sheet.rows.length > 0) {
      // 2. 回退：如果仅有二维文本矩阵 rows
      sheet.rows.forEach((row, rIdx) => {
        row.forEach((text, cIdx) => {
          if (text === undefined || text === null || text === '') {
            return;
          }

          if (!cellData[rIdx]) {
            cellData[rIdx] = {};
          }

          cellData[rIdx][cIdx] = {
            v: text,
            t: CellValueType.STRING,
            s: isDarkTheme ? defaultDarkStyleId : undefined,
          };
        });
      });
    }

    // 3. 处理合并单元格
    const mergeData: IRange[] = [];
    if (sheet.mergedRanges && sheet.mergedRanges.length > 0) {
      sheet.mergedRanges.forEach(rangeStr => {
        const parsed = parseMergeRange(rangeStr);
        if (parsed) {
          mergeData.push(parsed);
        }
      });
    }

    sheets[sheetId] = {
      id: sheetId,
      name: sheet.name || `Sheet${index + 1}`,
      tabColor: '',
      hidden: 0,
      rowCount: maxRows,
      columnCount: maxCols,
      zoomRatio: 1,
      scrollTop: 0,
      scrollLeft: 0,
      defaultColumnWidth: 96,
      defaultRowHeight: 24,
      cellData,
      rowData: {},
      columnData: {},
      showGridlines: 1,
      mergeData,
      rowHeader: {
        width: 46,
        hidden: 0,
      },
      columnHeader: {
        height: 22,
        hidden: 0,
      },
      rightToLeft: 0,
    };
  });

  return {
    id: unitId,
    sheetOrder,
    name: workbookName,
    appVersion: '1.0.2',
    locale: LocaleType.ZH_CN,
    styles: isDarkTheme ? { [defaultDarkStyleId]: { cl: { rgb: '#e6edf3' } } } : {},
    sheets,
    resources: [],
  };
}
