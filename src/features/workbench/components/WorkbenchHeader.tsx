import React, { useRef, useState, useEffect } from 'react';
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [densityDropdownOpen, setDensityDropdownOpen] = useState(false);
  const [newFileDropdownOpen, setNewFileDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const densityDropdownRef = useRef<HTMLDivElement>(null);
  const newFileDropdownRef = useRef<HTMLDivElement>(null);

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
    if (themeDropdownOpen || densityDropdownOpen || newFileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [themeDropdownOpen, densityDropdownOpen, newFileDropdownOpen]);

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

  const getFormatBadge = (ext?: string) => {
    const raw = (ext || 'txt').toUpperCase();
    let colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
    if (['MD', 'MARKDOWN'].includes(raw)) colorClass = 'bg-blue-900/40 text-blue-300 border-blue-700/60';
    else if (['PUML', 'PLANTUML', 'IUML'].includes(raw)) colorClass = 'bg-purple-900/40 text-purple-300 border-purple-700/60';
    else if (raw === 'SVG') colorClass = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60';
    else if (raw === 'PDF') colorClass = 'bg-rose-900/40 text-rose-300 border-rose-700/60';
    else if (['CSV', 'TSV'].includes(raw)) colorClass = 'bg-amber-900/40 text-amber-300 border-amber-700/60';
    else if (['YAML', 'YML'].includes(raw)) colorClass = 'bg-orange-900/40 text-orange-300 border-orange-700/60';
    else if (raw === 'JSON') colorClass = 'bg-yellow-900/40 text-yellow-300 border-yellow-700/60';
    else if (['TS', 'TSX', 'JS', 'JSX'].includes(raw)) colorClass = 'bg-cyan-900/40 text-cyan-300 border-cyan-700/60';
    return (
      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border font-semibold tracking-wider ${colorClass}`}>
        {raw}
      </span>
    );
  };

  const activeThemeObj = RENDER_THEMES.find((t) => t.id === currentTheme) || RENDER_THEMES[0];
  const activeDensityObj = DENSITY_PRESETS.find((d) => d.id === density) || DENSITY_PRESETS[0];

  return (
    <header id="workbench-header" className="h-12 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center justify-between px-3 text-xs select-none shrink-0 z-30">
      {/* Left: Branding, Active File & View Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 font-bold text-slate-100 shrink-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black shadow-md shadow-blue-500/20">
            OV
          </div>
          <span className="hidden sm:inline font-mono tracking-tight font-extrabold text-slate-100">
            OmniView
          </span>
        </div>

        {/* Active File Pill */}
        {activeFile && (
          <div className="hidden md:flex items-center gap-2 px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700/70 max-w-[240px] lg:max-w-xs truncate" title={activeFile.path}>
            {getFormatBadge(activeFile.extension)}
            <span className="text-slate-200 font-medium truncate">{activeFile.name}</span>
            {activeFile.isModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" title="已修改" />}
          </div>
        )}

        {/* View switcher tabs */}
        <nav className="flex items-center bg-slate-800/70 p-0.5 rounded-lg border border-slate-750 shrink-0" aria-label="工作台主视图">
          <button
            onClick={() => onViewChange('editor')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
              currentView === 'editor' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="渲染工作台"
            aria-label="渲染工作台"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">渲染工作台</span>
          </button>
          <button
            onClick={() => onViewChange('docs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
              currentView === 'docs' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">工程技术规范</span>
            <span className="xl:hidden">规范</span>
          </button>
          <button
            onClick={() => onViewChange('drivers')}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
              currentView === 'drivers' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="驱动矩阵与生态对标"
            aria-label="驱动矩阵"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>驱动矩阵</span>
          </button>
          <button
            onClick={() => onViewChange('scaffold')}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
              currentView === 'scaffold' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="VS Code 插件生产源码脚手架"
            aria-label="扩展脚手架"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>扩展脚手架</span>
          </button>
        </nav>
      </div>

      {/* Center: View Modes (when in editor view) & Zoom Controls */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        {currentView === 'editor' && (
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80">
            <button
              onClick={() => onViewModeChange('preview')}
              className={`flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition ${
                viewMode === 'preview' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="预览模式：查看富文本与即时渲染图表"
              aria-label="预览模式"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">预览</span>
            </button>
            <button
              onClick={() => onViewModeChange('split')}
              className={`flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition ${
                viewMode === 'split' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="分屏模式：左侧源码编辑，右侧同步渲染"
              aria-label="分屏模式"
            >
              <Split className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">分屏</span>
            </button>
            <button
              onClick={() => onViewModeChange('source')}
              className={`flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition ${
                viewMode === 'source' ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="源码模式：查看与编辑原始文件"
              aria-label="源码模式"
            >
              <Code className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">源码</span>
            </button>
            {activeFile && ['md', 'markdown'].includes(activeFile.extension.toLowerCase()) && (
              <button
                onClick={() => onViewModeChange('mindmap')}
                className={`flex items-center gap-1 px-2 py-1 xl:px-2.5 rounded text-xs transition ${
                  viewMode === 'mindmap' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="思维导图模式：整篇文档大纲全景树图与动态交互 (Markmap)"
                aria-label="思维导图模式"
              >
                <Network className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                <span className="hidden xl:inline">思维导图</span>
              </button>
            )}
          </div>
        )}

        {/* Zoom Control Group */}
        <div className="hidden lg:flex items-center bg-slate-800/80 rounded-lg border border-slate-700/80 px-1 py-0.5">
          <button
            onClick={() => onZoomChange(Math.max(0.5, Number((zoom - 0.1).toFixed(1))))}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition"
            title="缩小文档/画布 (Ctrl -)"
            aria-label="缩小"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-300 hover:text-blue-400 transition"
            title="点击重置缩放比例为 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(1.6, Number((zoom + 0.1).toFixed(1))))}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition"
            title="放大文档/画布 (Ctrl +)"
            aria-label="放大"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition ml-0.5"
            title="还原原始缩放 (1:1)"
            aria-label="还原原始比例"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Right: Theme Selector, Quick Tools & File Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Theme Selector Dropdown */}
        <div className="relative" ref={themeDropdownRef}>
          <button
            onClick={() => {
              setThemeDropdownOpen((prev) => !prev);
              setDensityDropdownOpen(false);
            }}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-md border border-slate-700 transition shadow-sm text-xs"
            title="切换渲染色彩主题"
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
            <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in-50 duration-150">
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                <span>可选渲染主题 ({RENDER_THEMES.length})</span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </div>
              <div className="py-1">
                {RENDER_THEMES.map((theme) => {
                  const isSelected = theme.id === currentTheme;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => {
                        onThemeChange(theme.id);
                        setThemeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition ${
                        isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 shadow-sm border border-slate-600/50"
                          style={{ backgroundColor: theme.colorDot }}
                        />
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            <span>{theme.name}</span>
                            <span className="text-[10px] text-slate-400">({theme.label})</span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{theme.description}</p>
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
            onClick={() => {
              setDensityDropdownOpen((prev) => !prev);
              setThemeDropdownOpen(false);
            }}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-md border border-slate-700 transition shadow-sm text-xs"
            title="切换文档与图表紧凑排版密度"
            aria-label="排版紧凑度"
          >
            <AlignJustify className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden 2xl:inline font-medium">{activeDensityObj.name}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {/* Density Dropdown Menu */}
          {densityDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in-50 duration-150">
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                <span>排版紧凑度 (3)</span>
                <span className="text-[10px] text-cyan-400 font-mono">DENSITY</span>
              </div>
              <div className="py-1">
                {DENSITY_PRESETS.map((preset) => {
                  const isSelected = preset.id === density;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onDensityChange(preset.id);
                        setDensityDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition ${
                        isSelected ? 'bg-cyan-600/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          <span>{preset.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({preset.label})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{preset.description}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Buttons Group */}
        <div className="flex items-center bg-slate-800/80 rounded-md border border-slate-700 p-0.5 gap-0.5">
          {/* Copy Document Content */}
          <button
            onClick={handleCopy}
            disabled={!activeFile}
            className={`flex items-center p-1 sm:p-1.5 rounded transition text-xs ${
              copied
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title="一键复制当前文档完整源码内容"
            aria-label="复制源码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export File */}
          <button
            onClick={handleExport}
            disabled={!activeFile}
            className="p-1 sm:p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="导出/下载当前文件到本地"
            aria-label="导出文件"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Print / Export PDF */}
          <button
            onClick={handlePrint}
            className="p-1 sm:p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="打印或另存为 PDF"
            aria-label="打印或导出 PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Preview Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1 sm:p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title={isFullscreen ? '退出全屏' : '全屏沉浸式预览'}
            aria-label="全屏预览"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* File Input & New File */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept=".md,.markdown,.puml,.plantuml,.mmd,.mermaid,.dot,.gv,.svg,.pdf,.csv,.tsv,.json,.yaml,.yml,.xml,.ts,.tsx,.js,.jsx,.txt,.mm,.markmap,.mindmap,.km"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition shadow-sm text-xs"
          title="导入本地文件测试渲染"
          aria-label="打开本地文件"
        >
          <Upload className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="hidden xl:inline">导入</span>
        </button>

        {/* 新建文件复合按钮与下拉菜单 */}
        <div ref={newFileDropdownRef} className="relative flex items-center">
          <button
            onClick={() => onNewFile()}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-l-md shadow-sm shadow-blue-600/30 transition text-xs"
            title="新建 Markdown 文件"
            aria-label="新建文件"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">新建</span>
          </button>
          <button
            onClick={() => setNewFileDropdownOpen(!newFileDropdownOpen)}
            className="p-1 bg-blue-700 hover:bg-blue-600 text-white rounded-r-md border-l border-blue-500/50 shadow-sm transition"
            title="选择要新建的文件类型"
            aria-label="更多新建类型"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {newFileDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs select-none">
              <button
                onClick={() => {
                  onNewFile(undefined, undefined, 'md');
                  setNewFileDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <div>
                  <div className="font-medium">新建 Markdown 文档</div>
                  <div className="text-[10px] text-slate-400 font-mono">.md · 文档与混合图表</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNewFile(undefined, undefined, 'markmap');
                  setNewFileDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition"
              >
                <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                <div>
                  <div className="font-medium text-cyan-200">新建思维导图</div>
                  <div className="text-[10px] text-cyan-400/80 font-mono">.markmap · 交互式矢量导图</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNewFile(undefined, undefined, 'puml');
                  setNewFileDropdownOpen(false);
                }}
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

        {/* Global Settings Trigger */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1 sm:p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-700 transition shadow-sm"
            title="打开工作台全局偏好与持久化配置中心"
            aria-label="工作台偏好设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};

