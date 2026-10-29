/**
 * XLSX 解析与工作簿提取引擎自动化测试套件 (test-xlsx-engine.mjs)
 * 验证 OOXML 解包、多工作表解析、共享字符串池、单元格坐标计算、公式提取与多格式导出
 */
import assert from 'node:assert/strict';
import {
  colLetterToIndex,
  indexToColLetter,
  parseCellRef,
  parseSharedStrings,
  parseXlsx,
  serializeXlsxWorkbook,
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
  assert.equal(workbook.metadata.creator, 'OmniView Architecture Team');
  assert.equal(workbook.metadata.lastModifiedBy, 'OmniView Architecture Team');
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

async function testConvertOmniWorkbookToUniver() {
  console.log('  [test] OmniView -> Univer 数据模型转换适配测试...');
  const sampleZip = await generateSampleXlsxZip();
  const buffer = await sampleZip.generateAsync({ type: 'nodebuffer' });
  const workbook = await parseXlsx(buffer);

  // 模拟添加合并单元格
  workbook.sheets[0].mergedRanges = ['A1:B2'];

  const univerData = convertOmniWorkbookToUniver(workbook, '测试工作簿.xlsx', 'test_unit_1');
  assert.equal(univerData.id, 'test_unit_1');
  assert.equal(univerData.name, '测试工作簿.xlsx');
  assert.ok(univerData.sheetOrder.length >= 2);

  const firstSheetId = univerData.sheetOrder[0];
  const firstSheet = univerData.sheets[firstSheetId];
  assert.ok(firstSheet);
  assert.equal(firstSheet.name, '2026年度业务营收与增长');
  assert.ok(firstSheet.cellData);

  // 验证单元格数据转换 (0-based)
  // 检查是否有数据行被转换为 Univer ICellData (包含 v)
  assert.ok(firstSheet.cellData[0]);
  assert.ok(firstSheet.cellData[0][0].v !== undefined);

  // 验证合并单元格转换
  assert.ok(Array.isArray(firstSheet.mergeData));
  assert.equal(firstSheet.mergeData.length, 1);
  assert.equal(firstSheet.mergeData[0].startRow, 0);
  assert.equal(firstSheet.mergeData[0].endRow, 1);
  assert.equal(firstSheet.mergeData[0].startColumn, 0);
  assert.equal(firstSheet.mergeData[0].endColumn, 1);

  console.log('  ✓ OmniView -> Univer 数据模型适配测试通过');
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  convertOmniWorkbookToUniver,
  evaluateUniverFormula,
  updateWorksheetCell,
  applyWorkbookCellEdit,
  getColumnDistinctValues,
  filterAndSortWorksheetRows,
  calculateFrozenColumnLeftOffset,
} from '../src/features/viewers/components/drivers/xlsx/xlsxToUniverAdapter.ts';
import { isStaleModuleOrDispatcherError } from '../src/features/viewers/components/common/RenderErrorBoundary.tsx';

async function testStaleModuleOrDispatcherDetection() {
  console.log('  [test] Vite 依赖重打包哈希不一致 / React 双实例 Dispatcher 异常识别测试...');
  const err = new TypeError("Cannot read properties of null (reading 'useState')");
  err.stack = `TypeError: Cannot read properties of null (reading 'useState')
    at exports.useState (https://localhost:3000/node_modules/.vite/deps/chunk-USTO3F3J.js?v=9fb88ae5:959:35)
    at XlsxViewer (https://localhost:3000/src/features/viewers/components/drivers/XlsxViewer.tsx:47:35)`;
  assert.equal(isStaleModuleOrDispatcherError(err), true);

  const normalErr = new Error('Workbook XML corrupted');
  assert.equal(isStaleModuleOrDispatcherError(normalErr), false);
  console.log('  ✓ Vite 依赖哈希不一致与 React 双实例异常识别测试通过');
}

async function testUniverCellEditingAndFormulaRecalculation() {
  console.log('  [test] Univer 单元格编辑与依赖公式实时重算测试...');
  const sampleZip = await generateSampleXlsxZip();
  const buffer = await sampleZip.generateAsync({ type: 'nodebuffer' });
  const workbook = await parseXlsx(buffer);

  // 初始状态: Sheet 1 的 C2=2850000, D2=3200000, E2=3650000, F2=4120000, G2=SUM(C2:F2)=13820000
  const sheet1 = workbook.sheets[0];
  assert.equal(sheet1.cells['G2'].value, '13820000');

  // 1. 修改 C2 从 2850000 -> 3850000 (+1000000)，验证依赖公式 G2 自动重算为 14820000
  const updatedWorkbook1 = applyWorkbookCellEdit(workbook, 0, 1, 2, '3850000');
  const updatedSheet1 = updatedWorkbook1.sheets[0];
  assert.equal(updatedSheet1.cells['C2'].value, '3850000');
  assert.equal(updatedSheet1.rows[1][2], '3850000');
  assert.equal(updatedSheet1.cells['G2'].value, '14820000', '修改 C2 后 G2 的 SUM(C2:F2) 应自动重算为 14820000');
  assert.equal(updatedSheet1.rows[1][6], '14820000');

  // 2. 在空白单元格 J2 (row=1, col=9) 输入新公式 =AVERAGE(C2:F2)
  const updatedSheet2 = updateWorksheetCell(updatedSheet1, 1, 9, '=AVERAGE(C2:F2)');
  assert.equal(updatedSheet2.cells['J2'].formula, 'AVERAGE(C2:F2)');
  assert.equal(updatedSheet2.cells['J2'].value, '3705000', 'AVERAGE(3850000, 3200000, 3650000, 4120000) 应为 3705000');

  // 3. 测试 Sheet 2 的四则运算公式 C2-D2 自动重算
  // 初始 Sheet 2: C2=5000000, D2=3200000, E2=C2-D2=1800000
  const updatedWorkbook2 = applyWorkbookCellEdit(updatedWorkbook1, 1, 1, 3, '2000000');
  const updatedBudgetSheet = updatedWorkbook2.sheets[1];
  assert.equal(updatedBudgetSheet.cells['E2'].value, '3000000', '修改 D2 为 2000000 后 E2 (C2-D2) 应重算为 3000000');

  // 4. 验证编辑后通过 serializeXlsxWorkbook 持久化快照再经过 parseXlsx 不会丢失修改
  const serialized = serializeXlsxWorkbook(updatedWorkbook2);
  const restoredWorkbook = await parseXlsx(serialized);
  assert.equal(restoredWorkbook.sheets[0].cells['C2'].value, '3850000', '序列化后再解析必须保留已修改的 C2 值');
  assert.equal(restoredWorkbook.sheets[0].cells['G2'].value, '14820000', '序列化后再解析必须保留重算后的 G2 公式值');
  assert.equal(restoredWorkbook.sheets[1].cells['E2'].value, '3000000', '序列化后再解析必须保留 Sheet 2 的修改');

  // 5. 直接验证 evaluateUniverFormula 各类聚合函数
  const dummyGrid = [
    ['10', '20', '30'],
    ['40', '50', '60'],
  ];
  const getter = (r, c) => dummyGrid[r]?.[c] ?? '';
  assert.equal(evaluateUniverFormula('=SUM(A1:C2)', getter), '210');
  assert.equal(evaluateUniverFormula('=MAX(A1:C2)', getter), '60');
  assert.equal(evaluateUniverFormula('=MIN(A1:C2)', getter), '10');
  assert.equal(evaluateUniverFormula('=COUNT(A1:C2)', getter), '6');
  assert.equal(evaluateUniverFormula('=(A1+B1)*C1', getter), '900');
  console.log('  ✓ Univer 单元格编辑与依赖公式实时重算通过');
}

async function testColumnHeaderFilteringAndFreezing() {
  console.log('  [test] Univer 列头过滤 (Column Filter) 与列冻结 (Column Freeze) 测试...');
  const sampleZip = await generateSampleXlsxZip();
  const buffer = await sampleZip.generateAsync({ type: 'nodebuffer' });
  const workbook = await parseXlsx(buffer);
  const sheet1 = workbook.sheets[0];

  // 1. 提取列 I (colIdx=8, "达成状态") 的唯一值及计数
  const distinctStatus = getColumnDistinctValues(sheet1, 8, true);
  assert.equal(distinctStatus.length, 2, '达成状态列应有 2 种唯一值 ("超额达成" 与 "顺利达成")');
  const overAchieved = distinctStatus.find(d => d.value === '超额达成');
  assert.ok(overAchieved && overAchieved.count === 3, '"超额达成" 应出现 3 次');

  // 2. 按唯一值勾选过滤：仅勾选 ["顺利达成"]
  const filteredByValue = filterAndSortWorksheetRows({
    sheet: sheet1,
    totalRows: 10,
    columnFilters: {
      8: { selectedValues: ['顺利达成'] },
    },
  });
  // 第 0 行表头 + 命中的第 3 行 (DiagramStudio 协同画布) + 末尾预留空白行
  assert.equal(filteredByValue[0], 0, '首行表头必须保留在索引 0');
  assert.equal(filteredByValue[1], 3, '命中的唯一数据行应为 rIdx=3 (DiagramStudio 协同画布)');

  // 3. 按关键字过滤：在第 0 列搜索 "CodeGraph"
  const filteredByKeyword = filterAndSortWorksheetRows({
    sheet: sheet1,
    totalRows: 10,
    columnFilters: {
      0: { keyword: 'codegraph' },
    },
  });
  assert.equal(filteredByKeyword[0], 0);
  assert.equal(filteredByKeyword[1], 2, '关键字过滤应命中 rIdx=2 (CodeGraph 智能索引服务)');

  // 4. 列冻结偏移量计算验证
  assert.equal(calculateFrozenColumnLeftOffset(0, 0, 48, 128), null, '未启用列冻结时应返回 null');
  assert.equal(calculateFrozenColumnLeftOffset(0, 2, 48, 128), 48, '第 0 列冻结偏移应为 48px');
  assert.equal(calculateFrozenColumnLeftOffset(1, 2, 48, 128), 176, '第 1 列冻结偏移应为 48+128=176px');
  assert.equal(calculateFrozenColumnLeftOffset(2, 2, 48, 128), null, '超出冻结列数的列应返回 null');
  console.log('  ✓ Univer 列头过滤与列冻结逻辑测试通过');
}

async function testUniverExclusiveModeAndEditableUIContract() {
  console.log('  [test] Excel 预览仅保留 Univer 工作台且开启可编辑/列过滤/列冻结契约测试...');
  const root = process.cwd();
  const xlsxViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/XlsxViewer.tsx'), 'utf8');
  const univerViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/xlsx/UniverSheetViewer.tsx'), 'utf8');

  // 验证 XlsxViewer 已彻底移除极速预览模式切换，仅保留 UniverSheetViewer，且具备防回环写回保护
  assert.ok(!xlsxViewerSrc.includes("setViewEngine('fast')"), 'XlsxViewer 不应再包含 fast 极速预览切换按钮');
  assert.ok(!xlsxViewerSrc.includes('<span>极速预览</span>'), 'XlsxViewer 不应再包含极速预览文案');
  assert.ok(xlsxViewerSrc.includes('<UniverSheetViewer'), 'XlsxViewer 必须直接渲染 UniverSheetViewer');
  assert.ok(xlsxViewerSrc.includes('onWorkbookChange={handleWorkbookChange}'), 'XlsxViewer 必须监听 Univer 工作簿编辑变更');
  assert.ok(xlsxViewerSrc.includes('lastEmittedContentRef'), 'XlsxViewer 必须包含 lastEmittedContentRef 防止编辑回写触发重解包覆盖');

  // 验证 UniverSheetViewer 具备同步编辑事务锁、列头过滤与列冻结能力
  assert.ok(univerViewerSrc.includes('editingSessionRef'), 'UniverSheetViewer 必须使用 editingSessionRef 保证双击/回车/失焦提交不丢数据');
  assert.ok(univerViewerSrc.includes('onDoubleClick'), 'UniverSheetViewer 单元格必须支持双击进入编辑');
  assert.ok(univerViewerSrc.includes('commitCellEdit'), 'UniverSheetViewer 必须包含 commitCellEdit 提交逻辑');
  assert.ok(univerViewerSrc.includes('applyWorkbookCellEdit'), 'UniverSheetViewer 必须调用 applyWorkbookCellEdit 更新工作簿');
  assert.ok(univerViewerSrc.includes('columnFilters'), 'UniverSheetViewer 必须支持列头过滤状态');
  assert.ok(univerViewerSrc.includes('frozenColCount'), 'UniverSheetViewer 必须支持列冻结状态');
  console.log('  ✓ Excel 预览仅保留 Univer 工作台且开启可编辑/列过滤/列冻结契约通过');
}

async function runAll() {
  console.log('=== 开始执行 XLSX 渲染引擎自动化测试套件 ===');
  await testColLetterConversion();
  await testParseCellRef();
  await testSharedStringsParsing();
  await testSampleXlsxGenerationAndParsing();
  await testExportToCsvJsonMarkdown();
  await testResilienceOnEmptyInput();
  await testConvertOmniWorkbookToUniver();
  await testStaleModuleOrDispatcherDetection();
  await testUniverCellEditingAndFormulaRecalculation();
  await testColumnHeaderFilteringAndFreezing();
  await testUniverExclusiveModeAndEditableUIContract();
  console.log('=== XLSX 渲染引擎 11 项测试全部 PASSED ===\n');
}

runAll().catch(err => {
  console.error('XLSX 引擎测试失败:', err);
  process.exit(1);
});
