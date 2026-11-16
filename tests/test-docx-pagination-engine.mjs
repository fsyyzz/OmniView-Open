#!/usr/bin/env node
/**
 * 单元测试: docxPaginationEngine 原生 Word 物理页面排版与自然分页引擎
 * 作者: 周赞
 */

import assert from 'assert';
import {
  paginateDocxContainer,
  parseCssLengthToPx,
  extractDocxPageSummaries,
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

  // --- 测试 5: 超长跨页表格按行切分并在续页重复表头 ---
  console.log('--- 测试 5: 超长跨页表格按行切分与表头重复 ---');
  const container4 = createMockElement('div');
  const tableSec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { minHeight: '1123px', width: '794px' },
    scrollHeight: 2600,
    offsetHeight: 2600,
  });
  const tableArt = createMockElement('article');
  const hugeTable = createMockElement('table', {
    className: 'docx-data-table',
    offsetHeight: 2200,
  });
  const headerTr = createMockElement('tr', { offsetHeight: 40 });
  headerTr.appendChild(createMockElement('th', { textContent: '指标名称' }));
  headerTr.appendChild(createMockElement('th', { textContent: '数值' }));
  hugeTable.appendChild(headerTr);

  for (let r = 1; r <= 36; r++) {
    const bodyTr = createMockElement('tr', { offsetHeight: 60 });
    bodyTr.appendChild(createMockElement('td', { textContent: `指标 #${r}` }));
    bodyTr.appendChild(createMockElement('td', { textContent: `${r * 10} ms` }));
    hugeTable.appendChild(bodyTr);
  }
  tableArt.appendChild(hugeTable);
  tableSec.appendChild(tableArt);
  container4.appendChild(tableSec);

  const res4 = paginateDocxContainer(container4, { locale: 'en-US' });
  assert.strictEqual(res4.paginated, true, '超长表格必须触发跨页切分');
  assert(res4.totalPages >= 2, `超长表格应至少切分为 2 页，当前: ${res4.totalPages}`);
  const pagedSheets4 = container4.querySelectorAll('section');
  assert.strictEqual(pagedSheets4.length, res4.totalPages);
  // 校验续页同样具备 table 且首行重复了表头
  const secondSheetArticle = pagedSheets4[1].querySelector('article');
  const secondSheetTable = secondSheetArticle.children.find(c => c.tagName === 'TABLE');
  assert(secondSheetTable, '第 2 页必须包含续接表格片段');
  const secondTbody = secondSheetTable.children.find(c => c.tagName === 'TBODY') || secondSheetTable;
  assert.strictEqual(secondTbody.children[0].children[0].tagName, 'TH', '续页表格首行必须重复表头 <th>');
  // 校验英文角标文案
  const firstBadge = pagedSheets4[0].querySelector('.docx-page-number-badge');
  const firstBadgeText = firstBadge?.querySelector('.docx-badge-text')?.textContent || firstBadge?.innerHTML || '';
  assert(firstBadgeText.includes('Page 1 / '), `英文分页角标异常: ${firstBadgeText}`);
  console.log(`✅ 超长跨页表格成功拆分为 ${res4.totalPages} 页并自动延续表头与英文角标`);

  // --- 测试 6: pt/mm 物理单位换算与陈旧 expectedPageCount=1 下的自然多页切分 ---
  console.log('--- 测试 6: pt/mm 单位换算与 expectedPageCount=1 自然多页切分 ---');
  assert.strictEqual(parseCssLengthToPx('595.3pt', 794), 794, '595.3pt 应精确换算为 794px (A4 宽)');
  assert.strictEqual(parseCssLengthToPx('841.9pt', 1123), 1123, '841.9pt 应精确换算为 1123px (A4 高)');
  assert.strictEqual(parseCssLengthToPx('72pt', 36), 96, '72pt (1 inch) 应精确换算为 96px');
  assert.strictEqual(parseCssLengthToPx('210mm', 0), 794, '210mm 应精确换算为 794px');

  const container5 = createMockElement('div');
  const ptSec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { width: '595.3pt', minHeight: '841.9pt', paddingTop: '72pt', paddingBottom: '72pt' },
    scrollHeight: 4200,
    offsetHeight: 4200,
  });
  const ptArt = createMockElement('article');
  for (let i = 1; i <= 24; i++) {
    ptArt.appendChild(createMockElement('p', {
      textContent: `原生 pt 纸张规格下无硬分页符的正文段落 #${i}`,
      offsetHeight: 150,
    }));
  }
  ptSec.appendChild(ptArt);
  container5.appendChild(ptSec);

  // 即使 app.xml 错误记录为 expectedPageCount: 1，也必须根据 4200px 真实高度切分为多页
  const res5 = paginateDocxContainer(container5, { expectedPageCount: 1 });
  assert.strictEqual(res5.paginated, true, 'expectedPageCount=1 时超长文档仍必须触发多页切分');
  assert(res5.totalPages >= 4, `4200px 高度文档应至少切分为 4 页，当前: ${res5.totalPages}`);
  const sheets5 = container5.querySelectorAll('section');
  assert.strictEqual(sheets5[0].getAttribute('data-page-width'), '794', '切分后单页宽度必须为 794px 而非 595px');
  assert.strictEqual(sheets5[0].getAttribute('data-page-height'), '1123', '切分后单页高度必须为 1123px 而非 842px');

  const summaries = extractDocxPageSummaries(container5, 'zh-CN');
  assert.strictEqual(summaries.length, res5.totalPages, '页面摘要数量应与切分后总页数一致');
  assert.strictEqual(summaries[0].pageNumber, 1);
  console.log(`✅ pt/mm 物理尺寸换算与陈旧 expectedPageCount=1 多页切分通过 (共 ${res5.totalPages} 页)`);

  // --- 测试 7: 少内容单页（或缺失尺寸声明）也必须严格锁定标准 A4 固定宽高，绝不随内容变矮或变窄 ---
  console.log('--- 测试 7: 稀疏内容单页仍锁定标准 A4 固定宽高 (794×1123) ---');
  const container6 = createMockElement('div');
  const sparseSec = createMockElement('section', {
    className: 'docx-rendered-wrapper docx',
    style: { width: '180px', minHeight: '120px' }, // 模拟极窄极矮的非标容器
    scrollHeight: 90,
    offsetHeight: 90,
  });
  sparseSec.appendChild(createMockElement('p', { textContent: '仅一行正文' }));
  container6.appendChild(sparseSec);

  const res6 = paginateDocxContainer(container6, { expectedPageCount: 1 });
  assert.strictEqual(res6.totalPages, 1);
  assert.strictEqual(sparseSec.getAttribute('data-page-width'), '794', '少内容或非标节宽度必须对齐 794px 标准 A4');
  assert.strictEqual(sparseSec.getAttribute('data-page-height'), '1123', '少内容或非标节高度必须对齐 1123px 标准 A4');
  assert.strictEqual(sparseSec.style.width, '794px', '单页 style.width 必须锁定为 794px');
  assert.strictEqual(sparseSec.style.height, '1123px', '单页 style.height 必须锁定为 1123px');
  assert.strictEqual(sparseSec.style.maxHeight, '1123px', '单页 style.maxHeight 必须锁定为 1123px');
  console.log('✅ 稀疏内容单页标准物理宽高锁定验证通过');

  // --- 测试 8: 分页拆分与二次溢出续页必须保留原节边距、页面边框、多栏排版及纸张属性标记 ---
  console.log('--- 测试 8: 跨页拆分与溢出续页完整保留边距/边框/多栏与页面属性 ---');
  const { Window: HappyWindow } = await import('happy-dom');
  const hWin = new HappyWindow();
  const hDoc = hWin.document;
  const savedDoc = global.document;
  const savedWin = global.window;
  global.document = hDoc;
  global.window = hWin;
  try {
    const colContainer = hDoc.createElement('div');
    const colSec = hDoc.createElement('section');
    colSec.className = 'docx-rendered-wrapper docx';
    colSec.setAttribute(
      'style',
      'width: 794px; min-height: 1123px; padding: 96px 120px; border-top: 1pt solid #334155;'
    );
    colSec.setAttribute('data-paper-name', 'A4');
    colSec.setAttribute('data-orientation', 'portrait');
    colSec.setAttribute('data-cols', '2');

    const colArt = hDoc.createElement('article');
    colArt.setAttribute('style', 'column-count: 2; column-gap: 48px; column-rule: 1px solid #94a3b8;');
    for (let i = 1; i <= 14; i++) {
      const p = hDoc.createElement('p');
      p.textContent = `双栏长文测试段落 #${i}：校验分页切分后每一页及溢出续页均完整继承边距、边框与双栏属性。`;
      Object.defineProperty(p, 'offsetHeight', { value: 140, configurable: true });
      colArt.appendChild(p);
    }
    colSec.appendChild(colArt);
    Object.defineProperty(colSec, 'scrollHeight', { value: 2600, configurable: true });
    colContainer.appendChild(colSec);

    const res8 = paginateDocxContainer(colContainer, { locale: 'zh-CN' });
    assert.strictEqual(res8.paginated, true, '多栏长节必须触发跨页切分');
    assert(res8.totalPages >= 2, `多栏长节应切分为多页，实际: ${res8.totalPages}`);
    const splitSheets = Array.from(colContainer.querySelectorAll('.docx-paged-sheet'));
    splitSheets.forEach((s, idx) => {
      assert.strictEqual(s.getAttribute('data-paper-name'), 'A4', `第 ${idx + 1} 页应保留 data-paper-name="A4"`);
      assert.strictEqual(s.getAttribute('data-cols'), '2', `第 ${idx + 1} 页应保留 data-cols="2"`);
      assert(s.style.paddingTop === '96px', `第 ${idx + 1} 页应保留 paddingTop=96px，实际: ${s.style.paddingTop}`);
      assert(Boolean(s.style.borderTop), `第 ${idx + 1} 页应保留页面顶部边框`);
      const art = s.querySelector('article');
      assert.strictEqual(art?.style.columnCount, '2', `第 ${idx + 1} 页 article 必须继承 columnCount="2"`);
      assert.strictEqual(art?.style.columnGap, '48px', `第 ${idx + 1} 页 article 必须继承 columnGap="48px"`);
    });
  } finally {
    global.document = savedDoc;
    global.window = savedWin;
    await hWin.close();
  }
  console.log('✅ 分页与溢出续页完整保留边距/边框/多栏属性验证通过');

  console.log('\n🎉 全部 8 项 docx 物理页面排版与自然分页引擎测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
