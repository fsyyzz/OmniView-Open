#!/usr/bin/env node
/**
 * OmniView SVG 开发者工程工具与数据转换引擎单元测试套件
 * 重点覆盖：元数据解析、XML 合法性校验、Prettify 美化、SVGO 净化压缩、React/Vue 代码生成
 */
import assert from 'node:assert';
import {
  parseSvgStats,
  validateSvg,
  prettifySvg,
  optimizeSvg,
  convertSvgToReact,
  convertSvgToVue,
  convertSvgToDataUri,
  tagSvgWithNodeIds,
  getSvgElementInfo,
  updateSvgElement,
  removeSvgElement,
  findLineInSource,
  moveSvgElementGeometry,
  calculateElementSnapping,
  calculateLineSnapping,
  alignSvgElement,
  alignLineOrthogonal,
  parseSvgDimensions,
} from '../src/features/viewers/components/drivers/svg/svgUtils.ts';

console.log('🧪 开始 SVG 开发者工程工具与转换引擎单元测试...');

// 样本 SVG 包含设计器元数据与注释
const sampleRawSvg = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 27.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     x="0px" y="0px" viewBox="0 0 100 100" width="100px" height="100px" xml:space="preserve">
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description />
    </rdf:RDF>
  </metadata>
  <g id="empty_group"></g>
  <g inkscape:label="Layer 1" data-name="IconGroup">
    <path fill-rule="evenodd" clip-rule="evenodd" stroke-width="2.0000" stroke-linecap="round" stroke-linejoin="round"
          d="M10 10 L90 10 L90 90 L10 90 Z" fill="#3b82f6" />
    <circle cx="50" cy="50" r="30.00" fill="#10b981" />
    <text x="50" y="55" font-size="12" text-anchor="middle" fill="#ffffff">OmniView</text>
  </g>
</svg>`;

// --- 测试 1: SVG 结构元数据解析 ---
console.log('--- 测试 1: SVG 元数据解析 ---');
const stats = parseSvgStats(sampleRawSvg);
assert.strictEqual(stats.viewBox, '0 0 100 100', 'viewBox 应正确提取');
assert.strictEqual(stats.width, '100px', 'width 应正确提取');
assert.strictEqual(stats.height, '100px', 'height 应正确提取');
assert.ok(stats.pathCount >= 1, 'pathCount 应至少为 1');
assert.ok(stats.textCount >= 1, 'textCount 应至少为 1');
assert.ok(stats.byteSize > 0, 'byteSize 应大于 0');
console.log(`✅ SVG 元数据解析测试通过 (节点数: ${stats.elementCount}, 路径: ${stats.pathCount}, 文本: ${stats.textCount})`);

// --- 测试 2: 语法合法性校验 ---
console.log('--- 测试 2: 语法合法性校验 ---');
const emptyRes = validateSvg('');
assert.strictEqual(emptyRes.valid, false, '空文本应判定为无效');

const nonSvgRes = validateSvg('<div>Hello World</div>');
assert.strictEqual(nonSvgRes.valid, false, '非 SVG 标签应判定为无效');

const validRes = validateSvg(sampleRawSvg);
assert.strictEqual(validRes.valid, true, '合法 SVG 应通过校验');

const unclosedSvg = '<svg viewBox="0 0 10 10"><path d="M0 0 L10 10">';
const unclosedRes = validateSvg(unclosedSvg);
assert.strictEqual(unclosedRes.valid, false, '未闭合标签应被拦截');
console.log('✅ 语法合法性与边界容错测试通过');

// --- 测试 3: XML Prettify 格式化 ---
console.log('--- 测试 3: XML Prettify 格式化 ---');
const minified = '<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="red"/><text>Hi</text></svg>';
const prettified = prettifySvg(minified);
assert.ok(prettified.includes('\n'), '格式化后应包含换行');
assert.ok(prettified.includes('  <circle'), '子标签应具备缩进');
console.log('✅ XML 格式化美化测试通过');

// --- 测试 4: SVGO 工程级净化与去冗余 ---
console.log('--- 测试 4: SVGO 工程级净化与去冗余 ---');
const optRes = optimizeSvg(sampleRawSvg);
assert.ok(!optRes.optimized.includes('<?xml'), '优化后应移除 <?xml 声明');
assert.ok(!optRes.optimized.includes('<!-- Generator:'), '优化后应移除注释');
assert.ok(!optRes.optimized.includes('<metadata>'), '优化后应移除 <metadata>');
assert.ok(!optRes.optimized.includes('xmlns:inkscape'), '优化后应移除私有命名空间');
assert.ok(!optRes.optimized.includes('inkscape:label'), '优化后应移除私有属性');
assert.ok(!optRes.optimized.includes('data-name='), '优化后应移除 data-name');
assert.ok(!optRes.optimized.includes('empty_group'), '优化后应移除空 <g> 容器');
assert.ok(optRes.savedBytes > 0, '优化后应节省字节数');
console.log(`✅ SVGO 净化优化测试通过 (原始: ${optRes.originalSize}B -> 优化后: ${optRes.optimizedSize}B, 节省: ${optRes.savedBytes}B, ${optRes.savedPercentage}%)`);

// --- 测试 5: 转换为 React JSX 组件 (TypeScript) ---
console.log('--- 测试 5: React JSX 组件转换 ---');
const reactCode = convertSvgToReact(optRes.optimized, 'SampleIcon');
assert.ok(reactCode.includes("import React from 'react';"), '应包含 React 导入');
assert.ok(reactCode.includes('export const SampleIcon: React.FC'), '应导出指定组件名');
assert.ok(reactCode.includes('strokeWidth='), '连字符属性应转换为 CamelCase (strokeWidth)');
assert.ok(reactCode.includes('fillRule='), '连字符属性应转换为 CamelCase (fillRule)');
assert.ok(reactCode.includes('strokeLinecap='), '连字符属性应转换为 CamelCase (strokeLinecap)');
assert.ok(reactCode.includes('{...props}'), '根标签应注入 props 扩散');
console.log('✅ React JSX 代码生成测试通过');

// --- 测试 6: 转换为 Vue 3 组件与 Data URI ---
console.log('--- 测试 6: Vue 3 组件与 Data URI 转换 ---');
const vueCode = convertSvgToVue(optRes.optimized);
assert.ok(vueCode.includes('<template>'), 'Vue 代码应包含 <template>');
assert.ok(vueCode.includes('<script setup lang="ts">'), 'Vue 代码应包含 script setup');

const dataUri = convertSvgToDataUri('<svg><circle r="1"/></svg>');
assert.ok(dataUri.startsWith('data:image/svg+xml;base64,'), 'Data URI 应以 base64 头开始');
console.log('✅ Vue 3 组件与 Data URI 转换测试通过');

// --- 测试 7 (方案 B): 图元索引打标与选择高亮标记 ---
console.log('--- 测试 7 (方案 B): 图元节点索引打标与点选支持 ---');
const rawSvgToTag = '<svg viewBox="0 0 100 100"><rect x="0" y="0" width="10" height="10"/><circle cx="20" cy="20" r="5"/><path d="M0 0 L10 10"/></svg>';
const taggedSvg = tagSvgWithNodeIds(rawSvgToTag, 1);
assert.ok(taggedSvg.includes('data-omni-id="0"'), '第 0 个图元应被注入 data-omni-id="0"');
assert.ok(taggedSvg.includes('data-omni-id="1"'), '第 1 个图元应被注入 data-omni-id="1"');
assert.ok(taggedSvg.includes('data-omni-selected="true"'), '被选中的第 1 个图元应被打上 data-omni-selected="true"');
console.log('✅ 图元节点打标与选中属性注入测试通过');

// --- 测试 8 (方案 B): 图元详细属性提取与源码行号定位 ---
console.log('--- 测试 8 (方案 B): 图元属性提取与代码行号反向索引 ---');
const elementInfo = getSvgElementInfo(rawSvgToTag, 1);
assert.ok(elementInfo !== null, '图元信息提取不应为空');
assert.strictEqual(elementInfo.tagName, 'circle', '图元标签名提取应为 circle');
assert.strictEqual(elementInfo.cx, '20', 'cx 属性提取正确');
assert.strictEqual(elementInfo.r, '5', 'r 属性提取正确');
assert.ok(elementInfo.lineInSource >= 1, '行号定位应大于等于 1');

const lineNum = findLineInSource('line 1\n<path id="my-path" d="M1 1"/>\nline 3', 'path', 'my-path');
assert.strictEqual(lineNum, 2, '根据 ID 查找源码行号应准确命中第 2 行');
console.log('✅ 图元属性提取与行号定位测试通过');

// --- 测试 9 (方案 B): 图元属性微调与回写更新 ---
console.log('--- 测试 9 (方案 B): 图元属性微调与反向序列化 ---');
const updatedSvg = updateSvgElement(rawSvgToTag, 0, { fill: '#ff0000', stroke: '#00ff00', strokeWidth: '2' });
assert.ok(updatedSvg.includes('fill="#ff0000"') || updatedSvg.includes('fill=\'#ff0000\''), '更新后的 SVG 应包含新 fill');
assert.ok(updatedSvg.includes('stroke="#00ff00"'), '更新后的 SVG 应包含新 stroke');
assert.ok(updatedSvg.includes('stroke-width="2"'), '更新后的 SVG 应包含新 stroke-width');
console.log('✅ 图元属性微调与回写更新测试通过');

// --- 测试 10 (方案 B): 图元删除与图层移除 ---
console.log('--- 测试 10 (方案 B): 图元删除与图层移除 ---');
const removedSvg = removeSvgElement(rawSvgToTag, 0); // 删除 rect
assert.ok(!removedSvg.includes('<rect'), '删除第 0 个图元后不应再包含 rect');
assert.ok(removedSvg.includes('<circle'), '删除 rect 后 circle 仍应完好保留');
console.log('✅ 图元删除与图层移除测试通过');

// --- 测试 11: 鼠标拖拽几何位移计算 (moveSvgElementGeometry) ---
console.log('--- 测试 11: 鼠标拖拽几何位移计算 ---');
const lineSvg = `<svg width="200" height="200"><line x1="10" y1="20" x2="100" y2="20" stroke="black"/><rect x="50" y="50" width="30" height="30"/></svg>`;
const movedLineSvg = moveSvgElementGeometry(lineSvg, 0, 15, -5);
assert.ok(movedLineSvg.includes('x1="25"'), 'line x1 应平移 15 变成 25');
assert.ok(movedLineSvg.includes('y1="15"'), 'line y1 应平移 -5 变成 15');
assert.ok(movedLineSvg.includes('x2="115"'), 'line x2 应平移 15 变成 115');
assert.ok(movedLineSvg.includes('y2="15"'), 'line y2 应平移 -5 变成 15');

const movedRectSvg = moveSvgElementGeometry(lineSvg, 1, 10, 20);
assert.ok(movedRectSvg.includes('x="60"'), 'rect x 应平移 10 变成 60');
assert.ok(movedRectSvg.includes('y="70"'), 'rect y 应平移 20 变成 70');
console.log('✅ 鼠标拖拽几何位移计算测试通过');

// --- 测试 12: 智能吸附与参考线计算 (calculateElementSnapping) ---
console.log('--- 测试 12: 智能吸附与参考线计算 ---');
const canvasBounds = { minX: 0, minY: 0, width: 200, height: 200 };
const initialBBox = { x: 2, y: 50, width: 40, height: 40 };
// 拖拽向左移 4px，目标 x 接近 -2px，靠近画布左边缘 0
const snapResult = calculateElementSnapping(
  initialBBox,
  -4,
  0,
  canvasBounds,
  [], // 无兄弟节点
  8,  // 阈值 8px
  false
);
assert.strictEqual(snapResult.deltaX, -2, '应自动吸附到画布左边缘 x=0 (deltaX 从 -4 校准为 -2)');
assert.ok(snapResult.guides.length > 0, '发生吸附时应生成辅助参考线');
assert.strictEqual(snapResult.guides[0].type, 'vertical', '左边缘吸附为垂直参考线');
assert.ok(snapResult.guides[0].label.includes('画布左边缘'), '吸附标签正确');
console.log('✅ 智能吸附与参考线计算测试通过');

// --- 测试 13: 线条端点微调与正交化校准 (calculateLineSnapping & alignLineOrthogonal) ---
console.log('--- 测试 13: 线条端点微调与正交化校准 ---');
// 几乎水平的线条 (斜率接近 0)
const nearHorizontalLine = { p1: { x: 10, y: 20 }, p2: { x: 100, y: 22 } };
const lineSnapResult = calculateLineSnapping(
  nearHorizontalLine.p1,
  nearHorizontalLine.p2,
  'p2',
  canvasBounds,
  [],
  8
);
assert.strictEqual(lineSnapResult.p2.y, 20, '端点微调在接近水平时应自动吸附到 y=20 (水平对齐)');
assert.ok(lineSnapResult.guides.some(g => g.label.includes('水平')), '应包含水平对齐辅助参考提示');

// 一键强制水平正交化
const orthoSvg = alignLineOrthogonal(lineSvg, 0, 'horizontal');
assert.ok(orthoSvg.includes('y2="20"'), '正交化后 y2 应与 y1 保持一致 (20)');
console.log('✅ 线条端点微调与正交化校准测试通过');

// --- 测试 14: 快速对齐到画布视口 (alignSvgElement) ---
console.log('--- 测试 14: 快速对齐到画布视口 ---');
const alignedSvgCenter = alignSvgElement(lineSvg, 1, 'center', { x: 50, y: 50, width: 30, height: 30 });
// 画布宽度 200，中心 100，rect 宽 30，居中时 x = 100 - 15 = 85
assert.ok(alignedSvgCenter.includes('x="85"'), '居中对齐时 x 应被精确计算为 85');
console.log('✅ 快速对齐到画布视口测试通过');

console.log('🎉 全部 14 组 SVG 开发者工程引擎、拖拽微调与智能吸附测试用例 100% 通过！\n');
