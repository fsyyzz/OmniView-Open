#!/usr/bin/env node
/**
 * OmniView VS Code 扩展深度集成特性单元测试套件
 * 包含：Activity Bar 资产全景树、Hover 悬浮微型预览、CodeLens 一键动作、DocumentSymbol 大纲符号与 StatusBar 联动
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('🧪 开始 OmniView VS Code 扩展深度集成特性单元测试...');

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const extSource = readFileSync(resolve(root, 'src/extension/extension.ts'), 'utf8');

// 1. 测试 Activity Bar 视图容器与 Views 配置
console.log('--- 测试 1: Activity Bar 视图容器与 Views 配置 ---');
const containers = pkg.contributes?.viewsContainers?.activitybar || [];
const assetContainer = containers.find(c => c.id === 'omniview-assets');
assert.ok(assetContainer, 'contributes.viewsContainers.activitybar 缺失 omniview-assets 容器');
assert.strictEqual(assetContainer.title, 'OmniView');

const views = pkg.contributes?.views?.['omniview-assets'] || [];
const assetView = views.find(v => v.id === 'omniview.assetExplorer');
assert.ok(assetView, 'contributes.views 缺失 omniview.assetExplorer 资产树视图');
assert.ok(assetView.name.includes('工作区'), '视图名称应具备中文语义标注');
console.log('✅ Activity Bar 与 Views 声明校验通过');

// 2. 测试 activationEvents 完整性
console.log('--- 测试 2: activationEvents 完整性 ---');
const activationEvents = pkg.activationEvents || [];
assert.ok(activationEvents.includes('onView:omniview.assetExplorer'), '缺失 onView:omniview.assetExplorer 激活事件');
assert.ok(activationEvents.includes('onCommand:omniview.refreshAssets'), '缺失 onCommand:omniview.refreshAssets 激活事件');
assert.ok(activationEvents.includes('onCommand:omniview.showQuickMenu'), '缺失 onCommand:omniview.showQuickMenu 激活事件');
console.log('✅ activationEvents 扩展事件校验通过');

// 3. 测试 commands 注册与图标
console.log('--- 测试 3: commands 注册与图标 ---');
const commands = pkg.contributes?.commands || [];
const refreshCmd = commands.find(c => c.command === 'omniview.refreshAssets');
const quickMenuCmd = commands.find(c => c.command === 'omniview.showQuickMenu');

assert.ok(refreshCmd, 'commands 中未找到 omniview.refreshAssets');
assert.strictEqual(refreshCmd.icon, '$(refresh)', 'refreshAssets 应配置 $(refresh) 图标');

assert.ok(quickMenuCmd, 'commands 中未找到 omniview.showQuickMenu');
assert.strictEqual(quickMenuCmd.icon, '$(menu)', 'showQuickMenu 应配置 $(menu) 图标');
console.log('✅ commands 注册与图标校验通过');

// 4. 测试 view/title 资产树顶栏工具
console.log('--- 测试 4: view/title 资产树顶栏工具 ---');
const viewTitleMenus = pkg.contributes?.menus?.['view/title'] || [];
const treeRefreshBtn = viewTitleMenus.find(m => m.command === 'omniview.refreshAssets' && m.when === 'view == omniview.assetExplorer');
const treeCreateBtn = viewTitleMenus.find(m => m.command === 'omniview.createNewFile' && m.when === 'view == omniview.assetExplorer');
const treeWorkbenchBtn = viewTitleMenus.find(m => m.command === 'omniview.openWorkbench' && m.when === 'view == omniview.assetExplorer');

assert.ok(treeRefreshBtn, 'view/title 缺失 assetExplorer 树刷新按钮');
assert.ok(treeCreateBtn, 'view/title 缺失 assetExplorer 树新建模板按钮');
assert.ok(treeWorkbenchBtn, 'view/title 缺失 assetExplorer 树打开工作台按钮');
console.log('✅ view/title 资产树工具按钮校验通过');

// 5. 测试 extension.ts 源码中 5 大原生 Provider 及 StatusBar 实现
console.log('--- 测试 5: extension.ts 原生 Provider 与组件实现 ---');
assert.ok(extSource.includes('class OmniViewAssetTreeDataProvider'), '缺失 OmniViewAssetTreeDataProvider 树视图提供者类');
assert.ok(extSource.includes('class OmniViewHoverProvider'), '缺失 OmniViewHoverProvider 悬浮微型预览类');
assert.ok(extSource.includes('class OmniViewCodeLensProvider'), '缺失 OmniViewCodeLensProvider 一键动作类');
assert.ok(extSource.includes('class OmniViewDocumentSymbolProvider'), '缺失 OmniViewDocumentSymbolProvider 大纲符号类');
assert.ok(extSource.includes('vscode.window.createStatusBarItem'), '缺失 StatusBarItem 状态栏管理');
assert.ok(extSource.includes("vscode.commands.registerCommand('omniview.showQuickMenu'"), '缺失 showQuickMenu 控制中心命令');

// 验证分类覆盖
assert.ok(extSource.includes('arch:'), 'AssetTree 必须包含架构图分类');
assert.ok(extSource.includes('whiteboard:'), 'AssetTree 必须包含白板分类');
assert.ok(extSource.includes('document:'), 'AssetTree 必须包含文档分类');
assert.ok(extSource.includes('data:'), 'AssetTree 必须包含数据表格分类');
assert.ok(extSource.includes('knowledge:'), 'AssetTree 必须包含思维导图知识库分类');

console.log('✅ extension.ts 5 大原生能力实现与分类覆盖校验通过');

console.log('🎉 全部 5 组 VS Code 深度集成特性单元测试 100% 通过！\n');
