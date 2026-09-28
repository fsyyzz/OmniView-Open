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

export interface DocxTocItem {
  id: string;
  text: string;
  level: number;
  element?: HTMLElement;
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
  const clean = base64.replace(/^data:.*?;base64,/, '').replace(/\s+/g, '');
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
 * 从已渲染的 DOCX DOM 节点中精准智能提取层级标题与大纲 (TocItems)
 */
export function extractHeadingsFromDom(container: HTMLElement): DocxTocItem[] {
  if (!container) return [];

  // 选择 HTML 标题元素及 docx-preview 渲染的 heading 节点
  const selector = 'h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="Heading"], [class*="docx-p-heading"]';
  const rawHeadingEls = Array.from(container.querySelectorAll<HTMLElement>(selector));

  const items: DocxTocItem[] = [];

  rawHeadingEls.forEach((el, index) => {
    // 拦截并排除 Word 自动生成的目录页 (TOC Block) 节点
    if (
      el.closest('[class*="toc"], [class*="TOC"], .docx-toc, .word-toc, sdt') ||
      /\btoc[0-9]?\b/i.test(el.className) ||
      /\bdocx-p-toc\b/i.test(el.className)
    ) {
      return;
    }

    let text = el.textContent?.trim() || '';
    if (!text) return;

    // 剔除目录条目尾部的点线与页码 (如 "1.1 导航... 2")
    text = text.replace(/[\.\s·‥…\t]+\d+$/, '').trim();
    if (!text) return;

    // 再次检查文本是否为纯目录点线残余
    if (/[\.\s·‥…]{3,}\d+$/.test(el.textContent || '')) return;

    let level = 1;
    const tagName = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      level = parseInt(tagName.replace('h', ''), 10);
    } else {
      const className = el.className || '';
      const match = className.match(/heading\s*([1-6])/i) || className.match(/heading-([1-6])/i);
      if (match) {
        level = parseInt(match[1], 10);
      } else {
        level = 2;
      }
    }

    if (!el.id) {
      el.id = `docx-heading-${index}-${Math.random().toString(36).substring(2, 7)}`;
    }

    items.push({
      id: el.id,
      text,
      level,
      element: el,
    });
  });

  // 备用机制：若文档未应用官方 Word Heading 样式，扫描带有明显标题特征的段落 (同时过滤 TOC 区域)
  if (items.length === 0) {
    const paragraphs = Array.from(container.querySelectorAll<HTMLElement>('p, section > div, .docx-rendered-wrapper p'));
    let fallbackCount = 0;
    paragraphs.forEach((p) => {
      if (
        p.closest('[class*="toc"], [class*="TOC"], .docx-toc, .word-toc, sdt') ||
        /\btoc[0-9]?\b/i.test(p.className) ||
        /\bdocx-p-toc\b/i.test(p.className)
      ) {
        return;
      }

      let txt = p.textContent?.trim() || '';
      if (!txt || txt.length > 80 || fallbackCount >= 25) return;
      txt = txt.replace(/[\.\s·‥…\t]+\d+$/, '').trim();

      const style = window.getComputedStyle(p);
      const isBold = style.fontWeight === '700' || style.fontWeight === 'bold' || !!p.querySelector('b, strong');
      const isTitlePattern = /^[0-9一二三四五六七八九十]+[、.．\s]/.test(txt) || /^第[0-9一二三四五六七八九十]+[章节条]/i.test(txt);

      if (isBold || isTitlePattern) {
        if (!p.id) {
          p.id = `docx-heading-fb-${fallbackCount}-${Math.random().toString(36).substring(2, 7)}`;
        }

        let inferredLevel = 2;
        if (/^第[一二三四五六七八九十0-9]+章/.test(txt) || /^[一二三四五六七八九十]+[、.]/.test(txt)) {
          inferredLevel = 1;
        } else if (/^[0-9]+\.[0-9]+/.test(txt)) {
          inferredLevel = 3;
        }

        items.push({
          id: p.id,
          text: txt,
          level: inferredLevel,
          element: p,
        });
        fallbackCount++;
      }
    });
  }

  return items;
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
        <w:t>纯前端零外网依赖 · 拟真 A4 出版级排版 · 支持导航窗口与多级大纲</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>一、核心特性与排版能力</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>本渲染驱动基于 Office Open XML (OOXML) 标准，无需 Microsoft Word 或第三方云端服务，直接在 VS Code 隔离沙箱与浏览器中将 DOCX 编译为高保真 HTML5/CSS3 拟真纸张。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>1.1 导航窗口与多级大纲</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>新增全功能导航窗口 (Navigation Pane)，自动捕获文档中的 H1~H6 层级标题，支持实时检索筛选、多层级缩进显示以及平滑定位跳转。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>1.2 缩放与主题自适应</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>支持 50% ~ 200% 无级平滑缩放、双栏多列、表格单元格合并、行内图片以及原纸/羊皮/暗夜三大视觉滤镜主题。</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>二、排版支持度规格矩阵</w:t>
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
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>技术标准与响应表现</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>导航窗口 (Navigation Pane)</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>多级大纲树、检索过滤、平滑定位</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>A4 拟真分页</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>✅ 完全支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>CSS Paged Media 210mm x 297mm</w:t></w:r></w:p></w:tc>
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
    if (data.startsWith('data:') || /^[A-Za-z0-9+/=\s\r\n]+$/.test(data.trim())) {
      try {
        rawBytes = base64ToBytes(data);
      } catch {
        rawBytes = await generateSampleDocxBytes();
      }
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

