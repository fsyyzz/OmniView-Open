#!/usr/bin/env node
/**
 * 单元测试: docxMarkdownConverter DOCX DOM → Markdown 转换器
 */

import { docxDomToMarkdown } from '../src/features/viewers/lib/docxMarkdownConverter.ts';

function assert(condition, msg) {
  if (!condition) throw new Error(`断言失败: ${msg}`);
}

function makeH1(text) {
  return {
    tagName: 'H1',
    textContent: text,
    childNodes: [text],
    getAttribute: () => null,
  };
}

function makeH2(text) {
  return {
    tagName: 'H2',
    textContent: text,
    childNodes: [text],
    getAttribute: () => null,
  };
}

function makeLi(text) {
  return {
    tagName: 'LI',
    textContent: text,
    childNodes: [text],
    getAttribute: () => null,
    querySelectorAll: () => [],
  };
}

function makeSection(articleChildren) {
  const article = {
    tagName: 'ARTICLE',
    children: articleChildren,
  };
  return {
    tagName: 'SECTION',
    querySelector: (sel) => (sel === 'article' ? article : null),
  };
}

function makeContainer(sections) {
  return {
    tagName: 'DIV',
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === 'section' ? sections : []),
  };
}

function testBasicMarkdown() {
  console.log('🧪 开始 docxMarkdownConverter 单元测试...');

  // 测试 1: null 容器
  const emptyResult = docxDomToMarkdown(null);
  assert(emptyResult === '', 'null 容器应返回空字符串');
  console.log('✅ 测试 1: null 容器容错通过');

  // 测试 2: 标题层级转换
  const headingSection = makeSection([
    makeH1('Doc Title'),
    makeH2('Sub Section'),
  ]);
  const headingContainer = makeContainer([headingSection]);
  const result2 = docxDomToMarkdown(headingContainer);
  assert(result2.includes('# Doc Title'), `H1 转换失败，实际: ${JSON.stringify(result2)}`);
  assert(result2.includes('## Sub Section'), `H2 转换失败，实际: ${JSON.stringify(result2)}`);
  console.log('✅ 测试 2: 标题层级转换通过');

  // 测试 3: 列表转换
  const ulEl = {
    tagName: 'UL',
    querySelectorAll: (sel) => (sel === ':scope > li' ? [makeLi('Item A'), makeLi('Item B')] : []),
  };
  const olEl = {
    tagName: 'OL',
    querySelectorAll: (sel) => (sel === ':scope > li' ? [makeLi('Step 1'), makeLi('Step 2')] : []),
  };
  const listSection = makeSection([ulEl, olEl]);
  const listContainer = makeContainer([listSection]);
  const result3 = docxDomToMarkdown(listContainer);
  assert(result3.includes('- Item A'), `无序列表项失败，实际: ${JSON.stringify(result3)}`);
  assert(result3.includes('1. Step 1'), `有序列表项 1 失败`);
  assert(result3.includes('2. Step 2'), `有序列表项 2 失败`);
  console.log('✅ 测试 3: 列表转换通过');

  // 测试 4: 表格转换
  const thName = { tagName: 'TH', childNodes: ['Name'], textContent: 'Name', getAttribute: () => null };
  const thAge = { tagName: 'TH', childNodes: ['Age'], textContent: 'Age', getAttribute: () => null };
  const tdAlice = { tagName: 'TD', childNodes: ['Alice'], textContent: 'Alice', getAttribute: () => null };
  const td30 = { tagName: 'TD', childNodes: ['30'], textContent: '30', getAttribute: () => null };
  const trHeader = { tagName: 'TR', querySelectorAll: (sel) => (sel === 'th, td' ? [thName, thAge] : []) };
  const trBody = { tagName: 'TR', querySelectorAll: (sel) => (sel === 'th, td' ? [tdAlice, td30] : []) };
  const tableEl = {
    tagName: 'TABLE',
    querySelectorAll: (sel) => (sel === 'tr' ? [trHeader, trBody] : []),
  };
  const tableSection = makeSection([tableEl]);
  const tableContainer = makeContainer([tableSection]);
  const result4 = docxDomToMarkdown(tableContainer);
  assert(result4.includes('| Name | Age |'), `表头行失败，实际: ${JSON.stringify(result4)}`);
  assert(result4.includes('| --- |'), `分隔行失败`);
  assert(result4.includes('| Alice | 30 |'), `数据行失败`);
  console.log('✅ 测试 4: 表格转换通过');

  // 测试 5: 段落与内联格式（strong/em）
  const strongEl = {
    tagName: 'STRONG',
    childNodes: ['bold text'],
    textContent: 'bold text',
    getAttribute: () => null,
  };
  const emEl = {
    tagName: 'EM',
    childNodes: ['italic text'],
    textContent: 'italic text',
    getAttribute: () => null,
  };
  const pEl = {
    tagName: 'P',
    childNodes: [strongEl, emEl],
    textContent: 'bold text italic text',
    getAttribute: () => null,
  };
  const pSection = makeSection([pEl]);
  const pContainer = makeContainer([pSection]);
  const result5 = docxDomToMarkdown(pContainer);
  assert(result5.includes('**bold text**'), `strong 转换失败，实际: ${JSON.stringify(result5)}`);
  assert(result5.includes('*italic text*'), `em 转换失败`);
  console.log('✅ 测试 5: 内联格式转换通过');

  // 测试 6: 图片与链接
  const imgEl = {
    tagName: 'IMG',
    childNodes: [],
    getAttribute: (attr) => (attr === 'src' ? 'image.png' : attr === 'alt' ? 'Figure 1' : null),
  };
  const linkEl = {
    tagName: 'A',
    childNodes: ['Click here'],
    textContent: 'Click here',
    getAttribute: (attr) => (attr === 'href' ? 'https://example.com' : null),
  };
  const mixedSection = makeSection([imgEl, linkEl]);
  const mixedContainer = makeContainer([mixedSection]);
  const result6 = docxDomToMarkdown(mixedContainer);
  assert(result6.includes('![Figure 1](image.png)'), `图片转换失败，实际: ${JSON.stringify(result6)}`);
  assert(result6.includes('[Click here](https://example.com)'), `链接转换失败`);
  console.log('✅ 测试 6: 图片与链接转换通过');

  console.log('\n🎉 全部 6 组 docxMarkdownConverter 单元测试 100% 通过！');
}

testBasicMarkdown();
