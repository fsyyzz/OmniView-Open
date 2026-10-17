#!/usr/bin/env node
/**
 * Pandoc 定义列表 + emoji shortcode 回归测试
 */
import assert from 'node:assert';
import { processMarkdownDefinitionLists } from '../src/features/viewers/lib/markdownDefinitionLists.ts';
import {
  processEmojiShortcodes,
  resolveEmojiShortcode,
} from '../src/features/viewers/lib/markdownEmojiShortcodes.ts';

console.log('🧪 开始 Pandoc 定义列表 / emoji shortcode 单元测试...');

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message || `expected to include: ${needle}`);
}

function assertNotIncludes(haystack, needle, message) {
  assert.ok(!haystack.includes(needle), message || `expected NOT to include: ${needle}`);
}

// 1. 紧凑定义列表
console.log('--- 测试 1: 紧凑定义列表 ---');
{
  const src = ['Apple', ': A fruit', '', 'Normal paragraph.'].join('\n');
  const { markdown, listCount } = processMarkdownDefinitionLists(src);
  assert.strictEqual(listCount, 1);
  assertIncludes(markdown, '<dl class="ov-deflist">');
  assertIncludes(markdown, '<dt>Apple</dt>');
  assertIncludes(markdown, '<dd>');
  assertIncludes(markdown, 'A fruit');
  assertIncludes(markdown, 'Normal paragraph.');
}
console.log('✅ 紧凑定义列表通过');

// 2. 多 term / 多 dd / 强调
console.log('--- 测试 2: 多 term 与多定义 ---');
{
  const src = [
    'Term A',
    'Term B',
    ': Shared **definition**',
    ': Second definition',
    '',
    'Solo',
    ': Only one',
  ].join('\n');
  const { markdown, listCount } = processMarkdownDefinitionLists(src);
  assert.strictEqual(listCount, 1);
  assertIncludes(markdown, '<dt>Term A</dt>');
  assertIncludes(markdown, '<dt>Term B</dt>');
  assertIncludes(markdown, '<strong>definition</strong>');
  assertIncludes(markdown, '<dt>Solo</dt>');
}
console.log('✅ 多 term/dd 通过');

// 3. 空行 + 缩进续行
console.log('--- 测试 3: 空行分隔与缩进续行 ---');
{
  const src = [
    'Long term',
    '',
    ': First line',
    '  continued line',
    '',
    '  still in definition',
    '',
    'After list',
  ].join('\n');
  const { markdown, listCount } = processMarkdownDefinitionLists(src);
  assert.strictEqual(listCount, 1);
  assertIncludes(markdown, 'First line');
  assertIncludes(markdown, 'continued line');
  assertIncludes(markdown, 'still in definition');
  assertIncludes(markdown, 'After list');
}
console.log('✅ 续行定义通过');

// 4. 代码保护 / 非定义冒号
console.log('--- 测试 4: 负向与代码保护 ---');
{
  const src = [
    'Not a list',
    ':not-a-definition',
    '',
    '```',
    'Code',
    ': fake',
    '```',
    '',
    'Real',
    ': Yes',
  ].join('\n');
  const { markdown, listCount } = processMarkdownDefinitionLists(src);
  assert.strictEqual(listCount, 1);
  assertIncludes(markdown, 'Not a list');
  assertIncludes(markdown, ':not-a-definition');
  assertIncludes(markdown, ': fake');
  assertIncludes(markdown, '<dt>Real</dt>');
}
console.log('✅ 负向/代码保护通过');

// 5. emoji 基础
console.log('--- 测试 5: emoji shortcode ---');
{
  assert.strictEqual(resolveEmojiShortcode('rocket'), '🚀');
  assert.strictEqual(resolveEmojiShortcode('no_such_emoji_xx'), null);
  const { markdown, replaceCount } = processEmojiShortcodes('Ship it :rocket: and :100:!');
  assert.strictEqual(replaceCount, 2);
  assertIncludes(markdown, '🚀');
  assertIncludes(markdown, '💯');
  assertNotIncludes(markdown, ':rocket:');
}
console.log('✅ emoji 替换通过');

// 6. emoji 未知与代码保护
console.log('--- 测试 6: emoji 未知短码与代码保护 ---');
{
  const src = 'Keep :not_a_real_emoji_zz: and `:rocket:` and\n```\n:fire:\n```\nbut :fire: ok';
  const { markdown, replaceCount } = processEmojiShortcodes(src);
  assert.strictEqual(replaceCount, 1);
  assertIncludes(markdown, ':not_a_real_emoji_zz:');
  assertIncludes(markdown, '`:rocket:`');
  assertIncludes(markdown, ':fire:');
  assertIncludes(markdown, '🔥');
}
console.log('✅ emoji 边界通过');

// 7. +1 / -1
console.log('--- 测试 7: :+1: / :-1: ---');
{
  const { markdown, replaceCount } = processEmojiShortcodes('vote :+1: or :-1:');
  assert.strictEqual(replaceCount, 2);
  assertIncludes(markdown, '👍');
  assertIncludes(markdown, '👎');
}
console.log('✅ +/-1 通过');

console.log('🎉 Pandoc 定义列表 / emoji 单元测试全部通过');
