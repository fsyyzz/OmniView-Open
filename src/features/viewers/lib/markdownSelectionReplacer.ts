/**
 * OmniView Markdown 预览区划选内容源映射与替换算法 (Selection-to-Source Replacer)
 * 
 * 功能职责：
 * 1. 结合 DOM 选区及所在的 `[data-source-line]` 起始行，在源 Markdown 中精确定位待格式化文本
 * 2. 避免误替换其他行的同名普通单词（基于上下文行窗口比对）
 * 3. 支持常见的轻量 Markdown 格式化（粗体、斜体、删除线、行内代码、高亮、超链接、WikiLink）
 * 4. 智能判断当前是否已带有格式，支持对已有格式进行 Toggle（反选/解构）
 */

export type MarkdownFormatAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'highlight'
  | 'link'
  | 'wikilink';

export interface SelectionFormatResult {
  newFullContent: string;
  formattedText: string;
  appliedAction: MarkdownFormatAction;
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

  if (action === 'wikilink') {
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]') && trimmed.length >= 4) {
      return { resultText: leadingSpace + trimmed.slice(2, -2) + trailingSpace, isToggledOff: true };
    }
    return { resultText: `${leadingSpace}[[${trimmed}]]${trailingSpace}`, isToggledOff: false };
  }

  if (action === 'link') {
    const linkMatch = trimmed.match(/^\[([\s\S]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      // 已经包含链接，剥离成纯文本
      return { resultText: leadingSpace + linkMatch[1] + trailingSpace, isToggledOff: true };
    }
    const url = linkUrl.trim() || 'https://';
    return { resultText: `${leadingSpace}[${trimmed}](${url})${trailingSpace}`, isToggledOff: false };
  }

  return { resultText: rawText, isToggledOff: false };
}

/**
 * 依据预览区选区信息与起始行号，在源 Markdown 内容中执行精准替换并返回新源码
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

  // 计算行级搜索窗口：若带有 data-source-line 则优先在该行及前后展开探测
  let startIdx = 0;
  let endIdx = lines.length - 1;

  if (typeof sourceLine === 'number' && !isNaN(sourceLine) && sourceLine > 0) {
    const targetIdx = sourceLine - 1;
    startIdx = Math.max(0, targetIdx - 2);
    endIdx = Math.min(lines.length - 1, targetIdx + 20); // 单个段落或列表通常不超过 20 行
  }

  // 1. 优先在局部行窗口搜索目标文本
  let foundLineIdx = -1;
  let foundColIdx = -1;
  let targetSlice = cleanSelected;

  // 优先直接匹配选中文本
  for (let i = startIdx; i <= endIdx; i++) {
    const col = lines[i].indexOf(cleanSelected);
    if (col !== -1) {
      foundLineIdx = i;
      foundColIdx = col;
      break;
    }
  }

  // 2. 若直搜失败（可能源文本已有格式标记，如源文本是 `**word**` 而选中的是 `word`）
  if (foundLineIdx === -1) {
    // 探测周围标记
    for (let i = startIdx; i <= endIdx; i++) {
      const line = lines[i];
      // 匹配 **selected**, *selected*, `selected`, ~~selected~~, ==selected==
      const wrapperPatterns = [
        `\\*\\*${escapeRegExp(cleanSelected)}\\*\\*`,
        `\\*${escapeRegExp(cleanSelected)}\\*`,
        `\`${escapeRegExp(cleanSelected)}\``,
        `~~${escapeRegExp(cleanSelected)}~~`,
        `==${escapeRegExp(cleanSelected)}==`,
        `\\[\\[${escapeRegExp(cleanSelected)}\\]\\]`,
        `\\[${escapeRegExp(cleanSelected)}\\]\\([^)]*\\)`,
      ];
      for (const pat of wrapperPatterns) {
        const reg = new RegExp(pat);
        const match = reg.exec(line);
        if (match) {
          foundLineIdx = i;
          foundColIdx = match.index;
          targetSlice = match[0];
          break;
        }
      }
      if (foundLineIdx !== -1) break;
    }
  }

  // 3. 若在行窗口仍未找到（极端情况下行号映射偏差），放宽至全局搜索首个匹配项
  if (foundLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const col = lines[i].indexOf(cleanSelected);
      if (col !== -1) {
        foundLineIdx = i;
        foundColIdx = col;
        break;
      }
    }
  }

  if (foundLineIdx === -1 || foundColIdx === -1) {
    return null;
  }

  // 执行文本转换
  const { resultText } = toggleFormatText(targetSlice, action, linkUrl);

  const targetLine = lines[foundLineIdx];
  const updatedLine =
    targetLine.slice(0, foundColIdx) + resultText + targetLine.slice(foundColIdx + targetSlice.length);

  lines[foundLineIdx] = updatedLine;
  const newFullContent = lines.join('\n');

  return {
    newFullContent,
    formattedText: resultText,
    appliedAction: action,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
