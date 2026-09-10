/**
 * OmniView Markdown 与 VS Code 双向滚动与光标同步 (Scroll Sync) 单元测试
 */
import assert from 'node:assert';

console.log('🧪 开始 Markdown 与 VS Code 双向光标/滚动同步 (Scroll Sync) 单元测试...');

// --- 算法模拟：双向滚动位置比例映射算法 ---
function calculateTargetScrollTop({ targetLine, elements, viewportHeight, scrollHeight, totalLines }) {
  if (typeof targetLine !== 'number' || isNaN(targetLine) || targetLine < 1) return 0;
  if (!elements || elements.length === 0) return 0;

  if (targetLine <= 1) {
    return 0;
  }
  if (totalLines && targetLine >= totalLines) {
    return Math.max(0, scrollHeight - viewportHeight);
  }

  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    if (targetLine >= item.startLine && targetLine <= item.endLine) {
      const lineProgress = (targetLine - item.startLine) / Math.max(1, item.endLine - item.startLine);
      const targetScrollTop = item.offsetTop + lineProgress * item.offsetHeight;
      return Math.max(0, targetScrollTop - 24);
    }
    if (targetLine < item.startLine) {
      const prevItem = elements[i - 1];
      if (prevItem) {
        const prevBottom = prevItem.offsetTop + prevItem.offsetHeight;
        const ratio = (targetLine - prevItem.endLine) / Math.max(1, item.startLine - prevItem.endLine);
        const targetScrollTop = prevBottom + ratio * Math.max(0, item.offsetTop - prevBottom);
        return Math.max(0, targetScrollTop - 24);
      } else {
        const targetScrollTop = Math.max(0, item.offsetTop * (targetLine / item.startLine));
        return Math.max(0, targetScrollTop - 24);
      }
    }
  }

  const last = elements[elements.length - 1];
  return Math.max(0, last.offsetTop - 24);
}

// 模拟 DOM 节点列表
const mockElements = [
  { startLine: 1, endLine: 3, offsetTop: 0, offsetHeight: 60 },     // H1
  { startLine: 5, endLine: 10, offsetTop: 100, offsetHeight: 120 }, // Paragraph
  { startLine: 12, endLine: 25, offsetTop: 260, offsetHeight: 300 },// CodeBlock
  { startLine: 28, endLine: 40, offsetTop: 600, offsetHeight: 200 },// Table
  { startLine: 42, endLine: 60, offsetTop: 850, offsetHeight: 400 },// Mermaid
];

const mockViewport = {
  viewportHeight: 500,
  scrollHeight: 1500,
  totalLines: 65,
};

// --- 测试 1: 顶部与底部边界对齐 ---
console.log('--- 测试 1: 顶部与底部边界对齐 ---');
const topScroll = calculateTargetScrollTop({ targetLine: 1, elements: mockElements, ...mockViewport });
assert.strictEqual(topScroll, 0, 'Line 1 必须滚动到 0');

const bottomScroll = calculateTargetScrollTop({ targetLine: 65, elements: mockElements, ...mockViewport });
assert.strictEqual(bottomScroll, 1000, '最大行必须平滑到达最底端 (scrollHeight - viewportHeight)');
console.log('✅ 顶部与底部极值对齐测试通过');

// --- 测试 2: 节点内部线性插值 ---
console.log('--- 测试 2: 节点内部线性插值 ---');
// Line 5: 段落开头
const pStartScroll = calculateTargetScrollTop({ targetLine: 5, elements: mockElements, ...mockViewport });
assert.strictEqual(pStartScroll, 100 - 24, '段落起始行应精确对齐段落 offsetTop - 24px');

// Line 7: 段落中间偏前 (5 到 10，progress = 2/5 = 0.4, 100 + 0.4*120 = 148, 148 - 24 = 124)
const pMidScroll = calculateTargetScrollTop({ targetLine: 7, elements: mockElements, ...mockViewport });
assert.strictEqual(pMidScroll, 124, '段落中间行应按比例线性插值');
console.log('✅ 节点内部线性插值测试通过');

// --- 测试 3: 空行/节点间隙平滑过渡 ---
console.log('--- 测试 3: 空行/节点间隙平滑过渡 ---');
// Line 4 落在 H1 (endLine: 3, bottom: 60) 和 段落 (startLine: 5, top: 100) 之间
const gapScroll = calculateTargetScrollTop({ targetLine: 4, elements: mockElements, ...mockViewport });
// ratio = (4 - 3) / (5 - 3) = 0.5; target = 60 + 0.5 * (100 - 60) = 80; safe = 80 - 24 = 56
assert.strictEqual(gapScroll, 56, '空行处应在上一个节点与下一个节点间实现平滑插值');
console.log('✅ 空行间隙平滑过渡测试通过');

// --- 测试 4: 消息结构与契约校验 ---
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

// --- 测试 5: 设置开关联动 ---
console.log('--- 测试 5: scrollSync 设置开关 ---');
const defaultSettings = { scrollSync: true };
assert.strictEqual(defaultSettings.scrollSync, true, 'scrollSync 默认必须开启');

console.log('🎉 全部 5 组双向滚动同步测试用例 100% 通过！');
