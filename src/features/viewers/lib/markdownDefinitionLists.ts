/**
 * Pandoc 风格定义列表预处理
 * Term
 * : Definition
 */
import { marked } from 'marked';

export interface DefinitionListProcessResult {
  markdown: string;
  listCount: number;
}

const SLOT_PREFIX = '\u0000OVDL';
const SLOT_SUFFIX = '\u0000';

function protectCodeSegments(source: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const stash = (chunk: string): string => {
    const index = slots.length;
    slots.push(chunk);
    return `${SLOT_PREFIX}${index}${SLOT_SUFFIX}`;
  };

  let text = source.replace(
    /(^|\n)(```[\s\S]*?\n```[ \t]*(?:\n|$)|~~~[\s\S]*?\n~~~[ \t]*(?:\n|$))/g,
    (_m, lead: string, block: string) => `${lead}${stash(block)}`,
  );
  text = text.replace(/(?<!`)(`+)(?!`)([^\n]*?)\1(?!`)/g, (match) => stash(match));
  return { text, slots };
}

function restoreCodeSegments(text: string, slots: string[]): string {
  return text.replace(new RegExp(`${SLOT_PREFIX}(\\d+)${SLOT_SUFFIX}`, 'g'), (_m, index: string) => {
    return slots[Number(index)] ?? '';
  });
}

function isBlank(line: string): boolean {
  return /^\s*$/.test(line);
}

function isDefMarker(line: string): boolean {
  return /^[~:](?:[ \t]+|$)/.test(line);
}

/** 避免把标题/列表/引用/分隔线/HTML 块当成 term */
function looksLikeOtherBlock(line: string): boolean {
  return (
    /^#{1,6}\s/.test(line) ||
    /^([-*+]|\d+[.)])\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^</.test(line.trim()) ||
    /^\|/.test(line)
  );
}

function renderInline(text: string): string {
  return marked.parseInline(text.trim(), { async: false }) as string;
}

function renderBlock(text: string): string {
  const trimmed = text.replace(/[ \t]+$/gm, '').trim();
  if (!trimmed) return '';
  return marked.parse(trimmed, { async: false }) as string;
}

function parseDefBody(line: string): string {
  return line.replace(/^[~:][ \t]?/, '');
}

/**
 * 将 Pandoc 定义列表转换为 <dl class="ov-deflist"> HTML
 */
export function processMarkdownDefinitionLists(source: string): DefinitionListProcessResult {
  if (!source) return { markdown: source, listCount: 0 };

  const { text: protectedText, slots } = protectCodeSegments(source);
  const lines = protectedText.split('\n');
  const out: string[] = [];
  let listCount = 0;
  let i = 0;

  while (i < lines.length) {
    // 预读：从 i 起是否存在「term(s) + definition」
    let j = i;
    while (j < lines.length && isBlank(lines[j])) j += 1;
    if (j >= lines.length) {
      while (i < lines.length) {
        out.push(lines[i]);
        i += 1;
      }
      break;
    }

    // 收集连续 term 行（允许中间无空行；term 后可有空行再接定义）
    const termStart = j;
    const terms: string[] = [];
    while (j < lines.length && !isBlank(lines[j]) && !isDefMarker(lines[j]) && !looksLikeOtherBlock(lines[j])) {
      terms.push(lines[j]);
      j += 1;
    }

    let k = j;
    while (k < lines.length && isBlank(lines[k])) k += 1;

    if (terms.length === 0 || k >= lines.length || !isDefMarker(lines[k])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    // 确认是定义列表：把 i→termStart 的空行原样输出，再吞掉整个 list
    while (i < termStart) {
      out.push(lines[i]);
      i += 1;
    }

    const dlParts: string[] = ['<dl class="ov-deflist">'];
    let cursor = termStart;

    while (cursor < lines.length) {
      const segmentStart = cursor;
      while (cursor < lines.length && isBlank(lines[cursor])) cursor += 1;
      if (cursor >= lines.length) {
        cursor = segmentStart;
        break;
      }

      const nextTerms: string[] = [];
      while (
        cursor < lines.length &&
        !isBlank(lines[cursor]) &&
        !isDefMarker(lines[cursor]) &&
        !looksLikeOtherBlock(lines[cursor])
      ) {
        nextTerms.push(lines[cursor]);
        cursor += 1;
      }

      let defProbe = cursor;
      while (defProbe < lines.length && isBlank(lines[defProbe])) defProbe += 1;
      if (nextTerms.length === 0 || defProbe >= lines.length || !isDefMarker(lines[defProbe])) {
        // 后续并非定义项：回退，留给外层按普通段落输出
        cursor = segmentStart;
        break;
      }

      cursor = defProbe;
      for (const term of nextTerms) {
        dlParts.push(`<dt>${renderInline(term)}</dt>`);
      }

      while (cursor < lines.length && isDefMarker(lines[cursor])) {
        const bodyLines: string[] = [parseDefBody(lines[cursor])];
        cursor += 1;
        while (cursor < lines.length) {
          const line = lines[cursor];
          if (isBlank(line)) {
            let look = cursor + 1;
            while (look < lines.length && isBlank(lines[look])) look += 1;
            if (look < lines.length && (/^[ \t]+/.test(lines[look]) || isDefMarker(lines[look]))) {
              bodyLines.push('');
              cursor += 1;
              continue;
            }
            break;
          }
          if (isDefMarker(line)) break;
          if (/^[ \t]+/.test(line)) {
            bodyLines.push(line.replace(/^[ \t]+/, ''));
            cursor += 1;
            continue;
          }
          break;
        }
        dlParts.push(`<dd>${renderBlock(bodyLines.join('\n'))}</dd>`);
      }
    }

    dlParts.push('</dl>');
    out.push(dlParts.join('\n'));
    listCount += 1;
    i = cursor;
  }

  return {
    markdown: restoreCodeSegments(out.join('\n'), slots),
    listCount,
  };
}
