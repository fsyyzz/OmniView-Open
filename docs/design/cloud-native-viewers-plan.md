# OmniView 云原生基础设施文件支持规划提案 (RFC: Cloud-Native Viewers Plan)

> **版本**：v1.0.0  
> **状态**：规划评审中 (Planning / In Review)  
> **涵盖文件**：`Dockerfile`、`docker-compose.yml`、`Kubernetes YAML (k8s manifests)`  
> **主导角色**：`architect-reviewer` + `innovation-consultant` + `render-engineer`

---

## 1. 背景与目标 (Background & Objectives)

在现代软件工程中，Docker 与 Kubernetes 已成为云原生微服务开发与部署的事实标准。然而，开发者在 VS Code 或工作台中查看和调试此类基础设施代码时，常常面临以下痛点：
1. **Dockerfile** 纯文本缺乏多阶段构建（Multi-Stage Builds）阶段依赖流向的直观体现，容易出现层级冗余与基础镜像版本混淆；
2. **Docker Compose** 随着微服务数量上升，网络隔离关系（networks）、持久化挂载（volumes）、端口映射（ports）和启动依赖（depends_on）形成复杂的网状交织，纯文本极难建立直观的心智拓扑模型；
3. **Kubernetes YAML** 动辄成百上千行，嵌套极深且经常包含多资源（Multi-Document YAML）。跨资源间的引力关系（`Ingress ──(routes)──> Service ──(selects)──> Deployment/Pod ──(mounts)──> ConfigMap/Secret/PVC`）纯靠人脑记忆与字符串比对，拼写失误排查成本高昂。

**核心目标**：
在 OmniView 中为 `Dockerfile`、`docker-compose` 与 `Kubernetes` 打造**多维云原生可视化工作台**，支持**架构拓扑图、多阶段构建流水线、依赖网络图谱、源码双向高亮分屏与静态最佳实践诊断**，且保持 **100% 离线运行、零服务端依赖与企业数据安全**。

---

## 2. 核心架构与分层设计 (Architecture & Layers)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OmniView 统一工作台外壳                           │
│     (Toolbar 视图切换: 架构拓扑 / 指令流水线 / 结构化树表 / 源码分屏)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  Dockerfile  │             │Docker Compose│             │  Kubernetes  │
│    Viewer    │             │    Viewer    │             │    Viewer    │
└──────┬───────┘             └──────┬───────┘             └──────┬───────┘
       │                            │                            │
       ▼                            ▼                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      云原生语义与 AST 解析核心层                        │
│  - DockerfileStageParser: 多阶段提取、COPY 依赖拓扑、EXPOSE/ENV 归纳     │
│  - ComposeTopologyParser: 服务依赖 DAG、网络边界隔离、数据卷映射        │
│  - K8sManifestParser: js-yaml loadAll、资源分类、Selector 跨资源引力图   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│ 嗅探识别契约 │             │ 拓扑渲染引擎 │             │ 安全/健康诊断│
│(精准格式裁决)│             │ (SVG/Mermaid)│             │(静态规则引擎)│
└──────────────┘             └──────────────┘             └──────────────┘
```

### 2.1 嗅探与识别策略 (File Sniffing Strategy)

在 [driverRegistry.ts](file:///Users/zhouna/zhouzan/OmniView/src/features/viewers/lib/driverRegistry.ts) 与 `package.json` 中建立精准的分级嗅探规则，杜绝误判：

| 目标格式 | 规则 1：文件名/扩展名断言 | 规则 2：内容特征嗅探（首 2KB 内容兜底） | 匹配优先级 |
|---|---|---|---|
| **Dockerfile** | `Dockerfile`, `Dockerfile.*`, `*.dockerfile` (大小写不敏感) | 正则匹配：以 `^\s*FROM\s+` 或 `^\s*#\s*syntax=` 开头 | 优先级 1（特异性高） |
| **Docker Compose** | 文件名包含 `compose` 且后缀为 `.yml`/`.yaml`（如 `docker-compose.yml`, `compose.yaml`） | YAML 解析顶层包含 `services` 对象，且服务子项含有 `image`, `build`, `ports` 等特征字段 | 优先级 2 |
| **Kubernetes** | 后缀为 `.yml`/`.yaml`，或路径包含 `k8s/`, `kubernetes/`, `deploy/` | YAML 解析包含 `apiVersion` 与 `kind`，且 `kind` 为标准云原生对象（Deployment, Service, Pod 等） | 优先级 3 |

---

## 3. 三大格式核心功能设计 (Feature Specifications)

### 3.1 Dockerfile 可视化工作台 (Dockerfile Viewer)

1. **多阶段流水线构建泳道图 (Multi-stage Build Pipeline)**：
   - 自动识别所有 `FROM ... AS <stage_name>` 阶段；
   - 自动追踪 `COPY --from=<stage_name>` 的跨阶段依赖传递，生成 DAG 阶段构建流程图；
   - 终态镜像标记：高亮最终输出的生产容器镜像阶段。
2. **指令层级检视卡片 (Layer Breakdown)**：
   - 将原始指令按作用分类（Base 基础镜像、Config 环境配置、Build 编译构建、Expose 端口、Entrypoint 运行入口）；
   - 展示每层命令的参数与作用。
3. **最佳实践与构建优化体检 (Dockerfile Linter)**：
   - 静态检查：未指定具体版本标签（如使用 `:latest`）；
   - 连续多个 `RUN` 指令未合并产生多余镜像层；
   - 缺少非 root 用户切换（缺少 `USER` 指令）；
   - 暴露敏感端口或未声明 `HEALTHCHECK`。
4. **源码双向协同**：
   - 点击流水线阶段或指令卡片，自动高亮并定位源码对应行号。

### 3.2 Docker Compose 微服务拓扑工作台 (Compose Viewer)

1. **微服务拓扑架构图 (Service Topology Graph)**：
   - **服务容器节点**：展示服务名称、镜像名称/Build 路径、副本数；
   - **依赖连线**：依据 `depends_on` 绘制服务间依赖顺序流；
   - **网络子网区域 (Network Boundaries)**：将同一虚拟网络（`networks`）下的服务绘制在专属虚线隔离簇内；
   - **数据卷持久化 (Volume Mounts)**：展示绑定卷与外部卷的挂载关系；
   - **宿主端口映射 (Port Exposure)**：在服务节点右上方以 Badge 显示宿主与容器端口映射（如 `8080:80`）。
2. **服务配置矩阵表 (Service Matrix)**：
   - 一览式表格：服务名、镜像、CPU/Memory 资源限制、重启策略（Restart Policy）、健康检查；
   - 支持快速搜索过滤与字段排序。
3. **环境变量聚合与脱敏检视 (Environment Inspector)**：
   - 聚合提取每个服务的环境变量，支持键值搜索，对敏感字段（含 `PASSWORD`, `SECRET`, `KEY`, `TOKEN`）默认脱敏打码展示。

### 3.3 Kubernetes 资源全景图谱工作台 (K8s Manifest Viewer)

1. **多文档 YAML 分解与全景目录 (Multi-document Navigation)**：
   - 自动解析 `---` 分割的复合 YAML 文件；
   - 左侧或顶栏展示资源卡片清单（Workloads: 2, Networking: 1, Config: 3）。
2. **云原生资源引力拓扑图 (K8s Resource Topology Graph)**：
   - **四层标准拓扑模型**：
     - **Ingress 层**：展示域名（Hosts）、路径路由（Paths）；
     - **Service 层**：展示 Service 类型（ClusterIP/NodePort/LoadBalancer）及暴露端口；
     - **Workload 层**：展示 Deployment / StatefulSet / DaemonSet / Pod，显示副本数与镜像；
     - **Config & Storage 层**：展示关联的 ConfigMap / Secret / PVC。
   - **跨资源关联解析**：
     - 自动解析 Ingress $\to$ Service 的 `service.name` 连线；
     - 自动解析 Service $\to$ Pod 的 `selector` 匹配并连线；
     - 自动解析 Pod $\to$ ConfigMap/Secret 的 `envFrom` / `configMapRef` / `secretRef` 连线；
     - 自动解析 Pod $\to$ PVC 的 `persistentVolumeClaim.claimName` 挂载连线。
3. **断链与合规性诊断 (Broken Reference & Sanity Checker)**：
   - **悬空引用警告**：例如 Ingress 指向了文件中不存在的 Service，或 Pod 引用了未定义的 ConfigMap/Secret；
   - **资源配额健康度**：检查 Pod 是否配置了 `resources.limits` 和 `resources.requests`；
   - **健康探针检查**：检查工作负载是否缺失 `livenessProbe` / `readinessProbe`。

---

## 4. 技术选型与实施规范 (Tech Stack & Implementation Specs)

1. **零重量外部依赖与 100% 离线安全**：
   - 仅依赖项目现有已内置的 `js-yaml`（支持 `loadAll` 解析多段 YAML）；
   - Dockerfile 解析采用纯 TypeScript 编写的轻量 AST 解析器，零外部 npm 包开销；
   - 拓扑渲染引擎依托已有的 SVG / Mermaid 引擎或现代化自适应 Canvas，保证在 VS Code 隔离沙箱与离线网络下 100% 可靠秒开。
2. **全主题像素级融合**：
   - 100% 遵循 `--ov-*` 语义令牌体系，与 One Dark Pro、Dracula、Tokyo Night、GitHub Light 等 VS Code 主题完美匹配。
3. **分屏协同模式 (Split View Support)**：
   - 支持左侧源码实时编辑、右侧拓扑图与指令流毫秒级响应重载。

---

## 5. 分阶段演进实施路线图 (Implementation Roadmap)

| 阶段 | 交付里程碑 | 涉及核心产物与改动面 | 质量验收标准 |
|---|---|---|---|
| **Phase 1: 嗅探识别与模型抽象** | 扩展驱动注册中心与文件特征嗅探，定义统一解析数据模型 | [driverRegistry.ts](file:///Users/zhouna/zhouzan/OmniView/src/features/viewers/lib/driverRegistry.ts), [types.ts](file:///Users/zhouna/zhouzan/OmniView/src/shared/types.ts), `fileSniffer.ts` | 3 种格式命中率 100%，无普通 YAML 误伤 |
| **Phase 2: Dockerfile 驱动** | 实现阶段 DAG、指令层级卡片、基础最佳实践体检与分屏协同 | `DockerfileViewer.tsx`, `dockerfileParser.ts`, 样例文档 | 覆盖多阶段构建用例与单测 |
| **Phase 3: Docker Compose 驱动** | 实现微服务拓扑图、端口网络矩阵、环境变量检视与服务卡片 | `ComposeViewer.tsx`, `composeParser.ts`, 样例 compose.yml | 复杂多网络与多卷拓扑正常连线 |
| **Phase 4: Kubernetes Manifest 驱动** | 实现多文档切分、4 层资源引力图、跨资源 Selector 自动连线与断链诊断 | `K8sViewer.tsx`, `k8sParser.ts`, 样例 k8s.yaml | 支持 Ingress $\to$ Service $\to$ Pod 连线与断链预警 |
| **Phase 5: VS Code 扩展集成与模板库** | 在 VS Code `package.json` 注册文件关联、右键菜单、新建云原生模板 | `package.json`, 模板脚手架, VSIX 打包回归 | 全量门禁验收通过，打出全新 VSIX |

---

## 6. 核心方案决策与确认项 (Decisions to Align)

在推进具体编码之前，请您审阅并裁决以下两点设计细节：
1. **驱动挂载形态**：
   - **方案 A (推荐)**：统一作为独立专业驱动（`DockerfileViewer`、`ComposeViewer`、`K8sViewer`），在顶部工具栏提供【架构拓扑】、【结构化表格】、【纯代码分屏】3 种视图一键切换；
   - **方案 B**：将 Compose 与 K8s 整合进现有的 `StructuredDataViewer` 内部作为一个新的 Tab（例如除了“树形视图”、“表格视图”外增加“云原生拓扑”Tab）。
2. **实施节奏推进**：
   - 是否按照：**`Dockerfile` $\to$ `Docker Compose` $\to$ `Kubernetes`** 循序渐进依次开发与验证交付？
