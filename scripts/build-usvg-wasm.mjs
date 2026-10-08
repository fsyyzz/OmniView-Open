// @ts-nocheck -- 纯 Node 脚本，绕过 TypeScript 类型检查（项目 tsconfig include=scripts）
// OmniView usvg-wasm 自编译构建脚本 (ADR-0001 §10)
//
// 用法：
//   node scripts/build-usvg-wasm.mjs           # 默认 release 模式
//   node scripts/build-usvg-wasm.mjs --debug   # debug 模式（更大更快）
//   node scripts/build-usvg-wasm.mjs --check   # 仅检查 toolchain，不构建
//
// 前置：
//   - Rust ≥ 1.75
//   - rustup target add wasm32-unknown-unknown
//   - cargo install wasm-pack
//
// 输出：
//   public/usvg-wasm/
//   ├── usvg_wasm.js
//   ├── usvg_wasm_bg.wasm
//   ├── usvg_wasm.d.ts
//   └── package.json

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RUST_CRATE_DIR = join(ROOT, 'rust', 'usvg-wasm');
const OUT_DIR = join(ROOT, 'public', 'usvg-wasm');
const TARGET = 'web';
const MODE = process.argv.includes('--debug') ? 'debug' : 'release';
const CHECK_ONLY = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function log(level, ...args) {
  const tag = { info: '[usvg-wasm]', warn: '[usvg-wasm WARN]', err: '[usvg-wasm ERR]' }[level] || '[usvg-wasm]';
  console.log(tag, ...args);
}

function which(bin) {
  const r = spawnSync('which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function checkToolchain() {
  const cargo = which('cargo');
  const rustc = which('rustc');
  const wasmPack = which('wasm-pack');
  const target = rustc
    ? spawnSync('rustup', ['target', 'list', '--installed'], { encoding: 'utf8' }).stdout || ''
    : '';
  const hasWasmTarget = target.includes('wasm32-unknown-unknown');

  return {
    cargo,
    rustc,
    wasmPack,
    hasWasmTarget,
    ok: !!(cargo && rustc && wasmPack && hasWasmTarget),
  };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  const tc = checkToolchain();

  log('info', `Rust:        ${tc.rustc || '(not found)'}`);
  log('info', `Cargo:       ${tc.cargo || '(not found)'}`);
  log('info', `wasm-pack:   ${tc.wasmPack || '(not found)'}`);
  log('info', `wasm32 tgt:  ${tc.hasWasmTarget ? 'yes' : 'no'}`);

  if (!tc.ok) {
    log('warn', 'Rust toolchain 不完整，自编译 usvg-wasm 跳过。');
    log('warn', '运行时 SvgWasmBridge 将自动回退到 fallbackDomParse（DOMParser）。');
    log('warn', '如需启用 usvg-wasm，请安装：');
    log('warn', '  1. https://rustup.rs  (Rust ≥ 1.75)');
    log('warn', '  2. rustup target add wasm32-unknown-unknown');
    log('warn', '  3. cargo install wasm-pack');
    process.exit(0); // 不阻断构建，让回退路径接管
  }

  if (CHECK_ONLY) {
    log('info', '--check：toolchain 已就绪，build skipped.');
    process.exit(0);
  }

  if (!existsSync(RUST_CRATE_DIR)) {
    log('err', `Rust crate 目录缺失: ${RUST_CRATE_DIR}`);
    process.exit(1);
  }

  log('info', `清理旧产物: ${OUT_DIR}`);
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const profileFlag = MODE === 'release' ? '--release' : '--dev';
  const cmd = [
    'wasm-pack',
    'build',
    '--target', TARGET,
    profileFlag,
    '--out-dir', OUT_DIR,
  ];

  log('info', `执行: ${cmd.join(' ')}  (cwd=${RUST_CRATE_DIR})`);

  const r = spawnSync(cmd[0], cmd.slice(1), {
    cwd: RUST_CRATE_DIR,
    stdio: 'inherit',
    env: { ...process.env, RUSTFLAGS: '-C strip=symbols' },
  });

  if (r.status !== 0) {
    log('err', `wasm-pack 退出码 ${r.status}`);
    process.exit(r.status ?? 1);
  }

  // wasm-pack 会写自己的 pkg/.gitignore + 复制 README，我们不需要。
  const garbage = ['.gitignore', 'README.md', 'README'];
  for (const f of garbage) {
    const p = join(OUT_DIR, f);
    if (existsSync(p)) {
      try { rmSync(p); } catch { /* ignore */ }
    }
  }

  log('info', `✅ usvg-wasm 产物落地: ${OUT_DIR}`);
  log('info', '提示：CI 中请缓存 target/ 与 OUT_DIR，避免每次重建。');
}

main();