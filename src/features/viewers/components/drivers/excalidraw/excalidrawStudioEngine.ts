/**
 * OmniView Excalidraw PC Studio 交互与手绘几何核心引擎
 * 提供：
 * 1. 确定性种子手绘路径生成 (Seeded Roughness SVG Path & Hachure Fill)
 * 2. 图元几何包围盒、命中检测 (Hit-Testing) 与 8 向缩放控制柄
 * 3. 智能对齐参考线 (Smart Alignment Snap Guides)
 * 4. 8 向多选对齐与水平/垂直等距分布算法
 * 5. 连线北/南/东/西锚点磁吸绑定与节点移动实时重算路径
 * 6. 容器内联绑定文字 (Container Bound Text) 同步与编组/解组/层级调度
 */

export type ExcalidrawToolId =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'frame'
  | 'eraser';

export type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type AnchorPortId = 'n' | 's' | 'e' | 'w' | 'center';

export interface AnchorPort {
  elementId: string;
  port: AnchorPortId;
  x: number;
  y: number;
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  pos: number;
  start: number;
  end: number;
  label?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  right: number;
  bottom: number;
}

export interface ExcalidrawDefaultStyle {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'hachure' | 'cross-hatch' | 'solid';
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  roundness: boolean;
  opacity: number;
  fontSize: number;
  fontFamily: number;
  textAlign: 'left' | 'center' | 'right';
}

export const DEFAULT_EXCALIDRAW_STYLE: ExcalidrawDefaultStyle = {
  strokeColor: '#3b82f6',
  backgroundColor: '#dbeafe',
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  roundness: true,
  opacity: 100,
  fontSize: 16,
  fontFamily: 1,
  textAlign: 'center',
};

export const PC_STROKE_PALETTE = [
  '#1e293b',
  '#e2e8f0',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

export const PC_FILL_PALETTE = [
  'transparent',
  '#dbeafe',
  '#d1fae5',
  '#fef3c7',
  '#fee2e2',
  '#ede9fe',
  '#cffafe',
  '#fce7f3',
  '#f1f5f9',
  '#1e293b',
];

/**
 * 确定性伪随机数生成器 (Mulberry32)，确保相同 seed 下手绘抖动完全稳定不闪烁
 */
export function createSeededRandom(seed: number): () => number {
  let a = (seed || 1337) >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 生成带手绘抖动的线段 SVG Path
 */
export function roughLineSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  roughness: number,
  rand: () => number
): string {
  const r = Math.max(0, Math.min(3, roughness));
  if (r === 0) {
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const len = Math.hypot(x2 - x1, y2 - y1);
  const amp = Math.min(3.2, Math.max(0.5, len * 0.012)) * r;
  const jitter = () => (rand() - 0.5) * 2 * amp;

  const midX1 = x1 + (x2 - x1) * 0.5 + jitter();
  const midY1 = y1 + (y2 - y1) * 0.5 + jitter();
  const p1 = `M ${(x1 + jitter() * 0.4).toFixed(1)} ${(y1 + jitter() * 0.4).toFixed(1)} Q ${midX1.toFixed(1)} ${midY1.toFixed(1)} ${(x2 + jitter() * 0.4).toFixed(1)} ${(y2 + jitter() * 0.4).toFixed(1)}`;

  if (r < 0.8) return p1;

  const midX2 = x1 + (x2 - x1) * 0.52 + jitter() * 0.85;
  const midY2 = y1 + (y2 - y1) * 0.48 + jitter() * 0.85;
  const p2 = `M ${(x1 + jitter() * 0.3).toFixed(1)} ${(y1 + jitter() * 0.3).toFixed(1)} Q ${midX2.toFixed(1)} ${midY2.toFixed(1)} ${(x2 + jitter() * 0.3).toFixed(1)} ${(y2 + jitter() * 0.3).toFixed(1)}`;

  return `${p1} ${p2}`;
}

/**
 * 生成矩形的手绘描边 SVG Path
 */
export function generateRoughRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  roughness: number,
  roundness: boolean,
  seed: number
): string {
  const rand = createSeededRandom(seed);
  if (roughness === 0 && roundness) {
    const r = Math.min(10, w / 4, h / 4);
    return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  }
  const s1 = roughLineSegment(x, y, x + w, y, roughness, rand);
  const s2 = roughLineSegment(x + w, y, x + w, y + h, roughness, rand);
  const s3 = roughLineSegment(x + w, y + h, x, y + h, roughness, rand);
  const s4 = roughLineSegment(x, y + h, x, y, roughness, rand);
  return `${s1} ${s2} ${s3} ${s4}`;
}

/**
 * 生成菱形的手绘描边 SVG Path
 */
export function generateRoughDiamondPath(
  x: number,
  y: number,
  w: number,
  h: number,
  roughness: number,
  seed: number
): string {
  const rand = createSeededRandom(seed);
  const top = { x: x + w / 2, y };
  const right = { x: x + w, y: y + h / 2 };
  const bottom = { x: x + w / 2, y: y + h };
  const left = { x, y: y + h / 2 };
  return [
    roughLineSegment(top.x, top.y, right.x, right.y, roughness, rand),
    roughLineSegment(right.x, right.y, bottom.x, bottom.y, roughness, rand),
    roughLineSegment(bottom.x, bottom.y, left.x, left.y, roughness, rand),
    roughLineSegment(left.x, left.y, top.x, top.y, roughness, rand),
  ].join(' ');
}

/**
 * 生成椭圆的手绘描边 SVG Path
 */
export function generateRoughEllipsePath(
  x: number,
  y: number,
  w: number,
  h: number,
  roughness: number,
  seed: number
): string {
  const rand = createSeededRandom(seed);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(2, w / 2);
  const ry = Math.max(2, h / 2);
  const steps = 20;
  const r = Math.max(0, Math.min(3, roughness));

  const buildLoop = (offsetAngle: number, jitterScale: number) => {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2 + offsetAngle;
      const jx = (rand() - 0.5) * 2.2 * r * jitterScale;
      const jy = (rand() - 0.5) * 2.2 * r * jitterScale;
      pts.push({
        x: cx + Math.cos(theta) * rx + jx,
        y: cy + Math.sin(theta) * ry + jy,
      });
    }
    return pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') + ' Z';
  };

  if (r === 0) {
    return buildLoop(0, 0);
  }
  return `${buildLoop(0, 1)} ${buildLoop(0.18, 0.75)}`;
}

/**
 * 生成 Hachure / Cross-Hatch 手绘斜线填充纹理 SVG Path
 */
export function generateHachureFillPath(
  x: number,
  y: number,
  w: number,
  h: number,
  fillStyle: string,
  roughness: number,
  seed: number,
  shapeType: 'rectangle' | 'diamond' | 'ellipse' = 'rectangle'
): string {
  if (!fillStyle || fillStyle === 'solid' || fillStyle === 'transparent') return '';
  const rand = createSeededRandom(seed + 7919);
  const gap = 9;
  const lines: string[] = [];
  const total = w + h;

  const clipPointToShape = (px: number, py: number): boolean => {
    if (shapeType === 'ellipse') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = Math.max(1, w / 2);
      const ry = Math.max(1, h / 2);
      return ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 0.94;
    }
    if (shapeType === 'diamond') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const hw = Math.max(1, w / 2);
      const hh = Math.max(1, h / 2);
      return Math.abs(px - cx) / hw + Math.abs(py - cy) / hh <= 0.94;
    }
    return px >= x + 2 && px <= x + w - 2 && py >= y + 2 && py <= y + h - 2;
  };

  for (let d = gap; d < total; d += gap) {
    let x1 = x + Math.max(0, d - h);
    let y1 = y + Math.min(h, d);
    let x2 = x + Math.min(w, d);
    let y2 = y + Math.max(0, d - w);

    if (shapeType !== 'rectangle') {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      if (!clipPointToShape(midX, midY)) continue;
      // 收缩端点使其留在菱形/椭圆内部
      x1 = midX + (x1 - midX) * 0.68;
      y1 = midY + (y1 - midY) * 0.68;
      x2 = midX + (x2 - midX) * 0.68;
      y2 = midY + (y2 - midY) * 0.68;
    }

    lines.push(roughLineSegment(x1, y1, x2, y2, Math.min(1, roughness * 0.7), rand));
  }

  if (fillStyle === 'cross-hatch') {
    for (let d = gap; d < total; d += gap * 1.3) {
      const x1 = x + Math.max(0, d - h);
      const y1 = y + h - Math.min(h, d);
      const x2 = x + Math.min(w, d);
      const y2 = y + h - Math.max(0, d - w);
      lines.push(roughLineSegment(x1, y1, x2, y2, Math.min(1, roughness * 0.6), rand));
    }
  }

  return lines.join(' ');
}

/**
 * 计算任意图元的标准几何包围盒 (BoundingBox)
 */
export function getElementBounds(el: any): BoundingBox {
  const x = typeof el.x === 'number' ? el.x : 0;
  const y = typeof el.y === 'number' ? el.y : 0;

  if ((el.type === 'arrow' || el.type === 'line' || el.type === 'freedraw') && Array.isArray(el.points) && el.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of el.points) {
      const px = x + (pt[0] || 0);
      const py = y + (pt[1] || 0);
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const width = Math.max(8, maxX - minX);
    const height = Math.max(8, maxY - minY);
    return {
      x: minX,
      y: minY,
      width,
      height,
      cx: minX + width / 2,
      cy: minY + height / 2,
      right: minX + width,
      bottom: minY + height,
    };
  }

  const rawW = typeof el.width === 'number' ? el.width : el.type === 'text' ? Math.max(60, String(el.text || '').length * (el.fontSize || 16) * 0.65) : 100;
  const rawH = typeof el.height === 'number' ? el.height : el.type === 'text' ? Math.max(24, String(el.text || '').split('\n').length * (el.fontSize || 16) * 1.35) : 60;

  const normX = rawW < 0 ? x + rawW : x;
  const normY = rawH < 0 ? y + rawH : y;
  const width = Math.max(8, Math.abs(rawW));
  const height = Math.max(8, Math.abs(rawH));

  return {
    x: normX,
    y: normY,
    width,
    height,
    cx: normX + width / 2,
    cy: normY + height / 2,
    right: normX + width,
    bottom: normY + height,
  };
}

/**
 * 计算多个选中图元的联合外接包围盒
 */
export function getSelectionBounds(elements: any[], selectedIds: Set<string>): BoundingBox | null {
  const selected = elements.filter((el) => el && !el.isDeleted && !el.isHidden && selectedIds.has(el.id));
  if (selected.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of selected) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.right);
    maxY = Math.max(maxY, b.bottom);
  }

  const width = Math.max(8, maxX - minX);
  const height = Math.max(8, maxY - minY);
  return {
    x: minX,
    y: minY,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
    right: maxX,
    bottom: maxY,
  };
}

/**
 * 点到线段的最短距离
 */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * 精确命中检测 (从顶层向底层逆序扫描)
 */
export function hitTestElements(elements: any[], worldX: number, worldY: number, tolerance = 8): any | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el || el.isDeleted || el.isHidden) continue;

    // 容器绑定文本由父容器统一命中，除非直接双击
    if (el.type === 'text' && el.containerId) continue;

    if ((el.type === 'arrow' || el.type === 'line' || el.type === 'freedraw') && Array.isArray(el.points) && el.points.length >= 2) {
      for (let j = 0; j < el.points.length - 1; j++) {
        const p1 = el.points[j];
        const p2 = el.points[j + 1];
        const d = distToSegment(worldX, worldY, el.x + p1[0], el.y + p1[1], el.x + p2[0], el.y + p2[1]);
        if (d <= tolerance + 4) return el;
      }
      continue;
    }

    const b = getElementBounds(el);
    if (el.type === 'frame') {
      // Frame 仅点击边框或顶部标题区时命中，避免遮挡内部子图元点选
      const onBorder =
        (worldX >= b.x - tolerance && worldX <= b.right + tolerance && Math.abs(worldY - b.y) <= 24) ||
        (worldX >= b.x - tolerance && worldX <= b.right + tolerance && Math.abs(worldY - b.bottom) <= tolerance) ||
        (worldY >= b.y - tolerance && worldY <= b.bottom + tolerance && Math.abs(worldX - b.x) <= tolerance) ||
        (worldY >= b.y - tolerance && worldY <= b.bottom + tolerance && Math.abs(worldX - b.right) <= tolerance);
      if (onBorder) return el;
      continue;
    }

    if (
      worldX >= b.x - tolerance &&
      worldX <= b.right + tolerance &&
      worldY >= b.y - tolerance &&
      worldY <= b.bottom + tolerance
    ) {
      return el;
    }
  }
  return null;
}

/**
 * 获取选区框 (Marquee) 内的所有图元 ID（支持群组连带选中）
 */
export function getElementsInMarquee(
  elements: any[],
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string[] {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  const hitIds = new Set<string>();
  const hitGroups = new Set<string>();

  for (const el of elements) {
    if (!el || el.isDeleted || el.isHidden || el.locked) continue;
    const b = getElementBounds(el);
    const intersects = b.x <= maxX && b.right >= minX && b.y <= maxY && b.bottom >= minY;
    if (intersects) {
      hitIds.add(el.id);
      if (Array.isArray(el.groupIds)) {
        el.groupIds.forEach((gid: string) => hitGroups.add(gid));
      }
    }
  }

  // 若命中群组内任一成员，自动连带选中同组全部图元
  if (hitGroups.size > 0) {
    for (const el of elements) {
      if (!el || el.isDeleted || el.isHidden) continue;
      if (Array.isArray(el.groupIds) && el.groupIds.some((g: string) => hitGroups.has(g))) {
        hitIds.add(el.id);
      }
    }
  }

  return Array.from(hitIds);
}

/**
 * 生成包围盒的 8 向缩放控制点坐标
 */
export function getResizeHandles(bounds: BoundingBox): Array<{ type: ResizeHandleType; x: number; y: number; cursor: string }> {
  const { x, y, right, bottom, cx, cy } = bounds;
  return [
    { type: 'nw', x, y, cursor: 'nwse-resize' },
    { type: 'n', x: cx, y, cursor: 'ns-resize' },
    { type: 'ne', x: right, y, cursor: 'nesw-resize' },
    { type: 'e', x: right, y: cy, cursor: 'ew-resize' },
    { type: 'se', x: right, y: bottom, cursor: 'nwse-resize' },
    { type: 's', x: cx, y: bottom, cursor: 'ns-resize' },
    { type: 'sw', x, y: bottom, cursor: 'nesw-resize' },
    { type: 'w', x, y: cy, cursor: 'ew-resize' },
  ];
}

/**
 * 智能参考线吸附算法 (Smart Alignment & Snap Guides)
 */
export function computeSmartSnap(
  movingBounds: BoundingBox,
  otherElements: any[],
  threshold = 6
): { dx: number; dy: number; guides: SnapGuide[] } {
  let bestDx = 0;
  let bestDy = 0;
  let minAbsX = threshold + 1;
  let minAbsY = threshold + 1;
  const guides: SnapGuide[] = [];

  const movingXPoints = [
    { val: movingBounds.x, label: 'left' },
    { val: movingBounds.cx, label: 'center' },
    { val: movingBounds.right, label: 'right' },
  ];
  const movingYPoints = [
    { val: movingBounds.y, label: 'top' },
    { val: movingBounds.cy, label: 'middle' },
    { val: movingBounds.bottom, label: 'bottom' },
  ];

  let vGuide: SnapGuide | null = null;
  let hGuide: SnapGuide | null = null;

  for (const el of otherElements) {
    if (!el || el.isDeleted || el.isHidden || el.type === 'arrow' || el.type === 'line') continue;
    const tb = getElementBounds(el);
    const targetXPoints = [tb.x, tb.cx, tb.right];
    const targetYPoints = [tb.y, tb.cy, tb.bottom];

    for (const mp of movingXPoints) {
      for (const tp of targetXPoints) {
        const diff = tp - mp.val;
        const abs = Math.abs(diff);
        if (abs <= threshold && abs < minAbsX) {
          minAbsX = abs;
          bestDx = diff;
          vGuide = {
            type: 'vertical',
            pos: tp,
            start: Math.min(movingBounds.y, tb.y) - 16,
            end: Math.max(movingBounds.bottom, tb.bottom) + 16,
          };
        }
      }
    }

    for (const mp of movingYPoints) {
      for (const tp of targetYPoints) {
        const diff = tp - mp.val;
        const abs = Math.abs(diff);
        if (abs <= threshold && abs < minAbsY) {
          minAbsY = abs;
          bestDy = diff;
          hGuide = {
            type: 'horizontal',
            pos: tp,
            start: Math.min(movingBounds.x, tb.x) - 16,
            end: Math.max(movingBounds.right, tb.right) + 16,
          };
        }
      }
    }
  }

  if (vGuide) guides.push(vGuide);
  if (hGuide) guides.push(hGuide);

  return { dx: bestDx, dy: bestDy, guides };
}

/**
 * 获取形状的北/南/东/西/中心 5 个磁吸连接锚点
 */
export function getElementAnchorPorts(el: any): AnchorPort[] {
  if (!el || el.isDeleted || el.isHidden) return [];
  if (!['rectangle', 'diamond', 'ellipse', 'frame'].includes(el.type)) return [];
  const b = getElementBounds(el);
  return [
    { elementId: el.id, port: 'n', x: b.cx, y: b.y },
    { elementId: el.id, port: 'e', x: b.right, y: b.cy },
    { elementId: el.id, port: 's', x: b.cx, y: b.bottom },
    { elementId: el.id, port: 'w', x: b.x, y: b.cy },
    { elementId: el.id, port: 'center', x: b.cx, y: b.cy },
  ];
}

/**
 * 查找鼠标坐标附近最近的磁吸锚点
 */
export function findNearestSnapPort(
  elements: any[],
  worldX: number,
  worldY: number,
  snapRadius = 24,
  excludeElementId?: string
): AnchorPort | null {
  let nearest: AnchorPort | null = null;
  let minDist = snapRadius;

  for (const el of elements) {
    if (!el || el.isDeleted || el.isHidden || el.id === excludeElementId) continue;
    const ports = getElementAnchorPorts(el);
    for (const p of ports) {
      const d = Math.hypot(worldX - p.x, worldY - p.y);
      if (d <= minDist) {
        minDist = d;
        nearest = p;
      }
    }
  }
  return nearest;
}

/**
 * 当节点移动或缩放时，实时同步更新所有绑定在该节点上的容器内联文字与关联箭头路径
 */
export function syncBoundElementsAfterTransform(elements: any[]): any[] {
  const byId = new Map<string, any>();
  elements.forEach((el) => {
    if (el && !el.isDeleted) byId.set(el.id, el);
  });

  return elements.map((el) => {
    if (!el || el.isDeleted) return el;

    // 1. 同步容器绑定文字 (Container Bound Text)
    if (el.type === 'text' && el.containerId) {
      const container = byId.get(el.containerId);
      if (container) {
        const cb = getElementBounds(container);
        const fontSize = el.fontSize || 16;
        const lineCount = String(el.text || '').split('\n').length;
        const textH = Math.max(22, lineCount * fontSize * 1.3);
        const textW = Math.max(40, cb.width - 20);
        return {
          ...el,
          x: cb.x + (cb.width - textW) / 2,
          y: cb.y + (cb.height - textH) / 2,
          width: textW,
          height: textH,
        };
      }
    }

    // 2. 同步绑定箭头 (Bound Arrows)
    if (el.type === 'arrow' && (el.startBinding?.elementId || el.endBinding?.elementId)) {
      const startTarget = el.startBinding?.elementId ? byId.get(el.startBinding.elementId) : null;
      const endTarget = el.endBinding?.elementId ? byId.get(el.endBinding.elementId) : null;

      if (!startTarget && !endTarget) return el;

      const pts = Array.isArray(el.points) && el.points.length >= 2 ? el.points : [[0, 0], [el.width || 80, el.height || 0]];
      let startWorldX = el.x + (pts[0][0] || 0);
      let startWorldY = el.y + (pts[0][1] || 0);
      let endWorldX = el.x + (pts[pts.length - 1][0] || 0);
      let endWorldY = el.y + (pts[pts.length - 1][1] || 0);

      const resolvePortPoint = (target: any, portHint: AnchorPortId | undefined, oppositeX: number, oppositeY: number) => {
        const ports = getElementAnchorPorts(target).filter((p) => p.port !== 'center');
        if (ports.length === 0) {
          const b = getElementBounds(target);
          return { x: b.cx, y: b.cy };
        }
        if (portHint && portHint !== 'center') {
          const matched = ports.find((p) => p.port === portHint);
          if (matched) return { x: matched.x, y: matched.y };
        }
        // 自动选取朝向对端最近的正交锚点
        let best = ports[0];
        let bestDist = Infinity;
        for (const p of ports) {
          const d = Math.hypot(p.x - oppositeX, p.y - oppositeY);
          if (d < bestDist) {
            bestDist = d;
            best = p;
          }
        }
        return { x: best.x, y: best.y };
      };

      if (startTarget) {
        const refX = endTarget ? getElementBounds(endTarget).cx : endWorldX;
        const refY = endTarget ? getElementBounds(endTarget).cy : endWorldY;
        const p = resolvePortPoint(startTarget, el.startBinding?.port, refX, refY);
        startWorldX = p.x;
        startWorldY = p.y;
      }

      if (endTarget) {
        const refX = startTarget ? getElementBounds(startTarget).cx : startWorldX;
        const refY = startTarget ? getElementBounds(startTarget).cy : startWorldY;
        const p = resolvePortPoint(endTarget, el.endBinding?.port, refX, refY);
        endWorldX = p.x;
        endWorldY = p.y;
      }

      const dx = endWorldX - startWorldX;
      const dy = endWorldY - startWorldY;
      return {
        ...el,
        x: startWorldX,
        y: startWorldY,
        width: dx,
        height: dy,
        points: [
          [0, 0],
          [dx, dy],
        ],
      };
    }

    return el;
  });
}

/**
 * 8 向多选对齐与水平/垂直等距分布
 */
export type AlignmentAction =
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-top'
  | 'align-middle'
  | 'align-bottom'
  | 'distribute-horizontal'
  | 'distribute-vertical';

export function alignAndDistributeElements(
  elements: any[],
  selectedIds: Set<string>,
  action: AlignmentAction
): any[] {
  const selected = elements.filter(
    (el) => el && !el.isDeleted && selectedIds.has(el.id) && !(el.type === 'text' && el.containerId)
  );
  if (selected.length < 2) return elements;

  const union = getSelectionBounds(elements, selectedIds);
  if (!union) return elements;

  const deltaMap = new Map<string, { dx: number; dy: number }>();

  if (action === 'distribute-horizontal' && selected.length >= 3) {
    const sorted = [...selected].sort((a, b) => getElementBounds(a).cx - getElementBounds(b).cx);
    const first = getElementBounds(sorted[0]).cx;
    const last = getElementBounds(sorted[sorted.length - 1]).cx;
    const step = (last - first) / (sorted.length - 1);
    sorted.forEach((el, idx) => {
      const b = getElementBounds(el);
      deltaMap.set(el.id, { dx: first + idx * step - b.cx, dy: 0 });
    });
  } else if (action === 'distribute-vertical' && selected.length >= 3) {
    const sorted = [...selected].sort((a, b) => getElementBounds(a).cy - getElementBounds(b).cy);
    const first = getElementBounds(sorted[0]).cy;
    const last = getElementBounds(sorted[sorted.length - 1]).cy;
    const step = (last - first) / (sorted.length - 1);
    sorted.forEach((el, idx) => {
      const b = getElementBounds(el);
      deltaMap.set(el.id, { dx: 0, dy: first + idx * step - b.cy });
    });
  } else {
    selected.forEach((el) => {
      const b = getElementBounds(el);
      let dx = 0;
      let dy = 0;
      if (action === 'align-left') dx = union.x - b.x;
      if (action === 'align-center') dx = union.cx - b.cx;
      if (action === 'align-right') dx = union.right - b.right;
      if (action === 'align-top') dy = union.y - b.y;
      if (action === 'align-middle') dy = union.cy - b.cy;
      if (action === 'align-bottom') dy = union.bottom - b.bottom;
      deltaMap.set(el.id, { dx, dy });
    });
  }

  const moved = elements.map((el) => {
    const d = deltaMap.get(el.id);
    if (!d) return el;
    return {
      ...el,
      x: (el.x || 0) + d.dx,
      y: (el.y || 0) + d.dy,
      version: (el.version || 1) + 1,
    };
  });

  return syncBoundElementsAfterTransform(moved);
}

/**
 * 图层 Z-Order 顺序调整 (置顶 / 上移一层 / 下移一层 / 置底)
 */
export type LayerOrderAction = 'front' | 'forward' | 'backward' | 'back';

export function reorderElementsLayer(
  elements: any[],
  selectedIds: Set<string>,
  action: LayerOrderAction
): any[] {
  if (selectedIds.size === 0) return elements;
  const list = [...elements];

  // 连带包含绑定在选中容器上的内部文字
  const fullSelected = new Set(selectedIds);
  list.forEach((el) => {
    if (el?.type === 'text' && el.containerId && selectedIds.has(el.containerId)) {
      fullSelected.add(el.id);
    }
  });

  if (action === 'front') {
    const unsel = list.filter((el) => !fullSelected.has(el.id));
    const sel = list.filter((el) => fullSelected.has(el.id));
    return [...unsel, ...sel];
  }
  if (action === 'back') {
    const unsel = list.filter((el) => !fullSelected.has(el.id));
    const sel = list.filter((el) => fullSelected.has(el.id));
    return [...sel, ...unsel];
  }
  if (action === 'forward') {
    for (let i = list.length - 2; i >= 0; i--) {
      if (fullSelected.has(list[i].id) && !fullSelected.has(list[i + 1].id)) {
        const tmp = list[i];
        list[i] = list[i + 1];
        list[i + 1] = tmp;
      }
    }
    return list;
  }
  if (action === 'backward') {
    for (let i = 1; i < list.length; i++) {
      if (fullSelected.has(list[i].id) && !fullSelected.has(list[i - 1].id)) {
        const tmp = list[i];
        list[i] = list[i - 1];
        list[i - 1] = tmp;
      }
    }
    return list;
  }
  return list;
}

/**
 * 克隆复制选中的图元 (Ctrl+D / Alt+拖拽)，自动映射内部容器文字与绑定关系
 */
export function cloneSelectedElements(
  elements: any[],
  selectedIds: Set<string>,
  offsetX = 28,
  offsetY = 28
): { nextElements: any[]; newSelectedIds: string[] } {
  if (selectedIds.size === 0) return { nextElements: elements, newSelectedIds: [] };

  const idMap = new Map<string, string>();
  const stamp = Date.now();
  const toClone = elements.filter(
    (el) =>
      el &&
      !el.isDeleted &&
      (selectedIds.has(el.id) || (el.type === 'text' && el.containerId && selectedIds.has(el.containerId)))
  );

  toClone.forEach((el, idx) => {
    idMap.set(el.id, `${el.type}-${stamp}-${idx}`);
  });

  const cloned = toClone.map((el, idx) => {
    const newId = idMap.get(el.id)!;
    const newContainerId = el.containerId && idMap.has(el.containerId) ? idMap.get(el.containerId) : null;
    const newBoundElements = Array.isArray(el.boundElements)
      ? el.boundElements
          .filter((b: any) => idMap.has(b.id))
          .map((b: any) => ({ ...b, id: idMap.get(b.id)! }))
      : null;

    return {
      ...el,
      id: newId,
      x: (el.x || 0) + offsetX,
      y: (el.y || 0) + offsetY,
      containerId: newContainerId,
      boundElements: newBoundElements,
      seed: Math.floor(Math.random() * 100000) + idx,
      version: 1,
    };
  });

  const newSelectedIds = cloned
    .filter((el) => !(el.type === 'text' && el.containerId))
    .map((el) => el.id);

  return {
    nextElements: [...elements, ...cloned],
    newSelectedIds,
  };
}

/**
 * 编组与解组 (Ctrl+G / Ctrl+Shift+G)
 */
export function groupSelectedElements(elements: any[], selectedIds: Set<string>): any[] {
  if (selectedIds.size < 2) return elements;
  const newGroupId = `grp-${Date.now()}`;
  return elements.map((el) => {
    if (!el || el.isDeleted || !selectedIds.has(el.id)) return el;
    const existing = Array.isArray(el.groupIds) ? el.groupIds : [];
    return {
      ...el,
      groupIds: [...existing, newGroupId],
    };
  });
}

export function ungroupSelectedElements(elements: any[], selectedIds: Set<string>): any[] {
  if (selectedIds.size === 0) return elements;
  return elements.map((el) => {
    if (!el || el.isDeleted || !selectedIds.has(el.id)) return el;
    return {
      ...el,
      groupIds: [],
    };
  });
}
