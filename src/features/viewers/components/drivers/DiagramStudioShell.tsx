/**
 * 图表源码工作室外壳（对齐 MindmapViewer 分屏体验）
 * 左：DSL 编辑；右：实时预览；支持 split / preview / editor
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Code, Columns, Copy, Eye, FileCode, Sparkles, Undo2, Redo2, ExternalLink } from 'lucide-react';
import { useTextHistory } from '../../hooks/useTextHistory';
import { useContainerWidth } from '../../hooks/useContainerWidth';

export type DiagramStudioMode = 'split' | 'preview' | 'editor';

export interface DiagramSnippet {
  label: string;
  code: string;
  tooltip: string;
}

interface DiagramStudioShellProps {
  title: string;
  fileName: string;
  content: string;
  onContentChange?: (content: string) => void;
  onOpenInEditor?: () => void;
  storageKeyPrefix: string;
  languageLabel: string;
  placeholder: string;
  accentClass?: string;
  snippets?: DiagramSnippet[];
  defaultTemplate?: string;
  renderPreview: (code: string) => React.ReactNode;
}

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(85, Math.max(15, Math.round(n)));
  } catch {
    return fallback;
  }
}

function loadMode(key: string, fallback: DiagramStudioMode): DiagramStudioMode {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'split' || raw === 'preview' || raw === 'editor') return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export const DiagramStudioShell: React.FC<DiagramStudioShellProps> = ({
  title,
  fileName,
  content,
  onContentChange,
  onOpenInEditor,
  storageKeyPrefix,
  languageLabel,
  placeholder,
  accentClass = 'cyan',
  snippets = [],
  defaultTemplate,
  renderPreview,
}) => {
  const modeKey = `omniview_${storageKeyPrefix}_view_mode`;
  const splitKey = `omniview_${storageKeyPrefix}_split`;

  const [localCode, setLocalCode] = useState(content);
  const [viewMode, setViewMode] = useState<DiagramStudioMode>(() => loadMode(modeKey, 'preview'));
  const [splitRatio, setSplitRatio] = useState(() => loadNumber(splitKey, 42));
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSynced, setIsSynced] = useState(true);

  const [headerRef, headerWidth] = useContainerWidth<HTMLElement>(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextExternalSync = useRef(false);

  // 接入通用受控历史栈 (TextHistoryStack)
  const {
    canUndo,
    canRedo,
    recordChange,
    undo,
    redo,
    reset: resetHistory,
  } = useTextHistory(content, { maxDepth: 100, mergeThresholdMs: 500 });

  useEffect(() => {
    if (skipNextExternalSync.current) {
      skipNextExternalSync.current = false;
      return;
    }
    if (content !== localCode && isSynced) {
      setLocalCode(content);
      resetHistory(content);
    }
  }, [content, isSynced, localCode, resetHistory]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const persistMode = (mode: DiagramStudioMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(modeKey, mode);
    } catch {
      /* ignore */
    }
  };

  const persistSplit = (ratio: number) => {
    const clamped = Math.min(85, Math.max(15, Math.round(ratio)));
    setSplitRatio(clamped);
    try {
      localStorage.setItem(splitKey, String(clamped));
    } catch {
      /* ignore */
    }
  };

  const handleCodeChange = useCallback(
    (newCode: string, forceNewSnapshot = false) => {
      setLocalCode(newCode);
      setIsSynced(false);
      const selStart = textareaRef.current?.selectionStart;
      const selEnd = textareaRef.current?.selectionEnd;
      recordChange(newCode, selStart, selEnd, forceNewSnapshot);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        skipNextExternalSync.current = true;
        onContentChange?.(newCode);
        setIsSynced(true);
      }, 350);
    },
    [onContentChange, recordChange]
  );

  const handleUndo = useCallback(() => {
    const snapshot = undo();
    if (!snapshot) return;
    setLocalCode(snapshot.value);
    setIsSynced(false);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      skipNextExternalSync.current = true;
      onContentChange?.(snapshot.value);
      setIsSynced(true);
    }, 200);

    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea && snapshot.selectionStart !== undefined) {
        textarea.focus();
        textarea.setSelectionRange(
          snapshot.selectionStart,
          snapshot.selectionEnd ?? snapshot.selectionStart
        );
      }
    }, 10);
  }, [undo, onContentChange]);

  const handleRedo = useCallback(() => {
    const snapshot = redo();
    if (!snapshot) return;
    setLocalCode(snapshot.value);
    setIsSynced(false);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      skipNextExternalSync.current = true;
      onContentChange?.(snapshot.value);
      setIsSynced(true);
    }, 200);

    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea && snapshot.selectionStart !== undefined) {
        textarea.focus();
        textarea.setSelectionRange(
          snapshot.selectionStart,
          snapshot.selectionEnd ?? snapshot.selectionStart
        );
      }
    }, 10);
  }, [redo, onContentChange]);

  const handleInsertSnippet = (snippetCode: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleCodeChange(localCode + snippetCode, true);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = localCode.substring(0, start) + snippetCode + localCode.substring(end);
    handleCodeChange(updated, true);
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + snippetCode.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 撤销 / 重做快捷键处理 (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z)
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
    }

    if (e.key !== 'Tab') return;
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (e.shiftKey) {
      const lines = localCode.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      if (currentLine.startsWith('  ')) {
        const lineStartPos = start - currentLine.length;
        const updated =
          localCode.substring(0, lineStartPos) + currentLine.substring(2) + localCode.substring(start);
        handleCodeChange(updated);
        setTimeout(() => {
          textarea.setSelectionRange(Math.max(0, start - 2), Math.max(0, end - 2));
        }, 0);
      }
      return;
    }
    const updated = localCode.substring(0, start) + '  ' + localCode.substring(end);
    handleCodeChange(updated);
    setTimeout(() => {
      textarea.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      persistSplit(ratio);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const handleResetTemplate = () => {
    if (!defaultTemplate) return;
    handleCodeChange(defaultTemplate);
  };

  const accentBtn =
    accentClass === 'emerald'
      ? 'bg-emerald-600'
      : accentClass === 'violet'
        ? 'bg-violet-600'
        : 'bg-cyan-600';
  const accentSoft =
    accentClass === 'emerald'
      ? 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border-emerald-500/40'
      : accentClass === 'violet'
        ? 'bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border-violet-500/40'
        : 'bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border-cyan-500/40';
  const accentText =
    accentClass === 'emerald' ? 'text-emerald-400' : accentClass === 'violet' ? 'text-violet-400' : 'text-cyan-400';

  const lineCount = Math.max(1, localCode.split('\n').length);
  const charCount = localCode.length;

  const showModeLabels = headerWidth >= 680;
  const showRatios = headerWidth >= 760;
  const showTemplateText = headerWidth >= 580;
  const showEditorText = headerWidth >= 600;
  const showCopyText = headerWidth >= 500;
  const showStatusBadge = headerWidth >= 420;

  return (
    <div
      id="diagram-studio-shell"
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full min-h-0 flex flex-col"
      data-file={fileName}
    >
      <header
        ref={headerRef}
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center justify-between gap-2 px-3 py-1.5 border-b text-xs shrink-0 select-none min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden mr-2">
          <span className={`font-semibold ${accentText} truncate shrink-0`}>{title}</span>
          <span style={{ color: 'var(--ov-border)' }} className="shrink-0">|</span>
          <span style={{ color: 'var(--ov-text-secondary)' }} className="font-mono truncate" title={fileName}>{fileName}</span>
          {showStatusBadge && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                isSynced ? 'border-emerald-800 text-emerald-400/90' : 'border-amber-800 text-amber-300'
              }`}
            >
              {isSynced ? '已同步' : '编辑中…'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center border rounded-lg p-0.5 gap-0.5"
          >
            <button
              type="button"
              onClick={() => persistMode('preview')}
              style={{
                backgroundColor: viewMode === 'preview' ? 'var(--ov-accent, #06b6d4)' : 'transparent',
                color: viewMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2' : 'p-1.5'} py-1 rounded transition hover:text-[var(--ov-text)]`}
              title="全屏高清渲染预览 (方案A默认推荐模式)"
              aria-label="全屏预览"
            >
              <Eye className="w-3.5 h-3.5" />
              {showModeLabels && <span>全屏预览</span>}
            </button>
            <button
              type="button"
              onClick={() => persistMode('split')}
              style={{
                backgroundColor: viewMode === 'split' ? 'var(--ov-accent, #06b6d4)' : 'transparent',
                color: viewMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2' : 'p-1.5'} py-1 rounded transition hover:text-[var(--ov-text)]`}
              title="内置简易编辑分屏"
              aria-label="内置分屏"
            >
              <Columns className="w-3.5 h-3.5" />
              {showModeLabels && <span>内置分屏</span>}
            </button>
            <button
              type="button"
              onClick={() => persistMode('editor')}
              style={{
                backgroundColor: viewMode === 'editor' ? 'var(--ov-accent, #06b6d4)' : 'transparent',
                color: viewMode === 'editor' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2' : 'p-1.5'} py-1 rounded transition hover:text-[var(--ov-text)]`}
              title="仅查看内置源码"
              aria-label="内置源码"
            >
              <Code className="w-3.5 h-3.5" />
              {showModeLabels && <span>内置源码</span>}
            </button>
          </div>

          {viewMode === 'split' && showRatios && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="flex items-center gap-1 px-1 py-0.5 rounded border text-[10px] font-mono"
            >
              {[30, 50, 70].map(ratio => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => persistSplit(ratio)}
                  style={{
                    backgroundColor: splitRatio === ratio ? 'var(--ov-accent, #06b6d4)' : 'transparent',
                    color: splitRatio === ratio ? '#ffffff' : 'var(--ov-text-secondary)',
                  }}
                  className="px-1.5 py-0.5 rounded transition hover:text-[var(--ov-text)]"
                >
                  {ratio}:{100 - ratio}
                </button>
              ))}
            </div>
          )}

          {defaultTemplate && (
            <button
              type="button"
              onClick={handleResetTemplate}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1 ${showTemplateText ? 'px-2 py-1' : 'p-1.5'} rounded border transition hover:border-[var(--ov-accent)]`}
              title="重置为标准模板"
              aria-label="模板"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {showTemplateText && <span>模板</span>}
            </button>
          )}

          {onOpenInEditor && (
            <button
              type="button"
              id="btn-diagram-open-in-native-editor"
              onClick={onOpenInEditor}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1 ${showEditorText ? 'px-2.5 py-1' : 'p-1.5'} rounded border transition text-xs font-medium cursor-pointer hover:border-sky-500 hover:text-sky-400`}
              title="在 VS Code 原生文本编辑器中并排编辑"
              aria-label="在编辑器中打开"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              {showEditorText && <span>在编辑器中打开</span>}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className={`flex items-center gap-1 ${showCopyText ? 'px-2.5 py-1' : 'p-1.5'} rounded border transition shrink-0 font-medium hover:border-[var(--ov-accent)]`}
            title="复制源码"
            aria-label="复制源码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {showCopyText && <span>{copied ? '已复制' : '复制源码'}</span>}
          </button>
        </div>
      </header>

      <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden relative">
        {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize select-none" />}

        {(viewMode === 'split' || viewMode === 'editor') && (
          <div
            style={{
              width: viewMode === 'editor' ? '100%' : `${splitRatio}%`,
              backgroundColor: 'var(--ov-surface)',
              borderRightColor: 'var(--ov-border)',
            }}
            className="flex flex-col min-w-0 h-full border-r"
          >
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderBottomColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="px-3 py-1.5 border-b text-[11px] font-mono flex items-center justify-between shrink-0"
            >
              <span className={`truncate flex items-center gap-1.5 ${accentText} font-semibold`}>
                <FileCode className="w-3.5 h-3.5" />
                {languageLabel} ({lineCount} 行 · {charCount} 字符)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  style={{ color: canUndo ? 'var(--ov-text)' : 'var(--ov-text-muted)' }}
                  className={`p-1 rounded transition ${
                    canUndo ? 'hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]' : 'cursor-not-allowed opacity-40'
                  }`}
                  title="撤销 (Ctrl+Z)"
                  aria-label="撤销"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  style={{ color: canRedo ? 'var(--ov-text)' : 'var(--ov-text-muted)' }}
                  className={`p-1 rounded transition ${
                    canRedo ? 'hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]' : 'cursor-not-allowed opacity-40'
                  }`}
                  title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
                  aria-label="重做"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <span style={{ color: 'var(--ov-border)' }}>|</span>
                <span style={{ color: 'var(--ov-text-muted)' }} className="hidden sm:inline">Tab 缩进 / Shift+Tab 反缩进</span>
              </div>
            </div>

            {snippets.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderBottomColor: 'var(--ov-border)',
                }}
                className="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto no-scrollbar shrink-0"
              >
                <span style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono px-1 shrink-0">片段:</span>
                {snippets.map((snippet, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertSnippet(snippet.code)}
                    style={{
                      backgroundColor: 'var(--ov-surface-header)',
                      borderColor: 'var(--ov-border)',
                      color: 'var(--ov-text-secondary)',
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0 transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                    title={snippet.tooltip}
                  >
                    {snippet.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={localCode}
              onChange={e => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--ov-text)',
              }}
              className="flex-1 p-3.5 font-mono text-xs resize-none outline-none leading-relaxed selection:bg-[var(--ov-accent)] selection:text-white"
              placeholder={placeholder}
            />
          </div>
        )}

        {viewMode === 'split' && (
          <div
            onMouseDown={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDoubleClick={() => persistSplit(50)}
            title="拖拽调节分屏比例 | 双击复位 50%"
            style={{
              backgroundColor: isDragging ? 'var(--ov-accent)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
            }}
            className="relative z-20 w-2 shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors border-x group"
          >
            <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-10 w-1 rounded-full group-hover:bg-[var(--ov-accent)] transition-colors" />
          </div>
        )}

        {(viewMode === 'split' || viewMode === 'preview') && (
          <div
            style={{
              width: viewMode === 'preview' ? '100%' : `${100 - splitRatio}%`,
              backgroundColor: 'var(--ov-bg)',
            }}
            className="flex flex-col min-w-0 h-full overflow-hidden"
          >
            {renderPreview(localCode)}
          </div>
        )}
      </div>
    </div>
  );
};
