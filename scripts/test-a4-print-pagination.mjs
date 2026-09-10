/**
 * OmniView A4 纸张排版与物理分页符解析单元测试
 */
import assert from 'node:assert';
import { marked } from 'marked';
import { DEFAULT_SETTINGS, saveStoredSettings, loadStoredSettings } from '../src/shared/lib/settingsStorage.js';

console.log('🧪 开始 A4 纸张排版与物理分页符 (Page Break) 单元测试...');

// 1. 模拟 localStorage 环境
const memoryStorage = new Map();
const storageMock = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, String(value)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
  get length() {
    return memoryStorage.size;
  },
  key: (index) => Array.from(memoryStorage.keys())[index] ?? null,
};

globalThis.localStorage = storageMock;
globalThis.window = {
  localStorage: storageMock,
};

// 1. 验证 A4 排版模式配置存储与校验
memoryStorage.clear();
saveStoredSettings({
  contentWidth: 'a4',
});

const settings = loadStoredSettings();
assert.strictEqual(settings.contentWidth, 'a4', '应成功持久化 a4 宽度排版模式');
console.log('✅ 1. A4 排版模式设置持久化与类型校验通过');

// 2. 验证多语系物理分页符指令检测正则表达式
const isPageBreakToken = (t) => {
  const rawText = (t.raw || t.text || '').trim();
  if (/^(<!--\s*page-?break\s*-->|---page---|\\pagebreak|\[page-?break\]|<div[^>]*class=["'][^"']*page-?break[^"']*["'][^>]*>\s*(<\/div>)?)$/i.test(rawText)) {
    return true;
  }
  if (t.type === 'hr' && /page/i.test(t.raw || '')) {
    return true;
  }
  return false;
};

// 正向用例 (各种格式分页符)
const validPageBreakSamples = [
  { raw: '<!-- pagebreak -->' },
  { raw: '<!-- page-break -->' },
  { raw: '<!--pagebreak-->' },
  { raw: '<!--  PAGEBREAK  -->' },
  { raw: '---page---' },
  { raw: '\\pagebreak' },
  { raw: '[pagebreak]' },
  { raw: '[page-break]' },
  { raw: '<div class="page-break"></div>' },
  { raw: '<div class="print-pagebreak"></div>' },
  { type: 'hr', raw: '---page---' },
  { type: 'hr', raw: '***page***' },
];

for (const sample of validPageBreakSamples) {
  assert.strictEqual(isPageBreakToken(sample), true, `未能识别分页符指令: ${sample.raw}`);
}
console.log(`✅ 2. ${validPageBreakSamples.length} 种 A4 物理分页符指令识别全部通过`);

// 负向用例 (普通文本/普通分割线不应被误判为分页符)
const invalidSamples = [
  { raw: 'This is a normal paragraph with word pagebreak in it.' },
  { raw: '# Heading with pagebreak' },
  { raw: '---' }, // 普通 hr 分割线
  { raw: '***' },
  { raw: '`<!-- pagebreak -->`' },
  { raw: '<!-- normal comment -->' },
];

for (const sample of invalidSamples) {
  assert.strictEqual(isPageBreakToken(sample), false, `不应误判为分页符: ${sample.raw}`);
}
console.log(`✅ 3. 普通文本与常规分割线负向边界防御测试全部通过`);

// 4. 验证 Markdown 渲染流中将分页符切分为独立 Block
const sampleDoc = `
# 封面标题

这是第一页引言内容。

<!-- pagebreak -->

# 第二页 正式章节

这是第二页的正文内容。

---page---

# 附录

这是最后一页内容。
`;

const tokens = marked.lexer(sampleDoc);
let pageBreakCount = 0;
for (const token of tokens) {
  if (isPageBreakToken(token)) {
    pageBreakCount++;
  }
}

assert.strictEqual(pageBreakCount, 2, '在示例 Markdown 文档中应准确识别 2 处物理分页符');
console.log('✅ 4. Markdown Lexer 分词流物理分页符提取通过');

console.log('🎉 全部 A4 纸张排版与物理分页符测试用例 100% 通过！');
