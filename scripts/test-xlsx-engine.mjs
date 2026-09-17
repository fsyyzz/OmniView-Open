/**
 * XLSX 解析与工作簿提取引擎自动化测试套件 (test-xlsx-engine.mjs)
 * 验证 OOXML 解包、多工作表解析、共享字符串池、单元格坐标计算、公式提取与多格式导出
 * 
 * 作者: 周赞
 */
import assert from 'node:assert/strict';
import {
  colLetterToIndex,
  indexToColLetter,
  parseCellRef,
  parseSharedStrings,
  parseXlsx,
  generateSampleXlsxZip,
  exportSheetToCsv,
  exportSheetToJson,
  exportSheetToMarkdown,
} from '../src/features/viewers/lib/xlsxEngine.ts';

async function testColLetterConversion() {
  console.log('  [test] 列字母与 0-based 索引双向换算测试...');
  assert.equal(colLetterToIndex('A'), 0);
  assert.equal(colLetterToIndex('B'), 1);
  assert.equal(colLetterToIndex('Z'), 25);
  assert.equal(colLetterToIndex('AA'), 26);
  assert.equal(colLetterToIndex('AB'), 27);
  assert.equal(colLetterToIndex('AZ'), 51);
  assert.equal(colLetterToIndex('BA'), 52);

  assert.equal(indexToColLetter(0), 'A');
  assert.equal(indexToColLetter(1), 'B');
  assert.equal(indexToColLetter(25), 'Z');
  assert.equal(indexToColLetter(26), 'AA');
  assert.equal(indexToColLetter(27), 'AB');
  assert.equal(indexToColLetter(51), 'AZ');
  assert.equal(indexToColLetter(52), 'BA');
  console.log('  ✓ 列字母与索引双向换算通过');
}

async function testParseCellRef() {
  console.log('  [test] 单元格坐标解析测试...');
  const c1 = parseCellRef('A1');
  assert.equal(c1.col, 0);
  assert.equal(c1.row, 0);
  assert.equal(c1.colStr, 'A');
  assert.equal(c1.rowNum, 1);

  const c2 = parseCellRef('C10');
  assert.equal(c2.col, 2);
  assert.equal(c2.row, 9);
  assert.equal(c2.colStr, 'C');
  assert.equal(c2.rowNum, 10);

  const c3 = parseCellRef('AA25');
  assert.equal(c3.col, 26);
  assert.equal(c3.row, 24);
  assert.equal(c3.colStr, 'AA');
  assert.equal(c3.rowNum, 25);
  console.log('  ✓ 单元格坐标解析通过');
}

async function testSharedStringsParsing() {
  console.log('  [test] SharedStrings 共享字符串池解析测试...');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
  <si><t>普通字符串</t></si>
  <si><r><t>富文本</t></r><r><t>组合</t></r></si>
  <si><t xml:space="preserve"> 带空格文本 </t></si>
</sst>`;
  const strings = parseSharedStrings(xml);
  assert.equal(strings.length, 3);
  assert.equal(strings[0], '普通字符串');
  assert.equal(strings[1], '富文本组合');
  assert.equal(strings[2], ' 带空格文本 ');
  console.log('  ✓ SharedStrings 共享字符串池解析通过');
}

async function testSampleXlsxGenerationAndParsing() {
  console.log('  [test] 示例工作簿生成与 OOXML 解包解析测试...');
  const sampleZip = await generateSampleXlsxZip();
  const buffer = await sampleZip.generateAsync({ type: 'nodebuffer' });

  const workbook = await parseXlsx(buffer);
  assert.ok(workbook, 'workbook 应该存在');
  assert.equal(workbook.sheets.length, 2, '示例应该包含 2 个工作表');

  // 验证工作表 1
  const sheet1 = workbook.sheets[0];
  assert.equal(sheet1.name, '2026年度业务营收与增长');
  assert.equal(sheet1.rowCount, 5);
  assert.equal(sheet1.colCount, 9);
  assert.equal(sheet1.headers[0], '产品业务线');
  assert.equal(sheet1.headers[1], '品类分类');
  assert.equal(sheet1.headers[6], '年度总营收');

  // 验证单元格公式与计算值
  const formulaCell = sheet1.cells['G2'];
  assert.ok(formulaCell, 'G2 单元格应该存在');
  assert.equal(formulaCell.formula, 'SUM(C2:F2)');
  assert.equal(formulaCell.value, '13820000');

  // 验证工作表 2
  const sheet2 = workbook.sheets[1];
  assert.equal(sheet2.name, '研发及运营预算明细');
  assert.equal(sheet2.rowCount, 5);
  assert.equal(sheet2.colCount, 7);
  assert.equal(sheet2.headers[0], '部门与支出项目');
  assert.equal(sheet2.headers[1], '负责人');

  // 验证元数据
  assert.equal(workbook.metadata.title, 'OmniView 业务数据总览与预算报表');
  assert.equal(workbook.metadata.creator, '周赞');
  assert.equal(workbook.metadata.lastModifiedBy, '周赞');
  assert.equal(workbook.metadata.totalSheets, 2);
  console.log('  ✓ 示例工作簿生成与 OOXML 解包解析通过');
}

async function testExportToCsvJsonMarkdown() {
  console.log('  [test] 工作表导出为 CSV/JSON/Markdown 测试...');
  const sampleZip = await generateSampleXlsxZip();
  const buffer = await sampleZip.generateAsync({ type: 'nodebuffer' });
  const workbook = await parseXlsx(buffer);
  const sheet1 = workbook.sheets[0];

  // 1. CSV 导出
  const csv = exportSheetToCsv(sheet1, ',');
  assert.ok(csv.includes('产品业务线,品类分类'));
  assert.ok(csv.includes('OmniView IDE 商业授权'));

  // 2. JSON 导出
  const jsonStr = exportSheetToJson(sheet1);
  const json = JSON.parse(jsonStr);
  assert.ok(Array.isArray(json));
  assert.equal(json.length, 4);
  assert.equal(json[0]['产品业务线'], 'OmniView IDE 商业授权');

  // 3. Markdown 表格导出
  const md = exportSheetToMarkdown(sheet1);
  assert.ok(md.includes('| 产品业务线 | 品类分类 |'));
  assert.ok(md.includes('| --- | --- |'));
  assert.ok(md.includes('| OmniView IDE 商业授权 |'));
  console.log('  ✓ 工作表导出为 CSV/JSON/Markdown 通过');
}

async function testResilienceOnEmptyInput() {
  console.log('  [test] 空输入容错保底测试...');
  const fallbackWorkbook = await parseXlsx('');
  assert.ok(fallbackWorkbook);
  assert.ok(fallbackWorkbook.sheets.length > 0);
  console.log('  ✓ 空输入容错保底通过');
}

async function runAll() {
  console.log('=== 开始执行 XLSX 渲染引擎自动化测试套件 ===');
  await testColLetterConversion();
  await testParseCellRef();
  await testSharedStringsParsing();
  await testSampleXlsxGenerationAndParsing();
  await testExportToCsvJsonMarkdown();
  await testResilienceOnEmptyInput();
  console.log('=== XLSX 渲染引擎 6 项测试全部 PASSED ===\n');
}

runAll().catch(err => {
  console.error('XLSX 引擎测试失败:', err);
  process.exit(1);
});
