/**
 * OmniView Mermaid 独立工作室全高度交互矢量画布 (Mermaid Studio Canvas)
 * 具备铺满视口、无原生滚动条、无级滚轮缩放、多维度鼠标拖拽平移、一键适应视口与高清导出能力
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mermaid from 'mermaid';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Maximize2,
  Hand,
  Copy,
  Check,
  Download,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  PlayCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { analyzeMermaidError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';
import {
  detectDiagramPlaybackSupport,
  applyStepHighlightToSvg,
} from '../../../lib/diagramPlaybackEngine';
import { DiagramStepPlayer } from '../common/DiagramStepPlayer';

interface MermaidStudioCanvasProps {
  code: string;
  fileName?: string;
  locale?: Locale;
  onCodeChange?: (newCode: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
}

export const MermaidStudioCanvas: React.FC<MermaidStudioCanvasProps> = ({
  code,
  fileName = 'diagram.mmd',
  locale = 'zh-CN',
  onCodeChange,
  onOpenSourceAtLine,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panMode, setPanMode] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const [svgContent, setSvgContent] = useState<string>('');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isPngExporting, setIsPngExporting] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const renderCountRef = useRef<number>(0);

  // 步骤回放引擎联动状态
  const playbackInfo = useMemo(() => detectDiagramPlaybackSupport(code), [code]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isPlaybackActive, setIsPlaybackActive] = useState<boolean>(false);

  // 初始化与动态响应主题
  const initMermaidTheme = useCallback(() => {
    const isDark =
      typeof document !== 'undefined'
        ? (document.documentElement.getAttribute('data-theme')?.includes('dark') ??
          document.body.classList.contains('vscode-dark') ??
          true)
        : true;

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'var(--ov-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      });
    } catch {
      /* ignore re-init errors */
    }
  }, []);

  // 实时编译 Mermaid 语法
  const compileDiagram = useCallback(async (srcCode: string) => {
    const trimmed = (srcCode || '').trim();
    if (!trimmed) {
      setSvgContent('');
      setCompileError(null);
      return;
    }

    const currentTicket = ++renderCountRef.current;
    setIsCompiling(true);
    initMermaidTheme();

    try {
      const renderId = `mermaid-studio-${Math.random().toString(36).substring(2, 9)}`;
      const { svg } = await mermaid.render(renderId, trimmed);
      if (currentTicket === renderCountRef.current) {
        setSvgContent(svg);
        setCompileError(null);
        setIsCompiling(false);
      }
    } catch (err: unknown) {
      if (currentTicket === renderCountRef.current) {
        const errorMsg = err instanceof Error ? err.message : String(err || 'Mermaid 渲染语法错误');
        setCompileError(errorMsg);
        setIsCompiling(false);
      }
    }
  }, [initMermaidTheme]);

  // 源码变更防抖即时编译 (180ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      void compileDiagram(code);
    }, 180);
    return () => clearTimeout(timer);
  }, [code, compileDiagram]);

  // 原生鼠标滚轮缩放监听 (注册非 passive 事件以保证彻底阻止外层滚动)
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 向下滚缩小，向上滚放大，步进 0.12
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      setZoom(prev => {
        const next = Math.min(5.0, Math.max(0.15, Number((prev + delta).toFixed(2))));
        return next;
      });
    };

    stageEl.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      stageEl.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // 全局松开鼠标事件清理
  useEffect(() => {
    if (!isPanning) return;
    const handleGlobalMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPanning]);

  // 适应视口 (Fit to Viewport) 算法
  const handleFitToViewport = useCallback(() => {
    if (!stageRef.current || !contentWrapperRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    const svgEl = contentWrapperRef.current.querySelector('svg');

    if (!svgEl || stageRect.width <= 0 || stageRect.height <= 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    let svgWidth = 0;
    let svgHeight = 0;

    if (svgEl.viewBox?.baseVal && svgEl.viewBox.baseVal.width > 0) {
      svgWidth = svgEl.viewBox.baseVal.width;
      svgHeight = svgEl.viewBox.baseVal.height;
    } else {
      const bbox = svgEl.getBoundingClientRect();
      svgWidth = bbox.width / zoom;
      svgHeight = bbox.height / zoom;
    }

    if (svgWidth > 0 && svgHeight > 0) {
      const availWidth = Math.max(120, stageRect.width - 64);
      const availHeight = Math.max(120, stageRect.height - 64);
      const scaleX = availWidth / svgWidth;
      const scaleY = availHeight / svgHeight;
      const fitScale = Math.min(scaleX, scaleY, 2.2);
      const clamped = Math.max(0.2, Math.min(3.5, Number(fitScale.toFixed(2))));
      setZoom(clamped);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  // 初次渲染就绪时自动居中适应
  const hasAutoFitRef = useRef(false);
  useEffect(() => {
    if (svgContent && !hasAutoFitRef.current) {
      hasAutoFitRef.current = true;
      requestAnimationFrame(() => {
        handleFitToViewport();
      });
    }
  }, [svgContent, handleFitToViewport]);

  // 鼠标拖拽平移事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    // 允许：鼠标中键 (button === 1)、开启抓手模式 (panMode)、或点击在画布舞台背景/空白容器上
    const isStageBackground =
      e.target === stageRef.current ||
      (e.target as HTMLElement).classList.contains('ov-stage-bg') ||
      (e.target as HTMLElement).tagName.toLowerCase() === 'svg' ||
      panMode ||
      e.button === 1;

    if (isStageBackground) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // 复制 SVG 源码
  const handleCopySvg = async () => {
    if (!svgContent) return;
    try {
      await navigator.clipboard.writeText(svgContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  // 下载 SVG 文件
  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^/.]+$/, '') + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导出高清 PNG
  const handleExportPng = () => {
    if (!svgContent) return;
    setIsPngExporting(true);

    try {
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const scale = 2.5; // 2.5x 高清渲染
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(800, (img.width || 800) * scale);
        canvas.height = Math.max(600, (img.height || 600) * scale);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // 填充浅色/深色背景
          const isDark = document.documentElement.getAttribute('data-theme')?.includes('dark') ?? true;
          ctx.fillStyle = isDark ? '#1e1e1e' : '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);

          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = fileName.replace(/\.[^/.]+$/, '') + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(blobUrl);
        setIsPngExporting(false);
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        setIsPngExporting(false);
      };

      img.src = blobUrl;
    } catch {
      setIsPngExporting(false);
    }
  };

  // 步骤回放高亮渲染
  const displaySvg = useMemo(() => {
    if (!svgContent) return '';
    if (!isPlaybackActive || currentStep < 0) return svgContent;
    return applyStepHighlightToSvg(
      svgContent,
      currentStep,
      playbackInfo.stepCount,
      playbackInfo.diagramType
    );
  }, [svgContent, isPlaybackActive, currentStep, playbackInfo]);

  return (
    <div
      id="mermaid-studio-viewport"
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full w-full flex-1 flex flex-col min-h-0 overflow-hidden relative select-none"
    >
      {/* Viewport Top HUD Toolbar */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0 flex-wrap gap-2 z-20"
      >
        {/* Left: Viewport Status & Indicators */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-[11px] flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Mermaid 矢量视口
          </span>

          {isCompiling && (
            <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>渲染中…</span>
            </span>
          )}

          {!isCompiling && compileError && (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 font-mono">
              <AlertCircle className="w-3 h-3" />
              <span>语法错误</span>
            </span>
          )}

          {/* Pan / Hand Tool Toggle */}
          <button
            onClick={() => setPanMode(!panMode)}
            style={{
              backgroundColor: panMode
                ? 'var(--ov-accent-bg, rgba(6,182,212,0.2))'
                : 'var(--ov-surface)',
              borderColor: panMode ? 'var(--ov-accent, #06b6d4)' : 'var(--ov-border)',
              color: panMode ? 'var(--ov-accent, #06b6d4)' : 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition hover:text-[var(--ov-text)]"
            title="开启/关闭抓手拖拽模式 (开启后左键任意按住均可拖动画布)"
          >
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">抓手</span>
          </button>

          {/* Wheel Zoom Hint */}
          <span
            style={{ color: 'var(--ov-text-muted)' }}
            className="hidden lg:inline text-[10px] font-mono"
            title="直接滑动鼠标滚轮即可平滑无级放大缩小"
          >
            (滚轮缩放 · 拖拽平移)
          </span>
        </div>

        {/* Right: Zoom & Export Controls */}
        <div className="flex items-center gap-1 text-[11px]">
          {/* Zoom Percentage Label (Click to 100%) */}
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="px-2 py-0.5 rounded border font-mono text-[10px] hover:text-[var(--ov-text)] hover:border-cyan-500 transition"
            title="点击复位至 100% 原始缩放"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => setZoom(z => Math.max(0.15, Number((z - 0.15).toFixed(2))))}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="缩小 (步长 -15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom In */}
          <button
            onClick={() => setZoom(z => Math.min(5.0, Number((z + 0.15).toFixed(2))))}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="放大 (步长 +15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* 1:1 Reset */}
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="复位视口 (100% 居中)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Fit to Viewport */}
          <button
            onClick={handleFitToViewport}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="智能适应视口大小与居中"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <div
            style={{ backgroundColor: 'var(--ov-border)' }}
            className="w-px h-3.5 mx-0.5"
          />

          {/* Re-compile Button */}
          <button
            onClick={() => void compileDiagram(code)}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="重新编译并刷新图表"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Copy SVG */}
          <button
            onClick={handleCopySvg}
            style={{ color: isCopied ? '#4ade80' : 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="复制 SVG 矢量源码"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download SVG */}
          <button
            onClick={handleDownloadSvg}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="导出为 SVG 矢量文件"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            disabled={isPngExporting}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="导出为高清 PNG 图片 (2.5x)"
          >
            <ImageIcon className={`w-3.5 h-3.5 ${isPngExporting ? 'animate-pulse text-cyan-400' : ''}`} />
          </button>

          {/* Fullscreen Lightbox */}
          <button
            onClick={() => setIsLightboxOpen(true)}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="全屏沉浸式灯箱查看"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Stage: 铺满高度，强制 overflow-hidden，无原生滚动条 */}
      <div
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleFitToViewport}
        style={{
          backgroundColor: 'var(--ov-bg)',
          backgroundImage:
            'radial-gradient(var(--ov-border, rgba(150,150,150,0.15)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        className={`ov-stage-bg flex-1 w-full h-full relative overflow-hidden flex items-center justify-center select-none ${
          panMode || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        {/* Error Diagnostic Overlay */}
        {compileError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/40 backdrop-blur-xs overflow-auto">
            <div className="max-w-xl w-full">
              <DiagramDiagnosticCard
                diagnostic={analyzeMermaidError(code, compileError, undefined, undefined, locale)}
                locale={locale}
                isRestored={false}
                onApplyQuickFix={fixed => onCodeChange?.(fixed)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                onReRender={() => void compileDiagram(code)}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!compileError && !svgContent && !isCompiling && (
          <div
            style={{ color: 'var(--ov-text-muted)' }}
            className="text-center text-xs space-y-2 px-4 py-8"
          >
            <HelpCircle className="w-8 h-8 mx-auto opacity-40 text-cyan-400" />
            <p className="font-medium text-sm" style={{ color: 'var(--ov-text)' }}>
              暂无可预览的 Mermaid 内容
            </p>
            <p className="max-w-sm mx-auto">
              请在左侧编辑器中输入合法的 Mermaid 流程图、时序图、架构图或状态机代码。
            </p>
          </div>
        )}

        {/* Loading Spinner for Initial Render */}
        {isCompiling && !svgContent && (
          <div className="flex flex-col items-center gap-3 text-cyan-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span style={{ color: 'var(--ov-text-secondary)' }}>正在解析并编译 Mermaid 矢量图元…</span>
          </div>
        )}

        {/* Transformable Canvas Container (平移与缩放矩阵) */}
        <div
          ref={contentWrapperRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 80ms ease-out',
          }}
          className="relative inline-flex items-center justify-center pointer-events-auto p-4"
        >
          {displaySvg && !compileError && (
            <div
              className="ov-mermaid-svg-container transition-all select-none [&>svg]:block [&>svg]:max-w-none"
              dangerouslySetInnerHTML={{ __html: displaySvg }}
            />
          )}
        </div>
      </div>

      {/* Floating Diagram Step-by-Step Player HUD (if supported) */}
      {isPlaybackActive && playbackInfo.isSupported && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <DiagramStepPlayer
            steps={playbackInfo.steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onClose={() => {
              setIsPlaybackActive(false);
              setCurrentStep(-1);
            }}
            diagramType={playbackInfo.diagramType}
            locale={locale}
          />
        </div>
      )}

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center p-6 bg-slate-900/90 border border-slate-700 rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-700 text-xs">
              <span className="font-mono text-cyan-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Mermaid 全屏高清预览 ({fileName})
              </span>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕ 关闭
              </button>
            </div>
            <div
              className="w-full max-h-[75vh] overflow-auto flex items-center justify-center p-4 [&>svg]:max-h-[70vh] [&>svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
