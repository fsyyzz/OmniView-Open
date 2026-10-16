/**
 * OmniView Markdown 表格右键快捷上下文菜单 (TableContextMenu)
 * 支持右键直接复制整列 (邮件富文本/纯文本/Markdown)、单元格、整行与整表
 * 使用 React Portal 脱离局部层叠上下文，并具备视口智能边界自适应与无障碍键盘支持
 * 作者: 周赞
 */
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail,
  Copy,
  FileSpreadsheet,
  FileText,
  Rows,
  Sparkles,
  Columns,
  Check,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';

export interface TableContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  colIdx: number;
  colName: string;
  cellText?: string;
  rowIdx?: number;
  isHeader?: boolean;
  locale?: Locale;
  onClose: () => void;
  onCopyColumnEmail: () => void;
  onCopyColumnData: () => void;
  onCopyColumnWithHeader: () => void;
  onCopyColumnMarkdown: () => void;
  onCopyCell?: () => void;
  onCopyRow?: () => void;
  onCopyFullTable?: () => void;
}

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  isOpen,
  x,
  y,
  colIdx,
  colName,
  cellText,
  rowIdx,
  isHeader = false,
  locale = 'zh-CN',
  onClose,
  onCopyColumnEmail,
  onCopyColumnData,
  onCopyColumnWithHeader,
  onCopyColumnMarkdown,
  onCopyCell,
  onCopyRow,
  onCopyFullTable,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x, y });

  // 视口边界溢出防护计算
  useLayoutEffect(() => {
    if (!isOpen) return;
    const menuEl = menuRef.current;
    const menuWidth = menuEl ? menuEl.offsetWidth || 250 : 250;
    const menuHeight = menuEl ? menuEl.offsetHeight || 310 : 310;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let targetX = x;
    let targetY = y;

    if (targetX + menuWidth > viewportW - 12) {
      targetX = Math.max(12, viewportW - menuWidth - 12);
    }
    if (targetY + menuHeight > viewportH - 12) {
      targetY = Math.max(12, viewportH - menuHeight - 12);
    }

    setAdjustedPos({ x: targetX, y: targetY });
  }, [isOpen, x, y]);

  // 全局事件监听 (ESC 键退出、滚轮或外部点击关闭)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleWheel = () => {
      onClose();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tableContextMenuTitle', locale)}
      className="fixed inset-0 z-[99999] pointer-events-auto bg-transparent select-none"
      onContextMenu={e => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        style={{
          left: `${adjustedPos.x}px`,
          top: `${adjustedPos.y}px`,
          backgroundColor: 'var(--ov-surface, #1e1e2e)',
          borderColor: 'var(--ov-border, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.38), 0 4px 12px rgba(0, 0, 0, 0.22)',
          color: 'var(--ov-text, #cdd6f4)',
        }}
        className="fixed min-w-[240px] max-w-[320px] rounded-lg border py-1.5 shadow-2xl backdrop-blur-md text-xs font-sans animate-in fade-in zoom-in-95 duration-100 z-[100000]"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部标题栏：显示当前所选列名与类型 */}
        <div
          className="px-3 py-1.5 border-b mb-1 flex items-center justify-between gap-2"
          style={{
            borderColor: 'var(--ov-border, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--ov-surface-header, rgba(255, 255, 255, 0.03))',
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Columns className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold truncate max-w-[170px]" title={colName}>
              {colName}
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border text-cyan-400/90 border-cyan-500/30 bg-cyan-500/10 shrink-0">
            Col {colIdx + 1}
          </span>
        </div>

        {/* 核心动作组 1: 邮件与列复制操作 (用户最核心诉求) */}
        <div className="px-1 space-y-0.5">
          {/* 1. 邮件富文本格式复制 (最推荐，自带邮件边框与样式) */}
          <button
            type="button"
            onClick={() => {
              onCopyColumnEmail();
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors group hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">{t('tableCopyColEmail', locale)}</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {t('recommendedEmail', locale)}
            </span>
          </button>

          {/* 2. 纯数据复制 (换行分隔，适合粘贴至 Excel / 终端) */}
          <button
            type="button"
            onClick={() => {
              onCopyColumnData();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('tableCopyColData', locale)}</span>
          </button>

          {/* 3. 复制本列 (含表头) */}
          <button
            type="button"
            onClick={() => {
              onCopyColumnWithHeader();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('tableCopyColWithHeader', locale)}</span>
          </button>

          {/* 4. 复制本列为 Markdown 表格 */}
          <button
            type="button"
            onClick={() => {
              onCopyColumnMarkdown();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('tableCopyColMarkdown', locale)}</span>
          </button>
        </div>

        {/* 分割线 */}
        <div
          className="my-1.5 border-t"
          style={{ borderColor: 'var(--ov-border, rgba(255, 255, 255, 0.08))' }}
        />

        {/* 辅助操作组 2: 单元格与整行/整表操作 */}
        <div className="px-1 space-y-0.5">
          {/* 单个单元格复制 */}
          {cellText !== undefined && onCopyCell && (
            <button
              type="button"
              onClick={() => {
                onCopyCell();
                onClose();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <Copy className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{t('tableCopyCell', locale)}</span>
              </div>
              <span className="text-[10px] text-[var(--ov-text-muted)] font-mono truncate max-w-[80px]">
                "{cellText}"
              </span>
            </button>
          )}

          {/* 复制整行 */}
          {rowIdx !== undefined && onCopyRow && (
            <button
              type="button"
              onClick={() => {
                onCopyRow();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
            >
              <Rows className="w-3.5 h-3.5 text-orange-400" />
              <span>{t('tableCopyRow', locale)}</span>
            </button>
          )}

          {/* 复制整张表格为富文本 (直贴 Word / Excel) */}
          {onCopyFullTable && (
            <button
              type="button"
              onClick={() => {
                onCopyFullTable();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors hover:bg-[var(--ov-surface-hover,rgba(255,255,255,0.08))] text-[var(--ov-text)]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('tableCopyRich', locale)}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
