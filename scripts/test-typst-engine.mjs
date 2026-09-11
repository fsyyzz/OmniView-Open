import assert from 'node:assert';
import {
  extractTypstMetadata,
  compileTypstDocument,
} from '../src/features/viewers/lib/typstEngine.ts';

console.log('🧪 开始 Typst 现代排版与轻量 AST 编译器引擎单元测试...');

// 1. 元数据与排版声明解析测试
console.log('--- 测试 1: Typst 顶部排版参数与元数据提取 ---');
const sampleHeader = `
#set page(paper: "a4", columns: 1)
#set document(title: "Quantum Computing & Quantum Algorithms", author: ("Alice", "Bob"))
#set text(font: "Linux Libertine", size: 11pt)

= 1. Introduction
Typst is a new markup-based typesetting system that is designed to be as powerful as LaTeX.
`;

const metadata = extractTypstMetadata(sampleHeader);
assert.strictEqual(metadata.paperSize, 'a4', '应正确识别 a4 纸张');
assert.strictEqual(metadata.columns, 1, '应正确识别单栏排版');
assert.strictEqual(metadata.title, 'Quantum Computing & Quantum Algorithms', '应正确提取文档标题');
assert.deepStrictEqual(metadata.authors, ['Alice', 'Bob'], '应正确提取多作者列表');
console.log('✅ 元数据与排版声明解析测试全部通过');

// 2. 标题大纲抽取与层级测试
console.log('--- 测试 2: 标题大纲 (Outline) 提取与层级校验 ---');
const docWithHeadings = `
= Chapter 1: Foundations
== 1.1 Linear Algebra
=== 1.1.1 Vector Spaces
== 1.2 Complex Numbers
= Chapter 2: Algorithms
`;

const resHeadings = compileTypstDocument(docWithHeadings);
assert.strictEqual(resHeadings.outline.length, 5, '应识别出 5 个标题节点');
assert.strictEqual(resHeadings.outline[0].title, 'Chapter 1: Foundations');
assert.strictEqual(resHeadings.outline[0].level, 1);
assert.strictEqual(resHeadings.outline[1].title, '1.1 Linear Algebra');
assert.strictEqual(resHeadings.outline[1].level, 2);
assert.strictEqual(resHeadings.outline[2].title, '1.1.1 Vector Spaces');
assert.strictEqual(resHeadings.outline[2].level, 3);
console.log('✅ 标题大纲抽取测试全部通过');

// 3. 物理分页符 #pagebreak() 与多页生成测试
console.log('--- 测试 3: 物理分页符与出版级多页 SVG 生成 ---');
const docWithPageBreaks = `
= Title Page
This is the cover page content.

#pagebreak()

= Table of Contents
This is page two.

#pagebreak()

= Main Content
This is page three.
`;

const resPages = compileTypstDocument(docWithPageBreaks);
assert.strictEqual(resPages.totalPageCount, 3, '应准确生成 3 页矢量 SVG');
assert.strictEqual(resPages.pages.length, 3);
assert.strictEqual(resPages.pages[0].pageNumber, 1);
assert.strictEqual(resPages.pages[1].pageNumber, 2);
assert.strictEqual(resPages.pages[2].pageNumber, 3);

// 验证 SVG 结构合规
assert.ok(resPages.pages[0].svgContent.includes('<svg'), '页面必须包含标准 SVG 标签');
assert.ok(resPages.pages[0].svgContent.includes('typst-page-header'), '必须包含页眉');
assert.ok(resPages.pages[0].svgContent.includes('typst-page-footer'), '必须包含页脚');
assert.ok(resPages.pages[0].svgContent.includes('- 1 -'), '第一页页码必须为 1');
console.log('✅ 物理分页与多页 SVG 生成测试全部通过');

// 4. 公式与代码块编译测试
console.log('--- 测试 4: 数学公式与代码块编译 ---');
const docWithMathAndCode = `
= Physics Analysis
Einstein field equations:
$ G_(mu nu) + Lambda g_(mu nu) = (8 pi G) / c^4 T_(mu nu) $

Code implementation:
\`\`\`python
def compute_energy(mass):
    return mass * (3e8 ** 2)
\`\`\`
`;

const resMath = compileTypstDocument(docWithMathAndCode);
assert.ok(resMath.pages[0].svgContent.includes('typst-math-block'), '必须生成公式块容器');
assert.ok(resMath.pages[0].svgContent.includes('typst-code-block'), '必须生成代码块容器');
console.log('✅ 数学公式与代码块编译测试通过');

// 5. 空值与边界安全容错
console.log('--- 测试 5: 极限与空输入边界容错 ---');
const emptyCompile = compileTypstDocument('');
assert.strictEqual(emptyCompile.success, true);
assert.strictEqual(emptyCompile.totalPageCount, 0);

const fallbackMeta = extractTypstMetadata('just plain text');
assert.strictEqual(fallbackMeta.paperSize, 'a4');
console.log('✅ 极限与空输入容错测试全部通过');

console.log('🎉 全部 5 组 Typst 排版与编译器引擎测试用例 100% 通过！');
