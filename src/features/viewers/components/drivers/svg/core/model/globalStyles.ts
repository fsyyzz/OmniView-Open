/**
 * OmniView SVG 编辑引擎 v2 — 全局样式与 CSS 变量管理器 (Global Styles & CSS Engine)
 *
 * 职责：
 * 1. 解析 SVG 文档中的全局 `<style>` 标签，提取 CSS 变量 (:root / svg / * 变量) 与 Class 规则；
 * 2. 提供获取、更新、增量替换全局 CSS 样式的不可变操作；
 * 3. 支持快捷修改 CSS 变量值、图元外观一键提取为全局 CSS 类、样式预设注入；
 * 4. 统计画板中各 CSS 类的引用计数，支持按 Class 检索图元。
 */

import type { Document, NodeId, PathNode } from './types';
import { RAW_DEFS_METADATA_KEY } from '../io/usvgTreeToDocument';

export interface CssVariableItem {
  readonly name: string;
  readonly value: string;
  readonly selector: string;
}

export interface CssClassRuleItem {
  readonly selector: string;
  readonly className: string;
  readonly declarations: Readonly<Record<string, string>>;
  readonly rawBody: string;
}

export interface GlobalStylesInfo {
  readonly rawCss: string;
  readonly cssVariables: ReadonlyArray<CssVariableItem>;
  readonly classRules: ReadonlyArray<CssClassRuleItem>;
  readonly hasStyles: boolean;
}

/** 常用 SVG 全局样式与变量预设 */
export const SVG_STYLE_PRESETS: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly css: string;
}> = [
  {
    id: 'theme-variables',
    name: '主题调色盘变量',
    description: '声明 :root 标准主题变量 (--primary, --accent, --border 等)，便于全局换色',
    css: `:root {
  --primary-color: #3b82f6;
  --secondary-color: #10b981;
  --accent-color: #f59e0b;
  --danger-color: #ef4444;
  --bg-color: #ffffff;
  --stroke-color: #1e293b;
}`,
  },
  {
    id: 'neon-glow',
    name: '霓虹发光滤镜',
    description: '提供 .neon-glow 与 .neon-cyan 发光投影与高亮描边类',
    css: `.neon-glow {
  filter: drop-shadow(0 0 6px #3b82f6);
  stroke: #60a5fa;
  stroke-width: 2px;
}
.neon-cyan {
  filter: drop-shadow(0 0 8px #06b6d4);
  stroke: #22d3ee;
  stroke-width: 2px;
}`,
  },
  {
    id: 'wireframe-sketch',
    name: '线框与虚线风格',
    description: '极简线框图元样式，清空填充并应用工业虚线',
    css: `.wireframe {
  fill: none !important;
  stroke: #475569;
  stroke-width: 1.5px;
  stroke-dasharray: 4 2;
}
.wireframe-bold {
  fill: none !important;
  stroke: #0f172a;
  stroke-width: 3px;
}`,
  },
  {
    id: 'interactive-hover',
    name: '悬浮微动效',
    description: '为包含 .interactive 类的图元增加过渡、缩放与半透明悬浮反馈',
    css: `.interactive {
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.interactive:hover {
  opacity: 0.82;
  filter: brightness(1.12);
}`,
  },
  {
    id: 'dark-mode-adaptive',
    name: '暗黑模式媒体查询',
    description: '利用 @media (prefers-color-scheme: dark) 自适应随系统主题变色',
    css: `@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #0f172a;
    --stroke-color: #94a3b8;
  }
  .theme-adaptive {
    fill: #1e293b;
    stroke: #e2e8f0;
  }
}`,
  },
];

/**
 * 从原始 rawDefs HTML 片段中提取所有 `<style>` 标签内部的 CSS 文本
 */
export function extractCssFromRawDefs(rawDefs: string): string {
  if (!rawDefs || !rawDefs.trim()) return '';
  const styleTagRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = styleTagRegex.exec(rawDefs)) !== null) {
    if (match[1]) {
      chunks.push(match[1].trim());
    }
  }
  return chunks.join('\n\n');
}

/**
 * 解析全局 CSS 文本，提取 CSS 变量及 CSS 类选择器规则
 */
export function parseGlobalStyles(rawDefs: string): GlobalStylesInfo {
  const rawCss = extractCssFromRawDefs(rawDefs);
  if (!rawCss.trim()) {
    return {
      rawCss: '',
      cssVariables: [],
      classRules: [],
      hasStyles: false,
    };
  }

  const cleaned = rawCss
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const cssVariables: CssVariableItem[] = [];
  const classRules: CssClassRuleItem[] = [];

  // 1. 匹配所有规则块: selector { ... }
  const ruleBlockRegex = /([^{}]+)\{([^}]*)\}/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = ruleBlockRegex.exec(cleaned)) !== null) {
    const rawSelector = (blockMatch[1] ?? '').trim();
    const rawBody = (blockMatch[2] ?? '').trim();
    if (!rawSelector || !rawBody) continue;

    // 解析当前块内每一行 CSS 声明
    const declarations: Record<string, string> = {};
    const declStatements = rawBody.split(';');

    for (const statement of declStatements) {
      const colonIdx = statement.indexOf(':');
      if (colonIdx <= 0) continue;
      const prop = statement.slice(0, colonIdx).trim();
      const val = statement.slice(colonIdx + 1).trim();
      if (!prop || !val) continue;

      declarations[prop.toLowerCase()] = val;

      // 检查是否为 CSS 自定义属性 (--variable-name)
      if (prop.startsWith('--')) {
        cssVariables.push({
          name: prop,
          value: val,
          selector: rawSelector,
        });
      }
    }

    // 检查是否包含类选择器 (.class-name)
    const selectors = rawSelector.split(',').map((s) => s.trim()).filter(Boolean);
    for (const sel of selectors) {
      const classMatch = sel.match(/\.([a-zA-Z0-9_-]+)/);
      if (classMatch && classMatch[1]) {
        classRules.push({
          selector: sel,
          className: classMatch[1],
          declarations,
          rawBody,
        });
      }
    }
  }

  return {
    rawCss,
    cssVariables,
    classRules,
    hasStyles: true,
  };
}

/**
 * 获取文档中的全局 CSS 样式
 */
export function getDocumentGlobalStyles(doc: Document): string {
  const rawDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';
  return extractCssFromRawDefs(rawDefs);
}

/**
 * 设置文档全局 CSS 样式（不可变更新，返回新 Document）
 * - 如果 rawDefs 中已有 `<style>`，将其内容替换为 newCss；
 * - 如果 rawDefs 中无 `<style>` 且 newCss 非空，追加 `<style>\n${newCss}\n</style>`；
 * - 如果 newCss 为空，从 rawDefs 中移除全部 `<style>` 标签。
 */
export function setDocumentGlobalStyles(doc: Document, newCss: string): Document {
  const rawDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';
  const trimmedCss = newCss.trim();

  let nextDefs = rawDefs;
  const hasStyleTag = /<style\b[^>]*>[\s\S]*?<\/style>/i.test(rawDefs);

  if (trimmedCss.length === 0) {
    // 移除所有 style 标签
    nextDefs = rawDefs.replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/gi, '').trim();
  } else if (hasStyleTag) {
    // 替换第一个 style 标签的内容，并移除后续重复的 style 标签
    let replacedFirst = false;
    nextDefs = rawDefs.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs) => {
      if (!replacedFirst) {
        replacedFirst = true;
        return `<style${attrs}>\n${trimmedCss}\n</style>`;
      }
      return '';
    }).trim();
  } else {
    // 追加全新的 style 标签到 defs
    const styleBlock = `<style type="text/css">\n${trimmedCss}\n</style>`;
    nextDefs = rawDefs.trim() ? `${rawDefs.trim()}\n${styleBlock}` : styleBlock;
  }

  const nextMetadata = { ...doc.metadata };
  if (nextDefs.trim().length > 0) {
    nextMetadata[RAW_DEFS_METADATA_KEY] = nextDefs;
  } else {
    delete nextMetadata[RAW_DEFS_METADATA_KEY];
  }

  return {
    ...doc,
    metadata: nextMetadata,
    _internal: { revision: doc._internal.revision + 1 },
  };
}

/**
 * 快捷更新或新增指定的 CSS 变量（例如将 `--primary-color` 改为 `#ef4444`）
 */
export function updateDocumentCssVariable(doc: Document, varName: string, newValue: string): Document {
  const currentCss = getDocumentGlobalStyles(doc);
  const cleanVarName = varName.startsWith('--') ? varName : `--${varName}`;

  if (!currentCss.trim()) {
    const initialCss = `:root {\n  ${cleanVarName}: ${newValue};\n}`;
    return setDocumentGlobalStyles(doc, initialCss);
  }

  const varRegex = new RegExp(`(${cleanVarName}\\s*:\\s*)([^;]+)(;)`, 'g');
  if (varRegex.test(currentCss)) {
    const updatedCss = currentCss.replace(varRegex, `$1${newValue}$3`);
    return setDocumentGlobalStyles(doc, updatedCss);
  }

  // 变量不存在：检查是否有 :root 规则
  const rootRegex = /(:root\s*\{)([^}]*)(\})/i;
  if (rootRegex.test(currentCss)) {
    const updatedCss = currentCss.replace(rootRegex, (_m, p1, p2, p3) => {
      const trimmedBody = p2.trimEnd();
      return `${p1}${trimmedBody}\n  ${cleanVarName}: ${newValue};\n${p3}`;
    });
    return setDocumentGlobalStyles(doc, updatedCss);
  }

  // 追加 :root 块
  const updatedCss = `:root {\n  ${cleanVarName}: ${newValue};\n}\n\n${currentCss}`;
  return setDocumentGlobalStyles(doc, updatedCss);
}

/**
 * 提取某个图元的外观（Fill、Stroke）为全局 CSS 类，并赋给该图元
 */
export function extractNodeToGlobalClass(
  doc: Document,
  nodeId: NodeId,
  desiredClassName?: string,
): { doc: Document; className: string } {
  const node = doc.nodes.get(nodeId);
  if (!node) return { doc, className: '' };

  const finalClassName = (desiredClassName && desiredClassName.trim())
    ? desiredClassName.trim().replace(/^\./, '').replace(/[^a-zA-Z0-9_-]/g, '-')
    : `cls-${nodeId}`;

  const declarations: string[] = [];

  if (node.kind === 'Path' || node.kind === 'Text') {
    const fillItem = node.appearance.items.find((it) => it.kind === 'fill');
    if (fillItem && fillItem.kind === 'fill') {
      if (fillItem.fill.type === 'solid') {
        declarations.push(`  fill: ${fillItem.fill.color};`);
        if (fillItem.fill.opacity !== undefined && fillItem.fill.opacity < 1) {
          declarations.push(`  fill-opacity: ${fillItem.fill.opacity};`);
        }
      } else if (fillItem.fill.type === 'none') {
        declarations.push('  fill: none;');
      } else if (fillItem.fill.type === 'gradient') {
        declarations.push(`  fill: url(#${fillItem.fill.id});`);
      }
    }

    if (node.kind === 'Path') {
      const strokeItem = node.appearance.items.find((it) => it.kind === 'stroke');
      if (strokeItem && strokeItem.kind === 'stroke') {
        if (strokeItem.stroke.paint.type === 'solid') {
          declarations.push(`  stroke: ${strokeItem.stroke.paint.color};`);
          if (strokeItem.stroke.paint.opacity !== undefined && strokeItem.stroke.paint.opacity < 1) {
            declarations.push(`  stroke-opacity: ${strokeItem.stroke.paint.opacity};`);
          }
        } else if (strokeItem.stroke.paint.type === 'none') {
          declarations.push('  stroke: none;');
        }
        if (strokeItem.stroke.width > 0) {
          declarations.push(`  stroke-width: ${strokeItem.stroke.width}px;`);
        }
        if (strokeItem.stroke.cap && strokeItem.stroke.cap !== 'butt') {
          declarations.push(`  stroke-linecap: ${strokeItem.stroke.cap};`);
        }
        if (strokeItem.stroke.join && strokeItem.stroke.join !== 'miter') {
          declarations.push(`  stroke-linejoin: ${strokeItem.stroke.join};`);
        }
        if (strokeItem.stroke.dashArray && strokeItem.stroke.dashArray.length > 0) {
          declarations.push(`  stroke-dasharray: ${strokeItem.stroke.dashArray.join(' ')};`);
        }
      }
    }
  }

  if (node.opacity < 1) {
    declarations.push(`  opacity: ${node.opacity};`);
  }

  if (declarations.length === 0) {
    declarations.push('  /* 默认样式 */');
  }

  const newClassBlock = `.${finalClassName} {\n${declarations.join('\n')}\n}`;
  const currentCss = getDocumentGlobalStyles(doc);
  const updatedCss = currentCss.trim()
    ? `${currentCss.trim()}\n\n${newClassBlock}`
    : newClassBlock;

  let nextDoc = setDocumentGlobalStyles(doc, updatedCss);

  // 更新目标节点的 className
  const targetNode = nextDoc.nodes.get(nodeId);
  if (targetNode) {
    const nextNodes = new Map(nextDoc.nodes);
    nextNodes.set(nodeId, {
      ...targetNode,
      className: finalClassName,
    } as any);
    nextDoc = {
      ...nextDoc,
      nodes: nextNodes,
      _internal: { revision: nextDoc._internal.revision + 1 },
    };
  }

  return { doc: nextDoc, className: finalClassName };
}

/**
 * 统计文档中所有图元正在引用的 CSS 类名及其引用计数
 */
export function getClassesInUse(doc: Document): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of doc.nodes.values()) {
    if (node.className) {
      const classes = node.className.trim().split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
      }
    }
  }
  return counts;
}
