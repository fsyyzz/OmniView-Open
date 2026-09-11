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
      {compileResult.error && (
        <div className="w-full max-w-3xl mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <div className="flex items-center gap-2 font-semibold text-rose-200 mb-1">
            <span>{locale === 'zh-CN' ? 'Typst 排版编译诊断信息' : 'Typst Compilation Diagnostics'}</span>
          </div>
          <pre className="font-mono whitespace-pre-wrap break-all text-[11px] leading-relaxed bg-slate-950/60 p-2.5 rounded border border-rose-500/20 text-rose-300/90">
            {compileResult.error}
          </pre>
        </div>
      )}

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
            <div key={page.pageNumber} className="flex flex-col items-center w-full">
              <div className="text-[11px] font-mono text-slate-400 mb-1.5 self-start flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>{locale === 'zh-CN' ? `第 ${page.pageNumber} 页` : `Page ${page.pageNumber}`}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-500">{compileResult.pages.length}</span>
              </div>
              <div
                id={`typst-page-${page.pageNumber}`}
                className="bg-white rounded shadow-2xl overflow-hidden border border-slate-300 transition hover:shadow-sky-900/20 w-full min-h-[500px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: page.svgContent }}
              />
            </div>
          ))}
        </div>
      ) : viewMode === 'single' ? (
        /* 单页聚焦模式 */
        <div
          className="w-full max-w-3xl flex flex-col items-center transition-all duration-150 origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {compileResult.pages[currentPage - 1] && (
            <div className="w-full flex flex-col items-center">
              <div className="text-[11px] font-mono text-slate-400 mb-1.5 self-start flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>{locale === 'zh-CN' ? `第 ${currentPage} 页` : `Page ${currentPage}`}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-500">{compileResult.pages.length}</span>
              </div>
              <div
                id={`typst-page-${currentPage}`}
                className="w-full bg-white rounded shadow-2xl overflow-hidden border border-slate-300 min-h-[600px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: compileResult.pages[currentPage - 1].svgContent }}
              />
            </div>
          )}
        </div>
      ) : (
        /* 连续多页纵向瀑布流排版模式 */
        <div
          className="flex flex-col items-center space-y-10 w-full max-w-3xl transition-all duration-150 origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {compileResult.pages.map((page) => (
            <div key={page.pageNumber} className="w-full flex flex-col items-center">
              <div className="text-[11px] font-mono text-slate-400 mb-1.5 self-start flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>{locale === 'zh-CN' ? `第 ${page.pageNumber} 页` : `Page ${page.pageNumber}`}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-500">{compileResult.pages.length}</span>
              </div>
              <div
                id={`typst-page-${page.pageNumber}`}
                className="w-full bg-white rounded shadow-2xl overflow-hidden border border-slate-300 hover:shadow-sky-900/20 transition min-h-[600px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: page.svgContent }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
