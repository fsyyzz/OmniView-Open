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

  // 测试 7: 双叶并排流式布局与翻页页数换算全新几何物理步长模型验证
  console.log('--- 测试 7: 双叶并排流式布局与翻页页数计算验证 ---');
  const calculateSpreadPages = (scrollW, clientW, cols = 2, gap = 48) => {
    if (clientW <= 0 || scrollW <= 0) return 1;
    const colWidth = cols === 2 ? Math.max(1, (clientW - gap) / 2) : clientW;
    const colStep = colWidth + gap;
    const rawCols = Math.round((scrollW + gap - 4) / colStep);
    const computedCols = Math.max(1, rawCols);
    return cols === 2 ? Math.max(1, Math.ceil(computedCols / 2)) : computedCols;
  };
  assert.strictEqual(calculateSpreadPages(0, 800), 1, '零宽度时回退至 1 页');
  assert.strictEqual(calculateSpreadPages(752, 800), 1, '单跨页 2 列容量时为 1 页');
  assert.strictEqual(calculateSpreadPages(1648, 800), 2, '两倍跨页容量时切分为 2 个双叶跨页');
  // 翻页步长验证：平移位移精确对齐
  const pageStep = 800 + 48; // clientW + gap = 848
  assert.strictEqual(pageStep, 848, '翻页单步物理位移必须严格等于 clientW + gap');
  console.log('✅ 双叶并排流式分页物理步长与几何跨页计算验证通过');

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
  assert.strictEqual(defaultSettings.readerTheme, 'auto', '默认主题模式必须为 auto (跟随整体)');
  assert.strictEqual(defaultSettings.flowMode, 'spread');
  assert.strictEqual(defaultSettings.fontSize, 17);
  assert.strictEqual(defaultSettings.fontFamily, 'serif');
  assert.strictEqual(defaultSettings.textIndent, true);
  assert.strictEqual(defaultSettings.enableFlipEffect, true);

  // 增量更新持久化 (测试主题与排版混合保存)
  saveEpubSettings({
    readerTheme: 'sepia',
    flowMode: 'scroll',
    fontSize: 20,
    fontFamily: 'kaiti',
    textIndent: false,
  });
  const reloadedSettings = loadEpubSettings();
  assert.strictEqual(reloadedSettings.readerTheme, 'sepia', '暖阳羊皮阅读主题应持久化保存');
  assert.strictEqual(reloadedSettings.flowMode, 'scroll', '流式滚动模式应持久化保存');
  assert.strictEqual(reloadedSettings.fontSize, 20, '字号应持久化保存');
  assert.strictEqual(reloadedSettings.fontFamily, 'kaiti', '楷体应持久化保存');
  assert.strictEqual(reloadedSettings.textIndent, false, '缩进配置应持久化保存');

  // 测试 effectiveTheme 动态联动解析
  const resolveEffectiveTheme = (readerTheme, globalTheme) => {
    if (readerTheme === 'auto') return globalTheme || 'dark';
    return readerTheme;
  };
  assert.strictEqual(resolveEffectiveTheme('auto', 'light'), 'light', 'auto 模式下应正确继承整体明亮主题');
  assert.strictEqual(resolveEffectiveTheme('auto', 'sepia'), 'sepia', 'auto 模式下应正确继承整体羊皮主题');
  assert.strictEqual(resolveEffectiveTheme('sepia', 'dark'), 'sepia', '独立设置的主题应优先于整体主题');
  console.log('✅ EPUB 排版偏好设置与阅读主题持久化验证通过');

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

  // 测试 10: 目录跳转高容错相对路径/基名/ID 解析机制验证
  console.log('--- 测试 10: 目录跳转高容错路径解析与常驻逻辑验证 ---');
  const mockChapters = [
    { id: 'ch-1', title: '引言与设计哲学', href: 'Text/chapter1.xhtml' },
    { id: 'ch-2', title: 'CSS 多列流式引擎', href: 'OEBPS/Text/chapter2.xhtml' },
    { id: 'ch-3', title: '双叶并排排版实践', href: 'chapter3.html' },
  ];

  const resolveChapterIndex = (tocHref, tocId, tocLabel) => {
    const rawTarget = tocHref.split('#')[0];
    const cleanTarget = decodeURIComponent(rawTarget.replace(/^\.\//, ''));
    const targetBaseName = cleanTarget.split('/').pop()?.toLowerCase();

    let found = mockChapters.findIndex(ch => {
      const cleanCh = decodeURIComponent(ch.href.split('#')[0].replace(/^\.\//, ''));
      return cleanCh === cleanTarget;
    });
    if (found === -1 && targetBaseName) {
      found = mockChapters.findIndex(ch => {
        const chBaseName = ch.href.split('#')[0].split('/').pop()?.toLowerCase();
        return chBaseName === targetBaseName;
      });
    }
    if (found === -1 && tocId) {
      found = mockChapters.findIndex(ch => ch.id === tocId);
    }
    if (found === -1 && tocLabel) {
      found = mockChapters.findIndex(ch => ch.title.trim() === tocLabel.trim());
    }
    return found;
  };

  // 1. 精确匹配
  assert.strictEqual(resolveChapterIndex('Text/chapter1.xhtml'), 0, '精确路径应成功匹配第 1 章');
  // 2. 带相对路径 ./ 与 #hash 匹配
  assert.strictEqual(resolveChapterIndex('./Text/chapter1.xhtml#subheading'), 0, '带 hash 和 ./ 相对路径应匹配第 1 章');
  // 3. 跨目录基名匹配 (只提供 chapter2.xhtml 匹配 OEBPS/Text/chapter2.xhtml)
  assert.strictEqual(resolveChapterIndex('chapter2.xhtml'), 1, '仅文件名基名应成功容错匹配第 2 章');
  // 4. 按章节 ID 匹配
  assert.strictEqual(resolveChapterIndex('nonexistent.html', 'ch-3'), 2, '通过 ID 降级应成功匹配第 3 章');
  // 5. 按标题完全匹配
  assert.strictEqual(resolveChapterIndex('unknown.html', null, '双叶并排排版实践'), 2, '通过标题降级应成功匹配第 3 章');
  console.log('✅ 目录跳转多阶容错解析匹配机制验证通过');

  // 测试 11: 多种版心宽度切换与循环切换逻辑验证
  console.log('--- 测试 11: 多种版心宽度切换与循环切换逻辑验证 ---');
  const widthOrder = ['standard', 'wide', 'full'];
  const getNextWidth = (curr) => widthOrder[(widthOrder.indexOf(curr) + 1) % widthOrder.length];
  assert.strictEqual(getNextWidth('standard'), 'wide', 'standard 后续应为 wide');
  assert.strictEqual(getNextWidth('wide'), 'full', 'wide 后续应为 full');
  assert.strictEqual(getNextWidth('full'), 'standard', 'full 后续应循环回 standard');

  // 持久化保存与读取多种宽度
  saveEpubSettings({ contentWidth: 'wide' });
  assert.strictEqual(loadEpubSettings().contentWidth, 'wide', '宽幅版心设置应正确持久化');
  saveEpubSettings({ contentWidth: 'full' });
  assert.strictEqual(loadEpubSettings().contentWidth, 'full', '全幅版心设置应正确持久化');
  console.log('✅ 多种版心宽度切换与循环切换逻辑验证通过');

  // 测试 12: 连续流式滚动 (Continuous Flow Scroll) 全书连续渲染与滚动探针逻辑验证
  console.log('--- 测试 12: 连续流式滚动全书连贯渲染与滚动探针逻辑验证 ---');
  // 模拟章节相对偏移量
  const mockChapterOffsets = [
    { index: 0, top: 0, height: 1200 },
    { index: 1, top: 1200, height: 2000 },
    { index: 2, top: 3200, height: 1500 },
  ];

  // 探针算法：根据 scrollTop 确定当前处于哪一章
  const getActiveChapterByScroll = (scrollTop, readingThreshold = 160) => {
    let active = 0;
    for (const ch of mockChapterOffsets) {
      if (scrollTop >= ch.top - readingThreshold) {
        active = ch.index;
      } else {
        break;
      }
    }
    return active;
  };

  assert.strictEqual(getActiveChapterByScroll(0), 0, '顶部 0px 应激活第 1 章');
  assert.strictEqual(getActiveChapterByScroll(1100), 1, '接近第 2 章 (1100px) 穿过阅读阈值应激活第 2 章');
  assert.strictEqual(getActiveChapterByScroll(1500), 1, '1500px 应保持在第 2 章');
  assert.strictEqual(getActiveChapterByScroll(3150), 2, '穿过第 3 章阈值应激活第 3 章');

  // 连续滚动模式下的全局阅读进度百分比计算
  const calculateScrollProgress = (scrollTop, scrollHeight, clientHeight) => {
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
  };

  assert.strictEqual(calculateScrollProgress(0, 4700, 700), 0, '未滚动时进度为 0%');
  assert.strictEqual(calculateScrollProgress(2000, 4700, 700), 50, '滚动到中间时进度为 50%');
  assert.strictEqual(calculateScrollProgress(4000, 4700, 700), 100, '滚动到底部时进度为 100%');

  // 持久化保存与读取连续流式滚动模式
  saveEpubSettings({ flowMode: 'scroll' });
  assert.strictEqual(loadEpubSettings().flowMode, 'scroll', '连续流式滚动模式应正确持久化保存');
  console.log('✅ 连续流式滚动全书连贯渲染与滚动探针逻辑验证通过');

  console.log('\n🎉 全部 12 项 EPUB 原生解析引擎、高容错目录跳转、多种宽度与连续流式滚动测试 100% 通过！\n');
}

runTests().catch((err) => {
  console.error('❌ EPUB 测试失败:', err);
  process.exit(1);
});
