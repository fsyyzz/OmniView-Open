#!/usr/bin/env node
/**
 * OmniView SVG 自适应排版引擎自动化单元测试套件
 * 作者: 周赞
 */
import assert from 'node:assert';
import { prepareAdaptiveSvg } from '../src/features/viewers/lib/svgResponsiveHelper.ts';

console.log('🧪 开始 SVG 自适应排版引擎自动化单元测试...');

// 测试 1: 拥有标准 viewBox 的 SVG 规范化与自适应
console.log('--- 测试 1: 标准 viewBox SVG 自适应属性注入 ---');
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 980" width="100%" height="980"><rect width="1320" height="980" fill="#fff"/></svg>`;
const res1 = prepareAdaptiveSvg(standardSvg);
assert.strictEqual(res1.hasViewBox, true);
assert.strictEqual(res1.intrinsicWidth, 1320);
assert.strictEqual(res1.intrinsicHeight, 980);
assert.ok(res1.svgHtml.includes('viewBox="0 0 1320 980"'));
assert.ok(res1.svgHtml.includes('preserveAspectRatio="xMidYMid meet"'));
assert.ok(res1.svgHtml.includes('max-width: 100%'));
assert.ok(res1.svgHtml.includes('height: auto'));
console.log('✅ 标准 viewBox SVG 规范化与自适应测试通过');

// 测试 2: 缺失 viewBox 但有绝对像素宽高 (例如第三方工具或 CAD/Visio 导出) 自动补全
console.log('--- 测试 2: 自动推导并补全缺失的 viewBox ---');
const noViewBoxSvg = `<svg width="800" height="600"><circle cx="400" cy="300" r="100"/></svg>`;
const res2 = prepareAdaptiveSvg(noViewBoxSvg);
assert.strictEqual(res2.hasViewBox, true);
assert.strictEqual(res2.intrinsicWidth, 800);
assert.strictEqual(res2.intrinsicHeight, 600);
assert.ok(res2.svgHtml.includes('viewBox="0 0 800 600"'));
assert.ok(res2.svgHtml.includes('width="100%"'));
assert.ok(res2.svgHtml.includes('preserveAspectRatio="xMidYMid meet"'));
console.log('✅ 缺失 viewBox 自动补全测试通过: 800x600 -> viewBox="0 0 800 600"');

// 测试 3: 带 pt 单位 (Point) 的印刷图纸矢量转换
console.log('--- 测试 3: pt 等非像素物理单位转换与自适应 ---');
const ptSvg = `<svg width="600pt" height="450pt"><path d="M0 0 L100 100"/></svg>`;
const res3 = prepareAdaptiveSvg(ptSvg);
assert.strictEqual(res3.hasViewBox, true);
assert.strictEqual(res3.intrinsicWidth, 799.8); // 600 * 1.333
assert.ok(res3.svgHtml.includes('viewBox="0 0 799.8 599.85"'));
console.log('✅ pt 物理单位换算测试通过');

// 测试 4: 清理内联 style 中写死的固定绝对尺寸
console.log('--- 测试 4: 内联 style 深度脱敏与自适应覆写 ---');
const styledSvg = `<svg viewBox="0 0 500 300" style="width: 500px; height: 300px; background: #000;"><rect/></svg>`;
const res4 = prepareAdaptiveSvg(styledSvg);
assert.ok(!res4.svgHtml.includes('width: 500px'));
assert.ok(!res4.svgHtml.includes('height: 300px'));
assert.ok(res4.svgHtml.includes('background: #000'));
assert.ok(res4.svgHtml.includes('max-width: 100%'));
assert.ok(res4.svgHtml.includes('height: auto'));
console.log('✅ 内联 style 脱敏与自适应覆写测试通过');

// 测试 5: 边界容错 (空输入、非 SVG 文本、异常数据防崩)
console.log('--- 测试 5: 边界容错与安全降级 ---');
const emptyRes = prepareAdaptiveSvg('');
assert.strictEqual(emptyRes.hasViewBox, false);
assert.strictEqual(emptyRes.svgHtml, '');

const invalidRes = prepareAdaptiveSvg('<div>not an svg</div>');
assert.strictEqual(invalidRes.hasViewBox, false);
assert.strictEqual(invalidRes.svgHtml, '<div>not an svg</div>');
console.log('✅ 异常数据防崩测试通过');

console.log('\n🎉 全部 5 项 SVG 自适应排版引擎自动化测试 100% 通过！\n');
