#!/usr/bin/env node
/**
 * OmniView SVG v2 — P0 断链缺陷修复回归测试
 *
 * 覆盖（对应实施计划 T1~T4 + T6 准入）：
 *  1. usvgTreeToDocument 结构断言（group/path/text/image/use、transform、visibility、渐变 id）
 *  2. 导出 Text/Image/Use + <defs> 回插断言（字符串级，绕过 Node 无 DOMParser 限制）
 *  3. exportSync 决策真值矩阵（未加载 / 加载即基线 / 编辑 / echo / 外部变更 / 备份 once）
 *  4. clientToCanvasPoint letterbox 断言（含 viewBox 偏移）
 *  5. select 手势状态机：拖拽恰 1 条历史、点击选中 0 条、删除 1 条、
 *     框选命中集合且不写历史、Escape 取消恢复快照
 *  6. hitTestTopmost 对 Image 的 bbox 命中 / 空白不命中
 */
import assert from 'node:assert';
import {
  usvgTreeToDocument,
  RAW_DEFS_METADATA_KEY,
  shouldExport,
  shouldReloadFromHost,
  decideBackup,
  clientToCanvasPoint,
  createRuntime,
  createDocument,
  appendToLayer,
  makePath,
  makeNodeId,
  pathGeometry,
  anchorCorner,
  vec2,
  hitTestTopmost,
  exportSvg as exportSvgFn,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 P0 修复回归测试...');

let passed = 0;
let failed = 0;
const tests = [];
const it = (name, fn) => {
  tests.push({ name, fn });
};

const MODS = { shift: false, alt: false, meta: false, ctrl: false, space: false };
const pointer = (kind, point, mods = MODS) => ({ kind, point, mods, pressure: 1 });

// ============================================================================
// 1. usvgTreeToDocument 结构断言
// ============================================================================
it('usvgTreeToDocument 转换 group/path/text/image/use 与 transform/visibility/渐变', () => {
  const base = {
    id: '',
    transform: [1, 0, 0, 1, 0, 0],
    opacity: 1,
    visibility: 'visible',
    clipPath: null,
    mask: null,
    filter: null,
  };
  const strokeNone = {
    paint: { type: 'none' },
    width: 1,
    cap: 'butt',
    join: 'miter',
    miterLimit: 4,
    dashArray: null,
    dashOffset: 0,
    alignment: 'center',
  };
  const tree = {
    size: { width: 200, height: 100 },
    root: {
      ...base,
      kind: 'group',
      id: 'root',
      children: [
        {
          ...base,
          kind: 'group',
          id: 'g1',
          transform: [1, 0, 0, 1, 10, 20],
          children: [
            {
              ...base,
              kind: 'path',
              id: 'p1',
              d: 'M0 0 L10 10',
              fill: { type: 'linear-gradient', id: 'grad1' },
              stroke: strokeNone,
            },
          ],
        },
        {
          ...base,
          kind: 'text',
          id: 't1',
          text: '你好',
          x: 5,
          y: 15,
          fontSize: 12,
          fontFamily: 'sans-serif',
          textAnchor: 'middle',
          fill: { type: 'solid', color: '#ff0000', opacity: 1 },
        },
        {
          ...base,
          kind: 'image',
          id: 'img1',
          href: 'data:image/png;base64,AAAA',
          x: 1,
          y: 2,
          width: 30,
          height: 40,
        },
        {
          ...base,
          kind: 'use',
          id: 'u1',
          href: '#sym1',
          x: 3,
          y: 4,
          width: 0,
          height: 0,
        },
        {
          ...base,
          kind: 'path',
          id: 'hidden',
          visibility: 'hidden',
          d: 'M5 5 L6 6',
          fill: { type: 'none' },
          stroke: strokeNone,
        },
      ],
    },
    defs: [],
  };

  const doc = usvgTreeToDocument(tree);
  assert.strictEqual(doc.layers.length, 1);
  const layer = doc.nodes.get(doc.layers[0]);
  assert.strictEqual(layer.kind, 'Layer');
  assert.strictEqual(layer.children.length, 5, '根图层应有 5 个子节点');

  const group = doc.nodes.get(layer.children[0]);
  assert.strictEqual(group.kind, 'Group');
  assert.strictEqual(group.transform.e, 10, 'group translate x 应保留');
  assert.strictEqual(group.transform.f, 20, 'group translate y 应保留');

  const path = doc.nodes.get(group.children[0]);
  assert.strictEqual(path.kind, 'Path');
  const fillItem = path.appearance.items.find((x) => x.kind === 'fill');
  assert.strictEqual(fillItem.fill.type, 'gradient', '渐变填充应映射为 gradient');
  assert.strictEqual(fillItem.fill.id, 'grad1', '渐变 id 应保真');

  const text = doc.nodes.get(layer.children[1]);
  assert.strictEqual(text.kind, 'Text');
  assert.strictEqual(text.text, '你好');
  assert.strictEqual(text.x, 5);
  assert.strictEqual(text.y, 15);
  assert.strictEqual(text.fontSize, 12);
  assert.strictEqual(text.textAnchor, 'middle');

  const image = doc.nodes.get(layer.children[2]);
  assert.strictEqual(image.kind, 'Image');
  assert.strictEqual(image.x, 1);
  assert.strictEqual(image.y, 2);
  assert.strictEqual(image.width, 30);
  assert.strictEqual(image.height, 40);
  assert.strictEqual(image.href, 'data:image/png;base64,AAAA');

  const use = doc.nodes.get(layer.children[3]);
  assert.strictEqual(use.kind, 'Use');
  assert.strictEqual(use.href, '#sym1');
  assert.strictEqual(use.x, 3);
  assert.strictEqual(use.y, 4);

  const hidden = doc.nodes.get(layer.children[4]);
  assert.strictEqual(hidden.kind, 'Path');
  assert.strictEqual(hidden.visible, false, 'visibility=hidden 应转为 visible=false');
});

// ============================================================================
// 2. 导出 Text/Image/Use + defs 回插（字符串级）
// ============================================================================
it('导出保留 Text/Image/Use 节点类型并回插 <defs>', async () => {
  const base0 = createDocument({ width: 100, height: 100 });
  const layerId = base0.layers[0];
  const nodes = new Map(base0.nodes);
  const idT = makeNodeId(2);
  const idI = makeNodeId(3);
  const idU = makeNodeId(4);
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const baseNode = {
    name: null,
    transform: identity,
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children: [],
  };
  nodes.set(idT, {
    ...baseNode,
    id: idT,
    kind: 'Text',
    text: '你好V2',
    x: 10,
    y: 30,
    fontSize: 18,
    fontFamily: 'serif',
    textAnchor: 'middle',
    appearance: { items: [{ kind: 'fill', fill: { type: 'solid', color: '#123456', opacity: 1 }, blend: 'normal', opacity: 1 }] },
  });
  nodes.set(idI, {
    ...baseNode,
    id: idI,
    kind: 'Image',
    href: 'data:image/png;base64,AAAA',
    x: 5,
    y: 6,
    width: 40,
    height: 50,
    appearance: { items: [] },
  });
  nodes.set(idU, {
    ...baseNode,
    id: idU,
    kind: 'Use',
    href: '#sym9',
    x: 7,
    y: 8,
    width: 20,
    height: 20,
    appearance: { items: [] },
  });
  const layer = nodes.get(layerId);
  nodes.set(layerId, { ...layer, children: [idT, idI, idU] });
  const doc = {
    ...base0,
    nodes,
    nextNodeId: 5,
    metadata: {
      [RAW_DEFS_METADATA_KEY]:
        '<linearGradient id="lg1"><stop offset="0" stop-color="#ffffff"/></linearGradient>',
    },
  };

  const svg = await exportSvgFn(doc);
  assert.ok(svg.includes('<text'), `导出应含 <text：${svg.slice(0, 300)}`);
  assert.ok(svg.includes('你好V2'), '导出应含文本内容');
  assert.ok(svg.includes('text-anchor="middle"'), '导出应含 text-anchor');
  assert.ok(svg.includes('<image'), '导出应含 <image');
  assert.ok(svg.includes('data:image/png;base64,AAAA'), 'image href 应保真');
  assert.ok(svg.includes('<use'), '导出应含 <use');
  assert.ok(svg.includes('#sym9'), 'use href 应保真');
  assert.ok(svg.includes('linearGradient'), '<defs> 原始片段应回插');
  assert.ok(svg.includes('lg1'), 'defs 内 id 应可被引用');
});

// ============================================================================
// 3. exportSync 决策真值矩阵
// ============================================================================
it('shouldExport 真值矩阵：未加载不导出、加载基线不导出、文档变更才导出', () => {
  const a = createDocument({ width: 10, height: 10 });
  const b = createDocument({ width: 10, height: 10 });
  assert.strictEqual(shouldExport({ loaded: false, lastExportedDoc: null }, a), false, '未加载不导出');
  assert.strictEqual(shouldExport({ loaded: false, lastExportedDoc: a }, a), false, '加载中不导出');
  assert.strictEqual(shouldExport({ loaded: true, lastExportedDoc: null }, a), false, '无基线不导出');
  assert.strictEqual(shouldExport({ loaded: true, lastExportedDoc: a }, a), false, '加载基线不回写');
  assert.strictEqual(shouldExport({ loaded: true, lastExportedDoc: a }, b), true, '文档变更应回写');
});

it('shouldReloadFromHost 真值矩阵：首次 / echo 不重载 / 外部变更重载', () => {
  assert.strictEqual(shouldReloadFromHost(null, '<svg/>'), true, '首次加载');
  assert.strictEqual(shouldReloadFromHost('<svg/>', '<svg/>'), false, '自身输出 echo 不重载');
  assert.strictEqual(shouldReloadFromHost('<svg/>', '<svg v="2"/>'), true, '外部变更应重载');
});

it('decideBackup 真值矩阵：仅首个编辑触发一次', () => {
  const always = () => true;
  const never = () => false;
  assert.strictEqual(decideBackup(true, true, '<svg/>', 'v2', always), false, '已备份不再写');
  assert.strictEqual(decideBackup(false, false, '<svg/>', 'v2', always), false, '非首个编辑不写');
  assert.strictEqual(decideBackup(false, true, '<svg/>', 'v2', never), false, '内容判定不通过不写');
  assert.strictEqual(decideBackup(false, true, '<svg/>', 'v2', always), true, '首个编辑且内容判定通过应写');
});

// ============================================================================
// 4. clientToCanvasPoint letterbox
// ============================================================================
it('clientToCanvasPoint 横向 letterbox：扣除左右留白', () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };
  const view = { x: 0, y: 0, width: 100, height: 100 };
  const p = clientToCanvasPoint(50, 10, rect, view);
  assert.strictEqual(p.x, 0, '左留白 50px 应被扣除');
  assert.strictEqual(p.y, 10);
  const q = clientToCanvasPoint(150, 50, rect, view);
  assert.strictEqual(q.x, 100, '右边界应映射到 viewBox 右缘');
  assert.strictEqual(q.y, 50);
});

it('clientToCanvasPoint 纵向 letterbox + viewBox 偏移', () => {
  const rect = { left: 0, top: 0, width: 100, height: 200 };
  const view = { x: 10, y: 20, width: 100, height: 100 };
  const p = clientToCanvasPoint(10, 60, rect, view);
  assert.strictEqual(p.x, 20, 'x = viewBox 偏移 10 + clientX 10（无横向留白）');
  assert.strictEqual(p.y, 30, '上留白 50px 扣除后加偏移 20');
});

it('clientToCanvasPoint 零尺寸返回 null', () => {
  assert.strictEqual(clientToCanvasPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 100, height: 100 }), null);
  assert.strictEqual(clientToCanvasPoint(0, 0, { left: 0, top: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 100 }), null);
});

// ============================================================================
// 5. select 手势状态机
// ============================================================================
function makeGestureRuntime() {
  const runtime = createRuntime();
  const baseDoc = createDocument({ width: 200, height: 200 });
  const r1 = appendToLayer(baseDoc, baseDoc.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(10, 10)), anchorCorner(vec2(50, 30)), anchorCorner(vec2(30, 60))], closed: true }])));
  const r2 = appendToLayer(r1.doc, baseDoc.layers[0], makePath(0, pathGeometry([{ anchors: [anchorCorner(vec2(100, 100)), anchorCorner(vec2(150, 100))], closed: false }])));
  runtime._doc = r2.doc;
  return runtime;
}

it('select 拖拽 down→drag→up 恰写 1 条历史并移动图元', () => {
  const rt = makeGestureRuntime();
  const layer = rt.currentDocument.nodes.get(rt.currentDocument.layers[0]);
  const p1 = layer.children[0];
  const before = rt.history.undo.length;
  rt.dispatchPointer(pointer('down', { x: 20, y: 20 }));
  rt.dispatchPointer(pointer('drag', { x: 40, y: 30 }));
  rt.dispatchPointer(pointer('up', { x: 40, y: 30 }));
  assert.strictEqual(rt.history.undo.length - before, 1, '一次拖拽手势应恰写 1 条历史');
  assert.ok(rt.currentSelection.nodeIds.includes(p1), '命中节点应被选中');
  const moved = rt.currentDocument.nodes.get(p1);
  assert.strictEqual(moved.transform.e, 20, 'delta.x=20 应反映到 transform.e');
  assert.strictEqual(moved.transform.f, 10, 'delta.y=10 应反映到 transform.f');
  const undone = rt.undo();
  assert.strictEqual(undone, true);
  assert.strictEqual(rt.currentDocument.nodes.get(p1).transform.e, 0, 'undo 应回退位移');
});

it('点击选中（down+up 无位移）不写历史', () => {
  const rt = makeGestureRuntime();
  const layer = rt.currentDocument.nodes.get(rt.currentDocument.layers[0]);
  const p1 = layer.children[0];
  const before = rt.history.undo.length;
  rt.dispatchPointer(pointer('down', { x: 20, y: 20 }));
  rt.dispatchPointer(pointer('up', { x: 20, y: 20 }));
  assert.strictEqual(rt.history.undo.length - before, 0, '点击选中不应写历史');
  assert.ok(rt.currentSelection.nodeIds.includes(p1));
});

it('空白处点击清空选择且不写历史', () => {
  const rt = makeGestureRuntime();
  const layer = rt.currentDocument.nodes.get(rt.currentDocument.layers[0]);
  rt.dispatchPointer(pointer('down', { x: 20, y: 20 }));
  rt.dispatchPointer(pointer('up', { x: 20, y: 20 }));
  assert.strictEqual(rt.currentSelection.nodeIds.length, 1);
  const before = rt.history.undo.length;
  rt.dispatchPointer(pointer('down', { x: 190, y: 10 }));
  rt.dispatchPointer(pointer('up', { x: 190, y: 10 }));
  assert.strictEqual(rt.currentSelection.nodeIds.length, 0, '空白点击应清空选择');
  assert.strictEqual(rt.history.undo.length - before, 0, '清空选择不应写历史');
});

it('框选命中集合且不写历史（文档未变）', () => {
  const rt = makeGestureRuntime();
  const layer = rt.currentDocument.nodes.get(rt.currentDocument.layers[0]);
  const p1 = layer.children[0];
  const p2 = layer.children[1];
  const before = rt.history.undo.length;
  rt.dispatchPointer(pointer('down', { x: 0, y: 0 }));
  rt.dispatchPointer(pointer('drag', { x: 200, y: 200 }));
  rt.dispatchPointer(pointer('up', { x: 200, y: 200 }));
  assert.ok(rt.currentSelection.nodeIds.includes(p1), '框选应命中 p1');
  assert.ok(rt.currentSelection.nodeIds.includes(p2), '框选应命中 p2');
  assert.strictEqual(rt.currentSelection.nodeIds.length, 2, '框选应恰命中 2 个图元');
  assert.strictEqual(rt.history.undo.length - before, 0, '纯框选（文档未变）不应写历史');
});

it('框选 overlay 存在且为 marquee 手势产物', () => {
  const rt = makeGestureRuntime();
  rt.dispatchPointer(pointer('down', { x: 0, y: 0 }));
  rt.dispatchPointer(pointer('drag', { x: 80, y: 90 }));
  const overlay = rt.overlay();
  assert.strictEqual(overlay.length, 1, '框选中应有 1 个 overlay');
  assert.strictEqual(overlay[0].kind, 'rect');
  assert.strictEqual(overlay[0].rect.width, 80);
  assert.strictEqual(overlay[0].rect.height, 90);
  rt.dispatchPointer(pointer('up', { x: 80, y: 90 }));
  assert.strictEqual(rt.overlay().length, 0, '手势结束后 overlay 应清空');
});

it('拖拽中 Escape 取消手势：历史不变、文档恢复快照', () => {
  const rt = makeGestureRuntime();
  const beforeDoc = rt.currentDocument;
  const beforeLen = rt.history.undo.length;
  rt.dispatchPointer(pointer('down', { x: 20, y: 20 }));
  rt.dispatchPointer(pointer('drag', { x: 100, y: 80 }));
  assert.notStrictEqual(rt.currentDocument, beforeDoc, '拖拽中应有 preview 生效');
  rt.dispatchKey('Escape', MODS);
  assert.strictEqual(rt.currentDocument, beforeDoc, 'Escape 应恢复 Begin 快照');
  assert.strictEqual(rt.history.undo.length, beforeLen, '取消不应写历史');
  const overlayAfter = rt.overlay();
  assert.strictEqual(overlayAfter.length, 0, '取消后 overlay 应清空');
});

it('删除选中写 1 条历史', () => {
  const rt = makeGestureRuntime();
  const layer = rt.currentDocument.nodes.get(rt.currentDocument.layers[0]);
  const p1 = layer.children[0];
  rt.dispatchPointer(pointer('down', { x: 20, y: 20 }));
  rt.dispatchPointer(pointer('up', { x: 20, y: 20 }));
  const before = rt.history.undo.length;
  rt.dispatchKey('Delete', MODS);
  assert.strictEqual(rt.history.undo.length - before, 1, '删除应写 1 条历史');
  assert.strictEqual(rt.currentDocument.nodes.has(p1), false, '删除后节点应不存在');
});

// ============================================================================
// 6. hitTestTopmost 对 Image 的 bbox 命中
// ============================================================================
it('hitTestTopmost 命中 Image 包围盒内部 / 空白处不命中', () => {
  const baseDoc = createDocument({ width: 200, height: 200 });
  const nodes = new Map(baseDoc.nodes);
  const idI = makeNodeId(2);
  nodes.set(idI, {
    id: idI,
    kind: 'Image',
    name: null,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children: [],
    href: 'data:image/png;base64,AAAA',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    appearance: { items: [] },
  });
  const layerId = baseDoc.layers[0];
  const layer = nodes.get(layerId);
  nodes.set(layerId, { ...layer, children: [idI] });
  const doc = { ...baseDoc, nodes, nextNodeId: 3 };

  const hit = hitTestTopmost(doc, { x: 50, y: 50 }, 5);
  assert.strictEqual(hit, idI, '图片中心应命中');
  const edge = hitTestTopmost(doc, { x: 10, y: 10 }, 5);
  assert.strictEqual(edge, idI, '图片左上角应命中');
  const miss = hitTestTopmost(doc, { x: 180, y: 180 }, 5);
  assert.strictEqual(miss, null, '空白处不应命中');
});

// ============================================================================
// 汇总
// ============================================================================
async function main() {
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✅', t.name);
      passed++;
    } catch (e) {
      console.log('  ❌', t.name, '-', e instanceof Error ? e.message : e);
      failed++;
    }
  }
  console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');
  if (failed > 0) process.exit(1);
}
main();
