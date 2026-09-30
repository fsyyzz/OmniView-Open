/**
 * DOCX 渲染 DOM → Markdown 纯函数转换器
 * 遍历 docx-preview 渲染产出的 DOM 节点，输出结构化的 Markdown 文本
 */

export function docxDomToMarkdown(container: HTMLElement | null): string {
  if (!container) return '';

  const lines: string[] = [];
  const c = container as unknown as {
    querySelector?: (sel: string) => Element | null;
    querySelectorAll?: (sel: string) => unknown[];
  };

  const wrapper = c.querySelector?.('.docx-rendered-wrapper') || container;
  const rawPages: unknown[] = (wrapper as unknown as { querySelectorAll?: (sel: string) => unknown[] })
    .querySelectorAll?.('section') || [];
  const pages = rawPages as Element[];
  const targets = pages.length > 0 ? pages : [wrapper as unknown as Element];

  for (const page of targets) {
    const article = (page as unknown as { querySelector?: (sel: string) => Element | null })
      .querySelector?.('article') || page;
    const body: Element[] = Array.from((article as unknown as { children?: Element[] }).children || []);

    for (const node of body) {
      const result = nodeToMarkdown(node);
      if (result.trim()) lines.push(result.trim());
    }
  }

  const cleaned = lines
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');

  return cleaned.trimEnd() + '\n';
}

function nodeToMarkdown(node: Element): string {
  const tag = node.tagName?.toLowerCase() || '';

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = parseInt(tag[1], 10);
      const text = inlineToMarkdown(node);
      return `${'#'.repeat(level)} ${text}`;
    }

    case 'p': {
      const text = inlineToMarkdown(node).trim();
      if (!text) return '';
      return text;
    }

    case 'pre': {
      const code = (node.textContent || '').trim();
      return '```\n' + code + '\n```';
    }

    case 'blockquote': {
      const inner = inlineToMarkdown(node).trim();
      return inner.split('\n').map(l => `> ${l}`).join('\n');
    }

    case 'ul':
    case 'ol':
      return listToMarkdown(node, tag === 'ol');

    case 'table':
      return tableToMarkdown(node);

    case 'img': {
      const src = node.getAttribute?.('src') || '';
      const alt = node.getAttribute?.('alt') || node.getAttribute?.('title') || '';
      if (!src) return '';
      return `![${alt}](${src})`;
    }

    case 'hr':
      return '---';

    default:
      return inlineToMarkdown(node).trim();
  }
}

function inlineToMarkdown(el: Element | Text): string {
  // Node.js 环境 Text 类不存在，用 typeof 检查 nodeType
  if (typeof (el as { nodeType?: number }).nodeType === 'number' && (el as { nodeType?: number }).nodeType === 3) {
    return escapeMdText((el as Text).textContent || '');
  }

  const nodeEl = el as Element;
  const tag = nodeEl.tagName?.toLowerCase() || '';

  switch (tag) {
    case 'strong':
    case 'b':
      return `**${inlineChildrenToMd(nodeEl)}**`;

    case 'em':
    case 'i':
      return `*${inlineChildrenToMd(nodeEl)}*`;

    case 's':
    case 'del':
      return `~~${inlineChildrenToMd(nodeEl)}~~`;

    case 'code':
      return '`' + ((nodeEl.textContent || '').trim()) + '`';

    case 'a': {
      const href = nodeEl.getAttribute?.('href') || '';
      const text = inlineChildrenToMd(nodeEl);
      if (!href || href === '#') return text;
      return `[${text}](${href})`;
    }

    case 'br':
      return '\n';

    case 'img': {
      const src = nodeEl.getAttribute?.('src') || '';
      if (!src) return '';
      const alt = nodeEl.getAttribute?.('alt') || '';
      return `![${alt}](${src})`;
    }

    default:
      return inlineChildrenToMd(nodeEl);
  }
}

function inlineChildrenToMd(el: Element): string {
  let result = '';
  const rawChildren: unknown = (el as unknown as { childNodes?: unknown }).childNodes;
  if (!rawChildren) {
    // 兜底：若 childNodes 不可用，直接读 textContent
    const tc = (el as unknown as { textContent?: string }).textContent;
    return tc ? escapeMdText(tc) : '';
  }
  const children: unknown[] = Array.isArray(rawChildren) ? rawChildren : [];
  for (const child of children) {
    if (typeof child === 'string') {
      result += escapeMdText(child);
    } else {
      const c = child as { nodeType?: number; tagName?: string; textContent?: string };
      if (typeof c.nodeType === 'number' && c.nodeType === 3) {
        result += escapeMdText(c.textContent || '');
      } else if (c.tagName) {
        result += inlineToMarkdown(child as unknown as Element);
      }
    }
  }
  return result;
}

function listToMarkdown(listEl: Element, isOrdered: boolean): string {
  const items = Array.from(listEl.querySelectorAll(':scope > li'));
  const lines: string[] = [];

  let idx = 0;
  for (const item of items) {
    idx += 1;
    const prefix = isOrdered ? `${idx}.` : '-';
    const nestedLists = Array.from(item.querySelectorAll(':scope > ul, :scope > ol'));
    const textParts: string[] = [];
    const itemRawChildren: unknown = (item as unknown as { childNodes?: unknown }).childNodes;
    const itemChildren: unknown[] = Array.isArray(itemRawChildren) ? itemRawChildren : [];
    for (const child of itemChildren) {
      if (typeof child === 'string') {
        textParts.push(escapeMdText(child));
        continue;
      }
      const c = child as { nodeType?: number; tagName?: string; textContent?: string };
      if (c.tagName === 'UL' || c.tagName === 'OL') continue;
      if (typeof c.nodeType === 'number' && c.nodeType === 3) {
        textParts.push(escapeMdText(c.textContent || ''));
      } else if (c.tagName) {
        textParts.push(inlineToMarkdown(child as unknown as Element));
      }
    }
    const text = textParts.join('').trim();
    lines.push(`${prefix} ${text}`);

    for (const nested of nestedLists) {
      const nestedMd = listToMarkdown(nested, nested.tagName === 'OL');
      const indented = nestedMd
        .split('\n')
        .map(l => l ? `  ${l}` : l)
        .join('\n');
      lines.push(indented);
    }
  }

  return lines.join('\n');
}

function tableToMarkdown(tableEl: Element): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const allCells = rows.map(row =>
    Array.from(row.querySelectorAll('th, td')).map(cell => {
      const text = inlineToMarkdown(cell).trim().replace(/\n/g, ' ');
      return text;
    })
  );

  const colCount = Math.max(...allCells.map(r => r.length), 0);
  if (colCount === 0) return '';

  // 第一行如果是 th，作为表头
  const firstRowHasTh = Array.from(rows[0].querySelectorAll('th')).length > 0;
  const header = firstRowHasTh ? allCells[0] : allCells[0];
  const body = firstRowHasTh ? allCells.slice(1) : allCells;

  const headerRow = '| ' + header.map(c => c || '').join(' | ') + ' |';
  const separatorRow = '| ' + Array(colCount).fill('---').join(' | ') + ' |';

  const lines = [headerRow, separatorRow];
  for (const row of body) {
    const padded = [...row];
    while (padded.length < colCount) padded.push('');
    lines.push('| ' + padded.map(c => c || '').join(' | ') + ' |');
  }

  return lines.join('\n');
}

/** 转义 Markdown 保留字符（仅对纯文本节点使用，避免破坏已有 MD 结构） */
function escapeMdText(text: string): string {
  // 保留空白，不转义 |（表格场景由调用方处理）
  return text
    .replace(/\t/g, '  ');
}
