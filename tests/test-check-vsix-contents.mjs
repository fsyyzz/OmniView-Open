#!/usr/bin/env node
/**
 * check-vsix-contents.mjs 的 ZIP 读取契约：VSIX 是 ZIP，必须用 JSZip 而不是 GNU tar。
 */
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

console.log('🧪 开始 VSIX 内容检查脚本（ZIP/JSZip）单元测试...');

const dir = mkdtempSync(join(tmpdir(), 'ov-vsix-'));
const fakeVsix = join(dir, 'omniview-0.0.0-test.vsix');

async function buildFakeVsix() {
  const zip = new JSZip();
  zip.file('extension/dist/extension.cjs', 'module.exports={};');
  zip.file('extension/dist/index.html', '<html></html>');
  zip.file('extension/dist/assets/index.js', 'console.log(1);');
  zip.file('extension/dist/assets/index.css', 'body{}');
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  writeFileSync(fakeVsix, buf);
}

await buildFakeVsix();

const listed = spawnSync(process.execPath, ['scripts/check-vsix-contents.mjs', fakeVsix], {
  encoding: 'utf8',
});
assert.strictEqual(listed.status, 0, listed.stderr || listed.stdout);
assert.match(listed.stdout, /\[check-vsix\] OK/);
console.log('✅ JSZip 读取合法 VSIX/ZIP 通过');

const emptyZip = join(dir, 'empty.vsix');
const empty = new JSZip();
empty.file('readme.txt', 'no dist');
writeFileSync(emptyZip, await empty.generateAsync({ type: 'nodebuffer' }));
const failed = spawnSync(process.execPath, ['scripts/check-vsix-contents.mjs', emptyZip], {
  encoding: 'utf8',
});
assert.notStrictEqual(failed.status, 0);
assert.match(`${failed.stdout}\n${failed.stderr}`, /FAIL|缺失/);
console.log('✅ 缺失 webview 资源时正确失败');

rmSync(dir, { recursive: true, force: true });
console.log('🎉 VSIX 内容检查脚本测试全部通过');
