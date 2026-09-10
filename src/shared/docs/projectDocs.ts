/**
 * OmniViewer 研发规范与工程技术设计中心数据源
 * 包含产品需求规范 (PRD)、核心技术架构规范、VS Code 扩展脚手架规范与安全审计白皮书
 * 全面集成 Mermaid 流程图/时序图/状态图、PlantUML 架构图与矢量 SVG 图元
 */
import { SoftwareDoc } from '../types';

export const PROJECT_DOCS: SoftwareDoc[] = [
  {
    id: 'prd',
    title: '1. 产品需求规格说明书 (PRD)',
    category: 'PRD',
    summary: '系统性阐明产品定位、竞品痛点分析、核心功能需求清单与严苛的非功能性性能指标。包含行业痛点全景图与驱动流水线。',
    tags: ['PRD', '产品规划', '功能矩阵', 'Mermaid图表', '指标规范'],
    content: `# OmniViewer 产品需求规格说明书 (PRD)

| 属性 | 详情 |
| :--- | :--- |
| **产品名称** | OmniViewer (VS Code 全能文件渲染与架构视图工作台) |
| **文档版本** | v1.0.0-Release |
| **研发阶段** | 核心引擎研发与开源工程化阶段 |
| **开源授权** | MIT License (100% 永久开源无限制) |
| **架构作者** |  |

---

## 一、项目背景与行业痛点分析

在 Visual Studio Code 生态中，开发者日常需要频繁查阅和交互各类非代码/架构类文件，如 Markdown 设计文档、Mermaid 流程图、PlantUML 系统拓扑、SVG 矢量设计稿、PDF 规格说明书及 CSV 调试数据。

### 行业现状与痛点对比全景图

\`\`\`mermaid
flowchart TB
    subgraph PainPoints ["⚠️ 传统插件生态痛点 (以 vscode-office 为例)"]
        direction TB
        A1["商业付费门槛 (Freemium)<br/>高级导出与特定功能弹窗锁"]
        A2["包体积臃肿 (20MB+)<br/>捆绑庞大过时 Office 全家桶"]
        A3["多标签内存飙升 (300MB+)<br/>低配设备或远程 SSH 严重卡顿"]
        A4["隐蔽遥测与数据隐私风险<br/>未经审计的外联通信与脚本执行"]
    end

    subgraph OmniViewer ["✨ OmniViewer 现代化架构破局方案"]
        direction TB
        B1["100% 永久免费开源<br/>MIT 授权，无任何赞助锁"]
        B2["微内核与极简打包<br/>VSIX 体积严格 ≤ 3.0 MB"]
        B3["按需动态懒加载 (Lazy Load)<br/>首屏冷启动小于 140ms，内存小于 45MB"]
        B4["严格本地安全隔离沙箱<br/>CSP 强白名单与 DOMPurify 零外联"]
    end

    PainPoints ==>|全面替代与体验重塑| OmniViewer
\`\`\`

---

## 二、目标用户与典型场景画像

| 角色画像 | 典型痛点 | OmniViewer 赋能场景 |
| :--- | :--- | :--- |
| **系统研发与核心工程师** | Markdown 内部大量引用 Mermaid 与 PlantUML 时序图，需频繁借助外部工具或私有服务器渲染。 | 一键即时解析，Markdown 内嵌与独立 \`.puml\` 均可原生矢量渲染与无损导出。 |
| **全栈开发者** | 查看项目中的 SVG 图标时无法缩放与查看源码，查看 CSV 只能看纯逗号文本。 | 原生提供高精度平移缩放、网格对齐、DOM 树节点检查与高亮虚拟表格。 |
| **开源作者 / 独立开发者** | 反感各种商业付费锁，需要轻巧纯粹、秒开、低内存占用的单文件渲染器。 | 零会员门槛、零弹窗打扰、首屏冷启动仅需 < 140ms。 |

---

## 三、五大核心驱动与渲染流水线架构

OmniViewer 采用微内核设计，文件进入系统后经由扩展名路由分发至专属 Driver 沙箱进行解析渲染：

\`\`\`mermaid
flowchart LR
    UserFile["📄 用户打开目标文件"] --> Detector{"扩展名路由匹配"}
    Detector -->|".md / .markdown"| DrvMD["📝 Markdown 驱动<br/>(GFM + Mermaid + PlantUML)"]
    Detector -->|".puml / .plantuml"| DrvPUML["🌐 PlantUML 驱动<br/>(双栏编写 + 毫秒级预览)"]
    Detector -->|".svg"| DrvSVG["🎨 SVG 矢量驱动<br/>(平移缩放 + DOM 树分析)"]
    Detector -->|".pdf"| DrvPDF["📖 PDF 专业驱动<br/>(多页连续 + 视口自适应)"]
    Detector -->|".csv / .tsv"| DrvCSV["📊 表格智能网格<br/>(虚拟滚动 + 排序检索)"]

    DrvMD --> WebviewStage["🖥️ VS Code Webview 隔离沙箱"]
    DrvPUML --> WebviewStage
    DrvSVG --> WebviewStage
    DrvPDF --> WebviewStage
    DrvCSV --> WebviewStage

    WebviewStage --> Actions["⚡ 导出 SVG / 无损打印 / 代码联动"]
\`\`\`

---

## 四、产品功能性需求规格 (Functional Requirements)

### FR-01: Markdown 核心扩展渲染器 (Markdown Driver)
* **FR-01.1 (GFM 标准)**：完全支持 GitHub Flavored Markdown，包括代码高亮、表格、任务清单复选框、删除线、引用块等。
* **FR-01.2 (Mermaid 异步图表)**：自动捕获 \`\`\`mermaid 代码块，动态调起 Mermaid 10+ 渲染引擎，支持 flowchart、sequenceDiagram、classDiagram、gantt 等，图表支持点击放大与复制 SVG。
* **FR-01.3 (PlantUML 动态编译)**：自动捕获 \`\`\`plantuml 代码块，通过轻量级 Deflate 编码转换为矢量 SVG 并渲染，语法错误时提供优雅告警卡片。
* **FR-01.4 (矢量 SVG 混排)**：原生支持 Markdown 中直接内联 \`<svg>\` 标签以及外链 SVG 图像。

### FR-02: SVG 矢量设计与交互式工作台 (SVG Studio Driver)
* **FR-02.1 (多级交互视口)**：支持鼠标滚轮或手势以 10% ~ 500% 平滑平移缩放，提供“自适应画布 (Fit)”与“1:1 还原”快捷指令。
* **FR-02.2 (背景模式切换)**：支持暗色棋盘格 (Dark Checkerboard)、亮色棋盘格 (Light Checkerboard) 与纯色底板切换，适应透明矢量图检查。
* **FR-02.3 (元数据检查器)**：提取并展示 viewBox 尺寸、DOM 节点总数、图元图层数量与文件尺寸。
* **FR-02.4 (双向代码对比与编辑)**：支持在图形视图、代码视图与双栏分屏视图之间秒级切换，支持可拖拽分屏中线与比例持久化。
* **FR-02.5 (图元多级微调与层级)**：支持在画布中点选图元，实时微调其坐标、尺寸、填充色、描边宽度、圆角与透明度，支持图层置顶/置底与反向定位源码行号。
* **FR-02.6 (工程级导出与转换)**：集成 SVGO 净化去冗余压缩、一键导出为 React JSX 组件、Vue 3 模板组件以及 Data URI 嵌入式代码。

### FR-03: 现代化多页 PDF 规格阅读器 (PDF Driver)
* **FR-03.1 (多页连续流式与单/双页翻书)**：提供连续流式瀑布流 (Continuous Flow)、单页居中翻页与双页图书并排开本三重视图；支持视口滚动监听与当前阅读页自动感知 (Scroll Spy)。
* **FR-03.2 (自适应排版与性能优化)**：支持“适合宽度 (Fit Width)”与“适合单页 (Fit Page)”；引入基于 IntersectionObserver 的视口懒渲染机制，保障超长文档流畅滚动。
* **FR-03.3 (全文检索与跨页高亮定位)**：集成高精度关键词检索、匹配项计数与跨页平滑跳转定位。
* **FR-03.4 (划词高亮批注与导出)**：支持 TextLayer 文本划词复制、多色高亮标注、侧边栏批注卡片导航及一键导出为 Markdown 读书笔记。
* **FR-03.5 (安全沙箱与取消机制)**：杜绝外部跨域请求，采用隔离的只读 Canvas/SVG 渲染流，具备防死循环渲染锁。

### FR-04: PlantUML 独立架构建模器 (PlantUML Driver)
* **FR-04.1 (双栏分屏设计)**：支持在左侧编写 UML 语法，右侧毫秒级防抖响应渲染。
* **FR-04.2 (模版快速插入)**：预置架构微服务拓扑、时序图、组件图与状态机标准模板。
* **FR-04.3 (无损导出)**：支持一键导出为独立 \`.svg\` 矢量图或 \`.png\` 高清位图。

### FR-05: 智能表格数据网格 (CSV Driver)
* **FR-05.1 (高亮网格化展示)**：解析逗号与制表符分隔文本，自适应列宽。
* **FR-05.2 (排序与全局检索)**：支持任意列的数字/字典升降序排列，输入关键词即时过滤。

---

## 五、零遥测与安全合规保障

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 140" width="100%" height="140" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;padding:12px;">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>
  <g transform="translate(20, 20)">
    <circle cx="45" cy="45" r="40" fill="url(#shieldGrad)" opacity="0.15" />
    <path d="M45 15 L70 25 V50 C70 66 59 78 45 82 C31 78 20 66 20 50 V25 Z" fill="url(#shieldGrad)" stroke="#60a5fa" stroke-width="2" />
    <path d="M36 48 L42 54 L54 38" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </g>
  <text x="120" y="45" fill="#f8fafc" font-size="16" font-weight="bold" font-family="sans-serif">OmniViewer 纯粹开源与 100% 隐私安全防护认证</text>
  <text x="120" y="72" fill="#94a3b8" font-size="13" font-family="sans-serif">✓ 零网络遥测 (No Telemetry)   ✓ 本地离线运行 (100% Offline)   ✓ MIT 永久免费 (No Paywall)</text>
  <text x="120" y="98" fill="#64748b" font-size="12" font-family="sans-serif">严格贯彻 VS Code Webview CSP 白名单标准与 DOMPurify 严密消毒净化。</text>
</svg>
\`\`\`

---

## 六、严苛的非功能性指标 (Non-Functional Requirements)

1. **包体积限制**：插件打包后 VSIX 体积必须严格控制在 **≤ 3.0 MB**。
2. **冷启动性能**：打开任意支持的文件，Webview 首屏可见内容渲染耗时 **< 140 ms**。
3. **内存占用控制**：打开 5 个不同类型标签页时，Webview 进程总体内存占用增量必须 **< 45 MB**。
4. **安全与隔离**：严格贯彻 VS Code Webview CSP（Content Security Policy），严禁任何未经清洗的危险脚本执行（DOMPurify 100% 覆盖）。
5. **商业承诺**：**永久 100% 免费**，绝不植入任何赞助弹窗、会员功能锁与第三方推广。
`,
  },
  {
    id: 'architecture',
    title: '2. 核心技术架构设计规范 (Technical Architecture Spec)',
    category: 'Architecture',
    summary: '深入解析插件分层架构、Driver 驱动抽象模型、IPC 双向通讯协议与严格的安全沙箱机制。包含系统架构流程图、IPC时序图与状态机。',
    tags: ['技术架构', 'Driver设计模式', 'IPC协议', 'Mermaid时序图', 'CSP安全'],
    content: `# OmniViewer 核心技术架构设计规范

| 属性 | 详情 |
| :--- | :--- |
| **架构模式** | Micro-Kernel 微内核 + Driver 驱动总线架构 |
| **宿主环境** | VS Code Extension Host (Node.js 20+) |
| **渲染环境** | Chromium Webview Sandbox (CSP 安全隔离) |
| **通信机制** | 双向类型化 IPC RPC (postMessage) |
| **设计作者** |  |

---

## 一、分层架构概览 (Layered Architecture)

OmniViewer 严格遵循 VS Code 官方的安全沙箱与微内核设计理念。整体分为 **Extension Host (Node.js 宿主环境)** 与 **Webview Sandbox (Chromium 隔离渲染层)**：

\`\`\`mermaid
flowchart TB
    subgraph HostLayer ["Layer 1: VS Code Extension Host (Node.js 宿主)"]
        direction TB
        PackageJson["package.json 贡献声明<br/>customEditors 与 commands"]
        FSWatcher["FileSystemWatcher<br/>文件外部变更侦听与脏标记追踪"]
        ConfigMgr["ConfigurationManager<br/>主题与字体及缩放首选项"]

        Provider["OmniViewerEditorProvider (调度中枢)<br/>• 扩展名路由匹配<br/>• 内存状态与文档版本追踪<br/>• asWebviewUri 安全路径映射"]

        PackageJson --> Provider
        FSWatcher --> Provider
        ConfigMgr --> Provider
    end

    HostLayer <===>|"双向类型化 IPC 通讯通道 (postMessage RPC)"| WebviewLayer

    subgraph WebviewLayer ["Layer 2: Webview Container (Chromium 沙箱)"]
        direction TB
        IPCBridge["IPC Bridge 与消息分发路由器<br/>DOCUMENT_UPDATE / READY / EXPORT"]
        CSPGuard["CSP 安全白名单防护层 与 DOMPurify 消毒净化"]

        subgraph DriverBus ["Driver Micro-Kernel (驱动微内核总线)"]
            DrvMD2["Markdown Driver<br/>Marked GFM 引擎"]
            DrvMM2["Mindmap Driver<br/>Markmap 深度引擎 (.markmap, .mm, .mindmap, .km)"]
            DrvSVG2["SVG Driver<br/>平移缩放与 AST 分析器"]
            DrvPDF2["PDF Driver<br/>Mozilla PDF.js 核心"]
            DrvPUML2["PlantUML Driver<br/>Deflate 实时编译与私有节点"]
            DrvCSV2["CSV Grid Driver<br/>高容量虚拟化表格"]
        end

        subgraph SubEngines ["动态按需异步子引擎 (Lazy-Loaded)"]
            MermaidEngine["Mermaid 10+ 矢量图表"]
            PrismEngine["Prism.js 语法着色器"]
            KaTeXEngine["KaTeX 数学公式渲染"]
            GraphvizEngine["Graphviz DOT 拓扑排版"]
        end

        IPCBridge --> CSPGuard
        CSPGuard --> DriverBus
        DrvMD2 -.-> MermaidEngine
        DrvMD2 -.-> PrismEngine
        DrvMD2 -.-> KaTeXEngine
        DrvMD2 -.-> GraphvizEngine
    end
\`\`\`

---

## 二、Driver 驱动抽象模型与生命周期状态机

每一个文件渲染器被抽象为一个独立的 **ViewerDriver**，遵循统一的生命周期与接口约束：

\`\`\`typescript
export interface IViewerDriver {
  /** 唯一标识符 */
  readonly id: string;
  /** 支持的文件扩展名列表 */
  readonly extensions: readonly string[];
  /** 驱动元数据与版本 */
  readonly metadata: DriverMetadata;
  
  /** 驱动初始化（在匹配到对应扩展名时调用） */
  initialize(context: DriverContext): Promise<void>;
  
  /** 执行渲染管线 */
  render(content: string | ArrayBuffer, options?: RenderOptions): Promise<RenderResult>;
  
  /** 资源回收与事件解绑（标签页关闭或切换时触发） */
  dispose(): void;
  
  /** 可选：将当前渲染内容导出为独立资产 */
  exportAsset?(format: 'svg' | 'png' | 'html' | 'pdf'): Promise<Uint8Array | string>;
}
\`\`\`

### Driver 状态机转换图

\`\`\`mermaid
stateDiagram-v2
    [*] --> REGISTERED: 插件加载，驱动注册到字典
    REGISTERED --> IDLE: 处于休眠待命状态 (零内存占用)
    IDLE --> INITIALIZING: 检测到匹配文件扩展名触发激活
    INITIALIZING --> ACTIVE: DOM 挂载就绪，首屏渲染完成
    ACTIVE --> ACTIVE: 文档内容更新 (增量 Diff 局部重绘)
    ACTIVE --> CACHED: 切换至后台标签页 (retainContext 保留状态)
    CACHED --> ACTIVE: 用户切回该标签页 (秒级恢复)
    ACTIVE --> DISPOSED: 标签页关闭 (触发 unmount，彻底清理内存与 Worker)
    DISPOSED --> [*]
\`\`\`

### 驱动设计模式的三大优势：
1. **彻底解耦**：新增一种格式（例如 3D STL 或 XMind）只需编写对应 Driver 并注册到字典，完全不需要改动宿主分发器。
2. **按需懒加载 (Lazy Import)**：对于 Markdown 驱动，如果文档内没有使用 \`\`\`mermaid，绝不加载任何 Mermaid.js 代码，节约内存。
3. **多实例隔离**：每个标签页由独立的 Driver 实例维护其视口缩放与滚动位置，互不污染。

---

## 三、IPC 双向通讯协议规范 (Typed Message Protocol)

Extension Host 与 Webview 之间通过 VS Code 官方的 \`postMessage\` 建立严格类型化的 RPC 通信通道：

\`\`\`mermaid
sequenceDiagram
    autonumber
    participant Host as Extension Host (Node.js)
    participant Webview as Webview Sandbox (Chromium)
    participant Driver as Target Viewer Driver

    Host->>Webview: 1. 创建 Webview 容器，注入 HTML 骨架与安全 Nonce
    Webview->>Webview: 2. DOM 挂载与 IPC 事件监听器初始化
    Webview-->>Host: 3. 发送 { type: 'WEBVIEW_READY' } 握手信号
    Host->>Host: 4. 读取当前文档缓冲区，提取文件扩展名与元数据
    Host-->>Webview: 5. 发送 { type: 'DOCUMENT_UPDATE', content, ext, readOnly }
    Webview->>Driver: 6. 路由并分发至对应驱动实例 (如 Markdown Driver)
    Driver->>Driver: 7. 异步 AST 解析、Mermaid/SVG 编译与 DOMPurify 净化
    Driver-->>Webview: 8. 完成 DOM 挂载，平滑同步视口与滚动偏移行
    Note over Webview,Driver: 用户在界面中操作 (例如导出矢量图或修改内容)
    Webview-->>Host: 9. 发送 { type: 'EXPORT_FILE', format: 'svg', data: '...' }
    Host->>Host: 10. 唤起 VS Code 系统原生保存文件对话框，流式落盘
    Host-->>Webview: 11. 通知导出成功，展示成功 Toast
\`\`\`

### 1. 宿主端下发指令 (Host -> Webview)

| 消息 Action | 载荷结构 | 业务说明 |
| :--- | :--- | :--- |
| \`DOCUMENT_OPEN\` | \`{ uri: string, content: string, ext: string, readOnly: boolean }\` | 打开新文件并启动对应 Driver 渲染 |
| \`DOCUMENT_UPDATE\` | \`{ content: string, version: number }\` | 文件被外部或编辑器修改，触发增量重绘 |
| \`COMMAND_ZOOM\` | \`{ direction: 'in' \\| 'out' \\| 'reset' \\| 'fit' }\` | 工具栏缩放指令转发至当前活动驱动 |
| \`THEME_CHANGED\` | \`{ theme: 'dark' \\| 'light' \\| 'high-contrast' }\` | VS Code 主题变更，驱动重新应用色板 |

### 2. 渲染端上报事件 (Webview -> Host)

| 消息 Action | 载荷结构 | 业务说明 |
| :--- | :--- | :--- |
| \`READY\` | \`{ webviewId: string, supportedDrivers: string[] }\` | Webview 沙箱 DOM 准备就绪，请求加载数据 |
| \`DOCUMENT_DIRTY\` | \`{ content: string }\` | 用户在交互视图中修改了内容，通知 VS Code 标脏 |
| \`EXPORT_FILE\` | \`{ format: string, data: string, filename: string }\` | 唤起 VS Code 系统原生文件保存对话框 |
| \`ERROR_NOTIFY\` | \`{ driverId: string, error: string, line?: number }\` | 语法解析失败，向宿主状态栏报告警告 |

---

## 四、驱动总线与模块拓扑图 (SVG Vector Architecture)

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 180" width="100%" height="180" style="background:#090d16;border-radius:12px;border:1px solid #1e293b;padding:12px;">
  <defs>
    <linearGradient id="busGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>
  
  <!-- Bus Spine -->
  <rect x="50" y="85" width="620" height="10" rx="5" fill="url(#busGrad)" opacity="0.8" />
  <text x="360" y="112" fill="#94a3b8" font-size="11" font-family="monospace" text-anchor="middle">OmniViewer Driver Micro-Kernel Event Bus (统一驱动微内核事件总线)</text>

  <!-- Driver Nodes -->
  <g transform="translate(60, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5" />
    <text x="45" y="28" fill="#60a5fa" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">Markdown</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">GFM+Mermaid</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#3b82f6" stroke-width="2" />
  </g>

  <g transform="translate(180, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#8b5cf6" stroke-width="1.5" />
    <text x="45" y="28" fill="#a78bfa" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">PlantUML</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Deflate+SVG</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#8b5cf6" stroke-width="2" />
  </g>

  <g transform="translate(300, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
    <text x="45" y="28" fill="#22d3ee" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">SVG Vector</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Pan-Zoom+AST</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#06b6d4" stroke-width="2" />
  </g>

  <g transform="translate(420, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
    <text x="45" y="28" fill="#fbbf24" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">PDF Reader</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Mozilla PDF.js</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#f59e0b" stroke-width="2" />
  </g>

  <g transform="translate(540, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
    <text x="45" y="28" fill="#34d399" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">CSV Grid</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Virtual Table</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#10b981" stroke-width="2" />
  </g>

  <!-- Output Stage -->
  <g transform="translate(220, 130)">
    <rect width="280" height="34" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1" />
    <text x="140" y="22" fill="#cbd5e1" font-size="11" font-family="sans-serif" text-anchor="middle">统一 Chromium Webview 沙箱安全视口</text>
  </g>
</svg>
\`\`\`
`,
  },
  {
    id: 'scaffold',
    title: '3. VS Code 插件源码脚手架 (Extension Scaffold)',
    category: 'Scaffold',
    summary: '提供可直接打包构建为真实 VS Code .vsix 插件的工程级代码模板与双目标编译流水线规范。',
    tags: ['源码脚手架', 'package.json', 'extension.ts', 'Mermaid构建流水线', '双目标编译'],
    content: `# VS Code 扩展工程脚手架 (OmniViewer Production Scaffold)

本部分提供了可以直接用于构建官方 VS Code 扩展插件的工程级源码架构与编译构建流水线规范。

---

## 一、双目标构建与发布流水线架构

\`\`\`mermaid
flowchart LR
    subgraph Dev ["1. 源码编写开发"]
        TS["TypeScript 宿主源码<br/>(src/extension.ts)"]
        WebviewTS["Webview 前端客户端<br/>(webview/main.ts)"]
    end

    subgraph Build ["2. 双目标构建 (Esbuild)"]
        Esbuild["Esbuild 极速双目标编译<br/>• Node.js CommonJS (dist/extension.js)<br/>• Browser IIFE (dist/webview.js)"]
        Assets["静态资源安全映射与 CSP Nonce 校验"]
    end

    subgraph Package ["3. VSIX 打包与分发"]
        VSCE["npx @vscode/vsce package"]
        VSIX["📦 omnivewer-1.0.0.vsix<br/>(体积严格 ≤ 3.0MB)"]
        Marketplace["VS Code 插件市场在线发布"]
        LocalInstall["code --install-extension 本地离线安装"]
    end

    Dev --> Esbuild
    Esbuild --> Assets
    Assets --> VSCE
    VSCE --> VSIX
    VSIX --> Marketplace
    VSIX --> LocalInstall
\`\`\`

---

## 二、核心配置文件清单

### 1. \`package.json\` (完整插件声明清单)

\`\`\`json
{
  "name": "omnivewer",
  "displayName": "OmniViewer - Universal Document & Diagram Viewer",
  "description": "Clean, fast, 100% free multi-format document and diagram viewer for VS Code.",
  "version": "1.0.0",
  "publisher": "omnivewer",
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
        "displayName": "OmniViewer 渲染器",
        "selector": [
          { "filenamePattern": "*.md" },
          { "filenamePattern": "*.markdown" },
          { "filenamePattern": "*.puml" },
          { "filenamePattern": "*.plantuml" },
          { "filenamePattern": "*.svg" },
          { "filenamePattern": "*.pdf" },
          { "filenamePattern": "*.csv" }
        ],
        "priority": "option"
      }
    ],
    "commands": [
      {
        "command": "omnivewer.openSidePreview",
        "title": "OmniViewer: 在侧边栏实时分屏预览",
        "icon": "$(layout-sidebar-right)"
      },
      {
        "command": "omnivewer.exportSvg",
        "title": "OmniViewer: 导出当前图形为矢量图"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "esbuild ./src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node --sourcemap",
    "watch": "npm run build -- --watch",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "^2.22.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.3.0"
  }
}
\`\`\`

---

## 三、宿主生命周期调度实现 (\`src/extension.ts\`)

\`\`\`typescript
import * as vscode from 'vscode';
import { OmniViewerEditorProvider } from './OmniViewerEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('[OmniViewer] Extension activating...');

  // 1. 注册 CustomEditorProvider
  const provider = new OmniViewerEditorProvider(context);
  const registration = vscode.window.registerCustomEditorProvider(
    'omnivewer.editor',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true, // 切换标签页时保留 Webview 状态，防止重新加载
      },
      supportsMultipleEditorsPerDocument: true,
    }
  );
  context.subscriptions.push(registration);

  // 2. 注册分屏预览辅助命令
  const previewCommand = vscode.commands.registerCommand(
    'omnivewer.openSidePreview',
    async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showWarningMessage('请先打开或选择一个支持的文件。');
        return;
      }
      await vscode.commands.executeCommand(
        'vscode.openWith',
        targetUri,
        'omnivewer.editor',
        vscode.ViewColumn.Beside
      );
    }
  );
  context.subscriptions.push(previewCommand);
}

export function deactivate() {
  console.log('[OmniViewer] Extension deactivated.');
}
\`\`\`

---

## 四、本地极速打包与调试指南

\`\`\`bash
# 1. 安装工程依赖
npm install

# 2. 编译打包生成独立 .vsix 安装文件
npm run package

# 3. 在 VS Code 中本地一键加载体验
code --install-extension omnivewer-1.0.0.vsix
\`\`\`
`,
  },
  {
    id: 'security',
    title: '4. 安全合规与发布检查清单 (Security Checklist)',
    category: 'Security',
    summary: '发布到 Visual Studio Code Marketplace 之前的四重纵深安全防御机制、CSP 白名单策略与自动化 CI 验证。',
    tags: ['安全防御', 'Mermaid防御图', 'CSP白名单', 'DOMPurify', 'Marketplace合规'],
    content: `# VS Code 扩展插件安全与合规审计规范

| 属性 | 详情 |
| :--- | :--- |
| **安全准则** | 零信任 (Zero Trust) 隔离原则 |
| **沙箱标准** | VS Code Webview Content Security Policy (CSP) Level 3 |
| **消毒工具** | DOMPurify 3.0+ 全面清除危险节点与属性 |
| **遥测政策** | 100% 零遥测无回传 (Zero Telemetry) |
| **作者署名** |  |

---

## 一、四重纵深安全防御体系 (Defense-in-Depth Model)

OmniViewer 在架构层设立四重物理屏障，即使恶意用户构造了包含攻击载荷的 Markdown 或 SVG 文件，也绝无可能在开发者主机上提权执行：

\`\`\`mermaid
flowchart TD
    UntrustedFile["⚠️ 外部不受信任的文件输入 (Markdown / SVG / HTML / 脚本)"] --> L1

    subgraph L1 ["第一重防御：CSP 强安全白名单"]
        CSPRule["default-src 'none';<br/>script-src 'nonce-...';<br/>禁绝任何未受控外部脚本注入与内联事件挂载"]
    end

    L1 --> L2

    subgraph L2 ["第二重防御：DOMPurify 深度消毒"]
        PurifyRule["清除所有 &lt;script&gt; 节点、javascript: 伪协议、<br/>恶意 onerror / onload 注入点"]
    end

    L2 --> L3

    subgraph L3 ["第三重防御：Chromium Webview 沙箱隔离"]
        SandboxRule["独立渲染进程，杜绝直接访问 Node.js 宿主系统 API，<br/>仅允许安全 asWebviewUri 本地资源协议映射"]
    end

    L3 --> L4

    subgraph L4 ["第四重防御：零外部网络外联与零遥测"]
        NetworkRule["100% 本地离线运行，严禁任何隐蔽的数据回传与隐私追踪"]
    end

    L4 --> SafeRender["🛡️ 安全可信的最终矢量与 DOM 渲染视口"]
\`\`\`

---

## 二、发布前安全检查清单 (Security Audit Checklist)

- [x] **CSP 策略合规**：Webview 中禁绝 \`script-src *\`，严格配置 Nonce 或安全 Hash；
- [x] **XSS 防护**：对任何 Markdown 用户输入及第三方 HTML 标签，强制走 DOMPurify 消毒过滤；
- [x] **零外部未知代码执行**：不使用 \`eval()\`、\`new Function()\` 动态解析未经检验的代码；
- [x] **零隐式数据上报**：严格遵循隐私保护原则，不默认开启任何远程文件内容传输遥测；
- [x] **本地文件越界访问隔离**：Webview \`localResourceRoots\` 严格限制在插件自身目录与当前工作区，禁止读取敏感系统配置。

---

## 三、安全沙箱认证勋章

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" width="100%" height="120" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;padding:12px;">
  <g transform="translate(15, 10)">
    <rect width="80" height="80" rx="40" fill="#0284c7" fill-opacity="0.2" />
    <path d="M40 20 L65 32 V52 C65 67 54 77 40 81 C26 77 15 67 15 52 V32 Z" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
    <path d="M31 50 L38 57 L50 43" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="115" y="42" fill="#f1f5f9" font-size="15" font-weight="bold" font-family="sans-serif">OmniViewer 工业级安全隔离与沙箱认证</text>
  <text x="115" y="68" fill="#38bdf8" font-size="12" font-family="monospace">PASSED: VS Code Webview CSP Level 3 &amp; DOMPurify Strict Sanitization</text>
  <text x="115" y="90" fill="#94a3b8" font-size="11" font-family="sans-serif">通过静态分析审计与动态 XSS 注入对抗渗透测试，安全评级：A+</text>
</svg>
\`\`\`
`,
  },
  {
    id: 'persistence',
    title: '5. 全局配置与工作区持久化规范 (Persistence Spec)',
    category: 'Architecture',
    summary: '阐述 OmniView v2 统一持久化架构、旧版本平滑向前迁移机制、数值安全截断钳位、容量度量与备份导入导出协议。',
    tags: ['持久化', 'LocalStorage', '数据迁移', '容错钳位', 'Mermaid流程图'],
    content: `# OmniView 全局配置与工作区持久化规范

| 属性 | 详情 |
| :--- | :--- |
| **存储版本** | v2 增强型存储规范 (\`omniview:workbench:settings:v2\`) |
| **文件管理** | 工作区多文件隔离持久化 (\`omniview:workbench:files:v1\`) |
| **容错机制** | 数值上下限物理钳位 + 旧版数据无缝自愈回写 |
| **设计作者** |  |

---

## 一、持久化中枢架构全景

\`\`\`mermaid
flowchart TD
    subgraph StorageEngine ["💾 浏览器 LocalStorage 持久化引擎"]
        V1["旧版键名 (v1)<br/>omniview_workbench_settings"]
        V2["当前新版键名 (v2)<br/>omniview:workbench:settings:v2"]
        Files["工作区文件存储<br/>omniview:workbench:files:v1"]
    end

    subgraph Middleware ["🛡️ 防护与校验中间件 (settingsStorage.ts)"]
        Migrator["平滑数据迁移器<br/>(自动读取 v1 并回写落盘至 v2)"]
        Clamper["数学边界钳位器<br/>• zoom: 0.5 ~ 2.5 (两位浮点)<br/>• fontSize: 12 ~ 22px<br/>• splitRatio: 15 ~ 85%"]
        Capacity["存储容量与键分析器<br/>(getStorageStats: 实时统计精确到 0.1KB)"]
    end

    subgraph Consumers ["🖥️ 核心消费与响应驱动组件"]
        AppShell["App.tsx (工作台主入口 / 视图路由 / 主题 / 密度)"]
        MindmapView["MindmapViewer.tsx (思维导图分屏比例 / 视图模式)"]
        PUMLView["PlantUmlViewer.tsx (私有服务地址 / 分屏比例)"]
        MarkdownView["ViewerRenderer.tsx (双向分屏预览/导图模式)"]
        SettingsModal["WorkbenchSettingsModal.tsx (设置与备份导入导出面板)"]
    end

    V1 -.->|初次加载迁移| Migrator
    Migrator --> V2
    V2 <===> Clamper
    Clamper <===> Consumers
    Files <===> AppShell
\`\`\`

---

## 二、配置项全量定义与类型契约

\`\`\`typescript
export interface WorkbenchSettings {
  // 外观与版式
  theme: ThemeId;             // 9 大精校主题 (dark, light, sepia, midnight, cyber, nord, dracula, forest, solarized)
  density: DensityMode;       // compact | standard | comfortable
  locale: 'zh-CN' | 'en-US';  // 国际化多语言
  contentWidth: 'narrow' | 'standard' | 'wide' | 'full';
  fontSize: number;           // 12px ~ 22px 钳位
  zoom: number;               // 0.5x ~ 2.5x 两位精度钳位
  viewMode: ViewMode;         // preview | split | source | mindmap

  // 工作区状态
  currentView: WorkbenchView; // editor | docs | drivers | scaffold
  sidebarOpen: boolean;       // 左侧导航开关
  explorerOpen: boolean;      // 资源树开关
  activeFileId?: string;      // 当前正在编辑的文件 ID
  openTabIds?: string[];      // 已打开标签页 ID 序列

  // 驱动级专属状态
  splitRatio: number;         // 通用分屏比例 (15% ~ 85%)
  splitRightMode: 'preview' | 'mindmap';
  mindmapSplitRatio: number;  // 思维导图专属分屏比 (15% ~ 85%)
  mindmapViewMode: 'split' | 'mindmap' | 'editor';
  plantUmlSplitRatio: number; // PlantUML 分屏比例 (15% ~ 85%)
  plantUmlServerUrl: string;  // 自定义 PlantUML 渲染服务地址
  wordWrap: boolean;          // 自动折行
  showLineNumbers: boolean;   // 代码行号
}
\`\`\`

---

## 三、备份导入导出与出厂重置协议

1. **导出备份**：通过 \`exportSettingsJson()\` 导出标准格式化 JSON 文件，方便跨设备迁移；
2. **导入与增量合并**：通过 \`importSettingsJson(json)\` 进行合法性校验，只覆盖有效字段，自动忽略非法属性；
3. **出厂恢复**：支持一键清空并重置为 \`DEFAULT_SETTINGS\`，清除残存脏数据。
`,
  },
];
