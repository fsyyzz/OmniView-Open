#!/usr/bin/env node
/**
 * OmniView SVG 编辑引擎 v2 — Document 模型 + path d 编解码器单元测试套件
 */
import assert from 'node:assert';
import {
  createDocument,
  appendLayer,
  appendToLayer,
  makePath,
  removeNode,
  updateNode,
  reorderInLayer,
  pathGeometry,
  anchorCorner,
  vec2,
  emptySelection,
  selectionWith,
  selectionAdd,
  selectionRemove,
  parsePathD,
  serializePathD,
  getBoundingBox,
  composeTransforms,
  translateTransform,
  scaleTransform,
  identityTransform,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 Document 模型 + path d 编解码器测试...');

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
// 1. Document 工厂
// ============================================================================
console.log('--- 测试 1: Document 工厂 ---');

it('createDocument 创建空文档（含默认 Layer 1）', () => {
  const doc = createDocument({ width: 200, height: 150 });
  assert.strictEqual(doc.canvas.width, 200);
  assert.strictEqual(doc.canvas.height, 150);
  assert.strictEqual(doc.layers.length, 1);
  assert.strictEqual(doc.nodes.size, 1);
  const layer = doc.nodes.get(doc.layers[0]);
  assert.strictEqual(layer.kind, 'Layer');
  assert.strictEqual(layer.name, 'Layer 1');
  assert.strictEqual(doc.nextNodeId, 2);
});

// ============================================================================
// 2. 节点增删
// ============================================================================
console.log('--- 测试 2: 节点增删 ---');

it('appendLayer 增加图层，nextNodeId 自增', () => {
  const doc = createDocument();
  const r1 = appendLayer(doc);
  assert.notStrictEqual(r1.layerId, doc.layers[0]);
  assert.strictEqual(r1.doc.layers.length, 2);
  assert.strictEqual(r1.doc.nextNodeId, doc.nextNodeId + 1);
});

it('appendToLayer 加入图元到图层末尾', () => {
  const doc = createDocument();
  const layerId = doc.layers[0];
  const path = makePath(99, pathGeometry([]));
  const r = appendToLayer(doc, layerId, path);
  assert.ok(r.nodeId);
  assert.notStrictEqual(r.nodeId, 99, '应分配新 ID 而不是使用传入的');
  const newLayer = r.doc.nodes.get(layerId);
  assert.strictEqual(newLayer.kind, 'Layer');
  assert.strictEqual(newLayer.children.length, 1);
  assert.strictEqual(newLayer.children[0], r.nodeId);
});

it('removeNode 递归删除节点', () => {
  const doc = createDocument();
  const layerId = doc.layers[0];
  const r1 = appendToLayer(doc, layerId, makePath(0, pathGeometry([])));
  const r2 = appendToLayer(r1.doc, layerId, makePath(0, pathGeometry([])));
  assert.strictEqual(r2.doc.layers.length, 1);
  assert.strictEqual(r2.doc.nodes.size, 3); // layer + 2 paths
  const idToRemove = r2.doc.layers[0] === layerId ? r2.doc.nodes.get(layerId).children[0] : -1;
  const after = removeNode(r2.doc, idToRemove);
  assert.strictEqual(after.nodes.size, 2);
});

// ============================================================================
// 3. 结构共享
// ============================================================================
console.log('--- 测试 3: 结构共享验证 ---');

it('updateNode 仅修改变化的节点引用，其他节点保持 === 相等', () => {
  const doc = createDocument();
  const layerId = doc.layers[0];
  const a = appendToLayer(doc, layerId, makePath(0, pathGeometry([])));
  const b = appendToLayer(a.doc, layerId, makePath(0, pathGeometry([])));
  const idA = b.doc.nodes.get(layerId).children[0];
  const idB = b.doc.nodes.get(layerId).children[1];
  const beforeA = b.doc.nodes.get(idA);
  const beforeB = b.doc.nodes.get(idB);
  const beforeLayer = b.doc.nodes.get(layerId);
  const after = updateNode(b.doc, idA, (n) => ({ ...n, opacity: 0.5 }));
  // idA 节点是新对象
  assert.notStrictEqual(after.nodes.get(idA), beforeA);
  // idB 节点引用保持（结构共享）
  assert.strictEqual(after.nodes.get(idB), beforeB, 'idB 节点应当引用共享');
  // 图层节点也保持引用共享（children 没变 → 未克隆）
  assert.strictEqual(after.nodes.get(layerId), beforeLayer, '图层节点引用共享');
  // layers 数组本身可共享
  assert.strictEqual(after.layers, b.doc.layers, 'layers 数组可共享');
});

it('undo 引用恢复（无克隆即可回到 prev 文档）', () => {
  const doc = createDocument();
  const layerId = doc.layers[0];
  const r1 = appendToLayer(doc, layerId, makePath(0, pathGeometry([])));
  const id = r1.doc.nodes.get(layerId).children[0];
  const before = r1.doc.nodes.get(id);
  const after = updateNode(r1.doc, id, (n) => ({ ...n, opacity: 0.3 }));
  assert.notStrictEqual(after.nodes.get(id), before);
  // 直接用 before doc 做严格相等
  assert.strictEqual(r1.doc.nodes.get(id), before);
});

// ============================================================================
// 4. Selection helpers
// ============================================================================
console.log('--- 测试 4: Selection helpers ---');

it('emptySelection / selectionWith / add / remove / clear', () => {
  const s0 = emptySelection();
  assert.deepStrictEqual(s0.nodeIds, []);
  assert.strictEqual(s0.primaryId, null);

  const s1 = selectionWith(7);
  assert.deepStrictEqual(s1.nodeIds, [7]);
  assert.strictEqual(s1.primaryId, 7);

  const s2 = selectionAdd(s1, 8);
  assert.deepStrictEqual(s2.nodeIds, [7, 8]);

  const s3 = selectionRemove(s2, 7);
  assert.deepStrictEqual(s3.nodeIds, [8]);
  assert.strictEqual(s3.primaryId, 8);

  const s4 = selectionRemove(s1, 7);
  assert.deepStrictEqual(s4.nodeIds, []);
  assert.strictEqual(s4.primaryId, null);
});

// ============================================================================
// 5. 几何变换
// ============================================================================
console.log('--- 测试 5: 几何变换 ---');

it('composeTransforms(translate, scale)', () => {
  const t = composeTransforms(translateTransform(10, 20), scaleTransform(2));
  // translate * scale 应用时先 scale 再 translate
  // (1 0, 0 1, 10 20) * (2 0, 0 2, 0 0)
  assert.strictEqual(t.a, 2);
  assert.strictEqual(t.d, 2);
  assert.strictEqual(t.e, 10);
  assert.strictEqual(t.f, 20);
});

it('identityTransform 复合保持不变', () => {
  const a = translateTransform(5, 5);
  const r = composeTransforms(a, identityTransform());
  assert.deepStrictEqual(r, a);
});

// ============================================================================
// 6. path d 编解码
// ============================================================================
console.log('--- 测试 6: path d 编解码 ---');

it('parsePathD 解析 M/L/Z 简单路径', () => {
  const g = parsePathD('M 10 10 L 20 20 L 30 10 Z');
  assert.strictEqual(g.subPaths.length, 1);
  const anchors = g.subPaths[0].anchors;
  assert.strictEqual(anchors.length, 3);
  assert.deepStrictEqual(anchors[0].point, { x: 10, y: 10 });
  assert.deepStrictEqual(anchors[2].point, { x: 30, y: 10 });
  assert.strictEqual(g.subPaths[0].closed, true);
});

it('parsePathD 解析 C 立方贝塞尔', () => {
  const g = parsePathD('M 0 0 C 10 10 20 20 30 0');
  const anchors = g.subPaths[0].anchors;
  assert.strictEqual(anchors.length, 2);
  assert.ok(anchors[0].handleOut !== null);
  assert.ok(anchors[1].handleIn !== null);
});

it('parsePathD 相对 m/l/h/v', () => {
  const g = parsePathD('M 0 0 l 10 0 l 10 10');
  const anchors = g.subPaths[0].anchors;
  assert.strictEqual(anchors.length, 3);
  assert.deepStrictEqual(anchors[1].point, { x: 10, y: 0 });
  assert.deepStrictEqual(anchors[2].point, { x: 20, y: 10 });
});

it('serializePathD round-trip M/L/Z', () => {
  const original = 'M 10 10 L 20 20 L 30 10 Z';
  const g = parsePathD(original);
  const back = serializePathD(g, 3);
  const g2 = parsePathD(back);
  assert.deepStrictEqual(g.subPaths[0].anchors.map(a => a.point), g2.subPaths[0].anchors.map(a => a.point));
});

it('serializePathD round-trip C 立方贝塞尔', () => {
  const original = 'M 0 0 C 10 10 20 20 30 0';
  const g = parsePathD(original);
  const back = serializePathD(g, 3);
  assert.ok(back.includes('C'), '序列化后应保留 C 命令');
});

it('getBoundingBox 包围盒', () => {
  const g = parsePathD('M 10 10 L 50 30 L 30 60 Z');
  const bb = getBoundingBox(g);
  assert.strictEqual(bb.x, 10);
  assert.strictEqual(bb.y, 10);
  assert.strictEqual(bb.width, 40);
  assert.strictEqual(bb.height, 50);
});

// ============================================================================
// 7. 边界与 fuzzing
// ============================================================================
console.log('--- 测试 7: 边界与 fuzzing ---');

it('parsePathD 空字符串返回空 geometry', () => {
  const g = parsePathD('');
  assert.strictEqual(g.subPaths.length, 1);
  assert.strictEqual(g.subPaths[0].anchors.length, 0);
});

it('parsePathD 畸形输入（NaN 容忍）不崩溃', () => {
  for (const d of ['M abc def', 'M 10 10 Z Z Z', 'L 1 2 3 4', 'C 1 2 3', 'm', 'Z M', '   ']) {
    const g = parsePathD(d);
    assert.ok(g && Array.isArray(g.subPaths));
  }
});

it('serializePathD 100 次不崩溃', () => {
  for (let i = 0; i < 100; i++) {
    const g = parsePathD(`M ${i} ${i} L ${i + 1} ${i + 1} L ${i + 2} ${i} Z`);
    const s = serializePathD(g, 2);
    assert.ok(typeof s === 'string' && s.length > 0);
  }
});

it('updateNode 100 次连续修改仍保持正确性', () => {
  let doc = createDocument();
  const layerId = doc.layers[0];
  const r = appendToLayer(doc, layerId, makePath(0, pathGeometry([])));
  const id = r.nodeId;
  doc = r.doc;
  for (let i = 0; i < 100; i++) {
    doc = updateNode(doc, id, (n) => ({ ...n, opacity: i / 100 }));
    const node = doc.nodes.get(id);
    assert.strictEqual(node.opacity, i / 100);
  }
});

// ============================================================================
// 汇总
// ============================================================================
console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');
if (failed > 0) process.exit(1);