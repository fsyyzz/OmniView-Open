/**
 * Markdown 文档大纲侧边栏
 * 支持靠左/靠右/悬浮布局、宽度拖拽，以及列表 / 可折叠树形两种展示模式
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  MarkdownHeading,
  buildOutlineTree,
  flattenVisibleOutlineTree,
  collectOutlineAncestorIndexes,
} from '../../lib/markdownAst';
import { Locale, t } from '../../../../shared/lib/i18n';
import { OutlineDisplayMode, OutlinePosition } from '../../../../shared/types';
import {
  PanelLeft,
  PanelRight,
  Layers,
  X,
  List,
  ListTree,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface MarkdownOutlineSidebarProps {
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
}

const MIN_OUTLINE_WIDTH = 180;
const MAX_OUTLINE_WIDTH = 600;
const DEFAULT_OUTLINE_WIDTH = 260;

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
}) => {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(width || DEFAULT_OUTLINE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedIndexes, setCollapsedIndexes] = useState<Set<number>>(() => new Set());
  const currentWidthRef = useRef(sidebarWidth);
  currentWidthRef.current = sidebarWidth;

  const outlineTree = useMemo(
    () => buildOutlineTree(filteredHeadings),
    [filteredHeadings],
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

      <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-800/80 mb-2 gap-1.5 select-none shrink-0 min-w-0">
        <span className="markdown-outline-heading !p-0 truncate text-xs font-semibold text-slate-300 min-w-0 flex-1">
          {t('outlineHeading', locale)} ({filteredHeadings.length})
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-slate-900/60 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => onFilterLevelChange(2)}
              className={`px-1 py-0.5 rounded text-[10px] ${
                headingFilterLevel === 2 ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('filterH2', locale)}
            >
              H2
            </button>
            <button
              onClick={() => onFilterLevelChange(3)}
              className={`px-1 py-0.5 rounded text-[10px] ${
                headingFilterLevel === 3 ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('filterH3', locale)}
            >
              H3
            </button>
            <button
              onClick={() => onFilterLevelChange(6)}
              className={`px-1 py-0.5 rounded text-[10px] ${
                headingFilterLevel === 6 ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('filterAll', locale)}
            >
              {locale === 'zh-CN' ? '全' : 'All'}
            </button>
          </div>

          {onDisplayModeChange && (
            <div className="flex items-center bg-slate-900/60 p-0.5 rounded border border-slate-800">
              <button
                type="button"
                onClick={() => onDisplayModeChange('list')}
                className={`p-1 rounded transition ${
                  displayMode === 'list' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
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
                  displayMode === 'tree' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('outlineModeTreeTooltip', locale)}
                aria-label={t('outlineModeTree', locale)}
              >
                <ListTree size={11} />
              </button>
            </div>
          )}

          {onPositionChange && (
            <div className="flex items-center bg-slate-900/60 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => onPositionChange('left')}
                className={`p-1 rounded transition ${
                  position === 'left' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('outlinePosLeftTooltip', locale)}
                aria-label={t('outlinePosLeft', locale)}
              >
                <PanelLeft size={11} />
              </button>
              <button
                onClick={() => onPositionChange('right')}
                className={`p-1 rounded transition ${
                  position === 'right' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('outlinePosRightTooltip', locale)}
                aria-label={t('outlinePosRight', locale)}
              >
                <PanelRight size={11} />
              </button>
              <button
                onClick={() => onPositionChange('floating')}
                className={`p-1 rounded transition ${
                  position === 'floating' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
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
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title={t('outlineTooltip', locale)}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <nav className="markdown-outline-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5 space-y-0.5">
        {filteredHeadings.length === 0 ? (
          <div className="markdown-outline-empty">{t('noHeadings', locale)}</div>
        ) : displayMode === 'tree' ? (
          visibleTreeRows.map(({ node, depth, hasChildren }) => {
            const { heading } = node;
            const originalIndex = resolveOriginalIndex(heading);
            const isActive = originalIndex === activeHeadingIndex;
            const isCollapsed = collapsedIndexes.has(heading.index);
            return (
              <div
                key={`tree-${heading.index}-${heading.text}`}
                className={`markdown-outline-tree-row ${isActive ? 'is-active' : ''}`}
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
                  className={`markdown-outline-item markdown-outline-tree-label level-${heading.level} ${isActive ? 'is-active' : ''}`}
                  onClick={() => onJumpToHeading(originalIndex)}
                  title={heading.text}
                >
                  {heading.text}
                </button>
              </div>
            );
          })
        ) : (
          filteredHeadings.map(heading => {
            const originalIndex = resolveOriginalIndex(heading);
            const isActive = originalIndex === activeHeadingIndex;
            const indentClass = heading.level <= 1 ? 'pl-2' : heading.level === 2 ? 'pl-3.5' : heading.level === 3 ? 'pl-5' : 'pl-6';
            return (
              <button
                key={`list-${heading.index}-${heading.text}`}
                ref={isActive ? activeItemRef : null}
                className={`markdown-outline-item level-${heading.level} ${indentClass} ${isActive ? 'is-active' : ''}`}
                onClick={() => onJumpToHeading(originalIndex)}
                title={heading.text}
              >
                {heading.text}
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
};
