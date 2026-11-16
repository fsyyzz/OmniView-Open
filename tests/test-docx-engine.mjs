/**
 * OmniView 原生 Word (.docx) 解析与离线渲染引擎自动化测试套件
 */
import assert from 'assert';
import JSZip from 'jszip';
import { Window } from 'happy-dom';
import {
  parseDocx,
  generateSampleDocxBytes,
  extractDocxMetadata,
  extractHeadingsFromDom,
  isTocEntryElement,
  resolveBodyHeadingElement,
  extractDocxFormattingProfile,
  applyDocxFormattingAndPageFidelity,
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

  // --- 测试 7: Word 文内目录 (TOC) 识别与真实正文标题书签解析 ---
  console.log('--- 测试 7: Word 文内目录过滤与 #_Toc 书签正文绑定 ---');
  const win = new Window();
  const doc = win.document;
  const domRoot = doc.createElement('div');
  domRoot.innerHTML = `
    <section class="docx-paged-sheet" data-page-number="1">
      <p class="docx-rendered-wrapper_TOCHeading">目录</p>
      <p class="docx-rendered-wrapper_TOC1" id="toc-row-1"><a href="#_Toc101">1. 系统架构总览 ........ 2</a></p>
      <p class="docx-rendered-wrapper_TOC2" id="toc-row-2"><a href="#_Toc102">1.1 核心模块设计 ........ 3</a></p>
      <p class="docx-rendered-wrapper_Normal" id="manual-toc-row">2. 运维保障规范\t\t4</p>
    </section>
    <section class="docx-paged-sheet" data-page-number="2">
      <h1 class="docx-rendered-wrapper_Heading1" id="body-h1"><span id="_Toc101"></span>1. 系统架构总览</h1>
      <p>正文详细描述第一部分架构设计内容。</p>
    </section>
    <section class="docx-paged-sheet" data-page-number="3">
      <h2 class="docx-rendered-wrapper_Heading2" id="body-h2"><a name="_Toc102"></a>1.1 核心模块设计</h2>
      <p>正文详细描述核心模块内容。</p>
    </section>
    <section class="docx-paged-sheet" data-page-number="4">
      <h1 class="docx-rendered-wrapper_Heading1" id="body-h3">2. 运维保障规范</h1>
      <p>正文详细描述运维规范。</p>
    </section>
  `;
  doc.body.appendChild(domRoot);

  const tocRow1 = domRoot.querySelector('#toc-row-1');
  const manualTocRow = domRoot.querySelector('#manual-toc-row');
  const bodyH1 = domRoot.querySelector('#body-h1');
  assert.strictEqual(isTocEntryElement(tocRow1, domRoot), true, '带 docx-rendered-wrapper_TOC1 下划线类名的目录行必须识别为 TOC');
  assert.strictEqual(isTocEntryElement(manualTocRow, domRoot), true, '带页码尾缀的手工目录行必须识别为 TOC');
  assert.strictEqual(isTocEntryElement(bodyH1, domRoot), false, '正文真标题绝不能被误判为 TOC');

  const headings = extractHeadingsFromDom(domRoot);
  assert.strictEqual(headings.length, 3, `应提取 3 个正文标题，实际: ${headings.length}`);
  assert.strictEqual(headings[0].element?.id, 'body-h1', '第 1 项大纲必须绑定正文 #body-h1，而非目录 #toc-row-1');
  assert.strictEqual(headings[1].element?.id, 'body-h2', '第 2 项大纲必须绑定正文 #body-h2，而非目录 #toc-row-2');
  assert.strictEqual(headings[2].element?.id, 'body-h3', '第 3 项大纲必须跳过手工目录绑定正文 #body-h3');

  const tocAnchor = tocRow1.querySelector('a');
  const resolvedFromAnchor = resolveBodyHeadingElement(domRoot, tocAnchor);
  assert.strictEqual(resolvedFromAnchor?.id, 'body-h1', '点击目录页 <a href="#_Toc101"> 必须直达正文 #body-h1');

  domRoot.remove();
  await win.close();
  console.log('✅ Word 文内目录屏蔽与真实正文标题跳转解析验证通过');

  // --- 测试 8: OOXML 行高 (omitted lineRule / atLeast / exact / beforeLines / docGrid) 与页面属性 (pgSz / pgMar / cols / vAlign) ---
  console.log('--- 测试 8: OOXML 行高规则与页面属性高保真解析及 DOM/CSS 修补 ---');
  const typZip = new JSZip();
  typZip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="微软雅黑"/><w:sz w:val="21"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="276"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="BodyCustom">
    <w:name w:val="Body Custom"/>
    <w:pPr><w:spacing w:line="360" w:beforeLines="50"/></w:pPr>
  </w:style>
</w:styles>`
  );
  typZip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:spacing w:line="360"/></w:pPr><w:r><w:t>省略 lineRule 默认应为 auto</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:line="400" w:lineRule="atLeast"/></w:pPr><w:r><w:t>最小值行距段落</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:line="440" w:lineRule="exact"/></w:pPr><w:r><w:t>固定行距段落</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" w:orient="landscape"/>
      <w:pgMar w:top="1440" w:right="1134" w:bottom="1440" w:left="1134" w:gutter="284"/>
      <w:cols w:num="2" w:space="720" w:sep="1"/>
      <w:vAlign w:val="center"/>
      <w:pgBorders><w:top w:val="single" w:sz="8" w:color="334155"/></w:pgBorders>
      <w:docGrid w:type="lines" w:linePitch="312"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  const profile = await extractDocxFormattingProfile(typZip);
  assert.strictEqual(profile.defaultFontSizePt, 10.5, 'docDefaults 字号应为 10.5pt');
  assert.strictEqual(profile.defaultSpacing.lineRule, 'auto', 'styles.xml 省略 w:lineRule 必须默认规范为 auto');
  assert.strictEqual(profile.primaryPage.orientation, 'landscape', 'pgSz orient="landscape" 应归一化为横版');
  assert.ok(profile.primaryPage.widthPx > profile.primaryPage.heightPx, '横版时 widthPx 必须大于 heightPx');
  assert.strictEqual(profile.primaryPage.paperName, 'A4', '纸张识别应为 A4');
  assert.strictEqual(profile.primaryPage.columns.count, 2, 'cols num="2" 应准确解析');
  assert.strictEqual(profile.primaryPage.columns.separator, true, 'cols sep="1" 应解析为 true');
  assert.strictEqual(profile.primaryPage.verticalAlign, 'center', 'vAlign="center" 应准确解析');
  assert.strictEqual(profile.primaryPage.docGrid?.linePitchPt, 15.6, 'docGrid linePitch="312" 应换算为 15.6pt');
  assert.ok(profile.primaryPage.margins.gutterMm > 0, '装订线 gutterMm 应大于 0');

  const win2 = new Window();
  const doc2 = win2.document;
  const origDoc = global.document;
  global.document = doc2;
  try {
    const styleHost = doc2.createElement('div');
    const badStyle = doc2.createElement('style');
    badStyle.textContent =
      '.docx-rendered-wrapper_BodyCustom { line-height: 18pt; min-height: 18pt; }\n' +
      '.docx-rendered-wrapper_AtLeast { line-height: calc(100% + 20pt); }';
    styleHost.appendChild(badStyle);

    const domHost = doc2.createElement('div');
    domHost.innerHTML = `
      <section class="docx-rendered-wrapper docx">
        <article>
          <p id="p-omitted" style="line-height: 18pt; min-height: 18pt;">省略 lineRule 默认应为 auto</p>
          <p id="p-atleast" style="line-height: calc(100% + 20pt);">最小值行距段落</p>
          <p id="p-exact" style="line-height: 22pt; min-height: 22pt;">固定行距段落</p>
        </article>
      </section>
    `;

    applyDocxFormattingAndPageFidelity(domHost, styleHost, profile);

    assert.ok(!badStyle.textContent.includes('line-height: 18pt'), '样式表中被 docx-preview 误转的 18pt 应被修复为倍数行高');
    assert.ok(badStyle.textContent.includes('max(1.22em, 20pt)'), '样式表中 calc(100% + 20pt) 应被修复为 max(1.22em, 20pt)');

    const pOmitted = domHost.querySelector('#p-omitted');
    const pAtLeast = domHost.querySelector('#p-atleast');
    const pExact = domHost.querySelector('#p-exact');
    assert.strictEqual(pOmitted.style.lineHeight, '1.73', '省略 lineRule 的行内 18pt 应修复为 1.73 倍行高');
    assert.strictEqual(pOmitted.style.minHeight, '', 'auto 行高应清除残留 min-height');
    assert.ok(
      !pAtLeast.style.lineHeight.includes('100%') &&
        (pAtLeast.style.lineHeight === 'max(1.22em, 20pt)' || pAtLeast.style.lineHeight === '20pt'),
      `atLeast 行内样式应清除 calc(100% + 20pt) 并修复为 max(1.22em, 20pt) 或等价 20pt，实际: ${pAtLeast.style.lineHeight}`
    );
    assert.strictEqual(pAtLeast.style.minHeight, '20pt', 'atLeast 应同步设置 min-height: 20pt');
    assert.strictEqual(pExact.style.lineHeight, '22pt', 'exact 固定行高必须严格保持 22pt');

    const sec = domHost.querySelector('section');
    assert.strictEqual(sec.getAttribute('data-orientation'), 'landscape');
    assert.ok(sec.style.paddingTop && sec.style.paddingLeft, '缺失边距的节应补全默认页边距');
    assert.ok(sec.style.borderTop, 'pgBorders 顶边框应施加至 section');
    assert.strictEqual(domHost.querySelector('article').style.columnCount, '2', '双栏配置应写入 article.style.columnCount');
  } finally {
    global.document = origDoc;
    await win2.close();
  }
  console.log('✅ OOXML 行高规则与页面属性高保真解析及 DOM/CSS 修补验证通过');

  console.log('\n🎉 全部 8 项 Word (.docx) 引擎解析与排版测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
