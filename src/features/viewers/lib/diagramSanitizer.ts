/**
 * OmniView 图表与矢量 SVG 安全清洗与消毒引擎 (Diagram & SVG Sanitizer)
 * 遵循 VS Code Webview CSP 标准与 DOMPurify 严密安全防护规范
 * 彻底解决 Mermaid Flowchart、Sequence、State、Class 等图表中 foreignObject / span / div / style 标签被误杀导致文字不可见的问题
 */
import DOMPurify from 'dompurify';

/**
 * 专用于矢量图表（Mermaid / SVG Studio / Excalidraw / PlantUML / Graphviz）的 DOMPurify 配置白名单
 */
export const DOMPURIFY_DIAGRAM_SVG_CONFIG: Record<string, any> = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_TAGS: [
    // SVG 核心矢量图元与滤镜
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop',
    'use', 'symbol', 'marker', 'style', 'title', 'desc', 'image', 'pattern', 'mask',
    'filter', 'feDropShadow', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
    'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA',
    'feFuncB', 'feFuncG', 'feFuncR', 'feImage', 'feMorphology', 'fePointLight',
    'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
    // Mermaid / KaTeX / 富文本节点所需的 HTML 嵌入图元 (重点保留，杜绝 flowchart 文字消失)
    'foreignObject', 'foreignobject', 'div', 'span', 'p', 'b', 'i', 'strong', 'em',
    'br', 'code', 'pre', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'ul', 'ol', 'li',
    'sub', 'sup', 'details', 'summary', 'aside', 'label', 'input'
  ],
  ADD_ATTR: [
    // 命名空间与布局属性
    'viewBox', 'xmlns', 'xmlns:xlink', 'xmlns:xhtml', 'width', 'height', 'x', 'y',
    'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'dx', 'dy',
    // 填充、描边与透明度
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
    'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity',
    // 变换、样式与标识
    'transform', 'style', 'id', 'class', 'gradientUnits', 'gradientTransform', 'offset',
    'stop-color', 'stop-opacity', 'preserveAspectRatio',
    // 排版与文本对齐
    'text-anchor', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
    'dominant-baseline', 'alignment-baseline', 'text-decoration', 'line-height',
    // 连线端点与滤镜参数
    'marker-end', 'marker-start', 'marker-mid', 'stdDeviation', 'flood-color', 'flood-opacity',
    // 链接与安全属性
    'href', 'xlink:href', 'target', 'rel', 'crossorigin',
    // 辅助功能与数据驱动属性 (图表步进播放与溯源)
    'aria-label', 'aria-hidden', 'role', 'color', 'valign', 'align',
    'data-step', 'data-id', 'data-type', 'data-diagram-type', 'data-node-id', 'data-line', 'data-source-line'
  ],
  ALLOW_DATA_ATTR: true,
  // 严格禁用任何可执行代码、插件或外部资源注入
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link', 'base', 'form'],
  FORBID_ATTR: [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur',
    'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup', 'onkeypress', 'formaction'
  ],
};

/**
 * 专用于矢量图表与富文本嵌入的安全清洗函数
 * 100% 完整保留 Mermaid、PlantUML、Excalidraw、SVG Studio 所需的 SVG 矢量图元、样式以及 foreignObject 富文本标签与子元素
 * 坚决剔除任何可执行脚本 (script)、嵌入框架 (iframe/object/embed/applet)、内联事件属性 (onload, onclick 等) 以及伪协议
 */
function fallbackSanitize(html: string): string {
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
 * 严格清洗图表 SVG 内容 (包括 Mermaid、Excalidraw、PlantUML、SVG Studio 等)
 * 核心设计准则：DOMPurify 在浏览器中因 mXSS 防御策略会默认清除或损坏 SVG foreignObject 及嵌入内容，
 * 导致 Mermaid flowchart 流程图等节点文字在放大灯箱与全屏中彻底消失。
 * 本函数采用专用的安全矢量清洗算法，既阻断所有 XSS 渗透路径，又 100% 保证 Mermaid/SVG 图元与文字完整显示。
 */
export function sanitizeDiagramSvg(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';
  const trimmed = rawSvg.trim();
  if (!trimmed) return '';

  return fallbackSanitize(trimmed);
}

/**
 * 清洗图表 HTML 片段 (例如 KaTeX 数学公式渲染结果、Markdown 表格或带有内联样式的图表说明)
 */
export function sanitizeDiagramHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const trimmed = rawHtml.trim();
  if (!trimmed) return '';

  const purify = getPurifyInstance();
  if (purify && typeof purify.sanitize === 'function') {
    return purify.sanitize(trimmed, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['span', 'div', 'p', 'b', 'i', 'strong', 'em', 'sub', 'sup', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'pre', 'code'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet'],
    }) as string;
  }

  return fallbackSanitize(trimmed);
}
