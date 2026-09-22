/**
 * SVG 图元样式控制面板 (SvgInspectorStyleControls)
 * 包含：填充、描边、线粗、虚线、线端帽、拐角连接、端点标记、不透明度
 */
import React from 'react';
import { ArrowRight } from 'lucide-react';

export const PRESET_COLORS = [
  { name: 'None', value: 'none', bg: 'bg-transparent border border-red-500/50' },
  { name: 'White', value: '#ffffff', bg: 'bg-white' },
  { name: 'Black', value: '#000000', bg: 'bg-black' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Red', value: '#ef4444', bg: 'bg-red-500' },
  { name: 'Emerald', value: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Amber', value: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Purple', value: '#8b5cf6', bg: 'bg-purple-500' },
  { name: 'Cyan', value: '#06b6d4', bg: 'bg-cyan-500' },
];

export interface SvgInspectorStyleControlsProps {
  fill: string;
  onFillChange: (val: string) => void;
  stroke: string;
  onStrokeChange: (val: string) => void;
  strokeWidth: string;
  onStrokeWidthChange: (val: string) => void;
  strokeDasharray: string;
  onStrokeDasharrayChange: (val: string) => void;
  strokeLinecap: string;
  onStrokeLinecapChange: (val: string) => void;
  strokeLinejoin: string;
  onStrokeLinejoinChange: (val: string) => void;
  markerStart: string;
  onMarkerStartChange: (val: string) => void;
  markerEnd: string;
  onMarkerEndChange: (val: string) => void;
  opacity: string;
  onOpacityChange: (val: string) => void;
}

export const SvgInspectorStyleControls: React.FC<SvgInspectorStyleControlsProps> = ({
  fill,
  onFillChange,
  stroke,
  onStrokeChange,
  strokeWidth,
  onStrokeWidthChange,
  strokeDasharray,
  onStrokeDasharrayChange,
  strokeLinecap,
  onStrokeLinecapChange,
  strokeLinejoin,
  onStrokeLinejoinChange,
  markerStart,
  onMarkerStartChange,
  markerEnd,
  onMarkerEndChange,
  opacity,
  onOpacityChange,
}) => {
  return (
    <>
      {/* 填充色 (Fill) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--ov-text)' }} className="font-medium">填充颜色 (Fill)</span>
          <span style={{ color: 'var(--ov-text-secondary)' }} className="font-mono text-[10px]">{fill}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={fill.startsWith('#') ? fill : '#3b82f6'}
            onChange={e => onFillChange(e.target.value)}
            style={{ borderColor: 'var(--ov-border)' }}
            className="w-7 h-7 rounded border bg-transparent cursor-pointer overflow-hidden p-0"
            title="选择填充颜色"
          />
          <input
            type="text"
            value={fill}
            onChange={e => onFillChange(e.target.value)}
            placeholder="none / #hex"
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex-1 px-2 py-1 border rounded text-xs font-mono outline-none focus:border-blue-500"
          />
          <button
            onClick={() => onFillChange('none')}
            style={{
              backgroundColor: fill === 'none' ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: fill === 'none' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="px-2 py-1 rounded text-[10px] border transition"
          >
            无填充
          </button>
        </div>

        {/* 预设快捷色板 */}
        <div className="flex items-center gap-1.5 pt-1">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => onFillChange(c.value)}
              className={`w-4 h-4 rounded-full ${c.bg} transition hover:scale-125 relative flex items-center justify-center`}
              title={c.name}
            >
              {c.value === 'none' && <span className="text-[10px] text-red-500 leading-none">/</span>}
              {fill.toLowerCase() === c.value.toLowerCase() && (
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-sm" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 描边色 (Stroke) */}
      <div style={{ borderTopColor: 'var(--ov-border)' }} className="space-y-1.5 pt-1 border-t">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--ov-text)' }} className="font-medium">描边颜色 (Stroke)</span>
          <span style={{ color: 'var(--ov-text-secondary)' }} className="font-mono text-[10px]">{stroke}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={stroke.startsWith('#') ? stroke : '#ffffff'}
            onChange={e => onStrokeChange(e.target.value)}
            style={{ borderColor: 'var(--ov-border)' }}
            className="w-7 h-7 rounded border bg-transparent cursor-pointer overflow-hidden p-0"
            title="选择描边颜色"
          />
          <input
            type="text"
            value={stroke}
            onChange={e => onStrokeChange(e.target.value)}
            placeholder="none / #hex"
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex-1 px-2 py-1 border rounded text-xs font-mono outline-none focus:border-blue-500"
          />
          <button
            onClick={() => onStrokeChange('none')}
            style={{
              backgroundColor: stroke === 'none' ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: stroke === 'none' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="px-2 py-1 rounded text-[10px] border transition"
          >
            无描边
          </button>
        </div>
      </div>

      {/* 描边粗细 (Stroke Width) */}
      <div style={{ borderTopColor: 'var(--ov-border)' }} className="space-y-1 pt-1 border-t">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--ov-text)' }} className="font-medium">描边粗细 (Stroke Width)</span>
          <span className="font-mono text-cyan-400 text-[11px]">{strokeWidth}px</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={parseFloat(strokeWidth) || 0}
            onChange={e => onStrokeWidthChange(e.target.value)}
            className="flex-1 accent-cyan-400 cursor-pointer h-1.5 rounded-lg"
          />
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={strokeWidth}
            onChange={e => onStrokeWidthChange(e.target.value)}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="w-14 px-1.5 py-0.5 border rounded text-xs font-mono text-center outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 虚线与线型样式 (Stroke Dasharray) */}
      <div style={{ borderTopColor: 'var(--ov-border)' }} className="space-y-1.5 pt-1.5 border-t">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--ov-text)' }} className="font-medium">线型样式 (Dasharray)</span>
          <span style={{ color: 'var(--ov-text-secondary)' }} className="font-mono text-[10px]">{strokeDasharray || '实线'}</span>
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px]">
          <button
            onClick={() => onStrokeDasharrayChange('')}
            style={{
              backgroundColor: !strokeDasharray ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: !strokeDasharray ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="py-1 px-1.5 rounded border transition text-center font-medium"
          >
            实线
          </button>
          <button
            onClick={() => onStrokeDasharrayChange('6,4')}
            style={{
              backgroundColor: strokeDasharray === '6,4' ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: strokeDasharray === '6,4' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="py-1 px-1.5 rounded border transition text-center font-medium"
          >
            虚线 6,4
          </button>
          <button
            onClick={() => onStrokeDasharrayChange('2,3')}
            style={{
              backgroundColor: strokeDasharray === '2,3' ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: strokeDasharray === '2,3' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="py-1 px-1.5 rounded border transition text-center font-medium"
          >
            点线 2,3
          </button>
          <button
            onClick={() => onStrokeDasharrayChange('10,4,2,4')}
            style={{
              backgroundColor: strokeDasharray === '10,4,2,4' ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: strokeDasharray === '10,4,2,4' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="py-1 px-1.5 rounded border transition text-center font-medium"
          >
            点划线
          </button>
        </div>

        <input
          type="text"
          value={strokeDasharray}
          onChange={e => onStrokeDasharrayChange(e.target.value)}
          placeholder="自定义虚线序列 (如 8,4 或 12,3,3,3)"
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
          className="w-full px-2 py-1 border rounded text-xs font-mono outline-none focus:border-cyan-500"
        />
      </div>

      {/* 线端帽与拐角连接 (Line Cap & Line Join) */}
      <div style={{ borderTopColor: 'var(--ov-border)' }} className="grid grid-cols-2 gap-2 pt-1.5 border-t">
        <div className="space-y-1">
          <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px] font-medium">线端帽 (Cap)</span>
          <div style={{ borderColor: 'var(--ov-border)' }} className="flex rounded border overflow-hidden text-[10px]">
            {[
              { id: 'butt', label: '平齐' },
              { id: 'round', label: '圆头' },
              { id: 'square', label: '方头' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => onStrokeLinecapChange(item.id)}
                style={{
                  backgroundColor: strokeLinecap === item.id ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
                  color: strokeLinecap === item.id ? '#ffffff' : 'var(--ov-text-secondary)',
                }}
                className="flex-1 py-1 text-center transition font-medium"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px] font-medium">拐角连接 (Join)</span>
          <div style={{ borderColor: 'var(--ov-border)' }} className="flex rounded border overflow-hidden text-[10px]">
            {[
              { id: 'miter', label: '尖角' },
              { id: 'round', label: '圆角' },
              { id: 'bevel', label: '斜切' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => onStrokeLinejoinChange(item.id)}
                style={{
                  backgroundColor: strokeLinejoin === item.id ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-surface-header)',
                  color: strokeLinejoin === item.id ? '#ffffff' : 'var(--ov-text-secondary)',
                }}
                className="flex-1 py-1 text-center transition font-medium"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 端点箭头与标记 (Markers) */}
      <div style={{ borderTopColor: 'var(--ov-border)' }} className="space-y-1.5 pt-1.5 border-t">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--ov-text)' }} className="font-medium flex items-center gap-1">
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>端点箭头与标记 (Markers)</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="space-y-1">
            <span style={{ color: 'var(--ov-text-secondary)' }}>起点端点 (Start)</span>
            <select
              value={markerStart}
              onChange={e => onMarkerStartChange(e.target.value)}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-full p-1 border rounded text-[11px] outline-none focus:border-cyan-500"
            >
              <option value="">无 (none)</option>
              <option value="url(#omni-arrow-start)">反向箭头 (←)</option>
              <option value="url(#omni-circle-start)">起点圆点 (●)</option>
              <option value="url(#omni-dimension-start)">尺寸刻度 (│)</option>
            </select>
          </div>

          <div className="space-y-1">
            <span style={{ color: 'var(--ov-text-secondary)' }}>终点端点 (End)</span>
            <select
              value={markerEnd}
              onChange={e => onMarkerEndChange(e.target.value)}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-full p-1 border rounded text-[11px] outline-none focus:border-cyan-500"
            >
              <option value="">无 (none)</option>
              <option value="url(#omni-arrow-end)">标准箭头 (→)</option>
              <option value="url(#omni-stealth-end)">掠翼箭头 (➤)</option>
              <option value="url(#omni-circle-end)">终点圆点 (●)</option>
              <option value="url(#omni-dimension-end)">尺寸刻度 (│)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 不透明度 (Opacity) */}
      <div style={{ borderTopColor: 'var(--ov-border)' }} className="space-y-1 pt-1 border-t">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--ov-text)' }} className="font-medium">不透明度 (Opacity)</span>
          <span className="font-mono text-cyan-400 text-[11px]">
            {Math.round((parseFloat(opacity) || 1) * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={parseFloat(opacity) || 1}
            onChange={e => onOpacityChange(e.target.value)}
            className="flex-1 accent-cyan-400 cursor-pointer h-1.5 rounded-lg"
          />
        </div>
      </div>
    </>
  );
};
