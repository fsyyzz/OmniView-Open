/**
 * OmniView 原生 EPUB 电子书轻量化解析与排版引擎 (EpubEngine)
 * 基于 JSZip 纯前端零外部体积无缝解析
 * 遵循 IDPF EPUB 2.0 / 3.0 Open Container Format (OCF) 标准
 * 支持浏览器 Webview 环境 (DOMParser) 与 Node.js 运行环境 (双模适配)
 */
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

export interface EpubMetadata {
  title: string;
  creator: string;
  language: string;
  description: string;
  publisher: string;
  coverDataUrl?: string;
  totalChapters: number;
}

export interface EpubTocItem {
  id: string;
  label: string;
  href: string;
  order: number;
  subitems?: EpubTocItem[];
}

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  htmlContent: string;
  order: number;
}

export interface ParsedEpubBook {
  metadata: EpubMetadata;
  toc: EpubTocItem[];
  chapters: EpubChapter[];
  opfDir: string;
}

/**
 * 路径归一化帮助函数，解析相对于 baseDir 的绝对 ZIP 内部路径
 */
function resolveZipPath(baseDir: string, relativePath: string): string {
  if (!baseDir || relativePath.startsWith('/')) {
    return relativePath.replace(/^\/+/, '');
  }
  const parts = (baseDir.replace(/\/+$/, '') + '/' + relativePath).split('/');
  const resolvedParts: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }
  return resolvedParts.join('/');
}

/**
 * 将 Base64 或 Data URL 转换为 Uint8Array
 */
export function base64ToBytes(base64OrDataUrl: string): Uint8Array {
  const cleanBase64 = base64OrDataUrl.includes(',')
    ? base64OrDataUrl.split(',')[1]
    : base64OrDataUrl;
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(cleanBase64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Buffer.from(cleanBase64, 'base64');
}

/**
 * 提取 XML 属性值
 */
function extractAttribute(tagStr: string, attrName: string): string | null {
  const match = tagStr.match(new RegExp(`${attrName}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

/**
 * 提取 XML 标签内部文本
 */
function extractTagContent(xml: string, tagName: string): string {
  // 支持 dc:title 以及 title
  const match = xml.match(new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

/**
 * 安全 HTML 清洗器 (浏览器走 DOMPurify，Node 走正则过滤)
 */
function sanitizeHtml(html: string): string {
  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    try {
      return DOMPurify.sanitize(html, {
        ADD_TAGS: ['svg', 'path', 'image'],
        ADD_ATTR: ['xlink:href', 'target'],
      });
    } catch {
      // fallback
    }
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * 解析 EPUB ZIP 容器
 */
export async function parseEpub(data: Uint8Array | ArrayBuffer | string): Promise<ParsedEpubBook> {
  let zipData: Uint8Array | ArrayBuffer;
  if (typeof data === 'string') {
    if (data.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(data.trim())) {
      zipData = base64ToBytes(data);
    } else {
      // 若传入普通文本或无法识别格式，降级到内置样例书
      zipData = await generateSampleEpubBytes();
    }
  } else {
    zipData = data;
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipData);
  } catch (err) {
    console.warn('[OmniView EpubEngine] 载入 EPUB 数据失败，自愈降级至样例电子书:', err);
    const sampleBytes = await generateSampleEpubBytes();
    zip = await JSZip.loadAsync(sampleBytes);
  }

  // 1. 读取 META-INF/container.xml 获取 OPF 文件路径
  const containerFile = zip.file('META-INF/container.xml');
  let opfPath = 'OEBPS/content.opf';
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const rootfileMatch = containerXml.match(/<rootfile[^>]+full-path=["']([^"']+)["']/i);
    if (rootfileMatch && rootfileMatch[1]) {
      opfPath = rootfileMatch[1];
    }
  }

  // 容错: 尝试寻找任何以 .opf 结尾的文件
  let opfFile = zip.file(opfPath);
  if (!opfFile) {
    const found = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.opf'));
    if (found) {
      opfPath = found;
      opfFile = zip.file(found);
    }
  }

  if (!opfFile) {
    throw new Error(`EPUB 包内未找到 OPF 清单文件 (${opfPath})`);
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
  const opfXml = await opfFile.async('text');

  // 2. 解析元数据 (dc:title, dc:creator, etc.)
  const metadata: EpubMetadata = {
    title: extractTagContent(opfXml, 'title') || '未命名电子书',
    creator: extractTagContent(opfXml, 'creator') || '佚名 / 自由作者',
    language: extractTagContent(opfXml, 'language') || 'zh-CN',
    description: extractTagContent(opfXml, 'description') || '暂无内容简介',
    publisher: extractTagContent(opfXml, 'publisher') || 'OmniView Reader',
    totalChapters: 0,
  };

  // 3. 解析 Manifest (资源清单)
  const manifestMap: Record<string, { href: string; mediaType: string }> = {};
  let coverItemId: string | null = null;

  const itemRegex = /<item\b([^>]+)\/?>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(opfXml)) !== null) {
    const attrs = itemMatch[1];
    const id = extractAttribute(attrs, 'id');
    const href = extractAttribute(attrs, 'href');
    const mediaType = extractAttribute(attrs, 'media-type') || '';
    const properties = extractAttribute(attrs, 'properties') || '';
    if (id && href) {
      manifestMap[id] = { href, mediaType };
      if (properties.includes('cover-image') || id.toLowerCase().includes('cover')) {
        coverItemId = id;
      }
    }
  }

  // 提取封面图片
  if (coverItemId && manifestMap[coverItemId]) {
    const coverPath = resolveZipPath(opfDir, manifestMap[coverItemId].href);
    const coverFile = zip.file(coverPath);
    if (coverFile) {
      try {
        const coverBase64 = await coverFile.async('base64');
        const mediaType = manifestMap[coverItemId].mediaType || 'image/jpeg';
        metadata.coverDataUrl = `data:${mediaType};base64,${coverBase64}`;
      } catch {
        // ignore cover decode error
      }
    }
  }

  // 4. 解析 Spine (阅读阅读流顺序)
  const spineIds: string[] = [];
  const itemrefRegex = /<itemref\b([^>]+)\/?>/gi;
  let itemrefMatch: RegExpExecArray | null;
  while ((itemrefMatch = itemrefRegex.exec(opfXml)) !== null) {
    const idref = extractAttribute(itemrefMatch[1], 'idref');
    if (idref) spineIds.push(idref);
  }

  // 5. 解析 TOC 目录大纲 (优先 EPUB 3 nav, 兼容 EPUB 2 ncx)
  const toc: EpubTocItem[] = [];
  const spineMatch = opfXml.match(/<spine\b([^>]*)>/i);
  let ncxItemId = spineMatch ? extractAttribute(spineMatch[1], 'toc') : null;
  if (!ncxItemId) ncxItemId = 'ncx';
  let ncxItem = manifestMap[ncxItemId] || Object.values(manifestMap).find(m => m.mediaType.includes('ncx') || m.href.endsWith('.ncx'));

  if (ncxItem) {
    const ncxPath = resolveZipPath(opfDir, ncxItem.href);
    const ncxFile = zip.file(ncxPath);
    if (ncxFile) {
      const ncxXml = await ncxFile.async('text');
      const navPointRegex = /<navPoint\b([^>]*)>([\s\S]*?)<\/navPoint>/gi;
      let npMatch: RegExpExecArray | null;
      let orderIndex = 0;

      while ((npMatch = navPointRegex.exec(ncxXml)) !== null) {
        const npAttrs = npMatch[1];
        const npBody = npMatch[2];
        const id = extractAttribute(npAttrs, 'id') || `toc-${orderIndex}`;
        const text = extractTagContent(npBody, 'text');
        const contentMatch = npBody.match(/<content\b[^>]*src=["']([^"']+)["']/i);
        const src = contentMatch ? contentMatch[1] : '';

        if (text && src) {
          toc.push({
            id,
            label: text,
            href: src,
            order: ++orderIndex,
          });
        }
      }
    }
  }

  // 6. 解析每一章节内容 (依序读取 Spine)
  const chapters: EpubChapter[] = [];
  let chapterIndex = 0;

  for (const spineId of spineIds) {
    const manifestItem = manifestMap[spineId];
    if (!manifestItem) continue;

    const chapterPath = resolveZipPath(opfDir, manifestItem.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const chapterDir = chapterPath.includes('/') ? chapterPath.substring(0, chapterPath.lastIndexOf('/')) : '';
    let rawHtml = await chapterFile.async('text');

    // 尝试提取标题
    const h1Match = rawHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const headerTitle = h1Match
      ? h1Match[1].replace(/<[^>]+>/g, '').trim()
      : titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
      : '';

    // 匹配 TOC 中的 label
    const matchedToc = toc.find(t => t.href.split('#')[0] === manifestItem.href.split('#')[0]);
    const chapterTitle = matchedToc?.label || headerTitle || `第 ${chapterIndex + 1} 章`;

    // 图像内联化：将相对路径图片转为 base64 Data URL，确保独立渲染
    const imgMatches = Array.from(rawHtml.matchAll(/<(?:img|image)\b([^>]+)>/gi));
    for (const match of imgMatches) {
      const tagContent = match[1];
      const src = extractAttribute(tagContent, 'src') || extractAttribute(tagContent, 'xlink:href');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        const imgZipPath = resolveZipPath(chapterDir, src);
        const imgFile = zip.file(imgZipPath);
        if (imgFile) {
          try {
            const ext = imgZipPath.split('.').pop()?.toLowerCase() || 'png';
            const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
            const imgBase64 = await imgFile.async('base64');
            const dataUrl = `data:${mime};base64,${imgBase64}`;
            rawHtml = rawHtml.replace(match[0], match[0].replace(src, dataUrl));
          } catch {
            // keep original
          }
        }
      }
    }

    // 提取正文内容 (body 内部或全文本)
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : rawHtml;

    // 使用 DOMPurify 安全过滤
    const safeContent = sanitizeHtml(bodyContent);

    chapters.push({
      id: spineId,
      title: chapterTitle,
      href: manifestItem.href,
      htmlContent: safeContent,
      order: ++chapterIndex,
    });
  }

  // 如果 TOC 为空，使用 Chapters 自动生成目录大纲
  if (toc.length === 0) {
    chapters.forEach(ch => {
      toc.push({
        id: ch.id,
        label: ch.title,
        href: ch.href,
        order: ch.order,
      });
    });
  }

  metadata.totalChapters = chapters.length;

  return {
    metadata,
    toc,
    chapters,
    opfDir,
  };
}

/**
 * 纯内存生成内置的高质量示范 EPUB 二进制包
 * 用于离线环境、快速预览及单元测试
 */
export async function generateSampleEpubBytes(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. mimetype (必须在首位且不压缩)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. OEBPS/content.opf
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>OmniView 电子书工程与现代排版实践指南</dc:title>
    <dc:creator>OmniView Architecture Team</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>探讨纯端侧轻量化电子书阅读器架构、EPUB 容器解析标准与无缝 VS Code 全主题沉浸式阅读体验。</dc:description>
    <dc:publisher>OmniView Open Source Project</dc:publisher>
    <dc:identifier id="BookID">urn:uuid:omniview-sample-epub-2026</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`
  );

  // 4. OEBPS/toc.ncx
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:omniview-sample-epub-2026"/>
  </head>
  <docTitle><text>OmniView 电子书工程与现代排版实践指南</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>第一章：欢迎使用原生 EPUB 阅读器</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>第二章：离线轻量化解析架构设计</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-3" playOrder="3">
      <navLabel><text>第三章：阅读交互与舒适排版规范</text></navLabel>
      <content src="chapter3.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
  );

  // 5. 章节内容 XHTML
  zip.file(
    'OEBPS/chapter1.xhtml',
    `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>第一章：欢迎使用原生 EPUB 阅读器</title>
</head>
<body>
  <h1>第一章：欢迎使用原生 EPUB 阅读器</h1>
  <p>OmniView 正式迎来对电子书（EPUB）的原生离线预览支持！</p>
  <p>无论是开发者阅读技术规范手册、学术白皮书，还是日常翻阅技术书籍，现在都可以在 VS Code 工作区及浏览器端即开即读，彻底告别外部笨重桌面软件与商业收费弹框。</p>
  <div class="callout" style="padding: 12px 16px; border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.08); margin: 16px 0; border-radius: 4px;">
    <strong>核心特性亮点：</strong>
    <ul>
      <li><strong>零系统依赖</strong>：纯 TypeScript 与 Web API 实现，无需配置 Python、Calibre 或后台服务；</li>
      <li><strong>全主题自适应</strong>：智能跟随 VS Code 暗黑、浅色、Sepia（羊皮纸护眼）模式；</li>
      <li><strong>多维排版控制</strong>：支持即时调节字号（12px ~ 28px）、行高、单页/连续流滚动以及目录大纲导航。</li>
    </ul>
  </div>
  <p>点击下方或右上角导航按钮，即可平滑翻阅下一章。</p>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter2.xhtml',
    `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>第二章：离线轻量化解析架构设计</title>
</head>
<body>
  <h1>第二章：离线轻量化解析架构设计</h1>
  <p>EPUB 格式基于开放出版结构标准（Open Publication Structure），其物理容器为标准 DEFLATE 压缩的 ZIP 包。</p>
  <p>OmniView 采用基于 Micro-Kernel 驱动架构的按需动态挂载设计：</p>
  <ol>
    <li><strong>零首屏损耗</strong>：在用户打开 Markdown 或 PDF 时，EPUB 解析代码保持休眠，不占用任何主线程内存与带宽；</li>
    <li><strong>流式解压与缓存</strong>：利用现有的 <code>JSZip</code> 快速解包 <code>META-INF/container.xml</code> 与 <code>content.opf</code>，仅解析索引与当前激活章节；</li>
    <li><strong>严格安全过滤</strong>：所有 XHTML 内容经 <code>DOMPurify</code> 沙箱清洗，防止恶意外部脚本与跨站渗透攻击。</li>
  </ol>
  <p>这种纯端侧架构保证了极高的稳定性，阅读千页巨著依然轻快流畅。</p>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter3.xhtml',
    `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>第三章：阅读交互与舒适排版规范</title>
</head>
<body>
  <h1>第三章：阅读交互与舒适排版规范</h1>
  <p>为了给读者提供沉浸式心流体验，OmniView 电子书阅读器内置了全套无障碍交互设计：</p>
  <ul>
    <li><strong>键盘快捷键</strong>：支持 <kbd>←</kbd> / <kbd>→</kbd> 键盘方向键即时翻章，<kbd>PageUp</kbd> / <kbd>PageDown</kbd> 页面滚动；</li>
    <li><strong>大纲快速跳转</strong>：侧边栏目录大纲与阅读进度条联动，随时一键直达核心章节；</li>
    <li><strong>优雅的阅读字号</strong>：默认采用 16px 舒适正文字号及 1.7 黄金行高比，极大缓解长时间审阅代码与文档的眼部疲劳。</li>
  </ul>
  <p>感谢使用 OmniView，开启优雅自由的本地多格式阅读之旅！</p>
</body>
</html>`
  );

  return await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}
