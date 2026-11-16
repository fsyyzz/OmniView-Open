import React from 'react';
import { EyeOff, MessageSquare, Search, X } from 'lucide-react';
import type { PptxSlide } from '../../../lib/pptxEngine';
import { PptxSlideStage } from './PptxSlideStage';

export interface PptxGridOverviewProps {
  slides: PptxSlide[];
  slideWidth: number;
  slideHeight: number;
  currentSlideIndex: number;
  matchedSlideIndices?: Set<number>;
  searchQuery?: string;
  locale?: string;
  onSelectSlide: (idx: number) => void;
  onClose: () => void;
}

export const PptxGridOverview: React.FC<PptxGridOverviewProps> = ({
  slides,
  slideWidth,
  slideHeight,
  currentSlideIndex,
  matchedSlideIndices,
  searchQuery,
  locale = 'zh-CN',
  onSelectSlide,
  onClose,
}) => {
  const isEn = locale === 'en-US';
  const thumbW = 240;
  const thumbScale = thumbW / Math.max(1, slideWidth);

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' }}
      role="dialog"
      aria-label={isEn ? 'Slide Sorter Grid' : '幻灯片平铺总览'}
    >
      <div
        className="h-11 px-4 border-b flex items-center justify-between shrink-0"
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
        }}
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold">
            {isEn ? 'Slide Sorter Overview' : '幻灯片平铺总览'}
          </span>
          <span style={{ color: 'var(--ov-text-secondary)' }}>
            {isEn ? `${slides.length} slides` : `共 ${slides.length} 页`}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-md border text-xs flex items-center gap-1 transition hover:opacity-85"
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          title={isEn ? 'Close Grid (Esc)' : '退出平铺总览 (Esc)'}
        >
          <X className="w-3.5 h-3.5" />
          <span>{isEn ? 'Close' : '返回演播'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {slides.map((slide, idx) => {
            const isCurrent = idx === currentSlideIndex;
            const isMatched = matchedSlideIndices?.has(idx);

            return (
              <button
                key={`grid-${idx}`}
                type="button"
                onClick={() => onSelectSlide(idx)}
                className="group text-left rounded-xl border p-2.5 flex flex-col gap-2 transition"
                style={{
                  backgroundColor: isCurrent ? 'var(--ov-accent-subtle)' : 'var(--ov-surface)',
                  borderColor: isCurrent ? 'var(--ov-accent)' : 'var(--ov-border)',
                  boxShadow: isCurrent ? '0 0 0 1px var(--ov-accent)' : undefined,
                }}
              >
                <div
                  className="w-full rounded-lg border overflow-hidden flex items-center justify-center bg-white relative"
                  style={{ borderColor: 'var(--ov-border-subtle)' }}
                >
                  <PptxSlideStage
                    slide={slide}
                    width={slideWidth}
                    height={slideHeight}
                    scale={thumbScale}
                    searchQuery={searchQuery}
                    compact={true}
                    showSlideNumber={false}
                  />
                  {slide.isHidden && (
                    <span
                      className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-slate-900/75 text-white"
                      title={isEn ? 'Hidden Slide' : '已隐藏幻灯片'}
                    >
                      <EyeOff className="w-2.5 h-2.5" />
                      {isEn ? 'Hidden' : '隐藏'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="font-mono font-bold shrink-0"
                      style={{ color: isCurrent ? 'var(--ov-accent)' : 'var(--ov-text-secondary)' }}
                    >
                      #{idx + 1}
                    </span>
                    <span className="truncate font-medium">{slide.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMatched && (
                      <Search
                        className="w-3 h-3 text-amber-500"
                        aria-label={isEn ? 'Search match' : '匹配搜索结果'}
                      />
                    )}
                    {slide.notes && (
                      <MessageSquare
                        className="w-3 h-3 opacity-60"
                        aria-label={isEn ? 'Has speaker notes' : '含演讲者备注'}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
