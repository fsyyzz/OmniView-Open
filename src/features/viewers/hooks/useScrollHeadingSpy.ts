/**
 * 滚动阅读进度与当前章节监听 Hook
 */
import { useState, useEffect, RefObject } from 'react';
import { MarkdownHeading } from '../lib/markdownAst';

interface ScrollSpyOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  headings: MarkdownHeading[];
  autoScrollSpeed: number;
}

interface ScrollSpyResult {
  readingProgress: number;
  activeHeadingIndex: number;
  jumpToHeading: (headingIndex: number) => void;
  scrollToTop: () => void;
}

export function useScrollHeadingSpy({
  scrollRef,
  headings,
  autoScrollSpeed,
}: ScrollSpyOptions): ScrollSpyResult {
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number>(0);

  // 监听容器滚动，计算进度与当前处于视口顶部的章节
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      const progress = maxScroll > 0 ? Math.min(100, Math.round((scrollTop / maxScroll) * 100)) : 0;
      setReadingProgress(progress);

      const headingElements = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let currentIdx = 0;
      headingElements.forEach((h, idx) => {
        const top = (h as HTMLElement).offsetTop - el.offsetTop;
        if (scrollTop + 120 >= top) {
          currentIdx = idx;
        }
      });
      setActiveHeadingIndex(currentIdx);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef, headings]);

  // 自动平滑滚动
  useEffect(() => {
    if (autoScrollSpeed === 0) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop += autoScrollSpeed;
      }
    }, 40);
    return () => clearInterval(interval);
  }, [scrollRef, autoScrollSpeed]);

  const jumpToHeading = (headingIndex: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const headingsInDocument = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingsInDocument[headingIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeadingIndex(headingIndex);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    readingProgress,
    activeHeadingIndex,
    jumpToHeading,
    scrollToTop,
  };
}
