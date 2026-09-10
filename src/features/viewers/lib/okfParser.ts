/**
 * Open Knowledge Format (OKF v0.1) 与 Markdown Frontmatter 解析引擎
 * 规范参考: Google Open Knowledge Format (OKF v0.1)
 */
import { load as loadYaml } from 'js-yaml';

export interface OkfMetadata {
  type?: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  timestamp?: string;
  [key: string]: any;
}

export interface OkfParseResult {
  isOkf: boolean;
  hasFrontmatter: boolean;
  frontmatter: OkfMetadata | null;
  markdownBody: string;
  rawFrontmatter: string;
  error?: string;
}

/**
 * 校验元数据是否符合 Google Open Knowledge Format 概念定义
 * OKF 核心要求概念文件具有 `type` 字段，或同时具备 OKF 核心元数据（tags/resource/description）
 */
export function isOkfMetadata(meta: any): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  // 必须具备 type（OKF 唯一强约束字段），或含有 OKF 典型字段组合
  if (typeof meta.type === 'string' && meta.type.trim().length > 0) return true;
  return Boolean(
    (meta.tags && (Array.isArray(meta.tags) || typeof meta.tags === 'string')) &&
    (meta.resource || meta.timestamp || meta.description)
  );
}

/**
 * 提取并规范化 tags 为字符串数组
 */
export function normalizeOkfTags(rawTags: any): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) {
    return rawTags
      .map(tag => (tag !== null && tag !== undefined ? String(tag).trim() : ''))
      .filter(tag => tag.length > 0);
  }
  if (typeof rawTags === 'string') {
    return rawTags
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }
  return [];
}

/**
 * 解析 Markdown 文本中的 YAML Frontmatter 及 OKF 概念数据
 * 若存在头部 --- ... --- 区域，将其安全解析，并将正文内容平滑剥离返回
 */
export function parseOkfFrontmatter(rawContent: string): OkfParseResult {
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      isOkf: false,
      hasFrontmatter: false,
      frontmatter: null,
      markdownBody: '',
      rawFrontmatter: '',
    };
  }

  const cleanInput = rawContent.replace(/^\uFEFF/, '');
  // 匹配开头的 YAML Frontmatter 模式 (兼容 BOM、前置微小空行以及 Windows CRLF)
  const frontmatterMatch = /^(?:\r?\n)*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/.exec(cleanInput);

  if (!frontmatterMatch) {
    return {
      isOkf: false,
      hasFrontmatter: false,
      frontmatter: null,
      markdownBody: rawContent,
      rawFrontmatter: '',
    };
  }

  const rawYaml = frontmatterMatch[1];
  const markdownBody = cleanInput.slice(frontmatterMatch[0].length).replace(/^\r?\n/, '');

  try {
    const parsed = loadYaml(rawYaml);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        isOkf: false,
        hasFrontmatter: true,
        frontmatter: null,
        markdownBody,
        rawFrontmatter: rawYaml,
      };
    }

    const meta: OkfMetadata = { ...parsed };
    if (meta.tags) {
      meta.tags = normalizeOkfTags(meta.tags);
    }

    const okfFlag = isOkfMetadata(meta);

    return {
      isOkf: okfFlag,
      hasFrontmatter: true,
      frontmatter: meta,
      markdownBody,
      rawFrontmatter: rawYaml,
    };
  } catch (err: any) {
    return {
      isOkf: false,
      hasFrontmatter: true,
      frontmatter: null,
      markdownBody,
      rawFrontmatter: rawYaml,
      error: err?.message || 'Frontmatter YAML 解析异常',
    };
  }
}
