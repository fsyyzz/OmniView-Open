/**
 * OmniView Markdown 源码编辑光标位置悬浮快速插入组件
 * 紧密围绕 OmniView 专属非标准渲染与排版扩展体系打造：
 * 1. 领域驱动设计 (DDD: 领域故事 / 事件风暴 / 上下文映射 / 外部 .ddd 模型挂载)
 * 2. 现代专业图表 (ECharts / Markmap 交互思维导图 / Graphviz DOT / PlantUML / Mermaid / SVG / Excalidraw)
 * 3. OmniView 专属高阶交互卡片 (Tabs / Steps / Compare / Timeline / Metrics / FAQ / Quote / Banner / Cards / 折叠手风琴)
 * 4. 5 大标准 GitHub Alerts (Note / Tip / Important / Warning / Caution)
 * 5. 独立数学公式 (KaTeX) 与物理分页符 (Page Break)
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
  BarChart3,
  Network,
  PieChart,
  HelpCircle,
  Scissors,
  Bookmark,
  Share2,
  FolderGit2,
} from 'lucide-react';
import { Locale } from '../../../../shared/lib/i18n';

export interface QuickInsertItem {
  id: string;
  name: string;
  nameEn: string;
  category: 'ddd' | 'diagrams' | 'interactive' | 'alerts' | 'basic';
  categoryLabel: string;
  categoryLabelEn: string;
  description: string;
  descriptionEn: string;
  snippet: string;
  placeholderLength?: number;
  icon: React.ReactNode;
}

export const QUICK_INSERT_ITEMS: QuickInsertItem[] = [
  // ==========================================
  // --- 1. DDD 领域模型 (OmniView 专属渲染) ---
  // ==========================================
  {
    id: 'ddd-domain-story',
    name: '领域故事 (Domain Story)',
    nameEn: 'Domain Story Diagram',
    category: 'ddd',
    categoryLabel: 'DDD 领域模型',
    categoryLabelEn: 'DDD Models',
    description: '基于人员、系统与工作对象的交互式业务故事流图',
    descriptionEn: 'Actor-activity-object domain storytelling diagram',
    snippet: '```domainstory\ntitle: 订单履约与仓配协同领域故事\nactors:\n  - id: buyer\n    name: 买家\n    type: person\n  - id: trade_core\n    name: 交易中枢\n    type: system\n  - id: wms\n    name: 智能仓储中心\n    type: system\nactivities:\n  - step: 1\n    source: buyer\n    target: trade_core\n    action: 提交购物车结算\n    object: 订单清单\n  - step: 2\n    source: trade_core\n    target: wms\n    action: 派发发货任务\n    object: 拣货任务单\n```\n',
    icon: <Share2 className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'ddd-event-storming',
    name: '事件风暴 (Event Storming)',
    nameEn: 'Event Storming Board',
    category: 'ddd',
    categoryLabel: 'DDD 领域模型',
    categoryLabelEn: 'DDD Models',
    description: '泳道式命令、事件、聚合与读模型便利贴因果时序链',
    descriptionEn: 'Color-coded event storming timeline swimlane',
    snippet: '```eventstorming\ntitle: 电商大促下单履约事件风暴\nlanes:\n  - title: 订单创建流\n    nodes:\n      - { type: actor, text: 买家 }\n      - { type: command, text: 提交结算单 }\n      - { type: aggregate, text: 订单聚合 }\n      - { type: event, text: 订单已创建 }\n      - { type: readmodel, text: 订单确认视图 }\n  - title: 支付流转流\n    nodes:\n      - { type: policy, text: 自动风控核验 }\n      - { type: command, text: 发起渠道扣款 }\n      - { type: external, text: 统一支付网关 }\n      - { type: event, text: 支付已完成 }\n```\n',
    icon: <Sparkles className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'ddd-context-map',
    name: '限界上下文映射 (Context Map)',
    nameEn: 'Bounded Context Map',
    category: 'ddd',
    categoryLabel: 'DDD 领域模型',
    categoryLabelEn: 'DDD Models',
    description: '核心域/支撑域/通用域战略协同与上下游防腐层拓扑',
    descriptionEn: 'Strategic bounded context topology with ACL/OHS',
    snippet: '```contextmap\ntitle: 智慧零售战略上下文映射图\ncontexts:\n  - id: order\n    name: 交易订单上下文\n    type: core\n    team: 交易研发组\n  - id: pay\n    name: 统一支付网关\n    type: generic\n    team: 金融基础组\n  - id: stock\n    name: 仓储物流上下文\n    type: supporting\n    team: 供应链组\nrelationships:\n  - from: order\n    to: pay\n    type: upstream-downstream\n    contract: OHS/PL\n    label: 支付扣款协议\n  - from: order\n    to: stock\n    type: customer-supplier\n    label: 订单履约事件\n```\n',
    icon: <Network className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'ddd-external-mount',
    name: '挂载外部 .ddd 模型文件',
    nameEn: 'Embed External .ddd File',
    category: 'ddd',
    categoryLabel: 'DDD 领域模型',
    categoryLabelEn: 'DDD Models',
    description: '使用标准图片语法无缝嵌入工作区独立 .ddd 模型',
    descriptionEn: 'Embed and render workspace .ddd file directly',
    snippet: '![订单履约领域故事](./examples/domainstory/ecommerce-fulfillment.ddd)\n',
    icon: <FolderGit2 className="w-4 h-4 text-purple-400" />,
  },

  // ==========================================
  // --- 2. 现代专业图表与思维导图 (非标准代码块) ---
  // ==========================================
  {
    id: 'chart-echarts-bar',
    name: 'ECharts 柱状与折线图',
    nameEn: 'ECharts Bar & Line',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '支持交互式 Tooltip、主题自适应与数据缩放',
    descriptionEn: 'Interactive bar/line chart with theme adaptation',
    snippet: '```echarts\n{\n  "title": { "text": "2026 季度交付量分析" },\n  "tooltip": { "trigger": "axis" },\n  "xAxis": {\n    "type": "category",\n    "data": ["Q1", "Q2", "Q3", "Q4"]\n  },\n  "yAxis": { "type": "value" },\n  "series": [\n    {\n      "name": "交付量",\n      "type": "bar",\n      "data": [320, 540, 780, 960]\n    }\n  ]\n}\n```\n',
    icon: <BarChart3 className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'chart-echarts-pie',
    name: 'ECharts 饼图/环形图',
    nameEn: 'ECharts Pie Chart',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '业务模块占比、资源分布多维饼图',
    descriptionEn: 'Proportional distribution pie/donut chart',
    snippet: '```echarts\n{\n  "title": { "text": "系统模块技术栈占比", "left": "center" },\n  "tooltip": { "trigger": "item" },\n  "series": [\n    {\n      "type": "pie",\n      "radius": ["40%", "70%"],\n      "data": [\n        { "value": 45, "name": "渲染引擎 (React 19)" },\n        { "value": 30, "name": "工作台外壳" },\n        { "value": 25, "name": "驱动插件中枢" }\n      ]\n    }\n  ]\n}\n```\n',
    icon: <PieChart className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'chart-markmap',
    name: 'Markmap 交互思维导图',
    nameEn: 'Markmap Mindmap',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '通过 Markdown 缩进层级即时生成可交互 D3 思维导图',
    descriptionEn: 'Interactive collapsible D3 SVG mindmap',
    snippet: '```markmap\n# OmniView 全景视界\n## 专属渲染驱动\n- DDD 领域故事 & 事件风暴\n- ECharts 交互可视化\n- Markmap 思维导图\n- PlantUML 架构组件图\n## 交互排版扩展\n- GitHub Alert 警示框\n- Tabs 多标签 & Compare 对比\n- Timeline 时间线 & Metrics 指标\n```\n',
    icon: <Workflow className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'chart-graphviz',
    name: 'Graphviz DOT 拓扑图',
    nameEn: 'Graphviz DOT Graph',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: 'WASM 原生编译有向图、网络调用链与依赖分析',
    descriptionEn: 'WASM-compiled Graphviz directed dependency graph',
    snippet: '```dot\ndigraph Architecture {\n  rankdir=LR;\n  node [shape=box, style="rounded,filled", fillcolor="#1e293b", fontcolor="#f8fafc", color="#3b82f6"];\n  Client -> API_Gateway [label="HTTPS"];\n  API_Gateway -> Microservice [label="gRPC"];\n  Microservice -> Database [label="SQL / Pool"];\n}\n```\n',
    icon: <Network className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'chart-plantuml',
    name: 'PlantUML 架构组件图',
    nameEn: 'PlantUML Architecture',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '微服务架构分层组件、生命周期与数据库调用',
    descriptionEn: 'PlantUML component and sequence architecture diagram',
    snippet: '```plantuml\n@startuml\nskinparam componentStyle rectangle\npackage "客户端展示层" {\n  [OmniView 工作台] as App\n}\npackage "核心渲染层" {\n  [AST 流水线] as Pipeline\n  [驱动注册表] as Driver\n}\nApp --> Pipeline : 派发 Markdown 源码\nPipeline --> Driver : 绑定专用渲染块\n@enduml\n```\n',
    icon: <Workflow className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'chart-mermaid-flow',
    name: 'Mermaid 流程图',
    nameEn: 'Mermaid Flowchart',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '逻辑分支判定、异步流转与主备降级流程',
    descriptionEn: 'Standard Mermaid flowchart diagram',
    snippet: '```mermaid\nflowchart TD\n  Start([开始]) --> Check{条件满足?}\n  Check -- 是 --> Process[执行核心业务]\n  Check -- 否 --> Fallback[触发安全降级]\n  Process --> End([完成归档])\n  Fallback --> End\n```\n',
    icon: <GitBranch className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'chart-mermaid-seq',
    name: 'Mermaid 时序交互图',
    nameEn: 'Mermaid Sequence',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '系统间调用时序、消息确认与握手响应',
    descriptionEn: 'Sequential interaction between system components',
    snippet: '```mermaid\nsequenceDiagram\n  autonumber\n  actor User as 用户\n  participant Web as 前端工作台\n  participant API as 网关中枢\n\n  User->>Web: 触发快捷插入\n  Web->>API: 提交变更事件\n  API-->>Web: 200 OK (实时渲染)\n```\n',
    icon: <Share2 className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'chart-svg',
    name: 'SVG 矢量图形画布',
    nameEn: 'SVG Vector Graphic',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '代码块内嵌或外部引用的高保真矢量画布',
    descriptionEn: 'Scalable vector graphic with drop-shadow and gradients',
    snippet: '```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 90" width="100%" height="90">\n  <rect x="5" y="5" width="450" height="80" rx="12" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>\n  <text x="230" y="50" fill="#f8fafc" font-size="16" text-anchor="middle" font-weight="bold">OmniView 高保真矢量引擎已挂载</text>\n</svg>\n```\n',
    icon: <Layers className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'chart-katex',
    name: 'KaTeX 独立数学公式',
    nameEn: 'KaTeX Math Block',
    category: 'diagrams',
    categoryLabel: '现代专业图表',
    categoryLabelEn: 'Diagrams & Charts',
    description: '居中展示的高清科学计算与统计学公式块',
    descriptionEn: 'Display-mode KaTeX mathematical equation',
    snippet: '$$\nf(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x}\\,d\\xi\n$$\n',
    icon: <Sigma className="w-4 h-4 text-yellow-400" />,
  },

  // ==========================================
  // --- 3. OmniView 专属交互卡片 (Authoring 规范) ---
  // ==========================================
  {
    id: 'comp-tabs',
    name: 'Tabs 多标签卡片',
    nameEn: 'Tabs Component',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '多系统环境、包管理器安装指令多标签切换',
    descriptionEn: 'Tabbed switcher for package managers or OS configs',
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
    description: '带高亮序号徽章的里程碑分步指引',
    descriptionEn: 'Numbered step-by-step implementation roadmap',
    snippet: '> [!STEPS]\n> 1. 环境初始化: 安装系统基础依赖与扩展运行时\n> 2. 配置工作区: 校验配置文件并设置环境变量\n> 3. 验证并运行: 启动工程执行自动化验证套件\n',
    icon: <CheckSquare className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'comp-compare',
    name: 'Compare 方案对比',
    nameEn: 'Comparison Grid',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '架构方案优劣权衡、特性双列对照卡片',
    descriptionEn: 'Side-by-side trade-off and comparison matrix',
    snippet: '> [!COMPARE]\n> - 方案 A (推荐): 开发成本低，生态成熟且全平台融合\n> - 方案 B: 灵活性极高，但前期维护成本与心智负担较重\n',
    icon: <Sparkles className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'comp-timeline',
    name: 'Timeline 时间线',
    nameEn: 'Timeline Card',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '项目里程碑、版本发布与历史演进脉络',
    descriptionEn: 'Sequential milestone track and version evolution',
    snippet: '> [!TIMELINE]\n> - 2026-Q1: 原型研发与核心驱动矩阵梳理\n> - 2026-Q2: 全主题像素级融合与性能优化稳帧\n> - 2026-Q3: 生产级全面推广与生态插件建设\n',
    icon: <Workflow className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'comp-metrics',
    name: 'Metrics 核心指标网格',
    nameEn: 'Metrics Grid',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '展示关键性能度量、覆盖率与高光数值',
    descriptionEn: 'High-impact metric card grid with trend badges',
    snippet: '> [!METRICS]\n> - 测试覆盖率: 100% (+4.2% 全绿)\n> - 稳帧渲染: 60 FPS (零抖动)\n> - 启动延迟: 18ms (极致响应)\n',
    icon: <BarChart3 className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'comp-faq',
    name: 'FAQ 交互折叠问答',
    nameEn: 'Interactive FAQ',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '常见问题解答，点击即时展开收起',
    descriptionEn: 'Collapsible Q&A troubleshooting list',
    snippet: '> [!FAQ]\n> Q: 如何调整 Markdown 分屏源码与预览比例？\n> A: 双击中间分割线一键复位 50:50，或直接鼠标拖动调整。\n> Q: 为什么 DDD 视图能自动解决遮盖？\n> A: 内部具备几何相交算法与 AABB 包围盒防重叠避让机制。\n',
    icon: <HelpCircle className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'comp-quote',
    name: 'Quote 高保真名人引用',
    nameEn: 'Styled Quote',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '带双引号徽章与出处铭牌的典雅引文',
    descriptionEn: 'Featured quote card with author attribution',
    snippet: '> [!QUOTE] 简单即是美，稳健即是速度。\n> —— 软件工程核心契约\n',
    icon: <Quote className="w-4 h-4 text-rose-400" />,
  },
  {
    id: 'comp-banner',
    name: 'Banner 顶部高光横幅',
    nameEn: 'Top Banner Announcement',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '文档顶部全局通知、公告与大厅横幅',
    descriptionEn: 'Full-width top announcement banner block',
    snippet: '> [!BANNER] OmniView 工作台已全面支持光标行高阶特性快速插入！\n',
    icon: <Bookmark className="w-4 h-4 text-yellow-400" />,
  },
  {
    id: 'comp-cards-grid',
    name: 'Cards 多列响应式卡片网格',
    nameEn: 'Multi-column Cards Grid',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '将内部 Alert 或文本内容按 3 列并排布局',
    descriptionEn: '3-column responsive card container grid',
    snippet: '> [!CARDS:3]\n> > [!NOTE] 模块 A\n> > 基础架构\n>\n> > [!TIP] 模块 B\n> > 性能优化\n>\n> > [!IMPORTANT] 模块 C\n> > 安全防御\n',
    icon: <Layers className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'comp-collapsible',
    name: '折叠手风琴 (Collapsible Alert)',
    nameEn: 'Collapsible Note',
    category: 'interactive',
    categoryLabel: '交互排版卡片',
    categoryLabelEn: 'Interactive Cards',
    description: '默认收起的折叠块，防止大段背景信息占据垂直空间',
    descriptionEn: 'Collapsible accordion block (details/summary)',
    snippet: '> [!NOTE]- 点击展开查看详细配置与历史架构记录\n> 内部详细长文本，默认折叠收起，保持页面清爽。\n',
    icon: <ChevronRight className="w-4 h-4 text-slate-400" />,
  },

  // ==========================================
  // --- 4. 5 大标准 GitHub Alerts ---
  // ==========================================
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

  // ==========================================
  // --- 5. 基础排版与打印分页 ---
  // ==========================================
  {
    id: 'basic-page-break',
    name: '打印物理分页符 (Page Break)',
    nameEn: 'Print Page Break',
    category: 'basic',
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
    description: '强制在导出 PDF 或 A4 打印预览时开启全新页面',
    descriptionEn: 'Forces hard page break during PDF/Print export',
    snippet: '\n<div class="page-break"></div>\n\n',
    icon: <Scissors className="w-4 h-4 text-rose-400" />,
  },
  {
    id: 'basic-table',
    name: '3x3 数据表格 (Table)',
    nameEn: '3x3 Table',
    category: 'basic',
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
    description: '标准对齐的 Markdown 属性与数据矩阵表',
    descriptionEn: 'Standard Markdown data table',
    snippet: '| 字段名称 | 类型 | 说明 |\n| :--- | :---: | :--- |\n| id | string | 唯一标识符 |\n| name | string | 名称说明 |\n| status | boolean | 状态标识 |\n',
    icon: <Table className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'basic-task',
    name: '待办清单 (Task Checkbox)',
    nameEn: 'Task List (Checkbox)',
    category: 'basic',
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
    description: '带交互式勾选状态的任务待办项',
    descriptionEn: 'Interactive task checklist item',
    snippet: '- [ ] 待办事项 1\n- [ ] 待办事项 2\n- [x] 已完成事项\n',
    icon: <CheckSquare className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'basic-code',
    name: '代码块 (Code Block)',
    nameEn: 'Code Block',
    category: 'basic',
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
    description: '带语法高亮着色与语言声明的标准代码块',
    descriptionEn: 'Fenced code block with syntax highlighting',
    snippet: '```typescript\nfunction execute(): void {\n  console.log("Hello, OmniView");\n}\n```\n',
    icon: <Code className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'basic-h1',
    name: '一级标题 (H1)',
    nameEn: 'Heading 1 (H1)',
    category: 'basic',
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
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
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
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
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
    description: '小节与模块细化标题',
    descriptionEn: 'Subsection heading',
    snippet: '### 子节标题\n',
    icon: <Heading3 className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'basic-divider',
    name: '分割线 (Divider)',
    nameEn: 'Horizontal Rule',
    category: 'basic',
    categoryLabel: '基础排版与打印',
    categoryLabelEn: 'Basic & Print',
    description: '横向内容分隔线',
    descriptionEn: 'Horizontal thematic break rule',
    snippet: '\n---\n\n',
    icon: <Minus className="w-4 h-4 text-slate-400" />,
  },
];

export interface MarkdownQuickInserterProps {
  caretLeft?: number;
  caretTop?: number;
  cursorTop?: number;
  cursorLine: number;
  cursorColumn?: number;
  containerWidth?: number;
  isVisible: boolean;
  locale?: Locale;
  onInsert: (snippet: string, placeholderLength?: number) => void;
}

/**
 * 光标位置悬浮快速插入时间胶囊 (Floating Quick Pill)
 * 实时吸附在光标真实像素位置 (caretX, caretY)，内置项目专属非标准渲染与扩展特性
 */
export const MarkdownQuickInserter: React.FC<MarkdownQuickInserterProps> = ({
  caretLeft,
  caretTop,
  cursorTop,
  cursorLine,
  cursorColumn = 1,
  containerWidth = 800,
  isVisible,
  locale = 'zh-CN',
  onInsert,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'ddd' | 'diagrams' | 'interactive' | 'alerts' | 'basic'>('all');
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

  // 像素级光标位置计算
  const effectiveTop = caretTop !== undefined ? caretTop : (cursorTop ?? 0);
  const effectiveLeft = caretLeft !== undefined ? caretLeft : 60;

  // 胶囊宽度与右边界自适应
  const pillWidth = 296;
  const isRightConstrained = effectiveLeft + pillWidth + 24 > containerWidth;
  const leftPosition = isRightConstrained
    ? Math.max(52, effectiveLeft - pillWidth - 8)
    : Math.max(52, effectiveLeft + 8);

  const isPopupAlignRight = leftPosition + 380 > containerWidth;

  return (
    <div
      ref={menuRef}
      style={{
        top: `${Math.max(4, effectiveTop - 4)}px`,
        left: `${leftPosition}px`,
      }}
      className="absolute z-30 transition-all duration-100 select-none"
    >
      {/* 悬浮控制时间胶囊 (Floating Capsule - 紧密跟随光标) */}
      <div
        className="flex items-center gap-0.5 px-1.5 py-1 rounded-full border shadow-xl backdrop-blur-md transition group hover:shadow-2xl"
        style={{
          background: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
          boxShadow: 'var(--ov-shadow, 0 6px 18px rgba(0,0,0,0.32))',
        }}
      >
        {/* 光标行列微标 */}
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--ov-surface-header)] border border-[var(--ov-border)] text-[var(--ov-text-secondary)] opacity-85 shrink-0">
          L{cursorLine}{cursorColumn > 1 ? `:${cursorColumn}` : ''}
        </span>

        {/* 核心入口: 展开全量特性库 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition shrink-0 ${
            isOpen
              ? 'bg-[var(--ov-accent)] text-white shadow-xs'
              : 'hover:bg-[var(--ov-surface-hover)] hover:text-[var(--ov-text)] text-[var(--ov-text)]'
          }`}
          title={isEn ? 'Open OmniView Quick Insert Menu' : '展开 OmniView 工具特性插入库'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{isEn ? 'Insert' : '插入'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--ov-border)] my-auto mx-0.5" />

        {/* 专属高频 1: DDD 领域故事 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const item = QUICK_INSERT_ITEMS.find((it) => it.id === 'ddd-domain-story');
            if (item) onInsert(item.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-emerald-400 hover:text-emerald-300 cursor-pointer transition"
          title={isEn ? 'Insert DDD Domain Story' : '插入 DDD 领域故事模型 (domainstory)'}
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* 专属高频 2: ECharts 图表 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const item = QUICK_INSERT_ITEMS.find((it) => it.id === 'chart-echarts-bar');
            if (item) onInsert(item.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-teal-400 hover:text-teal-300 cursor-pointer transition"
          title={isEn ? 'Insert ECharts Diagram' : '插入 ECharts 数据图表 (echarts)'}
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>

        {/* 专属高频 3: Markmap 交互导图 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const item = QUICK_INSERT_ITEMS.find((it) => it.id === 'chart-markmap');
            if (item) onInsert(item.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-sky-400 hover:text-sky-300 cursor-pointer transition"
          title={isEn ? 'Insert Markmap Mindmap' : '插入 Markmap 交互思维导图 (markmap)'}
        >
          <Workflow className="w-3.5 h-3.5" />
        </button>

        {/* 专属高频 4: Tabs 交互卡片 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const item = QUICK_INSERT_ITEMS.find((it) => it.id === 'comp-tabs');
            if (item) onInsert(item.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-indigo-400 hover:text-indigo-300 cursor-pointer transition"
          title={isEn ? 'Insert Tabs Component' : '插入 Tabs 多标签卡片 ([!TABS])'}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        {/* 专属高频 5: GitHub Alert 提示 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const item = QUICK_INSERT_ITEMS.find((it) => it.id === 'alert-note');
            if (item) onInsert(item.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-blue-400 hover:text-blue-300 cursor-pointer transition"
          title={isEn ? 'Insert Note Alert' : '插入 Note 提示框 ([!NOTE])'}
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* 专属高频 6: 数据表格 */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const item = QUICK_INSERT_ITEMS.find((it) => it.id === 'basic-table');
            if (item) onInsert(item.snippet);
          }}
          className="p-1 rounded-full hover:bg-[var(--ov-surface-hover)] text-orange-400 hover:text-orange-300 cursor-pointer transition"
          title={isEn ? 'Insert Table' : '插入 3x3 数据表格'}
        >
          <Table className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 弹出的丰富工具特性选择面板 */}
      {isOpen && (
        <div
          className={`absolute mt-2 w-80 sm:w-96 rounded-xl border shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isPopupAlignRight ? 'right-0' : 'left-0'
          }`}
          style={{
            background: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
            boxShadow: 'var(--ov-shadow, 0 16px 40px -4px rgba(0,0,0,0.45))',
          }}
        >
          {/* 面板顶部搜索与分类 Tab */}
          <div className="p-2.5 border-b border-[var(--ov-border)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-[var(--ov-accent)]" />
                <span>{isEn ? 'OmniView Extended Markdown' : 'OmniView 专属渲染与特性库'}</span>
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
                placeholder={isEn ? 'Search (ddd, echarts, markmap, tabs, alert)...' : '搜索特性 (如: ddd, echarts, markmap, tabs)...'}
                className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-[var(--ov-border)] bg-[var(--ov-code-bg)] text-[var(--ov-text)] focus:outline-hidden focus:border-[var(--ov-accent)]"
              />
            </div>

            {/* 分类切换 Pills (6 大维度) */}
            <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5 no-scrollbar">
              {[
                { id: 'all', label: isEn ? 'All' : '全部' },
                { id: 'ddd', label: isEn ? 'DDD' : 'DDD模型' },
                { id: 'diagrams', label: isEn ? 'Charts' : '图表/导图' },
                { id: 'interactive', label: isEn ? 'Cards' : '交互卡片' },
                { id: 'alerts', label: isEn ? 'Alerts' : '警示框' },
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
            <span className="text-[var(--ov-accent)] font-medium">支持非标准扩展与图表</span>
          </div>
        </div>
      )}
    </div>
  );
};
