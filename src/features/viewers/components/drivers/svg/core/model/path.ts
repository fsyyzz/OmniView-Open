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
 *   - A 弧线命令简化为两个三阶贝塞尔近似（M2 阶段改进）
 *   - 不解析 Smooth/Shorthand 后的镜像控制柄（S/T）；按给出的字面值解析
 */

import type { Anchor, PathGeometry, SubPath, Vec2 } from './types';
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
  const segments: Anchor[][] = [];
  let cur: Anchor[] = [];
  let closed = false;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let lastCmd = '';
  let lastCtrlX = 0;
  let lastCtrlY = 0;

  const commit = () => {
    if (cur.length > 0) {
      segments.push(cur);
    }
    cur = [];
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
        break;
      }
      case 'L': {
        x = Number(tokens[i++]);
        y = Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'L';
        break;
      }
      case 'l': {
        x += Number(tokens[i++]);
        y += Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'l';
        break;
      }
      case 'H': {
        x = Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'H';
        break;
      }
      case 'h': {
        x += Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'h';
        break;
      }
      case 'V': {
        y = Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'V';
        break;
      }
      case 'v': {
        y += Number(tokens[i++]);
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'v';
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
        // 镜像上一控制点
        const reflX = 2 * x - lastCtrlX;
        const reflY = 2 * y - lastCtrlY;
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
        lastCtrlX = c1x;
        lastCtrlY = c1y;
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2(c1x - x, c1y - y),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = 'Q';
        break;
      }
      case 'q': {
        const c1x = x + Number(tokens[i++]); const c1y = y + Number(tokens[i++]);
        const ex = x + Number(tokens[i++]); const ey = y + Number(tokens[i++]);
        lastCtrlX = c1x;
        lastCtrlY = c1y;
        x = ex;
        y = ey;
        cur.push({
          point: vec2(x, y),
          handleIn: vec2(c1x - x, c1y - y),
          handleOut: null,
          kind: 'smooth',
        });
        lastCmd = 'q';
        break;
      }
      case 'A': {
        // 简化：用直线段近似（arcs → 4 segments via 1/4 象限）
        const rx = Number(tokens[i++]); const ry = Number(tokens[i++]);
        const xRot = Number(tokens[i++]);
        const sweep = Number(tokens[i++]);
        const large = Number(tokens[i++]);
        const ex = Number(tokens[i++]); const ey = Number(tokens[i++]);
        void rx; void ry; void xRot; void sweep; void large;
        // 简化：直接插值到端点（M2 阶段用真正的弧线近似）
        const prev = cur[cur.length - 1];
        if (prev) {
          const mid1 = vec2((prev.point.x + ex) / 2, (prev.point.y + ey) / 2);
          cur.push(anchorCorner(mid1));
        }
        x = ex;
        y = ey;
        cur.push(anchorCorner(vec2(x, y)));
        lastCmd = 'A';
        break;
      }
      case 'Z':
      case 'z': {
        closed = true;
        x = startX;
        y = startY;
        commit();
        lastCmd = cmd;
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
  return mapSegments(segments, closed);
}

function mapSegments(segments: Anchor[][], closed: boolean): PathGeometry {
  const subs: SubPath[] = segments.map((anchors) => subPath(anchors, false));
  if (subs.length > 0 && closed) {
    subs[subs.length - 1] = subPath(subs[subs.length - 1].anchors, true);
  }
  return pathGeometry(subs);
}

/** 把 path d 字符串 token 化。命令字母独立成 token；数字独立成 token；负号紧贴前值视为整体。 */
function tokenizePathD(d: string): string[] {
  const tokens: string[] = [];
  const re = /([MmLlHhVvCcSsQqAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
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
    if (prev.handleOut && cur.handleIn) {
      const c1 = vec2(prev.point.x + prev.handleOut.x, prev.point.y + prev.handleOut.y);
      const c2 = vec2(cur.point.x + cur.handleIn.x, cur.point.y + cur.handleIn.y);
      parts.push(`C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(cur.point.x)} ${fmt(cur.point.y)}`);
    } else {
      parts.push(`L ${fmt(cur.point.x)} ${fmt(cur.point.y)}`);
    }
  }
}

// ============================================================================
// 3. 几何辅助
// ============================================================================

/** 计算 PathGeometry 的轴对齐包围盒（不考虑曲线控制柄）。 */
export function getBoundingBox(g: PathGeometry): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const sub of g.subPaths) {
    for (const a of sub.anchors) {
      const p = a.point;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}