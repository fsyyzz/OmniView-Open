import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

console.log('🧪 开始 GitHub Actions 自动滚动清理 (Release / Tag / Artifact / Workflow Runs) 单元测试...');

const workflowsDir = path.resolve(process.cwd(), '.github/workflows');
const releaseYmlPath = path.join(workflowsDir, 'release.yml');
const ciYmlPath = path.join(workflowsDir, 'ci.yml');
const syncYmlPath = path.join(workflowsDir, 'sync-to-oss.yml');

// 1. 验证 YAML 语法合法性
console.log('--- 测试 1: 工作流 YAML 语法解析 ---');
const releaseConfig = yaml.load(fs.readFileSync(releaseYmlPath, 'utf-8'));
const ciConfig = yaml.load(fs.readFileSync(ciYmlPath, 'utf-8'));
const syncConfig = yaml.load(fs.readFileSync(syncYmlPath, 'utf-8'));

assert.ok(releaseConfig && typeof releaseConfig === 'object', 'release.yml 必须为合法 YAML 对象');
assert.ok(ciConfig && typeof ciConfig === 'object', 'ci.yml 必须为合法 YAML 对象');
assert.ok(syncConfig && typeof syncConfig === 'object', 'sync-to-oss.yml 必须为合法 YAML 对象');
console.log('✅ 3 个 GitHub Actions 工作流 YAML 语法全部解析通过');

// 2. 验证 release.yml 滚动清理与权限配置
console.log('--- 测试 2: release.yml 权限、Artifact 1天过期与滚动清理 Job ---');
assert.strictEqual(releaseConfig.permissions?.contents, 'write', 'release.yml 必须具备 contents: write 权限');
assert.strictEqual(releaseConfig.permissions?.actions, 'write', 'release.yml 必须具备 actions: write 权限以清理 Artifacts 与 Runs');
assert.strictEqual(releaseConfig.env?.DEFAULT_KEEP_RELEASES, '5', '默认保留最新 5 个 Release');
assert.strictEqual(releaseConfig.env?.DEFAULT_KEEP_RUNS, '10', '默认保留最新 10 条运行记录');

const buildUploadStep = releaseConfig.jobs?.build?.steps?.find((s) => s.uses?.startsWith('actions/upload-artifact'));
assert.ok(buildUploadStep, 'release.yml build job 必须包含 upload-artifact 步骤');
assert.strictEqual(buildUploadStep.with?.['retention-days'], 1, 'release.yml 中转 Artifact 保留天数必须收敛为 1 天');

const cleanupJob = releaseConfig.jobs?.cleanup;
assert.ok(cleanupJob, 'release.yml 必须包含 cleanup 滚动清理 Job');
assert.deepStrictEqual(cleanupJob.needs, ['build', 'publish-marketplace'], 'cleanup Job 必须在 build 与 publish-marketplace 之后执行');
assert.ok(cleanupJob.if?.includes("needs.build.result == 'success'"), 'cleanup Job 在 build 成功且 publish 跳过时仍应正常执行');
console.log('✅ release.yml 滚动清理 Job 与生命周期校验通过');

// 3. 验证 ci.yml Artifact 瘦身与滚动清理步骤
console.log('--- 测试 3: ci.yml 1天保留与历史构建产物清理 ---');
assert.strictEqual(ciConfig.permissions?.actions, 'write', 'ci.yml 必须具备 actions: write 权限');
const ciUploadStep = ciConfig.jobs?.verify?.steps?.find((s) => s.uses?.startsWith('actions/upload-artifact'));
assert.strictEqual(ciUploadStep?.with?.['retention-days'], 1, 'ci.yml Artifact 保留天数必须收敛为 1 天');

const ciCleanupStep = ciConfig.jobs?.verify?.steps?.find((s) => s.name?.includes('cleanup'));
assert.ok(ciCleanupStep, 'ci.yml 必须包含滚动清理步骤');
console.log('✅ ci.yml 清理配置校验通过');

// 4. 验证 sync-to-oss.yml 双仓滚动治理步骤
console.log('--- 测试 4: sync-to-oss.yml 主仓与开源仓双端滚动清理 ---');
assert.strictEqual(syncConfig.permissions?.contents, 'write', 'sync-to-oss.yml 必须声明 contents: write');
assert.strictEqual(syncConfig.permissions?.actions, 'write', 'sync-to-oss.yml 必须声明 actions: write');
const syncPushStep = syncConfig.jobs?.['sync-to-oss']?.steps?.find((s) => s.name?.includes('推送至独立开源仓库'));
assert.ok(syncPushStep, 'sync-to-oss.yml 必须包含推送至独立开源仓库步骤');
assert.ok(
  syncPushStep.run?.includes('git checkout FETCH_HEAD -- .github/workflows'),
  'sync-to-oss.yml 必须在 PAT 缺少 workflow 权限时支持自动回退 .github/workflows 降级推送'
);

const syncCleanupStep = syncConfig.jobs?.['sync-to-oss']?.steps?.find((s) => s.name?.includes('滚动清理'));
assert.ok(syncCleanupStep, 'sync-to-oss.yml 必须包含主仓与开源仓滚动清理步骤');
assert.ok(syncCleanupStep.run?.includes('fsyyzz/OmniView-Open'), '必须同步治理开源镜像仓 fsyyzz/OmniView-Open');
console.log('✅ sync-to-oss.yml 双仓滚动清理与 PAT 权限降级自愈校验通过');

console.log('🎉 GitHub Actions 自动滚动清理单元测试全部通过！');
