# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.13.0] - 2026-09-17

### Added

- **EPUB 现代电子书流式阅读器 (`EpubViewer` / `.epub`)**:
  - **三重流式阅读形态 (Flow Modes)**：支持双叶并排跨页（Two-Page Spread，拟真书脊中缝折痕与阴影、极窄屏智能自适应）、单页流式分页（Single-Page Flow，单栏专注阅读）与连续流式滚动（Continuous Scroll，纵向平滑无间断阅读）；
  - **3D 拟真翻书微光效 (Page Flip Effect)**：具备 GPU 硬件加速的 3D 页面翻转物理光影过渡动效，支持快捷开关；
  - **排版偏好与阅读进度持久化 (`epubSettingsStorage`)**：100% 支持用户界面点击交互的字号微调 (A-/A+)、字体族选择（宋体/黑体/楷体/等宽）、两字符首行缩进、对齐方式（两端对齐/靠左）、行距倍率（1.5x/1.75x/2.0x）、版心宽度（标准/宽幅/全幅）、护眼阅读主题（自动环境/羊皮纸/明亮/夜间）与书籍专属阅读进度（章节、页码、百分比）自动记录与恢复。

## [0.12.3] - 2026-09-17

### Fixed

- **PlantUML 暗色模式高对比度皮肤自适应与透明背景融合**:
  - 为 PlantUML 渲染引擎注入深色主题自适应 skinparam 皮肤规范，全面提升暗色模式下箭头线条（`#60a5fa`）、端点文字（`#93c5fd`）、生命线（`#94a3b8`）与实体卡片背景（`#1e293b`）的对比度与视觉辨识度；
  - 智能语法探测与用户意图保护：若源码中已显式指定 `!theme` 或自定义 `arrowColor` / `backgroundColor`，则严格尊重用户原生配置，不做多余侵入；
  - 优化 Markdown 视图中 PlantUML 容器在深色主题下的背景样式，去除突兀的白底遮罩，达成像素级无缝融合；
  - Markdown AST 解析流水线、实时编辑更新、大纲预览与灯箱全屏查看器全链路接入暗色模式上下文。

### Added

- **VS Code 官方标准快捷键绑定**:
  - 新增 `Ctrl+K V` / `Ctrl+Shift+V`（macOS 对应 `Cmd+K V` / `Cmd+Shift+V`），在活动源码编辑器聚焦时一键唤起 OmniView 侧边实时渲染预览，全面对齐 VS Code 官方 Markdown 预览交互直觉。
- **智能活动文本编辑器跟随与图钉锁定 (`omniview.togglePreviewLock`)**:
  - 接入 `onDidChangeActiveTextEditor` 事件，侧边预览自动跟随当前激活的源码文件同步刷新渲染；
  - 在编辑器标题栏新增锁定/跟随切换命令与图标按钮，支持一键锁定 (Pin) 当前预览，防止切换编辑器标签页时内容被冲掉。
- **并排伴侣模式光标焦点保持 (`preserveFocus`)**:
  - 侧边打开预览时默认设置 `preserveFocus: true`，主光标无缝驻留在左侧原生文本编辑器，实现即开即打，无缝享受 GitHub Copilot 与语言服务补全。

### Changed

- **Viewer 操作界面精简与去噪**:
  - 统一所有查看器（PlantUML、代码编辑/只读、结构化数据、思维导图、图表工坊、Markdown 等）的顶部操作入口为「在编辑器中打开」（*Open in Editor*）；
  - 全面清理各 Viewer 源码编辑区内突兀占位的推荐横幅与提示条，恢复清爽纯净的查看与阅读界面；
  - 移除 Markdown 工具栏内重复冗余的原生编辑器直达按钮，统一收纳于操作栏规范位置。

## [0.12.0] - 2026-09-17

### Added

- **并排双向协同流转架构 (`omniview.openSideBySide`)**:
  - 全新命令与右键菜单：在 VS Code 资源管理器与命令面板中新增「OmniView: 打开并排协同 (原生源码编辑 + 实时渲染预览)」，一键自动在当前列开启 VS Code 原生编辑器（无缝享受 Copilot 补全、GitLens 与 LSP 语法提示），并在侧边列开启 OmniView 实时可视化渲染视窗；
  - 默认交互升维 (Full-view First)：图表工作室 (`DiagramStudioShell`) 与思维导图 (`MindmapViewer`) 默认工作模式全面升维为「全屏高清渲染预览 (Eye/Mindmap)」，极大释放画布阅读视界；
  - 沉浸式协同引导：在图表、思维导图、结构化数据查看器、Markdown 工具栏以及多格式插件顶栏中无缝嵌入「在 VS Code 中并排编辑」引导条与直达按钮，消除重复造轮子与内嵌编辑器的局限；
  - 双语国际化支持：补齐并排编辑与原生编辑器跳转的完整中英文翻译条目。

### Changed

- **图表与导图默认模式优化**:
  - `DiagramStudioShell` 默认视图模式调整为 `preview`（纯预览），工具栏重组为「全屏预览 / 内置分屏 / 内置源码」；
  - `MindmapViewer` 默认视图模式调整为 `mindmap`（全屏导图），工具栏重组为「全屏导图 / 内置分屏 / 内置源码」；
  - 持久化配置无损兼容，保留用户自定义偏好记忆。

## [0.11.9] - 2026-09-17

### Added

- **VS Code 原生编辑器无缝协同通道 (`onOpenInEditor` / `omniview.openSource`)**:
  - 全驱引导集成：为所有主流驱动与查看器（Mermaid、Graphviz、PlantUML、Domain Storytelling、代码/文本查看器、结构化数据查看器、Markdown 浮动工具栏）统一新增「在原生编辑器中编辑」直达入口与智能引导条；
  - 深度集成 VS Code 原生文本编辑与 Git/AI 工具链：一键唤起 VS Code 原生文本编辑器，无缝享受 GitHub Copilot、Claude 等 AI 实时补全与 Git Diff / 时间线比对能力；
  - 双向编辑与光标行协同：保留轻量内嵌检视的同时，引导将沉浸式编辑任务交由 VS Code 原生编辑器处理，并通过双向监听机制实时热同步到 OmniView 画布。

## [0.11.5] - 2026-09-15

### Added

- **Markdown 交互式表格工具链 (`TableBlock`)**:
  - 智能悬浮工具栏：表格贴顶吸附、全屏只读检视与多维自适应排版；
  - 表格数据轻量图表化 (`TableChart`)：自动嗅探数值与类别维度列，即时渲染柱状图与折线图；
  - 增强型多态智能排序与内联关键词搜索高亮；
  - 表格数据双向导出：支持一键导出为标准 CSV 与格式化 Markdown。

### Fixed

- **表格全主题无缝融合 (`--ov-table-*`)**:
  - 彻底消除 `TableBlock` 与 `TableChart` 中的硬编码色值与深浅布尔值判断；
  - 补齐并统一 9 大预设主题与 VS Code 原生模式的设计令牌，在深色、浅色、复古 (Sepia) 及第三方主题下达成像素级视觉融合。

### Changed

- **开源协作与文档结构精简**:
  - 精简用户端 `README.md` 与 `README.en.md`，将架构深度分层与安全防护细节解耦归位至 `docs/architecture.md` 与 `SECURITY.md`；
  - 确立开源主干聚合提交规范（Composite Sync Commit Policy），杜绝无上下文的「同步主干分支」模糊日志。

## [0.11.2] - 2026-09-15

### Refactored

- **驱动注册中心架构 (Driver Registry & SPI)**:
  - 新增 `driverRegistry.ts` 插件注册表契约，统一管理 14 种格式驱动的路由与惰性组件工厂；
  - 重构 `ViewerRenderer.tsx` 消除全部硬编码分支，全面践行 OCP 开闭原则与策略模式。
- **Markdown 渲染器架构拆解 (SRP & Pipeline)**:
  - 沉淀 `useMarkdownAstPipeline`（AST 预处理与 Token 分流流水线）；
  - 沉淀 `useMarkdownScrollSync`（双向滚动、光标联动与任务列表回写）；
  - 沉淀 `useDiagramBlockStates`（多图表缩放、视图模式、代码暂存与灯箱状态）；
  - `MarkdownViewer.tsx` 代码规模缩减约 65%，大幅提升可维护性与渲染稳健度。

### Fixed

- CI 上 `check-vsix-contents` 改用 JSZip 读取 VSIX（ZIP），避免 Linux GNU `tar -tf` 误判失败

## [0.11.1] - 2026-09-15

### Fixed

- Markdown 分屏模式下预览与源码双向滚动不同步
- 分屏编辑时父级 content 回写覆盖本地输入，导致光标丢失与内容“飘走”

## [0.11.0] - 2026-09-15

### Added

- **Markdown 扩展语法增强**:
  - GFM / Pandoc 风格真脚注：`[^id]` 引用与 `[^id]:` 定义段（含续行、回跳链接）
  - Obsidian Wiki 链接与嵌入：`[[Page]]` / `[[Page|alias]]` / `[[#Heading]]` / `![[...]]`（图片宽度与笔记预览卡片）
  - Pandoc 定义列表：`Term` + `: Definition`（多 term / 多定义 / 缩进续行）
  - Emoji shortcode：`:rocket:` / `:100:` / `:+1:` 等常用短码映射（代码块内不误替换）
- **Domain Storytelling 领域故事讲授工作台 (`.egn`, `.domainstory`)**:
  - 原生识别与解析标准 egon.io JSON 规范与独立 `.domainstory` 文件；
  - Markdown 深度支持 ````domainstory````、````story````、````egn```` 声明式 DSL 与流式语法；
  - 自动渲染参与者 (Actor)、工作对象 (Work Object) 与业务活动带序号连接箭头；
  - 启发式圈层协作边界 (Groups) 布局与自适应 SVG 拓扑渲染；
  - 集成 `DiagramStepPlayer` 步进播放器，支持单步演播与聚焦高亮；
  - 支持导出标准 `.egn` 与内嵌完整模型的 Polyglot SVG 矢量图，实现图形与源码双向无损互转；
  - 包含丰富独立测试样本与 Markdown 敏捷协同示例。

### Fixed

- VSIX 打包遗漏 webview 静态资源导致 md/pdf 无法打开
- 分屏编辑后保存无法写回磁盘
- Markdown 打印代码行号错位，以及导出 HTML 表格排序箭头残留
- 退出投屏模式后大纲无法再切换显示

## [0.10.1] - 2026-09-13

### Fixed

- Excalidraw 手绘白板画布渲染自愈：新增 `sanitizeExcalidrawElements` 数据清洗层，修复非标准图元缺失 `points` 数组或内部字段导致 Canvas `TypeError: length` 崩溃的问题
- 图元驱动层接入 `@excalidraw/excalidraw` 官方 `restoreElements` 与 `restoreAppState` 标准化修复管线
- 驱动分发层与白板层多级挂载 `RenderErrorBoundary` 错误边界，彻底杜绝异常白屏

### Changed

- 同步项目工程事实与开源文档至 v0.10.1 版本标准

## [0.10.0] - 2026-09-12

### Added

- **Excalidraw 手绘白板工作室 (`.excalidraw`)**: 支持手绘交互白板 (Canvas Studio)、双向分屏 (Split)、矢量只读演示 (Preview) 与 JSON 源码编辑 (Source Code) 四种模式，内置 8 款预置手绘架构模板，支持高清 SVG / PNG / 原生 JSON 导出
- **Jupyter Notebook (.ipynb v4) 交互式数据科学工作台**: 纯端侧解析渲染 Markdown / Code 单元格、富文本输出、ANSI Traceback 高亮与一键导出 Markdown / Python 脚本
- **Typst 现代排版与出版级 AST 编译器引擎 (`.typ`, `.typst`)**: 声明式元数据解析、大纲跳转、物理分页与出版级多页 SVG 渲染生成
- **A4 2.0 工业级出版排版与高精度打印引擎**: 动态页眉页脚宏变量解析（`{{page}}`, `{{totalPages}}`, `{{title}}`, `{{date}}`）、标准 `@page` 打印规则生成与双面装订线 Gutter Margin 奇偶页交替
- **Google OKF (Open Knowledge Format) 智能知识卡片**: 原生支持 `.okf` 文件与 Markdown Frontmatter OKF 元数据智能提取
- **VS Code 双向光标与滚动同步 (Scroll Sync)**: 节点内部线性插值与边界平滑对齐

## [0.9.23] - 2026-09-11

### Added

- Markdown 长文重块视口懒挂载（代码 / 表格 / 图表 / 公式）
- Markdown 演示模式：隐藏大纲与状态栏，空格/方向键按章节翻页，Esc 退出

## [0.9.22] - 2026-09-11

### Changed

- Markdown 渲染效率：壳层 memo 隔离、Mermaid 改为块内按需编译（不再串行阻塞首屏）、CodeBlock 高亮缓存、滚动 spy rAF 节流

## [0.9.21] - 2026-09-11

### Added

- Markdown 顶部「…」菜单新增「设置」入口，可打开与工作台一致的偏好配置弹窗

### Fixed

- Markdown 表格悬停工具栏与图表/图片工具栏对齐：贴顶全宽毛玻璃覆盖，不挤占正文

## [0.9.20] - 2026-09-11

### Fixed

- Markdown 表格悬停工具栏改为绝对定位悬浮覆盖，不再进入文档流挤占正文空间

## [0.9.19] - 2026-09-11

### Added

- 开源协作文档：`CONTRIBUTING.md`、`SECURITY.md`、`docs/README.md`
- 本 Changelog
- Markdown 文档大纲支持「列表 / 树形」展示切换（树形可折叠，当前章节路径自动展开）

### Fixed

- Markdown 搜索高亮：鼠标移出查询框触发工具栏重渲染后，正文着色不再丢失

### Changed

- Markdown 工具栏：窄宽度下视图模式（预览/分屏/源码/思维导图）仅显示图标
- Markdown 工具栏：右侧操作按钮间距与内边距收紧
- 完善文档与贡献流程说明（对外文档与内部工程约定分离）

## [0.9.18] - 2026-09-11

### Added

- 多格式 VS Code Custom Editor 与侧边预览工作台（Markdown / Mermaid / PlantUML / Graphviz / Markmap / SVG / PDF / CSV·TSV / JSON·YAML·TOML·XML 等）
- Markdown 增强：KaTeX、交互表格、灯箱、块级错误边界与大纲检索
- 结构化数据 Studio：树 / 导图 / 表格 / 拓扑 / 脱敏 / 本地跨格式互转
- SVG Studio、PDF.js 阅读器、Mindmap 双向编辑等专业视口
- 离线优先渲染与 DOMPurify 安全清洗链路
- `examples/` 多格式示例集与 `npm run verify` 全量门禁

### Notes

- 早期迭代未按本文件逐条归档；自 `0.9.18` 起以此 Changelog 为权威发布记录。

[Unreleased]: https://github.com/fsyyzz/OmniView/compare/v0.13.0...HEAD
[0.13.0]: https://github.com/fsyyzz/OmniView/compare/v0.12.3...v0.13.0
[0.12.3]: https://github.com/fsyyzz/OmniView/compare/v0.12.0...v0.12.3
[0.12.0]: https://github.com/fsyyzz/OmniView/compare/v0.11.9...v0.12.0
[0.11.9]: https://github.com/fsyyzz/OmniView/compare/v0.11.5...v0.11.9
[0.11.5]: https://github.com/fsyyzz/OmniView/compare/v0.11.2...v0.11.5
[0.11.2]: https://github.com/fsyyzz/OmniView/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/fsyyzz/OmniView/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/fsyyzz/OmniView/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/fsyyzz/OmniView/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/fsyyzz/OmniView/compare/v0.9.23...v0.10.0
