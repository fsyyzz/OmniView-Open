/**
/**
 * DOCX 渲染 DOM → Markdown 纯函数转换器
 * 智能识别 docx-preview 渲染产出的 DOM 节点、类名特征、富文本内联样式与表格结构，
 * 输出清晰标准、层级严谨的 Markdown 文本
 * 
 * 作者: 周赞
 */

export function docxDomToMarkdown(container: HTMLElement | null): string {
  if (!container) return '';

  const lines: string[] = [];
  const c = container as unknown as {
    querySelector?: (sel: string) => Element | null;
    querySelectorAll?: (sel: string) => unknown[];
  };

  const wrapper = c.querySelector?.('.docx-rendered-wrapper') || container;
  
  // 查找所有顶层 Section 页面
  let pages: Element[] = [];
  if (typeof (wrapper as unknown as { querySelectorAll?: (s: string) => unknown }).querySelectorAll === 'function') {
    const rawFound = Array.from((wrapper as unknown as { querySelectorAll: (s: string) => unknown[] }).querySelectorAll('section'));
    // 过滤掉深层嵌套的 section，仅保留第一层 section
    pages = (rawFound as Element[]).filter((sec, _, arr) => {
      let p = (sec as unknown as { parentElement?: Element }).parentElement;
      while (p && p !== wrapper) {
        if (arr.includes(p)) return false;
        p = (p as unknown as { parentElement?: Element }).parentElement;
      }
      return true;
    });
  }

  // 若无 section（例如流式阅读模式直接渲染在 wrapper 中），以 wrapper 为处理目标
  const targets = pages.length > 0 ? pages : [wrapper as unknown as Element];

  for (const page of targets) {
    const article = (page as unknown as { querySelector?: (sel: string) => Element | null })
      .querySelector?.('article') || page;
    const body: Element[] = safeGetChildren(article);

    for (const node of body) {
      if (isIgnoredNode(node)) continue;
      const result = nodeToMarkdown(node);
      if (result.trim()) {
        lines.push(result.trim());
      }
    }
  }

  return normalizeMarkdownOutput(lines);
}

/** 安全获取子元素数组（兼容真实 DOM NodeList 与测试 Mock 数组） */
function safeGetChildren(el: Element): Element[] {
  if (!el || typeof el !== 'object') return [];
  const node = el as unknown as { children?: unknown; childNodes?: unknown };
  if (node.children) {
    if (Array.isArray(node.children)) return node.children as Element[];
    if (typeof (node.children as { length?: number }).length === 'number') {
      return Array.from(node.children as ArrayLike<Element>);
    }
  }
  if (node.childNodes) {
    const raw = Array.isArray(node.childNodes)
      ? node.childNodes
      : Array.from(node.childNodes as ArrayLike<unknown>);
    return raw.filter(c => (c as { nodeType?: number }).nodeType === 1) as Element[];
  }
  return [];
}

/** 安全获取所有子节点数组（包含文本节点和元素节点） */
function safeGetChildNodes(el: Element): Array<Element | Text | unknown> {
  if (!el || typeof el !== 'object') return [];
  const node = el as unknown as { childNodes?: unknown; children?: unknown };
  if (node.childNodes) {
    if (Array.isArray(node.childNodes)) return node.childNodes;
    if (typeof (node.childNodes as { length?: number }).length === 'number') {
      return Array.from(node.childNodes as ArrayLike<unknown>);
    }
  }
  if (node.children) {
    if (Array.isArray(node.children)) return node.children as Element[];
    if (typeof (node.children as { length?: number }).length === 'number') {
      return Array.from(node.children as ArrayLike<Element>);
    }
  }
  return [];
}

/** 是否为需要从正文中忽略的冗余节点（如重复页眉页脚、分页隔离符等） */
function isIgnoredNode(node: Element): boolean {
  const tag = node.tagName?.toLowerCase() || '';
  if (tag === 'header' || tag === 'footer') return true;
  const className = String((node as unknown as { className?: unknown }).className || '');
  if (/\b(docx-header|docx-footer|docx-page-number|docx_page_break)\b/i.test(className)) {
    return true;
  }
  return false;
}

/**
 * 将单个块级元素转译为 Markdown 文本
 */
function nodeToMarkdown(node: Element): string {
  const tag = node.tagName?.toLowerCase() || '';

  // 1. 标题识别：支持标准 h1~h6 以及 docx-preview 特有的 heading 类名或特征段落
  const headingLevel = detectHeadingLevel(node);
  if (headingLevel !== null) {
    const text = inlineToMarkdown(node).trim();
    if (!text) return '';
    return `${'#'.repeat(headingLevel)} ${text}`;
  }

  // 2. 列表项识别：支持标准 ul/ol/li 以及 docx-preview 特有的 -num- 段落
  const listInfo = detectListItem(node);
  if (listInfo.isList) {
    const text = extractListText(node);
    if (!text) return '';
    const indent = '  '.repeat(listInfo.level);
    const prefix = listInfo.isOrdered ? `${listInfo.index || 1}.` : '-';
    return `${indent}${prefix} ${text}`;
  }

  switch (tag) {
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
      return standardListToMarkdown(node, tag === 'ol');

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

/**
 * 智能探测标题级别 (1~6)，若非标题返回 null
 */
function detectHeadingLevel(el: Element): number | null {
  const tag = el.tagName?.toLowerCase() || '';
  if (/^h[1-6]$/.test(tag)) {
    return parseInt(tag[1], 10);
  }

  const className = String((el as unknown as { className?: unknown }).className || '');
  
  // 匹配常见 docx-preview 类名，例如 docx_heading_1, heading-2, docx-p-heading-3
  const match = className.match(/heading[-_ ]?([1-6])/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  if (/\b(title|docx_title)\b/i.test(className)) return 1;
  if (/\b(subtitle|docx_subtitle)\b/i.test(className)) return 2;

  // 启发式检测：无 heading 类名的加粗大标题特征段落
  if (tag === 'p') {
    const rawText = (el.textContent || '').trim();
    if (rawText.length > 0 && rawText.length <= 70) {
      const style = getElementStyle(el);
      const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight || '400', 10) >= 600;
      if (isBold) {
        if (/^第[一二三四五六七八九十0-9]+[章节卷篇]/.test(rawText) || /^[一二三四五六七八九十]+[、.]/.test(rawText)) {
          return 1;
        }
        if (/^[0-9]+[、.．\s]/.test(rawText)) {
          return 2;
        }
        if (/^[0-9]+\.[0-9]+/.test(rawText)) {
          return 3;
        }
      }
    }
  }

  return null;
}

/**
 * 智能探测列表项与编号特征
 */
function detectListItem(el: Element): { isList: boolean; isOrdered: boolean; level: number; index?: number } {
  const tag = el.tagName?.toLowerCase() || '';
  if (tag === 'li') {
    return { isList: true, isOrdered: false, level: 0 };
  }

  const className = String((el as unknown as { className?: unknown }).className || '');
  
  // docx-preview 编号类名格式：`${this.className}-num-${id}-${lvl}`
  const numMatch = className.match(/-num-(\d+)-(\d+)/i);
  if (numMatch) {
    const level = parseInt(numMatch[2], 10) || 0;
    // 检查内容是否带有有序编号前缀，如 "1.", "(1)"
    const txt = (el.textContent || '').trim();
    const ordered = /^\s*(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[\.、\)]\s*/.test(txt);
    const indexMatch = txt.match(/^\s*(\d+)[\.、\)]/);
    const index = indexMatch ? parseInt(indexMatch[1], 10) : undefined;
    return { isList: true, isOrdered: ordered, level, index };
  }

  // 匹配段落首部的项目符号或数字序号
  if (tag === 'p') {
    const txt = (el.textContent || '').trim();
    const unorderedMatch = /^\s*([•◦▪*+—–-]|[\u2022\u25E6\u25AA])\s+/.test(txt);
    if (unorderedMatch) {
      return { isList: true, isOrdered: false, level: 0 };
    }
    const orderedMatch = txt.match(/^\s*(\d+)[\.、\)]\s+/);
    if (orderedMatch) {
      return { isList: true, isOrdered: true, level: 0, index: parseInt(orderedMatch[1], 10) };
    }
  }

  return { isList: false, isOrdered: false, level: 0 };
}

/** 剥除已转为 Markdown 语法的原生列表符号前缀 */
function extractListText(el: Element): string {
  let md = inlineToMarkdown(el).trim();
  // 剥除行首多余的 bullet 符号或数字序号
  md = md.replace(/^\s*([•◦▪*+—–-]|[\u2022\u25E6\u25AA]|\d+[\.、\)])\s*/, '').trim();
  return md;
}

/**
 * 递归转换内联文本（支持 span 内联样式加粗/斜体/删除线/代码及标准标签）
 */
function inlineToMarkdown(el: Element | Text | unknown): string {
  if (!el || typeof el !== 'object') return '';

  // 纯文本节点处理 (nodeType === 3)
  const nodeType = (el as { nodeType?: number }).nodeType;
  if (nodeType === 3) {
    return escapeMdText((el as Text).textContent || '');
  }

  const nodeEl = el as Element;
  const tag = nodeEl.tagName?.toLowerCase() || '';

  // 针对标签名的基础处理
  switch (tag) {
    case 'strong':
    case 'b':
      return wrapMd(inlineChildrenToMd(nodeEl), '**');

    case 'em':
    case 'i':
      return wrapMd(inlineChildrenToMd(nodeEl), '*');

    case 's':
    case 'del':
    case 'strike':
      return wrapMd(inlineChildrenToMd(nodeEl), '~~');

    case 'code':
      return wrapMd((nodeEl.textContent || '').trim(), '`');

    case 'a': {
      const href = nodeEl.getAttribute?.('href') || '';
      const text = inlineChildrenToMd(nodeEl).trim();
      if (!href || href === '#') return text;
      return `[${text || href}](${href})`;
    }

    case 'br':
      return '\n';

    case 'img': {
      const src = nodeEl.getAttribute?.('src') || '';
      if (!src) return '';
      const alt = nodeEl.getAttribute?.('alt') || '';
      return `![${alt}](${src})`;
    }

    case 'sup': {
      const text = inlineChildrenToMd(nodeEl).trim();
      return text ? `<sup>${text}</sup>` : '';
    }

    case 'sub': {
      const text = inlineChildrenToMd(nodeEl).trim();
      return text ? `<sub>${text}</sub>` : '';
    }

    default: {
      // 检查 docx-preview 广泛采用的 span 内联样式 (fontWeight / fontStyle / textDecoration / fontFamily)
      const text = inlineChildrenToMd(nodeEl);
      if (!text) return '';

      const style = getElementStyle(nodeEl);
      let formatted = text;

      const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight || '400', 10) >= 600;
      const isItalic = style.fontStyle === 'italic';
      const isStrike = style.textDecoration?.includes('line-through');
      const isMonospace = /\b(monospace|consolas|courier)\b/i.test(style.fontFamily || '');

      if (isMonospace && !formatted.includes('`')) {
        formatted = `\`${formatted.trim()}\``;
      }
      if (isBold) {
        formatted = wrapMd(formatted, '**');
      }
      if (isItalic) {
        formatted = wrapMd(formatted, '*');
      }
      if (isStrike) {
        formatted = wrapMd(formatted, '~~');
      }

      return formatted;
    }
  }
}

/** 包装非空 Markdown 标记，避免出现 **** 或 ~~ 空内容 */
function wrapMd(text: string, marker: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return `${marker}${trimmed}${marker}`;
}

/** 递归遍历子节点输出内联文本 */
function inlineChildrenToMd(el: Element): string {
  let result = '';
  const children = safeGetChildNodes(el);

  if (children.length === 0) {
    const tc = (el as unknown as { textContent?: string }).textContent;
    return tc ? escapeMdText(tc) : '';
  }

  for (const child of children) {
    if (typeof child === 'string') {
      result += escapeMdText(child);
    } else {
      const c = child as { nodeType?: number; tagName?: string; textContent?: string };
      if (c.nodeType === 3) {
        result += escapeMdText(c.textContent || '');
      } else if (c.tagName || c.nodeType === 1) {
        result += inlineToMarkdown(child as unknown as Element);
      }
    }
  }
  return result;
}

/** 获取元素的内联样式对象（支持真实 DOM 与 Mock） */
function getElementStyle(el: Element): { fontWeight?: string; fontStyle?: string; textDecoration?: string; fontFamily?: string } {
  if (!el || typeof el !== 'object') return {};
  const e = el as unknown as { style?: Record<string, string>; getAttribute?: (name: string) => string | null };
  const styleObj: Record<string, string> = {};

  if (e.style && typeof e.style === 'object') {
    Object.assign(styleObj, e.style);
  }

  // 若支持 getAttribute('style')，补全解析
  const styleAttr = e.getAttribute?.('style');
  if (styleAttr && typeof styleAttr === 'string') {
    const parts = styleAttr.split(';');
    for (const part of parts) {
      const [k, v] = part.split(':').map(s => s?.trim());
      if (k && v) {
        const camelKey = k.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        styleObj[camelKey] = v;
      }
    }
  }

  return styleObj;
}

/** 标准 HTML ul/ol 列表递归转换 */
function standardListToMarkdown(listEl: Element, isOrdered: boolean): string {
  const items = Array.from(listEl.querySelectorAll(':scope > li'));
  const lines: string[] = [];

  let idx = 0;
  for (const item of items) {
    idx += 1;
    const prefix = isOrdered ? `${idx}.` : '-';
    const nestedLists = Array.from(item.querySelectorAll(':scope > ul, :scope > ol'));
    const textParts: string[] = [];
    const itemChildren = safeGetChildNodes(item);

    for (const child of itemChildren) {
      if (typeof child === 'string') {
        textParts.push(escapeMdText(child));
        continue;
      }
      const c = child as { nodeType?: number; tagName?: string; textContent?: string };
      if (c.tagName === 'UL' || c.tagName === 'OL') continue;
      if (c.nodeType === 3) {
        textParts.push(escapeMdText(c.textContent || ''));
      } else if (c.tagName || c.nodeType === 1) {
        textParts.push(inlineToMarkdown(child as unknown as Element));
      }
    }

    const text = textParts.join('').trim();
    lines.push(`${prefix} ${text}`);

    for (const nested of nestedLists) {
      const nestedMd = standardListToMarkdown(nested, nested.tagName === 'OL');
      const indented = nestedMd
        .split('\n')
        .map(l => l ? `  ${l}` : l)
        .join('\n');
      lines.push(indented);
    }
  }

  return lines.join('\n');
}

/** 表格转 Markdown */
function tableToMarkdown(tableEl: Element): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const allCells = rows.map(row =>
    Array.from(row.querySelectorAll('th, td')).map(cell => {
      // 提取单元格文本，替换表格专用的管道符和换行
      let text = inlineToMarkdown(cell).trim();
      text = text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
      return text;
    })
  );

  const colCount = Math.max(...allCells.map(r => r.length), 0);
  if (colCount === 0) return '';

  const firstRowHasTh = Array.from(rows[0].querySelectorAll('th')).length > 0;
  const header = firstRowHasTh ? allCells[0] : allCells[0];
  const body = firstRowHasTh ? allCells.slice(1) : allCells.slice(1);

  // 补齐列数
  const padCols = (arr: string[]) => {
    const copy = [...arr];
    while (copy.length < colCount) copy.push('');
    return copy;
  };

  const headerRow = '| ' + padCols(header).map(c => c || '').join(' | ') + ' |';
  const separatorRow = '| ' + Array(colCount).fill('---').join(' | ') + ' |';

  const lines = [headerRow, separatorRow];
  for (const row of body) {
    lines.push('| ' + padCols(row).map(c => c || '').join(' | ') + ' |');
  }

  return lines.join('\n');
}

/** 规范化多行输出与空行段落节奏 */
function normalizeMarkdownOutput(lines: string[]): string {
  const result: string[] = [];
  let prevIsListItem = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isCurrentListItem = /^\s*([*-]|\d+\.)\s+/.test(line);

    // 列表项之间紧凑排版，非列表项或标题段落之间保留空行
    if (i > 0) {
      if (!isCurrentListItem || !prevIsListItem) {
        result.push('');
      }
    }

    result.push(line);
    prevIsListItem = isCurrentListItem;
  }

  return result.join('\n').trimEnd() + '\n';
}

/** 转义 Markdown 保留字符 */
function escapeMdText(text: string): string {
  return text.replace(/\t/g, '  ');
}
