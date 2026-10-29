/**
 * Markdown 块级渐进式悬浮动作胶囊与删除撤销通知条 (Scheme 1: Progressive Hover Action Capsule + Undo Toast)
 *
 * 核心特性：
 * 1. 二段式极简渐进披露 (Two-Stage Progressive Disclosure)：默认悬浮仅展示「编辑」与「更多」两个紧凑小按钮，点击「更多」后才展开「下方插入」「克隆块」「上移/下移」「删除块」等进阶操作
 * 2. 智能正文右侧贴合定位：当段落、标题、居中图件框 ([!FIGURE]) 或图片未铺满整行时，自动贴合实际正文/图件右侧边缘，免去鼠标长距离横跨空白区；展开更多操作时自动防左溢钳制
 * 3. 防误触双保险：支持行内二次确认态 (Inline Confirm) + 删除后底部 6 秒非阻塞「一键撤销 (Undo)」浮条
 * 4. 100% 遵循 --ov-* 语义化设计令牌，且全量标记 data-clipboard-ignore="true" 杜绝复制污染
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  MoreHorizontal,
  Plus,
  CopyPlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import type { Locale } from '../../../../../shared/lib/i18n';

/**
 * 测量块级容器内部实际正文或独立视觉盒子的右边界偏移量（相对于 wrapper 右侧的距离 px）
 * 若内容未铺满整行（如短标题、短段落、居中 [!FIGURE] 图件框、独立窄图/窄表），让悬浮胶囊贴合内容右侧
 */
export function computeBlockContentRightOffset(
  wrapperEl: HTMLElement | null,
  barWidth = 96
): number {
  if (!wrapperEl || typeof document === 'undefined') return 8;
  const wrapperRect = wrapperEl.getBoundingClientRect();
  if (wrapperRect.width <= barWidth + 24) return 8;

  // 1. 若块本身是整宽卡片型容器（Callout 提示框、代码块、图表画布、Tab 组等），直接贴齐卡片右上角
  const fullBoxChild = wrapperEl.querySelector<HTMLElement>(
    '.ov-callout:not(.ov-figure-callout), .markdown-code-block, .markdown-diagram, .ov-tab-group, .ov-steps-container, .ov-timeline-container, .ov-compare-container, .ov-metrics-container, .ov-card-grid, blockquote'
  );
  if (fullBoxChild) {
    const boxRect = fullBoxChild.getBoundingClientRect();
    if (boxRect.width > 0) {
      const rightGap = Math.max(8, Math.round(wrapperRect.right - boxRect.right + 8));
      return Math.min(rightGap, Math.max(8, Math.round(wrapperRect.width - barWidth - 8)));
    }
    return 8;
  }

  // 2. 若块是居中或自适应宽度的图件框 ([!FIGURE])、单张图片或窄表格，贴合该视觉元素右边缘
  const fittedVisualChild = wrapperEl.querySelector<HTMLElement>(
    '.ov-figure-callout, figure, .ov-image-container img, table'
  );
  if (fittedVisualChild) {
    const fitRect = fittedVisualChild.getBoundingClientRect();
    if (fitRect.width > 0 && fitRect.right < wrapperRect.right - 16) {
      const rightGap = Math.max(8, Math.round(wrapperRect.right - fitRect.right + 4));
      return Math.min(rightGap, Math.max(8, Math.round(wrapperRect.width - barWidth - 8)));
    }
  }

  // 3. 针对普通正文段落 (<p>)、标题 (<h1>~<h6>) 或列表项，使用 DOM Range 测量真实文字右边界
  const markdownContentEl =
    wrapperEl.querySelector<HTMLElement>('.markdown-content') || wrapperEl;
  const textTarget =
    markdownContentEl.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, p, ul, ol') ||
    markdownContentEl;

  try {
    const range = document.createRange();
    range.selectNodeContents(textTarget);
    const rangeRect = range.getBoundingClientRect();
    if (rangeRect.width > 0 && rangeRect.right < wrapperRect.right - 24) {
      // 将胶囊置于文字右端附近（若文字极短则紧邻文字右侧展开，不超出容器左界）
      const desiredRightEdge = Math.max(
        wrapperRect.left + barWidth + 8,
        Math.min(wrapperRect.right - 8, rangeRect.right + Math.min(barWidth * 0.75, 84))
      );
      const rightOffset = Math.round(wrapperRect.right - desiredRightEdge);
      return Math.max(8, rightOffset);
    }
  } catch {
    // 忽略 Range 测量异常，回退默认右侧对齐
  }

  return 8;
}

export interface MarkdownBlockActionBarProps {
  blockId: string;
  startLine: number;
  endLine?: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  rightOffsetPx?: number;
  locale?: Locale;
  onEdit: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export const MarkdownBlockActionBar: React.FC<MarkdownBlockActionBarProps> = ({
  startLine,
  endLine,
  canMoveUp,
  canMoveDown,
  rightOffsetPx = 8,
  locale = 'zh-CN',
  onEdit,
  onInsertBelow,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}) => {
  const isZh = locale === 'zh-CN';
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // 二次确认态超时自动复位（清理定时器防泄漏）
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => {
      setConfirmingDelete(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const lineRangeText =
    endLine && endLine > startLine ? `L${startLine}–L${endLine}` : `L${startLine}`;

  // 当展开「更多」或处于「删除确认」时胶囊变宽，自动钳制 rightOffset 防止在极短标题/段落上向左溢出容器
  const effectiveRightOffsetPx = (() => {
    if (!isMoreOpen && !confirmingDelete) return rightOffsetPx;
    const parentWidth = barRef.current?.parentElement?.clientWidth ?? 0;
    if (parentWidth <= 0) return rightOffsetPx;
    const expandedEstimatedWidth = 228;
    const maxSafeRightOffset = Math.max(8, parentWidth - expandedEstimatedWidth - 8);
    return Math.min(rightOffsetPx, maxSafeRightOffset);
  })();

  return (
    <div
      ref={barRef}
      data-clipboard-ignore="true"
      onMouseLeave={() => {
        if (confirmingDelete) setConfirmingDelete(false);
        if (isMoreOpen) setIsMoreOpen(false);
      }}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        right: `${effectiveRightOffsetPx}px`,
        backgroundColor: 'var(--ov-bg-elevated)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text-secondary)',
        boxShadow: 'var(--ov-shadow)',
      }}
      className="ov-block-edit-trigger opacity-0 group-hover/ov-block:opacity-100 focus-within:opacity-100 pointer-events-none group-hover/ov-block:pointer-events-auto focus-within:pointer-events-auto absolute -top-3 z-20 flex items-center gap-0.5 p-0.5 rounded-lg border text-[11px] font-medium transition-all duration-150 select-none"
    >
      {!confirmingDelete ? (
        <>
          {/* 按钮 1：编辑小按钮（主操作） */}
          <button
            type="button"
            data-clipboard-ignore="true"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsMoreOpen(false);
              onEdit();
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer"
            title={
              isZh
                ? `原地专注编辑此块 (${lineRangeText} · Alt+双击)`
                : `In-place Focused Block Edit (${lineRangeText} · Alt+DoubleClick)`
            }
            aria-label="Focused Block Edit"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isZh ? '编辑' : 'Edit'}</span>
          </button>

          {/* 按钮 2：未展开时仅显示「更多」小按钮；点击「更多」后展开进阶操作项 */}
          {!isMoreOpen ? (
            <button
              type="button"
              data-clipboard-ignore="true"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsMoreOpen(true);
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer"
              title={isZh ? '展开更多块操作（插入/克隆/移动/删除）' : 'More Block Actions'}
              aria-label="More Block Actions"
              aria-expanded={false}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>{isZh ? '更多' : 'More'}</span>
            </button>
          ) : (
            <>
              <span
                aria-hidden="true"
                style={{ backgroundColor: 'var(--ov-border-subtle)' }}
                className="w-px h-3.5 mx-0.5 shrink-0"
              />

              {/* 下方插入新块并直接聚焦编辑 */}
              <button
                type="button"
                data-clipboard-ignore="true"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMoreOpen(false);
                  onInsertBelow();
                }}
                className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer"
                title={isZh ? '在下方插入新段落并立即编辑' : 'Insert New Block Below & Edit'}
                aria-label="Insert Block Below"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* 克隆当前块到下方 */}
              <button
                type="button"
                data-clipboard-ignore="true"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMoreOpen(false);
                  onDuplicate();
                }}
                className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer"
                title={isZh ? '向下方克隆此块副本' : 'Duplicate Block Below'}
                aria-label="Duplicate Block"
              >
                <CopyPlus className="w-3.5 h-3.5" />
              </button>

              {/* 上移块 */}
              {canMoveUp && (
                <button
                  type="button"
                  data-clipboard-ignore="true"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsMoreOpen(false);
                    onMoveUp();
                  }}
                  className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer"
                  title={isZh ? '与上方相邻块交换位置 (上移)' : 'Move Block Up'}
                  aria-label="Move Block Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}

              {/* 下移块 */}
              {canMoveDown && (
                <button
                  type="button"
                  data-clipboard-ignore="true"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsMoreOpen(false);
                    onMoveDown();
                  }}
                  className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-accent)] transition-colors cursor-pointer"
                  title={isZh ? '与下方相邻块交换位置 (下移)' : 'Move Block Down'}
                  aria-label="Move Block Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              )}

              {/* 删除此块（触发行内防误触确认） */}
              <button
                type="button"
                data-clipboard-ignore="true"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
                className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-danger,#ef4444)] transition-colors cursor-pointer"
                title={isZh ? `删除此块 (${lineRangeText})` : `Delete Block (${lineRangeText})`}
                aria-label="Delete Block"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* 收起更多操作按钮 */}
              <button
                type="button"
                data-clipboard-ignore="true"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMoreOpen(false);
                }}
                style={{ color: 'var(--ov-text-muted)' }}
                className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-text)] transition-colors cursor-pointer"
                title={isZh ? '收起更多操作' : 'Collapse More Actions'}
                aria-label="Collapse More Actions"
                aria-expanded={true}
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </>
      ) : (
        /* 行内二次确认态 */
        <div className="flex items-center gap-1 px-1.5 py-0.5">
          <span
            style={{ color: 'var(--ov-danger, #ef4444)' }}
            className="text-[11px] font-semibold"
          >
            {isZh ? `确认删除 ${lineRangeText}？` : `Delete ${lineRangeText}?`}
          </span>
          <button
            type="button"
            data-clipboard-ignore="true"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmingDelete(false);
              setIsMoreOpen(false);
              onDelete();
            }}
            style={{
              backgroundColor: 'var(--ov-danger, #ef4444)',
              color: 'var(--ov-text-on-accent, #ffffff)',
            }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            title={isZh ? '确认立即删除（支持撤销）' : 'Confirm Delete (Undo available)'}
          >
            <Check className="w-3 h-3" />
            <span>{isZh ? '删除' : 'Confirm'}</span>
          </button>
          <button
            type="button"
            data-clipboard-ignore="true"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmingDelete(false);
            }}
            style={{ color: 'var(--ov-text-muted)' }}
            className="p-0.5 rounded hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-text)] transition-colors cursor-pointer"
            title={isZh ? '取消删除' : 'Cancel'}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export interface DeletedBlockSnapshot {
  /** 删除前的完整 Markdown 源码 */
  previousFullContent: string;
  /** 被删除块的语义类型描述 */
  blockLabel: string;
  /** 行号区间描述 */
  lineRangeText: string;
  /** 时间戳（用于重置倒计时） */
  timestamp: number;
}

export interface MarkdownBlockUndoToastProps {
  snapshot: DeletedBlockSnapshot | null;
  locale?: Locale;
  onUndo: () => void;
  onDismiss: () => void;
}

export const MarkdownBlockUndoToast: React.FC<MarkdownBlockUndoToastProps> = ({
  snapshot,
  locale = 'zh-CN',
  onUndo,
  onDismiss,
}) => {
  const isZh = locale === 'zh-CN';

  useEffect(() => {
    if (!snapshot) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [snapshot, onDismiss]);

  if (!snapshot) return null;

  return (
    <div
      data-clipboard-ignore="true"
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: 'var(--ov-bg-elevated)',
        borderColor: 'var(--ov-accent)',
        color: 'var(--ov-text)',
        boxShadow: 'var(--ov-shadow)',
      }}
      className="sticky bottom-4 ml-auto mr-2 w-fit z-40 flex items-center gap-3 px-3.5 py-2 rounded-xl border text-xs transition-all duration-200 select-none"
    >
      <div className="flex items-center gap-1.5">
        <span
          style={{ backgroundColor: 'var(--ov-accent)' }}
          className="w-2 h-2 rounded-full shrink-0"
        />
        <span>
          {isZh
            ? `已删除「${snapshot.blockLabel} (${snapshot.lineRangeText})」`
            : `Deleted "${snapshot.blockLabel} (${snapshot.lineRangeText})"`}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-clipboard-ignore="true"
          onClick={onUndo}
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-accent)',
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md border font-semibold hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{isZh ? '撤销删除' : 'Undo'}</span>
        </button>

        <button
          type="button"
          data-clipboard-ignore="true"
          onClick={onDismiss}
          style={{ color: 'var(--ov-text-muted)' }}
          className="p-1 rounded-md hover:bg-[var(--ov-surface-header)] hover:text-[var(--ov-text)] transition-colors cursor-pointer"
          title={isZh ? '关闭提示' : 'Dismiss'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
