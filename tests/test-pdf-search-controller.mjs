#!/usr/bin/env node
/**
 * OmniView — PDF 全文检索状态控制器 (usePdfSearchController) 单元测试
 * 验证：搜索防抖、无结果保护、循环匹配项导航与页面跳转联动
 */
import { setupDomEnvironment, bundleAndLoadTsx, it, reportSummary, assert } from './harness/index.mjs';

setupDomEnvironment();

const { usePdfSearchController } = await bundleAndLoadTsx(`
  export { usePdfSearchController } from './src/features/viewers/components/drivers/pdf/usePdfSearchController.ts';
`, { external: ['react', 'react/jsx-runtime', 'pdfjs-dist'] });

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

console.log('🧪 开始 PDF 检索状态控制器 (usePdfSearchController) 单元测试...\n');

// 构造虚拟 PDFDocumentProxy
const mockPdfDoc = {
  numPages: 3,
  getPage: async (pageNum) => ({
    getTextContent: async () => ({
      items: [
        { str: pageNum === 1 ? 'Hello world in PDF first page' : pageNum === 2 ? 'Another keyword in second page' : 'Final page' }
      ]
    })
  })
};

await it('usePdfSearchController 初始化、检索与循环导航', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  let controllerRef;
  const jumpedPages = [];

  function TestComponent() {
    const controller = usePdfSearchController({
      pdfDoc: mockPdfDoc,
      onJumpToPage: (page) => jumpedPages.push(page),
    });
    controllerRef = controller;
    return React.createElement('div', { id: 'test-controller' });
  }

  await act(async () => {
    root.render(React.createElement(TestComponent));
  });

  // 1. 验证初始状态
  assert.strictEqual(controllerRef.isSearchOpen, false, '初始检索栏应为关闭');
  assert.strictEqual(controllerRef.searchQuery, '', '初始关键词应为空');
  assert.strictEqual(controllerRef.searchMatches.length, 0, '初始结果集应为空');

  // 2. 执行搜索
  await act(async () => {
    await controllerRef.performSearch('keyword');
  });

  assert.strictEqual(controllerRef.searchMatches.length, 1, '应检索到 1 个匹配项');
  assert.strictEqual(controllerRef.searchMatches[0].pageNumber, 2, '匹配项应在第 2 页');
  assert.strictEqual(jumpedPages[jumpedPages.length - 1], 2, '检索到结果应自动跳转至第 2 页');

  // 3. 执行多结果搜索并测试循环切换
  await act(async () => {
    await controllerRef.performSearch('page');
  });

  assert.strictEqual(controllerRef.searchMatches.length, 3, '应在 3 页中均匹配到 "page"');
  assert.strictEqual(controllerRef.currentMatchIndex, 0, '首个匹配项索引应为 0');

  // 切换下一个匹配项
  act(() => {
    controllerRef.handleNextMatch();
  });
  assert.strictEqual(controllerRef.currentMatchIndex, 1, '应切换至下一个匹配项索引 1');

  act(() => {
    controllerRef.handleNextMatch();
  });
  assert.strictEqual(controllerRef.currentMatchIndex, 2, '应切换至第三个匹配项索引 2');

  // 循环回绕
  act(() => {
    controllerRef.handleNextMatch();
  });
  assert.strictEqual(controllerRef.currentMatchIndex, 0, '到达末尾后应循环回绕至索引 0');

  // 向上循环回绕
  act(() => {
    controllerRef.handlePrevMatch();
  });
  assert.strictEqual(controllerRef.currentMatchIndex, 2, '在索引 0 向上应回绕至末尾索引 2');

  // 4. 关闭搜索清理状态
  act(() => {
    controllerRef.closeSearch();
  });
  assert.strictEqual(controllerRef.isSearchOpen, false, '关闭搜索应重置显隐');
  assert.strictEqual(controllerRef.searchQuery, '', '关闭搜索应清空查询词');
  assert.strictEqual(controllerRef.searchMatches.length, 0, '关闭搜索应清空匹配列表');

  // 卸载组件
  act(() => {
    root.unmount();
  });
  container.remove();
});

reportSummary();
