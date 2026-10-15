/**
 * OmniView Markdown LaTeX 数学公式预处理与安全渲染管线
 * 作者: 周赞
 * 
 * 核心机制:
 * 1. 预处理 (processMarkdownMath): 保护围栏代码块与行内代码，将行内 $formula$ 与块级 $$formula$$
 *    在进入 marked 词法解析前提取为 mathSlots 占位符，换行符严格守恒，彻底规避 marked 转义
 *    (如 \& -> &amp;, 下划线转 <em>, 比较符 < > 转义, 反斜杠被剥离等) 导致的 KaTeX 语法错误。
 * 2. 规范化与容错 (sanitizeMathFormula): 自动解码残留 HTML 实体，并在非对齐环境中智能将孤立 & 转为 \&。
 * 3. 还原与矢量渲染 (restoreMarkdownMath): 将 marked 生成的 HTML 中的占位符精准还原为 KaTeX 渲染的高保真 DOM。
 */

import katex from 'katex';

export interface MathSlot {
  id: string;
  formula: string;
  displayMode: boolean;
  newlines: number;
}

export interface MarkdownMathProcessResult {
  markdown: string;
  mathSlots: MathSlot[];
}

const MATH_BLOCK_PREFIX = '%%OV_MATH_BLOCK_';
const MATH_INLINE_PREFIX = '%%OV_MATH_INLINE_';
const MATH_SLOT_SUFFIX = '%%';

/**
 * 清理与规范化 LaTeX 数学公式文本，增强容错能力与健壮性
 * 1. 解码常见的 HTML 实体 (防止粘贴或嵌套导致的实体污染)
 * 2. 在非对齐环境 (如 matrix, align, cases, array 等) 中，孤立的 & 转为 \&
 */
export function sanitizeMathFormula(formula: string): string {
  let cleaned = formula.trim();

  // 1. 解码常见的 HTML 实体
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');

  // 2. 智能容错：在非对齐环境 (如 matrix, align, cases, array 等) 中，未转义的 & 转为 \&
  const isAlignmentEnv = /\\begin\{(matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|align|aligned|gather|gathered|cases|array|split)\}/.test(cleaned);
  if (!isAlignmentEnv) {
    cleaned = cleaned.replace(/(?<!\\)&/g, '\\&');
  }

  return cleaned;
}

/**
 * 保护围栏代码块和行内代码，防止误匹配代码中的 $ 符号
 */
function protectCodeSegments(source: string): { text: string; codeSlots: string[] } {
  const codeSlots: string[] = [];
  const CODE_PREFIX = '%%OV_MATH_CODE_';
  const CODE_SUFFIX = '%%';

  // 1. 保护围栏代码块 (``` 或 ~~~)
  let text = source.replace(/(^|\n)(```[\s\S]*?\n```[ \t]*(?:\n|$)|~~~[\s\S]*?\n~~~[ \t]*(?:\n|$))/g, (_m, lead, block) => {
    const idx = codeSlots.length;
    codeSlots.push(block);
    return `${lead}${CODE_PREFIX}${idx}${CODE_SUFFIX}`;
  });

  // 2. 保护行内代码 (`...`)
  text = text.replace(/(?<!`)(`+)(?!`)([^\n]*?)\1(?!`)/g, (match) => {
    const idx = codeSlots.length;
    codeSlots.push(match);
    return `${CODE_PREFIX}${idx}${CODE_SUFFIX}`;
  });

  return { text, codeSlots };
}

/**
 * 还原被保护的代码块
 */
function restoreCodeSegments(text: string, codeSlots: string[]): string {
  return text.replace(/%%OV_MATH_CODE_(\d+)%%/g, (_m, idx) => {
    return codeSlots[Number(idx)] ?? _m;
  });
}

/**
 * 预处理 Markdown 中的 LaTeX 数学公式
 * 提取公式为带有换行守恒的占位符，防止 marked 解析污染公式内容
 */
export function processMarkdownMath(source: string): MarkdownMathProcessResult {
  const mathSlots: MathSlot[] = [];

  // 1. 保护代码段，避免代码中的 $ 被当作公式提取
  const { text: protectedText, codeSlots } = protectCodeSegments(source);

  // 2. 提取块级公式 $$ ... $$ (支持跨行)
  let text = protectedText.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
    const idx = mathSlots.length;
    const newlineCount = (_match.match(/\n/g) || []).length;
    mathSlots.push({
      id: `${MATH_BLOCK_PREFIX}${idx}${MATH_SLOT_SUFFIX}`,
      formula: sanitizeMathFormula(formula),
      displayMode: true,
      newlines: newlineCount,
    });
    // 换行符守恒：补齐对应换行符，确保后续 Token 的行号严格与源码对齐
    const newlinePadding = '\n'.repeat(newlineCount);
    return `${MATH_BLOCK_PREFIX}${idx}${MATH_SLOT_SUFFIX}${newlinePadding}`;
  });

  // 3. 提取行内公式 $ ... $
  text = text.replace(/(?<!\\)\$([^\s\$](?:[^\$\n]*?[^\s\$])?)(?<!\\)\$/g, (match, formula) => {
    // 纯数字跳过 (例如货币金额 $100, $3.14)
    if (/^\d+(\.\d+)?$/.test(formula.trim())) return match;
    const idx = mathSlots.length;
    mathSlots.push({
      id: `${MATH_INLINE_PREFIX}${idx}${MATH_SLOT_SUFFIX}`,
      formula: sanitizeMathFormula(formula),
      displayMode: false,
      newlines: 0,
    });
    return `${MATH_INLINE_PREFIX}${idx}${MATH_SLOT_SUFFIX}`;
  });

  // 4. 还原代码段
  const markdown = restoreCodeSegments(text, codeSlots);

  return { markdown, mathSlots };
}

/**
 * 将 HTML 中的数学占位符还原为 KaTeX 渲染的高保真 DOM
 */
export function restoreMarkdownMath(html: string, mathSlots: MathSlot[]): string {
  if (!mathSlots || mathSlots.length === 0) return html;

  // 1. 块级公式还原 (同时移除外层可能被 marked 包装的 <p>...</p>)
  let res = html.replace(/<p>\s*(%%OV_MATH_BLOCK_\d+%%)\s*<\/p>/g, '$1');

  res = res.replace(/%%OV_MATH_BLOCK_(\d+)%%/g, (_m, idx) => {
    const slot = mathSlots[Number(idx)];
    if (!slot) return _m;
    try {
      const rendered = katex.renderToString(slot.formula, {
        displayMode: true,
        throwOnError: false,
        errorColor: '#f43f5e',
      });
      return `<div class="ov-katex-block">${rendered}</div>`;
    } catch {
      return `<div class="ov-katex-block"><span class="katex-error" style="color:#f43f5e">${slot.formula}</span></div>`;
    }
  });

  // 2. 行内公式还原
  res = res.replace(/%%OV_MATH_INLINE_(\d+)%%/g, (_m, idx) => {
    const slot = mathSlots[Number(idx)];
    if (!slot) return _m;
    try {
      const rendered = katex.renderToString(slot.formula, {
        displayMode: false,
        throwOnError: false,
        errorColor: '#f43f5e',
      });
      return `<span class="ov-katex-inline">${rendered}</span>`;
    } catch {
      return `<span class="ov-katex-inline"><span class="katex-error" style="color:#f43f5e">${slot.formula}</span></span>`;
    }
  });

  return res;
}

/**
 * 快速安全渲染单条行内公式，自带公式容错与实体解码 (供表格、单元格、单条视图等组件调用)
 */
export function renderInlineMath(rawFormula: string): string {
  if (!rawFormula) return '';
  const sanitized = sanitizeMathFormula(rawFormula);
  try {
    return `<span class="ov-katex-inline">${katex.renderToString(sanitized, {
      displayMode: false,
      throwOnError: false,
      errorColor: '#f43f5e',
    })}</span>`;
  } catch {
    return `<span class="ov-katex-inline"><span class="katex-error" style="color:#f43f5e">${rawFormula}</span></span>`;
  }
}
