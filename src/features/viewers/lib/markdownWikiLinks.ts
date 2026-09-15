/**
 * Obsidian 风格 Wiki 链接与嵌入预处理
 * 支持 [[Page]] / [[Page|alias]] / [[Page#Heading]] / [[#Heading]]
 * 以及 ![[embed]] / ![[image.png]] / ![[img|宽度]]
 */

export interface WikiFileRef {
  name: string;
  content: string;
  extension: string;
  path?: string;
}

export interface WikiLinkParts {
  embed: boolean;
  target: string;
  heading?: string;
  blockId?: string;
  alias?: string;
}

export interface WikiProcessOptions {
  files?: WikiFileRef[];
  unresolvedLabel?: string;
  openLabel?: string;
  embedLabel?: string;
  /** 截取笔记嵌入预览的最大字符数 */
  previewMaxChars?: number;
}

export interface WikiProcessResult {
  markdown: string;
  linkCount: number;
  embedCount: number;
}

const SLOT_PREFIX = '\u0000OVWL';
const SLOT_SUFFIX = '\u0000';
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const NOTE_EXTS = new Set(['md', 'markdown', 'okf', 'txt']);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

/** 将标题文本转为与 MarkdownViewer 一致的 slug */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 解析 Wiki 链接内部片段（不含两侧括号）
 */
export function parseWikiLinkInner(inner: string): Omit<WikiLinkParts, 'embed'> {
  let alias: string | undefined;
  let rest = inner.trim();
  const pipe = rest.indexOf('|');
  if (pipe >= 0) {
    alias = rest.slice(pipe + 1).trim() || undefined;
    rest = rest.slice(0, pipe).trim();
  }

  let heading: string | undefined;
  let blockId: string | undefined;
  let target = rest;
  const hash = rest.indexOf('#');
  if (hash >= 0) {
    target = rest.slice(0, hash).trim();
    const frag = rest.slice(hash + 1).trim();
    if (frag.startsWith('^')) {
      blockId = frag.slice(1).trim() || undefined;
    } else if (frag) {
      heading = frag;
    }
  }

  return { target, heading, blockId, alias };
}

function getExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() || name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function isImageTarget(target: string): boolean {
  return IMAGE_EXTS.has(getExtension(target));
}

function displayName(target: string, alias?: string, heading?: string): string {
  if (alias) return alias;
  if (!target && heading) return heading;
  const base = target.split(/[/\\]/).pop() || target;
  const withoutExt = base.replace(/\.(md|markdown|okf)$/i, '');
  if (heading) return `${withoutExt} › ${heading}`;
  return withoutExt || target;
}

/**
 * 在已打开文件列表中解析 Wiki 目标
 */
export function resolveWikiTarget(target: string, files: WikiFileRef[] = []): WikiFileRef | null {
  if (!target || files.length === 0) return null;
  const clean = target.replace(/\\/g, '/').replace(/^\/+/, '');
  const baseName = clean.split('/').pop() || clean;
  const stem = baseName.replace(/\.[^.]+$/, '');
  const lowerClean = clean.toLowerCase();
  const lowerBase = baseName.toLowerCase();
  const lowerStem = stem.toLowerCase();

  return (
    files.find((f) => {
      const name = f.name.toLowerCase();
      const nameStem = name.replace(/\.[^.]+$/, '');
      const path = (f.path || '').replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
      if (name === lowerBase || name === `${lowerStem}.md` || name === `${lowerStem}.markdown` || name === `${lowerStem}.okf`) {
        return true;
      }
      if (nameStem === lowerStem || nameStem === lowerBase) return true;
      if (path && (path === lowerClean || path.endsWith(`/${lowerClean}`) || path.endsWith(`/${lowerBase}`))) {
        return true;
      }
      return false;
    }) || null
  );
}

function buildHref(target: string, heading?: string, resolved?: WikiFileRef | null): string {
  if (!target && heading) {
    const slug = slugifyHeading(heading);
    return slug ? `#${slug}` : '#';
  }
  const fileName = resolved?.name || (getExtension(target) ? target : `${target}.md`);
  if (heading) {
    const slug = slugifyHeading(heading);
    return slug ? `${fileName}#${slug}` : fileName;
  }
  return fileName;
}

function stripPreview(content: string, maxChars: number): string {
  let body = content.replace(/^\uFEFF/, '');
  const fm = /^(?:\r?\n)*---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/.exec(body);
  if (fm) body = body.slice(fm[0].length);
  body = body.replace(/\r\n/g, '\n').trim();
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars).trimEnd()}…`;
}

function buildLinkHtml(parts: WikiLinkParts, opts: Required<Pick<WikiProcessOptions, 'unresolvedLabel'>> & { files: WikiFileRef[] }): string {
  const resolved = parts.target ? resolveWikiTarget(parts.target, opts.files) : null;
  const missing = Boolean(parts.target) && !resolved && opts.files.length > 0;
  // 无 files 上下文时不标 missing（插件单文件场景），仍输出可点击链接
  const label = displayName(parts.target, parts.alias, parts.heading);
  const href = buildHref(parts.target, parts.heading, resolved);
  const classes = ['ov-wiki-link', missing ? 'ov-wiki-link--missing' : ''].filter(Boolean).join(' ');
  const title = missing
    ? `${opts.unresolvedLabel}: ${parts.target}`
    : [parts.target, parts.heading ? `#${parts.heading}` : '', parts.blockId ? `#^${parts.blockId}` : '']
        .filter(Boolean)
        .join('') || label;

  return (
    `<a class="${classes}" href="${escapeHtml(href)}" ` +
    `data-wiki-link="true" ` +
    `data-wiki-target="${escapeHtml(parts.target)}" ` +
    (parts.heading ? `data-wiki-heading="${escapeHtml(parts.heading)}" ` : '') +
    (parts.blockId ? `data-wiki-block="${escapeHtml(parts.blockId)}" ` : '') +
    `title="${escapeHtml(title)}">${escapeHtml(label)}</a>`
  );
}

function buildImageEmbedHtml(parts: WikiLinkParts): string {
  const src = parts.target;
  const numericWidth = parts.alias && /^\d{1,4}$/.test(parts.alias) ? parts.alias : undefined;
  const alt = numericWidth ? (src.split(/[/\\]/).pop() || src) : displayName(parts.target, parts.alias, parts.heading);
  const widthAttr = numericWidth ? ` width="${numericWidth}" style="max-width:${numericWidth}px;height:auto"` : '';
  return (
    `<span class="ov-wiki-embed ov-wiki-embed--image" data-wiki-embed="image" data-wiki-target="${escapeHtml(src)}">` +
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"${widthAttr} ` +
    `onerror="this.classList.add('ov-img-broken');this.insertAdjacentHTML('afterend','<span class=\\'ov-image-fallback\\'>⚠️ ${escapeHtml(src)}</span>');this.style.display='none';" />` +
    `</span>`
  );
}

function buildNoteEmbedHtml(
  parts: WikiLinkParts,
  opts: {
    files: WikiFileRef[];
    unresolvedLabel: string;
    openLabel: string;
    embedLabel: string;
    previewMaxChars: number;
  },
): string {
  const resolved = parts.target ? resolveWikiTarget(parts.target, opts.files) : null;
  const title = displayName(parts.target, parts.alias, parts.heading);
  const href = buildHref(parts.target, parts.heading, resolved);

  if (!resolved) {
    const noContext = opts.files.length === 0;
    return (
      `<aside class="ov-wiki-embed ${noContext ? 'ov-wiki-embed--note' : 'ov-wiki-embed--unresolved'}" ` +
      `data-wiki-embed="${noContext ? 'note' : 'unresolved'}" ` +
      `data-wiki-target="${escapeHtml(parts.target)}" data-wiki-heading="${escapeHtml(parts.heading || '')}">` +
      `<div class="ov-wiki-embed-header"><span class="ov-wiki-embed-badge">${escapeHtml(opts.embedLabel)}</span>` +
      `<a class="ov-wiki-embed-title ov-wiki-link" href="${escapeHtml(href)}" data-wiki-link="true" ` +
      `data-wiki-target="${escapeHtml(parts.target)}" ` +
      (parts.heading ? `data-wiki-heading="${escapeHtml(parts.heading)}" ` : '') +
      `>${escapeHtml(title)}</a>` +
      `<a class="ov-wiki-embed-open" href="${escapeHtml(href)}" data-wiki-link="true" data-wiki-target="${escapeHtml(parts.target)}">${escapeHtml(opts.openLabel)}</a>` +
      `</div>` +
      `<div class="ov-wiki-embed-body ${noContext ? '' : 'ov-wiki-embed-missing'}">` +
      (noContext
        ? escapeHtml(title)
        : `${escapeHtml(opts.unresolvedLabel)}: <code>${escapeHtml(parts.target || title)}</code>`) +
      `</div>` +
      `</aside>`
    );
  }

  const ext = (resolved.extension || getExtension(resolved.name)).toLowerCase();
  const isNote = NOTE_EXTS.has(ext);
  let bodyHtml: string;
  if (isNote) {
    const preview = stripPreview(resolved.content, opts.previewMaxChars);
    bodyHtml = `<pre class="ov-wiki-embed-preview">${escapeHtml(preview)}</pre>`;
  } else {
    bodyHtml =
      `<div class="ov-wiki-embed-meta">${escapeHtml(resolved.name)} · ${escapeHtml(ext || 'file')}</div>`;
  }

  return (
    `<aside class="ov-wiki-embed ov-wiki-embed--note" data-wiki-embed="note" ` +
    `data-wiki-target="${escapeHtml(parts.target)}" ` +
    (parts.heading ? `data-wiki-heading="${escapeHtml(parts.heading)}" ` : '') +
    `>` +
    `<div class="ov-wiki-embed-header">` +
    `<span class="ov-wiki-embed-badge">${escapeHtml(opts.embedLabel)}</span>` +
    `<a class="ov-wiki-embed-title ov-wiki-link" href="${escapeHtml(href)}" data-wiki-link="true" ` +
    `data-wiki-target="${escapeHtml(parts.target)}" ` +
    (parts.heading ? `data-wiki-heading="${escapeHtml(parts.heading)}" ` : '') +
    `>${escapeHtml(title)}</a>` +
    `<a class="ov-wiki-embed-open" href="${escapeHtml(href)}" data-wiki-link="true" data-wiki-target="${escapeHtml(parts.target)}">${escapeHtml(opts.openLabel)}</a>` +
    `</div>` +
    `<div class="ov-wiki-embed-body">${bodyHtml}</div>` +
    `</aside>`
  );
}

/**
 * 将 Obsidian Wiki 链接/嵌入替换为可渲染 HTML
 */
export function processMarkdownWikiLinks(
  source: string,
  options: WikiProcessOptions = {},
): WikiProcessResult {
  if (!source) return { markdown: source, linkCount: 0, embedCount: 0 };

  const files = options.files || [];
  const unresolvedLabel = options.unresolvedLabel || 'Unresolved';
  const openLabel = options.openLabel || 'Open';
  const embedLabel = options.embedLabel || 'Embed';
  const previewMaxChars = options.previewMaxChars ?? 420;

  const { text: protectedText, slots } = protectCodeSegments(source);
  let linkCount = 0;
  let embedCount = 0;

  const replaced = protectedText.replace(/(!?)\[\[([^\]]+?)\]\]/g, (_full, bang: string, inner: string) => {
    const embed = bang === '!';
    const parts = { embed, ...parseWikiLinkInner(inner) };
    if (embed) {
      embedCount += 1;
      if (isImageTarget(parts.target)) {
        return buildImageEmbedHtml(parts);
      }
      return buildNoteEmbedHtml(parts, {
        files,
        unresolvedLabel,
        openLabel,
        embedLabel,
        previewMaxChars,
      });
    }
    linkCount += 1;
    return buildLinkHtml(parts, { files, unresolvedLabel });
  });

  return {
    markdown: restoreCodeSegments(replaced, slots),
    linkCount,
    embedCount,
  };
}
