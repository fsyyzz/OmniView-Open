/**
 * OmniView — 统一 TSX / TypeScript 模块测试加载器 (Module Loader)
 *
 * 封装 esbuild 快速将 TSX/TS 组件与模块编译为可在无头 Node 环境动态导入的 ESM Bundle，
 * 并集中管理临时产物生命周期，进程退出时自动清空。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT_DIR = process.cwd();
const CACHE_DIR = path.resolve(ROOT_DIR, 'node_modules', '.tmp-test-bundles');

// 注册退出自动清理
let cleanupRegistered = false;
function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const clean = () => {
    try {
      if (fs.existsSync(CACHE_DIR)) {
        fs.rmSync(CACHE_DIR, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理异常
    }
  };
  process.on('exit', clean);
  process.on('SIGINT', () => { clean(); process.exit(130); });
}

/**
 * 编译并导入 TSX / TS 模块
 *
 * @param {string} contents 导出代码片段，例如：
 *   export { LightboxModal } from './src/features/viewers/components/common/LightboxModal.tsx';
 * @param {object} [options] 自定义构建参数
 * @returns {Promise<any>} 导出的模块对象
 */
export async function bundleAndLoadTsx(contents, options = {}) {
  registerCleanup();
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const bundlePath = path.join(CACHE_DIR, `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mjs`);

  try {
    await build({
      stdin: {
        contents,
        resolveDir: ROOT_DIR,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: bundlePath,
      jsx: 'automatic',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.css': 'empty',
      },
      external: options.external ?? ['happy-dom', '@hpcc-js/wasm-graphviz'],
      plugins: [
        {
          name: 'vite-query-stub',
          setup(b) {
            b.onResolve({ filter: /\?(url|raw)$/ }, args => ({
              path: args.path,
              namespace: 'vite-query-stub-ns',
            }));
            b.onLoad({ filter: /.*/, namespace: 'vite-query-stub-ns' }, () => ({
              contents: 'export default "stub-asset-url";',
              loader: 'js',
            }));
          },
        },
        ...(options.esbuildOptions?.plugins ?? []),
      ],
      ...options.esbuildOptions,
    });

    const fileUrl = pathToFileURL(bundlePath).href + `?t=${Date.now()}`;
    const module = await import(fileUrl);
    return module;
  } finally {
    // 延迟尝试删除单次产物
    setTimeout(() => {
      try {
        if (fs.existsSync(bundlePath)) {
          fs.unlinkSync(bundlePath);
        }
      } catch {
        // 允许进程退出时总清理
      }
    }, 500);
  }
}
