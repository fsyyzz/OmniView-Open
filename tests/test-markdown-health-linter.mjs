#!/usr/bin/env node
/**
 * OmniView — Markdown 文档健康度与死链体检引擎单元测试套件 (RFC-0001)
 */
import assert from 'node:assert';
import { lintMarkdownHealth } from '../src/features/viewers/lib/markdownHealthLinter.ts';

console.log('🧪 开始 Markdown 文档健康度与死链体检引擎单元测试...\n');

// 1. 完美健康文档测试
console.log('--- 测试 1: 完美健康文档体检 ---');
const healthyDoc = `
# 一级标题
## 二级标题
### 三级标题

正文说明。
`;
const rep1 = lintMarkdownHealth(healthyDoc);
assert.strictEqual(rep1.isHealthy, true, '规范文档应判定为健康');
assert.strictEqual(rep1.score, 100, '健康得分应为 100');
assert.strictEqual(rep1.total, 0, '不应产生任何缺陷项');
console.log('✅ 完美健康文档体检通过');

// 2. 本地图片死链与 WikiLink 缺失检测
console.log('--- 测试 2: 本地图片死链与 WikiLink 缺失检测 ---');
const brokenAssetDoc = `
# 资产引用

有效外链图片:
![在线图片](https://example.com/logo.png)

失效本地相对图片:
![架构图](./docs/assets/missing-diagram.png)

失效 WikiLink:
参见详细架构 [[NonExistentDoc#Architecture]]。
`;

const mockFiles = [
  { name: 'README.md', path: '/README.md' },
  { name: 'logo.png', path: '/assets/logo.png' },
];

const rep2 = lintMarkdownHealth(brokenAssetDoc, { files: mockFiles, locale: 'zh-CN' });
assert.strictEqual(rep2.isHealthy, false, '存在资源缺失应判定为不健康');
assert.ok(rep2.warnings >= 2, '至少应产生 2 个警告');

const brokenImg = rep2.issues.find((i) => i.ruleId === 'broken-local-image');
assert.ok(brokenImg, '应命中 broken-local-image 规则');
assert.strictEqual(brokenImg.severity, 'warning');
assert.ok(brokenImg.message.includes('missing-diagram.png'), '提示信息应包含缺失图片文件名');

const brokenWiki = rep2.issues.find((i) => i.ruleId === 'broken-wikilink');
assert.ok(brokenWiki, '应命中 broken-wikilink 规则');
assert.ok(brokenWiki.message.includes('NonExistentDoc'), '提示信息应包含未找到的 WikiLink 文档名');
console.log('✅ 资源缺失与死链检测通过');

// 3. 标题层级跳跃检查 (H1 -> H3)
console.log('--- 测试 3: 标题层级跳跃检查 ---');
const skippedHeadingDoc = `
# 一级标题 (H1)
### 错误三级标题 (直接从 H1 跳到 H3)
`;
const rep3 = lintMarkdownHealth(skippedHeadingDoc);
const skipIssue = rep3.issues.find((i) => i.ruleId === 'heading-hierarchy-skip');
assert.ok(skipIssue, '应检测到标题层级断层');
assert.strictEqual(skipIssue.severity, 'info');
assert.strictEqual(skipIssue.line, 3);
console.log('✅ 标题层级跳跃检查通过');

// 4. 交叉引用一致性检查 (\ref 未定义与 \label 孤立)
console.log('--- 测试 4: 交叉引用一致性检查 ---');
const crossRefDoc = `
# 公式定义
$$ a^2 + b^2 = c^2 \\label{eq:pythagoras} $$

$$ e^{i\\pi} + 1 = 0 \\label{eq:euler} $$

正文仅引用了 \\eqref{eq:pythagoras}，以及一个未定义的 \\ref{fig:ghost}。
`;

const rep4 = lintMarkdownHealth(crossRefDoc);
const unrefIssue = rep4.issues.find((i) => i.ruleId === 'unreferenced-label');
assert.ok(unrefIssue, '应检测到孤立未引用的 eq:euler');
assert.ok(unrefIssue.message.includes('eq:euler'));

const unresolvedRef = rep4.issues.find((i) => i.ruleId === 'unresolved-cross-ref');
assert.ok(unresolvedRef, '应检测到未定义的 fig:ghost 引用');
assert.strictEqual(unresolvedRef.severity, 'error');
console.log('✅ 交叉引用一致性检查通过');

console.log('🎉 全部 4 组 Markdown 健康度与死链体检单元测试 100% 顺利通过！\n');

