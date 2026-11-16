/**
 * OmniView PPTX OOXML 轻量纯 TS XML AST 解析器与色彩/几何矩阵工具
 * 零 DOMParser / Node 环境依赖，同时兼容浏览器、Web Worker 与 Node.js 测试环境
 */

export interface XmlNode {
  tag: string;
  localName: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const XML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

export function decodeXmlEntities(input: string): string {
  if (!input || !input.includes('&')) return input;
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return XML_ENTITY_MAP[entity] ?? full;
  });
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrStr) return attrs;
  const attrRegex = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(attrStr)) !== null) {
    const fullName = m[1];
    const val = decodeXmlEntities(m[2] ?? m[3] ?? '');
    attrs[fullName] = val;
    const colonIdx = fullName.indexOf(':');
    if (colonIdx !== -1) {
      const localAttr = fullName.slice(colonIdx + 1);
      if (!(localAttr in attrs)) {
        attrs[localAttr] = val;
      }
    }
  }
  return attrs;
}

/**
 * 将 XML 字符串解析为规范嵌套 AST，精准处理嵌套标签、自闭合标签、CDATA 与注释
 */
export function parseXmlTree(xml: string): XmlNode {
  const root: XmlNode = { tag: '#root', localName: '#root', attrs: {}, children: [], text: '' };
  if (!xml) return root;

  const stack: XmlNode[] = [root];
  const len = xml.length;
  let pos = 0;

  while (pos < len) {
    const lt = xml.indexOf('<', pos);
    if (lt === -1) {
      const trailing = decodeXmlEntities(xml.slice(pos));
      if (trailing) stack[stack.length - 1].text += trailing;
      break;
    }

    if (lt > pos) {
      const textChunk = decodeXmlEntities(xml.slice(pos, lt));
      if (textChunk) {
        stack[stack.length - 1].text += textChunk;
      }
    }

    // XML 注释 <!-- ... -->
    if (xml.startsWith('<!--', lt)) {
      const endComment = xml.indexOf('-->', lt + 4);
      pos = endComment === -1 ? len : endComment + 3;
      continue;
    }

    // Processing instruction <? ... ?>
    if (xml.startsWith('<?', lt)) {
      const endPi = xml.indexOf('?>', lt + 2);
      pos = endPi === -1 ? len : endPi + 2;
      continue;
    }

    // CDATA <![CDATA[ ... ]]>
    if (xml.startsWith('<![CDATA[', lt)) {
      const endCdata = xml.indexOf(']]>', lt + 9);
      if (endCdata === -1) {
        stack[stack.length - 1].text += xml.slice(lt + 9);
        break;
      }
      stack[stack.length - 1].text += xml.slice(lt + 9, endCdata);
      pos = endCdata + 3;
      continue;
    }

    // DOCTYPE / <! ... >
    if (xml.startsWith('<!', lt)) {
      const endDecl = xml.indexOf('>', lt + 2);
      pos = endDecl === -1 ? len : endDecl + 1;
      continue;
    }

    // 查找标签结束 '>'（忽略引号内部 '>'）
    let gt = -1;
    let quoteChar = '';
    for (let i = lt + 1; i < len; i++) {
      const ch = xml[i];
      if (quoteChar) {
        if (ch === quoteChar) quoteChar = '';
      } else if (ch === '"' || ch === "'") {
        quoteChar = ch;
      } else if (ch === '>') {
        gt = i;
        break;
      }
    }

    if (gt === -1) break;

    const rawTag = xml.slice(lt + 1, gt).trim();
    pos = gt + 1;
    if (!rawTag) continue;

    // 闭合标签 </tag>
    if (rawTag.startsWith('/')) {
      const closeTag = rawTag.slice(1).trim();
      const closeLocal = closeTag.includes(':') ? closeTag.split(':')[1] : closeTag;
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === closeTag || stack[i].localName === closeLocal) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const selfClosing = rawTag.endsWith('/');
    const tagBody = selfClosing ? rawTag.slice(0, -1).trim() : rawTag;
    const spaceMatch = tagBody.match(/^([^\s/]+)([\s\S]*)$/);
    if (!spaceMatch) continue;

    const tagName = spaceMatch[1];
    const attrPart = spaceMatch[2] || '';
    const colonIdx = tagName.indexOf(':');
    const localName = colonIdx === -1 ? tagName : tagName.slice(colonIdx + 1);

    const node: XmlNode = {
      tag: tagName,
      localName,
      attrs: parseAttributes(attrPart),
      children: [],
      text: '',
    };

    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
  }

  return root;
}

export function findChild(node: XmlNode | undefined, localName: string): XmlNode | undefined {
  if (!node) return undefined;
  return node.children.find(c => c.localName === localName);
}

export function findChildren(node: XmlNode | undefined, localName: string): XmlNode[] {
  if (!node) return [];
  return node.children.filter(c => c.localName === localName);
}

export function findDescendant(node: XmlNode | undefined, localName: string): XmlNode | undefined {
  if (!node) return undefined;
  for (const child of node.children) {
    if (child.localName === localName) return child;
    const found = findDescendant(child, localName);
    if (found) return found;
  }
  return undefined;
}

export function findDescendants(node: XmlNode | undefined, localName: string): XmlNode[] {
  const results: XmlNode[] = [];
  if (!node) return results;
  const walk = (curr: XmlNode) => {
    for (const child of curr.children) {
      if (child.localName === localName) {
        results.push(child);
      }
      walk(child);
    }
  };
  walk(node);
  return results;
}

export function collectNodeText(node: XmlNode | undefined): string {
  if (!node) return '';
  let out = node.text || '';
  for (const child of node.children) {
    out += collectNodeText(child);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Office 预设颜色 & OOXML 色彩运算 (tint / shade / lumMod / lumOff / alpha)
// ---------------------------------------------------------------------------

const PRESET_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  dkGray: '#a9a9a9',
  ltGray: '#d3d3d3',
  orange: '#ffa500',
  purple: '#800080',
  navy: '#000080',
  teal: '#008080',
  silver: '#c0c0c0',
  maroon: '#800000',
};

const SYS_COLOR_FALLBACKS: Record<string, string> = {
  windowtext: '#0F172A',
  window: '#FFFFFF',
  highlight: '#3B82F6',
  highlighttext: '#FFFFFF',
  graytext: '#64748B',
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (!Number.isFinite(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

function parseColorModifierVal(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed > 100 ? parsed / 100000 : parsed / 100;
}

/**
 * 从 OOXML 颜色节点 (<a:solidFill>, <a:gs>, <a:buClr> 等内部) 提取带修饰符的精确 CSS 颜色
 */
export function resolveColorFromNode(
  containerNode: XmlNode | undefined,
  themeColors: Record<string, string>,
  colorMap?: Record<string, string>
): string | undefined {
  if (!containerNode) return undefined;

  let baseHex: string | undefined;
  let clrNode: XmlNode | undefined;

  const srgb = findChild(containerNode, 'srgbClr') || (containerNode.localName === 'srgbClr' ? containerNode : undefined);
  const scheme = findChild(containerNode, 'schemeClr') || (containerNode.localName === 'schemeClr' ? containerNode : undefined);
  const sys = findChild(containerNode, 'sysClr') || (containerNode.localName === 'sysClr' ? containerNode : undefined);
  const prst = findChild(containerNode, 'prstClr') || (containerNode.localName === 'prstClr' ? containerNode : undefined);

  if (srgb?.attrs.val) {
    baseHex = `#${srgb.attrs.val.replace('#', '')}`;
    clrNode = srgb;
  } else if (scheme?.attrs.val) {
    const rawKey = scheme.attrs.val;
    const mappedKey = colorMap?.[rawKey] || colorMap?.[rawKey.toLowerCase()] || rawKey;
    baseHex = themeColors[mappedKey] || themeColors[mappedKey.toLowerCase()] || themeColors[rawKey.toLowerCase()];
    clrNode = scheme;
  } else if (sys?.attrs.lastClr || sys?.attrs.val) {
    baseHex = sys.attrs.lastClr
      ? `#${sys.attrs.lastClr.replace('#', '')}`
      : SYS_COLOR_FALLBACKS[(sys.attrs.val || '').toLowerCase()];
    clrNode = sys;
  } else if (prst?.attrs.val) {
    baseHex = PRESET_COLORS[prst.attrs.val] || PRESET_COLORS[prst.attrs.val.toLowerCase()];
    clrNode = prst;
  }

  if (!baseHex) return undefined;
  let [r, g, b] = hexToRgb(baseHex);
  let alpha = 1;

  if (clrNode && clrNode.children.length > 0) {
    for (const mod of clrNode.children) {
      const val = parseColorModifierVal(mod.attrs.val);
      if (val === undefined) continue;
      if (mod.localName === 'tint') {
        r = r * val + 255 * (1 - val);
        g = g * val + 255 * (1 - val);
        b = b * val + 255 * (1 - val);
      } else if (mod.localName === 'shade') {
        r = r * val;
        g = g * val;
        b = b * val;
      } else if (mod.localName === 'lumMod') {
        const [h, s, l] = rgbToHsl(r, g, b);
        [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, l * val)));
      } else if (mod.localName === 'lumOff') {
        const [h, s, l] = rgbToHsl(r, g, b);
        [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, l + val)));
      } else if (mod.localName === 'satMod') {
        const [h, s, l] = rgbToHsl(r, g, b);
        [r, g, b] = hslToRgb(h, Math.max(0, Math.min(1, s * val)), l);
      } else if (mod.localName === 'alpha') {
        alpha = Math.max(0, Math.min(1, val));
      }
    }
  }

  if (alpha < 0.999) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(alpha.toFixed(3))})`;
  }
  return rgbToHex(r, g, b);
}

/**
 * 解析渐变填充 (<a:gradFill>) 生成 CSS 渐变字符串
 */
export function resolveGradientCss(
  gradNode: XmlNode | undefined,
  themeColors: Record<string, string>,
  colorMap?: Record<string, string>
): string | undefined {
  if (!gradNode) return undefined;
  const gsLst = findChild(gradNode, 'gsLst');
  if (!gsLst) return undefined;
  const stops = findChildren(gsLst, 'gs')
    .map(gs => {
      const posRaw = parseInt(gs.attrs.pos || '0', 10);
      const pct = Math.max(0, Math.min(100, Math.round(posRaw / 1000)));
      const color = resolveColorFromNode(gs, themeColors, colorMap);
      return color ? { pct, color } : null;
    })
    .filter((s): s is { pct: number; color: string } => s !== null)
    .sort((a, b) => a.pct - b.pct);

  if (stops.length < 2) return stops[0]?.color;

  const stopStr = stops.map(s => `${s.color} ${s.pct}%`).join(', ');
  const pathNode = findChild(gradNode, 'path');
  if (pathNode) {
    return `radial-gradient(circle, ${stopStr})`;
  }

  const linNode = findChild(gradNode, 'lin');
  let cssDeg = 180;
  if (linNode?.attrs.ang) {
    const ooxmlDeg = parseInt(linNode.attrs.ang, 10) / 60000;
    cssDeg = Math.round((ooxmlDeg + 90) % 360);
  }
  return `linear-gradient(${cssDeg}deg, ${stopStr})`;
}
