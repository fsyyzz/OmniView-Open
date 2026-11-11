# OmniView

**中文** | [English](./README.en.md)

<p align="left">
  <a href="https://marketplace.visualstudio.com/items?itemName=zhouzan.omniview"><img src="https://img.shields.io/visual-studio-marketplace/v/zhouzan.omniview?style=flat-square&color=blue&logo=visual-studio-code" alt="Marketplace Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="./docs/architecture.md"><img src="https://img.shields.io/badge/Tests-101%20Passing-brightgreen?style=flat-square" alt="Tests" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Offline-100%25-orange?style=flat-square" alt="100% Offline" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.7+-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" /></a>
</p>

> OmniView 是一个专为开发者打造的**多格式文件可视化与编辑工作台**，同时提供 **VS Code 扩展**与**独立 Web 应用**两种使用方式。基于 React 19、TypeScript 与 Vite 构建，开箱支持文档、图表、思维导图、白板、现代办公、云原生清单与配置等 **23+ 种格式的 100% 本地离线高保真渲染**。

<p align="left">
  <a href="https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app"><b>在线体验 (Web Demo)</b></a> ·
  <a href="https://github.com/fsyyzz/OmniView/releases"><b>下载离线 VSIX</b></a> ·
  <a href="./docs/features-capabilities.md"><b>功能全景手册</b></a> ·
  <a href="./docs/architecture.md"><b>系统架构文档</b></a> ·
  <a href="https://github.com/fsyyzz/OmniView/issues"><b>反馈与格式提案</b></a>
</p>

![OmniView Showcase Banner](./docs/assets/omniview-showcase.png)

---

## 为什么选择 OmniView

在 VS Code 中预览各种格式，通常需要安装十几个插件，且多依赖外部网络或各异的主题风格。OmniView 将这些能力收敛于统一的高性能微内核架构：

| 评估维度 | 原生 VS Code | 传统独立插件组合 | OmniView |
| :--- | :--- | :--- | :--- |
| **支持格式** | 仅纯文本 / 代码高亮 | 需分别安装 8~15 个扩展 | **23+ 格式开箱即用**（文档 / 图表 / 导图 / Office / PDF / 云原生等） |
| **网络与隐私** | 离线 | 多数依赖云端渲染或第三方 API | **100% 前端离线计算**，零外部遥测，敏感字段自动脱敏 |
| **Office 三件套** | 不支持 | 依赖外部运行时或本地桌面 Office | **纯前端 OOXML 离线解包**，XLSX 迷你图画像、PPTX 矢量放映 |
| **Markdown 复制到 Word/WPS** | 格式错乱、图片失效、代码无框 | 需手动截图或逐张导出 | **内置剪贴板清洗流水线**，图表自动光栅化为高清图，代码变原生表格 |
| **主题自适应** | 原生跟随 | 各插件 UI 风格割裂 | **14 大渲染主题联动**，深度融合 `--ov-*` 与 VS Code 宿主设计令牌 |
| **超长文档性能** | 良好 | 复杂多图极易卡顿崩溃 | **可卸载懒视口 (`LazyViewportBlock`) 与 FNV-1a 增量脏复用** |

### 典型痛点场景一键解决

1. **技术文档无损复制到 Word / WPS**：清洗悬浮交互杂音，代码块自动转为 Word 原生双列表格，Mermaid / PlantUML / Graphviz 图表自动转换为内联高分辨率位图。
2. **编辑器内秒开 DOCX、PPTX 与 XLSX**：零外部依赖解包，XLSX 支持多工作表、列特征画像统计与迷你图；PPTX 支持 16:9 / 4:3 矢量全屏放映。
3. **复杂配置秒变思维导图与服务依赖拓扑**：JSON / YAML / XML 一键投影为交互式思维导图或微服务拓扑，带 JSONPath 提取与敏感配置脱敏。

---

## 支持格式与能力速览

OmniView 采用统一的驱动路由体系，核心格式分类能力如下（详细技术指标与设计请参阅 **[docs/features-capabilities.md](./docs/features-capabilities.md)**）：

| 领域分类 | 核心支持格式 | 核心能力与特色亮点 |
| :--- | :--- | :--- |
| **专业文档与学术** | **Markdown** (`.md`), **Word** (`.docx`), **PDF** (`.pdf`), **EPUB** (`.epub`), **Typst** (`.typ`), **Jupyter** (`.ipynb`) | • **Markdown**：Mermaid / PlantUML / Graphviz / KaTeX 混排、FNV-1a 增量渲染、块级原地 CRUD 编辑与划选格式化<br>• **Word**：A4 纸张拟真排版、原纸/羊皮纸/夜间三重视效、一键导出 PDF<br>• **PDF**：Mozilla PDF.js v4+ 光栅化内核、光标锚定缩放 (Focal Zoom)、双页跨页阅读<br>• **EPUB**：双叶跨页排版、3D 翻页动效与阅读进度记忆<br>• **Typst**：纯端侧 AST 编译器与 A4 2.0 打印分页排版<br>• **Jupyter**：v4 格式离线解析、执行计数器徽标与 ANSI Traceback 着色 |
| **图表与架构建模** | **DDD 统一视图** (`.ddd`), **Mermaid** (`.mmd`), **PlantUML** (`.puml`), **Graphviz** (`.dot`), **Markmap (Mindmap)** (`.markmap`), **Excalidraw** (`.excalidraw`), **SVG Studio** (`.svg`) | • **DDD 领域建模**：统一 `.ddd` 承载领域故事、事件风暴、上下文映射、核心域投资四象限与战略画布，带多 Group 阶段流横向排布与演播回放<br>• **图表引擎矩阵**：Mermaid 14 主题联动、PlantUML 企业级时序/脑图、Graphviz DOT 7 大 WASM 布局引擎与原生矢量固化器<br>• **Markmap / Mindmap 思维导图**：双向源码分屏与交互式大纲导航<br>• **Excalidraw**：交互手绘白板、容错自愈与预置架构模板<br>• **SVG Studio v2**：不可变文档模型、8 种核心矢量工具与折线手柄演化 |
| **数据与现代办公** | **Excel** (`.xlsx`, `.xls`), **CSV / TSV** (`.csv`, `.tsv`), **PowerPoint** (`.pptx`), **现代图像** (`.png`, `.jpg`, `.webp`, `.gif`, `.svg` 等) | • **Excel**：纯前端解包多工作表、列特征画像 (Data Profiling)、分位数统计与 Sparklines 迷你图<br>• **CSV / TSV**：RFC 4180 容错解析、吸顶表头、快速检索与多列排序<br>• **PowerPoint**：离线解包矢量放映、演讲者备注抽屉与键盘快捷切页<br>• **图像与取色器**：10%~3200% 平滑缩放、16x 悬浮放大镜取色器与 EXIF 元数据提取 |
| **云原生与配置** | **Dockerfile**, **Docker Compose** (`.yml`), **Kubernetes** (`.yaml`), **结构化数据** (`.json`, `.yaml`, `.toml`, `.xml`), **HTML5** (`.html`) | • **Dockerfile**：多阶段构建 DAG 依赖流向、指令分层分类透视与最佳实践静态体检<br>• **Docker Compose**：服务依赖拓扑图谱、网络隔离簇、卷挂载关系与敏感字段脱敏<br>• **Kubernetes 清单**：四层引力拓扑图、跨资源 Selector 自动连线与探针断链体检<br>• **结构化数据**：JSON ⇄ YAML ⇄ TOML ⇄ XML 离线双向互转与思维导图投影<br>• **HTML5 沙箱**：受控双层 iframe 隔离沙箱、桌面/平板/手机多视口切换与分屏协同 |

> [!TIP]
> 查阅更详细的各格式深层技术参数、生命周期契约与架构演进：
> - 📖 **[功能全景与能力评估手册 (docs/features-capabilities.md)](./docs/features-capabilities.md)**
> - 🛠️ **[格式驱动设计与生命周期规范 (docs/design/viewer-drivers.md)](./docs/design/viewer-drivers.md)**
> - 📐 **[Markdown 渲染流水线与原地编辑规范 (docs/design/markdown-pipeline.md)](./docs/design/markdown-pipeline.md)**

---

## 快速开始

### 本地开发与体验

```bash
# 1. 克隆仓库并安装依赖
git clone https://github.com/fsyyzz/OmniView.git
cd OmniView
npm install

# 2. 启动本地开发调试服务器 (默认运行于 http://localhost:3000)
npm run dev
```

### 自动化测试与工程门禁

```bash
# 运行 101 套单元测试与格式驱动验证套件
npm test

# 运行完整物理门禁与工程构建（含 TypeScript 类型检查、Codex Linter、文档一致性与架构校验）
npm run verify
```

### 用户设置与状态持久化

OmniView 内置跨版本配置迁移与状态持久化体系（`settingsStorage`）：
- **工作区与全局设置持久化**：主题风格、字号排版、分屏比例、大纲状态与多语言偏好自动保存至 VS Code 全局或工作区配置；
- **渲染状态与编辑缓存**：离线状态下自动持久化编辑快照与缩放平移视图，下次打开无缝恢复现场。

### 构建与打包 VS Code 插件 (VSIX)

```bash
# 1. 运行全量构建
npm run build:plugin

# 2. 打包生成离线 VSIX 插件安装包
npm run package:vsix

# 3. 安装到本地 VS Code 编辑器
code --install-extension omniview-1.4.44.vsix --force
```

安装完成后，在 VS Code 资源管理器中右键任意支持的文件，选择 **“使用 OmniView 打开”**，或在编辑器右上角点击 **“在侧边打开预览”**。

---

## 文档导航

所有深层架构、设计方案与规范均收敛在 [`docs/`](./docs) 目录：

| 文档路径 | 核心内容 |
|---|---|
| [`docs/README.md`](./docs/README.md) | **技术文档总索引**：docs 目录架构图谱与阅读路径导航 |
| [`docs/architecture.md`](./docs/architecture.md) | **系统架构设计规范**：系统分层、IPC 双向通信、安全沙箱与物理门禁体系 |
| [`docs/features-capabilities.md`](./docs/features-capabilities.md) | **功能全景与能力评估手册**：23+ 格式深度规格、六维评估雷达与技术参数 |
| [`docs/design/viewer-drivers.md`](./docs/design/viewer-drivers.md) | **格式驱动设计规范**：驱动生命周期、Props 契约与容错自愈策略 |
| [`docs/design/markdown-pipeline.md`](./docs/design/markdown-pipeline.md) | **Markdown 渲染流水线**：增量 Diff、原地 CRUD 引擎与 Word 剪贴板清洗 |
| [`docs/design/svg-v2-editor.md`](./docs/design/svg-v2-editor.md) | **SVG v2 矢量编辑引擎**：不可变文档模型、命令管线与折线演化体系 |
| [`docs/design/cloud-native-viewers-plan.md`](./docs/design/cloud-native-viewers-plan.md) | **云原生驱动架构**：Dockerfile、Compose 与 K8s 拓扑引擎设计 |
| [`docs/design/persistence-storage.md`](./docs/design/persistence-storage.md) | **持久化与存储子系统**：配置 Schema v2、跨版本迁移与安全钳位 |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | **开源贡献指南**：分支规范、Conventional Commits 与门禁要求 |
| [`SECURITY.md`](./SECURITY.md) | **安全策略**：漏洞披露通道与安全应急响应流程 |
| [`CHANGELOG.md`](./CHANGELOG.md) | **版本变更记录**：遵循 Keep a Changelog 规范的发布日志 |

---

## 开源样例

OmniView 在 [`examples/`](./examples) 目录提供了涵盖各种格式的测试样例，详见 [`examples/README.md`](./examples/README.md)。

## 开源许可证

本项目基于 [MIT License](./LICENSE) 开源。欢迎提交 [Issues](https://github.com/fsyyzz/OmniView/issues) 反馈建议，或阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 参与共建。
