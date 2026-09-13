# Mermaid 动态图表全景展馆 (Mermaid Visual Gallery)

> **引擎版本**：Mermaid.js v11+ | **渲染驱动**：OmniView Markdown & Diagram Engine | **作者**

本文档全面演示 OmniView 渲染引擎对 **Mermaid** 丰富图表类型的解析能力，包含 **流程图、时序图、类图、状态机、甘特图、Git 工作流图与数据占比饼图**。支持暗色/亮色多主题自适应渲染！

---

## 1. 复杂带分组与样式流程图 (Flowchart with Subgraphs)

```mermaid
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
```

---

## 2. 状态机图 (State Diagram v2)

```mermaid
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
```

---

## 3. 面向对象类图 (Class Diagram)

```mermaid
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
```

---

## 4. 研发甘特图 (Gantt Project Timeline)

```mermaid
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
```

---

## 5. 软件工程 Git 工作流图 (GitGraph)

```mermaid
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
```

---

## 6. 文件格式支持占比饼图 (Pie Chart)

```mermaid
pie title OmniView 工作台已支持与验证文件格式覆盖率
    "Markdown & 富文本" : 32
    "矢量图表 (Mermaid / PlantUML)" : 28
    "高精度 SVG 矢量" : 16
    "结构化数据 (CSV / TSV)" : 12
    "代码与配置 (TS / YAML / JSON)" : 12
```
