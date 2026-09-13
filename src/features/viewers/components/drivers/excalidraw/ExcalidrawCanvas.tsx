import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Excalidraw, restoreElements, restoreAppState } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Locale } from '../../../../../shared/lib/i18n';
import { ExcalidrawParsedData } from './excalidrawEngine';

export interface ExcalidrawCanvasProps {
  initialParsedData: ExcalidrawParsedData;
  isDarkTheme: boolean;
  locale: Locale;
  showGrid: boolean;
  isZenMode: boolean;
  isViewOnly: boolean;
  onDocChange?: (newJson: string) => void;
  onApiReady?: (api: any) => void;
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
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isInternalChangeRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  // 初始化数据安全准备 (经 restoreElements 与 restoreAppState 标准化填充)
  const initialData = useMemo(() => {
    try {
      const rawElements = initialParsedData?.elements || [];
      const restoredElements = restoreElements(rawElements, null);
      const restoredAppState = restoreAppState(
        {
          ...(initialParsedData?.appState || {}),
          theme: (isDarkTheme ? 'dark' : 'light') as 'dark' | 'light',
          exportWithDarkMode: isDarkTheme,
          gridSize: showGrid ? 20 : null,
          zenModeEnabled: isZenMode,
          viewModeEnabled: isViewOnly,
        },
        null
      );
      return {
        elements: restoredElements,
        appState: restoredAppState,
        files: initialParsedData?.files || {},
      };
    } catch {
      return {
        elements: [],
        appState: {
          theme: (isDarkTheme ? 'dark' : 'light') as 'dark' | 'light',
          exportWithDarkMode: isDarkTheme,
          gridSize: showGrid ? 20 : null,
        },
        files: {},
      };
    }
  }, []);

  // 绑定 API 回调
  const handleApiRef = useCallback(
    (api: any) => {
      setExcalidrawAPI(api);
      onApiReady?.(api);
    },
    [onApiReady]
  );

  // 监听画布变动，防抖回写
  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      if (!onDocChange) return;

      isInternalChangeRef.current = true;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          const doc = {
            type: 'excalidraw',
            version: 2,
            source: 'https://omniview.dev',
            elements: (elements || []).filter((el) => el && !el.isDeleted),
            appState: {
              viewBackgroundColor: appState?.viewBackgroundColor || (isDarkTheme ? '#121212' : '#ffffff'),
              gridSize: appState?.gridSize ?? (showGrid ? 20 : null),
            },
            files: files || {},
          };
          const jsonStr = JSON.stringify(doc, null, 2);
          onDocChange(jsonStr);
        } catch {
          // 防御性忽略异常
        } finally {
          setTimeout(() => {
            isInternalChangeRef.current = false;
          }, 50);
        }
      }, 250);
    },
    [onDocChange, isDarkTheme, showGrid]
  );

  // 当外部数据变动时（非画布自身触发），调用 updateScene 同步
  useEffect(() => {
    if (!excalidrawAPI || isInternalChangeRef.current) return;
    if (!initialParsedData?.isValid) return;

    try {
      const rawElements = initialParsedData?.elements || [];
      const restoredElements = restoreElements(rawElements, null);
      const restoredAppState = restoreAppState(
        {
          ...(initialParsedData?.appState || {}),
          theme: isDarkTheme ? 'dark' : 'light',
          gridSize: showGrid ? 20 : null,
          zenModeEnabled: isZenMode,
          viewModeEnabled: isViewOnly,
        },
        null
      );
      excalidrawAPI.updateScene({
        elements: restoredElements,
        appState: restoredAppState,
      });
    } catch {
      // 容错处理
    }
  }, [initialParsedData, excalidrawAPI, isDarkTheme, showGrid, isZenMode, isViewOnly]);

  // 同步外部主题、网格与视图模式到 API
  useEffect(() => {
    if (!excalidrawAPI) return;
    try {
      excalidrawAPI.updateScene({
        appState: {
          theme: isDarkTheme ? 'dark' : 'light',
          exportWithDarkMode: isDarkTheme,
          gridSize: showGrid ? 20 : null,
          zenModeEnabled: isZenMode,
        },
      });
    } catch {
      // 容错
    }
  }, [isDarkTheme, showGrid, isZenMode, excalidrawAPI]);

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden"
      style={{ minHeight: '380px' }}
      id="omniview-excalidraw-canvas-container"
    >
      <Excalidraw
        excalidrawAPI={handleApiRef}
        initialData={initialData}
        onChange={handleChange}
        theme={isDarkTheme ? 'dark' : 'light'}
        langCode={locale === 'zh-CN' ? 'zh-CN' : 'en'}
        viewModeEnabled={isViewOnly}
        zenModeEnabled={isZenMode}
        gridModeEnabled={showGrid}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
          },
        }}
      />
    </div>
  );
};
