/**
 * OmniView 全屏交互式图表与图片灯箱组件 (LightboxModal)
 * 支持无级平滑缩放、鼠标拖拽平移、90°旋转、复制内容、高分辨率下载与快捷键导航
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCcw,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { Locale, t } from '../../../../shared/lib/i18n';

export interface LightboxItem {
  title: string;
  content?: string;
  url?: string;
  fileName?: string;
}

interface LightboxModalProps {
  item: LightboxItem | null;
  onClose: () => void;
  locale?: Locale;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ item, onClose, locale = 'zh-CN' }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 当打开新项目时重置变换状态
  useEffect(() => {
    if (item) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setCopied(false);
    }
  }, [item]);

  // 快捷键监听
  useEffect(() => {
    if (!item) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(5, Number((z + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        setZoom(z => Math.max(0.2, Number((z - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setRotation(0);
      } else if (e.key.toLowerCase() === 'r') {
        setRotation(r => (r + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  // 滚轮无级缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(z => Math.max(0.2, Math.min(5, Number((z + delta).toFixed(2)))));
  }, []);

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 仅左键拖拽
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 复制内容
  const handleCopy = async () => {
    if (!item) return;
    try {
      if (item.content) {
        await navigator.clipboard.writeText(item.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (item.url) {
        await navigator.clipboard.writeText(item.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  // 下载图片/SVG
  const handleDownload = () => {
    if (!item) return;
    const baseName = item.fileName || (item.title || 'omniview-export').replace(/\s+/g, '-').toLowerCase();

    if (item.content) {
      // SVG / Text Content
      const isSvg = item.content.includes('<svg') || item.content.includes('svg');
      const mime = isSvg ? 'image/svg+xml;charset=utf-8' : 'text/plain;charset=utf-8';
      const ext = isSvg ? '.svg' : '.txt';
      const blob = new Blob([item.content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (item.url) {
      // Image URL
      const a = document.createElement('a');
      a.href = item.url;
      a.download = baseName;
      a.target = '_blank';
      a.click();
    }
  };

  if (!item) return null;

  const transformStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md select-none animate-fadeIn"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm text-xs z-10 shadow-lg">
        {/* Title */}
        <div className="flex items-center gap-2 text-slate-200 font-medium truncate max-w-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <span className="truncate">{item.title}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.2, Number((z - 0.25).toFixed(2))))}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition"
            title={t('zoomOut', locale)}
          >
            <ZoomOut size={14} />
          </button>

          <span className="px-2 font-mono text-[11px] text-cyan-400 min-w-[50px] text-center font-semibold">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoom(z => Math.min(5, Number((z + 0.25).toFixed(2))))}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition"
            title={t('zoomIn', locale)}
          >
            <ZoomIn size={14} />
          </button>

          <div className="w-[1px] h-3.5 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setRotation(0);
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition"
            title={t('resetZoom', locale)}
          >
            <RefreshCcw size={14} />
          </button>

          <button
            type="button"
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition"
            title={t('rotate', locale)}
          >
            <RotateCw size={14} />
          </button>

          <div className="w-[1px] h-3.5 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition flex items-center gap-1"
            title={t('copyImage', locale)}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition flex items-center gap-1"
            title={t('downloadImage', locale)}
          >
            <Download size={14} />
          </button>
        </div>

        {/* Close ESC button */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 transition font-medium border border-slate-700/60"
          title={t('closeFullScreen', locale)}
        >
          <X size={14} />
          <span className="font-mono text-[11px] opacity-70">Esc</span>
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div
        className="flex-1 overflow-hidden relative flex items-center justify-center p-8 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div
          ref={contentRef}
          style={transformStyle}
          className="max-w-[92vw] max-h-[85vh] flex items-center justify-center select-none"
          onDoubleClick={() => {
            setZoom(z => (z === 1 ? 1.8 : 1));
            setPan({ x: 0, y: 0 });
          }}
        >
          {item.url ? (
            <img
              src={item.url}
              alt={item.title}
              draggable={false}
              className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl bg-slate-900/50 p-2 border border-slate-800"
            />
          ) : item.content ? (
            <div
              className="max-w-full max-h-[82vh] flex items-center justify-center p-6 bg-slate-900/70 rounded-xl shadow-2xl border border-slate-800 overflow-visible"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
