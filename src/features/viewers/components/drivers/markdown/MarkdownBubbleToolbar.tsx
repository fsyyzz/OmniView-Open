/**
 * OmniView Markdown 预览区划选悬浮格式工具条 (MarkdownBubbleToolbar)
 * 
 * 遵循可靠回写契约：
 * 1. 严格收窄高可靠行内动作：加粗 (**B**)、行内代码 (`C`)、插入超链接 (Link) 与双向链接 (WikiLink)
 * 2. 移除容易跨行改坏文档的歧义块级动作，确保回写的 100% 确定性与安全性
 * 3. 采用 --ov-* 语义化设计令牌，具备精致毛玻璃质感
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Code,
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
  const toolbarWidth = isLinkInputOpen ? 340 : 260;
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
      className="fixed z-50 flex items-center transition-all duration-150 ease-out shadow-2xl rounded-xl border border-[var(--ov-border)] backdrop-blur-md text-[var(--ov-text-primary)] select-none"
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
        <div className="flex items-center gap-1 select-none">
          {/* 粗体 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('bold')}
            title={`${t('formatBold', locale)} (**text**)`}
            aria-label="Bold"
          >
            <Bold size={15} strokeWidth={2.5} />
          </button>

          {/* 行内代码 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[var(--ov-accent)] transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('code')}
            title={`${t('formatCode', locale)} (\`code\`)`}
            aria-label="Inline Code"
          >
            <Code size={15} />
          </button>

          {/* 超链接 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-sky-400 transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('link')}
            title={`${t('formatLink', locale)} [text](url)`}
            aria-label="Link"
          >
            <Link size={15} />
          </button>

          {/* WikiLink */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-violet-400 transition active:scale-95 cursor-pointer"
            onClick={() => handleActionClick('wikilink')}
            title={`${t('formatWikiLink', locale)} [[Page]]`}
            aria-label="WikiLink"
          >
            <BookOpen size={15} />
          </button>

          {/* 源码定位按钮 (若有定位行号) */}
          {sourceLine && onOpenSourceAtLine && (
            <>
              <div className="w-[1px] h-4 bg-[var(--ov-border)] mx-0.5 opacity-70" />
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-cyan-400 transition active:scale-95 flex items-center gap-1 text-[11px] font-mono font-medium cursor-pointer"
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
            className="p-1 rounded-md bg-[var(--ov-accent)] text-white hover:opacity-90 transition cursor-pointer"
            onClick={handleConfirmLink}
            title={t('confirm', locale)}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-200 transition cursor-pointer"
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
          backgroundColor: 'var(--ov-surface-header)',
        }}
      />
    </div>
  );
};
