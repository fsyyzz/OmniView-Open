import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ThemeId, DensityMode, ViewMode, WorkbenchView, WorkbenchSettings } from '../shared/types';
import { saveStoredSettings } from '../shared/lib/settingsStorage';
import { VsCodeApi } from '../shared/lib/vscode';

interface UseWorkbenchSettingsParams {
  setTheme: (theme: ThemeId) => void;
  setDensity: (density: DensityMode) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentView: (view: WorkbenchView) => void;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setExplorerOpen: Dispatch<SetStateAction<boolean>>;
  setSettings: Dispatch<SetStateAction<WorkbenchSettings>>;
  vscode: VsCodeApi | undefined;
}

export function useWorkbenchSettings({
  setTheme,
  setDensity,
  setZoom,
  setViewMode,
  setCurrentView,
  setSidebarOpen,
  setExplorerOpen,
  setSettings,
  vscode,
}: UseWorkbenchSettingsParams) {
  const handleThemeChange = useCallback(
    (newTheme: ThemeId) => {
      setTheme(newTheme);
      setSettings(prev => ({ ...prev, theme: newTheme }));
      saveStoredSettings({ theme: newTheme });
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme);
        document.body?.setAttribute('data-theme', newTheme);
      }
      if (vscode) {
        vscode.postMessage({
          type: 'save-configuration',
          settings: { theme: newTheme },
        });
      }
    },
    [setTheme, setSettings, vscode],
  );

  const handleDensityChange = useCallback(
    (newDensity: DensityMode) => {
      setDensity(newDensity);
      setSettings(prev => ({ ...prev, density: newDensity }));
      saveStoredSettings({ density: newDensity });
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-density', newDensity);
        document.body?.setAttribute('data-density', newDensity);
      }
      if (vscode) {
        vscode.postMessage({
          type: 'save-configuration',
          settings: { density: newDensity },
        });
      }
    },
    [setDensity, setSettings, vscode],
  );

  const handleZoomChange = useCallback(
    (newZoom: number) => {
      setZoom(newZoom);
      setSettings(prev => ({ ...prev, zoom: newZoom }));
      saveStoredSettings({ zoom: newZoom });
    },
    [setZoom, setSettings],
  );

  const handleViewModeChange = useCallback(
    (newMode: ViewMode) => {
      setViewMode(newMode);
      setSettings(prev => ({ ...prev, viewMode: newMode }));
      saveStoredSettings({ viewMode: newMode });
    },
    [setViewMode, setSettings],
  );

  const handleCurrentViewChange = useCallback(
    (newView: WorkbenchView) => {
      setCurrentView(newView);
      setSettings(prev => ({ ...prev, currentView: newView }));
      saveStoredSettings({ currentView: newView });
    },
    [setCurrentView, setSettings],
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      setSettings(s => ({ ...s, sidebarOpen: next }));
      saveStoredSettings({ sidebarOpen: next });
      return next;
    });
  }, [setSidebarOpen, setSettings]);

  const handleToggleExplorer = useCallback(() => {
    setExplorerOpen(prev => {
      const next = !prev;
      setSettings(s => ({ ...s, explorerOpen: next }));
      saveStoredSettings({ explorerOpen: next });
      return next;
    });
  }, [setExplorerOpen, setSettings]);

  return {
    handleThemeChange,
    handleDensityChange,
    handleZoomChange,
    handleViewModeChange,
    handleCurrentViewChange,
    handleToggleSidebar,
    handleToggleExplorer,
  };
}
