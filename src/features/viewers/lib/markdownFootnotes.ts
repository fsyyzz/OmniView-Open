/**
 * GFM / Pandoc 风格 Markdown 脚注预处理
 * 支持 `[^id]` 引用与 `[^id]:` 定义段（含缩进续行）
 */
import { marked } from 'marked';

export interface FootnoteProcessOptions {
  /** 文末脚注区标题 */
  sectionTitle?: string;
  /** 将脚注正文 Markdown 渲染为 HTML；默认使用 marked.parse */
  renderBody?: (markdown: string) => string;
}

export interface FootnoteProcessResult {
  markdown: string;
  footnoteCount: number;
}

const SLOT_PREFIX = '\u0000OVFN';
const SLOT_SUFFIX = '\u0000';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFootnoteKey(id: string): string {
  const cleaned = id.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'fn';
}

function defaultRenderBody(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return '';
  return marked.parse(trimmed, { async: false }) as string;
}

/**
 * 保护围栏代码块与行内代码，避免误解析脚注语法
 */
function protectCodeSegments(source: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const stash = (chunk: string): string => {
    const index = slots.length;
    slots.push(chunk);
    return `${SLOT_PREFIX}${index}${SLOT_SUFFIX}`;
  };

  let text = source.replace(/(^|\n)(```[\s\S]*?\n```[ \t]*(?:\n|$)|~~~[\s\S]*?\n~~~[ \t]*(?:\n|$))/g, (_m, lead: string, block: string) => {
    return `${lead}${stash(block)}`;
  });

  text = text.replace(/(?<!`)(`+)(?!`)([^\n]*?)\1(?!`)/g, (match) => stash(match));
  return { text, slots };
}

function restoreCodeSegments(text: string, slots: string[]): string {
  return text.replace(new RegExp(`${SLOT_PREFIX}(\\d+)${SLOT_SUFFIX}`, 'g'), (_m, index: string) => {
    return slots[Number(index)] ?? '';
  });
}

/**
 * 从正文提取 `[^id]:` 定义段，并以等量空行占位，尽量保持行号对齐
 */
function extractDefinitions(text: string): { body: string; definitions: Map<string, string> } {
  const lines = text.split('\n');
  const definitions = new Map<string, string>();
  const output: string[] = [];
  const defStart = /^ {0,3}\[\^([^\]\n]+)\]:[ \t]*(.*)$/;

  let i = 0;
  while (i < lines.length) {
    const match = defStart.exec(lines[i]);
    if (!match) {
      output.push(lines[i]);
      i += 1;
      continue;
    }

    const id = match[1].trim();
    const bodyLines: string[] = [match[2] ?? ''];
    let lineCount = 1;
    i += 1;

    while (i < lines.length) {
      const line = lines[i];
      if (defStart.test(line)) break;
      if (/^ {0,3}\S/.test(line)) break;
      if (line.trim() === '') {
        // 空行：若后续仍是缩进续行则纳入，否则结束定义
        let look = i + 1;
        while (look < lines.length && lines[look].trim() === '') look += 1;
        if (look < lines.length && /^(?: {4,}|\t)/.test(lines[look])) {
          bodyLines.push('');
          lineCount += 1;
          i += 1;
          continue;
        }
        break;
      }
      if (/^(?: {4,}|\t)/.test(line) || line.startsWith('    ')) {
        bodyLines.push(line.replace(/^(?: {4}|\t)/, ''));
        lineCount += 1;
        i += 1;
        continue;
      }
      break;
    }

    const body = bodyLines.join('\n').replace(/[ \t]+$/gm, '').trimEnd();
    if (id && !definitions.has(id)) {
      definitions.set(id, body);
    }
    for (let n = 0; n < lineCount; n += 1) {
      output.push('');
    }
  }

  return { body: output.join('\n'), definitions };
}

function buildFootnoteRefHtml(num: number, refOrdinal: number): string {
  const refId = refOrdinal === 1 ? `fnref-${num}` : `fnref-${num}-${refOrdinal}`;
  return (
    `<sup class="ov-footnote-ref" id="${refId}">` +
    `<a href="#fn-${num}" data-footnote-ref="${num}" aria-describedby="fn-${num}">${num}</a>` +
    `</sup>`
  );
}

function buildFootnotesSection(
  ordered: Array<{ id: string; num: number; body: string; refCount: number }>,
  sectionTitle: string,
  renderBody: (markdown: string) => string,
): string {
  if (ordered.length === 0) return '';

  const items = ordered
    .map((fn) => {
      const bodyHtml = renderBody(fn.body);
      const backrefs = Array.from({ length: fn.refCount }, (_, idx) => {
        const ordinal = idx + 1;
        const href = ordinal === 1 ? `#fnref-${fn.num}` : `#fnref-${fn.num}-${ordinal}`;
        const label = fn.refCount === 1 ? '↩' : `↩${ordinal}`;
        return (
          `<a href="${href}" class="ov-footnote-backref" data-footnote-backref="${fn.num}" ` +
          `aria-label="Back to reference ${fn.num}">${label}</a>`
        );
      }).join(' ');

      return (
        `<li id="fn-${fn.num}" class="ov-footnote-item" data-footnote-id="${escapeHtml(sanitizeFootnoteKey(fn.id))}">` +
        `<div class="ov-footnote-body">${bodyHtml}</div>` +
        `<span class="ov-footnote-backrefs">${backrefs}</span>` +
        `</li>`
      );
    })
    .join('\n');

  return (
    `\n\n<section class="ov-footnotes" data-footnotes role="doc-endnotes">\n` +
    `<h2 class="ov-footnotes-title">${escapeHtml(sectionTitle)}</h2>\n` +
    `<ol class="ov-footnotes-list">\n${items}\n</ol>\n` +
    `</section>\n`
  );
}

/**
 * 将 Markdown 中的脚注引用替换为上标链接，剥离定义段，并在文末追加脚注列表
 */
export function processMarkdownFootnotes(
  source: string,
  options: FootnoteProcessOptions = {},
): FootnoteProcessResult {
  if (!source) {
    return { markdown: source, footnoteCount: 0 };
  }

  const sectionTitle = options.sectionTitle || 'Footnotes';
  const renderBody = options.renderBody || defaultRenderBody;
  const { text: protectedText, slots } = protectCodeSegments(source);
  const { body, definitions } = extractDefinitions(protectedText);

  if (definitions.size === 0) {
    return { markdown: restoreCodeSegments(body, slots), footnoteCount: 0 };
  }

  const order: string[] = [];
  const numberById = new Map<string, number>();
  const refCountById = new Map<string, number>();

  const withRefs = body.replace(/\[\^([^\]\n]+)\]/g, (full, rawId: string) => {
    const id = rawId.trim();
    if (!definitions.has(id)) return full;
    let num = numberById.get(id);
    if (!num) {
      num = order.length + 1;
      numberById.set(id, num);
      order.push(id);
    }
    const nextCount = (refCountById.get(id) || 0) + 1;
    refCountById.set(id, nextCount);
    return buildFootnoteRefHtml(num, nextCount);
  });

  const ordered = order.map((id) => ({
    id,
    num: numberById.get(id)!,
    body: definitions.get(id) || '',
    refCount: refCountById.get(id) || 1,
  }));

  const restored = restoreCodeSegments(withRefs, slots);
  const section = buildFootnotesSection(ordered, sectionTitle, renderBody);
  return {
    markdown: restored + section,
    footnoteCount: ordered.length,
  };
}
