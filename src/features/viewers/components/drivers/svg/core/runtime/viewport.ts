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
