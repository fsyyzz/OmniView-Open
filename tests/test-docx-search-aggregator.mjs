#!/usr/bin/env node
/**
 * 单元测试: docxSearchAggregator 大纲与全文检索热力聚类引擎
 * 作者: 周赞
 */
import assert from 'assert';
import { aggregateSearchMatchesByToc } from '../src/features/viewers/lib/docxSearchAggregator.ts';

console.log('🧪 开始 Word (.docx) 大纲与全文检索热力聚类引擎自动化测试...');

// 测试 1: 空容器安全兜底
console.log('--- 测试 1: 空容器安全兜底 ---');
const resEmpty = aggregateSearchMatchesByToc(null, []);
assert.strictEqual(resEmpty.totalMatchesCount, 0);
assert.strictEqual(resEmpty.matchedSectionsCount, 0);
assert.strictEqual(resEmpty.groups.size, 0);
console.log('✅ 空容器安全兜底测试通过');

// 测试 2: 模拟带有 3 个章节与 5 处匹配的 DOM 结构
console.log('--- 测试 2: 模拟大纲与多处匹配项准确归属 ---');

function createMockNode(tag, options = {}) {
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
        }
        for (const c of n.children) {
          traverse(c);
        }
      }
      traverse(el);
      return results;
    },
    compareDocumentPosition: (other) => {
      // 模拟简单的文档先后顺序判定
      return el._order < other._order ? 4 : 2; // 4 = DOCUMENT_POSITION_FOLLOWING
    },
    _order: options.order || 0,
  };
  return el;
}

const root = createMockNode('div', { order: 0 });

// 章节 1
const h1 = createMockNode('h1', { id: 'h1', textContent: '第一章 绪论', order: 10 });
root.appendChild(h1);

const p1 = createMockNode('p', { textContent: '这是系统设计的关键特性。', order: 20 });
const mark1 = createMockNode('mark', { textContent: '系统设计', dataset: { matchIndex: '0' }, order: 21 });
p1.appendChild(mark1);
root.appendChild(p1);

const p2 = createMockNode('p', { textContent: '进一步深化系统设计的实现。', order: 30 });
const mark2 = createMockNode('mark', { textContent: '系统设计', dataset: { matchIndex: '1' }, order: 31 });
p2.appendChild(mark2);
root.appendChild(p2);

// 章节 2 (无命中)
const h2 = createMockNode('h2', { id: 'h2', textContent: '第二章 相关工作', order: 40 });
root.appendChild(h2);

const p3 = createMockNode('p', { textContent: '这里没有任何匹配内容。', order: 50 });
root.appendChild(p3);

// 章节 3 (有 1 处命中)
const h3 = createMockNode('h1', { id: 'h3', textContent: '第三章 性能评测', order: 60 });
root.appendChild(h3);

const p4 = createMockNode('p', { textContent: '在更大规模下验证系统设计指标。', order: 70 });
const mark3 = createMockNode('mark', { textContent: '系统设计', dataset: { matchIndex: '2' }, order: 71 });
p4.appendChild(mark3);
root.appendChild(p4);

const mockToc = [
  { id: 'h1', text: '第一章 绪论', level: 1, element: h1 },
  { id: 'h2', text: '第二章 相关工作', level: 2, element: h2 },
  { id: 'h3', text: '第三章 性能评测', level: 1, element: h3 },
];

const res = aggregateSearchMatchesByToc(root, mockToc);

assert.strictEqual(res.totalMatchesCount, 3, '总匹配数应为 3');
assert.strictEqual(res.matchedSectionsCount, 2, '命中章节数应为 2 (第一章与第三章)');
assert.strictEqual(res.groups.get('h1')?.length, 2, '第一章应归属 2 处匹配');
assert.strictEqual(res.groups.get('h3')?.length, 1, '第三章应归属 1 处匹配');
assert.strictEqual(res.groups.get('h2'), undefined, '第二章无匹配');

console.log('✅ 大纲与多处匹配项准确归属测试通过');

console.log('\n🎉 全部 docxSearchAggregator 测试 100% 通过！\n');
