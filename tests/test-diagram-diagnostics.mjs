/**
 * 图表与公式诊断引擎单元测试脚本 (基于 Node.js assert)
 */
import assert from 'node:assert';
import {
  analyzeMermaidError,
  analyzeGraphvizError,
  analyzeKatexError,
  analyzePlantUmlError,
  extractErrorLineOffset,
} from '../src/features/viewers/lib/diagramDiagnostics.js';

console.log('🧪 开始图表诊断与修复规则引擎测试...');

// 1. Line offset extraction
assert.strictEqual(extractErrorLineOffset('Parse error on line 5: unexpected token', 'mermaid'), 5);
assert.strictEqual(extractErrorLineOffset('syntax error in line 12 near "foo"', 'graphviz'), 12);
assert.strictEqual(extractErrorLineOffset('KaTeX parse error: Expected group at position 8', 'katex'), 8);
console.log('✅ 行号偏移提取测试通过');

// 2. Mermaid rule 1: digraph keyword typo
const mermaidDigraph = analyzeMermaidError('digraph G {\n  A -> B;\n}', 'Parse error on line 1: unexpected token "digraph"', 42, 45);
assert.strictEqual(mermaidDigraph.diagramType, 'mermaid');
assert.strictEqual(mermaidDigraph.absoluteErrorLine, 43);
assert.ok(mermaidDigraph.canAutoFix);
assert.ok(mermaidDigraph.suggestions[0].suggestedCode?.includes('flowchart TD'));
console.log('✅ Mermaid digraph 误用诊断与自动修复建议测试通过');

// 3. Mermaid rule 3: unclosed subgraph
const mermaidSubgraph = analyzeMermaidError('flowchart TD\n  subgraph Main\n    A --> B\n', 'Parse error: unclosed subgraph', 10, 15);
assert.ok(mermaidSubgraph.canAutoFix);
assert.ok(mermaidSubgraph.suggestions.some(s => s.suggestedCode?.endsWith('end')));
console.log('✅ Mermaid subgraph 未闭合诊断与自动补全测试通过');

// 4. Graphviz rule 1: digraph with undirected edge --
const graphvizEdge = analyzeGraphvizError('digraph G {\n  a -- b;\n}', 'syntax error in line 2', 20, 24);
assert.strictEqual(graphvizEdge.diagramType, 'graphviz');
assert.strictEqual(graphvizEdge.absoluteErrorLine, 22);
assert.ok(graphvizEdge.canAutoFix);
assert.ok(graphvizEdge.suggestions[0].suggestedCode?.includes('a -> b;'));
console.log('✅ Graphviz 有向图无向边修复建议测试通过');

// 5. Graphviz rule 3: unclosed brace }
const graphvizBrace = analyzeGraphvizError('digraph G {\n  a -> b;\n', 'syntax error: unexpected EOF', 30, 33);
assert.ok(graphvizBrace.canAutoFix);
assert.ok(graphvizBrace.suggestions.some(s => s.suggestedCode?.endsWith('}')));
console.log('✅ Graphviz 花括号未闭合补全建议测试通过');

// 6. KaTeX rule 1: unmatched \left and \right
const katexUnmatched = analyzeKatexError('\\left( \\frac{a}{b}', 'KaTeX parse error: \\left without matching \\right', 50, 52);
assert.strictEqual(katexUnmatched.diagramType, 'katex');
assert.ok(katexUnmatched.canAutoFix);
assert.ok(katexUnmatched.suggestions[0].suggestedCode?.includes('\\right.'));
console.log('✅ KaTeX \\left 未闭合自动补齐 \\right. 测试通过');

// 7. PlantUML rule 1: missing @startuml / @enduml
const plantUmlMissing = analyzePlantUmlError('class User {\n  +name: String\n}', 'Render error', 100, 105);
assert.strictEqual(plantUmlMissing.diagramType, 'plantuml');
assert.ok(plantUmlMissing.canAutoFix);
assert.ok(plantUmlMissing.suggestions[0].suggestedCode?.startsWith('@startuml'));
assert.ok(plantUmlMissing.suggestions[0].suggestedCode?.endsWith('@enduml'));
console.log('✅ PlantUML 缺失 @startuml / @enduml 自动补全测试通过');

console.log('\n🎉 全部 7 组诊断与修复引擎用例测试通过！');
