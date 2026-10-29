# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> [!BANNER] OmniView 版本更新大厅 (Release Center)
> OmniView 致力于提供极速、安全、全主题像素级融合的多格式文档与图表渲染体验。
> 在 OmniView 中预览本文档时，您将体验到**现代交互式折叠手风琴、对比卡片与高光 Alert** 的富媒体排版。

---

## [1.3.43] - 2026-10-28 (当前最新发布)

> [!TIP] v1.3.43 核心升级亮点
> **Markdown 列表渲染与序号/符号体系全面修复与增强**：
> 1. **根治 Tailwind CSS Preflight Reset 导致的序号与圆点缺失缺陷**：
>    - 深度重构 `src/index.css` 列表系统，显式补充 `.markdown-content ol`、`.markdown-document ol` 与 `ol.ov-ordered-list` 的 `list-style-type: decimal !important` 规则，彻底恢复有序列表序号（`1.`, `2.`, `3.` 等）显示；
>    - 显式声明 `ul` 的 `list-style-type: disc !important`，恢复无序列表项目符号展示；
> 2. **多层级有序/无序/混合列表递进排版**：
>    - 完整支持二级有序列表 `lower-alpha`（`a.`, `b.`）、三级 `lower-roman`（`i.`, `ii.`）与多级嵌套自然递进；
>    - 完整支持二级无序列表 `circle`、三级 `square` 与有序/无序混合嵌套样式；
>    - 优化列表项（`li`）行高（`1.68`）、子段落边距与嵌套子列表缩进（`1.45em`），确保紧凑模式（`data-density="compact"`）与大序号无重叠错位；
> 3. **全主题设计令牌自适应与交互式任务列表防干扰**：
>    - 列表序号 marker 颜色绑定至 `--ov-text-secondary` 并开启 `tabular-nums` 等宽对齐，项目符号 marker 颜色绑定至 `--ov-accent` 主题色；
>    - 对交互式任务列表（`- [ ]`, `- [x]`）彻底清除原生符号与 marker，保证复选框纯净居中对齐；
>    - 补齐 GitHub Alert / Callout 引用框内部列表以及卡片矩阵（Card Grid）内部嵌套有序列表排版；
> 4. **A4 打印保真与自动化回归验证**：
>    - 在 `@media print` 中同步补齐打印时有序列表序号与符号保真规则，增加列表项防跨页断裂保护（`page-break-inside: avoid`）；
>    - 新增 `tests/test-markdown-list-rendering.mjs` 专项测试，全量 93 项自动化测试套件与所有质量门禁 100% 顺利通过。

---

## [1.3.42] - 2026-10-27

> [!TIP] v1.3.42 核心升级亮点
> **Markdown 内嵌 Markmap 思维导图全主题背景与文字颜色像素级适配**：
> 1. **卡片与画布背景语义设计令牌化**：
>    - 彻底移除 `MarkmapBlock` 根容器与画布中残留的写死暗色类名（`bg-slate-950/40`）与工具栏写死暗色背景，全面重构为 `--ov-surface`、`--ov-border` 与 `--ov-diagram-canvas-bg` 动态设计令牌；
>    - 在 `src/index.css` 补齐 `.markdown-diagram-markmap` 及 `.diagram-canvas` 在 `sepia`（暖阳羊皮）、`light`（明雅日光）、`solarized` 与 `notion` 主题下的卡片背景与边框规则，彻底根治羊皮纸等浅色主题下“黑底深褐字”失配问题；
> 2. **主题判定与持久化链路健全**：
>    - 导出统一 `isThemeDark(theme)` 判定函数，解决 `ViewerRenderer` 遗漏现代扩展主题（`github-dark`、`catppuccin`、`tokyo-night`、`notion`）及 VS Code 原生 `system` 主题注入的明暗识别漏洞；
>    - 补齐 `settingsStorage.ts` 对全部 15 项支持主题的读取校验；
> 3. **工程化与单元测试回归验证**：
>    - 新增 `tests/test-markmap-theme.mjs` 测试套件，全量 91 套测试与硬性门禁 100% 顺利通过，并重新编译产出最新 webview 与插件产物。

---

## [1.3.41] - 2026-10-26

> [!TIP] v1.3.41 核心升级亮点
> **Markdown 内嵌图表与纯文本块全主题深度适配 + 表格数学公式渲染修复 + 开源同步净化加固**：
> 1. **Markdown 内嵌 Markmap 思维导图全主题自适应**：
>    - 打通 `driverRegistry` $\rightarrow$ `MarkdownViewer` $\rightarrow$ `MarkmapBlock` $\rightarrow$ `MarkmapViewer` 完整主题传递链路；
>    - 移除画布容器写死的深色背景，内嵌模式底色设为透明以无缝融入卡片表面；
>    - 将 SVG 节点文字、行内代码底色与字体族全面绑定至 `--ov-text`、`--ov-code-bg` 与 `--ov-font-family`，并新增暖阳羊皮（`sepia`）、森林（`forest`）、Dracula 与 Nord 专属分支调色板；
> 2. **Markdown 内嵌 ECharts 动态图表全主题与热切换自适应**：
>    - 扩展 `getOmniViewEchartsTheme` 支持按具体 `themeId` 生成专属数据系列调色板、坐标轴与提示框配色（`sepia` 暖阳羊皮采用温润琥珀/陶土/松绿复古色系与深棕文字）；
>    - 修复同属亮色系的 `light` 与 `sepia` 切换时图表主题不刷新的问题，移除卡片头部与源码视图写死的暗色类名；
> 3. **Markdown `text` 纯文本代码块暖阳羊皮（`sepia`）护眼对比度优化**：
>    - 新增 `--ov-code-color` 语义设计令牌（`sepia` 主题下采用温润深棕褐色 `#5c4028` 搭配 `#f4ecda` 羊皮纸底色），覆盖 `prism-tomorrow.css` 默认暗灰文字色；
> 4. **Markdown 表格单元格与表头 KaTeX 数学公式渲染修复**：
>    - 修复 `formatRichCellContent` 中反引号行内代码包裹的公式（如 `` `$\lVert \mathbf{w} \rVert_{1}$` ``）被二次 `renderInlineMath` 正则误替换并被 `marked.parseInline` 转义为裸 `<span class="ov-katex-inline">` HTML 文本的问题；
>    - 保护表格搜索高亮时的数学占位符，并将表头单元格（`<th>`）统一接入富文本与公式渲染管线；
> 5. **开源镜像同步与打包隔离加固**：
>    - 在 `.gitignore`、`.vscodeignore`、`.dockerignore` 与开源同步流水线中严格隔离 `.agents` 与 `.aistudio` 内部目录，保留 `.github` 社区模板与 CI/Release 工作流并拦截内部同步脚本，确保纯净开源导出环境 90 项自动化测试套件 100% 独立通过。

---

## [1.3.39] - 2026-10-26

> [!TIP] v1.3.39 核心升级亮点
> **`omniview-markdown-authoring` 技能库六大场景范本全景扩充与规约对齐**：
> 1. **从 2 个简短示例扩展为 6 大生产级全景样板 (`examples/*.md`)**：
>    - `enterprise-architecture.md`：企业级架构设计（RFC/ADR）样板，涵盖 OKF YAML Frontmatter、`[!BANNER]`、`[!METRICS]`、Graphviz `dot`、Mermaid 时序与状态机、`[!CARDS:3]`、`[!COMPARE]`、KaTeX `aligned`/`cases` 与 `<!-- pagebreak -->`；
>    - `release-notes-callouts.md`：版本发布与交互组件百科样板，完整覆盖 9 类标准与扩展 Callout（`NOTE`/`TIP`/`IMPORTANT`/`WARNING`/`CAUTION`/`SUCCESS`/`QUESTION`/`EXAMPLE`/`QUOTE`）、`+`/`-` 折叠手风琴、`[!CARDS:2/3/4/6]` 与 `[!CARD]`、以及 `[!TABS]`/`[!STEPS]`/`[!TIMELINE]`/`[!COMPARE]`/`[!METRICS]`/`[!FAQ]`/`[!QUOTES]` 与 Emoji 简码；
>    - `data-dashboard-echarts.md`：BI 数据大盘与性能基准样板，涵盖完整 `echarts` 双 Y 轴配置、`echarts:radar`、`echarts:line` 二维数组极简模式、`[!CARDS:2]` 内嵌 `echarts:bar`/`echarts:pie` 组合仪表盘、富表格（含 `\vert` 公式与一键转图）及结构化 `csv`/`yaml` 代码块；
>    - `domain-modeling-and-attachments.md`：DDD 领域建模与知识图谱样板，涵盖 `domainstory` 领域故事讲述 DSL、`markmap` 限界上下文思维导图、`![[...]]` 与 `![]()` 外部工程图表内联挂载（`.excalidraw`/`.dst`/`.mmd`/`.puml`/`.dot`/`.markmap`）、Obsidian 双向 WikiLinks、Pandoc 定义列表与学术脚注；
>    - `visual-media-and-svg-gallery.md`：视觉画廊与多主题矢量样板，涵盖图片管道修饰符（`|width|bg-light|bg-dark|bg-checker|center|rounded|circle|caption`）、`#gh-dark-mode-only`、`[!GALLERY:3]`、`[!FIGURE]`、`[!MEDIA]`/`[!MEDIA:RIGHT]` 以及带 `:root` 与 `[data-theme="dark"]` CSS 变量的内联自适应 `<svg>`；
>    - `scientific-paper-and-print.md`：科学计算推演与 A4 出版级打印样板，涵盖 KaTeX 矩阵（`pmatrix`/`bmatrix`）、多行推导、表格内 `\vert` 与 `\parallel` 防冲突、货币 `\$` 转义、Shell 命令行 `$ ` 提示符自动剥离复制及 `<!-- pagebreak -->` 打印分页规范；
> 2. **专项参考手册与主技能决策树同步 (`SKILL.md`, `references/*.md`)**：补齐 ECharts、Domain Storytelling、外部工程图表内联挂载、OKF Frontmatter、WikiLinks/定义列表/脚注与 A4 打印分页规范，并重建 `.codex/codex.index.json`（收录 100 项规范定义，100% 通过 `lint:codex` 校验）。

---

## [1.3.38] - 2026-10-26

> [!TIP] v1.3.38 核心升级亮点
> **Markdown 渲染效果全量对齐打印与单文件离线导出管线 (Print & Export Fidelity)**：
> 1. **根治打印背景透明洗脱问题**：彻底清除 `@media print` 中抹杀 `.ov-callout`、`table`、`pre` 背景色彩与边框的 `background-color: transparent !important` 与泛化灰边覆盖，完整保留 GitHub Alert 语义块色彩基调与左边框高光；
> 2. **现代扩展排版组件打印样式补全**：全面补齐多列卡片矩阵 (`.ov-card-grid`)、多标签页组 (`.ov-tab-group`)、步骤引导条 (`.ov-steps-container`)、时间线 (`.ov-timeline-container`)、对比差分卡 (`.ov-compare-container`)、KPI 指标看板 (`.ov-metrics-container`)、问答手风琴 (`.ov-faq-container`)、引言墙 (`.ov-quotes-container`) 与 OKF 概念卡片的打印印刷 CSS；
> 3. **折叠块展开与多 Tab 保全**：
>    - 打印与导出时自动强制将所有折叠块（`<details>`）设置为 `open`，杜绝打印时未手动展开的内容被截断丢失；
>    - 彻底解决以前打印时因 `button { display: none }` 导致 Tab 标题丢失且仅打印首个 Tab 的缺陷，自动展开所有 Tab 面板并注入醒目的打印徽标（如 `标签页: npm`）；
> 4. **工作台外置打印统一收敛**：`WorkbenchHeader.tsx` 的 Webview 打印统一接入 `buildPortableHtml`，确保工作台与插件文档视图的外置打印呈现 100% 像素级一致的高保真效果；
> 5. **代码高亮与表格打印加固**：单文件便携 HTML 内联 Prism 代码高亮词法配色，表格保持斑马纹与跨页重复表头（`thead { display: table-header-group }`）。

---

## [1.3.37] - 2026-10-26

> [!TIP] v1.3.37 核心升级亮点
> **SVG 渲染与编辑全面支持全局样式表 (`<style>`) 与 CSS 变量系统**：
> 1. **DOMPurify 净化保真**：在 `sanitizeDefsFragment` 中配置 `PARSER_MEDIA_TYPE: 'application/xhtml+xml'`，彻底根除 DOMPurify 默认 HTML 上下文剥离 `<style>` 标签的问题，使全局 CSS 样式表、渐变、滤镜与 SVG 图元得以完整注入 DOM；
> 2. **解除内联样式覆盖**：移除 `<path>` / `<text>` 渲染时强制注入内联 `style` 的 `fill`/`stroke` 覆盖，严格遵循 W3C SVG 规范将默认外观作为 presentation attributes 分发，使全局样式表中的 CSS 类规则（如 `.my-class { fill: red; }`）及 `:root` 变量（`var(--primary)`）能够无缝层叠生效；
> 3. **全局样式与 CSS 变量核心引擎 (`core/model/globalStyles.ts`)**：提供 `parseGlobalStyles`、`setDocumentGlobalStyles`、`updateDocumentCssVariable`、`extractNodeToGlobalClass` 与 `getClassesInUse` 等不可变文档模型操作；
> 4. **Inspector 全功能全局样式与变量编辑器 (`SvgV2Inspector.tsx`)**：
>    - **CSS 变量实时调色器**：自动侦测提取 `:root` / `svg` 中的 `--var` 变量并提供拾色器与数值调节，即时更新整图；
>    - **CSS 类名管理与图元筛选**：罗列已定义的样式类名与图元引用计数徽章，支持一键点击选中所有使用该类的图元；
>    - **预设样式库一键注入**：支持注入主题调色盘、霓虹发光、工业线框、悬浮微动效、暗黑自适应等预设样式；
>    - **代码级 `<style>` 编辑器**：支持实时查看与直接编辑完整 CSS 源码；
>    - **图元 Class 绑定与一键抽取**：选中图元时支持快速输入/选择 `className`，并提供「提取为全局 CSS 类」一键抽样生成样式类；
> 5. **命令管线与撤销重做**：注册 `canvas.setGlobalStyles`、`canvas.updateCssVariable`、`object.setClassName`、`object.extractToClass` 命令，全量支持撤销重做与 SVG 导出回写保真。

---

## [1.3.30] - 2026-10-24

> [!TIP] v1.3.30 核心升级亮点
> **文档图形化专项治理：docs 核心文档充分图形化改造 + 全仓 12 处 ASCII 文本图升级为标准 Mermaid/Markmap 图形**：
> 1. **docs 图形化改造**：`features-capabilities.md` 非标雷达图升级为内联 SVG 六维雷达图并补齐驱动全景 Markmap 与 KaTeX 性能预算；`cloud-native-viewers-plan.md` 分层架构图升级为 Mermaid flowchart 并补齐三级嗅探流水线、Docker 阶段 DAG、Compose 拓扑、K8s 引力图与 gantt 路线图；`svg-v2-editor.md` 状态机升级为 `stateDiagram-v2` 并补四件套 classDiagram；`docs/README.md` 新增文档导航图谱；
> 2. **全仓 ASCII 文本图治理**：将 `docs/adr` 状态机与快照链、`PROJECT.md` 分层框线图、`.codex` 7 大工作流与 rule/skill 12 处文本手绘图全部升级为 Mermaid flowchart/stateDiagram，50+ 节点图形决策树升级为 Markmap 全景思维导图。

### 📚 Docs & Governance (文档图形化与 AI 规范库治理)

- **docs 核心文档图形化 (`docs/features-capabilities.md`, `docs/design/cloud-native-viewers-plan.md`, `docs/design/svg-v2-editor.md`, `docs/README.md`)**:
  - `features-capabilities.md`：非标准 `radar-chart` DSL 替换为内联 SVG 六维雷达图（`[!FIGURE]` 图件框 + `currentColor` 文本 + `viewBox` 自适应），第 2 节新增 25 模块六大域 Markmap 驱动全景思维导图，DIM-04 新增 KaTeX `cases` 块级性能预算不等式硬约束；
  - `cloud-native-viewers-plan.md`：§2 ASCII 分层框线图升级为 Mermaid `flowchart TB`（含外壳/驱动/核心解析三层 subgraph 与双向 RPC 边），并补齐三级嗅探判定流水线、Dockerfile 阶段 DAG、Compose 微服务网络隔离拓扑、K8s 四层引力拓扑与五阶段 gantt 路线图；
  - `svg-v2-editor.md`：§4 状态机升级为 Mermaid `stateDiagram-v2`（Idle/Commit/Previewing 三态 + 三种执行模式映射），§2 补 Document/Node/PathGeometry/Selection 四件套 `classDiagram`；
  - `docs/README.md`：新增「文档导航图谱」Mermaid `flowchart LR`（入口 → 核心架构面/设计子系统面/ADR/营销面）；
- **全仓 12 处 ASCII 文本图治理 (`docs/adr/README.md`, `docs/adr/0001`, `PROJECT.md`, `.codex/workflows/*`, `.codex/rules/code-change.md`, `.codex/metrics/README.md`, `.codex/skills/verification/SKILL.md`, `.codex/skills/omniview-markdown-authoring/SKILL.md`)**:
  - ADR 状态流转、快照链 undo/redo、VS Code Extension Host 分层框线、7 大工作流门禁链、代码分层依赖图、验证门禁链与 50+ 节点图形决策树全部升级为 Mermaid `flowchart` / `stateDiagram` / Markmap，CommonMark 环境下可优雅降级；
  - 目录树（`├──`）等 55 处清单惯例保留，不纳入图形化范围；
- **AI 规范库重建 (`.codex/codex.index.json`)**: 同步重建 96 条规范索引，零死链。

---

## [1.3.29] - 2026-10-23

> [!TIP] v1.3.29 核心升级亮点
> **彻底根治 SVG 鼠标点选/框选误选 `<text>` 文本与浏览器原生蓝底选字问题**：
> 1. **阻断浏览器 DOM 原生蓝底选字**：在 `useSvgV2PointerInput.ts` 的 `pointerdown` / `pointermove` 中显式执行 `e.preventDefault()` 与 `window.getSelection()?.removeAllRanges()`，为画布外围工作区容器、`<svg>` 根节点及所有 `<text>` 图元注入 `user-select: none`，并将工作区留白处的左键拖拽转发至 SVG 指针管线，支持从画布外侧留白直接拉入 CAD 选框；
> 2. **内聚卡片 `<g>` 整体识别与防孤立文本误选 (`core/model/bbox.ts`)**：新增 `isCohesiveCardGroup` 与 `findBackingSiblingPath`，右→左交叉框选触碰带底框的卡片 `<g>` 时自动整体选中卡片编组而非仅拎出内部 `<text>`，左→右窗口框选未包住卡片底框时自动剔除孤立 `<text>` 标题；
> 3. **全画布大背景底板穿透框选与底框图形优先点选 (`core/runtime/tools.ts`)**：普通点击或拖拽铺满全图的背景底板（$\ge 75\%$ 画布面积）内部时直接视为空白画布开启 CAD 框选；点击带底框 `Path` 的节点文字区域时优先选中底框图形，再次点击或按 `Ctrl/Cmd` 再下钻至 `<text>`。

### 🐛 Fixed & Improved (SVG 鼠标选择防误选文本专项修复)

- **指针输入与画布 DOM 防选字加固 (`useSvgV2PointerInput.ts`, `SvgV2Canvas.tsx`)**:
  - `handlePointerDown` / `handlePointerMove` 增加 `e.preventDefault()` 与 `window.getSelection()?.removeAllRanges()`；
  - 画布外层容器、`<svg>` 及 `<text>` 节点统一施加 `select-none`（`user-select: none`），并支持从画布灰色留白区直接起框拉入 SVG；
- **CAD 框选与点选模型优化 (`core/model/bbox.ts`, `core/runtime/tools.ts`)**:
  - `matchNodesInMarquee` 识别内聚卡片 `<g>` 整体并过滤未包含底框的孤立 `Text` 子节点；
  - `handleSelectPointer` 过滤全画布大背景底板内部命中以保障随时拉出 CAD 选框，并在点选重叠 `Text + Path` 徽章/卡片时优先命中底框 `Path`；
- **回归测试扩充 (`tests/test-svg-selection-enhancements.mjs`)**:
  - 新增内聚卡片 `<g>` 交叉选、未包住底框的孤立文本过滤及全画布大背景底板直起 CAD 框选回归测试。

---

## [1.3.28] - 2026-10-23

> [!TIP] v1.3.28 核心升级亮点
> **CAD 级双向框选引擎升级：窗口选择 (左→右) vs 交叉选择 (右→左) 精确几何与编组智能下钻**：
> 1. **左→右 CAD 窗口选择 (`enclosed`)**：经典蓝色实线选框，仅当图元几何 100% 落入框内才选中；支持 `<g>` 编组智能下钻——完整包住编组时选中编组整体，仅局部包住大编组内部子图元时自动递归下钻选中框内 100% 包含的子图元；
> 2. **右→左 CAD 交叉选择 (`intersect`)**：经典绿色虚线选框，升级为 **Liang-Barsky 真实几何线段/贝塞尔曲线相交算法**，彻底剔除斜向连线空白角、大跨度折线及空心边框（`fill="none"`）内部空白处的 AABB 包围盒误选；大编组内局部触碰子元素时自动下钻仅选中被碰到的子图元；
> 3. **实时候选发光轮廓、容器内直起框选与修饰键体系**：拉框过程中实时为命中的候选图元渲染蓝/绿预演高亮框并在顶部徽章显示「命中 N 项」；支持在未选中的大尺寸背景容器/泳道内部直接拖拽拉框而不误拖底框；支持 `Shift` 加选 (`add`) 与 `Ctrl / Cmd` 减选 (`subtract`)。

### ✨ Added & Improved (SVG CAD 双向框选引擎升级)

- **真实几何交叉判定与 `<g>` 编组智能下钻 (`core/model/bbox.ts`)**:
  - 新增 `segmentIntersectsRect`（Liang-Barsky 线段-矩形精确裁剪）、`nodeIntersectsMarquee`（覆盖开放折线、贝塞尔曲线采样、空心边框与实心多边形）与 `matchNodesInMarquee`（支持左→右窗口选与右→左交叉选的 `<g>` 递归智能下钻）；
- **命令与手势状态机增强 (`core/commands/registry.ts`, `core/runtime/tools.ts`, `SvgV2Canvas.tsx`)**:
  - `select.box` 支持 `operation: 'replace' | 'add' | 'subtract'`；
  - `handleSelectPointer` 延迟空点清选至 `pointerup`，完整保留 `snapshotSelection` 供拖拽期实时 `Preview` 加减选与高亮轮廓预演，并支持大容器内部直接拉框；
- **单元测试扩充 (`tests/test-svg-selection-enhancements.mjs`)**:
  - 新增斜线/空心框 AABB 假阳性剔除、`<g>` 编组窗口/交叉智能下钻及 `Shift`/`Ctrl` 加减选专项测试。

---

## [1.3.27] - 2026-10-23

> [!TIP] v1.3.27 核心升级亮点
> **SVG 图形本身尺寸自由调整与画布 8 向拖拽缩放 (SVG Graphic & Artboard Resizing)**：
> 1. **画布 8 向控制柄直接拖拽缩放**：在 SVG 图形白色画布外框四周与四角新增 8 个交互式控制柄与顶部尺寸状态栏，支持直接拖拽边缘或角点实时拉伸调整 SVG 图形本身尺寸（`Begin -> Preview -> Commit` 单步撤销栈），移除原 CSS `max-w-full / max-h-full` 对画布真实像素尺寸的锁死限制；
> 2. **双模式尺寸调整（整体缩放图形 vs 仅调画布边界）**：核心命令管线新增 `canvas.setSize`，支持「整体缩放图形 (`scale-content`，内部所有图层与图形按比例同步缩放)」、「仅调画布边界 (`canvas-only`，扩缩工作区且支持左/上拖拽自动补偿坐标)」与「自适应内容边界 (`fit-content`，自动包裹所有可见图元并可配置 24px/0px 留白)」；
> 3. **属性面板、顶部工具栏与圆角防畸变增强**：未选中子图元时右侧 Inspector 展示完整「SVG 图形尺寸」面板（支持宽高输入、等比锁定、横竖版一键互换、`0.5x~2x` 快捷倍率与常用尺寸预设），顶部工具栏支持实时输入 SVG 宽高；同时在非等比拉伸圆角矩形时自动重算局部 `rx/ry`，彻底杜绝圆角被拉扁为椭圆。

### ✨ Added & Improved (SVG 图形尺寸与几何引擎升级)

- **核心命令 `canvas.setSize` (`core/commands/registry.ts`)**:
  - 支持 `scale-content`（整体缩放 SVG 图形及内部所有元素）、`canvas-only`（仅调整画布视口宽高并支持 `offsetContent` 平移补偿）与 `fit-content`（自动计算全部可见图元联合包围盒并包裹留白）；
- **画布外框交互式 8 向拖拽手柄 (`SvgV2Canvas.tsx`)**:
  - 围绕 SVG 图形外框提供 `nw` / `n` / `ne` / `e` / `se` / `s` / `sw` / `w` 8 个缩放控制点及顶部「整体缩放图形 / 仅调画布边界 / 自适应内容」快捷切换条；
- **全场景尺寸面板与非等比圆角保护 (`SvgV2Inspector.tsx` / `SvgV2Studio.tsx`)**:
  - 右侧属性面板在空选态提供完整 SVG 图形尺寸控制台，选中图元时新增宽高比锁定（`等比`）与 `0.5x~2x` 快捷缩放按钮；
  - `object.scale` 针对圆角矩形自动补偿世界变换缩放比，确保单向拉宽或拉高矩形时圆角始终保持正圆弧；
- **单元测试扩充 (`tests/test-svg-v2-tools-shapes.mjs`)**:
  - 新增 `canvas.setSize` 三种模式（`scale-content`、`canvas-only`、`fit-content`）完整断言验证，全量 88 个测试套件 100% 通过。

---

## [1.3.26] - 2026-10-23

> [!TIP] v1.3.26 核心升级亮点
> **SVG 矢量编辑器样式刷与尺寸刷深度集成 (Style Painter & Size Matcher)**：
> 1. **样式刷（获取与刷新样式）**：支持快捷键 `Alt+C`（吸取样式）与 `Alt+V`（刷新应用样式），右侧属性面板集成「格式刷」控制卡片与属性暂存指示灯；支持将填充（颜色/不透明度）、描边（颜色/线宽/端点/折角/虚线）、箭头标记（markerStart/markerEnd）、矩形圆角与文本排版样式一键批量跨图元同步并支持撤销重做；
> 2. **尺寸刷（获取与刷新尺寸）**：在「位置与尺寸」模块新增专属尺寸刷，支持一键获取图元包围盒尺寸，提供「等尺寸 (W+H)」、「刷新同宽 (W)」、「刷新同高 (H)」与「等比匹配 (Fit)」四种自适应匹配模式；
> 3. **多选主选尺寸快速同化**：多选 ≥2 个图元时，支持一键「以主选同宽」、「以主选同高」与「以主选全等大」，工业级 CAD 快速统一多图元规范。

### ✨ Added & Improved (SVG 矢量编辑效率升级)

- **全局样式刷核心机制 (Style Painter)**:
  - 模块级 `StyleBuffer` 样式持久化缓冲区，吸取图元全部视觉表现特征；
  - Inspector 面板快捷「吸取样式 (Alt+C)」与「刷新样式 (Alt+V)」双按钮与实时暂存状态预览；
  - 完备支持单选及多选图元批量灌注，自动融入 Undo/Redo 历史重做栈；
- **尺寸刷与几何中心缩放 (Size Matcher)**:
  - 模块级 `SizeBuffer` 记录图元实际包围盒宽、高与纵横比，依托 `object.scale` 围绕图元几何中心平滑缩放；
  - 快捷模式支持单维拉伸（仅同宽、仅同高）或等比自适应收敛（Fit）；
  - 多选模式下激活主选图元尺寸同化控制条，提升图标设计与排版效率；
- **矩形圆角全生命周期持久化与编组穿透 (Rect Corner Radius Persistence)**:
  - 新增 `inferRectGeometryRadius` 与 `getRectCornerRadius`，支持从圆角矩形路径（8~10 锚点贝塞尔圆角段）反推矩形身份与圆角半径；
  - `fallbackDomParse` 与 `usvgTreeToDocument` 完整解析并回填 `data-omniview-hint="rect"`、`data-omniview-rx` 及 `<rect rx="...">` 属性，解决导出/重加载后无法再次调整圆角的问题；
  - Inspector 与 `path.setRectRadius` 支持编组（`<g>` Group）递归穿透识别组内矩形，并按世界变换缩放系数动态补偿圆角上限；
- **自动化测试套件扩充**:
  - `tests/test-svg-v2-tools-shapes.mjs` 新增针对多图元样式灌注同步、尺寸缩放匹配及矩形圆角跨缩放/编组/序列化持久化的核心测试用例，全套 88 组门禁用例 100% 通过。

---

## [1.3.25] - 2026-10-23

> [!TIP] v1.3.25 核心升级亮点
> **SVG 矢量编辑器工具提示备注、多选隔离与矩形圆角全面完善 (SVG Editor Polish)**：
> 1. **右侧面板全局悬浮备注提示**：图层树与属性面板所有对齐、分布、拾色器、预设色块、不透明度、描边端点、虚线、线型切换、箭头标记、字号字重、坐标尺寸、编组层级等控件均配备详细中文说明与快捷键提示；
> 2. **多选交互隔离与框选修复**：修复在多选状态下单击特定图元被困在多选手势的问题（未发生位移时原地释放立即隔离单选目标图元，拖拽时平滑群组移动），保障工业级 CAD 窗选/交叉框选与智能吸附体验；
> 3. **矩形圆角特性深度支持**：核心数据模型与命令管线完整支持 `rx`、`ry`、`cornerRadius` 与 `path.setRectRadius` 命令，Inspector 专属圆角滑动条、数值精确输入与快捷预设（0px 直角、4px 微圆角、8px 中圆角、16px 大圆角、胶囊全圆角），支持多选矩形批量统一应用。

---

## [1.3.24] - 2026-10-22

> [!TIP] v1.3.24 核心升级亮点
> **内联 SVG 矢量图与画廊图片语法自愈 (Inline SVG Image Self-Healing)**：彻底解决在 Markdown 中使用 `![alt](data:image/svg+xml;utf8,<svg...>)` 时，因未转义的 `<svg>` 标签与空格破坏 CommonMark 规范导致图片语法碎裂为纯文本和游离 HTML 标签的问题；重塑多图画廊 (`[!GALLERY]`)、技术图件 (`[!FIGURE]`) 与图文并排 (`[!MEDIA]`) 矢量图设计。

### 🐞 Fixed & Improved (图片解析与视觉美化)

- **内联 SVG 语法管道自愈 (processInlineSvgImages)**:
  - 在 AST 解析阶段自动拦截 Markdown 图片语法中包含未 URL 编码的 `data:image/svg+xml` 标签，毫秒级转义为标准百分号 URL 编码；
  - 100% 保持 marked 正确切分 `image` Token，恢复 `customRenderer.image`、管道修饰符（`|520|bg-light`）与居中图注能力；
- **重塑 callouts-and-tasks 与示例矢量图件**:
  - 重绘 [callouts-and-tasks.md](file:///d:/njis/work/project/open/OmniView/examples/markdown/callouts-and-tasks.md) 与 [github-alert-callouts.md](file:///d:/njis/work/project/open/OmniView/examples/markdown/github-alert-callouts.md) 中的多图画廊、统一流水线架构图与原地编辑器示意图，提供科技蓝、翡翠绿与紫罗兰微光渐变，杜绝深黑死板方块；
  - 补充针对内联 SVG 语法自愈的自动化单元测试。

---

## [1.3.23] - 2026-10-22

> [!TIP] v1.3.23 核心升级亮点
> **ECharts 图表防崩溃与自动规范化增强 (Robust Normalization)**：全面解决 ECharts 在缺失对偶坐标轴（如仅有 `xAxis` 缺失 `yAxis`）或系列未显式声明 `type` 时抛出的 `axisBuilder` 与 `get` 运行时异常；完善多列仪表盘示例与测试覆盖。

### 🐞 Fixed & Improved (图表健壮性与示例优化)

- **防崩溃配置自动补全 (normalizeEChartsOption)**:
  - 自动识别笛卡尔直角坐标系（Line/Bar/Scatter 等），当仅定义 `xAxis` 或 `yAxis` 单轴时，自动补全对偶轴配置（如补全 `yAxis: { type: 'value' }`），彻底杜绝 ECharts `AxisBuilder` 崩溃；
  - 依据语言标签前缀（如 `echarts:bar`、`echarts:pie`、`echarts:radar`）自动向 `series` 各未定义 `type` 的子项注入目标类型；
  - 规范化 [echarts-charts.md](file:///d:/njis/work/project/open/OmniView/examples/markdown/echarts-charts.md) 示例文件，补充对应单元测试至 7 组。

---

## [1.3.22] - 2026-10-22

> [!TIP] v1.3.22 核心升级亮点
> 全面落地**商业级 Apache ECharts 矢量图表引擎深度集成 (方案一)**：在 Markdown 文档中无缝原生支持 ```` ```echarts ```` 与 ```` ```echarts:类型 ```` 代码块语法糖、**自动与 `> [!CARDS:列数]` 多列响应式卡片流深度融合构建指标仪表盘**、**100% 依托 `--ov-*` 语义令牌的多主题自适应**、按需懒加载与 SVG 矢量高清渲染、独立微型操作栏与全屏灯箱检视。

### ✨ Added & Improved (ECharts 商业图表与多列仪表盘)

- **Markdown 原生 ECharts 渲染块 (EChartsBlock)**:
  - 动态按需加载 `echarts` 核心渲染器，采用 `renderer: 'svg'` 保证高分屏与缩放下无锯齿高清呈现；
  - 深度集成微型浮动操作栏：支持一键重新绘制、复制图表配置、导出 SVG/PNG 图像文件与全屏灯箱沉浸式弹窗检视；
  - 监听容器尺寸与主题令牌变化，基于 `ResizeObserver` 实现微秒级无损重绘。
- **配置解析与语法糖推断 (echartsTheme)**:
  - 宽容支持 YAML 与 JSON 两种声明格式，具备纯数据数组一键转图表的极速语法糖；
  - 支持 ```` ```echarts:line ````, ```` ```echarts:bar ````, ```` ```echarts:pie ```` 等类型快捷前缀，自动推断并补齐缺失的骨架配置；
  - 提取 CSS 语义变量构建专属主题字典，在深色、浅色及高对比度主题下自动保持与宿主风格完全一致。
- **与 `> [!CARDS:列数]` 多列卡片矩阵无缝编排**:
  - 在卡片网格内部无缝嵌套 ECharts 微图表，支持双列/三列/四列响应式指标大屏排版；
  - 新增 [test-echarts-block.mjs](file:///d:/njis/work/project/open/OmniView/tests/test-echarts-block.mjs) 单元测试套件，全量物理测试套件升级至 88 组。

---

## [1.3.21] - 2026-10-22

> [!TIP] v1.3.21 核心升级亮点
> 全面落地基建性能提速、图表安全防护加固与大组件解耦治理：**消除 Node.js 子进程废弃安全告警并实现测试套件近 4x 提速**、**图表与矢量 SVG 安全清洗机制深度加固**，以及 **PDF 全文检索状态控制器 (usePdfSearchController) 解耦治理与 87 组全链路自动化门禁**。

### ✨ Added & Improved (安全加固、性能优化与组件解耦)

- **Node.js 子进程与测试聚合器 4x 极速调度优化**:
  - 优化测试运行器 [scripts/run-all-tests.mjs](file:///d:/njis/work/project/open/OmniView/scripts/run-all-tests.mjs)，直接调用本地已安装的 esbuild 可执行二进制，彻底消除 Windows 平台下的 `shell: true` 与 `npx` 跨进程开销；
  - 彻底杜绝 Node 22+ 的 `[DEP0190]` 弃用与安全告警，全量 87 组自动化测试总耗时从 19.36s 缩减至 **5.22s**（并发加速比约 5.8x）。
- **图表与矢量 SVG 安全清洗深度加固 (Sanitizer Hardening)**:
  - 深度重构 [diagramSanitizer.ts](file:///d:/njis/work/project/open/OmniView/src/features/viewers/lib/diagramSanitizer.ts)，全面拦截自闭合/成对/未闭合危险标签（`<script>`、`<iframe>`、`<object>`、`<embed>` 等）；
  - 强化对斜杠或控制字符分隔的内联事件（如 `<img/onerror=...>`、`<svg/onload=...>`）及各类混淆伪协议（`vbscript:`, `javascript:`, `data:text/html`）的免疫清除；
  - 100% 保持 Mermaid 流程图 `foreignObject` 文本与 KaTeX 数学公式渲染无损。
- **PDF 全文检索解耦 (usePdfSearchController)**:
  - 抽取高内聚自定义 Hook [usePdfSearchController.ts](file:///d:/njis/work/project/open/OmniView/src/features/viewers/components/drivers/pdf/usePdfSearchController.ts)，接管搜索防抖、无结果保护、正反向循环匹配与页面跳转；
  - 精简 [PdfViewer.tsx](file:///d:/njis/work/project/open/OmniView/src/features/viewers/components/drivers/PdfViewer.tsx) 复杂组件状态，新增 [test-pdf-search-controller.mjs](file:///d:/njis/work/project/open/OmniView/tests/test-pdf-search-controller.mjs) 单元测试套件，项目自动化测试矩阵升维至 87 套。

---

## [1.3.17] - 2026-10-21

> [!TIP] v1.3.17 核心升级亮点
> 全面落地 PDF 工业级阅读器视口交互与全触点体验增强（Focal Point Wheel Zoom & Interactive Studio）：实现 **Ctrl+滚轮/触控板捏合光标绝对锚定无级缩放**、**零白屏闪烁平滑硬件加速拉伸过渡**、**抓手漫游模式 (Hand Pan Tool) 与长按空格键/鼠标中键平移视口**、**常用缩放预设快捷菜单** 与 **沉浸式中央 HUD 缩放反馈胶囊**，全方位对齐 Chrome / Adobe Acrobat 专业阅读体验。

### ✨ Added & Improved (PDF 视口交互与全触点体验增强)

- **Ctrl+滚轮/触控板光标绝对锚定无级缩放 (Focal Point Wheel Zoom)**:
  - 深度优化基于光标物理坐标的无级几何对齐纯函数 (`calculatePdfFocalScroll`)，缩放时内容稳稳锁定在光标正下方，绝对不发生视口跳动与内容漂移；
  - 引入 React `useLayoutEffect` DOM 几何同步与双重保障调度，杜绝异步渲染过程中的滚动坐标回跳。
- **零白屏闪烁平滑拉伸过渡机制 (Zero-Flicker Canvas Layering)**:
  - 彻底解决旧版缩放时画布清除导致白屏频闪的体验痛点：缩放过程中保留上一帧已渲染的清晰位图，依托 CSS GPU 硬件加速即时缩放拉伸，后台 PDF.js 异步完成超高分辨率矢量光栅化后再无感热替换，实现 60 FPS 丝滑顺手缩放。
- **抓手漫游模式与全场景平移 (Hand Pan Mode & Space+Drag)**:
  - 工具栏新增「文本选词 (`select`)」与「抓手漫游 (`hand`)」一键切换按钮；
  - 深度支持 **长按空格键 + 鼠标左键拖拽 (Space + Drag)** 及 **鼠标中键（滚轮按键）拖拽**，在任意高倍缩放下随心平移画布，指针动态呈现 `grab` / `grabbing` 状态。
- **缩放预设下拉快捷菜单 (Zoom Presets Menu)**:
  - 点击工具栏缩放百分比按钮，立即呼出精美预设菜单：覆盖 50%、75%、100% (实际大小)、125%、150%、200%、300%、400%、500% 常用档位，以及适合宽度 (W)、适合页面 (H) 快捷切换。
- **全景悬浮 HUD 缩放指示胶囊**:
  - 缩放时在屏幕底部正中呈现半透明毛玻璃 HUD 胶囊，动态展示实时缩放百分比与线性刻度条，900ms 自动平滑淡出。
- **全键盘快捷键覆盖增强**:
  - `Home` / `End`：一键直达文档首页 / 末页；
  - `PageUp` / `PageDown`：快速上一页 / 下一页；
  - `W`：一键适合宽度；
  - `H`：一键适合整页；
  - `R`：顺时针 90° 旋转当前文档；
  - `0` / `Ctrl+0`：快速恢复 100% 实际大小；
  - `Space`：按住启用抓手平移。

---

## [1.3.16] - 2026-10-21

> [!TIP] v1.3.16 核心升级亮点
> 全面落地 SVG 编辑引擎「鼠标拖拽交互绘制（矩形/椭圆/直线/双端点箭头）」与「直线向折线智能演化体系（方案 3：拖拽幽灵中点即折 + 常用直角线型一键切换）」：彻底重构形状与线条绘制交互，告别点击即生成固定尺寸的生硬体验；支持自由拖拽端点/中点拉出折线，以及直线与多种直角走线风格自由转换。

### ✨ Added & Improved (SVG 拖拽绘制与折线演化体系)

- **箭头绘制工具 (`arrowTool`) 与双端点交互**:
  - 新增专用箭头工具（工具栏图标与单键快捷键 `W`），按下鼠标拖拽实时拉伸箭头指向与长度，松开即生成带箭头端点标记（`markerEnd="arrow"`）的矢量路径；
  - 选中直线或箭头时自动切换为双端点骨架交互（渲染虚线轴线与两端点控制圆柄，屏蔽生硬的 8 向矩形框），可单独按住任意端点拖拽微调终点/起点，同时支持 Shift 锁定 15° 步进吸附。
- **矩形、椭圆、线条鼠标拖拽直觉绘制**:
  - 重构 `rectTool`、`ellipseTool`、`lineTool` 与 `arrowTool`，告别过去点击画布即直接放置固定尺寸形状的不合理交互；
  - 拖拽过程实时呈现虚线边框/路径骨架预览 (`Preview`)，松开鼠标精准提交创建并自动切回选择工具 (`selectTool`)；
  - 支持 Shift 约束绘制等比正方形/正圆/射线角度，Alt 键从中心点对称向外扩展绘制，原地单击防误触自动取消不残留垃圾节点。
- **直线向折线智能演化体系（方案 3）**:
  - **幽灵中点折叠手柄 (Ghost Midpoints)**：单选直线或折线时，各线段中点自动显示半透明虚线手柄，直接用鼠标拖拽该中点即可拉出新折点将线段转化为折线，无损记录单步撤销栈；
  - **一键直角走线风格切换 (`path.convertLineStyle`)**：在属性检视器 (`SvgV2Inspector`) 与悬浮 HUD (`SvgV2FloatingHud`) 中提供直角连线切换，支持「直线 ↔ Z形直角（水平优先） ↔ V形直角（垂直优先） ↔ L形单折角」自由切换；
  - **折点管理与反向调向**：支持双击折点或在属性栏点击垃圾桶删除折点恢复直线；提供一键双端点箭头对调 (`ArrowLeftRight`) 与各顶点世界坐标精确微调。

---

## [1.3.15] - 2026-10-21

> [!TIP] v1.3.15 核心升级亮点
> 全面落地 Markdown 预览窗口「块级完整生命周期 CRUD 引擎（方案 1）」：在原地段落编辑基础上，新增渐进式块级悬浮动作胶囊（下方插入新块、原地克隆副本、上下块位置交换、防误触二次确认删除）与底部非阻塞「一键撤销删除 (Undo Toast)」安全网。

### ✨ Added & Improved (Markdown 块级原地 CRUD 与防误触恢复体系)

- **渐进式块级悬浮动作胶囊 (`MarkdownBlockActionBar`) 与智能正文右侧贴合**:
  - 在每个可编辑 AST 块右上角提供渐进式披露胶囊：`[ ✏️ 局部编辑 | ➕ | 📑 | ↑ | ↓ | 🗑️ ]`；
  - 支持一键在下方插入新块并自动定位唤起原地专注编辑器（自动全选占位文本即打即写）、一键向下方克隆当前块副本、一键与上下相邻块无损交换位置；
  - **非铺满正文右侧智能贴合 (`computeBlockContentRightOffset`)**：当段落、短标题、居中图件框 (`[!FIGURE]`)、单张图片或窄表未铺满整行时，悬浮胶囊自动测量并贴合实际内容右边缘；同时打通工作台 `contentWidth` 宽度配置与 `sticky` 底部撤销浮条的正文右对齐；
  - **修复向下移动 (`↓`) 被 Lexer 空白 Token 阻断的问题**：在 `useMarkdownAstPipeline` 的 `renderHtmlToken` 中剔除 `marked.lexer` 产生的空 `space` 占位块，确保 `nextEditableBlock` 100% 指向真实相邻可见块；
  - 100% 遵循 `--ov-*` 语义化设计令牌，且全量标记 `data-clipboard-ignore="true"` 杜绝划选复制污染。
- **专注编辑器内联结构化动作与防误触双保险 (`MarkdownFocusedBlockEditor` & `MarkdownBlockUndoToast`)**:
  - 在专注编辑器底部栏集成「删除此块」「上方插入」「下方插入」「克隆块」快捷操作；
  - 删除块支持「行内二次确认 (`Confirm Delete`) + 底部 6 秒非阻塞一键撤销浮条 (`Undo Toast`)」双重防误触保护，零模态弹窗打断。
- **智能空行归一化纯函数引擎 (`markdownBlockEditor.ts`)**:
  - 新增 `deleteBlockRawMarkdown`、`duplicateBlockRawMarkdown`、`insertAdjacentBlockRawMarkdown`、`moveBlockRawMarkdown` 四大纯函数，删除首块/中间块/末块时自动消除残留双空行或首尾孤立空行，并配套 `tests/test-markdown-block-editor.mjs` 单元测试套件。

---

## [1.3.14] - 2026-10-21

> [!TIP] v1.3.14 变更亮点
> 深度修复 SVG 编辑引擎图元选中、编组拖拽移动、变换手柄、对齐分布与锚点操作的核心交互 Bug，彻底消除拖拽下钻冲突、60 FPS 导出卡顿与解组跳跃。

### 🎨 Fixed & Improved (SVG 编辑引擎交互与几何变换修复)

- **点击下钻与拖拽移动精准解耦 (Drilldown vs Drag Separation)**:
  - 修复鼠标按下（`down`）已选编组时立即错误下钻到子叶子节点、导致无法移动整个编组且把子图元拖散的严重缺陷；
  - 建立拖拽状态机：在按下阶段坚决保持当前编组层级并直接进入平移手势，仅在原地点击释放（无位移）时才循序下钻至直接子节点。
- **拖拽高频重导出卡顿消除 (Drag Throttle & Interaction Mutex)**:
  - 引入 `Runtime.isInteracting` 状态与互斥门禁，在拖拽缩放（Scale）、旋转（Rotate）与移动（Move）过程中挂起高耗时全量导出与 `onContentChange` 宿主回写；
  - 仅在指针松开 `Commit` 时原子化触发写回，彻底消除 60 FPS 连续拖拽过程中的重绘卡顿与宿主状态竞争。
- **编组解散绝对坐标防跳跃 (Ungroup Affine Preservation)**:
  - 重构 `object.ungroup` 算法，在解散编组时通过仿射矩阵组合（`composeTransforms`）将 Group 变换完整吸收至各子图元，解组后子元素在画布上的绝对世界坐标 100% 保持不变；
  - 兼容单组 ID（`id`）与多组数组（`ids`）调度，并自动接管所有释放子图元的激活选区。
- **跨坐标系对齐与画布基准校准 (World Coordinate Alignment & Distribute)**:
  - 重构 `object.align` 与 `object.distribute`，基于绝对世界包围盒（`nodeWorldBBox`）与逆向父级变换矩阵计算位移增量，彻底解决嵌套 Group 或带局部旋转缩放图元对齐时的轴向偏离；
  - 修复选区检查条件，支持单个选中图元基于画布基准（Canvas Relative）居中对齐，解除 Inspector 按钮禁用限制。
- **全选防嵌套双重位移叠加 (Select-All Hierarchy Guard)**:
  - 修复 `select.all` 全量收集所有内部子节点导致批量移动时子节点承受「自身平移 + 父级平移」双重位移的 Bug，限定全选仅收集可见图层的第一级直接子图元；
  - 在 v1 引擎 `batchMoveSvgElements` 中同步增加不相交祖先过滤（Disjoint Ancestor Filter），杜绝批量移动时子级元素发生位移叠加。
- **带类名与缺省填充图形命中率提升 (SVG Hit-Test & CSS Class Support)**:
  - 遵循 W3C SVG 规范将缺失 fill/stroke 的形状默认填充修正为黑色，修复 Illustrator / Draw.io 等生成的不带内联样式的几何图形无法点选的问题；
  - 增强 `hitNodeLocal` 对带 CSS `className` 类名图元的命中测试；
  - 在 `nodeTool`（直接选区与锚点编辑）中接入绝对世界变换（`nodeWorldTransform`），精准捕获多层编组内的顶点锚点并实现 1:1 拖拽同步。

---

## [1.3.13] - 2026-10-21

> [!TIP] v1.3.13 核心升级亮点
> 落地 Markdown 图片三大扩展语义容器（`[!GALLERY]`、`[!FIGURE]`、`[!MEDIA]`）及工作台偏好设置全主题自适应系统，彻底消除浅色主题下的色值失真与对比度缺陷。

### ✨ Added (新增功能与排版容器)

- **GitHub Alert 思想三大图片语义容器 (`src/features/viewers/hooks/useMarkdownAstPipeline.ts`, `src/index.css`)**:
  - **多图画廊网格 (`> [!GALLERY:2~6]` / `[!IMAGES]`)**：支持 1~6 列自适应网格与 CSS Container Queries 响应式折叠，自动提取每张图片的 `alt` 文本生成底部居中图注（`.ov-image-caption`），支持 `+`/`-` 手风琴折叠；
  - **标准技术图件框 (`> [!FIGURE]` / `[!FIG]`)**：渲染为语义化 `<figure>` 居中舞台与 `<figcaption>` 编号图注，同时兼容括号外标题（`> [!FIGURE] 图 1-1`）与括号内联标题（`> [!FIGURE 图 1-1]`）语法；
  - **图文并排分栏 (`> [!MEDIA]` / `[!MEDIA:RIGHT]`)**：支持左图右文或左文右图的 5:7 黄金比例并排呈现，窄屏自动流式折行。
- **图片轻量管道修饰符与主题感知引擎 (`parseMarkdownImageModifiers`)**:
  - 支持尺寸控制（`|480`、`|60%`、`|400x300`）、对齐与造型（`|left`、`|right`、`|center`、`|rounded`、`|circle`、`|flat`）与显式图注（`|caption`）；
  - **透明底反差衬板（`|bg-light` / `|bg-dark` / `|bg-checker`）**：彻底解决透明底深色线条架构图在深色主题下“隐形”的痛点；
  - **GitHub 主题感知显隐（`#gh-dark-mode-only` / `#gh-light-mode-only`）**：联动 `#markdown-viewer-canvas[data-theme-mode]` 与全量 16 套主题，自动按深浅色切换对应图片版本。

### 🎨 Fixed & Improved (全主题自适应与视觉融合)

- **工作台配置中心（Workbench Settings Modal）全主题像素级融合**:
  - **下拉框与输入控件（Select / Input）对比度修复**：修复在明雅日光（Clean Light）、暖阳羊皮（Sepia）等浅色主题下原生下拉选择框（界面语言、正文宽度、分屏模式等）呈现暗黑底色导致黑字在深底上无法辨识的问题，全面依托 `--ov-surface` 与 `--ov-border` 实现随主题动态切换底色与文字颜色；
  - **色彩主题卡片（Theme Selection Cards）高对比度呈现**：修复未选中卡片使用非法类名 `bg-slate-850` 导致的透明底色与浅灰文字（`text-slate-300`）失真，重构为基于 `--ov-surface-secondary` 与 `--ov-border` 的语义化卡片，标题与副标题在所有深浅主题下均具备清晰对比度；
  - **激活态按钮文本失真修复**：消除激活卡片与单选钮在浅色半透明背景（`bg-blue-600/15`）上使用固定 `text-white` 导致的白底白字失真，改为自适应的高对比度品牌色方案（`text-blue-600 dark:text-blue-400` / `var(--ov-accent)`）；
  - **分段控制器（Segmented Controls）容器与高亮适配**：信息排版密度、文档大纲位置、文档展示形态与思维导图分屏比例控制器全面接入 `--ov-surface-header` 与 `--ov-border`，未激活按钮具备良好的次级文本反差，激活按钮呈现清晰的填充态高亮；
  - **宿主注入与第三方模拟切换器适配**：VS Code 原生注入说明面板与 One Dark Pro、Dracula 等模拟注入胶囊按钮在浅色主题下自适应背景与边框，杜绝浅底中突兀的深黑胶囊浮动；
  - **全六大 Tab 视觉对齐**：快捷键清单 `<kbd>`、六大存储分区统计数值与清理按钮、日志检视面板全面移除硬编码固定深色，100% 依附 `--ov-*` 语义化设计令牌系统。

### 📚 Documentation & Tests (规范与测试闭环)

- **Markdown 创作技能库与全景样例同步 (`.codex/skills/omniview-markdown-authoring/`, `examples/markdown/`)**:
  - 全面更新 `SKILL.md`、`callouts-and-cards.md`、`diagrams-and-visuals.md` 以及 `github-alert-callouts.md`、`callouts-and-tasks.md` 实战样例；
  - 在 `tests/test-markdown-image-resolver.mjs` 与 `tests/test-markdown-callout-task.mjs` 中补齐图片管道修饰符与扩展容器单元测试。

---

## [1.3.12] - 2026-10-20

> [!TIP] v1.3.12 变更亮点
> 优化 AI 辅助技能配置体系，将工作区私有 skills 目录无缝迁移至系统全局，精简仓库冗余。

### 🧹 Chore (工程维护与配置清理)

- **AI 技能架构迁移与冗余清理**:
  - 将 `.agents/skills/create-skill` 迁移至系统全局技能配置目录；
  - 清理本地工作区 `.agents` 冗余目录，保持工作区轻量规范。

---

## [1.3.11] - 2026-10-19

> [!TIP] v1.3.11 核心修复亮点
> 彻底解决可折叠 Alert、卡片矩阵及手风琴的折叠箭头（chevron）随标题文本长短随意停靠漂移的布局缺陷，100% 强约束贴齐最右侧对齐。

### 🐛 Fixed (交互与布局修复)

- **可折叠 Callout 折叠箭头靠右固定对齐修复 (`src/index.css`)**:
  - **100% 容器宽度强约束**：为所有折叠 `<summary>` 容器强制注入 `width: 100% !important` 与 `box-sizing: border-box !important`，消除原生 `<summary>` 默认按内容收缩（shrink-to-fit）导致箭头跟在文字后方忽左忽右的问题；
  - **Flexbox 左右两极解耦**：左侧标题容器声明 `flex: 1 1 auto; min-width: 0; padding-right: 12px;`，标题文字开启 `word-break: break-word`；折叠箭头声明 `margin-left: auto !important; flex-shrink: 0 !important;`；
  - **整齐划一视觉对齐**：无论标题只有几个字、还是换行 2~3 行，所有卡片的折叠箭头绝对固定靠齐在卡片最右侧边框内，在垂直方向上呈现完美垂直对齐线。

---

## [1.3.10] - 2026-10-19


> [!TIP] v1.3.10 变更亮点
> 将 `skills:omniview-markdown-authoring` 现代排版规范正式固化并整合入 OmniView AI-SE 软件工程顶层体系，确立 Markdown 现代排版硬性契约。

### 🏛️ Governance & AI-SE (工程治理与规范整合)

- **Markdown 现代排版契约全面固化 (`AGENTS.md` & `.codex/rules/`)**:
  - **总控路由与治理条款整合 (`AGENTS.md`)**：在「AI-SE 治理补充条款」中正式写入《Markdown 文档现代排版契约》，规定所有对外展示型 Markdown 文档必须默认激活 `skills:omniview-markdown-authoring`；
  - **软件工程总则同步 (`.codex/rules/engineering.md`)**：新增现代排版约束条款，禁止在关键文档中继续堆叠冗长平铺文本；
  - **代码-文档同步矩阵更新 (`.codex/rules/doc-sync.md`)**：将 Markdown 现代排版演进正式纳为核心同步矩阵检查条目；
  - **Codex 索引与测试闭环**：同步更新 `codex.index.json`，并通过全部 84 套自动化测试与门禁验证。

---

## [1.3.9] - 2026-10-19


> [!TIP] v1.3.9 变更亮点
> 依据 `omniview-markdown-authoring` 现代编排范式全面重构 CHANGELOG，引入横幅公告（BANNER）、方案对比卡片（COMPARE）、高光提示（TIP）与历史版本折叠手风琴（NOTE-）。

### 🎨 Documentation & UX (文档体验升级)

- **CHANGELOG 现代交互式编排架构演进 (`CHANGELOG.md`)**:
  - **Banner 宣传横幅与概览**：在首屏引入 `> [!BANNER]`，呈现清晰的发布大厅定位与现代化视觉引导；
  - **重要升级对比卡片**：集成 `> [!COMPARE]` 卡片，直观展现版本更迭前后的体验差异；
  - **历史版本折叠手风琴**：将庞大的历史版本列表封装入 `> [!NOTE]-` 手风琴中，默认收敛，告别冗长滚动，支持一键按需展开探查；
  - **100% 优雅降级兼容**：完全贴合 CommonMark 标准与 Keep a Changelog 规范，在纯文本及 GitHub 原生网页下自动退化为干净引用块。

---

## [1.3.8] - 2026-10-19


> [!TIP] v1.3.8 核心升级亮点
> 本次更新彻底修复了可折叠 Alert 与交互式手风琴在展开/收起时的折叠图标漂移缺陷，新增了权威的 GitHub Alert Callout 全景示例范式，并依照 Antigravity `create-skill` 标准对整个 Markdown 编排技能树进行了渐进式模块化重构。

> [!COMPARE] 折叠手风琴图标交互体验重构对比
> - **旧版实现 (Before)**
>   - 折叠收起时图标向上漂移 16px，展开与收缩视觉位置不一致
>   - 易受通用正文全局 SVG 规则误伤导致变形或异常外边距
>   - Safari / WebKit 下存在原生 summary marker 幽灵间隙
> - **现代重构实现 (After)**
>   - 严格约束 `transform-origin: 50% 50%` 与 `transform-box: fill-box`
>   - 全局 SVG 规则升级为 `svg:not([class*="ov-"])` 实施精准类名隔离
>   - 强制重置 `summary::-webkit-details-marker`，全浏览器像素级对齐

### ✨ Added (新增特性与规范演进)

- **GitHub Alert Callout 全景示例范本与全能力覆盖 (`examples/markdown/github-alert-callouts.md`)**:
  - 新增全景权威示例文件，完整覆盖 GitHub Alert Callout 核心设计哲学、CommonMark 优雅降级优先、WAI-ARIA 可访问性；
  - 覆盖官方 5 大标准语义（`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`）与扩展生态语义（`SUCCESS`, `QUESTION`, `EXAMPLE`, `QUOTE`）；
  - 覆盖折叠手风琴交互（`-` 默认收起 / `+` 默认展开）、自定义标题、复杂富媒体内嵌（多语言代码块、KaTeX 数学公式、数据表格、Task List 交互回写、Mermaid 图表、多层嵌套）；
  - 覆盖 1 行 2/3/4/6 列卡片矩阵（`[!CARDS:N]`）、单体独立高光卡片（`[!CARD]`）、折叠卡片矩阵（`[!CARDS:3]-`）与容器查询响应式断点；
  - 覆盖生产实战综合场景（架构决策记录 ADR、生产事故复盘 Postmortem、安全预警 Advisory）。
- **AI 技能工程与 Markdown 编排规范模块化重构 (`.codex/skills/omniview-markdown-authoring`)**:
  - 依照 Antigravity `create-skill` 架构规范全面重构技能目录，推行渐进式披露与按需加载原则；
  - 精简总入口 `SKILL.md`，将上下文消耗降低 65%，并将深度规则与专项细节下沉至 `references/`（卡片与容器、图表与矢量、数学公式、11 大反模式）；
  - 提供开箱即用的真实企业级架构与版本说明范本至 `examples/`；
  - 引入并在工作区安装 `create-skill` 技能脚手架。

### 🐛 Fixed (缺陷修复)

- **可折叠 Callout (`[!TIP]-`) 与交互手风琴收缩与展开折叠图标定位一致性修复 (`src/index.css`)**:
  - **旋转中心点严格约束**：为 `.ov-callout-fold-icon` 与 `.ov-faq-chevron` 显式注入 `transform-origin: 50% 50%` 与 `transform-box: fill-box`，彻底消除 SVG 默认 `(0, 0)` 旋转中心导致的展开前后水平与垂直位置跳跃（-16px 漂移）；
  - **Flexbox 盒模型与原生伪元素重置**：为所有折叠 `<summary>` 容器强制声明 `display: flex !important`，并彻底清除 `summary::-webkit-details-marker` 与 `summary::marker` 原生标记，防止 Safari/WebKit 下伪元素幽灵间隙干扰；
  - **正文全局 SVG 规则防误伤**：在通用 Markdown 正文 SVG 自适应规则中，将排除选择器从单一 `.ov-callout-icon` 全面升级为 `svg:not([class*="ov-"])`，彻底防止折叠箭头被注入异常 `margin: 18px auto` 与拉伸变形；
  - **标准 Markdown `<details><summary>` 优雅融合**：补充原生折叠标签的美化样式，保障标准 CommonMark 折叠与扩展 Callout 视觉质感完全统一。

---

## 历史版本归档 (Archive & Version History)

> [!NOTE]- [1.3.6] - 2026-10-19 · Vite 6 宿主请求拦截安全限制修复
> ### Fixed
> - **Vite 6 宿主请求拦截安全限制修复 (`vite.config.ts`)**:
>   - 配置 `server.allowedHosts: true` 与 `preview.allowedHosts: true`，彻底消除在 Cloud Run / AI Studio 代理域名访问时触发的 Vite 6 默认 Host 拦截策略 (`403 Forbidden: Blocked request. This host is not allowed`)；
>   - 修正动态模块加载链路，避免浏览器向 Cloud Run 宿主请求驱动 chunk 时因 403 导致 `Failed to fetch dynamically imported module: MarkdownViewer.tsx`；
>   - 将 `base` 路径在开发环境下恢复为 `'/'` (生产构建维持 `'./'`)，保障动态分块与资源路径规范解析。

> [!NOTE]- [1.3.5] - 2026-10-19 · 异步驱动动态加载故障与自愈机制修复
> ### Fixed
> - **异步驱动动态加载故障与自愈机制修复 (`resilientImport` & `driverRegistry.tsx`)**:
>   - **弹性异步加载机制 (`resilientImport.ts`)**：实现带有指数退避（Exponential Backoff）与 3 次自动重试的动态加载器，根治网络抖动与 Vite 热更时偶发的 `TypeError: Failed to fetch dynamically imported module`；
>   - **自愈式驱动缓存与重置 (`driverRegistry.tsx`)**：在动态加载失败时自动剔除缓存项，避免 React `lazy()` 永久锁死在 rejected 状态，让后续重试与渲染能够重新请求模块；
>   - **统一 Markdown 驱动分发工厂**：消除 `driverRegistry.tsx` 中分散的静态 `lazy()` 定义，使多模式渲染与单模式共用同一套弹性驱动工厂；
>   - **文档中心驱动接入 (`DocCenter.tsx`)**：将文档中心全局懒加载统一接入 `resilientImport`；
>   - **错误边界自愈重置增强 (`RenderErrorBoundary.tsx`)**：捕获动态模块载入故障时自动清空驱动映射缓存，并在重试按钮触发时重置状态，提供友好的故障引导提示。

> [!NOTE]- [1.3.4] - 2026-10-19 · GitHub Alert Callout 核心思想高阶排版组件生态全面落地
> ### Added
> - **GitHub Alert Callout 核心思想高阶排版组件生态全面落地 (`useMarkdownAstPipeline` & `index.css`)**:
>   - **8 大高阶排版与交互组件完整实现**：
>     1. **多标签页组 (`> [!TABS]` / `> [!TAB]`)**：支持多语言代码命令、包管理器快速安装切换，具备原生交互点击即切换面板；
>     2. **流程步骤条 (`> [!STEPS]` / `> [!STEP]`)**：向导式垂直时间轴与数字编号圆形徽章引导，适用于新手教程与排错三部曲；
>     3. **里程碑时间线 (`> [!TIMELINE]`)**：轴线节点与双环发光圆点，适用于版本发布历程与架构路线图；
>     4. **方案多维对照 (`> [!COMPARE]` / `> [!DIFF]`)**：多栏卡片对比布局，红/绿语义顶边框高光对比重点（Before vs After / 方案选型）；
>     5. **核心 KPI 指标看板 (`> [!METRICS]` / `> [!STATS]` / `> [!KPI]`)**：大号数字与说明文字悬浮卡片，支持网格自适应；
>     6. **交互式问答手风琴 (`> [!FAQ]`)**：基于原生 `<details><summary>` 构建的零 JS 依赖平滑手风琴，支持单项折叠展开与旋转 Chevron 动效；
>     7. **开发者与名家引言墙 (`> [!QUOTES]` / `> [!QUOTE-WALL]`)**：斜体引语、大号引号装饰与左侧高贵紫强调边框；
>     8. **首屏高光宣传横幅 (`> [!BANNER]` / `> [!HERO]`)**：微光渐变背景与矢量徽标，适用于重大发布与文档首屏公告；
>   - **AST 流水线与事件委托打通 (`MarkdownViewer.tsx`)**：在 Markdown 视口增加容器级点击事件委托，秒级完成 Tab 切换与无状态交互；
>   - **块级原地编辑器类型全面识别 (`markdownBlockEditor.ts`)**：支持识别 Tabs 标签页组、Steps 步骤条、Timeline 时间线、Compare 对比卡片、Metrics 指标看板、FAQ 问答手风琴、Quotes 引言墙与 Banner 宣传横幅；
>   - **单元测试 100% 覆盖与演练样本同步**：`tests/test-markdown-callout-task.mjs` 新增第 5 组全量扩展组件解析与别名覆盖测试，并在 `examples/markdown/callouts-and-tasks.md` 中补充第六章完整实战演练；
>   - **技能库全面扩充更新**：在 `.codex/skills/omniview-markdown-authoring/SKILL.md` 中同步更新决策树、8 大组件实操范式与模板代码，并完成 codex 索引重新构建。

> [!NOTE]- [1.3.3] - 2026-10-19 · 多列卡片矩阵与独立卡片渲染引擎
> ### Added
> - **GitHub Alert Callout 思想多列卡片矩阵与独立卡片渲染引擎 (`useMarkdownAstPipeline` & `index.css`)**:
>   - **多列卡片矩阵语法支持**：沿用 GitHub Alert 核心哲学，新增支持 `> [!CARDS:3]`、`> [!CARDS:4]`、`> [!CARDS:6]`、`> [!CARD]`、`> [!CARD-GRID]` 及属性式 `cols=1-6`，在标准 Markdown 规范下将无序列表直接渲染为高质感的一行 3/4/6 列卡片矩阵；
>   - **100% 优雅降级 (Graceful Degradation)**：在不支持该特性的古老解析器或纯文本环境中，安全退化为标准的引用列表，0 报错、0 破坏语法树，内容 100% 完整无损；
>   - **现代 CSS 容器查询自适应断点 (Container Queries)**：卡片网格引入 `container-type: inline-size`，在 VS Code 分屏拖拽或小屏视口时自适应优雅折叠（6/5/4 列 -> 2 列 -> 1 列），彻底杜绝拥挤变形；
>   - **全主题设计令牌与微交互动效**：卡片全面绑定 `--ov-*` 语义化设计令牌，适配亮暗主题与 VS Code 原生宿主主题，具备顶部渐变高光指示条与 `translateY(-2px)` 微浮动阴影增强动效；
>   - **块级编辑器无缝识别 (`markdownBlockEditor.ts`)**：支持在原地专注编辑器中精准标注「`Card 卡片矩阵网格`」与「`Card 独立卡片`」；
>   - **单元测试与演练样例落地**：在 `tests/test-markdown-callout-task.mjs` 中新增针对 3/4/6 列、属性语法与折叠状态的完整单测套件，并同步更新样例 `examples/markdown/callouts-and-tasks.md`；
>   - **技能体系深度扩充**：在 `.codex/skills/omniview-markdown-authoring/SKILL.md` 中完整收录 GitHub Alert Callout 核心设计哲学、排版黄金法则、多列卡片代码模板与避坑指南。

> [!NOTE]- [1.3.2] - 2026-10-19 · Markdown 预览窗口块级原地专注编辑工作台
> ### Added
> - **Markdown 预览窗口块级原地专注编辑工作台 (Scheme A: Block In-place Focused Card Editor)**:
>   - **零宏污染块级真实源码切片与空行守恒回写 (`markdownBlockEditor.ts`)**：基于 AST 块行号区间 `[startLine, endLine]` 直接从原始 Markdown 文档切片提取真实源码，彻底隔离数学公式与脚注前置占位宏污染；保存回写时严格保持块间原有空行与换行结构守恒；
>   - **原地专注编辑卡片 (`MarkdownFocusedBlockEditor`)**：在预览/分屏窗口内直接将目标块无缝展开为高内聚编辑卡片，支持「纯源码编辑 (`source`)」与「左源码 + 右实时微预览 (`split`)」双模式一键切换；内置块语义识别徽标、快捷语法插入栏（H2/H3、加粗、斜体、行内代码、数学公式、链接、列表、Callout）、`Tab` 缩进续行、`Cmd/Ctrl + Enter` 极速保存与 `Esc` 未保存防误触保护；
>   - **聚光灯沉浸降噪模式 (Spotlight Dimming)**：激活单块原地专注编辑时，文档其余预览块自动平滑降低视觉不透明度（`opacity: 0.35`），聚焦当前段落心流，支持在卡片顶栏随时一键开关；
>   - **三重丝滑触发入口**：支持块右上角悬浮「专注编辑」胶囊按钮、`Alt + 双击` 任意预览块直达、以及在划词悬浮工具栏 (`MarkdownBubbleToolbar`) 内一键下钻至所属块专注编辑。
> - **Markdown 划选悬浮工具栏扩充与跨行块级转换 (`MarkdownBubbleToolbar` & `markdownSelectionReplacer`)**:
>   - **单行富文本语法全面扩充**：在原有加粗、斜体、行内代码、超链接、双向链接基础上，新增删除线 (`~~S~~`)、高亮标记 (`==H==`)、上标 (`X²`)、下标 (`X₂`) 与键盘按键徽标 (`<kbd>`)；
>   - **跨行选区智能块级格式化 (`formatMultiLineSelection`)**：当划选范围跨越多个自然行时，悬浮工具栏自动切换为块级转换模式，支持一键将多行文本包装或幂等剥离为「多行引用块 (`>`)」、「代码围栏 (` ``` `)」、「Callout 警示框 (`> [!NOTE]` / `[!TIP]` / `[!WARNING]`)」，以及直接下钻开启块级原地专注编辑。
> - **Markdown 分屏实时编辑全能力对齐与图片拖拽缩放回写 (`MarkdownViewer` & `markdownImageResize`)**:
>   - **分屏模式 (`split`) 双向交互打通**：右侧实时预览窗完整接入「双击精准定位源码行（仅平滑滚动并移动左侧光标，不打断分屏布局）」、「划词悬浮格式化回写」与「Word / WPS 双通道富文本清洗复制」；
>   - **预览窗图片可视化拖拽缩放与源码无损回写 (`markdownImageResize.ts`)**：鼠标悬浮预览区图片时浮现实时宽度 HUD 与右下角拖拽缩放手柄（`120px ~ 1200px`），松手后基于源码行号将 `![alt](url)` 或 `<img>` 标签无损更新为标准 `<img src="..." alt="..." width="xxx" />`，并支持一键重置原始尺寸。
> ### Fixed
> - **代码块悬浮顶栏视觉减负 (`CodeBlock` & `codeBlockHeaderHelper`)**：重构代码块头部工具栏层级，仅保留语言标识与长代码折叠控制常驻展示，将自动折行、只读标签、局部主题切换、全屏预览与复制按钮收纳至鼠标悬浮（`group-hover`）或键盘聚焦（`focus-within`）渐显容器，并在触屏设备上自动回退常驻以保障可达性。
> - **HTML 块内嵌元素源码行号精确同步 (`useMarkdownAstPipeline`)**：修复 `renderHtmlToken` 渲染自定义块时 `currentTokenStartLine` 未同步更新导致块内嵌子节点 `data-source-line` 偏移的问题。

> [!NOTE]- [1.3.1] - 2026-10-17 · SVG v2 子节点下钻选择与多选交互体验全面重构
> ### Fixed
> - **SVG v2 子节点下钻选择与多选交互体验全面重构与增强 (Child Node Drilldown & Multi-Selection Enhancements)**:
>   - **子节点下钻选择 (Progressive Drilldown & Deep Select)**:
>     - **循序下钻交互**：未选中编组时点击选中最外层 Group；当 Group 已选中时再次点击内部图元自动下钻一级选中其直接子节点；
>     - **穿透直选 (Cmd/Ctrl+Click)**：按住 `Cmd` (Mac) 或 `Ctrl` (Windows) 单击画布任意深层嵌套图元，直接穿透所有编组外壳精准直达底层原子叶子节点；
>     - **双击下钻与防抖防重置**：双击任意图元直接下钻选中光标底部的具体原子子节点，并阻止冒泡彻底防止误触画布视口 100% 重置手势；
>     - **键盘层级穿梭 (Escape / Enter)**：选中子节点时按 `Escape` 自动跳至上级编组（顶级时清空选区）；选中编组时按 `Enter` 直接下钻全选编组内部子图元；
>     - **绝对世界包围盒 (`nodeWorldBBox`)**：新增 `nodeWorldTransform` 与 `nodeWorldBBox` 纯函数，递归累加祖先变换链，彻底解决子节点在嵌套编组中选中框、8 向变形手柄与悬浮 HUD 坐标偏移错位的问题；
>   - **多选交互与批量操作全面强化 (Multi-Selection & Batch Operations)**:
>     - **图层面板多选支持 (`SvgV2LayersPanel`)**：图层列表项点击全面接入 `Shift`（区间/加选）与 `Cmd/Ctrl`（反选/剔除）多选修饰键；
>     - **多选变换安全防线 (`keepDisjointRoots`)**：在 `object.move`、`object.scale`、`object.rotate`、`object.duplicate` 与 `object.delete` 命令中严格过滤保留顶级互斥根节点，彻底杜绝父子同时被选时发生的二次位移、二次缩放或并发删除报错；
>     - **编组内与深层框选 (`selectBox`)**：框选自动适配当前所处编组，并在根坐标系下精准比对 `nodeWorldBBox`，防止背景板误选与相交漏选；
>     - **属性检视器批量描边调节 (`SvgV2Inspector`)**：放宽路径描边样式限制，多选多个 Path 时允许一键批量调节描边颜色、粗细、端点与虚线。

> [!NOTE]- [1.3.0] - 2026-10-17 · 里程碑版本 — SVG v2 Advanced Studio 与测试架构重构
> ### Added
> - **OmniView v1.3.0 里程碑版本正式发布 (Milestone Release — SVG v2 Advanced Studio & Test Architecture Refactoring)**:
>   - **SVG v2 专业矢量编辑引擎全链路交付**：
>     - **变形与手柄系统**：8 向缩放手柄等比变形（Shift 锁定宽高比）、15° 步进旋转吸附、对齐与分布计算；
>     - **全套快捷键链路**：`Cmd+D`（图元副本深克隆复制）、`Cmd+G`（多选编组）、`Cmd+Shift+G`（解散编组）、`Cmd+]` / `Cmd+[`（图元层级上移/下移）、`Cmd+Shift+]` / `Cmd+Shift+[`（置顶/置底）；
>     - **右键上下文菜单 (`SvgV2ContextMenu`)**：自适应视口边缘就地弹出，提供快捷复制、编组/解组、层级调度与删除；
>     - **双击穿透选择 (Deep Select Drilldown)**：双击已选编组图元无缝下钻，穿透外壳精准直达具体原子叶子图元；
>     - **智能吸附对齐参考线 (Smart Guides)**：6px 磁吸阈值边界与中心自动吸附，实时渲染洋红虚线导线，`Alt` 键一键抑制；
>     - **悬浮 HUD 快捷工具条 (`SvgV2FloatingHud`)**：自适应浮动于选区包围盒上方，提供常用调色盘预设、描边粗细调节与水平/垂直翻转。
>   - **工程架构与测试体系深度重构**：
>     - **目录架构清晰解耦**：新建根目录 `tests/`，将 84 个测试套件彻底移出 `scripts/`，实现业务测试与构建流水线职责分离；
>     - **统一测试基础设施库 (`tests/harness/`)**：封装 DOM 无头运行时、动态 TSX 模块加载器与自适应动态发现中心；
>     - **极速并发测试调度器**：多进程并发 3 秒跑通 84 个测试套件，支持 `--category` 领域分类筛选与彩色徽标看板；
>   - **物理验证与包产物**：
>     - 全量通过 8 项物理工程门禁，产出高保真生产环境 VS Code 扩展包（`omniview-1.3.0.vsix`）。

> [!NOTE]- [1.2.69] - 2026-10-17 · 测试体系综合封装与架构重构
> ### Added
> - **测试体系综合封装与架构重构 (Test Harness & Directory Architecture Refactoring — 方案 C 全套落地)**:
>   - **测试与工程构建彻底解耦**：将 84 个测试套件从混杂的 `scripts/` 目录完整迁移至根目录独立 `tests/` 空间，`scripts/` 仅专注构建、门禁与发布流水线，项目工程拓扑规范度大幅提升；
>   - **统一测试基础设施库 (`tests/harness/`)**：
>     - `tests/harness/dom-env.mjs`：统一封装 Happy-DOM 运行时、React 19 Act 环境与 Web API Polyfill（DOMRect、DOMPoint、PointerEvents、PointerCapture），彻底消除各无头测试中冗长的全局挂载模板代码；
>     - `tests/harness/module-loader.mjs`：封装基于 esbuild 的无盘/临时内存构建动态加载器，并注册安全退出清理钩子；
>     - `tests/harness/discovery.mjs`：实现自适应动态套件发现引擎与多维领域标签体系（`[headless]`, `[svg]`, `[diagram]`, `[office]`, `[markdown]`, `[storage]`, `[driver]`, `[unit]`），彻底移除静态硬编码清单；
>     - `tests/harness/index.mjs`：统一导出 `describe`、`it`、`assert`、`reportSummary`、`setupDomEnvironment` 与 `bundleAndLoadTsx`；
>   - **测试运行器与覆盖率引擎全面升级**：
>     - `scripts/run-all-tests.mjs`：全面接入动态发现中心，支持 `--category=headless` 领域过滤与分类彩色徽标实时展示，84 套全量测试保持 ~3 秒极速高并发执行；
>     - `scripts/run-coverage.mjs`：废弃脆弱的静态清单正则匹配，直接由 `discovery.mjs` 驱动精准覆盖率度量与反查；
>   - **代表性无头用例精简重构**：重构 `test-headless-ui-interactions.mjs` 与 `test-svg-v2-advanced-interactions.mjs`，消除 120+ 行重复样板代码；
>   - **全量物理门禁严格回归**：更新规范约束与文档事实，Codex Linter、文档一致性门禁、React 治理、TypeScript 类型检查与 84 套全量测试 100% 绿色通过。

> [!NOTE]- [1.2.68] - 2026-10-17 · SVG v2 专业级高级交互体系全量落地
> ### Added
> - **SVG v2 专业级高级交互体系全量落地 (Phase 1 / Phase 2 / Phase 3 Full Delivery — L2)**:
>   - **Phase 1: 快捷键链路与图元复制解编组**：
>     - 新增 `object.duplicate` 核心引擎命令：支持递归深拷贝子图元节点、自动重新分配新 `NodeId`、应用坐标偏移（默认 +10px）并自动接管选区；
>     - 补齐专业快捷键链路：支持 `Cmd+D`（快速复制副本）、`Cmd+G`（多选图元编组）、`Cmd+Shift+G`（解散编组）、`Cmd+]` / `Cmd+[`（图元层级上移/下移）与 `Cmd+Shift+]` / `Cmd+Shift+[`（图元置顶/置底）；
>   - **Phase 2: 右键上下文菜单与双击穿透选择 (Deep Select Drilldown)**：
>     - 新建 `SvgV2ContextMenu` 悬浮上下文菜单：支持就地复制、图元编组/解组、层级移动与快速删除，具备视口边缘贴合与点击外部/Esc 自动关闭机制；
>     - 双击下钻穿透：当双击已选中的 Group 图元时，指针事件自动穿透编组外壳，精准选中光标所指的具体原子子节点（Leaf Child），极大提升复杂组合 SVG 的局部精细编辑效率；
>   - **Phase 3: 智能吸附参考线 (Smart Guides) 与悬浮 HUD 工具条**：
>     - 智能磁吸辅助线：拖拽图元时自动计算与画布其他图元边界（左/中/右、顶/中/底）的临近距离，小于吸附阈值（6px）时自动触发物理磁吸并实时渲染高对比度洋红色（`#ec4899`）对齐导线；按住 `Alt` 拖拽时可一键抑制吸附；
>     - 新建 `SvgV2FloatingHud` 快捷悬浮工具栏：当有图元选中时自适应锚定于外包围盒上方，提供常用填充调色盘预设、描边粗细快速调节、水平翻转（Flip H）、垂直翻转（Flip V）、复制副本与删除操作；
>   - **全量无头测试扩增至 84 套**：新增 `tests/test-svg-v2-advanced-interactions.mjs`，覆盖复制算法、快捷键链路、双击穿透、吸附导线与 UI DOM 交互，9 项核心测试 100% 绿色通过。

> [!NOTE]- [1.2.67] - 2026-10-17 · 组件级 Headless DOM 真实交互验证与覆盖率度量体系
> ### Added
> - **组件级 Headless DOM 真实交互验证与覆盖率度量体系 (Headless UI Testing & Coverage Engine — L2)**:
>   - **建议 B 落地 — 组件级 Headless DOM 交互套件 (`tests/test-headless-ui-interactions.mjs`)**：
>     - 基于 `happy-dom` 真实无头运行时与 `esbuild` 快速编译，直接驱动 React 19 组件渲染与原生 DOM 事件；
>     - **全屏灯箱 (`LightboxModal`)**：验证 `createPortal` 真实挂载、滚轮缩放事件派发、双击 2.5x 聚焦及 Esc 关闭回调；
>     - **矢量画布 (`SvgV2Canvas`)**：验证真实 SVG DOM 挂载、选区设置与图元渲染；
>     - **图层树面板 (`SvgV2LayersPanel`)**：验证图层行层级渲染、显隐切换点击与指令下发；
>     - **键盘事件隔离**：验证 Escape / Delete 快捷键生命周期与焦点隔离；
>   - **建议 C 落地 — 自动化测试代码覆盖率度量运行器 (`scripts/run-coverage.mjs`)**：
>     - 集成原生 V8 覆盖率引擎与 `c8` 报表生成器；
>     - 借助 `esbuild` inline source-map 机制将执行流 100% 精准回溯至 TypeScript / TSX 源码；
>     - 多进程并发无锁收集覆盖率数据，输出终端文本表格看板、`coverage/lcov.info`（CI 门禁规范契约）以及 `coverage/index.html`（交互式可视化报告）；
>     - 在 `package.json` 中配置 `"test:coverage": "node scripts/run-coverage.mjs"`，支持局部或全量覆盖率极速分析；
>   - **全量测试套件扩增**：全项目自动化测试套件扩增至 **83 套**，全部持续保持 100% 绿色通过。

> [!NOTE]- [1.2.66] - 2026-10-17 · 自动化测试链条解耦与多核并发运行器
> ### Added
> - **自动化测试链条解耦与多核并发运行器 (Concurrent Test Runner & Orchestrator — L2)**:
>   - **测试运行器彻底解耦 (`scripts/run-all-tests.mjs`)**：将 `package.json` 中长达 3000 多字符的单行 `&&` 命令行串联重构为专业测试调度器；
>   - **多进程并发调度与极速执行**：内置轻量原生并发控制池（默认 6 并发），82 个全量大型测试套件执行耗时压减至 **2.9 秒**（并发加速比 ~5.8x）；
>   - **智能参数筛选与局部调试**：原生支持 `npm test -- svg` 或 `--filter=math` 极速单模块测试与 `--serial` 串行调试模式；
>   - **自适应动态套件发现**：自动扫描 `tests/test-*.mjs` 并智能适配打包参数，防止新增单测遗漏；
>   - **美化聚合报告与错误重放**：集中展示实时执行进度、各套件耗时、失败用例日志回放与汇总看板。

> [!NOTE]- [1.2.65] - 2026-10-17 · SVG v2 元素选择专项体系全量增强
> ### Added
> - **SVG v2 元素选择专项体系全量增强 (SVG v2 Selection System Enhancements — L2)**:
>   - **Shift + Click 反选剔除机制 (Toggle Selection)**：实现专业 `selectionToggle` 纯函数算法与 `select.set` 命令扩展；按住 Shift 单击已选图元时精准将其移出多选集合，未选图元则追加合并，主选对象（`primaryId`）自动顺移，彻底解决多选状态无法单项剔除的痛点；
>   - **高精度轮廓与描边命中测试 (Precise Shape & Stroke Hit Testing)**：重构底层 `hitNodeLocal` 算法，摒弃粗糙的矩形外包围盒碰撞；纯描边（无 fill）图形采用严格的点到线段与贝塞尔曲线距离平方算法（$\le (\text{tol} + \text{width}/2)^2$），空心内部空白区域彻底实现无感穿透，不再误选线条；带填充的多边形采用射线交叉法（Point-in-Polygon）进行实体判定；
>   - **编组默认选择与 Cmd/Ctrl 穿透 (Group-first vs Deep Select)**：默认状态下单点 Group 内元素自动寻径至最外层编组（`findOutermostGroup`），避免误散碎选出子路径；按住 `Cmd / Ctrl`（或调用 `deepSelect`）时无视层级穿透直接命中光标底部的具体原子子图元；
>   - **多层重叠图元循环点选与 Alt 穿透 (Cycle Selection)**：实现 `hitTestAllAtPoint` 获取光标下所有重叠图元候选序列；用户在同一坐标位置连续单击时，自动循环轮转切换选中下一层图元，按住 `Alt` 点击亦可直接穿透选中底层；
>   - **多选态图元拖拽保护**：当处于多选状态时，光标落在其中任意一个已选图元上拖动，不再重置选区，而是直接进入选区整体移动手势（`Begin move`）；
>   - **框选模式优化与全图大底图保护 (Enclosed vs Intersecting)**：`select.box` 默认支持完全包含（`enclosed`）与触碰相交（`intersect`）双模式；从左向右拉框为温和蓝色完全包含选，从右向左拉框为浅绿色触碰相交选；自动识别面积超过 80% 画布的大背景底图并在局部框选时免除误触；
>   - **多选复合轮廓高亮视觉反馈**：多选时，每个被选图元独立叠加单像素虚线浅色轮廓，外层再套统一变换 Gizmo，明确选区范围；
>   - **自动化测试回归套件**：新增 `tests/test-svg-selection-enhancements.mjs`，包含 8 项端到端选区增强单元测试，并接入自动化门禁流水线。

> [!NOTE]- [1.2.64] - 2026-10-17 · 全屏灯箱基于光标位置的无级精准缩放
> ### Added
> - **全屏灯箱渲染图基于光标位置的无级精准缩放 (Lightbox Focal Point Zoom to Cursor — L2)**:
>   - **几何不变性光标锚定 (Focal Invariance)**：实现全新 `focalZoom.ts` 纯函数计算引擎，缩放时基于公式 $\text{pan}_{\text{new}} = \text{offset} - (\text{offset} - \text{pan}_{\text{old}}) \cdot (\text{zoom}_{\text{new}} / \text{zoom}_{\text{old}})$ 精准锚定光标点，缩放前后光标所指图元内容在屏幕上处于绝对同一物理像素，彻底消除缩放向屏幕中心漂移；
>   - **滚轮与触控板连续缩放**：支持常规滚轮阶梯（1.15 / 0.87）与触控板连续双指捏合平滑指数缩放；滚轮缩放期间动态关闭 CSS transition 缓动，实现 60 FPS 紧贴光标无延迟飘移；
>   - **交互触点全面锚定**：鼠标滚轮、键盘快捷键 `+`/`-`、工具栏缩放按钮以及画布双击放大均 100% 绑定至当前光标物理坐标；
>   - **画布双击智能聚焦探查**：在全屏灯箱内双击图表时，以双击光标点为中心直接放大至 2.5x 细节探查，再次双击平滑恢复自适应视口；
>   - **自动化测试回归防护**：新增 `tests/test-focal-zoom.mjs`，覆盖单步与连续 8 步缩放光标零位移几何验证，并纳入全量自动化门禁。

> [!NOTE]- [1.2.63] - 2026-10-16 · Markdown 图表与图片双击全屏打开
> ### Added
> - **Markdown 渲染图表与图片双击全屏打开与焦点防抢占 (Markdown Diagrams & Images Double-Click Lightbox — L2)**:
>   - **全图表类型双击全屏**：全面支持 Markdown 中渲染的 Mermaid、PlantUML、Graphviz DOT、SVG、Markmap 思维导图、Excalidraw 白板、DomainStory 故事图以及 KaTeX 数学公式在视觉视图下通过双击画布区域直接打开全屏高清灯箱（`LightboxModal`）；
>   - **Markmap 矢量 SVG 提取**：针对 Markmap 思维导图双击全屏，通过 `XMLSerializer` 动态捕获当前渲染的 SVG 矢量 DOM，避免灯箱回退为纯 Markdown 代码；
>   - **独立图片与内联 SVG 支持**：支持标准 Markdown 图片（`<img>`）双击打开并组装多图画卷画廊，以及原生内联 `<svg>` 节点双击放大；
>   - **VS Code 源码跳转防误触与冒泡拦截**：修复双击图表或图片时事件向上冒泡至 `useMarkdownScrollSync` 误触发 `onOpenSourceAtLine` 导致 VS Code 编辑器强行抢焦或破坏灯箱展示的严重体验问题；在图表底层与容器双击拦截层进行双重隔离防护；
>   - **视觉反馈增强**：在所有图表及图片悬停时自适应展示 `cursor-zoom-in` 手势与全屏提示（`title={t('fullScreen', locale)}`）；
>   - **自动化测试回归防护**：新增 `tests/test-markdown-diagram-dblclick.mjs`，包含组件双击契约检查与容器事件分发仿真测试，并纳入全量 `verify` 门禁。

> [!NOTE]- [1.2.62] - 2026-10-16 · SVG v2 8 向变形手柄、对齐分布与开发者互操作
> ### Added
> - **SVG v2 8 向变形手柄、自由旋转、多图元对齐分布与开发者互操作 (SVG v2 Transform Handles, Alignment, Distribution & Interop — L2)**:
>   - **8 向包围盒缩放手柄与实时交互**：在选择工具（`selectTool`）下选中单个或多个图元时，即时生成 8 处控制方块（`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`）与外边框虚线包围盒；拖拽手柄时基于反向针脚原点调用 `object.scale` 生成实时 Preview，释放指针时写入撤销历史；支持按住 Shift 键等比缩放；
>   - **顶部旋转手柄与自由角度旋转**：在包围盒顶部中心生成连线与旋转圆形手柄，拖拽即可围绕几何中心触发 `object.rotate` 自由旋转；支持按住 Shift 键实现 15° 步进角度吸附；光标自适应变化为 `nwse-resize`、`nesw-resize`、`ns-resize`、`ew-resize` 与旋转手势状态；
>   - **顶部操作工具栏 (Top Action Bar)**：在画布上方新增语义化操作栏：
>     - **6 向联合对齐**：左对齐、水平居中、右对齐、顶对齐、垂直居中、底对齐（选中 $\ge 2$ 项激活）；
>     - **2 向等距分布**：水平均匀分布、垂直均匀分布（选中 $\ge 3$ 项激活）；
>     - **对齐与分布别名防腐**：命令层支持 `center` / `centerH`、`middle` / `centerV`、`h` / `horizontal`、`v` / `vertical` 灵活调用；
>   - **开发者互操作与位图导出**：
>     - **一键复制为 React JSX**：集成现代 JSX 转换器，自动处理 SVG 属性驼峰映射（如 `strokeWidth`、`fillRule` 等），注入 `{...props}` 泛型类型，一键复制并弹出成功 Toast；
>     - **高清 2x PNG 导出**：支持调用原生离线画布以 2 倍超采样光栅化渲染当前 SVG 矢量图形并触发保存下载；
>   - **路径端点箭头与锚点控制**：
>     - 新增 `path.setMarker` 命令，支持设置起点/终点箭头（`arrow`）与圆点（`dot`），序列化导出与画布渲染内嵌 `<defs>` 标记；
>     - 新增 `path.toggleAnchorKind` 命令与 Inspector 操作按钮，支持尖角锚点（`corner`）与平滑贝塞尔切线手柄（`smooth`）无缝切换；
>   - **自动化测试回归防护**：新增 `tests/test-svg-v2-transform-align.mjs`（13 项全量测试），覆盖 8 向缩放手柄、旋转交互、对齐分布、端点箭头与锚点平滑度切换。
