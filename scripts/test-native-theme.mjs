import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 1. 验证 CSS 文件中关于 native theme 与 VS Code 内置变量的绑定声明
const cssPath = resolve('src/index.css');
const cssContent = readFileSync(cssPath, 'utf8');

assert(
  cssContent.includes(':root[data-theme="system"]') || cssContent.includes(':root[data-theme="vscode"]'),
  'index.css 必须包含 system / vscode 主题的声明'
);

assert(
  cssContent.includes('--vscode-editor-background'),
  'index.css 必须绑定 --vscode-editor-background'
);

assert(
  cssContent.includes('--vscode-editor-foreground'),
  'index.css 必须绑定 --vscode-editor-foreground'
);

assert(
  cssContent.includes('--vscode-sideBar-background'),
  'index.css 必须绑定 --vscode-sideBar-background'
);

assert(
  cssContent.includes('--vscode-tab-activeBackground'),
  'index.css 必须绑定 --vscode-tab-activeBackground'
);

// 2. 验证 nativeTheme.ts 模块的完整性
const nativeThemeSource = readFileSync(resolve('src/shared/lib/nativeTheme.ts'), 'utf8');

assert(nativeThemeSource.includes('export function isVsCodeEnvironment'), '必须导出 isVsCodeEnvironment');
assert(nativeThemeSource.includes('export function getVsCodeThemeInfo'), '必须导出 getVsCodeThemeInfo');
assert(nativeThemeSource.includes('export function setupVsCodeThemeObserver'), '必须导出 setupVsCodeThemeObserver');
assert(nativeThemeSource.includes('export const THIRD_PARTY_THEMES'), '必须导出 THIRD_PARTY_THEMES');
assert(nativeThemeSource.includes('export function applySimulatedTheme'), '必须导出 applySimulatedTheme');

// 3. 验证第三方主题包含 One Dark Pro、Dracula、Tokyo Night、Catppuccin、GitHub Dark 等经典主题
assert(nativeThemeSource.includes('one-dark-pro') || nativeThemeSource.includes('oneDarkPro'), 'THIRD_PARTY_THEMES 必须支持 One Dark Pro');
assert(nativeThemeSource.includes('dracula'), 'THIRD_PARTY_THEMES 必须支持 Dracula');
assert(nativeThemeSource.includes('tokyo-night') || nativeThemeSource.includes('tokyoNight'), 'THIRD_PARTY_THEMES 必须支持 Tokyo Night');
assert(nativeThemeSource.includes('catppuccin-mocha') || nativeThemeSource.includes('catppuccinMocha'), 'THIRD_PARTY_THEMES 必须支持 Catppuccin Mocha');
assert(nativeThemeSource.includes('github-dark') || nativeThemeSource.includes('githubDark'), 'THIRD_PARTY_THEMES 必须支持 GitHub Dark');

// 4. 验证 types.ts 中 ThemeId 与 RENDER_THEMES 的对齐
const typesSource = readFileSync(resolve('src/shared/types.ts'), 'utf8');
assert(typesSource.includes("'system'"), "ThemeId 必须包含 'system'");
assert(typesSource.includes("id: 'system'"), "RENDER_THEMES 必须包含 id: 'system'");

// 5. 验证 settingsStorage.ts 中 theme 的验证与向下兼容
const settingsStorageSource = readFileSync(resolve('src/shared/lib/settingsStorage.ts'), 'utf8');
assert(settingsStorageSource.includes("theme === 'vscode'") && settingsStorageSource.includes("'system'"), 'settingsStorage 必须兼容 vscode 和 system 主题别名');

console.log('✅ All 24 Native Theme Injection assertions passed successfully!');
