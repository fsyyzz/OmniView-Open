/**
 * OmniView 系统运行与诊断日志查看器 (LogViewerModal.tsx)
 * 支持分级高亮过滤、实时刷新、一键复制诊断信息与下载 .log 文件
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Filter,
  Search,
  FileCode,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import { appLogger } from '../../../shared/lib/appLogger';
import type { AppLogItem, LogLevel } from '../../../shared/lib/indexedDbStorage';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearLogs?: () => void;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  isOpen,
  onClose,
  onClearLogs,
}) => {
  const [logs, setLogs] = useState<AppLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const items = await appLogger.loadLogs({ limit: 1000 });
      setLogs(items);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchLogs();
      const unsubscribe = appLogger.subscribe(() => {
        void fetchLogs();
      });
      return unsubscribe;
    }
  }, [isOpen, fetchLogs]);

  // 按级别与关键词过滤
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (selectedLevel !== 'all' && item.level !== selectedLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inMsg = item.message.toLowerCase().includes(q);
        const inSrc = item.source.toLowerCase().includes(q);
        const inDetails = item.details ? item.details.toLowerCase().includes(q) : false;
        return inMsg || inSrc || inDetails;
      }
      return true;
    });
  }, [logs, selectedLevel, searchQuery]);

  // 统计各类级别数量
  const counts = useMemo(() => {
    const res = { all: logs.length, error: 0, warn: 0, info: 0, debug: 0 };
    for (const item of logs) {
      if (item.level in res) {
        res[item.level]++;
      }
    }
    return res;
  }, [logs]);

  // 复制日志
  const handleCopyLogs = async () => {
    try {
      const text = await appLogger.exportLogsAsText({
        level: selectedLevel === 'all' ? undefined : selectedLevel,
      });
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatusText('已复制过滤后的诊断日志到剪贴板');
      setTimeout(() => {
        setCopied(false);
        setStatusText(null);
      }, 2500);
    } catch {
      setStatusText('复制失败，请重试');
    }
  };

  // 下载日志文件 (.log / .json / 诊断报告)
  const handleDownloadLogs = async (format: 'log' | 'json' | 'report') => {
    setShowExportMenu(false);
    try {
      const dateTag = new Date().toISOString().replace(/[:.]/g, '-');
      const levelFilter = selectedLevel === 'all' ? undefined : selectedLevel;

      if (format === 'json') {
        const jsonText = await appLogger.exportLogsAsJson({ level: levelFilter });
        appLogger.downloadFile(`omniview-logs-${dateTag}.json`, jsonText, 'application/json;charset=utf-8');
        setStatusText('已导出结构化 JSON 日志');
      } else if (format === 'report') {
        const reportText = await appLogger.exportSystemDiagnostics();
        appLogger.downloadFile(`omniview-diagnostics-report-${dateTag}.md`, reportText, 'text/markdown;charset=utf-8');
        setStatusText('已生成全景系统诊断报告 (.md)');
      } else {
        const logText = await appLogger.exportLogsAsText({ level: levelFilter });
        appLogger.downloadFile(`omniview-diagnostics-${dateTag}.log`, logText, 'text/plain;charset=utf-8');
        setStatusText('已导出标准 .log 诊断日志');
      }

      setTimeout(() => setStatusText(null), 2500);
    } catch {
      setStatusText('导出日志失败');
    }
  };

  // 清空日志
  const handleClear = async () => {
    if (window.confirm('确定要清空全部运行与诊断日志吗？已持久化到 IndexedDB 的记录也将被清除。')) {
      await appLogger.clearLogs();
      setLogs([]);
      onClearLogs?.();
      setStatusText('日志已彻底清空');
      setTimeout(() => setStatusText(null), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-850/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-white flex items-center gap-2">
                <span>系统运行与诊断日志中枢</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {filteredLogs.length} / {logs.length} 条
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                支持分级过滤、全文搜索、导出 (.log / .json / 诊断报告) 与 IndexedDB 容量自治
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Level Filter Tabs & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setSelectedLevel('all')}
                className={`px-2.5 py-1 rounded text-xs transition ${
                  selectedLevel === 'all'
                    ? 'bg-slate-800 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                全部 ({counts.all})
              </button>
              <button
                onClick={() => setSelectedLevel('error')}
                className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                  selectedLevel === 'error'
                    ? 'bg-rose-950/80 text-rose-300 font-medium border border-rose-800/60 shadow-xs'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                <span>错误 ({counts.error})</span>
              </button>
              <button
                onClick={() => setSelectedLevel('warn')}
                className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                  selectedLevel === 'warn'
                    ? 'bg-amber-950/80 text-amber-300 font-medium border border-amber-800/60 shadow-xs'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>警告 ({counts.warn})</span>
              </button>
              <button
                onClick={() => setSelectedLevel('info')}
                className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                  selectedLevel === 'info'
                    ? 'bg-blue-950/80 text-blue-300 font-medium border border-blue-800/60 shadow-xs'
                    : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                <Info className="w-3 h-3" />
                <span>信息 ({counts.info})</span>
              </button>
            </div>

            {/* 搜索框 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索日志消息/模块..."
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 w-44 sm:w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 relative">
            {statusText && (
              <span className="text-[11px] text-emerald-400 font-mono animate-pulse">
                {statusText}
              </span>
            )}
            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition text-xs"
              title="复制过滤后的诊断日志到剪贴板"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制日志'}</span>
            </button>

            {/* 导出下拉组合 */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition text-xs shadow-xs"
                title="导出日志"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出日志</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 py-1 text-xs divide-y divide-slate-800">
                  <button
                    onClick={() => handleDownloadLogs('log')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>导出 .log 文本</span>
                  </button>
                  <button
                    onClick={() => handleDownloadLogs('json')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>导出 .json 数据</span>
                  </button>
                  <button
                    onClick={() => handleDownloadLogs('report')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>生成全景诊断报告 (.md)</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={fetchLogs}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
              title="刷新最新日志"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={handleClear}
              disabled={logs.length === 0}
              className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
              title="清空日志数据库"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空</span>
            </button>
          </div>
        </div>

        {/* Log Stream Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] bg-slate-950/80">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <div>暂无符合条件的日志记录</div>
            </div>
          ) : (
            filteredLogs.map((item) => {
              const dateStr = new Date(item.timestamp).toLocaleTimeString();
              const isErr = item.level === 'error';
              const isWarn = item.level === 'warn';
              const isDbg = item.level === 'debug';

              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-lg border leading-relaxed transition ${
                    isErr
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                      : isDbg
                      ? 'bg-slate-900/50 border-slate-850 text-slate-400'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                          isErr
                            ? 'bg-rose-500 text-white'
                            : isWarn
                            ? 'bg-amber-500 text-slate-950'
                            : isDbg
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {item.level}
                      </span>
                      <span className="text-slate-400 font-semibold">[{item.source}]</span>
                    </div>
                    <span className="text-slate-500">{dateStr}</span>
                  </div>
                  <div className="break-all whitespace-pre-wrap">{item.message}</div>
                  {item.details && (
                    <pre className="mt-1.5 p-2 rounded bg-black/40 text-[10px] text-slate-400 overflow-x-auto max-h-32 border border-slate-800/60">
                      {item.details}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
