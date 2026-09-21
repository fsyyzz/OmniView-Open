/**
 * 单元测试: Markdown 划选悬浮格式化与源定位替换算法 (Selection Replacer Test)
 * 验证对粗体、斜体、删除线、行内代码、高亮、超链接、WikiLink 的精准行级匹配与格式 Toggle
 */
import assert from 'node:assert/strict';
import {
  applyMarkdownSelectionFormat,
  toggleFormatText,
} from '../src/features/viewers/lib/markdownSelectionReplacer.ts';

console.log('🧪 开始运行 Markdown 划选悬浮格式化测试...');

// 1. 测试基础格式包裹
{
  const text = 'OmniView';
  const boldRes = toggleFormatText(text, 'bold');
  assert.equal(boldRes.resultText, '**OmniView**');
  assert.equal(boldRes.isToggledOff, false);

  // Toggle 反选解除格式
  const unboldRes = toggleFormatText('**OmniView**', 'bold');
  assert.equal(unboldRes.resultText, 'OmniView');
  assert.equal(unboldRes.isToggledOff, true);

  const italicRes = toggleFormatText(text, 'italic');
  assert.equal(italicRes.resultText, '*OmniView*');
  const unitalicRes = toggleFormatText('*OmniView*', 'italic');
  assert.equal(unitalicRes.resultText, 'OmniView');

  const codeRes = toggleFormatText(text, 'code');
  assert.equal(codeRes.resultText, '`OmniView`');
  const uncodeRes = toggleFormatText('`OmniView`', 'code');
  assert.equal(uncodeRes.resultText, 'OmniView');

  const strikeRes = toggleFormatText(text, 'strikethrough');
  assert.equal(strikeRes.resultText, '~~OmniView~~');
  const unstrikeRes = toggleFormatText('~~OmniView~~', 'strikethrough');
  assert.equal(unstrikeRes.resultText, 'OmniView');

  const highlightRes = toggleFormatText(text, 'highlight');
  assert.equal(highlightRes.resultText, '==OmniView==');
  const unhighlightRes = toggleFormatText('==OmniView==', 'highlight');
  assert.equal(unhighlightRes.resultText, 'OmniView');

  const wikiRes = toggleFormatText(text, 'wikilink');
  assert.equal(wikiRes.resultText, '[[OmniView]]');
  const unwikiRes = toggleFormatText('[[OmniView]]', 'wikilink');
  assert.equal(unwikiRes.resultText, 'OmniView');

  const linkRes = toggleFormatText(text, 'link', 'https://example.com');
  assert.equal(linkRes.resultText, '[OmniView](https://example.com)');
  const unlinkRes = toggleFormatText('[OmniView](https://example.com)', 'link');
  assert.equal(unlinkRes.resultText, 'OmniView');

  console.log('  ✅ 基础文本格式化与 Toggle 反选测试通过');
}

// 2. 测试根据行号与选区在全文中精准替换
{
  const markdownSample = [
    '# 欢迎使用 OmniView',
    '',
    'OmniView 是一个高效的文件渲染器。',
    '',
    '这是一个包含重点的段落，请务必仔细阅读。',
    '',
    '- 列表项 1',
    '- 列表项 2 包含特别说明',
  ].join('\n');

  // 在第 3 行对 "高效" 施加粗体
  const res1 = applyMarkdownSelectionFormat({
    fullContent: markdownSample,
    selectedText: '高效',
    sourceLine: 3,
    action: 'bold',
  });

  assert.ok(res1 !== null, '应成功匹配并格式化');
  assert.ok(res1.newFullContent.includes('**高效**的文件渲染器'));
  assert.ok(res1.newFullContent.startsWith('# 欢迎使用 OmniView'));

  // 对第 5 行应用高亮
  const res2 = applyMarkdownSelectionFormat({
    fullContent: res1.newFullContent,
    selectedText: '重点',
    sourceLine: 5,
    action: 'highlight',
  });

  assert.ok(res2 !== null);
  assert.ok(res2.newFullContent.includes('包含==重点==的段落'));

  // 对第 8 行应用 WikiLink
  const res3 = applyMarkdownSelectionFormat({
    fullContent: res2.newFullContent,
    selectedText: '特别说明',
    sourceLine: 8,
    action: 'wikilink',
  });

  assert.ok(res3 !== null);
  assert.ok(res3.newFullContent.includes('列表项 2 包含[[特别说明]]'));

  console.log('  ✅ 全文行级源映射与精准替换测试通过');
}

// 3. 测试块级操作 (H1, H2, H3, Quote, Todo)
{
  const blockSample = [
    '主要概览',
    '二级小结',
    '这是一段重点引用的描述文字',
    '完成功能开发任务',
  ].join('\n');

  // H1 测试
  const h1Res = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '主要概览',
    sourceLine: 1,
    action: 'h1',
  });
  assert.ok(h1Res !== null);
  assert.ok(h1Res.newFullContent.startsWith('# 主要概览'));

  // Quote 引用块测试
  const quoteRes = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '重点引用',
    sourceLine: 3,
    action: 'quote',
  });
  assert.ok(quoteRes !== null);
  assert.ok(quoteRes.newFullContent.includes('> 这是一段重点引用的描述文字'));

  // Todo 待办任务测试
  const todoRes = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '完成功能开发任务',
    sourceLine: 4,
    action: 'todo',
  });
  assert.ok(todoRes !== null);
  assert.ok(todoRes.newFullContent.includes('- [ ] 完成功能开发任务'));

  console.log('  ✅ 块级格式化扩展 (H1, Quote, Todo) 测试通过');
}

console.log('🎉 所有 Markdown 划选悬浮格式化单元测试全部通过！\n');
