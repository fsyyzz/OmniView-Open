#!/usr/bin/env node
/**
 * OmniView — Markdown 学术交叉引用与公式/图表自动编号单元测试套件 (RFC-0001)
 */
import assert from 'node:assert';
import {
  extractLabelFromFormula,
  buildCrossReferenceRegistry,
  resolveCrossReferenceLinks,
} from '../src/features/viewers/lib/markdownCrossReferenceEngine.ts';

console.log('🧪 开始 Markdown 学术交叉引用与公式/图表自动编号单元测试...\n');

// 1. 公式标签提取与净化
console.log('--- 测试 1: 公式标签提取与净化 ---');
const rawFormula = 'f(x) = \\int_0^1 g(t) dt \\label{eq:integral}';
const extracted = extractLabelFromFormula(rawFormula);
assert.strictEqual(extracted.label, 'eq:integral', '应准确提取 \\label{eq:integral}');
assert.strictEqual(extracted.cleanFormula, 'f(x) = \\int_0^1 g(t) dt', '应彻底剥离 \\label 标签');
console.log('✅ 公式标签提取通过');

// 2. 块级数学公式连续编号与符号注册表构建
console.log('--- 测试 2: 块级公式自动连续编号 ---');
const markdownContent = `
# 系统物理推导

第一定律推导如下:
$$ E = mc^2 \\label{eq:mass-energy} $$

热力学关系为:
$$ dU = TdS - PdV \\label{eq:thermo} $$

如公式 \\eqref{eq:mass-energy} 与 \\eqref{eq:thermo} 所示，系统能量守恒。

\`\`\`mermaid label="fig:service-flow" title="微服务调度时序"
sequenceDiagram
  A->>B: Ping
\`\`\`

如 \\ref{fig:service-flow} 所示。

<!-- label: tbl:benchmark title: 性能压测指标 -->
| QPS | 延迟 |
|---|---|
| 5000 | 12ms |

见 \\ref{tbl:benchmark} 数据。
`;

const registry = buildCrossReferenceRegistry(markdownContent, 'zh-CN');
assert.strictEqual(registry.size(), 4, '应注册 2 个公式 + 1 个图表 + 1 个表格，共 4 项');

const eq1 = registry.get('eq:mass-energy');
assert.ok(eq1, '应包含 eq:mass-energy');
assert.strictEqual(eq1.kind, 'equation');
assert.strictEqual(eq1.index, 1);
assert.strictEqual(eq1.label, '(1)');

const eq2 = registry.get('eq:thermo');
assert.ok(eq2, '应包含 eq:thermo');
assert.strictEqual(eq2.index, 2);
assert.strictEqual(eq2.label, '(2)');

const fig1 = registry.get('fig:service-flow');
assert.ok(fig1, '应包含 fig:service-flow');
assert.strictEqual(fig1.kind, 'figure');
assert.strictEqual(fig1.index, 1);
assert.strictEqual(fig1.label, '图 1');
assert.strictEqual(fig1.title, '图 1: 微服务调度时序');

const tbl1 = registry.get('tbl:benchmark');
assert.ok(tbl1, '应包含 tbl:benchmark');
assert.strictEqual(tbl1.kind, 'table');
assert.strictEqual(tbl1.index, 1);
assert.strictEqual(tbl1.label, '表 1');
assert.strictEqual(tbl1.title, '表 1: 性能压测指标');
console.log('✅ 全局符号注册表构建与连续编号通过');

// 3. 正文 \\eqref 与 \\ref 交叉引用替换
console.log('--- 测试 3: 正文 \\eqref 与 \\ref 链接替换 ---');
const resolved = resolveCrossReferenceLinks(markdownContent, registry, 'zh-CN');
assert.ok(
  resolved.includes('<a class="ov-cross-ref ov-cross-ref-eq" href="#ref-eq%3Amass-energy" data-ref-id="eq:mass-energy" data-ref-kind="equation" title="跳转至公式 (1)">(1)</a>'),
  '应将 \\eqref{eq:mass-energy} 转换为带有 href="#ref-..." 的超链接'
);
assert.ok(
  resolved.includes('<a class="ov-cross-ref ov-cross-ref-figure" href="#ref-fig%3Aservice-flow" data-ref-id="fig:service-flow" data-ref-kind="figure" title="跳转至 图 1: 微服务调度时序">图 1</a>'),
  '应将 \\ref{fig:service-flow} 转换为图表超链接'
);
assert.ok(
  resolved.includes('<a class="ov-cross-ref ov-cross-ref-table" href="#ref-tbl%3Abenchmark" data-ref-id="tbl:benchmark" data-ref-kind="table" title="跳转至 表 1: 性能压测指标">表 1</a>'),
  '应将 \\ref{tbl:benchmark} 转换为表格超链接'
);
console.log('✅ 交叉引用超链接渲染通过');

// 4. 未解析引用优雅降级容错
console.log('--- 测试 4: 未解析引用优雅降级容错 ---');
const textWithMissing = '参见未定义公式 \\eqref{eq:missing} 与 \\ref{fig:unknown}。';
const missingResolved = resolveCrossReferenceLinks(textWithMissing, registry, 'zh-CN');
assert.ok(missingResolved.includes('ov-cross-ref-unresolved'), '未定义引用应赋予 ov-cross-ref-unresolved 样式');
assert.ok(missingResolved.includes('(?? eq:missing)'), '未定义公式应输出友好占位符');
assert.ok(missingResolved.includes('?? [fig:unknown]'), '未定义图表应输出友好占位符');
console.log('✅ 未解析引用容错通过');

console.log('🎉 全部 4 组 Markdown 学术交叉引用单元测试 100% 顺利通过！\n');

