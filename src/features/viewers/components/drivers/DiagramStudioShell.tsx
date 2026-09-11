/**
 * 图表源码工作室外壳（对齐 MindmapViewer 分屏体验）
 * 左：DSL 编辑；右：实时预览；支持 split / preview / editor
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Code, Columns, Copy, Eye, FileCode, Sparkles } from 'lucide-react';

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
  const [viewMode, setViewMode] = useState<DiagramStudioMode>(() => loadMode(modeKey, 'split'));
  const [splitRatio, setSplitRatio] = useState(() => loadNumber(splitKey, 42));
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSynced, setIsSynced] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextExternalSync = useRef(false);

  useEffect(() => {
    if (skipNextExternalSync.current) {
      skipNextExternalSync.current = false;
      return;
    }
    if (content !== localCode && isSynced) {
      setLocalCode(content);
    }
  }, [content, isSynced, localCode]);

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
    (newCode: string) => {
      setLocalCode(newCode);
      setIsSynced(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        skipNextExternalSync.current = true;
        onContentChange?.(newCode);
        setIsSynced(true);
      }, 350);
    },
    [onContentChange]
  );

  const handleInsertSnippet = (snippetCode: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleCodeChange(localCode + snippetCode);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = localCode.substring(0, start) + snippetCode + localCode.substring(end);
    handleCodeChange(updated);
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + snippetCode.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea || e.key !== 'Tab') return;
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

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950 text-slate-200" data-file={fileName}>
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-semibold ${accentText} truncate`}>{title}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-mono truncate max-w-[180px]">{fileName}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isSynced ? 'border-emerald-800 text-emerald-400/90' : 'border-amber-800 text-amber-300'
            }`}
          >
            {isSynced ? '已同步' : '编辑中…'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => persistMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                viewMode === 'split' ? `${accentBtn} text-white font-medium` : 'text-slate-400 hover:text-slate-200'
              }`}
              title="源码与预览分屏"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">分屏</span>
            </button>
            <button
              type="button"
              onClick={() => persistMode('preview')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                viewMode === 'preview' ? `${accentBtn} text-white font-medium` : 'text-slate-400 hover:text-slate-200'
              }`}
              title="仅预览"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">预览</span>
            </button>
            <button
              type="button"
              onClick={() => persistMode('editor')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                viewMode === 'editor' ? `${accentBtn} text-white font-medium` : 'text-slate-400 hover:text-slate-200'
              }`}
              title="仅编辑源码"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden md:inline">源码</span>
            </button>
          </div>

          {viewMode === 'split' && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
              {[30, 50, 70].map(ratio => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => persistSplit(ratio)}
                  className={`px-1.5 py-0.5 rounded transition ${
                    splitRatio === ratio ? `${accentBtn} text-white font-medium` : 'text-slate-400 hover:text-slate-200'
                  }`}
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
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 transition"
              title="重置为标准模板"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">模板</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border transition shrink-0 font-medium ${accentSoft}`}
            title="复制源码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制源码'}</span>
          </button>
        </div>
      </header>

      <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden relative">
        {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize select-none" />}

        {(viewMode === 'split' || viewMode === 'editor') && (
          <div
            style={{ width: viewMode === 'editor' ? '100%' : `${splitRatio}%` }}
            className="flex flex-col bg-slate-900/40 min-w-0 h-full border-r border-slate-800/80"
          >
            <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between shrink-0">
              <span className={`truncate flex items-center gap-1.5 ${accentText} font-semibold`}>
                <FileCode className="w-3.5 h-3.5" />
                {languageLabel} ({lineCount} 行 · {charCount} 字符)
              </span>
              <span className="text-slate-500 hidden sm:inline">Tab 缩进 / Shift+Tab 反缩进</span>
            </div>

            {snippets.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-950/90 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] text-slate-500 font-mono px-1 shrink-0">片段:</span>
                {snippets.map((snippet, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertSnippet(snippet.code)}
                    className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-800 shrink-0 transition"
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
              className="flex-1 p-3.5 bg-transparent font-mono text-xs text-slate-200 resize-none outline-none leading-relaxed selection:bg-cyan-600 selection:text-white"
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
            className={`relative z-20 w-2 shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors border-x border-slate-800/80 group ${
              isDragging ? `${accentBtn} shadow-md` : 'bg-slate-900 hover:bg-cyan-600/80'
            }`}
          >
            <div className="h-10 w-1 rounded-full bg-slate-600 group-hover:bg-cyan-200 transition-colors" />
          </div>
        )}

        {(viewMode === 'split' || viewMode === 'preview') && (
          <div
            style={{ width: viewMode === 'preview' ? '100%' : `${100 - splitRatio}%` }}
            className="flex flex-col bg-slate-950 min-w-0 h-full overflow-hidden"
          >
            {renderPreview(localCode)}
          </div>
        )}
      </div>
    </div>
  );
};
