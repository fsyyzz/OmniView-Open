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

  // 若用户已声明了 !theme 或者自定义了关键箭头/背景色，则不再额外注入
  if (/^[ \t]*!theme\s+/m.test(code) || /^[ \t]*skinparam\s+(backgroundColor|arrowColor|sequenceArrowColor)/im.test(code)) {
    return code;
  }

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
        'skinparam noteBorderColor #ca8a04',
        'skinparam noteBackgroundColor #fef9c3',
        'skinparam noteFontColor #713f12',
        'skinparam BoxBorderColor #2563eb',
      ].join('\n');

  const startMatch = code.match(/^[ \t]*@start[a-z]+\b[^\r\n]*\r?\n/m);
  if (startMatch && startMatch.index !== undefined) {
    const insertPos = startMatch.index + startMatch[0].length;
    return code.slice(0, insertPos) + skinparams + '\n' + code.slice(insertPos);
  }

  return skinparams + '\n' + code;
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
