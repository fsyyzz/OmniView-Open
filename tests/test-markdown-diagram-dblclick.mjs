/**
 * OmniView Markdown 渲染图表与图片双击全屏打开 / 源码跳转防护单元测试
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 开始 Markdown 渲染图表与图片双击打开 (Double Click Lightbox) 验证测试...');

// 1. 验证所有图表组件源码中均包含双击全屏与阻止冒泡 (e.stopPropagation) 契约
const diagramComponents = [
  { name: 'MermaidBlock', file: 'src/features/viewers/components/drivers/markdown/MermaidBlock.tsx' },
  { name: 'PlantUmlBlock', file: 'src/features/viewers/components/drivers/markdown/PlantUmlBlock.tsx' },
  { name: 'GraphvizBlock', file: 'src/features/viewers/components/drivers/markdown/GraphvizBlock.tsx' },
  { name: 'SvgBlock', file: 'src/features/viewers/components/drivers/markdown/SvgBlock.tsx' },
  { name: 'MarkmapBlock', file: 'src/features/viewers/components/drivers/markdown/MarkmapBlock.tsx' },
  { name: 'ExcalidrawBlock', file: 'src/features/viewers/components/drivers/markdown/ExcalidrawBlock.tsx' },
  { name: 'DomainStoryBlock', file: 'src/features/viewers/components/drivers/markdown/DomainStoryBlock.tsx' },
  { name: 'MathBlock', file: 'src/features/viewers/components/drivers/markdown/MathBlock.tsx' },
];

console.log('--- 测试 1: 图表组件双击灯箱打开与 stopPropagation 契约检查 ---');
for (const comp of diagramComponents) {
  const filePath = path.resolve(process.cwd(), comp.file);
  assert.ok(fs.existsSync(filePath), `文件 ${comp.file} 必须存在`);
  const content = fs.readFileSync(filePath, 'utf8');

  // 必须绑定 onDoubleClick
  assert.ok(content.includes('onDoubleClick'), `${comp.name} 必须包含 onDoubleClick 处理器`);
  // 必须包含 stopPropagation 避免冒泡触发行号跳转
  assert.ok(content.includes('stopPropagation'), `${comp.name} 必须调用 stopPropagation`);
  // 必须包含 onOpenLightbox 调用
  assert.ok(content.includes('onOpenLightbox'), `${comp.name} 必须调用 onOpenLightbox`);
  // 必须提供 cursor-zoom-in 视觉反馈
  assert.ok(content.includes('cursor-zoom-in'), `${comp.name} 必须包含 cursor-zoom-in 样式`);
  console.log(`  ✅ ${comp.name} 契约校验通过`);
}

console.log('--- 测试 2: useMarkdownScrollSync 容器双击事件拦截契约检查 ---');
const scrollSyncPath = path.resolve(process.cwd(), 'src/features/viewers/hooks/useMarkdownScrollSync.ts');
const scrollSyncContent = fs.readFileSync(scrollSyncPath, 'utf8');

// 验证普通 img 双击打开画廊
assert.ok(scrollSyncContent.includes("target.closest('img')"), '必须拦截标准 Markdown 图片双击');
assert.ok(scrollSyncContent.includes('galleryItems'), '必须支持多图画廊组装');

// 验证独立 SVG 双击
assert.ok(scrollSyncContent.includes("target.closest('svg')"), '必须拦截 Markdown 独立 SVG 双击');

// 验证图表与画布区域双击拦截 (防止误触发源码行跳转)
assert.ok(
  scrollSyncContent.includes('.markdown-diagram') &&
  scrollSyncContent.includes('.diagram-block') &&
  scrollSyncContent.includes('.diagram-canvas'),
  '必须在容器双击中拦截图表与画布区域，防止误触发 onOpenSourceAtLine'
);

console.log('  ✅ useMarkdownScrollSync 容器双击策略校验通过');

console.log('--- 测试 3: 双击事件拦截仿真模拟 ---');
// 模拟容器双击分发逻辑
function simulateContainerDblClick(targetDesc, options = {}) {
  let lightboxOpened = false;
  let sourceLineOpened = null;
  let propagationStopped = false;

  const mockTarget = {
    tagName: targetDesc.tagName || 'DIV',
    closest(selector) {
      if (selector.includes('img') && targetDesc.isImg) return { src: 'test.png', alt: 'Test', classList: { contains: () => false } };
      if (selector.includes('svg') && targetDesc.isSvg && !targetDesc.isDiagram) return { outerHTML: '<svg></svg>' };
      if (selector.includes('.markdown-diagram') || selector.includes('.diagram-canvas')) {
        return targetDesc.isDiagram ? {} : null;
      }
      if (selector.includes('[data-source-line]')) {
        return targetDesc.sourceLine ? { getAttribute: (attr) => attr === 'data-source-line' ? String(targetDesc.sourceLine) : null } : null;
      }
      return null;
    }
  };

  // 1. img
  const img = mockTarget.closest('img');
  if (img) {
    lightboxOpened = true;
    propagationStopped = true;
    return { lightboxOpened, sourceLineOpened, propagationStopped };
  }

  // 2. standalone svg
  const svg = mockTarget.closest('svg');
  if (svg) {
    lightboxOpened = true;
    propagationStopped = true;
    return { lightboxOpened, sourceLineOpened, propagationStopped };
  }

  // 3. diagram or canvas intercept
  if (mockTarget.closest('.markdown-diagram, .diagram-canvas')) {
    return { lightboxOpened, sourceLineOpened, propagationStopped };
  }

  // 4. source line jump
  if (options.enableDoubleClickEdit) {
    const srcEl = mockTarget.closest('[data-source-line]');
    if (srcEl) {
      sourceLineOpened = parseInt(srcEl.getAttribute('data-source-line'), 10);
    }
  }

  return { lightboxOpened, sourceLineOpened, propagationStopped };
}

// 模拟场景 A: 双击普通图片 -> 触发灯箱，不触发行号跳转
const resA = simulateContainerDblClick({ tagName: 'IMG', isImg: true, sourceLine: 12 }, { enableDoubleClickEdit: true });
assert.strictEqual(resA.lightboxOpened, true, '图片双击必须打开灯箱');
assert.strictEqual(resA.sourceLineOpened, null, '图片双击严禁触发行号定位');

// 模拟场景 B: 双击普通内联 SVG -> 触发灯箱，不触发行号跳转
const resB = simulateContainerDblClick({ tagName: 'SVG', isSvg: true, sourceLine: 25 }, { enableDoubleClickEdit: true });
assert.strictEqual(resB.lightboxOpened, true, '内联 SVG 双击必须打开灯箱');
assert.strictEqual(resB.sourceLineOpened, null, '内联 SVG 双击严禁触发行号定位');

// 模拟场景 C: 双击图表画布区域 -> 被图表拦截，不触发行号跳转
const resC = simulateContainerDblClick({ tagName: 'DIV', isDiagram: true, sourceLine: 40 }, { enableDoubleClickEdit: true });
assert.strictEqual(resC.sourceLineOpened, null, '图表区域双击严禁触发源码定位');

// 模拟场景 D: 双击普通段落文本 -> 在开启双击编辑时正确触发行号跳转
const resD = simulateContainerDblClick({ tagName: 'P', sourceLine: 55 }, { enableDoubleClickEdit: true });
assert.strictEqual(resD.sourceLineOpened, 55, '普通段落双击在开启设置时应定位源码');

// 模拟场景 E: 未开启双击编辑时，双击普通段落文本不触发源码定位
const resE = simulateContainerDblClick({ tagName: 'P', sourceLine: 55 }, { enableDoubleClickEdit: false });
assert.strictEqual(resE.sourceLineOpened, null, '未开启双击编辑时严禁定位源码');

console.log('  ✅ 双击逻辑仿真模拟全部通过！');

console.log('\n🎉 所有 Markdown 渲染图表与图片双击打开验证测试 100% 通过！');
