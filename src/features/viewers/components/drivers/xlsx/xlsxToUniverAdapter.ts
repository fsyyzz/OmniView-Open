/**
 * OmniView -> Univer 数据模型桥接适配器
 * 将已有的 OOXML 解析结果 (ParsedXlsxWorkbook) 转换为 Univer 专有 IWorkbookData 结构
 * 保持 100% 离线、纯前端转换，零网络与企业版商业授权依赖
 * 作者: 周赞
 */
import type { IWorkbookData, IWorksheetData, ICellData, IRange } from '@univerjs/core';
import { CellValueType, LocaleType } from '@univerjs/core';
import type { ParsedXlsxWorkbook } from '../../../lib/xlsxEngine';
import { colLetterToIndex } from '../../../lib/xlsxEngine';

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
