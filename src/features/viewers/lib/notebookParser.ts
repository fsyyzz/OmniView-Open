/**
 * OmniView Jupyter Notebook (.ipynb v4) 纯端侧轻量解析与转换引擎
 * 遵循 Jupyter Notebook Format v4 规范，零 Python 运行时依赖
 */

export interface NotebookMetadata {
  kernelspec?: {
    name?: string;
    display_name?: string;
    language?: string;
  };
  language_info?: {
    name?: string;
    version?: string;
    file_extension?: string;
    mimetype?: string;
    codemirror_mode?: string | Record<string, unknown>;
  };
  title?: string;
  authors?: Array<{ name: string }>;
  [key: string]: unknown;
}

export interface NotebookOutput {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
  name?: string; // 'stdout' | 'stderr' for stream
  text?: string | string[];
  data?: {
    'text/plain'?: string | string[];
    'text/html'?: string | string[];
    'text/latex'?: string | string[];
    'image/png'?: string;
    'image/jpeg'?: string;
    'image/svg+xml'?: string | string[];
    'application/json'?: unknown;
    [mime: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface NotebookCell {
  id?: string;
  cell_type: 'markdown' | 'code' | 'raw';
  source: string;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

export interface NotebookData {
  nbformat: number;
  nbformat_minor: number;
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

export interface NotebookStats {
  totalCells: number;
  codeCells: number;
  markdownCells: number;
  rawCells: number;
  executedCount: number;
  language: string;
  kernelName: string;
}

/**
 * 将 source 字段（字符串或字符串数组）规整化为统一的单字符串
 */
export function normalizeSource(source: string | string[] | undefined | null): string {
  if (!source) return '';
  if (Array.isArray(source)) {
    return source.join('');
  }
  return String(source);
}

/**
 * ANSI 终端转义色彩代码转换器（将 Jupyter traceback / stderr 彩色文本转换为安全 HTML）
 */
export function convertAnsiToHtml(ansiText: string): string {
  if (!ansiText) return '';

  const ansiColorMap: Record<string, string> = {
    '30': 'color: #64748b;', // Black/Gray
    '31': 'color: #f43f5e;', // Red
    '32': 'color: #10b981;', // Green
    '33': 'color: #f59e0b;', // Yellow
    '34': 'color: #3b82f6;', // Blue
    '35': 'color: #a855f7;', // Magenta/Purple
    '36': 'color: #06b6d4;', // Cyan
    '37': 'color: #e2e8f0;', // White
    '90': 'color: #94a3b8;', // Bright Black
    '91': 'color: #fb7185;', // Bright Red
    '92': 'color: #34d399;', // Bright Green
    '93': 'color: #fbbf24;', // Bright Yellow
    '94': 'color: #60a5fa;', // Bright Blue
    '95': 'color: #c084fc;', // Bright Magenta
    '96': 'color: #22d3ee;', // Bright Cyan
    '97': 'color: #ffffff;', // Bright White
    '1': 'font-weight: 700;', // Bold
    '2': 'opacity: 0.75;',    // Dim
    '3': 'font-style: italic;', // Italic
    '4': 'text-decoration: underline;', // Underline
  };

  // 替换 HTML 特殊字符防御 XSS
  const escaped = ansiText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 解析 ANSI 转义序列：\u001b[...m 或 \x1b[...m
  const pattern = /(?:\u001b|\x1b)\[([\d;]*)m/g;
  let result = '';
  let lastIndex = 0;
  let activeStyles: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(escaped)) !== null) {
    result += escaped.slice(lastIndex, match.index);
    if (activeStyles.length > 0) {
      result += '</span>';
      activeStyles = [];
    }

    const codes = match[1] ? match[1].split(';') : ['0'];
    const currentStyles: string[] = [];

    for (const code of codes) {
      if (code === '0' || code === '') {
        // Reset
        currentStyles.length = 0;
      } else if (ansiColorMap[code]) {
        currentStyles.push(ansiColorMap[code]);
      }
    }

    if (currentStyles.length > 0) {
      result += `<span style="${currentStyles.join(' ')}">`;
      activeStyles = currentStyles;
    }

    lastIndex = pattern.lastIndex;
  }

  result += escaped.slice(lastIndex);
  if (activeStyles.length > 0) {
    result += '</span>';
  }

  return result;
}

/**
 * 解析 Jupyter Notebook JSON 字符串为强类型对象
 */
export function parseJupyterNotebook(rawJson: string): {
  notebook: NotebookData | null;
  error: string | null;
  stats: NotebookStats;
} {
  const defaultStats: NotebookStats = {
    totalCells: 0,
    codeCells: 0,
    markdownCells: 0,
    rawCells: 0,
    executedCount: 0,
    language: 'Python',
    kernelName: 'Python 3',
  };

  if (!rawJson || !rawJson.trim()) {
    return { notebook: null, error: '文件内容为空', stats: defaultStats };
  }

  try {
    const raw = JSON.parse(rawJson);
    if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.cells)) {
      return {
        notebook: null,
        error: '不是有效的 Jupyter Notebook 结构 (缺少 cells 数组)',
        stats: defaultStats,
      };
    }

    const nbformat = Number(raw.nbformat) || 4;
    const nbformat_minor = Number(raw.nbformat_minor) || 2;
    const metadata: NotebookMetadata = raw.metadata || {};

    const language =
      metadata.language_info?.name ||
      metadata.kernelspec?.language ||
      'python';
    const kernelName =
      metadata.kernelspec?.display_name ||
      metadata.kernelspec?.name ||
      'Python 3';

    let codeCells = 0;
    let markdownCells = 0;
    let rawCells = 0;
    let executedCount = 0;

    const normalizedCells: NotebookCell[] = raw.cells.map((c: Record<string, unknown>, idx: number) => {
      const type = (c.cell_type as string) || 'code';
      const cell_type: 'markdown' | 'code' | 'raw' =
        type === 'markdown' ? 'markdown' : type === 'raw' ? 'raw' : 'code';

      if (cell_type === 'code') {
        codeCells++;
        if (typeof c.execution_count === 'number') {
          executedCount++;
        }
      } else if (cell_type === 'markdown') {
        markdownCells++;
      } else {
        rawCells++;
      }

      const source = normalizeSource(c.source as string | string[]);
      const outputs: NotebookOutput[] = Array.isArray(c.outputs)
        ? (c.outputs as Array<Record<string, unknown>>).map((out) => {
            const outType = (out.output_type as string) || 'stream';
            const output_type =
              outType === 'display_data' || outType === 'execute_result' || outType === 'error'
                ? outType
                : 'stream';

            return {
              output_type,
              name: typeof out.name === 'string' ? out.name : undefined,
              text: out.text ? normalizeSource(out.text as string | string[]) : undefined,
              data: out.data ? (out.data as NotebookOutput['data']) : undefined,
              metadata: typeof out.metadata === 'object' && out.metadata !== null ? (out.metadata as Record<string, unknown>) : undefined,
              execution_count: typeof out.execution_count === 'number' ? out.execution_count : null,
              ename: typeof out.ename === 'string' ? out.ename : undefined,
              evalue: typeof out.evalue === 'string' ? out.evalue : undefined,
              traceback: Array.isArray(out.traceback) ? (out.traceback as string[]) : undefined,
            };
          })
        : [];

      return {
        id: typeof c.id === 'string' ? c.id : `cell_${idx + 1}`,
        cell_type,
        source,
        metadata: (c.metadata as Record<string, unknown>) || {},
        execution_count: typeof c.execution_count === 'number' ? c.execution_count : null,
        outputs,
      };
    });

    const notebook: NotebookData = {
      nbformat,
      nbformat_minor,
      metadata,
      cells: normalizedCells,
    };

    const stats: NotebookStats = {
      totalCells: normalizedCells.length,
      codeCells,
      markdownCells,
      rawCells,
      executedCount,
      language,
      kernelName,
    };

    return { notebook, error: null, stats };
  } catch (err) {
    return {
      notebook: null,
      error: `JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`,
      stats: defaultStats,
    };
  }
}

/**
 * 一键将 Jupyter Notebook 导出为纯净 Markdown 文档
 */
export function exportNotebookToMarkdown(notebook: NotebookData): string {
  if (!notebook || !Array.isArray(notebook.cells)) return '';

  const language = notebook.metadata.language_info?.name || 'python';
  const pieces: string[] = [];

  // 元数据头
  if (notebook.metadata.title) {
    pieces.push(`# ${notebook.metadata.title}\n`);
  }

  for (const cell of notebook.cells) {
    if (cell.cell_type === 'markdown') {
      pieces.push(cell.source.trim());
      pieces.push('\n\n');
    } else if (cell.cell_type === 'code') {
      const codeHeader = cell.execution_count !== null && cell.execution_count !== undefined
        ? `\`\`\`${language} # In [${cell.execution_count}]`
        : `\`\`\`${language}`;

      pieces.push(`${codeHeader}\n${cell.source}\n\`\`\`\n\n`);

      // 提取输出中的文本或图片
      if (cell.outputs && cell.outputs.length > 0) {
        for (const out of cell.outputs) {
          if (out.output_type === 'stream' && out.text) {
            pieces.push(`> **Output (${out.name || 'stdout'}):**\n\`\`\`text\n${out.text}\n\`\`\`\n\n`);
          } else if ((out.output_type === 'execute_result' || out.output_type === 'display_data') && out.data) {
            if (out.data['image/png']) {
              pieces.push(`![Output Image](data:image/png;base64,${out.data['image/png']})\n\n`);
            } else if (out.data['text/plain']) {
              const plain = normalizeSource(out.data['text/plain']);
              pieces.push(`\`\`\`text # Out [${out.execution_count || ''}]\n${plain}\n\`\`\`\n\n`);
            }
          } else if (out.output_type === 'error') {
            pieces.push(`> ⚠️ **Error [${out.ename}]:** ${out.evalue}\n\n`);
          }
        }
      }
    } else if (cell.cell_type === 'raw') {
      pieces.push(`\`\`\`text\n${cell.source}\n\`\`\`\n\n`);
    }
  }

  return pieces.join('').trim();
}

/**
 * 一键将 Jupyter Notebook 导出为纯代码脚本
 */
export function exportNotebookToScript(notebook: NotebookData): string {
  if (!notebook || !Array.isArray(notebook.cells)) return '';

  const pieces: string[] = [];
  const language = (notebook.metadata.language_info?.name || 'python').toLowerCase();
  const commentChar = language === 'javascript' || language === 'typescript' || language === 'c' || language === 'cpp' || language === 'rust' || language === 'go' ? '//' : '#';

  pieces.push(`${commentChar} %% [OmniView Exported Script from Notebook]`);
  pieces.push(`${commentChar} Kernel: ${notebook.metadata.kernelspec?.display_name || 'Python 3'}`);
  pieces.push(`${commentChar} Generated: ${new Date().toISOString()}\n\n`);

  for (let idx = 0; idx < notebook.cells.length; idx++) {
    const cell = notebook.cells[idx];
    if (cell.cell_type === 'code') {
      const execCount = cell.execution_count ? `[${cell.execution_count}]` : `[${idx + 1}]`;
      pieces.push(`${commentChar} %% In ${execCount}\n${cell.source}\n\n`);
    } else if (cell.cell_type === 'markdown') {
      pieces.push(`${commentChar} %% [Markdown Cell ${idx + 1}]\n`);
      const lines = cell.source.split('\n');
      for (const line of lines) {
        pieces.push(`${commentChar} ${line}\n`);
      }
      pieces.push('\n');
    }
  }

  return pieces.join('').trim();
}
