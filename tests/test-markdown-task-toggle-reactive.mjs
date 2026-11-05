import assert from 'node:assert';
import { toggleMarkdownTaskLine } from '../src/features/viewers/lib/markdownTaskToggle.ts';
import {
  cleanDiagramNodeLabel,
  findMatchingTextElementForDiagramNode,
} from '../src/features/viewers/lib/diagramReactiveFocus.ts';
import { normalizeMarkdownTabs } from '../src/features/viewers/lib/markdownTabsNormalizer.ts';

console.log('🧪 开始 Task List 即时勾选回写与图文双向聚焦高亮单元测试...');

// =========================================================================
// 1. Task List 即时勾选回写算法测试
// =========================================================================
console.log('--- 测试 1: toggleMarkdownTaskLine ---');

const sampleDoc = [
  '# 项目计划书',
  '- [ ] 编写图文联动核心算法',
  '- [x] 修复任务复选框误触问题',
  '  * [ ] 嵌套任务支持',
  '> - [ ] Callout 内部任务项',
  '1. [ ] 有序列表任务项',
  '普通正文段落',
].join('\n');

// 1.1 勾选第 2 行 (未勾选 -> 勾选)
const res1 = toggleMarkdownTaskLine(sampleDoc, 2);
assert.strictEqual(res1.changed, true, '第 2 行应成功变更');
assert.strictEqual(res1.nextChecked, true, '新状态应为勾选 (true)');
assert.ok(res1.newContent.includes('- [x] 编写图文联动核心算法'), '第 2 行源码应变为 [x]');

// 1.2 取消勾选第 3 行 (已勾选 -> 未勾选)
const res2 = toggleMarkdownTaskLine(sampleDoc, 3);
assert.strictEqual(res2.changed, true, '第 3 行应成功变更');
assert.strictEqual(res2.nextChecked, false, '新状态应为未勾选 (false)');
assert.ok(res2.newContent.includes('- [ ] 修复任务复选框误触问题'), '第 3 行源码应恢复为 [ ]');

// 1.3 嵌套与特殊标记任务项
const res3 = toggleMarkdownTaskLine(sampleDoc, 4);
assert.strictEqual(res3.changed, true);
assert.ok(res3.newContent.includes('  * [x] 嵌套任务支持'));

const res4 = toggleMarkdownTaskLine(sampleDoc, 5);
assert.strictEqual(res4.changed, true);
assert.ok(res4.newContent.includes('> - [x] Callout 内部任务项'));

const res5 = toggleMarkdownTaskLine(sampleDoc, 6);
assert.strictEqual(res5.changed, true);
assert.ok(res5.newContent.includes('1. [x] 有序列表任务项'));

// 1.4 模糊行号容错搜索 (当因 Frontmatter 或增删行导致传入 line 偏离时)
const resFuzzy = toggleMarkdownTaskLine(sampleDoc, 1, true, '编写图文联动');
assert.strictEqual(resFuzzy.changed, true);
assert.strictEqual(resFuzzy.actualLine, 2, '应智能纠偏定位到第 2 行');

console.log('✅ Task List 原地即时回写测试全部通过');

// =========================================================================
// 2. 图文双向联动：标签清洗与节点匹配测试
// =========================================================================
console.log('--- 测试 2: 图文双向联动 cleanDiagramNodeLabel ---');

assert.strictEqual(cleanDiagramNodeLabel('["AuthService"]'), 'AuthService');
assert.strictEqual(cleanDiagramNodeLabel('<b>Order Service</b>'), 'Order Service');
assert.strictEqual(cleanDiagramNodeLabel('(PostgreSQL Database)'), 'PostgreSQL Database');
assert.strictEqual(cleanDiagramNodeLabel('{Redis Cache}'), 'Redis Cache');

// 虚拟 DOM 匹配测试
const mockContainer = {
  querySelectorAll: (selector) => {
    if (selector.includes('h1, h2')) {
      return [
        {
          tagName: 'H2',
          textContent: '微服务架构与 AuthService 鉴权中心',
          scrollIntoView: () => {},
          classList: { add: () => {}, remove: () => {} },
        },
      ];
    }
    return [];
  },
};

const match = findMatchingTextElementForDiagramNode(mockContainer, 'AuthService');
assert.ok(match, '应成功匹配到 H2 章节标题');
assert.strictEqual(match.matchType, 'heading');

console.log('✅ 图文双向联动节点匹配与清洗测试全部通过');

// =========================================================================
// 3. Tabbed 多标签容器规范化兼容测试
// =========================================================================
console.log('--- 测试 3: normalizeMarkdownTabs 容器多语法兼容 ---');

const vitepressTabs = `
::: tabs 多环境配置
== 开发环境
\`\`\`yaml
env: dev
\`\`\`
== 生产环境
\`\`\`yaml
env: prod
\`\`\`
:::
`.trim();

const normalizedVitepress = normalizeMarkdownTabs(vitepressTabs);
assert.ok(normalizedVitepress.includes('> [!TABS] 多环境配置'), '应成功转为 > [!TABS]');
assert.ok(normalizedVitepress.includes('> - **开发环境**'), '应保留标签名');
assert.ok(normalizedVitepress.includes('> - **生产环境**'), '应保留标签名');

const mkdocsTabs = `
=== "TypeScript"
    \`\`\`ts
    console.log("hello");
    \`\`\`

=== "Python"
    \`\`\`python
    print("hello")
    \`\`\`
`.trim();

const normalizedMkDocs = normalizeMarkdownTabs(mkdocsTabs);
assert.ok(normalizedMkDocs.includes('> [!TABS]'), '应成功转为 > [!TABS]');
assert.ok(normalizedMkDocs.includes('> - **TypeScript**'), '应提取 TypeScript Tab');
assert.ok(normalizedMkDocs.includes('> - **Python**'), '应提取 Python Tab');

console.log('✅ Tabbed 多语法规范化映射测试全部通过');

console.log('🎉 所有新增能力单元测试通过！');
