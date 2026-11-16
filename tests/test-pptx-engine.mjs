/**
 * OmniView 原生 PowerPoint (.pptx) 解析与离线渲染引擎自动化测试套件 (15 项全覆盖)
 */
import assert from 'assert';
import JSZip from 'jszip';
import {
  parsePptx,
  generateSamplePptxBytes,
  emuToPt,
  pptxToMarkdown,
  buildPptxPrintHtml,
} from '../src/features/viewers/lib/pptxEngine.ts';
import {
  parseXmlTree,
  decodeXmlEntities,
  resolveColorFromNode,
  resolveGradientCss,
  findDescendant,
} from '../src/features/viewers/lib/pptxXmlUtils.ts';

async function runTests() {
  console.log('🧪 开始 PowerPoint (.pptx) 引擎与 AST 解析流水线自动化测试 (15 项)...');

  // --- 测试 1: 动态生成标准规范 PPTX 容器 ---
  console.log('--- 测试 1: 生成标准规范 PPTX 容器 ---');
  const sampleBytes = await generateSamplePptxBytes();
  assert(sampleBytes && sampleBytes.length > 0, '样例 PPTX 字节流生成失败');
  assert(sampleBytes[0] === 0x50 && sampleBytes[1] === 0x4B, 'PPTX 必须符合标准 PK Zip 容器魔数头');
  console.log(`✅ 规范 PPTX 演示包生成成功，包大小: ${sampleBytes.length} 字节`);

  // --- 测试 2: OOXML 容器解包与母版/图表检索 ---
  console.log('--- 测试 2: OOXML 容器解包与母版/图表检索 ---');
  const zip = await JSZip.loadAsync(sampleBytes);
  assert(zip.file('ppt/presentation.xml'), '缺失 ppt/presentation.xml');
  assert(zip.file('ppt/slideMasters/slideMaster1.xml'), '缺失 slideMaster1.xml');
  assert(zip.file('ppt/slideLayouts/slideLayout1.xml'), '缺失 slideLayout1.xml');
  assert(zip.file('ppt/slides/slide1.xml'), '缺失 ppt/slides/slide1.xml 封面页');
  assert(zip.file('ppt/slides/slide2.xml'), '缺失 ppt/slides/slide2.xml 内容页');
  assert(zip.file('ppt/slides/slide3.xml'), '缺失 ppt/slides/slide3.xml 矩阵页');
  assert(zip.file('ppt/charts/chart1.xml'), '缺失 ppt/charts/chart1.xml 原生图表');
  console.log('✅ OOXML 幻灯片、母版与原生图表归档结构正确');

  // --- 测试 3: parsePptx 完整流水线解析与元数据提取 ---
  console.log('--- 测试 3: parsePptx 完整流水线解析 ---');
  const parsed = await parsePptx(sampleBytes);
  assert.strictEqual(parsed.isValid, true);
  assert.strictEqual(parsed.metadata.slideCount, 3, '应当解析出 3 张幻灯片');
  assert.strictEqual(parsed.metadata.aspectRatio, '16:9', '幻灯片比例应当为 16:9');
  assert.strictEqual(parsed.metadata.title, 'OmniView PowerPoint 架构演示文稿');
  assert.strictEqual(parsed.metadata.creator, 'OmniView Architecture Team');
  assert.strictEqual(parsed.metadata.notesCount, 3, '应当统计出 3 张备注页');
  assert.strictEqual(parsed.metadata.chartCount, 1, '应当统计出 1 个原生图表');
  console.log(`✅ 元数据解析正确: 《${parsed.metadata.title}》 比例: ${parsed.metadata.aspectRatio}`);

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

  // --- 测试 6: 损坏数据自愈降级与 isFallbackUsed 标记 ---
  console.log('--- 测试 6: 损坏数据自愈降级与降级标记 ---');
  const corruptInput = new Uint8Array([0x99, 0x88, 0x77]);
  const parsedCorrupt = await parsePptx(corruptInput);
  assert.strictEqual(parsedCorrupt.isValid, true, '自愈降级后应提供完整可用的样例文稿');
  assert.strictEqual(parsedCorrupt.slides.length, 3);
  assert.strictEqual(parsedCorrupt.isFallbackUsed, true, '降级渲染应明确标记 isFallbackUsed = true');
  console.log('✅ PPTX 异常自愈降级与标记验证通过');

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
  console.log(`✅ 图片节点解包正确: ${imgEl.imageAlt}`);

  // --- 测试 9: 表格结构与列宽比提取 ---
  console.log('--- 测试 9: 表格结构与单元格/列宽提取 ---');
  const slide3 = parsed.slides[2];
  const tableEl = slide3.elements.find(el => el.type === 'table');
  assert(tableEl, '第 3 页应当成功解析出特性支持矩阵表格');
  assert(tableEl.tableRows && tableEl.tableRows.length >= 3, '表格应当至少有 3 行');
  assert(tableEl.colWidthsPct && tableEl.colWidthsPct.length === 3, '应精确提取 3 列百分比宽度');
  assert.strictEqual(tableEl.tableRows[0][0].text, '格式类型', '表头第一格文本匹配');
  assert.strictEqual(tableEl.tableRows[0][0].isHeader, true, '首行应为表头');
  console.log(`✅ 表格矩阵与列宽比提取正确: ${tableEl.colWidthsPct.join('% / ')}%`);

  // --- 测试 10: 轻量 XML AST 嵌套标签/注释/CDATA/实体边界测试 ---
  console.log('--- 测试 10: XML AST 嵌套与实体边界验证 ---');
  const ast = parseXmlTree(
    `<root attr="a &gt; b"><!-- ignore <tag/> --><item x="1"><![CDATA[raw <text> & amp]]></item><self a="2"/></root>`
  );
  const itemNode = findDescendant(ast, 'item');
  assert(itemNode && itemNode.text.includes('raw <text> & amp'), 'CDATA 原始内容应当完整保留');
  assert.strictEqual(findDescendant(ast, 'root')?.attrs.attr, 'a > b', '属性值 XML 实体应解码');
  assert.strictEqual(decodeXmlEntities('A &amp; B &#65; &#x42;'), 'A & B A B', '命名与数值实体解码正确');
  console.log('✅ XML AST 解析边界测试通过');

  // --- 测试 11: 组合图形 <p:grpSp> 坐标映射与母版继承验证 ---
  console.log('--- 测试 11: 组合图形子坐标映射与母版背景继承 ---');
  assert(slide1.backgroundGradient && slide1.backgroundGradient.includes('linear-gradient'), '封面页应从 slideMaster1 继承渐变背景');
  assert.strictEqual(slide2.layoutName, '标准母版版式', '应解析并挂载版式名称');
  const arrowShapes = slide2.elements.filter(el => el.type === 'shape' && el.shapeType === 'rightArrow');
  assert.strictEqual(arrowShapes.length, 2, '第 2 页 grpSp 组合中的 2 个右向箭头应全部解包');
  assert(arrowShapes[0].x > 60 && arrowShapes[1].x > arrowShapes[0].x, 'grpSp 子元素应经 chOff/chExt 映射至幻灯片绝对坐标');
  console.log(`✅ grpSp 组合图形与母版背景继承验证通过 (${arrowShapes.map(a => a.x).join('pt -> ')}pt)`);

  // --- 测试 12: 原生图表 chart1.xml 解析验证 ---
  console.log('--- 测试 12: 原生内嵌图表 chart1.xml 解析 ---');
  const chartEl = slide3.elements.find(el => el.type === 'chart');
  assert(chartEl && chartEl.chartData, '第 3 页应当解析出原生图表元素');
  assert.strictEqual(chartEl.chartData.chartType, 'col');
  assert.strictEqual(chartEl.chartData.title, '各格式解包耗时对比 (ms)');
  assert.deepStrictEqual(chartEl.chartData.categories, ['PPTX', 'DOCX', 'XLSX']);
  assert.strictEqual(chartEl.chartData.series.length, 2);
  assert.deepStrictEqual(chartEl.chartData.series[0].values, [18, 24, 15]);
  console.log('✅ chart1.xml 柱状图类别、多系列数值与主题配色提取正确');

  // --- 测试 13: <p:sldIdLst> 自定义乱序页序、隐藏页 (show="0") 与合并表格 ---
  console.log('--- 测试 13: 乱序 sldIdLst、隐藏页与合并单元格表格 ---');
  const customZip = new JSZip();
  customZip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:sldSz cx="12192000" cy="6858000"/>
      <p:sldIdLst>
        <p:sldId id="257" r:id="rId2"/>
        <p:sldId id="256" r:id="rId1"/>
      </p:sldIdLst>
    </p:presentation>`
  );
  customZip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
    </Relationships>`
  );
  customZip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody>
        <a:p><a:pPr><a:buAutoNum type="arabicPeriod" startAt="3"/></a:pPr><a:r><a:t>Item Three</a:t></a:r></a:p>
        <a:p><a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:t>Item Four</a:t></a:r></a:p>
      </a:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`
  );
  customZip.file(
    'ppt/slides/slide2.xml',
    `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" show="0">
      <p:cSld><p:spTree>
        <p:sp><p:txBody><a:p><a:r><a:t>Hidden First Slide</a:t></a:r></a:p></p:txBody></p:sp>
        <p:graphicFrame><p:xfrm><a:off x="0" y="0"/><a:ext cx="1270000" cy="1270000"/></p:xfrm>
          <a:graphic><a:graphicData><a:tbl>
            <a:tblGrid><a:gridCol w="100"/><a:gridCol w="100"/></a:tblGrid>
            <a:tr h="500000"><a:tc gridSpan="2"><a:txBody><a:p><a:r><a:t>MergedHeader</a:t></a:r></a:p></a:txBody></a:tc><a:tc hMerge="1"/></a:tr>
          </a:tbl></a:graphicData></a:graphic>
        </p:graphicFrame>
      </p:spTree></p:cSld>
    </p:sld>`
  );
  const customBytes = await customZip.generateAsync({ type: 'uint8array' });
  const customParsed = await parsePptx(customBytes);
  assert.strictEqual(customParsed.slides.length, 2);
  assert.strictEqual(customParsed.slides[0].title, 'Hidden First Slide', '必须严格遵循 sldIdLst 将 slide2 排在第一位');
  assert.strictEqual(customParsed.slides[0].isHidden, true, 'show="0" 应标记 isHidden');
  const autoPara = customParsed.slides[1].elements[0].paragraphs;
  assert.strictEqual(autoPara?.[0].autoNumIndex, 3, 'buAutoNum startAt="3" 应从 3 编号');
  assert.strictEqual(autoPara?.[1].autoNumIndex, 4, '连续 buAutoNum 应递增至 4');
  const mergedTbl = customParsed.slides[0].elements.find(e => e.type === 'table');
  assert.strictEqual(mergedTbl?.tableRows?.[0][0].colSpan, 2);
  assert.strictEqual(mergedTbl?.tableRows?.[0][1].mergedSkip, true);
  console.log('✅ 自定义页序、隐藏页、自动编号与跨列合并表格验证通过');

  // --- 测试 14: 主题色彩修饰符 (tint / shade / alpha / gradFill) ---
  console.log('--- 测试 14: 主题色彩修饰符与渐变 CSS 解析 ---');
  const tintTree = parseXmlTree(`<a:solidFill><a:schemeClr val="accent1"><a:tint val="50000"/></a:schemeClr></a:solidFill>`);
  const tintedHex = resolveColorFromNode(findDescendant(tintTree, 'solidFill'), { accent1: '#000000' });
  assert.strictEqual(tintedHex, '#808080', '50% tint on #000000 应产生 #808080');
  const alphaTree = parseXmlTree(`<a:solidFill><a:srgbClr val="3B82F6"><a:alpha val="50000"/></a:srgbClr></a:solidFill>`);
  const alphaCss = resolveColorFromNode(findDescendant(alphaTree, 'solidFill'), {});
  assert.strictEqual(alphaCss, 'rgba(59, 130, 246, 0.5)');
  const gradTree = parseXmlTree(`<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill>`);
  const gradCss = resolveGradientCss(findDescendant(gradTree, 'gradFill'), {});
  assert(gradCss && gradCss.startsWith('linear-gradient(90deg, #FFFFFF 0%, #000000 100%)'), `渐变 CSS 不匹配: ${gradCss}`);
  console.log('✅ OOXML tint / alpha / linear-gradient 运算精确无误');

  // --- 测试 15: pptxToMarkdown 与 buildPptxPrintHtml 导出验证 ---
  console.log('--- 测试 15: Markdown 导出与可打印 HTML 构建 ---');
  const md = pptxToMarkdown(parsed);
  assert(md.includes('# OmniView PowerPoint 架构演示文稿'), 'Markdown 应含主标题');
  assert(md.includes('| 格式类型 | 渲染引擎模式 | 离线安全性 |'), 'Markdown 应含规范表格');
  assert(md.includes('演讲者备注'), 'Markdown 应含演讲者备注');
  const printHtml = buildPptxPrintHtml(parsed, { includeNotes: true });
  assert(printHtml.includes('@media print') && printHtml.includes('print-slide-wrap'), '打印 HTML 应含分页打印样式');
  assert(printHtml.includes('备注 #1'), 'includeNotes=true 应包含备注面板');
  console.log('✅ Markdown 结构化导出与打印 HTML 构建验证通过');

  // --- 测试 16: 母版/版式占位符 (<p:ph idx="1"/> 无 type 属性) 与模板提示文本 ("单击此处编辑模版文本样式" / "第二级" / "‹#›") 彻底过滤 ---
  console.log('--- 测试 16: 母版/版式占位符与模板编辑提示语过滤 ---');
  const masterFilterZip = new JSZip();
  masterFilterZip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:sldSz cx="12192000" cy="6858000"/>
      <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
    </p:presentation>`
  );
  masterFilterZip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
    </Relationships>`
  );
  masterFilterZip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="标题占位符 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="635000" y="381000"/><a:ext cx="10922000" cy="889000"/></a:xfrm></p:spPr>
            <p:txBody><a:p><a:r><a:t>单击此处编辑母版标题样式</a:t></a:r></a:p></p:txBody>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="文本占位符 2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="635000" y="1524000"/><a:ext cx="10922000" cy="4572000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:p><a:r><a:t>单击此处编辑模版文本样式</a:t></a:r></a:p>
              <a:p><a:pPr lvl="1"/><a:r><a:t>第二级</a:t></a:r></a:p>
              <a:p><a:pPr lvl="2"/><a:r><a:t>第三级</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="4" name="编号区"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="10000000" y="6200000"/><a:ext cx="1270000" cy="381000"/></a:xfrm></p:spPr>
            <p:txBody><a:p><a:fld id="f1" type="slidenum"><a:t>‹#›</a:t></a:fld></a:p></p:txBody>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="5" name="隐藏装饰" hidden="1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1270000" cy="1270000"/></a:xfrm></p:spPr>
            <p:txBody><a:p><a:r><a:t>不应显示的隐藏元素</a:t></a:r></a:p></p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sldMaster>`
  );
  masterFilterZip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld name="标题和内容">
        <p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="内容占位符"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="889000" y="1651000"/><a:ext cx="10414000" cy="4318000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:p><a:r><a:t>单击此处编辑模版文本样式</a:t></a:r></a:p>
              <a:p><a:pPr lvl="1"/><a:r><a:t>第二级</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sldLayout>`
  );
  masterFilterZip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
    </Relationships>`
  );
  masterFilterZip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
    </Relationships>`
  );
  masterFilterZip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="内容 1"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
            <p:spPr/>
            <p:txBody><a:p><a:r><a:t>真实业务幻灯片正文</a:t></a:r></a:p></p:txBody>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="未编辑占位框"/><p:cNvSpPr/><p:nvPr><p:ph idx="2"/></p:nvPr></p:nvSpPr>
            <p:spPr/>
            <p:txBody>
              <a:p><a:r><a:t>单击此处编辑模版文本样式</a:t></a:r></a:p>
              <a:p><a:r><a:t>第二级</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sld>`
  );
  const masterFilterParsed = await parsePptx(await masterFilterZip.generateAsync({ type: 'uint8array' }));
  const mfSlide = masterFilterParsed.slides[0];
  const allSlideTexts = mfSlide.elements
    .flatMap(e => e.paragraphs || [])
    .flatMap(p => p.runs.map(r => r.text))
    .join(' | ');
  assert(!allSlideTexts.includes('单击此处编辑'), `不应泄露母版编辑提示文本: ${allSlideTexts}`);
  assert(!allSlideTexts.includes('第二级'), `不应泄露母版多级示例文本: ${allSlideTexts}`);
  assert(!allSlideTexts.includes('‹#›'), `不应泄露母版页码字段占位符: ${allSlideTexts}`);
  assert(!allSlideTexts.includes('不应显示的隐藏元素'), `不应渲染 hidden="1" 的隐藏节点: ${allSlideTexts}`);
  assert(allSlideTexts.includes('真实业务幻灯片正文'), '真实业务正文必须正常保留');
  const bodyEl = mfSlide.elements.find(e => e.type === 'text');
  assert.strictEqual(bodyEl?.x, emuToPt(889000), '无 type 属性的 <p:ph idx="1"/> 应继承版式对应 idx 几何坐标');
  console.log('✅ 母版/版式占位符、模版编辑提示文本、‹#› 字段与隐藏节点过滤验证通过');

  console.log('\n🎉 全部 16 项 PowerPoint (.pptx) AST 引擎、图表、母版与导出测试 100% 通过！\n');
}

runTests().catch(err => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
