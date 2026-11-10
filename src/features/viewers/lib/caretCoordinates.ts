/**
 * textarea 光标精确像素坐标计算工具 (Caret Position Coordinates)
 * 基于镜像 DOM (Mirror Div) 计算光标在视口中的精确 (x, y) 像素位置
 * 兼容软换行 (Word Wrap)、自定义字体、行高与滚动偏移
 */

// 需要精确从 textarea 复制到镜像容器的样式属性
const PROPERTIES_TO_COPY = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
  'whiteSpace',
  'wordWrap',
  'lineBreak',
] as const;

export interface CaretCoordinates {
  top: number; // 相对于 textarea 内容区域顶部的像素
  left: number; // 相对于 textarea 内容区域左侧的像素
  height: number; // 光标高度 (行高)
  viewportTop: number; // 扣除 scrollTop 后相对于 textarea 可视区域的 top
  viewportLeft: number; // 扣除 scrollLeft 后相对于 textarea 可视区域的 left
}

let mirrorDiv: HTMLDivElement | null = null;

function getMirrorDiv(): HTMLDivElement {
  if (typeof document === 'undefined') {
    return {} as HTMLDivElement;
  }
  if (!mirrorDiv) {
    mirrorDiv = document.createElement('div');
    mirrorDiv.id = 'ov-textarea-caret-position-mirror';
    mirrorDiv.style.position = 'absolute';
    mirrorDiv.style.top = '-9999px';
    mirrorDiv.style.left = '-9999px';
    mirrorDiv.style.visibility = 'hidden';
    mirrorDiv.style.pointerEvents = 'none';
    mirrorDiv.style.zIndex = '-9999';
    document.body.appendChild(mirrorDiv);
  }
  return mirrorDiv;
}

/**
 * 计算 textarea 中指定字符下标光标的精确像素坐标
 * @param element HTMLTextAreaElement
 * @param position 字符下标 (如 selectionStart)
 */
export function getCaretCoordinates(
  element: HTMLTextAreaElement | null,
  position: number
): CaretCoordinates {
  if (!element || typeof window === 'undefined') {
    return { top: 0, left: 0, height: 20, viewportTop: 0, viewportLeft: 0 };
  }

  const mirror = getMirrorDiv();
  const computed = window.getComputedStyle(element);

  // 复制几何与字体样式
  for (const prop of PROPERTIES_TO_COPY) {
    (mirror.style as any)[prop] = computed.getPropertyValue(
      prop.replace(/([A-Z])/g, '-$1').toLowerCase()
    );
  }

  // 必须保持与 textarea 一致的宽度与盒模型
  mirror.style.width = `${element.clientWidth}px`;
  mirror.style.overflow = 'hidden';

  // 截取光标前后的文本
  const textBefore = element.value.substring(0, position);
  const textAfter = element.value.substring(position);

  mirror.textContent = '';

  const spanBefore = document.createTextNode(textBefore);
  const marker = document.createElement('span');
  marker.textContent = '\u200b'; // 零宽字符
  const spanAfter = document.createTextNode(textAfter);

  mirror.appendChild(spanBefore);
  mirror.appendChild(marker);
  mirror.appendChild(spanAfter);

  const markerOffsetTop = marker.offsetTop;
  const markerOffsetLeft = marker.offsetLeft;
  const parsedLineHeight = parseFloat(computed.lineHeight);
  const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
    ? parsedLineHeight
    : parseFloat(computed.fontSize) * 1.5 || 20;

  const top = markerOffsetTop;
  const left = markerOffsetLeft;
  const viewportTop = top - element.scrollTop;
  const viewportLeft = left - element.scrollLeft;

  return {
    top,
    left,
    height: marker.offsetHeight || lineHeight,
    viewportTop,
    viewportLeft,
  };
}

