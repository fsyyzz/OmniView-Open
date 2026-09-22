/**
 * OmniView SVG 矢量画布视口 (SVG Vector Canvas Viewport)
 */
import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { AlertCircle, EyeOff, Move, Crosshair, Magnet, Hash } from 'lucide-react';
import {
  SvgValidationResult,
  SvgElementInfo,
  tagSvgWithNodeIds,
  parseSvgDimensions,
  calculateElementSnapping,
  calculateLineSnapping,
  SnapGuide,
  ElementBBox,
  ResizeHandleDirection,
  CalculatedResizeBBox,
  calculateResizeBBox,
  LinePresetType,
  calculateConstrainedLineEndpoint,
  convertLineToCurve,
  convertCurveToStraightLine,
  parseSvgPathNodes,
  serializeSvgPathNodes,
  insertNodeIntoPath,
  deleteNodeFromPath,
  SvgPathNode,
} from './svgUtils';
import { SvgInspectorPanel } from './SvgInspectorPanel';
import { SvgSelectionGizmo } from './SvgSelectionGizmo';
import { SvgLineHandles } from './SvgLineHandles';
import { SvgPathNodeHandles } from './SvgPathNodeHandles';
import { SvgStatusBar } from './SvgStatusBar';

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
  selectedElementInfo: SvgElementInfo | null;
  onSelectElement: (index: number | null) => void;
  onUpdateElement: (updates: Partial<SvgElementInfo>) => void;
  onDeleteElement: () => void;
  onMoveElementLayer: (direction: 'front' | 'back') => void;
  onLocateInCode: () => void;
  onMoveElementGeometry: (deltaX: number, deltaY: number) => void;
  onResizeElementGeometry?: (newBBox: CalculatedResizeBBox, initialBBox: ElementBBox) => void;
  onAlignElement: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', bbox: ElementBBox) => void;
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
  selectedElementInfo,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onMoveElementLayer,
  onLocateInCode,
  onMoveElementGeometry,
  onResizeElementGeometry,
  onAlignElement,
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // 拖拽、平移与大小调整状态 (包含 Inkscape 风格的弯曲弧度、节点手柄拖拽与笔刷绘制)
  type DragMode =
    | 'none'
    | 'pan'
    | 'element'
    | 'line-p1'
    | 'line-p2'
    | 'line-curve'
    | 'line-cp'
    | 'path-node'
    | 'path-cp'
    | 'resize';
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleDirection | null>(null);
  const [resizePreviewBBox, setResizePreviewBBox] = useState<CalculatedResizeBBox | null>(null);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const dragMovedRef = useRef(false);

  // 智能吸附、网格状态与 Inkscape 修饰键 (Ctrl 15°锁定 / Alt 锁定方向 / Shift 对称)
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);

  // Inkscape 钢笔工具绘图状态 (点击加点，双击/Enter 闭合完成)
  const [penPoints, setPenPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [penCursor, setPenCursor] = useState<{ x: number; y: number } | null>(null);

  // Inkscape 路径节点编辑状态 (F2 节点工具)
  const [screenPathNodes, setScreenPathNodes] = useState<SvgPathNode[]>([]);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [dragNodeIndex, setDragNodeIndex] = useState<number | null>(null);
  const [dragCpInfo, setDragCpInfo] = useState<{ nodeIndex: number; cpIndex: number } | null>(null);
  const initialPathNodesRef = useRef<SvgPathNode[] | null>(null);

  // 线条曲率与二次贝塞尔控制点状态
  const [isCurved, setIsCurved] = useState<boolean>(false);
  const [screenControlPoint, setScreenControlPoint] = useState<{ x: number; y: number } | null>(null);
  const initialLineRef = useRef<{ p1: { x: number; y: number }; p2: { x: number; y: number } } | null>(null);
  const initialCurvatureHeightRef = useRef<number>(0);
  const currentCurvatureValRef = useRef<number>(0);

  // 选中图元在 SVG 内部用户坐标系中的测量包围盒 (用于检视面板数值与对齐算法)
  const [measuredBBox, setMeasuredBBox] = useState<ElementBBox | null>(null);
  const initialBBoxRef = useRef<ElementBBox | null>(null);
  const siblingBBoxesRef = useRef<ElementBBox[]>([]);
  const canvasBoundsRef = useRef<{ minX: number; minY: number; width: number; height: number }>({
    minX: 0,
    minY: 0,
    width: 800,
    height: 600,
  });

  // 监听键盘修饰键 (Ctrl/Alt/Shift) 与 Inkscape 快捷键 (F1/F2/F6, S, G, Enter, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
      if (e.key === 'Alt') setIsAltPressed(true);
      if (e.key === 'Shift') setIsShiftPressed(true);

      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          setSnapEnabled(prev => !prev);
        }
      } else if (e.key === 'g' || e.key === 'G') {
        setGridSnapEnabled(prev => !prev);
      } else if (e.key === 'F1') {
        e.preventDefault();
        onChangeActiveTool?.('select');
      } else if (e.key === 'F2') {
        e.preventDefault();
        onChangeActiveTool?.('node');
      } else if (e.key === 'F6') {
        e.preventDefault();
        onChangeActiveTool?.('pen');
      } else if (e.key === 'Enter') {
        // 钢笔绘制完成
        if (penPoints.length >= 2) {
          if (penPoints.length === 2 && onAddNewLine) {
            onAddNewLine(penPoints[0].x, penPoints[0].y, penPoints[1].x, penPoints[1].y);
          } else if (onAddNewPolyline) {
            onAddNewPolyline(penPoints);
          }
          setPenPoints([]);
          setPenCursor(null);
        }
      } else if (e.key === 'Escape') {
        // 取消钢笔绘制
        setPenPoints([]);
        setPenCursor(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [penPoints, onChangeActiveTool, onAddNewLine, onAddNewPolyline]);

  // 选中图元在视口屏幕物理像素坐标系中的精确包围盒与线条端点 (用于选框与手柄 100% 紧密贴合渲染)
  interface ScreenBBox {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  interface ScreenLineCoords {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const [screenBBox, setScreenBBox] = useState<ScreenBBox | null>(null);
  const [screenLineCoords, setScreenLineCoords] = useState<ScreenLineCoords | null>(null);
  const [screenDragOffset, setScreenDragOffset] = useState({ x: 0, y: 0 });

  // 缓存与当前图元关联的 SVG 根节点与变换矩阵
  const svgRootRef = useRef<SVGSVGElement | null>(null);
  const currentCtmRef = useRef<DOMMatrix | null>(null);
  const currentInvCtmRef = useRef<DOMMatrix | null>(null);

  // 缓存上一次合法的 SVG 内容，防止编辑中途语法错误瞬间画布全黑
  const lastValidSvgRef = useRef<string>(svgContent);
  if (validation.valid && svgContent.trim()) {
    lastValidSvgRef.current = svgContent;
  }

  // 经过 DOMPurify 严格安全净化的 SVG 内容，并按需注入 data-omni-id 供检视器点选
  const sanitizedMarkup = useMemo(() => {
    const targetContent = validation.valid ? svgContent : lastValidSvgRef.current;
    if (!targetContent.trim()) return '';

    const taggedContent = inspectorActive || selectedElementIndex !== null
      ? tagSvgWithNodeIds(targetContent, selectedElementIndex)
      : targetContent;

    return DOMPurify.sanitize(taggedContent, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_ATTR: [
        'data-omni-id',
        'data-omni-selected',
        'class',
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
      ],
    });
  }, [svgContent, validation.valid, inspectorActive, selectedElementIndex]);

  // 统一测量函数：同时测量 SVG 内部空间 BBox 与视口屏幕真实物理像素坐标
  const updateMeasurements = useCallback(() => {
    if (selectedElementIndex === null || !containerRef.current || !surfaceRef.current) {
      setMeasuredBBox(null);
      setScreenBBox(null);
      setScreenLineCoords(null);
      return;
    }

    const el = surfaceRef.current.querySelector(`[data-omni-id="${selectedElementIndex}"]`);
    if (!el) {
      setMeasuredBBox(null);
      setScreenBBox(null);
      setScreenLineCoords(null);
      return;
    }

    const svgRoot = ((el as SVGElement).ownerSVGElement || surfaceRef.current.querySelector('svg')) as SVGSVGElement | null;
    svgRootRef.current = svgRoot;

    // 1. 测量在 SVG 用户空间中的 BBox (供 Inspector 检视器数值显示与对齐计算)
    if ('getBBox' in el) {
      try {
        const bbox = (el as SVGGraphicsElement).getBBox();
        setMeasuredBBox({
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          id: el.getAttribute('id') || undefined,
          tagName: el.tagName.toLowerCase(),
        });
      } catch {
        setMeasuredBBox(null);
      }
    }

    // 2. 测量在视口屏幕中的精确物理像素 BBox (直接抹平 padding、flex 居中、viewBox 缩放与 CSS 变换)
    const containerRect = containerRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    setScreenBBox({
      x: elRect.left - containerRect.left,
      y: elRect.top - containerRect.top,
      width: elRect.width,
      height: elRect.height,
    });

    // 3. 记录当前的 CTM 变换矩阵，用于精确鼠标位移转换
    if ('getScreenCTM' in el) {
      try {
        const ctm = (el as SVGGraphicsElement).getScreenCTM();
        if (ctm) {
          currentCtmRef.current = ctm;
          currentInvCtmRef.current = ctm.inverse();
        }
      } catch {}
    }

    // 4. 如果是线条图元或二次贝塞尔曲线，计算端点与控制点在视口屏幕中的精确坐标
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'line') {
      setIsCurved(false);
      setScreenControlPoint(null);
      const lineEl = el as SVGLineElement;
      if (currentCtmRef.current && svgRoot && svgRoot.createSVGPoint) {
        try {
          const x1 = lineEl.x1?.baseVal?.value ?? parseFloat(el.getAttribute('x1') || '0');
          const y1 = lineEl.y1?.baseVal?.value ?? parseFloat(el.getAttribute('y1') || '0');
          const x2 = lineEl.x2?.baseVal?.value ?? parseFloat(el.getAttribute('x2') || '0');
          const y2 = lineEl.y2?.baseVal?.value ?? parseFloat(el.getAttribute('y2') || '0');

          const pt1 = svgRoot.createSVGPoint();
          pt1.x = x1;
          pt1.y = y1;
          const sp1 = pt1.matrixTransform(currentCtmRef.current);

          const pt2 = svgRoot.createSVGPoint();
          pt2.x = x2;
          pt2.y = y2;
          const sp2 = pt2.matrixTransform(currentCtmRef.current);

          setScreenLineCoords({
            x1: sp1.x - containerRect.left,
            y1: sp1.y - containerRect.top,
            x2: sp2.x - containerRect.left,
            y2: sp2.y - containerRect.top,
          });
        } catch {
          setScreenLineCoords(null);
        }
      } else {
        setScreenLineCoords({
          x1: elRect.left - containerRect.left,
          y1: elRect.top - containerRect.top,
          x2: elRect.right - containerRect.left,
          y2: elRect.bottom - containerRect.top,
        });
      }
    } else if (tagName === 'path') {
      const d = el.getAttribute('d') || '';
      const qMatch = d.match(/M\s*([-\d.]+)[,\s]+([-\d.]+)\s*Q\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/i);
      if (qMatch && currentCtmRef.current && svgRoot && svgRoot.createSVGPoint) {
        try {
          const x1 = parseFloat(qMatch[1]);
          const y1 = parseFloat(qMatch[2]);
          const cx = parseFloat(qMatch[3]);
          const cy = parseFloat(qMatch[4]);
          const x2 = parseFloat(qMatch[5]);
          const y2 = parseFloat(qMatch[6]);

          const pt1 = svgRoot.createSVGPoint(); pt1.x = x1; pt1.y = y1;
          const sp1 = pt1.matrixTransform(currentCtmRef.current);
          const pt2 = svgRoot.createSVGPoint(); pt2.x = x2; pt2.y = y2;
          const sp2 = pt2.matrixTransform(currentCtmRef.current);
          const ptCp = svgRoot.createSVGPoint(); ptCp.x = cx; ptCp.y = cy;
          const spCp = ptCp.matrixTransform(currentCtmRef.current);

          setScreenLineCoords({
            x1: sp1.x - containerRect.left,
            y1: sp1.y - containerRect.top,
            x2: sp2.x - containerRect.left,
            y2: sp2.y - containerRect.top,
          });
          setScreenControlPoint({
            x: spCp.x - containerRect.left,
            y: spCp.y - containerRect.top,
          });
          setIsCurved(true);
        } catch {
          setScreenLineCoords(null);
          setScreenControlPoint(null);
          setIsCurved(false);
        }
      } else {
        setScreenLineCoords(null);
        setScreenControlPoint(null);
        setIsCurved(false);
      }

      // 解析节点供 F2 节点工具使用
      if (activeTool === 'node' && currentCtmRef.current && svgRoot && svgRoot.createSVGPoint) {
        try {
          const parsed = parseSvgPathNodes(d);
          const screenNodes: SvgPathNode[] = parsed.map(node => {
            const p = svgRoot.createSVGPoint(); p.x = node.x; p.y = node.y;
            const sp = p.matrixTransform(currentCtmRef.current!);
            let sHandleIn: { x: number; y: number } | undefined = undefined;
            let sHandleOut: { x: number; y: number } | undefined = undefined;
            if (node.handleIn) {
              const hp = svgRoot.createSVGPoint(); hp.x = node.handleIn.x; hp.y = node.handleIn.y;
              const shp = hp.matrixTransform(currentCtmRef.current!);
              sHandleIn = { x: shp.x - containerRect.left, y: shp.y - containerRect.top };
            }
            if (node.handleOut) {
              const hp = svgRoot.createSVGPoint(); hp.x = node.handleOut.x; hp.y = node.handleOut.y;
              const shp = hp.matrixTransform(currentCtmRef.current!);
              sHandleOut = { x: shp.x - containerRect.left, y: shp.y - containerRect.top };
            }
            return {
              ...node,
              x: sp.x - containerRect.left,
              y: sp.y - containerRect.top,
              handleIn: sHandleIn,
              handleOut: sHandleOut,
            };
          });
          setScreenPathNodes(screenNodes);
        } catch {
          setScreenPathNodes([]);
        }
      } else {
        setScreenPathNodes([]);
      }
    } else {
      setScreenLineCoords(null);
      setScreenControlPoint(null);
      setIsCurved(false);
      setScreenPathNodes([]);
    }
  }, [selectedElementIndex, activeTool]);

  // 坐标转换辅助：将视口物理像素转换为当前 SVG 用户内部坐标
  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      if (currentInvCtmRef.current) {
        const pt = new DOMPoint(clientX, clientY).matrixTransform(currentInvCtmRef.current);
        return { x: Math.round(pt.x * 100) / 100, y: Math.round(pt.y * 100) / 100 };
      }
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (clientX - rect.left - position.x) / scale;
        const y = (clientY - rect.top - position.y) / scale;
        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      }
      return { x: 0, y: 0 };
    },
    [scale, position]
  );

  // 当选中图元变化、SVG 内容重绘、缩放、或平移时，实时重新校准选框与手柄屏幕位置
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      updateMeasurements();
    });
    return () => cancelAnimationFrame(rafId);
  }, [updateMeasurements, sanitizedMarkup, scale, position]);

  // 监听窗口尺寸变化
  useEffect(() => {
    const handleResize = () => updateMeasurements();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMeasurements]);

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale(prev => Math.min(8, Math.max(0.08, prev * zoomFactor)));
  };

  // 收集兄弟节点及画布几何
  const prepareDragContext = useCallback(
    (targetIndex: number) => {
      canvasBoundsRef.current = parseSvgDimensions(svgContent);

      if (!surfaceRef.current) return;
      const siblings: ElementBBox[] = [];
      const allElements = surfaceRef.current.querySelectorAll('[data-omni-id]');
      allElements.forEach(node => {
        const omniId = node.getAttribute('data-omni-id');
        if (omniId !== String(targetIndex) && 'getBBox' in node) {
          try {
            const b = (node as SVGGraphicsElement).getBBox();
            if (b.width > 0 || b.height > 0) {
              siblings.push({
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                id: node.getAttribute('id') || undefined,
                tagName: node.tagName.toLowerCase(),
              });
            }
          } catch {}
        }
      });
      siblingBBoxesRef.current = siblings;
    },
    [svgContent]
  );

  // 鼠标按下：区分 Inkscape 钢笔工具、路径节点/控制柄、线条弧度手柄、Resize 手柄、图元拖动与画布平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return; // 仅左键或中键

    const target = e.target as HTMLElement;

    // 0. 如果点击的是属性检视面板、底部状态栏、或任何带 data-canvas-ui 的控件，直接忽略，不开启平移拖拽
    if (
      target.closest('#svg-inspector-panel') ||
      target.closest('[data-inspector-panel]') ||
      target.closest('#canvas-statusbar') ||
      target.closest('[data-canvas-ui]')
    ) {
      return;
    }

    // 0.1 如果当前激活的是 Inkscape 钢笔工具 (Pen Tool F6)
    if (activeTool === 'pen') {
      const svgPt = clientToSvg(e.clientX, e.clientY);
      let targetPt = svgPt;
      if ((snap15Deg || isCtrlPressed || e.ctrlKey) && penPoints.length > 0) {
        const lastPt = penPoints[penPoints.length - 1];
        const constrained = calculateConstrainedLineEndpoint(lastPt.x, lastPt.y, svgPt.x, svgPt.y, {
          snap15Deg: true,
        });
        targetPt = { x: constrained.x, y: constrained.y };
      }

      // 如果点击起点附近（闭合折线/线条）
      if (penPoints.length >= 2) {
        const first = penPoints[0];
        const dist = Math.hypot(targetPt.x - first.x, targetPt.y - first.y);
        if (dist < 12 / scale) {
          if (onAddNewPolyline) {
            onAddNewPolyline([...penPoints, first]);
          }
          setPenPoints([]);
          setPenCursor(null);
          return;
        }
      }

      setPenPoints(prev => [...prev, targetPt]);
      setPenCursor(targetPt);
      return;
    }

    // 1. 检查是否点击了 8 向 Resize 缩放手柄
    const resizeHandle = target.closest('[data-resize-handle]');
    if (resizeHandle && selectedElementIndex !== null && measuredBBox) {
      const dir = resizeHandle.getAttribute('data-resize-handle') as ResizeHandleDirection;
      setDragMode('resize');
      setActiveResizeHandle(dir);
      dragMovedRef.current = false;
      dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
      initialBBoxRef.current = { ...measuredBBox };
      setResizePreviewBBox({ ...measuredBBox });
      prepareDragContext(selectedElementIndex);
      return;
    }

    // 2. 检查是否点击了 Inkscape 路径节点编辑手柄 (F2 节点工具)
    const pathHandle = target.closest('[data-path-handle]');
    if (pathHandle) {
      const handleType = pathHandle.getAttribute('data-path-handle');
      const nodeIdxStr = pathHandle.getAttribute('data-node-idx');
      if (handleType === 'node' && nodeIdxStr !== null) {
        const nIdx = parseInt(nodeIdxStr, 10);
        setSelectedNodeIndex(nIdx);
        setDragMode('path-node');
        setDragNodeIndex(nIdx);
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setScreenDragOffset({ x: 0, y: 0 });
        return;
      }
      if (handleType === 'cp' && nodeIdxStr !== null) {
        const nIdx = parseInt(nodeIdxStr, 10);
        const cpIdxStr = pathHandle.getAttribute('data-cp-idx');
        const cpIdx = cpIdxStr ? parseInt(cpIdxStr, 10) : 1;
        setDragMode('path-cp');
        setDragCpInfo({ nodeIndex: nIdx, cpIndex: cpIdx });
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setScreenDragOffset({ x: 0, y: 0 });
        return;
      }
    }

    // 3. 检查是否点击了线条端点或 Inkscape 弯曲/控制点手柄
    const lineHandle = target.closest('[data-line-handle]');
    if (lineHandle) {
      const handleType = lineHandle.getAttribute('data-line-handle');

      // 弧度弯曲手柄
      if (handleType === 'curve') {
        setDragMode('line-curve');
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setScreenDragOffset({ x: 0, y: 0 });
        currentCurvatureValRef.current = 0;
        return;
      }

      // 二次贝塞尔控制点手柄
      if (handleType === 'cp') {
        setDragMode('line-cp');
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setScreenDragOffset({ x: 0, y: 0 });
        return;
      }

      // 端点 P1 / P2
      if (handleType === 'p1' || handleType === 'p2') {
        setDragMode(handleType === 'p1' ? 'line-p1' : 'line-p2');
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setScreenDragOffset({ x: 0, y: 0 });

        if (selectedElementInfo && selectedElementInfo.tagName === 'line') {
          const x1 = parseFloat(selectedElementInfo.x1 || '0');
          const y1 = parseFloat(selectedElementInfo.y1 || '0');
          const x2 = parseFloat(selectedElementInfo.x2 || '0');
          const y2 = parseFloat(selectedElementInfo.y2 || '0');
          initialLineRef.current = { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } };
        } else if (isCurved && screenLineCoords) {
          // 将当前屏幕端点转换为 SVG 用户空间坐标
          const p1 = clientToSvg(screenLineCoords.x1 + (containerRef.current?.getBoundingClientRect().left || 0), screenLineCoords.y1 + (containerRef.current?.getBoundingClientRect().top || 0));
          const p2 = clientToSvg(screenLineCoords.x2 + (containerRef.current?.getBoundingClientRect().left || 0), screenLineCoords.y2 + (containerRef.current?.getBoundingClientRect().top || 0));
          initialLineRef.current = { p1, p2 };
        }

        if (selectedElementIndex !== null) {
          prepareDragContext(selectedElementIndex);
        }
        return;
      }
    }

    // 4. 检查是否点击了当前选中图元的包围选框 Gizmo
    const isGizmoClick = !!target.closest('[data-selected-gizmo]');

    // 5. 检查是否在检视模式下点击了图元
    if (inspectorActive || isGizmoClick) {
      const omniElement = target.closest('[data-omni-id]');
      const omniIdStr = omniElement?.getAttribute('data-omni-id');
      const targetIndex = omniIdStr !== null && omniIdStr !== undefined ? parseInt(omniIdStr, 10) : null;

      // 如果点击的是已经选中的图元，或者直接点击了选框 Gizmo：进入图元拖拽模式！
      if (isGizmoClick || (targetIndex !== null && targetIndex === selectedElementIndex)) {
        setDragMode('element');
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setDragDelta({ x: 0, y: 0 });
        setScreenDragOffset({ x: 0, y: 0 });

        const currentTargetIndex = isGizmoClick ? selectedElementIndex! : targetIndex!;
        const el = surfaceRef.current?.querySelector(`[data-omni-id="${currentTargetIndex}"]`);
        if (el && 'getBBox' in el) {
          try {
            const b = (el as SVGGraphicsElement).getBBox();
            const bbox: ElementBBox = {
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              id: el.getAttribute('id') || undefined,
              tagName: el.tagName.toLowerCase(),
            };
            initialBBoxRef.current = bbox;
            setMeasuredBBox(bbox);
          } catch {}
        }

        prepareDragContext(currentTargetIndex);
        return;
      }
    }

    // 6. 其它情况：进入画布平移拖拽
    setDragMode('pan');
    dragMovedRef.current = false;
    dragStartMouseRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    // 钢笔绘制游标动态跟随
    if (activeTool === 'pen' && penPoints.length > 0) {
      const svgPt = clientToSvg(e.clientX, e.clientY);
      let targetPt = svgPt;
      if (snap15Deg || isCtrlPressed || e.ctrlKey) {
        const lastPt = penPoints[penPoints.length - 1];
        const constrained = calculateConstrainedLineEndpoint(lastPt.x, lastPt.y, svgPt.x, svgPt.y, {
          snap15Deg: true,
        });
        targetPt = { x: constrained.x, y: constrained.y };
      }
      setPenCursor(targetPt);
    }

    // A. 画布平移
    if (dragMode === 'pan') {
      dragMovedRef.current = true;
      setPosition({
        x: e.clientX - dragStartMouseRef.current.x,
        y: e.clientY - dragStartMouseRef.current.y,
      });
      return;
    }

    // B. Inkscape 风格线条弯曲弧度拖拽 (Line Curve Bending)
    if (dragMode === 'line-curve') {
      dragMovedRef.current = true;
      const mouseDx = e.clientX - dragStartMouseRef.current.x;
      const mouseDy = e.clientY - dragStartMouseRef.current.y;
      setScreenDragOffset({ x: mouseDx, y: mouseDy });

      if (screenLineCoords) {
        const lx = screenLineCoords.x2 - screenLineCoords.x1;
        const ly = screenLineCoords.y2 - screenLineCoords.y1;
        const lineLen = Math.hypot(lx, ly) || 1;
        const nx = -ly / lineLen;
        const ny = lx / lineLen;
        const proj = mouseDx * nx + mouseDy * ny;
        currentCurvatureValRef.current = Math.round((proj / scale) * 10) / 10;
      }
      return;
    }

    // C. Inkscape 控制点或路径节点拖拽
    if (dragMode === 'line-cp' || dragMode === 'path-node' || dragMode === 'path-cp') {
      dragMovedRef.current = true;
      const mouseDx = e.clientX - dragStartMouseRef.current.x;
      const mouseDy = e.clientY - dragStartMouseRef.current.y;
      setScreenDragOffset({ x: mouseDx, y: mouseDy });
      return;
    }

    // D. 图元位置拖拽调整 (带智能吸附、网格吸附与 0 延迟实时 live 跟随)
    if (dragMode === 'element' && selectedElementIndex !== null) {
      dragMovedRef.current = true;
      const mouseDx = e.clientX - dragStartMouseRef.current.x;
      const mouseDy = e.clientY - dragStartMouseRef.current.y;

      // 使用逆变换矩阵精确转换为 SVG 用户空间位移
      let rawDeltaX = mouseDx / scale;
      let rawDeltaY = mouseDy / scale;
      if (currentInvCtmRef.current) {
        rawDeltaX = mouseDx * currentInvCtmRef.current.a + mouseDy * currentInvCtmRef.current.c;
        rawDeltaY = mouseDx * currentInvCtmRef.current.b + mouseDy * currentInvCtmRef.current.d;
      }

      let finalDeltaX = rawDeltaX;
      let finalDeltaY = rawDeltaY;

      if (initialBBoxRef.current && (snapEnabled || gridSnapEnabled)) {
        const snap = calculateElementSnapping(
          initialBBoxRef.current,
          rawDeltaX,
          rawDeltaY,
          canvasBoundsRef.current,
          siblingBBoxesRef.current,
          8 / scale,
          gridSnapEnabled,
          gridSize
        );
        finalDeltaX = snap.deltaX;
        finalDeltaY = snap.deltaY;
        setActiveGuides(snap.guides);
      } else {
        setActiveGuides([]);
      }

      setDragDelta({ x: finalDeltaX, y: finalDeltaY });

      // 将吸附后的位移实时映射回屏幕物理像素选框
      if (currentCtmRef.current) {
        setScreenDragOffset({
          x: finalDeltaX * currentCtmRef.current.a + finalDeltaY * currentCtmRef.current.c,
          y: finalDeltaX * currentCtmRef.current.b + finalDeltaY * currentCtmRef.current.d,
        });
      } else {
        setScreenDragOffset({ x: finalDeltaX * scale, y: finalDeltaY * scale });
      }

      // 实时让被选中的 SVG DOM 元素与选框 100% 同步平移，彻底告别脱节感
      const activeEl = surfaceRef.current?.querySelector(`[data-omni-id="${selectedElementIndex}"]`) as SVGGraphicsElement | null;
      if (activeEl) {
        activeEl.style.transform = `translate(${finalDeltaX}px, ${finalDeltaY}px)`;
        activeEl.style.opacity = '0.85';
        activeEl.style.transition = 'none';
      }
      return;
    }

    // E. 8 向大小调整 (Resize 拖拽缩放与实时等比提示)
    if (dragMode === 'resize' && selectedElementIndex !== null && initialBBoxRef.current && activeResizeHandle) {
      dragMovedRef.current = true;
      const mouseDx = e.clientX - dragStartMouseRef.current.x;
      const mouseDy = e.clientY - dragStartMouseRef.current.y;

      let deltaX = mouseDx / scale;
      let deltaY = mouseDy / scale;
      if (currentInvCtmRef.current) {
        deltaX = mouseDx * currentInvCtmRef.current.a + mouseDy * currentInvCtmRef.current.c;
        deltaY = mouseDx * currentInvCtmRef.current.b + mouseDy * currentInvCtmRef.current.d;
      }

      let calculated = calculateResizeBBox(
        initialBBoxRef.current,
        activeResizeHandle,
        deltaX,
        deltaY,
        e.shiftKey || isShiftPressed
      );

      // 网格吸附调整
      if (gridSnapEnabled && gridSize > 0) {
        calculated = {
          x: Math.round(calculated.x / gridSize) * gridSize,
          y: Math.round(calculated.y / gridSize) * gridSize,
          width: Math.max(gridSize, Math.round(calculated.width / gridSize) * gridSize),
          height: Math.max(gridSize, Math.round(calculated.height / gridSize) * gridSize),
        };
      }

      setResizePreviewBBox(calculated);

      // 实时在真实 SVG DOM 元素上施加预览变换
      const activeEl = surfaceRef.current?.querySelector(`[data-omni-id="${selectedElementIndex}"]`) as SVGGraphicsElement | null;
      if (activeEl) {
        const origW = initialBBoxRef.current.width || 1;
        const origH = initialBBoxRef.current.height || 1;
        const sx = calculated.width / origW;
        const sy = calculated.height / origH;
        const dx = calculated.x - initialBBoxRef.current.x;
        const dy = calculated.y - initialBBoxRef.current.y;
        activeEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        activeEl.style.transformOrigin = `${initialBBoxRef.current.x}px ${initialBBoxRef.current.y}px`;
        activeEl.style.opacity = '0.85';
        activeEl.style.transition = 'none';
      }
      return;
    }

    // F. 线条单端点拖拽调整 (带水平/垂直/15°角度吸附与 Alt 角度锁定)
    if ((dragMode === 'line-p1' || dragMode === 'line-p2') && initialLineRef.current) {
      dragMovedRef.current = true;
      const mouseDx = e.clientX - dragStartMouseRef.current.x;
      const mouseDy = e.clientY - dragStartMouseRef.current.y;

      let deltaX = mouseDx / scale;
      let deltaY = mouseDy / scale;
      if (currentInvCtmRef.current) {
        deltaX = mouseDx * currentInvCtmRef.current.a + mouseDy * currentInvCtmRef.current.c;
        deltaY = mouseDx * currentInvCtmRef.current.b + mouseDy * currentInvCtmRef.current.d;
      }

      const currentP1 = { ...initialLineRef.current.p1 };
      const currentP2 = { ...initialLineRef.current.p2 };

      if (dragMode === 'line-p1') {
        currentP1.x += deltaX;
        currentP1.y += deltaY;
      } else {
        currentP2.x += deltaX;
        currentP2.y += deltaY;
      }

      // Inkscape 约束：Ctrl 或 15°开关联动 15°吸附，Alt 锁定原始线条夹角
      if (snap15Deg || isCtrlPressed || e.ctrlKey || isAltPressed || e.altKey) {
        const basePt = dragMode === 'line-p1' ? currentP2 : currentP1;
        const movingPt = dragMode === 'line-p1' ? currentP1 : currentP2;
        const constrained = calculateConstrainedLineEndpoint(
          basePt.x,
          basePt.y,
          movingPt.x,
          movingPt.y,
          {
            snap15Deg: snap15Deg || isCtrlPressed || e.ctrlKey,
          }
        );
        if (dragMode === 'line-p1') {
          currentP1.x = constrained.x;
          currentP1.y = constrained.y;
        } else {
          currentP2.x = constrained.x;
          currentP2.y = constrained.y;
        }
      }

      if (snapEnabled) {
        const snap = calculateLineSnapping(
          currentP1,
          currentP2,
          dragMode === 'line-p1' ? 'p1' : 'p2',
          canvasBoundsRef.current,
          siblingBBoxesRef.current,
          8 / scale
        );
        setActiveGuides(snap.guides);
      } else {
        setActiveGuides([]);
      }

      setScreenDragOffset({ x: mouseDx, y: mouseDy });
      return;
    }

    // G. 非拖拽状态下：悬浮图元名称探测
    if (inspectorActive) {
      const el = (e.target as HTMLElement).closest('[data-omni-id]');
      if (el) {
        const tag = el.tagName.toLowerCase();
        const id = el.getAttribute('id');
        setHoveredTag(id ? `<${tag}#${id}>` : `<${tag}>`);
      } else {
        setHoveredTag(null);
      }
    }
  };

  // 鼠标释放
  const handleMouseUp = (e: React.MouseEvent) => {
    const currentMode = dragMode;
    const moved = dragMovedRef.current;

    // 清理 DOM 元素的临时内联变换样式
    if (selectedElementIndex !== null && surfaceRef.current) {
      const activeEl = surfaceRef.current.querySelector(`[data-omni-id="${selectedElementIndex}"]`) as SVGGraphicsElement | null;
      if (activeEl) {
        activeEl.style.transform = '';
        activeEl.style.opacity = '';
        activeEl.style.transition = '';
        activeEl.style.transformOrigin = '';
      }
    }

    setDragMode('none');
    setActiveGuides([]);
    setScreenDragOffset({ x: 0, y: 0 });

    // 1. Inkscape 弯曲拖拽完成：将直线转为曲线并应用弧度
    if (currentMode === 'line-curve') {
      if (moved && onConvertToCurve) {
        onConvertToCurve(currentCurvatureValRef.current || 30);
      }
      return;
    }

    // 2. Inkscape 二次贝塞尔控制点拖拽完成：更新 Q 控制点坐标
    if (currentMode === 'line-cp' && selectedElementIndex !== null) {
      if (moved && surfaceRef.current) {
        const activeEl = surfaceRef.current.querySelector(`[data-omni-id="${selectedElementIndex}"]`);
        if (activeEl && activeEl.tagName.toLowerCase() === 'path') {
          const d = activeEl.getAttribute('d') || '';
          const qMatch = d.match(/M\s*([-\d.]+)[,\s]+([-\d.]+)\s*Q\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/i);
          if (qMatch) {
            const mouseDx = e.clientX - dragStartMouseRef.current.x;
            const mouseDy = e.clientY - dragStartMouseRef.current.y;
            let deltaX = mouseDx / scale;
            let deltaY = mouseDy / scale;
            if (currentInvCtmRef.current) {
              deltaX = mouseDx * currentInvCtmRef.current.a + mouseDy * currentInvCtmRef.current.c;
              deltaY = mouseDx * currentInvCtmRef.current.b + mouseDy * currentInvCtmRef.current.d;
            }
            const x1 = qMatch[1];
            const y1 = qMatch[2];
            const cx = Math.round((parseFloat(qMatch[3]) + deltaX) * 100) / 100;
            const cy = Math.round((parseFloat(qMatch[4]) + deltaY) * 100) / 100;
            const x2 = qMatch[5];
            const y2 = qMatch[6];
            onUpdateElement({ d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` });
          }
        }
      }
      return;
    }

    // 3. Inkscape 路径节点拖拽完成 (F2 节点工具)
    if (currentMode === 'path-node' && dragNodeIndex !== null) {
      if (moved && onUpdatePathNode) {
        const svgPt = clientToSvg(e.clientX, e.clientY);
        onUpdatePathNode(dragNodeIndex, svgPt.x, svgPt.y);
      }
      setDragNodeIndex(null);
      return;
    }

    // 4. Inkscape 贝塞尔控制柄拖拽完成 (F2 节点工具)
    if (currentMode === 'path-cp' && dragCpInfo !== null) {
      if (moved && onUpdatePathNode) {
        const svgPt = clientToSvg(e.clientX, e.clientY);
        onUpdatePathNode(dragCpInfo.nodeIndex, svgPt.x, svgPt.y, dragCpInfo.cpIndex);
      }
      setDragCpInfo(null);
      return;
    }

    // 5. 大小调整完成：写入更新后的尺寸与位置
    if (currentMode === 'resize' && selectedElementIndex !== null && resizePreviewBBox && initialBBoxRef.current) {
      if (moved && onResizeElementGeometry) {
        onResizeElementGeometry(resizePreviewBBox, initialBBoxRef.current);
      }
      setResizePreviewBBox(null);
      setActiveResizeHandle(null);
      return;
    }

    // 6. 图元拖拽完成：将吸附与微调结果持久化写入
    if (currentMode === 'element' && selectedElementIndex !== null) {
      if (moved && (Math.abs(dragDelta.x) > 0.4 || Math.abs(dragDelta.y) > 0.4)) {
        onMoveElementGeometry(dragDelta.x, dragDelta.y);
      }
      setDragDelta({ x: 0, y: 0 });
      return;
    }

    // 7. 线条端点拖拽完成：写入新的端点坐标 (支持 15°吸附与 Alt 角度锁定)
    if ((currentMode === 'line-p1' || currentMode === 'line-p2') && initialLineRef.current && selectedElementIndex !== null) {
      if (moved) {
        const mouseDx = e.clientX - dragStartMouseRef.current.x;
        const mouseDy = e.clientY - dragStartMouseRef.current.y;
        let rawDeltaX = mouseDx / scale;
        let rawDeltaY = mouseDy / scale;
        if (currentInvCtmRef.current) {
          rawDeltaX = mouseDx * currentInvCtmRef.current.a + mouseDy * currentInvCtmRef.current.c;
          rawDeltaY = mouseDx * currentInvCtmRef.current.b + mouseDy * currentInvCtmRef.current.d;
        }

        const currentP1 = { ...initialLineRef.current.p1 };
        const currentP2 = { ...initialLineRef.current.p2 };

        if (currentMode === 'line-p1') {
          currentP1.x += rawDeltaX;
          currentP1.y += rawDeltaY;
        } else {
          currentP2.x += rawDeltaX;
          currentP2.y += rawDeltaY;
        }

        if (snap15Deg || isCtrlPressed || e.ctrlKey || isAltPressed || e.altKey) {
          const basePt = currentMode === 'line-p1' ? currentP2 : currentP1;
          const movingPt = currentMode === 'line-p1' ? currentP1 : currentP2;
          const constrained = calculateConstrainedLineEndpoint(
            basePt.x,
            basePt.y,
            movingPt.x,
            movingPt.y,
            {
              snap15Deg: snap15Deg || isCtrlPressed || e.ctrlKey,
            }
          );
          if (currentMode === 'line-p1') {
            currentP1.x = constrained.x;
            currentP1.y = constrained.y;
          } else {
            currentP2.x = constrained.x;
            currentP2.y = constrained.y;
          }
        }

        const snapped = snapEnabled
          ? calculateLineSnapping(
              currentP1,
              currentP2,
              currentMode === 'line-p1' ? 'p1' : 'p2',
              canvasBoundsRef.current,
              siblingBBoxesRef.current,
              8 / scale
            )
          : { p1: currentP1, p2: currentP2 };

        const round2 = (num: number) => Math.round(num * 100) / 100;

        if (isCurved && surfaceRef.current) {
          const activeEl = surfaceRef.current.querySelector(`[data-omni-id="${selectedElementIndex}"]`);
          if (activeEl && activeEl.tagName.toLowerCase() === 'path') {
            const d = activeEl.getAttribute('d') || '';
            const qMatch = d.match(/M\s*([-\d.]+)[,\s]+([-\d.]+)\s*Q\s*([-\d.]+)[,\s]+([-\d.]+)\s*([-\d.]+)[,\s]+([-\d.]+)/i);
            if (qMatch) {
              const cx = qMatch[3];
              const cy = qMatch[4];
              onUpdateElement({
                d: `M ${round2(snapped.p1.x)} ${round2(snapped.p1.y)} Q ${cx} ${cy} ${round2(snapped.p2.x)} ${round2(snapped.p2.y)}`,
              });
              return;
            }
          }
        }

        onUpdateElement({
          x1: String(round2(snapped.p1.x)),
          y1: String(round2(snapped.p1.y)),
          x2: String(round2(snapped.p2.x)),
          y2: String(round2(snapped.p2.y)),
        });
      }
      return;
    }

    // 8. 点击点选图元逻辑（未发生大距离拖拽平移时）
    if (!moved && inspectorActive) {
      const target = e.target as HTMLElement;

      // 如果点击落在属性检视面板、底部状态栏、选框 Gizmo、手柄、或任何 UI 交互浮层上，绝不能取消选中！
      const isUiClick = !!(
        target.closest('#svg-inspector-panel') ||
        target.closest('[data-inspector-panel]') ||
        target.closest('#canvas-statusbar') ||
        target.closest('[data-canvas-ui]') ||
        target.closest('[data-selected-gizmo]') ||
        target.closest('[data-resize-handle]') ||
        target.closest('[data-line-handle]') ||
        target.closest('[data-path-handle]')
      );

      if (isUiClick) {
        return;
      }

      const omniTarget = target.closest('[data-omni-id]');
      if (omniTarget) {
        const omniId = omniTarget.getAttribute('data-omni-id');
        if (omniId !== null) {
          const parsed = parseInt(omniId, 10);
          onSelectElement(parsed);
          return;
        }
      } else {
        // 仅当用户明确点击画布空白区域（非任何 UI 浮层）时，才取消选中
        onSelectElement(null);
      }
    }
  };

  // 键盘快捷键微调支持 (方向键 ±1px / ±10px 键盘微调，S 键吸附开关，Delete 删除)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在文本输入框中拦截按键
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // S 键切换智能吸附
      if (e.key === 's' || e.key === 'S') {
        setSnapEnabled(prev => !prev);
        return;
      }

      if (selectedElementIndex === null) return;

      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onMoveElementGeometry(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onMoveElementGeometry(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onMoveElementGeometry(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onMoveElementGeometry(0, step);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteElement();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSelectElement(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIndex, onMoveElementGeometry, onDeleteElement, onSelectElement]);

  // 计算视口顶层选框的实时屏幕物理位置 (联动图元拖拽偏移或 8 向缩放尺寸)
  const displayScreenBBox = useMemo(() => {
    if (!screenBBox) return null;
    if (dragMode === 'element') {
      return {
        x: screenBBox.x + screenDragOffset.x,
        y: screenBBox.y + screenDragOffset.y,
        width: screenBBox.width,
        height: screenBBox.height,
      };
    }
    if (dragMode === 'resize' && resizePreviewBBox && initialBBoxRef.current) {
      const origW = initialBBoxRef.current.width || 1;
      const origH = initialBBoxRef.current.height || 1;
      const scaleFactorX = resizePreviewBBox.width / origW;
      const scaleFactorY = resizePreviewBBox.height / origH;
      const screenDx = (resizePreviewBBox.x - initialBBoxRef.current.x) * scale;
      const screenDy = (resizePreviewBBox.y - initialBBoxRef.current.y) * scale;
      return {
        x: screenBBox.x + screenDx,
        y: screenBBox.y + screenDy,
        width: Math.max(8, screenBBox.width * scaleFactorX),
        height: Math.max(8, screenBBox.height * scaleFactorY),
      };
    }
    return screenBBox;
  }, [screenBBox, dragMode, screenDragOffset, resizePreviewBBox, scale]);

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

      {/* 视口顶层像素级精准选框与 8 向调整手柄 (100% 贴合屏幕物理像素，绝无错位) */}
      {selectedElementIndex !== null && displayScreenBBox && (
        <SvgSelectionGizmo
          displayScreenBBox={displayScreenBBox}
          dragMode={dragMode}
          selectedElementInfo={selectedElementInfo}
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

      {/* 属性微调检视器悬浮面板 (Scheme B) */}
      {selectedElementInfo && (
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
          onClose={() => onSelectElement(null)}
        />
      )}

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
