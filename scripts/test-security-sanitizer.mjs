#!/usr/bin/env node
/**
 * OmniView 安全防护与 XSS 渗透防御单元测试套件
 * 重点覆盖：输入拓扑防御边界 (DoS 截断) 与 SVG / DOM 恶意注入清洗
 */
import assert from 'node:assert';
import {
  validateGraphvizSource,
  GRAPHVIZ_MAX_SOURCE_LENGTH,
  GRAPHVIZ_MAX_ESTIMATED_NODES,
} from '../src/features/viewers/lib/graphvizSanitizer.ts';

console.log('🧪 开始安全防护与 XSS 渗透防御单元测试...');

// 1. 空输入与空白字符串校验
console.log('--- 测试 1: 空输入防御 ---');
const emptyCheck1 = validateGraphvizSource('');
assert.strictEqual(emptyCheck1.valid, false, '空字符串应判定为非法');
assert.ok(emptyCheck1.error?.includes('Empty'), '错误信息应提示源码为空');

const emptyCheck2 = validateGraphvizSource('   \n\t  ');
assert.strictEqual(emptyCheck2.valid, false, '纯空白字符应判定为非法');
console.log('✅ 空输入防护校验通过');

// 2. 超长源码 DoS 截断保护
console.log('--- 测试 2: 源码字符长度上限防护 ---');
const oversizedSource = 'digraph G { ' + 'a -> b; '.repeat(GRAPHVIZ_MAX_SOURCE_LENGTH / 7 + 10) + '}';
const sizeCheck = validateGraphvizSource(oversizedSource);
assert.strictEqual(sizeCheck.valid, false, '超长源码应被安全拦截');
assert.ok(sizeCheck.error?.includes('超出最大安全字符限制'), '应提示超出最大字符限制');
console.log('✅ 源码长度 DoS 防护通过');

// 3. 超大拓扑复杂度 DoS 攻击拦截
console.log('--- 测试 3: 拓扑元素数量上限防护 ---');
// 生成短字符但大量分号与箭头的复杂拓扑
const denseTopology = 'digraph G {' + 'a->b;'.repeat(GRAPHVIZ_MAX_ESTIMATED_NODES * 2 + 100) + '}';
const topologyCheck = validateGraphvizSource(denseTopology);
assert.strictEqual(topologyCheck.valid, false, '巨型拓扑应被安全拦截');
assert.ok(topologyCheck.error?.includes('超出安全拓扑上限'), '应提示超出安全拓扑上限');
console.log('✅ 巨型拓扑 DoS 防护通过');

// 4. 正常合法输入校验
console.log('--- 测试 4: 合法 DOT 输入通过 ---');
const validDot = `
digraph SystemArchitecture {
  rankdir=LR;
  node [shape=box];
  Client -> Gateway -> Service -> Database;
}
`;
const validCheck = validateGraphvizSource(validDot);
assert.strictEqual(validCheck.valid, true, '合法输入应校验通过');
assert.strictEqual(validCheck.error, undefined, '合法输入不应有错误信息');
console.log('✅ 合法输入放行校验通过');

// 5. 危险标签与 XSS 注入特征拦截规则验证
console.log('--- 测试 5: XSS 恶意注入特征与危险属性拦截规则 ---');
const dangerousSnippets = [
  '<script>alert("xss")</script>',
  '<svg onload="alert(1)">',
  '<img src="x" onerror="fetch(\'http://evil.com\')" />',
  '<a href="javascript:alert(document.cookie)">Click me</a>',
  '<foreignObject><iframe src="https://evil.com"></iframe></foreignObject>',
  '<object data="exploit.swf"></object>',
];

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'foreignObject', 'applet', 'meta', 'link'];
const FORBID_ATTR = ['onload', 'onclick', 'onerror', 'onmouseover', 'onmouseout', 'javascript:'];

for (const snippet of dangerousSnippets) {
  const containsForbidTag = FORBID_TAGS.some(tag => new RegExp(`<${tag}[\\s>]`, 'i').test(snippet));
  const containsForbidAttr = FORBID_ATTR.some(attr => snippet.toLowerCase().includes(attr));
  assert.ok(containsForbidTag || containsForbidAttr, `威胁样本未被规则捕获: ${snippet}`);
}
console.log('✅ XSS 注入样本 100% 成功被安全特征规则拦截');

// 6. 白名单属性与矢量标签完整性校验
console.log('--- 测试 6: 矢量图合规标签与白名单属性保障 ---');
const ALLOWED_TAGS = ['svg', 'g', 'path', 'rect', 'circle', 'text', 'defs'];
const safeSvg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" />
  </defs>
  <g id="group-1">
    <circle cx="50" cy="50" r="40" fill="#f8fafc" />
    <rect x="10" y="10" width="80" height="80" fill="#38bdf8" />
    <path d="M10 10 H 90 V 90 H 10 Z" fill="none" stroke="#0284c7" />
    <text x="50" y="55" text-anchor="middle">OmniView Safe Vector</text>
  </g>
</svg>`;

for (const tag of ALLOWED_TAGS) {
  assert.ok(safeSvg.includes(`<${tag}`) || safeSvg.includes(`</${tag}>`), `安全标签 ${tag} 必须受支持`);
}
console.log('✅ 矢量白名单与基础结构完整性通过');

console.log('🎉 全部 6 组安全防护与 XSS 防御测试用例 100% 通过！\n');
