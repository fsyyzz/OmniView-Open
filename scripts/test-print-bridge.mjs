/**
 * printBridge 纯函数契约测试：文件名清理与自动打印脚本注入
 */
import assert from 'node:assert/strict';
import {
  sanitizePrintFileName,
  injectAutoPrintScript,
  buildImagePrintHtml,
} from '../src/shared/lib/printBridge';

assert.equal(sanitizePrintFileName('demo.md'), 'demo.md');
assert.equal(sanitizePrintFileName('../../etc/passwd'), 'passwd');
assert.equal(sanitizePrintFileName('a/b\\c:d*.pdf'), 'c_d_.pdf');
assert.ok(sanitizePrintFileName('').length > 0);
assert.ok(sanitizePrintFileName('...').length > 0);

const withBody = injectAutoPrintScript('<html><body><p>hi</p></body></html>');
assert.match(withBody, /window\.print/);
assert.match(withBody, /<\/body>/i);

const alreadyHasPrint = injectAutoPrintScript('<html><body><script>window.print()</script></body></html>');
assert.equal((alreadyHasPrint.match(/window\.print/g) || []).length, 1);

const imageHtml = buildImagePrintHtml('page-1', 'data:image/png;base64,abc');
assert.match(imageHtml, /data:image\/png;base64,abc/);
assert.match(imageHtml, /page-1/);

console.log('test-print-bridge: OK');
