/**
 * OmniView PDF 单页缩略图子组件
 * 使用独立 Canvas 惰性绘制轻量预览缩略图
 */
import React, { useEffect, useRef } from 'react';
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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !doc) return;

      // 缩略图采用约 0.2 缩放比率，确保内存占用极低且快速生成
      const { cancel } = renderPageToCanvas(doc, pageNumber, canvas, {
        scale: 0.19,
        rotation,
      });

      return () => {
        cancel();
      };
    }, [doc, pageNumber, rotation]);

    return (
      <button
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
          <canvas ref={canvasRef} className="shadow-sm rounded max-w-full" />
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
