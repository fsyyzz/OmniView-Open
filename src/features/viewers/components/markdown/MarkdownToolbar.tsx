/**
 * Markdown 阅读控制顶部工具栏组件 (逻辑分组重构 + 即时悬浮提示 + 多语言国际化)
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  List,
  Search,
  Palette,
  AlignJustify,
  Minus,
  Plus,
  RotateCcw,
  Copy,
  Check,
  Printer,
  MoreHorizontal,
  ArrowUp,
  Download,
  ExternalLink,
  RefreshCw,
  Maximize2,
  Languages,
  Play,
  Pause,
  FileText,
  Network,
  Eye,
  Split,
  Code,
  Sparkles,
  Settings,
  Presentation,
  Keyboard,
  Replace,
  X,
  PanelTop,
  Columns,
} from 'lucide-react';
import { ThemeId, RENDER_THEMES, DensityMode, DENSITY_PRESETS, ViewMode, ContentWidthMode } from '../../../../shared/types';
import { MarkdownHeading } from '../../lib/markdownAst';
import { Locale, t } from '../../../../shared/lib/i18n';

interface MarkdownToolbarProps {
  fileName: string;
  filePath?: string;
  headingsCount: number;
  currentHeading?: MarkdownHeading;
  readingProgress: number;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onFindText: (backwards?: boolean) => void;
  replaceText?: string;
  onReplaceTextChange?: (text: string) => void;
  showReplace?: boolean;
  onToggleReplace?: () => void;
  onReplaceSingle?: () => void;
  onReplaceAll?: () => void;
  matchCase?: boolean;
  onToggleMatchCase?: () => void;
  matchCount?: number;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  density: DensityMode;
  onDensityChange: (density: DensityMode) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  contentWidth: ContentWidthMode;
  onCycleWidth: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  presentationMode?: boolean;
  onTogglePresentationMode?: () => void;
  autoScrollSpeed: number;
  onToggleAutoScroll: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onCopyRawMarkdown: () => void;
  onCopyCurrentSection: () => void;
  onCopyRichText: () => void;
  onExportHtml: () => void;
  onPrint?: () => void;
  onExportWord?: () => void;
  isExportingWord?: boolean;
  onOpenInEditor?: () => void;
  onScrollToTop: () => void;
  copied: boolean;
  copiedSection: boolean;
  copiedRich: boolean;
  fileCharCount: number;
  fileWordCount: number;
  isVisible: boolean;
  onMouseEnter: () => void;
  locale: Locale;
  onLocaleChange: (loc: Locale) => void;
  isMindmap?: boolean;
  onToggleMindmap?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
  showDiagramToolbars?: boolean;
  onToggleDiagramToolbars?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
  onReloadDocument?: () => void;
  isReloading?: boolean;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  headingsCount,
  readingProgress,
  outlineOpen,
  onToggleOutline,
  searchText,
  onSearchTextChange,
  onFindText,
  replaceText = '',
  onReplaceTextChange,
  showReplace = false,
  onToggleReplace,
  onReplaceSingle,
  onReplaceAll,
  matchCase = false,
  onToggleMatchCase,
  matchCount = 0,
  theme,
  onThemeChange,
  density,
  onDensityChange,
  fontSize,
  onFontSizeChange,
  contentWidth,
  onCycleWidth,
  focusMode,
  onToggleFocusMode,
  presentationMode = false,
  onTogglePresentationMode,
  autoScrollSpeed,
  onToggleAutoScroll,
  zoom,
  onZoomChange,
  onCopyRawMarkdown,
  onCopyCurrentSection,
  onCopyRichText,
  onExportHtml,
  onPrint,
  onExportWord,
  isExportingWord,
  onOpenInEditor,
  onScrollToTop,
  copied,
  copiedSection,
  copiedRich,
  fileCharCount,
  fileWordCount,
  isVisible,
  onMouseEnter,
  locale,
  onLocaleChange,
  viewMode = 'preview',
  onViewModeChange,
  enableOkf = true,
  onToggleOkf,
  showDiagramToolbars = false,
  onToggleDiagramToolbars,
  onOpenSettings,
  onOpenShortcuts,
  onReloadDocument,
  isReloading = false,
}) => {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [densityMenuOpen, setDensityMenuOpen] = useState(false);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    align: 'left' | 'center' | 'right';
  } | null>(null);

  const [toolbarWidth, setToolbarWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  const headerRef = useRef<HTMLElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const densityMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const isAnyMenuOpen = themeMenuOpen || densityMenuOpen || fontSizeMenuOpen || moreMenuOpen || langMenuOpen;

  // 实时监测工具栏容器可用宽度（适配 ~1080px 窗口、侧边栏展开/收起及分屏宽度变化）
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setToolbarWidth(Math.round(rect.width));
      }
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setToolbarWidth(Math.round(entry.contentRect.width));
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) setThemeMenuOpen(false);
      if (densityMenuRef.current && !densityMenuRef.current.contains(e.target as Node)) setDensityMenuOpen(false);
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(e.target as Node)) setFontSizeMenuOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    if (isAnyMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAnyMenuOpen]);

  const handleHeaderMouseOver = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isAnyMenuOpen) {
        setHoverTooltip(null);
        return;
      }
      const target = (e.target as HTMLElement | null)?.closest('[data-ov-tooltip]') as HTMLElement | null;
      if (!target || !headerRef.current) {
        setHoverTooltip(null);
        return;
      }
      // 忽略弹层菜单内部元素，避免遮挡菜单项
      if (target.closest('.markdown-more-menu, #omniview-markdown-replace-panel')) {
        setHoverTooltip(null);
        return;
      }
      const text = target.getAttribute('data-ov-tooltip');
      if (!text) {
        setHoverTooltip(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const centerX = rect.left + rect.width / 2;
      const align: 'left' | 'center' | 'right' =
        centerX < 140 ? 'left' : centerX > vw - 140 ? 'right' : 'center';
      const x = align === 'left' ? Math.max(8, rect.left) : align === 'right' ? Math.min(vw - 8, rect.right) : centerX;
      setHoverTooltip({
        text,
        x,
        y: rect.bottom + 7,
        align,
      });
    },
    [isAnyMenuOpen]
  );

  const handleHeaderMouseLeave = useCallback(() => {
    setHoverTooltip(null);
  }, []);

  const activeTheme = RENDER_THEMES.find(tItem => tItem.id === theme) || RENDER_THEMES[0];
  const activeDensity = DENSITY_PRESETS.find(d => d.id === density) || DENSITY_PRESETS[0];

  const widthTitle = {
    narrow: `${t('width', locale)}: ${t('widthNarrow', locale)}`,
    standard: `${t('width', locale)}: ${t('widthStandard', locale)}`,
    wide: `${t('width', locale)}: ${t('widthWide', locale)}`,
    full: `${t('width', locale)}: ${t('widthFull', locale)}`,
    a4: `${t('width', locale)}: ${t('widthA4', locale)}`,
  }[contentWidth];

  const isZh = locale === 'zh-CN';

  return (
    <header
      ref={headerRef}
      className={`markdown-toolbar ${isVisible || !focusMode ? 'is-visible' : ''}`}
      data-toolbar-tier={toolbarWidth < 660 ? 'sm' : toolbarWidth < 980 ? 'md' : toolbarWidth < 1240 ? 'lg' : 'xl'}
      onMouseEnter={onMouseEnter}
      onMouseOver={handleHeaderMouseOver}
      onMouseLeave={handleHeaderMouseLeave}
    >
      {/* Left Group: 导航与全文检索 (大纲目录 + 搜索与替换) */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          className={`markdown-tool-button ${outlineOpen ? 'is-active font-semibold' : ''}`}
          onClick={onToggleOutline}
          title={`${t('outlineTooltip', locale)} (${headingsCount} ${t('sectionsCount', locale)})`}
          data-ov-tooltip={`${t('outlineTooltip', locale)} (${headingsCount} ${t('sectionsCount', locale)})`}
          aria-label={t('outline', locale)}
        >
          <List size={14} />
          {headingsCount > 0 && (
            <span className="text-[10px] font-mono opacity-75">{headingsCount}</span>
          )}
        </button>

        <div className="relative flex items-center min-w-0">
          <div
            className="markdown-search-box flex items-center"
            title={`${t('searchPlaceholder', locale)} (Ctrl+F)`}
            data-ov-tooltip={`${t('searchPlaceholder', locale)} (Ctrl+F)`}
          >
            <Search size={13} className="shrink-0 opacity-75" />
            <input
              id="omniview-markdown-search-input"
              value={searchText}
              onChange={e => onSearchTextChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onFindText(e.shiftKey);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  onFindText(false);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  onFindText(true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onSearchTextChange('');
                  (e.target as HTMLInputElement).blur();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
                  e.preventDefault();
                  onToggleReplace?.();
                }
              }}
              placeholder={`${t('searchPlaceholder', locale)} (Ctrl+F)`}
              aria-label={t('searchPlaceholder', locale)}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => onSearchTextChange('')}
                className="text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] text-xs px-1"
                title={isZh ? '清除搜索 (Esc)' : 'Clear search (Esc)'}
                data-ov-tooltip={isZh ? '清除搜索 (Esc)' : 'Clear search (Esc)'}
                aria-label={isZh ? '清除搜索' : 'Clear search'}
              >
                ×
              </button>
            )}
            <button
              type="button"
              onClick={() => onFindText(true)}
              title={`${t('prevMatch', locale)} (Shift+Enter / ↑)`}
              data-ov-tooltip={`${t('prevMatch', locale)} (Shift+Enter / ↑)`}
              aria-label={t('prevMatch', locale)}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onFindText(false)}
              title={`${t('nextMatch', locale)} (Enter / ↓)`}
              data-ov-tooltip={`${t('nextMatch', locale)} (Enter / ↓)`}
              aria-label={t('nextMatch', locale)}
            >
              ↓
            </button>
            {onToggleReplace && (
              <button
                type="button"
                id="btn-markdown-toggle-replace"
                onClick={onToggleReplace}
                className={`p-1 rounded text-xs transition ${
                  showReplace
                    ? 'bg-[var(--ov-accent)] text-[var(--ov-text-on-accent,#ffffff)] shadow-2xs'
                    : 'text-[var(--ov-text-muted)] hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover)]'
                }`}
                title={t('toggleReplace', locale)}
                data-ov-tooltip={t('toggleReplace', locale)}
                aria-label={t('toggleReplace', locale)}
              >
                <Replace size={13} />
              </button>
            )}
          </div>

          {/* 悬浮在查询框正下方的独立替换面板 */}
          {showReplace && (
            <div
              id="omniview-markdown-replace-panel"
              className="absolute left-0 top-full mt-1.5 z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-2xl border animate-in fade-in-50 slide-in-from-top-1 duration-150 select-none whitespace-nowrap"
              style={{
                background: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
                boxShadow: 'var(--ov-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.35))',
              }}
            >
              <span className="text-xs opacity-50 shrink-0 select-none">⇄</span>
              <input
                id="omniview-markdown-replace-input"
                type="text"
                value={replaceText}
                onChange={e => onReplaceTextChange?.(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.ctrlKey || e.metaKey || e.altKey) {
                      onReplaceAll?.();
                    } else {
                      onReplaceSingle?.();
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onToggleReplace?.();
                  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    document.getElementById('omniview-markdown-search-input')?.focus();
                  }
                }}
                placeholder={t('replacePlaceholder', locale)}
                title={t('replacePlaceholder', locale)}
                className="w-32 sm:w-44 border rounded px-2 py-0.5 text-xs focus:outline-hidden font-sans"
                style={{
                  background: 'var(--ov-code-bg)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
              >
              </input>
              <button
                type="button"
                onClick={onReplaceSingle}
                disabled={!searchText.trim() || matchCount === 0}
                className="px-2 py-0.5 rounded text-[11px] font-medium border border-blue-600 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-40 transition"
                title={t('replaceTooltip', locale)}
              >
                {t('replace', locale)}
              </button>
              <button
                type="button"
                onClick={onReplaceAll}
                disabled={!searchText.trim() || matchCount === 0}
                className="px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--ov-border)] bg-[var(--ov-surface-hover)] hover:bg-blue-600 hover:text-white cursor-pointer disabled:opacity-40 transition"
                title={t('replaceAllTooltip', locale)}
              >
                {t('replaceAll', locale)}
              </button>
              {onToggleMatchCase && (
                <button
                  type="button"
                  onClick={onToggleMatchCase}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                    matchCase
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                      : 'border-[var(--ov-border)] text-[var(--ov-text-secondary)] hover:bg-[var(--ov-surface-hover)]'
                  }`}
                  title={t('matchCase', locale)}
                >
                  Aa
                </button>
              )}
              <button
                type="button"
                onClick={onToggleReplace}
                className="p-1 rounded cursor-pointer hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] transition ml-0.5"
                title={isZh ? '收起替换面板 (Esc)' : 'Close replace panel (Esc)'}
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center Group: 视图模式切换器 (预览 / 分屏 / 源码 / 思维导图) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="markdown-view-mode-switcher">
          <button
            type="button"
            onClick={() => onViewModeChange?.('preview')}
            className={`markdown-view-mode-btn ${viewMode === 'preview' ? 'is-active' : ''}`}
            title={t('viewModePreviewTooltip', locale)}
            data-ov-tooltip={t('viewModePreviewTooltip', locale)}
            aria-label={t('viewModePreview', locale)}
          >
            <Eye size={13} />
            <span className="markdown-view-mode-label text-[11px] font-medium">{t('viewModePreview', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange?.('split')}
            className={`markdown-view-mode-btn ${viewMode === 'split' ? 'is-active' : ''}`}
            title={t('viewModeSplitTooltip', locale)}
            data-ov-tooltip={t('viewModeSplitTooltip', locale)}
            aria-label={t('viewModeSplit', locale)}
          >
            <Split size={13} />
            <span className="markdown-view-mode-label text-[11px] font-medium">{t('viewModeSplit', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange?.('source')}
            className={`markdown-view-mode-btn ${viewMode === 'source' ? 'is-active' : ''}`}
            title={t('viewModeSourceTooltip', locale)}
            data-ov-tooltip={t('viewModeSourceTooltip', locale)}
            aria-label={t('viewModeSource', locale)}
          >
            <Code size={13} />
            <span className="markdown-view-mode-label text-[11px] font-medium">{t('viewModeSource', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange?.('mindmap')}
            className={`markdown-view-mode-btn ${viewMode === 'mindmap' ? 'is-active' : ''}`}
            title={t('viewModeMindmapTooltip', locale)}
            data-ov-tooltip={t('viewModeMindmapTooltip', locale)}
            aria-label={t('viewModeMindmap', locale)}
          >
            <Network size={13} />
            <span className="markdown-view-mode-label text-[11px] font-medium">{t('viewModeMindmap', locale)}</span>
          </button>
        </div>
      </div>

      {/* Right Group: 按认知语义分组组织的工具栏按钮群 (支持容器查询自适应渐进式收纳) */}
      <div className="markdown-toolbar-actions">
        {/* 分组 1：外观与排版样式 (主题、字号、排版紧凑度、版面宽度) */}
        <div className="markdown-toolbar-group" role="group" aria-label={isZh ? '外观与排版' : 'Appearance & Typography'}>
          {/* Theme dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              className="markdown-tool-button"
              onClick={() => {
                setThemeMenuOpen(prev => !prev);
                setDensityMenuOpen(false);
                setFontSizeMenuOpen(false);
                setMoreMenuOpen(false);
                setLangMenuOpen(false);
                setHoverTooltip(null);
              }}
              title={`${t('themeTooltip', locale)} (${activeTheme.name})`}
              data-ov-tooltip={`${t('themeTooltip', locale)} (${activeTheme.name})`}
              aria-label={t('theme', locale)}
            >
              <Palette size={14} />
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: activeTheme.colorDot }} />
            </button>
            {themeMenuOpen && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1 w-48 border rounded-lg shadow-xl py-1 z-50 max-h-80 overflow-y-auto"
              >
                {RENDER_THEMES.map(tItem => (
                  <button
                    key={tItem.id}
                    type="button"
                    onClick={() => {
                      onThemeChange(tItem.id);
                      setThemeMenuOpen(false);
                    }}
                    title={`${tItem.name} — ${tItem.description}`}
                    style={{
                      backgroundColor: tItem.id === theme ? 'var(--ov-surface-header)' : 'transparent',
                      color: tItem.id === theme ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition hover:opacity-90"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tItem.colorDot }} />
                    <span className="truncate flex-1">{tItem.name}</span>
                    {tItem.id === theme && <Check size={12} style={{ color: 'var(--ov-accent)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Font Size Dropdown (窄视口 <=660px 收纳至更多菜单) */}
          <div className="relative markdown-tool-collapse-md" ref={fontSizeMenuRef}>
            <button
              type="button"
              className="markdown-tool-button"
              onClick={() => {
                setFontSizeMenuOpen(prev => !prev);
                setThemeMenuOpen(false);
                setDensityMenuOpen(false);
                setMoreMenuOpen(false);
                setLangMenuOpen(false);
                setHoverTooltip(null);
              }}
              title={`${t('fontSizeTooltip', locale)}: ${fontSize}px`}
              data-ov-tooltip={`${t('fontSizeTooltip', locale)}: ${fontSize}px`}
              aria-label={t('fontSize', locale)}
            >
              <span className="font-mono text-xs font-bold">A</span>
              <span className="text-[10px] opacity-80">{fontSize}</span>
            </button>
            {fontSizeMenuOpen && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1 w-36 border rounded-lg shadow-xl py-1 z-50"
              >
                {[13, 14, 15, 16, 18].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      onFontSizeChange(size);
                      setFontSizeMenuOpen(false);
                    }}
                    title={`${t('fontSizeTooltip', locale)}: ${size}px`}
                    style={{
                      backgroundColor: fontSize === size ? 'var(--ov-surface-header)' : 'transparent',
                      color: fontSize === size ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition hover:opacity-90 font-medium"
                  >
                    <span>{size} px</span>
                    {fontSize === size && <Check size={12} style={{ color: 'var(--ov-accent)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Density dropdown (中窄容器 <=980px 收纳至更多菜单) */}
          <div className="relative markdown-tool-collapse-lg" ref={densityMenuRef}>
            <button
              type="button"
              className="markdown-tool-button"
              onClick={() => {
                setDensityMenuOpen(prev => !prev);
                setThemeMenuOpen(false);
                setFontSizeMenuOpen(false);
                setMoreMenuOpen(false);
                setLangMenuOpen(false);
                setHoverTooltip(null);
              }}
              title={`${t('densityTooltip', locale)} (${activeDensity.name})`}
              data-ov-tooltip={`${t('densityTooltip', locale)} (${activeDensity.name})`}
              aria-label={t('density', locale)}
            >
              <AlignJustify size={14} />
            </button>
            {densityMenuOpen && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1 w-52 border rounded-lg shadow-xl py-1 z-50"
              >
                {DENSITY_PRESETS.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onDensityChange(d.id);
                      setDensityMenuOpen(false);
                    }}
                    title={`${d.name} (${d.label}) — ${d.description}`}
                    style={{
                      backgroundColor: d.id === density ? 'var(--ov-surface-header)' : 'transparent',
                      color: d.id === density ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                    }}
                    className="w-full flex flex-col px-3 py-1.5 text-xs text-left transition hover:opacity-90"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-[10px] opacity-70 font-mono">({d.label})</span>
                    </div>
                    <span className="text-[10px] opacity-75 line-clamp-1 mt-0.5">{d.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content Width Toggle (中窄容器 <=980px 收纳至更多菜单) */}
          <button
            type="button"
            className="markdown-tool-button markdown-tool-collapse-lg"
            onClick={onCycleWidth}
            title={`${widthTitle} · ${t('widthTooltip', locale)}`}
            data-ov-tooltip={`${widthTitle} · ${t('widthTooltip', locale)}`}
            aria-label={t('widthTooltip', locale)}
          >
            <Columns size={13} className="opacity-80" />
            <span className="font-mono text-[10px] font-semibold tracking-tight">
              {contentWidth === 'standard'
                ? '880'
                : contentWidth === 'wide'
                ? '1180'
                : contentWidth === 'full'
                ? 'Max'
                : contentWidth === 'a4'
                ? 'A4'
                : '720'}
            </span>
          </button>
        </div>

        <span className="markdown-toolbar-divider markdown-group-collapse-lg" aria-hidden="true" />

        {/* 分组 2：视口缩放控制 (中窄容器 <=980px 收纳至更多菜单) */}
        <div
          className="markdown-toolbar-group markdown-group-collapse-lg"
          role="group"
          aria-label={isZh ? '页面缩放' : 'Zoom Controls'}
        >
          <button
            type="button"
            className="markdown-tool-button"
            onClick={() => onZoomChange(Math.max(0.6, Number((zoom - 0.1).toFixed(1))))}
            title={`${t('zoomOut', locale)} (Ctrl -)`}
            data-ov-tooltip={`${t('zoomOut', locale)} (Ctrl -)`}
            aria-label={t('zoomOut', locale)}
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            className="markdown-zoom-label cursor-pointer hover:text-[var(--ov-text)] transition"
            onClick={() => onZoomChange(1)}
            title={`${t('zoomReset', locale)} (${Math.round(zoom * 100)}%)`}
            data-ov-tooltip={`${t('zoomReset', locale)} (${Math.round(zoom * 100)}%)`}
            aria-label={t('zoomReset', locale)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="markdown-tool-button"
            onClick={() => onZoomChange(Math.min(1.6, Number((zoom + 0.1).toFixed(1))))}
            title={`${t('zoomIn', locale)} (Ctrl +)`}
            data-ov-tooltip={`${t('zoomIn', locale)} (Ctrl +)`}
            aria-label={t('zoomIn', locale)}
          >
            <Plus size={13} />
          </button>
          {Math.round(zoom * 100) !== 100 && (
            <button
              type="button"
              className="markdown-tool-button"
              onClick={() => onZoomChange(1)}
              title={t('zoomReset', locale)}
              data-ov-tooltip={t('zoomReset', locale)}
              aria-label={t('zoomReset', locale)}
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>

        <span className="markdown-toolbar-divider markdown-group-collapse-md" aria-hidden="true" />

        {/* 分组 3：沉浸阅读与视图辅助 (专注模式保留至中屏，其余 <=1240px 收纳进更多菜单) */}
        <div
          className="markdown-toolbar-group markdown-group-collapse-md"
          role="group"
          aria-label={isZh ? '沉浸阅读与辅助' : 'Reading & View Aids'}
        >
          {/* Focus Mode */}
          <button
            type="button"
            className={`markdown-tool-button markdown-tool-collapse-md ${focusMode ? 'is-active' : ''}`}
            onClick={onToggleFocusMode}
            title={t('focusModeTooltip', locale)}
            data-ov-tooltip={t('focusModeTooltip', locale)}
            aria-label={t('focusMode', locale)}
          >
            <Maximize2 size={13} />
          </button>

          {/* Presentation Mode */}
          {onTogglePresentationMode && (
            <button
              type="button"
              className={`markdown-tool-button markdown-tool-collapse-xl ${presentationMode ? 'is-active' : ''}`}
              onClick={onTogglePresentationMode}
              title={t('presentationModeTooltip', locale)}
              data-ov-tooltip={t('presentationModeTooltip', locale)}
              aria-label={t('presentationMode', locale)}
            >
              <Presentation size={13} />
            </button>
          )}

          {/* Auto Scroll */}
          <button
            type="button"
            className={`markdown-tool-button markdown-tool-collapse-xl ${autoScrollSpeed > 0 ? 'is-active' : ''}`}
            onClick={onToggleAutoScroll}
            title={
              autoScrollSpeed > 0
                ? `${t('autoScrollRunning', locale)} (${autoScrollSpeed}x)`
                : t('autoScrollTooltip', locale)
            }
            data-ov-tooltip={
              autoScrollSpeed > 0
                ? `${t('autoScrollRunning', locale)} (${autoScrollSpeed}x)`
                : t('autoScrollTooltip', locale)
            }
            aria-label={t('autoScroll', locale)}
          >
            {autoScrollSpeed > 0 ? (
              <span className="flex items-center gap-0.5 font-mono text-[10px] font-bold">
                <Pause size={12} />
                {autoScrollSpeed}x
              </span>
            ) : (
              <Play size={12} />
            )}
          </button>

          {/* 图表工具栏全局显隐总开关 (微型折叠胶囊 vs 全局常开) */}
          {onToggleDiagramToolbars && (
            <button
              type="button"
              id="btn-markdown-toggle-diagram-toolbars"
              className={`markdown-tool-button markdown-tool-collapse-xl ${showDiagramToolbars ? 'is-active' : ''}`}
              onClick={onToggleDiagramToolbars}
              title={
                showDiagramToolbars
                  ? t('toggleDiagramToolbarsOn', locale)
                  : t('toggleDiagramToolbarsOff', locale)
              }
              data-ov-tooltip={
                showDiagramToolbars
                  ? t('toggleDiagramToolbarsOn', locale)
                  : t('toggleDiagramToolbarsOff', locale)
              }
              aria-label={t('toggleDiagramToolbars', locale)}
            >
              <PanelTop size={14} className={showDiagramToolbars ? 'text-[var(--ov-accent)]' : ''} />
            </button>
          )}

          {/* Toggle OKF Concept Card */}
          {onToggleOkf && (
            <button
              type="button"
              className={`markdown-tool-button markdown-tool-collapse-xl ${enableOkf ? 'is-active' : ''}`}
              onClick={onToggleOkf}
              title={enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}
              data-ov-tooltip={enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}
              aria-label={enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}
            >
              <Sparkles size={13} />
            </button>
          )}
        </div>

        <span className="markdown-toolbar-divider" aria-hidden="true" />

        {/* 分组 4：文档动作与快捷操作 (复制、打印/PDF、原生编辑器、重载、语言、更多菜单、回到顶部) */}
        <div className="markdown-toolbar-group" role="group" aria-label={isZh ? '文档动作与更多' : 'Document Actions'}>
          {/* Copy markdown button */}
          <button
            type="button"
            className="markdown-tool-button markdown-tool-collapse-md"
            onClick={onCopyRawMarkdown}
            title={copied ? t('copied', locale) : t('copyMarkdown', locale)}
            data-ov-tooltip={copied ? t('copied', locale) : t('copyMarkdown', locale)}
            aria-label={t('copyMarkdown', locale)}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          {/* Export & Print */}
          <button
            type="button"
            className="markdown-tool-button markdown-tool-collapse-xl"
            onClick={() => (onPrint ? onPrint() : window.print())}
            title={t('printPdfA4Tooltip', locale)}
            data-ov-tooltip={t('printPdfA4Tooltip', locale)}
            aria-label={t('exportPdf', locale)}
          >
            <Printer size={14} />
          </button>

          {/* 在 VS Code 原生文本编辑器中并排打开 */}
          {onOpenInEditor && (
            <button
              type="button"
              id="btn-markdown-open-native-editor"
              className="markdown-tool-button text-[var(--ov-accent)] markdown-tool-collapse-xl"
              onClick={onOpenInEditor}
              title={t('openInNativeEditorHint', locale)}
              data-ov-tooltip={t('openInNativeEditorHint', locale)}
              aria-label={t('openInNativeEditor', locale)}
            >
              <ExternalLink size={14} />
            </button>
          )}

          {/* 从磁盘/编辑器重新加载预览 (Ctrl+R / Cmd+R) */}
          {onReloadDocument && (
            <button
              type="button"
              id="btn-markdown-reload-document"
              className={`markdown-tool-button markdown-tool-collapse-xl ${isReloading ? 'animate-spin text-[var(--ov-accent)]' : ''}`}
              onClick={onReloadDocument}
              title={`${t('reloadPreview', locale)} (Ctrl+R)`}
              data-ov-tooltip={`${t('reloadPreview', locale)} (Ctrl+R)`}
              aria-label={t('reloadPreview', locale)}
            >
              <RefreshCw size={13} className={isReloading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Language dropdown */}
          <div className="relative markdown-tool-collapse-xl" ref={langMenuRef}>
            <button
              type="button"
              className="markdown-tool-button"
              onClick={() => {
                setLangMenuOpen(prev => !prev);
                setThemeMenuOpen(false);
                setDensityMenuOpen(false);
                setFontSizeMenuOpen(false);
                setMoreMenuOpen(false);
                setHoverTooltip(null);
              }}
              title={t('languageTooltip', locale)}
              data-ov-tooltip={t('languageTooltip', locale)}
              aria-label={t('language', locale)}
            >
              <Languages size={14} />
              <span className="text-[10px] font-mono font-bold uppercase">{locale === 'zh-CN' ? 'ZH' : 'EN'}</span>
            </button>
            {langMenuOpen && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1 w-36 border rounded-lg shadow-xl py-1 z-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    onLocaleChange('zh-CN');
                    setLangMenuOpen(false);
                  }}
                  title="切换为简体中文"
                  style={{
                    backgroundColor: locale === 'zh-CN' ? 'var(--ov-surface-header)' : 'transparent',
                    color: locale === 'zh-CN' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition hover:opacity-90"
                >
                  <span>简体中文</span>
                  {locale === 'zh-CN' && <Check size={12} style={{ color: 'var(--ov-accent)' }} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLocaleChange('en-US');
                    setLangMenuOpen(false);
                  }}
                  title="Switch to English"
                  style={{
                    backgroundColor: locale === 'en-US' ? 'var(--ov-surface-header)' : 'transparent',
                    color: locale === 'en-US' ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition hover:opacity-90"
                >
                  <span>English</span>
                  {locale === 'en-US' && <Check size={12} style={{ color: 'var(--ov-accent)' }} />}
                </button>
              </div>
            )}
          </div>

          {/* More Actions Dropdown (在 <=1240px / ~1080px 下自动聚合被收纳的工具) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              className={`markdown-tool-button ${moreMenuOpen ? 'is-active' : ''}`}
              onClick={() => {
                setMoreMenuOpen(prev => !prev);
                setThemeMenuOpen(false);
                setDensityMenuOpen(false);
                setFontSizeMenuOpen(false);
                setLangMenuOpen(false);
                setHoverTooltip(null);
              }}
              title={t('moreActions', locale)}
              data-ov-tooltip={t('moreActions', locale)}
              aria-label={t('moreActions', locale)}
            >
              <MoreHorizontal size={15} />
            </button>
            {moreMenuOpen && (
              <div className="markdown-more-menu">
                {/* 窄/中屏 (<= 980px) 自适应收纳：快捷缩放与版面控制栏 */}
                {toolbarWidth <= 980 && (
                  <div
                    className="mb-1.5 pb-1.5 border-b border-[var(--ov-border)] space-y-1.5"
                    role="group"
                    aria-label={isZh ? '快捷排版与缩放' : 'Quick Layout & Zoom'}
                  >
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-[var(--ov-bg-elevated)]">
                      <span className="text-[11px] text-[var(--ov-text-muted)] font-medium">
                        {isZh ? '页面缩放' : 'Zoom'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="!w-auto !p-1 rounded hover:bg-[var(--ov-surface-hover)]"
                          onClick={() => onZoomChange(Math.max(0.6, Number((zoom - 0.1).toFixed(1))))}
                          title={t('zoomOut', locale)}
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          type="button"
                          className="!w-auto !px-1.5 !py-0.5 font-mono text-[11px] text-[var(--ov-text)] rounded hover:bg-[var(--ov-surface-hover)]"
                          onClick={() => onZoomChange(1)}
                          title={t('zoomReset', locale)}
                        >
                          {Math.round(zoom * 100)}%
                        </button>
                        <button
                          type="button"
                          className="!w-auto !p-1 rounded hover:bg-[var(--ov-surface-hover)]"
                          onClick={() => onZoomChange(Math.min(1.6, Number((zoom + 0.1).toFixed(1))))}
                          title={t('zoomIn', locale)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onCycleWidth}
                      title={`${widthTitle} · ${t('widthTooltip', locale)}`}
                    >
                      <Columns size={14} className="text-[var(--ov-accent)]" />
                      <span className="flex-1">{widthTitle}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const order: DensityMode[] = ['compact', 'standard', 'comfortable'];
                        const nextIdx = (order.indexOf(density) + 1) % order.length;
                        onDensityChange(order[nextIdx]);
                      }}
                      title={`${t('densityTooltip', locale)} (${activeDensity.name})`}
                    >
                      <AlignJustify size={14} className="text-[var(--ov-accent)]" />
                      <span className="flex-1">
                        {isZh ? `排版紧凑度: ${activeDensity.name}` : `Density: ${activeDensity.name}`}
                      </span>
                    </button>
                  </div>
                )}

                {/* 超窄视口 (<= 660px) 自适应收纳：字号、专注模式、复制全文 */}
                {toolbarWidth <= 660 && (
                  <div className="mb-1.5 pb-1.5 border-b border-[var(--ov-border)] space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        const sizes = [13, 14, 15, 16, 18];
                        const idx = sizes.indexOf(fontSize);
                        const next = sizes[(idx + 1) % sizes.length] || 15;
                        onFontSizeChange(next);
                      }}
                      title={`${t('fontSizeTooltip', locale)}: ${fontSize}px`}
                    >
                      <span className="font-mono text-xs font-bold text-[var(--ov-accent)] w-3.5 text-center">A</span>
                      <span>{isZh ? `字号大小: ${fontSize}px` : `Font Size: ${fontSize}px`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleFocusMode();
                        setMoreMenuOpen(false);
                      }}
                      title={t('focusModeTooltip', locale)}
                    >
                      <Maximize2 size={14} />
                      <span>{t('focusMode', locale)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCopyRawMarkdown();
                        setMoreMenuOpen(false);
                      }}
                      title={t('copyMarkdown', locale)}
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{t('copyMarkdown', locale)}</span>
                    </button>
                  </div>
                )}

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      setMoreMenuOpen(false);
                    }}
                    title={t('settingsTooltip', locale)}
                  >
                    <Settings size={14} className="text-[var(--ov-accent)]" />
                    <span>{t('settings', locale)}</span>
                  </button>
                )}
                {onOpenShortcuts && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenShortcuts();
                      setMoreMenuOpen(false);
                    }}
                    title={isZh ? '快捷键与交互指南 (Ctrl+?)' : 'Shortcuts & Guide (Ctrl+?)'}
                  >
                    <Keyboard size={14} className="text-[var(--ov-accent)]" />
                    <span>{isZh ? '快捷键指南' : 'Shortcuts Guide'}</span>
                  </button>
                )}
                {onTogglePresentationMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onTogglePresentationMode();
                      setMoreMenuOpen(false);
                    }}
                    title={t('presentationModeTooltip', locale)}
                  >
                    <Presentation size={14} />
                    <span>{presentationMode ? t('exitPresentation', locale) : t('presentationMode', locale)}</span>
                  </button>
                )}

                {/* <= 1240px (如 1080px 窗口) 收纳进更多菜单的辅助与文档操作 */}
                {toolbarWidth < 1240 && (
                  <>
                    <button
                      type="button"
                      onClick={onToggleAutoScroll}
                      title={t('autoScrollTooltip', locale)}
                    >
                      {autoScrollSpeed > 0 ? <Pause size={14} className="text-[var(--ov-accent)]" /> : <Play size={14} />}
                      <span>
                        {autoScrollSpeed > 0
                          ? `${t('autoScrollRunning', locale)} (${autoScrollSpeed}x)`
                          : t('autoScroll', locale)}
                      </span>
                    </button>
                    {onToggleDiagramToolbars && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleDiagramToolbars();
                          setMoreMenuOpen(false);
                        }}
                        title={
                          showDiagramToolbars
                            ? t('toggleDiagramToolbarsOn', locale)
                            : t('toggleDiagramToolbarsOff', locale)
                        }
                      >
                        <PanelTop size={14} className={showDiagramToolbars ? 'text-[var(--ov-accent)]' : ''} />
                        <span>{t('toggleDiagramToolbars', locale)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (onPrint) {
                          onPrint();
                        } else {
                          window.print();
                        }
                        setMoreMenuOpen(false);
                      }}
                      title={t('printPdfA4Tooltip', locale)}
                    >
                      <Printer size={14} />
                      <span>{t('exportPdf', locale)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLocaleChange(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
                        setMoreMenuOpen(false);
                      }}
                      title={t('languageTooltip', locale)}
                    >
                      <Languages size={14} />
                      <span>{locale === 'zh-CN' ? '语言: 简体中文 (切换 EN)' : 'Language: EN (Switch 中文)'}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={onCopyCurrentSection}
                  title={t('copyCurrentSection', locale)}
                >
                  {copiedSection ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{t('copyCurrentSection', locale)}</span>
                </button>
                <button
                  type="button"
                  onClick={onCopyRichText}
                  title={t('copyRichText', locale)}
                >
                  {copiedRich ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{t('copyRichText', locale)}</span>
                </button>
                <button
                  type="button"
                  onClick={onExportHtml}
                  title={t('exportHtml', locale)}
                >
                  <Download size={14} />
                  <span>{t('exportHtml', locale)}</span>
                </button>
                {onExportWord && (
                  <button
                    type="button"
                    onClick={onExportWord}
                    disabled={isExportingWord}
                    title={isExportingWord ? t('exportWordHint', locale) : t('exportWord', locale)}
                  >
                    {isExportingWord ? (
                      <RefreshCw size={14} className="animate-spin text-[var(--ov-accent)]" />
                    ) : (
                      <FileText size={14} className="text-[var(--ov-accent)]" />
                    )}
                    <span>{isExportingWord ? t('exportWordHint', locale) : t('exportWord', locale)}</span>
                  </button>
                )}
                {onToggleOkf && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleOkf();
                      setMoreMenuOpen(false);
                    }}
                    title={enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}
                  >
                    <Sparkles size={14} />
                    <span>{enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}</span>
                  </button>
                )}
                {onOpenInEditor && (
                  <button
                    type="button"
                    onClick={onOpenInEditor}
                    title={t('openInNativeEditorHint', locale)}
                  >
                    <ExternalLink size={14} />
                    <span>{t('openInEditor', locale)}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (onReloadDocument ? onReloadDocument() : window.location.reload())}
                  title={`${t('reloadPreview', locale)} (Ctrl+R)`}
                >
                  <RefreshCw size={14} />
                  <span>{t('reloadPreview', locale)}</span>
                </button>
                <div className="markdown-more-stat" title={isZh ? '当前文档统计信息' : 'Document statistics'}>
                  {fileCharCount.toLocaleString()} {t('characters', locale)} · {fileWordCount.toLocaleString()} {t('words', locale)} · {headingsCount} {t('chapters', locale)}
                </div>
              </div>
            )}
          </div>

          {/* Back to top */}
          <button
            type="button"
            className="markdown-tool-button"
            onClick={onScrollToTop}
            title={t('backToTop', locale)}
            data-ov-tooltip={t('backToTop', locale)}
            aria-label={t('backToTop', locale)}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>

      {/* 即时响应悬浮文字提示气泡 (Instant Floating Tooltip) */}
      {hoverTooltip && !isAnyMenuOpen && (
        <div
          className="markdown-instant-tooltip"
          style={{
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
            transform:
              hoverTooltip.align === 'left'
                ? 'translateX(0)'
                : hoverTooltip.align === 'right'
                ? 'translateX(-100%)'
                : 'translateX(-50%)',
          }}
          role="tooltip"
        >
          {hoverTooltip.text}
        </div>
      )}

      {/* Global Reading Progress Line */}
      <div
        className="markdown-reading-progress-bar"
        style={{ width: `${readingProgress}%` }}
      />
    </header>
  );
};
