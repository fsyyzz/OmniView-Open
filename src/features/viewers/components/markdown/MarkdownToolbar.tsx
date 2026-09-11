/**
 * Markdown 阅读控制顶部工具栏组件 (极简纯图标 + 悬浮文字提示 + 多语言国际化)
 */
import React, { useRef, useState, useEffect } from 'react';
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
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  fileName,
  filePath,
  headingsCount,
  currentHeading,
  readingProgress,
  outlineOpen,
  onToggleOutline,
  searchText,
  onSearchTextChange,
  onFindText,
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
  isMindmap = false,
  onToggleMindmap,
  viewMode = 'preview',
  onViewModeChange,
  enableOkf = true,
  onToggleOkf,
}) => {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [densityMenuOpen, setDensityMenuOpen] = useState(false);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const themeMenuRef = useRef<HTMLDivElement>(null);
  const densityMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) setThemeMenuOpen(false);
      if (densityMenuRef.current && !densityMenuRef.current.contains(e.target as Node)) setDensityMenuOpen(false);
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(e.target as Node)) setFontSizeMenuOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    if (themeMenuOpen || densityMenuOpen || fontSizeMenuOpen || moreMenuOpen || langMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeMenuOpen, densityMenuOpen, fontSizeMenuOpen, moreMenuOpen, langMenuOpen]);

  const activeTheme = RENDER_THEMES.find(tItem => tItem.id === theme) || RENDER_THEMES[0];
  const activeDensity = DENSITY_PRESETS.find(d => d.id === density) || DENSITY_PRESETS[0];

  const widthTitle = {
    narrow: `${t('width', locale)}: ${t('widthNarrow', locale)}`,
    standard: `${t('width', locale)}: ${t('widthStandard', locale)}`,
    wide: `${t('width', locale)}: ${t('widthWide', locale)}`,
    full: `${t('width', locale)}: ${t('widthFull', locale)}`,
    a4: `${t('width', locale)}: ${t('widthA4', locale)}`,
  }[contentWidth];

  return (
    <header
      className={`markdown-toolbar ${isVisible || !focusMode ? 'is-visible' : ''}`}
      onMouseEnter={onMouseEnter}
    >
      {/* Left: Outline, Search & Title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          className={`markdown-tool-button ${outlineOpen ? 'bg-slate-800 text-cyan-400 font-semibold' : ''}`}
          onClick={onToggleOutline}
          title={t('outlineTooltip', locale)}
          aria-label={t('outline', locale)}
        >
          <List size={14} />
        </button>

        <div className="markdown-search-box">
          <Search size={14} />
          <input
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
              }
            }}
            placeholder={t('searchPlaceholder', locale)}
            aria-label={t('searchPlaceholder', locale)}
          />
          <button type="button" onClick={() => onFindText(true)} title={t('prevMatch', locale)}>↑</button>
          <button type="button" onClick={() => onFindText(false)} title={t('nextMatch', locale)}>↓</button>
        </div>

        <div className="markdown-toolbar-title hidden lg:flex items-center gap-1.5" title={filePath}>
          <span className="font-semibold text-slate-200 truncate max-w-[180px]">{fileName}</span>
          <span className="text-[11px] opacity-60 font-mono">({headingsCount} {t('sectionsCount', locale)})</span>
        </div>
      </div>

      {/* Center: View Mode Switcher (Preview / Split / Source / Mindmap) */}
      <div className="flex items-center bg-slate-900/90 border border-slate-750/80 rounded-lg p-0.5 shadow-inner gap-0.5">
        <button
          type="button"
          onClick={() => onViewModeChange?.('preview')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition select-none ${
            viewMode === 'preview'
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title={t('viewModePreviewTooltip', locale)}
          aria-label={t('viewModePreview', locale)}
        >
          <Eye size={13} className={viewMode === 'preview' ? 'text-white' : 'text-slate-400'} />
          <span className="text-[11px] font-medium">{t('viewModePreview', locale)}</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange?.('split')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition select-none ${
            viewMode === 'split'
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title={t('viewModeSplitTooltip', locale)}
          aria-label={t('viewModeSplit', locale)}
        >
          <Split size={13} className={viewMode === 'split' ? 'text-white' : 'text-slate-400'} />
          <span className="text-[11px] font-medium">{t('viewModeSplit', locale)}</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange?.('source')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition select-none ${
            viewMode === 'source'
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title={t('viewModeSourceTooltip', locale)}
          aria-label={t('viewModeSource', locale)}
        >
          <Code size={13} className={viewMode === 'source' ? 'text-white' : 'text-slate-400'} />
          <span className="text-[11px] font-medium">{t('viewModeSource', locale)}</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange?.('mindmap')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition select-none ${
            viewMode === 'mindmap'
              ? 'bg-indigo-600 text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60'
          }`}
          title={t('viewModeMindmapTooltip', locale)}
          aria-label={t('viewModeMindmap', locale)}
        >
          <Network size={13} className={viewMode === 'mindmap' ? 'text-white' : 'text-indigo-400'} />
          <span className="text-[11px] font-medium">{t('viewModeMindmap', locale)}</span>
        </button>
      </div>

      {/* Right: Pure-Icon Reading Controls & Actions with Tooltips */}
      <div className="markdown-toolbar-actions">
        {/* Language dropdown */}
        <div className="relative" ref={langMenuRef}>
          <button
            className="markdown-tool-button"
            onClick={() => {
              setLangMenuOpen(prev => !prev);
              setThemeMenuOpen(false);
              setDensityMenuOpen(false);
              setFontSizeMenuOpen(false);
              setMoreMenuOpen(false);
            }}
            title={t('languageTooltip', locale)}
            aria-label={t('language', locale)}
          >
            <Languages size={14} />
            <span className="text-[10px] font-mono font-bold uppercase">{locale === 'zh-CN' ? 'ZH' : 'EN'}</span>
          </button>
          {langMenuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={() => {
                  onLocaleChange('zh-CN');
                  setLangMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
                  locale === 'zh-CN' ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>简体中文</span>
                {locale === 'zh-CN' && <Check size={12} className="text-blue-400" />}
              </button>
              <button
                onClick={() => {
                  onLocaleChange('en-US');
                  setLangMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
                  locale === 'en-US' ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>English</span>
                {locale === 'en-US' && <Check size={12} className="text-blue-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Theme dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            className="markdown-tool-button"
            onClick={() => {
              setThemeMenuOpen(prev => !prev);
              setDensityMenuOpen(false);
              setFontSizeMenuOpen(false);
              setMoreMenuOpen(false);
              setLangMenuOpen(false);
            }}
            title={`${t('themeTooltip', locale)} (${activeTheme.name})`}
            aria-label={t('theme', locale)}
          >
            <Palette size={14} />
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: activeTheme.colorDot }} />
          </button>
          {themeMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
              {RENDER_THEMES.map(tItem => (
                <button
                  key={tItem.id}
                  onClick={() => {
                    onThemeChange(tItem.id);
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                    tItem.id === theme ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tItem.colorDot }} />
                  <span>{tItem.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Dropdown */}
        <div className="relative" ref={fontSizeMenuRef}>
          <button
            className="markdown-tool-button"
            onClick={() => {
              setFontSizeMenuOpen(prev => !prev);
              setThemeMenuOpen(false);
              setDensityMenuOpen(false);
              setMoreMenuOpen(false);
              setLangMenuOpen(false);
            }}
            title={`${t('fontSizeTooltip', locale)}: ${fontSize}px`}
            aria-label={t('fontSize', locale)}
          >
            <span className="font-mono text-xs font-bold">A</span>
            <span className="text-[10px] opacity-80">{fontSize}</span>
          </button>
          {fontSizeMenuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
              {[13, 14, 15, 16, 18].map(size => (
                <button
                  key={size}
                  onClick={() => {
                    onFontSizeChange(size);
                    setFontSizeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
                    fontSize === size ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{size} px</span>
                  {fontSize === size && <Check size={12} className="text-blue-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Density dropdown */}
        <div className="relative" ref={densityMenuRef}>
          <button
            className="markdown-tool-button"
            onClick={() => {
              setDensityMenuOpen(prev => !prev);
              setThemeMenuOpen(false);
              setFontSizeMenuOpen(false);
              setMoreMenuOpen(false);
              setLangMenuOpen(false);
            }}
            title={`${t('densityTooltip', locale)} (${activeDensity.name})`}
            aria-label={t('density', locale)}
          >
            <AlignJustify size={14} />
          </button>
          {densityMenuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
              {DENSITY_PRESETS.map(d => (
                <button
                  key={d.id}
                  onClick={() => {
                    onDensityChange(d.id);
                    setDensityMenuOpen(false);
                  }}
                  className={`w-full flex flex-col px-3 py-1.5 text-xs text-left ${
                    d.id === density ? 'bg-cyan-600/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({d.label})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{d.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Width Toggle */}
        <button
          className="markdown-tool-button"
          onClick={onCycleWidth}
          title={widthTitle}
          aria-label={t('widthTooltip', locale)}
        >
          <span className="font-mono text-[11px] font-semibold tracking-tight">
            {contentWidth === 'standard'
              ? '880px'
              : contentWidth === 'wide'
              ? '1180px'
              : contentWidth === 'full'
              ? 'Fluid'
              : contentWidth === 'a4'
              ? 'A4'
              : '720px'}
          </span>
        </button>

        {/* Focus Mode */}
        <button
          className={`markdown-tool-button ${focusMode ? 'bg-amber-600/20 text-amber-300 border-amber-600/40' : ''}`}
          onClick={onToggleFocusMode}
          title={t('focusModeTooltip', locale)}
          aria-label={t('focusMode', locale)}
        >
          <Maximize2 size={13} className={focusMode ? 'text-amber-400' : ''} />
        </button>

        {/* Auto Scroll */}
        <button
          className={`markdown-tool-button ${autoScrollSpeed > 0 ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40' : ''}`}
          onClick={onToggleAutoScroll}
          title={
            autoScrollSpeed > 0
              ? `${t('autoScrollRunning', locale)} (${autoScrollSpeed}x)`
              : t('autoScrollTooltip', locale)
          }
          aria-label={t('autoScroll', locale)}
        >
          {autoScrollSpeed > 0 ? (
            <span className="flex items-center gap-0.5 font-mono text-[10px] text-emerald-400 font-bold">
              <Pause size={12} />
              {autoScrollSpeed}x
            </span>
          ) : (
            <Play size={12} />
          )}
        </button>

        {/* Zoom controls */}
        <button
          className="markdown-tool-button"
          onClick={() => onZoomChange(Math.max(0.6, Number((zoom - 0.1).toFixed(1))))}
          title={t('zoomOut', locale)}
          aria-label={t('zoomOut', locale)}
        >
          <Minus size={14} />
        </button>
        <span className="markdown-zoom-label" title={t('zoomReset', locale)}>{Math.round(zoom * 100)}%</span>
        <button
          className="markdown-tool-button"
          onClick={() => onZoomChange(Math.min(1.6, Number((zoom + 0.1).toFixed(1))))}
          title={t('zoomIn', locale)}
          aria-label={t('zoomIn', locale)}
        >
          <Plus size={14} />
        </button>
        <button
          className="markdown-tool-button"
          onClick={() => onZoomChange(1)}
          title={t('zoomReset', locale)}
          aria-label={t('zoomReset', locale)}
        >
          <RotateCcw size={13} />
        </button>

        {/* Copy markdown button */}
        <button
          className="markdown-tool-button"
          onClick={onCopyRawMarkdown}
          title={t('copyMarkdown', locale)}
          aria-label={t('copyMarkdown', locale)}
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>

        {/* Export & Print */}
        <button
          className="markdown-tool-button"
          onClick={() => (onPrint ? onPrint() : window.print())}
          title={t('printPdfA4Tooltip', locale)}
          aria-label={t('exportPdf', locale)}
        >
          <Printer size={14} />
        </button>

        {/* Toggle OKF Concept Card */}
        {onToggleOkf && (
          <button
            className={`markdown-tool-button ${enableOkf ? 'is-active text-amber-400' : 'text-slate-400'}`}
            onClick={onToggleOkf}
            title={enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}
            aria-label={enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}
          >
            <Sparkles size={14} />
          </button>
        )}

        {/* More Actions Dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <button
            className="markdown-tool-button"
            onClick={() => {
              setMoreMenuOpen(prev => !prev);
              setThemeMenuOpen(false);
              setDensityMenuOpen(false);
              setFontSizeMenuOpen(false);
              setLangMenuOpen(false);
            }}
            title={t('moreActions', locale)}
            aria-label={t('moreActions', locale)}
          >
            <MoreHorizontal size={15} />
          </button>
          {moreMenuOpen && (
            <div className="markdown-more-menu">
              <button onClick={onCopyCurrentSection}>
                {copiedSection ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{t('copyCurrentSection', locale)}</span>
              </button>
              <button onClick={onCopyRichText}>
                {copiedRich ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{t('copyRichText', locale)}</span>
              </button>
              <button onClick={onExportHtml}>
                <Download size={14} />
                <span>{t('exportHtml', locale)}</span>
              </button>
              {onExportWord && (
                <button onClick={onExportWord} disabled={isExportingWord}>
                  {isExportingWord ? <RefreshCw size={14} className="animate-spin text-cyan-400" /> : <FileText size={14} className="text-blue-400" />}
                  <span>{isExportingWord ? t('exportWordHint', locale) : t('exportWord', locale)}</span>
                </button>
              )}
              {onToggleOkf && (
                <button onClick={() => { onToggleOkf(); setMoreMenuOpen(false); }}>
                  <Sparkles size={14} className={enableOkf ? 'text-amber-400' : 'text-slate-400'} />
                  <span>{enableOkf ? t('disableOkf', locale) : t('enableOkf', locale)}</span>
                </button>
              )}
              {onOpenInEditor && (
                <button onClick={onOpenInEditor}>
                  <ExternalLink size={14} />
                  <span>{t('openInEditor', locale)}</span>
                </button>
              )}
              <button onClick={() => window.location.reload()}>
                <RefreshCw size={14} />
                <span>{t('reloadPreview', locale)}</span>
              </button>
              <div className="markdown-more-stat">
                {fileCharCount.toLocaleString()} {t('characters', locale)} · {fileWordCount.toLocaleString()} {t('words', locale)} · {headingsCount} {t('chapters', locale)}
              </div>
            </div>
          )}
        </div>

        {/* Back to top */}
        <button
          className="markdown-tool-button"
          onClick={onScrollToTop}
          title={t('backToTop', locale)}
          aria-label={t('backToTop', locale)}
        >
          <ArrowUp size={14} />
        </button>
      </div>

      {/* Global Reading Progress Line */}
      <div
        className="markdown-reading-progress-bar"
        style={{ width: `${readingProgress}%` }}
      />
    </header>
  );
};
