#!/usr/bin/env node
/**
 * OmniView — SVG v2 侧边工具条与图层/属性单选抽屉交互测试套件
 *
 * 验证契约：
 * 1. SvgV2LayersPanel:
 *    - isCollapsed 为 true 时仅渲染折叠标题栏 (aria-expanded="false")，不渲染树形列表；
 *    - 点击标题栏触发 onToggleCollapse 回调；
 *    - 默认保持 data-inspector-panel="true" 阻止画布缩放穿透。
 * 2. SvgV2Inspector:
 *    - isCollapsed 为 true 时仅渲染折叠标题栏 (aria-expanded="false")，不渲染属性调节表单；
 *    - 点击标题栏触发 onToggleCollapse 回调；
 *    - 保持 data-inspector-panel="true" 阻止画布缩放穿透。
 * 3. SvgV2Studio (右侧工具条 + 单选抽屉面板):
 *    - 默认状态下右侧抽屉面板收起 (aside[data-inspector-panel] 不显示，甚至默认收缩)；
 *    - 右侧提供与左侧规范一致的垂直工具条 (aside[data-testid="svg-v2-right-rail"])；
 *    - 右侧工具条竖向排列 "图层面板" 与 "属性面板" 按钮；
 *    - 点击 "图层面板" 呼出右侧抽屉并仅展示图层；
 *    - 点击 "属性面板" 切换抽屉并仅展示属性（每次显示一个）；
 *    - 再次点击或点击收起按钮关闭抽屉面板。
 */
import { setupDomEnvironment, bundleAndLoadTsx, it, reportSummary, assert } from './harness/index.mjs';

setupDomEnvironment();

const { SvgV2LayersPanel, SvgV2Inspector, SvgV2Studio, SvgCore } = await bundleAndLoadTsx(`
  export { SvgV2LayersPanel } from './src/features/viewers/components/drivers/svg/SvgV2LayersPanel.tsx';
  export { SvgV2Inspector } from './src/features/viewers/components/drivers/svg/SvgV2Inspector.tsx';
  export { SvgV2Studio } from './src/features/viewers/components/drivers/svg/SvgV2Studio.tsx';
  export * as SvgCore from './src/features/viewers/components/drivers/svg/core/index.ts';
`, { external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'dompurify'] });

const { createDocument, makePath, appendToLayer, createRectGeometry } = SvgCore;

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

console.log('🧪 开始 SVG v2 侧边工具条与单选抽屉功能测试...\n');

// ============================================================================
// 1. SvgV2LayersPanel 独立折叠
// ============================================================================
await it('SvgV2LayersPanel: 折叠时隐藏图层树列表并正确响应点击切换', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let doc = createDocument({ width: 800, height: 600 });
  const layerId = doc.layers[0];
  const p1 = makePath(0, createRectGeometry(10, 10, 50, 50));
  doc = appendToLayer(doc, layerId, p1).doc;

  let toggled = false;
  let root;

  // 1) 显式折叠状态
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2LayersPanel, {
        document: doc,
        selection: { nodeIds: [] },
        execute: () => {},
        isCollapsed: true,
        onToggleCollapse: () => { toggled = true; },
      })
    );
  });

  const headerBtn = container.querySelector('button[aria-expanded="false"]');
  assert.ok(headerBtn, '折叠时应当展示 aria-expanded=false 的标题按钮');
  assert.strictEqual(container.querySelectorAll('[role="treeitem"]').length, 0, '折叠时图层项列表应当不渲染');
  assert.ok(container.querySelector('[data-inspector-panel="true"]'), '应保留 data-inspector-panel 防滚轮穿透');

  // 触发点击展开
  await act(async () => {
    headerBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(toggled, true, '点击折叠标题应当触发 onToggleCollapse 回调');

  // 2) 展开状态
  await act(async () => {
    root.render(
      React.createElement(SvgV2LayersPanel, {
        document: doc,
        selection: { nodeIds: [] },
        execute: () => {},
        isCollapsed: false,
        onToggleCollapse: () => {},
      })
    );
  });

  const expandedBtn = container.querySelector('button[aria-expanded="true"]');
  assert.ok(expandedBtn, '展开时应当展示 aria-expanded=true 的标题按钮');
  assert.ok(container.querySelectorAll('[role="treeitem"]').length > 0, '展开时图层树节点应当渲染');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 2. SvgV2Inspector 独立折叠
// ============================================================================
await it('SvgV2Inspector: 折叠时隐藏属性表单并正确响应点击切换', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const doc = createDocument({ width: 800, height: 600 });
  let toggled = false;
  let root;

  // 1) 显式折叠状态 (无选中图元时)
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2Inspector, {
        document: doc,
        selection: { primaryId: null, nodeIds: [] },
        execute: () => {},
        isCollapsed: true,
        onToggleCollapse: () => { toggled = true; },
      })
    );
  });

  const headerBtn = container.querySelector('button[aria-expanded="false"]');
  assert.ok(headerBtn, '折叠时应有 aria-expanded=false 的属性标题按钮');
  assert.ok(headerBtn.textContent.includes('SVG 图形尺寸'), '应展示图形尺寸摘要');
  assert.ok(container.querySelector('[data-inspector-panel="true"]'), '应保留 data-inspector-panel');

  await act(async () => {
    headerBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(toggled, true, '点击折叠属性标题应当触发 onToggleCollapse 回调');

  // 2) 展开状态
  await act(async () => {
    root.render(
      React.createElement(SvgV2Inspector, {
        document: doc,
        selection: { primaryId: null, nodeIds: [] },
        execute: () => {},
        isCollapsed: false,
        onToggleCollapse: () => {},
      })
    );
  });

  const expandedBtn = container.querySelector('button[aria-expanded="true"]');
  assert.ok(expandedBtn, '展开时应有 aria-expanded=true 按钮');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ============================================================================
// 3. SvgV2Studio 右侧工具条与单选抽屉面板交互
// ============================================================================
await it('SvgV2Studio: 右侧垂直工具条支持图层与属性单选展开，点击每次显示一个', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const svgContent = '<svg viewBox="0 0 400 300"><rect x="10" y="10" width="100" height="80" fill="#3b82f6"/></svg>';
  let root;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(SvgV2Studio, {
        content: svgContent,
        fileName: 'test.svg',
      })
    );
  });

  // 默认右侧抽屉面板应收缩 (aside[data-inspector-panel] 不显示)
  assert.strictEqual(container.querySelector('aside[data-inspector-panel]'), null, '默认进入 SVG 编辑时抽屉面板应当收缩');

  // 验证右侧工具条存在 (aside[data-testid="svg-v2-right-rail"])
  const rightRail = container.querySelector('aside[data-testid="svg-v2-right-rail"]');
  assert.ok(rightRail, '右侧应当渲染类似左侧的垂直工具条');

  // 右侧工具条内应分别包含 "图层面板" 与 "属性面板" 按钮
  const railLayersBtn = rightRail.querySelector('button[aria-label="图层面板"]');
  const railPropertiesBtn = rightRail.querySelector('button[aria-label="属性面板"]');
  assert.ok(railLayersBtn, '右侧工具条应包含图层面板按钮');
  assert.ok(railPropertiesBtn, '右侧工具条应包含属性面板按钮');

  // 1) 点击右侧工具条的 "图层面板" 按钮：呼出抽屉并仅展示图层
  await act(async () => {
    railLayersBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });

  const drawer1 = container.querySelector('aside[data-inspector-panel]');
  assert.ok(drawer1, '点击图层后抽屉面板应当展开');
  assert.ok(drawer1.textContent.includes('图层树'), '抽屉顶栏应标明图层树');
  assert.ok(drawer1.querySelector('[role="tree"]'), '抽屉内部应当渲染图层列表');
  assert.strictEqual(drawer1.textContent.includes('SVG 图形尺寸'), false, '当前仅展示图层，不应显示属性面板');

  // 2) 点击右侧工具条的 "属性面板" 按钮：切换为仅展示属性（每次显示一个）
  await act(async () => {
    railPropertiesBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });

  const drawer2 = container.querySelector('aside[data-inspector-panel]');
  assert.ok(drawer2, '抽屉面板保持展开');
  assert.ok(drawer2.textContent.includes('属性检视器'), '抽屉顶栏应切换为属性检视器');
  assert.ok(drawer2.textContent.includes('SVG 图形尺寸'), '抽屉内部应当渲染属性表单');
  assert.strictEqual(drawer2.querySelector('[role="tree"]'), null, '当前仅展示属性，不应显示图层列表');

  // 3) 再次点击已激活的 "属性面板" 按钮：收起抽屉面板
  await act(async () => {
    railPropertiesBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(container.querySelector('aside[data-inspector-panel]'), null, '再次点击已激活项应当收起抽屉');

  // 4) 验证顶栏不再包含重复的图层与属性按钮（响应用户去重诉求）
  const headerLayersBtn = container.querySelector('header button[aria-label="图层面板"]');
  assert.strictEqual(headerLayersBtn, null, '顶栏重复的图层按钮已去除，避免与右侧工具栏重复');

  // 5) 再次通过右侧工具条呼出图层面板并再次点击收起
  await act(async () => {
    railLayersBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  const drawer3 = container.querySelector('aside[data-inspector-panel]');
  assert.ok(drawer3, '点击右侧工具条图层按钮应当打开图层抽屉');
  assert.ok(railLayersBtn.classList.contains('bg-[var(--ov-accent)]'), '右侧工具条图层按钮应当高亮激活');

  await act(async () => {
    railLayersBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.strictEqual(container.querySelector('aside[data-inspector-panel]'), null, '再次点击右侧工具条图层按钮应当收起抽屉');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

reportSummary();
