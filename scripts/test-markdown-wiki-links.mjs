#!/usr/bin/env node
/**
 * Obsidian Wiki 链接与嵌入预处理回归测试
 */
import assert from 'node:assert';
import {
  parseWikiLinkInner,
  processMarkdownWikiLinks,
  resolveWikiTarget,
  slugifyHeading,
} from '../src/features/viewers/lib/markdownWikiLinks.ts';

console.log('🧪 开始 Obsidian Wiki 链接 / 嵌入单元测试...');

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message || `expected to include: ${needle}`);
}

function assertNotIncludes(haystack, needle, message) {
  assert.ok(!haystack.includes(needle), message || `expected NOT to include: ${needle}`);
}

// 1. 解析内部片段
console.log('--- 测试 1: parseWikiLinkInner ---');
{
  assert.deepStrictEqual(parseWikiLinkInner('Page'), {
    target: 'Page',
    heading: undefined,
    blockId: undefined,
    alias: undefined,
  });
  assert.deepStrictEqual(parseWikiLinkInner('Page|Alias Text'), {
    target: 'Page',
    heading: undefined,
    blockId: undefined,
    alias: 'Alias Text',
  });
  assert.deepStrictEqual(parseWikiLinkInner('Page#Heading'), {
    target: 'Page',
    heading: 'Heading',
    blockId: undefined,
    alias: undefined,
  });
  assert.deepStrictEqual(parseWikiLinkInner('#Local'), {
    target: '',
    heading: 'Local',
    blockId: undefined,
    alias: undefined,
  });
  assert.deepStrictEqual(parseWikiLinkInner('Note#^block-id|Label'), {
    target: 'Note',
    heading: undefined,
    blockId: 'block-id',
    alias: 'Label',
  });
}
console.log('✅ parseWikiLinkInner 通过');

// 2. 基础链接
console.log('--- 测试 2: [[Page]] / alias / heading ---');
{
  const files = [
    { name: 'Architecture.md', content: '# Arch\nBody', extension: 'md' },
    { name: 'basic-markdown.md', content: 'hello', extension: 'md' },
  ];
  const src = 'See [[Architecture]] and [[Architecture|系统架构]] then [[Architecture#Heading]].';
  const { markdown, linkCount, embedCount } = processMarkdownWikiLinks(src, { files });
  assert.strictEqual(linkCount, 3);
  assert.strictEqual(embedCount, 0);
  assertIncludes(markdown, 'data-wiki-link="true"');
  assertIncludes(markdown, 'data-wiki-target="Architecture"');
  assertIncludes(markdown, '>Architecture</a>');
  assertIncludes(markdown, '>系统架构</a>');
  assertIncludes(markdown, 'data-wiki-heading="Heading"');
  assertIncludes(markdown, 'href="Architecture.md"');
  assertNotIncludes(markdown, 'ov-wiki-link--missing');
}
console.log('✅ 基础链接通过');

// 3. 缺失链接标记
console.log('--- 测试 3: 缺失目标标记 ---');
{
  const { markdown } = processMarkdownWikiLinks('Go [[MissingPage]]', {
    files: [{ name: 'other.md', content: 'x', extension: 'md' }],
    unresolvedLabel: 'Unresolved',
  });
  assertIncludes(markdown, 'ov-wiki-link--missing');
  assertIncludes(markdown, 'Unresolved: MissingPage');
}
console.log('✅ 缺失标记通过');

// 4. 图片嵌入与宽度
console.log('--- 测试 4: ![[image]] 与宽度 ---');
{
  const { markdown, embedCount } = processMarkdownWikiLinks('Pic ![[diagram.png]] and ![[diagram.png|320]]');
  assert.strictEqual(embedCount, 2);
  assertIncludes(markdown, 'ov-wiki-embed--image');
  assertIncludes(markdown, 'src="diagram.png"');
  assertIncludes(markdown, 'width="320"');
}
console.log('✅ 图片嵌入通过');

// 5. 笔记嵌入预览
console.log('--- 测试 5: ![[note]] 嵌入预览 ---');
{
  const files = [
    {
      name: 'guide.md',
      extension: 'md',
      content: '---\ntitle: Guide\n---\n\n# Guide\n\nFirst paragraph of the guide.',
    },
  ];
  const { markdown, embedCount } = processMarkdownWikiLinks('Embed ![[guide]] here', {
    files,
    embedLabel: 'Embed',
    openLabel: 'Open',
  });
  assert.strictEqual(embedCount, 1);
  assertIncludes(markdown, 'ov-wiki-embed--note');
  assertIncludes(markdown, 'First paragraph of the guide.');
  assertNotIncludes(markdown, 'title: Guide');
  assertIncludes(markdown, 'ov-wiki-embed-open');
}
console.log('✅ 笔记嵌入通过');

// 6. 代码保护
console.log('--- 测试 6: 代码块不被误解析 ---');
{
  const src = [
    'Real [[Page]]',
    '',
    'Inline `[[fake]]`',
    '```',
    '[[fake]]',
    '![[fake.png]]',
    '```',
  ].join('\n');
  const { markdown, linkCount, embedCount } = processMarkdownWikiLinks(src, {
    files: [{ name: 'Page.md', content: 'x', extension: 'md' }],
  });
  assert.strictEqual(linkCount, 1);
  assert.strictEqual(embedCount, 0);
  assertIncludes(markdown, '`[[fake]]`');
  assertIncludes(markdown, '[[fake]]');
  assertIncludes(markdown, '![[fake.png]]');
}
console.log('✅ 代码保护通过');

// 7. resolve + slug
console.log('--- 测试 7: resolveWikiTarget / slugifyHeading ---');
{
  const files = [
    { name: 'gfm-features.md', content: '', extension: 'md', path: '/examples/markdown/gfm-features.md' },
  ];
  assert.ok(resolveWikiTarget('gfm-features', files));
  assert.ok(resolveWikiTarget('gfm-features.md', files));
  assert.strictEqual(resolveWikiTarget('nope', files), null);
  assert.strictEqual(slugifyHeading('Hello World'), 'hello-world');
  assert.strictEqual(slugifyHeading('中文标题'), '中文标题');
}
console.log('✅ resolve/slug 通过');

// 8. 当前文档标题链接
console.log('--- 测试 8: [[#Heading]] ---');
{
  const { markdown } = processMarkdownWikiLinks('Jump [[#安装说明]]');
  assertIncludes(markdown, 'data-wiki-heading="安装说明"');
  assertIncludes(markdown, 'href="#安装说明"');
}
console.log('✅ 页内标题链接通过');

console.log('🎉 Obsidian Wiki 链接 / 嵌入单元测试全部通过');
