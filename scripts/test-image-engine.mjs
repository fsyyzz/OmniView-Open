/**
 * 现代图像引擎与像素级分析工具集单元测试 (test-image-engine.mjs)
 * 验证色彩空间换算 (RGBA/HEX/HSLA)、GCD 纵横比提取、文件大小格式化与 EXIF 容错解析
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  rgbaToHex,
  rgbaToHsla,
  gcd,
  formatAspectRatio,
  formatImageSize,
  parseExifFromBuffer,
} from '../src/features/viewers/lib/imageEngine.ts';
import {
  driverSupportsSplitView,
  driverSupportsSourceEdit,
  isBinaryDriver,
  getDriverIdForFile,
} from '../src/features/viewers/lib/driverRegistry.ts';

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

async function testImageModeAndSplitDisable() {
  console.log('  [test] 图片格式协同分屏与源码编辑模式禁用策略断言...');
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff'];
  for (const ext of imageExtensions) {
    const mockFile = { id: `test-${ext}`, name: `sample.${ext}`, extension: ext, content: '' };
    assert.equal(getDriverIdForFile(mockFile), 'image', `扩展名 .${ext} 应识别为 image 驱动`);
    assert.equal(driverSupportsSplitView(mockFile), false, `图片格式 .${ext} 严禁启用并排协同分屏 (supportsSplitView 必须为 false)`);
    assert.equal(driverSupportsSourceEdit(mockFile), false, `图片格式 .${ext} 严禁启用源码编辑 (supportsSourceEdit 必须为 false)`);
  }
  assert.equal(isBinaryDriver('image'), true, 'image 驱动必须标记为 isBinary: true');
  console.log('  ✓ 图片格式并排协同与源码编辑禁用策略全部校验通过');
}

async function testImageViewerThemeIntegration() {
  console.log('  [test] ImageViewer 全局主题自适应与语义设计令牌校验...');
  const componentPath = path.resolve('src/features/viewers/components/drivers/ImageViewer.tsx');
  assert.ok(fs.existsSync(componentPath), 'ImageViewer.tsx 文件必须存在');
  const source = fs.readFileSync(componentPath, 'utf-8');

  // 1. 默认底色模式必须为 system (跟随全局主题)
  assert.match(source, /useState<.*?>\('system'\)/, "ImageViewer 默认背景模式必须初始化为 'system'");

  // 2. 必须包含系统底色切换选项与图标
  assert.match(source, /setBgMode\('system'\)/, "底色工具栏必须提供系统全局主题切换项");
  assert.match(source, /Monitor/, "底色工具栏必须引入 Monitor 图标代表系统全局主题");

  // 3. 画布底色必须依托语义化令牌 var(--ov-bg)
  assert.match(source, /var\(--ov-bg\)/, '系统底色模式必须直接使用 var(--ov-bg)');

  // 4. 样式必须依托 --ov-* 语义令牌，严禁写死深色背景
  assert.match(source, /var\(--ov-surface-header\)/, '工具栏与底栏必须使用 var(--ov-surface-header)');
  assert.match(source, /var\(--ov-border\)/, '边框必须使用 var(--ov-border)');
  assert.match(source, /var\(--ov-text\)/, '主要文本必须使用 var(--ov-text)');

  console.log('  ✓ ImageViewer 全局主题自适应与语义设计令牌校验通过');
}

async function runAll() {
  console.log('=== 开始执行图像引擎 (ImageEngine) 自动化单测套件 ===');
  await testColorConversions();
  await testGcdAndAspectRatio();
  await testFormatImageSize();
  await testExifParserResilience();
  await testImageModeAndSplitDisable();
  await testImageViewerThemeIntegration();
  console.log('=== 图像引擎 6 项测试全部 PASSED ===\n');
}

runAll().catch(err => {
  console.error('图像引擎测试失败:', err);
  process.exit(1);
});
