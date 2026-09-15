import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Copy, Check, FileCode, Save, Eye, Edit3, CheckCircle2, Loader2, Undo2, Redo2 } from 'lucide-react';
import Prism from 'prismjs';
import { Locale, t } from '../../../../shared/lib/i18n';
import { ThemeId, DensityMode } from '../../../../shared/types';
import { useTextHistory } from '../../hooks/useTextHistory';
import { getVsCodeApi } from '../../../../shared/lib/vscode';
import { loadStoredSettings } from '../../../../shared/lib/settingsStorage';
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

  return (
    <div id="code-viewer-container" className="h-full flex flex-col bg-slate-950 font-mono text-xs text-slate-300 select-text">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate max-w-[180px]">{fileName}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 uppercase text-[11px] font-sans">{extension}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-sans">
            {lines.length} {t('linesCodeCount', locale)}
          </span>
          {onContentChange && (
            <>
              <span className="text-slate-600">|</span>
              {isSaved ? (
                <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-sans">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{t('saved', locale)}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 text-[11px] font-sans">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{t('unsavedChanges', locale)}</span>
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo / Redo History Controls */}
          {onContentChange && isEditing && (
            <div className="flex items-center gap-0.5 pr-1 mr-0.5 border-r border-slate-800">
              <button
                id="btn-code-undo"
                onClick={handleUndo}
                disabled={!canUndo}
                title={t('undoTooltip', locale)}
                className={`p-1 rounded transition text-xs flex items-center ${
                  canUndo
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer'
                    : 'text-slate-600 cursor-not-allowed opacity-40'
                }`}
                aria-label={t('undo', locale)}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                id="btn-code-redo"
                onClick={handleRedo}
                disabled={!canRedo}
                title={t('redoTooltip', locale)}
                className={`p-1 rounded transition text-xs flex items-center ${
                  canRedo
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer'
                    : 'text-slate-600 cursor-not-allowed opacity-40'
                }`}
                aria-label={t('redo', locale)}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Save Button (when content is modifiable) */}
          {onContentChange && (
            <button
              id="btn-code-save"
              onClick={handleSave}
              title={t('saveShortcutTooltip', locale)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition font-medium ${
                !isSaved
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('saveChanges', locale)}</span>
              <kbd className="hidden sm:inline-block ml-1 text-[10px] text-slate-300 bg-slate-900/60 px-1 py-0.2 rounded border border-slate-700">
                ⌘S
              </kbd>
            </button>
          )}

          {/* Toggle Edit / Readonly View */}
          {onContentChange && (
            <button
              id="btn-code-toggle-edit"
              onClick={() => {
                if (isEditing) {
                  // flush edits when switching to readonly
                  handleSave();
                }
                setIsEditing(!isEditing);
              }}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition text-xs"
              title={isEditing ? t('viewReadonly', locale) : t('editSource', locale)}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5 text-slate-300" /> : <Edit3 className="w-3.5 h-3.5 text-blue-400" />}
              <span>{isEditing ? t('viewReadonly', locale) : t('editSource', locale)}</span>
            </button>
          )}

          {/* Copy Code */}
          <button
            id="btn-code-copy"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('copied', locale) : t('copyCode2', locale)}</span>
          </button>
        </div>
      </div>

      {/* Editor / Readonly View Body */}
      {isEditing ? (
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* Synchronized Line Numbers Gutter */}
          <div
            ref={lineGutterRef}
            className="py-3 pl-2 pr-3 text-right text-slate-600 select-none bg-slate-900/60 border-r border-slate-800 font-mono text-xs leading-relaxed shrink-0 min-w-[44px] overflow-hidden"
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
            className="flex-1 w-full p-3 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed resize-none outline-none border-0 overflow-y-auto selection:bg-blue-600 selection:text-white"
            placeholder="在此输入或编辑内容..."
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto flex">
          {/* Readonly Line Numbers */}
          <div className="py-3 pl-2 pr-3 text-right text-slate-600 select-none bg-slate-900/40 border-r border-slate-800/80 font-mono text-xs leading-relaxed shrink-0 min-w-[44px]">
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
              <pre className="leading-relaxed font-mono m-0 p-0 bg-transparent text-slate-200">
                <code>{activeContent}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
