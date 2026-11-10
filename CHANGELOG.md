# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> [!BANNER] OmniView 版本更新大厅 (Release Center)
> OmniView 致力于提供极速、安全、全主题像素级融合的多格式文档与图表渲染体验。
> 在 OmniView 中预览本文档时，您将体验到**现代交互式折叠手风琴、对比卡片与高光 Alert** 的富媒体排版。

---

## [1.4.32] - 2026-11-10 (当前最新发布)

> [!TIP] v1.4.32 核心升级亮点
> **事件风暴 (Event Storming) 边界自适应与限界上下文 (Context Map) 零遮盖重构**：
> 1. **Event Storming 真实累加宽度与零截断**：
>    - 修复此前将 `readModels` 与 `hotspots` 取最大值导致多便利贴泳道溢出的数学缺陷，按每行实际节点、读模型与痛点全量累加像素宽度，右侧留有 80px+ 充裕呼吸留白，彻底消除 HOTSPOT 等便利贴超出右侧界限被截断的问题；
> 2. **Context Map 大半径宽敞排布与几何停靠**：
>    - 将画布尺寸扩展至 1520x960，环形布局半径扩展至 `radiusX = 540, radiusY = 320`，相邻上下文卡片净间距由局促的 26px 猛增至 190px+；
>    - 引入卡片外框边界相交算法 (`getCardBorderPoint`)，连线只在卡片外框边界连接，杜绝连线刺入卡片内部；
> 3. **图层分层解耦与关系铭牌 0 遮盖**：
>    - 重构 SVG 为三层渲染体系（底层连线 -> 中层卡片 -> 顶层关系契约铭牌），关系标签与防腐徽章永远浮于顶层；
>    - 胶囊铭牌宽度收敛至 140~176px，在 208px 间距中两端保留 16px+ 安全留白，彻底根治卡片覆盖遮挡文字问题；
> 4. **自动化测试扩充**：
>    - 单元测试增至 14 组，新增事件风暴右边界安全留白与上下文映射图卡片-标签 100% 零重叠几何断言。

---

## [1.4.31] - 2026-11-10

> [!TIP] v1.4.31 核心升级亮点
> **DDD 领域故事拓扑布局与活动连线防重叠深度重构**：
> 1. **业务中枢 Group 聚类分层布局**：
>    - 彻底修复 `groups` 业务中枢框窄长割裂与穿透交叉缺陷，内部 Group 角色在中轴居中纵向对齐，虚线框横向保证最小 280px 充裕呼吸空间；
>    - 外部角色精准分流：真实人员与上游客户（如买家）稳健排布在左侧输入端，下游外部依赖网关（如统一支付网关）排布在右侧支撑端，连线 0 交叉；
> 2. **反向边法向基准向量归一化**：
>    - 修复反向贝塞尔边法向量同向叠加抵消的数学 Bug，双向边以固定基准法向分别向相反两侧饱满隆起（间距 84px），消除双向边重叠；
> 3. **活动工作对象卡片碰撞检测与贝塞尔参数滑动避让**：
>    - 引入卡片包围盒 AABB 碰撞检测与 $t$ 参数沿曲线多候选点滑动（`[0.5, 0.35, 0.65, 0.28, 0.72...]`），全图杜绝任何活动标签重叠；
> 4. **自动化测试套件扩充**：
>    - 单元测试增至 13 组，覆盖 Groups 拓扑分层、双向弧线对称与活动标牌 0 重叠校验。

---

## [1.4.30] - 2026-11-10

> [!TIP] v1.4.30 核心升级亮点
> **全面清理冗余 `.dst` / `.egn` / `.domainstory` 文件、扩展名代码与全量文档同步**：
> 1. **彻底物理删除冗余历史样例**：
>    - 删除 `ecommerce-fulfillment.dst`、`ecommerce-fulfillment.egn` 与 `leave-approval.domainstory`，目录收敛为纯净 `.ddd` 矩阵；
> 2. **全链路代码收敛**：
>    - `package.json`（`editorAssociations`、`selector`、`when` 正则）、`types.ts`、`extension.ts`、`fileBridge.ts`、`WorkbenchHeader.tsx`、`driverRegistry.tsx`、`markdownWikiLinks.ts` 等全面清理已作废扩展名；
> 3. **全套中英文档与规范彻底同步**：
>    - 同步更新 `README.md`、`README.en.md`、`PROJECT.md`、`docs/`、`examples/README.md`、`prdDoc.ts` 及 `.codex` 写作技能规范。

---

## [1.4.29] - 2026-11-10

> [!TIP] v1.4.29 核心升级亮点
> **收敛与统一 DDD 领域建模后缀为 `.ddd`，领域故事整合为专属模式 (`mode: domain-story`)**：
> 1. **全生态后缀大一统 (`.ddd`)**：
>    - 收敛复杂的 `.dst` / `.egn` / `.domainstory` 多后缀生态，主推统一使用 `.ddd` 承载全套 DDD 业务与架构模型；
>    - 领域故事保留最简洁直观的纯文本 DSL 编写方式，通过 `mode: domain-story`（或无模式声明自动推断）作为统一模式整合进 `.ddd`；
> 2. **样例收敛与示范项目重构**：
>    - `examples/domainstory/` 增加 `ecommerce-fulfillment.ddd` 与 `leave-approval.ddd` 标准样例，全方位覆盖事件风暴、上下文映射、核心域矩阵、上下文画布与领域故事 5 大视图；
>    - 驱动模板库更新领域故事为标准 `mode: domain-story` 声明；
> 3. **向下兼容与自动化测试覆盖**：
>    - 引擎全面兼容老格式与纯文本 DSL，新增测试套件测试 12，12 组 DDD 单元测试全部通过。

---

## [1.4.28] - 2026-11-10

> [!TIP] v1.4.28 核心升级亮点
> **强化 Markdown 标准图片语法 `![alt](url)` 外部挂载领域故事与图表**：
> 1. **CommonMark 标准图片链接语法完全对齐**：
>    - 明确确立标准 Markdown 图片语法 `![说明文字](相对路径.ext)` 为外部图形/领域故事推荐挂载姿势；
>    - 原生自动拦截并转换 `![说明](./file.dst)`、`![说明](./file.ddd)`、`![说明](./file.domainstory)`、`![说明](./file.puml)` 为对应交互式视图组件；
> 2. **宿主双向桥接容错增强**：
>    - `fileBridge.ts` 补充对 `external="..."` 属性的资产扫描，确保无论是图片链接还是代码块外部属性均能 100% 自动装载。
> 3. **测试套件扩充**：
>    - 完善 `test-markdown-wiki-links.mjs` 测试 9，覆盖相对路径、子目录与多种扩展名挂载场景。

---

## [1.4.27] - 2026-11-10

> [!TIP] v1.4.27 核心升级亮点
> **领域故事讲授法与 DDD 视图全生态关联与 Markdown 嵌入能力**：
> 1. **VS Code 默认编辑器与快捷菜单全量关联**：
>    - 配置 `contributes.configurationDefaults.workbench.editorAssociations`，使 `*.dst`, `*.egn`, `*.domainstory`, `*.ddd` 默认在单击时直接由 OmniView 可视化编辑器唤出；
>    - `contributes.customEditors[0].selector` 与 10 处快捷键/右键菜单 when 正则补齐 `*.ddd` 格式支持；
>    - 宿主端 `SUPPORTED_EXTENSIONS`、`extsByCategory.arch`、`fileBridge` 自动补全容错及 Webview 文件选择器原生对齐该 4 大后缀。
> 2. **Markdown 渲染能力与双链挂载规范**：
>    - 完备支持 ````domainstory````, ````ddd````, ````event-storming````, ````context-map````, ````core-domain````, ````context-canvas```` 语言标识符内联解析；
>    - 支持 `external="..."` 属性外部挂载与 `![[ecommerce-fulfillment.dst]]` Obsidian 风格 WikiLink 双链无缝嵌入；
>    - 原生配备逐帧分步演播播放器 (Playback Stepper)、全屏矢量灯箱与 Polyglot SVG 导出。
> 3. **工程质量与自动化测试**：
>    - 路由测试套件 `test-driver-routing.mjs` 补充领域故事与 DDD 后缀的全量大/小写驱动路由断言；
>    - 修复 `test-check-vsix-contents.mjs` 打包结构假体桩文件，CI 门禁与全量测试 100% 通过。

---

## [1.4.26] - 2026-11-09

> [!TIP] v1.4.26 核心升级亮点
> **领域故事讲授法 (Domain Storytelling) 拓扑布局呼吸间距全面升级**：
> 1. **优化自动拓扑间距 (`computeAutoLayout`)**：
>    - 2-3 角色线性流间距自 370px 扩展至 500px，中位节点纵向交错落差由 68px 提升至 100px，消除工作对象与动词标牌重叠；
>    - 4 角色 2x2 矩阵网格水平间距由 440px 扩展至 560px，纵向间距由 250px 扩展至 370px，杜绝交叉连线拥挤；
>    - 5+ 角色环绕椭圆大半径扩展（长轴由 360px 提升至 480px+，短轴由 225px 提升至 340px+），中心与相邻节点净距保持在 350px-500px 以上。
> 2. **自环与多重边扇形曲线解离**：
>    - 自环曲线控制高度提升至 138px，工件铭牌上方安全空间充裕；
>    - 多重边弧度曲率提升至 52px，实现更清晰的扇面分离；
>    - 画布安全边界内衬由 95px 扩展至 110px，自环与标题无任何裁切风险。
> 3. **质量门禁与测试体系**：
>    - 单元测试套件补充相邻节点呼吸间距断言，11 组 DDD & Domain Story 单元测试全量通过。

---

## [1.4.25] - 2026-11-09

> [!TIP] v1.4.25 核心升级亮点
> **构建完备的 DDD 战略设计五大视图建模套件 (`Core Domain Chart` & `Bounded Context Canvas`)**：
> 1. **新增 DDD 核心域四象限战略投资矩阵 (`core-domain-chart` / ````core-domain`)**：
>    - 依托 **业务模型复杂度 (Complexity)** 与 **业务差异化优势 (Differentiation)** 4 象限战略投资分析体系（核心域自研攻坚、差异专属域敏捷孵化、支撑域外包/规则引擎、通用域 SaaS 采购）；
>    - 支持以 `-> 保持核心差异化壁垒` 或 `evolution: 85, 90` 语法绘制动态技术演进轨迹虚线箭头；
> 2. **新增 DDD 限界上下文战略画布 (`context-canvas` / ````context-canvas`)**：
>    - 采用现代 Bento Grid 三栏卡片架构，精细呈现 **输入通信 (Inbound: Commands / Events / Queries)**、**战略内核 (Strategic Heart: 统一语言 Ubiquitous Language & 业务决策/不变式规则)** 与 **输出通信 (Outbound: Domain Events & 下游依赖)**；
> 3. **全流程工具链与多视态生态联动**：
>    - `DomainStoryBlock` 与 `DomainStoryViewer` 零缝隙支持全部 5 类 DDD 视图；
>    - 扩展 `DiagramStepPlayer` 支持核心域战略子域与战略画布三栏架构步骤逐帧演播；
>    - 提供 `retail-core-domain.ddd` 与 `order-context-canvas.ddd` 工作区样本及 Markdown 深度演练文档；
>    - 单元测试套件全量扩充至 11 组并 100% 通过。

---

## [1.4.24] - 2026-11-09

> [!TIP] v1.4.24 核心升级亮点
> **全面优化 DDD 三视图（限界上下文映射、事件风暴、领域故事）矢量排版间距与呼吸感 (`dddModelingEngine.ts` / `domainStoryEngine.ts` / `DomainStoryBlock.tsx`)**：
> 1. **限界上下文映射 (`Context Map`) 双列交错布局与双层复合契约铭牌**：
>    - 将上下文卡片水平中心间距从 `340px` 拓宽至 `580px`（纵向间距拓宽至 `295px`，卡片拓宽至 `296×162px`），右列轻微纵向错位 `28px` 使连线自然舒展；
>    - 将原先散落在连线两端的 `[U: OHS, PL]` 与 `🛡️ [D: ACL]` 角色胶囊聚合进连线中点的**双层战略契约铭牌**（上层展示上下游角色与防腐层标识，下层展示契约编号与说明），彻底杜绝与限界上下文边框重叠。
> 2. **事件风暴 (`Event Storming`) 主副双轨分离排版**：
>    - 将便利贴尺寸升级为 `168×98px`（支持双行自动折行），水平间距拉大至 `74px`，泳道行距拉宽至 `26px`；
>    - 将 `ReadModel`（绿色读视图）与 `Hotspot`（品红色痛点便签）独立下挂在泳道下方的专属子轨道并以虚线引线连接，避免横向挤压主因果链。
> 3. **领域故事 (`Domain Story`) 贝塞尔真实中点与多边扇形分离**：
>    - 修正活动铭牌坐标至二次贝塞尔曲线 $t=0.5$ 真实中点，新增同对节点多条活动连线的扇形曲率递增分离，并为 `<svg>` 注入显式像素宽高与 `w-full` 画布容器，消除 Flexbox 下缩略挤压。

---

## [1.4.23] - 2026-11-09

> [!TIP] v1.4.23 核心升级亮点
> **补齐工作区与示例库中的 DDD 事件风暴与限界上下文映射全量演示样本 (`examples/domainstory/` / `examples/markdown/` / `examplesLoader.ts`)**：
> 1. **新增独立 `.ddd` 工作区工程样本**：
>    - `examples/domainstory/order-event-storming.ddd`：电商大促下单与履约事件风暴便利贴时间轴完整示例；
>    - `examples/domainstory/retail-context-map.ddd`：智慧零售 6 大限界上下文（核心域/支撑域/通用域）与 5 条上下游 `ACL` / `OHS, PL` 映射契约示例，已注册至 `examplesLoader.ts` 随工作区默认加载。
> 2. **升级 Markdown 综合示例文档**：
>    - `examples/markdown/domain-storytelling.md`：同步收录「领域故事 (`domainstory`)」「事件风暴 (`event-storming`)」与「限界上下文映射 (`context-map`)」三大内联渲染板块；
>    - `examples/markdown/external-diagram-attachments.md`：新增 `![[../domainstory/order-event-storming.ddd]]` 与 `![[../domainstory/retail-context-map.ddd]]` 外挂 `.ddd` 工程文件直接内联渲染演示。

---

## [1.4.22] - 2026-11-09

> [!TIP] v1.4.22 核心升级亮点
> **在领域故事图底座上构建 DDD 探索与战略协同描述语言及矢量图形化渲染引擎 (`dddModelingEngine.ts` / `domainStoryEngine.ts` / `DomainStoryViewer.tsx` / `DomainStoryBlock.tsx`)**：
> 1. **DDD 事件风暴时间轴便利贴视图 (`mode: event-storming` / ````event-storming`)**：
>    - 支持直观的因果流语法 `1. 买家 [actor] -> 提交结算单 [cmd] -> @订单聚合 [agg] -> 订单已创建 [evt]` 及 `read:` / `hotspot:` 附属行，同时支持 `@聚合`、`!事件`、`?策略`、`$外部系统` 前缀简写与智能语义推断；
>    - 遵循 Alberto Brandolini 标准色板渲染折角便利贴矩阵（蓝色 `Command`、黄色 `Aggregate`、橙色 `Domain Event`、紫色 `Policy`、粉色 `External System`、绿色 `Read Model` 与品红色微倾 `Hotspot` 痛点便签），并无缝对接 `DiagramStepPlayer` 逐帧高亮回放事件因果链。
> 2. **DDD 战略设计：限界上下文映射图 (`mode: context-map` / ````context-map`)**：
>    - 支持声明核心域 (`[core]`)、支撑域 (`[supporting]`)、通用域 (`[generic]`) 及其负责团队 (`team:`)、职责说明 (`desc:`) 与内部核心聚合标签 (`aggregates:`)；
>    - 支持上下游协作契约语法 `A [U: OHS, PL] -> B [D: ACL] : 契约说明`（实线同步调用 `->`、虚线异步领域事件 `->>`、双向合作 `<->`），自动绘制上下游 `[U]` / `🛡️ [D: ACL]` 防腐层胶囊徽章与战略图例栏。
> 3. **全链路集成与一键模板库**：新增 `.ddd` 扩展名与 ````ddd` / ````event-storming` / ````context-map` Markdown 代码块支持，并在 DDD 工作室内置「领域故事 DSL」「事件风暴」「上下文映射」一键插入模板。

---

## [1.4.21] - 2026-11-08

> [!TIP] v1.4.21 核心升级亮点
> **修复 Markdown 渲染中 Markmap 思维导图（代码块及外挂 `.markmap` / `.mm` / `.mindmap` / `.km` 文件）双击无法打开独立全屏灯箱问题 (`MarkmapViewer.tsx` / `MarkmapBlock.tsx` / `LightboxModal.tsx` / `markdownWikiLinks.ts`)**：
> 1. **解除 `d3-zoom` 对双击事件的内部劫持 (`MarkmapViewer.tsx`)**：在 Markdown 嵌入模式（`embedded`）或传入 `onDoubleClick` 时，主动注销 `markmap-view` 底层 `d3-zoom` 默认绑定的 `svg.on('dblclick.zoom', null)`（该监听器原先会在原地缩放 280px 小卡片并调用 `stopImmediatePropagation()` 吞掉双击事件），同時保留点击节点小圆点（`<circle>`）展开/折叠子树能力；
> 2. **独立灯箱全图视口归一化序列化 (`MarkmapBlock.tsx` · `serializeMarkmapSvgForLightbox`)**：双击或点击工具栏放大按钮进入 `LightboxModal` 时，自动遍历全部 `g.markmap-node` 坐标与 `foreignObject` 尺寸计算完整思维导图包围盒，剥离 280px 内联卡片的局域 `transform` 并注入标准 `viewBox`、`width` 与 `height`，确保独立灯箱 100% 居中完整展示整张导图并支持平滑缩放/拖拽/导出；
> 3. **外挂思维导图文件全格式嵌入与精确文件名解析 (`markdownWikiLinks.ts` / `useMarkdownAstPipeline.ts`)**：`resolveWikiTarget` 优先精确匹配完整文件名（防止 `xxx.markmap` 被同名 `xxx.md` 遮蔽），并补齐 `.mm` (FreeMind XML) 与 `.km` (KityMinder JSON) 在 Markdown 内嵌渲染中的自动归一化转换。

---

## [1.4.20] - 2026-11-08

> [!TIP] v1.4.20 核心升级亮点
> **修复 SVG Studio 右侧图层与属性抽屉面板高度未铺满问题 (`SvgV2LayersPanel.tsx` / `SvgV2Inspector.tsx` / `SvgV2Studio.tsx`)**：
> 1. **移除图层列表遗留的 `max-h-48` (192px) 高度限制 (`SvgV2LayersPanel.tsx`)**：改为 `flex h-full min-h-0 flex-col` + `flex-1 min-h-0 overflow-y-auto`，使图层树完整铺满右侧抽屉纵向空间；
> 2. **移除属性检视器遗留的 `max-h-[calc(100vh-280px)]` 限制 (`SvgV2Inspector.tsx`)**：与右侧单选抽屉容器 `flex-1 min-h-0` 对齐，实现 100% 纵向自适应铺满。

---

## [1.4.19] - 2026-11-08

> [!TIP] v1.4.19 核心升级亮点
> **精简 SVG Studio 顶部与右侧面板重复按钮 (`SvgV2Studio.tsx`)**：
> 1. **移除顶部操作栏重复的「图层」「属性」与「侧边栏收起/展开」按钮**：统一收敛至右侧垂直工具条（`svg-v2-right-rail`），避免顶栏与右侧栏入口重复；
> 2. **移除右侧垂直工具条底部冗余的「收起面板」按钮**：再次点击当前激活的「图层面板」或「属性面板」图标（或点击抽屉标题栏关闭按钮）即可收起面板，界面更加清爽紧凑。

---

## [1.4.18] - 2026-11-08

> [!TIP] v1.4.18 核心升级亮点
> **全量落地 SVG Studio v2 P0–P2 专业级矢量编辑扩展 (`SVG-01` ~ `SVG-08`)**：
> 1. **P0 — 高频直觉交互闭环 (`SVG-01` ~ `SVG-03`)**：
>    - **画布内双击原地文本编辑 (`SVG-01` · `SvgV2InlineTextEditor.tsx`)**：双击画布任意 `Text` 图元即在原位置弹出半透明富文本编辑浮层，支持字号/加粗/对齐即时调整与多行文本输入（自动拆分为 `<tspan dy="1.2em">` 多行结构），`Enter` / `Ctrl+Enter` 提交、`Esc` 取消；
>    - **画布中心智能参考线与 16px 网格磁吸 (`SVG-02` · `tools.ts` / `SvgV2Canvas.tsx`)**：拖拽/缩放图元时自动吸附画布水平/垂直正中心与兄弟图元边缘/中心，并在底部视口 HUD 新增「网格」背景显示与「磁吸」对齐开关；
>    - **包围盒四角外圈旋转热区、实时角度/尺寸 HUD 气泡与快捷翻转/旋转 (`SVG-03`)**：选中图元后光标移至四角控制点外圈即可直接旋转（无需寻找顶部旋转杆），拖拽期间顶部实时显示旋转角度 (`45.0°`) 与缩放尺寸 (`W × H px`) 气泡，并在顶部栏、悬浮 HUD 与右键菜单提供水平翻转、垂直翻转与顺时针旋转 90° 快捷操作。
> 2. **P1 — 视觉表现力与质感升级 (`SVG-04` ~ `SVG-06`)**：
>    - **可视化线性/径向渐变编辑器 (`SVG-04` · `gradientsAndEffects.ts` / `SvgV2AppearanceExtras.tsx`)**：支持线性渐变与径向渐变一键切换、0°–360° 角度滑块调节、多色标增删改以及 6 款精选渐变色卡预设，自动维护 `<defs>` 内渐变定义；
>    - **一键阴影与高斯模糊滤镜预设 (`SVG-05` · `<filter>` Presets)**：内置「无滤镜 / 柔和阴影 / 深邃投影 / 霓虹发光 / 高斯模糊」5 档预设，支持实时微调 `dx`、`dy`、模糊半径 `stdDeviation`、阴影颜色与浓度；
>    - **屏幕吸管取色器与文档已用色板自动聚合 (`SVG-06`)**：集成原生 `EyeDropper API` 屏幕像素取色，并自动扫描聚拢当前 SVG 文档全部已用纯色生成一键点选色板。
> 3. **P2 — 复合造型与架构图连接器 (`SVG-07` ~ `SVG-08`)**：
>    - **路径布尔运算 (`SVG-07` · `booleanOps.ts`)**：选中 2 个及以上路径图元时，支持一键执行**联集 (`Union`)、差集 (`Subtract`)、交集 (`Intersect`)、异或 (`Exclude`)** 复合路径造型；
>    - **图元连接线磁吸锚点与动态跟随 (`SVG-08`)**：使用直线/箭头/曲线工具靠近图形四周与中心时自动浮现青色磁吸端口环，连接后持久化绑定端口关系（`data-omniview-conn-start` / `data-omniview-conn-end`），后续移动、缩放、旋转、对齐或分布图形时，所有关联连接线端点实时自动跟随重算。

---

## [1.4.17] - 2026-11-08

> [!TIP] v1.4.17 核心升级亮点
> **全量落地 Code Review 专项修复：查看器高频交互状态同步加固、VS Code Webview 沙箱弹窗/打印解耦与 SVG 核心模块拆分 (`CR-01` ~ `CR-05`)**：
> 1. **查看器光标锚点缩放与画布交互状态一致性加固 (`ImageViewer` / `MermaidStudioCanvas` / `GraphvizStudioCanvas` / `PlantUmlViewer`)**：
>    - **CR-01 (`ImageViewer.tsx`)**：切换图片资源时显式清空 `canvasHelperRef.current = null` 离屏取色缓存；`handleResetTransform` 同步复位 `zoomRef.current = 1.0` 与 `panRef.current = { x: 0, y: 0 }`；补充窗口级 `mouseup` 兜底监听与组件卸载 `wheelTimeoutRef` 定时器清理；
>    - **CR-02 (`MermaidStudioCanvas.tsx`)**：修复 `handleFitToViewport` 误读旧 `zoom` 闭包导致的自适应比例偏差，统一改为读取 `zoomRef.current || 1`，并在卸载时清理 `wheelTimeoutRef`；
>    - **CR-03 (`MermaidStudioCanvas.tsx`)**：在 `ResizeObserver` 容器尺寸收敛回调中同步更新 `panRef.current = clampedPan`，消除窗口分屏调整后滚轮缩放的跳变；
>    - **CR-04 (`GraphvizStudioCanvas.tsx`)**：`handleFitToViewport` 改为读取实时 `zoomRef.current || 1` 并移除冗余 `zoom` 依赖，避免每次滚轮缩放重建回调；
>    - **CR-05 (`PlantUmlViewer.tsx`)**：补充窗口级 `mouseup` 拖拽释放监听，并将外部打开操作切换为 `<a target="_blank" rel="noreferrer">` 安全触发。
> 2. **VS Code Webview 与受限 iFrame 沙箱环境零阻断治理 (`vscode.ts` / `printBridge.ts` / 4 个 UI 组件)**：
>    - 新增 `safeConfirm` 沙箱容错确认工具 (`src/shared/lib/vscode.ts`)，全面替换 `SvgV2Inspector`、`MindmapViewer`、`LogViewerModal`、`WorkbenchSettingsModal` 中的原生 `window.confirm`；
>    - 重构 `printBridge.ts` 为隐藏离屏 `<iframe>` 打印桥接，彻底移除被沙箱拦截的 `window.open` 调用。
> 3. **SVG 核心工具大文件解耦 (`svgUtils.ts` -> `svgPathAndBatchCore.ts`)**：
>    - 将 Path 节点解析/序列化与批量几何运算核心函数抽离至独立零依赖模块 `svgPathAndBatchCore.ts`，将 `svgUtils.ts` 缩减至 2,900 行以内并保持对外导出 100% 向后兼容。

---

## [1.4.16] - 2026-11-07

> [!TIP] v1.4.16 核心升级亮点
> **修复 VSIX 打包结构门禁对 `@vscode/vsce` 规范化文件名的兼容校验并深度瘦身 `docs/**` 冗余子目录 (`.vscodeignore` / `check-vsix-contents.mjs`)**：
> 1. **兼容 `@vscode/vsce` 归档文件名自动规范化机制 (`scripts/check-vsix-contents.mjs`)**：
>    - `@vscode/vsce package` 在生成 `.vsix` 压缩包时会自动将根目录 `README.md`、`CHANGELOG.md` 与 `LICENSE` 重命名为 `extension/readme.md`、`extension/changelog.md` 与 `extension/LICENSE.txt`；
>    - 升级 `check-vsix-contents.mjs` 为大小写不敏感与多候选名匹配（`extension/readme.md`、`extension/changelog.md`、`extension/license(.txt/.md)`），消除 CI 打包门禁误报缺失问题。
> 2. **递归剔除 `docs/**` 内部设计/架构子目录，VSIX 包体积再减 ~3.3 MB (`.vscodeignore`)**：
>    - 将 `.vscodeignore` 中的 `docs/*` 升级为 `docs/**` 配合 `!docs/assets/omniview-showcase.png`，彻底排除 `docs/archify/`（3.11 MB）、`docs/adr/`、`docs/design/`、`docs/ideation/` 等非运行时文档子目录，同时排除 `README.en.md`、`CONTRIBUTING.md` 与 `SECURITY.md`。

---

## [1.4.15] - 2026-11-07

> [!TIP] v1.4.15 核心升级亮点
> **全品类图片/图表光标锚点无级缩放统一、VS Code 插件市场自动化打包发布流水线与 Vite 预构建边界加固**：
> 1. **全品类图片与图表光标锚点无级缩放统一 (`focalZoom.ts` / `LightboxModal.tsx` / 独立查看器)**：
>    - **Markdown 全屏灯箱 (`LightboxModal.tsx` / `EChartsBlock.tsx` / `PlantUmlBlock.tsx` / `MarkdownViewer.tsx`)**：修复 ECharts 打开全屏灯箱时优先传入序列化矢量 `svgContent` 的渲染链路，支持多图画廊 (`item.items` / `initialIndex`) 缩略图自导航与基于光标焦点 (`calculateFocalZoom`) 的无级缩放；
>    - **独立查看器全面对齐 (`ImageViewer` / `MermaidStudioCanvas` / `GraphvizStudioCanvas` / `PlantUmlViewer` / `DomainStoryViewer` / `ExcalidrawViewer` / `SvgV2Studio`)**：所有图片与图表单独打开后，滚轮缩放、双击放大与工具栏缩放按钮均以当前鼠标光标所在位置为锚点 (`calculateFocalZoom` + `calculateWheelFactor`) 进行平滑无漂移缩放，并将全屏预览统一收敛至交互式 `LightboxModal`。
> 2. **VS Code 插件打包瘦身与开源市场自动发布流水线 (`.vscodeignore` / `release.yml` / `sync-to-oss.yml` / `check-vsix-contents.mjs`)**：
>    - **VSIX 制品净化与市场主页保障**：移除 `.vscodeignore` 中对 `README.md` 的误屏蔽并保留 `./docs/assets/omniview-showcase.png` 封面图，同时过滤未编译的 `examples/`、`rust/` 与 `docker/` 冗余目录；
>    - **开源双仓自动发布 (`release.yml` / `sync-to-oss.yml`)**：支持主仓 `fsyyzz/OmniView` 与开源镜像仓 `fsyyzz/OmniView-Open` 自动打包 `.vsix` 并发布至 VS Code Marketplace (`VSCE_PAT`) 与 Open VSX Registry (`OVSX_PAT`)，同步净化开源仓 `package.json` 的 `repository` / `bugs` / `homepage` 市场外链。
> 3. **Vite 依赖预构建边界加固 (`vite.config.ts`)**：
>    - 在 `optimizeDeps.entries` 中通过 `'!src/extension/**'` 排除 VS Code 扩展宿主 Node 端目录，并将 `['vscode']` 加入 `optimizeDeps.exclude`，根除启动预扫描对 `vscode` 宿主虚拟模块的误解析报错。

---

## [1.4.14] - 2026-11-04

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

> [!NOTE] 历史版本归档提示
> 为保障发布日志可读性与轻量化浏览体验，`CHANGELOG.md` 规范默认收敛并保留最近 10 个核心版本的详细履历。`v1.4.6` 及更早的历史版本发布说明已完整归档至 Git 提交历史与 [GitHub Releases](https://github.com/fsyyzz/OmniView/releases)。
