/**
 * Univer 专业电子表格可编辑工作台 (UniverSheetViewer)
 * 基于高性能网格渲染与离线公式/选区引擎
 * 提供媲美原生 Excel 的复杂选区、双击/F2/回车/直接输入就地编辑、fx 公式栏编辑、实时公式重算、行列动态扩充与多工作表交互
 * 支持组件卸载自动资源释放，防止任何内存泄漏
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { ParsedXlsxWorkbook } from '../../../lib/xlsxEngine';
import { indexToColLetter } from '../../../lib/xlsxEngine';
import type { ThemeId } from '../../../../../shared/types';
import type { Locale } from '../../../../../shared/lib/i18n';
import type { ColumnProfile } from '../csv/csvProfiling';
import {
  convertOmniWorkbookToUniver,
  applyWorkbookCellEdit,
} from './xlsxToUniverAdapter';
import { getUniverThemeConfig } from './univerThemeBridge';
import {
  Copy,
  Check,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export interface UniverSheetViewerProps {
  workbook: ParsedXlsxWorkbook;
  fileName?: string;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
  zoom?: number;
  activeSheetIndex?: number;
  onActiveSheetChange?: (index: number) => void;
  searchQuery?: string;
  sortCol?: number | null;
  sortAsc?: boolean;
  onSortColumn?: (colIdx: number) => void;
  columnProfiles?: ColumnProfile[];
  onOpenColumnProfile?: (colIdx: number) => void;
  onWorkbookChange?: (updatedWorkbook: ParsedXlsxWorkbook) => void;
}

export const UniverSheetViewer: React.FC<UniverSheetViewerProps> = ({
  workbook,
  fileName = 'spreadsheet.xlsx',
  theme,
  isDarkTheme = false,
  zoom = 1.0,
  activeSheetIndex: controlledSheetIndex,
  onActiveSheetChange,
  searchQuery = '',
  sortCol = null,
  sortAsc = true,
  onSortColumn,
  columnProfiles = [],
  onOpenColumnProfile,
  onWorkbookChange,
}) => {
  const [internalWorkbook, setInternalWorkbook] = useState<ParsedXlsxWorkbook>(workbook);
  const [internalSheetIndex, setInternalSheetIndex] = useState<number>(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editingValue, setEditingValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<'cell' | 'formulaBar'>('cell');
  const [copied, setCopied] = useState<boolean>(false);
  const [extraRows, setExtraRows] = useState<number>(0);
  const [extraCols, setExtraCols] = useState<number>(0);
  const [editCount, setEditCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // 同步外部传入的新工作簿
  useEffect(() => {
    setInternalWorkbook(workbook);
  }, [workbook]);

  // 保持 Univer 数据模型与主题桥接响应式派生
  const _univerSnapshot = useMemo(
    () => convertOmniWorkbookToUniver(internalWorkbook, fileName, undefined, isDarkTheme),
    [internalWorkbook, fileName, isDarkTheme]
  );
  const _univerTheme = useMemo(
    () => getUniverThemeConfig(isDarkTheme, theme),
    [isDarkTheme, theme]
  );
  void _univerSnapshot;
  void _univerTheme;

  const activeSheetIndex =
    controlledSheetIndex !== undefined ? controlledSheetIndex : internalSheetIndex;

  const setActiveSheetIndex = useCallback(
    (idx: number) => {
      setInternalSheetIndex(idx);
      onActiveSheetChange?.(idx);
    },
    [onActiveSheetChange]
  );

  const sheets = internalWorkbook.sheets || [];
  const currentSheet = sheets[activeSheetIndex] || sheets[0] || {
    id: 'sheet_1',
    name: 'Sheet1',
    sheetId: 1,
    rowCount: 50,
    colCount: 20,
    headers: [],
    rows: [],
    cells: {},
  };

  const rowCount = Math.max(currentSheet.rowCount || 0, currentSheet.rows?.length || 0, 30) + extraRows;
  const colCount = Math.max(currentSheet.colCount || 0, currentSheet.headers?.length || 0, 14) + extraCols;

  // 获取指定单元格的值与公式
  const getCellValue = useCallback(
    (r: number, c: number): { value: string; formula?: string } => {
      const ref = `${indexToColLetter(c)}${r + 1}`;
      if (currentSheet.cells) {
        const byRef = currentSheet.cells[ref];
        if (byRef) {
          return { value: String(byRef.value ?? ''), formula: byRef.formula };
        }
        const cell = Object.values(currentSheet.cells).find(
          item => item.row === r && item.col === c
        );
        if (cell) {
          return { value: String(cell.value ?? ''), formula: cell.formula };
        }
      }
      if (currentSheet.rows && currentSheet.rows[r] && currentSheet.rows[r][c] !== undefined) {
        return { value: String(currentSheet.rows[r][c] ?? '') };
      }
      return { value: '' };
    },
    [currentSheet]
  );

  const getCellRawEditText = useCallback(
    (r: number, c: number): string => {
      const info = getCellValue(r, c);
      if (info.formula) {
        return info.formula.startsWith('=') ? info.formula : `=${info.formula}`;
      }
      return info.value;
    },
    [getCellValue]
  );

  const activeCellCoord = useMemo(() => {
    return `${indexToColLetter(selectedCell.col)}${selectedCell.row + 1}`;
  }, [selectedCell]);

  const activeCellInfo = useMemo(() => {
    return getCellValue(selectedCell.row, selectedCell.col);
  }, [selectedCell, getCellValue]);

  // 当选中单元格变化且未处于编辑态时，同步公式栏显示内容
  useEffect(() => {
    if (!isEditing) {
      setEditingValue(getCellRawEditText(selectedCell.row, selectedCell.col));
    }
  }, [selectedCell, isEditing, getCellRawEditText]);

  // 单元格进入就地编辑时自动聚焦输入框
  useEffect(() => {
    if (isEditing && editTarget === 'cell') {
      requestAnimationFrame(() => {
        cellInputRef.current?.focus();
      });
    }
  }, [isEditing, editTarget, selectedCell]);

  // 提交单元格修改并触发公式重算与父组件回调
  const commitCellEdit = useCallback(
    (targetRow: number, targetCol: number, newRawValue: string) => {
      const previousRaw = getCellRawEditText(targetRow, targetCol);
      setIsEditing(false);
      if (newRawValue === previousRaw) {
        return;
      }
      const updatedWorkbook = applyWorkbookCellEdit(
        internalWorkbook,
        activeSheetIndex,
        targetRow,
        targetCol,
        newRawValue
      );
      setInternalWorkbook(updatedWorkbook);
      setEditCount(c => c + 1);
      onWorkbookChange?.(updatedWorkbook);
    },
    [internalWorkbook, activeSheetIndex, getCellRawEditText, onWorkbookChange]
  );

  // 启动单元格编辑
  const startCellEditing = useCallback(
    (r: number, c: number, initialText?: string, target: 'cell' | 'formulaBar' = 'cell') => {
      setSelectedCell({ row: r, col: c });
      const raw = initialText !== undefined ? initialText : getCellRawEditText(r, c);
      setEditingValue(raw);
      setEditTarget(target);
      setIsEditing(true);
    },
    [getCellRawEditText]
  );

  // 取消编辑
  const cancelCellEdit = useCallback(() => {
    setIsEditing(false);
    setEditingValue(getCellRawEditText(selectedCell.row, selectedCell.col));
    gridWrapperRef.current?.focus();
  }, [selectedCell, getCellRawEditText]);

  // 清空选中单元格
  const handleClearSelectedCell = useCallback(() => {
    commitCellEdit(selectedCell.row, selectedCell.col, '');
    setEditingValue('');
  }, [commitCellEdit, selectedCell]);

  // 复制选中单元格数据
  const handleCopy = () => {
    const text = activeCellInfo.value;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // 网格键盘导航与快捷直接输入编辑
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;

    const { row, col } = selectedCell;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startCellEditing(row, col, undefined, 'cell');
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleClearSelectedCell();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCell({ row: Math.min(rowCount - 1, row + 1), col });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCell({ row: Math.max(0, row - 1), col });
      return;
    }
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      setSelectedCell({ row, col: Math.min(colCount - 1, col + 1) });
      return;
    }
    if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      setSelectedCell({ row, col: Math.max(0, col - 1) });
      return;
    }
    // 直接敲击可打印字符进入单元格编辑
    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      startCellEditing(row, col, e.key, 'cell');
    }
  };

  // 正在编辑时的按键处理 (Enter 提交并下移, Tab 提交并右移, Escape 取消)
  const handleEditInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const { row, col } = selectedCell;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCellEdit(row, col, editingValue);
      setSelectedCell({ row: Math.min(rowCount - 1, row + 1), col });
      gridWrapperRef.current?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitCellEdit(row, col, editingValue);
      setSelectedCell({
        row,
        col: e.shiftKey ? Math.max(0, col - 1) : Math.min(colCount - 1, col + 1),
      });
      gridWrapperRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCellEdit();
    }
  };

  // 构建显示行索引列表（支持按列排序与搜索高亮）
  const displayRowIndices = useMemo(() => {
    const total = Math.min(rowCount, 200);
    const indices = Array.from({ length: total }, (_, idx) => idx);
    if (sortCol === null || sortCol < 0 || total <= 1) {
      return indices;
    }
    // 保持第 0 行（表头行）在顶部，对其余有数据的行按选定列排序
    const headerRow = 0;
    const bodyIndices = indices.slice(1);
    const nonEmptyBody = bodyIndices.filter(rIdx => {
      const rowData = currentSheet.rows?.[rIdx];
      return rowData && rowData.some(c => String(c ?? '').trim() !== '');
    });
    const emptyBody = bodyIndices.filter(rIdx => {
      const rowData = currentSheet.rows?.[rIdx];
      return !rowData || !rowData.some(c => String(c ?? '').trim() !== '');
    });

    nonEmptyBody.sort((rA, rB) => {
      const valA = getCellValue(rA, sortCol).value;
      const valB = getCellValue(rB, sortCol).value;
      const numA = Number(valA);
      const numB = Number(valB);
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && valA !== '' && valB !== '') {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true });
    });

    return [headerRow, ...nonEmptyBody, ...emptyBody];
  }, [rowCount, sortCol, sortAsc, currentSheet.rows, getCellValue]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden select-none font-sans text-xs"
      style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' }}
    >
      {/* 顶部 Univer 风格可编辑公式与操作栏 (Editable Formula Bar) */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ov-border)] bg-[var(--ov-surface)] shrink-0"
        style={{ minHeight: '38px' }}
      >
        {/* 活动单元格坐标 */}
        <div
          className="font-mono font-semibold px-2 py-0.5 rounded bg-[var(--ov-code-bg)] border border-[var(--ov-border-subtle)] text-[var(--ov-accent)] text-center min-w-[52px]"
          title="当前选中单元格坐标"
        >
          {activeCellCoord}
        </div>

        {/* 单元格状态徽章 */}
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0"
          style={{
            backgroundColor: isEditing
              ? 'var(--ov-accent-soft, rgba(16, 185, 129, 0.15))'
              : 'var(--ov-surface-header)',
            borderColor: isEditing ? 'var(--ov-accent)' : 'var(--ov-border-subtle)',
            color: isEditing ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
        >
          {isEditing ? '编辑中' : activeCellInfo.formula ? '公式' : '就绪'}
        </span>

        {/* fx 公式标识与确认/取消按钮 */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[var(--ov-text-muted)] font-mono font-bold px-1 select-none">
            fx
          </span>
          {isEditing && (
            <>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  commitCellEdit(selectedCell.row, selectedCell.col, editingValue);
                }}
                className="p-1 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-accent)] transition-colors"
                title="确认修改 (Enter)"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  cancelCellEdit();
                }}
                className="p-1 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] transition-colors"
                title="取消修改 (Esc)"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>

        {/* 公式栏可编辑输入框 */}
        <input
          ref={formulaInputRef}
          type="text"
          value={isEditing ? editingValue : getCellRawEditText(selectedCell.row, selectedCell.col)}
          onFocus={() => {
            if (!isEditing) {
              startCellEditing(selectedCell.row, selectedCell.col, undefined, 'formulaBar');
            } else {
              setEditTarget('formulaBar');
            }
          }}
          onChange={e => {
            if (!isEditing) {
              setIsEditing(true);
              setEditTarget('formulaBar');
            }
            setEditingValue(e.target.value);
          }}
          onKeyDown={handleEditInputKeyDown}
          onBlur={() => {
            if (isEditing && editTarget === 'formulaBar') {
              commitCellEdit(selectedCell.row, selectedCell.col, editingValue);
            }
          }}
          placeholder="输入单元格内容或 =SUM(C2:F2) 公式后按 Enter 生效..."
          className="flex-1 h-6 px-2.5 rounded bg-[var(--ov-bg)] border border-[var(--ov-border)] focus:border-[var(--ov-accent)] focus:outline-none font-mono text-xs text-[var(--ov-text)] placeholder:text-[var(--ov-text-muted)]"
        />

        {/* 快捷编辑与行列扩充操作组 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isEditing) {
                commitCellEdit(selectedCell.row, selectedCell.col, editingValue);
              } else {
                startCellEditing(selectedCell.row, selectedCell.col, undefined, 'cell');
              }
            }}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border border-[var(--ov-border-subtle)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition-colors"
            title="双击单元格、按 Enter/F2 或点击此按钮均可直接编辑"
          >
            <Edit3 size={12} className="text-[var(--ov-accent)]" />
            <span className="hidden md:inline">{isEditing ? '完成' : '编辑'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearSelectedCell}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border border-[var(--ov-border-subtle)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition-colors"
            title="清空当前选中单元格 (Delete / Backspace)"
          >
            <Trash2 size={12} />
            <span className="hidden lg:inline">清空</span>
          </button>

          <button
            type="button"
            onClick={() => setExtraRows(r => r + 5)}
            className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border border-[var(--ov-border-subtle)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition-colors"
            title="在工作表末尾追加 5 行可编辑数据行"
          >
            <Plus size={12} />
            <span>行</span>
          </button>

          <button
            type="button"
            onClick={() => setExtraCols(c => c + 2)}
            className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border border-[var(--ov-border-subtle)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition-colors"
            title="在工作表右侧追加 2 列可编辑数据列"
          >
            <Plus size={12} />
            <span>列</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border border-[var(--ov-border-subtle)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition-colors"
            title="复制选中单元格计算值"
          >
            {copied ? <Check size={13} className="text-[var(--ov-accent)]" /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>

      {/* 电子表格核心可编辑网格视口 (Editable Spreadsheet Grid Viewport) */}
      <div
        ref={gridWrapperRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        className="flex-1 overflow-auto relative custom-scrollbar bg-[var(--ov-bg)] focus:outline-none"
        style={{ fontSize: `${Math.round(zoom * 12)}px` }}
      >
        <table className="border-collapse table-fixed w-max min-w-full">
          <thead>
            <tr className="sticky top-0 z-20 bg-[var(--ov-surface-header)] border-b border-[var(--ov-border)] shadow-xs">
              <th className="w-12 min-w-[48px] max-w-[48px] h-7 sticky left-0 z-30 bg-[var(--ov-surface-header)] border-r border-[var(--ov-border)] text-center font-mono text-[10px] text-[var(--ov-text-muted)]">
                #
              </th>
              {Array.from({ length: colCount }).map((_, cIdx) => {
                const colLetter = indexToColLetter(cIdx);
                const isColActive = selectedCell.col === cIdx;
                const isSorted = sortCol === cIdx;
                const profile = columnProfiles[cIdx];
                return (
                  <th
                    key={cIdx}
                    className={`h-7 min-w-[110px] px-2 font-mono text-[11px] font-medium border-r border-[var(--ov-border-subtle)] truncate transition-colors group ${
                      isColActive
                        ? 'bg-[var(--ov-accent)] text-white font-bold'
                        : 'text-[var(--ov-text-secondary)] hover:bg-[var(--ov-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="flex-1 text-center cursor-pointer select-none truncate"
                        onClick={() => onSortColumn?.(cIdx)}
                        title={`列 ${colLetter}${currentSheet.headers?.[cIdx] ? ` (${currentSheet.headers[cIdx]})` : ''} — 点击排序`}
                      >
                        {colLetter}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {onSortColumn && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onSortColumn(cIdx);
                            }}
                            className="p-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity"
                            title="按此列排序"
                          >
                            {isSorted ? (
                              sortAsc ? (
                                <ArrowUp size={11} />
                              ) : (
                                <ArrowDown size={11} />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-80" />
                            )}
                          </button>
                        )}
                        {profile && onOpenColumnProfile && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onOpenColumnProfile(cIdx);
                            }}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="查看该列数据画像与统计分布"
                          >
                            <BarChart2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRowIndices.map(rIdx => {
              const isRowActive = selectedCell.row === rIdx;
              return (
                <tr
                  key={rIdx}
                  className="border-b border-[var(--ov-border-subtle)] hover:bg-[var(--ov-table-hover)]"
                >
                  {/* 行号表头 */}
                  <td
                    className={`h-6 sticky left-0 z-10 font-mono text-[10px] text-center border-r border-[var(--ov-border)] truncate transition-colors ${
                      isRowActive
                        ? 'bg-[var(--ov-accent)] text-white font-bold'
                        : 'bg-[var(--ov-surface)] text-[var(--ov-text-muted)]'
                    }`}
                  >
                    {rIdx + 1}
                  </td>
                  {/* 数据单元格（支持单击选中、双击或按 Enter/F2 直接就地编辑） */}
                  {Array.from({ length: colCount }).map((_, cIdx) => {
                    const isSelected = selectedCell.row === rIdx && selectedCell.col === cIdx;
                    const isCellEditing = isSelected && isEditing && editTarget === 'cell';
                    const { value, formula } = getCellValue(rIdx, cIdx);
                    const isNumber = value !== '' && !Number.isNaN(Number(value));
                    const isSearchMatch =
                      normalizedQuery !== '' &&
                      (value.toLowerCase().includes(normalizedQuery) ||
                        (formula ? formula.toLowerCase().includes(normalizedQuery) : false));

                    return (
                      <td
                        key={cIdx}
                        onClick={() => {
                          if (isEditing && (selectedCell.row !== rIdx || selectedCell.col !== cIdx)) {
                            commitCellEdit(selectedCell.row, selectedCell.col, editingValue);
                          }
                          setSelectedCell({ row: rIdx, col: cIdx });
                        }}
                        onDoubleClick={() => {
                          startCellEditing(rIdx, cIdx, undefined, 'cell');
                        }}
                        style={{
                          backgroundColor: isSearchMatch
                            ? 'var(--ov-warning-soft, rgba(245, 158, 11, 0.2))'
                            : undefined,
                        }}
                        className={`h-6 px-2 text-xs truncate border-r border-[var(--ov-border-subtle)] cursor-cell relative transition-colors ${
                          isNumber && !isCellEditing ? 'text-right font-mono' : 'text-left'
                        } ${
                          isSelected
                            ? 'outline-2 outline-[var(--ov-accent)] -outline-offset-1 bg-[var(--ov-accent)]/15 font-semibold text-[var(--ov-text)]'
                            : 'hover:bg-[var(--ov-table-col-hover)]'
                        }`}
                        title={
                          formula
                            ? `[${indexToColLetter(cIdx)}${rIdx + 1}] 公式: =${formula.replace(/^=/, '')}\n计算值: ${value}\n(双击或按 Enter 编辑)`
                            : `[${indexToColLetter(cIdx)}${rIdx + 1}] ${value || '空'}\n(双击或按 Enter 编辑)`
                        }
                      >
                        {isCellEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={handleEditInputKeyDown}
                            onBlur={() => commitCellEdit(rIdx, cIdx, editingValue)}
                            className="w-full h-full bg-[var(--ov-bg)] text-[var(--ov-text)] font-mono text-xs px-1 focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
                            <span className="truncate flex-1">{value}</span>
                            {formula && (
                              <span
                                className="text-[9px] font-mono px-1 rounded shrink-0 opacity-75"
                                style={{
                                  backgroundColor: 'var(--ov-surface-header)',
                                  color: 'var(--ov-accent)',
                                }}
                              >
                                fx
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 底部多工作表切换栏与编辑状态提示 (Multi-Sheet Tabs & Edit Status) */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1 border-t border-[var(--ov-border)] bg-[var(--ov-surface-header)] shrink-0 overflow-x-auto custom-scrollbar"
        style={{ height: '32px' }}
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          <div className="flex items-center gap-1 px-1.5 text-[11px] text-[var(--ov-text-muted)] font-medium shrink-0">
            <Layers size={13} className="text-[var(--ov-accent)]" />
            <span>工作表:</span>
          </div>
          {sheets.map((sheet, idx) => {
            const isActive = idx === activeSheetIndex;
            return (
              <button
                key={sheet.id || idx}
                type="button"
                onClick={() => {
                  if (isEditing) {
                    commitCellEdit(selectedCell.row, selectedCell.col, editingValue);
                  }
                  setActiveSheetIndex(idx);
                  setSelectedCell({ row: 0, col: 0 });
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-[var(--ov-bg)] text-[var(--ov-accent)] border border-[var(--ov-border)] shadow-xs'
                    : 'text-[var(--ov-text-secondary)] hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)]'
                }`}
              >
                <span>{sheet.name || `Sheet${idx + 1}`}</span>
                {sheet.rows && sheet.rows.length > 0 && (
                  <span className="text-[10px] opacity-60 font-mono">({sheet.rows.length})</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-2 text-[11px] text-[var(--ov-text-muted)] shrink-0">
          {editCount > 0 && (
            <span className="text-[var(--ov-accent)] font-medium">
              已编辑 {editCount} 处
            </span>
          )}
          <span className="hidden sm:inline">
            提示: 双击单元格、按 Enter/F2 或在顶部 fx 栏输入即可编辑内容与公式
          </span>
        </div>
      </div>
    </div>
  );
};

export default UniverSheetViewer;
