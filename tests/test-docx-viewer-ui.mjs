#!/usr/bin/env node
/**
 * OmniView DocxViewer 组件级 Headless DOM 交互与渲染验证套件
 * 基于 happy-dom 真实无头环境与 React 19：
 * 1. DocxViewer 挂载并渲染真实 Word 文档内容与多级大纲导航栏
 * 2. 缩放控制 (缩小/放大/重置/适合宽度) 与真实盒模型布局更新
 * 3. 流式 / 分页模式切换与纸张主题切换 (原纸/羊皮/暗夜 semantic theme)
 * 4. Ctrl+F 全文搜索高亮、大纲热力计数与元数据抽屉显隐
 * 5. 损坏字节流自愈降级告警横幅 (role="alert") 渲染与关闭
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

const { DocxViewer, generateSampleDocxBytes } = await bundleAndLoadTsx(`
  export { DocxViewer } from './src/features/viewers/components/drivers/DocxViewer.tsx';
  export { generateSampleDocxBytes } from './src/features/viewers/lib/docxEngine.ts';
`, {
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify', 'jszip', 'docx-preview'],
});

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function flushUi(ms = 80) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
}

console.log('🧪 开始 DocxViewer Headless DOM 组件交互验证...\n');

const sampleBytes = await generateSampleDocxBytes();
const sampleBase64 = bytesToBase64(sampleBytes);

await it('DocxViewer 真实挂载并渲染 Word 正文与多级大纲导航栏', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(DocxViewer, {
        binaryUrl: sampleBase64,
        fileName: 'guide.docx',
        locale: 'zh-CN',
      })
    );
  });
  await flushUi(220);

  assert.ok(container.textContent?.includes('OmniView Word 高保真文档指南'), '顶栏应显示文档标题');
  assert.ok(container.textContent?.includes('一、核心特性与排版能力'), '正文应渲染 DOCX 章节内容');
  assert.ok(container.textContent?.includes('文档导航'), '左侧应渲染多级大纲导航侧边栏');
  assert.strictEqual(container.querySelector('[role="alert"]'), null, '正常文档不应出现降级告警横幅');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('缩放控制、适宽模式、流式/分页模式与纸张主题语义化切换', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(DocxViewer, {
        binaryUrl: sampleBase64,
        fileName: 'theme-zoom.docx',
        locale: 'zh-CN',
      })
    );
  });
  await flushUi(220);

  // 验证放大/缩小/重置与适宽
  const zoomInBtn = container.querySelector('header button[title*="放大"]');
  const zoomOutBtn = container.querySelector('header button[title*="缩小"]');
  const resetBtn = container.querySelector('header button[title*="重置缩放"]');
  const fitBtn = Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.includes('适宽'));
  assert.ok(zoomInBtn && zoomOutBtn && resetBtn && fitBtn, '缩放与适宽控制按钮应完备');

  await act(async () => {
    zoomInBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.ok(container.textContent?.includes('110%'), '点击放大后应更新至 110%');

  await act(async () => {
    resetBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.ok(container.textContent?.includes('100%'), '点击重置应恢复 100%');

  await act(async () => {
    fitBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);

  // 验证纸张主题切换（通过 data-paper-theme 属性实现语义化主题，严禁全容器 filter: invert）
  const darkThemeBtn = Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.trim() === '暗夜');
  const sepiaThemeBtn = Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.trim() === '羊皮');
  assert.ok(darkThemeBtn && sepiaThemeBtn, '应存在暗夜与羊皮纸主题按钮');

  await act(async () => {
    darkThemeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  const viewportRoot = container.querySelector('.docx-viewport-root');
  assert.strictEqual(viewportRoot?.getAttribute('data-paper-theme'), 'dark', '暗夜主题应设置 data-paper-theme="dark"');
  const previewWrap = container.querySelector('.docx-preview-container');
  assert.ok(!previewWrap?.getAttribute('style')?.includes('invert('), '暗夜模式不应使用全容器 invert() 暴力反色');

  await act(async () => {
    sepiaThemeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.strictEqual(viewportRoot?.getAttribute('data-paper-theme'), 'sepia', '羊皮主题应设置 data-paper-theme="sepia"');

  // 验证切换至分页模式
  const pagedBtn = Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.trim() === '分页');
  assert.ok(pagedBtn, '应存在分页模式切换按钮');
  await act(async () => {
    pagedBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(220);
  assert.ok(viewportRoot?.classList.contains('mode-paged'), '切换至分页后根容器应具备 mode-paged 类名');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('损坏文件自愈降级告警横幅、Ctrl+F 搜索高亮与英文双语支持', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(DocxViewer, {
        content: 'corrupted-not-zip-payload!!!',
        fileName: 'broken.docx',
        locale: 'en-US',
      })
    );
  });
  await flushUi(240);

  // 验证英文 UI 与降级告警横幅
  const alertBanner = container.querySelector('[role="alert"]');
  assert.ok(alertBanner, '损坏 DOCX 应渲染 role="alert" 自愈降级告警横幅');
  assert.ok(alertBanner.textContent?.includes('fallback guide'), '英文模式告警文案应准确渲染');

  const dismissBtn = alertBanner.querySelector('button');
  await act(async () => {
    dismissBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.strictEqual(container.querySelector('[role="alert"]'), null, '点击关闭后应隐藏降级告警横幅');

  // 搜索高亮
  const searchInput = container.querySelector('header input[placeholder*="Search"]');
  assert.ok(searchInput, '英文界面应渲染英文搜索占位框');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(searchInput, 'DOMPurify');
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await flushUi(260);

  const marks = container.querySelectorAll('mark.ov-search-match');
  assert.ok(marks.length > 0, '搜索关键词后正文应渲染 <mark class="ov-search-match"> 高亮');

  // 元数据抽屉展开
  const infoBtn = container.querySelector('header button[title="Document Metadata"]');
  assert.ok(infoBtn, '应存在元数据详情按钮');
  await act(async () => {
    infoBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.ok(container.textContent?.includes('Word Metadata'), '应展开英文元数据抽屉');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('VS Code Webview 禁用 Fullscreen API 时，DocxViewer 可通过 HUD 按钮或 Esc 安全退出全屏', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  const origRequestFs = HTMLElement.prototype.requestFullscreen;
  HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen blocked in Webview'));

  try {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(DocxViewer, {
          binaryUrl: sampleBase64,
          fileName: 'webview-fs.docx',
          locale: 'zh-CN',
        })
      );
    });
    await flushUi(220);

    const fsBtn = container.querySelector('header button[title*="全屏"]');
    assert.ok(fsBtn, '应渲染全屏按钮');

    await act(async () => {
      fsBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);
    const hudExitBtn = container.querySelector('.docx-fullscreen-hud button[title*="退出"]');
    assert.ok(hudExitBtn, '进入全屏后应渲染全屏 HUD 与退出按钮');

    await act(async () => {
      hudExitBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);
    assert.strictEqual(container.querySelector('.docx-fullscreen-hud'), null, '点击 HUD 退出必须退出全屏');

    // 重新进入并用 Esc 退出
    await act(async () => {
      fsBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);
    assert.ok(container.querySelector('.docx-fullscreen-hud'), '应再次进入全屏 HUD');

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await flushUi(40);
    assert.strictEqual(container.querySelector('.docx-fullscreen-hud'), null, '按 Escape 必须退出全屏模式');
  } finally {
    HTMLElement.prototype.requestFullscreen = origRequestFs;
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    container.remove();
  }
});

console.log('\n🎉 全部 DocxViewer Headless DOM 组件交互验证测试通过！\n');
