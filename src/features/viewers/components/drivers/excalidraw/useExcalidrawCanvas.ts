import { useEffect, useMemo, useRef, useState, useCallback, type Dispatch, type SetStateAction, type MutableRefObject, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react';
import {
  getFramesFromElements,
  detectDanglingArrows,
  renderExcalidrawToSvgString,
  type ExcalidrawParsedData,
} from './excalidrawEngine';

export type ExcalidrawViewMode = 'canvas' | 'split' | 'preview' | 'code';

export interface UseExcalidrawCanvasOptions {
  sourceText: string;
  setSourceText: Dispatch<SetStateAction<string>>;
  isDarkTheme: boolean;
  viewMode: ExcalidrawViewMode;
  onContentChange?: (content: string) => void;
  parsedData: ExcalidrawParsedData;
  excalidrawApiRef: MutableRefObject<any>;
}

export function useExcalidrawCanvas(options: UseExcalidrawCanvasOptions) {
  const {
    sourceText,
    setSourceText,
    isDarkTheme,
    viewMode,
    onContentChange,
    parsedData,
    excalidrawApiRef,
  } = options;

  // 提取画框 (Frames) 列表
  const frames = useMemo(() => {
    return getFramesFromElements(parsedData?.elements || []);
  }, [parsedData?.elements]);

  // 拓扑健康诊断（悬空箭头统计）
  const arrowStats = useMemo(() => {
    return detectDanglingArrows(parsedData?.elements || []);
  }, [parsedData?.elements]);

  // 渲染产物与状态
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [isLoadingSvg, setIsLoadingSvg] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 只读预览视口缩放与平移
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 演播导览 (Slide Mode) 状态
  const [isSlideMode, setIsSlideMode] = useState<boolean>(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);

  // 运镜聚焦指定 Frame
  const navigateToFrame = useCallback(
    (index: number) => {
      if (frames.length === 0) return;
      const targetIndex = (index + frames.length) % frames.length;
      setCurrentFrameIndex(targetIndex);
      const targetFrame = frames[targetIndex];
      if (excalidrawApiRef.current && targetFrame) {
        excalidrawApiRef.current.scrollToContent(targetFrame, {
          fitToContent: true,
          animate: true,
          duration: 350,
        });
      }
    },
    [frames, excalidrawApiRef]
  );

  // 幻灯片演示键盘快捷键
  useEffect(() => {
    if (!isSlideMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        navigateToFrame(currentFrameIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigateToFrame(currentFrameIndex - 1);
      } else if (e.key === '0' || e.key === 'Home') {
        e.preventDefault();
        excalidrawApiRef.current?.scrollToContent();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlideMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSlideMode, currentFrameIndex, navigateToFrame, excalidrawApiRef]);

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

  // 画布双向变动回写
  const handleCanvasDocChange = useCallback(
    (newJson: string) => {
      setSourceText(newJson);
      onContentChange?.(newJson);
    },
    [setSourceText, onContentChange]
  );

  // 源码直接输入变更
  const handleSourceChange = useCallback(
    (newVal: string) => {
      setSourceText(newVal);
      onContentChange?.(newVal);
    },
    [setSourceText, onContentChange]
  );

  // 格式化 JSON
  const handlePrettifyJson = useCallback(() => {
    try {
      const obj = JSON.parse(sourceText);
      const pretty = JSON.stringify(obj, null, 2);
      handleSourceChange(pretty);
    } catch {
      // ignore
    }
  }, [sourceText, handleSourceChange]);

  // 居中视口（适应内容）
  const handleCenterView = useCallback(() => {
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
  }, [viewMode, excalidrawApiRef]);

  // 只读预览画布平移交互
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (e.button === 0 || e.button === 1) {
        setIsPanning(true);
        startPanRef.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        };
      }
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
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

  const handleWheel = useCallback((e: ReactWheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.min(4, Math.max(0.2, Number((prev * zoomFactor).toFixed(2)))));
    } else {
      setPosition((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  return {
    frames,
    arrowStats,
    renderedSvg,
    isLoadingSvg,
    renderError,
    scale,
    setScale,
    position,
    setPosition,
    isPanning,
    containerRef,
    startPanRef,
    navigateToFrame,
    isSlideMode,
    setIsSlideMode,
    currentFrameIndex,
    handleCanvasDocChange,
    handleSourceChange,
    handlePrettifyJson,
    handleCenterView,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
  };
}
