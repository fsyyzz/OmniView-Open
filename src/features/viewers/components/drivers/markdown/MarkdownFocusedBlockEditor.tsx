/**
 * Markdown 预览窗口“块级原地专注编辑器”组件 (Scheme A: Block In-place Focused Card Editor)
 *
 * 核心特性：
 * 1. 100% 遵循 --ov-* 语义化主题令牌，支持深色/浅色/护眼/高对比度及 VS Code 原生主题融合
 * 2. 真实行号联动 Gutter（从文档真实行号 actualStartLine 开始递增显示）
 * 3. 支持“纯源码编辑 (Source)”与“实时分栏微预览 (Live Split Preview)”一键切换
 * 4. 支持“聚光灯专注模式 (Spotlight Dimming)”开关，自动淡化周围无关段落
 * 5. 内置快捷语法栏与键盘闭环（Ctrl/Cmd+Enter 保存、Esc 取消、Tab/Shift+Tab 缩进、Ctrl+B/I/K 快捷键）
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import {
  Check,
  X,
  RotateCcw,
  Columns,
  Code2,
  Focus,
  ExternalLink,
  Bold,
  Italic,
  Code,
  Heading,
  Quote,
  AlertCircle,
  CheckSquare,
  Sigma,
  FileSpreadsheet,
  Link,
  Braces,
} from 'lucide-react';
import { Locale } from '../../../../../shared/lib/i18n';
import {
  applyEditorQuickSnippet,
  BlockQuickSnippet,
  getBlockTypeLabel,
} from '../../../lib/markdownBlockEditor';
import { processMarkdownMath, restoreMarkdownMath } from '../../../lib/markdownMath';
import { processMarkdownWikiLinks } from '../../../lib/markdownWikiLinks';
import { sanitizeDiagramHtml } from '../../../lib/diagramSanitizer';

export interface MarkdownFocusedBlockEditorProps {
  blockId: string;
  blockType: string;
  lang?: string;
  initialRawSlice: string;
  actualStartLine: number;
  actualEndLine: number;
  spotlightEnabled: boolean;
  onToggleSpotlight: () => void;
  onSave: (newBlockMarkdown: string) => void;
  onCancel: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  locale?: Locale;
}

export const MarkdownFocusedBlockEditor: React.FC<MarkdownFocusedBlockEditorProps> = ({
  blockId,
  blockType,
  lang,
  initialRawSlice,
  actualStartLine,
  actualEndLine,
  spotlightEnabled,
  onToggleSpotlight,
  onSave,
  onCancel,
  onOpenSourceAtLine,
  locale = 'zh-CN',
}) => {
  const isZh = locale === 'zh-CN';
  const [draft, setDraft] = useState<string>(initialRawSlice);
  const [editorMode, setEditorMode] = useState<'edit' | 'split'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 当切换焦点块时同步初始源码并自动聚焦
  useEffect(() => {
    setDraft(initialRawSlice);
    const timer = setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        // 将光标置于末尾但保持滚动平滑
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [blockId, initialRawSlice]);

  const draftLines = useMemo(() => draft.split('\n'), [draft]);
  const lineCount = draftLines.length;
  const charCount = draft.length;
  const isDirty = draft !== initialRawSlice;

  const blockLabel = useMemo(
    () => getBlockTypeLabel(blockType, lang, draft, locale),
    [blockType, lang, draft, locale]
  );

  // 自适应高度计算（最小 4 行，最高 22 行后内部滚动）
  const visibleRows = Math.max(4, Math.min(20, lineCount + 1));

  // 实时微预览 HTML 生成（支持行内/块级 KaTeX、WikiLink 与 GFM 语法）
  const livePreviewHtml = useMemo(() => {
    if (editorMode !== 'split') return '';
    try {
      // 如果当前块本身是代码块或图表块且源码未带围栏，自动补齐预览围栏以展示真实效果
      let sourceForPreview = draft;
      if (
        blockType === 'math' &&
        !draft.trim().startsWith('$$')
      ) {
        sourceForPreview = `$$\n${draft}\n$$`;
      } else if (
        blockType === 'code' &&
        !draft.trim().startsWith('```') &&
        !draft.trim().startsWith('~~~')
      ) {
        sourceForPreview = `\`\`\`${lang || 'text'}\n${draft}\n\`\`\``;
      }

      const { markdown: withWiki } = processMarkdownWikiLinks(sourceForPreview, {
        files: [],
      });
      const { markdown: withMath, mathSlots } = processMarkdownMath(withWiki);
      const rawHtml = marked.parse(withMath, { async: false }) as string;
      const htmlWithMath = restoreMarkdownMath(rawHtml, mathSlots);
      return sanitizeDiagramHtml(htmlWithMath);
    } catch {
      return `<pre>${draft.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    }
  }, [draft, editorMode, blockType, lang]);

  // 执行快捷语法包裹并恢复选区焦点
  const handleQuickSnippet = useCallback(
    (snippet: BlockQuickSnippet) => {
      const el = textareaRef.current;
      const selStart = el ? el.selectionStart : draft.length;
      const selEnd = el ? el.selectionEnd : draft.length;
      const { nextText, nextSelectionStart, nextSelectionEnd } = applyEditorQuickSnippet(
        draft,
        selStart,
        selEnd,
        snippet
      );
      setDraft(nextText);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        }
      });
    },
    [draft]
  );

  // 键盘快捷键处理：Ctrl/Cmd+Enter 保存、Esc 取消、Tab 缩进、Ctrl+B/I/K 格式化
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onSave(draft);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const lower = e.key.toLowerCase();
      if (lower === 'b') {
        e.preventDefault();
        handleQuickSnippet('bold');
        return;
      }
      if (lower === 'i') {
        e.preventDefault();
        handleQuickSnippet('italic');
        return;
      }
      if (lower === 'k') {
        e.preventDefault();
        handleQuickSnippet('link');
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      if (e.shiftKey) {
        // Shift + Tab 反缩进当前行
        const lineStart = draft.lastIndexOf('\n', start - 1) + 1;
        if (draft.slice(lineStart, lineStart + 2) === '  ') {
          const next = draft.slice(0, lineStart) + draft.slice(lineStart + 2);
          setDraft(next);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
          });
        }
      } else {
        const next = draft.slice(0, start) + '  ' + draft.slice(end);
        setDraft(next);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + 2, start + 2);
        });
      }
    }
  };

  const quickButtons: Array<{
    id: BlockQuickSnippet;
    icon: React.ReactNode;
    title: string;
  }> = [
    { id: 'bold', icon: <Bold className="w-3.5 h-3.5" />, title: isZh ? '加粗 (Ctrl+B)' : 'Bold (Ctrl+B)' },
    { id: 'italic', icon: <Italic className="w-3.5 h-3.5" />, title: isZh ? '斜体 (Ctrl+I)' : 'Italic (Ctrl+I)' },
    { id: 'code', icon: <Code className="w-3.5 h-3.5" />, title: isZh ? '行内代码 (`code`)' : 'Inline Code' },
    { id: 'heading', icon: <Heading className="w-3.5 h-3.5" />, title: isZh ? '切换标题级别 (#)' : 'Cycle Heading (#)' },
    { id: 'quote', icon: <Quote className="w-3.5 h-3.5" />, title: isZh ? '引用行 (>)' : 'Blockquote (>)' },
    { id: 'callout', icon: <AlertCircle className="w-3.5 h-3.5" />, title: isZh ? '插入 [!NOTE] 提示块' : 'Insert [!NOTE] Callout' },
    { id: 'task', icon: <CheckSquare className="w-3.5 h-3.5" />, title: isZh ? '待办任务项 (- [ ])' : 'Task Item (- [ ])' },
    { id: 'math', icon: <Sigma className="w-3.5 h-3.5" />, title: isZh ? 'LaTeX 数学公式 ($...$)' : 'LaTeX Math ($...$)' },
    { id: 'wikilink', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, title: isZh ? 'Wiki 双链 ([[...]])' : 'WikiLink ([[...]])' },
    { id: 'link', icon: <Link className="w-3.5 h-3.5" />, title: isZh ? '超链接 (Ctrl+K)' : 'Hyperlink (Ctrl+K)' },
    { id: 'codeblock', icon: <Braces className="w-3.5 h-3.5" />, title: isZh ? '代码块 (```)' : 'Code Block (```)' },
  ];

  return (
    <div
      data-focused-block-editor={blockId}
      data-source-line={actualStartLine}
      data-source-end-line={actualEndLine}
      style={{
        backgroundColor: 'var(--ov-bg-elevated)',
        borderColor: 'var(--ov-accent)',
        color: 'var(--ov-text)',
        boxShadow: 'var(--ov-shadow)',
      }}
      className="ov-focused-block-editor my-4 rounded-xl border-2 overflow-hidden transition-all duration-150 relative z-30"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      {/* 1. 顶部元信息与视图模式栏 (遵循 Zero-Pill 规范：静态元数据采用纯排版分隔符 ·) */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
        }}
        className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b text-xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{ backgroundColor: 'var(--ov-accent)' }}
            className="w-2 h-2 rounded-full shrink-0"
          />
          <span style={{ color: 'var(--ov-text)' }} className="font-semibold truncate">
            {isZh ? '局部专注编辑' : 'Focused Block Edit'}
          </span>
          <span style={{ color: 'var(--ov-text-muted)' }} aria-hidden="true">
            ·
          </span>
          <span style={{ color: 'var(--ov-text-secondary)' }} className="truncate">
            {blockLabel}
          </span>
          <span style={{ color: 'var(--ov-text-muted)' }} aria-hidden="true">
            ·
          </span>
          <span style={{ color: 'var(--ov-text-muted)' }} className="font-mono">
            L{actualStartLine}
            {actualEndLine > actualStartLine ? `–L${actualEndLine}` : ''}
          </span>
          <span style={{ color: 'var(--ov-text-muted)' }} aria-hidden="true">
            ·
          </span>
          <span style={{ color: 'var(--ov-text-muted)' }} className="font-mono">
            {lineCount} {isZh ? '行' : 'lines'} / {charCount} {isZh ? '字' : 'chars'}
          </span>
          {isDirty && (
            <>
              <span style={{ color: 'var(--ov-text-muted)' }} aria-hidden="true">
                ·
              </span>
              <span style={{ color: 'var(--ov-accent)' }} className="font-medium">
                {isZh ? '已修改' : 'Modified'}
              </span>
            </>
          )}
        </div>

        {/* 右侧交互控制组：源码/微预览切换 + 聚光灯降噪 + 源码定位 */}
        <div className="flex items-center gap-1.5">
          {/* 源码 / 实时分栏微预览 切换器 */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border-subtle)',
            }}
            className="flex items-center p-0.5 rounded-md border"
          >
            <button
              type="button"
              onClick={() => setEditorMode('edit')}
              style={
                editorMode === 'edit'
                  ? {
                      backgroundColor: 'var(--ov-bg-elevated)',
                      color: 'var(--ov-accent)',
                    }
                  : { color: 'var(--ov-text-secondary)' }
              }
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer"
              title={isZh ? '仅显示源码编辑器' : 'Source Editor Only'}
            >
              <Code2 className="w-3 h-3" />
              <span>{isZh ? '源码' : 'Source'}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('split')}
              style={
                editorMode === 'split'
                  ? {
                      backgroundColor: 'var(--ov-bg-elevated)',
                      color: 'var(--ov-accent)',
                    }
                  : { color: 'var(--ov-text-secondary)' }
              }
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer"
              title={isZh ? '开启左侧源码 + 右侧实时渲染微预览' : 'Live Split Micro-Preview'}
            >
              <Columns className="w-3 h-3" />
              <span>{isZh ? '实时微预览' : 'Live Preview'}</span>
            </button>
          </div>

          {/* 聚光灯背景降噪开关 */}
          <button
            type="button"
            onClick={onToggleSpotlight}
            style={
              spotlightEnabled
                ? {
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-accent)',
                    color: 'var(--ov-accent)',
                  }
                : {
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border-subtle)',
                    color: 'var(--ov-text-secondary)',
                  }
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer hover:opacity-90"
            title={
              isZh
                ? '聚光灯模式：开启后自动淡化周围非活动段落，专注当前块写作'
                : 'Spotlight Mode: Dim surrounding blocks while editing'
            }
          >
            <Focus className="w-3 h-3" />
            <span>{isZh ? '聚光灯' : 'Spotlight'}</span>
          </button>

          {/* 跳转到全量源码视图 */}
          {onOpenSourceAtLine && (
            <button
              type="button"
              onClick={() => onOpenSourceAtLine(actualStartLine)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border-subtle)',
                color: 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-colors cursor-pointer hover:text-[var(--ov-accent)]"
              title={isZh ? `在全文源码模式中定位第 ${actualStartLine} 行` : `Open Full Source at L${actualStartLine}`}
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">{isZh ? '全文源码' : 'Full Source'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 快捷语法工具条 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border-subtle)',
        }}
        className="flex items-center justify-between gap-2 px-3 py-1.5 border-b overflow-x-auto"
      >
        <div className="flex items-center gap-0.5">
          {quickButtons.map(btn => (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleQuickSnippet(btn.id)}
              style={{ color: 'var(--ov-text-secondary)' }}
              className="p-1.5 rounded hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer shrink-0"
              title={btn.title}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {isDirty && (
          <button
            type="button"
            onClick={() => setDraft(initialRawSlice)}
            style={{ color: 'var(--ov-text-muted)' }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-text)] transition-colors cursor-pointer shrink-0"
            title={isZh ? '放弃当前未保存改动并还原初始内容' : 'Revert to initial block content'}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isZh ? '还原' : 'Reset'}</span>
          </button>
        )}
      </div>

      {/* 3. 编辑核心区：支持单栏源码 或 左右分栏实时微预览 */}
      <div
        className={`grid ${
          editorMode === 'split' ? 'grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x' : 'grid-cols-1'
        }`}
        style={{ borderColor: 'var(--ov-border)' }}
      >
        {/* 左侧：带真实文档行号 Gutter 的自适应文本编辑区 */}
        <div
          style={{ backgroundColor: 'var(--ov-code-bg)' }}
          className="flex items-stretch min-h-[110px] max-h-[440px] overflow-y-auto"
        >
          {/* 真实文档行号列 */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border-subtle)',
              color: 'var(--ov-text-muted)',
            }}
            aria-hidden="true"
            className="select-none py-3 px-2.5 text-right font-mono text-xs leading-6 border-r shrink-0 min-w-[3rem]"
          >
            {draftLines.map((_, idx) => (
              <div key={idx}>{actualStartLine + idx}</div>
            ))}
          </div>

          {/* 源码输入 Textarea */}
          <textarea
            ref={textareaRef}
            value={draft}
            rows={visibleRows}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder={
              isZh
                ? '在此输入 Markdown 源码（支持公式 $...$、双链 [[...]]、Callout > [!NOTE]）...'
                : 'Type Markdown here...'
            }
            style={{
              backgroundColor: 'transparent',
              color: 'var(--ov-text)',
            }}
            className="w-full py-3 px-3.5 font-mono text-[13px] leading-6 resize-y focus:outline-none"
          />
        </div>

        {/* 右侧：实时渲染微预览区（仅在 split 模式下展现） */}
        {editorMode === 'split' && (
          <div
            style={{
              backgroundColor: 'var(--ov-bg)',
              color: 'var(--ov-text)',
              borderColor: 'var(--ov-border-subtle)',
            }}
            className="p-4 max-h-[440px] overflow-y-auto"
          >
            <div
              style={{ color: 'var(--ov-text-muted)' }}
              className="text-[11px] font-medium mb-2 select-none flex items-center justify-between"
            >
              <span>{isZh ? '实时渲染微预览' : 'Live Block Preview'}</span>
              <span>Markdown + KaTeX</span>
            </div>
            <div
              className="markdown-content text-sm"
              dangerouslySetInnerHTML={{ __html: livePreviewHtml }}
            />
          </div>
        )}
      </div>

      {/* 4. 底部操作栏与快捷键提示 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
        }}
        className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-t text-xs"
      >
        <div
          style={{ color: 'var(--ov-text-muted)' }}
          className="flex items-center gap-2 text-[11px] select-none"
        >
          <span>{isZh ? 'Ctrl/Cmd + Enter 保存回写' : 'Ctrl/Cmd + Enter to Save'}</span>
          <span aria-hidden="true">·</span>
          <span>{isZh ? 'Esc 取消退出' : 'Esc to Cancel'}</span>
          <span aria-hidden="true">·</span>
          <span>{isZh ? 'Tab / Shift+Tab 缩进' : 'Tab to Indent'}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium hover:text-[var(--ov-text)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{isZh ? '取消 (Esc)' : 'Cancel (Esc)'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSave(draft)}
            style={{
              backgroundColor: 'var(--ov-accent)',
            }}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-md text-xs font-semibold text-[var(--ov-text-on-accent,#ffffff)] hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isZh ? '保存修改 (Ctrl+Enter)' : 'Save Block (Ctrl+Enter)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
