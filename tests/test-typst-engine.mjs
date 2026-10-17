import assert from 'node:assert';
import {
  extractTypstMetadata,
  compileTypstDocument,
} from '../src/features/viewers/lib/typstEngine.ts';
import { splitMultiPageSvg } from '../src/features/viewers/lib/typstWasmBridge.ts';

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

Quantum stabilizer:
$ S_i |psi angle.r = |psi angle.r quad forall S_i in cal(S) $

Summation and fraction:
$ sum_(i=1)^n frac(1, i^2) = frac(pi^2, 6) $

Code implementation:
\`\`\`python
def compute_energy(mass):
    return mass * (3e8 ** 2)
\`\`\`
`;

const resMath = compileTypstDocument(docWithMathAndCode);
assert.ok(resMath.pages[0].svgContent.includes('typst-math-block'), '必须生成公式块容器');
assert.ok(resMath.pages[0].svgContent.includes('typst-code-block'), '必须生成代码块容器');
assert.ok(resMath.pages[0].svgContent.includes('katex'), '公式必须成功通过 KaTeX 编译');
console.log('✅ 数学公式与代码块编译测试通过');

// 5. 空值与边界安全容错
console.log('--- 测试 5: 极限与空输入边界容错 ---');
const emptyCompile = compileTypstDocument('');
assert.strictEqual(emptyCompile.success, true);
assert.strictEqual(emptyCompile.totalPageCount, 0);

const fallbackMeta = extractTypstMetadata('just plain text');
assert.strictEqual(fallbackMeta.paperSize, 'a4');
console.log('✅ 极限与空输入容错测试全部通过');

// 6. 复杂中文简历排版、网格 Grid 与自定义宏解析测试
console.log('--- 测试 6: 复杂中文简历与 Grid 宏排版 ---');
const resumeSnippet = `
// ========== 全局配置 ==========
#set page(
  width: 210mm,
  height: 297mm,
  margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm)
)
#set text(font: ("Microsoft YaHei", "SimHei"), size: 11pt, lang: "zh")
#show heading: set text(weight: "bold")

// 自定义分隔线
#let divider = line(length: 100%, stroke: 0.4pt + gray)

// 自定义区块标题
#let sect-title(name) = {
  set text(size: 13pt, weight: "bold")
  name
  divider
  v(4pt)
}

// ========== 头部信息 ==========
#align(center)[
  #text(size: 18pt, weight: "bold")[姓名]
  #v(4pt)
  #text(size: 10pt)[手机号｜邮箱｜所在城市｜求职意向]
]

#v(8pt)

// ========== 个人简介 ==========
#sect-title("个人简介")
#text(size: 10.5pt)[
  拥有X年XX领域工作/实习经验，熟悉XXXX技术与业务流程。
]

#v(6pt)

// ========== 教育经历 ==========
#sect-title("教育经历")
#grid(
  columns: (auto, 1fr, auto),
  gutter: 4pt,
  stroke: none,
  [*XX大学*], [XX专业｜本科/硕士], [20XX.09–20XX.06],
  [GPA：3.XX/4.0], [排名前XX%｜可填奖项/荣誉], []
)
`;

const resResume = compileTypstDocument(resumeSnippet);
assert.strictEqual(resResume.success, true);
assert.ok(resResume.pages[0].svgContent.includes('姓名'), '必须正确渲染头部姓名');
assert.ok(resResume.pages[0].svgContent.includes('typst-grid-layout'), '必须正确渲染多列网格');
assert.ok(resResume.pages[0].svgContent.includes('XX大学'), '必须包含网格内部单元格文本');
assert.ok(resResume.pages[0].svgContent.includes('个人简介'), '必须识别自定义区块标题');
console.log('✅ 复杂中文简历与 Grid 宏排版测试通过');

// 7. WASM 官方多页 SVG 提取与 translate 偏移重置归一化测试
console.log('--- 测试 7: WASM 多页 SVG 拆分与纵向 translate 偏移归零校验 ---');
const mockWasmMultiPageSvg = `
<svg class="typst-doc" viewBox="0 0 595.28 1683.78" width="595.28" height="1683.78" xmlns="http://www.w3.org/2000/svg">
  <defs><g id="g1"><path d="M0 0 L10 10" /></g></defs>
  <g class="typst-page" data-page-width="595.28" data-page-height="841.89" transform="translate(0, 0)">
    <rect x="0" y="0" width="595.28" height="841.89" fill="#ffffff"/>
    <text x="50" y="50">Page 1 Content</text>
  </g>
  <g class="typst-page" data-page-width="595.28" data-page-height="841.89" transform="translate(0, 842)">
    <rect x="0" y="0" width="595.28" height="841.89" fill="#ffffff"/>
    <text x="50" y="50">Page 2 Content</text>
  </g>
</svg>
`.trim();

const splitPages = splitMultiPageSvg(mockWasmMultiPageSvg);
assert.strictEqual(splitPages.length, 2, '应成功拆分出 2 个独立单页');
assert.strictEqual(splitPages[0].pageNumber, 1);
assert.strictEqual(splitPages[1].pageNumber, 2);
assert.ok(splitPages[0].svgContent.includes('transform="translate(0, 0)"'), '第一页根变换应为 translate(0, 0)');
assert.ok(splitPages[1].svgContent.includes('transform="translate(0, 0)"'), '第二页根变换必须被重置归一化为 translate(0, 0)，不可保留累加偏移 842');
assert.ok(!splitPages[1].svgContent.includes('transform="translate(0, 842)"'), '第二页不得包含原文档的绝对纵向偏移 842，避免内容漂移出视口空白');
assert.ok(splitPages[0].svgContent.includes('Page 1 Content'));
assert.ok(splitPages[1].svgContent.includes('Page 2 Content'));
console.log('✅ WASM 多页拆分与偏移归零校验测试通过');

console.log('\n--- 测试 8: 中文字形修补 textLength 与精确排版宽度注入 ---');
const mockMissingGlyphSvg = `
<svg viewBox="0 0 595 842">
  <defs>
    <path id="g-notdef" class="outline_glyph" d="M 0 0 L 500 0 L 500 700 L 0 700 Z" />
  </defs>
  <g class="typst-page" data-page-width="595" data-page-height="842" transform="translate(0, 0)">
    <g class="typst-text" fill="#112233" transform="scale(0.0105, -0.0105)">
      <use href="#g-notdef" />
      <g transform="scale(16, -16)">
        <foreignObject x="0" y="-55" width="109.38" height="62.5">
          <h5:div class="tsel">拥有年</h5:div>
        </foreignObject>
      </g>
    </g>
  </g>
</svg>
`;

const patchedPages = splitMultiPageSvg(mockMissingGlyphSvg);
assert.strictEqual(patchedPages.length, 1);
const patchedSvg = patchedPages[0].svgContent;
assert.ok(patchedSvg.includes('textLength="1750"'), '必须注入根据 foreignObject width 算出的精确 targetAdvance (109.38 * 16 ≈ 1750)');
assert.ok(patchedSvg.includes('lengthAdjust="spacingAndGlyphs"'), '必须包含 lengthAdjust="spacingAndGlyphs" 避免中英混排文字重叠');
assert.ok(!patchedSvg.includes('href="#g-notdef"'), '必须剥离 notdef 方框引用');
assert.ok(patchedSvg.includes('拥有年'), '必须包含真实的文字内容');
console.log('✅ 中文字形修补与字宽防重叠校验测试通过');

console.log('🎉 全部 8 组 Typst 排版与编译器引擎测试用例 100% 通过！');

