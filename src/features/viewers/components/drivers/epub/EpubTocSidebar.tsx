/**
 * OmniView EPUB 目录大纲侧边栏抽屉 (EpubTocSidebar)
 */
import React from 'react';
import { BookMarked, X, Search } from 'lucide-react';
import { type EpubTocItem, type EpubChapter } from '../../../lib/epubEngine';

export interface EpubTocSidebarProps {
  showToc: boolean;
  toc: EpubTocItem[];
  filteredToc: EpubTocItem[];
  tocSearch: string;
  currentChapter: EpubChapter | null;
  themeStyles: {
    toolbarBg: string;
    border: string;
  };
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onJumpToToc: (item: EpubTocItem) => void;
}

export const EpubTocSidebar: React.FC<EpubTocSidebarProps> = ({
  showToc,
  toc,
  filteredToc,
  tocSearch,
  currentChapter,
  themeStyles,
  onClose,
  onSearchChange,
  onJumpToToc,
}) => {
  if (!showToc) return null;

  return (
    <aside
      className="w-72 sm:w-80 h-full border-r flex flex-col z-20 shrink-0 shadow-xl transition-all duration-300"
      style={{
        background: themeStyles.toolbarBg,
        borderColor: themeStyles.border,
      }}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: themeStyles.border }}>
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider">目录大纲 ({toc.length})</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
          title="收起目录抽屉"
          aria-label="收起目录抽屉"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 目录快速检索 */}
      <div className="p-2 border-b" style={{ borderColor: themeStyles.border }}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/5 dark:bg-white/5 border text-xs" style={{ borderColor: themeStyles.border }}>
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <input
            type="text"
            placeholder="搜索章节标题..."
            value={tocSearch}
            onChange={e => onSearchChange(e.target.value)}
            className="bg-transparent border-none outline-hidden w-full text-xs placeholder:opacity-40"
          />
          {tocSearch && (
            <button onClick={() => onSearchChange('')} className="opacity-50 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 目录列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredToc.length > 0 ? (
          filteredToc.map((item, idx) => {
            const cleanItem = decodeURIComponent(item.href.split('#')[0].replace(/^\.\//, ''));
            const cleanCh = currentChapter ? decodeURIComponent(currentChapter.href.split('#')[0].replace(/^\.\//, '')) : '';
            const itemBase = cleanItem.split('/').pop()?.toLowerCase();
            const chBase = cleanCh.split('/').pop()?.toLowerCase();
            const isCurrent =
              cleanItem === cleanCh ||
              (!!itemBase && !!chBase && itemBase === chBase) ||
              (!!item.id && currentChapter?.id === item.id) ||
              (!!item.label && currentChapter?.title === item.label);

            return (
              <button
                key={`${item.href}-${idx}`}
                onClick={() => onJumpToToc(item)}
                style={{ paddingLeft: '8px' }}
                title={item.label}
                className={`w-full py-2 pr-2.5 rounded-lg text-left text-xs transition flex items-center justify-between group ${
                  isCurrent
                    ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <span className="truncate pr-2">{item.label}</span>
                {isCurrent ? (
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-1 shadow-xs ring-2 ring-blue-500/20" />
                ) : (
                  <span className="text-[10px] font-mono opacity-30 group-hover:opacity-60 shrink-0">
                    #{idx + 1}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs opacity-50">未检索到匹配章节</div>
        )}
      </div>
    </aside>
  );
};
