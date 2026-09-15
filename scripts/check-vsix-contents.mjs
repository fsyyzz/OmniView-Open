#!/usr/bin/env node
/**
 * 打包后冒烟：确认 VSIX 内含 extension 入口与 webview 静态资源。
 * VSIX 是 ZIP，不能用 GNU tar -tf（Linux CI 会失败）。
 * 用法: node scripts/check-vsix-contents.mjs [path/to/omniview-x.y.z.vsix]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import JSZip from 'jszip';

function findLatestVsix(root) {
  const files = readdirSync(root)
    .filter((name) => /^omniview-.*\.vsix$/i.test(name))
    .map((name) => ({ name, mtime: statSync(join(root, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? join(root, files[0].name) : null;
}

async function listVsixEntries(vsixPath) {
  const zip = await JSZip.loadAsync(readFileSync(vsixPath));
  return Object.keys(zip.files)
    .map((name) => name.replace(/\\/g, '/').replace(/\/$/, ''))
    .filter(Boolean);
}

async function main() {
  const root = process.cwd();
  const vsixPath = process.argv[2] || findLatestVsix(root);
  if (!vsixPath || !existsSync(vsixPath)) {
    console.error('[check-vsix] 未找到 VSIX，请先运行 npm run package:vsix');
    process.exit(1);
  }

  let entries;
  try {
    entries = await listVsixEntries(vsixPath);
  } catch (error) {
    console.error('[check-vsix] 无法读取 VSIX 目录:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const required = ['extension/dist/extension.cjs', 'extension/dist/index.html'];
  const missing = required.filter((path) => !entries.includes(path));
  const hasAssets = entries.some((e) => e.startsWith('extension/dist/assets/') && /\.(js|css)$/i.test(e));

  console.log(`[check-vsix] 检查 ${basename(vsixPath)}（${entries.length} entries）`);
  if (missing.length || !hasAssets) {
    if (missing.length) console.error('[check-vsix] 缺失:', missing.join(', '));
    if (!hasAssets) console.error('[check-vsix] 缺失: extension/dist/assets/*.{js,css}');
    console.error('[check-vsix] FAIL — .vscodeignore 可能误排除了 webview 产物');
    process.exit(1);
  }
  console.log('[check-vsix] OK — extension.cjs + index.html + assets 已打入 VSIX');
}

main();
