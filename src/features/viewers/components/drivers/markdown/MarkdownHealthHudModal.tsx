/**
 * OmniView Markdown 文档健康度与死链体检浮窗组件 (MarkdownHealthHudModal)
 */
import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  FileSearch,
} from 'lucide-react';
import { Locale } from '../../../../../shared/lib/i18n';
import type { MarkdownHealthReport, MarkdownHealthIssue } from '../../../lib/markdownHealthLinter';

export interface MarkdownHealthHudModalProps {
  isOpen: boolean;
  report: MarkdownHealthReport;
  onClose: () => void;
  onJumpToLine?: (line: number) => void;
  locale?: Locale;
}

export const MarkdownHealthHudModal: React.FC<MarkdownHealthHudModalProps> = ({
  isOpen,
  report,
  onClose,
  onJumpToLine,
  locale = 'zh-CN',
}) => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  if (!isOpen) return null;

  const filteredIssues = report.issues.filter((issue) => {
    if (filter === 'all') return true;
    return issue.severity === filter;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[var(--ov-border)] bg-[var(--ov-surface-header,#1e293b)] text-[var(--ov-text,#e2e8f0)]"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--ov-surface-header, #1e293b)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ov-border)]">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                report.isHealthy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {report.isHealthy ? <ShieldCheck className="w-5 h-5" /> : <FileSearch className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">
                  {locale === 'zh-CN' ? 'Markdown 文档健康度体检' : 'Markdown Health Inspector'}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                    report.score >= 90
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : report.score >= 70
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {report.score} / 100 {locale === 'zh-CN' ? '分' : 'pts'}
                </span>
              </div>
              <p className="text-xs text-[var(--ov-text-muted)] mt-0.5">
                {locale === 'zh-CN'
                  ? `共检测出 ${report.total} 项排版与引用建议 (错误: ${report.errors}, 警告: ${report.warnings}, 提示: ${report.infos})`
                  : `Detected ${report.total} health items (Errors: ${report.errors}, Warnings: ${report.warnings}, Info: ${report.infos})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition"
            title={locale === 'zh-CN' ? '关闭' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[var(--ov-border)] bg-[var(--ov-surface,#0f172a)] text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md transition ${
              filter === 'all'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]'
            }`}
          >
            {locale === 'zh-CN' ? '全部' : 'All'} ({report.total})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
              filter === 'error'
                ? 'bg-rose-600 text-white font-medium'
                : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            {locale === 'zh-CN' ? '错误' : 'Errors'} ({report.errors})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
              filter === 'warning'
                ? 'bg-amber-600 text-white font-medium'
                : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {locale === 'zh-CN' ? '警告' : 'Warnings'} ({report.warnings})
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
              filter === 'info'
                ? 'bg-sky-600 text-white font-medium'
                : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-sky-400" />
            {locale === 'zh-CN' ? '提示' : 'Info'} ({report.infos})
          </button>
        </div>

        {/* Issue List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/80 mb-3" />
              <p className="text-sm font-medium text-[var(--ov-text)]">
                {locale === 'zh-CN' ? '文档未检测到死链或结构缺陷' : 'No broken links or structural defects found'}
              </p>
              <p className="text-xs text-[var(--ov-text-muted)] mt-1">
                {locale === 'zh-CN' ? '所有相对资源与交叉引用均能完整自愈闭环。' : 'All resources and references are fully resolved.'}
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3.5 rounded-lg border border-[var(--ov-border)] bg-[var(--ov-surface,#0f172a)] hover:border-emerald-500/40 transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {issue.severity === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {issue.severity === 'info' && <Info className="w-4 h-4 text-sky-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-[var(--ov-text)]">{issue.message}</span>
                        {issue.line > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Line {issue.line}
                          </span>
                        )}
                      </div>
                      {issue.snippet && (
                        <div className="mt-1.5 font-mono text-[11px] p-1.5 rounded bg-slate-900/80 text-emerald-300/90 overflow-x-auto border border-slate-800/80">
                          {issue.snippet}
                        </div>
                      )}
                      {issue.suggestion && (
                        <div className="mt-1 text-xs text-[var(--ov-text-muted)] flex items-center gap-1.5">
                          <span>💡</span>
                          <span>{issue.suggestion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {onJumpToLine && issue.line > 0 && (
                    <button
                      onClick={() => {
                        onJumpToLine(issue.line);
                        onClose();
                      }}
                      className="p-1 rounded text-xs text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition flex items-center gap-1 shrink-0"
                      title={locale === 'zh-CN' ? '定位至源码对应行' : 'Jump to source line'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{locale === 'zh-CN' ? '跳转' : 'Jump'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

