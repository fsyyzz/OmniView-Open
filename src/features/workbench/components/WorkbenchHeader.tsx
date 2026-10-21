import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  WorkbenchView,
  ViewMode,
  FileItem,
  ThemeId,
  RENDER_THEMES,
  DensityMode,
  DENSITY_PRESETS,
} from '../../../shared/types';
import {
  BookOpen,
  Cpu,
  Terminal,
  Upload,
  Plus,
  Split,
  Eye,
  Code,
  Minus,
  RotateCcw,
  Palette,
  Copy,
  Check,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  ChevronDown,
  Sparkles,
  AlignJustify,
  Network,
  GitFork,
  FileText,
  Settings,
  Keyboard,
} from 'lucide-react';
import { getVsCodeApi } from '../../../shared/lib/vscode';
import { requestPrintHtml } from '../../../shared/lib/printBridge';

interface WorkbenchHeaderProps {
  currentView: WorkbenchView;
  onViewChange: (view: WorkbenchView) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onFileUpload: (file: File) => void;
  onNewFile: (name?: string, content?: string, ext?: string) => void;
  activeFile?: FileItem;
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  density: DensityMode;
  onDensityChange: (density: DensityMode) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  currentView,
  onViewChange,
  viewMode,
  onViewModeChange,
  onFileUpload,
  onNewFile,
  activeFile,
  currentTheme,
  onThemeChange,
  density,
  onDensityChange,
  zoom,
  onZoomChange,
  onOpenSettings,
  onOpenShortcuts,
}) => {
  const headerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [densityDropdownOpen, setDensityDropdownOpen] = useState(false);
  const [newFileDropdownOpen, setNewFileDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    align: 'left' | 'center' | 'right';
  } | null>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const densityDropdownRef = useRef<HTMLDivElement>(null);
  const newFileDropdownRef = useRef<HTMLDivElement>(null);

  const isAnyDropdownOpen = themeDropdownOpen || densityDropdownOpen || newFileDropdownOpen;

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false);
      }
      if (densityDropdownRef.current && !densityDropdownRef.current.contains(e.target as Node)) {
        setDensityDropdownOpen(false);
      }
      if (newFileDropdownRef.current && !newFileDropdownRef.current.contains(e.target as Node)) {
        setNewFileDropdownOpen(false);
      }
    };
    if (isAnyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAnyDropdownOpen]);

  const handleHeaderMouseOver = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isAnyDropdownOpen) {
        setHoverTooltip(null);
        return;
      }
      const target = (e.target as HTMLElement | null)?.closest('[data-ov-tooltip]') as HTMLElement | null;
      if (!target || !headerRef.current) {
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
    [isAnyDropdownOpen]
  );

  const handleHeaderMouseLeave = useCallback(() => {
    setHoverTooltip(null);
  }, []);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleCopy = async () => {
    if (!activeFile?.content) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleExport = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    // 工作台主要为浏览器宿主；若意外处于 Webview，则导出当前主内容给 Host 外置打印
    const api = getVsCodeApi();
    if (api) {
      const canvas =
        (document.querySelector('.markdown-document') as HTMLElement | null) ||
        (document.querySelector('[data-ov-print-root]') as HTMLElement | null) ||
        (document.querySelector('main') as HTMLElement | null);
      if (canvas) {
        const clone = canvas.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('button, .markdown-toolbar, #workbench-header').forEach((el) => el.remove());
        const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${
          activeFile?.name || 'OmniView'
        }</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a;background:#fff}img,svg{max-width:100%}</style></head><body>${
          clone.innerHTML
        }</body></html>`;
        requestPrintHtml(activeFile?.name || 'omniview-print', html, { vscode: api });
        return;
      }
    }
    window.print();
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored
    }
  };

  const activeThemeObj = RENDER_THEMES.find((t) => t.id === currentTheme) || RENDER_THEMES[0];
  const activeDensityObj = DENSITY_PRESETS.find((d) => d.id === density) || DENSITY_PRESETS[0];

  return (
    <header
      ref={headerRef}
      id="workbench-header"
      className="h-12 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center justify-between px-3 text-xs select-none shrink-0 z-30"
      onMouseOver={handleHeaderMouseOver}
      onMouseLeave={handleHeaderMouseLeave}
    >
      {/* Left: Branding & View Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center gap-2 font-bold text-slate-100 shrink-0"
          title="OmniView 多格式渲染与架构检视工作台"
          data-ov-tooltip="OmniView 多格式渲染与架构检视工作台"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black shadow-md shadow-blue-500/20">
            OV
          </div>
          <span className="hidden sm:inline font-mono tracking-tight font-extrabold text-slate-100">
            OmniView
          </span>
        </div>

        {/* View switcher tabs */}
        <nav
          style={{
            backgroundColor: 'var(--ov-bg-elevated)',
            borderColor: 'var(--ov-border)',
          }}
          className="flex items-center p-0.5 rounded-lg border shrink-0"
          aria-label="工作台主视图"
        >
          <button
            type="button"
            onClick={() => onViewChange('editor')}
            style={{
              backgroundColor: currentView === 'editor' ? 'var(--ov-accent)' : 'transparent',
              color: currentView === 'editor' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition font-medium hover:opacity-90"
            title="渲染工作台：多格式文档与交互式图表预览"
            data-ov-tooltip="渲染工作台：多格式文档与交互式图表预览"
            aria-label="渲染工作台"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">渲染工作台</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange('docs')}
            style={{
              backgroundColor: currentView === 'docs' ? 'var(--ov-accent)' : 'transparent',
              color: currentView === 'docs' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition font-medium hover:opacity-90"
            title="工程技术规范与架构设计文档中心"
            data-ov-tooltip="工程技术规范与架构设计文档中心"
            aria-label="工程技术规范"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">工程技术规范</span>
            <span className="xl:hidden">规范</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange('drivers')}
            style={{
              backgroundColor: currentView === 'drivers' ? 'var(--ov-accent)' : 'transparent',
              color: currentView === 'drivers' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition font-medium hover:opacity-90"
            title="驱动矩阵与生态对标"
            data-ov-tooltip="驱动矩阵与生态对标"
            aria-label="驱动矩阵"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>驱动矩阵</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange('scaffold')}
            style={{
              backgroundColor: currentView === 'scaffold' ? 'var(--ov-accent)' : 'transparent',
              color: currentView === 'scaffold' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition font-medium hover:opacity-90"
            title="VS Code 插件生产源码脚手架"
            data-ov-tooltip="VS Code 插件生产源码脚手架"
            aria-label="扩展脚手架"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>扩展脚手架</span>
          </button>
        </nav>
      </div>

      {/* Center: View Modes (when in editor view) & Zoom Controls */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        {currentView === 'editor' && (!activeFile || ['md', 'markdown', 'okf'].includes(activeFile.extension.toLowerCase())) && (
          <div
            style={{
              backgroundColor: 'var(--ov-bg-elevated)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center p-0.5 rounded-lg border shadow-inner"
            role="group"
            aria-label="文档渲染视图模式"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('preview')}
              style={{
                backgroundColor: viewMode === 'preview' ? 'var(--ov-accent)' : 'transparent',
                color: viewMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition font-medium select-none hover:opacity-90 cursor-pointer"
              title="预览模式：查看富文本与即时渲染图表"
              data-ov-tooltip="预览模式：查看富文本与即时渲染图表"
              aria-label="预览模式"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">预览</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('split')}
              style={{
                backgroundColor: viewMode === 'split' ? 'var(--ov-accent)' : 'transparent',
                color: viewMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition font-medium select-none hover:opacity-90 cursor-pointer"
              title="分屏模式：左侧源码编辑，右侧同步渲染"
              data-ov-tooltip="分屏模式：左侧源码编辑，右侧同步渲染"
              aria-label="分屏模式"
            >
              <Split className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">分屏</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('source')}
              style={{
                backgroundColor: viewMode === 'source' ? 'var(--ov-accent)' : 'transparent',
                color: viewMode === 'source' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition font-medium select-none hover:opacity-90 cursor-pointer"
              title="源码模式：查看与编辑原始文件"
              data-ov-tooltip="源码模式：查看与编辑原始文件"
              aria-label="源码模式"
            >
              <Code className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">源码</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('mindmap')}
              style={{
                backgroundColor: viewMode === 'mindmap' ? 'var(--ov-accent)' : 'transparent',
                color: viewMode === 'mindmap' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className="flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition font-medium select-none hover:opacity-90 cursor-pointer"
              title="思维导图模式：整篇文档大纲全景树图与动态交互 (Markmap)"
              data-ov-tooltip="思维导图模式：整篇文档大纲全景树图与动态交互 (Markmap)"
              aria-label="思维导图模式"
            >
              <Network className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">思维导图</span>
            </button>
          </div>
        )}

        {/* Zoom Control Group */}
        <div
          style={{
            backgroundColor: 'var(--ov-bg-elevated)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text-secondary)',
          }}
          className="hidden lg:flex items-center rounded-lg border px-1 py-0.5"
          role="group"
          aria-label="视口缩放控制"
        >
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(0.5, Number((zoom - 0.1).toFixed(1))))}
            className="p-1 rounded transition hover:opacity-80"
            title="缩小文档/画布 (Ctrl -)"
            data-ov-tooltip="缩小文档/画布 (Ctrl -)"
            aria-label="缩小"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(1.0)}
            style={{ color: 'var(--ov-text)' }}
            className="px-1.5 py-0.5 text-[11px] font-mono font-medium transition hover:opacity-80"
            title="点击重置缩放比例为 100%"
            data-ov-tooltip="点击重置缩放比例为 100%"
            aria-label="重置缩放比例"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(1.6, Number((zoom + 0.1).toFixed(1))))}
            className="p-1 rounded transition hover:opacity-80"
            title="放大文档/画布 (Ctrl +)"
            data-ov-tooltip="放大文档/画布 (Ctrl +)"
            aria-label="放大"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(1.0)}
            className="p-1 rounded transition hover:opacity-80 ml-0.5"
            title="还原原始缩放 (1:1)"
            data-ov-tooltip="还原原始缩放 (1:1)"
            aria-label="还原原始比例"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Right: Grouped Appearance, Document Actions, File IO & Preferences */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Group 1: 外观与排版 (主题 + 紧凑度) */}
        <div
          style={{
            backgroundColor: 'var(--ov-bg-elevated)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text-secondary)',
          }}
          className="flex items-center rounded-md border p-0.5 gap-0.5"
          role="group"
          aria-label="外观与排版"
        >
          {/* Theme Selector Dropdown */}
          <div className="relative" ref={themeDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setThemeDropdownOpen((prev) => !prev);
                setDensityDropdownOpen(false);
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded transition text-xs hover:bg-[var(--ov-surface-hover)]"
              title={`切换渲染色彩主题 (当前: ${activeThemeObj.name})`}
              data-ov-tooltip={`切换渲染色彩主题 (当前: ${activeThemeObj.name})`}
              aria-label="渲染色彩主题"
            >
              <Palette className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span
                className="w-2 h-2 rounded-full inline-block shadow-sm shrink-0"
                style={{ backgroundColor: activeThemeObj.colorDot }}
              />
              <span className="hidden 2xl:inline font-medium max-w-[64px] truncate">{activeThemeObj.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Theme Dropdown Menu */}
            {themeDropdownOpen && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1.5 w-64 border rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in-50 duration-150"
              >
                <div
                  style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
                  className="px-3 py-1 text-[11px] font-semibold border-b flex items-center justify-between"
                >
                  <span>可选渲染主题 ({RENDER_THEMES.length})</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <div className="py-1 max-h-80 overflow-y-auto">
                  {RENDER_THEMES.map((theme) => {
                    const isSelected = theme.id === currentTheme;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          onThemeChange(theme.id);
                          setThemeDropdownOpen(false);
                        }}
                        title={`${theme.name} — ${theme.description}`}
                        style={{
                          backgroundColor: isSelected ? 'var(--ov-surface-header)' : 'transparent',
                          color: isSelected ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs transition hover:opacity-90"
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 shadow-sm border border-slate-600/50"
                            style={{ backgroundColor: theme.colorDot }}
                          />
                          <div>
                            <div className="font-medium flex items-center gap-1.5">
                              <span>{theme.name}</span>
                              <span className="text-[10px] opacity-70">({theme.label})</span>
                            </div>
                            <p className="text-[11px] opacity-75 line-clamp-1">{theme.description}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Density Selector Dropdown */}
          <div className="relative" ref={densityDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setDensityDropdownOpen((prev) => !prev);
                setThemeDropdownOpen(false);
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded transition text-xs hover:bg-[var(--ov-surface-hover)]"
              title={`切换文档与图表紧凑排版密度 (当前: ${activeDensityObj.name})`}
              data-ov-tooltip={`切换文档与图表紧凑排版密度 (当前: ${activeDensityObj.name})`}
              aria-label="排版紧凑度"
            >
              <AlignJustify className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden 2xl:inline font-medium">{activeDensityObj.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Density Dropdown Menu */}
            {densityDropdownOpen && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1.5 w-60 border rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in-50 duration-150"
              >
                <div
                  style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
                  className="px-3 py-1 text-[11px] font-semibold border-b flex items-center justify-between"
                >
                  <span>排版紧凑度 (3)</span>
                  <span className="text-[10px] text-cyan-400 font-mono">DENSITY</span>
                </div>
                <div className="py-1">
                  {DENSITY_PRESETS.map((preset) => {
                    const isSelected = preset.id === density;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onDensityChange(preset.id);
                          setDensityDropdownOpen(false);
                        }}
                        title={`${preset.name} (${preset.label}) — ${preset.description}`}
                        style={{
                          backgroundColor: isSelected ? 'var(--ov-surface-header)' : 'transparent',
                          color: isSelected ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs transition hover:opacity-90"
                      >
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            <span>{preset.name}</span>
                            <span className="text-[10px] opacity-70 font-mono">({preset.label})</span>
                          </div>
                          <p className="text-[11px] opacity-75 line-clamp-2 mt-0.5">{preset.description}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Group 2: 文档快捷操作 (复制、导出、打印、全屏) */}
        <div
          style={{
            backgroundColor: 'var(--ov-bg-elevated)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text-secondary)',
          }}
          className="flex items-center rounded-md border p-0.5 gap-0.5"
          role="group"
          aria-label="文档快捷动作"
        >
          {/* Copy Document Content */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!activeFile}
            className={`flex items-center p-1 sm:p-1.5 rounded transition text-xs ${
              copied
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                : 'hover:bg-[var(--ov-surface-hover)]'
            }`}
            title={copied ? '已复制到剪贴板' : '一键复制当前文档完整源码内容'}
            data-ov-tooltip={copied ? '已复制到剪贴板' : '一键复制当前文档完整源码内容'}
            aria-label="复制源码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export File */}
          <button
            type="button"
            onClick={handleExport}
            disabled={!activeFile}
            className="p-1 sm:p-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
            title="导出/下载当前文件到本地"
            data-ov-tooltip="导出/下载当前文件到本地"
            aria-label="导出文件"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Print / Export PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-1 sm:p-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
            title="打印或另存为 PDF"
            data-ov-tooltip="打印或另存为 PDF"
            aria-label="打印或导出 PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Preview Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1 sm:p-1.5 rounded transition hover:bg-[var(--ov-surface-hover)]"
            title={isFullscreen ? '退出全屏模式 (Esc)' : '全屏沉浸式预览'}
            data-ov-tooltip={isFullscreen ? '退出全屏模式 (Esc)' : '全屏沉浸式预览'}
            aria-label="全屏预览"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Group 3: 文件导入与新建 */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept=".md,.markdown,.puml,.plantuml,.mmd,.mermaid,.dot,.gv,.svg,.pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.xlsm,.xltx,.epub,.csv,.tsv,.json,.yaml,.yml,.xml,.ts,.tsx,.js,.jsx,.txt,.mm,.markmap,.mindmap,.km,.typ,.typst,.excalidraw,.ipynb"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: 'var(--ov-bg-elevated)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md border transition shadow-sm text-xs hover:opacity-90"
          title="导入本地文件进行预览与编辑"
          data-ov-tooltip="导入本地文件进行预览与编辑"
          aria-label="打开本地文件"
        >
          <Upload className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="hidden xl:inline">导入</span>
        </button>

        {/* 新建文件复合按钮与下拉菜单 */}
        <div ref={newFileDropdownRef} className="relative flex items-center">
          <button
            type="button"
            onClick={() => onNewFile()}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-l-md shadow-sm shadow-blue-600/30 transition text-xs"
            title="新建 Markdown 文档 (.md)"
            data-ov-tooltip="新建 Markdown 文档 (.md)"
            aria-label="新建文件"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">新建</span>
          </button>
          <button
            type="button"
            onClick={() => setNewFileDropdownOpen(!newFileDropdownOpen)}
            className="p-1 bg-blue-700 hover:bg-blue-600 text-white rounded-r-md border-l border-blue-500/50 shadow-sm transition"
            title="选择要新建的文件类型 (Markdown / 思维导图 / PlantUML)"
            data-ov-tooltip="选择要新建的文件类型 (Markdown / 思维导图 / PlantUML)"
            aria-label="更多新建类型"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {newFileDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs select-none">
              <button
                type="button"
                onClick={() => {
                  onNewFile(undefined, undefined, 'md');
                  setNewFileDropdownOpen(false);
                }}
                title="新建 Markdown 文档 (.md)"
                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <div>
                  <div className="font-medium">新建 Markdown 文档</div>
                  <div className="text-[10px] text-slate-400 font-mono">.md · 文档与混合图表</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNewFile(undefined, undefined, 'markmap');
                  setNewFileDropdownOpen(false);
                }}
                title="新建思维导图 (.markmap)"
                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
              >
                <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                <div>
                  <div className="font-medium text-cyan-200">新建思维导图</div>
                  <div className="text-[10px] text-cyan-400/80 font-mono">.markmap · 交互式矢量导图</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNewFile(undefined, undefined, 'puml');
                  setNewFileDropdownOpen(false);
                }}
                title="新建 PlantUML 架构图 (.puml)"
                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
              >
                <Network className="w-3.5 h-3.5 text-purple-400" />
                <div>
                  <div className="font-medium">新建 PlantUML 架构图</div>
                  <div className="text-[10px] text-slate-400 font-mono">.puml · 时序与系统设计</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Group 4: 全局设置与快捷键帮助 */}
        {(onOpenSettings || onOpenShortcuts) && (
          <div
            style={{
              backgroundColor: 'var(--ov-bg-elevated)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="flex items-center rounded-md border p-0.5 gap-0.5"
            role="group"
            aria-label="系统设置与帮助"
          >
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1 sm:p-1.5 rounded transition hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text)]"
                title="打开工作台全局偏好与持久化配置中心"
                data-ov-tooltip="打开工作台全局偏好与持久化配置中心"
                aria-label="工作台偏好设置"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="p-1 sm:p-1.5 rounded transition hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text)]"
                title="快捷键与交互指南 (Ctrl+?)"
                data-ov-tooltip="快捷键与交互指南 (Ctrl+?)"
                aria-label="快捷键帮助"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 即时响应悬浮文字提示气泡 */}
      {hoverTooltip && !isAnyDropdownOpen && (
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
    </header>
  );
};
