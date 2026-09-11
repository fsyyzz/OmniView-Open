/**
 * Typst 原生数学与符号语法 -> KaTeX / LaTeX 表达式转换器
 * 支持 Typst 常用符号、Greek 字母、上下标括号、函数调用 (frac, sqrt, etc.)、狄拉克与点号转换
 */

const GREEK_SYMBOLS: Record<string, string> = {
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  Gamma: '\\Gamma',
  delta: '\\delta',
  Delta: '\\Delta',
  epsilon: '\\epsilon',
  eps: '\\varepsilon',
  zeta: '\\zeta',
  eta: '\\eta',
  theta: '\\theta',
  Theta: '\\Theta',
  iota: '\\iota',
  kappa: '\\kappa',
  lambda: '\\lambda',
  Lambda: '\\Lambda',
  mu: '\\mu',
  nu: '\\nu',
  xi: '\\xi',
  Xi: '\\Xi',
  pi: '\\pi',
  Pi: '\\Pi',
  rho: '\\rho',
  sigma: '\\sigma',
  Sigma: '\\Sigma',
  tau: '\\tau',
  upsilon: '\\upsilon',
  Upsilon: '\\Upsilon',
  phi: '\\phi',
  Phi: '\\Phi',
  chi: '\\chi',
  psi: '\\psi',
  Psi: '\\Psi',
  omega: '\\omega',
  Omega: '\\Omega',
};

const MATH_OPERATORS: Record<string, string> = {
  in: '\\in',
  notin: '\\notin',
  subset: '\\subset',
  subseteq: '\\subseteq',
  supset: '\\supset',
  supseteq: '\\supseteq',
  forall: '\\forall',
  exists: '\\exists',
  nexists: '\\nexists',
  infinity: '\\infty',
  oo: '\\infty',
  nabla: '\\nabla',
  partial: '\\partial',
  pm: '\\pm',
  mp: '\\mp',
  times: '\\times',
  div: '\\div',
  cdot: '\\cdot',
  star: '\\star',
  circ: '\\circ',
  bullet: '\\bullet',
  approx: '\\approx',
  equiv: '\\equiv',
  prop: '\\propto',
  propto: '\\propto',
  le: '\\le',
  ge: '\\ge',
  leq: '\\le',
  geq: '\\ge',
  ne: '\\ne',
  neq: '\\ne',
  arrow: '\\to',
  to: '\\to',
  implies: '\\implies',
  iff: '\\iff',
  rightarrow: '\\rightarrow',
  leftarrow: '\\leftarrow',
  Rightarrow: '\\Rightarrow',
  Leftarrow: '\\Leftarrow',
  dots: '\\dots',
  cdots: '\\cdots',
  quad: '\\quad',
  qquad: '\\qquad',
};

/**
 * 将 Typst 原生数学表达式转换为标准 LaTeX/KaTeX 可渲染表达式
 */
export function convertTypstMathToLatex(typstMath: string): string {
  if (!typstMath) return '';
  let expr = typstMath.trim();

  // 0. 特殊花体与符号 (cal(S) -> \mathcal{S}, bb(R) -> \mathbb{R}, frak(g) -> \mathfrak{g})
  expr = expr.replace(/\bcal\(([^)]+)\)/g, '\\mathcal{$1}');
  expr = expr.replace(/\bbb\(([^)]+)\)/g, '\\mathbb{$1}');
  expr = expr.replace(/\bfrak\(([^)]+)\)/g, '\\mathfrak{$1}');

  // 1. 狄拉克括号与特殊符号：angle.l / angle.r -> \langle / \rangle
  expr = expr.replace(/angle\.l/g, '\\langle');
  expr = expr.replace(/angle\.r/g, '\\rangle');
  expr = expr.replace(/\|([^|]+)\\rangle/g, '|$1\\rangle');

  // 2. 函数转换：frac(a, b) -> \frac{a}{b}, sqrt(x) -> \sqrt{x}
  expr = expr.replace(/\bfrac\(([^,]+),\s*([^)]+)\)/g, '\\frac{$1}{$2}');
  expr = expr.replace(/\bsqrt\(([^)]+)\)/g, '\\sqrt{$1}');

  // 3. 求和、乘积、积分与上下限：sum_(i=1)^n -> \sum_{i=1}^n, product_ -> \prod_
  expr = expr.replace(/\bsum_([a-zA-Z0-9]+|\([^)]+\))/g, (_m, sub) => {
    const cleanSub = sub.startsWith('(') && sub.endsWith(')') ? sub.slice(1, -1) : sub;
    return `\\sum_{${cleanSub}}`;
  });
  expr = expr.replace(/\bsum\b/g, '\\sum');

  expr = expr.replace(/\bproduct_([a-zA-Z0-9]+|\([^)]+\))/g, (_m, sub) => {
    const cleanSub = sub.startsWith('(') && sub.endsWith(')') ? sub.slice(1, -1) : sub;
    return `\\prod_{${cleanSub}}`;
  });
  expr = expr.replace(/\bproduct\b/g, '\\prod');

  expr = expr.replace(/\bintegral\b/g, '\\int');
  expr = expr.replace(/\bint\b/g, '\\int');

  // 4. 下标与上标括号转换：x_(a b) -> x_{a b}, x^(2 n) -> x^{2 n}
  expr = expr.replace(/_\(([^)]+)\)/g, '_{$1}');
  expr = expr.replace(/\^\(([^)]+)\)/g, '^{$1}');

  // 5. 符号与希腊字母单词替换 (整词替换)
  for (const [typWord, latexCmd] of Object.entries(GREEK_SYMBOLS)) {
    const regex = new RegExp(`(?<![a-zA-Z\\\\])${typWord}(?![a-zA-Z])`, 'g');
    expr = expr.replace(regex, latexCmd);
  }

  for (const [typWord, latexCmd] of Object.entries(MATH_OPERATORS)) {
    const regex = new RegExp(`(?<![a-zA-Z\\\\])${typWord}(?![a-zA-Z])`, 'g');
    expr = expr.replace(regex, ` ${latexCmd} `);
  }

  // 6. 简单的斜杠分数转 \frac (例如 (8 pi G) / c^4 -> \frac{8 \pi G}{c^4} )
  expr = expr.replace(/\(([^()]+)\)\s*\/\s*([a-zA-Z0-9_^{}]+|\([^()]+\))/g, (_m, num, den) => {
    const cleanDen = den.startsWith('(') && den.endsWith(')') ? den.slice(1, -1) : den;
    return `\\frac{${num.trim()}}{${cleanDen.trim()}}`;
  });

  return expr.trim();
}
