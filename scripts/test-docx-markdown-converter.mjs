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

  // 测试 7: 真实 NodeList 结构兼容性（Array.isArray 为 false）
  function makeFakeNodeList(items) {
    const obj = { length: items.length };
    items.forEach((it, idx) => { obj[idx] = it; });
    obj.item = (i) => items[i];
    return obj;
  }
  const textNode1 = { nodeType: 3, textContent: 'Hello ' };
  const textNode2 = { nodeType: 3, textContent: 'World' };
  const pWithNodeList = {
    tagName: 'P',
    childNodes: makeFakeNodeList([textNode1, textNode2]),
    getAttribute: () => null,
  };
  const sectionNodeList = makeSection([pWithNodeList]);
  const containerNodeList = makeContainer([sectionNodeList]);
  const result7 = docxDomToMarkdown(containerNodeList);
  assert(result7.includes('Hello World'), `NodeList 提取失败，实际: ${JSON.stringify(result7)}`);
  console.log('✅ 测试 7: 类浏览器 NodeList 结构兼容通过');

  // 测试 8: docx-preview 特有 class 标题识别
  const docxHeading1 = {
    tagName: 'P',
    className: 'docx-rendered-wrapper_heading_1',
    childNodes: ['项目整体架构设计'],
    textContent: '项目整体架构设计',
    getAttribute: (attr) => (attr === 'class' ? 'docx-rendered-wrapper_heading_1' : null),
  };
  const docxHeading2 = {
    tagName: 'P',
    className: 'docx-p-heading-2',
    childNodes: ['核心模块拆解'],
    textContent: '核心模块拆解',
    getAttribute: (attr) => (attr === 'class' ? 'docx-p-heading-2' : null),
  };
  const result8 = docxDomToMarkdown(makeContainer([makeSection([docxHeading1, docxHeading2])]));
  assert(result8.includes('# 项目整体架构设计'), `Heading 1 类名识别失败，实际: ${JSON.stringify(result8)}`);
  assert(result8.includes('## 核心模块拆解'), `Heading 2 类名识别失败，实际: ${JSON.stringify(result8)}`);
  console.log('✅ 测试 8: docx-preview 特有类名标题识别通过');

  // 测试 9: docx-preview 特有 numbering 类名列表识别
  const docxNumItem1 = {
    tagName: 'P',
    className: 'docx-rendered-wrapper-num-1-0',
    childNodes: ['• 第一阶段：设计与评审'],
    textContent: '• 第一阶段：设计与评审',
    getAttribute: (attr) => (attr === 'class' ? 'docx-rendered-wrapper-num-1-0' : null),
  };
  const docxNumItem2 = {
    tagName: 'P',
    className: 'docx-rendered-wrapper-num-1-0',
    childNodes: ['• 第二阶段：编码与测试'],
    textContent: '• 第二阶段：编码与测试',
    getAttribute: (attr) => (attr === 'class' ? 'docx-rendered-wrapper-num-1-0' : null),
  };
  const result9 = docxDomToMarkdown(makeContainer([makeSection([docxNumItem1, docxNumItem2])]));
  assert(result9.includes('- 第一阶段：设计与评审'), `编号列表项 1 转换失败，实际: ${JSON.stringify(result9)}`);
  assert(result9.includes('- 第二阶段：编码与测试'), `编号列表项 2 转换失败`);
  console.log('✅ 测试 9: docx-preview numbering 类名列表转换通过');

  // 测试 10: docx-preview span style 强调样式
  const boldSpan = {
    tagName: 'SPAN',
    style: { fontWeight: 'bold' },
    childNodes: ['加粗关键结论'],
    textContent: '加粗关键结论',
    getAttribute: () => null,
  };
  const italicSpan = {
    tagName: 'SPAN',
    style: { fontStyle: 'italic' },
    childNodes: ['斜体补充说明'],
    textContent: '斜体补充说明',
    getAttribute: () => null,
  };
  const mixedP = {
    tagName: 'P',
    childNodes: [boldSpan, { nodeType: 3, textContent: ' 与 ' }, italicSpan],
    getAttribute: () => null,
  };
  const result10 = docxDomToMarkdown(makeContainer([makeSection([mixedP])]));
  assert(result10.includes('**加粗关键结论**'), `span fontWeight 加粗转换失败，实际: ${JSON.stringify(result10)}`);
  assert(result10.includes('*斜体补充说明*'), `span fontStyle 斜体转换失败`);
  console.log('✅ 测试 10: docx-preview span 内联样式强调转换通过');

  // 测试 11: 流式无 section 容器直接挂载
  const fluidContainer = {
    tagName: 'DIV',
    className: 'docx-rendered-wrapper',
    children: [
      {
        tagName: 'H1',
        childNodes: ['流式标题'],
        textContent: '流式标题',
        getAttribute: () => null,
      },
      {
        tagName: 'P',
        childNodes: ['流式正文段落'],
        textContent: '流式正文段落',
        getAttribute: () => null,
      },
    ],
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const result11 = docxDomToMarkdown(fluidContainer);
  assert(result11.includes('# 流式标题'), `流式无 section 标题失败，实际: ${JSON.stringify(result11)}`);
  assert(result11.includes('流式正文段落'), `流式无 section 正文失败`);
  console.log('✅ 测试 11: 流式阅读无 section 容器挂载转换通过');

  // 测试 12: 忽略页眉页脚
  const headerNode = {
    tagName: 'HEADER',
    className: 'docx-header',
    childNodes: ['公司机密文件 - 仅供内部传阅'],
    textContent: '公司机密文件 - 仅供内部传阅',
    getAttribute: () => null,
  };
  const bodyP = {
    tagName: 'P',
    childNodes: ['正式正文内容'],
    textContent: '正式正文内容',
    getAttribute: () => null,
  };
  const result12 = docxDomToMarkdown(makeContainer([makeSection([headerNode, bodyP])]));
  assert(!result12.includes('公司机密文件'), `页眉应当被忽略，实际: ${JSON.stringify(result12)}`);
  assert(result12.includes('正式正文内容'), `正文应当被保留`);
  console.log('✅ 测试 12: 冗余页眉页脚过滤通过');

  console.log('\n🎉 全部 12 组 docxMarkdownConverter 单元测试 100% 通过！\n');
}

testBasicMarkdown();

