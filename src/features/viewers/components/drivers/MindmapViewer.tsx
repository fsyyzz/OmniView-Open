/**
 * OmniView 独立思维导图驱动与分屏工作台 (Mindmap Studio)
 * 支持 .markmap, .mm, .mindmap, .km 等后缀文件
 * 提供 DSL 代码与实时矢量思维导图双向编辑、快捷大纲片段插入、节点折叠/搜索与多格式导出
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GitFork,
  Code,
  Eye,
  Columns,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Heading1,
  Heading2,
  CheckSquare,
  Link,
  Tag,
  Sparkles,
  FileCode,
  Layers,
} from 'lucide-react';
import { ThemeId, DensityMode } from '../../../../shared/types';
import { Locale, t } from '../../../../shared/lib/i18n';
import { loadStoredSettings, saveStoredSettings } from '../../../../shared/lib/settingsStorage';
import { MarkmapViewer } from './MarkmapViewer';

interface MindmapViewerProps {
  content: string;
  fileName?: string;
  extension?: string;
  isDarkTheme?: boolean;
  theme?: ThemeId;
  density?: DensityMode;
  locale?: Locale;
  onContentChange?: (content: string) => void;
}

type MindmapViewMode = 'split' | 'mindmap' | 'editor';

interface Snippet {
  label: string;
  code: string;
  tooltip: string;
}

const MINDMAP_SNIPPETS: Snippet[] = [
  {
    label: '+ 子节点',
    code: '\n  - 新子分支主题',
    tooltip: '在当前层级下方插入缩进子分支',
  },
  {
    label: '+ 同级节点',
    code: '\n- 新同级主题',
    tooltip: '插入同级列表节点',
  },
  {
    label: '# 一级大纲',
    code: '\n# 核心根主题',
    tooltip: '创建一级根主题节点',
  },
  {
    label: '## 二级分支',
    code: '\n## 重点分支主题',
    tooltip: '创建二级主干分支',
  },
  {
    label: '[ ] 任务复选',
    code: '\n  - [ ] 关键待办里程碑',
    tooltip: '插入带有可交互复选框的任务节点',
  },
  {
    label: '超链接',
    code: ' [参考资料](https://example.com)',
    tooltip: '插入可点击的超链接节点',
  },
  {
    label: '#标签',
    code: ' `#重要`',
    tooltip: '插入彩色高亮分类标签',
  },
  {
    label: '行内代码',
    code: ' `const engine = true;`',
    tooltip: '插入等宽语法代码节点',
  },
];

const DEFAULT_MINDMAP_TEMPLATE = `# 业务系统架构全景导图

## 前端表现层
- 响应式 UI 体系
  - 弹性视口百分比布局
  - 沉浸式暗黑 / 明亮主题
- 统一渲染驱动分发引擎
  - Markdown / Mermaid
  - Markmap 交互矢量导图
  - PlantUML 架构时序设计
  - SVG 矢量缩放与源码分析
  - PDF 现代化文档阅读器

## 服务协同层
- VS Code Webview 宿主协议通信
  - document-change 实时同步
  - open-source 原文件定位
- 本地文件系统挂载与拖拽导入
- 增量状态更新与错误隔离边界

## 核心价值与质量保障
- 极致交互与毫秒级渲染响应
- TypeScript 强类型契约
- 自动化无缝单测门禁
- 开放矢量与离线 HTML 导出
`;

/**
 * 自动识别并转换 FreeMind XML 格式为标准 Markdown 层次树
 */
function normalizeMindmapContent(input: string): string {
  if (!input || !input.trim()) {
    return DEFAULT_MINDMAP_TEMPLATE;
  }
  const trimmed = input.trim();
  // 检测是否为 FreeMind / Freeplane 传统 XML 格式
  if (trimmed.startsWith('<map') || trimmed.startsWith('<?xml')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'text/xml');
      const rootNode = doc.querySelector('map > node') || doc.querySelector('node');
      if (rootNode) {
        const lines: string[] = [];
        const traverse = (el: Element, depth: number) => {
          const text = el.getAttribute('TEXT') || el.getAttribute('text') || '节点';
          if (depth === 1) {
            lines.push(`# ${text}`);
          } else if (depth === 2) {
            lines.push(`## ${text}`);
          } else {
            const indent = '  '.repeat(depth - 3);
            lines.push(`${indent}- ${text}`);
          }
          const children = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'node');
          for (const child of children) {
            traverse(child, depth + 1);
          }
        };
        traverse(rootNode, 1);
        if (lines.length > 0) {
          return lines.join('\n');
        }
      }
    } catch {
      // 容错回退
    }
  }
  return input;
}

export const MindmapViewer: React.FC<MindmapViewerProps> = ({
  content,
  fileName = 'mindmap.markmap',
  extension = 'markmap',
  isDarkTheme = true,
  theme = 'dark',
  density = 'compact',
  locale = 'zh-CN',
  onContentChange,
}) => {
  const [localCode, setLocalCode] = useState<string>(() => normalizeMindmapContent(content));
  const [viewMode, setViewMode] = useState<MindmapViewMode>(() => {
    const s = loadStoredSettings();
    return s.mindmapViewMode || 'split';
  });
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const s = loadStoredSettings();
    return s.mindmapSplitRatio || 42;
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSynced, setIsSynced] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当外部传入内容变更（且非内部编辑触发时）同步更新
  useEffect(() => {
    const normalized = normalizeMindmapContent(content);
    if (normalized !== localCode && isSynced) {
      setLocalCode(normalized);
    }
  }, [content]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setLocalCode(newCode);
      setIsSynced(false);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onContentChange?.(newCode);
        setIsSynced(true);
      }, 350);
    },
    [onContentChange]
  );

  // 快捷片段插入
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

  // 键盘快捷键增强：支持 Tab 缩进、Shift+Tab 反缩进、Enter 自动延续列表标号
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // 反缩进（移除前置 2 空格）
        const lines = localCode.substring(0, start).split('\n');
        const currentLine = lines[lines.length - 1];
        if (currentLine.startsWith('  ')) {
          const lineStartPos = start - currentLine.length;
          const updated = localCode.substring(0, lineStartPos) + currentLine.substring(2) + localCode.substring(start);
          handleCodeChange(updated);
          setTimeout(() => {
            textarea.setSelectionRange(Math.max(0, start - 2), Math.max(0, end - 2));
          }, 0);
        }
      } else {
        // 缩进 2 空格
        const updated = localCode.substring(0, start) + '  ' + localCode.substring(end);
        handleCodeChange(updated);
        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
    } else if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const textBefore = localCode.substring(0, start);
      const lines = textBefore.split('\n');
      const currentLine = lines[lines.length - 1];

      // 智能匹配列表项延续：例如 "- " 或 "  - [ ] "
      const match = currentLine.match(/^(\s*[-*]\s*(?:\[[ x]\]\s*)?)/);
      if (match && currentLine.trim() !== '-' && currentLine.trim() !== '*' && currentLine.trim() !== '- [ ]') {
        e.preventDefault();
        const prefix = '\n' + match[1];
        const updated = localCode.substring(0, start) + prefix + localCode.substring(textarea.selectionEnd);
        handleCodeChange(updated);
        setTimeout(() => {
          textarea.setSelectionRange(start + prefix.length, start + prefix.length);
        }, 0);
      }
    }
  };

  // 可拖拽分屏操作
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const newRatio = Math.max(20, Math.min(80, (offsetX / rect.width) * 100));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setSplitRatio((finalRatio) => {
        saveStoredSettings({ mindmapSplitRatio: Math.round(finalRatio) });
        return finalRatio;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetTemplate = () => {
    if (window.confirm('确定要载入默认思维导图架构模板吗？当前编辑的内容将被替换。')) {
      handleCodeChange(DEFAULT_MINDMAP_TEMPLATE);
    }
  };

  const lineCount = localCode.split('\n').length;
  const charCount = localCode.length;

  return (
    <div
      id="mindmap-studio-container"
      className="h-full w-full flex flex-col bg-slate-950 text-slate-200 select-none relative overflow-hidden"
    >
      {/* 顶部主工作栏 */}
      <header className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs shrink-0 gap-2 z-20">
        {/* 左侧：文件标识与同步状态 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 font-mono text-[11px] font-semibold shrink-0">
            <GitFork className="w-3.5 h-3.5 text-cyan-400" />
            <span>MINDMAP STUDIO</span>
          </div>

          <span className="font-medium text-slate-200 truncate max-w-[160px] sm:max-w-[240px]" title={fileName}>
            {fileName}
          </span>

          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            {extension}
          </span>

          {/* 实时同步状态指示灯 */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 ml-1">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isSynced ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span>{isSynced ? '已实时同步' : '编辑中...'}</span>
          </div>
        </div>

        {/* 中间：视图模式切换与分屏预设比例 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-[11px]">
            <button
              onClick={() => {
                setViewMode('split');
                saveStoredSettings({ mindmapViewMode: 'split' });
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                viewMode === 'split' ? 'bg-cyan-600 text-white font-medium shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="分屏双向编辑与实时预览"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">分屏协作</span>
            </button>

            <button
              onClick={() => {
                setViewMode('mindmap');
                saveStoredSettings({ mindmapViewMode: 'mindmap' });
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                viewMode === 'mindmap' ? 'bg-cyan-600 text-white font-medium shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="仅展示交互式全屏思维导图"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">纯思维导图</span>
            </button>

            <button
              onClick={() => {
                setViewMode('editor');
                saveStoredSettings({ mindmapViewMode: 'editor' });
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                viewMode === 'editor' ? 'bg-cyan-600 text-white font-medium shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="仅展示文本编辑器"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden md:inline">纯代码编辑</span>
            </button>
          </div>

          {/* 分屏模式下的比例快捷按钮 */}
          {viewMode === 'split' && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
              <button
                onClick={() => {
                  setSplitRatio(30);
                  saveStoredSettings({ mindmapSplitRatio: 30 });
                }}
                className={`px-1.5 py-0.5 rounded transition ${
                  splitRatio === 30 ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="30% 源码 : 70% 导图"
              >
                30:70
              </button>
              <button
                onClick={() => {
                  setSplitRatio(50);
                  saveStoredSettings({ mindmapSplitRatio: 50 });
                }}
                className={`px-1.5 py-0.5 rounded transition ${
                  splitRatio === 50 ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="50% 对等分屏"
              >
                50:50
              </button>
              <button
                onClick={() => {
                  setSplitRatio(70);
                  saveStoredSettings({ mindmapSplitRatio: 70 });
                }}
                className={`px-1.5 py-0.5 rounded transition ${
                  splitRatio === 70 ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="70% 源码 : 30% 导图"
              >
                70:30
              </button>
            </div>
          )}
        </div>

        {/* 右侧：复制与模板重置 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleResetTemplate}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 transition"
            title="重置为经典多级导图模板"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">标准模板</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 rounded border border-cyan-500/40 transition shrink-0 font-medium"
            title="复制思维导图 Markdown 源码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制源码'}</span>
          </button>
        </div>
      </header>

      {/* 主体视口区域：编辑器与导图画布 */}
      <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 拖拽时的全局遮罩防滑脱 */}
        {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize select-none" />}

        {/* 左侧：思维导图 DSL 源代码编辑器 */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div
            style={{ width: viewMode === 'editor' ? '100%' : `${splitRatio}%` }}
            className="flex flex-col bg-slate-900/40 min-w-0 h-full border-r border-slate-800/80"
          >
            {/* 编辑器状态标题栏 */}
            <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between shrink-0 select-none">
              <span className="truncate flex items-center gap-1.5 text-cyan-400 font-semibold">
                <FileCode className="w-3.5 h-3.5" />
                导图结构编辑 ({lineCount} 行 · {charCount} 字符)
              </span>
              <span className="text-slate-500 hidden sm:inline">按 Tab 缩进 / Shift+Tab 反缩进</span>
            </div>

            {/* 快捷语法片段注入栏 */}
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-950/90 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0 select-none">
              <span className="text-[10px] text-slate-500 font-mono px-1 shrink-0">快捷结构:</span>
              {MINDMAP_SNIPPETS.map((snippet, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInsertSnippet(snippet.code)}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 rounded text-[10px] font-mono border border-slate-800 shrink-0 transition"
                  title={snippet.tooltip}
                >
                  {snippet.label}
                </button>
              ))}
            </div>

            {/* 文本编辑区 */}
            <textarea
              ref={textareaRef}
              value={localCode}
              onChange={e => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 p-3.5 bg-transparent font-mono text-xs text-slate-200 resize-none outline-none leading-relaxed selection:bg-cyan-600 selection:text-white"
              placeholder="# 根主题&#10;## 分支主题 1&#10;  - 详细内容项&#10;## 分支主题 2"
            />
          </div>
        )}

        {/* 中间：可拖拽调整比例分隔条 */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleSplitterMouseDown}
            onDoubleClick={() => setSplitRatio(50)}
            title="左右按住拖拽调节代码与导图分割比例 | 双击快速复位为 50%"
            className={`relative z-20 w-2 shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors border-x border-slate-800/80 group ${
              isDragging ? 'bg-cyan-600 shadow-md shadow-cyan-500/50' : 'bg-slate-900 hover:bg-cyan-600/80'
            }`}
          >
            <div className="h-10 w-1 rounded-full bg-slate-600 group-hover:bg-cyan-200 transition-colors flex flex-col items-center justify-center gap-0.5">
              <span className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
              <span className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
              <span className="w-0.5 h-0.5 rounded-full bg-slate-400 group-hover:bg-white" />
            </div>
          </div>
        )}

        {/* 右侧：交互式实时矢量思维导图视口 */}
        {(viewMode === 'split' || viewMode === 'mindmap') && (
          <div
            style={{ width: viewMode === 'mindmap' ? '100%' : `${100 - splitRatio}%` }}
            className="flex flex-col bg-slate-950 min-w-0 h-full overflow-hidden"
          >
            <MarkmapViewer
              content={localCode}
              fileName={fileName}
              isDarkTheme={isDarkTheme}
              theme={theme}
              density={density}
              locale={locale}
            />
          </div>
        )}
      </div>
    </div>
  );
};
