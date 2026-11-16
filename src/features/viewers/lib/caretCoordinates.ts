/**
 * 计算 textarea 中光标的像素级坐标 (Caret Coordinates)
 * 通过镜像隐藏 DOM 测量光标相对于可视视口的坐标位置
 */

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
  viewportTop: number;
  viewportLeft: number;
}

const properties: (keyof CSSStyleDeclaration)[] = [
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
] as any[];

let mirrorDiv: HTMLDivElement | null = null;

export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): CaretCoordinates {
  if (typeof window === 'undefined') {
    return { top: 0, left: 0, height: 20, viewportTop: 0, viewportLeft: 0 };
  }

  if (!mirrorDiv) {
    mirrorDiv = document.createElement('div');
    mirrorDiv.id = 'input-textarea-caret-position-mirror-div';
    document.body.appendChild(mirrorDiv);
  }

  const style = mirrorDiv.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '0px';
  style.left = '-9999px';

  properties.forEach((prop) => {
    // @ts-expect-error dynamic style assignment
    style[prop] = computed[prop];
  });

  mirrorDiv.textContent = element.value.substring(0, position);

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  mirrorDiv.appendChild(span);

  const top = span.offsetTop + parseInt(computed.borderTopWidth, 10);
  const left = span.offsetLeft + parseInt(computed.borderLeftWidth, 10);
  const height = parseInt(computed.lineHeight, 10) || span.offsetHeight || 20;

  const viewportTop = top - element.scrollTop;
  const viewportLeft = left - element.scrollLeft;

  return {
    top,
    left,
    height,
    viewportTop,
    viewportLeft,
  };
}
