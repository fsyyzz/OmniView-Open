/**
 * 分屏编辑写回契约：Host 必须处理 save-content/document-change，Webview 必须发 IPC
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const extension = read('src/extension/extension.ts');
const pluginView = read('src/features/viewers/PluginDocumentView.tsx');
const codeViewer = read('src/features/viewers/components/drivers/CodeViewer.tsx');

assert.match(extension, /persistWebviewContent/, 'Host 必须实现 persistWebviewContent');
assert.match(extension, /message\?\.type === 'document-change'/, 'Host 必须监听 document-change');
assert.match(extension, /message\.type === 'save-content'/, 'Host 必须监听 save-content');
assert.match(extension, /isWritingFromWebview/, '写回时必须屏蔽磁盘回声重载');
assert.match(extension, /type: 'content-saved'/, '写回后必须回传 content-saved');
assert.match(
  extension,
  /WorkspaceEdit|workspace\.fs\.writeFile|writeFile\(/,
  'Host 必须具备磁盘写回能力'
);

assert.match(pluginView, /type: 'document-change'/, 'PluginDocumentView 必须发送 document-change');
assert.match(
  pluginView,
  /persistContent[\s\S]*document-change/s,
  '非 Markdown 文档也必须走 persistContent 写回 IPC'
);

assert.match(codeViewer, /type: 'save-content'/, 'CodeViewer 显式保存必须发送 save-content');
assert.match(codeViewer, /content-saved/, 'CodeViewer 必须等待 content-saved 再标记已保存');

console.log('test-webview-save-writeback: OK');
