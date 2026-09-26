#!/usr/bin/env node
/**
 * OmniView 驱动分发路由与边界降级自动化测试套件
 */
import assert from 'node:assert';
import { getDriverIdForFile } from '../src/features/viewers/lib/driverRouting.ts';

console.log('🧪 开始驱动分发路由与格式自愈降级单元测试...');

function mockFile(name, extension) {
  return {
    id: `file_${Math.random()}`,
    name,
    extension,
    content: '',
    updatedAt: Date.now(),
  };
}

// 1. Markdown 家族测试
console.log('--- 测试 1: Markdown 家族路由 ---');
assert.strictEqual(getDriverIdForFile(mockFile('README.md', 'md')), 'markdown');
assert.strictEqual(getDriverIdForFile(mockFile('CHANGELOG.markdown', 'markdown')), 'markdown');
assert.strictEqual(getDriverIdForFile(mockFile('DOC.MD', 'MD')), 'markdown', '大写 MD 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('NOTE.Markdown', 'Markdown')), 'markdown', '混合大小写 Markdown 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('catalog.okf', 'okf')), 'markdown', 'OKF 格式路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('orders.OKF', 'OKF')), 'markdown', '大写 OKF 路由错误');
console.log('✅ Markdown 家族驱动路由测试通过');

// 2. 思维导图家族测试
console.log('--- 测试 2: 思维导图 (Mindmap) 驱动路由 ---');
assert.strictEqual(getDriverIdForFile(mockFile('architecture.mm', 'mm')), 'mindmap');
assert.strictEqual(getDriverIdForFile(mockFile('mind.markmap', 'markmap')), 'mindmap');
assert.strictEqual(getDriverIdForFile(mockFile('concept.mindmap', 'mindmap')), 'mindmap');
assert.strictEqual(getDriverIdForFile(mockFile('kityminder.km', 'km')), 'mindmap');
assert.strictEqual(getDriverIdForFile(mockFile('SYSTEM.KM', 'KM')), 'mindmap', '大写 KM 后缀路由错误');
console.log('✅ 思维导图驱动路由测试全部通过');

// 3. 矢量图与 PlantUML 测试
console.log('--- 测试 3: 矢量图形与 PlantUML 驱动路由 ---');
assert.strictEqual(getDriverIdForFile(mockFile('sequence.puml', 'puml')), 'plantuml');
assert.strictEqual(getDriverIdForFile(mockFile('diagram.plantuml', 'plantuml')), 'plantuml');
assert.strictEqual(getDriverIdForFile(mockFile('include.iuml', 'iuml')), 'plantuml');
assert.strictEqual(getDriverIdForFile(mockFile('pipeline.mmd', 'mmd')), 'mermaid');
assert.strictEqual(getDriverIdForFile(mockFile('flow.mermaid', 'mermaid')), 'mermaid');
assert.strictEqual(getDriverIdForFile(mockFile('topo.dot', 'dot')), 'graphviz');
assert.strictEqual(getDriverIdForFile(mockFile('net.gv', 'gv')), 'graphviz');
assert.strictEqual(getDriverIdForFile(mockFile('FLOW.MMD', 'MMD')), 'mermaid', '大写 MMD 后缀路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('TOPO.DOT', 'DOT')), 'graphviz', '大写 DOT 后缀路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('logo.svg', 'svg')), 'svg');
assert.strictEqual(getDriverIdForFile(mockFile('ICON.SVG', 'SVG')), 'svg', '大写 SVG 后缀路由错误');
// 常见位图与动图格式路由至 image 驱动
const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff'];
for (const ext of imageExtensions) {
  assert.strictEqual(
    getDriverIdForFile(mockFile(`picture.${ext}`, ext)),
    'image',
    `图片格式 .${ext} 应正确路由至 image 驱动`
  );
  assert.strictEqual(
    getDriverIdForFile(mockFile(`PICTURE.${ext.toUpperCase()}`, ext.toUpperCase())),
    'image',
    `大写图片格式 .${ext.toUpperCase()} 应正确路由至 image 驱动`
  );
}
console.log('✅ 矢量图、位图与 PlantUML 驱动路由测试通过');

// 4. Office 办公套件、PDF 与表格数据测试
console.log('--- 测试 4: Office 办公套件、PDF 版式、EPUB 电子书与 CSV / TSV 表格路由 ---');
assert.strictEqual(getDriverIdForFile(mockFile('spec.pdf', 'pdf')), 'pdf');
assert.strictEqual(getDriverIdForFile(mockFile('MANUAL.PDF', 'PDF')), 'pdf', '大写 PDF 后缀路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('book.epub', 'epub')), 'epub');
assert.strictEqual(getDriverIdForFile(mockFile('NOVEL.EPUB', 'EPUB')), 'epub', '大写 EPUB 后缀路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('report.docx', 'docx')), 'docx', 'Word docx 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('DOC.DOCX', 'DOCX')), 'docx', '大写 DOCX 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('slides.pptx', 'pptx')), 'pptx', 'PowerPoint pptx 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('DECK.PPTX', 'PPTX')), 'pptx', '大写 PPTX 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('budget.xlsx', 'xlsx')), 'xlsx', 'Excel xlsx 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('OLD.XLS', 'XLS')), 'xlsx', '大写 XLS 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('macro.xlsm', 'xlsm')), 'xlsx', 'Excel xlsm 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('tpl.xltx', 'xltx')), 'xlsx', 'Excel xltx 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('data.csv', 'csv')), 'csv');
assert.strictEqual(getDriverIdForFile(mockFile('metrics.tsv', 'tsv')), 'csv');
assert.strictEqual(getDriverIdForFile(mockFile('EXPORT.CSV', 'CSV')), 'csv', '大写 CSV 后缀路由错误');
console.log('✅ Office 办公套件、PDF、EPUB 与数据表格驱动路由测试通过');

// 5. Jupyter Notebook 与 Typst 现代排版路由测试
console.log('--- 测试 5: Jupyter Notebook 与 Typst 现代排版引擎路由 ---');
assert.strictEqual(getDriverIdForFile(mockFile('analysis.ipynb', 'ipynb')), 'notebook');
assert.strictEqual(getDriverIdForFile(mockFile('LAB.IPYNB', 'IPYNB')), 'notebook', '大写 IPYNB 后缀路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('paper.typ', 'typ')), 'typst');
assert.strictEqual(getDriverIdForFile(mockFile('thesis.typst', 'typst')), 'typst');
assert.strictEqual(getDriverIdForFile(mockFile('REPORT.TYP', 'TYP')), 'typst', '大写 TYP 后缀路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('diagram.excalidraw', 'excalidraw')), 'excalidraw');
assert.strictEqual(getDriverIdForFile(mockFile('FLOW.EXCALIDRAW', 'EXCALIDRAW')), 'excalidraw', '大写 EXCALIDRAW 路由错误');
assert.strictEqual(getDriverIdForFile(mockFile('sketch.excalidraw.json', 'json')), 'excalidraw', '.excalidraw.json 应正确路由至 excalidraw');
console.log('✅ Jupyter Notebook、Typst 与 Excalidraw 驱动路由测试通过');

// 6. 源码与结构化文本路由至 code 驱动
console.log('--- 测试 6: 代码高亮与工程配置文件路由 ---');
const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'go', 'rs', 'html', 'css', 'yaml', 'yml', 'toml', 'xml'];
for (const ext of codeExtensions) {
  assert.strictEqual(
    getDriverIdForFile(mockFile(`test.${ext}`, ext)),
    'code',
    `扩展名 .${ext} 应正确分配至 code 驱动`
  );
}
assert.strictEqual(getDriverIdForFile(mockFile('Cargo.toml', 'toml')), 'code', 'Cargo.toml 应正确路由至 code 驱动');
assert.strictEqual(getDriverIdForFile(mockFile('pyproject.toml', 'toml')), 'code', 'pyproject.toml 应正确路由至 code 驱动');
console.log('✅ 常见代码格式驱动分配测试通过');

// 7. 异常边界与未知扩展名安全降级
console.log('--- 测试 7: 无扩展名文件与未知格式安全降级 ---');
assert.strictEqual(getDriverIdForFile(mockFile('LICENSE', '')), 'code', '无扩展名协议文件应降级至 code 驱动');
assert.strictEqual(getDriverIdForFile(mockFile('Dockerfile', '')), 'dockerfile', 'Dockerfile 应精准分配至 dockerfile 专属驱动');
assert.strictEqual(getDriverIdForFile(mockFile('Makefile', '')), 'code', 'Makefile 应降级至 code 驱动');
assert.strictEqual(getDriverIdForFile(mockFile('unknown.xyz', 'xyz')), 'code', '未知后缀应安全降级至 code 驱动');
assert.strictEqual(getDriverIdForFile(mockFile('binary.dat', 'dat')), 'code', '二进制后缀应安全降级至 code 驱动');
console.log('✅ 无扩展名与未知格式安全降级测试全部通过');

console.log('🎉 全部 6 组驱动路由与格式自愈测试用例 100% 通过！\n');
