# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> [!BANNER] OmniView 版本更新大厅 (Release Center)
> OmniView 致力于提供极速、安全、全主题像素级融合的多格式文档与图表渲染体验。
> 在 OmniView 中预览本文档时，您将体验到**现代交互式折叠手风琴、对比卡片与高光 Alert** 的富媒体排版。

---

## [1.4.14] - 2026-11-04 (当前最新发布)

> [!TIP] v1.4.14 核心升级亮点
> **Markdown 渲染视窗高频交互演进：任务清单原地平滑即时回写、图文双向聚焦高亮与 Tabbed 多标签容器全面兼容**：
> 1. **任务清单复选框原地即时勾选与平滑回写 (`markdownTaskToggle.ts` / `useMarkdownScrollSync.ts`)**：
>    - **瞬时乐观 DOM 更新**：点击复选框即刻切换完成态样式并触发微回弹动画 (`.ov-task-pop`)，彻底消除 AST 重新解析期间的等待感；
>    - **零视口抖动 (Zero CLS)**：源码局部行精准替换，自动保持滚动容器 `scrollTop`，勾选任务时页面毫无跳动；
>    - **划选防误触隔离**：分离复选框交互与文本选区，划选/复制任务项文本内容时绝不误触发勾选状态。
> 2. **图文双向聚焦高亮 (Diagram-to-Text & Text-to-Diagram Reactive Focus)**：
>    - **图 -> 文聚焦 (`diagramReactiveFocus.ts`)**：在 Mermaid 与 Graphviz DOT 画布中悬浮任意节点即显示联动入口与提示徽章，点击节点自动平滑滚动至正文对应标题/关键词，并触发双色脉冲光晕 (`.ov-diagram-reactive-highlight`)；
>    - **文 -> 图辉光**：支持反查图表节点并为 SVG 图元注入辉光特效 (`.ov-diagram-node-glow`)；
>    - **工具栏与状态反馈**：图表顶部提供「图文联动已就绪」指示，点击节点弹出无障碍吐司反馈。
> 3. **Tabbed 多标签页容器多语法无缝兼容 (`markdownTabsNormalizer.ts`)**：
>    - 确认并强化原生 `> [!TABS]` 语法，新增对 VitePress / Docusaurus 风格 `::: tabs` 及 MkDocs Material 风格 `=== "Tab"` 语法的自动规范化映射，实现开源技术文档零门槛无缝渲染。

---

## [1.4.13] - 2026-11-02

> [!TIP] v1.4.13 核心升级亮点
> **SVG Studio 矢量工作台右侧垂直工具条与单选互斥抽屉正式交付发版**：
> 1. **右侧类似左侧的垂直工具条与单选抽屉 (`SvgV2Studio.tsx`)**：
>    - 在工作台右侧新增对称设计的垂直工具条（`w-12`），竖向列出「图层面板」与「属性面板」按钮；
>    - 单选互斥抽屉机制：点击后每次仅显示一个抽屉（仅显示图层树或仅显示属性检视器），再次点击或点击收起按钮关闭抽屉；
>    - 默认状态下右侧抽屉面板收起，画布占满全部可用视口空间，杜绝小屏幕空间拥挤；
>    - 顶栏右侧提供「图层」、「属性」与面板展开/收起切换按钮，与右侧工具条双向实时联动高亮。
> 2. **图层与属性独立折叠支持 (`SvgV2LayersPanel.tsx` / `SvgV2Inspector.tsx`)**：
>    - **图层面板 (`SvgV2LayersPanel`)**：支持独立折叠与独立抽屉展示，符合无障碍 `aria-expanded` 规范；
>    - **属性检视器 (`SvgV2Inspector`)**：支持独立折叠，在空选（全局尺寸缩放）与选中图元状态下均优雅自适应；
>    - 完美保留 `data-inspector-panel="true"` 属性，彻底杜绝折叠/展开与面板内部滚动时的画布缩放穿透风险。
> 3. **发布与治理工程**：
>    - **发布日志轻量化收敛**：`CHANGELOG.md` 规范默认收敛并仅保留最近 10 个核心版本的详细履历，更早历史完整归档；
>    - **自动化测试回归**：全量 99/99 自动化测试套件 100% 通过；
>    - **插件正式打包**：成功构建并产出 `omniview-1.4.13.vsix` 扩展包并通过内容完整性校验。

---

## [1.4.12] - 2026-11-02

> [!TIP] v1.4.12 核心升级亮点
> **SVG Studio 矢量编辑器右侧面板整体收缩与图层/属性独立折叠交互演进**：
> 1. **右侧检视面板整体收缩与默认收缩 (`SvgV2Studio.tsx`)**：
>    - 默认进入 SVG 编辑工作台时右侧面板默认收缩，画布占满全部可用视口空间，杜绝小屏幕空间拥挤；
>    - 画布右上角提供半透明轻量级悬浮胶囊「展开面板」，一键即可呼出侧边检视面板；
>    - 顶栏右侧提供「图层」、「属性」与面板展开/收起切换按钮，实时联动高亮显示。
> 2. **图层与属性独立收缩与手风琴折叠 (`SvgV2LayersPanel.tsx` / `SvgV2Inspector.tsx`)**：
>    - **图层面板 (`SvgV2LayersPanel`)**：支持独立折叠，折叠时保留精简状态栏与数量徽标，点击或顶栏触发平滑收展，符合无障碍 `aria-expanded` 规范；
>    - **属性检视器 (`SvgV2Inspector`)**：支持独立折叠，在空选（全局尺寸缩放）与选中图元（外观/路径/样式）状态下均可独立折叠收起；
>    - 完美保留 `data-inspector-panel="true"` 属性，彻底杜绝折叠/展开与面板内部滚动时的画布缩放穿透风险。
> 3. **质量与工程门禁**：
>    - 新增专项测试套件 `test-svg-collapsible-panels.mjs`，验证默认折叠、独立展开、顶栏联动与防穿透属性；全量 99/99 自动化测试套件 100% 通过。

---

## [1.4.11] - 2026-11-02

> [!TIP] v1.4.11 核心升级亮点
> **全面落地下一代 Markdown 学术出版级排版、零 CLS 虚拟视口与文档健康体检 HUD (`RFC-0001` 阶段一)**：
> 1. **数学公式与图表自动连续编号与交叉引用 (`markdownCrossReferenceEngine.ts` / `MathBlock.tsx`)**：
>    - 自动提取公式 `\label{...}` 并生成全局连续编号（如 `(1)`, `(2)`），在公式右侧优雅徽标展示；
>    - 自动解析正文 `\eqref{...}` 与 `\ref{...}` 为交互式超链接，支持平滑滚动与目标辉光脉冲高亮 (`.ov-pulse-highlight`)；
> 2. **零 CLS 记忆渲染高度字典与类型启发式预估 (`blockHeightCache.ts` / `LazyViewportBlock.tsx`)**：
>    - 落地 `BlockHeightCache` LRU 容量淘汰高度缓存池，彻底根除离开视口卸载后反向滚动导致的页面高度坍缩与布局跳动 (CLS = 0)；
>    - 引入基于数学公式 (110px)、图表 (320px)、表格 (220px)、代码 (180px) 的启发式预估机制；
> 3. **端侧文档健康度与死链体检 HUD (`markdownHealthLinter.ts` / `MarkdownHealthHudModal.tsx`)**：
>    - 毫秒级端侧扫描本地相对图片丢失、WikiLink 破损、标题层级跳级 (H1 $\to$ H3) 与未引用孤立标签；
>    - 工具栏实时展示健康状态徽章与得分，支持点击呼出全景体检 HUD 模态浮窗并提供一键行跳转；
> 4. **全量自动化测试套件扩充**：新增 3 个专项自动化测试套件，全量 98/98 套件 100% 全部通过。

---

## [1.4.10] - 2026-11-02

> [!TIP] v1.4.10 核心升级亮点
> **完成下一代 Markdown 渲染架构演进方案论证与技术设计提案沉淀 (`RFC-0001` / `IDEA-0006`)**：
> 1. **沉淀 RFC-0001 架构方案**：系统规划数学公式与图表自动连续编号、交叉引用悬浮微预览、零 CLS 记忆高度双向虚拟视口、文档健康度体检 HUD 及 Web Worker 离屏解析；
> 2. **明确接口契约与优雅降级策略**：制定 `CrossReferenceRegistry` 与 `MarkdownAstExtension` 纯函数领域模型，确保在外部 CommonMark 与 GitHub 平台 100% 保持优雅降级；
> 3. **建立技术提案库索引**：新增 `docs/rfc/` 目录与全局技术演进看板。

---

## [1.4.9] - 2026-11-02

> [!TIP] v1.4.9 核心升级亮点
> **新增 Excel (.xlsx / .xls) 工作簿列宽鼠标自由拖拽调整、双击重置与列冻结自适应 (`UniverSheetViewer.tsx` / `xlsxToUniverAdapter.ts` / `xlsxEngine.ts`)**：
> 1. **支持列头右侧悬浮手柄自由拖动调整列宽**：在各列头注入 `.ov-col-resizer` 悬浮手柄，支持 60 FPS 顺滑拖拽调整（范围 48px ~ 800px），并支持双击手柄快速恢复默认列宽；
> 2. **列冻结 sticky 偏移量动态累加自适应**：升级 `calculateFrozenColumnLeftOffset` 算法，在存在可变自定义列宽时自动精确计算前置冻结列的宽度总和，杜绝列宽变更后的视觉遮挡或错位；
> 3. **工作簿状态不可变写回与持久化**：新增 `applyWorkbookColumnWidth` 事务函数，列宽调整在鼠标释放后自动随工作簿持久化保存；
> 4. **原生 OOXML `<cols>` 标签列宽解析**：在 `parseWorksheetXml` 中自动解析 Excel 文件原生的 `<col width="..."/>` 自定义列宽并转换为像素宽度展示。

---

## [1.4.8] - 2026-10-30

> [!TIP] v1.4.8 核心升级亮点
> **修复 Markdown AI 修改「全部确认」后再次打开仍重复显示改前与改后内容的持久化与基线判定缺陷 (`editorProvider.ts` / `MarkdownViewer.tsx` / `PluginDocumentView.tsx` / `ViewerRenderer.tsx` / `App.tsx`)**：
> 1. **根治无活跃 AI 会话时误将 Git HEAD / 旧缓存当作未决差异导致的反复渲染问题 (`editorProvider.ts`)**：
>    - 彻底移除 `resolveDocumentBaseline` 中对 `git show HEAD` 的无条件保底对比以及旧快照常驻逻辑；明确 AI 对比基线仅在宿主存在活跃影子模型（如 `chat-editing-snapshot-text-model:` / `cursor:` / `copilot:`）或存在未落盘内存拼接态时生效；
>    - 增加 `acceptedDiffPaths` 与 `sessionBaselineCache` 即时自愈机制，当 AI 会话关闭或用户点击「全部确认」后，基线安全置空 (`undefined`)，杜绝将常规未提交工作区改动误判为未决 AI 差异；
> 2. **打通 Webview 到宿主的 `accept-ai-diff` 即时持久化与全链路状态同步 (`editorProvider.ts` / `PluginDocumentView.tsx` / `MarkdownViewer.tsx`)**：
>    - 工具栏按钮语义与交互升级为 **「全部确认 (采纳改后)」**，无论差异来源于内存拼接还是影子快照均支持一键全量确认；
>    - 点击确认后立即提炼干净的「改后」正文，绕过防抖直接向 Host 派发 `accept-ai-diff` 协议消息，立即通过 `vscode.WorkspaceEdit` 回写文档并持久化落盘，同时清除基线状态并向 Webview 广播最新纯净正文；
>    - `App.tsx` 针对 `document-update` 补充 `baseContent` 与 `diskContent` 变更比对，确保已打开或重新打开文档时 100% 正确渲染确认后的纯净内容。

---

## [1.4.7] - 2026-10-29

> [!TIP] v1.4.7 核心升级亮点
> **新增 Antigravity / Cursor AI 无标记内联修改「改前 vs 改后」自动识别、视觉区分与一键视图切换 (`markdownDiffEngine.ts` / `editorProvider.ts` / `useMarkdownAstPipeline.ts` / `MarkdownViewer.tsx`)**：
> 1. **解析 Antigravity / Cursor 无 `<<<<<<<` 标记却同时出现「改前」与「改后」的底层机制并实现三路协同识别 (`editorProvider.ts` / `markdownDiffEngine.ts`)**：
>    - Antigravity 与 Cursor 在执行 AI 内联修改等待用户 Accept / Reject 时，不会写入 `<<<<<<<` 冲突标记字符，而是将「改前（待删除行）」与「改后（新插入行）」直接拼接在同一个内存 `vscode.TextDocument` (`openDoc.getText()`) 中，依靠 Monaco Line Decoration 在代码编辑器内染为红底/绿底；
>    - `editorProvider.ts` 新增 `resolveDocumentBaseline` 与双态采集：自动采集内存态 `content` (`openDoc.getText()`)、磁盘物理态 `diskContent` (`fs.readFile`)，以及宿主内存中的 AI 会话快照模型（如 `chat-editing-snapshot-text-model:` 等非 `file:` 影子文档）、`git show HEAD` 基线与会话初始快照 `baseContent`；
>    - 新增纯函数引擎 `markdownDiffEngine.ts`：联合比对 `content`、`diskContent` 与 `baseContent`（同时兼容 `<<<<<<< ... ======= ... >>>>>>>` 冲突标记与 `{--...--}` / `{++...++}` / `{~~...~>...~~}` CriticMarkup），精准识别出无标记拼接态中的「改前 (`[!AI_BEFORE]`)」与「改后 (`[!AI_AFTER]`)」段落，并通过 `lineMap` 保持 100% 原始行号对齐；
> 2. **Markdown 渲染「改前 / 改后」高辨识度语义卡片与三态视图切换栏 (`useMarkdownAstPipeline.ts` / `MarkdownViewer.tsx` / `src/index.css`)**：
>    - 渲染层基于 `--ov-*` 与 `--vscode-diffEditor-*` 语义令牌，将「改前」渲染为玫瑰红左边框 + 删除线徽标卡片（`.ov-ai-diff-before`），将「改后」渲染为翡翠绿左边框 + 新增徽标卡片（`.ov-ai-diff-after`）；
>    - 检测到 AI 修改时，顶部自动展示 `AI 修改对比` 控制栏，支持一键切换 **「区分改前/改后」**、**「仅看改后（自动剥离改前残留）」**、**「仅看改前」** 三种视图，并支持一键 **「采纳改后」** 清理文档中拼接的改前段落。

---

## [1.4.6] - 2026-10-29

> [!TIP] v1.4.6 核心升级亮点
> **新增 Vite 开发服务器跨 `?v=` 哈希 React 单例动态桥接中间件与挂载前缓存自愈 (`vite.config.ts` / `src/main.tsx` / `index.html`)**：
> 1. **注入跨 `?v=` 预构建哈希的 React 单例动态桥接中间件，彻底消除未刷新标签页下懒加载组件（如 `StructuredDataViewer` / `GraphvizStudioCanvas`）的 `Invalid hook call` 异常 (`vite.config.ts`)**：
>    - 当已打开的浏览器会话仍驻留旧版 `react-dom_client.js?v=<rootHash>`（如 `?v=45dd2f19`）而按需懒加载新模块请求当前 Vite 服务（如 `?v=133c5026`）时，中间件在不改动 `configHash` / `browserHash` 的前提下，自动在 `/src/*` 模块响应中注入基于 `performance.getEntriesByType('resource')` 的根部 React 单例对齐逻辑，动态复用当前已挂载的 `react.js?v=<rootHash>` 与 `react_jsx-dev-runtime.js?v=<rootHash>` 内存实例，确保 `useState` 等 Hook 100% 指向同一 `ReactSharedInternals` Dispatcher；
>    - 同时剥离开发态 `/src/*`、`/sw.js`、`/index.html` 请求的 `If-None-Match` 304 协商缓存头并对齐旧版 `.vite/deps` 请求哈希，防止浏览器 HTTP 缓存与 `omniview-v1` 返回陈旧模块；
> 2. **前置 `bootstrapOmniView` 缓存清理至 `createRoot` 挂载之前 (`src/main.tsx` / `index.html`)**：
>    - 在 `index.html` 首屏内联脚本与 `src/main.tsx` 挂载 `<App />` 之前立即清空 `omniview-v1` 等 `CacheStorage` 并注销旧版 Service Worker，确保懒加载驱动请求前旧缓存已 100% 销毁。

---

## [1.4.5] - 2026-10-29

> [!TIP] v1.4.5 核心升级亮点
> **根治 PWA Service Worker (`public/sw.js`) Cache-First 缓存锁死旧版 Vite 模块哈希导致的 `GraphvizStudioCanvas` React 双实例异常 (`public/sw.js` / `src/main.tsx` / `RenderErrorBoundary.tsx`)**：
> 1. **修复 `public/sw.js` 对同域 `/src/*` 与 `/node_modules/.vite/deps/*` 采用 Cache-First 拦截导致的跨版本哈希锁死问题**：
>    - 原 `omniview-v1` Service Worker 对所有同域 GET 请求采用 `cache-first` 策略，导致早期缓存的 `/src/main.tsx` (`?v=45dd2f19`) 与懒加载缓存的 `GraphvizStudioCanvas.tsx` (`?v=b125d612`) 永久驻留浏览器 `CacheStorage`，即使重启服务端或刷新页面也持续返回两份不同哈希的 React 实例；
>    - 升级 `public/sw.js` 至 `omniview-v2`：在 `install` 与 `activate` 阶段立即清空 `omniview-v1` 等遗留缓存并自动导航刷新受控客户端；对 `/src/*`、`/@*`、`/node_modules/*` 及带 `?v=`/`?t=` 的模块请求直接放行绝不缓存，对外壳资源改为 `Network-First` 策略；
> 2. **增强开发环境与 `RenderErrorBoundary` 的缓存自愈清理 (`src/main.tsx` / `RenderErrorBoundary.tsx`)**：
>    - 在开发模式下启动时自动清理残留 `CacheStorage` 与旧版 Service Worker 注册；当 `RenderErrorBoundary` 捕获到 React Dispatcher 空指针异常时，先彻底清除 `window.caches` 与 Service Worker 注册再执行刷新自愈。

---

## [1.4.4] - 2026-10-29

> [!TIP] v1.4.4 核心升级亮点
> **修复懒加载驱动引发的 Vite 依赖重优化 React 双实例冲突与 Hook 边界隔离 (`vite.config.ts` / `ViewerRenderer.tsx` / `CodeViewer.tsx`)**：
> 1. **消除 `GraphvizStudioCanvas` 等懒加载组件触发 Vite 运行时重优化导致的 React 双实例 `Invalid hook call` 异常 (`vite.config.ts`)**：
>    - 将 `@hpcc-js/wasm-graphviz`、`@myriaddreamin/typst.ts` 及全量 `prismjs/components/prism-*` 语言高亮子模块纳入 `optimizeDeps.include` 与 `entries: ['index.html', 'src/**/*.{ts,tsx}']` 启动预构建范围，并强化 `resolve.dedupe` 与 `resolve.alias` 锁定唯一 React / ReactDOM 单例，彻底杜绝运行期动态加载新依赖触发 `.vite/deps` 哈希漂移（`?v=` 不一致导致 `useState` 读取 `null` Dispatcher）；
>    - 加固 `ViewerRenderer` 与 `CodeViewer` 的 React Hook Fiber 边界 (`ViewerRenderer.tsx` / `CodeViewer.tsx`)：将 `ViewerRenderer` 中的 `plugin.renderMode` 从普通函数内联调用升级为独立 React 组件节点 `<PluginModeComponent />`，并将 `CodeViewer` 拆分为无状态路由分发器与 `PlainCodeViewer` 状态组件，确保跨格式切换时 100% 遵循 React Rules of Hooks。

---

> [!NOTE] 历史版本归档提示
> 为保障发布日志可读性与轻量化浏览体验，`CHANGELOG.md` 规范默认收敛并保留最近 10 个核心版本的详细履历。`v1.4.3` 及更早的历史版本发布说明已完整归档至 Git 提交历史与 [GitHub Releases](https://github.com/fsyyzz/OmniView/releases)。
