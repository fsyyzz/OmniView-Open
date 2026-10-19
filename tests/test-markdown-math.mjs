import { marked } from 'marked';
import {
  processMarkdownMath,
  restoreMarkdownMath,
  sanitizeMathFormula,
  renderInlineMath,
} from '../src/features/viewers/lib/markdownMath';

function runSuite() {
  console.log('--- Test 1: User Reported Problematic Markdown ---');
  const userMd = `
### 1. 核心流程

1. **有效字节求和**:
   - 逐行扫描文本;
   - 遇到以 \`CHK1,\` 开头的校验行自身直接跳过，不参与计算;
   - 忽略所有回车符 \`\\r\` (CR) 与换行符 \`\\n\` (LF);
   - 将其余所有字节以无符号方式累加至 32 位整型累加和 $S$。
2. **密钥变换混淆**:
   - 采用 32 位密钥 $K$ (默认值为 \`0x5A11FC05\`, 经 17 份生产样本反推并 100% 验证吻合);
   - 将密钥拆解为 4 个单字节参数: 除数 $d=0x5A$、加数 $a=0x11$、异或因子 $x=0xFC$、乘数 $m=0x05$;
   - 变换步骤:
     1. **除法缩放**: 若 $d \\neq 0$，则 $S = S \\div d$;
     2. **字节加法与异或**:
        - $b_2 = (((S \\gg 8) \\& 0xFF + a) \\& 0xFF) \\oplus x$
        - $b_3 = ((S \\& 0xFF + a) \\& 0xFF) \\oplus x$
     3. **乘数截断**:
        - $CHK = ((b_2 \\ll 8 \\mid b_3) \\times m) \\& 0xFFFF$
3. **格式化输出**:
   - 以小写 4 位十六进制格式化为 \`CHK1,%04x\`。
`;

  const { markdown: processed, mathSlots } = processMarkdownMath(userMd);
  const tokens = marked.lexer(processed);
  const renderer = new marked.Renderer();
  let html = '';
  for (const token of tokens) {
    html += marked.parser([token], { renderer });
  }
  const finalHtml = restoreMarkdownMath(html, mathSlots);

  if (finalHtml.includes('katex-error') || finalHtml.includes('#f43f5e')) {
    throw new Error('Test 1 Failed: KaTeX error found in user markdown');
  }
  if (!finalHtml.includes('class="katex"')) {
    throw new Error('Test 1 Failed: KaTeX rendered elements not found');
  }
  console.log('Test 1 PASSED: Zero errors, math formulas beautifully rendered.');

  console.log('--- Test 2: Line count conservation ---');
  const lineTestMd = `Line 1
Line 2
$$
\\begin{matrix}
a & b \\\\
c & d
\\end{matrix}
$$
Line 10`;

  const origLines = lineTestMd.split('\n').length;
  const { markdown: processedLines } = processMarkdownMath(lineTestMd);
  const processedLineCount = processedLines.split('\n').length;
  if (origLines !== processedLineCount) {
    throw new Error(`Test 2 Failed: Line count mismatch! orig=${origLines}, processed=${processedLineCount}`);
  }
  console.log('Test 2 PASSED: Line count strictly conserved.');

  console.log('--- Test 3: Multiple underscores in single and adjacent formulas ---');
  const underscoreMd = `Formula A: $x_1 + x_2 + x_3$ and Formula B: $y_1$ then $y_2$`;
  const { markdown: uProc, mathSlots: uSlots } = processMarkdownMath(underscoreMd);
  const uHtml = restoreMarkdownMath(marked.parse(uProc), uSlots);
  if (uHtml.includes('<em>')) {
    throw new Error('Test 3 Failed: Underscores in math were converted to <em> emphasis');
  }
  console.log('Test 3 PASSED: Underscores protected from italic conversion.');

  console.log('--- Test 4: Less-than and Greater-than (< and >) in formulas ---');
  const cmpMd = `Inequality: $a < b$ and $c > d$ and $x \\le y$`;
  const { markdown: cProc, mathSlots: cSlots } = processMarkdownMath(cmpMd);
  const cHtml = restoreMarkdownMath(marked.parse(cProc), cSlots);
  if (cHtml.includes('katex-error')) {
    throw new Error('Test 4 Failed: Comparison operators failed in math');
  }
  console.log('Test 4 PASSED: Comparison operators correctly rendered.');

  console.log('--- Test 5: Currency and Escaped Dollar Signs ---');
  const currMd = `Price is $100 and \\$200 and not math: $99.99`;
  const { markdown: currProc, mathSlots: currSlots } = processMarkdownMath(currMd);
  if (currSlots.length !== 0) {
    throw new Error(`Test 5 Failed: Currency was mistakenly parsed as math slots! Count=${currSlots.length}`);
  }
  console.log('Test 5 PASSED: Currency and escaped dollars preserved as normal text.');

  console.log('--- Test 6: Alignment environment matrix with & ---');
  const matrixMd = `$$
\\begin{matrix}
1 & 2 \\\\
3 & 4
\\end{matrix}
$$`;
  const { markdown: mProc, mathSlots: mSlots } = processMarkdownMath(matrixMd);
  const mHtml = restoreMarkdownMath(marked.parse(mProc), mSlots);
  if (mHtml.includes('katex-error')) {
    throw new Error('Test 6 Failed: Matrix alignment failed');
  }
  console.log('Test 6 PASSED: Matrix with & alignment correctly rendered.');

  console.log('--- Test 7: Isolated unescaped & inside formula tolerated ---');
  const isolatedAndMd = `Bitwise: $CHK = (val & 0xFF) ^ 0x5A$`;
  const { markdown: iProc, mathSlots: iSlots } = processMarkdownMath(isolatedAndMd);
  const iHtml = restoreMarkdownMath(marked.parse(iProc), iSlots);
  if (iHtml.includes('katex-error')) {
    throw new Error('Test 7 Failed: Isolated & caused katex error');
  }
  console.log('Test 7 PASSED: Isolated & gracefully rendered with tolerance.');

  console.log('--- Test 8: renderInlineMath standalone function ---');
  const rendered = renderInlineMath('d \\neq 0');
  if (!rendered.includes('class="ov-katex-inline"') || rendered.includes('katex-error')) {
    throw new Error('Test 8 Failed: renderInlineMath did not render properly');
  }
  console.log('Test 8 PASSED: renderInlineMath works as expected.');

  console.log('--- Test 9: Same-line CJK Currency + Math and Currency Range ($100~$200) ---');
  const cjkCurrencyMath = '消费了$100，剩余金额为$x - 100$元；预算在 $100~$200 之间，满足 $x \\le 200$。';
  const { markdown: cjkProc, mathSlots: cjkSlots } = processMarkdownMath(cjkCurrencyMath);
  const cjkHtml = restoreMarkdownMath(marked.parse(cjkProc), cjkSlots);
  if (cjkSlots.length !== 2 || cjkSlots[0].formula !== 'x - 100' || cjkSlots[1].formula !== 'x \\le 200') {
    throw new Error(`Test 9 Failed: Currency + Math slots mismatch: ${JSON.stringify(cjkSlots)}`);
  }
  if (!cjkHtml.includes('消费了$100') || !cjkHtml.includes('$100~$200') || cjkHtml.includes('katex-error')) {
    throw new Error('Test 9 Failed: Currency text or formula corrupted in rendered HTML');
  }
  console.log('Test 9 PASSED: Same-line currency and math formulas disambiguated accurately.');

  console.log('--- Test 10: Standard LaTeX \\[ ... \\] and \\( ... \\) delimiters + inner spaces ---');
  const latexDelimMd = '行内 \\( a^2 + b^2 = c^2 \\) 与带空格公式 $ \\alpha + \\beta = \\gamma $，块级：\n\\[\n\\int_0^1 x^2 dx = \\frac{1}{3}\n\\]';
  const { markdown: ldProc, mathSlots: ldSlots } = processMarkdownMath(latexDelimMd);
  const ldHtml = restoreMarkdownMath(marked.parse(ldProc), ldSlots);
  if (ldSlots.length !== 3 || ldHtml.includes('katex-error')) {
    throw new Error(`Test 10 Failed: Expected 3 slots without error, got ${ldSlots.length}`);
  }
  console.log('Test 10 PASSED: Standard LaTeX \\[...\\], \\(...\\), and spaced $ ... $ supported.');

  console.log('--- Test 11: Multiline $$ inside Blockquote / Callout without breaking container ---');
  const bqMathMd = `> [!NOTE]\n> 推导过程：\n> $$\n> \\begin{aligned}\n> a &= b + 1 \\\\\n> c &= d + 2\n> \\end{aligned}\n> $$\n> 结论成立。`;
  const { markdown: bqProc, mathSlots: bqSlots } = processMarkdownMath(bqMathMd);
  const bqTokens = marked.lexer(bqProc);
  const bqHtml = restoreMarkdownMath(marked.parse(bqProc), bqSlots);
  if (bqTokens.length !== 1 || bqTokens[0].type !== 'blockquote') {
    throw new Error(`Test 11 Failed: Blockquote was split into ${bqTokens.length} tokens!`);
  }
  if (bqSlots[0].formula.includes('>') || bqHtml.includes('katex-error')) {
    throw new Error(`Test 11 Failed: Blockquote '>' leaked into formula: ${bqSlots[0].formula}`);
  }
  console.log('Test 11 PASSED: Multiline $$ inside blockquote/callout conserved cleanly.');

  console.log('--- Test 12: Indented code fences in lists protected from math extraction ---');
  const indentedFenceMd = `- 列表脚本：\n  \`\`\`bash\n  export PATH="$HOME/bin:$PATH"\n  echo "PID=$$"\n  \`\`\``;
  const { markdown: ifProc, mathSlots: ifSlots } = processMarkdownMath(indentedFenceMd);
  if (ifSlots.length !== 0 || ifProc.includes('OV_MATH')) {
    throw new Error(`Test 12 Failed: Indented code fence was corrupted by math extractor!`);
  }
  console.log('Test 12 PASSED: Indented code fences in lists 100% protected.');

  console.log('--- Test 13: Extended environments (align*, eqnarray, multline), % percent, macros & unbalanced \\left ---');
  const extMd = `
Inline percent: $r = 95%$ and unbalanced $\\left( \\frac{a}{b}$ and macros $\\abs{x} + \\norm{y} \\in \\R$.
$$
\\begin{align*}
f(x) &= x^2 % 注释
\\\\
g(x) &= \\argmin_x f(x)
\\end{align*}
$$
$$
\\begin{eqnarray}
u & = & v + w
\\end{eqnarray}
$$`;
  const { markdown: exProc, mathSlots: exSlots } = processMarkdownMath(extMd);
  const exHtml = restoreMarkdownMath(marked.parse(exProc), exSlots);
  if (exHtml.includes('katex-error')) {
    throw new Error(`Test 13 Failed: Extended environments or macros produced katex-error`);
  }
  console.log('Test 13 PASSED: align*, eqnarray, % handling, unbalanced \\left, and built-in macros passed.');

  console.log('\n========================================');
  console.log('ALL SUITE TESTS PASSED WITH 100% ACCURACY');
  console.log('========================================');
}

runSuite();
