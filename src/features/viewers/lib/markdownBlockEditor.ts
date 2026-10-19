/**
 * OmniView Markdown 预览窗口“块级原地专注编辑” (Block In-place Focused Editor) 纯函数引擎
 *
 * 核心能力：
 * 1. 基于 AST 块行号区间 [startLine, endLine] 从原始 Markdown 中精准切片提取真实源码（规避 Math/WikiLink/Footnote 宏展开污染）
 * 2. 自动剥离块尾多余空行（保持块间空行隔离，防止回写后相邻段落粘连）
 * 3. 行区间无损回写替换与行号偏移量计算
 * 4. 块类型语义识别、编辑器内联语法快捷包装、根据源码行号反查所属 AST 块
 */

import type { Locale } from '../../../shared/lib/i18n';

export interface BlockSourceSlice {
  /** 提取出的块级纯净 Markdown 源码（不含块尾用于分隔下一块的空行） */
  rawSlice: string;
  /** 实际替换起始行号（1-indexed，包含） */
  actualStartLine: number;
  /** 实际替换结束行号（1-indexed，包含） */
  actualEndLine: number;
  /** 原始块总行数 */
  lineCount: number;
  /** 字符统计 */
  charCount: number;
}

export interface BlockReplaceResult {
  /** 替换后的完整文档源码 */
  newFullContent: string;
  /** 新块占用的行数 */
  newLineCount: number;
  /** 行数变化差值 (newLineCount - oldLineCount) */
  lineDelta: number;
}

export type BlockQuickSnippet =
  | 'bold'
  | 'italic'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'wikilink'
  | 'math'
  | 'callout'
  | 'task'
  | 'quote'
  | 'heading';

/**
 * 从原始文档中按行区间 [startLine, endLine] 精准提取块的真实 Markdown 源码
 * 自动剔除末尾被 Lexer 吞入的段落分隔空行，确保回写时不破坏上下文块间距
 */
export function extractBlockRawMarkdown(
  fullContent: string,
  startLine?: number,
  endLine?: number,
  fallbackRaw = ''
): BlockSourceSlice {
  const normalized = fullContent.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const totalLines = lines.length;

  if (
    typeof startLine !== 'number' ||
    isNaN(startLine) ||
    startLine < 1 ||
    startLine > totalLines
  ) {
    const cleanFallback = fallbackRaw.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    const fbLines = cleanFallback ? cleanFallback.split('\n').length : 1;
    return {
      rawSlice: cleanFallback,
      actualStartLine: 1,
      actualEndLine: fbLines,
      lineCount: fbLines,
      charCount: cleanFallback.length,
    };
  }

  const clampedStart = Math.max(1, Math.min(startLine, totalLines));
  const rawEnd =
    typeof endLine === 'number' && !isNaN(endLine) && endLine >= clampedStart
      ? Math.min(endLine, totalLines)
      : clampedStart;

  // 剥离块末尾因 marked.lexer 吞入的空行（至少保留 clampedStart 自身）
  let trimmedEnd = rawEnd;
  while (trimmedEnd > clampedStart && lines[trimmedEnd - 1].trim() === '') {
    trimmedEnd -= 1;
  }

  const sliceLines = lines.slice(clampedStart - 1, trimmedEnd);
  const rawSlice = sliceLines.join('\n');

  return {
    rawSlice,
    actualStartLine: clampedStart,
    actualEndLine: trimmedEnd,
    lineCount: sliceLines.length,
    charCount: rawSlice.length,
  };
}

/**
 * 将用户在局部专注编辑器中修改后的块源码，精准回写至完整文档的 [actualStartLine, actualEndLine]
 */
export function replaceBlockRawMarkdown(
  fullContent: string,
  actualStartLine: number,
  actualEndLine: number,
  newBlockContent: string
): BlockReplaceResult {
  const normalizedFull = fullContent.replace(/\r\n/g, '\n');
  const lines = normalizedFull.split('\n');
  const totalLines = lines.length;

  const safeStart = Math.max(1, Math.min(actualStartLine, totalLines));
  const safeEnd = Math.max(safeStart, Math.min(actualEndLine, totalLines));
  const oldLineCount = safeEnd - safeStart + 1;

  // 清除末尾多余换行，防止意外冲掉或叠加空行（保留用户显式输入的内部空行）
  const normalizedBlock = newBlockContent.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const replacementLines = normalizedBlock.split('\n');
  const newLineCount = replacementLines.length;

  const updatedLines = [
    ...lines.slice(0, safeStart - 1),
    ...replacementLines,
    ...lines.slice(safeEnd),
  ];

  return {
    newFullContent: updatedLines.join('\n'),
    newLineCount,
    lineDelta: newLineCount - oldLineCount,
  };
}

/**
 * 识别当前编辑块的语义类型名称（用于专注编辑器顶部状态标识）
 */
export function getBlockTypeLabel(
  blockType: string,
  lang?: string,
  rawSlice = '',
  locale: Locale = 'zh-CN'
): string {
  const isZh = locale === 'zh-CN';
  const trimmed = rawSlice.trimStart();

  if (blockType === 'html') {
    const headingMatch = trimmed.match(/^(#{1,6})\s+/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      return isZh ? `H${level} 章节标题` : `H${level} Heading`;
    }
    if (/^>\s*\[!(?:CARDS?|CARD-GRID|GRID)(?::[1-6]|\s+cols=[1-6])?\]/i.test(trimmed)) {
      return isZh ? 'Card 卡片矩阵网格' : 'Card Grid Block';
    }
    if (/^>\s*\[!CARD\]/i.test(trimmed)) {
      return isZh ? 'Card 独立卡片' : 'Single Card Block';
    }
    if (/^>\s*\[!(?:TABS?)(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Tabs 标签页组' : 'Tabs Group';
    }
    if (/^>\s*\[!(?:STEPS?)(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Steps 步骤条向导' : 'Steps Guide Block';
    }
    if (/^>\s*\[!TIMELINE(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Timeline 里程碑时间线' : 'Timeline Block';
    }
    if (/^>\s*\[!(?:COMPARE|DIFF)(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Compare 方案对比卡片' : 'Comparison Block';
    }
    if (/^>\s*\[!(?:METRICS?|STATS?|KPI)(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Metrics 指标看板' : 'Metrics KPI Block';
    }
    if (/^>\s*\[!FAQ(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'FAQ 问答手风琴' : 'FAQ Accordion Block';
    }
    if (/^>\s*\[!(?:QUOTES?|QUOTE-WALL)(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Quotes 名言引言墙' : 'Quotes Wall Block';
    }
    if (/^>\s*\[!(?:BANNER|HERO)(?:[+-]|\s+[^\]]*)?\]/i.test(trimmed)) {
      return isZh ? 'Banner 宣传横幅' : 'Banner Hero Block';
    }
    if (/^>\s*\[![a-zA-Z0-9_\-]+(?:[+-]|\s+[^\]]*)?\]/.test(trimmed)) {
      return isZh ? 'Callout 语义提示块' : 'Callout Block';
    }
    if (/^>\s?/.test(trimmed)) {
      return isZh ? '引用块' : 'Blockquote';
    }
    if (/^(\s*[-*+]|\s*\d+\.)\s+\[[ xX]\]/.test(trimmed)) {
      return isZh ? '待办任务列表' : 'Task List';
    }
    if (/^(\s*[-*+]|\s*\d+[.)])\s+/.test(trimmed)) {
      return isZh ? '列表块' : 'List Block';
    }
    if (/\n[~:]\s+/.test(trimmed)) {
      return isZh ? '定义列表' : 'Definition List';
    }
    return isZh ? '正文段落' : 'Paragraph';
  }

  switch (blockType) {
    case 'code':
      return isZh
        ? `代码块 (${(lang || 'text').toUpperCase()})`
        : `Code Block (${(lang || 'text').toUpperCase()})`;
    case 'table':
      return isZh ? 'Markdown 表格' : 'Markdown Table';
    case 'mermaid':
      return isZh ? 'Mermaid 图表源码' : 'Mermaid Diagram';
    case 'math':
      return isZh ? 'KaTeX 数学公式块' : 'KaTeX Math Block';
    case 'plantuml':
      return isZh ? 'PlantUML 图表源码' : 'PlantUML Diagram';
    case 'graphviz':
      return isZh ? 'Graphviz DOT 源码' : 'Graphviz DOT';
    case 'markmap':
      return isZh ? 'Markmap 思维导图' : 'Markmap Mindmap';
    case 'domainstory':
      return isZh ? '领域故事图源码' : 'Domain Story';
    case 'svg':
      return isZh ? 'SVG 矢量源码' : 'SVG Vector Code';
    case 'excalidraw':
      return isZh ? 'Excalidraw 画板数据' : 'Excalidraw Data';
    default:
      return isZh ? '文档块' : 'Document Block';
  }
}

/**
 * 在专注编辑器文本框内对当前光标/选区执行快捷 Markdown 语法插入或包裹
 */
export function applyEditorQuickSnippet(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: BlockQuickSnippet
): {
  nextText: string;
  nextSelectionStart: number;
  nextSelectionEnd: number;
} {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  const wrapInline = (prefix: string, suffix: string, placeholder: string) => {
    const inner = selected || placeholder;
    const inserted = `${prefix}${inner}${suffix}`;
    return {
      nextText: `${before}${inserted}${after}`,
      nextSelectionStart: start + prefix.length,
      nextSelectionEnd: start + prefix.length + inner.length,
    };
  };

  switch (snippet) {
    case 'bold':
      return wrapInline('**', '**', '粗体文本');
    case 'italic':
      return wrapInline('*', '*', '斜体文本');
    case 'code':
      return wrapInline('`', '`', 'code');
    case 'math':
      return selected.includes('\n')
        ? wrapInline('$$\n', '\n$$', 'E = mc^2')
        : wrapInline('$', '$', 'E = mc^2');
    case 'wikilink':
      return wrapInline('[[', ']]', '页面名称');
    case 'link': {
      const label = selected || '链接文字';
      const prefix = `[${label}](`;
      const urlPlaceholder = 'https://';
      const suffix = ')';
      return {
        nextText: `${before}${prefix}${urlPlaceholder}${suffix}${after}`,
        nextSelectionStart: start + prefix.length,
        nextSelectionEnd: start + prefix.length + urlPlaceholder.length,
      };
    }
    case 'codeblock':
      return wrapInline('```ts\n', '\n```', '// code');
    case 'heading': {
      // 在当前行首切换或添加 ###
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLinePrefix = text.slice(lineStart, start);
      const fullBeforeLine = text.slice(0, lineStart);
      const restFromLine = text.slice(lineStart);
      if (/^#{1,5}\s+/.test(restFromLine)) {
        return {
          nextText: `${fullBeforeLine}#${restFromLine}`,
          nextSelectionStart: start + 1,
          nextSelectionEnd: end + 1,
        };
      }
      if (/^#{6}\s+/.test(restFromLine)) {
        const stripped = restFromLine.replace(/^#{6}\s+/, '');
        const diff = restFromLine.length - stripped.length;
        return {
          nextText: `${fullBeforeLine}${stripped}`,
          nextSelectionStart: Math.max(lineStart, start - diff),
          nextSelectionEnd: Math.max(lineStart, end - diff),
        };
      }
      return {
        nextText: `${fullBeforeLine}### ${ currentLinePrefix ? restFromLine : (selected || '小节标题') + after.slice(selected ? 0 : 0) }`,
        nextSelectionStart: start + 4,
        nextSelectionEnd: end + 4,
      };
    }
    case 'quote': {
      const target = selected || '引用内容';
      const quoted = target
        .split('\n')
        .map(line => (line.startsWith('> ') ? line : `> ${line}`))
        .join('\n');
      return {
        nextText: `${before}${quoted}${after}`,
        nextSelectionStart: start,
        nextSelectionEnd: start + quoted.length,
      };
    }
    case 'callout': {
      const target = selected || '在这里输入提示说明';
      const body = target
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
      const block = `> [!NOTE]\n${body}`;
      return {
        nextText: `${before}${block}${after}`,
        nextSelectionStart: start + 10,
        nextSelectionEnd: start + block.length,
      };
    }
    case 'task': {
      const target = selected || '待办事项';
      const tasks = target
        .split('\n')
        .map(line => (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line) ? line : `- [ ] ${line}`))
        .join('\n');
      return {
        nextText: `${before}${tasks}${after}`,
        nextSelectionStart: start,
        nextSelectionEnd: start + tasks.length,
      };
    }
  }
}

/**
 * 根据源码行号反查对应的可编辑 AST 块
 */
export function findBlockBySourceLine<
  T extends { id: string; type: string; startLine?: number; endLine?: number }
>(blocks: T[], targetLine?: number): T | null {
  if (!targetLine || isNaN(targetLine) || targetLine < 1 || !blocks.length) {
    return null;
  }

  // 1. 精确区间命中
  for (const block of blocks) {
    if (block.type === 'pagebreak') continue;
    const start = block.startLine;
    const end = block.endLine ?? start;
    if (typeof start === 'number' && typeof end === 'number') {
      if (targetLine >= start && targetLine <= end) {
        return block;
      }
    }
  }

  // 2. 邻近块兜底（处理由于末尾空行回缩导致差 1 行的情况）
  let closest: T | null = null;
  let minDistance = Infinity;
  for (const block of blocks) {
    if (block.type === 'pagebreak' || typeof block.startLine !== 'number') continue;
    const end = block.endLine ?? block.startLine;
    const dist = Math.min(Math.abs(targetLine - block.startLine), Math.abs(targetLine - end));
    if (dist <= 2 && dist < minDistance) {
      minDistance = dist;
      closest = block;
    }
  }

  return closest;
}
