/**
 * OmniView Markdown 源码编辑光标行悬浮快速插入特性自动化测试套件
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 开始 Markdown 源码编辑光标行快速插入组件契约测试...');

const inserterSourcePath = path.join(process.cwd(), 'src/features/viewers/components/markdown/MarkdownQuickInserter.tsx');
const codeViewerSourcePath = path.join(process.cwd(), 'src/features/viewers/components/drivers/CodeViewer.tsx');

assert.ok(fs.existsSync(inserterSourcePath), 'MarkdownQuickInserter.tsx 组件文件必须存在');
assert.ok(fs.existsSync(codeViewerSourcePath), 'CodeViewer.tsx 组件文件必须存在');

const inserterContent = fs.readFileSync(inserterSourcePath, 'utf-8');
const codeViewerContent = fs.readFileSync(codeViewerSourcePath, 'utf-8');

// 1. GitHub Alert 契约断言
console.log('--- 测试 1: GitHub Alert 5 大语义框完整性 ---');
const alertTypes = ['alert-note', 'alert-tip', 'alert-important', 'alert-warning', 'alert-caution'];
for (const alertId of alertTypes) {
  assert.ok(inserterContent.includes(alertId), `必须定义 ${alertId} 语义项`);
}
assert.ok(inserterContent.includes('> [!NOTE]'), '必须包含 [!NOTE] 模板');
assert.ok(inserterContent.includes('> [!TIP]'), '必须包含 [!TIP] 模板');
assert.ok(inserterContent.includes('> [!IMPORTANT]'), '必须包含 [!IMPORTANT] 模板');
assert.ok(inserterContent.includes('> [!WARNING]'), '必须包含 [!WARNING] 模板');
assert.ok(inserterContent.includes('> [!CAUTION]'), '必须包含 [!CAUTION] 模板');
console.log('✅ GitHub Alert 5 大语义警示框模板全部健全');

// 2. 交互式排版组件契约断言 (Skills 规范)
console.log('--- 测试 2: 交互式排版组件模板覆盖 ---');
assert.ok(inserterContent.includes('> [!TABS]'), '必须包含 [!TABS] 多标签卡片模板');
assert.ok(inserterContent.includes('> [!STEPS]'), '必须包含 [!STEPS] 引导步骤模板');
assert.ok(inserterContent.includes('> [!COMPARE]'), '必须包含 [!COMPARE] 方案对比模板');
assert.ok(inserterContent.includes('> [!TIMELINE]'), '必须包含 [!TIMELINE] 时间线模板');
console.log('✅ 交互式卡片排版组件模板校验通过');

// 3. 图表与公式模板契约断言
console.log('--- 测试 3: 可视化图表与数学公式模板 ---');
assert.ok(inserterContent.includes('```mermaid\\nflowchart'), '必须包含 Mermaid 流程图模板');
assert.ok(inserterContent.includes('```mermaid\\nsequenceDiagram'), '必须包含 Mermaid 时序图模板');
assert.ok(inserterContent.includes('```plantuml'), '必须包含 PlantUML 架构图模板');
assert.ok(inserterContent.includes('```svg'), '必须包含 SVG 矢量图模板');
assert.ok(inserterContent.includes('diag-katex'), '必须定义 KaTeX 数学公式模板');
assert.ok(inserterContent.includes('f(x) = '), '必须包含 KaTeX 独立数学公式模板内容');
console.log('✅ 流程图、时序图、PlantUML、SVG 与数学公式模板校验通过');

// 4. 基础排版结构覆盖
console.log('--- 测试 4: 基础常用结构模板 ---');
assert.ok(inserterContent.includes('# 标题内容'), '必须支持一级标题 H1');
assert.ok(inserterContent.includes('## 章节标题'), '必须支持二级标题 H2');
assert.ok(inserterContent.includes('### 子节标题'), '必须支持三级标题 H3');
assert.ok(inserterContent.includes('- [ ] 待办事项'), '必须支持交互式任务清单');
assert.ok(inserterContent.includes('| 字段名称 | 类型 | 说明 |'), '必须支持标准数据表格');
assert.ok(inserterContent.includes('```typescript'), '必须支持标准语法着色代码块');
console.log('✅ 标题、待办清单、表格与代码块模板校验通过');

// 5. CodeViewer 挂载与光标像素级吸附契约断言
console.log('--- 测试 5: CodeViewer 源码编辑窗口挂载与吸附逻辑 ---');
assert.ok(codeViewerContent.includes('MarkdownQuickInserter'), 'CodeViewer 必须引入 MarkdownQuickInserter');
assert.ok(codeViewerContent.includes('isMarkdown'), 'CodeViewer 必须判断是否为 Markdown 文件格式');
assert.ok(codeViewerContent.includes('caretCoords'), 'CodeViewer 必须维护精确 caretCoords 状态');
assert.ok(codeViewerContent.includes('getCaretCoordinates'), 'CodeViewer 必须接入精确光标坐标计算器 getCaretCoordinates');
assert.ok(codeViewerContent.includes('updateCaretPosition'), 'CodeViewer 必须具备 updateCaretPosition 光标位置更新器');
assert.ok(codeViewerContent.includes('handleQuickInsertSnippet'), 'CodeViewer 必须具备 handleQuickInsertSnippet 插入调度器');
assert.ok(codeViewerContent.includes('caretLeft={caretCoords.caretLeft}'), '必须向悬浮组件传递真实的横向 caretLeft 坐标');
assert.ok(codeViewerContent.includes('caretTop={caretCoords.caretTop}'), '必须向悬浮组件传递真实的纵向 caretTop 坐标');
console.log('✅ CodeViewer 挂载、光标像素级吸附与插入调度契约全部通过');

// 6. 纯逻辑仿真测试：插入片段调度器行为
console.log('--- 测试 6: 纯函数模拟空行替换与换行插入逻辑 ---');
function simulateInsert(currentVal, selectionStart, selectionEnd, template) {
  const lineStart = currentVal.lastIndexOf('\n', selectionStart - 1) + 1;
  let lineEnd = currentVal.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = currentVal.length;

  const currentLineText = currentVal.slice(lineStart, lineEnd);
  const isCurrentLineEmpty = currentLineText.trim() === '';

  let newVal;
  let newCursorPos;

  if (selectionStart === selectionEnd && isCurrentLineEmpty) {
    const before = currentVal.slice(0, lineStart);
    const after = currentVal.slice(lineEnd);
    const textToInsert = template.endsWith('\n') ? template : template + '\n';
    newVal = before + textToInsert + (after.startsWith('\n') ? after.slice(1) : after);
    newCursorPos = lineStart + textToInsert.length;
  } else if (selectionStart < selectionEnd) {
    const before = currentVal.slice(0, selectionStart);
    const after = currentVal.slice(selectionEnd);
    const textToInsert = template.endsWith('\n') ? template : template + '\n';
    newVal = before + textToInsert + after;
    newCursorPos = selectionStart + textToInsert.length;
  } else {
    const before = currentVal.slice(0, lineEnd);
    const after = currentVal.slice(lineEnd);
    const textToInsert = '\n' + (template.endsWith('\n') ? template.slice(0, -1) : template);
    newVal = before + textToInsert + after;
    newCursorPos = lineEnd + textToInsert.length;
  }
  return { newVal, newCursorPos };
}

// 6.1 空行直接替换测试
const r1 = simulateInsert('# Title\n\nFooter', 8, 8, '> [!NOTE]\n> Note text\n');
assert.strictEqual(r1.newVal, '# Title\n> [!NOTE]\n> Note text\nFooter', '空行应被模板直接替换');

// 6.2 非空行末尾插入测试
const r2 = simulateInsert('Line 1\nLine 2', 6, 6, '- [ ] Task 1\n');
assert.strictEqual(r2.newVal, 'Line 1\n- [ ] Task 1\nLine 2', '非空行应在当前行下方换行插入');

console.log('✅ 空行替换与换行插入仿真行为验证通过');

console.log('🎉 全部 6 组 Markdown 源码编辑光标行快速插入测试 100% 通过！\n');
