import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { highlightSearchMatches, activateMatch, clearSearchHighlights } from '../lib/domSearchHighlighter';
import { aggregateSearchMatchesByDocumentToc, type DocumentSectionSearchMatch } from '../lib/documentSearchAggregator';
import type { MarkdownHeading } from '../lib/markdownAst';
import type { VsCodeApi } from '../../../shared/lib/vscode';

export interface UseDocumentSearchOptions {
  documentContent: string;
  setDocumentContent: (content: string) => void;
  headings: MarkdownHeading[];
  getSearchCanvas: () => HTMLElement | null;
  toolbarVisible: boolean;
  setOutlineOpen: (open: boolean) => void;
  onContentChange?: (content: string) => void;
  vscode?: VsCodeApi;
  filePath?: string;
}

export function useDocumentSearch({
  documentContent,
  setDocumentContent,
  headings,
  getSearchCanvas,
  toolbarVisible,
  setOutlineOpen,
  onContentChange,
  vscode,
  filePath,
}: UseDocumentSearchOptions) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [searchGroups, setSearchGroups] = useState<Map<string, DocumentSectionSearchMatch[]>>(() => new Map());

  // 搜索关键字高亮与变色联动（仅做高亮标注，绝不打断用户滚动）
  useEffect(() => {
    const canvas = getSearchCanvas();
    if (!searchText.trim()) {
      clearSearchHighlights(canvas);
      setMatchCount(0);
      setActiveMatchIndex(-1);
      setSearchGroups(new Map());
      return;
    }

    const timer = setTimeout(() => {
      const target = getSearchCanvas();
      const count = highlightSearchMatches(target, searchText, { caseSensitive: matchCase });
      setMatchCount(count);
      if (count > 0) {
        setActiveMatchIndex(0);
        activateMatch(target, 0, false); // 仅高亮当前匹配项，不滚动视口
        setOutlineOpen(true); // 搜索命中时自动展开大纲热力导航面板
        const aggRes = aggregateSearchMatchesByDocumentToc(target, headings);
        setSearchGroups(aggRes.groups);
      } else {
        setActiveMatchIndex(-1);
        setSearchGroups(new Map());
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchText, headings, matchCase, getSearchCanvas, setOutlineOpen]);

  // 工具栏显隐等无关重渲染后，若 <mark> 被冲掉则立即补回（不滚动）
  useLayoutEffect(() => {
    if (!searchText.trim()) return;
    const canvas = getSearchCanvas();
    if (!canvas) return;
    if (canvas.querySelectorAll('mark.ov-search-match').length > 0) return;
    const count = highlightSearchMatches(canvas, searchText, { caseSensitive: matchCase });
    setMatchCount(count);
    if (count > 0) {
      setActiveMatchIndex(prev => {
        const next = Math.min(prev < 0 ? 0 : prev, count - 1);
        activateMatch(canvas, next, false);
        return next;
      });
    } else {
      setActiveMatchIndex(-1);
    }
  }, [searchText, toolbarVisible, matchCase, getSearchCanvas]);

  // 渲染完成后立即重新注入搜索高亮，防止正文 HTML 刷新导致 <mark> 节点丢失（不触发视口滚动）
  const handleRenderComplete = useCallback(() => {
    if (!searchText.trim()) return;
    // 双 rAF：等待 React commit + 浏览器布局完成后再注入
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = getSearchCanvas();
        const count = highlightSearchMatches(canvas, searchText, { caseSensitive: matchCase });
        setMatchCount(count);
        setActiveMatchIndex(prev => {
          const next = Math.min(prev < 0 ? 0 : prev, Math.max(count - 1, 0));
          if (count > 0) activateMatch(canvas, next, false);
          return count > 0 ? next : -1;
        });
        if (count > 0) {
          const aggRes = aggregateSearchMatchesByDocumentToc(canvas, headings);
          setSearchGroups(aggRes.groups);
        } else {
          setSearchGroups(new Map());
        }
      });
    });
  }, [searchText, headings, matchCase, getSearchCanvas]);

  // 搜索前进/后退导航（用户主动按键/点击触发，平滑滚动至目标项）
  const handleFindText = useCallback(
    (backwards = false) => {
      if (!searchText.trim()) return;
      const canvas = getSearchCanvas();
      if (!canvas) return;

      let currentCount = matchCount;
      if (currentCount === 0 || canvas.querySelectorAll('mark.ov-search-match').length === 0) {
        currentCount = highlightSearchMatches(canvas, searchText, { caseSensitive: matchCase });
        setMatchCount(currentCount);
      }
      if (currentCount === 0) return;

      setActiveMatchIndex(prev => {
        let nextIndex = backwards ? prev - 1 : prev + 1;
        if (nextIndex < 0) nextIndex = currentCount - 1;
        if (nextIndex >= currentCount) nextIndex = 0;
        activateMatch(canvas, nextIndex, true);
        return nextIndex;
      });
    },
    [searchText, matchCount, matchCase, getSearchCanvas]
  );

  // 点击大纲中的搜索匹配卡片，直接高亮并精准跳转到对应位置
  const handleSelectMatch = useCallback(
    (targetMatchIndex: number) => {
      const canvas = getSearchCanvas();
      if (!canvas) return;
      setActiveMatchIndex(targetMatchIndex);
      activateMatch(canvas, targetMatchIndex, true);
    },
    [getSearchCanvas]
  );

  // Markdown 预览态单处替换
  const handleReplaceSingle = useCallback(() => {
    if (!searchText.trim() || matchCount === 0) return;
    const occurrences: Array<{ start: number; end: number }> = [];
    const target = matchCase ? documentContent : documentContent.toLowerCase();
    const query = matchCase ? searchText : searchText.toLowerCase();
    let pos = 0;
    while (pos < target.length) {
      const idx = target.indexOf(query, pos);
      if (idx === -1) break;
      occurrences.push({ start: idx, end: idx + query.length });
      pos = idx + Math.max(1, query.length);
    }
    if (occurrences.length === 0) return;

    const targetIdx = activeMatchIndex >= 0 && activeMatchIndex < occurrences.length ? activeMatchIndex : 0;
    const match = occurrences[targetIdx];
    const newContent = documentContent.substring(0, match.start) + replaceText + documentContent.substring(match.end);

    setDocumentContent(newContent);
    onContentChange?.(newContent);
    if (vscode) {
      vscode.postMessage({ type: 'document-change', path: filePath, content: newContent });
    }
  }, [
    searchText,
    replaceText,
    matchCase,
    matchCount,
    activeMatchIndex,
    documentContent,
    setDocumentContent,
    onContentChange,
    vscode,
    filePath,
  ]);

  // Markdown 预览态全部替换
  const handleReplaceAll = useCallback(() => {
    if (!searchText.trim() || matchCount === 0) return;
    const occurrences: Array<{ start: number; end: number }> = [];
    const target = matchCase ? documentContent : documentContent.toLowerCase();
    const query = matchCase ? searchText : searchText.toLowerCase();
    let pos = 0;
    while (pos < target.length) {
      const idx = target.indexOf(query, pos);
      if (idx === -1) break;
      occurrences.push({ start: idx, end: idx + query.length });
      pos = idx + Math.max(1, query.length);
    }
    if (occurrences.length === 0) return;

    let newContent = documentContent;
    for (let i = occurrences.length - 1; i >= 0; i--) {
      const m = occurrences[i];
      newContent = newContent.substring(0, m.start) + replaceText + newContent.substring(m.end);
    }

    setDocumentContent(newContent);
    onContentChange?.(newContent);
    if (vscode) {
      vscode.postMessage({ type: 'document-change', path: filePath, content: newContent });
    }
  }, [
    searchText,
    replaceText,
    matchCase,
    matchCount,
    documentContent,
    setDocumentContent,
    onContentChange,
    vscode,
    filePath,
  ]);

  return {
    searchText,
    setSearchText,
    replaceText,
    setReplaceText,
    showReplace,
    setShowReplace,
    matchCase,
    setMatchCase,
    matchCount,
    setMatchCount,
    activeMatchIndex,
    setActiveMatchIndex,
    searchGroups,
    handleFindText,
    handleSelectMatch,
    handleReplaceSingle,
    handleReplaceAll,
    handleRenderComplete,
  };
}
