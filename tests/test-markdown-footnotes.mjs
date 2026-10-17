#!/usr/bin/env node
/**
 * GFM / Pandoc 风格 Markdown 脚注预处理回归测试
 */
import assert from 'node:assert';
import { processMarkdownFootnotes } from '../src/features/viewers/lib/markdownFootnotes.ts';

console.log('🧪 开始 Markdown 脚注 (GFM [^id] / 定义段) 单元测试...');

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message || `expected to include: ${needle}`);
}

function assertNotIncludes(haystack, needle, message) {
  assert.ok(!haystack.includes(needle), message || `expected NOT to include: ${needle}`);
}

// 1. 基础引用 + 定义
console.log('--- 测试 1: 基础脚注引用与定义 ---');
{
  const src = [
    'See note[^note] here.',
    '',
    '[^note]: Footnote body with **bold**.',
  ].join('\n');

  const { markdown, footnoteCount } = processMarkdownFootnotes(src, {
    sectionTitle: 'Footnotes',
    renderBody: (md) => `<p>${md}</p>`,
  });

  assert.strictEqual(footnoteCount, 1);
  assertIncludes(markdown, 'class="ov-footnote-ref"');
  assertIncludes(markdown, 'href="#fn-1"');
  assertIncludes(markdown, 'id="fnref-1"');
  assertIncludes(markdown, 'data-footnotes');
  assertIncludes(markdown, 'id="fn-1"');
  assertIncludes(markdown, 'Footnote body with **bold**.');
  assertNotIncludes(markdown, '[^note]:');
  assertIncludes(markdown, '<h2 class="ov-footnotes-title">Footnotes</h2>');
}
console.log('✅ 基础脚注测试通过');

// 2. 多引用同一定义、编号按首次出现
console.log('--- 测试 2: 多引用共享定义与编号顺序 ---');
{
  const src = [
    'First B[^b], then A[^a], again B[^b].',
    '',
    '[^a]: Alpha',
    '[^b]: Beta',
  ].join('\n');

  const { markdown, footnoteCount } = processMarkdownFootnotes(src, {
    renderBody: (md) => md,
  });

  assert.strictEqual(footnoteCount, 2);
  // B first -> 1; A -> 2
  assert.match(markdown, /href="#fn-1"[^>]*>1<\/a>/);
  assert.match(markdown, /href="#fn-2"[^>]*>2<\/a>/);
  assertIncludes(markdown, 'id="fnref-1"');
  assertIncludes(markdown, 'id="fnref-1-2"');
  assertIncludes(markdown, 'data-footnote-id="b"');
  assertIncludes(markdown, 'data-footnote-id="a"');
  assertIncludes(markdown, 'Beta');
  assertIncludes(markdown, 'Alpha');
}
console.log('✅ 多引用编号测试通过');

// 3. 缩进续行定义
console.log('--- 测试 3: 多行缩进续行定义 ---');
{
  const src = [
    'See long note[^long].',
    '',
    '[^long]: Line one',
    '    continued two',
    '',
    '    continued three still footnote',
    '',
    'Main text continues.',
  ].join('\n');

  const { markdown, footnoteCount } = processMarkdownFootnotes(src, {
    renderBody: (md) => md,
  });

  assert.strictEqual(footnoteCount, 1);
  assertIncludes(markdown, 'Line one');
  assertIncludes(markdown, 'continued two');
  assertIncludes(markdown, 'continued three still footnote');
  assertIncludes(markdown, 'Main text continues.');
  assertNotIncludes(markdown, '[^long]:');
}
console.log('✅ 多行定义测试通过');

// 4. 代码块与行内代码保护
console.log('--- 测试 4: 代码块 / 行内代码不被误解析 ---');
{
  const src = [
    'Real footnote[^real].',
    '',
    'Inline `[^fake]` and fence:',
    '```',
    '[^fake]: should-not-extract',
    'mention [^fake]',
    '```',
    '',
    '[^real]: real-definition',
  ].join('\n');

  const { markdown, footnoteCount } = processMarkdownFootnotes(src, {
    renderBody: (md) => md,
  });

  assert.strictEqual(footnoteCount, 1);
  assertIncludes(markdown, '`[^fake]`');
  assertIncludes(markdown, '[^fake]: should-not-extract');
  assertIncludes(markdown, 'mention [^fake]');
  assertIncludes(markdown, 'real-definition');
  assertNotIncludes(markdown, 'id="fn-2"');
}
console.log('✅ 代码保护测试通过');

// 5. 未定义引用保留原样；未引用定义不进列表
console.log('--- 测试 5: 未定义引用与未使用定义 ---');
{
  const src = [
    'Defined[^ok], missing[^missing].',
    '',
    '[^ok]: present-body',
    '[^orphan]: never-referenced',
  ].join('\n');

  const { markdown, footnoteCount } = processMarkdownFootnotes(src, {
    renderBody: (md) => md,
  });

  assert.strictEqual(footnoteCount, 1);
  assertIncludes(markdown, '[^missing]');
  assertIncludes(markdown, 'present-body');
  assertNotIncludes(markdown, 'never-referenced');
  assertNotIncludes(markdown, '[^ok]:');
}
console.log('✅ 边界降级测试通过');

// 6. XSS 属性转义（标题）
console.log('--- 测试 6: 标题 HTML 转义 ---');
{
  const { markdown } = processMarkdownFootnotes('x[^1]\n\n[^1]: safe', {
    sectionTitle: '<script>alert(1)</script>',
    renderBody: (md) => md,
  });
  assertNotIncludes(markdown, '<script>alert(1)</script>');
  assertIncludes(markdown, '&lt;script&gt;alert(1)&lt;/script&gt;');
}
console.log('✅ XSS 标题转义测试通过');

console.log('🎉 Markdown 脚注单元测试全部通过');
