/**
 * OmniView PDF 全文检索工具栏组件
 * 支持全局搜索、匹配计数、上一处/下一处快捷跳转
 */
import React, { useRef, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import type { PdfSearchMatch } from '../../../lib/pdfEngine';

interface PdfSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  matches: PdfSearchMatch[];
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClose: () => void;
  isSearching: boolean;
}

export const PdfSearchBar: React.FC<PdfSearchBarProps> = ({
  query,
  onQueryChange,
  matches,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClose,
  isSearching,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    }
  };

  const totalMatches = matches.length;
  const currentMatchDisplay = totalMatches > 0 ? currentMatchIndex + 1 : 0;

  return (
    <div
      id="pdf-search-bar"
      className="absolute top-14 right-6 z-30 flex items-center gap-1.5 p-1.5 rounded-lg shadow-2xl backdrop-blur-md text-xs select-none transition animate-in fade-in slide-in-from-top-2 duration-150"
      style={{
        backgroundColor: 'var(--ov-surface-header)',
        borderColor: 'var(--ov-border)',
        borderWidth: 1,
        borderStyle: 'solid',
        color: 'var(--ov-text)',
        boxShadow: 'var(--ov-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.3))',
      }}
    >
      <div
        className="flex items-center gap-1.5 pl-2 pr-1 rounded border transition"
        style={{
          backgroundColor: 'var(--ov-bg)',
          borderColor: 'var(--ov-border)',
        }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ov-text-muted)' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="全文搜索... (Enter 下一处)"
          className="w-48 sm:w-56 bg-transparent py-1 text-xs focus:outline-none"
          style={{ color: 'var(--ov-text)' }}
        />
        {isSearching ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
        ) : query ? (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 border"
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border-subtle)',
              color: 'var(--ov-text-secondary)',
            }}
          >
            {totalMatches > 0 ? `${currentMatchDisplay}/${totalMatches}` : '0 匹配'}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={onPrevMatch}
          disabled={totalMatches === 0}
          className="p-1 rounded transition hover:bg-[var(--ov-surface-hover)] disabled:opacity-30 disabled:pointer-events-none"
          style={{ color: 'var(--ov-text-secondary)' }}
          title="上一处 (Shift+Enter)"
          id="pdf-search-prev-btn"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={onNextMatch}
          disabled={totalMatches === 0}
          className="p-1 rounded transition hover:bg-[var(--ov-surface-hover)] disabled:opacity-30 disabled:pointer-events-none"
          style={{ color: 'var(--ov-text-secondary)' }}
          title="下一处 (Enter)"
          id="pdf-search-next-btn"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <div className="w-px h-3.5 mx-0.5" style={{ backgroundColor: 'var(--ov-border)' }} />
        <button
          onClick={onClose}
          className="p-1 rounded transition hover:bg-[var(--ov-surface-hover)]"
          style={{ color: 'var(--ov-text-muted)' }}
          title="关闭搜索 (Esc)"
          id="pdf-search-close-btn"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
