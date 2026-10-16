/**
 * OmniView SVG 编辑引擎 v2 — Feature Flag 路由 (M6)
 *
 * omniview.svg.engine: 'v1' | 'v2'
 * - 默认 'v2'（现代不可变 Document 模型）
 * - 用户在设置或控制台可切换回 'v1'
 */

export type SvgEngineVersion = 'v1' | 'v2';

const FLAG_KEY = 'omniview.svg.engine';

let memoryFlag: SvgEngineVersion = 'v2';

export function getSvgEngineFlag(): SvgEngineVersion {
  if (typeof localStorage === 'undefined') return memoryFlag;
  try {
    const v = localStorage.getItem(FLAG_KEY);
    return v === 'v1' ? 'v1' : 'v2';
  } catch {
    return memoryFlag;
  }
}

export function setSvgEngineFlag(v: SvgEngineVersion): void {
  memoryFlag = v;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FLAG_KEY, v);
  } catch {
    // ignore
  }
}

export const SVG_ENGINE_FLAG_KEY = FLAG_KEY;