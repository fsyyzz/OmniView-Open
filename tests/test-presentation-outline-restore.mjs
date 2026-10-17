/**
 * 投屏进出后大纲可再切换：退出演示必须还原进入前的 focusMode
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(process.cwd(), 'src/features/viewers/PluginDocumentView.tsx'),
  'utf8'
);

assert.match(
  src,
  /focusModeBeforePresentationRef/,
  '进入投屏前必须缓存 focusMode'
);
assert.match(
  src,
  /focusModeBeforePresentationRef\.current\s*=\s*current/,
  '进入投屏时必须记录当前 focusMode'
);
assert.match(
  src,
  /setFocusMode\(focusModeBeforePresentationRef\.current\)/,
  '退出投屏（按钮/Esc）必须还原 focusMode，否则大纲因 !focusMode 永久隐藏'
);
assert.match(
  src,
  /outlineOpen\s*&&\s*!focusMode\s*&&\s*!presentationMode/,
  '大纲挂载条件仍依赖 !focusMode && !presentationMode'
);

console.log('test-presentation-outline-restore: OK');
