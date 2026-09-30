#!/usr/bin/env node
/**
 * 单元测试: docxPaginationEngine 原生 Word 物理页面排版与自然分页引擎
 * 作者: 周赞
 */

import assert from 'assert';
import {
  paginateDocxContainer,
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
} from '../src/features/viewers/lib/docxPaginationEngine.ts';

function createMockElement(tag, options = {}) {
  const children = [];
  const classListSet = new Set();
  const attributes = new Map();
  const style = {
    width: options.style?.width || '',
    minHeight: options.style?.minHeight || '',
    height: options.style?.height || '',
    paddingTop: options.style?.paddingTop || '',
    paddingBottom: options.style?.paddingBottom || '',
  };

  let currentClassName = options.className || '';
  if (currentClassName) {
    currentClassName.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
  }

  const el = {
    tagName: tag.toUpperCase(),
    get className() {
      return currentClassName;
    },
    set className(val) {
      currentClassName = val || '';
      classListSet.clear();
      currentClassName.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
    },
    textContent: options.textContent || '',
    innerHTML: '',
    style,
    scrollHeight: options.scrollHeight || 0,
    offsetHeight: options.offsetHeight || 0,
    parentNode: null,
    parentElement: null,
    children,
    childNodes: children,
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
    },
    setAttribute: (k, v) => attributes.set(k, String(v)),
    getAttribute: (k) => attributes.get(k) || null,
    hasAttribute: (k) => attributes.has(k),
    appendChild: (child) => {
      children.push(child);
      child.parentNode = el;
      child.parentElement = el;
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
        child.parentElement = null;
      }
      return child;
    },
    replaceChild: (newChild, oldChild) => {
      const idx = children.indexOf(oldChild);
      if (idx !== -1) {
        // 支持 DocumentFragment 批量展开
        if (newChild.nodeType === 11) {
          children.splice(idx, 1, ...newChild.children);
          newChild.children.forEach(c => {
            c.parentNode = el;
            c.parentElement = el;
          });
        } else {
          children[idx] = newChild;
          newChild.parentNode = el;
          newChild.parentElement = el;
        }
        oldChild.parentNode = null;
        oldChild.parentElement = null;
      }
      return oldChild;
    },
    querySelector: (selector) => {
      if (selector === 'article') {
        return children.find(c => c.tagName === 'ARTICLE') || null;
      }
      if (selector === 'header') {
        return children.find(c => c.tagName === 'HEADER') || null;
      }
      if (selector === 'footer') {
        return children.find(c => c.tagName === 'FOOTER') || null;
      }
      if (selector === '.docx-page-number-badge') {
        return children.find(c => c.className?.includes('docx-page-number-badge')) || null;
      }
      if (selector === '.docx-badge-text') {
        return children.find(c => c.className?.includes('docx-badge-text')) || null;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      const results = [];
      function traverse(node) {
        for (const child of node.children) {
          if (selector.includes('section') && child.tagName === 'SECTION') {
            results.push(child);
          } else if (selector.includes('.docx-paged-sheet') && (child.classList.contains('docx-paged-sheet') || child.className?.includes('docx-paged-sheet'))) {
            results.push(child);
          }
          traverse(child);
        }
      }
      traverse(el);
      return results;
    },
    cloneNode: (deep = true) => {
      const clone = createMockElement(tag, {
        className: el.className,
        textContent: el.textContent,
        style: { ...style },
        scrollHeight: el.scrollHeight,
        offsetHeight: el.offsetHeight,
      });
      if (deep) {
        for (const c of children) {
          clone.appendChild(c.cloneNode(true));
        }
      }
      return clone;
    },
  };

  return el;
}

// 模拟全局 document 环境
global.document = {
  createElement: (tag) => createMockElement(tag),
  createDocumentFragment: () => {
    const frag = createMockElement('div');
    frag.nodeType = 11;
    return frag;
  },
};
global.window = {};

async function runTests() {
  console.log('🧪 开始 Word (.docx) 物理页面排版与自然分页引擎自动化测试...');

  // --- 测试 1: 空容器安全兜底 ---
  console.log('--- 测试 1: 空容器安全兜底 ---');
  const emptyRes = paginateDocxContainer(null);
  assert.strictEqual(emptyRes.totalPages, 1);
  assert.strictEqual(emptyRes.paginated, false);
  console.log('✅ 空容器安全兜底通过');

  // --- 测试 2: 正常单页无需拆分 ---
  console.log('--- 测试 2: 正常单页无需拆分 ---');
  const container1 = createMockElement('div');
  const singleSec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { minHeight: '1123px', width: '794px' },
    scrollHeight: 800,
    offsetHeight: 800,
  });
  const art1 = createMockElement('article');
  art1.appendChild(createMockElement('p', { textContent: '短文档内容，单页即可容纳' }));
  singleSec.appendChild(art1);
  container1.appendChild(singleSec);

  const res1 = paginateDocxContainer(container1, { expectedPageCount: 1 });
  assert.strictEqual(res1.totalPages, 1);
  assert.strictEqual(res1.paginated, false);
  assert(singleSec.classList.contains('docx-paged-sheet'), '必须被打上 docx-paged-sheet 标记');
  assert.strictEqual(singleSec.getAttribute('data-page-number'), '1');
  console.log('✅ 正常单页无需拆分测试通过');

  // --- 测试 3: 超长未分节文档，基于预期原始页数 (如 5 页) 智能切分 ---
  console.log('--- 测试 3: 超长文档基于预期原始页数切分 ---');
  const container2 = createMockElement('div');
  const longSec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { minHeight: '1123px', width: '794px' },
    scrollHeight: 5500, // 高达 5500px，约 5 页 A4
    offsetHeight: 5500,
  });
  const art2 = createMockElement('article');
  // 创建 30 个长段落
  for (let i = 1; i <= 30; i++) {
    const p = createMockElement('p', {
      textContent: `这是第 ${i} 段正文内容，包含较长的文字排版段落，测试在没有硬分页符的情况下跨页流转。`,
      offsetHeight: 150,
    });
    art2.appendChild(p);
  }
  longSec.appendChild(art2);
  container2.appendChild(longSec);

  const res2 = paginateDocxContainer(container2, { expectedPageCount: 5 });
  assert.strictEqual(res2.paginated, true, '必须触发物理跨页切分');
  assert(res2.totalPages >= 4 && res2.totalPages <= 6, `拆分页数应当贴近 5 页，当前: ${res2.totalPages}`);
  
  // 检查切分后的页面
  const sheets = container2.querySelectorAll('section');
  assert.strictEqual(sheets.length, res2.totalPages);
  sheets.forEach((sheet, idx) => {
    assert(sheet.classList.contains('docx-paged-sheet'));
    assert.strictEqual(sheet.getAttribute('data-page-number'), String(idx + 1));
    const articleInSheet = sheet.querySelector('article');
    assert(articleInSheet, '每页必须包含独立的 article 容器');
    assert(articleInSheet.children.length > 0, `第 ${idx + 1} 页不能为空`);
  });
  console.log(`✅ 超长文档切分成功，共生成 ${res2.totalPages} 个独立标准物理页面`);

  // --- 测试 4: 存在多个 section，其中一个超大正文节切分 ---
  console.log('--- 测试 4: 封面(1页) + 超长正文节，结合 expectedPageCount: 10 ---');
  const container3 = createMockElement('div');
  // 封面 Section
  const coverSec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { minHeight: '1123px', width: '794px' },
    scrollHeight: 700,
    offsetHeight: 700,
  });
  coverSec.appendChild(createMockElement('h1', { textContent: '文档封面' }));
  container3.appendChild(coverSec);

  // 正文 Section (超长，预期 9 页)
  const bodySec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { minHeight: '1123px', width: '794px' },
    scrollHeight: 9200,
    offsetHeight: 9200,
  });
  const bodyArt = createMockElement('article');
  for (let i = 1; i <= 45; i++) {
    bodyArt.appendChild(createMockElement('p', {
      textContent: `技术报告详细章节内容段落 ${i}`,
      offsetHeight: 180,
    }));
  }
  bodySec.appendChild(bodyArt);
  container3.appendChild(bodySec);

  const res3 = paginateDocxContainer(container3, { expectedPageCount: 10 });
  assert.strictEqual(res3.paginated, true);
  assert(res3.totalPages >= 8 && res3.totalPages <= 12, `总页数应贴近 10 页，当前: ${res3.totalPages}`);
  console.log(`✅ 复合章节超长正文节成功切分，总页数: ${res3.totalPages}`);

  console.log('\n🎉 全部 4 项 docx 物理页面排版与自然分页引擎测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
