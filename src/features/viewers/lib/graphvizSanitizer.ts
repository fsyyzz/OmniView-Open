/**
 * Graphviz / DOT SVG 安全清洗与输入防护机制
 */
import DOMPurify from 'dompurify';

export const GRAPHVIZ_MAX_SOURCE_LENGTH = 100_000;
export const GRAPHVIZ_MAX_ESTIMATED_NODES = 2_000;

export interface GraphvizValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 校验 Graphviz / DOT 源码是否符合安全与性能边界
 */
export function validateGraphvizSource(source: string): GraphvizValidationResult {
  if (!source || !source.trim()) {
    return { valid: false, error: 'Graphviz 源码为空 (Empty DOT source)' };
  }

  if (source.length > GRAPHVIZ_MAX_SOURCE_LENGTH) {
    return {
      valid: false,
      error: `Graphviz 源码超出最大安全字符限制 (${source.length} > ${GRAPHVIZ_MAX_SOURCE_LENGTH})`,
    };
  }

  // 粗略估算节点和边定义数量，防止巨型 DoS 输入
  const semicolonCount = (source.match(/;/g) || []).length;
  const arrowCount = (source.match(/->|--/g) || []).length;
  const estimatedElements = semicolonCount + arrowCount;

  if (estimatedElements > GRAPHVIZ_MAX_ESTIMATED_NODES * 2) {
    return {
      valid: false,
      error: `Graphviz 语法结构过于庞大，超出安全拓扑上限 (估算元素: ${estimatedElements} > ${GRAPHVIZ_MAX_ESTIMATED_NODES})`,
    };
  }

  return { valid: true };
}

/**
 * DOMPurify 安全配置，专用于 Graphviz 生成的 SVG 矢量图
 */
const GRAPHVIZ_DOMPURIFY_CONFIG: Record<string, any> = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ALLOWED_TAGS: [
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop',
    'use', 'symbol', 'marker', 'title', 'desc', 'style'
  ],
  ALLOWED_ATTR: [
    'viewBox', 'xmlns', 'xmlns:xlink', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'fill-opacity',
    'stroke-opacity', 'transform', 'style', 'id', 'class', 'offset', 'stop-color', 'stop-opacity',
    'preserveAspectRatio', 'text-anchor', 'font-family', 'font-size', 'font-weight',
    'points', 'dx', 'dy', 'marker-end', 'marker-start', 'marker-mid', 'title'
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'foreignObject', 'applet', 'meta', 'link'],
  FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onmouseout', 'href', 'xlink:href'],
  ALLOW_DATA_ATTR: false,
};

/**
 * 清洗 Graphviz WASM 生成的原始 SVG 文本
 */
export function sanitizeGraphvizSvg(rawSvg: string): string {
  if (!rawSvg) return '';

  // 1. 移除非 SVG 前缀（如 xml 声明、DOCTYPE、注释）
  const svgStartIndex = rawSvg.indexOf('<svg');
  if (svgStartIndex === -1) {
    throw new Error('Graphviz 输出未包含有效 <svg> 根节点');
  }
  const cleanSource = rawSvg.slice(svgStartIndex);

  // 2. DOMPurify 安全过滤
  const sanitized = DOMPurify.sanitize(cleanSource, GRAPHVIZ_DOMPURIFY_CONFIG) as unknown as string;

  if (!sanitized || !sanitized.includes('<svg')) {
    throw new Error('SVG 经安全清洗后内容无效');
  }

  return sanitized;
}
