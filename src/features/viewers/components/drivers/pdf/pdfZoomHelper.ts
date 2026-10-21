/**
 * OmniView PDF 视口无级缩放与光标锚点定位核心纯函数 (PDF Focal Point Zoom)
 * 纯函数、无直接 DOM 副作用，覆盖 Ctrl+滚轮缩放、触控板捏合、快捷键与光标几何锚定。
 */

export const MIN_PDF_ZOOM = 25;
export const MAX_PDF_ZOOM = 500;
export const DEFAULT_PDF_ZOOM = 100;

export interface ContainerRectLike {
  readonly left: number;
  readonly top: number;
  readonly width?: number;
  readonly height?: number;
}

export interface FocalScrollParams {
  readonly containerRect: ContainerRectLike;
  readonly cursorClientX: number;
  readonly cursorClientY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly oldZoom: number;
  readonly newZoom: number;
}

export interface FocalScrollResult {
  readonly targetScrollLeft: number;
  readonly targetScrollTop: number;
}

/**
 * 依据滚轮位移 deltaY 与 ctrlKey（或触控板捏合手势）计算新缩放百分比
 * @param currentZoom 当前缩放百分比 (例如 100 表示 100%)
 * @param deltaY 滚轮纵向位移 (deltaY < 0 向上滚/放大, deltaY > 0 向下滚/缩小)
 * @param ctrlKey 是否处于 Ctrl / Meta 按下状态或触控板捏合
 */
export function calculatePdfWheelZoom(
  currentZoom: number,
  deltaY: number,
  ctrlKey: boolean = true
): number {
  if (Math.abs(deltaY) < 0.5) return currentZoom;

  const delta = -deltaY;
  let factor: number;

  // 触控板平滑捏合 (delta 较小) 采用指数连续平滑，鼠标阶梯滚轮采用对数对齐
  if (Math.abs(delta) < 40) {
    factor = Math.exp(delta * 0.006);
  } else {
    factor = delta > 0 ? 1.15 : 0.87;
  }

  const rawZoom = currentZoom * factor;
  const clamped = Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, rawZoom));

  return Math.round(clamped);
}

/**
 * 依据光标在视口中的物理坐标，计算缩放后保持光标下文档内容不漂移的滚动位置
 */
export function calculatePdfFocalScroll(params: FocalScrollParams): FocalScrollResult {
  const {
    containerRect,
    cursorClientX,
    cursorClientY,
    scrollLeft,
    scrollTop,
    oldZoom,
    newZoom,
  } = params;

  if (oldZoom <= 0 || newZoom <= 0 || oldZoom === newZoom) {
    return { targetScrollLeft: scrollLeft, targetScrollTop: scrollTop };
  }

  // 计算光标在滚动视口内的偏移坐标
  const cursorOffsetX = cursorClientX - containerRect.left;
  const cursorOffsetY = cursorClientY - containerRect.top;

  // 光标在文档真实排版像素空间中的坐标
  const contentX = scrollLeft + cursorOffsetX;
  const contentY = scrollTop + cursorOffsetY;

  // 缩放比例
  const ratio = newZoom / oldZoom;

  // 缩放后的新排版空间中，该点应依然位于光标视口相对位置
  const targetScrollLeft = Math.max(0, Math.round(contentX * ratio - cursorOffsetX));
  const targetScrollTop = Math.max(0, Math.round(contentY * ratio - cursorOffsetY));

  return {
    targetScrollLeft,
    targetScrollTop,
  };
}

/**
 * 快捷键 / 按钮单步放大步进推导 (Zoom In)
 */
export function getNextPdfZoomIn(currentZoom: number): number {
  let step: number;
  if (currentZoom < 100) step = 15;
  else if (currentZoom < 200) step = 25;
  else step = 50;

  const next = Math.min(MAX_PDF_ZOOM, Math.round((currentZoom + step) / 5) * 5);
  return next;
}

/**
 * 快捷键 / 按钮单步缩小步进推导 (Zoom Out)
 */
export function getNextPdfZoomOut(currentZoom: number): number {
  let step: number;
  if (currentZoom <= 100) step = 15;
  else if (currentZoom <= 200) step = 25;
  else step = 50;

  const next = Math.max(MIN_PDF_ZOOM, Math.round((currentZoom - step) / 5) * 5);
  return next;
}

/**
 * 计算适宽模式下的缩放百分比
 */
export function calculateFitWidthZoom(
  containerWidth: number,
  pageWidth: number,
  viewMode: 'continuous' | 'single' | 'dual' = 'continuous'
): number {
  if (containerWidth <= 0 || pageWidth <= 0) return DEFAULT_PDF_ZOOM;
  const padding = viewMode === 'dual' ? 140 : 80;
  const baseW = viewMode === 'dual' ? pageWidth * 2 : pageWidth;
  const available = containerWidth - padding;
  if (available <= 100) return DEFAULT_PDF_ZOOM;

  const scale = Math.round((available / baseW) * 100);
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, scale));
}

/**
 * 计算适页模式下的缩放百分比
 */
export function calculateFitPageZoom(containerHeight: number, pageHeight: number): number {
  if (containerHeight <= 0 || pageHeight <= 0) return DEFAULT_PDF_ZOOM;
  const available = containerHeight - 80;
  if (available <= 100) return DEFAULT_PDF_ZOOM;

  const scale = Math.round((available / pageHeight) * 100);
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, scale));
}

/**
 * 常用缩放比例预设表 (Presets)
 */
export const PDF_ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300, 400, 500] as const;

/**
 * 截断缩放百分比至有效边界 [MIN_PDF_ZOOM, MAX_PDF_ZOOM]
 */
export function clampPdfZoom(zoom: number): number {
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, Math.round(zoom)));
}

/**
 * 抓手工具平移计算 (Pan offset)
 */
export function calculatePanOffset(
  startScrollLeft: number,
  startScrollTop: number,
  deltaX: number,
  deltaY: number
): { scrollLeft: number; scrollTop: number } {
  return {
    scrollLeft: Math.max(0, Math.round(startScrollLeft - deltaX)),
    scrollTop: Math.max(0, Math.round(startScrollTop - deltaY)),
  };
}
