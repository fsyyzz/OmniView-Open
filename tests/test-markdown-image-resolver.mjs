#!/usr/bin/env node
/**
 * OmniView Markdown 本地图片与相对路径解析引擎自动化测试套件
 */
import assert from 'node:assert';
import {
  resolveMarkdownImageHref,
  parseMarkdownImageModifiers,
  processInlineSvgImages,
} from '../src/features/viewers/hooks/useMarkdownAstPipeline.ts';

console.log('🧪 开始 Markdown 本地图片与相对路径解析引擎单元测试...');

// 1. 测试外部网络图片与 Data URI 的直通
console.log('--- 测试 1: 绝对协议头与 Data URI 直通 ---');
assert.strictEqual(
  resolveMarkdownImageHref('https://example.com/banner.png', []),
  'https://example.com/banner.png'
);
assert.strictEqual(
  resolveMarkdownImageHref('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', []),
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
);
assert.strictEqual(
  resolveMarkdownImageHref('vscode-webview://test-id/assets/pic.png', []),
  'vscode-webview://test-id/assets/pic.png'
);
console.log('✅ 协议直通测试通过');

// 2. 测试本地相对图片通过 binaryUrl (Webview URI) 解析
console.log('--- 测试 2: 相对路径通过 binaryUrl 解析 ---');
const mockFilesWithBinaryUrl = [
  {
    name: 'omniview-showcase.png',
    path: '/Users/test/project/docs/assets/omniview-showcase.png',
    extension: 'png',
    content: 'iVBORw0KGgoAAAANSUhEUgAA',
    binaryUrl: 'vscode-webview://static-hash/docs/assets/omniview-showcase.png',
  },
];

assert.strictEqual(
  resolveMarkdownImageHref('./docs/assets/omniview-showcase.png', mockFilesWithBinaryUrl),
  'vscode-webview://static-hash/docs/assets/omniview-showcase.png',
  '应优先解析为 Webview 的 binaryUrl'
);
assert.strictEqual(
  resolveMarkdownImageHref('docs/assets/omniview-showcase.png', mockFilesWithBinaryUrl),
  'vscode-webview://static-hash/docs/assets/omniview-showcase.png',
  '不带 ./ 的相对路径应同样成功匹配'
);
assert.strictEqual(
  resolveMarkdownImageHref('omniview-showcase.png', mockFilesWithBinaryUrl),
  'vscode-webview://static-hash/docs/assets/omniview-showcase.png',
  '仅文件名应同样成功匹配'
);
console.log('✅ binaryUrl 解析测试通过');

// 3. 测试本地相对图片通过 Base64 content 降级合成 Data URI
console.log('--- 测试 3: 相对路径通过 Base64 content 转换为 Data URI ---');
const mockFilesWithBase64Only = [
  {
    name: 'architecture.png',
    path: '/Users/test/project/assets/architecture.png',
    extension: 'png',
    content: 'iVBORw0KGgoAAAANSUhEUgAA_BASE64_DATA',
  },
  {
    name: 'logo.svg',
    path: '/Users/test/project/logo.svg',
    extension: 'svg',
    content: '<svg><circle cx="5" cy="5" r="5"/></svg>',
  },
];

const resolvedPng = resolveMarkdownImageHref('./assets/architecture.png', mockFilesWithBase64Only);
assert.strictEqual(
  resolvedPng,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA_BASE64_DATA',
  '位图应合成规范的 data:image/png;base64 DataURI'
);

const resolvedSvg = resolveMarkdownImageHref('./logo.svg', mockFilesWithBase64Only);
assert.ok(
  resolvedSvg.startsWith('data:image/svg+xml;utf8,'),
  'SVG 矢量图应合成 data:image/svg+xml;utf8 DataURI'
);
console.log('✅ Base64 / SVG 降级合成测试通过');

// 4. 测试未命中文件池时的安全防崩溃降级
console.log('--- 测试 4: 未知资源安全降级 ---');
assert.strictEqual(
  resolveMarkdownImageHref('./non-existent.png', mockFilesWithBinaryUrl),
  './non-existent.png',
  '未命中的图片应安全保留原始路径'
);
assert.strictEqual(
  resolveMarkdownImageHref('', mockFilesWithBinaryUrl),
  '',
  '空路径安全返回空'
);
console.log('✅ 安全防崩溃降级测试通过');

// 5. 测试 GitHub Alert 优雅降级思想图片轻量管道修饰符与主题感知后缀
console.log('--- 测试 5: 图片管道修饰符与 #gh-dark-mode-only / #gh-light-mode-only 解析 ---');
const mod1 = parseMarkdownImageModifiers('系统架构拓扑|520|bg-light|center|caption', './assets/arch.png#gh-dark-mode-only', '');
assert.strictEqual(mod1.cleanAlt, '系统架构拓扑', '应剥离管道修饰符保留干净 alt');
assert.strictEqual(mod1.showCaption, true, '指定 |caption 应激活图注显示');
assert.strictEqual(mod1.captionText, '系统架构拓扑', '未提供 title 时应回退使用 cleanAlt 作为图注');
assert.strictEqual(mod1.plate, 'light', '应识别 bg-light 浅色衬底板');
assert.strictEqual(mod1.align, 'center', '应识别 center 居中对齐');
assert.strictEqual(mod1.themeVisibility, 'dark-only', '应识别 #gh-dark-mode-only 仅深色主题显示');
assert.ok(mod1.styleAttr.includes('max-width: 520px;'), '应生成 520px 宽度内联样式');
assert.ok(mod1.extraClasses.includes('ov-img-plate-light'), '应注入 ov-img-plate-light 类名');
assert.ok(mod1.extraClasses.includes('ov-img-dark-only'), '应注入 ov-img-dark-only 类名');

const mod2 = parseMarkdownImageModifiers('用户头像|80x80|circle|bg-checker', './avatar.png#gh-light-mode-only', '图 1: 核心维护者');
assert.strictEqual(mod2.cleanAlt, '用户头像');
assert.strictEqual(mod2.showCaption, true, '提供 title 时自动启用图注');
assert.strictEqual(mod2.captionText, '图 1: 核心维护者');
assert.strictEqual(mod2.plate, 'checker');
assert.strictEqual(mod2.themeVisibility, 'light-only');
assert.ok(mod2.styleAttr.includes('max-width: 80px; max-height: 80px;'));
assert.ok(mod2.extraClasses.includes('ov-img-circle'));
assert.ok(mod2.extraClasses.includes('ov-img-light-only'));
// 6. 测试内联未编码 SVG 图片预处理转义自愈
console.log('--- 测试 6: 内联未编码 SVG 图片预处理转义自愈 ---');
const rawMd = '![测试图件](data:image/svg+xml;utf8,<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>)';
const processedMd = processInlineSvgImages(rawMd);
assert.ok(!processedMd.includes('<svg'), '预处理后不应包含裸尖括号 <svg');
assert.ok(processedMd.includes('%3Csvg'), '预处理后应对 <svg 进行 URL 编码');
console.log('✅ 内联 SVG 预处理测试通过');

console.log('🎉 全部 6 组 Markdown 本地图片、管道修饰符、主题感知与内联 SVG 自愈测试用例 100% 通过！\n');
