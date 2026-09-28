/**
 * 滚动阅读进度与当前章节监听 Hook
 */
import { useState, useEffect, useRef, RefObject } from 'react';
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
  const headingElsRef = useRef<HTMLElement[]>([]);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const indexRef = useRef(0);

  // headings / 内容变化时刷新标题节点缓存
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      headingElsRef.current = [];
      return;
    }
    headingElsRef.current = Array.from(
      el.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    );
  }, [scrollRef, headings]);

  // 监听容器滚动：rAF 合并，进度/索引仅在变化时 setState
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      rafRef.current = null;
      // DOM 晚于 headings 就绪时补刷缓存
      if (headingElsRef.current.length === 0) {
        headingElsRef.current = Array.from(
          el.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
        );
      }

      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      const progress = maxScroll > 0 ? Math.min(100, Math.round((scrollTop / maxScroll) * 100)) : 0;
      if (progress !== progressRef.current) {
        progressRef.current = progress;
        setReadingProgress(progress);
      }

      const headingElements = headingElsRef.current;
      let currentIdx = 0;
      const baseTop = el.offsetTop;
      for (let idx = 0; idx < headingElements.length; idx++) {
        const top = headingElements[idx].offsetTop - baseTop;
        if (scrollTop + 120 >= top) {
          currentIdx = idx;
        } else {
          break;
        }
      }
      if (currentIdx !== indexRef.current) {
        indexRef.current = currentIdx;
        setActiveHeadingIndex(currentIdx);
      }
    };

    const handleScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(measure);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    measure();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
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
    const container = scrollRef.current;
    if (!container) return;

    const allDomHeadings = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
    let target = allDomHeadings[headingIndex];

    const targetHeadingMeta = headings[headingIndex];
    if (targetHeadingMeta?.text) {
      const matchText = targetHeadingMeta.text.trim().toLowerCase();
      const matchedEl = allDomHeadings.find(
        h => h.textContent?.trim().toLowerCase() === matchText
      );
      if (matchedEl) {
        target = matchedEl;
      }
    }

    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top;
    const targetScrollTop = Math.max(0, container.scrollTop + relativeTop - 20);

    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });

    target.classList.add('docx-heading-highlight-flash');
    setTimeout(() => {
      target.classList.remove('docx-heading-highlight-flash');
    }, 1600);

    indexRef.current = headingIndex;
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
