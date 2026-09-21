/**
 * OmniView 键盘快捷键与交互帮助面板 (Keyboard Shortcuts & Usage Guide Modal)
 * 快捷键: Ctrl+? (或 Shift+/) / F1 打开
 */
import React, { useEffect, useState } from 'react';
import {
  X,
  Keyboard,
  Command,
  Search,
  ExternalLink,
  BookOpen,
  Edit3,
  Eye,
  Sliders,
  Sparkles,
  MousePointer,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Locale, getStoredLocale, t } from '../../../shared/lib/i18n';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale?: Locale;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  descriptionEn: string;
  category: 'global' | 'navigation' | 'editing' | 'preview' | 'diagrams';
  scope?: string;
}

const SHORTCUT_LIST: ShortcutItem[] = [
  // 全局与宿主协同
  {
    keys: ['Ctrl', 'Shift', 'V'],
    description: '在侧边一键打开 OmniView 实时渲染预览 (支持40+格式)',
    descriptionEn: 'Open OmniView side preview (supports 40+ file formats)',
    category: 'global',
    scope: 'VS Code 文本编辑器',
  },
  {
    keys: ['Ctrl', 'K', 'V'],
    description: '标准 Markdown 预览快捷键 (兼容 VS Code 官方快捷键)',
    descriptionEn: 'Standard Markdown preview shortcut (VS Code compatible)',
    category: 'global',
    scope: 'VS Code 文本编辑器',
  },
  {
    keys: ['Ctrl', '?'],
    description: '打开快捷键与使用指南速查面板 (本帮助窗口)',
    descriptionEn: 'Open shortcuts & usage guide modal (This dialog)',
    category: 'global',
    scope: '全局工作台 / 预览视口',
  },
  {
    keys: ['Ctrl', 'S'],
    description: '立即保存当前文档 (持久化写回本地磁盘)',
    descriptionEn: 'Save document immediately (flush to disk)',
    category: 'global',
    scope: '预览/源码模式',
  },
  {
    keys: ['Esc'],
    description: '关闭弹窗 / 退出大纲 / 退出表格全屏沉浸态',
    descriptionEn: 'Close modal / Dismiss overlay / Exit fullscreen table view',
    category: 'global',
    scope: '全局通用',
  },

  // Markdown 选区划选快速排版与编辑
  {
    keys: ['Ctrl', 'B'],
    description: '划选文字加粗 (Bold: **文字**)',
    descriptionEn: 'Toggle bold formatting (**text**)',
    category: 'editing',
    scope: 'Markdown 预览划选浮条',
  },
  {
    keys: ['Ctrl', 'I'],
    description: '划选文字倾斜 (Italic: *文字*)',
    descriptionEn: 'Toggle italic formatting (*text*)',
    category: 'editing',
    scope: 'Markdown 预览划选浮条',
  },
  {
    keys: ['Ctrl', 'Shift', 'X'],
    description: '划选文字删除线 (Strikethrough: ~~文字~~)',
    descriptionEn: 'Toggle strikethrough (~~text~~)',
    category: 'editing',
    scope: 'Markdown 预览划选浮条',
  },
  {
    keys: ['Ctrl', 'E'],
    description: '划选文字转为行内代码 (`code`)',
    descriptionEn: 'Toggle inline code snippet (`code`)',
    category: 'editing',
    scope: 'Markdown 预览划选浮条',
  },
  {
    keys: ['Ctrl', 'K'],
    description: '插入或包装超链接 ([标题](url))',
    descriptionEn: 'Insert or wrap hyperlink ([title](url))',
    category: 'editing',
    scope: 'Markdown 预览划选浮条',
  },

  // 浏览、阅读与大纲导航
  {
    keys: ['Ctrl', 'F'],
    description: '激活文档内全文检索高亮 (支持即时上下匹配跳转)',
    descriptionEn: 'Focus in-page full text search & highlight',
    category: 'preview',
    scope: 'Markdown / 文本阅读视图',
  },
  {
    keys: ['Ctrl', 'P'],
    description: 'A4 高清分页打印 / 导出为便携 PDF',
    descriptionEn: 'A4 high-res pagination print / Export to PDF',
    category: 'preview',
    scope: '工作台与渲染器',
  },
  {
    keys: ['+', '-'],
    description: '缩放放大 / 缩小当前文档或图表矢量画板',
    descriptionEn: 'Zoom in / Zoom out current view or diagram canvas',
    category: 'preview',
    scope: '图片 / 矢量 / 流程图视口',
  },
  {
    keys: ['0'],
    description: '重置缩放比例至 100% 原始大小',
    descriptionEn: 'Reset canvas zoom level to 100%',
    category: 'preview',
    scope: '图片 / 矢量 / 流程图视口',
  },

  // 高级交互与鼠键协同手势
  {
    keys: ['双击段落'],
    description: '双向滚动锁定下，双击段落可反向精确定位到 VS Code 源码对应行',
    descriptionEn: 'Double-click paragraph to trace and scroll to source line',
    category: 'navigation',
    scope: 'Markdown 预览阅读区',
  },
  {
    keys: ['双击单元格'],
    description: '表格数据即时就地编辑，Enter 确认，Esc 撤销',
    descriptionEn: 'Double-click table cell for in-place editing (Enter/Esc)',
    category: 'navigation',
    scope: 'CSV / TSV / Excel 表格',
  },
  {
    keys: ['滚轮缩放'],
    description: '按住 Ctrl + 鼠标滚轮，平滑无极缩放矢量画布',
    descriptionEn: 'Hold Ctrl + Mouse wheel to smoothly zoom canvas',
    category: 'diagrams',
    scope: '思维导图 / Excalidraw / 流程图',
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  locale: propLocale,
}) => {
  const currentLocale = propLocale || getStoredLocale();
  const isZh = currentLocale === 'zh-CN';
  const [filterQuery, setFilterQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Esc 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: isZh ? '全部快捷键' : 'All Shortcuts' },
    { id: 'global', label: isZh ? '全局与宿主' : 'Global & Host' },
    { id: 'editing', label: isZh ? '编辑与排版' : 'Editing & Formatting' },
    { id: 'preview', label: isZh ? '预览与检视' : 'Preview & View' },
    { id: 'navigation', label: isZh ? '手势与协同' : 'Gestures & Navigation' },
    { id: 'diagrams', label: isZh ? '画布与图表' : 'Canvas & Diagrams' },
  ];

  const filteredShortcuts = SHORTCUT_LIST.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) {
      return false;
    }
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    const desc = isZh ? item.description : item.descriptionEn;
    const keysStr = item.keys.join(' ').toLowerCase();
    const scopeStr = (item.scope || '').toLowerCase();
    return desc.toLowerCase().includes(q) || keysStr.includes(q) || scopeStr.includes(q);
  });

  const handleCopyKey = (keyStr: string) => {
    navigator.clipboard?.writeText(keyStr);
    setCopiedKey(keyStr);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts & Help Guide"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>{isZh ? '快捷键与交互指南' : 'Keyboard Shortcuts & Guide'}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Ctrl+?
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isZh
                  ? '涵盖 VS Code 宿主联动、Markdown 快速排版与视口手势'
                  : 'Fast host bindings, selection formatting, and canvas gestures'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            title={isZh ? '关闭 (Esc)' : 'Close (Esc)'}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter and Category Tabs */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center gap-2.5">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={isZh ? '快速搜索快捷键或功能...' : 'Filter shortcuts or commands...'}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/70 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
              autoFocus
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition whitespace-nowrap ${
                  activeCategory === c.id
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/80 space-y-1">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{isZh ? '未找到相关快捷键' : 'No matching shortcuts found'}</p>
            </div>
          ) : (
            filteredShortcuts.map((item, idx) => {
              const fullKeyStr = item.keys.join(' + ');
              const isCopied = copiedKey === fullKeyStr;
              return (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between gap-4 group hover:bg-slate-800/40 px-2 rounded-lg transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 font-medium leading-relaxed">
                      {isZh ? item.description : item.descriptionEn}
                    </div>
                    {item.scope && (
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <span className="inline-block w-1 h-1 rounded-full bg-blue-400/60" />
                        <span>{item.scope}</span>
                      </div>
                    )}
                  </div>

                  {/* Keys badges */}
                  <div
                    className="flex items-center gap-1 shrink-0 cursor-pointer"
                    onClick={() => handleCopyKey(fullKeyStr)}
                    title={isZh ? '点击复制快捷键' : 'Click to copy shortcut'}
                  >
                    {item.keys.map((k, kIdx) => (
                      <React.Fragment key={kIdx}>
                        {kIdx > 0 && <span className="text-[10px] text-slate-600">+</span>}
                        <kbd className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-[11px] font-mono shadow-xs group-hover:border-blue-500/50 transition min-w-[24px] text-center">
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                    <span className="w-5 text-slate-500 hover:text-slate-300 ml-1">
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60" />}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className="font-mono text-slate-300">💡 {isZh ? '小提示' : 'Tip'}:</span>
              <span>
                {isZh
                  ? '可在 VS Code「首选项 → 键盘快捷方式」中搜索 omniview 自定义绑定'
                  : 'Customize keybindings in VS Code Preferences → Keyboard Shortcuts (search omniview)'}
              </span>
            </span>
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            OmniView v1.0.9
          </div>
        </div>
      </div>
    </div>
  );
};
