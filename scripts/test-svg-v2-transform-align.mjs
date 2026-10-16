#!/usr/bin/env node
/**
 * OmniView SVG 编辑引擎 v2 — 8 向变形手柄、旋转、联合对齐、等距分布与互操作测试
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
  getTool,
  exportSvg,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 变形手柄、对齐分布、路径端点与互操作单元测试...');

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

// 辅助：创建带 3 个矩形路径的 Runtime
function makeThreeNodesRuntime() {
  const runtime = createRuntime();
  const baseDoc = createDocument({ width: 500, height: 500 });
  const layerId = baseDoc.layers[0];
  // Node 1: (10, 10) to (50, 50), w=40, h=40
  const n1 = makePath(0, pathGeometry([{
    anchors: [
      anchorCorner(vec2(10, 10)),
      anchorCorner(vec2(50, 10)),
      anchorCorner(vec2(50, 50)),
      anchorCorner(vec2(10, 50)),
    ],
    closed: true,
  }]));
  // Node 2: (100, 60) to (140, 100), w=40, h=40
  const n2 = makePath(0, pathGeometry([{
    anchors: [
      anchorCorner(vec2(100, 60)),
      anchorCorner(vec2(140, 60)),
      anchorCorner(vec2(140, 100)),
      anchorCorner(vec2(100, 100)),
    ],
    closed: true,
  }]));
  // Node 3: (300, 150) to (360, 210), w=60, h=60
  const n3 = makePath(0, pathGeometry([{
    anchors: [
      anchorCorner(vec2(300, 150)),
      anchorCorner(vec2(360, 150)),
      anchorCorner(vec2(360, 210)),
      anchorCorner(vec2(300, 210)),
    ],
    closed: true,
  }]));

  const r1 = appendToLayer(baseDoc, layerId, n1);
  const r2 = appendToLayer(r1.doc, layerId, n2);
  const r3 = appendToLayer(r2.doc, layerId, n3);
  runtime._doc = r3.doc;
  return { runtime, ids: [r1.nodeId, r2.nodeId, r3.nodeId] };
}

const noMods = { shift: false, alt: false, meta: false, ctrl: false, space: false };

async function runAll() {
  // ============================================================================
  // 1. object.align 联合对齐
  // ============================================================================
  console.log('--- 测试 1: 联合对齐 (object.align) ---');

  await it('object.align left 对齐到联合选区最小 X', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.align', { ids, align: 'left' });
    assert.strictEqual(res.ok, true);

    const doc = runtime.currentDocument;
    const p1 = doc.nodes.get(ids[0]);
    const p2 = doc.nodes.get(ids[1]);
    const p3 = doc.nodes.get(ids[2]);
    assert.strictEqual(p1.transform.e, 0); // 原本就是 10
    assert.strictEqual(p2.transform.e, -90); // 100 - 90 = 10
    assert.strictEqual(p3.transform.e, -290); // 300 - 290 = 10

    // 撤销验证
    runtime.undo();
    assert.strictEqual(runtime.currentDocument.nodes.get(ids[1]).transform.e, 0);
    runtime.redo();
    assert.strictEqual(runtime.currentDocument.nodes.get(ids[1]).transform.e, -90);
  });

  await it('object.align top 对齐到联合选区最小 Y', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.align', { ids, align: 'top' });
    assert.strictEqual(res.ok, true);
    const doc = runtime.currentDocument;
    assert.strictEqual(doc.nodes.get(ids[0]).transform.f, 0); // 原本 minY 为 10
    assert.strictEqual(doc.nodes.get(ids[1]).transform.f, -50); // 60 - 50 = 10
    assert.strictEqual(doc.nodes.get(ids[2]).transform.f, -140); // 150 - 140 = 10
  });

  await it('object.align center / centerH 水平居中对齐', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.align', { ids, align: 'center' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(runtime.history.undo.length > 0, true);
  });

  await it('object.align middle / centerV 垂直居中对齐', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.align', { ids, align: 'middle' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(runtime.history.undo.length > 0, true);
  });

  // ============================================================================
  // 2. object.distribute 等距分布
  // ============================================================================
  console.log('--- 测试 2: 等距分布 (object.distribute) ---');

  await it('object.distribute horizontal 水平均匀分布', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.distribute', { ids, axis: 'horizontal' });
    assert.strictEqual(res.ok, true);

    const doc = runtime.currentDocument;
    assert.strictEqual(doc.nodes.get(ids[0]).transform.e, 0);
    assert.strictEqual(doc.nodes.get(ids[2]).transform.e, 0);
    assert.notStrictEqual(doc.nodes.get(ids[1]).transform.e, 0);

    runtime.undo();
    assert.strictEqual(runtime.currentDocument.nodes.get(ids[1]).transform.e, 0);
    runtime.redo();
    assert.notStrictEqual(runtime.currentDocument.nodes.get(ids[1]).transform.e, 0);
  });

  await it('object.distribute vertical 垂直均匀分布', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.distribute', { ids, axis: 'vertical' });
    assert.strictEqual(res.ok, true);
    const doc = runtime.currentDocument;
    assert.strictEqual(doc.nodes.get(ids[0]).transform.f, 0);
    assert.strictEqual(doc.nodes.get(ids[2]).transform.f, 0);
    assert.notStrictEqual(doc.nodes.get(ids[1]).transform.f, 0);
  });

  // ============================================================================
  // 3. object.scale 与 object.rotate
  // ============================================================================
  console.log('--- 测试 3: 变形与旋转命令 (object.scale & object.rotate) ---');

  await it('object.scale 按比例与原点缩放图元', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.scale', {
      ids: [ids[0]],
      origin: vec2(30, 30),
      factor: vec2(2, 2),
    });
    assert.strictEqual(res.ok, true);
    const n1 = runtime.currentDocument.nodes.get(ids[0]);
    assert.strictEqual(n1.transform.a, 2);
    assert.strictEqual(n1.transform.d, 2);

    runtime.undo();
    assert.strictEqual(runtime.currentDocument.nodes.get(ids[0]).transform.a, 1);
  });

  await it('object.rotate 围绕指定中心旋转指定角度', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res = runtime.execute('object.rotate', {
      ids: [ids[0]],
      origin: vec2(30, 30),
      angleDeg: 90,
    });
    assert.strictEqual(res.ok, true);
    const n1 = runtime.currentDocument.nodes.get(ids[0]);
    assert.ok(Math.abs(n1.transform.a) < 1e-6);
    assert.ok(Math.abs(n1.transform.b - 1) < 1e-6);

    runtime.undo();
    assert.strictEqual(runtime.currentDocument.nodes.get(ids[0]).transform.a, 1);
  });

  // ============================================================================
  // 4. 路径端点箭头与锚点平滑度切换
  // ============================================================================
  console.log('--- 测试 4: 路径端点箭头与锚点平滑度切换 ---');

  await it('path.setMarker 设置路径 start / end 标记', async () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const res1 = runtime.execute('path.setMarker', { id: ids[0], markerStart: 'arrow', markerEnd: 'dot' });
    assert.strictEqual(res1.ok, true);
    const p1 = runtime.currentDocument.nodes.get(ids[0]);
    assert.strictEqual(p1.markerStart, 'arrow');
    assert.strictEqual(p1.markerEnd, 'dot');

    const svg = await exportSvg(runtime.currentDocument);
    assert.ok(svg.includes('marker-start="url(#ov-marker-arrow)"'));
    assert.ok(svg.includes('marker-end="url(#ov-marker-dot)"'));
    assert.ok(svg.includes('id="ov-marker-arrow"'));
    assert.ok(svg.includes('id="ov-marker-dot"'));

    runtime.undo();
    const undone = runtime.currentDocument.nodes.get(ids[0]);
    assert.strictEqual(undone.markerStart, undefined);
    assert.strictEqual(undone.markerEnd, undefined);
  });

  await it('path.toggleAnchorKind 切换尖角与平滑贝塞尔控制手柄', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    const origAnchor = runtime.currentDocument.nodes.get(ids[0]).geometry.subPaths[0].anchors[0];
    assert.strictEqual(origAnchor.handleIn, null);

    const res = runtime.execute('path.toggleAnchorKind', { id: ids[0], subPathIndex: 0, anchorIndex: 0 });
    assert.strictEqual(res.ok, true);
    const smoothAnchor = runtime.currentDocument.nodes.get(ids[0]).geometry.subPaths[0].anchors[0];
    assert.ok(smoothAnchor.handleIn !== null && smoothAnchor.handleIn.x !== 0);
    assert.ok(smoothAnchor.handleOut !== null && smoothAnchor.handleOut.x !== 0);

    const res2 = runtime.execute('path.toggleAnchorKind', { id: ids[0], subPathIndex: 0, anchorIndex: 0 });
    assert.strictEqual(res2.ok, true);
    const cornerAnchor = runtime.currentDocument.nodes.get(ids[0]).geometry.subPaths[0].anchors[0];
    assert.strictEqual(cornerAnchor.handleIn, null);
    assert.strictEqual(cornerAnchor.handleOut, null);
  });

  // ============================================================================
  // 5. selectTool 8 向手柄交互与光标反馈
  // ============================================================================
  console.log('--- 测试 5: selectTool 8 向手柄与旋转交互 ---');

  await it('selectTool overlay 输出 8 个变形手柄与 1 个旋转手柄', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    runtime._selection = { nodeIds: [ids[0]] };
    const tool = getTool('select');
    const ctx = runtime.makeToolContext();
    const overlays = tool.overlay(ctx);

    assert.ok(overlays.length >= 10);
    const rects = overlays.filter((o) => o.kind === 'rect');
    const handles = overlays.filter((o) => o.kind === 'handle');
    const circles = overlays.filter((o) => o.kind === 'circle');
    assert.ok(rects.length >= 1);
    assert.strictEqual(handles.length, 8);
    assert.strictEqual(circles.length, 1);
  });

  await it('selectTool 拖拽缩放手柄产生 Preview 缩放操作并在 Up 提交', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    runtime._selection = { nodeIds: [ids[0]] };
    const tool = getTool('select');
    const ctx = runtime.makeToolContext();

    const downActions = tool.pointer(ctx, {
      kind: 'down',
      point: vec2(50, 50),
      mods: noMods,
      pressure: 0,
    });
    assert.strictEqual(downActions.length, 1);
    assert.strictEqual(downActions[0].kind, 'Begin');
    assert.strictEqual(downActions[0].label, '缩放');

    const moveActions = tool.pointer(ctx, {
      kind: 'drag',
      point: vec2(70, 70),
      mods: noMods,
      pressure: 0,
    });
    assert.strictEqual(moveActions.length, 1);
    assert.strictEqual(moveActions[0].kind, 'Preview');
    assert.strictEqual(moveActions[0].commandId, 'object.scale');

    const upActions = tool.pointer(ctx, {
      kind: 'up',
      point: vec2(70, 70),
      mods: noMods,
      pressure: 0,
    });
    assert.strictEqual(upActions.length, 1);
    assert.strictEqual(upActions[0].kind, 'Commit');
  });

  await it('selectTool 拖拽旋转手柄产生 Preview 旋转操作并在 Up 提交', () => {
    const { runtime, ids } = makeThreeNodesRuntime();
    runtime._selection = { nodeIds: [ids[0]] };
    const tool = getTool('select');
    const ctx = runtime.makeToolContext();

    const downActions = tool.pointer(ctx, {
      kind: 'down',
      point: vec2(30, -14),
      mods: noMods,
      pressure: 0,
    });
    assert.strictEqual(downActions.length, 1);
    assert.strictEqual(downActions[0].kind, 'Begin');
    assert.strictEqual(downActions[0].label, '旋转');

    const moveActions = tool.pointer(ctx, {
      kind: 'drag',
      point: vec2(50, 0),
      mods: noMods,
      pressure: 0,
    });
    assert.strictEqual(moveActions.length, 1);
    assert.strictEqual(moveActions[0].kind, 'Preview');
    assert.strictEqual(moveActions[0].commandId, 'object.rotate');

    const upActions = tool.pointer(ctx, {
      kind: 'up',
      point: vec2(50, 0),
      mods: noMods,
      pressure: 0,
    });
    assert.strictEqual(upActions.length, 1);
    assert.strictEqual(upActions[0].kind, 'Commit');
  });

  console.log(`\n🎉 测试完成：${passed} 通过，${failed} 失败`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
