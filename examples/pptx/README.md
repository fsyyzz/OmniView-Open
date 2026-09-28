# OmniView PowerPoint (.pptx) 示例演示文稿

本目录包含 OmniView 针对微软 PowerPoint (.pptx / OOXML 演示文稿) 规范的标准示例文件。

## 📊 包含文件

- **`omniview-tech-presentation.pptx`**: OmniView 技术演播高保真示例文档。
  - **OOXML 结构**: 遵循标准 PresentationML 规范（包含 `ppt/presentation.xml`、`ppt/slides/slide1~3.xml`、`ppt/theme/theme1.xml` 等）。
  - **幻灯片内容**:
    - **Slide 1 (封面页)**: 16:9 宽屏比例、大标题、副标题、品牌主色矢量装饰圆角矩形。
    - **Slide 2 (架构特性与图文页)**: 包含内嵌图片引用 (`image1.png`)、项目符号列表、矢量色块卡片。
    - **Slide 3 (数据对比与矩阵页)**: 包含标准 3x3 格式化数据表格、单元格文字与背景着色。
  - **验证场景**: 用于测试 OmniView 的 PPTX 矢量幻灯片渲染工作台、多页缩略图导航、全屏演播播放器与快捷键翻页切换。
