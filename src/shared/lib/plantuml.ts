// PlantUML URL generator using plantuml-encoder or fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import plantumlEncoder from 'plantuml-encoder';
import { ThemeId, isThemeDark } from '../types';

export const PLANTUML_SERVER_PRESETS = [
  { id: 'official', name: '官方云端服务器 (公网)', url: 'https://www.plantuml.com/plantuml' },
  { id: 'docker', name: '本地 Docker 容器 (localhost:8080)', url: 'http://localhost:8080' },
  { id: 'custom', name: '企业自建私有服务 (自定义)', url: '' },
];

/** 渲染失败时自动尝试的备用服务（按顺序） */
export const PLANTUML_FALLBACK_SERVERS = [
  'https://www.plantuml.com/plantuml',
  'http://localhost:8080',
];

const STORAGE_KEY = 'omnivewer_plantuml_server';
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml';

/**
 * PlantUML 对应 OmniView 各大渲染主题的高保真语义调色盘契约
 */
export interface PlantUmlThemePalette {
  id: string;
  isDark: boolean;
  nodeBg: string;          // 节点、实体、脑图背景
  nodeBorder: string;      // 节点、实体、脑图边框
  fontColor: string;       // 默认正文字体颜色
  arrowColor: string;      // 连线与箭头颜色
  arrowFontColor: string;  // 连线标注颜色
  packageBg: string;       // 分组/容器背景
  packageBorder: string;   // 分组/容器边框
  noteBg: string;          // 注释背景
  noteBorder: string;      // 注释边框
  noteFontColor: string;   // 注释文字
}

/**
 * 14 大渲染主题高保真调色盘定义 (与 index.css 设计令牌 100% 像素级对齐)
 */
export const PLANTUML_THEME_PALETTES: Record<string, PlantUmlThemePalette> = {
  // 1. 暗夜深蓝 (默认暗色)
  dark: {
    id: 'dark',
    isDark: true,
    nodeBg: '#111827',
    nodeBorder: '#38bdf8',
    fontColor: '#f8fafc',
    arrowColor: '#60a5fa',
    arrowFontColor: '#93c5fd',
    packageBg: '#0f172a',
    packageBorder: '#64748b',
    noteBg: '#1e293b',
    noteBorder: '#f59e0b',
    noteFontColor: '#fef08a',
  },
  // 2. 明雅日光 (默认亮色)
  light: {
    id: 'light',
    isDark: false,
    nodeBg: '#ffffff',
    nodeBorder: '#2563eb',
    fontColor: '#0f172a',
    arrowColor: '#1e293b',
    arrowFontColor: '#0f172a',
    packageBg: '#f8fafc',
    packageBorder: '#cbd5e1',
    noteBg: '#fef9c3',
    noteBorder: '#ca8a04',
    noteFontColor: '#713f12',
  },
  // 3. GitHub 极客暗夜
  'github-dark': {
    id: 'github-dark',
    isDark: true,
    nodeBg: '#161b22',
    nodeBorder: '#58a6ff',
    fontColor: '#c9d1d9',
    arrowColor: '#238636',
    arrowFontColor: '#58a6ff',
    packageBg: '#0d1117',
    packageBorder: '#30363d',
    noteBg: '#21262d',
    noteBorder: '#d29922',
    noteFontColor: '#e3b341',
  },
  // 4. Catppuccin Mocha (摩卡猫咪)
  catppuccin: {
    id: 'catppuccin',
    isDark: true,
    nodeBg: '#1e1e2e',
    nodeBorder: '#cba6f7',
    fontColor: '#cdd6f4',
    arrowColor: '#f5c2e7',
    arrowFontColor: '#cba6f7',
    packageBg: '#181825',
    packageBorder: '#585b70',
    noteBg: '#313244',
    noteBorder: '#f9e2af',
    noteFontColor: '#f9e2af',
  },
  // 5. Tokyo Night (东京夜潮)
  'tokyo-night': {
    id: 'tokyo-night',
    isDark: true,
    nodeBg: '#1a1b26',
    nodeBorder: '#7aa2f7',
    fontColor: '#c0caf5',
    arrowColor: '#7dcfff',
    arrowFontColor: '#bb9af7',
    packageBg: '#16161e',
    packageBorder: '#414868',
    noteBg: '#24283b',
    noteBorder: '#e0af68',
    noteFontColor: '#e0af68',
  },
  // 6. Dracula Pro (德古拉紫)
  dracula: {
    id: 'dracula',
    isDark: true,
    nodeBg: '#282a36',
    nodeBorder: '#bd93f9',
    fontColor: '#f8f8f2',
    arrowColor: '#ff79c6',
    arrowFontColor: '#bd93f9',
    packageBg: '#21222c',
    packageBorder: '#6272a4',
    noteBg: '#44475a',
    noteBorder: '#f1fa8c',
    noteFontColor: '#f1fa8c',
  },
  // 7. Nord Arctic (极地冰川)
  nord: {
    id: 'nord',
    isDark: true,
    nodeBg: '#2e3440',
    nodeBorder: '#88c0d0',
    fontColor: '#eceff4',
    arrowColor: '#81a1c1',
    arrowFontColor: '#88c0d0',
    packageBg: '#242933',
    packageBorder: '#4c566a',
    noteBg: '#3b4252',
    noteBorder: '#ebcb8b',
    noteFontColor: '#ebcb8b',
  },
  // 8. Forest Zen (竹林禅意)
  forest: {
    id: 'forest',
    isDark: true,
    nodeBg: '#0f291e',
    nodeBorder: '#34d399',
    fontColor: '#e6f4ea',
    arrowColor: '#2dd4bf',
    arrowFontColor: '#6ee7b7',
    packageBg: '#081c14',
    packageBorder: '#1e4d3a',
    noteBg: '#134e4a',
    noteBorder: '#facc15',
    noteFontColor: '#fef08a',
  },
  // 9. Solarized Light (日耀温润)
  solarized: {
    id: 'solarized',
    isDark: false,
    nodeBg: '#fdf6e3',
    nodeBorder: '#268bd2',
    fontColor: '#586e75',
    arrowColor: '#cb4b16',
    arrowFontColor: '#2aa198',
    packageBg: '#eee8d5',
    packageBorder: '#93a1a1',
    noteBg: '#fef3c7',
    noteBorder: '#b58900',
    noteFontColor: '#657b83',
  },
  // 10. Eye-Care Sepia (暖阳羊皮)
  sepia: {
    id: 'sepia',
    isDark: false,
    nodeBg: '#fffbf0',
    nodeBorder: '#b45309',
    fontColor: '#38291a',
    arrowColor: '#92400e',
    arrowFontColor: '#b45309',
    packageBg: '#f4ecd8',
    packageBorder: '#ddceb4',
    noteBg: '#fef3c7',
    noteBorder: '#d97706',
    noteFontColor: '#78350f',
  },
  // 11. Notion Minimal (极简无界)
  notion: {
    id: 'notion',
    isDark: false,
    nodeBg: '#ffffff',
    nodeBorder: '#e2e8f0',
    fontColor: '#37352f',
    arrowColor: '#2383e2',
    arrowFontColor: '#2383e2',
    packageBg: '#f7f7f5',
    packageBorder: '#e5e5e5',
    noteBg: '#fbfbfa',
    noteBorder: '#d4d4d4',
    noteFontColor: '#5a5a5a',
  },
  // 12. OLED Midnight (黑曜纯黑)
  midnight: {
    id: 'midnight',
    isDark: true,
    nodeBg: '#0a0a0a',
    nodeBorder: '#10b981',
    fontColor: '#f9fafb',
    arrowColor: '#34d399',
    arrowFontColor: '#6ee7b7',
    packageBg: '#000000',
    packageBorder: '#222222',
    noteBg: '#171717',
    noteBorder: '#10b981',
    noteFontColor: '#a7f3d0',
  },
  // 13. Cyber Neon (赛博霓虹)
  cyber: {
    id: 'cyber',
    isDark: true,
    nodeBg: '#180b26',
    nodeBorder: '#c084fc',
    fontColor: '#f3e8ff',
    arrowColor: '#f43f5e',
    arrowFontColor: '#f472b6',
    packageBg: '#0f051d',
    packageBorder: '#4c1d95',
    noteBg: '#2a1245',
    noteBorder: '#fb7185',
    noteFontColor: '#fecdd3',
  },
};

/**
 * 根据 ThemeId 或 boolean 解析对应的 PlantUML 调色盘
 */
export function resolvePlantUmlPalette(themeOrIsDark?: ThemeId | boolean): PlantUmlThemePalette {
  if (typeof themeOrIsDark === 'boolean') {
    return themeOrIsDark ? PLANTUML_THEME_PALETTES.dark : PLANTUML_THEME_PALETTES.light;
  }
  const themeId = themeOrIsDark || 'dark';
  if (themeId === 'system' || themeId === 'vscode') {
    const isDark = isThemeDark(themeId);
    return isDark ? PLANTUML_THEME_PALETTES.dark : PLANTUML_THEME_PALETTES.light;
  }
  return PLANTUML_THEME_PALETTES[themeId] || (isThemeDark(themeId) ? PLANTUML_THEME_PALETTES.dark : PLANTUML_THEME_PALETTES.light);
}

export function getPlantUmlServerBase(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
  } catch {
    // Ignore in non-browser context
  }
  return DEFAULT_SERVER;
}

export function setPlantUmlServerBase(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
  } catch {
    // Ignore
  }
}

function resolveSvgEndpoint(baseUrl: string): string {
  const base = (baseUrl || DEFAULT_SERVER).replace(/\/$/, '');
  if (base.endsWith('/svg')) return base;
  return `${base}/svg`;
}

function resolvePngEndpoint(baseUrl: string): string {
  const base = (baseUrl || DEFAULT_SERVER).replace(/\/$/, '');
  if (base.endsWith('/png')) return base;
  return `${base}/png`;
}

/** 是否具备可渲染的 PlantUML 正文（避免空图被编码成极小白点） */
export function hasRenderablePlantUmlCode(pumlCode: string | undefined | null): boolean {
  const trimmed = (pumlCode || '').trim();
  if (!trimmed) return false;

  // 去掉围栏、行注释与空行后，仍需有实际图表语句
  const body = trimmed
    .replace(/@startuml\b[^\n]*/gi, '')
    .replace(/@enduml\b/gi, '')
    .replace(/^\s*'.*$/gm, '')
    .replace(/^\s*\/'[\s\S]*?'\/\s*$/gm, '')
    .replace(/^\s*$/gm, '')
    .trim();

  return body.length > 0;
}

export function encodePlantUml(pumlCode: string): string {
  const cleanCode = pumlCode.trim();
  try {
    return plantumlEncoder.encode(cleanCode);
  } catch (err) {
    console.error('Failed to encode PlantUML with plantuml-encoder:', err);
    // plantuml ~1 前缀表示 base64 文本载荷
    return `~1${btoa(unescape(encodeURIComponent(cleanCode)))}`;
  }
}

/**
 * 针对指定主题或深浅模式注入高保真、语义对齐的 PlantUML 皮肤指令与原生样式块
 * 覆盖时序图、组件图、状态机、类图、用例图以及思维脑图等全景图元
 * 若源码中已显式指定 !theme 或 arrowColor 等自定义皮肤，则尊重用户原生配置，不作侵入。
 */
export function preparePlantUmlCode(pumlCode: string, themeOrIsDark?: ThemeId | boolean): string {
  const code = (pumlCode || '').trim();
  if (!code) return code;

  // 若用户已声明了 !theme 或者自定义了关键箭头/背景色/样式块，则不再额外注入
  if (/^[ \t]*!theme\s+/m.test(code) || /^[ \t]*skinparam\s+(backgroundColor|arrowColor|sequenceArrowColor)/im.test(code)) {
    return code;
  }

  const palette = resolvePlantUmlPalette(themeOrIsDark);

  // 1. 针对思维脑图 (Mindmap) 与工作分解结构 (WBS) 的原生样式块
  const hasCustomStyle = /<style>[\s\S]*?(mindmapDiagram|wbsDiagram)[\s\S]*?<\/style>/i.test(code);
  const styleBlock = !hasCustomStyle
    ? [
        '<style>',
        'mindmapDiagram {',
        '  node {',
        `    BackgroundColor ${palette.nodeBg}`,
        `    LineColor ${palette.nodeBorder}`,
        `    FontColor ${palette.fontColor}`,
        '    RoundCorner 10',
        '  }',
        '  arrow {',
        `    LineColor ${palette.arrowColor}`,
        '    LineThickness 1.5',
        '  }',
        '}',
        'wbsDiagram {',
        '  node {',
        `    BackgroundColor ${palette.nodeBg}`,
        `    LineColor ${palette.nodeBorder}`,
        `    FontColor ${palette.fontColor}`,
        '    RoundCorner 8',
        '  }',
        '  arrow {',
        `    LineColor ${palette.arrowColor}`,
        '    LineThickness 1.5',
        '  }',
        '}',
        '</style>',
      ].join('\n')
    : '';

  // 2. 针对 UML 图元全景覆盖 (动态绑定当前主题调色盘，杜绝同色与违和感)
  const skinparams = [
    'skinparam backgroundColor transparent',
    `skinparam defaultFontColor ${palette.fontColor}`,
    `skinparam ArrowColor ${palette.arrowColor}`,
    `skinparam ArrowFontColor ${palette.arrowFontColor}`,
    'skinparam ArrowThickness 1.8',
    `skinparam sequenceLifeLineBorderColor ${palette.packageBorder}`,
    `skinparam sequenceLifeLineBackgroundColor ${palette.packageBg}`,
    `skinparam participantBorderColor ${palette.nodeBorder}`,
    `skinparam participantBackgroundColor ${palette.nodeBg}`,
    `skinparam participantFontColor ${palette.fontColor}`,
    `skinparam actorBorderColor ${palette.nodeBorder}`,
    `skinparam actorBackgroundColor ${palette.nodeBg}`,
    `skinparam actorFontColor ${palette.fontColor}`,
    `skinparam usecaseBorderColor ${palette.nodeBorder}`,
    `skinparam usecaseBackgroundColor ${palette.nodeBg}`,
    `skinparam usecaseFontColor ${palette.fontColor}`,
    `skinparam usecaseArrowColor ${palette.arrowColor}`,
    `skinparam classBorderColor ${palette.nodeBorder}`,
    `skinparam classBackgroundColor ${palette.nodeBg}`,
    `skinparam classFontColor ${palette.fontColor}`,
    `skinparam classArrowColor ${palette.arrowColor}`,
    `skinparam stateBorderColor ${palette.nodeBorder}`,
    `skinparam stateBackgroundColor ${palette.nodeBg}`,
    `skinparam stateFontColor ${palette.fontColor}`,
    `skinparam stateArrowColor ${palette.arrowColor}`,
    `skinparam activityBorderColor ${palette.nodeBorder}`,
    `skinparam activityBackgroundColor ${palette.nodeBg}`,
    `skinparam activityFontColor ${palette.fontColor}`,
    `skinparam activityArrowColor ${palette.arrowColor}`,
    `skinparam componentBorderColor ${palette.nodeBorder}`,
    `skinparam componentBackgroundColor ${palette.nodeBg}`,
    `skinparam componentFontColor ${palette.fontColor}`,
    `skinparam componentArrowColor ${palette.arrowColor}`,
    `skinparam packageBorderColor ${palette.packageBorder}`,
    `skinparam packageBackgroundColor ${palette.packageBg}`,
    `skinparam packageFontColor ${palette.fontColor}`,
    `skinparam rectangleBorderColor ${palette.packageBorder}`,
    `skinparam rectangleBackgroundColor ${palette.packageBg}`,
    `skinparam rectangleFontColor ${palette.fontColor}`,
    `skinparam agentBorderColor ${palette.nodeBorder}`,
    `skinparam agentBackgroundColor ${palette.nodeBg}`,
    `skinparam agentFontColor ${palette.fontColor}`,
    `skinparam databaseBorderColor ${palette.nodeBorder}`,
    `skinparam databaseBackgroundColor ${palette.nodeBg}`,
    `skinparam databaseFontColor ${palette.fontColor}`,
    `skinparam queueBorderColor ${palette.nodeBorder}`,
    `skinparam queueBackgroundColor ${palette.nodeBg}`,
    `skinparam queueFontColor ${palette.fontColor}`,
    `skinparam collectionsBorderColor ${palette.nodeBorder}`,
    `skinparam collectionsBackgroundColor ${palette.nodeBg}`,
    `skinparam collectionsFontColor ${palette.fontColor}`,
    `skinparam cloudBorderColor ${palette.nodeBorder}`,
    `skinparam cloudBackgroundColor ${palette.nodeBg}`,
    `skinparam cloudFontColor ${palette.fontColor}`,
    `skinparam nodeBorderColor ${palette.nodeBorder}`,
    `skinparam nodeBackgroundColor ${palette.nodeBg}`,
    `skinparam nodeFontColor ${palette.fontColor}`,
    `skinparam storageBorderColor ${palette.nodeBorder}`,
    `skinparam storageBackgroundColor ${palette.nodeBg}`,
    `skinparam storageFontColor ${palette.fontColor}`,
    `skinparam cardBorderColor ${palette.nodeBorder}`,
    `skinparam cardBackgroundColor ${palette.nodeBg}`,
    `skinparam cardFontColor ${palette.fontColor}`,
    `skinparam boundaryBorderColor ${palette.nodeBorder}`,
    `skinparam boundaryBackgroundColor ${palette.nodeBg}`,
    `skinparam boundaryFontColor ${palette.fontColor}`,
    `skinparam controlBorderColor ${palette.nodeBorder}`,
    `skinparam controlBackgroundColor ${palette.nodeBg}`,
    `skinparam controlFontColor ${palette.fontColor}`,
    `skinparam entityBorderColor ${palette.nodeBorder}`,
    `skinparam entityBackgroundColor ${palette.nodeBg}`,
    `skinparam entityFontColor ${palette.fontColor}`,
    `skinparam interfaceBorderColor ${palette.nodeBorder}`,
    `skinparam interfaceBackgroundColor ${palette.nodeBg}`,
    `skinparam interfaceFontColor ${palette.fontColor}`,
    `skinparam fileBorderColor ${palette.packageBorder}`,
    `skinparam fileBackgroundColor ${palette.packageBg}`,
    `skinparam fileFontColor ${palette.fontColor}`,
    `skinparam folderBorderColor ${palette.packageBorder}`,
    `skinparam folderBackgroundColor ${palette.packageBg}`,
    `skinparam folderFontColor ${palette.fontColor}`,
    `skinparam frameBorderColor ${palette.packageBorder}`,
    `skinparam frameBackgroundColor ${palette.packageBg}`,
    `skinparam frameFontColor ${palette.fontColor}`,
    `skinparam noteBorderColor ${palette.noteBorder}`,
    `skinparam noteBackgroundColor ${palette.noteBg}`,
    `skinparam noteFontColor ${palette.noteFontColor}`,
    `skinparam BoxBorderColor ${palette.nodeBorder}`,
  ].join('\n');

  const payload = styleBlock ? `${styleBlock}\n${skinparams}` : skinparams;

  const startMatch = code.match(/^[ \t]*@start[a-z]+\b[^\r\n]*\r?\n/m);
  if (startMatch && startMatch.index !== undefined) {
    const insertPos = startMatch.index + startMatch[0].length;
    return code.slice(0, insertPos) + payload + '\n' + code.slice(insertPos);
  }

  return payload + '\n' + code;
}

export function getPlantUmlSvgUrl(pumlCode: string, customServerUrl?: string, themeOrIsDark?: ThemeId | boolean): string {
  if (!hasRenderablePlantUmlCode(pumlCode)) return '';
  const prepared = preparePlantUmlCode(pumlCode, themeOrIsDark);
  const encoded = encodePlantUml(prepared);
  const svgEndpoint = resolveSvgEndpoint(customServerUrl || getPlantUmlServerBase());
  return `${svgEndpoint}/${encoded}`;
}

export function getPlantUmlPngUrl(pumlCode: string, customServerUrl?: string, themeOrIsDark?: ThemeId | boolean): string {
  if (!hasRenderablePlantUmlCode(pumlCode)) return '';
  try {
    const prepared = preparePlantUmlCode(pumlCode, themeOrIsDark);
    const encoded = encodePlantUml(prepared);
    const pngEndpoint = resolvePngEndpoint(customServerUrl || getPlantUmlServerBase());
    return `${pngEndpoint}/${encoded}`;
  } catch (err) {
    console.error('Failed to encode PlantUML png:', err);
    return '';
  }
}

/** 为图片 URL 追加缓存破坏参数，强制重新拉取 */
export function withPlantUmlCacheBust(url: string, nonce: number | string): string {
  if (!url) return '';
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}ov_cb=${encodeURIComponent(String(nonce))}`;
}
