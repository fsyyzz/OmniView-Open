import { SoftwareDoc } from '../../types';

export const PRD_DOC: SoftwareDoc = {
  id: 'prd',
  title: '1. 产品需求规格说明书 (PRD)',
  category: 'PRD',
  summary: '系统性阐明 OmniView 产品定位、竞品痛点分析、21 大核心驱动生态矩阵、全链路功能需求清单与严苛的非功能性指标。',
  tags: ['PRD', '产品规划', '功能矩阵', 'Mermaid图表', '指标规范', '云原生'],
  content: `# OmniView 产品需求规格说明书 (PRD)

| 属性 | 详情 |
| :--- | :--- |
| **产品名称** | OmniView (VS Code 全能多维文件渲染与架构视图工作台) |
| **文档版本** | v1.2.4-Release |
| **研发阶段** | 生产就绪与开源生态治理阶段 |
| **开源授权** | MIT License (100% 永久开源无限制) |
| **架构作者** |  |

---

## 一、项目背景与行业痛点分析

在 Visual Studio Code 生态中，现代开发者与架构师日常需要频繁查阅、交互和评审各类非纯代码的异构文件，涵盖 Markdown 设计文档、Mermaid 流程图、PlantUML 架构图、SVG 矢量设计稿、PDF 规格说明书、CSV/TSV 数据报表、Office 办公套件 (DOCX/PPTX/XLSX)、学术排版 (Typst/LaTeX)、数据科学 (Jupyter Notebook)、DDD 领域故事 (Domain Storytelling) 以及**云原生声明式配置清单 (Dockerfile / Compose / Kubernetes / TOML)**。

### 行业现状与痛点对比全景图

\`\`\`mermaid
flowchart TB
    subgraph PainPoints ["⚠️ 传统插件生态痛点 (以商业 Office 插件为例)"]
        direction TB
        A1["商业付费门槛 (Freemium)<br/>高级导出与特定格式弹窗会员锁"]
        A2["包体积臃肿 (30MB+)<br/>捆绑庞大过时 Office 全家桶与重型 WASM"]
        A3["多标签内存飙升 (300MB+)<br/>低配设备或远程 SSH / 容器环境下严重卡顿"]
        A4["隐蔽遥测与数据隐私风险<br/>未经审计的外联通信、代码回传与跟踪脚本"]
    end

    subgraph OmniView ["✨ OmniView 现代化架构破局方案"]
        direction TB
        B1["100% 永久免费开源<br/>MIT 授权，无任何赞助锁与商业门槛"]
        B2["微内核与极简按需打包<br/>单驱动懒加载，无冗余 C/WASM 臃肿包"]
        B3["按需动态懒加载 (Lazy Load)<br/>首屏冷启动小于 140ms，内存小于 45MB"]
        B4["严格本地优先与离线沙箱<br/>CSP 强白名单与 DOMPurify 深度清洗"]
    end

    PainPoints ==>|全面替代与体验重塑| OmniView
\`\`\`

---

## 二、目标用户与典型场景画像

| 角色画像 | 典型痛点 | OmniView 赋能场景 |
| :--- | :--- | :--- |
| **系统架构师 & 技术专家** | Markdown 内部大量引用 Mermaid、PlantUML、Graphviz 拓扑，需频繁借助外部工具或私有服务器渲染。 | 一键即时解析，Markdown 内嵌与独立图表文件均可原生矢量渲染、平移缩放、逐帧演播与无损导出。 |
| **云原生 & DevOps 工程师** | 编写复杂 Dockerfile 难以直观感知分层阶段；排查 Compose 依赖与 K8s 多资源清单如同看天书。 | 提供 Dockerfile 多阶段流水线拓扑、Compose 微服务端口连通网、Kubernetes 四层引力拓扑与安全体检。 |
| **全栈开发者与 Rust/Python 极客** | 打开 TOML/YAML/JSON 配置文件只有单调文本，查看 CSV 只能看纯逗号文本。 | 原生提供结构树、全景思维导图投影、同构数组表格下钻、敏感密钥脱敏及 TOML ⇄ JSON ⇄ YAML ⇄ XML 跨格式互转。 |
| **科研学者与开源作者** | 厌倦笨重的 Office 软件与在线学术排版工具，需要轻巧纯粹、秒开的离线阅读与排版。 | 原生支持 Typst A4 出版级排版、Jupyter Notebook 离线单元格、DOCX/PPTX/XLSX 拟真排版与 EPUB 电子书。 |

---

## 三、统一微内核多格式驱动与渲染流水线架构 (21 核心/扩展驱动生态)

OmniView 采用现代化微内核插件总线架构，文件进入系统后经由智能扩展名路由分发至专属 Driver 沙箱进行解析渲染：

\`\`\`mermaid
flowchart LR
    UserFile["📄 用户打开目标文件"] --> Detector{"扩展名路由匹配"}
    Detector -->|".md / .markdown / .okf"| DrvMD["📝 Markdown 驱动<br/>(GFM + KaTeX + 表格 + 图表)"]
    Detector -->|".puml / .plantuml / .iuml"| DrvPUML["🌐 PlantUML 驱动<br/>(双栏编写 + 毫秒级预览)"]
    Detector -->|".mmd / .mermaid"| DrvMMD["📊 Mermaid 驱动<br/>(流程/时序/状态/甘特)"]
    Detector -->|".dot / .gv / .graphviz"| DrvGV["🔀 Graphviz 拓扑<br/>(DOT 语言 + WASM 离线布局)"]
    Detector -->|".svg"| DrvSVG["🎨 SVG 矢量驱动<br/>(SVG Studio + 图元微调)"]
    Detector -->|".pdf"| DrvPDF["📑 PDF 专业阅读器<br/>(多页流式 + 批注高亮)"]
    Detector -->|".csv / .tsv"| DrvCSV["📊 表格数据网格<br/>(列宽拖拽 + 排序 + 数据画像)"]
    Detector -->|".json / .yaml / .toml / .xml"| DrvDATA["🌲 结构化数据驱动<br/>(树/导图/表格/脱敏/互转)"]
    Detector -->|".markmap / .mm / .mindmap"| DrvMM["🧠 思维导图驱动<br/>(双向分屏 + 节点折叠展开)"]
    Detector -->|".ipynb"| DrvNB["📓 Notebook 驱动<br/>(单元格渲染 + ANSI 高亮)"]
    Detector -->|".typ / .typst"| DrvTYP["📑 Typst 现代排版<br/>(端侧 AST + A4 出版)"]
    Detector -->|".excalidraw"| DrvEXC["✏️ Excalidraw 白板<br/>(手绘白板 + 双向分屏)"]
    Detector -->|".egn / .domainstory"| DrvDS["👥 领域故事驱动<br/>(业务建模 + 逐帧演播)"]
    Detector -->|".epub"| DrvEPUB["📖 EPUB 电子书<br/>(羊皮纸护眼 + 目录大纲)"]
    Detector -->|".docx"| DrvDOCX["📄 Word 拟真排版<br/>(OOXML 离线解包 + A4)"]
    Detector -->|".pptx"| DrvPPTX["📽️ PPTX 幻灯片<br/>(矢量画布 + 沉浸放映)"]
    Detector -->|".xlsx / .xls"| DrvXLSX["📗 Excel 工作簿<br/>(多工作表 + 迷你走势)"]
    Detector -->|".png / .jpg / .webp"| DrvIMG["🖼️ 现代图像工作台<br/>(3200% 缩放 + 16x 取色)"]
    Detector -->|"Dockerfile / *.dockerfile"| DrvDF["🐳 Dockerfile 构建透视<br/>(阶段流水线 + 端口与卷)"]
    Detector -->|"docker-compose.yml"| DrvDC["🐙 Docker Compose 工作台<br/>(微服务拓扑 + 端口矩阵)"]
    Detector -->|"k8s/*.yaml"| DrvK8S["☸️ Kubernetes 引力拓扑<br/>(网络/计算/配置四层分层)"]

    DrvMD --> WebviewStage["🖥️ VS Code Webview 隔离沙箱"]
    DrvPUML --> WebviewStage
    DrvMMD --> WebviewStage
    DrvGV --> WebviewStage
    DrvSVG --> WebviewStage
    DrvPDF --> WebviewStage
    DrvCSV --> WebviewStage
    DrvDATA --> WebviewStage
    DrvMM --> WebviewStage
    DrvNB --> WebviewStage
    DrvTYP --> WebviewStage
    DrvEXC --> WebviewStage
    DrvDS --> WebviewStage
    DrvEPUB --> WebviewStage
    DrvDOCX --> WebviewStage
    DrvPPTX --> WebviewStage
    DrvXLSX --> WebviewStage
    DrvIMG --> WebviewStage
    DrvDF --> WebviewStage
    DrvDC --> WebviewStage
    DrvK8S --> WebviewStage

    WebviewStage --> Actions["⚡ 导出 SVG / 无损打印 / 双向编辑 / 剪贴板清洗"]
\`\`\`

---

## 四、产品功能性需求规格 (Functional Requirements)

### FR-01: Markdown 核心扩展渲染器 (Markdown Driver)
* **FR-01.1 (GFM 标准与块级解耦)**：完全支持 GitHub Flavored Markdown，包括代码高亮、表格、任务清单复选框、删除线、引用块等。
* **FR-01.2 (嵌入式图表混排)**：自动捕获 \`\`\`mermaid、\`\`\`plantuml、\`\`\`dot、\`\`\`svg、\`\`\`domainstory 代码块，动态调起对应专用引擎矢量渲染并支持双击全屏沉浸灯箱。
* **FR-01.3 (KaTeX 数学公式)**：原生支持行内 \`$ ... $\` 与块级 \`$$ ... $$\` 复杂学术公式混排与矢量导出。
* **FR-01.4 (Word/WPS 剪贴板清洗)**：拦截复制事件，自动去除外层边框与交互手柄，将图表自动光栅化为 300+ DPI Base64 PNG，双通道兼容写入。

### FR-02: 矢量图形与架构建模器 (PlantUML / Mermaid / Graphviz / SVG)
* **FR-02.1 (PlantUML 独立建模)**：支持双栏分屏编写与预览，时序图、组件图、状态机实时编译为矢量 SVG 及一键导出。
* **FR-02.2 (Mermaid 动态图表)**：完整覆盖流程图、甘特图、GitGraph、时序图及类图，支持平滑缩放与主题自适应。
* **FR-02.3 (Graphviz DOT 拓扑)**：基于 WebAssembly 纯端侧编译 Graphviz DOT 源码，毫秒级响应系统拓扑结构。
* **FR-02.4 (SVG Studio 矢量微调)**：高精度平移缩放 (10%~500%)、标尺网格、DOM 结构检查与 XML 源码双向查看。

### FR-03: 现代化多页 PDF 规格阅读器 (PDF Driver)
* **FR-03.1 (多页连续流式与单/双页翻书)**：提供连续流式瀑布流、单页居中翻页与双页图书并排开本三重视图；支持视口滚动监听与当前阅读页自动感知 (Scroll Spy)。
* **FR-03.2 (自适应排版与视口懒渲染)**：支持适合宽度与适合单页；引入基于 IntersectionObserver 的视口懒渲染机制，保障超长文档流畅滚动。
* **FR-03.3 (全文检索与划词标注)**：集成高精度关键词检索、TextLayer 文本划词复制、多色高亮标注及一键导出为 Markdown 读书笔记。

### FR-04: Typst 出版级现代排版工作室 (Typst Driver)
* **FR-04.1 (双向分屏编辑与实时排版)**：左侧编辑 Typst 源码，右侧即时生成高精度多页矢量排版。
* **FR-04.2 (多页出版与物理分页)**：支持 \`#set page\` 纸张与边距、\`#pagebreak()\` 强制切页与双面奇偶页装订线边距。
* **FR-04.3 (学术大纲与矢量导出)**：集成 KaTeX 公式渲染，实时提取文档目录大纲 (TOC) 并支持平滑点击跳转、单页 SVG 导出与无损 A4 打印。

### FR-05: 智能表格数据网格 (CSV/TSV Driver)
* **FR-05.1 (高亮网格化展示)**：RFC 4180 标准解析逗号与制表符分隔文本，列宽自由拖拽与持久化。
* **FR-05.2 (排序与全局检索)**：支持任意列的数字/字典升降序排列，输入关键词即时过滤。
* **FR-05.3 (数据统计画像 Profiling)**：自动分析列数据分布、空值率、最大值/最小值与唯一值计数。

### FR-06: Office 三件套纯前端离线工作台 (DOCX / PPTX / XLSX)
* **FR-06.1 (Word DOCX 拟真排版)**：基于 OOXML 解包，支持 A4 纸张拟真、复杂表格单元格合并、嵌入图片与暗色反转。
* **FR-06.2 (PowerPoint PPTX 演播工作台)**：纯离线解包矢量形状，支持 16:9 / 4:3 画布自适应、全屏放映与演讲者备注。
* **FR-06.3 (Excel XLSX 多工作表工作簿)**：支持多工作表标签页毫秒级切换、共享字符串池、公式计算值解析与多格式导出。

### FR-07: 现代多媒体与学术工作台 (EPUB / Notebook / Excalidraw / Image)
* **FR-07.1 (EPUB 流式电子书)**：双叶并排跨页、单页流式、连续滚动三重形态，3D 翻书动效，阅读进度断点续读。
* **FR-07.2 (Jupyter Notebook)**：离线解析 \`.ipynb\` v4，支持 Markdown 单元格混排、代码单元格高亮与 ANSI 异常栈解析。
* **FR-07.3 (Excalidraw 白板)**：手绘白板工作室，图元自由绘制、双向分屏编辑与矢量无损导出。
* **FR-07.4 (现代图像工作台)**：10%~3200% 极清矢量缩放、16x 十字放大镜取色器 (HEX/RGBA/HSLA) 与 EXIF 深度元数据透视。

### FR-08: 结构化数据全景工作台 (JSON / YAML / TOML / XML)
* **FR-08.1 (工业级 TOML 语法支持)**：完整支持点分多级节名 (\`[package.metadata.docs]\`)、内联表 (\`serde = { version = "1.0" }\`)、数组表 (\`[[bin]]\`)、行内注释剥除与多行三引号文本。
* **FR-08.2 (多态可视化投影)**：提供结构树检视 (Tree)、全景思维导图投影 (Mindmap)、同构对象表格下钻 (Table) 与源码模式 (Code)。
* **FR-08.3 (跨格式无损互转)**：支持 **TOML ⇄ JSON ⇄ YAML ⇄ XML** 实时本地无损互转，支持一键格式化美化、压缩与导出。
* **FR-08.4 (敏感密钥安全脱敏)**：自动识别 Token、Secret、Password、PrivateKey 等敏感字段并提供一键掩码掩盖保护。

### FR-09: 思维导图与知识大纲 (Mindmap Driver)
* **FR-09.1 (Markmap 矢量大纲)**：支持层级缩进与 Markdown 大纲解析，D3 动态力导向布局与节点平滑折叠展开。
* **FR-09.2 (双向分屏协同)**：支持左侧大纲源码编辑，右侧思维导图矢量画布毫秒级同步重绘，支持独立 SVG 导出。

### FR-10: 领域故事驱动建模器 (DomainStory Driver)
* **FR-10.1 (标准互通与 DSL 嵌入)**：兼容 \`egon.io\` 标准 \`.egn\` JSON 格式与 Markdown \`\`\`domainstory 紧凑文本 DSL。
* **FR-10.2 (逐帧交互演播)**：提供时序步进演播器 (DiagramStepPlayer)，支持上一帧/下一帧、自动巡游演播与步骤注释。
* **FR-10.3 (Polyglot SVG 导出)**：导出内嵌领域故事模型元数据的双通道 SVG，实现绘图与数据复用的统一。

### FR-11: Dockerfile 构建流水线与指令透视 (Dockerfile Driver)
* **FR-11.1 (多阶段构建流水线拓扑)**：自动识别 \`FROM ... AS stage\`，绘制阶段构建依赖流水线图。
* **FR-11.2 (关键元数据透视)**：指令分类统计、对外暴露端口清单 (EXPOSE)、挂载卷 (VOLUME) 与环境变量清单 (ENV)。
* **FR-11.3 (构建安全体检诊断)**：检测未指定版本最新标签 (\`:latest\`)、缺少非 root 用户 (USER)、敏感参数泄露等构建健康度体检。

### FR-12: Docker Compose 微服务拓扑工作台 (Compose Driver)
* **FR-12.1 (服务间依赖拓扑图)**：解析 \`services\`、\`depends_on\` 与 \`networks\`，动态生成微服务网络依赖拓扑架构图。
* **FR-12.2 (端口映射与卷挂载矩阵)**：表格化透视主机到容器的端口暴露与存储卷挂载路径。
* **FR-12.3 (敏感环境变量智能脱敏)**：对 Compose 配置中的密码、数据库凭据与密钥实施自动掩码保护。

### FR-13: Kubernetes 清单引力拓扑与安全体检 (Kubernetes Driver)
* **FR-13.1 (多文档清单智能切分)**：自动分割并解析以 \`---\` 分隔的复合 Kubernetes 清单文件。
* **FR-13.2 (四层引力分层拓扑)**：将集群资源划分为**网络入口层 (Ingress/Service)**、**计算工作负载层 (Deployment/StatefulSet/Pod)**、**配置中心层 (ConfigMap/Secret)** 与**持久化存储层 (PVC/PV)** 垂直引力连线展示。
* **FR-13.3 (云原生配置体检诊断)**：自动排查缺少资源限制 (resources.limits)、特权容器运行 (privileged: true)、缺少探针 (livenessProbe/readinessProbe) 等安全隐患。

---

## 五、零遥测与安全合规保障

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 140" width="100%" height="140" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;padding:12px;">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>
  <g transform="translate(20, 20)">
    <circle cx="45" cy="45" r="40" fill="url(#shieldGrad)" opacity="0.15" />
    <path d="M45 15 L70 25 V50 C70 66 59 78 45 82 C31 78 20 66 20 50 V25 Z" fill="url(#shieldGrad)" stroke="#60a5fa" stroke-width="2" />
    <path d="M36 48 L42 54 L54 38" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </g>
  <text x="120" y="45" fill="#f8fafc" font-size="16" font-weight="bold" font-family="sans-serif">OmniView 纯粹开源与 100% 隐私安全防护认证</text>
  <text x="120" y="72" fill="#94a3b8" font-size="13" font-family="sans-serif">✓ 零网络遥测 (No Telemetry)   ✓ 本地离线优先 (100% Offline)   ✓ MIT 永久开源 (No Paywall)</text>
  <text x="120" y="98" fill="#64748b" font-size="12" font-family="sans-serif">严格贯彻 VS Code Webview CSP 白名单标准与 DOMPurify 严密消毒净化。</text>
</svg>
\`\`\`

---

## 六、严苛的非功能性指标 (Non-Functional Requirements)

1. **包体积限制**：插件打包后 VSIX 体积严格控制在合理轻量区间（无冗余 C/WASM 臃肿包）。
2. **冷启动性能**：打开任意支持的文件，Webview 首屏可见内容渲染耗时 **< 140 ms**。
3. **内存占用控制**：打开 5 个不同类型标签页时，Webview 进程总体内存占用增量必须 **< 45 MB**。
4. **安全与隔离**：严格贯彻 VS Code Webview CSP（Content Security Policy），严禁任何未经清洗的危险脚本执行（DOMPurify 100% 覆盖）。
5. **商业承诺**：**永久 100% 免费**，绝不植入任何赞助弹窗、会员功能锁与第三方推广。
`,
};
