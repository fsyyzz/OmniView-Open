/**
 * Graphviz 14 大渲染主题高保真调色盘与矢量渲染固化服务
 * 纯本地优先、零网络依赖、纯函数实现
 * 智能消除原生白底、自适应 14 大主题色阶，同时 100% 保持用户显式语法着色
 */
import type { ThemeId } from '../../../shared/types.ts';

export interface GraphvizThemePalette {
  isDark: boolean;
  bg: string;
  nodeBorder: string;
  textColor: string;
  edgeColor: string;
  arrowColor: string;
}

export const GRAPHVIZ_THEME_PALETTES: Record<string, GraphvizThemePalette> = {
  dracula: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#bd93f9',
    textColor: '#f8f8f2',
    edgeColor: '#bd93f9',
    arrowColor: '#bd93f9',
  },
  catppuccin: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#cba6f7',
    textColor: '#cdd6f4',
    edgeColor: '#cba6f7',
    arrowColor: '#cba6f7',
  },
  nord: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#88c0d0',
    textColor: '#eceff4',
    edgeColor: '#88c0d0',
    arrowColor: '#88c0d0',
  },
  'tokyo-night': {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#7aa2f7',
    textColor: '#c0caf5',
    edgeColor: '#7aa2f7',
    arrowColor: '#7aa2f7',
  },
  sepia: {
    isDark: false,
    bg: 'transparent',
    nodeBorder: '#b45309',
    textColor: '#78350f',
    edgeColor: '#b45309',
    arrowColor: '#b45309',
  },
  forest: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#10b981',
    textColor: '#e2f0e6',
    edgeColor: '#10b981',
    arrowColor: '#10b981',
  },
  solarized: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#2aa198',
    textColor: '#839496',
    edgeColor: '#2aa198',
    arrowColor: '#2aa198',
  },
  notion: {
    isDark: false,
    bg: 'transparent',
    nodeBorder: '#37352f',
    textColor: '#37352f',
    edgeColor: '#37352f',
    arrowColor: '#37352f',
  },
  'github-dark': {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#58a6ff',
    textColor: '#e6edf3',
    edgeColor: '#58a6ff',
    arrowColor: '#58a6ff',
  },
  midnight: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#38bdf8',
    textColor: '#f8fafc',
    edgeColor: '#38bdf8',
    arrowColor: '#38bdf8',
  },
  cyber: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#06b6d4',
    textColor: '#fafafa',
    edgeColor: '#06b6d4',
    arrowColor: '#06b6d4',
  },
  dark: {
    isDark: true,
    bg: 'transparent',
    nodeBorder: '#38bdf8',
    textColor: '#f8fafc',
    edgeColor: '#60a5fa',
    arrowColor: '#60a5fa',
  },
  light: {
    isDark: false,
    bg: 'transparent',
    nodeBorder: '#2563eb',
    textColor: '#0f172a',
    edgeColor: '#1e293b',
    arrowColor: '#1e293b',
  },
};

export function resolveGraphvizPalette(themeOrIsDark?: ThemeId | string | boolean): GraphvizThemePalette {
  if (typeof themeOrIsDark === 'string' && GRAPHVIZ_THEME_PALETTES[themeOrIsDark]) {
    return GRAPHVIZ_THEME_PALETTES[themeOrIsDark];
  }
  const isDark = typeof themeOrIsDark === 'boolean' ? themeOrIsDark : true;
  return isDark ? GRAPHVIZ_THEME_PALETTES.dark : GRAPHVIZ_THEME_PALETTES.light;
}

/**
 * 针对当前主题对 Graphviz 生成的原生 SVG 执行高保真样式固化
 * 1. 消除默认全屏白底卡顿，使其透明自适应
 * 2. 针对暗色与定制主题，智能转换默认黑线、黑字为主题语义色，并保留用户显式指定的彩色图元
 */
export function solidifyGraphvizSvg(svg: string, themeOrIsDark?: ThemeId | string | boolean): string {
  if (!svg || typeof svg !== 'string') return '';
  const palette = resolveGraphvizPalette(themeOrIsDark);

  let processed = svg;

  // 1. 移除根背景默认的白底矩形多边形 (<polygon fill="white" stroke="none" .../>)
  processed = processed.replace(
    /<polygon\s+fill=["']white["']\s+stroke=["']none["']/gi,
    '<polygon fill="none" stroke="none"'
  );
  processed = processed.replace(
    /<polygon\s+fill=["']#ffffff["']\s+stroke=["']none["']/gi,
    '<polygon fill="none" stroke="none"'
  );

  // 2. 如果处于暗色或特定定制主题（如 Dracula, Nord, Sepia 等），对默认黑白图元执行高对比度映射
  if (palette.isDark || (typeof themeOrIsDark === 'string' && themeOrIsDark !== 'light')) {
    // 替换默认黑色边框与线条 (stroke="black" 或 stroke="#000000")
    processed = processed.replace(/stroke=["'](?:black|#000000|#000)["']/gi, `stroke="${palette.edgeColor}"`);
    
    // 替换默认黑色实心填充 (fill="black" 或 fill="#000000"，通常用于箭头或默认实心点)
    processed = processed.replace(/fill=["'](?:black|#000000|#000)["']/gi, `fill="${palette.arrowColor}"`);

    // 替换默认文本颜色: 若 text 没有显式 fill 或 fill="black" / "#000000"
    processed = processed.replace(/<text\b([^>]*?)fill=["'](?:black|#000000|#000)["']([^>]*?)>/gi, `<text$1fill="${palette.textColor}"$2>`);
    processed = processed.replace(/<text\b((?:(?!fill=)[^>])*)>/gi, `<text$1 fill="${palette.textColor}">`);
  }

  // 3. 增强 SVG 容器属性，确保百分百响应式平滑缩放
  if (!processed.includes('class="ov-graphviz-solidified-svg"')) {
    processed = processed.replace(/<svg\b([^>]*)>/i, `<svg$1 class="ov-graphviz-solidified-svg" style="max-width:100%;height:auto;background:transparent;">`);
  }

  return processed;
}

