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
  MoreHorizontal,
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(1000);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setToolbarWidth(entry.contentRect.width);
      }
    });
    ro.observe(toolbarRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showOverflowMenu]);

  // 尺寸断点判定
  const showDocMeta = toolbarWidth >= 640;
  const showPaperSize = toolbarWidth >= 880;
  const showEngineSwitcher = toolbarWidth >= 720;
  const showEngineLabels = toolbarWidth >= 880;
  const showModeLabels = toolbarWidth >= 820;
  const showViewModes = toolbarWidth >= 700;
  const showZoom = toolbarWidth >= 560;
  const showExportLabels = toolbarWidth >= 840;
  const showOverflowBtn = toolbarWidth < 740;

  return (
    <div
      ref={toolbarRef}
      style={{
        backgroundColor: 'var(--ov-surface-header)',
        borderBottomColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="flex-shrink-0 flex items-center justify-between px-2.5 sm:px-3.5 py-2 border-b gap-1.5 sm:gap-2 select-none z-20 text-xs min-w-0"
    >
      {/* 左侧：文档大纲开关与元数据 */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
        {studioMode !== 'code' && (
          <button
            onClick={() => setShowOutline((prev) => !prev)}
            title={locale === 'zh-CN' ? '切换目录大纲面板' : 'Toggle Document Outline'}
            style={{
              backgroundColor: showOutline ? 'var(--ov-surface)' : 'transparent',
              borderColor: showOutline ? 'var(--ov-accent, #38bdf8)' : 'var(--ov-border)',
              color: showOutline ? 'var(--ov-accent, #38bdf8)' : 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded-lg border transition hover:text-[var(--ov-text)]"
          >
            <ListTree className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {showDocMeta ? (
            <span
              style={{ color: 'var(--ov-text)' }}
              className={`text-xs font-semibold truncate ${toolbarWidth < 800 ? 'max-w-[100px]' : 'max-w-xs'}`}
            >
              {compileResult.metadata.title || fileName}
            </span>
          ) : (
            <span style={{ color: 'var(--ov-text)' }} className="text-xs font-semibold truncate max-w-[70px]">
              {fileName}
            </span>
          )}

          {showPaperSize && (
            <span
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-accent, #38bdf8)',
              }}
              className="px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase shrink-0"
            >
              TYPST {(compileResult.metadata.paperSize || 'A4').toUpperCase()}
            </span>
          )}

          {/* 引擎切换器：Myriad-Dreamin/typst.ts WASM 官方内核 vs 快速 Native 内核 */}
          {showEngineSwitcher && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="flex items-center border rounded-lg p-0.5 text-[11px] shrink-0"
            >
              <button
                onClick={() => setEngineType('wasm')}
                title={locale === 'zh-CN' ? '使用官方 Myriad-Dreamin/typst.ts WebAssembly 编译内核' : 'Official Myriad-Dreamin/typst.ts WASM Engine'}
                style={{
                  backgroundColor: engineType === 'wasm' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: engineType === 'wasm' ? '#34d399' : 'var(--ov-text-secondary)',
                }}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded transition hover:text-[var(--ov-text)]"
              >
                <Cpu className="w-3 h-3 text-emerald-400" />
                {showEngineLabels && <span>typst.ts</span>}
              </button>
              <button
                onClick={() => setEngineType('native')}
                title={locale === 'zh-CN' ? '使用轻量纯前端快速预览引擎' : 'Lightweight Native Fast Preview Engine'}
                style={{
                  backgroundColor: engineType === 'native' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: engineType === 'native' ? '#38bdf8' : 'var(--ov-text-secondary)',
                }}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded transition hover:text-[var(--ov-text)]"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                {showEngineLabels && <span>{locale === 'zh-CN' ? '极速' : 'Fast'}</span>}
              </button>
            </div>
          )}

          {/* 编译中状态指示器 */}
          {isCompiling && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 animate-pulse bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              {toolbarWidth >= 600 && <span>{locale === 'zh-CN' ? '编译中...' : 'Compiling...'}</span>}
            </div>
          )}
        </div>
      </div>

      {/* 中间：分屏模式切换 / 翻页器 / 排版视图模式 */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* 视口三态切换：分屏 / 仅预览 / 仅源码 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
          }}
          className="flex items-center border rounded-lg p-0.5 text-xs shadow-inner shrink-0"
        >
          <button
            onClick={() => setStudioMode('split')}
            title={locale === 'zh-CN' ? '双向分屏编辑与实时排版' : 'Split Studio'}
            style={{
              backgroundColor: studioMode === 'split' ? 'var(--ov-accent, #38bdf8)' : 'transparent',
              color: studioMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded transition hover:text-[var(--ov-text)]`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            {showModeLabels && <span>{locale === 'zh-CN' ? '分屏' : 'Split'}</span>}
          </button>
          <button
            onClick={() => setStudioMode('preview')}
            title={locale === 'zh-CN' ? '出版级纯净多页排版预览' : 'Preview Only'}
            style={{
              backgroundColor: studioMode === 'preview' ? 'var(--ov-accent, #38bdf8)' : 'transparent',
              color: studioMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded transition hover:text-[var(--ov-text)]`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {showModeLabels && <span>{locale === 'zh-CN' ? '预览' : 'Preview'}</span>}
          </button>
          <button
            onClick={() => setStudioMode('code')}
            title={locale === 'zh-CN' ? '纯净源码沉浸编写' : 'Code Only'}
            style={{
              backgroundColor: studioMode === 'code' ? 'var(--ov-accent, #38bdf8)' : 'transparent',
              color: studioMode === 'code' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded transition hover:text-[var(--ov-text)]`}
          >
            <FileText className="w-3.5 h-3.5" />
            {showModeLabels && <span>{locale === 'zh-CN' ? '源码' : 'Code'}</span>}
          </button>
        </div>

        {/* 翻页与排版模式（非纯代码模式时显示） */}
        {studioMode !== 'code' && (
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevPage}
              disabled={currentPage <= 1}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="p-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed transition hover:text-[var(--ov-text)]"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div
              style={{ color: 'var(--ov-text)' }}
              className="flex items-center gap-0.5 text-xs font-medium font-mono px-0.5"
            >
              <span>{currentPage}</span>
              <span style={{ color: 'var(--ov-text-muted)' }}>/</span>
              <span>{totalPages}</span>
            </div>

            <button
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="p-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed transition hover:text-[var(--ov-text)]"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* 排版模式（连续 / 单页 / 双页） */}
            {showViewModes && (
              <>
                <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-4 w-px mx-0.5" />
                <div
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="flex items-center border rounded-lg p-0.5 text-xs"
                >
                  <button
                    onClick={() => setViewMode('continuous')}
                    title={locale === 'zh-CN' ? '瀑布流连续多页' : 'Continuous Scroll'}
                    style={{
                      backgroundColor: viewMode === 'continuous' ? 'var(--ov-accent, #38bdf8)' : 'transparent',
                      color: viewMode === 'continuous' ? '#ffffff' : 'var(--ov-text-secondary)',
                    }}
                    className="px-2 py-0.5 rounded transition hover:text-[var(--ov-text)]"
                  >
                    {locale === 'zh-CN' ? '连续' : 'Scroll'}
                  </button>
                  <button
                    onClick={() => setViewMode('single')}
                    title={locale === 'zh-CN' ? '单页聚焦模式' : 'Single Page'}
                    style={{
                      backgroundColor: viewMode === 'single' ? 'var(--ov-accent, #38bdf8)' : 'transparent',
                      color: viewMode === 'single' ? '#ffffff' : 'var(--ov-text-secondary)',
                    }}
                    className="px-2 py-0.5 rounded transition hover:text-[var(--ov-text)]"
                  >
                    {locale === 'zh-CN' ? '单页' : 'Single'}
                  </button>
                  <button
                    onClick={() => setViewMode('dual')}
                    title={locale === 'zh-CN' ? '双页跨页排版' : 'Dual Page'}
                    style={{
                      backgroundColor: viewMode === 'dual' ? 'var(--ov-accent, #38bdf8)' : 'transparent',
                      color: viewMode === 'dual' ? '#ffffff' : 'var(--ov-text-secondary)',
                    }}
                    className="px-2 py-0.5 rounded transition hover:text-[var(--ov-text)]"
                  >
                    {locale === 'zh-CN' ? '双页' : 'Dual'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右侧：缩放控制器与导出/打印 */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {studioMode !== 'code' && showZoom && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center border rounded-lg px-1 py-0.5"
          >
            <button
              onClick={onZoomOut}
              style={{ color: 'var(--ov-text-secondary)' }}
              className="p-1 hover:text-[var(--ov-text)] rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetZoom}
              style={{ color: 'var(--ov-text)' }}
              className="px-1.5 text-xs font-mono hover:text-[var(--ov-accent)] transition"
              title="Reset Zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={onZoomIn}
              style={{ color: 'var(--ov-text-secondary)' }}
              className="p-1 hover:text-[var(--ov-text)] rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={onCopySource}
          title={locale === 'zh-CN' ? '复制源码' : 'Copy Source'}
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className="p-1.5 rounded-lg text-xs transition border hover:border-[var(--ov-accent)]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onExportSvg}
          title={locale === 'zh-CN' ? '导出当前页矢量 SVG' : 'Export SVG'}
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className={`flex items-center gap-1 ${showExportLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-lg text-xs transition font-medium border hover:border-emerald-500 hover:text-emerald-400`}
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          {showExportLabels && <span>SVG</span>}
        </button>

        <button
          onClick={onPrint}
          title={locale === 'zh-CN' ? '高精度 A4 出版打印 / 导出 PDF' : 'Print A4 PDF'}
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderColor: 'rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
          }}
          className={`flex items-center gap-1 ${showExportLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-lg text-xs transition font-medium border hover:bg-sky-500/25`}
        >
          <Printer className="w-3.5 h-3.5" />
          {showExportLabels && <span>{locale === 'zh-CN' ? '打印' : 'Print'}</span>}
        </button>

        {/* 折叠更多菜单（小尺寸下的补充入口） */}
        {showOverflowBtn && (
          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setShowOverflowMenu(!showOverflowMenu)}
              style={{
                backgroundColor: showOverflowMenu ? 'var(--ov-surface-header)' : 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="p-1.5 rounded-lg border transition hover:border-[var(--ov-accent)]"
              title={locale === 'zh-CN' ? '更多排版与渲染选项' : 'More Options'}
              aria-label="更多"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showOverflowMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1.5 w-48 border rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 backdrop-blur"
              >
                {!showEngineSwitcher && (
                  <>
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: 'var(--ov-text-secondary)', borderColor: 'var(--ov-border)' }}>
                      {locale === 'zh-CN' ? '编译内核' : 'Engine'}
                    </div>
                    <button
                      onClick={() => {
                        setEngineType('wasm');
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WASM 官方内核</span>
                      </span>
                      {engineType === 'wasm' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    <button
                      onClick={() => {
                        setEngineType('native');
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>快速预览内核</span>
                      </span>
                      {engineType === 'native' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                    <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />
                  </>
                )}

                {!showViewModes && studioMode !== 'code' && (
                  <>
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ov-text-secondary)' }}>
                      {locale === 'zh-CN' ? '排版视图模式' : 'View Mode'}
                    </div>
                    <button
                      onClick={() => {
                        setViewMode('continuous');
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <span>{locale === 'zh-CN' ? '瀑布流连续排版' : 'Continuous'}</span>
                      {viewMode === 'continuous' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('single');
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <span>{locale === 'zh-CN' ? '单页聚焦模式' : 'Single Page'}</span>
                      {viewMode === 'single' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('dual');
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <span>{locale === 'zh-CN' ? '双页跨页排版' : 'Dual Page'}</span>
                      {viewMode === 'dual' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
