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
} from './svgUtils';
import { SvgInspectorPanel } from './SvgInspectorPanel';

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // 拖拽、平移与大小调整状态
  type DragMode = 'none' | 'pan' | 'element' | 'line-p1' | 'line-p2' | 'resize';
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleDirection | null>(null);
  const [resizePreviewBBox, setResizePreviewBBox] = useState<CalculatedResizeBBox | null>(null);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const dragMovedRef = useRef(false);

  // 智能吸附与网格状态
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);

  // 选中图元在 SVG 内部用户坐标系中的测量包围盒 (用于检视面板数值与对齐算法)
  const [measuredBBox, setMeasuredBBox] = useState<ElementBBox | null>(null);
  const initialBBoxRef = useRef<ElementBBox | null>(null);
  const initialLineRef = useRef<{ p1: { x: number; y: number }; p2: { x: number; y: number } } | null>(null);
  const siblingBBoxesRef = useRef<ElementBBox[]>([]);
  const canvasBoundsRef = useRef<{ minX: number; minY: number; width: number; height: number }>({
    minX: 0,
    minY: 0,
    width: 800,
    height: 600,
  });

  // 监听键盘 Shift (等比约束) 以及快捷键 S (吸附切换) 与 G (网格切换)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 's' || e.key === 'S') {
        setSnapEnabled(prev => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        setGridSnapEnabled(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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

    // 4. 如果是线条图元，计算起点与终点在视口屏幕中的精确坐标
    if (el.tagName.toLowerCase() === 'line') {
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
    } else {
      setScreenLineCoords(null);
    }
  }, [selectedElementIndex]);

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

  // 鼠标按下：区分 Resize 手柄、线条端点拖动、图元拖动与画布平移
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

    // 2. 检查是否点击了线条端点控制手柄 (p1 或 p2)
    const lineHandle = target.closest('[data-line-handle]');
    if (lineHandle && selectedElementInfo && selectedElementInfo.tagName === 'line') {
      const which = lineHandle.getAttribute('data-line-handle') as 'p1' | 'p2';
      setDragMode(which === 'p1' ? 'line-p1' : 'line-p2');
      dragMovedRef.current = false;
      dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
      setScreenDragOffset({ x: 0, y: 0 });

      const x1 = parseFloat(selectedElementInfo.x1 || '0');
      const y1 = parseFloat(selectedElementInfo.y1 || '0');
      const x2 = parseFloat(selectedElementInfo.x2 || '0');
      const y2 = parseFloat(selectedElementInfo.y2 || '0');
      initialLineRef.current = { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } };

      if (selectedElementIndex !== null) {
        prepareDragContext(selectedElementIndex);
      }
      return;
    }

    // 3. 检查是否点击了当前选中图元的包围选框 Gizmo
    const isGizmoClick = !!target.closest('[data-selected-gizmo]');

    // 4. 检查是否在检视模式下点击了图元
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

    // 5. 其它情况：进入画布平移拖拽
    setDragMode('pan');
    dragMovedRef.current = false;
    dragStartMouseRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    // A. 画布平移
    if (dragMode === 'pan') {
      dragMovedRef.current = true;
      setPosition({
        x: e.clientX - dragStartMouseRef.current.x,
        y: e.clientY - dragStartMouseRef.current.y,
      });
      return;
    }

    // B. 图元位置拖拽调整 (带智能吸附、网格吸附与 0 延迟实时 live 跟随)
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

    // C. 8 向大小调整 (Resize 拖拽缩放与实时等比提示)
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

    // D. 线条单端点拖拽调整 (带水平/垂直/45°吸附与锚点磁吸)
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

    // E. 非拖拽状态下：悬浮图元名称探测
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

    // 1. 大小调整完成：写入更新后的尺寸与位置
    if (currentMode === 'resize' && selectedElementIndex !== null && resizePreviewBBox && initialBBoxRef.current) {
      if (moved && onResizeElementGeometry) {
        onResizeElementGeometry(resizePreviewBBox, initialBBoxRef.current);
      }
      setResizePreviewBBox(null);
      setActiveResizeHandle(null);
      return;
    }

    // 2. 图元拖拽完成：将吸附与微调结果持久化写入
    if (currentMode === 'element' && selectedElementIndex !== null) {
      if (moved && (Math.abs(dragDelta.x) > 0.4 || Math.abs(dragDelta.y) > 0.4)) {
        onMoveElementGeometry(dragDelta.x, dragDelta.y);
      }
      setDragDelta({ x: 0, y: 0 });
      return;
    }

    // 3. 线条端点拖拽完成：写入新的端点坐标
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
        onUpdateElement({
          x1: String(round2(snapped.p1.x)),
          y1: String(round2(snapped.p1.y)),
          x2: String(round2(snapped.p2.x)),
          y2: String(round2(snapped.p2.y)),
        });
      }
      return;
    }

    // 4. 点击点选图元逻辑（未发生大距离拖拽平移时）
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
        target.closest('[data-line-handle]')
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
          ? 'bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950'
          : bgMode === 'light-grid'
          ? 'bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] bg-slate-200'
          : bgMode === 'white'
          ? 'bg-white'
          : bgMode === 'transparent'
          ? 'bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px] bg-slate-900'
          : 'bg-slate-950'
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
          <div className="absolute -bottom-6.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/95 text-slate-200 border border-slate-700 font-mono text-[10px] whitespace-nowrap shadow-lg backdrop-blur-xs pointer-events-none">
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
      )}

      {/* 线条专属：视口顶层起点与终点独立拖拽圆形手柄与动态指标气泡 */}
      {selectedElementIndex !== null && screenLineCoords && (
        <>
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-25 overflow-visible">
            {/* P1 起点圆形手柄 */}
            <circle
              cx={screenLineCoords.x1 + (dragMode === 'element' || dragMode === 'line-p1' ? screenDragOffset.x : 0)}
              cy={screenLineCoords.y1 + (dragMode === 'element' || dragMode === 'line-p1' ? screenDragOffset.y : 0)}
              r={7}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth={2}
              data-line-handle="p1"
              className="cursor-crosshair hover:scale-125 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(59,130,246,0.8))"
            />
            {/* P2 终点圆形手柄 */}
            <circle
              cx={screenLineCoords.x2 + (dragMode === 'element' || dragMode === 'line-p2' ? screenDragOffset.x : 0)}
              cy={screenLineCoords.y2 + (dragMode === 'element' || dragMode === 'line-p2' ? screenDragOffset.y : 0)}
              r={7}
              fill="#06b6d4"
              stroke="#ffffff"
              strokeWidth={2}
              data-line-handle="p2"
              className="cursor-crosshair hover:scale-125 transition-transform pointer-events-auto filter drop-shadow(0 0 4px rgba(6,182,212,0.8))"
            />
          </svg>

          {/* 实时几何指标浮标 (显示在线条中点上方) */}
          <div
            className="absolute z-26 pointer-events-none -translate-x-1/2 -translate-y-1/2 select-none"
            style={{
              left: (screenLineCoords.x1 + screenLineCoords.x2) / 2 + (dragMode === 'element' ? screenDragOffset.x : 0),
              top: (screenLineCoords.y1 + screenLineCoords.y2) / 2 + (dragMode === 'element' ? screenDragOffset.y : 0) - 16,
            }}
          >
            <div className="px-1.5 py-0.5 rounded bg-slate-950/90 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono whitespace-nowrap shadow-lg flex items-center gap-1.5 backdrop-blur-xs">
              <span>
                📏{' '}
                {Math.round(
                  Math.hypot(
                    parseFloat(selectedElementInfo?.x2 || '0') - parseFloat(selectedElementInfo?.x1 || '0'),
                    parseFloat(selectedElementInfo?.y2 || '0') - parseFloat(selectedElementInfo?.y1 || '0')
                  )
                )}
                px
              </span>
              <span className="text-slate-600">|</span>
              <span>
                📐{' '}
                {Math.round(
                  (((Math.atan2(
                    parseFloat(selectedElementInfo?.y2 || '0') - parseFloat(selectedElementInfo?.y1 || '0'),
                    parseFloat(selectedElementInfo?.x2 || '0') - parseFloat(selectedElementInfo?.x1 || '0')
                  ) *
                    180) /
                    Math.PI +
                    360) %
                    360) *
                    10
                ) / 10}
                °
              </span>
            </div>
          </div>
        </>
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
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled(prev => !prev)}
          onClose={() => onSelectElement(null)}
        />
      )}

      {/* 底部交互辅助指示与吸附开关状态栏 */}
      <div
        id="canvas-statusbar"
        data-canvas-ui="true"
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        className="absolute bottom-3 left-4 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 shadow-md z-30 select-none pointer-events-auto"
      >
        <div className="flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-cyan-400" />
          <span>平移 · 缩放 ({Math.round(scale * 100)}%)</span>
        </div>

        {inspectorActive && (
          <>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
              <Crosshair className="w-3.5 h-3.5" />
              <span>拖调/缩放</span>
              {hoveredTag && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-[10px]">
                  {hoveredTag}
                </span>
              )}
            </div>

            <span className="text-slate-700">|</span>
            {/* 智能吸附一键切换按钮 */}
            <button
              type="button"
              onClick={() => setSnapEnabled(prev => !prev)}
              title="按 S 键快速切换智能吸附"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-[10px] font-medium cursor-pointer ${
                snapEnabled
                  ? 'bg-pink-950/70 text-pink-300 border border-pink-500/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Magnet className={`w-3 h-3 ${snapEnabled ? 'text-pink-400' : 'text-slate-500'}`} />
              <span>智能吸附: {snapEnabled ? '开' : '关'}</span>
              <kbd className="ml-0.5 px-1 py-0.2 rounded bg-slate-800/80 text-[9px] text-slate-400 font-mono">S</kbd>
            </button>

            {/* 网格吸附切换与网格步长选择 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGridSnapEnabled(prev => !prev)}
                title="按 G 键快速切换网格吸附"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-[10px] font-medium cursor-pointer ${
                  gridSnapEnabled
                    ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Hash className={`w-3 h-3 ${gridSnapEnabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>网格吸附: {gridSnapEnabled ? '开' : '关'}</span>
                <kbd className="ml-0.5 px-1 py-0.2 rounded bg-slate-800/80 text-[9px] text-slate-400 font-mono">G</kbd>
              </button>

              {/* 网格大小快捷药丸 */}
              {gridSnapEnabled && (
                <div className="flex items-center bg-slate-800/90 rounded border border-slate-700/60 p-0.5 ml-0.5">
                  {[10, 20, 50].map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setGridSize(sz)}
                      className={`px-1.5 py-0.2 text-[9px] font-mono rounded transition-colors ${
                        gridSize === sz
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sz}px
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
