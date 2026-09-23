/**
 * PlantUML 企业级架构建模与可视化视口驱动 (PlantUmlViewer)
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  FileCode,
  Grid,
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
import { copySvgOrImageToClipboard } from '../../../../shared/lib/copyImageHelper';
import { Locale, t } from '../../../../shared/lib/i18n';
import {
  PLANTUML_THEMES,
  PLANTUML_TEMPLATES,
  applyPlantUmlTheme,
  detectPlantUmlTheme,
} from './plantuml/plantUmlData';
import { PlantUmlModelingToolbar } from './plantuml/PlantUmlModelingToolbar';
import { PlantUmlDiagramTabBar } from './plantuml/PlantUmlDiagramTabBar';
import { extractPlantUmlBlocks, PlantUmlBlockInfo } from './plantuml/plantUmlBlockParser';
import { PlantUmlServerModal } from './plantuml/PlantUmlServerModal';
import { PlantUmlTemplateModal } from './plantuml/PlantUmlTemplateModal';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { useSplitPane } from '../../hooks/useSplitPane';

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
  const [copiedImage, setCopiedImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [renderNonce, setRenderNonce] = useState(0);
  const [imgStatus, setImgStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [serverUrl, setServerUrl] = useState<string>(getPlantUmlServerBase());
  const [showServerModal, setShowServerModal] = useState(false);
  const [customInput, setCustomInput] = useState(serverUrl);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Multi-diagram Tab Management
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);
  const [renderAllMode, setRenderAllMode] = useState<boolean>(false);

  const [headerRef, headerWidth] = useContainerWidth<HTMLDivElement>(800);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const fallbackTriedRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextExternalSync = useRef(false);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Parse multi-diagram blocks from current code
  const diagramBlocks = useMemo(() => {
    return extractPlantUmlBlocks(localCode);
  }, [localCode]);

  // Ensure selected block index is within bounds
  useEffect(() => {
    if (diagramBlocks.length > 0 && selectedBlockIndex >= diagramBlocks.length) {
      setSelectedBlockIndex(0);
    }
  }, [diagramBlocks.length, selectedBlockIndex]);

  // Sync external content changes
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

  // Determine active render code (single selected block vs full document)
  const activeRenderCode = useMemo(() => {
    if (renderAllMode || diagramBlocks.length <= 1) {
      return localCode;
    }
    const currentBlock = diagramBlocks[selectedBlockIndex];
    return currentBlock ? currentBlock.code : localCode;
  }, [renderAllMode, diagramBlocks, selectedBlockIndex, localCode]);

  useEffect(() => {
    if (!hasRenderablePlantUmlCode(activeRenderCode)) {
      setImgStatus('idle');
      return;
    }
    setImgStatus('loading');
  }, [activeRenderCode, serverUrl, renderNonce]);

  // Draggable split ratio via standardized useSplitPane hook
  const {
    splitRatio,
    setSplitRatio,
    isDragging,
    handleSplitterMouseDown,
  } = useSplitPane({
    containerRef,
    storageKey: 'omniview_plantuml_split',
    defaultRatio: 50,
    minRatio: 12,
    maxRatio: 88,
  });

  // Derived URLs
  const canRender = hasRenderablePlantUmlCode(activeRenderCode);
  const svgUrl = canRender ? getPlantUmlSvgUrl(activeRenderCode, serverUrl) : '';
  const pngUrl = canRender ? getPlantUmlPngUrl(activeRenderCode, serverUrl) : '';
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

  // Insert code snippet at cursor or append
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

  // Add new diagram block to file
  const handleAddNewDiagram = () => {
    const newBlockIndex = diagramBlocks.length + 1;
    const newBlockCode = `\n\n@startuml 图表_${newBlockIndex}\ntitle 子架构模块 ${newBlockIndex}\n\nactor "用户" as U\nparticipant "网关" as GW\n\nU -> GW: 请求数据\nGW --> U: 返回结果 (200 OK)\n@enduml\n`;
    const updated = localCode + newBlockCode;
    handleCodeChange(updated, true);
    setSelectedBlockIndex(diagramBlocks.length);
    setRenderAllMode(false);
  };

  const handleSelectBlockTab = (idx: number) => {
    setSelectedBlockIndex(idx);
    setRenderAllMode(false);
    handleResetViewport();

    // Scroll textarea to the block if located
    const block = diagramBlocks[idx];
    if (block && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(block.fullSourceRange.start, block.fullSourceRange.start);
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

  /**
   * 一键复制高清位图数据流至系统剪贴板 (直贴 Word / WPS / PPT / 微信 / 飞书)
   */
  const handleCopyImageBlob = async () => {
    if (!canRender) return;
    setIsCopyingImage(true);
    try {
      const success = await copySvgOrImageToClipboard(displaySvgUrl || svgUrl, true, {
        scale: 3,
        backgroundColor: '#ffffff',
      });
      if (success) {
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } else {
        // 若因浏览器安全沙箱拦截，降级下载 PNG
        handleDownloadPng();
      }
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      handleDownloadPng();
    } finally {
      setIsCopyingImage(false);
      setShowExportMenu(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fallbackTriedRef.current.clear();
    setImgStatus(canRender ? 'loading' : 'idle');
    setRenderNonce(n => n + 1);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleImageError = () => {
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
      const currentBlockTitle = diagramBlocks[selectedBlockIndex]?.title || fileName;
      a.download = `${currentBlockTitle.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')}.svg`;
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
      const currentBlockTitle = diagramBlocks[selectedBlockIndex]?.title || fileName;
      a.download = `${currentBlockTitle.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')}.png`;
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
      setZoom(z => Math.max(0.2, Math.min(3.5, z + delta)));
    }
  };

  const handleResetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const isLocalServer = serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1');

  // Responsive UI break conditions
  const showTemplateLibraryText = headerWidth > 580;
  const showThemeText = headerWidth > 720;
  const showExportText = headerWidth > 640;
  const showEditorText = headerWidth > 760;
  const showCopyText = headerWidth > 480;
  const showQuickPresets = headerWidth > 860;

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
        ref={headerRef}
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between px-3 py-2 border-b text-xs gap-2 shrink-0 min-w-0"
      >
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <span className="font-semibold text-[var(--ov-accent)] flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[var(--ov-accent)]" />
            PlantUML
          </span>
          <span style={{ color: 'var(--ov-border)' }}>|</span>
          <span style={{ color: 'var(--ov-text-muted)' }} className="font-mono text-[11px] truncate max-w-[120px] sm:max-w-[200px]" title={fileName}>{fileName}</span>
        </div>

        {/* Center: Template Library Modal Launcher & Quick Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className={`flex items-center gap-1.5 ${showTemplateLibraryText ? 'px-2.5 py-1' : 'p-1.5'} rounded border text-xs font-medium transition shrink-0 hover:border-[var(--ov-accent)] cursor-pointer`}
            title="浏览完整的系统架构、C4 容器、时序图、甘特图等企业级模版"
            aria-label="模板库"
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--ov-accent)]" />
            {showTemplateLibraryText && <span>模板库 ({PLANTUML_TEMPLATES.length})</span>}
          </button>

          {showQuickPresets && (
            <div className="flex items-center gap-1">
              {PLANTUML_TEMPLATES.slice(0, 3).map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.code)}
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text-secondary)',
                  }}
                  className="px-2 py-0.5 rounded text-[11px] border transition shrink-0 hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Theme Injector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1 ${showThemeText ? 'px-2' : 'p-1.5'} py-1 rounded border transition hover:border-[var(--ov-accent)] cursor-pointer`}
              title="切换 PlantUML 官方皮肤主题 (!theme)"
              aria-label="主题"
            >
              <Palette className="w-3.5 h-3.5 text-pink-500" />
              {showThemeText && (
                <span>
                  {activeThemeId ? `主题: ${activeThemeId}` : '官方主题'}
                </span>
              )}
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
                      type="button"
                      onClick={() => handleSelectTheme(th.themeValue)}
                      style={
                        isActive
                          ? { backgroundColor: 'var(--ov-accent-bg, rgba(99,102,241,0.15))', borderColor: 'var(--ov-accent)', color: 'var(--ov-accent)' }
                          : { color: 'var(--ov-text-secondary)' }
                      }
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition border border-transparent hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] cursor-pointer"
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
              type="button"
              onClick={() => setShowServerModal(!showServerModal)}
              style={
                isLocalServer
                  ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgb(16,185,129)', color: 'rgb(16,185,129)' }
                  : { backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text)' }
              }
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition border hover:border-[var(--ov-accent)] cursor-pointer"
              title="配置 PlantUML 渲染服务器 (支持本地 Docker 容器直连)"
            >
              <Server className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {isLocalServer ? '本地 Docker 服务' : '官方云端'}
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--ov-text-muted)]" />
            </button>

            {/* Server Settings Popover */}
            <PlantUmlServerModal
              isOpen={showServerModal}
              onClose={() => setShowServerModal(false)}
              serverUrl={serverUrl}
              onSaveServer={handleSaveServer}
              customInput={customInput}
              setCustomInput={setCustomInput}
            />
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
            title="重新编译渲染"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1 ${showExportText ? 'px-2.5' : 'p-1.5'} py-1 rounded border transition hover:border-[var(--ov-accent)] cursor-pointer`}
              title="导出与复制矢量资产"
              aria-label="无损导出"
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              {showExportText && <span>无损导出</span>}
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
                  type="button"
                  onClick={handleCopyImageBlob}
                  disabled={isCopyingImage}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    {copiedImage ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isCopyingImage ? (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">
                        {copiedImage ? '图片已复制到剪贴板' : '复制图片数据流 (PNG)'}
                      </span>
                      <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">
                        写入 image/png 剪贴板，贴入 Word/PPT/微信
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/10 text-blue-400 font-semibold shrink-0">
                    PNG
                  </span>
                </button>
                <div style={{ borderColor: 'var(--ov-border)' }} className="border-t my-1"></div>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>导出矢量文件 (.svg)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>导出高清位图 (.png)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySvgCode}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] cursor-pointer"
                >
                  {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{copiedSvg ? 'SVG 源码已复制' : '复制 SVG 源码 (直贴设计稿/网页)'}</span>
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
              className={`flex items-center gap-1 ${showEditorText ? 'px-2.5' : 'p-1.5'} py-1 rounded border transition shrink-0 hover:border-[var(--ov-accent)] text-xs font-medium cursor-pointer`}
              title="在 VS Code 原生文本编辑器中并排编辑"
              aria-label="在编辑器中打开"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              {showEditorText && <span>在编辑器中打开</span>}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            style={{
              backgroundColor: 'var(--ov-accent)',
              color: '#ffffff',
            }}
            className={`flex items-center gap-1 ${showCopyText ? 'px-2.5' : 'p-1.5'} py-1 rounded transition shrink-0 hover:opacity-90 shadow-xs cursor-pointer`}
            title="复制代码"
            aria-label="复制代码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
            {showCopyText && <span>{copied ? '已复制' : '复制代码'}</span>}
          </button>
        </div>
      </div>

      {/* Multi-diagram Tabs Bar (if 2+ @startuml blocks) */}
      <PlantUmlDiagramTabBar
        blocks={diagramBlocks}
        selectedBlockIndex={selectedBlockIndex}
        onSelectBlock={handleSelectBlockTab}
        onAddNewDiagram={handleAddNewDiagram}
        renderAllMode={renderAllMode}
        onToggleRenderAllMode={() => setRenderAllMode(!renderAllMode)}
      />

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

          {/* PlantUML 交互式图元、连接符与 Sprite 建模工具箱 */}
          <PlantUmlModelingToolbar
            onInsertCode={handleInsertSnippet}
            activeDiagramType={diagramBlocks[selectedBlockIndex]?.diagramType}
          />

          {/* Source Code Textarea with Drag & Drop Insertion */}
          <div
            className="flex-1 relative flex flex-col"
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={e => {
              const snippet = e.dataTransfer.getData('application/x-plantuml-snippet') || e.dataTransfer.getData('text/plain');
              if (snippet && textareaRef.current) {
                e.preventDefault();
                const textarea = textareaRef.current;
                const dropPos = textarea.selectionStart;
                const before = localCode.substring(0, dropPos);
                const after = localCode.substring(dropPos);
                const prefix = before.length === 0 || before.endsWith('\n') ? '' : '\n';
                const updated = before + prefix + snippet + after;
                handleCodeChange(updated);
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(dropPos + prefix.length + snippet.length, dropPos + prefix.length + snippet.length);
                }, 30);
              }
            }}
          >
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
                {renderAllMode ? '全量连续视口' : diagramBlocks[selectedBlockIndex]?.title || '矢量视口'} ({Math.round(100 - splitRatio)}%)
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
                  type="button"
                  onClick={() => setSplitRatio(30)}
                  style={splitRatio === 30 ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' } : { color: 'var(--ov-text-muted)' }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)] cursor-pointer"
                  title="30% 代码 : 70% 预览"
                >
                  30:70
                </button>
                <button
                  type="button"
                  onClick={() => setSplitRatio(50)}
                  style={splitRatio === 50 ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' } : { color: 'var(--ov-text-muted)' }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)] cursor-pointer"
                  title="50% 代码 : 50% 预览 (平衡)"
                >
                  50:50
                </button>
                <button
                  type="button"
                  onClick={() => setSplitRatio(70)}
                  style={splitRatio === 70 ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' } : { color: 'var(--ov-text-muted)' }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)] cursor-pointer"
                  title="70% 代码 : 30% 预览"
                >
                  70:30
                </button>
              </div>
            </div>

            {/* Viewport Navigation & Tools */}
            <div className="flex items-center gap-1.5">
              {/* Copy Image Button */}
              <button
                type="button"
                onClick={handleCopyImageBlob}
                disabled={isCopyingImage || !canRender}
                style={{
                  backgroundColor: copiedImage ? 'rgba(16,185,129,0.15)' : 'var(--ov-surface)',
                  borderColor: copiedImage ? 'rgb(16,185,129)' : 'var(--ov-border)',
                  color: copiedImage ? 'rgb(16,185,129)' : 'var(--ov-text-secondary)',
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)] cursor-pointer"
                title="一键将高清图片写入系统剪贴板 (可直接贴入 Word / WPS / PPT / 微信 / 飞书)"
              >
                {copiedImage ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : isCopyingImage ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>{copiedImage ? '图片已复制' : '复制图片'}</span>
              </button>

              <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-3 w-[1px] mx-0.5" />

              {/* Hand Tool (Pan Mode) */}
              <button
                type="button"
                onClick={() => setPanMode(!panMode)}
                style={
                  panMode
                    ? { backgroundColor: 'var(--ov-accent)', borderColor: 'var(--ov-accent)', color: '#ffffff' }
                    : { backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)' }
                }
                className="p-1 rounded transition border hover:text-[var(--ov-text)] cursor-pointer"
                title={panMode ? '抓手平移模式已激活 (拖拽画布平移)' : '开启抓手平移模式 (或按住 Shift 拖动)'}
              >
                <Hand className="w-3.5 h-3.5" />
              </button>

              <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-3 w-[1px] mx-0.5" />

              {/* Zoom Controls */}
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}
                style={{ color: 'var(--ov-text-secondary)' }}
                className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded cursor-pointer"
                title="缩小 (Ctrl + 滚轮向下)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[var(--ov-accent)] text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(3.5, z + 0.15))}
                style={{ color: 'var(--ov-text-secondary)' }}
                className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded cursor-pointer"
                title="放大 (Ctrl + 滚轮向上)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetViewport}
                style={{ color: 'var(--ov-text-secondary)' }}
                className="p-1 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] rounded cursor-pointer"
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
                      className="px-3 py-1.5 rounded font-medium hover:opacity-90 cursor-pointer"
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
                      className="px-3 py-1.5 rounded border hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] cursor-pointer"
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
      <PlantUmlTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApplyTemplate={handleApplyTemplate}
      />
    </div>
  );
};
