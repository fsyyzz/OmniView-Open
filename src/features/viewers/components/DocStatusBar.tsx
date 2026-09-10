/**
 * OmniView 文档底部状态栏
 * 常驻展示字数、章节数、阅读进度、搜索匹配数、缩放比等文档指标
 */
import React from 'react';
import { Locale, t } from '../../../shared/lib/i18n';

interface DocStatusBarProps {
  /** 文档字数 */
  wordCount: number;
  /** 章节数 */
  sectionCount: number;
  /** 阅读进度 0-100 */
  readingProgress: number;
  /** 搜索激活时的当前匹配索引（-1 表示未搜索） */
  activeMatchIndex: number;
  /** 搜索总匹配数 */
  matchCount: number;
  /** 当前搜索文本（非空则显示搜索态） */
  searchText: string;
  /** 页面缩放 */
  zoom: number;
  /** 字号 */
  fontSize: number;
  /** 内容宽度模式 */
  contentWidth: string;
  /** 多语言 */
  locale?: Locale;
}

/** 估算阅读时间（中文 400字/分钟，英文 250词/分钟） */
function estimateReadingTime(wordCount: number, locale?: string): number {
  const wpm = locale === 'en-US' ? 250 : 400;
  return Math.max(1, Math.ceil(wordCount / wpm));
}

export const DocStatusBar: React.FC<DocStatusBarProps> = ({
  wordCount,
  sectionCount,
  readingProgress,
  activeMatchIndex,
  matchCount,
  searchText,
  zoom,
  fontSize,
  contentWidth,
  locale = 'zh-CN',
}) => {
  const isSearchActive = searchText.trim().length > 0;
  const readingMin = estimateReadingTime(wordCount, locale);
  const zoomPct = Math.round(zoom * 100);

  const widthLabel: Record<string, string> = {
    narrow: locale === 'en-US' ? '720px' : '窄版 720px',
    standard: locale === 'en-US' ? '880px' : '标准 880px',
    wide: locale === 'en-US' ? '1180px' : '全景 1180px',
    full: locale === 'en-US' ? 'Full' : '自适应铺满',
  };

  return (
    <div className="doc-status-bar">
      {/* Left: doc stats */}
      <div className="doc-status-left">
        <span className="doc-status-item">
          <span className="doc-status-value">{wordCount.toLocaleString()}</span>
          <span className="doc-status-label">{t('wordsCount', locale)}</span>
        </span>
        <span className="doc-status-sep">·</span>
        <span className="doc-status-item">
          <span className="doc-status-value">{sectionCount}</span>
          <span className="doc-status-label">{t('chapters', locale)}</span>
        </span>
        <span className="doc-status-sep">·</span>
        <span className="doc-status-item">
          <span className="doc-status-value">{readingMin}</span>
          <span className="doc-status-label">{t('minutes', locale)}</span>
        </span>
      </div>

      {/* Center: search match indicator (only when searching) */}
      {isSearchActive && (
        <div className="doc-status-center">
          {matchCount === 0 ? (
            <span className="doc-status-no-match">{t('noMatches', locale)}</span>
          ) : (
            <span className="doc-status-match">
              <span className="doc-status-value">{activeMatchIndex + 1}</span>
              <span className="doc-status-sep">/</span>
              <span className="doc-status-value">{matchCount}</span>
              <span className="doc-status-label">{locale === 'en-US' ? 'matches' : '匹配'}</span>
            </span>
          )}
        </div>
      )}

      {/* Right: zoom / width / progress */}
      <div className="doc-status-right">
        {zoom !== 1 && (
          <>
            <span className="doc-status-item">
              <span className="doc-status-value">{zoomPct}%</span>
              <span className="doc-status-label">{t('zoomLabel', locale)}</span>
            </span>
            <span className="doc-status-sep">·</span>
          </>
        )}
        <span className="doc-status-item">
          <span className="doc-status-value">{fontSize}px</span>
        </span>
        <span className="doc-status-sep">·</span>
        <span className="doc-status-item">
          <span className="doc-status-value">{widthLabel[contentWidth] || contentWidth}</span>
        </span>
        <span className="doc-status-sep">·</span>
        <span className="doc-status-item">
          <span className="doc-status-value">{readingProgress}%</span>
        </span>
      </div>
    </div>
  );
};
