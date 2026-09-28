/**
 * OmniView SVG 自适应排版引擎 (SVG Responsive Layout Engine)
 * 作者: 周赞
 *
 * 核心目标：确保 Markdown 中渲染的任意来源 SVG（包括内联 svg 代码块、本地 .svg 引用、
 * 外部绘制工具导出的无 viewBox 矢量图等）在不同视口宽度与布局容器中均能 100% 优雅自适应。
 */

export interface AdaptiveSvgResult {
  svgHtml: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  viewBox?: string;
  hasViewBox: boolean;
}

/**
 * 解析并优化待渲染的 SVG 文本，使其在任意容器与显示空间中完美自适应
 */
export function prepareAdaptiveSvg(rawSvg: string): AdaptiveSvgResult {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return { svgHtml: '', hasViewBox: false };
  }

  const trimmed = rawSvg.trim();
  if (!trimmed) {
    return { svgHtml: '', hasViewBox: false };
  }

  // 匹配根 <svg ...> 标签
  const svgTagMatch = trimmed.match(/<svg\b([^>]*)>/i);
  if (!svgTagMatch) {
    return { svgHtml: trimmed, hasViewBox: false };
  }

  const attrsStr = svgTagMatch[1];

  // 提取现有属性
  const viewBoxMatch = attrsStr.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const widthMatch = attrsStr.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = attrsStr.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const preserveMatch = attrsStr.match(/\bpreserveAspectRatio\s*=\s*["']([^"']+)["']/i);

  let viewBox = viewBoxMatch ? viewBoxMatch[1].trim() : '';
  const widthVal = widthMatch ? widthMatch[1].trim() : '';
  const heightVal = heightMatch ? heightMatch[1].trim() : '';

  let intrinsicWidth: number | undefined;
  let intrinsicHeight: number | undefined;

  // 1. 从已有的 viewBox 提取固有宽度与高度
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(parseFloat).filter((n) => !isNaN(n));
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      intrinsicWidth = parts[2];
      intrinsicHeight = parts[3];
    }
  }

  // 2. 若缺少 viewBox 但有 width / height，自动推导并补齐 viewBox
  const parseDim = (val: string): number => {
    if (!val || val.includes('%')) return 0;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    if (val.endsWith('pt')) return Math.round(num * 1.333 * 100) / 100;
    if (val.endsWith('mm')) return Math.round(num * 3.7795 * 100) / 100;
    if (val.endsWith('cm')) return Math.round(num * 37.795 * 100) / 100;
    if (val.endsWith('in')) return Math.round(num * 96 * 100) / 100;
    return num;
  };

  if (!viewBox && widthVal && heightVal) {
    const numW = parseDim(widthVal);
    const numH = parseDim(heightVal);
    if (numW > 0 && numH > 0) {
      viewBox = `0 0 ${numW} ${numH}`;
      intrinsicWidth = numW;
      intrinsicHeight = numH;
    }
  }

  // 3. 构建规范化自适应属性集
  let newAttrs = attrsStr;

  // 3.1 补充缺失的 viewBox
  if (viewBox && !viewBoxMatch) {
    newAttrs = ` viewBox="${viewBox}"` + newAttrs;
  }

  // 3.2 补齐 preserveAspectRatio="xMidYMid meet" 确保等比居中自适应
  if (!preserveMatch) {
    newAttrs += ' preserveAspectRatio="xMidYMid meet"';
  }

  // 3.3 清理内联 style 中写死的绝对尺寸，注入响应式自适应样式
  if (newAttrs.match(/\bstyle\s*=\s*["'][^"']*["']/i)) {
    newAttrs = newAttrs.replace(/\bstyle\s*=\s*["']([^"']*)["']/i, (_match, styleContent) => {
      const cleaned = styleContent
        .replace(/(?:^|;)\s*width\s*:[^;]+/gi, '')
        .replace(/(?:^|;)\s*height\s*:[^;]+/gi, '')
        .replace(/(?:^|;)\s*max-width\s*:[^;]+/gi, '')
        .replace(/(?:^|;)\s*max-height\s*:[^;]+/gi, '')
        .trim()
        .replace(/^;+|;+$/g, '');
      const prefix = cleaned ? `${cleaned}; ` : '';
      return ` style="${prefix}max-width: 100%; height: auto; display: block;"`;
    });
  } else {
    newAttrs += ' style="max-width: 100%; height: auto; display: block;"';
  }

  // 3.4 规范化根节点 width / height 属性，避免被浏览器硬编码锁死
  if (viewBox) {
    if (widthMatch) {
      newAttrs = newAttrs.replace(/\bwidth\s*=\s*["'][^"']+["']/i, 'width="100%"');
    } else {
      newAttrs += ' width="100%"';
    }
    if (heightMatch) {
      newAttrs = newAttrs.replace(/\bheight\s*=\s*["'][^"']+["']/i, 'height="auto"');
    }
  }

  const optimizedSvg = trimmed.replace(/<svg\b[^>]*>/i, `<svg${newAttrs}>`);

  return {
    svgHtml: optimizedSvg,
    intrinsicWidth,
    intrinsicHeight,
    viewBox,
    hasViewBox: Boolean(viewBox),
  };
}
