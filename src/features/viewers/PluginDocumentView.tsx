/**
 * OmniView 文档视图插件外壳 (支持多语言 + 纯图标悬浮设计 + DOM搜索高亮变色与直接源码打开)
 */
import React, { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { FileItem, ThemeId, DensityMode, ViewMode, OutlinePosition, OutlineDisplayMode, ContentWidthMode, WorkbenchSettings } from '../../shared/types';
import { ViewerRenderer } from './ViewerRenderer';
import { loadStoredSettings, saveStoredSettings } from '../../shared/lib/settingsStorage';
import { VsCodeApi } from '../../shared/lib/vscode';
import { parseMarkdownHeadings, extractSectionContent } from './lib/markdownAst';
import { exportToWordDocument, exportToPortableHtml, buildPortableHtml } from './lib/exportEngine';
import { requestPrintHtml } from '../../shared/lib/printBridge';
import { useScrollHeadingSpy } from './hooks/useScrollHeadingSpy';
import { MarkdownToolbar } from './components/markdown/MarkdownToolbar';
import { MarkdownOutlineSidebar } from './components/markdown/MarkdownOutlineSidebar';
import { DocStatusBar } from './components/DocStatusBar';
import { WorkbenchSettingsModal } from '../workbench/components/WorkbenchSettingsModal';
import { ExternalLink } from 'lucide-react';
import { Locale, getStoredLocale, saveStoredLocale, t } from '../../shared/lib/i18n';
import { highlightSearchMatches, activateMatch, clearSearchHighlights } from './lib/domSearchHighlighter';
import { isVsCodeEnvironment, setupVsCodeThemeObserver } from '../../shared/lib/nativeTheme';

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
    onThemeChange?.(newTheme);
  };

  const handleDensitySelect = (newDensity: DensityMode) => {
    setCurrentDensity(newDensity);
    saveStoredSettings({ density: newDensity });
    onDensityChange?.(newDensity);
  };

  if (!file) {
    const _locale = getStoredLocale();
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        {_locale === 'en-US' ? 'Loading document…' : '正在加载文档…'}
      </div>
    );
  }

  if (!['md', 'markdown', 'okf'].includes(file.extension.toLowerCase())) {
    const _locale = getStoredLocale();
    return (
      <main
        className="flex h-full w-full min-h-0 flex-col overflow-hidden text-slate-100"
        data-theme={currentTheme}
        data-density={currentDensity}
        style={{ background: 'var(--ov-bg)' }}
      >
        {/* Top Action Bar for non-markdown files */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0 select-none">
          <div className="flex items-center gap-2 font-mono text-slate-300">
            <span className="font-semibold text-slate-200">{file.name}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {file.extension}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {vscode && (
              <button
                onClick={() => vscode.postMessage({ type: 'open-source', path: file.path })}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-xs font-medium"
                title={t('openInEditor', _locale)}
              >
                <ExternalLink size={13} />
                <span>{t('openSource', _locale)}</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full w-full">
          <ViewerRenderer
            file={file}
            files={[file]}
            mode="preview"
            theme={currentTheme}
            density={currentDensity}
            onContentChange={onContentChange || (() => undefined)}
          />
        </div>
      </main>
    );
  }

  return (
    <MarkdownPluginView
      file={file}
      theme={currentTheme}
      density={currentDensity}
      onThemeChange={handleThemeSelect}
      onDensityChange={handleDensitySelect}
      onContentChange={onContentChange}
      vscode={vscode}
    />
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
  const [zoom, setZoom] = useState(initialSettings.zoom ?? 1);
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState(false);
  const [copiedRich, setCopiedRich] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [matchCount, setMatchCount] = useState<number>(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [contentWidth, setContentWidth] = useState<ContentWidthMode>(initialSettings.contentWidth || 'standard');
  const [fontSize, setFontSize] = useState<number>(initialSettings.fontSize || 15);
  const [focusMode, setFocusMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
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

  // Interactive Markdown content state for in-place editing & real-time re-rendering
  const [documentContent, setDocumentContent] = useState(file.content);
  const prevFileIdRef = useRef(file.id);
  const prevContentRef = useRef(file.content);

  useEffect(() => {
    if (file.id !== prevFileIdRef.current || file.content !== prevContentRef.current) {
      prevFileIdRef.current = file.id;
      prevContentRef.current = file.content;
      setDocumentContent(file.content);
    }
  }, [file.id, file.content]);

  const handleContentUpdate = useCallback(
    (newContent: string) => {
      setDocumentContent(newContent);
      onContentChange?.(newContent);
      if (vscode) {
        vscode.postMessage({
          type: 'document-change',
          path: file.path,
          content: newContent,
        });
        vscode.postMessage({
          type: 'save-content',
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

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setPresentationMode(false);
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
        setFocusMode(true);
        setAutoScrollSpeed(0);
      }
      return next;
    });
  }, []);

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

  const viewerFiles = useMemo(() => [activeFile, ...(file?.relatedFiles || [])], [activeFile, file?.relatedFiles]);

  // 搜索关键字高亮与变色联动（仅做高亮标注，绝不打断用户滚动）
  useEffect(() => {
    const canvas = getSearchCanvas();
    if (!searchText.trim()) {
      clearSearchHighlights(canvas);
      setMatchCount(0);
      setActiveMatchIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      const target = getSearchCanvas();
      const count = highlightSearchMatches(target, searchText);
      setMatchCount(count);
      if (count > 0) {
        setActiveMatchIndex(0);
        activateMatch(target, 0, false); // 仅高亮当前匹配项，不滚动视口
      } else {
        setActiveMatchIndex(-1);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchText, getSearchCanvas]);

  // 工具栏显隐等无关重渲染后，若 <mark> 被冲掉则立即补回（不滚动）
  useLayoutEffect(() => {
    if (!searchText.trim()) return;
    const canvas = getSearchCanvas();
    if (!canvas) return;
    if (canvas.querySelectorAll('mark.ov-search-match').length > 0) return;
    const count = highlightSearchMatches(canvas, searchText);
    setMatchCount(count);
    if (count > 0) {
      setActiveMatchIndex(prev => {
        const next = Math.min(prev < 0 ? 0 : prev, count - 1);
        activateMatch(canvas, next, false);
        return next;
      });
    } else {
      setActiveMatchIndex(-1);
    }
  }, [searchText, toolbarVisible, getSearchCanvas]);

  // 渲染完成后立即重新注入搜索高亮，防止正文 HTML 刷新导致 <mark> 节点丢失（不触发视口滚动）
  const handleRenderComplete = useCallback(() => {
    if (!searchText.trim()) return;
    // 双 rAF：等待 React commit + 浏览器布局完成后再注入
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = getSearchCanvas();
        const count = highlightSearchMatches(canvas, searchText);
        setMatchCount(count);
        setActiveMatchIndex(prev => {
          const next = Math.min(prev < 0 ? 0 : prev, Math.max(count - 1, 0));
          if (count > 0) activateMatch(canvas, next, false);
          return count > 0 ? next : -1;
        });
      });
    });
  }, [searchText, getSearchCanvas]);

  // 搜索前进/后退导航（用户主动按键/点击触发，平滑滚动至目标项）
  const handleFindText = useCallback((backwards = false) => {
    if (!searchText.trim()) return;
    const canvas = getSearchCanvas();
    if (!canvas) return;

    let currentCount = matchCount;
    if (currentCount === 0 || canvas.querySelectorAll('mark.ov-search-match').length === 0) {
      currentCount = highlightSearchMatches(canvas, searchText);
      setMatchCount(currentCount);
    }
    if (currentCount === 0) return;

    setActiveMatchIndex(prev => {
      let nextIndex = backwards ? prev - 1 : prev + 1;
      if (nextIndex < 0) nextIndex = currentCount - 1;
      if (nextIndex >= currentCount) nextIndex = 0;
      activateMatch(canvas, nextIndex, true);
      return nextIndex;
    });
  }, [searchText, matchCount, getSearchCanvas]);

  // Copy operations
  const handleCopyRawMarkdown = async () => {
    await navigator.clipboard.writeText(documentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleCopyCurrentSection = async () => {
    const sectionText = extractSectionContent(documentContent, headings, activeHeadingIndex);
    await navigator.clipboard.writeText(sectionText);
    setCopiedSection(true);
    setTimeout(() => setCopiedSection(false), 1600);
  };

  const handleCopyRichText = async () => {
    const canvas = getSearchCanvas();
    if (!canvas) return;
    try {
      const html = canvas.innerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([documentContent], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ]);
      setCopiedRich(true);
      setTimeout(() => setCopiedRich(false), 1600);
    } catch {
      await handleCopyRawMarkdown();
    }
  };

  const [isExportingWord, setIsExportingWord] = useState(false);

  const runWithEagerMount = useCallback((action: () => void | Promise<void>) => {
    setPrintEagerMount(true);
    window.setTimeout(() => {
      void Promise.resolve()
        .then(action)
        .finally(() => setPrintEagerMount(false));
    }, 120);
  }, []);

  const handleExportHtml = () => {
    runWithEagerMount(() => {
      const canvas = getSearchCanvas();
      if (!canvas) return;
      exportToPortableHtml(file.name, canvas);
    });
  };

  const handlePrint = () => {
    if (vscode) {
      runWithEagerMount(() => {
        const canvas = getSearchCanvas() || (scrollRef.current as HTMLElement | null);
        if (!canvas) {
          void requestPrintHtml(file.name, '<!DOCTYPE html><html><body><p>无可打印内容</p></body></html>', {
            vscode,
          });
          return;
        }
        const html = buildPortableHtml(file.name, canvas);
        requestPrintHtml(file.name, html, { vscode });
      });
      return;
    }
    window.print();
  };

  const handleExportWord = () => {
    runWithEagerMount(async () => {
      const canvas = getSearchCanvas();
      if (!canvas) return;
      try {
        setIsExportingWord(true);
        await exportToWordDocument(file.name, canvas);
      } catch (err) {
        console.error('Word export error:', err);
      } finally {
        setIsExportingWord(false);
      }
    });
  };

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
    setIsSettingsModalOpen(true);
  }, []);

  const handleSettingsChange = useCallback(
    (updated: WorkbenchSettings) => {
      setSettings(updated);
      if (updated.theme) onThemeChange(updated.theme);
      if (updated.density) onDensityChange(updated.density);
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
    [onThemeChange, onDensityChange]
  );

  const handleOpenSourceAtLine = useCallback(
    (line: number) => {
      if (vscode) {
        vscode.postMessage({
          type: 'reveal-source-line',
          path: file.path,
          line,
          revealType: 'select',
        });
      } else {
        setViewMode('split');
      }
    },
    [vscode, file.path]
  );

  const currentHeading = headings?.[activeHeadingIndex];
  const fileWordCount = Math.max(1, (file?.content || '').trim().split(/\s+/).filter(Boolean).length || 1);

  return (
    <main
      ref={shellRef}
      className={`markdown-plugin-shell ${focusMode ? 'markdown-focus-mode' : ''} ${presentationMode ? 'markdown-presentation-mode' : ''}`}
      data-theme={theme}
      data-density={density}
      data-width={contentWidth}
      data-font-size={fontSize}
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
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onFindText={handleFindText}
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
              locale={locale}
              onContentChange={handleContentUpdate}
              onRenderComplete={handleRenderComplete}
              onOpenSourceAtLine={handleOpenSourceAtLine}
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
              locale={locale}
              onContentChange={handleContentUpdate}
              onRenderComplete={handleRenderComplete}
              onOpenSourceAtLine={handleOpenSourceAtLine}
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
          >
            <div style={{ zoom }} data-width={contentWidth} data-font-size={fontSize}>
              <ViewerRenderer
                file={activeFile}
                files={viewerFiles}
                mode="preview"
                theme={theme}
                density={density}
                contentWidth={contentWidth}
                locale={locale}
                onContentChange={handleContentUpdate}
                onRenderComplete={handleRenderComplete}
                onOpenSourceAtLine={handleOpenSourceAtLine}
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
      <WorkbenchSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </main>
  );
};
