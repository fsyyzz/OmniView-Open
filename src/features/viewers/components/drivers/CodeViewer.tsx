import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { Copy, Check, FileCode, Save, Eye, Edit3, CheckCircle2, Loader2, Undo2, Redo2, ExternalLink, Sparkles, MoreHorizontal, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import Prism from 'prismjs';
import { Locale, t } from '../../../../shared/lib/i18n';
import { ThemeId, DensityMode } from '../../../../shared/types';
import { useTextHistory } from '../../hooks/useTextHistory';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { getVsCodeApi } from '../../../../shared/lib/vscode';
import { loadStoredSettings } from '../../../../shared/lib/settingsStorage';
import { highlightSearchMatches, clearSearchHighlights, activateMatch } from '../../lib/domSearchHighlighter';
import {
  PANE_SYNC_EVENT,
  decideExternalContentApply,
  lineFromTextareaScroll,
  scrollTopForTextareaLine,
  type PaneSyncDetail,
} from '../../lib/scrollSync';

const StructuredDataViewer = lazy(() =>
  import('./data/StructuredDataViewer').then(m => ({ default: m.StructuredDataViewer }))
);

interface CodeViewerProps {
  content: string;
  extension?: string;
  fileName?: string;
  locale?: Locale;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  density?: DensityMode;
  onContentChange?: (newContent: string) => void;
  onOpenInEditor?: () => void;
}

const STRUCTURED_EXTENSIONS = ['json', 'yaml', 'yml', 'toml', 'xml'];

export const CodeViewer: React.FC<CodeViewerProps> = (props) => {
  const {
    content,
    extension = 'txt',
    fileName = 'file.txt',
    locale = 'zh-CN',
    theme,
    isDarkTheme,
    density,
    onContentChange,
    onOpenInEditor,
  } = props;

  const ext = (extension || '').toLowerCase();
  if (STRUCTURED_EXTENSIONS.includes(ext)) {
    return (
      <Suspense
        fallback={
          <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-3 p-8 text-slate-400 select-none">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">加载结构化数据工作台...</span>
          </div>
        }
      >
        <StructuredDataViewer
          content={content}
          extension={extension}
          fileName={fileName}
          locale={locale}
          theme={theme}
          isDarkTheme={isDarkTheme}
          density={density}
          onContentChange={onContentChange}
          onOpenInEditor={onOpenInEditor}
        />
      </Suspense>
    );
  }

  const [copied, setCopied] = useState(false);
  // If onContentChange is provided, allow direct editing
  const [isEditing, setIsEditing] = useState(() => Boolean(onContentChange));
  const [editValue, setEditValue] = useState(content);
  const [isSaved, setIsSaved] = useState(true);
  const [lastSavedContent, setLastSavedContent] = useState(content);

  // 容器响应式宽度监听与更多菜单
  const [headerRef, headerWidth] = useContainerWidth<HTMLDivElement>(600);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineGutterRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveContentRef = useRef<string | null>(null);
  const prevFileNameRef = useRef(fileName);
  const lastEmittedRef = useRef(content);
  const applyingRemoteScrollRef = useRef(false);
  const lineCountRef = useRef(1);

  // Undo / Redo 历史管理 Hook
  const {
    canUndo,
    canRedo,
    recordChange,
    undo,
    redo,
    reset: resetHistory,
  } = useTextHistory(content, { maxDepth: 150, mergeThresholdMs: 600 });

  // 查找与高亮导航状态
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const codeBodyRef = useRef<HTMLDivElement>(null);

  // Sync external content changes if file changes or loaded externally
  useEffect(() => {
    // 切换文件时，重置编辑内容与撤回历史栈
    if (fileName !== prevFileNameRef.current) {
      prevFileNameRef.current = fileName;
      lastEmittedRef.current = content;
      setEditValue(content);
      setLastSavedContent(content);
      setIsSaved(true);
      resetHistory(content);
      return;
    }

    const editorFocused = Boolean(textareaRef.current && document.activeElement === textareaRef.current);
    const decision = decideExternalContentApply({
      incoming: content,
      localValue: editValue,
      lastEmitted: lastEmittedRef.current,
      editorFocused,
    });
    if (decision === 'apply-external') {
      lastEmittedRef.current = content;
      setEditValue(content);
      setLastSavedContent(content);
      setIsSaved(true);
      recordChange(content, content.length, content.length, true);
    }
  }, [content, fileName, editValue, resetHistory, recordChange]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 编辑模式搜索匹配区间计算
  const editMatches = useMemo(() => {
    if (!isEditing || !isSearching || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const text = editValue.toLowerCase();
    const list: Array<{ start: number; end: number }> = [];
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(q, pos);
      if (idx === -1) break;
      list.push({ start: idx, end: idx + q.length });
      pos = idx + Math.max(1, q.length);
    }
    return list;
  }, [isEditing, isSearching, searchQuery, editValue]);

  useEffect(() => {
    if (isEditing && isSearching) {
      setSearchMatchCount(editMatches.length);
      if (editMatches.length > 0) {
        setSearchMatchIndex(0);
        const m = editMatches[0];
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(m.start, m.end);
        }
      } else {
        setSearchMatchIndex(0);
      }
    }
  }, [isEditing, isSearching, editMatches]);

  const handleNextMatch = useCallback(() => {
    if (searchMatchCount === 0) return;
    const nextIdx = (searchMatchIndex + 1) % searchMatchCount;
    setSearchMatchIndex(nextIdx);
    if (!isEditing) {
      activateMatch(codeBodyRef.current, nextIdx, true);
    } else {
      const m = editMatches[nextIdx];
      if (m && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(m.start, m.end);
      }
    }
  }, [searchMatchCount, searchMatchIndex, isEditing, editMatches]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatchCount === 0) return;
    const prevIdx = (searchMatchIndex - 1 + searchMatchCount) % searchMatchCount;
    setSearchMatchIndex(prevIdx);
    if (!isEditing) {
      activateMatch(codeBodyRef.current, prevIdx, true);
    } else {
      const m = editMatches[prevIdx];
      if (m && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(m.start, m.end);
      }
    }
  }, [searchMatchCount, searchMatchIndex, isEditing, editMatches]);

  const handleCloseSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
    setSearchMatchCount(0);
    setSearchMatchIndex(0);
    if (!isEditing) {
      clearSearchHighlights(codeBodyRef.current);
    }
  }, [isEditing]);

  // 全局 Ctrl+F 快捷激活
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const activeEl = document.activeElement;
        // 若焦点在外部独立弹窗则不强行夺焦
        if (activeEl?.closest('.ov-modal-backdrop, [role="dialog"]')) return;
        e.preventDefault();
        e.stopPropagation();
        setIsSearching(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const activeContent = isEditing ? editValue : content;
  const lines = activeContent.split('\n');
  lineCountRef.current = Math.max(1, lines.length);

  const readTextareaMetrics = () => {
    const ta = textareaRef.current;
    if (!ta) return { lineHeight: 20, paddingTop: 12 };
    const styles = window.getComputedStyle(ta);
    const parsedLineHeight = parseFloat(styles.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
      ? parsedLineHeight
      : parseFloat(styles.fontSize) * 1.625 || 20;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    return { lineHeight, paddingTop };
  };

  const emitSourceSync = (type: PaneSyncDetail['type'], line: number) => {
    if (applyingRemoteScrollRef.current) return;
    if (loadStoredSettings().scrollSync === false) return;
    const totalLines = lineCountRef.current;
    const detail: PaneSyncDetail = {
      type,
      origin: 'source',
      topLine: line,
      activeLine: line,
      totalLines,
    };
    window.dispatchEvent(new CustomEvent(PANE_SYNC_EVENT, { detail }));
  };

  // Sync scrolling between line gutter / preview and textarea
  const handleScroll = () => {
    const ta = textareaRef.current;
    if (ta && lineGutterRef.current) {
      lineGutterRef.current.scrollTop = ta.scrollTop;
    }
    if (!ta || applyingRemoteScrollRef.current) return;
    const { lineHeight, paddingTop } = readTextareaMetrics();
    const topLine = lineFromTextareaScroll(ta.scrollTop, lineHeight, paddingTop, lineCountRef.current);
    emitSourceSync('editor-scroll-sync', topLine);
  };

  const handleSelect = () => {
    const ta = textareaRef.current;
    if (!ta || applyingRemoteScrollRef.current) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const activeLine = before.split('\n').length;
    emitSourceSync('editor-cursor-sync', activeLine);
  };

  useEffect(() => {
    const onPaneSync = (event: Event) => {
      const detail = (event as CustomEvent<PaneSyncDetail>).detail;
      if (!detail || detail.origin === 'source') return;
      if (loadStoredSettings().scrollSync === false) return;
      const ta = textareaRef.current;
      if (!ta) return;
      const targetLine = detail.type === 'editor-cursor-sync'
        ? (detail.activeLine ?? 1)
        : (detail.topLine ?? detail.activeLine ?? 1);
      if (!targetLine || targetLine < 1) return;

      const { lineHeight, paddingTop } = readTextareaMetrics();
      applyingRemoteScrollRef.current = true;
      ta.scrollTop = scrollTopForTextareaLine(targetLine, lineHeight, paddingTop);
      if (lineGutterRef.current) {
        lineGutterRef.current.scrollTop = ta.scrollTop;
      }
      window.setTimeout(() => {
        applyingRemoteScrollRef.current = false;
      }, 80);
    };
    window.addEventListener(PANE_SYNC_EVENT, onPaneSync);
    return () => window.removeEventListener(PANE_SYNC_EVENT, onPaneSync);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Immediate save：插件态额外发 save-content，由 Host 立即写盘；勿仅靠本地 UI 标记
  const handleSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (onContentChange) {
      lastEmittedRef.current = editValue;
      onContentChange(editValue);
    }
    const vscode = getVsCodeApi();
    if (vscode) {
      pendingSaveContentRef.current = editValue;
      vscode.postMessage({
        type: 'save-content',
        content: editValue,
      });
      // 等待 Host content-saved 再标已保存；先进入 pending 避免假阳性
      setIsSaved(false);
      return;
    }
    setLastSavedContent(editValue);
    setIsSaved(true);
  }, [editValue, onContentChange]);

  useEffect(() => {
    const vscode = getVsCodeApi();
    if (!vscode) return undefined;
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type !== 'content-saved') return;
      if (message.ok) {
        const saved = pendingSaveContentRef.current ?? editValue;
        pendingSaveContentRef.current = null;
        setLastSavedContent(saved);
        setIsSaved(true);
      } else {
        pendingSaveContentRef.current = null;
        setIsSaved(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [editValue]);

  // Handle text change with real-time debounced sync (so split view renders live)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const selStart = e.target.selectionStart;
    const selEnd = e.target.selectionEnd;

    setEditValue(val);
    setIsSaved(false);

    // 记录到撤回/重做历史栈
    recordChange(val, selStart, selEnd, false);

    // Debounced sync to trigger live render in split mode / mindmap
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      lastEmittedRef.current = val;
      if (onContentChange) {
        onContentChange(val);
      }
    }, 250);
  };

  // 撤回 (Undo)
  const handleUndo = useCallback(() => {
    const snapshot = undo();
    if (!snapshot) return;

    setEditValue(snapshot.value);
    setIsSaved(false);

    // 实时同步触发右侧分屏预览/导图回退
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastEmittedRef.current = snapshot.value;
    if (onContentChange) {
      onContentChange(snapshot.value);
    }

    // 恢复光标位置
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      }
    });
  }, [undo, onContentChange]);

  // 重做 (Redo)
  const handleRedo = useCallback(() => {
    const snapshot = redo();
    if (!snapshot) return;

    setEditValue(snapshot.value);
    setIsSaved(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastEmittedRef.current = snapshot.value;
    if (onContentChange) {
      onContentChange(snapshot.value);
    }

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      }
    });
  }, [redo, onContentChange]);

  // Keyboard shortcut handlers (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Shift+Z, Ctrl+S, Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isModifier = e.ctrlKey || e.metaKey;

    // Ctrl+Z / Cmd+Z (非 Shift): 撤回 (Undo)
    if (isModifier && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleUndo();
      return;
    }

    // Ctrl+Y 或 Ctrl+Shift+Z / Cmd+Shift+Z: 重做 (Redo)
    if (
      (isModifier && e.key.toLowerCase() === 'y') ||
      (isModifier && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault();
      e.stopPropagation();
      handleRedo();
      return;
    }

    // Ctrl+S / Cmd+S: Save immediately
    if (isModifier && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
      return;
    }

    // Ctrl+F / Cmd+F: Toggle search
    if (isModifier && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      setIsSearching(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
      return;
    }

    // Tab key: Insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = editValue.substring(0, start) + '  ' + editValue.substring(end);
      const newCursor = start + 2;

      setEditValue(newValue);
      setIsSaved(false);
      recordChange(newValue, newCursor, newCursor, true);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        lastEmittedRef.current = newValue;
        if (onContentChange) {
          onContentChange(newValue);
        }
      }, 250);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = newCursor;
      });
    }
  };

  // Syntax highlighting for readonly mode
  const highlightedCode = React.useMemo(() => {
    if (isEditing) return null;
    try {
      const ext = extension.toLowerCase();
      let lang = 'markdown';
      if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) lang = 'typescript';
      else if (['json'].includes(ext)) lang = 'json';
      else if (['css', 'scss'].includes(ext)) lang = 'css';
      else if (['html', 'xml', 'svg'].includes(ext)) lang = 'markup';
      else if (['py'].includes(ext)) lang = 'python';

      const grammar = Prism.languages[lang] || Prism.languages.markdown || Prism.languages.text;
      if (grammar) {
        return Prism.highlight(activeContent, grammar, lang);
      }
    } catch {
      // fallback to plain text
    }
    return null;
  }, [activeContent, extension, isEditing]);

  // 只读模式 DOM 精准高亮与激活
  useEffect(() => {
    if (isEditing) return;
    if (!isSearching || !searchQuery.trim()) {
      clearSearchHighlights(codeBodyRef.current);
      setSearchMatchCount(0);
      setSearchMatchIndex(0);
      return;
    }
    const count = highlightSearchMatches(codeBodyRef.current, searchQuery);
    setSearchMatchCount(count);
    setSearchMatchIndex(count > 0 ? 0 : 0);
    if (count > 0) {
      activateMatch(codeBodyRef.current, 0, true);
    }
  }, [isSearching, searchQuery, isEditing, highlightedCode, activeContent]);

  // 响应式级别判定 (基于当前容器实际渲染宽度，完全免疫全局窗口视口影响)
  // >= 620: 宽裕态 (全部文字 + 快捷键)
  // 460 ~ 620: 次紧凑态 (主要按钮有文字，次要按钮转为图标，隐藏快捷键)
  // 360 ~ 460: 纯图标态 (所有按钮转为紧凑纯图标，完整保留 title 说明)
  // < 360: 极窄态 (次要操作折叠进更多菜单)
  const showShortcuts = headerWidth >= 620;
  const showSecondaryBtnText = headerWidth >= 580;
  const showPrimaryBtnText = headerWidth >= 460;
  const showLinesCount = headerWidth >= 520;
  const showExtensionBadge = headerWidth >= 400;
  const showStatusText = headerWidth >= 440;
  const isExtremelyNarrow = headerWidth < 360;

  return (
    <div
      id="code-viewer-container"
      className="h-full flex flex-col font-mono text-xs select-text relative transition-colors"
      style={{
        background: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
    >
      {/* Code Header (自适应容器工具栏) */}
      <div
        ref={headerRef}
        className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 border-b text-xs shrink-0 select-none min-w-0 transition-colors"
        style={{
          background: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
      >
        {/* 左侧元信息 */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 mr-2 overflow-hidden">
          <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ov-accent)' }} />
          <span className="font-semibold truncate" style={{ color: 'var(--ov-text)' }} title={fileName}>
            {fileName}
          </span>
          {showExtensionBadge && (
            <>
              <span style={{ color: 'var(--ov-border)' }} className="shrink-0">|</span>
              <span className="uppercase text-[11px] font-sans shrink-0" style={{ color: 'var(--ov-text-secondary)' }}>
                {extension}
              </span>
            </>
          )}
          {showLinesCount && (
            <>
              <span style={{ color: 'var(--ov-border)' }} className="shrink-0">|</span>
              <span className="font-sans shrink-0" style={{ color: 'var(--ov-text-secondary)' }}>
                {lines.length} {t('linesCodeCount', locale)}
              </span>
            </>
          )}
          {onContentChange && (
            <>
              <span style={{ color: 'var(--ov-border)' }} className="shrink-0">|</span>
              {isSaved ? (
                <span
                  className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 text-[11px] font-sans shrink-0"
                  title={t('saved', locale)}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {showStatusText && <span>{t('saved', locale)}</span>}
                </span>
              ) : (
                <span
                  className="flex items-center gap-1 text-amber-500 dark:text-amber-400 text-[11px] font-sans shrink-0"
                  title={t('unsavedChanges', locale)}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  {showStatusText && <span>{t('unsavedChanges', locale)}</span>}
                </span>
              )}
            </>
          )}
        </div>

        {/* 右侧操作按钮组 (随空间自动调整：纯图标 / 折叠 / 隐藏次要文字) */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {/* Undo / Redo History Controls */}
          {onContentChange && isEditing && !isExtremelyNarrow && (
            <div className="flex items-center gap-0.5 pr-1 mr-0.5 border-r" style={{ borderColor: 'var(--ov-border)' }}>
              <button
                id="btn-code-undo"
                onClick={handleUndo}
                disabled={!canUndo}
                title={t('undoTooltip', locale)}
                className="p-1 rounded transition text-xs flex items-center cursor-pointer hover:bg-[var(--ov-surface-hover)]"
                style={{
                  color: canUndo ? 'var(--ov-text)' : 'var(--ov-text-muted)',
                  opacity: canUndo ? 1 : 0.4,
                  cursor: canUndo ? 'pointer' : 'not-allowed',
                }}
                aria-label={t('undo', locale)}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                id="btn-code-redo"
                onClick={handleRedo}
                disabled={!canRedo}
                title={t('redoTooltip', locale)}
                className="p-1 rounded transition text-xs flex items-center cursor-pointer hover:bg-[var(--ov-surface-hover)]"
                style={{
                  color: canRedo ? 'var(--ov-text)' : 'var(--ov-text-muted)',
                  opacity: canRedo ? 1 : 0.4,
                  cursor: canRedo ? 'pointer' : 'not-allowed',
                }}
                aria-label={t('redo', locale)}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Save Button */}
          {onContentChange && (
            <button
              id="btn-code-save"
              onClick={handleSave}
              title={t('saveShortcutTooltip', locale)}
              className={`flex items-center gap-1 ${
                showPrimaryBtnText ? 'px-2.5 py-1' : 'p-1.5'
              } rounded text-xs transition font-medium cursor-pointer border`}
              style={{
                background: !isSaved ? 'var(--ov-accent)' : 'var(--ov-surface)',
                borderColor: !isSaved ? 'var(--ov-accent)' : 'var(--ov-border)',
                color: !isSaved ? '#ffffff' : 'var(--ov-text)',
              }}
              aria-label={t('saveChanges', locale)}
            >
              <Save className="w-3.5 h-3.5" />
              {showPrimaryBtnText && <span>{t('saveChanges', locale)}</span>}
              {showShortcuts && (
                <kbd
                  className="ml-1 text-[10px] px-1 py-0.2 rounded border"
                  style={{
                    background: 'var(--ov-code-bg)',
                    borderColor: 'var(--ov-border)',
                    color: !isSaved ? '#ffffff' : 'var(--ov-text-secondary)',
                  }}
                >
                  ⌘S
                </kbd>
              )}
            </button>
          )}

          {/* Toggle Edit / Readonly View */}
          {onContentChange && (
            <button
              id="btn-code-toggle-edit"
              onClick={() => {
                if (isEditing) {
                  handleSave();
                }
                setIsEditing(!isEditing);
              }}
              className={`flex items-center gap-1 ${
                showPrimaryBtnText ? 'px-2 py-1' : 'p-1.5'
              } rounded transition text-xs cursor-pointer border hover:bg-[var(--ov-surface-hover)]`}
              style={{
                background: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              title={isEditing ? t('viewReadonly', locale) : t('editSource', locale)}
              aria-label={isEditing ? t('viewReadonly', locale) : t('editSource', locale)}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-blue-500" />}
              {showPrimaryBtnText && <span>{isEditing ? t('viewReadonly', locale) : t('editSource', locale)}</span>}
            </button>
          )}

          {/* 在编辑器中打开 */}
          {onOpenInEditor && !isExtremelyNarrow && (
            <button
              type="button"
              id="btn-code-open-in-native-editor"
              onClick={onOpenInEditor}
              className={`flex items-center gap-1 ${
                showSecondaryBtnText ? 'px-2 py-1' : 'p-1.5'
              } rounded transition text-xs cursor-pointer border hover:bg-[var(--ov-surface-hover)]`}
              style={{
                background: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              title={t('openInEditor', locale) || '在编辑器中打开'}
              aria-label={t('openInEditor', locale) || '在编辑器中打开'}
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
              {showSecondaryBtnText && <span>{t('openInEditor', locale) || '在编辑器中打开'}</span>}
            </button>
          )}

          {/* 查找按钮 (Ctrl+F) */}
          {!isExtremelyNarrow && (
            <button
              id="btn-code-search"
              onClick={() => {
                setIsSearching(prev => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => {
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    }, 50);
                  } else {
                    handleCloseSearch();
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-1 ${
                showSecondaryBtnText ? 'px-2 py-1' : 'p-1.5'
              } rounded transition text-xs cursor-pointer border`}
              style={{
                background: isSearching ? 'rgba(59, 130, 246, 0.15)' : 'var(--ov-surface)',
                borderColor: isSearching ? 'var(--ov-accent)' : 'var(--ov-border)',
                color: isSearching ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              title="查找 (Ctrl+F)"
              aria-label="查找 (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
              {showSecondaryBtnText && <span>查找</span>}
            </button>
          )}

          {/* 复制代码 */}
          {!isExtremelyNarrow && (
            <button
              id="btn-code-copy"
              onClick={handleCopy}
              className={`flex items-center gap-1 ${
                showSecondaryBtnText ? 'px-2 py-1' : 'p-1.5'
              } rounded transition text-xs cursor-pointer border hover:bg-[var(--ov-surface-hover)]`}
              style={{
                background: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              title={copied ? t('copied', locale) : t('copyCode2', locale)}
              aria-label={copied ? t('copied', locale) : t('copyCode2', locale)}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {showSecondaryBtnText && <span>{copied ? t('copied', locale) : t('copyCode2', locale)}</span>}
            </button>
          )}

          {/* 极窄模式更多菜单 (< 360px) */}
          {isExtremelyNarrow && (
            <div ref={moreMenuRef} className="relative">
              <button
                type="button"
                id="btn-code-more-menu"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                className="p-1.5 rounded transition text-xs cursor-pointer border hover:bg-[var(--ov-surface-hover)]"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                title="更多操作"
                aria-label="更多操作"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {isMoreMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md shadow-xl py-1 text-xs border"
                  style={{
                    background: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsSearching(true);
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                        searchInputRef.current?.select();
                      }, 50);
                    }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-[var(--ov-surface-hover)]"
                    style={{ color: 'var(--ov-text)' }}
                  >
                    <Search className="w-3.5 h-3.5 text-sky-500" />
                    <span>查找 (Ctrl+F)</span>
                  </button>
                  {onOpenInEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenInEditor();
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-[var(--ov-surface-hover)]"
                      style={{ color: 'var(--ov-text)' }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
                      <span>{t('openInEditor', locale) || '在编辑器中打开'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      handleCopy();
                    }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-[var(--ov-surface-hover)]"
                    style={{ color: 'var(--ov-text)' }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t('copied', locale) : t('copyCode2', locale)}</span>
                  </button>
                  {onContentChange && isEditing && (
                    <>
                      <div className="border-t my-1" style={{ borderColor: 'var(--ov-border)' }} />
                      <button
                        type="button"
                        disabled={!canUndo}
                        onClick={() => {
                          handleUndo();
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--ov-surface-hover)]"
                        style={{
                          color: canUndo ? 'var(--ov-text)' : 'var(--ov-text-muted)',
                          opacity: canUndo ? 1 : 0.4,
                          cursor: canUndo ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>{t('undo', locale)}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canRedo}
                        onClick={() => {
                          handleRedo();
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--ov-surface-hover)]"
                        style={{
                          color: canRedo ? 'var(--ov-text)' : 'var(--ov-text-muted)',
                          opacity: canRedo ? 1 : 0.4,
                          cursor: canRedo ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                        <span>{t('redo', locale)}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 浮动查找面板 (Ctrl+F) */}
      {isSearching && (
        <div
          className="absolute top-10 right-4 z-40 rounded-lg shadow-xl px-2.5 py-1.5 flex items-center gap-2 text-xs border select-none"
          style={{
            background: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ov-text-muted)' }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索文本 (Enter 下一个)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handlePrevMatch();
                } else {
                  handleNextMatch();
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCloseSearch();
              }
            }}
            className="w-36 sm:w-48 border rounded px-2 py-0.5 text-[11px] focus:outline-hidden font-sans"
            style={{
              background: 'var(--ov-code-bg)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
          />
          <span className="text-[10px] shrink-0 min-w-[40px] text-center font-mono" style={{ color: 'var(--ov-text-secondary)' }}>
            {searchQuery.trim()
              ? searchMatchCount > 0
                ? `${searchMatchIndex + 1}/${searchMatchCount}`
                : '无匹配'
              : ''}
          </span>
          <div className="flex items-center gap-0.5 border-l pl-1" style={{ borderColor: 'var(--ov-border)' }}>
            <button
              onClick={handlePrevMatch}
              disabled={searchMatchCount === 0}
              className="p-1 rounded cursor-pointer hover:bg-[var(--ov-surface-hover)]"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="上一个 (Shift+Enter)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={searchMatchCount === 0}
              className="p-1 rounded cursor-pointer hover:bg-[var(--ov-surface-hover)]"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="下一个 (Enter)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCloseSearch}
              className="p-1 rounded cursor-pointer hover:bg-[var(--ov-surface-hover)]"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="关闭 (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor / Readonly View Body */}
      {isEditing ? (
        <div id="code-viewer-canvas" className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <div className="flex-1 min-h-0 flex overflow-hidden relative">
            {/* Synchronized Line Numbers Gutter */}
            <div
              ref={lineGutterRef}
              className="py-3 pl-2 pr-3 text-right select-none border-r font-mono text-xs leading-relaxed shrink-0 min-w-[44px] overflow-hidden"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-muted)',
              }}
            >
              {lines.map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Textarea Editor */}
            <textarea
              ref={textareaRef}
              id="code-editor-textarea"
              value={editValue}
              onChange={handleChange}
              onScroll={handleScroll}
              onSelect={handleSelect}
              onKeyUp={handleSelect}
              onClick={handleSelect}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoFocus
              className="flex-1 w-full p-3 font-mono text-xs leading-relaxed resize-none outline-none border-0 overflow-y-auto selection:bg-blue-600 selection:text-white"
              style={{
                background: 'var(--ov-bg)',
                color: 'var(--ov-text)',
              }}
              placeholder="在此输入或编辑内容..."
            />
          </div>
        </div>
      ) : (
        <div id="code-viewer-canvas" ref={codeBodyRef} className="flex-1 min-h-0 overflow-auto flex">
          {/* Readonly Line Numbers */}
          <div
            className="py-3 pl-2 pr-3 text-right select-none border-r font-mono text-xs leading-relaxed shrink-0 min-w-[44px]"
            style={{
              background: 'var(--ov-code-bg)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-muted)',
            }}
          >
            {lines.map((_, i) => (
              <div key={i} className="leading-relaxed">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Readonly Code Body */}
          <div className="flex-1 p-3 overflow-x-auto selection:bg-blue-600 selection:text-white">
            {highlightedCode ? (
              <pre className="leading-relaxed font-mono m-0 p-0 bg-transparent">
                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              </pre>
            ) : (
              <pre className="leading-relaxed font-mono m-0 p-0 bg-transparent" style={{ color: 'var(--ov-text)' }}>
                <code>{activeContent}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
