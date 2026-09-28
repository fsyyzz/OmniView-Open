/**
 * OmniView Word (.docx) 导航窗口 / 大纲侧边栏组件 (DocxTocSidebar)
 * 支持 H1~H6 层级标题树、实时检索筛选、多级缩进与滚动高亮跳转
 */
import React, { useState, useMemo } from 'react';
import { ListTree, X, Search, Hash, ChevronRight } from 'lucide-react';
import type { DocxTocItem } from '../../../lib/docxEngine';

export interface DocxTocSidebarProps {
  showNavigation: boolean;
  tocItems: DocxTocItem[];
  activeHeadingId: string | null;
  onClose: () => void;
  onSelectHeading: (item: DocxTocItem) => void;
}

export const DocxTocSidebar: React.FC<DocxTocSidebarProps> = ({
  showNavigation,
  tocItems,
  activeHeadingId,
  onClose,
  onSelectHeading,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');

  const filteredToc = useMemo(() => {
    if (!filterQuery.trim()) return tocItems;
    const q = filterQuery.toLowerCase();
    return tocItems.filter(item => item.text.toLowerCase().includes(q));
  }, [tocItems, filterQuery]);

  if (!showNavigation) return null;

  return (
    <aside className="w-72 sm:w-80 h-full border-r border-[var(--ov-border)] bg-[var(--ov-surface)] flex flex-col shrink-0 z-20 shadow-xl select-none animate-in slide-in-from-left duration-200">
      {/* 侧边栏头部 */}
      <div className="p-3 border-b border-[var(--ov-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500">
            <ListTree className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ov-text)]">
            导航窗口 ({tocItems.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition"
          title="收起导航窗口"
        >
          <X className="w-4 h-4 text-[var(--ov-text)]" />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="p-2 border-b border-[var(--ov-border)]">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-black/5 dark:bg-white/5 border border-[var(--ov-border)] focus-within:border-blue-500 transition">
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0 text-[var(--ov-text)]" />
          <input
            type="text"
            placeholder="搜索导航标题..."
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-[var(--ov-text)] placeholder:opacity-40"
          />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')} className="opacity-50 hover:opacity-100">
              <X className="w-3 h-3 text-[var(--ov-text)]" />
            </button>
          )}
        </div>
      </div>

      {/* 标题大纲列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredToc.length > 0 ? (
          filteredToc.map((item, idx) => {
            const isActive = activeHeadingId === item.id;
            const indentPx = Math.max(0, (item.level - 1) * 14);

            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => onSelectHeading(item)}
                style={{ paddingLeft: `${indentPx + 8}px` }}
                title={item.text}
                className={`w-full py-1.5 pr-2.5 rounded-md text-left text-xs transition flex items-center justify-between group ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs border-l-2 border-blue-500'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 text-[var(--ov-text)]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className="text-[10px] font-mono opacity-40 group-hover:opacity-70 shrink-0">
                    H{item.level}
                  </span>
                  <span className="truncate">{item.text}</span>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ml-1 shadow-xs ring-2 ring-blue-500/30" />
                )}
              </button>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs opacity-50 space-y-1">
            <p className="font-medium">未搜寻到匹配标题</p>
            <p className="text-[10px]">请检查搜索词或尝试重置搜索条件</p>
          </div>
        )}
      </div>
    </aside>
  );
};
