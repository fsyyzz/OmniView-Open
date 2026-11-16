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
import { setupDomEnvironment, bundleAndLoadTsx, it, assert, reportSummary } from './harness/index.mjs';

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

await it('VS Code Webview 禁用 Fullscreen API 时，可通过底部 HUD 退出、右上角退出、F5 与 Esc 安全退出放映', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  // 模拟 VS Code Webview iframe 环境：requestFullscreen 返回 Promise reject，document.fullscreenElement 始终为 null
  const origRequestFs = HTMLElement.prototype.requestFullscreen;
  HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen blocked in Webview'));

  try {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(PptxViewer, {
          binaryUrl: sampleBase64,
          fileName: 'webview-present-exit.pptx',
          locale: 'zh-CN',
        })
      );
    });
    await flushUi(120);

    const findPresentBtn = () =>
      Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.includes('放映'));

    // 1. 点击「放映」进入演播模式，再点击底部 HUD「退出」按钮退出
    const presentBtn = findPresentBtn();
    assert.ok(presentBtn, '应渲染顶部放映按钮');
    await act(async () => {
      presentBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);

    assert.strictEqual(container.querySelector('header'), null, '进入放映后顶部主工具栏应隐藏');
    const cornerExit = container.querySelector('[data-testid="pptx-exit-presentation-corner"]');
    assert.ok(cornerExit, '进入放映后应渲染右上角常驻安全退出按钮');
    const hudExitBtn = Array.from(container.querySelectorAll('main button')).find(
      b => b !== cornerExit && b.textContent?.trim() === '退出'
    );
    assert.ok(hudExitBtn, '进入放映后应渲染底部 HUD 退出按钮');

    await act(async () => {
      hudExitBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);
    assert.ok(container.querySelector('header'), '在 document.fullscreenElement 为 null 时，点击 HUD 退出必须成功退出放映并恢复顶部工具栏');

    // 2. 通过 F5 进入放映，再按 Escape 退出
    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
    });
    await flushUi(40);
    assert.strictEqual(container.querySelector('header'), null, '按 F5 应进入放映模式');

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await flushUi(40);
    assert.ok(container.querySelector('header'), '按 Escape 必须安全退出放映模式并恢复顶部工具栏');

    // 3. 再次点击放映，通过右上角常驻退出按钮退出，并验证 F5 双向切换
    await act(async () => {
      findPresentBtn().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);
    assert.strictEqual(container.querySelector('header'), null, '再次点击放映应隐藏顶部栏');

    const cornerExitAgain = container.querySelector('[data-testid="pptx-exit-presentation-corner"]');
    assert.ok(cornerExitAgain, '应再次渲染右上角退出按钮');
    await act(async () => {
      cornerExitAgain.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flushUi(40);
    assert.ok(container.querySelector('header'), '点击右上角退出按钮必须安全退出放映');

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
    });
    await flushUi(40);
    assert.strictEqual(container.querySelector('header'), null, 'F5 再次进入放映');

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
    });
    await flushUi(40);
    assert.ok(container.querySelector('header'), '再次按 F5 必须支持双向切换退出放映');
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

await it('PPTX 多边形 SVG 渲染、图层层级树面板、多配色切换与画幅尺寸切换交互验证', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:sldSz cx="12192000" cy="6858000"/>
      <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
    </p:presentation>`
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
    </Relationships>`
  );
  zip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="2" name="正五边形节点"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            <a:xfrm><a:off x="635000" y="635000"/><a:ext cx="1905000" cy="1905000"/></a:xfrm>
            <a:prstGeom prst="pentagon"/>
            <a:solidFill><a:srgbClr val="3B82F6"/></a:solidFill>
          </p:spPr>
        </p:sp>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="3" name="自由多边形徽标"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            <a:xfrm><a:off x="3175000" y="635000"/><a:ext cx="1905000" cy="1905000"/></a:xfrm>
            <a:custGeom><a:pathLst><a:path w="100" h="100">
              <a:moveTo><a:pt x="0" y="0"/></a:moveTo>
              <a:lnTo><a:pt x="100" y="40"/></a:lnTo>
              <a:lnTo><a:pt x="50" y="100"/></a:lnTo>
              <a:close/>
            </a:path></a:pathLst></a:custGeom>
            <a:solidFill><a:srgbClr val="10B981"/></a:solidFill>
          </p:spPr>
        </p:sp>
      </p:spTree></p:cSld>
    </p:sld>`
  );

  const customBytes = await zip.generateAsync({ type: 'uint8array' });
  const customB64 = bytesToBase64(customBytes);

  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(PptxViewer, {
        binaryUrl: customB64,
        fileName: 'polygons-layers.pptx',
        locale: 'zh-CN',
      })
    );
  });
  await flushUi(120);

  // 1. 验证 pentagon 渲染出 SVG <polygon>，custom 渲染出 SVG <path>
  const pentagonNode = container.querySelector('[data-shape-type="pentagon"]');
  assert.ok(pentagonNode?.querySelector('polygon'), '正五边形必须渲染为 SVG <polygon>');
  const customPolyNode = container.querySelector('[data-shape-type="custom"]');
  assert.ok(customPolyNode?.querySelector('path'), 'custGeom 自由多边形必须渲染为 SVG <path>');

  // 2. 验证切换多种配色方案
  const colorBtn = container.querySelector('[data-testid="pptx-color-selector"]');
  assert.ok(colorBtn, '顶栏应渲染配色方案选择器');
  await act(async () => {
    colorBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  const colorMenu = container.querySelector('[data-testid="pptx-color-menu"]');
  assert.ok(colorMenu, '点击配色选择器应展开 6 种配色方案浮层');
  assert.strictEqual(colorMenu.querySelectorAll('button[data-color-preset]').length, 6, '应提供 6 种演播配色预设');

  const darkColorOpt = colorMenu.querySelector('button[data-color-preset="dark"]');
  await act(async () => {
    darkColorOpt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);
  assert.strictEqual(
    container.querySelector('[data-pptx-color]')?.getAttribute('data-pptx-color'),
    'dark',
    '选择暗夜配色后应激活 data-pptx-color="dark"'
  );

  // 3. 验证切换多种画幅尺寸与缩放倍率
  const sizeBtn = container.querySelector('[data-testid="pptx-size-selector"]');
  assert.ok(sizeBtn, '顶栏应渲染画幅尺寸选择器');
  await act(async () => {
    sizeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  const sizeMenu = container.querySelector('[data-testid="pptx-size-menu"]');
  assert.ok(sizeMenu, '点击尺寸选择器应展开画幅比例与缩放预设面板');
  assert.ok(sizeMenu.querySelectorAll('button[data-aspect-preset]').length >= 5, '应至少提供 5 种画幅尺寸预设');

  const aspect43Btn = sizeMenu.querySelector('button[data-aspect-preset="4:3"]');
  await act(async () => {
    aspect43Btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);
  assert.strictEqual(
    container.querySelector('[data-pptx-aspect]')?.getAttribute('data-pptx-aspect'),
    '4:3',
    '选择 4:3 画幅后应激活 data-pptx-aspect="4:3"'
  );

  // 4. 验证打开图层层级结构树并高亮选中图元
  const layerToggle = container.querySelector('[data-testid="pptx-layer-toggle"]');
  assert.ok(layerToggle, '顶栏应提供图层层级树切换按钮');
  await act(async () => {
    layerToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);

  const layerTree = container.querySelector('[data-testid="pptx-layer-tree"]');
  assert.ok(layerTree, '切换后左侧边栏应渲染元素层级树面板');
  assert.ok(layerTree.textContent?.includes('前景图元层'), '层级树应划分前景图元层');
  assert.ok(layerTree.textContent?.includes('正五边形节点'), '层级树应列出正五边形节点');

  const polyLayerBtn = Array.from(layerTree.querySelectorAll('button')).find(b =>
    b.textContent?.includes('正五边形节点')
  );
  await act(async () => {
    polyLayerBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  const selectedEl = container.querySelector('[data-element-id][data-selected="true"]');
  assert.ok(selectedEl, '点击图层列表项后，主舞台对应图元应具备 data-selected="true" 高亮态');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

const summary = reportSummary('PptxViewer Headless DOM 组件交互测试');
if (summary.failed > 0) {
  process.exit(1);
}
console.log('\n🎉 全部 PptxViewer Headless DOM 组件交互验证测试通过！\n');
