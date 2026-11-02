/**
 * OmniView Markdown 文档健康度与死链体检引擎 (Markdown Health Linter)
 *
 * 核心机制:
 * 1. 本地相对路径图片与媒体资源存活性体检 (检测破损图片);
 * 2. WikiLink 双向超链接有效性体检 (检测未决目标文件);
 * 3. 标题层级跳跃与大纲断层体检 (例如 h1 跃升至 h3/h4);
 * 4. 学术公式与图表交叉引用一致性体检 (\ref 未解析与 \label 孤立);
 * 5. 纯函数设计，毫秒级快速扫描，为 UI 提供结构化体检报告与一键修复建议。
 */

import { buildCrossReferenceRegistry, CrossReferenceRegistry } from './markdownCrossReferenceEngine';
import { Locale } from '../../../shared/lib/i18n';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface MarkdownHealthIssue {
  id: string;
  ruleId: 'broken-local-image' | 'broken-wikilink' | 'heading-hierarchy-skip' | 'unresolved-cross-ref' | 'unreferenced-label';
  severity: IssueSeverity;
  line: number;
  message: string;
  snippet: string;
  suggestion?: string;
}

export interface MarkdownHealthReport {
  issues: MarkdownHealthIssue[];
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  isHealthy: boolean;
  score: number; // 0 ~ 100 分
}

export interface MarkdownHealthLinterOptions {
  files?: Array<{ name: string; content?: string; extension?: string; path?: string; binaryUrl?: string }>;
  registry?: CrossReferenceRegistry;
  locale?: Locale;
}

/**
 * 校验本地相对图片路径是否存在于给定的工作区文件池
 */
function isFileInPool(
  rawSrc: string,
  files?: Array<{ name: string; content?: string; extension?: string; path?: string }>
): boolean {
  if (!files || files.length === 0) return true; // 若无文件池上下文，默认不误报

  const cleanSrc = decodeURIComponent(rawSrc.trim().split(/[?#]/, 1)[0]).replace(/\\/g, '/').replace(/^\/+/, '');
  const relativeSrc = cleanSrc.replace(/^(\.\.\/|\.\/)+/g, '');

  return files.some(
    (f) =>
      f.name === cleanSrc ||
      f.name.toLowerCase() === cleanSrc.toLowerCase() ||
      (f.path && f.path.replace(/^\//, '') === cleanSrc) ||
      (f.path && f.path.replace(/\\/g, '/').endsWith(`/${relativeSrc}`)) ||
      f.name === relativeSrc ||
      f.name.toLowerCase() === relativeSrc.toLowerCase()
  );
}

/**
 * 执行 Markdown 全文语义健康度扫描
 */
export function lintMarkdownHealth(
  content: string,
  options: MarkdownHealthLinterOptions = {}
): MarkdownHealthReport {
  const { files = [], registry = buildCrossReferenceRegistry(content, options.locale || 'zh-CN'), locale = 'zh-CN' } = options;
  const issues: MarkdownHealthIssue[] = [];

  if (!content) {
    return {
      issues: [],
      total: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      isHealthy: true,
      score: 100,
    };
  }

  const lines = content.split('\n');
  let lastHeadingLevel = 0;
  let counter = 0;

  // 1. 行级别静态检查 (图片、标题、WikiLink、交叉引用)
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // --- 规则 A: 标题层级跳跃检查 (Heading Hierarchy Skip) ---
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        issues.push({
          id: `issue-${counter++}`,
          ruleId: 'heading-hierarchy-skip',
          severity: 'info',
          line: lineNum,
          message:
            locale === 'zh-CN'
              ? `标题层级跳跃: 从 H${lastHeadingLevel} 直接跳到 H${level}，建议保持层级递进`
              : `Heading level skipped: jumped from H${lastHeadingLevel} to H${level}`,
          snippet: line.trim(),
          suggestion: locale === 'zh-CN' ? `将 '#' 调整为 ${'#'.repeat(lastHeadingLevel + 1)}` : `Change to H${lastHeadingLevel + 1}`,
        });
      }
      lastHeadingLevel = level;
    }

    // --- 规则 B: 本地相对图片资源有效性检查 (Broken Local Image) ---
    // 匹配 Markdown 图片 ![alt](src)
    const imgMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
    for (const m of imgMatches) {
      const src = m[2].trim().split(/\s+/)[0]; // 剥离可选项标题
      // 忽略外部网络链接、Base64 DataURI、特殊协议
      if (
        !src.startsWith('http://') &&
        !src.startsWith('https://') &&
        !src.startsWith('data:') &&
        !src.startsWith('blob:') &&
        !src.startsWith('vscode-webview:') &&
        !src.startsWith('#')
      ) {
        if (!isFileInPool(src, files)) {
          issues.push({
            id: `issue-${counter++}`,
            ruleId: 'broken-local-image',
            severity: 'warning',
            line: lineNum,
            message:
              locale === 'zh-CN'
                ? `未找到本地相对图片资源: ${src}`
                : `Local relative image not found: ${src}`,
            snippet: m[0],
            suggestion:
              locale === 'zh-CN'
                ? `请检查文件是否存在于工作区或校正相对路径`
                : `Ensure the file exists in the workspace or check relative path`,
          });
        }
      }
    }

    // --- 规则 C: WikiLink 超链接有效性检查 (Broken WikiLink) ---
    // 匹配 [[Target]] 或 [[Target|Alias]]
    const wikiMatches = line.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const wm of wikiMatches) {
      const rawTarget = wm[1].split('|')[0].trim();
      const pageName = rawTarget.split('#')[0].trim();
      if (pageName && files && files.length > 0) {
        const exists = files.some(
          (f) =>
            f.name === pageName ||
            f.name === `${pageName}.md` ||
            f.name.toLowerCase() === pageName.toLowerCase() ||
            f.name.toLowerCase() === `${pageName.toLowerCase()}.md` ||
            (f.path && f.path.endsWith(`/${pageName}`)) ||
            (f.path && f.path.endsWith(`/${pageName}.md`))
        );
        if (!exists) {
          issues.push({
            id: `issue-${counter++}`,
            ruleId: 'broken-wikilink',
            severity: 'warning',
            line: lineNum,
            message:
              locale === 'zh-CN'
                ? `未解析的 WikiLink 目标文件: [[${pageName}]]`
                : `Unresolved WikiLink target document: [[${pageName}]]`,
            snippet: wm[0],
            suggestion:
              locale === 'zh-CN'
                ? `请确保工作区存在 ${pageName}.md 文件`
                : `Verify ${pageName}.md exists in workspace`,
          });
        }
      }
    }

    // --- 规则 D: 交叉引用有效性检查 (\ref / \eqref) ---
    const refMatches = line.matchAll(/\\(?:ref|eqref)\s*\{([^}]+)\}/g);
    for (const rm of refMatches) {
      const refId = rm[1].trim();
      if (!registry.has(refId)) {
        issues.push({
          id: `issue-${counter++}`,
          ruleId: 'unresolved-cross-ref',
          severity: 'error',
          line: lineNum,
          message:
            locale === 'zh-CN'
              ? `未定义的交叉引用标签: ${refId}`
              : `Undefined cross-reference label: ${refId}`,
          snippet: rm[0],
          suggestion:
            locale === 'zh-CN'
              ? `请在对应公式添加 \\label{${refId}} 或在图表添加 label="${refId}"`
              : `Add \\label{${refId}} to target formula or diagram`,
        });
      }
    }
  }

  // --- 规则 E: 孤立未引用的 \label 标签检查 (Unreferenced Label) ---
  const allRegistered = registry.getAll();
  for (const item of allRegistered) {
    const refPattern = new RegExp(`\\\\(?:ref|eqref)\\s*\\{${escapeRegExp(item.id)}\\}`, 'g');
    if (!refPattern.test(content)) {
      issues.push({
        id: `issue-${counter++}`,
        ruleId: 'unreferenced-label',
        severity: 'info',
        line: item.sourceLine || 1,
        message:
          locale === 'zh-CN'
            ? `已定义但从未被引用的符号标签: ${item.id} (${item.label})`
            : `Unreferenced label tag: ${item.id} (${item.label})`,
        snippet: `\\label{${item.id}}`,
        suggestion:
          locale === 'zh-CN'
            ? `可在正文通过 \\ref{${item.id}} 或 \\eqref{${item.id}} 进行交叉引用`
            : `Reference it via \\ref{${item.id}} or \\eqref{${item.id}}`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;
  const total = issues.length;

  // 计算健康得分 (0 ~ 100)
  const deductions = errors * 15 + warnings * 5 + infos * 1;
  const score = Math.max(0, 100 - deductions);

  return {
    issues,
    total,
    errors,
    warnings,
    infos,
    isHealthy: errors === 0 && warnings === 0,
    score,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
