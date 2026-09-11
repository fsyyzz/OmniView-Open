/**
 * DOM 搜索高亮引擎契约测试（轻量 mock，不依赖 jsdom）
 */
import assert from 'node:assert/strict';
import { isSearchableTextNode } from '../src/features/viewers/lib/domSearchHighlighter';

function makeTextNode(options) {
  const classList = {
    contains: (name) =>
      (options.className || '')
        .split(/\s+/)
        .filter(Boolean)
        .includes(name),
  };

  const parent = {
    classList,
    closest: (selector) => {
      if (!options.closestMatch) return null;
      return selector.includes(options.closestMatch) ? parent : null;
    },
    tagName: (options.tag || 'P').toUpperCase(),
  };

  return {
    node: {
      parentElement: parent,
    },
  };
}

console.log('🧪 开始 DOM 搜索高亮可搜索节点过滤测试...');

{
  const { node } = makeTextNode({ tag: 'p' });
  assert.equal(isSearchableTextNode(node), true, '普通段落文本应可搜索');
}

{
  const { node } = makeTextNode({ closestMatch: 'svg' });
  assert.equal(isSearchableTextNode(node), false, 'SVG 内文本必须跳过');
}

{
  const { node } = makeTextNode({ closestMatch: '.katex' });
  assert.equal(isSearchableTextNode(node), false, 'KaTeX 公式内文本必须跳过');
}

{
  const { node } = makeTextNode({ closestMatch: '.markdown-diagram' });
  assert.equal(isSearchableTextNode(node), false, '图表容器内文本必须跳过');
}

{
  const { node } = makeTextNode({ className: 'ov-search-match' });
  assert.equal(isSearchableTextNode(node), false, '已高亮 mark 内文本必须跳过');
}

{
  const { node } = makeTextNode({ closestMatch: 'button' });
  assert.equal(isSearchableTextNode(node), false, '按钮控件文本必须跳过');
}

console.log('🎉 DOM 搜索高亮过滤测试全部通过！');
