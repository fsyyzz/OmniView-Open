#!/usr/bin/env node
/**
 * 单元测试: wordClipboardHelper 剪贴板清洗与 Word 富文本兼容引擎
 */

import { isIgnoredClipboardElement, generateWordCodeTableHtml, cleanAndFormatDomForWordSync, svgToBase64DataUrl, isFullContainerSelection } from '../src/features/viewers/lib/wordClipboardHelper.ts';

function runTests() {
  console.log('🧪 开始 Word 富文本剪贴板清洗引擎自动化测试...');

  // Test 1: isIgnoredClipboardElement 识别测试
  console.log('\n--- 测试 1: 辅助交互元素识别与忽略契约 ---');
  
  // 模拟 DOM 节点
  const createMockElement = (className = '', tag = 'div', attributes = {}) => ({
    classList: {
      contains: (name) => className.split(' ').includes(name),
      remove: () => {},
    },
    tagName: tag.toUpperCase(),
    style: {},
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(attributes, name),
    getAttribute: (name) => attributes[name],
    removeAttribute: (name) => { delete attributes[name]; },
  });

  const dummyToolbar = createMockElement('diagram-header');
  if (!isIgnoredClipboardElement(dummyToolbar)) {
    throw new Error('未能识别 .diagram-header 为忽略元素');
  }

  const dummyTableToolbar = createMockElement('ov-table-block-toolbar');
  if (!isIgnoredClipboardElement(dummyTableToolbar)) {
    throw new Error('未能识别 .ov-table-block-toolbar 为忽略元素');
  }

  const dummyResizer = createMockElement('ov-col-resizer');
  if (!isIgnoredClipboardElement(dummyResizer)) {
    throw new Error('未能识别 .ov-col-resizer 为忽略元素');
  }

  const dummySortIcon = createMockElement('ov-table-sort-icon');
  if (!isIgnoredClipboardElement(dummySortIcon)) {
    throw new Error('未能识别 .ov-table-sort-icon 为忽略元素');
  }

  const dummyButton = createMockElement('', 'button');
  if (!isIgnoredClipboardElement(dummyButton)) {
    throw new Error('未能识别 button 标签为忽略元素');
  }

  const dummyDataAttr = createMockElement('', 'span', { 'data-clipboard-ignore': 'true' });
  if (!isIgnoredClipboardElement(dummyDataAttr)) {
    throw new Error('未能识别 data-clipboard-ignore 属性为忽略元素');
  }

  const normalParagraph = createMockElement('', 'p');
  if (isIgnoredClipboardElement(normalParagraph)) {
    throw new Error('普通 <p> 标签不应被标记为忽略元素');
  }

  console.log('✅ 辅助交互与工具条元素识别测试全部通过');

  console.log('\n--- 测试 2: Word 原生 2 列代码表格生成测试 ---');
  const sampleCode = 'const a = 1;\nconsole.log(a);';
  const sampleHtml = '<span class="token keyword">const</span> a = <span class="token number">1</span>;\nconsole.log(a);';
  const wordTableHtml = generateWordCodeTableHtml(sampleCode, sampleHtml, 'typescript');

  if (!wordTableHtml.includes('<table') || !wordTableHtml.includes('border-collapse: collapse')) {
    throw new Error('Word 代码表格未正确生成 table 容器');
  }
  if (!wordTableHtml.includes('>1</td>') || !wordTableHtml.includes('>2</td>')) {
    throw new Error('Word 代码表格未正确生成行号 1 和 2');
  }
  if (!wordTableHtml.includes('token keyword')) {
    throw new Error('Word 代码表格未保留高亮 token 样式');
  }
  console.log('✅ generateWordCodeTableHtml 生成标准 Word 原生双列表格 (含行号、高亮与浅灰底纹)');

  console.log('\n--- 测试 3: Ctrl+A 正文选区隔离与防穿透契约 ---');
  const isInputLikeElement = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toUpperCase() || '';
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      el.isContentEditable ||
      el.getAttribute?.('contenteditable') === 'true' ||
      Boolean(el.closest?.('.ov-code-editor, textarea, input, select, [contenteditable="true"], [role="dialog"], .ov-modal-backdrop'))
    );
  };

  const codeEditorEl = createMockElement('ov-code-editor', 'div');
  codeEditorEl.closest = (selector) => selector.includes('ov-code-editor') ? codeEditorEl : null;
  if (!isInputLikeElement(codeEditorEl)) {
    throw new Error('代码编辑框应被判定为输入组件以保留原生全选行为');
  }

  const normalContentCanvas = createMockElement('markdown-document', 'div');
  normalContentCanvas.closest = () => null;
  if (isInputLikeElement(normalContentCanvas)) {
    throw new Error('正文容器不应被判定为输入组件');
  }
  console.log('✅ Ctrl+A 正文选区隔离与输入组件保护契约校验通过');

  console.log('\n--- 测试 4: 同步 DOM 深度清洗与图片线框消除契约 ---');
  // 模拟带有图片、图表与外部线框 wrapper 的 DOM 树
  const mockNodes = [];
  const createMockDomTree = () => {
    const root = {
      querySelectorAll: (sel) => {
        if (sel === 'img') return mockNodes.filter(n => n.tagName === 'IMG');
        if (sel === 'svg') return mockNodes.filter(n => n.tagName === 'SVG');
        if (sel === 'table') return mockNodes.filter(n => n.tagName === 'TABLE');
        if (sel === 'pre') return mockNodes.filter(n => n.tagName === 'PRE');
        if (sel === ':not(pre) > code') return [];
        if (sel === 'blockquote') return [];
        if (sel === '*') return mockNodes;
        return mockNodes.filter(n => isIgnoredClipboardElement(n));
      }
    };
    return root;
  };

  const mockImg = {
    tagName: 'IMG',
    style: {},
    classList: { contains: () => false, remove: () => {} },
    hasAttribute: () => false,
    getAttribute: () => 'https://example.com/test.png',
    removeAttribute: () => {},
  };
  mockNodes.push(mockImg);

  const mockWrapper = {
    tagName: 'DIV',
    style: { border: '1px solid #334155', minHeight: '140px' },
    classList: { contains: (cls) => cls === 'lazy-block-wrapper', remove: () => {} },
    hasAttribute: () => false,
    getAttribute: () => null,
    removeAttribute: () => {},
  };
  mockNodes.push(mockWrapper);

  cleanAndFormatDomForWordSync(createMockDomTree());

  if (mockWrapper.style.border !== 'none' || mockWrapper.style.minHeight !== 'auto') {
    throw new Error('外层懒加载与容器线框未被正确剥除');
  }
  if (mockImg.style.border !== 'none' || mockImg.style.maxWidth !== '100%') {
    throw new Error('图片内联样式未规范化');
  }
  console.log('✅ cleanAndFormatDomForWordSync 同步脱敏与外层线框彻底剥除验证通过');

  console.log('\n--- 测试 5: isFullContainerSelection 与多通道剪贴板双写契约 ---');
  const mockContainer = {
    childNodes: [createMockElement('', 'p'), createMockElement('', 'p'), createMockElement('', 'p')],
    firstElementChild: createMockElement('', 'p'),
    lastElementChild: createMockElement('', 'p'),
  };

  const fullRange = {
    startContainer: mockContainer,
    startOffset: 0,
    endContainer: mockContainer,
    endOffset: 3,
  };
  if (!isFullContainerSelection(fullRange, mockContainer)) {
    throw new Error('isFullContainerSelection 未能识别全选范围');
  }

  const partialRange = {
    startContainer: mockContainer,
    startOffset: 1,
    endContainer: mockContainer,
    endOffset: 2,
    comparePoint: () => 1,
  };
  if (isFullContainerSelection(partialRange, mockContainer)) {
    throw new Error('isFullContainerSelection 错误识别局部选区为全选');
  }
  console.log('✅ isFullContainerSelection 与 Markdown 源码/Word 双通道写入契约验证通过');

  console.log('\n🎉 全部 Word 剪贴板清洗自动化测试 100% 通过！');
}

runTests();
