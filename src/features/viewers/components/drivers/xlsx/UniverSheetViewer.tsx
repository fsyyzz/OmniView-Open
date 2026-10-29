/**
 * Univer 专业电子表格可编辑工作台 (UniverSheetViewer)
 * 基于高性能网格渲染与离线公式/选区引擎
 * 提供媲美原生 Excel 的复杂选区、双击/F2/回车/直接输入就地编辑、fx 公式栏编辑、实时公式重算、列头过滤、列冻结、行列动态扩充与多工作表交互
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
  getColumnDistinctValues,
  filterAndSortWorksheetRows,
  calculateFrozenColumnLeftOffset,
  type ColumnFilterRule,
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
  Filter,
  Pin,
  PinOff,
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

const ROW_HEADER_WIDTH = 48;
const COL_WIDTH = 128;

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
  const internalWorkbookRef = useRef<ParsedXlsxWorkbook>(workbook);

  const [internalSheetIndex, setInternalSheetIndex] = useState<number>(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editingValue, setEditingValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<'cell' | 'formulaBar'>('cell');
  const [copied, setCopied] = useState<boolean>(false);
  const [extraRows, setExtraRows] = useState<number>(0);
  const [extraCols, setExtraCols] = useState<number>(0);
  const [editCount, setEditCount] = useState<number>(0);

  // 列头过滤与列冻结状态
  const [columnFilters, setColumnFilters] = useState<Record<number, ColumnFilterRule>>({});
  const [openFilterCol, setOpenFilterCol] = useState<number | null>(null);
  const [frozenColCount, setFrozenColCount] = useState<number>(0);
  const [showFreezeMenu, setShowFreezeMenu] = useState<boolean>(false);

  // 同步编辑事务引用锁（彻底消除 Enter / Blur / 切换单元格时的 React 闭包过期与二次触发覆盖问题）
  const editingSessionRef = useRef<{
    row: number;
    col: number;
    value: string;
    target: 'cell' | 'formulaBar';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // 同步外部传入的新工作簿
  useEffect(() => {
    internalWorkbookRef.current = workbook;
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
      setColumnFilters({});
      setOpenFilterCol(null);
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
    if (!isEditing && !editingSessionRef.current) {
      setEditingValue(getCellRawEditText(selectedCell.row, selectedCell.col));
    }
  }, [selectedCell, isEditing, getCellRawEditText]);

  // 单元格进入就地编辑时自动聚焦输入框并将光标移至末尾
  useEffect(() => {
    if (isEditing && editTarget === 'cell') {
      const timer = requestAnimationFrame(() => {
        const input = cellInputRef.current;
        if (input) {
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [isEditing, editTarget, selectedCell.row, selectedCell.col]);

  // 更新编辑框文本并同步写入 editingSessionRef
  const updateEditingText = useCallback((nextVal: string) => {
    if (editingSessionRef.current) {
      editingSessionRef.current.value = nextVal;
    }
    setEditingValue(nextVal);
  }, []);

  // 提交单元格修改并触发公式重算与父组件回调
  const commitCellEdit = useCallback(
    (overrideRow?: number, overrideCol?: number, overrideRawValue?: string) => {
      const session = editingSessionRef.current;
      if (!session && overrideRawValue === undefined) {
        setIsEditing(false);
        return;
      }

      const targetRow = overrideRow !== undefined ? overrideRow : session!.row;
      const targetCol = overrideCol !== undefined ? overrideCol : session!.col;
      const newRawValue = overrideRawValue !== undefined ? overrideRawValue : session!.value;

      // 立即释放编辑会话锁，防止同步触发的 onBlur 二次执行或用旧闭包覆盖
      editingSessionRef.current = null;
      setIsEditing(false);

      const previousRaw = getCellRawEditText(targetRow, targetCol);
      if (newRawValue === previousRaw) {
        return;
      }

      const baseWorkbook = internalWorkbookRef.current;
      const updatedWorkbook = applyWorkbookCellEdit(
        baseWorkbook,
        activeSheetIndex,
        targetRow,
        targetCol,
        newRawValue
      );

      internalWorkbookRef.current = updatedWorkbook;
      setInternalWorkbook(updatedWorkbook);
      setEditCount(c => c + 1);
      onWorkbookChange?.(updatedWorkbook);
    },
    [activeSheetIndex, getCellRawEditText, onWorkbookChange]
  );

  // 启动单元格编辑
  const startCellEditing = useCallback(
    (r: number, c: number, initialText?: string, target: 'cell' | 'formulaBar' = 'cell') => {
      // 若当前正在编辑另一个单元格，先提交前一个单元格
      if (
        editingSessionRef.current &&
        (editingSessionRef.current.row !== r || editingSessionRef.current.col !== c)
      ) {
        commitCellEdit();
      }
      const raw = initialText !== undefined ? initialText : getCellRawEditText(r, c);
      editingSessionRef.current = {
        row: r,
        col: c,
        value: raw,
        target,
      };
      setSelectedCell({ row: r, col: c });
      setEditingValue(raw);
      setEditTarget(target);
      setIsEditing(true);
    },
    [commitCellEdit, getCellRawEditText]
  );

  // 取消编辑
  const cancelCellEdit = useCallback(() => {
    editingSessionRef.current = null;
    setIsEditing(false);
    setEditingValue(getCellRawEditText(selectedCell.row, selectedCell.col));
    gridWrapperRef.current?.focus();
  }, [selectedCell, getCellRawEditText]);

  // 清空选中单元格
  const handleClearSelectedCell = useCallback(() => {
    editingSessionRef.current = null;
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
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
      commitCellEdit();
      setSelectedCell({ row: Math.min(rowCount - 1, row + 1), col });
      requestAnimationFrame(() => {
        gridWrapperRef.current?.focus();
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitCellEdit();
      setSelectedCell({
        row,
        col: e.shiftKey ? Math.max(0, col - 1) : Math.min(colCount - 1, col + 1),
      });
      requestAnimationFrame(() => {
        gridWrapperRef.current?.focus();
      });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCellEdit();
    }
  };

  // 判断某列是否配置了有效过滤条件
  const isColumnFiltered = useCallback(
    (cIdx: number): boolean => {
      const rule = columnFilters[cIdx];
      if (!rule) return false;
      return Boolean(
        (rule.keyword && rule.keyword.trim() !== '') || Array.isArray(rule.selectedValues)
      );
    },
    [columnFilters]
  );

  const activeFilterColCount = useMemo(() => {
    return Object.keys(columnFilters).filter(k => isColumnFiltered(Number(k))).length;
  }, [columnFilters, isColumnFiltered]);

  // 更新某列的过滤规则
  const updateColumnFilter = useCallback(
    (cIdx: number, updater: (prev: ColumnFilterRule) => ColumnFilterRule | null) => {
      setColumnFilters(prev => {
        const current = prev[cIdx] || {};
        const nextRule = updater(current);
        const nextMap = { ...prev };
        if (
          !nextRule ||
          ((!nextRule.keyword || nextRule.keyword.trim() === '') && !Array.isArray(nextRule.selectedValues))
        ) {
          delete nextMap[cIdx];
        } else {
          nextMap[cIdx] = nextRule;
        }
        return nextMap;
      });
    },
    []
  );

  // 构建显示行索引列表（支持列头过滤 + 按列排序）
  const displayRowIndices = useMemo(() => {
    return filterAndSortWorksheetRows({
      sheet: currentSheet,
      totalRows: rowCount,
      columnFilters,
      sortCol,
      sortAsc,
    });
  }, [currentSheet, rowCount, columnFilters, sortCol, sortAsc]);

  // 当前打开的列头过滤面板候选去重值
  const openFilterDistinctValues = useMemo(() => {
    if (openFilterCol === null) return [];
    return getColumnDistinctValues(currentSheet, openFilterCol, true);
  }, [currentSheet, openFilterCol]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden select-none font-sans text-xs"
      style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' }}
    >
      {/* 顶部 Univer 风格可编辑公式与操作栏 (Editable Formula & Freeze/Filter Bar) */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ov-border)] bg-[var(--ov-surface)] shrink-0 flex-wrap"
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
                  e.stopPropagation();
                  commitCellEdit();
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
                  e.stopPropagation();
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
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          onFocus={() => {
            if (!isEditing) {
              startCellEditing(selectedCell.row, selectedCell.col, undefined, 'formulaBar');
            } else {
              setEditTarget('formulaBar');
              if (editingSessionRef.current) {
                editingSessionRef.current.target = 'formulaBar';
              }
            }
          }}
          onChange={e => {
            if (!isEditing) {
              startCellEditing(selectedCell.row, selectedCell.col, e.target.value, 'formulaBar');
            } else {
              updateEditingText(e.target.value);
            }
          }}
          onKeyDown={handleEditInputKeyDown}
          onBlur={() => {
            if (editingSessionRef.current && editingSessionRef.current.target === 'formulaBar') {
              commitCellEdit();
            }
          }}
          placeholder="双击单元格或在此输入内容 / =SUM(C2:F2) 公式后按 Enter 生效..."
          className="flex-1 min-w-[180px] h-6 px-2.5 rounded bg-[var(--ov-bg)] border border-[var(--ov-border)] focus:border-[var(--ov-accent)] focus:outline-none font-mono text-xs text-[var(--ov-text)] placeholder:text-[var(--ov-text-muted)] select-text"
        />

        {/* 列冻结与筛选快捷操作组 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 列冻结下拉菜单 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFreezeMenu(v => !v)}
              style={{
                borderColor: frozenColCount > 0 ? 'var(--ov-accent)' : 'var(--ov-border-subtle)',
                color: frozenColCount > 0 ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border transition-colors"
              title="设置列冻结（也可直接点击各列头右侧的图钉图标冻结到此列）"
            >
              <Pin size={12} />
              <span>
                {frozenColCount > 0
                  ? `已冻结 ${frozenColCount} 列 (A${frozenColCount > 1 ? `-${indexToColLetter(frozenColCount - 1)}` : ''})`
                  : '冻结列'}
              </span>
            </button>

            {showFreezeMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 top-full mt-1 w-44 rounded-md shadow-xl border py-1 z-50 text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    setFrozenColCount(0);
                    setShowFreezeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] flex items-center justify-between transition"
                >
                  <span>取消列冻结</span>
                  {frozenColCount === 0 && <Check size={12} className="text-[var(--ov-accent)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrozenColCount(1);
                    setShowFreezeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] flex items-center justify-between transition"
                >
                  <span>冻结首列 (列 A)</span>
                  {frozenColCount === 1 && <Check size={12} className="text-[var(--ov-accent)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrozenColCount(2);
                    setShowFreezeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] flex items-center justify-between transition"
                >
                  <span>冻结前 2 列 (A-B)</span>
                  {frozenColCount === 2 && <Check size={12} className="text-[var(--ov-accent)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrozenColCount(Math.min(selectedCell.col + 1, 6));
                    setShowFreezeMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] flex items-center justify-between transition"
                >
                  <span>冻结至当前列 ({indexToColLetter(selectedCell.col)})</span>
                </button>
              </div>
            )}
          </div>

          {/* 清除列头过滤快捷按钮 */}
          {activeFilterColCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setColumnFilters({});
                setOpenFilterCol(null);
              }}
              style={{
                borderColor: 'var(--ov-accent)',
                color: 'var(--ov-accent)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--ov-surface-hover)] border transition-colors"
              title="清除全部列头筛选条件"
            >
              <Filter size={12} />
              <span>已筛选 {activeFilterColCount} 列 · 清除</span>
            </button>
          )}

          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              if (isEditing) {
                commitCellEdit();
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
        onClick={() => {
          if (openFilterCol !== null) setOpenFilterCol(null);
          if (showFreezeMenu) setShowFreezeMenu(false);
        }}
        className="flex-1 overflow-auto relative custom-scrollbar bg-[var(--ov-bg)] focus:outline-none"
        style={{ fontSize: `${Math.round(zoom * 12)}px` }}
      >
        <table className="border-collapse table-fixed w-max min-w-full">
          <thead>
            <tr className="sticky top-0 z-20 bg-[var(--ov-surface-header)] border-b border-[var(--ov-border)] shadow-xs">
              {/* 左上角固定行号表头 */}
              <th
                style={{
                  width: `${ROW_HEADER_WIDTH}px`,
                  minWidth: `${ROW_HEADER_WIDTH}px`,
                  maxWidth: `${ROW_HEADER_WIDTH}px`,
                  left: '0px',
                }}
                className="h-7 sticky top-0 left-0 z-40 bg-[var(--ov-surface-header)] border-r border-[var(--ov-border)] text-center font-mono text-[10px] text-[var(--ov-text-muted)]"
              >
                #
              </th>
              {Array.from({ length: colCount }).map((_, cIdx) => {
                const colLetter = indexToColLetter(cIdx);
                const headerTitle = currentSheet.rows?.[0]?.[cIdx]?.trim() || '';
                const isColActive = selectedCell.col === cIdx;
                const isSorted = sortCol === cIdx;
                const isFiltered = isColumnFiltered(cIdx);
                const isFilterOpen = openFilterCol === cIdx;
                const frozenLeft = calculateFrozenColumnLeftOffset(
                  cIdx,
                  frozenColCount,
                  ROW_HEADER_WIDTH,
                  COL_WIDTH
                );
                const isFrozen = frozenLeft !== null;
                const isLastFrozen = cIdx === frozenColCount - 1;
                const profile = columnProfiles[cIdx];

                return (
                  <th
                    key={cIdx}
                    style={{
                      width: `${COL_WIDTH}px`,
                      minWidth: `${COL_WIDTH}px`,
                      maxWidth: `${COL_WIDTH}px`,
                      position: 'sticky',
                      top: 0,
                      left: isFrozen ? `${frozenLeft}px` : undefined,
                      zIndex: isFilterOpen ? 45 : isFrozen ? 35 : 20,
                      backgroundColor: isColActive
                        ? 'var(--ov-accent)'
                        : 'var(--ov-surface-header)',
                      borderRight: isLastFrozen
                        ? '2px solid var(--ov-accent)'
                        : '1px solid var(--ov-border-subtle)',
                    }}
                    className={`h-7 px-1.5 font-mono text-[11px] font-medium transition-colors group relative ${
                      isColActive
                        ? 'text-white font-bold'
                        : 'text-[var(--ov-text-secondary)] hover:bg-[var(--ov-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span
                        className="flex-1 text-left cursor-pointer select-none truncate"
                        onClick={() => onSortColumn?.(cIdx)}
                        title={`列 ${colLetter}${headerTitle ? ` (${headerTitle})` : ''} — 点击排序`}
                      >
                        {colLetter}
                        {headerTitle ? (
                          <span className="ml-1 opacity-75 font-sans text-[10px]">
                            · {headerTitle}
                          </span>
                        ) : null}
                      </span>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* 列头过滤按钮 */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setOpenFilterCol(prev => (prev === cIdx ? null : cIdx));
                          }}
                          style={{
                            color: isFiltered
                              ? isColActive
                                ? '#ffffff'
                                : 'var(--ov-accent)'
                              : undefined,
                          }}
                          className={`p-0.5 rounded transition-opacity ${
                            isFiltered || isFilterOpen
                              ? 'opacity-100'
                              : 'opacity-50 group-hover:opacity-100'
                          }`}
                          title={`筛选列 ${colLetter}${isFiltered ? ' (已启用筛选)' : ''}`}
                        >
                          <Filter size={11} />
                        </button>

                        {/* 列冻结图钉按钮 */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setFrozenColCount(prev => (prev === cIdx + 1 ? 0 : cIdx + 1));
                          }}
                          style={{
                            color: isFrozen
                              ? isColActive
                                ? '#ffffff'
                                : 'var(--ov-accent)'
                              : undefined,
                          }}
                          className={`p-0.5 rounded transition-opacity ${
                            isFrozen ? 'opacity-100' : 'opacity-0 group-hover:opacity-90'
                          }`}
                          title={
                            isFrozen && isLastFrozen
                              ? '点击取消列冻结'
                              : `冻结至列 ${colLetter} (前 ${cIdx + 1} 列)`
                          }
                        >
                          {isFrozen && isLastFrozen ? <PinOff size={11} /> : <Pin size={11} />}
                        </button>

                        {/* 列排序按钮 */}
                        {onSortColumn && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onSortColumn(cIdx);
                            }}
                            className={`p-0.5 rounded transition-opacity ${
                              isSorted ? 'opacity-100' : 'opacity-0 group-hover:opacity-90'
                            }`}
                            title="按此列升序/降序排列"
                          >
                            {isSorted ? (
                              sortAsc ? (
                                <ArrowUp size={11} />
                              ) : (
                                <ArrowDown size={11} />
                              )
                            ) : (
                              <ArrowUpDown size={11} />
                            )}
                          </button>
                        )}

                        {/* 列特征画像按钮 */}
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

                    {/* 列头过滤浮层菜单 (Column Filter Popover) */}
                    {isFilterOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                        style={{
                          backgroundColor: 'var(--ov-surface)',
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-text)',
                        }}
                        className="absolute left-0 top-full mt-1 w-60 rounded-md shadow-2xl border p-2.5 z-50 font-sans font-normal text-left cursor-default select-text"
                      >
                        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[var(--ov-border-subtle)]">
                          <span className="font-semibold text-xs truncate">
                            列 {colLetter} {headerTitle ? `(${headerTitle})` : ''} 筛选
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenFilterCol(null)}
                            className="p-0.5 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)]"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* 关键字包含过滤 */}
                        <div className="mb-2">
                          <input
                            type="text"
                            value={columnFilters[cIdx]?.keyword || ''}
                            onChange={e => {
                              const kw = e.target.value;
                              updateColumnFilter(cIdx, prev => ({
                                ...prev,
                                keyword: kw,
                              }));
                            }}
                            placeholder="输入包含关键字过滤..."
                            className="w-full px-2 py-1 rounded text-xs bg-[var(--ov-bg)] border border-[var(--ov-border)] focus:border-[var(--ov-accent)] focus:outline-none text-[var(--ov-text)] select-text"
                          />
                        </div>

                        {/* 候选唯一值勾选列表 */}
                        <div className="flex items-center justify-between text-[11px] mb-1 text-[var(--ov-text-secondary)]">
                          <span>按值筛选 ({openFilterDistinctValues.length} 项)</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateColumnFilter(cIdx, prev => ({
                                  ...prev,
                                  selectedValues: null,
                                }))
                              }
                              className="text-[var(--ov-accent)] hover:underline"
                            >
                              全选
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateColumnFilter(cIdx, prev => ({
                                  ...prev,
                                  selectedValues: [],
                                }))
                              }
                              className="text-[var(--ov-text-muted)] hover:underline"
                            >
                              清空
                            </button>
                          </div>
                        </div>

                        <div className="max-h-40 overflow-y-auto border border-[var(--ov-border-subtle)] rounded bg-[var(--ov-bg)] p-1 space-y-0.5 custom-scrollbar">
                          {openFilterDistinctValues.length === 0 ? (
                            <div className="py-3 text-center text-[11px] text-[var(--ov-text-muted)]">
                              当前列暂无数据值
                            </div>
                          ) : (
                            openFilterDistinctValues.map(({ value: valToken, count }) => {
                              const currentSelected = columnFilters[cIdx]?.selectedValues;
                              const isChecked =
                                !Array.isArray(currentSelected) ||
                                currentSelected.includes(valToken);
                              return (
                                <label
                                  key={valToken}
                                  className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-[var(--ov-surface-hover)] cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        const checked = e.target.checked;
                                        const allTokens = openFilterDistinctValues.map(
                                          d => d.value
                                        );
                                        updateColumnFilter(cIdx, prev => {
                                          const baseList = Array.isArray(prev.selectedValues)
                                            ? prev.selectedValues
                                            : allTokens;
                                          const nextList = checked
                                            ? Array.from(new Set([...baseList, valToken]))
                                            : baseList.filter(item => item !== valToken);
                                          return {
                                            ...prev,
                                            selectedValues:
                                              nextList.length === allTokens.length
                                                ? null
                                                : nextList,
                                          };
                                        });
                                      }}
                                      className="rounded border-[var(--ov-border)]"
                                    />
                                    <span className="truncate">{valToken}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-[var(--ov-text-muted)] shrink-0">
                                    {count}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--ov-border-subtle)]">
                          <button
                            type="button"
                            onClick={() => {
                              updateColumnFilter(cIdx, () => null);
                              setOpenFilterCol(null);
                            }}
                            className="px-2 py-0.5 rounded text-[11px] border border-[var(--ov-border-subtle)] text-[var(--ov-text-secondary)] hover:bg-[var(--ov-surface-hover)]"
                          >
                            重置此列
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenFilterCol(null)}
                            style={{
                              backgroundColor: 'var(--ov-accent)',
                              color: '#ffffff',
                            }}
                            className="px-2.5 py-0.5 rounded text-[11px] font-medium"
                          >
                            确定
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRowIndices.map(rIdx => {
              const isRowActive = selectedCell.row === rIdx;
              const isHeaderRow = rIdx === 0;
              return (
                <tr
                  key={rIdx}
                  className="border-b border-[var(--ov-border-subtle)] hover:bg-[var(--ov-table-hover)]"
                >
                  {/* 左侧固定行号表头 */}
                  <td
                    style={{
                      width: `${ROW_HEADER_WIDTH}px`,
                      minWidth: `${ROW_HEADER_WIDTH}px`,
                      maxWidth: `${ROW_HEADER_WIDTH}px`,
                      left: '0px',
                    }}
                    className={`h-6 sticky left-0 z-20 font-mono text-[10px] text-center border-r border-[var(--ov-border)] truncate transition-colors ${
                      isRowActive
                        ? 'bg-[var(--ov-accent)] text-white font-bold'
                        : 'bg-[var(--ov-surface)] text-[var(--ov-text-muted)]'
                    }`}
                  >
                    {rIdx + 1}
                  </td>
                  {/* 数据单元格（支持单击选中、双击或按 Enter/F2 直接就地编辑、列冻结固定定位） */}
                  {Array.from({ length: colCount }).map((_, cIdx) => {
                    const isSelected = selectedCell.row === rIdx && selectedCell.col === cIdx;
                    const isCellEditing = isSelected && isEditing && editTarget === 'cell';
                    const { value, formula } = getCellValue(rIdx, cIdx);
                    const isNumber = value !== '' && !Number.isNaN(Number(value));
                    const isSearchMatch =
                      normalizedQuery !== '' &&
                      (value.toLowerCase().includes(normalizedQuery) ||
                        (formula ? formula.toLowerCase().includes(normalizedQuery) : false));

                    const frozenLeft = calculateFrozenColumnLeftOffset(
                      cIdx,
                      frozenColCount,
                      ROW_HEADER_WIDTH,
                      COL_WIDTH
                    );
                    const isFrozen = frozenLeft !== null;
                    const isLastFrozen = cIdx === frozenColCount - 1;

                    return (
                      <td
                        key={cIdx}
                        onClick={e => {
                          e.stopPropagation();
                          if (openFilterCol !== null) setOpenFilterCol(null);
                          if (showFreezeMenu) setShowFreezeMenu(false);
                          if (
                            editingSessionRef.current &&
                            (editingSessionRef.current.row !== rIdx ||
                              editingSessionRef.current.col !== cIdx)
                          ) {
                            commitCellEdit();
                          }
                          setSelectedCell({ row: rIdx, col: cIdx });
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          startCellEditing(rIdx, cIdx, undefined, 'cell');
                        }}
                        style={{
                          width: `${COL_WIDTH}px`,
                          minWidth: `${COL_WIDTH}px`,
                          maxWidth: `${COL_WIDTH}px`,
                          position: isFrozen ? 'sticky' : 'relative',
                          left: isFrozen ? `${frozenLeft}px` : undefined,
                          zIndex: isCellEditing ? 30 : isFrozen ? 15 : undefined,
                          backgroundColor: isSearchMatch
                            ? 'var(--ov-warning-soft, rgba(245, 158, 11, 0.2))'
                            : isFrozen
                              ? isHeaderRow
                                ? 'var(--ov-surface-header)'
                                : 'var(--ov-surface)'
                              : undefined,
                          borderRight: isLastFrozen
                            ? '2px solid var(--ov-accent)'
                            : '1px solid var(--ov-border-subtle)',
                        }}
                        className={`h-6 px-2 text-xs truncate cursor-cell transition-colors ${
                          isNumber && !isCellEditing ? 'text-right font-mono' : 'text-left'
                        } ${isHeaderRow && !isCellEditing ? 'font-semibold' : ''} ${
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
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onDoubleClick={e => e.stopPropagation()}
                            onChange={e => updateEditingText(e.target.value)}
                            onKeyDown={handleEditInputKeyDown}
                            onBlur={() => commitCellEdit()}
                            className="w-full h-full bg-[var(--ov-bg)] text-[var(--ov-text)] font-mono text-xs px-1 focus:outline-none select-text"
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
                  if (editingSessionRef.current) {
                    commitCellEdit();
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
          {frozenColCount > 0 && (
            <span className="text-[var(--ov-accent)] font-medium">
              已冻结前 {frozenColCount} 列
            </span>
          )}
          {activeFilterColCount > 0 && (
            <span className="text-[var(--ov-accent)] font-medium">
              已过滤 {activeFilterColCount} 列
            </span>
          )}
          {editCount > 0 && (
            <span className="text-[var(--ov-accent)] font-medium">
              已编辑 {editCount} 处
            </span>
          )}
          <span className="hidden sm:inline">
            提示: 双击单元格、按 Enter/F2 或在顶部 fx 栏输入即可编辑；点击列头图标可筛选或冻结列
          </span>
        </div>
      </div>
    </div>
  );
};

export default UniverSheetViewer;
