/**
 * OmniView 文档视图插件外壳 (支持多语言 + 纯图标悬浮设计 + DOM搜索高亮变色与直接源码打开)
 */
import React, { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { FileItem, ThemeId, DensityMode, ViewMode, OutlinePosition, OutlineDisplayMode, ContentWidthMode, WorkbenchSettings } from '../../shared/types';
import { ViewerRenderer, getDriverIdForFile } from './ViewerRenderer';
import { loadStoredSettings, saveStoredSettings } from '../../shared/lib/settingsStorage';
import { VsCodeApi } from '../../shared/lib/vscode';
import { parseMarkdownHeadings, extractSectionContent } from './lib/markdownAst';
import { exportToWordDocument, exportToPortableHtml, buildPortableHtml } from './lib/exportEngine';
import { requestPrintHtml } from '../../shared/lib/printBridge';
import { useScrollHeadingSpy } from './hooks/useScrollHeadingSpy';
import { useContainerWidth } from './hooks/useContainerWidth';
import { MarkdownToolbar } from './components/markdown/MarkdownToolbar';
import { MarkdownOutlineSidebar } from './components/markdown/MarkdownOutlineSidebar';
import { DocStatusBar } from './components/DocStatusBar';
const WorkbenchSettingsModal = React.lazy(() =>
  import('../workbench/components/WorkbenchSettingsModal').then(m => ({ default: m.WorkbenchSettingsModal }))
);
import { KeyboardShortcutsModal } from './components/HelpShortcutsModal';
import { ExternalLink, Save, Check, Loader2, Keyboard, Settings } from 'lucide-react';
import { Locale, getStoredLocale, saveStoredLocale, t } from '../../shared/lib/i18n';
import { highlightSearchMatches, activateMatch, clearSearchHighlights } from './lib/domSearchHighlighter';
import { aggregateSearchMatchesByDocumentToc, type DocumentSectionSearchMatch } from './lib/documentSearchAggregator';
import { isVsCodeEnvironment, setupVsCodeThemeObserver } from '../../shared/lib/nativeTheme';
import { INITIAL_FILES } from '../../shared/data/sampleFiles';
import { NonMarkdownPluginView } from './components/plugin/NonMarkdownPluginView';
import { ViewerConfigProvider } from './context/ViewerConfigContext';
import { useDocumentSearch } from './hooks/useDocumentSearch';
import { useDocumentExport } from './hooks/useDocumentExport';

/**
 * 非 Markdown 文档写回契约辅助函数 (保持向下兼容与 IPC 消息写回调度)
 */
export const persistContent = (
  vscode: VsCodeApi | undefined,
  path: string,
  content: string,
  onContentChange?: (content: string) => void
) => {
  onContentChange?.(content);
  if (vscode) {
    vscode.postMessage({
      type: 'document-change',
      path,
      content,
    });
  }
};

interface PluginDocumentViewProps {
  file?: FileItem;
  theme?: ThemeId;
  density?: DensityMode;
  onThemeChange?: (theme: ThemeId) => void;
  onDensityChange?: (density: DensityMode) => void;
  onContentChange?: (content: string) => void;
  vscode?: VsCodeApi;
}

export const PluginDocumentView: React.FC<PluginDocumentViewProps> = ({
  file,
  theme,
  density,
  onThemeChange,
  onDensityChange,
  onContentChange,
  vscode,
}) => {
  const [initialSettings] = useState(() => {
    const loaded = loadStoredSettings();
    if (isVsCodeEnvironment() && !window.localStorage.getItem('omniview:workbench:settings:v2')) {
      loaded.theme = 'system';
    }
    return loaded;
  });
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(theme || initialSettings.theme);
  const [currentDensity, setCurrentDensity] = useState<DensityMode>(density || initialSettings.density);

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  useEffect(() => {
    const unsub = setupVsCodeThemeObserver(() => {
      if (currentTheme === 'system') {
        setCurrentTheme('system');
      }
    });
    return unsub;
  }, [currentTheme]);

  const handleThemeSelect = (newTheme: ThemeId) => {
    setCurrentTheme(newTheme);
    saveStoredSettings({ theme: newTheme });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
      document.body?.setAttribute('data-theme', newTheme);
    }
    onThemeChange?.(newTheme);
    if (vscode) {
      vscode.postMessage({
        type: 'save-configuration',
        settings: { theme: newTheme },
      });
    }
  };

  const handleDensitySelect = (newDensity: DensityMode) => {
    setCurrentDensity(newDensity);
    saveStoredSettings({ density: newDensity });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-density', newDensity);
      document.body?.setAttribute('data-density', newDensity);
    }
    onDensityChange?.(newDensity);
    if (vscode) {
      vscode.postMessage({
        type: 'save-configuration',
        settings: { density: newDensity },
      });
    }
  };

  if (!file) {
    const _locale = getStoredLocale();
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        {_locale === 'en-US' ? 'Loading document…' : '正在加载文档…'}
      </div>
    );
  }

  const effectiveLocale = getStoredLocale();

  if (!['md', 'markdown', 'okf'].includes(file.extension.toLowerCase())) {
    return (
      <ViewerConfigProvider theme={currentTheme} density={currentDensity} locale={effectiveLocale} vscode={vscode}>
        <NonMarkdownPluginView
          file={file}
          theme={currentTheme}
          density={currentDensity}
          onThemeChange={handleThemeSelect}
          onDensityChange={handleDensitySelect}
          onContentChange={onContentChange}
          vscode={vscode}
        />
      </ViewerConfigProvider>
    );
  }

  return (
    <ViewerConfigProvider theme={currentTheme} density={currentDensity} locale={effectiveLocale} vscode={vscode}>
      <MarkdownPluginView
        file={file}
        theme={currentTheme}
        density={currentDensity}
        onThemeChange={handleThemeSelect}
        onDensityChange={handleDensitySelect}
        onContentChange={onContentChange}
        vscode={vscode}
      />
    </ViewerConfigProvider>
  );
};

const MarkdownPluginView: React.FC<{
  file: FileItem;
  theme: ThemeId;
  density: DensityMode;
  onThemeChange: (theme: ThemeId) => void;
  onDensityChange: (density: DensityMode) => void;
  onContentChange?: (content: string) => void;
  vscode?: VsCodeApi;
}> = ({ file, theme, density, onThemeChange, onDensityChange, onContentChange, vscode }) => {
  const initialSettings = useMemo(() => loadStoredSettings(), []);
  const [settings, setSettings] = useState<WorkbenchSettings>(initialSettings);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'appearance' | 'editor' | 'diagrams' | 'shortcuts' | 'storage'>('appearance');
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());
  const [outlineOpen, setOutlineOpen] = useState(initialSettings.outlineOpen ?? true);
  const [outlinePosition, setOutlinePosition] = useState<OutlinePosition>(
    () => initialSettings.outlinePosition || 'right'
  );
  const [outlineWidth, setOutlineWidth] = useState<number>(
    () => initialSettings.outlineWidth || 260
  );
  const [outlineDisplayMode, setOutlineDisplayMode] = useState<OutlineDisplayMode>(
    () => initialSettings.outlineDisplayMode || 'tree'
  );

  const handleOutlinePositionChange = useCallback((pos: OutlinePosition) => {
    setOutlinePosition(pos);
    saveStoredSettings({ outlinePosition: pos });
  }, []);

  const handleOutlineWidthChange = useCallback((width: number) => {
    setOutlineWidth(width);
    saveStoredSettings({ outlineWidth: width });
  }, []);

  const handleOutlineDisplayModeChange = useCallback((mode: OutlineDisplayMode) => {
    setOutlineDisplayMode(mode);
    saveStoredSettings({ outlineDisplayMode: mode });
  }, []);
  const [toolbarVisible, setToolbarVisible] = useState(false);

  // 图表工具栏全局显隐模式：默认 compact (微型折叠胶囊)，需要时全局开启
  const [showDiagramToolbars, setShowDiagramToolbars] = useState<boolean>(() => {
    try {
      return localStorage.getItem('omniview.showDiagramToolbars') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleDiagramToolbars = useCallback(() => {
    setShowDiagramToolbars(prev => {
      const next = !prev;
      try {
        localStorage.setItem('omniview.showDiagramToolbars', String(next));
      } catch {}
      return next;
    });
  }, []);
  const [zoom, setZoom] = useState(initialSettings.zoom ?? 1);
  const [contentWidth, setContentWidth] = useState<ContentWidthMode>(initialSettings.contentWidth || 'standard');
  const [fontSize, setFontSize] = useState<number>(initialSettings.fontSize || 15);
  const [focusMode, setFocusMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const focusModeBeforePresentationRef = useRef(false);
  const [printEagerMount, setPrintEagerMount] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(0);
  const [headingFilterLevel, setHeadingFilterLevel] = useState<number>(6);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [enableOkfRendering, setEnableOkfRendering] = useState<boolean>(
    () => initialSettings.enableOkfRendering ?? true
  );

  const handleToggleOkf = useCallback(() => {
    setEnableOkfRendering(prev => {
      const next = !prev;
      saveStoredSettings({ enableOkfRendering: next });
      return next;
    });
  }, []);

  // Interactive Markdown/Driver content state for in-place editing & real-time re-rendering
  const [documentContent, setDocumentContent] = useState(file.content);
  const prevFileIdRef = useRef(file.id);
  const prevContentRef = useRef(file.content);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    if (file.id !== prevFileIdRef.current || file.content !== prevContentRef.current) {
      prevFileIdRef.current = file.id;
      prevContentRef.current = file.content;
      setDocumentContent(file.content);
    }
  }, [file.id, file.content]);

  const handleReloadDocument = useCallback(() => {
    setIsReloading(true);
    if (vscode) {
      vscode.postMessage({ type: 'reload-document' });
    } else {
      setDocumentContent(file.content);
    }
    setTimeout(() => {
      setIsReloading(false);
    }, 600);
  }, [file.content, vscode]);

  const handleContentUpdate = useCallback(
    (newContent: string) => {
      setDocumentContent(newContent);
      onContentChange?.(newContent);
      if (vscode) {
        // 分屏/源码编辑写回：由 Host 对 document-change 防抖落盘；save-content 立即落盘
        vscode.postMessage({
          type: 'document-change',
          path: file.path,
          content: newContent,
        });
      }
    },
    [file.path, onContentChange, vscode]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);

  /** 预览 / 分屏均可定位到正文根节点（不再依赖仅 preview 挂载的 scrollRef） */
  const getSearchCanvas = useCallback((): HTMLElement | null => {
    const root = shellRef.current;
    if (root) {
      return root.querySelector<HTMLElement>('#markdown-viewer-canvas, .markdown-document');
    }
    return document.querySelector<HTMLElement>('#markdown-viewer-canvas, .markdown-document');
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    saveStoredLocale(newLocale);
  };

  // Parse headings with AST helper based on live documentContent
  const headings = useMemo(() => parseMarkdownHeadings(documentContent), [documentContent]);

  // Filtered headings by level
  const filteredHeadings = useMemo(() => {
    return headings.filter(h => h.level <= headingFilterLevel);
  }, [headings, headingFilterLevel]);

  // Custom hook: scroll tracking & active heading detection
  const {
    readingProgress,
    activeHeadingIndex,
    jumpToHeading,
    scrollToTop,
  } = useScrollHeadingSpy({
    scrollRef,
    headings,
    autoScrollSpeed,
  });

  const activeFile = useMemo(
    () => ({
      ...file,
      content: documentContent || '',
      size: new TextEncoder().encode(documentContent || '').length,
      lastModified: Date.now(),
      isModified: true,
    }),
    [file, documentContent]
  );

  const viewerFiles = useMemo(
    () => [activeFile, ...(file?.relatedFiles || []), ...INITIAL_FILES],
    [activeFile, file?.relatedFiles]
  );

  // 搜索关键字高亮与变色联动、单处/全部替换 (抽离至 useDocumentSearch hook)
  const {
    searchText,
    setSearchText,
    replaceText,
    setReplaceText,
    showReplace,
    setShowReplace,
    matchCase,
    setMatchCase,
    matchCount,
    setMatchCount,
    activeMatchIndex,
    setActiveMatchIndex,
    searchGroups,
    handleFindText,
    handleSelectMatch,
    handleReplaceSingle,
    handleReplaceAll,
    handleRenderComplete,
  } = useDocumentSearch({
    documentContent,
    setDocumentContent,
    headings,
    getSearchCanvas,
    toolbarVisible,
    setOutlineOpen,
    onContentChange,
    vscode,
    filePath: activeFile.path,
  });

  // 复制与文档导出 (抽离至 useDocumentExport hook)
  const {
    copied,
    copiedSection,
    copiedRich,
    isExportingWord,
    handleCopyRawMarkdown,
    handleCopyCurrentSection,
    handleCopyRichText,
    handleExportHtml,
    handlePrint,
    handleExportWord,
    runWithEagerMount,
  } = useDocumentExport({
    fileName: file.name,
    documentContent,
    headings,
    activeHeadingIndex,
    getSearchCanvas,
    scrollRef,
    vscode,
    setPrintEagerMount,
  });

  const eagerMountBlocks = Boolean(searchText.trim()) || printEagerMount || presentationMode;

  useEffect(() => {
    const onBeforePrint = () => setPrintEagerMount(true);
    const onAfterPrint = () => setPrintEagerMount(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  useEffect(() => {
    if (!presentationMode) return;

    const exitPresentation = () => {
      setPresentationMode(false);
      // 退出投屏必须还原进入前的专注模式，否则大纲会因 focusMode 残留而无法再显示
      setFocusMode(focusModeBeforePresentationRef.current);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        exitPresentation();
        return;
      }

      const goNext =
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === ' ' ||
        event.key === 'Enter';
      const goPrev = event.key === 'ArrowUp' || event.key === 'PageUp';

      if (!goNext && !goPrev) return;
      if (!headings || headings.length === 0) return;

      event.preventDefault();
      if (goNext) {
        jumpToHeading(Math.min(activeHeadingIndex + 1, (headings.length || 1) - 1));
      } else {
        jumpToHeading(Math.max(activeHeadingIndex - 1, 0));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentationMode, headings?.length, activeHeadingIndex, jumpToHeading]);

  const handleTogglePresentationMode = useCallback(() => {
    setPresentationMode(prev => {
      const next = !prev;
      if (next) {
        setFocusMode(current => {
          focusModeBeforePresentationRef.current = current;
          return true;
        });
        setAutoScrollSpeed(0);
      } else {
        setFocusMode(focusModeBeforePresentationRef.current);
      }
      return next;
    });
  }, []);



  const handleCycleWidth = () => {
    const next: Record<ContentWidthMode, ContentWidthMode> = {
      narrow: 'standard',
      standard: 'wide',
      wide: 'full',
      full: 'a4',
      a4: 'narrow',
    };
    const updated = next[contentWidth];
    setContentWidth(updated);
    saveStoredSettings({ contentWidth: updated });
  };

  const handleFontSizeSelect = (size: number) => {
    setFontSize(size);
    saveStoredSettings({ fontSize: size });
  };

  const handleToggleOutline = () => {
    const next = !outlineOpen;
    setOutlineOpen(next);
    saveStoredSettings({ outlineOpen: next });
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    saveStoredSettings({ zoom: nextZoom });
  };

  const handleOpenSettings = useCallback(() => {
    setSettings(loadStoredSettings());
    setSettingsInitialTab('appearance');
    setIsSettingsModalOpen(true);
  }, []);

  const handleOpenShortcuts = useCallback(() => {
    setSettings(loadStoredSettings());
    setSettingsInitialTab('shortcuts');
    setIsSettingsModalOpen(true);
  }, []);

  // 快捷键监听 (Ctrl+? 帮助指南，Ctrl+F 全局快速检索)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Ctrl+F / Cmd+F: 全局唤起并聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const activeEl = document.activeElement as HTMLElement | null;
        const codeCanvas = document.getElementById('code-viewer-canvas');
        const codeSearchBtn = document.getElementById('btn-code-search') as HTMLButtonElement | null;
        const isCodeView =
          viewMode === 'source' ||
          Boolean(activeEl?.closest('.ov-code-editor, #code-viewer-canvas, [data-driver="code"]')) ||
          (Boolean(codeCanvas) && !activeEl?.closest('#omniview-markdown-search-input, .markdown-toolbar'));

        if (isCodeView && codeSearchBtn) {
          e.preventDefault();
          e.stopPropagation();
          const codeSearchInput = document.getElementById('ov-codeviewer-search-input') as HTMLInputElement | null;
          if (codeSearchInput) {
            codeSearchInput.focus();
            codeSearchInput.select();
          } else {
            codeSearchBtn.click();
          }
          return;
        }

        e.preventDefault();
        setToolbarVisible(true);
        setTimeout(() => {
          const searchInput = (document.getElementById('omniview-markdown-search-input') ||
            document.querySelector('#csv-smart-grid-container input[type="text"]') ||
            document.querySelector('input[placeholder*="搜索"]') ||
            document.querySelector('input[placeholder*="Search"]')) as HTMLInputElement | null;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 50);
        return;
      }

      // Ctrl+H / Cmd+H: 替换模式快捷键
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        const activeEl = document.activeElement as HTMLElement | null;
        const codeCanvas = document.getElementById('code-viewer-canvas');
        const codeSearchBtn = document.getElementById('btn-code-search') as HTMLButtonElement | null;
        const isCodeView =
          viewMode === 'source' ||
          Boolean(activeEl?.closest('.ov-code-editor, #code-viewer-canvas, [data-driver="code"]')) ||
          (Boolean(codeCanvas) && !activeEl?.closest('#omniview-markdown-search-input, .markdown-toolbar'));

        if (isCodeView && codeSearchBtn) {
          e.preventDefault();
          e.stopPropagation();
          const codeReplaceInput = document.getElementById('ov-codeviewer-replace-input') as HTMLInputElement | null;
          if (codeReplaceInput) {
            codeReplaceInput.focus();
            codeReplaceInput.select();
          } else {
            codeSearchBtn.click();
          }
          return;
        }

        e.preventDefault();
        setToolbarVisible(true);
        setShowReplace(true);
        setTimeout(() => {
          const replaceInput = document.getElementById('omniview-markdown-replace-input') as HTMLInputElement | null;
          if (replaceInput) {
            replaceInput.focus();
            replaceInput.select();
          }
        }, 50);
        return;
      }

      // Ctrl+R / Cmd+R / F5: 从磁盘/编辑器重新加载预览
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') || e.key === 'F5') {
        e.preventDefault();
        handleReloadDocument();
        return;
      }

      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === '?' || (e.shiftKey && (e.key === '/' || e.code === 'Slash')))) {
        e.preventDefault();
        setSettings(loadStoredSettings());
        setSettingsInitialTab('shortcuts');
        setIsSettingsModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [viewMode, handleReloadDocument]);

  const handleSettingsChange = useCallback(
    (updated: WorkbenchSettings) => {
      setSettings(updated);
      saveStoredSettings(updated);
      if (updated.theme) {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', updated.theme);
          document.body?.setAttribute('data-theme', updated.theme);
        }
        onThemeChange(updated.theme);
      }
      if (updated.density) {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-density', updated.density);
          document.body?.setAttribute('data-density', updated.density);
        }
        onDensityChange(updated.density);
      }
      if (vscode) {
        vscode.postMessage({
          type: 'save-configuration',
          settings: updated,
        });
      }
      if (updated.locale === 'zh-CN' || updated.locale === 'en-US') {
        setLocale(updated.locale);
        saveStoredLocale(updated.locale);
      }
      if (typeof updated.zoom === 'number') setZoom(updated.zoom);
      if (updated.contentWidth) setContentWidth(updated.contentWidth);
      if (typeof updated.fontSize === 'number') setFontSize(updated.fontSize);
      if (updated.outlineOpen !== undefined) setOutlineOpen(updated.outlineOpen);
      if (updated.outlinePosition) setOutlinePosition(updated.outlinePosition);
      if (typeof updated.outlineWidth === 'number') setOutlineWidth(updated.outlineWidth);
      if (updated.outlineDisplayMode) setOutlineDisplayMode(updated.outlineDisplayMode);
      if (updated.enableOkfRendering !== undefined) setEnableOkfRendering(updated.enableOkfRendering);
      if (updated.viewMode) setViewMode(updated.viewMode);
    },
    [onThemeChange, onDensityChange, vscode]
  );

  const handleOpenSourceAtLine = useCallback(
    (line: number) => {
      const emitCursorSync = () => {
        window.dispatchEvent(
          new CustomEvent('omniview-editor-sync', {
            detail: {
              type: 'editor-cursor-sync',
              origin: 'preview',
              activeLine: line,
              topLine: line,
            },
          })
        );
      };

      if (vscode) {
        emitCursorSync();
        vscode.postMessage({
          type: 'reveal-source-line',
          path: file.path,
          line,
          revealType: 'select',
        });
      } else {
        setViewMode('split');
        // 等待分屏源码编辑器挂载后再定位行
        requestAnimationFrame(() => {
          requestAnimationFrame(emitCursorSync);
        });
      }
    },
    [vscode, file.path]
  );

  const handleOpenInEditor = useCallback(() => {
    if (vscode) {
      vscode.postMessage({ type: 'open-source', path: file?.path || '' });
    }
  }, [vscode, file?.path]);

  const handleSelectFile = useCallback(
    (selectedFile: FileItem) => {
      if (vscode) {
        vscode.postMessage({
          type: 'open-link',
          href: selectedFile.path || selectedFile.name,
          currentFilePath: file?.path,
        });
      }
    },
    [vscode, file?.path]
  );

  // 全局容器级超链接点击监听（支持非 Markdown 驱动与外部链接统一委托至 VS Code 宿主处理）
  useEffect(() => {
    if (!vscode) return;
    const handleContainerClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href === '#' || href.startsWith('javascript:')) return;

      if (href.startsWith('#')) {
        e.preventDefault();
        const id = decodeURIComponent(href.slice(1));
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      vscode.postMessage({
        type: 'open-link',
        href,
        currentFilePath: file?.path,
      });
    };

    const root = shellRef.current || document;
    root.addEventListener('click', handleContainerClick as EventListener);
    return () => {
      root.removeEventListener('click', handleContainerClick as EventListener);
    };
  }, [vscode, file?.path]);

  const currentHeading = headings?.[activeHeadingIndex];
  const fileWordCount = Math.max(1, (file?.content || '').trim().split(/\s+/).filter(Boolean).length || 1);
  const activeDriverId = activeFile ? getDriverIdForFile(activeFile) : 'markdown';
  const isMarkdown = activeDriverId === 'markdown';

  if (!isMarkdown) {
    return (
      <main
        ref={shellRef as React.RefObject<HTMLElement>}
        data-theme={theme}
        data-density={density}
        data-font-size={fontSize}
        className="omniview-driver-shell flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden select-none"
        style={{ background: 'var(--ov-bg)', color: 'var(--ov-text)', '--ov-font-size': `${fontSize}px` } as React.CSSProperties}
      >
        <div className="flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden">
          <ViewerRenderer
            file={activeFile}
            files={viewerFiles}
            mode="preview"
            theme={theme}
            density={density}
            contentWidth={contentWidth}
            fontSize={fontSize}
            locale={locale}
            onContentChange={handleContentUpdate}
            onRenderComplete={handleRenderComplete}
            onOpenSourceAtLine={handleOpenSourceAtLine}
            onOpenInEditor={handleOpenInEditor}
            onSelectFile={handleSelectFile}
            enableOkf={enableOkfRendering}
            onToggleOkf={handleToggleOkf}
            eagerMount={eagerMountBlocks}
          />
        </div>
        {isSettingsModalOpen && (
          <React.Suspense fallback={null}>
            <WorkbenchSettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              settings={settings}
              onSettingsChange={handleSettingsChange}
              initialTab={settingsInitialTab}
            />
          </React.Suspense>
        )}
      </main>
    );
  }

  return (
    <main
      ref={shellRef}
      className={`markdown-plugin-shell ${focusMode ? 'markdown-focus-mode' : ''} ${presentationMode ? 'markdown-presentation-mode' : ''}`}
      data-theme={theme}
      data-density={density}
      data-width={contentWidth}
      data-font-size={fontSize}
      data-diagram-toolbars={showDiagramToolbars ? 'visible' : 'compact'}
      style={{ '--ov-font-size': `${fontSize}px` } as React.CSSProperties}
      onMouseMove={event => {
        const nextVisible = event.clientY <= 56;
        setToolbarVisible(prev => (prev === nextVisible ? prev : nextVisible));
      }}
    >
      {/* Top Document Toolbar */}
      <MarkdownToolbar
        fileName={file?.name || 'untitled'}
        filePath={file?.path || ''}
        headingsCount={headings?.length ?? 0}
        currentHeading={currentHeading}
        readingProgress={readingProgress}
        outlineOpen={outlineOpen}
        onToggleOutline={handleToggleOutline}
        showDiagramToolbars={showDiagramToolbars}
        onToggleDiagramToolbars={handleToggleDiagramToolbars}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onFindText={handleFindText}
        replaceText={replaceText}
        onReplaceTextChange={setReplaceText}
        showReplace={showReplace}
        onToggleReplace={() => setShowReplace(v => !v)}
        onReplaceSingle={handleReplaceSingle}
        onReplaceAll={handleReplaceAll}
        matchCase={matchCase}
        onToggleMatchCase={() => setMatchCase(v => !v)}
        matchCount={matchCount}
        theme={theme}
        onThemeChange={onThemeChange}
        density={density}
        onDensityChange={onDensityChange}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeSelect}
        contentWidth={contentWidth}
        onCycleWidth={handleCycleWidth}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode(v => !v)}
        presentationMode={presentationMode}
        onTogglePresentationMode={handleTogglePresentationMode}
        autoScrollSpeed={autoScrollSpeed}
        onToggleAutoScroll={() => setAutoScrollSpeed(v => (v === 0 ? 1 : v === 1 ? 2 : 0))}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onCopyRawMarkdown={handleCopyRawMarkdown}
        onCopyCurrentSection={handleCopyCurrentSection}
        onCopyRichText={handleCopyRichText}
        onExportHtml={handleExportHtml}
        onPrint={handlePrint}
        onExportWord={handleExportWord}
        isExportingWord={isExportingWord}
        onOpenInEditor={vscode ? () => vscode.postMessage({ type: 'open-source', path: file?.path || '' }) : undefined}
        onScrollToTop={scrollToTop}
        copied={copied}
        copiedSection={copiedSection}
        copiedRich={copiedRich}
        fileCharCount={documentContent?.length ?? 0}
        fileWordCount={fileWordCount}
        isVisible={toolbarVisible}
        onMouseEnter={() => setToolbarVisible(true)}
        locale={locale}
        onLocaleChange={handleLocaleChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isMindmap={viewMode === 'mindmap'}
        onToggleMindmap={() => setViewMode(m => (m === 'mindmap' ? 'preview' : 'mindmap'))}
        enableOkf={enableOkfRendering}
        onToggleOkf={handleToggleOkf}
        onOpenSettings={handleOpenSettings}
        onOpenShortcuts={handleOpenShortcuts}
        onReloadDocument={handleReloadDocument}
        isReloading={isReloading}
      />

      {/* Main Body: Outline Sidebar + Canvas */}
      <div className="markdown-plugin-body">
        {outlineOpen && !focusMode && !presentationMode && viewMode !== 'mindmap' && viewMode !== 'source' && (
          <MarkdownOutlineSidebar
            headings={headings}
            filteredHeadings={filteredHeadings}
            activeHeadingIndex={activeHeadingIndex}
            headingFilterLevel={headingFilterLevel}
            onFilterLevelChange={setHeadingFilterLevel}
            onJumpToHeading={jumpToHeading}
            locale={locale}
            position={outlinePosition}
            onPositionChange={handleOutlinePositionChange}
            displayMode={outlineDisplayMode}
            onDisplayModeChange={handleOutlineDisplayModeChange}
            onClose={handleToggleOutline}
            width={outlineWidth}
            onWidthChange={handleOutlineWidthChange}
            searchQuery={searchText}
            totalMatchesCount={matchCount}
            activeMatchIndex={activeMatchIndex}
            searchGroups={searchGroups}
            onSelectMatch={handleSelectMatch}
            onCopySectionByIndex={idx => {
              const sectionText = extractSectionContent(documentContent, headings, idx);
              navigator.clipboard.writeText(sectionText).catch(() => {});
            }}
            onOpenSourceAtLine={handleOpenSourceAtLine}
          />
        )}

        {/* Canvas / Mindmap / Split / Source View */}
        {viewMode === 'mindmap' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ViewerRenderer
              file={activeFile}
              files={viewerFiles}
              mode="mindmap"
              theme={theme}
              density={density}
              contentWidth={contentWidth}
              fontSize={fontSize}
              locale={locale}
              onContentChange={handleContentUpdate}
              onRenderComplete={handleRenderComplete}
              onOpenSourceAtLine={handleOpenSourceAtLine}
              onOpenInEditor={handleOpenInEditor}
              onSelectFile={handleSelectFile}
              enableOkf={enableOkfRendering}
              onToggleOkf={handleToggleOkf}
              eagerMount={eagerMountBlocks}
            />
          </div>
        ) : viewMode === 'source' || viewMode === 'split' ? (
          <div ref={scrollRef} className="flex-1 min-h-0 flex overflow-hidden">
            <ViewerRenderer
              file={activeFile}
              files={viewerFiles}
              mode={viewMode}
              theme={theme}
              density={density}
              contentWidth={contentWidth}
              fontSize={fontSize}
              locale={locale}
              onContentChange={handleContentUpdate}
              onRenderComplete={handleRenderComplete}
              onOpenSourceAtLine={handleOpenSourceAtLine}
              onOpenInEditor={handleOpenInEditor}
              onSelectFile={handleSelectFile}
              enableOkf={enableOkfRendering}
              onToggleOkf={handleToggleOkf}
              eagerMount={eagerMountBlocks}
            />
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="markdown-plugin-scroll"
            data-width={contentWidth}
            data-font-size={fontSize}
            style={{ '--ov-font-size': `${fontSize}px` } as React.CSSProperties}
          >
            <div style={{ zoom }} data-width={contentWidth} data-font-size={fontSize}>
              <ViewerRenderer
                file={activeFile}
                files={viewerFiles}
                mode="preview"
                theme={theme}
                density={density}
                contentWidth={contentWidth}
                fontSize={fontSize}
                locale={locale}
                onContentChange={handleContentUpdate}
                onRenderComplete={handleRenderComplete}
                onOpenSourceAtLine={handleOpenSourceAtLine}
                onOpenInEditor={handleOpenInEditor}
                onSelectFile={handleSelectFile}
                enableOkf={enableOkfRendering}
                onToggleOkf={handleToggleOkf}
                eagerMount={eagerMountBlocks}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      {!presentationMode && (
      <DocStatusBar
        wordCount={fileWordCount}
        sectionCount={headings?.length ?? 0}
        readingProgress={readingProgress}
        activeMatchIndex={activeMatchIndex}
        matchCount={matchCount}
        searchText={searchText}
        zoom={zoom}
        fontSize={fontSize}
        contentWidth={contentWidth}
        locale={locale}
      />
      )}

      {presentationMode && (
        <div className="markdown-presentation-hud" aria-live="polite">
          <span>
            {Math.min(activeHeadingIndex + 1, Math.max(headings?.length ?? 0, 1))}/{Math.max(headings?.length ?? 0, 1)}
          </span>
          <span className="markdown-presentation-hud-hint">{t('presentationHudHint', locale)}</span>
        </div>
      )}
      {isSettingsModalOpen && (
        <React.Suspense fallback={null}>
          <WorkbenchSettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            initialTab={settingsInitialTab}
          />
        </React.Suspense>
      )}
    </main>
  );
};
