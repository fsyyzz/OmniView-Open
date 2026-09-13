/**
 * OmniView Excalidraw 手绘白板核心解析与 SVG 导出引擎
 */
import DOMPurify from 'dompurify';

export interface ExcalidrawParsedData {
  elements: any[];
  appState: Record<string, any>;
  files: Record<string, any> | null;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * 健壮规范化与防御修补 Excalidraw 图元，防止缺失内部字段导致 Canvas 渲染崩溃
 */
export function sanitizeExcalidrawElements(rawElements: any[]): any[] {
  if (!Array.isArray(rawElements)) return [];
  return rawElements
    .filter((el) => el && typeof el === 'object')
    .map((el, index) => {
      const type = el.type || 'rectangle';
      const isLinear = ['arrow', 'line', 'freedraw'].includes(type);
      const width = typeof el.width === 'number' ? el.width : 100;
      const height = typeof el.height === 'number' ? el.height : 60;

      let points = el.points;
      if (isLinear && (!Array.isArray(points) || points.length === 0)) {
        points = [[0, 0], [width || 80, height || 0]];
      }

      return {
        id: String(el.id || `el-${index}-${Date.now()}`),
        type,
        x: typeof el.x === 'number' ? el.x : 0,
        y: typeof el.y === 'number' ? el.y : 0,
        width,
        height,
        angle: typeof el.angle === 'number' ? el.angle : 0,
        strokeColor: el.strokeColor || '#1e1e1e',
        backgroundColor: el.backgroundColor || 'transparent',
        fillStyle: el.fillStyle || 'hachure',
        strokeWidth: typeof el.strokeWidth === 'number' ? el.strokeWidth : 1,
        strokeStyle: el.strokeStyle || 'solid',
        roughness: typeof el.roughness === 'number' ? el.roughness : 1,
        opacity: typeof el.opacity === 'number' ? el.opacity : 100,
        groupIds: Array.isArray(el.groupIds) ? el.groupIds : [],
        frameId: el.frameId ?? null,
        roundness: el.roundness ?? null,
        seed: typeof el.seed === 'number' ? el.seed : Math.floor(Math.random() * 100000),
        version: typeof el.version === 'number' ? el.version : 1,
        versionNonce: typeof el.versionNonce === 'number' ? el.versionNonce : 1,
        isDeleted: Boolean(el.isDeleted),
        boundElements: Array.isArray(el.boundElements) ? el.boundElements : null,
        updated: typeof el.updated === 'number' ? el.updated : 1,
        link: el.link ?? null,
        locked: Boolean(el.locked),
        ...(isLinear ? { points } : {}),
        ...el,
      };
    });
}

/**
 * 健壮解析 Excalidraw JSON 格式，兼容各种结构（包含嵌套或纯 elements 数组）
 */
export function parseExcalidrawJson(rawContent: string): ExcalidrawParsedData {
  const trimmed = (rawContent || '').trim();
  if (!trimmed) {
    return {
      elements: [],
      appState: { viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
      files: null,
      isValid: true,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);

    // 情况 1: 标准 Excalidraw 文档对象 { type: 'excalidraw', elements: [...], appState: {...} }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const elements = sanitizeExcalidrawElements(parsed.elements);
      const appState = parsed.appState && typeof parsed.appState === 'object' ? parsed.appState : {};
      const files = parsed.files && typeof parsed.files === 'object' ? parsed.files : null;

      return {
        elements,
        appState: {
          viewBackgroundColor: '#ffffff',
          exportWithDarkMode: false,
          ...appState,
        },
        files,
        isValid: true,
      };
    }

    // 情况 2: 纯元素数组 [...]
    if (Array.isArray(parsed)) {
      return {
        elements: sanitizeExcalidrawElements(parsed),
        appState: { viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
        files: null,
        isValid: true,
      };
    }

    return {
      elements: [],
      appState: {},
      files: null,
      isValid: false,
      errorMessage: 'JSON 顶层必须是 Excalidraw 文档对象或图形元素数组',
    };
  } catch (err: any) {
    return {
      elements: [],
      appState: {},
      files: null,
      isValid: false,
      errorMessage: err?.message || 'JSON 格式解析失败',
    };
  }
}

/**
 * 客户端浏览器异步渲染 Excalidraw 为 SVG 字符串并进行 DOMPurify 清洗
 */
export async function renderExcalidrawToSvgString(
  parsedData: ExcalidrawParsedData,
  options: {
    isDarkTheme?: boolean;
    padding?: number;
  } = {}
): Promise<{ svgString: string; rawSvgElement?: SVGSVGElement }> {
  if (!parsedData.isValid || !parsedData.elements || parsedData.elements.length === 0) {
    // 渲染极简空白板骨架
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="100%" height="100%" fill="${options.isDarkTheme ? '#1e1e24' : '#fafafa'}" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="${options.isDarkTheme ? '#64748b' : '#94a3b8'}" font-family="system-ui, sans-serif" font-size="14">
        (暂无 Excalidraw 图形图元，请在源码编辑区添加)
      </text>
    </svg>`;
    return { svgString: emptySvg };
  }

  // 动态按需加载 @excalidraw/utils 避免污染其他文档的首屏体积
  const { exportToSvg } = await import('@excalidraw/utils');

  const isDark = options.isDarkTheme ?? false;
  const bgColor = isDark
    ? (parsedData.appState?.viewBackgroundColor && parsedData.appState.viewBackgroundColor !== '#ffffff' ? parsedData.appState.viewBackgroundColor : '#121212')
    : (parsedData.appState?.viewBackgroundColor || '#ffffff');

  const svgNode = await exportToSvg({
    data: {
      elements: parsedData.elements,
      appState: {
        ...parsedData.appState,
        exportWithDarkMode: isDark,
        exportBackground: true,
        exportPadding: options.padding ?? 30,
        viewBackgroundColor: bgColor,
      },
      files: parsedData.files,
    },
    config: {
      renderEmbeddables: true,
      skipInliningFonts: true,
    } as any,
  });

  if (!svgNode) {
    throw new Error('Excalidraw exportToSvg 未返回有效 SVG');
  }

  const rawXml = new XMLSerializer().serializeToString(svgNode);
  const sanitized = DOMPurify.sanitize(rawXml, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['dominant-baseline', 'text-anchor', 'stroke-linejoin', 'stroke-linecap'],
  });

  return {
    svgString: sanitized,
    rawSvgElement: svgNode,
  };
}

/**
 * 触发浏览器端下载本地文件
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
