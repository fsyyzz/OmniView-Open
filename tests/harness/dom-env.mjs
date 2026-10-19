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
