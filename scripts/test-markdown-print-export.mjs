/**
 * Markdown 打印/导出契约：代码块行号对齐 + 表格排序箭头剥离
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const codeBlock = read('src/features/viewers/components/drivers/markdown/CodeBlock.tsx');
const tableBlock = read('src/features/viewers/components/drivers/markdown/TableBlock.tsx');
const exportEngine = read('src/features/viewers/lib/exportEngine.ts');
const indexCss = read('src/index.css');

assert.match(codeBlock, /code-block-header/, 'CodeBlock 必须标记 code-block-header 供导出清理');
assert.match(codeBlock, /code-line-gutter/, 'CodeBlock 必须标记 code-line-gutter');
assert.match(codeBlock, /code-line-body/, 'CodeBlock 必须标记 code-line-body');
assert.match(codeBlock, /code-block-body/, 'CodeBlock 必须标记 code-block-body');

assert.match(tableBlock, /ov-table-sort-icon/, 'TableBlock 排序图标必须带 ov-table-sort-icon');

assert.match(
  exportEngine,
  /['"]\.ov-table-sort-icon['"]/,
  'cleanInteractiveElements 必须移除 .ov-table-sort-icon'
);
assert.match(
  exportEngine,
  /\.ov-table-sort-icon\s*\{[^}]*display:\s*none/s,
  '便携 HTML 内联样式必须隐藏排序箭头'
);
assert.match(
  exportEngine,
  /\.markdown-code-block\s+\.code-block-body\s*\{[^}]*display:\s*flex/s,
  '便携 HTML 必须为代码块提供 flex 行号布局（不依赖 Tailwind）'
);
assert.match(
  exportEngine,
  /\.markdown-code-block\s+\.code-line-body[\s\S]*?white-space:\s*pre/s,
  '便携 HTML 有行号代码块禁止 pre-wrap，避免行号错位'
);

assert.match(
  indexCss,
  /\.ov-table-sort-icon\s*\{[^}]*display:\s*none\s*!important/s,
  '打印样式必须隐藏表格排序箭头'
);
assert.match(
  indexCss,
  /\.markdown-code-block\s+\.code-line-gutter[\s\S]*?white-space:\s*pre\s*!important/s,
  '打印样式 gutter 必须 white-space:pre'
);
assert.match(
  indexCss,
  /\.markdown-code-block\s+\.code-line-body[\s\S]*?white-space:\s*pre\s*!important/s,
  '打印样式 code-line-body 必须 white-space:pre，与 gutter 一对一'
);

console.log('test-markdown-print-export: OK');
