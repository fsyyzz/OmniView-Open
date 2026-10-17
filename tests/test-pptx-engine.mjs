/**
 * OmniView 原生 PowerPoint (.pptx) 解析与离线渲染引擎自动化测试套件
 */
import assert from 'assert';
import JSZip from 'jszip';
import {
  parsePptx,
  generateSamplePptxBytes,
  emuToPt,
  base64ToBytes,
} from '../src/features/viewers/lib/pptxEngine.ts';

async function runTests() {
  console.log('🧪 开始 PowerPoint (.pptx) 引擎与解析流水线自动化测试...');

  // --- 测试 1: 动态生成标准规范 PPTX 容器 ---
  console.log('--- 测试 1: 生成标准规范 PPTX 容器 ---');
  const sampleBytes = await generateSamplePptxBytes();
  assert(sampleBytes && sampleBytes.length > 0, '样例 PPTX 字节流生成失败');
  assert(sampleBytes[0] === 0x50 && sampleBytes[1] === 0x4B, 'PPTX 必须符合标准 PK Zip 容器魔数头');
  console.log(`✅ 规范 PPTX 演示包生成成功，包大小: ${sampleBytes.length} 字节`);

  // --- 测试 2: OOXML 容器解包与幻灯片检索 ---
  console.log('--- 测试 2: OOXML 容器解包与幻灯片检索 ---');
  const zip = await JSZip.loadAsync(sampleBytes);
  assert(zip.file('ppt/presentation.xml'), '缺失 ppt/presentation.xml');
  assert(zip.file('ppt/slides/slide1.xml'), '缺失 ppt/slides/slide1.xml 封面页');
  assert(zip.file('ppt/slides/slide2.xml'), '缺失 ppt/slides/slide2.xml 内容页');
  assert(zip.file('ppt/slides/slide3.xml'), '缺失 ppt/slides/slide3.xml 矩阵页');
  console.log('✅ OOXML 幻灯片多页归档结构解析正确');

  // --- 测试 3: parsePptx 完整流水线解析与元数据提取 ---
  console.log('--- 测试 3: parsePptx 完整流水线解析 ---');
  const parsed = await parsePptx(sampleBytes);
  assert.strictEqual(parsed.isValid, true);
  assert.strictEqual(parsed.metadata.slideCount, 3, '应当解析出 3 张幻灯片');
  assert.strictEqual(parsed.metadata.aspectRatio, '16:9', '幻灯片比例应当为 16:9');
  assert.strictEqual(parsed.metadata.title, 'OmniView PowerPoint 架构演示文稿');
  assert.strictEqual(parsed.metadata.creator, 'OmniView Architecture Team');
  console.log(`✅ 元数据解析正确: 《${parsed.metadata.title}》 比例: ${parsed.metadata.aspectRatio} 总页数: ${parsed.metadata.slideCount}`);

  // --- 测试 4: 幻灯片元素与段落文本提取 ---
  console.log('--- 测试 4: 幻灯片文本框与格式提取 ---');
  const slide1 = parsed.slides[0];
  assert.strictEqual(slide1.index, 0);
  assert(slide1.elements.length > 0, '封面页必须包含文本元素');
  const titleEl = slide1.elements[0];
  assert.strictEqual(titleEl.type, 'text');
  assert(titleEl.paragraphs && titleEl.paragraphs.length > 0);
  assert(titleEl.paragraphs[0].runs[0].text.includes('OmniView PPTX 原生演播工作台'));
  console.log(`✅ 文本框内容正确匹配: "${titleEl.paragraphs[0].runs[0].text}"`);

  // --- 测试 5: EMU 到 pt 单位换算 ---
  console.log('--- 测试 5: EMU 到 pt 单位换算 ---');
  const ptVal = emuToPt(1270000);
  assert.strictEqual(ptVal, 100, '1270000 EMU 应等于 100 pt');
  console.log('✅ EMU 物理几何坐标换算验证通过');

  // --- 测试 6: 损坏数据自愈降级 ---
  console.log('--- 测试 6: 损坏数据自愈降级 ---');
  const corruptInput = new Uint8Array([0x99, 0x88, 0x77]);
  const parsedCorrupt = await parsePptx(corruptInput);
  assert.strictEqual(parsedCorrupt.isValid, true, '自愈降级后应提供完整可用的样例文稿');
  assert.strictEqual(parsedCorrupt.slides.length, 3);
  console.log('✅ PPTX 异常自愈降级验证通过');

  // --- 测试 7: 纯几何形状与主题色映射提取 ---
  console.log('--- 测试 7: 纯几何形状与主题色映射提取 ---');
  const shapeEl = slide1.elements.find(el => el.type === 'shape');
  assert(shapeEl, '封面页底部的装饰形状应当被正确保留');
  assert.strictEqual(shapeEl.shapeType, 'roundRect', '形状类型应当为 roundRect');
  assert.strictEqual(shapeEl.fillColor?.toUpperCase(), '#3B82F6', '主题色 accent1 应当被正确映射解析为 #3B82F6');
  console.log(`✅ 形状与主题调色板解析正确: ${shapeEl.shapeType} 填充色: ${shapeEl.fillColor}`);

  // --- 测试 8: 幻灯片内嵌图片与关系表解包提取 ---
  console.log('--- 测试 8: 内嵌图片与关系表解包提取 ---');
  const slide2 = parsed.slides[1];
  const imgEl = slide2.elements.find(el => el.type === 'image');
  assert(imgEl, '第 2 页应当成功解析出内嵌图片');
  assert(imgEl.imageDataUrl && imgEl.imageDataUrl.startsWith('data:image/png;base64,'), '图片 DataURL 必须有效');
  assert.strictEqual(imgEl.imageAlt, '架构示意图', '图片描述应当被正确提取');
  console.log(`✅ 图片节点解包正确: ${imgEl.imageAlt}, 数据长度: ${imgEl.imageDataUrl.length}`);

  // --- 测试 9: 幻灯片表格结构与单元格提取 ---
  console.log('--- 测试 9: 表格结构与单元格提取 ---');
  const slide3 = parsed.slides[2];
  const tableEl = slide3.elements.find(el => el.type === 'table');
  assert(tableEl, '第 3 页应当成功解析出特性支持矩阵表格');
  assert(tableEl.tableRows && tableEl.tableRows.length >= 3, '表格应当至少有 3 行');
  assert.strictEqual(tableEl.tableRows[0][0].text, '格式类型', '表头第一格文本匹配');
  assert.strictEqual(tableEl.tableRows[0][0].isHeader, true, '首行应为表头');
  assert.strictEqual(tableEl.tableRows[1][0].text, 'PowerPoint (.pptx)', '数据行文本匹配');
  console.log(`✅ 表格矩阵提取正确: ${tableEl.tableRows.length} 行 x ${tableEl.tableRows[0].length} 列`);

  console.log('\n🎉 全部 9 项 PowerPoint (.pptx) 引擎解析、媒体解包与自愈测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
