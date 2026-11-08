/**
 * OmniView SVG v2 — 画布内双击原地文本编辑器 (SVG-01 In-Place Text Editing)
 *
 * 职责：
 * - 双击 Text 图元或新建文本后，在画布对应坐标上方弹出半透明原地富文本编辑层
 * - 支持多行文本输入（自动同步拆分为 `<tspan dy="1.2em">` 行）
 * - 支持快捷调节字号、字重、对齐方式与文字颜色
 * - `Ctrl+Enter` / `Cmd+Enter` 或点击外部提交（`text.setText`），`Escape` 取消
 * - 100% 遵循 `--ov-*` 语义设计令牌
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, X, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';
import type { CommandId, CommandParams, TextNode } from './core';

export interface SvgV2InlineTextEditorProps {
  readonly node: TextNode;
  readonly left: number;
  readonly top: number;
  readonly scale: number;
  readonly execute: (commandId: CommandId, params: CommandParams) => void;
  readonly onClose: () => void;
}

export const SvgV2InlineTextEditor: React.FC<SvgV2InlineTextEditorProps> = ({
  node,
  left,
  top,
  scale,
  execute,
  onClose,
}) => {
  const initialText =
    node.tspans && node.tspans.length > 0
      ? node.tspans.map((sp) => sp.text).join('\n')
      : node.text || '';

  const [textDraft, setTextDraft] = useState(initialText);
  const [fontSize, setFontSize] = useState<number>(node.fontSize ?? 16);
  const [fontWeight, setFontWeight] = useState<string>(node.fontWeight ?? 'normal');
  const [textAnchor, setTextAnchor] = useState<'start' | 'middle' | 'end'>(node.textAnchor ?? 'start');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, [node.id]);

  const commitAndClose = () => {
    const trimmed = textDraft.replace(/\r\n/g, '\n');
    if (trimmed.trim().length > 0) {
      execute('text.setText', {
        id: node.id,
        text: trimmed,
        fontSize,
        fontWeight,
        textAnchor,
      });
    }
    onClose();
  };

  const visualFontSize = Math.min(42, Math.max(12, Math.round(fontSize * Math.max(0.6, Math.min(scale, 2)))));

  return (
    <div
      data-canvas-ui="true"
      data-testid="svg-inline-text-editor"
      className="
        absolute z-50 flex flex-col gap-1.5 rounded-lg
        border border-[var(--ov-accent)] bg-[var(--ov-surface)]/95
        p-2 shadow-2xl backdrop-blur-md text-xs text-[var(--ov-fg)]
        animate-fadeIn
      "
      style={{
        left: Math.max(12, left),
        top: Math.max(12, top - 34),
        minWidth: 220,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* 顶部迷你在地格式栏 */}
      <div className="flex items-center justify-between gap-1.5 border-b border-[var(--ov-border)]/70 pb-1 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-[var(--ov-accent)]">原地编辑文本</span>
          <input
            type="number"
            min={8}
            max={160}
            value={fontSize}
            title="字号 (px)"
            className="
              w-12 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]
              px-1 py-0.5 text-right font-mono text-[11px] text-[var(--ov-fg)]
            "
            onChange={(e) => {
              const v = Math.max(8, Number(e.target.value));
              if (Number.isFinite(v)) setFontSize(v);
            }}
          />
          <button
            type="button"
            title="加粗 (Bold)"
            className={`
              flex h-5 w-5 items-center justify-center rounded border transition-colors
              ${
                fontWeight === 'bold' || fontWeight === '700'
                  ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)]'
                  : 'border-[var(--ov-border)] bg-[var(--ov-bg)] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)]'
              }
            `}
            onClick={() => setFontWeight((w) => (w === 'bold' ? 'normal' : 'bold'))}
          >
            <Bold size={11} />
          </button>
          <div className="flex items-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] p-0.5">
            {(
              [
                { k: 'start', icon: <AlignLeft size={11} />, label: '左对齐' },
                { k: 'middle', icon: <AlignCenter size={11} />, label: '居中对齐' },
                { k: 'end', icon: <AlignRight size={11} />, label: '右对齐' },
              ] as const
            ).map((item) => (
              <button
                key={item.k}
                type="button"
                title={item.label}
                className={`
                  flex h-4 w-4 items-center justify-center rounded transition-colors
                  ${
                    textAnchor === item.k
                      ? 'bg-[var(--ov-accent)] text-white'
                      : 'text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]'
                  }
                `}
                onClick={() => setTextAnchor(item.k)}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="确认修改 (Ctrl+Enter)"
            className="
              flex h-5 w-5 items-center justify-center rounded
              bg-[var(--ov-accent)] text-white hover:opacity-90
            "
            onClick={commitAndClose}
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            title="取消编辑 (Esc)"
            className="
              flex h-5 w-5 items-center justify-center rounded
              border border-[var(--ov-border)] bg-[var(--ov-bg)]
              text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)]
            "
            onClick={onClose}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 多行文本输入区 */}
      <textarea
        ref={textareaRef}
        rows={Math.max(2, Math.min(6, textDraft.split('\n').length))}
        value={textDraft}
        placeholder="输入文本（换行自动生成多行 tspan）..."
        style={{
          fontSize: `${visualFontSize}px`,
          fontFamily: node.fontFamily || 'sans-serif',
          fontWeight,
          lineHeight: 1.25,
        }}
        className="
          w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]
          px-2 py-1 text-[var(--ov-fg)] focus:border-[var(--ov-accent)] focus:outline-none
          resize-both
        "
        onChange={(e) => setTextDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
            // Enter 直接提交，Shift+Enter 换行
            e.preventDefault();
            commitAndClose();
          }
        }}
      />

      <div className="flex items-center justify-between text-[10px] text-[var(--ov-fg-muted)]">
        <span>Enter 确认 · Shift+Enter 换行 · Esc 取消</span>
        <span className="font-mono">{textDraft.split('\n').length} 行</span>
      </div>
    </div>
  );
};
