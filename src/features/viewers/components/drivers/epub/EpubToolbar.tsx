/**
 * OmniView EPUB 顶部导航与操作工具栏 (EpubToolbar)
 */
import React from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Columns2,
  ScrollText,
  Sparkles,
  Maximize2,
  Minimize2,
  Info,
  Sliders,
  Smartphone,
  FoldHorizontal,
  UnfoldHorizontal,
  Sun,
  Moon,
  Coffee,
  Laptop,
} from 'lucide-react';
import {
  type EpubReaderSettings,
  type EpubReaderTheme,
  type EpubContentWidth,
} from '../../../lib/epubSettingsStorage';
import type { ThemeId } from '../../../../../shared/types';
import { t, type Locale } from '../../../../../shared/lib/i18n';
import { EpubTypographyPopover } from './EpubTypographyPopover';

export interface EpubToolbarProps {
  bookTitle?: string;
  isPaginatedMode: boolean;
  currentPageIndex: number;
  totalSpreadPages: number;
  currentChapterIndex: number;
  totalChapters: number;
  showToc: boolean;
  showInfo: boolean;
  showTypographyMenu: boolean;
  isFullscreen: boolean;
  settings: EpubReaderSettings;
  theme?: ThemeId;
  locale?: Locale;
  themeStyles: {
    paper: string;
    text: string;
    border: string;
    toolbarBg: string;
  };
  typographyMenuRef: React.RefObject<HTMLDivElement | null>;
  onToggleToc: () => void;
  onToggleInfo: () => void;
  onToggleTypographyMenu: () => void;
  onToggleFullscreen: () => void;
  onGoToPrev: () => void;
  onGoToNext: () => void;
  onUpdateSetting: <K extends keyof EpubReaderSettings>(key: K, value: EpubReaderSettings[K]) => void;
  onResetSettings: (defaults: EpubReaderSettings) => void;
  onRecalculatePages: () => void;
  onScrollToChapter: (index: number) => void;
}

export const EpubToolbar: React.FC<EpubToolbarProps> = ({
  bookTitle,
  isPaginatedMode,
  currentPageIndex,
  totalSpreadPages,
  currentChapterIndex,
  totalChapters,
  showToc,
  showInfo,
  showTypographyMenu,
  isFullscreen,
  settings,
  theme,
  locale = 'zh-CN',
  themeStyles,
  typographyMenuRef,
  onToggleToc,
  onToggleInfo,
  onToggleTypographyMenu,
  onToggleFullscreen,
  onGoToPrev,
  onGoToNext,
  onUpdateSetting,
  onResetSettings,
  onRecalculatePages,
  onScrollToChapter,
}) => {
  return (
    <header
      className="h-12 border-b flex items-center justify-between px-3 sm:px-4 z-30 shrink-0 select-none backdrop-blur-md transition-all duration-200"
      style={{
        background: themeStyles.toolbarBg,
        borderColor: themeStyles.border,
      }}
    >
      {/* 左侧：书籍概览与目录抽屉开关 */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleToc}
          className={`p-1.5 rounded-lg border transition flex items-center gap-1.5 text-xs font-medium ${
            showToc
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
          }`}
          style={{ borderColor: showToc ? undefined : themeStyles.border }}
          title={showToc ? '收起目录大纲' : '展开目录大纲'}
          aria-label="目录"
        >
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">目录</span>
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <BookOpen className="w-4 h-4 text-blue-500 shrink-0 hidden sm:block" />
          <span className="font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs">
            {bookTitle || '电子书阅读'}
          </span>
        </div>
      </div>

      {/* 中间：翻页/进度导航控制器 */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onGoToPrev}
          disabled={isPaginatedMode ? currentChapterIndex === 0 && currentPageIndex === 0 : currentChapterIndex === 0}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title={isPaginatedMode ? t('epubPrevPage', locale) : '上一章'}
          aria-label="上一页"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border flex items-center gap-1.5" style={{ borderColor: themeStyles.border }}>
          <span>
            {isPaginatedMode ? (
              <>
                <span className="font-bold">{currentPageIndex + 1}</span>
                <span className="opacity-40">/</span>
                <span className="opacity-70">{totalSpreadPages}</span>
                <span className="opacity-40 text-[10px] hidden sm:inline"> 页</span>
              </>
            ) : (
              <>
                <span className="font-bold">{currentChapterIndex + 1}</span>
                <span className="opacity-40">/</span>
                <span className="opacity-70">{totalChapters}</span>
                <span className="opacity-40 text-[10px] hidden sm:inline"> 章</span>
              </>
            )}
          </span>
        </div>

        <button
          onClick={onGoToNext}
          disabled={
            isPaginatedMode
              ? currentChapterIndex >= totalChapters - 1 && currentPageIndex >= totalSpreadPages - 1
              : currentChapterIndex >= totalChapters - 1
          }
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title={isPaginatedMode ? t('epubNextPage', locale) : '下一章'}
          aria-label="下一页"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 右侧：排版形态切换与高级设置 */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* 流式阅读形态快捷切换组：双叶并排 vs 单页流式 vs 连续滚动 */}
        <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
          <button
            onClick={() => {
              onUpdateSetting('flowMode', 'spread');
              setTimeout(onRecalculatePages, 50);
            }}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.flowMode === 'spread'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="双叶并排 (宽屏书卷跨页)"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">双叶</span>
          </button>
          <button
            onClick={() => {
              onUpdateSetting('flowMode', 'single');
              setTimeout(onRecalculatePages, 50);
            }}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.flowMode === 'single'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="单页流式分页 (单列专注阅读)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">单页</span>
          </button>
          <button
            onClick={() => {
              onUpdateSetting('flowMode', 'scroll');
              onScrollToChapter(currentChapterIndex);
            }}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.flowMode === 'scroll'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="连续流式滚动 (纵向全书无间断阅读)"
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">连续滚动</span>
          </button>
        </div>

        {/* 多种版心宽度快捷切换组 (标准 880px / 宽幅 1180px / 全幅 100%) */}
        <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
          <button
            onClick={() => {
              onUpdateSetting('contentWidth', 'standard');
              setTimeout(onRecalculatePages, 50);
            }}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.contentWidth === 'standard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="标准版心宽度 (Standard: 720~880px)"
            aria-label="标准版心宽度"
          >
            <FoldHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">标准</span>
          </button>
          <button
            onClick={() => {
              onUpdateSetting('contentWidth', 'wide');
              setTimeout(onRecalculatePages, 50);
            }}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.contentWidth === 'wide'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="宽幅版心宽度 (Wide: 1000~1180px)"
            aria-label="宽幅版心宽度"
          >
            <UnfoldHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">宽幅</span>
          </button>
          <button
            onClick={() => {
              onUpdateSetting('contentWidth', 'full');
              setTimeout(onRecalculatePages, 50);
            }}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.contentWidth === 'full'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="全幅满屏宽度 (Full: 100%)"
            aria-label="全幅满屏宽度"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">全幅</span>
          </button>
        </div>

        {/* 阅读主题快捷切换组 (跟随整体 / 明亮纯白 / 暖阳羊皮 / 暗夜深蓝) */}
        <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
          <button
            onClick={() => onUpdateSetting('readerTheme', 'auto')}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.readerTheme === 'auto'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="跟随整体主题 (Auto / System: 继承宿主外观)"
            aria-label="跟随整体主题"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">整体</span>
          </button>
          <button
            onClick={() => onUpdateSetting('readerTheme', 'light')}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.readerTheme === 'light'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="明雅日光 (Clean Light: 高对比度纯白纸张)"
            aria-label="明雅日光"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">日光</span>
          </button>
          <button
            onClick={() => onUpdateSetting('readerTheme', 'sepia')}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.readerTheme === 'sepia'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="暖阳羊皮 (Eye-Care Sepia: 暖阳温润护眼)"
            aria-label="暖阳羊皮"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">羊皮</span>
          </button>
          <button
            onClick={() => onUpdateSetting('readerTheme', 'dark')}
            className={`px-1.5 sm:px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
              settings.readerTheme === 'dark'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title="暗夜深蓝 (Dark+: 经典夜间深色)"
            aria-label="暗夜深蓝"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">暗夜</span>
          </button>
        </div>

        {/* 拟真翻书动效快捷开关 */}
        {isPaginatedMode && (
          <button
            onClick={() => onUpdateSetting('enableFlipEffect', !settings.enableFlipEffect)}
            className={`p-1.5 rounded border transition flex items-center gap-1 ${
              settings.enableFlipEffect
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 dark:text-amber-400'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-50'
            }`}
            style={{ borderColor: settings.enableFlipEffect ? undefined : themeStyles.border }}
            title={settings.enableFlipEffect ? t('epubPageFlipEffectOn', locale) : t('epubPageFlipEffectOff', locale)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[10px]">翻书动效</span>
          </button>
        )}

        {/* 字号微调 A- / A+ */}
        <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-md p-0.5 border" style={{ borderColor: themeStyles.border }}>
          <button
            onClick={() => {
              onUpdateSetting('fontSize', Math.max(13, settings.fontSize - 1));
              setTimeout(onRecalculatePages, 50);
            }}
            disabled={settings.fontSize <= 13}
            className="px-1.5 py-0.5 text-[11px] font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
            title="缩小字号"
          >
            A-
          </button>
          <span className="text-[10px] font-mono px-1 min-w-[20px] text-center">{settings.fontSize}</span>
          <button
            onClick={() => {
              onUpdateSetting('fontSize', Math.min(28, settings.fontSize + 1));
              setTimeout(onRecalculatePages, 50);
            }}
            disabled={settings.fontSize >= 28}
            className="px-1.5 py-0.5 text-[11px] font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
            title="放大字号"
          >
            A+
          </button>
        </div>

        {/* 综合高级排版菜单入口 (Typography & Flow Popover) */}
        <div className="relative">
          <button
            onClick={onToggleTypographyMenu}
            className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-xs ${
              showTypographyMenu
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            style={{ borderColor: showTypographyMenu ? undefined : themeStyles.border }}
            title="排版与流式字体设置 (已全面持久化)"
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden lg:inline font-medium">排版</span>
          </button>

          {/* 高级排版下拉卡片 */}
          {showTypographyMenu && (
            <EpubTypographyPopover
              settings={settings}
              theme={theme}
              themeStyles={themeStyles}
              popoverRef={typographyMenuRef}
              onUpdateSetting={onUpdateSetting}
              onResetSettings={onResetSettings}
              onRecalculatePages={onRecalculatePages}
            />
          )}
        </div>

        {/* 元数据详情抽屉 */}
        <button
          onClick={onToggleInfo}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
          title="书籍出版元数据"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* 全屏切换 */}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition hidden sm:block"
          title={isFullscreen ? '退出全屏' : '沉浸全屏阅读'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
