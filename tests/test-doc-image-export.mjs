#!/usr/bin/env node
/**
 * 单元测试: exportEngine Word (.doc) 导出外链图形与内嵌位图光栅化契约
 * 验证:
 * 1. exportToWordDocument 针对 Canvas/SVG/IMG 的全链路内嵌转换契约
 * 2. convertImageSourceToBase64 针对 DataURI、SVG DataURI、外链网络图与 PlantUML 架构图的转换逻辑
 * 3. Word MSO 模板样式中对图片、KaTeX 公式与 Callout 的白底印刷规范
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const exportEngineCode = read('src/features/viewers/lib/exportEngine.ts');

console.log('🧪 开始 Word (.doc) 导出外链图形与内嵌位图光栅化单元测试...');

// 测试 1: 验证 exportEngine.ts 导入了样式固化与转光栅化引擎
console.log('--- 测试 1: 核心转图引擎依赖契约 ---');
assert.match(
  exportEngineCode,
  /import\s*\{[^}]*solidifySvgElement[^}]*\}\s*from/,
  'exportEngine 必须引入 solidifySvgElement 进行 SVG 样式固化与 foreignObject 逆向'
);
assert.match(
  exportEngineCode,
  /import\s*\{[^}]*convertSvgToDataUrl[^}]*\}\s*from/,
  'exportEngine 必须引入 convertSvgToDataUrl 进行高清白底位图渲染'
);
console.log('✅ 1. 核心转图依赖契约检查通过');

// 测试 2: 验证 convertImageSourceToBase64 函数存在并正确导出
console.log('\n--- 测试 2: convertImageSourceToBase64 转换器契约 ---');
assert.match(
  exportEngineCode,
  /export\s+async\s+function\s+convertImageSourceToBase64\s*\(/,
  'exportEngine 必须导出 convertImageSourceToBase64 供外链图片处理与测试'
);
assert.match(
  exportEngineCode,
  /data:image[\\/]+(png|jpeg|jpg|gif|bmp)/i,
  'convertImageSourceToBase64 必须直接复用已是 Base64 光栅图的数据'
);
assert.match(
  exportEngineCode,
  /data:image\/svg\+xml/,
  'convertImageSourceToBase64 必须识别 SVG DataURI 并转为 PNG'
);
assert.match(
  exportEngineCode,
  /liveImg\.naturalWidth/,
  'convertImageSourceToBase64 优先读取真实 DOM 宿主 liveImg 的像素缓存'
);
assert.match(
  exportEngineCode,
  /plantuml\.com/,
  'convertImageSourceToBase64 具备针对 PlantUML 远程图表与 PNG 降级端点的兼容处理'
);
console.log('✅ 2. convertImageSourceToBase64 接口与逻辑契约检查通过');

// 测试 3: 验证 exportToWordDocument 的三大图元内联与清洗流程
console.log('\n--- 测试 3: exportToWordDocument 图元三级转换流契约 ---');
assert.match(
  exportEngineCode,
  /clone\.querySelectorAll\(['"]canvas['"]\)/,
  'exportToWordDocument 必须查询并处理所有 Canvas 元素 (如 ECharts/画布)'
);
assert.match(
  exportEngineCode,
  /clone\.querySelectorAll\(['"]svg['"]\)/,
  'exportToWordDocument 必须查询并处理所有 SVG 元素 (Mermaid/Graphviz/Markmap)'
);
assert.match(
  exportEngineCode,
  /clone\.querySelectorAll\(['"]img['"]\)/,
  'exportToWordDocument 必须查询并深度处理所有 <img> 元素 (外链图片/PlantUML/Blob)'
);
assert.match(
  exportEngineCode,
  /convertImageSourceToBase64\s*\(\s*src\s*,\s*liveImg\s*\)/,
  'exportToWordDocument 必须调用 convertImageSourceToBase64 将外链图片转为嵌入式 Base64'
);
assert.match(
  exportEngineCode,
  /img\.removeAttribute\(['"]onerror['"]\)/,
  'exportToWordDocument 必须剔除图片的 onerror 事件等运行期污染'
);
assert.match(
  exportEngineCode,
  /img\.classList\.remove\(['"]ov-img-broken['"]\)/,
  'exportToWordDocument 必须清除断链 class，保证 Word 打开干净无黑框'
);
console.log('✅ 3. exportToWordDocument 图元三级转换流契约检查通过');

// 测试 4: 验证 Word HTML 模板中的样式完备性
console.log('\n--- 测试 4: Word MSO 模板样式契约 ---');
assert.match(
  exportEngineCode,
  /\.katex\s*\{[^}]*font-family/s,
  'Word MSO 模板必须包含 KaTeX 公式专属字体样式定义'
);
assert.match(
  exportEngineCode,
  /\.ov-callout\s*\{[^}]*border-left/s,
  'Word MSO 模板必须包含 Callout 语义块边框样式'
);
assert.match(
  exportEngineCode,
  /\.ov-callout-note\s*\{[^}]*border-left-color/s,
  'Word MSO 模板必须包含 Note 类型的 Callout 颜色'
);
assert.match(
  exportEngineCode,
  /\.ov-callout-warning\s*\{[^}]*border-left-color/s,
  'Word MSO 模板必须包含 Warning 类型的 Callout 颜色'
);
console.log('✅ 4. Word MSO 模板样式契约检查通过');

console.log('\n🎉 Word (.doc) 导出外链图形与内嵌位图光栅化单元测试全部顺利通过！');
