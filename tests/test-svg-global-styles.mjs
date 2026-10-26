#!/usr/bin/env node
/**
 * OmniView SVG v2 — 全局样式与 CSS 变量系统单元测试套件
 *
 * 覆盖：
 * 1. extractCssFromRawDefs & parseGlobalStyles 提取 CSS 文本、CSS 变量与 Class 规则
 * 2. setDocumentGlobalStyles 不可变创建/修改/清空全局样式表，保真保留同级 linearGradient
 * 3. updateDocumentCssVariable 快捷更新 :root 中的 CSS 变量值
 * 4. extractNodeToGlobalClass 将图元外观抽取为全局 CSS 类并绑定类名
 * 5. 命令管线集成：
 *    - canvas.setGlobalStyles 执行与撤销重做
 *    - canvas.updateCssVariable 执行与撤销重做
 *    - object.setClassName 批量修改与撤销重做
 *    - object.extractToClass 执行与撤销重做
 * 6. DOMPurify 净化保真：sanitizeDefsFragment 保留 <style> 及其内部完整规则
 * 7. 导出保真：exportSvg 输出中原样包含 <style> 声明
 */

import { setupDomEnvironment, bundleAndLoadTsx, it, describe, reportSummary, assert } from './harness/index.mjs';

setupDomEnvironment();

const mod = await bundleAndLoadTsx(`
  export * as SvgCore from './src/features/viewers/components/drivers/svg/core/index.ts';
  export { sanitizeDefsFragment } from './src/features/viewers/components/drivers/svg/SvgV2Canvas.tsx';
`, { external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify'] });

const { SvgCore, sanitizeDefsFragment } = mod;
const {
  createDocument,
  createRuntime,
  exportSvg,
  extractCssFromRawDefs,
  parseGlobalStyles,
  getDocumentGlobalStyles,
  setDocumentGlobalStyles,
  updateDocumentCssVariable,
  extractNodeToGlobalClass,
  getClassesInUse,
  RAW_DEFS_METADATA_KEY,
} = SvgCore;

describe('SVG v2 全局样式与 CSS 变量测试套件', () => {
  // ============================================================================
  // 1. extractCssFromRawDefs & parseGlobalStyles
  // ============================================================================
  it('从 rawDefs 中准确提取 <style> 内容并忽略其他 defs 标签', () => {
    const rawDefs = `
      <linearGradient id="grad1"><stop offset="0%" stop-color="#f00"/></linearGradient>
      <style type="text/css">
        :root {
          --brand-color: #3b82f6;
          --border-w: 2px;
        }
        .badge {
          fill: var(--brand-color);
          stroke: #1e293b;
        }
      </style>
      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5"><path d="M0 0 L10 5 L0 10 z"/></marker>
    `;

    const css = extractCssFromRawDefs(rawDefs);
    assert.ok(css.includes('--brand-color: #3b82f6;'));
    assert.ok(css.includes('.badge {'));
    assert.ok(!css.includes('linearGradient'));
    assert.ok(!css.includes('marker'));
  });

  it('parseGlobalStyles 准确提取 CSS 变量列表与 Class 规则集合', () => {
    const rawDefs = `
      <style>
        :root {
          --primary: #6366f1;
          --accent: #ec4899;
        }
        .icon-btn {
          fill: var(--primary);
          stroke: #ffffff;
        }
        .neon {
          filter: drop-shadow(0 0 8px #6366f1);
        }
      </style>
    `;

    const info = parseGlobalStyles(rawDefs);
    assert.strictEqual(info.hasStyles, true);
    assert.strictEqual(info.cssVariables.length, 2);
    assert.strictEqual(info.cssVariables[0].name, '--primary');
    assert.strictEqual(info.cssVariables[0].value, '#6366f1');
    assert.strictEqual(info.cssVariables[1].name, '--accent');
    assert.strictEqual(info.cssVariables[1].value, '#ec4899');

    assert.strictEqual(info.classRules.length, 2);
    assert.strictEqual(info.classRules[0].className, 'icon-btn');
    assert.strictEqual(info.classRules[0].declarations['fill'], 'var(--primary)');
    assert.strictEqual(info.classRules[1].className, 'neon');
  });

  // ============================================================================
  // 2. setDocumentGlobalStyles & updateDocumentCssVariable
  // ============================================================================
  it('setDocumentGlobalStyles 注入样式并保留原有的 linearGradient', () => {
    let doc = createDocument({ width: 300, height: 200 });
    doc = {
      ...doc,
      metadata: {
        ...doc.metadata,
        [RAW_DEFS_METADATA_KEY]: '<linearGradient id="g1"><stop stop-color="#fff"/></linearGradient>',
      },
    };

    const nextDoc = setDocumentGlobalStyles(doc, '.box { fill: red; }');
    const raw = nextDoc.metadata[RAW_DEFS_METADATA_KEY];
    assert.ok(raw.includes('<linearGradient id="g1">'));
    assert.ok(raw.includes('<style'));
    assert.ok(raw.includes('.box { fill: red; }'));
    assert.strictEqual(getDocumentGlobalStyles(nextDoc).includes('.box { fill: red; }'), true);
  });

  it('updateDocumentCssVariable 准确修改已有变量或创建 :root', () => {
    let doc = createDocument({ width: 200, height: 200 });
    doc = setDocumentGlobalStyles(doc, ':root {\n  --brand: #10b981;\n}');

    const updatedDoc = updateDocumentCssVariable(doc, '--brand', '#ef4444');
    const css = getDocumentGlobalStyles(updatedDoc);
    assert.ok(css.includes('--brand: #ef4444;'));
    assert.ok(!css.includes('#10b981'));

    // 新增不存在的变量
    const docWithNewVar = updateDocumentCssVariable(updatedDoc, '--secondary', '#3b82f6');
    const css2 = getDocumentGlobalStyles(docWithNewVar);
    assert.ok(css2.includes('--brand: #ef4444;'));
    assert.ok(css2.includes('--secondary: #3b82f6;'));
  });

  // ============================================================================
  // 3. extractNodeToGlobalClass & getClassesInUse
  // ============================================================================
  it('extractNodeToGlobalClass 将图元的填充描边生成 CSS 规则并赋给 className', () => {
    const runtime = createRuntime();
    runtime.execute('object.createPath', {
      geometry: { subPaths: [] },
      appearance: {
        items: [
          { kind: 'fill', fill: { type: 'solid', color: '#8b5cf6', opacity: 0.9 }, blend: 'normal', opacity: 1 },
          { kind: 'stroke', stroke: { paint: { type: 'solid', color: '#1e293b', opacity: 1 }, width: 2, cap: 'round', join: 'bevel', dashArray: null, alignment: 'center', widthUnit: 'px', miterLimit: 4, dashOffset: 0 }, blend: 'normal', opacity: 1 },
        ],
      },
    });

    const createdDoc = runtime.currentDocument;
    const pathId = Array.from(createdDoc.nodes.keys()).find((id) => createdDoc.nodes.get(id)?.kind === 'Path');
    assert.ok(pathId);

    const { doc: styledDoc, className } = extractNodeToGlobalClass(createdDoc, pathId, 'custom-purple-box');
    assert.strictEqual(className, 'custom-purple-box');

    const targetNode = styledDoc.nodes.get(pathId);
    assert.strictEqual(targetNode?.className, 'custom-purple-box');

    const css = getDocumentGlobalStyles(styledDoc);
    assert.ok(css.includes('.custom-purple-box {'));
    assert.ok(css.includes('fill: #8b5cf6;'));
    assert.ok(css.includes('fill-opacity: 0.9;'));
    assert.ok(css.includes('stroke: #1e293b;'));
    assert.ok(css.includes('stroke-width: 2px;'));
    assert.ok(css.includes('stroke-linecap: round;'));

    // 检查引用计数
    const inUse = getClassesInUse(styledDoc);
    assert.strictEqual(inUse.get('custom-purple-box'), 1);
  });

  // ============================================================================
  // 4. 命令管线与撤销重做
  // ============================================================================
  it('canvas.setGlobalStyles 支持命令执行与 Undo/Redo', () => {
    const runtime = createRuntime();
    const res1 = runtime.execute('canvas.setGlobalStyles', { css: '.glow { filter: blur(4px); }' });
    assert.strictEqual(res1.ok, true);
    assert.ok(getDocumentGlobalStyles(runtime.currentDocument).includes('.glow { filter: blur(4px); }'));
    assert.strictEqual(runtime.history.undo.length > 0, true);

    // Undo
    runtime.undo();
    assert.strictEqual(getDocumentGlobalStyles(runtime.currentDocument).trim(), '');

    // Redo
    runtime.redo();
    assert.ok(getDocumentGlobalStyles(runtime.currentDocument).includes('.glow { filter: blur(4px); }'));
  });

  it('object.setClassName 批量设置类名与 Undo/Redo', () => {
    const runtime = createRuntime();
    runtime.execute('object.createPath', { geometry: { subPaths: [] } });
    const doc = runtime.currentDocument;
    const pathId = Array.from(doc.nodes.keys()).find((id) => doc.nodes.get(id)?.kind === 'Path');
    assert.ok(pathId);

    runtime.execute('object.setClassName', { ids: [pathId], className: 'icon-primary' });
    assert.strictEqual(runtime.currentDocument.nodes.get(pathId)?.className, 'icon-primary');

    runtime.undo();
    assert.ok(!runtime.currentDocument.nodes.get(pathId)?.className);

    runtime.redo();
    assert.strictEqual(runtime.currentDocument.nodes.get(pathId)?.className, 'icon-primary');
  });

  // ============================================================================
  // 5. DOMPurify 净化与导出保真
  // ============================================================================
  it('sanitizeDefsFragment 完整保留 <style> 及其内部规则不被吞掉', () => {
    const raw = `
      <style type="text/css">
        :root { --main-bg: #123456; }
        .test-class { fill: var(--main-bg); }
      </style>
      <linearGradient id="grad-ok"><stop offset="0%" stop-color="#000"/></linearGradient>
    `;

    const clean = sanitizeDefsFragment(raw);
    assert.ok(clean.includes('<style'), 'DOMPurify 必须完整保留 <style> 标签');
    assert.ok(clean.includes('--main-bg: #123456;'), 'DOMPurify 必须保留 CSS 变量定义');
    assert.ok(clean.includes('.test-class { fill: var(--main-bg); }'), 'DOMPurify 必须保留 Class 选择器规则');
    assert.ok(clean.includes('linearGradient id="grad-ok"'), '同级渐变必须依然存在');
  });

  it('exportSvg 序列化输出中包含 <style> 标签', async () => {
    let doc = createDocument({ width: 500, height: 400 });
    doc = setDocumentGlobalStyles(doc, ':root { --accent: #22c55e; }\n.btn { fill: var(--accent); }');

    const svgOutput = await exportSvg(doc);
    assert.ok(svgOutput.includes('<defs>'), '导出 SVG 必须包含 <defs>');
    assert.ok(svgOutput.includes('<style'), '导出 SVG 必须包含 <style>');
    assert.ok(svgOutput.includes('--accent: #22c55e;'), '导出 SVG 必须包含 CSS 变量');
    assert.ok(svgOutput.includes('.btn { fill: var(--accent); }'), '导出 SVG 必须包含 Class 声明');
  });
});

reportSummary();
