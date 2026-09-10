/**
 * Markdown 富交互数据表格组件 (TableBlock)
 * 支持智能多态排序、全文检索过滤、吸顶表头、行列十字交叉高亮、
 * 格式化多态复制 (Markdown/CSV)、全屏沉浸视口与原生微图表可视化 (Table to Chart)
 */
import React, { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import {
  compareCellValues,
  formatRichCellContent,
  tableToCsv,
  tableToMarkdown,
  detectChartableColumns,
  parseNumericValue,
} from './tableUtils';
import { TableChart } from './TableChart';
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

export const TableBlock: React.FC<TableBlockProps> = ({
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

  // 提取纯文本表头与矩阵数据
  const headerTexts = useMemo(() => header.map(h => h.text || ''), [header]);
  const rawMatrix = useMemo(
    () => rows.map(r => r.cells.map(c => c.text || '')),
    [rows]
  );

  // 探测图表支持能力
  const chartableInfo = useMemo(() => {
    return detectChartableColumns(headerTexts, rawMatrix);
  }, [headerTexts, rawMatrix]);

  // 列数据类型预先探测 (用于对齐优化)
  const isNumericColumn = useMemo(() => {
    return headerTexts.map((_, colIdx) => {
      let numCount = 0;
      let totalCount = 0;
      for (const row of rawMatrix) {
        const val = row[colIdx];
        if (val !== undefined && val.trim().length > 0) {
          totalCount++;
          if (parseNumericValue(val) !== null) numCount++;
        }
      }
      return totalCount > 0 && numCount / totalCount >= 0.7;
    });
  }, [headerTexts, rawMatrix]);

  // 2. 检索与排序复合处理流水线
  const processedRows = useMemo(() => {
    let result = rawMatrix.map((row, originalIndex) => ({
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
  }, [rawMatrix, searchQuery, sortCol, sortDir]);

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

  // 5. 对齐样式计算
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

  // 6. 表格内容主体渲染
  const renderTableContent = () => (
    <div className="w-full overflow-x-auto relative">
      <table className="w-full border-collapse text-xs select-text">
        {/* 吸顶固定表头 */}
        <thead
          className={`sticky top-0 z-10 transition-colors shadow-sm ${
            isDarkTheme
              ? 'bg-slate-900/95 backdrop-blur-md text-slate-200 border-b border-slate-700'
              : 'bg-slate-100/95 backdrop-blur-md text-slate-800 border-b border-slate-300'
          }`}
        >
          <tr>
            {/* 可选行号列 */}
            {showRowNumbers && (
              <th className="w-10 px-2 py-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-700/40 select-none">
                #
              </th>
            )}
            {header.map((h, colIdx) => {
              const isSorted = sortCol === colIdx;
              const alignClass = getColAlignmentClass(colIdx);
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
                  className={`group px-3 py-2.5 font-semibold cursor-pointer select-none transition-colors border-r last:border-r-0 border-slate-700/30 ${alignClass} ${
                    hoveredColIndex === colIdx
                      ? isDarkTheme
                        ? 'bg-slate-800/80'
                        : 'bg-slate-200/80'
                      : ''
                  }`}
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
                    <span>{h.text}</span>
                    <span
                      className={`inline-flex transition-transform duration-200 ${
                        isSorted
                          ? 'text-blue-400 opacity-100'
                          : 'text-slate-400 opacity-0 group-hover:opacity-60'
                      }`}
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
                </th>
              );
            })}
          </tr>
        </thead>

        {/* 表格数据行 */}
        <tbody className="divide-y divide-slate-700/30">
          {processedRows.length === 0 ? (
            <tr>
              <td
                colSpan={header.length + (showRowNumbers ? 1 : 0)}
                className="px-4 py-8 text-center text-slate-400 text-xs"
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
                  className={`group/row transition-colors ${
                    isEven
                      ? isDarkTheme
                        ? 'bg-slate-900/40 hover:bg-blue-950/30'
                        : 'bg-slate-50/60 hover:bg-blue-50/60'
                      : isDarkTheme
                      ? 'bg-transparent hover:bg-blue-950/30'
                      : 'bg-white hover:bg-blue-50/60'
                  }`}
                >
                  {/* 行号 */}
                  {showRowNumbers && (
                    <td className="px-2 py-2 text-center text-slate-500 font-mono text-[11px] border-r border-slate-700/30 select-none">
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

                    return (
                      <td
                        key={colIdx}
                        onMouseEnter={() => setHoveredColIndex(colIdx)}
                        onMouseLeave={() => setHoveredColIndex(null)}
                        className={`transition-colors border-r last:border-r-0 border-slate-700/20 ${alignClass} ${
                          density === 'compact' ? 'px-3 py-1.5' : 'px-3.5 py-2.5'
                        } ${
                          isColHovered
                            ? isDarkTheme
                              ? 'bg-blue-900/10'
                              : 'bg-blue-100/30'
                            : ''
                        }`}
                        dangerouslySetInnerHTML={{ __html: formattedHtml }}
                      />
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
      className={`ov-table-block ov-table-wrapper rounded-lg border my-4 overflow-hidden transition-all shadow-sm group relative ${
        isDarkTheme
          ? 'bg-slate-950/70 border-slate-800 text-slate-200'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* 顶部交互操作胶囊工具栏：移动上去才平滑浮现显示 */}
      <div
        className={`ov-table-block-toolbar table-block-toolbar flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b text-xs select-none transition-colors ${
          isToolbarActive ? 'is-active' : ''
        } ${isPinned ? 'is-pinned' : ''} ${
          isDarkTheme
            ? 'bg-slate-900/90 border-slate-800 text-slate-300'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {/* 左侧：规模徽标、检索计数与源码直达 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/70 font-mono text-[11px] text-slate-300">
            <TableIcon className="w-3 h-3 text-blue-400" />
            <span>
              {t('tableColsRows', locale)
                .replace('{cols}', String(header.length))
                .replace('{rows}', String(rows.length))}
            </span>
          </span>

          {searchQuery.trim().length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px]">
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
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800/60 transition-colors text-[11px]"
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
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded px-2 py-0.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('tableSearchPlaceholder', locale)}
                autoFocus
                className="bg-transparent text-xs text-slate-200 focus:outline-none w-32 sm:w-44"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white"
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
                className="text-slate-400 hover:text-white ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={
                viewMode === 'table'
                  ? t('tableViewModeChart', locale)
                  : t('tableViewModeTable', locale)
              }
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
            className={`p-1.5 rounded transition-colors ${
              showRowNumbers
                ? 'bg-slate-700/80 text-blue-400'
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
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
            className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
            title={
              density === 'compact'
                ? t('tableDensityStandard', locale)
                : t('tableDensityCompact', locale)
            }
          >
            {density === 'compact' ? '紧凑' : '舒适'}
          </button>

          {/* 复制 Markdown */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
            title={t('tableCopyMarkdown', locale)}
          >
            {copiedType === 'md' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{t('copied', locale)}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>MD</span>
              </>
            )}
          </button>

          {/* 复制 CSV */}
          <button
            type="button"
            onClick={handleCopyCsv}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
            title={t('tableCopyCsv', locale)}
          >
            {copiedType === 'csv' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{t('copied', locale)}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>CSV</span>
              </>
            )}
          </button>

          {/* 下载 CSV 文件 */}
          <button
            type="button"
            onClick={handleExportCsvFile}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={t('tableExportCsv', locale)}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* 全屏查看 */}
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={t('tableFullscreen', locale)}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* 图钉锁定 / 悬浮自动隐藏切换 */}
          <button
            type="button"
            onClick={() => setIsPinned(p => !p)}
            className={`p-1.5 rounded transition-colors ${
              isPinned
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={isPinned ? t('tableUnpin', locale) : t('tablePin', locale)}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5 rotate-45 text-blue-400" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 主展示区：图表模式 vs 表格模式 */}
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

      {/* 全屏放大 Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col p-4 sm:p-6 animate-in fade-in duration-150">
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-t-lg border-b ${
              isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-sm">
                {t('tableFullscreen', locale)} ({header.length} 列 × {rows.length} 行)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={t('closeFullScreen', locale)}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
          <div
            className={`flex-1 overflow-auto p-4 rounded-b-lg ${
              isDarkTheme ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'
            }`}
          >
            {renderTableContent()}
          </div>
        </div>
      )}
    </div>
  );
};
