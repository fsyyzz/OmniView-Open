/**
 * 现代图像引擎与像素级分析工具集单元测试 (test-image-engine.mjs)
 * 验证色彩空间换算 (RGBA/HEX/HSLA)、GCD 纵横比提取、文件大小格式化与 EXIF 容错解析
 * 
 * 作者: 周赞
 */
import assert from 'node:assert/strict';
import {
  rgbaToHex,
  rgbaToHsla,
  gcd,
  formatAspectRatio,
  formatImageSize,
  parseExifFromBuffer,
} from '../src/features/viewers/lib/imageEngine.ts';

async function testColorConversions() {
  console.log('  [test] RGBA -> HEX 与 HSLA 色彩空间转换测试...');
  // 1. 白色
  assert.equal(rgbaToHex(255, 255, 255, 255), '#FFFFFF');
  assert.equal(rgbaToHsla(255, 255, 255, 255), 'hsla(0, 0%, 100%, 1)');

  // 2. 黑色
  assert.equal(rgbaToHex(0, 0, 0, 255), '#000000');
  assert.equal(rgbaToHsla(0, 0, 0, 255), 'hsla(0, 0%, 0%, 1)');

  // 3. 纯红
  assert.equal(rgbaToHex(255, 0, 0, 255), '#FF0000');
  assert.equal(rgbaToHsla(255, 0, 0, 255), 'hsla(0, 100%, 50%, 1)');

  // 4. 纯绿
  assert.equal(rgbaToHex(0, 255, 0, 255), '#00FF00');
  assert.equal(rgbaToHsla(0, 255, 0, 255), 'hsla(120, 100%, 50%, 1)');

  // 5. 半透明红
  assert.equal(rgbaToHex(255, 0, 0, 128), '#FF000080');
  console.log('  ✓ 色彩空间换算测试全部通过');
}

async function testGcdAndAspectRatio() {
  console.log('  [test] 纵横比 (Aspect Ratio) 与 GCD 计算测试...');
  assert.equal(gcd(1920, 1080), 120);
  assert.equal(gcd(800, 600), 200);
  assert.equal(gcd(1000, 1000), 1000);

  assert.equal(formatAspectRatio(1920, 1080), '16:9');
  assert.equal(formatAspectRatio(3840, 2160), '16:9');
  assert.equal(formatAspectRatio(800, 600), '4:3');
  assert.equal(formatAspectRatio(1024, 768), '4:3');
  assert.equal(formatAspectRatio(500, 500), '1:1');
  assert.equal(formatAspectRatio(2560, 1080), '21:9');
  console.log('  ✓ 纵横比与 GCD 计算通过');
}

async function testFormatImageSize() {
  console.log('  [test] 图像文件大小格式化测试...');
  assert.equal(formatImageSize(512), '512 B');
  assert.equal(formatImageSize(2048), '2.0 KB');
  assert.equal(formatImageSize(1024 * 1024 * 3.5), '3.50 MB');
  assert.equal(formatImageSize(0), '未知大小');
  console.log('  ✓ 图像大小格式化通过');
}

async function testExifParserResilience() {
  console.log('  [test] EXIF 容错解析测试...');
  // 空 Buffer
  const emptyBuf = new ArrayBuffer(0);
  const resEmpty = parseExifFromBuffer(emptyBuf);
  assert.deepEqual(resEmpty, {});

  // 非 JPEG 损坏 Buffer
  const dummyBuf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
  const resDummy = parseExifFromBuffer(dummyBuf);
  assert.deepEqual(resDummy, {});

  // JPEG 头部无 APP1
  const jpegNoExif = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
  const resNoExif = parseExifFromBuffer(jpegNoExif);
  assert.deepEqual(resNoExif, {});
  console.log('  ✓ EXIF 容错解析通过');
}

async function runAll() {
  console.log('=== 开始执行图像引擎 (ImageEngine) 自动化单测套件 ===');
  await testColorConversions();
  await testGcdAndAspectRatio();
  await testFormatImageSize();
  await testExifParserResilience();
  console.log('=== 图像引擎 4 项测试全部 PASSED ===\n');
}

runAll().catch(err => {
  console.error('图像引擎测试失败:', err);
  process.exit(1);
});
