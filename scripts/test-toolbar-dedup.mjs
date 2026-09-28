/**
 * OmniView 非 Markdown 工具栏去重与系统能力融合自动化测试
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 开始多格式驱动工具栏去重与系统能力融合自动化测试...');

// 1. 读取核心源文件
const pluginDocViewSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/PluginDocumentView.tsx'), 'utf-8');
const viewerRendererSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/ViewerRenderer.tsx'), 'utf-8');
const driverRegistrySrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/lib/driverRegistry.tsx'), 'utf-8');
const diagramStudioSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/DiagramStudioShell.tsx'), 'utf-8');
const plantUmlSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/PlantUmlViewer.tsx'), 'utf-8');
const mindmapSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/MindmapViewer.tsx'), 'utf-8');
const codeViewerSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/CodeViewer.tsx'), 'utf-8');
const structuredDataSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/data/StructuredDataViewer.tsx'), 'utf-8');

// --- 测试 1: NonMarkdownPluginView 彻底移除外层重复动作栏 ---
console.log('--- 测试 1: NonMarkdownPluginView 彻底移除外层重复动作栏 ---');
assert.ok(!pluginDocViewSrc.includes('btn-plugin-open-native-editor'), 'NonMarkdownPluginView 不应包含外层重复的在编辑器打开按钮');
assert.ok(!pluginDocViewSrc.includes('btn-non-markdown-settings'), 'NonMarkdownPluginView 不应包含外层冗余设置按钮');
assert.ok(!pluginDocViewSrc.includes('btn-non-markdown-shortcuts'), 'NonMarkdownPluginView 不应包含外层冗余快捷键按钮');
assert.ok(!pluginDocViewSrc.includes('toolbarRef'), 'NonMarkdownPluginView 应移除无用的外壳工具栏宽度监听');
console.log('✅ 外层重复顶栏剥离验证通过');

// --- 测试 2: DriverProps 与 ViewerRenderer SPI 契约扩展 ---
console.log('--- 测试 2: DriverProps 与 ViewerRenderer SPI 契约扩展 ---');
assert.ok(driverRegistrySrc.includes('onOpenSettings?: () => void;'), 'DriverProps 必须声明 onOpenSettings 扩展能力');
assert.ok(driverRegistrySrc.includes('onOpenShortcuts?: () => void;'), 'DriverProps 必须声明 onOpenShortcuts 扩展能力');
assert.ok(viewerRendererSrc.includes('onOpenSettings,'), 'ViewerRenderer 必须接收并向下派发 onOpenSettings');
assert.ok(viewerRendererSrc.includes('onOpenShortcuts,'), 'ViewerRenderer 必须接收并向下派发 onOpenShortcuts');
console.log('✅ 驱动注册 SPI 与渲染分发器协议验证通过');

// --- 测试 3: DiagramStudioShell (Mermaid / Graphviz / DomainStory) 顶栏能力融合 ---
console.log('--- 测试 3: DiagramStudioShell 顶栏能力融合 ---');
assert.ok(diagramStudioSrc.includes('onOpenSettings'), 'DiagramStudioShell 必须支持 onOpenSettings');
assert.ok(diagramStudioSrc.includes('onOpenShortcuts'), 'DiagramStudioShell 必须支持 onOpenShortcuts');
assert.ok(diagramStudioSrc.includes('btn-diagram-settings'), 'DiagramStudioShell 必须具备设置入口');
assert.ok(diagramStudioSrc.includes('btn-diagram-shortcuts'), 'DiagramStudioShell 必须具备快捷键入口');
console.log('✅ DiagramStudioShell 顶栏系统能力融合校验通过');

// --- 测试 4: 各大核心 Viewer 顶栏系统能力融合覆盖 ---
console.log('--- 测试 4: 各大核心 Viewer 顶栏系统能力融合覆盖 ---');
assert.ok(plantUmlSrc.includes('btn-plantuml-settings'), 'PlantUmlViewer 必须具备设置入口');
assert.ok(plantUmlSrc.includes('btn-plantuml-shortcuts'), 'PlantUmlViewer 必须具备快捷键入口');
assert.ok(mindmapSrc.includes('btn-mindmap-settings'), 'MindmapViewer 必须具备设置入口');
assert.ok(mindmapSrc.includes('btn-mindmap-shortcuts'), 'MindmapViewer 必须具备快捷键入口');
assert.ok(codeViewerSrc.includes('btn-code-settings'), 'CodeViewer 必须具备设置入口');
assert.ok(codeViewerSrc.includes('btn-code-shortcuts'), 'CodeViewer 必须具备快捷键入口');
assert.ok(structuredDataSrc.includes('btn-structured-settings'), 'StructuredDataViewer 必须具备设置入口');
assert.ok(structuredDataSrc.includes('btn-structured-shortcuts'), 'StructuredDataViewer 必须具备快捷键入口');
console.log('✅ PlantUML, Mindmap, CodeViewer, StructuredDataViewer 顶栏融合覆盖校验通过');

console.log('\n🎉 所有多格式驱动工具栏去重与系统能力融合自动化测试全部通过！');
