/**
 * OmniView SVG 矢量画布交互逻辑 Hook (SvgCanvas Interaction Logic)
 */
import * as React from 'react';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  SvgValidationResult,
  SvgElementInfo,
  ElementBBox,
  ResizeHandleDirection,
  CalculatedResizeBBox,
  SnapGuide,
  SvgPathNode,
  LinePresetType,
  parseSvgDimensions,
  calculateElementSnapping,
  calculateLineSnapping,
  calculateResizeBBox,
  calculateConstrainedLineEndpoint,
  parseSvgPathNodes,
  calculateUnionBBox,
} from './svgUtils';

export type DragMode =
  | 'none'
  | 'pan'
  | 'marquee'
  | 'element'
  | 'line-p1'
  | 'line-p2'
  | 'line-curve'
  | 'line-cp'
  | 'path-node'
  | 'path-cp'
  | 'resize';

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

export interface UseSvgCanvasInteractionOptions {
  svgContent: string;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  validation: SvgValidationResult;
  inspectorActive: boolean;
  selectedElementIndex: number | null;
  selectedElementIndices?: number[];
  selectedElementInfo: SvgElementInfo | null;
  onSelectElement: (index: number | null) => void;
  onSelectElements?: (indices: number[]) => void;
  onUpdateElement: (updates: Partial<SvgElementInfo>) => void;
  onDeleteElement: () => void;
  onBatchDeleteElements?: (indices: number[]) => void;
  onMoveElementGeometry: (deltaX: number, deltaY: number) => void;
  onBatchMoveElements?: (indices: number[], deltaX: number, deltaY: number) => void;
  onResizeElementGeometry?: (newBBox: CalculatedResizeBBox, initialBBox: ElementBBox) => void;
  onGroupElements?: () => void;
  onUngroupElement?: () => void;
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
  onAlignElement: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', bbox: ElementBBox) => void;
  onAlignLineOrthogonal: (mode: 'horizontal' | 'vertical') => void;
  onReverseLine?: () => void;
  onConvertToStepLine?: (mode: 'hv' | 'vh') => void;
  onApplyLinePreset?: (preset: LinePresetType) => void;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useSvgCanvasInteraction(options: UseSvgCanvasInteractionOptions) {
  const {
    svgContent,
    scale,
    setScale,
    position,
    setPosition,
    validation,
    inspectorActive,
    selectedElementIndex,
    selectedElementIndices = [],
    selectedElementInfo,
    onSelectElement,
    onSelectElements,
    onUpdateElement,
    onDeleteElement,
    onBatchDeleteElements,
    onMoveElementGeometry,
    onBatchMoveElements,
    onResizeElementGeometry,
    onGroupElements,
    onUngroupElement,
    activeTool = 'select',
    onChangeActiveTool,
    snap15Deg = false,
    onConvertToCurve,
    onUpdatePathNode,
    onAddNewLine,
    onAddNewPolyline,
    surfaceRef,
    containerRef,
  } = options;

  // 规范化当前有效选中的所有图元索引列表
  const effectiveSelectedIndices = useMemo(() => {
    if (selectedElementIndices && selectedElementIndices.length > 0) {
      return selectedElementIndices;
    }
    if (selectedElementIndex !== null) {
      return [selectedElementIndex];
    }
    return [];
  }, [selectedElementIndices, selectedElementIndex]);

  // 拖拽、平移与大小调整状态 (包含框选矩形、弯曲弧度、手柄拖拽与笔刷)
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleDirection | null>(null);
  const [resizePreviewBBox, setResizePreviewBBox] = useState<CalculatedResizeBBox | null>(null);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const dragMovedRef = useRef(false);

  // 画布自由拖拽框选矩形 (Marquee Selection Box)
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const marqueeSelectedIndicesRef = useRef<number[]>([]);

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

  // 选中图元在视口屏幕物理像素坐标系中的精确包围盒与线条端点 (用于选框与手柄 100% 紧密贴合渲染)
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

  // 统一测量函数：同时测量 SVG 内部空间 BBox 与视口屏幕真实物理像素坐标 (支持多选联合包围盒)
  const updateMeasurements = useCallback(() => {
    if (effectiveSelectedIndices.length === 0 || !containerRef.current || !surfaceRef.current) {
      setMeasuredBBox(null);
      setScreenBBox(null);
      setScreenLineCoords(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();

    // 0. 多选状态：计算所有被选图元的联合外包围盒 (Union BBox)
    if (effectiveSelectedIndices.length > 1) {
      const allBBoxes: ElementBBox[] = [];
      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;

      effectiveSelectedIndices.forEach(idx => {
        const el = surfaceRef.current?.querySelector(`[data-omni-id="${idx}"]`);
        if (el) {
          if ('getBBox' in el) {
            try {
              const b = (el as SVGGraphicsElement).getBBox();
              allBBoxes.push({
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                id: el.getAttribute('id') || undefined,
                tagName: el.tagName.toLowerCase(),
              });
            } catch {}
          }
          const rect = el.getBoundingClientRect();
          if (rect.left < minLeft) minLeft = rect.left;
          if (rect.top < minTop) minTop = rect.top;
          if (rect.right > maxRight) maxRight = rect.right;
          if (rect.bottom > maxBottom) maxBottom = rect.bottom;
        }
      });

      const union = calculateUnionBBox(allBBoxes);
      setMeasuredBBox(union);
      if (minLeft !== Infinity) {
        setScreenBBox({
          x: minLeft - containerRect.left,
          y: minTop - containerRect.top,
          width: Math.max(0, maxRight - minLeft),
          height: Math.max(0, maxBottom - minTop),
        });
      }
      setScreenLineCoords(null);
      setScreenControlPoint(null);
      setIsCurved(false);
      return;
    }

    const el = surfaceRef.current.querySelector(`[data-omni-id="${effectiveSelectedIndices[0]}"]`);
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

  // 收集兄弟节点及画布几何 (排除所有当前选中的图元，避免选区自吸附)
  const prepareDragContext = useCallback(
    (targetIndex?: number) => {
      canvasBoundsRef.current = parseSvgDimensions(svgContent);

      if (!surfaceRef.current) return;
      const siblings: ElementBBox[] = [];
      const allElements = surfaceRef.current.querySelectorAll('[data-omni-id]');
      const excludedSet = new Set<string>(effectiveSelectedIndices.map(String));
      if (targetIndex !== undefined) {
        excludedSet.add(String(targetIndex));
      }

      allElements.forEach(node => {
        const omniId = node.getAttribute('data-omni-id');
        if (omniId && !excludedSet.has(omniId) && 'getBBox' in node) {
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
    [svgContent, effectiveSelectedIndices]
  );

  // 滚轮缩放：以鼠标指针光标当前所在物理位置为焦点进行动态缩放 (Zoom toward Cursor)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) {
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setScale(prev => Math.min(8, Math.max(0.08, prev * zoomFactor)));
      return;
    }

    // 1. 获取视口容器尺寸与屏幕中心坐标
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 2. 计算当前鼠标指针相对于容器中心点的偏移向量
    const mouseOffsetX = e.clientX - centerX;
    const mouseOffsetY = e.clientY - centerY;

    // 3. 计算缩放因子：触控板捏合 (ctrlKey) 平滑连续缩放，鼠标滚轮阶梯缩放
    let zoomFactor: number;
    if (e.ctrlKey) {
      zoomFactor = Math.exp(-e.deltaY * 0.01);
    } else {
      zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    }

    const oldScale = scale;
    const newScale = Math.min(8, Math.max(0.08, oldScale * zoomFactor));

    if (Math.abs(newScale - oldScale) < 1e-5) return;

    const ratio = newScale / oldScale;

    // 4. 精确几何变换：保证鼠标光标所指的画布内容在缩放前后位于屏幕绝对同一物理像素点
    const newPosX = mouseOffsetX - (mouseOffsetX - position.x) * ratio;
    const newPosY = mouseOffsetY - (mouseOffsetY - position.y) * ratio;

    setScale(newScale);
    setPosition({
      x: Math.round(newPosX * 10) / 10,
      y: Math.round(newPosY * 10) / 10,
    });
  };

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

      const isModifierActive = e.shiftKey || e.ctrlKey || e.metaKey || isShiftPressed || isCtrlPressed;

      // 5.1 按住 Shift/Ctrl 进行加选/减选切换
      if (isModifierActive && targetIndex !== null) {
        let nextIndices: number[];
        if (effectiveSelectedIndices.includes(targetIndex)) {
          // 减选
          nextIndices = effectiveSelectedIndices.filter(i => i !== targetIndex);
        } else {
          // 加选
          nextIndices = [...effectiveSelectedIndices, targetIndex];
        }
        onSelectElements?.(nextIndices);
        onSelectElement(nextIndices.length > 0 ? nextIndices[nextIndices.length - 1] : null);
        return;
      }

      // 5.2 如果点击的是已经选中的图元集合之一，或者直接点击了选框 Gizmo：进入图元拖拽模式！
      const isTargetInSelection = targetIndex !== null && effectiveSelectedIndices.includes(targetIndex);
      if (isGizmoClick || isTargetInSelection) {
        setDragMode('element');
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setDragDelta({ x: 0, y: 0 });
        setScreenDragOffset({ x: 0, y: 0 });

        const primaryTargetIndex = isGizmoClick
          ? (selectedElementIndex ?? effectiveSelectedIndices[0] ?? 0)
          : targetIndex!;

        prepareDragContext(primaryTargetIndex);
        return;
      }

      // 5.3 如果点击了未选中的图元（无修饰键）：单选该图元并立即进入拖拽准备
      if (targetIndex !== null) {
        onSelectElements?.([targetIndex]);
        onSelectElement(targetIndex);
        setDragMode('element');
        dragMovedRef.current = false;
        dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        setDragDelta({ x: 0, y: 0 });
        setScreenDragOffset({ x: 0, y: 0 });
        prepareDragContext(targetIndex);
        return;
      }
    }

    // 6. 其它情况：点击空白画布区域
    // 如果是鼠标中键 (e.button === 1) 或按住 Alt/Space：进入画布平移拖拽
    if (e.button === 1 || e.altKey || isAltPressed) {
      setDragMode('pan');
      dragMovedRef.current = false;
      dragStartMouseRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      return;
    }

    // 默认左键点击空白处：开启自由矩形框选 (Marquee Selection)
    setDragMode('marquee');
    dragMovedRef.current = false;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    setMarqueeRect(null);
    marqueeSelectedIndicesRef.current = [];
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

    // A1. 画布空白处拖拽框选 (Marquee Selection)
    if (dragMode === 'marquee') {
      dragMovedRef.current = true;
      const startX = dragStartMouseRef.current.x;
      const startY = dragStartMouseRef.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const minX = Math.min(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxX = Math.max(startX, currentX);
      const maxY = Math.max(startY, currentY);
      const width = maxX - minX;
      const height = maxY - minY;

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setMarqueeRect({
          x: minX - containerRect.left,
          y: minY - containerRect.top,
          width,
          height,
        });
      }

      // 执行 AABB 碰撞检测，动态找出框选覆盖的所有图元
      if (width > 3 || height > 3) {
        const hitIndices: number[] = [];
        const allElements = surfaceRef.current?.querySelectorAll('[data-omni-id]');
        allElements?.forEach(el => {
          const rect = el.getBoundingClientRect();
          const isHit = !(
            rect.right < minX ||
            rect.left > maxX ||
            rect.bottom < minY ||
            rect.top > maxY
          );
          if (isHit) {
            const omniId = el.getAttribute('data-omni-id');
            if (omniId !== null) {
              hitIndices.push(parseInt(omniId, 10));
            }
          }
        });
        marqueeSelectedIndicesRef.current = hitIndices;
      }
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

    // D. 图元位置拖拽调整 (支持多选整体拖拽、智能吸附、网格吸附与 0 延迟实时 live 跟随)
    if (dragMode === 'element' && effectiveSelectedIndices.length > 0) {
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

      // 实时让所有被选中的 SVG DOM 元素与选框 100% 同步平移，彻底告别脱节感
      effectiveSelectedIndices.forEach(idx => {
        const activeEl = surfaceRef.current?.querySelector(`[data-omni-id="${idx}"]`) as SVGGraphicsElement | null;
        if (activeEl) {
          activeEl.style.transform = `translate(${finalDeltaX}px, ${finalDeltaY}px)`;
          activeEl.style.opacity = '0.85';
          activeEl.style.transition = 'none';
        }
      });
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

      const isAlt = e.altKey || isAltPressed;
      let calculated = calculateResizeBBox(
        initialBBoxRef.current,
        activeResizeHandle,
        deltaX,
        deltaY,
        e.shiftKey || isShiftPressed,
        4,
        isAlt
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

    // 清理 DOM 元素的临时内联变换样式 (支持所有当前被选图元)
    if (surfaceRef.current) {
      effectiveSelectedIndices.forEach(idx => {
        const activeEl = surfaceRef.current?.querySelector(`[data-omni-id="${idx}"]`) as SVGGraphicsElement | null;
        if (activeEl) {
          activeEl.style.transform = '';
          activeEl.style.opacity = '';
          activeEl.style.transition = '';
          activeEl.style.transformOrigin = '';
        }
      });
    }

    setDragMode('none');
    setActiveGuides([]);
    setScreenDragOffset({ x: 0, y: 0 });

    // 0. 框选拖拽完成 (Marquee Selection)
    if (currentMode === 'marquee') {
      setMarqueeRect(null);
      const hit = marqueeSelectedIndicesRef.current;
      const isModifier = e.shiftKey || e.ctrlKey || e.metaKey || isShiftPressed || isCtrlPressed;

      if (!moved || hit.length === 0) {
        // 单纯点击空白处且无命中的图元：取消全选
        if (!isModifier) {
          onSelectElements?.([]);
          onSelectElement(null);
        }
      } else {
        const finalIndices = isModifier
          ? Array.from(new Set([...effectiveSelectedIndices, ...hit]))
          : hit;
        onSelectElements?.(finalIndices);
        onSelectElement(finalIndices.length > 0 ? finalIndices[0] : null);
      }
      return;
    }

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

    // 6. 图元拖拽完成：将吸附与微调结果持久化写入 (支持多选批量位移)
    if (currentMode === 'element' && effectiveSelectedIndices.length > 0) {
      if (moved && (Math.abs(dragDelta.x) > 0.4 || Math.abs(dragDelta.y) > 0.4)) {
        if (effectiveSelectedIndices.length > 1 && onBatchMoveElements) {
          onBatchMoveElements(effectiveSelectedIndices, dragDelta.x, dragDelta.y);
        } else if (selectedElementIndex !== null) {
          onMoveElementGeometry(dragDelta.x, dragDelta.y);
        }
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
          const isModifier = e.shiftKey || e.ctrlKey || e.metaKey || isShiftPressed || isCtrlPressed;
          if (isModifier) {
            let next: number[];
            if (effectiveSelectedIndices.includes(parsed)) {
              next = effectiveSelectedIndices.filter(i => i !== parsed);
            } else {
              next = [...effectiveSelectedIndices, parsed];
            }
            onSelectElements?.(next);
            onSelectElement(next.length > 0 ? next[next.length - 1] : null);
          } else {
            onSelectElements?.([parsed]);
            onSelectElement(parsed);
          }
          return;
        }
      } else {
        // 仅当用户明确点击画布空白区域（非任何 UI 浮层）时，才取消选中
        onSelectElements?.([]);
        onSelectElement(null);
      }
    }
  };

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

  // 键盘快捷键微调支持 (方向键 ±1px / ±10px 键盘微调，S 键吸附开关，Delete 删除，Ctrl+A 全选，Ctrl+G 编组/解组)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在文本输入框中拦截按键
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // S 键切换智能吸附
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setSnapEnabled(prev => !prev);
        return;
      }

      // Ctrl+A / Cmd+A 全选所有图元
      if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const allNodes = surfaceRef.current?.querySelectorAll('[data-omni-id]');
        if (allNodes && allNodes.length > 0) {
          const allIndices = Array.from(allNodes).map((_, i) => i);
          onSelectElements?.(allIndices);
          onSelectElement(allIndices[0]);
        }
        return;
      }

      // Ctrl+G / Cmd+G 编组与解组
      if ((e.key === 'g' || e.key === 'G') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          // 解组
          onUngroupElement?.();
        } else {
          // 编组
          if (effectiveSelectedIndices.length > 1) {
            onGroupElements?.();
          }
        }
        return;
      }

      if (effectiveSelectedIndices.length === 0) return;

      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (effectiveSelectedIndices.length > 1 && onBatchMoveElements) {
          onBatchMoveElements(effectiveSelectedIndices, -step, 0);
        } else if (selectedElementIndex !== null) {
          onMoveElementGeometry(-step, 0);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (effectiveSelectedIndices.length > 1 && onBatchMoveElements) {
          onBatchMoveElements(effectiveSelectedIndices, step, 0);
        } else if (selectedElementIndex !== null) {
          onMoveElementGeometry(step, 0);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (effectiveSelectedIndices.length > 1 && onBatchMoveElements) {
          onBatchMoveElements(effectiveSelectedIndices, 0, -step);
        } else if (selectedElementIndex !== null) {
          onMoveElementGeometry(0, -step);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (effectiveSelectedIndices.length > 1 && onBatchMoveElements) {
          onBatchMoveElements(effectiveSelectedIndices, 0, step);
        } else if (selectedElementIndex !== null) {
          onMoveElementGeometry(0, step);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (effectiveSelectedIndices.length > 1 && onBatchDeleteElements) {
          onBatchDeleteElements(effectiveSelectedIndices);
        } else {
          onDeleteElement();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSelectElements?.([]);
        onSelectElement(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    effectiveSelectedIndices,
    selectedElementIndex,
    onMoveElementGeometry,
    onBatchMoveElements,
    onDeleteElement,
    onBatchDeleteElements,
    onSelectElement,
    onSelectElements,
    onGroupElements,
    onUngroupElement,
  ]);

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

  return {
    dragMode,
    setDragMode,
    activeResizeHandle,
    resizePreviewBBox,
    snapEnabled,
    setSnapEnabled,
    gridSnapEnabled,
    setGridSnapEnabled,
    gridSize,
    setGridSize,
    isCtrlPressed,
    isAltPressed,
    isShiftPressed,
    activeGuides,
    setActiveGuides,
    hoveredTag,
    setHoveredTag,
    marqueeRect,
    effectiveSelectedIndices,
    penPoints,
    penCursor,
    screenPathNodes,
    selectedNodeIndex,
    setSelectedNodeIndex,
    isCurved,
    screenControlPoint,
    screenBBox,
    screenLineCoords,
    screenDragOffset,
    measuredBBox,
    svgRootRef,
    currentCtmRef,
    canvasBoundsRef,
    lastValidSvgRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    updateMeasurements,
    displayScreenBBox,
  };
}
