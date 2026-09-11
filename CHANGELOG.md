# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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
