/**
 * Markdown 代码块统一悬浮工具条交互自动化测试
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 开始 Markdown 代码块统一顶部悬浮工具条自动化测试...');

const codeBlockPath = path.join(rootDir, 'src/features/viewers/components/drivers/markdown/CodeBlock.tsx');
const code = fs.readFileSync(codeBlockPath, 'utf8');

// 1. 验证工具条容器整合
assert.ok(code.includes('code-block-toolbar'), 'CodeBlock 必须包含 code-block-toolbar 工具条容器');
assert.ok(
  code.includes('opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'),
  '顶部操作工具条必须默认隐藏 (opacity-0)，并在 hover 时显示 (group-hover:opacity-100)'
);
console.log('✅ 1. 工具条统一默认隐藏与悬浮显示类名校验通过');

// 2. 验证折叠、全屏、复制是否全部整合在工具条内部，而不是散落在 header 外部
const headerStartIdx = code.indexOf('<div className="code-block-header');
const headerEndIdx = code.indexOf('{/* Code Body');
assert.ok(headerStartIdx !== -1 && headerEndIdx !== -1, '必须定位到 code-block-header 结构');
const headerContent = code.slice(headerStartIdx, headerEndIdx);

// 提取工具条内的子元素
const toolbarStartIdx = headerContent.indexOf('code-block-toolbar');
const toolbarContent = headerContent.slice(toolbarStartIdx);

// 折叠按钮必须在工具条内
assert.ok(
  toolbarContent.includes('onToggleCollapse'),
  '折叠/展开操作按钮必须整合进 code-block-toolbar 内'
);

// 全屏按钮必须在工具条内
assert.ok(
  toolbarContent.includes('setIsFullscreen(true)'),
  '全屏查看操作按钮必须整合进 code-block-toolbar 内'
);

// 复制纯文本与 Word 菜单必须在工具条内
assert.ok(
  toolbarContent.includes('onCopy'),
  '一键复制操作按钮必须整合进 code-block-toolbar 内'
);
assert.ok(
  toolbarContent.includes('setShowCopyMenu'),
  '复制模式下拉菜单必须整合进 code-block-toolbar 内'
);
console.log('✅ 2. 折叠、全屏、复制操作全部收敛入顶部悬浮工具条校验通过');

// 3. 验证 showCopyMenu 防丢焦保活状态
assert.ok(
  /showCopyMenu[\s\S]*?\?\s*['"]opacity-100 pointer-events-auto['"]/.test(code),
  '复制菜单打开时必须强制保持工具条可见，避免失焦导致菜单异常关闭'
);
console.log('✅ 3. 下拉菜单打开态防抖防丢失校验通过');

// 4. 验证左侧语言与行数统计常驻显示，并支持点击快速折叠/展开
const leftSection = headerContent.slice(0, toolbarStartIdx);
assert.ok(
  leftSection.includes('codeLines.length'),
  '代码行数统计必须在 header 左侧常驻显示'
);
assert.ok(
  leftSection.includes('lang || \'TEXT\''),
  '代码语言标签必须在 header 左侧常驻显示'
);
console.log('✅ 4. 左侧语言标识与行数统计常驻展示校验通过');

// 5. 验证 Markdown 划选悬浮工具条与代码块悬浮工具栏严格遵循 --ov-* 语义化主题变量（禁用未定义的 --ov-text-primary 及依赖系统媒体查询的 dark:*）
const bubbleToolbarPath = path.resolve(__dirname, '../src/features/viewers/components/drivers/markdown/MarkdownBubbleToolbar.tsx');
const bubbleToolbarCode = fs.readFileSync(bubbleToolbarPath, 'utf-8');
assert.ok(
  !bubbleToolbarCode.includes('--ov-text-primary') && !bubbleToolbarCode.includes('dark:'),
  'MarkdownBubbleToolbar 禁止使用未定义的 --ov-text-primary 或与主题脱节的 Tailwind dark:* 类名'
);
assert.ok(
  bubbleToolbarCode.includes('var(--ov-surface-header') &&
    bubbleToolbarCode.includes('var(--ov-text-secondary)') &&
    bubbleToolbarCode.includes('var(--ov-surface-hover)'),
  'MarkdownBubbleToolbar 必须使用 --ov-surface-header、--ov-text-secondary、--ov-surface-hover 等主题令牌'
);
assert.ok(
  code.includes('bg-[var(--ov-surface)]') &&
    code.includes('hover:bg-[var(--ov-surface-hover)]') &&
    !code.includes('bg-slate-800/90'),
  'CodeBlock 顶部悬浮操作按钮应采用 --ov-* 主题令牌而非硬编码深色 slate 背景'
);
console.log('✅ 5. 划选气泡与代码块悬浮工具栏全主题 --ov-* 语义令牌校验通过');

// 6. 验证 P1 代码块智能增强：Shell 提示符剥离与 JSON/YAML/CSV 原地结构化预览
const {
  hasExplicitShellPrompts,
  stripShellPrompts,
  isStructuredDataLang,
  parseStructuredCodeBlock,
} = await import('../src/features/viewers/lib/codeBlockEnhancer.ts');

const sampleShell = [
  '# 安装依赖',
  '$ npm install',
  'added 120 packages in 2s',
  '$ npm run build',
].join('\n');
assert.equal(hasExplicitShellPrompts(sampleShell), true);
assert.equal(stripShellPrompts(sampleShell), '# 安装依赖\nnpm install\nnpm run build');

assert.equal(isStructuredDataLang('json'), true);
assert.equal(isStructuredDataLang('yaml'), true);
assert.equal(isStructuredDataLang('csv'), true);
assert.equal(isStructuredDataLang('typescript'), false);

const csvParsed = parseStructuredCodeBlock('csv', 'name,role\nAlice,Engineer\nBob,Designer');
assert.equal(csvParsed.kind, 'table');
assert.deepEqual(csvParsed.headers, ['name', 'role']);
assert.equal(csvParsed.rows.length, 2);

const jsonTreeParsed = parseStructuredCodeBlock('json', '{"app":"OmniView","version":1}');
assert.equal(jsonTreeParsed.kind, 'tree');
assert.equal(jsonTreeParsed.entries.length, 2);
console.log('✅ 6. P1 代码块 Shell 提示符智能剥离与 JSON/YAML/CSV 结构化预览引擎校验通过');

console.log('🎉 全部 Markdown 代码块统一顶部悬浮工具条测试 100% 通过！\n');

