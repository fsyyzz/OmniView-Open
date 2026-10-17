import assert from 'node:assert';
import {
  evaluatePrintMacro,
  generateA4PrintCss,
  DEFAULT_A4_OPTIONS,
} from '../src/features/viewers/lib/a4TypographyEngine.ts';

console.log('🧪 开始 A4 2.0 工业级出版排版与高精度打印引擎单元测试...');

// 1. 动态宏变量替换测试
console.log('--- 测试 1: 页眉页脚宏变量解析与替换 ---');
const context = {
  pageNumber: 3,
  totalPages: 12,
  documentTitle: 'OmniView Architecture Whitepaper',
  author: '',
  date: '2026-09-11',
  filename: 'whitepaper.typ',
};

assert.strictEqual(
  evaluatePrintMacro('{documentTitle} | {date}', context),
  'OmniView Architecture Whitepaper | 2026-09-11'
);

assert.strictEqual(
  evaluatePrintMacro('Page {pageNumber} of {totalPages}', context),
  'Page 3 of 12'
);

assert.strictEqual(
  evaluatePrintMacro('- {page} -', context),
  '- 3 -'
);

assert.strictEqual(
  evaluatePrintMacro('{filename} by {author}', context),
  'whitepaper.typ by '
);
console.log('✅ 动态宏变量解析与替换测试通过');

// 2. 宏变量空值与容错测试
console.log('--- 测试 2: 宏变量空值与容错边界 ---');
assert.strictEqual(evaluatePrintMacro('', context), '');
assert.strictEqual(evaluatePrintMacro('{unknownVar}', context), '{unknownVar}');
assert.strictEqual(evaluatePrintMacro('Plain Text Without Macro', context), 'Plain Text Without Macro');
console.log('✅ 宏变量容错边界测试通过');

// 3. A4 打印 CSS 生成与页面规则校验
console.log('--- 测试 3: @page 规则与跨页防截断 CSS 生成 ---');
const standardCss = generateA4PrintCss();
assert.ok(standardCss.includes('@page {'), '必须包含 @page 容器');
assert.ok(standardCss.includes('size: A4 portrait'), '必须声明 A4 纵向排版');
assert.ok(standardCss.includes('break-inside: avoid'), '必须包含防截断规则');
assert.ok(standardCss.includes('break-before: page'), '必须包含物理分页符 break 规则');
console.log('✅ 标准 A4 打印 CSS 规则测试通过');

// 4. 双面装订线 (Gutter Margin) 奇偶页交替规则校验
console.log('--- 测试 4: 双面装订线 Gutter Margin 奇偶页交替 ---');
const gutterCss = generateA4PrintCss({
  gutterMargin: true,
  marginMm: { top: 20, bottom: 20, left: 15, right: 15, gutter: 10 },
});
assert.ok(gutterCss.includes('@page :left'), '开启装订线后必须包含偶数页样式');
assert.ok(gutterCss.includes('@page :right'), '开启装订线后必须包含奇数页样式');
assert.ok(gutterCss.includes('margin-right: 25mm'), '偶数页内装订线应累加 gutter 偏移');
assert.ok(gutterCss.includes('margin-left: 25mm'), '奇数页内装订线应累加 gutter 偏移');
console.log('✅ 双面装订线奇偶页交替测试通过');

console.log('🎉 全部 4 组 A4 2.0 打印排版引擎测试用例 100% 通过！');
