import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { INITIAL_FILES } from '../shared/data/sampleFiles';
import { FileItem, WorkbenchView, ViewMode, ThemeId, DensityMode, WorkbenchSettings } from '../shared/types';
import { WorkbenchHeader } from '../features/workbench/components/WorkbenchHeader';
import { Sidebar } from '../features/workbench/components/Sidebar';
import { StatusBar } from '../features/workbench/components/StatusBar';
import { getDriverIdForFile } from '../features/viewers/ViewerRenderer';
import { EditorWorkspace } from '../features/workbench/components/EditorWorkspace';
import { DocCenter } from '../features/docs/DocCenter';
import { DriversManager } from '../features/drivers/DriversManager';
import { ScaffoldExporter } from '../features/scaffold/ScaffoldExporter';
import { getVsCodeApi, VsCodeApi } from '../shared/lib/vscode';
import { PluginDocumentView } from '../features/viewers/PluginDocumentView';
import { RenderErrorBoundary } from '../features/viewers/components/common/RenderErrorBoundary';
import { loadStoredSettings, saveStoredSettings } from '../shared/lib/settingsStorage';
import { loadStoredFiles, saveStoredFiles, resetStoredFiles } from '../shared/lib/fileStorage';
import { WorkbenchSettingsModal } from '../features/workbench/components/WorkbenchSettingsModal';

function getEmbeddedInitialFile(): FileItem | undefined {
  try {
    const el = typeof document !== 'undefined' ? document.getElementById('omniview-initial-data') : null;
    if (el?.textContent) {
      return JSON.parse(el.textContent);
    }
  } catch {
    // ignore parse error
  }
  return undefined;
}

export default function App() {
  const [vscode] = useState<VsCodeApi | undefined>(() => getVsCodeApi());
  const embeddedInitial = useMemo(() => getEmbeddedInitialFile(), []);
  const [pluginFile, setPluginFile] = useState<FileItem | undefined>(embeddedInitial);
  const [initialSettings] = useState<WorkbenchSettings>(() => loadStoredSettings());
  const [settings, setSettings] = useState<WorkbenchSettings>(initialSettings);
  const [files, setFiles] = useState<FileItem[]>(() => {
    if (embeddedInitial) return [embeddedInitial];
    return loadStoredFiles();
  });

  // 1. 视口与外观状态（受控且双向持久化）
  const [theme, setTheme] = useState<ThemeId>(initialSettings.theme);
  const [density, setDensity] = useState<DensityMode>(initialSettings.density);
  const [zoom, setZoom] = useState<number>(initialSettings.zoom);
  const [viewMode, setViewMode] = useState<ViewMode>(initialSettings.viewMode);

  // 2. 布局与主导航状态（双向持久化）
  const [currentView, setCurrentView] = useState<WorkbenchView>(initialSettings.currentView || 'editor');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(initialSettings.sidebarOpen ?? true);
  const [explorerOpen, setExplorerOpen] = useState<boolean>(initialSettings.explorerOpen ?? true);

  // 3. 活动文件与标签页状态（双向持久化）
  const [activeFileId, setActiveFileId] = useState<string>(() => {
    if (embeddedInitial) return embeddedInitial.id;
    const loadedFiles = loadStoredFiles();
    if (initialSettings.activeFileId && loadedFiles.some(f => f.id === initialSettings.activeFileId)) {
      return initialSettings.activeFileId;
    }
    return loadedFiles[0]?.id || INITIAL_FILES[0].id;
  });

  const [openTabIds, setOpenTabIds] = useState<string[]>(() => {
    const loadedFiles = loadStoredFiles();
    const validIds = loadedFiles.map(f => f.id);
    if (initialSettings.openTabIds && initialSettings.openTabIds.length > 0) {
      const filtered = initialSettings.openTabIds.filter(id => validIds.includes(id));
      if (filtered.length > 0) return filtered;
    }
    return [loadedFiles[0]?.id || INITIAL_FILES[0].id];
  });

  // 4. 设置模态框显隐状态
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // 同步外观与视口变更
  const handleThemeChange = (newTheme: ThemeId) => {
    setTheme(newTheme);
    setSettings(prev => ({ ...prev, theme: newTheme }));
    saveStoredSettings({ theme: newTheme });
  };

  const handleDensityChange = (newDensity: DensityMode) => {
    setDensity(newDensity);
    setSettings(prev => ({ ...prev, density: newDensity }));
    saveStoredSettings({ density: newDensity });
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setSettings(prev => ({ ...prev, zoom: newZoom }));
    saveStoredSettings({ zoom: newZoom });
  };

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    setSettings(prev => ({ ...prev, viewMode: newMode }));
    saveStoredSettings({ viewMode: newMode });
  };

  const handleCurrentViewChange = (newView: WorkbenchView) => {
    setCurrentView(newView);
    setSettings(prev => ({ ...prev, currentView: newView }));
    saveStoredSettings({ currentView: newView });
  };

  const handleToggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      setSettings(s => ({ ...s, sidebarOpen: next }));
      saveStoredSettings({ sidebarOpen: next });
      return next;
    });
  };

  const handleToggleExplorer = () => {
    setExplorerOpen(prev => {
      const next = !prev;
      setSettings(s => ({ ...s, explorerOpen: next }));
      saveStoredSettings({ explorerOpen: next });
      return next;
    });
  };

  const handleSettingsModalChange = (updatedSettings: WorkbenchSettings) => {
    setSettings(updatedSettings);
    if (updatedSettings.theme) setTheme(updatedSettings.theme);
    if (updatedSettings.density) setDensity(updatedSettings.density);
    if (updatedSettings.zoom) setZoom(updatedSettings.zoom);
    if (updatedSettings.viewMode) setViewMode(updatedSettings.viewMode);
    if (updatedSettings.currentView) setCurrentView(updatedSettings.currentView);
    if (updatedSettings.sidebarOpen !== undefined) setSidebarOpen(updatedSettings.sidebarOpen);
    if (updatedSettings.explorerOpen !== undefined) setExplorerOpen(updatedSettings.explorerOpen);
  };

  const handleResetWorkspace = () => {
    const refreshedFiles = resetStoredFiles();
    setFiles(refreshedFiles);
    setActiveFileId(refreshedFiles[0].id);
    setOpenTabIds(refreshedFiles.slice(0, 3).map(f => f.id));
    saveStoredSettings({
      activeFileId: refreshedFiles[0].id,
      openTabIds: refreshedFiles.slice(0, 3).map(f => f.id),
    });
  };

  useEffect(() => {
    const reportError = (event: ErrorEvent) => {
      vscode?.postMessage({ type: 'webview-error', message: event.message, source: event.filename, line: event.lineno });
    };
    const handleMessage = (event: MessageEvent<{ type?: string; file?: FileItem }>) => {
      const msgType = event.data?.type;
      if (!['document', 'document-update'].includes(msgType || '') || !event.data.file) return;
      const incomingFile = event.data.file;
      setPluginFile(incomingFile);
      setFiles((current) => {
        const updated = current.some((file) => file.id === incomingFile.id)
          ? current.map((file) => file.id === incomingFile.id ? incomingFile : file)
          : [incomingFile, ...current];
        if (!vscode) saveStoredFiles(updated);
        return updated;
      });
      setActiveFileId(incomingFile.id);
      setOpenTabIds((current) => {
        const updatedTabs = current.includes(incomingFile.id) ? current : [...current, incomingFile.id];
        if (!vscode) saveStoredSettings({ activeFileId: incomingFile.id, openTabIds: updatedTabs });
        return updatedTabs;
      });
      setCurrentView('editor');
    };
    window.addEventListener('message', handleMessage);
    window.addEventListener('error', reportError);
    vscode?.postMessage({ type: 'ready' });
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('error', reportError);
    };
  }, [vscode]);

  // File content modification
  const handleContentChange = (newContent: string) => {
    setFiles(prev => {
      const targetId = (vscode || pluginFile) ? (pluginFile?.id || activeFileId) : activeFileId;
      const updated = prev.map(f => {
        if (f.id === targetId) {
          return {
            ...f,
            content: newContent,
            size: new TextEncoder().encode(newContent).length,
            lastModified: Date.now(),
            isModified: true,
          };
        }
        return f;
      });
      if (!vscode) saveStoredFiles(updated);
      return updated;
    });
    if (pluginFile) {
      setPluginFile(prev => prev ? {
        ...prev,
        content: newContent,
        size: new TextEncoder().encode(newContent).length,
        lastModified: Date.now(),
        isModified: true,
      } : undefined);
    }
  };

  if (vscode || pluginFile) {
    const targetFile = pluginFile || files.find(f => f.id === activeFileId) || files[0];
    return (
      <RenderErrorBoundary blockName="OmniView Document Shell" vscode={vscode}>
        <PluginDocumentView
          key={targetFile?.id || 'omniview-doc'}
          file={targetFile}
          theme={theme}
          density={density}
          onThemeChange={handleThemeChange}
          onDensityChange={handleDensityChange}
          onContentChange={handleContentChange}
          vscode={vscode}
        />
      </RenderErrorBoundary>
    );
  }

  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  const activeDriverId = activeFile ? getDriverIdForFile(activeFile) : 'markdown';

  // Tab management with persistence
  const handleSelectFile = (fileId: string) => {
    setActiveFileId(fileId);
    let nextTabs = openTabIds;
    if (!openTabIds.includes(fileId)) {
      nextTabs = [...openTabIds, fileId];
      setOpenTabIds(nextTabs);
    }
    saveStoredSettings({ activeFileId: fileId, openTabIds: nextTabs });
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabIds.filter(id => id !== tabId);
    setOpenTabIds(newTabs);

    let nextActiveId = activeFileId;
    if (activeFileId === tabId && newTabs.length > 0) {
      nextActiveId = newTabs[newTabs.length - 1];
      setActiveFileId(nextActiveId);
    }
    saveStoredSettings({ activeFileId: nextActiveId, openTabIds: newTabs });
  };

  // Upload local files with persistence
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const isPdf = ext === 'pdf';

    reader.onload = e => {
      const content = (e.target?.result as string) || '';
      const newFile: FileItem = {
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: file.name,
        path: `/workspace/${file.name}`,
        extension: ext,
        content: isPdf ? 'PDF binary content' : content,
        size: file.size,
        lastModified: file.lastModified || Date.now(),
        isCustomUploaded: true,
        binaryUrl: isPdf ? URL.createObjectURL(file) : undefined,
      };

      setFiles(prev => {
        const updated = [newFile, ...prev];
        saveStoredFiles(updated);
        return updated;
      });
      setActiveFileId(newFile.id);
      const nextTabs = openTabIds.includes(newFile.id) ? openTabIds : [...openTabIds, newFile.id];
      setOpenTabIds(nextTabs);
      saveStoredSettings({ activeFileId: newFile.id, openTabIds: nextTabs });
      setCurrentView('editor');
    };

    if (isPdf) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDropFiles = (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      handleFileUpload(fileList[i]);
    }
  };

  // Create new file with persistence
  const handleNewFile = (customName?: string, customContent?: string, customExt = 'md') => {
    const id = `new-file-${Date.now()}`;
    const fileName = customName || `untitled-${files.length + 1}.${customExt}`;
    let defaultContent = `# 新建技术文档与图表设计

在此编写你的 Markdown 内容，支持即时渲染 Mermaid 图表与 PlantUML 架构图：

\`\`\`mermaid
flowchart LR
    A[需求分析] --> B[架构设计]
    B --> C[代码实现]
    C --> D[测试验证]
    D --> E[上线发布]
\`\`\`
`;

    if (['mm', 'markmap', 'mindmap', 'km'].includes(customExt.toLowerCase())) {
      defaultContent = `# 核心业务架构思维导图

## 前端交互体系
- 响应式布局与主题引擎
  - 暗黑 / 明亮模式自适应
  - 弹性视口百分比布局
- 统一渲染驱动分发引擎
  - Markdown / Mermaid 图表
  - Markmap 交互矢量导图
  - PlantUML 架构时序设计
  - SVG 矢量缩放与检测
  - PDF 现代化文档阅读器

## 服务与数据协同
- VS Code Webview 宿主协议通信
- 本地文件实时同步与双向编辑
- 增量状态更新与错误边界隔离

## 质量控制与门禁
- TypeScript 强类型校验
- 自动化单测与门禁回归
- 矢量 SVG 与交互 HTML 导出
`;
    }

    const content = customContent !== undefined ? customContent : defaultContent;
    const newFile: FileItem = {
      id,
      name: fileName,
      path: `/workspace/${fileName}`,
      extension: customExt,
      content,
      size: new TextEncoder().encode(content).length,
      lastModified: Date.now(),
      isCustomUploaded: true,
      isModified: true,
    };

    setFiles(prev => {
      const updated = [newFile, ...prev];
      saveStoredFiles(updated);
      return updated;
    });
    setActiveFileId(id);
    const nextTabs = openTabIds.includes(id) ? openTabIds : [...openTabIds, id];
    setOpenTabIds(nextTabs);
    saveStoredSettings({ activeFileId: id, openTabIds: nextTabs });
    setCurrentView('editor');
  };

  const handleDeleteFile = (fileId: string) => {
    const remainingFiles = files.filter(f => f.id !== fileId);
    setFiles(remainingFiles);
    saveStoredFiles(remainingFiles);

    const newTabs = openTabIds.filter(id => id !== fileId);
    setOpenTabIds(newTabs);

    let nextActive = activeFileId;
    if (activeFileId === fileId) {
      if (newTabs.length > 0) {
        nextActive = newTabs[newTabs.length - 1];
      } else if (remainingFiles.length > 0) {
        nextActive = remainingFiles[0].id;
      }
      setActiveFileId(nextActive);
    }
    saveStoredSettings({ activeFileId: nextActive, openTabIds: newTabs });
  };

  return (
    <div
      data-theme={theme}
      data-density={density}
      className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans transition-colors duration-200"
    >
      {/* Top Application Bar */}
      <WorkbenchHeader
        currentView={currentView}
        onViewChange={handleCurrentViewChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onFileUpload={handleFileUpload}
        onNewFile={handleNewFile}
        activeFile={activeFile}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
        density={density}
        onDensityChange={handleDensityChange}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar with collapsible state & persistence */}
        <Sidebar
          files={files}
          activeFileId={activeFileId}
          onSelectFile={handleSelectFile}
          onDeleteFile={handleDeleteFile}
          currentView={currentView}
          onViewChange={handleCurrentViewChange}
          onDropFiles={handleDropFiles}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          explorerOpen={explorerOpen}
          onToggleExplorer={handleToggleExplorer}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--ov-bg)' }}>
          {/* If viewing Documentation Center */}
          {currentView === 'docs' && (
            <DocCenter
              onOpenInWorkbench={(title, content) => {
                handleNewFile(`${title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}.md`, content, 'md');
                handleCurrentViewChange('editor');
              }}
            />
          )}

          {/* If viewing Drivers Manager */}
          {currentView === 'drivers' && (
            <DriversManager
              onOpenSampleFile={(extension) => {
                const match = files.find(f => f.extension.toLowerCase() === extension.toLowerCase());
                if (match) {
                  handleSelectFile(match.id);
                }
                handleCurrentViewChange('editor');
              }}
            />
          )}

          {/* If viewing Extension Scaffolding */}
          {currentView === 'scaffold' && <ScaffoldExporter />}

          {/* If in Editor Workbench Mode */}
          {currentView === 'editor' && (
            <EditorWorkspace
              files={files}
              activeFile={activeFile}
              activeFileId={activeFileId}
              openTabIds={openTabIds}
              viewMode={viewMode}
              theme={theme}
              density={density}
              zoom={zoom}
              onSelectTab={(id) => {
                setActiveFileId(id);
                saveStoredSettings({ activeFileId: id });
              }}
              onCloseTab={handleCloseTab}
              onNewFile={handleNewFile}
              onContentChange={handleContentChange}
              enableOkf={settings.enableOkfRendering}
              onToggleOkf={() => {
                const next = !(settings.enableOkfRendering ?? true);
                setSettings(prev => ({ ...prev, enableOkfRendering: next }));
                saveStoredSettings({ enableOkfRendering: next });
              }}
            />
          )}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        activeDriverId={activeDriverId}
        fileName={activeFile?.name}
        fileSize={activeFile?.size}
        lineCount={activeFile?.content?.split('\n').length || 0}
      />

      {/* Global Preferences & Persistence Settings Modal */}
      <WorkbenchSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsModalChange}
        onResetWorkspace={handleResetWorkspace}
      />
    </div>
  );
}
