/**
 * OmniView Typst.ts (Myriad-Dreamin/typst.ts) 官方 WASM 编译内核桥接器
 * 集成 Rust/WebAssembly 官方编译器与矢量渲染引擎
 */
import { $typst } from '@myriaddreamin/typst.ts';
import type { TypstCompileResult, TypstPage, TypstOutlineItem } from './typstEngine';
import { extractTypstMetadata } from './typstEngine';

let isWasmInitialized = false;
let initPromise: Promise<void> | null = null;

const WASM_COMPILER_URL = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm';
const WASM_RENDERER_URL = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@0.7.0/pkg/typst_ts_renderer_bg.wasm';

/**
 * 确保 Typst.ts WebAssembly 运行时初始化
 */
export async function ensureTypstWasmInitialized(): Promise<void> {
  if (isWasmInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      $typst.setCompilerInitOptions({
        getModule: () => WASM_COMPILER_URL,
      });
      $typst.setRendererInitOptions({
        getModule: () => WASM_RENDERER_URL,
      });
      isWasmInitialized = true;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * 提取 Typst 标题大纲
 */
export function extractOutlineFromSource(source: string): TypstOutlineItem[] {
  const outline: TypstOutlineItem[] = [];
  if (!source) return outline;

  const lines = source.split('\n');
  let currentEstimatedPage = 1;
  let lineCountInPage = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    lineCountInPage++;

    if (/#pagebreak\s*\(\s*\)/i.test(trimmed) || lineCountInPage > 45) {
      currentEstimatedPage++;
      lineCountInPage = 0;
    }

    // 匹配常规标题 = Heading
    const headingMatch = line.match(/^(=+)\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      outline.push({
        id: `typst_wasm_h_${i + 1}`,
        title,
        level,
        pageNumber: currentEstimatedPage,
        lineNumber: i + 1,
      });
      continue;
    }

    // 匹配自定义区块标题宏如 #sect-title("教育经历")
    const sectMatch = trimmed.match(/^#(?:sect-title|section|sec|title-block)\s*\(\s*["']([^"']+)["']\s*\)/i);
    if (sectMatch) {
      outline.push({
        id: `typst_wasm_sect_${i + 1}`,
        title: sectMatch[1].trim(),
        level: 2,
        pageNumber: currentEstimatedPage,
        lineNumber: i + 1,
      });
    }
  }

  return outline;
}

/**
 * 提取 balanced 闭合 <g> 标签及其完整内容
 */
function extractBalancedG(str: string, startIndex: number): { full: string; endIndex: number; openTag: string } | null {
  const openTagMatch = str.slice(startIndex).match(/^<g\b[^>]*>/);
  if (!openTagMatch) return null;
  let depth = 0;
  const regex = /<\/?g\b[^>]*>/g;
  regex.lastIndex = startIndex;
  let m;
  while ((m = regex.exec(str)) !== null) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return {
          full: str.slice(startIndex, regex.lastIndex),
          endIndex: regex.lastIndex,
          openTag: openTagMatch[0],
        };
      }
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return null;
}

/**
 * 自动检测并修补 WASM 编译输出中因字库缺失而产生的 NotDef 空白/方框占位
 * 将其与内置选区文本 (tsel) 对齐转换为高清晰度 SVG 矢量文本渲染
 */
function patchMissingGlyphs(svgStr: string, knownMissingGlyphs?: Set<string>): string {
  // 匹配 typst.ts 生成的 missing-glyph 矩形路径特征
  const missingGlyphIds = knownMissingGlyphs ? new Set(knownMissingGlyphs) : new Set<string>();
  const defPathRegex = /<path\s+id="([^"]+)"\s+class="outline_glyph"\s+d="([^"]+)"/g;
  let m;
  while ((m = defPathRegex.exec(svgStr)) !== null) {
    const d = m[2];
    if (d.includes('L 500 0 L 500') || d.includes('L 250 304') || d.includes('L 250 305')) {
      missingGlyphIds.add(m[1]);
    }
  }

  // 遍历所有 .typst-text 容器
  const textGroupRegex = /(<g[^>]*class="typst-text"[^>]*>)([\s\S]*?)(<\/g>)/g;
  return svgStr.replace(textGroupRegex, (fullMatch, openTag, innerContent, closeTag) => {
    let hasMissing = false;
    for (const gid of missingGlyphIds) {
      if (innerContent.includes(`href="#${gid}"`)) {
        hasMissing = true;
        break;
      }
    }

    const textMatch = innerContent.match(/<h5:div\s+class="tsel"[^>]*>([\s\S]*?)<\/h5:div>/);
    if (!textMatch) return fullMatch;

    const textContent = textMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    if (hasMissing) {
      const fillMatch = openTag.match(/fill="([^"]+)"/);
      const fill = fillMatch ? fillMatch[1] : '#0f172a';
      // 提取外层 foreignObject 的排版度量宽度（乘以 16 映射到 1000 相对字号坐标系）
      const foWidthMatch = innerContent.match(/<foreignObject[^>]*width="([0-9.]+)"/);
      let lengthAttr = '';
      if (foWidthMatch) {
        const targetAdvance = Math.round(parseFloat(foWidthMatch[1]) * 16);
        if (targetAdvance > 0) {
          lengthAttr = ` textLength="${targetAdvance}" lengthAdjust="spacingAndGlyphs"`;
        }
      }

      // 移除 notdef 方框 <use .../>
      const cleanedInner = innerContent.replace(/<use\s+[^>]*\/>/g, '');
      // 注入 scale(1, -1) 抵消外层翻转，并以 1000 相对字号与精确 targetAdvance 渲染真实字体，彻底避免中英混排重叠
      const svgText = `<text x="0" y="0" transform="scale(1, -1)" font-size="1000" fill="${fill}" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'SimHei', 'Source Han Sans SC', sans-serif"${lengthAttr}>${textContent}</text>`;
      return `${openTag}${svgText}${cleanedInner}${closeTag}`;
    }

    return fullMatch;
  });
}

/**
 * 将 Typst.ts 生成的多页复合 SVG 拆分为多页矢量对象
 */
export function splitMultiPageSvg(fullSvg: string): TypstPage[] {
  if (!fullSvg) return [];

  // 全局提取缺失字形 ID 集合
  const globalMissingGlyphs = new Set<string>();
  const globalDefPathRegex = /<path\s+id="([^"]+)"\s+class="outline_glyph"\s+d="([^"]+)"/g;
  let gm;
  while ((gm = globalDefPathRegex.exec(fullSvg)) !== null) {
    const d = gm[2];
    if (d.includes('L 500 0 L 500') || d.includes('L 250 304') || d.includes('L 250 305')) {
      globalMissingGlyphs.add(gm[1]);
    }
  }

  // 提取所有公共 <defs> 与 <style>
  const defsMatches = fullSvg.match(/<defs[\s\S]*?<\/defs>/g) || [];
  const styleMatches = fullSvg.match(/<style[\s\S]*?<\/style>/g) || [];
  const defsContent = defsMatches.join('\n') + '\n' + styleMatches.join('\n');

  const pages: TypstPage[] = [];
  let searchIdx = 0;
  let pageIndex = 0;

  // 使用严格层级平衡算法提取每一个 <g class="typst-page" ...>
  while ((searchIdx = fullSvg.indexOf('<g class="typst-page"', searchIdx)) !== -1) {
    const res = extractBalancedG(fullSvg, searchIdx);
    if (!res) {
      searchIdx++;
      continue;
    }

    pageIndex++;
    const widthMatch = res.openTag.match(/data-page-width="([^"]+)"/);
    const heightMatch = res.openTag.match(/data-page-height="([^"]+)"/);
    const width = widthMatch ? parseFloat(widthMatch[1]) : 595.28;
    const height = heightMatch ? parseFloat(heightMatch[1]) : 841.89;

    // 重置每个单页根部的 transform translate，使得各页从 (0, 0) 原点渲染，而不是累加纵向偏移
    const normalizedPageTag = res.openTag.replace(/transform="translate\([^)]+\)"/, 'transform="translate(0, 0)"');
    const pageBodyWithZeroOffset = res.full.replace(res.openTag, normalizedPageTag);

    // 修补缺失字模占位，确保中文或特殊字体完美可视
    const patchedBody = patchMissingGlyphs(pageBodyWithZeroOffset, globalMissingGlyphs);

    const singleSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="100%" height="100%" class="typst-page-svg" style="--glyph_fill: #1e293b; --glyph_stroke: #1e293b; display: block;">
        <style>
          .outline_glyph path, path.outline_glyph { fill: var(--glyph_fill, #1e293b) !important; stroke: var(--glyph_stroke, #1e293b) !important; }
          .tsel { color: transparent !important; }
        </style>
        ${defsContent}
        <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="2" />
        ${patchedBody}
      </svg>
    `.trim();

    pages.push({
      pageNumber: pageIndex,
      width,
      height,
      svgContent: singleSvg,
    });

    searchIdx = res.endIndex;
  }

  // 如果未能拆分出独立的 typst-page 元素，则修补整体作为单页返回
  if (pages.length === 0) {
    const viewBoxMatch = fullSvg.match(/viewBox="0\s+0\s+([0-9.]+)\s+([0-9.]+)"/);
    const width = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 595.28;
    const height = viewBoxMatch ? parseFloat(viewBoxMatch[2]) : 841.89;

    const patchedSvg = patchMissingGlyphs(fullSvg, globalMissingGlyphs);

    pages.push({
      pageNumber: 1,
      width,
      height,
      svgContent: patchedSvg,
    });
  }

  return pages;
}

/**
 * 调用官方 typst.ts WASM 编译器编译源码为出版级矢量 SVG 页面
 */
export async function compileTypstWithOfficialWasm(source: string): Promise<TypstCompileResult> {
  const metadata = extractTypstMetadata(source);
  const outline = extractOutlineFromSource(source);

  if (!source || !source.trim()) {
    return {
      success: true,
      pages: [],
      outline: [],
      totalPageCount: 0,
      metadata,
    };
  }

  try {
    await ensureTypstWasmInitialized();

    // 预处理 Typst 源码中未转义的邮箱地址（例如 zhangsan@example.com -> #"zhangsan@example.com"），防止 Typst 将其误判为标签语法报错
    const safeSource = source.replace(
      /(?<!#["\w])([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?!["\w])/g,
      '#"$1@$2"'
    );

    const rawSvg = await $typst.svg({
      mainContent: safeSource,
    });

    const pages = splitMultiPageSvg(rawSvg);

    return {
      success: true,
      pages,
      outline,
      totalPageCount: pages.length,
      metadata,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      pages: [],
      outline,
      totalPageCount: 0,
      error: errorMessage,
      metadata,
    };
  }
}
