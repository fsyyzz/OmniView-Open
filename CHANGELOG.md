# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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
