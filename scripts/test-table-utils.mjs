/**
 * Markdown 富表格核心功能测试 (test-table-utils.mjs)
 * 验证数值探测、智能排序、富文本渲染、CSV/Markdown 互转与图表列探测
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseNumericValue,
  parseDateValue,
  compareCellValues,
  formatRichCellContent,
  tableToCsv,
  tableToMarkdown,
  detectChartableColumns,
  highlightMatches,
} from '../src/features/viewers/components/drivers/markdown/tableUtils.ts';

console.log('🧪 开始 Markdown 表格工具链单元测试...');

// 1. 数值解析单元测试
{
  assert.equal(parseNumericValue('123'), 123);
  assert.equal(parseNumericValue('-45.67'), -45.67);
  assert.equal(parseNumericValue('1,234,567.89'), 1234567.89);
  assert.equal(parseNumericValue('85.5%'), 85.5);
  assert.equal(parseNumericValue('$99.9'), 99.9);
  assert.equal(parseNumericValue('¥1200'), 1200);
  assert.equal(parseNumericValue('€45.5'), 45.5);
  assert.equal(parseNumericValue('128MB'), 128);
  assert.equal(parseNumericValue('45ms'), 45);
  assert.equal(parseNumericValue('**16 GB**'), 16);
  assert.equal(parseNumericValue('Text Only'), null);
  assert.equal(parseNumericValue(''), null);
  console.log('  ✅ 1. 数值解析 (parseNumericValue) 测试通过');
}

// 2. 日期解析测试
{
  assert.notEqual(parseDateValue('2026-09-08'), null);
  assert.notEqual(parseDateValue('2026/01/15 14:30'), null);
  assert.equal(parseDateValue('Not a date'), null);
  console.log('  ✅ 2. 日期解析 (parseDateValue) 测试通过');
}

// 3. 多态列排序测试
{
  // 数值升序与降序
  assert(compareCellValues('10ms', '2ms', 'asc') > 0);
  assert(compareCellValues('10ms', '2ms', 'desc') < 0);
  assert(compareCellValues('$1,000', '$200', 'asc') > 0);
  assert(compareCellValues('85%', '92%', 'asc') < 0);

  // 自然文本序
  assert(compareCellValues('Item 2', 'Item 10', 'asc') < 0);
  assert(compareCellValues('Apple', 'Banana', 'asc') < 0);
  console.log('  ✅ 3. 多态智能排序 (compareCellValues) 测试通过');
}

// 4. 富文本渲染 (数学公式、复选框、徽标与高亮)
{
  // 公式
  const withMath = formatRichCellContent('Formula: $E = mc^2$');
  assert(withMath.includes('katex'));

  // 复选框
  const withCheck = formatRichCellContent('[x] Done [ ] Pending');
  assert(withCheck.includes('ov-table-checkbox-checked'));
  assert(withCheck.includes('ov-table-checkbox'));

  // 状态徽标
  const withBadge = formatRichCellContent('[SUCCESS] [FAIL] [WARN]');
  assert(withBadge.includes('ov-badge-success'));
  assert(withBadge.includes('ov-badge-danger'));
  assert(withBadge.includes('ov-badge-warning'));

  // 搜索关键词高亮
  const withHighlight = highlightMatches('<span>Hello World</span>', 'world');
  assert(withHighlight.includes('ov-table-search-mark'));
  assert(withHighlight.includes('World'));
  console.log('  ✅ 4. 单元格富文本渲染与高亮测试通过');
}

// 5. CSV 与 Markdown 导出格式测试
{
  const headers = ['Name', 'Score', 'Status'];
  const rows = [
    ['Alice', '95', 'Passed'],
    ['Bob, Jr.', '88', 'Passed'],
  ];

  const csv = tableToCsv(headers, rows);
  assert(csv.includes('Name,Score,Status'));
  assert(csv.includes('"Bob, Jr."')); // 逗号正确转义

  const md = tableToMarkdown(headers, rows, ['left', 'right', 'center']);
  assert(md.includes('| Name'));
  assert(md.includes(':--'));
  assert(md.includes('--:'));
  assert(/:--+:/.test(md));
  console.log('  ✅ 5. CSV 与 Markdown 转换导出测试通过');
}

// 6. 图表潜力探测测试
{
  const headers = ['Module', 'Latency', 'QPS'];
  const rows = [
    ['Auth', '12ms', '1400'],
    ['Gateway', '8ms', '2500'],
    ['Database', '45ms', '800'],
  ];

  const chartable = detectChartableColumns(headers, rows);
  assert.notEqual(chartable, null);
  assert.equal(chartable?.labelColIndex, 0);
  assert.deepEqual(chartable?.valueColIndices, [1, 2]);

  // 全文本表格不能作为图表
  const textHeaders = ['Name', 'Title', 'City'];
  const textRows = [
    ['Alice', 'Engineer', 'Beijing'],
    ['Bob', 'Designer', 'Shanghai'],
  ];
  assert.equal(detectChartableColumns(textHeaders, textRows), null);
  console.log('  ✅ 6. 图表化潜能探测 (detectChartableColumns) 测试通过');
}

{
  const css = fs.readFileSync(path.resolve('src/index.css'), 'utf8');
  const toolbarBlock = css.match(/\.table-block-toolbar\s*\{[\s\S]*?\}/);
  assert.ok(toolbarBlock, '必须定义 .table-block-toolbar');
  assert.match(toolbarBlock[0], /position:\s*absolute/, '表格工具栏必须绝对定位悬浮');
  assert.match(toolbarBlock[0], /top:\s*0/, '表格工具栏须贴顶，与 diagram-header 一致');
  assert.match(toolbarBlock[0], /left:\s*0/, '表格工具栏须左右贴边，与 diagram-header 一致');
  assert.match(toolbarBlock[0], /opacity:\s*0/, '默认隐藏透明度');
  assert.doesNotMatch(toolbarBlock[0], /max-height:\s*0/, '禁止用 max-height 收起（会进文档流）');
  assert.doesNotMatch(toolbarBlock[0], /top:\s*8px/, '禁止内缩胶囊定位，须与图片/图表工具栏一致');
  const hoverBlock = css.match(/\.ov-table-block:hover \.table-block-toolbar[\s\S]*?\{[\s\S]*?\}/);
  assert.ok(hoverBlock, '必须定义悬停展开规则');
  assert.doesNotMatch(hoverBlock[0], /max-height:\s*72px/, '悬停时禁止用 max-height 撑开布局');
  console.log('  ✅ 7. 表格工具栏悬浮定位契约测试通过');
}

console.log('🎉 所有 Markdown 表格单元测试全部通过！');
