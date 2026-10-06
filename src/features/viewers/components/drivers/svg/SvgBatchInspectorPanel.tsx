/**
 * OmniView SVG 多图元批量属性检视与微调面板 (SVG Multi-Element Batch Inspector Panel)
 * 专责多选生态下的联合对齐、等距分布、外观批量设置与一键编组/解组
 */
import React, { useState } from 'react';
import {
  X,
  Trash2,
  Layers,
  Group,
  Ungroup,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sliders,
  Palette,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { ElementBBox, SvgElementInfo } from './svgUtils';
import { PRESET_COLORS } from './SvgInspectorStyleControls';

export interface SvgBatchInspectorPanelProps {
  selectedCount: number;
  unionBBox: ElementBBox | null;
  onBatchAlign: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onBatchDistribute: (direction: 'horizontal' | 'vertical') => void;
  onBatchUpdateStyle: (updates: Partial<SvgElementInfo>) => void;
  onBatchDelete: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onClose: () => void;
}

export const SvgBatchInspectorPanel: React.FC<SvgBatchInspectorPanelProps> = ({
  selectedCount,
  unionBBox,
  onBatchAlign,
  onBatchDistribute,
  onBatchUpdateStyle,
  onBatchDelete,
  onGroup,
  onUngroup,
  onClose,
}) => {
  const [selectedFill, setSelectedFill] = useState<string>('');
  const [selectedStroke, setSelectedStroke] = useState<string>('');
  const [strokeWidth, setStrokeWidth] = useState<string>('2');
  const [opacity, setOpacity] = useState<number>(100);

  const handleApplyFill = (color: string) => {
    setSelectedFill(color);
    onBatchUpdateStyle({ fill: color });
  };

  const handleApplyStroke = (color: string) => {
    setSelectedStroke(color);
    onBatchUpdateStyle({ stroke: color });
  };

  const handleApplyStrokeWidth = (width: string) => {
    setStrokeWidth(width);
    onBatchUpdateStyle({ strokeWidth: width });
  };

  const handleApplyOpacity = (val: number) => {
    setOpacity(val);
    onBatchUpdateStyle({ opacity: String(Math.round((val / 100) * 100) / 100) });
  };

  return (
    <div
      id="svg-batch-inspector-panel"
      data-canvas-ui="true"
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="absolute top-4 right-4 z-40 w-80 max-h-[85vh] flex flex-col rounded-xl border shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200"
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* 头部：多选指示与操作 */}
      <div
        style={{ borderColor: 'var(--ov-border)' }}
        className="flex items-center justify-between px-3.5 py-2.5 border-b select-none bg-blue-500/10"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-500/20 text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-xs">
              <span>多选批处理</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-blue-600 text-white">
                {selectedCount} 个图元
              </span>
            </div>
            {unionBBox && (
              <div className="text-[10px] text-slate-400 font-mono">
                联合尺寸: {Math.round(unionBBox.width)} × {Math.round(unionBBox.height)} px
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          title="取消多选 (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
        {/* 卡片 1: 联合对齐与分布 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-alt, rgba(0,0,0,0.15))',
            borderColor: 'var(--ov-border)',
          }}
          className="p-2.5 rounded-lg border space-y-2"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              联合对齐 (Align)
            </span>
          </div>

          {/* 水平与垂直对齐 */}
          <div className="grid grid-cols-6 gap-1">
            <button
              onClick={() => onBatchAlign('left')}
              className="p-1.5 rounded flex items-center justify-center border border-slate-700 hover:bg-blue-600 hover:border-blue-500 text-slate-300 hover:text-white transition-colors"
              title="多图元左对齐"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onBatchAlign('center')}
              className="p-1.5 rounded flex items-center justify-center border border-slate-700 hover:bg-blue-600 hover:border-blue-500 text-slate-300 hover:text-white transition-colors"
              title="多图元水平居中"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onBatchAlign('right')}
              className="p-1.5 rounded flex items-center justify-center border border-slate-700 hover:bg-blue-600 hover:border-blue-500 text-slate-300 hover:text-white transition-colors"
              title="多图元右对齐"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onBatchAlign('top')}
              className="p-1.5 rounded flex items-center justify-center border border-slate-700 hover:bg-blue-600 hover:border-blue-500 text-slate-300 hover:text-white transition-colors rotate-90"
              title="多图元顶对齐"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onBatchAlign('middle')}
              className="p-1.5 rounded flex items-center justify-center border border-slate-700 hover:bg-blue-600 hover:border-blue-500 text-slate-300 hover:text-white transition-colors rotate-90"
              title="多图元垂直居中"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onBatchAlign('bottom')}
              className="p-1.5 rounded flex items-center justify-center border border-slate-700 hover:bg-blue-600 hover:border-blue-500 text-slate-300 hover:text-white transition-colors rotate-90"
              title="多图元底对齐"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 联合等距分布 */}
          {selectedCount >= 3 && (
            <div className="pt-1 border-t border-slate-700/50 flex items-center justify-between gap-1.5">
              <span className="text-[10px] text-slate-400">等间距分布:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onBatchDistribute('horizontal')}
                  className="px-2 py-0.5 rounded text-[10px] border border-slate-700 hover:border-blue-500 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                  title="在首尾元素之间水平等距排列中间图元"
                >
                  水平等距
                </button>
                <button
                  onClick={() => onBatchDistribute('vertical')}
                  className="px-2 py-0.5 rounded text-[10px] border border-slate-700 hover:border-blue-500 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                  title="在首尾元素之间垂直等距排列中间图元"
                >
                  垂直等距
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 卡片 2: 批量外观与样式 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-alt, rgba(0,0,0,0.15))',
            borderColor: 'var(--ov-border)',
          }}
          className="p-2.5 rounded-lg border space-y-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-blue-400" />
              统一外观样式 (Batch Styles)
            </span>
          </div>

          {/* 批量填充色 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>批量填充 (Fill)</span>
              <span className="font-mono text-slate-500">{selectedFill || '保留各自原色'}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => handleApplyFill(c.value)}
                  className={`w-5 h-5 rounded-sm ${c.bg} border border-slate-600/70 hover:scale-115 active:scale-95 transition-transform`}
                  title={`统一填充为 ${c.name}`}
                />
              ))}
              <input
                type="color"
                value={selectedFill.startsWith('#') ? selectedFill : '#3b82f6'}
                onChange={e => handleApplyFill(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                title="自定义批量填充色"
              />
            </div>
          </div>

          {/* 批量描边色 */}
          <div className="space-y-1 pt-1.5 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>批量描边 (Stroke)</span>
              <span className="font-mono text-slate-500">{selectedStroke || '保留各自原色'}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => handleApplyStroke(c.value)}
                  className={`w-5 h-5 rounded-sm ${c.bg} border border-slate-600/70 hover:scale-115 active:scale-95 transition-transform`}
                  title={`统一描边为 ${c.name}`}
                />
              ))}
              <input
                type="color"
                value={selectedStroke.startsWith('#') ? selectedStroke : '#000000'}
                onChange={e => handleApplyStroke(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                title="自定义批量描边色"
              />
            </div>
          </div>

          {/* 批量描边粗细 */}
          <div className="space-y-1 pt-1.5 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>描边粗细 (Stroke Width)</span>
              <span className="font-mono">{strokeWidth}px</span>
            </div>
            <div className="flex items-center gap-1">
              {['1', '2', '3', '4', '6', '8'].map(w => (
                <button
                  key={w}
                  onClick={() => handleApplyStrokeWidth(w)}
                  className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                    strokeWidth === w
                      ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                      : 'border-slate-700 hover:border-slate-600 text-slate-300'
                  } transition-colors`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* 批量透明度 */}
          <div className="space-y-1 pt-1.5 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>整体透明度 (Opacity)</span>
              <span className="font-mono">{opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={e => handleApplyOpacity(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* 卡片 3: 编组、解组与图层操作 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-alt, rgba(0,0,0,0.15))',
            borderColor: 'var(--ov-border)',
          }}
          className="p-2.5 rounded-lg border space-y-2"
        >
          <div className="text-[11px] font-semibold text-slate-300">编组与图层编排</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onGroup}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium transition-colors"
              title="将选中的多个图元编入一个 <g> 容器 (Ctrl+G)"
            >
              <Group className="w-3.5 h-3.5" />
              <span>一键编组</span>
              <span className="text-[9px] opacity-60">Ctrl+G</span>
            </button>
            <button
              onClick={onUngroup}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
              title="解散已包含的编组 (Ctrl+Shift+G)"
            >
              <Ungroup className="w-3.5 h-3.5" />
              <span>拆分解组</span>
              <span className="text-[9px] opacity-60">⇧Ctrl+G</span>
            </button>
          </div>
        </div>
      </div>

      {/* 底部：批量删除按钮 */}
      <div
        style={{ borderColor: 'var(--ov-border)' }}
        className="px-3 py-2 border-t bg-slate-900/30 flex items-center justify-between"
      >
        <span className="text-[10px] text-slate-500">提示: 按 Delete 键可一键批量删除</span>
        <button
          onClick={onBatchDelete}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-medium transition-colors"
          title="批量删除所有选中的图元 (Delete / Backspace)"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>批量删除 ({selectedCount})</span>
        </button>
      </div>
    </div>
  );
};
