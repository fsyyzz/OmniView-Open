/**
 * Markdown 富交互数据表格组件 (TableBlock)
 * 支持智能多态排序、全文检索过滤、吸顶表头、行列十字交叉高亮、
 * 格式化多态复制 (Markdown/CSV)、全屏沉浸视口与原生微图表可视化 (Table to Chart)
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Copy,
  Check,
  Download,
  Maximize2,
  Minimize2,
  BarChart3,
  Table as TableIcon,
  Hash,
  X,
  Code,
  Pin,
  PinOff,
  RotateCcw,
} from 'lucide-react';
import {
  compareCellValues,
  formatRichCellContent,
  tableToCsv,
  tableToMarkdown,
  detectChartableColumns,
  parseNumericValue,
  calculateColStats,
} from './tableUtils';
import { TableChart } from './TableChart';
import { TableLightboxModal } from './TableLightboxModal';
import { Locale, t } from '../../../../../shared/lib/i18n';

export interface TableHeaderItem {
  text: string;
  tokens?: any[];
  align?: 'left' | 'center' | 'right' | null;
}

export interface TableRowItem {
  cells: Array<{
    text: string;
    tokens?: any[];
  }>;
}

export interface TableBlockProps {
  id: string;
  header: TableHeaderItem[];
  rows: TableRowItem[];
  align?: Array<'left' | 'center' | 'right' | null>;
  rawMarkdown: string;
  startLine?: number;
  endLine?: number;
  isDarkTheme?: boolean;
  locale?: Locale;
  onOpenSourceAtLine?: (line: number) => void;
}

export const TableBlock: React.FC<TableBlockProps> = React.memo(({
  id,
  header,
  rows,
  align,
  rawMarkdown,
  startLine,
  isDarkTheme = true,
  locale = 'zh-CN',
  onOpenSourceAtLine,
}) => {
  // 1. 状态矩阵
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [density, setDensity] = useState<'compact' | 'standard'>('compact');
  const [showRowNumbers, setShowRowNumbers] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedType, setCopiedType] = useState<'md' | 'csv' | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  // 单元格在线编辑状态 (双击单元格开启编辑)
  const [editedMatrix, setEditedMatrix] = useState<string[][] | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 提取纯文本表头与矩阵数据
  const headerTexts = useMemo(() => header.map(h => h.text || ''), [header]);
  const rawMatrix = useMemo(
    () => rows.map(r => r.cells.map(c => c.text || '')),
    [rows]
  );
  const currentMatrix = editedMatrix || rawMatrix;

  // 探测图表支持能力
  const chartableInfo = useMemo(() => {
    return detectChartableColumns(headerTexts, currentMatrix);
  }, [headerTexts, currentMatrix]);

  // 列数据类型预先探测 (用于对齐优化)
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
    const next = (editedMatrix || rawMatrix).map((r, rIdx) => {
      if (rIdx !== originalRowIdx) return [...r];
      const nextRow = [...r];
      nextRow[colIdx] = val;
      return nextRow;
    });
    setEditedMatrix(next);
    setEditingCell(null);
  };

  // 2. 检索与排序复合处理流水线
  const processedRows = useMemo(() => {
    let result = currentMatrix.map((row, originalIndex) => ({
      originalIndex,
      cells: row,
    }));

    // (1) 搜索过滤
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(item =>
        item.cells.some(cell => (cell || '').toLowerCase().includes(query))
      );
    }

    // (2) 列排序
    if (sortCol !== null && sortDir !== null) {
      result.sort((a, b) => {
        const cellA = a.cells[sortCol] || '';
        const cellB = b.cells[sortCol] || '';
        return compareCellValues(cellA, cellB, sortDir);
      });
    }

    return result;
  }, [currentMatrix, searchQuery, sortCol, sortDir]);

  // 3. 点击表头触发三态排序切换 (Asc -> Desc -> Reset)
  const handleToggleSort = (colIndex: number) => {
    if (sortCol !== colIndex) {
      setSortCol(colIndex);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  // 4. 复制处理
  const handleCopyMarkdown = async () => {
    try {
      const currentRows = processedRows.map(r => r.cells);
      const md = tableToMarkdown(headerTexts, currentRows, align);
      await navigator.clipboard.writeText(md || rawMarkdown);
      setCopiedType('md');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // 容错降级
      await navigator.clipboard.writeText(rawMarkdown);
      setCopiedType('md');
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleCopyCsv = async () => {
    try {
      const currentRows = processedRows.map(r => r.cells);
      const csv = tableToCsv(headerTexts, currentRows);
      await navigator.clipboard.writeText(csv);
      setCopiedType('csv');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  const handleExportCsvFile = () => {
    const currentRows = processedRows.map(r => r.cells);
    const csv = tableToCsv(headerTexts, currentRows);
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 5. 列宽自由拖拽与双击重置
  const handleResizeStart = (colIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement;
    const startWidth = th ? th.getBoundingClientRect().width : 120;
    resizingRef.current = { colIdx, startX: e.clientX, startWidth };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, Math.min(800, Math.round(resizingRef.current.startWidth + delta)));
      setColWidths(prev => ({ ...prev, [resizingRef.current!.colIdx]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetColWidth = (colIdx: number) => {
    setColWidths(prev => {
      const next = { ...prev };
      delete next[colIdx];
      return next;
    });
  };

  const handleResetAllColWidths = () => {
    setColWidths({});
  };

  // 6. 对齐样式计算
  const getColAlignmentClass = useCallback(
    (colIdx: number) => {
      const colAlign = align?.[colIdx] || header[colIdx]?.align;
      if (colAlign === 'center') return 'text-center';
      if (colAlign === 'right') return 'text-right';
      if (colAlign === 'left') return 'text-left';
      return isNumericColumn[colIdx] ? 'text-right font-mono' : 'text-left';
    },
    [align, header, isNumericColumn]
  );

  const hasCustomWidths = Object.keys(colWidths).length > 0;

  // 7. 表格内容主体渲染
  const renderTableContent = () => (
    <div className="w-full overflow-x-auto relative">
      <table
        className={`w-full border-collapse text-xs select-text ${
          hasCustomWidths ? 'table-fixed' : ''
        }`}
      >
        {/* 列宽定义 */}
        <colgroup>
          {showRowNumbers && <col style={{ width: '44px' }} />}
          {header.map((_, colIdx) => (
            <col
              key={colIdx}
              style={colWidths[colIdx] ? { width: `${colWidths[colIdx]}px` } : undefined}
            />
          ))}
        </colgroup>

        {/* 吸顶固定表头 */}
        <thead
          className="sticky top-0 z-10 transition-colors shadow-sm backdrop-blur-md border-b"
          style={{
            backgroundColor: 'var(--ov-table-th)',
            color: 'var(--ov-text)',
            borderColor: 'var(--ov-border)',
          }}
        >
          <tr>
            {/* 可选行号列 */}
            {showRowNumbers && (
              <th
                className="w-11 px-2 py-2 text-center font-mono text-[11px] border-r select-none"
                style={{
                  color: 'var(--ov-text-muted)',
                  borderColor: 'var(--ov-border)',
                  width: '44px',
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
                  className={`group/th relative px-3 py-2.5 font-semibold cursor-pointer select-none transition-colors border-r last:border-r-0 ${alignClass}`}
                  style={{
                    borderColor: 'var(--ov-border)',
                    backgroundColor: isColHovered ? 'var(--ov-surface-hover)' : undefined,
                    width: colWidth ? `${colWidth}px` : undefined,
                    minWidth: 60,
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
                    <span className={colWidth ? 'truncate' : ''}>{h.text}</span>
                    <span
                      className={`ov-table-sort-icon inline-flex transition-transform duration-200 ${
                        isSorted
                          ? 'opacity-100'
                          : 'opacity-0 group-hover/th:opacity-60'
                      }`}
                      style={{
                        color: isSorted ? 'var(--ov-accent)' : 'var(--ov-text-muted)',
                      }}
                      aria-hidden="true"
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

                  {/* 列宽自由拖拽 handle */}
                  <div
                    className="ov-col-resizer absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-20 flex items-center justify-center transition-opacity opacity-0 group-hover/th:opacity-100 hover:opacity-100"
                    onMouseDown={e => handleResizeStart(colIdx, e)}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      handleResetColWidth(colIdx);
                    }}
                    onClick={e => e.stopPropagation()}
                    title={t('tableResizeColTooltip', locale)}
                  >
                    <div
                      className="w-[1.5px] h-3.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--ov-border-strong, rgba(148, 163, 184, 0.6))',
                      }}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* 表格数据行 */}
        <tbody
          className="divide-y"
          style={{ borderColor: 'var(--ov-border)' }}
        >
          {processedRows.length === 0 ? (
            <tr>
              <td
                colSpan={header.length + (showRowNumbers ? 1 : 0)}
                className="px-4 py-8 text-center text-xs"
                style={{ color: 'var(--ov-text-muted)' }}
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
                  className="group/row transition-colors ov-table-row"
                  style={{
                    backgroundColor: isEven ? 'var(--ov-table-alt)' : 'transparent',
                  }}
                >
                  {/* 行号 */}
                  {showRowNumbers && (
                    <td
                      className="px-2 py-2 text-center font-mono text-[11px] border-r select-none"
                      style={{
                        color: 'var(--ov-text-muted)',
                        borderColor: 'var(--ov-border)',
                      }}
                    >
                      {rowIdx + 1}
                    </td>
                  )}
                  {/* 数据列 */}
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
                          density === 'compact' ? 'px-3 py-1.5' : 'px-3.5 py-2.5'
                        } ${isColHovered ? 'col-hovered' : ''} ${colWidth ? 'overflow-hidden text-ellipsis' : ''}`}
                        style={{
                          borderColor: 'var(--ov-border)',
                          backgroundColor: isEditing
                            ? 'var(--ov-surface-hover)'
                            : isColHovered
                            ? 'var(--ov-table-col-hover)'
                            : undefined,
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
                            className="w-full px-1.5 py-0.5 rounded text-xs border border-cyan-500 bg-[var(--ov-surface)] text-[var(--ov-text)] shadow-sm focus:outline-none"
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
  );

  const isToolbarActive =
    isPinned ||
    isSearchOpen ||
    searchQuery.trim().length > 0 ||
    viewMode === 'chart' ||
    isFullscreen;

  return (
    <div
      id={id}
      className="ov-table-block ov-table-wrapper rounded-lg border my-4 transition-all shadow-sm group relative"
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 顶部工具栏：与图表 diagram-header 同一套贴顶悬浮 Overlay */}
      <div
        className={`ov-table-block-toolbar table-block-toolbar flex flex-wrap items-center justify-between gap-2 text-xs select-none ${
          isToolbarActive ? 'is-active' : ''
        } ${isPinned ? 'is-pinned' : ''}`}
        style={{
          backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
          color: 'var(--ov-text)',
          borderColor: 'var(--ov-border)',
        }}
      >
        {/* 左侧：规模徽标、检索计数与源码直达 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] border"
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
          >
            <TableIcon className="w-3 h-3" style={{ color: 'var(--ov-accent)' }} />
            <span>
              {t('tableColsRows', locale)
                .replace('{cols}', String(header.length))
                .replace('{rows}', String(rows.length))}
            </span>
          </span>

          {searchQuery.trim().length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-500 text-[11px] font-medium">
              <span>
                {t('tableSearchMatches', locale)
                  .replace('{cur}', String(processedRows.length))
                  .replace('{total}', String(rows.length))}
              </span>
            </span>
          )}

          {startLine && onOpenSourceAtLine && (
            <button
              type="button"
              onClick={() => onOpenSourceAtLine(startLine)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-[11px]"
              style={{
                color: 'var(--ov-text-muted)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--ov-accent)';
                e.currentTarget.style.backgroundColor = 'var(--ov-surface-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--ov-text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={`Jump to line ${startLine}`}
            >
              <Code className="w-3 h-3" />
              <span>L{startLine}</span>
            </button>
          )}
        </div>

        {/* 右侧功能按钮族 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 内联搜索框 */}
          {isSearchOpen ? (
            <div
              className="flex items-center gap-1 border rounded px-2 py-0.5"
              style={{
                backgroundColor: 'var(--ov-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: 'var(--ov-text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('tableSearchPlaceholder', locale)}
                autoFocus
                className="bg-transparent text-xs focus:outline-none w-32 sm:w-44"
                style={{ color: 'var(--ov-text)' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ color: 'var(--ov-text-muted)' }}
                  className="hover:opacity-100 opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                style={{ color: 'var(--ov-text-muted)' }}
                className="hover:opacity-100 opacity-70 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="ov-table-btn p-1.5 rounded transition-colors"
              title={t('tableSearchPlaceholder', locale)}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 表格与图表视图切换 (仅在具备数值列时展示) */}
          {chartableInfo && (
            <button
              type="button"
              onClick={() => setViewMode(v => (v === 'table' ? 'chart' : 'table'))}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-[11px] ${
                viewMode === 'chart'
                  ? 'text-white shadow-sm'
                  : 'ov-table-btn'
              }`}
              style={{
                backgroundColor: viewMode === 'chart' ? 'var(--ov-accent)' : undefined,
              }}
              title={
                viewMode === 'table'
                  ? t('tableViewModeChart', locale)
                  : t('tableViewModeTable', locale)
              }
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
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
            className={`p-1.5 rounded transition-colors ${
              showRowNumbers ? 'border' : 'ov-table-btn'
            }`}
            style={
              showRowNumbers
                ? {
                    backgroundColor: 'var(--ov-surface-hover)',
                    color: 'var(--ov-accent)',
                    borderColor: 'var(--ov-accent)',
                  }
                : undefined
            }
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
            className="ov-table-btn px-2 py-1 rounded transition-colors text-[11px]"
            title={
              density === 'compact'
                ? t('tableDensityStandard', locale)
                : t('tableDensityCompact', locale)
            }
          >
            {density === 'compact' ? '紧凑' : '舒适'}
          </button>

          {/* 重置自定义列宽 */}
          {hasCustomWidths && (
            <button
              type="button"
              onClick={handleResetAllColWidths}
              className="ov-table-btn flex items-center gap-1 px-2 py-1 rounded transition-colors text-[11px] text-cyan-400 hover:text-cyan-300"
              title={t('tableResetColWidths', locale)}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('tableResetColWidths', locale)}</span>
            </button>
          )}

          {/* 复制 Markdown */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="ov-table-btn flex items-center gap-1 px-2 py-1 rounded transition-colors text-[11px]"
            title={t('tableCopyMarkdown', locale)}
          >
            {copiedType === 'md' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 hidden sm:inline">{t('copied', locale)}</span>
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
            className="ov-table-btn flex items-center gap-1 px-2 py-1 rounded transition-colors text-[11px]"
            title={t('tableCopyCsv', locale)}
          >
            {copiedType === 'csv' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 hidden sm:inline">{t('copied', locale)}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </>
            )}
          </button>

          {/* 下载 CSV 文件 */}
          <button
            type="button"
            onClick={handleExportCsvFile}
            className="ov-table-btn p-1.5 rounded transition-colors"
            title={t('tableExportCsv', locale)}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* 全屏查看 */}
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="ov-table-btn p-1.5 rounded transition-colors"
            title={t('tableFullscreen', locale)}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* 图钉锁定 / 悬浮自动隐藏切换 */}
          <button
            type="button"
            onClick={() => setIsPinned(p => !p)}
            className={`p-1.5 rounded transition-colors ${
              isPinned ? 'border' : 'ov-table-btn'
            }`}
            style={
              isPinned
                ? {
                    backgroundColor: 'var(--ov-surface-hover)',
                    color: 'var(--ov-accent)',
                    borderColor: 'var(--ov-accent)',
                  }
                : undefined
            }
            title={isPinned ? t('tableUnpin', locale) : t('tablePin', locale)}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5 rotate-45" style={{ color: 'var(--ov-accent)' }} /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 主展示区：横向滚动与工具栏分离，避免裁切贴顶悬浮栏 */}
      <div className="ov-table-body">
        {viewMode === 'chart' && chartableInfo ? (
          <TableChart
            headers={headerTexts}
            rows={processedRows.map(r => r.cells)}
            defaultLabelCol={chartableInfo.labelColIndex}
            defaultValueCols={chartableInfo.valueColIndices}
            isDarkTheme={isDarkTheme}
            locale={locale}
          />
        ) : (
          renderTableContent()
        )}
      </div>

      {/* 底部统计分析栏 (展示行数、数值列合计与均值、双击编辑提示) */}
      <div
        className="flex items-center justify-between px-3.5 py-1.5 border-t text-[11px] select-none gap-2 flex-wrap"
        style={{
          borderColor: 'var(--ov-border)',
          backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
          color: 'var(--ov-text-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <span>
            {t('tableTotalRows', locale)}: <strong className="font-mono text-[var(--ov-text)]">{processedRows.length}</strong>
          </span>
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
        <div className="text-[10px]" style={{ color: 'var(--ov-text-muted)' }}>
          {t('tableDblClickEdit', locale)}
        </div>
      </div>

      {/* 全屏沉浸灯箱 Modal (Portal 渲染至 document.body) */}
      <TableLightboxModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        header={header.map(h => ({ text: h.text, align: h.align }))}
        rows={currentMatrix.map(cells => ({ cells }))}
        align={align}
        rawMarkdown={rawMarkdown}
        startLine={startLine}
        isDarkTheme={isDarkTheme}
        locale={locale}
        onOpenSourceAtLine={onOpenSourceAtLine}
        initialSearchQuery={searchQuery}
        initialSortCol={sortCol}
        initialSortDir={sortDir}
        initialDensity={density}
        initialShowRowNumbers={showRowNumbers}
        initialViewMode={viewMode}
      />
    </div>
  );
});

TableBlock.displayName = 'TableBlock';
