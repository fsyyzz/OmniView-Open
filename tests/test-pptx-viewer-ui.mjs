#!/usr/bin/env node
/**
 * OmniView PptxViewer 组件级 Headless DOM 交互与渲染验证套件
 * 基于 happy-dom 真实无头环境与 React 19：
 * 1. PptxViewer 挂载并渲染真实 1:1 比例舞台与缩略图列表
 * 2. 缩略图点击切换幻灯片、平铺总览 (Grid) 打开与快速跳转
 * 3. 演讲者备注抽屉展开与兜底文本验证
 * 4. Ctrl+F 全文搜索过滤与 <mark> 高亮渲染
 * 5. 损坏字节流自愈降级提示横幅渲染与关闭
 */
import { setupDomEnvironment, bundleAndLoadTsx, it, assert } from './harness/index.mjs';

setupDomEnvironment();

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { PptxViewer, generateSamplePptxBytes } = await bundleAndLoadTsx(`
  export { PptxViewer } from './src/features/viewers/components/drivers/PptxViewer.tsx';
  export { generateSamplePptxBytes } from './src/features/viewers/lib/pptxEngine.ts';
`, {
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify', 'jszip', 'echarts'],
});

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function flushUi(ms = 60) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
}

console.log('🧪 开始 PptxViewer Headless DOM 组件交互验证...\n');

const sampleBytes = await generateSamplePptxBytes();
const sampleBase64 = bytesToBase64(sampleBytes);

await it('PptxViewer 真实挂载并渲染舞台与 3 张真实缩略图', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(PptxViewer, {
        binaryUrl: sampleBase64,
        fileName: 'sample.pptx',
        locale: 'zh-CN',
      })
    );
  });
  await flushUi(120);

  assert.ok(container.textContent?.includes('OmniView PPTX 原生演播工作台'), '主舞台应渲染封面标题');
  const thumbs = container.querySelectorAll('aside button');
  assert.strictEqual(thumbs.length, 3, '左侧栏应渲染 3 张真实幻灯片缩略图按钮');

  // 点击第 2 张缩略图切换幻灯片
  await act(async () => {
    thumbs[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);
  assert.ok(container.textContent?.includes('核心渲染架构与工作流'), '点击缩略图应切换至第 2 张幻灯片');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('平铺总览视图 (Grid) 打开与选页跳转', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(PptxViewer, {
        binaryUrl: sampleBase64,
        fileName: 'grid-test.pptx',
        locale: 'zh-CN',
      })
    );
  });
  await flushUi(120);

  const gridBtn = Array.from(container.querySelectorAll('header button')).find(b =>
    b.textContent?.includes('总览')
  );
  assert.ok(gridBtn, '顶部栏应存在总览按钮');

  await act(async () => {
    gridBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);

  const dialog = container.querySelector('[role="dialog"]');
  assert.ok(dialog, '点击总览应打开 Slide Sorter 对话层');

  const gridCards = dialog.querySelectorAll('button');
  const slide3Card = Array.from(gridCards).find(b => b.textContent?.includes('#3'));
  assert.ok(slide3Card, '平铺总览中应包含第 3 页卡片');

  await act(async () => {
    slide3Card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);

  assert.strictEqual(container.querySelector('[role="dialog"]'), null, '选择页面后应自动关闭平铺总览');
  assert.ok(container.textContent?.includes('特性支持矩阵与性能指标'), '主舞台应跳转至第 3 页');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('演讲者备注抽屉、Ctrl+F 搜索高亮与损坏数据降级提示横幅', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(PptxViewer, {
        content: 'not-a-valid-zip-stream!!!',
        fileName: 'corrupt.pptx',
        locale: 'zh-CN',
      })
    );
  });
  await flushUi(120);

  const alertBanner = container.querySelector('[role="alert"]');
  assert.ok(alertBanner, '损坏文件降级后应渲染 warning alert 横幅');

  // 展开演讲者备注
  const notesBtn = Array.from(container.querySelectorAll('header button')).find(b =>
    b.textContent?.includes('备注')
  );
  assert.ok(notesBtn, '应存在备注按钮');
  await act(async () => {
    notesBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.ok(container.textContent?.includes('演讲者备注 (Speaker Notes)'), '应展开演讲者备注抽屉');

  // 打开搜索框并输入关键字
  const searchBtn = container.querySelector('header button[title*="搜索"]');
  assert.ok(searchBtn, '应存在搜索开关按钮');
  await act(async () => {
    searchBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);

  const input = container.querySelector('input[type="text"]');
  assert.ok(input, '搜索输入栏应已挂载');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '性能指标');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await flushUi(50);

  const marks = container.querySelectorAll('mark');
  assert.ok(marks.length > 0, '搜索命中的文本应在舞台中使用 <mark> 高亮展示');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

console.log('\n🎉 全部 PptxViewer Headless DOM 组件交互验证测试通过！\n');
