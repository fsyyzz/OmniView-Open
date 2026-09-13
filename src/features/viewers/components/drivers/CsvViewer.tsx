/**
 * CSV / TSV 企业级智能数据网格与多维编辑驱动
 * 支持单元格就地编辑、行列增删改、表格/源码双模切换、多分隔符与多格式导出
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Table,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  RotateCcw,
  Code,
  FileText,
  MoreVertical,
  ChevronDown,
  Columns,
  Rows,
  CornerDownLeft,
  CheckCheck
} from 'lucide-react';
import { Locale, t } from '../../../../shared/lib/i18n';
import {
  CsvDelimiter,
  parseCsv,
  serializeCsv,
  exportToJson,
  exportToMarkdown
} from './csv/csvUtils';

interface CsvViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  onContentChange?: (newContent: string) => void;
}

export const CsvViewer: React.FC<CsvViewerProps> = ({
  content,
  fileName = 'data.csv',
  locale = 'zh-CN',
  onContentChange,
}) => {
  // Parse initial content
  const initialData = useMemo(() => parseCsv(content), [content]);

  // Working state for headers, rows, and active delimiter
  const [headers, setHeaders] = useState<string[]>(initialData.headers);
  const [rows, setRows] = useState<string[][]>(initialData.rows);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(initialData.delimiter);

  // Synchronize when external content changes (if not locally dirty)
  useEffect(() => {
    const parsed = parseCsv(content);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setDelimiter(parsed.delimiter);
  }, [content]);

  // Mode: 'table' (Grid) vs 'raw' (Source Text)
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const [rawText, setRawText] = useState(content);

  // Search, Sort & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // In-place Cell Editing: { originalRowIdx, colIdx }
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editCellValue, setEditCellValue] = useState('');
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Header Renaming: colIdx
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null);
  const [editHeaderValue, setEditHeaderValue] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Active Dropdowns / Modals
  const [activeColMenu, setActiveColMenu] = useState<number | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDelimiterMenu, setShowDelimiterMenu] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showAddColDialog, setShowAddColDialog] = useState(false);
  const [newColName, setNewColName] = useState('');

  // Check if content was modified compared to initial
  const currentSerialized = useMemo(() => serializeCsv(headers, rows, delimiter), [headers, rows, delimiter]);
  const isDirty = currentSerialized.trim() !== content.trim();

  // Commit changes to parent via onContentChange
  const triggerUpdate = (newHeaders: string[], newRows: string[][], newDelim: CsvDelimiter = delimiter) => {
    setHeaders(newHeaders);
    setRows(newRows);
    setDelimiter(newDelim);
    const serialized = serializeCsv(newHeaders, newRows, newDelim);
    setRawText(serialized);
    if (onContentChange) {
      onContentChange(serialized);
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    if (editingHeaderIdx !== null && headerInputRef.current) {
      headerInputRef.current.focus();
      headerInputRef.current.select();
    }
  }, [editingHeaderIdx]);

  // Filter & Sort Rows with original indices
  const filteredIndexedRows = useMemo(() => {
    let indexed = rows.map((r, idx) => ({ row: r, originalIndex: idx }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      indexed = indexed.filter(item => item.row.some(cell => (cell || '').toLowerCase().includes(q)));
    }

    if (sortCol !== null) {
      indexed.sort((a, b) => {
        const valA = a.row[sortCol] || '';
        const valB = b.row[sortCol] || '';
        const numA = Number(valA.replace(/[^0-9.-]+/g, ''));
        const numB = Number(valB.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return sortAsc ? numA - numB : numB - numA;
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return indexed;
  }, [rows, searchQuery, sortCol, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredIndexedRows.length / pageSize));
  const paginatedIndexedRows = filteredIndexedRows.slice((page - 1) * pageSize, page * pageSize);

  // Sorting Handler
  const handleSort = (idx: number) => {
    if (sortCol === idx) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortCol(null);
        setSortAsc(true);
      }
    } else {
      setSortCol(idx);
      setSortAsc(true);
    }
  };

  // Cell Editing Handlers
  const handleStartEditCell = (originalRowIdx: number, colIdx: number, val: string) => {
    setEditingCell({ rowIdx: originalRowIdx, colIdx });
    setEditCellValue(val ?? '');
  };

  const handleCommitCellEdit = (advanceToNext: boolean = false) => {
    if (!editingCell) return;
    const { rowIdx, colIdx } = editingCell;
    const updatedRows = rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const copy = [...r];
      copy[colIdx] = editCellValue;
      return copy;
    });

    triggerUpdate(headers, updatedRows);

    if (advanceToNext) {
      // Tab to next column in same row, or wrap to next row
      if (colIdx + 1 < headers.length) {
        const nextVal = updatedRows[rowIdx]?.[colIdx + 1] ?? '';
        setEditingCell({ rowIdx, colIdx: colIdx + 1 });
        setEditCellValue(nextVal);
      } else if (rowIdx + 1 < updatedRows.length) {
        const nextVal = updatedRows[rowIdx + 1]?.[0] ?? '';
        setEditingCell({ rowIdx: rowIdx + 1, colIdx: 0 });
        setEditCellValue(nextVal);
      } else {
        setEditingCell(null);
      }
    } else {
      setEditingCell(null);
    }
  };

  const handleCancelCellEdit = () => {
    setEditingCell(null);
  };

  // Header Editing Handlers
  const handleStartEditHeader = (colIdx: number) => {
    setEditingHeaderIdx(colIdx);
    setEditHeaderValue(headers[colIdx] || '');
    setActiveColMenu(null);
  };

  const handleCommitHeaderEdit = () => {
    if (editingHeaderIdx === null) return;
    const trimmed = editHeaderValue.trim();
    if (trimmed) {
      const updated = [...headers];
      updated[editingHeaderIdx] = trimmed;
      triggerUpdate(updated, rows);
    }
    setEditingHeaderIdx(null);
  };

  // Row Manipulation
  const handleAddRowAtBottom = () => {
    const emptyRow = new Array(headers.length).fill('');
    const updated = [...rows, emptyRow];
    triggerUpdate(headers, updated);
    // Jump to last page and edit new row's first cell
    const newTotalPages = Math.ceil(updated.length / pageSize);
    setPage(newTotalPages);
    setTimeout(() => {
      handleStartEditCell(updated.length - 1, 0, '');
    }, 50);
  };

  const handleInsertRowBelow = (originalRowIdx: number) => {
    const emptyRow = new Array(headers.length).fill('');
    const updated = [...rows];
    updated.splice(originalRowIdx + 1, 0, emptyRow);
    triggerUpdate(headers, updated);
    setTimeout(() => {
      handleStartEditCell(originalRowIdx + 1, 0, '');
    }, 50);
  };

  const handleDuplicateRow = (originalRowIdx: number) => {
    const targetRow = [...rows[originalRowIdx]];
    const updated = [...rows];
    updated.splice(originalRowIdx + 1, 0, targetRow);
    triggerUpdate(headers, updated);
  };

  const handleDeleteRow = (originalRowIdx: number) => {
    const updated = rows.filter((_, i) => i !== originalRowIdx);
    triggerUpdate(headers, updated);
    if (editingCell?.rowIdx === originalRowIdx) {
      setEditingCell(null);
    }
  };

  // Column Manipulation
  const handleAddColumn = (name?: string) => {
    const colName = (name && name.trim()) || `Col_${headers.length + 1}`;
    const updatedHeaders = [...headers, colName];
    const updatedRows = rows.map(r => [...r, '']);
    triggerUpdate(updatedHeaders, updatedRows);
    setShowAddColDialog(false);
    setNewColName('');
  };

  const handleInsertColRight = (colIdx: number) => {
    const colName = `Col_${headers.length + 1}`;
    const updatedHeaders = [...headers];
    updatedHeaders.splice(colIdx + 1, 0, colName);
    const updatedRows = rows.map(r => {
      const copy = [...r];
      copy.splice(colIdx + 1, 0, '');
      return copy;
    });
    triggerUpdate(updatedHeaders, updatedRows);
    setActiveColMenu(null);
  };

  const handleDeleteColumn = (colIdx: number) => {
    if (headers.length <= 1) {
      return; // Keep at least one column
    }
    const updatedHeaders = headers.filter((_, i) => i !== colIdx);
    const updatedRows = rows.map(r => r.filter((_, i) => i !== colIdx));
    triggerUpdate(updatedHeaders, updatedRows);
    setActiveColMenu(null);
    if (sortCol === colIdx) {
      setSortCol(null);
    }
  };

  // Delimiter change
  const handleChangeDelimiter = (newDelim: CsvDelimiter) => {
    setDelimiter(newDelim);
    setShowDelimiterMenu(false);
    const serialized = serializeCsv(headers, rows, newDelim);
    setRawText(serialized);
    if (onContentChange) {
      onContentChange(serialized);
    }
  };

  // Revert all edits
  const handleRevert = () => {
    const parsed = parseCsv(content);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setDelimiter(parsed.delimiter);
    setRawText(content);
    setEditingCell(null);
    setEditingHeaderIdx(null);
    if (onContentChange) {
      onContentChange(content);
    }
  };

  // Raw Text Mode Synchronization
  const handleRawTextChange = (text: string) => {
    setRawText(text);
    const parsed = parseCsv(text, delimiter);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    if (onContentChange) {
      onContentChange(text);
    }
  };

  // Exports & Clipboard
  const handleDownloadCsv = () => {
    const blob = new Blob([currentSerialized], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.csv') || fileName.endsWith('.tsv') ? fileName : `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleDownloadJson = () => {
    const jsonStr = exportToJson(headers, rows);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^/.]+$/, '') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleCopyMarkdown = async () => {
    const md = exportToMarkdown(headers, rows);
    await navigator.clipboard.writeText(md);
    setCopiedType('markdown');
    setTimeout(() => setCopiedType(null), 2000);
    setShowExportMenu(false);
  };

  const handleCopyTsv = async () => {
    const tsv = serializeCsv(headers, rows, '\t');
    await navigator.clipboard.writeText(tsv);
    setCopiedType('tsv');
    setTimeout(() => setCopiedType(null), 2000);
    setShowExportMenu(false);
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.csv-dropdown-trigger') && !target.closest('.csv-dropdown-menu')) {
        setActiveColMenu(null);
        setShowExportMenu(false);
        setShowDelimiterMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const delimiterLabelMap: Record<CsvDelimiter, string> = {
    ',': '逗号 (,)',
    '\t': 'Tab 制表符 (\\t)',
    ';': '分号 (;)',
    '|': '竖线 (|)',
  };

  return (
    <div id="csv-smart-grid-container" className="h-full flex flex-col bg-slate-950 text-slate-200 select-none">
      {/* Top Primary Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV 智能编辑网格</span>
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* View Mode Toggle: Grid vs Raw Text */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 font-medium">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs transition ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="表格网格"
              aria-label="表格网格"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">表格网格</span>
            </button>
            <button
              onClick={() => {
                setRawText(serializeCsv(headers, rows, delimiter));
                setViewMode('raw');
              }}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs transition ${
                viewMode === 'raw'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="源码编辑"
              aria-label="源码编辑"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">源码编辑</span>
            </button>
          </div>

          {/* Search Box (Table mode) */}
          {viewMode === 'table' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t('csvSearch', locale)}
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-md text-slate-200 text-xs w-36 sm:w-48 focus:w-60 focus:border-emerald-500 transition-all outline-none"
              />
            </div>
          )}

          {/* Dirty Badge / Revert Button */}
          {isDirty && (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded text-[11px] font-mono">
                未保存修改
              </span>
              <button
                onClick={handleRevert}
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 text-[11px] transition"
                title="撤销当前未保存的修改，恢复原始文件状态"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>重置</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Table Mode Action Buttons: + Row & + Col */}
          {viewMode === 'table' && (
            <>
              <button
                onClick={handleAddRowAtBottom}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded border border-emerald-700/60 text-xs transition"
                title="在表格底部追加新空白行"
                aria-label="加行"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">加行</span>
              </button>
              <button
                onClick={() => setShowAddColDialog(true)}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs transition"
                title="在右侧追加新列"
                aria-label="加列"
              >
                <Columns className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">加列</span>
              </button>
            </>
          )}

          {/* Delimiter Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDelimiterMenu(!showDelimiterMenu)}
              className="csv-dropdown-trigger flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition"
              title="切换分隔符"
            >
              <span className="text-[11px] text-slate-400 font-mono">
                分隔: <strong className="text-emerald-400">{delimiter === '\t' ? '\\t' : delimiter}</strong>
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showDelimiterMenu && (
              <div className="csv-dropdown-menu absolute right-0 mt-1.5 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5">
                <div className="px-2 py-1 text-[10px] text-slate-500 font-mono border-b border-slate-800">
                  选择列分隔符 (Delimiter)
                </div>
                {(Object.keys(delimiterLabelMap) as CsvDelimiter[]).map(d => (
                  <button
                    key={d}
                    onClick={() => handleChangeDelimiter(d)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition ${
                      delimiter === d ? 'bg-emerald-600/30 text-emerald-200 font-medium' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{delimiterLabelMap[d]}</span>
                    {delimiter === d && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export & Copy Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="csv-dropdown-trigger flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs transition"
              title="导出与复制"
              aria-label="导出与复制"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">导出/复制</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="csv-dropdown-menu absolute right-0 mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1">
                <button
                  onClick={handleDownloadCsv}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>导出 CSV / TSV 文件</span>
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>导出 JSON 数组结构 (.json)</span>
                </button>
                <div className="border-t border-slate-800 my-1" />
                <button
                  onClick={handleCopyMarkdown}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  {copiedType === 'markdown' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copiedType === 'markdown' ? 'Markdown 表格已复制' : '复制为 Markdown 表格'}</span>
                </button>
                <button
                  onClick={handleCopyTsv}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  {copiedType === 'tsv' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{copiedType === 'tsv' ? 'TSV 数据已复制' : '复制 TSV (直贴 Excel / 表格)'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Viewport Content */}
      {viewMode === 'raw' ? (
        /* Raw Source Textarea Mode */
        <div className="flex-1 flex flex-col bg-slate-950 p-2 overflow-hidden">
          <div className="text-[11px] text-slate-500 font-mono px-2 py-1 flex items-center justify-between border-b border-slate-800">
            <span>原始 CSV 文本编辑器（直接编辑文本将自动同步至数据网格）</span>
            <span>{rawText.split('\n').length} 行 · UTF-8</span>
          </div>
          <textarea
            value={rawText}
            onChange={e => handleRawTextChange(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-4 bg-transparent font-mono text-xs text-emerald-200 resize-none outline-none leading-relaxed selection:bg-emerald-600 selection:text-white"
            placeholder="Header1,Header2,Header3..."
          />
        </div>
      ) : (
        /* Interactive Grid Table Mode */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Table Container */}
          <div className="flex-1 overflow-auto relative">
            <table className="w-full text-left border-collapse text-xs font-sans">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-20 shadow-sm">
                <tr>
                  {/* Row Number & Action Column */}
                  <th className="p-2.5 text-slate-500 font-mono w-14 text-center border-r border-slate-800 bg-slate-900/95 sticky left-0 z-30 select-none">
                    #
                  </th>

                  {/* Data Column Headers */}
                  {headers.map((h, colIdx) => {
                    const isSorted = sortCol === colIdx;
                    const isEditingHeader = editingHeaderIdx === colIdx;

                    return (
                      <th
                        key={colIdx}
                        className="p-2 font-semibold text-slate-300 border-r border-slate-800 bg-slate-900/95 transition select-none group min-w-[120px]"
                      >
                        {isEditingHeader ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={headerInputRef}
                              type="text"
                              value={editHeaderValue}
                              onChange={e => setEditHeaderValue(e.target.value)}
                              onBlur={handleCommitHeaderEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCommitHeaderEdit();
                                if (e.key === 'Escape') setEditingHeaderIdx(null);
                              }}
                              className="w-full px-2 py-0.5 bg-slate-950 border border-emerald-500 rounded text-xs text-white outline-none"
                            />
                            <button
                              onClick={handleCommitHeaderEdit}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1.5">
                            {/* Header Label + Double Click to Rename */}
                            <div
                              onClick={() => handleSort(colIdx)}
                              onDoubleClick={() => handleStartEditHeader(colIdx)}
                              className="flex items-center gap-1.5 flex-1 cursor-pointer truncate"
                              title="点击排序，双击重命名列名"
                            >
                              <span className="truncate font-medium">{h}</span>
                              {isSorted ? (
                                sortAsc ? (
                                  <ArrowUp className="w-3 h-3 text-emerald-400 shrink-0" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-emerald-400 shrink-0" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 shrink-0 transition" />
                              )}
                            </div>

                            {/* Column Menu Action */}
                            <div className="relative">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setActiveColMenu(activeColMenu === colIdx ? null : colIdx);
                                }}
                                className="csv-dropdown-trigger p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded opacity-0 group-hover:opacity-100 transition"
                                title="列操作菜单"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </button>

                              {activeColMenu === colIdx && (
                                <div className="csv-dropdown-menu absolute right-0 mt-1 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50 text-xs space-y-0.5">
                                  <button
                                    onClick={() => handleStartEditHeader(colIdx)}
                                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 rounded-lg"
                                  >
                                    <Edit2 className="w-3 h-3 text-emerald-400" />
                                    <span>重命名列</span>
                                  </button>
                                  <button
                                    onClick={() => handleInsertColRight(colIdx)}
                                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 rounded-lg"
                                  >
                                    <Plus className="w-3 h-3 text-blue-400" />
                                    <span>在右侧插入列</span>
                                  </button>
                                  {headers.length > 1 && (
                                    <button
                                      onClick={() => handleDeleteColumn(colIdx)}
                                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-red-400 hover:bg-red-950/40 rounded-lg"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-400" />
                                      <span>删除此列</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Data Rows */}
              <tbody className="divide-y divide-slate-850">
                {paginatedIndexedRows.map(({ row, originalIndex }, pageRowIdx) => {
                  const displayRowNumber = (page - 1) * pageSize + pageRowIdx + 1;

                  return (
                    <tr key={originalIndex} className="hover:bg-slate-900/60 transition group">
                      {/* Row Index & Hover Row Action Controls */}
                      <td className="p-1.5 text-slate-500 font-mono text-center border-r border-slate-800/80 bg-slate-950/60 sticky left-0 z-10 text-[11px] group-hover:bg-slate-900/90 transition">
                        <div className="flex items-center justify-center relative">
                          <span className="group-hover:hidden">{displayRowNumber}</span>
                          {/* Hover Action Buttons */}
                          <div className="hidden group-hover:flex items-center gap-0.5 justify-center">
                            <button
                              onClick={() => handleInsertRowBelow(originalIndex)}
                              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded"
                              title="在下方插入新行"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDuplicateRow(originalIndex)}
                              className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded"
                              title="复制此行"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(originalIndex)}
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded"
                              title="删除此行"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Data Cells */}
                      {headers.map((_, colIdx) => {
                        const cellValue = row[colIdx] ?? '';
                        const isEditingThisCell =
                          editingCell?.rowIdx === originalIndex && editingCell?.colIdx === colIdx;

                        return (
                          <td
                            key={colIdx}
                            onDoubleClick={() => handleStartEditCell(originalIndex, colIdx, cellValue)}
                            className={`p-2 border-r border-slate-800/40 text-slate-300 relative transition ${
                              isEditingThisCell ? 'bg-slate-900 p-1' : 'hover:bg-slate-800/40 cursor-text'
                            }`}
                          >
                            {isEditingThisCell ? (
                              <div className="flex items-center gap-1">
                                <input
                                  ref={cellInputRef}
                                  type="text"
                                  value={editCellValue}
                                  onChange={e => setEditCellValue(e.target.value)}
                                  onBlur={() => handleCommitCellEdit(false)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleCommitCellEdit(false);
                                    } else if (e.key === 'Tab') {
                                      e.preventDefault();
                                      handleCommitCellEdit(true);
                                    } else if (e.key === 'Escape') {
                                      handleCancelCellEdit();
                                    }
                                  }}
                                  className="w-full px-2 py-1 bg-slate-950 border border-emerald-500 rounded text-xs text-white outline-none selection:bg-emerald-600"
                                />
                                <button
                                  onClick={() => handleCommitCellEdit(false)}
                                  className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                                  title="确认修改 (Enter)"
                                >
                                  <CornerDownLeft className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group/cell min-h-[20px]">
                                <span className="truncate max-w-sm">{cellValue || <span className="text-slate-600 italic">空</span>}</span>
                                <button
                                  onClick={() => handleStartEditCell(originalIndex, colIdx, cellValue)}
                                  className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-slate-500 hover:text-emerald-400 rounded transition ml-1"
                                  title="双击或点击编辑单元格"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Empty State */}
                {paginatedIndexedRows.length === 0 && (
                  <tr>
                    <td colSpan={headers.length + 1} className="text-center py-16 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-slate-600" />
                        <span>{t('csvNoData', locale)}</span>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            清除搜索条件
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination & Stats Footer Bar */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span>
                {locale === 'en-US' ? 'Total' : '数据总量'}: <strong className="text-slate-200">{rows.length}</strong> {locale === 'en-US' ? 'rows' : '行'} × <strong className="text-slate-200">{headers.length}</strong> {locale === 'en-US' ? 'columns' : '列'}
              </span>
              {searchQuery && (
                <>
                  <span>·</span>
                  <span>
                    {locale === 'en-US' ? 'Matched' : '匹配'}: <strong className="text-emerald-400">{filteredIndexedRows.length}</strong> 行
                  </span>
                </>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2 text-[11px]">
                <span className="text-slate-500">每页:</span>
                {[10, 20, 50, 100].map(sz => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPageSize(sz);
                      setPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded ${
                      pageSize === sz ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>

              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded transition"
                title="上一页"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs px-1 text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded transition"
                title="下一页"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Column Dialog Modal */}
      {showAddColDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Columns className="w-4 h-4 text-emerald-400" />
                <span>追加新数据列</span>
              </h3>
              <button
                onClick={() => setShowAddColDialog(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">列名 (Column Name):</label>
              <input
                type="text"
                autoFocus
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                placeholder={`例如: Column_${headers.length + 1}`}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddColumn(newColName);
                  if (e.key === 'Escape') setShowAddColDialog(false);
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddColDialog(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
              >
                取消
              </button>
              <button
                onClick={() => handleAddColumn(newColName)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
              >
                添加列
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
