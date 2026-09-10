/**
 * PlantUML 企业级架构建模与可视化视口驱动
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Server,
  Image as ImageIcon,
  ChevronDown,
  Palette,
  Hand,
  Maximize2,
  Code,
  Layers,
  Search,
  BookOpen,
  HelpCircle,
  FileCode
} from 'lucide-react';
import {
  getPlantUmlSvgUrl,
  getPlantUmlPngUrl,
  getPlantUmlServerBase,
  setPlantUmlServerBase,
  PLANTUML_SERVER_PRESETS
} from '../../../../shared/lib/plantuml';
import { Locale, t } from '../../../../shared/lib/i18n';
import {
  PLANTUML_TEMPLATES,
  PLANTUML_THEMES,
  PLANTUML_SNIPPETS,
  PlantUmlTemplate,
  applyPlantUmlTheme,
  detectPlantUmlTheme
} from './plantuml/plantUmlData';

interface PlantUmlViewerProps {
  content: string;
  onContentChange?: (newContent: string) => void;
  fileName?: string;
  locale?: Locale;
}

export const PlantUmlViewer: React.FC<PlantUmlViewerProps> = ({
  content,
  onContentChange,
  fileName = 'diagram.puml',
  locale = 'zh-CN',
}) => {
  const [localCode, setLocalCode] = useState(content);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverUrl, setServerUrl] = useState<string>(getPlantUmlServerBase());
  const [showServerModal, setShowServerModal] = useState(false);
  const [customInput, setCustomInput] = useState(serverUrl);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<PlantUmlTemplate>(PLANTUML_TEMPLATES[0]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Draggable split ratio (percentage for code editor pane)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('omniview_plantuml_split');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 10 && val <= 90) return val;
      }
    } catch {}
    return 50;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Splitter drag event listeners
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rawPercentage = (offsetX / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercentage, 12), 88);
      setSplitRatio(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  useEffect(() => {
    try {
      localStorage.setItem('omniview_plantuml_split', splitRatio.toString());
    } catch {}
  }, [splitRatio]);

  // Derived URLs
  const svgUrl = getPlantUmlSvgUrl(localCode, serverUrl);
  const pngUrl = getPlantUmlPngUrl(localCode, serverUrl);
  const activeThemeId = detectPlantUmlTheme(localCode);

  const handleCodeChange = (newText: string) => {
    setLocalCode(newText);
    if (onContentChange) {
      onContentChange(newText);
    }
  };

  const handleApplyTemplate = (templateCode: string) => {
    handleCodeChange(templateCode);
    setShowTemplateModal(false);
    handleResetViewport();
  };

  const handleSelectTheme = (themeVal: string) => {
    const updated = applyPlantUmlTheme(localCode, themeVal);
    handleCodeChange(updated);
    setShowThemeMenu(false);
    handleRefresh();
  };

  const handleInsertSnippet = (snippetCode: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = localCode.substring(0, start);
      const after = localCode.substring(end);
      const prefix = before.length === 0 || before.endsWith('\n') ? '' : '\n';
      const updated = before + prefix + snippetCode + after;
      handleCodeChange(updated);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length + snippetCode.length, start + prefix.length + snippetCode.length);
      }, 30);
    } else {
      handleCodeChange(localCode + '\n' + snippetCode);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySvgCode = async () => {
    try {
      const res = await fetch(svgUrl);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 2000);
    } catch (err) {
      console.error('Failed to copy SVG source:', err);
    }
    setShowExportMenu(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleSaveServer = (newUrl: string) => {
    setServerUrl(newUrl);
    setPlantUmlServerBase(newUrl);
    setShowServerModal(false);
    handleRefresh();
  };

  const handleDownloadSvg = async () => {
    try {
      const res = await fetch(svgUrl);
      const text = await res.text();
      const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = fileName.replace(/\.[^/.]+$/, '') + '.svg';
      a.click();
      URL.revokeObjectURL(dlUrl);
    } catch {
      window.open(svgUrl, '_blank');
    }
    setShowExportMenu(false);
  };

  const handleDownloadPng = () => {
    if (pngUrl) {
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = fileName.replace(/\.[^/.]+$/, '') + '.png';
      a.target = '_blank';
      a.click();
    }
    setShowExportMenu(false);
  };

  // Canvas Pan & Zoom Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (panMode || e.button === 1 || e.shiftKey) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom(z => Math.min(3.5, Math.max(0.2, z + delta)));
    }
  };

  const handleResetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const isLocalServer = serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1');

  // Filter templates
  const filteredTemplates = PLANTUML_TEMPLATES.filter(tmpl => {
    const matchesCat = templateCategory === 'all' || tmpl.category === templateCategory;
    const matchesSearch =
      templateSearch === '' ||
      tmpl.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      tmpl.description.toLowerCase().includes(templateSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div id="plantuml-studio-container" className="h-full flex flex-col bg-slate-950 text-slate-200 relative select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-purple-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            PlantUML 架构建模引擎
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-mono text-[11px] truncate max-w-[140px]">{fileName}</span>
        </div>

        {/* Center: Template Library Modal Launcher & Quick Presets */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white rounded border border-purple-500/50 text-xs font-medium transition shrink-0"
            title="浏览完整的系统架构、C4 容器、时序图、甘特图等企业级模版"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-300" />
            <span>模板库 ({PLANTUML_TEMPLATES.length})</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {PLANTUML_TEMPLATES.slice(0, 3).map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleApplyTemplate(tmpl.code)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] border border-slate-700 transition shrink-0"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Theme Injector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition"
              title="切换 PlantUML 官方皮肤主题 (!theme)"
            >
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden lg:inline">
                {activeThemeId ? `主题: ${activeThemeId}` : '官方主题'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                <div className="text-[10px] text-slate-400 font-mono px-2 py-1 border-b border-slate-800 flex justify-between items-center">
                  <span>PLANTUML 官方皮肤主题</span>
                  <span className="text-pink-400">!theme</span>
                </div>
                {PLANTUML_THEMES.map(th => {
                  const isActive = activeThemeId === th.themeValue;
                  return (
                    <button
                      key={th.id}
                      onClick={() => handleSelectTheme(th.themeValue)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                        isActive
                          ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-xs flex items-center gap-1.5">
                          {th.name}
                          {th.isDark && <span className="text-[9px] px-1 bg-slate-800 rounded text-slate-400">暗色</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">{th.description}</div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Server Config Button */}
          <div className="relative">
            <button
              onClick={() => setShowServerModal(!showServerModal)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition border ${
                isLocalServer
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="配置 PlantUML 渲染服务器 (支持本地 Docker 容器直连)"
            >
              <Server className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {isLocalServer ? '本地 Docker 服务' : '官方云端'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Server Settings Popover */}
            {showServerModal && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-purple-400" />
                    PlantUML 服务器配置
                  </span>
                  <button
                    onClick={() => setShowServerModal(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="text-slate-400 text-[11px]">选择渲染服务器或连接内网本地容器：</div>
                  {PLANTUML_SERVER_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (preset.url) {
                          handleSaveServer(preset.url);
                        } else {
                          setCustomInput(serverUrl);
                        }
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition ${
                        serverUrl === preset.url
                          ? 'border-purple-500/80 bg-purple-950/40 text-purple-200'
                          : 'border-slate-800 hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="font-medium text-xs">{preset.name}</div>
                      {preset.url && <div className="text-[10px] text-slate-500 truncate">{preset.url}</div>}
                    </button>
                  ))}
                  <div className="pt-2">
                    <label className="text-slate-400 text-[11px] block mb-1">自定义私有服务器 URL：</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        placeholder="http://localhost:8080"
                        className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200 font-mono text-[11px] outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => handleSaveServer(customInput)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="重新编译渲染"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition"
              title="导出与复制矢量资产"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>无损导出</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1">
                <button
                  onClick={handleDownloadSvg}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>导出矢量文件 (.svg)</span>
                </button>
                <button
                  onClick={handleDownloadPng}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>导出高清位图 (.png)</span>
                </button>
                <button
                  onClick={handleCopySvgCode}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  {copiedSvg ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copiedSvg ? 'SVG 源码已复制' : '复制 SVG 代码 (直贴设计稿)'}</span>
                </button>
                <div className="border-t border-slate-800 my-1"></div>
                <a
                  href={svgUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>新窗口全屏查看</span>
                </a>
              </div>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded border border-purple-500/40 transition shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制代码'}</span>
          </button>
        </div>
      </div>

      {/* Main Split View: Code Editor vs Vector Canvas (Draggable Splitter) */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Pointer-events overlay during drag to prevent textarea or image from intercepting mouse movements */}
        {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize select-none" />}

        {/* Left: Code Editor */}
        <div
          style={{ width: `${splitRatio}%` }}
          className="flex flex-col bg-slate-900/40 min-w-0"
        >
          {/* Editor Header */}
          <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between shrink-0">
            <span className="truncate flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-purple-400" />
              PLANTUML DSL 源码 ({Math.round(splitRatio)}%)
            </span>
            <span>{localCode.split('\n').length} {t('linesUtf8', locale)}</span>
          </div>

          {/* Quick Snippets Insertion Bar */}
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-950/80 border-b border-slate-800/80 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] text-slate-500 font-mono px-1 shrink-0">快捷片段:</span>
            {PLANTUML_SNIPPETS.map((snippet, idx) => (
              <button
                key={idx}
                onClick={() => handleInsertSnippet(snippet.code)}
                className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-purple-300 rounded text-[10px] font-mono border border-slate-800 shrink-0 transition"
                title={snippet.tooltip}
              >
                {snippet.label}
              </button>
            ))}
          </div>

          {/* Source Code Textarea */}
          <textarea
            ref={textareaRef}
            value={localCode}
            onChange={e => handleCodeChange(e.target.value)}
            spellCheck={false}
            className="flex-1 p-4 bg-transparent font-mono text-xs text-purple-100 resize-none outline-none leading-relaxed selection:bg-purple-600 selection:text-white"
            placeholder="@startuml ... @enduml"
          />
        </div>

        {/* Draggable Splitter Divider */}
        <div
          onMouseDown={handleSplitterMouseDown}
          onDoubleClick={() => setSplitRatio(50)}
          title="左右按住拖拽调节代码与图片分割比例 | 双击快速复位为 50%"
          className={`relative z-20 w-2 shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors border-x border-slate-800/80 group ${
            isDragging
              ? 'bg-purple-600 shadow-md shadow-purple-500/50'
              : 'bg-slate-900 hover:bg-purple-600/80'
          }`}
        >
          {/* Visual Grip Handle */}
          <div className="h-10 w-1 rounded-full bg-slate-600 group-hover:bg-purple-200 transition-colors flex flex-col items-center justify-center gap-0.5">
            <span className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
            <span className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
            <span className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
          </div>
        </div>

        {/* Right: Live Vector Preview & Interactive Viewport */}
        <div
          style={{ width: `${100 - splitRatio}%` }}
          className="flex flex-col bg-slate-950 min-w-0"
        >
          {/* Viewport Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-xs shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono truncate">
                矢量视口 ({Math.round(100 - splitRatio)}%)
              </span>

              {/* Quick Split Ratio Presets */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setSplitRatio(30)}
                  className={`px-1.5 py-0.5 rounded transition ${splitRatio === 30 ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  title="30% 代码 : 70% 预览"
                >
                  30:70
                </button>
                <button
                  onClick={() => setSplitRatio(50)}
                  className={`px-1.5 py-0.5 rounded transition ${splitRatio === 50 ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  title="50% 代码 : 50% 预览 (平衡)"
                >
                  50:50
                </button>
                <button
                  onClick={() => setSplitRatio(70)}
                  className={`px-1.5 py-0.5 rounded transition ${splitRatio === 70 ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  title="70% 代码 : 30% 预览"
                >
                  70:30
                </button>
              </div>
            </div>

            {/* Viewport Navigation & Tools */}
            <div className="flex items-center gap-1.5">
              {/* Hand Tool (Pan Mode) */}
              <button
                onClick={() => setPanMode(!panMode)}
                className={`p-1 rounded transition border ${
                  panMode
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title={panMode ? '抓手平移模式已激活 (拖拽画布平移)' : '开启抓手平移模式 (或按住 Shift 拖动)'}
              >
                <Hand className="w-3.5 h-3.5" />
              </button>

              <div className="h-3 w-[1px] bg-slate-800 mx-0.5" />

              {/* Zoom Controls */}
              <button
                onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                title="缩小 (Ctrl + 滚轮向下)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-cyan-400 text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(3.5, z + 0.15))}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                title="放大 (Ctrl + 滚轮向上)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetViewport}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                title="复位视口 (100% 居中)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Canvas Stage */}
          <div
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            className={`flex-1 overflow-hidden relative flex items-center justify-center bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] ${
              panMode || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
          >
            {/* Draggable & Zoomable Canvas Element */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 100ms ease-out',
              }}
              className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-700 max-w-full select-none"
            >
              <img
                src={svgUrl}
                alt="PlantUML Architecture Diagram"
                draggable={false}
                className="max-w-none block pointer-events-none"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Floating Quick Viewport Status Indicator */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg text-[10px] text-slate-400 font-mono pointer-events-none">
              <span>{Math.round(zoom * 100)}%</span>
              {(pan.x !== 0 || pan.y !== 0) && (
                <span className="text-purple-400">({Math.round(pan.x)}, {Math.round(pan.y)})</span>
              )}
              {panMode && <span className="text-emerald-400 font-medium">[平移抓手已激活]</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Template Library Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">PlantUML 企业级架构模板库</h3>
                  <p className="text-xs text-slate-400">选择经典架构与图表样板，一键加载至工作台开始设计</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition text-sm"
              >
                ✕
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: '全部' },
                  { id: 'architecture', label: '系统架构' },
                  { id: 'sequence', label: '时序通信' },
                  { id: 'state', label: '系统状态' },
                  { id: 'gantt', label: '研发甘特图' },
                  { id: 'mindmap', label: '思维导图' },
                  { id: 'database', label: '数据建模' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setTemplateCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs transition ${
                      templateCategory === cat.id
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="搜索模板..."
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Modal Body: Left Template List, Right Preview */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Template List */}
              <div className="w-2/5 border-r border-slate-800 overflow-y-auto p-4 space-y-2">
                {filteredTemplates.map(tmpl => {
                  const isSelected = selectedTemplate.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        isSelected
                          ? 'border-purple-500/80 bg-purple-950/40 text-purple-100 shadow-sm'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs text-white">{tmpl.name}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
                          {tmpl.categoryLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{tmpl.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Right Preview */}
              <div className="w-3/5 flex flex-col bg-slate-950/60">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">{selectedTemplate.name}</h4>
                    <span className="text-[11px] text-slate-400">{selectedTemplate.description}</span>
                  </div>
                  <button
                    onClick={() => handleApplyTemplate(selectedTemplate.code)}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition shadow-lg shadow-purple-600/30"
                  >
                    载入此模板
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-purple-200">
                  <pre className="whitespace-pre-wrap leading-relaxed">{selectedTemplate.code}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
