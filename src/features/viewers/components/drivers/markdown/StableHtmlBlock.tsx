/**
 * 稳定 HTML 容器：仅在 html 字符串实际变化时写入 innerHTML。
 * 避免父组件无关重渲染时 React 用新的 dangerouslySetInnerHTML 对象引用
 * 覆盖 DOM，导致搜索 <mark> 高亮被冲掉。
 */
import React, { useLayoutEffect, useRef } from 'react';

export interface StableHtmlBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string;
}

export const StableHtmlBlock: React.FC<StableHtmlBlockProps> = ({
  html,
  className,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (lastHtmlRef.current === html) return;
    el.innerHTML = html;
    lastHtmlRef.current = html;
  }, [html]);

  return <div ref={ref} className={className} {...rest} />;
};
