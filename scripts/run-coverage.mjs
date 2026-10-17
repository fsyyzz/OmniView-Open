#!/usr/bin/env node
/**
 * OmniView — 自动化测试代码覆盖率收集与度量运行器 (建议 C 落地)
 *
 * 基于 Node.js 原生 V8 引擎覆盖率与 c8 报表生成器：
 * 1. 自动利用 esbuild inline sourcemap 将执行流精确回溯至 TypeScript / TSX 源码
 * 2. 多核并发收集覆盖率数据 (PID 隔离无锁落盘)
 * 3. 产出终端文本表格摘要、LCOV (CI 集成) 及 HTML 交互式可视化报告 (coverage/index.html)
 *
 * 用法：
 *   node scripts/run-coverage.mjs               # 运行全量测试并生成报告
 *   node scripts/run-coverage.mjs focal-zoom     # 单独度量特定套件覆盖率
 *   node scripts/run-coverage.mjs --check        # 包含门禁阈值校验
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const COVERAGE_DIR = path.join(ROOT_DIR, 'coverage');
const TMP_DIR = path.join(ROOT_DIR, '.coverage-tmp');
const V8_TMP_DIR = path.join(TMP_DIR, 'v8');

// 读取命令行参数
const argv = process.argv.slice(2);
const filterKeyword = argv.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
const isCheckThreshold = argv.includes('--check');

// 从 run-all-tests.mjs 动态载入测试套件清单
const runnerFile = path.join(__dirname, 'run-all-tests.mjs');
const runnerContent = fs.readFileSync(runnerFile, 'utf-8');
const manifestMatch = runnerContent.match(/const TEST_MANIFEST = (\[[\s\S]*?\]);/);
let manifest = [];
if (manifestMatch) {
  try {
    manifest = eval(manifestMatch[1]);
  } catch (e) {
    console.error('⚠️ 解析 TEST_MANIFEST 失败，使用内置备选:', e.message);
  }
}

// 目标过滤
const targetSuites = filterKeyword
  ? manifest.filter((item) => item.file.toLowerCase().includes(filterKeyword))
  : manifest;

if (targetSuites.length === 0) {
  console.error(`❌ 未找到匹配 "${filterKeyword}" 的测试套件`);
  process.exit(1);
}

// 准备临时工作区与环境配置
if (fs.existsSync(TMP_DIR)) {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(V8_TMP_DIR, { recursive: true });
fs.mkdirSync(COVERAGE_DIR, { recursive: true });

process.env.NODE_V8_COVERAGE = V8_TMP_DIR;

console.log('\n📈 OmniView 代码覆盖率度量分析引擎 (Coverage Runner)');
console.log(`📌 目标套件数: ${targetSuites.length} | 覆盖率临时目录: .coverage-tmp/v8`);
if (filterKeyword) {
  console.log(`🔍 过滤关键词: "${filterKeyword}"`);
}
console.log('------------------------------------------------------------\n');

const BUNDLES_DIR = path.join(TMP_DIR, 'bundles');
fs.mkdirSync(BUNDLES_DIR, { recursive: true });

/**
 * 编译并执行单个测试套件
 */
async function executeSuite(item, itemIndex) {
  const startTime = Date.now();
  const filePath = path.join(ROOT_DIR, 'scripts', item.file);

  let targetExecPath = filePath;

  if (item.mode !== 'node') {
    // 通过 esbuild 打包至临时文件，内联完整 source map 以便 c8 精准反查 TS/TSX 源码
    // 注意：文件名不能包含 "test"，以防被 c8 默认规则作为测试脚手架忽略
    const bundleFile = path.join(BUNDLES_DIR, `suite_${String(itemIndex).padStart(3, '0')}.cjs`);
    const esbuildArgs = {
      entryPoints: [filePath],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      sourcemap: 'inline',
      sourcesContent: true,
      outfile: bundleFile,
    };

    if (item.external && Array.isArray(item.external)) {
      esbuildArgs.external = item.external;
    }

    await build(esbuildArgs);
    targetExecPath = bundleFile;
  }

  // 执行 Node 进程
  const res = await new Promise((resolve) => {
    const child = spawn(process.execPath, [targetExecPath], {
      cwd: ROOT_DIR,
      env: { ...process.env, NODE_V8_COVERAGE: V8_TMP_DIR },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, duration: Date.now() - startTime });
    });
    child.on('error', (err) => {
      resolve({ code: 1, stdout: '', stderr: err.message, duration: Date.now() - startTime });
    });
  });

  return { file: item.file, ok: res.code === 0, ...res };
}

/**
 * 并发工作池
 */
async function runWithPool(items, concurrency = 4) {
  const results = [];
  let index = 0;
  let running = 0;

  return new Promise((resolve) => {
    function dispatch() {
      while (running < concurrency && index < items.length) {
        const currentIndex = index++;
        const item = items[currentIndex];
        running++;
        executeSuite(item, currentIndex).then((res) => {
          results.push(res);
          running--;
          const icon = res.ok ? '✅' : '❌';
          const dur = (res.duration / 1000).toFixed(2) + 's';
          console.log(`  ${icon} [${results.length}/${items.length}] ${res.file} (${dur})`);
          if (!res.ok) {
            console.error(`     ⚠️ 失败信息: ${res.stderr.trim().split('\n')[0]}`);
          }
          if (results.length === items.length) {
            resolve(results);
          } else {
            dispatch();
          }
        });
      }
    }
    dispatch();
  });
}

const concurrency = Math.min(Math.max(os.cpus().length - 1, 2), 6);
const totalStartTime = Date.now();
const testResults = await runWithPool(targetSuites, concurrency);
const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(2);

const failures = testResults.filter((r) => !r.ok);
console.log(`\n⏱️ 测试执行完毕，总耗时: ${totalTime}s | 通过: ${testResults.length - failures.length} | 失败: ${failures.length}\n`);

if (failures.length > 0) {
  console.error('❌ 存在未通过的测试套件，中止覆盖率报表生成。');
  cleanTmp();
  process.exit(1);
}

// 汇总 c8 报告
console.log('📊 正在聚合 V8 覆盖率数据并生成报表...\n');

const c8Args = [
  'c8',
  'report',
  `--temp-directory=${V8_TMP_DIR}`,
  `--reports-dir=${COVERAGE_DIR}`,
  '--exclude=scripts/**',
  '--exclude-after-remap',
  '--reporter=text',
  '--reporter=lcov',
  '--reporter=html',
];

if (isCheckThreshold) {
  c8Args.push('--check-coverage', '--lines=70');
}

const c8Proc = spawn('npx', c8Args, {
  cwd: ROOT_DIR,
  stdio: 'inherit',
});

c8Proc.on('close', (code) => {
  cleanTmp();
  if (code === 0) {
    console.log(`\n✨ 覆盖率分析报告已生成:`);
    console.log(`  📄 LCOV 契约: file://${path.join(COVERAGE_DIR, 'lcov.info')}`);
    console.log(`  🌐 HTML 报告: file://${path.join(COVERAGE_DIR, 'index.html')}\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ c8 报告生成失败 (退出码: ${code})`);
    process.exit(code);
  }
});

function cleanTmp() {
  try {
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
  } catch {}
}
