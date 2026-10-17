/**
 * OmniView SVG v2 — 画布右键上下文快捷菜单 (Phase 2)
 *
 * 能力：
 * - 复制 (Cmd+D)
 * - 编组 (Cmd+G) / 解组 (Cmd+Shift+G)
 * - 图层层级重排（置顶 / 上移 / 下移 / 置底）
 * - 选区对齐（左 / 中 / 右）
 * - 删除 (Delete / Backspace)
 * - 自动边界裁剪防止溢出屏幕，点击外部或 Escape 自动关闭
 */
import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Trash2,
  Folder,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import type {
  CommandId,
  CommandParams,
  Document,
  Selection,
} from './core';

export interface SvgV2ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly selection: Selection;
  readonly document: Document;
  readonly onClose: () => void;
  readonly execute: (commandId: CommandId, params: CommandParams) => void;
}

export const SvgV2ContextMenu: React.FC<SvgV2ContextMenuProps> = ({
  x,
  y,
  selection,
  document: doc,
  onClose,
  execute,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const selCount = selection.nodeIds.length;
  const hasSelection = selCount > 0;
  const canGroup = selCount >= 2;
  const hasGroup = selection.nodeIds.some((id) => doc.nodes.get(id)?.kind === 'Group');

  // 点击菜单外部或按下 Escape 自动关闭
  useEffect(() => {
    const handleOutsideDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleOutsideDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const handleAction = (cb: () => void) => {
    cb();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      data-svg-context-menu="true"
      className="absolute z-50 min-w-[190px] rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)]/95 p-1.5 text-xs text-[var(--ov-text)] shadow-2xl backdrop-blur-md select-none animate-fadeIn"
      style={{ left: Math.max(8, x), top: Math.max(8, y) }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 复制 */}
      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() => handleAction(() => execute('object.duplicate', {}))}
      >
        <span className="flex items-center gap-2">
          <Copy size={13} className="text-[var(--ov-fg-muted)]" />
          <span>创建副本</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⌘D</span>
      </button>

      {/* 编组 / 解组 */}
      <button
        type="button"
        role="menuitem"
        disabled={!canGroup}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() => handleAction(() => execute('object.group', { ids: [...selection.nodeIds] }))}
      >
        <span className="flex items-center gap-2">
          <Folder size={13} className="text-[var(--ov-fg-muted)]" />
          <span>编组</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⌘G</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!hasGroup}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() =>
          handleAction(() => {
            for (const id of selection.nodeIds) {
              if (doc.nodes.get(id)?.kind === 'Group') {
                execute('object.ungroup', { id });
              }
            }
          })
        }
      >
        <span className="flex items-center gap-2">
          <FolderOpen size={13} className="text-[var(--ov-fg-muted)]" />
          <span>解散编组</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⇧⌘G</span>
      </button>

      <div className="my-1 h-px bg-[var(--ov-border)]" />

      {/* 图层层级重排 */}
      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() =>
          handleAction(() => {
            for (const id of selection.nodeIds) {
              execute('object.reorder', { id, direction: 'front' });
            }
          })
        }
      >
        <span className="flex items-center gap-2">
          <ArrowUpToLine size={13} className="text-[var(--ov-fg-muted)]" />
          <span>置于顶层</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⇧⌘]</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() =>
          handleAction(() => {
            for (const id of selection.nodeIds) {
              execute('object.reorder', { id, direction: 'forward' });
            }
          })
        }
      >
        <span className="flex items-center gap-2">
          <ArrowUp size={13} className="text-[var(--ov-fg-muted)]" />
          <span>上移一层</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⌘]</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() =>
          handleAction(() => {
            for (const id of selection.nodeIds) {
              execute('object.reorder', { id, direction: 'backward' });
            }
          })
        }
      >
        <span className="flex items-center gap-2">
          <ArrowDown size={13} className="text-[var(--ov-fg-muted)]" />
          <span>下移一层</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⌘[</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ov-hover)] disabled:opacity-40 disabled:pointer-events-none"
        onClick={() =>
          handleAction(() => {
            for (const id of selection.nodeIds) {
              execute('object.reorder', { id, direction: 'back' });
            }
          })
        }
      >
        <span className="flex items-center gap-2">
          <ArrowDownToLine size={13} className="text-[var(--ov-fg-muted)]" />
          <span>置于底层</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--ov-fg-muted)]">⇧⌘[</span>
      </button>

      {canGroup && (
        <>
          <div className="my-1 h-px bg-[var(--ov-border)]" />
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[var(--ov-fg-muted)]">
            <span>对齐</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="左对齐"
                className="p-1 rounded hover:bg-[var(--ov-hover)] hover:text-[var(--ov-text)]"
                onClick={() => handleAction(() => execute('object.align', { ids: [...selection.nodeIds], align: 'left' }))}
              >
                <AlignLeft size={12} />
              </button>
              <button
                type="button"
                title="水平居中"
                className="p-1 rounded hover:bg-[var(--ov-hover)] hover:text-[var(--ov-text)]"
                onClick={() => handleAction(() => execute('object.align', { ids: [...selection.nodeIds], align: 'centerH' }))}
              >
                <AlignCenter size={12} />
              </button>
              <button
                type="button"
                title="右对齐"
                className="p-1 rounded hover:bg-[var(--ov-hover)] hover:text-[var(--ov-text)]"
                onClick={() => handleAction(() => execute('object.align', { ids: [...selection.nodeIds], align: 'right' }))}
              >
                <AlignRight size={12} />
              </button>
            </div>
          </div>
        </>
      )}

      <div className="my-1 h-px bg-[var(--ov-border)]" />

      {/* 删除 */}
      <button
        type="button"
        role="menuitem"
        disabled={!hasSelection}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-40 disabled:pointer-events-none"
        onClick={() => handleAction(() => execute('object.delete', { ids: [...selection.nodeIds] }))}
      >
        <span className="flex items-center gap-2">
          <Trash2 size={13} />
          <span>删除</span>
        </span>
        <span className="font-mono text-[10px] opacity-70">Del</span>
      </button>
    </div>
  );
};
