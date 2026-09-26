/**
 * OmniView 全屏交互式代码块检视器 (CodeLightboxModal)
 * 提供沉浸式全屏代码审查、行号高亮、自动换行切换、字号缩放、关键词高亮搜索与一键下载 (Portal 渲染)
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  Download,
  Search,
  WrapText,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  FileCode,
} from 'lucide-react';
import { highlightCode } from '../../../../../shared/lib/prismLanguages';
import { Locale, t } from '../../../../../shared/lib/i18n';

interface CodeLightboxModalProps {
  lang?: string;
  code: string;
  title?: string;
  onClose: () => void;
  locale?: Locale;
}

export const CodeLightboxModal: React.FC<CodeLightboxModalProps> = ({
  lang = 'text',
  code,
  title,
  onClose,
  locale = 'zh-CN',
}) => {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [fontSize, setFontSize] = useState<number>(13);
  const [searchQuery, setSearchQuery] = useState('');
  const [bgMode, setBgMode] = useState<'dark' | 'light'>('dark');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const codeLines = useMemo(() => code.split('\n'), [code]);

  // Prism 语法高亮
  const highlightedHtml = useMemo(() => highlightCode(code, lang), [code, lang]);

  // 搜索匹配统计
  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    try {
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return (code.match(regex) || []).length;
    } catch {
      return 0;
    }
  }, [code, searchQuery]);

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    const ext = lang === 'javascript' || lang === 'js' ? 'js'
      : lang === 'typescript' || lang === 'ts' ? 'ts'
      : lang === 'python' || lang === 'py' ? 'py'
      : lang === 'json' ? 'json'
      : lang === 'html' ? 'html'
      : lang === 'css' ? 'css'
      : lang === 'sql' ? 'sql'
      : 'txt';
    const filename = `${title || 'code-snippet'}.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-md select-none animate-fadeIn font-sans">
      {/* 顶部悬浮工具栏 */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md text-xs z-20 shadow-xl gap-3 flex-wrap sm:flex-nowrap">
        {/* 语言与行数元信息 */}
        <div className="flex items-center gap-2.5 text-slate-200 font-medium truncate min-w-0">
          <FileCode size={18} className="text-cyan-400 shrink-0" />
          <span className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-800/60 text-cyan-300 font-mono text-[11px] uppercase font-bold tracking-wider">
            {lang || 'TEXT'}
          </span>
          <span className="truncate text-sm font-semibold text-slate-200">
            {title || t('codeFullscreen', locale)}
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-400">
            {codeLines.length} {t('linesCode', locale)} · {code.length} {t('characters', locale)}
          </span>
        </div>

        {/* 搜索与控制面板 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 搜索栏 */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`${t('searchPlaceholder', locale).slice(0, 10)}... (Ctrl+F)`}
              className="pl-7 pr-7 py-1 bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-36 sm:w-48 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {searchQuery && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-cyan-300 font-mono">
              {matchCount} {t('searchMatches', locale).replace('{cur} / {total}', matchCount.toString())}
            </span>
          )}

          <div className="w-[1px] h-4 bg-slate-800 mx-0.5 hidden sm:block" />

          {/* 自动换行切换 */}
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            className={`p-1.5 rounded-lg transition flex items-center gap-1 text-xs ${
              wrapLines ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title={wrapLines ? t('noWrapLines', locale) : t('wrapLines', locale)}
          >
            <WrapText size={14} />
            <span className="hidden md:inline">{wrapLines ? t('wrapLines', locale) : t('noWrapLines', locale)}</span>
          </button>

          {/* 字号缩放 */}
          <div className="flex items-center gap-0.5 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFontSize(s => Math.max(10, s - 1))}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded"
              title="A-"
            >
              <ZoomOut size={13} />
            </button>
            <span className="font-mono text-[11px] px-1.5 text-cyan-400 font-semibold">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize(s => Math.min(24, s + 1))}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded"
              title="A+"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* 深浅主题 */}
          <button
            type="button"
            onClick={() => setBgMode(m => m === 'dark' ? 'light' : 'dark')}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition"
            title="Theme Mode"
          >
            {bgMode === 'dark' ? <Moon size={14} className="text-indigo-400" /> : <Sun size={14} className="text-amber-400" />}
          </button>

          {/* 复制 */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition flex items-center gap-1"
            title={t('copyCode', locale)}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          {/* 下载 */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition"
            title={t('downloadFile', locale)}
          >
            <Download size={14} />
          </button>

          {/* 关闭 ESC 按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/80 hover:text-rose-100 text-slate-300 transition font-medium border border-slate-700 shadow-sm ml-1"
            title={t('closeFullScreen', locale)}
          >
            <X size={15} />
            <span className="font-mono text-[11px] opacity-80">Esc</span>
          </button>
        </div>
      </div>

      {/* 主代码视口 */}
      <div className={`flex-1 overflow-auto p-4 sm:p-6 transition-colors ${
        bgMode === 'dark' ? 'bg-[var(--ov-code-bg)] text-slate-200' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className="max-w-6xl mx-auto rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden bg-black/20 flex flex-col min-h-full">
          <div className="flex-1 flex font-mono" style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
            {/* 行号 Gutter */}
            <div
              className={`py-4 pl-4 pr-3 text-right select-none border-r font-mono shrink-0 min-w-[52px] ${
                bgMode === 'dark'
                  ? 'bg-slate-900/60 text-slate-600 border-slate-800'
                  : 'bg-slate-200/60 text-slate-400 border-slate-300'
              }`}
            >
              {codeLines.map((_, i) => (
                <div key={i} className="leading-[1.6]">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* 代码主体 */}
            <pre
              className={`p-4 flex-1 m-0 overflow-x-auto ${
                wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
              }`}
            >
              <code
                className={`language-${lang}`}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </pre>
          </div>
        </div>
      </div>

      {/* 底部状态提示 */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-slate-800/80 bg-slate-900/70 text-[11px] text-slate-400 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <span className="font-mono text-cyan-400 font-semibold">{codeLines.length} 行</span>
          <span>Prism.js 语法高亮引擎</span>
          {wrapLines && <span className="text-emerald-400">已开启自动换行</span>}
        </div>
        <div className="flex items-center gap-4 text-slate-500 hidden sm:flex">
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Ctrl+F</kbd> 查找</span>
          <span>按 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Esc</kbd> 退出全屏</span>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
