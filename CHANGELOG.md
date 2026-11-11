# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> [!BANNER] OmniView 版本更新大厅 (Release Center)
> OmniView 致力于提供极速、安全、全主题像素级融合的多格式文档与图表渲染体验。
> 在 OmniView 中预览本文档时，您将体验到**现代交互式折叠手风琴、对比卡片与高光 Alert** 的富媒体排版。

---

## [1.4.44] - 2026-11-11 (当前最新发布)

> [!TIP] v1.4.44 核心升级亮点
> **全面结合项目演进重构升级 Markdown 现代创作技能库 (`skills:omniview-markdown-authoring`) 与插件构建全量同步**：
> 1. **全景技能规约与决策树深度重构 (`.codex/skills/omniview-markdown-authoring/SKILL.md`)**：
>    - 全面纳入 DDD 五大视图套件（`domainstory`、`event-storming`、`context-map`、`core-domain`、`context-canvas`），规范横向阶段流矩阵排布与 Alberto Brandolini 标准色板；
>    - 整合 PlantUML 企业级时序/用例/脑图规范，明确 14 大主题高保真调色盘联动与原生 `<style>` 自动注入机制；
>    - 整合 Graphviz 7 大布局引擎与原生矢量固化器 `solidifyGraphvizSvg`；
>    - 整合 Typst 科学排版引擎与 Excalidraw 交互白板支持，确立图片管道修饰符（如 `![说明|680](./pic.png)`）规范；
> 2. **参考规范与反模式防线扩充 (`references/`)**：
>    - 升级至十五大易错反模式指南，严厉排查单列接龙、暴力反转滤镜、无主色调漂移等典型缺陷；
>    - 扩充领域建模与附件嵌入全景案例集 (`examples/domain-modeling-and-attachments.md`)；
> 3. **全局用户配置无缝同步**：
>    - 同步更新至宿主环境全局技能库，保障跨会话与独立工程规范一致性；
> 4. **生产构建产物全量同步 (`npm run build:plugin`)**：
>    - 重新编译 Webview 与 VS Code 扩展产物，确保生产构建完整包含多 Group 阶段流排布与 0 遮盖碰撞防御；
>    - 全量 101/101 项单元测试、TypeScript 类型检查与 4 大物理门禁 100% 绿灯通过。

---

## [1.4.43] - 2026-11-11

> [!TIP] v1.4.43 核心升级亮点
> **彻底重构领域故事图 (Domain Storytelling) 布局与渲染引擎，实现多 Group 阶段流分列与 0 遮盖碰撞防御**：
> 1. **多 Group 拓扑分阶段流矩阵排布 (`src/features/viewers/lib/domainStoryEngine.ts`)**：
>    - 彻底根治多个业务分组（如「产研敏捷协作圈」与「云原生基础设施」）被硬排在单一直线导致的窄长接龙与连线重合，实现依据 Group 独立分配 X 轴列的阶段流（Pipeline/Stage Flow）布局；
>    - 单 Group 场景严格保持经典中枢排布（100% 保持既有单测与习惯兼容）；
> 2. **SVG 严格分层渲染架构 (Strict Layering)**：
>    - 将渲染次序重构为：`Layer 1: Groups 边界虚线框` -> `Layer 2: 活动连线条` -> `Layer 3: Actors 角色卡片` -> `Layer 4: 活动标牌 (Activity Labels & Badges)`；
>    - 活动标牌永远浮在最顶层，彻底杜绝 Actor 卡片吞噬遮挡标牌半截的视觉缺陷；
> 3. **自环 (Self-loop) 动态自适应四周障碍朝向**：
>    - 自环不再死板硬编码在正上方；若检测到上方存在邻近 Actor 节点，自动优雅转向左侧或右侧饱满回环，彻底根治与上方节点及连线标牌的重叠压顶；
> 4. **跨节点连线智能避障绕行 (Obstacle Avoidance Routing)**：
>    - 自动检测连线两端点之间是否存在中间阻挡节点；若存在阻挡，绝不走穿心直线，强制赋予大弧度贝塞尔曲线绕行，并将标牌置于外侧；
> 5. **全局 Actor 防碰撞与测试防护 (`tests/test-domainstory-engine.mjs`)**：
>    - 标牌碰撞检测全面引入全图所有 Actor 节点包围盒保护，并在测试套件中增补「测试 16: 多 Group 研发交付流水线分列阶段流与 7 大活动标牌 0 遮盖断言」；
>    - 全量 101/101 套单元测试、TypeScript 类型检查与 4 大物理门禁 100% 绿灯全通过。

---

## [1.4.42] - 2026-11-10

> [!TIP] v1.4.42 核心升级亮点
> **VS Code Marketplace 自动化发布流水线门禁与安全策略加固**：
> 1. **Release 工作流门禁精准收敛 (`.github/workflows/release.yml`)**：
>    - 明确 `publish-marketplace` 仅允许在公开开源镜像仓库（`fsyyzz/OmniView-Open`，兼容大小写）执行，私有主仓库永远跳过插件市场发布步骤，杜绝私有环境凭据冲突与重复发布；
> 2. **CI 门禁与生命周期测试套件加固 (`tests/test-github-workflow-cleanup.mjs`)**：
>    - 增补硬性防护断言，严格校验私有主仓 `fsyyzz/OmniView` 绝不包含在 Marketplace 发布的触发条件中；
> 3. **全流程自动化验证**：
>    - 全量 101/101 项单元测试、TypeScript 类型检查、物理门禁与文档一致性检查 100% 通过。

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

## [1.4.38] - 2026-11-10

> [!TIP] v1.4.38 核心升级亮点
> **新增 PlantUML 架构与工程图表全景展馆示例文档并完善导航链路**：
> 1. **全景工程图表展馆 (`examples/markdown/plantuml-diagrams.md`)**：
>    - 全面覆盖工业级 PlantUML 核心图表类型，包括微服务鉴权时序图 (`activate`/`deactivate`/`alt`)、分层解耦组件架构图、订单履约复合状态机 (`state`)、领域模型高内聚类图 (`class`)、用户认证与权限用例图 (`usecase`)、DevOps 持续交付泳道活动图 (`fork`/`join`) 以及思维脑图 (`mindmap`)；
>    - 提供外部 `.puml` 架构文件挂载（`external="../plantuml/cloud-topology.puml"`）的标准规范与热重载演示；
> 2. **设计规范与排版标杆**：
>    - 遵循 `skills:omniview-markdown-authoring` 现代排版规范，集成 `[!BANNER]`、`[!TABS]`、`[!COMPARE]`、`[!NOTE]`、`[!TIP]` 与 `[!IMPORTANT]` 等语义化卡片，严格自适应多主题与原生设计令牌；
> 3. **导航与索引打通**：
>    - 更新 `examples/markdown/README.md` 与 `examples/markdown/diagrams.md`，打通基础图表示例与专属全景展馆的引导闭环；
> 4. **质量门禁与全量测试**：
>    - 101/101 套自动化测试与一致性物理门禁 100% 绿灯通过。

---

## [1.4.37] - 2026-11-10

> [!TIP] v1.4.37 核心升级亮点
> **光标悬浮胶囊全面扩充 OmniView 专属非标准 Markdown 渲染特性库**：
> 1. **DDD 领域驱动设计专属模型一键直达**：
>    - 深度集成业务领域故事（`domainstory`）、事件风暴泳道因果链（`eventstorming`）、战略限界上下文映射图（`contextmap`）；
>    - 支持外部 `.ddd` 独立模型图片式挂载语法（`![领域故事](./model.ddd)`）；
> 2. **现代专业数据可视化与思维导图**：
>    - 集成 ECharts 交互式柱状/折线/饼图（`echarts` 代码块）、Markmap 交互思维导图（`markmap` 代码块）、Graphviz DOT 拓扑关系图（`dot` 代码块）；
>    - 涵盖 PlantUML 架构组件图、Mermaid 流程/时序图、SVG 高保真矢量画布与 KaTeX 独立数学公式；
> 3. **OmniView 高阶交互卡片扩展组件 (Authoring 标准)**：
>    - 支持 `[!TABS]` 多标签、`[!STEPS]` 步骤指引、`[!COMPARE]` 方案对比、`[!TIMELINE]` 时间线、`[!METRICS]` 核心指标网格、`[!FAQ]` 交互折叠问答、`[!QUOTE]` 名人引文、`[!BANNER]` 顶部公告、`[!CARDS:3]` 响应式卡片网格与可折叠手风琴（`[!NOTE]-`）；
> 4. **胶囊栏高频专属直达快捷操作**：
>    - 悬浮胶囊上提供 DDD 领域模型、ECharts 图表、Markmap 导图、Tabs 交互卡片、Alert 提示与数据表格的专属一键按钮；
>    - 弹出面板升级为 6 大维度标签切换（全部 / DDD模型 / 图表导图 / 交互卡片 / 警示框 / 基础排版），支持关键字即时模糊检索；
> 5. **自动化测试与门禁验证**：
>    - `tests/test-markdown-quick-inserter.mjs` 全面扩充对非标准 Markdown 代码块与扩展组件的断言；
>    - 全量 101 套测试套件 100% 绿灯全部通过。

---

## [1.4.36] - 2026-11-10

> [!TIP] v1.4.36 核心升级亮点
> **Markdown 源码编辑光标像素级精确坐标定位与智能跟随**：
> 1. **镜像 DOM 像素级光标定位核心 (`getCaretCoordinates`)**：
>    - 彻底重构以往固定在最右侧（`right-5`）或基于物理 `\n` 行高估算导致的坐标脱节问题；
>    - 引入基于镜像 DOM (Mirror Div) 的工业级 Caret 坐标计算器，完整复制文本框盒模型、字体族、行高与自动折行属性，计算出光标字符在屏幕上的真实 `(caretLeft, caretTop)` 绝对像素；
> 2. **真实光标紧密跟随与自适应停靠**：
>    - 悬浮插入胶囊实时吸附在光标字符右侧 `10px` 处，光标走到哪，悬浮小栏就跟到哪；
>    - 引入视口右边界碰撞检测（`containerWidth` 保护）：当光标移动至窗口右边缘时，自适应停靠在光标左侧，永不出界遮挡；
>    - 实时显示当前光标所在行列坐标（如 `L12:C18`），输入、滚动、方向键移动即时同步响应；
> 3. **自动化测试与门禁验证**：
>    - 在 `tests/test-markdown-quick-inserter.mjs` 中更新光标真实坐标传递与定位断言；
>    - 全量 101 套自动化测试 100% 绿灯，文档一致性门禁全部通过。

---

## [1.4.35] - 2026-11-10

> [!TIP] v1.4.35 核心升级亮点
> **Markdown 源码编辑光标行悬浮快速插入工具特性体系**：
> 1. **光标所在行精确悬浮吸附 (Floating Quick Action)**：
>    - 源码编辑器（分屏模式、独立源码模式及纯代码编辑）支持动态计算光标所在行的行高、滚动偏移与绝对位置（`cursorTop`）；
>    - 悬浮控制胶囊随光标行平滑上下跟随，不遮挡正文输入视线，在光标滚动出可视区时自动优雅淡出；
> 2. **丰富工具特性库与模板生态**：
>    - **GitHub Alert 5 大语义框**：一键插入 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]` 标准格式；
>    - **交互式排版组件**：一键插入 `[!TABS]` 多标签、`[!STEPS]` 步骤引导、`[!COMPARE]` 方案对比、`[!TIMELINE]` 时间线；
>    - **图表与公式**：一键插入 Mermaid 流程图、时序图、PlantUML 架构图、SVG 矢量画布与 KaTeX 独立数学公式；
>    - **基础常用结构**：一键插入 H1~H3 标题、待办清单 Checkbox、3x3 数据表格、代码块与分割线；
> 3. **智能插入调度与光标聚焦体验**：
>    - 当前行为纯空行时，直接替换空行；
>    - 选中文本时，将特性无缝包围/包裹到选中文本；
>    - 当前行有文本且未选中时，自动在下方换行插入，光标精准聚焦到核心编辑区；
>    - 完整接入 Undo/Redo 历史栈，支持 `Ctrl+Z` / `Cmd+Z` 一键撤销；
> 4. **全主题像素级融合与多语言**：
>    - 遵循 `--ov-*` 语义设计令牌，原生支持毛玻璃半透明浮层、键盘 Esc 关闭与搜索即时过滤；
> 5. **自动化测试扩充**：
>    - 新增专用单元测试套件 `tests/test-markdown-quick-inserter.mjs`，包含 6 组契约与纯函数仿真测试，全量 101 套测试 100% 绿灯。

---

## [1.4.34] - 2026-11-10

> [!TIP] v1.4.34 核心升级亮点
> **Markdown 渲染字号调节面板全面升级：10 档精选预设、步进微调与平滑滑块**：
> 1. **更多预设梯级选择 (12px ~ 24px)**：
>    - 彻底告别原先仅 5 个固定选项（`13, 14, 15, 16, 18`）的局限，扩充为 10 档精选排版字号阶梯：`[12, 13, 14, 15*, 16, 17, 18, 20, 22, 24]`；
>    - 覆盖高密紧凑、标准适中、舒适大屏与巨幕展示全场景，满足不同分辨率、屏幕尺寸与视力偏好需求；
> 2. **快捷步进器与连续滑块控制**：
>    - 字号弹出面板内置 `-` 与 `+` 微调按钮（步长 1px），可在 12px ~ 24px 范围内实现像素级逐级精细微调；
>    - 内置平滑 Range Slider 滑动条，即拖即生效，鼠标/触控拖动时实时预览排版视觉变化；
> 3. **一键复位与当前数值徽章**：
>    - 顶部实时展示当前生效字号徽章（如 `16px`），偏离默认值时提供一键恢复标准推荐值（`15px`）的重置按钮；
> 4. **折叠菜单自适应与全局设置对齐**：
>    - 窄屏收纳更多菜单中同步升级为 10 档阶梯循环切换；
>    - 全局工作台设置面板（`WorkbenchSettingsModal`）与存储中间件同步将最大字号统一扩充至 24px 并支持本地持久化；
> 5. **自动化测试扩充**：
>    - 新增第 10 组 Markdown 字号调节契约测试，验证 10 档梯度、滑块范围、步进微调与持久化截断防护。

---

## [1.4.33] - 2026-11-10

> [!TIP] v1.4.33 核心升级亮点
> **Markdown 驱动分屏自由拖拽调节左右大小与比例持久化**：
> 1. **Markdown 双栏自由拖拽调整**：
>    - 彻底解决 Markdown 渲染在分屏模式（`split`）下左右宽度固定（硬编码 50:50）且无法鼠标调节的问题；
>    - 接入标准化 `useSplitPane` 拖拽内核，支持左右平滑拖动，实时反馈两栏占比；
> 2. **防穿透全局遮罩与安全钳位**：
>    - 拖拽期间自动激活全局防穿透透明遮罩（`ov-drag-overlay`），防止鼠标滑动时触发左侧 Monaco 编辑器或右侧 Webview/Iframe 预览区域的事件捕获与跳跃；
>    - 设定左右双侧安全最小宽度（`minRatio: 15%`, `maxRatio: 85%`，外加 `minWidth: 180px` 物理钳位），防止任一侧内容被压碎隐藏；
> 3. **一键复位与快捷分屏预设**：
>    - 分隔条手柄支持鼠标双击一键精确复位 50:50（对称分屏）；
>    - 右侧预览悬浮工具栏内置快捷比例预设按钮组（`[30:70] [50:50] [70:30]`），单次点击即可在代码主导、对称视图与预览主导间极速切换；
> 4. **比例记忆与配置持久化**：
>    - 用户调整的分屏比例自动持久化到本地存储（`omniview:markdown:splitRatio`）与工作区配置中，关闭标签页或重启后恢复用户专属比例；
> 5. **自动化测试扩充**：
>    - 在 `tests/test-driver-routing.mjs` 中新增第 9 组驱动契约测试，严密断言 `supportsSplitView`、`useSplitPane`、`cursor-col-resize`、快捷预设与双击复位规范。

---

## [1.4.32] - 2026-11-10

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
