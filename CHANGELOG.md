# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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

[Unreleased]: https://github.com/fsyyzz/OmniView/compare/v0.9.20...HEAD
[0.9.20]: https://github.com/fsyyzz/OmniView/compare/v0.9.19...v0.9.20
[0.9.19]: https://github.com/fsyyzz/OmniView/compare/v0.9.18...v0.9.19
[0.9.18]: https://github.com/fsyyzz/OmniView/releases/tag/v0.9.18
