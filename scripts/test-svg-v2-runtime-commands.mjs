#!/usr/bin/env node
/**
 * OmniView SVG 编辑引擎 v2 — Runtime + Commands 单元测试套件
 */
import assert from 'node:assert';
import {
  createRuntime,
  createDocument,
  appendToLayer,
  appendLayer,
  makePath,
  pathGeometry,
  anchorCorner,
  vec2,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 Runtime + Commands 测试...');

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

// 准备：创建带 2 个图元的运行时
function makeRuntime() {
  const runtime = createRuntime();
  // createRuntime 初始为空 doc，需要手动塞入带默认图层的 Document
  const baseDoc = createDocument({ width: 200, height: 200 });
  const r1 = appendToLayer(baseDoc, baseDoc.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(10, 10)), anchorCorner(vec2(50, 30)), anchorCorner(vec2(30, 60))], closed: true }])));
  const r2 = appendToLayer(r1.doc, baseDoc.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(100, 100)), anchorCorner(vec2(150, 100))], closed: false }])));
  // 同步到 runtime
  runtime._doc = r2.doc;
  return runtime;
}

// ============================================================================
// 1. Runtime 基础
// ============================================================================
console.log('--- 测试 1: Runtime 基础 ---');

it('createRuntime 创建空 runtime', () => {
  const r = createRuntime();
  assert.strictEqual(r.currentDocument.layers.length, 0);
  assert.strictEqual(r.currentSelection.nodeIds.length, 0);
  assert.strictEqual(r.history.undo.length > 0, false);
  assert.strictEqual(r.history.redo.length > 0, false);
});

it('subscribe 立即触发一次', () => {
  const r = createRuntime();
  let calls = 0;
  r.subscribe(() => calls++);
  assert.ok(calls >= 1, 'subscribe 应至少调用一次');
});

// ============================================================================
// 2. 单步命令 execute 写历史
// ============================================================================
console.log('--- 测试 2: 单步命令 execute ---');

it('execute(select.set) 修改选择', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const result = r.execute('select.set', { ids: [path1], additive: false });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(r.currentSelection.primaryId, path1);
});

it('execute(paint.setColor) 写历史，可 undo', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const before = r.currentDocument;
  const result = r.execute('paint.setColor', { ids: [path1], target: 'fill', color: '#ff0000', opacity: 1 });
  assert.strictEqual(result.ok, true);
  assert.notStrictEqual(r.currentDocument, before, 'doc 应变化');
  assert.strictEqual(r.history.undo.length > 0, true, '应有 undo');
  const undoResult = r.undo();
  assert.strictEqual(undoResult, true);
  // undo 后 doc 引用应回到 before
  assert.strictEqual(r.currentDocument, before, 'undo 应回到 before 文档');
});

// ============================================================================
// 3. Action 序列（Begin / Preview / Commit）
// ============================================================================
console.log('--- 测试 3: Action 序列 ---');

it('Begin + Preview + Commit 写入 1 条 history', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const before = r.currentDocument;
  r.handleActions([
    { kind: 'Begin', label: '测试拖拽' },
    { kind: 'Preview', commandId: 'object.move', params: { ids: [path1], delta: { x: 5, y: 5 } } },
    { kind: 'Commit' },
  ]);
  assert.notStrictEqual(r.currentDocument, before);
  assert.strictEqual(r.history.undo.length, 1);
  // undo 应当回到 before
  r.undo();
  assert.strictEqual(r.currentDocument, before);
});

it('Begin + Preview*3 + Commit 最后一次生效', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const before = r.currentDocument;
  r.handleActions([
    { kind: 'Begin', label: 't' },
    { kind: 'Preview', commandId: 'object.move', params: { ids: [path1], delta: { x: 1, y: 0 } } },
    { kind: 'Preview', commandId: 'object.move', params: { ids: [path1], delta: { x: 1, y: 0 } } },
    { kind: 'Preview', commandId: 'object.move', params: { ids: [path1], delta: { x: 1, y: 0 } } },
    { kind: 'Commit' },
  ]);
  assert.strictEqual(r.history.undo.length, 1, 'preview 多次也只记 1 条 history');
  // undo 回到 before（位移是 0）
  r.undo();
  assert.strictEqual(r.currentDocument, before);
});

it('Begin + Cancel 丢弃 preview', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const before = r.currentDocument;
  r.handleActions([
    { kind: 'Begin', label: 't' },
    { kind: 'Preview', commandId: 'object.move', params: { ids: [path1], delta: { x: 100, y: 0 } } },
    { kind: 'Cancel' },
  ]);
  assert.strictEqual(r.currentDocument, before, 'cancel 应回到 before');
  assert.strictEqual(r.history.undo.length, 0, 'cancel 不写历史');
});

// ============================================================================
// 4. redo 流程
// ============================================================================
console.log('--- 测试 4: redo ---');

it('undo 后可以 redo', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const before = r.currentDocument;
  r.execute('object.move', { ids: [path1], delta: { x: 10, y: 0 } });
  const after = r.currentDocument;
  r.undo();
  assert.strictEqual(r.currentDocument, before);
  r.redo();
  assert.strictEqual(r.currentDocument, after);
});

// ============================================================================
// 5. 编组 / 解组
// ============================================================================
console.log('--- 测试 5: 编组解组 ---');

it('object.group 把 2 个 path 编为一组', () => {
  const r = makeRuntime();
  const layerId = r.currentDocument.layers[0];
  const ids = r.currentDocument.nodes.get(layerId).children;
  const result = r.execute('object.group', { ids: [...ids] });
  assert.strictEqual(result.ok, true);
  const newGroupId = result.selection.primaryId;
  assert.ok(newGroupId);
  assert.strictEqual(r.currentDocument.nodes.get(newGroupId).kind, 'Group');
});

it('object.ungroup 把组拆开', () => {
  const r = makeRuntime();
  const layerId = r.currentDocument.layers[0];
  const ids = r.currentDocument.nodes.get(layerId).children;
  const grouped = r.execute('object.group', { ids: [...ids] });
  const groupId = grouped.selection.primaryId;
  const result = r.execute('object.ungroup', { id: groupId });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(r.currentDocument.nodes.has(groupId), false, 'group 节点应被删除');
});

// ============================================================================
// 6. 删除与图层
// ============================================================================
console.log('--- 测试 6: 删除与图层 ---');

it('object.delete 写入历史并删除', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  r.execute('select.set', { ids: [path1], additive: false });
  r.execute('object.delete', { ids: [path1] });
  assert.strictEqual(r.currentDocument.nodes.has(path1), false);
  assert.strictEqual(r.history.undo.length > 0, true);
});

it('layer.add 新建图层', () => {
  const r = makeRuntime();
  const before = r.currentDocument.layers.length;
  r.execute('layer.add', {});
  assert.strictEqual(r.currentDocument.layers.length, before + 1);
});

// ============================================================================
// 7. 错误路径
// ============================================================================
console.log('--- 测试 7: 错误路径 ---');

it('execute(unknown) 返回错误', () => {
  const r = makeRuntime();
  const result = r.execute('does.not.exist', {});
  assert.strictEqual(result.ok, false);
});

it('execute(object.delete) 非法 ID 返回错误', () => {
  const r = makeRuntime();
  const result = r.execute('object.delete', { ids: [99999] });
  assert.strictEqual(result.ok, false);
});

it('execute(object.group) < 2 节点返回错误', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const result = r.execute('object.group', { ids: [path1] });
  assert.strictEqual(result.ok, false);
});

// ============================================================================
// 8. Tool dispatch
// ============================================================================
console.log('--- 测试 8: Tool dispatch ---');

it('setActiveTool + dispatchPointer 触发 select.set', () => {
  const r = makeRuntime();
  r.setActiveTool('select');
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const p1 = r.currentDocument.nodes.get(path1);
  const a0 = p1.geometry.subPaths[0].anchors[0].point;
  r.dispatchPointer({
    kind: 'down',
    point: a0,
    mods: { shift: false, alt: false, meta: false, ctrl: false, space: false },
    pressure: 1,
  });
  assert.strictEqual(r.currentSelection.primaryId, path1, '点击应在路径锚点上');
});

it('dispatchKey Delete 删除选中', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  r.dispatchPointer({
    kind: 'down',
    point: r.currentDocument.nodes.get(path1).geometry.subPaths[0].anchors[0].point,
    mods: { shift: false, alt: false, meta: false, ctrl: false, space: false },
    pressure: 1,
  });
  r.dispatchKey('Delete', { shift: false, alt: false, meta: false, ctrl: false });
  assert.strictEqual(r.currentDocument.nodes.has(path1), false);
});

// ============================================================================
// 9. exportToSvg
// ============================================================================
console.log('--- 测试 9: exportToSvg ---');

it('exportToSvg 输出含 viewBox + 图层 + 路径', async () => {
  const r = makeRuntime();
  const svg = await r.exportToSvg();
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox='));
  assert.ok(svg.includes('data-omniview-layer'));
  assert.ok(svg.includes('<path'));
});

// ============================================================================
// 10. fuzzing
// ============================================================================
console.log('--- 测试 10: 边界与 fuzzing ---');

it('连续 100 次 select.clear 不出错', () => {
  const r = makeRuntime();
  for (let i = 0; i < 100; i++) {
    r.execute('select.clear', {});
  }
  assert.strictEqual(r.currentSelection.nodeIds.length, 0);
});

it('混合命令 50 次不破坏 history', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  for (let i = 0; i < 50; i++) {
    r.execute('object.move', { ids: [path1], delta: { x: 1, y: 0 } });
    r.execute('select.set', { ids: [path1], additive: false });
  }
  assert.ok(r.history.undo.length > 0);
});

it('undo 100 步后保持 history 一致', () => {
  const r = makeRuntime();
  const path1 = r.currentDocument.nodes.get(r.currentDocument.layers[0]).children[0];
  const baseline = r.currentDocument;
  for (let i = 0; i < 100; i++) {
    r.execute('object.move', { ids: [path1], delta: { x: 1, y: 0 } });
  }
  for (let i = 0; i < 100; i++) {
    r.undo();
  }
  assert.strictEqual(r.currentDocument, baseline, 'undo 100 步后回到 baseline');
});

// ============================================================================
console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');
if (failed > 0) process.exit(1);