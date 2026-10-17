#!/usr/bin/env node
/**
 * OmniView OKF (Open Knowledge Format) 解析与元数据提取自动化测试套件
 */
import assert from 'node:assert';
import {
  parseOkfFrontmatter,
  isOkfMetadata,
  normalizeOkfTags,
} from '../src/features/viewers/lib/okfParser.ts';

console.log('🧪 开始 Google OKF (Open Knowledge Format) 解析器单元测试...');

// 测试 1: tags 归一化提取
console.log('--- 测试 1: tags 归一化与防御提取 ---');
assert.deepStrictEqual(normalizeOkfTags(['sales', 'revenue']), ['sales', 'revenue']);
assert.deepStrictEqual(normalizeOkfTags('sales, revenue, analytics'), ['sales', 'revenue', 'analytics']);
assert.deepStrictEqual(normalizeOkfTags('标签一，标签二,标签三'), ['标签一', '标签二', '标签三']);
assert.deepStrictEqual(normalizeOkfTags(null), []);
assert.deepStrictEqual(normalizeOkfTags(['  trimmed  ', '', null, 'valid']), ['trimmed', 'valid']);
console.log('✅ tags 归一化测试全部通过');

// 测试 2: OKF 规范识别校验 (isOkfMetadata)
console.log('--- 测试 2: OKF 规范识别校验 ---');
assert.strictEqual(isOkfMetadata({ type: 'BigQuery Table' }), true, '标准 OKF 包含 type 必须识别');
assert.strictEqual(isOkfMetadata({ type: 'Metric', tags: ['kpi'] }), true);
assert.strictEqual(isOkfMetadata({ tags: ['sales'], resource: 'https://example.com' }), true);
assert.strictEqual(isOkfMetadata({ title: 'Just a title' }), false, '无 type 与 OKF 组合的普通元数据应为 false');
assert.strictEqual(isOkfMetadata(null), false);
assert.strictEqual(isOkfMetadata('string'), false);
console.log('✅ OKF 规范识别校验全部通过');

// 测试 3: 完整的 Google OKF v0.1 概念文档解析
console.log('--- 测试 3: 完整 OKF v0.1 文档解析与正文剥离 ---');
const sampleOkfDoc = `---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, revenue]
timestamp: 2026-05-28T14:30:00Z
owner: data-eng@example.com
---

# Schema

| Column | Type |
|---|---|
| order_id | STRING |
`;

const res = parseOkfFrontmatter(sampleOkfDoc);
assert.strictEqual(res.hasFrontmatter, true);
assert.strictEqual(res.isOkf, true);
assert.ok(res.frontmatter);
assert.strictEqual(res.frontmatter.type, 'BigQuery Table');
assert.strictEqual(res.frontmatter.title, 'Orders');
assert.strictEqual(res.frontmatter.description, 'One row per completed customer order.');
assert.strictEqual(res.frontmatter.resource, 'https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders');
assert.deepStrictEqual(res.frontmatter.tags, ['sales', 'revenue']);
assert.strictEqual(res.frontmatter.timestamp, '2026-05-28T14:30:00Z');
assert.strictEqual(res.frontmatter.owner, 'data-eng@example.com');
assert.ok(res.markdownBody.startsWith('# Schema'), '正文应已剔除 frontmatter');
console.log('✅ 完整 OKF 文档解析测试通过');

// 测试 4: 普通 Markdown (无 Frontmatter) 的安全直通
console.log('--- 测试 4: 普通 Markdown 直通测试 ---');
const plainMd = `# Title\n\nJust regular markdown without frontmatter.`;
const plainRes = parseOkfFrontmatter(plainMd);
assert.strictEqual(plainRes.hasFrontmatter, false);
assert.strictEqual(plainRes.isOkf, false);
assert.strictEqual(plainRes.frontmatter, null);
assert.strictEqual(plainRes.markdownBody, plainMd);
console.log('✅ 普通 Markdown 直通测试通过');

// 测试 5: 非法/损坏的 YAML 容错降级
console.log('--- 测试 5: 非法 YAML 容错降级 ---');
const brokenYamlDoc = `---
type: [unclosed array
invalid: ::::
---

# Recovered Body
`;
const brokenRes = parseOkfFrontmatter(brokenYamlDoc);
assert.strictEqual(brokenRes.hasFrontmatter, true);
assert.strictEqual(brokenRes.isOkf, false);
assert.ok(brokenRes.error, '应捕获 YAML 语法错误');
assert.strictEqual(brokenRes.frontmatter, null);
assert.ok(brokenRes.markdownBody.includes('# Recovered Body'), '即使 YAML 解析失败也需保障正文保留');
console.log('✅ 非法 YAML 容错降级测试通过');

console.log('🎉 全部 5 组 OKF 解析与元数据提取单元测试 100% 通过！\n');
