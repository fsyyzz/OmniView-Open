/**
 * OmniView PDF 目录大纲/书签树组件
 * 支持层级折叠、目标页码高亮及即时跳转
 */
import React from 'react';
import { Bookmark, ChevronRight } from 'lucide-react';
import type { PdfOutlineItem } from '../../../lib/pdfEngine';

interface PdfOutlineViewProps {
  outline: PdfOutlineItem[];
  currentPage: number;
  onSelectPage: (pageNum: number) => void;
}

export const PdfOutlineView: React.FC<PdfOutlineViewProps> = ({
  outline,
  currentPage,
  onSelectPage,
}) => {
  if (outline.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
        <Bookmark className="w-6 h-6 text-slate-600 stroke-[1.5]" />
        <span>该文档未提供目录书签信息</span>
      </div>
    );
  }

  const renderItems = (items: PdfOutlineItem[], depth = 0) => {
    return items.map((item, idx) => {
      const isActive = currentPage === item.pageNumber;
      return (
        <div key={`${depth}-${idx}-${item.pageNumber}`} className="flex flex-col">
          <button
            onClick={() => onSelectPage(item.pageNumber)}
            style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
            className={`py-1.5 pr-2 rounded text-left transition flex items-center justify-between text-xs group ${
              isActive
                ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
            }`}
            title={`跳转至第 ${item.pageNumber} 页`}
          >
            <span className="truncate pr-1.5 flex items-center gap-1.5">
              {item.items && item.items.length > 0 ? (
                <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-slate-400 shrink-0" />
              )}
              <span className="truncate">{item.title}</span>
            </span>
            <span
              className={`font-mono text-[10px] px-1 rounded shrink-0 ${
                isActive ? 'bg-blue-900/60 text-blue-300' : 'text-slate-500 group-hover:text-slate-400'
              }`}
            >
              P.{item.pageNumber}
            </span>
          </button>

          {item.items && item.items.length > 0 && (
            <div className="flex flex-col">{renderItems(item.items, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return <div className="flex flex-col gap-0.5 p-1 select-none">{renderItems(outline)}</div>;
};
