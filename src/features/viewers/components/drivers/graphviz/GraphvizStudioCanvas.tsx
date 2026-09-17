/**
 * OmniView Graphviz / DOT 独立工作室全高度交互矢量画布 (Graphviz Studio Canvas)
 * 具备铺满视口全高度、无原生外部滚动条、无级滚轮缩放、多维度鼠标拖拽平移、一键适应视口与居中、多引擎切换及高清导出能力
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  HelpCircle,
  Layers,
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { graphvizRenderer, GraphvizEngine } from '../../../lib/graphvizRenderer';
import { analyzeGraphvizError } from '../../../lib/diagramDiagnostics';
import { DiagramDiagnosticCard } from '../../common/DiagramDiagnosticCard';

interface GraphvizStudioCanvasProps {
  code: string;
  fileName?: string;
  locale?: Locale;
  onCodeChange?: (newCode: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
}

const GRAPHVIZ_ENGINES: { id: GraphvizEngine; label: string; desc: string }[] = [
  { id: 'dot', label: 'dot (层次有向图)', desc: '默认层次化有向图布局，适用于流程图、类图与调用树' },
  { id: 'neato', label: 'neato (物理弹簧力导)', desc: '无向图物理弹性引力布局' },
  { id: 'fdp', label: 'fdp (弹簧块力导)', desc: '支持子图与集群的力导向布局' },
  { id: 'sfdp', label: 'sfdp (多尺度力导)', desc: '大规模复杂网络多尺度快速力导向布局' },
  { id: 'circo', label: 'circo (环形拓扑)', desc: '环形拓扑结构布局，适用于多环网络与通信拓扑' },
  { id: 'twopi', label: 'twopi (放射同心圆)', desc: '同心圆径向放射布局，以中心节点向外扩散' },
  { id: 'osage', label: 'osage (分块打包)', desc: '紧凑分块阵列打包布局' },
  { id: 'patchwork', label: 'patchwork (树状填充)', desc: '矩形树图 (Treemap) 面积填充布局' },
];

export const GraphvizStudioCanvas: React.FC<GraphvizStudioCanvasProps> = ({
  code,
  fileName = 'diagram.dot',
  locale = 'zh-CN',
  onCodeChange,
  onOpenSourceAtLine,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panMode, setPanMode] = useState<boolean>(false);
  const [engine, setEngine] = useState<GraphvizEngine>('dot');

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

  // 编译 Graphviz 源码为 SVG
  const compileDiagram = useCallback(async (srcCode: string, currentEngine: GraphvizEngine) => {
    const trimmed = (srcCode || '').trim();
    if (!trimmed) {
      setSvgContent('');
      setCompileError(null);
      return;
    }

    const currentTicket = ++renderCountRef.current;
    setIsCompiling(true);

    try {
      const svg = await graphvizRenderer.render(trimmed, currentEngine);
      if (currentTicket === renderCountRef.current) {
        setSvgContent(svg);
        setCompileError(null);
        setIsCompiling(false);
      }
    } catch (err: unknown) {
      if (currentTicket === renderCountRef.current) {
        const errorMsg = err instanceof Error ? err.message : String(err || 'Graphviz 编译失败');
        setCompileError(errorMsg);
        setIsCompiling(false);
      }
    }
  }, []);

  // 源码或引擎变更防抖编译 (180ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      void compileDiagram(code, engine);
    }, 180);
    return () => clearTimeout(timer);
  }, [code, engine, compileDiagram]);

  // 原生鼠标滚轮缩放监听 (保证阻止外层滚动且缩放平滑)
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

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

  // 适应视口与居中算法 (Fit to Viewport & Center)
  const handleFitToViewport = useCallback(() => {
    if (!stageRef.current || !contentWrapperRef.current) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
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
      const fitScale = Math.min(scaleX, scaleY, 1.8);
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
        const scale = 2.5;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(800, (img.width || 800) * scale);
        canvas.height = Math.max(600, (img.height || 600) * scale);
        const ctx = canvas.getContext('2d');

        if (ctx) {
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

  return (
    <div
      id="graphviz-studio-viewport"
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full w-full flex-1 flex flex-col min-h-0 overflow-hidden relative select-none"
    >
      {/* 视口顶部悬浮 HUD 工具栏 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0 select-none z-10 gap-2 min-w-0"
      >
        <div className="flex items-center gap-2 font-mono text-[11px] min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-semibold text-emerald-400 shrink-0">Graphviz</span>
          
          {/* 布局引擎选择器 */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-750 px-1.5 py-0.5 rounded text-[11px] shrink-0">
            <Layers className="w-3 h-3 text-emerald-400" />
            <select
              value={engine}
              onChange={e => setEngine(e.target.value as GraphvizEngine)}
              className="bg-transparent text-slate-300 font-mono text-[11px] outline-none cursor-pointer"
              title="切换 Graphviz 布局计算引擎"
              aria-label="布局引擎"
            >
              {GRAPHVIZ_ENGINES.map(eng => (
                <option key={eng.id} value={eng.id} className="bg-slate-900 text-slate-200">
                  {eng.label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[var(--ov-text-muted)] hidden sm:inline font-sans truncate">
            {GRAPHVIZ_ENGINES.find(e => e.id === engine)?.desc}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* 抓手拖拽模式切换 */}
          <button
            onClick={() => setPanMode(!panMode)}
            style={{
              backgroundColor: panMode ? 'var(--ov-accent)' : 'transparent',
              color: panMode ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="p-1 rounded transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
            title={panMode ? '退出抓手平移模式' : '开启抓手平移模式 (可拖动画布)'}
            aria-label="抓手模式"
          >
            <Hand className="w-3.5 h-3.5" />
          </button>

          {/* 缩小 */}
          <button
            onClick={() => setZoom(z => Math.max(0.15, Number((z - 0.15).toFixed(2))))}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="缩小视口 (-15%)"
            aria-label="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* 缩放比例 */}
          <span
            style={{ color: 'var(--ov-text-secondary)' }}
            className="text-[11px] font-mono px-1 min-w-[42px] text-center"
          >
            {Math.round(zoom * 100)}%
          </span>

          {/* 放大 */}
          <button
            onClick={() => setZoom(z => Math.min(5.0, Number((z + 0.15).toFixed(2))))}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="放大视口 (+15%)"
            aria-label="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* 100% 重置 */}
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="复位视口 (100% 居中)"
            aria-label="复位视口"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* 智能适应视口 */}
          <button
            onClick={handleFitToViewport}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="智能适应视口大小与水平垂直居中"
            aria-label="适应视口"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <div
            style={{ backgroundColor: 'var(--ov-border)' }}
            className="w-px h-3.5 mx-0.5"
          />

          {/* 重新编译 */}
          <button
            onClick={() => void compileDiagram(code, engine)}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="重新编译并刷新图表"
            aria-label="重新编译"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* 复制 SVG */}
          <button
            onClick={handleCopySvg}
            style={{ color: isCopied ? '#4ade80' : 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="复制 SVG 矢量源码"
            aria-label="复制 SVG"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* 下载 SVG */}
          <button
            onClick={handleDownloadSvg}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="导出为 SVG 矢量文件"
            aria-label="下载 SVG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* 导出 PNG */}
          <button
            onClick={handleExportPng}
            disabled={isPngExporting}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="导出为高清 PNG 图片 (2.5x)"
            aria-label="导出 PNG"
          >
            <ImageIcon className={`w-3.5 h-3.5 ${isPngExporting ? 'animate-pulse text-emerald-400' : ''}`} />
          </button>

          {/* 全屏灯箱 */}
          <button
            onClick={() => setIsLightboxOpen(true)}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded transition"
            title="全屏沉浸式灯箱查看"
            aria-label="全屏查看"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 主画板画布舞台：铺满高度 100% 全高，水平与垂直居中，强制 overflow-hidden 无原生滚动条 */}
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
        {/* 错误诊断浮层 */}
        {compileError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/40 backdrop-blur-xs overflow-auto">
            <div className="max-w-xl w-full">
              <DiagramDiagnosticCard
                diagnostic={analyzeGraphvizError(code, compileError, undefined, undefined, locale)}
                locale={locale}
                isRestored={false}
                onApplyQuickFix={fixed => onCodeChange?.(fixed)}
                onOpenSourceAtLine={onOpenSourceAtLine}
                onReRender={() => void compileDiagram(code, engine)}
              />
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!compileError && !svgContent && !isCompiling && (
          <div
            style={{ color: 'var(--ov-text-muted)' }}
            className="text-center text-xs space-y-2 px-4 py-8"
          >
            <HelpCircle className="w-8 h-8 mx-auto opacity-40 text-emerald-400" />
            <p className="font-medium text-sm" style={{ color: 'var(--ov-text)' }}>
              暂无可预览的 Graphviz / DOT 内容
            </p>
            <p className="max-w-sm mx-auto">
              请在左侧编辑器中输入合法的 DOT 语法 (如 digraph G &#123; A -&gt; B; &#125;)。
            </p>
          </div>
        )}

        {/* 初始渲染加载提示 */}
        {isCompiling && !svgContent && (
          <div className="flex flex-col items-center gap-3 text-emerald-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span style={{ color: 'var(--ov-text-secondary)' }}>正在解析并编译 Graphviz 矢量图元…</span>
          </div>
        )}

        {/* 变换容器：在主画板中水平垂直完全居中 */}
        <div
          ref={contentWrapperRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 80ms ease-out',
          }}
          className="relative inline-flex items-center justify-center pointer-events-auto p-4"
        >
          {svgContent && !compileError && (
            <div
              className="ov-graphviz-svg-container transition-all select-none flex items-center justify-center [&>svg]:block [&>svg]:max-w-none"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>

      {/* 全屏灯箱 Modal */}
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
              <span className="font-mono text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Graphviz 全屏高清预览 ({fileName}) - {engine}
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
