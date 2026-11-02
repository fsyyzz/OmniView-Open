/**
 * OmniView Markdown 学术出版级交叉引用与公式/图表自动编号引擎 (Cross-Reference Engine)
 *
 * 核心机制:
 * 1. 数学公式全局连续编号与 \label{...} 符号提取;
 * 2. 图表 (Mermaid / PlantUML / Graphviz / SVG / ECharts) 与表格自动编号及标签解析;
 * 3. 正文 \ref{...} / \eqref{...} 交叉引用自动解析为可点击锚点跳转链接;
 * 4. 纯函数设计，保持 100% 幂等性，符合 CommonMark 优雅降级标准。
 */

import { Locale } from '../../../shared/lib/i18n';

export type CrossReferenceKind = 'equation' | 'figure' | 'table';

export interface CrossReferenceItem {
  id: string; // 唯一键，如 "eq:integral" 或 "fig:service-flow"
  kind: CrossReferenceKind;
  index: number; // 序列号 (1, 2, 3...)
  label: string; // 显示文本，如 "(1)" 或 "图 1"
  title?: string; // 标题或描述
  sourceLine?: number; // 所在源码行号
  previewText?: string; // 悬浮微卡片预览摘要
}

export class CrossReferenceRegistry {
  private items = new Map<string, CrossReferenceItem>();
  private locale: Locale;

  constructor(locale: Locale = 'zh-CN') {
    this.locale = locale;
  }

  public register(item: CrossReferenceItem): void {
    if (!item.id) return;
    this.items.set(item.id, item);
  }

  public get(id: string): CrossReferenceItem | undefined {
    return this.items.get(id);
  }

  public has(id: string): boolean {
    return this.items.has(id);
  }

  public getAll(kind?: CrossReferenceKind): CrossReferenceItem[] {
    const list = Array.from(this.items.values());
    if (kind) {
      return list.filter((i) => i.kind === kind);
    }
    return list;
  }

  public size(): number {
    return this.items.size;
  }

  public clear(): void {
    this.items.clear();
  }
}

/**
 * 从数学公式源码中提取 \label{...} 并剥离为纯净公式
 */
export function extractLabelFromFormula(formula: string): { label?: string; cleanFormula: string } {
  if (!formula || !formula.includes('\\label')) {
    return { cleanFormula: formula };
  }

  const match = formula.match(/\\label\s*\{([^}]+)\}/);
  if (!match) {
    return { cleanFormula: formula };
  }

  const label = match[1].trim();
  const cleanFormula = formula.replace(/\\label\s*\{[^}]+\}/g, '').trim();
  return { label, cleanFormula };
}

/**
 * 扫描 Markdown 全文，提取所有带有 \label 或 label="..." 的公式、图表、表格并构建注册表
 */
export function buildCrossReferenceRegistry(
  markdown: string,
  locale: Locale = 'zh-CN'
): CrossReferenceRegistry {
  const registry = new CrossReferenceRegistry(locale);
  if (!markdown) return registry;

  const lines = markdown.split('\n');
  let eqCount = 0;
  let figCount = 0;
  let tblCount = 0;

  // 1. 扫描数学公式块 ($$ ... $$ 或 ```math ... ``` 或 \begin{equation} ... \end{equation})
  // 块级 $$ ... $$ 匹配 (支持跨行)
  const mathBlockRegex = /\$\$\s*([\s\S]*?)\s*\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = mathBlockRegex.exec(markdown)) !== null) {
    const inner = match[1];
    const { label } = extractLabelFromFormula(inner);
    if (label) {
      eqCount++;
      const id = label;
      const index = eqCount;
      const numLabel = `(${index})`;
      const lineIndex = markdown.substring(0, match.index).split('\n').length;
      registry.register({
        id,
        kind: 'equation',
        index,
        label: numLabel,
        title: `公式 ${numLabel}`,
        sourceLine: lineIndex,
        previewText: inner.replace(/\\label\s*\{[^}]+\}/g, '').trim().slice(0, 100),
      });
    }
  }

  // 2. 扫描围栏代码块中的公式 (```math / ```katex / ```latex)
  const codeBlockRegex = /```(math|katex|latex)\b[^\n]*\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const inner = match[2];
    const { label } = extractLabelFromFormula(inner);
    if (label && !registry.has(label)) {
      eqCount++;
      const id = label;
      const index = eqCount;
      const numLabel = `(${index})`;
      const lineIndex = markdown.substring(0, match.index).split('\n').length;
      registry.register({
        id,
        kind: 'equation',
        index,
        label: numLabel,
        title: `公式 ${numLabel}`,
        sourceLine: lineIndex,
        previewText: inner.replace(/\\label\s*\{[^}]+\}/g, '').trim().slice(0, 100),
      });
    }
  }

  // 3. 扫描图表代码块 (```mermaid / ```plantuml / ```graphviz / ```svg / ```echarts) 上的 label 与 title
  const diagramRegex = /```(mermaid|plantuml|graphviz|dot|svg|echarts[^\s]*)\s+([^\n]*)\n([\s\S]*?)```/g;
  while ((match = diagramRegex.exec(markdown)) !== null) {
    const infostring = match[2];
    const labelMatch = infostring.match(/\blabel=["']([^"']+)["']/i) || infostring.match(/\bid=["']([^"']+)["']/i);
    const titleMatch = infostring.match(/\btitle=["']([^"']+)["']/i);
    if (labelMatch) {
      figCount++;
      const id = labelMatch[1].trim();
      const title = titleMatch ? titleMatch[1].trim() : '';
      const prefix = locale === 'zh-CN' ? '图' : 'Figure';
      const labelText = `${prefix} ${figCount}`;
      const lineIndex = markdown.substring(0, match.index).split('\n').length;
      registry.register({
        id,
        kind: 'figure',
        index: figCount,
        label: labelText,
        title: title ? `${labelText}: ${title}` : labelText,
        sourceLine: lineIndex,
        previewText: title || match[1],
      });
    }
  }

  // 4. 扫描 Markdown 图片语法上的标签: ![图题 label="fig:name"](url) 或 <!-- label: fig:name -->
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 图片 label
    const imgLabelMatch = line.match(/!\[([^\]]*?\blabel=["']([^"']+)["'][^\]]*?)\]\(([^)]+)\)/i);
    if (imgLabelMatch) {
      const id = imgLabelMatch[2].trim();
      if (!registry.has(id)) {
        figCount++;
        const prefix = locale === 'zh-CN' ? '图' : 'Figure';
        const labelText = `${prefix} ${figCount}`;
        const rawAlt = imgLabelMatch[1].replace(/\blabel=["'][^"']+["']/i, '').trim();
        registry.register({
          id,
          kind: 'figure',
          index: figCount,
          label: labelText,
          title: rawAlt ? `${labelText}: ${rawAlt}` : labelText,
          sourceLine: i + 1,
          previewText: rawAlt || imgLabelMatch[3],
        });
      }
    }

    // 表格 label 标记: 上一行或紧邻前导包含 <!-- label: tbl:name --> 或 [tbl:name: 标题]
    const tblCommentMatch = line.match(/<!--\s*label:\s*([^\s>]+)\s*(?:title:\s*([^>]+))?-->/i);
    if (tblCommentMatch) {
      const id = tblCommentMatch[1].trim();
      const title = tblCommentMatch[2] ? tblCommentMatch[2].trim() : '';
      const kind: CrossReferenceKind = id.startsWith('fig:') ? 'figure' : id.startsWith('eq:') ? 'equation' : 'table';
      if (!registry.has(id)) {
        const lineIndex = i + 1;
        if (kind === 'table') {
          tblCount++;
          const prefix = locale === 'zh-CN' ? '表' : 'Table';
          const labelText = `${prefix} ${tblCount}`;
          registry.register({
            id,
            kind: 'table',
            index: tblCount,
            label: labelText,
            title: title ? `${labelText}: ${title}` : labelText,
            sourceLine: lineIndex,
            previewText: title || '表格数据',
          });
        } else if (kind === 'figure') {
          figCount++;
          const prefix = locale === 'zh-CN' ? '图' : 'Figure';
          const labelText = `${prefix} ${figCount}`;
          registry.register({
            id,
            kind: 'figure',
            index: figCount,
            label: labelText,
            title: title ? `${labelText}: ${title}` : labelText,
            sourceLine: lineIndex,
            previewText: title || '图表展示',
          });
        }
      }
    }
  }

  return registry;
}

/**
 * 将正文中的 \eqref{...} 与 \ref{...} 替换为交互式超链接
 */
export function resolveCrossReferenceLinks(
  markdown: string,
  registry: CrossReferenceRegistry,
  locale: Locale = 'zh-CN'
): string {
  if (!markdown) return '';

  // 1. 替换 \eqref{...} (专用于数学公式引用，如 \eqref{eq:integral})
  let result = markdown.replace(/\\eqref\s*\{([^}]+)\}/g, (_match, refId) => {
    const id = refId.trim();
    const item = registry.get(id);
    if (item) {
      return `<a class="ov-cross-ref ov-cross-ref-eq" href="#ref-${encodeURIComponent(id)}" data-ref-id="${id}" data-ref-kind="${item.kind}" title="跳转至公式 ${item.label}">${item.label}</a>`;
    }
    const fallbackText = `(?? ${id})`;
    return `<span class="ov-cross-ref ov-cross-ref-unresolved" data-ref-id="${id}" title="未找到公式引用标签: ${id}">${fallbackText}</span>`;
  });

  // 2. 替换 \ref{...} (通用引用，支持公式、图表、表格)
  result = result.replace(/\\ref\s*\{([^}]+)\}/g, (_match, refId) => {
    const id = refId.trim();
    const item = registry.get(id);
    if (item) {
      return `<a class="ov-cross-ref ov-cross-ref-${item.kind}" href="#ref-${encodeURIComponent(id)}" data-ref-id="${id}" data-ref-kind="${item.kind}" title="跳转至 ${item.title || item.label}">${item.label}</a>`;
    }
    const fallbackText = `?? [${id}]`;
    return `<span class="ov-cross-ref ov-cross-ref-unresolved" data-ref-id="${id}" title="未解析的交叉引用: ${id}">${fallbackText}</span>`;
  });

  return result;
}
