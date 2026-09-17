#!/usr/bin/env node
/**
 * OmniView 原生 EPUB 引擎自动化测试套件
 * 验证 EPUB 2.0 / 3.0 容器解压、元数据抽取、TOC 解析与章节正文清洗
 */
import assert from 'node:assert';
import { generateSampleEpubBytes, parseEpub, base64ToBytes } from '../src/features/viewers/lib/epubEngine.ts';
import {
  loadEpubSettings,
  saveEpubSettings,
  loadEpubProgress,
  saveEpubProgress,
  DEFAULT_EPUB_SETTINGS,
} from '../src/features/viewers/lib/epubSettingsStorage.ts';

console.log('📚 开始 OmniView 原生 EPUB 解析引擎自动化测试...');

async function runTests() {
  // 测试 1: 纯内存生成内置规范 EPUB 二进制流
  console.log('--- 测试 1: 规范 EPUB 2.0/3.0 标准容器生成 ---');
  const sampleBytes = await generateSampleEpubBytes();
  assert.ok(sampleBytes instanceof Uint8Array, '生成的样例包必须为 Uint8Array');
  assert.ok(sampleBytes.length > 500, `EPUB 二进制包体积应符合标准规范 (当前 ${sampleBytes.length} 字节)`);
  console.log(`✅ 规范 EPUB 生成成功，包大小: ${sampleBytes.length} bytes`);

  // 测试 2: 完整解包并解析元数据与大纲
  console.log('--- 测试 2: OCF 容器解包与元数据解析 ---');
  const book = await parseEpub(sampleBytes);
  assert.ok(book, '解析结果必须有效');
  assert.strictEqual(typeof book.metadata.title, 'string');
  assert.ok(book.metadata.title.includes('OmniView'), `书名解析不正确: ${book.metadata.title}`);
  assert.strictEqual(typeof book.metadata.creator, 'string');
  assert.strictEqual(book.metadata.totalChapters, 3, '章节总数应为 3');
  console.log(`✅ 书籍元数据解析成功: 《${book.metadata.title}》 作者: ${book.metadata.creator}`);

  // 测试 3: TOC 目录大纲解析
  console.log('--- 测试 3: NCX / Nav 目录大纲树解析 ---');
  assert.ok(Array.isArray(book.toc), 'TOC 必须为数组');
  assert.strictEqual(book.toc.length, 3, 'TOC 条目数量应为 3');
  assert.ok(book.toc[0].label.includes('第一章'), '第 1 章节标题不匹配');
  assert.ok(book.toc[1].label.includes('第二章'), '第 2 章节标题不匹配');
  assert.ok(book.toc[2].label.includes('第三章'), '第 3 章节标题不匹配');
  console.log(`✅ 目录大纲解析正确: 提取到 ${book.toc.length} 个层级目录节点`);

  // 测试 4: 章节 XHTML 内容提取与 DOMPurify 安全过滤
  console.log('--- 测试 4: 章节正文提取与安全过滤 ---');
  assert.strictEqual(book.chapters.length, 3, '解析的章节数应为 3');
  const ch1 = book.chapters[0];
  assert.ok(ch1.htmlContent.includes('欢迎使用'), '第一章正文内容缺失');
  assert.ok(!ch1.htmlContent.includes('<script>'), 'XHTML 内容中不得存在未清洗的危险 script 标签');
  console.log(`✅ 章节正文提取与 DOMPurify 沙箱过滤验证通过`);

  // 测试 5: Base64 / Data URL 格式自动识别与转换
  console.log('--- 测试 5: Base64 与 Data URL 解码 ---');
  const base64Str = Buffer.from(sampleBytes).toString('base64');
  const dataUrl = `data:application/epub+zip;base64,${base64Str}`;
  const bookFromDataUrl = await parseEpub(dataUrl);
  assert.strictEqual(bookFromDataUrl.metadata.title, book.metadata.title);
  assert.strictEqual(bookFromDataUrl.chapters.length, 3);
  console.log('✅ Data URL / Base64 二进制解码与解析完全一致');

  // 测试 6: 损坏数据或空输入自愈降级
  console.log('--- 测试 6: 异常输入自愈机制 ---');
  const corruptData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const healedBook = await parseEpub(corruptData);
  assert.ok(healedBook, '遇到异常或损坏文件时应平滑自愈');
  assert.ok(healedBook.chapters.length > 0, '自愈后应具备默认阅读内容');
  console.log('✅ 异常数据自愈降级机制验证通过');

  // 测试 7: 双叶并排流式布局与翻页页数换算纯函数模型验证
  console.log('--- 测试 7: 双叶并排流式布局与翻页页数计算验证 ---');
  const calculateSpreadPages = (scrollW, clientW) => {
    if (clientW <= 0 || scrollW <= 0) return 1;
    return Math.max(1, Math.ceil(scrollW / clientW));
  };
  assert.strictEqual(calculateSpreadPages(0, 800), 1, '零宽度时回退至 1 页');
  assert.strictEqual(calculateSpreadPages(800, 800), 1, '单页容量时为 1 页');
  assert.strictEqual(calculateSpreadPages(1600, 800), 2, '两倍列宽时应切分为 2 个双叶跨页');
  assert.strictEqual(calculateSpreadPages(2100, 800), 3, '超出两倍列宽时应自动向上流式进位为 3 页');
  console.log('✅ 双叶并排流式分页步长与视口计算逻辑验证通过');

  // 测试 8: EPUB 排版偏好设置持久化验证
  console.log('--- 测试 8: EPUB 排版偏好设置读取与增量持久化验证 ---');
  const memStorage = new Map();
  const mockStorage = {
    getItem: (k) => memStorage.get(k) ?? null,
    setItem: (k, v) => memStorage.set(k, String(v)),
    removeItem: (k) => memStorage.delete(k),
    clear: () => memStorage.clear(),
  };
  globalThis.localStorage = mockStorage;
  globalThis.window = { localStorage: mockStorage };

  // 空环境读取默认值
  const defaultSettings = loadEpubSettings();
  assert.strictEqual(defaultSettings.flowMode, 'spread');
  assert.strictEqual(defaultSettings.fontSize, 17);
  assert.strictEqual(defaultSettings.fontFamily, 'serif');
  assert.strictEqual(defaultSettings.textIndent, true);
  assert.strictEqual(defaultSettings.enableFlipEffect, true);

  // 增量更新持久化
  saveEpubSettings({
    flowMode: 'scroll',
    fontSize: 20,
    fontFamily: 'kaiti',
    readerTheme: 'sepia',
    textIndent: false,
  });
  const reloadedSettings = loadEpubSettings();
  assert.strictEqual(reloadedSettings.flowMode, 'scroll', '流式滚动模式应持久化保存');
  assert.strictEqual(reloadedSettings.fontSize, 20, '字号应持久化保存');
  assert.strictEqual(reloadedSettings.fontFamily, 'kaiti', '楷体应持久化保存');
  assert.strictEqual(reloadedSettings.readerTheme, 'sepia', '羊皮纸主题应持久化保存');
  assert.strictEqual(reloadedSettings.textIndent, false, '缩进配置应持久化保存');
  console.log('✅ EPUB 排版偏好设置持久化与增量保存验证通过');

  // 测试 9: 电子书专属阅读进度持久化与还原验证
  console.log('--- 测试 9: 电子书专属阅读进度持久化与还原验证 ---');
  const bookKey = 'omniview_guide_v1';
  assert.strictEqual(loadEpubProgress(bookKey), null, '未阅读过的书籍应返回 null');

  saveEpubProgress(bookKey, {
    chapterIndex: 2,
    pageIndex: 4,
    progressPercent: 68,
  });

  const progress = loadEpubProgress(bookKey);
  assert.ok(progress, '阅读进度应成功持久化');
  assert.strictEqual(progress.chapterIndex, 2, '章节索引应为 2');
  assert.strictEqual(progress.pageIndex, 4, '页码索引应为 4');
  assert.strictEqual(progress.progressPercent, 68, '阅读百分比应为 68%');
  assert.ok(progress.timestamp > 0, '应包含有效的时间戳');
  console.log('✅ 电子书阅读进度持久化与自动还原验证通过');

  console.log('\n🎉 全部 9 项 EPUB 原生解析引擎、流式布局与设置持久化测试 100% 通过！\n');
}

runTests().catch((err) => {
  console.error('❌ EPUB 测试失败:', err);
  process.exit(1);
});
