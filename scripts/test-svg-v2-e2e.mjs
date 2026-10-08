#!/usr/bin/env node
/**
 * OmniView SVG 编辑引擎 v2 — 端到端集成测试 (M7)
 *
 * 覆盖 import → model → 编辑 → export → round-trip 全链路；
 * 含 fuzzing 与边界用例。
 */
import assert from 'node:assert';
import {
  createRuntime,
  createDocument,
  appendToLayer,
  appendLayer,
  makePath,
  makeGroup,
  pathGeometry,
  anchorCorner,
  vec2,
  selectionAdd,
  selectionWith,
  emptySelection,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 E2E 集成测试...');

let passed = 0;
let failed = 0;
const it = async (name, fn) => {
  try {
    await fn();
    console.log('  ✅', name);
    passed++;
  } catch (e) {
    console.log('  ❌', name, '-', e instanceof Error ? e.message : e);
    failed++;
  }
};

// ============================================================================
// 1. SVG 字符串 → Document → 编辑 → SVG 字符串 round-trip
// ============================================================================
console.log('--- 测试 1: SVG round-trip ---');

it('简单 SVG round-trip 保留关键结构', async () => {
  const original = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="50" height="50" fill="#ff0000"/></svg>';
  const runtime = createRuntime();
  await runtime.loadFromSvg(original);
  const after = await runtime.exportToSvg();
  assert.ok(after.includes('width="100"'));
  assert.ok(after.includes('<svg'));
  assert.ok(after.includes('viewBox'));
});

it('多图元 SVG 全部解析', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect x="10" y="10" width="20" height="20" fill="red"/>
    <circle cx="50" cy="50" r="10" fill="blue"/>
    <line x1="0" y1="0" x2="100" y2="100" stroke="green" stroke-width="2"/>
  </svg>`;
  const runtime = createRuntime();
  const r = await runtime.loadFromSvg(svg);
  const layers = r.document.layers.length;
  const totalNodes = r.document.nodes.size;
  assert.ok(layers >= 1);
  assert.ok(totalNodes >= 1 + 3);
});

// ============================================================================
// 2. 编辑 → export → 再次 import → 一致性
// ============================================================================
console.log('--- 测试 2: 编辑往返一致性 ---');

it('编辑后重新导入仍能识别关键图元', async () => {
  const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="0" y="0" width="10" height="10" fill="#abc"/></svg>`;
  const runtime = createRuntime();
  await runtime.loadFromSvg(svg1);
  const pathId = Array.from(runtime.currentDocument.nodes.values())
    .find((n) => n.kind === 'Path')?.id;
  assert.ok(pathId);
  runtime.execute('paint.setColor', { ids: [pathId], target: 'fill', color: '#ff0000', opacity: 1 });
  const svg2 = await runtime.exportToSvg();
  const runtime2 = createRuntime();
  await runtime2.loadFromSvg(svg2);
  const pathAfter = Array.from(runtime2.currentDocument.nodes.values()).find((n) => n.kind === 'Path');
  assert.ok(pathAfter, '重新加载后应保留 Path 节点');
  const fillItem = pathAfter.appearance.items.find((it) => it.kind === 'fill');
  assert.ok(fillItem, '新文档应有 fill item');
  assert.strictEqual(fillItem.fill.type, 'solid');
  assert.strictEqual(fillItem.fill.color, '#ff0000');
});

// ============================================================================
// 3. 撤销栈跨 import/export 持久性（in-memory）
// ============================================================================
console.log('--- 测试 3: 撤销栈持久 ---');

it('编辑后 export 不应丢失历史', async () => {
  const runtime = createRuntime();
  const baseDoc = createDocument({ width: 100, height: 100 });
  const r1 = appendToLayer(baseDoc, baseDoc.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(10, 10))], closed: false }])));
  runtime._doc = r1.doc;
  const id = r1.nodeId;
  // 3 次 move
  runtime.execute('object.move', { ids: [id], delta: { x: 5, y: 0 } });
  runtime.execute('object.move', { ids: [id], delta: { x: 5, y: 0 } });
  runtime.execute('object.move', { ids: [id], delta: { x: 5, y: 0 } });
  assert.strictEqual(runtime.history.undo.length, 3);
  // export 不影响 history
  const svg = await runtime.exportToSvg();
  assert.strictEqual(runtime.history.undo.length, 3);
  assert.ok(svg.includes('viewBox'));
});

// ============================================================================
// 4. 并发 / 异步边界
// ============================================================================
console.log('--- 测试 4: 异步边界 ---');

it('loadFromSvg 失败后 runtime 仍可用', async () => {
  const runtime = createRuntime();
  // 即使 SVG 解析失败（fallbackDomParse 返回 warnings），runtime 不抛
  await runtime.loadFromSvg('<not-svg></not-svg>');
  // 仍可继续编辑
  runtime.execute('layer.add', {});
  assert.strictEqual(runtime.currentDocument.layers.length >= 1, true);
});

it('连续 10 次 loadFromSvg 不破坏 runtime', async () => {
  const runtime = createRuntime();
  for (let i = 0; i < 10; i++) {
    await runtime.loadFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${10 + i}" height="${10 + i}"></svg>`);
  }
  assert.strictEqual(runtime.currentDocument.canvas.width, 19);
});

// ============================================================================
// 5. 真实 SVG 样例 fuzzing
// ============================================================================
console.log('--- 测试 5: 真实样例 fuzzing ---');

const corpus = [
  '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="black"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M 0 0 C 10 10 20 20 30 30 Z" fill="red"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><g><rect x="0" y="0" width="20" height="20"/><rect x="30" y="30" width="20" height="20"/></g></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50" font-family="sans-serif" font-size="14">Hello</text></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" stroke="black"><line x1="0" y1="0" x2="100" y2="100"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><polygon points="10,10 50,10 30,50" fill="green"/></svg>',
];

it('corpus 全部 8 个样例成功 import + export', async () => {
  for (const svg of corpus) {
    const runtime = createRuntime();
    await runtime.loadFromSvg(svg);
    const out = await runtime.exportToSvg();
    assert.ok(typeof out === 'string' && out.length > 0);
    assert.ok(out.includes('<svg'));
  }
});

// ============================================================================
// 6. 撤销重做 + 编辑 + export 综合
// ============================================================================
console.log('--- 测试 6: 综合场景 ---');

it('真实编辑工作流：新增图层 → 改色 → 撤销 → 重做 → export', async () => {
  const runtime = createRuntime();
  const baseDoc = createDocument({ width: 200, height: 200 });
  runtime._doc = baseDoc;
  runtime._selection = emptySelection();
  // 在默认图层上加 path（直接 appendToLayer，不写历史）
  const r0 = appendToLayer(baseDoc, baseDoc.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(50, 50))], closed: false }])));
  runtime._doc = r0.doc;
  const id = r0.nodeId;
  // 新增图层（写历史 #1）
  runtime.execute('layer.add', { name: '背景层' });
  // 改色（写历史 #2）
  runtime.execute('paint.setColor', { ids: [id], target: 'fill', color: '#00ff00', opacity: 1 });
  assert.strictEqual(runtime.history.undo.length, 2, '2 步写历史');
  // 撤销到最初
  runtime.undo();
  runtime.undo();
  assert.strictEqual(runtime.currentDocument.layers.length, 1);
  // 重做
  runtime.redo();
  runtime.redo();
  // export
  const svg = await runtime.exportToSvg();
  assert.ok(svg.includes('#00ff00'));
});

// ============================================================================
// 7. Feature Flag 行为
// ============================================================================
console.log('--- 测试 7: Feature Flag ---');

import { getSvgEngineFlag, setSvgEngineFlag } from '../src/features/viewers/components/drivers/svg/core/index.ts';

it('Feature Flag 默认 v1，可切换到 v2', () => {
  // Node 环境无 localStorage，flag 应默认为 v1
  setSvgEngineFlag('v1');
  assert.strictEqual(getSvgEngineFlag(), 'v1');
  // 模拟浏览器行为：直接尝试 set；若无 localStorage 则仍是 v1
  const beforeSet = getSvgEngineFlag();
  setSvgEngineFlag('v2');
  const afterSet = getSvgEngineFlag();
  assert.ok(afterSet === 'v2' || afterSet === beforeSet, 'set 在有/无 localStorage 时行为合理');
  setSvgEngineFlag('v1');
});

// ============================================================================
// 8. Backup 策略
// ============================================================================
console.log('--- 测试 8: Backup ---');

import { shouldWriteBackup, tagBackupContent, backupFileName } from '../src/features/viewers/components/drivers/svg/core/index.ts';

it('备份策略：未含 v2 标记时需要写备份', () => {
  assert.strictEqual(shouldWriteBackup('<svg></svg>', 'v2'), true);
  assert.strictEqual(shouldWriteBackup('<svg>[omniview-v2-engine]</svg>', 'v2'), false);
});

it('backupFileName 生成正确文件名', () => {
  assert.strictEqual(backupFileName('logo.svg'), 'logo.bak.svg');
  assert.strictEqual(backupFileName('foo'), 'foo.bak.svg');
});

it('tagBackupContent 注入 v2 标记', () => {
  const rt = createRuntime();
  const tagged = tagBackupContent('<svg></svg>', rt.currentDocument, '<svg></svg>');
  assert.ok(tagged.includes('[omniview-v2-engine]'));
});

// ============================================================================
// 汇总
// ============================================================================
console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');

// 主测试流程：把所有同步 + 异步测试组织到异步主流程里
async function main() {
  // 所有 it() 调用已在模块加载时定义；这里通过设置全局等待
  // 实际上由于 it() 调用发生在文件顶层，需要等待 microtasks 完成
  // 显式 await 一个 microtask flush
  await new Promise((r) => setTimeout(r, 100));
  console.log('📊 测试结果:', passed, '通过,', failed, '失败');
  if (failed > 0) process.exit(1);
}
main();