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

export interface BlockDeleteResult {
  /** 删除并完成空行归一化后的完整文档源码 */
  newFullContent: string;
  /** 被删除块的原始 Markdown 内容（用于一键撤销恢复） */
  deletedSlice: string;
  /** 实际删除的起始行号（1-indexed） */
  deletedStartLine: number;
  /** 实际删除的结束行号（1-indexed） */
  deletedEndLine: number;
}

export interface BlockDuplicateResult {
  /** 克隆后的完整文档源码 */
  newFullContent: string;
  /** 新克隆块的起始行号（1-indexed） */
  insertedStartLine: number;
  /** 新克隆块的结束行号（1-indexed） */
  insertedEndLine: number;
  /** 克隆的块源码 */
  clonedSlice: string;
}

export interface BlockInsertResult {
  /** 插入新块后的完整文档源码 */
  newFullContent: string;
  /** 新插入块的起始行号（1-indexed） */
  insertedStartLine: number;
  /** 新插入块的结束行号（1-indexed） */
  insertedEndLine: number;
}

export interface BlockMoveResult {
  /** 移动后的完整文档源码 */
  newFullContent: string;
  /** 移动后目标块的新起始行号（1-indexed） */
  newStartLine: number;
  /** 移动后目标块的新结束行号（1-indexed） */
  newEndLine: number;
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
 * 当行号因宏展开发生偏移或越界时，基于 fallbackRaw 内容指纹在原始文档行数组中自愈重定位真实行区间
 */
function locateFallbackInLines(
  lines: string[],
  fallbackRaw: string,
  hintLine?: number
): { startLine: number; endLine: number } | null {
  const cleanFallback = fallbackRaw.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  if (!cleanFallback.trim()) return null;

  const fbLines = cleanFallback.split('\n');
  const fbLen = fbLines.length;
  const totalLines = lines.length;
  const refLine =
    typeof hintLine === 'number' && !isNaN(hintLine) && hintLine > 0
      ? Math.min(hintLine, totalLines)
      : totalLines;

  const candidates: Array<{ startLine: number; endLine: number; dist: number }> = [];
  const openFenceRe = /^ {0,3}(?:`{3,}|~{3,}|\$\$)/;
  const closeFenceRe = /^ {0,3}(?:`{3,}|~{3,}|\$\$)\s*$/;

  for (let i = 0; i <= totalLines - fbLen; i++) {
    let match = true;
    for (let k = 0; k < fbLen; k++) {
      if (lines[i + k].trimEnd() !== fbLines[k].trimEnd()) {
        match = false;
        break;
      }
    }
    if (match) {
      if (
        i > 0 &&
        i + fbLen < totalLines &&
        openFenceRe.test(lines[i - 1]) &&
        closeFenceRe.test(lines[i + fbLen])
      ) {
        const sLine = i; // 1-indexed index of i-1
        const eLine = i + fbLen + 1; // 1-indexed index of i+fbLen
        candidates.push({
          startLine: sLine,
          endLine: eLine,
          dist: Math.abs(sLine - refLine),
        });
      } else {
        const sLine = i + 1;
        const eLine = i + fbLen;
        candidates.push({
          startLine: sLine,
          endLine: eLine,
          dist: Math.abs(sLine - refLine),
        });
      }
    }
  }

  // 单行公式 $$...$$ 容错定位
  if (candidates.length === 0 && fbLen === 1) {
    const trimmedFormula = fbLines[0].trim();
    if (trimmedFormula.length > 0) {
      for (let i = 0; i < totalLines; i++) {
        const line = lines[i].trim();
        if (line.startsWith('$$') && line.endsWith('$$') && line.includes(trimmedFormula)) {
          candidates.push({
            startLine: i + 1,
            endLine: i + 1,
            dist: Math.abs(i + 1 - refLine),
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return { startLine: candidates[0].startLine, endLine: candidates[0].endLine };
}

/**
 * 校验按行号切片出的 rawSlice 是否与 AST 块原始文本相符
 */
function isSliceConsistentWithFallback(rawSlice: string, fallbackRaw: string): boolean {
  const cleanFallback = fallbackRaw.replace(/\r\n/g, '\n').trim();
  if (!cleanFallback) return true;

  // 若 fallbackRaw 是预处理器生成的 HTML 包装（定义列表、脚注区、Wiki 嵌入卡片），源切片即为真实 Markdown
  if (
    /^<(?:dl\b[^>]*class="ov-deflist"|section\b[^>]*class="ov-footnotes"|aside\b[^>]*class="ov-wiki-embed")/i.test(
      cleanFallback
    )
  ) {
    return rawSlice.trim().length > 0;
  }

  const cleanSlice = rawSlice.replace(/\r\n/g, '\n').trim();
  if (!cleanSlice) return false;
  if (cleanSlice === cleanFallback) return true;

  // 外挂图表嵌入行 (![alt](file.ext) 或 ![[file.ext]])
  if (/^!?\[\[.+?\]\]|^!\[.*?\]\(.+?\)/.test(cleanSlice)) {
    return true;
  }

  const fbFirstLine = cleanFallback.split('\n')[0].trim();
  const sliceLines = cleanSlice.split('\n');
  const sliceFirstLine = sliceLines[0].trim();

  if (sliceFirstLine === fbFirstLine) return true;

  // 围栏代码块 / 图表块 / 数学公式块：slice 首行是 ```lang 或 $$，次行对应 fallback 首行
  if (/^ {0,3}(?:`{3,}|~{3,}|\$\$)/.test(sliceFirstLine)) {
    if (sliceLines.length > 1 && sliceLines[1].trim() === fbFirstLine) return true;
    if (cleanSlice.includes(fbFirstLine)) return true;
  }

  // 行内 WikiLink / Emoji / 脚注宏展开后的段落首行局部匹配
  const strippedFbFirst = fbFirstLine.replace(/<[^>]+>/g, '').trim();
  if (strippedFbFirst && cleanSlice.includes(strippedFbFirst.slice(0, Math.min(16, strippedFbFirst.length)))) {
    return true;
  }

  return false;
}

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
    const relocated = locateFallbackInLines(lines, fallbackRaw, startLine);
    if (relocated) {
      const sliceLines = lines.slice(relocated.startLine - 1, relocated.endLine);
      const rawSlice = sliceLines.join('\n');
      return {
        rawSlice,
        actualStartLine: relocated.startLine,
        actualEndLine: relocated.endLine,
        lineCount: sliceLines.length,
        charCount: rawSlice.length,
      };
    }

    const cleanFallback = fallbackRaw.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    const fbLines = cleanFallback ? cleanFallback.split('\n').length : 1;
    const safeFallbackStart =
      typeof startLine === 'number' && startLine > totalLines
        ? Math.max(1, totalLines - fbLines + 1)
        : 1;
    const safeFallbackEnd = Math.min(totalLines, safeFallbackStart + fbLines - 1);
    return {
      rawSlice: cleanFallback,
      actualStartLine: safeFallbackStart,
      actualEndLine: safeFallbackEnd,
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

  // 若提供了 fallbackRaw 且当前行区间切片与 fallbackRaw 不一致，自动执行指纹自愈重定位
  if (fallbackRaw && !isSliceConsistentWithFallback(rawSlice, fallbackRaw)) {
    const relocated = locateFallbackInLines(lines, fallbackRaw, clampedStart);
    if (relocated) {
      const relLines = lines.slice(relocated.startLine - 1, relocated.endLine);
      const relSlice = relLines.join('\n');
      return {
        rawSlice: relSlice,
        actualStartLine: relocated.startLine,
        actualEndLine: relocated.endLine,
        lineCount: relLines.length,
        charCount: relSlice.length,
      };
    }
  }

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
 * 删除指定行区间的 AST 块源码，并执行智能空行归一化：
 * - 自动消除因删除中间块而残留的连续双空行
 * - 删除首块时不留顶部前导空行，删除末块时不留尾部多余空行
 */
export function deleteBlockRawMarkdown(
  fullContent: string,
  actualStartLine: number,
  actualEndLine: number
): BlockDeleteResult {
  const normalizedFull = fullContent.replace(/\r\n/g, '\n');
  const lines = normalizedFull.split('\n');
  const totalLines = lines.length;

  const safeStart = Math.max(1, Math.min(actualStartLine, totalLines));
  const safeEnd = Math.max(safeStart, Math.min(actualEndLine, totalLines));

  // 先剥离 safeEnd 内部末尾可能包含的空行以获取纯净 deletedSlice
  let trimmedEnd = safeEnd;
  while (trimmedEnd > safeStart && lines[trimmedEnd - 1].trim() === '') {
    trimmedEnd -= 1;
  }
  const deletedSlice = lines.slice(safeStart - 1, trimmedEnd).join('\n');

  const rawBefore = lines.slice(0, safeStart - 1);
  const rawAfter = lines.slice(trimmedEnd);

  // 统计并清理接合处的空行，避免留下连续多个空行或首尾孤立空行
  let beforeEndIdx = rawBefore.length;
  while (beforeEndIdx > 0 && rawBefore[beforeEndIdx - 1].trim() === '') {
    beforeEndIdx -= 1;
  }
  const cleanBefore = rawBefore.slice(0, beforeEndIdx);
  const hadBlankBefore = beforeEndIdx < rawBefore.length;

  let afterStartIdx = 0;
  while (afterStartIdx < rawAfter.length && rawAfter[afterStartIdx].trim() === '') {
    afterStartIdx += 1;
  }
  const cleanAfter = rawAfter.slice(afterStartIdx);
  const hadBlankAfter = afterStartIdx > 0;

  let mergedLines: string[];
  if (cleanBefore.length === 0) {
    mergedLines = cleanAfter;
  } else if (cleanAfter.length === 0) {
    mergedLines = cleanBefore;
  } else if (hadBlankBefore || hadBlankAfter) {
    mergedLines = [...cleanBefore, '', ...cleanAfter];
  } else {
    mergedLines = [...cleanBefore, ...cleanAfter];
  }

  return {
    newFullContent: mergedLines.join('\n'),
    deletedSlice,
    deletedStartLine: safeStart,
    deletedEndLine: trimmedEnd,
  };
}

/**
 * 在当前块正下方原地克隆副本（保持标准单空行分隔）
 */
export function duplicateBlockRawMarkdown(
  fullContent: string,
  actualStartLine: number,
  actualEndLine: number
): BlockDuplicateResult {
  const slice = extractBlockRawMarkdown(fullContent, actualStartLine, actualEndLine);
  const normalizedFull = fullContent.replace(/\r\n/g, '\n');
  const lines = normalizedFull.split('\n');

  const safeStart = slice.actualStartLine;
  const safeEnd = slice.actualEndLine;
  const cloneLines = slice.rawSlice.split('\n');

  const updatedLines = [
    ...lines.slice(0, safeEnd),
    '',
    ...cloneLines,
    ...lines.slice(safeEnd),
  ];

  const insertedStartLine = safeEnd + 2;
  const insertedEndLine = insertedStartLine + cloneLines.length - 1;

  return {
    newFullContent: updatedLines.join('\n'),
    insertedStartLine,
    insertedEndLine,
    clonedSlice: slice.rawSlice,
  };
}

/**
 * 在指定块的上方或下方插入新块源码，并返回新块的起止行号（便于立即进入专注编辑）
 */
export function insertAdjacentBlockRawMarkdown(
  fullContent: string,
  actualStartLine: number,
  actualEndLine: number,
  position: 'above' | 'below',
  templateMarkdown = ''
): BlockInsertResult {
  const slice = extractBlockRawMarkdown(fullContent, actualStartLine, actualEndLine);
  const normalizedFull = fullContent.replace(/\r\n/g, '\n');
  const lines = normalizedFull.split('\n');

  const safeStart = slice.actualStartLine;
  const safeEnd = slice.actualEndLine;
  const normalizedTemplate = templateMarkdown.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const templateLines = normalizedTemplate.split('\n');

  if (position === 'above') {
    const rawBefore = lines.slice(0, safeStart - 1);
    let beforeEndIdx = rawBefore.length;
    while (beforeEndIdx > 0 && rawBefore[beforeEndIdx - 1].trim() === '') {
      beforeEndIdx -= 1;
    }
    const cleanBefore = rawBefore.slice(0, beforeEndIdx);
    const fromCurrent = lines.slice(safeStart - 1);

    const prefixLines = cleanBefore.length > 0 ? [...cleanBefore, ''] : [];
    const insertedStartLine = prefixLines.length + 1;
    const insertedEndLine = insertedStartLine + templateLines.length - 1;

    const updatedLines = [...prefixLines, ...templateLines, '', ...fromCurrent];
    return {
      newFullContent: updatedLines.join('\n'),
      insertedStartLine,
      insertedEndLine,
    };
  }

  // position === 'below'
  const upToCurrent = lines.slice(0, safeEnd);
  const rawAfter = lines.slice(safeEnd);
  let afterStartIdx = 0;
  while (afterStartIdx < rawAfter.length && rawAfter[afterStartIdx].trim() === '') {
    afterStartIdx += 1;
  }
  const cleanAfter = rawAfter.slice(afterStartIdx);

  const insertedStartLine = safeEnd + 2;
  const insertedEndLine = insertedStartLine + templateLines.length - 1;

  const updatedLines =
    cleanAfter.length > 0
      ? [...upToCurrent, '', ...templateLines, '', ...cleanAfter]
      : [...upToCurrent, '', ...templateLines];

  return {
    newFullContent: updatedLines.join('\n'),
    insertedStartLine,
    insertedEndLine,
  };
}

/**
 * 将当前块与相邻的上一个块或下一个块交换位置（保持块间空行结构稳定）
 */
export function moveBlockRawMarkdown(
  fullContent: string,
  currentBlock: { startLine: number; endLine?: number; raw?: string },
  adjacentBlock: { startLine: number; endLine?: number; raw?: string }
): BlockMoveResult {
  const curSlice = extractBlockRawMarkdown(
    fullContent,
    currentBlock.startLine,
    currentBlock.endLine ?? currentBlock.startLine,
    currentBlock.raw || ''
  );
  const adjSlice = extractBlockRawMarkdown(
    fullContent,
    adjacentBlock.startLine,
    adjacentBlock.endLine ?? adjacentBlock.startLine,
    adjacentBlock.raw || ''
  );

  const normalizedFull = fullContent.replace(/\r\n/g, '\n');
  const lines = normalizedFull.split('\n');

  const isMovingUp = adjSlice.actualStartLine < curSlice.actualStartLine;
  const firstSlice = isMovingUp ? adjSlice : curSlice;
  const secondSlice = isMovingUp ? curSlice : adjSlice;

  // 若两块行区间重叠或异常则原样返回
  if (firstSlice.actualEndLine >= secondSlice.actualStartLine) {
    return {
      newFullContent: normalizedFull,
      newStartLine: curSlice.actualStartLine,
      newEndLine: curSlice.actualEndLine,
    };
  }

  const firstLines = lines.slice(firstSlice.actualStartLine - 1, firstSlice.actualEndLine);
  const middleLines = lines.slice(firstSlice.actualEndLine, secondSlice.actualStartLine - 1);
  const secondLines = lines.slice(secondSlice.actualStartLine - 1, secondSlice.actualEndLine);
  const separator = middleLines.length > 0 ? middleLines : [''];

  const updatedLines = [
    ...lines.slice(0, firstSlice.actualStartLine - 1),
    ...secondLines,
    ...separator,
    ...firstLines,
    ...lines.slice(secondSlice.actualEndLine),
  ];

  const newStartLine = isMovingUp
    ? firstSlice.actualStartLine
    : firstSlice.actualStartLine + secondLines.length + separator.length;
  const newEndLine = newStartLine + curSlice.lineCount - 1;

  return {
    newFullContent: updatedLines.join('\n'),
    newStartLine,
    newEndLine,
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
    if (/^>\s*\[!(?:GALLERY|IMAGES?|PHOTO-GRID)(?::[1-6]|\s+cols=[1-6])?\][+-]?/i.test(trimmed)) {
      return isZh ? 'Gallery 多图画廊网格' : 'Image Gallery Block';
    }
    if (/^>\s*\[!(?:FIGURE|FIG)\][+-]?/i.test(trimmed)) {
      return isZh ? 'Figure 标准技术图件框' : 'Figure Block';
    }
    if (/^>\s*\[!(?:MEDIA(?:[-:](?:RIGHT|LEFT))?)\][+-]?/i.test(trimmed)) {
      return isZh ? 'Media 图文并排分栏' : 'Media Split Block';
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
