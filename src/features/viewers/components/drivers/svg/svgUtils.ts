/**
 * OmniView SVG 开发者工程工具库 (SVG Developer Utilities)
 */

export interface SvgStats {
  viewBox: string;
  width: string;
  height: string;
  elementCount: number;
  pathCount: number;
  groupCount: number;
  textCount: number;
  defsCount: number;
  byteSize: number;
}

export interface SvgValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
  column?: number;
}

export interface SvgElementInfo {
  index: number;
  tagName: string;
  id?: string;
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeDasharray?: string;
  strokeDashoffset?: string;
  strokeLinecap?: 'butt' | 'round' | 'square' | string;
  strokeLinejoin?: 'miter' | 'round' | 'bevel' | string;
  strokeMiterlimit?: string;
  markerStart?: string;
  markerEnd?: string;
  opacity?: string;
  textContent?: string;
  d?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  cx?: string;
  cy?: string;
  r?: string;
  rx?: string;
  ry?: string;
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
  points?: string;
  transform?: string;
  fontSize?: string;
  lineInSource?: number;
  outerXml?: string;
}

export interface SvgOptimizationResult {
  optimized: string;
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercentage: number;
}

/**
 * 解析 SVG 结构元数据
 */
export function parseSvgStats(svgText: string): SvgStats {
  const byteSize = typeof Blob !== 'undefined'
    ? new Blob([svgText]).size
    : Buffer.byteLength(svgText, 'utf8');

  const defaultStats: SvgStats = {
    viewBox: 'None',
    width: 'Auto',
    height: 'Auto',
    elementCount: 0,
    pathCount: 0,
    groupCount: 0,
    textCount: 0,
    defsCount: 0,
    byteSize,
  };

  if (!svgText.trim()) return defaultStats;

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return defaultStats;

      return {
        viewBox: svgEl.getAttribute('viewBox') || 'None',
        width: svgEl.getAttribute('width') || 'Auto',
        height: svgEl.getAttribute('height') || 'Auto',
        elementCount: svgEl.getElementsByTagName('*').length,
        pathCount: svgEl.getElementsByTagName('path').length,
        groupCount: svgEl.getElementsByTagName('g').length,
        textCount: svgEl.getElementsByTagName('text').length,
        defsCount: svgEl.getElementsByTagName('defs').length,
        byteSize,
      };
    } catch {
      return defaultStats;
    }
  } else {
    // Node.js 运行环境兼容提取
    const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/i);
    const widthMatch = svgText.match(/width=["']([^"']+)["']/i);
    const heightMatch = svgText.match(/height=["']([^"']+)["']/i);
    const pathMatches = svgText.match(/<path\b/gi) || [];
    const gMatches = svgText.match(/<g\b/gi) || [];
    const textMatches = svgText.match(/<text\b/gi) || [];
    const defsMatches = svgText.match(/<defs\b/gi) || [];
    const allTagMatches = svgText.match(/<[a-zA-Z0-9_-]+\b/g) || [];

    return {
      viewBox: viewBoxMatch ? viewBoxMatch[1] : 'None',
      width: widthMatch ? widthMatch[1] : 'Auto',
      height: heightMatch ? heightMatch[1] : 'Auto',
      elementCount: Math.max(0, allTagMatches.length - 1),
      pathCount: pathMatches.length,
      groupCount: gMatches.length,
      textCount: textMatches.length,
      defsCount: defsMatches.length,
      byteSize,
    };
  }
}

/**
 * 实时校验 SVG XML 语法合法性
 */
export function validateSvg(svgText: string): SvgValidationResult {
  const trimmed = svgText.trim();
  if (!trimmed) {
    return { valid: false, error: 'SVG 内容为空' };
  }

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');

      if (parserError) {
        const errorText = parserError.textContent || 'XML 语法解析错误';
        let line: number | undefined;
        let column: number | undefined;

        const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/行\s*(\d+)/i);
        const colMatch = errorText.match(/column\s+(\d+)/i) || errorText.match(/列\s*(\d+)/i);

        if (lineMatch) line = parseInt(lineMatch[1], 10);
        if (colMatch) column = parseInt(colMatch[1], 10);

        const cleaned = errorText
          .split('\n')[0]
          .replace(/This page contains the following errors:/i, '')
          .trim();

        return {
          valid: false,
          error: cleaned || 'XML 标签未正确闭合或包含非法字符',
          line,
          column,
        };
      }

      const svgEl = doc.querySelector('svg');
      if (!svgEl) {
        return {
          valid: false,
          error: '根节点缺失 <svg> 元素',
        };
      }

      return { valid: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, error: message };
    }
  } else {
    // Node.js 容错校验
    if (!/<svg\b[^>]*>/i.test(trimmed)) {
      return { valid: false, error: '根节点缺失 <svg> 元素' };
    }
    if (!/<\/svg\s*>$/i.test(trimmed) && !/<svg\b[^>]*\/>/i.test(trimmed)) {
      return { valid: false, error: '缺失 </svg> 闭合标签' };
    }
    return { valid: true };
  }
}

/**
 * 格式化美化 SVG XML 缩进
 */
export function prettifySvg(svgText: string): string {
  const trimmed = svgText.trim();
  if (!trimmed) return '';

  let formatted = '';
  let indentLevel = 0;
  const indent = '  ';

  // 正则拆分 XML 标签与文本内容
  const reg = /(>)(<)(\/*)/g;
  const normalized = trimmed
    .replace(/\r\n/g, '\n')
    .replace(reg, '$1\r\n$2$3');

  const lines = normalized.split('\r\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isClosing = /^<\//.test(line);
    const isSelfClosing = /\/>$/.test(line) || /^<[\?!]/.test(line);
    const isOpening = /^<[^\/!?]/.test(line) && !isSelfClosing;

    if (isClosing) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    formatted += indent.repeat(indentLevel) + line + '\n';

    if (isOpening) {
      indentLevel++;
    }
  }

  return formatted.trim();
}

/**
 * 开发者工程级 SVGO 净化优化
 * 移除无用 metadata、注释、设计器私有属性与冗余空白
 */
export function optimizeSvg(svgText: string): SvgOptimizationResult {
  const originalSize = new Blob([svgText]).size;
  let res = svgText.trim();

  // 1. 移除 XML 声明与 DOCTYPE
  res = res.replace(/<\?xml[\s\S]*?\?>/gi, '');
  res = res.replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // 2. 移除 XML 注释
  res = res.replace(/<!--[\s\S]*?-->/g, '');

  // 3. 移除设计器私有命名空间与标签 (Illustrator / Inkscape / Sketch / Figma)
  res = res.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
  res = res.replace(/<sodipodi:namedview[\s\S]*?\/>/gi, '');
  res = res.replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/gi, '');

  // 移除私有命名空间定义
  res = res.replace(/\s+xmlns:(inkscape|sodipodi|sketch|illustrator|adobe|serif|v|x)="[^"]*"/gi, '');

  // 移除设计器属性
  res = res.replace(/\s+(inkscape|sodipodi|sketch|illustrator|adobe|serif|v):[a-zA-Z0-9_-]+="[^"]*"/gi, '');
  res = res.replace(/\s+data-name="[^"]*"/gi, '');
  res = res.replace(/\s+version="1\.[01]"/gi, '');
  res = res.replace(/\s+xml:space="preserve"/gi, '');

  // 4. 清理空容器标签
  res = res.replace(/<g[^>]*>\s*<\/g>/gi, '');
  res = res.replace(/<defs[^>]*>\s*<\/defs>/gi, '');

  // 5. 格式化属性间多余换行与空格
  res = res.replace(/\s{2,}/g, ' ');
  res = res.replace(/>\s+</g, '><');

  // 6. 清理多余浮点数尾随零 (如 12.0000 -> 12, 45.60 -> 45.6)
  res = res.replace(/(\d+\.\d*?[1-9])0+(?=[,\s\)"'])/g, '$1');
  res = res.replace(/(\d+)\.0+(?=[,\s\)"'])/g, '$1');

  // 7. 使用规整的格式美化输出
  const prettified = prettifySvg(res);
  const optimizedSize = new Blob([prettified]).size;
  const savedBytes = Math.max(0, originalSize - optimizedSize);
  const savedPercentage = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

  return {
    optimized: prettified,
    originalSize,
    optimizedSize,
    savedBytes,
    savedPercentage,
  };
}

/**
 * 转换 SVG 属性名为 React JSX CamelCase 命名
 */
const SVG_TO_JSX_ATTR_MAP: Record<string, string> = {
  'accent-height': 'accentHeight',
  'alignment-baseline': 'alignmentBaseline',
  'arabic-form': 'arabicForm',
  'baseline-shift': 'baselineShift',
  'cap-height': 'capHeight',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'color-interpolation': 'colorInterpolation',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'color-profile': 'colorProfile',
  'color-rendering': 'colorRendering',
  'dominant-baseline': 'dominantBaseline',
  'enable-background': 'enableBackground',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'flood-color': 'floodColor',
  'flood-opacity': 'floodOpacity',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-size-adjust': 'fontSizeAdjust',
  'font-stretch': 'fontStretch',
  'font-style': 'fontStyle',
  'font-variant': 'fontVariant',
  'font-weight': 'fontWeight',
  'glyph-name': 'glyphName',
  'image-rendering': 'imageRendering',
  'letter-spacing': 'letterSpacing',
  'lighting-color': 'lightingColor',
  'marker-end': 'markerEnd',
  'marker-mid': 'markerMid',
  'marker-start': 'markerStart',
  'paint-order': 'paintOrder',
  'pointer-events': 'pointerEvents',
  'shape-rendering': 'shapeRendering',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  'text-anchor': 'textAnchor',
  'text-decoration': 'textDecoration',
  'text-rendering': 'textRendering',
  'vector-effect': 'vectorEffect',
  'word-spacing': 'wordSpacing',
  'writing-mode': 'writingMode',
  'xmlns:xlink': 'xmlnsXlink',
  'xlink:href': 'xlinkHref',
  'class': 'className',
};

/**
 * 转换 SVG 为现代 React JSX 组件 (TypeScript)
 */
export function convertSvgToReact(svgText: string, componentName = 'SvgIcon'): string {
  let clean = svgText
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // 转换属性
  for (const [svgAttr, jsxAttr] of Object.entries(SVG_TO_JSX_ATTR_MAP)) {
    const reg = new RegExp(`\\s+${svgAttr}=`, 'g');
    clean = clean.replace(reg, ` ${jsxAttr}=`);
  }

  // 为 <svg> 根标签注入 {...props}
  clean = clean.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    return `<svg${attrs} {...props}>`;
  });

  const formatted = prettifySvg(clean);
  const indented = formatted
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');

  return `import React from 'react';

export interface ${componentName}Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ${componentName}: React.FC<${componentName}Props> = (props) => (
${indented}
);

export default ${componentName};
`;
}

/**
 * 转换 SVG 为 Vue 3 SFC 单文件组件 (<template>)
 */
export function convertSvgToVue(svgText: string): string {
  let clean = svgText
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const formatted = prettifySvg(clean);
  const indented = formatted
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');

  return `<template>
${indented}
</template>

<script setup lang="ts">
/**
 * 由 OmniView SVG Studio 生成的 Vue 3 组件
 */
</script>
`;
}

/**
 * 转换 SVG 为 Base64 Data URI
 */
export function convertSvgToDataUri(svgText: string): string {
  const clean = svgText.trim();
  // 采用现代浏览器与 Node.js 均安全兼容的 UTF-8 编码方式
  if (typeof window !== 'undefined') {
    const encoded = window.btoa(unescape(encodeURIComponent(clean)));
    return `data:image/svg+xml;base64,${encoded}`;
  } else {
    const encoded = Buffer.from(clean, 'utf8').toString('base64');
    return `data:image/svg+xml;base64,${encoded}`;
  }
}

/**
 * 将 SVG 导出为高清位图 PNG (支持倍率超采样)
 */
export function exportSvgAsPng(svgText: string, fileName = 'graphic.png', scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) {
        throw new Error('未找到有效的 SVG 根元素');
      }

      // 获取物理尺寸或 viewBox
      let width = parseFloat(svgEl.getAttribute('width') || '');
      let height = parseFloat(svgEl.getAttribute('height') || '');

      if (isNaN(width) || isNaN(height)) {
        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/[\s,]+/).map(parseFloat);
          if (parts.length >= 4) {
            width = parts[2];
            height = parts[3];
          }
        }
      }

      if (isNaN(width) || width <= 0) width = 800;
      if (isNaN(height) || height <= 0) height = 600;

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');

      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            reject(new Error('PNG 导出失败'));
            return;
          }
          const downloadUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fileName.endsWith('.png') ? fileName : `${fileName.replace(/\.svg$/i, '')}.png`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          resolve();
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('SVG 图像渲染失败'));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 获取用于图形检视的 SVG 核心图元列表
 */
export function getSvgTargetElements(root: Document | Element): Element[] {
  const all = Array.from(root.querySelectorAll('*'));
  const ignoreTags = new Set([
    'svg', 'defs', 'style', 'title', 'desc', 'clippath', 'mask',
    'filter', 'lineargradient', 'radialgradient', 'stop', 'metadata'
  ]);
  return all.filter(el => !ignoreTags.has(el.tagName.toLowerCase()));
}

/**
 * 移除由检视器注入的临时 data-omni-* 属性
 */
export function cleanOmniAttributes(root: Document | Element): void {
  const elements = root.querySelectorAll('*');
  elements.forEach(el => {
    el.removeAttribute('data-omni-id');
    el.removeAttribute('data-omni-selected');
    el.classList.remove('omni-selected');
    if (el.getAttribute('class')?.trim() === '') {
      el.removeAttribute('class');
    }
  });
}

/**
 * 在 SVG 源码中查找指定图元所在行号 (1-indexed)
 */
export function findLineInSource(
  svgText: string,
  tagName: string,
  id?: string,
  attrSignature?: string
): number {
  const lines = svgText.split('\n');
  if (id) {
    const idRegex = new RegExp(`id=["']${id}["']`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (idRegex.test(lines[i])) return i + 1;
    }
  }
  if (attrSignature && attrSignature.trim().length > 5) {
    const snippet = attrSignature.trim().slice(0, 15).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(snippet)) return i + 1;
    }
  }
  const tagRegex = new RegExp(`<${tagName}\\b`, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (tagRegex.test(lines[i])) return i + 1;
  }
  return 1;
}

/**
 * 为 SVG 图元注入 data-omni-id 索引，支持点选高亮
 */
export function tagSvgWithNodeIds(svgText: string, selectedIndex?: number | null): string {
  const trimmed = svgText.trim();
  if (!trimmed) return svgText;

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const elements = getSvgTargetElements(doc);
      elements.forEach((el, idx) => {
        el.setAttribute('data-omni-id', String(idx));
        if (selectedIndex === idx) {
          el.setAttribute('data-omni-selected', 'true');
          el.classList.add('omni-selected');
        }
      });
      return new XMLSerializer().serializeToString(doc);
    } catch {
      return svgText;
    }
  } else {
    // Node.js 运行环境兼容
    let idx = 0;
    return trimmed.replace(/<(path|rect|circle|ellipse|line|polyline|polygon|text|tspan|g|image|use)\b([^>]*)>/gi, (_match, tag, attrs) => {
      const currentIdx = idx++;
      const isSelected = selectedIndex === currentIdx;
      const extra = `data-omni-id="${currentIdx}"${isSelected ? ' data-omni-selected="true" class="omni-selected"' : ''}`;
      return `<${tag} ${extra} ${attrs}>`.replace(/\s+/g, ' ').replace(' >', '>');
    });
  }
}

/**
 * 获取指定序号的图元详细属性信息
 */
export function getSvgElementInfo(svgText: string, targetIndex: number): SvgElementInfo | null {
  const trimmed = svgText.trim();
  if (!trimmed) return null;

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const elements = getSvgTargetElements(doc);
      const el = elements[targetIndex];
      if (!el) return null;

      const tagName = el.tagName.toLowerCase();
      const id = el.getAttribute('id') || undefined;
      const className = el.getAttribute('class') || undefined;
      const fill = el.getAttribute('fill') || undefined;
      const stroke = el.getAttribute('stroke') || undefined;
      const strokeWidth = el.getAttribute('stroke-width') || undefined;
      const strokeDasharray = el.getAttribute('stroke-dasharray') || undefined;
      const strokeDashoffset = el.getAttribute('stroke-dashoffset') || undefined;
      const strokeLinecap = el.getAttribute('stroke-linecap') || undefined;
      const strokeLinejoin = el.getAttribute('stroke-linejoin') || undefined;
      const strokeMiterlimit = el.getAttribute('stroke-miterlimit') || undefined;
      const markerStart = el.getAttribute('marker-start') || undefined;
      const markerEnd = el.getAttribute('marker-end') || undefined;
      const opacity = el.getAttribute('opacity') || undefined;
      const transform = el.getAttribute('transform') || undefined;
      const d = el.getAttribute('d') || undefined;
      const x = el.getAttribute('x') || undefined;
      const y = el.getAttribute('y') || undefined;
      const width = el.getAttribute('width') || undefined;
      const height = el.getAttribute('height') || undefined;
      const cx = el.getAttribute('cx') || undefined;
      const cy = el.getAttribute('cy') || undefined;
      const r = el.getAttribute('r') || undefined;
      const rx = el.getAttribute('rx') || undefined;
      const ry = el.getAttribute('ry') || undefined;
      const x1 = el.getAttribute('x1') || undefined;
      const y1 = el.getAttribute('y1') || undefined;
      const x2 = el.getAttribute('x2') || undefined;
      const y2 = el.getAttribute('y2') || undefined;
      const points = el.getAttribute('points') || undefined;
      const fontSize = el.getAttribute('font-size') || undefined;
      const textContent = (tagName === 'text' || tagName === 'tspan') ? (el.textContent || undefined) : undefined;

      const lineInSource = findLineInSource(svgText, tagName, id, d || x || cx || x1 || textContent);
      const outerXml = (typeof XMLSerializer !== 'undefined' ? new XMLSerializer().serializeToString(el) : '')
        .replace(/\s*data-omni-[a-z-]+="[^"]*"/g, '');

      return {
        index: targetIndex,
        tagName,
        id,
        className,
        fill,
        stroke,
        strokeWidth,
        strokeDasharray,
        strokeDashoffset,
        strokeLinecap,
        strokeLinejoin,
        strokeMiterlimit,
        markerStart,
        markerEnd,
        opacity,
        transform,
        fontSize,
        textContent,
        d,
        x,
        y,
        width,
        height,
        cx,
        cy,
        r,
        rx,
        ry,
        x1,
        y1,
        x2,
        y2,
        points,
        lineInSource,
        outerXml,
      };
    } catch {
      return null;
    }
  } else {
    // Node.js 提取逻辑
    const regex = /<(path|rect|circle|ellipse|line|polyline|polygon|text|tspan|g|image|use)\b([^>]*)>/gi;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = regex.exec(trimmed)) !== null) {
      if (idx === targetIndex) {
        const tagName = match[1].toLowerCase();
        const attrsStr = match[2];
        const getAttr = (name: string) => {
          const m = attrsStr.match(new RegExp(`(?:^|\\s)${name}=["']([^"']+)["']`, 'i'));
          return m ? m[1] : undefined;
        };
        const id = getAttr('id');
        const className = getAttr('class');
        const fill = getAttr('fill');
        const stroke = getAttr('stroke');
        const strokeWidth = getAttr('stroke-width');
        const strokeDasharray = getAttr('stroke-dasharray');
        const strokeDashoffset = getAttr('stroke-dashoffset');
        const strokeLinecap = getAttr('stroke-linecap');
        const strokeLinejoin = getAttr('stroke-linejoin');
        const strokeMiterlimit = getAttr('stroke-miterlimit');
        const markerStart = getAttr('marker-start');
        const markerEnd = getAttr('marker-end');
        const opacity = getAttr('opacity');
        const transform = getAttr('transform');
        const d = getAttr('d');
        const x = getAttr('x');
        const y = getAttr('y');
        const width = getAttr('width');
        const height = getAttr('height');
        const cx = getAttr('cx');
        const cy = getAttr('cy');
        const r = getAttr('r');
        const rx = getAttr('rx');
        const ry = getAttr('ry');
        const x1 = getAttr('x1');
        const y1 = getAttr('y1');
        const x2 = getAttr('x2');
        const y2 = getAttr('y2');
        const points = getAttr('points');

        let textContent: string | undefined;
        if (tagName === 'text' || tagName === 'tspan') {
          const textMatch = trimmed.slice(match.index).match(new RegExp(`<${tagName}[^>]*>([^<]*)<\\/${tagName}>`, 'i'));
          if (textMatch) textContent = textMatch[1];
        }

        const lineInSource = findLineInSource(svgText, tagName, id, d || x || cx || x1 || textContent);
        return {
          index: targetIndex,
          tagName,
          id,
          className,
          fill,
          stroke,
          strokeWidth,
          strokeDasharray,
          strokeDashoffset,
          strokeLinecap,
          strokeLinejoin,
          strokeMiterlimit,
          markerStart,
          markerEnd,
          opacity,
          transform,
          textContent,
          d,
          x,
          y,
          width,
          height,
          cx,
          cy,
          r,
          rx,
          ry,
          x1,
          y1,
          x2,
          y2,
          points,
          lineInSource,
          outerXml: match[0],
        };
      }
      idx++;
    }
    return null;
  }
}

/**
 * 更新指定序号图元的属性并反向序列化为格式化 XML
 */
export function updateSvgElement(
  svgText: string,
  targetIndex: number,
  updates: Partial<SvgElementInfo>
): string {
  const trimmed = svgText.trim();
  if (!trimmed) return svgText;

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const elements = getSvgTargetElements(doc);
      const target = elements[targetIndex];
      if (!target) return svgText;

      const setOrRemove = (attr: string, val: string | undefined) => {
        if (val === undefined) return;
        if (val === '' || val === 'none') {
          if (val === 'none') target.setAttribute(attr, 'none');
          else target.removeAttribute(attr);
        } else {
          target.setAttribute(attr, val);
        }
      };

      setOrRemove('fill', updates.fill);
      setOrRemove('stroke', updates.stroke);
      setOrRemove('stroke-width', updates.strokeWidth);
      setOrRemove('stroke-dasharray', updates.strokeDasharray);
      setOrRemove('stroke-dashoffset', updates.strokeDashoffset);
      setOrRemove('stroke-linecap', updates.strokeLinecap);
      setOrRemove('stroke-linejoin', updates.strokeLinejoin);
      setOrRemove('stroke-miterlimit', updates.strokeMiterlimit);
      setOrRemove('marker-start', updates.markerStart);
      setOrRemove('marker-end', updates.markerEnd);
      setOrRemove('opacity', updates.opacity);
      setOrRemove('transform', updates.transform);
      setOrRemove('x', updates.x);
      setOrRemove('y', updates.y);
      setOrRemove('width', updates.width);
      setOrRemove('height', updates.height);
      setOrRemove('cx', updates.cx);
      setOrRemove('cy', updates.cy);
      setOrRemove('r', updates.r);
      setOrRemove('rx', updates.rx);
      setOrRemove('ry', updates.ry);
      setOrRemove('x1', updates.x1);
      setOrRemove('y1', updates.y1);
      setOrRemove('x2', updates.x2);
      setOrRemove('y2', updates.y2);
      setOrRemove('points', updates.points);
      setOrRemove('d', updates.d);
      setOrRemove('font-size', updates.fontSize);

      if (updates.textContent !== undefined) {
        target.textContent = updates.textContent;
      }

      cleanOmniAttributes(doc);
      return prettifySvg(new XMLSerializer().serializeToString(doc));
    } catch {
      return svgText;
    }
  } else {
    // Node.js fallback 属性更新
    const regex = /<(path|rect|circle|ellipse|line|polyline|polygon|text|tspan|g|image|use)\b([^>]*)>/gi;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = regex.exec(trimmed)) !== null) {
      if (idx === targetIndex) {
        let newAttrs = match[2];
        const applyAttr = (name: string, val: string | undefined) => {
          if (val === undefined) return;
          const attrRegex = new RegExp(`(\\s*${name}=["'][^"']*["'])`, 'i');
          if (val === '') {
            newAttrs = newAttrs.replace(attrRegex, '');
          } else if (attrRegex.test(newAttrs)) {
            newAttrs = newAttrs.replace(attrRegex, ` ${name}="${val}"`);
          } else {
            newAttrs = `${newAttrs} ${name}="${val}"`;
          }
        };

        applyAttr('fill', updates.fill);
        applyAttr('stroke', updates.stroke);
        applyAttr('stroke-width', updates.strokeWidth);
        applyAttr('stroke-dasharray', updates.strokeDasharray);
        applyAttr('stroke-dashoffset', updates.strokeDashoffset);
        applyAttr('stroke-linecap', updates.strokeLinecap);
        applyAttr('stroke-linejoin', updates.strokeLinejoin);
        applyAttr('stroke-miterlimit', updates.strokeMiterlimit);
        applyAttr('marker-start', updates.markerStart);
        applyAttr('marker-end', updates.markerEnd);
        applyAttr('opacity', updates.opacity);
        applyAttr('transform', updates.transform);
        applyAttr('x', updates.x);
        applyAttr('y', updates.y);
        applyAttr('width', updates.width);
        applyAttr('height', updates.height);
        applyAttr('cx', updates.cx);
        applyAttr('cy', updates.cy);
        applyAttr('r', updates.r);
        applyAttr('rx', updates.rx);
        applyAttr('ry', updates.ry);
        applyAttr('x1', updates.x1);
        applyAttr('y1', updates.y1);
        applyAttr('x2', updates.x2);
        applyAttr('y2', updates.y2);
        applyAttr('points', updates.points);
        applyAttr('d', updates.d);

        const newTag = `<${match[1]}${newAttrs}>`.replace(/\s+/g, ' ');
        const before = trimmed.slice(0, match.index);
        const after = trimmed.slice(match.index + match[0].length);
        return prettifySvg(before + newTag + after);
      }
      idx++;
    }
    return svgText;
  }
}

/**
 * 删除指定图元
 */
export function removeSvgElement(svgText: string, targetIndex: number): string {
  const trimmed = svgText.trim();
  if (!trimmed) return svgText;

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const elements = getSvgTargetElements(doc);
      const target = elements[targetIndex];
      if (target && target.parentElement) {
        target.parentElement.removeChild(target);
        cleanOmniAttributes(doc);
        return prettifySvg(new XMLSerializer().serializeToString(doc));
      }
      return svgText;
    } catch {
      return svgText;
    }
  } else {
    // Node.js 简易图元标签剔除
    const regex = /<(path|rect|circle|ellipse|line|polyline|polygon|text|tspan|g|image|use)\b[^>]*(\/>|>.*?<\/\1>)/gis;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = regex.exec(trimmed)) !== null) {
      if (idx === targetIndex) {
        const before = trimmed.slice(0, match.index);
        const after = trimmed.slice(match.index + match[0].length);
        return prettifySvg(before + after);
      }
      idx++;
    }
    return svgText;
  }
}

/**
 * 调整图元图层层级 (置顶 / 置底) 并计算移动后的图元新索引
 */
export function moveSvgElement(
  svgText: string,
  targetIndex: number,
  direction: 'front' | 'back'
): { code: string; newIndex: number } {
  const trimmed = svgText.trim();
  if (!trimmed) return { code: svgText, newIndex: targetIndex };

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const elements = getSvgTargetElements(doc);
      const target = elements[targetIndex];
      if (target && target.parentElement) {
        if (direction === 'front') {
          target.parentElement.appendChild(target);
        } else {
          target.parentElement.insertBefore(target, target.parentElement.firstElementChild);
        }
        const updatedElements = getSvgTargetElements(doc);
        const newIndex = updatedElements.indexOf(target);
        cleanOmniAttributes(doc);
        return {
          code: prettifySvg(new XMLSerializer().serializeToString(doc)),
          newIndex: newIndex !== -1 ? newIndex : targetIndex,
        };
      }
      return { code: svgText, newIndex: targetIndex };
    } catch {
      return { code: svgText, newIndex: targetIndex };
    }
  }
  return { code: svgText, newIndex: targetIndex };
}

/**
 * 解析 SVG 画布实际视口边界尺寸
 */
export function parseSvgDimensions(svgText: string): { minX: number; minY: number; width: number; height: number } {
  const defaultBounds = { minX: 0, minY: 0, width: 800, height: 600 };
  const trimmed = svgText.trim();
  if (!trimmed) return defaultBounds;

  // 优先仅在 <svg ...> 根标签属性中提取，避免被内部子图元 width/height 干扰
  const rootMatch = trimmed.match(/<svg\b([^>]*)>/i);
  const rootAttrs = rootMatch ? rootMatch[1] : trimmed;

  // 尝试匹配 viewBox
  const vbMatch = rootAttrs.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
  if (vbMatch) {
    const minX = parseFloat(vbMatch[1]) || 0;
    const minY = parseFloat(vbMatch[2]) || 0;
    const width = parseFloat(vbMatch[3]) || 800;
    const height = parseFloat(vbMatch[4]) || 600;
    return { minX, minY, width, height };
  }

  // 尝试匹配 width 与 height (支持可选的 px 后缀)
  const wMatch = rootAttrs.match(/\bwidth=["']\s*([-\d.]+)(?:px)?\s*["']/i);
  const hMatch = rootAttrs.match(/\bheight=["']\s*([-\d.]+)(?:px)?\s*["']/i);
  if (wMatch && hMatch) {
    const width = parseFloat(wMatch[1]) || 800;
    const height = parseFloat(hMatch[1]) || 600;
    return { minX: 0, minY: 0, width, height };
  }

  return defaultBounds;
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  label: string;
}

export interface SnapResult {
  deltaX: number;
  deltaY: number;
  guides: SnapGuide[];
  snappedX: boolean;
  snappedY: boolean;
}

export interface ElementBBox {
  x: number;
  y: number;
  width: number;
  height: number;
  id?: string;
  tagName?: string;
}

/**
 * 图元拖拽智能吸附计算器 (画布边缘对齐 / 中心对齐 / 兄弟图元吸附)
 */
export function calculateElementSnapping(
  currentBBox: ElementBBox,
  rawDeltaX: number,
  rawDeltaY: number,
  canvasBounds: { minX: number; minY: number; width: number; height: number },
  siblingBBoxes: ElementBBox[] = [],
  snapThreshold = 8,
  enableGrid = false,
  gridSize = 10
): SnapResult {
  let deltaX = rawDeltaX;
  let deltaY = rawDeltaY;
  const guides: SnapGuide[] = [];
  let snappedX = false;
  let snappedY = false;

  // 1. 网格优先吸附 (如果显式启用)
  if (enableGrid && gridSize > 0) {
    const projectedX = currentBBox.x + deltaX;
    const projectedY = currentBBox.y + deltaY;
    const gridSnappedX = Math.round(projectedX / gridSize) * gridSize;
    const gridSnappedY = Math.round(projectedY / gridSize) * gridSize;
    deltaX = gridSnappedX - currentBBox.x;
    deltaY = gridSnappedY - currentBBox.y;
    return { deltaX, deltaY, guides: [], snappedX: true, snappedY: true };
  }

  const curLeft = currentBBox.x + deltaX;
  const curCenterX = curLeft + currentBBox.width / 2;
  const curRight = curLeft + currentBBox.width;

  const curTop = currentBBox.y + deltaY;
  const curCenterY = curTop + currentBBox.height / 2;
  const curBottom = curTop + currentBBox.height;

  // 建立 X 轴候选吸附参考线
  const xTargets: Array<{ pos: number; label: string }> = [
    { pos: canvasBounds.minX, label: '画布左边缘' },
    { pos: canvasBounds.minX + canvasBounds.width / 2, label: '画布水平居中' },
    { pos: canvasBounds.minX + canvasBounds.width, label: '画布右边缘' },
  ];

  // 建立 Y 轴候选吸附参考线
  const yTargets: Array<{ pos: number; label: string }> = [
    { pos: canvasBounds.minY, label: '画布顶边缘' },
    { pos: canvasBounds.minY + canvasBounds.height / 2, label: '画布垂直居中' },
    { pos: canvasBounds.minY + canvasBounds.height, label: '画布底边缘' },
  ];

  // 纳入兄弟图元边界吸附参考点
  for (const sib of siblingBBoxes) {
    const sibCenterX = sib.x + sib.width / 2;
    const sibCenterY = sib.y + sib.height / 2;
    const name = sib.id ? `#${sib.id}` : sib.tagName || '图元';

    xTargets.push(
      { pos: sib.x, label: `对齐 ${name} 左缘` },
      { pos: sibCenterX, label: `对齐 ${name} 水平中心` },
      { pos: sib.x + sib.width, label: `对齐 ${name} 右缘` }
    );
    yTargets.push(
      { pos: sib.y, label: `对齐 ${name} 顶缘` },
      { pos: sibCenterY, label: `对齐 ${name} 垂直中心` },
      { pos: sib.y + sib.height, label: `对齐 ${name} 底缘` }
    );
  }

  // 计算 X 轴吸附 (测试 当前左 / 中 / 右 离 参考点 的距离)
  let minDiffX = snapThreshold + 1;
  let bestAdjustX = 0;
  let bestGuideX: SnapGuide | null = null;

  for (const target of xTargets) {
    // 1. 当前 Left 吸附到 Target
    const diffLeft = target.pos - curLeft;
    if (Math.abs(diffLeft) <= snapThreshold && Math.abs(diffLeft) < minDiffX) {
      minDiffX = Math.abs(diffLeft);
      bestAdjustX = diffLeft;
      bestGuideX = { type: 'vertical', position: target.pos, label: target.label };
    }
    // 2. 当前 CenterX 吸附到 Target
    const diffCenter = target.pos - curCenterX;
    if (Math.abs(diffCenter) <= snapThreshold && Math.abs(diffCenter) < minDiffX) {
      minDiffX = Math.abs(diffCenter);
      bestAdjustX = diffCenter;
      bestGuideX = { type: 'vertical', position: target.pos, label: target.label };
    }
    // 3. 当前 Right 吸附到 Target
    const diffRight = target.pos - curRight;
    if (Math.abs(diffRight) <= snapThreshold && Math.abs(diffRight) < minDiffX) {
      minDiffX = Math.abs(diffRight);
      bestAdjustX = diffRight;
      bestGuideX = { type: 'vertical', position: target.pos, label: target.label };
    }
  }

  if (bestGuideX) {
    deltaX += bestAdjustX;
    guides.push(bestGuideX);
    snappedX = true;
  }

  // 计算 Y 轴吸附 (测试 当前顶 / 中 / 底 离 参考点 的距离)
  let minDiffY = snapThreshold + 1;
  let bestAdjustY = 0;
  let bestGuideY: SnapGuide | null = null;

  for (const target of yTargets) {
    // 1. 当前 Top 吸附到 Target
    const diffTop = target.pos - curTop;
    if (Math.abs(diffTop) <= snapThreshold && Math.abs(diffTop) < minDiffY) {
      minDiffY = Math.abs(diffTop);
      bestAdjustY = diffTop;
      bestGuideY = { type: 'horizontal', position: target.pos, label: target.label };
    }
    // 2. 当前 CenterY 吸附到 Target
    const diffCenter = target.pos - curCenterY;
    if (Math.abs(diffCenter) <= snapThreshold && Math.abs(diffCenter) < minDiffY) {
      minDiffY = Math.abs(diffCenter);
      bestAdjustY = diffCenter;
      bestGuideY = { type: 'horizontal', position: target.pos, label: target.label };
    }
    // 3. 当前 Bottom 吸附到 Target
    const diffBottom = target.pos - curBottom;
    if (Math.abs(diffBottom) <= snapThreshold && Math.abs(diffBottom) < minDiffY) {
      minDiffY = Math.abs(diffBottom);
      bestAdjustY = diffBottom;
      bestGuideY = { type: 'horizontal', position: target.pos, label: target.label };
    }
  }

  if (bestGuideY) {
    deltaY += bestAdjustY;
    guides.push(bestGuideY);
    snappedY = true;
  }

  return { deltaX, deltaY, guides, snappedX, snappedY };
}

/**
 * 线条端点与倾角智能吸附调整器 (水平/垂直正交吸附、45°角与边缘磁吸)
 */
export function calculateLineSnapping(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  activeEndpoint: 'p1' | 'p2' | 'both',
  canvasBounds: { minX: number; minY: number; width: number; height: number },
  siblingBBoxes: ElementBBox[] = [],
  snapThreshold = 8
): {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  guides: SnapGuide[];
  isOrthogonal: boolean;
} {
  const resultP1 = { ...p1 };
  const resultP2 = { ...p2 };
  const guides: SnapGuide[] = [];
  let isOrthogonal = false;

  // 若拖动单个端点，进行水平/垂直自动矫正
  if (activeEndpoint === 'p2' || activeEndpoint === 'p1') {
    const fixed = activeEndpoint === 'p2' ? resultP1 : resultP2;
    const moving = activeEndpoint === 'p2' ? resultP2 : resultP1;

    // 1. 水平线自动吸附 (y 逼近时自动平齐)
    if (Math.abs(moving.y - fixed.y) <= snapThreshold) {
      moving.y = fixed.y;
      isOrthogonal = true;
      guides.push({
        type: 'horizontal',
        position: fixed.y,
        label: '线条水平自动校准 (0°)',
      });
    }

    // 2. 垂直线自动吸附 (x 逼近时自动垂直)
    if (Math.abs(moving.x - fixed.x) <= snapThreshold) {
      moving.x = fixed.x;
      isOrthogonal = true;
      guides.push({
        type: 'vertical',
        position: fixed.x,
        label: '线条垂直自动校准 (90°)',
      });
    }

    // 3. 45° 对角线自动吸附
    const dx = Math.abs(moving.x - fixed.x);
    const dy = Math.abs(moving.y - fixed.y);
    if (!isOrthogonal && Math.abs(dx - dy) <= snapThreshold && dx > snapThreshold) {
      const avg = (dx + dy) / 2;
      moving.x = fixed.x + (moving.x > fixed.x ? avg : -avg);
      moving.y = fixed.y + (moving.y > fixed.y ? avg : -avg);
      guides.push({
        type: 'horizontal',
        position: moving.y,
        label: '线条 45° 对角角吸附',
      });
    }

    // 4. 端点吸附到兄弟图元锚点 (上/下/左/右边缘点与中心点)
    for (const sib of siblingBBoxes) {
      const anchors = [
        { x: sib.x + sib.width / 2, y: sib.y + sib.height / 2, name: '中心' },
        { x: sib.x, y: sib.y + sib.height / 2, name: '左侧锚点' },
        { x: sib.x + sib.width, y: sib.y + sib.height / 2, name: '右侧锚点' },
        { x: sib.x + sib.width / 2, y: sib.y, name: '顶部锚点' },
        { x: sib.x + sib.width / 2, y: sib.y + sib.height, name: '底部锚点' },
      ];
      for (const anc of anchors) {
        const dist = Math.hypot(moving.x - anc.x, moving.y - anc.y);
        if (dist <= snapThreshold) {
          moving.x = anc.x;
          moving.y = anc.y;
          guides.push({
            type: 'vertical',
            position: anc.x,
            label: `吸附至 ${sib.id || sib.tagName || '图元'} ${anc.name}`,
          });
          guides.push({
            type: 'horizontal',
            position: anc.y,
            label: `吸附至 ${sib.id || sib.tagName || '图元'} ${anc.name}`,
          });
          break;
        }
      }
    }
  }

  return { p1: resultP1, p2: resultP2, guides, isOrthogonal };
}

/**
 * 增量移动图元几何坐标 (适配 rect, circle, ellipse, line, text, path 等)
 */
export function moveSvgElementGeometry(
  svgText: string,
  targetIndex: number,
  deltaX: number,
  deltaY: number
): string {
  const trimmed = svgText.trim();
  if (!trimmed || (deltaX === 0 && deltaY === 0)) return svgText;

  const info = getSvgElementInfo(svgText, targetIndex);
  if (!info) return svgText;

  const updates: Partial<SvgElementInfo> = {};
  const round2 = (num: number) => Math.round(num * 100) / 100;

  switch (info.tagName) {
    case 'rect':
    case 'text':
    case 'tspan':
    case 'image':
    case 'use': {
      const curX = parseFloat(info.x || '0');
      const curY = parseFloat(info.y || '0');
      updates.x = String(round2(curX + deltaX));
      updates.y = String(round2(curY + deltaY));
      break;
    }
    case 'circle': {
      const curCx = parseFloat(info.cx || '0');
      const curCy = parseFloat(info.cy || '0');
      updates.cx = String(round2(curCx + deltaX));
      updates.cy = String(round2(curCy + deltaY));
      break;
    }
    case 'ellipse': {
      const curCx = parseFloat(info.cx || '0');
      const curCy = parseFloat(info.cy || '0');
      updates.cx = String(round2(curCx + deltaX));
      updates.cy = String(round2(curCy + deltaY));
      break;
    }
    case 'line': {
      const x1 = parseFloat(info.x1 || '0');
      const y1 = parseFloat(info.y1 || '0');
      const x2 = parseFloat(info.x2 || '0');
      const y2 = parseFloat(info.y2 || '0');
      updates.x1 = String(round2(x1 + deltaX));
      updates.y1 = String(round2(y1 + deltaY));
      updates.x2 = String(round2(x2 + deltaX));
      updates.y2 = String(round2(y2 + deltaY));
      break;
    }
    default: {
      // 对 path, polygon, polyline, g 采用 transform 增量位移
      const curTransform = info.transform || '';
      const translateMatch = curTransform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      let tx = 0;
      let ty = 0;
      if (translateMatch) {
        tx = parseFloat(translateMatch[1]) || 0;
        ty = parseFloat(translateMatch[2]) || 0;
        const newTranslate = `translate(${round2(tx + deltaX)}, ${round2(ty + deltaY)})`;
        updates.transform = curTransform.replace(/translate\([^)]+\)/i, newTranslate);
      } else if (curTransform.trim()) {
        updates.transform = `${curTransform} translate(${round2(deltaX)}, ${round2(deltaY)})`;
      } else {
        updates.transform = `translate(${round2(deltaX)}, ${round2(deltaY)})`;
      }
      break;
    }
  }

  return updateSvgElement(svgText, targetIndex, updates);
}

/**
 * 快速将图元对齐到画布边缘或中心
 */
export function alignSvgElement(
  svgText: string,
  targetIndex: number,
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  elementBBox: ElementBBox
): string {
  const canvas = parseSvgDimensions(svgText);
  let deltaX = 0;
  let deltaY = 0;

  switch (alignment) {
    case 'left':
      deltaX = canvas.minX - elementBBox.x;
      break;
    case 'center':
      deltaX = canvas.minX + (canvas.width - elementBBox.width) / 2 - elementBBox.x;
      break;
    case 'right':
      deltaX = canvas.minX + canvas.width - (elementBBox.x + elementBBox.width);
      break;
    case 'top':
      deltaY = canvas.minY - elementBBox.y;
      break;
    case 'middle':
      deltaY = canvas.minY + (canvas.height - elementBBox.height) / 2 - elementBBox.y;
      break;
    case 'bottom':
      deltaY = canvas.minY + canvas.height - (elementBBox.y + elementBBox.height);
      break;
  }

  return moveSvgElementGeometry(svgText, targetIndex, deltaX, deltaY);
}

/**
 * 一键将线条校准为绝对正交线 (水平或垂直)
 */
export function alignLineOrthogonal(
  svgText: string,
  targetIndex: number,
  mode: 'horizontal' | 'vertical'
): string {
  const info = getSvgElementInfo(svgText, targetIndex);
  if (!info || info.tagName !== 'line') return svgText;

  const y1 = parseFloat(info.y1 || '0');
  const x1 = parseFloat(info.x1 || '0');
  const updates: Partial<SvgElementInfo> = {};

  if (mode === 'horizontal') {
    updates.y2 = String(y1);
  } else {
    updates.x2 = String(x1);
  }

  return updateSvgElement(svgText, targetIndex, updates);
}

export type ResizeHandleDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface CalculatedResizeBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 根据拖拽手柄方向与位移量计算新的图元 BBox (支持等比缩放约束)
 */
export function calculateResizeBBox(
  initialBBox: ElementBBox,
  handle: ResizeHandleDirection,
  deltaX: number,
  deltaY: number,
  lockAspectRatio = false,
  minSize = 4
): CalculatedResizeBBox {
  let { x, y, width, height } = initialBBox;
  const initialAspect = initialBBox.width / (initialBBox.height || 1);

  // 1. 处理 X 轴方向位移
  if (handle.includes('e')) {
    width = Math.max(minSize, initialBBox.width + deltaX);
  } else if (handle.includes('w')) {
    const rawW = initialBBox.width - deltaX;
    if (rawW >= minSize) {
      width = rawW;
      x = initialBBox.x + deltaX;
    } else {
      width = minSize;
      x = initialBBox.x + initialBBox.width - minSize;
    }
  }

  // 2. 处理 Y 轴方向位移
  if (handle.includes('s')) {
    height = Math.max(minSize, initialBBox.height + deltaY);
  } else if (handle.includes('n')) {
    const rawH = initialBBox.height - deltaY;
    if (rawH >= minSize) {
      height = rawH;
      y = initialBBox.y + deltaY;
    } else {
      height = minSize;
      y = initialBBox.y + initialBBox.height - minSize;
    }
  }

  // 3. 处理等比锁定 (如按住 Shift 或角手柄等比)
  if (lockAspectRatio && (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se')) {
    // 依据变化较大的一侧同步另一侧
    const aspect = initialAspect || 1;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      height = Math.max(minSize, width / aspect);
      if (handle.includes('n')) {
        y = initialBBox.y + initialBBox.height - height;
      }
    } else {
      width = Math.max(minSize, height * aspect);
      if (handle.includes('w')) {
        x = initialBBox.x + initialBBox.width - width;
      }
    }
  }

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
}

/**
 * 调整图元几何尺寸 (适配 rect, circle, ellipse, text, image, path 等)
 */
export function resizeSvgElementGeometry(
  svgText: string,
  targetIndex: number,
  newBBox: CalculatedResizeBBox,
  initialBBox: ElementBBox
): string {
  const trimmed = svgText.trim();
  if (!trimmed) return svgText;

  const info = getSvgElementInfo(svgText, targetIndex);
  if (!info) return svgText;

  const updates: Partial<SvgElementInfo> = {};
  const round2 = (num: number) => Math.round(num * 100) / 100;

  switch (info.tagName) {
    case 'rect':
    case 'image':
    case 'use': {
      updates.x = String(newBBox.x);
      updates.y = String(newBBox.y);
      updates.width = String(newBBox.width);
      updates.height = String(newBBox.height);
      break;
    }
    case 'circle': {
      const radius = round2(Math.min(newBBox.width, newBBox.height) / 2);
      updates.r = String(radius);
      updates.cx = String(round2(newBBox.x + newBBox.width / 2));
      updates.cy = String(round2(newBBox.y + newBBox.height / 2));
      break;
    }
    case 'ellipse': {
      const rx = round2(newBBox.width / 2);
      const ry = round2(newBBox.height / 2);
      updates.rx = String(rx);
      updates.ry = String(ry);
      updates.cx = String(round2(newBBox.x + rx));
      updates.cy = String(round2(newBBox.y + ry));
      break;
    }
    case 'text':
    case 'tspan': {
      // 调整文本时：等比更新字号，并更新位置
      const prevW = initialBBox.width || 1;
      const prevH = initialBBox.height || 1;
      const scaleFactor = Math.max(newBBox.width / prevW, newBBox.height / prevH);
      const curFontSize = parseFloat(info.fontSize || '16') || 16;
      updates.fontSize = String(round2(Math.max(8, curFontSize * scaleFactor)));
      updates.x = String(newBBox.x);
      updates.y = String(round2(newBBox.y + newBBox.height)); // 文本基线通常对齐底部
      break;
    }
    default: {
      // path, polygon, polyline, g 等非规则图元：使用复合 scale 矩阵缩放
      const scaleX = initialBBox.width > 0 ? newBBox.width / initialBBox.width : 1;
      const scaleY = initialBBox.height > 0 ? newBBox.height / initialBBox.height : 1;
      const dx = newBBox.x - initialBBox.x * scaleX;
      const dy = newBBox.y - initialBBox.y * scaleY;

      const transformStr = `matrix(${round2(scaleX)} 0 0 ${round2(scaleY)} ${round2(dx)} ${round2(dy)})`;
      const curTransform = info.transform || '';
      if (curTransform.includes('matrix(')) {
        updates.transform = curTransform.replace(/matrix\([^)]+\)/i, transformStr);
      } else if (curTransform.trim()) {
        updates.transform = `${curTransform} ${transformStr}`;
      } else {
        updates.transform = transformStr;
      }
      break;
    }
  }

  return updateSvgElement(svgText, targetIndex, updates);
}

/**
 * 标准工业制图与流程图箭头及端点 Marker 定义模板
 */
export const STANDARD_SVG_MARKERS = `
  <defs id="omni-defs-markers">
    <marker id="omni-arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" />
    </marker>
    <marker id="omni-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 10 1 L 0 5 L 10 9 z" fill="currentColor" />
    </marker>
    <marker id="omni-circle-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <circle cx="5" cy="5" r="4" fill="currentColor" />
    </marker>
    <marker id="omni-circle-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <circle cx="5" cy="5" r="4" fill="currentColor" />
    </marker>
    <marker id="omni-stealth-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 L 3 5 z" fill="currentColor" />
    </marker>
    <marker id="omni-dimension-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="8" orient="auto">
      <line x1="5" y1="0" x2="5" y2="10" stroke="currentColor" stroke-width="2" />
    </marker>
    <marker id="omni-dimension-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="8" orient="auto">
      <line x1="5" y1="0" x2="5" y2="10" stroke="currentColor" stroke-width="2" />
    </marker>
  </defs>
`;

/**
 * 确保 SVG 中包含标准的流程箭头与端点 Marker 规范
 */
export function ensureSvgMarkers(svgText: string): string {
  if (svgText.includes('id="omni-arrow-end"') || svgText.includes("id='omni-arrow-end'")) {
    return svgText;
  }
  // 若已存在 <defs>，在第一个 <defs> 内部追加 markers；若不存在，在 <svg ...> 后新建 <defs>
  if (/<defs\b[^>]*>/i.test(svgText)) {
    const innerMarkers = STANDARD_SVG_MARKERS.replace(/<\/?defs[^>]*>/gi, '');
    return svgText.replace(/(<defs\b[^>]*>)/i, `$1\n${innerMarkers.trim()}`);
  }
  return svgText.replace(/(<svg\b[^>]*>)/i, `$1\n${STANDARD_SVG_MARKERS.trim()}`);
}

export interface LineMetrics {
  dx: number;
  dy: number;
  length: number;
  angleDeg: number;
  midPoint: { x: number; y: number };
  slopeType: 'horizontal' | 'vertical' | 'diagonal-45' | 'diagonal-135' | 'arbitrary';
}

/**
 * 计算线条的几何特征：距离、极角 (0°~360°)、中点与斜率分类
 * 支持传 (p1, p2) 对象或 (x1, y1, x2, y2) 平铺数值
 */
export function calculateLineMetrics(
  p1OrX1: { x: number; y: number } | number,
  p2OrY1: { x: number; y: number } | number,
  optX2?: number,
  optY2?: number
): LineMetrics {
  let p1: { x: number; y: number };
  let p2: { x: number; y: number };

  if (typeof p1OrX1 === 'number') {
    p1 = { x: p1OrX1, y: Number(p2OrY1) || 0 };
    p2 = { x: Number(optX2) || 0, y: Number(optY2) || 0 };
  } else {
    p1 = p1OrX1;
    p2 = p2OrY1 as { x: number; y: number };
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  const rad = Math.atan2(dy, dx);
  let angleDeg = (rad * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  const normalizedAngle = Math.round(angleDeg * 10) / 10;

  let slopeType: LineMetrics['slopeType'] = 'arbitrary';
  if (Math.abs(dy) < 0.05) slopeType = 'horizontal';
  else if (Math.abs(dx) < 0.05) slopeType = 'vertical';
  else if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.1) {
    slopeType = (dx * dy > 0) ? 'diagonal-45' : 'diagonal-135';
  }

  return {
    dx: Math.round(dx * 100) / 100,
    dy: Math.round(dy * 100) / 100,
    length: Math.round(length * 100) / 100,
    angleDeg: normalizedAngle,
    midPoint: {
      x: Math.round(((p1.x + p2.x) / 2) * 100) / 100,
      y: Math.round(((p1.y + p2.y) / 2) * 100) / 100,
    },
    slopeType,
  };
}

/**
 * 根据起点、目标长度和角度直接解算并更新终点坐标 (极坐标几何定位)
 */
export function updateLineByLengthAndAngle(
  p1: { x: number; y: number },
  length: number,
  angleDeg: number
): { x1: number; y1: number; x2: number; y2: number } {
  const safeLen = Math.max(1, length);
  const rad = (angleDeg * Math.PI) / 180;
  const x2 = p1.x + safeLen * Math.cos(rad);
  const y2 = p1.y + safeLen * Math.sin(rad);
  return {
    x1: Math.round(p1.x * 100) / 100,
    y1: Math.round(p1.y * 100) / 100,
    x2: Math.round(x2 * 100) / 100,
    y2: Math.round(y2 * 100) / 100,
  };
}

/**
 * 在 SVG 文本中对指定序号的 line 元素直接套用极坐标解算结果
 */
export function applyLinePolarCoords(
  svgText: string,
  targetIndex: number,
  length: number,
  angleDeg: number
): string {
  const info = getSvgElementInfo(svgText, targetIndex);
  if (!info || info.tagName !== 'line') return svgText;

  const p1 = { x: parseFloat(info.x1 || '0'), y: parseFloat(info.y1 || '0') };
  const coords = updateLineByLengthAndAngle(p1, length, angleDeg);

  return updateSvgElement(svgText, targetIndex, {
    x1: String(coords.x1),
    y1: String(coords.y1),
    x2: String(coords.x2),
    y2: String(coords.y2),
  });
}

/**
 * 一键反转线条起止点方向 (P1 ⇄ P2 互换，并智能互换起点与终点 Marker)
 */
export function reverseLineEndpoints(svgText: string, targetIndex: number): string {
  const info = getSvgElementInfo(svgText, targetIndex);
  if (!info || info.tagName !== 'line') return svgText;

  const updates: Partial<SvgElementInfo> = {
    x1: info.x2,
    y1: info.y2,
    x2: info.x1,
    y2: info.y1,
  };

  if (info.markerStart || info.markerEnd) {
    updates.markerStart = info.markerEnd || '';
    updates.markerEnd = info.markerStart || '';
  }

  return updateSvgElement(svgText, targetIndex, updates);
}

/**
 * 将直线升级为阶梯折线 (HV: 先水平再垂直 / VH: 先垂直再水平)
 */
export function convertLineToStepPath(
  svgText: string,
  targetIndex: number,
  mode: 'hv' | 'vh' = 'hv'
): string {
  const info = getSvgElementInfo(svgText, targetIndex);
  if (!info || info.tagName !== 'line') return svgText;

  const x1 = parseFloat(info.x1 || '0');
  const y1 = parseFloat(info.y1 || '0');
  const x2 = parseFloat(info.x2 || '0');
  const y2 = parseFloat(info.y2 || '0');

  const d = mode === 'hv'
    ? `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;

  let newSvg = svgText;
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const elements = getSvgTargetElements(doc);
      const target = elements[targetIndex];
      if (target && target.tagName.toLowerCase() === 'line') {
        const pathEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        for (let i = 0; i < target.attributes.length; i++) {
          const attr = target.attributes[i];
          if (!['x1', 'y1', 'x2', 'y2'].includes(attr.name)) {
            pathEl.setAttribute(attr.name, attr.value);
          }
        }
        pathEl.setAttribute('d', d);
        if (!pathEl.getAttribute('fill')) pathEl.setAttribute('fill', 'none');
        target.parentElement?.replaceChild(pathEl, target);
        cleanOmniAttributes(doc);
        return prettifySvg(new XMLSerializer().serializeToString(doc));
      }
    } catch {
      // fallback
    }
  }

  // Node.js fallback 替换
  const lineRegex = /<line\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = lineRegex.exec(newSvg)) !== null) {
    if (idx === targetIndex) {
      let attrs = match[1]
        .replace(/\s*(?:x1|y1|x2|y2)=["'][^"']*["']/gi, '')
        .trim();
      if (!/fill=/i.test(attrs)) attrs += ' fill="none"';
      const replacement = `<path d="${d}" ${attrs}>`;
      const before = newSvg.slice(0, match.index);
      const after = newSvg.slice(match.index + match[0].length);
      return prettifySvg(before + replacement + after);
    }
    idx++;
  }

  return svgText;
}

export type LinePresetType =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'dash-dot'
  | 'flow-arrow'
  | 'bidirectional'
  | 'dimension'
  | 'flowing-glow';

/**
 * 一键为线条应用常用工业工程风格预设
 */
export function applyLinePreset(
  svgText: string,
  targetIndex: number,
  preset: LinePresetType
): string {
  let textWithMarkers = svgText;
  if (['flow-arrow', 'bidirectional', 'dimension'].includes(preset)) {
    textWithMarkers = ensureSvgMarkers(svgText);
  }

  const updates: Partial<SvgElementInfo> = {};
  switch (preset) {
    case 'solid':
      updates.strokeDasharray = '';
      updates.strokeLinecap = 'round';
      updates.strokeLinejoin = 'round';
      updates.markerStart = '';
      updates.markerEnd = '';
      break;
    case 'dashed':
      updates.strokeDasharray = '6,4';
      updates.strokeLinecap = 'butt';
      break;
    case 'dotted':
      updates.strokeDasharray = '2,3';
      updates.strokeLinecap = 'round';
      break;
    case 'dash-dot':
      updates.strokeDasharray = '10,4,2,4';
      updates.strokeLinecap = 'round';
      break;
    case 'flow-arrow':
      updates.strokeDasharray = '';
      updates.strokeLinecap = 'round';
      updates.markerEnd = 'url(#omni-arrow-end)';
      break;
    case 'bidirectional':
      updates.strokeDasharray = '';
      updates.strokeLinecap = 'round';
      updates.markerStart = 'url(#omni-arrow-start)';
      updates.markerEnd = 'url(#omni-arrow-end)';
      break;
    case 'dimension':
      updates.strokeDasharray = '';
      updates.strokeLinecap = 'square';
      updates.markerStart = 'url(#omni-dimension-start)';
      updates.markerEnd = 'url(#omni-dimension-end)';
      break;
    case 'flowing-glow':
      updates.strokeDasharray = '8,4';
      updates.strokeLinecap = 'round';
      break;
  }

  return updateSvgElement(textWithMarkers, targetIndex, updates);
}
