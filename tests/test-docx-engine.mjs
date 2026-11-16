/**
 * OmniView 原生 Word (.docx) 解析与离线渲染引擎自动化测试套件
 */
import assert from 'assert';
import JSZip from 'jszip';
import {
  parseDocx,
  generateSampleDocxBytes,
  extractDocxMetadata,
  base64ToBytes,
} from '../src/features/viewers/lib/docxEngine.ts';

async function runTests() {
  console.log('🧪 开始 Word (.docx) 引擎与解析流水线自动化测试...');

  // --- 测试 1: 动态生成标准规范 DOCX 容器 ---
  console.log('--- 测试 1: 生成标准规范 DOCX 容器 ---');
  const sampleBytes = await generateSampleDocxBytes();
  assert(sampleBytes && sampleBytes.length > 0, '样例 DOCX 字节流生成失败');
  assert(sampleBytes[0] === 0x50 && sampleBytes[1] === 0x4B, 'DOCX 必须符合标准 PK Zip 容器魔数头');
  console.log(`✅ 规范 DOCX 二进制包生成成功，包大小: ${sampleBytes.length} 字节`);

  // --- 测试 2: OCF / OOXML 压缩包解包与元数据解析 ---
  console.log('--- 测试 2: OOXML 容器解包与元数据解析 ---');
  const zip = await JSZip.loadAsync(sampleBytes);
  assert(zip.file('[Content_Types].xml'), '缺失 [Content_Types].xml 声明');
  assert(zip.file('word/document.xml'), '缺失 word/document.xml 主文档');
  assert(zip.file('docProps/core.xml'), '缺失 docProps/core.xml 核心元数据');

  const metadata = await extractDocxMetadata(zip);
  assert.strictEqual(metadata.title, 'OmniView Word 高保真文档指南');
  assert.strictEqual(metadata.creator, 'OmniView Architecture Team');
  console.log(`✅ 元数据解析成功: 《${metadata.title}》 作者: ${metadata.creator}`);

  // --- 测试 3: parseDocx 完整流水线解析与合法性验证 ---
  console.log('--- 测试 3: parseDocx 完整流水线解析 ---');
  const parsed = await parseDocx(sampleBytes);
  assert.strictEqual(parsed.isValid, true, '解析结果标记应当有效');
  assert.strictEqual(parsed.metadata.title, 'OmniView Word 高保真文档指南');
  assert(parsed.rawBytes.length > 0, '必须保留原始二进制字节');
  console.log('✅ parseDocx 二进制解析验证通过');

  // --- 测试 4: Base64 / Data URL 格式输入解析 ---
  console.log('--- 测试 4: Base64 / Data URL 格式解码 ---');
  const base64Str = Buffer.from(sampleBytes).toString('base64');
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Str}`;
  const parsedFromDataUrl = await parseDocx(dataUrl);
  assert.strictEqual(parsedFromDataUrl.isValid, true);
  assert.strictEqual(parsedFromDataUrl.metadata.title, 'OmniView Word 高保真文档指南');
  console.log('✅ Data URL / Base64 解码与解析验证通过');

  // --- 测试 5: 异常损坏输入自愈降级 ---
  console.log('--- 测试 5: 异常损坏输入自愈降级 ---');
  const corruptInput = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]);
  const parsedCorrupt = await parseDocx(corruptInput);
  assert.strictEqual(parsedCorrupt.isValid, false, '损坏文件应标记为非完全有效');
  assert.strictEqual(parsedCorrupt.isFallbackUsed, true, '损坏文件应标记已触发降级样例');
  assert(parsedCorrupt.rawBytes && parsedCorrupt.rawBytes.length > 0, '自愈降级应提供内置可用样例文档');
  console.log('✅ 异常数据自愈降级机制验证通过');

  // --- 测试 6: XML 实体解码与扩展元数据 AST 解析 ---
  console.log('--- 测试 6: XML 实体解码与扩展元数据 AST 解析 ---');
  const customZip = new JSZip();
  customZip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>R&amp;D &lt;Architecture&gt; Spec</dc:title>
  <dc:creator><![CDATA[OmniView & Co.]]></dc:creator>
</cp:coreProperties>`
  );
  customZip.file(
    'docProps/app.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Pages>12</Pages>
  <Words>4850</Words>
  <Characters>26400</Characters>
  <Company>OmniView Lab &amp; Studio</Company>
</Properties>`
  );
  const customMeta = await extractDocxMetadata(customZip);
  assert.strictEqual(customMeta.title, 'R&D <Architecture> Spec', 'core.xml 标题应准确解码 &amp; 和 &lt;/&gt;');
  assert.strictEqual(customMeta.creator, 'OmniView & Co.', 'core.xml 作者应准确支持 CDATA');
  assert.strictEqual(customMeta.pageCount, 12, 'app.xml 页数应为 12');
  assert.strictEqual(customMeta.wordCount, 4850, 'app.xml 字数应为 4850');
  assert.strictEqual(customMeta.characterCount, 26400, 'app.xml 字符数应为 26400');
  assert.strictEqual(customMeta.company, 'OmniView Lab & Studio', 'app.xml 公司名应准确解码实体');
  console.log('✅ XML 实体解码与扩展元数据 AST 解析通过');

  console.log('\n🎉 全部 6 项 Word (.docx) 引擎解析与自愈测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
