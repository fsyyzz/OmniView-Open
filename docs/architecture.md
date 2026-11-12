# OmniView 架构设计与系统工程规范 (System Architecture Specification)

> **文档标识:** `docs/architecture.md`  
> **适用范围:** OmniView 全体架构师、核心开发者与开源贡献者  
> **标准状态:** 现行核心架构基准文档

---

## 1. 架构目标与系统愿景

OmniView 致力于为 Visual Studio Code 开发者与现代 Web 工作台提供**多格式、统一化、高性能且零外部依赖**的文件可视化与交互体验。

### 1.1 核心设计哲学
1. **微内核驱动模型 (Microkernel Driver Pattern)**: 核心外壳仅负责布局编排、IPC 通信与状态持久化；各文件格式（Markdown、PlantUML、PDF、Office 三件套等）均封装为具备独立生命周期与错误边界的 Viewer 驱动；
2. **纯前端/离线优先 (100% Offline & Pure Frontend)**: 不依赖任何远端商业付费服务或后台 Node 进程，所有解析、布局运算、WASM 编译与渲染均在客户端沙箱就地完成；
3. **安全纵深防御 (Defense in Depth)**: 全链路实施 DOMPurify 白名单过滤、CSP 强隔离与块级错误隔离，杜绝 XSS 注入与恶意脚本执行；
4. **像素级 VS Code 视觉融合**: 100% 依托 `--ov-*` 语义化设计令牌，无缝吸附 VS Code 宿主原生 CSS 变量及第三方主题（如 One Dark Pro、Dracula、Tokyo Night 等）；
5. **高性能稳帧与低内存占用**: 通过可卸载懒视口渲染 (`LazyViewportBlock`)、脏块指纹增量复用与高度记忆池，在万行长文档与百页书籍中维持 60 FPS 丝滑滚动与低内存开销。

---

## 2. 系统物理拓扑与运行模式

OmniView 原生支持两种物理运行形态，核心渲染逻辑通过抽象层实现 100% 代码复用：

```mermaid
flowchart TB
    subgraph Mode1 ["形态 A: VS Code 扩展沙箱模式 (Custom Editor Webview)"]
        direction TB
        VSC["VS Code Extension Host (Node.js 进程)<br/>src/extension/extension.ts"]
        IPC["postMessage 双向异步通信"]
        WV["VS Code Webview 隔离沙箱<br/>(Chrome / Chromium 进程)"]
        VSC <-->|"IPC (open, reload, save, error)"| IPC
        IPC <--> WV
    end

    subgraph Mode2 ["形态 B: 独立 Web 工作台模式 (Browser SPA)"]
        direction TB
        Browser["现代浏览器 (Chrome / Firefox / Safari / Edge)"]
        LocalEngine["本地内存存储 & HTML5 File API"]
        Browser <--> LocalEngine
    end

    WV --> Core["OmniView 前端核心引擎 (src/app/App.tsx)"]
    LocalEngine --> Core
```

### 2.1 VS Code Webview 通信协议契约 (IPC Protocol)

Extension Host 与 Webview 之间通过标准的 JSON 报文进行双向交互：

```mermaid
sequenceDiagram
    autonumber
    participant Host as Extension Host (extension.ts)
    participant FS as 本地文件系统 (Disk)
    participant Webview as Webview 沙箱 (App.tsx)

    Host->>FS: 监听文件变更 (FileSystemWatcher / onDidSave)
    FS-->>Host: 触发文档更新事件
    Host->>Webview: postMessage: { type: 'UPDATE_CONTENT', uri, content, isDarkTheme, theme }
    Webview->>Webview: 增量 Diff & 局部刷新当前驱动
    
    opt 用户在 Webview 中编辑或修改配置
        Webview->>Host: postMessage: { type: 'WRITE_BACK', uri, content }
        Host->>FS: 写入本地磁盘文件
    end

    opt 用户双击图表或大纲行号
        Webview->>Host: postMessage: { type: 'OPEN_SOURCE_AT_LINE', line }
        Host->>Host: 调用 vscode.window.showTextDocument 定位并聚焦行号
    end
```

---

## 3. 依赖防腐与单向分层架构 (Clean Architecture)

代码库遵循严格的单向依赖拓扑，禁止逆向依赖与跨层穿透：

```mermaid
flowchart TB
    Host["宿主适配层 (Host Layer)<br/>src/extension/"]
    App["应用中枢层 (App Layer)<br/>src/app/"]
    Features["特性驱动层 (Feature Layer)<br/>src/features/viewers, workbench, scaffold"]
    Shared["共享基座层 (Shared Layer)<br/>src/shared/data, docs, lib, types"]

    Host -->|"通过 postMessage"| App
    App --> Features
    Features --> Shared
```

- **宿主适配层 (`src/extension/`)**: 负责 VS Code Custom Editor Provider 注册、命令挂载、Webview Panel 创建与宿主事件监听；
- **应用中枢层 (`src/app/`)**: 负责应用唯一入口 (`App.tsx`)，解析 URL Query、初始化主题设计令牌、分发全局事件；
- **特性驱动层 (`src/features/`)**:
  - `viewers/`: 23+ 格式驱动核心组件与关联 Hook/Lib（涵盖专业文档、图表架构、现代办公、云原生配置与科学计算）；
  - `workbench/`: 工作台外壳、侧边栏、多标签页管理器、状态栏、设置面板与多格式文件浏览器；
  - `scaffold/`: 扩展脚手架与自定义导出中心 (ScaffoldExporter)；
- **共享基座层 (`src/shared/`)**:
  - `lib/`: 配置持久化 (`settingsStorage`)、文件存储 (`fileStorage`)、原生主题 (`nativeTheme`)、打印桥接 (`printBridge`)、i18n 多语言体系；
  - `data/`: 内置示例文件池与 Driver 注册元数据；
  - `docs/`: 编译期嵌入的技术文档数据；
  - `types.ts`: 全局共享 TypeScript 接口与类型定义。

---

## 4. 统一驱动抽象与路由分发总控机制

所有文件通过统一的调度中心分流，根据文件扩展名与内容特征分发至对应驱动：

```mermaid
flowchart LR
    File["输入文件<br/>(URI + Content)"] --> Router{"ViewerRenderer<br/>路由匹配器"}

    Router -->|".md / .markdown"| D_MD["MarkdownViewer"]
    Router -->|".puml / .plantuml"| D_PUML["PlantUmlViewer"]
    Router -->|".svg"| D_SVG["SvgViewer (Studio v2)"]
    Router -->|".pdf"| D_PDF["PdfViewer"]
    Router -->|".epub"| D_EPUB["EpubViewer"]
    Router -->|".csv / .tsv"| D_CSV["CsvViewer"]
    Router -->|".mmd / .mermaid"| D_MMD["MermaidViewer"]
    Router -->|".dot / .gv"| D_GV["GraphvizViewer"]
    Router -->|".markmap / .mm"| D_MM["MindmapViewer"]
    Router -->|".ddd"| D_DS["DomainStoryViewer"]
    Router -->|".excalidraw"| D_EXC["ExcalidrawViewer"]
    Router -->|".ipynb"| D_NB["NotebookViewer"]
    Router -->|".typ / .typst"| D_TYP["TypstViewer"]
    Router -->|".json / .yaml / .toml / .xml"| D_DATA["StructuredDataViewer"]
    Router -->|".docx"| D_DOCX["DocxViewer"]
    Router -->|".pptx"| D_PPTX["PptxViewer"]
    Router -->|".xlsx / .xls"| D_XLSX["XlsxViewer"]
    Router -->|".png / .jpg / .webp"| D_IMG["ImageViewer"]
    Router -->|"Dockerfile*"| D_DF["DockerfileViewer"]
    Router -->|"docker-compose.yml"| D_DC["ComposeViewer"]
    Router -->|"k8s/*.yaml"| D_K8S["K8sViewer"]
    Router -->|".html / .htm"| D_HTML["HtmlViewer"]
    Router -->|"主流代码格式"| D_CODE["CodeViewer"]
    Router -->|"未知格式 / 损坏"| D_FALLBACK["未知格式自愈与 Hex 转储"]
```

---

## 5. 核心驱动子系统深度设计

各驱动子系统的详细规范请查阅配套设计文档：
- **格式驱动矩阵与生命周期**: 请参阅 [`docs/design/viewer-drivers.md`](./design/viewer-drivers.md)；
- **Markdown 增量分词与渲染流水线**: 请参阅 [`docs/design/markdown-pipeline.md`](./design/markdown-pipeline.md)；
- **持久化配置与存储子系统**: 请参阅 [`docs/design/persistence-storage.md`](./design/persistence-storage.md)。

### 5.1 Markdown 增强型块级管道 (Markdown Pipeline)
```mermaid
flowchart TD
    Src["Markdown 源码"] --> DiffCheck{"AI 内联协同修改探测<br/>(markdownDiffEngine)"}
    DiffCheck -->|"存在修改标记"| DiffBar["三态对比控制栏 (修改后/修改前/内联差异)"]
    DiffCheck -->|"标准源码"| Lex["Marked Lexer 分词"]
    DiffBar --> Lex
    Lex --> B1["KaTeX 数学公式 ($$)"]
    Lex --> B2["嵌入式矢量图表 (Mermaid / PlantUML / Graphviz / SVG / DDD 5视图)"]
    Lex --> B3["高交互响应式表格 (排序 / 列宽调整 / 导出)"]
    Lex --> B4["语法高亮代码块 (Prism.js + Word 2 列表格复制)"]
    
    B1 & B2 & B3 & B4 --> Lazy["可卸载懒视口 (LazyViewportBlock)"]
    Lazy --> Sanitize["DOMPurify 白名单净化"]
    Sanitize --> View["挂载至 DOM 容器"]
    View --> CaretTrack["镜像 DOM 光标像素级定位 (getCaretCoordinates)"]
    CaretTrack --> QuickAct["悬浮快速插入控制胶囊"]
```

- **AI 协同修改无标记识别与三态对比 (`markdownDiffEngine.ts`)**: 自动解析并高亮 AI 生成或协作产生的新增、删除与内联替换，顶部常驻吸顶控制条支持在「修改后视图」、「修改前视图」与「带删除线/高亮对比视图」间瞬间切换；
- **镜像 DOM 像素级光标定位与智能悬浮胶囊 (`getCaretCoordinates`)**: 彻底解决长篇源码中物理行与排版折行脱节问题，利用不可见镜像计算出光标字符的 `(caretLeft, caretTop)` 绝对坐标，让插入胶囊随写随走，并在右侧边界自适应停靠；
- **DDD 领域驱动设计 5 大视图矩阵**: 原生支持业务故事、事件风暴、领域全景图、限界上下文映射与聚合根实体建模，并全面融入全套 14 种渲染主题。

### 5.2 矢量图表引擎与沙箱自愈调度
- **Mermaid.js**: 统一注入主题配置 (`mermaidConfig.ts`)，针对明亮/暗黑主题进行高对比度色值矫正，并包裹双击全屏沉浸灯箱 (`LightboxModal`)；
- **Graphviz DOT**: 采用主线程与 Web Worker 双通道混合调度，在 Worker 失败时无缝自动降级至内存 WASM 执行；集成 7 种专业布局引擎（dot、neato、fdp、sfdp、twopi、circo、osage），并利用 `solidifyGraphvizSvg` 在暗色主题下固化透明边框与文字对比度；
- **PlantUML**: 支持自建私有服务与官方代理无缝切换，基于 `<style>` 标签在渲染树注入 14 大主题配色，并提供 300+ DPI 矢量光栅化入剪贴板；
- **Excalidraw 白板**: 纯前端手绘矢量画布，支持图形拖拽与底层 JSON 代码双向同步；
- **Domain Storytelling**: 100% 遵循 egon.io 业务建模规范，支持逐帧步进演播与 Polyglot SVG 双向无损导入导出。

### 5.3 现代排版与电子出版引擎
- **Typst Studio**: 基于纯端侧 AST 增量编译器架构与 A4 2.0 工业级排版引擎，支持实时增量编译、KaTeX 公式混排、多版心切换与高精度 A4 矢量打印；
- **EPUB 现代流式阅读器**: 支持双叶并排跨页 (Two-Page Spread)、单页流式 (Single-Page Flow) 与连续流式滚动 (Continuous Scroll) 三重形态、3D 翻书光效，以及阅读进度断点续读；
- **PDF.js v4+ 版式阅读器**: 支持多页连续流式、划词标注侧栏 (`PdfAnnotationsView`)、Markdown 批注导出、全文检索高亮与视口阅读进度感知。

### 5.4 Office 离线无服务工作台
- **Word (.docx)**: 基于 OOXML 标准与 `docx-preview` 纯前端离线流水线，支持 A4 拟真排版、缩放与夜间对比度反转；
- **PowerPoint (.pptx)**: 纯离线解包与矢量自适应画布，支持 16:9 / 4:3 沉浸放映与演讲者备注；
- **Excel (.xlsx)**: 多工作表毫秒级切换、公式计算值与原始表达式无缝切换检视、列特征画像分析 (Profiling) 与迷你走势图；集成自研列宽自由拖拽与按工作表持久化 (`xlsxColumnWidthStorage.ts`)，并自适应计算表头吸顶偏移 (`stickyTop`)。

### 5.5 云原生三合一工作台与 HTML5 沙箱
- **Dockerfile 流水线工作台 (`DockerfileViewer`)**: 多阶段构建流水线 DAG 图形化拓扑、基础镜像继承树、端口/环境变量/数据卷三维矩阵，以及非 root 安全基准合规体检；
- **Docker Compose 微服务工作台 (`ComposeViewer`)**: 服务依赖拓扑有向图、隔离网络与持久化卷拓扑、端口冲突预警，以及敏感环境变量自动星号打码脱敏；
- **Kubernetes 架构拓扑工作台 (`K8sViewer`)**: 多资源文档 YAML 智能切分、4 层云原生引力拓扑图 (Ingress → Service → Workload → Pod/Config)、Label/Selector 连线推导与孤儿断链健康体检；
- **HTML5 独立安全沙箱 (`HtmlViewer`)**: 双层受控沙箱 iframe (`sandbox="allow-scripts"` 严格隔离)、Desktop/Laptop/Tablet/Mobile 4 大响应式设备仿真与横竖屏旋转，支持纯端侧实时热重载。

---

## 6. 安全防御矩阵与沙箱隔离规范 (Security & Sandboxing Matrix)

| 防御层级 | 攻击场景 / 风险 | 防护实施策略 | 校验手段 |
| :--- | :--- | :--- | :--- |
| **L1: 输入层** | 超大畸变文件导致内存溢出 (DoS) | 文件体积前置嗅探、流式块解析、数值安全钳位 | `test-security-sanitizer.mjs` |
| **L2: 渲染层** | 恶意 `<script>`、`<iframe>`、`onerror` 属性型 XSS | 强制经过 DOMPurify 严格白名单清洗过滤，阻断所有未授权属性 | `test-diagram-sanitizer.mjs` |
| **L3: 视口层** | 动态内联 SVG 携带恶意外部实体注入 (XXE) | 剥除 `<!ENTITY>` 声明与外链资源引用 | `test-svg-utils.mjs` |
| **L4: 运行层** | 单个图表语法崩溃击垮整个插件工作台 | `RenderErrorBoundary` 块级捕获，就地降级为 DiagnosticCard | `test-diagram-diagnostics.mjs` |
| **L5: 存储层** | LocalStorage 恶意注入篡改配置 | Schema v2 校验、数值越界重置、JSON 异常捕获兜底 | `test-settings-storage.mjs` |

---

## 7. 性能工程与资源回收规范 (Performance & Optimization)

1. **可卸载型懒视口管理 (`LazyViewportBlock`)**:
   - 超长文档中，超出视口保护范围的重型图表自动卸载 DOM 与 WASM 资源；
   - 依赖全局 `blockHeightCache` 记忆节点高度，滚动回视口时瞬间就位，达成零布局抖动 (Zero CLS)。
2. **慢块监控与耗时预算 (`renderTimeBudget`)**:
   - 实时记录单块渲染耗时，超过 800ms 阈值在大纲树显式标红/标黄；
3. **剪贴板 100% 同步流水线**:
   - 拦截复制事件，彻底消除外层 Tailwind 边框与交互手柄，为 Word/WPS 写入 300+ DPI Base64 极清图片与规范 2 列表格；
4. **资源全生命周期回收**:
   - 组件卸载 (`useEffect` 清理函数) 严格执行：
     - 撤销所有动态生成的 Blob URL (`URL.revokeObjectURL`)；
     - 终止 Web Worker 实例 (`worker.terminate()`)；
     - 清除定时器与 ResizeObserver 监听，确保零内存泄漏。

---

## 8. 前置工程质量门禁与全自动化测试架构

OmniView 实施严苛的持续交付门禁，任何代码提交前必须 100% 绿灯通过：

```mermaid
flowchart LR
    Commit["代码变更提交"] --> G1["lint:codex<br/>(规范死链扫描)"]
    G1 --> G2["check:structure<br/>(架构单向分层)"]
    G2 --> G3["check:doc-code-consistency<br/>(文档事实一致性)"]
    G3 --> G4["check:react-governance<br/>(Hook 依赖治理)"]
    G4 --> G5["lint<br/>(tsc --noEmit)"]
    G5 --> G6["test<br/>(101 组全链路单测)"]
    G6 --> G7["build:plugin<br/>(Webview + Extension 构建)"]
    G7 --> Pass["✅ 合格准入"]
```

### 8.1 101 组自动化测试套件全覆盖矩阵
- **图表与矢量渲染 (20 组)**: Mermaid 配置/状态/步骤播放、PlantUML URL/代理/高分辨率/主题样式注入、Graphviz WASM/7 大布局引擎/SVG 固化、SVG v2 核心模型/命令管线/形状绘制工具/高级交互/视口滚轮平滑缩放、思维导图、Domain Storytelling 业务建模/Polyglot 导出、Excalidraw 白板、图表诊断降级、图表缓存、图表安全清洗、KaTeX 数学公式；
- **文档与版式引擎 (22 组)**: Markdown 选区替换、Markdown 大纲提取、Markdown 脚注、Markdown WikiLinks、Markdown Callout、Markdown Pandoc 扩展、Markdown 原地块级 CRUD 与撤销浮条、Markdown 打印导出、Word 富文本剪贴板清洗、A4 打印分页、A4 工业排版引擎、Typst 排版编译器、AI 无标记差异比对引擎、源码编辑光标镜像 DOM 坐标计算与悬浮快速插入；
- **现代格式与电子书 (16 组)**: EPUB 流式解析引擎与阅读进度持久化、PDF 阅读与标注引擎、Word DOCX 离线引擎、PowerPoint PPTX 矢量放映引擎、Excel XLSX 解析与列宽拖拽持久化、现代图像引擎、Jupyter Notebook 离线分析器；
- **云原生与结构化配置 (16 组)**: Dockerfile DAG 流水线解析与安全基线体检、Docker Compose 微服务拓扑与网络拓扑推导、Kubernetes 4 层引力拓扑与断链健康诊断、HTML5 网页沙箱隔离与设备仿真、统一结构化 AST 序列化、JSON/YAML/TOML/XML 跨格式无损互转；
- **数据分析与工作台 (14 组)**: RFC 4180 CSV 解析、CSV 数据画像分析、结构化数据多态视图、Google OKF 知识卡片、DOM 搜索高亮器、双向滚动同步、视口懒加载、历史撤销重做；
- **工程与基础设施 (13 组)**: 驱动路由分发、原生主题自适应与 14 大渲染主题预设、配置持久化与迁移、i18n 国际化字典、打印桥接、版本自动自增、VSIX 产物内容核对、Webview 回写保存。

---

## 9. 文档体系与导航索引

| 文档路径 | 文档名称 | 核心内容定位 |
| :--- | :--- | :--- |
| [`docs/architecture.md`](./architecture.md) | **系统架构设计规范** (本文档) | 全局架构、分层拓扑、IPC 通信、安全矩阵与门禁全景 |
| [`docs/features-capabilities.md`](./features-capabilities.md) | **功能全景与能力评估手册** | 23 格式驱动能力全景、成熟度多维评估与演进手册 |
| [`docs/design/viewer-drivers.md`](./design/viewer-drivers.md) | **Viewer 格式驱动设计规范** | 23 格式驱动能力矩阵、生命周期、Props 契约与降级自愈 |
| [`docs/design/markdown-pipeline.md`](./design/markdown-pipeline.md) | **Markdown 渲染流水线规范** | 块级虚拟化、增量 Diff、原地 CRUD 引擎、慢块预算与 Word 剪贴板清洗 |
| [`docs/design/svg-v2-editor.md`](./design/svg-v2-editor.md) | **SVG v2 编辑引擎设计规范** | 不可变文档模型、8 核心矢量工具、命令管线与折线演化体系 |
| [`docs/design/persistence-storage.md`](./design/persistence-storage.md) | **持久化与存储子系统规范** | 配置 Schema v2、版本平滑迁移、安全钳位与容量分析 |
| [`docs/README.md`](./README.md) | **技术文档导航总索引** | 文档目录索引与维护准则 |
| [`PROJECT.md`](../PROJECT.md) | **工程现状与产品全景基准** | 项目技术栈、功能全景图与目录架构基准 |
| [`CHANGELOG.md`](../CHANGELOG.md) | **版本变更历史日志** | Keep a Changelog 标准版本演进日志 |
