/**
 * OmniView SVG 编辑引擎 v2 — Feature Flag 路由 (M6)
 *
 * omniview.svg.engine: 'v1' | 'v2'
 * - 默认 'v1'（保守）
 * - 用户在 Storage v2 设置页可切换到 v2
 */

export type SvgEngineVersion = 'v1' | 'v2';

const FLAG_KEY = 'omniview.svg.engine';

export function getSvgEngineFlag(): SvgEngineVersion {
  if (typeof localStorage === 'undefined') return 'v1';
  try {
    const v = localStorage.getItem(FLAG_KEY);
    return v === 'v2' ? 'v2' : 'v1';
  } catch {
    return 'v1';
  }
}

export function setSvgEngineFlag(v: SvgEngineVersion): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FLAG_KEY, v);
  } catch {
    // ignore
  }
}

export const SVG_ENGINE_FLAG_KEY = FLAG_KEY;