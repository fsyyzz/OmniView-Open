# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.2.25] - 2026-09-28

### Added

- **新增 4 款主流现代互联网主题风格 (Modern Internet Aesthetic Themes)**:
  - **GitHub Dark (`github-dark`)**：开源开发者与极客社区标杆，深空冷灰黑底色 (`#0d1117`)、标准代码高亮与经典 GitHub 绿 (`#238636`) 强调色；
  - **Catppuccin Mocha (`catppuccin`)**：顶流当红极客视觉系，温润摩卡灰黑底色 (`#181825`) 与柔和薰衣草紫/马卡龙低反差长效护眼调色；
  - **Tokyo Night (`tokyo-night`)**：前沿云原生与 Web3 潮流，夜空深蓝底色 (`#1a1b26`) 与霓虹天青紫高光交织的未来科技感；
  - **Notion Minimal (`notion`)**：现代互联网知识库与极简协作空间美学，纯粹白调 (`#f7f6f3`)、石墨雅灰 (`#37352f`) 与无干扰专注排版；
  - 全套设计令牌与各格式驱动、代码块、数据表格、大纲侧栏与图表画布实现 100% 自适应融合。

## [1.2.24] - 2026-09-28

### Fixed

- **外部挂载文件提示徽标剪贴板脱敏隔离 (External Badge Clipboard Ignore)**:
  - 在 `ExternalBadgePill` 组件的外层 wrapper 与内层 pill 元素上注入 `data-clipboard-ignore="true"` 与 `ov-clipboard-ignore select-none`，配合全局 CSS `user-select: none !important;` 彻底杜绝选区将“📌 外部挂载文件: performance-radar-chart.svg”等提示徽标捕获进剪贴板；
  - `wordClipboardHelper.ts` 的 `isIgnoredClipboardElement` 与 `ignoreSelectors` 深度同步，在 Word 富文本复制与 `sanitizePlainTextClipboard` 纯文本清洗中物理剔除挂载提示。

## [1.2.23] - 2026-09-28

### Fixed

- **Markdown 表格底栏统计与就地编辑提示剪贴板隔离 (Table Footer Clipboard Ignore)**:
  - 修复表格底部统计栏（“总行数: X”、“双击单元格就地编辑”）缺少剪贴板隔离标识而在全选/划选时被带入剪贴板的问题；
  - 为 `TableBlock` 和 `TableLightboxModal` 底部统计栏增加 `data-clipboard-ignore="true"` 与 `ov-table-block-footer ov-clipboard-ignore select-none` 隔离类名；
  - 修复 `isFullContainerSelection` 全选判定缺陷，放宽带有 ignore 属性的工具栏文字容差至 85%，确保 Ctrl+A 全选时 100% 稳定输出干净的 Markdown 源码；
  - 增加 `sanitizePlainTextClipboard` 纯文本剪贴板脱敏清洗函数，自动剥除表格统计信息、求和均值与双击就地编辑等辅助文本。

## [1.2.20] - 2026-09-28

### Refactored

- **多格式驱动外层重复通用顶栏彻底剥离与系统能力融合 (Viewer Toolbar Deduplication & System Capability Integration)**:
  - **彻底移除外层通用动作条**：在 `PluginDocumentView` 中剥离 `NonMarkdownPluginView` 顶部冗余的通用顶栏，彻底消灭了与下层驱动专有 Header 冲突的“文件名”、“同步状态标签”及“在编辑器中打开”重复按钮，净增 36px+ 垂直可视阅读与绘图工作空间；
  - **驱动 SPI 契约升级与系统能力下沉融合**：在 `driverRegistry.ts` 的 `DriverProps` 中扩展新增 `onOpenSettings?: () => void;` 与 `onOpenShortcuts?: () => void;` 接口契约，并通过 `ViewerRenderer` 自动向下分发；
  - **各大驱动专有顶栏深度赋能**：在通用图表顶栏骨架 `DiagramStudioShell` 以及 PlantUML、Mindmap、StructuredDataViewer、CodeViewer 等各大驱动专有 Header 中无缝融合“工作台设置”与“快捷键指南”入口；
  - **未落盘修改优雅浮动提示**：在 VS Code Webview 模式中产生未保存变更时，采用右下角悬浮半透明玻璃质感徽标展示未保存标记与一键保存按钮，既不遮挡主图表视图，又保证状态实时可感知；
  - **专属守卫测试沉淀**：新增 `test-toolbar-dedup.mjs` 自动化回归测试套件并接入 `npm test`。

## [1.2.18] - 2026-09-28

### Refactored

- **巨型组件拆分与宿主模块化架构重构 (Modular Component Architecture & Design Tokenization)**:
  - 拆分 `PluginDocumentView` 与 `MarkdownViewer` 巨型文件为专注子组件与定制 Hook；
  - 统一 Markdown 渲染路由至驱动注册表，全量消除散落硬编码色值，实现 100% `--ov-*` 语义设计令牌化，像素级融合 VS Code 原生与第三方主题。

## [1.2.16] - 2026-09-28

### Improved

- **Markdown 渲染 SVG 矢量图响应式空间自适应 (Responsive SVG Layout Engine)**:
  - 自动推导并补全缺失的 `viewBox`，物理单位自动换算，内联 style 深度脱敏与防溢出自适应；
  - 修复 Markdown 渲染区划选复制误判为全选源码问题，划选时仅复制选中片段。

## [1.2.14] - 2026-09-28

### Added

- **Word (`.docx`) 离线文档导航大纲支持与目录节点过滤 (Word Offline Outline Navigation)**:
  - 增加 DOCX 离线文档导航大纲侧边栏，支持多级标题快速定位与平滑滚动；
  - 增加 Word 自动生成目录页 (TOC Block) 节点过滤，杜绝点击导航误跳转至文档开头目录；
  - 增加外部文件修改热重载与实时同步机制，外部保存文件时 Webview 自动热更新。

### Added

- **VS Code 深度原生生态集成 (VS Code Deep Extension Ecosystem Integration)**:
  - **活动栏资产全景树 (`Activity Bar` 视图容器 & `TreeView`)**：注册独立的 OmniView 资产中枢，按架构流程、矢量设计、学术出版、数据报表、思维导图 5 大业务领域对工作区资产进行全景扫描与聚合呈现，支持一键新建与直达工作台。
  - **光标 Hover 悬浮微型预览 (`HoverProvider`)**：在 Markdown、Typst、Mermaid、PlantUML 等源码中悬停时即时解析图表块、LaTeX 数学公式与 Obsidian Wiki 媒体嵌入引用。
  - **内联 CodeLens 快捷动作 (`CodeLensProvider`)**：在文档与图表块上方注入「实时分屏协同」与「图表快速渲染」动作。
  - **原生大纲与符号索引 (`DocumentSymbolProvider`)**：为 Markdown、Typst、PlantUML、Graphviz 等提供标准文档符号结构，无缝接入 VS Code `Ctrl+Shift+O` 快捷跳转。
  - **原生底部状态栏与快捷控制中心 (`StatusBarItem` & `QuickPick`)**：右下角常驻状态指示，单击唤起工作台多维控制中心。

### Improved

- **全文档格式全局 `Ctrl+F` / `Cmd+F` 检索与高亮联动闭环 (Universal Search Enhancement)**:
  - **Markdown 阅读视口全局快捷检索**：支持在阅读视口任意位置按 `Ctrl+F` 即时展开工具栏并聚焦搜索框，支持 `Enter/Shift+Enter` 上下项导航与 `Escape` 快速清空失焦。
  - **全驱动搜索交互对齐**：为 CSV、Excel (`.xlsx`)、Word (`.docx`) 等驱动全面对齐 `Ctrl+F` 全局按键捕获与高亮检索联动，CSV 源码模式下按 `Ctrl+F` 自动平滑切回网格模式。
  - **DOM 敏感子树保护**：严格保护 SVG 矢量画布、KaTeX 公式与离屏图表节点，杜绝检索高亮导致排版断裂。

## [1.2.10] - 2026-09-26

### Fixed

- **Markdown 大纲导航栏位置持久化修复 (Outline Position Persistence Fix)**:
  - 修复用户在 Markdown 文档中调整大纲导航栏位置（左侧/右侧/浮动）后，切换或打开新文件时设置被恢复为默认值的问题。
  - 根因：VS Code 宿主在每次打开文件时通过 `host-configuration` 握手推送全量配置（含默认值），`App.tsx` 中 `saveStoredSettings(hostSettings)` 无条件将 host 默认值覆盖了 localStorage 中用户刚显式保存的自定义值。
  - 修复方案：在 `host-configuration` 合并策略中，对 UI 布局偏好类配置（`outlinePosition`、`outlineWidth`、`outlineOpen`、`outlineDisplayMode`、`viewMode`、`contentWidth`、`fontSize`、`zoom`）引入「本地用户自定义优先」保护——若 localStorage 中已存在与默认值不同的用户自定义值，则保留本地值，不被 host 默认值覆盖。

## [1.2.9] - 2026-09-26

### Fixed

- **视图模式与工作台顶栏去重治理 (View Mode Duplication Fix)**:
  - **彻底清除外壳与驱动内部模式重复渲染**：分析并排查非 Markdown 格式（Compose、Dockerfile、K8s、HTML、SVG、Typst、Mermaid、PlantUML、Graphviz、白板等）在 VS Code 插件视图外壳 (`NonMarkdownPluginView`) 与独立工作台顶栏 (`WorkbenchHeader`) 中频繁重复出现两排「渲染视图/并排协同/源码编辑」切换条的架构根因。
  - **职责边界清晰划分**：所有具备自包含工作台（Studio Shell）的非 Markdown 驱动，三态模式切换与分屏参数完全由其内部自包含掌控；外壳只呈现文档元数据与宿主操作，`WorkbenchHeader` 模式组精准限定于 Markdown 文档，彻底杜绝按钮重复出现与内外层状态脱节。
  - **驱动生命周期隔离**：在 `ViewerRenderer` 中为目标驱动组件引入基于文件路径/标识的精准 `key`，杜绝切换文档时驱动内部模式与编辑态产生串扰残留。

## [1.2.8] - 2026-09-26

### Improved

- **现代图像工作台与二进制文件格式交互优化 (ImageViewer & Binary Enhancements)**:
  - **全主题自适应与语义设计令牌深度融合**：修复图像工作台底色未按全局主题生效的问题，新增 `system` 系统底色模式（默认启用并直接依托 `var(--ov-bg)`），支持系统/棋盘格/暗室/纯白四态切换；优化亮暗模式下高对比度自适应棋盘格，工具栏与弹窗全面接入 `--ov-*` 语义令牌，完美融入浅色、深色及宿主原生主题。
  - **精简交互链路（移除图片协同分屏与源码编辑）**：针对 PNG 等二进制图片文件（`png, jpg, jpeg, gif, webp, bmp, ico, avif, tiff`）建立能力约束（`supportsSplitView: false`, `supportsSourceEdit: false`），在插件视图外壳和工作台顶部自动隐藏无意义的“并排协同”与“源码编辑”按钮，模式安全收敛为纯预览视图，保持交互清爽专注。

## [1.2.7] - 2026-09-26

### Added

- **HTML5 网页与受控隔离沙箱工作台 (HTML5 Sandbox Studio)**:
  - **双层安全隔离沙箱 (Dual Sandbox Defense)**：内置受控 `iframe` 沙箱，严格剔除 `allow-same-origin` 与 `allow-top-navigation`，天然免疫 CSRF 与 Cookie/LocalStorage 侧信道泄漏；支持在纯净隔离环境下安全预览第三方网页与报表。
  - **动态脚本执行闸门 (Script Toggle)**：支持无脚本安全静态检视与交互式全功能模式随心一键切换。
  - **多端视口仿真 (Multi-Device Emulation)**：支持自适应流式视口 (100%)、平板端标准视口 (768px) 及移动端标准视口 (375px) 像素级拟真仿真。
  - **专业底色与无级缩放 (Canvas Backgrounds & Zoom)**：提供系统主题、纯白 (Light)、暗黑 (Dark) 及透明棋盘格 (Checkerboard) 四态画布底色；支持 50% ~ 200% 自由缩放与重置。
  - **三态工作台布局**：支持沉浸式纯预览 (Preview)、分屏对照实时联动 (Split) 及源码模式 (Code)。
  - **开箱即用骨架片段**：提供 HTML5 基础骨架、Tailwind 快速卡片、Canvas 动画演示等内置骨架片段，支持一键无损插入与清空。
  - **高保真独立打印**：支持视口内 HTML 单独触发打印排版与 PDF 导出。
- **扩展与路由生态全链路集成**:
  - 全局关联 `*.html` 与 `*.htm` 文件，无缝对接 VS Code 资源管理器与自定义编辑器。
  - 驱动注册表扩充至 22 类核心驱动，驱动元数据与多语言全量覆盖。

## [1.2.5] - 2026-09-26

### Added

- **云原生与容器化基础设施全套工作台 (Cloud-Native Infrastructure Studio)**:
  - **Dockerfile 构建流水线与指令透视 (Dockerfile Driver)**：自动解析并生成多阶段构建流水线 DAG、指令层级分类、暴露端口 (`EXPOSE`) / 挂载卷 (`VOLUME`) / 环境变量 (`ENV`) 矩阵化提取与非 root 安全最佳实践体检。
  - **Docker Compose 微服务拓扑工作台 (Compose Driver)**：微服务依赖关系拓扑图（基于 Mermaid）、网络隔离簇与存储卷挂载图谱下钻、敏感环境变量自动打码脱敏及端口冲突体检。
  - **Kubernetes 复合清单四层引力拓扑工作台 (K8s Driver)**：纯离线多文档 YAML 自动切分、4 层云原生引力拓扑（`Ingress/Gateway` $\to$ `Service` $\to$ `Workload` $\to$ `Config/Storage`）、跨资源 Selector 自动引力连线与探针/断链体检诊断。
- **TOML 工业级解析与跨格式无损互转 (TOML & Structured Data)**:
  - 工业级零依赖轻量 TOML 解析器：完整支持点分多级节名 (`[package.metadata.docs]`)、内联表 (`serde = { version = "1.0" }`)、数组表 (`[[bin]]`)、行内注释剥除与多行三引号文本。
  - 融入多态结构化数据工作台：提供结构树检视 (Tree)、全景思维导图大纲投影 (Mindmap)、同构数组表格下钻 (Table) 与源码模式 (Code)。
  - 跨格式无损互转：实现 **TOML ⇄ JSON ⇄ YAML ⇄ XML** 实时本地无损互转、格式美化与导出。
- **插件设置与 VS Code 宿主双向集成**:
  - 19 项插件首选项与 VS Code 原生设置面板双向实时同步映射与持久化。
- **Markdown 代码块统一顶部悬浮工具条**:
  - 代码块顶部悬浮工具条整合折叠、全屏、一键复制及语言行数常驻显示。

### Refactored

- **数据与文档中枢架构解耦治理**:
  - 模块化治理 `sampleFiles.ts` 巨石文件为 5 大领域子模块 (`driversMeta`, `diagramSamples`, `documentSamples`, `dataSamples`, `cloudNativeSamples`)，保持 100% 向后兼容导出。
  - 模块化治理 `projectDocs.ts` 规范文件，全局统一 OmniView 产品命名，全面对齐 21 种驱动功能需求规格 (FR-01 ~ FR-14) 与最新架构拓扑图。

### Tested

- 补充云原生三件套、TOML 格式解析、设置面板与 Hover 工具条单测套件，全量 80+ 组自动化测试 100% 绿灯，通过所有物理门禁。

## [1.2.0] - 2026-09-25

### Added

- **Office 三件套纯前端离线工作台 (DOCX / PPTX / XLSX)**:
  - 支持 Word (`.docx`) 拟真排版、表格单元格合并、嵌入图片与暗色自适应；
  - 支持 PowerPoint (`.pptx`) 16:9/4:3 矢量自适应画布、全屏沉浸放映、缩略图大纲与演讲者备注；
  - 支持 Excel (`.xlsx`) 多工作表切换、共享字符串池、公式计算值解析与列特征统计画像 (Profiling)。
- **现代图像工作台 (ImageViewer)**:
  - 10%~3200% 极清矢量缩放、16x 像素十字放大镜取色器 (HEX/RGBA/HSLA)、四态画布底色与 EXIF 深度元数据透视。
- **DDD 领域故事讲授引擎 (Domain Storytelling .dst)**:
  - 原生支持 WPS egon.io 官方 `.dst` (JSON) 标准规范，兼容 `.egn` / `.domainstory`、交互式逐帧演播器 (DiagramStepPlayer) 与 Markdown ````domainstory```` DSL。

## [1.1.0] - 2026-09-24

### Added

- **学术排版与数据科学套件 (Typst & Jupyter Notebook)**:
  - 原生支持 Typst (`.typ`) A4 出版级多页排版、目录大纲跳转、单/双页排版模式与 A4 打印；
  - 原生支持 Jupyter Notebook (`.ipynb`) v4 单元格混排、ANSI 彩色 Traceback 与数据图表输出；
  - 支持 Excalidraw (`.excalidraw`) 手绘风格白板双向编辑与矢量导出；
  - 支持 EPUB 电子书 3D 翻书动效与护眼羊皮纸主题。

## [1.0.0] - 2026-09-23

### Added

- **Markdown & 嵌入式图表微内核引擎**:
  - GFM 规范、Google OKF 知识卡片、Markmap 思维导图、Mermaid 11+ 图表、PlantUML 架构图、Graphviz DOT 拓扑、KaTeX 数学公式；
  - Word/WPS 剪贴板同步清洗、无线框富文本与 300+ DPI 极清光栅化图片双通道写入；
  - VS Code 官方 Webview CSP Level 3 纵深安全防御与 DOMPurify 全量消毒。
