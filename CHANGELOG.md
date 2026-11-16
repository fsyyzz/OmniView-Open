# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> [!BANNER] OmniView 版本更新大厅 (Release Center)
> OmniView 致力于提供极速、安全、全主题像素级融合的多格式文档与图表渲染体验。
> 在 OmniView 中预览本文档时，您将体验到**现代交互式折叠手风琴、对比卡片与高光 Alert** 的富媒体排版。

---

## [1.4.51] - 2026-11-16 (当前最新发布)

> [!TIP] v1.4.51 核心升级亮点
> **PPTX 矢量多边形几何重塑、页面元素层级结构梳理、多配色/画幅尺寸预设与 Word (`.docx`) 文内目录导航精准跳转全面交付**：
> 1. **PPTX 全系列多边形 SVG 渲染与自定义矢量路径 (`<a:custGeom>`) 全面修复 (`pptxEngine.ts`, `PptxShapeSvg.tsx`, `PptxSlideStage.tsx`)**：
>    - 新增 `buildRegularPolygonPoints`、`buildStarPoints` 与 `<a:avLst><a:gd>` 参数解析 (`shapeAdjusts`)，彻底修复正五边形 (`pentagon`) 误绘为箭头块 (`homePlate`)、6~12 边形/星形/切角矩形/平行四边形/梯形/多向箭头/心形/闪电/云朵等 50+ OOXML 预设几何缺失或形变的问题；
>    - 完整解析 `<a:custGeom><a:pathLst><a:path>`（含 `moveTo` / `lnTo` / `cubicBezTo` / `quadBezTo` / `close`）并修复自定义路径文本框跳过 SVG 绘制的缺陷，全矢量轮廓启用 `vectorEffect="non-scaling-stroke"` 保障无极缩放锐利清晰。
> 2. **页面元素 Z-Order 层级秩序梳理与交互式图层树面板 (`pptxEngine.ts`, `PptxLayerTreePanel.tsx`, `PptxSlideStage.tsx`)**：
>    - 新增 `sortAndAssignSlideLayerHierarchy` 按 **`母版底层 (master)` → `版式装饰层 (layout)` → `全屏画布底板 (backdrop)` → `前景图元层 (foreground)`** 严格分配递增 `zIndex`，并继承保留嵌套 `<p:grpSp>` 组合路径 (`groupPath`) 与变换，舞台启用 `isolation: 'isolate'` 杜绝层级串层遮挡；
>    - 顶栏新增 **「图层 (`Layers`)」** 结构树面板开关，按堆栈倒序直观展示四层结构、多边形中文标签、组合路径与尺寸，点击任意图层节点即可在主舞台高亮聚焦对应图元。
> 3. **PPTX 多维演播配色方案与多画幅尺寸预设 (`pptxStagePresets.ts`, `PptxViewer.tsx`, `PptxGridOverview.tsx`)**：
>    - 顶栏新增 **「配色方案」**（`原色` / `暖纸` / `暗夜` / `深海蓝` / `森系绿` / `紫韵金` 6 种主题预设，含舞台与文本/图形智能对比度自适应）与 **「画幅尺寸」**（`原始比例` / `宽屏 16:9` / `商务 16:10` / `经典 4:3` / `A4 横版` 5 种画幅等比投影 + `75% / 100% / 125% / 150%` 倍率预设）。
> 4. **Word (`.docx`) 文内目录 (TOC) 跳转直达正文与标准固定物理纸张尺寸约束 (`docxEngine.ts`, `docxPaginationEngine.ts`, `DocxViewer.tsx`)**：
>    - 修复 `hasTocClassName` 在 `docx-preview` 下划线类名（如 `docx-rendered-wrapper_TOC1` / `TOCHeading`）下失效导致左侧大纲误绑定到第 1 页文内「目录」的缺陷，点击左侧大纲或文内目录均直达正文真实章节；
>    - 新增 `resolveStandardPageDimensions`、`applyStandardSheetGeometry` 与实时溢出顺延重排 (`rebalanceOverflowingSheets`)，强制每一张 `.docx-paged-sheet` 严格锁定标准物理宽高（默认 A4 `794px × 1123px`），彻底消除少内容页面变矮/变窄或密内容页面拉高/撑宽的问题。
> 5. **Word (`.docx`) OOXML 行高规则与页面属性高保真还原 (`docxEngine.ts`, `docxPaginationEngine.ts`, `DocxViewer.tsx`)**：
>    - 新增 `extractDocxFormattingProfile` 与 `applyDocxFormattingAndPageFidelity`，按 ECMA-376 标准解析 `word/styles.xml`（`docDefaults`、`basedOn` 继承链）与 `word/document.xml`（段落 `<w:spacing>` 与全部 `<w:sectPr>`），精准修补 `docx-preview` 将省略 `w:lineRule` 错误退化为固定 `pt` 值及 `atLeast` 错算为 `calc(100% + Xpt)` 的缺陷，完整支持 `auto` / `atLeast` / `exact`、`beforeLines` / `afterLines` 与 `<w:docGrid w:linePitch>` 中文行网格；
>    - 完整还原并跨分页/溢出续页/打印管道透传 `<w:pgSz>`（横纵版与多种标准纸型）、`<w:pgMar>`（页边距与 `gutter` 装订线）、`<w:cols>`（多栏布局及分隔线）、`<w:vAlign>` 垂直对齐与 `<w:pgBorders>` 页面边框，并在元数据抽屉展示「OOXML 页面与排版属性」；
>    - 同步完善 `tests/harness/dom-env.mjs`（修复 `happy-dom` XML `Attr.localName` 前缀偏差并暴露 `Node`/`NodeFilter`）及 `tests/harness/discovery.mjs`（规范 DOCX/PPTX 组件交互测试为 ESM 原生执行）。

---

## [1.4.50] - 2026-11-16

> [!TIP] v1.4.50 核心升级亮点
> **Word (`.docx`) 原生一页一页物理纸张渲染、单页逐页翻阅模式与页面导航面板全面落地**：
> 1. **默认启用原生物理分页 (`paged`) 并新增单页逐页翻阅 (`single`) 模式 (`DocxViewer.tsx`)**：
>    - 将 `DocxViewer` 默认视图由连续网页流 (`fluid`) 升级为 **原生 A4 物理分页模式 (`paged`)**，打开任意 Word 文档即默认呈现一页一页独立悬浮的实体纸张（含页眉页脚、阴影边框与页码角标）；
>    - 新增 **「单页 (`single`)」** 逐页翻阅视图模式（支持 `分页` / `单页` / `流式` 三态无感切换），在单页模式下同一时刻仅聚焦渲染当前活动页，并配备底部悬浮翻页胶囊（`上一页 · X / N · 下一页`）及 `PageUp` / `PageDown` / `←` / `→` 快捷键翻页；
>    - 重置 `docx-preview` 默认注入的外层 `.docx-rendered-wrapper-wrapper` 灰色背景与内边距，使每张 `.docx-paged-sheet` 独立悬浮于工作台画布。
> 2. **物理纸张单位 (`pt` / `mm` / `cm` / `in`) 精确换算与多页切分增强 (`docxPaginationEngine.ts`)**：
>    - 新增 `parseCssLengthToPx` 单位换算器，彻底修复 `docx-preview` 输出的 `595.3pt × 841.9pt` 被 `parseFloat` 误当作 `px` 导致页面宽度缩水 25% 的缺陷，精准还原 `794px × 1123px` (96 DPI A4) 物理规格；
>    - 修复当 `docProps/app.xml` 陈旧记录 `<Pages>1</Pages>` (`expectedPageCount === 1`) 时压制超长章节自然多页切分的缺陷，并支持多 `<article>` 章节合并收集、无布局树高度估算回退以及显式 DOM 分页符切分。
> 3. **左侧导航窗口新增「页面 (Pages)」一页一页卡片视图 (`DocxTocSidebar.tsx`)**：
>    - 新增 `extractDocxPageSummaries` 提取每页页码、首标题与正文摘要，在左侧导航栏提供 **「大纲 / 页面」** 双标签切换，支持点击任意 A4 页面卡片一页一页直达目标页。

---

## [1.4.49] - 2026-11-16

> [!TIP] v1.4.49 核心修复亮点
> **彻底修复 PPTX 浏览时母版/版式占位符标识与“单击此处编辑模版文本样式”等模板提示文本泄漏显示的问题**：
> 1. **无 `type` 属性占位符 (`<p:ph idx="1"/>` / `<p:ph/>`) 精准识别与拦截 (`src/features/viewers/lib/pptxEngine.ts`)**：
>    - 修复 `extractPlaceholderMeta` 仅依赖 `ph.attrs.type` 判断占位符的缺陷：在 OOXML 标准中，版式与母版的内容/对象占位符常仅声明 `<p:ph idx="1"/>` 或 `<p:ph/>`（无 `type` 属性），此前会被误判为母版装饰图形而直接渲染到幻灯片上；
>    - 升级 `extractPlaceholderMeta` 返回显式 `isPlaceholder` 布尔标识（覆盖 `<p:ph>` 节点及占位符命名语义），确保 `slideMaster` 与 `slideLayout` 中的文本、图片、图表/表格占位符仅提供坐标与样式继承，绝不作为装饰图元泄漏渲染。
> 2. **模板编辑提示语、多级示例文本、母版字段与隐藏节点清洗 (`pptxEngine.ts`)**：
>    - 新增 `isMasterTemplatePromptText` 与 `isMasterLevelSampleText` 过滤器，精准剔除中英文母版默认提示词（如“单击此处编辑模版文本样式”、“单击此处编辑母版标题样式”、“第二级~第五级”、“Click to edit Master text styles”、“‹#›”等）以及母版 `<a:fld>` 字段占位符；
>    - 新增 `<p:cNvPr hidden="1"/>` 隐藏节点跳过逻辑与 `<p:sldLayout showMasterSp="0">` 母版背景图形显隐继承控制，并同步净化演讲者备注 (`notesSlide`) 中的占位提示词。

---

## [1.4.48] - 2026-11-16

> [!TIP] v1.4.48 核心修复亮点
> **修复 VS Code 插件 Webview 中 PPTX 演播放映与 DOCX 全屏模式无法退出的阻断性问题**：
> 1. **Webview 无原生 Fullscreen API 兼容与状态解耦 (`PptxViewer.tsx`, `DocxViewer.tsx`)**：
>    - 修复 `toggleFullscreen` 仅判断 `!document.fullscreenElement` 的缺陷：当 VS Code Webview iframe 禁止 `Element.requestFullscreen()` 时，`document.fullscreenElement` 恒为 `null`，导致点击底部 HUD「退出」或按 `F5` 反复重新进入放映而无法退出；
>    - 改为同时以组件态 `isFullscreen` 与 `document.fullscreenElement` 双重判定，并显式拆分 `enterPresentation` / `exitPresentation`，退出时立即重置 `isFullscreen`、激光笔与计时器状态。
> 2. **多通道安全退出保障 (`Esc` / `F5` / 常驻退出按钮)**：
>    - 在 `PptxViewer.tsx` 与 `DocxViewer.tsx` 全局键盘监听中补充 `Escape` 退出逻辑（优先关闭搜索框、总览、信息面板与备注浮层，随后立即退出放映/全屏）；
>    - 在 `PptxViewer.tsx` 放映模式下新增右上角常驻轻量「退出放映 (`Esc`)」按钮（依托 `--ov-*` 主题令牌），彻底避免底部 HUD 自动隐藏后用户找不到退出入口；
>    - 在 `tests/test-pptx-viewer-ui.mjs` 补充 VS Code Webview 拦截 `requestFullscreen` 场景下的 Headless DOM 回归测试。

---

## [1.4.47] - 2026-11-16

> [!TIP] v1.4.47 核心升级亮点
> **Word (`.docx`) 渲染引擎与阅读工作台全面深度优化：盒模型缩放、语义化暗夜护眼主题、长表跨页表头重复与全链路工程打磨**：
> 1. **缩放与视口盒模型重构 (`DocxViewer.tsx`)**：
>    - 依托 `ResizeObserver` 动态测量自然文档尺寸与滚动视口宽度，以真实 `scale` 占位外框消除大倍率下的左右裁切与缩小时的底部大块留白；
>    - 新增 **「适宽 (Fit Width)」** 模式与 `Ctrl + 滚轮` 平滑缩放，支持流式 / A4 分页模式无缝切换（自动保持阅读滚动比例与搜索高亮状态）。
> 2. **语义化纸张主题与样式隔离 (`DocxViewer.tsx`, `docxEngine.ts`)**：
>    - 废除全容器 `filter: invert()` 暴力反色与强制覆盖正文字体颜色的规则，基于 `data-paper-theme` 提供原纸、羊皮纸与暗夜三大语义纸张，完整保留嵌入插图、图表原彩与原有标题强调色；
>    - 通过 `renderAsync` 第三参数传入独立隔离的 `styleContainer`，彻底防止多标签页打开不同 `.docx` 时样式污染全局 `document.head`（并同步注入系统级打印管道）。
> 3. **智能分页、纯 TS 元数据解析与富媒体交互 (`docxPaginationEngine.ts`, `docxMarkdownConverter.ts`, `DocxTocSidebar.tsx`)**：
>    - `docxPaginationEngine.ts` 新增超长表格跨页按 `<tr>` 拆分并在续页自动重复表头行 (`<th>` / `<thead>`)；
>    - `docxEngine.ts` 使用纯 TS XML AST 解析器替换正则提取 `core.xml`/`app.xml` 元数据，精确解码 XML 实体与 CDATA，并扩展自愈降级 `role="alert"` 告警横幅；
>    - 文档内点击任意插图即可呼出 `LightboxModal` 全屏大图切换浏览；新增全屏沉浸自动隐藏 HUD、`docxDomToMarkdown` 对修订痕迹 (`<del>`/`<ins>`)、高亮 (`<mark>`)、任务复选框与公式的支持；
>    - `DocxViewer` 与 `DocxTocSidebar` 全面接入 `--ov-*` 语义设计令牌与完整 `zh-CN` / `en-US` 双语本地化。
> 4. **全链路自动化测试与门禁覆盖 (`tests/test-docx-*.mjs`)**：
>    - 扩充引擎、分页、Markdown 转换测试，新增 `tests/test-docx-viewer-ui.mjs` Headless DOM React 19 组件交互测试套件，并通过所有工程门禁与构建校验。

---

## [1.4.46] - 2026-11-16

> [!TIP] v1.4.46 核心升级亮点
> **PowerPoint (`.pptx`) 演播工作台全面架构级升级 (方案 C)：纯 TS OOXML AST 内核、1:1 等比自适应舞台、原生图表与专业演播套件**：
> 1. **纯 TS OOXML XML AST 与母版继承内核 (`src/features/viewers/lib/pptxXmlUtils.ts`, `pptxEngine.ts`)**：
>    - 废除正则表达式与弱 `DOMParser` 解析链路，自研零外部依赖嵌套 XML AST 解析器，精准处理 CDATA、注释与实体解码；
>    - 支持 `slideMaster` / `slideLayout` 背景渐变/图片、颜色映射表 (`clrMap` / `clrMapOvr`) 与占位符样式逐级继承；
>    - 严格遵循 `<p:sldIdLst>` + `presentation.xml.rels` 真实幻灯片顺序与隐藏页 (`show="0"`) 标记，支持 `<p:grpSp>` 嵌套组合子坐标 (`chOff`/`chExt`) 矩阵变换与 `<p:cxnSp>` 连线；
>    - 完整支持 OOXML 色彩修饰符 (`tint` / `shade` / `lumMod` / `lumOff` / `satMod` / `alpha` + `sysClr` 回退)、`<a:gradFill>` 渐变、项目符号与自动编号 (`buAutoNum`)、超链接、跨行跨列合并表格 (`gridSpan`/`rowSpan`) 以及原生内嵌图表 (`ppt/charts/chart*.xml`)；
>    - 提供 `pptxToMarkdown()` 结构化导出与 `buildPptxPrintHtml()` 多页分页打印 HTML 构建，并同步升级 `examples/pptx/omniview-tech-presentation.pptx` 演示文件。
> 2. **1:1 等比舞台与高保真子组件矩阵 (`src/features/viewers/components/drivers/pptx/*`)**：
>    - `PptxShapeSvg.tsx`：基于原生 SVG 渲染 18+ 预设几何图形、渐变、虚线样式、双向箭头端点与投影效果；
>    - `PptxChartElement.tsx`：基于 Apache ECharts (SVG 渲染器) 呈现原生内嵌柱状、折线、面积、饼图、环形与散点图表，并提供轻量缩略图微缩预览模式；
>    - `PptxSlideStage.tsx`：按逻辑 pt 尺寸配合等比 `transform: scale()` 渲染，确保文本框、合并表格、矢量形状与图表在任意窗口下 1:1 零错位，支持 `<mark>` 搜索高亮与全屏红点激光笔；
>    - `PptxGridOverview.tsx`：新增平铺总览视图 (`G` 键)，支持搜索命中与备注标记直观选页。
> 3. **演播工作台交互与全主题 `--ov-*` 融合 (`PptxViewer.tsx`)**：
>    - 依托 `ResizeObserver` 自动计算舞台适配缩放并支持 `50%~220%` 手动微调，左侧边栏升级为真实实时缩略图；
>    - 新增 `Ctrl+F` 全文与备注搜索高亮跳转、`F5` 全屏演播自动隐藏 HUD（内置计时器与 `L` 键激光笔）、一键复制全文 Markdown、系统级分页 PDF 打印、双语支持与损坏字节流自愈降级提醒横幅；
>    - UI 壳层全面接入 `--ov-*` 语义设计令牌，无缝融合多主题与 VS Code 宿主外观。
> 4. **全链路自动化测试与门禁覆盖 (`tests/test-pptx-engine.mjs`, `tests/test-pptx-viewer-ui.mjs`, `tests/test-office-operations-matrix.mjs`)**：
>    - 扩充引擎测试至 15 项全覆盖，新增基于 `happy-dom` 的 React 19 组件交互测试套件，并通过所有治理门禁与构建校验。

---

## [1.4.42] - 2026-11-12

> [!TIP] v1.4.42 核心升级亮点
> **Markdown 渲染全量悬浮操作统一靠最左侧对齐，彻底消除光标悬停时位置漂移跳变**：
> 1. **悬浮动作胶囊统一固定于左侧 (`MarkdownBlockActionBar.tsx`)**：
>    - 废除原根据文字长短、居中图件、窄表等动态计算右侧偏移量 (`computeBlockContentRightOffset`) 的机制；
>    - 默认全量采用 `position="left"` 与 `leftOffsetPx=8`，使段落、标题、列表、引用、表格、代码块及图表的悬浮操作胶囊统一固定在最左侧垂直轨道上，鼠标上下移览时视觉焦点稳定；
>    - 进阶操作展开（「更多」及「二次删除确认」）统一向右侧自然展开，无需额外钳制左溢出风险；
> 2. **渲染性能与状态优化 (`MarkdownViewer.tsx`)**：
>    - 移除在 `onMouseEnter` 中高频测量 DOM Range 并触发 `setBlockRightOffsets` 的开销，大幅降低长文档中连续滚动的计算与重渲染压力；
>    - 块级删除「一键撤销」浮条 (`MarkdownBlockUndoToast`) 统一对齐左侧 (`ml-2 mr-auto`)，形成自洽的左侧操作动线；
> 3. **自动化测试套件与门禁保障 (`tests/test-markdown-block-editor.mjs`)**：
>    - 新增第 10 项关于左侧固定定位、`position="left"` 及杜绝动态计算跳变的严格断言；
>    - 4 大工程门禁与 Markdown 23 套测试 100% 通过。

---

## [1.4.41] - 2026-11-10

> [!TIP] v1.4.41 核心升级亮点
> **全面打通 Mermaid、Graphviz 与 DDD 领域驱动设计的 14 大渲染主题深度联动，彻底消除图表与界面主题不一致现象**：
> 1. **Mermaid 14 大主题高保真调色盘深度联动 (`src/shared/lib/mermaidConfig.ts`, `MermaidBlock.tsx`, `MermaidStudioCanvas.tsx`)**：
>    - 定义专属 `MermaidThemePalette` 矩阵，涵盖流程图、序列图、状态机、甘特图（任务与分区色阶）、GitGraph（7 阶分支色板）、饼图等专用变量，精准映射 14 大渲染主题（`dracula`、`catppuccin`、`nord`、`tokyo-night`、`sepia`、`forest`、`solarized`、`notion`、`github-dark`、`midnight` 等）；
>    - 在 Markdown 渲染器、MermaidStudioCanvas 画布与 StructuredDataViewer 拓扑图中全面透传 `theme`，缓存版本升级为 `mermaid:v3` 实现跨主题即时隔离刷新；
> 2. **Graphviz 矢量固化与原生主题自适应 (`src/features/viewers/lib/graphvizTheme.ts`, `graphvizRenderer.ts`, `GraphvizBlock.tsx`)**：
>    - 废除原有的暴力 CSS 反转滤镜（`filter: invert` 会导致用户彩色图元色相完全失真），重构实现原生矢量固化器 `solidifyGraphvizSvg`；
>    - 消除 WASM 原生生成的默认全屏白底矩形，将默认黑线、黑色箭头与文本自适应重映射为当前主题的高对比度语义色，同时 100% 保持用户显式声明的语法原彩（如用户自定义的红绿蓝边框与节点）；
> 3. **DDD 领域故事图 (Domain Storytelling) 全面统一 14 大主题 (`src/features/viewers/lib/domainStoryEngine.ts`)**：
>    - 将 DDD 引擎中最后的标准领域故事图（`mode: domain-story`）由旧有的二元黑白色板统一接入 `resolveDddPalette`，至此 DDD 的全部 5 种模式（领域故事、事件风暴、上下文映射图、投资象限图、战略画布）100% 与 14 大主题深度融合；
> 4. **自动化测试套件与物理门禁验证**：
>    - `tests/test-mermaid-config.mjs`、`tests/test-graphviz.mjs`、`tests/test-domainstory-engine.mjs` 增补 14 大主题覆盖与原彩保持断言；
>    - 全量 101/101 套单元测试、`tsc --noEmit`、4 大物理门禁与 `build:plugin` 全部 100% 绿灯通过。

---

## [1.4.40] - 2026-11-10

> [!TIP] v1.4.40 核心升级亮点
> **全面打通 PlantUML 与 DDD 领域驱动设计图表的 14 大渲染主题深度联动，彻底消除图表超出边界截断与遮盖太近**：
> 1. **PlantUML 14 大主题高保真调色盘深度联动 (`src/shared/lib/plantuml.ts`, `PlantUmlBlock.tsx`)**：
>    - 定义专属 `PlantUmlThemePalette`，精准覆盖 `dracula` (德古拉紫)、`catppuccin` (摩卡)、`nord` (极地冰蓝)、`tokyo-night` (东京夜)、`sepia` (暖阳复古)、`forest` (深林翡翠)、`solarized` (日照青)、`notion`、`github-dark`、`midnight` 等 14 大渲染主题高保真调色盘；
>    - 彻底修复 `PlantUmlBlock` 切换主题时 `cachedSvg` 状态残留导致的图表主题锁死 Bug，缓存键升至 `plantuml:v3`；
> 2. **DDD 领域驱动设计全景图表 14 大主题联动与超宽自适应 (`src/features/viewers/lib/dddModelingEngine.ts`, `DomainStoryBlock.tsx`)**：
>    - DDD 5 大图表（事件风暴时间轴、战略限界上下文映射图、核心域投资象限图、限界上下文战略画布、领域故事图）全面接入 14 大渲染主题系统，泳道底色、节点卡片、连线与铭牌随主题实时沉浸融合；
>    - **彻底消除事件风暴截断**：按实际节点、读模型与痛点便利贴精准动态计算总宽并保留呼吸留白，修复外层 SVG 容器嵌套选择器与超宽平滑横向滚动，彻底杜绝最右侧 HOTSPOT 痛点卡片被裁切截断；
>    - **彻底消除上下文映射图遮盖**：画布尺寸大幅扩展至 1520x960，卡片间距扩大至 140px+，分层渲染（连线 -> 卡片 -> 顶层铭牌）配合端点精确贴靠卡片边界与自动避碰算法，实现 100% 零遮盖；
> 3. **测试基础设施并发鲁棒性加固 (`tests/harness/module-loader.mjs`)**：
>    - 模块测试加载器进程退出清理升级为精准按进程回收临时 bundle，彻底消除多工作进程并发运行 101 套测试时的目录误删竞争；
> 4. **质量门禁与全量测试**：
>    - 全量 101/101 套自动化测试与 4 大物理门禁 100% 绿灯全通过。

---

## [1.4.39] - 2026-11-10

> [!TIP] v1.4.39 核心升级亮点
> **彻底修复 PlantUML 用例图 (Use Case) 与思维脑图 (Mindmap) 节点文字与背景同为白色的对比度异常**：
> 1. **全景样式注入引擎重构 (`src/shared/lib/plantuml.ts`)**：
>    - 脑图与 WBS 原生 `<style>` 规范覆盖：针对 `@startmindmap` / `@startwbs` 注入自适应原生 `<style>` 块，深色模式下显式定义 `#111827` 节点底色、`#38bdf8` 边框与 `#f8fafc` 文字，浅色模式下定义 `#f8fafc` 节点底色与 `#0f172a` 文字，彻底解决 PlantUML 默认浅灰白底色与全局白字冲突导致的不可读现象；
>    - 工业级 UML 图元全面补全：为用例图 `usecase` 以及各类架构图元（`rectangle`, `agent`, `database`, `queue`, `collections`, `cloud`, `node`, `storage`, `card`, `boundary`, `control`, `entity`, `interface`）补齐多主题高对比度的 `skinparam` 背景色、边框色与字体颜色契约；
> 2. **独立驱动与缓存快照平滑演进**：
>    - `PlantUmlViewer` 驱动支持 `isDarkTheme` 属性与深浅色模式动态透传；
>    - Markdown AST 渲染管道 `PlantUmlBlock` 缓存版本升至 `plantuml:v2`，自动使历史白底白字离线缓存失效并无缝更新；
> 3. **自动化测试与门禁验证**：
>    - `tests/test-plantuml-url.mjs` 增补对用例图 `usecase` 皮肤和思维脑图 `mindmapDiagram` 原生 `<style>` 注入的双向断言；
>    - 全量 101/101 套自动化测试与文档代码一致性门禁 100% 绿灯通过。

---

> [!NOTE] 历史版本归档提示
> 为保障发布日志可读性与轻量化浏览体验，`CHANGELOG.md` 规范默认滚动保留最近 **10 次**版本变更记录。`v1.4.38` 及更早的历史版本发布说明已完整归档至 Git 提交历史与 [GitHub Releases](https://github.com/fsyyzz/OmniView/releases)。
