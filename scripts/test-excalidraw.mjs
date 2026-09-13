#!/usr/bin/env node
/**
 * OmniView Excalidraw 解析与高保真数据驱动测试
 */
import assert from 'node:assert';
import { parseExcalidrawJson } from '../src/features/viewers/components/drivers/excalidraw/excalidrawEngine.ts';

console.log('🧪 开始 Excalidraw 格式解析与数据自愈单元测试...');

// 1. 测试标准 Excalidraw 文档对象
console.log('--- 测试 1: 标准 Excalidraw 文档解析 ---');
const standardDoc = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements: [
    { id: 'el-1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50 },
    { id: 'el-2', type: 'text', x: 20, y: 20, text: 'Sample' }
  ],
  appState: {
    viewBackgroundColor: '#ffffff',
    exportWithDarkMode: false
  },
  files: {}
});

const res1 = parseExcalidrawJson(standardDoc);
assert.strictEqual(res1.isValid, true, '标准文档应解析成功');
assert.strictEqual(res1.elements.length, 2, '元素数量应为 2');
assert.strictEqual(res1.appState.viewBackgroundColor, '#ffffff');
console.log('✅ 标准 Excalidraw 文档解析通过');

// 2. 测试纯元素数组降级解析
console.log('--- 测试 2: 纯元素数组降级自愈 ---');
const arrayDoc = JSON.stringify([
  { id: 'item-1', type: 'ellipse', x: 0, y: 0, width: 80, height: 80 }
]);

const res2 = parseExcalidrawJson(arrayDoc);
assert.strictEqual(res2.isValid, true, '纯数组应自动包装成功');
assert.strictEqual(res2.elements.length, 1);
assert.strictEqual(res2.elements[0].id, 'item-1');
console.log('✅ 纯元素数组自愈通过');

// 3. 测试空内容安全默认态
console.log('--- 测试 3: 空文档默认态 ---');
const res3 = parseExcalidrawJson('');
assert.strictEqual(res3.isValid, true);
assert.strictEqual(res3.elements.length, 0);
console.log('✅ 空文档安全解析通过');

// 4. 测试语法异常捕获与错误提示
console.log('--- 测试 4: 语法异常捕获 ---');
const badDoc = '{"type": "excalidraw", "elements": [bad json';
const res4 = parseExcalidrawJson(badDoc);
assert.strictEqual(res4.isValid, false, '语法错误应标记 isValid 为 false');
assert.ok(res4.errorMessage, '应输出错误诊断信息');
console.log('✅ 语法异常捕获与错误抛出测试通过');

// 5. 测试预置模板库的合法性与数据完整性
console.log('--- 测试 5: 预置模板库完整性与解析校验 ---');
import { EXCALIDRAW_TEMPLATES } from '../src/features/viewers/components/drivers/excalidraw/excalidrawTemplates.ts';
assert.ok(Array.isArray(EXCALIDRAW_TEMPLATES) && EXCALIDRAW_TEMPLATES.length >= 4, '模板库应包含至少4种预置模板');
for (const tmpl of EXCALIDRAW_TEMPLATES) {
  assert.ok(tmpl.id && tmpl.name && tmpl.data, `模板 ${tmpl.id} 结构必须完整`);
  const tmplJson = JSON.stringify(tmpl.data);
  const parsed = parseExcalidrawJson(tmplJson);
  assert.strictEqual(parsed.isValid, true, `模板 ${tmpl.id} 数据必须能被有效解析`);
  assert.strictEqual(parsed.elements.length, tmpl.data.elements.length);
}
console.log('✅ 预置模板库完整性校验全部通过');

console.log('🎉 Excalidraw 数据处理引擎与模板测试 100% 全部通过！\n');
