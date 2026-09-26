# OmniView

**中文** | [English](./README.en.md)

<p align="left">
  <a href="https://marketplace.visualstudio.com"><img src="https://img.shields.io/visual-studio-marketplace/v/omniview.omniview?style=flat-square&color=blue&logo=visual-studio-code" alt="Marketplace Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="./docs/architecture.md"><img src="https://img.shields.io/badge/Tests-80%2B%20Passing-brightgreen?style=flat-square" alt="Tests" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Offline-100%25-orange?style=flat-square" alt="100% Offline" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.7+-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" /></a>
</p>

> **OmniView** 是一款面向 VS Code 场景与 Web 现代工作流的高性能、全格式多维文件可视化工作台与插件。基于 React 19、TypeScript、Vite 6 与 Tailwind CSS v4 构建，秉承“**把数据升维为视窗，让排版化繁为简**”的哲学，提供从文档、图表、思维导图、矢量设计、数据网格、云原生清单到结构化配置的全景沉浸式渲染能力。

<p align="left">
  <a href="https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app"><b>⚡ 在线免安装体验 (Web Live Demo)</b></a> ·
  <a href="https://github.com/your-org/omniview/releases"><b>📦 离线 VSIX 下载</b></a> ·
  <a href="./docs/architecture.md"><b>📖 系统架构设计文档</b></a> ·
  <a href="https://github.com/your-org/omniview/issues"><b>💡 反馈与新格式提案</b></a>
</p>

![OmniView Showcase Banner](./docs/assets/omniview-showcase.png)

---

## 💡 为什么选择 OmniView？(Why OmniView?)

告别在 VS Code 里安装十几个碎片、臃肿且常弹收费提示的单一插件！OmniView 采用统一微内核设计，实现 **22+ 核心格式统一步调、100% 纯前端离线、像素级宿主主题吸附与 60 FPS 丝滑稳帧**。

| 评估维度 / 场景痛点 | 原生 VS Code | 传统独立插件组合 | **OmniView** |
| :--- | :--- | :--- | :--- |
| **支持文件格式** | 仅纯文本/代码着色 | 需碎片化安装 8~12 个扩展 | **21+ 格式开箱即用** (Cloud-Native/TOML/Office/PDF/EPUB/Typst/图表/导图/白板/数据) |
| **网络与隐私安全** | 离线 | 多数依赖外部云端或收费 API | **100% 纯前端离线**，零云端调用，企业密钥自动脱敏 |
| **Office 三件套 (DOCX/PPTX/XLSX)** | 不支持 | 需安装复杂庞大的外部运行时 | **纯端侧 OOXML 解包**，支持 XLSX 标签页与画像、PPTX 矢量放映 |
| **Markdown 复制到 Word / WPS** | 边框全黑、图片变红叉、排版崩塌 | 需逐张手动导出图片或截图插入 | **独家同步剪贴板双通道清洗**，矢量图自动光栅化为 300+ DPI 极清图 |
| **主题与视觉融合** | 原生跟随 | 各插件 UI 风格迥异割裂 | **100% 自动吸附 `--ov-*` 与 VS Code 宿主设计令牌** |
| **超长文档内存与流畅度** | 优秀 | 复杂图表容易引起卡顿与布局抖动 | **可卸载懒视口 (`LazyViewportBlock`) 与 FNV-1a 增量脏复用** |

### 🎯 三大高频工程师痛点击穿

1. 📋 **“写完技术文档，复制到 Word 向领导/客户汇报时格式不再崩塌”**  
   独家剪贴板清洗流水线，过滤交互悬浮条与 Tailwind 冗余边框，代码转为标准 Word 原生双列表格，Mermaid/PlantUML/Graphviz 图表自动转换为内联 300+ DPI 极清 PNG。
2. 🚀 **“在编辑器内轻盈秒开 DOCX 需求文档、PPTX 幻灯片与 XLSX 报表”**  
   基于纯前端离线解包管道，XLSX 支持多工作表切换、列画像统计 (Profiling) 与迷你图；PPTX 矢量画布自适应 16:9 / 4:3 沉浸放映。
3. 🌲 **“数百行微服务配置与长 JSON 终于不用肉眼逐层排查”**  
   一键将 JSON/YAML/XML 升维为交互式思维导图与云原生服务依赖拓扑图，带密钥自动脱敏遮罩与 JSONPath 快速提取。

---

## 🌟 核心功能矩阵 (Feature Matrix)

### 1. 结构化数据全景可视化工作台 (Structured Data Studio)
针对 **JSON、YAML、TOML、XML** 格式，拒绝同质化纯文本卷入，原生提供“多态立体投影”能力：
- **交互式层级结构树 (Tree View)**:
  - 智能类型色彩映射（String/Number/Boolean/Null/Object），带数组/对象项数徽标与层级深度连接线；
  - 支持一键展开全部/折叠至首层，支持针对 Key / Value 的结构感知全文实时检索；
  - **KeyPath 路径检视器**: 点击任意节点自动解析并复制标准 JSONPath（如 `$.services.web.ports[0]`），排查定位提效十倍。
- **全景思维导图投影 (Mindmap Projection)**:
  - 零配置将深层嵌套结构无损升维为层次分明的交互式矢量思维导图；
  - 支持无限平移缩放、节点分级折叠展开、快捷大纲导航与高清 SVG 导出。
- **同构数组智能下钻 (Array to Interactive Table & Chart)**:
  - 自动嗅探根节点或首层同构对象数组（如 `cluster_nodes`、`items`、`users`），一键无缝下钻至交互式数据表格；
  - 表格原生具备吸顶表头、多态排序、全文过滤与**一键升维为柱状/折线微图表**能力。
- **云原生服务依赖拓扑图 (Topology View)**:
  - 自动检测 Docker Compose 或微服务编排中的 `services`、`depends_on`、`ports` 与网络流向；
  - 自动生成清晰的微服务依赖调用拓扑架构图，调用链路一目了然。
- **敏感密钥脱敏防护 (Secret Masking)**:
  - 内置智能安全特征引擎，自动探测 `password`、`token`、`secret`、`jwt`、`api_key` 等敏感字段；
  - 一键在【脱敏遮罩】（悬浮临时查看原值）与【明文模式】间丝滑切换，投屏分享、会议演示与截图绝对杜绝密钥泄露。
- **跨格式离线无损互转工作台 (Format Converter)**:
  - 支持在 **JSON ⇄ YAML ⇄ TOML ⇄ XML** 之间双向实时互转；
  - 支持美化缩进 (Pretty) 与紧凑压缩，支持一键复制代码或直接下载转换文件；
  - **100% 本地内存序列化**，不发起任何网络请求，确保企业核心配置绝对安全。

### 2. 深度增强型 Markdown 排版与渲染引擎
- **多引擎图表矩阵集成**:
  - **Mermaid.js**: 支持流程图、时序图、类图、状态机图 (stateDiagram / stateDiagram-v2 具备深浅双主题自适应与高对比度文字防隐形保障)、Git 提交历史图、甘特图、C4 架构图等；
  - **PlantUML**: 支持架构图、时序图、组件图，支持【可视化预览 / 源码编辑】双向热渲染与私有服务地址配置；
  - **Graphviz / DOT**: 原生支持 Markdown 内嵌 ````dot```` 与 ````graphviz```` 代码块，基于 `@hpcc-js/wasm-graphviz` 离线 WebAssembly 引擎与 Web Worker 异步计算；
  - **SVG 矢量图驱动**: 支持内联 ````svg```` 代码块与本地相对路径 `.svg` 引用，支持深色/网格/浅色背景切换；
- **KaTeX 数学与科学公式**:
  - 行内公式 `$E=mc^2$` 与货币价格防误触正则过滤（如 `$100, $5.99` 不被识别为公式）；
  - 块级多行对齐方程组 `$$\int_{-\infty}^{+\infty} e^{-x^2} dx = \sqrt{\pi}$$`；
  - 支持 ````math````、````katex````、````latex```` 代码块直接高保真学术排版；
- **交互式数据表格增强 (Interactive Data Table)**:
  - 自动为所有 Markdown 表格注入吸顶表头与平滑横向滚动容器，杜绝超宽破坏排版；
  - 单元格富文本 Markdown 混合排版，支持行内代码与徽标渲染；
  - **多态智能排序**: 支持字符串拼音/字母排序、纯数值大小排序、带单位数值排序（如 `128MB` vs `2GB`、`15ms` vs `1.2s`）与标准日期时间排序；
  - **列图表化潜能嗅探**: 自动识别数值序列并生成实时柱状图或折线图可视化；
  - 支持表格内容一键复制、导出为标准 CSV 或格式化 Markdown 文本。
- **沉浸式图片/图表灯箱 (Image & Diagram Lightbox)**:
  - 正文图片与图表支持一键全屏或双击快速唤起灯箱；
  - `0.2x ~ 5.0x` 鼠标滚轮平滑缩放、放大拖拽平移 (Pan)、顺时针 90° 旋转、一键复制与无损下载；
- **增量重渲染与视口动态卸载 (Zero CLS & Lazy Viewport)**:
  - **基于 FNV-1a 内容指纹与行号范围复用**: 在局部文本编辑或划词修饰时精准识别脏块并复用未变块对象引用，阻断整篇子树无谓重算；
  - **可卸载型视口内存管理**: 重型图表（Mermaid、Graphviz、KaTeX、宽表）移出视口缓冲时自动卸载释放 DOM 与 WASM 资源，配合全局高度记忆池确保滚动回访 **零布局抖动 (Zero CLS)**；
- **划选悬浮格式化与安全回写契约 (Selection-to-Source Replacer)**:
  - 精准支持加粗 (`**B**`)、行内代码 (`` `C` ``)、超链接 (`Link`) 与双向链接 (`WikiLink`)；
  - 具备行号与上下文文本指纹 (Fingerprint) 双重前置校验，对不上时主动拒绝写入，防止破坏源文档；
- **渲染耗时性能预算与慢块监控 (Render Time Budget)**:
  - 毫秒级单块解析渲染耗时监控，单块超过 800ms 预算门限自动触发源码卡片降级与重试机制，并在大纲目录中打上 `ZapOff` 慢块警示徽章；
- **极限稳定性与错误边界 (RenderErrorBoundary)**:
  - 块级精细隔离，单个图表语法损坏局部展示诊断卡片与一键报错修复建议，**文档其他部分 100% 保持交互，绝不白屏**；
- **高交互目录大纲与实时检索**:
  - 标题节点物理真实挂载，大纲与“跳转到标题”定位 **100% 精准**；
  - 可折叠多级大纲目录，滚动联动感知平滑定位 (Scroll Spy)；
  - 关键词全文搜索与命中高亮导航。

### 3. 思维导图专业套件 (Mindmap Studio)
- 原生支持 `.markmap`、`.mm`、`.mindmap`、`.km` 扩展名与双向实时联动；
- 支持【代码编辑 / 分屏对比 / 纯导图沉浸】三种视图模式，提供 30:70、50:50、70:30 黄金分屏预设与自由拖拽调节；
- 内置 Markdown 语法快捷模板、快捷键支持（Tab / Shift+Tab 缩进控制、Enter 自动续行续级）；
- 缩放、居中自适应定位与高清 SVG 矢量导出。

### 4. SVG 交互式矢量工作台 (SVG Studio)
- 支持图形/代码双栏分屏、纯图形视口与纯代码三种模式；
- **可视化图元点选与微调**: 支持图元点选，实时调节坐标、尺寸、填充色彩、描边、圆角、透明度与旋转变换；
- **自由几何变换**: 8 向控制手柄自由拖拽调整尺寸与等比缩放、网格智能吸附与画布快速对齐；
- **图层管理**: 图元层级快速提升/下移（置顶/置底）；
- **开发者导出套件**: 支持图元行号反向代码定位、SVGO 深度净化去冗余、一键生成 React JSX 组件、Vue 3 组件或 Base64 Data URI。

### 5. EPUB 现代电子书流式阅读器 (EPUB Reader Studio)
- 原生支持 `.epub` 现代电子书标准流式渲染与解包阅读；
- **三重流式阅读形态 (Flow Modes)**:
  - **双叶并排跨页 (Two-Page Spread)**: 采用 CSS Multi-Column 拟真纸质书本并排开本排版，中缝自带书脊立体折痕与光影渐变，极窄屏幕自动降级防护；
  - **单页流式分页 (Single-Page Flow)**: 优雅单栏居中留白，配合悬浮翻页热区与方向键/空格快捷翻页；
  - **连续流式滚动 (Continuous Scroll)**: 纵向自然平滑流式阅读，支持章节底栏自动切换与滚动百分比感知；
- **3D 拟真翻书微光效 (Page Flip Effect)**: 具备 GPU 硬件加速的 3D 页面翻转物理光影过渡动效，可根据偏好随时一键开关；
- **排版偏好与阅读进度持久化 (`epubSettingsStorage`)**: 支持点击切换字号大小 (A-/A+)、字体族（宋体/黑体/楷体/等宽）、两字符首行缩进、两端对齐/靠左对齐、行距倍率（1.5x/1.75x/2.0x）、版心宽度（标准/宽幅/全幅）、护眼阅读主题（自动/羊皮纸/明亮/夜间）与书籍专属阅读进度（章节、页码、百分比）无感自动持久化。

### 6. PDF 现代阅读器 (Modern PDF Reader)
- 基于 Mozilla PDF.js v4+ 内核驱动，支持真实二进制 PDF 解析与 Canvas 高清渲染；
- **三重视图排版**: 多页连续流式瀑布流 (Continuous Flow)、单页居中翻页与双页图书并排开本；
- **阅读感知**: 视口滚动联动阅读进度感知 (Scroll Spy)、视口懒渲染防卡顿 (Lazy Viewport)；
- **批注与检索**: 全文跨页检索高亮、多级大纲书签树、划词高亮批注与 Markdown 格式导出、无损快照 PNG 导出与打印。

### 7. Excalidraw 手绘白板工作室 (Excalidraw Whiteboard Studio)
- 原生支持 `.excalidraw` 手绘工程文件解析与交互；
- **四重工作模式**: 交互白板 (Canvas Studio)、双向分屏 (Split)、矢量只读演示 (Preview) 与 JSON 源码编辑 (Source Code)；
- **数据自愈与容错**: 内置 `sanitizeExcalidrawElements` 与 `restoreElements`，自动修补异常图元字段并提供多级错误边界；
- **预置模板与导出**: 内置系统架构、微服务调用、敏捷看板等 8 大预置模板，支持高清 SVG、PNG 及 `.excalidraw` 原生文件导出。

### 8. Typst 现代学术与出版排版 (Typst Studio & A4 2.0)
- 基于轻量纯端侧 AST 编译器与 A4 2.0 工业级出版排版引擎，原生支持 `.typ` 与 `.typst` 文件；
- **出版级排版能力**: 标题大纲抽取、物理分页符、多页 SVG 连续流式渲染、KaTeX 矢量公式排版与中文字宽防重叠优化；
- **A4 2.0 高精度打印**: 动态页眉页脚宏变量（`{{page}}`, `{{totalPages}}`, `{{title}}`, `{{date}}`）、双面装订线 Gutter Margin 奇偶页交替与标准 `@page` 打印规则。

### 9. Jupyter Notebook (.ipynb v4) 交互式数据科学工作台
- 纯前端离线解析渲染 Jupyter Notebook v4 文件结构；
- 完整支持 Markdown 叙事单元格、Python 代码单元格高亮、执行计数器徽标、富文本多格式输出与 ANSI Traceback 语法高亮转换；
- 支持一键将整本 Notebook 导出为标准 Markdown 文档 (`.md`) 或纯 Python 脚本 (`.py`)。

### 10. CSV / TSV 智能数据表格与分析
- 符合 RFC 4180 规范的超轻量健壮解析引擎，支持双引号转义、跨行单元格与参差列宽归一化；
- 全局关键字模糊过滤、多列排序、分页浏览、统计概览与数据导出。

### 11. Google OKF (Open Knowledge Format) 智能知识卡片
- 原生识别 `.okf` 文件及 Markdown Frontmatter OKF 元数据头；
- 智能抽取 Knowledge ID、版本标签、分类 Tags 与知识摘要并渲染为交互式知识卡片。

### 12. Word (.docx) 高保真文档渲染器 (Modern Word Viewer)
- 基于 OOXML 标准与 `docx-preview` 纯前端离线流水线，支持 A4 拟真纸张排版与连续滚动；
- 50% ~ 200% 平滑缩放、复杂表格单元格合并与边框底纹、多级编号、嵌入图片与页眉页脚；
- 支持原纸、羊皮纸与夜间暗色反转三重视效切换，支持一键系统打印与 PDF 导出。

### 13. PowerPoint (.pptx) 矢量幻灯片演播工作台 (Modern PowerPoint Viewer)
- 纯离线 OOXML 形状与资源解包，支持 16:9 / 4:3 矢量自适应画布与居中等比缩放；
- 具备全屏沉浸放映（F5 / 点击播放）、键盘快捷切页（`←` `→` / Space / PageUp / PageDown）；
- 配备左侧高清幻灯片缩略图大纲抽屉与底部演讲者备注（Speaker Notes）抽屉。

### 14. Excel (.xlsx / .xls) 多工作表电子表格工作台 (Modern Excel Spreadsheet)
- **纯前端离线 OOXML 引擎**: 毫秒级解包解析多工作表 (Multi-Sheet Tabs)、共享字符串池 (SharedStrings) 与隐藏表检测；
- **智能数据网格**: 支持首行表头/列标自由切换、全局关键字高亮检索、单列排序、单元格一键复制与分页浏览；
- **列特征画像 (Data Profiling)**: 联动自动类型推断、极值/均值/分位数统计与 Sparklines 迷你走势微图；
- **多格式导出**: 支持将当前工作表一键导出为 CSV、TSV、JSON 或 Markdown 表格。

### 15. 现代图像工作台与像素检视器 (Modern ImageViewer)
- **全格式原生支持**: 原生支持 `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.ico`, `.avif`, `.tiff` 等全量图片格式；
- **10% ~ 3200% 极清矢量缩放**: 支持平滑滚轮缩放与像素化 (`pixelated`) 渲染模式，配合自由平移拖拽与视口自适应；
- **16x 像素十字放大镜取色器**: 实时浮动追踪光标，定位像素物理坐标 `(X, Y)` 与 `HEX` / `RGBA` / `HSLA` 色值，单击一键复制；
- **四态画布底色**: 透明棋盘格 (Checkerboard)、纯黑暗室、纯白原纸与 VS Code 原生主题四态背景随心切换；
- **几何变换与导出**: 顺时针/逆时针 90° 旋转、水平/垂直镜像翻转、一键复制 Base64 Data URI 与下载原图；
- **EXIF 深度元数据提取**: 解析图像尺寸、总像素数、纵横比、文件大小与相机拍摄参数 (光圈/快门/ISO/焦距/时间)。

### 16. 领域故事讲授法与 egon.io 原生支持 (Domain Storytelling Studio)
- **多语法无损支持**:
  - 原生识别与解析 WPS egon.io 官方 `.dst` JSON 规范、`.egn` 扩展及独立 `.domainstory` 文件；
  - Markdown 深度排版内嵌：支持 ````domainstory````、````story````、````dst````、````egn```` 声明式 DSL 及极简流语法；
- **领域拓扑与角色关系**:
  - 自动渲染参与者 (Actor: 人物、系统、组织)、工作对象 (Work Object: 文档、数据、包裹、消息等) 与带序号活动连接；
  - 支持领域协作边界圈层分组 (Groups) 绘制与自适应启发式布局；
- **交互式逐帧演播与 Polyglot 导出**:
  - 接入 `DiagramStepPlayer` 播放器，支持按活动序号单步播放、上一帧/下一帧与聚焦高亮；
  - 导出官方 `.dst` 文件与将完整领域模型隐写嵌入的 **Polyglot SVG**，实现图形与源码双向无损提取。

### 17. 云原生与容器化基础设施全套工作台 (Cloud-Native Infrastructure Studio)
- **Dockerfile 构建流水线与指令透视 (Dockerfile Studio)**:
  - 自动解析并生成多阶段构建流水线 DAG（如 `base -> builder -> runner`）；
  - 语法指令分层分类透视（基础镜像、构建步骤、环境配置、网络端口与运行时）；
  - 环境变量与暴露端口矩阵化提取；
  - 云原生最佳实践静态体检：检测 `:latest` 镜像漂移、过多 RUN 碎片层、非 root 安全用户合规性等；
  - 源码分屏实时协同编辑。
- **Docker Compose 微服务拓扑工作台 (Compose Studio)**:
  - 自动渲染微服务依赖拓扑架构图，支持按服务关系自动关联连线；
  - 网络隔离簇（Networks）与持久化卷（Volumes）挂载图谱；
  - 微服务配置矩阵：集中检视各容器镜像版本、暴露端口、重启策略与资源参数；
  - 敏感环境变量安全打码脱敏（Secret Masking）与眼球悬浮临时揭示；
  - 静态配置体检：自动检测端口冲突、悬空 depends_on 与未声明网络。
- **Kubernetes 复合清单引力拓扑工作台 (Kubernetes Manifest Studio)**:
  - 纯离线解析复杂多文档 YAML 清单（`---` 自动切分）；
  - 4 层云原生引力拓扑图：`Ingress / Gateway` $\to$ `Service` $\to$ `Workload (Deployment/StatefulSet/Pod/Job)` $\to$ `Config/Storage (ConfigMap/Secret/PVC)`；
  - 跨资源 Selector 自动引力连线：基于 `matchLabels` 自动关联 Service 与 Deployment，基于 `volumeMounts` 自动关联 PVC 与 ConfigMap；
  - 资源概览看板：按 Workload、Network、Config、Storage、RBAC 分类卡片聚合与即时检索；
  - 最佳实践体检中心：缺少存活/就绪探针 (Probes)、缺少 Resource Limits、Service 悬空断链自动警示与修复建议；
  - 源码分屏协同与精准跳转。

### 18. HTML5 网页与交互沙箱工作台 (HTML5 Web Sandbox Studio)
- **双层隔离安全沙箱**: 严格配置受控 `iframe` 沙箱，彻底禁用 `allow-same-origin` 与 `allow-top-navigation`，杜绝宿主逃逸与全局样式污染；
- **多终端视口模拟器**: 一键切换 **响应式桌面 (100%)**、**iPad 平板 (768px)** 与 **iPhone 手机 (375px)**，自动居中拟真排版；
- **多态画布与底色自适应**: 支持纯白、深色暗黑、透明棋盘格 (Checkerboard) 与宿主系统主题四态底色灵活切换；
- **纯本地源码分屏协同**: 支持左侧代码编辑（带 Undo/Redo 历史栈与骨架片段库）+ 右侧沙箱实时防抖热预览。

### 19. 全局偏好与工作区持久化体系
- **集中式配置中枢 (`settingsStorage.ts`)**: 存储键升级为 `v2`，无缝自动向前平滑兼容迁移旧版本配置并安全回写；
- **严苛边界防护**: 对缩放比例 (0.5~2.5x)、字号 (12~22px) 及分屏比例建立数学截断与钳位容错，避免任何异常值影响交互；
- **多工作区生命周期持久化 (`fileStorage.ts`)**: 记住侧边栏与资源管理器开关状态、活动标签页顺序与最后打开文件；
- **存储用量分析与安全备份**: 实时统计 LocalStorage 占用量与键清单，支持工作区配置导出独立 JSON、校验导入与一键恢复出厂设置。

---

## 🚀 快速开始

### 本地开发预览

```bash
# 1. 安装项目依赖
npm install

# 2. 启动 Webview 本地调试服务器 (运行于 3000 端口)
npm run dev
```

### 自动化测试与工程门禁

```bash
# 运行全部单元测试与驱动验证套件
npm test

# 运行全量物理门禁与工程构建（含文档一致性与架构校验）
npm run verify
```

### 用户设置与状态持久化

OmniView 内置完整的双向配置同步与持久化体系（`settingsStorage`）：
- **工作区与全局设置持久化**: 主题风格、字号排版、分屏比例、大纲状态与多语言偏好均自动保存在 VS Code 全局与工作区配置中；
- **渲染状态与历史持久化**: 离线状态下自动持久化编辑缓存与缩放平移视图，下次打开即刻恢复现场。

### 构建与打包 VS Code 插件 (VSIX)

```bash
# 1. 运行全量物理门禁与工程构建
npm run verify

# 2. 打包离线 VSIX 插件包
npm run package:vsix

# 3. 安装插件至本地 VS Code 编辑器（版本号与 package.json 保持一致）
code --install-extension omniview-1.0.28.vsix --force
```

安装完成后，在 VS Code 资源管理器中右键任意支持的文件，选择 **“使用 OmniView 文件渲染器打开”**，或在编辑器右上角点击 **“OmniView: 在侧边打开预览”**。

---

## 📚 文档与协作

| 文档 | 说明 |
|---|---|
| [`docs/README.md`](./docs/README.md) | 文档总索引 |
| [`docs/architecture.md`](./docs/architecture.md) | 系统分层与渲染管道 |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | 开发环境、门禁与 PR 约定 |
| [`SECURITY.md`](./SECURITY.md) | 安全漏洞披露流程 |
| [`CHANGELOG.md`](./CHANGELOG.md) | 版本变更记录 |

---

## 📂 示例文件目录

OmniView 在 [`examples/`](./examples) 提供开箱即用的多格式样例（完整目录见 [`examples/README.md`](./examples/README.md)）：

| 示例文件 | 说明与核心展示特性 |
|---|---|
| [`mermaid/omniview-render-pipeline.mmd`](./examples/mermaid/omniview-render-pipeline.mmd) | 独立 Mermaid 渲染流水线流程图 |
| [`plantuml/cloud-topology.puml`](./examples/plantuml/cloud-topology.puml) | 独立 PlantUML 微服务时序拓扑 |
| [`graphviz/cloud-architecture.dot`](./examples/graphviz/cloud-architecture.dot) | 独立 Graphviz 云原生有向拓扑 |
| [`markmap/system-architecture.markmap`](./examples/markmap/system-architecture.markmap) | 独立 Markmap 平台能力思维导图 |
| [`diagrams.md`](./examples/markdown/diagrams.md) | Mermaid、PlantUML、SVG 与 Graphviz / DOT 综合图表对比 |
| [`math-formulas.md`](./examples/markdown/math-formulas.md) | KaTeX 微积分、线性代数、物理学方程组与注意力公式 |
| [`graphviz-diagrams.md`](./examples/markdown/graphviz-diagrams.md) | Graphviz 分层微服务有向图、网络拓扑与错误降级自愈 |
| [`consensus-algorithms.md`](./examples/markdown/consensus-algorithms.md) | 分布式共识机制 (Raft, PBFT, PoW/PoS) 状态机与时序图 |
| [`technical-guide.md`](./examples/markdown/technical-guide.md) | 工程级混合技术文档（架构图、代码块与多态表格） |
| [`stability-stress-test.md`](./examples/markdown/stability-stress-test.md) | 语法损坏图表、缺失图片、超宽表格等极限压测与错误边界隔离 |
| [`domainstory/ecommerce-fulfillment.dst`](./examples/domainstory/ecommerce-fulfillment.dst) | 独立 WPS egon.io 官方 `.dst` 格式跨境电商履约领域故事模型 |
| [`markdown/domain-storytelling.md`](./examples/markdown/domain-storytelling.md) | Markdown 内嵌 Domain Storytelling DSL 敏捷与协同用例 |
| [`html/interactive-dashboard.html`](./examples/html/interactive-dashboard.html) | HTML5 响应式监控大屏、沙箱隔离脚本交互与多终端视口示例 |

---

## 📄 开源许可证

本项目基于 [MIT License](./LICENSE) 开源。欢迎通过 [Issues](https://github.com/fsyyzz/OmniView/issues) 反馈问题，或阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 参与贡献。

