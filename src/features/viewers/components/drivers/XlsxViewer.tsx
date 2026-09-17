/**
 * OmniView 原生专业 Excel (.xlsx / .xls) 纯前端离线工作簿工作台 (XlsxViewer)
 * 基于 OOXML 架构与 JSZip 离线解包管道
 * 支持多工作表 (Multi-Sheet Tabs)、公式/计算值检视、数据搜索与排序列、列特征画像 (Profiling) 及 CSV/JSON/Markdown 导出
 * 
 * 作者: 周赞
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileSpreadsheet,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  Info,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart2,
  Table,
  Layers,
  X,
  FileText,
  Code,
  CheckCheck,
} from 'lucide-react';
import {
  parseXlsx,
  exportSheetToCsv,
  exportSheetToJson,
  exportSheetToMarkdown,
  indexToColLetter,
  type ParsedXlsxWorkbook,
  type XlsxWorksheet,
} from '../../lib/xlsxEngine';
import { profileAllColumns, ColumnProfile } from './csv/csvProfiling';
import { ColumnProfileModal } from './csv/ColumnProfileModal';
import { ColumnSparklineMini } from './csv/ColumnSparklineMini';
import type { ThemeId } from '../../../../shared/types';
import { type Locale } from '../../../../shared/lib/i18n';

export interface XlsxViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
  onContentChange?: (content: string) => void;
}

export const XlsxViewer: React.FC<XlsxViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'spreadsheet.xlsx',
  fileSize,
  theme,
  isDarkTheme = false,
  locale = 'zh-CN',
}) => {
  const [workbook, setWorkbook] = useState<ParsedXlsxWorkbook | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 搜索、排序与分页状态
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // UI 交互状态
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [selectedProfileCol, setSelectedProfileCol] = useState<number | null>(null);
  const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // 载入与解析工作簿
  const loadWorkbook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rawData: ArrayBuffer | Uint8Array | string = content || '';

      if (binaryUrl) {
        const resp = await fetch(binaryUrl);
        rawData = await resp.arrayBuffer();
      }

      const parsed = await parseXlsx(rawData);
      setWorkbook(parsed);
      setActiveSheetIdx(0);
      setPage(1);
      setSortCol(null);
    } catch (err: any) {
      setError(err?.message || '无法解析 Excel 工作簿，请检查文件是否损坏或受密码保护。');
    } finally {
      setLoading(false);
    }
  }, [content, binaryUrl]);

  useEffect(() => {
    loadWorkbook();
  }, [loadWorkbook]);

  // 当前激活的工作表
  const currentSheet: XlsxWorksheet | null = useMemo(() => {
    if (!workbook || workbook.sheets.length === 0) return null;
    return workbook.sheets[activeSheetIdx] || workbook.sheets[0];
  }, [workbook, activeSheetIdx]);

  // 表头与数据行提取
  const { displayHeaders, dataRows } = useMemo(() => {
    if (!currentSheet || currentSheet.rows.length === 0) {
      return { displayHeaders: [], dataRows: [] };
    }

    if (useFirstRowAsHeader && currentSheet.rows.length > 1) {
      const firstRow = currentSheet.rows[0];
      const headers = firstRow.map((val, idx) => (val.trim() !== '' ? val : indexToColLetter(idx)));
      const rows = currentSheet.rows.slice(1);
      return { displayHeaders: headers, dataRows: rows };
    }

    const headers = Array.from({ length: currentSheet.colCount }, (_, idx) => indexToColLetter(idx));
    return { displayHeaders: headers, dataRows: currentSheet.rows };
  }, [currentSheet, useFirstRowAsHeader]);

  // 列级画像与统计分析 (Profiling)
  const columnProfiles = useMemo<ColumnProfile[]>(() => {
    if (!displayHeaders.length || !dataRows.length) return [];
    try {
      return profileAllColumns(displayHeaders, dataRows);
    } catch {
      return [];
    }
  }, [displayHeaders, dataRows]);

  // 搜索过滤与排序处理
  const processedRows = useMemo(() => {
    if (!dataRows.length) return [];
    let list = [...dataRows];

    // 全局关键字搜索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(row => row.some(cell => String(cell).toLowerCase().includes(q)));
    }

    // 列排序
    if (sortCol !== null && sortCol < displayHeaders.length) {
      list.sort((a, b) => {
        const valA = a[sortCol] ?? '';
        const valB = b[sortCol] ?? '';
        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return sortAsc ? numA - numB : numB - numA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB), undefined, { numeric: true })
          : String(valB).localeCompare(String(valA), undefined, { numeric: true });
      });
    }

    return list;
  }, [dataRows, searchQuery, sortCol, sortAsc, displayHeaders.length]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const currentPageRows = useMemo(() => {
    if (pageSize >= processedRows.length) return processedRows;
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize]);

  // 复制单元格值
  const handleCopyCell = (val: string, refKey: string) => {
    navigator.clipboard.writeText(val);
    setCopiedCell(refKey);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  // 排序切换
  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortCol(null);
        setSortAsc(true);
      }
    } else {
      setSortCol(colIdx);
      setSortAsc(true);
    }
  };

  // 导出功能
  const handleExport = (type: 'csv' | 'json' | 'md' | 'tsv') => {
    if (!currentSheet) return;
    let text = '';
    let mime = 'text/plain';
    let ext = 'txt';

    if (type === 'csv') {
      text = exportSheetToCsv(currentSheet, ',');
      mime = 'text/csv;charset=utf-8;';
      ext = 'csv';
    } else if (type === 'tsv') {
      text = exportSheetToCsv(currentSheet, '\t');
      mime = 'text/tab-separated-values;charset=utf-8;';
      ext = 'tsv';
    } else if (type === 'json') {
      text = exportSheetToJson(currentSheet);
      mime = 'application/json;charset=utf-8;';
      ext = 'json';
    } else if (type === 'md') {
      text = exportSheetToMarkdown(currentSheet);
      mime = 'text/markdown;charset=utf-8;';
      ext = 'md';
    }

    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSheet.name || 'sheet'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // 全屏切换
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full select-none overflow-hidden"
      style={{
        background: 'var(--ov-bg, #0d1117)',
        color: 'var(--ov-fg, #e6edf3)',
      }}
    >
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--ov-border,#30363d)] bg-[var(--ov-panel-bg,#161b22)] shrink-0 gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs truncate max-w-[200px]" title={fileName}>
                {fileName}
              </span>
              {currentSheet && (
                <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentSheet.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span>{workbook?.sheets.length || 0} 个工作表</span>
              <span>•</span>
              <span>{dataRows.length} 数据行</span>
              <span>•</span>
              <span>{displayHeaders.length} 列</span>
            </div>
          </div>
        </div>

        {/* 中间：全局搜索与表头模式切换 */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
          <div className="relative w-full max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="搜索单元格数据..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded bg-[var(--ov-bg,#0d1117)] border border-[var(--ov-border,#30363d)] focus:border-emerald-500 focus:outline-none placeholder:text-slate-500 text-slate-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setUseFirstRowAsHeader(!useFirstRowAsHeader)}
            className={`px-2 py-1 text-[11px] rounded border transition flex items-center gap-1 shrink-0 ${
              useFirstRowAsHeader
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium'
                : 'bg-[var(--ov-bg,#0d1117)] border-[var(--ov-border,#30363d)] text-slate-400 hover:text-slate-200'
            }`}
            title="切换是否使用第一行作为列标题"
          >
            <Table className="w-3 h-3" />
            <span className="hidden sm:inline">首行为表头</span>
          </button>
        </div>

        {/* 右侧：缩放、导出、属性与全屏 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 缩放控制器 */}
          <div className="flex items-center border border-[var(--ov-border,#30363d)] rounded bg-[var(--ov-bg,#0d1117)] px-1 py-0.5">
            <button
              onClick={() => setZoom(z => Math.max(0.7, Number((z - 0.1).toFixed(1))))}
              className="p-1 hover:text-white text-slate-400 transition"
              title="缩小网格"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] w-8 text-center font-mono text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
              className="p-1 hover:text-white text-slate-400 transition"
              title="放大网格"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 hover:text-white text-slate-400 transition ml-0.5 border-l border-[var(--ov-border,#30363d)]"
              title="还原缩放 (100%)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* 导出下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--ov-border,#30363d)] hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.05))] text-slate-300 transition"
              title="导出当前工作表"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">导出</span>
            </button>

            {showExportMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-36 rounded-md shadow-xl border border-[var(--ov-border,#30363d)] bg-[var(--ov-panel-bg,#161b22)] py-1 z-50 text-xs text-slate-200"
                onClick={() => setShowExportMenu(false)}
              >
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>导出为 CSV</span>
                </button>
                <button
                  onClick={() => handleExport('tsv')}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>导出为 TSV</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>导出为 JSON</span>
                </button>
                <button
                  onClick={() => handleExport('md')}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>导出为 Markdown</span>
                </button>
              </div>
            )}
          </div>

          {/* 工作簿属性与信息 */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded border transition ${
              showInfo
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'border-[var(--ov-border,#30363d)] text-slate-400 hover:text-slate-200 hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.05))]'
            }`}
            title="查看工作簿元数据与出版属性"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* 全屏放映 */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded border border-[var(--ov-border,#30363d)] text-slate-400 hover:text-slate-200 hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.05))] transition"
            title={isFullscreen ? '退出全屏' : '全屏展开数据网格'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 主工作区 */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--ov-bg,#0d1117)]/80 backdrop-blur z-30">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-300">正在解析 Excel 工作簿与构建数据网格...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="p-3 rounded-full bg-red-500/10 text-red-400 mb-3 border border-red-500/20">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-medium text-red-400 mb-1">工作簿解析异常</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4">{error}</p>
            <button
              onClick={loadWorkbook}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
            >
              重试载入
            </button>
          </div>
        )}

        {!loading && !error && currentSheet && (
          <div className="flex-1 min-h-0 overflow-auto relative" style={{ fontSize: `${zoom * 12}px` }}>
            <table className="w-full border-collapse border-spacing-0 text-left">
              {/* 表头 */}
              <thead className="sticky top-0 z-20 bg-[var(--ov-panel-bg,#161b22)] shadow-xs">
                <tr>
                  {/* 行号表头 */}
                  <th className="w-12 min-w-[48px] px-2 py-1.5 text-center font-mono text-[10px] text-slate-500 border-b border-r border-[var(--ov-border,#30363d)] bg-[var(--ov-panel-bg,#161b22)] sticky left-0 z-30 select-none">
                    #
                  </th>

                  {/* 各列标题 */}
                  {displayHeaders.map((header, colIdx) => {
                    const profile = columnProfiles[colIdx];
                    const isSorted = sortCol === colIdx;
                    return (
                      <th
                        key={colIdx}
                        className="px-3 py-1.5 font-medium text-slate-200 border-b border-r border-[var(--ov-border,#30363d)] bg-[var(--ov-panel-bg,#161b22)] whitespace-nowrap group hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.04))] transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0"
                            onClick={() => handleSort(colIdx)}
                          >
                            <span className="font-semibold truncate" title={header}>
                              {header}
                            </span>
                            {isSorted ? (
                              sortAsc ? (
                                <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 shrink-0 transition" />
                            )}
                          </div>

                          {/* 列分析迷你按钮与 Sparkline */}
                          {profile && (
                            <div className="flex items-center gap-1 shrink-0">
                              {profile.numericStats && profile.numericStats.sparklinePoints.length > 1 && (
                                <div className="w-10 h-4 opacity-75 group-hover:opacity-100 transition">
                                  <ColumnSparklineMini profile={profile} />
                                </div>
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedProfileCol(colIdx);
                                }}
                                className="p-0.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition"
                                title="查看该列数据画像与分布统计"
                              >
                                <BarChart2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* 表体 */}
              <tbody className="divide-y divide-[var(--ov-border,#30363d)] font-mono text-[11px]">
                {currentPageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displayHeaders.length + 1}
                      className="py-12 text-center text-slate-500 text-xs"
                    >
                      未匹配到符合搜索条件的数据
                    </td>
                  </tr>
                ) : (
                  currentPageRows.map((row, rowIdx) => {
                    const actualRowNum = (page - 1) * pageSize + rowIdx + (useFirstRowAsHeader ? 2 : 1);
                    return (
                      <tr
                        key={rowIdx}
                        className="hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.03))] transition"
                      >
                        {/* 左侧固定行号 */}
                        <td className="w-12 min-w-[48px] px-2 py-1 text-center font-mono text-[10px] text-slate-500 border-r border-[var(--ov-border,#30363d)] bg-[var(--ov-panel-bg,#161b22)] sticky left-0 z-10 select-none">
                          {actualRowNum}
                        </td>

                        {/* 单元格列表 */}
                        {displayHeaders.map((_, colIdx) => {
                          const cellVal = row[colIdx] ?? '';
                          const refKey = `${indexToColLetter(colIdx)}${actualRowNum}`;
                          const isCopied = copiedCell === refKey;
                          const isMatch =
                            searchQuery.trim() !== '' &&
                            String(cellVal).toLowerCase().includes(searchQuery.toLowerCase().trim());

                          return (
                            <td
                              key={colIdx}
                              onClick={() => handleCopyCell(cellVal, refKey)}
                              className={`px-3 py-1.5 border-r border-[var(--ov-border,#30363d)] truncate max-w-xs cursor-pointer group/cell relative transition ${
                                isMatch ? 'bg-amber-500/15 text-amber-200 font-medium' : ''
                              }`}
                              title={`[${refKey}] ${cellVal}\n(点击复制)`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">{cellVal || <span className="text-slate-600 font-sans italic">空</span>}</span>
                                <span className="opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-white shrink-0">
                                  {isCopied ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </span>
                              </div>
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

      {/* 底部多工作表 Tab 栏与分页状态条 */}
      <footer className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--ov-border,#30363d)] bg-[var(--ov-panel-bg,#161b22)] shrink-0 gap-2 z-10">
        {/* 左侧：工作表 (Sheets) Tab 列表 */}
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 max-w-xl py-0.5">
          {workbook?.sheets.map((sheet, idx) => {
            const isActive = idx === activeSheetIdx;
            return (
              <button
                key={sheet.id || idx}
                onClick={() => {
                  setActiveSheetIdx(idx);
                  setPage(1);
                  setSortCol(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs whitespace-nowrap font-medium transition border ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-[var(--ov-bg,#0d1117)] text-slate-400 border-[var(--ov-border,#30363d)] hover:text-slate-200 hover:bg-[var(--ov-hover-bg,rgba(255,255,255,0.05))]'
                }`}
                title={`工作表: ${sheet.name} (${sheet.rowCount} 行, ${sheet.colCount} 列)`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[120px]">{sheet.name}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded ${isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>
                  {sheet.rowCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* 右侧：分页控制器 */}
        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-1.5 py-0.5 rounded bg-[var(--ov-bg,#0d1117)] border border-[var(--ov-border,#30363d)] text-slate-200 text-xs focus:outline-none"
            >
              <option value={20}>20 行</option>
              <option value={50}>50 行</option>
              <option value={100}>100 行</option>
              <option value={500}>500 行</option>
            </select>
          </div>

          <div className="flex items-center gap-1 border border-[var(--ov-border,#30363d)] rounded bg-[var(--ov-bg,#0d1117)] px-1 py-0.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
              title="上一页"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
              title="下一页"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* 列数据画像透视模态框 */}
      {selectedProfileCol !== null && columnProfiles[selectedProfileCol] && (
        <ColumnProfileModal
          profile={columnProfiles[selectedProfileCol]}
          locale={locale}
          onClose={() => setSelectedProfileCol(null)}
          onSortAsc={colIdx => {
            setSortCol(colIdx);
            setSortAsc(true);
            setSelectedProfileCol(null);
          }}
          onSortDesc={colIdx => {
            setSortCol(colIdx);
            setSortAsc(false);
            setSelectedProfileCol(null);
          }}
          onFilterValue={val => {
            setSearchQuery(val);
            setSelectedProfileCol(null);
          }}
        />
      )}

      {/* 工作簿属性与出版元数据抽屉 */}
      {showInfo && workbook && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[var(--ov-panel-bg,#161b22)] border border-[var(--ov-border,#30363d)] rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ov-border,#30363d)]">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel 工作簿属性 (Workbook Metadata)</span>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-300">
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--ov-border,#30363d)]/50">
                <span className="text-slate-400">文档标题</span>
                <span className="col-span-2 font-medium text-slate-200 truncate">
                  {workbook.metadata.title || fileName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--ov-border,#30363d)]/50">
                <span className="text-slate-400">作者 / 创建者</span>
                <span className="col-span-2 text-slate-200">{workbook.metadata.creator || '未署名'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--ov-border,#30363d)]/50">
                <span className="text-slate-400">最后修订人</span>
                <span className="col-span-2 text-slate-200">{workbook.metadata.lastModifiedBy || '未记录'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--ov-border,#30363d)]/50">
                <span className="text-slate-400">生成应用程序</span>
                <span className="col-span-2 text-slate-200 truncate">{workbook.metadata.application || 'Microsoft Excel / OmniView'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--ov-border,#30363d)]/50">
                <span className="text-slate-400">创建时间</span>
                <span className="col-span-2 text-slate-200">{workbook.metadata.created || '无'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-[var(--ov-border,#30363d)]/50">
                <span className="text-slate-400">修改时间</span>
                <span className="col-span-2 text-slate-200">{workbook.metadata.modified || '无'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1">
                <span className="text-slate-400">包含工作表</span>
                <span className="col-span-2 text-emerald-400 font-medium">
                  {workbook.sheets.map(s => s.name).join(', ')}
                </span>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[var(--ov-bg,#0d1117)] border-t border-[var(--ov-border,#30363d)] flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
