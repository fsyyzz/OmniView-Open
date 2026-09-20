/**
 * OmniView WikiLink 悬浮预览浮窗 (WikiLinkPreviewPopover)
 * 当用户鼠标悬浮在 [[Page]] 或内部文档链接上时，展示目标文件或标题的摘要、大纲与元信息
 * 支持点击直达目标文件或锚点，并在鼠标移出后平滑关闭
 * 
 * 作者: 周赞
 */
import React, { useEffect, useState, useRef } from 'react';
import { FileText, Hash, ExternalLink, CornerDownRight, ArrowRight } from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';

export interface WikiLinkPreviewPopoverProps {
  isOpen: boolean;
  x: number;
  y: number;
  targetName: string;
  heading?: string;
  file?: {
    name: string;
    content: string;
    extension: string;
    path?: string;
  } | null;
  locale?: Locale;
  onNavigate?: () => void;
  onClose: () => void;
}

export const WikiLinkPreviewPopover: React.FC<WikiLinkPreviewPopoverProps> = ({
  isOpen,
  x,
  y,
  targetName,
  heading,
  file,
  locale = 'zh-CN',
  onNavigate,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // 提取预览纯文本 (前 280 字符，并去除 Markdown 杂质)
  const previewText = React.useMemo(() => {
    if (!file?.content) return '';
    let body = file.content.replace(/^\uFEFF/, '');
    // 去除 Frontmatter
    const fm = /^(?:\r?\n)*---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/.exec(body);
    if (fm) body = body.slice(fm[0].length);

    // 如果指定了 heading，尝试定位 heading 之后的内容
    if (heading) {
      const headingRegex = new RegExp(`^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
      const match = headingRegex.exec(body);
      if (match) {
        body = body.slice(match.index + match[0].length);
      }
    }

    const clean = body
      .replace(/```[\s\S]*?```/g, ' [代码块] ')
      .replace(/!\[.*?\]\(.*?\)/g, ' [图片] ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return clean.slice(0, 260) + (clean.length > 260 ? '…' : '');
  }, [file, heading]);

  // 计算词数与行数
  const stats = React.useMemo(() => {
    if (!file?.content) return null;
    const lines = file.content.split('\n').length;
    const words = file.content.trim().length;
    return { lines, words };
  }, [file]);

  if (!isOpen) return null;

  // 视口溢出保护位置计算
  const popoverWidth = 320;
  const left = Math.min(Math.max(12, x - popoverWidth / 2), window.innerWidth - popoverWidth - 16);
  const top = y + 16 + 200 > window.innerHeight ? Math.max(12, y - 180) : y + 16;

  return (
    <div
      ref={popoverRef}
      onMouseEnter={() => {}}
      onMouseLeave={onClose}
      className="fixed z-50 pointer-events-auto rounded-xl shadow-2xl border backdrop-blur-xl p-3.5 transition-all animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        backgroundColor: 'var(--ov-surface, rgba(15, 23, 42, 0.95))',
        borderColor: 'var(--ov-border, rgba(51, 65, 85, 0.7))',
        color: 'var(--ov-text, #f8fafc)',
        boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--ov-border)',
      }}
    >
      {/* 头部：文件名与标题 */}
      <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: 'var(--ov-border)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold text-xs truncate" title={targetName}>
            {targetName || (file?.name ? file.name : 'Document')}
          </span>
        </div>
        {heading && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 truncate max-w-[120px]">
            <Hash className="w-3 h-3 shrink-0" />
            <span className="truncate">{heading}</span>
          </span>
        )}
      </div>

      {/* 摘要正文 */}
      <div className="text-[12px] leading-relaxed line-clamp-4 select-text" style={{ color: 'var(--ov-text-secondary, #94a3b8)' }}>
        {previewText || (
          <span className="italic text-slate-500 text-[11px]">
            {file ? '（文档内容为空）' : '（未在当前工作区检索到该关联文档）'}
          </span>
        )}
      </div>

      {/* 底部元信息与跳转动作 */}
      <div className="flex items-center justify-between pt-1 text-[11px]" style={{ color: 'var(--ov-text-muted)' }}>
        {stats ? (
          <span>
            {stats.lines} 行 · {stats.words} 字符
          </span>
        ) : (
          <span>WikiLink</span>
        )}

        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onClose();
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          <span>{locale === 'zh-CN' ? '查看文档' : 'Open'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
