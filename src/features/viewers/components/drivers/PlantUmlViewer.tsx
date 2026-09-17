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
  hasRenderablePlantUmlCode,
  withPlantUmlCacheBust,
  PLANTUML_SERVER_PRESETS,
  PLANTUML_FALLBACK_SERVERS,
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
  onOpenInEditor?: () => void;
}

export const PlantUmlViewer: React.FC<PlantUmlViewerProps> = ({
  content,
  onContentChange,
  fileName = 'diagram.puml',
  locale = 'zh-CN',
  onOpenInEditor,
}) => {
  const [localCode, setLocalCode] = useState(content);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [renderNonce, setRenderNonce] = useState(0);
  const [imgStatus, setImgStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
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
  const fallbackTriedRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextExternalSync = useRef(false);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // 与宿主文档内容同步（修复插件打开后仍停留在空图/白点的问题，并增加本地防抖回声保护）
  useEffect(() => {
    if (skipNextExternalSync.current) {
      skipNextExternalSync.current = false;
      return;
    }
    setLocalCode(content);
    setImgStatus(hasRenderablePlantUmlCode(content) ? 'loading' : 'idle');
    setRenderNonce(n => n + 1);
    fallbackTriedRef.current.clear();
  }, [content]);

  useEffect(() => {
    if (!hasRenderablePlantUmlCode(localCode)) {
      setImgStatus('idle');
      return;
    }
    setImgStatus('loading');
  }, [localCode, serverUrl, renderNonce]);

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
  const canRender = hasRenderablePlantUmlCode(localCode);
  const svgUrl = canRender ? getPlantUmlSvgUrl(localCode, serverUrl) : '';
  const pngUrl = canRender ? getPlantUmlPngUrl(localCode, serverUrl) : '';
  const displaySvgUrl = withPlantUmlCacheBust(svgUrl, renderNonce);
  const activeThemeId = detectPlantUmlTheme(localCode);

  const handleCodeChange = (newText: string, immediate = false) => {
    setLocalCode(newText);
    if (!onContentChange) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (immediate) {
      skipNextExternalSync.current = true;
      onContentChange(newText);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      skipNextExternalSync.current = true;
      onContentChange(newText);
    }, 300);
  };

  const handleApplyTemplate = (templateCode: string) => {
    handleCodeChange(templateCode, true);
    setShowTemplateModal(false);
    handleResetViewport();
  };

  const handleSelectTheme = (themeVal: string) => {
    const updated = applyPlantUmlTheme(localCode, themeVal);
    handleCodeChange(updated, true);
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
    fallbackTriedRef.current.clear();
    setImgStatus(canRender ? 'loading' : 'idle');
    setRenderNonce(n => n + 1);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleImageError = () => {
    // 当前服务失败时，自动轮询备用服务器，避免预览区只剩一个白点
    const normalizedCurrent = serverUrl.replace(/\/$/, '');
    fallbackTriedRef.current.add(normalizedCurrent);

    const candidates = [serverUrl, ...PLANTUML_FALLBACK_SERVERS]
      .map(u => u.replace(/\/$/, ''))
      .filter((u, idx, arr) => Boolean(u) && arr.indexOf(u) === idx);

    const next = candidates.find(u => !fallbackTriedRef.current.has(u));
    if (next) {
      setServerUrl(next);
      setRenderNonce(n => n + 1);
      setImgStatus('loading');
      return;
    }
    setImgStatus('error');
  };

  const handleSaveServer = (newUrl: string) => {
    const normalized = newUrl.trim().replace(/\/$/, '');
    setServerUrl(normalized);
    setPlantUmlServerBase(normalized);
    setShowServerModal(false);
    fallbackTriedRef.current.clear();
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
    <div
      id="plantuml-studio-container"
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full flex flex-col relative select-none"
    >
      {/* Top Header */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-4 py-2 border-b text-xs gap-3 flex-wrap sm:flex-nowrap shrink-0"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-[var(--ov-accent)] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--ov-accent)]" />
            PlantUML 架构建模引擎
          </span>
          <span style={{ color: 'var(--ov-border)' }}>|</span>
          <span style={{ color: 'var(--ov-text-muted)' }} className="font-mono text-[11px] truncate max-w-[140px]">{fileName}</span>
        </div>

        {/* Center: Template Library Modal Launcher & Quick Presets */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setShowTemplateModal(true)}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition shrink-0 hover:border-[var(--ov-accent)]"
            title="浏览完整的系统架构、C4 容器、时序图、甘特图等企业级模版"
            aria-label="模板库"
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--ov-accent)]" />
            <span className="hidden sm:inline">模板库 ({PLANTUML_TEMPLATES.length})</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {PLANTUML_TEMPLATES.slice(0, 3).map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleApplyTemplate(tmpl.code)}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="px-2 py-0.5 rounded text-[11px] border transition shrink-0 hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
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
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1 px-2 py-1 rounded border transition hover:border-[var(--ov-accent)]"
              title="切换 PlantUML 官方皮肤主题 (!theme)"
            >
              <Palette className="w-3.5 h-3.5 text-pink-500" />
              <span className="hidden lg:inline">
                {activeThemeId ? `主题: ${activeThemeId}` : '官方主题'}
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--ov-text-muted)]" />
            </button>

            {showThemeMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                  boxShadow: 'var(--ov-shadow)',
                }}
                className="absolute right-0 mt-2 w-56 border rounded-xl p-2 z-50 text-xs space-y-1"
              >
                <div
                  style={{
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text-muted)',
                  }}
                  className="text-[10px] font-mono px-2 py-1 border-b flex justify-between items-center"
                >
                  <span>PLANTUML 官方皮肤主题</span>
                  <span className="text-pink-500 font-semibold">!theme</span>
                </div>
                {PLANTUML_THEMES.map(th => {
                  const isActive = activeThemeId === th.themeValue;
                  return (
                    <button
                      key={th.id}
                      onClick={() => handleSelectTheme(th.themeValue)}
                      style={
                        isActive
                          ? { backgroundColor: 'var(--ov-accent-bg, rgba(99,102,241,0.15))', borderColor: 'var(--ov-accent)', color: 'var(--ov-accent)' }
                          : { color: 'var(--ov-text-secondary)' }
                      }
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition border border-transparent hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                    >
                      <div>
                        <div className="font-medium text-xs flex items-center gap-1.5">
                          {th.name}
                          {th.isDark && (
                            <span
                              style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text-muted)' }}
                              className="text-[9px] px-1 rounded border border-[var(--ov-border)]"
                            >
                              暗色
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">{th.description}</div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-[var(--ov-accent)] shrink-0" />}
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
              style={
                isLocalServer
                  ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgb(16,185,129)', color: 'rgb(16,185,129)' }
                  : { backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text)' }
              }
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition border hover:border-[var(--ov-accent)]"
              title="配置 PlantUML 渲染服务器 (支持本地 Docker 容器直连)"
            >
              <Server className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {isLocalServer ? '本地 Docker 服务' : '官方云端'}
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--ov-text-muted)]" />
            </button>

            {/* Server Settings Popover */}
            {showServerModal && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                  boxShadow: 'var(--ov-shadow)',
                }}
                className="absolute right-0 mt-2 w-80 border rounded-xl p-4 z-50 text-xs space-y-3"
              >
                <div
                  style={{ borderBottomColor: 'var(--ov-border)' }}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--ov-text)' }}>
                    <Server className="w-4 h-4 text-[var(--ov-accent)]" />
                    PlantUML 服务器配置
                  </span>
                  <button
                    onClick={() => setShowServerModal(false)}
                    style={{ color: 'var(--ov-text-muted)' }}
                    className="hover:text-[var(--ov-text)]"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2">
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[11px]">选择渲染服务器或连接内网本地容器：</div>
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
                      style={
                        serverUrl === preset.url
                          ? { backgroundColor: 'var(--ov-accent-bg, rgba(99,102,241,0.15))', borderColor: 'var(--ov-accent)', color: 'var(--ov-accent)' }
                          : { borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)', backgroundColor: 'var(--ov-bg)' }
                      }
                      className="w-full text-left p-2 rounded-lg border transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                    >
                      <div className="font-medium text-xs">{preset.name}</div>
                      {preset.url && <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] truncate">{preset.url}</div>}
                    </button>
                  ))}
                  <div className="pt-2">
                    <label style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] block mb-1">自定义私有服务器 URL：</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        placeholder="http://localhost:8080"
                        style={{
                          backgroundColor: 'var(--ov-bg)',
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-text)',
                        }}
                        className="flex-1 px-2.5 py-1 border rounded font-mono text-[11px] outline-none focus:border-[var(--ov-accent)]"
                      />
                      <button
                        onClick={() => handleSaveServer(customInput)}
                        style={{ backgroundColor: 'var(--ov-accent)', color: '#ffffff' }}
                        className="px-3 py-1 rounded text-xs font-medium transition hover:opacity-90"
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
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
            title="重新编译渲染"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded border transition hover:border-[var(--ov-accent)]"
              title="导出与复制矢量资产"
              aria-label="无损导出"
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              <span className="hidden sm:inline">无损导出</span>
              <ChevronDown className="w-3 h-3 text-[var(--ov-text-muted)]" />
            </button>

            {showExportMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                  boxShadow: 'var(--ov-shadow)',
                }}
                className="absolute right-0 mt-2 w-52 border rounded-xl p-1.5 z-50 text-xs space-y-1"
              >
                <button
                  onClick={handleDownloadSvg}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>导出矢量文件 (.svg)</span>
                </button>
                <button
                  onClick={handleDownloadPng}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>导出高清位图 (.png)</span>
                </button>
                <button
                  onClick={handleCopySvgCode}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                >
                  {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{copiedSvg ? 'SVG 源码已复制' : '复制 SVG 代码 (直贴设计稿)'}</span>
                </button>
                <div style={{ borderColor: 'var(--ov-border)' }} className="border-t my-1"></div>
                <a
                  href={svgUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--ov-text-secondary)' }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition hover:text-[var(--ov-text)] hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>新窗口全屏查看</span>
                </a>
              </div>
            )}
          </div>

          {onOpenInEditor && (
            <button
              type="button"
              id="btn-plantuml-open-in-native-editor"
              onClick={onOpenInEditor}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded border transition shrink-0 hover:border-[var(--ov-accent)] text-xs font-medium cursor-pointer"
              title="在 VS Code 原生文本编辑器中并排编辑"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">在编辑器中打开</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            style={{
              backgroundColor: 'var(--ov-accent)',
              color: '#ffffff',
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded transition shrink-0 hover:opacity-90 shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
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
          style={{
            width: `${splitRatio}%`,
            backgroundColor: 'var(--ov-code-bg, var(--ov-bg))',
            borderRight: '1px solid var(--ov-border)',
          }}
          className="flex flex-col min-w-0"
        >
          {/* Editor Header */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderBottomColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="px-3 py-1.5 border-b text-[11px] font-mono flex items-center justify-between shrink-0"
          >
            <span className="truncate flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-[var(--ov-accent)]" />
              PLANTUML DSL 源码 ({Math.round(splitRatio)}%)
            </span>
            <span style={{ color: 'var(--ov-text-muted)' }}>{localCode.split('\n').length} {t('linesUtf8', locale)}</span>
          </div>

          {/* Quick Snippets Insertion Bar */}
          <div
            style={{
              backgroundColor: 'var(--ov-bg)',
              borderBottomColor: 'var(--ov-border)',
            }}
            className="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto no-scrollbar shrink-0"
          >
            <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono px-1 shrink-0">快捷片段:</span>
            {PLANTUML_SNIPPETS.map((snippet, idx) => (
              <button
                key={idx}
                onClick={() => handleInsertSnippet(snippet.code)}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0 transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
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
            style={{
              color: 'var(--ov-text)',
              backgroundColor: 'transparent',
            }}
            className="flex-1 p-4 font-mono text-xs resize-none outline-none leading-relaxed"
            placeholder="@startuml ... @enduml"
          />
        </div>

        {/* Draggable Splitter Divider */}
        <div
          onMouseDown={handleSplitterMouseDown}
          onDoubleClick={() => setSplitRatio(50)}
          title="左右按住拖拽调节代码与图片分割比例 | 双击快速复位为 50%"
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
          }}
          className={`relative z-20 w-2 shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors border-x group ${
            isDragging ? 'bg-[var(--ov-accent)]!' : 'hover:bg-[var(--ov-accent)]/40'
          }`}
        >
          {/* Visual Grip Handle */}
          <div className="h-10 w-1 rounded-full bg-[var(--ov-border)] group-hover:bg-[var(--ov-accent)] transition-colors flex flex-col items-center justify-center gap-0.5">
            <span className="w-0.5 h-0.5 rounded-full bg-[var(--ov-text-muted)]" />
            <span className="w-0.5 h-0.5 rounded-full bg-[var(--ov-text-muted)]" />
            <span className="w-0.5 h-0.5 rounded-full bg-[var(--ov-text-muted)]" />
          </div>
        </div>

        {/* Right: Live Vector Preview & Interactive Viewport */}
        <div
          style={{
            width: `${100 - splitRatio}%`,
            backgroundColor: 'var(--ov-bg)',
          }}
          className="flex flex-col min-w-0"
        >
          {/* Viewport Toolbar */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderBottomColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0 flex-wrap gap-2"
          >
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] font-mono truncate">
                矢量视口 ({Math.round(100 - splitRatio)}%)
              </span>

              {/* Quick Split Ratio Presets */}
              <div
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                }}
                className="hidden sm:flex items-center gap-1 px-1 py-0.5 rounded border text-[10px] font-mono"
              >
                <button
                  onClick={() => setSplitRatio(30)}
                  style={splitRatio === 30 ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' } : { color: 'var(--ov-text-muted)' }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)]"
                  title="30% 代码 : 70% 预览"
                >
                  30:70
                </button>
                <button
                  onClick={() => setSplitRatio(50)}
                  style={splitRatio === 50 ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' } : { color: 'var(--ov-text-muted)' }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)]"
                  title="50% 代码 : 50% 预览 (平衡)"
                >
                  50:50
                </button>
                <button
                  onClick={() => setSplitRatio(70)}
                  style={splitRatio === 70 ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' } : { color: 'var(--ov-text-muted)' }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)]"
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
                style={
                  panMode
                    ? { backgroundColor: 'var(--ov-accent)', borderColor: 'var(--ov-accent)', color: '#ffffff' }
                    : { backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)' }
                }
                className="p-1 rounded transition border hover:text-[var(--ov-text)]"
                title={panMode ? '抓手平移模式已激活 (拖拽画布平移)' : '开启抓手平移模式 (或按住 Shift 拖动)'}
              >
                <Hand className="w-3.5 h-3.5" />
              </button>

              <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-3 w-[1px] mx-0.5" />

              {/* Zoom Controls */}
              <button
                onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}
                style={{ color: 'var(--ov-text-secondary)' }}
                className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded"
                title="缩小 (Ctrl + 滚轮向下)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[var(--ov-accent)] text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(3.5, z + 0.15))}
                style={{ color: 'var(--ov-text-secondary)' }}
                className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded"
                title="放大 (Ctrl + 滚轮向上)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetViewport}
                style={{ color: 'var(--ov-text-secondary)' }}
                className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded"
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
            style={{
              backgroundColor: 'var(--ov-bg)',
            }}
            className={`flex-1 overflow-hidden relative flex items-center justify-center ${
              panMode || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
          >
            {/* Draggable & Zoomable Canvas Element */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 100ms ease-out',
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                boxShadow: 'var(--ov-shadow)',
              }}
              className="relative p-6 rounded-2xl border max-w-[min(100%,960px)] min-w-[240px] min-h-[160px] select-none flex items-center justify-center"
            >
              {!canRender && (
                <div style={{ color: 'var(--ov-text-muted)' }} className="text-center text-xs space-y-2 px-4 py-6">
                  <p style={{ color: 'var(--ov-text)' }} className="font-medium">暂无可渲染的 PlantUML 内容</p>
                  <p>请确认文档包含 `@startuml` … `@enduml` 及实际图表语句。</p>
                </div>
              )}

              {canRender && imgStatus === 'error' && (
                <div style={{ color: 'var(--ov-text-secondary)' }} className="text-center text-xs space-y-3 px-4 py-6 max-w-md">
                  <p className="font-semibold text-rose-500">PlantUML 渲染服务不可用</p>
                  <p style={{ color: 'var(--ov-text-muted)' }}>
                    无法从当前服务器加载矢量图（网络受限、离线或服务未启动）。
                    可切换到本地 Docker（`http://localhost:8080`）或检查代理后重试。
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      style={{ backgroundColor: 'var(--ov-accent)', color: '#ffffff' }}
                      className="px-3 py-1.5 rounded font-medium hover:opacity-90"
                    >
                      重新加载
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowServerModal(true)}
                      style={{
                        backgroundColor: 'var(--ov-surface)',
                        borderColor: 'var(--ov-border)',
                        color: 'var(--ov-text)',
                      }}
                      className="px-3 py-1.5 rounded border hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
                    >
                      配置服务器
                    </button>
                  </div>
                  {svgUrl && (
                    <a
                      href={svgUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--ov-accent)] hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      在浏览器中打开渲染链接
                    </a>
                  )}
                </div>
              )}

              {canRender && imgStatus !== 'error' && displaySvgUrl && (
                <>
                  {imgStatus === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        style={{
                          backgroundColor: 'var(--ov-surface)',
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-text)',
                          boxShadow: 'var(--ov-shadow)',
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px]"
                      >
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--ov-accent)]" />
                        正在编译 PlantUML…
                      </div>
                    </div>
                  )}
                  <img
                    key={displaySvgUrl}
                    src={displaySvgUrl}
                    alt="PlantUML Architecture Diagram"
                    draggable={false}
                    className={`max-w-full h-auto block pointer-events-none ${imgStatus === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImgStatus('ready')}
                    onError={handleImageError}
                  />
                </>
              )}
            </div>

            {/* Floating Quick Viewport Status Indicator */}
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-muted)',
                boxShadow: 'var(--ov-shadow)',
              }}
              className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1 backdrop-blur-md border rounded-lg text-[10px] font-mono pointer-events-none"
            >
              <span style={{ color: 'var(--ov-text)' }}>{Math.round(zoom * 100)}%</span>
              {(pan.x !== 0 || pan.y !== 0) && (
                <span className="text-[var(--ov-accent)]">({Math.round(pan.x)}, {Math.round(pan.y)})</span>
              )}
              {panMode && <span className="text-emerald-500 font-medium">[平移抓手已激活]</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Template Library Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
              boxShadow: 'var(--ov-shadow)',
            }}
            className="border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div
              style={{ borderBottomColor: 'var(--ov-border)', backgroundColor: 'var(--ov-surface-header)' }}
              className="flex items-center justify-between px-6 py-4 border-b"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[var(--ov-accent)]" />
                <div>
                  <h3 style={{ color: 'var(--ov-text)' }} className="text-sm font-semibold">PlantUML 企业级架构模板库</h3>
                  <p style={{ color: 'var(--ov-text-muted)' }} className="text-xs">选择经典架构与图表样板，一键加载至工作台开始设计</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                style={{ color: 'var(--ov-text-muted)' }}
                className="hover:text-[var(--ov-text)] p-1 rounded-lg transition text-sm"
              >
                ✕
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div
              style={{
                borderBottomColor: 'var(--ov-border)',
                backgroundColor: 'var(--ov-bg)',
              }}
              className="px-6 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
            >
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
                    style={
                      templateCategory === cat.id
                        ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' }
                        : { backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)' }
                    }
                    className="px-3 py-1 rounded-full text-xs transition border"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-48">
                <Search style={{ color: 'var(--ov-text-muted)' }} className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="搜索模板..."
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                  className="w-full pl-8 pr-2.5 py-1 border rounded-lg text-xs outline-none focus:border-[var(--ov-accent)]"
                />
              </div>
            </div>

            {/* Modal Body: Left Template List, Right Preview */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Template List */}
              <div
                style={{ borderRightColor: 'var(--ov-border)' }}
                className="w-2/5 border-r overflow-y-auto p-4 space-y-2"
              >
                {filteredTemplates.map(tmpl => {
                  const isSelected = selectedTemplate.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      style={
                        isSelected
                          ? { backgroundColor: 'var(--ov-accent-bg, rgba(99,102,241,0.15))', borderColor: 'var(--ov-accent)' }
                          : { backgroundColor: 'var(--ov-bg)', borderColor: 'var(--ov-border)' }
                      }
                      className="w-full text-left p-3 rounded-xl border transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: isSelected ? 'var(--ov-accent)' : 'var(--ov-text)' }} className="font-medium text-xs">{tmpl.name}</span>
                        <span
                          style={{ backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
                          className="text-[10px] px-2 py-0.5 rounded-full font-mono border"
                        >
                          {tmpl.categoryLabel}
                        </span>
                      </div>
                      <p style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] line-clamp-2 leading-relaxed">{tmpl.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Right Preview */}
              <div
                style={{ backgroundColor: 'var(--ov-code-bg, var(--ov-bg))' }}
                className="w-3/5 flex flex-col"
              >
                <div
                  style={{ borderBottomColor: 'var(--ov-border)', backgroundColor: 'var(--ov-surface-header)' }}
                  className="p-4 border-b flex items-center justify-between"
                >
                  <div>
                    <h4 style={{ color: 'var(--ov-text)' }} className="text-xs font-semibold">{selectedTemplate.name}</h4>
                    <span style={{ color: 'var(--ov-text-muted)' }} className="text-[11px]">{selectedTemplate.description}</span>
                  </div>
                  <button
                    onClick={() => handleApplyTemplate(selectedTemplate.code)}
                    style={{ backgroundColor: 'var(--ov-accent)', color: '#ffffff' }}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90 shadow-xs"
                  >
                    载入此模板
                  </button>
                </div>
                <div
                  style={{ color: 'var(--ov-text-secondary)' }}
                  className="flex-1 overflow-auto p-4 font-mono text-xs"
                >
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
