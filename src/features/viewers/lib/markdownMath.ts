/**
 * OmniView Markdown LaTeX 数学公式预处理与安全渲染管线
 *
 * 核心机制:
 * 1. 代码与货币双重保护 (protectCodeAndCurrencySegments):
 *    - 保护任意缩进或引用块内的围栏代码块 (``` / ~~~) 与行内代码 (`...`)；
 *    - 智能识别并保护转义美元符 (\$)、货币区间 ($100~$200 / $100-$200) 及同行货币金额 ($100，购买 $n$ 件)，
 *      彻底杜绝同行出现 "$100" 与 "$x$" 时发生跨段错位匹配吞噬。
 * 2. 全定界符支持 (processMarkdownMath):
 *    - 支持块级公式 $$ ... $$ 与标准 LaTeX \[ ... \]；
 *    - 支持行内公式 $ ... $（兼容紧贴或带首尾空格的 $ a + b = c $）与标准 LaTeX \( ... \)；
 *    - 引用块 (>) / Callout (> [!NOTE]) 跨行公式守恒：自动剥离公式内部每行前导 `>` 并在占位符填充中保留 `\n>`，
 *      既防止 `>` 污染 KaTeX AST，又保证引用块与 Callout 容器绝不被空行拦腰截断。
 * 3. 深度容错与宏扩展 (sanitizeMathFormula & COMMON_KATEX_MACROS):
 *    - 自动解码 HTML 实体；
 *    - 完整识别 25+ 种对齐与矩阵环境 (含 align*, alignedat, smallmatrix, rcases, dcases, CD 等)，在非对齐环境中将孤立 & 转为 \&；
 *    - 自动将 eqnarray / flalign / multline 等 LaTeX 环境归一化为 KaTeX 原生支持的 aligned / gathered；
 *    - 智能处理未转义百分号 %（单行公式内自动转为 \%，多行公式保护行尾注释并补齐末尾换行防 [commentAtEnd]）；
 *    - 智能修复位异或 ^ 十六进制与缺失的 \left / \right 配对；
 *    - 内置常用学术宏 (\R, \N, \Z, \Q, \C, \abs, \norm, \argmin, \argmax, \bm, \bold, \degree 等) 并启用 strict: false。
 */

import katex from 'katex';

export interface MathSlot {
  id: string;
  formula: string;
  rawFormula: string;
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
 * 内置常用 LaTeX 学术宏字典，消除常见 Undefined control sequence 报错
 */
export const COMMON_KATEX_MACROS: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\abs': '\\left|#1\\right|',
  '\\norm': '\\left\\|#1\\right\\|',
  '\\argmin': '\\operatorname*{arg\\,min}',
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\degree': '^\\circ',
  '\\celsius': '^\\circ\\text{C}',
  '\\bold': '\\mathbf{#1}',
  '\\bm': '\\boldsymbol{#1}',
  '\\eps': '\\varepsilon',
  '\\half': '\\frac{1}{2}',
};

/**
 * 构建统一的 KaTeX 渲染配置项
 */
export function getKatexOptions(displayMode: boolean, throwOnError = false): katex.KatexOptions {
  return {
    displayMode,
    throwOnError,
    errorColor: '#f43f5e',
    strict: false,
    macros: { ...COMMON_KATEX_MACROS },
  };
}

/**
 * 清理与规范化 LaTeX 数学公式文本，增强容错能力与健壮性
 */
export function sanitizeMathFormula(formula: string): string {
  let cleaned = formula.trim();
  if (!cleaned) return '';

  // 0. 若多行公式包含 Markdown 引用块每行前缀 `>` (如在 > [!NOTE] 或 blockquote 内)，剥离行首 `>`
  if (cleaned.includes('\n')) {
    const lines = cleaned.split('\n');
    const nonEmptyAfterFirst = lines.slice(1).filter((l) => l.trim().length > 0);
    const hasBlockquotePrefixes =
      (nonEmptyAfterFirst.length > 0 && nonEmptyAfterFirst.every((l) => /^\s*>/.test(l))) ||
      lines.some((l) => /^\s*>\s*\\(?:begin|end)\b/.test(l));
    if (hasBlockquotePrefixes) {
      cleaned = lines.map((l) => l.replace(/^\s*>[ \t]?/, '')).join('\n').trim();
    }
  }

  // 1. 解码常见的 HTML 实体
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');

  // 2. 归一化 KaTeX 不直接支持的 LaTeX 环境 (eqnarray / flalign -> aligned, multline -> gathered)
  if (/\\begin\s*\{\s*eqnarray\*?\s*\}/.test(cleaned)) {
    cleaned = cleaned
      .replace(/\\begin\s*\{\s*eqnarray\*?\s*\}/g, '\\begin{aligned}')
      .replace(/\\end\s*\{\s*eqnarray\*?\s*\}/g, '\\end{aligned}')
      .replace(/&\s*(=|<|>|\\le|\\ge|\\neq|\\approx|\\equiv|\\sim)\s*&/g, '&$1 ');
  }
  if (/\\begin\s*\{\s*flalign\*?\s*\}/.test(cleaned)) {
    cleaned = cleaned
      .replace(/\\begin\s*\{\s*flalign\*?\s*\}/g, '\\begin{aligned}')
      .replace(/\\end\s*\{\s*flalign\*?\s*\}/g, '\\end{aligned}');
  }
  if (/\\begin\s*\{\s*multline\*?\s*\}/.test(cleaned)) {
    cleaned = cleaned
      .replace(/\\begin\s*\{\s*multline\*?\s*\}/g, '\\begin{gathered}')
      .replace(/\\end\s*\{\s*multline\*?\s*\}/g, '\\end{gathered}');
  }

  // 3. 移除 KaTeX 不支持的 \label{...} 标签声明，防止整块公式报错
  cleaned = cleaned.replace(/\\label\s*\{[^}]*\}/g, '');

  // 4. 智能容错：在非对齐环境 (涵盖带 * 变体及矩阵/分段环境) 中，将孤立未转义的 & 转为 \&
  const isAlignmentEnv =
    /\\begin\s*\{\s*(matrix\*?|pmatrix\*?|bmatrix\*?|Bmatrix\*?|vmatrix\*?|Vmatrix\*?|smallmatrix|align\*?|aligned|alignat\*?|alignedat|flalign\*?|eqnarray\*?|gather\*?|gathered|multline\*?|cases|rcases|dcases|drcases|array|darray|subarray|split|CD)\s*\}/.test(
      cleaned
    );
  if (!isAlignmentEnv) {
    cleaned = cleaned.replace(/(?<!\\)&/g, '\\&');
  }

  // 5. 智能处理未转义的 % 符号：
  //    - 单行公式内不存在跨行注释，未转义的 % (如 $95%$ 或 $\left(50%\right)$) 必然为百分号，转为 \%
  //    - 多行公式中：跟在数字后面的 % (如 95%) 转为 \%；若行尾存在真正的 % 注释，确保公式末尾有 \n 防止 [commentAtEnd] 吞噬闭合符
  if (!cleaned.includes('\n')) {
    cleaned = cleaned.replace(/(?<!\\)%/g, '\\%');
  } else {
    cleaned = cleaned.replace(/(\d)\s*(?<!\\)%(?=\s|$|[),};\\])/g, '$1\\%');
    if (/(?<!\\)%[^\n]*$/.test(cleaned)) {
      cleaned += '\n';
    }
  }

  // 6. 修复孤立的位异或符号 ^ (例如 "(val \& 0xFF) ^ 0x5A" 带双侧空格且后跟多位十六进制/标识符的场景)
  cleaned = cleaned.replace(/(\S)\s+\^\s+(0x[0-9a-fA-F]+|[a-zA-Z_]\w+)/g, '$1 \\wedge $2');

  // 7. 修复未闭合的 \left / \right 定界符配对，避免单个缺失拖垮整个公式
  const leftCount = (cleaned.match(/\\left(?![a-zA-Z])/g) || []).length;
  const rightCount = (cleaned.match(/\\right(?![a-zA-Z])/g) || []).length;
  if (leftCount > rightCount) {
    cleaned = cleaned + ' \\right.'.repeat(leftCount - rightCount);
  } else if (rightCount > leftCount) {
    cleaned = '\\left. '.repeat(rightCount - leftCount) + cleaned;
  }

  return cleaned;
}

/**
 * 保护围栏代码块、行内代码以及纯文本货币符号 ($100)，防止误匹配代码或价格中的 $ 符号
 */
function protectCodeAndCurrencySegments(source: string): { text: string; codeSlots: string[] } {
  const codeSlots: string[] = [];
  const CODE_PREFIX = '%%OV_MATH_CODE_';
  const CODE_SUFFIX = '%%';

  const pushCodeSlot = (raw: string): string => {
    const idx = codeSlots.length;
    codeSlots.push(raw);
    return `${CODE_PREFIX}${idx}${CODE_SUFFIX}`;
  };

  // 1. 保护围栏代码块 (支持顶层、列表缩进、引用块 > 内的 ``` 或 ~~~ 围栏)
  let text = source.replace(
    /(^|\n)([ \t>]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t>]*\3[ \t]*(?=\n|$))/g,
    (_m, lead, block) => `${lead}${pushCodeSlot(block)}`
  );

  // 2. 保护行内代码 (`...`)
  text = text.replace(/(?<!`)(`+)(?!`)([^\n]*?)\1(?!`)/g, (match) => pushCodeSlot(match));

  // 3. 保护显式转义的美元符号 \$
  text = text.replace(/\\\$/g, (match) => pushCodeSlot(match));

  // 4. 保护货币价格区间 (例如 $100~$200, $100-$200, $99.9 to $199.9)
  text = text.replace(
    /(?<!\$)\$\d+(?:,\d{3})*(?:\.\d+)?[kKmMbB]?\s*(?:~|-|–|—|to|至|到)\s*\$\d+(?:,\d{3})*(?:\.\d+)?[kKmMbB]?(?!\w)/gi,
    (match) => pushCodeSlot(match)
  );

  // 5. 保护单行中明确的货币金额 (例如 "消费了$100，剩余金额为$x - 100$元" 或 "原价 $100，现价 $80" 或 "Price is $100 and $200")
  //    判定准则：$ 后紧跟数字，且数字后紧邻行尾、中文字符、中文/英文句读标点，或空格后跟英文连词/介词/普通散文词且后方不再构成数学算式
  text = text.replace(
    /(?<!\$)\$\d+(?:,\d{3})*(?:\.\d+)?[kKmMbB]?(?=$|\r?\n|[，。、；：！？,.!?;:)\]\}/]|[\u4e00-\u9fa5]|\s+(?:and|or|to|for|per|in|at|on|with|from|vs|is|was|are|were|[\u4e00-\u9fa5])\b)/gi,
    (match) => pushCodeSlot(match)
  );

  return { text, codeSlots };
}

/**
 * 还原被保护的代码块与货币符号
 */
function restoreCodeSegments(text: string, codeSlots: string[]): string {
  return text.replace(/%%OV_MATH_CODE_(\d+)%%/g, (_m, idx) => {
    return codeSlots[Number(idx)] ?? _m;
  });
}

/**
 * 判断候选字符串是否属于合法的行内数学公式（用于带首尾空格的 $ ... $ 场景防误判）
 */
function isPlausibleMathContent(formula: string): boolean {
  const trimmed = formula.trim();
  if (!trimmed) return false;
  // 纯数字不视为数学公式 (如 $100$)
  if (/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(trimmed)) return false;
  // 不能包含未配对的孤立货币形式 (如 "$100")
  if (/\$\d/.test(trimmed)) return false;
  return true;
}

/**
 * 构造块级公式占位符与换行填充（若位于引用块 > 内，自动保留每行 > 前缀以防截断引用块/Callout）
 */
function registerBlockMathSlot(fullMatch: string, rawFormula: string, mathSlots: MathSlot[]): string {
  const idx = mathSlots.length;
  const matchLines = fullMatch.split('\n');
  const newlineCount = matchLines.length - 1;

  // 若多行块级公式位于引用块/Callout 内，后续行带有 `>` 前缀，在占位填充中保留 `\n>` 以維持单一 blockquote Token
  let newlinePadding = '';
  for (let i = 1; i < matchLines.length; i++) {
    const bqMatch = matchLines[i].match(/^([ \t]*>[ \t]?)/);
    newlinePadding += bqMatch ? `\n${bqMatch[1]}` : '\n';
  }

  const cleanRaw =
    newlineCount > 0
      ? rawFormula
          .split('\n')
          .map((l) => l.replace(/^[ \t]*>[ \t]?/, ''))
          .join('\n')
          .trim()
      : rawFormula.trim();

  mathSlots.push({
    id: `${MATH_BLOCK_PREFIX}${idx}${MATH_SLOT_SUFFIX}`,
    formula: sanitizeMathFormula(cleanRaw),
    rawFormula: cleanRaw,
    displayMode: true,
    newlines: newlineCount,
  });

  return `${MATH_BLOCK_PREFIX}${idx}${MATH_SLOT_SUFFIX}${newlinePadding}`;
}

/**
 * 预处理 Markdown 中的 LaTeX 数学公式
 * 提取公式为带有换行守恒的占位符，防止 marked 解析污染公式内容
 */
export function processMarkdownMath(source: string): MarkdownMathProcessResult {
  const mathSlots: MathSlot[] = [];

  // 1. 保护代码段与纯文本货币，避免代码或价格中的 $ 被当作公式提取
  const { text: protectedText, codeSlots } = protectCodeAndCurrencySegments(source);

  // 2. 提取块级公式 $$ ... $$ (支持单行与跨行)
  let text = protectedText.replace(/\$\$([\s\S]+?)\$\$/g, (fullMatch, formula) => {
    return registerBlockMathSlot(fullMatch, formula, mathSlots);
  });

  // 3. 提取标准 LaTeX 块级公式 \[ ... \] (支持跨行或含数学结构的独立 \[ ... \])
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (fullMatch, formula) => {
    const trimmed = formula.trim();
    if (!trimmed) return fullMatch;
    // 防御类似 \[INFO\] 的纯单词转义方括号：仅当跨行、包含反斜杠/数学算符/上下标/等号或单字母变量时才视为公式
    const isMathLike =
      fullMatch.includes('\n') ||
      /[\\=^_{}+<>*/]/.test(trimmed) ||
      /^[a-zA-Z0-9\s.,+\-*/=<>()[\]|]+$/.test(trimmed);
    if (!isMathLike || /^[A-Z_]{2,}$/.test(trimmed)) {
      return fullMatch;
    }
    return registerBlockMathSlot(fullMatch, formula, mathSlots);
  });

  // 4. 提取标准 LaTeX 行内公式 \( ... \)
  text = text.replace(/\\\(([^\n]+?)\\\)/g, (fullMatch, formula) => {
    if (!isPlausibleMathContent(formula)) return fullMatch;
    const idx = mathSlots.length;
    const cleanRaw = formula.trim();
    mathSlots.push({
      id: `${MATH_INLINE_PREFIX}${idx}${MATH_SLOT_SUFFIX}`,
      formula: sanitizeMathFormula(cleanRaw),
      rawFormula: cleanRaw,
      displayMode: false,
      newlines: 0,
    });
    return `${MATH_INLINE_PREFIX}${idx}${MATH_SLOT_SUFFIX}`;
  });

  // 5. 提取行内公式 $ ... $ (支持紧贴 $a+b$ 与带内侧空格的 $ a + b = c $)
  text = text.replace(/(?<!\\|\$)\$([^\$\n]+?)(?<!\\)\$/g, (match, formula) => {
    const trimmed = formula.trim();
    if (!isPlausibleMathContent(trimmed)) return match;

    // 若 $ 内侧带有首尾空格 (如 "$ a + b $")，需确认内部确实包含数学特征或变量，防止偶发散文误判
    const hasLeadingOrTrailingSpace = /^\s|\s$/.test(formula);
    if (hasLeadingOrTrailingSpace) {
      const hasMathFeature =
        /[\\=^_{}+<>*/]|^[a-zA-Z0-9]$|\b[a-zA-Z]\s*[+\-*/=<>]/.test(trimmed);
      if (!hasMathFeature) return match;
    }

    const idx = mathSlots.length;
    mathSlots.push({
      id: `${MATH_INLINE_PREFIX}${idx}${MATH_SLOT_SUFFIX}`,
      formula: sanitizeMathFormula(trimmed),
      rawFormula: trimmed,
      displayMode: false,
      newlines: 0,
    });
    return `${MATH_INLINE_PREFIX}${idx}${MATH_SLOT_SUFFIX}`;
  });

  // 6. 还原代码段与货币符号
  const markdown = restoreCodeSegments(text, codeSlots);

  return { markdown, mathSlots };
}

/**
 * 将文本中的数学占位符还原为原始 `$...$` 或 `$$...$$` 源码
 * （专供 TableBlock 单元格与表格导出使用，使表格分词阶段享受占位符对 `|` 的保护，同时单元格内拿到真实公式源码）
 */
export function restoreRawMathInText(text: string, mathSlots: MathSlot[]): string {
  if (!text || !mathSlots || mathSlots.length === 0) return text;

  let res = text.replace(/%%OV_MATH_BLOCK_(\d+)%%/g, (_m, idx) => {
    const slot = mathSlots[Number(idx)];
    if (!slot) return _m;
    return `$$${slot.rawFormula || slot.formula}$$`;
  });

  res = res.replace(/%%OV_MATH_INLINE_(\d+)%%/g, (_m, idx) => {
    const slot = mathSlots[Number(idx)];
    if (!slot) return _m;
    // 在表格单元格中，用户可能编写了 `\|` 来规避 Markdown 表格列切分，还原为公式时将 `\|` 恢复若非 `\Vert`
    return `$${slot.rawFormula || slot.formula}$`;
  });

  return res;
}

/**
 * 将 HTML 中的数学占位符还原为 KaTeX 渲染的高保真 DOM
 */
export function restoreMarkdownMath(html: string, mathSlots: MathSlot[]): string {
  if (!mathSlots || mathSlots.length === 0) return html;

  // 1. 块级公式还原：若整个 <p ...> 仅包含一个或多个块级公式占位符，直接剥除外层 <p> 避免 <div> 嵌套在 <p> 内
  let res = html.replace(
    /<p(\s[^>]*)?>\s*((?:%%OV_MATH_BLOCK_\d+%%\s*)+)<\/p>/g,
    (_m, attrs, inner) => {
      const attrStr = attrs || '';
      return inner.replace(/%%OV_MATH_BLOCK_(\d+)%%/g, (slotMatch: string, idx: string) => {
        const slot = mathSlots[Number(idx)];
        if (!slot) return slotMatch;
        try {
          const rendered = katex.renderToString(slot.formula, getKatexOptions(true, false));
          return `<div class="ov-katex-block"${attrStr}>${rendered}</div>`;
        } catch {
          return `<div class="ov-katex-block"${attrStr}><span class="katex-error" style="color:#f43f5e">${slot.formula}</span></div>`;
        }
      });
    }
  );

  // 处理嵌套在列表项、引用块、Callout 或混合段落内部的块级公式占位符 (使用合法的块级化 span 容器避免破坏外层 <p>)
  res = res.replace(/%%OV_MATH_BLOCK_(\d+)%%/g, (_m, idx) => {
    const slot = mathSlots[Number(idx)];
    if (!slot) return _m;
    try {
      const rendered = katex.renderToString(slot.formula, getKatexOptions(true, false));
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
      const rendered = katex.renderToString(slot.formula, getKatexOptions(false, false));
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
    return `<span class="ov-katex-inline">${katex.renderToString(
      sanitized,
      getKatexOptions(false, false)
    )}</span>`;
  } catch {
    return `<span class="ov-katex-inline"><span class="katex-error" style="color:#f43f5e">${rawFormula}</span></span>`;
  }
}
