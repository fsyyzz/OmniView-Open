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
 * 获取 DOMPurify 净化实例（支持 ESM default、CJS、浏览器及沙箱环境）
 */
function getPurifyInstance() {
  if (typeof DOMPurify?.sanitize === 'function') {
    return DOMPurify;
  }
  const defaultPurify = (DOMPurify as any)?.default;
  if (typeof defaultPurify?.sanitize === 'function') {
    return defaultPurify;
  }
  if (typeof window !== 'undefined') {
    if (typeof DOMPurify === 'function') {
      return (DOMPurify as any)(window);
    }
    if (typeof defaultPurify === 'function') {
      return defaultPurify(window);
    }
  }
  return null;
}

/**
 * 容错安全矢量清洗（当 DOMPurify 实例在当前环境下未就绪时执行兜底过滤）
 */
function fallbackSanitizeSvg(html: string): string {
  if (!html) return '';
  return html
    // 移除危险脚本与可执行容器标签
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    // 移除各类 on* 内联事件属性 (如 onload, onerror, onclick, onmouseover 等)
    .replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    // 阻断 javascript: 伪协议与 data:text/html 注入
    .replace(/href\s*=\s*["'](?:javascript:|data:text\/html)[^"']*["']/gi, 'href="#"')
    .replace(/xlink:href\s*=\s*["'](?:javascript:|data:text\/html)[^"']*["']/gi, 'xlink:href="#"');
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

  // 2. 多阶安全过滤：优先调用 DOMPurify 净化，无法加载时平滑自愈降级到兜底安全清洗
  const purify = getPurifyInstance();
  let sanitized = '';

  if (purify && typeof purify.sanitize === 'function') {
    sanitized = purify.sanitize(cleanSource, GRAPHVIZ_DOMPURIFY_CONFIG) as unknown as string;
  } else {
    sanitized = fallbackSanitizeSvg(cleanSource);
  }

  if (!sanitized || !sanitized.includes('<svg')) {
    throw new Error('SVG 经安全清洗后内容无效');
  }

  return sanitized;
}
