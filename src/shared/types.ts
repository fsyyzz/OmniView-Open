export type DriverId = 'markdown' | 'svg' | 'pdf' | 'plantuml' | 'csv' | 'code' | 'mindmap' | 'mermaid' | 'graphviz';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  extension: string;
  content: string;
  size: number;
  lastModified: number;
  isModified?: boolean;
  isCustomUploaded?: boolean;
  binaryUrl?: string; // For uploaded PDF or binary assets
  relatedFiles?: FileItem[]; // Local assets referenced by a document, such as SVG images
}

export interface ViewerDriver {
  id: DriverId;
  name: string;
  displayName: string;
  description: string;
  iconName: string;
  supportedExtensions: string[];
  isBuiltin: boolean;
  version: string;
  category: 'core' | 'extended';
  lazyLoaded: boolean;
  engine: string;
  license: string;
}

export type ViewMode = 'preview' | 'source' | 'split' | 'mindmap';
export type WorkbenchView = 'editor' | 'docs' | 'drivers' | 'scaffold';

export interface SoftwareDoc {
  id: string;
  title: string;
  category: 'PRD' | 'Architecture' | 'Scaffold' | 'Security';
  summary: string;
  content: string;
  tags: string[];
}

export type ThemeId = 'system' | 'vscode' | 'dark' | 'light' | 'sepia' | 'midnight' | 'cyber' | 'nord' | 'dracula' | 'forest' | 'solarized';

export interface RenderTheme {
  id: ThemeId;
  name: string;
  label: string;
  description: string;
  isDark: boolean;
  colorDot: string;
  badgeBg: string;
}

export const RENDER_THEMES: RenderTheme[] = [
  {
    id: 'system',
    name: 'VS Code 原生',
    label: 'Native Theme Injection',
    description: '深度绑定 VS Code 内置变量，实时融合 One Dark Pro、Dracula、Tokyo Night 等任意第三方主题',
    isDark: true,
    colorDot: '#007acc',
    badgeBg: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  },
  {
    id: 'dark',
    name: '暗夜深蓝',
    label: 'Dark+ (VS Code)',
    description: '深空幽蓝，高对比度低眼部疲劳，工业级开发首选',
    isDark: true,
    colorDot: '#3b82f6',
    badgeBg: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  },
  {
    id: 'light',
    name: '明雅日光',
    label: 'Clean Light',
    description: '明亮纸质观感，文字清晰锐利，适于日间阅读与文档导出',
    isDark: false,
    colorDot: '#e2e8f0',
    badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
  },
  {
    id: 'nord',
    name: '极地冰川',
    label: 'Nord Arctic',
    description: '北欧极地冷淡风，典雅清爽冰蓝调，久读视力零负担',
    isDark: true,
    colorDot: '#88c0d0',
    badgeBg: 'bg-slate-800 text-cyan-300 border-cyan-800',
  },
  {
    id: 'dracula',
    name: '德古拉紫',
    label: 'Dracula Pro',
    description: '极客圣经经典暗夜紫，柔和粉紫高光与高饱和度代码衬底',
    isDark: true,
    colorDot: '#bd93f9',
    badgeBg: 'bg-purple-950 text-purple-300 border-purple-800',
  },
  {
    id: 'forest',
    name: '竹林禅意',
    label: 'Forest Zen',
    description: '苍翠墨绿自然护眼，沉浸内敛，营造平和心流研读氛围',
    isDark: true,
    colorDot: '#34d399',
    badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  },
  {
    id: 'solarized',
    name: '日耀温润',
    label: 'Solarized Light',
    description: '经典色彩科学暖阳底色，温润低反差抗疲劳专业读本',
    isDark: false,
    colorDot: '#cb4b16',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  {
    id: 'sepia',
    name: '暖阳羊皮',
    label: 'Eye-Care Sepia',
    description: '温润羊皮纸色调，柔和滤除蓝光，长文研读护眼模式',
    isDark: false,
    colorDot: '#d97706',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  {
    id: 'midnight',
    name: '黑曜纯黑',
    label: 'OLED Midnight',
    description: '纯黑背景与高亮翡翠绿点缀，OLED 屏幕极致省电与沉浸',
    isDark: true,
    colorDot: '#10b981',
    badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  },
  {
    id: 'cyber',
    name: '赛博霓虹',
    label: 'Cyber Neon',
    description: '深紫神秘底色与霓虹紫粉高光，未来赛博朋克极客风',
    isDark: true,
    colorDot: '#c084fc',
    badgeBg: 'bg-purple-950 text-purple-300 border-purple-800',
  },
];

export type DensityMode = 'compact' | 'standard' | 'comfortable';

export interface DensityPreset {
  id: DensityMode;
  name: string;
  label: string;
  description: string;
}

export const DENSITY_PRESETS: DensityPreset[] = [
  {
    id: 'compact',
    name: '极致紧凑',
    label: 'Ultra Compact',
    description: '收紧行距与外边距，最大化可视信息密度，适合密集编码与大图速览',
  },
  {
    id: 'standard',
    name: '标准适中',
    label: 'Standard Balanced',
    description: '标准工程师阅读排版，平衡阅读透气感与屏幕利用率',
  },
  {
    id: 'comfortable',
    name: '宽裕舒适',
    label: 'Relaxed Reading',
    description: '大行距与宽屏边距，柔和舒展，适合沉浸式长篇技术规范研读',
  },
];

export type ContentWidthMode = 'narrow' | 'standard' | 'wide' | 'full' | 'a4';
export type OutlinePosition = 'left' | 'right' | 'floating';

export interface WorkbenchSettings {
  // 1. 外观与主题
  theme: ThemeId;
  density: DensityMode;
  locale?: 'zh-CN' | 'en-US';

  // 2. 视图与视口
  currentView?: WorkbenchView;
  viewMode: ViewMode;
  zoom: number;
  contentWidth?: ContentWidthMode;
  fontSize?: number;
  outlineOpen: boolean;
  outlinePosition?: OutlinePosition;
  outlineWidth?: number;
  scrollSync?: boolean;

  // 3. 布局与侧边栏
  sidebarOpen?: boolean;
  explorerOpen?: boolean;
  activeFileId?: string;
  openTabIds?: string[];

  // 4. 分屏与图表驱动
  splitRatio?: number;
  splitRightMode?: 'preview' | 'mindmap';
  mindmapSplitRatio?: number;
  mindmapViewMode?: 'split' | 'mindmap' | 'editor';
  plantUmlSplitRatio?: number;
  plantUmlServerUrl?: string;

  // 5. 编辑与辅助偏好
  wordWrap?: boolean;
  showLineNumbers?: boolean;

  // 6. 渲染与知识库偏好
  enableOkfRendering?: boolean;
}
