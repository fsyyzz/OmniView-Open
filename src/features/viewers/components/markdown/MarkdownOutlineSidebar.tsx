/**
 * Markdown 文档大纲侧边栏 (MarkdownOutlineSidebar)
 * 支持靠左/靠右/悬浮布局、宽度拖拽，以及列表 / 可折叠树形两种展示模式。
 * 融合方案一：全文检索热力聚类、章节分布计数角标、下钻上下文卡片及无冲突一键过滤。
 *
 * 作者: 周赞
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  MarkdownHeading,
  buildOutlineTree,
  flattenVisibleOutlineTree,
  collectOutlineAncestorIndexes,
} from '../../lib/markdownAst';
import type { DocumentSectionSearchMatch } from '../../lib/documentSearchAggregator';
import { Locale, t } from '../../../../shared/lib/i18n';
import { OutlineDisplayMode, OutlinePosition } from '../../../../shared/types';
import { renderTimeBudgetRegistry } from '../../lib/renderTimeBudget';
import {
  PanelLeft,
  PanelRight,
  Layers,
  X,
  List,
  ListTree,
  ChevronRight,
  ChevronDown,
  ZapOff,
  Sparkles,
  Filter,
} from 'lucide-react';

export interface MarkdownOutlineSidebarProps {
  headings: MarkdownHeading[];
  filteredHeadings: MarkdownHeading[];
  activeHeadingIndex: number;
  headingFilterLevel: number;
  onFilterLevelChange: (level: number) => void;
  onJumpToHeading: (index: number) => void;
  locale?: Locale;
  position?: OutlinePosition;
  onPositionChange?: (pos: OutlinePosition) => void;
  displayMode?: OutlineDisplayMode;
  onDisplayModeChange?: (mode: OutlineDisplayMode) => void;
  onClose?: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;

  // 全文搜索聚类热力扩展能力
  searchQuery?: string;
  totalMatchesCount?: number;
  activeMatchIndex?: number;
  searchGroups?: Map<string, DocumentSectionSearchMatch[]>;
  onSelectMatch?: (matchIndex: number) => void;
}

const MIN_OUTLINE_WIDTH = 180;
const MAX_OUTLINE_WIDTH = 600;
const DEFAULT_OUTLINE_WIDTH = 260;

/**
 * 章节下属搜索匹配片段抽屉
 */
interface SectionMatchDrawerProps {
  matches: DocumentSectionSearchMatch[];
  activeMatchIndex?: number;
  paddingLeftPx: number;
  locale: Locale;
  onSelectMatch?: (matchIndex: number) => void;
}

const SectionMatchDrawer: React.FC<SectionMatchDrawerProps> = ({
  matches,
  activeMatchIndex,
  paddingLeftPx,
  locale,
  onSelectMatch,
}) => {
  return (
    <div
      style={{ paddingLeft: `${paddingLeftPx}px` }}
      className="mt-1 mb-1.5 pr-1 space-y-1 animate-in fade-in-50 duration-150"
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
            title={`#${m.matchIndex + 1}`}
          >
            <div className="flex items-center justify-between text-[9px] font-mono opacity-50 mb-0.5">
              <span>#{m.matchIndex + 1}</span>
              {isMatchActive && (
                <span className="text-amber-500 font-bold">{locale === 'zh-CN' ? '当前' : 'Active'}</span>
              )}
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
  );
};

export const MarkdownOutlineSidebar: React.FC<MarkdownOutlineSidebarProps> = ({
  headings,
  filteredHeadings,
  activeHeadingIndex,
  headingFilterLevel,
  onFilterLevelChange,
  onJumpToHeading,
  locale = 'zh-CN',
  position = 'right',
  onPositionChange,
  displayMode = 'tree',
  onDisplayModeChange,
  onClose,
  width = DEFAULT_OUTLINE_WIDTH,
  onWidthChange,
  searchQuery = '',
  totalMatchesCount = 0,
  activeMatchIndex = -1,
  searchGroups = new Map(),
  onSelectMatch,
}) => {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(width || DEFAULT_OUTLINE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedIndexes, setCollapsedIndexes] = useState<Set<number>>(() => new Set());
  const currentWidthRef = useRef(sidebarWidth);
  currentWidthRef.current = sidebarWidth;

  // 搜索热力展开与仅显命中过滤控制
  const [filterOnlyMatched, setFilterOnlyMatched] = useState<boolean>(false);
  const [expandedMatchHeadings, setExpandedMatchHeadings] = useState<Set<number>>(() => new Set());

  const hasGlobalSearch = Boolean(searchQuery && searchQuery.trim().length > 0);

  // 监听慢块指标
  const [, setBudgetTick] = useState(0);
  useEffect(() => {
    return renderTimeBudgetRegistry.subscribe(() => {
      setBudgetTick(t => t + 1);
    });
  }, []);

  // 切换指定章节的搜索片段折叠/展开
  const toggleMatchExpand = useCallback((headingIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMatchHeadings(prev => {
      const next = new Set(prev);
      if (next.has(headingIndex)) {
        next.delete(headingIndex);
      } else {
        next.add(headingIndex);
      }
      return next;
    });
  }, []);

  // 结合“仅显命中”过滤计算实际用于展示的大纲项
  const displayedHeadings = useMemo(() => {
    if (!hasGlobalSearch || !filterOnlyMatched || !searchGroups) {
      return filteredHeadings;
    }
    return filteredHeadings.filter(h => {
      const matches = searchGroups.get(String(h.index));
      return Boolean(matches && matches.length > 0);
    });
  }, [filteredHeadings, hasGlobalSearch, filterOnlyMatched, searchGroups]);

  const outlineTree = useMemo(
    () => buildOutlineTree(displayedHeadings),
    [displayedHeadings],
  );

  const visibleTreeRows = useMemo(
    () => flattenVisibleOutlineTree(outlineTree, collapsedIndexes),
    [outlineTree, collapsedIndexes],
  );

  useEffect(() => {
    if (width && width !== currentWidthRef.current) {
      setSidebarWidth(width);
    }
  }, [width]);

  // 过滤级别变化时清空折叠，避免隐藏节点残留折叠状态
  useEffect(() => {
    setCollapsedIndexes(new Set());
  }, [headingFilterLevel]);

  // 当前章节路径自动展开，便于在树形模式下看到高亮项
  useEffect(() => {
    if (displayMode !== 'tree' || activeHeadingIndex < 0) return;
    const active = headings[activeHeadingIndex];
    if (!active) return;
    const ancestors = collectOutlineAncestorIndexes(outlineTree, active.index);
    if (!ancestors || ancestors.length === 0) return;
    setCollapsedIndexes(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const index of ancestors) {
        if (next.delete(index)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [displayMode, activeHeadingIndex, headings, outlineTree]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeHeadingIndex, displayMode, visibleTreeRows.length]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = currentWidthRef.current;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const calculated = position === 'left' ? startW + deltaX : startW - deltaX;
      const nextWidth = Math.min(MAX_OUTLINE_WIDTH, Math.max(MIN_OUTLINE_WIDTH, Math.round(calculated)));
      setSidebarWidth(nextWidth);
      currentWidthRef.current = nextWidth;
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      onWidthChange?.(currentWidthRef.current);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [position, onWidthChange]);

  const handleResetWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_OUTLINE_WIDTH);
    currentWidthRef.current = DEFAULT_OUTLINE_WIDTH;
    onWidthChange?.(DEFAULT_OUTLINE_WIDTH);
  }, [onWidthChange]);

  const toggleCollapsed = useCallback((headingIndex: number) => {
    setCollapsedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(headingIndex)) next.delete(headingIndex);
      else next.add(headingIndex);
      return next;
    });
  }, []);

  const resolveOriginalIndex = useCallback((heading: MarkdownHeading) => (
    headings.findIndex(h => h.index === heading.index)
  ), [headings]);

  const resizeTooltip = t('outlineResizeTooltip', locale);

  return (
    <aside
      className={`markdown-outline relative select-none ${isResizing ? 'is-resizing' : ''}`}
      data-position={position}
      data-display-mode={displayMode}
      aria-label={t('outlineHeading', locale)}
      style={
        position === 'floating'
          ? { width: `${sidebarWidth}px` }
          : { width: `${sidebarWidth}px`, flex: `0 0 ${sidebarWidth}px` }
      }
    >
      <div
        onPointerDown={handleResizeStart}
        onDoubleClick={handleResetWidth}
        title={resizeTooltip}
        aria-label={resizeTooltip}
        className={`absolute top-0 bottom-0 z-30 w-3 cursor-col-resize flex items-center justify-center group select-none transition-colors ${
          position === 'left' ? '-right-1.5' : '-left-1.5'
        }`}
      >
        <div
          className={`w-[2px] h-full transition-colors ${
            isResizing
              ? 'bg-blue-500 shadow-sm'
              : 'bg-transparent group-hover:bg-blue-400/80 group-active:bg-blue-500'
          }`}
        />
      </div>

      {/* 顶部工具条 */}
      <div className="flex items-center justify-between px-2 pb-2.5 border-b border-[var(--ov-border)] mb-2 gap-1.5 select-none shrink-0 min-w-0">
        <span className="markdown-outline-heading !p-0 truncate text-xs font-semibold text-[var(--ov-text)] min-w-0 flex-1">
          {t('outlineHeading', locale)} ({displayedHeadings.length})
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-md border border-[var(--ov-border)]">
            <button
              onClick={() => onFilterLevelChange(2)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                headingFilterLevel === 2
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={t('filterH2', locale)}
            >
              H2
            </button>
            <button
              onClick={() => onFilterLevelChange(3)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                headingFilterLevel === 3
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={t('filterH3', locale)}
            >
              H3
            </button>
            <button
              onClick={() => onFilterLevelChange(6)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                headingFilterLevel === 6
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={t('filterAll', locale)}
            >
              {locale === 'zh-CN' ? '全' : 'All'}
            </button>
          </div>

          {onDisplayModeChange && (
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-md border border-[var(--ov-border)]">
              <button
                type="button"
                onClick={() => onDisplayModeChange('list')}
                className={`p-1 rounded transition ${
                  displayMode === 'list'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={t('outlineModeListTooltip', locale)}
                aria-label={t('outlineModeList', locale)}
              >
                <List size={11} />
              </button>
              <button
                type="button"
                onClick={() => onDisplayModeChange('tree')}
                className={`p-1 rounded transition ${
                  displayMode === 'tree'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={t('outlineModeTreeTooltip', locale)}
                aria-label={t('outlineModeTree', locale)}
              >
                <ListTree size={11} />
              </button>
            </div>
          )}

          {onPositionChange && (
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-md border border-[var(--ov-border)]">
              <button
                onClick={() => onPositionChange('left')}
                className={`p-1 rounded transition ${
                  position === 'left'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={t('outlinePosLeftTooltip', locale)}
                aria-label={t('outlinePosLeft', locale)}
              >
                <PanelLeft size={11} />
              </button>
              <button
                onClick={() => onPositionChange('right')}
                className={`p-1 rounded transition ${
                  position === 'right'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={t('outlinePosRightTooltip', locale)}
                aria-label={t('outlinePosRight', locale)}
              >
                <PanelRight size={11} />
              </button>
              <button
                onClick={() => onPositionChange('floating')}
                className={`p-1 rounded transition ${
                  position === 'floating'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={t('outlinePosFloatingTooltip', locale)}
                aria-label={t('outlinePosFloating', locale)}
              >
                <Layers size={11} />
              </button>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[var(--ov-text-secondary)] hover:text-[var(--ov-text)] hover:bg-black/10 dark:hover:bg-white/10 transition"
              title={t('outlineTooltip', locale)}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 全文检索热力看板 (当处于搜索态时激活呈现) */}
      {hasGlobalSearch && (
        <div className="mx-2 mb-2 px-2.5 py-1.5 rounded-md bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs shrink-0 select-none animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium text-[11px]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                {t('searchMatchesFound', locale).replace('{count}', String(totalMatchesCount))}
              </span>
            </div>
            {/* 一键仅显示命中章节开关 */}
            <button
              type="button"
              onClick={() => setFilterOnlyMatched(prev => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition flex items-center gap-1 border ${
                filterOnlyMatched
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-black/5 dark:bg-white/10 border-[var(--ov-border)] opacity-80 hover:opacity-100'
              }`}
              title={t('filterOnlyMatchedTooltip', locale)}
            >
              <Filter className="w-2.5 h-2.5 shrink-0" />
              <span>{filterOnlyMatched ? t('filterAllHeadings', locale) : t('filterOnlyMatched', locale)}</span>
            </button>
          </div>
          <p className="text-[10px] opacity-60 mt-0.5">
            {t('searchDistribution', locale).replace('{count}', String(searchGroups.size))}
          </p>
        </div>
      )}

      {/* 大纲导航列表与搜索热力抽屉 */}
      <nav className="markdown-outline-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5 space-y-0.5">
        {displayedHeadings.length === 0 ? (
          <div className="markdown-outline-empty">
            {filterOnlyMatched && hasGlobalSearch
              ? (locale === 'zh-CN' ? '无匹配章节，点击上方还原' : 'No matching sections')
              : t('noHeadings', locale)}
          </div>
        ) : displayMode === 'tree' ? (
          visibleTreeRows.map(({ node, depth, hasChildren }) => {
            const { heading } = node;
            const originalIndex = resolveOriginalIndex(heading);
            const isActive = originalIndex === activeHeadingIndex;
            const isCollapsed = collapsedIndexes.has(heading.index);

            // 搜索命中归属
            const sectionMatches = searchGroups?.get(String(heading.index)) || [];
            const hasMatches = sectionMatches.length > 0;
            const isMatchExpanded = expandedMatchHeadings.has(heading.index) || (hasGlobalSearch && hasMatches && sectionMatches.length <= 3);
            const isDimmed = hasGlobalSearch && !hasMatches;

            return (
              <div key={`tree-section-${heading.index}-${heading.text}`} className="space-y-0.5">
                <div
                  className={`markdown-outline-tree-row ${isActive ? 'is-active' : ''} ${
                    isDimmed ? 'opacity-40 hover:opacity-80' : ''
                  }`}
                  style={{ paddingLeft: `${8 + depth * 14}px` }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      className="markdown-outline-tree-toggle"
                      onClick={() => toggleCollapsed(heading.index)}
                      title={isCollapsed ? t('outlineExpand', locale) : t('outlineCollapse', locale)}
                      aria-label={isCollapsed ? t('outlineExpand', locale) : t('outlineCollapse', locale)}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </button>
                  ) : (
                    <span className="markdown-outline-tree-spacer" aria-hidden />
                  )}
                  <button
                    type="button"
                    ref={isActive ? activeItemRef : null}
                    className={`markdown-outline-item markdown-outline-tree-label level-${heading.level} ${
                      isActive ? 'is-active' : ''
                    } flex items-center justify-between gap-1 flex-1 min-w-0`}
                    onClick={() => onJumpToHeading(originalIndex)}
                    title={heading.text}
                  >
                    <span className="truncate">{heading.text}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {renderTimeBudgetRegistry.isLineSlow(heading.index + 1) && (
                        <span
                          className="shrink-0 text-amber-500 text-[10px] flex items-center gap-0.5 px-1 rounded bg-amber-500/10 font-mono"
                          title={locale === 'zh-CN' ? '包含高耗时渲染块 (>800ms)' : 'Contains slow render block (>800ms)'}
                        >
                          <ZapOff size={9} />
                        </span>
                      )}
                      {hasMatches && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => toggleMatchExpand(heading.index, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              toggleMatchExpand(heading.index, e as unknown as React.MouseEvent);
                            }
                          }}
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition flex items-center gap-0.5 cursor-pointer ${
                            isMatchExpanded
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25'
                          }`}
                          title={locale === 'zh-CN' ? `点击展开/折叠本章节 ${sectionMatches.length} 处搜索片段` : `Click to toggle ${sectionMatches.length} matches`}
                        >
                          <span>{sectionMatches.length}</span>
                          {isMatchExpanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* 章节所属搜索片段抽屉 (下钻展开) */}
                {hasMatches && isMatchExpanded && (
                  <SectionMatchDrawer
                    matches={sectionMatches}
                    activeMatchIndex={activeMatchIndex}
                    paddingLeftPx={8 + depth * 14 + 16}
                    locale={locale}
                    onSelectMatch={onSelectMatch}
                  />
                )}
              </div>
            );
          })
        ) : (
          displayedHeadings.map(heading => {
            const originalIndex = resolveOriginalIndex(heading);
            const isActive = originalIndex === activeHeadingIndex;
            const indentClass = heading.level <= 1 ? 'pl-2' : heading.level === 2 ? 'pl-3.5' : heading.level === 3 ? 'pl-5' : 'pl-6';
            const isSlow = renderTimeBudgetRegistry.isLineSlow(heading.index + 1);

            // 搜索命中归属
            const sectionMatches = searchGroups?.get(String(heading.index)) || [];
            const hasMatches = sectionMatches.length > 0;
            const isMatchExpanded = expandedMatchHeadings.has(heading.index) || (hasGlobalSearch && hasMatches && sectionMatches.length <= 3);
            const isDimmed = hasGlobalSearch && !hasMatches;

            return (
              <div key={`list-section-${heading.index}-${heading.text}`} className="space-y-0.5">
                <div className={`flex items-center justify-between ${isDimmed ? 'opacity-40 hover:opacity-80' : ''}`}>
                  <button
                    type="button"
                    ref={isActive ? activeItemRef : null}
                    className={`markdown-outline-item level-${heading.level} ${indentClass} ${
                      isActive ? 'is-active' : ''
                    } flex-1 min-w-0 flex items-center justify-between gap-1`}
                    onClick={() => onJumpToHeading(originalIndex)}
                    title={heading.text}
                  >
                    <span className="truncate">{heading.text}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {isSlow && (
                        <span
                          className="shrink-0 text-amber-500 text-[10px] flex items-center gap-0.5 px-1 rounded bg-amber-500/10 font-mono"
                          title={locale === 'zh-CN' ? '包含高耗时渲染块 (>800ms)' : 'Contains slow render block (>800ms)'}
                        >
                          <ZapOff size={9} />
                        </span>
                      )}
                      {hasMatches && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => toggleMatchExpand(heading.index, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              toggleMatchExpand(heading.index, e as unknown as React.MouseEvent);
                            }
                          }}
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition flex items-center gap-0.5 cursor-pointer ${
                            isMatchExpanded
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25'
                          }`}
                          title={locale === 'zh-CN' ? `点击展开/折叠本章节 ${sectionMatches.length} 处搜索片段` : `Click to toggle ${sectionMatches.length} matches`}
                        >
                          <span>{sectionMatches.length}</span>
                          {isMatchExpanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* 章节所属搜索片段抽屉 (下钻展开) */}
                {hasMatches && isMatchExpanded && (
                  <SectionMatchDrawer
                    matches={sectionMatches}
                    activeMatchIndex={activeMatchIndex}
                    paddingLeftPx={20}
                    locale={locale}
                    onSelectMatch={onSelectMatch}
                  />
                )}
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
};
