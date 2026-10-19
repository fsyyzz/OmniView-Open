/**
 * Markdown 代码块组件 (支持行号、Prism 高亮、折叠、多语言悬浮提示、一键纯文本复制、Word 原生双列表格复制、
 * P1 增强：Shell 智能去提示符复制 + JSON/YAML/CSV/TSV 原地结构化视图切换)
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Maximize2,
  FileText,
  ChevronDown as ChevronMenu,
  Terminal,
  Table2,
  Code2,
} from 'lucide-react';
import { highlightCode } from '../../../../../shared/lib/prismLanguages';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { CodeLightboxModal } from './CodeLightboxModal';
import { copyCodeAsWordTable } from '../../../lib/wordClipboardHelper';
import {
  hasExplicitShellPrompts,
  stripShellPrompts,
  isStructuredDataLang,
  parseStructuredCodeBlock,
} from '../../../lib/codeBlockEnhancer';

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
  const [isCleanCmdCopied, setIsCleanCmdCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'structured'>('code');
  const menuRef = useRef<HTMLDivElement>(null);

  const codeLines = useMemo(() => code.split('\n'), [code]);
  const highlightedHtml = useMemo(() => highlightCode(code, lang), [code, lang]);
  const hasShellPrompt = useMemo(() => hasExplicitShellPrompts(code), [code]);
  const isStructured = useMemo(() => isStructuredDataLang(lang), [lang]);
  const structuredPreview = useMemo(
    () => (isStructured && viewMode === 'structured' ? parseStructuredCodeBlock(lang, code) : null),
    [isStructured, viewMode, lang, code]
  );

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

  const handleCopyCleanShellCommands = useCallback(async () => {
    try {
      const cleaned = stripShellPrompts(code);
      await navigator.clipboard.writeText(cleaned);
      setIsCleanCmdCopied(true);
      setShowCopyMenu(false);
      setTimeout(() => setIsCleanCmdCopied(false), 1800);
    } catch {
      // ignore clipboard error
    }
  }, [code]);

  return (
    <>
      <div id={id} className="markdown-code-block group relative" data-lang={lang}>
        {/* Code Card Header */}
        <div className="code-block-header flex items-center justify-between px-4 py-2 bg-[var(--ov-surface-header)] border-b border-[var(--ov-border)] text-xs select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="flex items-center gap-1 text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] transition cursor-pointer"
              title={isCollapsed ? t('expandCode', locale) : t('collapseCode', locale)}
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[var(--ov-accent)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--ov-accent)]" />}
              <span
                className="px-2 py-0.5 rounded border font-semibold text-[11px] uppercase tracking-wider"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--ov-accent) 14%, var(--ov-surface))',
                  borderColor: 'color-mix(in srgb, var(--ov-accent) 32%, var(--ov-border))',
                  color: 'var(--ov-accent)',
                }}
              >
                {lang || 'TEXT'}
              </span>
            </button>
            <span className="text-[var(--ov-text-muted)] text-[11px]">
              {codeLines.length} {t('linesCode', locale)} {isCollapsed && `(${t('collapsed', locale)})`}
            </span>
          </div>
          {/* 统一整合的顶部悬浮操作工具条：默认不显示，鼠标悬浮时整体优雅浮现 */}
          <div
            className={`code-block-toolbar flex items-center gap-1.5 transition-all duration-200 ${
              showCopyMenu || viewMode === 'structured'
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
            }`}
          >
            {/* P1: JSON / YAML / CSV / TSV 原地结构化视图切换 */}
            {isStructured && (
              <button
                type="button"
                onClick={() => {
                  if (isCollapsed) onToggleCollapse();
                  setViewMode(m => (m === 'code' ? 'structured' : 'code'));
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition shadow-xs cursor-pointer ${
                  viewMode === 'structured'
                    ? 'bg-[var(--ov-accent)] text-[var(--ov-text-on-accent,#ffffff)] border-[var(--ov-accent)] font-medium'
                    : 'bg-[var(--ov-surface)] hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] border-[var(--ov-border)]'
                }`}
                title={
                  viewMode === 'structured'
                    ? locale === 'zh-CN'
                      ? '切回代码源码视图'
                      : 'Switch to Code View'
                    : locale === 'zh-CN'
                    ? '切换为结构化表格/键值树视图'
                    : 'Switch to Structured View'
                }
                aria-label="Toggle Structured View"
              >
                {viewMode === 'structured' ? <Code2 className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
                <span>
                  {viewMode === 'structured'
                    ? locale === 'zh-CN'
                      ? '代码视图'
                      : 'Code'
                    : locale === 'zh-CN'
                    ? '结构化视图'
                    : 'Structured'}
                </span>
              </button>
            )}

            {/* P1: Shell / Terminal 智能剥离 $ 提示符纯命令复制 */}
            {hasShellPrompt && (
              <button
                type="button"
                onClick={handleCopyCleanShellCommands}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--ov-surface)] hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] border border-[var(--ov-border)] text-[11px] transition shadow-xs cursor-pointer"
                title={
                  locale === 'zh-CN'
                    ? '复制纯净命令（自动剥离 $ / > 提示符与非命令输出行）'
                    : 'Copy clean commands (strip $ prompts and output lines)'
                }
                aria-label="Copy Clean Shell Commands"
              >
                {isCleanCmdCopied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Terminal className="w-3 h-3 text-[var(--ov-accent)]" />
                )}
                <span>{locale === 'zh-CN' ? '纯命令' : 'Clean Cmd'}</span>
              </button>
            )}

            {/* 1. 折叠 / 展开按钮 */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--ov-surface)] hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] border border-[var(--ov-border)] text-[11px] transition shadow-xs cursor-pointer"
              title={isCollapsed ? t('expandCode', locale) : t('collapseCode', locale)}
              aria-label={isCollapsed ? t('expandCode', locale) : t('collapseCode', locale)}
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3 text-[var(--ov-accent)]" /> : <ChevronDown className="w-3 h-3 text-[var(--ov-accent)]" />}
              <span>{isCollapsed ? (locale === 'zh-CN' ? '展开' : 'Expand') : (locale === 'zh-CN' ? '折叠' : 'Collapse')}</span>
            </button>

            {/* 2. 全屏独立灯箱按钮 */}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-1 rounded bg-[var(--ov-surface)] hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] border border-[var(--ov-border)] transition shadow-xs cursor-pointer"
              title={t('codeFullscreen', locale)}
              aria-label={t('codeFullscreen', locale)}
            >
              <Maximize2 size={13} />
            </button>

            {/* 3. 复制按钮组合 (主按钮复制纯代码，下拉选项可复制为 Word 原生带行号富文本表格 / 纯命令) */}
            <div className="relative inline-flex items-center" ref={menuRef}>
              <div className="inline-flex items-center rounded bg-[var(--ov-surface)] border border-[var(--ov-border)] text-[var(--ov-text-secondary)] transition shadow-xs">
                <button
                  type="button"
                  onClick={onCopy}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] rounded-l text-[11px] transition cursor-pointer"
                  title={t('copyCodePlain', locale)}
                  aria-label={t('copyCode', locale)}
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? t('copied', locale) : (locale === 'zh-CN' ? '复制' : 'Copy')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCopyMenu((v) => !v)}
                  className="px-1.5 py-0.5 border-l border-[var(--ov-border)] hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] rounded-r text-[var(--ov-text-muted)] transition cursor-pointer"
                  title={t('copyCodeWithLineNumbers', locale)}
                  aria-label={t('copyCodeWithLineNumbers', locale)}
                >
                  <ChevronMenu className="w-3 h-3" />
                </button>
              </div>

              {/* 复制模式下拉气泡 */}
              {showCopyMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-64 p-1 rounded-lg bg-[var(--ov-surface-header,var(--ov-surface))] border border-[var(--ov-border)] shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                    boxShadow: 'var(--ov-shadow, 0 10px 25px rgba(0, 0, 0, 0.28))',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onCopy();
                      setShowCopyMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[var(--ov-accent)] shrink-0" />
                    <div>
                      <div className="font-medium">{locale === 'zh-CN' ? '复制纯代码文本' : 'Copy Plain Code'}</div>
                      <div className="text-[10px] text-[var(--ov-text-muted)]">{locale === 'zh-CN' ? '无行号，便于粘贴到 IDE / 终端执行' : 'Without line numbers, ready for IDE / Terminal'}</div>
                    </div>
                  </button>

                  {hasShellPrompt && (
                    <button
                      type="button"
                      onClick={handleCopyCleanShellCommands}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-medium flex items-center gap-1">
                          <span>{locale === 'zh-CN' ? '复制纯净终端命令 (去 $)' : 'Copy Clean Shell Commands'}</span>
                          {isCleanCmdCopied && <Check className="w-3 h-3 text-emerald-500" />}
                        </div>
                        <div className="text-[10px] text-[var(--ov-text-muted)]">
                          {locale === 'zh-CN' ? '自动剥离 $ / PS> 提示符与非命令回显' : 'Strip $ / PS> prompts & terminal output'}
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyWordTable}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--ov-surface-hover)] text-left text-[var(--ov-text)] transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        <span>{locale === 'zh-CN' ? '复制为 Word 原生代码表格' : 'Copy as Word Code Table'}</span>
                        {isWordCopied && <Check className="w-3 h-3 text-emerald-500" />}
                      </div>
                      <div className="text-[10px] text-[var(--ov-text-muted)]">{locale === 'zh-CN' ? '双列排版：含左侧行号、浅灰底纹与语法高亮' : '2-column layout: line numbers + syntax highlighting'}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Body or Structured Preview Body */}
        {!isCollapsed &&
          (viewMode === 'structured' && structuredPreview ? (
            <div className="code-structured-preview overflow-x-auto bg-[var(--ov-surface)] text-xs p-3 border-t border-[var(--ov-border)]/40">
              {structuredPreview.kind === 'error' ? (
                <div className="px-3 py-2 rounded border border-[var(--ov-border)] bg-[var(--ov-surface-header)] text-[var(--ov-text-secondary)] font-mono">
                  {structuredPreview.message}
                </div>
              ) : structuredPreview.kind === 'table' ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--ov-border)]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[var(--ov-surface-header)] border-b border-[var(--ov-border)]">
                        <th className="px-2.5 py-1.5 font-mono text-[10px] text-[var(--ov-text-muted)] w-10 text-center border-r border-[var(--ov-border)]">
                          #
                        </th>
                        {structuredPreview.headers.map((h, idx) => (
                          <th
                            key={`th-${idx}`}
                            className="px-3 py-1.5 font-semibold text-[var(--ov-text)] border-r last:border-r-0 border-[var(--ov-border)]"
                          >
                            {h || `Col ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {structuredPreview.rows.map((row, rIdx) => (
                        <tr
                          key={`row-${rIdx}`}
                          className="border-b last:border-b-0 border-[var(--ov-border)] hover:bg-[var(--ov-surface-hover)] transition"
                        >
                          <td className="px-2.5 py-1.5 font-mono text-[10px] text-[var(--ov-text-muted)] text-center border-r border-[var(--ov-border)]">
                            {rIdx + 1}
                          </td>
                          {structuredPreview.headers.map((_, cIdx) => (
                            <td
                              key={`cell-${rIdx}-${cIdx}`}
                              className="px-3 py-1.5 font-mono text-[var(--ov-text)] border-r last:border-r-0 border-[var(--ov-border)]"
                            >
                              {row[cIdx] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--ov-border)] divide-y divide-[var(--ov-border)] overflow-hidden">
                  {structuredPreview.entries.map((entry, idx) => (
                    <div
                      key={`${entry.path}-${idx}`}
                      className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] transition font-mono text-[11px]"
                      style={{ paddingLeft: `${12 + entry.depth * 16}px` }}
                    >
                      <span className="font-semibold text-[var(--ov-accent)] mr-3 shrink-0">{entry.key}</span>
                      <span className="text-[var(--ov-text)] truncate max-w-[70%]" title={entry.value}>
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="code-block-body overflow-x-auto flex bg-[var(--ov-code-bg)] text-xs leading-relaxed" data-lang={lang}>
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
          ))}
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


