/**
 * OmniView SVG 编辑引擎 v2 — SVG path d ↔ Anchor[] 编解码器 (ADR-0001 §2.5)
 *
 * 解析 SVG path d 字符串为 Anchor 数组；序列化反向。
 *
 * 支持命令：M m L l H h V v C c S s Q q A a T t Z z
 *
 * 简化策略：
 *   - 所有命令解析为绝对坐标（M/L/C/Q/A）；相对坐标按累计位移转绝对
 *   - 缺失控制柄用 corner 表示
 *   - A 弧线按 SVG F.6 端点→中心参数化拆为 ≤90° 的三阶贝塞尔段（P0 保形近似；
 *     序列化输出 C，几何形状保真，误差 < 0.03% 半径）
 *   - S/T 按镜像规则解出控制柄，按 C/Q 等价段落锚点
 */

import type { Anchor, Node, PathGeometry, PathNode, SubPath, Vec2 } from './types';
import { anchorCorner, anchorSmooth, pathGeometry, subPath, vec2 } from './document';

// ============================================================================
// 1. 解析 d → Anchor[]
// ============================================================================

/**
 * 解析 path d 字符串为 PathGeometry。
 *
 * @param d SVG path d 属性字符串
 * @returns PathGeometry（含若干 SubPath，每个 SubPath 是一段连续锚点序列）
 */
export function parsePathD(d: string): PathGeometry {
  const tokens = tokenizePathD(d);
  const segments: Array<{ anchors: Anchor[]; closed: boolean }> = [];
  let cur: Anchor[] = [];
  let closed = false;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let lastCmd = '';
  // 上一曲线控制点（绝对坐标）与类型，供 S/T 镜像；非曲线命令后清空
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastCtrlKind: 'C' | 'Q' | '' = '';

  const commit = () => {
    if (cur.length > 0) {
      segments.push({ anchors: cur, closed });
    }
    cur = [];
    closed = false;
  };

  let i = 0;
  while (i < tokens.length) {
    let cmd = tokens[i] as string;
    if (/[A-Za-z]/.test(cmd)) {
      i++;
    } else {
      // 隐式重复上一条命令
      cmd = lastCmd;
    }

    switch (cmd) {
      case 'M': {
        if (cur.length > 0) commit();
        x = Number(tokens[i++]);
        y = Number(tokens[i++]);
        startX = x;
        startY = y;
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'L'; // M 后隐式 L
        lastCtrlKind = '';
        break;
      }
      case 'm': {
        if (cur.length > 0) commit();
        x += Number(tokens[i++]);
        y += Number(tokens[i++]);
        startX = x;
        startY = y;
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'l';
        lastCtrlKind = '';
        break;
      }
      case 'L': {
        x = Number(tokens[i++]);
        y = Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'L';
        lastCtrlKind = '';
        break;
      }
      case 'l': {
        x += Number(tokens[i++]);
        y += Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'l';
        lastCtrlKind = '';
        break;
      }
      case 'H': {
        x = Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'H';
        lastCtrlKind = '';
        break;
      }
      case 'h': {
        x += Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'h';
        lastCtrlKind = '';
        break;
      }
      case 'V': {
        y = Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'V';
        lastCtrlKind = '';
        break;
      }
      case 'v': {
        y += Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'v';
        lastCtrlKind = '';
        break;
      }
      case 'C': {
        const c1x = Number(tokens[i++]); const c1y = Number(tokens[i++]);
        const c2x = Number(tokens[i++]); const c2y = Number(tokens[i++]);
        const ex = Number(tokens[i++]); const ey = Number(tokens[i++]);
        const prev = cur[cur.length - 1];
        if (prev) {
          const updated: Anchor = {
            point: prev.point,
            handleOut: vec2(c1x - x, c1y - y),
            handleIn: prev.handleIn,
            kind: prev.kind,
          };
          cur[cur.length - 1] = updated;
        }
        lastCtrlX = c2x;
        lastCtrlY = c2y;
        lastCtrlKind = 'C';
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2(c2x - x, c2y - y),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = 'C';
        break;
      }
      case 'c': {
        const c1x = x + Number(tokens[i++]); const c1y = y + Number(tokens[i++]);
        const c2x = x + Number(tokens[i++]); const c2y = y + Number(tokens[i++]);
        const ex = x + Number(tokens[i++]); const ey = y + Number(tokens[i++]);
        const prev = cur[cur.length - 1];
        if (prev) {
          const updated: Anchor = {
            point: prev.point,
            handleOut: vec2(c1x - x, c1y - y),
            handleIn: prev.handleIn,
            kind: prev.kind,
          };
          cur[cur.length - 1] = updated;
        }
        lastCtrlX = c2x;
        lastCtrlY = c2y;
        lastCtrlKind = 'C';
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2(c2x - x, c2y - y),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = 'c';
        break;
      }
      case 'S':
      case 's': {
        // S：第一控制点 = 上一 C/S 第二控制点的镜像；上一命令非 C/S 时取当前点
        const isPrevCubic = lastCtrlKind === 'C';
        const reflX = isPrevCubic ? 2 * x - lastCtrlX : x;
        const reflY = isPrevCubic ? 2 * y - lastCtrlY : y;
        const c2x = cmd === 'S' ? Number(tokens[i++]) : x + Number(tokens[i++]);
        const c2y = cmd === 'S' ? Number(tokens[i++]) : y + Number(tokens[i++]);
        const ex = cmd === 'S' ? Number(tokens[i++]) : x + Number(tokens[i++]);
        const ey = cmd === 'S' ? Number(tokens[i++]) : y + Number(tokens[i++]);
        const prev = cur[cur.length - 1];
        if (prev) {
          const updated: Anchor = {
            point: prev.point,
            handleOut: vec2(reflX - x, reflY - y),
            handleIn: prev.handleIn,
            kind: prev.kind,
          };
          cur[cur.length - 1] = updated;
        }
        lastCtrlX = c2x;
        lastCtrlY = c2y;
        lastCtrlKind = 'C';
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2(c2x - x, c2y - y),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = cmd === 'S' ? 'S' : 's';
        break;
      }
      case 'Q': {
        const c1x = Number(tokens[i++]); const c1y = Number(tokens[i++]);
        const ex = Number(tokens[i++]); const ey = Number(tokens[i++]);
        // 二次曲线 → 锚点句柄：等价三阶贝塞尔（2/3 分点）
        const sx = x; const sy = y;
        applyQuadHandles(cur, sx, sy, c1x, c1y);
        lastCtrlX = c1x;
        lastCtrlY = c1y;
        lastCtrlKind = 'Q';
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2((2 / 3) * (c1x - x), (2 / 3) * (c1y - y)),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = 'Q';
        break;
      }
      case 'q': {
        const c1x = x + Number(tokens[i++]); const c1y = y + Number(tokens[i++]);
        const ex = x + Number(tokens[i++]); const ey = y + Number(tokens[i++]);
        const sx = x; const sy = y;
        applyQuadHandles(cur, sx, sy, c1x, c1y);
        lastCtrlX = c1x;
        lastCtrlY = c1y;
        lastCtrlKind = 'Q';
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2((2 / 3) * (c1x - x), (2 / 3) * (c1y - y)),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = 'q';
        break;
      }
      case 'T':
      case 't': {
        // T：控制点 = 上一 Q/T 控制点关于当前点的镜像；上一命令非 Q/T 时取当前点（退化为直线）
        const isPrevQuad = lastCtrlKind === 'Q';
        const c1x = isPrevQuad ? 2 * x - lastCtrlX : x;
        const c1y = isPrevQuad ? 2 * y - lastCtrlY : y;
        const ex = cmd === 'T' ? Number(tokens[i++]) : x + Number(tokens[i++]);
        const ey = cmd === 'T' ? Number(tokens[i++]) : y + Number(tokens[i++]);
        const sx = x; const sy = y;
        applyQuadHandles(cur, sx, sy, c1x, c1y);
        lastCtrlX = c1x;
        lastCtrlY = c1y;
        lastCtrlKind = 'Q';
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2((2 / 3) * (c1x - x), (2 / 3) * (c1y - y)),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = cmd === 'T' ? 'T' : 't';
        break;
      }
      case 'A':
      case 'a': {
        // SVG F.6：rx ry x-rotation large-arc sweep x y → ≤90° 三阶贝塞尔段
        const rx = Number(tokens[i++]); const ry = Number(tokens[i++]);
        const xRot = Number(tokens[i++]);
        const large = Number(tokens[i++]); const sweep = Number(tokens[i++]);
        const ex = cmd === 'A' ? Number(tokens[i++]) : x + Number(tokens[i++]);
        const ey = cmd === 'A' ? Number(tokens[i++]) : y + Number(tokens[i++]);
        const cubics = arcToCubics(x, y, rx, ry, xRot, large !== 0, sweep !== 0, ex, ey);
        if (cubics.length === 0) {
          // 退化弧（零半径 / 零长度）→ 直线段
          cur.push(anchorCorner(vec2(ex, ey)));
          x = ex;
          y = ey;
        }
        for (const seg of cubics) {
          const prev = cur[cur.length - 1];
          if (prev) {
            cur[cur.length - 1] = {
              point: prev.point,
              handleOut: vec2(seg.c1x - x, seg.c1y - y),
              handleIn: prev.handleIn,
              kind: prev.kind,
            };
          }
          const px = seg.x; const py = seg.y;
          cur.push({
            point: vec2(px, py),
            handleIn: vec2(seg.c2x - px, seg.c2y - py),
            handleOut: null,
            kind: 'smooth',
          });
          x = px;
          y = py;
        }
        lastCmd = 'A';
        lastCtrlKind = '';
        break;
      }
      case 'Z':
      case 'z': {
        closed = true;
        x = startX;
        y = startY;
        commit();
        lastCmd = cmd;
        lastCtrlKind = '';
        break;
      }
      default: {
        // 跳过未知命令
        i++;
      }
    }
  }
  commit();
  if (segments.length === 0) {
    return pathGeometry([subPath([], false)]);
  }
  return mapSegments(segments);
}

function mapSegments(segments: ReadonlyArray<{ anchors: Anchor[]; closed: boolean }>): PathGeometry {
  const subs: SubPath[] = segments.map((seg) => subPath(seg.anchors, seg.closed));
  return pathGeometry(subs);
}

/** 二次曲线控制点写入起点句柄（2/3 分点 → 等价三阶贝塞尔）。 */
function applyQuadHandles(
  cur: Anchor[],
  sx: number,
  sy: number,
  c1x: number,
  c1y: number,
): void {
  const prev = cur[cur.length - 1];
  if (!prev) return;
  const hx = (2 / 3) * (c1x - sx);
  const hy = (2 / 3) * (c1y - sy);
  cur[cur.length - 1] = {
    point: prev.point,
    handleOut: hx === 0 && hy === 0 ? prev.handleOut : vec2(hx, hy),
    handleIn: prev.handleIn,
    kind: prev.kind,
  };
}

interface CubicSeg {
  readonly c1x: number; readonly c1y: number;
  readonly c2x: number; readonly c2y: number;
  readonly x: number; readonly y: number;
}

function vecAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  const denom = len === 0 ? 1 : len;
  let n = Math.acos(Math.min(1, Math.max(-1, dot / denom)));
  if (ux * vy - uy * vx < 0) n = -n;
  return n;
}

/**
 * SVG 弧线 → 三阶贝塞尔段（F.6.5 端点→中心参数化 + 每段 ≤90° kappa 近似）。
 *
 * @returns 每段为绝对坐标控制点；退化（零半径 / 零长度）返回 []（调用方按直线处理）
 */
export function arcToCubics(
  x1: number, y1: number,
  rxIn: number, ryIn: number,
  xRotDeg: number,
  largeArc: boolean, sweep: boolean,
  x2: number, y2: number,
): CubicSeg[] {
  if (rxIn === 0 || ryIn === 0 || (x1 === x2 && y1 === y2)) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const phi = (xRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const sign = largeArc !== sweep ? 1 : -1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = den === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / den));
  const cxp = co * ((rx * y1p) / ry);
  const cyp = co * ((-ry * x1p) / rx);
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = vecAngle(1, 0, ux, uy);
  let dTheta = vecAngle(ux, uy, vx, vy);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const segCount = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segCount;
  const t = (4 / 3) * Math.tan(delta / 4);
  const toWorld = (px: number, py: number): { x: number; y: number } => ({
    x: cosPhi * px - sinPhi * py + cx,
    y: sinPhi * px + cosPhi * py + cy,
  });

  const segs: CubicSeg[] = [];
  let theta = theta1;
  for (let k = 0; k < segCount; k++) {
    const cos1 = Math.cos(theta);
    const sin1 = Math.sin(theta);
    const cos2 = Math.cos(theta + delta);
    const sin2 = Math.sin(theta + delta);
    const p1 = toWorld(rx * cos1, ry * sin1);
    const p2 = toWorld(rx * cos2, ry * sin2);
    const c1 = toWorld(rx * cos1 + t * -rx * sin1, ry * sin1 + t * ry * cos1);
    const c2 = toWorld(rx * cos2 - t * -rx * sin2, ry * cos2 - t * ry * sin2);
    segs.push({ c1x: c1.x, c1y: c1.y, c2x: c2.x, c2y: c2.y, x: p2.x, y: p2.y });
    void p1;
    theta += delta;
  }
  const last = segs[segs.length - 1];
  if (last) {
    // 端点对齐（消除浮点漂移）
    segs[segs.length - 1] = { ...last, x: x2, y: y2 };
  }
  return segs;
}

/** 把 path d 字符串 token 化。命令字母独立成 token；数字独立成 token；负号紧贴前值视为整体。 */
function tokenizePathD(d: string): string[] {
  const tokens: string[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[1] ?? m[2] ?? '');
  }
  return tokens;
}

// ============================================================================
// 2. 序列化 Anchor[] → d
// ============================================================================

/** 把 PathGeometry 序列化为 SVG path d 字符串。 */
export function serializePathD(g: PathGeometry, precision = 3): string {
  const parts: string[] = [];
  for (const sub of g.subPaths) {
    serializeSubPath(sub, parts, precision);
    if (sub.closed) parts.push('Z');
  }
  return parts.join(' ');
}

function serializeSubPath(sub: SubPath, parts: string[], precision: number): void {
  const anchors = sub.anchors;
  if (anchors.length === 0) return;
  const fmt = (n: number) => Number(n.toFixed(precision)).toString();
  const first = anchors[0]!;
  parts.push(`M ${fmt(first.point.x)} ${fmt(first.point.y)}`);

  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]!;
    const cur = anchors[i]!;
    if (prev.handleOut || cur.handleIn) {
      const hOut = prev.handleOut ?? { x: 0, y: 0 };
      const hIn = cur.handleIn ?? { x: 0, y: 0 };
      const c1 = vec2(prev.point.x + hOut.x, prev.point.y + hOut.y);
      const c2 = vec2(cur.point.x + hIn.x, cur.point.y + hIn.y);
      parts.push(`C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(cur.point.x)} ${fmt(cur.point.y)}`);
    } else {
      parts.push(`L ${fmt(cur.point.x)} ${fmt(cur.point.y)}`);
    }
  }

  // 闭合子路径若首尾锚点不重合且携带贝塞尔控制柄（如 createEllipseGeometry 4 锚点圆/椭圆），补齐闭合曲线段
  if (sub.closed && anchors.length > 1) {
    const last = anchors[anchors.length - 1]!;
    const notSamePoint =
      Math.abs(last.point.x - first.point.x) > 1e-6 || Math.abs(last.point.y - first.point.y) > 1e-6;
    if (notSamePoint && (last.handleOut || first.handleIn)) {
      const hOut = last.handleOut ?? { x: 0, y: 0 };
      const hIn = first.handleIn ?? { x: 0, y: 0 };
      const c1 = vec2(last.point.x + hOut.x, last.point.y + hOut.y);
      const c2 = vec2(first.point.x + hIn.x, first.point.y + hIn.y);
      parts.push(`C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(first.point.x)} ${fmt(first.point.y)}`);
    }
  }
}

// ============================================================================
// 3. 几何辅助
// ============================================================================

/** 计算 PathGeometry 的轴对齐包围盒（含贝塞尔曲线段采样极值）。 */
export function getBoundingBox(g: PathGeometry): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const expand = (px: number, py: number) => {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  };
  for (const sub of g.subPaths) {
    const anchors = sub.anchors;
    for (const a of anchors) {
      expand(a.point.x, a.point.y);
    }
    if (anchors.length >= 2) {
      const segCount = sub.closed ? anchors.length : anchors.length - 1;
      for (let i = 0; i < segCount; i++) {
        const a = anchors[i]!;
        const b = anchors[(i + 1) % anchors.length]!;
        if (a.handleOut || b.handleIn) {
          const p0x = a.point.x;
          const p0y = a.point.y;
          const p1x = a.point.x + (a.handleOut?.x ?? 0);
          const p1y = a.point.y + (a.handleOut?.y ?? 0);
          const p2x = b.point.x + (b.handleIn?.x ?? 0);
          const p2y = b.point.y + (b.handleIn?.y ?? 0);
          const p3x = b.point.x;
          const p3y = b.point.y;
          for (const t of [0.2, 0.4, 0.5, 0.6, 0.8]) {
            const mt = 1 - t;
            const mt2 = mt * mt;
            const t2 = t * t;
            const cx = mt2 * mt * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t2 * t * p3x;
            const cy = mt2 * mt * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t2 * t * p3y;
            expand(cx, cy);
          }
        }
      }
    }
  }
  if (!isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 创建矩形几何（支持圆角）。 */
export function createRectGeometry(x: number, y: number, width: number, height: number, rx = 0, ry = 0): PathGeometry {
  if (rx <= 0 && ry <= 0) {
    return pathGeometry([
      subPath([
        anchorCorner(vec2(x, y)),
        anchorCorner(vec2(x + width, y)),
        anchorCorner(vec2(x + width, y + height)),
        anchorCorner(vec2(x, y + height)),
      ], true),
    ]);
  }
  const rrx = Math.min(rx, width / 2);
  const rry = Math.min(ry > 0 ? ry : rx, height / 2);
  const d = [
    `M ${x + rrx} ${y}`,
    `L ${x + width - rrx} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + rry}`,
    `L ${x + width} ${y + height - rry}`,
    `Q ${x + width} ${y + height} ${x + width - rrx} ${y + height}`,
    `L ${x + rrx} ${y + height}`,
    `Q ${x} ${y + height} ${x} ${y + height - rry}`,
    `L ${x} ${y + rry}`,
    `Q ${x} ${y} ${x + rrx} ${y}`,
    'Z',
  ].join(' ');
  return parsePathD(d);
}

/** 创建椭圆/圆形几何（4 锚点平滑三次贝塞尔闭合环）。 */
export function createEllipseGeometry(cx: number, cy: number, rx: number, ry: number): PathGeometry {
  const kx = rx * 0.5522847498307936;
  const ky = ry * 0.5522847498307936;
  return pathGeometry([
    subPath([
      anchorSmooth(vec2(cx, cy - ry), vec2(-kx, 0), vec2(kx, 0)),
      anchorSmooth(vec2(cx + rx, cy), vec2(0, -ky), vec2(0, ky)),
      anchorSmooth(vec2(cx, cy + ry), vec2(kx, 0), vec2(-kx, 0)),
      anchorSmooth(vec2(cx - rx, cy), vec2(0, ky), vec2(0, -ky)),
    ], true),
  ]);
}

/** 创建直线几何。 */
export function createLineGeometry(x1: number, y1: number, x2: number, y2: number): PathGeometry {
  return pathGeometry([
    subPath([
      anchorCorner(vec2(x1, y1)),
      anchorCorner(vec2(x2, y2)),
    ], false),
  ]);
}

/**
 * 创建平滑贝塞尔曲线几何（支持 S 形平滑连接曲线与 C 形拱形弧线）。
 *
 * - `'s'` (默认)：根据起止点主方向生成平滑 S 形三次贝塞尔连接线
 * - `'arc'`：沿起止连线法向拱起生成对称 C 形平滑弧线
 */
export function createCurveGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mode: 's' | 'arc' = 's',
): PathGeometry {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (mode === 'arc') {
    const safeLen = Math.max(len, 1);
    let nx = dy / safeLen;
    let ny = -dx / safeLen;
    // 默认向画布上方（ny <= 0）或左侧拱起，保持视觉直觉一致
    if (ny > 0 || (Math.abs(ny) < 1e-6 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
    const sagitta = Math.max(len * 0.28, 20);
    const midX = (x1 + x2) / 2 + nx * sagitta;
    const midY = (y1 + y2) / 2 + ny * sagitta;
    // 等价二次贝塞尔控制点 C = 2*M - 0.5*(P0 + P3)，再按 2/3 映射至三次贝塞尔手柄
    const ctrlX = 2 * midX - 0.5 * (x1 + x2);
    const ctrlY = 2 * midY - 0.5 * (y1 + y2);
    const hOut = vec2((2 / 3) * (ctrlX - x1), (2 / 3) * (ctrlY - y1));
    const hIn = vec2((2 / 3) * (ctrlX - x2), (2 / 3) * (ctrlY - y2));
    return pathGeometry([
      subPath(
        [
          { point: vec2(x1, y1), handleIn: null, handleOut: hOut, kind: 'smooth' },
          { point: vec2(x2, y2), handleIn: hIn, handleOut: null, kind: 'smooth' },
        ],
        false,
      ),
    ]);
  }

  // S 形平滑连接曲线：当水平与垂直跨度均较小时，退化为带法向偏移的优雅微弧，避免纯直线重合
  if (Math.abs(dx) < 8 || Math.abs(dy) < 8) {
    const safeLen = Math.max(len, 1);
    let nx = dy / safeLen;
    let ny = -dx / safeLen;
    if (ny > 0 || (Math.abs(ny) < 1e-6 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
    const bend = Math.max(len * 0.25, 18);
    const hOut = vec2(dx * 0.33 + nx * bend, dy * 0.33 + ny * bend);
    const hIn = vec2(-dx * 0.33 - nx * bend, -dy * 0.33 - ny * bend);
    return pathGeometry([
      subPath(
        [
          { point: vec2(x1, y1), handleIn: null, handleOut: hOut, kind: 'smooth' },
          { point: vec2(x2, y2), handleIn: hIn, handleOut: null, kind: 'smooth' },
        ],
        false,
      ),
    ]);
  }

  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  const hOut = isHorizontal ? vec2(dx * 0.5, 0) : vec2(0, dy * 0.5);
  const hIn = isHorizontal ? vec2(-dx * 0.5, 0) : vec2(0, -dy * 0.5);
  return pathGeometry([
    subPath(
      [
        { point: vec2(x1, y1), handleIn: null, handleOut: hOut, kind: 'smooth' },
        { point: vec2(x2, y2), handleIn: hIn, handleOut: null, kind: 'smooth' },
      ],
      false,
    ),
  ]);
}

/**
 * 判断几何路径是否为轴对齐矩形或圆角矩形，并推断其圆角半径（本地坐标系）。
 * 若不是矩形则返回 null；若是直角矩形返回 0；若是圆角矩形返回 >0 的圆角半径。
 */
export function inferRectGeometryRadius(g: PathGeometry): number | null {
  if (g.subPaths.length !== 1) return null;
  const sp = g.subPaths[0];
  if (!sp || !sp.closed) return null;
  const anchors = sp.anchors;
  if (anchors.length < 4 || anchors.length > 10) return null;

  const bb = getBoundingBox(g);
  if (bb.width <= 1e-3 || bb.height <= 1e-3) return null;
  const tol = Math.max(1.5, Math.min(bb.width, bb.height) * 0.02);

  // 所有锚点必须落在外包矩形的四条边上
  const allOnBoundary = anchors.every((a) => {
    const onLeft = Math.abs(a.point.x - bb.x) <= tol;
    const onRight = Math.abs(a.point.x - (bb.x + bb.width)) <= tol;
    const onTop = Math.abs(a.point.y - bb.y) <= tol;
    const onBottom = Math.abs(a.point.y - (bb.y + bb.height)) <= tol;
    return onLeft || onRight || onTop || onBottom;
  });
  if (!allOnBoundary) return null;

  // 4 锚点（或首尾重合 5 锚点）且全部无控制柄 -> 直角矩形
  if (anchors.length === 4 || anchors.length === 5) {
    const allSharp = anchors.every((a) => a.handleIn == null && a.handleOut == null);
    if (!allSharp) return null;
    const hasTL = anchors.some((a) => Math.abs(a.point.x - bb.x) <= tol && Math.abs(a.point.y - bb.y) <= tol);
    const hasTR = anchors.some((a) => Math.abs(a.point.x - (bb.x + bb.width)) <= tol && Math.abs(a.point.y - bb.y) <= tol);
    const hasBR = anchors.some((a) => Math.abs(a.point.x - (bb.x + bb.width)) <= tol && Math.abs(a.point.y - (bb.y + bb.height)) <= tol);
    const hasBL = anchors.some((a) => Math.abs(a.point.x - bb.x) <= tol && Math.abs(a.point.y - (bb.y + bb.height)) <= tol);
    return hasTL && hasTR && hasBR && hasBL ? 0 : null;
  }

  // 8 ~ 10 锚点且包含至少 4 个带曲线控制柄的圆角锚点 -> 圆角矩形
  const curvedCount = anchors.filter((a) => a.handleIn != null || a.handleOut != null).length;
  if (curvedCount < 4) return null;

  const topAnchors = anchors.filter((a) => Math.abs(a.point.y - bb.y) <= tol);
  if (topAnchors.length === 0) return null;
  const minTopX = Math.min(...topAnchors.map((a) => a.point.x));
  const rx = Math.max(0, minTopX - bb.x);
  return Math.round(rx * 10) / 10;
}

/**
 * 判断节点是否为矩形节点（通过 primitiveHint、显式 rx/ry/cornerRadius、名称或封闭直角/圆角矩形几何特征判定）。
 */
export function isRectNode(node: Node | undefined | null): node is PathNode {
  if (!node || node.kind !== 'Path') return false;
  if (node.primitiveHint === 'rect') return true;
  if (node.cornerRadius !== undefined || node.rx !== undefined) return true;
  if (node.name?.toLowerCase().includes('rect') || node.name?.includes('矩形')) return true;
  return inferRectGeometryRadius(node.geometry) !== null;
}

/**
 * 获取矩形节点的当前圆角半径（优先读取显式 rx/cornerRadius，否则从圆角矩形几何中反推）。
 */
export function getRectCornerRadius(node: PathNode): number {
  if (node.rx !== undefined) return Math.round(node.rx * 10) / 10;
  if (node.cornerRadius !== undefined) return Math.round(node.cornerRadius * 10) / 10;
  return inferRectGeometryRadius(node.geometry) ?? 0;
}

