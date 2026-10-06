/**
 * OmniView SVG 矢量画布视口 (SVG Vector Canvas Viewport)
 */
import React, { useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { AlertCircle, EyeOff } from 'lucide-react';
import {
  SvgValidationResult,
  SvgElementInfo,
  tagSvgWithNodeIds,
  ResizeHandleDirection,
  CalculatedResizeBBox,
  ElementBBox,
  LinePresetType,
} from './svgUtils';
import { SvgInspectorPanel } from './SvgInspectorPanel';
import { SvgBatchInspectorPanel } from './SvgBatchInspectorPanel';
import { SvgSelectionGizmo } from './SvgSelectionGizmo';
import { SvgLineHandles } from './SvgLineHandles';
import { SvgPathNodeHandles } from './SvgPathNodeHandles';
import { SvgStatusBar } from './SvgStatusBar';
import { useSvgCanvasInteraction, DragMode } from './useSvgCanvasInteraction';

export type SvgBgMode = 'dark-grid' | 'light-grid' | 'slate' | 'white' | 'transparent';

interface SvgCanvasProps {
  svgContent: string;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  bgMode: SvgBgMode;
  showGrid: boolean;
  validation: SvgValidationResult;
  isPanningActive?: boolean;
  // Scheme B: 检视微调系统属性
  inspectorActive: boolean;
  selectedElementIndex: number | null;
  selectedElementIndices?: number[];
  selectedElementInfo: SvgElementInfo | null;
  onSelectElement: (index: number | null) => void;
  onSelectElements?: (indices: number[]) => void;
  onUpdateElement: (updates: Partial<SvgElementInfo>) => void;
  onDeleteElement: () => void;
  onBatchDeleteElements?: (indices: number[]) => void;
  onMoveElementLayer: (direction: 'front' | 'back') => void;
  onLocateInCode: () => void;
  onMoveElementGeometry: (deltaX: number, deltaY: number) => void;
  onBatchMoveElements?: (indices: number[], deltaX: number, deltaY: number) => void;
  onResizeElementGeometry?: (newBBox: CalculatedResizeBBox, initialBBox: ElementBBox) => void;
  onAlignElement: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', bbox: ElementBBox) => void;
  onBatchAlignElements?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onBatchDistributeElements?: (direction: 'horizontal' | 'vertical') => void;
  onBatchUpdateStyle?: (updates: Partial<SvgElementInfo>) => void;
  onGroupElements?: () => void;
  onUngroupElement?: () => void;
  onAlignLineOrthogonal: (mode: 'horizontal' | 'vertical') => void;
  onReverseLine?: () => void;
  onConvertToStepLine?: (mode: 'hv' | 'vh') => void;
  onApplyLinePreset?: (preset: LinePresetType) => void;
  // Inkscape 风格工具箱与线条增强
  activeTool?: 'select' | 'node' | 'pen';
  onChangeActiveTool?: (tool: 'select' | 'node' | 'pen') => void;
  snap15Deg?: boolean;
  onToggleSnap15Deg?: () => void;
  onConvertToCurve?: (curvatureHeight?: number) => void;
  onStraighten?: () => void;
  onUpdatePathNode?: (nodeIndex: number, newX: number, newY: number, cpIndex?: number) => void;
  onInsertPathNode?: (afterNodeIndex: number) => void;
  onDeletePathNode?: (nodeIndex: number) => void;
  onTogglePathNodeType?: (nodeIndex: number) => void;
  onAddNewLine?: (x1: number, y1: number, x2: number, y2: number) => void;
  onAddNewPolyline?: (points: Array<{ x: number; y: number }>) => void;
  /** 代码编辑器行 hover 时反向高亮的图元索引（1-indexed 源行号映射结果） */
  hoverElementIndex?: number | null;
}

export const SvgCanvas: React.FC<SvgCanvasProps> = ({
  svgContent,
  scale,
  setScale,
  position,
  setPosition,
  bgMode,
  showGrid,
  validation,
  isPanningActive = false,
  inspectorActive,
  selectedElementIndex,
  selectedElementIndices = [],
  selectedElementInfo,
  onSelectElement,
  onSelectElements,
  onUpdateElement,
  onDeleteElement,
  onBatchDeleteElements,
  onMoveElementLayer,
  onLocateInCode,
  onMoveElementGeometry,
  onBatchMoveElements,
  onResizeElementGeometry,
  onAlignElement,
  onBatchAlignElements,
  onBatchDistributeElements,
  onBatchUpdateStyle,
  onGroupElements,
  onUngroupElement,
  onAlignLineOrthogonal,
  onReverseLine,
  onConvertToStepLine,
  onApplyLinePreset,
  activeTool = 'select',
  onChangeActiveTool,
  snap15Deg = false,
  onToggleSnap15Deg,
  onConvertToCurve,
  onStraighten,
  onUpdatePathNode,
  onInsertPathNode,
  onDeletePathNode,
  onTogglePathNodeType,
  onAddNewLine,
  onAddNewPolyline,
  hoverElementIndex = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // 将全部交互逻辑（拖拽/平移/缩放/手柄/钢笔/节点/键盘/测量/框选）下沉到独立 Hook
  const {
    dragMode,
    setDragMode,
    activeResizeHandle,
    resizePreviewBBox,
    snapEnabled,
    setSnapEnabled,
    gridSnapEnabled,
    setGridSnapEnabled,
    gridSize,
    setGridSize,
    isCtrlPressed,
    isAltPressed,
    isShiftPressed,
    activeGuides,
    setActiveGuides,
    hoveredTag,
    setHoveredTag,
    marqueeRect,
    effectiveSelectedIndices,
    penPoints,
    penCursor,
    screenPathNodes,
    selectedNodeIndex,
    setSelectedNodeIndex,
    isCurved,
    screenControlPoint,
    screenLineCoords,
    screenDragOffset,
    measuredBBox,
    svgRootRef,
    currentCtmRef,
    canvasBoundsRef,
    lastValidSvgRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    displayScreenBBox,
  } = useSvgCanvasInteraction({
    svgContent,
    scale,
    setScale,
    position,
    setPosition,
    validation,
    inspectorActive,
    selectedElementIndex,
    selectedElementIndices,
    selectedElementInfo,
    onSelectElement,
    onSelectElements,
    onUpdateElement,
    onDeleteElement,
    onBatchDeleteElements,
    onMoveElementGeometry,
    onBatchMoveElements,
    onResizeElementGeometry,
    onGroupElements,
    onUngroupElement,
    activeTool,
    onChangeActiveTool,
    snap15Deg,
    onToggleSnap15Deg,
    onConvertToCurve,
    onStraighten,
    onUpdatePathNode,
    onInsertPathNode,
    onDeletePathNode,
    onTogglePathNodeType,
    onAddNewLine,
    onAddNewPolyline,
    onAlignElement,
    onAlignLineOrthogonal,
    onReverseLine,
    onConvertToStepLine,
    onApplyLinePreset,
    surfaceRef,
    containerRef,
  });

  // 经过 DOMPurify 严格安全净化的 SVG 内容，并按需注入 data-omni-id 与 data-omni-selected 供检视器点选高亮
  const sanitizedMarkup = useMemo(() => {
    const rawContent = (validation.valid ? svgContent : lastValidSvgRef.current) || svgContent || '';
    if (!rawContent || !rawContent.trim()) return '';

    // 预清理：剥除 UTF-8 BOM、<?xml ...?> 与 <!DOCTYPE ...>，避免引起 HTML 挂载解析错乱
    const targetContent = rawContent
      .replace(/^\uFEFF/, '')
      .replace(/<\?xml[\s\S]*?\?>/gi, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .trim();

    if (!targetContent) return '';

    const needsTag = inspectorActive || effectiveSelectedIndices.length > 0 || hoverElementIndex !== null;
    const taggedContent = needsTag
      ? tagSvgWithNodeIds(targetContent, effectiveSelectedIndices)
      : targetContent;

    let sanitized = DOMPurify.sanitize(taggedContent, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: [
        'style',
        'clipPath',
        'linearGradient',
        'radialGradient',
        'filter',
        'feGaussianBlur',
        'feOffset',
        'feMerge',
        'feMergeNode',
        'marker',
        'pattern',
        'mask',
        'use',
        'symbol',
        'foreignObject',
      ],
      ADD_ATTR: [
        'data-omni-id',
        'data-omni-selected',
        'data-omni-hover',
        'class',
        'style',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'points',
        'd',
        'viewBox',
        'xmlns',
        'xmlns:xlink',
        'xlink:href',
        'href',
        'transform',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-dasharray',
        'stroke-dashoffset',
        'stroke-miterlimit',
        'opacity',
        'fill-opacity',
        'stroke-opacity',
        'marker-start',
        'marker-end',
        'marker-mid',
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'text-anchor',
        'letter-spacing',
        'dominant-baseline',
        'width',
        'height',
        'preserveAspectRatio',
        'clip-path',
        'filter',
      ],
    });

    // 注入 hover 高亮标记（DOMPurify 之后直接字符串替换，安全可控）
    if (hoverElementIndex !== null && needsTag) {
      sanitized = sanitized.replace(
        `data-omni-id="${hoverElementIndex}"`,
        `data-omni-id="${hoverElementIndex}" data-omni-hover="true"`
      );
    }

    return sanitized;
  }, [svgContent, validation.valid, inspectorActive, selectedElementIndex, effectiveSelectedIndices, hoverElementIndex]);

  // 8 向手柄定义配置
  const resizeHandles: Array<{ direction: ResizeHandleDirection; cursor: string; className: string }> = [
    { direction: 'nw', cursor: 'cursor-nwse-resize', className: '-top-1.5 -left-1.5' },
    { direction: 'n', cursor: 'cursor-ns-resize', className: '-top-1.5 left-1/2 -translate-x-1/2' },
    { direction: 'ne', cursor: 'cursor-nesw-resize', className: '-top-1.5 -right-1.5' },
    { direction: 'e', cursor: 'cursor-ew-resize', className: 'top-1/2 -translate-y-1/2 -right-1.5' },
    { direction: 'se', cursor: 'cursor-nwse-resize', className: '-bottom-1.5 -right-1.5' },
    { direction: 's', cursor: 'cursor-ns-resize', className: '-bottom-1.5 left-1/2 -translate-x-1/2' },
    { direction: 'sw', cursor: 'cursor-nesw-resize', className: '-bottom-1.5 -left-1.5' },
    { direction: 'w', cursor: 'cursor-ew-resize', className: 'top-1/2 -translate-y-1/2 -left-1.5' },
  ];

  return (
    <div
      ref={containerRef}
      id="svg-canvas-viewport"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDragMode('none');
        setHoveredTag(null);
        setActiveGuides([]);
      }}
      style={{
        backgroundColor: bgMode === 'white' ? '#ffffff' : bgMode === 'light-grid' ? '#e2e8f0' : 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className={`relative w-full h-full select-none overflow-hidden flex items-center justify-center ${
        isPanningActive || dragMode === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : dragMode === 'element' || dragMode === 'line-p1' || dragMode === 'line-p2'
          ? 'cursor-move'
          : inspectorActive
          ? selectedElementIndex !== null
            ? 'cursor-default'
            : 'cursor-crosshair'
          : 'cursor-default'
      } ${
        bgMode === 'dark-grid'
          ? 'bg-[radial-gradient(var(--ov-border)_1px,transparent_1px)] [background-size:16px_16px]'
          : bgMode === 'light-grid'
          ? 'bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]'
          : bgMode === 'white'
          ? 'bg-white'
          : bgMode === 'transparent'
          ? 'bg-[linear-gradient(45deg,var(--ov-border)_25%,transparent_25%),linear-gradient(-45deg,var(--ov-border)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--ov-border)_75%),linear-gradient(-45deg,transparent_75%,var(--ov-border)_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]'
          : ''
      }`}
    >
      {/* 检视模式与选中图元高亮样式注入 */}
      <style>{`
        #svg-render-surface svg {
          display: block;
          max-width: 100%;
          max-height: 100%;
          box-sizing: content-box;
        }
        #svg-render-surface [data-omni-id] {
          transition: outline 0.1s ease;
        }
        #svg-render-surface.inspector-active [data-omni-id]:hover {
          outline: 2px dashed #06b6d4 !important;
          outline-offset: 1px;
          cursor: pointer;
        }
        #svg-render-surface [data-omni-selected="true"] {
          outline: 2.5px solid #3b82f6 !important;
          outline-offset: 2px;
          filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.7));
          cursor: move !important;
        }
        #svg-render-surface [data-omni-hover="true"] {
          outline: 2px solid #f59e0b !important;
          outline-offset: 1.5px;
          filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.6));
        }
      `}</style>

      {/* 辅助坐标轴与交互式动态网格系统 (绝对贴合真实缩放与平移) */}
      {(showGrid || gridSnapEnabled) && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            backgroundImage: `radial-gradient(circle, ${
              bgMode === 'white' || bgMode === 'light-grid' ? '#64748b' : '#38bdf8'
            } 1.25px, transparent 1.25px)`,
            backgroundSize: `${gridSize * scale}px ${gridSize * scale}px`,
            backgroundPosition: `${position.x % (gridSize * scale)}px ${position.y % (gridSize * scale)}px`,
            opacity: gridSnapEnabled ? 0.35 : 0.18,
          }}
        />
      )}

      {showGrid && (
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-400" />
        </div>
      )}

      {/* 语法错误浮动告警条 */}
      {!validation.valid && (
        <div
          data-canvas-ui="true"
          onMouseDown={e => e.stopPropagation()}
          onMouseUp={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 px-3 py-2 bg-amber-950/90 border border-amber-500/50 rounded-lg text-amber-200 text-xs shadow-xl backdrop-blur-sm animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1 truncate">
            <span className="font-semibold text-amber-300">XML 解析告警:</span>{' '}
            {validation.error}
            {validation.line ? ` (第 ${validation.line} 行${validation.column ? `:${validation.column}` : ''})` : ''}
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50 flex-shrink-0">
            保持上一次有效视图
          </span>
        </div>
      )}

      {/* 矢量渲染核心容器 (支持零延迟无损缩放平移) */}
      {sanitizedMarkup ? (
        <div
          ref={surfaceRef}
          id="svg-render-surface"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragMode !== 'none' ? 'none' : 'transform 0.08s ease-out',
          }}
          className={`relative p-8 max-w-full max-h-full flex items-center justify-center drop-shadow-2xl select-none ${
            inspectorActive ? 'inspector-active' : ''
          }`}
        >
          <div dangerouslySetInnerHTML={{ __html: sanitizedMarkup }} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
          <EyeOff className="w-8 h-8 opacity-40" />
          <span className="text-xs">暂无有效 SVG 图元可渲染</span>
        </div>
      )}

      {/* 鼠标自由拖拽框选半透明选框 (Marquee Selection Box) */}
      {marqueeRect && (
        <div
          data-canvas-ui="true"
          className="absolute pointer-events-none z-30 border border-blue-500 border-dashed bg-blue-500/15 rounded-xs shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-none"
          style={{
            left: `${marqueeRect.x}px`,
            top: `${marqueeRect.y}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
          }}
        />
      )}

      {/* 视口顶层像素级精准选框与 8 向调整手柄 (100% 贴合屏幕物理像素，支持多选联合选框) */}
      {effectiveSelectedIndices.length > 0 && displayScreenBBox && (
        <SvgSelectionGizmo
          displayScreenBBox={displayScreenBBox}
          dragMode={dragMode}
          selectedElementInfo={selectedElementInfo}
          selectedCount={effectiveSelectedIndices.length}
          resizeHandles={resizeHandles}
          resizePreviewBBox={resizePreviewBBox}
          measuredBBox={measuredBBox}
          scale={scale}
          isShiftPressed={isShiftPressed}
        />
      )}

      {/* 线条专属：视口顶层起点与终点独立拖拽圆形手柄、弯曲手柄、二次贝塞尔控制点与 HUD */}
      {selectedElementIndex !== null && screenLineCoords && (
        <SvgLineHandles
          screenLineCoords={screenLineCoords}
          dragMode={dragMode}
          screenDragOffset={screenDragOffset}
          selectedElementInfo={selectedElementInfo}
          isCurved={isCurved}
          screenControlPoint={screenControlPoint}
          onConvertToCurve={onConvertToCurve}
          onStraighten={onStraighten}
          onReverseLine={onReverseLine}
          onConvertToStepLine={onConvertToStepLine}
          snap15Deg={snap15Deg || isCtrlPressed}
        />
      )}

      {/* Inkscape 风格路径节点与控制柄编辑手柄 (Node Tool F2) */}
      {activeTool === 'node' && screenPathNodes.length > 0 && (
        <SvgPathNodeHandles
          screenNodes={screenPathNodes}
          dragMode={dragMode}
          screenDragOffset={screenDragOffset}
          selectedNodeIndex={selectedNodeIndex}
          onSelectNode={setSelectedNodeIndex}
          onInsertNode={onInsertPathNode}
          onDeleteNode={onDeletePathNode}
          onToggleNodeType={onTogglePathNodeType}
        />
      )}

      {/* Inkscape 钢笔工具即时弹性橡皮筋虚线与长度/夹角 HUD 浮动层 */}
      {activeTool === 'pen' && penPoints.length > 0 && containerRef.current && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <svg className="w-full h-full">
            {penPoints.map((pt, idx) => {
              if (idx === 0) return null;
              const prev = penPoints[idx - 1];
              const pt1 = svgRootRef.current?.createSVGPoint();
              const pt2 = svgRootRef.current?.createSVGPoint();
              if (!pt1 || !pt2 || !currentCtmRef.current || !containerRef.current) return null;
              pt1.x = prev.x; pt1.y = prev.y;
              pt2.x = pt.x; pt2.y = pt.y;
              const sp1 = pt1.matrixTransform(currentCtmRef.current);
              const sp2 = pt2.matrixTransform(currentCtmRef.current);
              const cr = containerRef.current.getBoundingClientRect();
              return (
                <line
                  key={idx}
                  x1={sp1.x - cr.left}
                  y1={sp1.y - cr.top}
                  x2={sp2.x - cr.left}
                  y2={sp2.y - cr.top}
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              );
            })}
            {penCursor && (() => {
              const last = penPoints[penPoints.length - 1];
              const pt1 = svgRootRef.current?.createSVGPoint();
              const pt2 = svgRootRef.current?.createSVGPoint();
              if (!pt1 || !pt2 || !currentCtmRef.current || !containerRef.current) return null;
              pt1.x = last.x; pt1.y = last.y;
              pt2.x = penCursor.x; pt2.y = penCursor.y;
              const sp1 = pt1.matrixTransform(currentCtmRef.current);
              const sp2 = pt2.matrixTransform(currentCtmRef.current);
              const cr = containerRef.current.getBoundingClientRect();
              const sx1 = sp1.x - cr.left;
              const sy1 = sp1.y - cr.top;
              const sx2 = sp2.x - cr.left;
              const sy2 = sp2.y - cr.top;
              const dx = penCursor.x - last.x;
              const dy = penCursor.y - last.y;
              const len = Math.round(Math.hypot(dx, dy));
              const deg = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
              return (
                <g>
                  <line
                    x1={sx1}
                    y1={sy1}
                    x2={sx2}
                    y2={sy2}
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <circle cx={sx2} cy={sy2} r="4.5" fill="#06b6d4" />
                  <rect
                    x={(sx1 + sx2) / 2 + 8}
                    y={(sy1 + sy2) / 2 - 14}
                    width="66"
                    height="18"
                    rx="3"
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke="#06b6d4"
                    strokeWidth="1"
                  />
                  <text
                    x={(sx1 + sx2) / 2 + 12}
                    y={(sy1 + sy2) / 2 - 1}
                    fill="#38bdf8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {len}px {deg}°
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      )}

      {/* 智能吸附参考对齐辅助线图层 (Smart Snapping Alignment Guides) */}
      {activeGuides.length > 0 && surfaceRef.current && containerRef.current && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {activeGuides.map((guide, idx) => {
            const surfaceRect = surfaceRef.current?.getBoundingClientRect();
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (!surfaceRect || !containerRect) return null;

            // 根据 SVG 内部坐标转换至屏幕视口相对像素
            const svgDimensions = canvasBoundsRef.current;
            const svgPixelX = (guide.position - svgDimensions.minX) * scale;
            const svgPixelY = (guide.position - svgDimensions.minY) * scale;

            if (guide.type === 'vertical') {
              const screenX = surfaceRect.left - containerRect.left + svgPixelX;
              return (
                <div key={idx} className="absolute inset-y-0 pointer-events-none" style={{ left: screenX }}>
                  <div className="w-[1.5px] h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.9)]" />
                  <div className="absolute top-4 -translate-x-1/2 px-1.5 py-0.5 rounded bg-pink-600/90 text-white font-mono text-[10px] whitespace-nowrap shadow-lg border border-pink-400/60 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-100">
                    {guide.label}
                  </div>
                </div>
              );
            } else {
              const screenY = surfaceRect.top - containerRect.top + svgPixelY;
              return (
                <div key={idx} className="absolute inset-x-0 pointer-events-none" style={{ top: screenY }}>
                  <div className="h-[1.5px] w-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.9)]" />
                  <div className="absolute left-4 -translate-y-1/2 px-1.5 py-0.5 rounded bg-pink-600/90 text-white font-mono text-[10px] whitespace-nowrap shadow-lg border border-pink-400/60 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-100">
                    {guide.label}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* 属性微调检视器悬浮面板 (多选批量面板 vs 单图元精细属性面板) */}
      {effectiveSelectedIndices.length > 1 ? (
        <SvgBatchInspectorPanel
          selectedCount={effectiveSelectedIndices.length}
          unionBBox={measuredBBox}
          onBatchAlign={alignment => onBatchAlignElements?.(alignment)}
          onBatchDistribute={direction => onBatchDistributeElements?.(direction)}
          onBatchUpdateStyle={updates => onBatchUpdateStyle?.(updates)}
          onBatchDelete={() => onBatchDeleteElements?.(effectiveSelectedIndices)}
          onGroup={onGroupElements}
          onUngroup={onUngroupElement}
          onClose={() => {
            onSelectElements?.([]);
            onSelectElement(null);
          }}
        />
      ) : selectedElementInfo ? (
        <SvgInspectorPanel
          element={selectedElementInfo}
          bbox={measuredBBox}
          onUpdate={onUpdateElement}
          onDelete={onDeleteElement}
          onMoveLayer={onMoveElementLayer}
          onLocateInCode={onLocateInCode}
          onAlign={alignment => measuredBBox && onAlignElement(alignment, measuredBBox)}
          onAlignLine={onAlignLineOrthogonal}
          onReverseLine={onReverseLine}
          onConvertToStepLine={onConvertToStepLine}
          onApplyLinePreset={onApplyLinePreset}
          onConvertToCurve={onConvertToCurve}
          onStraighten={onStraighten}
          isCurved={isCurved}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled(prev => !prev)}
          onClose={() => {
            onSelectElements?.([]);
            onSelectElement(null);
          }}
        />
      ) : null}

      {/* 底部交互辅助指示与吸附开关状态栏 */}
      <SvgStatusBar
        scale={scale}
        inspectorActive={inspectorActive}
        hoveredTag={hoveredTag}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled(prev => !prev)}
        gridSnapEnabled={gridSnapEnabled}
        onToggleGridSnap={() => setGridSnapEnabled(prev => !prev)}
        gridSize={gridSize}
        onSetGridSize={setGridSize}
        snap15Deg={snap15Deg}
        onToggleSnap15Deg={onToggleSnap15Deg}
        isCtrlPressed={isCtrlPressed}
        isAltPressed={isAltPressed}
        isShiftPressed={isShiftPressed}
      />
    </div>
  );
};
