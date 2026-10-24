#!/usr/bin/env node
/**
 * OmniView Excalidraw 解析与高保真数据驱动测试
 */
import assert from 'node:assert';
import { parseExcalidrawJson } from '../src/features/viewers/components/drivers/excalidraw/excalidrawEngine.ts';

console.log('🧪 开始 Excalidraw 格式解析与数据自愈单元测试...');

// 1. 测试标准 Excalidraw 文档对象
console.log('--- 测试 1: 标准 Excalidraw 文档解析 ---');
const standardDoc = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements: [
    { id: 'el-1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50 },
    { id: 'el-2', type: 'text', x: 20, y: 20, text: 'Sample' }
  ],
  appState: {
    viewBackgroundColor: '#ffffff',
    exportWithDarkMode: false
  },
  files: {}
});

const res1 = parseExcalidrawJson(standardDoc);
assert.strictEqual(res1.isValid, true, '标准文档应解析成功');
assert.strictEqual(res1.elements.length, 2, '元素数量应为 2');
assert.strictEqual(res1.appState.viewBackgroundColor, '#ffffff');
console.log('✅ 标准 Excalidraw 文档解析通过');

// 2. 测试纯元素数组降级解析
console.log('--- 测试 2: 纯元素数组降级自愈 ---');
const arrayDoc = JSON.stringify([
  { id: 'item-1', type: 'ellipse', x: 0, y: 0, width: 80, height: 80 }
]);

const res2 = parseExcalidrawJson(arrayDoc);
assert.strictEqual(res2.isValid, true, '纯数组应自动包装成功');
assert.strictEqual(res2.elements.length, 1);
assert.strictEqual(res2.elements[0].id, 'item-1');
console.log('✅ 纯元素数组自愈通过');

// 3. 测试空内容安全默认态
console.log('--- 测试 3: 空文档默认态 ---');
const res3 = parseExcalidrawJson('');
assert.strictEqual(res3.isValid, true);
assert.strictEqual(res3.elements.length, 0);
console.log('✅ 空文档安全解析通过');

// 4. 测试语法异常捕获与错误提示
console.log('--- 测试 4: 语法异常捕获 ---');
const badDoc = '{"type": "excalidraw", "elements": [bad json';
const res4 = parseExcalidrawJson(badDoc);
assert.strictEqual(res4.isValid, false, '语法错误应标记 isValid 为 false');
assert.ok(res4.errorMessage, '应输出错误诊断信息');
console.log('✅ 语法异常捕获与错误抛出测试通过');

// 5. 测试预置模板库的合法性与数据完整性
console.log('--- 测试 5: 预置模板库完整性与解析校验 ---');
import {
  EXCALIDRAW_TEMPLATES,
  EXCALIDRAW_STENCILS,
} from '../src/features/viewers/components/drivers/excalidraw/excalidrawTemplates.ts';
import {
  embedExcalidrawPayloadInSvg,
  extractExcalidrawPayloadFromSvg,
  convertMermaidToExcalidraw,
  getFramesFromElements,
  autoCreateFrames,
  detectDanglingArrows,
} from '../src/features/viewers/components/drivers/excalidraw/excalidrawEngine.ts';

assert.ok(Array.isArray(EXCALIDRAW_TEMPLATES) && EXCALIDRAW_TEMPLATES.length >= 4, '模板库应包含至少4种预置模板');
for (const tmpl of EXCALIDRAW_TEMPLATES) {
  assert.ok(tmpl.id && tmpl.name && tmpl.data, `模板 ${tmpl.id} 结构必须完整`);
  const tmplJson = JSON.stringify(tmpl.data);
  const parsed = parseExcalidrawJson(tmplJson);
  assert.strictEqual(parsed.isValid, true, `模板 ${tmpl.id} 数据必须能被有效解析`);
  assert.strictEqual(parsed.elements.length, tmpl.data.elements.length);
}
console.log('✅ 预置模板库完整性校验全部通过');

// 6. 测试 .excalidraw.svg 自包含双模嵌入与反向提取
console.log('--- 测试 6: .excalidraw.svg 自包含双模嵌入与反向提取 ---');
const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100"/></svg>`;
const testDoc = {
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'rect-1', type: 'rectangle', x: 20, y: 20, width: 60, height: 60 }],
  appState: { viewBackgroundColor: '#ffffff' }
};
const embeddedSvg = embedExcalidrawPayloadInSvg(rawSvg, testDoc);
assert.ok(embeddedSvg.includes('omniview-excalidraw-payload'), 'SVG 中必须包含自包含 payload 标识');

// 直接使用 parseExcalidrawJson 解析嵌入型 SVG 文本
const parsedFromSvg = parseExcalidrawJson(embeddedSvg);
assert.strictEqual(parsedFromSvg.isValid, true, '自包含 SVG 必须被 parseExcalidrawJson 识别');
assert.strictEqual(parsedFromSvg.elements.length, 1, '应成功提取内部的 Excalidraw 图元');
assert.strictEqual(parsedFromSvg.elements[0].id, 'rect-1');
console.log('✅ .excalidraw.svg 自包含双模隐写与反向解析通过');

// 7. 测试 Mermaid Flowchart 转译为手绘 Excalidraw
console.log('--- 测试 7: Mermaid Flowchart 转译器 ---');
const mermaidSource = `
flowchart TD
  Client[客户端 App] --> GW{API 网关}
  GW -->|路由| Service[Order 核心微服务]
  Service --> DB[(MySQL 集群)]
`;
const converted = convertMermaidToExcalidraw(mermaidSource);
assert.ok(converted.elements.length >= 4, '应生成至少 4 个图形图元及文字');
// 检查是否有菱形判断节点、矩形节点和箭头
const hasDiamond = converted.elements.some(el => el.type === 'diamond');
const hasArrow = converted.elements.some(el => el.type === 'arrow');
assert.strictEqual(hasDiamond, true, '应正确识别 {API 网关} 为 diamond 形状');
assert.strictEqual(hasArrow, true, '应生成手绘连线箭头');
console.log('✅ Mermaid Flowchart 转译手绘白板图元通过');

// 8. 测试 Frame 提取与智能划框算法
console.log('--- 测试 8: Frame 提取与智能划框算法 ---');
const sampleElementsWithFrame = [
  { id: 'f-1', type: 'frame', name: 'Stage 1', x: 0, y: 0, width: 200, height: 200 },
  { id: 'box-1', type: 'rectangle', x: 10, y: 10, width: 100, height: 80 }
];
const frames = getFramesFromElements(sampleElementsWithFrame);
assert.strictEqual(frames.length, 1, '应准确过滤出 1 个 frame');
assert.strictEqual(frames[0].id, 'f-1');

// 测试无 Frame 时智能划框
const elementsNoFrame = [
  { id: 'box-a', type: 'rectangle', x: 50, y: 50, width: 100, height: 80 },
  { id: 'box-b', type: 'rectangle', x: 250, y: 150, width: 120, height: 60 }
];
const withAutoFrame = autoCreateFrames(elementsNoFrame);
assert.strictEqual(withAutoFrame.length, 3, '应追加一个覆盖全体图元的 Frame');
assert.strictEqual(withAutoFrame[0].type, 'frame');
assert.ok(withAutoFrame[0].width >= 320, 'Frame 尺寸应能容纳子图元');
console.log('✅ Frame 提取与智能演播划框算法通过');

// 9. 测试连线拓扑健康诊断
console.log('--- 测试 9: 连线拓扑健康诊断 ---');
const elementsWithDangling = [
  { id: 'node-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 },
  {
    id: 'arrow-valid',
    type: 'arrow',
    startBinding: { elementId: 'node-1' },
    endBinding: { elementId: 'node-1' }
  },
  {
    id: 'arrow-dangling',
    type: 'arrow',
    startBinding: { elementId: 'node-1' },
    endBinding: null
  }
];
const diag = detectDanglingArrows(elementsWithDangling);
assert.strictEqual(diag.arrowCount, 2, '共计 2 条连线');
assert.strictEqual(diag.danglingCount, 1, '存在 1 条悬空连线');
assert.strictEqual(diag.danglingIds[0], 'arrow-dangling');
console.log('✅ 连线拓扑健康诊断通过');

// 10. 测试架构物料库 (EXCALIDRAW_STENCILS) 完整性
console.log('--- 测试 10: 架构物料图元资产库 ---');
assert.ok(Array.isArray(EXCALIDRAW_STENCILS) && EXCALIDRAW_STENCILS.length >= 4, '应包含丰富的架构物料');
for (const stencil of EXCALIDRAW_STENCILS) {
  assert.ok(stencil.id && stencil.name && stencil.elements.length > 0, `物料 ${stencil.id} 数据结构必须完整`);
}
console.log('✅ 架构物料图元资产库校验全部通过');

// 11. 测试 PC Studio 确定性手绘矢量路径与 Hachure 斜线填充引擎
console.log('--- 测试 11: PC Studio 确定性手绘路径与 Hachure 填充引擎 ---');
import {
  generateRoughRectPath,
  generateRoughDiamondPath,
  generateRoughEllipsePath,
  generateHachureFillPath,
  getElementBounds,
  hitTestElements,
  getElementsInMarquee,
  computeSmartSnap,
  findNearestSnapPort,
  syncBoundElementsAfterTransform,
  alignAndDistributeElements,
  reorderElementsLayer,
  cloneSelectedElements,
  groupSelectedElements,
  ungroupSelectedElements,
} from '../src/features/viewers/components/drivers/excalidraw/excalidrawStudioEngine.ts';

const pathA = generateRoughRectPath(10, 20, 120, 60, 1, true, 42);
const pathB = generateRoughRectPath(10, 20, 120, 60, 1, true, 42);
assert.strictEqual(pathA, pathB, '相同 seed 的手绘矩形路径必须 100% 确定性一致，避免拖拽闪烁');
const diamondPath = generateRoughDiamondPath(0, 0, 100, 80, 1, 99);
const ellipsePath = generateRoughEllipsePath(0, 0, 100, 80, 1, 99);
const hachurePath = generateHachureFillPath(10, 20, 120, 60, 'hachure', 1, 42, 'rectangle');
assert.ok(diamondPath.startsWith('M '), '菱形手绘路径应生成有效 SVG Path');
assert.ok(ellipsePath.startsWith('M '), '椭圆手绘路径应生成有效 SVG Path');
assert.ok(hachurePath.length > 20, 'Hachure 手绘排线应生成多条斜线 Path');
console.log('✅ 确定性手绘路径与 Hachure 填充引擎测试通过');

// 12. 测试命中检测 (Hit-Testing) 与框选群组连带选中
console.log('--- 测试 12: 命中检测与框选群组连带选中 ---');
const studioElements = [
  { id: 'n1', type: 'rectangle', x: 50, y: 50, width: 100, height: 60, groupIds: ['g1'] },
  { id: 'n2', type: 'ellipse', x: 250, y: 50, width: 100, height: 60, groupIds: ['g1'] },
  { id: 'n3', type: 'diamond', x: 50, y: 200, width: 100, height: 60, groupIds: [] },
];
const hitN1 = hitTestElements(studioElements, 80, 80);
assert.strictEqual(hitN1?.id, 'n1', '点击 (80,80) 应准确命中 n1');
const marqueeIds = getElementsInMarquee(studioElements, 40, 40, 160, 120);
assert.ok(marqueeIds.includes('n1') && marqueeIds.includes('n2'), '框选命中群组内任一节点时应自动连带选中同组节点 n2');
assert.strictEqual(marqueeIds.includes('n3'), false, '未在框选范围内的独立节点不应被选中');
console.log('✅ 命中检测与框选群组连带选中通过');

// 13. 测试智能参考线吸附 (Smart Snap Guides)
console.log('--- 测试 13: 智能参考线磁吸对齐 ---');
const targetBox = { id: 'target', type: 'rectangle', x: 100, y: 100, width: 120, height: 60 };
const movingBounds = getElementBounds({ id: 'moving', type: 'rectangle', x: 103, y: 220, width: 120, height: 60 });
const snapRes = computeSmartSnap(movingBounds, [targetBox], 6);
assert.strictEqual(snapRes.dx, -3, '相差 3px 时应自动生成 -3px 水平吸附修正量以对齐 X=100');
assert.ok(snapRes.guides.some(g => g.type === 'vertical' && g.pos === 100), '应生成 X=100 的垂直智能参考线');
console.log('✅ 智能参考线磁吸对齐通过');

// 14. 测试 8 向多选对齐与水平/垂直等距分布
console.log('--- 测试 14: 多选对齐与等距分布算法 ---');
const alignInput = [
  { id: 'a1', type: 'rectangle', x: 20, y: 40, width: 80, height: 40 },
  { id: 'a2', type: 'rectangle', x: 140, y: 95, width: 80, height: 40 },
  { id: 'a3', type: 'rectangle', x: 320, y: 10, width: 80, height: 40 },
];
const alignedTop = alignAndDistributeElements(alignInput, new Set(['a1', 'a2', 'a3']), 'align-top');
assert.strictEqual(alignedTop[0].y, 10, '顶对齐后 a1.y 应等于最高元素 y=10');
assert.strictEqual(alignedTop[1].y, 10, '顶对齐后 a2.y 应等于最高元素 y=10');
const distributedH = alignAndDistributeElements(alignInput, new Set(['a1', 'a2', 'a3']), 'distribute-horizontal');
const c1 = getElementBounds(distributedH[0]).cx;
const c2 = getElementBounds(distributedH[1]).cx;
const c3 = getElementBounds(distributedH[2]).cx;
assert.strictEqual(Math.round(c2 - c1), Math.round(c3 - c2), '水平等距分布后相邻元素中心间距必须相等');
console.log('✅ 多选对齐与等距分布算法通过');

// 15. 测试箭头锚点磁吸与节点移动后连线/容器内联文字自动跟随重算
console.log('--- 测试 15: 箭头磁吸锚点与拓扑跟随重算 ---');
const topoElements = [
  { id: 'box-src', type: 'rectangle', x: 100, y: 100, width: 120, height: 60, boundElements: [{ id: 'txt-src', type: 'text' }, { id: 'arr-1', type: 'arrow' }] },
  { id: 'txt-src', type: 'text', containerId: 'box-src', text: 'API Gateway', fontSize: 16, x: 110, y: 120, width: 100, height: 22 },
  { id: 'box-dst', type: 'rectangle', x: 400, y: 100, width: 120, height: 60, boundElements: [{ id: 'arr-1', type: 'arrow' }] },
  {
    id: 'arr-1',
    type: 'arrow',
    x: 220,
    y: 130,
    width: 180,
    height: 0,
    points: [[0, 0], [180, 0]],
    startBinding: { elementId: 'box-src', port: 'e' },
    endBinding: { elementId: 'box-dst', port: 'w' },
  },
];
const nearPort = findNearestSnapPort(topoElements, 222, 128, 20);
assert.strictEqual(nearPort?.elementId, 'box-src', '靠近东侧边缘应吸附到 box-src');
assert.strictEqual(nearPort?.port, 'e', '应准确识别为东侧锚点 (port: e)');

// 将 box-dst 移动到 (500, 260)，验证绑定箭头与容器文字自动同步
const movedTopo = topoElements.map(el => (el.id === 'box-dst' ? { ...el, x: 500, y: 260 } : el));
const syncedTopo = syncBoundElementsAfterTransform(movedTopo);
const updatedArrow = syncedTopo.find(el => el.id === 'arr-1');
assert.strictEqual(updatedArrow.x, 220, '箭头起点应保持在 box-src 东侧 (220,130)');
assert.strictEqual(updatedArrow.x + updatedArrow.points[1][0], 500, '箭头终点 X 应自动跟随移动到 box-dst 西侧 500');
assert.strictEqual(updatedArrow.y + updatedArrow.points[1][1], 290, '箭头终点 Y 应自动跟随移动到 box-dst 西侧中心 290');
console.log('✅ 箭头磁吸锚点与节点移动拓扑跟随重算通过');

// 16. 测试图层顺序、克隆副本与编组解组
console.log('--- 测试 16: 图层排序、克隆与编组解组 ---');
const layered = reorderElementsLayer(alignInput, new Set(['a1']), 'front');
assert.strictEqual(layered[layered.length - 1].id, 'a1', '置于顶层后 a1 应位于数组末尾');
const grouped = groupSelectedElements(alignInput, new Set(['a1', 'a2']));
assert.strictEqual(grouped[0].groupIds.length, 1, '编组后应生成共享 groupId');
assert.strictEqual(grouped[0].groupIds[0], grouped[1].groupIds[0], '同组元素 groupId 必须一致');
const ungrouped = ungroupSelectedElements(grouped, new Set(['a1', 'a2']));
assert.strictEqual(ungrouped[0].groupIds.length, 0, '解组后 groupIds 应清空');
const clonedRes = cloneSelectedElements(alignInput, new Set(['a1']), 30, 30);
assert.strictEqual(clonedRes.nextElements.length, 4, '克隆后图元总数应 +1');
assert.strictEqual(clonedRes.nextElements[3].x, 50, '克隆图元 X 坐标应偏移 +30');
console.log('✅ 图层排序、克隆与编组解组测试通过');

console.log('🎉 Excalidraw 全部 16 组全能套件单元测试 100% 全部通过！\n');

