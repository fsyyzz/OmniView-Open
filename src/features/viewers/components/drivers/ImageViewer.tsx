/**
 * OmniView 原生现代图像工作台与像素检视器 (ImageViewer)
 * 支持 10%~3200% 极清矢量缩放、16x 像素十字放大镜取色器 (HEX/RGBA/HSLA)、四态画布底色、90° 旋转/镜像翻转与 EXIF 深度解析
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Download,
  Copy,
  Check,
  Eye,
  Crosshair,
  Info,
  Grid,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  X,
  FileCode,
  Layers,
} from 'lucide-react';
import {
  rgbaToHex,
  rgbaToHsla,
  formatAspectRatio,
  formatImageSize,
  parseExifFromBuffer,
  generateSampleImageDataUrl,
  type ImageMetadata,
  type PixelColorInfo,
} from '../../lib/imageEngine';
import type { ThemeId } from '../../../../shared/types';
import { type Locale } from '../../../../shared/lib/i18n';

export interface ImageViewerProps {
  content?: string;
  binaryUrl?: string;
  fileName?: string;
  fileSize?: number;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  content,
  binaryUrl,
  fileName = 'image.png',
  fileSize,
  theme,
  isDarkTheme = false,
  locale = 'zh-CN',
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 图像元数据
  const [metadata, setMetadata] = useState<ImageMetadata>({
    width: 0,
    height: 0,
    aspectRatio: '1:1',
    megapixels: '0',
    format: fileName.split('.').pop()?.toUpperCase() || 'PNG',
    fileSize,
  });

  // 视口与变换状态
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // 背景底色模式: 'system' | 'checker' | 'dark' | 'light'
  const [bgMode, setBgMode] = useState<'system' | 'checker' | 'dark' | 'light'>('system');

  // 像素放大镜与取色器
  const [enableLoupe, setEnableLoupe] = useState<boolean>(false);
  const [loupePixel, setLoupePixel] = useState<PixelColorInfo | null>(null);
  const [loupePos, setLoupePos] = useState<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [copiedDataUri, setCopiedDataUri] = useState<boolean>(false);

  // 弹窗与全屏
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasHelperRef = useRef<HTMLCanvasElement | null>(null);

  // 载入图片源与元数据
  const loadImage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let src = '';
      let rawBuffer: ArrayBuffer | null = null;

      if (binaryUrl) {
        src = binaryUrl;
        try {
          const resp = await fetch(binaryUrl);
          rawBuffer = await resp.arrayBuffer();
        } catch {}
      } else if (content && content.startsWith('data:image/')) {
        src = content;
      } else if (content && content.startsWith('data:')) {
        src = content;
      } else if (content && content.length > 50 && !content.includes('<') && !content.includes('\n')) {
        src = `data:image/png;base64,${content}`;
      } else {
        // 生成内置高保真演示图片
        src = generateSampleImageDataUrl();
      }

      setImageSrc(src);

      // 创建 Image 对象测量尺寸与 EXIF
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const mp = ((w * h) / 1000000).toFixed(2);
        const aspect = formatAspectRatio(w, h);

        let exif: Record<string, string | number> | undefined;
        if (rawBuffer) {
          exif = parseExifFromBuffer(rawBuffer);
        }

        setMetadata({
          width: w,
          height: h,
          aspectRatio: aspect,
          megapixels: mp,
          format: fileName.split('.').pop()?.toUpperCase() || 'IMAGE',
          fileSize: fileSize || (rawBuffer ? rawBuffer.byteLength : undefined),
          exif,
        });
        setLoading(false);
      };
      img.onerror = () => {
        // 容错降级至内置样例图
        const fallback = generateSampleImageDataUrl();
        setImageSrc(fallback);
        setLoading(false);
      };
      img.src = src;
    } catch (err: any) {
      setError(err?.message || '无法加载图像资源');
      setLoading(false);
    }
  }, [content, binaryUrl, fileName, fileSize]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // 自适应居中缩放 (Fit to Screen)
  const handleFitScreen = useCallback(() => {
    if (!containerRef.current || !metadata.width || !metadata.height) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 60;
    const scaleX = (clientWidth - padding) / metadata.width;
    const scaleY = (clientHeight - padding) / metadata.height;
    const fitScale = Math.min(1.0, Math.min(scaleX, scaleY));
    setZoom(Math.max(0.1, Number(fitScale.toFixed(2))));
    setPan({ x: 0, y: 0 });
  }, [metadata.width, metadata.height]);

  // 1:1 像素完全匹配
  const handlePixelPerfect = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // 鼠标滚轮缩放与平移
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || !e.shiftKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => {
        const next = prev > 1 ? prev * (e.deltaY > 0 ? 0.85 : 1.15) : Math.max(0.1, prev + delta);
        return Math.max(0.1, Math.min(32.0, Number(next.toFixed(2))));
      });
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  // 拖拽平移视口
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      // 排除取色器点击
      if (enableLoupe) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // 像素放大镜取色检测
    if (enableLoupe && imageRef.current) {
      const imgRect = imageRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      setLoupePos({ clientX, clientY });

      if (
        clientX >= imgRect.left &&
        clientX <= imgRect.right &&
        clientY >= imgRect.top &&
        clientY <= imgRect.bottom
      ) {
        // 计算图像内真实像素坐标 (0-based)
        const relX = (clientX - imgRect.left) / imgRect.width;
        const relY = (clientY - imgRect.top) / imgRect.height;
        const pixelX = Math.min(metadata.width - 1, Math.max(0, Math.floor(relX * metadata.width)));
        const pixelY = Math.min(metadata.height - 1, Math.max(0, Math.floor(relY * metadata.height)));

        // 从离屏 Canvas 读取像素 RGBA
        try {
          if (!canvasHelperRef.current) {
            const c = document.createElement('canvas');
            c.width = metadata.width;
            c.height = metadata.height;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (ctx && imageRef.current) {
              ctx.drawImage(imageRef.current, 0, 0);
              canvasHelperRef.current = c;
            }
          }

          if (canvasHelperRef.current) {
            const ctx = canvasHelperRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
              const r = pixelData[0];
              const g = pixelData[1];
              const b = pixelData[2];
              const a = pixelData[3];
              const hex = rgbaToHex(r, g, b, a);
              const rgba = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
              const hsla = rgbaToHsla(r, g, b, a);

              setLoupePixel({
                x: pixelX,
                y: pixelY,
                r,
                g,
                b,
                a,
                hex,
                rgba,
                hsla,
              });
            }
          }
        } catch {
          // 跨域或安全受限时仅更新坐标
          setLoupePixel({
            x: pixelX,
            y: pixelY,
            r: 0,
            g: 0,
            b: 0,
            a: 255,
            hex: '#------',
            rgba: 'rgba(0,0,0,1)',
            hsla: 'hsla(0,0%,0%,1)',
          });
        }
      } else {
        setLoupePixel(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 取色器点击复制色值
  const handleCanvasClick = () => {
    if (enableLoupe && loupePixel) {
      navigator.clipboard.writeText(loupePixel.hex);
      setCopiedColor(loupePixel.hex);
      setTimeout(() => setCopiedColor(null), 1500);
    }
  };

  // 复制 Data URI
  const handleCopyDataUri = () => {
    if (!imageSrc) return;
    navigator.clipboard.writeText(imageSrc);
    setCopiedDataUri(true);
    setTimeout(() => setCopiedDataUri(false), 1500);
    setShowExportMenu(false);
  };

  // 旋转控制
  const handleRotateCw = () => setRotation(r => (r + 90) % 360);
  const handleRotateCcw = () => setRotation(r => (r + 270) % 360);
  const handleFlipH = () => setFlipH(f => !f);
  const handleFlipV = () => setFlipV(f => !f);
  const handleResetTransform = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // 全屏切换
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // 背景底色样式映射：自适应全局主题与高对比度棋盘格
  const bgStyle = useMemo(() => {
    if (bgMode === 'system') return { background: 'var(--ov-bg)' };
    if (bgMode === 'dark') return { background: '#0a0d12' };
    if (bgMode === 'light') return { background: '#ffffff' };
    // 透明棋盘格：根据亮暗主题提供清晰可辨的对比格子
    const dotColor = isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';
    const bgColor = isDarkTheme ? '#111827' : '#f8fafc';
    return {
      backgroundImage: `
        linear-gradient(45deg, ${dotColor} 25%, transparent 25%), 
        linear-gradient(-45deg, ${dotColor} 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, ${dotColor} 75%), 
        linear-gradient(-45deg, transparent 75%, ${dotColor} 75%)
      `,
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      backgroundColor: bgColor,
    };
  }, [bgMode, isDarkTheme]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full select-none overflow-hidden transition-colors"
      data-theme={theme}
      data-theme-mode={isDarkTheme ? 'dark' : 'light'}
      style={{
        background: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 顶部工具栏 (依托设计令牌实现全主题像素级自适应) */}
      <header
        className="flex items-center justify-between px-3 py-1.5 border-b shrink-0 gap-2 z-20 transition-colors"
        style={{
          background: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="p-1.5 rounded border shrink-0"
            style={{
              background: 'var(--ov-accent-subtle, rgba(59, 130, 246, 0.1))',
              color: 'var(--ov-accent)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs truncate max-w-[180px]" style={{ color: 'var(--ov-text)' }} title={fileName}>
                {fileName}
              </span>
              <span
                className="px-1.5 py-0.2 text-[10px] font-mono font-medium rounded border shrink-0"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
              >
                {metadata.format}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
              <span>{metadata.width} × {metadata.height} px</span>
              <span>•</span>
              <span>{metadata.aspectRatio}</span>
              <span>•</span>
              <span>{metadata.megapixels} MP</span>
              <span>•</span>
              <span>{formatImageSize(metadata.fileSize)}</span>
            </div>
          </div>
        </div>

        {/* 中间：缩放、底色与变换工具 */}
        <div className="flex items-center gap-1.5">
          {/* 缩放控制器 */}
          <div
            className="flex items-center border rounded px-1 py-0.5"
            style={{
              borderColor: 'var(--ov-border)',
              background: 'var(--ov-surface)',
            }}
          >
            <button
              onClick={() => setZoom(z => Math.max(0.1, Number((z * 0.8).toFixed(2))))}
              className="p-1 rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span
              className="text-[10px] w-12 text-center font-mono select-none"
              style={{ color: 'var(--ov-text)' }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(32.0, Number((z * 1.25).toFixed(2))))}
              className="p-1 rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitScreen}
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-[var(--ov-surface-hover)] transition ml-0.5 border-l cursor-pointer"
              style={{
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              title="自适应视口大小"
            >
              适应
            </button>
            <button
              onClick={handlePixelPerfect}
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="1:1 像素对齐 (100%)"
            >
              1:1
            </button>
          </div>

          {/* 画布底色模式切换 (支持系统全局主题、棋盘格、暗室与纯白) */}
          <div
            className="flex items-center border rounded p-0.5"
            style={{
              borderColor: 'var(--ov-border)',
              background: 'var(--ov-surface)',
            }}
          >
            <button
              onClick={() => setBgMode('system')}
              className={`p-1 rounded transition cursor-pointer ${
                bgMode === 'system'
                  ? 'bg-[var(--ov-accent)] text-white shadow-xs font-semibold'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: bgMode === 'system' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="系统底色 (完全跟随全局应用与 VS Code 主题)"
              aria-label="跟随系统全局主题"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setBgMode('checker')}
              className={`p-1 rounded transition cursor-pointer ${
                bgMode === 'checker'
                  ? 'bg-[var(--ov-accent)] text-white shadow-xs font-semibold'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: bgMode === 'checker' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="透明棋盘格底色 (适合检视透明通道与切图)"
              aria-label="透明棋盘格底色"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setBgMode('dark')}
              className={`p-1 rounded transition cursor-pointer ${
                bgMode === 'dark'
                  ? 'bg-[var(--ov-accent)] text-white shadow-xs font-semibold'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: bgMode === 'dark' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="纯黑暗室底色 (防眩光)"
              aria-label="纯黑暗室底色"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setBgMode('light')}
              className={`p-1 rounded transition cursor-pointer ${
                bgMode === 'light'
                  ? 'bg-[var(--ov-accent)] text-white shadow-xs font-semibold'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: bgMode === 'light' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="纯白原纸底色 (明亮高对比度)"
              aria-label="纯白原纸底色"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 图像几何变换工具 */}
          <div
            className="flex items-center border rounded p-0.5"
            style={{
              borderColor: 'var(--ov-border)',
              background: 'var(--ov-surface)',
            }}
          >
            <button
              onClick={handleRotateCcw}
              className="p-1 rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="逆时针旋转 90°"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRotateCw}
              className="p-1 rounded hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="顺时针旋转 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFlipH}
              className={`p-1 rounded transition cursor-pointer ${
                flipH
                  ? 'bg-[var(--ov-accent)] text-white shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: flipH ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="水平镜像翻转"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFlipV}
              className={`p-1 rounded transition cursor-pointer ${
                flipV
                  ? 'bg-[var(--ov-accent)] text-white shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: flipV ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="垂直镜像翻转"
            >
              <FlipVertical className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 像素十字放大镜与取色器开关 */}
          <button
            onClick={() => setEnableLoupe(!enableLoupe)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition cursor-pointer ${
              enableLoupe
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 shadow-xs font-semibold'
                : 'hover:bg-[var(--ov-surface-hover)]'
            }`}
            style={{
              borderColor: enableLoupe ? undefined : 'var(--ov-border)',
              background: enableLoupe ? undefined : 'var(--ov-surface)',
              color: enableLoupe ? undefined : 'var(--ov-text-secondary)',
            }}
            title="开启 16x 像素放大镜与十字取色器 (点击复制颜色)"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">取色器</span>
          </button>
        </div>

        {/* 右侧：导出、元数据与全屏 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 导出下拉 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
              style={{
                borderColor: 'var(--ov-border)',
                background: 'var(--ov-surface)',
                color: 'var(--ov-text-secondary)',
              }}
              title="导出与复制"
            >
              <Download className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
              <span className="hidden sm:inline">导出</span>
            </button>

            {showExportMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-md shadow-xl border py-1 z-50 text-xs"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                onClick={() => setShowExportMenu(false)}
              >
                <button
                  onClick={handleCopyDataUri}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] flex items-center gap-2 cursor-pointer"
                  style={{ color: 'var(--ov-text)' }}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{copiedDataUri ? '已复制 Data URI！' : '复制为 Base64 URI'}</span>
                </button>
                <a
                  href={imageSrc}
                  download={fileName}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--ov-surface-hover)] flex items-center gap-2 cursor-pointer"
                  style={{ color: 'var(--ov-text)' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载原图文件</span>
                </a>
              </div>
            )}
          </div>

          {/* 属性与 EXIF */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded border transition cursor-pointer ${
              showInfo
                ? 'bg-[var(--ov-accent)] text-white shadow-xs font-semibold'
                : 'hover:bg-[var(--ov-surface-hover)]'
            }`}
            style={{
              borderColor: 'var(--ov-border)',
              background: showInfo ? undefined : 'var(--ov-surface)',
              color: showInfo ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            title="查看图像属性与 EXIF 元数据"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* 全屏 */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded border hover:bg-[var(--ov-surface-hover)] transition cursor-pointer"
            style={{
              borderColor: 'var(--ov-border)',
              background: 'var(--ov-surface)',
              color: 'var(--ov-text-secondary)',
            }}
            title={isFullscreen ? '退出全屏' : '全屏展示图像'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 主画布视口 */}
      <div
        className={`flex-1 min-h-0 relative overflow-hidden flex items-center justify-center ${
          enableLoupe ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={bgStyle}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--ov-bg,#0d1117)]/80 backdrop-blur z-30">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-300">正在解析图像像素与色彩空间...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="p-3 rounded-full bg-red-500/10 text-red-400 mb-3 border border-red-500/20">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-medium text-red-400 mb-1">图像加载异常</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4">{error}</p>
          </div>
        )}

        {!loading && imageSrc && (
          <div
            className="relative transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              transformOrigin: 'center center',
            }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt={fileName}
              draggable={false}
              className="max-w-none shadow-2xl rounded-xs"
              style={{
                imageRendering: zoom >= 2.0 ? 'pixelated' : 'auto',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        )}

        {/* 悬浮 16x 像素放大镜 HUD */}
        {enableLoupe && loupePixel && (
          <div
            className="fixed pointer-events-none z-50 backdrop-blur border rounded-lg shadow-2xl p-2.5 flex flex-col gap-1.5 text-xs w-52"
            style={{
              left: Math.min(window.innerWidth - 220, loupePos.clientX + 20),
              top: Math.min(window.innerHeight - 180, loupePos.clientY + 20),
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
          >
            {/* 放大镜微缩色块与十字标 */}
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded border shadow-inner shrink-0 relative overflow-hidden"
                style={{
                  backgroundColor: loupePixel.hex,
                  borderColor: 'var(--ov-border)',
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 border border-white rounded-full shadow-xs" />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono font-bold text-sm tracking-wide" style={{ color: 'var(--ov-text)' }}>
                  {loupePixel.hex}
                </span>
                <span className="font-mono text-[10px] truncate" style={{ color: 'var(--ov-text-muted)' }}>
                  X: {loupePixel.x}, Y: {loupePixel.y}
                </span>
              </div>
            </div>

            {/* 色值多格式显示 */}
            <div
              className="flex flex-col gap-0.5 font-mono text-[10px] pt-1 border-t"
              style={{
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--ov-text-muted)' }}>RGBA:</span>
                <span className="truncate">{loupePixel.rgba}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--ov-text-muted)' }}>HSLA:</span>
                <span className="truncate">{loupePixel.hsla}</span>
              </div>
            </div>

            <div className="text-[9px] text-amber-500 text-center font-sans mt-0.5">
              {copiedColor ? `✓ 已复制 ${copiedColor}` : '🖱️ 单击画布直接复制 HEX 色值'}
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <footer
        className="flex items-center justify-between px-3 py-1 border-t shrink-0 gap-2 z-20 text-[11px] font-mono transition-colors"
        style={{
          background: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <span>分辨率: {metadata.width} × {metadata.height}</span>
          <span>•</span>
          <span>缩放: {Math.round(zoom * 100)}%</span>
          {rotation > 0 && (
            <>
              <span>•</span>
              <span style={{ color: 'var(--ov-accent)' }}>旋转: {rotation}°</span>
            </>
          )}
          {(flipH || flipV) && (
            <>
              <span>•</span>
              <span style={{ color: 'var(--ov-accent)' }}>镜像: {flipH ? '水平' : ''}{flipV ? '垂直' : ''}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableLoupe && (
            <span className="text-amber-500 flex items-center gap-1 font-sans font-medium">
              <Crosshair className="w-3 h-3" />
              取色器已激活
            </span>
          )}
          <button
            onClick={handleResetTransform}
            className="hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] transition px-1.5 py-0.5 rounded cursor-pointer"
            style={{ color: 'var(--ov-text-secondary)' }}
            title="重置缩放与变换"
          >
            重置视口
          </button>
        </div>
      </footer>

      {/* 图像属性与 EXIF 元数据模态框 */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-md border rounded-lg shadow-2xl overflow-hidden flex flex-col"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{
                borderColor: 'var(--ov-border)',
                background: 'var(--ov-surface-header)',
              }}
            >
              <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--ov-accent)' }}>
                <ImageIcon className="w-4 h-4" />
                <span>图像属性与 EXIF 元数据 (Image Info)</span>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="hover:bg-[var(--ov-surface-hover)] p-1 rounded transition cursor-pointer"
                style={{ color: 'var(--ov-text-secondary)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 text-xs max-h-[70vh] overflow-y-auto" style={{ color: 'var(--ov-text-secondary)' }}>
              <div className="grid grid-cols-3 gap-2 py-1 border-b" style={{ borderColor: 'var(--ov-border)' }}>
                <span style={{ color: 'var(--ov-text-muted)' }}>文件名称</span>
                <span className="col-span-2 font-medium truncate" style={{ color: 'var(--ov-text)' }}>{fileName}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b" style={{ borderColor: 'var(--ov-border)' }}>
                <span style={{ color: 'var(--ov-text-muted)' }}>文件大小</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>{formatImageSize(metadata.fileSize)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b" style={{ borderColor: 'var(--ov-border)' }}>
                <span style={{ color: 'var(--ov-text-muted)' }}>图像分辨率</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>{metadata.width} × {metadata.height} 像素</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b" style={{ borderColor: 'var(--ov-border)' }}>
                <span style={{ color: 'var(--ov-text-muted)' }}>总像素数</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>{metadata.megapixels} 百万像素 (MP)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b" style={{ borderColor: 'var(--ov-border)' }}>
                <span style={{ color: 'var(--ov-text-muted)' }}>纵横比例</span>
                <span className="col-span-2" style={{ color: 'var(--ov-text)' }}>{metadata.aspectRatio}</span>
              </div>

              {/* EXIF 元数据区块 */}
              {metadata.exif && Object.keys(metadata.exif).length > 0 && (
                <div className="pt-2">
                  <h4 className="text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--ov-accent)' }}>
                    相机与拍摄参数 (EXIF)
                  </h4>
                  {Object.entries(metadata.exif).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-2 py-1 border-b font-mono" style={{ borderColor: 'var(--ov-border)' }}>
                      <span style={{ color: 'var(--ov-text-muted)' }}>{k}</span>
                      <span className="col-span-2 truncate" style={{ color: 'var(--ov-text)' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="px-4 py-2.5 border-t flex justify-end"
              style={{
                background: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
            >
              <button
                onClick={() => setShowInfo(false)}
                className="px-3 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)]"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                  borderWidth: 1,
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
