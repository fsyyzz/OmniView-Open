/**
 * Markdown 文档大纲侧边栏组件 (支持靠左、靠右、悬浮三种布局模式切换与多语言)
 */
import React from 'react';
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
}

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
}) => {
  return (
    <aside
      className="markdown-outline"
      data-position={position}
      aria-label={t('outlineHeading', locale)}
    >
      <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-800/80 mb-2 gap-2 select-none">
        <span className="markdown-outline-heading !p-0 truncate text-xs font-semibold text-slate-300">
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

      <nav className="overflow-y-auto max-h-[calc(100vh-140px)]">
        {filteredHeadings.length === 0 ? (
          <div className="markdown-outline-empty">{t('noHeadings', locale)}</div>
        ) : (
          filteredHeadings.map(heading => {
            const originalIndex = headings.findIndex(h => h.index === heading.index);
            const isActive = originalIndex === activeHeadingIndex;
            return (
              <button
                key={`${heading.index}-${heading.text}`}
                className={`markdown-outline-item level-${heading.level} ${isActive ? 'is-active' : ''}`}
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
