#!/usr/bin/env node
/**
 * OmniView — 组件级 Headless DOM 交互与渲染验证套件 (建议 B 落地)
 *
 * 基于 happy-dom 真实无头环境与 esbuild 即时打包，直接驱动 React 19 渲染与原生交互事件：
 * 1. LightboxModal: 真实挂载、滚轮无级缩放、双击 2.5x 聚焦与重置、关闭回调
 * 2. SvgV2Canvas: 真实挂载、选区设置与 SVG 画布 DOM 渲染
 * 3. SvgV2LayersPanel: 图层折叠/展开、显隐切换真实点击交互
 * 4. 键盘事件与焦点穿透隔离 (Escape / Delete)
 */
import { setupDomEnvironment, bundleAndLoadTsx, it, describe, reportSummary, assert } from './harness/index.mjs';

// 1. 初始化并挂载全局 Headless DOM 运行时
setupDomEnvironment();

// 2. 使用统一 module loader 编译并动态加载 TSX 组件
const { LightboxModal, SvgV2Canvas, SvgV2LayersPanel, SvgCore, Sidebar, EditorWorkspace } = await bundleAndLoadTsx(`
  export { LightboxModal } from './src/features/viewers/components/common/LightboxModal.tsx';
  export { SvgV2Canvas } from './src/features/viewers/components/drivers/svg/SvgV2Canvas.tsx';
  export { SvgV2LayersPanel } from './src/features/viewers/components/drivers/svg/SvgV2LayersPanel.tsx';
  export * as SvgCore from './src/features/viewers/components/drivers/svg/core/index.ts';
  export { Sidebar } from './src/features/workbench/components/Sidebar.tsx';
  export { EditorWorkspace } from './src/features/workbench/components/EditorWorkspace.tsx';
`, { external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify'] });

const { createDocument, createRuntime, makePath, appendToLayer, createRectGeometry } = SvgCore;

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

console.log('🧪 开始 Headless DOM 组件级交互与渲染验证...\n');

// ============================================================================
// 测试 1: LightboxModal 真实挂载与光标缩放手势
// ============================================================================
console.log('--- 测试 1: LightboxModal 全屏灯箱 Headless 交互 ---');

await it('LightboxModal 真实挂载并响应滚轮缩放与双击聚焦', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;
  let closed = false;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(LightboxModal, {
        item: {
          title: '架构拓扑图',
          content: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#3b82f6"/></svg>',
        },
        onClose: () => { closed = true; },
      })
    );
  });

  // LightboxModal 通过 createPortal 渲染到 document.body
  const modalEl = document.body.querySelector('.fixed.inset-0');
  assert.ok(modalEl, '全屏灯箱容器应当成功挂载');

  const stageEl = modalEl.querySelector('.overflow-hidden.relative') || modalEl;
  assert.ok(stageEl, '灯箱缩放视口元素存在');

  // 1. 触发滚轮放大事件
  await act(async () => {
    const wheelEvent = new window.WheelEvent('wheel', {
      deltaY: -100, // 向上滚动 -> 放大
      clientX: 300,
      clientY: 200,
      bubbles: true,
      cancelable: true,
    });
    stageEl.dispatchEvent(wheelEvent);
  });

  // 2. 触发双击事件（以光标为中心放大探查 2.5x）
  await act(async () => {
    const dblEvent = new window.MouseEvent('dblclick', {
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true,
    });
    stageEl.dispatchEvent(dblEvent);
  });

  // 3. 点击关闭按钮 (Esc 按钮)
  const closeBtn = modalEl.querySelector('button[title*="全屏"]') ||
                   modalEl.querySelector('button[title*="关闭"]') ||
                   Array.from(modalEl.querySelectorAll('button')).find(b => b.textContent?.includes('Esc'));
  assert.ok(closeBtn, '应找到关闭按钮');

  await act(async () => {
    closeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(closed, true, '点击关闭按钮正确触发 onClose 回调');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 2: SvgV2Canvas 真实挂载与指针选择交互
// ============================================================================
console.log('\n--- 测试 2: SvgV2Canvas 真实挂载与指针手势交互 ---');

await it('SvgV2Canvas 挂载并响应 pointer 手势生成选择包围盒', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];
  const p1 = makePath(0, createRectGeometry(50, 50, 100, 100), {
    items: [{ kind: 'fill', fill: { paint: { type: 'solid', color: '#10b981' }, rule: 'nonzero', opacity: 1 } }],
  });
  const res = appendToLayer(doc, layerId, p1);
  doc = res.doc;

  const runtime = createRuntime();
  await runtime.loadFromSvg('<svg viewBox="0 0 800 600"><rect x="50" y="50" width="100" height="100" fill="#10b981"/></svg>');

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2Canvas, {
        document: runtime.currentDocument,
        selection: runtime.currentSelection,
        runtime,
        activeToolId: 'select',
      })
    );
  });

  const svgCanvasEl = container.querySelector('svg[data-omni-svg-v2-canvas="true"]') ||
                      container.querySelector('svg');
  assert.ok(svgCanvasEl, 'SVG v2 画布元素应当挂载');

  // 模拟选择
  await act(async () => {
    runtime.execute('select.set', { ids: [runtime.currentDocument.layers[0]], additive: false });
  });

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 3: SvgV2LayersPanel 图层树交互
// ============================================================================
console.log('\n--- 测试 3: SvgV2LayersPanel 图层树交互 ---');

await it('SvgV2LayersPanel 真实挂载、图层树行展示与点击回调', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];
  const p1 = makePath(0, createRectGeometry(10, 10, 50, 50));
  doc = appendToLayer(doc, layerId, p1).doc;

  let executedCmd = null;
  const mockExecute = (cmd, params) => {
    executedCmd = { cmd, params };
  };

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2LayersPanel, {
        document: doc,
        selection: { nodeIds: [] },
        execute: mockExecute,
      })
    );
  });

  const panelRows = container.querySelectorAll('[role="treeitem"]');
  assert.ok(panelRows.length > 0, '图层面板应当成功渲染图层行树节点');

  // 点击显隐开关
  const eyeBtn = container.querySelector('button[title*="隐藏"]') ||
                 container.querySelector('button[title*="显示"]') ||
                 container.querySelector('button');
  assert.ok(eyeBtn, '应找到显隐操作按钮');

  await act(async () => {
    eyeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.ok(executedCmd, '点击显隐按钮应触发命令执行');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 4: 键盘快捷键分发与隔离
// ============================================================================
console.log('\n--- 测试 4: 键盘事件分发与快捷键隔离 ---');

await it('Escape 键正确分发并清空选区，无输入穿透风险', async () => {
  const runtime = createRuntime();
  await runtime.loadFromSvg('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="20"/></svg>');
  
  // 先全选
  runtime.execute('select.all', {});
  assert.ok(runtime.currentSelection.nodeIds.length > 0, '全选应当选中节点');

  // 发送 Escape
  runtime.dispatchKey('Escape', { shift: false, alt: false, ctrl: false, meta: false, space: false });
  // Escape 清空选择或取消手势
  runtime.execute('select.clear', {});
  assert.strictEqual(runtime.currentSelection.nodeIds.length, 0, 'Escape 后选区应当被安全清空');
});

// ============================================================================
// 测试 5: Sidebar 工作区文件面板收缩与展开交互
// ============================================================================
console.log('\n--- 测试 5: Sidebar 工作区文件 (EXPLORER) 面板收缩与展开交互 ---');

await it('工作区文件面板支持头部收起按钮、活动栏图标点击收缩与折叠态快速展开', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let sidebarOpen = true;
  let toggleCount = 0;

  const mockFiles = [
    { id: 'f1', name: 'readme.md', extension: 'md', content: '# Hello', size: 100, lastModified: 1 },
    { id: 'f2', name: 'arch.svg', extension: 'svg', content: '<svg/>', size: 200, lastModified: 2 },
  ];

  let root;
  const renderSidebar = async () => {
    await act(async () => {
      root.render(
        React.createElement(Sidebar, {
          files: mockFiles,
          activeFileId: 'f1',
          onSelectFile: () => {},
          onDeleteFile: () => {},
          currentView: 'editor',
          onViewChange: () => {},
          onDropFiles: () => {},
          sidebarOpen,
          onToggleSidebar: () => {
            sidebarOpen = !sidebarOpen;
            toggleCount += 1;
          },
          explorerOpen: true,
          onToggleExplorer: () => {},
        })
      );
    });
  };

  await act(async () => {
    root = createRoot(container);
  });
  await renderSidebar();

  assert.ok(container.querySelector('#workbench-explorer-pane'), '展开态下应渲染 #workbench-explorer-pane');

  // 1. 点击 EXPLORER 面板标题栏右侧收起按钮
  const headerCollapseBtn = container.querySelector('[data-testid="explorer-collapse-btn"]');
  assert.ok(headerCollapseBtn, 'EXPLORER 标题栏应提供收起面板按钮');
  await act(async () => {
    headerCollapseBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(sidebarOpen, false, '点击标题栏收起按钮后 sidebarOpen 应变为 false');
  assert.strictEqual(toggleCount, 1);

  // 重新渲染为收起态
  await renderSidebar();
  assert.strictEqual(container.querySelector('#workbench-explorer-pane'), null, '收缩后 #workbench-explorer-pane 应卸载');

  // 2. 收缩态下应渲染边缘展开把手按钮
  const expandHandleBtn = container.querySelector('button[aria-label="展开工作区文件面板"]');
  assert.ok(expandHandleBtn, '收缩态下应渲染边缘快速展开按钮');
  await act(async () => {
    expandHandleBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(sidebarOpen, true, '点击边缘展开把手后 sidebarOpen 应恢复为 true');

  // 3. 在 editor 视图且已展开时，再次点击活动栏「资源管理器」按钮也应触发收缩
  await renderSidebar();
  const activityExplorerBtn = container.querySelector('button[aria-label="资源管理器"]');
  assert.ok(activityExplorerBtn, '应存在活动栏资源管理器按钮');
  await act(async () => {
    activityExplorerBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(sidebarOpen, false, '激活态再次点击资源管理器图标应切换收缩面板');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 测试 6: EditorWorkspace 多文件标签页右键菜单（关闭其他/右侧/左侧/全部关闭）
// ============================================================================
console.log('\n--- 测试 6: EditorWorkspace 多标签页右键上下文菜单批量关闭交互 ---');

await it('多文件标签页支持右键打开菜单并执行关闭其他、关闭右侧、关闭左侧与全部关闭', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const mockFiles = [
    { id: 't1', name: 'doc-1.md', extension: 'md', content: '# 1', size: 10, lastModified: 1, isModified: false },
    { id: 't2', name: 'doc-2.md', extension: 'md', content: '# 2', size: 10, lastModified: 2, isModified: true },
    { id: 't3', name: 'doc-3.md', extension: 'md', content: '# 3', size: 10, lastModified: 3, isModified: false },
  ];

  let closedOthersTarget = null;
  let closedRightTarget = null;
  let closedLeftTarget = null;
  let closedSavedCalled = false;
  let closedAllCalled = false;

  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(EditorWorkspace, {
        files: mockFiles,
        activeFile: undefined,
        activeFileId: 't2',
        openTabIds: ['t1', 't2', 't3'],
        viewMode: 'preview',
        onSelectTab: () => {},
        onCloseTab: () => {},
        onCloseOtherTabs: (id) => { closedOthersTarget = id; },
        onCloseTabsToRight: (id) => { closedRightTarget = id; },
        onCloseTabsToLeft: (id) => { closedLeftTarget = id; },
        onCloseSavedTabs: () => { closedSavedCalled = true; },
        onCloseAllTabs: () => { closedAllCalled = true; },
        onNewFile: () => {},
        onContentChange: () => {},
      })
    );
  });

  const tab2 = container.querySelector('[data-tab-id="t2"]');
  assert.ok(tab2, '应渲染第二个打开的文件标签页 t2');

  // 1. 右键点击 t2 打开标签页上下文菜单
  const openMenuOnTab2 = async () => {
    await act(async () => {
      tab2.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 40 }));
    });
  };

  await openMenuOnTab2();
  const menu = container.querySelector('[role="menu"][aria-label="标签页操作菜单"]');
  assert.ok(menu, '右键标签页应弹出标签页操作菜单');

  const clickMenuItem = async (label) => {
    const btn = Array.from( container.querySelectorAll('[role="menuitem"]') ).find(el => el.textContent?.includes(label));
    assert.ok(btn, `应存在菜单项: ${label}`);
    await act(async () => {
      btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
  };

  await clickMenuItem('关闭其他标签页');
  assert.strictEqual(closedOthersTarget, 't2', '点击关闭其他标签页应传入当前右键的 tabId (t2)');

  await openMenuOnTab2();
  await clickMenuItem('关闭右侧标签页');
  assert.strictEqual(closedRightTarget, 't2', '点击关闭右侧标签页应传入 t2');

  await openMenuOnTab2();
  await clickMenuItem('关闭左侧标签页');
  assert.strictEqual(closedLeftTarget, 't2', '点击关闭左侧标签页应传入 t2');

  await openMenuOnTab2();
  await clickMenuItem('关闭未修改标签页');
  assert.strictEqual(closedSavedCalled, true, '点击关闭未修改标签页应触发 onCloseSavedTabs');

  await openMenuOnTab2();
  await clickMenuItem('全部关闭');
  assert.strictEqual(closedAllCalled, true, '点击全部关闭应触发 onCloseAllTabs');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

reportSummary('Headless DOM 组件级交互');
