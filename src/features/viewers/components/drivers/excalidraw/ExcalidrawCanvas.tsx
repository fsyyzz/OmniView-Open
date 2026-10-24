import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Locale } from '../../../../../shared/lib/i18n';
import { ExcalidrawParsedData, sanitizeExcalidrawElements, autoCreateFrames } from './excalidrawEngine';
import { ExcalidrawStencil } from './excalidrawTemplates';
import {
  ExcalidrawToolId,
  ResizeHandleType,
  AnchorPort,
  SnapGuide,
  DEFAULT_EXCALIDRAW_STYLE,
  ExcalidrawDefaultStyle,
  AlignmentAction,
  LayerOrderAction,
  generateRoughRectPath,
  generateRoughDiamondPath,
  generateRoughEllipsePath,
  generateHachureFillPath,
  getElementBounds,
  getSelectionBounds,
  hitTestElements,
  getElementsInMarquee,
  getResizeHandles,
  computeSmartSnap,
  getElementAnchorPorts,
  findNearestSnapPort,
  syncBoundElementsAfterTransform,
  alignAndDistributeElements,
  reorderElementsLayer,
  cloneSelectedElements,
  groupSelectedElements,
  ungroupSelectedElements,
} from './excalidrawStudioEngine';
import { ExcalidrawTopToolDock } from './ExcalidrawTopToolDock';
import { ExcalidrawLeftDock } from './ExcalidrawLeftDock';
import { ExcalidrawRightInspector } from './ExcalidrawRightInspector';
import { ExcalidrawContextMenu, ExcalidrawMinimap } from './ExcalidrawContextMenu';

export interface ExcalidrawCanvasProps {
  initialParsedData: ExcalidrawParsedData;
  isDarkTheme: boolean;
  locale: Locale;
  showGrid: boolean;
  isZenMode: boolean;
  isViewOnly: boolean;
  onDocChange?: (newJson: string) => void;
  onApiReady?: (api: any) => void;
  onLibraryLoaded?: (count: number) => void;
  customStencils?: ExcalidrawStencil[];
  onSaveSelectedAsStencil?: () => void;
  onOpenFullMaterialsModal?: () => void;
}

interface InlineTextEditState {
  elementId: string;
  containerId?: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  strokeColor: string;
  isNew?: boolean;
}

export const ExcalidrawCanvas: React.FC<ExcalidrawCanvasProps> = ({
  initialParsedData,
  isDarkTheme,
  locale,
  showGrid,
  isZenMode,
  isViewOnly,
  onDocChange,
  onApiReady,
  onLibraryLoaded,
  customStencils = [],
  onSaveSelectedAsStencil,
  onOpenFullMaterialsModal,
}) => {
  const isZh = locale === 'zh-CN';

  // 核心图元与画布状态
  const [elements, setElements] = useState<any[]>(() =>
    sanitizeExcalidrawElements(initialParsedData?.elements || [])
  );
  const [canvasBgColor, setCanvasBgColor] = useState<string>(
    () => initialParsedData?.appState?.viewBackgroundColor || (isDarkTheme ? '#121212' : '#ffffff')
  );

  // 撤销 / 重做历史栈
  const [history, setHistory] = useState<any[][]>(() => [
    sanitizeExcalidrawElements(initialParsedData?.elements || []),
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const lastEmittedJsonRef = useRef<string>('');

  // PC 端工具坞、停靠面板与选择状态
  const [activeTool, setActiveTool] = useState<ExcalidrawToolId>('select');
  const [tempHandMode, setTempHandMode] = useState<boolean>(false);
  const [keepToolActive, setKeepToolActive] = useState<boolean>(false);
  const [smartSnapEnabled, setSmartSnapEnabled] = useState<boolean>(true);
  const [showLeftDock, setShowLeftDock] = useState<boolean>(true);
  const [showRightInspector, setShowRightInspector] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultStyle, setDefaultStyle] = useState<ExcalidrawDefaultStyle>(DEFAULT_EXCALIDRAW_STYLE);
  const clipboardRef = useRef<any[]>([]);

  // 视口变换 (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 40 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 960,
    height: 640,
  });

  // 交互手势瞬态
  const interactionRef = useRef<{
    mode: 'idle' | 'panning' | 'marquee' | 'moving' | 'resizing' | 'drawing' | 'erasing';
    startScreenX: number;
    startScreenY: number;
    startWorldX: number;
    startWorldY: number;
    startPanX: number;
    startPanY: number;
    resizeHandle?: ResizeHandleType;
    initialElementsSnapshot: any[];
    initialBoundsMap: Map<string, { x: number; y: number; width: number; height: number; points?: number[][] }>;
    drawingElementId?: string;
    startSnapPort?: AnchorPort | null;
    altDuplicated?: boolean;
  }>({
    mode: 'idle',
    startScreenX: 0,
    startScreenY: 0,
    startWorldX: 0,
    startWorldY: 0,
    startPanX: 0,
    startPanY: 0,
    initialElementsSnapshot: [],
    initialBoundsMap: new Map(),
  });

  const [marqueeBox, setMarqueeBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [hoveredSnapPort, setHoveredSnapPort] = useState<AnchorPort | null>(null);
  const [editingText, setEditingText] = useState<InlineTextEditState | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 监听视口容器尺寸
  useEffect(() => {
    if (!viewportRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportSize({
          width: Math.max(320, entry.contentRect.width),
          height: Math.max(240, entry.contentRect.height),
        });
      }
    });
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);

  // 同步外部传入的新数据（避免自身回写引起的循环重置）
  useEffect(() => {
    const incomingStr = JSON.stringify(initialParsedData?.elements || []);
    if (incomingStr === lastEmittedJsonRef.current) return;
    const clean = sanitizeExcalidrawElements(initialParsedData?.elements || []);
    setElements(clean);
    setHistory([clean]);
    setHistoryIndex(0);
    lastEmittedJsonRef.current = JSON.stringify(clean);
  }, [initialParsedData]);

  // 提交原子变更到历史栈并通知父组件保存
  const commitElements = useCallback(
    (nextElements: any[], nextBgColor?: string) => {
      const clean = sanitizeExcalidrawElements(nextElements);
      setElements(clean);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const next = [...sliced, clean].slice(-80);
        setHistoryIndex(next.length - 1);
        return next;
      });
      lastEmittedJsonRef.current = JSON.stringify(clean);
      const docObj = {
        type: 'excalidraw',
        version: 2,
        source: 'https://omniview.dev',
        elements: clean,
        appState: {
          ...initialParsedData.appState,
          viewBackgroundColor: nextBgColor ?? canvasBgColor,
          gridSize: showGrid ? 20 : null,
        },
        files: initialParsedData.files || {},
      };
      onDocChange?.(JSON.stringify(docObj, null, 2));
    },
    [historyIndex, initialParsedData.appState, initialParsedData.files, canvasBgColor, showGrid, onDocChange]
  );

  // 撤销与重做
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    const snapshot = history[nextIdx];
    setHistoryIndex(nextIdx);
    setElements(snapshot);
    lastEmittedJsonRef.current = JSON.stringify(snapshot);
    const docObj = {
      type: 'excalidraw',
      version: 2,
      source: 'https://omniview.dev',
      elements: snapshot,
      appState: { ...initialParsedData.appState, viewBackgroundColor: canvasBgColor },
      files: initialParsedData.files || {},
    };
    onDocChange?.(JSON.stringify(docObj, null, 2));
  }, [history, historyIndex, initialParsedData.appState, initialParsedData.files, canvasBgColor, onDocChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    const snapshot = history[nextIdx];
    setHistoryIndex(nextIdx);
    setElements(snapshot);
    lastEmittedJsonRef.current = JSON.stringify(snapshot);
    const docObj = {
      type: 'excalidraw',
      version: 2,
      source: 'https://omniview.dev',
      elements: snapshot,
      appState: { ...initialParsedData.appState, viewBackgroundColor: canvasBgColor },
      files: initialParsedData.files || {},
    };
    onDocChange?.(JSON.stringify(docObj, null, 2));
  }, [history, historyIndex, initialParsedData.appState, initialParsedData.files, canvasBgColor, onDocChange]);

  // 居中聚焦指定图元或全量内容
  const scrollToContent = useCallback(
    (targetElement?: any) => {
      const targetList = targetElement
        ? [targetElement]
        : elements.filter((el) => el && !el.isDeleted && !el.isHidden);
      if (targetList.length === 0) {
        setZoom(1);
        setPan({ x: 80, y: 60 });
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      targetList.forEach((el) => {
        const b = getElementBounds(el);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.right);
        maxY = Math.max(maxY, b.bottom);
      });
      const contentW = Math.max(120, maxX - minX);
      const contentH = Math.max(100, maxY - minY);
      const pad = 80;
      const scaleX = (viewportSize.width - pad * 2) / contentW;
      const scaleY = (viewportSize.height - pad * 2) / contentH;
      const nextZoom = Math.min(1.5, Math.max(0.25, Number(Math.min(scaleX, scaleY).toFixed(2))));
      const cx = minX + contentW / 2;
      const cy = minY + contentH / 2;
      setZoom(nextZoom);
      setPan({
        x: viewportSize.width / 2 - cx * nextZoom,
        y: viewportSize.height / 2 - cy * nextZoom,
      });
    },
    [elements, viewportSize]
  );

  // 暴露给父组件 ExcalidrawViewer 的命令式 API
  useEffect(() => {
    onApiReady?.({
      scrollToContent,
      updateScene: (scene: { elements?: any[]; appState?: Record<string, any> }) => {
        if (Array.isArray(scene.elements)) {
          commitElements(scene.elements);
        }
      },
      getSceneElements: () => elements,
      getSelectedElements: () => elements.filter((el) => selectedIds.has(el.id)),
      updateLibrary: async (opts?: { libraryItems?: any[] }) => {
        const count = opts?.libraryItems?.length || 0;
        onLibraryLoaded?.(count);
      },
      refresh: () => {},
    });
  }, [onApiReady, scrollToContent, commitElements, elements, selectedIds, onLibraryLoaded]);

  // 常用批量操作回调
  const handleDeleteSelected = useCallback(() => {
    if (isViewOnly || selectedIds.size === 0) return;
    const next = elements.filter(
      (el) => !selectedIds.has(el.id) && !(el.type === 'text' && el.containerId && selectedIds.has(el.containerId))
    );
    setSelectedIds(new Set());
    commitElements(next);
  }, [isViewOnly, selectedIds, elements, commitElements]);

  const handleDuplicateSelected = useCallback(() => {
    if (isViewOnly || selectedIds.size === 0) return;
    const { nextElements, newSelectedIds } = cloneSelectedElements(elements, selectedIds, 28, 28);
    setSelectedIds(new Set(newSelectedIds));
    commitElements(nextElements);
  }, [isViewOnly, selectedIds, elements, commitElements]);

  const handleCopySelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    clipboardRef.current = elements.filter(
      (el) => selectedIds.has(el.id) || (el.type === 'text' && el.containerId && selectedIds.has(el.containerId))
    );
  }, [selectedIds, elements]);

  const handlePaste = useCallback(() => {
    if (isViewOnly || clipboardRef.current.length === 0) return;
    const ids = new Set(clipboardRef.current.map((el) => el.id));
    const { nextElements, newSelectedIds } = cloneSelectedElements(
      [...elements, ...clipboardRef.current.filter((c) => !elements.some((e) => e.id === c.id))],
      ids,
      36,
      36
    );
    setSelectedIds(new Set(newSelectedIds));
    commitElements(nextElements);
  }, [isViewOnly, elements, commitElements]);

  const handleAlign = useCallback(
    (action: AlignmentAction) => {
      if (isViewOnly || selectedIds.size < 2) return;
      const next = alignAndDistributeElements(elements, selectedIds, action);
      commitElements(next);
    },
    [isViewOnly, selectedIds, elements, commitElements]
  );

  const handleLayerOrder = useCallback(
    (action: LayerOrderAction) => {
      if (isViewOnly || selectedIds.size === 0) return;
      const next = reorderElementsLayer(elements, selectedIds, action);
      commitElements(next);
    },
    [isViewOnly, selectedIds, elements, commitElements]
  );

  const handleGroup = useCallback(() => {
    if (isViewOnly || selectedIds.size < 2) return;
    commitElements(groupSelectedElements(elements, selectedIds));
  }, [isViewOnly, selectedIds, elements, commitElements]);

  const handleUngroup = useCallback(() => {
    if (isViewOnly || selectedIds.size === 0) return;
    commitElements(ungroupSelectedElements(elements, selectedIds));
  }, [isViewOnly, selectedIds, elements, commitElements]);

  // 全局键盘单键与组合快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' && !tempHandMode) {
        e.preventDefault();
        setTempHandMode(true);
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          handleDuplicateSelected();
          return;
        }
        if (key === 'c') {
          handleCopySelected();
          return;
        }
        if (key === 'v') {
          handlePaste();
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          const allIds = elements
            .filter((el) => el && !el.isDeleted && !el.isHidden && !el.locked && !(el.type === 'text' && el.containerId))
            .map((el) => el.id);
          setSelectedIds(new Set(allIds));
          return;
        }
        if (key === 'g' && !e.shiftKey) {
          e.preventDefault();
          handleGroup();
          return;
        }
        if (key === 'g' && e.shiftKey) {
          e.preventDefault();
          handleUngroup();
          return;
        }
        if (key === ']') {
          e.preventDefault();
          handleLayerOrder(e.shiftKey ? 'front' : 'forward');
          return;
        }
        if (key === '[') {
          e.preventDefault();
          handleLayerOrder(e.shiftKey ? 'back' : 'backward');
          return;
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setContextMenu(null);
        setActiveTool('select');
        return;
      }

      // 方向键微调选中图元 (1px / Shift 10px)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0 && !isViewOnly) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const moved = syncBoundElementsAfterTransform(
          elements.map((el) => (selectedIds.has(el.id) && !el.locked ? { ...el, x: (el.x || 0) + dx, y: (el.y || 0) + dy } : el))
        );
        commitElements(moved);
        return;
      }

      // 单键快速切换绘图工具
      const k = e.key.toLowerCase();
      if (k === 'v' || k === '1') setActiveTool('select');
      else if (k === 'h') setActiveTool('hand');
      else if (k === 'r' || k === '2') setActiveTool('rectangle');
      else if (k === 'd' || k === '3') setActiveTool('diamond');
      else if (k === 'o' || k === '4') setActiveTool('ellipse');
      else if (k === 'a' || k === '5') setActiveTool('arrow');
      else if (k === 'l' || k === '6') setActiveTool('line');
      else if (k === 'p' || k === '7') setActiveTool('freedraw');
      else if (k === 't' || k === '8') setActiveTool('text');
      else if (k === 'f' || k === '9') setActiveTool('frame');
      else if (k === 'e' || k === '0') setActiveTool('eraser');
      else if (k === 'q') setKeepToolActive((v) => !v);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setTempHandMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    tempHandMode,
    handleUndo,
    handleRedo,
    handleDuplicateSelected,
    handleCopySelected,
    handlePaste,
    handleGroup,
    handleUngroup,
    handleLayerOrder,
    handleDeleteSelected,
    selectedIds,
    elements,
    isViewOnly,
    commitElements,
  ]);

  // 屏幕坐标转画布世界坐标
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const offsetX = rect ? clientX - rect.left : clientX;
      const offsetY = rect ? clientY - rect.top : clientY;
      return {
        x: (offsetX - pan.x) / zoom,
        y: (offsetY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const selectedBounds = useMemo(() => getSelectionBounds(elements, selectedIds), [elements, selectedIds]);
  const effectiveTool: ExcalidrawToolId = isViewOnly ? 'hand' : tempHandMode ? 'hand' : activeTool;

  // 双击图元或空白画布启动原地内联文字编辑
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (isViewOnly) return;
    e.stopPropagation();
    const world = screenToWorld(e.clientX, e.clientY);
    const hit = hitTestElements(elements, world.x, world.y);

    if (hit && ['rectangle', 'diamond', 'ellipse'].includes(hit.type)) {
      const b = getElementBounds(hit);
      const existingBoundText = elements.find(
        (el) => el && !el.isDeleted && el.type === 'text' && el.containerId === hit.id
      );
      setEditingText({
        elementId: existingBoundText ? existingBoundText.id : `text-${Date.now()}`,
        containerId: hit.id,
        text: existingBoundText ? String(existingBoundText.text || '') : '',
        x: b.x + 12,
        y: b.cy - 14,
        width: Math.max(80, b.width - 24),
        height: Math.max(32, b.height - 16),
        fontSize: existingBoundText?.fontSize || defaultStyle.fontSize,
        strokeColor: hit.strokeColor || defaultStyle.strokeColor,
        isNew: !existingBoundText,
      });
      setTimeout(() => inlineTextareaRef.current?.focus(), 20);
      return;
    }

    if (hit && hit.type === 'text') {
      const b = getElementBounds(hit);
      setEditingText({
        elementId: hit.id,
        containerId: hit.containerId || undefined,
        text: String(hit.text || ''),
        x: b.x,
        y: b.y,
        width: Math.max(120, b.width + 20),
        height: Math.max(32, b.height + 10),
        fontSize: hit.fontSize || defaultStyle.fontSize,
        strokeColor: hit.strokeColor || defaultStyle.strokeColor,
        isNew: false,
      });
      setTimeout(() => inlineTextareaRef.current?.focus(), 20);
      return;
    }

    // 双击空白处直接新建独立文字
    const newId = `text-${Date.now()}`;
    setEditingText({
      elementId: newId,
      text: '',
      x: world.x,
      y: world.y - 10,
      width: 180,
      height: 36,
      fontSize: defaultStyle.fontSize,
      strokeColor: defaultStyle.strokeColor,
      isNew: true,
    });
    setTimeout(() => inlineTextareaRef.current?.focus(), 20);
  };

  // 提交内联文字编辑
  const handleCommitInlineText = () => {
    if (!editingText) return;
    const trimmed = editingText.text.trim();
    const { elementId, containerId, fontSize, strokeColor, x, y, width } = editingText;
    setEditingText(null);

    if (!trimmed) {
      if (!editingText.isNew) {
        commitElements(elements.filter((el) => el.id !== elementId));
      }
      return;
    }

    const lines = trimmed.split('\n');
    const calcH = Math.max(24, lines.length * fontSize * 1.3);
    const calcW = containerId ? width : Math.max(60, Math.max(...lines.map((l) => l.length)) * fontSize * 0.65);

    const existingIdx = elements.findIndex((el) => el.id === elementId);
    let next = [...elements];

    const textNode = {
      id: elementId,
      type: 'text',
      x,
      y,
      width: calcW,
      height: calcH,
      text: trimmed,
      fontSize,
      fontFamily: defaultStyle.fontFamily,
      textAlign: containerId ? 'center' : defaultStyle.textAlign,
      verticalAlign: containerId ? 'middle' : 'top',
      containerId: containerId || null,
      strokeColor,
      backgroundColor: 'transparent',
      opacity: 100,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      isDeleted: false,
    };

    if (existingIdx >= 0) {
      next[existingIdx] = { ...next[existingIdx], ...textNode };
    } else {
      next.push(textNode);
    }

    if (containerId) {
      next = next.map((el) => {
        if (el.id !== containerId) return el;
        const bound = Array.isArray(el.boundElements) ? el.boundElements : [];
        const hasRef = bound.some((b: any) => b.id === elementId);
        return {
          ...el,
          boundElements: hasRef ? bound : [...bound, { id: elementId, type: 'text' }],
        };
      });
    }

    commitElements(syncBoundElementsAfterTransform(next));
  };

  // 鼠标按下：分发漫游、缩放手柄、图形移动、框选或新图元绘制
  const handlePointerDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    if (editingText) {
      handleCommitInlineText();
    }

    const world = screenToWorld(e.clientX, e.clientY);

    // 中键或抓手工具 -> 平移画布
    if (e.button === 1 || effectiveTool === 'hand') {
      interactionRef.current = {
        mode: 'panning',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startWorldX: world.x,
        startWorldY: world.y,
        startPanX: pan.x,
        startPanY: pan.y,
        initialElementsSnapshot: elements,
        initialBoundsMap: new Map(),
      };
      return;
    }

    if (e.button !== 0) return;

    // 1. 选择工具下优先检测是否点中 8 向缩放控制点
    if (effectiveTool === 'select' && selectedBounds && selectedIds.size > 0) {
      const handles = getResizeHandles(selectedBounds);
      const handleRadius = 8 / zoom;
      const hitHandle = handles.find((h) => Math.hypot(world.x - h.x, world.y - h.y) <= handleRadius + 2);
      if (hitHandle) {
        const boundsMap = new Map<string, { x: number; y: number; width: number; height: number; points?: number[][] }>();
        elements.forEach((el) => {
          if (selectedIds.has(el.id)) {
            const b = getElementBounds(el);
            boundsMap.set(el.id, { x: b.x, y: b.y, width: b.width, height: b.height, points: el.points });
          }
        });
        interactionRef.current = {
          mode: 'resizing',
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startWorldX: world.x,
          startWorldY: world.y,
          startPanX: pan.x,
          startPanY: pan.y,
          resizeHandle: hitHandle.type,
          initialElementsSnapshot: elements,
          initialBoundsMap: boundsMap,
        };
        return;
      }
    }

    // 2. 选择工具下检测是否点中图元或空白框选
    if (effectiveTool === 'select') {
      const hit = hitTestElements(elements, world.x, world.y, 8 / zoom);
      if (hit) {
        let nextSel = new Set(selectedIds);
        // 连带选中同组图元
        const groupIds: string[] = Array.isArray(hit.groupIds) ? hit.groupIds : [];
        const groupMembers =
          groupIds.length > 0
            ? elements.filter((el) => Array.isArray(el.groupIds) && el.groupIds.some((g: string) => groupIds.includes(g))).map((el) => el.id)
            : [hit.id];

        if (e.shiftKey) {
          if (nextSel.has(hit.id)) groupMembers.forEach((id) => nextSel.delete(id));
          else groupMembers.forEach((id) => nextSel.add(id));
        } else if (!nextSel.has(hit.id)) {
          nextSel = new Set(groupMembers);
        }

        let workingElements = elements;
        // 支持 Alt + 拖拽直接复制选中图元并移动新副本
        if (e.altKey && !hit.locked) {
          const cloned = cloneSelectedElements(elements, nextSel, 0, 0);
          workingElements = cloned.nextElements;
          nextSel = new Set(cloned.newSelectedIds);
          setElements(workingElements);
        }

        setSelectedIds(nextSel);

        if (!hit.locked) {
          const boundsMap = new Map<string, { x: number; y: number; width: number; height: number }>();
          workingElements.forEach((el) => {
            if (nextSel.has(el.id) || (el.type === 'text' && el.containerId && nextSel.has(el.containerId))) {
              boundsMap.set(el.id, { x: el.x || 0, y: el.y || 0, width: el.width || 0, height: el.height || 0 });
            }
          });
          interactionRef.current = {
            mode: 'moving',
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            startWorldX: world.x,
            startWorldY: world.y,
            startPanX: pan.x,
            startPanY: pan.y,
            initialElementsSnapshot: workingElements,
            initialBoundsMap: boundsMap,
          };
        }
      } else {
        if (!e.shiftKey) setSelectedIds(new Set());
        interactionRef.current = {
          mode: 'marquee',
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startWorldX: world.x,
          startWorldY: world.y,
          startPanX: pan.x,
          startPanY: pan.y,
          initialElementsSnapshot: elements,
          initialBoundsMap: new Map(),
        };
        setMarqueeBox({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
      }
      return;
    }

    // 3. 橡皮擦工具
    if (effectiveTool === 'eraser') {
      const hit = hitTestElements(elements, world.x, world.y, 10 / zoom);
      const next = hit
        ? elements.filter((el) => el.id !== hit.id && el.containerId !== hit.id)
        : elements;
      setElements(next);
      interactionRef.current = {
        mode: 'erasing',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startWorldX: world.x,
        startWorldY: world.y,
        startPanX: pan.x,
        startPanY: pan.y,
        initialElementsSnapshot: next,
        initialBoundsMap: new Map(),
      };
      return;
    }

    // 4. 文本工具：单击立即在点击位置打开内联输入
    if (effectiveTool === 'text') {
      const newId = `text-${Date.now()}`;
      setEditingText({
        elementId: newId,
        text: '',
        x: world.x,
        y: world.y - 10,
        width: 180,
        height: 34,
        fontSize: defaultStyle.fontSize,
        strokeColor: defaultStyle.strokeColor,
        isNew: true,
      });
      if (!keepToolActive) setActiveTool('select');
      setTimeout(() => inlineTextareaRef.current?.focus(), 20);
      return;
    }

    // 5. 绘制几何形状 / 箭头 / 线条 / 自由画笔 / 画框 Frame
    const newId = `${effectiveTool}-${Date.now()}`;
    const startPort =
      effectiveTool === 'arrow' && smartSnapEnabled
        ? findNearestSnapPort(elements, world.x, world.y, 28 / zoom)
        : null;
    const startX = startPort ? startPort.x : world.x;
    const startY = startPort ? startPort.y : world.y;

    const newElement: any = {
      id: newId,
      type: effectiveTool,
      x: startX,
      y: startY,
      width: 1,
      height: 1,
      angle: 0,
      strokeColor: effectiveTool === 'frame' ? '#64748b' : defaultStyle.strokeColor,
      backgroundColor:
        effectiveTool === 'frame' || effectiveTool === 'arrow' || effectiveTool === 'line' || effectiveTool === 'freedraw'
          ? 'transparent'
          : defaultStyle.backgroundColor,
      fillStyle: defaultStyle.fillStyle,
      strokeWidth: effectiveTool === 'frame' ? 2 : defaultStyle.strokeWidth,
      strokeStyle: effectiveTool === 'frame' ? 'dashed' : defaultStyle.strokeStyle,
      roughness: effectiveTool === 'frame' ? 0 : defaultStyle.roughness,
      opacity: defaultStyle.opacity,
      roundness: defaultStyle.roundness ? { type: 3 } : null,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      isDeleted: false,
      ...(effectiveTool === 'frame' ? { name: `Frame ${elements.filter((e) => e.type === 'frame').length + 1}` } : {}),
      ...(effectiveTool === 'arrow' || effectiveTool === 'line' || effectiveTool === 'freedraw'
        ? {
            points: [[0, 0]],
            startBinding: startPort
              ? { elementId: startPort.elementId, port: startPort.port, focus: 0, gap: 2 }
              : null,
            endBinding: null,
          }
        : {}),
    };

    const nextElements = [...elements, newElement];
    setElements(nextElements);
    setSelectedIds(new Set([newId]));

    interactionRef.current = {
      mode: 'drawing',
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startWorldX: startX,
      startWorldY: startY,
      startPanX: pan.x,
      startPanY: pan.y,
      drawingElementId: newId,
      startSnapPort: startPort,
      initialElementsSnapshot: nextElements,
      initialBoundsMap: new Map(),
    };
  };

  // 鼠标移动：实时更新画布交互与智能参考线/磁吸锚点
  const handlePointerMove = (e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const st = interactionRef.current;

    // 箭头工具悬停探测磁吸锚点
    if (st.mode === 'idle' && effectiveTool === 'arrow' && smartSnapEnabled) {
      setHoveredSnapPort(findNearestSnapPort(elements, world.x, world.y, 28 / zoom));
    } else if (st.mode === 'idle' && hoveredSnapPort) {
      setHoveredSnapPort(null);
    }

    if (st.mode === 'idle') return;

    if (st.mode === 'panning') {
      setPan({
        x: st.startPanX + (e.clientX - st.startScreenX),
        y: st.startPanY + (e.clientY - st.startScreenY),
      });
      return;
    }

    if (st.mode === 'marquee') {
      setMarqueeBox({
        x1: st.startWorldX,
        y1: st.startWorldY,
        x2: world.x,
        y2: world.y,
      });
      const hitIds = getElementsInMarquee(elements, st.startWorldX, st.startWorldY, world.x, world.y);
      setSelectedIds(new Set(hitIds));
      return;
    }

    if (st.mode === 'erasing') {
      const hit = hitTestElements(elements, world.x, world.y, 10 / zoom);
      if (hit) {
        setElements((prev) => prev.filter((el) => el.id !== hit.id && el.containerId !== hit.id));
      }
      return;
    }

    if (st.mode === 'moving') {
      let dx = world.x - st.startWorldX;
      let dy = world.y - st.startWorldY;

      if (smartSnapEnabled && selectedIds.size > 0) {
        const union = getSelectionBounds(st.initialElementsSnapshot, selectedIds);
        if (union) {
          const tentativeBounds = {
            x: union.x + dx,
            y: union.y + dy,
            width: union.width,
            height: union.height,
            cx: union.cx + dx,
            cy: union.cy + dy,
            right: union.right + dx,
            bottom: union.bottom + dy,
          };
          const others = st.initialElementsSnapshot.filter(
            (el) => !selectedIds.has(el.id) && !(el.type === 'text' && el.containerId && selectedIds.has(el.containerId))
          );
          const snap = computeSmartSnap(tentativeBounds, others, 6 / zoom);
          dx += snap.dx;
          dy += snap.dy;
          setSnapGuides(snap.guides);
        }
      }

      const moved = st.initialElementsSnapshot.map((el) => {
        const init = st.initialBoundsMap.get(el.id);
        if (!init) return el;
        return {
          ...el,
          x: init.x + dx,
          y: init.y + dy,
        };
      });
      setElements(syncBoundElementsAfterTransform(moved));
      return;
    }

    if (st.mode === 'resizing' && st.resizeHandle && selectedIds.size > 0) {
      const dx = world.x - st.startWorldX;
      const dy = world.y - st.startWorldY;
      const h = st.resizeHandle;

      const resized = st.initialElementsSnapshot.map((el) => {
        const init = st.initialBoundsMap.get(el.id);
        if (!init) return el;
        let nx = init.x;
        let ny = init.y;
        let nw = init.width;
        let nh = init.height;

        if (h.includes('e')) nw = Math.max(16, init.width + dx);
        if (h.includes('s')) nh = Math.max(16, init.height + dy);
        if (h.includes('w')) {
          const possibleW = init.width - dx;
          if (possibleW >= 16) {
            nx = init.x + dx;
            nw = possibleW;
          }
        }
        if (h.includes('n')) {
          const possibleH = init.height - dy;
          if (possibleH >= 16) {
            ny = init.y + dy;
            nh = possibleH;
          }
        }

        if (e.shiftKey) {
          const side = Math.max(nw, nh);
          nw = side;
          nh = side;
        }

        if ((el.type === 'arrow' || el.type === 'line') && Array.isArray(init.points) && init.points.length >= 2) {
          const scaleX = nw / Math.max(1, init.width);
          const scaleY = nh / Math.max(1, init.height);
          return {
            ...el,
            x: nx,
            y: ny,
            width: nw,
            height: nh,
            points: init.points.map((pt) => [pt[0] * scaleX, pt[1] * scaleY]),
          };
        }

        return {
          ...el,
          x: nx,
          y: ny,
          width: nw,
          height: nh,
        };
      });

      setElements(syncBoundElementsAfterTransform(resized));
      return;
    }

    if (st.mode === 'drawing' && st.drawingElementId) {
      const targetId = st.drawingElementId;
      let endX = world.x;
      let endY = world.y;
      let endPort: AnchorPort | null = null;

      if (effectiveTool === 'arrow' && smartSnapEnabled) {
        endPort = findNearestSnapPort(
          elements,
          world.x,
          world.y,
          28 / zoom,
          st.startSnapPort?.elementId || targetId
        );
        setHoveredSnapPort(endPort);
        if (endPort) {
          endX = endPort.x;
          endY = endPort.y;
        }
      }

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== targetId) return el;

          if (el.type === 'freedraw') {
            const relX = endX - st.startWorldX;
            const relY = endY - st.startWorldY;
            const pts = Array.isArray(el.points) ? el.points : [[0, 0]];
            return {
              ...el,
              points: [...pts, [relX, relY]],
            };
          }

          if (el.type === 'arrow' || el.type === 'line') {
            let dx = endX - st.startWorldX;
            let dy = endY - st.startWorldY;
            if (e.shiftKey && !endPort) {
              if (Math.abs(dx) > Math.abs(dy) * 2) dy = 0;
              else if (Math.abs(dy) > Math.abs(dx) * 2) dx = 0;
              else {
                const s = Math.max(Math.abs(dx), Math.abs(dy));
                dx = Math.sign(dx) * s;
                dy = Math.sign(dy) * s;
              }
            }
            return {
              ...el,
              width: dx,
              height: dy,
              points: [
                [0, 0],
                [dx, dy],
              ],
              endBinding: endPort
                ? { elementId: endPort.elementId, port: endPort.port, focus: 0, gap: 2 }
                : null,
            };
          }

          let rawW = endX - st.startWorldX;
          let rawH = endY - st.startWorldY;
          if (e.shiftKey) {
            const side = Math.max(Math.abs(rawW), Math.abs(rawH));
            rawW = Math.sign(rawW || 1) * side;
            rawH = Math.sign(rawH || 1) * side;
          }
          const nx = rawW < 0 ? st.startWorldX + rawW : st.startWorldX;
          const ny = rawH < 0 ? st.startWorldY + rawH : st.startWorldY;
          return {
            ...el,
            x: nx,
            y: ny,
            width: Math.max(12, Math.abs(rawW)),
            height: Math.max(12, Math.abs(rawH)),
          };
        })
      );
    }
  };

  // 鼠标释放：完成绘制或变换并压入历史栈
  const handlePointerUp = () => {
    const st = interactionRef.current;
    interactionRef.current = {
      ...st,
      mode: 'idle',
    };
    setMarqueeBox(null);
    setSnapGuides([]);
    setHoveredSnapPort(null);

    if (st.mode === 'moving' || st.mode === 'resizing' || st.mode === 'erasing') {
      commitElements(elements);
      return;
    }

    if (st.mode === 'drawing' && st.drawingElementId) {
      let finalized = elements.map((el) => {
        if (el.id !== st.drawingElementId) return el;
        // 如果只是单击没有拖拽出面积，赋予默认标准尺寸
        if (['rectangle', 'diamond', 'ellipse', 'frame'].includes(el.type) && el.width <= 14 && el.height <= 14) {
          return {
            ...el,
            width: el.type === 'frame' ? 420 : 140,
            height: el.type === 'frame' ? 280 : 76,
          };
        }
        return el;
      });

      // 若是带有绑定关系的箭头，同步将箭头 ID 写入起止节点的 boundElements
      const drawnArrow = finalized.find((el) => el.id === st.drawingElementId && el.type === 'arrow');
      if (drawnArrow) {
        const startTargetId = drawnArrow.startBinding?.elementId;
        const endTargetId = drawnArrow.endBinding?.elementId;
        if (startTargetId || endTargetId) {
          finalized = finalized.map((el) => {
            if (el.id === startTargetId || el.id === endTargetId) {
              const existing = Array.isArray(el.boundElements) ? el.boundElements : [];
              return {
                ...el,
                boundElements: [...existing, { id: drawnArrow.id, type: 'arrow' }],
              };
            }
            return el;
          });
        }
      }

      commitElements(finalized);
      if (!keepToolActive && effectiveTool !== 'freedraw') {
        setActiveTool('select');
      }
    }
  };

  // 鼠标滚轮：Ctrl/Cmd + 滚轮 以光标为中心缩放；普通滚轮 平移画布
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      const cursorX = rect ? e.clientX - rect.left : e.clientX;
      const cursorY = rect ? e.clientY - rect.top : e.clientY;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(4, Math.max(0.2, Number((zoom * factor).toFixed(2))));
      const nextPanX = cursorX - ((cursorX - pan.x) / zoom) * nextZoom;
      const nextPanY = cursorY - ((cursorY - pan.y) / zoom) * nextZoom;
      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // 插入架构物料至当前视口中心
  const handleInsertStencilToCenter = (stencil: ExcalidrawStencil) => {
    if (!stencil?.elements?.length) return;
    const centerWorld = screenToWorld(
      viewportSize.width / 2,
      viewportSize.height / 2
    );
    const stamp = Date.now();
    const newEls = stencil.elements.map((el, idx) => ({
      ...el,
      id: `stencil-${stamp}-${idx}`,
      x: (el.x || 0) + centerWorld.x - 80,
      y: (el.y || 0) + centerWorld.y - 50,
      seed: Math.floor(Math.random() * 100000) + idx,
      version: 1,
    }));
    setSelectedIds(new Set(newEls.map((e) => e.id)));
    commitElements([...elements, ...newEls]);
  };

  const selectedElements = useMemo(
    () => elements.filter((el) => el && !el.isDeleted && selectedIds.has(el.id)),
    [elements, selectedIds]
  );

  // 当前所有可供箭头磁吸的形状锚点
  const allSnapPorts = useMemo(() => {
    if (effectiveTool !== 'arrow' || !smartSnapEnabled) return [];
    const list: AnchorPort[] = [];
    elements.forEach((el) => {
      list.push(...getElementAnchorPorts(el));
    });
    return list;
  }, [elements, effectiveTool, smartSnapEnabled]);

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="w-full h-full flex flex-col overflow-hidden select-none"
    >
      {/* 1. PC 桌面顶部绘图工具坞 (非禅模式且非只读模式下常驻) */}
      {!isZenMode && !isViewOnly && (
        <ExcalidrawTopToolDock
          isZh={isZh}
          activeTool={effectiveTool}
          onSelectTool={setActiveTool}
          keepToolActive={keepToolActive}
          onToggleKeepToolActive={() => setKeepToolActive((v) => !v)}
          smartSnapEnabled={smartSnapEnabled}
          onToggleSmartSnap={() => setSmartSnapEnabled((v) => !v)}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          selectedCount={selectedIds.size}
          onAlign={handleAlign}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          showLeftDock={showLeftDock}
          onToggleLeftDock={() => setShowLeftDock((v) => !v)}
          showRightInspector={showRightInspector}
          onToggleRightInspector={() => setShowRightInspector((v) => !v)}
        />
      )}

      {/* 2. 主体三栏工作区 (左侧图层/画框/物料坞 + 中央无限手绘画布 + 右侧属性检查器) */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {!isZenMode && !isViewOnly && showLeftDock && (
          <ExcalidrawLeftDock
            isZh={isZh}
            elements={elements}
            selectedIds={selectedIds}
            onSelectElement={(id, multi) => {
              setSelectedIds((prev) => {
                const next = new Set(multi ? prev : []);
                if (multi && next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onFocusElement={(el) => {
              setSelectedIds(new Set([el.id]));
              scrollToContent(el);
            }}
            onToggleElementHidden={(id) => {
              commitElements(
                elements.map((el) =>
                  el.id === id || el.containerId === id ? { ...el, isHidden: !el.isHidden } : el
                )
              );
            }}
            onToggleElementLocked={(id) => {
              commitElements(
                elements.map((el) => (el.id === id ? { ...el, locked: !el.locked } : el))
              );
            }}
            onMoveElementLayer={(id, dir) => {
              commitElements(
                reorderElementsLayer(elements, new Set([id]), dir === 'up' ? 'forward' : 'backward')
              );
            }}
            onDeleteElement={(id) => {
              selectedIds.delete(id);
              commitElements(elements.filter((el) => el.id !== id && el.containerId !== id));
            }}
            onRenameFrame={(id, newName) => {
              commitElements(elements.map((el) => (el.id === id ? { ...el, name: newName } : el)));
            }}
            onAutoCreateFrame={() => {
              commitElements(autoCreateFrames(elements));
            }}
            onInsertStencil={handleInsertStencilToCenter}
            customStencils={customStencils}
            onSaveSelectedAsStencil={() => onSaveSelectedAsStencil?.()}
            onOpenFullMaterialsModal={onOpenFullMaterialsModal}
          />
        )}

        {/* 中央无限交互手绘画布 */}
        <div
          ref={viewportRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onDoubleClick={handleCanvasDoubleClick}
          onWheel={handleWheel}
          onContextMenu={(e) => {
            e.preventDefault();
            const world = screenToWorld(e.clientX, e.clientY);
            const hit = hitTestElements(elements, world.x, world.y, 8 / zoom);
            if (hit && !selectedIds.has(hit.id)) {
              setSelectedIds(new Set([hit.id]));
            }
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
          style={{
            backgroundColor: canvasBgColor,
            backgroundImage: showGrid
              ? `radial-gradient(${isDarkTheme ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.25)'} 1px, transparent 1px)`
              : undefined,
            backgroundSize: showGrid ? `${20 * zoom}px ${20 * zoom}px` : undefined,
            backgroundPosition: showGrid ? `${pan.x}px ${pan.y}px` : undefined,
            cursor:
              effectiveTool === 'hand'
                ? 'grab'
                : effectiveTool === 'select'
                ? 'default'
                : effectiveTool === 'text'
                ? 'text'
                : 'crosshair',
          }}
          className="flex-1 min-w-0 h-full relative overflow-hidden"
        >
          {/* SVG 无限坐标变换绘画层 */}
          <svg className="w-full h-full block pointer-events-none">
            <defs>
              <marker
                id="ov-studio-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 1.2 L 9.5 5 L 0 8.8 z"
                  fill={isDarkTheme ? '#e2e8f0' : '#1e293b'}
                />
              </marker>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* 渲染所有可见手绘图元 */}
              {elements.map((el) => {
                if (!el || el.isDeleted || el.isHidden) return null;
                const stroke = el.strokeColor || (isDarkTheme ? '#e2e8f0' : '#1e293b');
                const fill =
                  !el.backgroundColor || el.backgroundColor === 'transparent'
                    ? 'none'
                    : el.backgroundColor;
                const fillStyle = el.fillStyle || 'hachure';
                const strokeWidth = el.strokeWidth || 2;
                const roughness = typeof el.roughness === 'number' ? el.roughness : 1;
                const seed = typeof el.seed === 'number' ? el.seed : 1337;
                const opacity = (el.opacity ?? 100) / 100;
                const dash =
                  el.strokeStyle === 'dashed'
                    ? '8,6'
                    : el.strokeStyle === 'dotted'
                    ? '2,5'
                    : undefined;

                if (el.type === 'frame') {
                  return (
                    <g key={el.id} opacity={opacity}>
                      <text
                        x={el.x + 4}
                        y={el.y - 8}
                        fontSize={12}
                        fontWeight={600}
                        fill={stroke}
                        fontFamily="system-ui, sans-serif"
                      >
                        {el.name || 'Frame'}
                      </text>
                      <rect
                        x={el.x}
                        y={el.y}
                        width={el.width}
                        height={el.height}
                        rx={8}
                        fill="rgba(59, 130, 246, 0.03)"
                        stroke={stroke}
                        strokeWidth={1.5}
                        strokeDasharray="6,6"
                      />
                    </g>
                  );
                }

                if (el.type === 'rectangle') {
                  const hachure =
                    fill !== 'none' && fillStyle !== 'solid'
                      ? generateHachureFillPath(
                          el.x,
                          el.y,
                          el.width,
                          el.height,
                          fillStyle,
                          roughness,
                          seed,
                          'rectangle'
                        )
                      : '';
                  const outline = generateRoughRectPath(
                    el.x,
                    el.y,
                    el.width,
                    el.height,
                    roughness,
                    Boolean(el.roundness),
                    seed
                  );
                  return (
                    <g key={el.id} opacity={opacity}>
                      {fill !== 'none' && fillStyle === 'solid' && (
                        <rect
                          x={el.x}
                          y={el.y}
                          width={el.width}
                          height={el.height}
                          rx={el.roundness ? 8 : 0}
                          fill={fill}
                        />
                      )}
                      {hachure && (
                        <path
                          d={hachure}
                          fill="none"
                          stroke={fill}
                          strokeWidth={Math.max(1.5, strokeWidth * 0.85)}
                          strokeLinecap="round"
                        />
                      )}
                      <path
                        d={outline}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dash}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                }

                if (el.type === 'diamond') {
                  const hachure =
                    fill !== 'none' && fillStyle !== 'solid'
                      ? generateHachureFillPath(
                          el.x,
                          el.y,
                          el.width,
                          el.height,
                          fillStyle,
                          roughness,
                          seed,
                          'diamond'
                        )
                      : '';
                  const outline = generateRoughDiamondPath(
                    el.x,
                    el.y,
                    el.width,
                    el.height,
                    roughness,
                    seed
                  );
                  const pts = `${el.x + el.width / 2},${el.y} ${el.x + el.width},${el.y + el.height / 2} ${el.x + el.width / 2},${el.y + el.height} ${el.x},${el.y + el.height / 2}`;
                  return (
                    <g key={el.id} opacity={opacity}>
                      {fill !== 'none' && fillStyle === 'solid' && (
                        <polygon points={pts} fill={fill} />
                      )}
                      {hachure && (
                        <path
                          d={hachure}
                          fill="none"
                          stroke={fill}
                          strokeWidth={Math.max(1.5, strokeWidth * 0.85)}
                          strokeLinecap="round"
                        />
                      )}
                      <path
                        d={outline}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dash}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                }

                if (el.type === 'ellipse') {
                  const hachure =
                    fill !== 'none' && fillStyle !== 'solid'
                      ? generateHachureFillPath(
                          el.x,
                          el.y,
                          el.width,
                          el.height,
                          fillStyle,
                          roughness,
                          seed,
                          'ellipse'
                        )
                      : '';
                  const outline = generateRoughEllipsePath(
                    el.x,
                    el.y,
                    el.width,
                    el.height,
                    roughness,
                    seed
                  );
                  return (
                    <g key={el.id} opacity={opacity}>
                      {fill !== 'none' && fillStyle === 'solid' && (
                        <ellipse
                          cx={el.x + el.width / 2}
                          cy={el.y + el.height / 2}
                          rx={el.width / 2}
                          ry={el.height / 2}
                          fill={fill}
                        />
                      )}
                      {hachure && (
                        <path
                          d={hachure}
                          fill="none"
                          stroke={fill}
                          strokeWidth={Math.max(1.5, strokeWidth * 0.85)}
                          strokeLinecap="round"
                        />
                      )}
                      <path
                        d={outline}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dash}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                }

                if (el.type === 'arrow' || el.type === 'line') {
                  const pts = (el.points || [[0, 0], [el.width || 80, el.height || 0]])
                    .map((p: number[]) => `${el.x + p[0]},${el.y + p[1]}`)
                    .join(' ');
                  return (
                    <polyline
                      key={el.id}
                      points={pts}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dash}
                      opacity={opacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerEnd={el.type === 'arrow' ? 'url(#ov-studio-arrow)' : undefined}
                    />
                  );
                }

                if (el.type === 'freedraw') {
                  const pts = el.points || [[0, 0]];
                  const d = pts
                    .map((p: number[], i: number) => `${i === 0 ? 'M' : 'L'} ${el.x + p[0]} ${el.y + p[1]}`)
                    .join(' ');
                  return (
                    <path
                      key={el.id}
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                }

                if (el.type === 'text') {
                  if (editingText?.elementId === el.id) return null;
                  const fontSize = el.fontSize || 16;
                  const lines = String(el.text || '').split('\n');
                  const align = el.textAlign || 'left';
                  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
                  const baseX =
                    align === 'center'
                      ? (el.x || 0) + (el.width || 0) / 2
                      : align === 'right'
                      ? (el.x || 0) + (el.width || 0)
                      : el.x || 0;
                  return (
                    <text
                      key={el.id}
                      x={baseX}
                      y={(el.y || 0) + fontSize * 0.9}
                      textAnchor={anchor}
                      fontSize={fontSize}
                      fontFamily={el.fontFamily === 2 ? 'monospace' : 'system-ui, sans-serif'}
                      fill={stroke}
                      opacity={opacity}
                    >
                      {lines.map((line, idx) => (
                        <tspan key={idx} x={baseX} dy={idx === 0 ? 0 : fontSize * 1.25}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                }

                return null;
              })}

              {/* 箭头磁吸候选锚点光晕 (Snap Port Halos) */}
              {allSnapPorts.map((p, idx) => {
                const isHovered =
                  hoveredSnapPort?.elementId === p.elementId && hoveredSnapPort?.port === p.port;
                return (
                  <circle
                    key={`${p.elementId}-${p.port}-${idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6 / zoom : 3.5 / zoom}
                    fill={isHovered ? '#3b82f6' : 'rgba(59, 130, 246, 0.35)'}
                    stroke="#ffffff"
                    strokeWidth={1.5 / zoom}
                  />
                );
              })}

              {/* 智能对齐参考线 (Smart Alignment Snap Guides) */}
              {snapGuides.map((g, i) =>
                g.type === 'vertical' ? (
                  <line
                    key={i}
                    x1={g.pos}
                    y1={g.start}
                    x2={g.pos}
                    y2={g.end}
                    stroke="#f59e0b"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${4 / zoom},${4 / zoom}`}
                  />
                ) : (
                  <line
                    key={i}
                    x1={g.start}
                    y1={g.pos}
                    x2={g.end}
                    y2={g.pos}
                    stroke="#f59e0b"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${4 / zoom},${4 / zoom}`}
                  />
                )
              )}

              {/* 选中包围盒、8 向控制点与尺寸浮标 */}
              {selectedBounds && !editingText && (
                <g>
                  <rect
                    x={selectedBounds.x - 4 / zoom}
                    y={selectedBounds.y - 4 / zoom}
                    width={selectedBounds.width + 8 / zoom}
                    height={selectedBounds.height + 8 / zoom}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${5 / zoom},${3 / zoom}`}
                  />
                  {!isViewOnly &&
                    getResizeHandles(selectedBounds).map((h) => (
                      <rect
                        key={h.type}
                        x={h.x - 4.5 / zoom}
                        y={h.y - 4.5 / zoom}
                        width={9 / zoom}
                        height={9 / zoom}
                        rx={2 / zoom}
                        fill="#ffffff"
                        stroke="#3b82f6"
                        strokeWidth={1.5 / zoom}
                      />
                    ))}
                  {/* 尺寸测量胶囊 */}
                  <g
                    transform={`translate(${selectedBounds.cx}, ${selectedBounds.bottom + 18 / zoom}) scale(${1 / zoom})`}
                  >
                    <rect
                      x={-44}
                      y={-10}
                      width={88}
                      height={18}
                      rx={4}
                      fill="#1e293b"
                      stroke="#3b82f6"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      fontSize={10}
                      fontFamily="monospace"
                      fill="#f8fafc"
                    >
                      {Math.round(selectedBounds.width)} × {Math.round(selectedBounds.height)}
                    </text>
                  </g>
                </g>
              )}

              {/* 框选选区矩形 (Marquee Box) */}
              {marqueeBox && (
                <rect
                  x={Math.min(marqueeBox.x1, marqueeBox.x2)}
                  y={Math.min(marqueeBox.y1, marqueeBox.y2)}
                  width={Math.abs(marqueeBox.x2 - marqueeBox.x1)}
                  height={Math.abs(marqueeBox.y2 - marqueeBox.y1)}
                  fill="rgba(59, 130, 246, 0.12)"
                  stroke="#3b82f6"
                  strokeWidth={1 / zoom}
                />
              )}
            </g>
          </svg>

          {/* 原地双击内联文本输入框 */}
          {editingText && (
            <textarea
              ref={inlineTextareaRef}
              value={editingText.text}
              onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
              onBlur={handleCommitInlineText}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCommitInlineText();
                } else if (e.key === 'Escape') {
                  setEditingText(null);
                }
              }}
              placeholder={isZh ? '输入文本 (Enter 确认, Shift+Enter 换行)...' : 'Type text (Enter to commit)...'}
              style={{
                left: pan.x + editingText.x * zoom,
                top: pan.y + editingText.y * zoom,
                width: Math.max(120, editingText.width * zoom),
                minHeight: Math.max(34, editingText.height * zoom),
                fontSize: `${editingText.fontSize * zoom}px`,
                color: editingText.strokeColor,
                textAlign: editingText.containerId ? 'center' : defaultStyle.textAlign,
                borderColor: 'var(--ov-accent)',
                backgroundColor: 'color-mix(in srgb, var(--ov-surface) 90%, transparent)',
              }}
              className="absolute z-30 p-1.5 rounded border-2 shadow-lg outline-none resize leading-snug backdrop-blur-sm"
            />
          )}

          {/* 左下角状态提示与坐标遥测 */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-md border text-[11px] font-mono tabular-nums flex items-center gap-2 pointer-events-none shadow-sm"
          >
            <span>
              {isZh ? '工具:' : 'Tool:'}{' '}
              <strong style={{ color: 'var(--ov-accent)' }} className="uppercase">
                {effectiveTool}
              </strong>
            </span>
            <span>·</span>
            <span>
              {isZh ? '图元:' : 'Els:'} {elements.filter((e) => !e.isDeleted).length}
            </span>
            {selectedIds.size > 0 && (
              <>
                <span>·</span>
                <span>
                  {isZh ? '选中:' : 'Sel:'} {selectedIds.size}
                </span>
              </>
            )}
          </div>

          {/* 右下角鹰眼小地图与缩放控制器 */}
          <ExcalidrawMinimap
            isZh={isZh}
            elements={elements}
            zoom={zoom}
            pan={pan}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            onPanChange={setPan}
            onZoomChange={setZoom}
            onResetViewport={() => scrollToContent()}
          />
        </div>

        {/* 右侧上下文属性与排版检查器 */}
        {!isZenMode && !isViewOnly && showRightInspector && (
          <ExcalidrawRightInspector
            isZh={isZh}
            selectedElements={selectedElements}
            defaultStyle={defaultStyle}
            onUpdateDefaultStyle={(patch) => setDefaultStyle((prev) => ({ ...prev, ...patch }))}
            onUpdateSelectedProps={(patch) => {
              const next = elements.map((el) => {
                if (selectedIds.has(el.id)) {
                  return { ...el, ...patch };
                }
                if (el.type === 'text' && el.containerId && selectedIds.has(el.containerId)) {
                  const textPatch: Record<string, any> = {};
                  if (patch.strokeColor) textPatch.strokeColor = patch.strokeColor;
                  if (patch.fontSize) textPatch.fontSize = patch.fontSize;
                  if (patch.textAlign) textPatch.textAlign = patch.textAlign;
                  return { ...el, ...textPatch };
                }
                return el;
              });
              commitElements(syncBoundElementsAfterTransform(next));
            }}
            onUpdateSelectedGeometry={(geom) => {
              const next = elements.map((el) => {
                if (!selectedIds.has(el.id)) return el;
                return {
                  ...el,
                  ...(geom.x !== undefined ? { x: geom.x } : {}),
                  ...(geom.y !== undefined ? { y: geom.y } : {}),
                  ...(geom.width !== undefined ? { width: geom.width } : {}),
                  ...(geom.height !== undefined ? { height: geom.height } : {}),
                };
              });
              commitElements(syncBoundElementsAfterTransform(next));
            }}
            onAlign={handleAlign}
            onLayerOrder={handleLayerOrder}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            onDuplicate={handleDuplicateSelected}
            onDelete={handleDeleteSelected}
            onSaveAsStencil={() => onSaveSelectedAsStencil?.()}
            canvasBgColor={canvasBgColor}
            onCanvasBgColorChange={(bg) => {
              setCanvasBgColor(bg);
              commitElements(elements, bg);
            }}
          />
        )}
      </div>

      {/* 右键桌面上下文菜单 */}
      {contextMenu && (
        <ExcalidrawContextMenu
          isZh={isZh}
          x={contextMenu.x}
          y={contextMenu.y}
          selectedCount={selectedIds.size}
          hasClipboard={clipboardRef.current.length > 0}
          hasGroup={selectedElements.some((el) => Array.isArray(el.groupIds) && el.groupIds.length > 0)}
          onCopy={handleCopySelected}
          onPaste={handlePaste}
          onDuplicate={handleDuplicateSelected}
          onLayerOrder={handleLayerOrder}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onSaveAsStencil={() => onSaveSelectedAsStencil?.()}
          onDelete={handleDeleteSelected}
          onSelectAll={() => {
            const allIds = elements
              .filter((el) => el && !el.isDeleted && !el.isHidden && !el.locked && !(el.type === 'text' && el.containerId))
              .map((el) => el.id);
            setSelectedIds(new Set(allIds));
          }}
          onFitView={() => scrollToContent()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default ExcalidrawCanvas;
