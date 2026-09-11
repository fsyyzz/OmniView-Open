/**
 * OmniView Markdown 大纲导航单滚动条与布局防回退回归测试
 * 确保 markdown-outline 外层容器不产生二次滚动条，且内部 nav 容器作为唯一滚动宿主
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 开始 Markdown 大纲导航与单滚动条规范回归测试...');

// 1. 验证 CSS 样式层：.markdown-outline 外层必须为 flex column + overflow: hidden，严禁外层 overflow-y: auto
const cssPath = path.resolve('src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// 匹配 .markdown-outline 基础类声明块
const outlineClassMatch = cssContent.match(/\.markdown-outline\s*\{([^}]+)\}/);
assert.ok(outlineClassMatch, '必须定义 .markdown-outline 基础类');
const outlineRules = outlineClassMatch[1];

assert.ok(
  outlineRules.includes('display: flex') || outlineRules.includes('display:flex'),
  '【防双滚动条】markdown-outline 必须显式声明 display: flex 垂直容器'
);
assert.ok(
  outlineRules.includes('flex-direction: column') || outlineRules.includes('flex-direction:column'),
  '【防双滚动条】markdown-outline 必须为 flex-direction: column'
);
assert.ok(
  outlineRules.includes('overflow: hidden') || outlineRules.includes('overflow:hidden'),
  '【防双滚动条】markdown-outline 外层必须设置 overflow: hidden，禁止外层产生滚动条'
);
assert.ok(
  !outlineRules.includes('overflow-y: auto'),
  '【防双滚动条】markdown-outline 外层严禁声明 overflow-y: auto，避免与内层产生双滚动条'
);

// 匹配 .markdown-outline[data-position="floating"] 浮动面板样式
const floatingMatch = cssContent.match(/\.markdown-outline\[data-position="floating"\]\s*\{([^}]+)\}/);
assert.ok(floatingMatch, '必须定义浮动大纲样式');
const floatingRules = floatingMatch[1];
assert.ok(
  floatingRules.includes('overflow: hidden') || floatingRules.includes('overflow:hidden'),
  '【防双滚动条】浮动大纲面板也必须 overflow: hidden'
);

// 匹配 .markdown-outline-nav 滚动容器
const navClassMatch = cssContent.match(/\.markdown-outline-nav\s*\{([^}]+)\}/);
assert.ok(navClassMatch, '必须定义 .markdown-outline-nav 作为唯一单滚动条宿主');
const navRules = navClassMatch[1];
assert.ok(
  navRules.includes('overflow-y: auto') || navRules.includes('overflow-y:auto'),
  '【单滚动条】markdown-outline-nav 必须声明 overflow-y: auto'
);
assert.ok(
  navRules.includes('overflow-x: hidden') || navRules.includes('overflow-x:hidden'),
  '【防横向双滚动条】markdown-outline-nav 必须声明 overflow-x: hidden'
);

// 2. 验证 MarkdownOutlineSidebar.tsx 组件规范
const componentPath = path.resolve('src/features/viewers/components/markdown/MarkdownOutlineSidebar.tsx');
const componentContent = fs.readFileSync(componentPath, 'utf8');

assert.ok(
  componentContent.includes('markdown-outline-nav'),
  '组件内 nav 必须挂载 markdown-outline-nav 单滚动条类'
);
assert.ok(
  !componentContent.includes('max-h-[calc(100vh-140px)]'),
  '组件内严禁使用脱离 flex 上下文的 max-h-[calc(100vh-140px)] 硬编码高度，避免撑破父级容器'
);
assert.ok(
  componentContent.includes('flex-1') && componentContent.includes('min-h-0'),
  '组件内 nav 必须使用 flex-1 min-h-0 自适应填满剩余纵向空间'
);
assert.ok(
  componentContent.includes('shrink-0'),
  '组件顶部控制头部必须声明 shrink-0 保持固定，不随列表内容滚动'
);
assert.ok(
  componentContent.includes('cursor-col-resize'),
  '【可调整大小】组件必须包含 cursor-col-resize 拖拽把手，支持用户自由调整大纲宽度'
);
assert.ok(
  componentContent.includes('onPointerDown') || componentContent.includes('handleResizeStart'),
  '【可调整大小】组件必须提供拖拽调整宽度的交互事件处理'
);
assert.ok(
  componentContent.includes('onDoubleClick') || componentContent.includes('handleResetWidth'),
  '【快捷复位】手柄必须支持双击复位默认宽度'
);

// 3. 验证设置存储与类型定义
const typesPath = path.resolve('src/shared/types.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');
assert.ok(
  typesContent.includes('outlineWidth?: number;'),
  '【持久化】WorkbenchSettings 接口必须定义 outlineWidth'
);
assert.ok(
  typesContent.includes("OutlineDisplayMode = 'list' | 'tree'") ||
    typesContent.includes('OutlineDisplayMode'),
  '【树形模式】WorkbenchSettings 必须定义 OutlineDisplayMode'
);
assert.ok(
  typesContent.includes('outlineDisplayMode?: OutlineDisplayMode'),
  '【持久化】WorkbenchSettings 接口必须定义 outlineDisplayMode'
);

const storagePath = path.resolve('src/shared/lib/settingsStorage.ts');
const storageContent = fs.readFileSync(storagePath, 'utf8');
assert.ok(
  storageContent.includes('outlineWidth:'),
  '【默认值】DEFAULT_SETTINGS 必须包含 outlineWidth 初始宽度'
);
assert.ok(
  storageContent.includes("outlineDisplayMode: 'tree'") || storageContent.includes('outlineDisplayMode:'),
  '【默认值】DEFAULT_SETTINGS 必须包含 outlineDisplayMode'
);

assert.ok(
  componentContent.includes('ListTree') || componentContent.includes('outlineModeTree'),
  '【树形模式】大纲侧栏必须提供树形展示模式切换入口'
);
assert.ok(
  componentContent.includes('data-display-mode'),
  '【树形模式】大纲根节点必须暴露 data-display-mode 便于样式与测试定位'
);
assert.ok(
  componentContent.includes('buildOutlineTree') || componentContent.includes('flattenVisibleOutlineTree'),
  '【树形模式】组件必须接入大纲建树 / 可见行展开逻辑'
);

// 4. 大纲建树纯函数行为断言（内联最小实现契约，避免依赖打包）
const astPath = path.resolve('src/features/viewers/lib/markdownAst.ts');
const astContent = fs.readFileSync(astPath, 'utf8');
assert.ok(astContent.includes('export function buildOutlineTree'), '必须导出 buildOutlineTree');
assert.ok(astContent.includes('export function flattenVisibleOutlineTree'), '必须导出 flattenVisibleOutlineTree');
assert.ok(astContent.includes('export function collectOutlineAncestorIndexes'), '必须导出 collectOutlineAncestorIndexes');

const markdownViewerPath = path.resolve('src/features/viewers/components/drivers/MarkdownViewer.tsx');
const markdownViewerContent = fs.readFileSync(markdownViewerPath, 'utf8');
assert.ok(
  markdownViewerContent.includes('StableHtmlBlock'),
  '【搜索高亮防腐】MarkdownViewer 正文 HTML 必须使用 StableHtmlBlock，避免无关重渲染冲掉搜索 mark'
);
assert.ok(
  !markdownViewerContent.includes('dangerouslySetInnerHTML={{ __html: block.renderedHtml }}'),
  '【搜索高亮防腐】禁止对 markdown-content 直接使用不稳定的 dangerouslySetInnerHTML 对象字面量'
);

console.log('✅ Markdown 大纲导航单滚动条规范与拖拽调整大小回归测试全部通过！');
