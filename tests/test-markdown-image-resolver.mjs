#!/usr/bin/env node
/**
 * OmniView Markdown 本地图片与相对路径解析引擎自动化测试套件
 */
import assert from 'node:assert';
import { resolveMarkdownImageHref } from '../src/features/viewers/hooks/useMarkdownAstPipeline.ts';

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

console.log('🎉 全部 4 组 Markdown 本地图片与相对路径解析测试用例 100% 通过！\n');
