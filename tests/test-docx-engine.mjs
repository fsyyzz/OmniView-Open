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
  assert(parsedCorrupt.rawBytes && parsedCorrupt.rawBytes.length > 0, '自愈降级应提供内置可用样例文档');
  console.log('✅ 异常数据自愈降级机制验证通过');

  console.log('\n🎉 全部 5 项 Word (.docx) 引擎解析与自愈测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
