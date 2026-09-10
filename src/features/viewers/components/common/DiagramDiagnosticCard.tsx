/**
 * 图表与公式结构化错误诊断与修复卡片 (DiagramDiagnosticCard)
 * 支持错误分类、Markdown 行号精准定位、可能原因推断、一键应用修复与代码贴回
 */
import React, { useState } from 'react';
import {
  AlertTriangle,
  Zap,
  ExternalLink,
  Code,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  HelpCircle,
  Wrench,
} from 'lucide-react';
import { DiagramDiagnostic } from '../../lib/diagramDiagnostics';
import { Locale, t } from '../../../../shared/lib/i18n';

export interface DiagramDiagnosticCardProps {
  diagnostic: DiagramDiagnostic;
  locale?: Locale;
  isRestored?: boolean;
  onApplyQuickFix?: (fixedCode: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
  onToggleCodeView?: () => void;
  onReRender?: () => void;
}

export const DiagramDiagnosticCard: React.FC<DiagramDiagnosticCardProps> = ({
  diagnostic,
  locale = 'zh-CN',
  isRestored = false,
  onApplyQuickFix,
  onOpenSourceAtLine,
  onToggleCodeView,
  onReRender,
}) => {
  const [copiedReport, setCopiedReport] = useState(false);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);

  const {
    diagramTitle,
    errorCategory,
    rawError,
    markdownStartLine,
    markdownEndLine,
    absoluteErrorLine,
    causes,
    suggestions,
  } = diagnostic;

  const handleCopyReport = () => {
    const reportText = [
      `[OmniView Diagram Diagnostic Report]`,
      `Diagram: ${diagramTitle}`,
      `Category: ${errorCategory}`,
      markdownStartLine && markdownEndLine
        ? `Location: Lines ${markdownStartLine}-${markdownEndLine}`
        : '',
      absoluteErrorLine ? `Error Line: Line ${absoluteErrorLine}` : '',
      `Reason:\n${rawError}`,
      `Possible Causes:\n${causes.map(c => `• ${c}`).join('\n')}`,
      suggestions.length > 0
        ? `Suggestions:\n${suggestions.map(s => `• ${s.title}: ${s.description}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const lineRangeText =
    markdownStartLine && markdownEndLine
      ? t('lineRange', locale)
          .replace('{start}', String(markdownStartLine))
          .replace('{end}', String(markdownEndLine))
      : undefined;

  const targetJumpLine = absoluteErrorLine || markdownStartLine;

  return (
    <div className="w-full max-w-2xl my-3 rounded-xl border border-rose-800/60 bg-slate-950/90 shadow-2xl overflow-hidden text-left font-sans transition-all duration-200">
      {/* Header Banner */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-900/90 border-b border-rose-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-rose-200 text-xs tracking-wide">
                {t('diagramRenderFailed', locale)}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-rose-950/80 text-rose-300 border border-rose-800/60">
                {diagramTitle}
              </span>
            </div>
            {lineRangeText && (
              <span className="text-[11px] text-slate-400 font-mono">
                {lineRangeText}
                {absoluteErrorLine && (
                  <span className="text-rose-400 font-semibold ml-1.5">
                    ({t('errorLine', locale).replace('{line}', String(absoluteErrorLine))})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {isRestored && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[11px] font-medium animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('previewRestored', locale)}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3.5 text-xs">
        {/* Error Reason */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
            <span className="text-rose-300 font-semibold">{t('errorReason', locale)}</span>
            <span className="text-slate-500 font-mono text-[10px]">{errorCategory}</span>
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-rose-300 bg-rose-950/40 border border-rose-900/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-32 select-text">
            {rawError}
          </div>
        </div>

        {/* Possible Causes */}
        {causes.length > 0 && (
          <div className="space-y-1.5 bg-slate-900/80 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{t('possibleCauses', locale)}</span>
            </div>
            <ul className="space-y-1 pl-1 text-[11px] text-slate-300">
              {causes.map((cause, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-amber-400 shrink-0 font-bold">•</span>
                  <span>{cause}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fix Suggestions & Quick Fix */}
        {suggestions.length > 0 && (
          <div className="space-y-2 bg-slate-900/90 border border-cyan-900/40 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
              <Wrench className="w-3.5 h-3.5" />
              <span>{t('fixSuggestions', locale)}</span>
            </div>
            <div className="space-y-2">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md bg-slate-950/70 border border-slate-800"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-200 text-[11px]">{sug.title}</div>
                    <div className="text-[10px] text-slate-400">{sug.description}</div>
                  </div>
                  {sug.suggestedCode && onApplyQuickFix && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyQuickFix(sug.suggestedCode!);
                        setAppliedIndex(idx);
                      }}
                      className="self-start sm:self-auto shrink-0 flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-[11px] rounded shadow-md transition transform active:scale-95"
                    >
                      <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                      <span>
                        {appliedIndex === idx ? t('previewRestored', locale) : t('applyQuickFix', locale)}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            {targetJumpLine && onOpenSourceAtLine && (
              <button
                type="button"
                onClick={() => onOpenSourceAtLine(targetJumpLine)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 rounded-lg text-xs font-medium transition"
                title={t('openSourceAtLine', locale).replace('{line}', String(targetJumpLine))}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {t('openSourceAtLine', locale).replace('{line}', String(targetJumpLine))}
                </span>
              </button>
            )}

            {onToggleCodeView && (
              <button
                type="button"
                onClick={onToggleCodeView}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 rounded-lg text-xs transition"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{t('viewSource', locale)}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onReRender && (
              <button
                type="button"
                onClick={onReRender}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 rounded-lg text-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('reRender', locale)}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 rounded-lg text-xs transition"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">{t('errorCopied', locale)}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('copyErrorReport', locale)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
