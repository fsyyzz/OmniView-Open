#!/usr/bin/env node
/**
 * OmniView Mermaid 与图表矢量安全清洗单元测试套件
 * 重点验证：Mermaid Flowchart foreignObject 文本标签在各主题与全屏放大模式下 100% 完整保留且杜绝 XSS 风险
 */
import assert from 'node:assert';
import {
  DOMPURIFY_DIAGRAM_SVG_CONFIG,
  sanitizeDiagramSvg,
  sanitizeDiagramHtml,
} from '../src/features/viewers/lib/diagramSanitizer.ts';

console.log('🧪 开始 Mermaid 与图表 SVG 安全清洗单元测试...');

// 1. Mermaid Flowchart foreignObject 完整性保留
console.log('--- 测试 1: Mermaid 流程图 foreignObject 文本标签完整性 ---');
const mermaidFlowchartSvg = `
<svg id="mermaid-flowchart-1" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    #mermaid-flowchart-1 .nodeLabel { color: #f8fafc; font-size: 13px; }
    #mermaid-flowchart-1 foreignObject { overflow: visible; }
  </style>
  <g class="nodes">
    <g class="node default" id="flowchart-A-123" transform="translate(100,50)">
      <rect class="basic label-container" width="120" height="40" rx="6" fill="#111827" stroke="#38bdf8"></rect>
      <g class="label">
        <foreignObject width="120" height="40">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; text-align: center;">
            <span class="nodeLabel">用户发起请求 (User Request)</span>
          </div>
        </foreignObject>
      </g>
    </g>
    <g class="node default" id="flowchart-B-456" transform="translate(100,150)">
      <polygon class="label-container" points="0,20 60,0 120,20 60,40" fill="#111827" stroke="#38bdf8"></polygon>
      <g class="label">
        <foreignObject width="120" height="40">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; text-align: center;">
            <span class="nodeLabel">是否合法鉴权?</span>
          </div>
        </foreignObject>
      </g>
    </g>
  </g>
  <g class="edgeLabels">
    <g class="edgeLabel">
      <g class="label">
        <foreignObject width="40" height="20">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <span class="edgeLabel">是 (Yes)</span>
          </div>
        </foreignObject>
      </g>
    </g>
  </g>
</svg>
`;

const cleanedSvg = sanitizeDiagramSvg(mermaidFlowchartSvg);

// 验证关键标签与内容未被误杀
assert.ok(cleanedSvg.includes('foreignObject') || cleanedSvg.includes('foreignobject'), 'foreignObject 标签必须被完整保留');
assert.ok(cleanedSvg.includes('用户发起请求 (User Request)'), '流程图节点 A 文字内容必须完整保留');
assert.ok(cleanedSvg.includes('是否合法鉴权?'), '流程图判断节点 B 文字内容必须完整保留');
assert.ok(cleanedSvg.includes('是 (Yes)'), '流程图连线条件文字必须完整保留');
assert.ok(cleanedSvg.includes('nodeLabel'), 'Mermaid CSS 样式类名必须被保留');
assert.ok(cleanedSvg.includes('viewBox="0 0 400 300"'), 'SVG 视口与布局坐标必须完整保留');
console.log('✅ Mermaid Flowchart foreignObject 文本标签保留测试通过');

// 2. 恶意 XSS 渗透清洗测试
console.log('--- 测试 2: 危险脚本与内联事件 XSS 渗透防御 ---');
const maliciousSvg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" onload="alert('pwned')">
  <script>window.evil = true;</script>
  <g onclick="stealCookies()">
    <rect width="50" height="50" fill="red" />
    <foreignObject width="50" height="50">
      <iframe src="https://evil.attacker.com"></iframe>
      <img src="invalid" onerror="alert(1)" />
      <span class="nodeLabel">正常文字</span>
    </foreignObject>
  </g>
</svg>
`;

const sanitizedMalicious = sanitizeDiagramSvg(maliciousSvg);

assert.ok(!sanitizedMalicious.includes('<script'), '必须彻底剔除 script 标签');
assert.ok(!sanitizedMalicious.includes('onload'), '必须彻底剔除 onload 属性');
assert.ok(!sanitizedMalicious.includes('onclick'), '必须彻底剔除 onclick 属性');
assert.ok(!sanitizedMalicious.includes('<iframe'), '必须彻底剔除 iframe 标签');
assert.ok(!sanitizedMalicious.includes('onerror'), '必须彻底剔除 onerror 属性');
assert.ok(sanitizedMalicious.includes('正常文字'), '在防御恶意攻击的同时安全文字必须保留');
console.log('✅ XSS 注入样本 100% 成功阻断与清洗');

// 3. 图表 HTML 片段清洗测试
console.log('--- 测试 3: 图表 HTML / KaTeX 片段清洗 ---');
const htmlSample = `
<div class="katex-display">
  <span class="katex"><span class="katex-html"><span class="base"><span class="mord mathnormal">E</span><span class="mspace"></span><span class="mrel">=</span><span class="mspace"></span><span class="mord mathnormal">m</span><span class="mord"><span class="mord mathnormal">c</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist"><span style="top:-3.63em"><span class="pstrut" style="height:2.7em"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span></span></span></span></span></span></span></span>
</div>
`;
const cleanedHtml = sanitizeDiagramHtml(htmlSample);
assert.ok(cleanedHtml.includes('katex-html'), 'KaTeX HTML 结构必须完整保留');
assert.ok(cleanedHtml.includes('E'), '公式符号必须完整保留');
console.log('✅ HTML 片段清洗测试通过');

// 4. 空与异常输入容错
console.log('--- 测试 4: 空与异常输入容错 ---');
assert.strictEqual(sanitizeDiagramSvg(''), '', '空字符串输入应返回空');
assert.strictEqual(sanitizeDiagramSvg('   '), '', '纯空格输入应返回空');
assert.strictEqual(sanitizeDiagramSvg(null), '', 'null 输入应安全返回空');
console.log('✅ 空与异常输入容错测试通过');

console.log('🎉 全部 4 组 Mermaid 与图表 SVG 安全清洗测试 100% 通过！\n');
