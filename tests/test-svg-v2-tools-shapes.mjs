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
  createCurveGeometry,
  isCurvedLineNode,
  getPolylineWorldMidpoints,
  getPolylineWorldAnchors,
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

it('所有 8 种核心工具全量注册（含 arrow 箭头工具）', () => {
  const expectedTools = ['select', 'node', 'pen', 'rect', 'ellipse', 'line', 'arrow', 'text'];
  for (const tid of expectedTools) {
    assert.ok(tools[tid] !== undefined, `工具 ${tid} 必须注册`);
    assert.ok(typeof tools[tid].cursor === 'function', `工具 ${tid} 需提供光标`);
  }
});

it('rectTool 拖拽手势触发 Begin -> Preview (实时绘制) -> Exec + Commit + 自动切回 select', () => {
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

  const dragActions = t.pointer(dummyCtx, {
    kind: 'drag',
    point: vec2(60, 70),
    mods: { shift: false, alt: false, meta: false, ctrl: false },
    pressure: 0.5,
  });
  assert.strictEqual(dragActions.length, 1);
  assert.strictEqual(dragActions[0].kind, 'Preview');
  assert.strictEqual(dragActions[0].commandId, 'object.createPath');

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
  assert.strictEqual(upActions[2].kind, 'Exec');
  assert.strictEqual(upActions[2].commandId, 'tool.setActive');
});

it('arrowTool 鼠标拖拽绘制双端点箭头并自动附加 markerEnd=arrow，支持 selectTool 双端点独立拖拽调整', () => {
  const rt = createRuntime();
  rt.setActiveTool('arrow');
  assert.strictEqual(rt.activeToolId, 'arrow');

  // 1. 按下起点 (20, 30) -> 拖拽至 (120, 30) -> 释放完成箭头创建
  const noMods = { shift: false, alt: false, meta: false, ctrl: false };
  rt.dispatchPointer({ kind: 'down', point: vec2(20, 30), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(80, 30), mods: noMods, pressure: 0.5 });
  // 拖拽中途文档已实时出现预览节点
  assert.strictEqual(rt.currentSelection.nodeIds.length, 1);
  rt.dispatchPointer({ kind: 'up', point: vec2(120, 30), mods: noMods, pressure: 0.5 });

  // 释放后自动切回 select 工具，且仅产生 1 个箭头节点
  assert.strictEqual(rt.activeToolId, 'select');
  assert.strictEqual(rt.currentSelection.nodeIds.length, 1);
  const arrowId = rt.currentSelection.nodeIds[0];
  const arrowNode = rt.currentDocument.nodes.get(arrowId);
  assert.strictEqual(arrowNode.kind, 'Path');
  assert.strictEqual(arrowNode.markerEnd, 'arrow');
  assert.deepStrictEqual(arrowNode.geometry.subPaths[0].anchors[0].point, { x: 20, y: 30 });
  assert.deepStrictEqual(arrowNode.geometry.subPaths[0].anchors[1].point, { x: 120, y: 30 });

  // 2. 选中双端点箭头时，selectOverlay 应渲染 1 条虚线 + 2 个圆形端点手柄（而非 8 向矩形框）
  const selOverlays = rt.overlay();
  const circleHandles = selOverlays.filter((o) => o.kind === 'circle' && !o.dashed);
  assert.strictEqual(circleHandles.length, 2, '双端点线条/箭头应显示 2 个端点控制圆柄');

  // 3. 在 select 工具下直接按住终点 (120, 30) 拖拽到 (160, 90)，验证终点精确跟随且起点保持 (20, 30)
  rt.dispatchPointer({ kind: 'down', point: vec2(120, 30), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(160, 90), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(160, 90), mods: noMods, pressure: 0.5 });

  const updatedArrow = rt.currentDocument.nodes.get(arrowId);
  assert.deepStrictEqual(updatedArrow.geometry.subPaths[0].anchors[0].point, { x: 20, y: 30 });
  assert.deepStrictEqual(updatedArrow.geometry.subPaths[0].anchors[1].point, { x: 160, y: 90 });
});

it('rectTool / ellipseTool 支持 Shift 等比（正方形/正圆）与 Alt 中心对称起绘，原地误触单击自动取消', () => {
  const rt = createRuntime();

  // 1. 原地单击不产生垃圾固定图形
  rt.setActiveTool('rect');
  const noMods = { shift: false, alt: false, meta: false, ctrl: false };
  const initialCount = rt.currentDocument.nodes.size;
  rt.dispatchPointer({ kind: 'down', point: vec2(50, 50), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(50, 50), mods: noMods, pressure: 0.5 });
  assert.strictEqual(rt.currentDocument.nodes.size, initialCount, '原地单击不应创建图形');

  // 2. Shift + 拖拽绘制正方形
  rt.setActiveTool('rect');
  const shiftMods = { shift: true, alt: false, meta: false, ctrl: false };
  rt.dispatchPointer({ kind: 'down', point: vec2(10, 10), mods: shiftMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(70, 40), mods: shiftMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(70, 40), mods: shiftMods, pressure: 0.5 });
  const sqId = rt.currentSelection.nodeIds[0];
  const sqNode = rt.currentDocument.nodes.get(sqId);
  const sqAnchors = sqNode.geometry.subPaths[0].anchors;
  const sqW = sqAnchors[1].point.x - sqAnchors[0].point.x;
  const sqH = sqAnchors[2].point.y - sqAnchors[1].point.y;
  assert.strictEqual(sqW, 60);
  assert.strictEqual(sqH, 60, 'Shift 拖拽矩形应锁定为正方形');
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

it('支持直线中点拖拽即折 (Ghost Midpoint drag) 转化为折线，并支持 path.deleteAnchor 恢复直线', () => {
  const rt = createRuntime();
  const noMods = { shift: false, alt: false, meta: false, ctrl: false };

  // 1. 绘制一条从 (20, 50) 到 (120, 50) 的水平直线
  rt.setActiveTool('line');
  rt.dispatchPointer({ kind: 'down', point: vec2(20, 50), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(120, 50), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(120, 50), mods: noMods, pressure: 0.5 });
  assert.strictEqual(rt.activeToolId, 'select');
  const lineId = rt.currentSelection.nodeIds[0];

  // 2. 直线中点为 (70, 50)，在 select 工具下直接点击并拖拽中点至 (70, 110)
  rt.dispatchPointer({ kind: 'down', point: vec2(70, 50), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(70, 110), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(70, 110), mods: noMods, pressure: 0.5 });

  // 3. 验证此时已自动转换为拥有 3 个顶点的折线
  const polyNode = rt.currentDocument.nodes.get(lineId);
  assert.strictEqual(polyNode.kind, 'Path');
  const anchors = polyNode.geometry.subPaths[0].anchors;
  assert.strictEqual(anchors.length, 3, '中点拖拽后应变为 3 锚点折线');
  assert.deepStrictEqual(anchors[0].point, { x: 20, y: 50 });
  assert.deepStrictEqual(anchors[1].point, { x: 70, y: 110 });
  assert.deepStrictEqual(anchors[2].point, { x: 120, y: 50 });

  // 4. 删除中间折点，验证恢复为两点直线
  rt.execute('path.deleteAnchor', { id: lineId, anchorIndex: 1 });
  const restoredNode = rt.currentDocument.nodes.get(lineId);
  const restoredAnchors = restoredNode.geometry.subPaths[0].anchors;
  assert.strictEqual(restoredAnchors.length, 2);
  assert.deepStrictEqual(restoredAnchors[0].point, { x: 20, y: 50 });
  assert.deepStrictEqual(restoredAnchors[1].point, { x: 120, y: 50 });
});

it('支持 path.convertLineStyle 一键切换线型（直线 ↔ Z形直角 ↔ V形直角 ↔ L形直角）', () => {
  const rt = createRuntime();
  const noMods = { shift: false, alt: false, meta: false, ctrl: false };

  // 1. 创建起点 (0, 0) 至终点 (100, 100) 的直线
  rt.setActiveTool('line');
  rt.dispatchPointer({ kind: 'down', point: vec2(0, 0), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(100, 100), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(100, 100), mods: noMods, pressure: 0.5 });
  const id = rt.currentSelection.nodeIds[0];

  // 2. 切换为 Z形直角折线（水平优先）
  rt.execute('path.convertLineStyle', { id, style: 'orthogonal-z' });
  let n = rt.currentDocument.nodes.get(id);
  let anc = n.geometry.subPaths[0].anchors;
  assert.strictEqual(anc.length, 4);
  assert.deepStrictEqual(anc[0].point, { x: 0, y: 0 });
  assert.deepStrictEqual(anc[1].point, { x: 50, y: 0 });
  assert.deepStrictEqual(anc[2].point, { x: 50, y: 100 });
  assert.deepStrictEqual(anc[3].point, { x: 100, y: 100 });

  // 3. 切换为 L形直角连接线
  rt.execute('path.convertLineStyle', { id, style: 'orthogonal-l' });
  n = rt.currentDocument.nodes.get(id);
  anc = n.geometry.subPaths[0].anchors;
  assert.strictEqual(anc.length, 3);
  assert.deepStrictEqual(anc[0].point, { x: 0, y: 0 });
  assert.deepStrictEqual(anc[1].point, { x: 100, y: 0 });
  assert.deepStrictEqual(anc[2].point, { x: 100, y: 100 });

  // 4. 一键恢复为直线
  rt.execute('path.convertLineStyle', { id, style: 'straight' });
  n = rt.currentDocument.nodes.get(id);
  anc = n.geometry.subPaths[0].anchors;
  assert.strictEqual(anc.length, 2);
  assert.deepStrictEqual(anc[0].point, { x: 0, y: 0 });
  assert.deepStrictEqual(anc[1].point, { x: 100, y: 100 });
});

it('支持 curveTool 绘制平滑贝塞尔曲线及 path.convertLineStyle 切换 S形曲线 / C形弧线 / 连续平滑曲线，并支持画布拖拽弧顶中点与控制柄', () => {
  const rt = createRuntime();
  const noMods = { shift: false, alt: false, meta: false, ctrl: false };

  // 1. 验证 createCurveGeometry 生成带贝塞尔控制柄的平滑开放路径
  const sGeom = createCurveGeometry(0, 0, 120, 80, 's');
  assert.strictEqual(sGeom.subPaths.length, 1);
  assert.strictEqual(sGeom.subPaths[0].closed, false);
  assert.strictEqual(sGeom.subPaths[0].anchors.length, 2);
  assert.ok(sGeom.subPaths[0].anchors[0].handleOut !== null, '起点应包含出控制柄 handleOut');
  assert.ok(sGeom.subPaths[0].anchors[1].handleIn !== null, '终点应包含入控制柄 handleIn');

  // 2. 使用 curveTool 在画布上从 (20, 100) 拖拽至 (220, 100) 创建曲线
  rt.setActiveTool('curve');
  assert.strictEqual(rt.activeToolId, 'curve');
  rt.dispatchPointer({ kind: 'down', point: vec2(20, 100), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(220, 100), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(220, 100), mods: noMods, pressure: 0.5 });
  assert.strictEqual(rt.activeToolId, 'select', '释放后自动切回 select 工具');

  const curveId = rt.currentSelection.nodeIds[0];
  let curveNode = rt.currentDocument.nodes.get(curveId);
  assert.strictEqual(isCurvedLineNode(curveNode), true, '新创建的曲线应识别为 isCurvedLineNode');

  // 3. 切换为 C形拱形弧线 (curve-arc)，并验证拖拽曲线弧顶中点使曲线精确穿过目标点 (120, 40)
  rt.execute('path.convertLineStyle', { id: curveId, style: 'curve-arc' });
  curveNode = rt.currentDocument.nodes.get(curveId);
  assert.strictEqual(isCurvedLineNode(curveNode), true);

  const midsBefore = getPolylineWorldMidpoints(rt.currentDocument, curveId);
  assert.ok(midsBefore && midsBefore.length === 1 && midsBefore[0].isCurved, '应返回曲线段弧顶中点');
  const startMid = midsBefore[0].point;

  // 在 select 工具下按住弧顶中点拖拽至 (120, 30)
  rt.dispatchPointer({ kind: 'down', point: startMid, mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(120, 30), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(120, 30), mods: noMods, pressure: 0.5 });

  const midsAfter = getPolylineWorldMidpoints(rt.currentDocument, curveId);
  assert.ok(Math.abs(midsAfter[0].point.x - 120) < 1e-3, '拖拽后曲线 t=0.5 弧顶 X 应精确位于 120');
  assert.ok(Math.abs(midsAfter[0].point.y - 30) < 1e-3, '拖拽后曲线 t=0.5 弧顶 Y 应精确位于 30');

  // 4. 直接拖拽起点贝塞尔控制柄 handleOutPoint，验证控制柄实时更新
  const worldAnchors = getPolylineWorldAnchors(rt.currentDocument, curveId);
  const hOutPt = worldAnchors[0].handleOutPoint;
  assert.ok(hOutPt !== null, '应暴露世界坐标系下的 handleOutPoint');
  rt.dispatchPointer({ kind: 'down', point: hOutPt, mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'drag', point: vec2(80, 10), mods: noMods, pressure: 0.5 });
  rt.dispatchPointer({ kind: 'up', point: vec2(80, 10), mods: noMods, pressure: 0.5 });
  const updatedAnchors = getPolylineWorldAnchors(rt.currentDocument, curveId);
  assert.deepStrictEqual(updatedAnchors[0].handleOutPoint, { x: 80, y: 10 }, '控制柄应精确移动到 (80, 10)');

  // 5. 切换为多点连续平滑曲线 (curve-smooth)
  rt.execute('path.convertLineStyle', { id: curveId, style: 'curve-smooth' });
  curveNode = rt.currentDocument.nodes.get(curveId);
  assert.strictEqual(curveNode.geometry.subPaths[0].anchors.length, 3, '2点线条转 curve-smooth 应生成3锚点连续平滑曲线');
  assert.strictEqual(isCurvedLineNode(curveNode), true);
});

// ============================================================================
// 汇总
// ============================================================================
console.log(`\n🎉 测试完成：${passed} 通过，${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
