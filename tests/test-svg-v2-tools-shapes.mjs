#!/usr/bin/env node
/**
 * OmniView SVG 编辑引擎 v2 — 工具箱、基础形状与文本编辑单元测试
 */
import assert from 'node:assert';
import {
  createRuntime,
  createDocument,
  createRectGeometry,
  createEllipseGeometry,
  createLineGeometry,
  tools,
  vec2,
  pathGeometry,
  anchorCorner,
  makePath,
  appendToLayer,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 工具箱、基础形状与文本编辑单元测试...');

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
// 1. 几何形状生成器 (Rect / Ellipse / Line)
// ============================================================================
console.log('--- 测试 1: 几何形状生成器 ---');

it('createRectGeometry 生成四点封闭矩形子路径', () => {
  const g = createRectGeometry(10, 20, 100, 50);
  assert.strictEqual(g.subPaths.length, 1);
  const sp = g.subPaths[0];
  assert.strictEqual(sp.closed, true);
  assert.strictEqual(sp.anchors.length, 4);
  assert.deepStrictEqual(sp.anchors[0].point, { x: 10, y: 20 });
  assert.deepStrictEqual(sp.anchors[1].point, { x: 110, y: 20 });
  assert.deepStrictEqual(sp.anchors[2].point, { x: 110, y: 70 });
  assert.deepStrictEqual(sp.anchors[3].point, { x: 10, y: 70 });
});

it('createEllipseGeometry 生成四点平滑三次贝塞尔封闭椭圆', () => {
  const g = createEllipseGeometry(100, 100, 50, 30);
  assert.strictEqual(g.subPaths.length, 1);
  const sp = g.subPaths[0];
  assert.strictEqual(sp.closed, true);
  assert.strictEqual(sp.anchors.length, 4);
  // 4 个锚点均带有贝塞尔控制点
  assert.strictEqual(sp.anchors[0].point.x, 100);
  assert.strictEqual(sp.anchors[0].point.y, 70);
  assert.ok(sp.anchors[0].handleIn !== null && sp.anchors[0].handleOut !== null);
  assert.strictEqual(sp.anchors[1].point.x, 150);
  assert.strictEqual(sp.anchors[1].point.y, 100);
});

it('createLineGeometry 生成两点开放直线', () => {
  const g = createLineGeometry(0, 0, 80, 60);
  assert.strictEqual(g.subPaths.length, 1);
  const sp = g.subPaths[0];
  assert.strictEqual(sp.closed, false);
  assert.strictEqual(sp.anchors.length, 2);
  assert.deepStrictEqual(sp.anchors[0].point, { x: 0, y: 0 });
  assert.deepStrictEqual(sp.anchors[1].point, { x: 80, y: 60 });
});

// ============================================================================
// 2. object.createPath 命令与撤销重做
// ============================================================================
console.log('--- 测试 2: object.createPath 命令 ---');

it('object.createPath 创建矩形路径并自动选中，支持撤销重做', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 400, height: 300 });
  const rectGeom = createRectGeometry(50, 50, 100, 80);

  const res = runtime.execute('object.createPath', {
    geometry: rectGeom,
    fill: '#336699',
    stroke: '#001122',
    strokeWidth: 2,
    name: 'Test Rectangle',
  });
  assert.strictEqual(res.ok, true);
  const layer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  assert.strictEqual(layer.children.length, 1);
  const createdId = layer.children[0];
  const node = runtime.currentDocument.nodes.get(createdId);
  assert.strictEqual(node.kind, 'Path');
  assert.strictEqual(runtime.currentSelection.nodeIds.includes(createdId), true);

  // 撤销
  runtime.execute('history.undo', {});
  const undoLayer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  assert.strictEqual(undoLayer.children.length, 0);

  // 重做
  runtime.execute('history.redo', {});
  const redoLayer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  assert.strictEqual(redoLayer.children.length, 1);
});

// ============================================================================
// 3. object.createText 与 text.setText
// ============================================================================
console.log('--- 测试 3: 文本图元创建与编辑 ---');

it('object.createText 创建文本图元并执行 text.setText 更新属性', () => {
  const runtime = createRuntime();
  runtime._doc = createDocument({ width: 400, height: 300 });

  const createRes = runtime.execute('object.createText', {
    x: 60,
    y: 80,
    text: 'Hello OmniView',
    fontSize: 16,
    fill: '#ff0055',
  });
  assert.strictEqual(createRes.ok, true);
  const layer = runtime.currentDocument.nodes.get(runtime.currentDocument.layers[0]);
  assert.strictEqual(layer.children.length, 1);
  const textId = layer.children[0];
  const textNode = runtime.currentDocument.nodes.get(textId);
  assert.strictEqual(textNode.kind, 'Text');
  if (textNode.kind === 'Text') {
    assert.strictEqual(textNode.text, 'Hello OmniView');
    assert.strictEqual(textNode.fontSize, 16);
  }

  // 更新文本内容与样式
  const updateRes = runtime.execute('text.setText', {
    id: textId,
    text: 'SVG v2 Editing Engine',
    fontSize: 24,
    textAnchor: 'middle',
  });
  assert.strictEqual(updateRes.ok, true);
  const updatedNode = runtime.currentDocument.nodes.get(textId);
  if (updatedNode.kind === 'Text') {
    assert.strictEqual(updatedNode.text, 'SVG v2 Editing Engine');
    assert.strictEqual(updatedNode.fontSize, 24);
    assert.strictEqual(updatedNode.textAnchor, 'middle');
  }

  // 撤销回到 Hello OmniView
  runtime.execute('history.undo', {});
  const undoNode = runtime.currentDocument.nodes.get(textId);
  if (undoNode.kind === 'Text') {
    assert.strictEqual(undoNode.text, 'Hello OmniView');
    assert.strictEqual(undoNode.fontSize, 16);
  }
});

// ============================================================================
// 4. path.updateAnchor 命令
// ============================================================================
console.log('--- 测试 4: path.updateAnchor 锚点微调 ---');

it('path.updateAnchor 精确更新锚点坐标并支持撤销', () => {
  const runtime = createRuntime();
  const baseDoc = createDocument({ width: 200, height: 200 });
  const geom = pathGeometry([
    {
      anchors: [anchorCorner(vec2(10, 10)), anchorCorner(vec2(50, 50))],
      closed: false,
    },
  ]);
  const appended = appendToLayer(baseDoc, baseDoc.layers[0], makePath(0, geom));
  runtime._doc = appended.doc;
  const pathId = appended.nodeId;

  const res = runtime.execute('path.updateAnchor', {
    id: pathId,
    subPathIndex: 0,
    anchorIndex: 1,
    point: { x: 80, y: 90 },
  });
  assert.strictEqual(res.ok, true);
  const updated = runtime.currentDocument.nodes.get(pathId);
  if (updated && updated.kind === 'Path') {
    assert.deepStrictEqual(updated.geometry.subPaths[0].anchors[1].point, { x: 80, y: 90 });
  }

  // 撤销
  runtime.execute('history.undo', {});
  const undone = runtime.currentDocument.nodes.get(pathId);
  if (undone && undone.kind === 'Path') {
    assert.deepStrictEqual(undone.geometry.subPaths[0].anchors[1].point, { x: 50, y: 50 });
  }
});

// ============================================================================
// 5. 运行时工具交互与生命周期 (Tools Suite)
// ============================================================================
console.log('--- 测试 5: 工具箱注册与手势交互 ---');

it('所有 7 种核心工具全量注册', () => {
  const expectedTools = ['select', 'node', 'pen', 'rect', 'ellipse', 'line', 'text'];
  for (const tid of expectedTools) {
    assert.ok(tools[tid] !== undefined, `工具 ${tid} 必须注册`);
    assert.ok(typeof tools[tid].cursor === 'function', `工具 ${tid} 需提供光标`);
  }
});

it('rectTool 拖拽手势触发 Begin -> Preview -> Commit', () => {
  const t = tools['rect'];
  const dummyCtx = {
    doc: createDocument({ width: 200, height: 200 }),
    selection: { nodeIds: [] },
    viewport: { x: 0, y: 0, zoom: 1, width: 200, height: 200 },
    zoom: 1,
    gesture: null,
  };

  const downActions = t.pointer(dummyCtx, {
    kind: 'down',
    point: vec2(10, 20),
    mods: { shift: false, alt: false, meta: false, ctrl: false },
    pressure: 0.5,
  });
  assert.strictEqual(downActions[0].kind, 'Begin');

  dummyCtx.gesture = {
    kind: 'marquee',
    startPoint: vec2(10, 20),
    currentPoint: vec2(60, 70),
    ids: [],
  };
  const overlays = t.overlay(dummyCtx);
  assert.strictEqual(overlays.length, 1);
  assert.strictEqual(overlays[0].kind, 'rect');
  assert.deepStrictEqual(overlays[0].rect, { x: 10, y: 20, width: 50, height: 50 });

  const upActions = t.pointer(dummyCtx, {
    kind: 'up',
    point: vec2(60, 70),
    mods: { shift: false, alt: false, meta: false, ctrl: false },
    pressure: 0.5,
  });
  assert.strictEqual(upActions[0].kind, 'Exec');
  assert.strictEqual(upActions[0].commandId, 'object.createPath');
  assert.strictEqual(upActions[1].kind, 'Commit');
});

it('textTool 点击手势直接提交 Exec (object.createText)', () => {
  const t = tools['text'];
  const dummyCtx = {
    doc: createDocument({ width: 200, height: 200 }),
    selection: { nodeIds: [] },
    viewport: { x: 0, y: 0, zoom: 1, width: 200, height: 200 },
    zoom: 1,
    fillActive: true,
    constrainAngle: 0,
    snapToGrid: false,
    snapToPoint: false,
    snapTolerance: 4,
  };

  const downActions = t.pointer(dummyCtx, {
    kind: 'down',
    point: vec2(120, 150),
    mods: { shift: false, alt: false, meta: false, ctrl: false },
    pressure: 0.5,
  });
  assert.strictEqual(downActions[0].kind, 'Exec');
  assert.strictEqual(downActions[0].commandId, 'object.createText');
  assert.strictEqual(downActions[0].params.x, 120);
  assert.strictEqual(downActions[0].params.y, 150);
});

// ============================================================================
// 汇总
// ============================================================================
console.log(`\n🎉 测试完成：${passed} 通过，${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
