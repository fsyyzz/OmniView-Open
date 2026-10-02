import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Locale } from '../../../../../shared/lib/i18n';
import { ExcalidrawParsedData, renderExcalidrawToSvgString } from './excalidrawEngine';
import { ZoomIn, ZoomOut, RotateCcw, PenTool } from 'lucide-react';

export interface ExcalidrawCanvasProps {
  initialParsedData: ExcalidrawParsedData;
  isDarkTheme: boolean;
  locale: Locale;
  showGrid: boolean;
  isZenMode: boolean;
  isViewOnly: boolean;
  onDocChange?: (newJson: string) => void;
  onApiReady?: (api: any) => void;
  onLibraryLoaded?: (count: number) => void;
}

export const ExcalidrawCanvas: React.FC<ExcalidrawCanvasProps> = ({
  initialParsedData,
  isDarkTheme,
  locale,
  showGrid,
  isZenMode,
  isViewOnly,
  onDocChange,
  onApiReady,
  onLibraryLoaded,
}) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    let active = true;
    renderExcalidrawToSvgString(initialParsedData, { isDarkTheme }).then(({ svgString }) => {
      if (active) setSvgHtml(svgString);
    });
    return () => {
      active = false;
    };
  }, [initialParsedData, isDarkTheme]);

  useEffect(() => {
    onApiReady?.({
      scrollToContent: () => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
      },
      updateScene: () => {},
      getSceneElements: () => initialParsedData.elements,
    });
  }, [onApiReady, initialParsedData]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.min(Math.max(prev + delta, 0.2), 3));
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
      style={{
        backgroundColor: isDarkTheme ? '#121212' : '#ffffff',
        backgroundImage: showGrid ? `radial-gradient(${isDarkTheme ? '#333333' : '#e0e0e0'} 1px, transparent 1px)` : undefined,
        backgroundSize: showGrid ? '20px 20px' : undefined,
      }}
    >
      <div
        className="transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          width: '90%',
          height: '90%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />

      {/* 快捷画布浮动工具 */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-[var(--ov-surface)]/90 backdrop-blur-md border border-[var(--ov-border)] shadow-md text-xs">
        <button
          onClick={() => setZoom(prev => Math.min(prev + 0.15, 3))}
          className="p-1 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)]"
          title="放大 (Zoom In)"
        >
          <ZoomIn size={14} />
        </button>
        <span className="font-mono text-[11px] px-1 text-[var(--ov-text-muted)]">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.2))}
          className="p-1 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)]"
          title="缩小 (Zoom Out)"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)]"
          title="重置视口 (Reset Viewport)"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};

export default ExcalidrawCanvas;
