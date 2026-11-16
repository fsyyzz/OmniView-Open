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
} from 'lucide-react';
import type { DocxTocItem } from '../../../lib/docxEngine';
import type { DocxSectionSearchMatch } from '../../../lib/docxSearchAggregator';
import type { Locale } from '../../../../../shared/lib/i18n';

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
  locale?: Locale;
  onClose: () => void;
  onSelectHeading: (item: DocxTocItem) => void;
  onSelectMatch?: (matchIndex: number) => void;
}

const TOC_COPY: Record<Locale, {
  title: string;
  closeTip: string;
  matchesFound: (n: number) => string;
  onlyMatched: string;
  filtered: string;
  onlyMatchedTip: string;
  distribution: (n: number) => string;
  filterPlaceholder: string;
  matchesCountTip: (n: number) => string;
  expandContextTip: string;
  jumpMatchTip: (n: number) => string;
  currentMatch: string;
  emptyMatched: string;
  emptyMatchedHint: string;
  emptyHeadings: string;
  emptyHeadingsHint: string;
}> = {
  'zh-CN': {
    title: '文档导航',
    closeTip: '收起导航窗口 (Ctrl+Shift+O)',
    matchesFound: (n) => `找到 ${n} 处匹配`,
    onlyMatched: '仅显命中',
    filtered: '已过滤',
    onlyMatchedTip: '当大纲较多时，一键隐藏无匹配项的章节',
    distribution: (n) => `分布于 ${n} 个章节，点击章节角标展开上下文`,
    filterPlaceholder: '在目录大纲中过滤...',
    matchesCountTip: (n) => `${n} 处匹配`,
    expandContextTip: '点击展开/折叠本章节搜索上下文',
    jumpMatchTip: (n) => `跳转至第 ${n} 处匹配`,
    currentMatch: '当前',
    emptyMatched: '当前搜索词无对应章节匹配',
    emptyMatchedHint: '可点击上方“已过滤”还原完整大纲',
    emptyHeadings: '未搜寻到匹配标题',
    emptyHeadingsHint: '请检查搜索词或尝试重置',
  },
  'en-US': {
    title: 'Navigation',
    closeTip: 'Collapse navigation pane (Ctrl+Shift+O)',
    matchesFound: (n) => `${n} matches found`,
    onlyMatched: 'Matched',
    filtered: 'Filtered',
    onlyMatchedTip: 'Hide sections without search matches',
    distribution: (n) => `Across ${n} sections; click badge to expand context`,
    filterPlaceholder: 'Filter outline headings...',
    matchesCountTip: (n) => `${n} matches`,
    expandContextTip: 'Expand/collapse section search snippets',
    jumpMatchTip: (n) => `Jump to match #${n}`,
    currentMatch: 'Active',
    emptyMatched: 'No sections match the search query',
    emptyMatchedHint: 'Click "Filtered" above to restore full outline',
    emptyHeadings: 'No matching headings found',
    emptyHeadingsHint: 'Adjust filter or reset search',
  },
};

export const DocxTocSidebar: React.FC<DocxTocSidebarProps> = ({
  showNavigation,
  tocItems,
  activeHeadingId,
  searchQuery = '',
  totalMatchesCount = 0,
  activeMatchIndex = -1,
  searchGroups = new Map(),
  locale = 'zh-CN',
  onClose,
  onSelectHeading,
  onSelectMatch,
}) => {
  const copy = TOC_COPY[locale] || TOC_COPY['zh-CN'];

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
    <aside className="docx-toc-sidebar w-72 sm:w-80 h-full border-r border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-text)] flex flex-col shrink-0 z-20 select-none">
      {/* 侧边栏头部 */}
      <div className="px-3 py-2.5 border-b border-[var(--ov-border)] bg-[var(--ov-surface-header)] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-[var(--ov-accent-subtle)] border border-[var(--ov-border)] flex items-center justify-center text-[var(--ov-accent)] shrink-0">
            <ListTree className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ov-text)] truncate tabular-nums">
            {copy.title} ({tocItems.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-bg-elevated)] transition-colors"
          title={copy.closeTip}
          aria-label={copy.closeTip}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 全文检索热力态状态看板 */}
      {hasGlobalSearch && (
        <div className="px-3 py-2 bg-[var(--ov-accent-subtle)] border-b border-[var(--ov-border)] text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[var(--ov-accent)] font-medium tabular-nums">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{copy.matchesFound(totalMatchesCount)}</span>
            </div>
            <button
              type="button"
              onClick={() => setFilterOnlyMatched(prev => !prev)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 border shrink-0 ${
                filterOnlyMatched
                  ? 'bg-[var(--ov-accent)] text-white border-[var(--ov-accent)]'
                  : 'bg-[var(--ov-surface)] text-[var(--ov-text)] border-[var(--ov-border)] hover:bg-[var(--ov-bg-elevated)]'
              }`}
              title={copy.onlyMatchedTip}
            >
              <Filter className="w-3 h-3" />
              <span>{filterOnlyMatched ? copy.filtered : copy.onlyMatched}</span>
            </button>
          </div>
          <p className="text-[11px] text-[var(--ov-text-secondary)] mt-0.5 tabular-nums">
            {copy.distribution(searchGroups.size)}
          </p>
        </div>
      )}

      {/* 大纲局部过滤框 */}
      <div className="p-2 border-b border-[var(--ov-border)]">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[var(--ov-bg-elevated)] border border-[var(--ov-border)] focus-within:border-[var(--ov-accent)] transition-colors">
          <Search className="w-3.5 h-3.5 text-[var(--ov-text-secondary)] shrink-0" />
          <input
            type="text"
            placeholder={copy.filterPlaceholder}
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-[var(--ov-text)] placeholder:text-[var(--ov-text-secondary)]/70"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 标题大纲与搜索热力列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {displayedToc.length > 0 ? (
          displayedToc.map((item, idx) => {
            const isActive = activeHeadingId === item.id;
            const indentPx = Math.max(0, (item.level - 1) * 12);
            const matches = searchGroups.get(item.id) || [];
            const hasMatches = matches.length > 0;
            const isExpanded = expandedHeadings.has(item.id) || (hasGlobalSearch && matches.length > 0 && matches.length <= 3);
            const isDimmed = hasGlobalSearch && !hasMatches;

            return (
              <div key={`${item.id}-${idx}`} className="group/item">
                <div
                  onClick={() => onSelectHeading(item)}
                  style={{ paddingLeft: `${indentPx + 8}px` }}
                  title={`${item.text}${hasMatches ? ` (${copy.matchesCountTip(matches.length)})` : ''}`}
                  className={`w-full py-1.5 pr-2 rounded-md text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-[var(--ov-accent-subtle)] text-[var(--ov-accent)] font-semibold'
                      : 'hover:bg-[var(--ov-bg-elevated)] text-[var(--ov-text)]'
                  } ${isDimmed ? 'opacity-45 hover:opacity-85' : ''}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="text-[10px] font-mono text-[var(--ov-text-secondary)] shrink-0 tabular-nums">
                      H{item.level}
                    </span>
                    <span className="truncate">{item.text}</span>
                  </div>

                  {/* 右侧：命中数角标 */}
                  {hasMatches && (
                    <button
                      type="button"
                      onClick={(e) => toggleHeadingExpand(item.id, e)}
                      className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border transition-colors flex items-center gap-0.5 shrink-0 ml-1 ${
                        isExpanded
                          ? 'bg-[var(--ov-accent)] text-white border-[var(--ov-accent)]'
                          : 'bg-[var(--ov-surface-header)] text-[var(--ov-accent)] border-[var(--ov-border)] hover:bg-[var(--ov-accent-subtle)]'
                      }`}
                      title={copy.expandContextTip}
                    >
                      <span>{matches.length}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-2.5 h-2.5" />
                      ) : (
                        <ChevronRight className="w-2.5 h-2.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* 章节所属搜索匹配片段抽屉 (下钻展开) */}
                {hasMatches && isExpanded && (
                  <div
                    style={{ marginLeft: `${indentPx + 16}px` }}
                    className="mt-1 mb-1.5 pl-2 border-l border-[var(--ov-border)] space-y-1"
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
                          className={`p-1.5 rounded text-[11px] leading-snug transition-colors cursor-pointer border ${
                            isMatchActive
                              ? 'bg-[var(--ov-accent-subtle)] border-[var(--ov-accent)] font-medium text-[var(--ov-text)]'
                              : 'bg-[var(--ov-bg-elevated)] border-[var(--ov-border)] hover:border-[var(--ov-accent)] text-[var(--ov-text)] opacity-85 hover:opacity-100'
                          }`}
                          title={copy.jumpMatchTip(m.matchIndex + 1)}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--ov-text-secondary)] mb-0.5 tabular-nums">
                            <span>#{m.matchIndex + 1}</span>
                            {isMatchActive && (
                              <span className="text-[var(--ov-accent)] font-semibold">{copy.currentMatch}</span>
                            )}
                          </div>
                          <p className="line-clamp-2 break-all text-[11px]">
                            {m.prefix}
                            <mark className="bg-[var(--ov-warning)]/30 text-[var(--ov-text)] rounded px-0.5 font-semibold">
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
          <div className="p-6 text-center text-xs text-[var(--ov-text-secondary)] space-y-1">
            <p className="font-medium">
              {filterOnlyMatched ? copy.emptyMatched : copy.emptyHeadings}
            </p>
            <p className="text-[11px] opacity-80">
              {filterOnlyMatched ? copy.emptyMatchedHint : copy.emptyHeadingsHint}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
