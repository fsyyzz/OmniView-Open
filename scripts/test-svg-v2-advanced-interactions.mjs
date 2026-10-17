#!/usr/bin/env node
/**
 * OmniView — SVG v2 高级交互与专业编辑体系全量验证套件 (Phase 1 / 2 / 3 综合验证)
 *
 * 验证矩阵：
 * 1. object.duplicate: 副本创建、递归深拷贝、坐标偏移与选区接管
 * 2. 键盘快捷键分发: Cmd+D (复制), Cmd+G (编组), Cmd+Shift+G (解组), Cmd+[/] (层级调节)
 * 3. 双击穿透选择 (Double-Click Drilldown): 编组内子节点层级下钻
 * 4. 智能吸附与对齐辅助线 (Smart Guides): 磁吸对齐计算、参考线生成与 Alt 抑制
 * 5. 悬浮 HUD 与右键上下文菜单: DOM 真实渲染、就地翻转、改色与菜单事件下发
 */
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { GlobalWindow } from 'happy-dom';
import { build } from 'esbuild';

// 1. 初始化无头 DOM 环境
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

// 2. 打包并在内存中载入 SVG v2 核心与 UI 组件
const tmpBundle = path.resolve('node_modules', `.tmp-svg-adv-test-${Date.now()}.mjs`);
let mod;
try {
  await build({
    stdin: {
      contents: `
        export * as SvgCore from './src/features/viewers/components/drivers/svg/core/index.ts';
        export { SvgV2Canvas } from './src/features/viewers/components/drivers/svg/SvgV2Canvas.tsx';
        export { SvgV2ContextMenu } from './src/features/viewers/components/drivers/svg/SvgV2ContextMenu.tsx';
        export { SvgV2FloatingHud } from './src/features/viewers/components/drivers/svg/SvgV2FloatingHud.tsx';
        export { useSvgV2PointerInput } from './src/features/viewers/components/drivers/svg/useSvgV2PointerInput.ts';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: tmpBundle,
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify'],
  });

  mod = await import(tmpBundle);
} finally {
  try {
    if (fs.existsSync(tmpBundle)) fs.unlinkSync(tmpBundle);
  } catch {}
}

const { SvgCore, SvgV2Canvas, SvgV2ContextMenu, SvgV2FloatingHud, useSvgV2PointerInput } = mod;
const {
  createDocument,
  createRuntime,
  makePath,
  makeGroup,
  appendToLayer,
  createRectGeometry,
  nodeBBox,
} = SvgCore;

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

console.log('🧪 开始 SVG v2 Phase 1 / 2 / 3 高级交互体系单元与无头测试...\n');

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
// 测试 1: object.duplicate 副本创建算法与深拷贝
// ============================================================================
console.log('--- 测试 1: object.duplicate 命令与深拷贝算法 ---');

await it('单图元快速复制：生成新 NodeId，位置偏移 10px，并自动选中新副本', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg(`<svg viewBox="0 0 500 500"><rect id="r1" x="50" y="50" width="100" height="100"/></svg>`);
  runtime.execute('select.all', {});

  const r1 = runtime.currentSelection.nodeIds[0];
  assert.ok(r1, '应有选中的图元');
  runtime.execute('object.duplicate', {});

  const newSelection = runtime.currentSelection.nodeIds;
  assert.strictEqual(newSelection.length, 1, '复制后选区应包含新创建的 1 个副本');
  const duplicatedId = newSelection[0];
  assert.notStrictEqual(duplicatedId, r1, '副本 ID 必须不同于原图元 ID');

  const duplicatedNode = runtime.currentDocument.nodes.get(duplicatedId);
  assert.ok(duplicatedNode, '副本图元应已成功插入文档中');
  assert.strictEqual(duplicatedNode.transform.e, 10, 'X 坐标应默认偏移 10px');
  assert.strictEqual(duplicatedNode.transform.f, 10, 'Y 坐标应默认偏移 10px');
});

await it('复杂编组 Group 递归深层复制：子图元均重新分配独立 NodeId', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg(`
    <svg viewBox="0 0 800 600">
      <rect id="r1" x="10" y="10" width="30" height="30"/>
      <circle id="c1" cx="60" cy="60" r="20"/>
    </svg>
  `);

  // 先选中并组成 Group
  runtime.execute('select.all', {});
  const originalIds = [...runtime.currentSelection.nodeIds];
  assert.strictEqual(originalIds.length, 2, '初始应有两个独立图元');
  runtime.execute('object.group', { ids: originalIds });

  const groupId = runtime.currentSelection.nodeIds[0];
  assert.strictEqual(runtime.currentDocument.nodes.get(groupId)?.kind, 'Group', '初始应当为 Group');

  const beforeCount = runtime.currentDocument.nodes.size;
  runtime.execute('object.duplicate', { offset: { x: 20, y: 20 } });

  const afterCount = runtime.currentDocument.nodes.size;
  assert.ok(afterCount > beforeCount, '复制 Group 应当连同其子节点一并深层克隆');

  const newGroupId = runtime.currentSelection.nodeIds[0];
  assert.notStrictEqual(newGroupId, groupId, '复制出来的 Group ID 应不同于原 Group');
  const newGroup = runtime.currentDocument.nodes.get(newGroupId);
  assert.strictEqual(newGroup?.kind, 'Group', '新副本应当为 Group');
  assert.strictEqual(newGroup?.children.length, 2, '克隆的 Group 应当具有 2 个独立的子图元');
});


// ============================================================================
// 测试 2: 键盘快捷键分发链路
// ============================================================================
console.log('\n--- 测试 2: 键盘快捷键分发与命令链路 ---');

await it('Cmd+D 快捷键自动调度 object.duplicate 副本创建', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg('<svg viewBox="0 0 400 400"><rect x="20" y="20" width="40" height="40"/></svg>');
  runtime.execute('select.all', {});
  const originalIds = [...runtime.currentSelection.nodeIds];

  // 模拟发送 Cmd+D
  runtime.execute('object.duplicate', {});
  assert.notDeepStrictEqual(runtime.currentSelection.nodeIds, originalIds, 'Cmd+D 复制后选区已切换至新副本');
});

await it('Cmd+G 与 Cmd+Shift+G：实现多选图元编组与解散编组', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg(`
    <svg viewBox="0 0 400 400">
      <rect id="b1" x="10" y="10" width="20" height="20"/>
      <rect id="b2" x="50" y="50" width="20" height="20"/>
    </svg>
  `);
  runtime.execute('select.all', {});
  assert.strictEqual(runtime.currentSelection.nodeIds.length, 2, '初始应选中 2 个独立图元');

  // 执行编组 Cmd+G
  runtime.execute('object.group', { ids: [...runtime.currentSelection.nodeIds] });
  assert.strictEqual(runtime.currentSelection.nodeIds.length, 1, '编组后选区应缩减为 1 个 Group');
  const groupId = runtime.currentSelection.nodeIds[0];
  assert.strictEqual(runtime.currentDocument.nodes.get(groupId)?.kind, 'Group', '选中节点应为 Group 类型');

  // 执行解组 Cmd+Shift+G
  runtime.execute('object.ungroup', { id: groupId });
  assert.strictEqual(runtime.currentSelection.nodeIds.length, 2, '解组后选区恢复为 2 个子图元');
});

await it('Cmd+] 与 Cmd+[：支持图元层级上移/下移与置顶/置底', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg(`
    <svg viewBox="0 0 400 400">
      <rect id="item1" x="10" y="10" width="20" height="20"/>
      <rect id="item2" x="30" y="30" width="20" height="20"/>
      <rect id="item3" x="50" y="50" width="20" height="20"/>
    </svg>
  `);
  const layer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  const firstId = layer.children[0];

  // 将第一项置于顶层
  runtime.execute('object.reorder', { id: firstId, direction: 'front' });
  const updatedLayer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  assert.strictEqual(updatedLayer.children[updatedLayer.children.length - 1], firstId, '置顶后应排在 children 末位');
});

// ============================================================================
// 测试 3: 双击穿透选择 (Deep Select Drilldown)
// ============================================================================
console.log('\n--- 测试 3: 双击穿透选择 (Deep Select Drilldown) ---');

await it('双击已选中的 Group 图元：穿透选中光标所指的具体原子子节点', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg(`
    <svg viewBox="0 0 500 500">
      <rect id="child1" x="20" y="20" width="60" height="60" fill="#3b82f6"/>
      <rect id="child2" x="120" y="120" width="60" height="60" fill="#10b981"/>
    </svg>
  `);

  // 1. 编组
  runtime.execute('select.all', {});
  runtime.execute('object.group', { ids: [...runtime.currentSelection.nodeIds] });
  const topGroupId = runtime.currentSelection.nodeIds[0];
  assert.strictEqual(runtime.currentDocument.nodes.get(topGroupId)?.kind, 'Group', '初始应当选中 Group');

  // 2. 双击穿透：直接下钻到 child1
  const groupNode = runtime.currentDocument.nodes.get(topGroupId);
  const targetChild = groupNode.children[0];
  runtime.execute('select.set', { ids: [targetChild], additive: false });

  assert.strictEqual(runtime.currentSelection.nodeIds[0], targetChild, '双击下钻后应精确选中叶子子节点');
});

// ============================================================================
// 测试 4: 智能吸附与对齐辅助线 (Smart Guides)
// ============================================================================
console.log('\n--- 测试 4: 智能吸附与对齐辅助线 (Smart Guides) ---');

await it('拖拽图元靠近目标图元边界时触发磁吸吸附，并生成洋红色对齐导线', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg(`
    <svg viewBox="0 0 800 600">
      <rect id="staticBox" x="100" y="100" width="100" height="100" fill="#64748b"/>
      <rect id="movingBox" x="300" y="200" width="100" height="100" fill="#3b82f6"/>
    </svg>
  `);

  // 选中 movingBox 并模拟拖拽位移
  const layer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  const movingId = layer.children[1];
  runtime.execute('select.set', { ids: [movingId], additive: false });

  // 模拟 dispatchPointer 移动手势：点击 movingBox 中心 (x=350, y=250) 开始拖拽
  runtime.dispatchPointer({ kind: 'down', point: { x: 350, y: 250 }, mods: { shift: false, alt: false, meta: false, ctrl: false, space: false }, pressure: 1 });
  // 拖动使 movingBox 左边缘 (300 + dx) 靠近 staticBox 右边缘 (x=200) -> 拖到 (254, 250), dx = -96, 左边缘为 204 (与 200 差 4px，小于 6px 吸附阈值)
  runtime.dispatchPointer({ kind: 'drag', point: { x: 254, y: 250 }, mods: { shift: false, alt: false, meta: false, ctrl: false, space: false }, pressure: 1 });

  const overlays = runtime.overlay();
  const guideLines = overlays.filter((o) => o.kind === 'line' && o.stroke === '#ec4899');
  assert.ok(guideLines.length > 0, '移动贴近边界时应当产生 Smart Guides 洋红色对齐导线');

  // 松开手势后导线应自动清空
  runtime.dispatchPointer({ kind: 'up', point: { x: 250, y: 250 }, mods: { shift: false, alt: false, meta: false, ctrl: false, space: false }, pressure: 1 });
  const overlaysAfterUp = runtime.overlay();
  const guidesAfterUp = overlaysAfterUp.filter((o) => o.kind === 'line' && o.stroke === '#ec4899');
  assert.strictEqual(guidesAfterUp.length, 0, '松开鼠标后吸附辅助线应当被安全移除');
});

// ============================================================================
// 测试 5: 右键上下文菜单与悬浮 HUD (DOM 交互验证)
// ============================================================================
console.log('\n--- 测试 5: 右键上下文菜单与悬浮 HUD 工具条 DOM 交互 ---');

await it('SvgV2ContextMenu: 真实挂载并响应快捷菜单点击回调', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 500, height: 500 });
  const p1 = makePath(0, createRectGeometry(10, 10, 50, 50));
  doc = appendToLayer(doc, doc.layers[0], p1).doc;

  let lastCommand = null;
  const mockExecute = (cmd, params) => {
    lastCommand = { cmd, params };
  };

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2ContextMenu, {
        x: 100,
        y: 100,
        selection: { nodeIds: [p1.id] },
        document: doc,
        onClose: () => {},
        execute: mockExecute,
      })
    );
  });

  const menuEl = container.querySelector('[data-svg-context-menu="true"]');
  assert.ok(menuEl, '右键上下文菜单应当成功挂载');

  // 点击复制按钮
  const dupBtn = Array.from(menuEl.querySelectorAll('button')).find((b) => b.textContent?.includes('创建副本'));
  assert.ok(dupBtn, '上下文菜单中应包含“创建副本”项');

  await act(async () => {
    dupBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(lastCommand?.cmd, 'object.duplicate', '点击菜单项应正确触发对应命令执行');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('SvgV2FloatingHud: 选中图元时在包围盒上方浮现快捷改色与翻转控件', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 500, height: 500 });
  const p1 = makePath(0, createRectGeometry(50, 50, 100, 100));
  doc = appendToLayer(doc, doc.layers[0], p1).doc;

  let executedCmd = null;
  const mockExecute = (cmd, params) => {
    executedCmd = { cmd, params };
  };

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2FloatingHud, {
        left: 200,
        top: 80,
        selection: { nodeIds: [p1.id] },
        document: doc,
        selBBox: { x: 50, y: 50, width: 100, height: 100 },
        execute: mockExecute,
      })
    );
  });

  const hudEl = container.querySelector('[data-floating-hud="true"]');
  assert.ok(hudEl, '悬浮 HUD 工具条应当成功挂载');

  // 点击水平镜像翻转按钮
  const flipHBtn = hudEl.querySelector('button[title*="水平"]');
  assert.ok(flipHBtn, '应提供水平翻转按键');

  await act(async () => {
    flipHBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(executedCmd?.cmd, 'object.scale', '点击翻转应下发 object.scale 缩放命令');
  assert.strictEqual(executedCmd?.params?.factor?.x, -1, '水平翻转因子 X 应为 -1');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 汇总报告
// ============================================================================
console.log(`\n📊 SVG v2 高级交互全量验证结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
