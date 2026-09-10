import { FileItem, ViewerDriver } from '../types';

export const SUPPORTED_DRIVERS: ViewerDriver[] = [
  {
    id: 'markdown',
    name: 'Markdown & Diagrams',
    displayName: 'Markdown (OKF + Markmap + Mermaid)',
    description: '富文本 Markdown 引擎，内嵌支持 Google OKF (Open Knowledge Format) 知识图谱、Markmap 全景思维导图、Mermaid 动态图表、PlantUML 架构图、Graphviz、LaTeX 数学公式与任务清单。',
    iconName: 'FileText',
    supportedExtensions: ['md', 'markdown', 'mdown', 'okf'],
    isBuiltin: true,
    version: '1.5.0',
    category: 'core',
    lazyLoaded: false,
    engine: 'marked + markmap + mermaid.js + plantuml-encoder',
    license: 'MIT (100% 自由开源)',
  },
  {
    id: 'plantuml',
    name: 'PlantUML Studio',
    displayName: 'PlantUML 架构建模引擎',
    description: '独立 PlantUML 设计器，支持时序图、组件图、部署图、状态机实时编译为矢量 SVG 及一键导出。',
    iconName: 'Network',
    supportedExtensions: ['puml', 'plantuml', 'iuml'],
    isBuiltin: true,
    version: '2.1.0',
    category: 'core',
    lazyLoaded: true,
    engine: 'PlantUML AST + SVG Vector Engine',
    license: 'GPL / Public Service Compatible',
  },
  {
    id: 'svg',
    name: 'SVG Vector Inspector',
    displayName: 'SVG 矢量图形分析器',
    description: '高精度矢量图查看器，支持平移缩放 (10%-500%)、标尺网格、DOM 结构分析与 XML 源码双向查看。',
    iconName: 'Compass',
    supportedExtensions: ['svg'],
    isBuiltin: true,
    version: '1.2.0',
    category: 'core',
    lazyLoaded: true,
    engine: 'Native Chromium Vector + DOMPurify',
    license: 'Apache-2.0',
  },
  {
    id: 'pdf',
    name: 'PDF Document Reader',
    displayName: 'PDF 现代化专业阅读器',
    description: '轻量化多页 PDF 阅读器，支持翻页缩放、目录大纲、自适应双栏与文档导出，零第三方商业依赖。',
    iconName: 'BookOpen',
    supportedExtensions: ['pdf'],
    isBuiltin: true,
    version: '3.0.0',
    category: 'core',
    lazyLoaded: true,
    engine: 'Mozilla PDF.js Core Driver',
    license: 'Apache-2.0',
  },
  {
    id: 'csv',
    name: 'Spreadsheet Grid',
    displayName: 'CSV / 表格智能数据网格',
    description: '轻量级数据表格查看器，支持列排序、全局模糊搜索、多列过滤、统计汇总与分页。',
    iconName: 'Table',
    supportedExtensions: ['csv', 'tsv'],
    isBuiltin: true,
    version: '1.1.0',
    category: 'extended',
    lazyLoaded: true,
    engine: 'Virtual Data Grid Engine',
    license: 'MIT',
  },
  {
    id: 'code',
    name: 'Universal Code Viewer',
    displayName: '源代码语法高亮器',
    description: 'VS Code 原生级代码只读/编辑容器，支持 JSON、YAML、XML、JS/TS 快速语法着色与格式化。',
    iconName: 'Code',
    supportedExtensions: ['json', 'yaml', 'yml', 'xml', 'ts', 'js', 'txt'],
    isBuiltin: true,
    version: '1.0.0',
    category: 'extended',
    lazyLoaded: false,
    engine: 'Prism.js Syntax Engine',
    license: 'MIT',
  },
  {
    id: 'mindmap',
    name: 'Mindmap Studio',
    displayName: 'Markmap 思维导图工作台',
    description: '专业交互式思维导图双向编辑器与矢量画布，支持层级缩进/大纲编辑、实时渲染、节点折叠展开、搜索定位与 SVG/HTML 矢量导出。',
    iconName: 'GitFork',
    supportedExtensions: ['markmap', 'mm', 'mindmap', 'km'],
    isBuiltin: true,
    version: '1.0.0',
    category: 'core',
    lazyLoaded: true,
    engine: 'Markmap Lib + D3 Tree Layout + SVG Engine',
    license: 'MIT',
  },
];

export const INITIAL_FILES: FileItem[] = [
  {
    id: 'file-okf-ecommerce-orders',
    name: 'orders.okf.md',
    path: '/workspace/sales/tables/orders.okf.md',
    extension: 'md',
    size: 2860,
    lastModified: Date.now(),
    content: `---
type: BigQuery Table
title: Orders (电商核心订单事实表)
description: 记录全球电商交易中每一笔已完成的客户订单，包含交易流水、金额汇总与交付链路。
resource: https://console.cloud.google.com/bigquery?p=omniview-demo&d=sales&t=orders
tags: [sales, ecommerce, revenue, core-fact]
timestamp: 2026-06-12T10:00:00Z
owner: data-analytics@omniview.internal
retention: 7 years
partition_by: DATE(created_at)
---

# 📦 电商订单数据字典 (Orders Concept)

> **Google OKF (Open Knowledge Format) 规范展示**：
> 本文档是基于 Google Cloud 官方倡导的 OKF v0.1 规范编写的概念节点。
> 顶部元数据已被结构化解析为实体卡片，包含类型、Tags 标签胶囊、外部链接及审计时间戳。

---

## 1. 字段架构与字典定义 (Schema)

| 字段名称 (Column) | 数据类型 (Type) | 模式 (Mode) | 语义说明与外键关联 (Description) | 示例取值 |
| :--- | :---: | :---: | :--- | :--- |
| \`order_id\` | \`STRING\` | REQUIRED | 全局唯一订单流水号，分布式雪花算法生成 | \`ORD-202606-9812\` |
| \`customer_id\` | \`STRING\` | REQUIRED | 客户主体外键，关联 [customers](/workspace/sales/tables/customers.okf.md) 概念 | \`CUST-88391\` |
| \`total_amount\` | \`FLOAT64\` | REQUIRED | 订单折后实际结算金额（单位：美元） | \`249.99\` |
| \`currency\` | \`STRING\` | REQUIRED | ISO 4217 结算货币代码 | \`USD\` |
| \`order_status\` | \`STRING\` | REQUIRED | 状态机枚举：\`PENDING\`、\`PAID\`、\`SHIPPED\`、\`DELIVERED\` | \`PAID\` |
| \`created_at\` | \`TIMESTAMP\` | REQUIRED | 订单创建 UTC 时间戳，分区键字段 | \`2026-06-12 09:30:15\` |

---

## 2. 实体关系与拓扑图谱 (Entity Relationships)

通过标准 Markdown 链接与 Mermaid，表达该表在数据仓库中的上下游拓扑：

\`\`\`mermaid
erDiagram
    CUSTOMERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    ORDERS ||--o| PAYMENTS : settles
    
    ORDERS {
        string order_id PK
        string customer_id FK
        float total_amount
        string order_status
        timestamp created_at
    }
    CUSTOMERS {
        string customer_id PK
        string email
        string region
    }
\`\`\`

---

## 3. 关联拓扑与指标应用 (Joins & Lineage)

- **客户主表关联**：通过 \`customer_id\` 与 [customers.okf.md](/workspace/sales/tables/customers.okf.md) 进行一对多关联。
- **业务指标支持**：本表作为底层事实输入，直接用于计算周活跃指标 [weekly_active_users.okf.md](/workspace/sales/metrics/weekly_active_users.okf.md)。
`,
  },
  {
    id: 'file-okf-customers',
    name: 'customers.okf.md',
    path: '/workspace/sales/tables/customers.okf.md',
    extension: 'md',
    size: 1420,
    lastModified: Date.now() - 1000 * 60 * 10,
    content: `---
type: BigQuery Table
title: Customers (注册用户维度表)
description: 存储全渠道已注册买家主数据，维护会员级别、首单时间与用户生命周期阶段。
resource: https://console.cloud.google.com/bigquery?p=omniview-demo&d=sales&t=customers
tags: [crm, users, dimension, gdpr]
timestamp: 2026-06-10T08:00:00Z
owner: user-growth@omniview.internal
---

# 👤 客户主数据维度表 (Customers Concept)

> **知识图谱跳转测试**：
> 点击关联链接可快速回跳至订单概念：[查看关联订单表](/workspace/sales/tables/orders.okf.md)

---

## 1. 字段字典 (Schema)

| 字段名称 | 类型 | 说明 |
| :--- | :---: | :--- |
| \`customer_id\` | \`STRING\` | 客户唯一主键 (PK) |
| \`email\` | \`STRING\` | 匿名脱敏用户邮箱 |
| \`tier\` | \`STRING\` | 会员等级 (\`STANDARD\`, \`VIP\`, \`ENTERPRISE\`) |
| \`country\` | \`STRING\` | 国家/地区二字码 (ISO 3166-1) |
`,
  },
  {
    id: 'file-okf-metrics-wau',
    name: 'weekly_active_users.okf.md',
    path: '/workspace/sales/metrics/weekly_active_users.okf.md',
    extension: 'md',
    size: 1980,
    lastModified: Date.now() - 1000 * 60 * 20,
    content: `---
type: Metric
title: Weekly Active Users (周活跃买家数)
description: 滚动过去 7 个自然日内至少完成过一次有效加购或支付动作的独立客户数。
resource: https://lookerstudio.google.com/reporting/omniview-wau
tags: [metrics, growth, kpi, analytics]
timestamp: 2026-06-11T16:00:00Z
owner: bi-team@omniview.internal
sla: Daily 04:00 UTC
---

# 📈 WAU 指标定义与计算口径

## 1. 统计学数学公式定义

周活跃度指标定义为在滑窗 $T = [t - 6, t]$ 内去重客户集合的基数测度：

$$\\text{WAU}(t) = \\left| \\bigcup_{i=0}^{6} \\mathcal{U}_{t - i} \\right|$$

其中 $\\mathcal{U}_k$ 代表第 $k$ 天发生核心交互行为的非空集合：

$$\\mathcal{U}_k = \\{ c \\in \\text{Customers} \\mid \\exists e \\in \\text{Events}_k : \\text{action}(e) \\in \\{\\text{'checkout'}, \\text{'purchase'}\\} \\}$$

---

## 2. 依赖上游数据源

- 核心交易事实：[orders.okf.md](/workspace/sales/tables/orders.okf.md)
- 会员主数据：[customers.okf.md](/workspace/sales/tables/customers.okf.md)
`,
  },
  {
    id: 'file-okf-bundle-native',
    name: 'knowledge-catalog.okf',
    path: '/workspace/knowledge-catalog.okf',
    extension: 'okf',
    size: 1650,
    lastModified: Date.now() - 1000 * 60 * 30,
    content: `---
type: Knowledge Catalog Bundle
title: Omnichannel Analytics OKF Bundle (原生 .okf 概念包)
description: 基于 Google Open Knowledge Format 规范编排的全渠道零售与智能体知识库索引。
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf
tags: [okf, standard, knowledge-graph, ai-agent]
timestamp: 2026-06-12T12:00:00Z
specification_version: 0.1
---

# 🌐 Google Open Knowledge Format 原生演示

本文件扩展名为 \`.okf\`，已被 OmniView 原生关联并自动分发至高精度知识渲染引擎。

---

## 概念目录索引 (Concepts Index)

- 📊 **订单事实表**：[orders.okf.md](/workspace/sales/tables/orders.okf.md)
- 👤 **客户维度表**：[customers.okf.md](/workspace/sales/tables/customers.okf.md)
- 📈 **核心增长指标**：[weekly_active_users.okf.md](/workspace/sales/metrics/weekly_active_users.okf.md)
`,
  },
  {
    id: 'file-system-mindmap',
    name: 'system-architecture.markmap',
    path: '/workspace/system-architecture.markmap',
    extension: 'markmap',
    size: 2450,
    lastModified: Date.now() - 1000 * 60 * 2,
    content: `# 全景研发工程与图表渲染平台

## 核心表现层驱动
- Markdown 全功能引擎
  - GFM 扩展语法排版
  - 任务复选框列表
  - 行内与独立代码着色
- 交互式矢量思维导图 (Markmap)
  - .markmap / .mm / .mindmap 多后缀原生识别
  - 实时双向编辑与大纲快捷片段
  - 动态折叠/展开与深度过滤
  - 节点搜索定位与高亮
- 架构建模工作台 (PlantUML)
  - 时序图 / 类图 / 组件部署图
  - 矢量 SVG 编译与缩放标尺
- 矢量图形检测器 (SVG)
  - 视口自适应与居中重置
  - DOM 结构探针与源码双向校验
- 专业文档阅读器 (PDF)
  - 分页缩放与目录大纲快速跳转

## 状态管理与协议层
- VS Code Webview 宿主协议桥接
  - document-change 文档双向实时持久化
  - open-source 原文件精准行列跳转
  - auto-save 自动防抖保存
- 跨端弹性容器排版
  - flex-col 全高满屏适配
  - 拖拽式分屏宽度动态分配

## 质量控制与门禁
- TypeScript 强类型静态防护
- 自动化端到端测试
- 离线独立 HTML / SVG 一键导出
`,
  },
  {
    id: 'file-markdown-tables',
    name: 'markdown-tables.md',
    path: '/workspace/markdown-tables.md',
    extension: 'md',
    size: 5380,
    lastModified: Date.now(),
    content: `# Markdown 高级富交互数据表格演示

> **交互特性升级**：
> - **悬停显隐工具栏 (Hover to Show)**：操作工具栏与图表体验保持一致，鼠标移动到表格区域平滑浮现展开，移开后自动收起淡出，保证沉浸式阅读。
> - **图钉常驻锁定**：点击工具栏右侧图钉按钮可随时将工具栏锁定为常驻显示。
> - **智能多态排序**：点击表头可智能识别纯数字、时延（ms）、存储容量（MB/GB）、货币（$）及日期，进行真实数值升降序排列。
> - **全文检索与行列高亮**：支持关键词过滤与行高亮，鼠标悬浮时十字交叉追踪光标所在单元格。
> - **原生微图表与多态导出**：对于包含数值列的表格，一键切换柱状图/折线图，支持复制 Markdown / 复制 CSV / 下载 CSV 文件。

---

## 1. 分布式系统核心服务性能监控与资源矩阵

*提示：点击工具栏中的 **图表视图** 按钮，即可将下表无缝转化为 SVG 柱状图或折线图。*

| 服务组件名称 | 节点实例数 | P95 时延 (ms) | 吞吐量 (k QPS) | 内存开销 (MB) | 健康状态 | 交付状态 | 核心算法与指标 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **API 网关服务** | 8 | 12.4 | 145.8 | 380 | [SUCCESS] | [x] 已上线 | $O(\\log N)$ 路由树查找 |
| **文档解析引擎** | 12 | 48.6 | 62.4 | 1420 | [SUCCESS] | [x] 已上线 | $T = \\alpha \\cdot S + \\beta$ |
| **矢量渲染管线** | 6 | 128.5 | 18.2 | 890 | [DONE] | [x] 已上线 | $\\sigma \\le 15\\text{ms}$ |
| **全文索引服务** | 4 | 35.2 | 84.5 | 1100 | [RUNNING] | [x] 已上线 | $\\text{BM25} + \\text{Cosine}$ |
| **PlantUML 中继** | 3 | 240.0 | 8.6 | 650 | [WARN] | [ ] 灰度验证 | 远程沙箱流式中继 |
| **PDF 导出渲染器** | 5 | 185.2 | 12.0 | 980 | [PENDING] | [ ] 性能调优 | Canvas 内存复用 |
| **分布式缓存协调器** | 6 | 4.8 | 210.5 | 240 | [SUCCESS] | [x] 已上线 | $R_{\\text{hit}} \\ge 98.5\\%$ |
| **身份认证鉴权** | 4 | 9.2 | 165.0 | 310 | [DONE] | [x] 已上线 | Ed25519 签名验签 |

---

## 2. 云原生实例规格与资源计费对比表

*提示：点击 **月度费用** 或 **内存规格** 表头，验证带单位与货币符号的智能数值排序。*

| 实例规格族 | CPU 核数 | 内存规格 | 系统盘容量 | 网络带宽 | 每月费用 | 可用区覆盖 | 推荐场景 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| \`c6g.medium\` | 1 vCPU | 2 GB | 40 GB SSD | 1.0 Gbps | $18.50/mo | 3 个可用区 | 边缘微服务、轻量代理 |
| \`c6g.xlarge\` | 4 vCPU | 8 GB | 100 GB SSD | 5.0 Gbps | $72.00/mo | 5 个可用区 | 中型 Web 业务集群 |
| \`m6i.2xlarge\` | 8 vCPU | 32 GB | 200 GB SSD | 10.0 Gbps | $168.00/mo | 6 个可用区 | 内存数据库、图计算分析 |
| \`r6i.4xlarge\` | 16 vCPU | 128 GB | 500 GB NVMe | 12.5 Gbps | $385.00/mo | 4 个可用区 | 大规模 Redis / ES 集群 |
| \`g4dn.xlarge\` | 4 vCPU | 16 GB | 125 GB NVMe | 25.0 Gbps | $298.50/mo | 3 个可用区 | GPU 深度学习推理与渲染 |

---

## 3. 敏捷工程需求排期与迭代状态跟踪

*提示：点击 **计划发布日期** 表头，验证 ISO 日期格式的智能时序排列。*

| 需求代号 | 需求特性名称 | 负责人 | 优先级 | 当前状态 | 计划发布日期 | 验收勾选 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **FR-TABLE-01** | 表格悬停自适应工具栏与图钉模式 |  | [SUCCESS] P0 | [DONE] | 2026-09-08 | [x] 验证通过 |
| **FR-TABLE-02** | 智能多态排序引擎 (数字/单位/日期) |  | [SUCCESS] P0 | [DONE] | 2026-09-05 | [x] 验证通过 |
| **FR-TABLE-03** | 表格全文即时搜索与关键字高亮 |  | [SUCCESS] P1 | [DONE] | 2026-09-06 | [x] 验证通过 |
| **FR-CHART-01** | 表格向 SVG 柱状/折线微图表一键切换 |  | [INFO] P1 | [DONE] | 2026-09-07 | [x] 验证通过 |
| **FR-EXPORT-02** | Markdown 与 CSV 结构化导出通道 |  | [INFO] P2 | [DONE] | 2026-09-07 | [x] 验证通过 |
| **FR-VIRT-03** | 超长百万行大数据网格虚拟化滚动 |  | [WARN] P2 | [IN_PROGRESS] | 2026-09-20 | [ ] 单元测试中 |

---

## 4. 常见算法复杂度与数学公式对照

*提示：OmniViewer 表格原生支持 KaTeX 行内数学公式解析与展示。*

| 算法分类 | 代表算法 | 最优时间复杂度 | 平均时间复杂度 | 最差时间复杂度 | 额外空间复杂度 | 理论收敛边界 |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **排序** | 快速排序 (QuickSort) | $O(N \\log N)$ | $O(N \\log N)$ | $O(N^2)$ | $O(\\log N)$ | $\\mathbb{E}[C_N] = 2N \\ln N$ |
| **排序** | 归并排序 (MergeSort) | $O(N \\log N)$ | $O(N \\log N)$ | $O(N \\log N)$ | $O(N)$ | 严格稳定排序 |
| **检索** | 二分查找 (BinarySearch)| $O(1)$ | $O(\\log N)$ | $O(\\log N)$ | $O(1)$ | 需预先具备单调有序性 |
| **图论** | 戴克斯特拉 (Dijkstra) | $O(V \\log V + E)$ | $O(E \\log V)$ | $O(V^2)$ | $O(V)$ | 权值非负约束 $w(u, v) \\ge 0$ |
| **动态规划** | 最长公共子序列 (LCS) | $O(MN)$ | $O(MN)$ | $O(MN)$ | $O(\\min(M, N))$ | 空间降维压缩 |
`,
  },
  {
    id: 'file-table-spec',
    name: 'table-visualization-spec.md',
    path: '/docs/table-visualization-spec.md',
    extension: 'md',
    size: 4520,
    lastModified: Date.now() - 1000 * 60 * 1,
    content: `# OmniViewer Markdown 高级富表格与数据可视化规范

> **测试目标**：验证 Markdown 表格的沉浸式交互能力，包括**吸顶表头**、**智能多态排序**（数值/日期/自然序）、**全文检索过滤**、**十字交叉行列高亮**、**状态徽章与公式内嵌**，以及针对数值型表格的一键 **原生微图表可视化 (Table to Chart)** 与 **CSV/Markdown 多态导出**。

---

## 一、微服务架构性能压测与资源开销基准表

下表包含服务的压测指标。表格支持点击表头在升序、降序与默认状态间无缝切换，点击顶部工具栏 **图表视图 (Chart)** 可直接切换为柱状图或折线图。

| 服务模块名称 | 部署实例数 | P95 延迟 (ms) | QPS 吞吐量 (k/s) | 内存占用 (MB) | 健康状态 | 交付阶段 | 核心指标公式 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| API Gateway | 8 | 12.4 | 145.8 | 380 | [SUCCESS] | [x] 已上线 | $O(\\log N)$ 路由树查找 |
| Document Parser | 12 | 48.6 | 62.4 | 1420 | [SUCCESS] | [x] 已上线 | $T = \\alpha \\cdot S + \\beta$ |
| Diagram Engine | 6 | 128.5 | 18.2 | 890 | [DONE] | [x] 已上线 | $\\sigma \\le 15\\text{ms}$ |
| Search & Index | 4 | 35.2 | 84.5 | 1100 | [RUNNING] | [x] 已上线 | $\\text{BM25} + \\text{Cosine}$ |
| PlantUML Bridge | 3 | 240.0 | 8.6 | 650 | [WARN] | [ ] 灰度验证 | 远程沙箱流式中继 |
| PDF Renderer | 5 | 185.2 | 12.0 | 980 | [PENDING] | [ ] 性能调优 | Canvas 内存复用 |
| Cache Coordinator | 6 | 4.8 | 210.5 | 240 | [SUCCESS] | [x] 已上线 | $R_{hit} \\ge 98.5\\%$ |
| Auth & Token | 4 | 9.2 | 165.0 | 310 | [DONE] | [x] 已上线 | Ed25519 签名验签 |

---

## 二、OmniViewer 格式驱动支持矩阵

| 驱动分类 | 格式拓展名 | 渲染引擎架构 | 首屏渲染耗时 | 交互功能特性 | 稳定性评级 |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Markdown** | .md, .markdown | Marked AST + DOMPurify | 18ms | 代码着色、表格分析、思维导图跳转 | [PASS] |
| **Mermaid** | \`\`\`mermaid | Mermaid.js v10 矢量管线 | 65ms | 缩放平移、全屏放大、源码双向编辑 | [PASS] |
| **PlantUML** | .puml, .plantuml | PlantUML Server SVG 编译 | 180ms | 架构时序图、组件图、本地服务直连 | [PASS] |
| **SVG 矢量图** | .svg | Native Chromium Vector | 8ms | 标尺网格、DOM 检查器、无损缩放 | [PASS] |
| **数据网格** | .csv, .tsv | Virtual Grid Engine | 25ms | 百万级行虚拟滚动、全局模糊查找 | [PASS] |
| **思维导图** | .markmap, .mm | Markmap D3 弹性布局 | 35ms | 节点展开收起、大纲编辑、SVG 导出 | [PASS] |

---

## 三、操作说明与快捷操作

1. **全文检索**：点击表格右上角放大镜图标，即可快速在当前表格中检索任意列的关键词，匹配行数即时反馈。
2. **多态排序**：点击任意列名，系统自动识别数字（如 \`12.4\`、\`1420\`）、单位（如 \`ms\`、\`MB\`）或文本，进行真实数值升降序排列。
3. **图表切换**：具备数值列的表格将在工具栏自动点亮 **图表视图** 按钮，点击即可查看 SVG 响应式柱状图与折线图。
4. **多格式导出**：点击 **MD** 复制 Markdown 源码，点击 **CSV** 复制或一键下载 CSV 文件。
5. **全屏沉浸视口**：点击全屏图标可在独立弹层中超宽幅滚动查看大型表格。
`,
  },
  {
    id: 'file-code-spec',
    name: 'code-rendering-spec.md',
    path: '/docs/code-rendering-spec.md',
    extension: 'md',
    size: 6890,
    lastModified: Date.now() - 1000 * 60 * 5,
    content: `# OmniViewer Markdown 代码与全格式渲染能力验证规范

> **测试目标**：验证在 Markdown 文件中各类编程语言语法高亮、代码块交互工具条、Mermaid / PlantUML / SVG 图表内嵌与【预览 / 源码】双模切换、独立复制按钮以及 GFM 扩展排版的支持情况。

---

## 一、代码渲染支持矩阵与多语言语法高亮

OmniViewer 内置 Prism.js 语法分析驱动，为 Markdown 中的代码块提供 VS Code Dark+ 现代化暗色主题高亮、行号标尺、语言标识徽章以及一键独立复制代码的能力。

### 1. TypeScript / React (前端与插件内核)

\`\`\`typescript
import { useState, useEffect, useMemo } from 'react';
import type { DriverContext, RenderResult } from '@omnivewer/core';

export interface CodeHighlightProps<T = string> {
  source: T;
  language: 'typescript' | 'python' | 'rust' | 'go';
  enableLineNumbers?: boolean;
  onCopySuccess?: (copiedText: string) => void;
}

export const useCodeRenderer = <T extends Record<string, unknown>>(
  context: DriverContext,
  initialPayload: T
): RenderResult<T> => {
  const [status, setStatus] = useState<'idle' | 'rendering' | 'ready'>('idle');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DOM_READY') {
        setStatus('ready');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return useMemo(() => ({ status, data: initialPayload }), [status, initialPayload]);
};
\`\`\`

### 2. Python (后端算法与数据分析)

\`\`\`python
import asyncio
from dataclasses import dataclass
from typing import AsyncGenerator, List, Optional

@dataclass(frozen=True)
class DocumentChunk:
    chunk_id: str
    token_count: int
    content: str
    metadata: Optional[dict] = None

class DocumentParserEngine:
    """高吞吐量异步文档切片与向量化解析引擎"""
    
    def __init__(self, model_name: str = "gemini-2.5-pro", batch_size: int = 64) -> None:
        self.model_name = model_name
        self.batch_size = batch_size
        self._cache = {}

    async def stream_parse(self, raw_text: str) -> AsyncGenerator[DocumentChunk, None]:
        lines: List[str] = [line.strip() for line in raw_text.splitlines() if line.strip()]
        for idx, line in enumerate(lines):
            await asyncio.sleep(0.01)  # 模拟非阻塞 I/O
            yield DocumentChunk(
                chunk_id=f"chunk-{idx:04d}",
                token_count=len(line.split()),
                content=line
            )

if __name__ == "__main__":
    parser = DocumentParserEngine()
    print(f"Initialized parser with model: {parser.model_name}")
\`\`\`

### 3. Rust (高性能本地驱动模块)

\`\`\`rust
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, PartialEq)]
pub enum DriverError {
    FileNotFound(String),
    CorruptedBuffer { bytes_read: usize, expected: usize },
    SandboxViolation,
}

pub struct MemoryCache<K, V> {
    storage: Arc<RwLock<HashMap<K, V>>>,
}

impl<K: std::hash::Hash + Eq + Clone, V: Clone> MemoryCache<K, V> {
    pub fn new() -> Self {
        Self {
            storage: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn get_or_insert_with<F>(&self, key: K, factory: F) -> Result<V, DriverError>
    where
        F: FnOnce() -> Result<V, DriverError>,
    {
        if let Some(val) = self.storage.read().unwrap().get(&key) {
            return Ok(val.clone());
        }

        let new_value = factory()?;
        self.storage.write().unwrap().insert(key, new_value.clone());
        Ok(new_value)
    }
}
\`\`\`

### 4. Go (微服务与并发任务调度)

\`\`\`go
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type WorkerPool struct {
	concurrency int
	tasks       chan func(ctx context.Context) error
	wg          sync.WaitGroup
}

func NewWorkerPool(concurrency int) *WorkerPool {
	return &WorkerPool{
		concurrency: concurrency,
		tasks:       make(chan func(ctx context.Context) error, concurrency*4),
	}
}

func (wp *WorkerPool) Start(ctx context.Context) {
	for i := 0; i < wp.concurrency; i++ {
		wp.wg.Add(1)
		go func(workerID int) {
			defer wp.wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case task, ok := <-wp.tasks:
					if !ok {
						return
					}
					if err := task(ctx); err != nil {
						fmt.Printf("[Worker %d] Task failed: %v\\n", workerID, err)
					}
				}
			}
		}(i)
	}
}
\`\`\`

### 5. SQL (分布式分析与窗口聚合)

\`\`\`sql
-- 统计近 30 天每日活跃文档查看时长及 P95 分位数
WITH daily_session_stats AS (
    SELECT
        user_id,
        DATE(created_at) AS session_date,
        driver_id,
        duration_seconds,
        ROW_NUMBER() OVER(
            PARTITION BY user_id, DATE(created_at) 
            ORDER BY duration_seconds DESC
        ) as session_rank
    FROM omni_access_logs
    WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
    session_date,
    driver_id,
    COUNT(DISTINCT user_id) AS active_users,
    ROUND(AVG(duration_seconds), 2) AS avg_duration_sec,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds) AS p95_duration_sec
FROM daily_session_stats
WHERE session_rank <= 10
GROUP BY session_date, driver_id
HAVING COUNT(DISTINCT user_id) > 100
ORDER BY session_date DESC, active_users DESC;
\`\`\`

### 6. Bash / Shell (自动化持续集成与部署)

\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/3] 开始 VS Code 扩展插件源码构建环境检查..."
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "错误：当前 Node.js 版本 $NODE_VERSION 低于要求版本 $REQUIRED_VERSION" >&2
    exit 1
fi

echo "==> [2/3] 编译 TypeScript 模块并生成 .vsix 安装包..."
npm run build
npx @vscode/vsce package --no-git-tag-version --out ./dist/omnivewer-latest.vsix

echo "==> [3/3] 打包产物校验完成：$(ls -lh ./dist/omnivewer-latest.vsix | awk '{print $5, $9}')"
\`\`\`

### 7. JSON 与 YAML 配置规范

\`\`\`json
{
  "omnivewer.drivers": {
    "markdown": { "enabled": true, "syntaxHighlightTheme": "tomorrow-night" },
    "mermaid": { "theme": "dark", "securityLevel": "loose", "zoomSpeed": 0.2 },
    "plantuml": { "serverUrl": "https://www.plantuml.com/plantuml", "renderFormat": "svg" }
  },
  "editor.fontSize": 14,
  "editor.lineNumbers": "on"
}
\`\`\`

\`\`\`yaml
name: Continuous Integration
on:
  push:
    branches: [ main, release/* ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run test
\`\`\`

### 8. Git 代码差异对比 (Diff)

\`\`\`diff
Index: src/drivers/DriverHost.ts
===================================================================
--- src/drivers/DriverHost.ts (revision 102)
+++ src/drivers/DriverHost.ts (revision 103)
@@ -14,8 +14,9 @@
- const DEFAULT_TIMEOUT = 3000;
+ const DEFAULT_TIMEOUT = 5000;
+ const MAX_RETRY_ATTEMPTS = 3;

  export async function executeRender(doc: Document): Promise<RenderOutput> {
-   return localDriver.render(doc);
+   return fallbackManager.wrapWithRetry(() => localDriver.render(doc), MAX_RETRY_ATTEMPTS);
  }
\`\`\`

---

## 二、图表渲染与【预览 / 源码】双模切换及独立复制

在以下图表卡片中，您可以：
1. 点击右上角 **【源码】** 按钮：直接查看原始图表代码，并支持**在线编辑**；
2. 编辑完成后点击 **【应用并渲染】**：观察图表实时编译更新；
3. 点击独立专属的 **【复制】** 按钮：直接将图表源码拷贝到剪贴板，带有即时反馈。

### 1. Mermaid 异步动态流程图

\`\`\`mermaid
flowchart TD
    MD[Markdown 源文件] --> Lexer[Token 语法树词法分析]
    Lexer --> Branch{识别块级标签?}
    
    Branch -->|code 块 / 语法高亮| Prism[Prism.js 语法着色引擎]
    Branch -->|mermaid 图表| MEngine[Mermaid 11+ 异步渲染管道]
    Branch -->|plantuml 图表| PEngine[PlantUML 矢量解析服务]
    Branch -->|svg 矢量图| SEngine[原生 SVG 视口沙箱]
    
    Prism --> Canvas[统一工作台可视化视图]
    MEngine --> Canvas
    PEngine --> Canvas
    SEngine --> Canvas

    classDef highlight fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#fff;
    class MD,Canvas highlight;
\`\`\`

### 2. Mermaid 时序交互图

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor User as 开发者 (User)
    participant Host as VS Code Extension Host
    participant Webview as Webview 沙箱
    participant Driver as OmniViewer Driver 核心

    User->>Host: 打开 test-document.md
    Host->>Webview: createWebviewPanel() 注入通信桥梁
    Webview->>Driver: dispatch({ type: "INIT_DOCUMENT", content })
    Driver-->>Webview: 返回 AST 语法树与图表流
    Webview-->>User: 毫秒级呈现富文本与高亮代码
\`\`\`

### 3. PlantUML 架构组件图

\`\`\`plantuml
@startuml
skinparam backgroundColor #0f172a
skinparam roundCorner 10
skinparam componentStyle uml2
skinparam ArrowColor #38bdf8
skinparam ComponentBorderColor #64748b
skinparam ComponentBackgroundColor #1e293b
skinparam ComponentFontColor #f8fafc

package "OmniViewer 核心架构" {
  [Document Router] as Router
  [Markdown Driver] as MD_Driver
  [Mermaid Driver] as MM_Driver
  [PlantUML Driver] as PU_Driver
  [SVG Canvas Driver] as SVG_Driver
}

cloud "外部扩展服务" {
  [PlantUML Server] as ExtServer
  [VS Code API] as VSC_Host
}

VSC_Host --> Router : 派发文件流
Router --> MD_Driver
Router --> MM_Driver
Router --> PU_Driver
Router --> SVG_Driver
PU_Driver ..> ExtServer : 映射矢量流
@enduml
\`\`\`

### 4. SVG 矢量图驱动 (代码块驱动)

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 120" width="100%" height="120">
  <defs>
    <linearGradient id="demoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0284c7" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect x="10" y="10" width="520" height="100" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2" filter="url(#shadow)"/>
  <circle cx="55" cy="60" r="28" fill="url(#demoGrad)" />
  <path d="M45 60 L52 67 L68 51" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="100" y="52" fill="#f8fafc" font-size="16" font-family="system-ui, sans-serif" font-weight="bold">OmniViewer 矢量渲染核心引擎已就绪</text>
  <text x="100" y="76" fill="#94a3b8" font-size="12" font-family="system-ui, sans-serif">支持代码块定义与工作区文件引用两种链接模式</text>
</svg>
\`\`\`

---

## 三、GFM 扩展排版规范与样式验证

### 1. 任务列表 (Task Checkboxes)

- [x] 多语言语法着色驱动接入 (Prism.js + Tomorrow Night 主题)
- [x] 代码块专用工具条：语言角标、代码行数统计、独立一键复制
- [x] Mermaid / PlantUML / SVG 图表【预览 / 源码】无缝切换
- [x] 图表源码模式下支持在线实时修改并重新编译渲染
- [x] 分离“复制”功能为独立操作按钮，消除模式混淆
- [ ] 离线局域网私有 PlantUML Server 本地容器直连

### 2. 对齐表格格式 (GFM Tables)

| 功能特性 | 触发语法 / 拓展名 | 默认视图模式 | 源码编辑支持 | 复制操作按钮 |
| :--- | :---: | :---: | :---: | :--- |
| **代码高亮** | \`\`\`ts / \`\`\`py / \`\`\`rs | 代码卡片 | 原生编辑器 | 独立复制按钮（带勾选动画） |
| **Mermaid** | \`\`\`mermaid | 可视化图表 | 支持在线双向编辑 | 独立复制源码按钮 |
| **PlantUML** | \`\`\`plantuml 或 .puml | 矢量渲染图 | 支持在线双向编辑 | 独立复制源码按钮 |
| **SVG 矢量图**| \`\`\`svg 或 .svg | 矢量沙箱 | 支持在线编辑 XML | 独立复制 XML 按钮 |
| **行内代码** | \`const val = 1\` | 高亮药丸徽章 | 行内文本编辑 | 随文本跟随复制 |

### 3. 引用提示卡片 (Callout Quotes)

> **💡 研发提示 (Tip)**：
> 在 Markdown 中不仅可以使用标准代码块，还可以直接通过 \`![架构](./cloud-infrastructure.svg)\` 引用同工作区内的任意 SVG 文件，OmniViewer 均会自动激活矢量驱动并提供缩放、网格和源码切换！

> **⚠️ 安全规范 (Security Note)**：
> 所有动态插入的 HTML 与 SVG 均经过严格沙箱隔离与 DOMPurify 净化，防范 XSS 攻击与脚本注入风险。
`,
  },
  {
    id: 'file-1',
    name: 'architecture-spec.md',
    path: '/docs/architecture-spec.md',
    extension: 'md',
    size: 5420,
    lastModified: Date.now() - 1000 * 60 * 30,
    content: `# OmniViewer 架构设计与规范说明书

> **版本**：v1.0.0 | **类型**：VS Code 扩展插件技术规格 | **授权**：100% 开源 (MIT)

OmniViewer 是一个面向 **Visual Studio Code** 的高扩展性多格式文件统一渲染引擎。本文档展示了 **Mermaid 流程图、时序图、PlantUML 架构图、矢量 SVG、数据表格与公式** 的无缝内嵌渲染效果。

---

## 一、核心特性矩阵

| 特性模块 | 支持能力 | 底层引擎 | 性能与包体积开销 |
| :--- | :--- | :--- | :--- |
| **Markdown** | GFM 标准、扩展语法、任务列表 | Marked + DOMPurify | < 120KB (极速即时解析) |
| **Mermaid** | 流程图、时序图、甘特图、状态图 | Mermaid.js 10+ | 按需动态载入 (Lazy Load) |
| **PlantUML** | 架构图、类图、组件图、用例图 | 官方/私有 SVG 渲染服务 | 毫秒级 URL 映射 |
| **SVG 矢量图**| 缩放平移、网格对齐、DOM 检查 | 原生 SVG 视口容器 | 零额外开销 |
| **PDF 预览** | 多页翻页、自适应缩放、大纲目录 | PDF.js / 矢量分页 | 隔离沙箱按需载入 |

---

## 二、Mermaid 流程图示例 (在线动态渲染)

以下为 VS Code 插件 Extension Host 与 Webview 沙箱的数据通信链路：

\`\`\`mermaid
flowchart TD
    A[用户在 VS Code 打开文件] --> B{后缀名路由匹配}
    B -->|*.md| C[Markdown Driver]
    B -->|*.svg| D[SVG Vector Driver]
    B -->|*.pdf| E[PDF Reader Driver]
    B -->|*.puml| F[PlantUML Driver]
    
    C --> G[AST 语法树解析]
    G --> H{检测内部图表标记}
    H -->|mermaid 块| I[动态调用 Mermaid.render]
    H -->|plantuml 块| J[生成 PlantUML 矢量映射]
    H -->|标准正文| K[DOMPurify 安全过滤输出]
    
    I --> L[VS Code Webview DOM 渲染]
    J --> L
    K --> L
    D --> L
    E --> L
\`\`\`

---

## 三、Mermaid 时序图示例 (双向通信机制)

\`\`\`mermaid
sequenceDiagram
    autonumber
    participant User as 开发者
    participant Host as VS Code 扩展进程
    participant Webview as 渲染沙箱 (Webview)
    
    User->>Host: 双击打开 architecture-spec.md
    Host->>Host: OfficeEditorProvider 实例化
    Host->>Webview: postMessage({ action: 'OPEN', content, ext: 'md' })
    Webview->>Webview: Marked 解析 + Mermaid 渲染
    Webview-->>Host: postMessage({ action: 'RENDER_COMPLETE', timeMs: 42 })
    Note over Webview,Host: 用户在 Webview 中修改或缩放图表
    User->>Webview: 编辑内容
    Webview->>Host: postMessage({ action: 'DOCUMENT_DIRTY' })
    Host->>User: 标记标签页为修改状态 (●)
\`\`\`

---

## 四、PlantUML 架构组件图示例

在文档内直接书写 \`\`\`plantuml 代码块，OmniViewer 会自动将其编译为高清矢量图：

\`\`\`plantuml
@startuml
skinparam componentStyle uml2
skinparam packageStyle rectangle

package "VS Code Extension Host" {
  [Extension Entry] as Entry
  [OfficeEditorProvider] as Provider
  [File Watcher] as Watcher
  Entry ..> Provider : 注册 customEditors
  Watcher ..> Provider : 监听文件变动
}

package "Webview Container" {
  [Bridge Protocol] as Bridge
  [Driver Router] as Router
  
  package "Drivers Engine" {
    [Markdown Engine] as MDEngine
    [Mermaid Dynamic] as Mermaid
    [PlantUML Proxy] as PUML
    [SVG Inspector] as SVG
    [PDF Reader] as PDF
  }
}

Provider <--> Bridge : vscode.postMessage 通信
Bridge --> Router
Router --> MDEngine
Router --> SVG
Router --> PDF
MDEngine ..> Mermaid : 按需激活
MDEngine ..> PUML : 按需激活
@enduml
\`\`\`

---

## 五、SVG 矢量图双模驱动渲染 (SVG Dual-Mode Driver)

OmniViewer 在 Markdown 中提供专业 SVG 矢量驱动支持：包含 **代码块实时编译** 与 **引用工作区本地矢量文件** 两种模式。

### 1. 模式一：\`\`\`svg 原生代码块驱动渲染
支持在 Markdown 中直接撰写 \`\`\`svg 代码块，OmniViewer 会自动激活 SVG Driver，提供独立缩放、网格背景、源码切换与导出功能：

\`\`\`svg
<svg width="100%" height="160" viewBox="0 0 760 160" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>

  <!-- Container Box -->
  <rect x="2" y="2" width="756" height="156" rx="12" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5"/>

  <!-- Pipeline Nodes -->
  <g transform="translate(30, 35)">
    <!-- Node 1 -->
    <rect x="0" y="10" width="130" height="70" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="2"/>
    <text x="65" y="42" fill="#38bdf8" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui">Marked AST</text>
    <text x="65" y="62" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui">分词语法树解析</text>

    <!-- Arrow 1 -->
    <path d="M 135 45 L 185 45" stroke="url(#lineGrad)" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="4,4"/>
    <polygon points="185,41 195,45 185,49" fill="#10b981"/>

    <!-- Node 2 -->
    <rect x="200" y="10" width="140" height="70" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <text x="270" y="42" fill="#34d399" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui">DOMPurify</text>
    <text x="270" y="62" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui">SVG 白名单消毒</text>

    <!-- Arrow 2 -->
    <path d="M 345 45 L 395 45" stroke="#10b981" stroke-width="2" stroke-dasharray="4,4"/>
    <polygon points="395,41 405,45 395,49" fill="#a855f7"/>

    <!-- Node 3 -->
    <rect x="410" y="10" width="140" height="70" rx="8" fill="#1e293b" stroke="#a855f7" stroke-width="2"/>
    <text x="480" y="42" fill="#c084fc" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui">SVG Inspector</text>
    <text x="480" y="62" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui">无损视口缩放与平移</text>

    <!-- Arrow 3 -->
    <path d="M 555 45 L 605 45" stroke="#a855f7" stroke-width="2"/>
    <polygon points="605,41 615,45 605,49" fill="#3b82f6"/>

    <!-- Node 4 -->
    <rect x="620" y="10" width="80" height="70" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="660" y="42" fill="#60a5fa" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui">Webview</text>
    <text x="660" y="62" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui">完美上屏</text>
  </g>
  <text x="40" y="140" fill="#64748b" font-size="11" font-family="system-ui">OmniViewer Pipeline Spec • 纯客户端零网络往返延迟 • 矢量无级放大</text>
</svg>
\`\`\`

### 2. 模式二：引用工作区中的本地 SVG 文件
支持使用标准 Markdown 图片语法 \`![图表说明](./文件名.svg)\` 直接加载并渲染当前工作区中的矢量图纸：

![云原生微服务架构全景图](./cloud-infrastructure.svg)

---

## 六、工程开发任务检查清单

- [x] 完成多驱动架构 (Driver-based Plugin Architecture) 接口定义
- [x] 实现 Markdown GFM 规范与 Mermaid 10+ 异步渲染管线
- [x] 打通 PlantUML 在线与私有服务矢量编译
- [x] 实现 SVG 交互式视口检查器 (平移、缩放、网格标尺)
- [x] 实现高仿真多页 PDF 阅读器与翻页定位
- [ ] 发布 VS Code Marketplace 官方扩展插件包 (.vsix)
`,
  },
  {
    id: 'file-2',
    name: 'cloud-topology.puml',
    path: '/diagrams/cloud-topology.puml',
    extension: 'puml',
    size: 1650,
    lastModified: Date.now() - 1000 * 60 * 120,
    content: `@startuml
title 微服务云原生拓扑架构 (OmniViewer PlantUML Driver)
autonumber

actor "客户端 / Web / VSCode" as Client #LightSkyBlue
participant "API Gateway (Kong/Nginx)" as Gateway #LightGreen
participant "Auth Service (JWT/OAuth)" as Auth #LightPink
participant "Document Core Service" as Core #Gold
database "PostgreSQL / Metadata" as DB #LightCyan
queue "Kafka Message Queue" as MQ #Plum
participant "Async Render Worker" as Worker #Orange

Client -> Gateway : 发送文件渲染请求 /api/v1/render
activate Gateway

Gateway -> Auth : 鉴权验证 Bearer Token
activate Auth
Auth --> Gateway : 鉴权通过 (uid: 9527)
deactivate Auth

Gateway -> Core : 转发渲染任务负载 (Payload)
activate Core
Core -> DB : 读取文档结构元数据
DB --> Core : 返回文档元数据与缓存状态

alt 缓存命中 (Cache Hit)
    Core --> Gateway : 毫秒级返回已生成的矢量 SVG
    Gateway --> Client : 200 OK (渲染完成)
else 缓存未命中 (Cache Miss)
    Core -> MQ : 发布渲染异步事件 (render.task.created)
    MQ -> Worker : 消费并编译 PlantUML / Mermaid 脚本
    activate Worker
    Worker -> Worker : 离线生成高清矢量图形
    Worker -> DB : 写入图形持久化缓存
    Worker --> MQ : 任务完成回调
    deactivate Worker
    Core --> Gateway : 返回编译结果流
    Gateway --> Client : 200 OK (流式完成)
end

deactivate Core
deactivate Gateway

@enduml
`,
  },
  {
    id: 'file-3',
    name: 'cloud-infrastructure.svg',
    path: '/assets/cloud-infrastructure.svg',
    extension: 'svg',
    size: 3820,
    lastModified: Date.now() - 1000 * 60 * 240,
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#6d28d9" />
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="cardGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- 背景画布 -->
  <rect width="800" height="500" fill="url(#bgGrad)" rx="16" />
  
  <!-- 标题与网格 -->
  <text x="40" y="50" fill="#f8fafc" font-size="22" font-weight="bold" font-family="system-ui, sans-serif">OmniViewer 现代云原生微服务架构全景图</text>
  <text x="40" y="78" fill="#94a3b8" font-size="13" font-family="system-ui, sans-serif">High-Reliability Multi-Format Rendering Cluster Topology</text>

  <!-- 节点 1: 客户端 -->
  <g filter="url(#cardGlow)">
    <rect x="40" y="140" width="180" height="240" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2" />
    <rect x="40" y="140" width="180" height="40" rx="12" fill="#334155" />
    <text x="56" y="165" fill="#f1f5f9" font-size="14" font-weight="bold" font-family="system-ui">终端宿主 (Host)</text>
    
    <rect x="56" y="195" width="148" height="44" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5" />
    <text x="70" y="222" fill="#93c5fd" font-size="13" font-family="system-ui">VS Code Desktop</text>
    
    <rect x="56" y="250" width="148" height="44" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5" />
    <text x="70" y="277" fill="#93c5fd" font-size="13" font-family="system-ui">VS Code for Web</text>
    
    <rect x="56" y="305" width="148" height="44" rx="6" fill="#0f172a" stroke="#64748b" stroke-width="1" />
    <text x="70" y="332" fill="#cbd5e1" font-size="13" font-family="system-ui">Standalone CLI / CI</text>
  </g>

  <!-- 节点 2: 网关中枢 -->
  <g filter="url(#cardGlow)">
    <rect x="310" y="140" width="180" height="240" rx="12" fill="#1e293b" stroke="#8b5cf6" stroke-width="2" />
    <rect x="310" y="140" width="180" height="40" rx="12" fill="url(#purpleGrad)" />
    <text x="326" y="165" fill="#ffffff" font-size="14" font-weight="bold" font-family="system-ui">调度内核 (Core)</text>
    
    <rect x="326" y="195" width="148" height="38" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1" />
    <text x="340" y="219" fill="#c4b5fd" font-size="12" font-family="system-ui">Driver Dispatcher</text>
    
    <rect x="326" y="243" width="148" height="38" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1" />
    <text x="340" y="267" fill="#c4b5fd" font-size="12" font-family="system-ui">AST Pipeline Cache</text>
    
    <rect x="326" y="291" width="148" height="38" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1" />
    <text x="340" y="315" fill="#c4b5fd" font-size="12" font-family="system-ui">IPC RPC Protocol</text>
    
    <rect x="326" y="335" width="148" height="32" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1" />
    <text x="340" y="356" fill="#c4b5fd" font-size="11" font-family="system-ui">CSP Security Wall</text>
  </g>

  <!-- 节点 3: 渲染引擎集群 -->
  <g filter="url(#cardGlow)">
    <rect x="580" y="110" width="180" height="300" rx="12" fill="#1e293b" stroke="#10b981" stroke-width="2" />
    <rect x="580" y="110" width="180" height="40" rx="12" fill="url(#emeraldGrad)" />
    <text x="596" y="135" fill="#ffffff" font-size="14" font-weight="bold" font-family="system-ui">驱动矩阵 (Drivers)</text>
    
    <rect x="596" y="165" width="148" height="34" rx="6" fill="#064e3b" />
    <text x="610" y="187" fill="#6ee7b7" font-size="12" font-family="system-ui">Markdown Engine</text>
    
    <rect x="596" y="207" width="148" height="34" rx="6" fill="#064e3b" />
    <text x="610" y="229" fill="#6ee7b7" font-size="12" font-family="system-ui">Mermaid.js Core</text>
    
    <rect x="596" y="249" width="148" height="34" rx="6" fill="#064e3b" />
    <text x="610" y="271" fill="#6ee7b7" font-size="12" font-family="system-ui">PlantUML Vector</text>
    
    <rect x="596" y="291" width="148" height="34" rx="6" fill="#064e3b" />
    <text x="610" y="313" fill="#6ee7b7" font-size="12" font-family="system-ui">SVG Viewport Pan</text>
    
    <rect x="596" y="333" width="148" height="34" rx="6" fill="#064e3b" />
    <text x="610" y="355" fill="#6ee7b7" font-size="12" font-family="system-ui">Mozilla PDF.js</text>
    
    <rect x="596" y="375" width="148" height="28" rx="6" fill="#064e3b" />
    <text x="610" y="394" fill="#6ee7b7" font-size="11" font-family="system-ui">Data Grid / CSV</text>
  </g>

  <!-- 连接箭头 -->
  <path d="M 220 230 L 310 230" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6,4" fill="none" />
  <polygon points="308,225 318,230 308,235" fill="#3b82f6" />

  <path d="M 490 230 L 580 230" stroke="#10b981" stroke-width="3" stroke-dasharray="6,4" fill="none" />
  <polygon points="578,225 588,230 578,235" fill="#10b981" />

  <!-- 底部指标状态 -->
  <rect x="40" y="440" width="720" height="36" rx="8" fill="#1e293b" stroke="#334155" />
  <text x="56" y="463" fill="#38bdf8" font-size="12" font-weight="600" font-family="system-ui">● SYSTEM HEALTHY</text>
  <text x="180" y="463" fill="#94a3b8" font-size="12" font-family="system-ui">Average AST Parse: 18ms</text>
  <text x="360" y="463" fill="#94a3b8" font-size="12" font-family="system-ui">Memory Footprint: ~45MB</text>
  <text x="540" y="463" fill="#94a3b8" font-size="12" font-family="system-ui">Zero License Gateways (100% Free)</text>
</svg>
`,
  },
  {
    id: 'file-4',
    name: 'technical-whitepaper.pdf',
    path: '/specs/technical-whitepaper.pdf',
    extension: 'pdf',
    size: 24500,
    lastModified: Date.now() - 1000 * 60 * 60,
    content: `# Technical Whitepaper: OmniViewer Architecture Specification

This is a multi-page PDF document specification for the OmniViewer VS Code Extension.
Page 1: Executive Summary and Industry Comparison
Page 2: Sandboxed Webview IPC Protocols and CSP Security
Page 3: Performance Benchmarks & Lazy-Loading Strategy
Page 4: Deployment & Verification Runbook
`,
  },
  {
    id: 'file-5',
    name: 'performance-benchmarks.csv',
    path: '/data/performance-benchmarks.csv',
    extension: 'csv',
    size: 1840,
    lastModified: Date.now() - 1000 * 60 * 180,
    content: `Engine,Package Size (VSIX),Cold Startup Time,Webview RAM Usage,License Model,Mermaid Support,PlantUML Support,PDF Support,Commercial Limitations
OmniViewer (本自研方案),1.8 MB,140 ms,42 MB,100% Free MIT,原生实时渲染,原生实时映射,原生支持,无任何限制 (零收费/零弹窗)
vscode-office (参考竞品),18.4 MB,820 ms,186 MB,Freemium (VIP收费),需第三方扩展,受限,内置 (基础),部分格式与高级导出需赞助/VIP
Markdown All in One,2.1 MB,190 ms,38 MB,MIT,需单独安装 Mermaid 插件,不支持,仅通过外部扩展,仅局限 Markdown 格式
PDF Viewer by tomoki,3.4 MB,310 ms,65 MB,MIT,不支持,不支持,良好,仅支持 PDF 单一格式
PlantUML by jebbs,1.2 MB,260 ms,45 MB,MIT,不支持,需本地 Java 或配置服务器,不支持,仅支持 PlantUML 格式
`,
  },
  {
    id: 'file-6',
    name: 'package.json',
    path: '/extension/package.json',
    extension: 'json',
    size: 3200,
    lastModified: Date.now() - 1000 * 60 * 15,
    content: `{
  "name": "omnivewer-vscode",
  "displayName": "OmniViewer - Universal Document & Diagram Viewer",
  "description": "Clean, fast, 100% free multi-format file viewer for VS Code (Markdown, Mermaid, PlantUML, SVG, PDF, CSV).",
  "version": "1.0.0",
  "publisher": "omnivewer-team",
  "license": "MIT",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Programming Languages",
    "Visualization",
    "Other"
  ],
  "activationEvents": [
    "onCustomEditor:omnivewer.editor"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "customEditors": [
      {
        "viewType": "omnivewer.editor",
        "displayName": "OmniViewer: 富文本与图表预览",
        "selector": [
          { "filenamePattern": "*.md" },
          { "filenamePattern": "*.markdown" },
          { "filenamePattern": "*.svg" },
          { "filenamePattern": "*.pdf" },
          { "filenamePattern": "*.puml" },
          { "filenamePattern": "*.plantuml" },
          { "filenamePattern": "*.csv" },
          { "filenamePattern": "*.tsv" },
          { "filenamePattern": "*.yaml" },
          { "filenamePattern": "*.yml" },
          { "filenamePattern": "*.ts" }
        ],
        "priority": "option"
      }
    ],
    "commands": [
      {
        "command": "omnivewer.openPreview",
        "title": "OmniViewer: 在侧边栏分屏打开渲染视图",
        "icon": "$(open-preview)"
      },
      {
        "command": "omnivewer.exportSvg",
        "title": "OmniViewer: 导出当前图形为 SVG"
      }
    ]
  }
}
`,
  },
  {
    id: 'file-mermaid-gallery',
    name: 'mermaid-visual-gallery.md',
    path: '/diagrams/mermaid-visual-gallery.md',
    extension: 'md',
    size: 7850,
    lastModified: Date.now() - 1000 * 60 * 20,
    content: `# Mermaid 动态图表全景展馆 (Mermaid Visual Gallery)

> **引擎版本**：Mermaid.js v11+ | **渲染驱动**：OmniView Markdown & Diagram Engine | **作者**

本文档全面演示 OmniView 渲染引擎对 **Mermaid** 丰富图表类型的解析能力，包含 **流程图、时序图、类图、状态机、甘特图、Git 工作流图与数据占比饼图**。支持暗色/亮色多主题自适应渲染！

---

## 1. 复杂带分组与样式流程图 (Flowchart with Subgraphs)

\`\`\`mermaid
flowchart TB
    subgraph ClientLayer["💻 终端接入层 (Client & Gateway)"]
        Browser["Web 浏览器 (React 19)"]
        VSCodeExt["VS Code 扩展 (Webview IPC)"]
        MobileApp["移动巡检终端 (H5)"]
    end

    subgraph APIGateway["🛡️ 边缘网关集群 (Traefik / Envoy)"]
        WAF["WAF 深度防护 & 限流"]
        AuthRouter["OAuth2 / JWT 认证中心"]
    end

    subgraph ServiceMesh["⚙️ 微服务中枢 (Istio Service Mesh)"]
        DocService["文档解析服务 (Marked AST)"]
        RenderCluster["矢量图形编译集群 (Mermaid / PlantUML)"]
        CacheStore[("Redis 7.2 L2 缓存池")]
    end

    subgraph StorageLayer["💾 数据与对象存储 (Persistence)"]
        ObjectStore[("S3 / MinIO 矢量图库")]
        Postgres[("PostgreSQL 16 元数据库")]
    end

    Browser --> WAF
    VSCodeExt --> WAF
    MobileApp --> WAF
    WAF --> AuthRouter
    AuthRouter --> DocService
    AuthRouter --> RenderCluster
    DocService <--> CacheStore
    RenderCluster <--> CacheStore
    RenderCluster --> ObjectStore
    DocService --> Postgres

    style ClientLayer fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style APIGateway fill:#1e293b,stroke:#a855f7,stroke-width:2px,color:#fff
    style ServiceMesh fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff
    style StorageLayer fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fff
\`\`\`

---

## 2. 状态机图 (State Diagram v2)

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle: 系统初始化完成
    
    state "等待任务 (Ready)" as Idle
    state "解析与编译中 (Processing)" as Busy {
        [*] --> Tokenizing: 词法切片
        Tokenizing --> ASTTree: 构建语法抽象树
        ASTTree --> VectorRender: 生成 SVG 矢量图
        VectorRender --> Sanitizing: DOMPurify 安全过滤
        Sanitizing --> [*]
    }
    
    state "渲染就绪 (Rendered)" as Complete
    state "降级容灾模式 (Fallback)" as ErrorState

    Idle --> Busy: 收到文件变动消息
    Busy --> Complete: 解析成功 (耗时 < 30ms)
    Busy --> ErrorState: 格式畸变或解析超时
    ErrorState --> Busy: 用户修改重试
    Complete --> Idle: 资源缓存释放
\`\`\`

---

## 3. 面向对象类图 (Class Diagram)

\`\`\`mermaid
classDiagram
    class ViewerDriver {
        <<interface>>
        +String id
        +String name
        +String[] supportedExtensions
        +Boolean isBuiltin
        +render(context) RenderResult
        +dispose() void
    }

    class MarkdownDriver {
        -MarkedOptions options
        -MermaidEngine mermaid
        -DOMPurifyFilter filter
        +parse(source) AST
        +renderDiagrams() void
    }

    class SvgDriver {
        -ViewportController viewport
        -Double zoomFactor
        +pan(dx, dy) void
        +zoom(scale) void
        +exportPng() Blob
    }

    class CsvDataDriver {
        -Array~Record~ rawRows
        -String delimiter
        +filter(query) Array
        +sortBy(column, asc) Array
        +exportTsv() String
    }

    ViewerDriver <|-- MarkdownDriver
    ViewerDriver <|-- SvgDriver
    ViewerDriver <|-- CsvDataDriver
\`\`\`

---

## 4. 研发甘特图 (Gantt Project Timeline)

\`\`\`mermaid
gantt
    title OmniView 核心里程碑与特性迭代排期
    dateFormat YYYY-MM-DD
    section 核心驱动层
        Marked 语法树优化与安全隔离      :done, des1, 2026-08-01, 2026-08-12
        Mermaid 11 异步图表渲染引擎     :done, des2, 2026-08-10, 2026-08-22
        PlantUML 矢量代理协议接入       :done, des3, 2026-08-18, 2026-08-30
    section 交互与体验
        多主题切换系统 (暗黑/浅雅/羊皮)  :active, des4, 2026-09-01, 2026-09-10
        顶栏丰富工具条与快捷动作箱      :active, des5, 2026-09-03, 2026-09-12
        全格式多样化样本集丰富          :active, des6, 2026-09-05, 2026-09-14
    section 发布与部署
        VS Code Webview 通信严密门禁    :crit, des7, 2026-09-15, 2026-09-22
        VSIX 插件合包构建与上架验证     :crit, des8, 2026-09-23, 2026-09-30
\`\`\`

---

## 5. 软件工程 Git 工作流图 (GitGraph)

\`\`\`mermaid
gitGraph
    commit id: "v0.1.0-init" tag: "v0.1.0"
    branch feature/render-engine
    checkout feature/render-engine
    commit id: "feat: add marked and dompurify"
    commit id: "feat: mermaid async integration"
    checkout main
    merge feature/render-engine id: "merge: core engine"
    branch feature/themes-toolbar
    checkout feature/themes-toolbar
    commit id: "feat: add 5 distinct themes"
    commit id: "feat: rich workbench top toolbar"
    checkout main
    merge feature/themes-toolbar id: "merge: ui enrichment" tag: "v0.2.0"
\`\`\`

---

## 6. 文件格式支持占比饼图 (Pie Chart)

\`\`\`mermaid
pie title OmniView 工作台已支持与验证文件格式覆盖率
    "Markdown & 富文本" : 32
    "矢量图表 (Mermaid / PlantUML)" : 28
    "高精度 SVG 矢量" : 16
    "结构化数据 (CSV / TSV)" : 12
    "代码与配置 (TS / YAML / JSON)" : 12
\`\`\`
`,
  },
  {
    id: 'file-order-statemachine',
    name: 'order-fulfillment-lifecycle.puml',
    path: '/diagrams/order-fulfillment-lifecycle.puml',
    extension: 'puml',
    size: 2450,
    lastModified: Date.now() - 1000 * 60 * 45,
    content: `@startuml
title 现代分布式订单流转与履约状态机 (PlantUML State Diagram)
skinparam backgroundColor #0b1120
skinparam state {
  StartColor #38bdf8
  EndColor #ef4444
  BackgroundColor #1e293b
  BorderColor #3b82f6
  FontColor #f1f5f9
  ArrowColor #60a5fa
  AttributeFontColor #94a3b8
}

[*] --> 待支付 : 用户提交购物车并锁单

state 待支付 {
  [*] --> 创建支付意图
  创建支付意图 --> 等待第三方扣款回调 : 发送预支付请求
  等待第三方扣款回调 --> 支付超时失效 : 30分钟未完成
}

待支付 --> 订单已取消 : 超时取消 / 用户主动取消
待支付 --> 支付成功 : 收到支付网关 Webhook 成功通知

state 支付成功 {
  [*] --> 分布式库存终扣减
  分布式库存终扣减 --> 财务对账记账
}

支付成功 --> 履约调度中 : 触发履约与出库引擎

state 履约调度中 {
  state "仓库打单与分拣" as WMS_Pick
  state "自动化质检与打包" as WMS_Pack
  state "包裹称重与贴标出库" as WMS_Ship

  [*] --> WMS_Pick
  WMS_Pick --> WMS_Pack : 分拣扫描完成
  WMS_Pack --> WMS_Ship : 质检合规
  WMS_Ship --> [*]
}

履约调度中 --> 运输干线配送中 : 物流揽收承运
运输干线配送中 --> 派送末端网点 : 到达目的城市中转中心
派送末端网点 --> 用户已签收 : 快递员派送成功并录入核销码

user_signed:
state 用户已签收 {
  [*] --> 7天无理由退换窗口
  7天无理由退换窗口 --> 订单最终完成 : 超过退换期自动收单
}

订单最终完成 --> [*] : 生命周期圆满归档

state 售后退款处理 {
  [*] --> 退货申请审核
  退货申请审核 --> 仓库验退入库
  仓库验退入库 --> 原路退款成功
}

运输干线配送中 --> 售后退款处理 : 拒收退回
用户已签收 --> 售后退款处理 : 申请售后
售后退款处理 --> 订单已取消 : 退款冲账完成

@enduml
`,
  },
  {
    id: 'file-telemetry-dashboard',
    name: 'service-telemetry-metrics.svg',
    path: '/assets/service-telemetry-metrics.svg',
    extension: 'svg',
    size: 4980,
    lastModified: Date.now() - 1000 * 60 * 90,
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1120" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="cyanPurpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <linearGradient id="emeraldGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="roseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#be123c" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- 主画布背景 -->
  <rect width="900" height="520" rx="16" fill="url(#bgGrad2)" stroke="#334155" stroke-width="1.5" />

  <!-- 顶部仪表盘标题栏 -->
  <g transform="translate(36, 36)">
    <circle cx="10" cy="10" r="7" fill="#10b981" filter="url(#softGlow)" />
    <text x="28" y="16" fill="#f8fafc" font-size="20" font-weight="bold" font-family="system-ui, sans-serif">OmniView 云端渲染引擎实时可观测性监控</text>
    <text x="28" y="38" fill="#94a3b8" font-size="12" font-family="system-ui, sans-serif">Cluster Health: 99.995% • Active Drivers: 6 Nodes • Total Throughput: 14,280 Req/min</text>
  </g>

  <!-- KPI 卡片 1: P99 响应耗时 -->
  <g transform="translate(36, 95)">
    <rect width="260" height="110" rx="10" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
    <rect width="260" height="4" rx="2" fill="#06b6d4" />
    <text x="18" y="32" fill="#94a3b8" font-size="12" font-family="system-ui">P99 渲染耗时 (Latency)</text>
    <text x="18" y="74" fill="#38bdf8" font-size="32" font-weight="bold" font-family="monospace">18.4 <tspan font-size="16" fill="#64748b">ms</tspan></text>
    <text x="18" y="96" fill="#10b981" font-size="11" font-family="system-ui">↓ 14% 优于同类渲染插件</text>
  </g>

  <!-- KPI 卡片 2: 内存占用 -->
  <g transform="translate(320, 95)">
    <rect width="260" height="110" rx="10" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
    <rect width="260" height="4" rx="2" fill="#10b981" />
    <text x="18" y="32" fill="#94a3b8" font-size="12" font-family="system-ui">Webview 内存水位 (RAM)</text>
    <text x="18" y="74" fill="#34d399" font-size="32" font-weight="bold" font-family="monospace">42.8 <tspan font-size="16" fill="#64748b">MB</tspan></text>
    <text x="18" y="96" fill="#10b981" font-size="11" font-family="system-ui">零泄漏 · 严格 WeakRef 资源回收</text>
  </g>

  <!-- KPI 卡片 3: 安全拦截率 -->
  <g transform="translate(604, 95)">
    <rect width="260" height="110" rx="10" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
    <rect width="260" height="4" rx="2" fill="#a855f7" />
    <text x="18" y="32" fill="#94a3b8" font-size="12" font-family="system-ui">安全沙箱净化 (DOMPurify)</text>
    <text x="18" y="74" fill="#c084fc" font-size="32" font-weight="bold" font-family="monospace">100 <tspan font-size="16" fill="#64748b">%</tspan></text>
    <text x="18" y="96" fill="#a855f7" font-size="11" font-family="system-ui">0 违规脚本穿透 · CSP 强固防御</text>
  </g>

  <!-- 下方大图表：实时 QPS 吞吐波动曲线 -->
  <g transform="translate(36, 230)">
    <rect width="544" height="250" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
    <text x="20" y="30" fill="#f1f5f9" font-size="14" font-weight="bold" font-family="system-ui">24 小时并发解析量趋势 (Req/sec)</text>
    
    <!-- 网格水平参考线 -->
    <line x1="20" y1="70" x2="524" y2="70" stroke="#1e293b" stroke-dasharray="4,4" />
    <line x1="20" y1="120" x2="524" y2="120" stroke="#1e293b" stroke-dasharray="4,4" />
    <line x1="20" y1="170" x2="524" y2="170" stroke="#1e293b" stroke-dasharray="4,4" />
    <line x1="20" y1="220" x2="524" y2="220" stroke="#334155" />

    <!-- 动态渐变波浪图 -->
    <path d="M 20 200 Q 80 140, 140 160 T 260 110 T 380 90 T 460 65 T 524 80 L 524 220 L 20 220 Z" fill="url(#cyanPurpleGrad)" opacity="0.15" />
    <path d="M 20 200 Q 80 140, 140 160 T 260 110 T 380 90 T 460 65 T 524 80" fill="none" stroke="url(#cyanPurpleGrad)" stroke-width="3" />

    <!-- 标记点 -->
    <circle cx="460" cy="65" r="5" fill="#a855f7" stroke="#ffffff" stroke-width="2" />
    <text x="440" y="50" fill="#c084fc" font-size="11" font-weight="bold" font-family="monospace">Peak: 840/s</text>
  </g>

  <!-- 右侧环形进度环：各驱动请求占比 -->
  <g transform="translate(604, 230)">
    <rect width="260" height="250" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
    <text x="20" y="30" fill="#f1f5f9" font-size="14" font-weight="bold" font-family="system-ui">驱动活跃度分布</text>

    <!-- 环形圆环 -->
    <circle cx="130" cy="115" r="55" fill="none" stroke="#1e293b" stroke-width="16" />
    <circle cx="130" cy="115" r="55" fill="none" stroke="#3b82f6" stroke-width="16" stroke-dasharray="140 345" stroke-dashoffset="0" />
    <circle cx="130" cy="115" r="55" fill="none" stroke="#10b981" stroke-width="16" stroke-dasharray="90 345" stroke-dashoffset="-145" />
    <circle cx="130" cy="115" r="55" fill="none" stroke="#a855f7" stroke-width="16" stroke-dasharray="65 345" stroke-dashoffset="-240" />

    <text x="130" y="112" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" font-family="monospace">100%</text>
    <text x="130" y="128" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="system-ui">Total 6</text>

    <!-- 图例 -->
    <g transform="translate(26, 195)">
      <circle cx="6" cy="6" r="4" fill="#3b82f6" />
      <text x="16" y="10" fill="#cbd5e1" font-size="11" font-family="system-ui">Markdown 45%</text>

      <circle cx="120" cy="6" r="4" fill="#10b981" />
      <text x="130" y="10" fill="#cbd5e1" font-size="11" font-family="system-ui">PlantUML 30%</text>

      <circle cx="6" cy="26" r="4" fill="#a855f7" />
      <text x="16" y="30" fill="#cbd5e1" font-size="11" font-family="system-ui">SVG / PDF 18%</text>

      <circle cx="120" cy="26" r="4" fill="#f59e0b" />
      <text x="130" y="30" fill="#cbd5e1" font-size="11" font-family="system-ui">CSV / Code 7%</text>
    </g>
  </g>
</svg>
`,
  },
  {
    id: 'file-slo-metrics',
    name: 'microservices-slo-telemetry.tsv',
    path: '/data/microservices-slo-telemetry.tsv',
    extension: 'tsv',
    size: 2150,
    lastModified: Date.now() - 1000 * 60 * 150,
    content: `Service Name\tTier\tCluster Region\tQPS\tP90 Latency (ms)\tP99 Latency (ms)\tError Rate\tCPU Usage %\tMemory (GB)\tSLO Health Status
gateway-proxy-edge\tTier-0 (Mission-Critical)\tap-east-1 (Hong Kong)\t18,500\t2.4\t8.6\t0.001%\t48%\t4.2\tHEALTHY (绿色)
auth-token-dispatcher\tTier-0 (Mission-Critical)\tap-east-1 (Hong Kong)\t12,400\t3.1\t11.2\t0.002%\t52%\t2.8\tHEALTHY (绿色)
omniview-marked-ast\tTier-1 (Core Business)\tap-northeast-1 (Tokyo)\t6,800\t12.8\t24.5\t0.012%\t68%\t6.4\tHEALTHY (绿色)
mermaid-vector-worker\tTier-1 (Core Business)\tap-northeast-1 (Tokyo)\t4,200\t28.4\t58.2\t0.025%\t78%\t12.6\tWARN (负载升高)
plantuml-svg-proxy\tTier-2 (Extended Engine)\tus-west-2 (Oregon)\t1,950\t45.0\t110.4\t0.048%\t64%\t8.1\tHEALTHY (绿色)
csv-table-indexer\tTier-2 (Extended Engine)\tap-east-1 (Hong Kong)\t840\t6.2\t14.8\t0.000%\t28%\t1.9\tHEALTHY (绿色)
pdf-vector-slicer\tTier-2 (Extended Engine)\teu-central-1 (Frankfurt)\t450\t88.0\t190.0\t0.010%\t82%\t14.2\tHEALTHY (绿色)
telemetry-prometheus-agg\tTier-3 (Observability)\tap-east-1 (Hong Kong)\t35,000\t1.8\t4.5\t0.000%\t38%\t18.5\tHEALTHY (绿色)
`,
  },
  {
    id: 'file-k8s-manifest',
    name: 'k8s-cluster-deployment.yaml',
    path: '/deploy/k8s-cluster-deployment.yaml',
    extension: 'yaml',
    size: 3450,
    lastModified: Date.now() - 1000 * 60 * 75,
    content: `# OmniView Production Kubernetes Deployment Manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omniview-renderer-core
  namespace: omniview-prod
  labels:
    app.kubernetes.io/name: omniview
    app.kubernetes.io/component: core-renderer
    app.kubernetes.io/version: "1.0.0"
spec:
  replicas: 4
  revisionHistoryLimit: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: omniview-core
  template:
    metadata:
      labels:
        app: omniview-core
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values: [omniview-core]
                topologyKey: "kubernetes.io/hostname"
      containers:
        - name: renderer
          image: omniview/renderer-engine:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
            - name: metrics
              containerPort: 9090
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2048Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 2
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            runAsNonRoot: true
            runAsUser: 10001
---
apiVersion: v1
kind: Service
metadata:
  name: omniview-core-svc
  namespace: omniview-prod
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app: omniview-core
`,
  },
  {
    id: 'file-state-engine',
    name: 'reactive-state-machine.ts',
    path: '/core/reactive-state-machine.ts',
    extension: 'ts',
    size: 2890,
    lastModified: Date.now() - 1000 * 60 * 35,
    content: `/**
 * OmniView 响应式状态机分发中枢
 */

export type StateListener<TState extends string, TContext> = (
  state: TState,
  context: TContext,
  event: string
) => void;

export interface TransitionRule<TState extends string, TEvent extends string, TContext> {
  from: TState;
  to: TState;
  event: TEvent;
  guard?: (context: TContext) => boolean;
  action?: (context: TContext) => Promise<void> | void;
}

export class FiniteStateMachine<TState extends string, TEvent extends string, TContext extends Record<string, unknown>> {
  private currentState: TState;
  private readonly listeners: Set<StateListener<TState, TContext>> = new Set();
  private readonly transitions: Map<string, TransitionRule<TState, TEvent, TContext>> = new Map();

  constructor(
    initialState: TState,
    private context: TContext
  ) {
    this.currentState = initialState;
  }

  public registerTransition(rule: TransitionRule<TState, TEvent, TContext>): this {
    const key = \`\${rule.from}->\${rule.event}\`;
    this.transitions.set(key, rule);
    return this;
  }

  public getState(): TState {
    return this.currentState;
  }

  public getContext(): Readonly<TContext> {
    return Object.freeze({ ...this.context });
  }

  public subscribe(listener: StateListener<TState, TContext>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async dispatch(event: TEvent, payload?: Partial<TContext>): Promise<boolean> {
    const key = \`\${this.currentState}->\${event}\`;
    const rule = this.transitions.get(key);

    if (!rule) {
      console.warn(\`[FSM] 无效状态转移: 当前状态 [\${this.currentState}] 无法响应事件 [\${event}]\`);
      return false;
    }

    if (payload) {
      this.context = { ...this.context, ...payload };
    }

    if (rule.guard && !rule.guard(this.context)) {
      console.warn(\`[FSM] 状态转移被守卫拦截: \${key}\`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = rule.to;

    if (rule.action) {
      await rule.action(this.context);
    }

    for (const listener of this.listeners) {
      listener(this.currentState, this.context, event);
    }

    return true;
  }
}
`,
  },
  {
    id: 'file-openapi-spec',
    name: 'rest-api-v1-spec.json',
    path: '/api/rest-api-v1-spec.json',
    extension: 'json',
    size: 2600,
    lastModified: Date.now() - 1000 * 60 * 10,
    content: `{
  "openapi": "3.1.0",
  "info": {
    "title": "OmniView Cloud Rendering Gateway API",
    "version": "1.0.0",
    "description": "High-throughput AST parsing, vector compilation, and multi-format document rendering endpoints.",
    "contact": {
      "name": "",
      "url": "https://github.com/fsyyzz/OmniView"
    },
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT"
    }
  },
  "servers": [
    {
      "url": "https://api.omniview.internal/v1",
      "description": "Production Internal Mesh Cluster"
    }
  ],
  "paths": {
    "/render/markdown": {
      "post": {
        "summary": "Compile Markdown with embedded diagrams",
        "operationId": "compileMarkdown",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "content": { "type": "string" },
                  "theme": { "type": "string", "enum": ["dark", "light", "sepia", "midnight", "cyber"] },
                  "sanitize": { "type": "boolean", "default": true }
                },
                "required": ["content"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Compiled HTML AST and Vector assets successfully generated",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "renderedHtml": { "type": "string" },
                    "diagramCount": { "type": "integer" },
                    "durationMs": { "type": "number" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`,
  },
  {
    id: 'file-cloud-infra-yaml',
    name: 'cloud-infrastructure.yaml',
    path: '/workspace/cloud-infrastructure.yaml',
    extension: 'yaml',
    size: 3280,
    lastModified: Date.now() - 120000,
    content: `# OmniView 结构化数据全景可视化示例 (YAML / Microservices)
# 支持：交互式结构树、全景思维导图投影、微服务网络拓扑、数组表格下钻、敏感脱敏与格式互转
version: "3.9"

metadata:
  cluster_name: "omniview-prod-us-east"
  environment: "production"
  region: "us-east-1"
  created_by: ""

# 1. 微服务拓扑与网络流向声明 (自动激活服务拓扑图 Topology)
services:
  web-gateway:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - auth-service
      - order-api
    networks:
      - frontend-net
      - backend-net

  auth-service:
    image: omniview/auth:v2.4
    ports:
      - "8081:8080"
    environment:
      JWT_SIGNING_KEY: "secret_jwt_hs256_token_omniview_2026"
      REFRESH_TOKEN_EXPIRE: "604800s"
      DB_PASSWORD: "auth_service_postgres_secure_pwd_9981"
    depends_on:
      - postgres-db
      - redis-cache
    networks:
      - backend-net

  order-api:
    image: omniview/order-service:v3.1.0
    ports:
      - "8082:8080"
    environment:
      STRIPE_SECRET_KEY: "stripe_sec_demo_omniview_mock_token_sample"
      PAYMENT_WEBHOOK_SECRET: "stripe_webhook_demo_signature_sample"
      DATABASE_URL: "postgresql://postgres:pg_super_secret_production_2026@postgres-db:5432/orders"
    depends_on:
      - postgres-db
      - redis-cache
    networks:
      - backend-net

  redis-cache:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    environment:
      REDIS_PASSWORD: "redis_production_auth_token_safe_pass"
    networks:
      - backend-net

  postgres-db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: "omniview_production"
      POSTGRES_USER: "cloud_admin"
      POSTGRES_PASSWORD: "pg_super_secret_production_2026"
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend-net

networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge

volumes:
  pgdata:
    driver: local

# 2. 节点集群度量同构对象数组 (自动激活数据表格下钻 Table & 图表转换)
cluster_nodes:
  - node_id: "node-master-01"
    role: "Control-Plane"
    cpu_cores: 16
    memory_gb: 64
    disk_ssd_gb: 1024
    network_gbps: 25.0
    status: "Healthy"
    zone: "us-east-1a"
  - node_id: "node-worker-02"
    role: "Worker-Compute"
    cpu_cores: 32
    memory_gb: 128
    disk_ssd_gb: 2048
    network_gbps: 40.0
    status: "Healthy"
    zone: "us-east-1b"
  - node_id: "node-worker-03"
    role: "Worker-Compute"
    cpu_cores: 32
    memory_gb: 128
    disk_ssd_gb: 2048
    network_gbps: 40.0
    status: "Healthy"
    zone: "us-east-1c"
  - node_id: "node-gpu-ai-04"
    role: "Inference-GPU"
    cpu_cores: 64
    memory_gb: 256
    disk_ssd_gb: 4096
    network_gbps: 100.0
    status: "Healthy"
    zone: "us-east-1a"
  - node_id: "node-storage-05"
    role: "Ceph-Storage"
    cpu_cores: 16
    memory_gb: 64
    disk_ssd_gb: 8192
    network_gbps: 25.0
    status: "Degraded"
    zone: "us-east-1b"
`,
  },
];

