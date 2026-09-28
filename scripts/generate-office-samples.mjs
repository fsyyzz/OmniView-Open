/**
 * 自动生成 OmniView 官方演示 Office 示例文件 (.docx / .pptx)
 * 作者: 周赞
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSampleDocxBytes } from '../src/features/viewers/lib/docxEngine.ts';
import { generateSamplePptxBytes } from '../src/features/viewers/lib/pptxEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('🚀 开始生成 Office 示例文件 (.docx / .pptx)...');

  // 1. 生成 Word (.docx) 示例
  const docxDir = path.join(rootDir, 'examples', 'docx');
  if (!fs.existsSync(docxDir)) {
    fs.mkdirSync(docxDir, { recursive: true });
  }
  const docxBytes = await generateSampleDocxBytes();
  const docxFilePath = path.join(docxDir, 'omniview-architecture-guide.docx');
  fs.writeFileSync(docxFilePath, Buffer.from(docxBytes));
  console.log(`✅ 已生成 DOCX 示例: ${docxFilePath} (${docxBytes.length} bytes)`);

  // 2. 生成 PowerPoint (.pptx) 示例
  const pptxDir = path.join(rootDir, 'examples', 'pptx');
  if (!fs.existsSync(pptxDir)) {
    fs.mkdirSync(pptxDir, { recursive: true });
  }
  const pptxBytes = await generateSamplePptxBytes();
  const pptxFilePath = path.join(pptxDir, 'omniview-tech-presentation.pptx');
  fs.writeFileSync(pptxFilePath, Buffer.from(pptxBytes));
  console.log(`✅ 已生成 PPTX 示例: ${pptxFilePath} (${pptxBytes.length} bytes)`);

  console.log('🎉 全部 Office 示例文件生成完毕！');
}

main().catch((err) => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
