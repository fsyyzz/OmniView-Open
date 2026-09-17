/**
 * OmniView 原生图像引擎与像素级分析工具集 (imageEngine)
 * 提供 EXIF 解析、色彩空间换算 (RGBA/HEX/HSLA)、像素采样取色、直方图主色调提取与无损转换
 * 
 * 作者: 周赞
 */

export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: string;
  megapixels: string;
  format: string;
  fileSize?: number;
  colorSpace?: string;
  hasAlpha?: boolean;
  exif?: Record<string, string | number>;
}

export interface PixelColorInfo {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
  rgba: string;
  hsla: string;
}

export interface DominantColor {
  hex: string;
  percentage: number;
  r: number;
  g: number;
  b: number;
}

/**
 * RGBA 转 HEX 字符串 (例如 #FFFFFF 或 #FFFFFF80)
 */
export function rgbaToHex(r: number, g: number, b: number, a: number = 255): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  const alphaHex = a < 255 ? toHex(a) : '';
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`.toUpperCase();
}

/**
 * RGBA 转 HSLA 字符串 (例如 hsla(210, 100%, 50%, 1))
 */
export function rgbaToHsla(r: number, g: number, b: number, a: number = 255): string {
  const normR = r / 255;
  const normG = g / 255;
  const normB = b / 255;

  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === normR) {
      h = (normG - normB) / delta + (normG < normB ? 6 : 0);
    } else if (max === normG) {
      h = (normB - normR) / delta + 2;
    } else {
      h = (normR - normG) / delta + 4;
    }
    h = Math.round(h * 60);
  }

  const alphaVal = Number((a / 255).toFixed(2));
  return `hsla(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${alphaVal})`;
}

/**
 * 计算两个数的最大公约数 (GCD)，用于计算精简纵横比 (Aspect Ratio)
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/**
 * 格式化图片纵横比 (如 16:9, 4:3, 1:1, 21:9)
 */
export function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const divisor = gcd(width, height);
  const wRatio = width / divisor;
  const hRatio = height / divisor;

  // 针对非整比例，保留近似标准比例
  if (wRatio > 50 || hRatio > 50) {
    const decimal = width / height;
    if (Math.abs(decimal - 16 / 9) < 0.05) return '16:9';
    if (Math.abs(decimal - 4 / 3) < 0.05) return '4:3';
    if (Math.abs(decimal - 21 / 9) < 0.05) return '21:9';
    if (Math.abs(decimal - 3 / 2) < 0.05) return '3:2';
    if (Math.abs(decimal - 1) < 0.01) return '1:1';
    return `${decimal.toFixed(2)}:1`;
  }

  return `${wRatio}:${hRatio}`;
}

/**
 * 格式化文件大小 (B, KB, MB)
 */
export function formatImageSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 轻量纯前端 EXIF 解析器 (解析 JPEG App1 / Exif Marker)
 */
export function parseExifFromBuffer(buffer: ArrayBuffer): Record<string, string | number> {
  const exifData: Record<string, string | number> = {};
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4) return exifData;

    // 检查 JPEG SOI 标志 0xFFD8
    if (view.getUint16(0) !== 0xffd8) return exifData;

    let offset = 2;
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset);
      offset += 2;

      // APP1 标志 0xFFE1 (EXIF)
      if (marker === 0xffe1) {
        const length = view.getUint16(offset);
        offset += 2;

        // 检查 "Exif\0\0" 头部
        const exifHeader = view.getUint32(offset);
        if (exifHeader === 0x45786966) {
          // Exif
          const tiffStart = offset + 6;
          const isLittleEndian = view.getUint16(tiffStart) === 0x4949; // 'II'

          const getU16 = (o: number) => view.getUint16(tiffStart + o, isLittleEndian);
          const getU32 = (o: number) => view.getUint32(tiffStart + o, isLittleEndian);

          const ifdOffset = getU32(4);
          const numEntries = getU16(ifdOffset);

          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength - tiffStart) break;

            const tag = getU16(entryOffset);
            const type = getU16(entryOffset + 2);
            const numValues = getU32(entryOffset + 4);
            const valueOffset = entryOffset + 8;

            // 常见 EXIF Tag
            if (tag === 0x010f) {
              // Make
              exifData['相机品牌'] = readExifString(view, tiffStart, getU32(valueOffset), numValues);
            } else if (tag === 0x0110) {
              // Model
              exifData['设备型号'] = readExifString(view, tiffStart, getU32(valueOffset), numValues);
            } else if (tag === 0x0131) {
              // Software
              exifData['编辑软件'] = readExifString(view, tiffStart, getU32(valueOffset), numValues);
            } else if (tag === 0x0132) {
              // DateTime
              exifData['拍摄时间'] = readExifString(view, tiffStart, getU32(valueOffset), numValues);
            } else if (tag === 0x829a) {
              // ExposureTime
              const num = view.getUint32(tiffStart + getU32(valueOffset), isLittleEndian);
              const den = view.getUint32(tiffStart + getU32(valueOffset) + 4, isLittleEndian);
              if (den) exifData['快门速度'] = `1/${Math.round(den / num)}s`;
            } else if (tag === 0x829d) {
              // FNumber
              const num = view.getUint32(tiffStart + getU32(valueOffset), isLittleEndian);
              const den = view.getUint32(tiffStart + getU32(valueOffset) + 4, isLittleEndian);
              if (den) exifData['光圈值'] = `f/${(num / den).toFixed(1)}`;
            } else if (tag === 0x8827) {
              // ISO
              exifData['ISO 感光度'] = type === 3 ? getU16(valueOffset) : getU32(valueOffset);
            } else if (tag === 0x920a) {
              // FocalLength
              const num = view.getUint32(tiffStart + getU32(valueOffset), isLittleEndian);
              const den = view.getUint32(tiffStart + getU32(valueOffset) + 4, isLittleEndian);
              if (den) exifData['焦距'] = `${(num / den).toFixed(1)} mm`;
            }
          }
        }
        break;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        const length = view.getUint16(offset);
        offset += length;
      }
    }
  } catch {
    // EXIF 容错静默返回
  }
  return exifData;
}

function readExifString(view: DataView, tiffStart: number, strOffset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length - 1; i++) {
    const charCode = view.getUint8(tiffStart + strOffset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}

/**
 * 生成内置的专业合规演示矢量/位图图形
 */
export function generateSampleImageDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. 背景渐变
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 675);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#1e1b4b');
  bgGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 675);

  // 2. 几何光晕图形
  ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
  ctx.beginPath();
  ctx.arc(350, 300, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
  ctx.beginPath();
  ctx.arc(850, 380, 260, 0, Math.PI * 2);
  ctx.fill();

  // 3. 装饰透明度棋盘网格演示区
  const gridX = 400;
  const gridY = 200;
  const gridSize = 400;
  const cellSize = 20;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(gridX, gridY, gridSize, 260, 16);
  ctx.clip();

  for (let x = 0; x < gridSize; x += cellSize) {
    for (let y = 0; y < 260; y += cellSize) {
      const isEven = ((x / cellSize) + (y / cellSize)) % 2 === 0;
      ctx.fillStyle = isEven ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(gridX + x, gridY + y, cellSize, cellSize);
    }
  }

  // 半透明覆盖色块
  const blockGrad = ctx.createLinearGradient(gridX, gridY, gridX + gridSize, gridY + 260);
  blockGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
  blockGrad.addColorStop(1, 'rgba(168, 85, 247, 0.6)');
  ctx.fillStyle = blockGrad;
  ctx.fillRect(gridX, gridY, gridSize, 260);
  ctx.restore();

  // 4. 标题与排版文本
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OmniView 现代图像工作台与像素检视器', 600, 120);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('16x 像素放大镜 • 实时取色器 (HEX/RGBA) • EXIF 透视 • 10%~3200% 极清矢量缩放', 600, 160);

  // 5. 底部色卡调色板演示
  const paletteColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];
  const startX = 600 - (paletteColors.length * 50) / 2;
  paletteColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(startX + i * 50, 520, 40, 40, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  return canvas.toDataURL('image/png');
}
