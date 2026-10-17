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
// 汇总报告
// ============================================================================
console.log(`\n📊 元素选择专项增强测试结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
