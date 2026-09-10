/**
 * 图表与公式结构化错误诊断与启发式规则修复引擎
 */
import { Locale, t } from '../../../shared/lib/i18n';

export type DiagramType = 'mermaid' | 'graphviz' | 'plantuml' | 'katex' | 'svg';

export interface DiagnosticSuggestion {
  title: string;
  description: string;
  suggestedCode?: string; // 一键修复代码
}

export interface DiagramDiagnostic {
  diagramType: DiagramType;
  diagramTitle: string;
  errorCategory: string;
  rawError: string;
  errorLineOffset?: number; // 相对代码块行号 (1-indexed)
  markdownStartLine?: number; // 在 Markdown 文件中的起始物理行号
  markdownEndLine?: number;
  absoluteErrorLine?: number; // 在 Markdown 文件中的绝对物理行号
  causes: string[];
  suggestions: DiagnosticSuggestion[];
  canAutoFix: boolean;
}

/**
 * 从各类引擎错误字符串中智能提取相对行号
 */
export function extractErrorLineOffset(rawError: string, diagramType: DiagramType): number | undefined {
  if (!rawError) return undefined;

  if (diagramType === 'mermaid') {
    // 匹配 "Parse error on line 5:" 或 "on line 5" 或 "line 5:"
    const match = rawError.match(/(?:Parse error on line|on line|line)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  } else if (diagramType === 'graphviz') {
    // 匹配 "syntax error in line 4" 或 "error: line 4"
    const match = rawError.match(/(?:in line|line)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  } else if (diagramType === 'katex') {
    // KaTeX 通常给出位置 position 15
    const match = rawError.match(/(?:position|line)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * 分析 Mermaid 语法错误并给出结构化诊断与建议
 */
export function analyzeMermaidError(
  code: string,
  rawError: string,
  startLine?: number,
  endLine?: number,
  locale: Locale | string = 'zh-CN'
): DiagramDiagnostic {
  const errorLineOffset = extractErrorLineOffset(rawError, 'mermaid');
  const absoluteErrorLine = (startLine && errorLineOffset) ? startLine + errorLineOffset : startLine;
  const causes: string[] = [];
  const suggestions: DiagnosticSuggestion[] = [];
  const isZh = locale === 'zh-CN';
  const trimmed = code.trim();

  // 规则 1: digraph 关键字误用
  if (/^\s*digraph\b/i.test(trimmed)) {
    causes.push(isZh ? '检测到使用了 Graphviz 关键字 "digraph"，Mermaid 应使用 "graph" 或 "flowchart"' : 'Detected Graphviz keyword "digraph". Mermaid requires "graph" or "flowchart".');
    const fixed = trimmed.replace(/^\s*digraph\b/i, 'flowchart TD');
    suggestions.push({
      title: isZh ? '替换为 Mermaid flowchart 声明' : 'Replace with Mermaid flowchart declaration',
      description: isZh ? '将开头的 "digraph" 改为 "flowchart TD" 或 "graph TD"' : 'Change "digraph" to "flowchart TD"',
      suggestedCode: fixed,
    });
  }

  // 规则 2: sequenceDiagram 缺少声明或语法不规范
  if (/^\s*sequenceDiagram\b/i.test(trimmed)) {
    if (!/->>|-->>|->|-->/i.test(trimmed)) {
      causes.push(isZh ? '时序图中缺少消息传递连接符 (如 "A->>B: 消息内容")' : 'Sequence diagram is missing message connector (e.g. "A->>B: message").');
    }
  }

  // 规则 3: subgraph 缺少 end 闭合
  const subgraphCount = (trimmed.match(/\bsubgraph\b/gi) || []).length;
  const endCount = (trimmed.match(/\bend\b/gi) || []).length;
  if (subgraphCount > endCount) {
    causes.push(isZh ? `存在未闭合的 subgraph (声明了 ${subgraphCount} 个，仅闭合 ${endCount} 个)` : `Unclosed subgraph detected (${subgraphCount} declared, ${endCount} closed).`);
    const fixed = `${trimmed}\n${'  end\n'.repeat(subgraphCount - endCount)}`.trim();
    suggestions.push({
      title: isZh ? '补齐缺失的 end 闭合关键字' : 'Append missing "end" keyword',
      description: isZh ? '在图表末尾自动补齐未闭合的 subgraph 作用域' : 'Auto-append missing "end" to close subgraph scopes',
      suggestedCode: fixed,
    });
  }

  // 规则 4: 节点定义特殊字符未用引号包裹
  if (/\[[^\]]*[:;{}()][^\]]*\]/.test(trimmed)) {
    causes.push(isZh ? '节点文本包含特殊标点符号 (如冒号、括号、花括号)，建议用双引号包裹文本，如 [“文本”]' : 'Node text contains special punctuation. Wrap with quotes like ["text"].');
  }

  // 默认兜底诊断
  if (causes.length === 0) {
    causes.push(isZh ? '图表语法或箭头连接符不符合 Mermaid.js 规范' : 'Diagram syntax or connectors do not conform to Mermaid.js grammar.');
    causes.push(isZh ? '关键字拼写错误或当前图表类型不支持该语法' : 'Keyword typo or unsupported syntax for the active diagram type.');
  }

  return {
    diagramType: 'mermaid',
    diagramTitle: t('mermaidTitle', locale),
    errorCategory: isZh ? 'Mermaid 语法解析异常' : 'Mermaid Syntax Parse Error',
    rawError,
    errorLineOffset,
    markdownStartLine: startLine,
    markdownEndLine: endLine,
    absoluteErrorLine,
    causes,
    suggestions,
    canAutoFix: suggestions.some(s => !!s.suggestedCode),
  };
}

/**
 * 分析 Graphviz (DOT) 语法错误并给出结构化诊断与建议
 */
export function analyzeGraphvizError(
  code: string,
  rawError: string,
  startLine?: number,
  endLine?: number,
  locale: Locale | string = 'zh-CN'
): DiagramDiagnostic {
  const errorLineOffset = extractErrorLineOffset(rawError, 'graphviz');
  const absoluteErrorLine = (startLine && errorLineOffset) ? startLine + errorLineOffset : startLine;
  const causes: string[] = [];
  const suggestions: DiagnosticSuggestion[] = [];
  const isZh = locale === 'zh-CN';
  const trimmed = code.trim();

  // 规则 1: 有向图 (digraph) 误用无向边 (--)
  if (/^\s*(?:strict\s+)?digraph\b/i.test(trimmed) && /--\s*[a-zA-Z0-9_"]/.test(trimmed)) {
    causes.push(isZh ? '检测到有向图 (digraph) 中使用了无向边语法 "--"' : 'Directed graph (digraph) cannot use undirected edge operator "--".');
    const fixed = trimmed.replace(/([a-zA-Z0-9_"]+)\s*--\s*([a-zA-Z0-9_"]+)/g, '$1 -> $2');
    suggestions.push({
      title: isZh ? '将无向边 "--" 批量修复为有向边 "->"' : 'Convert undirected edges "--" to "->"',
      description: isZh ? '有向图中的关系必须使用 "->" 连接' : 'Edges in digraph must use "->"',
      suggestedCode: fixed,
    });
  }

  // 规则 2: 无向图 (graph) 误用有向边 (->)
  if (/^\s*(?:strict\s+)?graph\b/i.test(trimmed) && !/^\s*(?:strict\s+)?digraph\b/i.test(trimmed) && /->\s*[a-zA-Z0-9_"]/.test(trimmed)) {
    causes.push(isZh ? '检测到无向图 (graph) 中使用了有向箭头语法 "->"' : 'Undirected graph (graph) cannot use directed edge operator "->".');
    const fixed = trimmed.replace(/([a-zA-Z0-9_"]+)\s*->\s*([a-zA-Z0-9_"]+)/g, '$1 -- $2');
    suggestions.push({
      title: isZh ? '将有向边 "->" 批量修复为无向边 "--"' : 'Convert directed edges "->" to "--"',
      description: isZh ? '无向图中的关系必须使用 "--" 连接' : 'Edges in graph must use "--"',
      suggestedCode: fixed,
    });
  }

  // 规则 3: 缺少闭合的花括号 }
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    causes.push(isZh ? `花括号未正确闭合 (开括号 { 共 ${openBraces} 个，闭括号 } 仅 ${closeBraces} 个)` : `Mismatched braces (${openBraces} open '{', ${closeBraces} close '}').`);
    const fixed = `${trimmed}\n${'}'.repeat(openBraces - closeBraces)}`;
    suggestions.push({
      title: isZh ? '自动补齐缺失的闭括号 "}"' : 'Append missing closing brace "}"',
      description: isZh ? '在 DOT 图表末尾自动补齐闭合花括号' : 'Auto-append closing brace to end of diagram',
      suggestedCode: fixed,
    });
  }

  // 规则 4: 缺少 digraph / graph 根定义包裹
  if (!/^\s*(?:strict\s+)?(?:digraph|graph)\b/i.test(trimmed)) {
    causes.push(isZh ? 'DOT 代码缺少根图声明 (必须以 "digraph G {" 或 "graph G {" 开头)' : 'Missing root graph declaration (must start with "digraph G {" or "graph G {").');
    const fixed = `digraph G {\n  rankdir=LR;\n  node [shape=box];\n  ${trimmed}\n}`;
    suggestions.push({
      title: isZh ? '包裹标准 digraph 容器' : 'Wrap with standard digraph container',
      description: isZh ? '添加 "digraph G { ... }" 外层包裹' : 'Add "digraph G { ... }" wrapper',
      suggestedCode: fixed,
    });
  }

  if (causes.length === 0) {
    causes.push(isZh ? 'DOT 语法解析错误，可能存在非法属性名或标点未转义' : 'DOT syntax error, invalid attributes or unescaped characters.');
    causes.push(isZh ? '节点名或标签如果包含中文或空格，必须用双引号包裹' : 'Node names with spaces or Unicode must be enclosed in quotes.');
  }

  return {
    diagramType: 'graphviz',
    diagramTitle: t('graphvizTitle', locale),
    errorCategory: isZh ? 'Graphviz DOT 编译错误' : 'Graphviz DOT Compilation Error',
    rawError,
    errorLineOffset,
    markdownStartLine: startLine,
    markdownEndLine: endLine,
    absoluteErrorLine,
    causes,
    suggestions,
    canAutoFix: suggestions.some(s => !!s.suggestedCode),
  };
}

/**
 * 分析 KaTeX 数学公式语法错误并给出结构化诊断与建议
 */
export function analyzeKatexError(
  code: string,
  rawError: string,
  startLine?: number,
  endLine?: number,
  locale: Locale | string = 'zh-CN'
): DiagramDiagnostic {
  const causes: string[] = [];
  const suggestions: DiagnosticSuggestion[] = [];
  const isZh = locale === 'zh-CN';
  const trimmed = code.trim();

  // 规则 1: \left 与 \right 不匹配
  const leftMatches = (trimmed.match(/\\left\b/g) || []).length;
  const rightMatches = (trimmed.match(/\\right\b/g) || []).length;
  if (leftMatches !== rightMatches) {
    causes.push(isZh ? `\\left 与 \\right 定界符数量不匹配 (\\left 有 ${leftMatches} 个，\\right 有 ${rightMatches} 个)` : `Mismatched \\left and \\right delimiters (${leftMatches} vs ${rightMatches}).`);
    if (leftMatches > rightMatches) {
      const fixed = `${trimmed} \\right.`;
      suggestions.push({
        title: isZh ? '补齐 \\right. 隐式闭合定界符' : 'Append \\right. invisible delimiter',
        description: isZh ? '在公式末尾补齐 \\right. 闭合未完成的 \\left' : 'Add \\right. to close open \\left delimiter',
        suggestedCode: fixed,
      });
    }
  }

  // 规则 2: 环境未正确结束 (\begin{matrix} 缺少 \end{matrix})
  const beginEnv = trimmed.match(/\\begin\{([a-zA-Z*]+)\}/);
  if (beginEnv && !trimmed.includes(`\\end{${beginEnv[1]}}`)) {
    causes.push(isZh ? `环境 \\begin{${beginEnv[1]}} 缺少对应的 \\end{${beginEnv[1]}} 闭合` : `Environment \\begin{${beginEnv[1]}} is missing matching \\end{${beginEnv[1]}}.`);
    const fixed = `${trimmed}\n\\end{${beginEnv[1]}}`;
    suggestions.push({
      title: isZh ? `补齐 \\end{${beginEnv[1]}}` : `Append \\end{${beginEnv[1]}}`,
      description: isZh ? `在公式末尾闭合 \\begin{${beginEnv[1]}} 环境` : `Close environment with \\end{${beginEnv[1]}}`,
      suggestedCode: fixed,
    });
  }

  // 规则 3: 连续下标 / 上标双重嵌套
  if (/_[a-zA-Z0-9]_[a-zA-Z0-9]|\^[a-zA-Z0-9]\^[a-zA-Z0-9]/.test(trimmed)) {
    causes.push(isZh ? '检测到双重连续上下标 (如 x_1_2 或 x^1^2)，在 LaTeX 中必须使用大括号嵌套，如 x_{1_2}' : 'Double sub/superscript detected. Wrap with braces e.g. x_{1_2}.');
  }

  if (causes.length === 0) {
    causes.push(isZh ? 'LaTeX 宏命令未知或公式语法格式不规范' : 'Unknown LaTeX macro or invalid formula syntax.');
    causes.push(isZh ? '请检查特殊符号（如 %, _, #, &）是否已正确转义' : 'Check if reserved symbols (%, _, #, &) are properly escaped.');
  }

  return {
    diagramType: 'katex',
    diagramTitle: t('mathFormula', locale),
    errorCategory: isZh ? 'KaTeX 公式解析异常' : 'KaTeX Formula Parse Error',
    rawError,
    markdownStartLine: startLine,
    markdownEndLine: endLine,
    absoluteErrorLine: startLine,
    causes,
    suggestions,
    canAutoFix: suggestions.some(s => !!s.suggestedCode),
  };
}

/**
 * 分析 PlantUML 错误并给出结构化诊断与建议
 */
export function analyzePlantUmlError(
  code: string,
  rawError: string,
  startLine?: number,
  endLine?: number,
  locale: Locale | string = 'zh-CN'
): DiagramDiagnostic {
  const causes: string[] = [];
  const suggestions: DiagnosticSuggestion[] = [];
  const isZh = locale === 'zh-CN';
  const trimmed = code.trim();

  // 规则 1: 缺少 @startuml 或 @enduml
  if (!trimmed.includes('@startuml') || !trimmed.includes('@enduml')) {
    causes.push(isZh ? 'PlantUML 代码建议以 @startuml 开头并以 @enduml 结束' : 'PlantUML code should be wrapped between @startuml and @enduml.');
    let fixed = trimmed;
    if (!fixed.includes('@startuml')) fixed = `@startuml\n${fixed}`;
    if (!fixed.includes('@enduml')) fixed = `${fixed}\n@enduml`;
    suggestions.push({
      title: isZh ? '补齐 @startuml 与 @enduml 围栏' : 'Wrap with @startuml and @enduml',
      description: isZh ? '自动添加标准 PlantUML 起始与结束标识' : 'Add standard start and end markers',
      suggestedCode: fixed,
    });
  }

  // 规则 2: 网络 / 服务端异常
  if (/network|offline|failed to fetch|404|500|timeout/i.test(rawError)) {
    causes.push(isZh ? '无法连接到 PlantUML 在线渲染服务，图表代码本身可能并无语法错误' : 'Unable to connect to PlantUML server. The code itself may be syntactically valid.');
    causes.push(isZh ? '请检查网络代理设置或当前网络环境是否允许访问 plantuml.com' : 'Check network connectivity to plantuml.com.');
  } else {
    causes.push(isZh ? '图表语法或箭头关系不符合 PlantUML 规范' : 'Diagram syntax or relations do not match PlantUML grammar.');
  }

  return {
    diagramType: 'plantuml',
    diagramTitle: t('plantUmlTitle', locale),
    errorCategory: isZh ? 'PlantUML 渲染异常' : 'PlantUML Render Error',
    rawError,
    markdownStartLine: startLine,
    markdownEndLine: endLine,
    absoluteErrorLine: startLine,
    causes,
    suggestions,
    canAutoFix: suggestions.some(s => !!s.suggestedCode),
  };
}
