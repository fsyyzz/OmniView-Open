/**
 * OmniView 原生 PowerPoint (.pptx) 解析与离线矢量渲染核心引擎
 * 基于 OOXML (ECMA-376) 标准、纯 TS XML AST 解析与 JSZip 纯前端流水线
 * 支持：母版/版式继承 (Master/Layout)、真实页序与关系表解析、组合图形子坐标变换、
 * 主题色运算 (tint/shade/lumMod/alpha)、渐变背景、项目符号与编号、合并单元格表格、
 * 原生内嵌图表 (chart*.xml) 与演讲者备注。
 */
import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import {
  type XmlNode,
  parseXmlTree,
  findChild,
  findChildren,
  findDescendant,
  findDescendants,
  collectNodeText,
  resolveColorFromNode,
  resolveGradientCss,
} from './pptxXmlUtils';

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
  notesCount?: number;
  chartCount?: number;
}

export interface PptxTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  baseline?: number; // >0 上标, <0 下标
  fontSize?: number; // pt
  color?: string;
  fontFamily?: string;
  href?: string;
}

export interface PptxParagraph {
  runs: PptxTextRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  level?: number;
  bullet?: boolean;
  bulletChar?: string;
  autoNumType?: string;
  autoNumIndex?: number;
  bulletColor?: string;
  marginLeft?: number; // pt
  indent?: number; // pt
  spaceBefore?: number; // pt
  spaceAfter?: number; // pt
  lineHeight?: number;
}

export interface PptxTableCell {
  text: string;
  isHeader?: boolean;
  background?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  bold?: boolean;
  fontSize?: number;
  colSpan?: number;
  rowSpan?: number;
  mergedSkip?: boolean;
  borderColor?: string;
}

export interface PptxChartSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface PptxChartData {
  chartType: 'bar' | 'col' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'unknown';
  title?: string;
  categories: string[];
  series: PptxChartSeries[];
}

export type PptxShapeType =
  | 'rect'
  | 'roundRect'
  | 'snip1Rect'
  | 'snip2SameRect'
  | 'snip2DiagRect'
  | 'round2SameRect'
  | 'round2DiagRect'
  | 'plaque'
  | 'foldedCorner'
  | 'frame'
  | 'ellipse'
  | 'donut'
  | 'pie'
  | 'blockArc'
  | 'can'
  | 'cube'
  | 'teardrop'
  | 'line'
  | 'arrow'
  | 'rightArrow'
  | 'leftArrow'
  | 'upArrow'
  | 'downArrow'
  | 'leftRightArrow'
  | 'upDownArrow'
  | 'quadArrow'
  | 'notchedRightArrow'
  | 'stripedRightArrow'
  | 'bentArrow'
  | 'uturnArrow'
  | 'triangle'
  | 'rtTriangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'diamond'
  | 'pentagon'
  | 'homePlate'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'decagon'
  | 'dodecagon'
  | 'star4'
  | 'star5'
  | 'star'
  | 'star6'
  | 'star8'
  | 'star10'
  | 'star12'
  | 'star16'
  | 'star24'
  | 'star32'
  | 'plus'
  | 'heart'
  | 'lightningBolt'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'wave'
  | 'ribbon'
  | 'chevron'
  | 'callout'
  | 'connector'
  | 'custom';

export interface PptxCustomPath {
  d: string;
  viewBoxW: number;
  viewBoxH: number;
  fillMode?: 'norm' | 'none' | 'lighten' | 'darken';
  stroked?: boolean;
}

export interface PptxElement {
  id: string;
  name?: string;
  type: 'text' | 'shape' | 'image' | 'table' | 'chart';
  x: number; // pt
  y: number;
  width: number;
  height: number;
  rotation?: number; // 0-360
  flipH?: boolean;
  flipV?: boolean;
  opacity?: number;
  hasShadow?: boolean;
  isFromMaster?: boolean;
  // 层级与结构元数据
  zIndex?: number;
  layerTier?: 'master' | 'layout' | 'slide';
  groupPath?: string[];
  isBackgroundShape?: boolean;
  // 文本专属
  paragraphs?: PptxParagraph[];
  backgroundColor?: string;
  backgroundGradient?: string;
  borderColor?: string;
  borderWidth?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: { top: number; right: number; bottom: number; left: number };
  // 形状与多边形专属
  shapeType?: PptxShapeType;
  rawPresetName?: string;
  shapeAdjusts?: Record<string, number>;
  customPaths?: PptxCustomPath[];
  fillColor?: string;
  fillGradient?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDash?: 'solid' | 'dash' | 'dot' | 'dashDot';
  headArrow?: boolean;
  tailArrow?: boolean;
  // 图片专属
  imageDataUrl?: string;
  imageAlt?: string;
  imageCrop?: { l?: number; t?: number; r?: number; b?: number };
  // 表格专属
  tableRows?: PptxTableCell[][];
  colWidthsPct?: number[];
  rowHeightsPt?: number[];
  // 图表专属
  chartData?: PptxChartData;
}

export interface PptxSlide {
  index: number;
  slideNumber?: number;
  title: string;
  elements: PptxElement[];
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  notes?: string;
  isHidden?: boolean;
  layoutName?: string;
  rawXml?: string;
}

export interface ParsedPptxPresentation {
  metadata: PptxMetadata;
  slides: PptxSlide[];
  isValid: boolean;
  isFallbackUsed?: boolean;
  parseWarnings?: string[];
}

export function emuToPt(emu: number): number {
  return Math.round((emu / 12700) * 10) / 10;
}

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

const DEFAULT_THEME_COLORS: Record<string, string> = {
  dk1: '#0F172A',
  lt1: '#FFFFFF',
  dk2: '#1E293B',
  lt2: '#F8FAFC',
  accent1: '#3B82F6',
  accent2: '#10B981',
  accent3: '#8B5CF6',
  accent4: '#F59E0B',
  accent5: '#EC4899',
  accent6: '#06B6D4',
  hlink: '#2563EB',
  folhlink: '#7C3AED',
  bg1: '#FFFFFF',
  tx1: '#0F172A',
  bg2: '#F8FAFC',
  tx2: '#1E293B',
};

const DEFAULT_COLOR_MAP: Record<string, string> = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hlink',
  folHlink: 'folhlink',
  folhlink: 'folhlink',
};

interface RelEntry {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

function resolveZipPath(baseFilePath: string, relativeTarget: string): string {
  if (!relativeTarget) return '';
  if (relativeTarget.startsWith('/')) return relativeTarget.slice(1);
  const baseDirParts = baseFilePath.split('/').slice(0, -1);
  const targetParts = relativeTarget.split('/');
  const combined = [...baseDirParts];
  for (const part of targetParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (combined.length > 0) combined.pop();
    } else {
      combined.push(part);
    }
  }
  return combined.join('/');
}

async function readRelsMap(zip: JSZip, partPath: string): Promise<Map<string, RelEntry>> {
  const map = new Map<string, RelEntry>();
  const lastSlash = partPath.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : partPath.slice(0, lastSlash + 1);
  const file = lastSlash === -1 ? partPath : partPath.slice(lastSlash + 1);
  const relsPath = `${dir}_rels/${file}.rels`;
  const relsFile = zip.file(relsPath);
  if (!relsFile) return map;

  const relsXml = await relsFile.async('text');
  const tree = parseXmlTree(relsXml);
  for (const rel of findDescendants(tree, 'Relationship')) {
    const id = rel.attrs.Id || '';
    const type = rel.attrs.Type || '';
    const target = rel.attrs.Target || '';
    const targetMode = rel.attrs.TargetMode;
    if (id && target) {
      map.set(id, {
        id,
        type,
        target: targetMode === 'External' ? target : resolveZipPath(partPath, target),
        targetMode,
      });
    }
  }
  return map;
}

async function buildMediaDataMap(zip: JSZip, relsMap: Map<string, RelEntry>): Promise<Map<string, string>> {
  const mediaMap = new Map<string, string>();
  for (const [rId, rel] of relsMap.entries()) {
    if (rel.targetMode === 'External') continue;
    if (!rel.type.toLowerCase().includes('image') && !rel.target.toLowerCase().includes('/media/')) {
      continue;
    }
    const mediaFile = zip.file(rel.target);
    if (mediaFile) {
      const mimeType = getMimeTypeByPath(rel.target);
      const base64 = await mediaFile.async('base64');
      mediaMap.set(rId, `data:${mimeType};base64,${base64}`);
    }
  }
  return mediaMap;
}

function parseThemeColorsFromXml(themeXml?: string): {
  colors: Record<string, string>;
  majorFont?: string;
  minorFont?: string;
} {
  const colors: Record<string, string> = { ...DEFAULT_THEME_COLORS };
  if (!themeXml) return { colors };

  const tree = parseXmlTree(themeXml);
  const clrScheme = findDescendant(tree, 'clrScheme');
  if (clrScheme) {
    for (const child of clrScheme.children) {
      const key = child.localName.toLowerCase();
      const resolved = resolveColorFromNode(child, colors);
      if (resolved) {
        colors[key] = resolved;
      }
    }
  }

  const fontScheme = findDescendant(tree, 'fontScheme');
  const majorFont = findDescendant(findChild(fontScheme, 'majorFont'), 'latin')?.attrs.typeface;
  const minorFont = findDescendant(findChild(fontScheme, 'minorFont'), 'latin')?.attrs.typeface;
  return { colors, majorFont, minorFont };
}

interface CoordTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

const IDENTITY_TRANSFORM: CoordTransform = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

interface GeometryBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  hasExplicitGeometry: boolean;
}

function extractGeometryFromXfrm(xfrmNode: XmlNode | undefined, tx: CoordTransform = IDENTITY_TRANSFORM): GeometryBox {
  if (!xfrmNode) {
    return { x: 40, y: 40, width: 200, height: 100, hasExplicitGeometry: false };
  }
  const off = findChild(xfrmNode, 'off');
  const ext = findChild(xfrmNode, 'ext');

  const hasOff = Boolean(off && off.attrs.x !== undefined && off.attrs.y !== undefined);
  const hasExt = Boolean(ext && ext.attrs.cx !== undefined && ext.attrs.cy !== undefined);

  const rawX = hasOff ? emuToPt(parseInt(off!.attrs.x, 10)) : 40;
  const rawY = hasOff ? emuToPt(parseInt(off!.attrs.y, 10)) : 40;
  const rawW = hasExt ? emuToPt(parseInt(ext!.attrs.cx, 10)) : 200;
  const rawH = hasExt ? emuToPt(parseInt(ext!.attrs.cy, 10)) : 100;

  let rotation: number | undefined;
  if (xfrmNode.attrs.rot) {
    rotation = Math.round(parseInt(xfrmNode.attrs.rot, 10) / 60000);
  }
  const flipH = xfrmNode.attrs.flipH === '1' || xfrmNode.attrs.flipH === 'true';
  const flipV = xfrmNode.attrs.flipV === '1' || xfrmNode.attrs.flipV === 'true';

  return {
    x: Math.round((tx.offsetX + rawX * tx.scaleX) * 10) / 10,
    y: Math.round((tx.offsetY + rawY * tx.scaleY) * 10) / 10,
    width: Math.round(rawW * tx.scaleX * 10) / 10,
    height: Math.round(rawH * tx.scaleY * 10) / 10,
    rotation,
    flipH: flipH || undefined,
    flipV: flipV || undefined,
    hasExplicitGeometry: hasOff || hasExt,
  };
}

export function mapPresetShapeType(prst?: string, isConnector = false): PptxShapeType {
  if (isConnector && (!prst || prst.toLowerCase().includes('connector') || prst === 'line')) {
    return 'connector';
  }
  if (!prst) return 'rect';
  const val = prst.toLowerCase();

  // 圆角与切角矩形家族
  if (val === 'roundrect' || val === 'round1rect' || val === 'sniproundrect' || val === 'flowchartalternateprocess') {
    return 'roundRect';
  }
  if (val === 'round2samerect' || val === 'round2same') return 'round2SameRect';
  if (val === 'round2diagrect' || val === 'round2diag') return 'round2DiagRect';
  if (val === 'snip1rect') return 'snip1Rect';
  if (val === 'snip2samerect' || val === 'snip2same') return 'snip2SameRect';
  if (val === 'snip2diagrect' || val === 'snip2diag') return 'snip2DiagRect';
  if (val === 'plaque') return 'plaque';
  if (val === 'foldedcorner' || val === 'flowchartdocument') return 'foldedCorner';
  if (val === 'frame' || val === 'halfframe') return 'frame';

  // 圆、弧、扇形、圆柱与立方体
  if (val === 'ellipse' || val === 'flowchartconnector' || val === 'actionbuttonblank') return 'ellipse';
  if (val === 'donut') return 'donut';
  if (val === 'pie' || val === 'pieslice' || val === 'chord') return 'pie';
  if (val === 'blockarc' || val === 'arc') return 'blockArc';
  if (val === 'can' || val === 'flowchartmagneticdisk' || val === 'cylinder') return 'can';
  if (val === 'cube' || val === 'bevel') return 'cube';
  if (val === 'teardrop') return 'teardrop';

  // 直线与连接线
  if (val === 'line' || val === 'lineinv') return 'line';
  if (val.includes('connector')) return 'connector';

  // 多边形家族（三角形、平行四边形、梯形、菱形、正五边形、五边标签、六/七/八/十/十二边形）
  if (val === 'triangle' || val === 'isoscelestriangle' || val === 'flowchartextract') return 'triangle';
  if (val === 'rttriangle') return 'rtTriangle';
  if (val === 'parallelogram' || val === 'flowchartdata') return 'parallelogram';
  if (val === 'trapezoid' || val === 'nonisoscelestrapezoid' || val === 'flowchartmanualoperation') return 'trapezoid';
  if (val === 'diamond' || val === 'flowchartdecision') return 'diamond';
  if (val === 'pentagon') return 'pentagon';
  if (val === 'homeplate' || val === 'flowchartoffpageconnector') return 'homePlate';
  if (val === 'hexagon' || val === 'flowchartpreparation') return 'hexagon';
  if (val === 'heptagon') return 'heptagon';
  if (val === 'octagon') return 'octagon';
  if (val === 'decagon') return 'decagon';
  if (val === 'dodecagon') return 'dodecagon';

  // 星形与徽章家族
  if (val === 'star4') return 'star4';
  if (val === 'star5') return 'star5';
  if (val === 'star6') return 'star6';
  if (val === 'star7' || val === 'star8') return 'star8';
  if (val === 'star10') return 'star10';
  if (val === 'star12') return 'star12';
  if (val === 'star16') return 'star16';
  if (val === 'star24') return 'star24';
  if (val === 'star32' || val.startsWith('seal')) return 'star32';
  if (val.startsWith('star')) return 'star';

  // 箭头与燕尾形家族
  if (val === 'chevron') return 'chevron';
  if (val === 'notchedrightarrow') return 'notchedRightArrow';
  if (val === 'stripedrightarrow') return 'stripedRightArrow';
  if (val === 'leftrightarrow') return 'leftRightArrow';
  if (val === 'updownarrow') return 'upDownArrow';
  if (val === 'quadarrow' || val === 'leftrightupdownarrow') return 'quadArrow';
  if (val === 'bentarrow' || val === 'bentuparrow') return 'bentArrow';
  if (val === 'uturnarrow' || val === 'curvedrightarrow' || val === 'curvedleftarrow') return 'uturnArrow';
  if (val === 'rightarrow') return 'rightArrow';
  if (val === 'leftarrow') return 'leftArrow';
  if (val === 'uparrow') return 'upArrow';
  if (val === 'downarrow') return 'downArrow';
  if (val.includes('arrow')) return 'arrow';

  // 符号与装饰形状
  if (val === 'plus' || val === 'mathplus' || val === 'cross') return 'plus';
  if (val === 'heart') return 'heart';
  if (val === 'lightningbolt') return 'lightningBolt';
  if (val === 'sun') return 'sun';
  if (val === 'moon') return 'moon';
  if (val === 'cloud' || val === 'cloudcallout') return 'cloud';
  if (val === 'wave' || val === 'doublewave') return 'wave';
  if (val.includes('ribbon') || val.includes('scroll')) return 'ribbon';
  if (val.includes('callout')) return 'callout';
  if (val === 'rect' || val.startsWith('flowchart')) return 'rect';
  return 'custom';
}

/**
 * 解析 <a:prstGeom><a:avLst><a:gd name="adj..." fmla="val ..."/></a:avLst> 形状调节柄参数
 */
function parseShapeAdjusts(prstGeomNode: XmlNode | undefined): Record<string, number> | undefined {
  if (!prstGeomNode) return undefined;
  const avLst = findChild(prstGeomNode, 'avLst');
  if (!avLst) return undefined;
  const adjusts: Record<string, number> = {};
  let hasAny = false;
  for (const gd of findChildren(avLst, 'gd')) {
    const name = gd.attrs.name || '';
    const fmla = gd.attrs.fmla || '';
    const match = fmla.match(/val\s+(-?\d+)/i);
    if (name && match) {
      const val = parseInt(match[1], 10);
      if (Number.isFinite(val)) {
        adjusts[name] = val;
        hasAny = true;
      }
    }
  }
  return hasAny ? adjusts : undefined;
}

/**
 * 解析 OOXML 自由多边形 / 自定义矢量几何路径 (<a:custGeom><a:pathLst><a:path>)
 */
function parseCustomGeometryPaths(
  custGeomNode: XmlNode | undefined,
  geomWidthPt: number,
  geomHeightPt: number
): PptxCustomPath[] | undefined {
  if (!custGeomNode) return undefined;
  const pathLst = findChild(custGeomNode, 'pathLst');
  if (!pathLst) return undefined;

  const paths: PptxCustomPath[] = [];
  for (const pathNode of findChildren(pathLst, 'path')) {
    const rawW = pathNode.attrs.w ? parseInt(pathNode.attrs.w, 10) : 0;
    const rawH = pathNode.attrs.h ? parseInt(pathNode.attrs.h, 10) : 0;
    const useLocalCoord = rawW > 0 && rawH > 0;
    const viewBoxW = useLocalCoord ? rawW : Math.max(1, geomWidthPt);
    const viewBoxH = useLocalCoord ? rawH : Math.max(1, geomHeightPt);

    const toCoordX = (rawVal?: string): number => {
      const v = parseInt(rawVal || '0', 10);
      if (!Number.isFinite(v)) return 0;
      return useLocalCoord ? v : emuToPt(v);
    };
    const toCoordY = (rawVal?: string): number => {
      const v = parseInt(rawVal || '0', 10);
      if (!Number.isFinite(v)) return 0;
      return useLocalCoord ? v : emuToPt(v);
    };

    const cmds: string[] = [];
    for (const cmd of pathNode.children) {
      const name = cmd.localName;
      if (name === 'moveTo') {
        const pt = findChild(cmd, 'pt');
        if (pt) {
          cmds.push(`M ${toCoordX(pt.attrs.x)} ${toCoordY(pt.attrs.y)}`);
        }
      } else if (name === 'lnTo') {
        const pt = findChild(cmd, 'pt');
        if (pt) {
          cmds.push(`L ${toCoordX(pt.attrs.x)} ${toCoordY(pt.attrs.y)}`);
        }
      } else if (name === 'cubicBezTo') {
        const pts = findChildren(cmd, 'pt');
        if (pts.length >= 3) {
          cmds.push(
            `C ${toCoordX(pts[0].attrs.x)} ${toCoordY(pts[0].attrs.y)}, ${toCoordX(pts[1].attrs.x)} ${toCoordY(
              pts[1].attrs.y
            )}, ${toCoordX(pts[2].attrs.x)} ${toCoordY(pts[2].attrs.y)}`
          );
        }
      } else if (name === 'quadBezTo') {
        const pts = findChildren(cmd, 'pt');
        if (pts.length >= 2) {
          cmds.push(
            `Q ${toCoordX(pts[0].attrs.x)} ${toCoordY(pts[0].attrs.y)}, ${toCoordX(pts[1].attrs.x)} ${toCoordY(
              pts[1].attrs.y
            )}`
          );
        }
      } else if (name === 'close') {
        cmds.push('Z');
      }
    }

    if (cmds.length > 0) {
      const fillAttr = pathNode.attrs.fill as PptxCustomPath['fillMode'] | undefined;
      const strokeAttr = pathNode.attrs.stroke;
      paths.push({
        d: cmds.join(' '),
        viewBoxW,
        viewBoxH,
        fillMode: fillAttr || 'norm',
        stroked: strokeAttr !== '0' && strokeAttr !== 'false',
      });
    }
  }

  return paths.length > 0 ? paths : undefined;
}

interface PlaceholderTemplate {
  key: string;
  geometry?: GeometryBox;
  defaultFontSize?: number;
  defaultColor?: string;
  defaultBold?: boolean;
  defaultAlign?: 'left' | 'center' | 'right' | 'justify';
  defaultBullet?: boolean;
}

interface MasterOrLayoutContext {
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  colorMap: Record<string, string>;
  placeholders: Map<string, PlaceholderTemplate>;
  decorativeElements: PptxElement[];
  titleDefaultFontSize?: number;
  bodyDefaultFontSize?: number;
  layoutName?: string;
  showMasterSp?: boolean;
}

function extractPlaceholderMeta(node: XmlNode): {
  isPlaceholder: boolean;
  phType?: string;
  phIdx?: string;
} {
  const nvPr = findDescendant(node, 'nvPr');
  const ph = findChild(nvPr, 'ph');
  if (ph) {
    return {
      isPlaceholder: true,
      phType: ph.attrs.type,
      phIdx: ph.attrs.idx,
    };
  }
  const cNvPr = findDescendant(node, 'cNvPr');
  const name = cNvPr?.attrs.name || '';
  if (/(?:占位符|Placeholder)/i.test(name)) {
    return {
      isPlaceholder: true,
    };
  }
  return { isPlaceholder: false };
}

function isXmlNodeHidden(node: XmlNode): boolean {
  for (const child of node.children) {
    if (child.localName.startsWith('nv')) {
      const cNvPr = findChild(child, 'cNvPr');
      if (cNvPr && (cNvPr.attrs.hidden === '1' || cNvPr.attrs.hidden === 'true')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 识别 PowerPoint / WPS / Keynote 母版与版式中的默认占位提示语或母版标识文本
 */
function isMasterTemplatePromptText(rawText: string): boolean {
  const t = rawText.trim().replace(/\s+/g, ' ');
  if (!t) return false;
  return (
    /^(?:单击|点击|双击|请在此|在此)(?:此处)?(?:编辑|添加|输入|修改)(?:母版|模版|模板)?(?:标题|副标题|文本|正文|文字|内容|样式|图片|表格|图表|备注|页脚|日期|对象)?(?:样式)?[.。!！]*$/i.test(
      t
    ) ||
    /(?:单击|点击|双击)此处(?:编辑|添加)(?:母版|模版|模板)?(?:标题|副标题|文本|正文|文字|样式)/i.test(t) ||
    /编辑(?:母版|模版|模板)(?:文本|标题|副标题)?样式/i.test(t) ||
    /^Click to (?:edit|add) (?:Master )?(?:title|subtitle|text|notes|header|footer|content)(?: styles?)?\.?$/i.test(
      t
    ) ||
    /^Double-click to (?:edit|add) /i.test(t) ||
    /^(?:‹#›|<#>|‹日期\/时间›|‹页脚›|‹幻灯片编号›|<date\/time>|<footer>|<header>|<slide number>)$/i.test(t)
  );
}

/**
 * 识别母版多级文本样式示例行（如“第二级”、“第三级”、“Second level”）
 */
function isMasterLevelSampleText(rawText: string): boolean {
  const t = rawText.trim().replace(/\s+/g, ' ');
  if (!t) return false;
  return (
    /^第[一二三四五六七八九十\d]+级(?:文本|标题|样式)?$/i.test(t) ||
    /^(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth) level(?:\s+text)?$/i.test(t)
  );
}

function parseColorMapNode(node: XmlNode | undefined, base: Record<string, string>): Record<string, string> {
  if (!node) return base;
  const map = { ...base };
  for (const [k, v] of Object.entries(node.attrs)) {
    if (!k.includes(':') && v) {
      map[k] = v;
      map[k.toLowerCase()] = v;
    }
  }
  return map;
}

function parseBackgroundFromCsld(
  cSldNode: XmlNode | undefined,
  themeColors: Record<string, string>,
  colorMap: Record<string, string>,
  mediaMap: Map<string, string>
): { backgroundColor?: string; backgroundGradient?: string; backgroundImage?: string } {
  if (!cSldNode) return {};
  const bgNode = findChild(cSldNode, 'bg');
  if (!bgNode) return {};

  const bgPr = findChild(bgNode, 'bgPr');
  if (bgPr) {
    const solidFill = findChild(bgPr, 'solidFill');
    if (solidFill) {
      return { backgroundColor: resolveColorFromNode(solidFill, themeColors, colorMap) };
    }
    const gradFill = findChild(bgPr, 'gradFill');
    if (gradFill) {
      const gradCss = resolveGradientCss(gradFill, themeColors, colorMap);
      return { backgroundGradient: gradCss };
    }
    const blipFill = findChild(bgPr, 'blipFill');
    if (blipFill) {
      const blip = findChild(blipFill, 'blip');
      const rId = blip?.attrs['r:embed'] || blip?.attrs.embed;
      if (rId && mediaMap.has(rId)) {
        return { backgroundImage: mediaMap.get(rId) };
      }
    }
  }

  const bgRef = findChild(bgNode, 'bgRef');
  if (bgRef) {
    const refClr = resolveColorFromNode(bgRef, themeColors, colorMap);
    if (refClr) return { backgroundColor: refClr };
  }

  return {};
}

function parseFillAndStroke(
  spPrNode: XmlNode | undefined,
  themeColors: Record<string, string>,
  colorMap: Record<string, string>,
  styleNode?: XmlNode
): {
  fillColor?: string;
  fillGradient?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDash?: 'solid' | 'dash' | 'dot' | 'dashDot';
  headArrow?: boolean;
  tailArrow?: boolean;
  hasShadow?: boolean;
} {
  let fillColor: string | undefined;
  let fillGradient: string | undefined;
  let strokeColor: string | undefined;
  let strokeWidth: number | undefined;
  let strokeDash: 'solid' | 'dash' | 'dot' | 'dashDot' | undefined;
  let headArrow = false;
  let tailArrow = false;
  let hasShadow = false;

  if (spPrNode) {
    if (findChild(spPrNode, 'noFill')) {
      fillColor = 'transparent';
    } else {
      const solidFill = findChild(spPrNode, 'solidFill');
      if (solidFill) {
        fillColor = resolveColorFromNode(solidFill, themeColors, colorMap);
      } else {
        const gradFill = findChild(spPrNode, 'gradFill');
        if (gradFill) {
          fillGradient = resolveGradientCss(gradFill, themeColors, colorMap);
        }
      }
    }

    const ln = findChild(spPrNode, 'ln');
    if (ln && !findChild(ln, 'noFill')) {
      const lnSolid = findChild(ln, 'solidFill');
      if (lnSolid) {
        strokeColor = resolveColorFromNode(lnSolid, themeColors, colorMap);
      }
      if (ln.attrs.w) {
        strokeWidth = Math.max(1, emuToPt(parseInt(ln.attrs.w, 10)));
      } else if (strokeColor) {
        strokeWidth = 1;
      }
      const prstDash = findChild(ln, 'prstDash')?.attrs.val?.toLowerCase();
      if (prstDash) {
        if (prstDash.includes('dashdot')) strokeDash = 'dashDot';
        else if (prstDash.includes('dot')) strokeDash = 'dot';
        else if (prstDash.includes('dash')) strokeDash = 'dash';
        else strokeDash = 'solid';
      }
      const headEnd = findChild(ln, 'headEnd');
      if (headEnd?.attrs.type && headEnd.attrs.type !== 'none') headArrow = true;
      const tailEnd = findChild(ln, 'tailEnd');
      if (tailEnd?.attrs.type && tailEnd.attrs.type !== 'none') tailArrow = true;
    }

    const effectLst = findChild(spPrNode, 'effectLst');
    if (effectLst && findChild(effectLst, 'outerShdw')) {
      hasShadow = true;
    }
  }

  if (!fillColor && !fillGradient && styleNode) {
    const fillRef = findChild(styleNode, 'fillRef');
    if (fillRef && fillRef.attrs.idx !== '0') {
      fillColor = resolveColorFromNode(fillRef, themeColors, colorMap);
    }
  }
  if (!strokeColor && styleNode) {
    const lnRef = findChild(styleNode, 'lnRef');
    if (lnRef && lnRef.attrs.idx !== '0') {
      strokeColor = resolveColorFromNode(lnRef, themeColors, colorMap);
      strokeWidth = strokeWidth || 1;
    }
  }

  return {
    fillColor,
    fillGradient,
    strokeColor,
    strokeWidth,
    strokeDash,
    headArrow: headArrow || undefined,
    tailArrow: tailArrow || undefined,
    hasShadow: hasShadow || undefined,
  };
}

function resolveAlign(algn?: string): 'left' | 'center' | 'right' | 'justify' | undefined {
  if (!algn) return undefined;
  const val = algn.toLowerCase();
  if (val === 'ctr' || val === 'center') return 'center';
  if (val === 'r' || val === 'right') return 'right';
  if (val === 'just' || val === 'justify') return 'justify';
  if (val === 'l' || val === 'left') return 'left';
  return undefined;
}

function parseSpNodeFromXml(
  spNode: XmlNode,
  elementId: string,
  themeColors: Record<string, string>,
  colorMap: Record<string, string>,
  relsMap: Map<string, RelEntry>,
  tx: CoordTransform,
  layoutCtx?: MasterOrLayoutContext,
  masterCtx?: MasterOrLayoutContext,
  isFromMaster = false
): PptxElement | null {
  const isConnector = spNode.localName === 'cxnSp';
  const spPr = findChild(spNode, 'spPr');
  const styleNode = findChild(spNode, 'style');
  const xfrm = findChild(spPr, 'xfrm');
  let geom = extractGeometryFromXfrm(xfrm, tx);

  // 占位符继承 (<p:ph>)：母版/版式中的任何占位符仅提供几何与样式继承，绝不直接作为装饰图形渲染
  const { isPlaceholder, phType, phIdx } = extractPlaceholderMeta(spNode);
  if (isFromMaster && isPlaceholder) {
    return null;
  }

  const phLookupKeys: string[] = [];
  if (phType && phIdx) phLookupKeys.push(`type:${phType}:idx:${phIdx}`);
  if (phType) phLookupKeys.push(`type:${phType}`);
  if (phIdx) phLookupKeys.push(`idx:${phIdx}`);
  if (isPlaceholder && !phType) {
    phLookupKeys.push('type:body', 'type:obj');
  }

  let layoutPh: PlaceholderTemplate | undefined;
  let masterPh: PlaceholderTemplate | undefined;
  for (const key of phLookupKeys) {
    if (!layoutPh) layoutPh = layoutCtx?.placeholders.get(key);
    if (!masterPh) masterPh = masterCtx?.placeholders.get(key);
  }
  const phTemplate: PlaceholderTemplate | undefined =
    layoutPh || masterPh
      ? {
          key: layoutPh?.key || masterPh!.key,
          geometry: layoutPh?.geometry || masterPh?.geometry,
          defaultFontSize: layoutPh?.defaultFontSize ?? masterPh?.defaultFontSize,
          defaultColor: layoutPh?.defaultColor || masterPh?.defaultColor,
          defaultBold: layoutPh?.defaultBold ?? masterPh?.defaultBold,
          defaultAlign: layoutPh?.defaultAlign || masterPh?.defaultAlign,
          defaultBullet: layoutPh?.defaultBullet ?? masterPh?.defaultBullet,
        }
      : undefined;

  if (!geom.hasExplicitGeometry && phTemplate?.geometry) {
    geom = {
      ...phTemplate.geometry,
      x: Math.round((tx.offsetX + phTemplate.geometry.x * tx.scaleX) * 10) / 10,
      y: Math.round((tx.offsetY + phTemplate.geometry.y * tx.scaleY) * 10) / 10,
      width: Math.round(phTemplate.geometry.width * tx.scaleX * 10) / 10,
      height: Math.round(phTemplate.geometry.height * tx.scaleY * 10) / 10,
    };
  }

  const cNvPr = findDescendant(spNode, 'cNvPr');
  const rawNodeName = cNvPr?.attrs.name?.trim() || undefined;

  const prstGeom = findChild(spPr, 'prstGeom');
  const custGeom = findChild(spPr, 'custGeom');
  const rawPresetName = prstGeom?.attrs.prst;
  const shapeAdjusts = parseShapeAdjusts(prstGeom);
  const customPaths = parseCustomGeometryPaths(custGeom, geom.width, geom.height);
  const shapeType: PptxShapeType = customPaths
    ? 'custom'
    : mapPresetShapeType(rawPresetName, isConnector);
  const {
    fillColor,
    fillGradient,
    strokeColor,
    strokeWidth,
    strokeDash,
    headArrow,
    tailArrow,
    hasShadow,
  } = parseFillAndStroke(spPr, themeColors, colorMap, styleNode);

  // 文本框正文 <p:txBody>
  const txBody = findChild(spNode, 'txBody');
  const paragraphs: PptxParagraph[] = [];

  let verticalAlign: 'top' | 'middle' | 'bottom' | undefined;
  let padding: { top: number; right: number; bottom: number; left: number } | undefined;

  if (txBody) {
    const bodyPr = findChild(txBody, 'bodyPr');
    if (bodyPr) {
      if (bodyPr.attrs.anchor === 'ctr') verticalAlign = 'middle';
      else if (bodyPr.attrs.anchor === 'b') verticalAlign = 'bottom';
      else if (bodyPr.attrs.anchor === 't') verticalAlign = 'top';

      if (
        bodyPr.attrs.lIns !== undefined ||
        bodyPr.attrs.tIns !== undefined ||
        bodyPr.attrs.rIns !== undefined ||
        bodyPr.attrs.bIns !== undefined
      ) {
        padding = {
          left: bodyPr.attrs.lIns ? emuToPt(parseInt(bodyPr.attrs.lIns, 10)) : 7,
          top: bodyPr.attrs.tIns ? emuToPt(parseInt(bodyPr.attrs.tIns, 10)) : 4,
          right: bodyPr.attrs.rIns ? emuToPt(parseInt(bodyPr.attrs.rIns, 10)) : 7,
          bottom: bodyPr.attrs.bIns ? emuToPt(parseInt(bodyPr.attrs.bIns, 10)) : 4,
        };
      }
    }

    const lstStyle = findChild(txBody, 'lstStyle');
    const levelDefaults = new Map<number, { fontSize?: number; color?: string; bold?: boolean; align?: 'left' | 'center' | 'right' | 'justify' }>();
    if (lstStyle) {
      for (let lvl = 1; lvl <= 9; lvl++) {
        const lvlNode = findChild(lstStyle, `lvl${lvl}pPr`);
        if (lvlNode) {
          const defRPr = findChild(lvlNode, 'defRPr');
          const defFill = defRPr ? findChild(defRPr, 'solidFill') : undefined;
          levelDefaults.set(lvl - 1, {
            fontSize: defRPr?.attrs.sz ? Math.round(parseInt(defRPr.attrs.sz, 10) / 100) : undefined,
            color: defFill ? resolveColorFromNode(defFill, themeColors, colorMap) : undefined,
            bold: defRPr?.attrs.b === '1' || defRPr?.attrs.b === 'true',
            align: resolveAlign(lvlNode.attrs.algn),
          });
        }
      }
    }

    const isTitlePh = phType === 'title' || phType === 'ctrTitle';
    const isSubTitlePh = phType === 'subTitle';
    const fallbackFontSize =
      phTemplate?.defaultFontSize ||
      (isTitlePh ? masterCtx?.titleDefaultFontSize || 32 : isSubTitlePh ? 22 : masterCtx?.bodyDefaultFontSize || 16);

    let autoNumCounter = 1;

    for (const pNode of findChildren(txBody, 'p')) {
      const pPr = findChild(pNode, 'pPr');
      const level = pPr?.attrs.lvl ? parseInt(pPr.attrs.lvl, 10) : 0;
      const lvlDefault = levelDefaults.get(level);

      const align = resolveAlign(pPr?.attrs.algn) || lvlDefault?.align || phTemplate?.defaultAlign || (phType === 'ctrTitle' ? 'center' : 'left');
      const marginLeft = pPr?.attrs.marL ? emuToPt(parseInt(pPr.attrs.marL, 10)) : level > 0 ? level * 18 : undefined;
      const indent = pPr?.attrs.indent ? emuToPt(parseInt(pPr.attrs.indent, 10)) : undefined;

      let bullet = false;
      let bulletChar: string | undefined;
      let autoNumType: string | undefined;
      let autoNumIndex: number | undefined;
      let bulletColor: string | undefined;

      if (pPr) {
        const buNone = findChild(pPr, 'buNone');
        const buCharNode = findChild(pPr, 'buChar');
        const buAutoNumNode = findChild(pPr, 'buAutoNum');
        const buClrNode = findChild(pPr, 'buClr');
        if (buClrNode) {
          bulletColor = resolveColorFromNode(buClrNode, themeColors, colorMap);
        }
        if (!buNone) {
          if (buCharNode?.attrs.char) {
            bullet = true;
            bulletChar = buCharNode.attrs.char;
          } else if (buAutoNumNode) {
            bullet = true;
            autoNumType = buAutoNumNode.attrs.type || 'arabicPeriod';
            const startAt = buAutoNumNode.attrs.startAt ? parseInt(buAutoNumNode.attrs.startAt, 10) : undefined;
            if (startAt !== undefined && autoNumCounter === 1) autoNumCounter = startAt;
            autoNumIndex = autoNumCounter++;
          } else if (phTemplate?.defaultBullet) {
            bullet = true;
            bulletChar = '•';
          }
        }
      } else if (phTemplate?.defaultBullet) {
        bullet = true;
        bulletChar = '•';
      }

      let spaceBefore: number | undefined;
      let spaceAfter: number | undefined;
      let lineHeight: number | undefined;
      const spcBef = findDescendant(findChild(pPr, 'spcBef'), 'spcPts');
      if (spcBef?.attrs.val) spaceBefore = Math.round(parseInt(spcBef.attrs.val, 10) / 100);
      const spcAft = findDescendant(findChild(pPr, 'spcAft'), 'spcPts');
      if (spcAft?.attrs.val) spaceAfter = Math.round(parseInt(spcAft.attrs.val, 10) / 100);
      const lnSpc = findDescendant(findChild(pPr, 'lnSpc'), 'spcPct');
      if (lnSpc?.attrs.val) lineHeight = Math.round((parseInt(lnSpc.attrs.val, 10) / 100000) * 100) / 100;

      const runs: PptxTextRun[] = [];
      for (const child of pNode.children) {
        if (isFromMaster && child.localName === 'fld') {
          continue;
        }
        if (child.localName === 'r' || child.localName === 'fld') {
          const rPr = findChild(child, 'rPr');
          const tNode = findChild(child, 't');
          const rawText = collectNodeText(tNode);
          if (!rawText) continue;
          const text = sanitizeText(rawText);
          if (!text) continue;

          const isBold = rPr?.attrs.b !== undefined
            ? rPr.attrs.b === '1' || rPr.attrs.b === 'true'
            : lvlDefault?.bold ?? phTemplate?.defaultBold ?? isTitlePh;
          const isItalic = rPr?.attrs.i === '1' || rPr?.attrs.i === 'true';
          const isUnderline = Boolean(rPr?.attrs.u && rPr.attrs.u !== 'none');
          const isStrike = Boolean(rPr?.attrs.strike && rPr.attrs.strike !== 'noStrike');
          const baseline = rPr?.attrs.baseline ? parseInt(rPr.attrs.baseline, 10) : undefined;
          const fontSize = rPr?.attrs.sz
            ? Math.round(parseInt(rPr.attrs.sz, 10) / 100)
            : lvlDefault?.fontSize || fallbackFontSize;

          let color: string | undefined;
          if (rPr) {
            const rSolidFill = findChild(rPr, 'solidFill');
            if (rSolidFill) {
              color = resolveColorFromNode(rSolidFill, themeColors, colorMap);
            }
          }
          if (!color) color = lvlDefault?.color || phTemplate?.defaultColor;

          const latin = findChild(rPr, 'latin')?.attrs.typeface;
          const ea = findChild(rPr, 'ea')?.attrs.typeface;
          const fontFamily = ea || latin;

          let href: string | undefined;
          const hlink = findChild(rPr, 'hlinkClick');
          const hRelId = hlink?.attrs['r:id'] || hlink?.attrs.id;
          if (hRelId && relsMap.has(hRelId)) {
            href = relsMap.get(hRelId)!.target;
          }

          runs.push({
            text,
            bold: isBold || undefined,
            italic: isItalic || undefined,
            underline: isUnderline || undefined,
            strikethrough: isStrike || undefined,
            baseline,
            fontSize,
            color,
            fontFamily,
            href,
          });
        } else if (child.localName === 'br') {
          runs.push({ text: '\n', fontSize: fallbackFontSize });
        }
      }

      if (runs.length > 0) {
        paragraphs.push({
          runs,
          align,
          level,
          bullet: bullet || undefined,
          bulletChar,
          autoNumType,
          autoNumIndex,
          bulletColor,
          marginLeft,
          indent,
          spaceBefore,
          spaceAfter,
          lineHeight,
        });
      }
    }
  }

  // 过滤母版/模板占位提示语（如“单击此处编辑模版文本样式”、“第二级”等）
  const rawParagraphCount = paragraphs.length;
  const hasPromptParagraph = paragraphs.some(p =>
    isMasterTemplatePromptText(p.runs.map(r => r.text).join(''))
  );
  const cleanedParagraphs = paragraphs.filter(p => {
    const pText = p.runs.map(r => r.text).join('').trim();
    if (!pText) return false;
    if (isMasterTemplatePromptText(pText)) return false;
    if ((hasPromptParagraph || isFromMaster || isPlaceholder) && isMasterLevelSampleText(pText)) {
      return false;
    }
    return true;
  });

  if (rawParagraphCount > 0 && cleanedParagraphs.length === 0) {
    return null;
  }

  const effectiveBg = fillColor && fillColor !== 'transparent' ? fillColor : undefined;
  const hasVisibleShape = Boolean(
    effectiveBg ||
      fillGradient ||
      strokeColor ||
      shapeType !== 'rect' ||
      (customPaths && customPaths.length > 0)
  );

  if (cleanedParagraphs.length > 0) {
    const firstLine = cleanedParagraphs[0].runs.map(r => r.text).join('').trim().slice(0, 24);
    return {
      id: elementId,
      name: rawNodeName || (firstLine ? `文本: ${firstLine}` : '文本框'),
      type: 'text',
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      rotation: geom.rotation,
      flipH: geom.flipH,
      flipV: geom.flipV,
      hasShadow,
      isFromMaster: isFromMaster || undefined,
      shapeType: hasVisibleShape ? shapeType : undefined,
      rawPresetName,
      shapeAdjusts,
      customPaths,
      paragraphs: cleanedParagraphs,
      backgroundColor: effectiveBg,
      backgroundGradient: fillGradient,
      borderColor: strokeColor,
      borderWidth: strokeWidth,
      strokeDash,
      verticalAlign,
      padding,
    };
  }

  if (hasVisibleShape || isConnector) {
    return {
      id: elementId,
      name: rawNodeName || rawPresetName || (isConnector ? '连接线' : '矢量形状'),
      type: 'shape',
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      rotation: geom.rotation,
      flipH: geom.flipH,
      flipV: geom.flipV,
      hasShadow,
      isFromMaster: isFromMaster || undefined,
      shapeType,
      rawPresetName,
      shapeAdjusts,
      customPaths,
      fillColor: fillColor || 'transparent',
      fillGradient,
      strokeColor: strokeColor || (isConnector ? themeColors.tx1 || '#64748B' : undefined),
      strokeWidth: strokeWidth || (isConnector ? 1.5 : undefined),
      strokeDash,
      headArrow,
      tailArrow,
    };
  }

  return null;
}

function parsePicNodeFromXml(
  picNode: XmlNode,
  elementId: string,
  mediaMap: Map<string, string>,
  tx: CoordTransform,
  isFromMaster = false
): PptxElement | null {
  if (isFromMaster && extractPlaceholderMeta(picNode).isPlaceholder) {
    return null;
  }
  const spPr = findChild(picNode, 'spPr');
  const xfrm = findChild(spPr, 'xfrm');
  const geom = extractGeometryFromXfrm(xfrm, tx);

  const blipFill = findChild(picNode, 'blipFill');
  const blip = findChild(blipFill, 'blip');
  const rId = blip?.attrs['r:embed'] || blip?.attrs.embed;
  if (!rId) return null;

  const imageDataUrl = mediaMap.get(rId);
  if (!imageDataUrl) return null;

  const cNvPr = findDescendant(picNode, 'cNvPr');
  const imageAlt = cNvPr?.attrs.descr || cNvPr?.attrs.name || 'PPT 演示文稿图片';

  const srcRect = findChild(blipFill, 'srcRect');
  const imageCrop = srcRect
    ? {
        l: srcRect.attrs.l ? parseInt(srcRect.attrs.l, 10) / 1000 : undefined,
        t: srcRect.attrs.t ? parseInt(srcRect.attrs.t, 10) / 1000 : undefined,
        r: srcRect.attrs.r ? parseInt(srcRect.attrs.r, 10) / 1000 : undefined,
        b: srcRect.attrs.b ? parseInt(srcRect.attrs.b, 10) / 1000 : undefined,
      }
    : undefined;

  return {
    id: elementId,
    type: 'image',
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    rotation: geom.rotation,
    flipH: geom.flipH,
    flipV: geom.flipV,
    isFromMaster: isFromMaster || undefined,
    imageDataUrl,
    imageAlt,
    imageCrop,
  };
}

function parseChartXml(
  chartXml: string,
  themeColors: Record<string, string>,
  colorMap: Record<string, string>
): PptxChartData | null {
  const tree = parseXmlTree(chartXml);
  const plotArea = findDescendant(tree, 'plotArea');
  if (!plotArea) return null;

  const chartTitleTexts = findDescendants(findDescendant(tree, 'title'), 't')
    .map(n => sanitizeText(collectNodeText(n)).trim())
    .filter(Boolean);
  const title = chartTitleTexts.join(' ') || undefined;

  let chartType: PptxChartData['chartType'] = 'unknown';
  let chartNode: XmlNode | undefined;

  for (const child of plotArea.children) {
    const name = child.localName;
    if (name === 'barChart' || name === 'bar3DChart') {
      const barDir = findChild(child, 'barDir')?.attrs.val;
      chartType = barDir === 'bar' ? 'bar' : 'col';
      chartNode = child;
      break;
    } else if (name === 'lineChart' || name === 'line3DChart') {
      chartType = 'line';
      chartNode = child;
      break;
    } else if (name === 'areaChart' || name === 'area3DChart') {
      chartType = 'area';
      chartNode = child;
      break;
    } else if (name === 'pieChart' || name === 'pie3DChart') {
      chartType = 'pie';
      chartNode = child;
      break;
    } else if (name === 'doughnutChart') {
      chartType = 'doughnut';
      chartNode = child;
      break;
    } else if (name === 'scatterChart') {
      chartType = 'scatter';
      chartNode = child;
      break;
    }
  }

  if (!chartNode) return null;

  const serNodes = findChildren(chartNode, 'ser');
  if (serNodes.length === 0) return null;

  let categories: string[] = [];
  const series: PptxChartSeries[] = [];
  const paletteOrder = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];

  serNodes.forEach((ser, sIdx) => {
    const txNode = findChild(ser, 'tx');
    const serName =
      sanitizeText(collectNodeText(findDescendant(txNode, 'v'))).trim() ||
      sanitizeText(collectNodeText(findDescendant(txNode, 't'))).trim() ||
      `Series ${sIdx + 1}`;

    if (categories.length === 0) {
      const catNode = findChild(ser, 'cat') || findChild(ser, 'xVal');
      const ptNodes = findDescendants(catNode, 'pt');
      if (ptNodes.length > 0) {
        categories = ptNodes.map(pt => sanitizeText(collectNodeText(findChild(pt, 'v'))).trim());
      }
    }

    const valNode = findChild(ser, 'val') || findChild(ser, 'yVal');
    const valPts = findDescendants(valNode, 'pt');
    const values = valPts.map(pt => {
      const num = parseFloat(collectNodeText(findChild(pt, 'v')));
      return Number.isFinite(num) ? num : 0;
    });

    const spPr = findChild(ser, 'spPr');
    const solidFill = findChild(spPr, 'solidFill');
    const color =
      (solidFill ? resolveColorFromNode(solidFill, themeColors, colorMap) : undefined) ||
      themeColors[paletteOrder[sIdx % paletteOrder.length]];

    if (values.length > 0) {
      series.push({ name: serName, values, color });
    }
  });

  if (series.length === 0) return null;
  if (categories.length === 0) {
    categories = series[0].values.map((_, i) => `#${i + 1}`);
  }

  return {
    chartType,
    title,
    categories,
    series,
  };
}

async function parseGraphicFrameNodeFromXml(
  gfNode: XmlNode,
  elementId: string,
  zip: JSZip,
  relsMap: Map<string, RelEntry>,
  themeColors: Record<string, string>,
  colorMap: Record<string, string>,
  tx: CoordTransform,
  isFromMaster = false
): Promise<PptxElement | null> {
  if (isFromMaster && extractPlaceholderMeta(gfNode).isPlaceholder) {
    return null;
  }
  const xfrm = findChild(gfNode, 'xfrm');
  const geom = extractGeometryFromXfrm(xfrm, tx);

  const chartRef = findDescendant(gfNode, 'chart');
  if (chartRef) {
    const rId = chartRef.attrs['r:id'] || chartRef.attrs.id;
    const rel = rId ? relsMap.get(rId) : undefined;
    if (rel && !rel.targetMode) {
      const chartFile = zip.file(rel.target);
      if (chartFile) {
        const chartXml = await chartFile.async('text');
        const chartData = parseChartXml(chartXml, themeColors, colorMap);
        if (chartData) {
          return {
            id: elementId,
            type: 'chart',
            x: geom.x,
            y: geom.y,
            width: geom.width,
            height: geom.height,
            rotation: geom.rotation,
            isFromMaster: isFromMaster || undefined,
            chartData,
          };
        }
      }
    }
  }

  const tbl = findDescendant(gfNode, 'tbl');
  if (!tbl) return null;

  const tblPr = findChild(tbl, 'tblPr');
  const hasFirstRowStyle = tblPr?.attrs.firstRow === '1' || tblPr?.attrs.firstRow === 'true';
  const hasBandRowStyle = tblPr?.attrs.bandRow === '1' || tblPr?.attrs.bandRow === 'true';

  const tblGrid = findChild(tbl, 'tblGrid');
  const gridCols = findChildren(tblGrid, 'gridCol').map(c => parseInt(c.attrs.w || '0', 10));
  const totalGridW = gridCols.reduce((a, b) => a + b, 0);
  const colWidthsPct =
    totalGridW > 0 ? gridCols.map(w => Math.round((w / totalGridW) * 1000) / 10) : undefined;

  const rows: PptxTableCell[][] = [];
  const rowHeightsPt: number[] = [];
  const trNodes = findChildren(tbl, 'tr');

  trNodes.forEach((trNode, rowIndex) => {
    const hEmu = trNode.attrs.h ? parseInt(trNode.attrs.h, 10) : 0;
    if (hEmu > 0) rowHeightsPt.push(emuToPt(hEmu));

    const cells: PptxTableCell[] = [];
    for (const tcNode of findChildren(trNode, 'tc')) {
      const hMerge = tcNode.attrs.hMerge === '1' || tcNode.attrs.hMerge === 'true';
      const vMerge = tcNode.attrs.vMerge === '1' || tcNode.attrs.vMerge === 'true';
      const colSpan = tcNode.attrs.gridSpan ? parseInt(tcNode.attrs.gridSpan, 10) : undefined;
      const rowSpan = tcNode.attrs.rowSpan ? parseInt(tcNode.attrs.rowSpan, 10) : undefined;

      if (hMerge || vMerge) {
        cells.push({ text: '', mergedSkip: true });
        continue;
      }

      const cellParagraphs = findDescendants(findChild(tcNode, 'txBody'), 'p');
      const cellText = cellParagraphs
        .map(p =>
          findDescendants(p, 't')
            .map(t => sanitizeText(collectNodeText(t)))
            .join('')
            .trim()
        )
        .filter(Boolean)
        .join('\n');

      const tcPr = findChild(tcNode, 'tcPr');
      let bg: string | undefined;
      if (tcPr) {
        const solidFill = findChild(tcPr, 'solidFill');
        if (solidFill) {
          bg = resolveColorFromNode(solidFill, themeColors, colorMap);
        }
      }
      if (!bg) {
        if (rowIndex === 0 && hasFirstRowStyle) {
          bg = themeColors.accent1 ? `${themeColors.accent1}22` : '#EFF6FF';
        } else if (rowIndex > 0 && hasBandRowStyle && rowIndex % 2 === 1) {
          bg = '#F8FAFC';
        }
      }

      let vAlign: 'top' | 'middle' | 'bottom' | undefined;
      if (tcPr?.attrs.anchor === 't') vAlign = 'top';
      else if (tcPr?.attrs.anchor === 'b') vAlign = 'bottom';
      else if (tcPr?.attrs.anchor === 'ctr') vAlign = 'middle';

      let textColor: string | undefined;
      let isBold = rowIndex === 0;
      let fontSize = 14;
      let align: 'left' | 'center' | 'right' = 'left';

      const firstP = cellParagraphs[0];
      if (firstP) {
        const pPr = findChild(firstP, 'pPr');
        const resolved = resolveAlign(pPr?.attrs.algn);
        if (resolved && resolved !== 'justify') align = resolved;
        const firstRPr = findDescendant(firstP, 'rPr');
        if (firstRPr) {
          const rFill = findChild(firstRPr, 'solidFill');
          if (rFill) textColor = resolveColorFromNode(rFill, themeColors, colorMap);
          if (firstRPr.attrs.b === '1' || firstRPr.attrs.b === 'true') isBold = true;
          if (firstRPr.attrs.sz) fontSize = Math.round(parseInt(firstRPr.attrs.sz, 10) / 100);
        }
      }

      cells.push({
        text: cellText,
        isHeader: rowIndex === 0,
        background: bg,
        color: textColor,
        align,
        vAlign,
        bold: isBold,
        fontSize,
        colSpan: colSpan && colSpan > 1 ? colSpan : undefined,
        rowSpan: rowSpan && rowSpan > 1 ? rowSpan : undefined,
      });
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return null;

  return {
    id: elementId,
    type: 'table',
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    rotation: geom.rotation,
    isFromMaster: isFromMaster || undefined,
    tableRows: rows,
    colWidthsPct,
    rowHeightsPt: rowHeightsPt.length === rows.length ? rowHeightsPt : undefined,
  };
}

function unwrapAlternateContent(children: XmlNode[]): XmlNode[] {
  const out: XmlNode[] = [];
  for (const child of children) {
    if (child.localName === 'AlternateContent') {
      const fallback = findChild(child, 'Fallback');
      const choice = findChild(child, 'Choice');
      const chosen = fallback || choice;
      if (chosen) out.push(...unwrapAlternateContent(chosen.children));
    } else {
      out.push(child);
    }
  }
  return out;
}

async function parseContainerElements(
  spTreeNode: XmlNode | undefined,
  idPrefix: string,
  zip: JSZip,
  relsMap: Map<string, RelEntry>,
  mediaMap: Map<string, string>,
  themeColors: Record<string, string>,
  colorMap: Record<string, string>,
  tx: CoordTransform,
  layoutCtx?: MasterOrLayoutContext,
  masterCtx?: MasterOrLayoutContext,
  isFromMaster = false,
  layerTier: 'master' | 'layout' | 'slide' = 'slide',
  groupPath: string[] = []
): Promise<PptxElement[]> {
  if (!spTreeNode) return [];
  const elements: PptxElement[] = [];
  let idx = 0;

  const attachHierarchyMeta = (el: PptxElement): PptxElement => ({
    ...el,
    layerTier,
    groupPath: groupPath.length > 0 ? groupPath : undefined,
  });

  const nodes = unwrapAlternateContent(spTreeNode.children);
  for (const node of nodes) {
    if (isXmlNodeHidden(node)) continue;
    const name = node.localName;
    const elId = `${idPrefix}-${name}-${idx++}`;

    if (name === 'sp' || name === 'cxnSp') {
      const el = parseSpNodeFromXml(
        node,
        elId,
        themeColors,
        colorMap,
        relsMap,
        tx,
        layoutCtx,
        masterCtx,
        isFromMaster
      );
      if (el) elements.push(attachHierarchyMeta(el));
    } else if (name === 'pic') {
      const el = parsePicNodeFromXml(node, elId, mediaMap, tx, isFromMaster);
      if (el) {
        elements.push(
          attachHierarchyMeta({
            ...el,
            name: el.name || el.imageAlt || '图片图元',
          })
        );
      }
    } else if (name === 'graphicFrame') {
      const el = await parseGraphicFrameNodeFromXml(
        node,
        elId,
        zip,
        relsMap,
        themeColors,
        colorMap,
        tx,
        isFromMaster
      );
      if (el) {
        const gfName = findDescendant(node, 'cNvPr')?.attrs.name?.trim();
        elements.push(
          attachHierarchyMeta({
            ...el,
            name: gfName || (el.type === 'chart' ? el.chartData?.title || '数据图表' : '数据表格'),
          })
        );
      }
    } else if (name === 'grpSp') {
      const grpNv = findChild(node, 'nvGrpSpPr');
      const grpName =
        findChild(grpNv, 'cNvPr')?.attrs.name?.trim() || `组合图形 #${idx}`;
      const grpSpPr = findChild(node, 'grpSpPr');
      const xfrm = findChild(grpSpPr, 'xfrm');
      const grpGeom = extractGeometryFromXfrm(xfrm, tx);
      const chOff = findChild(xfrm, 'chOff');
      const chExt = findChild(xfrm, 'chExt');

      let childTransform = tx;
      if (xfrm && chOff && chExt) {
        const off = findChild(xfrm, 'off');
        const ext = findChild(xfrm, 'ext');
        const gX = off?.attrs.x ? emuToPt(parseInt(off.attrs.x, 10)) : 0;
        const gY = off?.attrs.y ? emuToPt(parseInt(off.attrs.y, 10)) : 0;
        const gW = ext?.attrs.cx ? emuToPt(parseInt(ext.attrs.cx, 10)) : 1;
        const gH = ext?.attrs.cy ? emuToPt(parseInt(ext.attrs.cy, 10)) : 1;

        const chX = chOff.attrs.x ? emuToPt(parseInt(chOff.attrs.x, 10)) : 0;
        const chY = chOff.attrs.y ? emuToPt(parseInt(chOff.attrs.y, 10)) : 0;
        const chW = chExt.attrs.cx ? emuToPt(parseInt(chExt.attrs.cx, 10)) : gW;
        const chH = chExt.attrs.cy ? emuToPt(parseInt(chExt.attrs.cy, 10)) : gH;

        const localScaleX = chW > 0 ? (gW / chW) * tx.scaleX : tx.scaleX;
        const localScaleY = chH > 0 ? (gH / chH) * tx.scaleY : tx.scaleY;

        childTransform = {
          offsetX: tx.offsetX + gX * tx.scaleX - chX * localScaleX,
          offsetY: tx.offsetY + gY * tx.scaleY - chY * localScaleY,
          scaleX: localScaleX,
          scaleY: localScaleY,
        };
      } else if (grpGeom.hasExplicitGeometry) {
        childTransform = {
          ...tx,
          offsetX: grpGeom.x,
          offsetY: grpGeom.y,
        };
      }

      const subEls = await parseContainerElements(
        node,
        elId,
        zip,
        relsMap,
        mediaMap,
        themeColors,
        colorMap,
        childTransform,
        layoutCtx,
        masterCtx,
        isFromMaster,
        layerTier,
        [...groupPath, grpName]
      );
      // 若外层组合带有整体旋转或翻转，向未显式声明旋转/翻转的子图元继承
      const normalizedSubEls = subEls.map(sub => ({
        ...sub,
        rotation: sub.rotation ?? grpGeom.rotation,
        flipH: sub.flipH ?? grpGeom.flipH,
        flipV: sub.flipV ?? grpGeom.flipV,
      }));
      elements.push(...normalizedSubEls);
    }
  }

  return elements;
}

/**
 * 梳理并规范化幻灯片内所有图元的渲染层级结构 (Z-Order Layer Hierarchy)
 * 保证：母版底层 (master) -> 版式装饰层 (layout) -> 幻灯片全屏底板形状 -> 幻灯片前景图元 (slide)，
 * 并为每个元素分配从 1 递增的确定性 zIndex，杜绝前景文字被背景色块遮挡或 CSS 堆叠上下文串层
 */
export function sortAndAssignSlideLayerHierarchy(
  masterElements: PptxElement[],
  layoutElements: PptxElement[],
  slideElements: PptxElement[],
  slideWidth: number,
  slideHeight: number
): PptxElement[] {
  const slideArea = Math.max(1, slideWidth * slideHeight);

  // 识别幻灯片层中被用作全画幅背景底板的无字纯图形/底图（覆盖画布 >= 80% 且无文本）
  const markedSlideEls = slideElements.map(el => {
    const elArea = Math.max(0, el.width * el.height);
    const isFullBleedBackdrop =
      (el.type === 'shape' || el.type === 'image') &&
      (!el.paragraphs || el.paragraphs.length === 0) &&
      elArea / slideArea >= 0.8 &&
      el.x <= slideWidth * 0.08 &&
      el.y <= slideHeight * 0.08;
    return {
      ...el,
      layerTier: 'slide' as const,
      isBackgroundShape: isFullBleedBackdrop || undefined,
    };
  });

  const slideBackdropEls = markedSlideEls.filter(el => el.isBackgroundShape);
  const slideForegroundEls = markedSlideEls.filter(el => !el.isBackgroundShape);

  const ordered = [
    ...masterElements.map(el => ({ ...el, layerTier: 'master' as const, isFromMaster: true })),
    ...layoutElements.map(el => ({ ...el, layerTier: 'layout' as const, isFromMaster: true })),
    ...slideBackdropEls,
    ...slideForegroundEls,
  ];

  return ordered.map((el, idx) => ({
    ...el,
    zIndex: idx + 1,
  }));
}

async function loadMasterOrLayoutContext(
  zip: JSZip,
  partPath: string,
  themeColors: Record<string, string>,
  inheritedColorMap: Record<string, string>,
  parentCtx?: MasterOrLayoutContext
): Promise<MasterOrLayoutContext | undefined> {
  const file = zip.file(partPath);
  if (!file) return undefined;

  const xml = await file.async('text');
  const tree = parseXmlTree(xml);
  const rootEl = findChild(tree, 'sldMaster') || findChild(tree, 'sldLayout');
  if (!rootEl) return undefined;

  const showMasterSp = rootEl.attrs.showMasterSp !== '0' && rootEl.attrs.showMasterSp !== 'false';

  const relsMap = await readRelsMap(zip, partPath);
  const mediaMap = await buildMediaDataMap(zip, relsMap);

  const clrMapNode = findChild(rootEl, 'clrMap') || findDescendant(rootEl, 'clrMapOvr');
  const colorMap = parseColorMapNode(
    clrMapNode?.localName === 'clrMapOvr' ? findChild(clrMapNode, 'overrideClrMapping') : clrMapNode,
    inheritedColorMap
  );

  const cSld = findChild(rootEl, 'cSld');
  const layoutName = cSld?.attrs.name;
  const bg = parseBackgroundFromCsld(cSld, themeColors, colorMap, mediaMap);

  const txStyles = findChild(rootEl, 'txStyles');
  let titleDefaultFontSize = parentCtx?.titleDefaultFontSize;
  let bodyDefaultFontSize = parentCtx?.bodyDefaultFontSize;
  if (txStyles) {
    const titleLvl1 = findChild(findChild(txStyles, 'titleStyle'), 'lvl1pPr');
    const titleSz = findChild(titleLvl1, 'defRPr')?.attrs.sz;
    if (titleSz) titleDefaultFontSize = Math.round(parseInt(titleSz, 10) / 100);

    const bodyLvl1 = findChild(findChild(txStyles, 'bodyStyle'), 'lvl1pPr');
    const bodySz = findChild(bodyLvl1, 'defRPr')?.attrs.sz;
    if (bodySz) bodyDefaultFontSize = Math.round(parseInt(bodySz, 10) / 100);
  }

  const placeholders = new Map<string, PlaceholderTemplate>(parentCtx?.placeholders);
  const spTree = findChild(cSld, 'spTree');

  if (spTree) {
    for (const sp of findChildren(spTree, 'sp')) {
      const { isPlaceholder, phType, phIdx } = extractPlaceholderMeta(sp);
      if (!isPlaceholder) continue;
      const spPr = findChild(sp, 'spPr');
      const xfrm = findChild(spPr, 'xfrm');
      const geom = extractGeometryFromXfrm(xfrm);
      const txBody = findChild(sp, 'txBody');
      const lstStyle = findChild(txBody, 'lstStyle');
      const lvl1 = findChild(lstStyle, 'lvl1pPr') || findDescendant(txBody, 'pPr');
      const defRPr = findChild(lvl1, 'defRPr') || findDescendant(txBody, 'rPr');
      const defFill = defRPr ? findChild(defRPr, 'solidFill') : undefined;

      const parentMatch =
        (phType && phIdx ? parentCtx?.placeholders.get(`type:${phType}:idx:${phIdx}`) : undefined) ||
        (phType ? parentCtx?.placeholders.get(`type:${phType}`) : undefined) ||
        (phIdx ? parentCtx?.placeholders.get(`idx:${phIdx}`) : undefined) ||
        (!phType ? parentCtx?.placeholders.get('type:body') : undefined);

      const tpl: PlaceholderTemplate = {
        key: phType ? `type:${phType}` : phIdx ? `idx:${phIdx}` : 'type:body',
        geometry: geom.hasExplicitGeometry ? geom : parentMatch?.geometry,
        defaultFontSize: defRPr?.attrs.sz
          ? Math.round(parseInt(defRPr.attrs.sz, 10) / 100)
          : parentMatch?.defaultFontSize,
        defaultColor: defFill
          ? resolveColorFromNode(defFill, themeColors, colorMap)
          : parentMatch?.defaultColor,
        defaultBold:
          defRPr?.attrs.b !== undefined
            ? defRPr.attrs.b === '1' || defRPr.attrs.b === 'true'
            : parentMatch?.defaultBold,
        defaultAlign: resolveAlign(lvl1?.attrs.algn) || parentMatch?.defaultAlign,
        defaultBullet: Boolean(lvl1 && findChild(lvl1, 'buChar')) || parentMatch?.defaultBullet,
      };

      if (phType && phIdx) placeholders.set(`type:${phType}:idx:${phIdx}`, tpl);
      if (phType) placeholders.set(`type:${phType}`, tpl);
      if (phIdx) placeholders.set(`idx:${phIdx}`, tpl);
      if (!phType && !phIdx) placeholders.set('type:body', tpl);
    }
  }

  const isMasterPart = rootEl.localName === 'sldMaster';
  const decorativeElements = await parseContainerElements(
    spTree,
    `master-${partPath.replace(/[^a-zA-Z0-9]/g, '')}`,
    zip,
    relsMap,
    mediaMap,
    themeColors,
    colorMap,
    IDENTITY_TRANSFORM,
    undefined,
    parentCtx,
    true,
    isMasterPart ? 'master' : 'layout'
  );

  return {
    backgroundColor: bg.backgroundColor || parentCtx?.backgroundColor,
    backgroundGradient: bg.backgroundGradient || parentCtx?.backgroundGradient,
    backgroundImage: bg.backgroundImage || parentCtx?.backgroundImage,
    colorMap,
    placeholders,
    decorativeElements,
    titleDefaultFontSize,
    bodyDefaultFontSize,
    layoutName,
    showMasterSp,
  };
}

/**
 * 动态生成规范的样例 PPTX 电子幻灯片包 (含母版、渐变、组合箭头、图片、矩阵表格、原生图表与备注)
 */
export async function generateSamplePptxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>
  <Override PartName="/ppt/notesSlides/notesSlide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>
  <Override PartName="/ppt/notesSlides/notesSlide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );

  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>OmniView PowerPoint 架构演示文稿</dc:title>
  <dc:creator>OmniView Architecture Team</dc:creator>
  <dc:description>OmniView 纯离线 OOXML 矢量演播引擎 (支持母版继承、矢量形状与原生图表)</dc:description>
</cp:coreProperties>`
  );

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

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

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

  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:gradFill>
          <a:gsLst>
            <a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs>
            <a:gs pos="100000"><a:srgbClr val="F8FAFC"/></a:gs>
          </a:gsLst>
          <a:lin ang="5400000" scaled="1"/>
        </a:gradFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title Placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="762000" y="508000"/><a:ext cx="10668000" cy="762000"/></a:xfrm></p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3200" b="1"/></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr algn="l"><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle>
  </p:txStyles>
</p:sldMaster>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" type="title">
  <p:cSld name="标准母版版式">
    <p:spTree/>
  </p:cSld>
</p:sldLayout>`
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  const sampleDotPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfQHzD1RmbwAAAABJRU5ErkJggg==';
  zip.file('ppt/media/image1.png', sampleDotPngBase64, { base64: true });

  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slides/_rels/slide2.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
  <Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide2.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slides/_rels/slide3.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdChart1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide3.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1016000" y="1651000"/><a:ext cx="10160000" cy="1420000"/></a:xfrm>
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
          <a:xfrm><a:off x="1016000" y="3300000"/><a:ext cx="10160000" cy="762000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr sz="2100"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr>
              <a:t>纯前端离线 OOXML AST 解析引擎 · 母版继承 · 组合箭头 · 原生图表高保真演播</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1016000" y="5400000"/><a:ext cx="10160000" cy="95250"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
        </p:spPr>
      </p:sp>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1016000" y="4550000"/><a:ext cx="2600000" cy="520000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:schemeClr val="accent1"><a:alpha val="14000"/></a:schemeClr></a:solidFill>
          <a:ln w="12700"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:p><a:pPr algn="ctr"/><a:r><a:rPr b="1" sz="1400"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:rPr><a:t>ECMA-376 Vector Engine</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
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
          <a:xfrm><a:off x="762000" y="1460000"/><a:ext cx="7400000" cy="3600000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:pPr marL="228600"><a:buChar char="•"/></a:pPr>
            <a:r><a:rPr b="1" sz="1900"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:rPr><a:t>纯离线 AST 内核解析：</a:t></a:r>
            <a:r><a:rPr sz="1700"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>精确还原嵌套组合图形、母版版式继承与主题色调运算。</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr marL="228600"><a:buChar char="•"/></a:pPr>
            <a:r><a:rPr b="1" sz="1900"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:rPr><a:t>等比物理舞台缩放：</a:t></a:r>
            <a:r><a:rPr sz="1700"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>自适应 16:9 / 4:3 画幅，文字与图元 1:1 比例零错位。</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr marL="228600"><a:buChar char="•"/></a:pPr>
            <a:r><a:rPr b="1" sz="1900"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:rPr><a:t>专业演播工作台：</a:t></a:r>
            <a:r><a:rPr sz="1700"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>支持真实缩略图、全文搜索、平铺总览、激光笔与 PDF 打印。</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:grpSp>
        <p:grpSpPr>
          <a:xfrm>
            <a:off x="762000" y="5200000"/>
            <a:ext cx="7400000" cy="960000"/>
            <a:chOff x="0" y="0"/>
            <a:chExt cx="7400000" cy="960000"/>
          </a:xfrm>
        </p:grpSpPr>
        <p:sp>
          <p:spPr>
            <a:xfrm><a:off x="0" y="100000"/><a:ext cx="2100000" cy="760000"/></a:xfrm>
            <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
            <a:solidFill><a:schemeClr val="accent1"><a:tint val="20000"/></a:schemeClr></a:solidFill>
            <a:ln w="12700"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>
          </p:spPr>
          <p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/><a:r><a:rPr b="1" sz="1400"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>JSZip OOXML 解包</a:t></a:r></a:p></a:txBody>
        </p:sp>
        <p:sp>
          <p:spPr>
            <a:xfrm><a:off x="2250000" y="340000"/><a:ext cx="420000" cy="280000"/></a:xfrm>
            <a:prstGeom prst="rightArrow"><a:avLst/></a:prstGeom>
            <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
          </p:spPr>
        </p:sp>
        <p:sp>
          <p:spPr>
            <a:xfrm><a:off x="2820000" y="100000"/><a:ext cx="2100000" cy="760000"/></a:xfrm>
            <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
            <a:solidFill><a:schemeClr val="accent2"><a:tint val="20000"/></a:schemeClr></a:solidFill>
            <a:ln w="12700"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:ln>
          </p:spPr>
          <p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/><a:r><a:rPr b="1" sz="1400"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>XML AST + 母版合并</a:t></a:r></a:p></a:txBody>
        </p:sp>
        <p:sp>
          <p:spPr>
            <a:xfrm><a:off x="5070000" y="340000"/><a:ext cx="420000" cy="280000"/></a:xfrm>
            <a:prstGeom prst="rightArrow"><a:avLst/></a:prstGeom>
            <a:solidFill><a:schemeClr val="accent2"/></a:solidFill>
          </p:spPr>
        </p:sp>
        <p:sp>
          <p:spPr>
            <a:xfrm><a:off x="5640000" y="100000"/><a:ext cx="1760000" cy="760000"/></a:xfrm>
            <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
            <a:solidFill><a:schemeClr val="accent3"><a:tint val="20000"/></a:schemeClr></a:solidFill>
            <a:ln w="12700"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:ln>
          </p:spPr>
          <p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/><a:r><a:rPr b="1" sz="1400"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>1:1 等比舞台</a:t></a:r></a:p></a:txBody>
        </p:sp>
      </p:grpSp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="5" name="架构示意图"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdImg1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="8750000" y="1700000"/><a:ext cx="2680000" cy="2680000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  zip.file(
    'ppt/slides/slide3.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="3200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>特性支持矩阵与性能指标</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="6" name="支持矩阵表格"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="762000" y="1480000"/><a:ext cx="5400000" cy="3900000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                <a:gridCol w="1600000"/>
                <a:gridCol w="2000000"/>
                <a:gridCol w="1800000"/>
              </a:tblGrid>
              <a:tr h="560000">
                <a:tc><a:txBody><a:p><a:r><a:rPr b="1" sz="1400"/><a:t>格式类型</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EFF6FF"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:rPr b="1" sz="1400"/><a:t>渲染引擎模式</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EFF6FF"/></a:solidFill></a:tcPr></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:rPr b="1" sz="1400"/><a:t>离线安全性</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EFF6FF"/></a:solidFill></a:tcPr></a:tc>
              </a:tr>
              <a:tr h="500000">
                <a:tc><a:txBody><a:p><a:r><a:rPr sz="1300"/><a:t>PowerPoint (.pptx)</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:rPr sz="1300"/><a:t>OOXML AST 矢量引擎</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:rPr sz="1300"/><a:t>100% 离线沙箱</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
              <a:tr h="500000">
                <a:tc><a:txBody><a:p><a:r><a:rPr sz="1300"/><a:t>Word (.docx)</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:rPr sz="1300"/><a:t>流式与 A4 分页引擎</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:p><a:r><a:rPr sz="1300"/><a:t>DOMPurify 清洗</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="7" name="解析性能图表"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="6460000" y="1480000"/><a:ext cx="5000000" cy="3900000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart r:id="rIdChart1"/>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  zip.file(
    'ppt/charts/chart1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>各格式解包耗时对比 (ms)</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>AST 解析引擎</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></c:spPr>
          <c:cat><c:strRef><c:strCache><c:ptCount val="3"/><c:pt idx="0"><c:v>PPTX</c:v></c:pt><c:pt idx="1"><c:v>DOCX</c:v></c:pt><c:pt idx="2"><c:v>XLSX</c:v></c:pt></c:strCache></c:strRef></c:cat>
          <c:val><c:numRef><c:numCache><c:ptCount val="3"/><c:pt idx="0"><c:v>18</c:v></c:pt><c:pt idx="1"><c:v>24</c:v></c:pt><c:pt idx="2"><c:v>15</c:v></c:pt></c:numCache></c:numRef></c:val>
        </c:ser>
        <c:ser>
          <c:idx val="1"/><c:order val="1"/>
          <c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>传统转换服务</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></c:spPr>
          <c:val><c:numRef><c:numCache><c:ptCount val="3"/><c:pt idx="0"><c:v>85</c:v></c:pt><c:pt idx="1"><c:v>96</c:v></c:pt><c:pt idx="2"><c:v>64</c:v></c:pt></c:numCache></c:numRef></c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`
  );

  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>【开场演讲提示】欢迎体验 OmniView 原生 PPTX 矢量幻灯片工作台！本演示文稿由纯 TS OOXML AST 引擎实时解构，支持母版继承、原生图表、真实缩略图与全屏激光笔演播。</a:t></a:r></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`
  );

  zip.file(
    'ppt/notesSlides/notesSlide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>【架构讲解要点】重点展示嵌套组合图形 (grpSp)、右向箭头矢量图形与项目符号列表的 1:1 比例还原能力。</a:t></a:r></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`
  );

  zip.file(
    'ppt/notesSlides/notesSlide3.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>【数据与互动建议】可按下 Ctrl+F 检索幻灯片与备注内容，点击「平铺总览」快速定位任意页面，或按下 F5 进入全屏演播模式。</a:t></a:r></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`
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
        const res = await parsePptx(await generateSamplePptxBytes(), true);
        return { ...res, isFallbackUsed: true };
      }
    } else {
      const res = await parsePptx(await generateSamplePptxBytes(), true);
      return { ...res, isFallbackUsed: true };
    }
  } else if (data instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(data);
  } else {
    rawBytes = data;
  }

  try {
    const zip = await JSZip.loadAsync(rawBytes);
    const parseWarnings: string[] = [];

    const metadata: PptxMetadata = {
      title: 'PowerPoint 演示文稿',
      slideCount: 0,
      width: 960,
      height: 540,
      aspectRatio: '16:9',
      notesCount: 0,
      chartCount: 0,
    };

    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const xml = await coreFile.async('text');
      const coreTree = parseXmlTree(xml);
      const titleNode = findDescendant(coreTree, 'title');
      const creatorNode = findDescendant(coreTree, 'creator');
      const descNode = findDescendant(coreTree, 'description');
      if (titleNode) {
        const t = sanitizeText(collectNodeText(titleNode)).trim();
        if (t) metadata.title = t;
      }
      if (creatorNode) metadata.creator = sanitizeText(collectNodeText(creatorNode)).trim();
      if (descNode) metadata.description = sanitizeText(collectNodeText(descNode)).trim();
    }

    const presPath = 'ppt/presentation.xml';
    const presFile = zip.file(presPath);
    const presRels = await readRelsMap(zip, presPath);
    let orderedSlidePaths: string[] = [];
    let defaultColorMap = { ...DEFAULT_COLOR_MAP };

    if (presFile) {
      const presXml = await presFile.async('text');
      const presTree = parseXmlTree(presXml);
      const sldSz = findDescendant(presTree, 'sldSz');
      if (sldSz?.attrs.cx && sldSz?.attrs.cy) {
        const cx = emuToPt(parseInt(sldSz.attrs.cx, 10));
        const cy = emuToPt(parseInt(sldSz.attrs.cy, 10));
        if (cx > 0 && cy > 0) {
          metadata.width = cx;
          metadata.height = cy;
          const ratio = cx / cy;
          if (Math.abs(ratio - 16 / 9) < 0.1) metadata.aspectRatio = '16:9';
          else if (Math.abs(ratio - 4 / 3) < 0.1) metadata.aspectRatio = '4:3';
          else metadata.aspectRatio = 'custom';
        }
      }

      const defaultClrMapNode = findDescendant(presTree, 'defaultTextStyle')
        ? undefined
        : findDescendant(presTree, 'clrMap');
      defaultColorMap = parseColorMapNode(defaultClrMapNode, defaultColorMap);

      const sldIdLst = findDescendant(presTree, 'sldIdLst');
      if (sldIdLst) {
        for (const sldId of findChildren(sldIdLst, 'sldId')) {
          const rId = sldId.attrs['r:id'] || sldId.attrs.id;
          const relKey = sldId.attrs['r:id'] || (rId && presRels.has(rId) ? rId : undefined);
          if (relKey && presRels.has(relKey)) {
            const target = presRels.get(relKey)!.target;
            if (zip.file(target)) orderedSlidePaths.push(target);
          }
        }
      }
    }

    if (orderedSlidePaths.length === 0) {
      orderedSlidePaths = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10));
    }

    let themePath = 'ppt/theme/theme1.xml';
    for (const rel of presRels.values()) {
      if (rel.type.toLowerCase().includes('/theme') && zip.file(rel.target)) {
        themePath = rel.target;
        break;
      }
    }
    let themeColors = { ...DEFAULT_THEME_COLORS };
    const themeFile = zip.file(themePath);
    if (themeFile) {
      const parsedTheme = parseThemeColorsFromXml(await themeFile.async('text'));
      themeColors = parsedTheme.colors;
    }

    const masterCache = new Map<string, MasterOrLayoutContext | undefined>();
    const layoutCache = new Map<string, MasterOrLayoutContext | undefined>();
    const slides: PptxSlide[] = [];

    for (let i = 0; i < orderedSlidePaths.length; i++) {
      const slidePath = orderedSlidePaths[i];
      const slideFile = zip.file(slidePath);
      if (!slideFile) continue;

      const slideXml = await slideFile.async('text');
      const slideTree = parseXmlTree(slideXml);
      const sldNode = findChild(slideTree, 'sld');
      const relsMap = await readRelsMap(zip, slidePath);
      const mediaMap = await buildMediaDataMap(zip, relsMap);

      let layoutCtx: MasterOrLayoutContext | undefined;
      let masterCtx: MasterOrLayoutContext | undefined;

      let layoutPath: string | undefined;
      for (const rel of relsMap.values()) {
        if (rel.type.toLowerCase().includes('/slidelayout')) {
          layoutPath = rel.target;
          break;
        }
      }

      if (layoutPath) {
        if (!layoutCache.has(layoutPath)) {
          const layoutRels = await readRelsMap(zip, layoutPath);
          let masterPath: string | undefined;
          for (const rel of layoutRels.values()) {
            if (rel.type.toLowerCase().includes('/slidemaster')) {
              masterPath = rel.target;
              break;
            }
          }
          if (masterPath) {
            if (!masterCache.has(masterPath)) {
              masterCache.set(
                masterPath,
                await loadMasterOrLayoutContext(zip, masterPath, themeColors, defaultColorMap)
              );
            }
            masterCtx = masterCache.get(masterPath);
          }
          layoutCache.set(
            layoutPath,
            await loadMasterOrLayoutContext(
              zip,
              layoutPath,
              themeColors,
              masterCtx?.colorMap || defaultColorMap,
              masterCtx
            )
          );
        }
        layoutCtx = layoutCache.get(layoutPath);
        if (!masterCtx) {
          const layoutRels = await readRelsMap(zip, layoutPath);
          for (const rel of layoutRels.values()) {
            if (rel.type.toLowerCase().includes('/slidemaster')) {
              masterCtx = masterCache.get(rel.target);
              break;
            }
          }
        }
      }

      const clrMapOvr = findChild(sldNode, 'clrMapOvr');
      const slideColorMap = parseColorMapNode(
        findChild(clrMapOvr, 'overrideClrMapping'),
        layoutCtx?.colorMap || masterCtx?.colorMap || defaultColorMap
      );

      const cSld = findChild(sldNode, 'cSld');
      const slideBg = parseBackgroundFromCsld(cSld, themeColors, slideColorMap, mediaMap);
      const backgroundColor =
        slideBg.backgroundColor || (!slideBg.backgroundGradient && !slideBg.backgroundImage ? layoutCtx?.backgroundColor : undefined);
      const backgroundGradient =
        slideBg.backgroundGradient || (!slideBg.backgroundColor && !slideBg.backgroundImage ? layoutCtx?.backgroundGradient : undefined);
      const backgroundImage =
        slideBg.backgroundImage || (!slideBg.backgroundColor && !slideBg.backgroundGradient ? layoutCtx?.backgroundImage : undefined);

      const showMasterSp = sldNode?.attrs.showMasterSp !== '0' && sldNode?.attrs.showMasterSp !== 'false';
      const layoutAllowsMasterSp = layoutCtx ? layoutCtx.showMasterSp !== false : true;
      const masterDecorations: PptxElement[] =
        showMasterSp && layoutAllowsMasterSp && masterCtx?.decorativeElements.length
          ? masterCtx.decorativeElements.map((el, idx) => ({
              ...el,
              id: `s${i}-m-${idx}-${el.id}`,
              layerTier: 'master' as const,
            }))
          : [];
      const layoutDecorations: PptxElement[] =
        showMasterSp && layoutCtx?.decorativeElements.length
          ? layoutCtx.decorativeElements.map((el, idx) => ({
              ...el,
              id: `s${i}-l-${idx}-${el.id}`,
              layerTier: 'layout' as const,
            }))
          : [];

      const spTree = findChild(cSld, 'spTree');
      const slideElements = await parseContainerElements(
        spTree,
        `el-${i}`,
        zip,
        relsMap,
        mediaMap,
        themeColors,
        slideColorMap,
        IDENTITY_TRANSFORM,
        layoutCtx,
        masterCtx,
        false,
        'slide'
      );

      const elements = sortAndAssignSlideLayerHierarchy(
        masterDecorations,
        layoutDecorations,
        slideElements,
        metadata.width,
        metadata.height
      );

      metadata.chartCount = (metadata.chartCount || 0) + elements.filter(e => e.type === 'chart').length;

      let slideTitle = `幻灯片 ${i + 1}`;
      for (const el of slideElements) {
        if (el.type === 'text' && el.paragraphs && el.paragraphs.length > 0) {
          const text = el.paragraphs[0].runs.map(r => r.text).join('').trim();
          if (text) {
            slideTitle = text.slice(0, 42);
            break;
          }
        }
      }

      let notes: string | undefined;
      let notesTargetPath: string | undefined;
      for (const rel of relsMap.values()) {
        if (rel.type.toLowerCase().includes('/notesslide')) {
          notesTargetPath = rel.target;
          break;
        }
      }
      if (!notesTargetPath) {
        notesTargetPath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
      }
      const noteFile = zip.file(notesTargetPath);
      if (noteFile) {
        const noteXml = await noteFile.async('text');
        const noteTree = parseXmlTree(noteXml);
        const noteParas: string[] = [];
        for (const sp of findDescendants(noteTree, 'sp')) {
          const { phType } = extractPlaceholderMeta(sp);
          if (
            phType === 'sldImg' ||
            phType === 'sldNum' ||
            phType === 'dt' ||
            phType === 'hdr' ||
            phType === 'ftr'
          ) {
            continue;
          }
          const txBody = findChild(sp, 'txBody');
          if (!txBody) continue;
          for (const p of findChildren(txBody, 'p')) {
            const pText = findChildren(p, 'r')
              .map(r => sanitizeText(collectNodeText(findChild(r, 't'))))
              .join('')
              .trim();
            if (pText && !isMasterTemplatePromptText(pText) && !isMasterLevelSampleText(pText)) {
              noteParas.push(pText);
            }
          }
        }
        if (noteParas.length > 0) {
          notes = noteParas.join('\n');
          metadata.notesCount = (metadata.notesCount || 0) + 1;
        }
      }

      const isHidden = sldNode?.attrs.show === '0' || sldNode?.attrs.show === 'false';

      slides.push({
        index: i,
        slideNumber: i + 1,
        title: slideTitle,
        elements,
        backgroundColor,
        backgroundGradient,
        backgroundImage,
        notes,
        isHidden: isHidden || undefined,
        layoutName: layoutCtx?.layoutName,
        rawXml: slideXml,
      });
    }

    metadata.slideCount = slides.length;

    if (slides.length === 0) {
      if (!isFallback) {
        const res = await parsePptx(await generateSamplePptxBytes(), true);
        return { ...res, isFallbackUsed: true, parseWarnings };
      }
    }

    return {
      metadata,
      slides,
      isValid: true,
      isFallbackUsed: isFallback || undefined,
      parseWarnings: parseWarnings.length > 0 ? parseWarnings : undefined,
    };
  } catch (err) {
    console.warn('[PptxEngine] 加载 PPTX 异常，降级至样例文稿:', err);
    if (!isFallback) {
      const res = await parsePptx(await generateSamplePptxBytes(), true);
      return { ...res, isFallbackUsed: true };
    }
    return {
      metadata: { title: 'PowerPoint 演示文稿', slideCount: 0, width: 960, height: 540, aspectRatio: '16:9' },
      slides: [],
      isValid: false,
      isFallbackUsed: true,
    };
  }
}

/**
 * 将解析后的 PPTX 演示文稿导出为结构化 Markdown 文本（含标题、要点、表格、图表数据与演讲者备注）
 */
export function pptxToMarkdown(presentation: ParsedPptxPresentation): string {
  const lines: string[] = [];
  const docTitle = presentation.metadata.title || 'PowerPoint 演示文稿';
  lines.push(`# ${docTitle}`);
  if (presentation.metadata.creator) {
    lines.push(`> 作者：${presentation.metadata.creator}`);
  }
  lines.push('');

  for (const slide of presentation.slides) {
    lines.push(`---`);
    lines.push(`## ${slide.index + 1}. ${slide.title}`);
    lines.push('');

    for (const el of slide.elements) {
      if (el.isFromMaster) continue;
      if (el.type === 'text' && el.paragraphs) {
        for (const p of el.paragraphs) {
          const text = p.runs.map(r => r.text).join('').trim();
          if (!text) continue;
          const indent = '  '.repeat(Math.max(0, p.level || 0));
          if (p.autoNumIndex !== undefined) {
            lines.push(`${indent}${p.autoNumIndex}. ${text}`);
          } else if (p.bullet) {
            lines.push(`${indent}- ${text}`);
          } else {
            lines.push(text);
          }
        }
        lines.push('');
      } else if (el.type === 'table' && el.tableRows && el.tableRows.length > 0) {
        const visibleRows = el.tableRows.map(r => r.filter(c => !c.mergedSkip));
        if (visibleRows.length > 0 && visibleRows[0].length > 0) {
          const header = visibleRows[0].map(c => c.text.replace(/\n/g, ' '));
          lines.push(`| ${header.join(' | ')} |`);
          lines.push(`| ${header.map(() => '---').join(' | ')} |`);
          for (let rIdx = 1; rIdx < visibleRows.length; rIdx++) {
            const rowVals = visibleRows[rIdx].map(c => c.text.replace(/\n/g, ' '));
            lines.push(`| ${rowVals.join(' | ')} |`);
          }
          lines.push('');
        }
      } else if (el.type === 'chart' && el.chartData) {
        lines.push(`**📊 图表：${el.chartData.title || el.chartData.chartType}**`);
        const cols = ['类别', ...el.chartData.series.map(s => s.name)];
        lines.push(`| ${cols.join(' | ')} |`);
        lines.push(`| ${cols.map(() => '---').join(' | ')} |`);
        el.chartData.categories.forEach((cat, idx) => {
          const vals = el.chartData!.series.map(s => String(s.values[idx] ?? ''));
          lines.push(`| ${cat} | ${vals.join(' | ')} |`);
        });
        lines.push('');
      }
    }

    if (slide.notes) {
      lines.push(`> **演讲者备注**：${slide.notes.replace(/\n/g, '\n> ')}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim() + '\n';
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 构建用于浏览器 / VS Code 打印或导出 PDF 的自包含静态 HTML 文档
 */
export function buildPptxPrintHtml(
  presentation: ParsedPptxPresentation,
  options?: { includeNotes?: boolean }
): string {
  const { metadata, slides } = presentation;
  const w = metadata.width || 960;
  const h = metadata.height || 540;
  const includeNotes = options?.includeNotes ?? false;
  const safeTitle = escapeHtml(metadata.title || 'OmniView PPTX');

  const slideHtmls = slides
    .map((slide, idx) => {
      const bgStyle = slide.backgroundImage
        ? `background-image: url(${slide.backgroundImage}); background-size: cover; background-position: center;`
        : slide.backgroundGradient
        ? `background: ${slide.backgroundGradient};`
        : `background: ${slide.backgroundColor || '#ffffff'};`;

      const elementsHtml = slide.elements
        .map(el => {
          const basePos = `position:absolute; left:${el.x}px; top:${el.y}px; width:${el.width}px; height:${el.height}px;${
            el.rotation ? ` transform:rotate(${el.rotation}deg);` : ''
          }`;
          if (el.type === 'image' && el.imageDataUrl) {
            return `<div style="${basePos} overflow:hidden; display:flex; align-items:center; justify-content:center;"><img src="${el.imageDataUrl}" alt="${escapeHtml(el.imageAlt || '')}" style="width:100%; height:100%; object-fit:contain;" /></div>`;
          }
          if (el.type === 'table' && el.tableRows) {
            const trs = el.tableRows
              .map(
                row =>
                  `<tr>${row
                    .filter(c => !c.mergedSkip)
                    .map(
                      c =>
                        `<td${c.colSpan ? ` colspan="${c.colSpan}"` : ''}${
                          c.rowSpan ? ` rowspan="${c.rowSpan}"` : ''
                        } style="border:1px solid #cbd5e1; padding:4px 6px; background:${c.background || 'transparent'}; color:${c.color || '#0f172a'}; text-align:${c.align || 'left'}; font-weight:${c.bold || c.isHeader ? '600' : '400'}; font-size:${c.fontSize ? Math.max(10, c.fontSize * 0.85) : 12}px;">${escapeHtml(c.text)}</td>`
                    )
                    .join('')}</tr>`
              )
              .join('');
            return `<div style="${basePos} overflow:hidden;"><table style="width:100%; height:100%; border-collapse:collapse; table-layout:fixed;"><tbody>${trs}</tbody></table></div>`;
          }
          if (el.type === 'shape') {
            const radius =
              el.shapeType === 'ellipse' ? 'border-radius:9999px;' : el.shapeType === 'roundRect' ? 'border-radius:8px;' : '';
            const bg = el.fillGradient ? `background:${el.fillGradient};` : `background:${el.fillColor || 'transparent'};`;
            const border = el.strokeColor ? `border:${el.strokeWidth || 1}px solid ${el.strokeColor};` : '';
            return `<div style="${basePos} ${bg} ${border} ${radius}"></div>`;
          }
          if (el.type === 'chart' && el.chartData) {
            return `<div style="${basePos} border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#fff; display:flex; flex-direction:column; justify-content:center; align-items:center; font-size:13px; color:#334155;"><strong>${escapeHtml(el.chartData.title || 'Chart')}</strong><div style="margin-top:6px; font-size:11px; color:#64748b;">${escapeHtml(el.chartData.categories.join(' · '))}</div></div>`;
          }
          if (el.paragraphs) {
            const pHtml = el.paragraphs
              .map(p => {
                const prefix = p.autoNumIndex !== undefined ? `${p.autoNumIndex}. ` : p.bullet ? `${p.bulletChar || '•'} ` : '';
                const runsHtml = p.runs
                  .map(
                    r =>
                      `<span style="font-weight:${r.bold ? '700' : '400'}; font-style:${r.italic ? 'italic' : 'normal'}; text-decoration:${r.underline ? 'underline' : 'none'}; font-size:${r.fontSize || 15}px; color:${r.color || '#0f172a'};">${escapeHtml(r.text)}</span>`
                  )
                  .join('');
                return `<p style="margin:2px 0; text-align:${p.align || 'left'}; padding-left:${p.marginLeft || 0}px;">${escapeHtml(prefix)}${runsHtml}</p>`;
              })
              .join('');
            const bg = el.backgroundGradient ? `background:${el.backgroundGradient};` : el.backgroundColor ? `background:${el.backgroundColor};` : '';
            const border = el.borderColor ? `border:${el.borderWidth || 1}px solid ${el.borderColor};` : '';
            return `<div style="${basePos} ${bg} ${border} box-sizing:border-box; padding:4px 6px;">${pHtml}</div>`;
          }
          return '';
        })
        .join('\n');

      const notesHtml =
        includeNotes && slide.notes
          ? `<div style="width:${w}px; margin:8px auto 0; padding:10px 14px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; font-size:12px; color:#334155;"><strong>备注 #${idx + 1}：</strong>${escapeHtml(slide.notes)}</div>`
          : '';

      return `<section class="print-slide-wrap">
        <div class="print-slide" style="position:relative; width:${w}px; height:${h}px; overflow:hidden; border:1px solid #e2e8f0; ${bgStyle}">
          ${elementsHtml}
        </div>
        ${notesHtml}
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} - 打印预览</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }
    .print-slide-wrap { margin: 0 auto 24px; width: fit-content; page-break-after: always; break-after: page; }
    .print-slide-wrap:last-child { page-break-after: auto; break-after: auto; }
    @media print {
      @page { size: landscape; margin: 8mm; }
      body { margin: 0; padding: 0; background: #fff; }
      .print-slide { border: none !important; margin: 0 auto; zoom: 0.94; }
    }
  </style>
</head>
<body>
  ${slideHtmls}
</body>
</html>`;
}
