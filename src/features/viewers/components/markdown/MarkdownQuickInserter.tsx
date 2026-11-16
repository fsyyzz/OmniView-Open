import React, { useState } from 'react';

export interface MarkdownQuickInserterProps {
  caretLeft: number;
  caretTop: number;
  cursorLine: number;
  cursorColumn: number;
  containerWidth: number;
  isVisible: boolean;
  locale?: string;
  onInsert: (snippet: string) => void;
}

interface QuickSnippet {
  id: string;
  label: string;
  icon: string;
  title: string;
  snippet: string;
}

const SNIPPETS: QuickSnippet[] = [
  {
    id: 'h2',
    label: '标题',
    icon: 'H2',
    title: '二级标题',
    snippet: '## 新章节标题\n',
  },
  {
    id: 'table',
    label: '表格',
    icon: '⊞',
    title: '三列表格',
    snippet: '| 字段名 | 类型 | 说明 |\n|---|---|---|\n| id | string | 唯一标识符 |\n| status | enum | 当前状态 |\n',
  },
  {
    id: 'alert',
    label: '提示框',
    icon: '💡',
    title: 'GitHub Alert 提示框',
    snippet: '> [!NOTE]\n> 这是一个重要的提示内容。\n',
  },
  {
    id: 'tabs',
    label: '标签页',
    icon: '🗂',
    title: '多标签页组',
    snippet: '<!-- tabs:start -->\n#### **npm**\n```bash\nnpm install omniview\n```\n#### **pnpm**\n```bash\npnpm add omniview\n```\n<!-- tabs:end -->\n',
  },
  {
    id: 'mermaid',
    label: '流程图',
    icon: '📊',
    title: 'Mermaid 流程图',
    snippet: '```mermaid\ngraph TD\n  A[开始] --> B[处理]\n  B --> C[完成]\n```\n',
  },
  {
    id: 'domainstory',
    label: '领域故事',
    icon: '👥',
    title: 'DDD 领域故事图',
    snippet: '```domainstory\ntitle: 业务协作流程\nactors:\n  - 客户 [person]\n  - 订单系统 [system]\nactivities:\n  1. 客户 -> 提交订单 -> 购物清单 [document] -> 订单系统\n```\n',
  },
];

export const MarkdownQuickInserter: React.FC<MarkdownQuickInserterProps> = ({
  caretLeft,
  caretTop,
  isVisible,
  onInsert,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isVisible) return null;

  // 限制浮动按钮与面板不会超出容器边界
  const posLeft = Math.max(16, Math.min(caretLeft + 12, window.innerWidth - 320));
  const posTop = Math.max(8, caretTop + 24);

  return (
    <div
      className="absolute z-30 transition-all duration-150 ease-out select-none"
      style={{
        left: `${posLeft}px`,
        top: `${posTop}px`,
      }}
    >
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--ov-bg-surface,#1e293b)] border border-[var(--ov-border,#334155)] shadow-xl backdrop-blur-md text-[var(--ov-text,#f8fafc)] text-xs">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--ov-accent,#0284c7)] hover:brightness-110 text-white font-medium text-xs transition"
          title="快速插入 Markdown 特性"
        >
          <span>＋</span>
          <span>插入</span>
        </button>

        {isOpen && (
          <div className="flex items-center gap-1 pl-1 border-l border-[var(--ov-border,#334155)]">
            {SNIPPETS.map((snip) => (
              <button
                key={snip.id}
                type="button"
                onClick={() => {
                  onInsert(snip.snippet);
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--ov-bg-hover,#334155)] text-[var(--ov-text,#e2e8f0)] hover:text-white transition"
                title={snip.title}
              >
                <span>{snip.icon}</span>
                <span>{snip.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
