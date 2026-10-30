/**
 * OmniView Markdown AI 变更识别与「改前 / 改后」差异标注引擎
 *
 * 背景说明（为什么 Antigravity / Cursor 修改后看不到 <<<<<<< 标记却同时出现改前与改后）：
 * 1. Antigravity 与 Cursor 在执行 AI 内联修改 (Inline Diff / Chat Editing) 等待用户 Accept/Reject 时，
 *    不会向文档写入 `<<<<<<<` 冲突字符，而是直接把「改前（待删除行）」与「改后（新插入行）」同时拼接在
 *    同一个内存 TextDocument (`openDoc.getText()`) 中，在代码编辑器里依靠 Monaco Line Decoration
 *    动态染色为红底/绿底；若开启了自动保存 (`files.autoSave`)，拼接态缓冲区甚至可能被同步落盘。
 * 2. 本引擎通过联合比对：
 *    - `content`（当前编辑器内存态内容）
 *    - `diskContent`（磁盘物理文件内容）
 *    - `baseContent`（Git HEAD / AI 会话快照模型 `chat-editing-snapshot-text-model` / 初始打开基线）
 *    - 显式冲突标记（`<<<<<<< ... ======= ... >>>>>>>`）与 CriticMarkup（`{--...--}`, `{++...++}`, `{~~...~>...~~}`）
 *    自动识别出哪些段落属于「改前 (Before)」、哪些段落属于「改后 (After)」，并在渲染流水线中精准标注或按视图过滤。
 */

import type { AiDiffViewMode } from '../../../shared/types';

export interface MarkdownAiDiffOptions {
  content: string;
  baseContent?: string;
  diskContent?: string;
  mode?: AiDiffViewMode;
}

export interface MarkdownAiDiffResult {
  /** 注入 [!AI_BEFORE] / [!AI_AFTER] 或按模式过滤后的 Markdown 文本 */
  markdown: string;
  /** 输出 Markdown 每一行（0-based）对应的原文档（cleanBody）1-based 行号映射表 */
  lineMap: number[];
  /** 是否检测到 AI 改前/改后差异 */
  hasDiff: boolean;
  /** 改后（新增/修改后）区块数 */
  addedCount: number;
  /** 改前（删除/修改前）区块数 */
  removedCount: number;
  /** 差异来源类型描述 */
  diffSource: 'none' | 'conflict-markers' | 'critic-markup' | 'spliced-buffer' | 'baseline-diff';
  /** 当前 content 自身是否包含拼接态改前内容或冲突标记（支持一键清理采纳） */
  hasInBufferBeforeLines: boolean;
}

interface LineDiffOp {
  type: 'equal' | 'delete' | 'insert';
  line: string;
  /** 1-based line number in old text (for equal / delete) */
  oldLineNo?: number;
  /** 1-based line number in new text (for equal / insert) */
  newLineNo?: number;
}

interface TaggedLine {
  line: string;
  role: 'unchanged' | 'before' | 'after';
  /** 1-based line number in current `content` */
  sourceLine: number;
  /** True when reconstructed from `baseContent`/`diskContent` and not physically present in `content` */
  virtual?: boolean;
}

function normalizeLf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * 计算两个行数组的 LCS 差异序列（带首尾相同行快速收敛与大文件安全阈值）
 */
export function computeLineDiff(oldLines: string[], newLines: string[]): LineDiffOp[] {
  const N = oldLines.length;
  const M = newLines.length;

  let start = 0;
  while (start < N && start < M && oldLines[start] === newLines[start]) {
    start++;
  }

  let endOld = N - 1;
  let endNew = M - 1;
  while (endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) {
    endOld--;
    endNew--;
  }

  const ops: LineDiffOp[] = [];

  for (let i = 0; i < start; i++) {
    ops.push({
      type: 'equal',
      line: newLines[i],
      oldLineNo: i + 1,
      newLineNo: i + 1,
    });
  }

  const midOldLen = endOld - start + 1;
  const midNewLen = endNew - start + 1;

  if (midOldLen > 0 && midNewLen > 0) {
    // 防止极大文档阻塞主线程：若中间差异窗口超过 2500x2500，采用基于行哈希锚点的分块或直接替换
    if (midOldLen * midNewLen <= 4_000_000) {
      const cols = midNewLen + 1;
      const dp = new Int32Array((midOldLen + 1) * cols);

      for (let i = midOldLen - 1; i >= 0; i--) {
        const oldLine = oldLines[start + i];
        const rowOffset = i * cols;
        const nextRowOffset = (i + 1) * cols;
        for (let j = midNewLen - 1; j >= 0; j--) {
          if (oldLine === newLines[start + j]) {
            dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
          } else {
            const down = dp[nextRowOffset + j];
            const right = dp[rowOffset + j + 1];
            dp[rowOffset + j] = down >= right ? down : right;
          }
        }
      }

      let i = 0;
      let j = 0;
      while (i < midOldLen && j < midNewLen) {
        if (oldLines[start + i] === newLines[start + j]) {
          ops.push({
            type: 'equal',
            line: newLines[start + j],
            oldLineNo: start + i + 1,
            newLineNo: start + j + 1,
          });
          i++;
          j++;
        } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
          ops.push({
            type: 'delete',
            line: oldLines[start + i],
            oldLineNo: start + i + 1,
          });
          i++;
        } else {
          ops.push({
            type: 'insert',
            line: newLines[start + j],
            newLineNo: start + j + 1,
          });
          j++;
        }
      }
      while (i < midOldLen) {
        ops.push({
          type: 'delete',
          line: oldLines[start + i],
          oldLineNo: start + i + 1,
        });
        i++;
      }
      while (j < midNewLen) {
        ops.push({
          type: 'insert',
          line: newLines[start + j],
          newLineNo: start + j + 1,
        });
        j++;
      }
    } else {
      for (let i = 0; i < midOldLen; i++) {
        ops.push({
          type: 'delete',
          line: oldLines[start + i],
          oldLineNo: start + i + 1,
        });
      }
      for (let j = 0; j < midNewLen; j++) {
        ops.push({
          type: 'insert',
          line: newLines[start + j],
          newLineNo: start + j + 1,
        });
      }
    }
  } else if (midOldLen > 0) {
    for (let i = 0; i < midOldLen; i++) {
      ops.push({
        type: 'delete',
        line: oldLines[start + i],
        oldLineNo: start + i + 1,
      });
    }
  } else if (midNewLen > 0) {
    for (let j = 0; j < midNewLen; j++) {
      ops.push({
        type: 'insert',
        line: newLines[start + j],
        newLineNo: start + j + 1,
      });
    }
  }

  const tailCount = N - 1 - endOld;
  for (let k = 1; k <= tailCount; k++) {
    ops.push({
      type: 'equal',
      line: newLines[endNew + k],
      oldLineNo: endOld + k + 1,
      newLineNo: endNew + k + 1,
    });
  }

  return ops;
}

/**
 * 计算两段文本的字符二元语法 (Bigram) 相似度 (0 ~ 1)
 */
function computeBigramSimilarity(a: string, b: string): number {
  const cleanA = a.replace(/\s+/g, '').trim();
  const cleanB = b.replace(/\s+/g, '').trim();
  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 1;
  if (cleanA.length < 2 || cleanB.length < 2) {
    return cleanA[0] === cleanB[0] ? 0.5 : 0;
  }

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < cleanA.length - 1; i++) {
    const bg = cleanA.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < cleanB.length - 1; i++) {
    const bg = cleanB.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      intersection++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (cleanA.length - 1 + cleanB.length - 1);
}

/**
 * 判断两个相邻 Markdown 块是否为 Antigravity / Cursor 内联 Diff 拼接产生的一对「改前 vs 改后」块
 */
function areBlocksCounterparts(blockA: string[], blockB: string[], directlyTouching: boolean): boolean {
  const nonEmptyA = blockA.map(l => l.trim()).filter(Boolean);
  const nonEmptyB = blockB.map(l => l.trim()).filter(Boolean);
  if (nonEmptyA.length === 0 || nonEmptyB.length === 0) return false;

  const firstA = nonEmptyA[0];
  const firstB = nonEmptyB[0];

  // 1. 同级标题行替换 (例如 `## 架构设计` vs `## 全新架构设计`)
  const headingMatchA = firstA.match(/^(#{1,6})\s+/);
  const headingMatchB = firstB.match(/^(#{1,6})\s+/);
  if (headingMatchA && headingMatchB && headingMatchA[1].length === headingMatchB[1].length) {
    if (nonEmptyA.length === 1 && nonEmptyB.length === 1) {
      return true;
    }
    const sim = computeBigramSimilarity(nonEmptyA.join('\n'), nonEmptyB.join('\n'));
    if (sim >= 0.15) return true;
  }

  // 2. 均为 Markdown 表格块
  const isTableA = nonEmptyA.every(l => l.startsWith('|') || l.includes('|'));
  const isTableB = nonEmptyB.every(l => l.startsWith('|') || l.includes('|'));
  if (isTableA && isTableB && nonEmptyA.length >= 2 && nonEmptyB.length >= 2) {
    return true;
  }

  // 3. 均为代码块且语言标识相同
  const fenceA = firstA.match(/^(`{3,}|~{3,})([a-zA-Z0-9_-]*)/);
  const fenceB = firstB.match(/^(`{3,}|~{3,})([a-zA-Z0-9_-]*)/);
  if (fenceA && fenceB && fenceA[2].toLowerCase() === fenceB[2].toLowerCase()) {
    return true;
  }

  // 4. 在源码中无空行直接紧贴拼接（Markdown 正常段落之间必有空行，内联 Diff 拼接常把改前与改后紧贴放置）
  const sim = computeBigramSimilarity(nonEmptyA.join('\n'), nonEmptyB.join('\n'));
  if (directlyTouching && sim >= 0.12) {
    return true;
  }

  // 5. 文本具有明显演化相似度（同一段落/列表项被 AI 润色或改写）
  if (sim >= 0.22) {
    return true;
  }

  return false;
}

/**
 * 解析显式冲突标记 (<<<<<<< ... ======= ... >>>>>>>)
 * 自动跳过代码块内部的示例冲突标记
 */
function parseExplicitConflictMarkers(lines: string[]): TaggedLine[] | null {
  let hasConflict = false;
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
        fenceLen = len;
      } else if (ch === fenceChar && len >= fenceLen) {
        inFence = false;
      }
      continue;
    }
    if (!inFence && /^<{7}(?:\s|$)/.test(lines[i])) {
      hasConflict = true;
      break;
    }
  }

  if (!hasConflict) return null;

  const result: TaggedLine[] = [];
  inFence = false;
  let state: 'normal' | 'in-before' | 'in-after' = 'normal';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const trimmed = line.trimStart();

    if (state === 'normal') {
      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceMatch) {
        const ch = fenceMatch[1][0];
        const len = fenceMatch[1].length;
        if (!inFence) {
          inFence = true;
          fenceChar = ch;
          fenceLen = len;
        } else if (ch === fenceChar && len >= fenceLen) {
          inFence = false;
        }
      }
    }

    if (!inFence) {
      if (state === 'normal' && /^<{7}(?:\s|$)/.test(line)) {
        state = 'in-before';
        continue;
      }
      if (state === 'in-before' && /^={7}(?:\s|$)/.test(line)) {
        state = 'in-after';
        continue;
      }
      if (state === 'in-after' && /^>{7}(?:\s|$)/.test(line)) {
        state = 'normal';
        continue;
      }
    }

    result.push({
      line,
      role: state === 'in-before' ? 'before' : state === 'in-after' ? 'after' : 'unchanged',
      sourceLine: lineNo,
    });
  }

  return result;
}

/**
 * 处理内联 CriticMarkup 语法：
 * - {--删除内容--}
 * - {++新增内容++}
 * - {~~改前内容~>改后内容~~}
 */
function applyCriticMarkupTransform(
  markdown: string,
  mode: AiDiffViewMode
): { markdown: string; hasCritic: boolean; added: number; removed: number } {
  if (!/\{\-\-[\s\S]*?\-\-\}|\{\+\+[\s\S]*?\+\+\}|\{\~\~[\s\S]*?\~\>[\s\S]*?\~\~\}/.test(markdown)) {
    return { markdown, hasCritic: false, added: 0, removed: 0 };
  }

  let added = 0;
  let removed = 0;

  // 替换 {~~old~>new~~}
  let out = markdown.replace(/\{\~\~([^\n]*?)\~\>([^\n]*?)\~\~\}/g, (_m, beforeText, afterText) => {
    added++;
    removed++;
    if (mode === 'after') return afterText;
    if (mode === 'before') return beforeText;
    return `<del class="ov-critic-del" title="改前 (Before)">${beforeText}</del><ins class="ov-critic-ins" title="改后 (After)">${afterText}</ins>`;
  });

  // 替换 {--deleted--}
  out = out.replace(/\{\-\-([^\n]*?)\-\-\}/g, (_m, beforeText) => {
    removed++;
    if (mode === 'after') return '';
    if (mode === 'before') return beforeText;
    return `<del class="ov-critic-del" title="改前 (Before)">${beforeText}</del>`;
  });

  // 替换 {++inserted++}
  out = out.replace(/\{\+\+([^\n]*?)\+\+\}/g, (_m, afterText) => {
    added++;
    if (mode === 'after') return afterText;
    if (mode === 'before') return '';
    return `<ins class="ov-critic-ins" title="改后 (After)">${afterText}</ins>`;
  });

  return {
    markdown: out,
    hasCritic: added > 0 || removed > 0,
    added,
    removed,
  };
}

/**
 * 在已知「某一段行是拼接插入行」的情况下，在原数组中标记对应的结对块
 */
function markSplicedCounterparts(
  tagged: TaggedLine[],
  insertedRole: 'before' | 'after'
): void {
  const counterpartRole: 'before' | 'after' = insertedRole === 'after' ? 'before' : 'after';
  const n = tagged.length;

  let i = 0;
  while (i < n) {
    if (tagged[i].role !== insertedRole) {
      i++;
      continue;
    }
    const hunkStart = i;
    while (i < n && tagged[i].role === insertedRole) {
      i++;
    }
    const hunkEnd = i - 1; // inclusive
    const hunkLines = tagged.slice(hunkStart, hunkEnd + 1).map(t => t.line);
    const nonEmptyHunkCount = hunkLines.filter(l => l.trim().length > 0).length;
    if (nonEmptyHunkCount === 0) continue;

    // 优先向前寻找紧邻的「改前」候选块（Antigravity/Cursor 默认将改前块放在上方、改后块放在下方）
    let prevEnd = hunkStart - 1;
    let blankBetweenPrev = 0;
    while (prevEnd >= 0 && tagged[prevEnd].role === 'unchanged' && tagged[prevEnd].line.trim() === '') {
      blankBetweenPrev++;
      prevEnd--;
    }

    let matchedPrev = false;
    if (prevEnd >= 0 && blankBetweenPrev <= 1 && tagged[prevEnd].role === 'unchanged') {
      // 向上收集一个自然段落/块（遇到空行且已收集到内容，或达到与 hunk 相近行数时停止）
      let prevStart = prevEnd;
      const maxLookback = Math.max(nonEmptyHunkCount + 4, Math.ceil(nonEmptyHunkCount * 1.6));
      let collectedNonEmpty = 1;
      while (prevStart > 0 && tagged[prevStart - 1].role === 'unchanged') {
        const candidateLine = tagged[prevStart - 1].line;
        if (candidateLine.trim() === '') {
          if (collectedNonEmpty > 0) break;
        } else {
          collectedNonEmpty++;
          if (collectedNonEmpty > maxLookback) break;
        }
        prevStart--;
      }

      const candidateLines = tagged.slice(prevStart, prevEnd + 1).map(t => t.line);
      const directlyTouching = blankBetweenPrev === 0;
      if (areBlocksCounterparts(candidateLines, hunkLines, directlyTouching)) {
        for (let k = prevStart; k <= prevEnd; k++) {
          if (tagged[k].line.trim() !== '' || (k > prevStart && k < prevEnd)) {
            tagged[k].role = counterpartRole;
          }
        }
        matchedPrev = true;
      }
    }

    // 若上方未匹配，尝试向后寻找紧邻候选块（部分内联 Diff 将新增块插在旧块上方）
    if (!matchedPrev) {
      let nextStart = hunkEnd + 1;
      let blankBetweenNext = 0;
      while (nextStart < n && tagged[nextStart].role === 'unchanged' && tagged[nextStart].line.trim() === '') {
        blankBetweenNext++;
        nextStart++;
      }

      if (nextStart < n && blankBetweenNext <= 1 && tagged[nextStart].role === 'unchanged') {
        let nextEnd = nextStart;
        const maxLookahead = Math.max(nonEmptyHunkCount + 4, Math.ceil(nonEmptyHunkCount * 1.6));
        let collectedNonEmpty = 1;
        while (nextEnd + 1 < n && tagged[nextEnd + 1].role === 'unchanged') {
          const candidateLine = tagged[nextEnd + 1].line;
          if (candidateLine.trim() === '') {
            if (collectedNonEmpty > 0) break;
          } else {
            collectedNonEmpty++;
            if (collectedNonEmpty > maxLookahead) break;
          }
          nextEnd++;
        }

        const candidateLines = tagged.slice(nextStart, nextEnd + 1).map(t => t.line);
        const directlyTouching = blankBetweenNext === 0;
        if (areBlocksCounterparts(hunkLines, candidateLines, directlyTouching)) {
          for (let k = nextStart; k <= nextEnd; k++) {
            if (tagged[k].line.trim() !== '' || (k > nextStart && k < nextEnd)) {
              tagged[k].role = counterpartRole;
            }
          }
        }
      }
    }
  }
}

/**
 * 基于 `content`、`diskContent`、`baseContent` 构建逐行角色标注序列
 */
function buildTaggedLinesFromReferences(
  contentLines: string[],
  baseContent?: string,
  diskContent?: string
): {
  tagged: TaggedLine[];
  diffSource: MarkdownAiDiffResult['diffSource'];
  hasInBufferBeforeLines: boolean;
} | null {
  const normContent = contentLines.join('\n');
  const normBase = typeof baseContent === 'string' && baseContent.length > 0 ? normalizeLf(baseContent) : undefined;
  const normDisk = typeof diskContent === 'string' && diskContent.length > 0 ? normalizeLf(diskContent) : undefined;

  const hasBaseDiff = normBase !== undefined && normBase !== normContent;
  const hasDiskDiff = normDisk !== undefined && normDisk !== normContent;

  if (!hasBaseDiff && !hasDiskDiff) {
    return null;
  }

  // 情况 1：同时存在 baseContent (Old) 与 diskContent (New)，且 content 为内存拼接态 (Old + New)
  if (hasBaseDiff && hasDiskDiff && normBase !== normDisk) {
    const baseLines = normBase!.split('\n');
    const diskLines = normDisk!.split('\n');

    const opsFromDisk = computeLineDiff(diskLines, contentLines);
    const opsFromBase = computeLineDiff(baseLines, contentLines);

    const notInDiskLineNos = new Set<number>();
    for (const op of opsFromDisk) {
      if (op.type === 'insert' && op.newLineNo) {
        notInDiskLineNos.add(op.newLineNo);
      }
    }

    const notInBaseLineNos = new Set<number>();
    for (const op of opsFromBase) {
      if (op.type === 'insert' && op.newLineNo) {
        notInBaseLineNos.add(op.newLineNo);
      }
    }

    // 若 content 确实同时包含了不在 disk 中的行（改前）与不在 base 中的行（改后）
    if (notInDiskLineNos.size > 0 && notInBaseLineNos.size > 0) {
      const tagged: TaggedLine[] = contentLines.map((line, idx) => {
        const lineNo = idx + 1;
        if (notInDiskLineNos.has(lineNo) && !notInBaseLineNos.has(lineNo)) {
          return { line, role: 'before', sourceLine: lineNo };
        }
        if (notInBaseLineNos.has(lineNo) && !notInDiskLineNos.has(lineNo)) {
          return { line, role: 'after', sourceLine: lineNo };
        }
        return { line, role: 'unchanged', sourceLine: lineNo };
      });
      return {
        tagged,
        diffSource: 'spliced-buffer',
        hasInBufferBeforeLines: true,
      };
    }
  }

  // 情况 2：存在 diskContent 与 content 差异（例えば Agent 已写盘 New 而内存含 Old+New，或磁盘为 Old 而内存含 Old+New）
  if (hasDiskDiff) {
    const diskLines = normDisk!.split('\n');
    const ops = computeLineDiff(diskLines, contentLines);
    const deletedCount = ops.filter(o => o.type === 'delete' && o.line.trim() !== '').length;
    const insertedCount = ops.filter(o => o.type === 'insert' && o.line.trim() !== '').length;

    // 子情况 2A：diskLines 完全是 contentLines 的子序列（说明 contentLines 是 Old + New 的内联 Diff 拼接态！）
    if (deletedCount === 0 && insertedCount > 0) {
      // 判断 diskContent 是 Old 还是 New：
      // 若 baseContent 存在且 baseContent === normDisk，则 disk 是 Old，插入行是 after (改后)
      // 若 baseContent 存在且 baseContent !== normDisk，则 disk 是 New，插入行是 before (改前)
      // 默认情况下，若无 baseContent，在未保存的内联编辑中 disk 是 Old，插入行是 after (改后)
      const diskIsNew = normBase !== undefined && normBase !== normDisk;
      const insertedRole: 'before' | 'after' = diskIsNew ? 'before' : 'after';

      const tagged: TaggedLine[] = contentLines.map((line, idx) => ({
        line,
        role: 'unchanged',
        sourceLine: idx + 1,
      }));

      for (const op of ops) {
        if (op.type === 'insert' && op.newLineNo) {
          tagged[op.newLineNo - 1].role = insertedRole;
        }
      }

      markSplicedCounterparts(tagged, insertedRole);
      const hasBefore = tagged.some(t => t.role === 'before');
      return {
        tagged,
        diffSource: 'spliced-buffer',
        hasInBufferBeforeLines: hasBefore,
      };
    }
  }

  // 情况 3：对比参考基线 refLines (优先取 baseContent，其次 diskContent) 与 contentLines
  const refText = hasBaseDiff ? normBase! : normDisk!;
  const refLines = refText.split('\n');
  const ops = computeLineDiff(refLines, contentLines);
  const deletedNonEmpty = ops.filter(o => o.type === 'delete' && o.line.trim() !== '').length;
  const insertedNonEmpty = ops.filter(o => o.type === 'insert' && o.line.trim() !== '').length;

  if (deletedNonEmpty === 0 && insertedNonEmpty === 0) {
    return null;
  }

  // 子情况 3A：refLines (Old) 完全保留在 contentLines 中，同时插入了新行（例如开启了 autoSave 把 Old+New 拼接态写入了磁盘，而 git HEAD / 快照存有纯 Old）
  if (deletedNonEmpty === 0 && insertedNonEmpty > 0) {
    const tagged: TaggedLine[] = contentLines.map((line, idx) => ({
      line,
      role: 'unchanged',
      sourceLine: idx + 1,
    }));

    for (const op of ops) {
      if (op.type === 'insert' && op.newLineNo) {
        tagged[op.newLineNo - 1].role = 'after';
      }
    }

    markSplicedCounterparts(tagged, 'after');
    const hasBefore = tagged.some(t => t.role === 'before');
    return {
      tagged,
      diffSource: hasBefore ? 'spliced-buffer' : 'baseline-diff',
      hasInBufferBeforeLines: hasBefore,
    };
  }

  // 子情况 3B：标准前后版本对比（refLines 中的旧行被替换为 contentLines 中的新行）
  const tagged: TaggedLine[] = [];
  let currentNewLine = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      currentNewLine = op.newLineNo || currentNewLine;
      tagged.push({
        line: op.line,
        role: 'unchanged',
        sourceLine: currentNewLine,
      });
      currentNewLine++;
    } else if (op.type === 'delete') {
      tagged.push({
        line: op.line,
        role: 'before',
        sourceLine: currentNewLine,
        virtual: true,
      });
    } else if (op.type === 'insert') {
      currentNewLine = op.newLineNo || currentNewLine;
      tagged.push({
        line: op.line,
        role: 'after',
        sourceLine: currentNewLine,
      });
      currentNewLine++;
    }
  }

  return {
    tagged,
    diffSource: 'baseline-diff',
    hasInBufferBeforeLines: false,
  };
}

/**
 * 将逐行标注结果序列化为目标视图模式 (`diff` | `after` | `before`) 的 Markdown 与行号映射表
 */
function serializeTaggedLines(
  tagged: TaggedLine[],
  mode: AiDiffViewMode
): {
  markdown: string;
  lineMap: number[];
  addedCount: number;
  removedCount: number;
} {
  const outLines: string[] = [];
  const lineMap: number[] = [];
  let addedCount = 0;
  let removedCount = 0;

  const pushLine = (line: string, sourceLine: number) => {
    outLines.push(line);
    lineMap.push(Math.max(1, sourceLine));
  };

  let i = 0;
  const n = tagged.length;

  while (i < n) {
    const role = tagged[i].role;
    if (role === 'unchanged') {
      pushLine(tagged[i].line, tagged[i].sourceLine);
      i++;
      continue;
    }

    // 收集连续相同角色 (before 或 after) 的行块
    const hunkRole = role;
    const hunk: TaggedLine[] = [];
    while (i < n && tagged[i].role === hunkRole) {
      hunk.push(tagged[i]);
      i++;
    }

    const hasNonEmpty = hunk.some(h => h.line.trim().length > 0);
    if (!hasNonEmpty) {
      if (mode !== 'after' || hunkRole !== 'before') {
        for (const h of hunk) {
          if (!h.virtual) pushLine(h.line, h.sourceLine);
        }
      }
      continue;
    }

    if (hunkRole === 'before') {
      removedCount++;
    } else {
      addedCount++;
    }

    if (mode === 'after') {
      if (hunkRole === 'after') {
        for (const h of hunk) {
          pushLine(h.line, h.sourceLine);
        }
      }
      continue;
    }

    if (mode === 'before') {
      if (hunkRole === 'before') {
        for (const h of hunk) {
          pushLine(h.line, h.sourceLine);
        }
      }
      continue;
    }

    // mode === 'diff'：将连续的改前/改后块包裹为专用语义块 `> [!AI_BEFORE]` / `> [!AI_AFTER]`
    // 剔除首尾纯空行使卡片更紧凑
    let startIdx = 0;
    while (startIdx < hunk.length && hunk[startIdx].line.trim() === '') {
      if (!hunk[startIdx].virtual) {
        pushLine('', hunk[startIdx].sourceLine);
      }
      startIdx++;
    }
    let endIdx = hunk.length - 1;
    const trailingBlanks: TaggedLine[] = [];
    while (endIdx >= startIdx && hunk[endIdx].line.trim() === '') {
      if (!hunk[endIdx].virtual) {
        trailingBlanks.unshift(hunk[endIdx]);
      }
      endIdx--;
    }

    const coreHunk = hunk.slice(startIdx, endIdx + 1);
    if (coreHunk.length === 0) continue;

    const anchorStartLine = coreHunk[0].sourceLine;
    const anchorEndLine = coreHunk[coreHunk.length - 1].sourceLine;
    const isVirtual = coreHunk.every(h => Boolean(h.virtual));

    // 确保与前文之间有空行分隔，以便 marked.lexer 识别为独立 blockquote token
    if (outLines.length > 0 && outLines[outLines.length - 1].trim() !== '') {
      pushLine('', anchorStartLine);
    }

    const calloutTag = hunkRole === 'before' ? 'AI_BEFORE' : 'AI_AFTER';
    const metaSuffix = isVirtual ? `${anchorStartLine}-${anchorEndLine}:virtual` : `${anchorStartLine}-${anchorEndLine}`;
    pushLine(`> [!${calloutTag}:${metaSuffix}]`, anchorStartLine);

    for (const h of coreHunk) {
      pushLine(h.line.length > 0 ? `> ${h.line}` : '>', h.sourceLine);
    }

    // 块后空行分隔，防止相邻的 AI_BEFORE 与 AI_AFTER 被合并为同一个 blockquote
    pushLine('', anchorEndLine);

    for (const tb of trailingBlanks) {
      pushLine('', tb.sourceLine);
    }
  }

  return {
    markdown: outLines.join('\n'),
    lineMap,
    addedCount,
    removedCount,
  };
}

/**
 * 主入口：检测并标注 Markdown 中的 AI 改前/改后内容
 */
export function detectAndAnnotateMarkdownAiDiff(
  options: MarkdownAiDiffOptions
): MarkdownAiDiffResult {
  const { content, baseContent, diskContent, mode = 'diff' } = options;
  const normalized = normalizeLf(content || '');
  const lines = normalized.split('\n');
  const identityLineMap = lines.map((_, idx) => idx + 1);

  if (!normalized.trim()) {
    return {
      markdown: content,
      lineMap: identityLineMap,
      hasDiff: false,
      addedCount: 0,
      removedCount: 0,
      diffSource: 'none',
      hasInBufferBeforeLines: false,
    };
  }

  // 1. 优先检测显式冲突标记 (<<<<<<< ... ======= ... >>>>>>>)
  const conflictTagged = parseExplicitConflictMarkers(lines);
  if (conflictTagged) {
    const serialized = serializeTaggedLines(conflictTagged, mode);
    const criticRes = applyCriticMarkupTransform(serialized.markdown, mode);
    return {
      markdown: criticRes.markdown,
      lineMap: serialized.lineMap,
      hasDiff: true,
      addedCount: serialized.addedCount + criticRes.added,
      removedCount: serialized.removedCount + criticRes.removed,
      diffSource: 'conflict-markers',
      hasInBufferBeforeLines: true,
    };
  }

  // 2. 检测基于 baseContent / diskContent 的拼接态或基线 Diff (Antigravity / Cursor 无标记修改核心场景)
  const refTaggedResult = buildTaggedLinesFromReferences(lines, baseContent, diskContent);
  if (refTaggedResult) {
    const serialized = serializeTaggedLines(refTaggedResult.tagged, mode);
    const criticRes = applyCriticMarkupTransform(serialized.markdown, mode);
    const totalAdded = serialized.addedCount + criticRes.added;
    const totalRemoved = serialized.removedCount + criticRes.removed;
    if (totalAdded > 0 || totalRemoved > 0) {
      return {
        markdown: criticRes.markdown,
        lineMap: serialized.lineMap,
        hasDiff: true,
        addedCount: totalAdded,
        removedCount: totalRemoved,
        diffSource: refTaggedResult.diffSource,
        hasInBufferBeforeLines: refTaggedResult.hasInBufferBeforeLines,
      };
    }
  }

  // 3. 检测内联 CriticMarkup ({--...--}, {++...++}, {~~...~>...~~})
  const criticOnly = applyCriticMarkupTransform(normalized, mode);
  if (criticOnly.hasCritic) {
    return {
      markdown: criticOnly.markdown,
      lineMap: identityLineMap,
      hasDiff: true,
      addedCount: criticOnly.added,
      removedCount: criticOnly.removed,
      diffSource: 'critic-markup',
      hasInBufferBeforeLines: true,
    };
  }

  return {
    markdown: content,
    lineMap: identityLineMap,
    hasDiff: false,
    addedCount: 0,
    removedCount: 0,
    diffSource: 'none',
    hasInBufferBeforeLines: false,
  };
}
