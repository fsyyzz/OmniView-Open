/**
 * OmniView Excalidraw 手绘白板工作室组件 (MVP 第一阶段)
 * 支持：
 * 1. 纯端侧基于 @excalidraw/utils 高保真渲染 SVG
 * 2. 分屏联动 (Split) / 画布模式 (Visual) / JSON 源码模式 (Source)
 * 3. 视口平移与滚轮缩放、自适应居中、底板网格切换
 * 4. 导出为 .svg、.png、.excalidraw JSON，以及复制 SVG / JSON 到剪贴板
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
  Palette,
  Loader2,
} from 'lucide-react';
import { Locale } from '../../../../shared/lib/i18n';
import { ThemeId } from '../../../../shared/types';
import {
  parseExcalidrawJson,
  renderExcalidrawToSvgString,
  downloadBlob,
} from './excalidraw/excalidrawEngine';

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
  // 模式：分屏 / 画布 / 源码
  const [viewMode, setViewMode] = useState<'split' | 'visual' | 'code'>('split');

  // 画布视口缩放与平移
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 渲染产物与状态
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 复制与导出提示
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // 同步外部传入的 content
  useEffect(() => {
    setSourceText(content);
  }, [content]);

  // 解析 JSON 结构
  const parsedData = useMemo(() => {
    return parseExcalidrawJson(sourceText);
  }, [sourceText]);

  // 异步生成 SVG
  useEffect(() => {
    let isCancelled = false;

    if (!parsedData.isValid) {
      setRenderError(parsedData.errorMessage || '无效的 Excalidraw JSON 数据');
      setIsLoading(false);
      return;
    }

    setRenderError(null);
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { svgString } = await renderExcalidrawToSvgString(parsedData, {
          isDarkTheme,
          padding: 40,
        });

        if (!isCancelled) {
          setRenderedSvg(svgString);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setRenderError(err?.message || 'Excalidraw 渲染失败');
          setIsLoading(false);
        }
      }
    }, 120);

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

  // 画布平移交互
  const handleMouseDown = (e: React.MouseEvent) => {
    // 允许中键或左键拖拽视口
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

  // 滚轮缩放与平移
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

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleFitZoom = () => {
    setScale(0.9);
    setPosition({ x: 0, y: 0 });
  };

  // 源码变更
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

  // 复制反馈
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
  };

  const handleExportExcalidrawFile = () => {
    const blob = new Blob([sourceText], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, fileName.endsWith('.excalidraw') ? fileName : `${fileName}.excalidraw`);
  };

  const handleCopySvgXml = async () => {
    if (!renderedSvg) return;
    await navigator.clipboard.writeText(renderedSvg);
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(sourceText);
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-200 select-none overflow-hidden">
      {/* 顶部工具条 */}
      <div className="flex-shrink-0 h-11 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 z-20">
        {/* 左侧：标题与三态切换 */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-xs text-slate-200">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="truncate max-w-[150px] sm:max-w-xs">{fileName}</span>
            <span className="text-[10px] text-amber-300 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Excalidraw
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* 模式切换 (分屏 / 预览 / 源码) */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'split' ? 'bg-amber-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="双向分屏模式 (左侧 JSON / 右侧手绘白板)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">分屏联动</span>
            </button>
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'visual' ? 'bg-amber-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="纯手绘白板画布预览"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">白板画布</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                viewMode === 'code' ? 'bg-amber-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="JSON 源码编辑模式"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">源码编辑</span>
            </button>
          </div>

          {/* 图元统计 */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400 ml-2">
            <span>图元: <strong className="text-amber-400 font-normal">{parsedData.elements.length}</strong></span>
            {parsedData.files && (
              <span>· 资源: <strong className="text-cyan-400 font-normal">{Object.keys(parsedData.files).length}</strong></span>
            )}
          </div>
        </div>

        {/* 右侧：缩放控制器与导出菜单 */}
        <div className="flex items-center gap-1.5">
          {viewMode !== 'code' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setScale(s => Math.max(0.2, Number((s - 0.1).toFixed(2))))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title="缩小"
                aria-label="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span
                onClick={handleResetZoom}
                className="font-mono text-amber-400 min-w-[48px] text-center font-semibold cursor-pointer hover:underline text-[11px]"
                title="点击重置为 100%"
              >
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(s => Math.min(4, Number((s + 0.1).toFixed(2))))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title="放大"
                aria-label="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title="重置视角 (1:1)"
                aria-label="重置视角"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleFitZoom}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
                title="自适应画布"
                aria-label="自适应画布"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 rounded border border-slate-700/60 transition ${
                  showGrid ? 'bg-amber-600/30 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-400'
                }`}
                title="开启/关闭辅助坐标网格"
                aria-label="辅助网格"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {viewMode === 'code' && (
            <button
              onClick={handlePrettifyJson}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60 text-xs transition"
              title="格式化 JSON 源码"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>美化 JSON</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* 导出菜单 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-md transition shadow-sm font-medium text-xs"
              title="导出手绘白板图"
              aria-label="导出"
            >
              {copiedAction ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedAction ? `已复制: ${copiedAction}` : '导出 / 复制'}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  图形与文件导出
                </div>
                <button
                  onClick={handleExportSvgFile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">导出为 .SVG 矢量图</div>
                    <div className="text-[10px] text-slate-400">保留手绘笔触与文本矢量</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPngFile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1">
                    <div className="font-medium">导出为 .PNG 高清位图</div>
                    <div className="text-[10px] text-slate-400">2x Retina 栅格化位图</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcalidrawFile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-4 h-4 text-orange-400" />
                  <div className="flex-1">
                    <div className="font-medium">导出为 .excalidraw 原生文件</div>
                    <div className="text-[10px] text-slate-400">兼容官方 Web 客户端</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-800" />
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  快速复制至剪贴板
                </div>
                <button
                  onClick={() => triggerCopyFeedback('SVG XML', handleCopySvgXml)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">复制 SVG 代码</div>
                    <div className="text-[10px] text-slate-400">用于插入网页或 Markdown</div>
                  </div>
                </button>
                <button
                  onClick={() => triggerCopyFeedback('JSON', handleCopyJson)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Copy className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <div className="font-medium">复制 Excalidraw JSON</div>
                    <div className="text-[10px] text-slate-400">完整图元数据树</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体交互区域 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧：JSON 源码编辑器 */}
        {(viewMode === 'split' || viewMode === 'code') && (
          <div
            className={`flex flex-col border-r border-slate-800 bg-slate-950 min-h-0 ${
              viewMode === 'split' ? 'w-full md:w-1/2' : 'w-full'
            }`}
          >
            <div className="flex-shrink-0 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Excalidraw JSON 数据源</span>
              </span>
              <span>{sourceText.length} 字符</span>
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
          </div>
        )}

        {/* 右侧：白板画布视口 */}
        {(viewMode === 'split' || viewMode === 'visual') && (
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
            {/* 辅助网格 CSS 类在工程 global 中已定义 */}

            {/* 加载指示 */}
            {isLoading && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-amber-300 shadow-lg backdrop-blur-sm animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>正在编译手绘图元...</span>
              </div>
            )}

            {/* 错误提示 */}
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
                  提示：请检查左侧 JSON 语法，确保包含合法的 elements 列表。
                </div>
              </div>
            ) : (
              /* 手绘白板 SVG 矢量渲染层 */
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

            {/* 底部状态提示条 */}
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
    </div>
  );
};
