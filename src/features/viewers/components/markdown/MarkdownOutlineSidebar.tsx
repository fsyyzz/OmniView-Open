/**
 * Markdown 文档大纲侧边栏组件 (支持靠左、靠右、悬浮三种布局模式切换、自由拖拽调整宽度与双滚动条防护)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MarkdownHeading } from '../../lib/markdownAst';
import { Locale, t } from '../../../../shared/lib/i18n';
import { OutlinePosition } from '../../../../shared/types';
import { PanelLeft, PanelRight, Layers, X } from 'lucide-react';

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
  onClose,
  width = DEFAULT_OUTLINE_WIDTH,
  onWidthChange,
}) => {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(width || DEFAULT_OUTLINE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const currentWidthRef = useRef(sidebarWidth);
  currentWidthRef.current = sidebarWidth;

  // 外部 width 变化时同步
  useEffect(() => {
    if (width && width !== currentWidthRef.current) {
      setSidebarWidth(width);
    }
  }, [width]);

  // 随正文阅读自动将当前对应高亮标题滚动至侧栏视口可见区域
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeHeadingIndex]);

  // 拖拽手柄开始调整宽度
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
      // 靠左布局: 向右拖动增大，向左拖动减小
      // 靠右或悬浮布局: 向左拖动增大，向右拖动减小
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

  // 双击手柄恢复默认宽度
  const handleResetWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_OUTLINE_WIDTH);
    currentWidthRef.current = DEFAULT_OUTLINE_WIDTH;
    onWidthChange?.(DEFAULT_OUTLINE_WIDTH);
  }, [onWidthChange]);

  const resizeTooltip = t('outlineResizeTooltip', locale);

  return (
    <aside
      className={`markdown-outline relative select-none ${isResizing ? 'is-resizing' : ''}`}
      data-position={position}
      aria-label={t('outlineHeading', locale)}
      style={
        position === 'floating'
          ? { width: `${sidebarWidth}px` }
          : { width: `${sidebarWidth}px`, flex: `0 0 ${sidebarWidth}px` }
      }
    >
      {/* 调整大小手柄 (根据位置自动停靠在大纲与正文的交界边缘) */}
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

      {/* 顶部标题与控制栏: 固定高度 shrink-0，禁止随内容滚动 */}
      <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-800/80 mb-2 gap-1.5 select-none shrink-0 min-w-0">
        <span className="markdown-outline-heading !p-0 truncate text-xs font-semibold text-slate-300 min-w-0 flex-1">
          {t('outlineHeading', locale)} ({filteredHeadings.length})
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 过滤级别 H2 / H3 / All */}
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

          {/* 布局停靠位置切换: 靠左 / 靠右 / 悬浮 */}
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

          {/* 关闭/收起大纲 */}
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

      {/* 目录列表: 唯一纵向滚动容器 (flex-1 min-h-0, 禁止横向溢出) */}
      <nav className="markdown-outline-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5 space-y-0.5">
        {filteredHeadings.length === 0 ? (
          <div className="markdown-outline-empty">{t('noHeadings', locale)}</div>
        ) : (
          filteredHeadings.map(heading => {
            const originalIndex = headings.findIndex(h => h.index === heading.index);
            const isActive = originalIndex === activeHeadingIndex;
            const indentClass = heading.level <= 1 ? 'pl-2' : heading.level === 2 ? 'pl-3.5' : heading.level === 3 ? 'pl-5' : 'pl-6';
            return (
              <button
                key={`${heading.index}-${heading.text}`}
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
