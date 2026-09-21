/**
 * OmniView Markdown 预览区划选悬浮格式工具条 (MarkdownBubbleToolbar)
 * 
 * 遵循标准与交互体验：
 * 1. 当用户在 Markdown 预览容器内划选文字时，自动平滑计算选区视口坐标并浮现在选区上方
 * 2. 提供：加粗 (B)、斜体 (I)、删除线 (S)、行内代码 (`C`)、重点高亮 (H)、插入超链接 (Link)、插入双向链接 (WikiLink)、以及双击定位 (Locate)
 * 3. 采用 --ov-* 语义化设计令牌，保证在多主题及高对比度模式下具有精致毛玻璃质感
 * 4. 支持 ESC 键、点击外部或取消划选时平滑折叠关闭
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  CheckSquare,
  Link,
  BookOpen,
  ExternalLink,
  Check,
  X,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { MarkdownFormatAction } from '../../../lib/markdownSelectionReplacer';

export interface MarkdownBubbleToolbarProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  selectedText: string;
  sourceLine?: number;
  locale?: Locale;
  onApplyFormat: (action: MarkdownFormatAction, linkUrl?: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
  onClose: () => void;
}

export const MarkdownBubbleToolbar: React.FC<MarkdownBubbleToolbarProps> = ({
  isOpen,
  position,
  selectedText,
  sourceLine,
  locale = 'zh-CN',
  onApplyFormat,
  onOpenSourceAtLine,
  onClose,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkActionType, setLinkActionType] = useState<'link' | 'wikilink'>('link');
  const inputRef = useRef<HTMLInputElement>(null);

  // 当选区改变或关闭时重置内嵌链接输入框
  useEffect(() => {
    if (!isOpen) {
      setIsLinkInputOpen(false);
      setLinkUrl('');
    }
  }, [isOpen, selectedText]);

  // 展开链接输入时聚焦
  useEffect(() => {
    if (isLinkInputOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isLinkInputOpen]);

  // 点击外部时平滑折叠关闭
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  // 避免工具栏超出视口左右或顶部
  const toolbarWidth = isLinkInputOpen ? 340 : 450;
  const halfWidth = toolbarWidth / 2;
  const clampedX = Math.max(halfWidth + 12, Math.min(window.innerWidth - halfWidth - 12, position.x));
  const clampedY = Math.max(16, position.y - 10);

  const handleActionClick = (action: MarkdownFormatAction) => {
    if (action === 'link' || action === 'wikilink') {
      setLinkActionType(action);
      setIsLinkInputOpen(true);
      return;
    }
    onApplyFormat(action);
  };

  const handleConfirmLink = () => {
    onApplyFormat(linkActionType, linkUrl);
    setIsLinkInputOpen(false);
    setLinkUrl('');
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Markdown selection format toolbar"
      className="fixed z-50 flex items-center transition-all duration-150 ease-out shadow-2xl rounded-xl border border-[var(--ov-border)] backdrop-blur-md text-[var(--ov-text-primary)]"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: 'translate(-50%, -100%)',
        backgroundColor: 'var(--ov-surface-header)',
        minHeight: '36px',
        padding: '3px 4px',
      }}
      onMouseDown={e => {
        // 阻止选区因为点击工具栏按钮而失焦失效
        e.preventDefault();
      }}
    >
      {!isLinkInputOpen ? (
        <div className="flex items-center gap-0.5 select-none">
          {/* 粗体 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[var(--ov-accent)] transition active:scale-95"
            onClick={() => handleActionClick('bold')}
            title={`${t('formatBold', locale)} (**text**)`}
            aria-label="Bold"
          >
            <Bold size={15} strokeWidth={2.5} />
          </button>

          {/* 斜体 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[var(--ov-accent)] transition active:scale-95"
            onClick={() => handleActionClick('italic')}
            title={`${t('formatItalic', locale)} (*text*)`}
            aria-label="Italic"
          >
            <Italic size={15} />
          </button>

          {/* 删除线 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[var(--ov-accent)] transition active:scale-95"
            onClick={() => handleActionClick('strikethrough')}
            title={`${t('formatStrikethrough', locale)} (~~text~~)`}
            aria-label="Strikethrough"
          >
            <Strikethrough size={15} />
          </button>

          {/* 行内代码 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[var(--ov-accent)] transition active:scale-95"
            onClick={() => handleActionClick('code')}
            title={`${t('formatCode', locale)} (\`code\`)`}
            aria-label="Inline Code"
          >
            <Code size={15} />
          </button>

          {/* 高亮标记 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-amber-500 transition active:scale-95"
            onClick={() => handleActionClick('highlight')}
            title={`${t('formatHighlight', locale)} (==text==)`}
            aria-label="Highlight"
          >
            <Highlighter size={15} />
          </button>

          <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-1 opacity-70" />

          {/* 一级标题 H1 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-indigo-400 transition active:scale-95"
            onClick={() => handleActionClick('h1')}
            title={`${t('formatH1', locale)} (# title)`}
            aria-label="Heading 1"
          >
            <Heading1 size={15} />
          </button>

          {/* 二级标题 H2 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-indigo-400 transition active:scale-95"
            onClick={() => handleActionClick('h2')}
            title={`${t('formatH2', locale)} (## title)`}
            aria-label="Heading 2"
          >
            <Heading2 size={15} />
          </button>

          {/* 三级标题 H3 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-indigo-400 transition active:scale-95"
            onClick={() => handleActionClick('h3')}
            title={`${t('formatH3', locale)} (### title)`}
            aria-label="Heading 3"
          >
            <Heading3 size={15} />
          </button>

          {/* 引用块 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-teal-400 transition active:scale-95"
            onClick={() => handleActionClick('quote')}
            title={`${t('formatQuote', locale)} (> quote)`}
            aria-label="Quote"
          >
            <Quote size={14} />
          </button>

          {/* 待办清单 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-emerald-400 transition active:scale-95"
            onClick={() => handleActionClick('todo')}
            title={`${t('formatTodo', locale)} (- [ ])`}
            aria-label="Todo"
          >
            <CheckSquare size={14} />
          </button>

          <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-1 opacity-70" />

          {/* 超链接 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-sky-400 transition active:scale-95"
            onClick={() => handleActionClick('link')}
            title={`${t('formatLink', locale)} [text](url)`}
            aria-label="Link"
          >
            <Link size={15} />
          </button>

          {/* WikiLink */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-violet-400 transition active:scale-95"
            onClick={() => handleActionClick('wikilink')}
            title={`${t('formatWikiLink', locale)} [[Page]]`}
            aria-label="WikiLink"
          >
            <BookOpen size={15} />
          </button>

          {/* 源码定位按钮 (若有定位行号) */}
          {sourceLine && onOpenSourceAtLine && (
            <>
              <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-1 opacity-70" />
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-cyan-400 transition active:scale-95 flex items-center gap-1 text-[11px] font-mono font-medium"
                onClick={() => onOpenSourceAtLine(sourceLine)}
                title={`${t('openSourceAtLine', locale).replace('{line}', String(sourceLine))}`}
                aria-label="Locate Source Line"
              >
                <ExternalLink size={13} />
                <span>L{sourceLine}</span>
              </button>
            </>
          )}
        </div>
      ) : (
        /* 展开的链接/WikiLink URL 输入栏 */
        <div className="flex items-center gap-1.5 px-1 py-0.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 pl-1">
            {linkActionType === 'wikilink' ? <BookOpen size={13} /> : <Link size={13} />}
            <span>{linkActionType === 'wikilink' ? t('wikiTarget', locale) : 'URL'}</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsLinkInputOpen(false);
              }
            }}
            placeholder={
              linkActionType === 'wikilink' ? 'TargetPage' : 'https://example.com'
            }
            className="w-44 px-2 py-1 text-xs rounded-md bg-black/5 dark:bg-white/10 border border-[var(--ov-border)] focus:outline-none focus:border-[var(--ov-accent)] text-[var(--ov-text-primary)] placeholder:opacity-40"
          />
          <button
            type="button"
            className="p-1 rounded-md bg-[var(--ov-accent)] text-white hover:opacity-90 transition"
            onClick={handleConfirmLink}
            title={t('confirm', locale)}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-200 transition"
            onClick={() => setIsLinkInputOpen(false)}
            title={t('cancel', locale)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 小三角尖角指示箭头 */}
      <div
        className="absolute left-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45 border-r border-b border-[var(--ov-border)]"
        style={{
          transform: 'translateX(-50%) rotate(45deg)',
          backgroundColor: 'var(--ov-surface-header)',
        }}
      />
    </div>
  );
};
