/**
 * PPTX 演播舞台配色方案、画幅尺寸预设与元素层级结构工具
 */
import type { PptxElement } from './pptxEngine';

export type PptxColorPresetId =
  | 'original'
  | 'warm'
  | 'dark'
  | 'ocean'
  | 'forest'
  | 'royal';

export type PptxAspectPresetId = 'native' | '16:9' | '16:10' | '4:3' | 'a4';

export interface PptxColorPreset {
  id: PptxColorPresetId;
  labelZh: string;
  labelEn: string;
  swatch: string;
  secondarySwatch: string;
  workspaceBg: string;
  stageBg: string;
  stageGradient?: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
}

export const PPTX_COLOR_PRESETS: PptxColorPreset[] = [
  {
    id: 'original',
    labelZh: '原色',
    labelEn: 'Original',
    swatch: '#FFFFFF',
    secondarySwatch: '#3B82F6',
    workspaceBg: 'var(--ov-bg)',
    stageBg: '#FFFFFF',
    textPrimary: '#0F172A',
    textMuted: '#475569',
    accent: '#3B82F6',
    accentSoft: '#EFF6FF',
    border: '#CBD5E1',
  },
  {
    id: 'warm',
    labelZh: '暖纸',
    labelEn: 'Warm',
    swatch: '#FAF6EC',
    secondarySwatch: '#D97706',
    workspaceBg: '#EFE9DA',
    stageBg: '#FAF6EC',
    stageGradient: 'linear-gradient(145deg, #FDFBF5 0%, #F5EEDB 100%)',
    textPrimary: '#292524',
    textMuted: '#57534E',
    accent: '#D97706',
    accentSoft: '#FEF3C7',
    border: '#E7DEC8',
  },
  {
    id: 'dark',
    labelZh: '暗夜',
    labelEn: 'Midnight',
    swatch: '#0F172A',
    secondarySwatch: '#38BDF8',
    workspaceBg: '#060911',
    stageBg: '#0F172A',
    stageGradient: 'linear-gradient(145deg, #0F172A 0%, #1E293B 100%)',
    textPrimary: '#F1F5F9',
    textMuted: '#94A3B8',
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
    border: '#334155',
  },
  {
    id: 'ocean',
    labelZh: '深海蓝',
    labelEn: 'Ocean',
    swatch: '#EFF6FF',
    secondarySwatch: '#0284C7',
    workspaceBg: '#E0ECFA',
    stageBg: '#F4F9FF',
    stageGradient: 'linear-gradient(145deg, #FFFFFF 0%, #E0F2FE 100%)',
    textPrimary: '#0C2D48',
    textMuted: '#3B6488',
    accent: '#0284C7',
    accentSoft: '#E0F2FE',
    border: '#BAE6FD',
  },
  {
    id: 'forest',
    labelZh: '森系绿',
    labelEn: 'Forest',
    swatch: '#ECFDF5',
    secondarySwatch: '#059669',
    workspaceBg: '#DEF4EA',
    stageBg: '#F4FBF7',
    stageGradient: 'linear-gradient(145deg, #FFFFFF 0%, #D1FAE5 100%)',
    textPrimary: '#064E3B',
    textMuted: '#346E5A',
    accent: '#059669',
    accentSoft: '#D1FAE5',
    border: '#A7F3D0',
  },
  {
    id: 'royal',
    labelZh: '紫韵金',
    labelEn: 'Royal',
    swatch: '#F5F3FF',
    secondarySwatch: '#7C3AED',
    workspaceBg: '#ECE7FA',
    stageBg: '#FAF8FF',
    stageGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EDE9FE 100%)',
    textPrimary: '#2E1065',
    textMuted: '#5B438A',
    accent: '#7C3AED',
    accentSoft: '#EDE9FE',
    border: '#DDD6FE',
  },
];

export interface PptxAspectPreset {
  id: PptxAspectPresetId;
  labelZh: string;
  labelEn: string;
  shortLabel: string;
  width?: number;
  height?: number;
}

export const PPTX_ASPECT_PRESETS: PptxAspectPreset[] = [
  { id: 'native', labelZh: '原始比例', labelEn: 'Native', shortLabel: '原始' },
  { id: '16:9', labelZh: '宽屏 16:9 (960×540)', labelEn: 'Widescreen 16:9', shortLabel: '16:9', width: 960, height: 540 },
  { id: '16:10', labelZh: '商务 16:10 (960×600)', labelEn: 'Business 16:10', shortLabel: '16:10', width: 960, height: 600 },
  { id: '4:3', labelZh: '经典 4:3 (960×720)', labelEn: 'Classic 4:3', shortLabel: '4:3', width: 960, height: 720 },
  { id: 'a4', labelZh: 'A4 横版 (842×595)', labelEn: 'A4 Landscape', shortLabel: 'A4', width: 842, height: 595 },
];

export const PPTX_SCALE_PRESETS = [
  { id: 'fit', zoom: 1, labelZh: '自适应 (100%)', labelEn: 'Fit (100%)', shortLabel: '100%' },
  { id: '75', zoom: 0.75, labelZh: '紧凑小窗 (75%)', labelEn: 'Compact (75%)', shortLabel: '75%' },
  { id: '125', zoom: 1.25, labelZh: '大图精览 (125%)', labelEn: 'Large (125%)', shortLabel: '125%' },
  { id: '150', zoom: 1.5, labelZh: '超清放大 (150%)', labelEn: 'Ultra (150%)', shortLabel: '150%' },
] as const;

export function getPptxColorPreset(id: PptxColorPresetId): PptxColorPreset {
  return PPTX_COLOR_PRESETS.find(p => p.id === id) || PPTX_COLOR_PRESETS[0];
}

export function resolveStageDimensions(
  nativeWidth: number,
  nativeHeight: number,
  aspectPreset: PptxAspectPresetId
): { width: number; height: number } {
  const safeW = Math.max(120, nativeWidth || 960);
  const safeH = Math.max(90, nativeHeight || 540);
  if (aspectPreset === 'native') {
    return { width: safeW, height: safeH };
  }
  const found = PPTX_ASPECT_PRESETS.find(p => p.id === aspectPreset);
  if (found?.width && found?.height) {
    return { width: found.width, height: found.height };
  }
  return { width: safeW, height: safeH };
}

function parseHexLuminance(rawColor?: string): number | null {
  if (!rawColor) return null;
  const hex = rawColor.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full = hex.length === 4 ? `${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(1);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function adaptColorForPreset(
  rawColor: string | undefined,
  preset: PptxColorPreset,
  role: 'bg' | 'text' | 'accent' | 'stroke'
): string | undefined {
  if (preset.id === 'original') return rawColor;
  if (!rawColor) {
    if (role === 'text') return preset.textPrimary;
    return undefined;
  }

  const trimmed = rawColor.trim();
  if (trimmed === 'transparent' || trimmed === 'none') return trimmed;

  const isDarkPreset = preset.id === 'dark';
  const lum = parseHexLuminance(trimmed);

  if (role === 'bg') {
    if (trimmed.includes('gradient(')) {
      if (isDarkPreset) {
        return preset.stageGradient || preset.stageBg;
      }
      if (/fff|f8fafc|f1f5f9/i.test(trimmed)) {
        return preset.stageGradient || preset.stageBg;
      }
      return trimmed;
    }
    if (lum !== null && lum > 0.85) {
      return preset.stageBg;
    }
    if (isDarkPreset && lum !== null && lum > 0.65) {
      return '#1E293B';
    }
    if (/^#?(?:3B82F6|2563EB|1D4ED8)$/i.test(trimmed)) {
      return preset.accent;
    }
    return trimmed;
  }

  if (role === 'text') {
    if (isDarkPreset) {
      if (lum !== null && lum < 0.35) return preset.textPrimary;
      if (lum !== null && lum < 0.55) return preset.textMuted;
      return trimmed;
    }
    if (lum !== null && lum < 0.25) return preset.textPrimary;
    if (/^#?(?:3B82F6|2563EB)$/i.test(trimmed)) return preset.accent;
    return trimmed;
  }

  if (role === 'accent' || role === 'stroke') {
    if (/^#?(?:3B82F6|2563EB|1D4ED8)$/i.test(trimmed)) {
      return preset.accent;
    }
    if (isDarkPreset && lum !== null && lum < 0.2) {
      return '#64748B';
    }
    return trimmed;
  }

  return trimmed;
}

/**
 * 将元素几何坐标从源画布比例等比映射至目标画布尺寸
 */
export function projectElementToStageDimensions(
  el: PptxElement,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): PptxElement {
  if (Math.abs(srcW - dstW) < 0.5 && Math.abs(srcH - dstH) < 0.5) {
    return el;
  }
  const sx = dstW / Math.max(1, srcW);
  const sy = dstH / Math.max(1, srcH);
  const fontScale = Math.max(0.72, Math.min(1.35, Math.sqrt(sx * sy)));

  const scaledParagraphs = el.paragraphs?.map(p => ({
    ...p,
    marginLeft: p.marginLeft !== undefined ? Math.round(p.marginLeft * sx * 10) / 10 : undefined,
    indent: p.indent !== undefined ? Math.round(p.indent * sx * 10) / 10 : undefined,
    runs: p.runs.map(r => ({
      ...r,
      fontSize: r.fontSize ? Math.max(9, Math.round(r.fontSize * fontScale)) : undefined,
    })),
  }));

  return {
    ...el,
    x: Math.round(el.x * sx * 10) / 10,
    y: Math.round(el.y * sy * 10) / 10,
    width: Math.max(2, Math.round(el.width * sx * 10) / 10),
    height: Math.max(2, Math.round(el.height * sy * 10) / 10),
    paragraphs: scaledParagraphs,
  };
}
