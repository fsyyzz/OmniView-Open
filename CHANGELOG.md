# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.23] - 2026-09-23

### Fixed

- **Markdown 含有图片复制到 Word / WPS 产生大量边框与线框问题根治**:
  - 将剪贴板富文本清洗重构为 100% 同步流水线（`cleanAndFormatDomForWordSync`），杜绝因图片异步加载导致浏览器错过 `copy` 生命周期而回退为粗暴复制；
  - 彻底抹除所有外层容器的 `border`、`outline`、`box-shadow` 与 `min-height`，消除 Office 识别 Tailwind 边框样式的杂乱线框；
  - 启用剪贴板 `text/plain` 与 `text/html` 多通道并发写入：复制到 Word 呈现精美富文本，复制到另一个 Markdown 文件（`.md`）无损保留完整原生 Markdown 源代码。
- **VS Code 插件 Webview 环境下的 `Ctrl+A` / `Cmd+A` 正文精准全选隔离**:
  - 解耦按键监听与气泡格式工具条 `onContentChange` 回调的强依赖，确保在只读/预览模式下按键监听始终挂载；
  - 采用捕获阶段（Capture Phase）事件拦截并精准绑定 DOM Range 到 Markdown 正文容器，彻底解决在 VS Code 插件中按 `Ctrl+A` 误选插件顶栏工具条、面包屑与状态栏的问题；
  - 完善输入组件穿透保护，保留输入框、代码编辑框及模态弹窗的原生全选行为。

## [1.0.22] - 2026-09-23

### Fixed

- **Markdown 编辑与预览模式同步稳定性增强**:
  - 优化 DOM 选区替换与行内文本插入的容错回写链路；
  - 完善只读环境下的工具栏状态同步。

## [1.0.21] - 2026-09-23

### Added

- **Markdown 代码块 Word/WPS 原生双列表格高保真复制 (`copyCodeAsWordTable`)**:
  - 代码块复制新增双模式下拉交互：默认主按钮复制纯净代码文本（无行号，便于粘入 IDE/终端执行），下拉菜单可一键「复制为 Word 原生代码表格」；
  - 自动生成 Office 原生识别的 2 列表格（左列独立行号与竖向分割线，右列完整保留 Prism 语法高亮分词色彩与浅灰 `#f8fafc` 底纹），直贴 Word/WPS 排版优雅、缩进对齐不塌陷。

## [1.0.20] - 2026-09-23

### Changed

- **工程版本自动演进与基础设施治理**:
  - 自动化构建门禁自愈与依赖缓存策略增强。

## [1.0.19] - 2026-09-23

### Added

- **增量重渲染与基于源码行号锚点的脏块复用机制**:
  - 重构 AST 解析与 Token 生成管道，为各个物理渲染块注入唯一内容指纹与行号范围（`startLine` ~ `endLine`），在局部内容变动或划词修饰时精准识别并复用稳定块对象引用，彻底阻断无效整篇子树重算。
- **可卸载型懒挂载视口管理 (`LazyViewportBlock`)**:
  - 升级 `LazyViewportBlock`，当超长文档中的重型图表（Mermaid、Graphviz、KaTeX、表格）离开视口超过保护屏距且非全局搜索/打印时，自动卸载回占位节点并释放 DOM 与 WASM 资源；
  - 联动全局 `blockHeightCache` 高度记忆池，确保动态卸载与重新挂载过程零布局抖动 (Zero CLS)。
- **安全可靠的预览到源码回写契约 (`markdownSelectionReplacer`)**:
  - 收窄支持面，专注于高可靠无歧义的加粗 (`**B**`)、行内代码 (`` `C` ``)、超链接 (`Link`) 与双向链接 (`WikiLink`)；
  - 强化源码行号与上下文文本指纹 (Fingerprint) 双重前置校验，对不上即安全拒绝写入并阻止静默改坏源文档。
- **渲染耗时性能预算与慢块监控降级体系 (`renderTimeBudget`)**:
  - 建立单块毫秒级渲染耗时观测系统，对超过预算门限 (800ms) 的重型块进行实时记录，并提供源码卡片降级与强制重新渲染能力；
  - 在 Markdown 大纲树与列表中自动打上慢块警示徽章，帮助创作者快速定位耗时瓶颈。
- **大纲与锚点在懒挂载下的 100% 准确性**:
  - 标题节点（H1~H6）保持即时解析挂载，大纲目录跳转定位仅依赖标题节点真实位置，彻底杜绝懒挂载估计高度带来的跳转偏差。

## [1.0.18] - 2026-09-23

### Added

- **全场景图片/图表复制自适应 Base64 内嵌化**:
  - **普通 Markdown 图片 Base64 内联写入剪贴板**：复制时自动遍历正文内所有 `<img>` 图片资源（含相对路径、blob 临时对象与远程 URL），通过异步 Canvas 光栅化将其就地转为可内嵌的 Base64 Data URL，彻底解决外部 Word/WPS/邮件文档因无法读取本地或相对路径导致的“红叉/图片空白”问题；
  - **矢量图表 300+ DPI 极清光栅化**：Mermaid、PlantUML、Graphviz、DomainStory、SVG Studio 在复制时一键栅格化为带高白底衬的高清 PNG，Word 中粘贴即显。

## [1.0.17] - 2026-09-23

### Added

- **Word / WPS 富文本剪贴板净化引擎 (`wordClipboardHelper.ts`)**:
  - **剪贴板 HTML/DOM 智能脱敏与净化**：拦截 Markdown 内容区复制事件，深度清洗所有非正文交互 UI（包括悬浮工具条 `.diagram-header`、表格工具条 `.ov-table-block-toolbar`、列宽拖拽条 `.ov-col-resizer`、表头排序按钮与源码跳转链接），防止多余按钮和交互文字混入目标文档；
  - **容器冗余边框与黑框彻底消除**：抹除 `.lazy-block-wrapper`、`.markdown-diagram`、`.ov-table-block` 的外层 CSS 边框与阴影，将表格自动规整为标准 Word 识别良好的轻量边框（`border-collapse: collapse; border: 1px solid #cbd5e1`）与浅色表头，消除 Word 粘贴多重嵌套框；
  - **矢量图表全自动光栅化入剪贴板**：针对 Word / WPS / 邮件等富文本软件无法原生渲染内联 `<svg>` 标签的行业痛点，在复制时自动将 Mermaid、PlantUML、Graphviz、SVG、DomainStory 等图表高保真转换为 300+ DPI 极清 Base64 PNG `<img>` 标签，粘贴进 Word 立即呈现图表且清晰不失真、不黑底；
  - **聚焦精准全选控制 (Ctrl+A / Cmd+A)**：智能绑定快捷键与焦点判别，当用户在 Markdown 渲染画布内触发全选时，仅精准圈选 Markdown 正文内容节点，杜绝外层工作台、侧边栏、Tab 标签与状态栏被误选。

### Fixed

- **交互性辅助元素全选与剪贴板污染问题**:
  - 为所有浮动悬浮工具栏、表格拖拽列宽条和排序箭头追加 `data-clipboard-ignore="true"` 与 `.ov-clipboard-ignore` 声明，并赋予 `user-select: none !important` 规则，确保文本拖拽划选或系统选区均不会抓取辅助交互 UI。


### Fixed

- **AI-SE 基础设施跨环境稳态与 CI 容错治理**:
  - 修复度量脚本（`measure-metrics.mjs`）与文档同步检查门禁（`check-doc-sync.mjs`）在非 Git 或无 `.git` 隔离沙箱环境下的异常输出，增加安全探测与静默容错；
  - 自动化构建与同步全套 AI-SE Codex 89 组规范索引 (`codex.index.json`)，保证 JIT 检索基准延迟在 1.16ms（≤15ms 预算要求）；
  - 严格保持版本号在 `package.json` 与 `CHANGELOG.md` 之间的三处一致性。


## [1.0.15] - 2026-09-23

### Added

- **300+ DPI 矢量高清图表复制引擎 (`copyImageHelper`)**:
  - **超采样无损导出**：自动解析 SVG 的 `viewBox` 与几何尺寸，注入 3x 高清超采样与高质量双三次平滑滤波，保证输出至少 2400px+ 宽度，解决贴入 Word / PPT / 微信后的模糊与锯齿问题；
  - **防透明黑底保护**：默认智能填充 `#ffffff` 高白底色，彻底杜绝 Office 套件对透明 PNG 渲染变黑的兼容性缺陷；
  - **全图表驱动生态覆盖**：全面集成到 Markdown 内嵌图表组件（Mermaid、PlantUML、SVG、DomainStory、Graphviz）以及独立 PlantUML 编辑器中；
  - **CI/CD 开源构建兼容性加固**：将版本自增与演进工具链固化在公开 `scripts/bump-version.mjs` 中，避免开源隔离环境因 `.codex` 缺失引发模块无法找到错误。

### Fixed

- **图表浮动工具栏与操作按钮全主题像素级融合**:
  - 将 `.diagram-header` 悬浮工具栏、内嵌操作按钮与分组胶囊全面重构为依托 `--ov-*` 语义令牌与设计变量，彻底解决浅色主题（Light/Sepia）与高反差主题下底色、边框与操作按钮不匹配或文字看不清的问题；
  - 优化 Mermaid、PlantUML、Graphviz、DomainStory 及 KaTeX 在多主题下的文字、线条与边框对比度。


## [1.0.9] - 2026-09-21

### Added

- **Markdown 划选轻量格式化悬浮工具条 (Floating Bubble Toolbar)**:
  - **划选感知与智能跟随**：在 Markdown 预览容器划选文字时自动计算视口坐标，在选区上方以精致微晶箭头浮现气泡工具栏；
  - **行内格式矩阵与 Toggle 反选**：支持粗体 (`**text**`)、斜体 (`*text*`)、删除线 (`~~text~~`)、行内代码 (`` `text` ``)、重点高亮 (`==text==`)、超链接 (`[text](url)`) 与双向链接 (`[[Page]]`) 快速转换与反向解除；
  - **AST 行级源映射精准定位替换 (`markdownSelectionReplacer`)**：基于 `data-source-line` 建立局部行搜索窗口，避免全文同名词汇误伤替换，并实时同步回写源文档；
  - **多主题适配与专属测试套件**：100% 依托 `--ov-*` 语义令牌与毛玻璃质感，新增 `scripts/test-markdown-selection-replacer.mjs` 纳入自动化测试门禁。

### Fixed

- **PPTX 演示文稿文件上传二进制解码修复 (PPTX File Import & Reload)**:
  - 修复 PPTX 演示文稿在本地文件上传后被误作为文本读取导致解析失败并回退至默认示例的问题，增加 ArrayBuffer 二进制与 Data URL 安全流转，并在工具栏提供重载原文件功能；
- **开发服务器启动与端口冲突治理**:
  - 修正 package.json 中的开发脚本与 Vite 配置，严格锁定 3000 端口并消除参数重复传递问题。


### Fixed

- **Mermaid 状态图 (`stateDiagram` / `stateDiagram-v2`) 渲染对比度与暗色文本隐形修复 (State Diagram High Contrast & Accessibility)**:
  - **显式注入状态图专属主题变量**：补齐 `stateLabelColor`、`stateBkg`、`stateBorder`、`stateEdgeLabelBackground`、`transitionColor`、`transitionLabelColor`、`specialStateColor`、`innerEndBackground` 与 `composite*`，彻底杜绝状态节点文字因变量回退导致与背景同色隐形的问题；
  - **全局样式对比度与可见性兜底**：在全局样式层补充 `.stateLabel text`、`.statediagram-state text`、`g.stateGroup text`、`.state-title` 等基于 `--ov-text` 语义设计令牌的高对比度色彩与文字抗锯齿渲染约束；
  - **主题与缓存维度隔离防污染**：渲染缓存键绑定 `themeSuffix`，并在 Markdown 与结构化数据拓扑图中保持深浅色动态响应；
  - **自动化测试固化**：新增 `scripts/test-mermaid-config.mjs` 测试套件，纳入 CI 核心门禁。

## [1.0.7] - 2026-09-20

### Fixed

- **全屏灯箱自适应稳定性与高并发渲染防护 (Lightbox Stability & Re-render Guard)**:
  - **状态与计算彻底解耦**：固化 `imgDimensionsRef` 物理尺寸快照机制，全面消除 React 异步批处理过程中因视口回调重建引起的冗余渲染；
  - **视口缩放与边界稳态防护**：加强自适应铺满计算的容错与边界保护，保证高频缩放、背景切换、旋转与切图时 60 FPS 流畅交互无卡顿。

## [1.0.6] - 2026-09-20

### Fixed

- **灯箱重渲染死循环与状态更新深度防护 (Fix Minified React Error #185)**:
  - **解耦自适应计算与尺寸状态依赖**：重构 `LightboxModal` 中的尺寸测算与视口自适应逻辑，引入 `imgDimensionsRef` 稳定引用机制，将视口自适应核心计算转化为稳定的 `applyFitToScreen` 纯函数；
  - **阻断 Effect 连锁死循环**：在 `useLayoutEffect` 与 `useEffect` 中增加尺寸 Diff 阈值防护，仅在尺寸发生有效变动或首次初始化时触发状态更新，彻底解决 `handleFitToScreen` 引用变化引发的无限嵌套更新 (Maximum update depth exceeded) 报错。

## [1.0.5] - 2026-09-20

### Fixed

- **全屏图表/图片灯箱几何测算与交互修复 (Lightbox Geometric Fix & Interaction)**:
  - **根标签尺寸与负坐标 ViewBox 精确探测**：重构 SVG 尺寸提取正则，严格匹配根 `<svg>` 标签属性，全面支持 Mermaid 序列图等包含负坐标的 `viewBox` 与浮点参数，彻底解决误读内部节点尺寸导致的宽高比误判与 `150 × 65 px` 锁死问题；
  - **解除缩放死锁限制**：开放 5% ~ 2000% 平滑自适应缩放区间，自适应视口（Fit Screen）将根据实际图表几何尺寸计算真实最优比例，支持几何级阶梯式无级缩放；
  - **控制栏点击事件隔离**：在顶部控制栏、底部状态栏与画廊缩略图栏添加严格的鼠标事件隔离 (`stopPropagation`)，彻底消除被画布拖拽平移机制拦截的问题，保证适应窗口、快速铺满、自适应宽/高、旋转与复制下载等全部按键即点即响应；
  - **矢量容器原生尺寸自适应**：修复灯箱内 SVG 容器挤压与错位，确保复杂拓扑图、时序图与流程图高保真居中铺满展示。

## [1.0.4] - 2026-09-20

### Added

- **Markdown 深度交互与视口演进**:
  - **多图画廊灯箱 (Gallery Carousel & True Fill-Screen)**：支持快速铺满 (Fill)、适应窗口 (Fit)、原始尺寸 (1:1)、90° 旋转、键盘切图（`←`/`→`）与胶片缩略图；
  - **表格沉浸灯箱与就地编辑 (Table Lightbox & In-Place Editing)**：React Portal 沉浸式灯箱突破容器限制，支持双击单元格就地编辑、底部统计分析栏实时展示数值列求和（Sum）与均值（Avg）；
  - **代码块全屏灯箱 (Code Lightbox)**：集成全文搜索与实时高亮定位、代码字号自由缩放与自动换行/单行滚动切换；
  - **WikiLink 悬浮预览卡片 (WikiLink Hover Preview Popover)**：鼠标悬浮在 `[[Page]]` 或文档内部链接时即时弹出半透明磨砂卡片，呈现前 260 字符摘要、行数/字数统计与标题锚点，支持一键直达。

### Optimized

- **视口防抖与打印保真 (CLS Zero-Jitter & Print Fidelity)**：
  - 为懒加载视口块引入 `ResizeObserver` 尺寸记录与全局高度缓存，消除快速滚动时的内容抖动 (CLS)；
  - 深度适配 `@media print`，保护标题孤行防截断、表格/代码块/图表防跨页撕裂并自动隐藏悬浮工具栏。

## [1.0.0] - 2026-09-17

### Added

- **Word (`.docx`) 高保真只读渲染引擎 (`DocxViewer`)**:
  - 基于 OOXML 标准与 `docx-preview` 纯前端离线流水线，支持 A4 拟真纸张排版与连续滚动视图；
  - 支持 50% ~ 200% 平滑缩放、复杂表格单元格合并与边框底纹、多级编号、嵌入图片与页眉页脚；
  - 具备经典原纸、护眼羊皮纸与夜间深色反转三重视效切换，支持一键系统打印与 PDF 导出。

- **PowerPoint (`.pptx`) 矢量幻灯片演播工作台 (`PptxViewer`)**:
  - 纯离线 OOXML 形状与资源解包，支持 16:9 / 4:3 矢量自适应画布与居中等比缩放；
  - 具备全屏沉浸放映（F5 / 点击播放）、键盘快捷切页（`←` `→` / Space / PageUp / PageDown）；
  - 配备左侧高清幻灯片缩略图大纲抽屉与底部演讲者备注（Speaker Notes）抽屉。

- **Excel (`.xlsx` / `.xls`) 多工作表电子表格工作台 (`XlsxViewer`)**:
  - 纯前端离线 OOXML 解析与工作簿提取引擎，支持多工作表 (Multi-Sheet Tabs) 毫秒级切换与隐藏表检测；
  - 智能解析共享字符串池 (SharedStrings)、公式计算值、布尔/错误/日期与行内字符串；
  - 集成企业级数据网格：支持首行表头/列标自由切换、全局关键字高亮搜索、单列升降序排序与单元格一键复制；
  - 深度联动列级数据画像 (Profiling) 与 Sparklines 迷你走势微图，支持一键导出为 CSV、TSV、JSON 与 Markdown 表格。

- **现代图像工作台与像素检视器 (`ImageViewer`)**:
  - 原生支持 `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.ico`, `.avif`, `.tiff` 等全量图片格式；
  - **10% ~ 3200% 极清矢量缩放**：支持放大到 200% 以上时自动开启最近邻像素级渲染 (`pixelated`)，配合自由拖拽平移与自适应视口；
  - **16x 像素十字放大镜取色器 (Pixel Loupe)**：实时浮动追踪光标，精确定位图像内物理像素坐标 `(X, Y)`，动态采样并换算 `HEX`、`RGBA`、`HSLA` 色值，支持单击画布一键复制；
  - **四态画布底色**：支持透明棋盘格 (Checkerboard)、纯黑暗室、纯白原纸与 VS Code 原生主题四种背景一键切换；
  - **轻量几何变换与导出**：顺时针/逆时针 90° 旋转、水平/垂直镜像翻转、一键复制 Base64 Data URI 与下载原图；
  - **EXIF 深度元数据透视**：提取图像分辨率、总像素数 (MP)、纵横比例、文件大小与相机拍摄参数 (品牌/型号/快门/光圈/ISO/焦距/拍摄时间)。

### Fixed

- **全量代码审查问题闭环修复与工程加固**:
  - **TypeScript 类型契约与构建链打通**：在 `vite-env.d.ts` 中补齐 `@excalidraw/excalidraw`、`@excalidraw/utils` 与 `@myriaddreamin/typst.ts` 的完备类型声明，修复 `tsc --noEmit` 编译报错与 `build:plugin` 生产构建流水线；
  - **XSS 安全沙箱加固**：为 `LightboxModal` 全屏灯箱多态内容渲染管道注入 `DOMPurify.sanitize()` 安全过滤，彻底杜绝潜在 XSS 注入风险；
  - **设计令牌严格对齐**：全面替换 `CodeBlock` 与 `ExcalidrawViewer` 中的残留硬编码色值为 `--ov-*` 语义化设计令牌，保证在 11 套主题及 VS Code 原生深浅模式下的像素级自适应；
  - **EPUB 高亮主题对比度修复与阅读主题恢复**：修复明雅日光主题下正文字色隐形问题，恢复排版菜单 5 态沉浸式专属阅读色彩选择面板与工具栏 4 态快捷切换组。

### Refactored

- **EPUB 超大单体组件解耦重构**:
  - 将 1826 行单体组件 `EpubViewer.tsx` 优雅拆分为 `EpubToolbar`（工具栏与形态切换）、`EpubTocSidebar`（章节大纲树抽屉）、`EpubTypographyPopover`（高级排版面板）与 `EpubInfoModal`（书籍出版元数据详情）4 个高内聚子组件，显著提升代码可读性与长期维护性。

- **Vite Rollup 打包分块优化**:
  - 合并共享 D3 底层依赖的图表库至 `vendor-diagram`，消除打包构建时的 Circular Chunk 循环依赖警告。

## [0.13.0] - 2026-09-17

### Added

- **EPUB 现代电子书流式阅读器 (`EpubViewer` / `.epub`)**:
  - **三重流式阅读形态 (Flow Modes)**：支持双叶并排跨页（Two-Page Spread，拟真书脊中缝折痕与阴影、极窄屏智能自适应）、单页流式分页（Single-Page Flow，单栏专注阅读）与连续流式滚动（Continuous Scroll，纵向平滑无间断阅读）；
  - **3D 拟真翻书微光效 (Page Flip Effect)**：具备 GPU 硬件加速的 3D 页面翻转物理光影过渡动效，支持快捷开关；
  - **排版偏好与阅读进度持久化 (`epubSettingsStorage`)**：100% 支持用户界面点击交互的字号微调 (A-/A+)、字体族选择（宋体/黑体/楷体/等宽）、两字符首行缩进、对齐方式（两端对齐/靠左）、行距倍率（1.5x/1.75x/2.0x）、版心宽度（标准/宽幅/全幅）、护眼阅读主题（自动环境/羊皮纸/明亮/夜间）与书籍专属阅读进度（章节、页码、百分比）自动记录与恢复。

## [0.12.3] - 2026-09-17

### Fixed

- **PlantUML 暗色模式高对比度皮肤自适应与透明背景融合**:
  - 为 PlantUML 渲染引擎注入深色主题自适应 skinparam 皮肤规范，全面提升暗色模式下箭头线条（`#60a5fa`）、端点文字（`#93c5fd`）、生命线（`#94a3b8`）与实体卡片背景（`#1e293b`）的对比度与视觉辨识度；
  - 智能语法探测与用户意图保护：若源码中已显式指定 `!theme` 或自定义 `arrowColor` / `backgroundColor`，则严格尊重用户原生配置，不做多余侵入；
  - 优化 Markdown 视图中 PlantUML 容器在深色主题下的背景样式，去除突兀的白底遮罩，达成像素级无缝融合；
  - Markdown AST 解析流水线、实时编辑更新、大纲预览与灯箱全屏查看器全链路接入暗色模式上下文。

### Added

- **VS Code 官方标准快捷键绑定**:
  - 新增 `Ctrl+K V` / `Ctrl+Shift+V`（macOS 对应 `Cmd+K V` / `Cmd+Shift+V`），在活动源码编辑器聚焦时一键唤起 OmniView 侧边实时渲染预览，全面对齐 VS Code 官方 Markdown 预览交互直觉。
- **智能活动文本编辑器跟随与图钉锁定 (`omniview.togglePreviewLock`)**:
  - 接入 `onDidChangeActiveTextEditor` 事件，侧边预览自动跟随当前激活的源码文件同步刷新渲染；
  - 在编辑器标题栏新增锁定/跟随切换命令与图标按钮，支持一键锁定 (Pin) 当前预览，防止切换编辑器标签页时内容被冲掉。
- **并排伴侣模式光标焦点保持 (`preserveFocus`)**:
  - 侧边打开预览时默认设置 `preserveFocus: true`，主光标无缝驻留在左侧原生文本编辑器，实现即开即打，无缝享受 GitHub Copilot 与语言服务补全。

### Changed

- **Viewer 操作界面精简与去噪**:
  - 统一所有查看器（PlantUML、代码编辑/只读、结构化数据、思维导图、图表工坊、Markdown 等）的顶部操作入口为「在编辑器中打开」（*Open in Editor*）；
  - 全面清理各 Viewer 源码编辑区内突兀占位的推荐横幅与提示条，恢复清爽纯净的查看与阅读界面；
  - 移除 Markdown 工具栏内重复冗余的原生编辑器直达按钮，统一收纳于操作栏规范位置。

## [0.12.0] - 2026-09-17

### Added

- **并排双向协同流转架构 (`omniview.openSideBySide`)**:
  - 全新命令与右键菜单：在 VS Code 资源管理器与命令面板中新增「OmniView: 打开并排协同 (原生源码编辑 + 实时渲染预览)」，一键自动在当前列开启 VS Code 原生编辑器（无缝享受 Copilot 补全、GitLens 与 LSP 语法提示），并在侧边列开启 OmniView 实时可视化渲染视窗；
  - 默认交互升维 (Full-view First)：图表工作室 (`DiagramStudioShell`) 与思维导图 (`MindmapViewer`) 默认工作模式全面升维为「全屏高清渲染预览 (Eye/Mindmap)」，极大释放画布阅读视界；
  - 沉浸式协同引导：在图表、思维导图、结构化数据查看器、Markdown 工具栏以及多格式插件顶栏中无缝嵌入「在 VS Code 中并排编辑」引导条与直达按钮，消除重复造轮子与内嵌编辑器的局限；
  - 双语国际化支持：补齐并排编辑与原生编辑器跳转的完整中英文翻译条目。

### Changed

- **图表与导图默认模式优化**:
  - `DiagramStudioShell` 默认视图模式调整为 `preview`（纯预览），工具栏重组为「全屏预览 / 内置分屏 / 内置源码」；
  - `MindmapViewer` 默认视图模式调整为 `mindmap`（全屏导图），工具栏重组为「全屏导图 / 内置分屏 / 内置源码」；
  - 持久化配置无损兼容，保留用户自定义偏好记忆。

## [0.11.9] - 2026-09-17

### Added

- **VS Code 原生编辑器无缝协同通道 (`onOpenInEditor` / `omniview.openSource`)**:
  - 全驱引导集成：为所有主流驱动与查看器（Mermaid、Graphviz、PlantUML、Domain Storytelling、代码/文本查看器、结构化数据查看器、Markdown 浮动工具栏）统一新增「在原生编辑器中编辑」直达入口与智能引导条；
  - 深度集成 VS Code 原生文本编辑与 Git/AI 工具链：一键唤起 VS Code 原生文本编辑器，无缝享受 GitHub Copilot、Claude 等 AI 实时补全与 Git Diff / 时间线比对能力；
  - 双向编辑与光标行协同：保留轻量内嵌检视的同时，引导将沉浸式编辑任务交由 VS Code 原生编辑器处理，并通过双向监听机制实时热同步到 OmniView 画布。

## [0.11.5] - 2026-09-15

### Added

- **Markdown 交互式表格工具链 (`TableBlock`)**:
  - 智能悬浮工具栏：表格贴顶吸附、全屏只读检视与多维自适应排版；
  - 表格数据轻量图表化 (`TableChart`)：自动嗅探数值与类别维度列，即时渲染柱状图与折线图；
  - 增强型多态智能排序与内联关键词搜索高亮；
  - 表格数据双向导出：支持一键导出为标准 CSV 与格式化 Markdown。

### Fixed

- **表格全主题无缝融合 (`--ov-table-*`)**:
  - 彻底消除 `TableBlock` 与 `TableChart` 中的硬编码色值与深浅布尔值判断；
  - 补齐并统一 9 大预设主题与 VS Code 原生模式的设计令牌，在深色、浅色、复古 (Sepia) 及第三方主题下达成像素级视觉融合。

### Changed

- **开源协作与文档结构精简**:
  - 精简用户端 `README.md` 与 `README.en.md`，将架构深度分层与安全防护细节解耦归位至 `docs/architecture.md` 与 `SECURITY.md`；
  - 确立开源主干聚合提交规范（Composite Sync Commit Policy），杜绝无上下文的「同步主干分支」模糊日志。

## [0.11.2] - 2026-09-15

### Refactored

- **驱动注册中心架构 (Driver Registry & SPI)**:
  - 新增 `driverRegistry.ts` 插件注册表契约，统一管理 14 种格式驱动的路由与惰性组件工厂；
  - 重构 `ViewerRenderer.tsx` 消除全部硬编码分支，全面践行 OCP 开闭原则与策略模式。
- **Markdown 渲染器架构拆解 (SRP & Pipeline)**:
  - 沉淀 `useMarkdownAstPipeline`（AST 预处理与 Token 分流流水线）；
  - 沉淀 `useMarkdownScrollSync`（双向滚动、光标联动与任务列表回写）；
  - 沉淀 `useDiagramBlockStates`（多图表缩放、视图模式、代码暂存与灯箱状态）；
  - `MarkdownViewer.tsx` 代码规模缩减约 65%，大幅提升可维护性与渲染稳健度。

### Fixed

- CI 上 `check-vsix-contents` 改用 JSZip 读取 VSIX（ZIP），避免 Linux GNU `tar -tf` 误判失败

## [0.11.1] - 2026-09-15

### Fixed

- Markdown 分屏模式下预览与源码双向滚动不同步
- 分屏编辑时父级 content 回写覆盖本地输入，导致光标丢失与内容“飘走”

## [0.11.0] - 2026-09-15

### Added

- **Markdown 扩展语法增强**:
  - GFM / Pandoc 风格真脚注：`[^id]` 引用与 `[^id]:` 定义段（含续行、回跳链接）
  - Obsidian Wiki 链接与嵌入：`[[Page]]` / `[[Page|alias]]` / `[[#Heading]]` / `![[...]]`（图片宽度与笔记预览卡片）
  - Pandoc 定义列表：`Term` + `: Definition`（多 term / 多定义 / 缩进续行）
  - Emoji shortcode：`:rocket:` / `:100:` / `:+1:` 等常用短码映射（代码块内不误替换）
- **Domain Storytelling 领域故事讲授工作台 (`.egn`, `.domainstory`)**:
  - 原生识别与解析标准 egon.io JSON 规范与独立 `.domainstory` 文件；
  - Markdown 深度支持 ````domainstory````、````story````、````egn```` 声明式 DSL 与流式语法；
  - 自动渲染参与者 (Actor)、工作对象 (Work Object) 与业务活动带序号连接箭头；
  - 启发式圈层协作边界 (Groups) 布局与自适应 SVG 拓扑渲染；
  - 集成 `DiagramStepPlayer` 步进播放器，支持单步演播与聚焦高亮；
  - 支持导出标准 `.egn` 与内嵌完整模型的 Polyglot SVG 矢量图，实现图形与源码双向无损互转；
  - 包含丰富独立测试样本与 Markdown 敏捷协同示例。

### Fixed

- VSIX 打包遗漏 webview 静态资源导致 md/pdf 无法打开
- 分屏编辑后保存无法写回磁盘
- Markdown 打印代码行号错位，以及导出 HTML 表格排序箭头残留
- 退出投屏模式后大纲无法再切换显示

## [0.10.1] - 2026-09-13

### Fixed

- Excalidraw 手绘白板画布渲染自愈：新增 `sanitizeExcalidrawElements` 数据清洗层，修复非标准图元缺失 `points` 数组或内部字段导致 Canvas `TypeError: length` 崩溃的问题
- 图元驱动层接入 `@excalidraw/excalidraw` 官方 `restoreElements` 与 `restoreAppState` 标准化修复管线
- 驱动分发层与白板层多级挂载 `RenderErrorBoundary` 错误边界，彻底杜绝异常白屏

### Changed

- 同步项目工程事实与开源文档至 v0.10.1 版本标准

## [0.10.0] - 2026-09-12

### Added

- **Excalidraw 手绘白板工作室 (`.excalidraw`)**: 支持手绘交互白板 (Canvas Studio)、双向分屏 (Split)、矢量只读演示 (Preview) 与 JSON 源码编辑 (Source Code) 四种模式，内置 8 款预置手绘架构模板，支持高清 SVG / PNG / 原生 JSON 导出
- **Jupyter Notebook (.ipynb v4) 交互式数据科学工作台**: 纯端侧解析渲染 Markdown / Code 单元格、富文本输出、ANSI Traceback 高亮与一键导出 Markdown / Python 脚本
- **Typst 现代排版与出版级 AST 编译器引擎 (`.typ`, `.typst`)**: 声明式元数据解析、大纲跳转、物理分页与出版级多页 SVG 渲染生成
- **A4 2.0 工业级出版排版与高精度打印引擎**: 动态页眉页脚宏变量解析（`{{page}}`, `{{totalPages}}`, `{{title}}`, `{{date}}`）、标准 `@page` 打印规则生成与双面装订线 Gutter Margin 奇偶页交替
- **Google OKF (Open Knowledge Format) 智能知识卡片**: 原生支持 `.okf` 文件与 Markdown Frontmatter OKF 元数据智能提取
- **VS Code 双向光标与滚动同步 (Scroll Sync)**: 节点内部线性插值与边界平滑对齐

## [0.9.23] - 2026-09-11

### Added

- Markdown 长文重块视口懒挂载（代码 / 表格 / 图表 / 公式）
- Markdown 演示模式：隐藏大纲与状态栏，空格/方向键按章节翻页，Esc 退出

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

[Unreleased]: https://github.com/fsyyzz/OmniView/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/fsyyzz/OmniView/compare/v0.14.0...v1.0.0
[0.14.0]: https://github.com/fsyyzz/OmniView/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/fsyyzz/OmniView/compare/v0.12.3...v0.13.0
[0.12.3]: https://github.com/fsyyzz/OmniView/compare/v0.12.0...v0.12.3
[0.12.0]: https://github.com/fsyyzz/OmniView/compare/v0.11.9...v0.12.0
[0.11.9]: https://github.com/fsyyzz/OmniView/compare/v0.11.5...v0.11.9
[0.11.5]: https://github.com/fsyyzz/OmniView/compare/v0.11.2...v0.11.5
[0.11.2]: https://github.com/fsyyzz/OmniView/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/fsyyzz/OmniView/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/fsyyzz/OmniView/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/fsyyzz/OmniView/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/fsyyzz/OmniView/compare/v0.9.23...v0.10.0
