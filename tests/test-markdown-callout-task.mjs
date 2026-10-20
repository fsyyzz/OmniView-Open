import assert from 'node:assert';
import katex from 'katex';

console.log('🧪 开始 Markdown Callout 语义块、Task List 回写与 KaTeX 解析单元测试...');

// 1. GitHub 风格 Callout 语义块解析算法测试
console.log('--- 测试 1: Callout 正则与元数据提取 ---');

const CALLOUT_MAP = {
  NOTE: { title: 'Note', icon: 'info', theme: 'blue' },
  TIP: { title: 'Tip', icon: 'lightbulb', theme: 'emerald' },
  IMPORTANT: { title: 'Important', icon: 'alert-circle', theme: 'purple' },
  WARNING: { title: 'Warning', icon: 'alert-triangle', theme: 'amber' },
  CAUTION: { title: 'Caution', icon: 'alert-octagon', theme: 'rose' },
};

function parseCalloutBlock(blockquoteContent) {
  const match = blockquoteContent.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)(?:[^\S\n]+([^\]\n]+))?\](?:[^\S\n]+([^\n]+))?(?:\n([\s\S]*))?$/i);
  if (!match) return null;
  const type = match[1].toUpperCase();
  const customTitle = (match[2] || match[3])?.trim();
  const body = match[4] || '';
  const def = CALLOUT_MAP[type];
  return {
    type,
    title: customTitle || def.title,
    icon: def.icon,
    theme: def.theme,
    body: body.trim(),
  };
}

// 1.1 基础 Callout 提取
const noteInput = '[!NOTE]\n这是一条重要备忘录信息';
const noteRes = parseCalloutBlock(noteInput);
assert.ok(noteRes, '应当成功解析 [!NOTE]');
assert.strictEqual(noteRes.type, 'NOTE');
assert.strictEqual(noteRes.title, 'Note');
assert.strictEqual(noteRes.theme, 'blue');
assert.strictEqual(noteRes.body, '这是一条重要备忘录信息');

// 1.2 自定义标题 Callout 提取
const tipInput = '[!TIP 💡 高性能小贴士]\n使用虚拟滚动可提升巨型文档 10x 性能';
const tipRes = parseCalloutBlock(tipInput);
assert.ok(tipRes, '应当成功解析自定义标题 Tip');
assert.strictEqual(tipRes.type, 'TIP');
assert.strictEqual(tipRes.title, '💡 高性能小贴士');
assert.strictEqual(tipRes.theme, 'emerald');

// 1.3 负向测试：常规引用块不能被误判为 Callout
const regularQuote = '> 这是一个普通的引用段落，没有任何标注';
assert.strictEqual(parseCalloutBlock(regularQuote), null, '普通引用块绝对不能被判定为 Callout');

console.log('✅ Callout 正则与元数据提取测试全部通过');

// 2. Task List 双向行号定位与勾选状态回写算法测试
console.log('--- 测试 2: Task List 双向勾选回写算法 ---');

function toggleMarkdownTaskLine(rawContent, targetLine, nextChecked) {
  const lines = rawContent.split('\n');
  if (targetLine < 1 || targetLine > lines.length) return rawContent;

  const originalLine = lines[targetLine - 1];
  const targetChar = nextChecked ? 'x' : ' ';
  // 匹配行首的 `- [ ]` 或 `- [x]` 或 `* [ ]` 或 `1. [ ]`
  const updatedLine = originalLine.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)[ xX](\])/, `$1${targetChar}$2`);
  lines[targetLine - 1] = updatedLine;
  return lines.join('\n');
}

const sampleDoc = [
  '# 任务清单',
  '- [ ] 编写 i18n 单元测试',
  '- [x] 修复 KaTeX 价格误触问题',
  '1. [ ] 完成 AI-SE 质量闭环评估',
  '普通段落文本',
].join('\n');

// 2.1 勾选第 2 行（未勾选 -> 勾选）
const updated1 = toggleMarkdownTaskLine(sampleDoc, 2, true);
assert.ok(updated1.includes('- [x] 编写 i18n 单元测试'), '第 2 行应被成功勾选为 [x]');

// 2.2 取消勾选第 3 行（已勾选 -> 未勾选）
const updated2 = toggleMarkdownTaskLine(sampleDoc, 3, false);
assert.ok(updated2.includes('- [ ] 修复 KaTeX 价格误触问题'), '第 3 行应被成功取消勾选为 [ ]');

// 2.3 勾选有序任务项
const updated3 = toggleMarkdownTaskLine(sampleDoc, 4, true);
assert.ok(updated3.includes('1. [x] 完成 AI-SE 质量闭环评估'), '有序列表第 4 行应被成功勾选为 [x]');

// 2.4 越界保护
const safeDoc = toggleMarkdownTaskLine(sampleDoc, 999, true);
assert.strictEqual(safeDoc, sampleDoc, '行号越界时不应破坏原文档');

console.log('✅ Task List 行号定位与双向回写测试全部通过');

// 3. KaTeX 公式识别与金额防误触算法测试
console.log('--- 测试 3: KaTeX 智能识别与价格防误触算法 ---');

function renderKatexInHtml(rawHtml) {
  // 1. 块级公式 $$ ... $$
  let res = rawHtml.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
    try {
      return `<div class="ov-katex-block">${katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false, errorColor: '#f43f5e' })}</div>`;
    } catch {
      return _match;
    }
  });
  // 2. 行内公式 $ ... $（严格匹配两端非空白字符，避开价格与普通货币符号）
  res = res.replace(/(?<!\\)\$([^\s\$](?:[^\$\n]*?[^\s\$])?)(?<!\\)\$/g, (_match, formula) => {
    if (/^\d+(\.\d+)?$/.test(formula.trim())) return _match;
    try {
      return `<span class="ov-katex-inline">${katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false, errorColor: '#f43f5e' })}</span>`;
    } catch {
      return _match;
    }
  });
  return res;
}

// 3.1 真实公式识别
const mathInput = '爱因斯坦方程 $E=mc^2$ 与质能守恒';
const mathOutput = renderKatexInHtml(mathInput);
assert.ok(mathOutput.includes('ov-katex-inline'), '应成功渲染行内 KaTeX 公式');
assert.ok(mathOutput.includes('katex'), '应包含 katex DOM 结构');

// 3.2 价格符号防误触 (例如 $100 或 $29.99)
const priceInput = '本月预算 $100 元，打折后 $29.99 元';
const priceOutput = renderKatexInHtml(priceInput);
assert.strictEqual(priceOutput, priceInput, '价格数字绝对不能被误转化为公式');

// 3.3 块级公式识别
const blockMathInput = '求和公式：\n$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$';
const blockMathOutput = renderKatexInHtml(blockMathInput);
assert.ok(blockMathOutput.includes('ov-katex-block'), '应成功渲染块级 KaTeX 公式');

console.log('✅ KaTeX 智能识别与价格防误触测试全部通过');

// 4. GitHub Alert Callout 思想 CARD & CARDS 多列卡片解析测试
console.log('--- 测试 4: GitHub Alert Callout 思想 CARD & CARDS 多列卡片解析测试 ---');

const cardRegex = /^\[!([a-zA-Z0-9_\-]+)(?::[ \t]*([1-6]|right|left))?(?:[ \t]+cols=([1-6])|[ \t]+([^\]\n]+))?\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n([\s\S]*))?$/i;

function parseCardOrCallout(input) {
  const match = input.match(cardRegex);
  if (!match) return null;
  const typeRaw = match[1];
  const colParam = match[2] || match[3];
  const fold = match[5];
  const customTitle = (match[6] || match[4] || '').trim();
  const remainingText = (match[7] || '');
  const upperType = typeRaw.toUpperCase();
  const isCards = upperType === 'CARDS' || upperType === 'CARD-GRID' || upperType === 'GRID';
  const isCard = upperType === 'CARD';
  const cols = colParam && /^[1-6]$/.test(colParam) ? Math.min(6, Math.max(1, parseInt(colParam, 10))) : 3;

  return {
    type: upperType,
    colParam,
    isCards,
    isCard,
    cols,
    fold,
    isCollapsible: fold === '+' || fold === '-',
    isOpen: fold !== '-',
    title: customTitle,
    remainingText,
  };
}

// 4.1 3列卡片测试 [!CARDS:3]
const cards3 = parseCardOrCallout('[!CARDS:3] 核心特性\n- 特性1\n- 特性2\n- 特性3');
assert.ok(cards3, '应成功解析 [!CARDS:3]');
assert.strictEqual(cards3.isCards, true);
assert.strictEqual(cards3.cols, 3);
assert.strictEqual(cards3.title, '核心特性');

// 4.2 4列卡片测试 [!CARDS:4]
const cards4 = parseCardOrCallout('[!CARDS:4] 四阶段流水线');
assert.ok(cards4, '应成功解析 [!CARDS:4]');
assert.strictEqual(cards4.cols, 4);
assert.strictEqual(cards4.title, '四阶段流水线');

// 4.3 6列卡片测试 [!CARDS:6]
const cards6 = parseCardOrCallout('[!CARDS:6]');
assert.ok(cards6, '应成功解析 [!CARDS:6]');
assert.strictEqual(cards6.cols, 6);

// 4.4 别名与属性语法 [!CARD-GRID:3] 与 [!CARDS cols=4]
const gridAlias = parseCardOrCallout('[!CARD-GRID:3]');
assert.ok(gridAlias && gridAlias.isCards && gridAlias.cols === 3, '应兼容 [!CARD-GRID:3] 别名');
const colsAttr = parseCardOrCallout('[!CARDS cols=4]');
assert.ok(colsAttr && colsAttr.isCards && colsAttr.cols === 4, '应兼容 cols=4 属性语法');

// 4.5 单体独立卡片 [!CARD]
const singleCard = parseCardOrCallout('[!CARD] 重点备忘\n这里是正文');
assert.ok(singleCard, '应成功解析 [!CARD]');
assert.strictEqual(singleCard.isCard, true);
assert.strictEqual(singleCard.title, '重点备忘');

// 4.6 折叠卡片 [!CARDS:3]-
const foldedCards = parseCardOrCallout('[!CARDS:3]- 折叠矩阵');
assert.ok(foldedCards && foldedCards.isCollapsible && !foldedCards.isOpen, '应支持 [!CARDS:3]- 默认折叠');

console.log('✅ CARD & CARDS 多列卡片解析测试全部通过');

// 5. GitHub Alert Callout 思想扩展组件测试 (Tabs, Steps, Timeline, Compare, Metrics, FAQ, Quotes, Banner, Gallery, Figure, Media)
console.log('--- 测试 5: GitHub Alert Callout 扩展组件与图片容器解析测试 ---');

const EXTENDED_TYPES = ['TABS', 'STEPS', 'TIMELINE', 'COMPARE', 'METRICS', 'FAQ', 'QUOTES', 'BANNER', 'GALLERY', 'FIGURE', 'MEDIA'];

for (const extType of EXTENDED_TYPES) {
  const parsed = parseCardOrCallout(`[!${extType}] 测试${extType}标题\n- 第一项\n- 第二项`);
  assert.ok(parsed, `应当成功识别 [!${extType}]`);
  assert.strictEqual(parsed.type, extType, `解析类型应为 ${extType}`);
  assert.strictEqual(parsed.title, `测试${extType}标题`, `解析标题应匹配`);
}

// 5.1 别名与图片扩展容器语法识别
const tabAlias = parseCardOrCallout('[!TAB] 别名测试');
assert.ok(tabAlias && tabAlias.type === 'TAB');
const stepAlias = parseCardOrCallout('[!STEP] 单步测试');
assert.ok(stepAlias && stepAlias.type === 'STEP');
const diffAlias = parseCardOrCallout('[!DIFF] 对比测试');
assert.ok(diffAlias && diffAlias.type === 'DIFF');
const kpiAlias = parseCardOrCallout('[!KPI] 核心指标');
assert.ok(kpiAlias && kpiAlias.type === 'KPI');
const heroAlias = parseCardOrCallout('[!HERO] 首屏横幅');
assert.ok(heroAlias && heroAlias.type === 'HERO');
const galleryCols = parseCardOrCallout('[!GALLERY:4] 四列图集');
assert.ok(galleryCols && galleryCols.type === 'GALLERY' && galleryCols.cols === 4, '应支持 [!GALLERY:4] 多列画廊');
const figInline = parseCardOrCallout('[!FIGURE 图 1-1：内联标题语法]');
assert.ok(figInline && figInline.type === 'FIGURE' && figInline.title === '图 1-1：内联标题语法', '应支持 [!FIGURE 图号] 括号内联标题语法');
const mediaRight = parseCardOrCallout('[!MEDIA:RIGHT] 左文右图分栏');
assert.ok(mediaRight && mediaRight.type === 'MEDIA' && mediaRight.colParam === 'RIGHT', '应支持 [!MEDIA:RIGHT] 方向参数');

console.log('✅ GitHub Alert Callout 扩展组件与图片容器测试全部通过');

// 6. 可折叠 Callout [!TIP]- 与手风琴折叠图标定位与样式一致性校验
console.log('--- 测试 6: Callout 与手风琴折叠图标定位与样式一致性校验 ---');
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.cwd(), 'src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

// 6.1 验证 .ov-callout-fold-icon 包含精确的 transform-origin 与 transform-box，防止旋转时发生中心偏移与位置跳跃
assert.ok(
  cssContent.includes('.ov-callout-fold-icon') &&
    cssContent.includes('transform-origin: 50% 50%') &&
    cssContent.includes('transform-box: fill-box'),
  '.ov-callout-fold-icon 必须具备 transform-origin: 50% 50% 与 transform-box: fill-box，确保旋转中心无偏移'
);

// 6.2 验证 .ov-faq-chevron 同样具备 transform-origin 约束
assert.ok(
  cssContent.includes('.ov-faq-chevron') &&
    cssContent.includes('transform-origin: 50% 50%'),
  '.ov-faq-chevron 必须具备居中 transform-origin'
);

// 6.3 验证所有折叠 summary 容器均强制声明 display: flex !important 与 ::marker 清除
assert.ok(
  cssContent.includes('summary.ov-callout-title::marker') &&
    cssContent.includes('display: none !important'),
  '必须彻底清除 summary 原生 ::marker 伪元素标记'
);

// 6.4 验证通用 markdown SVG 规则排除了 ov- 类图标，防止对折叠箭头注入 margin: 18px auto
assert.ok(
  cssContent.includes('svg:not([class*="ov-"])'),
  '必须在正文 SVG 通用样式中排除 [class*="ov-"] 类名，防止折叠箭头被注入异常 margin 与高度'
);

// 6.5 验证 summary 容器具备 100% 宽度与 fold-icon 强制靠右对齐 (margin-left: auto)
assert.ok(
  cssContent.includes('width: 100% !important') &&
    cssContent.includes('margin-left: auto !important'),
  '必须确保 summary 撑满 100% 容器宽度且折叠箭头 margin-left: auto 靠右对齐，防止箭头随文字长短随意摆放'
);

console.log('✅ Callout 与手风琴折叠图标定位一致性校验全部通过');


console.log('🎉 全部 6 组 Markdown Callout / TaskList / KaTeX / CardGrid / ExtendedCallouts / FoldIcon 单元测试用例 100% 通过！');
