/**
 * OmniView 通用视口缩放与平移状态管理 Hook (useViewZoom)
 * 适用于各种矢量、图片、文档与图表 Viewer 的标准化缩放和平移手势交互
 */
import { useState, useCallback, useMemo } from 'react';

export interface UseViewZoomOptions {
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  step?: number;
  initialPan?: { x: number; y: number };
}

export interface UseViewZoomReturn {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  zoomIn: (delta?: number) => void;
  zoomOut: (delta?: number) => void;
  resetZoom: () => void;
  zoomPercent: number;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  panMode: boolean;
  setPanMode: React.Dispatch<React.SetStateAction<boolean>>;
  isPanning: boolean;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  resetPan: () => void;
  resetAll: () => void;
}

export function useViewZoom(options: UseViewZoomOptions = {}): UseViewZoomReturn {
  const {
    initialZoom = 1.0,
    minZoom = 0.2,
    maxZoom = 4.0,
    step = 0.15,
    initialPan = { x: 0, y: 0 },
  } = options;

  const [zoom, setZoom] = useState<number>(initialZoom);
  const [pan, setPan] = useState<{ x: number; y: number }>(initialPan);
  const [panMode, setPanMode] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const zoomIn = useCallback((delta = step) => {
    setZoom(prev => {
      const next = Math.min(maxZoom, Math.round((prev + delta) * 100) / 100);
      return next;
    });
  }, [maxZoom, step]);

  const zoomOut = useCallback((delta = step) => {
    setZoom(prev => {
      const next = Math.max(minZoom, Math.round((prev - delta) * 100) / 100);
      return next;
    });
  }, [minZoom, step]);

  const resetZoom = useCallback(() => {
    setZoom(initialZoom);
  }, [initialZoom]);

  const resetPan = useCallback(() => {
    setPan(initialPan);
  }, [initialPan]);

  const resetAll = useCallback(() => {
    setZoom(initialZoom);
    setPan(initialPan);
  }, [initialZoom, initialPan]);

  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomPercent,
    pan,
    setPan,
    panMode,
    setPanMode,
    isPanning,
    setIsPanning,
    resetPan,
    resetAll,
  };
}
