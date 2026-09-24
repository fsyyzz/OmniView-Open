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
 * 健壮解析 Excalidraw JSON 格式，兼容各种结构（包含嵌套、纯 elements 数组或自包含 .excalidraw.svg 嵌入格式）
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

  // 优先检测是否为 .excalidraw.svg 自包含双模文件
  if (trimmed.startsWith('<svg') || trimmed.includes('<svg') || trimmed.includes('omniview-excalidraw-payload')) {
    const extractedDoc = extractExcalidrawPayloadFromSvg(trimmed);
    if (extractedDoc) {
      const elements = sanitizeExcalidrawElements(extractedDoc.elements || []);
      const appState = extractedDoc.appState && typeof extractedDoc.appState === 'object' ? extractedDoc.appState : {};
      const files = extractedDoc.files && typeof extractedDoc.files === 'object' ? extractedDoc.files : null;
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
 * 将 Excalidraw 原生数据隐写注入到 SVG `<metadata>` 中，实现自包含双模矢量交付 (.excalidraw.svg)
 */
export function embedExcalidrawPayloadInSvg(svgString: string, doc: any): string {
  if (!svgString || !doc) return svgString;
  try {
    const payloadStr = encodeURIComponent(JSON.stringify(doc));
    const metadataTag = `\n  <metadata id="omniview-excalidraw-payload" type="application/json">${payloadStr}</metadata>\n`;
    const svgTagMatch = svgString.match(/<svg[^>]*>/i);
    if (svgTagMatch && svgTagMatch.index !== undefined) {
      const insertIndex = svgTagMatch.index + svgTagMatch[0].length;
      return svgString.slice(0, insertIndex) + metadataTag + svgString.slice(insertIndex);
    }
    return svgString;
  } catch {
    return svgString;
  }
}

/**
 * 从 SVG 文本中提取自包含的 Excalidraw 原生工程数据
 */
export function extractExcalidrawPayloadFromSvg(svgContent: string): any | null {
  if (!svgContent) return null;
  try {
    // 匹配 <metadata id="omniview-excalidraw-payload" ...>...</metadata>
    const match = svgContent.match(/<metadata[^>]*id="omniview-excalidraw-payload"[^>]*>([\s\S]*?)<\/metadata>/i);
    if (match && match[1]) {
      const rawText = match[1].trim();
      const decoded = decodeURIComponent(rawText);
      return JSON.parse(decoded);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 提取画布中的所有 Frame（画框）图元，按垂直及水平空间位置自然排布排序
 */
export function getFramesFromElements(elements: any[]): any[] {
  if (!Array.isArray(elements)) return [];
  return elements
    .filter(el => el && el.type === 'frame' && !el.isDeleted)
    .sort((a, b) => {
      // 容差 80px 范围内的视作同一行，按 X 从左到右，否则按 Y 从上到下
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 80) {
        return a.x - b.x;
      }
      return yDiff;
    });
}

/**
 * 当白板没有 Frame 时，一键按图元空间范围智能创建演示画框
 */
export function autoCreateFrames(elements: any[]): any[] {
  if (!Array.isArray(elements) || elements.length === 0) return elements;
  const nonFrames = elements.filter(el => el && el.type !== 'frame' && !el.isDeleted);
  if (nonFrames.length === 0) return elements;

  // 计算全体图元的外接矩形
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nonFrames.forEach(el => {
    const x = typeof el.x === 'number' ? el.x : 0;
    const y = typeof el.y === 'number' ? el.y : 0;
    const w = typeof el.width === 'number' ? el.width : 100;
    const h = typeof el.height === 'number' ? el.height : 60;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  const pad = 60;
  const frameWidth = Math.max(400, maxX - minX + pad * 2);
  const frameHeight = Math.max(300, maxY - minY + pad * 2);

  const frameId = `frame-auto-${Date.now()}`;
  const newFrame = {
    id: frameId,
    type: 'frame',
    name: '架构演示总览 (Overview)',
    x: minX - pad,
    y: minY - pad,
    width: frameWidth,
    height: frameHeight,
    strokeColor: '#3b82f6',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'dashed',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  };

  return [newFrame, ...elements];
}

/**
 * 诊断连线拓扑健康状态（检测未绑定的孤立箭头）
 */
export function detectDanglingArrows(elements: any[]): {
  arrowCount: number;
  danglingCount: number;
  danglingIds: string[];
} {
  if (!Array.isArray(elements)) return { arrowCount: 0, danglingCount: 0, danglingIds: [] };
  const arrows = elements.filter(el => el && el.type === 'arrow' && !el.isDeleted);
  const elementIdSet = new Set(elements.filter(el => el && !el.isDeleted).map(el => el.id));

  const danglingIds: string[] = [];
  arrows.forEach(arrow => {
    const hasValidStart = arrow.startBinding?.elementId && elementIdSet.has(arrow.startBinding.elementId);
    const hasValidEnd = arrow.endBinding?.elementId && elementIdSet.has(arrow.endBinding.elementId);
    if (!hasValidStart || !hasValidEnd) {
      danglingIds.push(arrow.id);
    }
  });

  return {
    arrowCount: arrows.length,
    danglingCount: danglingIds.length,
    danglingIds,
  };
}

/**
 * 纯前端 Mermaid Flowchart / Graph 一键转换为 Excalidraw 手绘白板图元
 * 支持 flowchart TD / LR / TB 及 graph TD / LR
 */
export function convertMermaidToExcalidraw(mermaidCode: string): {
  elements: any[];
  appState: Record<string, any>;
} {
  const lines = (mermaidCode || '').split('\n').map(l => l.trim()).filter(Boolean);
  const isHorizontal = lines.some(l => /^(flowchart|graph)\s+(LR|RL)/i.test(l));

  interface NodeItem {
    id: string;
    label: string;
    shape: 'rectangle' | 'ellipse' | 'diamond';
    level: number;
  }
  interface EdgeItem {
    from: string;
    to: string;
    label?: string;
  }

  const nodes = new Map<string, NodeItem>();
  const edges: EdgeItem[] = [];

  const parseNodeDef = (str: string): { id: string; label: string; shape: 'rectangle' | 'ellipse' | 'diamond' } | null => {
    const trimmed = str.trim();
    // 匹配 diamond: id{label}
    const diamondMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\{([^}]+)\}$/);
    if (diamondMatch) {
      return { id: diamondMatch[1], label: diamondMatch[2].trim(), shape: 'diamond' };
    }
    // 匹配 database or round: id[(label)] or id([label]) or id(label)
    const dbMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\(([^)]+)\)\]$/);
    if (dbMatch) {
      return { id: dbMatch[1], label: `[( ${dbMatch[2].trim()} )]`, shape: 'rectangle' };
    }
    const ellipseMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\(([^)]+)\)$/);
    if (ellipseMatch) {
      return { id: ellipseMatch[1], label: ellipseMatch[2].trim(), shape: 'ellipse' };
    }
    // 匹配 standard box: id[label]
    const boxMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[([^\]]+)\]$/);
    if (boxMatch) {
      return { id: boxMatch[1], label: boxMatch[2].trim(), shape: 'rectangle' };
    }
    // 纯 ID
    const rawId = trimmed.match(/^([a-zA-Z0-9_-]+)$/);
    if (rawId) {
      return { id: rawId[1], label: rawId[1], shape: 'rectangle' };
    }
    return null;
  };

  lines.forEach(line => {
    // 忽略方向声明
    if (/^(flowchart|graph|subgraph|end)\b/i.test(line)) return;

    // 匹配 edge: A --> B, A -->|label| B, A --- B, A -.-> B, A ==> B
    const arrowMatch = line.match(/^(.+?)\s*(?:-->|---|-.->|==>)\s*(?:\|([^|]+)\|)?\s*(.+)$/);
    if (arrowMatch) {
      const fromPart = arrowMatch[1].trim();
      const edgeLabel = arrowMatch[2]?.trim();
      const toPart = arrowMatch[3].trim();

      const parsedFrom = parseNodeDef(fromPart);
      const parsedTo = parseNodeDef(toPart);

      if (parsedFrom) {
        if (!nodes.has(parsedFrom.id)) {
          nodes.set(parsedFrom.id, { ...parsedFrom, level: 0 });
        }
      }
      if (parsedTo) {
        if (!nodes.has(parsedTo.id)) {
          nodes.set(parsedTo.id, { ...parsedTo, level: 1 });
        }
      }

      if (parsedFrom && parsedTo) {
        edges.push({
          from: parsedFrom.id,
          to: parsedTo.id,
          label: edgeLabel,
        });
      }
      return;
    }

    // 单节点定义
    const single = parseNodeDef(line);
    if (single && !nodes.has(single.id)) {
      nodes.set(single.id, { ...single, level: 0 });
    }
  });

  // 拓扑层级计算
  const inDegree = new Map<string, number>();
  nodes.forEach((_, id) => inDegree.set(id, 0));
  edges.forEach(e => {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });

  // 分配层级
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    edges.forEach(e => {
      const fromNode = nodes.get(e.from);
      const toNode = nodes.get(e.to);
      if (fromNode && toNode) {
        if (toNode.level <= fromNode.level) {
          toNode.level = fromNode.level + 1;
          changed = true;
        }
      }
    });
  }

  // 按 level 分组
  const levelGroups = new Map<number, NodeItem[]>();
  nodes.forEach(node => {
    const list = levelGroups.get(node.level) || [];
    list.push(node);
    levelGroups.set(node.level, list);
  });

  // 坐标几何排布
  const elements: any[] = [];
  const nodeCoords = new Map<string, { x: number; y: number; width: number; height: number }>();

  const nodeWidth = 160;
  const nodeHeight = 70;
  const gapX = isHorizontal ? 120 : 60;
  const gapY = isHorizontal ? 60 : 100;
  const startX = 100;
  const startY = 100;

  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  sortedLevels.forEach(lvl => {
    const group = levelGroups.get(lvl) || [];
    group.forEach((node, idx) => {
      let x = 0;
      let y = 0;
      if (isHorizontal) {
        x = startX + lvl * (nodeWidth + gapX);
        y = startY + idx * (nodeHeight + gapY);
      } else {
        x = startX + idx * (nodeWidth + gapX);
        y = startY + lvl * (nodeHeight + gapY);
      }

      nodeCoords.set(node.id, { x, y, width: nodeWidth, height: nodeHeight });

      // 根据 shape 及角色配置手绘颜色
      const isDecision = node.shape === 'diamond';
      const isStart = node.level === 0;
      const strokeColor = isDecision ? '#d97706' : isStart ? '#059669' : '#2563eb';
      const bgColor = isDecision ? '#fef3c7' : isStart ? '#d1fae5' : '#dbeafe';

      const shapeEl = {
        id: `node-${node.id}`,
        type: node.shape === 'diamond' ? 'diamond' : node.shape === 'ellipse' ? 'ellipse' : 'rectangle',
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        strokeColor,
        backgroundColor: bgColor,
        fillStyle: 'hachure',
        strokeWidth: 2,
        roughness: 1,
        roundness: { type: 3 },
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: [],
        updated: 1,
      };

      const textEl = {
        id: `text-${node.id}`,
        type: 'text',
        x: x + 15,
        y: y + (nodeHeight / 2) - 10,
        width: nodeWidth - 30,
        height: 20,
        text: node.label,
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: '#1e293b',
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        updated: 1,
      };

      elements.push(shapeEl, textEl);
    });
  });

  // 生成连线箭头
  edges.forEach((edge, edgeIdx) => {
    const fromCoord = nodeCoords.get(edge.from);
    const toCoord = nodeCoords.get(edge.to);
    if (!fromCoord || !toCoord) return;

    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    if (isHorizontal) {
      startX = fromCoord.x + fromCoord.width;
      startY = fromCoord.y + fromCoord.height / 2;
      endX = toCoord.x;
      endY = toCoord.y + toCoord.height / 2;
    } else {
      startX = fromCoord.x + fromCoord.width / 2;
      startY = fromCoord.y + fromCoord.height;
      endX = toCoord.x + toCoord.width / 2;
      endY = toCoord.y;
    }

    const arrowId = `arrow-${edge.from}-${edge.to}-${edgeIdx}`;
    const arrowEl = {
      id: arrowId,
      type: 'arrow',
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      points: [
        [0, 0],
        [endX - startX, endY - startY],
      ],
      strokeColor: '#64748b',
      strokeWidth: 2,
      roughness: 1,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      startBinding: { elementId: `node-${edge.from}`, focus: 0, gap: 1 },
      endBinding: { elementId: `node-${edge.to}`, focus: 0, gap: 1 },
      updated: 1,
    };

    elements.push(arrowEl);

    // 关联 boundElements
    const fromShape = elements.find(el => el.id === `node-${edge.from}`);
    const toShape = elements.find(el => el.id === `node-${edge.to}`);
    if (fromShape) {
      fromShape.boundElements = [...(fromShape.boundElements || []), { id: arrowId, type: 'arrow' }];
    }
    if (toShape) {
      toShape.boundElements = [...(toShape.boundElements || []), { id: arrowId, type: 'arrow' }];
    }
  });

  return {
    elements: sanitizeExcalidrawElements(elements),
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: 20,
    },
  };
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

/**
 * 官方 Excalidraw 素材库根地址
 */
export const EXCALIDRAW_OFFICIAL_LIBRARY_BASE_URL = 'https://libraries.excalidraw.com';

/**
 * 动态构造 Excalidraw 官方社区素材库 URL (含当前宿主回跳与 Token 标识)
 * 允许用户在官方社区中浏览并一键「Add to Excalidraw」或下载 .excalidrawlib
 */
export function getExcalidrawLibraryUrl(options?: {
  referrer?: string;
  token?: string;
  theme?: 'light' | 'dark';
}): string {
  let referrer = options?.referrer;
  if (!referrer && typeof window !== 'undefined') {
    referrer = window.location.origin + window.location.pathname;
  }
  if (!referrer) {
    referrer = 'https://omniview.dev';
  }

  const token = options?.token || 'M7h14NC7js4VCZ5yQsVUR';
  const theme = options?.theme || 'light';

  const params = new URLSearchParams({
    target: '_blank',
    referrer,
    useHash: 'true',
    token,
    theme,
    version: '2',
    sort: 'default',
  });

  return `${EXCALIDRAW_OFFICIAL_LIBRARY_BASE_URL}/?${params.toString()}`;
}

/**
 * 解析 .excalidrawlib 文本内容（支持 v1 数组与 v2 完整结构）
 */
export function parseExcalidrawLibJson(jsonContent: string): {
  isValid: boolean;
  libraryItems: any[];
  errorMessage?: string;
} {
  try {
    const parsed = JSON.parse(jsonContent);
    // 兼容 v2 格式：{ type: 'excalidrawlib', version: 2, libraryItems: [...] }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.libraryItems)) {
      const items = parsed.libraryItems.map((item: any, idx: number) => {
        const rawElements = Array.isArray(item) ? item : item.elements || [];
        return {
          id: String(item.id || `lib-${Date.now()}-${idx}`),
          status: item.status || 'published',
          elements: sanitizeExcalidrawElements(rawElements),
          created: item.created || Date.now(),
          name: item.name || `素材组件 ${idx + 1}`,
        };
      });
      return { isValid: true, libraryItems: items };
    }

    // 兼容 v1 格式：二维数组 [[element1, element2], ...] 或纯数组 [element1, element2]
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && Array.isArray(parsed[0])) {
        const items = parsed.map((group: any[], idx: number) => ({
          id: `lib-v1-${Date.now()}-${idx}`,
          status: 'published' as const,
          elements: sanitizeExcalidrawElements(group),
          created: Date.now(),
          name: `素材组件 ${idx + 1}`,
        }));
        return { isValid: true, libraryItems: items };
      } else {
        // 单个物料图元集合
        return {
          isValid: true,
          libraryItems: [
            {
              id: `lib-single-${Date.now()}`,
              status: 'published' as const,
              elements: sanitizeExcalidrawElements(parsed),
              created: Date.now(),
              name: '导入素材组件',
            },
          ],
        };
      }
    }

    // 兼容 { elements: [...] } 单个工程
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements)) {
      return {
        isValid: true,
        libraryItems: [
          {
            id: `lib-doc-${Date.now()}`,
            status: 'published' as const,
            elements: sanitizeExcalidrawElements(parsed.elements),
            created: Date.now(),
            name: '导入白板图元包',
          },
        ],
      };
    }

    return {
      isValid: false,
      libraryItems: [],
      errorMessage: '未能识别有效的 Excalidraw 素材库格式 (.excalidrawlib)',
    };
  } catch (err: any) {
    return {
      isValid: false,
      libraryItems: [],
      errorMessage: err?.message || 'JSON 解析语法错误',
    };
  }
}

/**
 * 将任意物料图元集合封装为标准 .excalidrawlib 二进制 Blob
 */
export function exportStencilsAsExcalidrawLibBlob(
  stencils: Array<{ id: string; name: string; elements: any[] }>
): Blob {
  const libraryItems = stencils.map((s, idx) => ({
    id: s.id || `lib-${Date.now()}-${idx}`,
    status: 'published' as const,
    created: Date.now(),
    name: s.name,
    elements: sanitizeExcalidrawElements(s.elements),
  }));

  const libDoc = {
    type: 'excalidrawlib',
    version: 2,
    source: 'https://omniview.dev',
    libraryItems,
  };

  return new Blob([JSON.stringify(libDoc, null, 2)], {
    type: 'application/vnd.excalidrawlib+json',
  });
}
