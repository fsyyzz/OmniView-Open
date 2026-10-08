# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.2.54] - 2026-10-09

### Fixed

- **SVG v2 编组子节点重复 bug (SVG v2 Object Group Duplicate Child Fix)**:
  - **修复 `object.group` 后图层 children 出现 Group ID 重复**（`[4, 4]`，导致图层树重复渲染行）：
    - 根因：`appendToLayer` 已把新 Group 追加到 children 末位，`objectGroup` handler 又 `push(groupId)` 一次；
    - 修复为对 `groupId` 去重的 filter（`core/commands/registry.ts`），编组后 children 精确包含原节点过滤结果 + 单个 Group；
    - 由新增 `test-svg-v2-layers-batch.mjs` 的图层树用例暴露并回归锁定。

- **SVG 画布属性面板滚轮缩放误触修复 (SVG Inspector Wheel Zoom Hijack Fix)**:
  - **修复选中图元后右侧属性面板内滚动导致画布被错误缩放**：
    - 在 `useSvgCanvasInteraction.ts` 的 `handleWheel` 入口处加入 UI 控件白名单检查（属性检视面板 `#svg-inspector-panel` / `[data-inspector-panel]`、批量检视面板 `#svg-batch-inspector-panel`、状态栏 `#canvas-statusbar`、`[data-canvas-ui]`、`input` / `select` / `textarea` / `[role="slider"]` / `[contenteditable]`），命中即直接 `return`，不调用 `preventDefault`；
    - 行为对齐 `handleMouseDown` 的既有过滤策略（line 552-558），避免画布 zoom 拦截本应属于面板内部滚动的滚轮事件；
    - 同时覆盖工具栏 `<input type="color">`、颜色选择器、文本输入、`<select>` 等控件的滚轮交互；
    - SVG v2 引擎（SvgV2Studio）默认不绑定 wheel handler，无需此修复，但保留同源检测代码以防未来添加。
  - **回归测试**：新增 `scripts/test-svg-v2-wheel-zoom-fix.mjs`（18 个契约用例：面板内连续滚 10 次 scale 不变、面板→画布切换正确响应、深层嵌套 input 阻止、画布元素正常缩放），已挂入 `npm run test`，SVG v2 测试总量 52 → **70**。

### Added

- **SVG v2 图层与批量增强 (SVG v2 Layers & Batch Enhancement — L2)**:
  - **新命令 4 条**（`core/commands/registry.ts`，30 → **34 条**）：
    - `object.align`：6 向对齐（left/centerH/right/top/centerV/bottom）× selection（选区包围盒）/ canvas（画布）双基准；
    - `object.distribute`：水平/垂直等距分布（≥3 节点，首尾不动）；
    - `object.setVisible` / `object.setLocked`：图元级显隐与锁定（对齐 `layer.*` 命名空间语义）；
  - **重排命令扩展**：`layer.reorder` / `object.reorder` 新增可选 `toIndex` 参数（与 `direction` 互斥），支持拖拽排序一步到位落位；`object.reorder` 改为在**直接父容器**（Layer 或 Group）内重排（修复 Group 内节点重排无效的旧语义）；
  - **几何/树纯函数层**（`core/model/bbox.ts` + `core/model/tree.ts`）：`nodeBBox`（AABB 仿射变换 + Group 递归聚合 + 环保护）、`alignDelta`、`distributeOffsets`、`flattenLayerTree`（编组树摊平 + 折叠集合）、`findParent`（直接父定位）、`planReorderDrop`（拖拽落点 → 重排计划，跨层/类型不匹配返回 null）；均经 barrel `core/index.ts` 导出；
  - **图层面板升级**（拆分为独立 `SvgV2LayersPanel.tsx`，遵守大组件拆分阈值）：Layer/Group 编组树递归展示（深度缩进/展开折叠/子项计数）、HTML5 拖拽排序（层间 + 同层图元，落点上下半区提示）、双击行内重命名（Enter/blur 提交、Escape 取消）、行级显隐与锁定；
  - **批量检视器**（拆分为独立 `SvgV2Inspector.tsx`）：多选（≥2）6 向对齐 + 批量填充 + 批量透明度 + 批量删除；多选（≥3）水平/垂直分布；对齐基准选择器（选区/画布）；
  - **画布递归渲染**：Group 以 `<g>` 嵌套渲染子树，隐藏节点（含层/组链）不渲染，编组树所见即所得；
  - **回归测试**：新增 `scripts/test-svg-v2-layers-batch.mjs`（27 用例，含拖拽排序纯函数准入测试与 toIndex 端到端撤销验证），已挂入 `npm run test`，SVG v2 测试 70 → **97**；
  - **总验证门禁**：`npm run verify` → **461 ✅ / 0 ❌**；`lint:codex` / `check:structure` / `check:react-governance` / `check:doc-code-consistency` 全过。

- **SVG 编辑引擎 v2 完整交付 (SVG Edit Engine v2 Full Delivery — ADR-0001)**:
  - **核心架构层 (M2)**：不可变 Document 模型 + 结构共享快照（`src/features/viewers/components/drivers/svg/core/model/document.ts`）；SVG path d ↔ Anchor[] 编解码器（`core/model/path.ts`，支持 M/L/H/V/C/S/Q/A/Z 全套命令 + cubic Bézier 序列化）；19 个 model 层单测全过；
  - **命令管线 + Runtime (M3)**：30 条核心命令（path.* 4、object.* 9、paint.* 4、layer.* 6、select.* 4、history.* 2、tool.* 1）通过 `core/commands/registry.ts` 统一注册；Runtime 实现 Begin/Preview/Commit/Cancel/Exec Action 状态机（参考 VectorCraft `crates/engine/src/lib.rs`），HistoryEntry 结构共享持久化 + Journal 命令日志；3 个 Tool 桩（select/node/pen）；21 个 Runtime 单测全过；
  - **UI 迁移 (M4)**：`SvgV2Studio.tsx` 全新顶层组件 + `useSvgRuntime` React Hook；Feature Flag `omniview.svg.engine=v2` 双轨接入原 `SvgViewer.tsx`（默认 v1，配置切换到 v2 实验引擎）；
  - **图层面板 + Inspector (M5)**：`SvgV2LayersPanel` 显隐/锁定/切换；`SvgV2Inspector` 填充色 + 包围盒 + 删除按钮；Undo/Redo 按钮挂在左侧工具栏；引擎切换器右下角；
  - **Feature Flag + 自动备份 (M6)**：`omniview.svg.engine=v1|v2` localStorage 路由；`.bak.svg` 自动备份（仅首次切到 v2 引擎时写入，标记 `[omniview-v2-engine]`）；
  - **E2E 集成测试 (M7)**：12 个端到端用例覆盖 SVG round-trip + 编辑往返一致性 + 撤销栈持久 + 异步边界 + 真实样例 fuzzing（rect/circle/line/path/polygon/g）+ 综合工作流 + Feature Flag + 备份策略；`test-svg-v2-core-model.mjs`（19）+ `test-svg-v2-runtime-commands.mjs`（21）+ `test-svg-v2-e2e.mjs`（12）= **52 个 SVG v2 测试全过**；
  - **总验证门禁**：`npm run verify` → **416 ✅ / 0 ❌ / 0 错误**（比 v2 启动前 +52 测试）。

### Architecture

- **SVG 编辑引擎 v2 基础设施奠基 (SVG Edit Engine v2 Foundation Kick-off — ADR-0001)**:
  - 通过 L3 严苛通道架构评审，落地 ADR-0001「SVG 编辑引擎 v2 — 引入文档模型与命令管线」（`docs/adr/0001-svg-edit-engine-v2-document-model.md`），完成 Proposed → Accepted；
  - 锁定核心架构决策：仅 SVG 持久化、`usvg` → **自编译** WASM 解析栈（ADR §10 Addendum 修订：浏览器侧无现成 npm usvg-wasm 包，需自编译）、P1 仅基础范围、Feature Flag `omniview.svg.engine=v2` 双轨过渡、暂不接入 AI 驱动；
  - 新增 `src/features/viewers/components/drivers/svg/core/` 编辑引擎层目录骨架，并交付 M0 接口契约：`core/model`（Document/Node/Selection/Snapshot）、`core/runtime`（Tool/Action/Command/Runtime/Journal）、`core/io`（SVG ↔ Document import/export）；
  - 后续里程碑：M1 自编译 usvg-wasm 集成（含 toolchain 缺失自动回退 fallbackDomParse）、M2（Document + Snapshot）、M3（命令表 + Runtime）、M4（UI 迁移 select/node/pen）、M5（图层面板 + Undo UI）、M6（Feature Flag 灰度）、M7（红蓝对抗 + 全量门禁）。

## [1.2.53] - 2026-10-06

### Fixed

- **SVG 画布属性面板与图元选中状态持久保活 (SVG Canvas Element Selection & Inspector Panel Persistence Fix)**:
  - **修复属性面板在点击后瞬间消失的缺陷**：
    - 引入 `dragModeRef` 同步即时跟踪拖拽与交互模式，彻底解决 React 批处理与闭包异步陈旧读导致的模式失步；
    - 在图元点击与释放（`handleMouseUp`）中坚决保障选中态稳定持有，移除非空白点击场景下的误杀清空逻辑；
    - 激活 `useLayoutEffect` 驱动测量引擎自动就绪，确保图元包围盒（BBox）与精准高亮 Gizmo（`SvgSelectionGizmo`）稳定跟随，单选与多选属性检视面板持续持久展示。

### Added

- **SVG 画布多选与批量编辑生态 (SVG Multi-Element Canvas Selection & Batch Editing Ecosystem)**:
  - **画布自由矩形框选 (Marquee Selection)**：
    - 支持在画布空白处自由拖拽出半透明虚线框选矩形，动态 AABB 碰撞检测快速框选目标图元集合；
  - **键盘修饰键加减选 (Shift / Ctrl Multi-Select)**：
    - 按住 `Shift` 或 `Ctrl` / `Cmd` 键点选图元，支持加选与减选切换；
    - 支持 `Ctrl+A` / `Cmd+A` 一键全选画布所有有效矢量图元；
  - **多选整体同步拖拽移动与微调**：
    - 针对多选集执行 0 延迟实时 DOM 平移，拖拽跟随丝滑流畅；支持键盘方向键（`Arrow` ±1px / `Shift+Arrow` ±10px）批量微调；
  - **联合对齐与等间距分布工具 (Align & Distribute)**：
    - 以所有选中图元的联合外包围盒 (Union BBox) 为基准，提供左对齐、水平居中、右对齐、顶对齐、垂直居中、底对齐；
    - 支持在首尾图元之间对中间所有图元进行水平/垂直等间距自动排列（Space Evenly）；
  - **批量外观与样式设置 (Batch Appearance & Styling)**：
    - 专责多选面板 (`SvgBatchInspectorPanel.tsx`) 提供一键批量修改所有选中图元的填充色、描边色、描边粗细与透明度；
  - **一键编组与解组 (Group & Ungroup)**：
    - 支持快捷键 `Ctrl+G` / 按钮将多个选中图元一次性封装为 `<g>` 编组容器；
    - 支持快捷键 `Ctrl+Shift+G` / 按钮一键拆解 `<g>` 编组恢复为独立图元；
  - **批量删除**：
    - 支持快捷键 `Delete` / `Backspace` 或面板按钮批量删除所有选中的图元。

## [1.2.51] - 2026-10-06

### Added

- **设置中心日志管理专区与多格式导出中枢 (Settings Log Management Hub & Multi-Format Exports)**:
  - **设置中心独立一级选项卡 (`activeTab === 'logs'`)**：
    - 新增「运行日志」专属管理面板，提供日志总条数、存储占用、错误数、警告数与 VS Code OutputChannel 联动状态看板；
    - 内置「最近实时日志流 (Top 100)」快速检视窗口，支持关键词实时过滤与分级（全部/错误/警告/信息）切换；
  - **多格式专业诊断导出中枢 (Multi-format Export Hub)**：
    - **标准日志文件 (`.log`) 导出**：导出带有时间戳、模块来源、分级标签的标准文本日志文件；
    - **结构化原始数据 (`.json`) 导出**：导出包含对象堆栈、序列化元数据的完整 JSON 诊断数组；
    - **系统全景体检与排障诊断报告 (`.md`)**：一键生成 Markdown 格式报告，包含运行宿主（VS Code / 独立浏览器）、客户端 UA、IndexedDB 5 大仓库容量指标、最近异常追踪；
    - **一键复制诊断文本**：支持过滤后的日志一键复制至剪贴板，方便人类反馈提交 Issue；
  - **全屏日志分析抽屉 (`LogViewerModal.tsx`) 同步升级**：
    - 引入实时关键词全文检索框；
    - 导出按钮扩展为包含 `.log`、`.json`、系统全景报告与复制日志的下拉组合。

## [1.2.50] - 2026-10-06

### Added

- **应用运行与诊断日志中枢生态：IndexedDB 持久化、自动容量淘汰与 VS Code Output 双向桥接 (App Logger Hub & Persistent Diagnostics)**:
  - **IndexedDB 数据库升级至 V4 (`logs`)**：
    - 新增 `STORE_LOGS` 对象仓库，带有 `timestamp`、`level`、`source` 索引，实现日志安全离线落盘；
    - 严格容量守护：最多保留 1000 条日志，超过自动基于时间戳升序游标淘汰至 800 条，杜绝磁盘溢出；
  - **统一前端日志中枢 (`appLogger.ts`)**：
    - 维护内存环形缓冲区 (最近 200 条，0ms 响应)，支持响应式事件订阅与 UI 刷新；
    - 500ms 批量防抖持久化落盘，避免高频 I/O 阻塞主线程；
    - 宿主 IPC 联动：自动将 Webview 内的 warning / error 通过 `postMessage` 实时上报至 VS Code 原生 `OmniView OutputChannel`；
  - **设置中心全景存储看板升级（第 6 分区）与诊断日志查看器 (`LogViewerModal.tsx`)**：
    - 存储看版新增「运行与诊断日志 (App Logs)」卡片，支持独立清空日志库；
    - 提供专用日志诊断抽屉：支持全部/错误/警告/信息按级别高亮过滤、一键「复制诊断日志」、一键「导出 .log 文件」与实时刷新。

## [1.2.49] - 2026-10-06

### Added

- **全景持久化存储生态升级：查看器阅读交互记忆与重型矢量快照全覆盖 (Viewer States Memory & Comprehensive Render Snapshots)**:
  - **IndexedDB 数据库升级至 V3 (`viewer_states`)**：
    - 新增 `STORE_VIEWER_STATES` 交互状态仓库，索引 `fileId`、`viewerType` 与 `updatedAt`；
    - 提供 `idbGetViewerState`、`idbSetViewerState`、`idbClearViewerStates` 等强类型 API，支持跨会话记忆阅读进度与视图偏好；
  - **PDF 工业级阅读器阅读进度记忆与批注持久化 (`PdfViewer.tsx`)**：
    - 打开 PDF 文档时自动读取历史状态，无缝跳回上次阅读页码、排版模式（单页/双页/连续）与缩放比例，并提供友好恢复 Toast 提示；
    - 将彩色高亮与批注从 LocalStorage 迁移持久化至 IndexedDB，彻底解除浏览器 5MB 配额瓶颈；
  - **CSV / TSV 数据网格偏好记忆 (`useCsvGrid.ts`)**：
    - 自动持久化并还原用户自定义排序列、升降序规则、每页显示行数与网格/源码视图模式；
  - **Mermaid & Graphviz 深度接入双层持久化快照池 (`render_cache`)**：
    - Markdown 内嵌代码块与独立工作室全面接入 `persistentMermaidCache` 与 `persistentGraphvizCache`；
    - 渲染前优先读取 IndexedDB 离线快照，二次打开 0ms 瞬间上屏，跳过重复编译并降低 CPU 占用；
  - **设置中心五大独立分区存储看版升级 (`WorkbenchSettingsModal.tsx`)**：
    - 新增「阅读与交互记忆 (Viewer States)」统计看板，支持独立「重置阅读偏好」一键清理。

## [1.2.48] - 2026-10-06

### Added

- **全景存储透视与精细化分区独立清理工作台 (Storage Inspection & Granular Cleanup Dashboard)**:
  - **宿主存储沙箱总配额透视 (`getBrowserStorageEstimate`)**：基于 `navigator.storage.estimate` 实时探测浏览器/宿主环境分配的总配额与实际使用占比进度条；
  - **四大独立分区存储看板**：
    1. **图表离线快照 (Render Cache)**：展示渲染产物条目数、已用空间与 50MB 守护水位线，配备独立「清空快照缓存」按钮；
    2. **二进制多媒体 (Blobs Store)**：展示本地缓存的 PDF/Office/大图片 ArrayBuffer 介质数，配备「清理媒体附件」按钮 (`idbClearBlobs`)；
    3. **工作区文档 (Workspace Files)**：实时统计多篇文档占用字节数，配备「还原示例文档」按钮；
    4. **配置偏好 (Settings & State)**：展示 LocalStorage 键数与 VS Code 属性对齐状态，配备「备份配置 JSON」；
  - **精细化独立清理与实时刷新**：支持针对特定数据独立释放空间，每次清理后自动刷新统计数据并提供温和状态提示，杜绝误删文档。

## [1.2.47] - 2026-10-06

### Added

- **离线图表渲染快照持久化缓存池与 50MB 空间配额守护 (Render Cache Persistence & LRU Quota Guard)**:
  - **确定性复合哈希键生成器 (`makeDeterministicCacheKey`)**：统一 CRLF 与剪裁首尾空白，正交绑定 `engine`、`format`、`theme`（深浅色）与 32 位 `fastFnv1a` 摘要，杜绝哈希碰撞与跨主题污染，全局唯一；
  - **双层门面与并发 Singleflight (`diagramCache.ts`)**：提供 `PersistentDiagramCache` 抽象，内存 LRU (0ms 响应) + IndexedDB 二级存储，通过 In-Flight 字典合并相同并发请求，避免冗余 I/O；
  - **IndexedDB 智能 LRU 游标淘汰与 50MB 配额守护 (`indexedDbStorage.ts`)**：
    - 数据库升级至 V2，新增 `render_cache` 仓库；
    - 设定 50MB 硬上限配额与 45MB 高水位线、35MB 低水位线；
    - 超限时后台基于 `lastAccessedAt` 索引升序游标，自动批量淘汰陈旧记录，确保磁盘空间永不溢出；
  - **PlantUML 真正离线化与秒开 (`PlantUmlBlock.tsx`)**：优先读取本地离线快照，成功时自动拉取 SVG 沉淀至持久化池，断网状态下仍可秒开显示并提供「⚡ 离线就绪」徽标；
  - **设置中心存储可观测性与一键清理 (`WorkbenchSettingsModal.tsx`)**：可视化呈现渲染缓存已用空间与条目数（带进度条），并支持一键清空快照缓存；
  - **全链路自动化测试 (`scripts/test-render-cache-persistent.mjs`)**：新增 5 组自动化单测，全面覆盖规范化 Key、Mock IDB、Singleflight 幂等写入、双层回填与一键清空。

## [1.2.46] - 2026-10-06

### Added

- **原生 IndexedDB 本地持久化与双层存储引擎 (Native IndexedDB Storage Engine & Dual-Layer Architecture)**:
  - **IndexedDB 原生引擎落盘 (`indexedDbStorage.ts`)**：采用 0 外部依赖纯原生 TypeScript 封装，建立 `OmniViewDB` 数据库，实现 `files`（文件与元数据）与 `blobs`（二进制大对象）对象仓库，彻底打破 `localStorage` 5MB 配额瓶颈，支持数百 MB ~ 数 GB 级海量文档与图表持久化；
  - **双层存储网关与内存热缓存 (`fileStorage.ts`)**：构建「内存高速缓存 (0ms 首屏响应) + 200ms 防抖后台异步落盘 (非阻塞 I/O)」双层架构，保持原有同步接口兼容性，免去组件重构负担；
  - **无感平滑迁移机制 (Zero-Friction Migration)**：在首次初始化时自动检测并迁移 `localStorage` 中的旧版文件数据至 IndexedDB，迁移完成后释放 LocalStorage 空间；
  - **异步水合与 Stale-While-Revalidate (`App.tsx`)**：React 根应用通过 `initStorageAsync` 实现首屏即刻加载与后台静默水合，完全杜绝主线程卡顿与闪烁；
  - **配置中心存储卡片增强 (`WorkbenchSettingsModal.tsx`)**：可视化呈现 IndexedDB V2 异步引擎运行状态、已持久化文档计数与海量存储容量，清晰透视双层存储架构；
  - **全链路测试覆盖 (`scripts/test-indexeddb-storage.mjs`)**：新增 6 组自动化单元测试，全面覆盖降级容错、事务批处理、Blob 存取、存储度量与版本平滑迁移。

## [1.2.45] - 2026-10-03

### Changed

- **Markdown 视图与代码视图替换面板悬浮体验升级 (Floating Replace Popover Layout)**:
  - **Markdown 替换面板悬浮化**：将原本横向展开挤占顶栏空间的替换条，重构为悬浮挂载在查询框正下方的独立 Popover 卡片式浮层，杜绝挤压顶栏其他工具按钮，配备精致阴影、边框与主题令牌自适应；
  - **CodeViewer 查找与替换双卡片解耦**：查询条保持轻巧单行浮动卡片，替换条独立悬浮在查询条正下方（通过柔和下移渐入动画呈现），支持独立关闭与快捷键跳转，双端视觉与交互范式完全统一。

## [1.2.44] - 2026-10-03

### Added

- **Markdown 视图与代码视图查找与替换工作台 (Markdown & Code View Find & Replace Workbench)**:
  - **Markdown 就地静默替换 (In-place Silent Replace)**：在 Markdown 渲染预览态下支持就地静默替换，实现单处精准替换与倒序全部无偏替换，自动触发文档更新、热重载持久化与大纲热力刷新，杜绝切屏打断；
  - **轻量实用型双轨替换界面**：
    - **CodeViewer 浮动替换工作台**：支持 `Ctrl+H` 快捷呼出、划选文本智能注入、`Aa` 大小写敏感切换、单处替换与全部替换，深度联动 `useTextHistory` 撤销/重做栈；
    - **MarkdownToolbar 顶栏折叠替换条**：无缝集成折叠式替换条与操作按钮组，未唤起时保持极简，唤起后与全文高亮检索完全协同；
  - **检索高亮引擎增强与全局路由分流**：`domSearchHighlighter` 引入 `caseSensitive` 大小写敏感匹配选项，`PluginDocumentView` 对 `Ctrl+H` 实施精准分流，彻底杜绝快捷键抢焦。

## [1.2.43] - 2026-10-03

### Changed

- **代码视图 (CodeViewer) Ctrl+F 搜索框精准自动聚焦与防劫持 (Code View Search Hotkey Routing)**:
  - **外层快捷键精准分流**：修复 `PluginDocumentView` 在源码模式 (`viewMode === 'source'`) 或焦点位于代码编辑器内部时，按 `Ctrl+F` 错误唤起 Markdown 顶栏并抢夺焦点的冲突缺陷，精准分流至代码视图专用搜索工作流；
  - **划选文本智能提取注入**：在代码编辑或只读浏览时划选关键词（变量、函数名等）按 `Ctrl+F`，自动将选中文本带入搜索框并全选聚焦；
  - **多重异步聚焦保障**：为代码浮动搜索条注入固定 ID (`ov-codeviewer-search-input`)，通过 `requestAnimationFrame` 及双重延迟重试确保输入框 100% 聚焦选中文本。

## [1.2.42] - 2026-10-03

### Added

- **Markdown 大纲视图与全文检索热力聚类工作台 (Markdown Outline & Search Heatmap Integration)**:
  - **跨格式通用聚类引擎 (Unified Search Aggregator)**：抽象并落地 `documentSearchAggregator`，统一赋能 Markdown 与 Word，基于 DOM 顺序与大纲 AST 建立节点拓扑关联；
  - **大纲热力角标与上下文抽屉**：Markdown 大纲（列表与树形两种模式）在搜索时实时挂载章节命中数 `[N]` 胶囊徽标，点击展开上下文摘要卡片，并支持一键精准高亮跳转；
  - **无冲突防噪过滤与状态看板**：顶部实时呈现“找到 N 处匹配”看板，支持一键切换「仅显命中」章节，未命中章节柔和淡化，解决长篇大纲下的检索噪声干扰；
  - **自动化唤起联动**：输入搜索词命中时自动唤起大纲侧边栏，为长篇技术文档提供全局热力地图。

## [1.2.41] - 2026-10-03

### Added

- **Word (.docx) 目录大纲与全文检索热力聚类工作台 (Docx Toc & Search Heatmap Integration)**:
  - **就地热力聚类引擎 (Search Aggregator)**：实现 `docxSearchAggregator`，自动将全文 `mark.ov-search-match` 命中标记与 H1~H6 大纲树节点建立拓扑映射；
  - **章节匹配角标与上下文抽屉**：命中关键字的章节右侧自动亮起 `[N]` 计数胶囊徽标，点击可平滑展开该章节下包含的具体匹配句片段卡片，点击任意卡片瞬间平滑定位并闪烁高亮；
  - **无冲突防噪过滤**：当大纲节点较多时，无命中的章节自动淡化（opacity 40%），并提供「仅显命中」一键过滤按钮，秒级消除无匹配长列表视觉噪音；
  - **全局快捷键联动**：全面支持 `Ctrl+F` / `Ctrl+R`（拦截默认浏览器刷新）自动唤起并聚焦导航热力面板，搜索清空时平滑恢复完整大纲状态。

## [1.2.40] - 2026-10-03

### Changed

- **Word (.docx) 现代连贯流式排版升级与文字截断彻底根治 (Docx Fluid Layout & Anti-Clipping)**:
  - **默认采用现代流式连贯排版**：默认视图模式由生硬切页调整为 `fluid` 连贯视图（Web Layout），版心宽度精准控制在 860px，长文档与大表格顺畅展开，彻底杜绝上一页大段留白与断行割裂；
  - **彻底废除 `overflow: hidden` 截断**：移除 `docxPaginationEngine` 与样式表中对单页容器的强制隐藏溢出限制，杜绝超出页面高度的段落文字、公式和表格被硬生生吞掉的严重缺陷；
  - **拟真分页符提示**：流式视图下为文档原有分页位置注入 Word 风格的精致虚线与“分页符 (Page Break)”徽标，兼顾流式沉浸阅读与纸张边界感知；
  - **工具栏视图模式体验优化**：优化工具栏中“流式 (默认推荐)”与“分页”的交互状态与说明，支持无缝实时切换。

## [1.2.39] - 2026-10-03

### Added

- **官方标准透明背景插件图标与多主题视觉适配 (Official Compliant Extension Icon)**:
  - **透明通道与边缘羽化**：全面适配 VS Code 官方 Extension Icon 规范，采用纯净透明 Alpha 背景，无生硬外框与大投影；
  - **全能视界符号设计**：中心融合“O”与“V”棱镜晶体以及全景透镜几何光圈，预留 15% 均匀安全内边距；
  - **多主题自适应**：在 VS Code 深色、浅色及高对比度主题下均具备清晰高辨识度。

## [1.2.38] - 2026-10-02

### Changed

- **CI/CD 自动化流水线演化与 VS Code 插件市场发布支持 (Marketplace Automated Release Workflow)**:
  - **发布引擎升级**：构建与发布阶段全面迁移至 `@vscode/vsce` 官方标准套件，并显式注入 `--pat` 认证凭证；
  - **双通道触发支持**：Release 工作流支持 Git Tag (`v*.*.*`) 自动触发与 `workflow_dispatch` 手动输入版本号一键触发发布；
  - **发布状态感知增强**：精简流水线错误忽略机制，使插件市场发布状态与错误诊断具有完整的可观测性与精准告警。

## [1.2.37] - 2026-09-30

### Fixed

- **Excel (.xlsx) 暗色主题文字与界面全景高对比度适配 (XLSX Dark Theme Legibility & Design Tokens)**:
  - **全量消除硬编码色值与未定义令牌**：彻底排查并替换 `XlsxViewer.tsx` 中散落的 `text-slate-*`、`bg-[var(--ov-panel-bg,#161b22)]` 与未定义的 `--ov-fg`，全量接入 `--ov-bg`、`--ov-surface`、`--ov-surface-header`、`--ov-border`、`--ov-text`、`--ov-text-secondary` 与 `--ov-text-muted` 语义化设计令牌；
  - **单元格文本对比度增强**：在数据单元格 `<td>` 上显式绑定 `color: var(--ov-text)`，空单元格提示采用 `var(--ov-text-muted)`，杜绝暗色背景下单元格文字继承失真导致的文字看不清；
  - **Univer 引擎深色主题与字体样式桥接**：修正 `univerThemeBridge.ts` 映射变量名，并在 `xlsxToUniverAdapter.ts` 转换层中为深色模式注入复用样式规则 `ov-dark-cell`（`#e6edf3`），确保 Univer 专业 Canvas 2D 绘图在各种暗黑主题下文字高亮清晰可辨。

- **CSV / TSV 表格预览行号操作列抖动与向右闪烁根治 (CSV/TSV Line Number Anti-Jitter)**:
  - **行号列固定 80px 宽度约束**：为表头 `<th>` 与表体行号 `<td>` 统一绑定 `width: 80, minWidth: 80, maxWidth: 80` 并设置 `box-sizing: border-box`，消除 HTML 表格默认 auto layout 在内容变更时对整列宽度的动态重新计算；
  - **悬浮按钮绝对定位双层重叠架构**：行号单元格采用绝对居中重叠容器，默认行号与悬浮展示的添加、复制、删除 3 项操作按钮组通过平滑 `opacity` 淡入淡出过渡，内容尺寸严格锁定在固定区域内，彻底杜绝悬浮显示操作按钮时整张表格右移闪动的现象（0 像素抖动）。

## [1.2.36] - 2026-09-30

### Fixed

- **Markdown 打印与导出净化：剔除表格底部统计栏与双击就地编辑提示 (Markdown Print Clean Table Footer)**:
  - **打印介质净化**：在 `@media print` 样式中补充 `.ov-table-block-footer`、`.table-block-footer`、`.ov-col-resizer` 与 `.no-print` 隐藏规则，彻底剔除打印或导出 PDF 时表格底部出现的“总行数: X”与“双击单元格就地编辑”屏幕专用交互提示；
  - **组件级防御**：在 `TableBlock.tsx` 与全屏表格灯箱 `TableLightboxModal.tsx` 底部统计栏结构上显式赋予 `no-print` 标记，双重锁定打印介质下的静默隐藏；
  - **导出引擎同步**：在 `exportEngine.ts`（支持导出为 Word / 便携 HTML）与 `a4TypographyEngine.ts` 中同步剔除表格底部统计栏与拖拽列宽手柄，保障外部交付物排版规范；
  - **自动化契约守护**：更新 `test-markdown-print-export.mjs` 测试套件，并通过 Chrome CDP 打印媒体仿真断言 `ov-table-block-footer` 在 `@media print` 下 computed display 严格为 `none`。

## [1.2.35] - 2026-09-30

### Fixed

- **PlantUML / Mermaid / Mindmap 双栏拖拽黑屏与内容被遮挡问题终极修复 (Split Drag Transparent Overlay Fix)**:
  - **样式污染斩断**：排查并彻底移除了 `src/index.css` 中对 `#diagram-studio-shell .absolute`、`#plantuml-studio-container .absolute` 与 `#mindmap-studio-container .absolute` 的宽泛通配选择器，杜绝其将拖拽遮罩强制赋予不透明深色背景 `var(--ov-surface)` (`#111827`) 导致两边内容在拖动时被 100% 遮蔽的严重缺陷；
  - **双重透明度防御**：为 `DiagramStudioShell`、`PlantUmlViewer` 与 `MindmapViewer` 中的拖拽全局手势防脱遮罩增加专属 `.ov-drag-overlay` 标记类名，并显式绑定内联 `style={{ backgroundColor: 'transparent' }}`，确保在全主题与高层级下维持绝对透明；
  - **浏览器自动化真实验证**：经由 Chrome CDP 模拟拖动全过程（包含多段 `mousemove`）验证，确认拖拽期间遮罩背景色恒为 `rgba(0, 0, 0, 0)`，左右两栏代码编辑器与图表画布内容清晰稳定可视，拖拽丝滑无闪烁。

## [1.2.34] - 2026-09-30

### Fixed

- **PlantUML / Mermaid 双栏分屏拖拽黑屏与卡死问题彻底根治 (Split Pane Smooth Dragging & Black Screen Fix)**:
  - **rAF 帧率驱动节流**：在 `useSplitPane` 与 `DiagramStudioShell` 中引入 `requestAnimationFrame` 驱动分屏比例更新，将高频同步写入 `localStorage` 彻底后置到 `mouseup` 事件，消除拖拽过程中主线程 I/O 阻塞造成的严重掉帧；
  - **子容器最小宽度防塌陷**：为代码编辑栏与矢量渲染栏强制设置 `minWidth: 180px` 与 `shrink-0`，杜绝极端拖拽比例或视口突变导致画布宽度塌陷为 0；
  - **ResizeObserver 边界安全约束**：在 `MermaidStudioCanvas` 舞台挂载 `ResizeObserver`，当分屏容器尺寸剧烈变动时防抖矫正平移边界，彻底防止矢量画布漂移出 `overflow: hidden` 视口呈现全黑假死现象。

### Added

- **HTML5 视口仿真多分辨率规格扩展与横竖屏旋转 (HTML Responsive Viewport Presets & Rotation)**:
  - **9 档专业视口规格矩阵**：新增全高清 1080P (`1920×1080` / `16:9`)、高清便携本 (`1366×768` / `16:9`)、经典笔记本 (`1280×800` / `16:10`)、平板横屏 (`1024×768` / `4:3`)、平板竖屏 (`768×1024` / `3:4`)、大屏旗舰手机 (`430×932` / `19.5:9`)、标准手机 (`375×667` / `16:9`) 与微屏紧凑机 (`320×568` / `16:9`)，支持流式自适应桌面 (`100%`)；
  - **横竖屏一键旋转 (Orientation Flip)**：支持通过顶部旋转按钮一键互换长宽，极速验证移动端与平板终端横竖屏排版响应；
  - **仿真外框与尺寸标注胶囊**：动态渲染手机灵动胶囊/听筒拟真外框，并常驻展示当前分辨率与长宽比标注。

## [1.2.33] - 2026-09-30

### Fixed

- **Word (.docx) 系统打印与跨宿主高保真隔离导出修复 (DOCX Print Isolation & VS Code Webview Bridge)**:
  - **宿主打印桥接**：解决 VS Code 插件内 `window.print()` 被沙箱静默屏蔽的问题，接入 `requestPrintHtml` 与 Extension Host 打印通道，一键唤起系统默认浏览器打印预览并支持导出标准 PDF；
  - **独立纯净 A4 模板**：针对浏览器外层容器 `overflow: hidden/auto` 导致的打印丢页/单页截断问题，构建全隔离的纯净打印模板，自动剥除暗夜/羊皮滤镜与搜索高亮态，严格保证跨页排版（`page-break-after: always`）与表格规整；
  - **键盘交互支持**：新增全局 `Ctrl+P` 快捷键，无缝调起打印管道。
- **Word (.docx) 复制全文为 Markdown 结构与内联样式解析修复 (DOCX DOM to Markdown Deep Extraction)**:
  - **真实 DOM NodeList 兼容**：修复 `Array.isArray(childNodes)` 在浏览器环境下恒为 `false` 导致文本内容被清空的严重兼容性缺陷；
  - **Word 标题智能识别**：深度兼容 docx-preview 的 `docx_heading_*`、`docx-p-heading-*` 类名及大纲段落特征，准确保留 `#` 标题层级；
  - **Word Numbering 列表支持**：适配 `-num-*` 类名与段落前缀，准确映射为标准 Markdown 缩进列表（`-` 与 `1.`）；
  - **富文本内联样式全量覆盖**：增加对 `<span>` 元素内联 `fontWeight`（粗体）、`fontStyle`（斜体）、`textDecoration`（删除线）、`fontFamily`（代码）等多维样式的自动解构；
  - **页面冗余清理**：智能过滤每页重复出现的页眉（`header`）、页脚（`footer`）与隔离符，保障导出的 Markdown 纯粹规范；
  - **测试覆盖扩充**：`test-docx-markdown-converter.mjs` 覆盖率提升至 12 组真实场景用例。

## [1.2.32] - 2026-09-28

### Added

- **Word (.docx) 结构化提取与一键复制为 Markdown (DOCX DOM to Markdown Extraction)**:
  - **纯函数转换器**：引入 `docxMarkdownConverter.ts`，基于渲染树将标题（H1~H6）、正文段落、粗体/斜体、有序/无序列表、图片、超链接与规范表格结构化反解为清晰的 Markdown 语法；
  - **工具栏快捷操作**：在 `DocxViewer` 顶栏新增一键「复制全文为 Markdown」交互按钮，配合绿色对勾反馈与防抖提示，极大提升 Office 文档内容转入知识库与 AI 提示词的效率；
  - **Office 操作能力矩阵升级**：自动化操作矩阵套件覆盖升至 26 项大满贯，包含专属单元测试 `test-docx-markdown-converter.mjs`。

## [1.2.31] - 2026-09-28

### Added

- **全面引入 Univer 专业电子表格工作台 (Full Univer Spreadsheet Engine Integration)**:
  - **核心模块集成**：完整引入 `@univerjs/core`、`@univerjs/design`、`@univerjs/engine-render`、`@univerjs/engine-formula`、`@univerjs/sheets`、`@univerjs/sheets-ui`、`@univerjs/sheets-formula`、`@univerjs/sheets-formula-ui`、`@univerjs/sheets-numfmt` 与 `@univerjs/themes`；
  - **双模单键无缝切换**：在 `XlsxViewer` 中提供「极速轻量预览 (默认秒开)」与「Univer 专业工作台 (Canvas 2D 60FPS 虚拟滚动、公式计算与就地编辑)」双模自由切换；
  - **纯前端离线数据转换适配器**：新增 `xlsxToUniverAdapter.ts`，基于 OOXML 原生解析结果，实现单元格数值、类型、公式、合并单元格（`mergeData`）与多工作表的 100% 离线无损转换，彻底规避网络与商业版授权依赖；
  - **VS Code 与 --ov-* 多主题桥接器**：新增 `univerThemeBridge.ts`，深度映射 `--ov-*` 语义化设计令牌与 VS Code 原生 CSS 变量，支持浅色/暗色及高对比度主题像素级融合；
  - **Vite 按需动态懒加载与独立分包**：配置 `vendor-univer` Chunk 物理隔离，确保普通文件预览与工作台轻量启动零资源拖累，并在组件卸载时调用 `univer.dispose()` 杜绝内存泄漏；
  - **完整中英文国际化语言包注入**：全量内置 Design、UI、Sheets、FormulaUI 语言包，保证菜单与公式工具栏原生汉化。

### Added

- **补充 Univer 适配层与模型转换自动化测试套件**:
  - `test-xlsx-engine.mjs` 新增 `testConvertOmniWorkbookToUniver`，覆盖工作表拓扑、单元格坐标、类型推断与合并单元格校验，保障 100% 转换准确率。

## [1.2.30] - 2026-09-28

### Added

- **SVG 矢量检视工作台代码行与画布图元反向映射高亮 (SVG Bi-directional Code Hover Inspection)**:
  - 源码面板代码行 Hover 联动：当光标悬浮在 SVG 源码指定标签或属性行时，自动推导行号与 DOM 图元对应关系，并在画布中实时高亮对应矢量图元；
  - 路径控制点编辑与属性检视联动优化，提升矢量图形可视化微调与调试效率。

### Documentation

- **完成 Univer 电子表格引擎引入前置影响面与架构评估 (Univer RFC & Impact Assessment)**:
  - 系统评估构建包体积与 VSIX 离线容量影响（预计增加 1.5MB~2.2MB，受 `manualChunks` 隔离保护）；
  - 确认 Univer v1.0+ 对 React 19 的原生 peerDependencies 兼容性；
  - 制定纯前端本地离线数据转换管道架构（基于现有 `xlsxEngine` 转换为 `IWorkbookData`，规避商业版授权限制）；
  - 确立“极速轻量预览 + Univer 专业工作台”双模共存设计。

## [1.2.29] - 2026-09-28

### Added

- **补充 Excel (.xlsx) 官方演示数据工作簿 (Office Spreadsheet Suite)**:
  - 新增 `examples/xlsx/omniview-budget-report.xlsx`：涵盖双工作表（Sheet 1: 业务营收与增长，Sheet 2: 研发及运营预算明细）、公式计算值（SUM、差额扣减）、格式化数值与状态预警；
  - 目录内附说明文档并同步更新 `examples/README.md` 全景矩阵与推荐路径；
  - `xlsxEngine.ts` 导出 `generateSampleXlsxBytes`，`generate-office-samples.mjs` 升级为 Office 三剑客完整生成流水线；
  - `test-office-operations-matrix.mjs` 扩展覆盖 XLSX 8 项核心操作，Office 三剑客全套 25 项核心交互能力 100% 确认可用并受单测持续守护。


### Added

- **DOCX 引入高效流式阅读与 A4 分页双模架构 (Fluid Reading & Paged Dual Mode)**:
  - **默认启用高效流式阅读 (Fluid Reading Mode)**：针对 VS Code 分屏开发与代码/文档对照场景，彻底打破传统打印纸的固定宽度约束与大面积断层空白，段落与表格自然流动自适应窗口宽度，滚动流畅丝滑；
  - **保留 A4 拟真分页校对视图 (Paged Mode)**：在顶栏提供极简「流式 (默认) / 分页」一键切换，满足偶发的出版级打印排版校验；
  - **深浅主题自然融合**：流式模式下外层采用统一优雅的最大宽度受控排版，大幅提升代码阅读与文本选区复制效率。


### Added

- **Word (.docx) 示例文档扩充至 5 页高保真多章节架构指南 (Multi-page DOCX Suite)**:
  - 在 `docxEngine.ts` 与 `examples/docx/omniview-architecture-guide.docx` 中注入 4 处显式硬分页符（`<w:br w:type="page"/>`），严格划分为 5 个独立 A4 页面；
  - 构建涵盖 5 个一级大纲（Heading 1）与 10 个二级小节（Heading 2）的完整章节体系，包括独立封面页、核心特性排版、排版支持度矩阵表格、三重纸张滤镜与全局快捷键对照表、常见问题解答 FAQ；
  - 完美适配左侧 Navigation Pane 大纲过滤、点击平滑滚动跳转与脉冲高亮动画（Highlight Flash）。

- **PPTX 演讲者备注 (Speaker Notes) 标准解析与交互兜底**:
  - 在 `pptxEngine.ts` 中全面接入 `ppt/notesSlides/notesSlide{N}.xml` 演讲者备注标准解析与生成支持；
  - 优化 `PptxViewer` 备注抽屉展示逻辑，无论有无备注均提供清晰界面反馈并附带“当前幻灯片暂无演播提词与备注”友好兜底。

- **DOCX & PPTX 全套 17 项核心操作可用性验证矩阵与守卫测试**:
  - 新增 `scripts/test-office-operations-matrix.mjs` 自动化回归套件并接入 `npm test`，持续守护 DOCX 9 项核心操作与 PPTX 8 项核心操作的可用性；
  - 增强 `DocxViewer` 的 `@media print` 样式，在点击「系统打印 / 导出 PDF」时自动剔除工具栏与侧栏，实现纯净 A4 无损打印。


### Added

- **补充 Word (.docx) 与 PowerPoint (.pptx) 官方高保真示例集 (Office Samples Suite)**:
  - 新增 `examples/docx/omniview-architecture-guide.docx`：涵盖大纲分级标题（H1/H2）、拟真 A4 分页、对比矩阵表格与段落样式，用于测试 Word 离线渲染与导航大纲提取；
  - 新增 `examples/pptx/omniview-tech-presentation.pptx`：涵盖 16:9 封面页、架构特性卡片、内嵌矢量形状与数据矩阵表格，用于测试 PPTX 幻灯片演播工作台与多页翻页；
  - 目录内附说明文档并同步更新 `examples/README.md` 索引全景表与推荐体验路径；
  - 新增 `scripts/generate-office-samples.mjs` 自动化构建生成脚本。

### Fixed

- **修正 .vscodeignore 避免源码根目录 index.html 误打入 VSIX 包 (Packaging Optimization)**:
  - 将 `.vscodeignore` 中的 `/index.html` 修正为 `index.html`，彻底解决 Windows/VSCE 规则匹配时根目录 Vite SPA 源码模板被打包进 VSIX 根目录的问题；
  - 保持 `!dist/index.html`，确保 Webview 编译产物正确且唯一地被打包发布。


### Added

- **新增 4 款主流现代互联网主题风格 (Modern Internet Aesthetic Themes)**:
  - **GitHub Dark (`github-dark`)**：开源开发者与极客社区标杆，深空冷灰黑底色 (`#0d1117`)、标准代码高亮与经典 GitHub 绿 (`#238636`) 强调色；
  - **Catppuccin Mocha (`catppuccin`)**：顶流当红极客视觉系，温润摩卡灰黑底色 (`#181825`) 与柔和薰衣草紫/马卡龙低反差长效护眼调色；
  - **Tokyo Night (`tokyo-night`)**：前沿云原生与 Web3 潮流，夜空深蓝底色 (`#1a1b26`) 与霓虹天青紫高光交织的未来科技感；
  - **Notion Minimal (`notion`)**：现代互联网知识库与极简协作空间美学，纯粹白调 (`#f7f6f3`)、石墨雅灰 (`#37352f`) 与无干扰专注排版；
  - 全套设计令牌与各格式驱动、代码块、数据表格、大纲侧栏与图表画布实现 100% 自适应融合。

## [1.2.24] - 2026-09-28

### Fixed

- **外部挂载文件提示徽标剪贴板脱敏隔离 (External Badge Clipboard Ignore)**:
  - 在 `ExternalBadgePill` 组件的外层 wrapper 与内层 pill 元素上注入 `data-clipboard-ignore="true"` 与 `ov-clipboard-ignore select-none`，配合全局 CSS `user-select: none !important;` 彻底杜绝选区将“📌 外部挂载文件: performance-radar-chart.svg”等提示徽标捕获进剪贴板；
  - `wordClipboardHelper.ts` 的 `isIgnoredClipboardElement` 与 `ignoreSelectors` 深度同步，在 Word 富文本复制与 `sanitizePlainTextClipboard` 纯文本清洗中物理剔除挂载提示。

## [1.2.23] - 2026-09-28

### Fixed

- **Markdown 表格底栏统计与就地编辑提示剪贴板隔离 (Table Footer Clipboard Ignore)**:
  - 修复表格底部统计栏（“总行数: X”、“双击单元格就地编辑”）缺少剪贴板隔离标识而在全选/划选时被带入剪贴板的问题；
  - 为 `TableBlock` 和 `TableLightboxModal` 底部统计栏增加 `data-clipboard-ignore="true"` 与 `ov-table-block-footer ov-clipboard-ignore select-none` 隔离类名；
  - 修复 `isFullContainerSelection` 全选判定缺陷，放宽带有 ignore 属性的工具栏文字容差至 85%，确保 Ctrl+A 全选时 100% 稳定输出干净的 Markdown 源码；
  - 增加 `sanitizePlainTextClipboard` 纯文本剪贴板脱敏清洗函数，自动剥除表格统计信息、求和均值与双击就地编辑等辅助文本。

## [1.2.20] - 2026-09-28

### Refactored

- **多格式驱动外层重复通用顶栏彻底剥离与系统能力融合 (Viewer Toolbar Deduplication & System Capability Integration)**:
  - **彻底移除外层通用动作条**：在 `PluginDocumentView` 中剥离 `NonMarkdownPluginView` 顶部冗余的通用顶栏，彻底消灭了与下层驱动专有 Header 冲突的“文件名”、“同步状态标签”及“在编辑器中打开”重复按钮，净增 36px+ 垂直可视阅读与绘图工作空间；
  - **驱动 SPI 契约升级与系统能力下沉融合**：在 `driverRegistry.ts` 的 `DriverProps` 中扩展新增 `onOpenSettings?: () => void;` 与 `onOpenShortcuts?: () => void;` 接口契约，并通过 `ViewerRenderer` 自动向下分发；
  - **各大驱动专有顶栏深度赋能**：在通用图表顶栏骨架 `DiagramStudioShell` 以及 PlantUML、Mindmap、StructuredDataViewer、CodeViewer 等各大驱动专有 Header 中无缝融合“工作台设置”与“快捷键指南”入口；
  - **未落盘修改优雅浮动提示**：在 VS Code Webview 模式中产生未保存变更时，采用右下角悬浮半透明玻璃质感徽标展示未保存标记与一键保存按钮，既不遮挡主图表视图，又保证状态实时可感知；
  - **专属守卫测试沉淀**：新增 `test-toolbar-dedup.mjs` 自动化回归测试套件并接入 `npm test`。

## [1.2.18] - 2026-09-28

### Refactored

- **巨型组件拆分与宿主模块化架构重构 (Modular Component Architecture & Design Tokenization)**:
  - 拆分 `PluginDocumentView` 与 `MarkdownViewer` 巨型文件为专注子组件与定制 Hook；
  - 统一 Markdown 渲染路由至驱动注册表，全量消除散落硬编码色值，实现 100% `--ov-*` 语义设计令牌化，像素级融合 VS Code 原生与第三方主题。

## [1.2.16] - 2026-09-28

### Improved

- **Markdown 渲染 SVG 矢量图响应式空间自适应 (Responsive SVG Layout Engine)**:
  - 自动推导并补全缺失的 `viewBox`，物理单位自动换算，内联 style 深度脱敏与防溢出自适应；
  - 修复 Markdown 渲染区划选复制误判为全选源码问题，划选时仅复制选中片段。

## [1.2.14] - 2026-09-28

### Added

- **Word (`.docx`) 离线文档导航大纲支持与目录节点过滤 (Word Offline Outline Navigation)**:
  - 增加 DOCX 离线文档导航大纲侧边栏，支持多级标题快速定位与平滑滚动；
  - 增加 Word 自动生成目录页 (TOC Block) 节点过滤，杜绝点击导航误跳转至文档开头目录；
  - 增加外部文件修改热重载与实时同步机制，外部保存文件时 Webview 自动热更新。

### Added

- **VS Code 深度原生生态集成 (VS Code Deep Extension Ecosystem Integration)**:
  - **活动栏资产全景树 (`Activity Bar` 视图容器 & `TreeView`)**：注册独立的 OmniView 资产中枢，按架构流程、矢量设计、学术出版、数据报表、思维导图 5 大业务领域对工作区资产进行全景扫描与聚合呈现，支持一键新建与直达工作台。
  - **光标 Hover 悬浮微型预览 (`HoverProvider`)**：在 Markdown、Typst、Mermaid、PlantUML 等源码中悬停时即时解析图表块、LaTeX 数学公式与 Obsidian Wiki 媒体嵌入引用。
  - **内联 CodeLens 快捷动作 (`CodeLensProvider`)**：在文档与图表块上方注入「实时分屏协同」与「图表快速渲染」动作。
  - **原生大纲与符号索引 (`DocumentSymbolProvider`)**：为 Markdown、Typst、PlantUML、Graphviz 等提供标准文档符号结构，无缝接入 VS Code `Ctrl+Shift+O` 快捷跳转。
  - **原生底部状态栏与快捷控制中心 (`StatusBarItem` & `QuickPick`)**：右下角常驻状态指示，单击唤起工作台多维控制中心。

### Improved

- **全文档格式全局 `Ctrl+F` / `Cmd+F` 检索与高亮联动闭环 (Universal Search Enhancement)**:
  - **Markdown 阅读视口全局快捷检索**：支持在阅读视口任意位置按 `Ctrl+F` 即时展开工具栏并聚焦搜索框，支持 `Enter/Shift+Enter` 上下项导航与 `Escape` 快速清空失焦。
  - **全驱动搜索交互对齐**：为 CSV、Excel (`.xlsx`)、Word (`.docx`) 等驱动全面对齐 `Ctrl+F` 全局按键捕获与高亮检索联动，CSV 源码模式下按 `Ctrl+F` 自动平滑切回网格模式。
  - **DOM 敏感子树保护**：严格保护 SVG 矢量画布、KaTeX 公式与离屏图表节点，杜绝检索高亮导致排版断裂。

## [1.2.10] - 2026-09-26

### Fixed

- **Markdown 大纲导航栏位置持久化修复 (Outline Position Persistence Fix)**:
  - 修复用户在 Markdown 文档中调整大纲导航栏位置（左侧/右侧/浮动）后，切换或打开新文件时设置被恢复为默认值的问题。
  - 根因：VS Code 宿主在每次打开文件时通过 `host-configuration` 握手推送全量配置（含默认值），`App.tsx` 中 `saveStoredSettings(hostSettings)` 无条件将 host 默认值覆盖了 localStorage 中用户刚显式保存的自定义值。
  - 修复方案：在 `host-configuration` 合并策略中，对 UI 布局偏好类配置（`outlinePosition`、`outlineWidth`、`outlineOpen`、`outlineDisplayMode`、`viewMode`、`contentWidth`、`fontSize`、`zoom`）引入「本地用户自定义优先」保护——若 localStorage 中已存在与默认值不同的用户自定义值，则保留本地值，不被 host 默认值覆盖。

## [1.2.9] - 2026-09-26

### Fixed

- **视图模式与工作台顶栏去重治理 (View Mode Duplication Fix)**:
  - **彻底清除外壳与驱动内部模式重复渲染**：分析并排查非 Markdown 格式（Compose、Dockerfile、K8s、HTML、SVG、Typst、Mermaid、PlantUML、Graphviz、白板等）在 VS Code 插件视图外壳 (`NonMarkdownPluginView`) 与独立工作台顶栏 (`WorkbenchHeader`) 中频繁重复出现两排「渲染视图/并排协同/源码编辑」切换条的架构根因。
  - **职责边界清晰划分**：所有具备自包含工作台（Studio Shell）的非 Markdown 驱动，三态模式切换与分屏参数完全由其内部自包含掌控；外壳只呈现文档元数据与宿主操作，`WorkbenchHeader` 模式组精准限定于 Markdown 文档，彻底杜绝按钮重复出现与内外层状态脱节。
  - **驱动生命周期隔离**：在 `ViewerRenderer` 中为目标驱动组件引入基于文件路径/标识的精准 `key`，杜绝切换文档时驱动内部模式与编辑态产生串扰残留。

## [1.2.8] - 2026-09-26

### Improved

- **现代图像工作台与二进制文件格式交互优化 (ImageViewer & Binary Enhancements)**:
  - **全主题自适应与语义设计令牌深度融合**：修复图像工作台底色未按全局主题生效的问题，新增 `system` 系统底色模式（默认启用并直接依托 `var(--ov-bg)`），支持系统/棋盘格/暗室/纯白四态切换；优化亮暗模式下高对比度自适应棋盘格，工具栏与弹窗全面接入 `--ov-*` 语义令牌，完美融入浅色、深色及宿主原生主题。
  - **精简交互链路（移除图片协同分屏与源码编辑）**：针对 PNG 等二进制图片文件（`png, jpg, jpeg, gif, webp, bmp, ico, avif, tiff`）建立能力约束（`supportsSplitView: false`, `supportsSourceEdit: false`），在插件视图外壳和工作台顶部自动隐藏无意义的“并排协同”与“源码编辑”按钮，模式安全收敛为纯预览视图，保持交互清爽专注。

## [1.2.7] - 2026-09-26

### Added

- **HTML5 网页与受控隔离沙箱工作台 (HTML5 Sandbox Studio)**:
  - **双层安全隔离沙箱 (Dual Sandbox Defense)**：内置受控 `iframe` 沙箱，严格剔除 `allow-same-origin` 与 `allow-top-navigation`，天然免疫 CSRF 与 Cookie/LocalStorage 侧信道泄漏；支持在纯净隔离环境下安全预览第三方网页与报表。
  - **动态脚本执行闸门 (Script Toggle)**：支持无脚本安全静态检视与交互式全功能模式随心一键切换。
  - **多端视口仿真 (Multi-Device Emulation)**：支持自适应流式视口 (100%)、平板端标准视口 (768px) 及移动端标准视口 (375px) 像素级拟真仿真。
  - **专业底色与无级缩放 (Canvas Backgrounds & Zoom)**：提供系统主题、纯白 (Light)、暗黑 (Dark) 及透明棋盘格 (Checkerboard) 四态画布底色；支持 50% ~ 200% 自由缩放与重置。
  - **三态工作台布局**：支持沉浸式纯预览 (Preview)、分屏对照实时联动 (Split) 及源码模式 (Code)。
  - **开箱即用骨架片段**：提供 HTML5 基础骨架、Tailwind 快速卡片、Canvas 动画演示等内置骨架片段，支持一键无损插入与清空。
  - **高保真独立打印**：支持视口内 HTML 单独触发打印排版与 PDF 导出。
- **扩展与路由生态全链路集成**:
  - 全局关联 `*.html` 与 `*.htm` 文件，无缝对接 VS Code 资源管理器与自定义编辑器。
  - 驱动注册表扩充至 22 类核心驱动，驱动元数据与多语言全量覆盖。

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
