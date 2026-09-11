/**
 * Typst 多页出版级矢量排版画布容器
 */
import React from 'react';
import { TypstCompileResult } from '../../../lib/typstEngine';
import { TypstViewMode } from './TypstToolbar';

interface TypstCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  compileResult: TypstCompileResult;
  viewMode: TypstViewMode;
  currentPage: number;
  zoom: number;
  locale?: 'zh-CN' | 'en-US';
}

export const TypstCanvas: React.FC<TypstCanvasProps> = ({
  containerRef,
  compileResult,
  viewMode,
  currentPage,
  zoom,
  locale = 'zh-CN',
}) => {
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col items-center bg-slate-950/90 min-h-0 select-text"
    >
      {compileResult.pages.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          {locale === 'zh-CN' ? '文档内容为空或正在排版...' : 'Document is empty...'}
        </div>
      ) : viewMode === 'dual' ? (
        /* 双页并排排版模式 */
        <div
          className="grid grid-cols-2 gap-6 w-full max-w-6xl transition-all duration-150 origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {compileResult.pages.map((page) => (
            <div
              key={page.pageNumber}
              id={`typst-page-${page.pageNumber}`}
              className="bg-white rounded shadow-2xl overflow-hidden border border-slate-300 transition hover:shadow-sky-900/20"
              dangerouslySetInnerHTML={{ __html: page.svgContent }}
            />
          ))}
        </div>
      ) : viewMode === 'single' ? (
        /* 单页聚焦模式 */
        <div
          className="w-full max-w-3xl flex justify-center transition-all duration-150 origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {compileResult.pages[currentPage - 1] && (
            <div
              id={`typst-page-${currentPage}`}
              className="w-full bg-white rounded shadow-2xl overflow-hidden border border-slate-300"
              dangerouslySetInnerHTML={{ __html: compileResult.pages[currentPage - 1].svgContent }}
            />
          )}
        </div>
      ) : (
        /* 连续多页纵向瀑布流排版模式 */
        <div
          className="flex flex-col items-center space-y-8 w-full max-w-3xl transition-all duration-150 origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {compileResult.pages.map((page) => (
            <div
              key={page.pageNumber}
              id={`typst-page-${page.pageNumber}`}
              className="w-full bg-white rounded shadow-2xl overflow-hidden border border-slate-300 hover:shadow-sky-900/20 transition"
              dangerouslySetInnerHTML={{ __html: page.svgContent }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
