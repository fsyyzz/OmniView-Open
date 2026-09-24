import React from 'react';
import { splitTextForHighlight } from '../lib/domSearchHighlighter';

export interface HighlightedTextProps {
  text: string;
  query?: string;
  className?: string;
  matchClassName?: string;
}

/**
 * 结构化文本/表格单元格检索高亮组件
 * 将匹配项安全包裹在 <mark className="ov-search-match"> 中，无 XSS 风险
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  query,
  className,
  matchClassName = 'ov-search-match',
}) => {
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const segments = splitTextForHighlight(text, query);
  if (segments.length === 1 && !segments[0].isMatch) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, idx) =>
        seg.isMatch ? (
          <mark key={idx} className={matchClassName}>
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </span>
  );
};
