import React, { useId } from 'react';
import type { PptxElement, PptxShapeType } from '../../../lib/pptxEngine';

export interface PptxShapeSvgProps {
  element: PptxElement;
  fillOverride?: string;
  gradientOverride?: string;
  strokeOverride?: string;
  className?: string;
}

interface ParsedSvgGradient {
  type: 'linear' | 'radial';
  angleDeg: number;
  stops: Array<{ offset: string; color: string }>;
}

function parseCssGradientForSvg(css?: string): ParsedSvgGradient | null {
  if (!css) return null;
  const trimmed = css.trim();
  const isRadial = trimmed.startsWith('radial-gradient(');
  const isLinear = trimmed.startsWith('linear-gradient(');
  if (!isRadial && !isLinear) return null;

  const inner = trimmed.slice(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')'));
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());

  if (parts.length < 2) return null;

  let angleDeg = 180;
  let stopStartIdx = 0;
  if (isLinear && /deg$/i.test(parts[0])) {
    const deg = parseFloat(parts[0]);
    if (Number.isFinite(deg)) angleDeg = deg;
    stopStartIdx = 1;
  } else if (isRadial && (parts[0] === 'circle' || parts[0] === 'ellipse')) {
    stopStartIdx = 1;
  }

  const stops: Array<{ offset: string; color: string }> = [];
  const rawStops = parts.slice(stopStartIdx);
  rawStops.forEach((rawStop, idx) => {
    const match = rawStop.match(/^(.*?)\s+(\d+(?:\.\d+)?%)$/);
    if (match) {
      stops.push({ color: match[1].trim(), offset: match[2] });
    } else if (rawStop) {
      const pct = rawStops.length > 1 ? Math.round((idx / (rawStops.length - 1)) * 100) : 0;
      stops.push({ color: rawStop, offset: `${pct}%` });
    }
  });

  if (stops.length < 2) return null;
  return { type: isRadial ? 'radial' : 'linear', angleDeg, stops };
}

function getStrokeDashArray(dash?: PptxElement['strokeDash'], strokeW = 1): string | undefined {
  if (!dash || dash === 'solid') return undefined;
  const w = Math.max(1, strokeW);
  if (dash === 'dot') return `${w * 1.5} ${w * 2}`;
  if (dash === 'dash') return `${w * 4.5} ${w * 2.5}`;
  if (dash === 'dashDot') return `${w * 4.5} ${w * 2} ${w * 1.5} ${w * 2}`;
  return undefined;
}

/**
 * 读取 OOXML <a:gd name="adj" fmla="val ..."/> 参数（标准比例 0 ~ 100000）
 */
function getAdjRatio(
  adjusts: Record<string, number> | undefined,
  key: string,
  defaultRatio: number,
  min = 0,
  max = 1
): number {
  const raw = adjusts?.[key];
  if (raw === undefined || !Number.isFinite(raw)) return defaultRatio;
  return Math.max(min, Math.min(max, raw / 100000));
}

/**
 * 构建紧贴包围盒 [pad, w-pad] x [pad, h-pad] 的内接正 N 边形顶点串
 */
function buildRegularPolygonPoints(
  w: number,
  h: number,
  sides: number,
  pad: number,
  startAngleDeg = -90
): string {
  const rx = Math.max(1, (w - pad * 2) / 2);
  const ry = Math.max(1, (h - pad * 2) / 2);
  const rawPts: Array<{ x: number; y: number }> = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < sides; i++) {
    const rad = ((startAngleDeg + (i * 360) / sides) * Math.PI) / 180;
    const px = Math.cos(rad) * rx;
    const py = Math.sin(rad) * ry;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    rawPts.push({ x: px, y: py });
  }

  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);
  const targetW = Math.max(1, w - pad * 2);
  const targetH = Math.max(1, h - pad * 2);

  return rawPts
    .map(p => {
      const x = pad + ((p.x - minX) / spanX) * targetW;
      const y = pad + ((p.y - minY) / spanY) * targetH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * 构建正 N 角星形顶点串（支持 4/5/6/8/10/12/16/24/32 角星）
 */
function buildStarPoints(
  w: number,
  h: number,
  numPoints: number,
  pad: number,
  innerRatio: number
): string {
  const rx = Math.max(1, (w - pad * 2) / 2);
  const ry = Math.max(1, (h - pad * 2) / 2);
  const cx = w / 2;
  const cy = h / 2;
  const totalVerts = numPoints * 2;
  const step = 360 / totalVerts;
  const pts: string[] = [];

  for (let i = 0; i < totalVerts; i++) {
    const ratio = i % 2 === 0 ? 1 : innerRatio;
    const rad = ((-90 + i * step) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * rx * ratio;
    const y = cy + Math.sin(rad) * ry * ratio;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function getStarPointCount(shapeType: PptxShapeType): number {
  switch (shapeType) {
    case 'star4':
      return 4;
    case 'star6':
      return 6;
    case 'star8':
      return 8;
    case 'star10':
      return 10;
    case 'star12':
      return 12;
    case 'star16':
      return 16;
    case 'star24':
      return 24;
    case 'star32':
      return 32;
    case 'star5':
    case 'star':
    default:
      return 5;
  }
}

function renderShapeGeometry(
  shapeType: PptxShapeType,
  w: number,
  h: number,
  fillProp: string,
  strokeProp: string,
  strokeW: number,
  adjusts?: Record<string, number>,
  dashArray?: string,
  headMarkerId?: string,
  tailMarkerId?: string
): React.ReactNode {
  const sw = strokeProp === 'none' ? 0 : strokeW;
  const pad = sw / 2;
  const iw = Math.max(2, w - sw);
  const ih = Math.max(2, h - sw);
  const minSide = Math.min(iw, ih);

  const commonProps = {
    fill: fillProp,
    stroke: strokeProp,
    strokeWidth: sw,
    strokeDasharray: dashArray,
    strokeLinejoin: 'round' as const,
    strokeMiterlimit: 4,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (shapeType) {
    case 'line':
    case 'connector': {
      const isFlatHorizontal = h <= Math.max(4, sw * 2);
      const isFlatVertical = w <= Math.max(4, sw * 2);
      const x1 = isFlatVertical ? w / 2 : pad;
      const x2 = isFlatVertical ? w / 2 : Math.max(pad + 1, w - pad);
      const y1 = isFlatHorizontal ? h / 2 : pad;
      const y2 = isFlatHorizontal ? h / 2 : Math.max(pad + 1, h - pad);
      return (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={strokeProp === 'none' ? '#64748B' : strokeProp}
          strokeWidth={Math.max(1.5, strokeW)}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          markerStart={headMarkerId ? `url(#${headMarkerId})` : undefined}
          markerEnd={tailMarkerId ? `url(#${tailMarkerId})` : undefined}
        />
      );
    }

    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={iw / 2} ry={ih / 2} {...commonProps} />;

    case 'roundRect': {
      const ratio = getAdjRatio(adjusts, 'adj', 0.16667, 0, 0.5);
      const r = minSide * ratio;
      return <rect x={pad} y={pad} width={iw} height={ih} rx={r} ry={r} {...commonProps} />;
    }

    case 'round2SameRect': {
      const r = minSide * getAdjRatio(adjusts, 'adj1', 0.16667, 0, 0.5);
      const d = `M ${pad + r} ${pad} L ${w - pad - r} ${pad} Q ${w - pad} ${pad} ${w - pad} ${pad + r} L ${w - pad} ${h - pad} L ${pad} ${h - pad} L ${pad} ${pad + r} Q ${pad} ${pad} ${pad + r} ${pad} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'round2DiagRect': {
      const r = minSide * getAdjRatio(adjusts, 'adj1', 0.16667, 0, 0.5);
      const d = `M ${pad + r} ${pad} L ${w - pad} ${pad} L ${w - pad} ${h - pad - r} Q ${w - pad} ${h - pad} ${w - pad - r} ${h - pad} L ${pad} ${h - pad} L ${pad} ${pad + r} Q ${pad} ${pad} ${pad + r} ${pad} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'snip1Rect': {
      const c = minSide * getAdjRatio(adjusts, 'adj', 0.16667, 0, 0.5);
      return (
        <polygon
          points={`${pad},${pad} ${w - pad - c},${pad} ${w - pad},${pad + c} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'snip2SameRect': {
      const c = minSide * getAdjRatio(adjusts, 'adj1', 0.16667, 0, 0.5);
      return (
        <polygon
          points={`${pad + c},${pad} ${w - pad - c},${pad} ${w - pad},${pad + c} ${w - pad},${h - pad} ${pad},${h - pad} ${pad},${pad + c}`}
          {...commonProps}
        />
      );
    }

    case 'snip2DiagRect': {
      const c = minSide * getAdjRatio(adjusts, 'adj1', 0.16667, 0, 0.5);
      return (
        <polygon
          points={`${pad + c},${pad} ${w - pad},${pad} ${w - pad},${h - pad - c} ${w - pad - c},${h - pad} ${pad},${h - pad} ${pad},${pad + c}`}
          {...commonProps}
        />
      );
    }

    case 'plaque': {
      const c = minSide * getAdjRatio(adjusts, 'adj', 0.16667, 0.05, 0.45);
      const d = [
        `M ${pad + c} ${pad}`,
        `L ${w - pad - c} ${pad}`,
        `A ${c} ${c} 0 0 0 ${w - pad} ${pad + c}`,
        `L ${w - pad} ${h - pad - c}`,
        `A ${c} ${c} 0 0 0 ${w - pad - c} ${h - pad}`,
        `L ${pad + c} ${h - pad}`,
        `A ${c} ${c} 0 0 0 ${pad} ${h - pad - c}`,
        `L ${pad} ${pad + c}`,
        `A ${c} ${c} 0 0 0 ${pad + c} ${pad}`,
        'Z',
      ].join(' ');
      return <path d={d} {...commonProps} />;
    }

    case 'foldedCorner': {
      const c = minSide * getAdjRatio(adjusts, 'adj', 0.18, 0.06, 0.4);
      const mainPoly = `${pad},${pad} ${w - pad},${pad} ${w - pad},${h - pad - c} ${w - pad - c},${h - pad} ${pad},${h - pad}`;
      const foldTri = `${w - pad - c},${h - pad - c} ${w - pad},${h - pad - c} ${w - pad - c},${h - pad}`;
      return (
        <g>
          <polygon points={mainPoly} {...commonProps} />
          <polygon
            points={foldTri}
            fill="rgba(15, 23, 42, 0.14)"
            stroke={strokeProp}
            strokeWidth={sw}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    }

    case 'frame': {
      const t = minSide * getAdjRatio(adjusts, 'adj1', 0.14, 0.04, 0.42);
      const outer = `M ${pad} ${pad} H ${w - pad} V ${h - pad} H ${pad} Z`;
      const inner = `M ${pad + t} ${pad + t} V ${h - pad - t} H ${w - pad - t} V ${pad + t} Z`;
      return <path d={`${outer} ${inner}`} fillRule="evenodd" {...commonProps} />;
    }

    case 'donut': {
      const thickness = getAdjRatio(adjusts, 'adj', 0.25, 0.05, 0.48);
      const rxO = iw / 2;
      const ryO = ih / 2;
      const rxI = Math.max(1, rxO * (1 - thickness * 2));
      const ryI = Math.max(1, ryO * (1 - thickness * 2));
      const cx = w / 2;
      const cy = h / 2;
      const d = [
        `M ${cx - rxO} ${cy} A ${rxO} ${ryO} 0 1 0 ${cx + rxO} ${cy} A ${rxO} ${ryO} 0 1 0 ${cx - rxO} ${cy} Z`,
        `M ${cx - rxI} ${cy} A ${rxI} ${ryI} 0 1 1 ${cx + rxI} ${cy} A ${rxI} ${ryI} 0 1 1 ${cx - rxI} ${cy} Z`,
      ].join(' ');
      return <path d={d} fillRule="evenodd" {...commonProps} />;
    }

    case 'pie': {
      const cx = w / 2;
      const cy = h / 2;
      const rx = iw / 2;
      const ry = ih / 2;
      const d = `M ${cx} ${cy} L ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'blockArc': {
      const cx = w / 2;
      const cy = h / 2;
      const rxO = iw / 2;
      const ryO = ih / 2;
      const rxI = rxO * 0.55;
      const ryI = ryO * 0.55;
      const d = [
        `M ${pad} ${cy}`,
        `A ${rxO} ${ryO} 0 0 1 ${w - pad} ${cy}`,
        `L ${cx + rxI} ${cy}`,
        `A ${rxI} ${ryI} 0 0 0 ${cx - rxI} ${cy}`,
        'Z',
      ].join(' ');
      return <path d={d} {...commonProps} />;
    }

    case 'can': {
      const ry = Math.min(ih * 0.16, 18);
      const rx = iw / 2;
      const cx = w / 2;
      const bodyD = `M ${pad} ${pad + ry} L ${pad} ${h - pad - ry} A ${rx} ${ry} 0 0 0 ${w - pad} ${h - pad - ry} L ${w - pad} ${pad + ry} Z`;
      return (
        <g>
          <path d={bodyD} {...commonProps} />
          <ellipse cx={cx} cy={pad + ry} rx={rx} ry={ry} {...commonProps} />
        </g>
      );
    }

    case 'cube': {
      const depth = minSide * getAdjRatio(adjusts, 'adj', 0.25, 0.08, 0.45);
      const frontPoly = `${pad},${pad + depth} ${w - pad - depth},${pad + depth} ${w - pad - depth},${h - pad} ${pad},${h - pad}`;
      const topPoly = `${pad},${pad + depth} ${pad + depth},${pad} ${w - pad},${pad} ${w - pad - depth},${pad + depth}`;
      const rightPoly = `${w - pad - depth},${pad + depth} ${w - pad},${pad} ${w - pad},${h - pad - depth} ${w - pad - depth},${h - pad}`;
      return (
        <g>
          <polygon points={frontPoly} {...commonProps} />
          <polygon points={topPoly} {...commonProps} />
          <polygon points={topPoly} fill="rgba(255,255,255,0.2)" stroke="none" />
          <polygon points={rightPoly} {...commonProps} />
          <polygon points={rightPoly} fill="rgba(15,23,42,0.18)" stroke="none" />
        </g>
      );
    }

    case 'teardrop': {
      const cx = w / 2;
      const cy = h / 2;
      const rx = iw / 2;
      const ry = ih / 2;
      const d = `M ${w - pad} ${pad} L ${w - pad} ${cy} A ${rx} ${ry} 0 1 1 ${cx} ${pad} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'triangle': {
      const apexRatio = getAdjRatio(adjusts, 'adj', 0.5, 0.05, 0.95);
      const apexX = pad + iw * apexRatio;
      return (
        <polygon
          points={`${apexX.toFixed(1)},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'rtTriangle':
      return (
        <polygon
          points={`${pad},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );

    case 'parallelogram': {
      const offset = Math.min(iw * 0.45, ih * getAdjRatio(adjusts, 'adj', 0.25, 0.05, 0.6));
      return (
        <polygon
          points={`${pad + offset},${pad} ${w - pad},${pad} ${w - pad - offset},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'trapezoid': {
      const inset = iw * getAdjRatio(adjusts, 'adj', 0.22, 0.04, 0.46);
      return (
        <polygon
          points={`${pad + inset},${pad} ${w - pad - inset},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'diamond':
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`}
          {...commonProps}
        />
      );

    case 'pentagon':
      return (
        <polygon
          points={buildRegularPolygonPoints(w, h, 5, pad, -90)}
          {...commonProps}
        />
      );

    case 'homePlate': {
      const tipX = w - Math.min(iw * 0.4, ih * getAdjRatio(adjusts, 'adj', 0.35, 0.1, 0.6));
      return (
        <polygon
          points={`${pad},${pad} ${tipX},${pad} ${w - pad},${h / 2} ${tipX},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'hexagon': {
      const dx = Math.min(iw * 0.42, iw * getAdjRatio(adjusts, 'adj', 0.25, 0.08, 0.45));
      return (
        <polygon
          points={`${(pad + dx).toFixed(1)},${pad} ${(w - pad - dx).toFixed(1)},${pad} ${w - pad},${h / 2} ${(w - pad - dx).toFixed(1)},${h - pad} ${(pad + dx).toFixed(1)},${h - pad} ${pad},${h / 2}`}
          {...commonProps}
        />
      );
    }

    case 'heptagon':
      return (
        <polygon
          points={buildRegularPolygonPoints(w, h, 7, pad, -90)}
          {...commonProps}
        />
      );

    case 'octagon': {
      const chamfer = minSide * getAdjRatio(adjusts, 'adj', 0.29289, 0.08, 0.45);
      return (
        <polygon
          points={`${pad + chamfer},${pad} ${w - pad - chamfer},${pad} ${w - pad},${pad + chamfer} ${w - pad},${h - pad - chamfer} ${w - pad - chamfer},${h - pad} ${pad + chamfer},${h - pad} ${pad},${h - pad - chamfer} ${pad},${pad + chamfer}`}
          {...commonProps}
        />
      );
    }

    case 'decagon':
      return (
        <polygon
          points={buildRegularPolygonPoints(w, h, 10, pad, -90)}
          {...commonProps}
        />
      );

    case 'dodecagon':
      return (
        <polygon
          points={buildRegularPolygonPoints(w, h, 12, pad, -90)}
          {...commonProps}
        />
      );

    case 'chevron': {
      const tip = Math.min(iw * 0.42, ih * getAdjRatio(adjusts, 'adj', 0.4, 0.12, 0.65));
      return (
        <polygon
          points={`${pad},${pad} ${w - pad - tip},${pad} ${w - pad},${h / 2} ${w - pad - tip},${h - pad} ${pad},${h - pad} ${pad + tip},${h / 2}`}
          {...commonProps}
        />
      );
    }

    case 'notchedRightArrow': {
      const headW = Math.min(iw * 0.42, ih * 0.65);
      const notch = Math.min(iw * 0.18, ih * 0.28);
      const shaftTop = pad + ih * 0.25;
      const shaftBot = h - pad - ih * 0.25;
      return (
        <polygon
          points={`${pad},${shaftTop} ${w - pad - headW},${shaftTop} ${w - pad - headW},${pad} ${w - pad},${h / 2} ${w - pad - headW},${h - pad} ${w - pad - headW},${shaftBot} ${pad},${shaftBot} ${pad + notch},${h / 2}`}
          {...commonProps}
        />
      );
    }

    case 'stripedRightArrow': {
      const headW = Math.min(iw * 0.4, ih * 0.65);
      const shaftTop = pad + ih * 0.25;
      const shaftBot = h - pad - ih * 0.25;
      const s1 = pad;
      const s1W = Math.max(2, iw * 0.06);
      const s2 = s1 + s1W + iw * 0.04;
      const s2W = Math.max(2, iw * 0.1);
      const bodyStart = s2 + s2W + iw * 0.04;
      return (
        <g>
          <rect x={s1} y={shaftTop} width={s1W} height={shaftBot - shaftTop} {...commonProps} />
          <rect x={s2} y={shaftTop} width={s2W} height={shaftBot - shaftTop} {...commonProps} />
          <polygon
            points={`${bodyStart},${shaftTop} ${w - pad - headW},${shaftTop} ${w - pad - headW},${pad} ${w - pad},${h / 2} ${w - pad - headW},${h - pad} ${w - pad - headW},${shaftBot} ${bodyStart},${shaftBot}`}
            {...commonProps}
          />
        </g>
      );
    }

    case 'rightArrow':
    case 'arrow': {
      const headW = Math.min(iw * 0.42, ih * 0.72);
      const shaftTop = pad + ih * 0.26;
      const shaftBot = h - pad - ih * 0.26;
      return (
        <polygon
          points={`${pad},${shaftTop} ${w - pad - headW},${shaftTop} ${w - pad - headW},${pad} ${w - pad},${h / 2} ${w - pad - headW},${h - pad} ${w - pad - headW},${shaftBot} ${pad},${shaftBot}`}
          {...commonProps}
        />
      );
    }

    case 'leftArrow': {
      const headW = Math.min(iw * 0.42, ih * 0.72);
      const shaftTop = pad + ih * 0.26;
      const shaftBot = h - pad - ih * 0.26;
      return (
        <polygon
          points={`${pad},${h / 2} ${pad + headW},${pad} ${pad + headW},${shaftTop} ${w - pad},${shaftTop} ${w - pad},${shaftBot} ${pad + headW},${shaftBot} ${pad + headW},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'upArrow': {
      const headH = Math.min(ih * 0.42, iw * 0.72);
      const shaftL = pad + iw * 0.26;
      const shaftR = w - pad - iw * 0.26;
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${pad + headH} ${shaftR},${pad + headH} ${shaftR},${h - pad} ${shaftL},${h - pad} ${shaftL},${pad + headH} ${pad},${pad + headH}`}
          {...commonProps}
        />
      );
    }

    case 'downArrow': {
      const headH = Math.min(ih * 0.42, iw * 0.72);
      const shaftL = pad + iw * 0.26;
      const shaftR = w - pad - iw * 0.26;
      return (
        <polygon
          points={`${shaftL},${pad} ${shaftR},${pad} ${shaftR},${h - pad - headH} ${w - pad},${h - pad - headH} ${w / 2},${h - pad} ${pad},${h - pad - headH} ${shaftL},${h - pad - headH}`}
          {...commonProps}
        />
      );
    }

    case 'leftRightArrow': {
      const headW = Math.min(iw * 0.28, ih * 0.56);
      const shaftTop = pad + ih * 0.28;
      const shaftBot = h - pad - ih * 0.28;
      return (
        <polygon
          points={`${pad},${h / 2} ${pad + headW},${pad} ${pad + headW},${shaftTop} ${w - pad - headW},${shaftTop} ${w - pad - headW},${pad} ${w - pad},${h / 2} ${w - pad - headW},${h - pad} ${w - pad - headW},${shaftBot} ${pad + headW},${shaftBot} ${pad + headW},${h - pad}`}
          {...commonProps}
        />
      );
    }

    case 'upDownArrow': {
      const headH = Math.min(ih * 0.28, iw * 0.56);
      const shaftL = pad + iw * 0.28;
      const shaftR = w - pad - iw * 0.28;
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${pad + headH} ${shaftR},${pad + headH} ${shaftR},${h - pad - headH} ${w - pad},${h - pad - headH} ${w / 2},${h - pad} ${pad},${h - pad - headH} ${shaftL},${h - pad - headH} ${shaftL},${pad + headH} ${pad},${pad + headH}`}
          {...commonProps}
        />
      );
    }

    case 'quadArrow': {
      const hw = iw * 0.18;
      const hh = ih * 0.18;
      const swHalf = iw * 0.1;
      const shHalf = ih * 0.1;
      const cx = w / 2;
      const cy = h / 2;
      return (
        <polygon
          points={[
            `${cx},${pad}`,
            `${cx + hw},${pad + hh}`,
            `${cx + swHalf},${pad + hh}`,
            `${cx + swHalf},${cy - shHalf}`,
            `${w - pad - hw},${cy - shHalf}`,
            `${w - pad - hw},${cy - hh}`,
            `${w - pad},${cy}`,
            `${w - pad - hw},${cy + hh}`,
            `${w - pad - hw},${cy + shHalf}`,
            `${cx + swHalf},${cy + shHalf}`,
            `${cx + swHalf},${h - pad - hh}`,
            `${cx + hw},${h - pad - hh}`,
            `${cx},${h - pad}`,
            `${cx - hw},${h - pad - hh}`,
            `${cx - swHalf},${h - pad - hh}`,
            `${cx - swHalf},${cy + shHalf}`,
            `${pad + hw},${cy + shHalf}`,
            `${pad + hw},${cy + hh}`,
            `${pad},${cy}`,
            `${pad + hw},${cy - hh}`,
            `${pad + hw},${cy - shHalf}`,
            `${cx - swHalf},${cy - shHalf}`,
            `${cx - swHalf},${pad + hh}`,
            `${cx - hw},${pad + hh}`,
          ].join(' ')}
          {...commonProps}
        />
      );
    }

    case 'bentArrow': {
      const headW = Math.min(iw * 0.25, ih * 0.36);
      const thick = minSide * 0.22;
      return (
        <path
          d={`M ${pad} ${h - pad} L ${pad} ${pad + thick * 1.4} Q ${pad} ${pad + thick * 0.4} ${pad + thick} ${pad + thick * 0.4} L ${w - pad - headW} ${pad + thick * 0.4} L ${w - pad - headW} ${pad} L ${w - pad} ${pad + thick * 0.9} L ${w - pad - headW} ${pad + thick * 1.8} L ${w - pad - headW} ${pad + thick * 1.4} L ${pad + thick} ${pad + thick * 1.4} L ${pad + thick} ${h - pad} Z`}
          {...commonProps}
        />
      );
    }

    case 'uturnArrow': {
      const thick = minSide * 0.2;
      const headH = Math.min(ih * 0.3, iw * 0.3);
      return (
        <path
          d={`M ${pad} ${h - pad} L ${pad} ${pad + ih * 0.35} A ${iw * 0.36} ${ih * 0.35} 0 0 1 ${w - pad - thick} ${pad + ih * 0.35} L ${w - pad - thick} ${h - pad - headH} L ${w - pad} ${h - pad - headH} L ${w - pad - thick * 1.25} ${h - pad} L ${w - pad - thick * 2.5} ${h - pad - headH} L ${w - pad - thick * 1.8} ${h - pad - headH} L ${w - pad - thick * 1.8} ${pad + ih * 0.35} A ${iw * 0.16} ${ih * 0.16} 0 0 0 ${pad + thick} ${pad + ih * 0.35} L ${pad + thick} ${h - pad} Z`}
          {...commonProps}
        />
      );
    }

    case 'star4':
    case 'star5':
    case 'star':
    case 'star6':
    case 'star8':
    case 'star10':
    case 'star12':
    case 'star16':
    case 'star24':
    case 'star32': {
      const n = getStarPointCount(shapeType);
      const defaultRatio = n >= 16 ? 0.72 : n >= 10 ? 0.58 : n >= 6 ? 0.5 : 0.38;
      const innerRatio = getAdjRatio(adjusts, 'adj', defaultRatio, 0.12, 0.88);
      return <polygon points={buildStarPoints(w, h, n, pad, innerRatio)} {...commonProps} />;
    }

    case 'plus': {
      const arm = minSide * getAdjRatio(adjusts, 'adj', 0.28, 0.08, 0.45);
      const xA = pad + arm;
      const xB = w - pad - arm;
      const yA = pad + arm;
      const yB = h - pad - arm;
      return (
        <polygon
          points={`${xA},${pad} ${xB},${pad} ${xB},${yA} ${w - pad},${yA} ${w - pad},${yB} ${xB},${yB} ${xB},${h - pad} ${xA},${h - pad} ${xA},${yB} ${pad},${yB} ${pad},${yA} ${xA},${yA}`}
          {...commonProps}
        />
      );
    }

    case 'heart': {
      const cx = w / 2;
      const d = `M ${cx} ${h - pad} C ${pad} ${h * 0.68} ${pad} ${h * 0.2} ${w * 0.3} ${pad + ih * 0.14} C ${w * 0.43} ${pad} ${cx} ${h * 0.22} ${cx} ${h * 0.3} C ${cx} ${h * 0.22} ${w * 0.57} ${pad} ${w * 0.7} ${pad + ih * 0.14} C ${w - pad} ${h * 0.2} ${w - pad} ${h * 0.68} ${cx} ${h - pad} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'lightningBolt':
      return (
        <polygon
          points={`${w * 0.42},${pad} ${w * 0.82},${pad} ${w * 0.55},${h * 0.42} ${w - pad},${h * 0.42} ${w * 0.28},${h - pad} ${w * 0.46},${h * 0.54} ${pad},${h * 0.54}`}
          {...commonProps}
        />
      );

    case 'sun': {
      const rays = buildStarPoints(w, h, 16, pad, 0.7);
      const cx = w / 2;
      const cy = h / 2;
      return (
        <g>
          <polygon points={rays} {...commonProps} />
          <ellipse cx={cx} cy={cy} rx={iw * 0.24} ry={ih * 0.24} {...commonProps} />
        </g>
      );
    }

    case 'moon': {
      const d = `M ${w * 0.78} ${pad} A ${iw * 0.48} ${ih * 0.5} 0 1 0 ${w * 0.78} ${h - pad} A ${iw * 0.34} ${ih * 0.46} 0 1 1 ${w * 0.78} ${pad} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'cloud': {
      const d = `M ${pad + iw * 0.22} ${h - pad} C ${pad} ${h - pad} ${pad} ${h * 0.48} ${pad + iw * 0.18} ${h * 0.46} C ${pad + iw * 0.16} ${h * 0.2} ${w * 0.42} ${pad} ${w * 0.56} ${h * 0.24} C ${w * 0.68} ${h * 0.08} ${w * 0.9} ${h * 0.22} ${w * 0.86} ${h * 0.46} C ${w - pad} ${h * 0.5} ${w - pad} ${h - pad} ${w * 0.78} ${h - pad} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'wave': {
      const amp = ih * 0.14;
      const d = `M ${pad} ${pad + amp} Q ${w * 0.25} ${pad - amp} ${w * 0.5} ${pad + amp} T ${w - pad} ${pad + amp} L ${w - pad} ${h - pad - amp} Q ${w * 0.75} ${h - pad + amp} ${w * 0.5} ${h - pad - amp} T ${pad} ${h - pad - amp} Z`;
      return <path d={d} {...commonProps} />;
    }

    case 'ribbon': {
      const notch = iw * 0.1;
      return (
        <polygon
          points={`${pad},${pad} ${w - pad},${pad} ${w - pad - notch},${h / 2} ${w - pad},${h - pad} ${pad},${h - pad} ${pad + notch},${h / 2}`}
          {...commonProps}
        />
      );
    }

    case 'callout': {
      const bodyH = h * 0.78;
      const r = Math.min(iw, bodyH) * 0.1;
      const d = [
        `M ${pad + r} ${pad}`,
        `L ${w - pad - r} ${pad}`,
        `Q ${w - pad} ${pad} ${w - pad} ${pad + r}`,
        `L ${w - pad} ${bodyH - r}`,
        `Q ${w - pad} ${bodyH} ${w - pad - r} ${bodyH}`,
        `L ${w * 0.36} ${bodyH}`,
        `L ${w * 0.22} ${h - pad}`,
        `L ${w * 0.25} ${bodyH}`,
        `L ${pad + r} ${bodyH}`,
        `Q ${pad} ${bodyH} ${pad} ${bodyH - r}`,
        `L ${pad} ${pad + r}`,
        `Q ${pad} ${pad} ${pad + r} ${pad}`,
        'Z',
      ].join(' ');
      return <path d={d} {...commonProps} />;
    }

    case 'rect':
    case 'custom':
    default:
      return <rect x={pad} y={pad} width={iw} height={ih} {...commonProps} />;
  }
}

export const PptxShapeSvg: React.FC<PptxShapeSvgProps> = ({
  element,
  fillOverride,
  gradientOverride,
  strokeOverride,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const w = Math.max(4, element.width || 100);
  const h = Math.max(4, element.height || 40);
  const shapeType: PptxShapeType = element.shapeType || 'rect';

  const rawGradient = gradientOverride ?? element.fillGradient ?? element.backgroundGradient;
  const parsedGrad = parseCssGradientForSvg(rawGradient);
  const gradId = `pptx-grad-${uid}`;

  const rawFill = fillOverride ?? element.fillColor ?? element.backgroundColor;
  const fillProp = parsedGrad
    ? `url(#${gradId})`
    : rawFill && rawFill !== 'transparent'
    ? rawFill
    : 'none';

  const strokeColor = strokeOverride ?? element.strokeColor ?? element.borderColor;
  const strokeProp = strokeColor || 'none';
  const strokeW = Math.max(1, element.strokeWidth ?? element.borderWidth ?? 1);
  const dashArray = getStrokeDashArray(element.strokeDash, strokeW);

  const headMarkerId = element.headArrow ? `pptx-head-${uid}` : undefined;
  const tailMarkerId = element.tailArrow ? `pptx-tail-${uid}` : undefined;
  const markerColor = strokeProp === 'none' ? '#64748B' : strokeProp;

  let x1 = '0%';
  let y1 = '0%';
  let x2 = '0%';
  let y2 = '100%';
  if (parsedGrad && parsedGrad.type === 'linear') {
    const rad = ((parsedGrad.angleDeg - 90) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    x1 = `${Math.round((0.5 - dx * 0.5) * 100)}%`;
    y1 = `${Math.round((0.5 - dy * 0.5) * 100)}%`;
    x2 = `${Math.round((0.5 + dx * 0.5) * 100)}%`;
    y2 = `${Math.round((0.5 + dy * 0.5) * 100)}%`;
  }

  const hasCustomPaths = Boolean(element.customPaths && element.customPaths.length > 0);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className={className}
      style={{
        display: 'block',
        overflow: 'visible',
        filter: element.hasShadow ? 'drop-shadow(0px 3px 6px rgba(15, 23, 42, 0.18))' : undefined,
      }}
      aria-hidden="true"
    >
      <defs>
        {parsedGrad && parsedGrad.type === 'linear' && (
          <linearGradient id={gradId} x1={x1} y1={y1} x2={x2} y2={y2}>
            {parsedGrad.stops.map((stop, idx) => (
              <stop key={idx} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        )}
        {parsedGrad && parsedGrad.type === 'radial' && (
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            {parsedGrad.stops.map((stop, idx) => (
              <stop key={idx} offset={stop.offset} stopColor={stop.color} />
            ))}
          </radialGradient>
        )}
        {headMarkerId && (
          <marker
            id={headMarkerId}
            markerWidth="8"
            markerHeight="8"
            refX="2"
            refY="4"
            orient="auto"
          >
            <polygon points="8,1 1,4 8,7" fill={markerColor} />
          </marker>
        )}
        {tailMarkerId && (
          <marker
            id={tailMarkerId}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <polygon points="0,1 7,4 0,7" fill={markerColor} />
          </marker>
        )}
      </defs>

      {hasCustomPaths ? (
        element.customPaths!.map((cp, cpIdx) => (
          <svg
            key={cpIdx}
            x={0}
            y={0}
            width={w}
            height={h}
            viewBox={`0 0 ${cp.viewBoxW} ${cp.viewBoxH}`}
            preserveAspectRatio="none"
            style={{ overflow: 'visible' }}
          >
            <path
              d={cp.d}
              fill={cp.fillMode === 'none' ? 'none' : fillProp}
              fillRule="evenodd"
              stroke={cp.stroked === false ? 'none' : strokeProp}
              strokeWidth={strokeProp === 'none' || cp.stroked === false ? 0 : strokeW}
              strokeDasharray={dashArray}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ))
      ) : (
        renderShapeGeometry(
          shapeType,
          w,
          h,
          fillProp,
          strokeProp,
          strokeW,
          element.shapeAdjusts,
          dashArray,
          headMarkerId,
          tailMarkerId
        )
      )}
    </svg>
  );
};
