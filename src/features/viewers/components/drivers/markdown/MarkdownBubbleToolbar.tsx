/**
 * OmniView Markdown 预览区划选悬浮格式工具条 (MarkdownBubbleToolbar)
 *
 * 遵循可靠回写契约与 P0/P1 增强：
 * 1. 单行全功能模式：加粗 (**B**)、斜体 (*I*)、删除线 (~~S~~)、高亮 (==H==)、行内代码 (`C`)、行内公式 ($M$)、超链接 (Link)、双向链接 (WikiLink)、转提示框 (Callout)、添加脚注批注 (Footnote)
 * 2. 跨行选区智能辅助模式：当选中多行文本时自动切换为「复制纯文本 / 复制为引用块 / 复制为代码围栏 / 跳至起始源码行」，消除多行选区无响应痛点
 * 3. 100% 采用 --ov-* 语义化设计令牌，具备精致毛玻璃质感与全主题自适应对比度
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Code,
  Sigma,
  Link,
  BookOpen,
  MessageSquareQuote,
  MessageSquarePlus,
  Copy,
  Quote,
  FileCode,
  ExternalLink,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import {
  MarkdownFormatAction,
  formatMultiLineSelection,
} from '../../../lib/markdownSelectionReplacer';

export interface MarkdownBubbleToolbarProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  selectedText: string;
  sourceLine?: number;
  canEdit?: boolean;
  locale?: Locale;
  onApplyFormat: (action: MarkdownFormatAction, linkUrl?: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
  onFocusedEditBlock?: (sourceLine?: number) => void;
  onClose: () => void;
}

export const MarkdownBubbleToolbar: React.FC<MarkdownBubbleToolbarProps> = ({
  isOpen,
  position,
  selectedText,
  sourceLine,
  canEdit = true,
  locale = 'zh-CN',
  onApplyFormat,
  onOpenSourceAtLine,
  onFocusedEditBlock,
  onClose,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkActionType, setLinkActionType] = useState<'link' | 'wikilink' | 'footnote'>('link');
  const [copiedMode, setCopiedMode] = useState<'plain' | 'quote' | 'code' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMultiLine = selectedText.includes('\n') || !canEdit;

  // 当选区改变或关闭时重置内嵌链接输入框与复制状态
  useEffect(() => {
    if (!isOpen) {
      setIsLinkInputOpen(false);
      setLinkUrl('');
      setCopiedMode(null);
    }
  }, [isOpen, selectedText]);

  // 展开链接/脚注输入时聚焦
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
  const toolbarWidth = isLinkInputOpen ? 360 : isMultiLine ? 310 : 410;
  const halfWidth = toolbarWidth / 2;
  const clampedX = Math.max(halfWidth + 12, Math.min(window.innerWidth - halfWidth - 12, position.x));
  const clampedY = Math.max(16, position.y - 10);

  const handleActionClick = (action: MarkdownFormatAction) => {
    if (action === 'link' || action === 'wikilink' || action === 'footnote') {
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

  const handleCopySelection = async (mode: 'plain' | 'quote' | 'code') => {
    try {
      const textToCopy =
        mode === 'plain'
          ? selectedText
          : mode === 'quote'
          ? formatMultiLineSelection(selectedText, 'quote')
          : formatMultiLineSelection(selectedText, 'fencedCode');
      await navigator.clipboard.writeText(textToCopy);
      setCopiedMode(mode);
      setTimeout(() => {
        setCopiedMode(null);
        onClose();
      }, 650);
    } catch {
      onClose();
    }
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Markdown selection format toolbar"
      className="ov-bubble-toolbar fixed z-50 flex items-center transition-all duration-150 ease-out shadow-2xl rounded-xl border border-[var(--ov-border)] backdrop-blur-md text-[var(--ov-text)] select-none"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: 'translate(-50%, -100%)',
        backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
        boxShadow: 'var(--ov-shadow, 0 8px 24px rgba(0, 0, 0, 0.28))',
        minHeight: '36px',
        padding: '3px 5px',
      }}
      onMouseDown={e => {
        // 阻止选区因为点击工具栏按钮而失焦失效（输入框除外）
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
    >
      {isMultiLine ? (
        /* 跨行选区智能辅助模式 (P0) */
        <div className="flex items-center gap-1 select-none">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border mr-0.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--ov-accent) 14%, var(--ov-surface))',
              borderColor: 'color-mix(in srgb, var(--ov-accent) 32%, var(--ov-border))',
              color: 'var(--ov-accent)',
            }}
          >
            {locale === 'zh-CN' ? '多行选区' : 'Multi-line'}
          </span>

          <button
            type="button"
            className="px-2 py-1 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
            onClick={() => handleCopySelection('plain')}
            title={locale === 'zh-CN' ? '复制选中纯文本' : 'Copy selected text'}
            aria-label="Copy Text"
          >
            {copiedMode === 'plain' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span>{locale === 'zh-CN' ? '复制' : 'Copy'}</span>
          </button>

          <button
            type="button"
            className="px-2 py-1 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
            onClick={() => handleCopySelection('quote')}
            title={locale === 'zh-CN' ? '复制为 Markdown 引用块 (> )' : 'Copy as Markdown Quote (> )'}
            aria-label="Copy as Quote"
          >
            {copiedMode === 'quote' ? <Check size={13} className="text-emerald-500" /> : <Quote size={13} />}
            <span>{locale === 'zh-CN' ? '引用复制' : 'Quote'}</span>
          </button>

          <button
            type="button"
            className="px-2 py-1 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
            onClick={() => handleCopySelection('code')}
            title={locale === 'zh-CN' ? '复制为代码块围栏 (```)' : 'Copy as Code Block (```)'}
            aria-label="Copy as Code Fence"
          >
            {copiedMode === 'code' ? <Check size={13} className="text-emerald-500" /> : <FileCode size={13} />}
            <span>{locale === 'zh-CN' ? '代码复制' : 'Code'}</span>
          </button>

          {canEdit && sourceLine && onFocusedEditBlock && (
            <>
              <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-0.5 opacity-70" />
              <button
                type="button"
                className="px-2 py-1 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                onClick={() => {
                  onFocusedEditBlock(sourceLine);
                  onClose();
                }}
                title={locale === 'zh-CN' ? '在预览区原地展开该段落专注编辑' : 'Focused In-place Block Edit'}
                aria-label="Focused Block Edit"
              >
                <Edit3 size={13} />
                <span>{locale === 'zh-CN' ? '局部编辑' : 'Focus Edit'}</span>
              </button>
            </>
          )}

          {sourceLine && onOpenSourceAtLine && (
            <>
              <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-0.5 opacity-70" />
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-mono font-medium cursor-pointer"
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
      ) : !isLinkInputOpen ? (
        <div className="flex items-center gap-0.5 select-none">
          {/* 粗体 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('bold')}
            title={`${t('formatBold', locale)} (**text**)`}
            aria-label="Bold"
          >
            <Bold size={14} strokeWidth={2.5} />
          </button>

          {/* 斜体 (P0) */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('italic')}
            title={`${locale === 'zh-CN' ? '斜体' : 'Italic'} (*text*)`}
            aria-label="Italic"
          >
            <Italic size={14} />
          </button>

          {/* 删除线 (P0) */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('strikethrough')}
            title={`${locale === 'zh-CN' ? '删除线' : 'Strikethrough'} (~~text~~)`}
            aria-label="Strikethrough"
          >
            <Strikethrough size={14} />
          </button>

          {/* 高亮标记 (P0) */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('highlight')}
            title={`${locale === 'zh-CN' ? '高亮标记' : 'Highlight'} (==text==)`}
            aria-label="Highlight"
          >
            <Highlighter size={14} />
          </button>

          {/* 行内代码 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('code')}
            title={`${t('formatCode', locale)} (\`code\`)`}
            aria-label="Inline Code"
          >
            <Code size={14} />
          </button>

          {/* 行内公式 (P0) */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('inlineMath')}
            title={`${locale === 'zh-CN' ? '行内数学公式' : 'Inline Math'} ($math$)`}
            aria-label="Inline Math"
          >
            <Sigma size={14} />
          </button>

          <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-0.5 opacity-70" />

          {/* 超链接 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('link')}
            title={`${t('formatLink', locale)} [text](url)`}
            aria-label="Link"
          >
            <Link size={14} />
          </button>

          {/* WikiLink */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('wikilink')}
            title={`${t('formatWikiLink', locale)} [[Page]]`}
            aria-label="WikiLink"
          >
            <BookOpen size={14} />
          </button>

          {/* 转为 Callout 提示框 (P1) */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('callout')}
            title={locale === 'zh-CN' ? '转为 Callout 提示框 (> [!NOTE])' : 'Convert to Callout (> [!NOTE])'}
            aria-label="Callout"
          >
            <MessageSquareQuote size={14} />
          </button>

          {/* 添加脚注批注 (P1) */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('footnote')}
            title={locale === 'zh-CN' ? '添加脚注批注 ([^n])' : 'Add Footnote Annotation ([^n])'}
            aria-label="Footnote"
          >
            <MessageSquarePlus size={14} />
          </button>

          {/* 复制选中文字 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleCopySelection('plain')}
            title={locale === 'zh-CN' ? '复制选中文字' : 'Copy Selection'}
            aria-label="Copy"
          >
            {copiedMode === 'plain' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>

          {/* 局部专注编辑按钮 (Scheme A) */}
          {canEdit && sourceLine && onFocusedEditBlock && (
            <>
              <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-0.5 opacity-70" />
              <button
                type="button"
                className="px-2 py-1 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                onClick={() => {
                  onFocusedEditBlock(sourceLine);
                  onClose();
                }}
                title={locale === 'zh-CN' ? '原地展开此块进行局部专注编辑 (Alt+双击)' : 'In-place Focused Block Edit (Alt+DoubleClick)'}
                aria-label="Focused Block Edit"
              >
                <Edit3 size={13} />
                <span>{locale === 'zh-CN' ? '专注编辑' : 'Edit Block'}</span>
              </button>
            </>
          )}

          {/* 源码定位按钮 (若有定位行号) */}
          {sourceLine && onOpenSourceAtLine && (
            <>
              <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-0.5 opacity-70" />
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] hover:text-[var(--ov-accent)] transition active:scale-95 flex items-center gap-1 text-[11px] font-mono font-medium cursor-pointer"
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
        /* 展开的链接 / WikiLink / 脚注批注 输入栏 */
        <div className="flex items-center gap-1.5 px-1 py-0.5">
          <span className="text-xs font-medium text-[var(--ov-text-secondary)] flex items-center gap-1 pl-1 shrink-0">
            {linkActionType === 'wikilink' ? (
              <BookOpen size={13} />
            ) : linkActionType === 'footnote' ? (
              <MessageSquarePlus size={13} />
            ) : (
              <Link size={13} />
            )}
            <span>
              {linkActionType === 'wikilink'
                ? t('wikiTarget', locale)
                : linkActionType === 'footnote'
                ? locale === 'zh-CN'
                  ? '批注'
                  : 'Note'
                : 'URL'}
            </span>
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
              linkActionType === 'wikilink'
                ? 'TargetPage'
                : linkActionType === 'footnote'
                ? locale === 'zh-CN'
                  ? '输入脚注批注内容...'
                  : 'Enter footnote text...'
                : 'https://example.com'
            }
            className="w-44 px-2 py-1 text-xs rounded-md bg-[var(--ov-code-bg)] border border-[var(--ov-border)] focus:outline-none focus:border-[var(--ov-accent)] text-[var(--ov-text)] placeholder:text-[var(--ov-text-muted)] placeholder:opacity-70"
          />
          <button
            type="button"
            className="p-1 rounded-md bg-[var(--ov-accent)] text-[var(--ov-text-on-accent,#ffffff)] hover:opacity-90 transition cursor-pointer"
            onClick={handleConfirmLink}
            title={t('confirm', locale)}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] transition cursor-pointer"
            onClick={() => setIsLinkInputOpen(false)}
            title={t('cancel', locale)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 小三角指示箭头 */}
      <div
        className="absolute left-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45 border-r border-b border-[var(--ov-border)]"
        style={{
          transform: 'translateX(-50%) rotate(45deg)',
          backgroundColor: 'var(--ov-surface-header, var(--ov-surface))',
          borderColor: 'var(--ov-border)',
        }}
      />
    </div>
  );
};
