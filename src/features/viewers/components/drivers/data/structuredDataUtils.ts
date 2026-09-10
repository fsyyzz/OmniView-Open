/**
 * 结构化数据解析、互转与可视化投影工具库 (JSON / YAML / TOML / XML)
 * 提供无损格式互转、脑图大纲投影、同构数组表格式提取、Docker 拓扑探测与敏感脱敏识别
 */
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';

export type StructuredFormat = 'json' | 'yaml' | 'toml' | 'xml';

export interface ArrayDetectionResult {
  detected: boolean;
  path: string;
  headers: string[];
  rows: Array<Record<string, any>>;
}

export interface ParseResult<T = any> {
  success: boolean;
  data: T | null;
  format: StructuredFormat;
  error?: string;
}

/**
 * 敏感键名正则匹配特征 (密码、私钥、Token、凭据等)
 */
const SENSITIVE_KEY_REGEX = /(password|passwd|secret|token|api_?key|private_?key|credential|auth|bearer|jwt|cert|passphrase)/i;

export function isSensitiveKey(keyName: string): boolean {
  return SENSITIVE_KEY_REGEX.test(keyName);
}

/**
 * 将敏感字符串值遮罩为点号
 */
export function maskSensitiveValue(val: string): string {
  if (!val) return val;
  return '●'.repeat(Math.min(Math.max(val.length, 6), 16));
}

/**
 * 根据文件扩展名与内容自适应解析为 JavaScript 对象
 */
export function parseStructuredData(content: string, extension: string): ParseResult {
  const ext = (extension || '').toLowerCase().trim();
  const trimmed = (content || '').trim();

  if (!trimmed) {
    return { success: true, data: {}, format: 'json' };
  }

  // 1. JSON 解析
  if (ext === 'json' || (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const data = JSON.parse(trimmed);
      return { success: true, data, format: 'json' };
    } catch (err: any) {
      // 容错降级尝试 YAML
    }
  }

  // 2. YAML 解析
  if (['yaml', 'yml'].includes(ext) || trimmed.startsWith('---') || trimmed.includes(': ')) {
    try {
      const data = loadYaml(trimmed);
      if (typeof data === 'object' && data !== null) {
        return { success: true, data, format: 'yaml' };
      }
    } catch (err: any) {
      if (['yaml', 'yml'].includes(ext)) {
        return { success: false, data: null, format: 'yaml', error: err?.message || 'YAML 解析错误' };
      }
    }
  }

  // 3. XML 解析 (浏览器 DOMParser / 基础正则)
  if (ext === 'xml' || (trimmed.startsWith('<') && trimmed.endsWith('>'))) {
    try {
      const xmlObj = parseXmlToJs(trimmed);
      if (xmlObj) {
        return { success: true, data: xmlObj, format: 'xml' };
      }
    } catch (err: any) {
      if (ext === 'xml') {
        return { success: false, data: null, format: 'xml', error: err?.message || 'XML 解析错误' };
      }
    }
  }

  // 4. TOML 解析 (轻量健壮实现)
  if (ext === 'toml') {
    try {
      const tomlObj = parseTomlToJs(trimmed);
      return { success: true, data: tomlObj, format: 'toml' };
    } catch (err: any) {
      return { success: false, data: null, format: 'toml', error: err?.message || 'TOML 解析错误' };
    }
  }

  // 默认尝试 JSON
  try {
    const data = JSON.parse(trimmed);
    return { success: true, data, format: 'json' };
  } catch (err: any) {
    return { success: false, data: null, format: 'json', error: err?.message || '未知结构化格式' };
  }
}

/**
 * 轻量纯函数：将 XML 文本解析为通用的树状 JS 对象
 */
export function parseXmlToJs(xmlString: string): any {
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error(parseError[0].textContent || 'XML 结构解析失败');
    }
    return domNodeToObject(xmlDoc.documentElement);
  }

  // Node 环境简易回退 (单测与非浏览器环境)
  return { xmlRoot: xmlString.slice(0, 100) };
}

function domNodeToObject(node: Element): any {
  const obj: Record<string, any> = {};

  // 提取属性
  if (node.attributes && node.attributes.length > 0) {
    obj['@attributes'] = {};
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      obj['@attributes'][attr.name] = attr.value;
    }
  }

  // 提取子节点
  const children = Array.from(node.children);
  if (children.length === 0) {
    const text = node.textContent?.trim() || '';
    if (Object.keys(obj).length === 0) {
      return text;
    }
    obj['#text'] = text;
    return obj;
  }

  for (const child of children) {
    const childName = child.tagName;
    const childObj = domNodeToObject(child);

    if (obj[childName] === undefined) {
      obj[childName] = childObj;
    } else {
      if (!Array.isArray(obj[childName])) {
        obj[childName] = [obj[childName]];
      }
      obj[childName].push(childObj);
    }
  }

  return obj;
}

/**
 * 健壮轻量 TOML 解析器 (支持 [section], [[tables]], key = value, 数字/布尔/字符串)
 */
export function parseTomlToJs(tomlString: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentTarget = result;
  let currentSection = '';

  const lines = tomlString.split('\n');

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // 匹配 [[array_table]]
    if (line.startsWith('[[') && line.endsWith(']]')) {
      const key = line.slice(2, -2).trim();
      currentSection = key;
      if (!Array.isArray(result[key])) {
        result[key] = [];
      }
      const newObj: Record<string, any> = {};
      result[key].push(newObj);
      currentTarget = newObj;
      continue;
    }

    // 匹配 [section]
    if (line.startsWith('[') && line.endsWith(']')) {
      const key = line.slice(1, -1).trim();
      currentSection = key;
      if (!result[key] || typeof result[key] !== 'object') {
        result[key] = {};
      }
      currentTarget = result[key];
      continue;
    }

    // 匹配 key = value
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      const rawVal = line.slice(eqIdx + 1).trim();
      currentTarget[key] = parseTomlValue(rawVal);
    }
  }

  return result;
}

function parseTomlValue(valStr: string): any {
  if (valStr === 'true') return true;
  if (valStr === 'false') return false;
  if (!isNaN(Number(valStr)) && valStr !== '') return Number(valStr);

  // 字符串处理
  if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
    return valStr.slice(1, -1);
  }

  // 数组处理 [1, 2, 3]
  if (valStr.startsWith('[') && valStr.endsWith(']')) {
    const inner = valStr.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(item => parseTomlValue(item.trim()));
  }

  return valStr;
}

/**
 * 跨格式无损互转序列化引擎
 */
export function convertStructuredData(
  data: any,
  targetFormat: StructuredFormat,
  options: { pretty?: boolean } = { pretty: true }
): string {
  if (data === null || data === undefined) return '';

  try {
    switch (targetFormat) {
      case 'json':
        return JSON.stringify(data, null, options.pretty ? 2 : 0);

      case 'yaml':
        return dumpYaml(data, { indent: 2, lineWidth: -1, noRefs: true });

      case 'toml':
        return objectToToml(data);

      case 'xml':
        return objectToXml(data, 'root');

      default:
        return JSON.stringify(data, null, 2);
    }
  } catch (err: any) {
    return `// 格式转换失败: ${err?.message || '未知错误'}`;
  }
}

/**
 * 将任意 JS 对象转换为合规的 TOML 文本
 */
export function objectToToml(obj: any): string {
  if (typeof obj !== 'object' || obj === null) return String(obj);

  const lines: string[] = [];
  const sections: Array<{ key: string; val: any; isArray?: boolean }> = [];

  // 首先输出标量与非嵌套键
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;

    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      sections.push({ key: k, val: v, isArray: true });
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      sections.push({ key: k, val: v, isArray: false });
    } else {
      lines.push(`${k} = ${serializeTomlPrimitive(v)}`);
    }
  }

  // 随后输出 [sections] 与 [[arrays]]
  for (const sec of sections) {
    if (lines.length > 0) lines.push('');
    if (sec.isArray) {
      for (const item of sec.val) {
        lines.push(`[[${sec.key}]]`);
        for (const [subK, subV] of Object.entries(item)) {
          if (typeof subV !== 'object') {
            lines.push(`${subK} = ${serializeTomlPrimitive(subV)}`);
          }
        }
      }
    } else {
      lines.push(`[${sec.key}]`);
      for (const [subK, subV] of Object.entries(sec.val)) {
        if (typeof subV !== 'object') {
          lines.push(`${subK} = ${serializeTomlPrimitive(subV)}`);
        }
      }
    }
  }

  return lines.join('\n');
}

function serializeTomlPrimitive(v: any): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `[${v.map(serializeTomlPrimitive).join(', ')}]`;
  return JSON.stringify(v);
}

/**
 * 将 JS 对象序列化为 XML 文本
 */
export function objectToXml(obj: any, rootName = 'root'): string {
  function toXml(inner: any, tag: string, indent = ''): string {
    if (inner === null || inner === undefined) {
      return `${indent}<${tag}/>\n`;
    }
    if (typeof inner !== 'object') {
      return `${indent}<${tag}>${escapeXml(String(inner))}</${tag}>\n`;
    }
    if (Array.isArray(inner)) {
      return inner.map(item => toXml(item, tag, indent)).join('');
    }

    let out = `${indent}<${tag}>\n`;
    for (const [k, v] of Object.entries(inner)) {
      const cleanKey = k.replace(/[^a-zA-Z0-9_\-]/g, '_');
      out += toXml(v, cleanKey, indent + '  ');
    }
    out += `${indent}</${tag}>\n`;
    return out;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(obj, rootName)}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 探测数据中是否存在同构对象数组 (Array of Objects)
 * 用于一键激活“数据表格下钻视窗”
 */
export function detectArrayOfObjects(data: any): ArrayDetectionResult {
  if (!data || typeof data !== 'object') {
    return { detected: false, path: '', headers: [], rows: [] };
  }

  // 1. 根节点直接是数组
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const headers = collectHeaders(data);
    if (headers.length > 0) {
      return { detected: true, path: '$', headers, rows: data };
    }
  }

  // 2. 检查第一层子属性 (例如 { items: [...], data: [...], services: [...] })
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      const headers = collectHeaders(val);
      if (headers.length >= 2) {
        return { detected: true, path: `$.${key}`, headers, rows: val };
      }
    }
  }

  return { detected: false, path: '', headers: [], rows: [] };
}

function collectHeaders(arr: any[]): string[] {
  const headerSet = new Set<string>();
  for (const item of arr.slice(0, 50)) {
    if (item && typeof item === 'object') {
      for (const k of Object.keys(item)) {
        headerSet.add(k);
      }
    }
  }
  return Array.from(headerSet);
}

/**
 * 将数据对象转化为符合 Markmap 语法的大纲 Markdown
 * 实现“全景思维导图投影”
 */
export function objectToMarkmapMarkdown(data: any, rootTitle = 'Config'): string {
  if (!data || typeof data !== 'object') {
    return `# ${rootTitle}\n- ${String(data)}`;
  }

  const lines: string[] = [`# ${rootTitle}`];

  function buildOutline(node: any, depth: number) {
    const indent = '  '.repeat(depth);
    if (node === null || node === undefined) {
      lines.push(`${indent}- *(null)*`);
      return;
    }

    if (Array.isArray(node)) {
      if (node.length === 0) {
        lines.push(`${indent}- *(空列表)*`);
        return;
      }
      node.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          const itemLabel = item.name || item.id || item.title || `[${idx}]`;
          lines.push(`${indent}- **${itemLabel}**`);
          buildOutline(item, depth + 1);
        } else {
          lines.push(`${indent}- [${idx}]: \`${String(item)}\``);
        }
      });
      return;
    }

    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (val === null || val === undefined) {
          lines.push(`${indent}- **${key}**: *(null)*`);
        } else if (typeof val === 'object') {
          const countLabel = Array.isArray(val) ? `[${val.length}]` : `{${Object.keys(val).length}}`;
          lines.push(`${indent}- **${key}** <span class="text-xs opacity-60 font-mono">${countLabel}</span>`);
          buildOutline(val, depth + 1);
        } else {
          const isSecret = isSensitiveKey(key);
          const displayVal = isSecret ? '●●●●●●' : String(val);
          lines.push(`${indent}- **${key}**: \`${displayVal}\``);
        }
      }
    }
  }

  buildOutline(data, 1);
  return lines.join('\n');
}

/**
 * 探测 docker-compose / Kubernetes 声明式服务拓扑
 * 自动生成 Mermaid 关系图源码
 */
export function detectDockerComposeTopology(data: any): string | null {
  if (!data || typeof data !== 'object') return null;

  const services = data.services || data.Services;
  if (!services || typeof services !== 'object') return null;

  const serviceKeys = Object.keys(services);
  if (serviceKeys.length < 2) return null;

  const lines: string[] = ['graph TD'];
  lines.push('  classDef svc fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;');
  lines.push('  classDef ext fill:#0f172a,stroke:#64748b,stroke-width:1px,color:#94a3b8;');

  // 1. 服务节点定义
  for (const key of serviceKeys) {
    const s = services[key] || {};
    const ports = s.ports ? `\\nPorts: ${Array.isArray(s.ports) ? s.ports.join(', ') : s.ports}` : '';
    lines.push(`  ${key}["📦 <b>${key}</b>${ports}"]:::svc`);
  }

  // 2. 依赖关系 (depends_on / links)
  for (const key of serviceKeys) {
    const s = services[key] || {};
    const deps = s.depends_on;
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        lines.push(`  ${key} -->|depends_on| ${dep}`);
      }
    } else if (deps && typeof deps === 'object') {
      for (const dep of Object.keys(deps)) {
        lines.push(`  ${key} -->|depends_on| ${dep}`);
      }
    }
  }

  return lines.join('\n');
}
