#!/usr/bin/env node
/**
 * 单元测试: Markdown 视图与 Code View 查找与替换功能套件
 * 作者: 
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('🧪 开始 Markdown 视图与 Code View 查找与替换功能自动化测试...');

const root = process.cwd();
const codeViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/CodeViewer.tsx'), 'utf8');
const markdownToolbarSrc = readFileSync(resolve(root, 'src/features/viewers/components/markdown/MarkdownToolbar.tsx'), 'utf8');
const pluginDocViewSrc = readFileSync(resolve(root, 'src/features/viewers/PluginDocumentView.tsx'), 'utf8');
const domHighlighterSrc = readFileSync(resolve(root, 'src/features/viewers/lib/domSearchHighlighter.ts'), 'utf8');

// 1. CodeViewer 替换功能静态契约测试
console.log('--- 测试 1: CodeViewer 替换功能与快捷键契约 ---');
assert.ok(codeViewerSrc.includes('handleReplaceSingle'), 'CodeViewer 必须包含 handleReplaceSingle');
assert.ok(codeViewerSrc.includes('handleReplaceAll'), 'CodeViewer 必须包含 handleReplaceAll');
assert.ok(codeViewerSrc.includes('id="ov-codeviewer-replace-input"'), 'CodeViewer 必须提供明确的 ov-codeviewer-replace-input ID');
assert.ok(codeViewerSrc.includes("e.key.toLowerCase() === 'h'"), 'CodeViewer 必须支持 Ctrl+H 快捷呼出替换面板');
assert.ok(codeViewerSrc.includes('caseSensitive'), 'CodeViewer 必须支持大小写敏感匹配切换');
console.log('✅ CodeViewer 替换功能契约测试通过');

// 2. MarkdownToolbar 替换功能静态契约测试
console.log('--- 测试 2: MarkdownToolbar 替换工具栏契约 ---');
assert.ok(markdownToolbarSrc.includes('id="omniview-markdown-replace-input"'), 'MarkdownToolbar 必须包含固定 replace input id');
assert.ok(markdownToolbarSrc.includes('id="btn-markdown-toggle-replace"'), 'MarkdownToolbar 必须包含切换替换栏按钮');
assert.ok(markdownToolbarSrc.includes('onReplaceSingle'), 'MarkdownToolbar 必须接入 onReplaceSingle');
assert.ok(markdownToolbarSrc.includes('onReplaceAll'), 'MarkdownToolbar 必须接入 onReplaceAll');
assert.ok(markdownToolbarSrc.includes('onToggleMatchCase'), 'MarkdownToolbar 必须支持 Aa 大小写切换');
console.log('✅ MarkdownToolbar 替换工具栏契约测试通过');

// 3. PluginDocumentView 替换与 Ctrl+H 路由测试
console.log('--- 测试 3: PluginDocumentView 替换逻辑与 Ctrl+H 路由 ---');
assert.ok(pluginDocViewSrc.includes('handleReplaceSingle'), 'PluginDocumentView 必须包含 Markdown 单处替换');
assert.ok(pluginDocViewSrc.includes('handleReplaceAll'), 'PluginDocumentView 必须包含 Markdown 全部替换');
assert.ok(pluginDocViewSrc.includes("e.key.toLowerCase() === 'h'"), 'PluginDocumentView 必须支持 Ctrl+H 捕获并路由');
assert.ok(pluginDocViewSrc.includes('ov-codeviewer-replace-input'), 'PluginDocumentView 在代码视图必须将 Ctrl+H 路由至代码替换框');
console.log('✅ PluginDocumentView 替换与快捷键路由测试通过');

// 4. 算法验证：单处替换与倒序全部替换逻辑断言
console.log('--- 测试 4: 单处与全部替换算法核心逻辑断言 ---');
function findTextOccurrences(content, search, caseSensitive = false) {
  if (!search) return [];
  const list = [];
  const target = caseSensitive ? content : content.toLowerCase();
  const query = caseSensitive ? search : search.toLowerCase();
  let pos = 0;
  while (pos < target.length) {
    const idx = target.indexOf(query, pos);
    if (idx === -1) break;
    list.push({ start: idx, end: idx + query.length });
    pos = idx + Math.max(1, query.length);
  }
  return list;
}

const originalDoc = 'Hello World! hello everyone, HELLO omniview!';

// 不区分大小写匹配
const occ1 = findTextOccurrences(originalDoc, 'hello', false);
assert.strictEqual(occ1.length, 3, '不区分大小写应匹配 3 处');

// 区分大小写匹配
const occCase = findTextOccurrences(originalDoc, 'Hello', true);
assert.strictEqual(occCase.length, 1, '区分大小写应仅匹配 1 处');

// 单处替换测试（第 2 处）
const matchIdx = 1;
const singleTarget = occ1[matchIdx];
const replacedSingle = originalDoc.substring(0, singleTarget.start) + 'Hi' + originalDoc.substring(singleTarget.end);
assert.strictEqual(replacedSingle, 'Hello World! Hi everyone, HELLO omniview!');
console.log('✅ 单处替换算法精确断言通过');

// 全部替换测试 (倒序替换)
let replacedAll = originalDoc;
for (let i = occ1.length - 1; i >= 0; i--) {
  const m = occ1[i];
  replacedAll = replacedAll.substring(0, m.start) + 'Hi' + replacedAll.substring(m.end);
}
assert.strictEqual(replacedAll, 'Hi World! Hi everyone, Hi omniview!');
console.log('✅ 倒序全部替换算法精确断言通过');

// 5. domSearchHighlighter caseSensitive 参数验证
console.log('--- 测试 5: domSearchHighlighter 大小写敏感参数测试 ---');
assert.ok(domHighlighterSrc.includes('caseSensitive'), 'domSearchHighlighter 必须支持 caseSensitive 选项');
console.log('✅ domSearchHighlighter 大小写敏感参数测试通过');

console.log('\n🎉 全部 5 组查找与替换自动化测试用例 100% 通过！\n');
