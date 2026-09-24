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
      <div className="p-4 text-center text-xs flex flex-col items-center gap-2" style={{ color: 'var(--ov-text-muted)' }}>
        <Bookmark className="w-6 h-6 stroke-[1.5] opacity-50" />
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
            style={{
              paddingLeft: `${Math.max(8, depth * 14 + 8)}px`,
              backgroundColor: isActive ? 'var(--ov-surface-hover)' : 'transparent',
              color: isActive ? 'var(--ov-accent)' : 'var(--ov-text)',
              borderLeftWidth: isActive ? '2px' : '0px',
              borderLeftColor: 'var(--ov-accent)',
            }}
            className="py-1.5 pr-2 rounded text-left transition flex items-center justify-between text-xs group hover:bg-[var(--ov-surface-hover)]"
            title={`跳转至第 ${item.pageNumber} 页`}
          >
            <span className="truncate pr-1.5 flex items-center gap-1.5">
              {item.items && item.items.length > 0 ? (
                <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 transition"
                  style={{
                    backgroundColor: isActive ? 'var(--ov-accent)' : 'var(--ov-text-muted)',
                  }}
                />
              )}
              <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>{item.title}</span>
            </span>
            <span
              className="font-mono text-[10px] px-1 rounded shrink-0 transition"
              style={{
                backgroundColor: isActive ? 'var(--ov-surface)' : 'transparent',
                color: isActive ? 'var(--ov-accent)' : 'var(--ov-text-muted)',
              }}
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
