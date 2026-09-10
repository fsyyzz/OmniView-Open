/**
 * OmniView 专业级 Mozilla PDF.js 渲染内核驱动
 * 支持任意真实二进制 PDF 解析、Canvas 高清光栅化、视口旋转、缩放与缩略图导航
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 严格配置 Worker 路径，兼顾 Webview 沙箱与浏览器环境
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (err) {
    console.warn('[OmniView PDF.js] Web Worker 初始化回退至主线程解析模式:', err);
  }
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  numPages: number;
  fileSizeBytes?: number;
}

export interface RenderPageResult {
  width: number;
  height: number;
  cancel: () => void;
}

/**
 * 将 Base64 转换为 Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, '');
  const binaryString = window.atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * 生成内置的符合 PDF-1.4 规范的标准 4 页高保真白皮书二进制文档
 */
export function generateSamplePdfBytes(): Uint8Array {
  const pages = [
    {
      title: 'OmniView Architecture Standard Whitepaper',
      sub: 'Section 1.0 - Project Overview & Evolution (100% MIT License)',
      body: [
        'Visual Studio Code has become the primary workbench for global developers.',
        'OmniView delivers instant, lightweight, zero-paywall previewing for Markdown, Mermaid, PlantUML, SVG, and real PDF documents.',
        'Designed with a decoupled driver micro-kernel to keep RAM overhead under 45MB while eliminating commercial VIP restrictions.',
      ],
      tag: 'ARCHITECTURE SPECIFICATION',
    },
    {
      title: 'Sandboxed IPC Protocol & Security Architecture',
      sub: 'Section 2.0 - Security & Protocol Specification',
      body: [
        'The Extension Host (Node.js) and Webview (Chromium) operate in isolated process boundaries.',
        'All communications flow over typed JSON-RPC message contracts with bidirectional live hot reload.',
        'Rigorous Content Security Policies (CSP) and DOMPurify sanitization strictly eliminate XSS attack vectors.',
      ],
      tag: 'IPC SECURITY PROTOCOL',
    },
    {
      title: 'Multi-Driver Lazy Loading Architecture',
      sub: 'Section 3.0 - Driver Architecture Matrix',
      body: [
        'Each format (Markdown, PlantUML, SVG, CSV, PDF) is encapsulated into an isolated lazy-loaded driver.',
        'The PDF Driver utilizes Mozilla PDF.js v4+ with Web Worker acceleration and Canvas rasterization.',
        'Provides full resolution Hi-DPI multi-page navigation, smooth zooming, and clockwise 90 degree rotation.',
      ],
      tag: 'DRIVER LAZY-LOADING',
    },
    {
      title: 'Deployment & Verification Runbook',
      sub: 'Section 4.0 - Production Readiness Checklist',
      body: [
        'Packaged into standard .vsix extensions using official @vscode/vsce tooling.',
        'Continuous integration pipeline validates zero memory leaks and 100% diagram diagnostic test passes.',
        '100% Free & Open Source under the permissive MIT license for the entire developer community.',
      ],
      tag: 'PRODUCTION RUNBOOK',
    },
  ];

  let objId = 1;
  const catalogId = objId++;
  const pagesId = objId++;
  const fontId = objId++;
  const fontBoldId = objId++;

  const pageIds: number[] = [];
  const contentIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    pageIds.push(objId++);
    contentIds.push(objId++);
  }

  const objects: { id: number; data: string }[] = [];

  // Catalog
  objects.push({ id: catalogId, data: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });

  // Pages
  const kidsStr = pageIds.map(id => `${id} 0 R`).join(' ');
  objects.push({ id: pagesId, data: `<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>` });

  // Fonts
  objects.push({ id: fontId, data: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' });
  objects.push({ id: fontBoldId, data: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' });

  // Each page and content
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageObjId = pageIds[i];
    const contentObjId = contentIds[i];

    objects.push({
      id: pageObjId,
      data: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
    });

    const stream = [
      // Top header banner background
      '0.06 0.1 0.18 rg',
      '40 765 515 36 re f',
      // Header tag
      'BT',
      '/F2 13 Tf',
      '0.3 0.7 1.0 rg',
      '55 778 Td',
      `(${p.tag}) Tj`,
      'ET',
      // Document Main Title
      'BT',
      '/F2 18 Tf',
      '0.08 0.12 0.22 rg',
      '40 715 Td',
      `(${p.title}) Tj`,
      'ET',
      // Subtitle
      'BT',
      '/F1 11 Tf',
      '0.2 0.45 0.85 rg',
      '40 695 Td',
      `(${p.sub}) Tj`,
      'ET',
      // Decorative blue separator line
      '0.2 0.45 0.85 RG',
      '2 w',
      '40 680 m 555 680 l S',
      // Body Text blocks
      'BT',
      '/F1 12 Tf',
      '0.2 0.25 0.32 rg',
      '40 645 Td',
      `(${p.body[0] || ''}) Tj`,
      'T*',
      '0 -18 Td',
      `(${p.body[1] || ''}) Tj`,
      'T*',
      '0 -18 Td',
      `(${p.body[2] || ''}) Tj`,
      'ET',
      // Card representation box
      '0.95 0.97 1.0 rg',
      '40 460 515 90 re f',
      '0.8 0.88 0.95 RG',
      '1 w',
      '40 460 515 90 re S',
      'BT',
      '/F2 11 Tf',
      '0.1 0.3 0.6 rg',
      '55 525 Td',
      '(Engine Verification Note) Tj',
      '/F1 10 Tf',
      '0.3 0.35 0.4 rg',
      '0 -16 Td',
      '(This document is parsed directly by Mozilla PDF.js v4 into HTML5 Canvas.) Tj',
      '0 -14 Td',
      '(Full support for local PDF files, multi-page outline, zooming, rotation, and printing.) Tj',
      'ET',
      // Bottom border & Footer
      '0.85 0.88 0.92 RG',
      '1 w',
      '40 55 m 555 55 l S',
      'BT',
      '/F1 9 Tf',
      '0.5 0.55 0.6 rg',
      '40 40 Td',
      '(OmniView Document Platform - Real Binary PDF.js Core) Tj',
      '470 40 Td',
      `(Page ${i + 1} of ${pages.length}) Tj`,
      'ET',
    ].join('\n');

    objects.push({
      id: contentObjId,
      data: `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    });
  }

  // Sort objects by id
  objects.sort((a, b) => a.id - b.id);

  let output = '%PDF-1.4\n';
  const xref: number[] = [0];

  for (const obj of objects) {
    xref.push(output.length);
    output += `${obj.id} 0 obj\n${obj.data}\nendobj\n`;
  }

  const startxref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    output += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  return new TextEncoder().encode(output);
}

/**
 * 载入 PDF 文档（支持 Base64、Blob URL、Uint8Array 或自动使用内置高质量样本文档）
 */
export async function loadPdfDocument(
  source?: string | Uint8Array | ArrayBuffer
): Promise<{ doc: pdfjsLib.PDFDocumentProxy; rawBytes: Uint8Array }> {
  let rawBytes: Uint8Array;

  if (source instanceof Uint8Array) {
    rawBytes = source;
  } else if (source instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(source);
  } else if (typeof source === 'string' && source.startsWith('data:application/pdf;base64,')) {
    rawBytes = base64ToUint8Array(source);
  } else if (typeof source === 'string' && source.startsWith('blob:')) {
    const res = await fetch(source);
    const buf = await res.arrayBuffer();
    rawBytes = new Uint8Array(buf);
  } else {
    // 默认高仿真标准 4 页工程规范 PDF
    rawBytes = generateSamplePdfBytes();
  }

  const loadingTask = pdfjsLib.getDocument({
    data: rawBytes,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const doc = await loadingTask.promise;
  return { doc, rawBytes };
}

/**
 * 渲染指定页面至 Canvas 上，支持设备像素比 (Hi-DPI) 与顺时针旋转
 */
export function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  options: {
    scale?: number;
    rotation?: number;
  } = {}
): { promise: Promise<void>; cancel: () => void } {
  let isCancelled = false;
  let renderTask: pdfjsLib.RenderTask | null = null;

  const promise = (async () => {
    const page = await doc.getPage(pageNumber);
    if (isCancelled) return;

    const baseScale = options.scale ?? 1.0;
    const rotation = options.rotation ?? 0;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // 获取页面原始视口
    const viewport = page.getViewport({ scale: baseScale * dpr, rotation });
    const cssViewport = page.getViewport({ scale: baseScale, rotation });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(cssViewport.width)}px`;
    canvas.style.height = `${Math.floor(cssViewport.height)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to acquire 2d context for canvas');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 检查并取消该 Canvas 上尚未完成的旧渲染任务，防止多重 render 冲突抛错
    const canvasWithTask = canvas as unknown as { _activeRenderTask?: pdfjsLib.RenderTask | null };
    if (canvasWithTask._activeRenderTask) {
      try {
        canvasWithTask._activeRenderTask.cancel();
      } catch {
        // ignore
      }
      canvasWithTask._activeRenderTask = null;
    }

    if (isCancelled) return;

    renderTask = page.render({
      canvasContext: ctx,
      viewport,
    });
    canvasWithTask._activeRenderTask = renderTask;

    try {
      await renderTask.promise;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'RenderingCancelledException') {
        // 忽略正常取消事件
        return;
      }
      throw err;
    } finally {
      if (canvasWithTask._activeRenderTask === renderTask) {
        canvasWithTask._activeRenderTask = null;
      }
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    },
  };
}

export interface PdfSearchMatch {
  pageNumber: number;
  matchIndex: number;
  snippet: string;
}

/**
 * 全文检索：遍历 PDF 所有页面提取文本并匹配查询词，生成上下文摘要与精准定位索引
 */
export async function searchPdfDocument(
  doc: pdfjsLib.PDFDocumentProxy,
  query: string
): Promise<PdfSearchMatch[]> {
  if (!query || !query.trim()) return [];
  const normalized = query.toLowerCase().trim();
  const matches: PdfSearchMatch[] = [];

  for (let pNum = 1; pNum <= doc.numPages; pNum++) {
    try {
      const page = await doc.getPage(pNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((it: unknown) => (typeof it === 'object' && it && 'str' in it ? String((it as { str: unknown }).str) : ''))
        .join(' ');
      const lowerText = pageText.toLowerCase();

      let pos = 0;
      while (true) {
        const found = lowerText.indexOf(normalized, pos);
        if (found === -1) break;

        const start = Math.max(0, found - 25);
        const end = Math.min(pageText.length, found + normalized.length + 35);
        const snippet =
          (start > 0 ? '...' : '') +
          pageText.slice(start, end).replace(/\s+/g, ' ').trim() +
          (end < pageText.length ? '...' : '');

        matches.push({
          pageNumber: pNum,
          matchIndex: matches.length + 1,
          snippet,
        });

        pos = found + Math.max(1, normalized.length);
      }
    } catch (e) {
      console.warn(`[OmniView PDF] 检索第 ${pNum} 页失败:`, e);
    }
  }

  return matches;
}

export interface PdfOutlineItem {
  title: string;
  pageNumber: number;
  items?: PdfOutlineItem[];
}

/**
 * 解析并生成层级大纲目录（优先解析 PDF 内嵌 Outline 书签，若无则自动根据页面标题智能生成）
 */
export async function getPdfOutline(doc: pdfjsLib.PDFDocumentProxy): Promise<PdfOutlineItem[]> {
  try {
    const rawOutline = await doc.getOutline();
    if (rawOutline && rawOutline.length > 0) {
      const parseItems = async (items: Array<{ title?: string; dest?: unknown; items?: unknown[] }>): Promise<PdfOutlineItem[]> => {
        const result: PdfOutlineItem[] = [];
        for (const item of items) {
          let pageNum = 1;
          try {
            if (typeof item.dest === 'string') {
              const explicitDest = await doc.getDestination(item.dest);
              if (explicitDest && explicitDest[0]) {
                pageNum = (await doc.getPageIndex(explicitDest[0])) + 1;
              }
            } else if (Array.isArray(item.dest) && item.dest[0]) {
              pageNum = (await doc.getPageIndex(item.dest[0])) + 1;
            }
          } catch {
            pageNum = 1;
          }
          const children = item.items && item.items.length > 0 ? await parseItems(item.items as Array<{ title?: string; dest?: unknown; items?: unknown[] }>) : undefined;
          result.push({
            title: item.title || '无标题章节',
            pageNumber: pageNum,
            items: children,
          });
        }
        return result;
      };
      return await parseItems(rawOutline as Array<{ title?: string; dest?: unknown; items?: unknown[] }>);
    }
  } catch (err) {
    console.warn('[OmniView PDF] 解析内嵌书签目录失败，采用智能目录生成:', err);
  }

  // 启发式目录回退：解析前 50 页首部标题
  const fallbackOutline: PdfOutlineItem[] = [];
  const total = doc.numPages;
  for (let i = 1; i <= Math.min(total, 50); i++) {
    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const firstLine = textContent.items
        .slice(0, 3)
        .map((it: unknown) => (typeof it === 'object' && it && 'str' in it ? String((it as { str: unknown }).str) : ''))
        .join(' ')
        .trim();

      const title =
        firstLine && firstLine.length > 3
          ? firstLine.length > 36
            ? firstLine.slice(0, 36) + '...'
            : firstLine
          : `第 ${i} 页`;

      fallbackOutline.push({
        title,
        pageNumber: i,
      });
    } catch {
      fallbackOutline.push({
        title: `第 ${i} 页`,
        pageNumber: i,
      });
    }
  }
  return fallbackOutline;
}

/**
 * 渲染页面文本层 (TextLayer) 至指定 DOM 容器中，使用户可在 Canvas 表面选词划线、高亮复制
 */
export async function renderTextLayerToContainer(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  container: HTMLElement,
  options: {
    scale?: number;
    rotation?: number;
    searchQuery?: string;
  } = {}
): Promise<{ cancel: () => void }> {
  let isCancelled = false;
  let textLayerInstance: { cancel?: () => void } | null = null;

  try {
    container.innerHTML = '';
    const page = await doc.getPage(pageNumber);
    if (isCancelled) return { cancel: () => {} };

    const baseScale = options.scale ?? 1.0;
    const rotation = options.rotation ?? 0;
    const viewport = page.getViewport({ scale: baseScale, rotation });

    container.style.width = `${Math.floor(viewport.width)}px`;
    container.style.height = `${Math.floor(viewport.height)}px`;
    container.style.setProperty('--scale-factor', `${baseScale}`);

    const textContent = await page.getTextContent();
    if (isCancelled) return { cancel: () => {} };

    const TextLayerClass = (pdfjsLib as unknown as { TextLayer?: new (args: unknown) => { render: () => Promise<void>; cancel?: () => void } }).TextLayer;
    if (TextLayerClass) {
      const instance = new TextLayerClass({
        textContentSource: textContent,
        container,
        viewport,
      });
      textLayerInstance = instance;
      await instance.render();

      // 若处于搜索状态，为文本匹配词增加黄色高亮标记
      if (options.searchQuery?.trim()) {
        const q = options.searchQuery.trim().toLowerCase();
        const spans = container.querySelectorAll('span');
        spans.forEach((span) => {
          const txt = span.textContent || '';
          if (txt.toLowerCase().includes(q)) {
            span.classList.add('pdf-search-highlight');
          }
        });
      }
    }
  } catch (err: unknown) {
    if (!isCancelled) {
      console.warn('[OmniView TextLayer] 渲染异常:', err);
    }
  }

  return {
    cancel: () => {
      isCancelled = true;
      if (textLayerInstance && typeof textLayerInstance.cancel === 'function') {
        try {
          textLayerInstance.cancel();
        } catch {
          // ignore
        }
      }
    },
  };
}
