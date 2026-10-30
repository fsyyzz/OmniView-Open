/**
 * OmniView 原生专业 Excel (.xlsx / .xls) 纯前端离线工作簿工作台 (XlsxViewer)
 * 基于 OOXML 架构与 Univer 专业电子表格引擎
 * 支持多工作表 (Multi-Sheet Tabs)、单元格与公式就地编辑、实时重算、数据搜索与排序、列特征画像 (Profiling) 及 CSV/TSV/JSON/Markdown 导出
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileSpreadsheet,
  Search,
  Download,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  Info,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Table,
  X,
  FileText,
  Code,
} from 'lucide-react';
import {
  parseXlsx,
  serializeXlsxWorkbook,
  exportSheetToCsv,
  exportSheetToJson,
  exportSheetToMarkdown,
  indexToColLetter,
  type ParsedXlsxWorkbook,
  type XlsxWorksheet,
} from '../../lib/xlsxEngine';
import { profileAllColumns, ColumnProfile } from './csv/csvProfiling';
import { ColumnProfileModal } from './csv/ColumnProfileModal';
import type { ThemeId } from '../../../../shared/types';
import { type Locale } from '../../../../shared/lib/i18n';

import { resilientImport } from '../../lib/resilientImport';

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

const UniverSheetViewer = React.lazy(() =>
  resilientImport(() => import('./xlsx/UniverSheetViewer'), { tag: 'UniverSheetViewer' })
);

export const XlsxViewer: React.FC<XlsxViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'spreadsheet.xlsx',
  theme,
  isDarkTheme = false,
  locale = 'zh-CN',
  onContentChange,
}) => {
  const [workbook, setWorkbook] = useState<ParsedXlsxWorkbook | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 搜索与排序状态（直接驱动 UniverSheetViewer）
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // UI 交互状态
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [copiedSheet, setCopiedSheet] = useState<boolean>(false);
  const [selectedProfileCol, setSelectedProfileCol] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedContentRef = useRef<string | null>(null);

  // 全局 Ctrl+F 快捷聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [reloadNonce, setReloadNonce] = useState(0);
  const loadWorkbook = useCallback(() => {
    lastEmittedContentRef.current = null;
    setReloadNonce(n => n + 1);
  }, []);

  // 载入与解析工作簿 (含并发竞态防护、内部编辑防回环与过时结果丢弃)
  useEffect(() => {
    // 若当前 content 变更来自 Univer 内部单元格编辑回写，直接跳过重新解包，避免重置已编辑数据或闪屏卸载
    if (
      typeof content === 'string' &&
      lastEmittedContentRef.current !== null &&
      content === lastEmittedContentRef.current
    ) {
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        let rawData: ArrayBuffer | Uint8Array | string = content || '';
        const isSerializedSnapshot =
          typeof content === 'string' &&
          content.trim().startsWith('{"__omniview_xlsx_workbook__":true');

        if (binaryUrl && !isSerializedSnapshot) {
          const resp = await fetch(binaryUrl);
          rawData = await resp.arrayBuffer();
        }

        const parsed = await parseXlsx(rawData);
        if (!isCancelled) {
          setWorkbook(parsed);
          setActiveSheetIdx(0);
          setSortCol(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || '无法解析 Excel 工作簿，请检查文件是否损坏或受密码保护。');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [content, binaryUrl, reloadNonce]);

  // 当前激活的工作表
  const currentSheet: XlsxWorksheet | null = useMemo(() => {
    if (!workbook || workbook.sheets.length === 0) return null;
    return workbook.sheets[activeSheetIdx] || workbook.sheets[0];
  }, [workbook, activeSheetIdx]);

  // 表头与数据行提取（供列特征画像与统计使用）
  const { displayHeaders, dataRows } = useMemo(() => {
    if (!currentSheet || currentSheet.rows.length === 0) {
      return { displayHeaders: [], dataRows: [] };
    }
    if (currentSheet.rows.length > 1) {
      const firstRow = currentSheet.rows[0];
      const headers = firstRow.map((val, idx) => (val.trim() !== '' ? val : indexToColLetter(idx)));
      const rows = currentSheet.rows.slice(1);
      return { displayHeaders: headers, dataRows: rows };
    }
    const headers = Array.from({ length: currentSheet.colCount }, (_, idx) => indexToColLetter(idx));
    return { displayHeaders: headers, dataRows: currentSheet.rows };
  }, [currentSheet]);

  // 列级画像与统计分析 (Profiling)
  const columnProfiles = useMemo<ColumnProfile[]>(() => {
    if (!displayHeaders.length || !dataRows.length) return [];
    try {
      return profileAllColumns(displayHeaders, dataRows);
    } catch {
      return [];
    }
  }, [displayHeaders, dataRows]);

  // 同步 Univer 内部单元格/公式编辑回主工作簿状态与持久化快照
  const handleWorkbookChange = useCallback(
    (updatedWorkbook: ParsedXlsxWorkbook) => {
      setWorkbook(updatedWorkbook);
      if (onContentChange) {
        const serialized = serializeXlsxWorkbook(updatedWorkbook);
        lastEmittedContentRef.current = serialized;
        onContentChange(serialized);
      }
    },
    [onContentChange]
  );

  // 一键复制当前工作表为 TSV (可直接粘贴到 Excel / 飞书 / Notion)
  const handleCopySheet = () => {
    if (!currentSheet) return;
    const tsv = exportSheetToCsv(currentSheet, '\t');
    navigator.clipboard.writeText(tsv);
    setCopiedSheet(true);
    setTimeout(() => setCopiedSheet(false), 1500);
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
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 顶部工具栏 */}
      <header
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-3 py-2 border-b shrink-0 gap-2 z-10"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="font-semibold text-xs truncate max-w-[200px]"
                style={{ color: 'var(--ov-text)' }}
                title={fileName}
              >
                {fileName}
              </span>
              {currentSheet && (
                <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentSheet.name}
                </span>
              )}
              <span
                className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border"
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
              >
                <Sparkles className="w-3 h-3" />
                <span>Univer 可编辑工作台</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>
              <span>{workbook?.sheets.length || 0} 个工作表</span>
              <span>•</span>
              <span>{currentSheet?.rowCount || 0} 行</span>
              <span>•</span>
              <span>{currentSheet?.colCount || 0} 列</span>
            </div>
          </div>
        </div>

        {/* 中间：全局搜索框 (Ctrl+F) */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
          <div className="relative w-full max-w-xs">
            <Search
              className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--ov-text-muted)' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索单元格或公式... (Ctrl+F)"
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-full pl-8 pr-6 py-1 text-xs rounded border focus:border-emerald-500 focus:outline-none placeholder:text-[var(--ov-text-muted)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ color: 'var(--ov-text-muted)' }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-[var(--ov-text)] transition"
                title="清空搜索"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 右侧：缩放、复制整表、导出、属性与全屏 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 缩放控制器 */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center border rounded px-1 py-0.5"
          >
            <button
              onClick={() => setZoom(z => Math.max(0.7, Number((z - 0.1).toFixed(1))))}
              style={{ color: 'var(--ov-text-secondary)' }}
              className="p-1 hover:text-[var(--ov-text)] transition"
              title="缩小网格"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] w-8 text-center font-mono" style={{ color: 'var(--ov-text)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
              style={{ color: 'var(--ov-text-secondary)' }}
              className="p-1 hover:text-[var(--ov-text)] transition"
              title="放大网格"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              style={{
                color: 'var(--ov-text-secondary)',
                borderLeftColor: 'var(--ov-border)',
              }}
              className="p-1 hover:text-[var(--ov-text)] transition ml-0.5 border-l"
              title="还原缩放 (100%)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* 复制整表按钮 */}
          <button
            onClick={handleCopySheet}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition"
            title="复制当前工作表全部数据 (TSV)"
          >
            {copiedSheet ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden xl:inline">{copiedSheet ? '已复制' : '复制表'}</span>
          </button>

          {/* 导出下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition"
              title="导出当前工作表（包含已编辑内容）"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xl:inline">导出</span>
            </button>

            {showExportMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 top-full mt-1 w-36 rounded-md shadow-xl border py-1 z-50 text-xs backdrop-blur"
                onClick={() => setShowExportMenu(false)}
              >
                <button
                  onClick={() => handleExport('csv')}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] flex items-center gap-2 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>导出为 CSV</span>
                </button>
                <button
                  onClick={() => handleExport('tsv')}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] flex items-center gap-2 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>导出为 TSV</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] flex items-center gap-2 transition"
                >
                  <Code className="w-3.5 h-3.5 text-blue-400" />
                  <span>导出为 JSON</span>
                </button>
                <button
                  onClick={() => handleExport('md')}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] flex items-center gap-2 transition"
                >
                  <Table className="w-3.5 h-3.5 text-amber-400" />
                  <span>导出为 Markdown</span>
                </button>
              </div>
            )}
          </div>

          {/* 工作簿属性与信息 */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{
              borderColor: showInfo ? 'rgba(59, 130, 246, 0.4)' : 'var(--ov-border)',
              backgroundColor: showInfo ? 'rgba(59, 130, 246, 0.15)' : 'var(--ov-surface)',
              color: showInfo ? '#60a5fa' : 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
            title="查看工作簿元数据与出版属性"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* 全屏放映 */}
          <button
            onClick={toggleFullscreen}
            style={{
              borderColor: 'var(--ov-border)',
              backgroundColor: 'var(--ov-surface)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
            title={isFullscreen ? '退出全屏' : '全屏展开数据网格'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 主工作区：仅保留 Univer 专业可编辑电子表格工作台 */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden" style={{ backgroundColor: 'var(--ov-bg)' }}>
        {loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur z-30"
            style={{ backgroundColor: 'var(--ov-bg, rgba(20,20,20,0.85))' }}
          >
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs" style={{ color: 'var(--ov-text-secondary)' }}>
              正在解析 Excel 工作簿与装载 Univer 可编辑表格引擎...
            </p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="p-3 rounded-full bg-red-500/10 text-red-400 mb-3 border border-red-500/20">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-medium text-red-400 mb-1">工作簿解析异常</h3>
            <p className="text-xs max-w-md mb-4" style={{ color: 'var(--ov-text-secondary)' }}>
              {error}
            </p>
            <button
              onClick={loadWorkbook}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
            >
              重试载入
            </button>
          </div>
        )}

        {!loading && !error && workbook && (
          <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
            <React.Suspense
              fallback={
                <div
                  className="flex flex-col items-center justify-center h-full"
                  style={{ backgroundColor: 'var(--ov-bg)' }}
                >
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-xs font-mono" style={{ color: 'var(--ov-text-secondary)' }}>
                    正在动态装载 Univer 专业表格引擎...
                  </span>
                </div>
              }
            >
              <UniverSheetViewer
                workbook={workbook}
                fileName={fileName}
                theme={theme}
                isDarkTheme={isDarkTheme}
                locale={locale}
                zoom={zoom}
                activeSheetIndex={activeSheetIdx}
                onActiveSheetChange={idx => {
                  setActiveSheetIdx(idx);
                  setSortCol(null);
                }}
                searchQuery={searchQuery}
                sortCol={sortCol}
                sortAsc={sortAsc}
                onSortColumn={handleSort}
                columnProfiles={columnProfiles}
                onOpenColumnProfile={colIdx => setSelectedProfileCol(colIdx)}
                onWorkbookChange={handleWorkbookChange}
              />
            </React.Suspense>
          </div>
        )}
      </div>

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="w-full max-w-md border rounded-lg shadow-2xl overflow-hidden flex flex-col"
          >
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="flex items-center justify-between px-4 py-3 border-b"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel 工作簿属性 (Workbook Metadata)</span>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                style={{ color: 'var(--ov-text-muted)' }}
                className="hover:text-[var(--ov-text)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs" style={{ color: 'var(--ov-text)' }}>
              <div
                className="grid grid-cols-3 gap-2 py-1 border-b"
                style={{ borderColor: 'var(--ov-border-subtle, rgba(128,128,128,0.2))' }}
              >
                <span style={{ color: 'var(--ov-text-secondary)' }}>文档标题</span>
                <span className="col-span-2 font-medium truncate" style={{ color: 'var(--ov-text)' }}>
                  {workbook.metadata.title || fileName}
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-2 py-1 border-b"
                style={{ borderColor: 'var(--ov-border-subtle, rgba(128,128,128,0.2))' }}
              >
                <span style={{ color: 'var(--ov-text-secondary)' }}>作者 / 创建者</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>
                  {workbook.metadata.creator || '未署名'}
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-2 py-1 border-b"
                style={{ borderColor: 'var(--ov-border-subtle, rgba(128,128,128,0.2))' }}
              >
                <span style={{ color: 'var(--ov-text-secondary)' }}>最后修订人</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>
                  {workbook.metadata.lastModifiedBy || '未记录'}
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-2 py-1 border-b"
                style={{ borderColor: 'var(--ov-border-subtle, rgba(128,128,128,0.2))' }}
              >
                <span style={{ color: 'var(--ov-text-secondary)' }}>生成应用程序</span>
                <span className="col-span-2 truncate" style={{ color: 'var(--ov-text)' }}>
                  {workbook.metadata.application || 'Microsoft Excel / OmniView'}
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-2 py-1 border-b"
                style={{ borderColor: 'var(--ov-border-subtle, rgba(128,128,128,0.2))' }}
              >
                <span style={{ color: 'var(--ov-text-secondary)' }}>创建时间</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>
                  {workbook.metadata.created || '无'}
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-2 py-1 border-b"
                style={{ borderColor: 'var(--ov-border-subtle, rgba(128,128,128,0.2))' }}
              >
                <span style={{ color: 'var(--ov-text-secondary)' }}>修改时间</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>
                  {workbook.metadata.modified || '无'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1">
                <span style={{ color: 'var(--ov-text-secondary)' }}>包含工作表</span>
                <span className="col-span-2 text-emerald-400 font-medium">
                  {workbook.sheets.map(s => s.name).join(', ')}
                </span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="px-4 py-2.5 border-t flex justify-end"
            >
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="px-3 py-1 rounded border text-xs font-medium hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition"
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
