import { SoftwareDoc } from '../../types';

export const ARCHITECTURE_DOC: SoftwareDoc = {
  id: 'architecture',
  title: '2. 核心技术架构设计规范 (Technical Architecture Spec)',
  category: 'Architecture',
  summary: '深入解析 OmniView 微内核分层架构、Driver 驱动抽象模型、IPC 双向通讯协议与严格的安全沙箱机制。包含系统架构流程图、IPC时序图与状态机。',
  tags: ['技术架构', 'Driver设计模式', 'IPC协议', 'Mermaid时序图', 'CSP安全', '微内核'],
  content: `# OmniView 核心技术架构设计规范

| 属性 | 详情 |
| :--- | :--- |
| **架构模式** | Micro-Kernel 微内核 + Driver 驱动总线架构 |
| **宿主环境** | VS Code Extension Host (Node.js 20+) |
| **渲染环境** | Chromium Webview Sandbox (CSP 安全隔离) |
| **通信机制** | 双向类型化 IPC RPC (postMessage) |
| **设计作者** |  |

---

## 一、分层架构概览 (Layered Architecture)

OmniView 严格遵循 VS Code 官方的安全沙箱与微内核设计理念。整体分为 **Extension Host (Node.js 宿主环境)** 与 **Webview Sandbox (Chromium 隔离渲染层)**：

\`\`\`mermaid
flowchart TB
    subgraph HostLayer ["Layer 1: VS Code Extension Host (Node.js 宿主)"]
        direction TB
        PackageJson["package.json 贡献声明<br/>customEditors, commands, keybindings, menus"]
        FSWatcher["FileSystemWatcher<br/>文件外部变更侦听与脏标记追踪"]
        ConfigMgr["ConfigurationManager<br/>19 项 VS Code 宿主设置双向同步"]

        Provider["OmniViewEditorProvider (调度中枢)<br/>• 扩展名路由匹配<br/>• 内存状态与文档版本追踪<br/>• asWebviewUri 安全路径映射"]

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
            DrvMD2["Markdown Driver<br/>Marked GFM + OKF 引擎"]
            DrvMM2["Mindmap Driver<br/>Markmap 深度引擎"]
            DrvSVG2["SVG Driver<br/>SVG Studio 交互微调"]
            DrvPDF2["PDF Driver<br/>Mozilla PDF.js 核心"]
            DrvTYP2["Typst Driver<br/>纯端侧 AST 与 A4 排版"]
            DrvPUML2["PlantUML Driver<br/>Deflate 实时编译与私有节点"]
            DrvCSV2["CSV Grid Driver<br/>高容量虚拟化表格与画像"]
            DrvOffice2["Office Drivers<br/>DOCX / PPTX / XLSX 纯离线工作台"]
            DrvData2["Structured Data Driver<br/>JSON / YAML / TOML / XML 树与互转"]
            DrvCloud2["Cloud Native Drivers<br/>Dockerfile / Compose / K8s 引力拓扑"]
            DrvApp2["Media Drivers<br/>EPUB / Notebook / Excalidraw / Image"]
        end

        subgraph SubEngines ["动态按需异步子引擎 (Lazy-Loaded)"]
            MermaidEngine["Mermaid 11+ 矢量图表"]
            PrismEngine["Prism.js 语法着色器"]
            KaTeXEngine["KaTeX 数学公式渲染"]
            GraphvizEngine["Graphviz DOT 拓扑排版"]
            TomlParser["工业级 TOML 解析器"]
        end

        IPCBridge --> CSPGuard
        CSPGuard --> DriverBus
        DrvMD2 -.-> MermaidEngine
        DrvMD2 -.-> PrismEngine
        DrvMD2 -.-> KaTeXEngine
        DrvMD2 -.-> GraphvizEngine
        DrvData2 -.-> TomlParser
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
    [*] --> REGISTERED: 插件加载，驱动注册到注册表 (driverRegistry)
    REGISTERED --> IDLE: 处于休眠待命状态 (零内存占用)
    IDLE --> INITIALIZING: 检测到匹配文件扩展名触发激活
    INITIALIZING --> ACTIVE: DOM 挂载就绪，首屏渲染完成
    ACTIVE --> ACTIVE: 文档内容更新 (增量 Diff 局部重绘)
    ACTIVE --> CACHED: 切换至后台标签页 (retainContextWhenHidden 保留状态)
    CACHED --> ACTIVE: 用户切回该标签页 (秒级恢复)
    ACTIVE --> DISPOSED: 标签页关闭 (触发 unmount，彻底清理内存与 Worker)
    DISPOSED --> [*]
\`\`\`

### 驱动设计模式的三大优势：
1. **彻底解耦**：新增一种格式（例如 TOML 或云原生清单）只需编写对应 Driver 并注册到字典，完全不需要改动宿主分发器。
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
    Webview->>Driver: 6. 路由并分发至对应驱动实例 (如 Markdown / K8s / TOML Driver)
    Driver->>Driver: 7. 异步 AST 解析、矢量拓扑生成与 DOMPurify 净化
    Driver-->>Webview: 8. 完成 DOM 挂载，平滑同步视口与滚动偏移行
    Note over Webview,Driver: 用户在界面中操作 (例如导出矢量图或修改配置)
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
| \`THEME_CHANGED\` | \`{ theme: 'system' \\| 'vscode' \\| 'dark' \\| 'light' ... }\` | VS Code 主题变更，驱动重新应用语义令牌 |

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
  <text x="360" y="112" fill="#94a3b8" font-size="11" font-family="monospace" text-anchor="middle">OmniView Driver Micro-Kernel Event Bus (统一驱动微内核事件总线)</text>

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
    <text x="45" y="28" fill="#22d3ee" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">Cloud Native</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Docker/K8s</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#06b6d4" stroke-width="2" />
  </g>

  <g transform="translate(420, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
    <text x="45" y="28" fill="#fbbf24" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">Data/TOML</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Tree+Mindmap</text>
    <line x1="45" y1="50" x2="45" y2="65" stroke="#f59e0b" stroke-width="2" />
  </g>

  <g transform="translate(540, 20)">
    <rect width="90" height="50" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
    <text x="45" y="28" fill="#34d399" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">Office &amp; Media</text>
    <text x="45" y="42" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">DOCX/PDF/Typst</text>
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
};
