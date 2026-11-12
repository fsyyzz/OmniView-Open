# Changelog

本文件记录 OmniView 对用户与贡献者可见的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

> [!BANNER] OmniView 版本更新大厅 (Release Center)
> OmniView 致力于提供极速、安全、全主题像素级融合的多格式文档与图表渲染体验。
> 在 OmniView 中预览本文档时，您将体验到**现代交互式折叠手风琴、对比卡片与高光 Alert** 的富媒体排版。

---

## [1.4.45] - 2026-11-11 (当前最新发布)

> [!TIP] v1.4.45 核心升级亮点
> **中英文根目录 README 结构重构精简与深层技术规格下沉收敛至 docs/**：
> 1. **README.md 与 README.en.md 结构轻量化与高密度重塑**：
>    - 将原本近 200 行臃肿的 19 个详细子节，高度提炼归纳为 4 大领域分类矩阵表（专业文档与学术、图表与架构建模、现代办公与数据洞察、云原生与配置）；
>    - 突出三大核心痛点杀手级场景（Word/WPS 剪贴板清洗无损粘贴、DOCX/PPTX/XLSX 秒开、配置转思维导图与拓扑）；
>    - 显著精简全文行数逾 50%，排版清爽，极大提升开源首屏可读性与上手速度；
> 2. **深层技术规格下沉收敛至技术文档库 (`docs/`)**：
>    - 将所有 23+ 格式驱动的技术细节、参数配置、底层流水线与渲染机制全面对齐并补充至 [`docs/features-capabilities.md`](./docs/features-capabilities.md)；
>    - 补充云原生三合一工作台（Dockerfile 多阶段 DAG、Compose 拓扑与 K8s 引力图）与 HTML5 安全沙箱两项深度能力章节；
> 3. **全流程自动化验证与物理门禁 100% 绿灯**：
>    - `check:doc-code-consistency`、`lint:codex`、`check:structure`、`check:react-governance`、`lint` (tsc) 与全量 101/101 套自动化测试 100% 绿灯通过。

---

## [1.4.44] - 2026-11-11

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

> [!NOTE] 历史版本归档提示
> 为保障发布日志可读性与轻量化浏览体验，`CHANGELOG.md` 规范默认收敛并保留最近 10 个核心版本的详细履历。`v1.4.35` 及更早的历史版本发布说明已完整归档至 Git 提交历史与 [GitHub Releases](https://github.com/fsyyzz/OmniView/releases).
