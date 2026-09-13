/**
 * OmniView SVG XML 源码编辑器 (SVG Code Editor Pane)
 */
import React, { useRef, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Wand2,
  FileCode2,
} from 'lucide-react';
import { SvgValidationResult } from './svgUtils';

interface SvgCodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  originalCode: string;
  validation: SvgValidationResult;
  onFormat: () => void;
  onOptimize: () => void;
  onReset: () => void;
  isOptimizing?: boolean;
  highlightLine?: number | null;
}

export const SvgCodeEditor: React.FC<SvgCodeEditorProps> = ({
  code,
  onChange,
  originalCode,
  validation,
  onFormat,
  onOptimize,
  onReset,
  isOptimizing = false,
  highlightLine = null,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const isDirty = useMemo(() => code !== originalCode, [code, originalCode]);

  // 行数生成与行号
  const linesCount = useMemo(() => {
    return Math.max(1, code.split('\n').length);
  }, [code]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: linesCount }, (_, i) => i + 1);
  }, [linesCount]);

  // 同步滚动
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 监听高亮行变动并平滑滚动到指定行
  useEffect(() => {
    if (highlightLine && highlightLine > 0 && textareaRef.current) {
      const lineHeight = 20; // leading-5 对应 20px
      const targetScrollTop = (highlightLine - 1) * lineHeight - 60;
      textareaRef.current.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [highlightLine]);

  // Tab 键智能缩进 (2 个空格)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const nextVal = val.substring(0, start) + '  ' + val.substring(end);
      onChange(nextVal);

      // 恢复光标位置
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  // 监听外部格式化后保持焦点
  useEffect(() => {
    handleScroll();
  }, [code]);

  return (
    <div id="svg-code-editor-pane" className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 select-text">
      {/* 编辑器内嵌工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium text-slate-300">SVG XML 源码</span>
          {isDirty && (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono">
              已修改
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onFormat}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition"
            title="美化 XML 代码缩进"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">格式化</span>
          </button>

          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition disabled:opacity-50"
            title="SVGO 净化：剔除设计器冗余元数据、注释与多余属性"
          >
            <Wand2 className="w-3 h-3 text-purple-400" />
            <span className="hidden sm:inline">SVGO 净化</span>
          </button>

          {isDirty && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
              title="放弃改动，恢复初始文件"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">还原</span>
            </button>
          )}
        </div>
      </div>

      {/* 代码编辑区与行号槽 */}
      <div className="flex-1 relative flex overflow-hidden font-mono text-xs leading-5">
        {/* 行号槽 */}
        <div
          ref={lineNumbersRef}
          className="w-11 py-3 bg-slate-900/60 border-r border-slate-800/60 text-right pr-2 select-none text-slate-600 overflow-hidden font-mono text-[11px]"
        >
          {lineNumbers.map(num => {
            const isError = validation.line === num;
            const isFocus = highlightLine === num;
            return (
              <div
                key={num}
                className={`${
                  isError
                    ? 'text-amber-400 font-bold bg-amber-500/20'
                    : isFocus
                    ? 'text-cyan-300 font-bold bg-cyan-500/25 border-r-2 border-cyan-400'
                    : ''
                }`}
              >
                {num}
              </div>
            );
          })}
        </div>

        {/* 文本输入框 */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 w-full h-full p-3 bg-transparent text-slate-200 font-mono text-xs leading-5 resize-none outline-none overflow-auto whitespace-pre selection:bg-blue-600/40 selection:text-white"
          placeholder="在此粘贴或输入 SVG XML 源码..."
        />
      </div>

      {/* 底部语法与字符状态行 */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          {validation.valid ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>XML 语法有效</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 truncate" title={validation.error}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{validation.error || '语法错误'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 font-mono text-slate-500 text-[10px] flex-shrink-0">
          <span>{linesCount} 行</span>
          <span>·</span>
          <span>{code.length} 字符</span>
        </div>
      </div>
    </div>
  );
};
