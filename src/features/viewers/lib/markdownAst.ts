/**
 * Markdown 核心 AST 与文本处理工具库
 */

export interface MarkdownHeading {
  level: number;
  text: string;
  index: number;
}

/** 大纲树节点：由扁平标题按 heading level 嵌套而成 */
export interface OutlineTreeNode {
  heading: MarkdownHeading;
  children: OutlineTreeNode[];
}

/**
 * 提取 Markdown 文本中的标题层级信息
 */
export function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  if (!content) return [];
  return content.split(/\r?\n/).flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    return match ? [{ level: match[1].length, text: match[2].replace(/[`*_]/g, ''), index }] : [];
  });
}

/**
 * 将扁平标题列表构建为树（同级/降级挂到最近的更浅层父节点下）
 */
export function buildOutlineTree(headings: MarkdownHeading[]): OutlineTreeNode[] {
  const roots: OutlineTreeNode[] = [];
  const stack: OutlineTreeNode[] = [];

  for (const heading of headings) {
    const node: OutlineTreeNode = { heading, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].heading.level >= heading.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

export interface VisibleOutlineRow {
  node: OutlineTreeNode;
  depth: number;
  hasChildren: boolean;
}

/**
 * 按折叠集合展开可见树行（collapsed 存放标题源码行 index）
 */
export function flattenVisibleOutlineTree(
  nodes: OutlineTreeNode[],
  collapsed: ReadonlySet<number>,
  depth = 0,
): VisibleOutlineRow[] {
  const rows: VisibleOutlineRow[] = [];
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    rows.push({ node, depth, hasChildren });
    if (hasChildren && !collapsed.has(node.heading.index)) {
      rows.push(...flattenVisibleOutlineTree(node.children, collapsed, depth + 1));
    }
  }
  return rows;
}

/**
 * 收集从根到目标标题的祖先标题 index（不含自身），用于自动展开当前章节路径
 */
export function collectOutlineAncestorIndexes(
  nodes: OutlineTreeNode[],
  targetIndex: number,
  trail: number[] = [],
): number[] | null {
  for (const node of nodes) {
    if (node.heading.index === targetIndex) {
      return trail;
    }
    const found = collectOutlineAncestorIndexes(node.children, targetIndex, [
      ...trail,
      node.heading.index,
    ]);
    if (found) return found;
  }
  return null;
}

/**
 * 根据当前活跃标题提取该章节完整的 Markdown 内容
 */
export function extractSectionContent(
  content: string,
  headings: MarkdownHeading[],
  activeHeadingIndex: number
): string {
  if (!content || headings.length === 0) return content;
  const currentHeading = headings[activeHeadingIndex] || headings[0];
  const lines = content.split(/\r?\n/);
  const startLine = currentHeading.index;
  let endLine = lines.length;

  for (let i = activeHeadingIndex + 1; i < headings.length; i++) {
    if (headings[i].level <= currentHeading.level) {
      endLine = headings[i].index;
      break;
    }
  }

  return lines.slice(startLine, endLine).join('\n');
}

/**
 * 构建自包含样式的单文件 HTML 导出模板
 */
export function buildExportHtml(documentTitle: string, renderedHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${documentTitle}</title>
  <style>
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.7; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #ffffff; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    blockquote { border-left: 4px solid #3b82f6; margin: 16px 0; padding: 8px 16px; background: #eff6ff; color: #1e40af; }
    img, svg { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  </style>
</head>
<body>
  ${renderedHtml}
</body>
</html>`;
}
