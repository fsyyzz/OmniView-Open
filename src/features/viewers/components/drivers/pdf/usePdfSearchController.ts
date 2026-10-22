/**
 * OmniView PDF 全文检索与匹配导航状态控制器 (Hook)
 * 职责：解耦全文检索、匹配结果索引导航、防抖触发与高亮状态
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { searchPdfDocument, type PdfSearchMatch } from '../../../lib/pdfEngine';

export interface UsePdfSearchControllerOptions {
  pdfDoc: PDFDocumentProxy | null;
  onJumpToPage: (pageNumber: number) => void;
}

export function usePdfSearchController({
  pdfDoc,
  onJumpToPage,
}: UsePdfSearchControllerOptions) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<PdfSearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceTimerRef = useRef<number | null>(null);

  // 组件卸载时清理防抖计时器
  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current !== null) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  const performSearch = useCallback(
    async (query: string) => {
      if (!pdfDoc || !query.trim()) {
        setSearchMatches([]);
        setCurrentMatchIndex(0);
        return;
      }

      setIsSearching(true);
      try {
        const matches = await searchPdfDocument(pdfDoc, query);
        setSearchMatches(matches);
        setCurrentMatchIndex(0);
        if (matches.length > 0) {
          onJumpToPage(matches[0].pageNumber);
        }
      } catch (err) {
        console.warn('[OmniView PDF] 搜索异常:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [pdfDoc, onJumpToPage]
  );

  const handleSearchQueryChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchDebounceTimerRef.current !== null) {
        clearTimeout(searchDebounceTimerRef.current);
      }
      if (!q.trim()) {
        performSearch('');
        return;
      }
      searchDebounceTimerRef.current = window.setTimeout(() => {
        performSearch(q);
      }, 280);
    },
    [performSearch]
  );

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    onJumpToPage(searchMatches[nextIdx].pageNumber);
  }, [searchMatches, currentMatchIndex, onJumpToPage]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    onJumpToPage(searchMatches[prevIdx].pageNumber);
  }, [searchMatches, currentMatchIndex, onJumpToPage]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
  }, []);

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    searchMatches,
    currentMatchIndex,
    isSearching,
    handleSearchQueryChange,
    handleNextMatch,
    handlePrevMatch,
    performSearch,
    closeSearch,
  };
}
