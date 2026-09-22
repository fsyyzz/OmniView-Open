/**
 * OmniView SVG 图元属性检视与微调面板 (SVG Element Inspector Panel)
 */
import React from 'react';
import {
  X,
  Copy,
  Trash2,
  Code2,
  ArrowUpToLine,
  ArrowDownToLine,
  Check,
  Type,
  Maximize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Magnet,
  Compass,
} from 'lucide-react';
import {
  SvgElementInfo,
  ElementBBox,
  LinePresetType,
} from './svgUtils';
import { useSvgInspector } from './useSvgInspector';
import { SvgInspectorLineControls } from './SvgInspectorLineControls';
import { SvgInspectorStyleControls } from './SvgInspectorStyleControls';

export interface SvgInspectorPanelProps {
  element: SvgElementInfo;
  bbox?: ElementBBox | null;
  onUpdate: (updates: Partial<SvgElementInfo>) => void;
  onDelete: () => void;
  onMoveLayer: (direction: 'front' | 'back') => void;
  onLocateInCode: () => void;
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onAlignLine?: (mode: 'horizontal' | 'vertical') => void;
  onReverseLine?: () => void;
  onConvertToStepLine?: (mode: 'hv' | 'vh') => void;
  onApplyLinePreset?: (preset: LinePresetType) => void;
  onConvertToCurve?: (curvatureHeight?: number) => void;
  onStraighten?: () => void;
  isCurved?: boolean;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  onClose: () => void;
}

export const SvgInspectorPanel: React.FC<SvgInspectorPanelProps> = ({
  element,
  bbox,
  onUpdate,
  onDelete,
  onMoveLayer,
  onLocateInCode,
  onAlign,
  onAlignLine,
  onReverseLine,
  onConvertToStepLine,
  onApplyLinePreset,
  onConvertToCurve,
  onStraighten,
  isCurved = false,
  snapEnabled = true,
  onToggleSnap,
  onClose,
}) => {
  const {
    copiedXml,
    handleCopyXml,
    fill,
    handleFillChange,
    stroke,
    handleStrokeChange,
    strokeWidth,
    handleStrokeWidthChange,
    strokeDasharray,
    handleStrokeDasharrayChange,
    strokeLinecap,
    handleStrokeLinecapChange,
    strokeLinejoin,
    handleStrokeLinejoinChange,
    markerStart,
    handleMarkerStartChange,
    markerEnd,
    handleMarkerEndChange,
    opacity,
    handleOpacityChange,
    textContent,
    handleTextContentChange,
    xVal,
    setXVal,
    yVal,
    setYVal,
    lineX1,
    setLineX1,
    lineY1,
    setLineY1,
    lineX2,
    setLineX2,
    lineY2,
    setLineY2,
    handleCoordCommit,
    isTextTag,
    isLineTag,
    lineMetrics,
    handleUpdateLineAngleOrLength,
  } = useSvgInspector({ element, onUpdate });

  return (
    <div
      id="svg-inspector-panel"
      data-inspector-panel="true"
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
        boxShadow: 'var(--ov-shadow, 0 8px 24px rgba(0,0,0,0.36))',
      }}
      className="absolute top-3 right-3 z-30 w-80 max-h-[calc(100%-1.5rem)] flex flex-col backdrop-blur-md border rounded-xl text-xs select-none overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* 顶部标题栏 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-3.5 py-2.5 border-b"
      >
        <div className="flex items-center gap-2 truncate">
          <span
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'var(--ov-accent, #3b82f6)',
              color: 'var(--ov-accent, #60a5fa)',
            }}
            className="px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border"
          >
            &lt;{element.tagName}&gt;
          </span>
          {element.id ? (
            <span className="text-[11px] font-mono text-amber-400 truncate" title={`#${element.id}`}>
              #{element.id}
            </span>
          ) : (
            <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-mono">图元 #{element.index}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 吸附状态指示与切换 */}
          {onToggleSnap && (
            <button
              onClick={onToggleSnap}
              style={{
                color: snapEnabled ? '#f472b6' : 'var(--ov-text-secondary)',
                backgroundColor: snapEnabled ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
              }}
              className="p-1 rounded transition hover:opacity-80"
              title={`智能吸附: ${snapEnabled ? '已开启' : '已关闭'} (快捷键 S)`}
            >
              <Magnet className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 rounded hover:opacity-80 transition"
            title="关闭检视面板"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 属性控制滚动区 */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* 画布快速对齐工具 (Quick Canvas Alignment) */}
        {onAlign && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
            }}
            className="space-y-1.5 p-2.5 rounded-lg border"
          >
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1 font-medium" style={{ color: 'var(--ov-text)' }}>
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>快速对齐到画布</span>
              </div>
              <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono">画布视口参考</span>
            </div>
            <div className="grid grid-cols-6 gap-1 pt-1">
              <button
                onClick={() => onAlign('left')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1 rounded border flex items-center justify-center transition hover:opacity-80"
                title="靠左对齐"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAlign('center')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1 rounded border flex items-center justify-center transition hover:opacity-80"
                title="水平居中"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAlign('right')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1 rounded border flex items-center justify-center transition hover:opacity-80"
                title="靠右对齐"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAlign('top')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1 rounded border flex items-center justify-center transition text-[10px] font-bold hover:opacity-80"
                title="靠顶对齐"
              >
                TOP
              </button>
              <button
                onClick={() => onAlign('middle')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1 rounded border flex items-center justify-center transition text-[10px] font-bold hover:opacity-80"
                title="垂直居中"
              >
                MID
              </button>
              <button
                onClick={() => onAlign('bottom')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1 rounded border flex items-center justify-center transition text-[10px] font-bold hover:opacity-80"
                title="靠底对齐"
              >
                BOT
              </button>
            </div>
          </div>
        )}

        {/* 线条专属几何特征、极坐标、正交化与折线转换 (Enhanced Line Controls) */}
        {isLineTag && lineMetrics && (
          <SvgInspectorLineControls
            lineMetrics={lineMetrics}
            lineX1={lineX1}
            setLineX1={setLineX1}
            lineY1={lineY1}
            setLineY1={setLineY1}
            lineX2={lineX2}
            setLineX2={setLineX2}
            lineY2={lineY2}
            setLineY2={setLineY2}
            onUpdateLineAngleOrLength={handleUpdateLineAngleOrLength}
            onCoordCommit={handleCoordCommit}
            onAlignLine={onAlignLine}
            onReverseLine={onReverseLine}
            onConvertToStepLine={onConvertToStepLine}
            onApplyLinePreset={onApplyLinePreset}
            onConvertToCurve={onConvertToCurve}
            onStraighten={onStraighten}
            isCurved={isCurved}
          />
        )}

        {/* 文本节点内容直编 */}
        {isTextTag && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
            }}
            className="space-y-1.5 p-2.5 rounded-lg border"
          >
            <div className="flex items-center gap-1.5 font-medium text-[11px]" style={{ color: 'var(--ov-text)' }}>
              <Type className="w-3.5 h-3.5 text-cyan-400" />
              <span>文本文字内容</span>
            </div>
            <textarea
              value={textContent}
              onChange={e => handleTextContentChange(e.target.value)}
              rows={2}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-full p-2 border rounded text-xs font-sans outline-none focus:border-blue-500 resize-none"
              placeholder="输入文本内容..."
            />
          </div>
        )}

        {/* 样式控制（填充、描边、粗细、线型、虚线、线端帽、连接角、标记、透明度） */}
        <SvgInspectorStyleControls
          fill={fill}
          onFillChange={handleFillChange}
          stroke={stroke}
          onStrokeChange={handleStrokeChange}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={handleStrokeWidthChange}
          strokeDasharray={strokeDasharray}
          onStrokeDasharrayChange={handleStrokeDasharrayChange}
          strokeLinecap={strokeLinecap}
          onStrokeLinecapChange={handleStrokeLinecapChange}
          strokeLinejoin={strokeLinejoin}
          onStrokeLinejoinChange={handleStrokeLinejoinChange}
          markerStart={markerStart}
          onMarkerStartChange={handleMarkerStartChange}
          markerEnd={markerEnd}
          onMarkerEndChange={handleMarkerEndChange}
          opacity={opacity}
          onOpacityChange={handleOpacityChange}
        />

        {/* 几何坐标直接微调与尺寸展示 */}
        <div style={{ borderTopColor: 'var(--ov-border)' }} className="pt-2 border-t space-y-1.5 text-[11px] font-mono">
          <div className="flex items-center justify-between text-[11px] font-sans">
            <div className="flex items-center gap-1" style={{ color: 'var(--ov-text)' }}>
              <Maximize2 className="w-3 h-3 text-indigo-400" />
              <span>几何特征与实测位置</span>
            </div>
            {bbox && (
              <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono">
                {Math.round(bbox.width)}×{Math.round(bbox.height)}
              </span>
            )}
          </div>

          {/* 矩形与圆形的中心/起点微调 */}
          {(element.x !== undefined || element.cx !== undefined) && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="grid grid-cols-2 gap-2 p-2 rounded border"
            >
              <div>
                <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px]">坐标 X / CX</span>
                <input
                  type="number"
                  value={xVal}
                  onChange={e => setXVal(e.target.value)}
                  onBlur={e => handleCoordCommit(element.cx !== undefined ? 'cx' : 'x', e.target.value)}
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                  className="w-full mt-0.5 p-1 border rounded text-xs text-center font-mono outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px]">坐标 Y / CY</span>
                <input
                  type="number"
                  value={yVal}
                  onChange={e => setYVal(e.target.value)}
                  onBlur={e => handleCoordCommit(element.cy !== undefined ? 'cy' : 'y', e.target.value)}
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                  className="w-full mt-0.5 p-1 border rounded text-xs text-center font-mono outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* 尺寸详情展示 */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-2 rounded border space-y-0.5 text-[10px]"
          >
            {bbox && (
              <div className="text-cyan-400">
                BBox: ({Math.round(bbox.x)}, {Math.round(bbox.y)}) · {Math.round(bbox.width)}×{Math.round(bbox.height)}
              </div>
            )}
            {element.width && <div>宽度 attr: {element.width}</div>}
            {element.height && <div>高度 attr: {element.height}</div>}
            {element.r && <div>半径 R: {element.r}</div>}
            {element.d && (
              <div style={{ color: 'var(--ov-text-muted)' }} className="truncate" title={element.d}>
                Path: {element.d.slice(0, 28)}...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作工具栏 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderTopColor: 'var(--ov-border)',
        }}
        className="px-3 py-2.5 border-t flex items-center justify-between gap-1.5"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={onLocateInCode}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-accent, #38bdf8)',
            }}
            className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition hover:opacity-80 font-medium"
            title="在 XML 源码中定位并高亮此图元"
            aria-label="定位代码"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">定位代码</span>
          </button>

          <button
            onClick={() => onMoveLayer('front')}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="p-1.5 rounded border text-[11px] transition hover:opacity-80"
            title="置顶图层 (移到最上方)"
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onMoveLayer('back')}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="p-1.5 rounded border text-[11px] transition hover:opacity-80"
            title="置底图层 (移到最下方)"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyXml}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="p-1.5 rounded border text-[11px] transition hover:opacity-80"
            title="复制图元 XML 代码"
          >
            {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onDelete}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#f87171',
            }}
            className="p-1.5 rounded border text-[11px] transition hover:opacity-80"
            title="删除此图元 (快捷键 Delete)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
