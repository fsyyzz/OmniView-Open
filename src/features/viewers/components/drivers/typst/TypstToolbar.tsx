/**
 * Typst 顶部操作与转换工具栏 (Typst Studio Toolbar)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Columns2,
  BookOpen,
  FileText,
  ListTree,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Printer,
  Copy,
  Check,
  ChevronDown,
  Layers,
  Sparkles,
  Cpu,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { TypstCompileResult } from '../../../lib/typstEngine';

export type TypstStudioMode = 'split' | 'preview' | 'code';
export type TypstViewMode = 'single' | 'dual' | 'continuous';
export type TypstEngineType = 'wasm' | 'native';

interface TypstToolbarProps {
  studioMode: TypstStudioMode;
  setStudioMode: (mode: TypstStudioMode) => void;
  viewMode: TypstViewMode;
  setViewMode: (mode: TypstViewMode) => void;
  engineType: TypstEngineType;
  setEngineType: (engine: TypstEngineType) => void;
  isCompiling: boolean;
  showOutline: boolean;
  setShowOutline: React.Dispatch<React.SetStateAction<boolean>>;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onExportSvg: () => void;
  onPrint: () => void;
  onCopySource: () => void;
  copied: boolean;
  compileResult: TypstCompileResult;
  fileName: string;
  locale?: 'zh-CN' | 'en-US';
}

export const TypstToolbar: React.FC<TypstToolbarProps> = ({
  studioMode,
  setStudioMode,
  viewMode,
  setViewMode,
  engineType,
  setEngineType,
  isCompiling,
  showOutline,
  setShowOutline,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onExportSvg,
  onPrint,
  onCopySource,
  copied,
  compileResult,
  fileName,
  locale = 'zh-CN',
}) => {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 gap-2 select-none z-20 text-xs">
      {/* 左侧：文档大纲开关与元数据 */}
      <div className="flex items-center gap-2.5">
        {studioMode !== 'code' && (
          <button
            onClick={() => setShowOutline((prev) => !prev)}
            title={locale === 'zh-CN' ? '切换目录大纲面板' : 'Toggle Document Outline'}
            className={`p-1.5 rounded-lg border transition ${
              showOutline
                ? 'bg-slate-800 border-slate-700 text-sky-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTree className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 truncate max-w-xs">
            {compileResult.metadata.title || fileName}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-mono uppercase">
            TYPST {(compileResult.metadata.paperSize || 'A4').toUpperCase()}
          </span>

          {/* 引擎切换器：Myriad-Dreamin/typst.ts WASM 官方内核 vs 快速 Native 内核 */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setEngineType('wasm')}
              title={locale === 'zh-CN' ? '使用官方 Myriad-Dreamin/typst.ts WebAssembly 编译内核' : 'Official Myriad-Dreamin/typst.ts WASM Engine'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                engineType === 'wasm'
                  ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span>typst.ts</span>
            </button>
            <button
              onClick={() => setEngineType('native')}
              title={locale === 'zh-CN' ? '使用轻量纯前端快速预览引擎' : 'Lightweight Native Fast Preview Engine'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                engineType === 'native'
                  ? 'bg-slate-800 text-sky-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{locale === 'zh-CN' ? '极速' : 'Fast'}</span>
            </button>
          </div>

          {/* 编译中状态指示器 */}
          {isCompiling && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 animate-pulse bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{locale === 'zh-CN' ? 'WASM 编译中...' : 'Compiling...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 中间：分屏模式切换 / 翻页器 / 排版视图模式 */}
      <div className="flex items-center gap-2">
        {/* 视口三态切换：分屏 / 仅预览 / 仅源码 */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs shadow-inner">
          <button
            onClick={() => setStudioMode('split')}
            title={locale === 'zh-CN' ? '双向分屏编辑与实时排版' : 'Split Studio'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
              studioMode === 'split' ? 'bg-slate-800 text-sky-400 font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{locale === 'zh-CN' ? '分屏' : 'Split'}</span>
          </button>
          <button
            onClick={() => setStudioMode('preview')}
            title={locale === 'zh-CN' ? '出版级纯净多页排版预览' : 'Preview Only'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
              studioMode === 'preview' ? 'bg-slate-800 text-sky-400 font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{locale === 'zh-CN' ? '预览' : 'Preview'}</span>
          </button>
          <button
            onClick={() => setStudioMode('code')}
            title={locale === 'zh-CN' ? '纯净源码沉浸编写' : 'Code Only'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
              studioMode === 'code' ? 'bg-slate-800 text-sky-400 font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{locale === 'zh-CN' ? '源码' : 'Code'}</span>
          </button>
        </div>

        {/* 翻页与排版模式（非纯代码模式时显示） */}
        {studioMode !== 'code' && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-0.5" />

            <button
              onClick={onPrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 text-xs font-medium text-slate-300 font-mono">
              <span>{currentPage}</span>
              <span className="text-slate-600">/</span>
              <span>{totalPages}</span>
            </div>

            <button
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              className="p-1 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-0.5" />

            {/* 排版模式（连续 / 单页 / 双页） */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setViewMode('continuous')}
                title={locale === 'zh-CN' ? '瀑布流连续多页' : 'Continuous Scroll'}
                className={`px-2 py-0.5 rounded transition ${
                  viewMode === 'continuous' ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {locale === 'zh-CN' ? '连续' : 'Scroll'}
              </button>
              <button
                onClick={() => setViewMode('single')}
                title={locale === 'zh-CN' ? '单页聚焦模式' : 'Single Page'}
                className={`px-2 py-0.5 rounded transition ${
                  viewMode === 'single' ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {locale === 'zh-CN' ? '单页' : 'Single'}
              </button>
              <button
                onClick={() => setViewMode('dual')}
                title={locale === 'zh-CN' ? '双页跨页排版' : 'Dual Page'}
                className={`px-2 py-0.5 rounded transition ${
                  viewMode === 'dual' ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {locale === 'zh-CN' ? '双页' : 'Dual'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 右侧：缩放控制器与导出/打印 */}
      <div className="flex items-center gap-1.5">
        {studioMode !== 'code' && (
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1 py-0.5">
            <button
              onClick={onZoomOut}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetZoom}
              className="px-1.5 text-xs font-mono text-slate-300 hover:text-sky-400 transition"
              title="Reset Zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={onZoomIn}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        <button
          onClick={onCopySource}
          title={locale === 'zh-CN' ? '复制源码' : 'Copy Source'}
          className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs transition border border-slate-700"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>

        <button
          onClick={onExportSvg}
          title={locale === 'zh-CN' ? '导出当前页矢量 SVG' : 'Export SVG'}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs transition font-medium border border-slate-700"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>SVG</span>
        </button>

        <button
          onClick={onPrint}
          title={locale === 'zh-CN' ? '高精度 A4 出版打印 / 导出 PDF' : 'Print A4 PDF'}
          className="flex items-center gap-1 px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 rounded-lg text-xs transition font-medium border border-sky-500/30"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{locale === 'zh-CN' ? '打印' : 'Print'}</span>
        </button>
      </div>
    </div>
  );
};
