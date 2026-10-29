/**
 * Markdown 块级原地专注编辑与块级 CRUD 引擎单元测试套件
 * 覆盖：提取切片、无损替换、智能空行归一化删除、下方克隆、上下插入、上下块交换移动与行号反查
 */
import assert from 'node:assert/strict';
import {
  extractBlockRawMarkdown,
  replaceBlockRawMarkdown,
  deleteBlockRawMarkdown,
  duplicateBlockRawMarkdown,
  insertAdjacentBlockRawMarkdown,
  moveBlockRawMarkdown,
  findBlockBySourceLine,
} from '../src/features/viewers/lib/markdownBlockEditor.ts';

console.log('🧪 开始 Markdown 块级原地编辑与块级 CRUD (Delete/Insert/Duplicate/Move) 单元测试...');

const sampleDoc = [
  '# 第一章 标题',
  '',
  '这是第一段正文内容，包含第二行：',
  '第一段第二行。',
  '',
  '> [!NOTE]',
  '> 这是一个警告提示块。',
  '',
  '```ts',
  'const x = 42;',
  '```',
].join('\n');

// 1. 测试 extractBlockRawMarkdown 自动剥离末尾吞入空行
{
  const slice = extractBlockRawMarkdown(sampleDoc, 3, 5);
  assert.equal(slice.rawSlice, '这是第一段正文内容，包含第二行：\n第一段第二行。');
  assert.equal(slice.actualStartLine, 3);
  assert.equal(slice.actualEndLine, 4);
  assert.equal(slice.lineCount, 2);
  console.log('  ✅ 1. extractBlockRawMarkdown 块尾空行剥离与精准切片测试通过');
}

// 2. 测试 deleteBlockRawMarkdown 删除中间块（智能消除连续双空行）
{
  const res = deleteBlockRawMarkdown(sampleDoc, 3, 5);
  assert.equal(res.deletedSlice, '这是第一段正文内容，包含第二行：\n第一段第二行。');
  assert.equal(res.deletedStartLine, 3);
  assert.equal(res.deletedEndLine, 4);

  const expected = [
    '# 第一章 标题',
    '',
    '> [!NOTE]',
    '> 这是一个警告提示块。',
    '',
    '```ts',
    'const x = 42;',
    '```',
  ].join('\n');
  assert.equal(res.newFullContent, expected);
  console.log('  ✅ 2. deleteBlockRawMarkdown 删除中间块并自动消除双空行测试通过');
}

// 3. 测试 deleteBlockRawMarkdown 删除首块与末块（不留首尾孤立空行）
{
  const delFirst = deleteBlockRawMarkdown(sampleDoc, 1, 2);
  assert.ok(
    delFirst.newFullContent.startsWith('这是第一段正文内容，包含第二行：'),
    '删除首块后不应残留顶部空行'
  );

  const delLast = deleteBlockRawMarkdown(sampleDoc, 9, 11);
  assert.ok(
    delLast.newFullContent.endsWith('> 这是一个警告提示块。'),
    '删除末块后不应残留尾部空行'
  );
  console.log('  ✅ 3. deleteBlockRawMarkdown 删除首块与末块边界空行清理测试通过');
}

// 4. 测试 duplicateBlockRawMarkdown 原地向下方克隆块
{
  const dup = duplicateBlockRawMarkdown(sampleDoc, 6, 7);
  assert.equal(dup.clonedSlice, '> [!NOTE]\n> 这是一个警告提示块。');
  assert.equal(dup.insertedStartLine, 9);
  assert.equal(dup.insertedEndLine, 10);

  const expected = [
    '# 第一章 标题',
    '',
    '这是第一段正文内容，包含第二行：',
    '第一段第二行。',
    '',
    '> [!NOTE]',
    '> 这是一个警告提示块。',
    '',
    '> [!NOTE]',
    '> 这是一个警告提示块。',
    '',
    '```ts',
    'const x = 42;',
    '```',
  ].join('\n');
  assert.equal(dup.newFullContent, expected);
  console.log('  ✅ 4. duplicateBlockRawMarkdown 原地克隆副本与新行号计算测试通过');
}

// 5. 测试 insertAdjacentBlockRawMarkdown 上方与下方插入新块
{
  const insBelow = insertAdjacentBlockRawMarkdown(
    sampleDoc,
    3,
    4,
    'below',
    '新插入的段落'
  );
  assert.equal(insBelow.insertedStartLine, 6);
  assert.equal(insBelow.insertedEndLine, 6);
  const linesBelow = insBelow.newFullContent.split('\n');
  assert.equal(linesBelow[5], '新插入的段落');

  const insAboveFirst = insertAdjacentBlockRawMarkdown(
    sampleDoc,
    1,
    1,
    'above',
    '顶部导言块'
  );
  assert.equal(insAboveFirst.insertedStartLine, 1);
  assert.equal(insAboveFirst.insertedEndLine, 1);
  assert.ok(insAboveFirst.newFullContent.startsWith('顶部导言块\n\n# 第一章 标题'));
  console.log('  ✅ 5. insertAdjacentBlockRawMarkdown 上方/下方插入新块与定位行号测试通过');
}

// 6. 测试 moveBlockRawMarkdown 上移与下移块
{
  // 将 Callout 块 (L6-L7) 上移，与第一段正文 (L3-L4) 交换
  const moveUp = moveBlockRawMarkdown(
    sampleDoc,
    { startLine: 6, endLine: 7 },
    { startLine: 3, endLine: 4 }
  );
  assert.equal(moveUp.newStartLine, 3);
  assert.equal(moveUp.newEndLine, 4);

  const expectedAfterMoveUp = [
    '# 第一章 标题',
    '',
    '> [!NOTE]',
    '> 这是一个警告提示块。',
    '',
    '这是第一段正文内容，包含第二行：',
    '第一段第二行。',
    '',
    '```ts',
    'const x = 42;',
    '```',
  ].join('\n');
  assert.equal(moveUp.newFullContent, expectedAfterMoveUp);

  // 再将该块下移回原位
  const moveDown = moveBlockRawMarkdown(
    moveUp.newFullContent,
    { startLine: 3, endLine: 4 },
    { startLine: 6, endLine: 7 }
  );
  assert.equal(moveDown.newFullContent, sampleDoc);
  assert.equal(moveDown.newStartLine, 6);
  assert.equal(moveDown.newEndLine, 7);
  console.log('  ✅ 6. moveBlockRawMarkdown 上移/下移块交换与无损还原测试通过');
}

// 7. 测试 replaceBlockRawMarkdown 与 findBlockBySourceLine 联动
{
  const rep = replaceBlockRawMarkdown(sampleDoc, 3, 4, '单行精简段落');
  assert.equal(rep.newLineCount, 1);
  assert.equal(rep.lineDelta, -1);

  const mockBlocks = [
    { id: 'b1', type: 'html', startLine: 1, endLine: 1 },
    { id: 'b2', type: 'html', startLine: 3, endLine: 3 },
    { id: 'b3', type: 'html', startLine: 5, endLine: 6 },
  ];
  const found = findBlockBySourceLine(mockBlocks, 5);
  assert.equal(found?.id, 'b3');
  console.log('  ✅ 7. replaceBlockRawMarkdown 与 findBlockBySourceLine 联动测试通过');
}

// 8. 测试首块下移 (Move Down) 与中间块连续下移（验证排除 space 空块后下移 100% 生效）
{
  // 首块 (# 第一章 标题, L1-L1) 与第二块 (正文段落, L3-L4) 交换下移
  const moveFirstDown = moveBlockRawMarkdown(
    sampleDoc,
    { startLine: 1, endLine: 1 },
    { startLine: 3, endLine: 4 }
  );
  assert.ok(
    moveFirstDown.newFullContent.startsWith('这是第一段正文内容，包含第二行：\n第一段第二行。\n\n# 第一章 标题'),
    '首块点击向下移动后应与下一可见块成功互换位置'
  );
  assert.equal(moveFirstDown.newStartLine, 4);
  assert.equal(moveFirstDown.newEndLine, 4);
  console.log('  ✅ 8. 首块与中间块向下移动 (Move Down) 互换位置测试通过');
}

// 9. 测试 MarkdownBlockActionBar 二段式极简渐进披露契约（默认仅展示「编辑」与「更多」两个小按钮，点击「更多」后展开进阶操作）
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const actionBarSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/viewers/components/drivers/markdown/MarkdownBlockActionBar.tsx'),
    'utf8'
  );
  assert.match(
    actionBarSource,
    /const\s+\[isMoreOpen,\s*setIsMoreOpen\]\s*=\s*useState\(false\)/,
    'MarkdownBlockActionBar 应包含 isMoreOpen 折叠状态且默认为 false'
  );
  assert.match(
    actionBarSource,
    /aria-label="Focused Block Edit"/,
    '应包含主操作「编辑」小按钮'
  );
  assert.match(
    actionBarSource,
    /aria-label="More Block Actions"/,
    '应包含「更多」小按钮用于按需展开更多操作'
  );
  assert.match(
    actionBarSource,
    /\{!isMoreOpen\s*\?\s*\(/,
    '默认未展开状态下应仅渲染「更多」触发按钮，隐藏插入/克隆/上下移动/删除按钮'
  );
  console.log('  ✅ 9. MarkdownBlockActionBar 默认二按钮（编辑 + 更多）渐进披露契约测试通过');
}

console.log('🎉 Markdown 块级原地专注编辑与块级 CRUD 引擎全部 9 项测试 100% 通过！');
