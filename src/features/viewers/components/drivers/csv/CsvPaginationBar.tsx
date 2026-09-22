/**
 * CSV 分页与数据量统计底栏组件 (CsvPaginationBar)
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Locale } from '../../../../../shared/lib/i18n';

export interface CsvPaginationBarProps {
  totalRows: number;
  totalColumns: number;
  searchQuery: string;
  matchedRows: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  locale?: Locale;
}

export const CsvPaginationBar: React.FC<CsvPaginationBarProps> = ({
  totalRows,
  totalColumns,
  searchQuery,
  matchedRows,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  locale = 'zh-CN',
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface-header)',
        borderTopColor: 'var(--ov-border)',
        color: 'var(--ov-text-muted)',
      }}
      className="csv-pagination-bar flex flex-wrap items-center justify-between px-4 py-2 border-t text-xs gap-3 shrink-0"
    >
      <div className="flex items-center gap-3">
        <span>
          {locale === 'en-US' ? 'Total' : '数据总量'}:{' '}
          <strong style={{ color: 'var(--ov-text)' }}>{totalRows}</strong>{' '}
          {locale === 'en-US' ? 'rows' : '行'} ×{' '}
          <strong style={{ color: 'var(--ov-text)' }}>{totalColumns}</strong>{' '}
          {locale === 'en-US' ? 'columns' : '列'}
        </span>
        {searchQuery && (
          <>
            <span>·</span>
            <span>
              {locale === 'en-US' ? 'Matched' : '匹配'}:{' '}
              <strong className="text-emerald-500">{matchedRows}</strong> 行
            </span>
          </>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2 text-[11px]">
          <span style={{ color: 'var(--ov-text-muted)' }}>每页:</span>
          {[10, 20, 50, 100].map(sz => (
            <button
              key={sz}
              onClick={() => {
                onPageSizeChange(sz);
                onPageChange(1);
              }}
              style={
                pageSize === sz
                  ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' }
                  : { color: 'var(--ov-text-secondary)' }
              }
              className="px-1.5 py-0.5 rounded transition"
            >
              {sz}
            </button>
          ))}
        </div>

        <button
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className="p-1 border rounded disabled:opacity-40 transition hover:border-[var(--ov-accent)]"
          title="上一页"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span style={{ color: 'var(--ov-text)' }} className="font-mono text-xs px-1">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className="p-1 border rounded disabled:opacity-40 transition hover:border-[var(--ov-accent)]"
          title="下一页"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
