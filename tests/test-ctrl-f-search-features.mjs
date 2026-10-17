#!/usr/bin/env node
/**
 * OmniView 全局 Ctrl+F 检索与高亮联动特性单元测试套件
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('🧪 开始 OmniView 全局 Ctrl+F 检索特性单元测试...');

const root = process.cwd();
const markdownToolbarSrc = readFileSync(resolve(root, 'src/features/viewers/components/markdown/MarkdownToolbar.tsx'), 'utf8');
const pluginDocViewSrc = readFileSync(resolve(root, 'src/features/viewers/PluginDocumentView.tsx'), 'utf8');
const csvViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/CsvViewer.tsx'), 'utf8');
const xlsxViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/XlsxViewer.tsx'), 'utf8');
const docxViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/DocxViewer.tsx'), 'utf8');
const codeViewerSrc = readFileSync(resolve(root, 'src/features/viewers/components/drivers/CodeViewer.tsx'), 'utf8');
const domHighlighterSrc = readFileSync(resolve(root, 'src/features/viewers/lib/domSearchHighlighter.ts'), 'utf8');

// 1. 测试 MarkdownToolbar 搜索输入框与快捷键契约
console.log('--- 测试 1: MarkdownToolbar 搜索输入与快捷交互契约 ---');
assert.ok(markdownToolbarSrc.includes('id="omniview-markdown-search-input"'), 'MarkdownToolbar 必须包含固定 search input id');
assert.ok(markdownToolbarSrc.includes('Ctrl+F'), 'MarkdownToolbar 占位符必须标明 Ctrl+F 提示');
assert.ok(markdownToolbarSrc.includes("e.key === 'Escape'"), 'MarkdownToolbar 必须支持 Escape 快速清空并失焦');
console.log('✅ MarkdownToolbar 搜索契约测试通过');

// 2. 测试 PluginDocumentView 全局 Ctrl+F 拦截并聚焦
console.log('--- 测试 2: PluginDocumentView 全局 Ctrl+F 捕获与联动 ---');
assert.ok(pluginDocViewSrc.includes("(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'"), 'PluginDocumentView 必须捕获 Ctrl+F / Cmd+F');
assert.ok(pluginDocViewSrc.includes("setToolbarVisible(true)"), 'PluginDocumentView 搜索时必须展开工具栏');
assert.ok(pluginDocViewSrc.includes("omniview-markdown-search-input"), 'PluginDocumentView 必须聚焦 Markdown 搜索框');
console.log('✅ PluginDocumentView 全局快捷键测试通过');

// 3. 测试 CsvViewer Ctrl+F 聚焦与重定向
console.log('--- 测试 3: CsvViewer Ctrl+F 搜索联动 ---');
assert.ok(csvViewerSrc.includes("(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'"), 'CsvViewer 必须捕获 Ctrl+F / Cmd+F');
assert.ok(csvViewerSrc.includes("searchInputRef.current?.focus()"), 'CsvViewer 必须聚焦 searchInputRef');
assert.ok(csvViewerSrc.includes("setViewMode('table')"), 'CsvViewer 源码模式下按 Ctrl+F 需平滑切回 table 模式');
console.log('✅ CsvViewer 搜索联动测试通过');

// 4. 测试 XlsxViewer Ctrl+F 聚焦与多工作表搜索
console.log('--- 测试 4: XlsxViewer Ctrl+F 搜索联动 ---');
assert.ok(xlsxViewerSrc.includes("(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'"), 'XlsxViewer 必须捕获 Ctrl+F / Cmd+F');
assert.ok(xlsxViewerSrc.includes("searchInputRef.current?.focus()"), 'XlsxViewer 必须聚焦 searchInputRef');
console.log('✅ XlsxViewer 搜索联动测试通过');

// 5. 测试 DocxViewer 原生 Word 全文搜索与高亮
console.log('--- 测试 5: DocxViewer 全文高亮与 Ctrl+F 导航 ---');
assert.ok(docxViewerSrc.includes("highlightSearchMatches"), 'DocxViewer 必须接入 domSearchHighlighter');
assert.ok(docxViewerSrc.includes("handleNavigateMatch"), 'DocxViewer 必须支持上一个/下一个匹配项导航');
assert.ok(docxViewerSrc.includes("(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'"), 'DocxViewer 必须捕获 Ctrl+F / Cmd+F');
console.log('✅ DocxViewer 搜索联动测试通过');

// 6. 测试 domSearchHighlighter 安全选择器
console.log('--- 测试 6: domSearchHighlighter 节点安全隔离 ---');
assert.ok(domHighlighterSrc.includes('.katex'), '高亮引擎必须保护 KaTeX 公式子树');
assert.ok(domHighlighterSrc.includes('svg'), '高亮引擎必须保护 SVG 矢量子树');
assert.ok(domHighlighterSrc.includes('.markdown-diagram'), '高亮引擎必须保护图表子树');
// 7. 测试 CodeViewer Ctrl+F 搜索框精准自动命中与防劫持
console.log('--- 测试 7: CodeViewer Ctrl+F 搜索框精准自动命中与防劫持 ---');
assert.ok(codeViewerSrc.includes('id="ov-codeviewer-search-input"'), 'CodeViewer 必须提供明确的 ov-codeviewer-search-input ID');
assert.ok(codeViewerSrc.includes('openSearchWithSelection'), 'CodeViewer 必须具备提取选中文本并自动聚焦的 openSearchWithSelection');
assert.ok(pluginDocViewSrc.includes('ov-codeviewer-search-input'), 'PluginDocumentView 在代码视图必须让位/分流至 CodeViewer 搜索框');
console.log('✅ CodeViewer Ctrl+F 搜索框精准自动命中与防劫持测试通过');

console.log('🎉 全部 7 组 Ctrl+F 检索与高亮全景测试用例 100% 通过！\n');
