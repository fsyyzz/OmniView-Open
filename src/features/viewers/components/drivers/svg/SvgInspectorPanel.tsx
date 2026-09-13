/**
 * OmniView SVG 图元属性检视与微调面板 (SVG Element Inspector Panel)
 */
import React, { useState, useEffect } from 'react';
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
  AlignJustify,
  Magnet,
  Compass,
  Move,
  CornerDownRight,
  ArrowRight,
  ArrowLeftRight,
  Sparkles,
  Sliders,
  RotateCcw,
  Minimize2,
  Spline,
} from 'lucide-react';
import {
  SvgElementInfo,
  ElementBBox,
  LinePresetType,
  calculateLineMetrics,
  updateLineByLengthAndAngle,
} from './svgUtils';

interface SvgInspectorPanelProps {
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
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  onClose: () => void;
}

const PRESET_COLORS = [
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
  snapEnabled = true,
  onToggleSnap,
  onClose,
}) => {
  const [copiedXml, setCopiedXml] = useState(false);

  // 本地缓冲状态
  const [fill, setFill] = useState(element.fill || 'currentColor');
  const [stroke, setStroke] = useState(element.stroke || 'none');
  const [strokeWidth, setStrokeWidth] = useState(element.strokeWidth || '1');
  const [strokeDasharray, setStrokeDasharray] = useState(element.strokeDasharray || '');
  const [strokeLinecap, setStrokeLinecap] = useState(element.strokeLinecap || 'round');
  const [strokeLinejoin, setStrokeLinejoin] = useState(element.strokeLinejoin || 'round');
  const [markerStart, setMarkerStart] = useState(element.markerStart || '');
  const [markerEnd, setMarkerEnd] = useState(element.markerEnd || '');
  const [opacity, setOpacity] = useState(element.opacity || '1');
  const [textContent, setTextContent] = useState(element.textContent || '');

  // 几何坐标输入缓冲
  const [xVal, setXVal] = useState(element.x ?? element.cx ?? '');
  const [yVal, setYVal] = useState(element.y ?? element.cy ?? '');
  const [lineX1, setLineX1] = useState(element.x1 || '');
  const [lineY1, setLineY1] = useState(element.y1 || '');
  const [lineX2, setLineX2] = useState(element.x2 || '');
  const [lineY2, setLineY2] = useState(element.y2 || '');

  // 当外部选中的元素发生变化时，同步本地状态
  useEffect(() => {
    setFill(element.fill || 'currentColor');
    setStroke(element.stroke || 'none');
    setStrokeWidth(element.strokeWidth || '1');
    setStrokeDasharray(element.strokeDasharray || '');
    setStrokeLinecap(element.strokeLinecap || 'round');
    setStrokeLinejoin(element.strokeLinejoin || 'round');
    setMarkerStart(element.markerStart || '');
    setMarkerEnd(element.markerEnd || '');
    setOpacity(element.opacity || '1');
    setTextContent(element.textContent || '');
    setXVal(element.x ?? element.cx ?? '');
    setYVal(element.y ?? element.cy ?? '');
    setLineX1(element.x1 || '');
    setLineY1(element.y1 || '');
    setLineX2(element.x2 || '');
    setLineY2(element.y2 || '');
  }, [element]);

  // 复制当前图元 XML
  const handleCopyXml = () => {
    if (element.outerXml) {
      navigator.clipboard.writeText(element.outerXml);
      setCopiedXml(true);
      setTimeout(() => setCopiedXml(false), 2000);
    }
  };

  const handleFillChange = (val: string) => {
    setFill(val);
    onUpdate({ fill: val });
  };

  const handleStrokeChange = (val: string) => {
    setStroke(val);
    onUpdate({ stroke: val });
  };

  const handleStrokeWidthChange = (val: string) => {
    setStrokeWidth(val);
    onUpdate({ strokeWidth: val });
  };

  const handleStrokeDasharrayChange = (val: string) => {
    setStrokeDasharray(val);
    onUpdate({ strokeDasharray: val });
  };

  const handleStrokeLinecapChange = (val: string) => {
    setStrokeLinecap(val);
    onUpdate({ strokeLinecap: val });
  };

  const handleStrokeLinejoinChange = (val: string) => {
    setStrokeLinejoin(val);
    onUpdate({ strokeLinejoin: val });
  };

  const handleMarkerStartChange = (val: string) => {
    setMarkerStart(val);
    onUpdate({ markerStart: val });
  };

  const handleMarkerEndChange = (val: string) => {
    setMarkerEnd(val);
    onUpdate({ markerEnd: val });
  };

  const handleOpacityChange = (val: string) => {
    setOpacity(val);
    onUpdate({ opacity: val });
  };

  const handleTextContentChange = (val: string) => {
    setTextContent(val);
    onUpdate({ textContent: val });
  };

  // 提交单坐标更新
  const handleCoordCommit = (key: 'x' | 'y' | 'cx' | 'cy' | 'x1' | 'y1' | 'x2' | 'y2', val: string) => {
    if (val.trim() === '') return;
    onUpdate({ [key]: val });
  };

  const isTextTag = element.tagName === 'text' || element.tagName === 'tspan';
  const isLineTag = element.tagName === 'line';

  // 极坐标与几何特征实时解算
  const lineMetrics = isLineTag
    ? calculateLineMetrics(
        { x: parseFloat(lineX1) || 0, y: parseFloat(lineY1) || 0 },
        { x: parseFloat(lineX2) || 0, y: parseFloat(lineY2) || 0 }
      )
    : null;

  // 根据长度和角度重算 P2 并同步
  const handleUpdateLineAngleOrLength = (targetLen: number, targetAngle: number) => {
    const p1 = { x: parseFloat(lineX1) || 0, y: parseFloat(lineY1) || 0 };
    const updated = updateLineByLengthAndAngle(p1, targetLen, targetAngle);
    setLineX2(String(updated.x2));
    setLineY2(String(updated.y2));
    onUpdate({ x2: String(updated.x2), y2: String(updated.y2) });
  };

  return (
    <div
      id="svg-inspector-panel"
      data-inspector-panel="true"
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      className="absolute top-3 right-3 z-30 w-80 max-h-[calc(100%-1.5rem)] flex flex-col bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl text-xs text-slate-200 select-none overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 border-b border-slate-700/80">
        <div className="flex items-center gap-2 truncate">
          <span className="px-1.5 py-0.5 rounded bg-blue-600/30 text-cyan-300 font-mono text-[11px] font-semibold border border-blue-500/40">
            &lt;{element.tagName}&gt;
          </span>
          {element.id ? (
            <span className="text-[11px] font-mono text-amber-300 truncate" title={`#${element.id}`}>
              #{element.id}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono">图元 #{element.index}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 吸附状态指示与切换 */}
          {onToggleSnap && (
            <button
              onClick={onToggleSnap}
              className={`p-1 rounded transition ${
                snapEnabled ? 'text-pink-400 bg-pink-950/60' : 'text-slate-400 hover:text-white'
              }`}
              title={`智能吸附: ${snapEnabled ? '已开启' : '已关闭'} (快捷键 S)`}
            >
              <Magnet className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
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
          <div className="space-y-1.5 bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <div className="flex items-center gap-1 font-medium">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>快速对齐到画布</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">画布视口参考</span>
            </div>
            <div className="grid grid-cols-6 gap-1 pt-1">
              <button
                onClick={() => onAlign('left')}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                title="靠左对齐"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAlign('center')}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                title="水平居中"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAlign('right')}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                title="靠右对齐"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAlign('top')}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition text-[10px] font-bold"
                title="靠顶对齐"
              >
                TOP
              </button>
              <button
                onClick={() => onAlign('middle')}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition text-[10px] font-bold"
                title="垂直居中"
              >
                MID
              </button>
              <button
                onClick={() => onAlign('bottom')}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition text-[10px] font-bold"
                title="靠底对齐"
              >
                BOT
              </button>
            </div>
          </div>
        )}

        {/* 线条专属几何特征、极坐标、正交化与折线转换 (Enhanced Line Controls) */}
        {isLineTag && lineMetrics && (
          <div className="space-y-2.5 bg-slate-800/70 p-2.5 rounded-lg border border-cyan-500/50 shadow-sm">
            {/* 顶部指示与状态胶囊 */}
            <div className="flex items-center justify-between text-cyan-300 font-medium text-[11px]">
              <div className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                <span>线条几何与方向工程</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono">
                {lineMetrics.slopeType === 'horizontal' && '水平 (0°)'}
                {lineMetrics.slopeType === 'vertical' && '垂直 (90°)'}
                {lineMetrics.slopeType === 'diagonal-45' && '45° 斜角'}
                {lineMetrics.slopeType === 'diagonal-135' && '135° 斜角'}
                {lineMetrics.slopeType === 'arbitrary' && `${lineMetrics.angleDeg}° 任意角度`}
              </span>
            </div>

            {/* 实时几何指标卡片 (长度与极角) */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-2 rounded border border-slate-700/60 text-[11px] font-mono">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>长度 (px)</span>
                  <span className="text-cyan-400 font-bold">{lineMetrics.length}</span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={lineMetrics.length}
                  onChange={e => {
                    const newLen = parseFloat(e.target.value) || 1;
                    handleUpdateLineAngleOrLength(newLen, lineMetrics.angleDeg);
                  }}
                  className="w-full p-1 bg-slate-900 border border-slate-700 rounded text-center text-slate-200 text-xs outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>极角 (°)</span>
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
                    handleUpdateLineAngleOrLength(lineMetrics.length, newAngle);
                  }}
                  className="w-full p-1 bg-slate-900 border border-slate-700 rounded text-center text-slate-200 text-xs outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* 常用角度快捷点选 (0°, 45°, 90°, 135°, 180°, 270°) */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium">快速校准方向与角度</span>
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
                    onClick={() => handleUpdateLineAngleOrLength(lineMetrics.length, item.val)}
                    className={`py-1 rounded text-[10px] font-mono transition border ${
                      Math.abs(lineMetrics.angleDeg - item.val) < 0.5
                        ? 'bg-cyan-600/40 text-cyan-200 border-cyan-400'
                        : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                    title={item.title}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 一键正交化与高级拓扑转换 */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-1.5">
                {onAlignLine && (
                  <>
                    <button
                      onClick={() => onAlignLine('horizontal')}
                      className="flex-1 py-1 px-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-[10px] font-medium transition flex items-center justify-center gap-1"
                      title="快速正交化为绝对水平直线 (0°)"
                    >
                      <span>📐 水平正交</span>
                    </button>
                    <button
                      onClick={() => onAlignLine('vertical')}
                      className="flex-1 py-1 px-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-[10px] font-medium transition flex items-center justify-center gap-1"
                      title="快速正交化为绝对垂直直线 (90°)"
                    >
                      <span>📐 垂直正交</span>
                    </button>
                  </>
                )}

                {onReverseLine && (
                  <button
                    onClick={onReverseLine}
                    className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-medium transition flex items-center gap-1"
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
                    className="flex-1 py-1 px-1.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-medium transition flex items-center justify-center gap-1"
                    title="转为水平-垂直正交阶梯折线 (HV Path)"
                  >
                    <CornerDownRight className="w-3 h-3 text-blue-400" />
                    <span>转 HV 阶梯线</span>
                  </button>
                  <button
                    onClick={() => onConvertToStepLine('vh')}
                    className="flex-1 py-1 px-1.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-medium transition flex items-center justify-center gap-1"
                    title="转为垂直-水平正交阶梯折线 (VH Path)"
                  >
                    <CornerDownRight className="w-3 h-3 text-cyan-400 rotate-90" />
                    <span>转 VH 阶梯线</span>
                  </button>
                </div>
              )}
            </div>

            {/* 端点坐标精确定位 */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] border-t border-slate-700/60">
              <div className="space-y-1">
                <span className="text-blue-300 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  <span>起点 P1 (x1, y1)</span>
                </span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={lineX1}
                    onChange={e => setLineX1(e.target.value)}
                    onBlur={e => handleCoordCommit('x1', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    placeholder="x1"
                  />
                  <input
                    type="number"
                    value={lineY1}
                    onChange={e => setLineY1(e.target.value)}
                    onBlur={e => handleCoordCommit('y1', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    placeholder="y1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-cyan-300 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                  <span>终点 P2 (x2, y2)</span>
                </span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={lineX2}
                    onChange={e => setLineX2(e.target.value)}
                    onBlur={e => handleCoordCommit('x2', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    placeholder="x2"
                  />
                  <input
                    type="number"
                    value={lineY2}
                    onChange={e => setLineY2(e.target.value)}
                    onBlur={e => handleCoordCommit('y2', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    placeholder="y2"
                  />
                </div>
              </div>
            </div>

            {/* 工业线条工程预设快捷应用 */}
            {onApplyLinePreset && (
              <div className="space-y-1 pt-1 border-t border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>一键工程风格预设</span>
                </span>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <button
                    onClick={() => onApplyLinePreset('solid')}
                    className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition text-center"
                    title="标准实线"
                  >
                    实线
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('dashed')}
                    className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition text-center"
                    title="工程虚线 (6,4)"
                  >
                    虚线
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('dotted')}
                    className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition text-center"
                    title="紧凑点线 (2,3)"
                  >
                    点线
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('dash-dot')}
                    className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition text-center"
                    title="长短点划线 (10,4,2,4)"
                  >
                    点划线
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('flow-arrow')}
                    className="py-1 px-1 rounded bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-200 transition text-center"
                    title="流程箭头线"
                  >
                    流程箭头
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('bidirectional')}
                    className="py-1 px-1 rounded bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-200 transition text-center"
                    title="双向指示线"
                  >
                    双向指示
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('dimension')}
                    className="py-1 px-1 rounded bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/50 text-amber-200 transition text-center"
                    title="尺寸标注线"
                  >
                    尺寸标注
                  </button>
                  <button
                    onClick={() => onApplyLinePreset('flowing-glow')}
                    className="py-1 px-1 rounded bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/50 text-purple-200 transition text-center"
                    title="动态流光虚线"
                  >
                    流光动效
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 文本节点内容直编 */}
        {isTextTag && (
          <div className="space-y-1.5 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
              <Type className="w-3.5 h-3.5 text-cyan-400" />
              <span>文本文字内容</span>
            </div>
            <textarea
              value={textContent}
              onChange={e => handleTextContentChange(e.target.value)}
              rows={2}
              className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs font-sans outline-none focus:border-blue-500 resize-none"
              placeholder="输入文本内容..."
            />
          </div>
        )}

        {/* 填充色 (Fill) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="font-medium">填充颜色 (Fill)</span>
            <span className="font-mono text-slate-400 text-[10px]">{fill}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fill.startsWith('#') ? fill : '#3b82f6'}
              onChange={e => handleFillChange(e.target.value)}
              className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer overflow-hidden p-0"
              title="选择填充颜色"
            />
            <input
              type="text"
              value={fill}
              onChange={e => handleFillChange(e.target.value)}
              placeholder="none / #hex"
              className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs font-mono outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleFillChange('none')}
              className={`px-2 py-1 rounded text-[10px] border transition ${
                fill === 'none'
                  ? 'bg-blue-600/30 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              无填充
            </button>
          </div>

          {/* 预设快捷色板 */}
          <div className="flex items-center gap-1.5 pt-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => handleFillChange(c.value)}
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
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="font-medium">描边颜色 (Stroke)</span>
            <span className="font-mono text-slate-400 text-[10px]">{stroke}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={stroke.startsWith('#') ? stroke : '#ffffff'}
              onChange={e => handleStrokeChange(e.target.value)}
              className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer overflow-hidden p-0"
              title="选择描边颜色"
            />
            <input
              type="text"
              value={stroke}
              onChange={e => handleStrokeChange(e.target.value)}
              placeholder="none / #hex"
              className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs font-mono outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleStrokeChange('none')}
              className={`px-2 py-1 rounded text-[10px] border transition ${
                stroke === 'none'
                  ? 'bg-blue-600/30 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              无描边
            </button>
          </div>
        </div>

        {/* 描边粗细 (Stroke Width) */}
        <div className="space-y-1 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="font-medium">描边粗细 (Stroke Width)</span>
            <span className="font-mono text-cyan-400 text-[11px]">{strokeWidth}px</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={parseFloat(strokeWidth) || 0}
              onChange={e => handleStrokeWidthChange(e.target.value)}
              className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={strokeWidth}
              onChange={e => handleStrokeWidthChange(e.target.value)}
              className="w-14 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs font-mono text-center outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 虚线与线型样式 (Stroke Dasharray) */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="font-medium">线型样式 (Dasharray)</span>
            <span className="font-mono text-slate-400 text-[10px]">{strokeDasharray || '实线'}</span>
          </div>

          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <button
              onClick={() => handleStrokeDasharrayChange('')}
              className={`py-1 px-1.5 rounded border transition text-center ${
                !strokeDasharray
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              实线
            </button>
            <button
              onClick={() => handleStrokeDasharrayChange('6,4')}
              className={`py-1 px-1.5 rounded border transition text-center ${
                strokeDasharray === '6,4'
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              虚线 6,4
            </button>
            <button
              onClick={() => handleStrokeDasharrayChange('2,3')}
              className={`py-1 px-1.5 rounded border transition text-center ${
                strokeDasharray === '2,3'
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              点线 2,3
            </button>
            <button
              onClick={() => handleStrokeDasharrayChange('10,4,2,4')}
              className={`py-1 px-1.5 rounded border transition text-center ${
                strokeDasharray === '10,4,2,4'
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              点划线
            </button>
          </div>

          <input
            type="text"
            value={strokeDasharray}
            onChange={e => handleStrokeDasharrayChange(e.target.value)}
            placeholder="自定义虚线序列 (如 8,4 或 12,3,3,3)"
            className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
          />
        </div>

        {/* 线端帽与拐角连接 (Line Cap & Line Join) */}
        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-medium">线端帽 (Cap)</span>
            <div className="flex rounded border border-slate-700 overflow-hidden text-[10px]">
              {[
                { id: 'butt', label: '平齐' },
                { id: 'round', label: '圆头' },
                { id: 'square', label: '方头' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleStrokeLinecapChange(item.id)}
                  className={`flex-1 py-1 text-center transition ${
                    strokeLinecap === item.id
                      ? 'bg-cyan-600/40 text-cyan-200 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-medium">拐角连接 (Join)</span>
            <div className="flex rounded border border-slate-700 overflow-hidden text-[10px]">
              {[
                { id: 'miter', label: '尖角' },
                { id: 'round', label: '圆角' },
                { id: 'bevel', label: '斜切' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleStrokeLinejoinChange(item.id)}
                  className={`flex-1 py-1 text-center transition ${
                    strokeLinejoin === item.id
                      ? 'bg-cyan-600/40 text-cyan-200 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 端点箭头与标记 (Markers) */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="font-medium flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>端点箭头与标记 (Markers)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="space-y-1">
              <span className="text-slate-400">起点端点 (Start)</span>
              <select
                value={markerStart}
                onChange={e => handleMarkerStartChange(e.target.value)}
                className="w-full p-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-[11px] outline-none focus:border-cyan-500"
              >
                <option value="">无 (none)</option>
                <option value="url(#omni-arrow-start)">反向箭头 (←)</option>
                <option value="url(#omni-circle-start)">起点圆点 (●)</option>
                <option value="url(#omni-dimension-start)">尺寸刻度 (│)</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400">终点端点 (End)</span>
              <select
                value={markerEnd}
                onChange={e => handleMarkerEndChange(e.target.value)}
                className="w-full p-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-[11px] outline-none focus:border-cyan-500"
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
        <div className="space-y-1 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="font-medium">不透明度 (Opacity)</span>
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
              onChange={e => handleOpacityChange(e.target.value)}
              className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* 几何坐标直接微调与尺寸展示 */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center justify-between text-slate-300 text-[11px] font-sans">
            <div className="flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-indigo-400" />
              <span>几何特征与实测位置</span>
            </div>
            {bbox && (
              <span className="text-[10px] text-slate-500 font-mono">
                {Math.round(bbox.width)}×{Math.round(bbox.height)}
              </span>
            )}
          </div>

          {/* 矩形与圆形的中心/起点微调 */}
          {(element.x !== undefined || element.cx !== undefined) && (
            <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2 rounded border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400">坐标 X / CX</span>
                <input
                  type="number"
                  value={xVal}
                  onChange={e => setXVal(e.target.value)}
                  onBlur={e => handleCoordCommit(element.cx !== undefined ? 'cx' : 'x', e.target.value)}
                  className="w-full mt-0.5 p-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs text-center font-mono outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">坐标 Y / CY</span>
                <input
                  type="number"
                  value={yVal}
                  onChange={e => setYVal(e.target.value)}
                  onBlur={e => handleCoordCommit(element.cy !== undefined ? 'cy' : 'y', e.target.value)}
                  className="w-full mt-0.5 p-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs text-center font-mono outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* 尺寸详情展示 */}
          <div className="bg-slate-950/80 p-2 rounded border border-slate-800 space-y-0.5 text-[10px]">
            {bbox && (
              <div className="text-cyan-400/90">
                BBox: ({Math.round(bbox.x)}, {Math.round(bbox.y)}) · {Math.round(bbox.width)}×{Math.round(bbox.height)}
              </div>
            )}
            {element.width && <div>宽度 attr: {element.width}</div>}
            {element.height && <div>高度 attr: {element.height}</div>}
            {element.r && <div>半径 R: {element.r}</div>}
            {element.d && (
              <div className="truncate text-slate-500" title={element.d}>
                Path: {element.d.slice(0, 28)}...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作工具栏 */}
      <div className="px-3 py-2.5 bg-slate-800/80 border-t border-slate-700/80 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={onLocateInCode}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700/80 hover:bg-slate-700 text-cyan-300 text-[11px] transition"
            title="在 XML 源码中定位并高亮此图元"
            aria-label="定位代码"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">定位代码</span>
          </button>

          <button
            onClick={() => onMoveLayer('front')}
            className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-[11px] transition"
            title="置顶图层 (移到最上方)"
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onMoveLayer('back')}
            className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-[11px] transition"
            title="置底图层 (移到最下方)"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyXml}
            className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-[11px] transition"
            title="复制图元 XML 代码"
          >
            {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onDelete}
            className="p-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-[11px] transition"
            title="删除此图元 (快捷键 Delete)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
