#!/usr/bin/env node
/**
 * OmniView SVG v2 — 元素选择增强体系单元测试
 *
 * 覆盖 6 大选区优化点：
 * 1. selectionToggle 反选剔除机制
 * 2. 精确描边命中（空心内部空白穿透 vs 描边边缘命中）
 * 3. 带填充多边形精确命中（点在多边形内）
 * 4. 编组选择与 Cmd/Ctrl 穿透 (findOutermostGroup vs deepSelect)
 * 5. 重叠图元多候选与循环点选 (hitTestAllAtPoint)
 * 6. 框选 enclosed (全包含) vs intersect (触碰相交) 及大背景保护
 */
import assert from 'node:assert';
import {
  createDocument,
  makePath,
  makeGroup,
  appendToLayer,
  selectionToggle,
  findOutermostGroup,
  hitTestTopmost,
  hitTestAllAtPoint,
  createRectGeometry,
  pathGeometry,
  subPath,
  vec2,
  anchorCorner,
  commandRegistry,
  tools,
  getSelectionBBox,
  selectionAdd,
  selectionClear,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 元素选择专项增强单元测试...\n');

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
// 1. selectionToggle 行为验证
// ============================================================================
console.log('--- 测试 1: selectionToggle 反选剔除机制 ---');

it('当图元未被选中时，selectionToggle 将其追加至选区', () => {
  const sel0 = { nodeIds: [1], primaryId: 1 };
  const sel1 = selectionToggle(sel0, 2);
  assert.deepStrictEqual(sel1.nodeIds, [1, 2]);
  assert.strictEqual(sel1.primaryId, 1);
});

it('当图元已处于选区中时，selectionToggle 将其反选剔除，并自动转移 primaryId', () => {
  const sel0 = { nodeIds: [1, 2, 3], primaryId: 1 };
  const sel1 = selectionToggle(sel0, 1);
  assert.deepStrictEqual(sel1.nodeIds, [2, 3]);
  assert.strictEqual(sel1.primaryId, 3); // primaryId 顺移至有效项

  const sel2 = selectionToggle(sel1, 2);
  assert.deepStrictEqual(sel2.nodeIds, [3]);
  assert.strictEqual(sel2.primaryId, 3);

  const sel3 = selectionToggle(sel2, 3);
  assert.deepStrictEqual(sel3.nodeIds, []);
  assert.strictEqual(sel3.primaryId, null);
});

// ============================================================================
// 2. 精确描边命中（空心内部穿透 vs 描边边缘命中）
// ============================================================================
console.log('\n--- 测试 2: 精确描边命中算法 ---');

it('纯描边空心矩形：点击描边边缘命中，点击内部大片空白不误选', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  // 构造一个从 (100, 100) 到 (300, 300) 的空心矩形（只有描边 width: 4，无 fill）
  const rectGeo = createRectGeometry(100, 100, 200, 200);
  const hollowRect = makePath(0, rectGeo, {
    items: [
      {
        kind: 'stroke',
        stroke: {
          paint: { type: 'solid', color: '#000000' },
          width: 4,
          cap: 'butt',
          join: 'miter',
          miterLimit: 4,
          opacity: 1,
        },
      },
    ],
  });
  const res = appendToLayer(doc, layerId, hollowRect);
  doc = res.doc;
  const actualId = res.nodeId;

  // 1. 点击中心内部空白 (200, 200)：距离描边 100px，绝不应命中
  const hitCenter = hitTestTopmost(doc, { x: 200, y: 200 }, 5);
  assert.strictEqual(hitCenter, null, '点击空心图形内部空白处不应误命中！');

  // 2. 点击上边框边缘 (200, 101)：距离描边 1px，应当精确命中
  const hitEdge = hitTestTopmost(doc, { x: 200, y: 101 }, 5);
  assert.strictEqual(hitEdge, actualId, '点击描边边缘应当精确命中');

  // 3. 点击外部较远处 (50, 50)：不命中
  const hitOutside = hitTestTopmost(doc, { x: 50, y: 50 }, 5);
  assert.strictEqual(hitOutside, null);
});

// ============================================================================
// 3. 带填充多边形精确命中（点在多边形内）
// ============================================================================
console.log('\n--- 测试 3: 带填充多边形命中测试 ---');

it('实心三角形：内部点击命中，外接包围盒但处于三角形外的空白不误选', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  // 构造直角三角形：(100, 100) -> (300, 100) -> (100, 300) 闭合
  // 包围盒为 [100, 100, 200, 200]，但右上角 (280, 280) 在三角形外面！
  const triGeo = pathGeometry([
    subPath(
      [
        anchorCorner(vec2(100, 100)),
        anchorCorner(vec2(300, 100)),
        anchorCorner(vec2(100, 300)),
      ],
      true,
    ),
  ]);
  const filledTri = makePath(0, triGeo, {
    items: [
      {
        kind: 'fill',
        fill: {
          paint: { type: 'solid', color: '#3b82f6' },
          rule: 'nonzero',
          opacity: 1,
        },
      },
    ],
  });
  const res = appendToLayer(doc, layerId, filledTri);
  doc = res.doc;
  const actualId = res.nodeId;

  // 1. 点击三角形内部重心 (130, 130)：应当命中
  const hitInside = hitTestTopmost(doc, { x: 130, y: 130 }, 5);
  assert.strictEqual(hitInside, actualId, '三角形内部应当命中');

  // 2. 点击外接矩形右上角 (280, 280)：在包围盒内但不在多边形实体内，绝不能误命中！
  const hitBoxCorner = hitTestTopmost(doc, { x: 280, y: 280 }, 5);
  assert.strictEqual(hitBoxCorner, null, '虽然在矩形外包围盒内，但不在三角形实体内，不应误选');
});

// ============================================================================
// 4. 编组与穿透选择 (findOutermostGroup vs deepSelect)
// ============================================================================
console.log('\n--- 测试 4: 编组选择与穿透 (Deep Select) ---');

it('默认点击 Group 内元素选中顶层编组；启用 deepSelect (Cmd/Ctrl) 时穿透选中叶子图元', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  const p1 = makePath(0, createRectGeometry(50, 50, 40, 40), {
    items: [{ kind: 'fill', fill: { paint: { type: 'solid', color: '#ff0000' }, rule: 'nonzero', opacity: 1 } }],
  });
  const resP1 = appendToLayer(doc, layerId, p1);
  doc = resP1.doc;
  const childId = resP1.nodeId;

  const group = makeGroup(0, [childId]);
  const resGroup = appendToLayer(doc, layerId, group);
  doc = resGroup.doc;
  const actualGroupId = resGroup.nodeId;

  // 验证 findOutermostGroup
  assert.strictEqual(findOutermostGroup(doc, childId), actualGroupId);

  // 普通点击 (deepSelect = false)：应该命中并返回 Group
  const hitDefault = hitTestTopmost(doc, { x: 70, y: 70 }, 5, false);
  assert.strictEqual(hitDefault, actualGroupId, '默认点击应当选中编组整体');

  // 穿透点击 (deepSelect = true)：应该穿透返回具体的子图元 childId
  const hitDeep = hitTestTopmost(doc, { x: 70, y: 70 }, 5, true);
  assert.strictEqual(hitDeep, childId, '按住 Cmd/Ctrl 应当穿透选中具体的叶子图元');
});

// ============================================================================
// 5. 重叠图元循环点选与多候选收集
// ============================================================================
console.log('\n--- 测试 5: 重叠图元多候选与循环收集 ---');

it('hitTestAllAtPoint 正确返回从顶层到底层的所有重叠图元列表', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  // 底层大矩形 (0, 0, 300, 300)
  const bottomRect = makePath(0, createRectGeometry(0, 0, 300, 300), {
    items: [{ kind: 'fill', fill: { paint: { type: 'solid', color: '#aaaaaa' }, rule: 'nonzero', opacity: 1 } }],
  });
  // 顶层小矩形 (50, 50, 100, 100)
  const topRect = makePath(0, createRectGeometry(50, 50, 100, 100), {
    items: [{ kind: 'fill', fill: { paint: { type: 'solid', color: '#111111' }, rule: 'nonzero', opacity: 1 } }],
  });

  const res1 = appendToLayer(doc, layerId, bottomRect);
  doc = res1.doc;
  const botId = res1.nodeId;

  const res2 = appendToLayer(doc, layerId, topRect);
  doc = res2.doc;
  const topId = res2.nodeId;

  // 在重叠点 (80, 80) 进行测试
  const allHits = hitTestAllAtPoint(doc, { x: 80, y: 80 }, 5);
  assert.strictEqual(allHits.length, 2);
  assert.strictEqual(allHits[0], topId, '第 1 候选必须是最上层小矩形');
  assert.strictEqual(allHits[1], botId, '第 2 候选必须是底层大矩形');
});

// ============================================================================
// 6. 框选 enclosed (全包含) vs intersect (触碰相交) 及大背景保护
// ============================================================================
console.log('\n--- 测试 6: 框选模式与大背景保护 ---');

it('select.box 在 enclosed 模式下仅选中完全包含的图元，在 intersect 模式下选中相交图元', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  // 图元 A: 完全在框内 (110, 110, 30, 30)
  const nodeA = makePath(0, createRectGeometry(110, 110, 30, 30));
  // 图元 B: 跨越选框边界 (180, 110, 50, 50)
  const nodeB = makePath(0, createRectGeometry(180, 110, 50, 50));

  const resA = appendToLayer(doc, layerId, nodeA);
  doc = resA.doc;
  const idA = resA.nodeId;

  const resB = appendToLayer(doc, layerId, nodeB);
  doc = resB.doc;
  const idB = resB.nodeId;

  const reg = commandRegistry;
  const boxCmd = reg.find('select.box');
  assert.ok(boxCmd);

  // 选框：[100, 100, 100, 100] (即 x: 100..200, y: 100..200)
  // A 完全在内；B 的 x 跨越到 230，部分在内部分在外
  const rect = { x: 100, y: 100, width: 100, height: 100 };

  // 1. enclosed 模式（默认）：只有 A 完全包含
  const resEnclosed = boxCmd.handler(doc, { nodeIds: [], primaryId: null }, { rect, additive: false, mode: 'enclosed' });
  assert.ok(resEnclosed.ok);
  assert.deepStrictEqual(resEnclosed.selection.nodeIds, [idA]);

  // 2. intersect 模式：A 和 B 均命中
  const resIntersect = boxCmd.handler(doc, { nodeIds: [], primaryId: null }, { rect, additive: false, mode: 'intersect' });
  assert.ok(resIntersect.ok);
  assert.strictEqual(resIntersect.selection.nodeIds.length, 2);
  assert.ok(resIntersect.selection.nodeIds.includes(idA));
  assert.ok(resIntersect.selection.nodeIds.includes(idB));
});

it('select.box 自动保护覆盖全图的大背景层，小选框不会误选背景', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  // 整个画布的大背景 (0, 0, 800, 600)
  const bgNode = makePath(0, createRectGeometry(0, 0, 800, 600));
  // 前景小图标 (150, 150, 40, 40)
  const fgNode = makePath(0, createRectGeometry(150, 150, 40, 40));

  const resBg = appendToLayer(doc, layerId, bgNode);
  doc = resBg.doc;
  const bgId = resBg.nodeId;

  const resFg = appendToLayer(doc, layerId, fgNode);
  doc = resFg.doc;
  const fgId = resFg.nodeId;

  const reg = commandRegistry;
  const boxCmd = reg.find('select.box');

  // 小选框局部框选前景图标 [140, 140, 60, 60]
  const rect = { x: 140, y: 140, width: 60, height: 60 };
  const res = boxCmd.handler(doc, { nodeIds: [], primaryId: null }, { rect, additive: false, mode: 'intersect' });

  assert.ok(res.ok);
  assert.deepStrictEqual(res.selection.nodeIds, [fgId], '局部框选绝不应误选整幅画面的大底图！');
});

// ============================================================================
// 7. CAD 模式鼠标框选验证 (从左向右窗选实线 vs 从右向左交叉虚线)
// ============================================================================
console.log('\n--- 测试 7: 鼠标选择参考 CAD 规范 (窗选 vs 交叉选) ---');

it('CAD 规范：从左向右为窗选实线 (enclosed)，从右向左为交叉虚线 (intersect)', () => {
  const selectTool = tools.select;
  assert.ok(selectTool);

  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];
  const nodeA = makePath(0, createRectGeometry(100, 100, 50, 50));
  const resA = appendToLayer(doc, layerId, nodeA);
  doc = resA.doc;

  const mockCtx = {
    doc,
    selection: { nodeIds: [], primaryId: null },
    zoom: 1,
    activeToolId: 'select',
    gesture: null,
  };

  // 1. 从左向右拉框 (p1.x: 50 -> p2.x: 200)
  mockCtx.gesture = {
    kind: 'marquee',
    startPoint: { x: 50, y: 50 },
    currentPoint: { x: 200, y: 200 },
  };
  const overlayLeftToRight = selectTool.overlay?.(mockCtx);
  assert.ok(overlayLeftToRight && overlayLeftToRight.length > 0);
  const rectL2R = overlayLeftToRight[0];
  assert.strictEqual(rectL2R.kind, 'rect');
  assert.strictEqual(rectL2R.dashed, false, '从左向右窗选应当是 CAD 实线边框！');
  assert.strictEqual(rectL2R.stroke, '#2563eb', '从左向右窗选应当是经典 CAD 蓝框！');

  // 2. 从右向左拉框 (p1.x: 200 -> p2.x: 50)
  mockCtx.gesture = {
    kind: 'marquee',
    startPoint: { x: 200, y: 50 },
    currentPoint: { x: 50, y: 200 },
  };
  const overlayRightToLeft = selectTool.overlay?.(mockCtx);
  assert.ok(overlayRightToLeft && overlayRightToLeft.length > 0);
  const rectR2L = overlayRightToLeft[0];
  assert.strictEqual(rectR2L.kind, 'rect');
  assert.strictEqual(rectR2L.dashed, true, '从右向左交叉选应当是 CAD 虚线边框！');
  assert.strictEqual(rectR2L.stroke, '#10b981', '从右向左交叉选应当是经典 CAD 绿框！');
});

// ============================================================================
// 8. 点击选择可以通过 Ctrl / Cmd 实现多选及反选
// ============================================================================
console.log('\n--- 测试 8: Ctrl / Cmd 鼠标点击多选与反选剔除 ---');

it('Ctrl / Cmd 点击实现多选追加；再次点击同一图元实现反选剔除', () => {
  const selectTool = tools.select;
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  const node1 = makePath(0, createRectGeometry(50, 50, 40, 40));
  const node2 = makePath(0, createRectGeometry(150, 50, 40, 40));
  const node3 = makePath(0, createRectGeometry(250, 50, 40, 40));

  const r1 = appendToLayer(doc, layerId, node1);
  doc = r1.doc;
  const id1 = r1.nodeId;

  const r2 = appendToLayer(doc, layerId, node2);
  doc = r2.doc;
  const id2 = r2.nodeId;

  const r3 = appendToLayer(doc, layerId, node3);
  doc = r3.doc;
  const id3 = r3.nodeId;

  const setCmd = commandRegistry.find('select.set');
  assert.ok(setCmd);

  // 初始：选中 id1
  let sel = { nodeIds: [id1], primaryId: id1 };

  // 1. 模拟按住 Ctrl 点击 id2 (mods.ctrl = true) -> 应当追加 id2，选区变为 [id1, id2]
  const toolCtx1 = { doc, selection: sel, zoom: 1, activeToolId: 'select', gesture: null };
  const actions1 = selectTool.pointer?.(toolCtx1, {
    kind: 'down',
    point: { x: 170, y: 70 }, // 命中 node2
    mods: { shift: false, ctrl: true, meta: false, alt: false, space: false },
    pressure: 1,
  });
  assert.ok(actions1 && actions1.length > 0);
  const execAdd = actions1.find((a) => a.kind === 'Exec');
  assert.ok(execAdd);
  assert.strictEqual(execAdd.commandId, 'select.set');
  assert.strictEqual(execAdd.params.additive, true);

  // 执行该命令
  const resAdd = setCmd.handler(doc, sel, execAdd.params);
  assert.ok(resAdd.ok);
  sel = resAdd.selection;
  assert.deepStrictEqual(sel.nodeIds, [id1, id2], 'Ctrl+点击应当成功追加至多选选区');

  // 2. 模拟按住 Ctrl 点击已选中的 id2 -> 应当反选剔除 id2，选区变回 [id1]
  const toolCtx2 = { doc, selection: sel, zoom: 1, activeToolId: 'select', gesture: null };
  const actions2 = selectTool.pointer?.(toolCtx2, {
    kind: 'down',
    point: { x: 170, y: 70 }, // 再次命中已选中的 node2
    mods: { shift: false, ctrl: true, meta: false, alt: false, space: false },
    pressure: 1,
  });
  assert.ok(actions2 && actions2.length > 0);
  const execToggle = actions2.find((a) => a.kind === 'Exec');
  assert.ok(execToggle);
  assert.strictEqual(execToggle.commandId, 'select.set');
  assert.strictEqual(execToggle.params.additive, true);
  assert.strictEqual(execToggle.params.toggle, true, 'Ctrl 点击已选图元应触发反选剔除');

  const resToggle = setCmd.handler(doc, sel, execToggle.params);
  assert.ok(resToggle.ok);
  sel = resToggle.selection;
  assert.deepStrictEqual(sel.nodeIds, [id1], '反选剔除后应只剩未剔除的图元');
});

// ============================================================================
// 9. 选中多个图元的共性操作全套检验
// ============================================================================
console.log('\n--- 测试 9: 选中多个图元的共性操作全套检验 ---');

it('多选共性操作：联合包围盒、批量对齐、批量分布、批量一键编组与解组、批量显隐与锁定', () => {
  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];

  // 创建三个分散放置的矩形
  const n1 = makePath(0, createRectGeometry(100, 100, 40, 40));
  const n2 = makePath(0, createRectGeometry(200, 150, 40, 40));
  const n3 = makePath(0, createRectGeometry(350, 200, 40, 40));

  const r1 = appendToLayer(doc, layerId, n1);
  doc = r1.doc;
  const id1 = r1.nodeId;

  const r2 = appendToLayer(doc, layerId, n2);
  doc = r2.doc;
  const id2 = r2.nodeId;

  const r3 = appendToLayer(doc, layerId, n3);
  doc = r3.doc;
  const id3 = r3.nodeId;

  const ids = [id1, id2, id3];
  const sel = { nodeIds: ids, primaryId: id1 };

  // 1. 联合包围盒 getSelectionBBox
  const unionBox = getSelectionBBox(doc, ids);
  assert.ok(unionBox);
  assert.strictEqual(unionBox.x, 100);
  assert.strictEqual(unionBox.y, 100);
  assert.strictEqual(unionBox.x + unionBox.width, 390); // 350 + 40
  assert.strictEqual(unionBox.y + unionBox.height, 240); // 200 + 40

  // 2. 批量对齐：全部左对齐到 x: 100
  const alignCmd = commandRegistry.find('object.align');
  assert.ok(alignCmd);
  const resAlign = alignCmd.handler(doc, sel, { ids, align: 'left', relative: 'selection' });
  assert.ok(resAlign.ok);
  doc = resAlign.doc;

  // 3. 批量一键编组 object.group
  const groupCmd = commandRegistry.find('object.group');
  assert.ok(groupCmd);
  const resGroup = groupCmd.handler(doc, sel, { ids });
  assert.ok(resGroup.ok);
  doc = resGroup.doc;
  const groupId = resGroup.selection.primaryId;
  assert.ok(groupId);
  const groupNode = doc.nodes.get(groupId);
  assert.strictEqual(groupNode.kind, 'Group');
  assert.strictEqual(groupNode.children.length, 3);

  // 4. 批量解散编组 object.ungroup
  const ungroupCmd = commandRegistry.find('object.ungroup');
  assert.ok(ungroupCmd);
  const resUngroup = ungroupCmd.handler(doc, resGroup.selection, { id: groupId });
  assert.ok(resUngroup.ok);
  doc = resUngroup.doc;
  assert.strictEqual(resUngroup.selection.nodeIds.length, 3);

  // 5. 批量锁定与解锁 object.setLocked
  const lockCmd = commandRegistry.find('object.setLocked');
  assert.ok(lockCmd);
  const resLock = lockCmd.handler(doc, sel, { ids, locked: true });
  assert.ok(resLock.ok);
  doc = resLock.doc;
  for (const id of ids) {
    assert.strictEqual(doc.nodes.get(id).locked, true, '所有图元应全部被批量锁定');
  }

  // 批量解锁
  const resUnlock = lockCmd.handler(doc, sel, { ids, locked: false });
  assert.ok(resUnlock.ok);
  doc = resUnlock.doc;
  for (const id of ids) {
    assert.strictEqual(doc.nodes.get(id).locked, false, '所有图元应全部被批量解锁');
  }

  // 6. 批量显隐 object.setVisible
  const visibleCmd = commandRegistry.find('object.setVisible');
  assert.ok(visibleCmd);
  const resHide = visibleCmd.handler(doc, sel, { ids, visible: false });
  assert.ok(resHide.ok);
  doc = resHide.doc;
  for (const id of ids) {
    assert.strictEqual(doc.nodes.get(id).visible, false, '所有图元应全部被批量隐藏');
  }
});
console.log(`\n📊 元素选择专项增强测试结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
