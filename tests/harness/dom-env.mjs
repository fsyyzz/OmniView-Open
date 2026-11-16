/**
 * OmniView — 统一 Headless DOM 测试环境 (DOM Test Harness)
 *
 * 基于 happy-dom 提供标准无头浏览器环境与 React 19 Act / SVG 交互所需 Polyfills。
 */
import { GlobalWindow } from 'happy-dom';

let activeWindow = null;
const originalGlobals = new Map();

const GLOBAL_KEYS = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'NodeFilter',
  'SVGElement',
  'SVGSVGElement',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'WheelEvent',
  'PointerEvent',
  'KeyboardEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
  'DOMRect',
  'DOMPoint',
  'DOMParser',
  'XMLSerializer',
];

export function setupDomEnvironment(options = {}) {
  const url = options.url || 'https://localhost:3000';

  if (!activeWindow) {
    // 备份原有全局变量属性描述符（兼容 Node 22+ globalThis.navigator 只读 getter）
    for (const key of GLOBAL_KEYS) {
      const desc = Object.getOwnPropertyDescriptor(globalThis, key);
      if (desc) {
        originalGlobals.set(key, desc);
      }
    }
  }

  const window = new GlobalWindow({ url });
  const document = window.document;
  activeWindow = window;

  const polyfilledGlobals = {
    window,
    document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    NodeFilter: window.NodeFilter || {
      SHOW_ALL: 0xffffffff,
      SHOW_ELEMENT: 1,
      SHOW_TEXT: 4,
      FILTER_ACCEPT: 1,
      FILTER_REJECT: 2,
      FILTER_SKIP: 3,
    },
    SVGElement: window.SVGElement,
    SVGSVGElement: window.SVGSVGElement,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MouseEvent: window.MouseEvent,
    WheelEvent: window.WheelEvent,
    PointerEvent: window.PointerEvent || window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
    DOMRect: window.DOMRect || class DOMRect {
      constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.top = y;
        this.left = x;
        this.right = x + width;
        this.bottom = y + height;
      }
    },
    DOMPoint: window.DOMPoint || class DOMPoint {
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }
      matrixTransform() { return this; }
    },
    DOMParser: window.DOMParser,
    XMLSerializer: window.XMLSerializer,
  };

  for (const [key, value] of Object.entries(polyfilledGlobals)) {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }

  // SVG PointerCapture 垫片
  if (window.SVGElement?.prototype) {
    if (!window.SVGElement.prototype.setPointerCapture) {
      window.SVGElement.prototype.setPointerCapture = () => {};
    }
    if (!window.SVGElement.prototype.releasePointerCapture) {
      window.SVGElement.prototype.releasePointerCapture = () => {};
    }
  }

  // 修复 happy-dom DOMParser("application/xml") 下 Attr.localName 错误保留前缀 (如 "w:val") 的标准偏差
  const attrLocalNameDesc = window.Attr?.prototype
    ? Object.getOwnPropertyDescriptor(window.Attr.prototype, 'localName')
    : null;
  if (attrLocalNameDesc?.configurable && typeof attrLocalNameDesc.get === 'function') {
    const origGet = attrLocalNameDesc.get;
    Object.defineProperty(window.Attr.prototype, 'localName', {
      configurable: true,
      enumerable: attrLocalNameDesc.enumerable ?? false,
      get() {
        const raw = origGet.call(this);
        if (typeof raw === 'string' && raw.includes(':')) {
          return raw.slice(raw.indexOf(':') + 1);
        }
        return raw;
      },
    });
  }

  return {
    window,
    document,
    cleanup: () => cleanupDomEnvironment(),
  };
}

export function cleanupDomEnvironment() {
  if (activeWindow) {
    try {
      activeWindow.document.body.innerHTML = '';
      activeWindow.close();
    } catch {
      // 忽略关闭异常
    }
    activeWindow = null;
  }

  // 恢复原始环境描述符
  for (const key of GLOBAL_KEYS) {
    if (originalGlobals.has(key)) {
      Object.defineProperty(globalThis, key, originalGlobals.get(key));
    } else {
      delete globalThis[key];
    }
  }
  originalGlobals.clear();
}
