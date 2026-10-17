/**
 * LazyViewportBlock 契约冒烟：可打包且导出为 React 组件（含 memo）。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync } from 'node:fs';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const { build } = await import('esbuild');
  const outfile = join(root, 'tmp-lazy-viewport-test.cjs');
  await build({
    entryPoints: [join(root, 'src/features/viewers/components/drivers/markdown/LazyViewportBlock.tsx')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    external: ['react', 'react/jsx-runtime'],
  });
  try {
    const mod = require(outfile);
    const Comp = mod.LazyViewportBlock;
    assert.ok(Comp, 'LazyViewportBlock 应存在');
    assert.ok(
      typeof Comp === 'function' || (typeof Comp === 'object' && Comp !== null && '$$typeof' in Comp),
      'LazyViewportBlock 应为函数组件或 memo 组件'
    );
    console.log('✅ LazyViewportBlock 导出契约通过');
  } finally {
    try {
      unlinkSync(outfile);
    } catch {
      /* ignore */
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
