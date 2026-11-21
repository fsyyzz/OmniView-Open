import React from 'react';
import { Bookmark, Highlighter, Search, StickyNote, Trash2, X } from 'lucide-react';
import type { EpubSearchResult } from '../../../lib/epubEngine';
import type { EpubAnnotation } from '../../../lib/epubSettingsStorage';

export type EpubToolsMode = 'search' | 'annotations';

interface EpubToolsSidebarProps {
  mode: EpubToolsMode;
  searchQuery: string;
  searchResults: EpubSearchResult[];
  annotations: EpubAnnotation[];
  themeStyles: {
    toolbarBg: string;
    paper: string;
    border: string;
  };
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onSelectSearchResult: (result: EpubSearchResult) => void;
  onSelectAnnotation: (annotation: EpubAnnotation) => void;
  onUpdateAnnotation: (id: string, patch: Partial<EpubAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
}

export const EpubToolsSidebar: React.FC<EpubToolsSidebarProps> = ({
  mode,
  searchQuery,
  searchResults,
  annotations,
  themeStyles,
  onClose,
  onSearchChange,
  onSelectSearchResult,
  onSelectAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}) => {
  return (
    <aside
      className="w-80 max-w-[85vw] h-full border-r flex flex-col z-20 shrink-0 shadow-xl"
      style={{ background: themeStyles.toolbarBg, borderColor: themeStyles.border }}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: themeStyles.border }}>
        <div className="flex items-center gap-2">
          {mode === 'search' ? <Search className="w-4 h-4 text-blue-500" /> : <Bookmark className="w-4 h-4 text-blue-500" />}
          <h3 className="text-xs font-bold">{mode === 'search' ? '全书搜索' : '书签与批注'}</h3>
          {mode === 'annotations' && <span className="text-[10px] opacity-50">{annotations.length}</span>}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10" aria-label="关闭面板">
          <X className="w-4 h-4" />
        </button>
      </div>

      {mode === 'search' ? (
        <>
          <div className="p-3 border-b" style={{ borderColor: themeStyles.border }}>
            <label className="flex items-center gap-2 px-2 py-1.5 rounded border bg-black/5 dark:bg-white/5" style={{ borderColor: themeStyles.border }}>
              <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={event => onSearchChange(event.target.value)}
                placeholder="搜索书籍正文..."
                className="w-full bg-transparent border-none outline-hidden text-xs"
                aria-label="搜索书籍正文"
              />
              {searchQuery && (
                <button onClick={() => onSearchChange('')} aria-label="清除搜索" className="opacity-50 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              )}
            </label>
            <div className="mt-2 text-[10px] opacity-50">
              {searchQuery.trim() ? `找到 ${searchResults.length} 个匹配` : '输入关键词搜索所有章节'}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {searchResults.map((result, index) => (
              <button
                key={`${result.chapterIndex}-${result.matchOrdinal}-${index}`}
                onClick={() => onSelectSearchResult(result)}
                className="w-full rounded-lg p-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-current/10"
              >
                <span className="block text-[10px] font-semibold text-blue-500 mb-1">
                  第 {result.chapterIndex + 1} 章 · {result.chapterTitle}
                </span>
                <span className="block text-xs leading-relaxed opacity-80 line-clamp-3">{result.snippet}</span>
              </button>
            ))}
            {searchQuery.trim() && searchResults.length === 0 && (
              <p className="p-4 text-center text-xs opacity-50">没有找到匹配内容</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {annotations.map(annotation => (
            <article key={annotation.id} className="rounded-lg border p-2.5" style={{ borderColor: themeStyles.border, background: themeStyles.paper }}>
              <div className="flex items-start gap-2">
                <button
                  onClick={() => onSelectAnnotation(annotation)}
                  className="flex-1 min-w-0 text-left"
                  title="跳转到此位置"
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-500 mb-1">
                    {annotation.kind === 'bookmark' ? <Bookmark className="w-3 h-3" /> : annotation.kind === 'highlight' ? <Highlighter className="w-3 h-3" /> : <StickyNote className="w-3 h-3" />}
                    {annotation.kind === 'bookmark' ? '书签' : annotation.kind === 'highlight' ? '划线' : '笔记'}
                    <span className="opacity-60">· 第 {annotation.chapterIndex + 1} 章</span>
                  </span>
                  <span className="block text-xs leading-relaxed opacity-80 line-clamp-3">
                    {annotation.quote || annotation.chapterTitle || '本章书签'}
                  </span>
                </button>
                <button
                  onClick={() => onDeleteAnnotation(annotation.id)}
                  className="p-1 rounded opacity-50 hover:opacity-100 hover:text-red-500"
                  title="删除"
                  aria-label="删除书签或批注"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {annotation.kind === 'note' && (
                <textarea
                  value={annotation.note}
                  onChange={event => onUpdateAnnotation(annotation.id, { note: event.target.value })}
                  placeholder="添加你的笔记..."
                  aria-label="笔记内容"
                  className="mt-2 w-full min-h-16 resize-y rounded border bg-transparent p-2 text-xs outline-hidden focus:border-blue-500"
                  style={{ borderColor: themeStyles.border }}
                />
              )}
            </article>
          ))}
          {annotations.length === 0 && (
            <p className="p-5 text-center text-xs opacity-50">还没有书签或批注。选中文本可添加划线或笔记。</p>
          )}
        </div>
      )}
    </aside>
  );
};
