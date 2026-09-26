/**
 * SVG 矢量图元与高保真样式固化引擎 (SvgSolidifier)
 * 
 * 核心目标:
 * 1. 彻底解决 Mermaid 图表在复制到剪贴板、导出图片或粘贴到 Word/WPS/Office 时线条和文字丢失的行业顽疾:
 *    - 文字丢失根因: Mermaid 默认使用 <foreignObject> 渲染 HTML 标签，在 Word 或 Canvas 光栅化时因沙箱安全策略被浏览器静默忽略丢弃。
 *      固化方案: 自动将 <foreignObject> 逆向转换为标准原生 SVG <text> 和 <tspan> 标签，中点精准对齐，保留多行排版与高对比度文字颜色。
 *    - 线条丢失根因: Mermaid 连线 (<path class="flowchart-link">) 的 stroke 与 fill 样式仅定义在内部 <style> 作用域内，
 *      Word 的 SVG 解析器不会执行此类 class 选择器，导致线条因缺失呈现属性而变成默认的 stroke="none" (隐形) 或 fill="black" (黑块)。
 *      固化方案: 自动将连线、箭头、路径与形状的 stroke、stroke-width 与 fill="none" 固化写入元素原生的 XML 呈现属性。
 * 2. 箭头与 Marker 完整着色:
 *    - 确保 <marker> 内部的箭头端点具有与连线完全一致的 fill 与 stroke，防止箭头断裂或失色。
 * 3. 运行环境自适应:
 *    - 兼容浏览器 DOM 环境 (精准 DOM 树操作) 与 Node.js / CI 测试环境 (高效正则状态机降级)。
 */

export interface SolidifySvgOptions {
  isDarkTheme?: boolean;
  targetLineColor?: string;
  targetTextColor?: string;
  targetBgColor?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 从 SVG 内容或样式表中提取主题色
 */
function extractColorsFromSvg(svgText: string, options?: SolidifySvgOptions) {
  const isDark = Boolean(options?.isDarkTheme);
  let lineColor = options?.targetLineColor || '';
  let textColor = options?.targetTextColor || '';

  if (!lineColor && isDark) {
    const linkMatch =
      svgText.match(/\.flowchart-link[^{]*\{[^}]*stroke:\s*([^;!}\s]+)/i) ||
      svgText.match(/\.edgePath\s+\.path[^{]*\{[^}]*stroke:\s*([^;!}\s]+)/i) ||
      svgText.match(/stroke:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
    if (linkMatch && !linkMatch[1].includes('var(')) {
      lineColor = linkMatch[1];
    }
  }

  if (!textColor && isDark) {
    const textMatch =
      svgText.match(/\.nodeLabel[^{]*\{[^}]*color:\s*([^;!}\s]+)/i) ||
      svgText.match(/text[^{]*\{[^}]*fill:\s*([^;!}\s]+)/i) ||
      svgText.match(/color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
    if (textMatch && !textMatch[1].includes('var(')) {
      textColor = textMatch[1];
    }
  }

  // 保底高对比度色彩规范 (明暗双色隔离，严禁在亮色底上残留暗色模式的白字)
  if (!lineColor) {
    lineColor = isDark ? '#60a5fa' : '#2563eb';
  }
  if (!textColor) {
    textColor = isDark ? '#f8fafc' : '#0f172a';
  }

  return { lineColor, textColor };
}

/**
 * 针对 DOM SVGElement 执行就地深度图元固化与样式内联 (浏览器环境)
 */
export function solidifySvgElement(svgEl: SVGElement, options?: SolidifySvgOptions): SVGElement {
  if (!svgEl) return svgEl;

  const isDark = Boolean(options?.isDarkTheme);
  const styleEl = svgEl.querySelector('style');
  const styleText = styleEl?.textContent || '';
  const { lineColor, textColor } = extractColorsFromSvg(styleText, options);

  // 1. 深度将所有 <foreignObject> 转换为原生 SVG <text>
  const foreignObjects = Array.from(svgEl.querySelectorAll('foreignObject, foreignobject'));
  for (const fo of foreignObjects) {
    const textDiv = fo.querySelector('div, span, p') || fo;
    const computedColor =
      (typeof window !== 'undefined' && fo.isConnected ? window.getComputedStyle(textDiv).color : '') || '';
    // 若要求亮色模式，严防计算得到暗色的白色文字
    let activeTextColor = textColor;
    if (computedColor && isDark) {
      activeTextColor = computedColor;
    } else if (computedColor && !isDark && !computedColor.includes('255, 255, 255') && !computedColor.includes('248, 250, 252')) {
      activeTextColor = computedColor;
    }

    const rawHtml = fo.innerHTML || textDiv.innerHTML || '';
    const plainText = rawHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const lines = plainText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      fo.remove();
      continue;
    }

    const w = parseFloat(fo.getAttribute('width') || '0');
    const h = parseFloat(fo.getAttribute('height') || '0');
    const x = parseFloat(fo.getAttribute('x') || '0');
    const y = parseFloat(fo.getAttribute('y') || '0');

    const cx = x + (w > 0 ? w / 2 : 0);
    const cy = y + (h > 0 ? h / 2 : 0);

    const doc = fo.ownerDocument || document;
    const textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(cx));
    textEl.setAttribute('y', String(cy));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('fill', activeTextColor);
    textEl.setAttribute(
      'style',
      `fill: ${activeTextColor} !important; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 500;`
    );
    textEl.setAttribute(
      'font-family',
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    );
    textEl.setAttribute('font-size', '13px');
    textEl.setAttribute('font-weight', '500');

    if (lines.length === 1) {
      textEl.textContent = lines[0];
    } else {
      const fontSizeNum = 13;
      const lineHeight = fontSizeNum * 1.25;
      const totalHeight = (lines.length - 1) * lineHeight;
      const startY = cy - totalHeight / 2;

      lines.forEach((line, idx) => {
        const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', String(cx));
        tspan.setAttribute('y', String(startY + idx * lineHeight));
        tspan.setAttribute('text-anchor', 'middle');
        tspan.setAttribute('dominant-baseline', 'central');
        tspan.setAttribute('fill', activeTextColor);
        tspan.setAttribute('style', `fill: ${activeTextColor} !important;`);
        tspan.textContent = line;
        textEl.appendChild(tspan);
      });
    }

    fo.parentNode?.replaceChild(textEl, fo);
  }

  // 2. 深度固化箭头与标记 (<marker>) 内部子元素 (必须优先于 paths 处理以防 marker 内部被置 fill="none")
  const markers = Array.from(svgEl.querySelectorAll('marker'));
  for (const marker of markers) {
    const markerChildren = marker.querySelectorAll('path, polygon, circle');
    markerChildren.forEach((child) => {
      child.setAttribute('fill', lineColor);
      child.setAttribute('stroke', lineColor);
      if (child instanceof SVGElement) {
        child.style.setProperty('fill', lineColor, 'important');
        child.style.setProperty('stroke', lineColor, 'important');
      }
    });
  }

  // 3. 深度固化连线与路径样式 (.flowchart-link, .edgePath, path, line 等)
  const allPaths = Array.from(svgEl.querySelectorAll('path, line, polyline'));
  for (const path of allPaths) {
    // 排除 marker 内部图形 (箭头端点保持高保真实心填充)
    if (path.closest('marker')) {
      continue;
    }

    const cls = (path.getAttribute('class') || '').toLowerCase();
    const isEdgeOrLink =
      cls.includes('link') ||
      cls.includes('edge') ||
      cls.includes('path') ||
      cls.includes('transition') ||
      cls.includes('messageline') ||
      cls.includes('actor-line') ||
      cls.includes('relation') ||
      path.tagName.toLowerCase() === 'line' ||
      Boolean(path.closest('g.edgePaths, g.edgePath, g.edge-paths, g.edges, g.links'));

    if (isEdgeOrLink) {
      const existingStroke = path.getAttribute('stroke');
      const strokeVal =
        !existingStroke || existingStroke === 'none' || (!isDark && (existingStroke === '#60a5fa' || existingStroke === '#38bdf8'))
          ? lineColor
          : existingStroke;
      path.setAttribute('stroke', strokeVal);
      const strokeWidth = path.getAttribute('stroke-width') || '2';
      path.setAttribute('stroke-width', strokeWidth);
      // 关键：连线必须是 fill="none"，防止 Word 将其当作黑色闭合多边形填充
      path.setAttribute('fill', 'none');
      if (path instanceof SVGElement) {
        path.style.setProperty('stroke', strokeVal, 'important');
        path.style.setProperty('stroke-width', `${strokeWidth}px`, 'important');
        path.style.setProperty('fill', 'none', 'important');
      }
    }
  }

  // 4. 固化节点容器图形边框与填充 (.node, rect, circle, polygon 等)
  const nodeContainers = Array.from(
    svgEl.querySelectorAll('g.node, g.cluster, .statediagram-state, g.actor, g.classGroup')
  );
  for (const nodeG of nodeContainers) {
    const shapes = nodeG.querySelectorAll('rect, circle, polygon, ellipse, path.basic');
    shapes.forEach((shape) => {
      const existingStroke = shape.getAttribute('stroke');
      const strokeColor =
        !isDark && (existingStroke === '#38bdf8' || existingStroke === '#60a5fa')
          ? lineColor
          : existingStroke || lineColor;
      shape.setAttribute('stroke', strokeColor);
      const strokeWidth = shape.getAttribute('stroke-width') || '1.5';
      shape.setAttribute('stroke-width', strokeWidth);

      const defaultFill = isDark ? '#111827' : '#f8fafc';
      const existingFill = shape.getAttribute('fill');
      const shapeFill =
        !isDark && (existingFill === '#111827' || existingFill === '#0f172a')
          ? defaultFill
          : existingFill || defaultFill;
      shape.setAttribute('fill', shapeFill);

      if (shape instanceof SVGElement) {
        shape.style.setProperty('stroke', strokeColor, 'important');
        shape.style.setProperty('stroke-width', `${strokeWidth}px`, 'important');
        shape.style.setProperty('fill', shapeFill, 'important');
      }
    });
  }

  // 5. 确保原生 <text> / <tspan> 均有清晰的前景呈现属性与高优先级样式
  const allTexts = Array.from(svgEl.querySelectorAll('text, tspan'));
  for (const txt of allTexts) {
    const curFill = txt.getAttribute('fill');
    const effectiveFill =
      !isDark && (curFill === '#f8fafc' || curFill === '#f1f5f9' || curFill === '#ffffff' || curFill === 'white')
        ? textColor
        : curFill || textColor;
    txt.setAttribute('fill', effectiveFill);
    if (txt instanceof SVGElement) {
      txt.style.setProperty('fill', effectiveFill, 'important');
      txt.style.setProperty('color', effectiveFill, 'important');
    }
    if (!txt.getAttribute('font-family')) {
      txt.setAttribute(
        'font-family',
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      );
    }
    if (!txt.getAttribute('font-size')) {
      txt.setAttribute('font-size', '13px');
    }
  }

  // 6. 覆写内部 <style> 规则，防止样式表层级的深色模式反向覆盖呈现属性
  if (styleEl && !isDark) {
    let css = styleEl.textContent || '';
    css = css.replace(/#f8fafc|#f1f5f9/gi, textColor);
    css += `\n.flowchart-link, .edgePath .path { stroke: ${lineColor} !important; fill: none !important; }\n`;
    css += `.arrowMarkerPath { fill: ${lineColor} !important; stroke: ${lineColor} !important; }\n`;
    css += `text, tspan, .nodeLabel, .edgeLabel { fill: ${textColor} !important; color: ${textColor} !important; }\n`;
    styleEl.textContent = css;
  }

  // 7. 补全标准根属性与命名空间
  if (!svgEl.getAttribute('xmlns')) {
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!svgEl.getAttribute('xmlns:xlink')) {
    svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  return svgEl;
}

/**
 * 针对 SVG 字符串执行深度图元固化与样式内联 (双模：优先 DOMParser，无 DOM 时高可靠正则替换)
 */
export function solidifySvgString(svgText: string, options?: SolidifySvgOptions): string {
  if (!svgText || typeof svgText !== 'string') return '';
  const trimmed = svgText.trim();
  if (!trimmed) return '';

  // 1. 若运行于浏览器或具备 DOMParser，走原生 DOM 树处理保证 100% 结构准确
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        solidifySvgElement(svgEl, options);
        return new XMLSerializer().serializeToString(svgEl);
      }
    } catch {
      // 容错降级走正则引擎
    }
  }

  // 2. 正则引擎保底替换 (Node.js、无头测试环境或非合规 XML 片段)
  const { lineColor, textColor } = extractColorsFromSvg(trimmed, options);
  let result = trimmed;

  // 2.1 将 <foreignObject> 替换为标准原生 <text> 标签
  result = result.replace(
    /<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/gi,
    (match, attrs, content) => {
      const wMatch = attrs.match(/\bwidth="([^"]+)"/i);
      const hMatch = attrs.match(/\bheight="([^"]+)"/i);
      const xMatch = attrs.match(/\bx="([^"]+)"/i);
      const yMatch = attrs.match(/\by="([^"]+)"/i);

      const w = parseFloat(wMatch ? wMatch[1] : '0');
      const h = parseFloat(hMatch ? hMatch[1] : '0');
      const x = parseFloat(xMatch ? xMatch[1] : '0');
      const y = parseFloat(yMatch ? yMatch[1] : '0');

      const cx = x + (w > 0 ? w / 2 : 0);
      const cy = y + (h > 0 ? h / 2 : 0);

      const plainText = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

      const lines = plainText
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) return '';

      if (lines.length === 1) {
        return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13px" font-weight="500">${escapeXml(lines[0])}</text>`;
      }

      const fontSizeNum = 13;
      const lineHeight = fontSizeNum * 1.25;
      const totalHeight = (lines.length - 1) * lineHeight;
      const startY = cy - totalHeight / 2;

      const tspans = lines
        .map(
          (line: string, idx: number) =>
            `<tspan x="${cx}" y="${startY + idx * lineHeight}" dominant-baseline="central">${escapeXml(line)}</tspan>`
        )
        .join('');

      return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13px" font-weight="500">${tspans}</text>`;
    }
  );

  // 2.2 固化连线路径呈现属性 (stroke, stroke-width, fill="none")
  result = result.replace(/<path\b([^>]*)>/gi, (match, attrs) => {
    // 排除箭头 Marker 内部图形
    if (/arrowMarkerPath/i.test(attrs)) return match;

    const isEdgeOrLink =
      /class="[^"]*(?:link|edge|path|transition|messageline|relation)[^"]*"/i.test(attrs) ||
      /\bid="L-[^"]*"/i.test(attrs);

    if (!isEdgeOrLink) return match;

    let newAttrs = attrs;
    if (!/\bstroke=/i.test(newAttrs)) {
      newAttrs += ` stroke="${lineColor}"`;
    }
    if (!/\bstroke-width=/i.test(newAttrs)) {
      newAttrs += ' stroke-width="2"';
    }
    if (!/\bfill=/i.test(newAttrs)) {
      newAttrs += ' fill="none"';
    } else {
      newAttrs = newAttrs.replace(/\bfill="[^"]*"/i, 'fill="none"');
    }
    return `<path${newAttrs}>`;
  });

  // 2.3 固化直线标签呈现属性 (<line>)
  result = result.replace(/<line\b([^>]*)>/gi, (match, attrs) => {
    let newAttrs = attrs;
    if (!/\bstroke=/i.test(newAttrs)) {
      newAttrs += ` stroke="${lineColor}"`;
    }
    if (!/\bstroke-width=/i.test(newAttrs)) {
      newAttrs += ' stroke-width="2"';
    }
    return `<line${newAttrs}>`;
  });

  // 2.4 固化箭头标记 (<marker>) 内部子元素
  result = result.replace(/<marker\b([^>]*)>([\s\S]*?)<\/marker>/gi, (match, mAttrs, mBody) => {
    const solidBody = mBody.replace(/<(path|polygon|circle)\b([^>]*)>/gi, (mSub, tag, sAttrs) => {
      let updated = sAttrs;
      if (!/\bfill=/i.test(updated) || /\bfill="none"/i.test(updated)) {
        updated = updated.replace(/\bfill="none"/i, '') + ` fill="${lineColor}"`;
      }
      if (!/\bstroke=/i.test(updated) || /\bstroke="none"/i.test(updated)) {
        updated = updated.replace(/\bstroke="none"/i, '') + ` stroke="${lineColor}"`;
      }
      return `<${tag}${updated}>`;
    });
    return `<marker${mAttrs}>${solidBody}</marker>`;
  });

  // 2.5 确保根 svg 包含命名空间
  result = result.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
    let updated = attrs;
    if (!/xmlns=/i.test(updated)) {
      updated += ' xmlns="http://www.w3.org/2000/svg"';
    }
    if (!/xmlns:xlink=/i.test(updated)) {
      updated += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
    }
    return `<svg${updated}>`;
  });

  return result;
}
