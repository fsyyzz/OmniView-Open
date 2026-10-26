import type { FileItem } from '../../types';

/**
 * 云原生构建流水线与微服务编排清单演示文件集 (Dockerfile / Compose / Kubernetes)
 */
export const CLOUD_NATIVE_SAMPLES: FileItem[] = [
  {
    id: 'file-dockerfile-production',
    name: 'Dockerfile',
    path: '/workspace/Dockerfile',
    extension: 'dockerfile',
    size: 1680,
    lastModified: Date.now() - 360000,
    content: `# OmniView 多阶段安全容器构建流水线示例
# 演示特性：多阶段构建流水线、指令语法透视、暴露端口与卷挂载

# === 阶段 1: 基础依赖构建阶段 ===
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# === 阶段 2: 编译与生产打包阶段 ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build:plugin

# === 阶段 3: 最小安全运行时阶段 ===
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建受限非 root 运行账号
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 omniview

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER omniview
EXPOSE 3000 8080
VOLUME ["/app/data", "/app/logs"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["node", "dist/extension.cjs"]
`,
  },
  {
    id: 'file-docker-compose-stack',
    name: 'docker-compose.yml',
    path: '/workspace/docker-compose.yml',
    extension: 'yml',
    size: 2150,
    lastModified: Date.now() - 180000,
    content: `# OmniView 微服务拓扑编排架构
# 演示特性：微服务拓扑图、端口映射矩阵、卷挂载下钻与敏感环境变量自动脱敏
version: '3.8'

services:
  web-gateway:
    image: nginx:1.25-alpine
    container_name: omniview-gateway
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - renderer-engine
      - auth-service
    networks:
      - public-net
      - internal-net

  renderer-engine:
    image: omniview/renderer:v1.2.0
    container_name: omniview-renderer
    environment:
      PORT: 8080
      MAX_WORKERS: 8
      CACHE_STORAGE_MB: 512
      RENDER_SECRET_TOKEN: "sec_token_prod_super_secret_9981"
    ports:
      - "8080:8080"
    volumes:
      - cache-volume:/app/cache
      - ./config:/app/config:ro
    networks:
      - internal-net

  auth-service:
    image: omniview/auth:v2.1
    environment:
      JWT_SIGNING_KEY: "auth_jwt_super_private_key_2026"
      DB_PASSWORD: "pg_auth_service_production_password"
    depends_on:
      - redis-cache
    networks:
      - internal-net

  redis-cache:
    image: redis:7.2-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - internal-net

networks:
  public-net:
    driver: bridge
  internal-net:
    driver: bridge

volumes:
  cache-volume:
  redis-data:
`,
  },
  {
    id: 'file-k8s-manifest',
    name: 'k8s-cluster-deployment.yaml',
    path: '/deploy/k8s-cluster-deployment.yaml',
    extension: 'yaml',
    size: 3450,
    lastModified: Date.now() - 60000,
    content: `# OmniView Production Kubernetes Deployment Manifest
# 演示特性：多文档清单自动识别、四层引力分层拓扑与安全体检诊断
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omniview-renderer-core
  namespace: omniview-prod
  labels:
    app.kubernetes.io/name: omniview
    app.kubernetes.io/component: core-renderer
    app.kubernetes.io/version: "1.0.0"
spec:
  replicas: 4
  revisionHistoryLimit: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: omniview-core
  template:
    metadata:
      labels:
        app: omniview-core
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values: [omniview-core]
                topologyKey: "kubernetes.io/hostname"
      containers:
        - name: renderer
          image: omniview/renderer-engine:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
            - name: metrics
              containerPort: 9090
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2048Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 2
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            runAsNonRoot: true
            runAsUser: 10001
---
apiVersion: v1
kind: Service
metadata:
  name: omniview-core-svc
  namespace: omniview-prod
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app: omniview-core
`,
  },
];
