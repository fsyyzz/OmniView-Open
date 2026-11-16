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
import { setupDomEnvironment, bundleAndLoadTsx, it, assert, reportSummary } from './harness/index.mjs';

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

async function waitForDocxReady(container, options = {}) {
  const { maxMs = 3000, waitHeadings = false } = options;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const hasSheets = container.querySelectorAll('.docx-paged-sheet').length > 0;
    const isStillParsing =
      container.textContent?.includes('正在解析 Word 文档结构') ||
      container.textContent?.includes('Parsing Word document structure');
    if (hasSheets && !isStillParsing) {
      if (!waitHeadings) {
        await flushUi(140);
        return;
      }
      const sidebarText = container.querySelector('.docx-toc-sidebar')?.textContent || '';
      if (sidebarText.includes('H1') || sidebarText.includes('H2') || !sidebarText.includes('大纲 (0)')) {
        await flushUi(60);
        return;
      }
    }
    await flushUi(60);
  }
  await flushUi(140);
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
  await waitForDocxReady(container);

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
  await waitForDocxReady(container);

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
  await waitForDocxReady(container);

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
    await waitForDocxReady(container);

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

await it('DocxViewer 默认启用原生一页一页分页渲染，并支持单页翻阅模式与页面导航卡片跳转', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(DocxViewer, {
        binaryUrl: sampleBase64,
        fileName: 'native-paged.docx',
        locale: 'zh-CN',
      })
    );
  });
  await waitForDocxReady(container);

  // 1. 验证默认即为 mode-paged 原生一页一页物理纸张模式，且渲染出 5 张独立 .docx-paged-sheet
  const viewportRoot = container.querySelector('.docx-viewport-root');
  assert.ok(viewportRoot?.classList.contains('mode-paged'), '默认打开 Word 文档必须处于 mode-paged 原生分页模式');
  const sheets = container.querySelectorAll('.docx-paged-sheet');
  assert.strictEqual(sheets.length, 5, `5 页样例文档应原生渲染为 5 张独立物理页面 (.docx-paged-sheet)，当前: ${sheets.length}`);
  sheets.forEach((sheet, idx) => {
    assert.strictEqual(sheet.getAttribute('data-page-width'), '794', `第 ${idx + 1} 页声明宽度必须为标准 794px`);
    assert.strictEqual(sheet.getAttribute('data-page-height'), '1123', `第 ${idx + 1} 页声明高度必须为标准 1123px`);
    assert.strictEqual(sheet.style.width, '794px', `第 ${idx + 1} 页固定 style.width 必须为 794px`);
    assert.strictEqual(sheet.style.height, '1123px', `第 ${idx + 1} 页固定 style.height 必须为 1123px`);
    assert.strictEqual(sheet.style.overflow, 'hidden', `第 ${idx + 1} 页必须限制溢出不撑破纸张尺寸`);
  });

  // 2. 验证切换至“单页”逐页翻阅模式 (mode-single)，此时仅当前页可见，其余页具备 docx-single-hidden-sheet
  const singleModeBtn = Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.trim() === '单页');
  assert.ok(singleModeBtn, '顶栏应提供“单页”逐页翻阅模式按钮');
  await act(async () => {
    singleModeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(60);

  assert.ok(viewportRoot?.classList.contains('mode-single'), '切换至单页后根容器应具备 mode-single 类名');
  const activeSheetsPage1 = container.querySelectorAll('.docx-paged-sheet.docx-single-active-sheet');
  const hiddenSheetsPage1 = container.querySelectorAll('.docx-paged-sheet.docx-single-hidden-sheet');
  assert.strictEqual(activeSheetsPage1.length, 1, '单页模式下同一时刻仅展示 1 张活动页面');
  assert.strictEqual(activeSheetsPage1[0].getAttribute('data-page-number'), '1', '初始活动页应为第 1 页');
  assert.strictEqual(hiddenSheetsPage1.length, 4, '其余 4 页应被标记隐藏');

  // 3. 点击底部翻页胶囊的“下一页”按钮翻至第 2 页
  const flipNextBtn = Array.from(container.querySelectorAll('.docx-page-flip-bar button')).find(b => b.textContent?.includes('下一页'));
  assert.ok(flipNextBtn, '底部应渲染原生一页一页翻页胶囊的“下一页”按钮');
  await act(async () => {
    flipNextBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(60);

  const activeSheetsPage2 = container.querySelectorAll('.docx-paged-sheet.docx-single-active-sheet');
  assert.strictEqual(activeSheetsPage2.length, 1);
  assert.strictEqual(activeSheetsPage2[0].getAttribute('data-page-number'), '2', '点击下一页后活动页应切换至第 2 页');

  // 4. 验证左侧导航栏“页面”标签页可按页点击直达第 4 页
  const pagesTabBtn = Array.from(container.querySelectorAll('.docx-toc-sidebar button')).find(b => b.textContent?.includes('页面 (5)'));
  assert.ok(pagesTabBtn, '左侧导航窗口应提供“页面 (5)”一页一页导航切换标签');
  await act(async () => {
    pagesTabBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);

  const page4Card = Array.from(container.querySelectorAll('.docx-toc-sidebar button')).find(b => b.textContent?.includes('第 4 页'));
  assert.ok(page4Card, '页面列表应渲染“第 4 页”导航卡片');
  await act(async () => {
    page4Card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(60);

  const activeSheetsPage4 = container.querySelectorAll('.docx-paged-sheet.docx-single-active-sheet');
  assert.strictEqual(activeSheetsPage4[0].getAttribute('data-page-number'), '4', '点击左侧第 4 页卡片后应直达第 4 页');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('DocxViewer 点击左侧大纲或第 1 页文内目录跳转后，必须精准定位到正文所在页而非留在目录页', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(DocxViewer, {
        binaryUrl: sampleBase64,
        fileName: 'toc-nav-jump.docx',
        locale: 'zh-CN',
      })
    );
  });
  await waitForDocxReady(container, { waitHeadings: true });

  // 切换至单页翻阅模式，初始位于第 1 页（封面与目录页）
  const singleModeBtn = Array.from(container.querySelectorAll('header button')).find(b => b.textContent?.trim() === '单页');
  assert.ok(singleModeBtn, '应存在单页按钮');
  await act(async () => {
    singleModeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(60);

  assert.strictEqual(
    container.querySelector('.docx-paged-sheet.docx-single-active-sheet')?.getAttribute('data-page-number'),
    '1',
    '初始应在包含文内目录的第 1 页'
  );

  // 1. 点击左侧大纲中的「三、渲染引擎架构与安全沙箱防御」，必须跳至第 3 页正文而非停留在第 1 页目录
  const outlineBtn = Array.from(container.querySelectorAll('.docx-toc-sidebar [title], .docx-toc-sidebar button')).find(b =>
    b.textContent?.includes('三、渲染引擎架构与安全沙箱防御')
  );
  assert.ok(outlineBtn, '左侧大纲应包含「三、渲染引擎架构与安全沙箱防御」');
  await act(async () => {
    outlineBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(60);

  const jumpedPage = container.querySelector('.docx-paged-sheet.docx-single-active-sheet')?.getAttribute('data-page-number');
  assert.notStrictEqual(jumpedPage, '1', '点击大纲后绝不能停留在第 1 页文内目录');
  assert.strictEqual(jumpedPage, '3', `点击「三、渲染引擎架构与安全沙箱防御」应翻至正文所在第 3 页，实际: ${jumpedPage}`);

  // 2. 切回第 1 页，直接点击文内目录中的超链接，也应跳转到对应正文页
  const prevPageBtn = Array.from(container.querySelectorAll('.docx-page-flip-bar button')).find(b => b.textContent?.includes('上一页'));
  await act(async () => {
    prevPageBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  await act(async () => {
    prevPageBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(30);
  assert.strictEqual(
    container.querySelector('.docx-paged-sheet.docx-single-active-sheet')?.getAttribute('data-page-number'),
    '1',
    '应切回第 1 页目录页'
  );

  const inDocTocLink = Array.from(container.querySelectorAll('.docx-paged-sheet[data-page-number="1"] a')).find(a =>
    a.textContent?.includes('四、主题滤镜与全局快捷键指南')
  );
  assert.ok(inDocTocLink, '第 1 页应渲染可点击的文内 Word 目录超链接');
  await act(async () => {
    inDocTocLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await flushUi(60);

  const pageAfterTocClick = container.querySelector('.docx-paged-sheet.docx-single-active-sheet')?.getAttribute('data-page-number');
  assert.strictEqual(pageAfterTocClick, '4', `点击文内目录超链接应跳转到第 4 页正文，实际: ${pageAfterTocClick}`);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

await it('OOXML 行高规则 (省略 lineRule / atLeast / beforeLines) 与横版/页边距/分栏页面属性完整渲染与元数据展示', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:sz w:val="21"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="300"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
</w:styles>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:spacing w:line="360" w:beforeLines="50"/></w:pPr>
      <w:r><w:t>第一段省略 lineRule 应当按 1.5 倍行距渲染而非 18pt</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:line="400" w:lineRule="atLeast"/></w:pPr>
      <w:r><w:t>第二段最小值行距不应叠成 calc(100% + 20pt)</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
      <w:cols w:num="2" w:space="720" w:sep="1"/>
      <w:docGrid w:type="lines" w:linePitch="312"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  const customBytes = await zip.generateAsync({ type: 'uint8array' });
  const customB64 = bytesToBase64(customBytes);

  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(DocxViewer, {
        binaryUrl: customB64,
        fileName: 'landscape-fidelity.docx',
        locale: 'zh-CN',
      })
    );
  });
  await waitForDocxReady(container);

  const sheet = container.querySelector('.docx-paged-sheet');
  assert.ok(sheet, '应渲染物理页面 .docx-paged-sheet');
  assert.strictEqual(sheet.getAttribute('data-page-width'), '1123', 'A4 横版页面宽度必须为 1123px');
  assert.strictEqual(sheet.getAttribute('data-page-height'), '794', 'A4 横版页面高度必须为 794px');
  assert.strictEqual(sheet.getAttribute('data-orientation'), 'landscape', '应标记 data-orientation="landscape"');
  assert.strictEqual(sheet.getAttribute('data-cols'), '2', '应标记双栏 data-cols="2"');

  const article = sheet.querySelector('article');
  assert.strictEqual(article?.style.columnCount, '2', '正文容器必须保留 2 栏 columnCount');

  const pEls = Array.from(sheet.querySelectorAll('p'));
  const firstP = pEls.find(p => p.textContent?.includes('第一段省略 lineRule'));
  const secondP = pEls.find(p => p.textContent?.includes('第二段最小值行距'));
  assert.ok(firstP && secondP, '应渲染两条行距测试段落');
  assert.notStrictEqual(firstP.style.lineHeight, '18pt', '省略 lineRule 时绝不能退化为固定 18pt');
  assert.strictEqual(firstP.style.lineHeight, '1.73', 'line=360 且省略 lineRule 应换算为 1.73 倍行距');
  assert.ok(firstP.style.marginTop, 'w:beforeLines="50" 应换算并设置段前 marginTop');
  assert.ok(!secondP.style.lineHeight.includes('100%'), 'atLeast 行距绝不能为 calc(100% + 20pt)');
  assert.ok(
    secondP.style.lineHeight === 'max(1.22em, 20pt)' || secondP.style.lineHeight === '20pt',
    `atLeast 应输出 max(1.22em, 20pt) 或等价 20pt，实际: ${secondP.style.lineHeight}`
  );
  assert.strictEqual(secondP.style.minHeight, '20pt', 'atLeast 应同步设置 min-height: 20pt');

  // 展开元数据抽屉验证页面与排版属性信息展示
  const infoBtn = container.querySelector('header button[title*="元数据"]');
  assert.ok(infoBtn, '应渲染元数据详情按钮');
  await act(async () => {
    infoBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await flushUi(40);
  assert.ok(container.textContent?.includes('A4 横向'), '元数据抽屉应显示 A4 横向');
  assert.ok(container.textContent?.includes('20 / 20 / 20 / 20 mm'), '元数据抽屉应显示 20mm 页边距');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

const summary = reportSummary('DocxViewer Headless DOM 组件交互测试');
if (summary.failed > 0) {
  process.exit(1);
}
console.log('\n🎉 全部 DocxViewer Headless DOM 组件交互验证测试通过！\n');
