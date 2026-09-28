# OmniView Word (.docx) 示例文档

本目录包含 OmniView 针对微软 Word (.docx / OOXML) 规范的标准示例文件。

## 📄 包含文件

- **`omniview-architecture-guide.docx`**: OmniView 架构指南高保真示例文档。
  - **OOXML 结构**: 遵循标准 Office Open XML 规范（包含 `[Content_Types].xml`、`word/document.xml`、`docProps/core.xml` 等）。
  - **排版要素**: 包含大标题、副标题、多级大纲标题（Heading 1、Heading 2）、带样式的规格对比表格（3列矩阵）、列表与段落。
  - **验证场景**: 用于测试 OmniView 的 DOCX 只读渲染引擎、A4 拟真分页排版、左侧导航大纲（Navigation Pane）自动提取与跳转、以及原纸/羊皮/暗夜主题切换。
