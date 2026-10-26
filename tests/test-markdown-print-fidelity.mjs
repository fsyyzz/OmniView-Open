/**
 * OmniView Markdown 打印保真度与全效果对齐单元测试
 * 验证：
 * 1. cleanInteractiveElements 展开 details 与多 Tab 保全
 * 2. buildPortableHtml 具备 Callout/Card/Tabs/Steps/Timeline/Compare/Metrics/FAQ/OKF 全量样式与代码高亮
 * 3. index.css @media print 彻底废除背景透明抹杀规则，并包含 details 展开与 Tab 按钮保护
 * 4. WorkbenchHeader 调用 buildPortableHtml 进行高保真外置打印
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const exportEngineCode = read('src/features/viewers/lib/exportEngine.ts');
const indexCssCode = read('src/index.css');
const workbenchHeaderCode = read('src/features/workbench/components/WorkbenchHeader.tsx');

console.log('🧪 开始 Markdown 打印保真度测试...');

// 1. 验证 WorkbenchHeader.tsx 打印管线使用 buildPortableHtml
assert.match(
  workbenchHeaderCode,
  /import\s*\{[^}]*buildPortableHtml[^}]*\}\s*from/,
  'WorkbenchHeader 必须引入 buildPortableHtml'
);
assert.match(
  workbenchHeaderCode,
  /buildPortableHtml\s*\([^,]+,\s*canvas\)/,
  'WorkbenchHeader handlePrint 必须使用 buildPortableHtml 导出高保真 HTML'
);
console.log('✅ 1. WorkbenchHeader 打印接入高保真 HTML 引擎通过');

// 2. 验证 exportEngine.ts 中的 cleanInteractiveElements 逻辑契约
assert.match(
  exportEngineCode,
  /root\.querySelectorAll\(['"]details['"]\)\.forEach/,
  'cleanInteractiveElements 必须遍历并展开所有 details 元素'
);
assert.match(
  exportEngineCode,
  /el\.setAttribute\(['"]open['"],\s*['"]['"]\)/,
  'cleanInteractiveElements 必须给 details 设置 open 属性'
);
assert.match(
  exportEngineCode,
  /root\.querySelectorAll\(['"]\.ov-tab-group['"]\)/,
  'cleanInteractiveElements 必须提取并保全 .ov-tab-group 中的所有 Tab 面板'
);
assert.match(
  exportEngineCode,
  /ov-tab-print-badge/,
  'cleanInteractiveElements 必须为各 Tab 面板注入打印指示徽标'
);
assert.match(
  exportEngineCode,
  /['"]\.ov-callout-fold-icon['"]/,
  'cleanInteractiveElements 必须清除折叠指示图标'
);
assert.match(
  exportEngineCode,
  /['"]\.ov-faq-chevron['"]/,
  'cleanInteractiveElements 必须清除 FAQ 展开指示箭头'
);
console.log('✅ 2. cleanInteractiveElements 展开与 Tab 注入契约测试通过');

// 3. 验证 buildPortableHtml 样式完备性
const expectedStyles = [
  '.ov-callout',
  '.ov-callout-note',
  '.ov-callout-tip',
  '.ov-callout-important',
  '.ov-callout-warning',
  '.ov-callout-caution',
  '.ov-callout-success',
  '.ov-callout-question',
  '.ov-callout-example',
  '.ov-callout-quote',
  '.ov-card-grid-container',
  '.ov-card-single',
  '.ov-tab-group',
  '.ov-tab-print-tag',
  '.ov-steps-container',
  '.ov-timeline-container',
  '.ov-compare-container',
  '.ov-metrics-container',
  '.ov-faq-container',
  '.ov-quotes-container',
  '.ov-banner-container',
  '#okf-header-card',
  '.token.keyword',
  '.token.string',
  '.token.comment',
  '.ov-table-block',
  'thead',
  'print-color-adjust',
];

for (const pattern of expectedStyles) {
  assert.ok(
    exportEngineCode.includes(pattern),
    `buildPortableHtml 必须包含核心打印样式定义: ${pattern}`
  );
}
console.log(`✅ 3. buildPortableHtml 全量 ${expectedStyles.length} 项排版与打印样式完备性通过`);

// 4. 验证 index.css @media print
assert.match(
  indexCssCode,
  /\.ov-callout\s*\{[^}]*background-color:\s*var\(--callout-bg/s,
  'index.css 必须为 .ov-callout 保留彩色背景定义'
);
assert.match(
  indexCssCode,
  /\.ov-callout\s*\{[^}]*border-left:\s*3\.5pt\s*solid\s*var\(--callout-color/s,
  'index.css 必须为 .ov-callout 保留彩色左边框'
);
assert.match(
  indexCssCode,
  /details\s*\{[^}]*display:\s*block\s*!important/s,
  'index.css @media print 必须强制打开 details'
);
assert.match(
  indexCssCode,
  /button:not\(\.ov-tab-btn\)/s,
  'index.css @media print 不得误伤 .ov-tab-btn'
);

// 确保没有把 .ov-callout 强制设为 background-color: transparent !important
const strippedBgMatch = /\.ov-callout[^}]*background-color:\s*transparent\s*!important/s.test(indexCssCode);
assert.strictEqual(strippedBgMatch, false, '严禁对 .ov-callout 设定 background-color: transparent !important');
console.log('✅ 4. index.css 打印色彩保真与组件防裁切规则测试通过');

console.log('🎉 test-markdown-print-fidelity: 全部断言通过！');
