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
const headerEndIdx = code.indexOf('{/* Code Body */}');
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
  /showCopyMenu\s*\?\s*['"]opacity-100 pointer-events-auto['"]/.test(code),
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

console.log('🎉 全部 Markdown 代码块统一顶部悬浮工具条测试 100% 通过！\n');
