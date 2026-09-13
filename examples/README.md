# OmniView 全格式示例文件集 (Comprehensive Example Suite)

本目录包含 OmniView 所支持全部 **15+ 种工程与研发文件格式** 的高保真测试与演示样本，用于验证 VS Code 插件与独立 Webview 工作台的多格式解析、智能驱动路由、矢量渲染、分屏联动与导出能力。

---

## 📂 格式与目录全景索引表

| 目录 | 支持格式后缀 | 核心驱动引擎 | 典型功能特性 |
| --- | --- | --- | --- |
| **[excalidraw/](./excalidraw/)** | `.excalidraw`, `.excalidraw.json` | Excalidraw Utils + Canvas | 手绘风格白板、多图元自愈清洗、分屏双向联动、SVG/PNG 导出 |
| **[notebook/](./notebook/)** | `.ipynb` | Jupyter nbformat v4 + KaTeX | 数据科学 Notebook、Markdown 说明、ANSI 彩色流、表格与输出 |
| **[typst/](./typst/)** | `.typ`, `.typst` | Typst AST + KaTeX + SVG | 现代学术出版排版、A4 出版级多页流、数学公式、大纲跳转 |
| **[markdown/](./markdown/)** | `.md`, `.markdown` | marked + GFM + Callout | GitHub 语义提醒块、交互式 Task List、内嵌图表与数学公式 |
| **[okf/](./okf/)** | `.okf`, `*.okf.md` | Google OKF Engine | 知识图谱模型、指标实体卡片、跨表关联与元数据解析 |
| **[mermaid/](./mermaid/)** | `.mmd`, `.mermaid` | Mermaid.js v11+ | 独立流程图、时序图、用户旅程图、状态机双向实时编辑 |
| **[plantuml/](./plantuml/)** | `.puml`, `.plantuml`, `.iuml` | PlantUML AST + SVG | 独立架构建模、组件拓扑、时序图与状态图实时编译 |
| **[graphviz/](./graphviz/)** | `.dot`, `.gv` | `@hpcc-js/wasm-graphviz` | Web Worker WASM 离线有向图拓扑、网络依赖分析 |
| **[svg/](./svg/)** | `.svg` | Native Chromium + DOMPurify | 高精度矢量图形查看器、标尺网格、10%-500% 平移缩放 |
| **[pdf/](./pdf/)** | `.pdf` | Mozilla PDF.js v4+ Worker | 多页真实 PDF 光栅化、翻页缩放、双页排版与全文选词 |
| **[csv/](./csv/)** | `.csv` | Virtual Data Grid | 逗号分隔表格、多列排序、模糊搜索、统计汇总 |
| **[tsv/](./tsv/)** | `.tsv` | Virtual Data Grid | 制表符分隔遥测数据、高密度大宽表浏览 |
| **[json/](./json/)** | `.json` | Prism.js Syntax Engine | OpenAPI 规范、package.json、语法着色与格式化 |
| **[yaml/](./yaml/)** | `.yaml`, `.yml` | Prism.js Syntax Engine | Kubernetes 声明式配置、云基础设施编排 |
| **[xml/](./xml/)** | `.xml` | Prism.js Syntax Engine | Maven POM 依赖定义、企业级服务配置 |
| **[code/](./code/)** | `.ts`, `.tsx`, `.js`, `.txt` | Prism.js Syntax Engine | 响应式状态机、React 组件、纯文本设计规范 |
| **[markmap/](./markmap/)** | `.markmap`, `.mm`, `.km`, `.mindmap` | Markmap Lib + D3 Tree | 树形大纲思维导图、FreeMind XML、KityMinder JSON、节点折叠 |

---

## 🎯 推荐验证路径

1. **白板与数据科学**：
   - 打开 `excalidraw/architecture-sketch.excalidraw` 体验手绘矢量白板与画布交互；
   - 打开 `notebook/deep-learning-analysis.ipynb` 体验交互式数据科学单元格；
   - 打开 `typst/quantum-computing-paper.typ` 体验现代出版级 A4 多页排版。
2. **独立图表引擎**：
   - 打开 `mermaid/user-journey.mermaid`、`plantuml/component-diagram.iuml`、`graphviz/dependency-graph.gv`。
3. **数据表格与代码**：
   - 打开 `csv/performance-benchmarks.csv` 与 `tsv/microservices-slo-telemetry.tsv` 体验数据网格；
   - 打开 `json/rest-api-v1-spec.json` 与 `yaml/k8s-cluster-deployment.yaml` 体验结构化高亮。

