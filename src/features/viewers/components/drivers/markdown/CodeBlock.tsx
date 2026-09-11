/**
 * Markdown 代码块组件 (支持行号、Prism 高亮、折叠、多语言悬浮提示与一键复制)
 */
import React, { useMemo } from 'react';
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { highlightCode } from '../../../../../shared/lib/prismLanguages';
import { Locale, t } from '../../../../../shared/lib/i18n';

interface CodeBlockProps {
  id: string;
  lang?: string;
  code: string;
  isCollapsed: boolean;
  isCopied: boolean;
  onToggleCollapse: () => void;
  onCopy: () => void;
  locale?: Locale;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(({
  id,
  lang = 'text',
  code,
  isCollapsed,
  isCopied,
  onToggleCollapse,
  onCopy,
  locale = 'zh-CN',
}) => {
  const codeLines = useMemo(() => code.split('\n'), [code]);
  const highlightedHtml = useMemo(() => highlightCode(code, lang), [code, lang]);

  return (
    <div id={id} className="markdown-code-block group relative">
      {/* Code Card Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-800 text-xs select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
            title={isCollapsed ? t('expandCode', locale) : t('collapseCode', locale)}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-blue-400" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-400" />}
            <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/50 text-blue-400 font-semibold text-[11px] uppercase tracking-wider">
              {lang || 'TEXT'}
            </span>
          </button>
          <span className="text-slate-500 text-[11px]">
            {codeLines.length} {t('linesCode', locale)} {isCollapsed && `(${t('collapsed', locale)})`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700/50 transition"
            title={isCollapsed ? t('expandCode', locale) : t('collapseCode', locale)}
          >
            {isCollapsed ? (locale === 'zh-CN' ? '展开' : 'Expand') : (locale === 'zh-CN' ? '折叠' : 'Collapse')}
          </button>
          <button
            onClick={onCopy}
            className="diagram-hover-actions flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs transition opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
            title={t('copyCode', locale)}
            aria-label={t('copyCode', locale)}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? t('copied', locale) : (locale === 'zh-CN' ? '复制' : 'Copy')}</span>
          </button>
        </div>
      </div>

      {/* Code Body */}
      {!isCollapsed && (
        <div className="overflow-x-auto flex bg-[#1d1f21] text-xs leading-relaxed">
          <div className="py-3.5 pl-3.5 pr-2.5 text-right text-slate-600 select-none bg-black/25 border-r border-slate-800/80 font-mono shrink-0 min-w-[44px]">
            {codeLines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre className="p-3.5 font-mono overflow-x-auto flex-1 !m-0 !bg-transparent !p-3.5">
            <code
              className={`language-${lang}`}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>
        </div>
      )}
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
