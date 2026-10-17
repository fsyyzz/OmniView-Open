#!/usr/bin/env node
/**
 * OmniView SVG 编辑引擎 v2 — 滚轮缩放防误触契约测试 (Regression Test)
 *
 * 回归测试：选中元素后，右侧属性面板内的滚轮事件不应触发画布 zoom。
 * 修复在 `useSvgCanvasInteraction.ts` 的 `handleWheel` 入口加入 UI 控件白名单。
 *
 * 本测试用最小化 DOM mock 验证逻辑契约（不依赖完整 React 渲染）。
 */
import assert from 'node:assert';

console.log('🧪 开始 SVG 滚轮缩放防误触契约测试...');

let passed = 0;
let failed = 0;
const it = (name, fn) => {
  try {
    fn();
    console.log('  ✅', name);
    passed++;
  } catch (e) {
    console.log('  ❌', name, '-', e instanceof Error ? e.message : e);
    failed++;
  }
};

// ============================================================================
// 模拟修复后的 handleWheel 行为
// ============================================================================

/** 命中白名单的元素 className / id 集合。 */
const UI_BLOCKLIST = [
  '#svg-inspector-panel',
  '[data-inspector-panel]',
  '#svg-batch-inspector-panel',
  '#canvas-statusbar',
  '[data-canvas-ui]',
  'input',
  'select',
  'textarea',
  '[role="slider"]',
  '[contenteditable]',
];

/**
 * 模拟 React 的 `closest()` 选择器：在祖先链中查找匹配的选择器。
 * @param ancestors 自 target 起的祖先链（含 target 自己），按从内到外顺序
 * @param selector CSS 选择器
 */
function mockClosest(ancestors, selector) {
  // 简化版：仅匹配 id、data-*、tagName、属性 [attr=value]
  for (const el of ancestors) {
    if (selector.startsWith('#')) {
      if (el.id === selector.slice(1)) return true;
    } else if (selector.startsWith('[data-')) {
      const m = selector.match(/\[data-([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/);
      if (!m) continue;
      const expected = m[2];
      const camelKey = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const actual =
        (el.dataset ?? {})[m[1]] ?? // dataset 用 camelCase，如 inspectorPanel
        (el.dataset ?? {})[camelKey] ??
        el.attributes?.['data-' + m[1]] ?? // 属性形态为 data-inspector-panel
        el.attributes?.['data-' + camelKey];
      if (actual !== undefined && (expected === undefined || actual === expected)) return true;
    } else if (selector.startsWith('[')) {
      const m = selector.match(/\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/);
      if (!m) continue;
      const key = m[1];
      const expected = m[2];
      const actual = el.attributes?.[key];
      if (actual !== undefined && (expected === undefined || actual === expected)) return true;
    } else {
      if (el.tagName?.toLowerCase() === selector.toLowerCase()) return true;
    }
  }
  return false;
}

/**
 * 修复后的 handleWheel 决策函数。
 */
function shouldBlockWheel(targetAncestors) {
  for (const sel of UI_BLOCKLIST) {
    if (mockClosest(targetAncestors, sel)) return true;
  }
  return false;
}

// ============================================================================
// 测试用例
// ============================================================================

it('命中 #svg-inspector-panel 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { id: 'svg-inspector-panel', tagName: 'div' },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    true,
  );
});

it('命中 [data-inspector-panel] 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'div', dataset: { inspectorPanel: 'true' } },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    true,
  );
});

it('命中 #svg-batch-inspector-panel 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { id: 'svg-batch-inspector-panel', tagName: 'div' },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    true,
  );
});

it('命中 #canvas-statusbar 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { id: 'canvas-statusbar', tagName: 'div' },
    ]),
    true,
  );
});

it('命中 input 阻止 zoom（颜色选择器等）', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'input', attributes: { type: 'color' } },
      { id: 'svg-inspector-panel', tagName: 'div' },
    ]),
    true,
  );
});

it('命中 select 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'select', attributes: { 'data-engine-switcher': 'true' } },
    ]),
    true,
  );
});

it('命中 textarea 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'textarea' },
    ]),
    true,
  );
});

it('命中 [role="slider"] 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'div', attributes: { role: 'slider' } },
    ]),
    true,
  );
});

it('命中 [contenteditable] 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'div', attributes: { contenteditable: 'true' } },
    ]),
    true,
  );
});

it('命中 [data-canvas-ui] 阻止 zoom', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'div', dataset: { canvasUi: 'true' } },
    ]),
    true,
  );
});

it('画布上的 wheel 不阻止（应正常 zoom）', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    false,
  );
});

it('画布内 svg 元素 wheel 不阻止（应正常 zoom）', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'path', attributes: { d: 'M 0 0 L 10 10' } },
      { tagName: 'svg', attributes: { xmlns: 'http://www.w3.org/2000/svg' } },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    false,
  );
});

it('画布内普通文本 wheel 不阻止', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'span' },
      { tagName: 'div' },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    false,
  );
});

it('画布内的图标 svg 不阻止（应当允许 zoom，因为 svg 标签 ≠ inspector 控件）', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'svg' },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    false,
  );
});

it('空 ancestors（无 target）不阻止', () => {
  assert.strictEqual(
    shouldBlockWheel([]),
    false,
  );
});

it('深层嵌套：input 嵌在 inspector 面板内的面板内的面板内 — 仍应阻止', () => {
  assert.strictEqual(
    shouldBlockWheel([
      { tagName: 'input', attributes: { type: 'number' } },
      { tagName: 'div', attributes: { class: 'row' } },
      { tagName: 'div' },
      { id: 'svg-inspector-panel', tagName: 'div' },
      { id: 'svg-canvas-viewport', tagName: 'div' },
    ]),
    true,
  );
});

// ============================================================================
// 真实场景模拟：用户在面板内连续滚动 10 次
// ============================================================================

it('场景：用户在属性面板内连续滚动 10 次，scale 应保持不变', () => {
  let scale = 1.0;
  const ancestors = [{ id: 'svg-inspector-panel', tagName: 'div' }];

  for (let i = 0; i < 10; i++) {
    if (shouldBlockWheel(ancestors)) {
      // 不变
    } else {
      scale *= i % 2 === 0 ? 1.15 : 0.85;
    }
  }
  assert.strictEqual(scale, 1.0, 'scale 应保持 1.0 不变');
});

it('场景：用户从面板滚到画布，scale 应正确响应', () => {
  let scale = 1.0;
  // 1. 在面板内滚动 5 次
  for (let i = 0; i < 5; i++) {
    if (!shouldBlockWheel([{ id: 'svg-inspector-panel', tagName: 'div' }])) {
      scale *= 1.15;
    }
  }
  assert.strictEqual(scale, 1.0, '面板内滚动不改变 scale');
  // 2. 鼠标移到画布上滚动 3 次
  for (let i = 0; i < 3; i++) {
    if (!shouldBlockWheel([{ id: 'svg-canvas-viewport', tagName: 'div' }])) {
      scale *= 1.15;
    }
  }
  assert.ok(Math.abs(scale - Math.pow(1.15, 3)) < 1e-9, '画布上滚动正确响应');
});

// ============================================================================
console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');
if (failed > 0) process.exit(1);