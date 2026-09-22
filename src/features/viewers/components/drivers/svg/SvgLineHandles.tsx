/**
 * SVG 线条专属端点拖拽手柄、曲率拉弧、贝塞尔控制点与几何指标浮标 (SvgLineHandles - Inkscape 风格)
 */
import React from 'react';
import { SvgElementInfo } from './svgUtils';

export interface SvgLineHandlesProps {
  screenLineCoords: { x1: number; y1: number; x2: number; y2: number };
  screenControlPoint?: { x: number; y: number } | null;
  dragMode: 'none' | 'element' | 'pan' | 'resize' | 'line-p1' | 'line-p2' | 'line-curve' | 'line-cp' | 'path-node' | 'path-cp' | string;
  screenDragOffset: { x: number; y: number };
  selectedElementInfo: SvgElementInfo | null;
  isCurved?: boolean;
  isCtrlPressed?: boolean;
  isAltPressed?: boolean;
  isShiftPressed?: boolean;
  snap15Deg?: boolean;
  onConvertToCurve?: () => void;
  onStraighten?: () => void;
  onReverseLine?: () => void;
  onConvertToStepLine?: (mode: 'hv' | 'vh') => void;
}

export const SvgLineHandles: React.FC<SvgLineHandlesProps> = ({
  screenLineCoords,
  screenControlPoint,
  dragMode,
  screenDragOffset,
  selectedElementInfo,
  isCurved = false,
  isCtrlPressed = false,
  isAltPressed = false,
  isShiftPressed = false,
  onConvertToCurve,
  onStraighten,
  onReverseLine,
  onConvertToStepLine,
}) => {
  const p1OffsetX = dragMode === 'element' || dragMode === 'line-p1' ? screenDragOffset.x : 0;
  const p1OffsetY = dragMode === 'element' || dragMode === 'line-p1' ? screenDragOffset.y : 0;
  const p2OffsetX = dragMode === 'element' || dragMode === 'line-p2' ? screenDragOffset.x : 0;
  const p2OffsetY = dragMode === 'element' || dragMode === 'line-p2' ? screenDragOffset.y : 0;

  const currentP1 = {
    x: screenLineCoords.x1 + p1OffsetX,
    y: screenLineCoords.y1 + p1OffsetY,
  };
  const currentP2 = {
    x: screenLineCoords.x2 + p2OffsetX,
    y: screenLineCoords.y2 + p2OffsetY,
  };

  // 计算当前中点位置
  const baseMidX = (screenLineCoords.x1 + screenLineCoords.x2) / 2;
  const baseMidY = (screenLineCoords.y1 + screenLineCoords.y2) / 2;

  // 弧度/曲率手柄偏移
  const curveOffsetX = dragMode === 'line-curve' || dragMode === 'line-cp' ? screenDragOffset.x : 0;
  const curveOffsetY = dragMode === 'line-curve' || dragMode === 'line-cp' ? screenDragOffset.y : 0;

  // 控制点位置
  const currentCp = screenControlPoint
    ? {
        x: screenControlPoint.x + curveOffsetX,
        y: screenControlPoint.y + curveOffsetY,
      }
    : {
        x: baseMidX + curveOffsetX,
        y: baseMidY + curveOffsetY,
      };

  const midX = dragMode === 'line-curve' ? currentCp.x : (currentP1.x + currentP2.x) / 2;
  const midY = dragMode === 'line-curve' ? currentCp.y - 18 : (currentP1.y + currentP2.y) / 2 - 18;

  const length = Math.round(Math.hypot(currentP2.x - currentP1.x, currentP2.y - currentP1.y));

  const rawAngle =
    (((Math.atan2(currentP2.y - currentP1.y, currentP2.x - currentP1.x) * 180) / Math.PI + 360) % 360);
  const angle = Math.round(rawAngle * 10) / 10;

  // 拖动拉弧时的动态贝塞尔预览路径
  const isDraggingCurve = dragMode === 'line-curve';
  const previewCurveD = isDraggingCurve
    ? `M ${currentP1.x} ${currentP1.y} Q ${currentCp.x} ${currentCp.y} ${currentP2.x} ${currentP2.y}`
    : null;

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-25 overflow-visible">
        {/* 15° 步进锁定或端点拖拽时的极角辅助虚线 */}
        {(dragMode === 'line-p1' || dragMode === 'line-p2') && (
          <line
            x1={currentP1.x}
            y1={currentP1.y}
            x2={currentP2.x}
            y2={currentP2.y}
            stroke="#06b6d4"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            opacity={0.8}
          />
        )}

        {/* 动态曲率拖拽预览曲线 */}
        {previewCurveD && (
          <>
            <path
              d={previewCurveD}
              stroke="#10b981"
              strokeWidth={2.5}
              strokeDasharray="4 3"
              fill="none"
              className="filter drop-shadow(0 0 4px rgba(16,185,129,0.8))"
            />
            {/* 贝塞尔切线臂 */}
            <line
              x1={currentP1.x}
              y1={currentP1.y}
              x2={currentCp.x}
              y2={currentCp.y}
              stroke="#10b981"
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.6}
            />
            <line
              x1={currentP2.x}
              y1={currentP2.y}
              x2={currentCp.x}
              y2={currentCp.y}
              stroke="#10b981"
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.6}
            />
          </>
        )}

        {/* 曲线模式下的贝塞尔控制臂 */}
        {isCurved && screenControlPoint && (
          <>
            <line
              x1={currentP1.x}
              y1={currentP1.y}
              x2={currentCp.x}
              y2={currentCp.y}
              stroke="#a855f7"
              strokeWidth={1.2}
              strokeDasharray="3 2"
              opacity={0.7}
            />
            <line
              x1={currentP2.x}
              y1={currentP2.y}
              x2={currentCp.x}
              y2={currentCp.y}
              stroke="#a855f7"
              strokeWidth={1.2}
              strokeDasharray="3 2"
              opacity={0.7}
            />
            {/* 贝塞尔控制点菱形手柄 (Inkscape 贝塞尔控制柄) */}
            <polygon
              points={`${currentCp.x},${currentCp.y - 6} ${currentCp.x + 6},${currentCp.y} ${currentCp.x},${currentCp.y + 6} ${currentCp.x - 6},${currentCp.y}`}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1.5}
              data-line-handle="cp"
              className="cursor-pointer hover:scale-130 transition-transform pointer-events-auto filter drop-shadow(0 0 5px rgba(168,85,247,0.8))"
            />
          </>
        )}

        {/* P1 起点圆形手柄 */}
        <circle
          cx={currentP1.x}
          cy={currentP1.y}
          r={7}
          fill="#3b82f6"
          stroke="#ffffff"
          strokeWidth={2}
          data-line-handle="p1"
          className="cursor-crosshair hover:scale-125 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(59,130,246,0.8))"
        />

        {/* P2 终点圆形手柄 */}
        <circle
          cx={currentP2.x}
          cy={currentP2.y}
          r={7}
          fill="#06b6d4"
          stroke="#ffffff"
          strokeWidth={2}
          data-line-handle="p2"
          className="cursor-crosshair hover:scale-125 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
        />

        {/* 直线中点曲率拉弧手柄 (Inkscape 风格：抓取线段中点直接拉出弧线) */}
        {!isCurved && (
          <g
            transform={`translate(${baseMidX + (dragMode === 'element' ? screenDragOffset.x : 0)}, ${baseMidY + (dragMode === 'element' ? screenDragOffset.y : 0)})`}
            className="pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
            data-line-handle="curve"
          >
            <circle
              r={7}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={2}
              className="filter drop-shadow(0 0 4px rgba(16,185,129,0.8))"
            />
            {/* 弧度图标 */}
            <path
              d="M -3.5 1 Q 0 -3 3.5 1"
              stroke="#ffffff"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      {/* 实时几何指标浮标与 Inkscape 快捷操作胶囊 (显示在线条中点上方) */}
      <div
        className="absolute z-26 pointer-events-none -translate-x-1/2 -translate-y-1/2 select-none"
        style={{
          left: midX,
          top: midY,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--ov-surface)',
            color: 'var(--ov-text)',
            borderColor: 'var(--ov-border)',
          }}
          className="px-2 py-0.8 rounded-md text-[10px] font-mono whitespace-nowrap shadow-xl flex items-center gap-1.5 backdrop-blur-md border pointer-events-auto"
        >
          <span className="text-cyan-400 font-bold">📏 {length}px</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-bold">📐 {angle}°</span>

          {/* 约束指示 */}
          {isCtrlPressed && (
            <span className="bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-semibold text-[9px]">
              Ctrl: 15°锁定
            </span>
          )}
          {isAltPressed && (
            <span className="bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded font-semibold text-[9px]">
              Alt: 角度锁定延长
            </span>
          )}
          {isShiftPressed && (
            <span className="bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-semibold text-[9px]">
              Shift: 对称伸缩
            </span>
          )}

          {/* 快捷按钮 */}
          <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-700/60">
            {!isCurved ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onConvertToCurve?.();
                }}
                className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[9px] font-medium transition cursor-pointer"
                title="一键将直线转换为贝塞尔弧线 (Inkscape 弧线)"
              >
                ∿ 弯曲为弧线
              </button>
            ) : (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onStraighten?.();
                }}
                className="px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[9px] font-medium transition cursor-pointer"
                title="一键拉直为标准直线"
              >
                ━ 拉直
              </button>
            )}

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onReverseLine?.();
              }}
              className="px-1.5 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-[9px] font-medium transition cursor-pointer"
              title="交换端点起点与终点方向"
            >
              ⇄ 反转
            </button>

            {onConvertToStepLine && !isCurved && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onConvertToStepLine('hv');
                }}
                className="px-1.5 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-[9px] font-medium transition cursor-pointer"
                title="转换为阶梯折线 (HV)"
              >
                ∟ 阶梯折线
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

