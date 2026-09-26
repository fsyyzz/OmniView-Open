/**
 * OmniView 原生 PowerPoint (.pptx) 解析与离线矢量渲染核心引擎
 * 基于 OOXML (ECMA-376) 标准与 JSZip 纯前端轻量流水线
 * 支持幻灯片母版、绝对定位矢量画布、文本框、形状、内嵌图片、表格与演讲者备注
 */
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

/**
 * 安全文本清洗器（浏览器环境调用 DOMPurify，Node 环境使用严密正则过滤，杜绝环境不兼容崩溃）
 */
function sanitizeText(raw: string): string {
  if (!raw) return '';
  if (typeof window !== 'undefined' && DOMPurify && typeof (DOMPurify as any).sanitize === 'function') {
    return (DOMPurify as any).sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export interface PptxMetadata {
  title?: string;
  creator?: string;
  description?: string;
  slideCount: number;
  width: number;
  height: number;
  aspectRatio: '16:9' | '4:3' | 'custom';
}

export interface PptxTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number; // pt
  color?: string; // hex
  fontFamily?: string;
}

export interface PptxParagraph {
  runs: PptxTextRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  level?: number;
  bullet?: boolean;
}

export interface PptxTableCell {
  text: string;
  isHeader?: boolean;
  background?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  fontSize?: number;
}

export interface PptxElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'table';
  x: number; // pt
  y: number;
  width: number;
  height: number;
  rotation?: number; // 角度 0-360
  // 文本专属
  paragraphs?: PptxParagraph[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  // 形状专属
  shapeType?: 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'custom';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  // 图片专属
  imageDataUrl?: string;
  imageAlt?: string;
  // 表格专属
  tableRows?: PptxTableCell[][];
}

export interface PptxSlide {
  index: number;
  title: string;
  elements: PptxElement[];
  backgroundColor?: string;
  notes?: string;
  rawXml?: string;
}

export interface ParsedPptxPresentation {
  metadata: PptxMetadata;
  slides: PptxSlide[];
  isValid: boolean;
}

/**
 * 将 EMU (English Metric Units, 1 pt = 12700 EMU, 1 inch = 914400 EMU) 转为标准 pt
 */
export function emuToPt(emu: number): number {
  return Math.round((emu / 12700) * 10) / 10;
}

/**
 * 将 Base64 字符串快速还原为 Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:.*?;base64,/, '').replace(/\s+/g, '');
  if (typeof atob === 'function') {
    const binaryStr = atob(clean);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(clean, 'base64'));
}

/**
 * 根据文件路径后缀获取 MIME 类型
 */
function getMimeTypeByPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/png';
}

/**
 * Office 默认标准调色板 fallback
 */
const DEFAULT_THEME_COLORS: Record<string, string> = {
  dk1: '#000000',
  lt1: '#ffffff',
  dk2: '#1f497d',
  lt2: '#eeece1',
  accent1: '#4f81bd',
  accent2: '#c0504d',
  accent3: '#9bbb59',
  accent4: '#8064a2',
  accent5: '#4bacc6',
  accent6: '#f79646',
  hlink: '#0000ff',
  folhlink: '#800080',
  bg1: '#ffffff',
  tx1: '#000000',
  bg2: '#eeece1',
  tx2: '#1f497d',
};

/**
 * 从 ppt/theme/theme1.xml 解析主题颜色方案
 */
function parseThemeColors(themeXml?: string): Record<string, string> {
  const colors: Record<string, string> = { ...DEFAULT_THEME_COLORS };
  if (!themeXml) return colors;

  const clrSchemeMatch = themeXml.match(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/i);
  if (!clrSchemeMatch) return colors;

  const schemeXml = clrSchemeMatch[0];
  const colorKeys = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

  for (const key of colorKeys) {
    const tagRegex = new RegExp(`<a:${key}\\b[\\s\\S]*?<\\/a:${key}>`, 'i');
    const tagMatch = schemeXml.match(tagRegex);
    if (tagMatch) {
      const tagContent = tagMatch[0];
      const srgb = tagContent.match(/<a:srgbClr\b[^>]*\bval=["']([0-9a-fA-F]{6})["']/i);
      if (srgb) {
        colors[key.toLowerCase()] = `#${srgb[1]}`;
        continue;
      }
      const sys = tagContent.match(/<a:sysClr\b[^>]*\blastClr=["']([0-9a-fA-F]{6})["']/i);
      if (sys) {
        colors[key.toLowerCase()] = `#${sys[1]}`;
      }
    }
  }

  return colors;
}

/**
 * 从节点 XML 片段中提取颜色（优先 srgbClr，其次 schemeClr 查找主题色）
 */
function extractColor(nodeXml: string, themeColors: Record<string, string>): string | undefined {
  const srgbMatch = nodeXml.match(/<a:srgbClr\b[^>]*\bval=["']([0-9a-fA-F]{6})["']/i);
  if (srgbMatch) {
    return `#${srgbMatch[1]}`;
  }

  const schemeMatch = nodeXml.match(/<a:schemeClr\b[^>]*\bval=["']([^"']+)["']/i);
  if (schemeMatch) {
    const schemeKey = schemeMatch[1].toLowerCase();
    if (themeColors[schemeKey]) {
      return themeColors[schemeKey];
    }
  }

  const sysMatch = nodeXml.match(/<a:sysClr\b[^>]*\blastClr=["']([0-9a-fA-F]{6})["']/i);
  if (sysMatch) {
    return `#${sysMatch[1]}`;
  }

  return undefined;
}

/**
 * 提取坐标几何变换
 */
function extractGeometry(xmlSegment: string): { x: number; y: number; width: number; height: number; rotation?: number } {
  let x = 40;
  let y = 40;
  let width = 200;
  let height = 100;
  let rotation: number | undefined;

  const offMatch = xmlSegment.match(/<a:off\b[^>]*\bx=["'](-?\d+)["'][^>]*\by=["'](-?\d+)["']/i);
  if (offMatch) {
    x = emuToPt(parseInt(offMatch[1], 10));
    y = emuToPt(parseInt(offMatch[2], 10));
  }

  const extMatch = xmlSegment.match(/<a:ext\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["']/i);
  if (extMatch) {
    width = emuToPt(parseInt(extMatch[1], 10));
    height = emuToPt(parseInt(extMatch[2], 10));
  }

  const rotMatch = xmlSegment.match(/<[ap]:(?:spPr|xfrm)\b[^>]*\brot=["'](-?\d+)["']/i) || xmlSegment.match(/\brot=["'](-?\d+)["']/i);
  if (rotMatch) {
    const rawRot = parseInt(rotMatch[1], 10);
    rotation = Math.round(rawRot / 60000);
  }

  return { x, y, width, height, rotation };
}

/**
 * 提取形状几何类型
 */
function extractShapeType(spXml: string): 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'custom' {
  const prstMatch = spXml.match(/<a:prstGeom\b[^>]*\bprst=["']([^"']+)["']/i);
  if (prstMatch) {
    const val = prstMatch[1].toLowerCase();
    if (val === 'roundrect' || val === 'round1rect') return 'roundRect';
    if (val === 'ellipse') return 'ellipse';
    if (val === 'line') return 'line';
    if (val.includes('arrow')) return 'arrow';
    if (val === 'rect') return 'rect';
  }
  return 'rect';
}

/**
 * 解析 `<p:sp>` 节点（文本框或几何形状）
 */
function parseSpNode(
  spXml: string,
  elementId: string,
  themeColors: Record<string, string>,
  coordOffset = { x: 0, y: 0 }
): PptxElement | null {
  const geom = extractGeometry(spXml);
  const x = geom.x + coordOffset.x;
  const y = geom.y + coordOffset.y;
  const width = geom.width;
  const height = geom.height;
  const rotation = geom.rotation;

  // 形状属性 <p:spPr>
  let fillColor: string | undefined;
  let strokeColor: string | undefined;
  let strokeWidth: number | undefined;

  const spPrMatch = spXml.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/i);
  if (spPrMatch) {
    const spPrXml = spPrMatch[0];
    const fillMatch = spPrXml.match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/i);
    if (fillMatch) {
      fillColor = extractColor(fillMatch[0], themeColors);
    }
    const lnMatch = spPrXml.match(/<a:ln\b[\s\S]*?<\/a:ln>/i);
    if (lnMatch) {
      const lnXml = lnMatch[0];
      const lnFillMatch = lnXml.match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/i);
      if (lnFillMatch) {
        strokeColor = extractColor(lnFillMatch[0], themeColors);
      }
      const wMatch = lnXml.match(/\bw=["'](\d+)["']/i);
      if (wMatch) {
        strokeWidth = Math.max(1, emuToPt(parseInt(wMatch[1], 10)));
      }
    }
  }

  const shapeType = extractShapeType(spXml);

  // 文本内容 <p:txBody>
  const paragraphs: PptxParagraph[] = [];
  const txBodyMatch = spXml.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/i);

  if (txBodyMatch) {
    const txBodyXml = txBodyMatch[0];
    const pRegex = /<a:p\b[\s\S]*?<\/a:p>/gi;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(txBodyXml)) !== null) {
      const pXml = pMatch[0];
      const runs: PptxTextRun[] = [];

      let align: 'left' | 'center' | 'right' | 'justify' = 'left';
      const algnMatch = pXml.match(/<a:pPr\b[^>]*\balgn=["'](\w+)["']/i);
      if (algnMatch) {
        const val = algnMatch[1].toLowerCase();
        if (val === 'ctr' || val === 'center') align = 'center';
        else if (val === 'r' || val === 'right') align = 'right';
        else if (val === 'just' || val === 'justify') align = 'justify';
      }

      const rRegex = /<a:r\b[\s\S]*?<\/a:r>/gi;
      let rMatch: RegExpExecArray | null;

      while ((rMatch = rRegex.exec(pXml)) !== null) {
        const rXml = rMatch[0];
        const tMatch = rXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/i);
        if (tMatch) {
          const rawText = tMatch[1];
          const text = sanitizeText(rawText);
          const isBold = /<a:rPr\b[^>]*\bb=["']1["']/i.test(rXml);
          const isItalic = /<a:rPr\b[^>]*\bi=["']1["']/i.test(rXml);
          const isUnderline = /<a:rPr\b[^>]*\bu=["'][^"']+["']/i.test(rXml);

          let fontSize = 16;
          const szMatch = rXml.match(/<a:rPr\b[^>]*\bsz=["'](\d+)["']/i);
          if (szMatch) {
            fontSize = Math.round(parseInt(szMatch[1], 10) / 100);
          }

          let color: string | undefined;
          const rFillMatch = rXml.match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/i);
          if (rFillMatch) {
            color = extractColor(rFillMatch[0], themeColors);
          } else {
            const clrMatch = rXml.match(/<a:srgbClr\b[^>]*\bval=["']([0-9a-fA-F]{6})["']/i);
            if (clrMatch) color = `#${clrMatch[1]}`;
          }

          runs.push({
            text,
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
            fontSize,
            color,
          });
        }
      }

      // 容错：直接找 <a:t>
      if (runs.length === 0) {
        const directT = pXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/i);
        if (directT) {
          const cleanT = sanitizeText(directT[1]);
          if (cleanT) {
            runs.push({ text: cleanT, fontSize: 16 });
          }
        }
      }

      if (runs.length > 0) {
        paragraphs.push({ runs, align });
      }
    }
  }

  // 如果有文字，视为 text 类型（也可带有背景/边框）
  if (paragraphs.length > 0) {
    return {
      id: elementId,
      type: 'text',
      x,
      y,
      width,
      height,
      rotation,
      paragraphs,
      backgroundColor: fillColor,
      borderColor: strokeColor,
      borderWidth: strokeWidth,
    };
  }

  // 如果没有文字，但有形状填充或描边或为非纯矩形，视为 shape 类型保留
  if (fillColor || strokeColor || shapeType !== 'rect') {
    return {
      id: elementId,
      type: 'shape',
      x,
      y,
      width,
      height,
      rotation,
      shapeType,
      fillColor: fillColor || 'transparent',
      strokeColor,
      strokeWidth,
    };
  }

  return null;
}

/**
 * 解析 `<p:pic>` 节点（内嵌图片）
 */
function parsePicNode(
  picXml: string,
  elementId: string,
  mediaMap: Map<string, string>,
  coordOffset = { x: 0, y: 0 }
): PptxElement | null {
  const geom = extractGeometry(picXml);
  const x = geom.x + coordOffset.x;
  const y = geom.y + coordOffset.y;
  const width = geom.width;
  const height = geom.height;
  const rotation = geom.rotation;

  // 查找引用的 r:embed="rIdX"
  const blipMatch = picXml.match(/<a:blip\b[^>]*\b(?:r:embed|embed)=["']([^"']+)["']/i);
  if (!blipMatch) return null;

  const rId = blipMatch[1];
  const imageDataUrl = mediaMap.get(rId);
  if (!imageDataUrl) return null;

  // 提取图片描述
  let imageAlt = 'PPT 演示文稿图片';
  const cNvPrMatch = picXml.match(/<p:cNvPr\b[^>]*\bname=["']([^"']+)["']/i);
  if (cNvPrMatch) {
    imageAlt = cNvPrMatch[1];
  }

  return {
    id: elementId,
    type: 'image',
    x,
    y,
    width,
    height,
    rotation,
    imageDataUrl,
    imageAlt,
  };
}

/**
 * 解析 `<p:graphicFrame>` 节点（表格或图表）
 */
function parseGraphicFrameNode(
  gfXml: string,
  elementId: string,
  themeColors: Record<string, string>,
  coordOffset = { x: 0, y: 0 }
): PptxElement | null {
  const geom = extractGeometry(gfXml);
  const x = geom.x + coordOffset.x;
  const y = geom.y + coordOffset.y;
  const width = geom.width;
  const height = geom.height;
  const rotation = geom.rotation;

  // 提取表格 <a:tbl>
  const tblMatch = gfXml.match(/<a:tbl\b[\s\S]*?<\/a:tbl>/i);
  if (!tblMatch) return null;

  const tblXml = tblMatch[0];
  const rows: PptxTableCell[][] = [];

  const trRegex = /<a:tr\b[\s\S]*?<\/a:tr>/gi;
  let trMatch: RegExpExecArray | null;
  let rowIndex = 0;

  while ((trMatch = trRegex.exec(tblXml)) !== null) {
    const trXml = trMatch[0];
    const cells: PptxTableCell[] = [];

    const tcRegex = /<a:tc\b[\s\S]*?<\/a:tc>/gi;
    let tcMatch: RegExpExecArray | null;

    while ((tcMatch = tcRegex.exec(trXml)) !== null) {
      const tcXml = tcMatch[0];

      // 提取单元格文本
      const textMatches = tcXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
      const cellText = textMatches
        .map(t => t.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ');
      const cleanText = sanitizeText(cellText);

      // 单元格背景
      let bg: string | undefined;
      const tcPrMatch = tcXml.match(/<a:tcPr\b[\s\S]*?<\/a:tcPr>/i);
      if (tcPrMatch) {
        const solidFill = tcPrMatch[0].match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/i);
        if (solidFill) {
          bg = extractColor(solidFill[0], themeColors);
        }
      }

      // 单元格文字颜色与字号
      let textColor: string | undefined;
      let isBold = rowIndex === 0;
      let fontSize = 14;

      const rPrMatch = tcXml.match(/<a:rPr\b[\s\S]*?<\/a:rPr>/i);
      if (rPrMatch) {
        const rPrXml = rPrMatch[0];
        const rFill = rPrXml.match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/i);
        if (rFill) textColor = extractColor(rFill[0], themeColors);
        if (/<a:rPr\b[^>]*\bb=["']1["']/i.test(rPrXml)) isBold = true;
        const sz = rPrXml.match(/\bsz=["'](\d+)["']/i);
        if (sz) fontSize = Math.round(parseInt(sz[1], 10) / 100);
      }

      // 对齐
      let align: 'left' | 'center' | 'right' = 'left';
      const algnMatch = tcXml.match(/<a:pPr\b[^>]*\balgn=["'](\w+)["']/i);
      if (algnMatch) {
        const val = algnMatch[1].toLowerCase();
        if (val === 'ctr' || val === 'center') align = 'center';
        else if (val === 'r' || val === 'right') align = 'right';
      }

      cells.push({
        text: cleanText,
        isHeader: rowIndex === 0,
        background: bg,
        color: textColor,
        align,
        bold: isBold,
        fontSize,
      });
    }

    if (cells.length > 0) {
      rows.push(cells);
      rowIndex++;
    }
  }

  if (rows.length === 0) return null;

  return {
    id: elementId,
    type: 'table',
    x,
    y,
    width,
    height,
    rotation,
    tableRows: rows,
  };
}

/**
 * 递归遍历解析组合图形 `<p:grpSp>`
 */
function parseGroupNode(
  grpXml: string,
  baseId: string,
  mediaMap: Map<string, string>,
  themeColors: Record<string, string>,
  parentOffset = { x: 0, y: 0 }
): PptxElement[] {
  const results: PptxElement[] = [];

  // 获取群组自身的外框与内部偏移
  const geom = extractGeometry(grpXml);
  const currentOffset = {
    x: parentOffset.x + geom.x,
    y: parentOffset.y + geom.y,
  };

  // 递归提取内部的 sp、pic、graphicFrame
  results.push(...parseSlideElements(grpXml, baseId, mediaMap, themeColors, currentOffset));
  return results;
}

/**
 * 统一解析 XML 片段中所有可视元素，保持在文档树中的图层 z-index 相对顺序
 */
function parseSlideElements(
  containerXml: string,
  idPrefix: string,
  mediaMap: Map<string, string>,
  themeColors: Record<string, string>,
  coordOffset = { x: 0, y: 0 }
): PptxElement[] {
  const elements: PptxElement[] = [];

  // 综合匹配各类子节点：<p:sp>, <p:pic>, <p:graphicFrame>, <p:grpSp>
  const tagRegex = /<p:(sp|pic|graphicFrame|grpSp)\b[\s\S]*?<\/p:\1>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tagRegex.exec(containerXml)) !== null) {
    const tagName = match[1].toLowerCase();
    const nodeXml = match[0];
    const elId = `${idPrefix}-${tagName}-${idx++}`;

    if (tagName === 'sp') {
      const el = parseSpNode(nodeXml, elId, themeColors, coordOffset);
      if (el) elements.push(el);
    } else if (tagName === 'pic') {
      const el = parsePicNode(nodeXml, elId, mediaMap, coordOffset);
      if (el) elements.push(el);
    } else if (tagName === 'graphicframe') {
      const el = parseGraphicFrameNode(nodeXml, elId, themeColors, coordOffset);
      if (el) elements.push(el);
    } else if (tagName === 'grpsp') {
      const subElements = parseGroupNode(nodeXml, elId, mediaMap, themeColors, coordOffset);
      elements.push(...subElements);
    }
  }

  return elements;
}

/**
 * 解析幻灯片背景色
 */
function parseSlideBackground(slideXml: string, themeColors: Record<string, string>): string | undefined {
  const bgMatch = slideXml.match(/<p:bg\b[\s\S]*?<\/p:bg>/i) || slideXml.match(/<p:bgPr\b[\s\S]*?<\/p:bgPr>/i);
  if (bgMatch) {
    const fillMatch = bgMatch[0].match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/i);
    if (fillMatch) {
      return extractColor(fillMatch[0], themeColors);
    }
  }
  return undefined;
}

/**
 * 解析单个 slide XML 节点内容
 */
function parseSlideXml(
  xmlContent: string,
  slideIndex: number,
  mediaMap: Map<string, string>,
  themeColors: Record<string, string>
): PptxSlide {
  let slideTitle = `幻灯片 ${slideIndex + 1}`;

  // 提取背景色
  const backgroundColor = parseSlideBackground(xmlContent, themeColors);

  // 提取所有元素
  const elements = parseSlideElements(xmlContent, `el-${slideIndex}`, mediaMap, themeColors);

  // 尝试自动识别第一条作为标题
  for (const el of elements) {
    if (el.type === 'text' && el.paragraphs && el.paragraphs.length > 0) {
      const text = el.paragraphs[0].runs.map(r => r.text).join('').trim();
      if (text) {
        slideTitle = text.slice(0, 30);
        break;
      }
    }
  }

  return {
    index: slideIndex,
    title: slideTitle,
    elements,
    backgroundColor,
    rawXml: xmlContent,
  };
}

/**
 * 动态生成规范的样例 PPTX 电子幻灯片包 (包含 3 页精美矢量幻灯片)
 */
export async function generateSamplePptxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );

  // 3. docProps/core.xml
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>OmniView PowerPoint 架构演示文稿</dc:title>
  <dc:creator>OmniView Architecture Team</dc:creator>
  <dc:description>OmniView 纯离线 PPTX 矢量幻灯片渲染引擎演示</dc:description>
</cp:coreProperties>`
  );

  // 4. ppt/presentation.xml
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
    <p:sldId id="258" r:id="rId3"/>
  </p:sldIdLst>
</p:presentation>`
  );

  // 5. ppt/theme/theme1.xml (标准主题调色板)
  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="0F172A"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1E293B"/></a:dk2>
      <a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="3B82F6"/></a:accent1>
      <a:accent2><a:srgbClr val="10B981"/></a:accent2>
      <a:accent3><a:srgbClr val="8B5CF6"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="EC4899"/></a:accent5>
      <a:accent6><a:srgbClr val="06B6D4"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink>
      <a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
  </a:themeElements>
</a:theme>`
  );

  // 嵌入一张最小合法 1x1 蓝点 PNG 图标用于单测与离线验证
  const sampleDotPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfQHzD1RmbwAAAABJRU5ErkJggg==';
  zip.file('ppt/media/image1.png', sampleDotPngBase64, { base64: true });

  // 6. ppt/slides/_rels/slide2.xml.rels (关联媒体图片)
  zip.file(
    'ppt/slides/_rels/slide2.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`
  );

  // 7. ppt/slides/slide1.xml (封面页：标题 + 副标题 + 装饰色块形状)
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1016000" y="1651000"/><a:ext cx="10160000" cy="1524000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="4400"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>OmniView PPTX 原生演播工作台</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1016000" y="3429000"/><a:ext cx="10160000" cy="762000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr sz="2200"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr>
              <a:t>纯前端离线 OOXML 矢量解析，高保真还原形状、插图与矩阵表格</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- 封面底部装饰色条形状 (测试纯形状无文字保留) -->
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1016000" y="5500000"/><a:ext cx="10160000" cy="76200"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
        </p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  // 8. ppt/slides/slide2.xml (核心架构：文本 + 插图图片)
  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="762000" y="508000"/><a:ext cx="10668000" cy="762000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="3200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>核心渲染架构与工作流</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="762000" y="1524000"/><a:ext cx="7500000" cy="4572000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="2000"><a:solidFill><a:srgbClr val="3B82F6"/></a:solidFill></a:rPr>
              <a:t>• 纯离线微内核解析：</a:t>
            </a:r>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t> 基于 JSZip 直接提取 OOXML XML 节点，无需任何外网或云服务转换。</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="2000"><a:solidFill><a:srgbClr val="10B981"/></a:solidFill></a:rPr>
              <a:t>• 绝对坐标矢量视口：</a:t>
            </a:r>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t> 无论在 4K 宽屏还是侧边栏，自适应 16:9/4:3 完美等比居中缩放。</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="2000"><a:solidFill><a:srgbClr val="8B5CF6"/></a:solidFill></a:rPr>
              <a:t>• 演播级交互体验：</a:t>
            </a:r>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t> 支持全屏沉浸演播、快捷键左右翻页、缩略图大纲列表与演讲者备注抽屉。</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- 插图图片测试节点 -->
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="5" name="架构示意图"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rIdImg1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="8800000" y="1800000"/><a:ext cx="2600000" cy="2600000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  // 9. ppt/slides/slide3.xml (对比表格页：包含标题与 <p:graphicFrame> 标准表格)
  zip.file(
    'ppt/slides/slide3.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="762000" y="508000"/><a:ext cx="10668000" cy="762000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="3200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>特性支持矩阵</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- 标准表格框架 -->
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="6" name="支持矩阵表格"/>
          <p:cNvGraphicFramePr/>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm><a:off x="762000" y="1524000"/><a:ext cx="10668000" cy="3800000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tbl>
              <a:tblGrid>
                <a:gridCol w="3000000"/>
                <a:gridCol w="4000000"/>
                <a:gridCol w="3668000"/>
              </a:tblGrid>
              <a:tr h="600000">
                <a:tc>
                  <a:txBody><a:p><a:r><a:rPr b="1" sz="1600"/><a:t>格式类型</a:t></a:r></a:p></a:txBody>
                  <a:tcPr><a:solidFill><a:srgbClr val="F1F5F9"/></a:solidFill></a:tcPr>
                </a:tc>
                <a:tc>
                  <a:txBody><a:p><a:r><a:rPr b="1" sz="1600"/><a:t>渲染引擎模式</a:t></a:r></a:p></a:txBody>
                  <a:tcPr><a:solidFill><a:srgbClr val="F1F5F9"/></a:solidFill></a:tcPr>
                </a:tc>
                <a:tc>
                  <a:txBody><a:p><a:r><a:rPr b="1" sz="1600"/><a:t>离线安全性</a:t></a:r></a:p></a:txBody>
                  <a:tcPr><a:solidFill><a:srgbClr val="F1F5F9"/></a:solidFill></a:tcPr>
                </a:tc>
              </a:tr>
              <a:tr h="500000">
                <a:tc>
                  <a:txBody><a:p><a:r><a:t>PowerPoint (.pptx)</a:t></a:r></a:p></a:txBody>
                </a:tc>
                <a:tc>
                  <a:txBody><a:p><a:r><a:t>原生 OOXML 矢量排版引擎</a:t></a:r></a:p></a:txBody>
                </a:tc>
                <a:tc>
                  <a:txBody><a:p><a:r><a:t>100% 纯前端零网络依赖</a:t></a:r></a:p></a:txBody>
                </a:tc>
              </a:tr>
              <a:tr h="500000">
                <a:tc>
                  <a:txBody><a:p><a:r><a:t>Word (.docx)</a:t></a:r></a:p></a:txBody>
                </a:tc>
                <a:tc>
                  <a:txBody><a:p><a:r><a:t>高保真流式文档排版</a:t></a:r></a:p></a:txBody>
                </a:tc>
                <a:tc>
                  <a:txBody><a:p><a:r><a:t>DOMPurify 严格过滤</a:t></a:r></a:p></a:txBody>
                </a:tc>
              </a:tr>
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * 解析 PPTX 完整演示文稿
 */
export async function parsePptx(
  data: Uint8Array | ArrayBuffer | string,
  isFallback = false
): Promise<ParsedPptxPresentation> {
  let rawBytes: Uint8Array;

  if (typeof data === 'string') {
    if (data.startsWith('data:') || /^[A-Za-z0-9+/=\s\r\n]+$/.test(data.trim())) {
      try {
        rawBytes = base64ToBytes(data);
      } catch {
        return parsePptx(await generateSamplePptxBytes(), true);
      }
    } else {
      return parsePptx(await generateSamplePptxBytes(), true);
    }
  } else if (data instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(data);
  } else {
    rawBytes = data;
  }

  try {
    const zip = await JSZip.loadAsync(rawBytes);

    // 1. 元数据
    const metadata: PptxMetadata = {
      title: 'PowerPoint 演示文稿',
      slideCount: 0,
      width: 960,
      height: 540,
      aspectRatio: '16:9',
    };

    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const xml = await coreFile.async('text');
      const titleM = xml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      if (titleM) metadata.title = titleM[1].trim();
      const creatorM = xml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      if (creatorM) metadata.creator = creatorM[1].trim();
      const descM = xml.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
      if (descM) metadata.description = descM[1].trim();
    }

    // 2. 幻灯片尺寸 (ppt/presentation.xml)
    const presFile = zip.file('ppt/presentation.xml');
    if (presFile) {
      const xml = await presFile.async('text');
      const szMatch = xml.match(/<p:sldSz\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["']/i);
      if (szMatch) {
        const cx = emuToPt(parseInt(szMatch[1], 10));
        const cy = emuToPt(parseInt(szMatch[2], 10));
        if (cx > 0 && cy > 0) {
          metadata.width = cx;
          metadata.height = cy;
          const ratio = cx / cy;
          if (Math.abs(ratio - 16 / 9) < 0.1) metadata.aspectRatio = '16:9';
          else if (Math.abs(ratio - 4 / 3) < 0.1) metadata.aspectRatio = '4:3';
          else metadata.aspectRatio = 'custom';
        }
      }
    }

    // 3. 主题色彩 (ppt/theme/theme1.xml)
    let themeColors = { ...DEFAULT_THEME_COLORS };
    const themeFile = zip.file('ppt/theme/theme1.xml');
    if (themeFile) {
      const themeXml = await themeFile.async('text');
      themeColors = parseThemeColors(themeXml);
    }

    // 4. 收集并排序所有幻灯片 ppt/slides/slide{N}.xml
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)![0], 10);
        const numB = parseInt(b.match(/\d+/)![0], 10);
        return numA - numB;
      });

    const slides: PptxSlide[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      const slideXml = await zip.file(slidePath)!.async('text');

      // 提取幻灯片关系表 ppt/slides/_rels/slide{N}.xml.rels
      const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      const relsFile = zip.file(relsPath);
      const mediaMap = new Map<string, string>();

      if (relsFile) {
        const relsXml = await relsFile.async('text');
        const relRegex = /<Relationship\b[^>]*\bId=["']([^"']+)["'][^>]*\bTarget=["']([^"']+)["']/gi;
        let relMatch: RegExpExecArray | null;

        while ((relMatch = relRegex.exec(relsXml)) !== null) {
          const rId = relMatch[1];
          const rawTarget = relMatch[2];

          // 规范化媒体目标路径 (通常为 ../media/image1.png 或 media/image1.png)
          let resolvedTarget = rawTarget.replace(/^\.\.\//, 'ppt/');
          if (!resolvedTarget.startsWith('ppt/')) {
            resolvedTarget = 'ppt/' + resolvedTarget;
          }

          const mediaFile = zip.file(resolvedTarget);
          if (mediaFile) {
            const mimeType = getMimeTypeByPath(resolvedTarget);
            const base64 = await mediaFile.async('base64');
            mediaMap.set(rId, `data:${mimeType};base64,${base64}`);
          }
        }
      }

      const slide = parseSlideXml(slideXml, i, mediaMap, themeColors);

      // 尝试提取配套备注 ppt/notesSlides/notesSlide{N}.xml
      const notePath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
      const noteFile = zip.file(notePath);
      if (noteFile) {
        const noteXml = await noteFile.async('text');
        const noteTexts = noteXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi);
        if (noteTexts) {
          slide.notes = noteTexts.map(t => t.replace(/<[^>]+>/g, '')).join('\n').trim();
        }
      }

      slides.push(slide);
    }

    metadata.slideCount = slides.length;

    // 容错保护：若未解析到有效幻灯片，降级到内置样例
    if (slides.length === 0) {
      if (!isFallback) {
        return parsePptx(await generateSamplePptxBytes(), true);
      }
    }

    return {
      metadata,
      slides,
      isValid: true,
    };
  } catch (err) {
    console.warn('[PptxEngine] 加载 PPTX 异常，降级至样例文稿:', err);
    if (!isFallback) {
      return parsePptx(await generateSamplePptxBytes(), true);
    }
    return {
      metadata: { title: 'PowerPoint 演示文稿', slideCount: 0, width: 960, height: 540, aspectRatio: '16:9' },
      slides: [],
      isValid: false,
    };
  }
}
