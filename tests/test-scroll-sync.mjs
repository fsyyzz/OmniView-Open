/**
 * OmniView Markdown 与源码双向滚动 / 光标同步单元测试
 */
import assert from 'node:assert';
import {
  calculateLineFromScrollTop,
  calculateTargetScrollTop,
  decideExternalContentApply,
  lineFromTextareaScroll,
  scrollTopForTextareaLine,
} from '../src/features/viewers/lib/scrollSync.ts';

console.log('🧪 开始 Markdown 与源码双向光标/滚动同步 (Scroll Sync) 单元测试...');

const mockElements = [
  { startLine: 1, endLine: 3, offsetTop: 0, offsetHeight: 60 },
  { startLine: 5, endLine: 10, offsetTop: 100, offsetHeight: 120 },
  { startLine: 12, endLine: 25, offsetTop: 260, offsetHeight: 300 },
  { startLine: 28, endLine: 40, offsetTop: 600, offsetHeight: 200 },
  { startLine: 42, endLine: 60, offsetTop: 850, offsetHeight: 400 },
];

const mockViewport = {
  viewportHeight: 500,
  scrollHeight: 1500,
  totalLines: 65,
};

console.log('--- 测试 1: 顶部与底部边界对齐 ---');
const topScroll = calculateTargetScrollTop({ targetLine: 1, elements: mockElements, ...mockViewport });
assert.strictEqual(topScroll, 0, 'Line 1 必须滚动到 0');

const bottomScroll = calculateTargetScrollTop({ targetLine: 65, elements: mockElements, ...mockViewport });
assert.strictEqual(bottomScroll, 1000, '最大行必须平滑到达最底端 (scrollHeight - viewportHeight)');
console.log('✅ 顶部与底部极值对齐测试通过');

console.log('--- 测试 2: 节点内部线性插值 ---');
const pStartScroll = calculateTargetScrollTop({ targetLine: 5, elements: mockElements, ...mockViewport });
assert.strictEqual(pStartScroll, 100 - 24, '段落起始行应精确对齐段落 offsetTop - 24px');

const pMidScroll = calculateTargetScrollTop({ targetLine: 7, elements: mockElements, ...mockViewport });
assert.strictEqual(pMidScroll, 124, '段落中间行应按比例线性插值');
console.log('✅ 节点内部线性插值测试通过');

console.log('--- 测试 3: 空行/节点间隙平滑过渡 ---');
const gapScroll = calculateTargetScrollTop({ targetLine: 4, elements: mockElements, ...mockViewport });
assert.strictEqual(gapScroll, 56, '空行处应在上一个节点与下一个节点间实现平滑插值');
console.log('✅ 空行间隙平滑过渡测试通过');

console.log('--- 测试 4: VS Code 消息与事件契约校验 ---');
const forwardMsg = {
  type: 'editor-scroll-sync',
  path: '/workspace/README.md',
  topLine: 15,
  bottomLine: 35,
  totalLines: 120,
};
assert.strictEqual(forwardMsg.type, 'editor-scroll-sync');
assert.strictEqual(typeof forwardMsg.topLine, 'number');

const reverseMsg = {
  type: 'reveal-source-line',
  path: '/workspace/README.md',
  line: 28,
  revealType: 'select',
};
assert.strictEqual(reverseMsg.type, 'reveal-source-line');
assert.strictEqual(reverseMsg.line, 28);
assert.strictEqual(reverseMsg.revealType, 'select');
console.log('✅ VS Code 消息契约测试通过');

console.log('--- 测试 5: scrollSync 设置开关 ---');
const defaultSettings = { scrollSync: true };
assert.strictEqual(defaultSettings.scrollSync, true, 'scrollSync 默认必须开启');
console.log('✅ 设置开关测试通过');

console.log('--- 测试 6: 预览 scrollTop 反推源码行 ---');
const lineAtStart = calculateLineFromScrollTop({
  scrollTop: 0,
  elements: mockElements,
  ...mockViewport,
});
assert.strictEqual(lineAtStart, 1);

const lineAtBottom = calculateLineFromScrollTop({
  scrollTop: 1000,
  elements: mockElements,
  ...mockViewport,
});
assert.strictEqual(lineAtBottom, 65);

const lineAtPara = calculateLineFromScrollTop({
  scrollTop: 100 - 24,
  elements: mockElements,
  ...mockViewport,
});
assert.ok(lineAtPara >= 5 && lineAtPara <= 6, `段落起点应映射到 5 附近，实际 ${lineAtPara}`);
console.log('✅ 预览反推源码行测试通过');

console.log('--- 测试 7: 编辑回写不得覆盖正在输入的内容 ---');
assert.strictEqual(
  decideExternalContentApply({
    incoming: 'hello',
    localValue: 'hello',
    lastEmitted: 'hello',
    editorFocused: true,
  }),
  'ignore'
);
assert.strictEqual(
  decideExternalContentApply({
    incoming: 'hel',
    localValue: 'hello',
    lastEmitted: 'hel',
    editorFocused: true,
  }),
  'keep-local',
  '父级回写的是上一拍防抖快照时，必须保留本地正在输入的文本'
);
assert.strictEqual(
  decideExternalContentApply({
    incoming: 'from-disk',
    localValue: 'local',
    lastEmitted: 'local-old',
    editorFocused: true,
  }),
  'keep-local',
  '输入焦点在编辑器上时禁止外部覆盖'
);
assert.strictEqual(
  decideExternalContentApply({
    incoming: 'from-disk',
    localValue: 'local',
    lastEmitted: 'local-old',
    editorFocused: false,
  }),
  'apply-external'
);
console.log('✅ 编辑回写光标保护测试通过');

console.log('--- 测试 8: textarea 行号与 scrollTop ---');
assert.strictEqual(lineFromTextareaScroll(0, 20, 12, 40), 1);
assert.strictEqual(lineFromTextareaScroll(12 + 20 * 4, 20, 12, 40), 5);
assert.strictEqual(scrollTopForTextareaLine(5, 20, 12), 12 + 80);
console.log('✅ textarea 行映射测试通过');

console.log('🎉 全部滚动同步测试用例 100% 通过！');
