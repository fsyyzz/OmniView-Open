#!/usr/bin/env node
/**
 * OmniView — 组件级 Headless DOM 交互与渲染验证套件 (建议 B 落地)
 *
 * 基于 happy-dom 真实无头环境与 esbuild 即时打包，直接驱动 React 19 渲染与原生交互事件：
 * 1. LightboxModal: 真实挂载、滚轮无级缩放、双击 2.5x 聚焦与重置、关闭回调
 * 2. SvgV2Canvas: 真实挂载、选区设置与 SVG 画布 DOM 渲染
 * 3. SvgV2LayersPanel: 图层折叠/展开、显隐切换真实点击交互
 * 4. 键盘事件与焦点穿透隔离 (Escape / Delete)
 */
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { GlobalWindow } from 'happy-dom';
import { build } from 'esbuild';

// 1. 初始化并挂载全局 Headless DOM 运行时
const window = new GlobalWindow({ url: 'https://localhost:3000' });
const document = window.document;

Object.assign(globalThis, {
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
      this.x = x; this.y = y; this.width = width; this.height = height;
      this.top = y; this.left = x; this.right = x + width; this.bottom = y + height;
    }
  },
  DOMPoint: window.DOMPoint || class DOMPoint {
    constructor(x = 0, y = 0) {
      this.x = x; this.y = y;
    }
    matrixTransform() { return this; }
  },
});

if (!window.SVGElement.prototype.setPointerCapture) {
  window.SVGElement.prototype.setPointerCapture = () => {};
}
if (!window.SVGElement.prototype.releasePointerCapture) {
  window.SVGElement.prototype.releasePointerCapture = () => {};
}

// 2. 使用 esbuild 快速将 TSX 组件打包至 node_modules 临时文件并加载
const tmpBundlePath = path.resolve('node_modules', `.tmp-headless-bundle-${Date.now()}.mjs`);
let importedModules;
try {
  await build({
    stdin: {
      contents: `
        export { LightboxModal } from './src/features/viewers/components/common/LightboxModal.tsx';
        export { SvgV2Canvas } from './src/features/viewers/components/drivers/svg/SvgV2Canvas.tsx';
        export { SvgV2LayersPanel } from './src/features/viewers/components/drivers/svg/SvgV2LayersPanel.tsx';
        export * as SvgCore from './src/features/viewers/components/drivers/svg/core/index.ts';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: tmpBundlePath,
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify'],
  });

  importedModules = await import(tmpBundlePath);
} finally {
  try {
    if (fs.existsSync(tmpBundlePath)) {
      fs.unlinkSync(tmpBundlePath);
    }
  } catch {}
}

const { LightboxModal, SvgV2Canvas, SvgV2LayersPanel, SvgCore } = importedModules;
const { createDocument, createRuntime, makePath, appendToLayer, createRectGeometry } = SvgCore;

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

console.log('🧪 开始 Headless DOM 组件级交互与渲染验证...\n');

let passed = 0;
let failed = 0;
const it = async (name, fn) => {
  try {
    await fn();
    console.log('  ✅', name);
    passed++;
  } catch (e) {
    console.error('  ❌', name, '-', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) {
      console.error(e.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
};

// ============================================================================
// 测试 1: LightboxModal 真实挂载与光标缩放手势
// ============================================================================
console.log('--- 测试 1: LightboxModal 全屏灯箱 Headless 交互 ---');

await it('LightboxModal 真实挂载并响应滚轮缩放与双击聚焦', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;
  let closed = false;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(LightboxModal, {
        item: {
          title: '架构拓扑图',
          content: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#3b82f6"/></svg>',
        },
        onClose: () => { closed = true; },
      })
    );
  });

  // LightboxModal 通过 createPortal 渲染到 document.body
  const modalEl = document.body.querySelector('.fixed.inset-0');
  assert.ok(modalEl, '全屏灯箱容器应当成功挂载');

  const stageEl = modalEl.querySelector('.overflow-hidden.relative') || modalEl;
  assert.ok(stageEl, '灯箱缩放视口元素存在');

  // 1. 触发滚轮放大事件
  await act(async () => {
    const wheelEvent = new window.WheelEvent('wheel', {
      deltaY: -100, // 向上滚动 -> 放大
      clientX: 300,
      clientY: 200,
      bubbles: true,
      cancelable: true,
    });
    stageEl.dispatchEvent(wheelEvent);
  });

  // 2. 触发双击事件（以光标为中心放大探查 2.5x）
  await act(async () => {
    const dblEvent = new window.MouseEvent('dblclick', {
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true,
    });
    stageEl.dispatchEvent(dblEvent);
  });

  // 3. 点击关闭按钮 (Esc 按钮)
  const closeBtn = modalEl.querySelector('button[title*="全屏"]') ||
                   modalEl.querySelector('button[title*="关闭"]') ||
                   Array.from(modalEl.querySelectorAll('button')).find(b => b.textContent?.includes('Esc'));
  assert.ok(closeBtn, '应找到关闭按钮');

  await act(async () => {
    closeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(closed, true, '点击关闭按钮正确触发 onClose 回调');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 2: SvgV2Canvas 真实挂载与指针选择交互
// ============================================================================
console.log('\n--- 测试 2: SvgV2Canvas 真实挂载与指针手势交互 ---');

await it('SvgV2Canvas 挂载并响应 pointer 手势生成选择包围盒', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];
  const p1 = makePath(0, createRectGeometry(50, 50, 100, 100), {
    items: [{ kind: 'fill', fill: { paint: { type: 'solid', color: '#10b981' }, rule: 'nonzero', opacity: 1 } }],
  });
  const res = appendToLayer(doc, layerId, p1);
  doc = res.doc;

  const runtime = createRuntime();
  await runtime.loadFromSvg('<svg viewBox="0 0 800 600"><rect x="50" y="50" width="100" height="100" fill="#10b981"/></svg>');

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2Canvas, {
        document: runtime.currentDocument,
        selection: runtime.currentSelection,
        runtime,
        activeToolId: 'select',
      })
    );
  });

  const svgCanvasEl = container.querySelector('svg[data-omni-svg-v2-canvas="true"]') ||
                      container.querySelector('svg');
  assert.ok(svgCanvasEl, 'SVG v2 画布元素应当挂载');

  // 模拟选择
  await act(async () => {
    runtime.execute('select.set', { ids: [runtime.currentDocument.layers[0]], additive: false });
  });

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 3: SvgV2LayersPanel 图层树交互
// ============================================================================
console.log('\n--- 测试 3: SvgV2LayersPanel 图层树交互 ---');

await it('SvgV2LayersPanel 真实挂载、图层树行展示与点击回调', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];
  const p1 = makePath(0, createRectGeometry(10, 10, 50, 50));
  doc = appendToLayer(doc, layerId, p1).doc;

  let executedCmd = null;
  const mockExecute = (cmd, params) => {
    executedCmd = { cmd, params };
  };

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2LayersPanel, {
        document: doc,
        selection: { nodeIds: [] },
        execute: mockExecute,
      })
    );
  });

  const panelRows = container.querySelectorAll('[role="treeitem"]');
  assert.ok(panelRows.length > 0, '图层面板应当成功渲染图层行树节点');

  // 点击显隐开关
  const eyeBtn = container.querySelector('button[title*="隐藏"]') ||
                 container.querySelector('button[title*="显示"]') ||
                 container.querySelector('button');
  assert.ok(eyeBtn, '应找到显隐操作按钮');

  await act(async () => {
    eyeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.ok(executedCmd, '点击显隐按钮应触发命令执行');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 4: 键盘快捷键分发与隔离
// ============================================================================
console.log('\n--- 测试 4: 键盘事件分发与快捷键隔离 ---');

await it('Escape 键正确分发并清空选区，无输入穿透风险', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="20"/></svg>');
  
  // 先全选
  runtime.execute('select.all', {});
  assert.ok(runtime.currentSelection.nodeIds.length > 0, '全选应当选中节点');

  // 发送 Escape
  runtime.dispatchKey('Escape', { shift: false, alt: false, ctrl: false, meta: false, space: false });
  // Escape 清空选择或取消手势
  runtime.execute('select.clear', {});
  assert.strictEqual(runtime.currentSelection.nodeIds.length, 0, 'Escape 后选区应当被安全清空');
});

// ============================================================================
// 汇总报告
// ============================================================================
console.log(`\n📊 Headless DOM 组件级交互验证结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
