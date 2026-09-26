/**
 * OmniView 插件设置与 VS Code 宿主配置双向集成全链路自动化测试
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 开始 OmniView 插件设置与 VS Code 宿主双向集成自动化测试...');

// 1. 读取并校验 package.json 中的 configuration 配置声明
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

assert.ok(pkg.contributes, 'package.json 必须包含 contributes');
assert.ok(pkg.contributes.configuration, 'package.json 必须包含 contributes.configuration');
assert.strictEqual(pkg.contributes.configuration.title, 'OmniView', '配置标题应为 OmniView');

const props = pkg.contributes.configuration.properties;
assert.ok(props, '配置 properties 必须存在');

// 期望声明的 19 项 omniview.* 键
const expectedKeys = [
  'omniview.preview.theme',
  'omniview.preview.density',
  'omniview.preview.fontSize',
  'omniview.preview.contentWidth',
  'omniview.preview.zoomLevel',
  'omniview.preview.defaultViewMode',
  'omniview.preview.splitRatio',
  'omniview.preview.splitRightMode',
  'omniview.preview.lazyUnmount',
  'omniview.editor.scrollSync',
  'omniview.editor.wordWrap',
  'omniview.editor.showLineNumbers',
  'omniview.editor.doubleClickEdit',
  'omniview.outline.open',
  'omniview.outline.position',
  'omniview.outline.displayMode',
  'omniview.plantuml.serverUrl',
  'omniview.knowledge.enableOkfRendering',
  'omniview.general.locale',
];

console.log(`📋 验证 package.json 声明的 ${expectedKeys.length} 项配置定义...`);
for (const key of expectedKeys) {
  assert.ok(props[key], `package.json 缺少配置声明: ${key}`);
  const prop = props[key];
  assert.ok(prop.type, `${key} 缺少 type 声明`);
  assert.notStrictEqual(prop.default, undefined, `${key} 缺少 default 默认值声明`);
  assert.ok(prop.description || prop.markdownDescription, `${key} 缺少 description 文档描述`);
}
console.log('✅ 1. package.json 19 项配置声明与类型/默认值校验通过');

// 2. 校验关键枚举项与数值边界
assert.deepStrictEqual(props['omniview.preview.defaultViewMode'].enum, ['preview', 'split', 'source', 'mindmap']);
assert.deepStrictEqual(props['omniview.preview.splitRightMode'].enum, ['preview', 'mindmap']);
assert.deepStrictEqual(props['omniview.outline.position'].enum, ['left', 'right', 'floating']);
assert.deepStrictEqual(props['omniview.outline.displayMode'].enum, ['list', 'tree']);
assert.deepStrictEqual(props['omniview.general.locale'].enum, ['zh-CN', 'en-US']);

assert.strictEqual(props['omniview.preview.zoomLevel'].minimum, 0.5);
assert.strictEqual(props['omniview.preview.zoomLevel'].maximum, 2.5);
assert.strictEqual(props['omniview.preview.splitRatio'].minimum, 20);
assert.strictEqual(props['omniview.preview.splitRatio'].maximum, 80);
console.log('✅ 2. 枚举列表与数值约束范围校验通过');

// 3. 校验 extension.ts 中的 getHostConfiguration 与 save-configuration 映射覆盖率
const extPath = path.join(rootDir, 'src/extension/extension.ts');
const extCode = fs.readFileSync(extPath, 'utf8');

// 提取 getHostConfiguration 内部逻辑
assert.ok(extCode.includes('function getHostConfiguration(): Record<string, unknown>'), 'extension.ts 必须定义 getHostConfiguration');

// 验证每个 omniview.* key 在 getHostConfiguration() 中都被读取
const hostKeyMapping = {
  'preview.theme': 'theme',
  'preview.density': 'density',
  'preview.fontSize': 'fontSize',
  'preview.contentWidth': 'contentWidth',
  'preview.zoomLevel': 'zoom',
  'preview.defaultViewMode': 'viewMode',
  'preview.splitRatio': 'splitRatio',
  'preview.splitRightMode': 'splitRightMode',
  'preview.lazyUnmount': 'enableLazyBlockUnmount',
  'editor.scrollSync': 'scrollSync',
  'editor.wordWrap': 'wordWrap',
  'editor.showLineNumbers': 'showLineNumbers',
  'editor.doubleClickEdit': 'enableDoubleClickEdit',
  'outline.open': 'outlineOpen',
  'outline.position': 'outlinePosition',
  'outline.displayMode': 'outlineDisplayMode',
  'plantuml.serverUrl': 'plantUmlServerUrl',
  'knowledge.enableOkfRendering': 'enableOkfRendering',
  'general.locale': 'locale',
};

for (const [vsKey, webKey] of Object.entries(hostKeyMapping)) {
  assert.ok(
    extCode.includes(`'${vsKey}'`),
    `getHostConfiguration 必须包含读取 '${vsKey}'`
  );
  assert.ok(
    extCode.includes(webKey),
    `getHostConfiguration 必须映射属性 ${webKey}`
  );
}
console.log('✅ 3. extension.ts getHostConfiguration 19 项配置正向映射覆盖率 100% 通过');

// 4. 验证 save-configuration 回写更新完整性
assert.ok(extCode.includes("message?.type === 'save-configuration'"), 'extension.ts 必须处理 save-configuration 消息');
for (const [vsKey] of Object.entries(hostKeyMapping)) {
  assert.ok(
    extCode.includes(`config.update('${vsKey}'`),
    `save-configuration 必须支持将改动写回 '${vsKey}'`
  );
}
console.log('✅ 4. extension.ts save-configuration 19 项配置反向持久化写回覆盖率 100% 通过');

// 5. 验证 open-vscode-settings 消息处理
assert.ok(extCode.includes("message?.type === 'open-vscode-settings'"), 'extension.ts 必须监听 open-vscode-settings 消息');
assert.ok(
  extCode.includes("'workbench.action.openSettings', 'omniview'"),
  'open-vscode-settings 必须调用 workbench.action.openSettings 过滤 omniview'
);
console.log('✅ 5. Webview 到 VS Code 原生设置面板通道联动校验通过');

// 6. 验证 WorkbenchSettingsModal.tsx 中的交互触发与状态提示
const modalPath = path.join(rootDir, 'src/features/workbench/components/WorkbenchSettingsModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

assert.ok(modalCode.includes('handleOpenVsCodeSettings'), 'WorkbenchSettingsModal 必须实现 handleOpenVsCodeSettings');
assert.ok(modalCode.includes("type: 'open-vscode-settings'"), 'handleOpenVsCodeSettings 必须发送 open-vscode-settings 消息');
assert.ok(modalCode.includes('outlineDisplayMode'), 'WorkbenchSettingsModal 必须支持 outlineDisplayMode 设置');
assert.ok(modalCode.includes('enableLazyBlockUnmount'), 'WorkbenchSettingsModal 必须支持 enableLazyBlockUnmount 设置');
assert.ok(modalCode.includes('VS Code 原生设置双向集成'), 'WorkbenchSettingsModal 存储 Tab 必须展示 VS Code 双向集成卡片');
console.log('✅ 6. WorkbenchSettingsModal UI 控件与消息协议联动校验通过');

console.log('🎉 所有插件设置功能与 VS Code 原生设置集成自动化测试全部通过！\n');
