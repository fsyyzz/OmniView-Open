#!/usr/bin/env node
/**
 * OmniView 文本编辑器 Undo/Redo 历史栈状态机单元测试套件
 */
import assert from 'node:assert';
import { TextHistoryStack } from '../src/features/viewers/lib/historyStack.ts';

console.log('🧪 开始文本编辑器撤回/重做 (Undo/Redo) 历史栈状态机单元测试...');

// 测试 1: 初始状态验证
console.log('--- 测试 1: 初始状态校验 ---');
const stack = new TextHistoryStack('# Hello World');
assert.strictEqual(stack.canUndo, false, '初始状态不应允许 Undo');
assert.strictEqual(stack.canRedo, false, '初始状态不应允许 Redo');
assert.strictEqual(stack.length, 1);
assert.strictEqual(stack.currentSnapshot.value, '# Hello World');
console.log('✅ 初始状态校验通过');

// 测试 2: 记录单次变更与 Undo/Redo
console.log('--- 测试 2: 基础输入记录与单步 Undo / Redo ---');
stack.recordChange('# Hello World\n\nThis is OmniView.', 15, 15, true);
assert.strictEqual(stack.canUndo, true, '新增内容后应允许 Undo');
assert.strictEqual(stack.canRedo, false, '新增内容后无未来分支，不可 Redo');
assert.strictEqual(stack.length, 2);

// 执行 Undo
const undone = stack.undo();
assert.ok(undone);
assert.strictEqual(undone.value, '# Hello World', '撤回后应回到初始文本');
assert.strictEqual(stack.canUndo, false, '撤回到顶后不可继续 Undo');
assert.strictEqual(stack.canRedo, true, '撤回后应允许 Redo');

// 执行 Redo
const redone = stack.redo();
assert.ok(redone);
assert.strictEqual(redone.value, '# Hello World\n\nThis is OmniView.', '重做后应恢复修改内容');
assert.strictEqual(stack.canUndo, true);
assert.strictEqual(stack.canRedo, false);
console.log('✅ 基础 Undo / Redo 流程通过');

// 测试 3: 连续打字合并机制
console.log('--- 测试 3: 连续快速打字合并策略 ---');
const typingStack = new TextHistoryStack('init', { mergeThresholdMs: 500 });
// 模拟快速敲击单个英文字符
typingStack.recordChange('init1', 5, 5, false);
typingStack.recordChange('init12', 6, 6, false);
typingStack.recordChange('init123', 7, 7, false);
// 此时应该都被合并进当前快照，未频繁膨胀历史栈
assert.strictEqual(typingStack.length, 2, '短时间内小幅度连续输入应合并为原子步骤');
assert.strictEqual(typingStack.currentSnapshot.value, 'init123');

// 一次 Undo 应该直接回到 'init'
const quickUndo = typingStack.undo();
assert.ok(quickUndo);
assert.strictEqual(quickUndo.value, 'init', '撤回时应直接退回打字开始前');
console.log('✅ 快速打字合并测试通过');

// 测试 4: 换行与强制快照断点
console.log('--- 测试 4: 换行与强制快照 (如 Tab 或回车) 断点隔断 ---');
const breakpointStack = new TextHistoryStack('Line 1');
breakpointStack.recordChange('Line 1\nLine 2', 13, 13, false); // 换行
breakpointStack.recordChange('Line 1\n  Line 2', 15, 15, true); // Tab 缩进 (forceNewSnapshot)
assert.strictEqual(breakpointStack.length, 3, '换行与 Tab 应产生独立断点快照');

const afterTabUndo = breakpointStack.undo();
assert.strictEqual(afterTabUndo.value, 'Line 1\nLine 2', '撤回一次应仅撤销 Tab 缩进');
const afterNewlineUndo = breakpointStack.undo();
assert.strictEqual(afterNewlineUndo.value, 'Line 1', '再撤回一次应撤销换行');
console.log('✅ 换行与 Tab 缩进断点测试通过');

// 测试 5: 撤回后编辑导致的分支截断 (Branch Divergence)
console.log('--- 测试 5: 历史分支截断测试 ---');
const branchStack = new TextHistoryStack('A');
branchStack.recordChange('B', 1, 1, true);
branchStack.recordChange('C', 1, 1, true);
assert.strictEqual(branchStack.length, 3);

// 撤回到 A
branchStack.undo(); // B
branchStack.undo(); // A
assert.strictEqual(branchStack.currentSnapshot.value, 'A');

// 在 A 上输入全新内容 D
branchStack.recordChange('D', 1, 1, true);
assert.strictEqual(branchStack.length, 2, '截断未来分支后历史栈长度应为 2');
assert.strictEqual(branchStack.currentSnapshot.value, 'D');
assert.strictEqual(branchStack.canRedo, false, '新分支产生后不可再重做原先旧分支');
console.log('✅ 历史分支截断测试通过');

// 测试 6: 光标位置恢复
console.log('--- 测试 6: 光标位置精确恢复测试 ---');
const cursorStack = new TextHistoryStack('hello world');
cursorStack.recordChange('hello beautiful world', 15, 15, true);
const cUndo = cursorStack.undo();
assert.strictEqual(cUndo.selectionStart, 11);
const cRedo = cursorStack.redo();
assert.strictEqual(cRedo.selectionStart, 15);
assert.strictEqual(cRedo.selectionEnd, 15);
console.log('✅ 光标位置恢复测试通过');

// 测试 7: 最大深度限制
console.log('--- 测试 7: 最大深度栈上限测试 ---');
const depthStack = new TextHistoryStack('0', { maxDepth: 5 });
for (let i = 1; i <= 10; i++) {
  depthStack.recordChange(String(i), 1, 1, true);
}
assert.strictEqual(depthStack.length, 5, '栈深度必须被限制在 maxDepth 内');
assert.strictEqual(depthStack.currentSnapshot.value, '10');
console.log('✅ 最大深度限制测试通过');

// 测试 8: 重置功能
console.log('--- 测试 8: 重置栈状态测试 ---');
depthStack.reset('New Document');
assert.strictEqual(depthStack.length, 1);
assert.strictEqual(depthStack.canUndo, false);
assert.strictEqual(depthStack.canRedo, false);
assert.strictEqual(depthStack.currentSnapshot.value, 'New Document');
console.log('✅ 重置功能测试通过');

console.log('\n🎉 全部 8 组文本编辑器 Undo/Redo 历史栈测试用例 100% 通过！');
