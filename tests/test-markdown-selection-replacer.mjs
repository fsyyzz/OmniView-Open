/**
 * 单元测试: Markdown 划选悬浮格式化与源定位替换算法 (Selection Replacer Test)
 * 验证对粗体、斜体、删除线、行内代码、高亮、超链接、WikiLink 的精准行级匹配与格式 Toggle
 */
import assert from 'node:assert/strict';
import {
  applyMarkdownSelectionFormat,
  toggleFormatText,
} from '../src/features/viewers/lib/markdownSelectionReplacer.ts';

console.log('🧪 开始运行 Markdown 划选悬浮格式化测试...');

// 1. 测试基础格式包裹
{
  const text = 'OmniView';
  const boldRes = toggleFormatText(text, 'bold');
  assert.equal(boldRes.resultText, '**OmniView**');
  assert.equal(boldRes.isToggledOff, false);

  // Toggle 反选解除格式
  const unboldRes = toggleFormatText('**OmniView**', 'bold');
  assert.equal(unboldRes.resultText, 'OmniView');
  assert.equal(unboldRes.isToggledOff, true);

  const italicRes = toggleFormatText(text, 'italic');
  assert.equal(italicRes.resultText, '*OmniView*');
  const unitalicRes = toggleFormatText('*OmniView*', 'italic');
  assert.equal(unitalicRes.resultText, 'OmniView');

  const codeRes = toggleFormatText(text, 'code');
  assert.equal(codeRes.resultText, '`OmniView`');
  const uncodeRes = toggleFormatText('`OmniView`', 'code');
  assert.equal(uncodeRes.resultText, 'OmniView');

  const strikeRes = toggleFormatText(text, 'strikethrough');
  assert.equal(strikeRes.resultText, '~~OmniView~~');
  const unstrikeRes = toggleFormatText('~~OmniView~~', 'strikethrough');
  assert.equal(unstrikeRes.resultText, 'OmniView');

  const highlightRes = toggleFormatText(text, 'highlight');
  assert.equal(highlightRes.resultText, '==OmniView==');
  const unhighlightRes = toggleFormatText('==OmniView==', 'highlight');
  assert.equal(unhighlightRes.resultText, 'OmniView');

  const wikiRes = toggleFormatText(text, 'wikilink');
  assert.equal(wikiRes.resultText, '[[OmniView]]');
  const unwikiRes = toggleFormatText('[[OmniView]]', 'wikilink');
  assert.equal(unwikiRes.resultText, 'OmniView');

  const linkRes = toggleFormatText(text, 'link', 'https://example.com');
  assert.equal(linkRes.resultText, '[OmniView](https://example.com)');
  const unlinkRes = toggleFormatText('[OmniView](https://example.com)', 'link');
  assert.equal(unlinkRes.resultText, 'OmniView');

  console.log('  ✅ 基础文本格式化与 Toggle 反选测试通过');
}

// 2. 测试根据行号与选区在全文中精准替换
{
  const markdownSample = [
    '# 欢迎使用 OmniView',
    '',
    'OmniView 是一个高效的文件渲染器。',
    '',
    '这是一个包含重点的段落，请务必仔细阅读。',
    '',
    '- 列表项 1',
    '- 列表项 2 包含特别说明',
  ].join('\n');

  // 在第 3 行对 "高效" 施加粗体
  const res1 = applyMarkdownSelectionFormat({
    fullContent: markdownSample,
    selectedText: '高效',
    sourceLine: 3,
    action: 'bold',
  });

  assert.ok(res1 !== null, '应成功匹配并格式化');
  assert.ok(res1.newFullContent.includes('**高效**的文件渲染器'));
  assert.ok(res1.newFullContent.startsWith('# 欢迎使用 OmniView'));

  // 对第 5 行应用高亮
  const res2 = applyMarkdownSelectionFormat({
    fullContent: res1.newFullContent,
    selectedText: '重点',
    sourceLine: 5,
    action: 'highlight',
  });

  assert.ok(res2 !== null);
  assert.ok(res2.newFullContent.includes('包含==重点==的段落'));

  // 对第 8 行应用 WikiLink
  const res3 = applyMarkdownSelectionFormat({
    fullContent: res2.newFullContent,
    selectedText: '特别说明',
    sourceLine: 8,
    action: 'wikilink',
  });

  assert.ok(res3 !== null);
  assert.ok(res3.newFullContent.includes('列表项 2 包含[[特别说明]]'));

  console.log('  ✅ 全文行级源映射与精准替换测试通过');
}

// 3. 测试块级操作 (H1, H2, H3, Quote, Todo)
{
  const blockSample = [
    '主要概览',
    '二级小结',
    '这是一段重点引用的描述文字',
    '完成功能开发任务',
  ].join('\n');

  // H1 测试
  const h1Res = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '主要概览',
    sourceLine: 1,
    action: 'h1',
  });
  assert.ok(h1Res !== null);
  assert.ok(h1Res.newFullContent.startsWith('# 主要概览'));

  // Quote 引用块测试
  const quoteRes = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '重点引用',
    sourceLine: 3,
    action: 'quote',
  });
  assert.ok(quoteRes !== null);
  assert.ok(quoteRes.newFullContent.includes('> 这是一段重点引用的描述文字'));

  // Todo 待办任务测试
  const todoRes = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '完成功能开发任务',
    sourceLine: 4,
    action: 'todo',
  });
  assert.ok(todoRes !== null);
  assert.ok(todoRes.newFullContent.includes('- [ ] 完成功能开发任务'));

  // P1 Callout 提示框转换测试
  const calloutRes = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '重点引用',
    sourceLine: 3,
    action: 'callout',
    linkUrl: 'NOTE',
  });
  assert.ok(calloutRes !== null);
  assert.ok(calloutRes.newFullContent.includes('> [!NOTE]\n> 这是一段重点引用的描述文字'));

  // P0 行内数学公式与 P1 脚注批注测试
  const mathRes = toggleFormatText('E=mc^2', 'inlineMath');
  assert.equal(mathRes.resultText, '$E=mc^2$');
  const unmathRes = toggleFormatText('$E=mc^2$', 'inlineMath');
  assert.equal(unmathRes.resultText, 'E=mc^2');

  const fnRes = applyMarkdownSelectionFormat({
    fullContent: blockSample,
    selectedText: '二级小结',
    sourceLine: 2,
    action: 'footnote',
    linkUrl: '这是新增的补充说明',
  });
  assert.ok(fnRes !== null);
  assert.ok(fnRes.newFullContent.includes('二级小结[^1]'));
  assert.ok(fnRes.newFullContent.includes('[^1]: 这是新增的补充说明'));

  console.log('  ✅ 块级格式化扩展 (H1, Quote, Todo, Callout, InlineMath, Footnote) 测试通过');
}

// 4. 测试跨行选区智能辅助转换 (P0 formatMultiLineSelection)
{
  const { formatMultiLineSelection } = await import(
    '../src/features/viewers/lib/markdownSelectionReplacer.ts'
  );
  const multiText = '第一行文字\n第二行文字';
  assert.equal(formatMultiLineSelection(multiText, 'quote'), '> 第一行文字\n> 第二行文字');
  assert.equal(
    formatMultiLineSelection(multiText, 'fencedCode'),
    '```\n第一行文字\n第二行文字\n```'
  );
  assert.equal(
    formatMultiLineSelection(multiText, 'callout', 'TIP'),
    '> [!TIP]\n> 第一行文字\n> 第二行文字'
  );
  console.log('  ✅ 跨行选区智能转换 (引用块/代码围栏/Callout) 测试通过');
}

// 5. 测试方案 A：预览区块级原地专注编辑引擎 (markdownBlockEditor.ts)
{
  const {
    extractBlockRawMarkdown,
    replaceBlockRawMarkdown,
    getBlockTypeLabel,
    applyEditorQuickSnippet,
    findBlockBySourceLine,
  } = await import('../src/features/viewers/lib/markdownBlockEditor.ts');

  const docSample = [
    '# 系统架构总览',
    '',
    '这里包含双链 [[核心模块]] 与行内公式 $E=mc^2$。',
    '第二行段落内容。',
    '',
    '> [!NOTE]',
    '> 这是一段 Callout 提示。',
    '',
    '```mermaid',
    'graph TD',
    '  A --> B',
    '```',
  ].join('\n');

  // 5.1 提取段落真实源码（自动剥离末尾被 Lexer 吞入的分隔空行 L5）
  const slice = extractBlockRawMarkdown(docSample, 3, 5);
  assert.equal(slice.actualStartLine, 3);
  assert.equal(slice.actualEndLine, 4, '应自动剥离第 5 行块间分隔空行');
  assert.equal(
    slice.rawSlice,
    '这里包含双链 [[核心模块]] 与行内公式 $E=mc^2$。\n第二行段落内容。',
    '提取的源码必须保持原始双链与公式语法，零宏展开污染'
  );

  // 5.2 回写修改后的块内容（验证块间空行 L5 不丢失，且正确计算行数差值）
  const replaced = replaceBlockRawMarkdown(
    docSample,
    slice.actualStartLine,
    slice.actualEndLine,
    '修改后的第一行\n新增的第二行\n新增的第三行'
  );
  assert.equal(replaced.newLineCount, 3);
  assert.equal(replaced.lineDelta, 1);
  assert.ok(
    replaced.newFullContent.includes('新增的第三行\n\n> [!NOTE]'),
    '回写后相邻块之间的空行必须完好保留，严禁段落粘连'
  );

  // 5.3 语义块类型识别
  assert.equal(getBlockTypeLabel('html', undefined, '## 二级标题', 'zh-CN'), 'H2 章节标题');
  assert.equal(getBlockTypeLabel('html', undefined, '> [!NOTE]\n> 内容', 'zh-CN'), 'Callout 语义提示块');
  assert.equal(getBlockTypeLabel('html', undefined, '- [x] 已完成事项', 'zh-CN'), '待办任务列表');
  assert.equal(getBlockTypeLabel('mermaid', undefined, 'graph TD', 'zh-CN'), 'Mermaid 图表源码');
  assert.equal(getBlockTypeLabel('code', 'typescript', 'const x = 1;', 'zh-CN'), '代码块 (TYPESCRIPT)');

  // 5.4 编辑器内快捷语法插入与包裹
  const boldSnap = applyEditorQuickSnippet('Hello OmniView', 6, 14, 'bold');
  assert.equal(boldSnap.nextText, 'Hello **OmniView**');
  const mathSnap = applyEditorQuickSnippet('公式: ', 4, 4, 'math');
  assert.equal(mathSnap.nextText, '公式: $E = mc^2$');

  // 5.5 根据源码行号反查 AST 块（跳过 pagebreak）
  const mockBlocks = [
    { id: 'b-1', type: 'html', startLine: 1, endLine: 2 },
    { id: 'b-page', type: 'pagebreak', startLine: 3, endLine: 3 },
    { id: 'b-2', type: 'html', startLine: 4, endLine: 8 },
  ];
  assert.equal(findBlockBySourceLine(mockBlocks, 5)?.id, 'b-2');
  assert.equal(findBlockBySourceLine(mockBlocks, 3)?.id, 'b-1');

  console.log('  ✅ 方案 A 块级原地专注编辑引擎 (切片保真/空行守恒/快捷语法/行号反查) 测试通过');
}

console.log('🎉 所有 Markdown 划选悬浮格式化与原地专注编辑单元测试全部通过！\n');


