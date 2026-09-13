/**
 * OmniView SVG 顶层操作与转换工具栏 (SVG Studio Toolbar)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Columns2,
  Eye,
  Code,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Grid,
  Download,
  Copy,
  Check,
  ChevronDown,
  Layers,
  FileType,
  Sparkles,
  Image as ImageIcon,
  Share2,
  Crosshair,
} from 'lucide-react';
import { SvgStats, exportSvgAsPng } from './svgUtils';
import { SvgBgMode } from './SvgCanvas';

export type SvgViewMode = 'split' | 'visual' | 'code';

interface SvgToolbarProps {
  viewMode: SvgViewMode;
  setViewMode: (mode: SvgViewMode) => void;
  splitRatio: number;
  setSplitRatio: (ratio: number) => void;
  stats: SvgStats;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitZoom: () => void;
  bgMode: SvgBgMode;
  setBgMode: (mode: SvgBgMode) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  fileName: string;
  svgContent: string;
  onCopySvg: () => void;
  onCopyReact: () => void;
  onCopyVue: () => void;
  onCopyDataUri: () => void;
  onDownloadSvg: () => void;
  inspectorActive?: boolean;
  onToggleInspector?: () => void;
}

export const SvgToolbar: React.FC<SvgToolbarProps> = ({
  viewMode,
  setViewMode,
  splitRatio,
  setSplitRatio,
  stats,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitZoom,
  bgMode,
  setBgMode,
  showGrid,
  setShowGrid,
  fileName,
  svgContent,
  onCopySvg,
  onCopyReact,
  onCopyVue,
  onCopyDataUri,
  onDownloadSvg,
  inspectorActive = false,
  onToggleInspector,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const triggerCopyFeedback = (label: string, callback: () => void) => {
    callback();
    setCopiedAction(label);
    setShowExportMenu(false);
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handleDownloadPng = async () => {
    try {
      await exportSvgAsPng(svgContent, fileName, 2);
      setShowExportMenu(false);
    } catch (e) {
      console.error('Failed to export PNG', e);
    }
  };

  return (
    <div id="svg-studio-toolbar" className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-xs gap-2 select-none z-30">
      {/* 视图模式与分屏比例调节 */}
      <div className="flex items-center gap-2.5">
        {/* 视口布局切换三态 */}
        <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/80 shadow-inner">
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
              viewMode === 'split'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="双向分屏编辑 (Split Mode)"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">分屏联动</span>
          </button>
          <button
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
              viewMode === 'visual'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="仅矢量画布 (Canvas Only)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">矢量画布</span>
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
              viewMode === 'code'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="仅代码编辑 (Code Only)"
          >
            <Code className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">XML 源码</span>
          </button>
        </div>

        {/* 分屏比例快捷预设 */}
        {viewMode === 'split' && (
          <div className="hidden md:flex items-center gap-1 bg-slate-800/60 rounded-md p-0.5 border border-slate-700/50 text-[11px] text-slate-400">
            <button
              onClick={() => setSplitRatio(30)}
              className={`px-1.5 py-0.5 rounded transition ${
                Math.round(splitRatio) === 30 ? 'bg-slate-700 text-cyan-300 font-semibold' : 'hover:text-slate-200'
              }`}
              title="代码 30% : 画布 70%"
            >
              3:7
            </button>
            <button
              onClick={() => setSplitRatio(50)}
              className={`px-1.5 py-0.5 rounded transition ${
                Math.round(splitRatio) === 50 ? 'bg-slate-700 text-cyan-300 font-semibold' : 'hover:text-slate-200'
              }`}
              title="代码 50% : 画布 50%"
            >
              5:5
            </button>
            <button
              onClick={() => setSplitRatio(70)}
              className={`px-1.5 py-0.5 rounded transition ${
                Math.round(splitRatio) === 70 ? 'bg-slate-700 text-cyan-300 font-semibold' : 'hover:text-slate-200'
              }`}
              title="代码 70% : 画布 30%"
            >
              7:3
            </button>
          </div>
        )}

        {/* 矢量元数据徽章 */}
        <div className="hidden xl:flex items-center gap-2 text-slate-400 font-mono text-[11px] border-l border-slate-800 pl-3">
          <span>viewBox: <strong className="text-cyan-400 font-normal">{stats.viewBox}</strong></span>
          <span>·</span>
          <span>节点: <strong className="text-purple-400 font-normal">{stats.elementCount}</strong></span>
          <span>·</span>
          <span>路径: <strong className="text-emerald-400 font-normal">{stats.pathCount}</strong></span>
          <span>·</span>
          <span className="text-slate-500">{(stats.byteSize / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {/* 右侧交互控制器与导出 */}
      <div className="flex items-center gap-1.5">
        {/* 画布缩放控制器 (在分屏或画布模式下呈现) */}
        {viewMode !== 'code' && (
          <div className="flex items-center gap-1">
            <button
              onClick={onZoomOut}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
              title="缩小 (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span
              onClick={onResetZoom}
              className="font-mono text-cyan-400 min-w-[50px] text-center font-semibold cursor-pointer hover:underline text-[11px]"
              title="点击重置为 100%"
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={onZoomIn}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
              title="放大 (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetZoom}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
              title="还原 1:1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFitZoom}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 transition"
              title="自适应画布"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

            {/* 画布底板背景模式 */}
            <select
              value={bgMode}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBgMode(e.target.value as SvgBgMode)}
              className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded border border-slate-700 outline-none cursor-pointer hidden sm:block"
            >
              <option value="dark-grid">深色网格</option>
              <option value="light-grid">浅色网格</option>
              <option value="slate">纯黑底板</option>
              <option value="white">纯白底板</option>
              <option value="transparent">经典透光棋盘</option>
            </select>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded border border-slate-700/60 transition ${
                showGrid ? 'bg-blue-600/30 text-blue-400 border-blue-500/50' : 'bg-slate-800 text-slate-400'
              }`}
              title="开启/关闭辅助坐标网格"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            {/* Scheme B: 图元检视器开关 */}
            {onToggleInspector && (
              <button
                id="svg-toggle-inspector-btn"
                onClick={onToggleInspector}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition ${
                  inspectorActive
                    ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-950/50 font-medium'
                    : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-700'
                }`}
                title="图元检视器 (点选图元微调颜色、描边、图层或在代码中高亮定位)"
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">检视微调</span>
                {inspectorActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* 开发者导出与转换下拉菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-md transition shadow-sm font-medium"
            title="导出与代码转换"
            aria-label="导出 / 转换"
          >
            {copiedAction ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedAction ? `已复制: ${copiedAction}` : '导出 / 转换'}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                代码生成与转换 (Code Generation)
              </div>
              <button
                onClick={() => triggerCopyFeedback('React JSX', onCopyReact)}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
              >
                <FileType className="w-4 h-4 text-cyan-400" />
                <div className="flex-1">
                  <div className="font-medium">复制为 React JSX 组件</div>
                  <div className="text-[10px] text-slate-400">TypeScript CamelCase Props</div>
                </div>
              </button>
              <button
                onClick={() => triggerCopyFeedback('Vue 3', onCopyVue)}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <div className="flex-1">
                  <div className="font-medium">复制为 Vue 3 组件</div>
                  <div className="text-[10px] text-slate-400">SFC &lt;template&gt; 格式</div>
                </div>
              </button>
              <button
                onClick={() => triggerCopyFeedback('Data URI', onCopyDataUri)}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <div className="flex-1">
                  <div className="font-medium">复制为 Data URI</div>
                  <div className="text-[10px] text-slate-400">Base64 嵌入式图片格式</div>
                </div>
              </button>
              <button
                onClick={() => triggerCopyFeedback('SVG XML', onCopySvg)}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
              >
                <Copy className="w-4 h-4 text-blue-400" />
                <div className="flex-1">
                  <div className="font-medium">复制纯净 SVG XML</div>
                  <div className="text-[10px] text-slate-400">标准矢量图源代码</div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-800" />
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                文件下载 (Asset Download)
              </div>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onDownloadSvg();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                <div className="flex-1">
                  <div className="font-medium">下载 .svg 矢量图</div>
                  <div className="text-[10px] text-slate-400">保存至本地文件</div>
                </div>
              </button>
              <button
                onClick={handleDownloadPng}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 transition text-left"
              >
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <div className="flex-1">
                  <div className="font-medium">导出 2x 高清 PNG 位图</div>
                  <div className="text-[10px] text-slate-400">Retina 超采样栅格化</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
