/**
 * DOM 文本精准搜索高亮与导航引擎
 * 将匹配关键词用 <mark class="ov-search-match"> 包裹，并高亮当前活动项
 *
 * 注意：不得改写 SVG / KaTeX / 图表等命名空间或布局敏感子树，否则会出现“高亮后内容错乱”。
 */

const MATCH_CLASS = 'ov-search-match';
const ACTIVE_MATCH_CLASS = 'is-active-match';

/** 搜索高亮应跳过的祖先选择器（图表、公式、控件等） */
const SKIP_ANCESTOR_SELECTOR = [
  'svg',
  'math',
  'script',
  'style',
  'textarea',
  'input',
  'select',
  'button',
  'noscript',
  'template',
  '.katex',
  '.katex-html',
  '.MathJax',
  '.markdown-diagram',
  '.diagram-canvas',
  '.diagram-header',
  '.code-block-header',
  '.markdown-toolbar',
  '.doc-status-bar',
  '[aria-hidden="true"]',
  '[data-ov-skip-search]',
].join(', ');

/**
 * 判断文本节点是否可安全参与搜索高亮
 */
export function isSearchableTextNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  if (parent.classList.contains(MATCH_CLASS)) return false;
  if (parent.closest(SKIP_ANCESTOR_SELECTOR)) return false;
  return true;
}

/**
 * 清除容器内所有搜索高亮标记，还原文本节点
 */
export function clearSearchHighlights(container: HTMLElement | null): void {
  if (!container) return;
  const marks = container.querySelectorAll(`mark.${MATCH_CLASS}`);
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });
}

/**
 * 在容器中搜索关键字并高亮所有命中项
 * 返回命中总数
 */
export function highlightSearchMatches(container: HTMLElement | null, keyword: string): number {
  if (!container) return 0;
  clearSearchHighlights(container);

  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return 0;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isSearchableTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  const regex = new RegExp(`(${cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  let matchCount = 0;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    if (!text) continue;

    // 先用 search 判断，避免 global RegExp#test 推进 lastIndex 的副作用
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // 防御零宽匹配死循环
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }

      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
      }

      const mark = document.createElement('mark');
      mark.className = MATCH_CLASS;
      mark.dataset.matchIndex = String(matchCount++);
      mark.textContent = match[0];
      fragment.appendChild(mark);

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return matchCount;
}

/**
 * 激活指定索引的命中高亮，并在需要时平滑滚动到该位置
 * @param shouldScroll 是否执行视口滚动（默认 false，仅在用户主动按键/点击导航时为 true）
 */
export function activateMatch(
  container: HTMLElement | null,
  activeIndex: number,
  shouldScroll: boolean = false
): void {
  if (!container) return;
  const marks = container.querySelectorAll<HTMLElement>(`mark.${MATCH_CLASS}`);
  marks.forEach((mark, idx) => {
    if (idx === activeIndex) {
      mark.classList.add(ACTIVE_MATCH_CLASS);
      if (shouldScroll) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    } else {
      mark.classList.remove(ACTIVE_MATCH_CLASS);
    }
  });
}
