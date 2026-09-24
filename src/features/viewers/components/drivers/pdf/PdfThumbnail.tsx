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
        style={{
          backgroundColor: isActive ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
          borderColor: isActive ? 'var(--ov-accent)' : 'var(--ov-border)',
        }}
        className={`p-2 rounded-lg border text-left transition-all w-full flex flex-col items-center gap-1.5 hover:border-[var(--ov-accent)] ${
          isActive ? 'shadow-md ring-1 ring-[var(--ov-accent)]' : ''
        }`}
        title={`跳转到第 ${pageNumber} 页`}
      >
        <div
          style={{
            backgroundColor: 'var(--ov-bg)',
            borderColor: 'var(--ov-border-subtle)',
          }}
          className="w-full flex justify-center rounded p-1 border shadow-inner overflow-hidden min-h-[120px] items-center"
        >
          {isVisible ? (
            <canvas ref={canvasRef} className="shadow-sm rounded max-w-full" />
          ) : (
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-muted)',
              }}
              className="w-16 h-20 rounded border flex flex-col items-center justify-center text-[10px] font-mono gap-1 select-none"
            >
              <span className="w-6 h-1 rounded-full opacity-40" style={{ backgroundColor: 'var(--ov-text-muted)' }} />
              <span>P.{pageNumber}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between w-full px-1 text-[11px] font-mono">
          <span
            style={{
              color: isActive ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            第 {pageNumber} 页
          </span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ov-accent)' }} />
          )}
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
