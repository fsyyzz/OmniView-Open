/**
 * OmniView 双栏拖拽分割与持久化 Hook (useSplitPane)
 * 提供可拖拽调整占比、防抖持久化、边界截断与平滑指针样式的标准化分栏逻辑
 */
import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

export interface UseSplitPaneOptions {
  storageKey?: string;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  containerRef: RefObject<HTMLElement | null>;
}

export interface UseSplitPaneReturn {
  splitRatio: number;
  setSplitRatio: React.Dispatch<React.SetStateAction<number>>;
  isDragging: boolean;
  handleSplitterMouseDown: (e: React.MouseEvent) => void;
}

export function useSplitPane({
  storageKey,
  defaultRatio = 50,
  minRatio = 12,
  maxRatio = 88,
  containerRef,
}: UseSplitPaneOptions): UseSplitPaneReturn {
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    if (!storageKey) return defaultRatio;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= minRatio && val <= maxRatio) return val;
      }
    } catch {}
    return defaultRatio;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const latestRatioRef = useRef(splitRatio);
  latestRatioRef.current = splitRatio;

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const offsetX = e.clientX - rect.left;
      const rawPercentage = (offsetX / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercentage, minRatio), maxRatio);

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setSplitRatio(clamped);
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setIsDragging(false);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, latestRatioRef.current.toString());
        } catch {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, containerRef, minRatio, maxRatio, storageKey]);

  return {
    splitRatio,
    setSplitRatio,
    isDragging,
    handleSplitterMouseDown,
  };
}
