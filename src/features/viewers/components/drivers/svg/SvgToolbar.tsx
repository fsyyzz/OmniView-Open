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
import { useContainerWidth } from '../../../hooks/useContainerWidth';

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
  const [toolbarRef, toolbarWidth] = useContainerWidth<HTMLDivElement>(800);
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

  const showModeLabels = toolbarWidth >= 760;
  const showSplitPresets = toolbarWidth >= 660;
  const showBgSelect = toolbarWidth >= 540;
  const showExportText = toolbarWidth >= 460;

  return (
    <div
      ref={toolbarRef}
      id="svg-studio-toolbar"
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderBottomColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="flex flex-wrap items-center justify-between px-3.5 py-2 border-b text-xs gap-2 select-none z-30 min-w-0"
    >
      {/* 视图模式与分屏比例调节 */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* 视口布局切换三态 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
          }}
          className="flex items-center rounded-lg p-0.5 border shadow-inner"
        >
          <button
            onClick={() => setViewMode('split')}
            style={{
              backgroundColor: viewMode === 'split' ? 'var(--ov-accent, #3b82f6)' : 'transparent',
              color: viewMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition font-medium`}
            title="双向分屏编辑 (Split Mode)"
            aria-label="分屏联动"
          >
            <Columns2 className="w-3.5 h-3.5" />
            {showModeLabels && <span>分屏联动</span>}
          </button>
          <button
            onClick={() => setViewMode('visual')}
            style={{
              backgroundColor: viewMode === 'visual' ? 'var(--ov-accent, #3b82f6)' : 'transparent',
              color: viewMode === 'visual' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition font-medium`}
            title="仅矢量画布 (Canvas Only)"
            aria-label="矢量画布"
          >
            <Eye className="w-3.5 h-3.5" />
            {showModeLabels && <span>矢量画布</span>}
          </button>
          <button
            onClick={() => setViewMode('code')}
            style={{
              backgroundColor: viewMode === 'code' ? 'var(--ov-accent, #3b82f6)' : 'transparent',
              color: viewMode === 'code' ? '#ffffff' : 'var(--ov-text-secondary)',
            }}
            className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition font-medium`}
            title="仅代码编辑 (Code Only)"
            aria-label="XML 源码"
          >
            <Code className="w-3.5 h-3.5" />
            {showModeLabels && <span>XML 源码</span>}
          </button>
        </div>

        {/* 分屏比例快捷预设 */}
        {viewMode === 'split' && showSplitPresets && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="flex items-center gap-1 rounded-md p-0.5 border text-[11px]"
          >
            <button
              onClick={() => setSplitRatio(30)}
              style={{
                backgroundColor: Math.round(splitRatio) === 30 ? 'var(--ov-surface)' : 'transparent',
                color: Math.round(splitRatio) === 30 ? 'var(--ov-accent, #06b6d4)' : 'var(--ov-text-secondary)',
              }}
              className="px-1.5 py-0.5 rounded transition font-medium"
              title="代码 30% : 画布 70%"
            >
              3:7
            </button>
            <button
              onClick={() => setSplitRatio(50)}
              style={{
                backgroundColor: Math.round(splitRatio) === 50 ? 'var(--ov-surface)' : 'transparent',
                color: Math.round(splitRatio) === 50 ? 'var(--ov-accent, #06b6d4)' : 'var(--ov-text-secondary)',
              }}
              className="px-1.5 py-0.5 rounded transition font-medium"
              title="代码 50% : 画布 50%"
            >
              5:5
            </button>
            <button
              onClick={() => setSplitRatio(70)}
              style={{
                backgroundColor: Math.round(splitRatio) === 70 ? 'var(--ov-surface)' : 'transparent',
                color: Math.round(splitRatio) === 70 ? 'var(--ov-accent, #06b6d4)' : 'var(--ov-text-secondary)',
              }}
              className="px-1.5 py-0.5 rounded transition font-medium"
              title="代码 70% : 画布 30%"
            >
              7:3
            </button>
          </div>
        )}

        {/* 矢量元数据徽章 */}
        <div
          style={{
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text-secondary)',
          }}
          className="hidden xl:flex items-center gap-2 font-mono text-[11px] border-l pl-3"
        >
          <span>viewBox: <strong className="text-cyan-400 font-normal">{stats.viewBox}</strong></span>
          <span>·</span>
          <span>节点: <strong className="text-purple-400 font-normal">{stats.elementCount}</strong></span>
          <span>·</span>
          <span>路径: <strong className="text-emerald-400 font-normal">{stats.pathCount}</strong></span>
          <span>·</span>
          <span style={{ color: 'var(--ov-text-muted)' }}>{(stats.byteSize / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {/* 右侧交互控制器与导出 */}
      <div className="flex items-center gap-1.5">
        {/* 画布缩放控制器 (在分屏或画布模式下呈现) */}
        {viewMode !== 'code' && (
          <div className="flex items-center gap-1">
            <button
              onClick={onZoomOut}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="p-1.5 rounded border transition hover:opacity-80"
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
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="p-1.5 rounded border transition hover:opacity-80"
              title="放大 (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetZoom}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="p-1.5 rounded border transition hover:opacity-80"
              title="还原 1:1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onFitZoom}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="p-1.5 rounded border transition hover:opacity-80"
              title="自适应画布"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>

            {showBgSelect && <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-4 w-px mx-1" />}

            {/* 画布底板背景模式 */}
            {showBgSelect && (
              <select
                value={bgMode}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBgMode(e.target.value as SvgBgMode)}
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="text-xs px-2 py-1 rounded border outline-none cursor-pointer"
              >
                <option value="dark-grid">深色网格</option>
                <option value="light-grid">浅色网格</option>
                <option value="slate">纯黑底板</option>
                <option value="white">纯白底板</option>
                <option value="transparent">经典透光棋盘</option>
              </select>
            )}

            <button
              onClick={() => setShowGrid(!showGrid)}
              style={{
                backgroundColor: showGrid ? 'rgba(59, 130, 246, 0.2)' : 'var(--ov-surface-header)',
                borderColor: showGrid ? 'var(--ov-accent, #3b82f6)' : 'var(--ov-border)',
                color: showGrid ? 'var(--ov-accent, #38bdf8)' : 'var(--ov-text-secondary)',
              }}
              className="p-1.5 rounded border transition"
              title="开启/关闭辅助坐标网格"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            {/* Scheme B: 图元检视器开关 */}
            {onToggleInspector && (
              <button
                id="svg-toggle-inspector-btn"
                onClick={onToggleInspector}
                style={{
                  backgroundColor: inspectorActive ? 'rgba(6, 182, 212, 0.2)' : 'var(--ov-surface-header)',
                  borderColor: inspectorActive ? 'rgba(6, 182, 212, 0.6)' : 'var(--ov-border)',
                  color: inspectorActive ? '#67e8f9' : 'var(--ov-text)',
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition font-medium"
                title="图元检视器 (点选图元微调颜色、描边、图层或在代码中高亮定位)"
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                {showBgSelect && <span>检视微调</span>}
                {inspectorActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>
            )}
          </div>
        )}

        <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-4 w-px mx-1" />

        {/* 开发者导出与转换下拉菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              backgroundColor: 'var(--ov-accent, #3b82f6)',
              color: '#ffffff',
            }}
            className={`flex items-center gap-1.5 ${showExportText ? 'px-2 sm:px-3' : 'p-1.5'} py-1 hover:opacity-90 rounded-md transition shadow-sm font-medium`}
            title="导出与代码转换"
            aria-label="导出 / 转换"
          >
            {copiedAction ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
            {showExportText && <span>{copiedAction ? `已复制: ${copiedAction}` : '导出 / 转换'}</span>}
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showExportMenu && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
                boxShadow: 'var(--ov-shadow, 0 8px 24px rgba(0,0,0,0.36))',
              }}
              className="absolute right-0 mt-1.5 w-60 border rounded-lg py-1.5 z-50 text-xs animate-in fade-in zoom-in-95"
            >
              <div
                style={{
                  color: 'var(--ov-text-secondary)',
                  borderBottomColor: 'var(--ov-border)',
                }}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider border-b"
              >
                代码生成与转换 (Code Generation)
              </div>
              <button
                onClick={() => triggerCopyFeedback('React JSX', onCopyReact)}
                style={{ color: 'var(--ov-text)' }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition text-left"
              >
                <FileType className="w-4 h-4 text-cyan-400" />
                <div className="flex-1">
                  <div className="font-medium">复制为 React JSX 组件</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">TypeScript CamelCase Props</div>
                </div>
              </button>
              <button
                onClick={() => triggerCopyFeedback('Vue 3', onCopyVue)}
                style={{ color: 'var(--ov-text)' }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition text-left"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <div className="flex-1">
                  <div className="font-medium">复制为 Vue 3 组件</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">SFC &lt;template&gt; 格式</div>
                </div>
              </button>
              <button
                onClick={() => triggerCopyFeedback('Data URI', onCopyDataUri)}
                style={{ color: 'var(--ov-text)' }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition text-left"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <div className="flex-1">
                  <div className="font-medium">复制为 Data URI</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">Base64 嵌入式图片格式</div>
                </div>
              </button>
              <button
                onClick={() => triggerCopyFeedback('SVG XML', onCopySvg)}
                style={{ color: 'var(--ov-text)' }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition text-left"
              >
                <Copy className="w-4 h-4 text-blue-400" />
                <div className="flex-1">
                  <div className="font-medium">复制纯净 SVG XML</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">标准矢量图源代码</div>
                </div>
              </button>

              <div style={{ borderColor: 'var(--ov-border)' }} className="my-1 border-t" />
              <div
                style={{ color: 'var(--ov-text-secondary)' }}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
              >
                文件下载 (Asset Download)
              </div>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onDownloadSvg();
                }}
                style={{ color: 'var(--ov-text)' }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition text-left"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                <div className="flex-1">
                  <div className="font-medium">下载 .svg 矢量图</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">保存至本地文件</div>
                </div>
              </button>
              <button
                onClick={handleDownloadPng}
                style={{ color: 'var(--ov-text)' }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition text-left"
              >
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <div className="flex-1">
                  <div className="font-medium">导出 2x 高清 PNG 位图</div>
                  <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px]">Retina 超采样栅格化</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
