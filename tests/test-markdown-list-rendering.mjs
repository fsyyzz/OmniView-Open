import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

console.log('🧪 开始 Markdown 列表渲染（有序列表序号、无序符号、嵌套列表及 CSS/打印保真）专项测试...');

// 1. 测试 marked 列表渲染器增强逻辑
console.log('--- 测试 1: 有序与无序列表渲染标签、类名与 start 属性 ---');

function createTestRenderer() {
  const customRenderer = new marked.Renderer();
  let currentTokenStartLine = 15;

  const origList = customRenderer.list.bind(customRenderer);
  customRenderer.list = function (tokenOrBody, ordered, start) {
    if (typeof tokenOrBody === 'object' && tokenOrBody !== null && 'ordered' in tokenOrBody) {
      const isOrdered = Boolean(tokenOrBody.ordered);
      const startNum = tokenOrBody.start;
      const tag = isOrdered ? 'ol' : 'ul';
      const hasTask = Array.isArray(tokenOrBody.items) && tokenOrBody.items.some((it) => it.task);
      let body = '';
      for (let i = 0; i < tokenOrBody.items.length; i++) {
        body += this.listitem(tokenOrBody.items[i]);
      }
      const startAttr = isOrdered && typeof startNum === 'number' && startNum !== 1 ? ` start="${startNum}"` : '';
      const taskClass = hasTask ? ' ov-task-list' : '';
      const listClass = isOrdered ? `ov-ordered-list${taskClass}` : `ov-unordered-list${taskClass}`;
      return `<${tag} class="${listClass}"${startAttr} data-source-line="${currentTokenStartLine}">\n${body}</${tag}>\n`;
    }
    const isOrdered = typeof ordered === 'boolean' ? ordered : false;
    const tag = isOrdered ? 'ol' : 'ul';
    const startAttr = isOrdered && typeof start === 'number' && start !== 1 ? ` start="${start}"` : '';
    const listClass = isOrdered ? 'ov-ordered-list' : 'ov-unordered-list';
    return `<${tag} class="${listClass}"${startAttr} data-source-line="${currentTokenStartLine}">\n${tokenOrBody}</${tag}>\n`;
  };

  const origListitem = customRenderer.listitem.bind(customRenderer);
  customRenderer.listitem = function (itemOrText, task, checked) {
    if (typeof itemOrText === 'object' && itemOrText !== null) {
      const isTask = itemOrText.task;
      const isChecked = itemOrText.checked;
      const itemLine = itemOrText._startLine || currentTokenStartLine;
      let body = this.parser.parse(itemOrText.tokens || []);
      if (isTask) {
        body = body.replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, '').trim();
        const checkboxHtml = `<input type="checkbox" class="ov-task-checkbox" data-task-line="${itemLine}" ${isChecked ? 'checked' : ''} />`;
        return `<li class="ov-task-list-item ${isChecked ? 'ov-task-done' : ''}" data-task-line="${itemLine}"><label class="ov-task-label">${checkboxHtml}<span class="ov-task-text">${body}</span></label></li>\n`;
      }
      return `<li data-source-line="${itemLine}">${body}</li>\n`;
    }
    return origListitem(itemOrText, task, checked);
  };

  return { customRenderer, setLine: (l) => { currentTokenStartLine = l; } };
}

const { customRenderer } = createTestRenderer();

// 1.1 基础有序列表 (从 1 开始)
const orderedMd = `1. 完成十二条措施自评与团队计划对齐
2. 在 1 个项目上严格落地核心措施
3. 主力代码仓推进 CI 与单测
`;
const orderedHtml = marked.parse(orderedMd, { renderer: customRenderer });
assert.ok(orderedHtml.includes('<ol class="ov-ordered-list"'), '有序列表必须渲染 <ol class="ov-ordered-list"');
assert.ok(orderedHtml.includes('data-source-line="15"'), '列表项必须携带 data-source-line 行号属性');
assert.ok(orderedHtml.includes('完成十二条措施自评与团队计划对齐'), '包含第一个有序列表项文本');
assert.ok(orderedHtml.includes('在 1 个项目上严格落地核心措施'), '包含第二个有序列表项文本');
assert.ok(orderedHtml.includes('主力代码仓推进 CI 与单测'), '包含第三个有序列表项文本');
console.log('✅ 基础有序列表渲染正确');

// 1.2 非 1 起始序号有序列表
const startOffsetMd = `5. 措施八：AI能力上线
6. 措施十二：台账对齐
`;
const startOffsetHtml = marked.parse(startOffsetMd, { renderer: customRenderer });
assert.ok(startOffsetHtml.includes('<ol class="ov-ordered-list" start="5"'), '非 1 开头的有序列表必须输出 start="5" 属性');
console.log('✅ 非 1 开头序号 start 属性渲染正确');

// 1.3 无序列表与嵌套列表
const nestedMd = `1. 目标与原则
   - 总方向统一
   - 补齐短板
2. 落地实施
   1. 第一阶段
   2. 第二阶段
`;
const nestedHtml = marked.parse(nestedMd, { renderer: customRenderer });
assert.ok(nestedHtml.includes('<ol class="ov-ordered-list"'), '外层为有序列表');
assert.ok(nestedHtml.includes('<ul class="ov-unordered-list"'), '嵌套层为无序列表');
assert.ok(nestedHtml.includes('总方向统一'), '嵌套文本正常解析');
console.log('✅ 嵌套有序与无序列表渲染正确');

// 1.4 交互式任务列表
const taskMd = `- [ ] 待办任务项
- [x] 已完成任务项
`;
const taskHtml = marked.parse(taskMd, { renderer: customRenderer });
assert.ok(taskHtml.includes('ov-task-list'), '任务列表包含 ov-task-list 类名');
assert.ok(taskHtml.includes('ov-task-checkbox'), '任务列表包含复选框');
assert.ok(taskHtml.includes('ov-task-done'), '已完成任务项包含 ov-task-done 类名');
console.log('✅ 交互式任务列表类名与结构渲染正确');

// 2. 检查 CSS 样式表 (src/index.css) 列表关键规则
console.log('--- 测试 2: CSS 样式表列表排版与主题设计令牌防护 ---');
const cssContent = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');

assert.ok(
  cssContent.includes('.markdown-content ol') && cssContent.includes('list-style-type: decimal !important'),
  '必须包含 .markdown-content ol 的 list-style-type: decimal !important 规则，防止 Tailwind Preflight 消除序号'
);

assert.ok(
  cssContent.includes('.markdown-content ul') && cssContent.includes('list-style-type: disc !important'),
  '必须包含 .markdown-content ul 的 list-style-type: disc !important 规则'
);

assert.ok(
  cssContent.includes('ol ol') && cssContent.includes('lower-alpha'),
  '必须支持二级嵌套有序列表 lower-alpha 样式'
);

assert.ok(
  cssContent.includes('ol ol ol') && cssContent.includes('lower-roman'),
  '必须支持三级嵌套有序列表 lower-roman 样式'
);

assert.ok(
  cssContent.includes('ul ul') && cssContent.includes('circle'),
  '必须支持二级嵌套无序列表 circle 样式'
);

assert.ok(
  cssContent.includes('ul ul ul') && cssContent.includes('square'),
  '必须支持三级嵌套无序列表 square 样式'
);

assert.ok(
  cssContent.includes('::marker') && cssContent.includes('var(--ov-text-secondary)'),
  '有序列表项 marker 颜色必须使用 --ov-text-secondary 设计令牌'
);

assert.ok(
  cssContent.includes('@media print') && cssContent.includes('list-style-type: decimal !important'),
  '打印样式 (@media print) 必须显式声明 list-style-type: decimal !important 保持序号打印保真'
);

console.log('✅ CSS 样式表列表规则与打印保真全部通过校验');
console.log('🎉 所有 Markdown 列表渲染测试顺利通过！');
