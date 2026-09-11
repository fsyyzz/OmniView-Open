/**
 * OmniView Jupyter Notebook (.ipynb) 交互式数据科学工作台驱动
 * 支持交互式单元格折叠、ANSI 彩色 Traceback、多类型富文本输出 (PNG/SVG/HTML/LaTeX)、
 * 搜索过滤、代码一键导出与 A4/PDF 打印排版
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  FileCode,
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Download,
  Printer,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Terminal,
  Code2,
} from 'lucide-react';
import {
  parseJupyterNotebook,
  convertAnsiToHtml,
  exportNotebookToMarkdown,
  exportNotebookToScript,
  type NotebookCell,
} from '../../lib/notebookParser';
import { requestPrintImage } from '../../../../shared/lib/printBridge';
import { useI18n } from '../../../../shared/lib/i18n';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import katex from 'katex';

interface NotebookViewerProps {
  content?: string;
  fileName?: string;
  isDarkTheme?: boolean;
  theme?: string;
  locale?: 'zh-CN' | 'en-US';
  onContentChange?: (content: string) => void;
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({
  content = '',
  fileName = 'notebook.ipynb',
  isDarkTheme = true,
  locale = 'zh-CN',
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCells, setCollapsedCells] = useState<Record<string, boolean>>({});
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);
  const [copiedFullDoc, setCopiedFullDoc] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'code' | 'markdown'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // 解析 Notebook 数据与统计
  const { notebook, error, stats } = useMemo(() => {
    return parseJupyterNotebook(content);
  }, [content]);

  // 过滤单元格
  const filteredCells = useMemo(() => {
    if (!notebook) return [];
    return notebook.cells.filter((cell, idx) => {
      // Tab 过滤
      if (activeTab === 'code' && cell.cell_type !== 'code') return false;
      if (activeTab === 'markdown' && cell.cell_type !== 'markdown') return false;

      // 搜索过滤
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchSource = cell.source.toLowerCase().includes(q);
      const matchOutput = (cell.outputs || []).some((out) => {
        if (out.text && String(out.text).toLowerCase().includes(q)) return true;
        if (out.evalue && out.evalue.toLowerCase().includes(q)) return true;
        return false;
      });
      return matchSource || matchOutput;
    });
  }, [notebook, activeTab, searchQuery]);

  const toggleCellCollapse = (cellKey: string) => {
    setCollapsedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey],
    }));
  };

  const expandAllCells = () => setCollapsedCells({});
  const collapseAllCells = () => {
    if (!notebook) return;
    const next: Record<string, boolean> = {};
    notebook.cells.forEach((c, i) => {
      next[`cell_${c.id || i}`] = true;
    });
    setCollapsedCells(next);
  };

  const handleCopyCode = async (cellKey: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCellId(cellKey);
      setTimeout(() => setCopiedCellId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleExportMarkdown = () => {
    if (!notebook) return;
    const md = exportNotebookToMarkdown(notebook);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.ipynb$/i, '') + '.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportScript = () => {
    if (!notebook) return;
    const script = exportNotebookToScript(notebook);
    const ext = notebook.metadata.language_info?.file_extension || '.py';
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.ipynb$/i, '') + ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // 渲染单个 Markdown 单元格
  const renderMarkdownContent = (source: string) => {
    try {
      // 预处理数学公式
      let processed = source.replace(/\$\$([\s\S]+?)\$\$/g, (_m, f) => {
        try {
          return katex.renderToString(f.trim(), { displayMode: true, throwOnError: false });
        } catch {
          return _m;
        }
      });
      processed = processed.replace(/(?<!\\)\$([^\s\$](?:[^\$\n]*?[^\s\$])?)(?<!\\)\$/g, (_m, f) => {
        try {
          return katex.renderToString(f.trim(), { displayMode: false, throwOnError: false });
        } catch {
          return _m;
        }
      });

      const rawHtml = marked.parse(processed, { async: false }) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
    } catch (e) {
      return <div className="text-sm text-slate-300 whitespace-pre-wrap">{source}</div>;
    }
  };

  if (error || !notebook) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950 text-slate-200">
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-3 text-rose-400">
          <Terminal className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-100 mb-1">
          {locale === 'zh-CN' ? 'Jupyter Notebook 解析错误' : 'Jupyter Notebook Parsing Error'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-4">{error || 'Unable to parse .ipynb JSON'}</p>
        <pre className="text-left text-xs bg-slate-900 border border-slate-800 p-4 rounded-lg max-w-2xl max-h-48 overflow-auto text-slate-300 font-mono">
          {content.slice(0, 1000)}
        </pre>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 顶部工具栏与统计状态栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 gap-3 z-10">
        {/* 左侧：内核元信息与过滤 Tab */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-md text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{stats.kernelName}</span>
            <span className="opacity-40">•</span>
            <span>{stats.language.toUpperCase()}</span>
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                activeTab === 'all' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {locale === 'zh-CN' ? `全部 (${stats.totalCells})` : `All (${stats.totalCells})`}
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                activeTab === 'code' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {locale === 'zh-CN' ? `代码 (${stats.codeCells})` : `Code (${stats.codeCells})`}
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                activeTab === 'markdown' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {locale === 'zh-CN' ? `文档 (${stats.markdownCells})` : `Markdown (${stats.markdownCells})`}
            </button>
          </div>
        </div>

        {/* 中间：实时单元格检索 */}
        <div className="flex-1 max-w-xs relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === 'zh-CN' ? '搜索 Notebook 内容 / 输出...' : 'Search cells & outputs...'}
            className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* 右侧：动作控制区 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={expandAllCells}
            title={locale === 'zh-CN' ? '全部展开' : 'Expand All'}
            className="px-2 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded text-xs transition"
          >
            {locale === 'zh-CN' ? '全部展开' : 'Expand'}
          </button>
          <button
            onClick={collapseAllCells}
            title={locale === 'zh-CN' ? '全部折叠' : 'Collapse All'}
            className="px-2 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded text-xs transition"
          >
            {locale === 'zh-CN' ? '全部折叠' : 'Collapse'}
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={handleExportMarkdown}
            title={locale === 'zh-CN' ? '导出为 Markdown 文档' : 'Export as Markdown'}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded text-xs transition font-medium border border-slate-700"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>.md</span>
          </button>

          <button
            onClick={handleExportScript}
            title={locale === 'zh-CN' ? '导出为纯脚本' : 'Export as Script'}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded text-xs transition font-medium border border-slate-700"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>.py</span>
          </button>

          <button
            onClick={handlePrint}
            title={locale === 'zh-CN' ? '打印 / 导出 PDF (A4 排版)' : 'Print / Export PDF'}
            className="flex items-center gap-1 px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 rounded text-xs transition font-medium border border-sky-500/30"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{locale === 'zh-CN' ? '打印 A4' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* 单元格主浏览流 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-5xl mx-auto w-full">
        {filteredCells.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            {locale === 'zh-CN' ? '未找到匹配的单元格' : 'No matching cells found'}
          </div>
        ) : (
          filteredCells.map((cell, idx) => {
            const cellKey = `cell_${cell.id || idx}`;
            const isCollapsed = Boolean(collapsedCells[cellKey]);
            const isCode = cell.cell_type === 'code';
            const isMarkdown = cell.cell_type === 'markdown';

            return (
              <div
                key={cellKey}
                className="notebook-cell bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition hover:border-slate-700"
              >
                {/* 单元格头部栏 */}
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCellCollapse(cellKey)}
                      className="text-slate-400 hover:text-slate-200 transition p-0.5"
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isCode ? (
                      <span className="font-mono font-bold text-sky-400">
                        In [{cell.execution_count !== null && cell.execution_count !== undefined ? cell.execution_count : ' '}]
                      </span>
                    ) : isMarkdown ? (
                      <span className="flex items-center gap-1 font-medium text-emerald-400">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Markdown</span>
                      </span>
                    ) : (
                      <span className="font-mono text-slate-400">Raw</span>
                    )}

                    <span className="text-slate-600 text-[11px]">#{idx + 1}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCode && (
                      <button
                        onClick={() => handleCopyCode(cellKey, cell.source)}
                        title={locale === 'zh-CN' ? '复制单元格代码' : 'Copy code'}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition px-1.5 py-0.5 rounded hover:bg-slate-800"
                      >
                        {copiedCellId === cellKey ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[11px] text-emerald-400">{locale === 'zh-CN' ? '已复制' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[11px]">{locale === 'zh-CN' ? '复制' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* 单元格内容区 */}
                {!isCollapsed && (
                  <div>
                    {/* 代码/源码区 */}
                    {isCode ? (
                      <div className="p-3.5 bg-slate-950 font-mono text-xs text-slate-100 overflow-x-auto leading-relaxed border-b border-slate-850">
                        <pre className="m-0 whitespace-pre-wrap word-break-break-all">
                          <code>{cell.source}</code>
                        </pre>
                      </div>
                    ) : isMarkdown ? (
                      <div className="p-4 bg-slate-950/40 text-slate-200">
                        {renderMarkdownContent(cell.source)}
                      </div>
                    ) : (
                      <div className="p-3.5 bg-slate-950 font-mono text-xs text-slate-400 whitespace-pre-wrap">
                        {cell.source}
                      </div>
                    )}

                    {/* 输出区 (仅 Code Cell) */}
                    {isCode && cell.outputs && cell.outputs.length > 0 && (
                      <div className="p-3.5 bg-slate-900/40 space-y-3">
                        {cell.outputs.map((out, outIdx) => {
                          // 1. 标准输出 stream
                          if (out.output_type === 'stream') {
                            const isStderr = out.name === 'stderr';
                            const formatted = convertAnsiToHtml(String(out.text || ''));
                            return (
                              <div
                                key={outIdx}
                                className={`font-mono text-xs p-2.5 rounded-lg overflow-x-auto leading-relaxed ${
                                  isStderr ? 'bg-rose-950/30 text-rose-300 border border-rose-900/30' : 'bg-slate-950 text-slate-300'
                                }`}
                              >
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                                  {out.name || 'stream'}
                                </div>
                                <div dangerouslySetInnerHTML={{ __html: formatted }} className="whitespace-pre-wrap" />
                              </div>
                            );
                          }

                          // 2. 富文本与图像输出 (execute_result / display_data)
                          if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
                            const data = out.data || {};
                            return (
                              <div key={outIdx} className="space-y-2">
                                {out.execution_count !== null && out.execution_count !== undefined && (
                                  <div className="text-xs font-mono font-bold text-emerald-400">
                                    Out [{out.execution_count}]:
                                  </div>
                                )}

                                {/* PNG 图像 */}
                                {data['image/png'] && (
                                  <div className="bg-white p-3 rounded-lg flex justify-center max-w-full overflow-x-auto">
                                    <img
                                      src={`data:image/png;base64,${data['image/png']}`}
                                      alt="Cell Output"
                                      className="max-h-[500px] object-contain rounded"
                                    />
                                  </div>
                                )}

                                {/* SVG 图像 */}
                                {data['image/svg+xml'] && (
                                  <div
                                    className="bg-white p-3 rounded-lg flex justify-center max-w-full overflow-x-auto"
                                    dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(
                                        Array.isArray(data['image/svg+xml'])
                                          ? data['image/svg+xml'].join('')
                                          : String(data['image/svg+xml'])
                                      ),
                                    }}
                                  />
                                )}

                                {/* HTML 渲染 */}
                                {data['text/html'] && !data['image/png'] && (
                                  <div
                                    className="p-3 bg-slate-950 rounded-lg overflow-x-auto text-xs text-slate-200"
                                    dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(
                                        Array.isArray(data['text/html'])
                                          ? data['text/html'].join('')
                                          : String(data['text/html'])
                                      ),
                                    }}
                                  />
                                )}

                                {/* Plain Text 回退 */}
                                {data['text/plain'] && !data['image/png'] && !data['text/html'] && (
                                  <pre className="font-mono text-xs p-2.5 bg-slate-950 text-slate-200 rounded-lg overflow-x-auto whitespace-pre-wrap m-0">
                                    {Array.isArray(data['text/plain']) ? data['text/plain'].join('') : data['text/plain']}
                                  </pre>
                                )}
                              </div>
                            );
                          }

                          // 3. Error 错误与异常 Traceback
                          if (out.output_type === 'error') {
                            const tb = (out.traceback || []).join('\n');
                            const formattedTb = convertAnsiToHtml(tb || `${out.ename}: ${out.evalue}`);
                            return (
                              <div
                                key={outIdx}
                                className="font-mono text-xs p-3 bg-rose-950/40 border border-rose-900/40 rounded-lg text-rose-200 overflow-x-auto leading-relaxed"
                              >
                                <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1.5">
                                  <span>⚠️ {out.ename || 'ExecutionError'}</span>
                                  <span>:</span>
                                  <span className="font-normal text-rose-300">{out.evalue}</span>
                                </div>
                                <div dangerouslySetInnerHTML={{ __html: formattedTb }} className="whitespace-pre-wrap text-[11.5px]" />
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotebookViewer;
