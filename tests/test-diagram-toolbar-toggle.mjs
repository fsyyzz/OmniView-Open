/**
 * Markdown 图表统一工具栏折叠与全局开关联动自动化测试
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 开始 Markdown 图表统一工具栏折叠开关与全链路自动化测试...');

// 1. 验证 MarkdownToolbar 顶栏总开关
const toolbarPath = path.join(rootDir, 'src/features/viewers/components/markdown/MarkdownToolbar.tsx');
const toolbarCode = fs.readFileSync(toolbarPath, 'utf8');
assert.ok(toolbarCode.includes('btn-markdown-toggle-diagram-toolbars'), 'MarkdownToolbar 必须包含图表工具栏总开关按钮');
assert.ok(toolbarCode.includes('showDiagramToolbars'), 'MarkdownToolbar 必须声明 showDiagramToolbars 属性');
assert.ok(toolbarCode.includes('onToggleDiagramToolbars'), 'MarkdownToolbar 必须声明 onToggleDiagramToolbars 回调');
console.log('✅ 1. MarkdownToolbar 顶栏总开关与属性定义校验通过');

// 2. 验证 PluginDocumentView 根容器与状态联动
const docViewPath = path.join(rootDir, 'src/features/viewers/PluginDocumentView.tsx');
const docViewCode = fs.readFileSync(docViewPath, 'utf8');
assert.ok(docViewCode.includes('data-diagram-toolbars'), 'PluginDocumentView 根容器必须标记 data-diagram-toolbars');
assert.ok(docViewCode.includes('omniview.showDiagramToolbars'), 'PluginDocumentView 必须将用户偏好持久化至 omniview.showDiagramToolbars');
console.log('✅ 2. PluginDocumentView 根容器模式属性与持久化校验通过');

// 3. 验证 src/index.css 中图表工具栏的精准选择器
const cssPath = path.join(rootDir, 'src/index.css');
const cssCode = fs.readFileSync(cssPath, 'utf8');
assert.ok(cssCode.includes('[data-diagram-toolbars="visible"] .markdown-diagram:hover .diagram-header'), 'CSS 必须支持全局开启态 hover 展现');
assert.ok(cssCode.includes('.markdown-diagram.is-toolbar-open'), 'CSS 必须支持单卡片展开态展现');
assert.ok(cssCode.includes('[data-diagram-toolbars="visible"] .diagram-compact-trigger'), 'CSS 必须在全局开启态下隐藏微型胶囊');
assert.ok(cssCode.includes('[data-diagram-toolbars="visible"] .ov-table-block:hover .table-block-toolbar'), 'CSS 必须支持全局开启态下表格 hover 展现');
console.log('✅ 3. src/index.css 全局/单卡片双态规则与折叠胶囊隐藏样式校验通过');

// 4. 验证 8 大核心图表 Block 及数据表格 Block (TableBlock) 均整合了微型展开胶囊、独立展开状态与收起按钮
const blockFiles = [
  'MermaidBlock.tsx',
  'PlantUmlBlock.tsx',
  'GraphvizBlock.tsx',
  'SvgBlock.tsx',
  'MathBlock.tsx',
  'MarkmapBlock.tsx',
  'ExcalidrawBlock.tsx',
  'DomainStoryBlock.tsx',
  'TableBlock.tsx',
];

for (const fileName of blockFiles) {
  const filePath = path.join(rootDir, 'src/features/viewers/components/drivers/markdown', fileName);
  assert.ok(fs.existsSync(filePath), `${fileName} 文件必须存在`);
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('DiagramCompactTrigger'), `${fileName} 必须引入 DiagramCompactTrigger 微型展开胶囊`);
  assert.ok(content.includes('isToolbarExpanded'), `${fileName} 必须声明 isToolbarExpanded 状态`);
  assert.ok(content.includes('is-toolbar-open'), `${fileName} 根节点必须在展开时包含 is-toolbar-open 类名`);
  assert.ok(content.includes('PanelTopClose'), `${fileName} 展开工具栏必须提供 PanelTopClose 收起按钮`);
}
console.log('✅ 4. 8 大核心图表 Block 与数据表格 Block (TableBlock) 全量覆盖校验通过');

console.log('🎉 Markdown 图表与数据表格工具栏折叠开关全链路自动化测试全部 PASSED！\n');
