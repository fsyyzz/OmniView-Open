#!/usr/bin/env node
/**
 * 结构化数据多态视图与跨格式互转单元测试
 */
import assert from 'node:assert';
import {
  parseStructuredData,
  convertStructuredData,
  detectArrayOfObjects,
  objectToMarkmapMarkdown,
  detectDockerComposeTopology,
  isSensitiveKey,
  maskSensitiveValue,
} from '../src/features/viewers/components/drivers/data/structuredDataUtils.ts';

console.log('🧪 开始结构化数据 (JSON/YAML/TOML/XML) 解析与多态可视化单元测试...');

// 1. JSON 解析与容错
console.log('--- 测试 1: JSON 解析 ---');
const sampleJson = '{"app": "OmniView", "version": "0.1.0", "active": true, "ports": [3000, 8080]}';
const jsonRes = parseStructuredData(sampleJson, 'json');
assert.strictEqual(jsonRes.success, true);
assert.strictEqual(jsonRes.data.app, 'OmniView');
assert.strictEqual(jsonRes.data.ports[0], 3000);
console.log('✅ JSON 解析测试通过');

// 2. YAML 解析
console.log('--- 测试 2: YAML 解析 ---');
const sampleYaml = `
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - api
  api:
    image: node:20
    environment:
      - PORT=3000
`;
const yamlRes = parseStructuredData(sampleYaml, 'yaml');
assert.strictEqual(yamlRes.success, true);
assert.strictEqual(yamlRes.data.services.web.image, 'nginx:alpine');
assert.strictEqual(yamlRes.data.services.web.depends_on[0], 'api');
console.log('✅ YAML 解析测试通过');

// 3. TOML 解析
console.log('--- 测试 3: TOML 解析 ---');
const sampleToml = `
[package]
name = "omniview-core"
version = "1.0.0"
rust-edition = "2024"

[dependencies]
serde = "1.0"
tokio = "1.28"
`;
const tomlRes = parseStructuredData(sampleToml, 'toml');
assert.strictEqual(tomlRes.success, true);
assert.strictEqual(tomlRes.data.package.name, 'omniview-core');
assert.strictEqual(tomlRes.data.dependencies.tokio, '1.28');
console.log('✅ TOML 解析测试通过');

// 4. 跨格式互转 (JSON ⇄ YAML ⇄ TOML ⇄ XML)
console.log('--- 测试 4: 跨格式实时互转 ---');
const rawData = {
  server: {
    host: '0.0.0.0',
    port: 3000,
    secure: true,
  },
};
const convertedYaml = convertStructuredData(rawData, 'yaml');
assert.match(convertedYaml, /host: 0\.0\.0\.0/);
assert.match(convertedYaml, /port: 3000/);

const convertedJson = convertStructuredData(rawData, 'json');
assert.match(convertedJson, /"port": 3000/);

const convertedXml = convertStructuredData(rawData, 'xml');
assert.match(convertedXml, /<host>0\.0\.0\.0<\/host>/);
console.log('✅ 跨格式互转测试通过');

// 5. 数组对象下钻探测 (Table 视图激活)
console.log('--- 测试 5: 数组对象探测 (Table 投影) ---');
const dataWithList = {
  cluster: 'us-east-1',
  services: [
    { name: 'auth-service', instances: 4, latency: 12.5 },
    { name: 'payment-service', instances: 2, latency: 45.0 },
    { name: 'search-service', instances: 8, latency: 8.2 },
  ],
};
const detectResult = detectArrayOfObjects(dataWithList);
assert.strictEqual(detectResult.detected, true);
assert.strictEqual(detectResult.path, '$.services');
assert.strictEqual(detectResult.rows.length, 3);
assert.ok(detectResult.headers.includes('name'));
assert.ok(detectResult.headers.includes('latency'));
console.log('✅ 数组对象探测测试通过');

// 6. 思维导图 Markmap 投影
console.log('--- 测试 6: 思维导图 Markmap 大纲生成 ---');
const markmapMd = objectToMarkmapMarkdown(rawData, 'ServerConfig');
assert.match(markmapMd, /# ServerConfig/);
assert.match(markmapMd, /- \*\*host\*\*: `0\.0\.0\.0`/);
console.log('✅ 思维导图大纲投影测试通过');

// 7. Docker Compose 拓扑生成
console.log('--- 测试 7: Docker Compose 服务依赖拓扑 ---');
const topologyMermaid = detectDockerComposeTopology(yamlRes.data);
assert.ok(topologyMermaid !== null);
assert.match(topologyMermaid, /graph TD/);
assert.match(topologyMermaid, /web -->\|depends_on\| api/);
console.log('✅ Docker 拓扑图生成测试通过');

// 8. 敏感密钥识别与脱敏
console.log('--- 测试 8: 敏感密钥检测与脱敏 ---');
assert.strictEqual(isSensitiveKey('DB_PASSWORD'), true);
assert.strictEqual(isSensitiveKey('jwt_token'), true);
assert.strictEqual(isSensitiveKey('STRIPE_SECRET_KEY'), true);
assert.strictEqual(isSensitiveKey('port'), false);
assert.strictEqual(isSensitiveKey('service_name'), false);
assert.strictEqual(maskSensitiveValue('super_secret_12345'), '●●●●●●●●●●●●●●●●');
console.log('✅ 敏感脱敏识别测试通过');

console.log('🎉 全部 8 组结构化数据工具链测试用例 100% 通过！\n');
