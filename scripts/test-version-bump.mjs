#!/usr/bin/env node
/**
 * AI-SE 版本自动化与自增管理单元测试套件
 * 
 * 验证目标:
 * 1. 语义化版本号 (SemVer) 解析与边界处理
 * 2. patch / minor / major 递增逻辑
 * 3. 未显式更新时自动递增 patch 小版本
 * 4. 显式更新时跳过自动递增，保持人工设定
 * 5. dry-run 与 check 模式安全性验证
 */

import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSemVer,
  bumpVersionString,
  runVersionBump,
} from './bump-version.mjs';

console.log('🧪 开始 AI-SE 自动化版本号管理单元测试...');

// 测试 1: 语义化版本号解析 (SemVer Parsing)
console.log('--- 测试 1: SemVer 版本号解析 ---');
const v1 = parseSemVer('1.0.0');
assert.strictEqual(v1.major, 1);
assert.strictEqual(v1.minor, 0);
assert.strictEqual(v1.patch, 0);

const v2 = parseSemVer('v0.12.4');
assert.strictEqual(v2.major, 0);
assert.strictEqual(v2.minor, 12);
assert.strictEqual(v2.patch, 4);

const v3 = parseSemVer('2.3.4-beta.1');
assert.strictEqual(v3.major, 2);
assert.strictEqual(v3.minor, 3);
assert.strictEqual(v3.patch, 4);
assert.strictEqual(v3.prerelease, 'beta.1');

assert.throws(() => parseSemVer('invalid-version'), /无法解析的语义化版本格式/);
console.log('✅ SemVer 版本号解析与异常拦截测试通过');

// 测试 2: 维度版本号自增 (Bump String Calculation)
console.log('--- 测试 2: patch / minor / major 维度递增 ---');
assert.strictEqual(bumpVersionString('1.0.0', 'patch'), '1.0.1');
assert.strictEqual(bumpVersionString('1.0.9', 'patch'), '1.0.10');
assert.strictEqual(bumpVersionString('1.0.0', 'minor'), '1.1.0');
assert.strictEqual(bumpVersionString('1.2.3', 'major'), '2.0.0');
console.log('✅ 维度版本号递增测试全部通过');

// 测试 3: 沙箱环境下未显式更新自动自增小版本
console.log('--- 测试 3: 沙箱环境未显式更新时自动自增 Patch ---');
const tempDir = mkdtempSync(join(tmpdir(), 'omniview-version-test-'));
try {
  const initialPkg = {
    name: 'omniview-test',
    version: '1.2.0',
    description: 'Test Package',
  };
  const pkgPath = join(tempDir, 'package.json');
  writeFileSync(pkgPath, JSON.stringify(initialPkg, null, 2) + '\n', 'utf8');

  // 执行自动自增
  const res = runVersionBump({
    rootDir: tempDir,
    autoStage: false,
  });

  assert.strictEqual(res.updated, true);
  assert.strictEqual(res.currentVersion, '1.2.0');
  assert.strictEqual(res.newVersion, '1.2.1');

  // 验证写入落盘内容
  const savedPkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.strictEqual(savedPkg.version, '1.2.1');
  assert.strictEqual(savedPkg.name, 'omniview-test');
  console.log('✅ 未显式更新时自动递增小版本落盘验证通过: 1.2.0 -> 1.2.1');

  // 测试 4: dry-run 模式不修改物理文件
  console.log('--- 测试 4: dry-run 模式安全保证 ---');
  const dryRes = runVersionBump({
    rootDir: tempDir,
    dryRun: true,
    autoStage: false,
  });
  assert.strictEqual(dryRes.dryRun, true);
  assert.strictEqual(dryRes.newVersion, '1.2.2');
  const afterDryPkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.strictEqual(afterDryPkg.version, '1.2.1', 'dry-run 绝不能更改文件内容');
  console.log('✅ dry-run 安全模式测试通过');

  // 测试 5: check 模式只读检查
  console.log('--- 测试 5: check 模式检查 ---');
  const checkRes = runVersionBump({
    rootDir: tempDir,
    checkOnly: true,
    autoStage: false,
  });
  assert.strictEqual(checkRes.currentVersion, '1.2.1');
  console.log('✅ check 模式检查测试通过');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('🎉 全部 5 组 AI-SE 版本自动化与自增单元测试 100% 通过！\n');
