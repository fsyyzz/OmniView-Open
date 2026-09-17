/**
 * OmniView 原生专业 PowerPoint (.pptx) 矢量幻灯片只读演播工作台 (PptxViewer)
 * 基于 OOXML 标准与 JSZip 纯前端轻量流水线
 * 支持 16:9 / 4:3 矢量自适应画布、全屏沉浸放映、缩略图大纲列表、键盘切页与演讲者备注
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  LayoutGrid,
  MessageSquare,
  Sparkles,
  Info,
  X,
  Play,
} from 'lucide-react';
import {
  parsePptx,
  base64ToBytes,
  type ParsedPptxPresentation,
  type PptxSlide,
  type PptxElement,
} from '../../lib/pptxEngine';
import type { ThemeId } from '../../../../shared/types';
import { type Locale } from '../../../../shared/lib/i18n';

export interface PptxViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'presentation.pptx',
  fileSize,
  theme,
  isDarkTheme = false,
  locale = 'zh-CN',
}) => {
  const [data, setData] = useState<ParsedPptxPresentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // 载入并解析 PPTX
  const loadPresentation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rawData: ArrayBuffer | Uint8Array | string = content || '';

      if (binaryUrl) {
        if (binaryUrl.startsWith('data:') || /^[A-Za-z0-9+/=]/.test(binaryUrl)) {
          rawData = base64ToBytes(binaryUrl);
        } else {
          try {
            const resp = await fetch(binaryUrl);
            rawData = await resp.arrayBuffer();
          } catch {
            rawData = base64ToBytes(binaryUrl);
          }
        }
      }

      const parsed = await parsePptx(rawData);
      setData(parsed);
      setCurrentSlideIndex(0);
    } catch (err: unknown) {
      console.error('[PptxViewer] 解析失败:', err);
      setError(err instanceof Error ? err.message : 'PPTX 解析异常');
    } finally {
      setLoading(false);
    }
  }, [content, binaryUrl]);

  useEffect(() => {
    loadPresentation();
  }, [loadPresentation]);

  const totalSlides = data?.slides.length || 0;
  const currentSlide: PptxSlide | undefined = data?.slides[currentSlideIndex];

  // 翻页控制
  const goToPrev = useCallback(() => {
    setCurrentSlideIndex(prev => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentSlideIndex(prev => Math.min(totalSlides - 1, prev + 1));
  }, [totalSlides]);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlideIndex(totalSlides - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, totalSlides]);

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden relative select-none font-sans bg-[var(--ov-bg)] text-[var(--ov-text)]"
    >
      {/* 顶部主操作栏 */}
      <header className="h-12 border-b border-[var(--ov-border)] bg-[var(--ov-surface-header)] px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
        {/* 左侧：缩略图开关与文稿标题 */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-1.5 rounded-lg border border-[var(--ov-border)] transition flex items-center gap-1.5 text-xs font-medium ${
              showThumbnails
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
            }`}
            title={showThumbnails ? '隐藏缩略图列表' : '展开缩略图列表'}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">大纲</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Presentation className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs sm:text-sm truncate max-w-[140px] sm:max-w-xs" title={data?.metadata?.title || fileName}>
              {data?.metadata?.title || fileName}
            </span>
          </div>
        </div>

        {/* 中间：翻页导航控制器 */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPrev}
            disabled={currentSlideIndex <= 0}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
            title="上一张 (← / PageUp)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-xs font-mono px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-[var(--ov-border)] flex items-center gap-1">
            <span className="font-bold">{currentSlideIndex + 1}</span>
            <span className="opacity-40">/</span>
            <span className="opacity-70">{totalSlides || 1}</span>
          </div>

          <button
            onClick={goToNext}
            disabled={currentSlideIndex >= totalSlides - 1}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
            title="下一张 (→ / Space / PageDown)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 右侧：放映、备注与全屏 */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-1.5 rounded-md border border-[var(--ov-border)] transition flex items-center gap-1 text-xs ${
              showNotes
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
            }`}
            title="演讲者备注抽屉"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">备注</span>
          </button>

          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition"
            title="文稿出版元数据"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition flex items-center gap-1"
            title={isFullscreen ? '退出全屏放映' : '全屏沉浸放映 (F5)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="text-xs hidden sm:inline">{isFullscreen ? '退出' : '放映'}</span>
          </button>
        </div>
      </header>

      {/* 主视口布局：左侧缩略图 + 中间矢量画布 + 底部备注 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧：幻灯片缩略图抽屉 */}
        {showThumbnails && (
          <aside className="w-48 sm:w-56 h-full border-r border-[var(--ov-border)] bg-[var(--ov-surface-header)] flex flex-col shrink-0 z-20 overflow-y-auto p-2.5 space-y-2.5">
            {data?.slides.map((slide, idx) => (
              <button
                key={`thumb-${idx}`}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`w-full p-1.5 rounded-xl border text-left transition flex flex-col gap-1 group ${
                  idx === currentSlideIndex
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10 shadow-sm'
                    : 'border-[var(--ov-border)] hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                }`}
              >
                {/* 缩略图极简模拟卡片 (16:9) */}
                <div className="w-full aspect-video bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-800 p-2 flex flex-col justify-between overflow-hidden shadow-2xs">
                  <div className="w-full h-1.5 bg-blue-500/40 rounded-full" />
                  <div className="space-y-1">
                    <div className="w-3/4 h-1 bg-slate-400/30 rounded-full" />
                    <div className="w-1/2 h-1 bg-slate-400/20 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span className="font-mono font-bold opacity-60">#{idx + 1}</span>
                  <span className="truncate max-w-[120px] font-medium opacity-90">{slide.title}</span>
                </div>
              </button>
            ))}
          </aside>
        )}

        {/* 中间：16:9 矢量主画布展示区 */}
        <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden relative bg-[var(--ov-bg)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 opacity-70">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              <p className="text-xs">正在解析 PPTX 矢量幻灯片...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-red-500">
              <p className="text-sm font-semibold">加载失败</p>
              <p className="text-xs opacity-80">{error}</p>
              <button
                onClick={loadPresentation}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs"
              >
                重新尝试
              </button>
            </div>
          ) : currentSlide ? (
            <div
              ref={stageRef}
              className="w-full max-w-5xl aspect-video rounded-xl border border-[var(--ov-border)] shadow-2xl relative overflow-hidden bg-white text-slate-900 select-text transition-all duration-200"
              style={{
                background: currentSlide.backgroundColor || '#ffffff',
              }}
            >
              {/* 幻灯片矢量元素列表 */}
              {currentSlide.elements.map(el => (
                <div
                  key={el.id}
                  style={{
                    position: 'absolute',
                    left: `${(el.x / (data?.metadata?.width || 960)) * 100}%`,
                    top: `${(el.y / (data?.metadata?.height || 540)) * 100}%`,
                    width: `${(el.width / (data?.metadata?.width || 960)) * 100}%`,
                    minHeight: `${(el.height / (data?.metadata?.height || 540)) * 100}%`,
                  }}
                  className="flex flex-col justify-start"
                >
                  {el.paragraphs?.map((p, pIdx) => (
                    <p
                      key={pIdx}
                      style={{
                        textAlign: p.align || 'left',
                      }}
                      className="my-0.5 leading-relaxed"
                    >
                      {p.runs.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          style={{
                            fontWeight: r.bold ? 'bold' : 'normal',
                            fontStyle: r.italic ? 'italic' : 'normal',
                            textDecoration: r.underline ? 'underline' : 'none',
                            fontSize: r.fontSize ? `${r.fontSize}px` : '15px',
                            color: r.color || 'inherit',
                          }}
                        >
                          {r.text}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              ))}

              {/* 幻灯片右下角页码标记 */}
              <div className="absolute right-4 bottom-3 text-[11px] font-mono opacity-40">
                {currentSlideIndex + 1} / {totalSlides}
              </div>
            </div>
          ) : null}

          {/* 底部：演讲者备注抽屉 */}
          {showNotes && currentSlide?.notes && (
            <div className="absolute bottom-4 left-6 right-6 max-h-32 bg-[var(--ov-surface)]/95 border border-[var(--ov-border)] rounded-xl p-3 shadow-2xl backdrop-blur-md overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--ov-border)] mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1 text-blue-500">
                  <MessageSquare className="w-3.5 h-3.5" /> 演讲者备注 (Speaker Notes)
                </span>
                <button onClick={() => setShowNotes(false)} className="opacity-60 hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap">{currentSlide.notes}</p>
            </div>
          )}
        </main>

        {/* 右侧：文稿出版元数据抽屉 */}
        {showInfo && (
          <aside className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--ov-surface)] border-l border-[var(--ov-border)] p-4 flex flex-col z-40 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ov-border)] mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider">PPTX 演示文稿信息</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">文稿名称 / Title</span>
                <p className="font-semibold text-sm">{data?.metadata?.title || fileName}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">演讲者 / Creator</span>
                <p>{data?.metadata?.creator || '未记录'}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono opacity-50 block uppercase">画布比例 / Aspect Ratio</span>
                <p className="font-mono">{data?.metadata?.aspectRatio} ({data?.metadata?.width} x {data?.metadata?.height} pt)</p>
              </div>

              <div className="pt-4 border-t border-[var(--ov-border)] space-y-1 font-mono text-[10px] opacity-50">
                <div>幻灯片总页数: {totalSlides} 页</div>
                <div>文件大小: {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : '标准 PPTX'}</div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
