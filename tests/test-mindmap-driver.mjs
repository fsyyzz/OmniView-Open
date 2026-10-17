/**
 * OmniView 思维导图文件扩展驱动与格式解析单元测试
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { getDriverIdForFile } from '../src/features/viewers/lib/driverRouting.js';

console.log('🧪 开始思维导图驱动与后缀路由规则测试...');

// 1. 测试后缀映射路由
const testFiles = [
  { ext: 'markmap', expected: 'mindmap' },
  { ext: 'MARKMAP', expected: 'mindmap' },
  { ext: 'mm', expected: 'mindmap' },
  { ext: 'MM', expected: 'mindmap' },
  { ext: 'mindmap', expected: 'mindmap' },
  { ext: 'km', expected: 'mindmap' },
  { ext: 'md', expected: 'markdown' },
  { ext: 'puml', expected: 'plantuml' },
  { ext: 'svg', expected: 'svg' },
  { ext: 'pdf', expected: 'pdf' },
  { ext: 'csv', expected: 'csv' },
];

for (const { ext, expected } of testFiles) {
  const file = {
    id: `test-${ext}`,
    name: `test.${ext}`,
    path: `/test.${ext}`,
    extension: ext,
    content: '# Test',
    size: 10,
    lastModified: Date.now(),
  };
  const driverId = getDriverIdForFile(file);
  assert.strictEqual(driverId, expected, `扩展名 .${ext} 应映射到驱动 ${expected}，但得到了 ${driverId}`);
}
console.log('✅ 思维导图后缀映射 (.markmap, .mm, .mindmap, .km) 测试全部通过');

// 2. 校验 package.json 插件配置注册
const pkgJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const patterns = pkgJson.contributes.customEditors[0].selector.map(s => s.filenamePattern);
assert.ok(patterns.includes('*.markmap'), 'package.json customEditors 缺少 *.markmap');
assert.ok(patterns.includes('*.mm'), 'package.json customEditors 缺少 *.mm');
assert.ok(patterns.includes('*.mindmap'), 'package.json customEditors 缺少 *.mindmap');
assert.ok(patterns.includes('*.km'), 'package.json customEditors 缺少 *.km');
console.log('✅ package.json VS Code 自定义编辑器后缀注册测试通过');

// 3. 校验 extension.ts 支持列表
const extTs = readFileSync('./src/extension/extension.ts', 'utf8');
assert.ok(extTs.includes('.markmap'), 'extension.ts 缺少 .markmap 支持');
assert.ok(extTs.includes('.mm'), 'extension.ts 缺少 .mm 支持');
assert.ok(extTs.includes('.mindmap'), 'extension.ts 缺少 .mindmap 支持');
console.log('✅ extension.ts VS Code 插件宿主支持列表测试通过');

console.log('🎉 全部思维导图驱动与后缀测试通过！');
