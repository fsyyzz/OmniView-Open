// PlantUML URL generator using plantuml-encoder or fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import plantumlEncoder from 'plantuml-encoder';

export const PLANTUML_SERVER_PRESETS = [
  { id: 'official', name: '官方云端服务器 (公网)', url: 'https://www.plantuml.com/plantuml' },
  { id: 'docker', name: '本地 Docker 容器 (localhost:8080)', url: 'http://localhost:8080' },
  { id: 'custom', name: '企业自建私有服务 (自定义)', url: '' },
];

/** 渲染失败时自动尝试的备用服务（按顺序） */
export const PLANTUML_FALLBACK_SERVERS = [
  'https://www.plantuml.com/plantuml',
  'http://localhost:8080',
];

const STORAGE_KEY = 'omnivewer_plantuml_server';
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml';

export function getPlantUmlServerBase(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
  } catch {
    // Ignore in non-browser context
  }
  return DEFAULT_SERVER;
}

export function setPlantUmlServerBase(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
  } catch {
    // Ignore
  }
}

function resolveSvgEndpoint(baseUrl: string): string {
  const base = (baseUrl || DEFAULT_SERVER).replace(/\/$/, '');
  if (base.endsWith('/svg')) return base;
  return `${base}/svg`;
}

function resolvePngEndpoint(baseUrl: string): string {
  const base = (baseUrl || DEFAULT_SERVER).replace(/\/$/, '');
  if (base.endsWith('/png')) return base;
  return `${base}/png`;
}

/** 是否具备可渲染的 PlantUML 正文（避免空图被编码成极小白点） */
export function hasRenderablePlantUmlCode(pumlCode: string | undefined | null): boolean {
  const trimmed = (pumlCode || '').trim();
  if (!trimmed) return false;

  // 去掉围栏、行注释与空行后，仍需有实际图表语句
  const body = trimmed
    .replace(/@startuml\b[^\n]*/gi, '')
    .replace(/@enduml\b/gi, '')
    .replace(/^\s*'.*$/gm, '')
    .replace(/^\s*\/'[\s\S]*?'\/\s*$/gm, '')
    .replace(/^\s*$/gm, '')
    .trim();

  return body.length > 0;
}

export function encodePlantUml(pumlCode: string): string {
  const cleanCode = pumlCode.trim();
  try {
    return plantumlEncoder.encode(cleanCode);
  } catch (err) {
    console.error('Failed to encode PlantUML with plantuml-encoder:', err);
    // plantuml ~1 前缀表示 base64 文本载荷
    return `~1${btoa(unescape(encodeURIComponent(cleanCode)))}`;
  }
}

/**
 * 针对深浅主题注入高对比度、清晰可视的 PlantUML 皮肤指令 (Skinparam)
 * 重点强化线条、边框、文字背景以及分组子图
 * 若源码中已显式指定 !theme 或 arrowColor 等自定义皮肤，则尊重用户原生配置，不作侵入。
 */
export function preparePlantUmlCode(pumlCode: string, isDarkTheme: boolean = true): string {
  const code = (pumlCode || '').trim();
  if (!code) return code;

  // 若用户已声明了 !theme 或者自定义了关键箭头/背景色/样式块，则不再额外注入
  if (/^[ \t]*!theme\s+/m.test(code) || /^[ \t]*skinparam\s+(backgroundColor|arrowColor|sequenceArrowColor)/im.test(code)) {
    return code;
  }

  // 1. 针对思维脑图 (Mindmap) 与工作分解结构 (WBS) 的原生样式块
  const hasCustomStyle = /<style>[\s\S]*?(mindmapDiagram|wbsDiagram)[\s\S]*?<\/style>/i.test(code);
  const styleBlock = !hasCustomStyle
    ? isDarkTheme
      ? [
          '<style>',
          'mindmapDiagram {',
          '  node {',
          '    BackgroundColor #111827',
          '    LineColor #38bdf8',
          '    FontColor #f8fafc',
          '    RoundCorner 10',
          '  }',
          '  arrow {',
          '    LineColor #60a5fa',
          '    LineThickness 1.5',
          '  }',
          '}',
          'wbsDiagram {',
          '  node {',
          '    BackgroundColor #111827',
          '    LineColor #38bdf8',
          '    FontColor #f8fafc',
          '    RoundCorner 8',
          '  }',
          '  arrow {',
          '    LineColor #60a5fa',
          '    LineThickness 1.5',
          '  }',
          '}',
          '</style>',
        ].join('\n')
      : [
          '<style>',
          'mindmapDiagram {',
          '  node {',
          '    BackgroundColor #f8fafc',
          '    LineColor #2563eb',
          '    FontColor #0f172a',
          '    RoundCorner 10',
          '  }',
          '  arrow {',
          '    LineColor #1e293b',
          '    LineThickness 1.5',
          '  }',
          '}',
          'wbsDiagram {',
          '  node {',
          '    BackgroundColor #f8fafc',
          '    LineColor #2563eb',
          '    FontColor #0f172a',
          '    RoundCorner 8',
          '  }',
          '  arrow {',
          '    LineColor #1e293b',
          '    LineThickness 1.5',
          '  }',
          '}',
          '</style>',
        ].join('\n')
    : '';

  // 2. 针对 UML 图元全景覆盖 (重点防范用例图、包、边界白底白字)
  const skinparams = isDarkTheme
    ? [
        'skinparam backgroundColor transparent',
        'skinparam defaultFontColor #f8fafc',
        'skinparam ArrowColor #60a5fa',
        'skinparam ArrowFontColor #93c5fd',
        'skinparam ArrowThickness 1.8',
        'skinparam sequenceLifeLineBorderColor #94a3b8',
        'skinparam sequenceLifeLineBackgroundColor #0f172a',
        'skinparam participantBorderColor #38bdf8',
        'skinparam participantBackgroundColor #111827',
        'skinparam participantFontColor #f8fafc',
        'skinparam actorBorderColor #38bdf8',
        'skinparam actorBackgroundColor #111827',
        'skinparam actorFontColor #f8fafc',
        'skinparam usecaseBorderColor #38bdf8',
        'skinparam usecaseBackgroundColor #111827',
        'skinparam usecaseFontColor #f8fafc',
        'skinparam usecaseArrowColor #60a5fa',
        'skinparam classBorderColor #38bdf8',
        'skinparam classBackgroundColor #111827',
        'skinparam classFontColor #f8fafc',
        'skinparam classArrowColor #60a5fa',
        'skinparam stateBorderColor #38bdf8',
        'skinparam stateBackgroundColor #111827',
        'skinparam stateFontColor #f8fafc',
        'skinparam stateArrowColor #60a5fa',
        'skinparam activityBorderColor #38bdf8',
        'skinparam activityBackgroundColor #111827',
        'skinparam activityFontColor #f8fafc',
        'skinparam activityArrowColor #60a5fa',
        'skinparam componentBorderColor #38bdf8',
        'skinparam componentBackgroundColor #111827',
        'skinparam componentFontColor #f8fafc',
        'skinparam componentArrowColor #60a5fa',
        'skinparam packageBorderColor #64748b',
        'skinparam packageBackgroundColor #0f172a',
        'skinparam packageFontColor #f8fafc',
        'skinparam rectangleBorderColor #64748b',
        'skinparam rectangleBackgroundColor #0f172a',
        'skinparam rectangleFontColor #f8fafc',
        'skinparam agentBorderColor #38bdf8',
        'skinparam agentBackgroundColor #111827',
        'skinparam agentFontColor #f8fafc',
        'skinparam databaseBorderColor #38bdf8',
        'skinparam databaseBackgroundColor #111827',
        'skinparam databaseFontColor #f8fafc',
        'skinparam queueBorderColor #38bdf8',
        'skinparam queueBackgroundColor #111827',
        'skinparam queueFontColor #f8fafc',
        'skinparam collectionsBorderColor #38bdf8',
        'skinparam collectionsBackgroundColor #111827',
        'skinparam collectionsFontColor #f8fafc',
        'skinparam cloudBorderColor #38bdf8',
        'skinparam cloudBackgroundColor #111827',
        'skinparam cloudFontColor #f8fafc',
        'skinparam nodeBorderColor #38bdf8',
        'skinparam nodeBackgroundColor #111827',
        'skinparam nodeFontColor #f8fafc',
        'skinparam storageBorderColor #38bdf8',
        'skinparam storageBackgroundColor #111827',
        'skinparam storageFontColor #f8fafc',
        'skinparam cardBorderColor #38bdf8',
        'skinparam cardBackgroundColor #111827',
        'skinparam cardFontColor #f8fafc',
        'skinparam boundaryBorderColor #38bdf8',
        'skinparam boundaryBackgroundColor #111827',
        'skinparam boundaryFontColor #f8fafc',
        'skinparam controlBorderColor #38bdf8',
        'skinparam controlBackgroundColor #111827',
        'skinparam controlFontColor #f8fafc',
        'skinparam entityBorderColor #38bdf8',
        'skinparam entityBackgroundColor #111827',
        'skinparam entityFontColor #f8fafc',
        'skinparam interfaceBorderColor #38bdf8',
        'skinparam interfaceBackgroundColor #111827',
        'skinparam interfaceFontColor #f8fafc',
        'skinparam fileBorderColor #64748b',
        'skinparam fileBackgroundColor #0f172a',
        'skinparam fileFontColor #f8fafc',
        'skinparam folderBorderColor #64748b',
        'skinparam folderBackgroundColor #0f172a',
        'skinparam folderFontColor #f8fafc',
        'skinparam frameBorderColor #64748b',
        'skinparam frameBackgroundColor #0f172a',
        'skinparam frameFontColor #f8fafc',
        'skinparam noteBorderColor #f59e0b',
        'skinparam noteBackgroundColor #1e293b',
        'skinparam noteFontColor #fef08a',
        'skinparam BoxBorderColor #38bdf8',
      ].join('\n')
    : [
        'skinparam backgroundColor transparent',
        'skinparam defaultFontColor #0f172a',
        'skinparam ArrowColor #1e293b',
        'skinparam ArrowFontColor #0f172a',
        'skinparam ArrowThickness 1.8',
        'skinparam sequenceLifeLineBorderColor #64748b',
        'skinparam sequenceLifeLineBackgroundColor #ffffff',
        'skinparam participantBorderColor #2563eb',
        'skinparam participantBackgroundColor #f8fafc',
        'skinparam participantFontColor #0f172a',
        'skinparam actorBorderColor #2563eb',
        'skinparam actorBackgroundColor #ffffff',
        'skinparam actorFontColor #0f172a',
        'skinparam usecaseBorderColor #2563eb',
        'skinparam usecaseBackgroundColor #f8fafc',
        'skinparam usecaseFontColor #0f172a',
        'skinparam usecaseArrowColor #1e293b',
        'skinparam classBorderColor #2563eb',
        'skinparam classBackgroundColor #f8fafc',
        'skinparam classFontColor #0f172a',
        'skinparam classArrowColor #1e293b',
        'skinparam stateBorderColor #2563eb',
        'skinparam stateBackgroundColor #f8fafc',
        'skinparam stateFontColor #0f172a',
        'skinparam stateArrowColor #1e293b',
        'skinparam activityBorderColor #2563eb',
        'skinparam activityBackgroundColor #f8fafc',
        'skinparam activityFontColor #0f172a',
        'skinparam activityArrowColor #1e293b',
        'skinparam componentBorderColor #2563eb',
        'skinparam componentBackgroundColor #f8fafc',
        'skinparam componentFontColor #0f172a',
        'skinparam componentArrowColor #1e293b',
        'skinparam packageBorderColor #94a3b8',
        'skinparam packageBackgroundColor #f1f5f9',
        'skinparam packageFontColor #0f172a',
        'skinparam rectangleBorderColor #94a3b8',
        'skinparam rectangleBackgroundColor #f8fafc',
        'skinparam rectangleFontColor #0f172a',
        'skinparam agentBorderColor #2563eb',
        'skinparam agentBackgroundColor #f8fafc',
        'skinparam agentFontColor #0f172a',
        'skinparam databaseBorderColor #2563eb',
        'skinparam databaseBackgroundColor #f8fafc',
        'skinparam databaseFontColor #0f172a',
        'skinparam queueBorderColor #2563eb',
        'skinparam queueBackgroundColor #f8fafc',
        'skinparam queueFontColor #0f172a',
        'skinparam collectionsBorderColor #2563eb',
        'skinparam collectionsBackgroundColor #f8fafc',
        'skinparam collectionsFontColor #0f172a',
        'skinparam cloudBorderColor #2563eb',
        'skinparam cloudBackgroundColor #f8fafc',
        'skinparam cloudFontColor #0f172a',
        'skinparam nodeBorderColor #2563eb',
        'skinparam nodeBackgroundColor #f8fafc',
        'skinparam nodeFontColor #0f172a',
        'skinparam storageBorderColor #2563eb',
        'skinparam storageBackgroundColor #f8fafc',
        'skinparam storageFontColor #0f172a',
        'skinparam cardBorderColor #2563eb',
        'skinparam cardBackgroundColor #f8fafc',
        'skinparam cardFontColor #0f172a',
        'skinparam boundaryBorderColor #2563eb',
        'skinparam boundaryBackgroundColor #f8fafc',
        'skinparam boundaryFontColor #0f172a',
        'skinparam controlBorderColor #2563eb',
        'skinparam controlBackgroundColor #f8fafc',
        'skinparam controlFontColor #0f172a',
        'skinparam entityBorderColor #2563eb',
        'skinparam entityBackgroundColor #f8fafc',
        'skinparam entityFontColor #0f172a',
        'skinparam interfaceBorderColor #2563eb',
        'skinparam interfaceBackgroundColor #f8fafc',
        'skinparam interfaceFontColor #0f172a',
        'skinparam fileBorderColor #94a3b8',
        'skinparam fileBackgroundColor #f8fafc',
        'skinparam fileFontColor #0f172a',
        'skinparam folderBorderColor #94a3b8',
        'skinparam folderBackgroundColor #f8fafc',
        'skinparam folderFontColor #0f172a',
        'skinparam frameBorderColor #94a3b8',
        'skinparam frameBackgroundColor #f8fafc',
        'skinparam frameFontColor #0f172a',
        'skinparam noteBorderColor #ca8a04',
        'skinparam noteBackgroundColor #fef9c3',
        'skinparam noteFontColor #713f12',
        'skinparam BoxBorderColor #2563eb',
      ].join('\n');

  const payload = styleBlock ? `${styleBlock}\n${skinparams}` : skinparams;

  const startMatch = code.match(/^[ \t]*@start[a-z]+\b[^\r\n]*\r?\n/m);
  if (startMatch && startMatch.index !== undefined) {
    const insertPos = startMatch.index + startMatch[0].length;
    return code.slice(0, insertPos) + payload + '\n' + code.slice(insertPos);
  }

  return payload + '\n' + code;
}

export function getPlantUmlSvgUrl(pumlCode: string, customServerUrl?: string, isDarkTheme: boolean = true): string {
  if (!hasRenderablePlantUmlCode(pumlCode)) return '';
  const prepared = preparePlantUmlCode(pumlCode, isDarkTheme);
  const encoded = encodePlantUml(prepared);
  const svgEndpoint = resolveSvgEndpoint(customServerUrl || getPlantUmlServerBase());
  return `${svgEndpoint}/${encoded}`;
}

export function getPlantUmlPngUrl(pumlCode: string, customServerUrl?: string, isDarkTheme: boolean = true): string {
  if (!hasRenderablePlantUmlCode(pumlCode)) return '';
  try {
    const prepared = preparePlantUmlCode(pumlCode, isDarkTheme);
    const encoded = encodePlantUml(prepared);
    const pngEndpoint = resolvePngEndpoint(customServerUrl || getPlantUmlServerBase());
    return `${pngEndpoint}/${encoded}`;
  } catch (err) {
    console.error('Failed to encode PlantUML png:', err);
    return '';
  }
}

/** 为图片 URL 追加缓存破坏参数，强制重新拉取 */
export function withPlantUmlCacheBust(url: string, nonce: number | string): string {
  if (!url) return '';
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}ov_cb=${encodeURIComponent(String(nonce))}`;
}
