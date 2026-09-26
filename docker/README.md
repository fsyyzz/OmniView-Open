# OmniView 统一集中渲染容器与 Web 工作台

> 镜像定位：全功能多格式集中渲染服务 + 纯离线 PlantUML 本地引擎 + 独立 Web 交互工作台

---

## 🌟 核心价值

1. **彻底摆脱外网依赖（纯离线内网首选）**：
   - 内置 **PlantUML Standalone Server**（基于 OpenJDK 17 + Graphviz），解决原插件中 PlantUML 依赖远程公网或私有服务器出图的痛点。
   - 包含完整的 **Noto CJK 简体中文字体与 DejaVu 等宽字体**，彻底杜绝文字排版方块与截断。
2. **免 VS Code 的独立 Web 工作台**：
   - 容器直接托管 OmniView Web SPA，浏览器访问 `http://localhost:8080/` 即可直接使用全功能 Markdown、Excalidraw、Markmap、Domain Storytelling、Typst、KaTeX 查看与导出能力。
3. **跨系统 API 与 VS Code 插件零缝隙对接**：
   - 对外统一暴露 `8080` 端口，自动分流静态 Web 请求与 PlantUML 渲染请求。

---

## 🚀 快速启动

### 方式 1: 使用 Docker Compose（推荐）

在仓库根目录下执行：

```bash
docker compose up -d --build
```

### 方式 2: 使用原生 Docker 命令

```bash
# 1. 构建镜像
docker build -t omniview:latest .

# 2. 运行容器
docker run -d \
  --name omniview-hub \
  -p 8080:8080 \
  --restart unless-stopped \
  omniview:latest
```

---

## 📡 服务路由与访问入口

| 服务能力 | 访问地址 | 说明 |
|---|---|---|
| **OmniView Web 工作台** | `http://localhost:8080/` | 浏览器直接打开，开箱即用的可视化工作台 |
| **PlantUML 离线渲染端点** | `http://localhost:8080/plantuml/` | 兼容标准 PlantUML Server API，供插件/外部系统调用 |
| **容器健康探针** | `http://localhost:8080/api/health` | 返回服务运行状态、各功能模块就绪情况与版本元数据 |

---

## 🔌 VS Code 插件离线联动配置

启动容器后，将 VS Code 中的 OmniView PlantUML 地址指向本地容器，即可在**断网或受限企业内网**中秒级渲染 PlantUML：

打开 VS Code `settings.json`，增加以下配置：

```json
{
  "omniview.plantuml.serverUrl": "http://localhost:8080/plantuml"
}
```

配置后，OmniView 渲染 `.puml`、`.plantuml` 以及 Markdown 中的 PlantUML 代码块时，将全部走本地 Docker 容器内部的高速离线引擎，出图速度比公网快 5~10 倍且保证数据安全不外泄。

---

## 🛠️ 镜像技术规格

- **基础镜像**: `eclipse-temurin:17-jre-alpine` (JRE 17 + Alpine Linux)
- **前端编译**: `node:22-alpine` 多阶段安全构建
- **核心组件**:
  - `graphviz`: PlantUML 状态机与架构图拓扑计算
  - `font-noto-cjk`: 中文思源黑体
  - `plantuml-server-jetty.jar`: 官方轻量独立运行包
  - `docker/server.mjs`: Node 原生极简路由网关（零第三方运行时 npm 依赖，免去安全漏洞与供应链投毒风险）
