#!/usr/bin/env node
/**
 * 语义化版本号自增与演进工具 (公开/开源构建工具链代理)
 * 
 * 本脚本作为公开脚本存放在 scripts/ 目录，确保在不包含 .codex 内部目录的环境（如干净的开源发布分支或 CI）下
 * 依然能够正常被测试套件与构建流水线调用。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGE_JSON_PATH = join(ROOT, 'package.json');

/**
 * 解析语义化版本字符串
 * 支持 x.y.z 以及带预发布标签的 x.y.z-alpha.1
 */
export function parseSemVer(versionStr) {
  if (typeof versionStr !== 'string') {
    throw new Error(`版本号必须是字符串，实际接收到: ${typeof versionStr}`);
  }
  const trimmed = versionStr.trim();
  const semverRegex = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
  const match = trimmed.match(semverRegex);
  if (!match) {
    throw new Error(`无法解析的语义化版本格式: "${versionStr}"`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || '',
    build: match[5] || '',
    raw: trimmed,
  };
}

/**
 * 递增版本号
 * @param {string} currentVersion - 当前版本号 (如 "1.0.0")
 * @param {'patch' | 'minor' | 'major'} type - 递增维度，默认为 'patch'
 * @returns {string} 递增后的版本号
 */
export function bumpVersionString(currentVersion, type = 'patch') {
  const parsed = parseSemVer(currentVersion);
  if (type === 'major') {
    return `${parsed.major + 1}.0.0`;
  }
  if (type === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  // 默认递增 patch
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

/**
 * 判断在 Git 工作区或暂存区中，package.json 的 version 字段是否已被显式修改
 * @param {string} rootDir - 仓库根目录
 * @returns {boolean} true 表示已显式修改，false 表示未修改
 */
export function isVersionExplicitlyUpdated(rootDir = ROOT) {
  try {
    const gitStatus = execSync('git rev-parse --is-inside-work-tree', {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();

    if (gitStatus !== 'true') return false;

    const diff = execSync('git diff HEAD package.json', {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf8',
    });

    const versionDiffRegex = /^\+\s*"version"\s*:\s*"([^"]+)"/m;
    return versionDiffRegex.test(diff);
  } catch {
    return false;
  }
}

/**
 * 执行版本检查与自动自增主逻辑
 */
export function runVersionBump(options = {}) {
  const {
    type = 'patch',
    force = false,
    checkOnly = false,
    dryRun = false,
    autoStage = true,
    rootDir = ROOT,
  } = options;

  const pkgPath = join(rootDir, 'package.json');
  const pkgContent = readFileSync(pkgPath, 'utf8');
  const pkgJson = JSON.parse(pkgContent);

  const currentVersion = pkgJson.version || '1.0.0';

  // 1. 检查是否已被显式修改
  const alreadyExplicitlyUpdated = isVersionExplicitlyUpdated(rootDir);

  if (checkOnly) {
    if (alreadyExplicitlyUpdated) {
      console.log(`✅ [Version Check] package.json 版本号已显式更新 (当前: v${currentVersion})`);
      return { updated: true, currentVersion, newVersion: currentVersion };
    }
    console.log(`ℹ️ [Version Check] package.json 版本号未显式更新 (当前: v${currentVersion})`);
    return { updated: false, currentVersion, newVersion: currentVersion };
  }

  // 2. 如果已显式修改且非强制指定，则跳过自动修改，尊重开发者的显式版本演进
  if (alreadyExplicitlyUpdated && !force) {
    console.log(`ℹ️ [Version Guard] 检测到已显式更新版本号至 v${currentVersion}，保持原样。`);
    return { updated: false, currentVersion, newVersion: currentVersion, skipped: true };
  }

  // 3. 计算新版本号
  const newVersion = bumpVersionString(currentVersion, type);

  if (dryRun) {
    console.log(`🔍 [Version Bump (Dry Run)] 版本将从 v${currentVersion} -> v${newVersion} (${type})`);
    return { updated: true, currentVersion, newVersion, dryRun: true };
  }

  // 4. 写回 package.json (保持标准 2 空格缩进与末尾换行符)
  pkgJson.version = newVersion;
  const updatedContent = JSON.stringify(pkgJson, null, 2) + '\n';
  writeFileSync(pkgPath, updatedContent, 'utf8');

  console.log(`🚀 [Version Auto-Bump] 未检测到显式版本更新，已自动将小版本号自增: v${currentVersion} -> v${newVersion}`);

  // 5. 自动同步到 git 暂存区 (若适用)
  if (autoStage) {
    try {
      execSync('git add package.json', { cwd: rootDir, stdio: 'ignore' });
      console.log(`📦 [Version Auto-Stage] 已将更新后的 package.json 自动加入 Git 暂存区。`);
    } catch {
      // 忽略非 git 仓库环境下的错误
    }
  }

  return { updated: true, currentVersion, newVersion };
}

// CLI 命令行入口
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  let type = 'patch';
  if (args.includes('--minor')) type = 'minor';
  if (args.includes('--major')) type = 'major';

  try {
    const result = runVersionBump({
      type,
      force,
      checkOnly,
      dryRun,
      autoStage: true,
    });
    if (checkOnly && !result.updated) {
      process.exit(0);
    }
  } catch (err) {
    console.error(`❌ [Version Auto-Bump] 执行失败: ${err.message}`);
    process.exit(1);
  }
}
