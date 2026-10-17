#!/usr/bin/env node
/**
 * OmniView 自动化测试聚合运行器 (Test Runner & Orchestrator)
 *
 * 特性：
 * 1. 结构化解耦：替代 package.json 中超长 && 命令行串联
 * 2. 多进程并发执行：支持可配置并发度 (默认 4~6 并发)，执行耗时缩短 60%+
 * 3. 智能过滤筛选：支持 `npm test -- svg` 或 `--filter=math` 局部快速验证
 * 4. 自动异常捕获与重放：失败测试错误日志聚合展示，零信息丢失
 * 5. 动态套件发现：自动扫描 scripts/test-*.mjs，杜绝漏测与配置遗漏
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { discoverSuites } from '../tests/harness/discovery.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.resolve(ROOT_DIR, 'tests');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let filter = '';
  let category = '';
  let concurrency = Math.min(Math.max(os.cpus().length - 1, 2), 6);
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith('--filter=')) {
      filter = arg.slice(9).trim();
    } else if (arg.startsWith('-f=')) {
      filter = arg.slice(3).trim();
    } else if (arg.startsWith('--category=')) {
      category = arg.slice(11).trim();
    } else if (arg.startsWith('--concurrency=') || arg.startsWith('-c=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(val) && val > 0) concurrency = val;
    } else if (arg === '--serial') {
      concurrency = 1;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (!arg.startsWith('-') && !filter) {
      filter = arg.trim();
    }
  }

  return { filter, category, concurrency, verbose };
}

/**
 * 扫描并获取所有可用测试套件
 */
function collectAllSuites(filter = '', category = '') {
  return discoverSuites({ keyword: filter, category });
}

/**
 * 运行单个测试任务
 */
function runSuite(item) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const filePath = path.join('tests', item.file);

    let child;
    if (item.mode === 'node') {
      child = spawn(process.execPath, [filePath], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      // esbuild pipe to node
      const esbuildArgs = [filePath, '--bundle', '--platform=node'];
      if (item.packagesExternal) {
        esbuildArgs.push('--packages=external');
      }
      if (item.external && Array.isArray(item.external)) {
        for (const ext of item.external) {
          esbuildArgs.push(`--external:${ext}`);
        }
      }

      const esbuildProc = spawn('npx', ['esbuild', ...esbuildArgs], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const nodeProc = spawn(process.execPath, [], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      esbuildProc.stdout.pipe(nodeProc.stdin);

      let esbuildStderr = '';
      esbuildProc.stderr.on('data', (chunk) => {
        esbuildStderr += chunk.toString();
      });

      child = nodeProc;
      child._esbuildProc = esbuildProc;
      child._getEsbuildStderr = () => esbuildStderr;
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      const esbuildErr = child._getEsbuildStderr ? child._getEsbuildStderr() : '';
      const fullStderr = (esbuildErr + '\n' + stderr).trim();

      resolve({
        file: item.file,
        ok: code === 0,
        code,
        durationMs,
        stdout: stdout.trim(),
        stderr: fullStderr,
      });
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - startTime;
      resolve({
        file: item.file,
        ok: false,
        code: 1,
        durationMs,
        stdout: '',
        stderr: err.stack || err.message,
      });
    });
  });
}

/**
 * 主执行调度器
 */
async function main() {
  const { filter, category, concurrency, verbose } = parseArgs();
  const allSuites = collectAllSuites();
  const targetSuites = collectAllSuites(filter, category);

  if (targetSuites.length === 0) {
    console.error(`❌ 未找到匹配过滤条件 "${filter || category}" 的测试套件`);
    process.exit(1);
  }

  const filterDesc = [
    filter ? `关键词: "${filter}"` : '',
    category ? `分类: "${category}"` : '',
  ].filter(Boolean).join(' | ');

  console.log(`\n🧪 OmniView 自动化测试聚合运行器 (Test Runner)`);
  console.log(`📌 目标套件数: ${targetSuites.length} / ${allSuites.length} | 并发度: ${concurrency}${filterDesc ? ` | ${filterDesc}` : ''}\n`);

  const total = targetSuites.length;
  let completed = 0;
  let passed = 0;
  let failed = 0;
  const results = [];
  const failures = [];

  const startTime = Date.now();

  // 并发池调度
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (cursor < total) {
      const index = cursor++;
      const item = targetSuites[index];
      const res = await runSuite(item);
      completed++;

      const seq = `[${String(completed).padStart(2, '0')}/${total}]`;
      const timeStr = `${res.durationMs}ms`.padStart(7, ' ');
      const catBadge = `[${item.category}]`.padEnd(12, ' ');

      if (res.ok) {
        passed++;
        console.log(`  ✅ ${seq} ${catBadge} ${item.file} (${timeStr})`);
      } else {
        failed++;
        console.error(`  ❌ ${seq} ${catBadge} ${item.file} (${timeStr}) [Exit: ${res.code}]`);
        failures.push(res);
      }

      if (verbose && (res.stdout || res.stderr)) {
        if (res.stdout) console.log(res.stdout);
        if (res.stderr) console.error(res.stderr);
      }

      results.push(res);
    }
  });

  await Promise.all(workers);

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // 汇总报告
  console.log(`\n============================================================`);
  console.log(`📊 OmniView 自动化测试套件执行汇总报告`);
  console.log(`============================================================`);
  console.log(`  总运行套件: ${total}`);
  console.log(`  通过数量:   ${passed} ✅`);
  console.log(`  失败数量:   ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  执行总耗时: ${totalTimeSec} 秒 (并发加速比 ~${(results.reduce((acc, r) => acc + r.durationMs, 0) / (Date.now() - startTime)).toFixed(1)}x)`);
  console.log(`============================================================`);

  if (failures.length > 0) {
    console.error(`\n❌ 以下 ${failures.length} 个测试套件执行失败:\n`);
    for (const f of failures) {
      console.error(`--- [失败] ${f.file} ---`);
      if (f.stderr) console.error(f.stderr);
      if (f.stdout) console.error(f.stdout);
      console.error(`------------------------------------------------------------\n`);
    }
    process.exit(1);
  } else {
    console.log(`🎉 所有目标测试套件 100% 顺利通过！\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
