/**
 * OmniView VS Code 原生主题动态注入服务 (Native Theme Injection Service)
 * 深度提取并动态绑定 VS Code 内置 CSS 变量，支持实时侦测与第三方主题无缝融合。
 */

export interface VsCodeThemeInfo {
  isVsCode: boolean;
  kind: 'dark' | 'light' | 'high-contrast' | 'high-contrast-light';
  editorBackground: string;
  editorForeground: string;
  sidebarBackground: string;
  accentColor: string;
  buttonBackground: string;
}

export interface SimulatedThirdPartyTheme {
  id: string;
  name: string;
  description: string;
  kind: 'dark' | 'light';
  variables: Record<string, string>;
}

/**
 * 常见流行第三方 VS Code 主题特征变量预设 (供独立预览或仿真测试时使用)
 */
export const THIRD_PARTY_THEMES: SimulatedThirdPartyTheme[] = [
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    description: 'Atom 经典传奇暗黑主题，冷灰底色与平衡饱和度高光',
    kind: 'dark',
    variables: {
      '--vscode-editor-background': '#282c34',
      '--vscode-editor-foreground': '#abb2bf',
      '--vscode-sideBar-background': '#21252b',
      '--vscode-sideBarSectionHeader-background': '#282c34',
      '--vscode-editorGroupHeader-tabsBackground': '#21252b',
      '--vscode-tab-activeBackground': '#282c34',
      '--vscode-tab-inactiveBackground': '#21252b',
      '--vscode-editorWidget-background': '#21252b',
      '--vscode-editorWidget-border': '#181a1f',
      '--vscode-panel-border': '#181a1f',
      '--vscode-focusBorder': '#61afef',
      '--vscode-button-background': '#4078f2',
      '--vscode-button-foreground': '#ffffff',
      '--vscode-textCodeBlock-background': '#21252b',
      '--vscode-textBlockQuote-background': 'rgba(97, 175, 239, 0.08)',
      '--vscode-textBlockQuote-border': '#61afef',
      '--vscode-textLink-foreground': '#61afef',
      '--vscode-scrollbarSlider-background': 'rgba(79, 86, 98, 0.4)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(79, 86, 98, 0.7)',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula Official',
    description: '吸血鬼暗夜紫，柔和粉紫高光与沉浸深邃衬底',
    kind: 'dark',
    variables: {
      '--vscode-editor-background': '#282a36',
      '--vscode-editor-foreground': '#f8f8f2',
      '--vscode-sideBar-background': '#21222c',
      '--vscode-sideBarSectionHeader-background': '#191a21',
      '--vscode-editorGroupHeader-tabsBackground': '#191a21',
      '--vscode-tab-activeBackground': '#282a36',
      '--vscode-tab-inactiveBackground': '#21222c',
      '--vscode-editorWidget-background': '#21222c',
      '--vscode-editorWidget-border': '#6272a4',
      '--vscode-panel-border': '#6272a4',
      '--vscode-focusBorder': '#bd93f9',
      '--vscode-button-background': '#bd93f9',
      '--vscode-button-foreground': '#282a36',
      '--vscode-textCodeBlock-background': '#1e1f29',
      '--vscode-textBlockQuote-background': 'rgba(189, 147, 249, 0.1)',
      '--vscode-textBlockQuote-border': '#bd93f9',
      '--vscode-textLink-foreground': '#8be9fd',
      '--vscode-scrollbarSlider-background': 'rgba(98, 114, 164, 0.35)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(98, 114, 164, 0.6)',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: '东京霓虹夜色，深邃海蓝黑底与明亮天青紫调',
    kind: 'dark',
    variables: {
      '--vscode-editor-background': '#1a1b26',
      '--vscode-editor-foreground': '#a9b1d6',
      '--vscode-sideBar-background': '#16161e',
      '--vscode-sideBarSectionHeader-background': '#1f2335',
      '--vscode-editorGroupHeader-tabsBackground': '#16161e',
      '--vscode-tab-activeBackground': '#1a1b26',
      '--vscode-tab-inactiveBackground': '#16161e',
      '--vscode-editorWidget-background': '#16161e',
      '--vscode-editorWidget-border': '#292e42',
      '--vscode-panel-border': '#292e42',
      '--vscode-focusBorder': '#7aa2f7',
      '--vscode-button-background': '#7aa2f7',
      '--vscode-button-foreground': '#15161e',
      '--vscode-textCodeBlock-background': '#16161e',
      '--vscode-textBlockQuote-background': 'rgba(122, 162, 247, 0.1)',
      '--vscode-textBlockQuote-border': '#7aa2f7',
      '--vscode-textLink-foreground': '#7dcfff',
      '--vscode-scrollbarSlider-background': 'rgba(41, 46, 66, 0.5)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(41, 46, 66, 0.8)',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: '舒缓低对比度摩卡暖调，柔美粉彩与护眼排版',
    kind: 'dark',
    variables: {
      '--vscode-editor-background': '#1e1e2e',
      '--vscode-editor-foreground': '#cdd6f4',
      '--vscode-sideBar-background': '#181825',
      '--vscode-sideBarSectionHeader-background': '#11111b',
      '--vscode-editorGroupHeader-tabsBackground': '#11111b',
      '--vscode-tab-activeBackground': '#1e1e2e',
      '--vscode-tab-inactiveBackground': '#181825',
      '--vscode-editorWidget-background': '#181825',
      '--vscode-editorWidget-border': '#313244',
      '--vscode-panel-border': '#313244',
      '--vscode-focusBorder': '#89b4fa',
      '--vscode-button-background': '#89b4fa',
      '--vscode-button-foreground': '#11111b',
      '--vscode-textCodeBlock-background': '#181825',
      '--vscode-textBlockQuote-background': 'rgba(137, 180, 250, 0.1)',
      '--vscode-textBlockQuote-border': '#89b4fa',
      '--vscode-textLink-foreground': '#89dceb',
      '--vscode-scrollbarSlider-background': 'rgba(69, 71, 90, 0.5)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(69, 71, 90, 0.8)',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark Default',
    description: 'GitHub 官方深色模式，高对比度黑灰底与经典绿/蓝色调',
    kind: 'dark',
    variables: {
      '--vscode-editor-background': '#0d1117',
      '--vscode-editor-foreground': '#c9d1d9',
      '--vscode-sideBar-background': '#010409',
      '--vscode-sideBarSectionHeader-background': '#161b22',
      '--vscode-editorGroupHeader-tabsBackground': '#010409',
      '--vscode-tab-activeBackground': '#0d1117',
      '--vscode-tab-inactiveBackground': '#010409',
      '--vscode-editorWidget-background': '#161b22',
      '--vscode-editorWidget-border': '#30363d',
      '--vscode-panel-border': '#30363d',
      '--vscode-focusBorder': '#58a6ff',
      '--vscode-button-background': '#238636',
      '--vscode-button-foreground': '#ffffff',
      '--vscode-textCodeBlock-background': '#161b22',
      '--vscode-textBlockQuote-background': 'rgba(88, 166, 255, 0.08)',
      '--vscode-textBlockQuote-border': '#58a6ff',
      '--vscode-textLink-foreground': '#58a6ff',
      '--vscode-scrollbarSlider-background': 'rgba(110, 118, 129, 0.3)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(110, 118, 129, 0.6)',
    },
  },
  {
    id: 'clean-light',
    name: 'VS Code Light+ (Default)',
    description: 'VS Code 官方纯净亮雅日光主题，清晰锐利日间办公',
    kind: 'light',
    variables: {
      '--vscode-editor-background': '#ffffff',
      '--vscode-editor-foreground': '#000000',
      '--vscode-sideBar-background': '#f3f3f3',
      '--vscode-sideBarSectionHeader-background': '#e8e8e8',
      '--vscode-editorGroupHeader-tabsBackground': '#f3f3f3',
      '--vscode-tab-activeBackground': '#ffffff',
      '--vscode-tab-inactiveBackground': '#ececec',
      '--vscode-editorWidget-background': '#f3f3f3',
      '--vscode-editorWidget-border': '#c8c8c8',
      '--vscode-panel-border': '#e7e7e7',
      '--vscode-focusBorder': '#007acc',
      '--vscode-button-background': '#007acc',
      '--vscode-button-foreground': '#ffffff',
      '--vscode-textCodeBlock-background': '#f5f5f5',
      '--vscode-textBlockQuote-background': 'rgba(0, 122, 204, 0.08)',
      '--vscode-textBlockQuote-border': '#007acc',
      '--vscode-textLink-foreground': '#006ab1',
      '--vscode-scrollbarSlider-background': 'rgba(100, 100, 100, 0.2)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(100, 100, 100, 0.4)',
    },
  },
];

/**
 * 判断当前是否运行在真实的 VS Code Webview 宿主环境中
 */
export function isVsCodeEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as unknown as { __OMNIVIEW_VSCODE__?: boolean }).__OMNIVIEW_VSCODE__) return true;
  if (typeof document !== 'undefined' && document.body) {
    if (
      document.body.classList.contains('vscode-dark') ||
      document.body.classList.contains('vscode-light') ||
      document.body.classList.contains('vscode-high-contrast') ||
      document.body.classList.contains('vscode-high-contrast-light')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 检测当前 VS Code 宿主的主题类型分类 (dark / light / high-contrast)
 */
export function getVsCodeThemeKind(): 'dark' | 'light' | 'high-contrast' | 'high-contrast-light' {
  if (typeof document === 'undefined' || !document.body) return 'dark';
  const classList = document.body.classList;
  if (classList.contains('vscode-high-contrast-light')) return 'high-contrast-light';
  if (classList.contains('vscode-high-contrast')) return 'high-contrast';
  if (classList.contains('vscode-light')) return 'light';
  return 'dark';
}

/**
 * 安全读取当前宿主环境生效的 CSS 变量值
 */
export function readCssVariable(varName: string, fallback = ''): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (val) return val;
    if (document.body) {
      const bodyVal = getComputedStyle(document.body).getPropertyValue(varName).trim();
      if (bodyVal) return bodyVal;
    }
  } catch {
    // ignore CSS computation errors
  }
  return fallback;
}

/**
 * 获取当前 VS Code 宿主主题环境完整诊断元数据
 */
export function getVsCodeThemeInfo(): VsCodeThemeInfo {
  const isVsCode = isVsCodeEnvironment();
  const kind = getVsCodeThemeKind();
  const editorBackground = readCssVariable('--vscode-editor-background', kind === 'light' ? '#ffffff' : '#1e1e1e');
  const editorForeground = readCssVariable('--vscode-editor-foreground', kind === 'light' ? '#000000' : '#cccccc');
  const sidebarBackground = readCssVariable('--vscode-sideBar-background', kind === 'light' ? '#f3f3f3' : '#252526');
  const accentColor = readCssVariable('--vscode-button-background', '#007acc');

  return {
    isVsCode,
    kind,
    editorBackground,
    editorForeground,
    sidebarBackground,
    accentColor,
    buttonBackground: accentColor,
  };
}

/**
 * 建立 VS Code 主题动态监听器 (通过 MutationObserver 捕获宿主主题热切换)
 */
export function setupVsCodeThemeObserver(onChange: (info: VsCodeThemeInfo) => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return () => {};
  }

  const notify = () => {
    onChange(getVsCodeThemeInfo());
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style')) {
        notify();
        break;
      }
    }
  });

  observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });

  return () => {
    observer.disconnect();
  };
}

/**
 * 在独立 Web 模式下注入模拟的第三方主题变量，用于无宿主环境下的即时测试与效果验证
 */
export function applySimulatedTheme(themeId: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // 清除之前可能注入的模拟变量
  const allVars = new Set<string>();
  THIRD_PARTY_THEMES.forEach((t) => Object.keys(t.variables).forEach((k) => allVars.add(k)));

  allVars.forEach((k) => {
    root.style.removeProperty(k);
  });

  if (!themeId) return;

  const found = THIRD_PARTY_THEMES.find((t) => t.id === themeId);
  if (found) {
    Object.entries(found.variables).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });
    // 同步 body class 以模拟 VS Code 宿主
    if (document.body) {
      document.body.classList.remove('vscode-dark', 'vscode-light');
      document.body.classList.add(found.kind === 'light' ? 'vscode-light' : 'vscode-dark');
    }
  }
}
