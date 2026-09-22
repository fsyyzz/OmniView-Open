/**
 * OmniView 双栏拖拽分割与持久化 Hook (useSplitPane)
 * 提供可拖拽调整占比、防抖持久化、边界截断与平滑指针样式的标准化分栏逻辑
 */
import { useState, useEffect, useCallback, RefObject } from 'react';

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

  const [isDragging, setIsDragging] = useState(false);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rawPercentage = (offsetX / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercentage, minRatio), maxRatio);
      setSplitRatio(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, containerRef, minRatio, maxRatio]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, splitRatio.toString());
    } catch {}
  }, [storageKey, splitRatio]);

  return {
    splitRatio,
    setSplitRatio,
    isDragging,
    handleSplitterMouseDown,
  };
}
