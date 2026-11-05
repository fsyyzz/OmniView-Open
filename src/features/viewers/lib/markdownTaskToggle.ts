/**
 * OmniView Markdown 任务复选框原地即时勾选与源码回写引擎
 * 遵循 SRP 与不可变数据原则，提供毫秒级就地切分与模糊行容错匹配
 *
 * 作者: 周赞
 */

export interface TaskToggleResult {
  newContent: string;
  changed: boolean;
  actualLine: number;
  nextChecked: boolean;
}

export const TASK_PREFIX_REGEX = /^((\s*(?:>\s*)*)(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

/**
 * 原地切换 Markdown 源码中的任务复选框状态 ([ ] <-> [x])
 * @param rawContent 原始 Markdown 全文字符串
 * @param targetLine 目标所在行号 (1-based)
 * @param explicitChecked 可选强制指定新状态（true 为 [x]，false 为 [ ]）；未传则自动取反
 * @param hintText 可选的该任务项文本片段，用于在行号偏移时进行智能模糊定位
 */
export function toggleMarkdownTaskLine(
  rawContent: string,
  targetLine: number,
  explicitChecked?: boolean,
  hintText?: string
): TaskToggleResult {
  if (!rawContent || targetLine < 1) {
    return { newContent: rawContent, changed: false, actualLine: targetLine, nextChecked: false };
  }

  const lines = rawContent.split('\n');
  const clampedIdx = Math.min(lines.length - 1, Math.max(0, targetLine - 1));

  let matchedIdx = -1;

  // 1. 精准匹配目标行
  if (TASK_PREFIX_REGEX.test(lines[clampedIdx])) {
    matchedIdx = clampedIdx;
  } else {
    // 2. 邻域模糊搜索 (前后 ±15 行)，兼顾 Frontmatter 偏移或先前增删行
    const cleanHint = hintText ? hintText.trim().slice(0, 16) : '';
    const maxDelta = Math.min(15, lines.length);
    for (let delta = 1; delta <= maxDelta; delta++) {
      const candidates = [clampedIdx - delta, clampedIdx + delta];
      for (const idx of candidates) {
        if (idx >= 0 && idx < lines.length && TASK_PREFIX_REGEX.test(lines[idx])) {
          if (!cleanHint || lines[idx].includes(cleanHint)) {
            matchedIdx = idx;
            break;
          }
        }
      }
      if (matchedIdx !== -1) break;
    }
  }

  if (matchedIdx === -1) {
    return { newContent: rawContent, changed: false, actualLine: targetLine, nextChecked: false };
  }

  const currentLine = lines[matchedIdx];
  const match = currentLine.match(TASK_PREFIX_REGEX);
  if (!match) {
    return { newContent: rawContent, changed: false, actualLine: matchedIdx + 1, nextChecked: false };
  }

  const currentIsChecked = match[3].toLowerCase() === 'x';
  const nextChecked = explicitChecked !== undefined ? explicitChecked : !currentIsChecked;

  if (currentIsChecked === nextChecked) {
    return { newContent: rawContent, changed: false, actualLine: matchedIdx + 1, nextChecked };
  }

  const targetChar = nextChecked ? 'x' : ' ';
  const updatedLine = currentLine.replace(TASK_PREFIX_REGEX, `$1${targetChar}$4`);

  lines[matchedIdx] = updatedLine;
  return {
    newContent: lines.join('\n'),
    changed: true,
    actualLine: matchedIdx + 1,
    nextChecked,
  };
}
