/**
 * OmniView 表格全屏沉浸灯箱视口 (TableLightboxModal)
 * 采用 React Portal 脱离父级容器渲染至 document.body，彻底解决 CSS Containment/Transform 导致的局部受限问题
 * 提供全尺寸视口、吸顶多列排序、即时全文检索高亮、列宽拖拽、多格式导出、图表模式切换与快捷键支持
 * 
 * 作者: 周赞
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Table as TableIcon,
  Search,
  X,
  Minimize2,
  Copy,
  Check,
  Download,
  BarChart3,
  Hash,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Code,
  SlidersHorizontal,
  FileSpreadsheet,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import {
  compareCellValues,
  formatRichCellContent,
  tableToCsv,
  tableToTsv,
  tableToMarkdown,
  copyTableToRichClipboard,
  detectChartableColumns,
  parseNumericValue,
  calculateColStats,
} from './tableUtils';
import { TableChart } from './TableChart';

export interface TableHeaderItem {
  text: string;
  header?: boolean;
  align?: 'left' | 'center' | 'right' | null;
}

export interface TableRowItem {
  cells: string[];
}

export interface TableLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  header: TableHeaderItem[];
  rows: TableRowItem[];
  align?: Array<'left' | 'center' | 'right' | null>;
  rawMarkdown?: string;
  startLine?: number;
  isDarkTheme?: boolean;
  locale?: Locale;
  onOpenSourceAtLine?: (line: number) => void;
  initialSearchQuery?: string;
  initialSortCol?: number | null;
  initialSortDir?: 'asc' | 'desc' | null;
  initialDensity?: 'compact' | 'standard';
  initialShowRowNumbers?: boolean;
  initialViewMode?: 'table' | 'chart';
}

export const TableLightboxModal: React.FC<TableLightboxModalProps> = ({
  isOpen,
  onClose,
  header,
  rows,
  align = [],
  rawMarkdown,
  startLine,
  isDarkTheme = true,
  locale = 'zh-CN',
  onOpenSourceAtLine,
  initialSearchQuery = '',
  initialSortCol = null,
  initialSortDir = null,
  initialDensity = 'standard',
  initialShowRowNumbers = true,
  initialViewMode = 'table',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortCol, setSortCol] = useState<number | null>(initialSortCol);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(initialSortDir);
  const [density, setDensity] = useState<'compact' | 'standard'>(initialDensity);
  const [showRowNumbers, setShowRowNumbers] = useState<boolean>(initialShowRowNumbers);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>(initialViewMode);
  const [copiedType, setCopiedType] = useState<'md' | 'csv' | 'rich' | 'tsv' | null>(null);
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = useState<{ index: number; startX: number; startWidth: number } | null>(null);

  // 单元格在线编辑状态 (双击单元格开启编辑)
  const [editedMatrix, setEditedMatrix] = useState<string[][] | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // ESC 快捷键监听
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 列宽调整全局鼠标事件监听
  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(60, resizingCol.startWidth + deltaX);
      setColWidths(prev => ({
        ...prev,
        [resizingCol.index]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // 1. 图表模式可用性检测
  const headerTexts = useMemo(() => header.map(h => h.text), [header]);
  const rawRowCells = useMemo(() => rows.map(r => r.cells), [rows]);
  const currentMatrix = editedMatrix || rawRowCells;

  const chartableInfo = useMemo(() => {
    return detectChartableColumns(headerTexts, currentMatrix);
  }, [headerTexts, currentMatrix]);

  // 列数据类型预先探测 (用于对齐与统计)
  const isNumericColumn = useMemo(() => {
    return headerTexts.map((_, colIdx) => {
      let numCount = 0;
      let totalCount = 0;
      for (const row of currentMatrix) {
        const val = row[colIdx];
        if (val !== undefined && val.trim().length > 0) {
          totalCount++;
          if (parseNumericValue(val) !== null) numCount++;
        }
      }
      return totalCount > 0 && numCount / totalCount >= 0.7;
    });
  }, [headerTexts, currentMatrix]);

  // 保存单元格内联编辑
  const handleSaveCellEdit = (originalRowIdx: number, colIdx: number, val: string) => {
    const next = (editedMatrix || rawRowCells).map((r, rIdx) => {
      if (rIdx !== originalRowIdx) return [...r];
      const nextRow = [...r];
      nextRow[colIdx] = val;
      return nextRow;
    });
    setEditedMatrix(next);
    setEditingCell(null);
  };

  // 2. 检索与排序处理行
  const processedRows = useMemo(() => {
    let result = currentMatrix.map((cells, idx) => ({
      cells,
      originalIndex: idx,
    }));

    // 全文检索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(row =>
        row.cells.some(cell => cell.toLowerCase().includes(q))
      );
    }

    // 多态列排序
    if (sortCol !== null && sortDir) {
      result.sort((a, b) => {
        const valA = a.cells[sortCol] || '';
        const valB = b.cells[sortCol] || '';
        return compareCellValues(valA, valB, sortDir);
      });
    }

    return result;
  }, [currentMatrix, searchQuery, sortCol, sortDir]);

  // 3. 排序切换
  const handleToggleSort = (colIdx: number) => {
    if (sortCol !== colIdx) {
      setSortCol(colIdx);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  // 4. 复制富文本 (直贴 Word / Excel 原生表格)
  const handleCopyRich = async () => {
    try {
      const aligns = header.map((h, i) => align[i] || h.align || null);
      const res = await copyTableToRichClipboard(headerTexts, rawRowCells, aligns);
      if (res.success) {
        setCopiedType('rich');
        setTimeout(() => setCopiedType(null), 2000);
      } else {
        await handleCopyMarkdown();
      }
    } catch {
      await handleCopyMarkdown();
    }
  };

  // 5. 复制 Markdown
  const handleCopyMarkdown = async () => {
    let md = rawMarkdown;
    if (!md) {
      const headerLine = `| ${header.map(h => h.text).join(' | ')} |`;
      const alignLine = `| ${header.map((_, i) => (align[i] === 'center' ? ':---:' : align[i] === 'right' ? '---:' : ':---')).join(' | ')} |`;
      const bodyLines = rows.map(r => `| ${r.cells.join(' | ')} |`).join('\n');
      md = `${headerLine}\n${alignLine}\n${bodyLines}`;
    }
    try {
      await navigator.clipboard.writeText(md);
      setCopiedType('md');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  // 5. 复制 CSV
  const handleCopyCsv = async () => {
    const csv = tableToCsv(headerTexts, rawRowCells);
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedType('csv');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  // 6. 下载 CSV 文件
  const handleExportCsvFile = () => {
    const csv = tableToCsv(headerTexts, rawRowCells);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 7. 列对齐 class
  const getColAlignmentClass = (colIdx: number): string => {
    const explicitAlign = align[colIdx] || header[colIdx]?.align;
    if (explicitAlign === 'center') return 'text-center';
    if (explicitAlign === 'right') return 'text-right';
    return 'text-left';
  };

  const hasCustomWidths = Object.keys(colWidths).length > 0;

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-950/92 backdrop-blur-md flex flex-col animate-fadeIn select-text">
      {/* 顶部全功能导航与控制栏 */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b shadow-lg z-20 flex-wrap gap-2"
        style={{
          backgroundColor: 'var(--ov-surface-header, rgba(15,23,42,0.9))',
          borderColor: 'var(--ov-border, rgba(51,65,85,0.7))',
          color: 'var(--ov-text, #f8fafc)',
        }}
      >
        {/* 左侧：标题、维度统计与源码跳转 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <TableIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm">
                {t('tableFullscreenImmersive', locale)}
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs opacity-70 font-mono">
                ({header.length} 列 × {rows.length} 行)
              </span>
            </div>
          </div>

          {searchQuery && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px]">
              匹配 {processedRows.length} / {rows.length}
            </span>
          )}

          {startLine && onOpenSourceAtLine && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSourceAtLine(startLine);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition"
              title={`Jump to line ${startLine}`}
            >
              <Code className="w-3 h-3" />
              <span>L{startLine}</span>
            </button>
          )}
        </div>

        {/* 右侧：搜索与工具族 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 实时搜索框 */}
          <div
            className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs shadow-inner"
            style={{
              backgroundColor: 'var(--ov-bg, rgba(2,6,23,0.8))',
              borderColor: 'var(--ov-border, rgba(51,65,85,0.8))',
              color: 'var(--ov-text, #f8fafc)',
            }}
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('tableSearchPlaceholder', locale)}
              autoFocus
              className="bg-transparent text-xs focus:outline-none w-36 sm:w-56"
              style={{ color: 'var(--ov-text, #f8fafc)' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="hover:opacity-100 opacity-60 text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 表格与图表视图切换 */}
          {chartableInfo && (
            <button
              type="button"
              onClick={() => setViewMode(v => (v === 'table' ? 'chart' : 'table'))}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium ${
                viewMode === 'chart'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>
                {viewMode === 'table'
                  ? t('tableViewModeChart', locale)
                  : t('tableViewModeTable', locale)}
              </span>
            </button>
          )}

          {/* 行号显示切换 */}
          <button
            type="button"
            onClick={() => setShowRowNumbers(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${
              showRowNumbers
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title={
              showRowNumbers
                ? t('tableHideRowNumbers', locale)
                : t('tableShowRowNumbers', locale)
            }
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          {/* 紧凑度切换 */}
          <button
            type="button"
            onClick={() =>
              setDensity(d => (d === 'compact' ? 'standard' : 'compact'))
            }
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
          >
            {density === 'compact' ? '紧凑' : '舒适'}
          </button>

          {/* 重置自定义列宽 */}
          {hasCustomWidths && (
            <button
              type="button"
              onClick={() => setColWidths({})}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-cyan-400 border border-slate-700 transition"
              title={t('tableResetColWidths', locale)}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('tableResetColWidths', locale)}</span>
            </button>
          )}

          {/* 复制富文本 (直贴 Word / Excel 原生表格) */}
          <button
            type="button"
            onClick={handleCopyRich}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
            title={t('tableCopyRich', locale)}
          >
            {copiedType === 'rich' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden sm:inline">{t('copiedRich', locale)}</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Word/Excel</span>
              </>
            )}
          </button>

          {/* 复制 Markdown */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
            title={t('tableCopyMarkdown', locale)}
          >
            {copiedType === 'md' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden sm:inline">{t('copied', locale)}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">MD</span>
              </>
            )}
          </button>

          {/* 复制 CSV */}
          <button
            type="button"
            onClick={handleCopyCsv}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
            title={t('tableCopyCsv', locale)}
          >
            {copiedType === 'csv' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden sm:inline">{t('copied', locale)}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </>
            )}
          </button>

          {/* 导出 CSV */}
          <button
            type="button"
            onClick={handleExportCsvFile}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={t('tableExportCsv', locale)}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* 退出全屏 */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 border border-rose-700/60 text-xs font-medium transition shadow-sm ml-1"
            title={t('exitFullscreen', locale)}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Esc</span>
          </button>
        </div>
      </div>

      {/* 主视口工作区 */}
      <div
        className="flex-1 overflow-auto p-4 sm:p-6"
        style={{
          backgroundColor: 'var(--ov-bg, #090d16)',
          color: 'var(--ov-text, #f8fafc)',
        }}
      >
        {viewMode === 'chart' && chartableInfo ? (
          <div className="max-w-5xl mx-auto py-4">
            <TableChart
              headers={headerTexts}
              rows={processedRows.map(r => r.cells)}
              defaultLabelCol={chartableInfo.labelColIndex}
              defaultValueCols={chartableInfo.valueColIndices}
              isDarkTheme={isDarkTheme}
              locale={locale}
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto relative rounded-xl border border-slate-800 shadow-2xl bg-slate-900/60">
            <table
              className={`w-full border-collapse text-xs select-text ${
                hasCustomWidths ? 'table-fixed' : ''
              }`}
            >
              {/* 列宽定义 */}
              <colgroup>
                {showRowNumbers && <col style={{ width: '50px' }} />}
                {header.map((_, colIdx) => (
                  <col
                    key={colIdx}
                    style={colWidths[colIdx] ? { width: `${colWidths[colIdx]}px` } : undefined}
                  />
                ))}
              </colgroup>

              {/* 吸顶固定表头 */}
              <thead
                className="sticky top-0 z-10 shadow-md backdrop-blur-md border-b"
                style={{
                  backgroundColor: 'var(--ov-table-th, rgba(15,23,42,0.95))',
                  color: 'var(--ov-text, #f8fafc)',
                  borderColor: 'var(--ov-border, rgba(51,65,85,0.8))',
                }}
              >
                <tr>
                  {showRowNumbers && (
                    <th
                      className="w-12 px-3 py-3 text-center font-mono text-xs border-r select-none"
                      style={{
                        color: 'var(--ov-text-muted, #94a3b8)',
                        borderColor: 'var(--ov-border, rgba(51,65,85,0.8))',
                        width: '50px',
                      }}
                    >
                      #
                    </th>
                  )}
                  {header.map((h, colIdx) => {
                    const isSorted = sortCol === colIdx;
                    const alignClass = getColAlignmentClass(colIdx);
                    const isColHovered = hoveredColIndex === colIdx;
                    const colWidth = colWidths[colIdx];
                    const sortTitle = !isSorted
                      ? t('tableSortNone', locale)
                      : sortDir === 'asc'
                      ? t('tableSortAsc', locale)
                      : t('tableSortDesc', locale);

                    return (
                      <th
                        key={colIdx}
                        onClick={() => handleToggleSort(colIdx)}
                        onMouseEnter={() => setHoveredColIndex(colIdx)}
                        onMouseLeave={() => setHoveredColIndex(null)}
                        title={sortTitle}
                        className={`group/th relative px-4 py-3 font-semibold cursor-pointer select-none transition-colors border-r last:border-r-0 ${alignClass}`}
                        style={{
                          borderColor: 'var(--ov-border, rgba(51,65,85,0.8))',
                          backgroundColor: isColHovered ? 'var(--ov-surface-hover, rgba(30,41,59,0.8))' : undefined,
                          width: colWidth ? `${colWidth}px` : undefined,
                          minWidth: 80,
                        }}
                      >
                        <div
                          className={`inline-flex items-center gap-1.5 ${
                            alignClass.includes('text-right')
                              ? 'flex-row-reverse justify-start'
                              : alignClass.includes('text-center')
                              ? 'justify-center'
                              : 'justify-start'
                          }`}
                        >
                          <span className={colWidth ? 'truncate text-sm' : 'text-sm'}>{h.text}</span>
                          <span
                            className={`ov-table-sort-icon inline-flex transition-transform duration-200 ${
                              isSorted
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/th:opacity-60'
                            }`}
                            style={{
                              color: isSorted ? 'var(--ov-accent, #38bdf8)' : 'var(--ov-text-muted, #94a3b8)',
                            }}
                          >
                            {isSorted && sortDir === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5" />
                            ) : isSorted && sortDir === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3" />
                            )}
                          </span>
                        </div>

                        {/* 列宽拖拽 Handle */}
                        <div
                          className="ov-col-resizer absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-20 flex items-center justify-center transition-opacity opacity-0 group-hover/th:opacity-100 hover:opacity-100"
                          onMouseDown={e => {
                            e.stopPropagation();
                            const th = (e.currentTarget.parentElement as HTMLElement);
                            const startWidth = th.offsetWidth;
                            setResizingCol({
                              index: colIdx,
                              startX: e.clientX,
                              startWidth,
                            });
                          }}
                          onDoubleClick={e => {
                            e.stopPropagation();
                            setColWidths(prev => {
                              const next = { ...prev };
                              delete next[colIdx];
                              return next;
                            });
                          }}
                          title={t('tableResizeColTooltip', locale)}
                        >
                          <div
                            className="w-[2px] h-4 rounded-full bg-slate-500 hover:bg-cyan-400 transition"
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* 数据行 */}
              <tbody
                className="divide-y"
                style={{ borderColor: 'var(--ov-border, rgba(51,65,85,0.7))' }}
              >
                {processedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={header.length + (showRowNumbers ? 1 : 0)}
                      className="px-6 py-12 text-center text-sm"
                      style={{ color: 'var(--ov-text-muted, #94a3b8)' }}
                    >
                      {searchQuery ? t('csvNoData', locale) : 'No table data'}
                    </td>
                  </tr>
                ) : (
                  processedRows.map((rowItem, rowIdx) => {
                    const isEven = rowIdx % 2 === 1;
                    return (
                      <tr
                        key={rowItem.originalIndex}
                        className="group/row transition-colors hover:bg-slate-800/60"
                        style={{
                          backgroundColor: isEven ? 'rgba(30, 41, 59, 0.35)' : 'transparent',
                        }}
                      >
                        {showRowNumbers && (
                          <td
                            className="px-3 py-2.5 text-center font-mono text-xs border-r select-none"
                            style={{
                              color: 'var(--ov-text-muted, #94a3b8)',
                              borderColor: 'var(--ov-border, rgba(51,65,85,0.7))',
                            }}
                          >
                            {rowIdx + 1}
                          </td>
                        )}
                        {rowItem.cells.map((cellText, colIdx) => {
                          const alignClass = getColAlignmentClass(colIdx);
                          const formattedHtml = formatRichCellContent(
                            cellText,
                            searchQuery
                          );
                          const isColHovered = hoveredColIndex === colIdx;
                          const colWidth = colWidths[colIdx];
                          const isEditing =
                            editingCell?.rowIdx === rowItem.originalIndex &&
                            editingCell?.colIdx === colIdx;

                          return (
                            <td
                              key={colIdx}
                              onMouseEnter={() => setHoveredColIndex(colIdx)}
                              onMouseLeave={() => setHoveredColIndex(null)}
                              onDoubleClick={() => {
                                setEditingCell({
                                  rowIdx: rowItem.originalIndex,
                                  colIdx,
                                });
                                setEditValue(cellText);
                              }}
                              className={`transition-colors border-r last:border-r-0 cursor-pointer ${alignClass} ${
                                density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
                              } ${isColHovered ? 'bg-slate-800/40' : ''} ${colWidth ? 'overflow-hidden text-ellipsis' : ''}`}
                              style={{
                                borderColor: 'var(--ov-border, rgba(51,65,85,0.7))',
                                maxWidth: colWidth ? `${colWidth}px` : undefined,
                              }}
                              title={t('tableDblClickEdit', locale)}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleSaveCellEdit(
                                        rowItem.originalIndex,
                                        colIdx,
                                        editValue
                                      );
                                    } else if (e.key === 'Escape') {
                                      setEditingCell(null);
                                    }
                                  }}
                                  onBlur={() =>
                                    handleSaveCellEdit(
                                      rowItem.originalIndex,
                                      colIdx,
                                      editValue
                                    )
                                  }
                                  className="w-full px-2 py-0.5 rounded text-xs border border-cyan-500 bg-slate-900 text-slate-100 shadow-sm focus:outline-none"
                                />
                              ) : (
                                <div dangerouslySetInnerHTML={{ __html: formattedHtml }} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between px-6 py-2.5 border-t border-slate-800 bg-slate-900/70 text-[11px] text-slate-400 backdrop-blur-sm z-20 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span>{t('tableTotalRows', locale)}: <strong className="font-mono text-slate-200">{processedRows.length}</strong></span>
          {hoveredColIndex !== null && isNumericColumn[hoveredColIndex] && (
            <span className="flex items-center gap-2 font-mono text-[11px]">
              <span>[{headerTexts[hoveredColIndex]}]:</span>
              <span>
                {t('tableSum', locale)}: <strong className="text-cyan-400">{calculateColStats(currentMatrix, hoveredColIndex).sum}</strong>
              </span>
              <span>
                {t('tableAvg', locale)}: <strong className="text-emerald-400">{calculateColStats(currentMatrix, hoveredColIndex).avg}</strong>
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-slate-500 hidden sm:flex">
          <span>{t('tableDblClickEdit', locale)}</span>
          <span>{t('tableDragResize', locale)}</span>
          <span>按 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Esc</kbd> 退出全屏</span>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
