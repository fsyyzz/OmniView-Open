/**
 * OmniView PDF 单页画布与交互文本层组件
 * 封装 Canvas 光栅化、TextLayer 选词复制与划词高亮标注
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Copy, Highlighter, Check } from 'lucide-react';
import { renderPageToCanvas, renderTextLayerToContainer } from '../../../lib/pdfEngine';
import type { PdfAnnotation } from './PdfAnnotationsView';

interface PdfPageCanvasProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  searchQuery?: string;
  annotations?: PdfAnnotation[];
  onAddAnnotation?: (ann: Omit<PdfAnnotation, 'id' | 'createdAt'>) => void;
  onPageLoaded?: (dimensions: { width: number; height: number }) => void;
  lazyRender?: boolean;
  estimatedDimensions?: { width: number; height: number };
}

export const PdfPageCanvas: React.FC<PdfPageCanvasProps> = React.memo(({
  doc,
  pageNumber,
  scale,
  rotation,
  searchQuery,
  annotations = [],
  onAddAnnotation,
  onPageLoaded,
  lazyRender = false,
  estimatedDimensions = { width: 595, height: 842 },
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // 视口懒渲染探测（连续流式模式下优化性能与显存）
  const [isVisible, setIsVisible] = useState(() => !lazyRender || pageNumber <= 2);
  const [isRendering, setIsRendering] = useState(true);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPopupPos, setSelectionPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // 视口观测器：提前 600px 预加载，避免滚动到时白屏
  useEffect(() => {
    if (!lazyRender || isVisible) return;
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px 600px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [lazyRender, isVisible]);

  // 持久化 onPageLoaded 引用，坚决不在 useEffect 依赖数组中添加函数引用以杜绝死循环刷新
  const onPageLoadedRef = useRef(onPageLoaded);
  useEffect(() => {
    onPageLoadedRef.current = onPageLoaded;
  });

  // 1. 渲染主 Canvas 与 TextLayer
  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    if (!isVisible || !canvas || !doc) return;

    setIsRendering(true);

    const { promise: canvasPromise, cancel: cancelCanvas } = renderPageToCanvas(
      doc,
      pageNumber,
      canvas,
      { scale, rotation }
    );

    let cancelTextLayer: (() => void) | null = null;

    canvasPromise
      .then(async () => {
        if (isCancelled) return;
        setIsRendering(false);

        // 回传当前页渲染视口尺寸（仅当组件仍挂载时）
        try {
          const page = await doc.getPage(pageNumber);
          if (isCancelled) return;
          const vp = page.getViewport({ scale: 1.0, rotation });
          onPageLoadedRef.current?.({ width: Math.round(vp.width), height: Math.round(vp.height) });
        } catch {
          // ignore
        }

        if (textLayerDiv && !isCancelled) {
          const textResult = await renderTextLayerToContainer(doc, pageNumber, textLayerDiv, {
            scale,
            rotation,
            searchQuery,
          });
          if (isCancelled) {
            textResult.cancel();
          } else {
            cancelTextLayer = textResult.cancel;
          }
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setIsRendering(false);
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`[OmniView PDF] 第 ${pageNumber} 页 Canvas 渲染异常:`, err);
        }
      });

    return () => {
      isCancelled = true;
      cancelCanvas();
      if (cancelTextLayer) {
        cancelTextLayer();
      }
    };
  }, [doc, pageNumber, scale, rotation, searchQuery, isVisible]);

  // 2. 划词选中文本与高亮操作浮条
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !wrapperRef.current) {
      setSelectionPopupPos(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectionPopupPos(null);
      setSelectedText('');
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();

      // 计算相对 wrapper 的浮动坐标
      const x = Math.max(10, Math.min(wrapperRect.width - 200, rect.left - wrapperRect.left + rect.width / 2 - 90));
      const y = Math.max(10, rect.top - wrapperRect.top - 42);

      setSelectedText(text);
      setSelectionPopupPos({ x, y });
    } catch {
      setSelectionPopupPos(null);
    }
  }, []);

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedText) return;
    navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setSelectionPopupPos(null);
      window.getSelection()?.removeAllRanges();
    }, 800);
  };

  const handleApplyHighlight = (color: 'yellow' | 'green' | 'pink', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedText || !onAddAnnotation) return;
    onAddAnnotation({
      pageNumber,
      text: selectedText,
      color,
    });
    setSelectionPopupPos(null);
    window.getSelection()?.removeAllRanges();
  };

  // 过滤本页相关的批注
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  const estW = Math.round(estimatedDimensions.width * scale);
  const estH = Math.round(estimatedDimensions.height * scale);

  if (!isVisible) {
    return (
      <div
        ref={wrapperRef}
        id={`pdf-page-container-${pageNumber}`}
        style={{ width: `${estW}px`, height: `${estH}px` }}
        className="relative shadow-2xl rounded-sm border border-slate-700/80 bg-white/95 flex flex-col items-center justify-center text-slate-400 select-none"
      >
        <div className="flex flex-col items-center gap-2 animate-pulse text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
          <span className="text-xs font-mono text-slate-500 font-medium">第 {pageNumber} 页加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      onMouseUp={handleMouseUp}
      className="relative shadow-2xl rounded-sm border border-slate-700/80 bg-white overflow-hidden select-text transition-transform"
      id={`pdf-page-container-${pageNumber}`}
    >
      {/* 渲染加载中的半透明轻遮罩 */}
      {isRendering && (
        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[0.5px] z-10 pointer-events-none" />
      )}

      {/* 真实 Canvas 图像光栅层 */}
      <canvas ref={canvasRef} className="block mx-auto" />

      {/* PDF.js 文本选择与匹配高亮 DOM 层 */}
      <div ref={textLayerRef} className="pdf-text-layer" />

      {/* 本页批注标签指示器 */}
      {pageAnnotations.length > 0 && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded-full border border-slate-700 text-[10px] text-slate-300 pointer-events-none">
          <Highlighter className="w-3 h-3 text-amber-400" />
          <span>{pageAnnotations.length} 处高亮批注</span>
        </div>
      )}

      {/* 选中文本后弹出的迷你快捷工具栏 */}
      {selectionPopupPos && (
        <div
          style={{ left: `${selectionPopupPos.x}px`, top: `${selectionPopupPos.y}px` }}
          className="absolute z-30 flex items-center gap-1 p-1 bg-slate-900/95 border border-slate-700 rounded-lg shadow-xl backdrop-blur text-xs select-none ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 颜色高亮按钮 */}
          <button
            onClick={(e) => handleApplyHighlight('yellow', e)}
            className="w-5 h-5 rounded bg-amber-400 hover:scale-110 transition shadow-sm"
            title="黄色高亮"
          />
          <button
            onClick={(e) => handleApplyHighlight('green', e)}
            className="w-5 h-5 rounded bg-emerald-400 hover:scale-110 transition shadow-sm"
            title="绿色高亮"
          />
          <button
            onClick={(e) => handleApplyHighlight('pink', e)}
            className="w-5 h-5 rounded bg-rose-400 hover:scale-110 transition shadow-sm"
            title="粉色高亮"
          />

          <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

          {/* 复制按钮 */}
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded text-[11px] transition"
            title="复制选中文本"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});
