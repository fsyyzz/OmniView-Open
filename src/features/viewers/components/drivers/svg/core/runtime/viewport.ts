/**
 * OmniView SVG 编辑引擎 v2 — 画布坐标反变换纯函数 (P0 修订)
 *
 * 把客户端（屏幕）坐标换算为 SVG viewBox 坐标：
 * `<svg>` 元素盒按 `preserveAspectRatio="xMidYMid meet"` 内切绘制，
 * 因此需扣除 letterbox 偏移并除以缩放比。
 *
 * 纯函数、无 DOM 依赖，可独立单测（交互管线准入）。
 */

export interface ClientRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewBoxLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * 客户端坐标 → viewBox 坐标。
 *
 * @param clientX/clientY `clientX/Y`（视口坐标）
 * @param rect `<svg>` 元素 `getBoundingClientRect()`
 * @param view viewBox（含 x/y 偏移）
 */
export function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  view: ViewBoxLike,
): CanvasPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (view.width <= 0 || view.height <= 0) return null;
  const scale = Math.min(rect.width / view.width, rect.height / view.height);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const drawnWidth = view.width * scale;
  const drawnHeight = view.height * scale;
  const offsetX = (rect.width - drawnWidth) / 2;
  const offsetY = (rect.height - drawnHeight) / 2;
  return {
    x: view.x + (clientX - rect.left - offsetX) / scale,
    y: view.y + (clientY - rect.top - offsetY) / scale,
  };
}

// ============================================================================
// 视口变换（P2：缩放 / 平移）
//
// 模型与 v1 画布一致：内容 wrapper 施加 CSS
// `transform: translate(tx,ty) scale(s)` + `transform-origin: center center`，
// 因此屏幕上某点 p 满足  screen = C + t + s·(p − C)（C 为容器中心，局部坐标）。
// 缩放以光标为锚点（Zoom-to-Cursor）、平移为容器像素位移。
//
// 纯函数、无 DOM 依赖，可独立单测。
// ============================================================================

/** 视口状态：缩放比 + 容器像素平移。 */
export interface ViewportState {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** 规范 §4：0.2x ~ 5.0x 缩放区间。 */
export const VIEWPORT_MIN_SCALE = 0.2;
export const VIEWPORT_MAX_SCALE = 5;

/** 初始视口（fit 视图）。 */
export const IDENTITY_VIEWPORT: ViewportState = { scale: 1, x: 0, y: 0 };

export function clampViewportScale(scale: number): number {
  if (Number.isNaN(scale)) return 1;
  return Math.min(VIEWPORT_MAX_SCALE, Math.max(VIEWPORT_MIN_SCALE, scale));
}

export function resetViewport(): ViewportState {
  return IDENTITY_VIEWPORT;
}

/**
 * 滚轮 → 缩放因子：触控板捏合（ctrlKey）平滑连续，鼠标滚轮阶梯 1.15 / 0.85。
 */
export function wheelZoomFactor(deltaY: number, ctrlKey: boolean): number {
  if (ctrlKey) return Math.exp(-deltaY * 0.01);
  return deltaY < 0 ? 1.15 : 0.85;
}

/**
 * 光标锚点缩放：缩放前后光标所指的画布内容停在屏幕同一物理像素点。
 * 命中缩放边界时不产生新状态（返回原引用，便于 React 跳过渲染）。
 *
 * @param clientX/clientY 光标视口坐标
 * @param containerRect 画布容器 `getBoundingClientRect()`
 */
export function zoomViewportAtPoint(
  viewport: ViewportState,
  factor: number,
  clientX: number,
  clientY: number,
  containerRect: ClientRectLike,
): ViewportState {
  const oldScale = viewport.scale;
  const newScale = clampViewportScale(oldScale * factor);
  if (Math.abs(newScale - oldScale) < 1e-5) return viewport;
  const centerX = containerRect.left + containerRect.width / 2;
  const centerY = containerRect.top + containerRect.height / 2;
  const offsetX = clientX - centerX;
  const offsetY = clientY - centerY;
  const ratio = newScale / oldScale;
  return {
    scale: newScale,
    x: Math.round((offsetX - (offsetX - viewport.x) * ratio) * 10) / 10,
    y: Math.round((offsetY - (offsetY - viewport.y) * ratio) * 10) / 10,
  };
}

/** 容器像素平移（拖拽位移直接累加）。 */
export function panViewportBy(viewport: ViewportState, dx: number, dy: number): ViewportState {
  if (dx === 0 && dy === 0) return viewport;
  return {
    scale: viewport.scale,
    x: viewport.x + dx,
    y: viewport.y + dy,
  };
}

/**
 * 正向映射：画布点 → 容器局部屏幕点（与 CSS transform 模型一致，供测试与纯函数推导）。
 */
export function canvasToClientPoint(
  point: CanvasPoint,
  viewport: ViewportState,
  containerRect: ClientRectLike,
): CanvasPoint {
  const centerX = containerRect.width / 2;
  const centerY = containerRect.height / 2;
  return {
    x: centerX + viewport.x + viewport.scale * (point.x - centerX),
    y: centerY + viewport.y + viewport.scale * (point.y - centerY),
  };
}
