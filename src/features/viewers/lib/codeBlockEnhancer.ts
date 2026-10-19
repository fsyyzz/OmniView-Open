/**
 * OmniView Markdown 代码块智能增强纯函数引擎 (P1)
 *
 * 核心能力：
 * 1. Shell / Bash / Terminal 命令行提示符 ($ / ❯ / PS>) 智能识别与一键纯净命令剥离复制
 * 2. JSON / YAML / CSV / TSV 结构化数据代码块原地解析（支持表格视图与层级键值树预览切换）
 */

export interface StructuredTableData {
  kind: 'table';
  headers: string[];
  rows: string[][];
}

export interface StructuredTreeEntry {
  path: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  depth: number;
}

export interface StructuredTreeData {
  kind: 'tree';
  entries: StructuredTreeEntry[];
}

export type StructuredCodePreview =
  | StructuredTableData
  | StructuredTreeData
  | { kind: 'error'; message: string };

const SHELL_LANGS = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'console',
  'terminal',
  'powershell',
  'ps1',
  'pwsh',
  'cmd',
  'bat',
  'dos',
]);

const STRUCTURED_LANGS = new Set(['json', 'jsonc', 'yaml', 'yml', 'csv', 'tsv']);

const PROMPT_LINE_REGEX = /^\s*(?:\$|❯|PS(?: [^>]*)?>)\s+(.*)$/;

/**
 * 判断代码块是否为可剥离提示符的终端命令块
 */
export function isShellCommandBlock(lang = '', code = ''): boolean {
  const normalizedLang = lang.trim().toLowerCase();
  const lines = code.split(/\r?\n/);
  const hasPromptLines = lines.some(l => PROMPT_LINE_REGEX.test(l));
  if (hasPromptLines) return true;
  return SHELL_LANGS.has(normalizedLang) && lines.some(l => l.trim().length > 0);
}

/**
 * 判断代码块是否包含显式终端提示符 ($ / ❯ / PS>)
 */
export function hasExplicitShellPrompts(code = ''): boolean {
  return code.split(/\r?\n/).some(l => PROMPT_LINE_REGEX.test(l));
}

/**
 * 智能剥离 Shell 终端提示符（如 `$ npm install` -> `npm install`），
 * 若包含显式 `$ ` 提示符且混有终端输出行，则自动过滤非命令回显输出，仅保留可执行命令与注释
 */
export function stripShellPrompts(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const hasPrompt = lines.some(l => PROMPT_LINE_REGEX.test(l));

  if (!hasPrompt) {
    return code.trim();
  }

  const cleaned: string[] = [];
  let continuingCommand = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continuingCommand = false;
      continue;
    }

    if (continuingCommand) {
      cleaned.push(rawLine);
      continuingCommand = trimmed.endsWith('\\');
      continue;
    }

    const match = rawLine.match(PROMPT_LINE_REGEX);
    if (match) {
      const cmd = match[1];
      cleaned.push(cmd);
      continuingCommand = cmd.trim().endsWith('\\');
      continue;
    }

    // 保留显式注释行
    if (trimmed.startsWith('#')) {
      cleaned.push(rawLine);
    }
  }

  return cleaned.join('\n').trim();
}

/**
 * 判断代码语言是否支持原地「源码 / 结构化视图」切换
 */
export function isStructuredDataLang(lang = ''): boolean {
  return STRUCTURED_LANGS.has(lang.trim().toLowerCase());
}

/**
 * 解析 CSV/TSV 单行（支持双引号转义）
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * 将 JSON 对象递归展平为带深度的结构化键值树条目
 */
function flattenObjectToTree(
  val: unknown,
  prefix = '',
  depth = 0,
  acc: StructuredTreeEntry[] = []
): StructuredTreeEntry[] {
  if (acc.length >= 250) return acc;

  if (Array.isArray(val)) {
    val.forEach((item, idx) => {
      const key = `[${idx}]`;
      const path = prefix ? `${prefix}${key}` : key;
      if (item !== null && typeof item === 'object') {
        acc.push({
          path,
          key,
          value: Array.isArray(item) ? `Array(${item.length})` : '{...}',
          type: Array.isArray(item) ? 'array' : 'object',
          depth,
        });
        flattenObjectToTree(item, path, depth + 1, acc);
      } else {
        acc.push({
          path,
          key,
          value: String(item),
          type: item === null ? 'null' : (typeof item as 'string' | 'number' | 'boolean'),
          depth,
        });
      }
    });
    return acc;
  }

  if (val !== null && typeof val === 'object') {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (acc.length >= 250) break;
      const path = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') {
        acc.push({
          path,
          key: k,
          value: Array.isArray(v) ? `Array(${v.length})` : '{...}',
          type: Array.isArray(v) ? 'array' : 'object',
          depth,
        });
        flattenObjectToTree(v, path, depth + 1, acc);
      } else {
        acc.push({
          path,
          key: k,
          value: v === null ? 'null' : String(v),
          type: v === null ? 'null' : (typeof v as 'string' | 'number' | 'boolean'),
          depth,
        });
      }
    }
  }

  return acc;
}

/**
 * 轻量解析 YAML 代码块为结构化键值树条目
 */
function parseYamlToTree(code: string): StructuredCodePreview {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const entries: StructuredTreeEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed === '---' || trimmed === '...') continue;

    const indent = raw.match(/^\s*/)?.[0].length || 0;
    const depth = Math.floor(indent / 2);

    // 列表项 `- key: val` 或 `- item`
    if (trimmed.startsWith('- ')) {
      const rest = trimmed.slice(2).trim();
      const kvMatch = rest.match(/^([^:]+):\s*(.*)$/);
      if (kvMatch) {
        entries.push({
          path: `line-${i}`,
          key: `- ${kvMatch[1].trim()}`,
          value: kvMatch[2].trim() || '{...}',
          type: kvMatch[2].trim() ? 'string' : 'object',
          depth,
        });
      } else {
        entries.push({
          path: `line-${i}`,
          key: '-',
          value: rest,
          type: 'string',
          depth,
        });
      }
      continue;
    }

    const kvMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const rawVal = kvMatch[2].replace(/\s+#.*$/, '').trim();
      if (!rawVal) {
        entries.push({
          path: `line-${i}-${key}`,
          key,
          value: '{...}',
          type: 'object',
          depth,
        });
      } else {
        const unquoted = rawVal.replace(/^['"]|['"]$/g, '');
        let type: StructuredTreeEntry['type'] = 'string';
        if (rawVal === 'true' || rawVal === 'false') type = 'boolean';
        else if (rawVal === 'null' || rawVal === '~') type = 'null';
        else if (!isNaN(Number(rawVal)) && rawVal !== '') type = 'number';
        else if (rawVal.startsWith('[') && rawVal.endsWith(']')) type = 'array';

        entries.push({
          path: `line-${i}-${key}`,
          key,
          value: unquoted,
          type,
          depth,
        });
      }
    }
  }

  if (entries.length === 0) {
    return { kind: 'error', message: '未检测到可解析的 YAML 键值结构' };
  }

  return { kind: 'tree', entries };
}

/**
 * 解析 JSON / YAML / CSV / TSV 代码块为结构化预览数据
 */
export function parseStructuredCodeBlock(lang: string, code: string): StructuredCodePreview {
  const normalized = lang.trim().toLowerCase();
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return { kind: 'error', message: '空数据块' };
  }

  if (normalized === 'csv' || normalized === 'tsv') {
    const delimiter = normalized === 'tsv' ? '\t' : ',';
    const lines = trimmedCode
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      return { kind: 'error', message: '无有效表格行' };
    }
    const headers = parseDelimitedLine(lines[0], delimiter);
    const rows = lines.slice(1).map(l => parseDelimitedLine(l, delimiter));
    return { kind: 'table', headers, rows };
  }

  if (normalized === 'json' || normalized === 'jsonc') {
    try {
      const cleanJson =
        normalized === 'jsonc'
          ? trimmedCode.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
          : trimmedCode;
      const parsed = JSON.parse(cleanJson);

      // 若为对象数组，优先转换为直观二维表格视图
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))
      ) {
        const headerSet = new Set<string>();
        parsed.forEach(item => Object.keys(item as Record<string, unknown>).forEach(k => headerSet.add(k)));
        const headers = Array.from(headerSet);
        const rows = parsed.map(item =>
          headers.map(h => {
            const v = (item as Record<string, unknown>)[h];
            if (v === null || v === undefined) return '';
            return typeof v === 'object' ? JSON.stringify(v) : String(v);
          })
        );
        return { kind: 'table', headers, rows };
      }

      const entries = flattenObjectToTree(parsed);
      return { kind: 'tree', entries };
    } catch (err) {
      return {
        kind: 'error',
        message: err instanceof Error ? err.message : 'JSON 解析失败',
      };
    }
  }

  if (normalized === 'yaml' || normalized === 'yml') {
    return parseYamlToTree(trimmedCode);
  }

  return { kind: 'error', message: '当前语言暂不支持结构化视图' };
}
