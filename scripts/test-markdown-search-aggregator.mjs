#!/usr/bin/env node
/**
 * 单元测试: documentSearchAggregator 在 Markdown 场景下的热力聚类测试
 * 作者: 周赞
 */
import assert from 'assert';
import { aggregateSearchMatchesByDocumentToc } from '../src/features/viewers/lib/documentSearchAggregator.ts';

console.log('🧪 开始 Markdown 大纲与全文检索热力聚类引擎自动化测试...');

function createMockDomNode(tag, options = {}) {
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    textContent: options.textContent || '',
    dataset: options.dataset || {},
    id: options.id || '',
    parentElement: null,
    parentNode: null,
    children,
    childNodes: children,
    appendChild: (child) => {
      children.push(child);
      child.parentElement = el;
      child.parentNode = el;
      return child;
    },
    querySelectorAll: (selector) => {
      const results = [];
      function traverse(n) {
        if (selector === 'mark.ov-search-match' && n.tagName === 'MARK') {
          results.push(n);
        } else if (selector === 'h1, h2, h3, h4, h5, h6' && /^H[1-6]$/.test(n.tagName)) {
          results.push(n);
        }
        for (const c of n.children) {
          traverse(c);
        }
      }
      traverse(el);
      return results;
    },
    compareDocumentPosition: (other) => {
      return el._order < other._order ? 4 : 2; // 4 = DOCUMENT_POSITION_FOLLOWING
    },
    _order: options.order || 0,
  };
  return el;
}

const root = createMockDomNode('div', { order: 0 });

// H1 (index 0)
const h1 = createMockDomNode('h1', { textContent: '系统架构', order: 10 });
root.appendChild(h1);

const p1 = createMockDomNode('p', { textContent: '本章节讲解核心配置参数。', order: 20 });
const mark1 = createMockDomNode('mark', { textContent: '配置参数', dataset: { matchIndex: '0' }, order: 21 });
p1.appendChild(mark1);
root.appendChild(p1);

// H2 (index 1) - 无命中
const h2 = createMockDomNode('h2', { textContent: '微服务网络', order: 30 });
root.appendChild(h2);

// H2 (index 2) - 2 处命中
const h3 = createMockDomNode('h2', { textContent: '环境变量设置', order: 40 });
root.appendChild(h3);

const p2 = createMockDomNode('p', { textContent: '修改配置参数即可重启服务。', order: 50 });
const mark2 = createMockDomNode('mark', { textContent: '配置参数', dataset: { matchIndex: '1' }, order: 51 });
p2.appendChild(mark2);
root.appendChild(p2);

const p3 = createMockDomNode('p', { textContent: '默认配置参数为 300 秒。', order: 60 });
const mark3 = createMockDomNode('mark', { textContent: '配置参数', dataset: { matchIndex: '2' }, order: 61 });
p3.appendChild(mark3);
root.appendChild(p3);

const mockMarkdownHeadings = [
  { text: '系统架构', level: 1, index: 0 },
  { text: '微服务网络', level: 2, index: 1 },
  { text: '环境变量设置', level: 2, index: 2 },
];

const res = aggregateSearchMatchesByDocumentToc(root, mockMarkdownHeadings);

assert.strictEqual(res.totalMatchesCount, 3, 'Markdown 总匹配数应为 3');
assert.strictEqual(res.matchedSectionsCount, 2, '包含命中的章节数应为 2 (索引 0 与 2)');
assert.strictEqual(res.groups.get('0')?.length, 1, '章节 0 应有 1 处命中');
assert.strictEqual(res.groups.get('2')?.length, 2, '章节 2 应有 2 处命中');
assert.strictEqual(res.groups.get('1'), undefined, '章节 1 应无命中');

console.log('✅ Markdown 大纲按 index 拓扑归属与热力聚类测试通过');

// 测试无大纲时的虚拟前言回退
const resNoToc = aggregateSearchMatchesByDocumentToc(root, []);
assert.strictEqual(resNoToc.totalMatchesCount, 3);
assert.strictEqual(resNoToc.groups.get('__intro__')?.length, 3);
console.log('✅ Markdown 无大纲时虚拟前言分组通过');

// 测试“仅显命中”过滤逻辑
const filteredOnlyMatched = mockMarkdownHeadings.filter(h => (res.groups.get(String(h.index))?.length || 0) > 0);
assert.strictEqual(filteredOnlyMatched.length, 2);
assert.deepStrictEqual(filteredOnlyMatched.map(h => h.index), [0, 2]);
console.log('✅ Markdown 仅显命中章节过滤模拟测试通过');

console.log('\n🎉 全部 Markdown 搜索热力聚类测试 100% 通过！\n');
