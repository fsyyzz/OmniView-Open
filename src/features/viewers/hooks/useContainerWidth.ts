import { useState, useEffect, useRef } from 'react';

/**
 * 监听指定 DOM 容器宽度的响应式 Hook
 * 用于彻底解决 CSS 视口媒体查询 (如 sm:, md:) 仅受整个浏览器窗口影响，
 * 而在分屏 (Split View)、侧边栏预览或窄面板中无法自适应缩小调整的问题。
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(initialWidth = 800) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>(initialWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
          setWidth(rect.width);
        }
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width || entry.target.getBoundingClientRect().width;
          if (w > 0) {
            setWidth(w);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  return [ref, width] as const;
}
