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

export function getPlantUmlSvgUrl(pumlCode: string, customServerUrl?: string): string {
  if (!hasRenderablePlantUmlCode(pumlCode)) return '';
  const encoded = encodePlantUml(pumlCode);
  const svgEndpoint = resolveSvgEndpoint(customServerUrl || getPlantUmlServerBase());
  return `${svgEndpoint}/${encoded}`;
}

export function getPlantUmlPngUrl(pumlCode: string, customServerUrl?: string): string {
  if (!hasRenderablePlantUmlCode(pumlCode)) return '';
  try {
    const encoded = encodePlantUml(pumlCode);
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
