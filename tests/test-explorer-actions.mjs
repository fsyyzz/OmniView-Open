#!/usr/bin/env node
/**
 * OmniView VS Code 左侧资源管理器工具条与文件项内联快捷操作单元测试套件
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('🧪 开始 VS Code 资源管理器快捷工具条与 Inline Action 自动化单元测试...');

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const extSource = readFileSync(resolve(root, 'src/extension/extension.ts'), 'utf8');

// 1. 测试 activationEvents 完整性
console.log('--- 测试 1: activationEvents 完整性 ---');
const activationEvents = pkg.activationEvents || [];
assert.ok(activationEvents.includes('onCommand:omniview.createNewFile'), '缺失 onCommand:omniview.createNewFile 激活事件');
assert.ok(activationEvents.includes('onCommand:omniview.openWorkbench'), '缺失 onCommand:omniview.openWorkbench 激活事件');
console.log('✅ activationEvents 校验通过');

// 2. 测试 commands 注册定义
console.log('--- 测试 2: commands 注册定义 ---');
const commands = pkg.contributes?.commands || [];
const createNewFileCmd = commands.find(c => c.command === 'omniview.createNewFile');
const openWorkbenchCmd = commands.find(c => c.command === 'omniview.openWorkbench');
const openSidePreviewCmd = commands.find(c => c.command === 'omniview.openSidePreview');
const openSideBySideCmd = commands.find(c => c.command === 'omniview.openSideBySide');

assert.ok(createNewFileCmd, 'commands 中未找到 omniview.createNewFile');
assert.strictEqual(createNewFileCmd.icon, '$(sparkle)', 'createNewFile 应使用 $(sparkle) 图标');

assert.ok(openWorkbenchCmd, 'commands 中未找到 omniview.openWorkbench');
assert.strictEqual(openWorkbenchCmd.icon, '$(preview)', 'openWorkbench 应使用 $(preview) 图标');

assert.ok(openSidePreviewCmd, 'commands 中未找到 omniview.openSidePreview');
assert.strictEqual(openSidePreviewCmd.icon, '$(eye)', 'openSidePreview 应配置直观的 $(eye) 图标');

assert.ok(openSideBySideCmd, 'commands 中未找到 omniview.openSideBySide');
assert.strictEqual(openSideBySideCmd.icon, '$(split-horizontal)', 'openSideBySide 应配置 $(split-horizontal) 图标');
console.log('✅ commands 注册与图标配置校验通过');

// 3. 测试 menus.view/title (资源管理器顶栏工具条)
console.log('--- 测试 3: view/title 顶栏工具按钮 ---');
const viewTitleMenus = pkg.contributes?.menus?.['view/title'] || [];
const titleCreateBtn = viewTitleMenus.find(m => m.command === 'omniview.createNewFile');
const titleWorkbenchBtn = viewTitleMenus.find(m => m.command === 'omniview.openWorkbench');

assert.ok(titleCreateBtn, 'view/title 缺失 createNewFile 工具按钮');
assert.strictEqual(titleCreateBtn.when, 'view == workbench.explorer.fileView');
assert.strictEqual(titleCreateBtn.group, 'navigation@1');

assert.ok(titleWorkbenchBtn, 'view/title 缺失 openWorkbench 工具按钮');
assert.strictEqual(titleWorkbenchBtn.when, 'view == workbench.explorer.fileView');
assert.strictEqual(titleWorkbenchBtn.group, 'navigation@2');
console.log('✅ view/title 资源管理器顶栏工具条定义校验通过');

// 4. 测试 menus.view/item/context 与 explorer/context (文件悬浮内联图标)
console.log('--- 测试 4: 文件行内联悬浮图标 (Inline Action) ---');
const viewItemContext = pkg.contributes?.menus?.['view/item/context'] || [];
const explorerContext = pkg.contributes?.menus?.['explorer/context'] || [];

const itemInlinePreview = viewItemContext.find(m => m.command === 'omniview.openSidePreview' && m.group === 'inline@1');
const itemInlineSideBySide = viewItemContext.find(m => m.command === 'omniview.openSideBySide' && m.group === 'inline@2');
assert.ok(itemInlinePreview, 'view/item/context 缺失 openSidePreview inline 按钮');
assert.ok(itemInlineSideBySide, 'view/item/context 缺失 openSideBySide inline 按钮');

const explorerInlinePreview = explorerContext.find(m => m.command === 'omniview.openSidePreview' && m.group === 'inline@1');
const explorerInlineSideBySide = explorerContext.find(m => m.command === 'omniview.openSideBySide' && m.group === 'inline@2');
assert.ok(explorerInlinePreview, 'explorer/context 缺失 openSidePreview inline 按钮');
assert.ok(explorerInlineSideBySide, 'explorer/context 缺失 openSideBySide inline 按钮');

// 右键普通菜单仍然得到保留
const explorerContextPreview = explorerContext.find(m => m.command === 'omniview.openSidePreview' && m.group === 'omniview@2');
const explorerContextSideBySide = explorerContext.find(m => m.command === 'omniview.openSideBySide' && m.group === 'omniview@1');
assert.ok(explorerContextPreview && explorerContextSideBySide, 'explorer/context 右键菜单项需完整保留');
console.log('✅ 资源管理器 inline 悬浮图标与右键菜单校验通过');

// 5. 测试 extension.ts 源码中的命令实现与事件绑定
console.log('--- 测试 5: extension.ts 源码命令实现校验 ---');
assert.ok(extSource.includes("vscode.commands.registerCommand('omniview.createNewFile'"), 'extension.ts 缺失 createNewFile 命令注册');
assert.ok(extSource.includes("vscode.commands.registerCommand('omniview.openWorkbench'"), 'extension.ts 缺失 openWorkbench 命令注册');
assert.ok(extSource.includes("showQuickPick(templateOptions"), 'createNewFile 必须支持 QuickPick 模板多维选择');
assert.ok(extSource.includes("createWebviewPanel"), 'openWorkbench 必须调用 createWebviewPanel');
console.log('✅ extension.ts 核心命令实现与逻辑绑定校验通过');

console.log('🎉 全部 5 组 VS Code 资源管理器快捷工具条与 Inline Action 测试用例 100% 通过！\n');
