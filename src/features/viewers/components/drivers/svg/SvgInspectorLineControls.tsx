/**
 * SVG 线条专属几何特征、极坐标、正交化与折线转换面板 (SvgInspectorLineControls)
 */
import React from 'react';
import {
  Move,
  ArrowLeftRight,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import {
  LinePresetType,
  LineMetrics,
} from './svgUtils';

export interface SvgInspectorLineControlsProps {
  lineMetrics: LineMetrics;
  lineX1: string;
  setLineX1: (val: string) => void;
  lineY1: string;
  setLineY1: (val: string) => void;
  lineX2: string;
  setLineX2: (val: string) => void;
  lineY2: string;
  setLineY2: (val: string) => void;
  onUpdateLineAngleOrLength: (targetLen: number, targetAngle: number) => void;
  onCoordCommit: (key: 'x1' | 'y1' | 'x2' | 'y2', val: string) => void;
  onAlignLine?: (mode: 'horizontal' | 'vertical') => void;
  onReverseLine?: () => void;
  onConvertToStepLine?: (mode: 'hv' | 'vh') => void;
  onApplyLinePreset?: (preset: LinePresetType) => void;
  onConvertToCurve?: (curvatureHeight?: number) => void;
  onStraighten?: () => void;
  isCurved?: boolean;
}

export const SvgInspectorLineControls: React.FC<SvgInspectorLineControlsProps> = ({
  lineMetrics,
  lineX1,
  setLineX1,
  lineY1,
  setLineY1,
  lineX2,
  setLineX2,
  lineY2,
  setLineY2,
  onUpdateLineAngleOrLength,
  onCoordCommit,
  onAlignLine,
  onReverseLine,
  onConvertToStepLine,
  onApplyLinePreset,
  onConvertToCurve,
  onStraighten,
  isCurved = false,
}) => {
  const [curvatureVal, setCurvatureVal] = React.useState<number>(30);

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface-header)',
        borderColor: 'var(--ov-border)',
      }}
      className="space-y-2.5 p-2.5 rounded-lg border shadow-sm"
    >
      {/* 顶部指示与状态胶囊 */}
      <div className="flex items-center justify-between text-cyan-400 font-medium text-[11px]">
        <div className="flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-cyan-400" />
          <span>线条几何与方向工程</span>
        </div>
        <span
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
          }}
          className="text-[10px] px-1.5 py-0.5 rounded border text-cyan-400 font-mono"
        >
          {lineMetrics.slopeType === 'horizontal' && '水平 (0°)'}
          {lineMetrics.slopeType === 'vertical' && '垂直 (90°)'}
          {lineMetrics.slopeType === 'diagonal-45' && '45° 斜角'}
          {lineMetrics.slopeType === 'diagonal-135' && '135° 斜角'}
          {lineMetrics.slopeType === 'arbitrary' && `${lineMetrics.angleDeg}° 任意角度`}
        </span>
      </div>

      {/* 实时几何指标卡片 (长度与极角) */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
        }}
        className="grid grid-cols-2 gap-2 p-2 rounded border text-[11px] font-mono"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: 'var(--ov-text-secondary)' }}>长度 (px)</span>
            <span className="text-cyan-400 font-bold">{lineMetrics.length}</span>
          </div>
          <input
            type="number"
            min="1"
            step="1"
            value={lineMetrics.length}
            onChange={e => {
              const newLen = parseFloat(e.target.value) || 1;
              onUpdateLineAngleOrLength(newLen, lineMetrics.angleDeg);
            }}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="w-full p-1 border rounded text-center text-xs outline-none focus:border-cyan-400"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: 'var(--ov-text-secondary)' }}>极角 (°)</span>
            <span className="text-cyan-400 font-bold">{lineMetrics.angleDeg}°</span>
          </div>
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            value={lineMetrics.angleDeg}
            onChange={e => {
              const newAngle = parseFloat(e.target.value) || 0;
              onUpdateLineAngleOrLength(lineMetrics.length, newAngle);
            }}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="w-full p-1 border rounded text-center text-xs outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* 常用角度快捷点选 (0°, 45°, 90°, 135°, 180°, 270°) 及 Inkscape 15° 步进微调 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: 'var(--ov-text-secondary)' }} className="font-medium">
            角度校准与 15° 步进 (Inkscape)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const next = (Math.round((lineMetrics.angleDeg - 15) / 15) * 15 + 360) % 360;
                onUpdateLineAngleOrLength(lineMetrics.length, next);
              }}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="px-1.5 py-0.5 rounded border text-[9px] hover:border-cyan-400 cursor-pointer font-mono"
              title="按 15° 步进逆时针微调"
            >
              -15°
            </button>
            <button
              type="button"
              onClick={() => {
                const next = (Math.round((lineMetrics.angleDeg + 15) / 15) * 15 + 360) % 360;
                onUpdateLineAngleOrLength(lineMetrics.length, next);
              }}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="px-1.5 py-0.5 rounded border text-[9px] hover:border-cyan-400 cursor-pointer font-mono"
              title="按 15° 步进顺时针微调"
            >
              +15°
            </button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {[
            { label: '0°', val: 0, title: '水平向右 (0°)' },
            { label: '45°', val: 45, title: '下斜 45°' },
            { label: '90°', val: 90, title: '垂直向下 (90°)' },
            { label: '135°', val: 135, title: '下钝角 135°' },
            { label: '180°', val: 180, title: '水平向左 (180°)' },
            { label: '270°', val: 270, title: '垂直向上 (270°)' },
          ].map(item => (
            <button
              key={item.val}
              onClick={() => onUpdateLineAngleOrLength(lineMetrics.length, item.val)}
              style={{
                backgroundColor:
                  Math.abs(lineMetrics.angleDeg - item.val) < 0.5
                    ? 'var(--ov-accent, #3b82f6)'
                    : 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: Math.abs(lineMetrics.angleDeg - item.val) < 0.5 ? '#ffffff' : 'var(--ov-text)',
              }}
              className="py-1 rounded text-[10px] font-mono transition border hover:opacity-80 cursor-pointer"
              title={item.title}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inkscape 风格：曲率弧度与贝塞尔曲线转换 */}
      <div
        style={{
          borderTopColor: 'var(--ov-border)',
        }}
        className="space-y-1.5 pt-1 border-t"
      >
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: 'var(--ov-text-secondary)' }} className="font-medium flex items-center gap-1">
            <span>∿ 弧度曲率工程</span>
            <span className="text-emerald-400 font-mono">({curvatureVal}px)</span>
          </span>
          {isCurved ? (
            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
              已是贝塞尔曲线
            </span>
          ) : (
            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-700/50 text-slate-400 font-mono">
              直线
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            value={curvatureVal}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              setCurvatureVal(val);
              if (onConvertToCurve) {
                onConvertToCurve(val);
              }
            }}
            className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <button
            type="button"
            onClick={() => {
              setCurvatureVal(0);
              if (onStraighten) onStraighten();
            }}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="px-1.5 py-0.5 rounded border text-[9px] hover:border-blue-400 cursor-pointer whitespace-nowrap"
            title="拉直回标准直线 (Curvature = 0)"
          >
            拉直 (0)
          </button>
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          {onConvertToCurve && !isCurved && (
            <button
              type="button"
              onClick={() => onConvertToCurve(curvatureVal || 30)}
              className="flex-1 py-1 px-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
              title="转换为带可调弧度的二次贝塞尔曲线"
            >
              <span>∿ 转为贝塞尔弧线</span>
            </button>
          )}

          {onStraighten && isCurved && (
            <button
              type="button"
              onClick={onStraighten}
              className="flex-1 py-1 px-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[10px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
              title="将曲线一键拉直为标准直线"
            >
              <span>━ 拉直回标准直线</span>
            </button>
          )}
        </div>
      </div>


      {/* 一键正交化与高级拓扑转换 */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          {onAlignLine && (
            <>
              <button
                onClick={() => onAlignLine('horizontal')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="flex-1 py-1 px-1.5 rounded border text-[10px] font-medium transition flex items-center justify-center gap-1 hover:opacity-80"
                title="快速正交化为绝对水平直线 (0°)"
              >
                <span>📐 水平正交</span>
              </button>
              <button
                onClick={() => onAlignLine('vertical')}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="flex-1 py-1 px-1.5 rounded border text-[10px] font-medium transition flex items-center justify-center gap-1 hover:opacity-80"
                title="快速正交化为绝对垂直直线 (90°)"
              >
                <span>📐 垂直正交</span>
              </button>
            </>
          )}

          {onReverseLine && (
            <button
              onClick={onReverseLine}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="py-1 px-2 rounded border text-[10px] font-medium transition flex items-center gap-1 hover:opacity-80"
              title="互换起止点 (P1 ⇄ P2) 并反转箭头标记"
            >
              <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
              <span>反转方向</span>
            </button>
          )}
        </div>

        {/* 折线转换 */}
        {onConvertToStepLine && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onConvertToStepLine('hv')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex-1 py-1 px-1.5 rounded border text-[10px] font-medium transition flex items-center justify-center gap-1 hover:opacity-80"
              title="转为水平-垂直正交阶梯折线 (HV Path)"
            >
              <CornerDownRight className="w-3 h-3 text-blue-400" />
              <span>转 HV 阶梯线</span>
            </button>
            <button
              onClick={() => onConvertToStepLine('vh')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex-1 py-1 px-1.5 rounded border text-[10px] font-medium transition flex items-center justify-center gap-1 hover:opacity-80"
              title="转为垂直-水平正交阶梯折线 (VH Path)"
            >
              <CornerDownRight className="w-3 h-3 text-cyan-400 rotate-90" />
              <span>转 VH 阶梯线</span>
            </button>
          </div>
        )}
      </div>

      {/* 端点坐标精确定位 */}
      <div
        style={{ borderTopColor: 'var(--ov-border)' }}
        className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] border-t"
      >
        <div className="space-y-1">
          <span className="text-blue-400 text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            <span>起点 P1 (x1, y1)</span>
          </span>
          <div className="flex gap-1">
            <input
              type="number"
              value={lineX1}
              onChange={e => setLineX1(e.target.value)}
              onBlur={e => onCoordCommit('x1', e.target.value)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-1/2 p-1 border rounded text-center outline-none focus:border-cyan-500 text-xs"
              placeholder="x1"
            />
            <input
              type="number"
              value={lineY1}
              onChange={e => setLineY1(e.target.value)}
              onBlur={e => onCoordCommit('y1', e.target.value)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-1/2 p-1 border rounded text-center outline-none focus:border-cyan-500 text-xs"
              placeholder="y1"
            />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-cyan-400 text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            <span>终点 P2 (x2, y2)</span>
          </span>
          <div className="flex gap-1">
            <input
              type="number"
              value={lineX2}
              onChange={e => setLineX2(e.target.value)}
              onBlur={e => onCoordCommit('x2', e.target.value)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-1/2 p-1 border rounded text-center outline-none focus:border-cyan-500 text-xs"
              placeholder="x2"
            />
            <input
              type="number"
              value={lineY2}
              onChange={e => setLineY2(e.target.value)}
              onBlur={e => onCoordCommit('y2', e.target.value)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-1/2 p-1 border rounded text-center outline-none focus:border-cyan-500 text-xs"
              placeholder="y2"
            />
          </div>
        </div>
      </div>

      {/* 工业线条工程预设快捷应用 */}
      {onApplyLinePreset && (
        <div
          style={{ borderTopColor: 'var(--ov-border)' }}
          className="space-y-1 pt-1 border-t"
        >
          <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px] font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>一键工程风格预设</span>
          </span>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <button
              onClick={() => onApplyLinePreset('solid')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80"
              title="标准实线"
            >
              实线
            </button>
            <button
              onClick={() => onApplyLinePreset('dashed')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80"
              title="工程虚线 (6,4)"
            >
              虚线
            </button>
            <button
              onClick={() => onApplyLinePreset('dotted')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80"
              title="紧凑点线 (2,3)"
            >
              点线
            </button>
            <button
              onClick={() => onApplyLinePreset('dash-dot')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80"
              title="长短点划线 (10,4,2,4)"
            >
              点划线
            </button>
            <button
              onClick={() => onApplyLinePreset('flow-arrow')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-accent, #38bdf8)',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80 font-medium"
              title="流程箭头线"
            >
              流程箭头
            </button>
            <button
              onClick={() => onApplyLinePreset('bidirectional')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-accent, #38bdf8)',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80 font-medium"
              title="双向指示线"
            >
              双向指示
            </button>
            <button
              onClick={() => onApplyLinePreset('dimension')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: '#fbbf24',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80 font-medium"
              title="尺寸标注线"
            >
              尺寸标注
            </button>
            <button
              onClick={() => onApplyLinePreset('flowing-glow')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: '#c084fc',
              }}
              className="py-1 px-1 rounded border transition text-center hover:opacity-80 font-medium"
              title="动态流光虚线"
            >
              流光动效
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
