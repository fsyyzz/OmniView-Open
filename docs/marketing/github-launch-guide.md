# OmniView GitHub 曝光与开源推广实战指南 (GitHub Launch & Visibility Guide)

> **文档标识:** `docs/marketing/github-launch-guide.md`  
> **用途:** 提供即抄即用的多渠道宣发文案、GitHub SEO 配置建议与开源社区推广行动清单。

---

## 1. GitHub 仓库基础配置 (立即前往 GitHub 仓库设置)

### 1.1 About 简介与主页
- **Description**:  
  `⚡ 纯离线、高性能的 VS Code 全能文件视窗与 Web 工作台。支持 18+ 格式：Office 三件套 (DOCX/PPTX/XLSX)、Markdown、PDF、EPUB、Typst、Mermaid、PlantUML、Graphviz、Excalidraw、结构化配置与数据网格。`
- **Website URL**:  
  填写在线演示地址：`https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app`
- **Include in home**: 勾选 `Releases`, `Packages`

### 1.2 Repository Topics 标签库 (复制粘贴到 Topics 输入框)
```text
vscode-extension, markdown-viewer, office-viewer, docx-viewer, pptx-viewer, xlsx-viewer, pdf-viewer, epub-reader, typst, mermaid, plantuml, graphviz, excalidraw, mindmap, csv-viewer, react19, developer-tools, offline-first
```

### 1.3 Social Preview 社交预览卡片
- 前往仓库 `Settings` -> `General` -> `Social preview`；
- 上传 `docs/assets/omniview-showcase.png` 作为封面图（1280x640px 黄金比例）。

---

## 2. 核心周刊与优质开源平台投稿模版 (直接复制提交)

### 2.1 阮一峰《科技爱好者周刊》投稿模板
- **投稿入口**: [ruanyf/weekly/issues](https://github.com/ruanyf/weekly/issues) -> 提交新 Issue
- **标题**: `开源推荐：OmniView - 纯前端离线的 VS Code 全能文件视窗与排版工作台`
- **正文草稿**:
  ```markdown
  ### 项目介绍

  - **项目名称**：OmniView
  - **项目地址**：https://github.com/your-org/omniview
  - **在线体验**：https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app
  - **技术栈**：React 19 + TypeScript + Vite 6 + Tailwind CSS v4

  ### 解决的核心痛点

  很多开发者在 VS Code 中查看非纯代码文件时，经常面临两大痛点：
  1. 插件碎片化：为了看 Word、PPT、Excel、PDF、EPUB、Mermaid、PlantUML、Graphviz、白板，往往需要安装十几个不同插件，臃肿且经常弹收费提示；
  2. 格式复制崩溃：写完包含公式、图表、表格的技术文档，复制到 Microsoft Word 或 WPS 时，边框发黑、图片丢失或排版错乱。

  ### 核心特性

  1. **18+ 文件格式统一驱动**：内置微内核架构，单插件支持 Office 三件套（DOCX/PPTX/XLSX 纯离线解析）、Markdown 增强、PDF/EPUB 电子书阅读、Typst 现代排版、Excalidraw 白板与矢量 SVG Studio；
  2. **独家 Word/WPS 剪贴板清洗**：一键将 Markdown 复制到 Word，图表自动内联光栅化为 300+ DPI 极清图片，表格规整为 Word 原生双列表格，彻底消除排版变形；
  3. **100% 纯前端离线与安全脱敏**：不发起外部请求，零远端依赖，JSON/YAML 配置文件支持一键投影为思维导图与服务依赖拓扑图，密钥自动脱敏；
  4. **全主题自适应**：100% 依托 `--ov-*` 设计令牌吸附 VS Code 宿主原生色值，支持夜间高对比度与 60 FPS 丝滑稳帧。
  ```

---

### 2.2 HelloGitHub 月刊推荐申请
- **投稿入口**: [HelloGitHub 官网 / 提交项目](https://hellogithub.com/)
- **推荐类别**: `开发工具 / VS Code 插件`
- **一句话介绍**:  
  `一款纯前端离线、全格式增强的 VS Code 文件可视化工作台与插件，支持 Office、Markdown、PDF、图表等 18+ 格式。`
- **详细描述**:  
  `OmniView 基于 React 19 构建，采用微内核驱动模型。它不仅能让开发者在 VS Code 中免安装外部环境秒开 DOCX、PPTX、XLSX、EPUB，还独创了同步剪贴板清洗流水线，完美解决 Markdown 图文复制到 Word 格式散架的历史难题。全链路离线可用，代码规范完备，包含 46 组自动化测试。`

---

### 2.3 V2EX “分享创造” 节点发帖草稿
- **发帖节点**: `create` (分享创造)
- **标题**: `做了一款纯前端离线的 VS Code 全能文件视窗 OmniView，支持 Office、Markdown、图表等 18+ 格式，告别装十个插件`
- **正文草稿**:
  ```markdown
  各位 V 友大家好！

  在平时写代码和做架构设计时，经常需要在 VS Code 里看各种 PRD 需求文档（.docx）、数据报表（.xlsx）、演示幻灯片（.pptx）、架构时序图（Mermaid/PlantUML/Graphviz）以及接口配置（YAML/JSON）。

  过去往往要在 VS Code 里装 8~10 个独立扩展，不仅各个插件 UI 风格割裂，很多还经常弹窗提示需要付费或要求联网上传文件，存在隐私泄漏风险。

  为了彻底解决这些痛点，我用 React 19 + TypeScript 打造了 **OmniView**。

  🔗 GitHub 地址：https://github.com/your-org/omniview
  ⚡ 免安装 Web 在线 Demo：https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app

  ✨ 核心亮点：
  1. 【18+ 格式一站式支持】：无需装十个插件，Office 三件套、PDF、EPUB、Typst、Markmap 思维导图、Excalidraw 白板、Jupyter Notebook 均可就地秒开；
  2. 【纯前端离线解包】：采用纯端侧 OOXML 与 WASM 架构，零网络请求，企业敏感配置与密钥自带遮罩脱敏；
  3. 【独家剪贴板清洗】：写好的技术文档一键复制进 Word/WPS，图表自动转为 300+ DPI 极清图，表格转为 Word 原生双列表格，排版绝不塌陷；
  4. 【原生主题融合】：完全适配 VS Code 深色/浅色及第三方主题，60 FPS 丝滑滚动。

  代码已完全开源（MIT 协议），欢迎大家试用、拍砖或提出想支持的新文件格式！如果觉得好用，求顺手点个 Star 支持一下 ⭐！
  ```

---

### 2.4 Hacker News / Reddit (Show HN / r/vscode) 国际英文推广
- **发布节点**: `Hacker News (news.ycombinator.com)` -> Submit `Show HN`  
  或 Reddit: `r/vscode`, `r/webdev`
- **Title**: `Show HN: OmniView – Offline-first multi-format viewer for VS Code & Web`
- **URL**: `https://github.com/your-org/omniview`
- **Text / Pitch**:
  ```text
  Hi HN! I built OmniView, a pure client-side, offline-first visualization workbench and VS Code extension.

  Instead of installing a dozen disparate extensions (often heavy, inconsistent in UI, or relying on remote services), OmniView provides a unified microkernel supporting 18+ formats out of the box:
  - Office trio (DOCX, PPTX, XLSX) decoded entirely in-browser/webview
  - Markdown with KaTeX, Mermaid, PlantUML, and Graphviz
  - Proprietary clipboard pipeline: copying Markdown to Microsoft Word preserves formatting with rasterized 300+ DPI diagrams and clean native tables
  - PDF, EPUB flow reader, Typst typesetting, Excalidraw whiteboard, and Jupyter Notebooks
  - Structured Data (JSON/YAML) projected into SVG mindmaps and container topologies with auto-secret masking

  Stack: React 19, TypeScript, Vite 6, Tailwind CSS v4, and web assembly.

  Live web demo: https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app
  Repo: https://github.com/your-org/omniview

  Would love to hear your feedback on performance and ideas for additional format drivers!
  ```

---

## 3. GitHub 持续运营节奏建议

1. **每发布新版本**:
   - 运行 `npm run package:vsix` 生成 `.vsix` 文件；
   - 在 GitHub Releases 页面创建 Release，上传 `.vsix` 文件，并附带 1 张新特性的动图演示；
2. **提交 Awesome Lists**:
   - 向 `vstirbu/awesome-vscode` 提交 PR，将 OmniView 添加到 `Viewers & Tools` 分类；
   - 向 `enaqx/awesome-react` 提交 PR。
