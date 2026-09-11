/**
 * 视口懒挂载容器：离屏时仅占位，进入 rootMargin 后挂载子树并保持挂载。
 * 用于 Markdown 重块（图表 / 代码 / 表格），降低长文首屏 DOM 与引擎开销。
 */
import React, { useEffect, useRef, useState } from 'react';

export interface LazyViewportBlockProps {
  children: React.ReactNode;
  /** 未挂载时的占位高度，减轻滚动跳动 */
  minHeight?: number;
  /** IntersectionObserver rootMargin */
  rootMargin?: string;
  /** 强制立即挂载（搜索 / 打印 / 导出） */
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  title?: string;
  'data-source-line'?: number;
  'data-source-end-line'?: number;
}

export const LazyViewportBlock: React.FC<LazyViewportBlockProps> = React.memo(
  ({
    children,
    minHeight = 140,
    rootMargin = '600px 0px 600px 0px',
    eager = false,
    className,
    style,
    id,
    title,
    'data-source-line': dataSourceLine,
    'data-source-end-line': dataSourceEndLine,
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(eager);

    useEffect(() => {
      if (eager) setMounted(true);
    }, [eager]);

    useEffect(() => {
      if (mounted) return;
      const el = ref.current;
      if (!el) return;
      if (typeof IntersectionObserver === 'undefined') {
        setMounted(true);
        return;
      }

      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setMounted(true);
            observer.disconnect();
          }
        },
        { rootMargin }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [mounted, rootMargin]);

    return (
      <div
        ref={ref}
        id={id}
        className={className}
        title={title}
        data-source-line={dataSourceLine}
        data-source-end-line={dataSourceEndLine}
        data-lazy-mounted={mounted ? '1' : '0'}
        style={{
          ...style,
          ...(!mounted ? { minHeight } : undefined),
        }}
      >
        {mounted ? (
          children
        ) : (
          <div
            className="markdown-lazy-placeholder"
            aria-hidden
            style={{ minHeight }}
          />
        )}
      </div>
    );
  }
);

LazyViewportBlock.displayName = 'LazyViewportBlock';
