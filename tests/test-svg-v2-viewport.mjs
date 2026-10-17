#!/usr/bin/env node
/**
 * OmniView SVG v2 — 视口缩放/平移纯函数测试 (P2)
 *
 * 覆盖：
 *  1. clampViewportScale 边界（0.2x~5x）与 NaN 防御
 *  2. wheelZoomFactor（滚轮阶梯 / ctrlKey 连续）
 *  3. zoomViewportAtPoint 光标锚点不变量（缩放前后光标所指画布点停在原屏幕像素）
 *  4. zoomViewportAtPoint 边界 no-op（返回原引用，React 跳过渲染）
 *  5. panViewportBy 平移与零位移 no-op
 *  6. resetViewport 恒等
 *  7. 交换律：clientToCanvasPoint 作用于 CSS transform 后的包围盒
 *     等价于先逆视口变换再 letterbox（证明回退坐标链在视口下仍精确）
 */
import assert from 'node:assert';
import {
  clientToCanvasPoint,
  clampViewportScale,
  resetViewport,
  wheelZoomFactor,
  zoomViewportAtPoint,
  panViewportBy,
  canvasToClientPoint,
  IDENTITY_VIEWPORT,
  VIEWPORT_MIN_SCALE,
  VIEWPORT_MAX_SCALE,
} from '../src/features/viewers/components/drivers/svg/core/index.ts';

console.log('🧪 开始 SVG v2 视口缩放/平移测试...');

let passed = 0;
let failed = 0;
const tests = [];
const it = (name, fn) => {
  tests.push({ name, fn });
};

const approx = (a, b, eps = 1e-6, msg = '') =>
  assert.ok(Math.abs(a - b) <= eps, `${msg} expected ${b}, got ${a}`);

const RECT = { left: 100, top: 50, width: 400, height: 300 };

// ============================================================================
it('clampViewportScale：越界收敛到 0.2x~5x，NaN 回退 1', () => {
  assert.strictEqual(clampViewportScale(0.01), VIEWPORT_MIN_SCALE);
  assert.strictEqual(clampViewportScale(99), VIEWPORT_MAX_SCALE);
  assert.strictEqual(clampViewportScale(1.5), 1.5);
  assert.strictEqual(clampViewportScale(NaN), 1);
  assert.strictEqual(clampViewportScale(Infinity), VIEWPORT_MAX_SCALE);
});

it('wheelZoomFactor：滚轮上/下阶梯 1.15/0.85，ctrlKey 连续 exp', () => {
  approx(wheelZoomFactor(-100, false), 1.15);
  approx(wheelZoomFactor(100, false), 0.85);
  approx(wheelZoomFactor(-50, true), Math.exp(0.5));
  approx(wheelZoomFactor(50, true), Math.exp(-0.5));
});

it('zoomViewportAtPoint：光标锚点不变量（缩放后画布点停在同一屏幕像素）', () => {
  const vp0 = { scale: 1.3, x: 20, y: -15 };
  const cursor = { x: 220, y: 160 };
  const cursorLocal = { x: cursor.x - RECT.left, y: cursor.y - RECT.top };
  // 局部正向：local = C + t + s·(p − C)，逆构造不动点 p = C + (local − t − C)/s
  const C = { x: RECT.width / 2, y: RECT.height / 2 };
  const fixed = {
    x: C.x + (cursorLocal.x - vp0.x - C.x) / vp0.scale,
    y: C.y + (cursorLocal.y - vp0.y - C.y) / vp0.scale,
  };
  // 自检：不动点在原视口下正映射回光标局部坐标
  const sanity = canvasToClientPoint(fixed, vp0, RECT);
  approx(sanity.x, cursorLocal.x, 1e-6, 'sanity x');
  approx(sanity.y, cursorLocal.y, 1e-6, 'sanity y');

  for (const factor of [1.15, 0.85, 2, 0.5]) {
    const vp1 = zoomViewportAtPoint(vp0, factor, cursor.x, cursor.y, RECT);
    const after = canvasToClientPoint(fixed, vp1, RECT);
    // 允差 0.11：zoomViewportAtPoint 与 v1 一致对位移做 0.1px 舍入
    approx(after.x, cursorLocal.x, 0.11, `factor=${factor} x`);
    approx(after.y, cursorLocal.y, 0.11, `factor=${factor} y`);
  }
});

it('zoomViewportAtPoint：命中缩放边界返回原引用（no-op）', () => {
  const atMax = { scale: VIEWPORT_MAX_SCALE, x: 0, y: 0 };
  assert.strictEqual(zoomViewportAtPoint(atMax, 1.15, 300, 200, RECT), atMax);
  const atMin = { scale: VIEWPORT_MIN_SCALE, x: 5, y: 5 };
  assert.strictEqual(zoomViewportAtPoint(atMin, 0.85, 300, 200, RECT), atMin);
});

it('panViewportBy：平移累加；零位移返回原引用', () => {
  const vp = { scale: 2, x: 10, y: -20 };
  assert.deepStrictEqual(panViewportBy(vp, 5, -5), { scale: 2, x: 15, y: -25 });
  assert.strictEqual(panViewportBy(vp, 0, 0), vp);
});

it('resetViewport：恢复恒等视口', () => {
  assert.deepStrictEqual(resetViewport(), IDENTITY_VIEWPORT);
  assert.deepStrictEqual(resetViewport(), { scale: 1, x: 0, y: 0 });
});

it('交换律：变换后包围盒上的 clientToCanvasPoint ≡ 逆视口 + letterbox（回退链精确）', () => {
  const view = { x: 10, y: 20, width: 200, height: 100 };
  const vp = { scale: 2, x: 30, y: -10 };
  // 未变换盒（wrapper 铺满视口区域，transform-origin 即其几何中心）
  const rect0 = { left: 100, top: 50, width: 400, height: 300 };
  const Cx = rect0.left + rect0.width / 2;
  const Cy = rect0.top + rect0.height / 2;
  // center-origin CSS transform 后的轴对齐包围盒：p' = C + t + s·(p − C)
  const rectT = {
    left: Cx + vp.x + vp.scale * (rect0.left - Cx),
    top: Cy + vp.y + vp.scale * (rect0.top - Cy),
    width: rect0.width * vp.scale,
    height: rect0.height * vp.scale,
  };
  for (const client of [
    { x: 150, y: 80 },
    { x: 300, y: 200 },
    { x: 450, y: 320 },
  ]) {
    const viaTransformed = clientToCanvasPoint(client.x, client.y, rectT, view);
    assert.ok(viaTransformed, '变换盒路径有解');
    // 逆视口（绝对坐标）：p = C + (client − t − C)/s
    const un = {
      x: Cx + (client.x - vp.x - Cx) / vp.scale,
      y: Cy + (client.y - vp.y - Cy) / vp.scale,
    };
    const viaUndo = clientToCanvasPoint(un.x, un.y, rect0, view);
    assert.ok(viaUndo, '逆变换路径有解');
    approx(viaTransformed.x, viaUndo.x, 1e-6, 'x 一致');
    approx(viaTransformed.y, viaUndo.y, 1e-6, 'y 一致');
  }
});

// ============================================================================
// 汇总
// ============================================================================
async function main() {
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✅', t.name);
      passed++;
    } catch (e) {
      console.log('  ❌', t.name, '-', e instanceof Error ? e.message : e);
      failed++;
    }
  }
  console.log('\n📊 测试结果:', passed, '通过,', failed, '失败');
  if (failed > 0) process.exit(1);
}
main();
