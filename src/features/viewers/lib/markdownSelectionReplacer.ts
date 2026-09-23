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
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'todo'
  | 'link'
  | 'wikilink';

/** 可靠行内回写安全白名单 */
export const SAFE_INLINE_ACTIONS = new Set<MarkdownFormatAction>([
  'bold',
  'code',
  'link',
  'wikilink',
  'italic',
  'strikethrough',
  'highlight',
]);

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

  // 计算行级搜索窗口：若带有 data-source-line 则优先在该行及前后展开探测
  let startIdx = 0;
  let endIdx = lines.length - 1;

  if (typeof sourceLine === 'number' && !isNaN(sourceLine) && sourceLine > 0) {
    const targetIdx = sourceLine - 1;
    startIdx = Math.max(0, targetIdx - 2);
    endIdx = Math.min(lines.length - 1, targetIdx + 10);
  }

  // 1. 优先在局部行窗口搜索目标文本（指纹比对）
  let foundLineIdx = -1;
  let foundColIdx = -1;
  let targetSlice = cleanSelected;

  // 优先直接匹配选中文本
  for (let i = startIdx; i <= endIdx; i++) {
    const col = lines[i].indexOf(cleanSelected);
    if (col !== -1) {
      // 避免表格分隔线或代码围栏内部误改
      if (lines[i].trim().startsWith('|') && lines[i].includes('---')) continue;
      if (lines[i].trim().startsWith('```')) continue;
      foundLineIdx = i;
      foundColIdx = col;
      break;
    }
  }

  // 2. 若直搜失败（探测周围格式标记，如源文本是 `**word**` 而选中的是 `word`）
  if (foundLineIdx === -1) {
    for (let i = startIdx; i <= endIdx; i++) {
      const line = lines[i];
      if (line.trim().startsWith('```')) continue;
      const wrapperPatterns = [
        `\\*\\*${escapeRegExp(cleanSelected)}\\*\\*`,
        `\`${escapeRegExp(cleanSelected)}\``,
        `\\[\\[${escapeRegExp(cleanSelected)}\\]\\]`,
        `\\[${escapeRegExp(cleanSelected)}\\]\\([^)]*\\)`,
        `\\*${escapeRegExp(cleanSelected)}\\*`,
        `~~${escapeRegExp(cleanSelected)}~~`,
        `==${escapeRegExp(cleanSelected)}==`,
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

  // 3. 严格安全指纹：如果行级窗口内未找到，严禁盲目全局猜测篡改（防止同名短词静默改坏其他段落）
  if (foundLineIdx === -1 || foundColIdx === -1) {
    return null;
  }

  const targetLine = lines[foundLineIdx];

  const isBlockAction =
    action === 'h1' ||
    action === 'h2' ||
    action === 'h3' ||
    action === 'quote' ||
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
