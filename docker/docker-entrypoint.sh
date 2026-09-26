#!/bin/sh
set -e

echo "========================================================"
echo " Starting OmniView All-in-One Rendering Container"
echo "========================================================"

PLANTUML_INTERNAL_PORT=${PLANTUML_INTERNAL_PORT:-8081}
export PLANTUML_INTERNAL_PORT

# 1. 后台启动内嵌 PlantUML 官方轻量服务
echo "[1/2] 正在启动内嵌 PlantUML 独立离线引擎 (Port: ${PLANTUML_INTERNAL_PORT})..."
if [ -f "/app/plantuml.jar" ]; then
    java -Djetty.port=${PLANTUML_INTERNAL_PORT} -Dplantuml.security.allow=ALL -jar /app/plantuml.jar &
    PLANTUML_PID=$!
    echo "      PlantUML 进程已拉起 (PID: ${PLANTUML_PID})"
else
    echo "      [WARN] 未找到 /app/plantuml.jar，跳过 PlantUML 内嵌引擎。"
fi

# 2. 优雅停机信号捕获
cleanup() {
    echo "\n正在关闭 OmniView 容器各子服务..."
    if [ ! -z "$PLANTUML_PID" ]; then
        kill -TERM "$PLANTUML_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup TERM INT

# 3. 前台启动 Node.js 网关服务
echo "[2/2] 正在启动 OmniView Web 工作台与 API 路由网关..."
exec node /app/docker/server.mjs
