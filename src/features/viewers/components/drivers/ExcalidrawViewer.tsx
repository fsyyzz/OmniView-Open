/**
 * OmniView Excalidraw 手绘白板工作室组件 (Phase 2 完整双向交互与白板系统)
 * 支持：
 * 1. 完整画布双向交互式编辑 (Canvas Studio) - 支持手绘图元、矩形、椭圆、箭头、线条、文本、画笔、橡皮擦等全量工具
 * 2. 双向分屏联动 (Split) - 左侧 JSON 源码即时编辑 / 右侧交互白板实时响应
 * 3. 高保真只读演示 (Preview) - 矢量 SVG 纯净展示，支持平移拖拽与缩放
 * 4. JSON 源码编辑 (Source Code) - 全屏源码编辑与一键语法美化
 * 5. 辅助网格 (Grid)、禅模式 (Zen Mode)、只读锁定 (Lock) 与视口自动居中 (Fit Content)
 * 6. 多维度高品质导出：.svg 矢量、.png 2x 视网膜图、.excalidraw 原生工程文件及剪贴板互通
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Copy,
  Check,
  Download,
  Share2,
  ChevronDown,
  Columns,
  Eye,
  FileCode,
  AlertCircle,
  Sparkles,
  Grid,
  Loader2,
  PenTool,
  Lock,
  Unlock,
  Focus,
  LayoutTemplate,
  X,
} from 'lucide-react';
import { Locale } from '../../../../shared/lib/i18n';
import { ThemeId } from '../../../../shared/types';
import {
  parseExcalidrawJson,
  renderExcalidrawToSvgString,
  downloadBlob,
} from './excalidraw/excalidrawEngine';
import { ExcalidrawCanvas } from './excalidraw/ExcalidrawCanvas';
import { EXCALIDRAW_TEMPLATES, ExcalidrawTemplate } from './excalidraw/excalidrawTemplates';
import { RenderErrorBoundary } from '../common/RenderErrorBoundary';

export interface ExcalidrawViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  onContentChange?: (content: string) => void;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = ({
  content,
  fileName = 'drawing.excalidraw',
  locale = 'zh-CN',
  isDarkTheme = false,
  onContentChange,
}) => {
  // 编辑态 JSON 文本
  const [sourceText, setSourceText] = useState<string>(content);
  // 模式：交互白板 (canvas) / 双向分屏 (split) / 只读演示 (preview) / 源码编辑 (code)
  const [viewMode, setViewMode] = useState<'canvas' | 'split' | 'preview' | 'code'>('canvas');

  // 画布工具选项
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);

  // 只读预览视口缩放与平移
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Excalidraw Imperative API 引用
  const excalidrawApiRef = useRef<any>(null);

  // 渲染产物与状态
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [isLoadingSvg, setIsLoadingSvg] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 复制与导出反馈
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 同步外部传入的 content（例如打开不同文件或外部撤销恢复）
  useEffect(() => {
    setSourceText(content);
  }, [content]);

  // 解析 JSON 结构
  const parsedData = useMemo(() => {
    return parseExcalidrawJson(sourceText);
  }, [sourceText]);

  // 当处于预览或导出时，生成高保真 SVG 备份
  useEffect(() => {
    let isCancelled = false;

    if (!parsedData.isValid) {
      setRenderError(parsedData.errorMessage || '无效的 Excalidraw JSON 数据');
      setIsLoadingSvg(false);
      return;
    }

    setRenderError(null);
    setIsLoadingSvg(true);

    const timer = setTimeout(async () => {
      try {
        const { svgString } = await renderExcalidrawToSvgString(parsedData, {
          isDarkTheme,
          padding: 40,
        });

        if (!isCancelled) {
          setRenderedSvg(svgString);
          setIsLoadingSvg(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setRenderError(err?.message || 'Excalidraw 矢量解析失败');
          setIsLoadingSvg(false);
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [parsedData, isDarkTheme]);

  // 监听点击外部关闭导出菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showExportMenu]);

  // 切换模式时自动触发画布刷新以校准宽高尺寸
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        excalidrawApiRef.current?.refresh();
      } catch {
        // ignore
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [viewMode]);

  // 画布双向变动回写
  const handleCanvasDocChange = useCallback(
    (newJson: string) => {
      setSourceText(newJson);
      onContentChange?.(newJson);
    },
    [onContentChange]
  );

  // 源码直接输入变更
  const handleSourceChange = (newVal: string) => {
    setSourceText(newVal);
    onContentChange?.(newVal);
  };

  // 格式化 JSON
  const handlePrettifyJson = () => {
    try {
      const obj = JSON.parse(sourceText);
      const pretty = JSON.stringify(obj, null, 2);
      handleSourceChange(pretty);
    } catch {
      // ignore
    }
  };

  // 应用预置模板
  const handleApplyTemplate = (template: ExcalidrawTemplate) => {
    const jsonStr = JSON.stringify(template.data, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    setShowTemplatesModal(false);
  };

  // 居中视口（适应内容）
  const handleCenterView = () => {
    if (viewMode === 'preview') {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    try {
      if (excalidrawApiRef.current) {
        excalidrawApiRef.current.scrollToContent();
      }
    } catch {
      // 降级
    }
  };

  // 只读预览画布平移交互
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      startPanRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPosition({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.min(4, Math.max(0.2, Number((prev * zoomFactor).toFixed(2)))));
    } else {
      setPosition(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // 复制反馈辅助
  const triggerCopyFeedback = async (label: string, action: () => Promise<void> | void) => {
    try {
      await action();
      setCopiedAction(label);
      setTimeout(() => setCopiedAction(null), 1800);
      setShowExportMenu(false);
    } catch (e) {
      console.error(e);
    }
  };

  // 导出操作
  const handleExportSvgFile = () => {
    if (!renderedSvg) return;
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const name = fileName.replace(/\.(excalidraw|json)$/i, '') + '.svg';
    downloadBlob(blob, name);
    setShowExportMenu(false);
  };

  const handleExportPngFile = () => {
    if (!renderedSvg) return;
    const img = new Image();
    const svgBlob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.naturalWidth || 1200) * 2;
      canvas.height = (img.naturalHeight || 800) * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) {
            const name = fileName.replace(/\.(excalidraw|json)$/i, '') + '.png';
            downloadBlob(blob, name);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setShowExportMenu(false);
  };

  const handleExportExcalidrawFile = () => {
    const blob = new Blob([sourceText], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, fileName.endsWith('.excalidraw') ? fileName : `${fileName}.excalidraw`);
    setShowExportMenu(false);
  };

  const handleCopySvgXml = async () => {
    if (!renderedSvg) return;
    await navigator.clipboard.writeText(renderedSvg);
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(sourceText);
  };

  const isZh = locale === 'zh-CN';

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-200 select-none overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex-shrink-0 h-11 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 z-20">
        {/* 左侧：文件名、白板标签与模式切换 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-xs text-slate-200">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="truncate max-w-[130px] sm:max-w-xs">{fileName}</span>
            <span className="text-[10px] text-amber-300 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 hidden xs:inline-block">
              Excalidraw 2.0
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* 模式切换 (白板工作室 / 双向分屏 / 只读演示 / JSON 源码) */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'canvas'
                  ? 'bg-amber-600 text-white shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isZh ? '全屏交互白板工作室' : 'Full Whiteboard Canvas'}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isZh ? '交互白板' : 'Canvas'}</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'split'
                  ? 'bg-amber-600 text-white shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isZh ? '双向分屏模式 (左侧 JSON 源码 / 右侧即时白板)' : 'Bidirectional Split View'}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isZh ? '双向分屏' : 'Split'}</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'preview'
                  ? 'bg-amber-600 text-white shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isZh ? '只读矢量展示与平移缩放' : 'Read-only Presentation'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isZh ? '只读演示' : 'Preview'}</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'code'
                  ? 'bg-amber-600 text-white shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isZh ? 'JSON 源码编辑模式' : 'JSON Source Code'}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isZh ? '源码' : 'Source'}</span>
            </button>
          </div>

          {/* 图元统计 */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400 ml-1.5">
            <span>{isZh ? '图元:' : 'Elements:'} <strong className="text-amber-400 font-normal">{parsedData?.elements?.length ?? 0}</strong></span>
            {parsedData?.files && Object.keys(parsedData.files).length > 0 && (
              <span>· {isZh ? '资源:' : 'Files:'} <strong className="text-cyan-400 font-normal">{Object.keys(parsedData.files).length}</strong></span>
            )}
          </div>
        </div>

        {/* 右侧：画布快捷工具与导出菜单 */}
        <div className="flex items-center gap-1.5">
          {/* 白板通用功能：居中、网格、禅模式、锁定 */}
          {viewMode !== 'code' && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCenterView}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title={isZh ? '视口自适应居中全部图元' : 'Fit to Content'}
                aria-label="居中视口"
              >
                <Focus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 rounded border border-slate-700/60 transition ${
                  showGrid ? 'bg-amber-600/30 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-400'
                }`}
                title={isZh ? '开启/关闭绘图网格' : 'Toggle Grid'}
                aria-label="网格模式"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsZenMode(!isZenMode)}
                className={`p-1.5 rounded border border-slate-700/60 transition ${
                  isZenMode ? 'bg-amber-600/30 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-400'
                }`}
                title={isZh ? '专注/禅模式 (隐藏冗余界面)' : 'Zen Mode'}
                aria-label="禅模式"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsViewOnly(!isViewOnly)}
                className={`p-1.5 rounded border border-slate-700/60 transition ${
                  isViewOnly ? 'bg-blue-600/30 text-blue-300 border-blue-500/50' : 'bg-slate-800 text-slate-400'
                }`}
                title={isZh ? (isViewOnly ? '已只读锁定 (点击解锁编辑)' : '点击锁定为只读') : (isViewOnly ? 'Locked (Click to edit)' : 'Click to lock')}
                aria-label="只读锁定"
              >
                {isViewOnly ? <Lock className="w-3.5 h-3.5 text-blue-400" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* 处于预览模式下的专属缩放控制器 */}
          {viewMode === 'preview' && (
            <div className="flex items-center gap-1 border-l border-slate-800 pl-1.5">
              <button
                onClick={() => setScale(s => Math.max(0.2, Number((s - 0.1).toFixed(2))))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title={isZh ? '缩小' : 'Zoom Out'}
                aria-label="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span
                onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                className="font-mono text-amber-400 min-w-[42px] text-center font-semibold cursor-pointer hover:underline text-[11px]"
                title="点击重置 100%"
              >
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(s => Math.min(4, Number((s + 0.1).toFixed(2))))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title={isZh ? '放大' : 'Zoom In'}
                aria-label="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title={isZh ? '重置视角' : 'Reset View'}
                aria-label="重置视角"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 处于源码模式下的格式化按钮 */}
          {viewMode === 'code' && (
            <button
              onClick={handlePrettifyJson}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60 text-xs transition"
              title="格式化 JSON 源码"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isZh ? '美化 JSON' : 'Prettify'}</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* 预置模板库按钮 */}
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-amber-500/30 text-xs transition"
            title={isZh ? '选择架构图/流程图/思维导图预置模板' : 'Whiteboard Starter Templates'}
            aria-label="预置模板"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isZh ? '预置模板' : 'Templates'}</span>
          </button>

          {/* 统一导出与复制菜单 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-md transition shadow-sm font-medium text-xs"
              title="导出手绘白板图与文件"
              aria-label="导出"
            >
              {copiedAction ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {copiedAction ? `${isZh ? '已复制' : 'Copied'}: ${copiedAction}` : (isZh ? '导出 / 分享' : 'Export')}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  {isZh ? '图形与文件导出' : 'File Export'}
                </div>
                <button
                  onClick={handleExportSvgFile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .SVG 矢量图' : 'Export as .SVG'}</div>
                    <div className="text-[10px] text-slate-400">{isZh ? '保留完整手绘笔触与矢量图元' : 'Vector format'}</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPngFile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .PNG 高清位图' : 'Export as .PNG'}</div>
                    <div className="text-[10px] text-slate-400">{isZh ? '2x 视网膜清晰度' : 'Retina raster image'}</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcalidrawFile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-4 h-4 text-orange-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .excalidraw 原生文件' : 'Export .excalidraw file'}</div>
                    <div className="text-[10px] text-slate-400">{isZh ? '直接兼容官方 Web 客户端' : 'Compatible with excalidraw.com'}</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-800" />
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {isZh ? '快速复制至剪贴板' : 'Clipboard'}
                </div>
                <button
                  onClick={() => triggerCopyFeedback('SVG XML', handleCopySvgXml)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '复制 SVG 代码' : 'Copy SVG XML'}</div>
                    <div className="text-[10px] text-slate-400">{isZh ? '用于插入网页或 Markdown' : 'Paste into HTML/Markdown'}</div>
                  </div>
                </button>
                <button
                  onClick={() => triggerCopyFeedback('JSON', handleCopyJson)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Copy className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '复制 Excalidraw JSON' : 'Copy Document JSON'}</div>
                    <div className="text-[10px] text-slate-400">{isZh ? '完整图元数据树' : 'Raw elements data'}</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体交互区域 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧：JSON 源码编辑器（分屏或源码全屏模式） */}
        {(viewMode === 'split' || viewMode === 'code') && (
          <div
            className={`flex flex-col border-r border-slate-800 bg-slate-950 min-h-0 ${
              viewMode === 'split' ? 'w-full md:w-2/5 lg:w-1/3' : 'w-full'
            }`}
          >
            <div className="flex-shrink-0 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Excalidraw JSON 数据源</span>
              </span>
              <span>{sourceText?.length ?? 0} 字符</span>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <textarea
                value={sourceText}
                onChange={e => handleSourceChange(e.target.value)}
                placeholder="在此粘贴或编辑 Excalidraw JSON 结构..."
                spellCheck={false}
                className="w-full h-full bg-slate-900/80 text-amber-100/90 font-mono text-xs p-3 rounded-lg border border-slate-800 outline-none focus:border-amber-500/60 resize-none leading-relaxed transition shadow-inner"
              />
            </div>
            {!parsedData.isValid && (
              <div className="px-3 py-2 bg-red-950/80 border-t border-red-800 text-[11px] text-red-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                <span className="truncate">{parsedData.errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* 交互白板主画布（白板工作室模式与分屏模式） */}
        {(viewMode === 'canvas' || viewMode === 'split') && (
          <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-slate-900">
            <RenderErrorBoundary
              blockName="Excalidraw Whiteboard Canvas"
              fallback={
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-300 gap-3">
                  <div className="text-amber-400 font-semibold text-sm">手绘白板画布初始化容错回退</div>
                  <div className="text-xs text-slate-400 max-w-md text-center">
                    当前图元在白板引擎交互模式下遇到异常，您仍可使用顶部的“只读演示”、“分屏”或“源码”模式查看与编辑完整数据。
                  </div>
                  <button
                    onClick={() => setViewMode('preview')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition"
                  >
                    切换到 SVG 矢量只读演示
                  </button>
                </div>
              }
            >
              <ExcalidrawCanvas
                key={fileName}
                initialParsedData={parsedData}
                isDarkTheme={isDarkTheme}
                locale={locale}
                showGrid={showGrid}
                isZenMode={isZenMode}
                isViewOnly={isViewOnly}
                onDocChange={handleCanvasDocChange}
                onApiReady={(api) => {
                  excalidrawApiRef.current = api;
                }}
              />
            </RenderErrorBoundary>
          </div>
        )}

        {/* 只读演示画布（只读展示模式） */}
        {viewMode === 'preview' && (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing ${
              isDarkTheme ? 'bg-[#121212]' : 'bg-[#fafafa]'
            } ${showGrid ? (isDarkTheme ? 'ov-svg-grid-dark' : 'ov-svg-grid-light') : ''}`}
            style={{ touchAction: 'none' }}
          >
            {isLoadingSvg && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-amber-300 shadow-lg backdrop-blur-sm animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>正在编译手绘图元...</span>
              </div>
            )}

            {renderError ? (
              <div className="max-w-md p-5 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 shadow-2xl backdrop-blur-sm flex flex-col gap-2.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Excalidraw 格式解析异常</span>
                </div>
                <div className="font-mono text-xs text-red-300/80 break-words leading-relaxed">
                  {renderError}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  提示：请切换至源码或分屏模式检查 JSON 语法。
                </div>
              </div>
            ) : (
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.08s ease-out',
                }}
                className="select-none flex items-center justify-center shadow-xl rounded-lg p-2"
                dangerouslySetInnerHTML={{ __html: renderedSvg }}
              />
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 font-mono pointer-events-none backdrop-blur-sm">
              <span>滚轮 / 拖拽平移</span>
              <span>·</span>
              <span>Ctrl + 滚轮缩放</span>
              <span>·</span>
              <span>缩放: {Math.round(scale * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 预置模板弹窗 */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  {isZh ? '选择 Excalidraw 预置模板' : 'Choose Starter Template'}
                </h3>
              </div>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {EXCALIDRAW_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className="group relative p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900/80 cursor-pointer transition flex flex-col justify-between gap-3 shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-xs text-slate-100 group-hover:text-amber-300 transition">
                        {isZh ? template.name : template.nameEn}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {template?.data?.elements?.length ?? 0} 图元
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {isZh ? template.description : template.descriptionEn}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-amber-400 font-medium">
                    <span>{isZh ? '点击载入此模板' : 'Load Template'}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-transform transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{isZh ? '⚠️ 载入模板将替换当前画面的内容' : '⚠️ Loading a template will overwrite current drawing'}</span>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
