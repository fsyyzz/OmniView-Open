/**
 * OmniView -> Univer 主题桥接与全主题令牌映射器
 * 确保 Univer 电子表格在 VS Code 多主题 (如 Catppuccin, Tokyo Night, GitHub Dark 等) 及高对比度下
 * 保持无刺眼白边、无色彩断层且与 --ov-* 变量像素级融合
 * 作者: 周赞
 */
import { defaultTheme, darkBlueTheme } from '@univerjs/themes';
import type { ThemeId } from '../../../../../shared/types';

/**
 * 根据 OmniView 的当前主题与暗色状态构建 Univer 主题覆盖对象
 */
export function getUniverThemeConfig(isDarkTheme: boolean, _themeId?: ThemeId) {
  const baseTheme = isDarkTheme ? darkBlueTheme : defaultTheme;
  if (!isDarkTheme) {
    return baseTheme;
  }

  // 暗色模式下的深空灰/黑设计令牌融合
  return {
    ...baseTheme,
    // 基础背景与面板色
    colorBgLayout: 'var(--ov-bg-primary, #1e1e1e)',
    colorBgContainer: 'var(--ov-bg-secondary, #252526)',
    colorBgElevated: 'var(--ov-bg-tertiary, #2d2d2d)',
    // 文本颜色
    colorText: 'var(--ov-text-primary, #cccccc)',
    colorTextSecondary: 'var(--ov-text-secondary, #999999)',
    colorTextTertiary: 'var(--ov-text-tertiary, #666666)',
    // 边框色
    colorBorder: 'var(--ov-border-base, #3e3e42)',
    colorBorderSecondary: 'var(--ov-border-subtle, #333333)',
    // 强调与主色
    colorPrimary: 'var(--ov-accent-primary, #007acc)',
    colorPrimaryHover: 'var(--ov-accent-hover, #1f8ad2)',
  };
}
