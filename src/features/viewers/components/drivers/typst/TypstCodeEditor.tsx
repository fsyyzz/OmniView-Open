/**
 * Typst 源码专用编辑器组件 (带行号高亮、语法片段插入、撤销重做、Tab 缩进与字数统计)
 */
import React, { useRef, useMemo, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Undo2,
  Redo2,
  PlusCircle,
  Copy,
  Check,
  Code2,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { TYPST_SNIPPETS, type TypstSnippet } from '../../../lib/typstSnippets';

interface TypstCodeEditorProps {
  code: string;
  originalCode: string;
  fileName: string;
  onChange: (newCode: string) => void;
  onReset: () => void;
  locale?: 'zh-CN' | 'en-US';
}

export const TypstCodeEditor: React.FC<TypstCodeEditorProps> = ({
  code,
  originalCode,
  fileName,
  onChange,
  onReset,
  locale = 'zh-CN',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const linesCount = lines.length;
  const isDirty = code !== originalCode;

  // 滚动同步
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 插入常用 Typst 片段
  const handleInsertSnippet = (snippet: TypstSnippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextVal = code.substring(0, start) + snippet.code + code.substring(end);
    onChange(nextVal);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursor = start + snippet.code.length;
        textareaRef.current.selectionStart = cursor;
        textareaRef.current.selectionEnd = cursor;
      }
    });
  };

  // 支持 Tab 缩进 (2 空格) 与快捷键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextVal = code.substring(0, start) + '  ' + code.substring(end);
      onChange(nextVal);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900/95 border-r border-slate-800 select-text">
      {/* 编辑器顶部状态与片段快捷栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="flex items-center gap-1.5 font-mono text-slate-200 font-semibold truncate">
            <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            {fileName}
          </span>
          {isDirty && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono">
              {locale === 'zh-CN' ? '已修改' : 'MODIFIED'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 flex-shrink-0">
          <span>{linesCount} L</span>
          <span>·</span>
          <span>{code.length} C</span>
          {isDirty && (
            <button
              onClick={onReset}
              title={locale === 'zh-CN' ? '重置为原始代码' : 'Reset to original'}
              className="ml-2 p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleCopy}
            title={locale === 'zh-CN' ? '复制代码' : 'Copy Code'}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 语法快捷片段按钮条 (Snippet Bar) */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1 mr-1">
          <Zap className="w-3 h-3 text-sky-400" />
          {locale === 'zh-CN' ? '快捷片段' : 'Snippets'}:
        </span>
        {TYPST_SNIPPETS.map((snip) => (
          <button
            key={snip.id}
            onClick={() => handleInsertSnippet(snip)}
            title={snip.description}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-sky-300 border border-slate-700/60 transition whitespace-nowrap text-[11px]"
          >
            + {snip.label}
          </button>
        ))}
      </div>

      {/* 主体编辑区（行号 + 文本域） */}
      <div className="flex-1 flex min-h-0 relative font-mono text-xs">
        {/* 行号侧边栏 */}
        <div
          ref={lineNumbersRef}
          className="w-10 flex-shrink-0 bg-slate-950/70 text-slate-600 select-none py-3 px-1 text-right border-r border-slate-800/60 leading-5 overflow-hidden font-mono"
        >
          {lines.map((_, idx) => (
            <div key={idx} className="h-5">
              {idx + 1}
            </div>
          ))}
        </div>

        {/* 源码文本输入域 */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={locale === 'zh-CN' ? '在此编写 Typst 出版级现代排版源码...' : 'Write Typst typesetting code here...'}
          className="flex-1 min-h-0 p-3 bg-transparent text-slate-100 placeholder-slate-600 resize-none outline-none leading-5 font-mono overflow-y-auto selection:bg-sky-500/30"
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
};
