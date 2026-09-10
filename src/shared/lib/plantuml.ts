// PlantUML URL generator using plantuml-encoder or fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import plantumlEncoder from 'plantuml-encoder';

export const PLANTUML_SERVER_PRESETS = [
  { id: 'official', name: '官方云端服务器 (公网)', url: 'https://www.plantuml.com/plantuml' },
  { id: 'docker', name: '本地 Docker 容器 (localhost:8080)', url: 'http://localhost:8080' },
  { id: 'custom', name: '企业自建私有服务 (自定义)', url: '' },
];

const STORAGE_KEY = 'omnivewer_plantuml_server';

export function getPlantUmlServerBase(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
  } catch (e) {
    // Ignore in non-browser context
  }
  return 'https://www.plantuml.com/plantuml';
}

export function setPlantUmlServerBase(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
  } catch (e) {
    // Ignore
  }
}

export function getPlantUmlSvgUrl(pumlCode: string, customServerUrl?: string): string {
  try {
    const cleanCode = pumlCode.trim();
    const encoded = plantumlEncoder.encode(cleanCode);
    const base = (customServerUrl || getPlantUmlServerBase()).replace(/\/$/, '');
    const svgEndpoint = base.endsWith('/svg') ? base : `${base}/svg`;
    return `${svgEndpoint}/${encoded}`;
  } catch (err) {
    console.error('Failed to encode PlantUML with plantuml-encoder:', err);
    const base64 = btoa(unescape(encodeURIComponent(pumlCode)));
    const base = (customServerUrl || getPlantUmlServerBase()).replace(/\/$/, '');
    const svgEndpoint = base.endsWith('/svg') ? base : `${base}/svg`;
    return `${svgEndpoint}/~1${base64}`;
  }
}

export function getPlantUmlPngUrl(pumlCode: string, customServerUrl?: string): string {
  try {
    const cleanCode = pumlCode.trim();
    const encoded = plantumlEncoder.encode(cleanCode);
    const base = (customServerUrl || getPlantUmlServerBase()).replace(/\/$/, '');
    const pngEndpoint = base.endsWith('/png') ? base : `${base}/png`;
    return `${pngEndpoint}/${encoded}`;
  } catch (err) {
    console.error('Failed to encode PlantUML png:', err);
    return '';
  }
}

