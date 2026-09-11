/**
 * Typst 目录大纲侧边栏组件
 */
import React from 'react';
import { ListTree } from 'lucide-react';
import { TypstCompileResult } from '../../../lib/typstEngine';

interface TypstOutlineSidebarProps {
  compileResult: TypstCompileResult;
  currentPage: number;
  onJumpToPage: (pageNumber: number) => void;
  locale?: 'zh-CN' | 'en-US';
}

export const TypstOutlineSidebar: React.FC<TypstOutlineSidebarProps> = ({
  compileResult,
  currentPage,
  onJumpToPage,
  locale = 'zh-CN',
}) => {
  return (
    <div className="w-56 flex-shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col min-h-0 z-10 select-none">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1.5 text-slate-200">
          <ListTree className="w-3.5 h-3.5 text-sky-400" />
          {locale === 'zh-CN' ? '文档大纲' : 'Outline'}
        </span>
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          {compileResult.outline.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {compileResult.outline.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            {locale === 'zh-CN' ? '未检测到章节标题 (= ...)' : 'No headings detected'}
          </div>
        ) : (
          compileResult.outline.map((item) => (
            <button
              key={item.id}
              onClick={() => onJumpToPage(item.pageNumber)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center justify-between group ${
                currentPage === item.pageNumber
                  ? 'bg-sky-500/10 text-sky-300 font-medium border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              style={{ paddingLeft: `${Math.max(8, (item.level - 1) * 12 + 8)}px` }}
            >
              <span className="truncate pr-2">{item.title}</span>
              <span className="text-[10px] font-mono opacity-40 group-hover:opacity-100">
                P.{item.pageNumber}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
