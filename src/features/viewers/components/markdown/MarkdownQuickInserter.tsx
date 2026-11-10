/**
 * OmniView Markdown 源码编辑光标行悬浮快速插入组件
 * 遵循 skills:omniview-markdown-authoring 规范
 * 支持 GitHub Alert、交互式卡片 (Tabs/Steps/Compare/Metrics)、图表 (Mermaid/PlantUML/SVG) 与基础排版
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Info,
  Lightbulb,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Layers,
  GitBranch,
  Table,
  Code,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Quote,
  Minus,
  Search,
  X,
  Sigma,
  Sparkles,
  ChevronRight,
  Workflow,
} from 'lucide-react';
import { Locale } from '../../../../shared/lib/i18n';

export interface QuickInsertItem {
  id: string;
  name: string;
  nameEn: string;
  category: 'alerts' | 'interactive' | 'diagrams' | 'basic';
  categoryLabel: string;
  categoryLabelEn: string;
  description: string;
  descriptionEn: string;
  snippet: string;
  placeholderLength?: number;
  icon: React.ReactNode;
}

export const QUICK_INSERT_ITEMS: QuickInsertItem[] = [
  // --- 1. GitHub Alert 语义框 ---
  {
    id: 'alert-note',
    name: 'Note 提示框',
    nameEn: 'Note Callout',
    category: 'alerts',
    categoryLabel: 'GitHub Alert 警示框',
    categoryLabelEn: 'GitHub Alerts',
    description: '强调背景信息、实现细节或补充说明',
    descriptionEn: 'Useful information or background context',
    snippet: '> [!NOTE]\n> 在此输入补充说明与背景细节...\n',
    icon: <Info className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'alert-tip',
    name: 'Tip 建议框',
    nameEn: 'Tip Callout',
    category: 'alerts',
    categoryLabel: 'GitHub Alert 警示框',
    categoryLabelEn: 'GitHub Alerts',
    description: '最佳实践、性能优化建议或便捷提示',
    descriptionEn: 'Best practices, tips, or performance hints',
    snippet: '> [!TIP]\n> 在此输入最佳实践或便捷操作建议...\n',
    icon: <Lightbulb className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'alert-important',
    name: 'Important 重点框',
    nameEn: 'Important Callout',
    category: 'alerts',
    categoryLabel: 'GitHub Alert 警示框',
    categoryLabelEn: 'GitHub Alerts',
    description: '核心前置条件、重要要求或关键结论',
    descriptionEn: 'Crucial information needed for success',
    snippet: '> [!IMPORTANT]\n> 在此输入关键前提与核心注意事项...\n',
    icon: <AlertCircle className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'alert-warning',
    name: 'Warning 警告框',
    nameEn: 'Warning Callout',
    category: 'alerts',
    categoryLabel: 'GitHub Alert 警示框',
    categoryLabelEn: 'GitHub Alerts',
    description: '潜在风险、破坏性变更或兼容性警告',
    descriptionEn: 'Critical warnings, deprecations or breaking changes',
    snippet: '> [!WARNING]\n> 在此输入破坏性改动或潜在兼容风险...\n',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'alert-caution',
    name: 'Caution 高危框',
    nameEn: 'Caution Callout',
    category: 'alerts',
    categoryLabel: 'GitHub Alert 警示框',
    categoryLabelEn: 'GitHub Alerts',
    description: '数据丢失、高危操作或安全红线告警',
    descriptionEn: 'Negative consequences or security hazards',
    snippet: '> [!CAUTION]\n> 在此输入高危操作与安全红线声明...\n',
    icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
  },

  // --- 2. 交互式排版组件 ---
  {
    id: 'comp-tabs',
    name: 'Tabs 多标签卡片',
    nameEn: 'Tabs Component',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '用于多包管理器安装、多系统配置切换',
    descriptionEn: 'Multi-tab switcher for package managers or setups',
    snippet: '> [!TABS]\n> - pnpm: `pnpm install`\n> - npm: `npm install`\n> - yarn: `yarn install`\n',
    icon: <Layers className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'comp-steps',
    name: 'Steps 流程步骤',
    nameEn: 'Steps Guide',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '引导式任务、从零部署或排障检查步骤',
    descriptionEn: 'Numbered walkthrough with visual step milestones',
    snippet: '> [!STEPS]\n> 1. 环境初始化: 安装系统运行时与前置依赖\n> 2. 配置工作区: 复制模板并修改环境变量\n> 3. 启动并验证: 运行构建与自动化测试套件\n',
    icon: <CheckSquare className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'comp-compare',
    name: 'Compare 方案对比',
    nameEn: 'Comparison Grid',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '技术选型、优缺点权衡对比卡片',
    descriptionEn: 'Side-by-side trade-off and feature comparisons',
    snippet: '> [!COMPARE]\n> - 方案 A (推荐): 开发成本低，生态成熟稳定\n> - 方案 B: 灵活性高，但维护与上手门槛较高\n',
    icon: <Sparkles className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'comp-timeline',
    name: 'Timeline 时间线',
    nameEn: 'Timeline Card',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '里程碑路线图、版本演进或重大事件轴',
    descriptionEn: 'Sequential roadmap and release evolution track',
    snippet: '> [!TIMELINE]\n> - 2026-Q1: 架构设计与原型技术验证\n> - 2026-Q2: 核心功能实现与多主题适配\n> - 2026-Q3: 生产级发布与性能优化稳帧\n',
    icon: <Workflow className="w-4 h-4 text-cyan-400" />,
  },

  // --- 3. 图表与公式 ---
  {
    id: 'diag-mermaid-flow',
    name: 'Mermaid 流程图',
    nameEn: 'Mermaid Flowchart',
    category: 'diagrams',
    categoryLabel: '图表与公式',
    categoryLabelEn: 'Diagrams & Math',
    description: '逻辑分支、状态流转与业务调用流程',
    descriptionEn: 'Flowchart diagram with nodes and edge connections',
    snippet: '```mermaid\nflowchart TD\n  Start[开始] --> Check{条件满足?}\n  Check -- 是 --> Action[执行业务逻辑]\n  Check -- 否 --> Fallback[降级处理]\n  Action --> Done[结束]\n  Fallback --> Done\n```\n',
    icon: <GitBranch className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'diag-mermaid-seq',
    name: 'Mermaid 时序图',
    nameEn: 'Mermaid Sequence',
    category: 'diagrams',
    categoryLabel: '图表与公式',
    categoryLabelEn: 'Diagrams & Math',
    description: '微服务交互、跨模块 RPC 请求与响应生命周期',
    descriptionEn: 'Sequence diagram between actors and services',
    snippet: '```mermaid\nsequenceDiagram\n  autonumber\n  actor User as 用户\n  participant Client as 客户端\n  participant Gateway as API 网关\n  participant Svc as 业务中枢\n\n  User->>Client: 提交操作\n  Client->>Gateway: POST /api/submit\n  Gateway->>Svc: 转发并鉴权\n  Svc-->>Client: 200 OK (执行成功)\n```\n',
    icon: <Workflow className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'diag-plantuml',
    name: 'PlantUML 架构图',
    nameEn: 'PlantUML Architecture',
    category: 'diagrams',
    categoryLabel: '图表与公式',
    categoryLabelEn: 'Diagrams & Math',
    description: '系统架构组件图、依赖关系与网络拓扑',
    descriptionEn: 'Component and architecture model diagram',
    snippet: '```plantuml\n@startuml\nskinparam componentStyle rectangle\npackage "前端应用层" {\n  [OmniView 工作台] as App\n}\npackage "数据服务层" {\n  [渲染中枢] as Core\n  database "本地缓存" as DB\n}\nApp --> Core : 派发文件流\nCore --> DB : 持久化存储\n@enduml\n```\n',
    icon: <Workflow className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'diag-svg',
    name: 'SVG 矢量图形',
    nameEn: 'SVG Vector Graphic',
    category: 'diagrams',
    categoryLabel: '图表与公式',
    categoryLabelEn: 'Diagrams & Math',
    description: '嵌入式高保真矢量画布与插图',
    descriptionEn: 'Embed scalable vector graphics directly',
    snippet: '```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 100" width="100%" height="100">\n  <rect x="5" y="5" width="450" height="90" rx="12" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>\n  <text x="230" y="55" fill="#f8fafc" font-size="16" text-anchor="middle" font-weight="bold">OmniView 矢量图表</text>\n</svg>\n```\n',
    icon: <Layers className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'diag-katex',
    name: 'KaTeX 数学公式',
    nameEn: 'KaTeX Math Formula',
    category: 'diagrams',
    categoryLabel: '图表与公式',
    categoryLabelEn: 'Diagrams & Math',
    description: '多行独立数学公式块',
    descriptionEn: 'Display math equation block with KaTeX',
    snippet: '$$\nf(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x}\\,d\\xi\n$$\n',
    icon: <Sigma className="w-4 h-4 text-yellow-400" />,
  },

  // --- 4. 基础排版结构 ---
  {
    id: 'basic-h1',
    name: '一级标题 (H1)',
    nameEn: 'Heading 1 (H1)',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '文档最高级别主标题',
    descriptionEn: 'Top-level document title',
    snippet: '# 标题内容\n',
    icon: <Heading1 className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'basic-h2',
    name: '二级标题 (H2)',
    nameEn: 'Heading 2 (H2)',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '主要章节分段标题',
    descriptionEn: 'Major section heading',
    snippet: '## 章节标题\n',
    icon: <Heading2 className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'basic-h3',
    name: '三级标题 (H3)',
    nameEn: 'Heading 3 (H3)',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '小节与模块细化标题',
    descriptionEn: 'Subsection heading',
    snippet: '### 子节标题\n',
    icon: <Heading3 className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'basic-task',
    name: '任务清单 (Checkbox)',
    nameEn: 'Task List (Checkbox)',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '带勾选状态的待办事项',
    descriptionEn: 'Interactive task checklist item',
    snippet: '- [ ] 待办事项 1\n- [ ] 待办事项 2\n- [x] 已完成事项\n',
    icon: <CheckSquare className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'basic-table',
    name: '3x3 表格 (Table)',
    nameEn: '3x3 Table',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '标准对齐的 Markdown 数据表格',
    descriptionEn: 'Standard Markdown data table',
    snippet: '| 字段名称 | 类型 | 说明 |\n| :--- | :---: | :--- |\n| id | string | 唯一标识符 |\n| name | string | 名称说明 |\n| status | boolean | 状态标识 |\n',
    icon: <Table className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'basic-code',
    name: '代码块 (Code Block)',
    nameEn: 'Code Block',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '带语法着色与语言声明的代码块',
    descriptionEn: 'Fenced code block with syntax highlighting',
    snippet: '```typescript\nfunction execute(): void {\n  console.log("Hello, OmniView");\n}\n```\n',
    icon: <Code className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'basic-quote',
    name: '引用段落 (Quote)',
    nameEn: 'Blockquote',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '经典引用文本块',
    descriptionEn: 'Standard blockquote section',
    snippet: '> 重要的引用或参考说明文本...\n',
    icon: <Quote className="w-4 h-4 text-slate-400" />,
  },
  {
    id: 'basic-divider',
    name: '分割线 (Divider)',
    nameEn: 'Horizontal Rule',
    category: 'basic',
    categoryLabel: '基础常用结构',
    categoryLabelEn: 'Basic Structure',
    description: '横向内容分隔线',
    descriptionEn: 'Horizontal thematic break rule',
    snippet: '\n---\n\n',
    icon: <Minus className="w-4 h-4 text-slate-400" />,
  },
];

export interface MarkdownQuickInserterProps {
  cursorTop: number;
  cursorLine: number;
  isVisible: boolean;
  locale?: Locale;
  onInsert: (snippet: string, placeholderLength?: number) => void;
}

/**
 * 光标行悬浮快速插入工具条
 * 实时吸附在光标所在行同一高度，支持快速气泡、快捷常用动作与丰富特性弹窗
 */
export const MarkdownQuickInserter: React.FC<MarkdownQuickInserterProps> = ({
  cursorTop,
  cursorLine,
  isVisible,
  locale = 'zh-CN',
  onInsert,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'alerts' | 'interactive' | 'diagrams' | 'basic'>('all');
  const menuRef = useRef<HTMLDivElement>(null);
  const isEn = locale === 'en-US';

  // 点击外部自动收起
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // 键盘 Esc 快速关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 过滤特性项
  const filteredItems = useMemo(() => {
    return QUICK_INSERT_ITEMS.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  if (!isVisible) return null;

  return (
    <div
      ref={menuRef}
      style={{
        top: `${Math.max(6, cursorTop - 4)}px`,
      }}
      className="absolute right-5 z-30 transition-all duration-150 select-none"
    >
      {/* 悬浮微型控制栏 (Floating Pill) */}
      <div
        className="flex items-center gap-1 px-1.5 py-1 rounded-full border shadow-lg backdrop-blur-md transition group hover:shadow-xl"
        style={{
          background: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
          boxShadow: 'var(--ov-shadow, 0 4px 12px rgba(0,0,0,0.25))',
        }}
      >
        {/* 行号提示微标 */}
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--ov-surface-header)] border border-[var(--ov-border)] text-[var(--ov-text-secondary)] opacity-80">
          L{cursorLine}
        </span>

        {/* 核心主按钮: 展开丰富工具特性库 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
            isOpen
              ? 'bg-[var(--ov-accent)] text-white'
              : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] text-[var(--ov-text)]'
          }`}
          title={isEn ? 'Insert Markdown feature at cursor line' : '在光标行快速插入 Markdown 工具特性'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{isEn ? 'Insert' : '快速插入'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--ov-border)] my-auto" />

        {/* 高频快捷操作: Alert 建议框 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onInsert(QUICK_INSERT_ITEMS[0].snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-blue-400 hover:text-blue-300 cursor-pointer transition"
          title={isEn ? 'Insert Note Alert' : '快速插入 Note 警示框'}
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* 高频快捷操作: 3x3 表格 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const tableItem = QUICK_INSERT_ITEMS.find((it) => it.id === 'basic-table');
            if (tableItem) onInsert(tableItem.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-orange-400 hover:text-orange-300 cursor-pointer transition"
          title={isEn ? 'Insert Table' : '快速插入数据表格'}
        >
          <Table className="w-3.5 h-3.5" />
        </button>

        {/* 高频快捷操作: Mermaid 流程图 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const flowItem = QUICK_INSERT_ITEMS.find((it) => it.id === 'diag-mermaid-flow');
            if (flowItem) onInsert(flowItem.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-emerald-400 hover:text-emerald-300 cursor-pointer transition"
          title={isEn ? 'Insert Mermaid Diagram' : '快速插入 Mermaid 流程图'}
        >
          <GitBranch className="w-3.5 h-3.5" />
        </button>

        {/* 高频快捷操作: 代码块 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const codeItem = QUICK_INSERT_ITEMS.find((it) => it.id === 'basic-code');
            if (codeItem) onInsert(codeItem.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-indigo-400 hover:text-indigo-300 cursor-pointer transition"
          title={isEn ? 'Insert Code Block' : '快速插入代码块'}
        >
          <Code className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 弹出的丰富工具特性选择面板 */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            background: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
            boxShadow: 'var(--ov-shadow, 0 16px 36px -4px rgba(0,0,0,0.45))',
          }}
        >
          {/* 面板顶部搜索与分类 Tab */}
          <div className="p-2.5 border-b border-[var(--ov-border)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-[var(--ov-accent)]" />
                <span>{isEn ? 'Markdown Quick Insert' : '光标行快速插入特性'}</span>
                <span className="text-[10px] font-mono px-1 rounded bg-[var(--ov-surface-header)] text-[var(--ov-text-secondary)]">
                  L{cursorLine}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 搜索过滤框 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ov-text-secondary)] opacity-60" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search templates (alert, table, mermaid)...' : '搜索特性 (如: alert, 表格, 流程图)...'}
                className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-[var(--ov-border)] bg-[var(--ov-code-bg)] text-[var(--ov-text)] focus:outline-hidden focus:border-[var(--ov-accent)]"
              />
            </div>

            {/* 分类切换 Pills */}
            <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5 no-scrollbar">
              {[
                { id: 'all', label: isEn ? 'All' : '全部' },
                { id: 'alerts', label: isEn ? 'Alerts' : '警示框' },
                { id: 'interactive', label: isEn ? 'Cards' : '交互卡片' },
                { id: 'diagrams', label: isEn ? 'Diagrams' : '图表/公式' },
                { id: 'basic', label: isEn ? 'Basic' : '基础排版' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveCategory(tab.id as any)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 transition cursor-pointer ${
                    activeCategory === tab.id
                      ? 'bg-[var(--ov-accent)] text-white shadow-xs'
                      : 'hover:bg-[var(--ov-surface-hover)] text-[var(--ov-text-secondary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 特性卡片列表区 */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 divide-y divide-[var(--ov-border)]/40">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--ov-text-secondary)]">
                {isEn ? 'No matching templates found' : '未找到匹配的特性模板'}
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onInsert(item.snippet, item.placeholderLength);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-[var(--ov-surface-hover)] transition group cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-[var(--ov-surface-header)] border border-[var(--ov-border)] shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--ov-text)] group-hover:text-[var(--ov-accent)] transition">
                        {isEn ? item.nameEn : item.name}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-[var(--ov-accent)]" />
                    </div>
                    <p className="text-[10px] text-[var(--ov-text-secondary)] line-clamp-1 mt-0.5">
                      {isEn ? item.descriptionEn : item.description}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 底部快捷提示 */}
          <div className="px-3 py-1.5 border-t border-[var(--ov-border)] bg-[var(--ov-surface-header)] flex items-center justify-between text-[10px] text-[var(--ov-text-secondary)] font-mono">
            <span>Esc 关闭</span>
            <span>点击自动插入并换行</span>
          </div>
        </div>
      )}
    </div>
  );
};

