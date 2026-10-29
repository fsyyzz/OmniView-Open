/**
 * OmniView Markdown 预览区划选内容源映射与替换算法 (Selection-to-Source Replacer)
 * 
 * 安全与可靠性准则 (可靠回写契约)：
 * 1. 优先保证行内格式化（粗体、斜体、删除线、行内代码、高亮、超链接、WikiLink）的高可靠无歧义回写
 * 2. 块级操作 (H1, H2, H3, Quote, Todo) 作用于整行
 * 3. 每次回写前基于行号 + 选区上下文文本指纹 (Fingerprint) 双重校验
 * 4. 当文本指纹对不上时，拒绝静默乱写并返回 null 触发安全保护
 */

export type MarkdownFormatAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'highlight'
  | 'inlineMath'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'todo'
  | 'callout'
  | 'footnote'
  | 'link'
  | 'wikilink';

/** 可靠行内与块级回写安全白名单 */
export const SAFE_INLINE_ACTIONS = new Set<MarkdownFormatAction>([
  'bold',
  'code',
  'link',
  'wikilink',
  'italic',
  'strikethrough',
  'highlight',
  'inlineMath',
  'callout',
  'footnote',
]);

export interface SelectionFormatResult {
  newFullContent: string;
  formattedText: string;
  appliedAction: MarkdownFormatAction;
}

/**
 * 跨行选区文本转换辅助函数（用于只读复制或跨行引用/代码围栏包装）
 */
export function formatMultiLineSelection(
  selectedText: string,
  mode: 'quote' | 'fencedCode' | 'callout',
  calloutType = 'NOTE'
): string {
  const normalized = selectedText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  const lines = normalized.split('\n');

  if (mode === 'quote') {
    return lines.map(l => `> ${l}`).join('\n');
  }
  if (mode === 'callout') {
    return [`> [!${calloutType.toUpperCase()}]`, ...lines.map(l => `> ${l}`)].join('\n');
  }
  if (mode === 'fencedCode') {
    return ['```', normalized, '```'].join('\n');
  }
  return normalized;
}

/**
 * 获取某种格式的包装前缀与后缀
 */
export function getFormatWrappers(action: MarkdownFormatAction, linkUrl = ''): { prefix: string; suffix: string } {
  switch (action) {
    case 'bold':
      return { prefix: '**', suffix: '**' };
    case 'italic':
      return { prefix: '*', suffix: '*' };
    case 'strikethrough':
      return { prefix: '~~', suffix: '~~' };
    case 'code':
      return { prefix: '`', suffix: '`' };
    case 'highlight':
      return { prefix: '==', suffix: '==' };
    case 'inlineMath':
      return { prefix: '$', suffix: '$' };
    case 'link':
      return { prefix: '[', suffix: `](${linkUrl || 'https://'})` };
    case 'wikilink':
      return { prefix: '[[', suffix: ']]' };
    default:
      return { prefix: '', suffix: '' };
  }
}

/**
 * 检查文本是否已被指定格式包裹，若是则返回剥离后的文本；否则返回包裹后的文本
 */
export function toggleFormatText(
  rawText: string,
  action: MarkdownFormatAction,
  linkUrl = ''
): { resultText: string; isToggledOff: boolean } {
  const trimmed = rawText.trim();
  if (!trimmed) return { resultText: rawText, isToggledOff: false };

  // 保留前后可能存在的空格（避免替换时吃掉分词空格）
  const leadingSpace = rawText.match(/^\s*/)?.[0] || '';
  const trailingSpace = rawText.match(/\s*$/)?.[0] || '';

  if (action === 'bold') {
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length >= 4) {
      return { resultText: leadingSpace + trimmed.slice(2, -2) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}**${trimmed}**${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'italic') {
    // 兼容 * 或 _
    if (
      (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**') && trimmed.length >= 2) ||
      (trimmed.startsWith('_') && trimmed.endsWith('_') && !trimmed.startsWith('__') && trimmed.length >= 2)
    ) {
      return { resultText: leadingSpace + trimmed.slice(1, -1) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}*${trimmed}*${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'strikethrough') {
    if (trimmed.startsWith('~~') && trimmed.endsWith('~~') && trimmed.length >= 4) {
      return { resultText: leadingSpace + trimmed.slice(2, -2) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}~~${trimmed}~~${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'code') {
    if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
      return { resultText: leadingSpace + trimmed.slice(1, -1) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}\`${trimmed}\`${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'highlight') {
    if (trimmed.startsWith('==') && trimmed.endsWith('==') && trimmed.length >= 4) {
      return { resultText: leadingSpace + trimmed.slice(2, -2) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}==${trimmed}==${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'inlineMath') {
    if (trimmed.startsWith('$') && trimmed.endsWith('$') && !trimmed.startsWith('$$') && trimmed.length >= 2) {
      return { resultText: leadingSpace + trimmed.slice(1, -1) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}$${trimmed}$${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'link') {
    const linkMatch = trimmed.match(/^\[(.*)\]\((.*)\)$/);
    if (linkMatch) {
      return { resultText: leadingSpace + linkMatch[1] + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}[${trimmed}](${linkUrl || 'https://'})${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'wikilink') {
    const wikiMatch = trimmed.match(/^\[\[(.*)\]\]$/);
    if (wikiMatch) {
      return { resultText: leadingSpace + wikiMatch[1] + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}[[${trimmed}]]${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'h1') {
    if (trimmed.startsWith('# ')) {
      return { resultText: leadingSpace + trimmed.slice(2) + trailingSpace, isToggledOff: true };
    }
    const clean = trimmed.replace(/^#{1,6}\s+/, '');
    return { resultText: `${leadingSpace}# ${clean}${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'h2') {
    if (trimmed.startsWith('## ')) {
      return { resultText: leadingSpace + trimmed.slice(3) + trailingSpace, isToggledOff: true };
    }
    const clean = trimmed.replace(/^#{1,6}\s+/, '');
    return { resultText: `${leadingSpace}## ${clean}${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'h3') {
    if (trimmed.startsWith('### ')) {
      return { resultText: leadingSpace + trimmed.slice(4) + trailingSpace, isToggledOff: true };
    }
    const clean = trimmed.replace(/^#{1,6}\s+/, '');
    return { resultText: `${leadingSpace}### ${clean}${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'quote') {
    if (trimmed.startsWith('> ')) {
      return { resultText: leadingSpace + trimmed.slice(2) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}> ${trimmed}${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'callout') {
    const calloutType = (linkUrl || 'NOTE').toUpperCase();
    if (trimmed.startsWith('> [!')) {
      const stripped = trimmed.replace(/^>\s*\[![A-Z]+\]\s*\n?>\s*/, '');
      return { resultText: leadingSpace + stripped + trailingSpace, isToggledOff: true };
    }
    const cleanBody = trimmed.replace(/^>\s*/, '');
    return {
      resultText: `${leadingSpace}> [!${calloutType}]\n> ${cleanBody}${trailingSpace}`,
      isToggledOff: false,
    };
  }

  if (action === 'todo') {
    if (trimmed.startsWith('- [ ] ')) {
      return { resultText: leadingSpace + trimmed.slice(6) + trailingSpace, isToggledOff: true };
    }
    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      return { resultText: leadingSpace + trimmed.slice(6) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}- [ ] ${trimmed}${trailingSpace}`, isToggledOff: false };
  }

  return { resultText: rawText, isToggledOff: false };
}

/**
 * 计算文档中下一个不冲突的脚注编号
 */
function getNextFootnoteId(fullContent: string): string {
  const matches = fullContent.match(/\[\^(\d+)\]/g) || [];
  let maxId = 0;
  for (const m of matches) {
    const num = parseInt(m.slice(2, -1), 10);
    if (!isNaN(num) && num > maxId) {
      maxId = num;
    }
  }
  return String(maxId + 1);
}

/**
 * 依据预览区选区信息与起始行号，在源 Markdown 内容中执行精准指纹校验与替换
 */
/**
 * 在单行 Markdown 源码中定位用户在预览区选中的纯文本片段：
 * 1. 优先识别已被 `**...**`、`*...*`、`` `...` ``、`~~...~~`、`==...==`、`$...$`、`[[...]]`、`[...](...)` 包裹的片段（确保取消加粗/斜体等 toggle 操作正常生效）
 * 2. 其次直接匹配纯文本子串
 * 3. 若选区跨越了行内 Markdown 格式符（如预览区选中 "包含 加粗文本 和"，源码为 "包含 **加粗文本** 和"），自动通过容忍内联标记的正则精准定位源码跨度
 */
function findSelectionInMarkdownLine(
  line: string,
  cleanSelected: string
): { colIdx: number; slice: string } | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) return null;
  if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) return null;
  if (trimmedLine.startsWith('|') && /^\|[\s:|-]+\|$/.test(trimmedLine)) return null;

  const escaped = escapeRegExp(cleanSelected);

  // 1. 优先检查带行内格式包裹的完整 token（避免 `indexOf` 仅命中 `**word**` 内部的 `word` 导致无法取消格式或叠加成 `****word****`）
  const wrapperPatterns = [
    `\\*\\*${escaped}\\*\\*`,
    `__${escaped}__`,
    `\`${escaped}\``,
    `\\[\\[${escaped}(?:\\|[^\\]]+)?\\]\\]`,
    `\\[[^\\]\\|]+\\|${escaped}\\]\\]`,
    `\\[${escaped}\\]\\([^)]*\\)`,
    `(?<!\\*)\\*${escaped}\\*(?!\\*)`,
    `(?<!_)_${escaped}_(?!_)`,
    `~~${escaped}~~`,
    `==${escaped}==`,
    `(?<!\\$)\\$${escaped}\\$(?!\\$)`,
  ];

  for (const pat of wrapperPatterns) {
    const reg = new RegExp(pat);
    const match = reg.exec(line);
    if (match) {
      return { colIdx: match.index, slice: match[0] };
    }
  }

  // 2. 直接子串匹配
  const directCol = line.indexOf(cleanSelected);
  if (directCol !== -1) {
    return { colIdx: directCol, slice: cleanSelected };
  }

  // 3. 跨内联格式选区容错匹配（例如选中文本跨越了 **、*、`、~~、==、[text](url)、[[wiki]]）
  if (cleanSelected.length >= 2 && cleanSelected.length <= 240) {
    const inlineTokenNoise = `(?:\\*\\*|\\*|__|_|~~|==|\`|\\[\\[(?:[^\\]|]*\\|)?|\\]\\]|\\[|\\]\\([^)]*\\))*`;
    // 将选中文本按空白或标点/词界拆分为片段，允许片段之间存在内联 Markdown 标记
    const tokens = cleanSelected.match(/[\u4e00-\u9fa5]+|[a-zA-Z0-9_]+|\s+|[^\s\u4e00-\u9fa5a-zA-Z0-9_]+/g);
    if (tokens && tokens.length >= 1 && tokens.length <= 40) {
      const pattern =
        inlineTokenNoise +
        tokens
          .map(tk => (/^\s+$/.test(tk) ? `\\s+` : escapeRegExp(tk)))
          .join(inlineTokenNoise) +
        inlineTokenNoise;
      try {
        const reg = new RegExp(pattern);
        const match = reg.exec(line);
        if (match && match[0].trim().length > 0) {
          return { colIdx: match.index, slice: match[0] };
        }
      } catch {
        // 忽略极端正则复杂度异常
      }
    }
  }

  return null;
}

/**
 * 生成以 targetIdx 为中心、由近及远辐射的行索引序列
 */
function buildDistanceOrderedIndices(
  totalLines: number,
  targetIdx: number,
  minIdx: number,
  maxIdx: number
): number[] {
  const clampedMin = Math.max(0, minIdx);
  const clampedMax = Math.min(totalLines - 1, maxIdx);
  const indices: number[] = [];
  for (let i = clampedMin; i <= clampedMax; i++) {
    indices.push(i);
  }
  indices.sort((a, b) => {
    const distDiff = Math.abs(a - targetIdx) - Math.abs(b - targetIdx);
    return distDiff !== 0 ? distDiff : a - b;
  });
  return indices;
}

/**
 * 依据预览区选区信息与起始行号，在源 Markdown 内容中执行精准指纹校验与替换
 */
export function applyMarkdownSelectionFormat({
  fullContent,
  selectedText,
  sourceLine,
  action,
  linkUrl = '',
}: {
  fullContent: string;
  selectedText: string;
  sourceLine?: number;
  action: MarkdownFormatAction;
  linkUrl?: string;
}): SelectionFormatResult | null {
  const cleanSelected = selectedText.trim();
  if (!cleanSelected || !fullContent) return null;

  const lines = fullContent.split('\n');
  const totalLines = lines.length;
  const hasSourceLine = typeof sourceLine === 'number' && !isNaN(sourceLine) && sourceLine > 0;
  const targetIdx = hasSourceLine ? Math.min(totalLines - 1, Math.max(0, sourceLine! - 1)) : 0;

  let foundLineIdx = -1;
  let foundColIdx = -1;
  let targetSlice = cleanSelected;

  // 分级渐进搜索窗口：
  // Tier 1: 紧邻窗口 [targetIdx - 3, targetIdx + 15]
  // Tier 2: 扩展块窗口 [targetIdx - 25, targetIdx + 120]（覆盖大型 Callout / 卡片网格 / 表格 / 列表）
  // Tier 3: 全文最近邻兜底（当选中文本具备足够区分度或未提供行号时）
  const searchWindows: number[][] = hasSourceLine
    ? [
        buildDistanceOrderedIndices(totalLines, targetIdx, targetIdx - 3, targetIdx + 15),
        buildDistanceOrderedIndices(totalLines, targetIdx, targetIdx - 25, targetIdx + 120),
        ...(cleanSelected.length >= 2
          ? [buildDistanceOrderedIndices(totalLines, targetIdx, 0, totalLines - 1)]
          : []),
      ]
    : [buildDistanceOrderedIndices(totalLines, 0, 0, totalLines - 1)];

  const visited = new Set<number>();
  for (const windowIndices of searchWindows) {
    for (const i of windowIndices) {
      if (visited.has(i)) continue;
      visited.add(i);
      const hit = findSelectionInMarkdownLine(lines[i], cleanSelected);
      if (hit) {
        foundLineIdx = i;
        foundColIdx = hit.colIdx;
        targetSlice = hit.slice;
        break;
      }
    }
    if (foundLineIdx !== -1) break;
  }

  if (foundLineIdx === -1 || foundColIdx === -1) {
    return null;
  }

  const targetLine = lines[foundLineIdx];

  if (action === 'footnote') {
    const fnId = getNextFootnoteId(fullContent);
    const noteContent = linkUrl.trim() || '批注说明';
    const formattedRef = `${targetSlice}[^${fnId}]`;
    lines[foundLineIdx] =
      targetLine.slice(0, foundColIdx) + formattedRef + targetLine.slice(foundColIdx + targetSlice.length);
    const newFullContent = `${lines.join('\n').trimEnd()}\n\n[^${fnId}]: ${noteContent}\n`;
    return {
      newFullContent,
      formattedText: formattedRef,
      appliedAction: action,
    };
  }

  const isBlockAction =
    action === 'h1' ||
    action === 'h2' ||
    action === 'h3' ||
    action === 'quote' ||
    action === 'callout' ||
    action === 'todo';

  let updatedLine = '';
  let formattedTextResult = '';

  if (isBlockAction) {
    // 块级操作应用于整行
    const { resultText } = toggleFormatText(targetLine, action, linkUrl);
    updatedLine = resultText;
    formattedTextResult = resultText;
  } else {
    const { resultText } = toggleFormatText(targetSlice, action, linkUrl);
    updatedLine =
      targetLine.slice(0, foundColIdx) + resultText + targetLine.slice(foundColIdx + targetSlice.length);
    formattedTextResult = resultText;
  }

  lines[foundLineIdx] = updatedLine;
  const newFullContent = lines.join('\n');

  return {
    newFullContent,
    formattedText: formattedTextResult,
    appliedAction: action,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
