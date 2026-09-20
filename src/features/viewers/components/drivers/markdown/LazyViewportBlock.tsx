/**
 * 视口懒挂载容器：离屏时仅占位，进入 rootMargin 后挂载子树并保持挂载。
 * 内置 BlockHeightCache 记忆已渲染真实物理高度，彻底根除快速滚动时的累积布局偏移 (CLS = 0)
 * 用于 Markdown 重块（图表 / 代码 / 表格），降低长文首屏 DOM 与引擎开销。
 */
import React, { useEffect, useRef, useState } from 'react';

// 全局内存高度缓存池 (按 block id 索引)
const blockHeightCache = new Map<string, number>();

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
    const cachedHeight = id ? blockHeightCache.get(id) : undefined;
    const effectiveMinHeight = cachedHeight && cachedHeight > 20 ? cachedHeight : minHeight;

    const [mounted, setMounted] = useState(eager);

    useEffect(() => {
      if (eager) setMounted(true);
    }, [eager]);

    // 进入视口 Intersection 监听
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

    // 挂载后通过 ResizeObserver 记录实际高度至缓存池
    useEffect(() => {
      if (!mounted || !id) return;
      const el = ref.current;
      if (!el || typeof ResizeObserver === 'undefined') return;

      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const h = Math.round(entry.contentRect.height || el.offsetHeight);
          if (h > 20) {
            blockHeightCache.set(id, h);
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [mounted, id]);

    return (
      <div
        ref={ref}
        id={id}
        className={['lazy-block-wrapper', className].filter(Boolean).join(' ')}
        title={title}
        data-source-line={dataSourceLine}
        data-source-end-line={dataSourceEndLine}
        data-lazy-mounted={mounted ? '1' : '0'}
        style={{
          ...style,
          ...(!mounted ? { minHeight: effectiveMinHeight } : undefined),
        }}
      >
        {mounted ? (
          children
        ) : (
          <div
            className="markdown-lazy-placeholder"
            aria-hidden
            style={{ minHeight: effectiveMinHeight }}
          />
        )}
      </div>
    );
  }
);

LazyViewportBlock.displayName = 'LazyViewportBlock';
