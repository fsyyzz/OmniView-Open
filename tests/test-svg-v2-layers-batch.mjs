#!/usr/bin/env node
/**
 * OmniView SVG v2 — 图层与批量增强测试套件 (L2)
 *
 * 覆盖：
 * 1. 几何纯函数：transformRect / nodeBBox / alignDelta / distributeOffsets
 * 2. 新命令：object.align（selection/canvas 基准）、object.distribute、object.setVisible/setLocked
 * 3. 重排扩展：layer.reorder(toIndex) / object.reorder(toIndex)
 * 4. 图层树：flattenLayerTree（展开/折叠/深度）
 * 5. 拖拽推导纯函数：planReorderDrop（拖拽排序准入测试）
 */
import assert from 'node:assert';
import {
  createRuntime,
  createDocument,
  appendToLayer,
  makePath,
  pathGeometry,
  anchorCorner,
  vec2,
  nodeBBox,
  transformRect,
  alignDelta,
  distributeOffsets,
  flattenLayerTree,
  findParent,
  planReorderDrop,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 图层与批量增强测试...');

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

const rect = (x, y, width, height) => ({ x, y, width, height });

/** 造一个 200x200 文档，返回 { doc, ids }（ids 为依次追加的图元）。 */
function makeDoc(specs = []) {
  let doc = createDocument({ width: 200, height: 200 });
  const ids = [];
  for (const spec of specs) {
    const r = appendToLayer(
      doc,
      doc.layers[0],
      makePath(
        0,
        pathGeometry([{ anchors: spec.points.map(([x, y]) => anchorCorner(vec2(x, y))), closed: spec.closed ?? false }]),
      ),
    );
    doc = r.doc;
    ids.push(r.nodeId);
  }
  return { doc, ids };
}

function makeRuntimeWith(specs) {
  const { doc, ids } = makeDoc(specs);
  const runtime = createRuntime();
  runtime._doc = doc;
  return { runtime, ids };
}

// ============================================================================
// 1. 几何纯函数
// ============================================================================
console.log('--- 测试 1: 几何纯函数 ---');

it('transformRect 平移', () => {
  const r = transformRect({ a: 1, b: 0, c: 0, d: 1, e: 5, f: -3 }, rect(10, 10, 20, 20));
  assert.deepStrictEqual(r, rect(15, 7, 20, 20));
});

it('transformRect 旋转 90° 取 AABB', () => {
  // 90° 旋转矩阵: a=0,b=1,c=-1,d=0
  const r = transformRect({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 }, rect(0, 0, 10, 4));
  assert.ok(Math.abs(r.width - 4) < 1e-9, `width=${r.width}`);
  assert.ok(Math.abs(r.height - 10) < 1e-9, `height=${r.height}`);
});

it('nodeBBox path 无变换', () => {
  const { doc, ids } = makeDoc([{ points: [[10, 20], [50, 60]] }]);
  const bb = nodeBBox(doc, ids[0]);
  assert.deepStrictEqual(bb, rect(10, 20, 40, 40));
});

it('nodeBBox 含平移变换', () => {
  const { doc: base, ids } = makeDoc([{ points: [[0, 0], [10, 10]] }]);
  // 手动加平移
  const nodes = new Map(base.nodes);
  const n = nodes.get(ids[0]);
  nodes.set(ids[0], { ...n, transform: { a: 1, b: 0, c: 0, d: 1, e: 100, f: 50 } });
  const doc = { ...base, nodes };
  const bb = nodeBBox(doc, ids[0]);
  assert.deepStrictEqual(bb, rect(100, 50, 10, 10));
});

it('alignDelta 六模式', () => {
  const target = rect(0, 0, 100, 100);
  const r = rect(10, 20, 30, 40); // cx=25, cy=40
  assert.deepStrictEqual(alignDelta(r, target, 'left'), { x: -10, y: 0 });
  assert.deepStrictEqual(alignDelta(r, target, 'right'), { x: 60, y: 0 });
  assert.deepStrictEqual(alignDelta(r, target, 'top'), { x: 0, y: -20 });
  assert.deepStrictEqual(alignDelta(r, target, 'bottom'), { x: 0, y: 40 });
  assert.deepStrictEqual(alignDelta(r, target, 'centerH'), { x: 25, y: 0 }); // 50 - 25
  assert.deepStrictEqual(alignDelta(r, target, 'centerV'), { x: 0, y: 10 }); // 50 - 40
});

it('distributeOffsets 首尾不动中间等距', () => {
  const offsets = distributeOffsets([0, 40, 100]);
  assert.strictEqual(offsets[0], 0);
  assert.ok(Math.abs(offsets[1] - 10) < 1e-9, `mid offset=${offsets[1]}`);
  assert.strictEqual(offsets[2], 0);
});

it('distributeOffsets < 3 全 0', () => {
  assert.deepStrictEqual(distributeOffsets([5, 50]), [0, 0]);
});

it('distributeOffsets 乱序输入按值排序', () => {
  // 输入 [100, 0, 40]：头=0(idx1)、尾=100(idx0)、中=40(idx2) → 40 应移到 50
  const offsets = distributeOffsets([100, 0, 40]);
  assert.strictEqual(offsets[0], 0); // 尾不动
  assert.strictEqual(offsets[1], 0); // 头不动
  assert.ok(Math.abs(offsets[2] - 10) < 1e-9, `mid=${offsets[2]}`);
});

// ============================================================================
// 2. object.align 命令
// ============================================================================
console.log('--- 测试 2: object.align ---');

it('align(selection, left)：两图元左缘对齐到选区最左', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[10, 10], [50, 10]] },
    { points: [[30, 30], [60, 30]] },
  ]);
  const result = runtime.execute('object.align', { ids, align: 'left' });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const bb1 = nodeBBox(runtime.currentDocument, ids[0]);
  const bb2 = nodeBBox(runtime.currentDocument, ids[1]);
  assert.ok(Math.abs(bb1.x - bb2.x) < 1e-9, `bb1.x=${bb1.x} bb2.x=${bb2.x}`);
});

it('align(selection, centerH)：两图元水平中心重合', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [40, 0]] },
    { points: [[100, 50], [120, 50]] },
  ]);
  runtime.execute('object.align', { ids, align: 'centerH' });
  const bb1 = nodeBBox(runtime.currentDocument, ids[0]);
  const bb2 = nodeBBox(runtime.currentDocument, ids[1]);
  const c1 = bb1.x + bb1.width / 2;
  const c2 = bb2.x + bb2.width / 2;
  assert.ok(Math.abs(c1 - c2) < 1e-9, `c1=${c1} c2=${c2}`);
});

it('align(canvas, right)：图元右缘贴画布右缘', () => {
  const { runtime, ids } = makeRuntimeWith([{ points: [[0, 0], [40, 0]] }]);
  runtime.execute('object.align', { ids, align: 'right', relative: 'canvas' });
  const bb = nodeBBox(runtime.currentDocument, ids[0]);
  assert.ok(Math.abs(bb.x + bb.width - 200) < 1e-9, `right=${bb.x + bb.width}`);
});

it('align 单选 + selection 基准 → 报错', () => {
  const { runtime, ids } = makeRuntimeWith([{ points: [[0, 0], [10, 0]] }]);
  const result = runtime.execute('object.align', { ids, align: 'left' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.kind, 'bad-params');
});

it('align 写入历史可撤销', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[10, 10], [50, 10]] },
    { points: [[30, 30], [60, 30]] },
  ]);
  runtime.execute('object.align', { ids, align: 'left' });
  const afterAlign = nodeBBox(runtime.currentDocument, ids[1]);
  runtime.undo();
  const afterUndo = nodeBBox(runtime.currentDocument, ids[1]);
  assert.ok(Math.abs(afterAlign.x - afterUndo.x) > 1, 'undo 后 x 应恢复');
});

// ============================================================================
// 3. object.distribute 命令
// ============================================================================
console.log('--- 测试 3: object.distribute ---');

it('distribute(h)：中间图元等距', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [1, 0]] },
    { points: [[40, 50], [41, 50]] },
    { points: [[100, 100], [101, 100]] },
  ]);
  const result = runtime.execute('object.distribute', { ids, axis: 'h' });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const bbs = ids.map((id) => nodeBBox(runtime.currentDocument, id));
  const centers = bbs.map((b) => b.x + b.width / 2);
  const gap1 = centers[1] - centers[0];
  const gap2 = centers[2] - centers[1];
  assert.ok(Math.abs(gap1 - gap2) < 1e-6, `gap1=${gap1} gap2=${gap2}`);
});

it('distribute(v)：垂直方向等距', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [1, 0]] },
    { points: [[0, 20], [1, 20]] },
    { points: [[0, 90], [1, 90]] },
  ]);
  runtime.execute('object.distribute', { ids, axis: 'v' });
  const bbs = ids.map((id) => nodeBBox(runtime.currentDocument, id));
  const centers = bbs.map((b) => b.y + b.height / 2);
  assert.ok(Math.abs(centers[1] - centers[0] - (centers[2] - centers[1])) < 1e-6);
});

it('distribute < 3 → 报错', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [1, 0]] },
    { points: [[40, 0], [41, 0]] },
  ]);
  const result = runtime.execute('object.distribute', { ids, axis: 'h' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.kind, 'bad-params');
});

// ============================================================================
// 4. object.setVisible / object.setLocked
// ============================================================================
console.log('--- 测试 4: object.setVisible / object.setLocked ---');

it('setVisible(false) 隐藏图元', () => {
  const { runtime, ids } = makeRuntimeWith([{ points: [[0, 0], [10, 0]] }]);
  const r = runtime.execute('object.setVisible', { ids, visible: false });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(runtime.currentDocument.nodes.get(ids[0]).visible, false);
  runtime.undo();
  assert.strictEqual(runtime.currentDocument.nodes.get(ids[0]).visible, true);
});

it('setLocked(true) 锁定图元', () => {
  const { runtime, ids } = makeRuntimeWith([{ points: [[0, 0], [10, 0]] }]);
  runtime.execute('object.setLocked', { ids, locked: true });
  assert.strictEqual(runtime.currentDocument.nodes.get(ids[0]).locked, true);
});

// ============================================================================
// 5. 图层树 flattenLayerTree
// ============================================================================
console.log('--- 测试 5: 图层树 ---');

it('flattenLayerTree 默认展开嵌套（layer > group > path）', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [10, 0]] },
    { points: [[20, 0], [30, 0]] },
  ]);
  const r = runtime.execute('object.group', { ids, name: 'G1' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const rows = flattenLayerTree(runtime.currentDocument);
  assert.strictEqual(rows[0].kind, 'Layer');
  assert.strictEqual(rows[0].depth, 0);
  assert.strictEqual(rows[0].expanded, true);
  assert.strictEqual(rows[1].kind, 'Group');
  assert.strictEqual(rows[1].depth, 1);
  assert.strictEqual(rows[1].name, 'G1');
  assert.strictEqual(rows[2].depth, 2);
  assert.strictEqual(rows[3].depth, 2);
  assert.strictEqual(rows.length, 4);
});

it('flattenLayerTree 折叠后子行消失', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [10, 0]] },
    { points: [[20, 0], [30, 0]] },
  ]);
  runtime.execute('object.group', { ids });
  const groupId = [...runtime.currentDocument.nodes.values()].find((n) => n.kind === 'Group').id;
  const rows = flattenLayerTree(runtime.currentDocument, new Set([groupId]));
  assert.strictEqual(rows.length, 2, `rows=${rows.length}`);
  assert.strictEqual(rows[1].expanded, false);
});

it('findParent：Group 内节点的直接父是 Group', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [10, 0]] },
    { points: [[20, 0], [30, 0]] },
  ]);
  runtime.execute('object.group', { ids });
  const doc = runtime.currentDocument;
  const groupId = [...doc.nodes.values()].find((n) => n.kind === 'Group').id;
  assert.strictEqual(findParent(doc, ids[0]), groupId);
  assert.strictEqual(findParent(doc, groupId), doc.layers[0]);
  assert.strictEqual(findParent(doc, doc.layers[0]), null);
});

// ============================================================================
// 6. 拖拽推导纯函数 planReorderDrop（准入测试）
// ============================================================================
console.log('--- 测试 6: 拖拽重排推导 ---');

it('planReorderDrop: 层 A 拖到层 C 之前 → toIndex 正确', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 100, height: 100 });
  runtime.execute('layer.add', { name: 'L2' });
  runtime.execute('layer.add', { name: 'L3' });
  const doc = runtime.currentDocument;
  assert.strictEqual(doc.layers.length, 3);
  const [L1, L2, L3] = doc.layers;
  const plan = planReorderDrop(doc, { kind: 'layer', id: L1 }, { kind: 'layer', id: L3, position: 'before' });
  assert.ok(plan, 'plan 不应为 null');
  assert.strictEqual(plan.command, 'layer.reorder');
  assert.strictEqual(plan.toIndex, 1); // [L2, L3] 中 L3 前 → 1
  void L2;
});

it('planReorderDrop: 层 A 拖到层 C 之后 → toIndex 正确', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 100, height: 100 });
  runtime.execute('layer.add', { name: 'L2' });
  runtime.execute('layer.add', { name: 'L3' });
  const doc = runtime.currentDocument;
  const [L1, , L3] = doc.layers;
  const plan = planReorderDrop(doc, { kind: 'layer', id: L1 }, { kind: 'layer', id: L3, position: 'after' });
  assert.strictEqual(plan.toIndex, 2); // [L2, L3] 末尾 → 2
});

it('planReorderDrop + layer.reorder(toIndex) 端到端：L1 移到 L3 后', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 100, height: 100 });
  runtime.execute('layer.add', { name: 'L2' });
  runtime.execute('layer.add', { name: 'L3' });
  const doc = runtime.currentDocument;
  const [L1, L2, L3] = doc.layers;
  const plan = planReorderDrop(doc, { kind: 'layer', id: L1 }, { kind: 'layer', id: L3, position: 'after' });
  const r = runtime.execute(plan.command, { id: plan.id, toIndex: plan.toIndex });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(runtime.currentDocument.layers, [L2, L3, L1]);
  runtime.undo();
  assert.deepStrictEqual(runtime.currentDocument.layers, [L1, L2, L3]);
});

it('planReorderDrop: 图元同层拖拽 → object.reorder + 端到端', () => {
  const { runtime, ids } = makeRuntimeWith([
    { points: [[0, 0], [10, 0]] },
    { points: [[20, 0], [30, 0]] },
    { points: [[40, 0], [50, 0]] },
  ]);
  const doc = runtime.currentDocument;
  const layerId = doc.layers[0];
  const children = doc.nodes.get(layerId).children;
  assert.deepStrictEqual([...children], ids);
  // P1 拖到 P3 之后
  const plan = planReorderDrop(doc, { kind: 'node', id: ids[0] }, { kind: 'node', id: ids[2], position: 'after' });
  assert.ok(plan, 'plan 不应为 null');
  assert.strictEqual(plan.command, 'object.reorder');
  const r = runtime.execute(plan.command, { id: plan.id, toIndex: plan.toIndex });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual([...runtime.currentDocument.nodes.get(layerId).children], [ids[1], ids[2], ids[0]]);
  runtime.undo();
  assert.deepStrictEqual([...runtime.currentDocument.nodes.get(layerId).children], ids);
});

it('planReorderDrop: 同 id / 跨层 / 类型不匹配 → null', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 100, height: 100 });
  runtime.execute('layer.add', { name: 'L2' });
  const doc = runtime.currentDocument;
  const [L1, L2] = doc.layers;
  assert.strictEqual(planReorderDrop(doc, { kind: 'layer', id: L1 }, { kind: 'layer', id: L1, position: 'after' }), null);
  assert.strictEqual(planReorderDrop(doc, { kind: 'layer', id: L1 }, { kind: 'node', id: L1, position: 'after' }), null);
  assert.strictEqual(planReorderDrop(doc, { kind: 'node', id: L1 }, { kind: 'layer', id: L2, position: 'before' }), null);
  void L2;
});

it('planReorderDrop: 图元跨层拖拽 → null（P1 边界）', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 100, height: 100 });
  runtime.execute('layer.add', { name: 'L2' });
  // L1 放一个图元
  const base = runtime.currentDocument;
  const r = appendToLayer(base, base.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(0, 0))], closed: false }])));
  runtime._doc = r.doc;
  const doc = runtime.currentDocument;
  const [L1, L2] = doc.layers;
  const plan = planReorderDrop(doc, { kind: 'node', id: r.nodeId }, { kind: 'layer', id: L2, position: 'after' });
  assert.strictEqual(plan, null);
  void L1;
});

// ============================================================================
console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');
if (failed > 0) process.exit(1);
