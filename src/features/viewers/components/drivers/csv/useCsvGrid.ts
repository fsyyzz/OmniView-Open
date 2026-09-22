/**
 * CSV / TSV 数据网格与状态管理 Hook (useCsvGrid)
 * 封装行列增删改、排序检索、分页、单元格编辑与状态序列化逻辑
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  CsvDelimiter,
  parseCsv,
  serializeCsv,
} from './csvUtils';
import { profileAllColumns, ColumnProfile } from './csvProfiling';

export interface UseCsvGridOptions {
  content: string;
  onContentChange?: (newContent: string) => void;
}

export function useCsvGrid({ content, onContentChange }: UseCsvGridOptions) {
  // Parse initial content
  const initialData = useMemo(() => parseCsv(content), [content]);

  // Working state for headers, rows, and active delimiter
  const [headers, setHeaders] = useState<string[]>(initialData.headers);
  const [rows, setRows] = useState<string[][]>(initialData.rows);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(initialData.delimiter);

  // Synchronize when external content changes
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

  // In-place Cell Editing
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editCellValue, setEditCellValue] = useState('');
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Header Renaming
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null);
  const [editHeaderValue, setEditHeaderValue] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Active Dropdowns / Modals
  const [activeColMenu, setActiveColMenu] = useState<number | null>(null);

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

  // Compute Data Profiling for all columns
  const columnProfiles = useMemo<ColumnProfile[]>(() => profileAllColumns(headers, rows), [headers, rows]);

  // Check if content was modified compared to initial
  const currentSerialized = useMemo(() => serializeCsv(headers, rows, delimiter), [headers, rows, delimiter]);
  const isDirty = currentSerialized.trim() !== content.trim();

  // Commit changes to parent via onContentChange
  const triggerUpdate = useCallback((newHeaders: string[], newRows: string[][], newDelim: CsvDelimiter = delimiter) => {
    setHeaders(newHeaders);
    setRows(newRows);
    setDelimiter(newDelim);
    const serialized = serializeCsv(newHeaders, newRows, newDelim);
    setRawText(serialized);
    if (onContentChange) {
      onContentChange(serialized);
    }
  }, [delimiter, onContentChange]);

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
  const handleSort = useCallback((idx: number) => {
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
  }, [sortCol, sortAsc]);

  // Cell Editing Handlers
  const handleStartEditCell = useCallback((originalRowIdx: number, colIdx: number, val: string) => {
    setEditingCell({ rowIdx: originalRowIdx, colIdx });
    setEditCellValue(val ?? '');
  }, []);

  const handleCommitCellEdit = useCallback((advanceToNext: boolean = false) => {
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
  }, [editingCell, rows, editCellValue, headers, triggerUpdate]);

  const handleCancelCellEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Header Editing Handlers
  const handleStartEditHeader = useCallback((colIdx: number) => {
    setEditingHeaderIdx(colIdx);
    setEditHeaderValue(headers[colIdx] || '');
    setActiveColMenu(null);
  }, [headers]);

  const handleCommitHeaderEdit = useCallback(() => {
    if (editingHeaderIdx === null) return;
    const trimmed = editHeaderValue.trim();
    if (trimmed) {
      const updated = [...headers];
      updated[editingHeaderIdx] = trimmed;
      triggerUpdate(updated, rows);
    }
    setEditingHeaderIdx(null);
  }, [editingHeaderIdx, editHeaderValue, headers, rows, triggerUpdate]);

  // Row Manipulation
  const handleAddRowAtBottom = useCallback(() => {
    const emptyRow = new Array(headers.length).fill('');
    const updated = [...rows, emptyRow];
    triggerUpdate(headers, updated);
    const newTotalPages = Math.ceil(updated.length / pageSize);
    setPage(newTotalPages);
    setTimeout(() => {
      handleStartEditCell(updated.length - 1, 0, '');
    }, 50);
  }, [headers, rows, triggerUpdate, pageSize, handleStartEditCell]);

  const handleInsertRowBelow = useCallback((originalRowIdx: number) => {
    const emptyRow = new Array(headers.length).fill('');
    const updated = [...rows];
    updated.splice(originalRowIdx + 1, 0, emptyRow);
    triggerUpdate(headers, updated);
    setTimeout(() => {
      handleStartEditCell(originalRowIdx + 1, 0, '');
    }, 50);
  }, [headers, rows, triggerUpdate, handleStartEditCell]);

  const handleDuplicateRow = useCallback((originalRowIdx: number) => {
    const targetRow = [...rows[originalRowIdx]];
    const updated = [...rows];
    updated.splice(originalRowIdx + 1, 0, targetRow);
    triggerUpdate(headers, updated);
  }, [rows, headers, triggerUpdate]);

  const handleDeleteRow = useCallback((originalRowIdx: number) => {
    const updated = rows.filter((_, i) => i !== originalRowIdx);
    triggerUpdate(headers, updated);
    if (editingCell?.rowIdx === originalRowIdx) {
      setEditingCell(null);
    }
  }, [rows, headers, triggerUpdate, editingCell]);

  // Column Manipulation
  const handleAddColumn = useCallback((name?: string) => {
    const colName = (name && name.trim()) || `Col_${headers.length + 1}`;
    const updatedHeaders = [...headers, colName];
    const updatedRows = rows.map(r => [...r, '']);
    triggerUpdate(updatedHeaders, updatedRows);
  }, [headers, rows, triggerUpdate]);

  const handleInsertColRight = useCallback((colIdx: number) => {
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
  }, [headers, rows, triggerUpdate]);

  const handleDeleteColumn = useCallback((colIdx: number) => {
    if (headers.length <= 1) return;
    const updatedHeaders = headers.filter((_, i) => i !== colIdx);
    const updatedRows = rows.map(r => r.filter((_, i) => i !== colIdx));
    triggerUpdate(updatedHeaders, updatedRows);
    setActiveColMenu(null);
    if (sortCol === colIdx) {
      setSortCol(null);
    }
  }, [headers, rows, triggerUpdate, sortCol]);

  // Delimiter change
  const handleChangeDelimiter = useCallback((newDelim: CsvDelimiter) => {
    setDelimiter(newDelim);
    const serialized = serializeCsv(headers, rows, newDelim);
    setRawText(serialized);
    if (onContentChange) {
      onContentChange(serialized);
    }
  }, [headers, rows, onContentChange]);

  // Revert all edits
  const handleRevert = useCallback(() => {
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
  }, [content, onContentChange]);

  // Raw Text Mode Synchronization
  const handleRawTextChange = useCallback((text: string) => {
    setRawText(text);
    const parsed = parseCsv(text, delimiter);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    if (onContentChange) {
      onContentChange(text);
    }
  }, [delimiter, onContentChange]);

  return {
    headers,
    rows,
    delimiter,
    viewMode,
    setViewMode,
    rawText,
    setRawText,
    searchQuery,
    setSearchQuery,
    sortCol,
    setSortCol,
    sortAsc,
    setSortAsc,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    filteredIndexedRows,
    paginatedIndexedRows,
    editingCell,
    editCellValue,
    setEditCellValue,
    cellInputRef,
    editingHeaderIdx,
    setEditingHeaderIdx,
    editHeaderValue,
    setEditHeaderValue,
    headerInputRef,
    activeColMenu,
    setActiveColMenu,
    columnProfiles,
    currentSerialized,
    isDirty,
    handleSort,
    handleStartEditCell,
    handleCommitCellEdit,
    handleCancelCellEdit,
    handleStartEditHeader,
    handleCommitHeaderEdit,
    handleAddRowAtBottom,
    handleInsertRowBelow,
    handleDuplicateRow,
    handleDeleteRow,
    handleAddColumn,
    handleInsertColRight,
    handleDeleteColumn,
    handleChangeDelimiter,
    handleRevert,
    handleRawTextChange,
  };
}
