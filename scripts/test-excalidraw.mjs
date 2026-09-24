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

console.log('🎉 Excalidraw 全部 10 组全能套件单元测试 100% 全部通过！\n');
