/**
 * DOM 搜索高亮引擎契约测试（轻量 mock，不依赖 jsdom）
 */
import assert from 'node:assert/strict';
import { isSearchableTextNode, splitTextForHighlight } from '../src/features/viewers/lib/domSearchHighlighter';

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

console.log('🧪 开始 splitTextForHighlight 文本片段分词高亮契约测试...');

{
  const segments = splitTextForHighlight('Hello World, welcome to the world!', 'world');
  assert.equal(segments.length, 5);
  assert.equal(segments[0].text, 'Hello ');
  assert.equal(segments[0].isMatch, false);
  assert.equal(segments[1].text, 'World');
  assert.equal(segments[1].isMatch, true);
  assert.equal(segments[2].text, ', welcome to the ');
  assert.equal(segments[2].isMatch, false);
  assert.equal(segments[3].text, 'world');
  assert.equal(segments[3].isMatch, true);
  assert.equal(segments[4].text, '!');
  assert.equal(segments[4].isMatch, false);
}

{
  const segments = splitTextForHighlight('plain text', '');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].text, 'plain text');
  assert.equal(segments[0].isMatch, false);
}

{
  const segments = splitTextForHighlight('regex (test) [brackets]', '(test)');
  assert.equal(segments.length, 3);
  assert.equal(segments[0].text, 'regex ');
  assert.equal(segments[0].isMatch, false);
  assert.equal(segments[1].text, '(test)');
  assert.equal(segments[1].isMatch, true);
  assert.equal(segments[2].text, ' [brackets]');
  assert.equal(segments[2].isMatch, false);
}

console.log('🎉 DOM 搜索高亮与分词高亮测试全部通过！');
