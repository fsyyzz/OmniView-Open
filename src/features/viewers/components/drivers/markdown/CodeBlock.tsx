/**
 * Markdown 代码块组件 (支持行号、Prism 高亮、折叠、多语言悬浮提示、一键纯文本复制与 Word 原生双列表格复制)
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, ChevronRight, ChevronDown, Maximize2, FileText, ChevronDown as ChevronMenu } from 'lucide-react';
import { highlightCode } from '../../../../../shared/lib/prismLanguages';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { CodeLightboxModal } from './CodeLightboxModal';
import { copyCodeAsWordTable } from '../../../lib/wordClipboardHelper';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWordCopied, setIsWordCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const codeLines = useMemo(() => code.split('\n'), [code]);
  const highlightedHtml = useMemo(() => highlightCode(code, lang), [code, lang]);

  // 点击外部收起复制下拉菜单
  useEffect(() => {
    if (!showCopyMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCopyMenu]);

  const handleCopyWordTable = useCallback(async () => {
    const success = await copyCodeAsWordTable(code, highlightedHtml, lang);
    if (success) {
      setIsWordCopied(true);
      setShowCopyMenu(false);
      setTimeout(() => setIsWordCopied(false), 2000);
    }
  }, [code, highlightedHtml, lang]);

  return (
    <>
      <div id={id} className="markdown-code-block group relative">
        {/* Code Card Header */}
        <div className="code-block-header flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-800 text-xs select-none">
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
              onClick={() => setIsFullscreen(true)}
              className="p-1 hover:bg-slate-700/60 text-slate-400 hover:text-cyan-300 rounded transition"
              title={t('codeFullscreen', locale)}
              aria-label={t('codeFullscreen', locale)}
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={onToggleCollapse}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700/50 transition"
              title={isCollapsed ? t('expandCode', locale) : t('collapseCode', locale)}
            >
              {isCollapsed ? (locale === 'zh-CN' ? '展开' : 'Expand') : (locale === 'zh-CN' ? '折叠' : 'Collapse')}
            </button>

            {/* 复制按钮组合 (主按钮复制纯代码，下拉选项可复制为 Word 原生带行号富文本表格) */}
            <div className="relative inline-flex items-center" ref={menuRef}>
              <div className="diagram-hover-actions inline-flex items-center rounded bg-slate-800 border border-slate-700/60 text-slate-300 transition opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                <button
                  type="button"
                  onClick={onCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-slate-700 hover:text-white rounded-l text-xs transition"
                  title={t('copyCodePlain', locale)}
                  aria-label={t('copyCode', locale)}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isCopied ? t('copied', locale) : (locale === 'zh-CN' ? '复制' : 'Copy')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCopyMenu((v) => !v)}
                  className="px-1.5 py-1 border-l border-slate-700/60 hover:bg-slate-700 hover:text-white rounded-r text-slate-400 transition"
                  title={t('copyCodeWithLineNumbers', locale)}
                  aria-label={t('copyCodeWithLineNumbers', locale)}
                >
                  <ChevronMenu className="w-3 h-3" />
                </button>
              </div>

              {/* 复制模式下拉气泡 */}
              {showCopyMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-64 p-1 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      onCopy();
                      setShowCopyMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800 text-left text-slate-200 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <div>
                      <div className="font-medium">{locale === 'zh-CN' ? '复制纯代码文本' : 'Copy Plain Code'}</div>
                      <div className="text-[10px] text-slate-400">{locale === 'zh-CN' ? '无行号，便于粘贴到 IDE / 终端执行' : 'Without line numbers, ready for IDE / Terminal'}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyWordTable}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800 text-left text-slate-200 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        <span>{locale === 'zh-CN' ? '复制为 Word 原生代码表格' : 'Copy as Word Code Table'}</span>
                        {isWordCopied && <Check className="w-3 h-3 text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400">{locale === 'zh-CN' ? '双列排版：含左侧行号、浅灰底纹与语法高亮' : '2-column layout: line numbers + syntax highlighting'}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Body */}
        {!isCollapsed && (
          <div className="code-block-body overflow-x-auto flex bg-[var(--ov-code-bg)] text-xs leading-relaxed">
            <div
              className="code-line-gutter py-3.5 pl-3.5 pr-2.5 text-right select-none bg-[var(--ov-surface-header)]/60 text-[var(--ov-text-muted)] border-r border-[var(--ov-border)] font-mono shrink-0 min-w-[44px]"
              aria-hidden="true"
            >
              {codeLines.map((_, i) => (
                <div key={i} className="code-line-number">
                  {i + 1}
                </div>
              ))}
            </div>
            <pre className="code-line-body p-3.5 font-mono overflow-x-auto flex-1 !m-0 !bg-transparent !p-3.5">
              <code
                className={`language-${lang}`}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </pre>
          </div>
        )}
      </div>

      {isFullscreen && (
        <CodeLightboxModal
          lang={lang}
          code={code}
          onClose={() => setIsFullscreen(false)}
          locale={locale}
        />
      )}
    </>
  );
});

CodeBlock.displayName = 'CodeBlock';

