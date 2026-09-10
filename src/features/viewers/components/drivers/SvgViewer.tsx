/**
 * OmniView 矢量图形驱动与双向分屏编辑器 (SVG Vector Driver & Split Studio)
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  parseSvgStats,
  validateSvg,
  prettifySvg,
  optimizeSvg,
  convertSvgToReact,
  convertSvgToVue,
  convertSvgToDataUri,
  getSvgElementInfo,
  updateSvgElement,
  removeSvgElement,
  moveSvgElement,
  moveSvgElementGeometry,
  alignSvgElement,
  alignLineOrthogonal,
  reverseLineEndpoints,
  convertLineToStepPath,
  applyLinePreset,
  LinePresetType,
  resizeSvgElementGeometry,
  CalculatedResizeBBox,
  ElementBBox,
  SvgElementInfo,
} from './svg/svgUtils';
import { SvgCanvas, SvgBgMode } from './svg/SvgCanvas';
import { SvgCodeEditor } from './svg/SvgCodeEditor';
import { SvgToolbar, SvgViewMode } from './svg/SvgToolbar';

export interface SvgViewerProps {
  content: string;
  fileName?: string;
  fileSize?: number;
  locale?: 'zh-CN' | 'en-US';
  onContentChange?: (newContent: string) => void;
}

export const SvgViewer: React.FC<SvgViewerProps> = ({
  content,
  fileName = 'graphic.svg',
  fileSize = 0,
  onContentChange,
}) => {
  // 编辑态源码
  const [code, setCode] = useState<string>(content);

  // 视口缩放与平移
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bgMode, setBgMode] = useState<SvgBgMode>('dark-grid');
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // 优化提示信息
  const [optimizeToast, setOptimizeToast] = useState<string | null>(null);

  // Scheme B: 点选图元检视与微调系统状态
  const [inspectorActive, setInspectorActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('omniview_svg_inspector_active') === 'true';
    } catch {}
    return true; // 默认开启检视器微调体验
  });
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);

  // 视图模式：分屏 (split) / 仅画布 (visual) / 仅代码 (code)
  const [viewMode, setViewMode] = useState<SvgViewMode>(() => {
    try {
      const saved = localStorage.getItem('omniview_svg_view_mode');
      if (saved === 'split' || saved === 'visual' || saved === 'code') {
        return saved;
      }
    } catch {}
    return 'split';
  });

  // 分屏比例 (代码编辑区所占百分比)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('omniview_svg_split_ratio');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 15 && val <= 85) return val;
      }
    } catch {}
    return 45;
  });

  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const studioRef = useRef<HTMLDivElement>(null);

  // 当外部文件内容重载时，同步本地状态
  useEffect(() => {
    setCode(content);
  }, [content]);

  // 持久化布局偏好
  useEffect(() => {
    try {
      localStorage.setItem('omniview_svg_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('omniview_svg_split_ratio', String(splitRatio));
    } catch {}
  }, [splitRatio]);

  // 元数据与语法合法性计算
  const stats = useMemo(() => parseSvgStats(code), [code]);
  const validation = useMemo(() => validateSvg(code), [code]);

  // 派生当前选中的图元数据对象
  const selectedElementInfo = useMemo(() => {
    if (selectedElementIndex === null) return null;
    return getSvgElementInfo(code, selectedElementIndex);
  }, [code, selectedElementIndex]);

  // 代码更新回调通知外部持久层
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (onContentChange) {
        onContentChange(newCode);
      }
    },
    [onContentChange]
  );

  // Scheme B: 切换检视模式
  const handleToggleInspector = useCallback(() => {
    setInspectorActive(prev => {
      const next = !prev;
      if (!next) {
        setSelectedElementIndex(null);
        setHighlightLine(null);
      }
      try {
        localStorage.setItem('omniview_svg_inspector_active', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Scheme B: 选中图元
  const handleSelectElement = useCallback(
    (index: number | null) => {
      setSelectedElementIndex(index);
      if (index !== null) {
        const info = getSvgElementInfo(code, index);
        if (info && info.lineInSource) {
          setHighlightLine(info.lineInSource);
        }
      } else {
        setHighlightLine(null);
      }
    },
    [code]
  );

  // Scheme B: 微调属性
  const handleUpdateElement = useCallback(
    (updates: Partial<SvgElementInfo>) => {
      if (selectedElementIndex === null) return;
      const updatedCode = updateSvgElement(code, selectedElementIndex, updates);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // Scheme B: 删除图元
  const handleDeleteElement = useCallback(() => {
    if (selectedElementIndex === null) return;
    const updatedCode = removeSvgElement(code, selectedElementIndex);
    handleCodeChange(updatedCode);
    setSelectedElementIndex(null);
    setHighlightLine(null);
  }, [code, selectedElementIndex, handleCodeChange]);

  // Scheme B: 调整图元层级 (置顶 / 置底，并自动跟踪更新后的图元索引，确保属性面板持续展示)
  const handleMoveElementLayer = useCallback(
    (direction: 'front' | 'back') => {
      if (selectedElementIndex === null) return;
      const result = moveSvgElement(code, selectedElementIndex, direction);
      handleCodeChange(result.code);
      setSelectedElementIndex(result.newIndex);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // Scheme B: 在代码中定位图元所在行
  const handleLocateInCode = useCallback(() => {
    if (selectedElementInfo && selectedElementInfo.lineInSource) {
      if (viewMode === 'visual') {
        setViewMode('split');
      }
      setHighlightLine(selectedElementInfo.lineInSource);
    }
  }, [selectedElementInfo, viewMode]);

  // 增量移动图元几何坐标 (鼠标拖动与键盘微调)
  const handleMoveElementGeometry = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedElementIndex === null) return;
      const updatedCode = moveSvgElementGeometry(code, selectedElementIndex, deltaX, deltaY);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // 快速将图元对齐到画布
  const handleAlignElement = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', bbox: ElementBBox) => {
      if (selectedElementIndex === null) return;
      const updatedCode = alignSvgElement(code, selectedElementIndex, alignment, bbox);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // 一键正交化线条 (水平或垂直校准)
  const handleAlignLineOrthogonal = useCallback(
    (mode: 'horizontal' | 'vertical') => {
      if (selectedElementIndex === null) return;
      const updatedCode = alignLineOrthogonal(code, selectedElementIndex, mode);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // 反转线条端点 (P1 <-> P2)
  const handleReverseLine = useCallback(() => {
    if (selectedElementIndex === null) return;
    const updatedCode = reverseLineEndpoints(code, selectedElementIndex);
    handleCodeChange(updatedCode);
  }, [code, selectedElementIndex, handleCodeChange]);

  // 将直线转换为阶梯折线 (HV / VH)
  const handleConvertToStepLine = useCallback(
    (mode: 'hv' | 'vh') => {
      if (selectedElementIndex === null) return;
      const updatedCode = convertLineToStepPath(code, selectedElementIndex, mode);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // 一键套用线条工业预设样式
  const handleApplyLinePreset = useCallback(
    (preset: LinePresetType) => {
      if (selectedElementIndex === null) return;
      const updatedCode = applyLinePreset(code, selectedElementIndex, preset);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // 调整图元几何尺寸 (8 向手柄拖拽与等比缩放)
  const handleResizeElementGeometry = useCallback(
    (newBBox: CalculatedResizeBBox, initialBBox: ElementBBox) => {
      if (selectedElementIndex === null) return;
      const updatedCode = resizeSvgElementGeometry(code, selectedElementIndex, newBBox, initialBBox);
      handleCodeChange(updatedCode);
    },
    [code, selectedElementIndex, handleCodeChange]
  );

  // 分屏拖拽逻辑
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!studioRef.current) return;
      const rect = studioRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rawPercentage = (offsetX / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercentage, 15), 85);
      setSplitRatio(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
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
  }, [isDraggingSplitter]);

  // 格式化 Prettify
  const handleFormat = () => {
    const prettified = prettifySvg(code);
    if (prettified) {
      handleCodeChange(prettified);
    }
  };

  // SVGO 净化优化
  const handleOptimize = () => {
    const res = optimizeSvg(code);
    handleCodeChange(res.optimized);
    setOptimizeToast(`SVGO 净化完成！瘦身 ${res.savedPercentage}% (节省 ${res.savedBytes} 字节)`);
    setTimeout(() => setOptimizeToast(null), 3500);
  };

  // 还原初始内容
  const handleReset = () => {
    handleCodeChange(content);
  };

  // 快捷缩放与适配
  const handleZoomIn = () => setScale(prev => Math.min(8, prev * 1.25));
  const handleZoomOut = () => setScale(prev => Math.max(0.08, prev * 0.8));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  const handleFitZoom = () => {
    setScale(0.85);
    setPosition({ x: 0, y: 0 });
  };

  // 复制与导出
  const handleCopySvg = () => {
    navigator.clipboard.writeText(code);
  };

  const handleCopyReact = () => {
    // 派生合适的组件名：如 'logo.svg' -> 'LogoIcon'
    const base = fileName.replace(/\.svg$/i, '').replace(/[^a-zA-Z0-9]/g, ' ');
    const pascal = base
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    const componentName = `${pascal || 'Svg'}Icon`;
    const reactCode = convertSvgToReact(code, componentName);
    navigator.clipboard.writeText(reactCode);
  };

  const handleCopyVue = () => {
    const vueCode = convertSvgToVue(code);
    navigator.clipboard.writeText(vueCode);
  };

  const handleCopyDataUri = () => {
    const dataUri = convertSvgToDataUri(code);
    navigator.clipboard.writeText(dataUri);
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([code], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="svg-studio-root"
      ref={studioRef}
      className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none"
    >
      {/* 顶部工具栏 */}
      <SvgToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        splitRatio={splitRatio}
        setSplitRatio={setSplitRatio}
        stats={{ ...stats, byteSize: fileSize || stats.byteSize }}
        scale={scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitZoom={handleFitZoom}
        bgMode={bgMode}
        setBgMode={setBgMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        fileName={fileName}
        svgContent={code}
        onCopySvg={handleCopySvg}
        onCopyReact={handleCopyReact}
        onCopyVue={handleCopyVue}
        onCopyDataUri={handleCopyDataUri}
        onDownloadSvg={handleDownloadSvg}
        inspectorActive={inspectorActive}
        onToggleInspector={handleToggleInspector}
      />

      {/* 优化操作浮动提示卡 */}
      {optimizeToast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-purple-950/90 text-purple-200 border border-purple-500/50 rounded-lg shadow-2xl text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {optimizeToast}
        </div>
      )}

      {/* 主体工作视口 (分屏 / 仅画布 / 仅代码) */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* 代码编辑器面板 */}
        {viewMode !== 'visual' && (
          <div
            style={{
              width: viewMode === 'code' ? '100%' : `${splitRatio}%`,
              minWidth: viewMode === 'code' ? '100%' : '15%',
            }}
            className="h-full flex-shrink-0 relative overflow-hidden"
          >
            <SvgCodeEditor
              code={code}
              onChange={handleCodeChange}
              originalCode={content}
              validation={validation}
              onFormat={handleFormat}
              onOptimize={handleOptimize}
              onReset={handleReset}
              highlightLine={highlightLine}
            />
          </div>
        )}

        {/* 自由拖拽分屏手柄 (仅在 split 模式呈现) */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleSplitterMouseDown}
            className={`w-1.5 hover:w-2 -ml-0.5 z-20 cursor-col-resize transition-colors flex items-center justify-center group ${
              isDraggingSplitter ? 'bg-blue-500 w-2' : 'bg-slate-800 hover:bg-blue-500/80'
            }`}
            title="拖动调整代码与画布分屏宽度"
          >
            <div className="w-0.5 h-6 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
          </div>
        )}

        {/* 矢量画布面板 */}
        {viewMode !== 'code' && (
          <div
            style={{
              width: viewMode === 'visual' ? '100%' : `${100 - splitRatio}%`,
              minWidth: viewMode === 'visual' ? '100%' : '15%',
            }}
            className="h-full flex-1 relative overflow-hidden"
          >
            <SvgCanvas
              svgContent={code}
              scale={scale}
              setScale={setScale}
              position={position}
              setPosition={setPosition}
              bgMode={bgMode}
              showGrid={showGrid}
              validation={validation}
              inspectorActive={inspectorActive}
              selectedElementIndex={selectedElementIndex}
              selectedElementInfo={selectedElementInfo}
              onSelectElement={handleSelectElement}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onMoveElementLayer={handleMoveElementLayer}
              onLocateInCode={handleLocateInCode}
              onMoveElementGeometry={handleMoveElementGeometry}
              onResizeElementGeometry={handleResizeElementGeometry}
              onAlignElement={handleAlignElement}
              onAlignLineOrthogonal={handleAlignLineOrthogonal}
              onReverseLine={handleReverseLine}
              onConvertToStepLine={handleConvertToStepLine}
              onApplyLinePreset={handleApplyLinePreset}
            />
          </div>
        )}
      </div>
    </div>
  );
};
