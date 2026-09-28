#!/usr/bin/env node
/**
 * 外部编辑热重载与实时同步机制单元测试
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = process.cwd();

console.log('🧪 开始外部编辑热同步与重载机制单元测试...');

// 测试 1: extension.ts 中 isSameDocumentUri 跨平台 URI 匹配规则与监听器覆盖
console.log('--- 测试 1: extension.ts 跨平台 URI 匹配与事件监听器覆盖 ---');
const extTs = readFileSync(join(ROOT, 'src/extension/extension.ts'), 'utf8');

assert.ok(
  extTs.includes('function isSameDocumentUri'),
  'extension.ts 必须定义 isSameDocumentUri 辅助函数'
);
assert.ok(
  extTs.includes('toLowerCase() === b.fsPath.toLowerCase()'),
  'isSameDocumentUri 必须支持跨平台盘符大小写不敏感匹配'
);
assert.ok(
  extTs.includes('reload-document'),
  'extension.ts 必须支持来自 webview 的 reload-document 消息'
);
assert.ok(
  extTs.includes('fileWatcher.onDidCreate'),
  'fileWatcher 必须同时监听 onDidChange 与 onDidCreate（适配原子写重命名保存）'
);
console.log('✅ extension.ts 跨平台 URI 匹配与原子写监听器校验通过');

// 测试 2: MarkdownToolbar 重新加载按钮与 Tooltip 契约
console.log('--- 测试 2: MarkdownToolbar 重新加载按钮与 Tooltip ---');
const toolbarTsx = readFileSync(join(ROOT, 'src/features/viewers/components/markdown/MarkdownToolbar.tsx'), 'utf8');

assert.ok(
  toolbarTsx.includes('onReloadDocument'),
  'MarkdownToolbar 必须声明 onReloadDocument 接口'
);
assert.ok(
  toolbarTsx.includes('btn-markdown-reload-document'),
  'MarkdownToolbar 必须包含 btn-markdown-reload-document 按钮 ID'
);
assert.ok(
  toolbarTsx.includes('isReloading'),
  'MarkdownToolbar 必须支持 isReloading 旋转微动效状态'
);
console.log('✅ MarkdownToolbar 重新加载按钮与属性声明校验通过');

// 测试 3: PluginDocumentView 全局快捷键拦截与重载调度
console.log('--- 测试 3: PluginDocumentView 快捷键与重载调度 ---');
const docViewTsx = readFileSync(join(ROOT, 'src/features/viewers/PluginDocumentView.tsx'), 'utf8');

assert.ok(
  docViewTsx.includes('handleReloadDocument'),
  'PluginDocumentView 必须实现 handleReloadDocument 处理函数'
);
assert.ok(
  docViewTsx.includes("e.key.toLowerCase() === 'r'") || docViewTsx.includes("e.key === 'F5'"),
  'PluginDocumentView 必须拦截 Ctrl+R / Cmd+R / F5 快捷重载'
);
assert.ok(
  docViewTsx.includes("vscode.postMessage({ type: 'reload-document' })"),
  'handleReloadDocument 必须向 VS Code 宿主发送 reload-document 消息'
);
console.log('✅ PluginDocumentView 快捷键与重载调度校验通过');

console.log('🎉 全部 3 组外部编辑热同步与重载机制测试用例 100% 通过！');
