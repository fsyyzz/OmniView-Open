/**
 * SVG Path 节点解析/序列化与批量图元几何运算核心模块
 *
 * 从 svgUtils.ts 抽离出的零依赖纯函数子模块，负责：
 * - Path 节点命令解析 (`parseSvgPathNodes`) 与序列化 (`serializeSvgPathNodes`)
 * - 画布直线/折线插入 (`addNewLineToSvg`, `addNewPolylineToSvg`)
 * - 联合外接矩形计算 (`calculateUnionBBox`) 与 DOM 增量平移 (`applyDeltaToDomElement`)
 */
import type { ElementBBox } from './svgUtils.ts';

/**
 * Path 节点与控制手柄结构
 */
export interface PathNodeInfo {
  index: number;
  type: 'corner' | 'smooth' | 'symmetric';
  x: number;
  y: number;
  command: string; // 'M' | 'L' | 'Q' | 'C' | 'A' | 'Z'
  controlPoints?: Array<{ x: number; y: number; index: number }>;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
  /** 弧段参数（command='A' 时必有）：端点可拖拽，弧参数保持不变。 */
  arc?: { rx: number; ry: number; xRotation: number; largeArc: boolean; sweep: boolean };
}

export type SvgPathNode = PathNodeInfo;

/**
 * 解析 SVG 路径为带坐标和控制点的离散节点
 *
 * P0 修复（v1 路径损坏）：
 * - `S/s` → 按反射控制点解析为 `command:'C'`（几何等价，不再静默丢段）
 * - `T/t` → 反射控制点解析为 `command:'Q'`
 * - `A/a` → `command:'A'` + `arc` 参数（端点可拖拽、弧参数保真）
 */
export function parseSvgPathNodes(d: string): PathNodeInfo[] {
  if (!d) return [];
  const nodes: PathNodeInfo[] = [];

  // 简易但高容错的 Path 命令解析器
  const cmdRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;
  let currentX = 0;
  let currentY = 0;
  let nodeIdx = 0;
  // 反射状态：上一曲线段的末控制点及其类别（C/S → 'C'；Q/T → 'Q'；直线 → null）
  let lastCtrl: { x: number; y: number } | null = null;
  let lastCtrlKind: 'C' | 'Q' | null = null;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const reflect = (cx: number, cy: number): { x: number; y: number } =>
    lastCtrl ? { x: r2(2 * cx - lastCtrl.x), y: r2(2 * cy - lastCtrl.y) } : { x: r2(cx), y: r2(cy) };

  while ((match = cmdRegex.exec(d)) !== null) {
    const cmd = match[1];
    const upperCmd = cmd.toUpperCase();
    const isRel = cmd !== upperCmd;
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (upperCmd === 'M' || upperCmd === 'L') {
      for (let i = 0; i < args.length; i += 2) {
        if (i + 1 < args.length) {
          const px = isRel ? currentX + args[i] : args[i];
          const py = isRel ? currentY + args[i + 1] : args[i + 1];
          currentX = px;
          currentY = py;
          nodes.push({
            index: nodeIdx++,
            type: 'corner',
            x: r2(px),
            y: r2(py),
            command: i === 0 && upperCmd === 'M' ? 'M' : 'L',
          });
        }
      }
      lastCtrl = null;
      lastCtrlKind = null;
    } else if (upperCmd === 'H') {
      for (let i = 0; i < args.length; i++) {
        const px = isRel ? currentX + args[i] : args[i];
        currentX = px;
        nodes.push({
          index: nodeIdx++,
          type: 'corner',
          x: r2(px),
          y: r2(currentY),
          command: 'L',
        });
      }
      lastCtrl = null;
      lastCtrlKind = null;
    } else if (upperCmd === 'V') {
      for (let i = 0; i < args.length; i++) {
        const py = isRel ? currentY + args[i] : args[i];
        currentY = py;
        nodes.push({
          index: nodeIdx++,
          type: 'corner',
          x: r2(currentX),
          y: r2(py),
          command: 'L',
        });
      }
      lastCtrl = null;
      lastCtrlKind = null;
    } else if (upperCmd === 'Q') {
      // Q cpx cpy x y
      for (let i = 0; i < args.length; i += 4) {
        if (i + 3 < args.length) {
          const cpx = isRel ? currentX + args[i] : args[i];
          const cpy = isRel ? currentY + args[i + 1] : args[i + 1];
          const endX = isRel ? currentX + args[i + 2] : args[i + 2];
          const endY = isRel ? currentY + args[i + 3] : args[i + 3];
          currentX = endX;
          currentY = endY;
          lastCtrl = { x: cpx, y: cpy };
          lastCtrlKind = 'Q';
          nodes.push({
            index: nodeIdx++,
            type: 'smooth',
            x: r2(endX),
            y: r2(endY),
            command: 'Q',
            controlPoints: [{ x: r2(cpx), y: r2(cpy), index: 0 }],
            handleIn: { x: r2(cpx), y: r2(cpy) },
          });
        }
      }
    } else if (upperCmd === 'C') {
      // C cp1x cp1y cp2x cp2y x y
      for (let i = 0; i < args.length; i += 6) {
        if (i + 5 < args.length) {
          const cp1x = isRel ? currentX + args[i] : args[i];
          const cp1y = isRel ? currentY + args[i + 1] : args[i + 1];
          const cp2x = isRel ? currentX + args[i + 2] : args[i + 2];
          const cp2y = isRel ? currentY + args[i + 3] : args[i + 3];
          const endX = isRel ? currentX + args[i + 4] : args[i + 4];
          const endY = isRel ? currentY + args[i + 5] : args[i + 5];
          currentX = endX;
          currentY = endY;
          lastCtrl = { x: cp2x, y: cp2y };
          lastCtrlKind = 'C';
          nodes.push({
            index: nodeIdx++,
            type: 'smooth',
            x: r2(endX),
            y: r2(endY),
            command: 'C',
            controlPoints: [
              { x: r2(cp1x), y: r2(cp1y), index: 0 },
              { x: r2(cp2x), y: r2(cp2y), index: 1 },
            ],
            handleIn: { x: r2(cp1x), y: r2(cp1y) },
            handleOut: { x: r2(cp2x), y: r2(cp2y) },
          });
        }
      }
    } else if (upperCmd === 'S') {
      // S cp2x cp2y x y（cp1 = 前一 C/S 控制点关于当前点的反射）
      for (let i = 0; i < args.length; i += 4) {
        if (i + 3 < args.length) {
          const cp2x = isRel ? currentX + args[i] : args[i];
          const cp2y = isRel ? currentY + args[i + 1] : args[i + 1];
          const endX = isRel ? currentX + args[i + 2] : args[i + 2];
          const endY = isRel ? currentY + args[i + 3] : args[i + 3];
          const cp1 = lastCtrlKind === 'C' ? reflect(currentX, currentY) : { x: r2(currentX), y: r2(currentY) };
          currentX = endX;
          currentY = endY;
          lastCtrl = { x: cp2x, y: cp2y };
          lastCtrlKind = 'C';
          nodes.push({
            index: nodeIdx++,
            type: 'smooth',
            x: r2(endX),
            y: r2(endY),
            command: 'C',
            controlPoints: [
              { x: r2(cp1.x), y: r2(cp1.y), index: 0 },
              { x: r2(cp2x), y: r2(cp2y), index: 1 },
            ],
            handleIn: { x: r2(cp1.x), y: r2(cp1.y) },
            handleOut: { x: r2(cp2x), y: r2(cp2y) },
          });
        }
      }
    } else if (upperCmd === 'T') {
      // T x y（cp = 前一 Q/T 控制点关于当前点的反射；T 每段仅 2 参）
      for (let i = 0; i + 1 < args.length; i += 2) {
        const endX = isRel ? currentX + args[i] : args[i];
        const endY = isRel ? currentY + args[i + 1] : args[i + 1];
        const cp = lastCtrlKind === 'Q' ? reflect(currentX, currentY) : { x: r2(currentX), y: r2(currentY) };
        currentX = endX;
        currentY = endY;
        lastCtrl = { x: cp.x, y: cp.y };
        lastCtrlKind = 'Q';
        nodes.push({
          index: nodeIdx++,
          type: 'smooth',
          x: r2(endX),
          y: r2(endY),
          command: 'Q',
          controlPoints: [{ x: r2(cp.x), y: r2(cp.y), index: 0 }],
          handleIn: { x: r2(cp.x), y: r2(cp.y) },
        });
      }
    } else if (upperCmd === 'A') {
      // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
      for (let i = 0; i < args.length; i += 7) {
        if (i + 6 < args.length) {
          const rx = args[i];
          const ry = args[i + 1];
          const xRotation = args[i + 2];
          const largeArc = !!args[i + 3];
          const sweep = !!args[i + 4];
          const endX = isRel ? currentX + args[i + 5] : args[i + 5];
          const endY = isRel ? currentY + args[i + 6] : args[i + 6];
          currentX = endX;
          currentY = endY;
          lastCtrl = null;
          lastCtrlKind = null;
          nodes.push({
            index: nodeIdx++,
            type: 'smooth',
            x: r2(endX),
            y: r2(endY),
            command: 'A',
            arc: { rx, ry, xRotation, largeArc, sweep },
          });
        }
      }
    } else if (upperCmd === 'Z') {
      lastCtrl = null;
      lastCtrlKind = null;
    }
  }

  return nodes;
}

/**
 * 将 PathNode 列表重新序列化为标准的 SVG d 属性字符串
 *
 * P0：`command:'A'` 输出原弧命令（端点可拖、rx/ry/flags 保真）；
 * `S`/`T` 已在解析期等价转换为 `C`/`Q`，此处照旧输出。
 */
export function serializeSvgPathNodes(nodes: PathNodeInfo[], isClosed: boolean = false): string {
  if (nodes.length === 0) return '';
  const parts: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (i === 0) {
      parts.push(`M ${node.x} ${node.y}`);
    } else if (node.command === 'A' && node.arc) {
      const a = node.arc;
      parts.push(
        `A ${a.rx} ${a.ry} ${a.xRotation} ${a.largeArc ? 1 : 0} ${a.sweep ? 1 : 0} ${node.x} ${node.y}`
      );
    } else if (node.command === 'Q' && node.controlPoints && node.controlPoints.length > 0) {
      parts.push(`Q ${node.controlPoints[0].x} ${node.controlPoints[0].y} ${node.x} ${node.y}`);
    } else if (node.command === 'C' && node.controlPoints && node.controlPoints.length >= 2) {
      parts.push(
        `C ${node.controlPoints[0].x} ${node.controlPoints[0].y} ${node.controlPoints[1].x} ${node.controlPoints[1].y} ${node.x} ${node.y}`
      );
    } else {
      parts.push(`L ${node.x} ${node.y}`);
    }
  }

  if (isClosed) parts.push('Z');
  return parts.join(' ');
}

/**
 * 向 SVG 画布中插入一条新绘制的直线
 */
export function addNewLineToSvg(
  svgText: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options?: {
    stroke?: string;
    strokeWidth?: string;
    markerEnd?: string;
  }
): string {
  const stroke = options?.stroke || '#3b82f6';
  const strokeWidth = options?.strokeWidth || '2';
  const markerEndAttr = options?.markerEnd ? ` marker-end="${options.markerEnd}"` : '';

  const newLineTag = `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${markerEndAttr} />\n`;

  if (svgText.includes('</svg>')) {
    return svgText.replace('</svg>', `${newLineTag}</svg>`);
  }
  return svgText + `\n<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">\n${newLineTag}</svg>`;
}

/**
 * 向 SVG 画布中插入一条新绘制的折线或多点路径
 */
export function addNewPolylineToSvg(
  svgText: string,
  points: Array<{ x: number; y: number }>,
  options?: {
    isClosed?: boolean;
    stroke?: string;
    strokeWidth?: string;
    markerEnd?: string;
  }
): string {
  if (points.length < 2) return svgText;
  const stroke = options?.stroke || '#3b82f6';
  const strokeWidth = options?.strokeWidth || '2';
  const markerEndAttr = options?.markerEnd ? ` marker-end="${options.markerEnd}"` : '';

  const d = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .concat(options?.isClosed ? ['Z'] : [])
    .join(' ');

  const newPathTag = `  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${markerEndAttr} />\n`;

  if (svgText.includes('</svg>')) {
    return svgText.replace('</svg>', `${newPathTag}</svg>`);
  }
  return svgText + `\n<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">\n${newPathTag}</svg>`;
}

/**
 * 计算多个图元包围盒的联合外接矩形 (Union BBox)
 */
export function calculateUnionBBox(bboxes: ElementBBox[]): ElementBBox | null {
  const valid = bboxes.filter(b => b && typeof b.x === 'number' && !isNaN(b.x));
  if (valid.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of valid) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  const round2 = (num: number) => Math.round(num * 100) / 100;
  return {
    x: round2(minX),
    y: round2(minY),
    width: round2(Math.max(0, maxX - minX)),
    height: round2(Math.max(0, maxY - minY)),
  };
}

/**
 * 内部辅助函数：对单个 DOM 元素应用增量平移几何参数
 */
export function applyDeltaToDomElement(el: Element, deltaX: number, deltaY: number): void {
  const tagName = el.tagName.toLowerCase();
  const round2 = (num: number) => Math.round(num * 100) / 100;

  switch (tagName) {
    case 'rect':
    case 'text':
    case 'tspan':
    case 'image':
    case 'use': {
      const curX = parseFloat(el.getAttribute('x') || '0');
      const curY = parseFloat(el.getAttribute('y') || '0');
      el.setAttribute('x', String(round2(curX + deltaX)));
      el.setAttribute('y', String(round2(curY + deltaY)));
      break;
    }
    case 'circle': {
      const curCx = parseFloat(el.getAttribute('cx') || '0');
      const curCy = parseFloat(el.getAttribute('cy') || '0');
      el.setAttribute('cx', String(round2(curCx + deltaX)));
      el.setAttribute('cy', String(round2(curCy + deltaY)));
      break;
    }
    case 'ellipse': {
      const curCx = parseFloat(el.getAttribute('cx') || '0');
      const curCy = parseFloat(el.getAttribute('cy') || '0');
      el.setAttribute('cx', String(round2(curCx + deltaX)));
      el.setAttribute('cy', String(round2(curCy + deltaY)));
      break;
    }
    case 'line': {
      const x1 = parseFloat(el.getAttribute('x1') || '0');
      const y1 = parseFloat(el.getAttribute('y1') || '0');
      const x2 = parseFloat(el.getAttribute('x2') || '0');
      const y2 = parseFloat(el.getAttribute('y2') || '0');
      el.setAttribute('x1', String(round2(x1 + deltaX)));
      el.setAttribute('y1', String(round2(y1 + deltaY)));
      el.setAttribute('x2', String(round2(x2 + deltaX)));
      el.setAttribute('y2', String(round2(y2 + deltaY)));
      break;
    }
    default: {
      const curTransform = el.getAttribute('transform') || '';
      const translateMatch = curTransform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      let tx = 0;
      let ty = 0;
      if (translateMatch) {
        tx = parseFloat(translateMatch[1]) || 0;
        ty = parseFloat(translateMatch[2]) || 0;
        const newTranslate = `translate(${round2(tx + deltaX)}, ${round2(ty + deltaY)})`;
        el.setAttribute('transform', curTransform.replace(/translate\([^)]+\)/i, newTranslate));
      } else if (curTransform.trim()) {
        el.setAttribute('transform', `${curTransform} translate(${round2(deltaX)}, ${round2(deltaY)})`);
      } else {
        el.setAttribute('transform', `translate(${round2(deltaX)}, ${round2(deltaY)})`);
      }
      break;
    }
  }
}
