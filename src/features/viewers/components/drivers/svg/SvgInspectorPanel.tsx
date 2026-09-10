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
} from 'lucide-react';
import { SvgElementInfo, ElementBBox } from './svgUtils';

interface SvgInspectorPanelProps {
  element: SvgElementInfo;
  bbox?: ElementBBox | null;
  onUpdate: (updates: Partial<SvgElementInfo>) => void;
  onDelete: () => void;
  onMoveLayer: (direction: 'front' | 'back') => void;
  onLocateInCode: () => void;
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onAlignLine?: (mode: 'horizontal' | 'vertical') => void;
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
  snapEnabled = true,
  onToggleSnap,
  onClose,
}) => {
  const [copiedXml, setCopiedXml] = useState(false);

  // 本地缓冲状态
  const [fill, setFill] = useState(element.fill || 'currentColor');
  const [stroke, setStroke] = useState(element.stroke || 'none');
  const [strokeWidth, setStrokeWidth] = useState(element.strokeWidth || '1');
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

        {/* 线条专属正交化与端点吸附控制 (Line Controls) */}
        {isLineTag && (
          <div className="space-y-2 bg-slate-800/60 p-2.5 rounded-lg border border-cyan-500/40">
            <div className="flex items-center justify-between text-cyan-300 font-medium text-[11px]">
              <div className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-cyan-400" />
                <span>线条端点与自动校准</span>
              </div>
              <span className="text-[10px] text-cyan-400/80 font-mono">智能吸附</span>
            </div>

            <div className="text-[10px] text-slate-400 leading-relaxed">
              💡 可在画布中直接拖拽 <span className="text-blue-400 font-bold">P1</span> 与{' '}
              <span className="text-cyan-400 font-bold">P2</span> 端点手柄，自动吸附到水平/垂直/45°角与图形边缘！
            </div>

            {/* 一键正交化操作 */}
            {onAlignLine && (
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => onAlignLine('horizontal')}
                  className="flex-1 py-1 px-2 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-[10px] font-medium transition flex items-center justify-center gap-1"
                  title="自动将线条调整为绝对水平 (0°)"
                >
                  <span>📐 水平正交 (0°)</span>
                </button>
                <button
                  onClick={() => onAlignLine('vertical')}
                  className="flex-1 py-1 px-2 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-[10px] font-medium transition flex items-center justify-center gap-1"
                  title="自动将线条调整为绝对垂直 (90°)"
                >
                  <span>📐 垂直正交 (90°)</span>
                </button>
              </div>
            )}

            {/* 端点数值精调 */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="space-y-1">
                <span className="text-slate-400 text-[10px]">起点 P1 (x1, y1)</span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={lineX1}
                    onChange={e => setLineX1(e.target.value)}
                    onBlur={e => handleCoordCommit('x1', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500"
                    placeholder="x1"
                  />
                  <input
                    type="number"
                    value={lineY1}
                    onChange={e => setLineY1(e.target.value)}
                    onBlur={e => handleCoordCommit('y1', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500"
                    placeholder="y1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 text-[10px]">终点 P2 (x2, y2)</span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={lineX2}
                    onChange={e => setLineX2(e.target.value)}
                    onBlur={e => handleCoordCommit('x2', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500"
                    placeholder="x2"
                  />
                  <input
                    type="number"
                    value={lineY2}
                    onChange={e => setLineY2(e.target.value)}
                    onBlur={e => handleCoordCommit('y2', e.target.value)}
                    className="w-1/2 p-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-200 outline-none focus:border-cyan-500"
                    placeholder="y2"
                  />
                </div>
              </div>
            </div>
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
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>定位代码</span>
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
