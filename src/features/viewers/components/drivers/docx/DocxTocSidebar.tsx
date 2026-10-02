/**
 * OmniView Word (.docx) 导航窗口 / 大纲与检索热力侧边栏组件 (DocxTocSidebar)
 * 采用方案一：大纲与搜索就地融合过滤与热力角标展开。
 * 支持 H1~H6 层级标题树、实时关键字章节聚类分布、计数徽标、下钻上下文片段以及一键过滤命中章节。
 *
 * 作者: 周赞
 */
import React, { useState, useMemo } from 'react';
import {
  ListTree,
  X,
  Search,
  ChevronRight,
  ChevronDown,
  Filter,
  Sparkles,
  Bookmark,
} from 'lucide-react';
import type { DocxTocItem } from '../../../lib/docxEngine';
import type { DocxSectionSearchMatch } from '../../../lib/docxSearchAggregator';

export interface DocxTocSidebarProps {
  showNavigation: boolean;
  tocItems: DocxTocItem[];
  activeHeadingId: string | null;
  /** 全文检索关键字 (若处于搜索态) */
  searchQuery?: string;
  /** 全文匹配总数 */
  totalMatchesCount?: number;
  /** 当前活动激活的匹配项索引 (0-indexed) */
  activeMatchIndex?: number;
  /** 章节与命中项的映射分组表 */
  searchGroups?: Map<string, DocxSectionSearchMatch[]>;
  onClose: () => void;
  onSelectHeading: (item: DocxTocItem) => void;
  onSelectMatch?: (matchIndex: number) => void;
}

export const DocxTocSidebar: React.FC<DocxTocSidebarProps> = ({
  showNavigation,
  tocItems,
  activeHeadingId,
  searchQuery = '',
  totalMatchesCount = 0,
  activeMatchIndex = -1,
  searchGroups = new Map(),
  onClose,
  onSelectHeading,
  onSelectMatch,
}) => {
  // 侧边栏内部大纲标题快速过滤
  const [filterQuery, setFilterQuery] = useState<string>('');
  // 处于全文搜索态时，用户可一键折叠无匹配项章节
  const [filterOnlyMatched, setFilterOnlyMatched] = useState<boolean>(false);
  // 展开匹配片段列表的 headingId 集合
  const [expandedHeadings, setExpandedHeadings] = useState<Set<string>>(new Set());

  const hasGlobalSearch = Boolean(searchQuery && searchQuery.trim().length > 0);

  // 切换指定章节的搜索结果展开/折叠
  const toggleHeadingExpand = (headingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedHeadings(prev => {
      const next = new Set(prev);
      if (next.has(headingId)) {
        next.delete(headingId);
      } else {
        next.add(headingId);
      }
      return next;
    });
  };

  // 过滤后的目录列表
  const displayedToc = useMemo(() => {
    let list = tocItems;

    // 1. 若开启了“仅显示含匹配章节”且处于搜索状态
    if (hasGlobalSearch && filterOnlyMatched) {
      list = list.filter(item => {
        const matches = searchGroups.get(item.id);
        return matches && matches.length > 0;
      });
    }

    // 2. 侧边栏内部搜索过滤
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter(item => item.text.toLowerCase().includes(q));
    }

    return list;
  }, [tocItems, hasGlobalSearch, filterOnlyMatched, searchGroups, filterQuery]);

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
            文档导航 ({tocItems.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition"
          title="收起导航窗口 (Ctrl+Shift+O)"
        >
          <X className="w-4 h-4 text-[var(--ov-text)]" />
        </button>
      </div>

      {/* 全文检索热力态状态看板 */}
      {hasGlobalSearch && (
        <div className="px-3 py-2 bg-blue-500/10 dark:bg-blue-500/15 border-b border-blue-500/20 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                找到 <strong className="font-bold">{totalMatchesCount}</strong> 处匹配
              </span>
            </div>
            {/* 一键仅显示命中章节开关 */}
            <button
              onClick={() => setFilterOnlyMatched(prev => !prev)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition flex items-center gap-1 border ${
                filterOnlyMatched
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-black/5 dark:bg-white/10 border-[var(--ov-border)] opacity-80 hover:opacity-100'
              }`}
              title="当大纲较多时，一键隐藏无匹配项的章节"
            >
              <Filter className="w-3 h-3" />
              <span>{filterOnlyMatched ? '已过滤' : '仅显命中'}</span>
            </button>
          </div>
          <p className="text-[10px] opacity-60 mt-0.5">
            分布于 {searchGroups.size} 个章节，点击章节徽标可展开上下文
          </p>
        </div>
      )}

      {/* 搜索框 */}
      <div className="p-2 border-b border-[var(--ov-border)]">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-black/5 dark:bg-white/5 border border-[var(--ov-border)] focus-within:border-blue-500 transition">
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0 text-[var(--ov-text)]" />
          <input
            type="text"
            placeholder="在目录大纲中过滤..."
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

      {/* 标题大纲与搜索热力列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {displayedToc.length > 0 ? (
          displayedToc.map((item, idx) => {
            const isActive = activeHeadingId === item.id;
            const indentPx = Math.max(0, (item.level - 1) * 12);
            const matches = searchGroups.get(item.id) || [];
            const hasMatches = matches.length > 0;
            const isExpanded = expandedHeadings.has(item.id) || (hasGlobalSearch && matches.length > 0 && matches.length <= 3);

            // 当处于全文搜索态时，无匹配的章节半透明显示
            const isDimmed = hasGlobalSearch && !hasMatches;

            return (
              <div key={`${item.id}-${idx}`} className="group/item">
                <div
                  onClick={() => onSelectHeading(item)}
                  style={{ paddingLeft: `${indentPx + 6}px` }}
                  title={`${item.text}${hasMatches ? ` (${matches.length} 处匹配)` : ''}`}
                  className={`w-full py-1.5 pr-2 rounded-md text-left text-xs transition flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs border-l-2 border-blue-500'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--ov-text)]'
                  } ${isDimmed ? 'opacity-40 hover:opacity-80' : 'opacity-90 hover:opacity-100'}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="text-[10px] font-mono opacity-40 group-hover/item:opacity-70 shrink-0">
                      H{item.level}
                    </span>
                    <span className="truncate">{item.text}</span>
                  </div>

                  {/* 右侧：命中徽标或活动指示器 */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {hasMatches && (
                      <span
                        onClick={(e) => toggleHeadingExpand(item.id, e)}
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition flex items-center gap-0.5 cursor-pointer ${
                          isExpanded
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25'
                        }`}
                        title="点击展开/折叠本章节搜索上下文"
                      >
                        {matches.length}
                        {isExpanded ? (
                          <ChevronDown className="w-2.5 h-2.5" />
                        ) : (
                          <ChevronRight className="w-2.5 h-2.5" />
                        )}
                      </span>
                    )}
                    {isActive && !hasMatches && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-xs ring-2 ring-blue-500/30" />
                    )}
                  </div>
                </div>

                {/* 章节所属搜索匹配片段抽屉 (下钻展开) */}
                {hasMatches && isExpanded && (
                  <div
                    style={{ marginLeft: `${indentPx + 16}px` }}
                    className="mt-1 mb-1.5 pl-2 border-l border-blue-500/30 space-y-1 animate-in fade-in-50 duration-150"
                  >
                    {matches.map((m) => {
                      const isMatchActive = activeMatchIndex === m.matchIndex;

                      return (
                        <div
                          key={`match-${m.matchIndex}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMatch?.(m.matchIndex);
                          }}
                          className={`p-1.5 rounded text-[11px] font-sans leading-tight transition cursor-pointer border ${
                            isMatchActive
                              ? 'bg-amber-500/20 dark:bg-amber-500/25 border-amber-500/50 shadow-2xs font-medium text-[var(--ov-text)]'
                              : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-[var(--ov-border)] hover:bg-black/10 dark:hover:bg-white/10 text-[var(--ov-text)] opacity-80 hover:opacity-100'
                          }`}
                          title={`跳转至第 ${m.matchIndex + 1} 处匹配`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono opacity-50 mb-0.5">
                            <span>#{m.matchIndex + 1}</span>
                            {isMatchActive && <span className="text-amber-500 font-bold">当前</span>}
                          </div>
                          <p className="line-clamp-2 break-all text-[11px]">
                            {m.prefix}
                            <mark className="bg-amber-400/50 dark:bg-amber-400/40 text-amber-900 dark:text-amber-100 rounded px-0.5 font-semibold">
                              {m.matched}
                            </mark>
                            {m.suffix}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs opacity-50 space-y-1">
            <p className="font-medium">
              {filterOnlyMatched ? '当前搜索词无对应章节匹配' : '未搜寻到匹配标题'}
            </p>
            <p className="text-[10px]">
              {filterOnlyMatched ? '可点击上方“已过滤”还原完整大纲' : '请检查搜索词或尝试重置'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
