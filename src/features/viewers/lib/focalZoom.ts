/**
 * OmniView 视口基于光标位置的无级缩放计算核心纯函数 (Focal Point Zoom)
 * 纯函数、无直接 DOM 依赖，支持单测准入。
 */

export interface Point {
  readonly clientX: number;
  readonly clientY: number;
}

export interface ContainerRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ZoomPanState {
  readonly zoom: number;
  readonly pan: { readonly x: number; readonly y: number };
}

export const LIGHTBOX_MIN_ZOOM = 0.05;
export const LIGHTBOX_MAX_ZOOM = 20;

/**
 * 滚轮 → 缩放因子：触控板捏合（ctrlKey）平滑连续，鼠标滚轮阶梯 1.15 / 0.87。
 */
export function calculateWheelFactor(deltaY: number, ctrlKey: boolean): number {
  if (ctrlKey) {
    return Math.exp(-deltaY * 0.01);
  }
  return deltaY < 0 ? 1.15 : 0.87;
}

/**
 * 响应式按键单步放大缩放值推导 (Zoom In)
 */
export function getNextZoomIn(currentZoom: number): number {
  let next: number;
  if (currentZoom < 0.5) next = currentZoom + 0.1;
  else if (currentZoom < 2) next = currentZoom + 0.25;
  else if (currentZoom < 5) next = currentZoom + 0.5;
  else next = currentZoom * 1.25;
  return Math.min(LIGHTBOX_MAX_ZOOM, Number(next.toFixed(2)));
}

/**
 * 响应式按键单步缩小缩放值推导 (Zoom Out)
 */
export function getNextZoomOut(currentZoom: number): number {
  let next: number;
  if (currentZoom <= 0.5) next = currentZoom - 0.1;
  else if (currentZoom <= 2) next = currentZoom - 0.25;
  else if (currentZoom <= 5) next = currentZoom - 0.5;
  else next = currentZoom * 0.8;
  return Math.max(LIGHTBOX_MIN_ZOOM, Number(next.toFixed(2)));
}

/**
 * 光标锚点缩放纯函数：
 * 计算缩放后的 zoom 与 pan，保证缩放前后光标所指向的图形内容在屏幕上处于绝对同一物理像素。
 *
 * @param current 当前视口状态（zoom + pan）
 * @param targetZoom 目标缩放比例
 * @param focalPoint 光标视口像素坐标 (clientX, clientY)
 * @param containerRect 外部视口容器盒 (getBoundingClientRect)
 * @param minZoom 最小允许缩放比
 * @param maxZoom 最大允许缩放比
 */
export function calculateFocalZoom(
  current: ZoomPanState,
  targetZoom: number,
  focalPoint: Point,
  containerRect: ContainerRectLike,
  minZoom = LIGHTBOX_MIN_ZOOM,
  maxZoom = LIGHTBOX_MAX_ZOOM
): ZoomPanState {
  const oldZoom = current.zoom;
  if (Number.isNaN(oldZoom) || oldZoom <= 0) return current;

  const clampedZoom = Math.max(minZoom, Math.min(maxZoom, Number(targetZoom.toFixed(3))));
  if (Math.abs(clampedZoom - oldZoom) < 1e-4) {
    return current;
  }

  const centerX = containerRect.left + containerRect.width / 2;
  const centerY = containerRect.top + containerRect.height / 2;
  const offsetX = focalPoint.clientX - centerX;
  const offsetY = focalPoint.clientY - centerY;
  const ratio = clampedZoom / oldZoom;

  const newPanX = Math.round((offsetX - (offsetX - current.pan.x) * ratio) * 10) / 10;
  const newPanY = Math.round((offsetY - (offsetY - current.pan.y) * ratio) * 10) / 10;

  return {
    zoom: clampedZoom,
    pan: { x: newPanX, y: newPanY },
  };
}
