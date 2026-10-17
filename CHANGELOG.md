# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.3.0] - 2026-10-17

### Added

- **OmniView v1.3.0 里程碑版本正式发布 (Milestone Release — SVG v2 Advanced Studio & Test Architecture Refactoring)**:
  - **SVG v2 专业矢量编辑引擎全链路交付**：
    - **变形与手柄系统**：8 向缩放手柄等比变形（Shift 锁定宽高比）、15° 步进旋转吸附、对齐与分布计算；
    - **全套快捷键链路**：`Cmd+D`（图元副本深克隆复制）、`Cmd+G`（多选编组）、`Cmd+Shift+G`（解散编组）、`Cmd+]` / `Cmd+[`（图元层级上移/下移）、`Cmd+Shift+]` / `Cmd+Shift+[`（置顶/置底）；
    - **右键上下文菜单 (`SvgV2ContextMenu`)**：自适应视口边缘就地弹出，提供快捷复制、编组/解组、层级调度与删除；
    - **双击穿透选择 (Deep Select Drilldown)**：双击已选编组图元无缝下钻，穿透外壳精准直达具体原子叶子图元；
    - **智能吸附对齐参考线 (Smart Guides)**：6px 磁吸阈值边界与中心自动吸附，实时渲染洋红虚线导线，`Alt` 键一键抑制；
    - **悬浮 HUD 快捷工具条 (`SvgV2FloatingHud`)**：自适应浮动于选区包围盒上方，提供常用调色盘预设、描边粗细调节与水平/垂直翻转。
  - **工程架构与测试体系深度重构**：
    - **目录架构清晰解耦**：新建根目录 `tests/`，将 84 个测试套件彻底移出 `scripts/`，实现业务测试与构建流水线职责分离；
    - **统一测试基础设施库 (`tests/harness/`)**：封装 DOM 无头运行时、动态 TSX 模块加载器与自适应动态发现中心；
    - **极速并发测试调度器**：多进程并发 3 秒跑通 84 个测试套件，支持 `--category` 领域分类筛选与彩色徽标看板；
  - **物理验证与包产物**：
    - 全量通过 8 项物理工程门禁，产出高保真生产环境 VS Code 扩展包（`omniview-1.3.0.vsix`）。

## [1.2.69] - 2026-10-17

### Added

- **测试体系综合封装与架构重构 (Test Harness & Directory Architecture Refactoring — 方案 C 全套落地)**:
  - **测试与工程构建彻底解耦**：将 84 个测试套件从混杂的 `scripts/` 目录完整迁移至根目录独立 `tests/` 空间，`scripts/` 仅专注构建、门禁与发布流水线，项目工程拓扑规范度大幅提升；
  - **统一测试基础设施库 (`tests/harness/`)**：
    - `tests/harness/dom-env.mjs`：统一封装 Happy-DOM 运行时、React 19 Act 环境与 Web API Polyfill（DOMRect、DOMPoint、PointerEvents、PointerCapture），彻底消除各无头测试中冗长的全局挂载模板代码；
    - `tests/harness/module-loader.mjs`：封装基于 esbuild 的无盘/临时内存构建动态加载器，并注册安全退出清理钩子；
    - `tests/harness/discovery.mjs`：实现自适应动态套件发现引擎与多维领域标签体系（`[headless]`, `[svg]`, `[diagram]`, `[office]`, `[markdown]`, `[storage]`, `[driver]`, `[unit]`），彻底移除静态硬编码清单；
    - `tests/harness/index.mjs`：统一导出 `describe`、`it`、`assert`、`reportSummary`、`setupDomEnvironment` 与 `bundleAndLoadTsx`；
  - **测试运行器与覆盖率引擎全面升级**：
    - `scripts/run-all-tests.mjs`：全面接入动态发现中心，支持 `--category=headless` 领域过滤与分类彩色徽标实时展示，84 套全量测试保持 ~3 秒极速高并发执行；
    - `scripts/run-coverage.mjs`：废弃脆弱的静态清单正则匹配，直接由 `discovery.mjs` 驱动精准覆盖率度量与反查；
  - **代表性无头用例精简重构**：重构 `test-headless-ui-interactions.mjs` 与 `test-svg-v2-advanced-interactions.mjs`，消除 120+ 行重复样板代码；
  - **全量物理门禁严格回归**：更新规范约束与文档事实，Codex Linter、文档一致性门禁、React 治理、TypeScript 类型检查与 84 套全量测试 100% 绿色通过。

## [1.2.68] - 2026-10-17

### Added

- **SVG v2 专业级高级交互体系全量落地 (Phase 1 / Phase 2 / Phase 3 Full Delivery — L2)**:
  - **Phase 1: 快捷键链路与图元复制解编组**：
    - 新增 `object.duplicate` 核心引擎命令：支持递归深拷贝子图元节点、自动重新分配新 `NodeId`、应用坐标偏移（默认 +10px）并自动接管选区；
    - 补齐专业快捷键链路：支持 `Cmd+D`（快速复制副本）、`Cmd+G`（多选图元编组）、`Cmd+Shift+G`（解散编组）、`Cmd+]` / `Cmd+[`（图元层级上移/下移）与 `Cmd+Shift+]` / `Cmd+Shift+[`（图元置顶/置底）；
  - **Phase 2: 右键上下文菜单与双击穿透选择 (Deep Select Drilldown)**：
    - 新建 `SvgV2ContextMenu` 悬浮上下文菜单：支持就地复制、图元编组/解组、层级移动与快速删除，具备视口边缘贴合与点击外部/Esc 自动关闭机制；
    - 双击下钻穿透：当双击已选中的 Group 图元时，指针事件自动穿透编组外壳，精准选中光标所指的具体原子子节点（Leaf Child），极大提升复杂组合 SVG 的局部精细编辑效率；
  - **Phase 3: 智能吸附参考线 (Smart Guides) 与悬浮 HUD 工具条**：
    - 智能磁吸辅助线：拖拽图元时自动计算与画布其他图元边界（左/中/右、顶/中/底）的临近距离，小于吸附阈值（6px）时自动触发物理磁吸并实时渲染高对比度洋红色（`#ec4899`）对齐导线；按住 `Alt` 拖拽时可一键抑制吸附；
    - 新建 `SvgV2FloatingHud` 快捷悬浮工具栏：当有图元选中时自适应锚定于外包围盒上方，提供常用填充调色盘预设、描边粗细快速调节、水平翻转（Flip H）、垂直翻转（Flip V）、复制副本与删除操作；
  - **全量无头测试扩增至 84 套**：新增 `tests/test-svg-v2-advanced-interactions.mjs`，覆盖复制算法、快捷键链路、双击穿透、吸附导线与 UI DOM 交互，9 项核心测试 100% 绿色通过。

## [1.2.67] - 2026-10-17

### Added

- **组件级 Headless DOM 真实交互验证与覆盖率度量体系 (Headless UI Testing & Coverage Engine — L2)**:
  - **建议 B 落地 — 组件级 Headless DOM 交互套件 (`tests/test-headless-ui-interactions.mjs`)**：
    - 基于 `happy-dom` 真实无头运行时与 `esbuild` 快速编译，直接驱动 React 19 组件渲染与原生 DOM 事件；
    - **全屏灯箱 (`LightboxModal`)**：验证 `createPortal` 真实挂载、滚轮缩放事件派发、双击 2.5x 聚焦及 Esc 关闭回调；
    - **矢量画布 (`SvgV2Canvas`)**：验证真实 SVG DOM 挂载、选区设置与图元渲染；
    - **图层树面板 (`SvgV2LayersPanel`)**：验证图层行层级渲染、显隐切换点击与指令下发；
    - **键盘事件隔离**：验证 Escape / Delete 快捷键生命周期与焦点隔离；
  - **建议 C 落地 — 自动化测试代码覆盖率度量运行器 (`scripts/run-coverage.mjs`)**：
    - 集成原生 V8 覆盖率引擎与 `c8` 报表生成器；
    - 借助 `esbuild` inline source-map 机制将执行流 100% 精准回溯至 TypeScript / TSX 源码；
    - 多进程并发无锁收集覆盖率数据，输出终端文本表格看板、`coverage/lcov.info`（CI 门禁规范契约）以及 `coverage/index.html`（交互式可视化报告）；
    - 在 `package.json` 中配置 `"test:coverage": "node scripts/run-coverage.mjs"`，支持局部或全量覆盖率极速分析；
  - **全量测试套件扩增**：全项目自动化测试套件扩增至 **83 套**，全部持续保持 100% 绿色通过。

## [1.2.66] - 2026-10-17

### Added

- **自动化测试链条解耦与多核并发运行器 (Concurrent Test Runner & Orchestrator — L2)**:
  - **测试运行器彻底解耦 (`scripts/run-all-tests.mjs`)**：将 `package.json` 中长达 3000 多字符的单行 `&&` 命令行串联重构为专业测试调度器；
  - **多进程并发调度与极速执行**：内置轻量原生并发控制池（默认 6 并发），82 个全量大型测试套件执行耗时压减至 **2.9 秒**（并发加速比 ~5.8x）；
  - **智能参数筛选与局部调试**：原生支持 `npm test -- svg` 或 `--filter=math` 极速单模块测试与 `--serial` 串行调试模式；
  - **自适应动态套件发现**：自动扫描 `tests/test-*.mjs` 并智能适配打包参数，防止新增单测遗漏；
  - **美化聚合报告与错误重放**：集中展示实时执行进度、各套件耗时、失败用例日志回放与汇总看板。

## [1.2.65] - 2026-10-17

### Added

- **SVG v2 元素选择专项体系全量增强 (SVG v2 Selection System Enhancements — L2)**:
  - **Shift + Click 反选剔除机制 (Toggle Selection)**：实现专业 `selectionToggle` 纯函数算法与 `select.set` 命令扩展；按住 Shift 单击已选图元时精准将其移出多选集合，未选图元则追加合并，主选对象（`primaryId`）自动顺移，彻底解决多选状态无法单项剔除的痛点；
  - **高精度轮廓与描边命中测试 (Precise Shape & Stroke Hit Testing)**：重构底层 `hitNodeLocal` 算法，摒弃粗糙的矩形外包围盒碰撞；纯描边（无 fill）图形采用严格的点到线段与贝塞尔曲线距离平方算法（$\le (\text{tol} + \text{width}/2)^2$），空心内部空白区域彻底实现无感穿透，不再误选线条；带填充的多边形采用射线交叉法（Point-in-Polygon）进行实体判定；
  - **编组默认选择与 Cmd/Ctrl 穿透 (Group-first vs Deep Select)**：默认状态下单点 Group 内元素自动寻径至最外层编组（`findOutermostGroup`），避免误散碎选出子路径；按住 `Cmd / Ctrl`（或调用 `deepSelect`）时无视层级穿透直接命中光标底部的具体原子子图元；
  - **多层重叠图元循环点选与 Alt 穿透 (Cycle Selection)**：实现 `hitTestAllAtPoint` 获取光标下所有重叠图元候选序列；用户在同一坐标位置连续单击时，自动循环轮转切换选中下一层图元，按住 `Alt` 点击亦可直接穿透选中底层；
  - **多选态图元拖拽保护**：当处于多选状态时，光标落在其中任意一个已选图元上拖动，不再重置选区，而是直接进入选区整体移动手势（`Begin move`）；
  - **框选模式优化与全图大底图保护 (Enclosed vs Intersecting)**：`select.box` 默认支持完全包含（`enclosed`）与触碰相交（`intersect`）双模式；从左向右拉框为温和蓝色完全包含选，从右向左拉框为浅绿色触碰相交选；自动识别面积超过 80% 画布的大背景底图并在局部框选时免除误触；
  - **多选复合轮廓高亮视觉反馈**：多选时，每个被选图元独立叠加单像素虚线浅色轮廓，外层再套统一变换 Gizmo，明确选区范围；
  - **自动化测试回归套件**：新增 `tests/test-svg-selection-enhancements.mjs`，包含 8 项端到端选区增强单元测试，并接入自动化门禁流水线。

## [1.2.64] - 2026-10-17

### Added

- **全屏灯箱渲染图基于光标位置的无级精准缩放 (Lightbox Focal Point Zoom to Cursor — L2)**:
  - **几何不变性光标锚定 (Focal Invariance)**：实现全新 `focalZoom.ts` 纯函数计算引擎，缩放时基于公式 $\text{pan}_{\text{new}} = \text{offset} - (\text{offset} - \text{pan}_{\text{old}}) \cdot (\text{zoom}_{\text{new}} / \text{zoom}_{\text{old}})$ 精准锚定光标点，缩放前后光标所指图元内容在屏幕上处于绝对同一物理像素，彻底消除缩放向屏幕中心漂移；
  - **滚轮与触控板连续缩放**：支持常规滚轮阶梯（1.15 / 0.87）与触控板连续双指捏合平滑指数缩放；滚轮缩放期间动态关闭 CSS transition 缓动，实现 60 FPS 紧贴光标无延迟飘移；
  - **交互触点全面锚定**：鼠标滚轮、键盘快捷键 `+`/`-`、工具栏缩放按钮以及画布双击放大均 100% 绑定至当前光标物理坐标；
  - **画布双击智能聚焦探查**：在全屏灯箱内双击图表时，以双击光标点为中心直接放大至 2.5x 细节探查，再次双击平滑恢复自适应视口；
  - **自动化测试回归防护**：新增 `tests/test-focal-zoom.mjs`，覆盖单步与连续 8 步缩放光标零位移几何验证，并纳入全量自动化门禁。

## [1.2.63] - 2026-10-16

### Added

- **Markdown 渲染图表与图片双击全屏打开与焦点防抢占 (Markdown Diagrams & Images Double-Click Lightbox — L2)**:
  - **全图表类型双击全屏**：全面支持 Markdown 中渲染的 Mermaid、PlantUML、Graphviz DOT、SVG、Markmap 思维导图、Excalidraw 白板、DomainStory 故事图以及 KaTeX 数学公式在视觉视图下通过双击画布区域直接打开全屏高清灯箱（`LightboxModal`）；
  - **Markmap 矢量 SVG 提取**：针对 Markmap 思维导图双击全屏，通过 `XMLSerializer` 动态捕获当前渲染的 SVG 矢量 DOM，避免灯箱回退为纯 Markdown 代码；
  - **独立图片与内联 SVG 支持**：支持标准 Markdown 图片（`<img>`）双击打开并组装多图画卷画廊，以及原生内联 `<svg>` 节点双击放大；
  - **VS Code 源码跳转防误触与冒泡拦截**：修复双击图表或图片时事件向上冒泡至 `useMarkdownScrollSync` 误触发 `onOpenSourceAtLine` 导致 VS Code 编辑器强行抢焦或破坏灯箱展示的严重体验问题；在图表底层与容器双击拦截层进行双重隔离防护；
  - **视觉反馈增强**：在所有图表及图片悬停时自适应展示 `cursor-zoom-in` 手势与全屏提示（`title={t('fullScreen', locale)}`）；
  - **自动化测试回归防护**：新增 `tests/test-markdown-diagram-dblclick.mjs`，包含组件双击契约检查与容器事件分发仿真测试，并纳入全量 `verify` 门禁。

## [1.2.62] - 2026-10-16

### Added

- **SVG v2 8 向变形手柄、自由旋转、多图元对齐分布与开发者互操作 (SVG v2 Transform Handles, Alignment, Distribution & Interop — L2)**:
  - **8 向包围盒缩放手柄与实时交互**：在选择工具（`selectTool`）下选中单个或多个图元时，即时生成 8 处控制方块（`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`）与外边框虚线包围盒；拖拽手柄时基于反向针脚原点调用 `object.scale` 生成实时 Preview，释放指针时写入撤销历史；支持按住 Shift 键等比缩放；
  - **顶部旋转手柄与自由角度旋转**：在包围盒顶部中心生成连线与旋转圆形手柄，拖拽即可围绕几何中心触发 `object.rotate` 自由旋转；支持按住 Shift 键实现 15° 步进角度吸附；光标自适应变化为 `nwse-resize`、`nesw-resize`、`ns-resize`、`ew-resize` 与旋转手势状态；
  - **顶部操作工具栏 (Top Action Bar)**：在画布上方新增语义化操作栏：
    - **6 向联合对齐**：左对齐、水平居中、右对齐、顶对齐、垂直居中、底对齐（选中 $\ge 2$ 项激活）；
    - **2 向等距分布**：水平均匀分布、垂直均匀分布（选中 $\ge 3$ 项激活）；
    - **对齐与分布别名防腐**：命令层支持 `center` / `centerH`、`middle` / `centerV`、`h` / `horizontal`、`v` / `vertical` 灵活调用；
  - **开发者互操作与位图导出**：
    - **一键复制为 React JSX**：集成现代 JSX 转换器，自动处理 SVG 属性驼峰映射（如 `strokeWidth`、`fillRule` 等），注入 `{...props}` 泛型类型，一键复制并弹出成功 Toast；
    - **高清 2x PNG 导出**：支持调用原生离线画布以 2 倍超采样光栅化渲染当前 SVG 矢量图形并触发保存下载；
  - **路径端点箭头与锚点控制**：
    - 新增 `path.setMarker` 命令，支持设置起点/终点箭头（`arrow`）与圆点（`dot`），序列化导出与画布渲染内嵌 `<defs>` 标记；
    - 新增 `path.toggleAnchorKind` 命令与 Inspector 操作按钮，支持尖角锚点（`corner`）与平滑贝塞尔切线手柄（`smooth`）无缝切换；
  - **自动化测试回归防护**：新增 `tests/test-svg-v2-transform-align.mjs`（13 项全量测试），覆盖 8 向缩放手柄、旋转交互、对齐分布、端点箭头与锚点平滑度切换。

## [1.2.61] - 2026-10-16

### Added

- **SVG v2 现代编辑引擎功能全面扩充 (SVG v2 Full Tool Suite, Viewport HUD & Enhanced Inspector — L2)**:
  - **基础形状与文本工具扩充**：新增矩形（`rect`）、椭圆（`ellipse`）、直线（`line`）与文本（`text`）创建工具；支持画布内直接拖拽框选即时成型，以及点击创建文本图元；
  - **钢笔与节点编辑增强**：完善钢笔（`pen`）连续画线与点起点闭合路径交互；强化直接选择/节点（`node`）工具，支持点击选中锚点、拖拽实时微调与贝塞尔控制手柄联动；
  - **底层命令总线与几何算法补全**：新增 `object.createPath`、`object.createText`、`text.setText` 与 `path.updateAnchor` 核心命令，并完善撤销重做历史记录支持；新增 `createRectGeometry`、`createEllipseGeometry`、`createLineGeometry` 纯函数几何构造器；
  - **视口控制胶囊 HUD**：在画布底部中心新增悬浮视口控制胶囊，支持快捷放大、缩小、100% 重置、自适应居中（Fit View）及抓手平移提示；
  - **属性检视器 (Inspector) 升级**：新增描边宽度调节、端点风格（butt / round / square）、虚线预设选择（实线、点线、虚线、长短虚线）；提供 8 色精选快速调色板；针对文本节点提供内容编辑、字号滑块及对齐方式控制；
  - **自动化测试回归防护**：新增 `tests/test-svg-v2-tools-shapes.mjs`，覆盖形状几何生成、图元创建与撤销重做、文本图元编辑、锚点更新及 7 大核心工具交互。
