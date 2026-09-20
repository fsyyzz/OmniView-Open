/**
 * OmniView 全屏交互式图表与图片灯箱组件 (LightboxModal)
 * 支持智能快速铺满、视口自适应、1:1/宽/高快速对齐、无级平滑缩放、鼠标拖拽平移、90°旋转、
 * 复制内容、高分辨率下载、背景对比度切换与快捷键导航 (Portal 渲染至 document.body)
 * 
 * 作者: 周赞
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCcw,
  Copy,
  Check,
  Download,
  Sun,
  Moon,
  Grid,
  Scan,
  Maximize,
  ArrowLeftRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Images,
} from 'lucide-react';
import { Locale, t } from '../../../../shared/lib/i18n';
import { sanitizeDiagramSvg, sanitizeDiagramHtml } from '../../lib/diagramSanitizer';

export interface LightboxItem {
  title: string;
  content?: string;
  url?: string;
  fileName?: string;
}

interface LightboxModalProps {
  item: LightboxItem | null;
  items?: LightboxItem[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  onClose: () => void;
  locale?: Locale;
}

/**
 * 从 SVG 文本中稳健提取根 <svg> 的 viewBox、width、height 或 max-width
 */
function extractSvgDimensions(svgString: string): { width: number; height: number } | null {
  if (!svgString) return null;

  // 1. 严格定位根 <svg ...> 标签（避免错误命中内部 <rect>, <marker>, <path>, <symbol>）
  const svgTagMatch = svgString.match(/<svg\b([^>]*)>/i);
  const attributes = svgTagMatch ? svgTagMatch[1] : svgString;

  // 2. 匹配根 viewBox（兼容负数坐标、浮点数、逗号/空格分隔）
  const viewBoxMatch = attributes.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    const w = parseFloat(viewBoxMatch[3]);
    const h = parseFloat(viewBoxMatch[4]);
    if (w > 0 && h > 0) {
      return { width: Math.round(w), height: Math.round(h) };
    }
  }

  // 3. 匹配根 width / height 属性（忽略 % 等相对单位）
  const widthMatch = attributes.match(/\bwidth=["']\s*([-\d.]+)(px|pt|em|rem)?\s*["']/i);
  const heightMatch = attributes.match(/\bheight=["']\s*([-\d.]+)(px|pt|em|rem)?\s*["']/i);
  if (widthMatch && heightMatch) {
    const w = parseFloat(widthMatch[1]);
    const h = parseFloat(heightMatch[1]);
    if (w > 0 && h > 0) {
      return { width: Math.round(w), height: Math.round(h) };
    }
  }

  // 4. 匹配 style 属性中的 width/max-width
  const styleMatch = attributes.match(/style=["'][^"']*(?:max-)?width:\s*([-\d.]+)px/i);
  if (styleMatch) {
    const w = parseFloat(styleMatch[1]);
    if (w > 0) {
      return { width: Math.round(w), height: Math.round(w * 0.6) };
    }
  }

  return null;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  item,
  items,
  currentIndex = 0,
  onNavigate,
  onClose,
  locale = 'zh-CN',
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [bgMode, setBgMode] = useState<'theme' | 'dark' | 'light' | 'grid'>('theme');
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showThumbnails, setShowThumbnails] = useState(true);

  const hasMultipleItems = Boolean(items && items.length > 1);
  const activeItem = item || (items && items[currentIndex]) || null;
  
  const contentRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const isInitialFitDoneRef = useRef(false);

  const isSvg = useMemo(() => {
    if (!activeItem?.content) return false;
    return activeItem.content.includes('<svg') || activeItem.content.includes('</svg>');
  }, [activeItem?.content]);

  const isGraphviz = useMemo(() => {
    if (!activeItem) return false;
    return (
      activeItem.title?.toLowerCase().includes('graphviz') ||
      activeItem.title?.toLowerCase().includes('dot') ||
      (typeof activeItem.content === 'string' && (activeItem.content.includes('class="graph"') || activeItem.content.includes('id="graph0"')))
    );
  }, [activeItem]);

  const sanitizedContent = useMemo(() => {
    if (!activeItem?.content) return '';
    let content = isSvg
      ? sanitizeDiagramSvg(activeItem.content)
      : sanitizeDiagramHtml(activeItem.content);
    if (isGraphviz && isSvg && content) {
      content = content.replace(/<svg\b([^>]*)>/i, '<svg$1 class="graphviz-svg-dark-inverted">');
    }
    return content;
  }, [activeItem?.content, isSvg, isGraphviz]);

  // 测量当前视口可容纳尺寸
  const getStageDimensions = useCallback(() => {
    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      return {
        width: Math.max(300, rect.width - 64),
        height: Math.max(200, rect.height - 64),
      };
    }
    return {
      width: Math.max(300, window.innerWidth - 64),
      height: Math.max(200, window.innerHeight - 140),
    };
  }, []);

  // 1. 快速适应视口 (Fit to Window): 保证整张图完整置于视口中且视觉占比最佳
  const handleFitToScreen = useCallback((overrideDims?: { width: number; height: number }) => {
    const dims = overrideDims || imgDimensions;
    const stage = getStageDimensions();
    
    if (dims && dims.width > 0 && dims.height > 0) {
      const scaleX = stage.width / (dims.width + 48);
      const scaleY = stage.height / (dims.height + 48);
      const fitScale = Math.min(scaleX, scaleY);
      // 无死锁上限：允许无级自适应，若图表超大则缩放到合适视口，若图表适中则铺满视口
      const optimalZoom = Number(Math.max(0.05, Math.min(15, fitScale)).toFixed(2));
      setZoom(optimalZoom);
    } else {
      setZoom(1);
    }
    setPan({ x: 0, y: 0 });
  }, [imgDimensions, getStageDimensions]);

  // 2. 快速铺满屏幕 (Fill Screen)
  const handleFillScreen = useCallback(() => {
    const dims = imgDimensions;
    const stage = getStageDimensions();

    if (dims && dims.width > 0 && dims.height > 0) {
      const scaleX = stage.width / dims.width;
      const scaleY = stage.height / dims.height;
      const fillScale = Math.max(scaleX, scaleY);
      const optimalZoom = Number(Math.max(0.05, Math.min(20, fillScale)).toFixed(2));
      setZoom(optimalZoom);
    } else {
      setZoom(1.5);
    }
    setPan({ x: 0, y: 0 });
  }, [imgDimensions, getStageDimensions]);

  // 3. 适应宽度 (Fit Width)
  const handleFitWidth = useCallback(() => {
    const dims = imgDimensions;
    const stage = getStageDimensions();
    if (dims && dims.width > 0) {
      const scaleX = stage.width / (dims.width + 48);
      setZoom(Number(Math.max(0.05, Math.min(20, scaleX)).toFixed(2)));
    } else {
      setZoom(1.2);
    }
    setPan({ x: 0, y: 0 });
  }, [imgDimensions, getStageDimensions]);

  // 4. 适应高度 (Fit Height)
  const handleFitHeight = useCallback(() => {
    const dims = imgDimensions;
    const stage = getStageDimensions();
    if (dims && dims.height > 0) {
      const scaleY = stage.height / (dims.height + 48);
      setZoom(Number(Math.max(0.05, Math.min(20, scaleY)).toFixed(2)));
    } else {
      setZoom(1.2);
    }
    setPan({ x: 0, y: 0 });
  }, [imgDimensions, getStageDimensions]);

  // 5. 1:1 原始尺寸 (Actual Size)
  const handleActualSize = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // 6. 响应式比例放大
  const handleZoomIn = useCallback(() => {
    setZoom(z => {
      let next: number;
      if (z < 0.5) next = z + 0.1;
      else if (z < 2) next = z + 0.25;
      else if (z < 5) next = z + 0.5;
      else next = z * 1.25;
      return Math.min(20, Number(next.toFixed(2)));
    });
  }, []);

  // 7. 响应式比例缩小
  const handleZoomOut = useCallback(() => {
    setZoom(z => {
      let next: number;
      if (z <= 0.5) next = z - 0.1;
      else if (z <= 2) next = z - 0.25;
      else if (z <= 5) next = z - 0.5;
      else next = z * 0.8;
      return Math.max(0.05, Number(next.toFixed(2)));
    });
  }, []);

  // 切换上一张 / 下一张
  const handlePrev = useCallback(() => {
    if (!items || items.length <= 1 || !onNavigate) return;
    const prevIdx = (currentIndex - 1 + items.length) % items.length;
    onNavigate(prevIdx);
  }, [items, currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (!items || items.length <= 1 || !onNavigate) return;
    const nextIdx = (currentIndex + 1) % items.length;
    onNavigate(nextIdx);
  }, [items, currentIndex, onNavigate]);

  // 打开新项目时初始化探测尺寸并自动适应屏幕
  useEffect(() => {
    if (!activeItem) {
      setImgDimensions(null);
      isInitialFitDoneRef.current = false;
      return;
    }

    setRotation(0);
    setPan({ x: 0, y: 0 });
    setCopied(false);
    isInitialFitDoneRef.current = false;

    if (activeItem.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        const dims = { width: w, height: h };
        setImgDimensions(dims);
        handleFitToScreen(dims);
        isInitialFitDoneRef.current = true;
      };
      img.onerror = () => {
        setImgDimensions(null);
        setZoom(1);
      };
      img.src = activeItem.url;
    } else if (activeItem.content) {
      const dims = extractSvgDimensions(activeItem.content);
      if (dims) {
        setImgDimensions(dims);
        handleFitToScreen(dims);
        isInitialFitDoneRef.current = true;
      }
    }
  }, [activeItem, handleFitToScreen]);

  // DOM 挂载后精确探测真实渲染尺寸（针对 Mermaid/Graphviz/PlantUML 动态矢量图二次校验）
  useLayoutEffect(() => {
    if (!contentRef.current || !sanitizedContent) return;

    const svgEl = contentRef.current.querySelector('svg');
    if (svgEl) {
      let measuredW = 0;
      let measuredH = 0;

      // 1. 优先读取 baseVal
      if (svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width > 0) {
        measuredW = svgEl.viewBox.baseVal.width;
        measuredH = svgEl.viewBox.baseVal.height;
      }

      // 2. 尝试读取 getBBox
      if ((!measuredW || !measuredH) && typeof svgEl.getBBox === 'function') {
        try {
          const bbox = svgEl.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            measuredW = bbox.width;
            measuredH = bbox.height;
          }
        } catch {
          // ignore
        }
      }

      // 3. 降级读取 getBoundingClientRect
      if (!measuredW || !measuredH) {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          measuredW = rect.width;
          measuredH = rect.height;
        }
      }

      if (measuredW > 0 && measuredH > 0) {
        const naturalDims = { width: Math.round(measuredW), height: Math.round(measuredH) };
        setImgDimensions(naturalDims);
        if (!isInitialFitDoneRef.current) {
          handleFitToScreen(naturalDims);
          isInitialFitDoneRef.current = true;
        }
      }
    }
  }, [sanitizedContent, handleFitToScreen]);

  // 快捷键监听
  useEffect(() => {
    if (!activeItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleActualSize();
      } else if (e.key === 'f' || e.key === 'F') {
        handleFitToScreen();
      } else if (e.key.toLowerCase() === 'r') {
        setRotation(r => (r + 90) % 360);
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, onClose, handleActualSize, handleFitToScreen, handleZoomIn, handleZoomOut, handlePrev, handleNext]);

  // 滚轮无级缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(z => {
      const next = z * factor;
      return Math.max(0.05, Math.min(20, Number(next.toFixed(2))));
    });
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

  // 双击智能切换：适应屏幕 -> 铺满全屏 -> 1:1
  const handleDoubleClick = () => {
    if (zoom < 1.05 && zoom > 0.95) {
      handleFitToScreen();
    } else if (zoom > 1.8) {
      handleActualSize();
    } else {
      handleFillScreen();
    }
  };

  // 复制内容
  const handleCopy = async () => {
    if (!activeItem) return;
    try {
      if (activeItem.content) {
        await navigator.clipboard.writeText(activeItem.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (activeItem.url) {
        await navigator.clipboard.writeText(activeItem.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  // 下载图片/SVG
  const handleDownload = () => {
    if (!activeItem) return;
    const baseName = activeItem.fileName || (activeItem.title || 'omniview-export').replace(/\s+/g, '-').toLowerCase();

    if (activeItem.content) {
      const isSvgContent = activeItem.content.includes('<svg') || activeItem.content.includes('svg');
      const mime = isSvgContent ? 'image/svg+xml;charset=utf-8' : 'text/plain;charset=utf-8';
      const ext = isSvgContent ? '.svg' : '.txt';
      const blob = new Blob([activeItem.content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (activeItem.url) {
      const a = document.createElement('a');
      a.href = activeItem.url;
      a.download = baseName;
      a.target = '_blank';
      a.click();
    }
  };

  if (!activeItem) return null;

  const transformStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/92 backdrop-blur-md select-none animate-fadeIn"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 顶部悬浮控制栏（阻止事件冒泡防拖拽干扰） */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-900/85 backdrop-blur-md text-xs z-20 shadow-xl gap-2 flex-wrap sm:flex-nowrap pointer-events-auto"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题与尺寸标记 */}
        <div className="flex items-center gap-2.5 text-slate-200 font-medium truncate min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0 shadow-sm shadow-cyan-400/50" />
          <span className="truncate text-sm font-semibold">{activeItem.title}</span>
          {hasMultipleItems && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 shrink-0">
              {currentIndex + 1} / {items.length}
            </span>
          )}
          {imgDimensions && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 font-mono text-[11px] text-slate-300">
              <span>{imgDimensions.width} × {imgDimensions.height} px</span>
            </span>
          )}
        </div>

        {/* 核心缩放与铺满功能按键族 */}
        <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-xl shadow-inner">
          {/* 适应窗口 (Fit Screen) */}
          <button
            type="button"
            onClick={() => handleFitToScreen()}
            className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 rounded-lg transition font-medium text-xs active:scale-95"
            title={`${t('fitToScreen', locale)} (F)`}
          >
            <Scan size={14} className="text-cyan-400" />
            <span className="hidden lg:inline">{t('fitToScreen', locale)}</span>
          </button>

          {/* 快速铺满 (Fill Screen) */}
          <button
            type="button"
            onClick={handleFillScreen}
            className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 rounded-lg transition font-medium text-xs active:scale-95"
            title={t('fillScreen', locale)}
          >
            <Maximize size={14} className="text-emerald-400" />
            <span className="hidden lg:inline">{t('fillScreen', locale)}</span>
          </button>

          {/* 适应宽度 */}
          <button
            type="button"
            onClick={handleFitWidth}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition active:scale-95"
            title={t('fitWidth', locale)}
          >
            <ArrowLeftRight size={14} />
          </button>

          {/* 适应高度 */}
          <button
            type="button"
            onClick={handleFitHeight}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition active:scale-95"
            title={t('fitHeight', locale)}
          >
            <ArrowUpDown size={14} />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

          {/* 缩小 */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition active:scale-95"
            title={t('zoomOut', locale)}
          >
            <ZoomOut size={14} />
          </button>

          {/* 缩放数值百分比 (点击可还原 1:1) */}
          <button
            type="button"
            onClick={handleActualSize}
            className="px-2 py-0.5 hover:bg-slate-800/80 rounded font-mono text-[11px] text-cyan-400 min-w-[58px] text-center font-bold transition hover:text-cyan-300 active:scale-95"
            title={`${t('actualSize', locale)} (0)`}
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* 放大 */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition active:scale-95"
            title={t('zoomIn', locale)}
          >
            <ZoomIn size={14} />
          </button>

          {/* 1:1 还原 */}
          <button
            type="button"
            onClick={handleActualSize}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition active:scale-95"
            title={`${t('actualSize', locale)} (0)`}
          >
            <RefreshCcw size={14} />
          </button>

          {/* 旋转 */}
          <button
            type="button"
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition active:scale-95"
            title={`${t('rotate', locale)} (R)`}
          >
            <RotateCw size={14} />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

          {/* 背景对比度切换 */}
          <button
            type="button"
            onClick={() => {
              const modes: Array<'theme' | 'dark' | 'light' | 'grid'> = ['theme', 'dark', 'light', 'grid'];
              const nextIndex = (modes.indexOf(bgMode) + 1) % modes.length;
              setBgMode(modes[nextIndex]);
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition flex items-center gap-1 active:scale-95"
            title={`切换画布背景 (当前: ${bgMode})`}
          >
            {bgMode === 'light' ? (
              <Sun size={14} className="text-amber-400" />
            ) : bgMode === 'dark' ? (
              <Moon size={14} className="text-indigo-400" />
            ) : bgMode === 'grid' ? (
              <Grid size={14} className="text-emerald-400" />
            ) : (
              <Sun size={14} className="text-slate-400" />
            )}
          </button>

          {/* 复制 */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition flex items-center gap-1 active:scale-95"
            title={t('copyImage', locale)}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          {/* 下载 */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition flex items-center gap-1 active:scale-95"
            title={t('downloadImage', locale)}
          >
            <Download size={14} />
          </button>

          {/* 缩略图栏折叠开关 */}
          {hasMultipleItems && (
            <button
              type="button"
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-1.5 rounded-lg transition flex items-center gap-1 active:scale-95 ${
                showThumbnails ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title={t('galleryThumbnails', locale)}
            >
              <Images size={14} />
            </button>
          )}
        </div>

        {/* 关闭 ESC 按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-900/70 hover:text-rose-100 text-slate-300 transition font-medium border border-slate-700/70 shadow-sm active:scale-95"
          title={t('closeFullScreen', locale)}
        >
          <X size={15} />
          <span className="font-mono text-[11px] opacity-80">Esc</span>
        </button>
      </div>

      {/* 主画布视口交互区 */}
      <div
        ref={stageRef}
        className="flex-1 overflow-hidden relative flex items-center justify-center p-4 sm:p-8 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        {/* 多图画廊：上一张浮动导航按钮 */}
        {hasMultipleItems && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-cyan-600/90 text-slate-200 hover:text-white border border-slate-700/80 backdrop-blur-md shadow-2xl transition hover:scale-110 active:scale-95 group"
            title={t('galleryPrevious', locale)}
          >
            <ChevronLeft size={24} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}

        {/* 多图画廊：下一张浮动导航按钮 */}
        {hasMultipleItems && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-cyan-600/90 text-slate-200 hover:text-white border border-slate-700/80 backdrop-blur-md shadow-2xl transition hover:scale-110 active:scale-95 group"
            title={t('galleryNext', locale)}
          >
            <ChevronRight size={24} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        <div
          ref={contentRef}
          style={transformStyle}
          className="flex items-center justify-center select-none will-change-transform"
          onDoubleClick={handleDoubleClick}
        >
          {activeItem.url ? (
            <img
              ref={imageElementRef}
              src={activeItem.url}
              alt={activeItem.title}
              draggable={false}
              style={
                imgDimensions
                  ? { width: `${imgDimensions.width}px`, height: `${imgDimensions.height}px` }
                  : undefined
              }
              className={`rounded-xl shadow-2xl transition-colors max-w-none ${
                bgMode === 'light'
                  ? 'bg-slate-50 border border-slate-300 text-slate-900'
                  : bgMode === 'dark'
                  ? 'bg-slate-950 border border-slate-800 text-slate-100'
                  : bgMode === 'grid'
                  ? 'bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:16px_16px] bg-slate-900 border border-slate-700 text-slate-100'
                  : 'bg-[var(--ov-surface,rgba(15,23,42,0.95))] border border-[var(--ov-border,rgba(51,65,85,0.6))] text-[var(--ov-text,#f1f5f9)]'
              }`}
            />
          ) : sanitizedContent ? (
            <div
              className={`markdown-lightbox-content ov-mermaid-svg-container flex items-center justify-center p-6 rounded-xl shadow-2xl border transition-colors overflow-visible [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-none ${
                bgMode === 'light'
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : bgMode === 'dark'
                  ? 'bg-slate-950 border-slate-800 text-slate-100'
                  : bgMode === 'grid'
                  ? 'bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:16px_16px] bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-[var(--ov-surface,rgba(15,23,42,0.95))] border-[var(--ov-border,rgba(51,65,85,0.6))] text-[var(--ov-text,#f1f5f9)]'
              }`}
              style={
                imgDimensions && imgDimensions.width > 0
                  ? {
                      width: `${imgDimensions.width + 48}px`,
                      minWidth: `${imgDimensions.width + 48}px`,
                      maxWidth: `${imgDimensions.width + 48}px`,
                    }
                  : undefined
              }
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
          ) : null}
        </div>
      </div>

      {/* 多图底部缩略图 Filmstrip */}
      {hasMultipleItems && showThumbnails && (
        <div
          className="px-6 py-2.5 bg-slate-950/80 border-t border-slate-800/80 backdrop-blur-md z-20 flex items-center justify-center gap-2 overflow-x-auto select-none scrollbar-thin"
          onMouseDown={e => e.stopPropagation()}
        >
          {items.map((it, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigate?.(idx)}
                className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all p-0.5 ${
                  isCurrent
                    ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105 shadow-lg'
                    : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                }`}
                title={`${idx + 1}. ${it.title}`}
              >
                {it.url ? (
                  <img src={it.url} alt={it.title} className="w-full h-full object-cover rounded" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-mono">
                    SVG
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute inset-x-0 bottom-0 bg-cyan-500 text-slate-950 text-[9px] font-bold text-center leading-none py-0.5">
                    {idx + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 底部 HUD 状态与快捷键提示 */}
      <div
        className="flex items-center justify-between px-6 py-2 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400 backdrop-blur-sm z-20"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-cyan-400 font-semibold">{Math.round(zoom * 100)}%</span>
          {imgDimensions && (
            <span>{imgDimensions.width} × {imgDimensions.height} px</span>
          )}
          {rotation > 0 && <span>旋转 {rotation}°</span>}
        </div>
        <div className="flex items-center gap-4 text-slate-500 hidden sm:flex">
          {hasMultipleItems && <span>← / → 切换图片</span>}
          <span>双击切换铺满/适应</span>
          <span>滚轮无级缩放</span>
          <span>鼠标拖拽平移</span>
          <span>按 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Esc</kbd> 退出</span>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
