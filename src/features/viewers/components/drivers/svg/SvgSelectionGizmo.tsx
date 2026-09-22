/**
 * SVG 选区高亮框与 8 向调整手柄 (SvgSelectionGizmo)
 */
import React from 'react';
import {
  SvgElementInfo,
  ElementBBox,
  ResizeHandleDirection,
} from './svgUtils';

export interface SvgSelectionGizmoProps {
  displayScreenBBox: ElementBBox;
  dragMode: 'none' | 'element' | 'pan' | 'resize' | 'line-p1' | 'line-p2' | 'line-curve' | 'line-cp' | 'path-node' | 'path-cp' | string;
  selectedElementInfo: SvgElementInfo | null;
  resizeHandles: Array<{ direction: ResizeHandleDirection; cursor: string; className: string }>;
  resizePreviewBBox?: ElementBBox | null;
  measuredBBox?: ElementBBox | null;
  scale: number;
  isShiftPressed: boolean;
}

export const SvgSelectionGizmo: React.FC<SvgSelectionGizmoProps> = ({
  displayScreenBBox,
  dragMode,
  selectedElementInfo,
  resizeHandles,
  resizePreviewBBox,
  measuredBBox,
  scale,
  isShiftPressed,
}) => {
  return (
    <div
      data-selected-gizmo="true"
      className="absolute pointer-events-none z-20"
      style={{
        left: `${displayScreenBBox.x}px`,
        top: `${displayScreenBBox.y}px`,
        width: `${Math.max(displayScreenBBox.width, 8)}px`,
        height: `${Math.max(displayScreenBBox.height, 8)}px`,
      }}
    >
      {/* 主高亮外框 */}
      <div
        className={`w-full h-full border-2 ${
          dragMode === 'element'
            ? 'border-dashed border-cyan-400 bg-cyan-500/10'
            : dragMode === 'resize'
            ? 'border-dashed border-pink-400 bg-pink-500/10'
            : 'border-blue-500 bg-blue-500/5'
        } shadow-[0_0_10px_rgba(59,130,246,0.6)] pointer-events-auto cursor-move transition-colors`}
      />

      {/* 8 向 Resize 大小调整手柄 (对非 line 图元全面开放) */}
      {selectedElementInfo?.tagName !== 'line' &&
        resizeHandles.map(h => (
          <div
            key={h.direction}
            data-resize-handle={h.direction}
            className={`absolute w-2.5 h-2.5 bg-white border-2 border-blue-600 rounded-[2px] shadow-md ${h.className} ${h.cursor} pointer-events-auto hover:bg-blue-100 hover:scale-130 active:scale-140 transition-transform z-30`}
            title={`拖拽调整尺寸 (${h.direction.toUpperCase()}) · 按住 Shift 等比缩放`}
          />
        ))}

      {/* 尺寸提示与等比缩放浮标 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          color: 'var(--ov-text)',
          borderColor: 'var(--ov-border)',
        }}
        className="absolute -bottom-6.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[10px] whitespace-nowrap shadow-lg backdrop-blur-xs pointer-events-none"
      >
        <span>
          {Math.round(resizePreviewBBox?.width || measuredBBox?.width || displayScreenBBox.width / scale)} ×{' '}
          {Math.round(resizePreviewBBox?.height || measuredBBox?.height || displayScreenBBox.height / scale)}
        </span>
        {(isShiftPressed || dragMode === 'resize') && (
          <span className={`px-1 rounded text-[9px] ${isShiftPressed ? 'bg-amber-500/30 text-amber-300 font-semibold' : 'text-slate-400'}`}>
            {isShiftPressed ? '等比锁定' : 'Shift:等比'}
          </span>
        )}
      </div>
    </div>
  );
};
