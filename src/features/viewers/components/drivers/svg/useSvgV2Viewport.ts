/**
 * OmniView SVG v2 — 画布视口缩放/平移 Hook (P2)
 *
 * 职责（视口关注点独立拆分）：
 * - 滚轮以光标为锚点缩放（0.2x~5x，触控板 ctrlKey 连续、滚轮阶梯）
 * - 中键 / Alt+左键拖拽平移（平移期间由容器 pointer capture 接管）
 * - 双击重置 fit 视图
 * - UI 控件白名单：检视面板/图层面板/状态栏/输入控件内滚轮不缩放画布
 *
 * 几何数学全部走 `core/runtime/viewport.ts` 纯函数（可独立单测）。
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  IDENTITY_VIEWPORT,
  clampViewportScale,
  panViewportBy,
  resetViewport,
  wheelZoomFactor,
  zoomViewportAtPoint,
  type ViewportState,
} from './core';

/** UI 控件滚轮白名单（与 v1 `useSvgCanvasInteraction` 同源选择器）。 */
export function isCanvasUiWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!(
    target.closest('#svg-inspector-panel') ||
    target.closest('[data-inspector-panel]') ||
    target.closest('#svg-batch-inspector-panel') ||
    target.closest('#canvas-statusbar') ||
    target.closest('[data-canvas-ui]') ||
    target.closest('input') ||
    target.closest('select') ||
    target.closest('textarea') ||
    target.closest('[role="slider"]') ||
    target.closest('[contenteditable]')
  );
}

export interface SvgV2ViewportApi {
  readonly viewport: ViewportState;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly panning: boolean;
  readonly handleWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  readonly handleDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly beginPan: (e: React.PointerEvent<HTMLDivElement>) => boolean;
  readonly movePan: (e: React.PointerEvent<HTMLDivElement>) => void;
  readonly endPan: (e: React.PointerEvent<HTMLDivElement>) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly zoomReset: () => void;
  readonly zoomFit: () => void;
}

export function useSvgV2Viewport(): SvgV2ViewportApi {
  const [viewport, setViewport] = useState<ViewportState>(IDENTITY_VIEWPORT);
  const [panning, setPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (isCanvasUiWheelTarget(e.target)) return;
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = wheelZoomFactor(e.deltaY, e.ctrlKey);
    setViewport((vp) => zoomViewportAtPoint(vp, factor, e.clientX, e.clientY, rect));
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isCanvasUiWheelTarget(e.target)) return;
    setViewport(resetViewport());
  }, []);

  const beginPan = useCallback((e: React.PointerEvent<HTMLDivElement>): boolean => {
    if (isCanvasUiWheelTarget(e.target)) return false;
    const isMiddle = e.button === 1;
    const isAltLeft = e.button === 0 && e.altKey;
    if (!isMiddle && !isAltLeft) return false;
    e.preventDefault();
    panRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    setPanning(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture unavailable */
    }
    return true;
  }, []);

  const movePan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    const dx = e.clientX - pan.lastX;
    const dy = e.clientY - pan.lastY;
    pan.lastX = e.clientX;
    pan.lastY = e.clientY;
    setViewport((vp) => panViewportBy(vp, dx, dy));
  }, []);

  const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    panRef.current = null;
    setPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const zoomIn = useCallback(() => {
    setViewport((vp) => ({ ...vp, scale: clampViewportScale(vp.scale * 1.25) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((vp) => ({ ...vp, scale: clampViewportScale(vp.scale / 1.25) }));
  }, []);

  const zoomReset = useCallback(() => {
    setViewport((vp) => ({ ...vp, scale: 1.0, x: 0, y: 0 }));
  }, []);

  const zoomFit = useCallback(() => {
    setViewport(resetViewport());
  }, []);

  return {
    viewport,
    containerRef,
    panning,
    handleWheel,
    handleDoubleClick,
    beginPan,
    movePan,
    endPan,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomFit,
  };
}
