/**
 * Graphviz 主题调色板与 SVG 自适应重映射服务
 * 支持 14 大主题高保真自适应 (Dracula, Catppuccin, Nord, Sepia, Tokyo Night 等)
 * 智能重映射 Graphviz 默认黑白线框为各主题对应的高对比度语义配色，并保留用户显式指定色彩
 */

import type { ThemeId } from '../../../shared/types.ts';

export interface GraphvizThemePalette {
  id: string;
  name: string;
  text: string;
  stroke: string;
  nodeFill?: string;
  isDark: boolean;
}

export const GRAPHVIZ_THEME_PALETTES: Record<string, GraphvizThemePalette> = {
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    text: '#f8f8f2',
    stroke: '#bd93f9',
    isDark: true,
  },
  sepia: {
    id: 'sepia',
    name: 'Sepia',
    text: '#78350f',
    stroke: '#b45309',
    isDark: false,
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    text: '#f8fafc',
    stroke: '#38bdf8',
    isDark: true,
  },
  light: {
    id: 'light',
    name: 'Light',
    text: '#0f172a',
    stroke: '#0284c7',
    isDark: false,
  },
  system: {
    id: 'system',
    name: 'VS Code System',
    text: 'var(--vscode-editor-foreground, #cccccc)',
    stroke: 'var(--vscode-focusBorder, #007acc)',
    isDark: true,
  },
  vscode: {
    id: 'vscode',
    name: 'VS Code Dark+',
    text: '#d4d4d4',
    stroke: '#007acc',
    isDark: true,
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    text: '#eceff4',
    stroke: '#88c0d0',
    isDark: true,
  },
  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    text: '#cdd6f4',
    stroke: '#89b4fa',
    isDark: true,
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    text: '#c0caf5',
    stroke: '#7aa2f7',
    isDark: true,
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk',
    text: '#00ffcc',
    stroke: '#ff007f',
    isDark: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Blue',
    text: '#e2e8f0',
    stroke: '#60a5fa',
    isDark: true,
  },
  forest: {
    id: 'forest',
    name: 'Forest Nature',
    text: '#f0fdf4',
    stroke: '#22c55e',
    isDark: true,
  },
  solarized: {
    id: 'solarized',
    name: 'Solarized Dark',
    text: '#839496',
    stroke: '#268bd2',
    isDark: true,
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    text: '#f0f6fc',
    stroke: '#58a6ff',
    isDark: true,
  },
  notion: {
    id: 'notion',
    name: 'Notion Minimal',
    text: '#37352f',
    stroke: '#0f172a',
    isDark: false,
  },
};

/**
 * 根据传入主题 ID 或明暗标志解析当前图元调色板
 */
export function resolveGraphvizPalette(themeOrIsDark?: ThemeId | boolean | string): GraphvizThemePalette {
  if (typeof themeOrIsDark === 'boolean') {
    return themeOrIsDark ? GRAPHVIZ_THEME_PALETTES.dark : GRAPHVIZ_THEME_PALETTES.light;
  }
  if (typeof themeOrIsDark === 'string' && GRAPHVIZ_THEME_PALETTES[themeOrIsDark]) {
    return GRAPHVIZ_THEME_PALETTES[themeOrIsDark];
  }
  return GRAPHVIZ_THEME_PALETTES.dark;
}

/**
 * 将 Graphviz 原生输出的 SVG 黑白线条重映射为高保真主题色
 */
export function solidifyGraphvizSvg(rawSvg: string, themeOrIsDark?: ThemeId | boolean | string): string {
  if (!rawSvg) return rawSvg;
  const palette = resolveGraphvizPalette(themeOrIsDark);

  let svg = rawSvg;

  // 1. 消除背景多边形的纯白底色，使其透明
  // Graphviz 默认会在外层包裹一个 `<polygon fill="white" stroke="none" .../>`
  svg = svg.replace(
    /(<polygon\b[^>]*?\bfill=["'])white(["'][^>]*?\bstroke=["']none["'][^>]*?>)/gi,
    (match) => match.replace(/\bfill=["']white["']/i, 'fill="transparent"')
  );

  // 2. 将默认黑线条 stroke="black" 替换为当前主题的强调色
  svg = svg.replace(/\bstroke=["'](?:black|#000000|#000)["']/gi, `stroke="${palette.stroke}"`);

  // 3. 将默认纯黑文字与箭头多边形 fill="black" 替换为当前主题文本色
  svg = svg.replace(/\bfill=["'](?:black|#000000|#000)["']/gi, `fill="${palette.text}"`);

  return svg;
}
