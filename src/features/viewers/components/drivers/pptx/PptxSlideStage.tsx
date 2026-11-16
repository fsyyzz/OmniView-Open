import React, { useState, useCallback } from 'react';
import type { PptxSlide, PptxElement, PptxParagraph, PptxTextRun } from '../../../lib/pptxEngine';
import { PptxShapeSvg } from './PptxShapeSvg';
import { PptxChartElement } from './PptxChartElement';

export interface PptxSlideStageProps {
  slide: PptxSlide;
  width: number;
  height: number;
  scale?: number;
  searchQuery?: string;
  compact?: boolean;
  laserActive?: boolean;
  showSlideNumber?: boolean;
  totalSlides?: number;
  stageRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

function toRoman(num: number): string {
  const map: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.max(1, num);
  let res = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      res += sym;
      n -= val;
    }
  }
  return res;
}

function formatAutoNumber(index: number, type?: string): string {
  const t = (type || 'arabicPeriod').toLowerCase();
  if (t.includes('alphalc')) {
    const ch = String.fromCharCode(97 + ((index - 1) % 26));
    return t.includes('parenr') ? `${ch})` : `${ch}.`;
  }
  if (t.includes('alphauc')) {
    const ch = String.fromCharCode(65 + ((index - 1) % 26));
    return t.includes('parenr') ? `${ch})` : `${ch}.`;
  }
  if (t.includes('romanlc')) {
    return `${toRoman(index).toLowerCase()}.`;
  }
  if (t.includes('romanuc')) {
    return `${toRoman(index)}.`;
  }
  if (t.includes('parenr')) {
    return `${index})`;
  }
  return `${index}.`;
}

function renderHighlightedText(text: string, query?: string): React.ReactNode {
  const q = query?.trim();
  if (!q) return text;
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  if (!lowerText.includes(lowerQ)) return text;

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  let keyIdx = 0;
  while (pos < text.length) {
    const matchIdx = lowerText.indexOf(lowerQ, pos);
    if (matchIdx === -1) {
      nodes.push(text.slice(pos));
      break;
    }
    if (matchIdx > pos) {
      nodes.push(text.slice(pos, matchIdx));
    }
    nodes.push(
      <mark key={`m-${keyIdx++}`} className="bg-amber-300/85 text-slate-950 rounded-xs px-0.5">
        {text.slice(matchIdx, matchIdx + q.length)}
      </mark>
    );
    pos = matchIdx + q.length;
  }
  return nodes;
}

function buildElementTransform(el: PptxElement): string | undefined {
  const parts: string[] = [];
  if (el.rotation) parts.push(`rotate(${el.rotation}deg)`);
  if (el.flipH) parts.push('scaleX(-1)');
  if (el.flipV) parts.push('scaleY(-1)');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function renderParagraphContent(
  p: PptxParagraph,
  pIdx: number,
  searchQuery?: string
): React.ReactNode {
  const prefixText =
    p.autoNumIndex !== undefined
      ? `${formatAutoNumber(p.autoNumIndex, p.autoNumType)} `
      : p.bullet
      ? `${p.bulletChar || '•'} `
      : '';

  const textAlign = p.align || 'left';
  const paddingLeft = p.marginLeft && p.marginLeft > 0 ? `${p.marginLeft}px` : undefined;
  const textIndent = p.indent ? `${p.indent}px` : undefined;

  return (
    <p
      key={pIdx}
      style={{
        textAlign,
        paddingLeft,
        textIndent,
        marginTop: p.spaceBefore !== undefined ? `${p.spaceBefore}px` : '2px',
        marginBottom: p.spaceAfter !== undefined ? `${p.spaceAfter}px` : '2px',
        lineHeight: p.lineHeight ?? 1.38,
      }}
      className="break-words"
    >
      {prefixText && (
        <span
          style={{
            color: p.bulletColor || p.runs[0]?.color || '#3B82F6',
            fontSize: p.runs[0]?.fontSize ? `${p.runs[0].fontSize}px` : '15px',
            fontWeight: p.autoNumIndex !== undefined ? 600 : 700,
          }}
          className="mr-1 select-none"
        >
          {prefixText}
        </span>
      )}
      {p.runs.map((r: PptxTextRun, rIdx: number) => {
        if (r.text === '\n') return <br key={rIdx} />;
        const textDecoration =
          r.underline && r.strikethrough
            ? 'underline line-through'
            : r.underline
            ? 'underline'
            : r.strikethrough
            ? 'line-through'
            : 'none';

        const safeHref = r.href && /^(https?:|mailto:)/i.test(r.href) ? r.href : undefined;
        const baseSize = r.fontSize || 15;
        const computedSize = r.baseline ? Math.max(9, Math.round(baseSize * 0.7)) : baseSize;

        const spanStyle: React.CSSProperties = {
          fontWeight: r.bold ? 700 : 400,
          fontStyle: r.italic ? 'italic' : 'normal',
          textDecoration,
          fontSize: `${computedSize}px`,
          color: r.color || (safeHref ? '#2563EB' : '#0F172A'),
          fontFamily: r.fontFamily || 'inherit',
          verticalAlign: r.baseline
            ? r.baseline > 0
              ? 'super'
              : 'sub'
            : undefined,
        };

        const content = renderHighlightedText(r.text, searchQuery);

        if (safeHref) {
          return (
            <a
              key={rIdx}
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              style={spanStyle}
              className="hover:opacity-80 underline"
              onClick={e => e.stopPropagation()}
            >
              {content}
            </a>
          );
        }

        return (
          <span key={rIdx} style={spanStyle}>
            {content}
          </span>
        );
      })}
    </p>
  );
}

export const PptxSlideStage: React.FC<PptxSlideStageProps> = ({
  slide,
  width,
  height,
  scale = 1,
  searchQuery,
  compact = false,
  laserActive = false,
  showSlideNumber = true,
  totalSlides,
  stageRef,
  className = '',
}) => {
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!laserActive || compact) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setLaserPos({
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      });
    },
    [laserActive, compact, width, height]
  );

  const handleMouseLeave = useCallback(() => {
    if (laserPos) setLaserPos(null);
  }, [laserPos]);

  const outerWidth = Math.max(1, Math.round(width * scale * 10) / 10);
  const outerHeight = Math.max(1, Math.round(height * scale * 10) / 10);

  const stageBackgroundStyle: React.CSSProperties = slide.backgroundImage
    ? {
        backgroundImage: `url(${slide.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: slide.backgroundColor || '#ffffff',
      }
    : slide.backgroundGradient
    ? { background: slide.backgroundGradient }
    : { background: slide.backgroundColor || '#ffffff' };

  return (
    <div
      style={{
        width: `${outerWidth}px`,
        height: `${outerHeight}px`,
      }}
      className={`relative shrink-0 overflow-hidden ${className}`}
    >
      <div
        ref={stageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          ...stageBackgroundStyle,
          cursor: laserActive && !compact ? 'none' : undefined,
        }}
        className={`relative overflow-hidden text-slate-900 ${
          compact ? 'pointer-events-none select-none' : 'select-text'
        }`}
      >
        {slide.elements.map(el => {
          const transform = buildElementTransform(el);
          const posStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${el.x}px`,
            top: `${el.y}px`,
            width: `${el.width}px`,
            height: `${el.height}px`,
            transform,
            opacity: el.opacity,
          };

          // 1. 图片图元
          if (el.type === 'image') {
            const crop = el.imageCrop;
            const clipPath =
              crop && (crop.l || crop.t || crop.r || crop.b)
                ? `inset(${crop.t || 0}% ${crop.r || 0}% ${crop.b || 0}% ${crop.l || 0}%)`
                : undefined;

            return (
              <div
                key={el.id}
                style={posStyle}
                className="overflow-hidden flex items-center justify-center pointer-events-none"
              >
                {el.imageDataUrl ? (
                  <img
                    src={el.imageDataUrl}
                    alt={el.imageAlt || '幻灯片图片'}
                    style={{ clipPath }}
                    className={`w-full h-full object-contain ${compact ? 'pointer-events-none' : 'pointer-events-auto'}`}
                    loading="lazy"
                  />
                ) : null}
              </div>
            );
          }

          // 2. 表格图元 (支持跨行/跨列合并与列宽比)
          if (el.type === 'table' && el.tableRows && el.tableRows.length > 0) {
            return (
              <div key={el.id} style={posStyle} className="overflow-hidden">
                <table className="w-full h-full border-collapse table-fixed">
                  {el.colWidthsPct && el.colWidthsPct.length > 0 && (
                    <colgroup>
                      {el.colWidthsPct.map((pct, cIdx) => (
                        <col key={cIdx} style={{ width: `${pct}%` }} />
                      ))}
                    </colgroup>
                  )}
                  <tbody>
                    {el.tableRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          height: el.rowHeightsPt?.[rIdx] ? `${el.rowHeightsPt[rIdx]}px` : undefined,
                        }}
                      >
                        {row.map((cell, cIdx) => {
                          if (cell.mergedSkip) return null;
                          const vAlignClass =
                            cell.vAlign === 'top'
                              ? 'align-top'
                              : cell.vAlign === 'bottom'
                              ? 'align-bottom'
                              : 'align-middle';
                          return (
                            <td
                              key={cIdx}
                              colSpan={cell.colSpan}
                              rowSpan={cell.rowSpan}
                              style={{
                                backgroundColor: cell.background || 'transparent',
                                color: cell.color || '#0F172A',
                                textAlign: cell.align || 'left',
                                fontWeight: cell.bold || cell.isHeader ? 600 : 400,
                                fontSize: cell.fontSize ? `${Math.max(10, cell.fontSize * 0.9)}px` : '12px',
                                borderColor: cell.borderColor || '#CBD5E1',
                              }}
                              className={`p-1.5 border break-words ${vAlignClass}`}
                            >
                              {renderHighlightedText(cell.text, searchQuery)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // 3. 原生内嵌图表
          if (el.type === 'chart' && el.chartData) {
            return (
              <div key={el.id} style={posStyle} className="overflow-hidden">
                <PptxChartElement
                  chartData={el.chartData}
                  width={el.width}
                  height={el.height}
                  compact={compact}
                />
              </div>
            );
          }

          // 4. 纯矢量几何形状与连线
          if (el.type === 'shape') {
            return (
              <div key={el.id} style={posStyle} className="pointer-events-none">
                <PptxShapeSvg element={el} />
              </div>
            );
          }

          // 5. 富文本框与带形状背景的复合文本块
          const hasNonRectShape =
            el.shapeType && el.shapeType !== 'rect' && el.shapeType !== 'custom';
          const justifyClass =
            el.verticalAlign === 'middle'
              ? 'justify-center'
              : el.verticalAlign === 'bottom'
              ? 'justify-end'
              : 'justify-start';
          const boxPadding = el.padding
            ? `${el.padding.top}px ${el.padding.right}px ${el.padding.bottom}px ${el.padding.left}px`
            : el.backgroundColor || el.backgroundGradient || el.borderColor
            ? '6px 10px'
            : '2px 4px';

          return (
            <div
              key={el.id}
              style={{
                ...posStyle,
                height: undefined,
                minHeight: `${el.height}px`,
                background: !hasNonRectShape
                  ? el.backgroundGradient || el.backgroundColor || 'transparent'
                  : undefined,
                borderColor: !hasNonRectShape ? el.borderColor || 'transparent' : undefined,
                borderWidth: !hasNonRectShape && el.borderWidth ? `${el.borderWidth}px` : undefined,
                borderStyle: !hasNonRectShape && el.borderColor ? 'solid' : 'none',
                borderRadius: !hasNonRectShape && el.backgroundColor ? '4px' : undefined,
                boxShadow:
                  !hasNonRectShape && el.hasShadow
                    ? '0 3px 8px rgba(15, 23, 42, 0.14)'
                    : undefined,
                padding: boxPadding,
              }}
              className={`flex flex-col ${justifyClass} overflow-visible`}
            >
              {hasNonRectShape && (
                <div className="absolute inset-0 pointer-events-none z-0">
                  <PptxShapeSvg element={el} />
                </div>
              )}
              <div className="relative z-10 w-full">
                {el.paragraphs?.map((p, pIdx) => renderParagraphContent(p, pIdx, searchQuery))}
              </div>
            </div>
          );
        })}

        {/* 激光笔指示器 */}
        {laserActive && !compact && laserPos && (
          <div
            style={{
              left: `${laserPos.x}px`,
              top: `${laserPos.y}px`,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 12px 4px rgba(239, 68, 68, 0.75)',
            }}
            className="absolute w-3.5 h-3.5 rounded-full bg-red-500 border border-white pointer-events-none z-50"
          />
        )}

        {/* 右下角页码角标 */}
        {showSlideNumber && !compact && (
          <div className="absolute right-4 bottom-3 text-[11px] font-mono text-slate-500/70 select-none pointer-events-none">
            {slide.index + 1} / {totalSlides || 1}
          </div>
        )}
      </div>
    </div>
  );
};
