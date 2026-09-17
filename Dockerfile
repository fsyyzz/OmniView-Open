# ==============================================================================
# OmniView 集中渲染应用与独立工作台 Dockerfile
# 架构特性：
# 1. 多阶段轻量级安全构建 (Multi-Stage Build)
# 2. 内嵌 PlantUML 离线渲染引擎 (含 Graphviz 拓扑计算与全套 CJK 中文字体)
# 3. 内置 OmniView 10+ 格式统一 Web 交互工作台
# 4. 原生零依赖网关，兼具 SPA 托管与反向代理能力
# 作者: 周赞
# ==============================================================================

# ------------------------------------------------------------------------------
# 阶段 1: 编译 OmniView 前端 Web 工作台
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /build

# 优先缓存依赖层
COPY package*.json ./
RUN npm ci

# 复制源码并执行 Webview / SPA 产物构建
COPY . .
RUN npm run build:webview

# ------------------------------------------------------------------------------
# 阶段 2: 生产运行环境 (Alpine + OpenJDK 17 + Node.js 22 + Graphviz + CJK Fonts)
# ------------------------------------------------------------------------------
FROM eclipse-temurin:17-jre-alpine AS runner

LABEL maintainer="周赞"
LABEL description="OmniView 集中渲染引擎与离线 Web 工作台"

# 安装必要依赖：
# 1. graphviz: PlantUML 状态机/时序图/类图拓扑必需
# 2. font-noto-cjk, ttf-dejavu: 避免中文字符与技术标记乱码/框框
# 3. nodejs: 网关与静态服务运行时
# 4. curl: 容器健康探针检测
RUN apk add --no-cache \
    graphviz \
    font-noto-cjk \
    ttf-dejavu \
    nodejs \
    curl

WORKDIR /app

# 下载官方发布的 PlantUML 轻量级 Standalone Server (Jetty 嵌入式，约 40MB)
# 可在容器离线环境中直接提供完整的 PlantUML 矢量渲染能力
ENV PLANTUML_SERVER_VERSION=1.2024.7
RUN curl -fsSL "https://github.com/plantuml/plantuml-server/releases/download/v${PLANTUML_SERVER_VERSION}/plantuml-server-jetty.jar" \
    -o /app/plantuml.jar || \
    curl -fsSL "https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/${PLANTUML_SERVER_VERSION}/plantuml-${PLANTUML_SERVER_VERSION}.jar" \
    -o /app/plantuml.jar

# 拷贝静态资源与网关脚本
COPY --from=builder /build/dist /app/dist
COPY docker /app/docker

RUN chmod +x /app/docker/docker-entrypoint.sh

# 环境变量配置
ENV PORT=8080
ENV PLANTUML_INTERNAL_PORT=8081
ENV STATIC_DIR=/app/dist

# 暴露对外服务端口
EXPOSE 8080

# 容器健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["/app/docker/docker-entrypoint.sh"]
