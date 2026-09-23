/**
 * 跨平台高清图片流剪贴板辅助工具 (copyImageHelper)
 * 支持将 SVG 字符串、外部 SVG URL 或 HTML 渲染节点高保真转为 300+ DPI 超高清 PNG Blob 并写入系统剪贴板
 */

export interface CopyImageOptions {
  scale?: number; // 超采样倍率 (默认 3x，对于打印/Word 级输出达到 300DPI 极清水平)
  backgroundColor?: string; // 背景色 (默认纯白 #ffffff，确保 Office 贴图不黑底)
  minDimension?: number; // 最小宽度/高度保证
}

/**
 * 解析 SVG 文本或图片元素中的实际尺寸与 viewBox
 */
function extractSvgDimensions(svgText: string): { width: number; height: number } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return { width: 1200, height: 800 };

    // 1. 尝试从 viewBox 获取
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: parts[2], height: parts[3] };
      }
    }

    // 2. 尝试从 width / height 属性获取
    const widthAttr = svgEl.getAttribute('width');
    const heightAttr = svgEl.getAttribute('height');
    const parseDim = (val: string | null): number | null => {
      if (!val) return null;
      const num = parseFloat(val);
      if (isNaN(num) || num <= 0) return null;
      if (val.endsWith('pt')) return num * 1.3333;
      if (val.endsWith('in')) return num * 96;
      if (val.endsWith('mm')) return num * 3.7795;
      if (val.endsWith('cm')) return num * 37.795;
      return num;
    };

    const parsedW = parseDim(widthAttr);
    const parsedH = parseDim(heightAttr);
    if (parsedW && parsedH) {
      return { width: parsedW, height: parsedH };
    }
  } catch (e) {
    // ignore parse error
  }
  return { width: 1200, height: 800 };
}

/**
 * 为 SVG 文本显式注入真实的 width / height 属性，确保在 Image 加载时不被降级模糊
 */
function ensureSvgExplicitDimensions(svgText: string, targetWidth: number, targetHeight: number): string {
  try {
    let safeSvg = svgText.trim();
    if (!safeSvg.includes('xmlns=')) {
      safeSvg = safeSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // 若已经有明确的宽高度且比较大，保留之；若无则注入目标高保真宽高
    if (!safeSvg.includes('width=') || !safeSvg.includes('height=')) {
      safeSvg = safeSvg.replace(
        '<svg',
        `<svg width="${targetWidth}" height="${targetHeight}"`
      );
    }
    return safeSvg;
  } catch {
    return svgText;
  }
}

/**
 * 将 SVG 代码或图片 URL 转换为超高清 3x-4x PNG Blob 并写入系统剪贴板 (image/png)
 * @param svgCodeOrUrl SVG 源码文本或 SVG 资源 URL
 * @param isUrl 是否是外部 URL
 * @param options 可选配置 (默认 3x 极清采样，背景纯白)
 */
export async function copySvgOrImageToClipboard(
  svgCodeOrUrl: string,
  isUrl: boolean = false,
  options?: CopyImageOptions | string
): Promise<boolean> {
  if (!svgCodeOrUrl || typeof window === 'undefined') return false;

  const resolvedOptions: CopyImageOptions =
    typeof options === 'string'
      ? { backgroundColor: options, scale: 3 }
      : { scale: 3, backgroundColor: '#ffffff', ...options };

  const { scale = 3, backgroundColor = '#ffffff' } = resolvedOptions;

  try {
    let svgRawText = '';

    // 1. 如果是 URL，且不是直接的 PNG，优先拉取其 SVG 文本以便按超高清分辨率重绘
    if (isUrl) {
      try {
        const res = await fetch(svgCodeOrUrl);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('image/svg') || svgCodeOrUrl.endsWith('.svg') || svgCodeOrUrl.includes('/svg/')) {
            svgRawText = await res.text();
          } else if (contentType.includes('image/png') || svgCodeOrUrl.includes('/png/')) {
            // 如果已经是服务器生成的 PNG 且无法重构，使用 blob
            // 但如果服务器默认 PNG 分辨率较低，我们依然优先尝试 SVG
            const directPngBlob = await res.blob();
            // 尝试通过 SVG 重新高清化，如无 svgRawText 则直接用
            if (directPngBlob) {
              if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
                const item = new ClipboardItem({ 'image/png': directPngBlob });
                await navigator.clipboard.write([item]);
                return true;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Direct fetch failed, falling back to rasterization:', e);
      }
    } else {
      svgRawText = svgCodeOrUrl;
    }

    // 2. 超高清栅格化
    const blob = await new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      let baseW = 1200;
      let baseH = 800;

      if (svgRawText) {
        const dims = extractSvgDimensions(svgRawText);
        baseW = dims.width;
        baseH = dims.height;
      }

      // 如果图形很小，自动动态提升基础分辨率基线，确保输出像素宽度至少 2400px
      const minCanvasTargetWidth = 2400;
      const effectiveScale = Math.max(scale, minCanvasTargetWidth / Math.max(baseW, 100));

      img.onload = () => {
        try {
          const naturalW = img.naturalWidth || baseW;
          const naturalH = img.naturalHeight || baseH;

          const canvas = document.createElement('canvas');
          const finalW = Math.round(naturalW * effectiveScale);
          const finalH = Math.round(naturalH * effectiveScale);

          canvas.width = finalW;
          canvas.height = finalH;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          // 启用高质量平滑滤波
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // 填充纯白背景 (Word / WPS / PPT / 微信 不黑底)
          if (backgroundColor) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, finalW, finalH);
          }

          ctx.drawImage(img, 0, 0, finalW, finalH);
          canvas.toBlob((b) => resolve(b), 'image/png');
        } catch (canvasErr) {
          console.error('Canvas high-res rasterization error:', canvasErr);
          resolve(null);
        }
      };

      img.onerror = (err) => {
        console.error('Image load error during copy:', err);
        resolve(null);
      };

      if (svgRawText) {
        // 显式保证尺寸与命名空间
        const preparedSvg = ensureSvgExplicitDimensions(svgRawText, baseW, baseH);
        const encoded = encodeURIComponent(preparedSvg)
          .replace(/'/g, '%27')
          .replace(/"/g, '%22');
        img.src = `data:image/svg+xml;charset=utf-8,${encoded}`;
      } else if (isUrl) {
        img.src = svgCodeOrUrl;
      }
    });

    if (blob && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }

    return false;
  } catch (err) {
    console.error('Failed to copy high-res image to clipboard:', err);
    return false;
  }
}
