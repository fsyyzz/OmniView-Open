/**
 * SvgInspectorPanel 状态与操作逻辑 Hook (useSvgInspector)
 */
import { useState, useEffect } from 'react';
import {
  SvgElementInfo,
  calculateLineMetrics,
  updateLineByLengthAndAngle,
} from './svgUtils';

export interface UseSvgInspectorProps {
  element: SvgElementInfo;
  onUpdate: (updates: Partial<SvgElementInfo>) => void;
}

export function useSvgInspector({ element, onUpdate }: UseSvgInspectorProps) {
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

  return {
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
  };
}
