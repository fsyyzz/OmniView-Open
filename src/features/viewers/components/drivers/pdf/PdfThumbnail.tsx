/**
 * OmniView PDF 单页缩略图子组件
 * 使用独立 Canvas 视口惰性绘制轻量预览缩略图，杜绝全量并发渲染卡死
 */
import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '../../../lib/pdfEngine';

interface PdfThumbnailProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  rotation: number;
  onClick: () => void;
}

export const PdfThumbnail: React.FC<PdfThumbnailProps> = React.memo(
  ({ doc, pageNumber, isActive, rotation, onClick }) => {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    // 前 6 页或当前活动页默认立即渲染，其余页面视口懒渲染
    const [isVisible, setIsVisible] = useState(() => pageNumber <= 6 || isActive);

    // 视口感知器：只有滚动到侧栏可视区域附近 (250px 预加载) 才执行光栅化
    useEffect(() => {
      const el = buttonRef.current;
      if (!el || typeof IntersectionObserver === 'undefined') {
        setIsVisible(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setIsVisible(entry.isIntersecting);
          }
        },
        { rootMargin: '250px 0px 250px 0px' }
      );

      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // 活跃页必须保持可见
    useEffect(() => {
      if (isActive) {
        setIsVisible(true);
      }
    }, [isActive]);

    useEffect(() => {
      if (!isVisible) return;
      const canvas = canvasRef.current;
      if (!canvas || !doc) return;

      // 缩略图采用约 0.19 缩放比率与标准 1.0 DPR，确保内存极低（<70KB/张）且极速生成
      const { cancel } = renderPageToCanvas(doc, pageNumber, canvas, {
        scale: 0.19,
        rotation,
      });

      return () => {
        cancel();
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      };
    }, [doc, pageNumber, rotation, isVisible]);

    return (
      <button
        ref={buttonRef}
        onClick={onClick}
        id={`pdf-thumb-${pageNumber}`}
        className={`p-2 rounded-lg border text-left transition-all w-full flex flex-col items-center gap-1.5 ${
          isActive
            ? 'border-blue-500 bg-blue-950/40 shadow-md ring-1 ring-blue-500/50'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/60'
        }`}
        title={`跳转到第 ${pageNumber} 页`}
      >
        <div className="w-full flex justify-center bg-white/5 rounded p-1 border border-slate-800/80 shadow-inner overflow-hidden min-h-[120px] items-center">
          {isVisible ? (
            <canvas ref={canvasRef} className="shadow-sm rounded max-w-full" />
          ) : (
            <div className="w-16 h-20 bg-slate-900/60 rounded border border-slate-800/60 flex flex-col items-center justify-center text-slate-500 text-[10px] font-mono gap-1 select-none">
              <span className="w-6 h-1 bg-slate-700/50 rounded-full" />
              <span>P.{pageNumber}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between w-full px-1 text-[11px] font-mono">
          <span className={isActive ? 'text-blue-400 font-bold' : 'text-slate-400'}>
            第 {pageNumber} 页
          </span>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
        </div>
      </button>
    );
  },
  (prev, next) =>
    prev.pageNumber === next.pageNumber &&
    prev.isActive === next.isActive &&
    prev.rotation === next.rotation &&
    prev.doc === next.doc
);
