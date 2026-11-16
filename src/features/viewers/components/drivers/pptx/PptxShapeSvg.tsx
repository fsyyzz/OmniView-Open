import React, { useId } from 'react';
import type { PptxElement, PptxShapeType } from '../../../lib/pptxEngine';

export interface PptxShapeSvgProps {
  element: PptxElement;
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
  // 按逗号切分，但忽略 rgba(...) 内部的逗号
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

function renderShapeGeometry(
  shapeType: PptxShapeType,
  w: number,
  h: number,
  fillProp: string,
  strokeProp: string,
  strokeW: number,
  dashArray?: string,
  headMarkerId?: string,
  tailMarkerId?: string
): React.ReactNode {
  const sw = strokeProp === 'none' ? 0 : strokeW;
  const pad = sw / 2;
  const iw = Math.max(2, w - sw);
  const ih = Math.max(2, h - sw);

  const commonProps = {
    fill: fillProp,
    stroke: strokeProp,
    strokeWidth: sw,
    strokeDasharray: dashArray,
    strokeLinejoin: 'round' as const,
  };

  switch (shapeType) {
    case 'line':
    case 'connector': {
      const isFlatHorizontal = h <= Math.max(4, sw * 2);
      const y1 = isFlatHorizontal ? h / 2 : pad;
      const y2 = isFlatHorizontal ? h / 2 : h - pad;
      const x1 = pad;
      const x2 = Math.max(pad + 1, w - pad);
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
          markerStart={headMarkerId ? `url(#${headMarkerId})` : undefined}
          markerEnd={tailMarkerId ? `url(#${tailMarkerId})` : undefined}
        />
      );
    }
    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={iw / 2} ry={ih / 2} {...commonProps} />;
    case 'roundRect': {
      const r = Math.min(iw, ih) * 0.14;
      return <rect x={pad} y={pad} width={iw} height={ih} rx={r} ry={r} {...commonProps} />;
    }
    case 'triangle':
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    case 'rtTriangle':
      return (
        <polygon
          points={`${pad},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
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
          points={`${pad},${pad} ${w * 0.72},${pad} ${w - pad},${h / 2} ${w * 0.72},${h - pad} ${pad},${h - pad}`}
          {...commonProps}
        />
      );
    case 'hexagon':
      return (
        <polygon
          points={`${w * 0.22},${pad} ${w * 0.78},${pad} ${w - pad},${h / 2} ${w * 0.78},${h - pad} ${w * 0.22},${h - pad} ${pad},${h / 2}`}
          {...commonProps}
        />
      );
    case 'chevron': {
      const tip = Math.min(w * 0.28, h * 0.45);
      return (
        <polygon
          points={`${pad},${pad} ${w - tip},${pad} ${w - pad},${h / 2} ${w - tip},${h - pad} ${pad},${h - pad} ${pad + tip},${h / 2}`}
          {...commonProps}
        />
      );
    }
    case 'rightArrow':
    case 'arrow': {
      const headW = Math.min(w * 0.4, h * 0.72);
      const shaftTop = h * 0.26;
      const shaftBot = h * 0.74;
      return (
        <polygon
          points={`${pad},${shaftTop} ${w - headW},${shaftTop} ${w - headW},${pad} ${w - pad},${h / 2} ${w - headW},${h - pad} ${w - headW},${shaftBot} ${pad},${shaftBot}`}
          {...commonProps}
        />
      );
    }
    case 'leftArrow': {
      const headW = Math.min(w * 0.4, h * 0.72);
      const shaftTop = h * 0.26;
      const shaftBot = h * 0.74;
      return (
        <polygon
          points={`${pad},${h / 2} ${headW},${pad} ${headW},${shaftTop} ${w - pad},${shaftTop} ${w - pad},${shaftBot} ${headW},${shaftBot} ${headW},${h - pad}`}
          {...commonProps}
        />
      );
    }
    case 'upArrow': {
      const headH = Math.min(h * 0.4, w * 0.72);
      const shaftL = w * 0.26;
      const shaftR = w * 0.74;
      return (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${headH} ${shaftR},${headH} ${shaftR},${h - pad} ${shaftL},${h - pad} ${shaftL},${headH} ${pad},${headH}`}
          {...commonProps}
        />
      );
    }
    case 'downArrow': {
      const headH = Math.min(h * 0.4, w * 0.72);
      const shaftL = w * 0.26;
      const shaftR = w * 0.74;
      return (
        <polygon
          points={`${shaftL},${pad} ${shaftR},${pad} ${shaftR},${h - headH} ${w - pad},${h - headH} ${w / 2},${h - pad} ${pad},${h - headH} ${shaftL},${h - headH}`}
          {...commonProps}
        />
      );
    }
    case 'star': {
      const cx = w / 2;
      const cy = h / 2;
      const outerR = Math.min(iw, ih) / 2;
      const innerR = outerR * 0.42;
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const rad = (-90 + i * 36) * (Math.PI / 180);
        pts.push(`${(cx + r * Math.cos(rad)).toFixed(1)},${(cy + r * Math.sin(rad)).toFixed(1)}`);
      }
      return <polygon points={pts.join(' ')} {...commonProps} />;
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

export const PptxShapeSvg: React.FC<PptxShapeSvgProps> = ({ element, className }) => {
  const uid = useId().replace(/:/g, '');
  const w = Math.max(4, element.width || 100);
  const h = Math.max(4, element.height || 40);
  const shapeType: PptxShapeType = element.shapeType || 'rect';

  const rawGradient = element.fillGradient || element.backgroundGradient;
  const parsedGrad = parseCssGradientForSvg(rawGradient);
  const gradId = `pptx-grad-${uid}`;

  const rawFill = element.fillColor ?? element.backgroundColor;
  const fillProp = parsedGrad
    ? `url(#${gradId})`
    : rawFill && rawFill !== 'transparent'
    ? rawFill
    : 'none';

  const strokeColor = element.strokeColor ?? element.borderColor;
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
      {renderShapeGeometry(
        shapeType,
        w,
        h,
        fillProp,
        strokeProp,
        strokeW,
        dashArray,
        headMarkerId,
        tailMarkerId
      )}
    </svg>
  );
};
