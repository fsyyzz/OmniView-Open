#!/usr/bin/env node
/**
 * CSV / TSV 核心解析与数据转换自动化测试套件
 * 严格遵循 RFC 4180 规范
 */
import assert from 'node:assert';
import {
  detectDelimiter,
  parseCsv,
  serializeCsv,
  exportToJson,
  exportToMarkdown,
} from '../src/features/viewers/components/drivers/csv/csvUtils.ts';

console.log('🧪 开始 CSV / TSV 解析器与数据转换引擎单元测试...');

// 1. 分隔符智能探测测试
console.log('--- 测试 1: 分隔符自动嗅探 ---');
assert.strictEqual(detectDelimiter('id,name,age\n1,Alice,25'), ',', '逗号分隔符探测失败');
assert.strictEqual(detectDelimiter('id\tname\tage\n1\tAlice\t25'), '\t', '制表符 TSV 探测失败');
assert.strictEqual(detectDelimiter('id;name;age\n1;Alice;25'), ';', '分号分隔符探测失败');
assert.strictEqual(detectDelimiter('id|name|age\n1|Alice|25'), '|', '竖线分隔符探测失败');
console.log('✅ 分隔符自动嗅探测试全部通过');

// 2. 基础 RFC 4180 CSV 解析测试
console.log('--- 测试 2: 基础解析与规整化 ---');
const simpleCsv = `id,name,role
1,Alice,Engineer
2,Bob,Designer
3,Charlie,Product Manager`;

const result1 = parseCsv(simpleCsv);
assert.deepStrictEqual(result1.headers, ['id', 'name', 'role'], '表头解析不一致');
assert.strictEqual(result1.rows.length, 3, '数据行数不一致');
assert.strictEqual(result1.rows[0][1], 'Alice');
assert.strictEqual(result1.rows[2][2], 'Product Manager');
console.log('✅ 基础 CSV 解析测试通过');

// 3. 复杂转义与特殊字符测试 (RFC 4180)
console.log('--- 测试 3: RFC 4180 双引号转义与单元格换行 ---');
const complexCsv = `id,title,description,location
1,"Complex, Title","Line 1
Line 2 with ""quotes""","Beijing, China"
2,"Simple Title","Single line","Tokyo"`;

const result2 = parseCsv(complexCsv);
assert.strictEqual(result2.rows.length, 2, '复杂 CSV 行数解析错误');
assert.strictEqual(result2.rows[0][1], 'Complex, Title', '含逗号引号单元格解析错误');
assert.strictEqual(result2.rows[0][2], 'Line 1\nLine 2 with "quotes"', '多行与转义引号单元格解析错误');
assert.strictEqual(result2.rows[0][3], 'Beijing, China', '位置单元格解析错误');
console.log('✅ RFC 4180 双引号与换行转义测试通过');

// 4. 列数不齐平时的自动补全与归一化测试
console.log('--- 测试 4: 列数归一化与不齐补空 ---');
const jaggedCsv = `A,B,C,D
1,2
3,4,5,6,7`;

const result3 = parseCsv(jaggedCsv);
// 最大列数是第 2 行的 5 列，表头应补全为 5 列
assert.strictEqual(result3.headers.length, 5, '表头未对齐至最大列数');
assert.strictEqual(result3.headers[4], 'Column 5', '自动追加表头命名错误');
assert.strictEqual(result3.rows[0].length, 5, '第一行未填充至最大列数');
assert.strictEqual(result3.rows[0][2], '', '未填充空字符串');
console.log('✅ 参差列宽对齐与归一化测试通过');

// 5. CSV 反向序列化测试 (serializeCsv)
console.log('--- 测试 5: 反向序列化与单元格引号包裹 ---');
const headersToSerialize = ['Name', 'Address', 'Notes'];
const rowsToSerialize = [
  ['Alice', '123 Main St, Apt 4', 'Said "Hello"'],
  ['Bob', 'Simple Road', 'No quotes'],
];

const serialized = serializeCsv(headersToSerialize, rowsToSerialize);
assert.ok(serialized.includes('"123 Main St, Apt 4"'), '含逗号字段未被双引号包裹');
assert.ok(serialized.includes('"Said ""Hello"""'), '含双引号字段转义错误');
assert.ok(serialized.includes('Simple Road'), '普通字段被不必要地包裹');
console.log('✅ CSV 反向序列化测试通过');

// 6. 导出为 JSON 格式测试 (exportToJson)
console.log('--- 测试 6: 导出为 JSON 并保留数值推断 ---');
const jsonHeaders = ['id', 'name', 'score', 'zipCode'];
const jsonRows = [
  ['101', 'Alice', '98.5', '010100'],
  ['102', 'Bob', '85', '020200'],
];

const jsonString = exportToJson(jsonHeaders, jsonRows);
const parsedJson = JSON.parse(jsonString);
assert.strictEqual(parsedJson.length, 2, 'JSON 行数不符');
assert.strictEqual(parsedJson[0].id, 101, '纯数字未正确推导为 Number');
assert.strictEqual(parsedJson[0].score, 98.5, '浮点数未正确推导为 Number');
assert.strictEqual(parsedJson[0].zipCode, '010100', '前导零编码被错误转为数字');
assert.strictEqual(parsedJson[0].name, 'Alice', '字符串解析错误');
console.log('✅ JSON 导出与数字类型智能推导测试通过');

// 7. 导出为 Markdown 表格测试 (exportToMarkdown)
console.log('--- 测试 7: 导出为 Markdown 表格并转义管道符 ---');
const mdHeaders = ['Feature', 'Syntax', 'Status'];
const mdRows = [
  ['Bitwise OR', 'a | b', 'Supported'],
  ['Breakline', 'Multi\nLine', 'Done'],
];

const markdownTable = exportToMarkdown(mdHeaders, mdRows);
assert.ok(markdownTable.includes('| Feature | Syntax | Status |'), '表头生成失败');
assert.ok(markdownTable.includes('| --- | --- | --- |'), '分隔线生成失败');
assert.ok(markdownTable.includes('a \\| b'), '单元格内部竖线管道符未转义');
assert.ok(!markdownTable.includes('Multi\nLine'), '单元格换行未被清理为单行');
console.log('✅ Markdown 表格导出与特殊字符转义测试通过');

// 8. 边界输入容错测试
console.log('--- 测试 8: 极限与空值边界容错 ---');
const emptyResult = parseCsv('');
assert.deepStrictEqual(emptyResult.rows, [], '空输入应返回空行数组');
assert.strictEqual(exportToMarkdown([], []), '', '空表头应返回空字符串');
console.log('✅ 极限边界容错测试通过');

console.log('🎉 全部 8 组 CSV / TSV 数据引擎测试用例 100% 通过！\n');
