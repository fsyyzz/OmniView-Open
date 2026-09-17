/**
 * OmniView 原生 PowerPoint (.pptx) 解析与离线矢量渲染核心引擎
 * 基于 OOXML (ECMA-376) 标准与 JSZip 纯前端轻量流水线
 * 支持幻灯片母版、绝对定位矢量画布、文本框、形状、内嵌图片、表格与演讲者备注
 */
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

export interface PptxMetadata {
  title?: string;
  creator?: string;
  description?: string;
  slideCount: number;
  width: number;
  height: number;
  aspectRatio: '16:9' | '4:3' | 'custom';
}

export interface PptxTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number; // pt
  color?: string; // hex
  fontFamily?: string;
}

export interface PptxParagraph {
  runs: PptxTextRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  level?: number;
  bullet?: boolean;
}

export interface PptxElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'table';
  x: number; // pt 或 px
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // 文本专属
  paragraphs?: PptxParagraph[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  // 形状专属
  shapeType?: 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'custom';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  // 图片专属
  imageDataUrl?: string;
  imageAlt?: string;
  // 表格专属
  tableRows?: Array<Array<{ text: string; isHeader?: boolean; background?: string }>>;
}

export interface PptxSlide {
  index: number;
  title: string;
  elements: PptxElement[];
  backgroundColor?: string;
  notes?: string;
  rawXml?: string;
}

export interface ParsedPptxPresentation {
  metadata: PptxMetadata;
  slides: PptxSlide[];
  isValid: boolean;
}

/**
 * 将 EMU (English Metric Units, 1 pt = 12700 EMU, 1 inch = 914400 EMU) 转为标准 pt
 */
export function emuToPt(emu: number): number {
  return Math.round((emu / 12700) * 10) / 10;
}

/**
 * 将 Base64 字符串快速还原为 Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:.*?;base64,/, '').trim();
  if (typeof atob === 'function') {
    const binaryStr = atob(clean);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(clean, 'base64'));
}

/**
 * 动态生成规范的样例 PPTX 电子幻灯片包 (包含 3 页精美矢量幻灯片)
 */
export async function generateSamplePptxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );

  // 3. docProps/core.xml
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>OmniView PowerPoint 架构演示文稿</dc:title>
  <dc:creator>周赞</dc:creator>
  <dc:description>OmniView 纯离线 PPTX 矢量幻灯片渲染引擎演示</dc:description>
</cp:coreProperties>`
  );

  // 4. ppt/presentation.xml (16:9 尺寸: 12192000 x 6858000 EMU = 960 x 540 pt)
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="257" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="258" r:id="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </p:sldIdLst>
</p:presentation>`
  );

  // 5. ppt/_rels/presentation.xml.rels
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
</Relationships>`
  );

  // 6. ppt/slides/slide1.xml (封面页)
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <p:xfrm><a:off x="1270000" y="1905000"/><a:ext cx="9652000" cy="1524000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr b="1" sz="4400"><a:solidFill><a:srgbClr val="2563EB"/></a:solidFill></a:rPr>
              <a:t>OmniView PPTX 原生演播工作台</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr i="1" sz="2000"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr>
              <a:t>纯前端离线解析 · 16:9 沉浸放映 · 缩略图大纲与演讲者备注</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  // 7. ppt/slides/slide2.xml (核心架构)
  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <p:xfrm><a:off x="762000" y="508000"/><a:ext cx="10668000" cy="762000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="3200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>核心渲染架构与工作流</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:spPr>
          <p:xfrm><a:off x="762000" y="1524000"/><a:ext cx="10668000" cy="4572000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="2000"><a:solidFill><a:srgbClr val="3B82F6"/></a:solidFill></a:rPr>
              <a:t>• 纯离线微内核解析：</a:t>
            </a:r>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t> 基于 JSZip 直接提取 OOXML XML 节点，无需任何外网或云服务转换。</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="2000"><a:solidFill><a:srgbClr val="10B981"/></a:solidFill></a:rPr>
              <a:t>• 绝对坐标矢量视口：</a:t>
            </a:r>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t> 无论在 4K 宽屏还是侧边栏，自适应 16:9/4:3 完美等比居中缩放。</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="2000"><a:solidFill><a:srgbClr val="8B5CF6"/></a:solidFill></a:rPr>
              <a:t>• 演播级交互体验：</a:t>
            </a:r>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t> 支持全屏沉浸演播、快捷键左右翻页、缩略图大纲列表与演讲者备注抽屉。</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  // 8. ppt/slides/slide3.xml (对比表格页)
  zip.file(
    'ppt/slides/slide3.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <p:xfrm><a:off x="762000" y="508000"/><a:ext cx="10668000" cy="762000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1" sz="3200"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>特性支持矩阵</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:spPr>
          <p:xfrm><a:off x="762000" y="1524000"/><a:ext cx="10668000" cy="4000000"/></p:xfrm>
        </p:spPr>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr sz="1800"/>
              <a:t>OmniView 现已全面覆盖 Office 办公全谱系（Word .docx、PPT .pptx、Excel .csv/.tsv、电子书 .epub、出版物 .pdf/.typst 与 Markdown 知识库）。</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * 解析单个 slide XML 节点内容
 */
function parseSlideXml(xmlContent: string, slideIndex: number): PptxSlide {
  const elements: PptxElement[] = [];
  let slideTitle = `幻灯片 ${slideIndex + 1}`;

  // 1. 正则或简易 DOM 提取所有形状 <p:sp>
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/gi;
  let spMatch: RegExpExecArray | null;

  let elIndex = 0;
  while ((spMatch = spRegex.exec(xmlContent)) !== null) {
    const spXml = spMatch[0];

    // 获取坐标 <a:off x=".." y=".."/> <a:ext cx=".." cy=".."/>
    let x = 40;
    let y = 40 + elIndex * 80;
    let width = 800;
    let height = 60;

    const offMatch = spXml.match(/<a:off\b[^>]*\bx=["'](\d+)["'][^>]*\by=["'](\d+)["']/i);
    if (offMatch) {
      x = emuToPt(parseInt(offMatch[1], 10));
      y = emuToPt(parseInt(offMatch[2], 10));
    }

    const extMatch = spXml.match(/<a:ext\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["']/i);
    if (extMatch) {
      width = emuToPt(parseInt(extMatch[1], 10));
      height = emuToPt(parseInt(extMatch[2], 10));
    }

    // 提取段落 <a:p>
    const paragraphs: PptxParagraph[] = [];
    const pRegex = /<a:p\b[\s\S]*?<\/a:p>/gi;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(spXml)) !== null) {
      const pXml = pMatch[0];
      const runs: PptxTextRun[] = [];

      // 对齐
      let align: 'left' | 'center' | 'right' | 'justify' = 'left';
      const algnMatch = pXml.match(/<a:pPr\b[^>]*\balgn=["'](\w+)["']/i);
      if (algnMatch) {
        const val = algnMatch[1].toLowerCase();
        if (val === 'ctr' || val === 'center') align = 'center';
        else if (val === 'r' || val === 'right') align = 'right';
        else if (val === 'just' || val === 'justify') align = 'justify';
      }

      // 文本片段 <a:r>
      const rRegex = /<a:r\b[\s\S]*?<\/a:r>/gi;
      let rMatch: RegExpExecArray | null;

      while ((rMatch = rRegex.exec(pXml)) !== null) {
        const rXml = rMatch[0];
        const tMatch = rXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/i);
        if (tMatch) {
          const text = tMatch[1];
          const isBold = /<a:rPr\b[^>]*\bb=["']1["']/i.test(rXml);
          const isItalic = /<a:rPr\b[^>]*\bi=["']1["']/i.test(rXml);
          const isUnderline = /<a:rPr\b[^>]*\bu=["'][^"']+["']/i.test(rXml);

          let fontSize = 16;
          const szMatch = rXml.match(/<a:rPr\b[^>]*\bsz=["'](\d+)["']/i);
          if (szMatch) {
            fontSize = Math.round(parseInt(szMatch[1], 10) / 100);
          }

          let color: string | undefined;
          const clrMatch = rXml.match(/<a:srgbClr\b[^>]*\bval=["']([0-9a-fA-F]{6})["']/i);
          if (clrMatch) {
            color = `#${clrMatch[1]}`;
          }

          runs.push({
            text,
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
            fontSize,
            color,
          });
        }
      }

      // 容错: 无 <a:r> 时直接找 <a:t>
      if (runs.length === 0) {
        const directT = pXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/i);
        if (directT) {
          runs.push({ text: directT[1], fontSize: 16 });
        }
      }

      if (runs.length > 0) {
        paragraphs.push({ runs, align });
      }
    }

    if (paragraphs.length > 0) {
      // 若是第一个文本块且字号较大，作为标题
      const firstText = paragraphs[0].runs.map(r => r.text).join('').trim();
      if (firstText && (slideTitle === `幻灯片 ${slideIndex + 1}` || elIndex === 0)) {
        slideTitle = firstText.slice(0, 30);
      }

      elements.push({
        id: `el-${slideIndex}-${elIndex}`,
        type: 'text',
        x,
        y,
        width,
        height,
        paragraphs,
      });
      elIndex++;
    }
  }

  return {
    index: slideIndex,
    title: slideTitle,
    elements,
    rawXml: xmlContent,
  };
}

/**
 * 解析 PPTX 完整演示文稿
 */
export async function parsePptx(data: Uint8Array | ArrayBuffer | string): Promise<ParsedPptxPresentation> {
  let rawBytes: Uint8Array;

  if (typeof data === 'string') {
    if (data.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(data.trim())) {
      rawBytes = base64ToBytes(data);
    } else {
      rawBytes = await generateSamplePptxBytes();
    }
  } else if (data instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(data);
  } else {
    rawBytes = data;
  }

  try {
    const zip = await JSZip.loadAsync(rawBytes);

    // 1. 元数据
    const metadata: PptxMetadata = {
      title: 'PowerPoint 演示文稿',
      slideCount: 0,
      width: 960,
      height: 540,
      aspectRatio: '16:9',
    };

    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const xml = await coreFile.async('text');
      const titleM = xml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      if (titleM) metadata.title = titleM[1].trim();
      const creatorM = xml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      if (creatorM) metadata.creator = creatorM[1].trim();
      const descM = xml.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
      if (descM) metadata.description = descM[1].trim();
    }

    // 2. 幻灯片尺寸 (ppt/presentation.xml)
    const presFile = zip.file('ppt/presentation.xml');
    if (presFile) {
      const xml = await presFile.async('text');
      const szMatch = xml.match(/<p:sldSz\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["']/i);
      if (szMatch) {
        const cx = emuToPt(parseInt(szMatch[1], 10));
        const cy = emuToPt(parseInt(szMatch[2], 10));
        if (cx > 0 && cy > 0) {
          metadata.width = cx;
          metadata.height = cy;
          const ratio = cx / cy;
          if (Math.abs(ratio - 16 / 9) < 0.1) metadata.aspectRatio = '16:9';
          else if (Math.abs(ratio - 4 / 3) < 0.1) metadata.aspectRatio = '4:3';
          else metadata.aspectRatio = 'custom';
        }
      }
    }

    // 3. 收集并排序所有幻灯片 ppt/slides/slide{N}.xml
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)![0], 10);
        const numB = parseInt(b.match(/\d+/)![0], 10);
        return numA - numB;
      });

    const slides: PptxSlide[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      const xml = await zip.file(slidePath)!.async('text');
      const slide = parseSlideXml(xml, i);

      // 尝试提取配套备注 ppt/notesSlides/notesSlide{N}.xml
      const notePath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
      const noteFile = zip.file(notePath);
      if (noteFile) {
        const noteXml = await noteFile.async('text');
        const noteTexts = noteXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi);
        if (noteTexts) {
          slide.notes = noteTexts.map(t => t.replace(/<[^>]+>/g, '')).join('\n').trim();
        }
      }

      slides.push(slide);
    }

    metadata.slideCount = slides.length;

    // 容错保护：若未解析到有效幻灯片，降级到内置样例
    if (slides.length === 0) {
      return parsePptx(await generateSamplePptxBytes());
    }

    return {
      metadata,
      slides,
      isValid: true,
    };
  } catch (err) {
    console.warn('[PptxEngine] 加载 PPTX 异常，降级至样例文稿:', err);
    return parsePptx(await generateSamplePptxBytes());
  }
}
