#!/usr/bin/env node
/**
 * OmniView 云原生驱动（Dockerfile / Docker Compose / Kubernetes）自动化单元测试套件
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { getDriverIdForFile, resolveDriverPluginForFile } from '../src/features/viewers/lib/driverRegistry.ts';
import { parseDockerfile } from '../src/features/viewers/lib/parsers/dockerfileParser.ts';
import { parseComposeFile, maskSensitiveValue } from '../src/features/viewers/lib/parsers/composeParser.ts';
import { parseK8sManifest } from '../src/features/viewers/lib/parsers/k8sParser.ts';

const rootDir = process.cwd();

console.log('🧪 开始云原生全套驱动（Dockerfile / Compose / K8s）自动化单元测试...');

// ========================================================
// 1. 路由与文件嗅探断言测试
// ========================================================
console.log('--- 测试 1: 文件名与智能内容特征嗅探路由 ---');

function mockFile(name, content = '') {
  const extension = name.split('.').pop() || '';
  return {
    id: `file_${Date.now()}_${Math.random()}`,
    name,
    extension,
    content,
    size: content.length,
    lastModified: Date.now(),
  };
}

// 1.1 Dockerfile
assert.strictEqual(getDriverIdForFile(mockFile('Dockerfile')), 'dockerfile', '无后缀 Dockerfile 识别失败');
assert.strictEqual(getDriverIdForFile(mockFile('Dockerfile.prod')), 'dockerfile', 'Dockerfile.prod 识别失败');
assert.strictEqual(getDriverIdForFile(mockFile('app.dockerfile')), 'dockerfile', '*.dockerfile 识别失败');
assert.strictEqual(
  getDriverIdForFile(mockFile('custom-build-script', 'FROM ubuntu:22.04\nRUN apt update')),
  'dockerfile',
  '基于 FROM 内容特征嗅探 Dockerfile 失败'
);

// 1.2 Docker Compose
assert.strictEqual(getDriverIdForFile(mockFile('docker-compose.yml')), 'compose', 'docker-compose.yml 识别失败');
assert.strictEqual(getDriverIdForFile(mockFile('docker-compose.yaml')), 'compose', 'docker-compose.yaml 识别失败');
assert.strictEqual(getDriverIdForFile(mockFile('compose.yml')), 'compose', 'compose.yml 识别失败');
assert.strictEqual(
  getDriverIdForFile(mockFile('stack.yml', 'version: "3"\nservices:\n  web:\n    image: nginx')),
  'compose',
  '基于 services: 内容特征嗅探 Compose 失败'
);

// 1.3 Kubernetes Manifests
assert.strictEqual(
  getDriverIdForFile(mockFile('k8s-app.yaml', 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app')),
  'k8s',
  '基于 apiVersion/kind 内容特征嗅探 K8s 失败'
);
assert.strictEqual(
  getDriverIdForFile(mockFile('ingress.yaml', 'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: ing')),
  'k8s',
  '基于 Ingress kind 识别 K8s 失败'
);

// 1.4 非云原生普通 YAML 降级验证 (防误伤)
assert.strictEqual(
  getDriverIdForFile(mockFile('settings.yaml', 'theme: dark\nfontSize: 14\nautoSave: true')),
  'code',
  '普通 key-value YAML 应保持默认 code 查看器，不应误识别'
);

console.log('✅ 路由与文件嗅探测试全部通过');

// ========================================================
// 2. Dockerfile 解析器深度断言测试
// ========================================================
console.log('--- 测试 2: Dockerfile 多阶段构建流水线与指令透视解析 ---');

const sampleDockerfile = fs.readFileSync(path.join(rootDir, 'examples/docker/Dockerfile'), 'utf-8');
const dockerResult = parseDockerfile(sampleDockerfile);

assert.strictEqual(dockerResult.stages.length, 3, '应成功解析出 3 个构建阶段 (base, builder, runner)');
assert.strictEqual(dockerResult.stages[0].name, 'base');
assert.strictEqual(dockerResult.stages[1].name, 'builder');
assert.strictEqual(dockerResult.stages[2].name, 'runner');
assert.strictEqual(dockerResult.stages[1].baseImage, 'base', '阶段 2 baseImage 应为 base');

// 指令清单断言
assert.ok(dockerResult.allInstructions.length >= 10, '解析出的指令数应不少于 10 条');
assert.ok(dockerResult.exposedPorts.includes(3000), '应提取出 3000 端口');
const portEnv = dockerResult.envVars.find((e) => e.key === 'PORT');
assert.ok(portEnv, '应提取出环境变量 PORT');
assert.strictEqual(portEnv.value, '3000', 'PORT 变量值应为 3000');

// 最佳实践体检规则断言 (由于采用了 node:20-alpine 具名标签且添加了 USER，无严重报错)
assert.ok(Array.isArray(dockerResult.diagnostics), 'diagnostics 应为数组');
console.log(`  Dockerfile 识别阶段: ${dockerResult.stages.map((s) => s.name).join(' -> ')}`);
console.log(`  Dockerfile 暴露端口: ${dockerResult.exposedPorts.join(', ')}`);
console.log('✅ Dockerfile 解析器测试全部通过');

// ========================================================
// 3. Docker Compose 解析器与脱敏测试
// ========================================================
console.log('--- 测试 3: Docker Compose 微服务拓扑与脱敏解析 ---');

// 3.1 环境变量脱敏函数
assert.strictEqual(maskSensitiveValue('sk-1234567890abcdef'), 'sk••••ef', '脱敏应保留头尾部分并打码');
assert.strictEqual(maskSensitiveValue('short'), 'sh••••rt', '较短值保留首尾打码');
assert.strictEqual(maskSensitiveValue('key'), '••••', '极短敏感值应完全打码');

// 3.2 实际 Compose 解析
const sampleCompose = fs.readFileSync(path.join(rootDir, 'examples/docker/docker-compose.yml'), 'utf-8');
const composeResult = parseComposeFile(sampleCompose);

assert.strictEqual(composeResult.version, '3.8', 'Compose 版本应为 3.8');
assert.strictEqual(composeResult.services.length, 5, '应识别出 5 个微服务 (gateway, web-client, api-server, postgres-db, redis-cache)');
assert.ok(composeResult.networks.includes('frontend-net'), '应包含 frontend-net 网络');
assert.ok(composeResult.networks.includes('backend-net'), '应包含 backend-net 网络');
assert.ok(composeResult.volumes.includes('pgdata'), '应包含 pgdata 卷');

// 拓扑节点与依赖连线断言
const apiService = composeResult.services.find((s) => s.name === 'api-server');
assert.ok(apiService, '应包含 api-server 服务');
assert.ok(apiService.dependsOn.includes('postgres-db'), 'api-server 应依赖 postgres-db');
assert.ok(apiService.dependsOn.includes('redis-cache'), 'api-server 应依赖 redis-cache');

// 环境变量敏感脱敏项断言
const jwtEnv = apiService.environment.find((e) => e.key === 'JWT_SECRET');
assert.ok(jwtEnv, 'JWT_SECRET 环境变量应被识别');
assert.ok(jwtEnv.isSensitive, 'JWT_SECRET 应被标记为敏感变量');
assert.strictEqual(maskSensitiveValue(jwtEnv.value), 'sk••••90', '敏感变量脱敏逻辑正确');

console.log(`  Compose 服务数: ${composeResult.services.length}`);
console.log(`  Compose 网络数: ${composeResult.networks.length}`);
console.log(`  Compose 卷数量: ${composeResult.volumes.length}`);
console.log('✅ Docker Compose 解析器测试全部通过');

// ========================================================
// 4. Kubernetes 多文档清单与四层引力拓扑解析测试
// ========================================================
console.log('--- 测试 4: Kubernetes 多文档清单切分与四层引力拓扑解析 ---');

const sampleK8s = fs.readFileSync(path.join(rootDir, 'examples/k8s/microservices.yaml'), 'utf-8');
const k8sResult = parseK8sManifest(sampleK8s);

assert.strictEqual(k8sResult.resources.length, 7, '应切分出 7 个 K8s 资源清单文档');
assert.strictEqual(k8sResult.categoriesCount.network, 2, '网络类资源应有 2 个 (Ingress, Service)');
assert.strictEqual(k8sResult.categoriesCount.workload, 1, '工作负载资源应有 1 个 (Deployment)');
assert.strictEqual(k8sResult.categoriesCount.config, 2, '配置保密资源应有 2 个 (ConfigMap, Secret)');
assert.strictEqual(k8sResult.categoriesCount.storage, 1, '存储资源应有 1 个 (PVC)');

// 引力依赖连线断言
// Ingress -> Service -> Deployment
const ingressEdge = k8sResult.topology.edges.find((e) => e.relationType === 'route');
assert.ok(ingressEdge, '应存在 Ingress 到 Service 的路由连线');

const serviceEdge = k8sResult.topology.edges.find((e) => e.relationType === 'select');
assert.ok(serviceEdge, '应存在 Service 到 Deployment 的 LabelSelector 路由连线');

const mountEdge = k8sResult.topology.edges.find((e) => e.relationType === 'mount');
assert.ok(mountEdge, '应存在 Deployment 挂载 PVC / ConfigMap 的 mount 连线');

console.log(`  K8s 资源数量: ${k8sResult.resources.length}`);
console.log(`  K8s 拓扑连线数: ${k8sResult.topology.edges.length}`);
console.log(`  K8s 体检诊断项: ${k8sResult.diagnostics.length}`);
console.log('✅ Kubernetes 解析器与四层引力拓扑测试全部通过');

// ========================================================
// 5. 空值边界防御与容错降级测试
// ========================================================
console.log('--- 测试 5: 空输入与异常边界极端容错断言 ---');

// 5.1 Dockerfile 空内容
const emptyDocker = parseDockerfile('');
assert.strictEqual(emptyDocker.stages.length, 0);
assert.strictEqual(emptyDocker.allInstructions.length, 0);

// 5.2 Compose 空内容
const emptyCompose = parseComposeFile('');
assert.strictEqual(emptyCompose.services.length, 0);
assert.strictEqual(emptyCompose.networks.length, 0);

// 5.3 K8s 空内容
const emptyK8s = parseK8sManifest('');
assert.strictEqual(emptyK8s.resources.length, 0);
assert.strictEqual(emptyK8s.topology.nodes.length, 0);

// 5.4 嗅探器接收空/null 参数
assert.strictEqual(getDriverIdForFile(null), 'markdown');
assert.strictEqual(getDriverIdForFile(undefined), 'markdown');
assert.strictEqual(getDriverIdForFile({}), 'code');
assert.strictEqual(getDriverIdForFile({ name: '' }), 'code');

console.log('✅ 空输入与异常边界测试全部通过');

// ========================================================
// 6. 视图外壳与驱动三态切换及主题语义令牌静态断言
// ========================================================
console.log('--- 测试 6: 视图外壳与云原生驱动三态切换及系统主题令牌静态断言 ---');

const pluginDocViewSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/PluginDocumentView.tsx'), 'utf-8');
const dockerfileViewerSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/DockerfileViewer.tsx'), 'utf-8');
const composeViewerSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/ComposeViewer.tsx'), 'utf-8');
const k8sViewerSrc = fs.readFileSync(path.join(rootDir, 'src/features/viewers/components/drivers/K8sViewer.tsx'), 'utf-8');

// 6.1 三态模式切换断言 (非 Markdown 统一由驱动自身内置 Studio 工具条自包含掌控，外壳杜绝重复渲染)
assert.ok(!pluginDocViewSrc.includes("showViewModes"), 'PluginDocumentView (NonMarkdown) 不应冗余包含外层 showViewModes 胶囊 (防止与各驱动内部工具条出现两次重复)');
assert.ok(pluginDocViewSrc.includes("setViewMode"), 'MarkdownPluginView 仍应保留受控 viewMode 切换通道');

assert.ok(dockerfileViewerSrc.includes("setCurrentMode('preview')"), 'DockerfileViewer 应支持内部 preview 切换');
assert.ok(dockerfileViewerSrc.includes("setCurrentMode('split')"), 'DockerfileViewer 应支持内部 split 切换');
assert.ok(dockerfileViewerSrc.includes("setCurrentMode('source')"), 'DockerfileViewer 应支持内部 source 切换');

assert.ok(composeViewerSrc.includes("setCurrentMode('preview')"), 'ComposeViewer 应支持内部 preview 切换');
assert.ok(composeViewerSrc.includes("setCurrentMode('split')"), 'ComposeViewer 应支持内部 split 切换');
assert.ok(composeViewerSrc.includes("setCurrentMode('source')"), 'ComposeViewer 应支持内部 source 切换');

assert.ok(k8sViewerSrc.includes("setCurrentMode('preview')"), 'K8sViewer 应支持内部 preview 切换');
assert.ok(k8sViewerSrc.includes("setCurrentMode('split')"), 'K8sViewer 应支持内部 split 切换');
assert.ok(k8sViewerSrc.includes("setCurrentMode('source')"), 'K8sViewer 应支持内部 source 切换');

// 6.2 主题设计令牌断言 (--ov-*)
const requiredTokens = ['--ov-bg', '--ov-surface', '--ov-surface-header', '--ov-border', '--ov-text'];
for (const token of requiredTokens) {
  assert.ok(dockerfileViewerSrc.includes(token), `DockerfileViewer 必须依托设计令牌: ${token}`);
  assert.ok(composeViewerSrc.includes(token), `ComposeViewer 必须依托设计令牌: ${token}`);
  assert.ok(k8sViewerSrc.includes(token), `K8sViewer 必须依托设计令牌: ${token}`);
}

console.log('✅ 视图三态切换与主题令牌校验全部通过');

console.log('\n🎉 所有云原生驱动自动化单元测试 100% 成功！');

