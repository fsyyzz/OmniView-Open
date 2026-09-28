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
  /** 画布图元 hover 时，由父级传入需要反向高亮的行号（1-indexed） */
  hoverLine?: number | null;
  /** 代码行 hover 时，通知父级同步高亮画布对应图元（行号 1-indexed，null 表示取消） */
  onHoverLine?: (line: number | null) => void;
}

/**
 * 轻量级 SVG/XML 语法高亮渲染器
 * 将源码字符串解析为 React 元素，颜色均依托 --ov-* 语义化令牌
 */
function SvgSyntaxHighlight({ code, hoverLine, highlightLine }: {
  code: string;
  hoverLine: number | null;
  highlightLine: number | null;
}) {
  const html = useMemo(() => {
    if (!code) return '';
    const lines = code.split('\n');
    return lines.map((line, idx) => {
      const lineNum = idx + 1;
      const isHover = hoverLine === lineNum;
      const isFocus = highlightLine === lineNum;

      // 单行正则 token 拆分（仅做行内高亮，不做跨行）
      const tokens: Array<{ text: string; cls: string }> = [];
      let rest = line;

      while (rest.length > 0) {
        // XML 注释 <!-- ... -->（单行）
        let m = rest.match(/^(<!--.*?-->)|^(<!--[\s\S]*$)/);
        if (m) {
          tokens.push({ text: m[0], cls: 'text-slate-500 italic' });
          rest = rest.slice(m[0].length);
          continue;
        }
        // 闭合标签 </tag>
        m = rest.match(/^<\/[a-zA-Z][\w:-]*\s*>/);
        if (m) {
          tokens.push({ text: m[0], cls: 'text-purple-400' });
          rest = rest.slice(m[0].length);
          continue;
        }
        // 开标签 <tag 或自闭合 <tag .../>
        m = rest.match(/^<[a-zA-Z][\w:-]*/);
        if (m) {
          const tagMatch = m[0];
          const afterTag = rest.slice(tagMatch.length);
          // 提取属性部分
          const attrMatch = afterTag.match(/^(\s+[\w:-]+\s*=\s*("[^"]*"|'[^']*')?)*\s*(\/?)>/);
          if (attrMatch) {
            tokens.push({ text: tagMatch, cls: 'text-blue-400' });
            const attrsPart = afterTag.slice(0, attrMatch[0].length - (attrMatch[0].endsWith('/>') ? 2 : 1));
            const closePart = attrMatch[0].slice(attrsPart.length);
            // 高亮属性名与值
            let attrRest = attrsPart;
            while (attrRest.length > 0) {
              const am = attrRest.match(/^(\s+)([\w:-]+)(\s*=\s*)?("[^"]*"|'[^']*')?/);
              if (!am) break;
              if (am[1]) tokens.push({ text: am[1], cls: '' });
              if (am[2]) tokens.push({ text: am[2], cls: 'text-cyan-400' });
              if (am[3]) tokens.push({ text: am[3], cls: 'text-slate-400' });
              if (am[4]) tokens.push({ text: am[4], cls: 'text-emerald-400' });
              attrRest = attrRest.slice(am[0].length);
            }
            tokens.push({ text: closePart, cls: 'text-purple-400' });
            rest = rest.slice(tagMatch.length + attrMatch[0].length);
          } else {
            tokens.push({ text: tagMatch, cls: 'text-blue-400' });
            rest = rest.slice(tagMatch.length);
          }
          continue;
        }
        // 纯文本（XML 内容或空白）
        m = rest.match(/^\s+/);
        if (m) {
          tokens.push({ text: m[0], cls: '' });
          rest = rest.slice(m[0].length);
          continue;
        }
        // 剩余内容
        const remaining = rest.slice(0, 200);
        tokens.push({ text: remaining, cls: 'text-slate-300' });
        rest = rest.slice(remaining.length);
      }

      const lineClasses = [
        isFocus ? 'bg-cyan-500/20' : '',
        isHover && !isFocus ? 'bg-blue-500/10' : '',
      ].filter(Boolean).join(' ');

      return (
        <div key={idx} className={`h-5 ${lineClasses}`}>
          {tokens.map((t, ti) =>
            t.cls ? <span key={ti} className={t.cls}>{t.text}</span> : <span key={ti}>{t.text}</span>
          )}
        </div>
      );
    });
  }, [code, hoverLine, highlightLine]);

  return <>{html}</>;
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
  hoverLine = null,
  onHoverLine,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightOverlayRef = useRef<HTMLDivElement>(null);

  const isDirty = useMemo(() => code !== originalCode, [code, originalCode]);

  // 行数生成与行号
  const linesCount = useMemo(() => {
    return Math.max(1, code.split('\n').length);
  }, [code]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: linesCount }, (_, i) => i + 1);
  }, [linesCount]);

  // 同步滚动（行号槽 + 语法高亮叠加层 均与 textarea 保持同步）
  const handleScroll = () => {
    if (textareaRef.current) {
      const st = textareaRef.current.scrollTop;
      const sl = textareaRef.current.scrollLeft;
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = st;
      if (highlightOverlayRef.current) {
        highlightOverlayRef.current.scrollTop = st;
        highlightOverlayRef.current.scrollLeft = sl;
      }
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

  // 计算鼠标当前所在行号（用于 hover 联动）
  const handleMouseMove = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!onHoverLine) return;
    const lineHeight = 20;
    const scrollTop = e.currentTarget.scrollTop;
    const paddingTop = 12; // p-3 = 12px
    const line = Math.max(1, Math.floor((e.nativeEvent.offsetY - paddingTop + scrollTop) / lineHeight) + 1);
    onHoverLine(line);
  };

  const handleMouseLeave = () => {
    onHoverLine?.(null);
  };

  // 监听外部格式化后保持焦点
  useEffect(() => {
    handleScroll();
  }, [code]);

  return (
    <div
      id="svg-code-editor-pane"
      style={{
        backgroundColor: 'var(--ov-bg)',
        borderRightColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="flex flex-col h-full border-r select-text"
    >
      {/* 编辑器内嵌工具栏 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs"
      >
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
          <span style={{ color: 'var(--ov-text)' }} className="font-medium">SVG XML 源码</span>
          {isDirty && (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono">
              已修改
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onFormat}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition hover:opacity-80"
            title="美化 XML 代码缩进"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">格式化</span>
          </button>

          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition disabled:opacity-50 hover:opacity-80"
            title="SVGO 净化：剔除设计器冗余元数据、注释与多余属性"
          >
            <Wand2 className="w-3 h-3 text-purple-400" />
            <span className="hidden sm:inline">SVGO 净化</span>
          </button>

          {isDirty && (
            <button
              onClick={onReset}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition hover:opacity-80"
              title="放弃改动，恢复初始文件"
            >
              <RotateCcw className="w-3 h-3" />
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
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderRightColor: 'var(--ov-border)',
            color: 'var(--ov-text-muted)',
          }}
          className="w-11 py-3 border-r text-right pr-2 select-none overflow-hidden font-mono text-[11px]"
        >
          {lineNumbers.map(num => {
            const isError = validation.line === num;
            const isFocus = highlightLine === num || hoverLine === num;
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

        {/* 语法高亮叠加层（位于 textarea 下方，textarea 设为透明文字，仅高亮层可见颜色） */}
        <div className="flex-1 relative overflow-hidden">
          {/* 底层：语法高亮（pointer-events-none 不影响编辑） */}
          <div
            ref={highlightOverlayRef}
            aria-hidden="true"
            className="absolute inset-0 p-3 pointer-events-none overflow-hidden whitespace-pre font-mono text-xs leading-5"
            style={{
              color: 'var(--ov-text)',
              backgroundColor: 'transparent',
            }}
          >
            <SvgSyntaxHighlight code={code} hoverLine={hoverLine} highlightLine={highlightLine} />
          </div>

          {/* 顶层：透明文字 textarea（保留编辑功能，文字颜色设为透明，由底层高亮层显示颜色） */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              color: 'transparent',
              backgroundColor: 'transparent',
              caretColor: 'var(--ov-text)',
            }}
            className="absolute inset-0 w-full h-full p-3 font-mono text-xs leading-5 resize-none outline-none overflow-auto whitespace-pre selection:bg-blue-600/40 selection:text-white"
            placeholder="在此粘贴或输入 SVG XML 源码..."
          />
        </div>
      </div>

      {/* 底部语法与字符状态行 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderTopColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
        className="flex items-center justify-between px-3 py-1 border-t text-[11px]"
      >
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

        <div style={{ color: 'var(--ov-text-muted)' }} className="flex items-center gap-2.5 font-mono text-[10px] flex-shrink-0">
          <span>{linesCount} 行</span>
          <span>·</span>
          <span>{code.length} 字符</span>
        </div>
      </div>
    </div>
  );
};
