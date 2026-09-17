/**
 * OmniView 原生 Word (.docx) 解析与离线渲染核心引擎
 * 基于 OOXML (Office Open XML) 容器标准与 JSZip / docx-preview 纯前端流水线
 */
import JSZip from 'jszip';
import { renderAsync, type DocxOptions } from 'docx-preview';

export interface DocxMetadata {
  title?: string;
  creator?: string;
  description?: string;
  created?: string;
  modified?: string;
  pageCount?: number;
  wordCount?: number;
}

export interface ParsedDocxDocument {
  rawBytes: Uint8Array;
  metadata: DocxMetadata;
  isValid: boolean;
}

/**
 * 将 Base64 字符串快速还原为 Uint8Array 二进制数组
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
  // Node.js 环境兼容
  return Uint8Array.from(Buffer.from(clean, 'base64'));
}

/**
 * 解析 docx 压缩包元数据 (docProps/core.xml 与 docProps/app.xml)
 */
export async function extractDocxMetadata(zip: JSZip): Promise<DocxMetadata> {
  const metadata: DocxMetadata = {
    title: 'Word 文档',
  };

  try {
    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const xml = await coreFile.async('text');
      const titleMatch = xml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      if (titleMatch) metadata.title = titleMatch[1].trim();

      const creatorMatch = xml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      if (creatorMatch) metadata.creator = creatorMatch[1].trim();

      const descMatch = xml.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
      if (descMatch) metadata.description = descMatch[1].trim();

      const createdMatch = xml.match(/<dcterms:created[^>]*>([\s\S]*?)<\/dcterms:created>/i);
      if (createdMatch) metadata.created = createdMatch[1].trim();
    }

    const appFile = zip.file('docProps/app.xml');
    if (appFile) {
      const xml = await appFile.async('text');
      const pagesMatch = xml.match(/<Pages>(\d+)<\/Pages>/i);
      if (pagesMatch) metadata.pageCount = parseInt(pagesMatch[1], 10);

      const wordsMatch = xml.match(/<Words>(\d+)<\/Words>/i);
      if (wordsMatch) metadata.wordCount = parseInt(wordsMatch[1], 10);
    }
  } catch (err) {
    console.warn('[DocxEngine] 元数据解析警告:', err);
  }

  return metadata;
}

/**
 * 动态生成规范的样例 Word (.docx) 二进制包，用于自愈降级与无网离线预览
 */
export async function generateSampleDocxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );

  // 3. docProps/core.xml
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>OmniView Word 高保真文档指南</dc:title>
  <dc:creator>OmniView Architecture Team</dc:creator>
  <dc:description>OmniView 纯离线 Word (.docx) 高保真只读渲染引擎示例文档</dc:description>
  <dcterms:created>2026-09-17T00:00:00Z</dcterms:created>
</cp:coreProperties>`
  );

  // 4. word/document.xml (主文档正文)
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="48"/>
          <w:color w:val="2563EB"/>
        </w:rPr>
        <w:t>OmniView Word (.docx) 高保真离线文档</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
          <w:sz w:val="24"/>
          <w:color w:val="64748B"/>
        </w:rPr>
        <w:t>纯前端零外网依赖 · 拟真 A4 出版级排版 · 支持表格与复杂段落</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
        </w:rPr>
        <w:t>一、核心特性与排版能力</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>本渲染驱动基于 Office Open XML (OOXML) 标准，无需 Microsoft Word 或第三方云端服务，直接在 VS Code 隔离沙箱与浏览器中将 DOCX 完美编译为高保真 HTML5/CSS3 拟真纸张。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>支持 50% ~ 200% 无级平滑缩放、双栏多列、表格单元格合并、行内图片以及全套 11 种设计令牌主题自适应。</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>排版维度</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>支持状态</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>技术标准</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>A4 拟真分页</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>CSS Paged Media 210mm x 297mm</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>复杂表格排版</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>单元格合并、边框与底纹</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>多主题夜间模式</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>--ov-* 语义化设计令牌体系</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
  );

  return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * 解析 docx 文件数据
 */
export async function parseDocx(data: Uint8Array | ArrayBuffer | string): Promise<ParsedDocxDocument> {
  let rawBytes: Uint8Array;

  if (typeof data === 'string') {
    if (data.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(data.trim())) {
      rawBytes = base64ToBytes(data);
    } else {
      rawBytes = await generateSampleDocxBytes();
    }
  } else if (data instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(data);
  } else {
    rawBytes = data;
  }

  try {
    const zip = await JSZip.loadAsync(rawBytes);
    const metadata = await extractDocxMetadata(zip);
    return {
      rawBytes,
      metadata,
      isValid: true,
    };
  } catch (err) {
    console.warn('[DocxEngine] 加载 docx 失败，降级至样例文档:', err);
    const fallbackBytes = await generateSampleDocxBytes();
    const fallbackZip = await JSZip.loadAsync(fallbackBytes);
    const metadata = await extractDocxMetadata(fallbackZip);
    return {
      rawBytes: fallbackBytes,
      metadata,
      isValid: false,
    };
  }
}

/**
 * 纯前端高保真渲染 docx 到指定 DOM 容器
 */
export async function renderDocxToContainer(
  bytes: Uint8Array | ArrayBuffer,
  container: HTMLElement,
  options: Partial<DocxOptions> = {}
): Promise<void> {
  const mergedOptions: DocxOptions = {
    className: 'docx-rendered-wrapper',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    trimXmlDeclaration: true,
    ...options,
  };

  container.innerHTML = '';
  await renderAsync(bytes, container, undefined, mergedOptions);
}
