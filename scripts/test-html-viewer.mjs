#!/usr/bin/env node
/**
 * OmniView HTML5 网页与沙箱工作台 (HtmlViewer / HtmlStudio) 自动化单元测试套件
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { getDriverIdForFile, resolveDriverPluginForFile } from '../src/features/viewers/lib/driverRegistry.ts';

const rootDir = process.cwd();

console.log('🧪 开始 HTML5 网页与沙箱工作台 (HtmlViewer) 自动化单元测试...');

function mockFile(name, content = '') {
  const extension = name.split('.').pop() || '';
  return {
    id: `file_${Date.now()}_${Math.random()}`,
    name,
    extension,
    content,
    size: content.length,
    lastModified: Date.now(),
  };
}

// ========================================================
// 1. 路由识别与驱动解析断言测试
// ========================================================
console.log('--- 测试 1: 文件名与后缀路由识别 ---');

assert.strictEqual(getDriverIdForFile(mockFile('index.html')), 'html', 'index.html 路由识别失败');
assert.strictEqual(getDriverIdForFile(mockFile('about.htm')), 'html', 'about.htm 路由识别失败');
assert.strictEqual(getDriverIdForFile(mockFile('dashboard.HTML')), 'html', '大写 .HTML 扩展名路由识别失败');

const plugin = resolveDriverPluginForFile(mockFile('page.html'));
assert.strictEqual(plugin.id, 'html', 'resolveDriverPluginForFile 未返回 html 驱动');
assert.strictEqual(plugin.supportsSplitView, true, 'html 驱动应声明支持内置分屏编辑');

console.log('✅ 1. 文件路由与插件解析测试全部通过');

// ========================================================
// 2. 沙箱安全性与 iframe 属性静态断言 (最高优先级安全红线)
// ========================================================
console.log('--- 测试 2: 双层沙箱隔离与 XSS 防护静态断言 ---');

const viewerSource = fs.readFileSync(
  path.join(rootDir, 'src/features/viewers/components/drivers/HtmlViewer.tsx'),
  'utf-8'
);

// 2.1 提取 <iframe ... /> 标签定义
const iframeMatch = viewerSource.match(/<iframe[\s\S]*?\/>/);
assert.ok(iframeMatch, 'HtmlViewer 必须包含 iframe 渲染容器');
const iframeTag = iframeMatch[0];

// 2.2 确保 sandbox 具备安全属性
assert.ok(
  iframeTag.includes('allow-scripts allow-forms allow-modals'),
  'HtmlViewer 必须配置安全 sandbox 属性'
);

// 2.3 确保严格禁止 allow-same-origin (防止访问宿主 window.parent 与 vs code API)
assert.ok(
  !iframeTag.includes('allow-same-origin'),
  '🚨 严禁在 HtmlViewer iframe sandbox 中配置 allow-same-origin！'
);

// 2.4 确保严格禁止 allow-top-navigation (防止子页面篡改宿主顶级页面)
assert.ok(
  !iframeTag.includes('allow-top-navigation'),
  '🚨 严禁在 HtmlViewer iframe sandbox 中配置 allow-top-navigation！'
);

// 2.5 确保配置 referrerPolicy
assert.ok(
  iframeTag.includes('referrerPolicy="no-referrer"'),
  'HtmlViewer 必须配置 referrerPolicy="no-referrer"'
);

console.log('✅ 2. 双层沙箱隔离与安全红线防御校验通过');

// ========================================================
// 3. 视口设备仿真与底色配置能力测试
// ========================================================
console.log('--- 测试 3: 多设备视口仿真 (Desktop/Tablet/Mobile) 与底色断言 ---');

assert.ok(viewerSource.includes("'desktop'"), '必须支持 desktop 视口');
assert.ok(viewerSource.includes("'tablet'"), '必须支持 tablet 视口');
assert.ok(viewerSource.includes("'mobile'"), '必须支持 mobile 视口');
assert.ok(viewerSource.includes('375px'), '移动端视口需定义 375px 经典宽度');
assert.ok(viewerSource.includes('768px'), '平板视口需定义 768px 经典宽度');

assert.ok(viewerSource.includes("'checkerboard'"), '必须支持透明网格背景');
assert.ok(viewerSource.includes("'white'"), '必须支持纯白背景');
assert.ok(viewerSource.includes("'dark'"), '必须支持暗黑背景');
assert.ok(viewerSource.includes("'system'"), '必须支持跟随系统主题背景');

console.log('✅ 3. 设备视口与底色能力断言全部通过');

// ========================================================
// 4. 插件清单与扩展注册完整性验证
// ========================================================
console.log('--- 测试 4: VS Code 插件清单 package.json 与 extension.ts 注册 ---');

const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const editorSelectors = pkgJson.contributes.customEditors[0].selector;
const hasHtmlSelector = editorSelectors.some(s => s.filenamePattern === '*.html');
const hasHtmSelector = editorSelectors.some(s => s.filenamePattern === '*.htm');
assert.ok(hasHtmlSelector, 'package.json customEditors 中缺失 *.html');
assert.ok(hasHtmSelector, 'package.json customEditors 中缺失 *.htm');

const extensionSource = fs.readFileSync(path.join(rootDir, 'src/extension/extension.ts'), 'utf-8');
assert.ok(extensionSource.includes("'.html'"), 'extension.ts SUPPORTED_EXTENSIONS 缺失 .html');
assert.ok(extensionSource.includes("'.htm'"), 'extension.ts SUPPORTED_EXTENSIONS 缺失 .htm');

const samplePath = path.join(rootDir, 'examples/html/interactive-dashboard.html');
assert.ok(fs.existsSync(samplePath), 'examples/html/interactive-dashboard.html 示例文件不存在');

console.log('✅ 4. 扩展清单配置与示例文件完整性验证通过');

console.log('\n🎉 所有 HTML5 网页与沙箱工作台自动化单元测试 100% 成功！\n');
